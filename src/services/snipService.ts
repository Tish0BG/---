import type { Annotation, Asset, DocumentMeta, ImageAnnotation, Rect } from '@/types';
import { repo } from './storageService';
import { cacheImage, drawPage } from './renderService';
import { SCROLL_GROW_BY, makeBoardConfig } from './boardService';
import { useViewer } from '@/state/viewerStore';
import { useLibrary } from '@/state/libraryStore';
import { useSettings } from '@/state/settingsStore';
import { annotationBounds, uid } from '@/lib/util';
import { tr, L } from '@/i18n';

/** Longest edge of a clip, in pixels. Enough for print, small enough to store. */
const MAX_EDGE = 2200;
/** Margin kept around content when a clip is dropped onto a board. */
const PAD = 28;

export interface Snip {
  blob: Blob;
  /** natural size of the clip in page points */
  width: number;
  height: number;
  page: number;
  docId: string;
  docName: string;
}

/**
 * Cuts a rectangle out of the page currently open in the viewer and returns it
 * as a PNG. The page is re-rendered at high resolution first, so the clip is
 * sharp regardless of the zoom level on screen.
 */
export async function captureRegion(page: number, rect: Rect, withInk: boolean): Promise<Snip | null> {
  const store = useViewer.getState();
  const { session, meta } = store;
  if (!session || !meta || rect.w < 4 || rect.h < 4) return null;

  const scale = Math.min(3, MAX_EDGE / Math.max(rect.w, rect.h));
  const source = document.createElement('canvas');
  await session.render(`snip-${page}`, page, source, scale);
  if (withInk) {
    const ctx = source.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawPage(ctx, store.annotationsFor(page), scale, { pressure: true });
    }
  }

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(rect.w * scale));
  out.height = Math.max(1, Math.round(rect.h * scale));
  const octx = out.getContext('2d');
  if (!octx) return null;
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(source, -rect.x * scale, -rect.y * scale);
  source.width = 0;
  source.height = 0;

  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'));
  out.width = 0;
  out.height = 0;
  if (!blob) return null;

  return { blob, width: rect.w, height: rect.h, page, docId: meta.id, docName: meta.name };
}

/**
 * Drops a clip onto a board, under whatever is already there. Works whether or
 * not that board happens to be the one open in the viewer.
 */
export async function appendToBoard(boardId: string, snip: Snip): Promise<void> {
  const doc = await repo.getDocument(boardId);
  if (!doc || doc.kind !== 'board' || !doc.board) return;

  const open = useViewer.getState().docId === boardId;
  const board = { ...doc.board, pages: doc.board.pages.map((p) => ({ ...p })) };
  let page = board.pages.length;

  const existing = open
    ? (useViewer.getState().pages.get(page) ?? [])
    : (await repo.listAnnotations(boardId)).filter((a) => a.page === page);

  const sheet = board.pages[page - 1];
  const maxW = sheet.w - PAD * 2;
  const scale = Math.min(1, maxW / snip.width);
  const w = snip.width * scale;
  const h = snip.height * scale;

  let y = bottomOf(existing) + PAD;
  if (y + h > sheet.h - PAD) {
    if (board.flow === 'scroll') {
      // one endless sheet: make room instead of starting a new page
      sheet.h = y + h + Math.max(PAD, SCROLL_GROW_BY / 3);
    } else {
      board.pages.push({ w: sheet.w, h: sheet.h, template: sheet.template });
      page = board.pages.length;
      y = PAD;
    }
  }

  const bitmap = await createImageBitmap(snip.blob);
  const asset: Asset = {
    id: uid('as_'),
    docId: boardId,
    blob: snip.blob,
    width: bitmap.width,
    height: bitmap.height,
  };
  await repo.putAsset(asset);

  const now = Date.now();
  const annotation: ImageAnnotation = {
    id: uid('an_'),
    docId: boardId,
    page,
    type: 'image',
    x: (board.pages[page - 1].w - w) / 2,
    y,
    w,
    h,
    assetId: asset.id,
    color: '#000000',
    opacity: 1,
    createdAt: now,
    updatedAt: now,
  };

  const patch: Partial<DocumentMeta> = { board, pageCount: board.pages.length };

  if (open) {
    cacheImage(asset.id, bitmap);
    const store = useViewer.getState();
    const updated = await repo.patchDocument(boardId, patch);
    if (updated) {
      useLibrary.getState().syncDocument(updated);
      const session = store.session;
      if (session && 'config' in session) (session as { config: typeof board }).config = board;
      useViewer.setState({ meta: updated, pageCount: board.pages.length, sizesVersion: store.sizesVersion + 1 });
    }
    store.addAnnotations([annotation]);
    store.goToPage(page);
  } else {
    await repo.saveAnnotations([annotation], []);
    const count = await repo.countAnnotations(boardId);
    const updated = await repo.patchDocument(boardId, { ...patch, annotationCount: count });
    if (updated) useLibrary.getState().syncDocument(updated);
  }
}

/** Creates a fresh board and puts the clip on its first page. */
export async function boardFromSnip(snip: Snip): Promise<string> {
  const settings = useSettings.getState();
  const config = makeBoardConfig(settings.boardFlow, settings.boardTemplate, 'a4', false);
  const id = await useLibrary.getState().createBoard(tr(L(`${snip.docName} — решения`, `${snip.docName} — worked out`)), config, null);
  await appendToBoard(id, snip);
  return id;
}

/** Lowest ink on a page, so a new clip lands under what is already written. */
const bottomOf = (list: Annotation[]): number => {
  let bottom = 0;
  for (const a of list) {
    const b = annotationBounds(a);
    if (b.y + b.h > bottom) bottom = b.y + b.h;
  }
  return bottom;
};
