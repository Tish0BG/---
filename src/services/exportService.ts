import { BlendMode, LineCapStyle, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Annotation, BoardConfig, TextAnnotation } from '@/types';
import type { PageSource } from './pageSource';
import { pageTemplate, paperGeometry } from './boardService';
import { LINE_HEIGHT, arrowHead, cssFont, drawAnnotation, layoutText, strokeOutline } from './renderService';
import { annotationBounds, hexToRgb01 } from '@/lib/util';

/** Characters the PDF standard fonts can encode (WinAnsi). */
const LATIN_ONLY = /^[ -~ -ÿ‘’“”–—•…€]*$/;

export interface ExportOptions {
  /** original PDF bytes; null for a whiteboard, whose sheets are generated */
  bytes: ArrayBuffer | null;
  /** required when `bytes` is null */
  board?: BoardConfig | null;
  session: PageSource;
  /** annotations grouped by page number */
  byPage: Map<number, Annotation[]>;
  /** 1-based page numbers to export, null = all pages */
  pages?: number[] | null;
  /** false produces a clean copy of the original / empty sheets */
  includeAnnotations?: boolean;
  /** resolves image assets referenced by image annotations */
  getAsset?: (id: string) => Promise<Blob | undefined>;
}

/**
 * Builds an annotated copy of the PDF.
 *
 * Annotations are written as real vector content (paths + text), so the result
 * stays sharp at any zoom and keeps the original page content untouched
 * underneath. Text that the standard PDF fonts cannot encode (Cyrillic, for
 * example) is rasterised at high resolution instead — the pragmatic fallback
 * that avoids bundling and subsetting a Unicode font.
 */
export async function exportPdf(opts: ExportOptions): Promise<Blob> {
  const { bytes, board, session, byPage, pages = null, includeAnnotations = true } = opts;
  const wanted = pages && pages.length ? [...pages].sort((a, b) => a - b) : null;

  let out: PDFDocument;
  let mapping: number[]; // output page index -> source page number

  if (!bytes) {
    // Whiteboard: there is no source file, the paper is drawn from its recipe.
    if (!board) throw new Error('Липсва описание на дъската.');
    out = await PDFDocument.create();
    mapping = wanted ?? board.pages.map((_, i) => i + 1);
    for (const n of mapping) {
      const sheet = board.pages[n - 1];
      if (!sheet) continue;
      const page = out.addPage([sheet.w, sheet.h]);
      drawPaperOnPage(page, board, n);
    }
  } else {
    const src = await PDFDocument.load(bytes.slice(0), { ignoreEncryption: true });
    if (wanted) {
      out = await PDFDocument.create();
      const copied = await out.copyPages(src, wanted.map((n) => n - 1));
      copied.forEach((p) => out.addPage(p));
      mapping = wanted;
    } else {
      out = src;
      mapping = Array.from({ length: src.getPageCount() }, (_, i) => i + 1);
    }
  }

  if (includeAnnotations) {
    const fonts = new FontCache(out);
    for (let i = 0; i < mapping.length; i++) {
      const pageNumber = mapping[i];
      const anns = byPage.get(pageNumber);
      if (!anns?.length) continue;
      await drawPageAnnotations(out.getPage(i), anns, session, pageNumber, fonts, opts.getAsset);
    }
  }

  const data = await out.save({ useObjectStreams: true });
  return new Blob([data as BufferSource], { type: 'application/pdf' });
}

/**
 * Paints a board sheet with the very same geometry the screen renderer uses,
 * so an exported notebook is indistinguishable from what the student saw.
 */
function drawPaperOnPage(page: PDFPage, board: BoardConfig, n: number): void {
  const sheet = board.pages[n - 1];
  const { width, height } = page.getSize();
  if (board.paper) {
    const [r, g, b] = hexToRgb01(board.paper);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(r, g, b) });
  }
  const geo = paperGeometry(pageTemplate(board, n), sheet.w, sheet.h);
  for (const l of geo.lines) {
    const [r, g, b] = hexToRgb01(l.c);
    page.drawLine({
      start: { x: l.x1, y: sheet.h - l.y1 },
      end: { x: l.x2, y: sheet.h - l.y2 },
      thickness: l.w,
      color: rgb(r, g, b),
    });
  }
  for (const d of geo.dots) {
    const [r, g, b] = hexToRgb01(d.c);
    page.drawCircle({ x: d.x, y: sheet.h - d.y, size: d.r, color: rgb(r, g, b) });
  }
}

/* --------------------------------------------------------------- internals */

class FontCache {
  private cache = new Map<string, PDFFont>();
  private doc: PDFDocument;
  constructor(doc: PDFDocument) {
    this.doc = doc;
  }
  async get(a: TextAnnotation): Promise<PDFFont> {
    const key = `${a.fontFamily}-${a.bold ? 'b' : ''}${a.italic ? 'i' : ''}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const font = await this.doc.embedFont(standardFontFor(a));
    this.cache.set(key, font);
    return font;
  }
}

function standardFontFor(a: TextAnnotation): StandardFonts {
  const { bold: b, italic: i } = a;
  if (a.fontFamily === 'serif') {
    if (b && i) return StandardFonts.TimesRomanBoldItalic;
    if (b) return StandardFonts.TimesRomanBold;
    if (i) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (a.fontFamily === 'mono') {
    if (b && i) return StandardFonts.CourierBoldOblique;
    if (b) return StandardFonts.CourierBold;
    if (i) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (b && i) return StandardFonts.HelveticaBoldOblique;
  if (b) return StandardFonts.HelveticaBold;
  if (i) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

async function drawPageAnnotations(
  page: PDFPage,
  anns: Annotation[],
  session: PageSource,
  pageNumber: number,
  fonts: FontCache,
  getAsset?: (id: string) => Promise<Blob | undefined>,
): Promise<void> {
  const vp = await session.viewport(pageNumber, 1);
  /**
   * Page space (y down, top-left origin) -> the SVG space pdf-lib expects,
   * which it flips with scale(1,-1) before emitting operators. Going through
   * the pdf.js viewport keeps page rotation and CropBox offsets correct.
   */
  const sp = (x: number, y: number): string => {
    const [px, py] = vp.convertToPdfPoint(x, y) as number[];
    return `${round(px)} ${round(-py)}`;
  };
  const col = (hex: string) => {
    const [r, g, b] = hexToRgb01(hex);
    return rgb(r, g, b);
  };

  for (const a of anns) {
    switch (a.type) {
      case 'pen': {
        const outline = strokeOutline({ points: a.points, size: a.size, pressure: true });
        if (outline.length < 3) break;
        const d = `M ${sp(outline[0][0], outline[0][1])} ` +
          outline.slice(1).map((p) => `L ${sp(p[0], p[1])}`).join(' ') + ' Z';
        page.drawSvgPath(d, { x: 0, y: 0, color: col(a.color), opacity: a.opacity, borderWidth: 0 });
        break;
      }

      case 'highlighter': {
        const pts = a.points;
        if (pts.length < 3) break;
        let d = `M ${sp(pts[0], pts[1])}`;
        for (let i = 3; i < pts.length; i += 3) d += ` L ${sp(pts[i], pts[i + 1])}`;
        if (pts.length === 3) d += ` L ${sp(pts[0] + 0.01, pts[1])}`;
        page.drawSvgPath(d, {
          x: 0,
          y: 0,
          borderColor: col(a.color),
          borderWidth: a.size,
          borderOpacity: a.opacity,
          borderLineCap: LineCapStyle.Butt,
          blendMode: BlendMode.Multiply,
        });
        break;
      }

      case 'line':
      case 'arrow': {
        page.drawSvgPath(`M ${sp(a.x1, a.y1)} L ${sp(a.x2, a.y2)}`, {
          x: 0,
          y: 0,
          borderColor: col(a.color),
          borderWidth: a.size,
          borderOpacity: a.opacity,
          borderLineCap: LineCapStyle.Round,
        });
        if (a.type === 'arrow') {
          const h = arrowHead(a.x1, a.y1, a.x2, a.y2, a.size);
          page.drawSvgPath(
            `M ${sp(h[0].x, h[0].y)} L ${sp(h[1].x, h[1].y)} L ${sp(h[2].x, h[2].y)} Z`,
            { x: 0, y: 0, color: col(a.color), opacity: a.opacity, borderWidth: 0 },
          );
        }
        break;
      }

      case 'rect': {
        const x1 = Math.min(a.x1, a.x2), x2 = Math.max(a.x1, a.x2);
        const y1 = Math.min(a.y1, a.y2), y2 = Math.max(a.y1, a.y2);
        const d = `M ${sp(x1, y1)} L ${sp(x2, y1)} L ${sp(x2, y2)} L ${sp(x1, y2)} Z`;
        page.drawSvgPath(d, {
          x: 0,
          y: 0,
          color: a.fill ? col(a.fill) : undefined,
          opacity: a.opacity,
          borderColor: col(a.color),
          borderWidth: a.size,
          borderOpacity: a.opacity,
        });
        break;
      }

      case 'ellipse': {
        page.drawSvgPath(ellipsePath(a.x1, a.y1, a.x2, a.y2, sp), {
          x: 0,
          y: 0,
          color: a.fill ? col(a.fill) : undefined,
          opacity: a.opacity,
          borderColor: col(a.color),
          borderWidth: a.size,
          borderOpacity: a.opacity,
        });
        break;
      }

      case 'text': {
        if (LATIN_ONLY.test(a.text)) {
          const font = await fonts.get(a);
          const lines = layoutText(a.text, a.w, (s) => font.widthOfTextAtSize(s, a.fontSize));
          const lh = a.fontSize * LINE_HEIGHT;
          lines.forEach((line, i) => {
            let x = a.x;
            const w = font.widthOfTextAtSize(line, a.fontSize);
            if (a.align === 'center') x = a.x + (a.w - w) / 2;
            else if (a.align === 'right') x = a.x + a.w - w;
            const baselineY = a.y + lh * (i + 1) - a.fontSize * 0.28;
            const [px, py] = vp.convertToPdfPoint(x, baselineY) as number[];
            page.drawText(line, {
              x: px,
              y: py,
              size: a.fontSize,
              font,
              color: col(a.color),
              opacity: a.opacity,
            });
          });
        } else {
          await drawRasterFallback(page, a, vp);
        }
        break;
      }

      case 'region': {
        const d = `M ${sp(a.x, a.y)} L ${sp(a.x + a.w, a.y)} L ${sp(a.x + a.w, a.y + a.h)} L ${sp(a.x, a.y + a.h)} Z`;
        page.drawSvgPath(d, {
          x: 0,
          y: 0,
          borderColor: col(regionColor(a.status)),
          borderWidth: 1.5,
          borderOpacity: 0.9,
          borderDashArray: a.status === 'unsolved' ? [6, 4] : undefined,
        });
        break;
      }

      case 'image': {
        const blob = await getAsset?.(a.assetId);
        if (!blob) break;
        const buf = await blob.arrayBuffer();
        const img = blob.type.includes('png')
          ? await page.doc.embedPng(buf)
          : await page.doc.embedJpg(buf);
        // place via the four corners so rotated pages stay correct
        const [px, py] = vp.convertToPdfPoint(a.x, a.y + a.h) as number[];
        page.drawImage(img, { x: px, y: py, width: a.w, height: a.h, opacity: a.opacity });
        break;
      }
    }
  }
}

const regionColor = (s: string) =>
  ({ unsolved: '#94a3b8', solved: '#10b981', incorrect: '#ef4444', review: '#f59e0b' })[s] ?? '#94a3b8';

const round = (n: number) => Math.round(n * 100) / 100;

/** Ellipse as four cubic Béziers (no SVG arc commands needed). */
function ellipsePath(x1: number, y1: number, x2: number, y2: number, sp: (x: number, y: number) => string): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;
  const k = 0.5522847498;
  const ox = rx * k;
  const oy = ry * k;
  return [
    `M ${sp(cx - rx, cy)}`,
    `C ${sp(cx - rx, cy - oy)} ${sp(cx - ox, cy - ry)} ${sp(cx, cy - ry)}`,
    `C ${sp(cx + ox, cy - ry)} ${sp(cx + rx, cy - oy)} ${sp(cx + rx, cy)}`,
    `C ${sp(cx + rx, cy + oy)} ${sp(cx + ox, cy + ry)} ${sp(cx, cy + ry)}`,
    `C ${sp(cx - ox, cy + ry)} ${sp(cx - rx, cy + oy)} ${sp(cx - rx, cy)}`,
    'Z',
  ].join(' ');
}

/**
 * Renders an annotation to a bitmap and stamps it onto the page.
 * Used for text the standard PDF fonts cannot encode (e.g. Cyrillic).
 */
async function drawRasterFallback(
  page: PDFPage,
  a: Annotation,
  vp: { convertToPdfPoint(x: number, y: number): unknown },
): Promise<void> {
  const b = annotationBounds(a);
  if (a.type === 'text') {
    // bounds of a text box must cover the wrapped lines
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = cssFont(a);
    const lines = layoutText(a.text, a.w, (s) => probe.measureText(s).width);
    b.x = a.x;
    b.y = a.y;
    b.w = a.w;
    b.h = Math.max(a.h, lines.length * a.fontSize * LINE_HEIGHT + a.fontSize * 0.4);
  }
  if (b.w <= 0 || b.h <= 0) return;

  const s = 4; // 4x supersampling keeps rasterised text crisp in print
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(b.w * s);
  canvas.height = Math.ceil(b.h * s);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(s, s);
  ctx.translate(-b.x, -b.y);
  drawAnnotation(ctx, a, { pressure: true, forExport: true });

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const png = await page.doc.embedPng(await blob.arrayBuffer());
  const [px, py] = vp.convertToPdfPoint(b.x, b.y + b.h) as number[];
  page.drawImage(png, { x: px, y: py, width: b.w, height: b.h });
}

/** Triggers a browser download for a generated blob. */
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
