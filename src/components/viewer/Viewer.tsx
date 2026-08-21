import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useViewer } from '@/state/viewerStore';
import { useSettings } from '@/state/settingsStore';
import { clamp } from '@/lib/util';
import { PageView } from './PageView';
import { gestureBus } from './gestureBus';
import { Icon } from '../Icon';

const GAP = 18;
const PAD_Y = 22;
const PAD_X = 16;
/** how many pages beyond the viewport keep their pixels */
const OVERSCAN = 1;
/** how many further pages keep an empty white shell, so fast scrolling
 *  shows page outlines instead of a grey void */
const SHELL_OVERSCAN = 6;

interface Layout {
  offsets: number[]; // top offset per page index (0-based)
  sizes: { width: number; height: number }[]; // css size at current zoom
  total: number;
  maxWidth: number;
}

/**
 * Continuous vertical page scroller with page virtualisation: the container is
 * sized for the whole document, but only the pages near the viewport hold
 * canvases. That is what makes 500-page textbooks usable.
 */
export function Viewer() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  const session = useViewer((s) => s.session);
  const pageCount = useViewer((s) => s.pageCount);
  const zoom = useViewer((s) => s.zoom);
  const fitMode = useViewer((s) => s.fitMode);
  const sizesVersion = useViewer((s) => s.sizesVersion);
  const scrollRequest = useViewer((s) => s.scrollRequest);
  const currentPage = useViewer((s) => s.currentPage);
  const tool = useViewer((s) => s.tool);
  const boardFlow = useViewer((s) => (s.meta?.kind === 'board' ? (s.meta.board?.flow ?? 'paged') : null));
  const pdfDarkMode = useSettings((s) => s.pdfDarkMode);
  const theme = useSettings((s) => s.theme);

  const restoring = useRef(false);
  const anchor = useRef({ page: 1, ratio: 0 });

  /* --------------------------------------------------------- measurement */

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setViewport({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* -------------------------------------------------------------- layout */

  const layout = useMemo<Layout>(() => {
    const offsets: number[] = [];
    const sizes: { width: number; height: number }[] = [];
    let y = PAD_Y;
    let maxWidth = 0;
    for (let n = 1; n <= pageCount; n++) {
      const base = session?.knownSize(n) ?? session?.defaultSize ?? { width: 612, height: 792 };
      const w = Math.round(base.width * zoom);
      const h = Math.round(base.height * zoom);
      offsets.push(y);
      sizes.push({ width: w, height: h });
      maxWidth = Math.max(maxWidth, w);
      y += h + GAP;
    }
    return { offsets, sizes, total: Math.max(y - GAP + PAD_Y, 0), maxWidth };
    // sizesVersion invalidates this when real page dimensions arrive
  }, [pageCount, zoom, session, sizesVersion]);

  /* ----------------------------------------------------------- fit modes */

  useLayoutEffect(() => {
    if (!session || !viewport.w || fitMode === 'none') return;
    const base = session.knownSize(currentPage) ?? session.defaultSize;
    const availW = viewport.w - PAD_X * 2 - 12;
    const availH = viewport.h - PAD_Y * 2;
    let next = availW / base.width;
    if (fitMode === 'page') next = Math.min(next, availH / base.height);
    next = clamp(next, 0.2, 6);
    if (Math.abs(next - zoom) > 0.002) useViewer.getState().setZoom(next, fitMode);
  }, [session, viewport.w, viewport.h, fitMode, currentPage, zoom]);

  /* -------------------------------------------------------- scroll state */

  const pageAt = useCallback(
    (top: number) => {
      const probe = top + viewport.h * 0.32;
      let lo = 0;
      let hi = layout.offsets.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (layout.offsets[mid] <= probe) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    },
    [layout.offsets, viewport.h],
  );

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    if (restoring.current) return;
    const page = pageAt(el.scrollTop);
    const idx = page - 1;
    anchor.current = {
      page,
      ratio: (el.scrollTop - layout.offsets[idx]) / Math.max(1, layout.sizes[idx]?.height ?? 1),
    };
    useViewer.getState().setCurrentPage(page);
  }, [layout, pageAt]);

  /* keep the anchored page in place across zoom changes */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !layout.offsets.length) return;
    const idx = clamp(anchor.current.page, 1, layout.offsets.length) - 1;
    const target = layout.offsets[idx] + anchor.current.ratio * (layout.sizes[idx]?.height ?? 0);
    if (Math.abs(el.scrollTop - target) < 1) return;
    restoring.current = true;
    el.scrollTop = target;
    requestAnimationFrame(() => {
      restoring.current = false;
    });
  }, [zoom, layout]);

  /* explicit navigation (thumbnails, page box, search) */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrollRequest || !layout.offsets.length) return;
    const idx = clamp(scrollRequest.page, 1, layout.offsets.length) - 1;
    const target = layout.offsets[idx] + (scrollRequest.ratio ?? 0) * (layout.sizes[idx]?.height ?? 0) - PAD_Y;
    restoring.current = true;
    anchor.current = { page: scrollRequest.page, ratio: scrollRequest.ratio ?? 0 };
    el.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
    setScrollTop(el.scrollTop);
    requestAnimationFrame(() => {
      restoring.current = false;
    });
  }, [scrollRequest, layout]);

  /* ------------------------------------------------------- visible range */

  const [first, last] = useMemo(() => {
    if (!pageCount) return [1, 0];
    const top = scrollTop;
    const bottom = scrollTop + viewport.h;
    let f = 1;
    let l = pageCount;
    for (let i = 0; i < layout.offsets.length; i++) {
      if (layout.offsets[i] + layout.sizes[i].height >= top) {
        f = i + 1;
        break;
      }
    }
    for (let i = f - 1; i < layout.offsets.length; i++) {
      if (layout.offsets[i] > bottom) {
        l = i;
        break;
      }
    }
    return [Math.max(1, f - OVERSCAN), Math.min(pageCount, l + OVERSCAN)];
  }, [scrollTop, viewport.h, layout, pageCount]);

  /* learn real page sizes for what is about to be shown */
  useEffect(() => {
    if (!pageCount) return;
    void useViewer.getState().ensureSizes(first, last + 6);
  }, [first, last, pageCount]);

  /* ---------------------------------------------------- wheel + touch nav */

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const store = useViewer.getState();
      store.setZoom(store.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 'none');
    };

    // Manual touch pan/pinch: drawing tools set touch-action:none on the page,
    // so the browser's own scrolling is not available there.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let zoomStart = 1;
    let panLast: { x: number; y: number } | null = null;
    let velocity = 0;
    let inertia = 0;

    const stopInertia = () => {
      if (inertia) cancelAnimationFrame(inertia);
      inertia = 0;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      stopInertia();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const store = useViewer.getState();
      const single = pointers.size === 1;
      const wantsPan =
        store.tool === 'pan' || useSettings.getState().stylusOnly || pointers.size >= 2;
      if (single && wantsPan) {
        panLast = { x: e.clientX, y: e.clientY };
        gestureBus.panning = true;
        gestureBus.abortDrawing?.();
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        zoomStart = store.zoom;
        gestureBus.panning = true;
        gestureBus.abortDrawing?.();
        panLast = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!gestureBus.panning) return;
      e.preventDefault();

      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pinchStart > 0) {
          const store = useViewer.getState();
          const next = clamp((zoomStart * dist) / pinchStart, 0.2, 6);
          if (Math.abs(next - store.zoom) > 0.005) store.setZoom(next, 'none');
        }
        if (panLast) {
          el.scrollTop -= mid.y - panLast.y;
          el.scrollLeft -= mid.x - panLast.x;
        }
        panLast = mid;
        return;
      }

      if (panLast) {
        const dy = e.clientY - panLast.y;
        el.scrollTop -= dy;
        el.scrollLeft -= e.clientX - panLast.x;
        velocity = dy;
        panLast = { x: e.clientX, y: e.clientY };
      }
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        const wasPanning = gestureBus.panning;
        gestureBus.panning = false;
        panLast = null;
        pinchStart = 0;
        if (wasPanning && Math.abs(velocity) > 2) {
          let v = velocity;
          const step = () => {
            v *= 0.94;
            el.scrollTop -= v;
            if (Math.abs(v) > 0.4) inertia = requestAnimationFrame(step);
            else inertia = 0;
          };
          inertia = requestAnimationFrame(step);
        }
        velocity = 0;
      } else if (pointers.size === 1) {
        const [p] = [...pointers.values()];
        panLast = { x: p.x, y: p.y };
        pinchStart = 0;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      stopInertia();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  /* mouse panning with the hand tool */
  const panDrag = useRef<{ x: number; y: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const onMouseDown = (e: React.MouseEvent) => {
    if (tool !== 'pan' && e.button !== 1) return;
    panDrag.current = { x: e.clientX, y: e.clientY };
    setGrabbing(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!panDrag.current || !el) return;
    el.scrollTop -= e.clientY - panDrag.current.y;
    el.scrollLeft -= e.clientX - panDrag.current.x;
    panDrag.current = { x: e.clientX, y: e.clientY };
  };
  const endPan = () => {
    if (!panDrag.current) return;
    panDrag.current = null;
    setGrabbing(false);
  };

  const darkClass =
    theme !== 'light' && pdfDarkMode === 'dim' ? 'pdf-dim' : pdfDarkMode === 'invert' ? 'pdf-invert' : '';

  const contentWidth = Math.max(layout.maxWidth + PAD_X * 2, viewport.w);
  /** boards get a strip under the last sheet for "add another page" */
  const footer = boardFlow ? 64 : 0;
  const shellFirst = Math.max(1, first - SHELL_OVERSCAN);
  const shellLast = Math.min(pageCount, last + SHELL_OVERSCAN);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endPan}
      onMouseLeave={endPan}
      className={`pdf-scroll scroll-thin relative h-full w-full overflow-auto ${darkClass}`}
      style={{ cursor: grabbing ? 'grabbing' : tool === 'pan' ? 'grab' : undefined }}
    >
      <div className="relative mx-auto" style={{ height: layout.total + footer, width: contentWidth }}>
        {Array.from({ length: Math.max(0, shellLast - shellFirst + 1) }, (_, i) => {
          const n = shellFirst + i;
          const idx = n - 1;
          const size = layout.sizes[idx];
          if (!size) return null;
          const base = session?.knownSize(n) ?? session?.defaultSize ?? { width: 612, height: 792 };
          return (
            <div
              key={n}
              className="absolute"
              style={{ top: layout.offsets[idx], left: (contentWidth - size.width) / 2 }}
            >
              <PageView
                pageNumber={n}
                width={size.width}
                height={size.height}
                zoom={zoom}
                pageSize={base}
                live={n >= first && n <= last}
              />
            </div>
          );
        })}

        {boardFlow && (
          <div
            className="absolute flex justify-center"
            style={{ top: layout.total - PAD_Y + 6, left: 0, width: contentWidth }}
          >
            <button
              className="btn h-9 rounded-full px-4"
              style={{
                background: 'var(--c-surface)',
                border: '1px dashed var(--c-line-strong)',
                boxShadow: 'var(--shadow-panel)',
              }}
              onClick={() =>
                boardFlow === 'scroll'
                  ? void useViewer.getState().extendBoardPage(1)
                  : void useViewer.getState().addBoardPage(pageCount)
              }
            >
              <Icon name={boardFlow === 'scroll' ? 'arrowDown' : 'pageAdd'} size={15} />
              {boardFlow === 'scroll' ? 'Удължи листа' : 'Нова страница'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
