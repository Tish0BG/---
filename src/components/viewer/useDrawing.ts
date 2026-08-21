import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type {
  Annotation,
  Point,
  RegionAnnotation,
  ShapeAnnotation,
  StrokeAnnotation,
  TextAnnotation,
} from '@/types';
import { useViewer } from '@/state/viewerStore';
import { useSettings } from '@/state/settingsStore';
import {
  annotationsInRect,
  eraseAt,
  makeShape,
  makeStroke,
  pickAnnotation,
  pushPoint,
  recognizeShape,
  snapAngle,
  translateAnnotation,
} from '@/services/annotationService';
import { drawAnnotation, drawStroke } from '@/services/renderService';
import { rectFromPoints, uid, withAlpha } from '@/lib/util';
import { useSnip } from '@/state/snipStore';
import {
  applySnapTarget,
  findSnapTarget,
  instrumentArea,
  snappingActive,
  type SnapTarget,
} from '@/state/instrumentStore';
import { gestureBus } from './gestureBus';

type Gesture =
  | { kind: 'stroke'; ann: StrokeAnnotation }
  | { kind: 'shape'; ann: ShapeAnnotation; start: Point; shift: boolean }
  | { kind: 'region'; ann: RegionAnnotation; start: Point }
  | { kind: 'erase'; gestureId: string; last: Point | null }
  | { kind: 'move'; gestureId: string; last: Point }
  | { kind: 'marquee'; start: Point; cur: Point }
  | { kind: 'snip'; start: Point; cur: Point }
  | null;

/** Tools whose points a ruler, protractor or grid may take over. */
const GUIDED_TOOLS = new Set<string>(['pen', 'highlighter', 'line', 'rect', 'ellipse', 'arrow']);

const DRAW_TOOLS = new Set([
  'pen',
  'highlighter',
  'line',
  'rect',
  'ellipse',
  'arrow',
  'region',
  'eraser',
  'text',
  'snip',
]);

export interface DrawingApi {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** css `cursor` value for the page surface */
  cursor: string;
  /** true when the page should swallow touch gestures */
  captures: boolean;
}

/**
 * Owns all pointer interaction for one page: freehand strokes, shapes,
 * erasing, selection and moving. The in-flight gesture is drawn on a
 * throw-away "live" canvas and only committed to the store on pointerup —
 * that is what keeps writing smooth no matter how many annotations exist.
 */
export function useDrawing(
  pageNumber: number,
  zoom: number,
  renderScale: number,
  liveRef: RefObject<HTMLCanvasElement | null>,
  pageSize: { width: number; height: number },
): DrawingApi {
  const tool = useViewer((s) => s.tool);
  const settings = useSettings();
  const gesture = useRef<Gesture>(null);
  const raf = useRef(0);
  const rectRef = useRef<DOMRect | null>(null);
  /** the edge this stroke latched onto, held until the pen lifts */
  const snapLock = useRef<SnapTarget | null>(null);

  /**
   * Screen point → page point, with the geometry instruments given the first
   * say. A ruler on the page means the ink runs along its edge, so the pull
   * has to happen here, before the coordinate is converted and long before it
   * reaches the annotation.
   */
  const toPage = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const r = rectRef.current!;
      let { clientX: cx, clientY: cy } = e;
      const area = instrumentArea();
      if (area && GUIDED_TOOLS.has(useViewer.getState().tool) && snappingActive()) {
        if (!snapLock.current) snapLock.current = findSnapTarget(cx, cy, area);
        if (snapLock.current) {
          const snapped = applySnapTarget(snapLock.current, cx, cy, area);
          cx = snapped.x;
          cy = snapped.y;
        }
      }
      return { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom };
    },
    [zoom],
  );

  /* ------------------------------------------------------- live painting */

  const sizeLive = useCallback(() => {
    const c = liveRef.current;
    if (!c) return null;
    const w = Math.max(1, Math.round(pageSize.width * renderScale));
    const h = Math.max(1, Math.round(pageSize.height * renderScale));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c.getContext('2d');
  }, [liveRef, pageSize.width, pageSize.height, renderScale]);

  const clearLive = useCallback(() => {
    const c = liveRef.current;
    if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    c.width = 0;
    c.height = 0;
  }, [liveRef]);

  const paintLive = useCallback(() => {
    const g = gesture.current;
    const ctx = sizeLive();
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!g) return;
    ctx.scale(renderScale, renderScale);
    const pressure = settings.pressureSensitivity;
    if (g.kind === 'stroke') {
      drawStroke(ctx, g.ann, pressure, true);
    } else if (g.kind === 'shape' || g.kind === 'region') {
      drawAnnotation(ctx, g.ann, { pressure });
    } else if (g.kind === 'marquee' || g.kind === 'snip') {
      const r = rectFromPoints(g.start, g.cur);
      ctx.save();
      if (g.kind === 'snip') {
        // dim everything outside the clip so the framing is obvious
        ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.fillRect(0, 0, ctx.canvas.width / renderScale, ctx.canvas.height / renderScale);
        ctx.clearRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
      } else {
        ctx.fillStyle = withAlpha('#4f46e5', 0.1);
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }, [renderScale, settings.pressureSensitivity, sizeLive, zoom]);

  const schedulePaint = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      paintLive();
    });
  }, [paintLive]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /* ------------------------------------------------------------- helpers */

  const abort = useCallback(() => {
    gesture.current = null;
    snapLock.current = null;
    clearLive();
  }, [clearLive]);

  useEffect(() => {
    // Only this page's own handler is withdrawn; clearing whatever happens to
    // be there would disarm the page that is actually being drawn on.
    return () => {
      if (gestureBus.abortDrawing === abort) gestureBus.abortDrawing = null;
    };
  }, [abort]);

  const preset = settings.toolPresets[tool] ?? { color: '#1d4ed8', size: 2, opacity: 1 };

  /* -------------------------------------------------------- pointer down */

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const store = useViewer.getState();
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (gestureBus.panning) return;
      // touch is reserved for scrolling when the user draws with a stylus
      if (e.pointerType === 'touch' && (settings.stylusOnly || store.tool === 'pan')) return;
      if (store.tool === 'pan') return;
      if (store.editingTextId) return;

      rectRef.current = e.currentTarget.getBoundingClientRect();
      snapLock.current = null;
      const p = toPage(e);
      const docId = store.docId!;
      const now = Date.now();

      if (store.tool === 'select') {
        const hit = pickAnnotation(store.annotationsFor(pageNumber), p, 6 / zoom);
        if (hit) {
          const already = store.selectedIds.includes(hit.id);
          const ids = e.shiftKey
            ? already
              ? store.selectedIds.filter((id) => id !== hit.id)
              : [...store.selectedIds, hit.id]
            : already
              ? store.selectedIds
              : [hit.id];
          store.setSelection(ids);
          gesture.current = { kind: 'move', gestureId: uid('g_'), last: p };
        } else {
          store.setSelection([]);
          gesture.current = { kind: 'marquee', start: p, cur: p };
        }
      } else if (store.tool === 'pen' || store.tool === 'highlighter') {
        const ann = makeStroke(docId, pageNumber, store.tool, preset.color, preset.size, preset.opacity);
        pushPoint(ann.points, p.x, p.y, pressureOf(e, settings.pressureSensitivity));
        gesture.current = { kind: 'stroke', ann };
      } else if (store.tool === 'eraser') {
        gesture.current = { kind: 'erase', gestureId: uid('g_'), last: null };
        eraseStep(pageNumber, p, settings.eraserSize / 2 / zoom, settings.eraserMode, gesture.current.gestureId);
      } else if (store.tool === 'text') {
        const ann: TextAnnotation = {
          id: uid('an_'),
          docId,
          page: pageNumber,
          type: 'text',
          x: p.x,
          y: p.y,
          w: Math.min(240, pageSize.width - p.x - 8),
          h: preset.size * 1.6,
          text: '',
          fontSize: preset.size,
          fontFamily: settings.textFont,
          align: settings.textAlign,
          bold: settings.textBold,
          italic: settings.textItalic,
          color: preset.color,
          opacity: preset.opacity,
          createdAt: now,
          updatedAt: now,
        };
        e.preventDefault();
        // Same label as the editor's own commits, so creating and typing a
        // note collapse into one undo step.
        store.commit({ added: [ann], removed: [], label: `text-${ann.id}` });
        store.setEditingText(ann.id);
        return;
      } else if (store.tool === 'snip') {
        gesture.current = { kind: 'snip', start: p, cur: p };
      } else if (store.tool === 'region') {
        const ann: RegionAnnotation = {
          id: uid('an_'),
          docId,
          page: pageNumber,
          type: 'region',
          x: p.x,
          y: p.y,
          w: 0,
          h: 0,
          label: '',
          status: 'unsolved',
          color: '#94a3b8',
          opacity: 1,
          createdAt: now,
          updatedAt: now,
        };
        gesture.current = { kind: 'region', ann, start: p };
      } else {
        const ann = makeShape(
          docId,
          pageNumber,
          store.tool as ShapeAnnotation['type'],
          preset.color,
          preset.size,
          preset.opacity,
          p.x,
          p.y,
        );
        gesture.current = { kind: 'shape', ann, start: p, shift: e.shiftKey };
      }

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      gestureBus.abortDrawing = abort;
      schedulePaint();
    },
    [abort, pageNumber, pageSize.width, preset.color, preset.opacity, preset.size, schedulePaint, settings.eraserMode, settings.eraserSize, settings.pressureSensitivity, settings.stylusOnly, toPage, zoom],
  );

  /* -------------------------------------------------------- pointer move */

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      if (!g) return;
      if (gestureBus.panning) {
        abort();
        return;
      }
      rectRef.current = e.currentTarget.getBoundingClientRect();

      if (g.kind === 'stroke') {
        const events = typeof e.nativeEvent.getCoalescedEvents === 'function'
          ? e.nativeEvent.getCoalescedEvents()
          : [e.nativeEvent];
        for (const ev of events.length ? events : [e.nativeEvent]) {
          const p = toPage(ev);
          pushPoint(g.ann.points, p.x, p.y, pressureOf(ev, settings.pressureSensitivity), 0.5 / zoom);
        }
      } else if (g.kind === 'shape') {
        const p = toPage(e);
        let end = p;
        if (e.shiftKey) {
          end = g.ann.type === 'line' || g.ann.type === 'arrow' ? snapAngle(g.start, p) : square(g.start, p);
        }
        g.ann.x2 = end.x;
        g.ann.y2 = end.y;
      } else if (g.kind === 'region') {
        const p = toPage(e);
        const r = rectFromPoints(g.start, p);
        Object.assign(g.ann, r);
      } else if (g.kind === 'erase') {
        const p = toPage(e);
        eraseStep(pageNumber, p, settings.eraserSize / 2 / zoom, settings.eraserMode, g.gestureId, g.last);
        g.last = p;
      } else if (g.kind === 'move') {
        const p = toPage(e);
        const dx = p.x - g.last.x;
        const dy = p.y - g.last.y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          const store = useViewer.getState();
          const before = store.selectedIds
            .map((id) => store.findAnnotation(id))
            .filter((a): a is Annotation => !!a);
          if (before.length) {
            store.commit({
              removed: before,
              added: before.map((a) => translateAnnotation(a, dx, dy)),
              label: g.gestureId,
            });
          }
          g.last = p;
        }
        return;
      } else if (g.kind === 'marquee' || g.kind === 'snip') {
        g.cur = toPage(e);
      }
      schedulePaint();
    },
    [abort, pageNumber, schedulePaint, settings.eraserMode, settings.eraserSize, settings.pressureSensitivity, toPage, zoom],
  );

  /* ---------------------------------------------------------- pointer up */

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      gesture.current = null;
      snapLock.current = null;
      gestureBus.abortDrawing = null;
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* nothing captured */
      }
      if (!g) return;
      const store = useViewer.getState();

      if (g.kind === 'stroke') {
        if (g.ann.points.length >= 3) {
          if (settings.shapeRecognition && g.ann.type === 'pen') {
            const shape = recognizeShape(g.ann.points);
            if (shape) {
              store.addAnnotations([
                {
                  ...makeShape(g.ann.docId, pageNumber, shape.kind, g.ann.color, g.ann.size, g.ann.opacity, shape.x1, shape.y1),
                  x2: shape.x2,
                  y2: shape.y2,
                },
              ]);
              clearLive();
              return;
            }
          }
          store.addAnnotations([g.ann]);
        }
      } else if (g.kind === 'shape') {
        const len = Math.hypot(g.ann.x2 - g.ann.x1, g.ann.y2 - g.ann.y1);
        if (len > 2) store.addAnnotations([g.ann]);
      } else if (g.kind === 'region') {
        if (g.ann.w > 8 && g.ann.h > 8) store.addAnnotations([g.ann]);
      } else if (g.kind === 'marquee') {
        const r = rectFromPoints(g.start, g.cur);
        if (r.w > 3 && r.h > 3) {
          const hits = annotationsInRect(store.annotationsFor(pageNumber), r);
          store.setSelection(hits.map((a) => a.id));
        }
      } else if (g.kind === 'snip') {
        const r = rectFromPoints(g.start, g.cur);
        if (r.w > 12 && r.h > 12) void useSnip.getState().capture(pageNumber, r);
      }
      clearLive();
    },
    [clearLive, pageNumber, settings.shapeRecognition],
  );

  const onDoubleClick = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const store = useViewer.getState();
      if (store.tool !== 'select') return;
      rectRef.current = e.currentTarget.getBoundingClientRect();
      const hit = pickAnnotation(store.annotationsFor(pageNumber), toPage(e), 6 / zoom);
      if (hit?.type === 'text') {
        store.setSelection([hit.id]);
        store.setEditingText(hit.id);
      } else if (hit?.type === 'region') {
        const order: RegionAnnotation['status'][] = ['unsolved', 'solved', 'incorrect', 'review'];
        store.setRegionStatus(hit.id, order[(order.indexOf(hit.status) + 1) % order.length]);
      }
    },
    [pageNumber, toPage, zoom],
  );

  const cursor = useMemo(() => {
    if (tool === 'pan') return 'grab';
    if (tool === 'select') return 'default';
    if (tool === 'eraser') return eraserCursor(settings.eraserSize * zoom);
    if (tool === 'text') return 'text';
    if (tool === 'snip') return 'crosshair';
    return 'crosshair';
  }, [tool, settings.eraserSize, zoom]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    cursor,
    captures: DRAW_TOOLS.has(tool) || tool === 'select',
  };
}

/* --------------------------------------------------------------- helpers */

function pressureOf(e: { pressure?: number; pointerType?: string }, enabled: boolean): number {
  if (!enabled) return 0.5;
  // Mouse reports a constant 0.5; only trust real pen pressure.
  if (e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0) return e.pressure;
  return 0.5;
}

function square(a: Point, b: Point): Point {
  const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  return { x: a.x + Math.sign(b.x - a.x) * s, y: a.y + Math.sign(b.y - a.y) * s };
}

/** Erases along the segment between two samples so fast strokes leave no gaps. */
function eraseStep(
  page: number,
  p: Point,
  radius: number,
  mode: 'stroke' | 'partial',
  gestureId: string,
  last?: Point | null,
): void {
  const store = useViewer.getState();
  const samples: Point[] = [p];
  if (last) {
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    const steps = Math.min(24, Math.floor(dist / Math.max(radius, 1)));
    for (let i = 1; i < steps; i++) {
      samples.unshift({
        x: last.x + ((p.x - last.x) * i) / steps,
        y: last.y + ((p.y - last.y) * i) / steps,
      });
    }
  }
  let removed: Annotation[] = [];
  let added: Annotation[] = [];
  let list = store.annotationsFor(page);
  for (const s of samples) {
    const res = eraseAt(list, s, radius, mode);
    if (!res.removed.length) continue;
    const removedIds = new Set(res.removed.map((a) => a.id));
    list = [...list.filter((a) => !removedIds.has(a.id)), ...res.added];
    // pieces created earlier in this same step may be erased again
    added = added.filter((a) => !removedIds.has(a.id));
    removed = [...removed, ...res.removed.filter((a) => !added.some((x) => x.id === a.id))];
    added = [...added, ...res.added];
  }
  if (removed.length || added.length) {
    store.commit({ removed, added, label: gestureId });
  }
}

/** Circular eraser cursor sized to the current eraser diameter. */
function eraserCursor(diameter: number): string {
  const d = Math.max(8, Math.min(96, diameter));
  const s = d + 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${d / 2}" fill="rgba(255,255,255,.35)" stroke="rgb(60,60,70)" stroke-width="1.25"/></svg>`;
  return `url("data:image/svg+xml;base64,${btoa(svg)}") ${s / 2} ${s / 2}, crosshair`;
}
