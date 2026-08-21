import type {
  Annotation,
  Point,
  Rect,
  ShapeAnnotation,
  StrokeAnnotation,
} from '@/types';
import { annotationBounds, clamp, distToSegment, pointInRect, round2, uid } from '@/lib/util';

/* ------------------------------------------------------------- hit testing */

/** True when `p` (page space) touches the annotation within `tolerance`. */
export function hitTest(a: Annotation, p: Point, tolerance: number): boolean {
  const bounds = annotationBounds(a);
  if (!pointInRect(p, bounds, tolerance)) return false;

  switch (a.type) {
    case 'pen':
    case 'highlighter': {
      const r = tolerance + a.size / 2;
      const pts = a.points;
      if (pts.length === 3) return Math.hypot(pts[0] - p.x, pts[1] - p.y) <= r;
      for (let i = 0; i + 5 < pts.length; i += 3) {
        const d = distToSegment(p, { x: pts[i], y: pts[i + 1] }, { x: pts[i + 3], y: pts[i + 4] });
        if (d <= r) return true;
      }
      return false;
    }
    case 'line':
    case 'arrow':
      return distToSegment(p, { x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }) <= tolerance + a.size / 2;
    case 'rect': {
      const x = Math.min(a.x1, a.x2);
      const y = Math.min(a.y1, a.y2);
      const w = Math.abs(a.x2 - a.x1);
      const h = Math.abs(a.y2 - a.y1);
      if (a.fill) return pointInRect(p, { x, y, w, h }, tolerance);
      const t = tolerance + a.size / 2;
      const inOuter = pointInRect(p, { x, y, w, h }, t);
      const inInner = pointInRect(p, { x: x + t, y: y + t, w: w - 2 * t, h: h - 2 * t }, 0);
      return inOuter && !inInner;
    }
    case 'ellipse': {
      const cx = (a.x1 + a.x2) / 2;
      const cy = (a.y1 + a.y2) / 2;
      const rx = Math.max(Math.abs(a.x2 - a.x1) / 2, 0.5);
      const ry = Math.max(Math.abs(a.y2 - a.y1) / 2, 0.5);
      const t = tolerance + a.size / 2;
      const d = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2;
      if (a.fill) return d <= 1.15;
      const outer = ((p.x - cx) / (rx + t)) ** 2 + ((p.y - cy) / (ry + t)) ** 2;
      const inner = ((p.x - cx) / Math.max(rx - t, 0.1)) ** 2 + ((p.y - cy) / Math.max(ry - t, 0.1)) ** 2;
      return outer <= 1 && inner >= 1;
    }
    default:
      return pointInRect(p, { x: a.x, y: a.y, w: a.w, h: a.h }, tolerance);
  }
}

/** Topmost annotation under the cursor (last drawn wins). */
export function pickAnnotation(list: Annotation[], p: Point, tolerance: number): Annotation | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (hitTest(list[i], p, tolerance)) return list[i];
  }
  return null;
}

/* ------------------------------------------------------------------ eraser */

export interface EraseResult {
  /** annotations to remove entirely */
  removed: Annotation[];
  /** replacement pieces produced by a partial erase */
  added: StrokeAnnotation[];
}

/**
 * Partial ("pixel") eraser: cuts the eraser disc out of freehand strokes and
 * keeps the surviving pieces as new strokes. Non-freehand annotations are
 * removed whole, since splitting a shape is rarely what a student wants.
 */
export function eraseAt(
  list: Annotation[],
  p: Point,
  radius: number,
  mode: 'stroke' | 'partial',
): EraseResult {
  const removed: Annotation[] = [];
  const added: StrokeAnnotation[] = [];

  for (const a of list) {
    if (!pointInRect(p, annotationBounds(a), radius)) continue;

    if (mode === 'stroke' || (a.type !== 'pen' && a.type !== 'highlighter')) {
      if (hitTest(a, p, radius)) removed.push(a);
      continue;
    }

    const cut = radius + a.size / 2;
    const segments = cutStroke(a.points, p, cut);
    if (!segments) continue; // eraser never touched this stroke

    removed.push(a);
    for (const seg of segments) {
      added.push({ ...a, id: uid('an_'), points: seg, updatedAt: Date.now() });
    }
  }
  return { removed, added };
}

/**
 * Cuts a circular hole out of a polyline, splitting it at the exact points
 * where it crosses the eraser. Returns null when the circle misses the stroke
 * entirely. Working on segments (not on samples) means a straight stroke drawn
 * with only a couple of points still erases into a clean gap.
 */
function cutStroke(points: number[], c: Point, r: number): number[][] | null {
  const n = points.length / 3;
  if (n === 0) return null;
  const inside = (i: number) => Math.hypot(points[i] - c.x, points[i + 1] - c.y) <= r;

  if (n === 1) return inside(0) ? [] : null;

  const out: number[][] = [];
  let cur: number[] = [];
  let touched = false;

  const at = (i: number) => [points[i], points[i + 1], points[i + 2]];
  const lerp = (i: number, j: number, t: number) => [
    points[i] + (points[j] - points[i]) * t,
    points[i + 1] + (points[j + 1] - points[i + 1]) * t,
    points[i + 2] + (points[j + 2] - points[i + 2]) * t,
  ];
  const push = (p: number[]) => cur.push(p[0], p[1], p[2]);
  const flush = () => {
    if (cur.length >= 6) out.push(cur);
    cur = [];
  };

  for (let k = 0; k < n; k++) {
    const i = k * 3;
    const pin = inside(i);
    if (!pin) push(at(i));
    else {
      touched = true;
      flush();
    }

    if (k === n - 1) break;
    const j = i + 3;
    const qin = inside(j);
    const hits = segmentCircle(points[i], points[i + 1], points[j], points[j + 1], c, r);
    if (!hits.length) continue;
    touched = true;

    if (!pin && qin) {
      push(lerp(i, j, hits[0]));
      flush();
    } else if (pin && !qin) {
      cur = [];
      push(lerp(i, j, hits[hits.length - 1]));
    } else if (!pin && !qin && hits.length === 2) {
      push(lerp(i, j, hits[0]));
      flush();
      push(lerp(i, j, hits[1]));
    }
  }
  flush();
  return touched ? out : null;
}

/** Parameters t in (0,1) where segment P→Q crosses the circle. */
function segmentCircle(px: number, py: number, qx: number, qy: number, c: Point, r: number): number[] {
  const dx = qx - px;
  const dy = qy - py;
  const fx = px - c.x;
  const fy = py - c.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return [];
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  return [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].filter((t) => t > 0 && t < 1);
}

/* ------------------------------------------------------- shape recognition */

export interface RecognizedShape {
  kind: 'line' | 'rect' | 'ellipse' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Cheap heuristic recogniser for hand-drawn shapes.
 * Only fires on confident matches — a wrong "correction" is worse than none.
 */
export function recognizeShape(points: number[]): RecognizedShape | null {
  const n = points.length / 3;
  if (n < 8) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < points.length; i += 3) {
    xs.push(points[i]);
    ys.push(points[i + 1]);
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const diag = Math.hypot(w, h);
  if (diag < 18) return null;

  let pathLen = 0;
  for (let i = 1; i < xs.length; i++) pathLen += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  if (pathLen < 20) return null;

  const start = { x: xs[0], y: ys[0] };
  const end = { x: xs[xs.length - 1], y: ys[ys.length - 1] };
  const endGap = Math.hypot(end.x - start.x, end.y - start.y);
  const closed = endGap < diag * 0.28;

  // --- straight line: every sample sits close to the start→end segment
  if (!closed) {
    let maxDev = 0;
    for (let i = 0; i < xs.length; i++) {
      maxDev = Math.max(maxDev, distToSegment({ x: xs[i], y: ys[i] }, start, end));
    }
    const span = Math.hypot(end.x - start.x, end.y - start.y);
    if (span > 20 && maxDev < Math.max(4, span * 0.045) && pathLen < span * 1.25) {
      // snap to horizontal / vertical / 45° when close
      const snapped = snapAngle(start, end);
      return { kind: 'line', x1: start.x, y1: start.y, x2: snapped.x, y2: snapped.y };
    }
    return null;
  }

  // --- circle: sample radii around the centroid stay uniform
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const radii = xs.map((x, i) => Math.hypot(x - cx, ys[i] - cy));
  const rMean = radii.reduce((s, r) => s + r, 0) / radii.length;
  const rDev = Math.sqrt(radii.reduce((s, r) => s + (r - rMean) ** 2, 0) / radii.length);
  if (rMean > 8 && rDev / rMean < 0.22) {
    return { kind: 'ellipse', x1: minX, y1: minY, x2: maxX, y2: maxY };
  }

  // --- rectangle: points hug the bounding box edges and the area matches
  if (w > 15 && h > 15) {
    const tol = Math.max(w, h) * 0.14;
    let onEdge = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = Math.min(Math.abs(xs[i] - minX), Math.abs(xs[i] - maxX));
      const dy = Math.min(Math.abs(ys[i] - minY), Math.abs(ys[i] - maxY));
      if (dx < tol || dy < tol) onEdge++;
    }
    const perimeter = 2 * (w + h);
    if (onEdge / xs.length > 0.86 && Math.abs(pathLen - perimeter) < perimeter * 0.34) {
      return { kind: 'rect', x1: minX, y1: minY, x2: maxX, y2: maxY };
    }
  }
  return null;
}

/** Snaps a segment to 0/45/90° when it is already within 6° of one. */
export function snapAngle(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return b;
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  if (Math.abs(angle - snapped) < 0.105) {
    return { x: a.x + Math.cos(snapped) * len, y: a.y + Math.sin(snapped) * len };
  }
  return b;
}

/* --------------------------------------------------------------- building */

export function makeStroke(
  docId: string,
  page: number,
  type: 'pen' | 'highlighter',
  color: string,
  size: number,
  opacity: number,
): StrokeAnnotation {
  const now = Date.now();
  return { id: uid('an_'), docId, page, type, color, size, opacity, points: [], createdAt: now, updatedAt: now };
}

export function makeShape(
  docId: string,
  page: number,
  type: ShapeAnnotation['type'],
  color: string,
  size: number,
  opacity: number,
  x: number,
  y: number,
): ShapeAnnotation {
  const now = Date.now();
  return { id: uid('an_'), docId, page, type, color, size, opacity, x1: x, y1: y, x2: x, y2: y, fill: null, createdAt: now, updatedAt: now };
}

/** Appends a sample, dropping points that are too close together. */
export function pushPoint(points: number[], x: number, y: number, pressure: number, minDist = 0.6): boolean {
  const n = points.length;
  if (n >= 3) {
    const dx = x - points[n - 3];
    const dy = y - points[n - 2];
    if (dx * dx + dy * dy < minDist * minDist) return false;
  }
  points.push(round2(x), round2(y), clamp(pressure, 0.02, 1));
  return true;
}

/** Moves an annotation by a delta in page space (used by the select tool). */
export function translateAnnotation<T extends Annotation>(a: T, dx: number, dy: number): T {
  const next = { ...a, updatedAt: Date.now() } as Annotation;
  switch (next.type) {
    case 'pen':
    case 'highlighter': {
      const pts = next.points.slice();
      for (let i = 0; i < pts.length; i += 3) {
        pts[i] = round2(pts[i] + dx);
        pts[i + 1] = round2(pts[i + 1] + dy);
      }
      next.points = pts;
      break;
    }
    case 'line':
    case 'arrow':
    case 'rect':
    case 'ellipse':
      next.x1 += dx; next.y1 += dy; next.x2 += dx; next.y2 += dy;
      break;
    default:
      next.x += dx; next.y += dy;
  }
  return next as T;
}

/** Annotations fully inside a marquee selection. */
export function annotationsInRect(list: Annotation[], r: Rect): Annotation[] {
  return list.filter((a) => {
    const b = annotationBounds(a);
    return b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h;
  });
}
