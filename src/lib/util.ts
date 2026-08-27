import type { Annotation, Point, Rect } from '@/types';

/** Short, sortable-ish unique id (time prefix + random suffix). */
export function uid(prefix = ''): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${t}${r}`;
}

/**
 * `2026-08-27` — the key a day is filed under, in **local** time.
 *
 * There were five copies of this in the tree and two of them used
 * `toISOString().slice(0, 10)`, which is UTC. In Sofia that puts anything
 * before three in the morning on the day before — so a reminder could be filed
 * under yesterday while the planner filed the same moment under today, and the
 * two would never agree about whether it had already fired. One function, one
 * timezone, one answer.
 */
export function dayKey(d: Date | number = new Date()): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const round2 = (v: number) => Math.round(v * 100) / 100;

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | null = null;
  const wrapped = (...args: A) => {
    lastArgs = args;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = undefined;
      const a = lastArgs!;
      lastArgs = null;
      fn(...a);
    }, ms);
  };
  wrapped.flush = () => {
    if (t) {
      clearTimeout(t);
      t = undefined;
      if (lastArgs) {
        const a = lastArgs;
        lastArgs = null;
        fn(...a);
      }
    }
  };
  wrapped.cancel = () => {
    if (t) clearTimeout(t);
    t = undefined;
    lastArgs = null;
  };
  return wrapped;
}

/* ------------------------------------------------------------------ colour */

/** '#rrggbb' (or '#rgb') -> [r, g, b] in 0..1, for pdf-lib. */
export function hexToRgb01(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb01(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}

/* ------------------------------------------------------------------- rects */

export const rectFromPoints = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});

export const pointInRect = (p: Point, r: Rect, pad = 0) =>
  p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

export const inflate = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  w: r.w + by * 2,
  h: r.h + by * 2,
});

/** Axis-aligned bounds of an annotation in page space (used for culling + hit tests). */
export function annotationBounds(a: Annotation): Rect {
  switch (a.type) {
    case 'pen':
    case 'highlighter': {
      const p = a.points;
      if (p.length < 3) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < p.length; i += 3) {
        if (p[i] < minX) minX = p[i];
        if (p[i] > maxX) maxX = p[i];
        if (p[i + 1] < minY) minY = p[i + 1];
        if (p[i + 1] > maxY) maxY = p[i + 1];
      }
      const pad = a.size;
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    case 'line':
    case 'arrow':
    case 'rect':
    case 'ellipse': {
      const pad = a.size + (a.type === 'arrow' ? a.size * 3 : 0);
      return inflate(rectFromPoints({ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }), pad);
    }
    default:
      return { x: a.x, y: a.y, w: a.w, h: a.h };
  }
}

/* -------------------------------------------------------------- geometry */

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `днес, ${d.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Hands a blob to the browser as a download. Kept out of the export
 *  service so a save button does not drag pdf-lib into the first load. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
