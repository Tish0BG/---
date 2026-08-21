import * as pdfjs from 'pdfjs-dist';
import type { PageSource, SearchMatch } from './pageSource';
import type {
  PageViewport,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// All pdf.js runtime assets are served from /public — nothing leaves the device.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const BASE = import.meta.env.BASE_URL || '/';
const PDFJS_OPTIONS = {
  cMapUrl: `${BASE}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${BASE}standard_fonts/`,
  wasmUrl: `${BASE}wasm/`,
  iccUrl: `${BASE}iccs/`,
};

export interface PageSize {
  width: number;
  height: number;
}

export type { PDFDocumentProxy, PDFPageProxy, PageViewport };

/**
 * Opens a PDF from raw bytes.
 *
 * NOTE: pdf.js detaches the buffer it is given, so we always hand it a copy —
 * the original bytes stay usable for export. The loading task is returned
 * alongside the document because tearing a document down goes through the
 * task, which is what owns the worker.
 */
export async function loadDocument(
  data: ArrayBuffer,
): Promise<{ doc: PDFDocumentProxy; task: PDFDocumentLoadingTask }> {
  const task = pdfjs.getDocument({ data: data.slice(0), ...PDFJS_OPTIONS });
  return { doc: await task.promise, task };
}

/** Reads just the page count (used when importing a file into the library). */
export async function probeDocument(data: ArrayBuffer): Promise<{ pageCount: number; size: PageSize }> {
  const { doc, task } = await loadDocument(data);
  try {
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    return { pageCount: doc.numPages, size: { width: vp.width, height: vp.height } };
  } finally {
    await task.destroy();
  }
}

/**
 * Per-document cache of page proxies, page sizes and in-flight render tasks.
 * One instance lives for as long as a document is open in the viewer.
 */
export class PdfSession implements PageSource {
  readonly kind = 'pdf' as const;
  readonly doc: PDFDocumentProxy;
  readonly pageCount: number;
  /** owns the worker; destroying it is how a document is closed */
  private readonly task: PDFDocumentLoadingTask;
  private pages = new Map<number, Promise<PDFPageProxy>>();
  private sizes = new Map<number, PageSize>();
  private tasks = new Map<string, RenderTask>();
  private textCache = new Map<number, string>();
  private destroyed = false;

  /** Size used for pages whose real dimensions are not known yet. */
  defaultSize: PageSize = { width: 612, height: 792 };

  constructor(doc: PDFDocumentProxy, task: PDFDocumentLoadingTask) {
    this.doc = doc;
    this.task = task;
    this.pageCount = doc.numPages;
  }

  static async open(data: ArrayBuffer): Promise<PdfSession> {
    const { doc, task } = await loadDocument(data);
    const s = new PdfSession(doc, task);
    s.defaultSize = await s.getSize(1);
    return s;
  }

  getPage(n: number): Promise<PDFPageProxy> {
    let p = this.pages.get(n);
    if (!p) {
      p = this.doc.getPage(n);
      this.pages.set(n, p);
    }
    return p;
  }

  /** Cached page size in PDF points at scale 1 (rotation applied). */
  async getSize(n: number): Promise<PageSize> {
    const cached = this.sizes.get(n);
    if (cached) return cached;
    const page = await this.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const size = { width: vp.width, height: vp.height };
    this.sizes.set(n, size);
    return size;
  }

  knownSize(n: number): PageSize | undefined {
    return this.sizes.get(n);
  }

  async viewport(n: number, scale: number): Promise<PageViewport> {
    const page = await this.getPage(n);
    return page.getViewport({ scale });
  }

  /**
   * Renders a page into a canvas. Any previous render for the same key is
   * cancelled first, which is what keeps fast scrolling/zooming smooth.
   */
  async render(
    key: string,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<PageViewport | null> {
    this.cancel(key);
    const page = await this.getPage(pageNumber);
    if (this.destroyed) return null;
    const viewport = page.getViewport({ scale });
    this.sizes.set(pageNumber, {
      width: viewport.width / scale,
      height: viewport.height / scale,
    });

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const task = page.render({ canvas, viewport });
    this.tasks.set(key, task);
    try {
      await task.promise;
      return viewport;
    } catch (err) {
      if ((err as { name?: string })?.name === 'RenderingCancelledException') return null;
      throw err;
    } finally {
      if (this.tasks.get(key) === task) this.tasks.delete(key);
    }
  }

  cancel(key: string): void {
    const t = this.tasks.get(key);
    if (t) {
      t.cancel();
      this.tasks.delete(key);
    }
  }

  /** Plain text of a page, cached. Empty string for scanned/image-only pages. */
  async getText(n: number): Promise<string> {
    const hit = this.textCache.get(n);
    if (hit !== undefined) return hit;
    const page = await this.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : ''))
      .join('');
    this.textCache.set(n, text);
    return text;
  }

  /** Bounding boxes (page space, scale 1) of a query's matches on one page. */
  async findOnPage(n: number, query: string): Promise<SearchMatch[]> {
    const page = await this.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const q = query.toLowerCase();
    const out: SearchMatch[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const lower = item.str.toLowerCase();
      let idx = lower.indexOf(q);
      if (idx === -1) continue;
      // pdf.js gives a text-space matrix; compose with the viewport transform.
      const m = pdfjs.Util.transform(vp.transform, item.transform) as number[];
      const height = Math.hypot(m[2], m[3]) || item.height;
      const x = m[4];
      const y = m[5] - height;
      const perChar = item.width / Math.max(1, item.str.length);
      while (idx !== -1) {
        out.push({
          rect: { x: x + perChar * idx, y, w: perChar * query.length, h: height },
          snippet: item.str.trim(),
        });
        idx = lower.indexOf(q, idx + q.length);
        if (out.length > 50) break;
      }
    }
    return out;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    for (const t of this.tasks.values()) t.cancel();
    this.tasks.clear();
    this.pages.clear();
    try {
      await this.task.destroy();
    } catch {
      /* already gone */
    }
  }
}
