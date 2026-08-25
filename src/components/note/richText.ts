import type { Asset } from '@/types';
import { repo } from '@/services/storageService';
import { uid } from '@/lib/util';

/**
 * ─────────────────────────────────────────── the text document's engine ──
 *
 * Rich text, done with `document.execCommand`.
 *
 * It is a deprecated API, and it is still the right one here. Every browser
 * that matters implements it, it understands selections that span elements,
 * and it maintains a native undo stack that survives the caret being moved by
 * the mouse. The alternative — a document model with its own selection
 * mapping and its own undo — is a very large amount of code to arrive at the
 * same paragraph in bold, and the bundle is shared with a PDF renderer that
 * has already spent the budget.
 *
 * What is *not* left to the browser: font sizes (execCommand only speaks 1–7),
 * checklists, tables and links to other documents. Those are written by hand
 * below, as ordinary HTML with data attributes, so the saved body stays
 * something a person could read in a text editor.
 */

/** Colours must be written as CSS, not as `<font color>`. */
export function enableCss(): void {
  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    /* older engines ignore it and use tags; both round-trip fine */
  }
}

export function exec(command: string, value?: string): void {
  enableCss();
  try {
    document.execCommand(command, false, value);
  } catch {
    /* nothing worth reporting: the caret was somewhere the command cannot act */
  }
}

/** Whether the caret currently sits inside this formatting. */
export function isOn(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

/** The block tag around the caret — `h1`, `p`, `blockquote`, `pre`, … */
export function blockTag(): string {
  try {
    return (document.queryCommandValue('formatBlock') || 'p').toLowerCase();
  } catch {
    return 'p';
  }
}

/**
 * Font size in pixels.
 *
 * `execCommand('fontSize')` only understands the seven HTML sizes, so the
 * trick is to apply size 7 — which nothing else uses — and then rewrite the
 * `<font size="7">` elements it produced into spans with the real size.
 */
export function setFontSize(root: HTMLElement, px: number): void {
  exec('fontSize', '7');
  for (const node of Array.from(root.querySelectorAll('font[size="7"]'))) {
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    span.innerHTML = node.innerHTML;
    node.replaceWith(span);
  }
}

export function setFontFamily(family: string): void {
  exec('fontName', family);
}

/**
 * Line spacing, applied to the blocks the selection touches.
 *
 * There is no `execCommand` for it, and there is no sensible way to fake one
 * with inline spans: leading belongs to a paragraph, not to a run of letters.
 * So this walks up to the block each end of the selection sits in and sets the
 * property there — which is also what makes it survive the round trip, since
 * the value ends up in the saved HTML as an ordinary inline style.
 */
export function setLineHeight(root: HTMLElement, value: number): void {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);

  const blockOf = (node: Node | null): HTMLElement | null => {
    let el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
    while (el && el !== root && getComputedStyle(el).display === 'inline') el = el.parentElement;
    return el && el !== root ? el : null;
  };

  const blocks = new Set<HTMLElement>();
  const start = blockOf(range.startContainer);
  const end = blockOf(range.endContainer);
  if (start) blocks.add(start);
  if (end) blocks.add(end);
  // Everything in between, for a selection that spans several paragraphs.
  for (const el of Array.from(root.children)) {
    if (el instanceof HTMLElement && range.intersectsNode(el)) blocks.add(el);
  }
  for (const el of blocks) el.style.lineHeight = String(value);
}

/**
 * The document, printed.
 *
 * The browser's own print dialog is the export: it produces a PDF on every
 * platform, it honours the page size the person chose, and it needs no PDF
 * writer in the bundle. The sheet is copied into a hidden frame rather than
 * printed from the page, because printing the page would print the toolbar,
 * the sidebar and the timer along with it.
 */
export function printNote(title: string, root: HTMLElement, css: string): void {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>${css}</style></head><body><main class="note-sheet">${root.innerHTML}</main></body></html>`,
  );
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Long enough for the dialog to have taken its copy of the document.
    setTimeout(() => frame.remove(), 1000);
  };
  if (doc.readyState === 'complete') go();
  else frame.onload = go;
}

/** The typography of the sheet, standing on its own for the print frame. */
export const PRINT_CSS = `
  @page { margin: 18mm 16mm; }
  body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #111; }
  .note-sheet { font-size: 11.5pt; line-height: 1.6; }
  .note-sheet > * + * { margin-top: 0.8em; }
  .note-sheet p { margin: 0; }
  .note-sheet h1 { font-size: 20pt; margin-top: 0; }
  .note-sheet h2 { font-size: 15pt; margin-top: 1.4em; }
  .note-sheet h3 { font-size: 12.5pt; margin-top: 1.2em; }
  .note-sheet h1, .note-sheet h2, .note-sheet h3 { font-weight: 650; line-height: 1.25; }
  .note-sheet ul, .note-sheet ol { padding-left: 1.3em; }
  .note-sheet blockquote { margin: 0; padding-left: 1em; border-left: 2px solid #bbb; font-style: italic; color: #444; }
  .note-sheet pre { background: #f4f4f6; padding: 8pt 10pt; border-radius: 4pt; font-size: 9.5pt; white-space: pre-wrap; }
  .note-sheet img { max-width: 100%; }
  .note-sheet hr { border: 0; border-top: 1px solid #ddd; margin: 1.4em 0; }
  .note-sheet table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  .note-sheet th, .note-sheet td { border: 1px solid #ccc; padding: 5pt 7pt; text-align: left; }
  .note-sheet th { background: #f4f4f6; }
  .note-sheet .note-callout { border-left: 3px solid #888; padding: 8pt 10pt; background: #f7f7f9; border-radius: 4pt; }
  .note-sheet .note-todo { list-style: none; padding-left: 0; }
  .note-sheet .note-todo > li::before { content: '☐  '; }
  .note-sheet .note-todo > li[data-done='true']::before { content: '☑  '; }
  .note-sheet .note-doclink { text-decoration: none; color: #1857d6; }
  /* A page break inside a heading or a table row is a printing mistake. */
  .note-sheet h1, .note-sheet h2, .note-sheet h3 { break-after: avoid; }
  .note-sheet tr, .note-sheet img, .note-sheet blockquote { break-inside: avoid; }
`;

/* ------------------------------------------------------------ insertions */

/** Puts HTML where the caret is, keeping the selection inside the editor. */
export function insertHtml(html: string): void {
  exec('insertHTML', html);
}

export function insertTable(rows: number, cols: number): void {
  const cell = '<td><br></td>';
  const head = `<tr>${`<th><br></th>`.repeat(cols)}</tr>`;
  const body = `<tr>${cell.repeat(cols)}</tr>`.repeat(Math.max(1, rows - 1));
  insertHtml(`<table class="note-table"><tbody>${head}${body}</tbody></table><p><br></p>`);
}

export function insertChecklist(): void {
  insertHtml('<ul class="note-todo"><li data-done="false">&nbsp;</li></ul>');
}

export function insertCallout(tone: 'info' | 'warn' | 'good'): void {
  insertHtml(`<div class="note-callout" data-tone="${tone}"><p>&nbsp;</p></div><p><br></p>`);
}

export function insertDivider(): void {
  insertHtml('<hr class="note-rule"><p><br></p>');
}

/**
 * A link to another document in the library.
 *
 * Written as an anchor with no `href`: it is not a web address, and giving it
 * one would mean a middle-click opening a page that does not exist. The click
 * handler on the editor reads the `data-doc` attribute instead.
 */
export function insertDocLink(docId: string, name: string, icon: 'book' | 'board' | 'notebook'): void {
  const safe = escapeHtml(name);
  insertHtml(
    `<a class="note-doclink" data-doc="${docId}" data-icon="${icon}" contenteditable="false">${safe}</a>&nbsp;`,
  );
}

/* ---------------------------------------------------------------- images */

/**
 * Stores the bitmap beside the document and drops a reference in.
 *
 * The bytes never enter the note's body: the body carries `data-asset` and the
 * editor resolves it to an object URL when it opens. A megabyte of base64 in a
 * record that syncs on every keystroke would be a very expensive photograph.
 */
export async function insertImageAsset(docId: string, file: Blob): Promise<void> {
  const bitmap = await createImageBitmap(file);
  const asset: Asset = {
    id: uid('as_'),
    docId,
    blob: file,
    width: bitmap.width,
    height: bitmap.height,
  };
  await repo.putAsset(asset);
  const url = URL.createObjectURL(file);
  insertHtml(
    `<img class="note-image" data-asset="${asset.id}" src="${url}" alt="" width="${Math.min(bitmap.width, 720)}"><p><br></p>`,
  );
}

/** Swaps stored asset ids for live object URLs after a note is opened. */
export async function hydrateImages(root: HTMLElement): Promise<() => void> {
  const urls: string[] = [];
  for (const img of Array.from(root.querySelectorAll<HTMLImageElement>('img[data-asset]'))) {
    const id = img.dataset.asset;
    if (!id || img.getAttribute('src')) continue;
    const asset = await repo.getAsset(id);
    if (!asset) continue;
    const url = URL.createObjectURL(asset.blob);
    urls.push(url);
    img.src = url;
  }
  return () => urls.forEach((u) => URL.revokeObjectURL(u));
}

/**
 * The body as it should be stored: object URLs stripped back to their ids.
 *
 * An object URL is meaningless in the next session and would have the note
 * open with broken images while the real bytes sat in the store untouched.
 */
export function serialise(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement;
  for (const img of Array.from(copy.querySelectorAll<HTMLImageElement>('img[data-asset]'))) {
    img.removeAttribute('src');
  }
  return copy.innerHTML;
}

/* ---------------------------------------------------------------- outline */

export interface OutlineEntry {
  id: string;
  level: number;
  text: string;
}

/**
 * The headings, numbered so two sections with the same name stay distinct.
 *
 * The ids are written onto the live nodes rather than into the saved body:
 * an outline is a view of the document, not part of it, and a heading renamed
 * should not leave a stale anchor behind.
 */
export function readOutline(root: HTMLElement): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  const headings = root.querySelectorAll<HTMLElement>('h1, h2, h3');
  headings.forEach((node, i) => {
    const id = `note-h-${i}`;
    node.dataset.outline = id;
    out.push({ id, level: Number(node.tagName.slice(1)), text: node.textContent?.trim() || '—' });
  });
  return out;
}

/* ---------------------------------------------------------------- helpers */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

/** Ids of every document this body links to, for keeping `links` honest. */
export function linkedDocIds(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/data-doc="([a-z0-9_-]+)"/gi)) found.add(match[1]);
  return [...found];
}
