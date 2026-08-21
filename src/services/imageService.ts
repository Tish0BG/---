import type { Asset, ImageAnnotation } from '@/types';
import { repo } from './storageService';
import { cacheImage } from './renderService';
import { uid } from '@/lib/util';
import { useViewer } from '@/state/viewerStore';

/**
 * Stores an image next to the document and drops it onto the current page.
 * The bitmap lives in the `assets` store; the annotation only references it.
 */
export async function insertImage(file: Blob): Promise<void> {
  const store = useViewer.getState();
  const { docId, currentPage } = store;
  if (!docId) return;

  const bitmap = await createImageBitmap(file);
  const asset: Asset = {
    id: uid('as_'),
    docId,
    blob: file,
    width: bitmap.width,
    height: bitmap.height,
  };
  await repo.putAsset(asset);
  cacheImage(asset.id, bitmap);

  const page = store.pageSize(currentPage);
  const maxW = page.width * 0.55;
  const scale = Math.min(1, maxW / bitmap.width);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  const now = Date.now();

  const annotation: ImageAnnotation = {
    id: uid('an_'),
    docId,
    page: currentPage,
    type: 'image',
    x: (page.width - w) / 2,
    y: Math.max(20, (page.height - h) / 2),
    w,
    h,
    assetId: asset.id,
    color: '#000000',
    opacity: 1,
    createdAt: now,
    updatedAt: now,
  };
  store.addAnnotations([annotation]);
  store.setTool('select');
  store.setSelection([annotation.id]);
}

/** Picks an image from disk and inserts it. */
export function pickImage(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void insertImage(file);
  };
  input.click();
}
