import getStroke from 'perfect-freehand';
import type { Annotation, StrokeAnnotation, TextAnnotation } from '@/types';
import { withAlpha } from '@/lib/util';
import { tr, L, type Msg } from '@/i18n';

/** Colours used for problem-region badges. */
export const REGION_COLORS: Record<string, string> = {
  unsolved: '#94a3b8',
  solved: '#10b981',
  incorrect: '#ef4444',
  review: '#f59e0b',
};

export const FONT_STACKS: Record<string, string> = {
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
};

export function cssFont(a: Pick<TextAnnotation, 'fontSize' | 'fontFamily' | 'bold' | 'italic'>): string {
  const style = a.italic ? 'italic ' : '';
  const weight = a.bold ? '700 ' : '400 ';
  return `${style}${weight}${a.fontSize}px ${FONT_STACKS[a.fontFamily] ?? FONT_STACKS.sans}`;
}

export const LINE_HEIGHT = 1.25;

/**
 * Wraps text into lines that fit `width`, honouring explicit newlines.
 * `measure` is injected so the canvas renderer and the PDF exporter can share
 * the exact same layout logic with their own font metrics.
 */
export function layoutText(text: string, width: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/(\s+)/);
    let cur = '';
    for (const word of words) {
      const next = cur + word;
      if (cur && measure(next) > width) {
        lines.push(cur.trimEnd());
        cur = word.trimStart();
      } else {
        cur = next;
      }
    }
    lines.push(cur.trimEnd());
  }
  return lines;
}

/* -------------------------------------------------------------- freehand */

interface FreehandInput {
  points: number[];
  size: number;
  pressure: boolean;
  /** true while the stroke is still being drawn */
  live?: boolean;
}

/** perfect-freehand options tuned for handwriting on a worksheet. */
export function strokeOutline({ points, size, pressure, live }: FreehandInput): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < points.length; i += 3) pts.push([points[i], points[i + 1], points[i + 2]]);
  return getStroke(pts, {
    size,
    thinning: pressure ? 0.55 : 0.15,
    smoothing: 0.55,
    streamline: 0.42,
    simulatePressure: !pressure,
    easing: (t) => Math.sin((t * Math.PI) / 2),
    last: !live,
  }) as number[][];
}

export function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (!outline.length) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) path.lineTo(outline[i][0], outline[i][1]);
  path.closePath();
  return path;
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  a: Pick<StrokeAnnotation, 'points' | 'size' | 'color' | 'opacity' | 'type'>,
  pressure: boolean,
  live = false,
): void {
  if (a.points.length < 3) return;
  ctx.save();
  if (a.type === 'highlighter') {
    // A marker keeps a constant width and lets the text show through; drawing
    // it as one path (not per-segment) avoids darker blobs at the joins.
    ctx.globalAlpha = a.opacity;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = a.size;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.points[0], a.points[1]);
    for (let i = 3; i < a.points.length; i += 3) ctx.lineTo(a.points[i], a.points[i + 1]);
    if (a.points.length === 3) ctx.lineTo(a.points[0] + 0.01, a.points[1]);
    ctx.stroke();
  } else {
    ctx.globalAlpha = a.opacity;
    ctx.fillStyle = a.color;
    ctx.fill(outlineToPath(strokeOutline({ points: a.points, size: a.size, pressure, live })));
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- shapes */

export function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(size * 3.2, 6);
  const spread = Math.PI / 7;
  return [
    { x: x2, y: y2 },
    { x: x2 - len * Math.cos(angle - spread), y: y2 - len * Math.sin(angle - spread) },
    { x: x2 - len * Math.cos(angle + spread), y: y2 - len * Math.sin(angle + spread) },
  ];
}

/* ------------------------------------------------------------ dispatcher */

export interface DrawOptions {
  /** honour real stylus pressure when rendering pen strokes */
  pressure: boolean;
  /** id of the annotation currently selected (drawn with handles) */
  selectedId?: string | null;
  /** skip chrome that should not appear in exports */
  forExport?: boolean;
}

export function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation, opts: DrawOptions): void {
  switch (a.type) {
    case 'pen':
    case 'highlighter':
      drawStroke(ctx, a, opts.pressure);
      break;

    case 'line':
    case 'arrow': {
      ctx.save();
      ctx.globalAlpha = a.opacity;
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      ctx.lineTo(a.x2, a.y2);
      ctx.stroke();
      if (a.type === 'arrow') {
        const head = arrowHead(a.x1, a.y1, a.x2, a.y2, a.size);
        ctx.beginPath();
        ctx.moveTo(head[0].x, head[0].y);
        ctx.lineTo(head[1].x, head[1].y);
        ctx.lineTo(head[2].x, head[2].y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case 'rect': {
      ctx.save();
      ctx.globalAlpha = a.opacity;
      const x = Math.min(a.x1, a.x2);
      const y = Math.min(a.y1, a.y2);
      const w = Math.abs(a.x2 - a.x1);
      const h = Math.abs(a.y2 - a.y1);
      if (a.fill) {
        ctx.fillStyle = a.fill;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.size;
      ctx.lineJoin = 'round';
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
      break;
    }

    case 'ellipse': {
      ctx.save();
      ctx.globalAlpha = a.opacity;
      const cx = (a.x1 + a.x2) / 2;
      const cy = (a.y1 + a.y2) / 2;
      const rx = Math.abs(a.x2 - a.x1) / 2;
      const ry = Math.abs(a.y2 - a.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, Math.PI * 2);
      if (a.fill) {
        ctx.fillStyle = a.fill;
        ctx.fill();
      }
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.size;
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'text': {
      ctx.save();
      ctx.globalAlpha = a.opacity;
      ctx.fillStyle = a.color;
      ctx.font = cssFont(a);
      ctx.textBaseline = 'alphabetic';
      const lines = layoutText(a.text, a.w, (s) => ctx.measureText(s).width);
      const lh = a.fontSize * LINE_HEIGHT;
      lines.forEach((line, i) => {
        let x = a.x;
        if (a.align === 'center') x = a.x + (a.w - ctx.measureText(line).width) / 2;
        else if (a.align === 'right') x = a.x + a.w - ctx.measureText(line).width;
        ctx.fillText(line, x, a.y + lh * (i + 1) - a.fontSize * 0.28);
      });
      ctx.restore();
      break;
    }

    case 'image': {
      const bmp = imageCache.get(a.assetId);
      if (bmp) {
        ctx.save();
        ctx.globalAlpha = a.opacity;
        ctx.drawImage(bmp, a.x, a.y, a.w, a.h);
        ctx.restore();
      }
      break;
    }

    case 'region': {
      ctx.save();
      const color = REGION_COLORS[a.status] ?? REGION_COLORS.unsolved;
      ctx.globalAlpha = a.opacity;
      ctx.fillStyle = withAlpha(color, 0.08);
      ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(a.status === 'unsolved' ? [6, 4] : []);
      ctx.strokeRect(a.x, a.y, a.w, a.h);
      ctx.setLineDash([]);
      // status chip in the top-left corner
      const label = a.label || tr(STATUS_LABEL[a.status]);
      ctx.font = '600 9px ' + FONT_STACKS.sans;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(a.x, a.y - 14, tw + 10, 13, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, a.x + 5, a.y - 4.5);
      ctx.restore();
      break;
    }
  }
}

export const STATUS_LABEL: Record<string, Msg> = {
  unsolved: L('Нерешена', 'Unsolved'),
  solved: L('Решена', 'Solved'),
  incorrect: L('Грешна', 'Wrong'),
  review: L('За преговор', 'To review'),
};

/**
 * Draws a whole page worth of annotations into a canvas context.
 * The context is scaled once so every annotation can be drawn in page units.
 */
export function drawPage(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  scale: number,
  opts: DrawOptions,
): void {
  ctx.save();
  ctx.scale(scale, scale);
  for (const a of annotations) drawAnnotation(ctx, a, opts);
  ctx.restore();
}

/* --------------------------------------------------- image asset caching */

const imageCache = new Map<string, ImageBitmap | HTMLImageElement>();

export function cacheImage(assetId: string, bmp: ImageBitmap | HTMLImageElement): void {
  imageCache.set(assetId, bmp);
}
export function clearImageCache(): void {
  imageCache.clear();
}
