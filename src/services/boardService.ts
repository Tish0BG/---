import type { Annotation, BoardConfig, BoardFlow, BoardPage, PaperTemplate, TextAnnotation } from '@/types';
import type { PageSource, PageViewportLike, SearchMatch } from './pageSource';
import type { PageSize } from './pdfService';
import { LINE_HEIGHT, cssFont, layoutText } from './renderService';
import { L, type Msg } from '@/i18n';

/** PDF points per millimetre. Paper templates are designed in mm, like real paper. */
const MM = 72 / 25.4;

export const PAPER_SIZES = {
  a4: { w: 595.28, h: 841.89, label: 'A4' },
  a5: { w: 419.53, h: 595.28, label: 'A5' },
  letter: { w: 612, h: 792, label: 'Letter' },
} as const;

export type PaperSizeId = keyof typeof PAPER_SIZES;

export const TEMPLATE_LABELS: Record<PaperTemplate, Msg> = {
  blank: L('Празна', 'Blank'),
  lined: L('Редове', 'Ruled'),
  'lined-wide': L('Широки редове', 'Wide ruled'),
  grid: L('Квадратчета 5 мм', '5 mm squares'),
  'grid-large': L('Квадратчета 10 мм', '10 mm squares'),
  dots: L('Точки', 'Dots'),
  graph: L('Милиметрова', 'Graph paper'),
  music: L('Нотна', 'Manuscript'),
  cornell: L('Cornell (записки)', 'Cornell (notes)'),
};

/** How tall one screen of a scrolling board is before it starts growing. */
export const SCROLL_INITIAL_H = 2400;
export const SCROLL_GROW_BY = 900;
/** ink closer than this to the bottom extends the sheet */
export const SCROLL_GROW_MARGIN = 420;

/* ------------------------------------------------------------------ paper */

interface PaperLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  c: string;
  /** drawn only in the detailed pass (high zoom / export) */
  fine?: boolean;
}

interface PaperDot {
  x: number;
  y: number;
  r: number;
  c: string;
}

export interface PaperGeometry {
  lines: PaperLine[];
  dots: PaperDot[];
}

const C_RULE = '#b7c6da';
const C_FAINT = '#dde5ef';
const C_MARGIN = '#e6a9a9';
const C_STAFF = '#94a1b2';

/**
 * The paper as pure geometry in page space, so the on-screen canvas and the
 * PDF exporter draw byte-for-byte the same sheet from one description.
 */
export function paperGeometry(t: PaperTemplate, w: number, h: number): PaperGeometry {
  const lines: PaperLine[] = [];
  const dots: PaperDot[] = [];
  const hRules = (gap: number, padX: number, from: number, color = C_RULE, width = 0.5) => {
    for (let y = from; y <= h - gap * 0.4; y += gap) {
      lines.push({ x1: padX, y1: y, x2: w - padX, y2: y, w: width, c: color });
    }
  };
  const mesh = (gap: number, color: string, width: number, fine = false) => {
    for (let x = gap; x < w; x += gap) lines.push({ x1: x, y1: 0, x2: x, y2: h, w: width, c: color, fine });
    for (let y = gap; y < h; y += gap) lines.push({ x1: 0, y1: y, x2: w, y2: y, w: width, c: color, fine });
  };

  switch (t) {
    case 'blank':
      break;

    case 'lined':
      hRules(8 * MM, 12 * MM, 14 * MM);
      lines.push({ x1: 20 * MM, y1: 0, x2: 20 * MM, y2: h, w: 0.6, c: C_MARGIN });
      break;

    case 'lined-wide':
      hRules(11 * MM, 12 * MM, 16 * MM);
      lines.push({ x1: 20 * MM, y1: 0, x2: 20 * MM, y2: h, w: 0.6, c: C_MARGIN });
      break;

    case 'grid':
      mesh(5 * MM, C_FAINT, 0.4);
      break;

    case 'grid-large':
      mesh(10 * MM, C_FAINT, 0.45);
      break;

    case 'dots':
      for (let x = 5 * MM; x < w - MM; x += 5 * MM) {
        for (let y = 5 * MM; y < h - MM; y += 5 * MM) dots.push({ x, y, r: 0.75, c: '#9fb0c4' });
      }
      break;

    case 'graph':
      mesh(1 * MM, '#e8eef5', 0.25, true);
      mesh(5 * MM, '#c9d8e8', 0.4);
      mesh(10 * MM, '#a9bfd6', 0.6);
      break;

    case 'music': {
      const gap = 2 * MM;
      const padX = 15 * MM;
      for (let top = 18 * MM; top + gap * 4 < h - 8 * MM; top += 20 * MM) {
        for (let i = 0; i < 5; i++) {
          const y = top + gap * i;
          lines.push({ x1: padX, y1: y, x2: w - padX, y2: y, w: 0.5, c: C_STAFF });
        }
      }
      break;
    }

    case 'cornell': {
      const title = 22 * MM;
      const summary = h - 45 * MM;
      const cue = w * 0.3;
      lines.push({ x1: 0, y1: title, x2: w, y2: title, w: 0.9, c: C_MARGIN });
      lines.push({ x1: 0, y1: summary, x2: w, y2: summary, w: 0.9, c: C_MARGIN });
      lines.push({ x1: cue, y1: title, x2: cue, y2: summary, w: 0.9, c: C_MARGIN });
      for (let y = title + 8 * MM; y < summary - 2 * MM; y += 8 * MM) {
        lines.push({ x1: cue + 3 * MM, y1: y, x2: w - 10 * MM, y2: y, w: 0.45, c: C_FAINT });
      }
      for (let y = summary + 8 * MM; y < h - 4 * MM; y += 8 * MM) {
        lines.push({ x1: 10 * MM, y1: y, x2: w - 10 * MM, y2: y, w: 0.45, c: C_FAINT });
      }
      break;
    }
  }
  return { lines, dots };
}

/**
 * Paints one sheet into a canvas context already scaled to page units.
 * `detail` is off when the page is small on screen — millimetre grids would
 * otherwise smear into a solid block and cost thousands of draw calls.
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  template: PaperTemplate,
  w: number,
  h: number,
  paper: string | null,
  detail: boolean,
): void {
  ctx.save();
  ctx.fillStyle = paper || '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const geo = paperGeometry(template, w, h);
  let color = '';
  let width = -1;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (const l of geo.lines) {
    if (l.fine && !detail) continue;
    if (l.c !== color || l.w !== width) {
      if (color) ctx.stroke();
      ctx.beginPath();
      color = l.c;
      width = l.w;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
    }
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
  }
  if (color) ctx.stroke();
  for (const d of geo.dots) {
    ctx.fillStyle = d.c;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------ board config */

export function makeBoardConfig(
  flow: BoardFlow,
  template: PaperTemplate,
  size: PaperSizeId = 'a4',
  landscape = false,
): BoardConfig {
  const base = PAPER_SIZES[size];
  const w = landscape ? base.h : base.w;
  const h = landscape ? base.w : base.h;
  return {
    flow,
    template,
    paper: null,
    pages: [flow === 'scroll' ? { w, h: SCROLL_INITIAL_H } : { w, h }],
  };
}

export const pageTemplate = (cfg: BoardConfig, page: number): PaperTemplate =>
  cfg.pages[page - 1]?.template ?? cfg.template;

/* ----------------------------------------------------------- board session */

/**
 * A whiteboard pretending to be a document. Pages are generated paper, so
 * there is nothing to load, nothing to cancel and every size is known up front.
 */
export class BoardSession implements PageSource {
  readonly kind = 'board' as const;
  config: BoardConfig;
  defaultSize: PageSize;
  /** supplies the page's annotations so text notes are searchable */
  private textOf: (page: number) => Annotation[];
  /**
   * Page sizes must be referentially stable: React selectors read them on
   * every render and a fresh object each time would loop forever.
   */
  private sizes = new Map<BoardPage, PageSize>();

  constructor(config: BoardConfig, textOf: (page: number) => Annotation[] = () => []) {
    this.config = config;
    this.textOf = textOf;
    const first = config.pages[0];
    this.defaultSize = { width: first?.w ?? PAPER_SIZES.a4.w, height: first?.h ?? PAPER_SIZES.a4.h };
  }

  get pageCount(): number {
    return this.config.pages.length;
  }

  page(n: number): BoardPage {
    return this.config.pages[n - 1] ?? this.config.pages[0];
  }

  knownSize(n: number): PageSize | undefined {
    const p = this.config.pages[n - 1];
    if (!p) return undefined;
    let size = this.sizes.get(p);
    if (!size || size.width !== p.w || size.height !== p.h) {
      size = { width: p.w, height: p.h };
      this.sizes.set(p, size);
      if (this.sizes.size > 512) this.trimSizes();
    }
    return size;
  }

  /** Drops cached sizes for sheets that are no longer part of the board. */
  private trimSizes(): void {
    const alive = new Set(this.config.pages);
    for (const key of this.sizes.keys()) if (!alive.has(key)) this.sizes.delete(key);
  }

  async getSize(n: number): Promise<PageSize> {
    return this.knownSize(n) ?? this.defaultSize;
  }

  async viewport(n: number, scale: number): Promise<PageViewportLike> {
    const s = this.knownSize(n) ?? this.defaultSize;
    return {
      width: s.width * scale,
      height: s.height * scale,
      convertToPdfPoint: (x: number, y: number) => [x, s.height - y],
    };
  }

  async render(
    _key: string,
    n: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<PageViewportLike | null> {
    const p = this.page(n);
    if (!p) return null;
    canvas.width = Math.max(1, Math.floor(p.w * scale));
    canvas.height = Math.max(1, Math.floor(p.h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawPaper(ctx, pageTemplate(this.config, n), p.w, p.h, this.config.paper, scale > 1.4);
    return this.viewport(n, scale);
  }

  /** Nothing is asynchronous here, so there is never anything to cancel. */
  cancel(): void {}

  async getText(n: number): Promise<string> {
    return this.textOf(n)
      .filter((a): a is TextAnnotation => a.type === 'text')
      .map((a) => a.text)
      .join('\n');
  }

  /**
   * Search inside text notes. The rectangle is computed with the same layout
   * routine the renderer uses, so the highlight lands exactly on the word.
   */
  async findOnPage(n: number, query: string): Promise<SearchMatch[]> {
    const q = query.toLowerCase();
    const out: SearchMatch[] = [];
    const ctx = measureCtx();
    for (const a of this.textOf(n)) {
      if (a.type !== 'text' || !a.text) continue;
      if (!a.text.toLowerCase().includes(q)) continue;
      ctx.font = cssFont(a);
      const lines = layoutText(a.text, a.w, (s) => ctx.measureText(s).width);
      const lh = a.fontSize * LINE_HEIGHT;
      lines.forEach((line, i) => {
        const lower = line.toLowerCase();
        let idx = lower.indexOf(q);
        while (idx !== -1) {
          const before = ctx.measureText(line.slice(0, idx)).width;
          const width = ctx.measureText(line.slice(idx, idx + query.length)).width;
          let x = a.x + before;
          if (a.align === 'center') x += (a.w - ctx.measureText(line).width) / 2;
          else if (a.align === 'right') x += a.w - ctx.measureText(line).width;
          out.push({ rect: { x, y: a.y + lh * i, w: width, h: lh }, snippet: line.trim() });
          idx = lower.indexOf(q, idx + q.length);
        }
      });
    }
    return out;
  }

  async destroy(): Promise<void> {}
}

let measure: CanvasRenderingContext2D | null = null;
function measureCtx(): CanvasRenderingContext2D {
  if (!measure) measure = document.createElement('canvas').getContext('2d')!;
  return measure;
}
