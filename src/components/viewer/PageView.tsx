import { memo, useEffect, useMemo, useRef } from 'react';
import type { Annotation } from '@/types';
import { useViewer } from '@/state/viewerStore';
import { useSettings } from '@/state/settingsStore';
import { drawPage } from '@/services/renderService';
import { annotationBounds } from '@/lib/util';
import { useDrawing } from './useDrawing';
import { TextEditor } from './TextEditor';

interface Props {
  pageNumber: number;
  /** css size of the page at the current zoom */
  width: number;
  height: number;
  zoom: number;
  /** page-space size at scale 1 */
  pageSize: { width: number; height: number };
  /** false while the page is far outside the viewport: keep the box, drop the pixels */
  live: boolean;
}

const DPR_CAP = 2;

/**
 * One page of the document: the PDF bitmap, the committed annotation layer,
 * a scratch layer for the in-flight gesture, and the DOM overlays
 * (text editing, selection, search hits).
 */
export const PageView = memo(function PageView({ pageNumber, width, height, zoom, pageSize, live }: Props) {
  const pdfRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const renderedScale = useRef(0);
  const renderedVersion = useRef(-1);

  const session = useViewer((s) => s.session);
  /** bumped when a board is re-papered or its pages are restructured */
  const sizesVersion = useViewer((s) => s.sizesVersion);
  const annotations = useViewer((s) => s.pages.get(pageNumber));
  const selectedIds = useViewer((s) => s.selectedIds);
  const editingTextId = useViewer((s) => s.editingTextId);
  const hits = useViewer((s) => s.search.hits);
  const activeHit = useViewer((s) => s.search.activeIndex);
  const pressure = useSettings((s) => s.pressureSensitivity);

  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  const renderScale = zoom * dpr;
  const drawing = useDrawing(pageNumber, zoom, renderScale, liveRef, pageSize);

  /* ------------------------------------------------------------ pdf layer */

  useEffect(() => {
    const canvas = pdfRef.current;
    if (!session || !canvas) return;
    const key = `p${pageNumber}`;
    if (!live) {
      session.cancel(key);
      canvas.width = 0;
      canvas.height = 0;
      renderedScale.current = 0;
      return;
    }
    if (renderedScale.current === renderScale && renderedVersion.current === sizesVersion) return;
    renderedVersion.current = sizesVersion;
    let cancelled = false;
    (async () => {
      try {
        if (canvas.width > 1) {
          // Re-render off-screen and blit, so zooming never flashes an empty page.
          const tmp = document.createElement('canvas');
          const vp = await session.render(key, pageNumber, tmp, renderScale);
          if (cancelled || !vp) return;
          canvas.width = tmp.width;
          canvas.height = tmp.height;
          canvas.getContext('2d')?.drawImage(tmp, 0, 0);
          tmp.width = 0;
          tmp.height = 0;
        } else {
          const vp = await session.render(key, pageNumber, canvas, renderScale);
          if (cancelled || !vp) return;
        }
        renderedScale.current = renderScale;
      } catch (err) {
        console.error(`Страница ${pageNumber} не се рендерира`, err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, pageNumber, renderScale, live, sizesVersion]);

  useEffect(() => {
    const key = `p${pageNumber}`;
    return () => session?.cancel(key);
  }, [session, pageNumber]);

  /* ------------------------------------------------------------ ink layer */

  const visibleAnnotations = useMemo(
    () => (editingTextId ? (annotations ?? []).filter((a) => a.id !== editingTextId) : (annotations ?? [])),
    [annotations, editingTextId],
  );

  useEffect(() => {
    const canvas = inkRef.current;
    if (!canvas) return;
    const w = Math.max(1, Math.round(pageSize.width * renderScale));
    const h = Math.max(1, Math.round(pageSize.height * renderScale));
    if (!live || !visibleAnnotations.length) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawPage(ctx, visibleAnnotations, renderScale, { pressure });
  }, [visibleAnnotations, renderScale, live, pageSize.width, pageSize.height, pressure]);

  /* -------------------------------------------------------------- overlays */

  const selectionBox = useMemo(() => {
    if (!selectedIds.length || !annotations) return null;
    const picked = annotations.filter((a) => selectedIds.includes(a.id));
    if (!picked.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const a of picked) {
      const b = annotationBounds(a);
      x1 = Math.min(x1, b.x);
      y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w);
      y2 = Math.max(y2, b.y + b.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, items: picked };
  }, [selectedIds, annotations]);

  const editing = useMemo(
    () => (annotations ?? []).find((a) => a.id === editingTextId && a.type === 'text'),
    [annotations, editingTextId],
  );

  const pageHits = useMemo(
    () => hits.map((h, i) => ({ ...h, i })).filter((h) => h.page === pageNumber),
    [hits, pageNumber],
  );

  return (
    <div
      data-page={pageNumber}
      className="page-shell relative shrink-0 rounded-[2px]"
      style={{ width, height, cursor: drawing.cursor, touchAction: drawing.captures ? 'none' : 'auto' }}
      onPointerDown={drawing.onPointerDown}
      onPointerMove={drawing.onPointerMove}
      onPointerUp={drawing.onPointerUp}
      onPointerCancel={drawing.onPointerUp}
      onDoubleClick={drawing.onDoubleClick}
    >
      <canvas ref={pdfRef} className="pdf-canvas" />
      <canvas ref={inkRef} className="ink-canvas" />
      <canvas ref={liveRef} className="live-canvas" />

      {pageHits.map((h) => (
        <div
          key={`${h.i}`}
          className={`search-mark ${h.i === activeHit ? 'search-mark-active' : ''}`}
          style={{ left: h.rect.x * zoom, top: h.rect.y * zoom, width: h.rect.w * zoom, height: h.rect.h * zoom }}
        />
      ))}

      {selectionBox && !editing && (
        <div
          className="pointer-events-none absolute rounded-[3px]"
          style={{
            left: selectionBox.x * zoom - 3,
            top: selectionBox.y * zoom - 3,
            width: selectionBox.w * zoom + 6,
            height: selectionBox.h * zoom + 6,
            outline: '1.5px dashed var(--c-accent)',
            background: 'color-mix(in srgb, var(--c-accent) 6%, transparent)',
          }}
        />
      )}

      {editing?.type === 'text' && <TextEditor annotation={editing} zoom={zoom} />}

      {!live && (
        <div className="absolute inset-0 grid place-items-center text-[11px] text-faint select-none">
          {pageNumber}
        </div>
      )}
    </div>
  );
});

export type { Annotation };
