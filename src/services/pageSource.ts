import type { PageSize } from './pdfService';

/**
 * The slice of a pdf.js viewport the app actually depends on: the pixel size
 * at a given scale, and the transform back to PDF user space used by the
 * exporter. A whiteboard implements the same three members, which is why the
 * viewer, the thumbnails and the exporter do not care what backs a page.
 */
export interface PageViewportLike {
  width: number;
  height: number;
  /** page space (y down, top-left origin) -> PDF user space (y up) */
  convertToPdfPoint(x: number, y: number): number[];
}

export interface SearchMatch {
  rect: { x: number; y: number; w: number; h: number };
  snippet: string;
}

/**
 * Everything the viewer needs from "the thing under the ink layer".
 * Implemented by PdfSession (pdf.js) and BoardSession (generated paper).
 */
export interface PageSource {
  readonly kind: 'pdf' | 'board';
  readonly pageCount: number;
  /** size used for pages whose real dimensions are not known yet */
  defaultSize: PageSize;

  getSize(page: number): Promise<PageSize>;
  knownSize(page: number): PageSize | undefined;
  viewport(page: number, scale: number): Promise<PageViewportLike>;

  /**
   * Paints the page into `canvas` at `scale`. Any earlier render queued under
   * the same `key` is cancelled first, which is what keeps scrolling smooth.
   */
  render(key: string, page: number, canvas: HTMLCanvasElement, scale: number): Promise<PageViewportLike | null>;
  cancel(key: string): void;

  getText(page: number): Promise<string>;
  findOnPage(page: number, query: string): Promise<SearchMatch[]>;

  destroy(): Promise<void>;
}
