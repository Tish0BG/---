import type { SyncKind, Tombstone } from '@/types';
import { repo, SYNCED_META_KEYS, type SyncRow } from '@/services/storageService';
import { FILES_BUCKET, RECORDS_TABLE, getClient, humanError, type Client } from './client';

/**
 * Two-way sync between this browser and one Supabase project.
 *
 * Every syncable record is already a flat JSON object with an `updatedAt`, so
 * merging two devices needs no server logic at all: the newer write wins, in
 * both directions. Deletions travel as rows with `deleted = true`, because a
 * row that simply disappears is indistinguishable from a row the other device
 * has not seen yet — and would be resurrected on the next push.
 *
 * The binaries (PDFs and images) are far too big for the table, so they live
 * in Storage and are announced by a small `blobs` record. Images follow the
 * records straight away; a PDF is only fetched when its document is opened,
 * which is what makes signing in on a phone take seconds instead of minutes.
 */

/** Local stores that travel to the cloud, in dependency order. */
const KINDS: SyncKind[] = [
  'meta',
  'subjects',
  'folders',
  'documents',
  'annotations',
  'bookmarks',
  'cards',
  'planner',
  'grades',
  'schedule',
  'sessions',
];

/** Announcements of Storage objects; not backed by a local store. */
const BLOB_KIND = 'blobs';

const PULL_PAGE = 500;
const PUSH_CHUNK = 200;
const STATE_KEY = 'sync.state';

/** Upload cap per blob — the free Supabase tier gives 1 GB in total. */
const MAX_BLOB_BYTES = 50 * 1024 * 1024;

interface SyncPointer {
  userId: string;
  /** highest `updated_at` seen from the cloud */
  lastPulledAt: number;
  /** local rows newer than this still have to go up */
  lastPushedAt: number;
  lastSyncAt: number;
}

const EMPTY_POINTER: SyncPointer = { userId: '', lastPulledAt: 0, lastPushedAt: 0, lastSyncAt: 0 };

export interface SyncProgress {
  phase: 'checking' | 'pulling' | 'pushing' | 'files' | 'done';
  label: string;
  progress: number | null;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  filesUp: number;
  filesDown: number;
  at: number;
  /** something worked around rather than failed, e.g. no Storage bucket */
  warning: string | null;
}

interface BlobMeta {
  key: string;
  path: string;
  docId: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
}

/* ------------------------------------------------------------------ state */

async function readPointer(userId: string): Promise<SyncPointer> {
  const saved = await repo.getMeta<SyncPointer>(STATE_KEY);
  // A different account in the same browser starts from scratch, otherwise it
  // would inherit watermarks that hide the new account's whole history.
  if (!saved || saved.userId !== userId) return { ...EMPTY_POINTER, userId };
  return { ...EMPTY_POINTER, ...saved, userId };
}

async function writePointer(p: SyncPointer): Promise<void> {
  await repo.setMeta(STATE_KEY, p);
}

export async function syncPointer(): Promise<SyncPointer | null> {
  const saved = await repo.getMeta<SyncPointer>(STATE_KEY);
  return saved ?? null;
}

/** Forgets the watermarks so the next sync re-reads everything. */
export async function resetSyncState(): Promise<void> {
  await repo.setMeta(STATE_KEY, EMPTY_POINTER);
}

/* ------------------------------------------------------------------- sync */

let running: Promise<SyncResult> | null = null;

/** One sync at a time; a second caller simply joins the run in flight. */
export function runSync(onProgress?: (p: SyncProgress) => void): Promise<SyncResult> {
  if (running) return running;
  running = doSync(onProgress).finally(() => {
    running = null;
  });
  return running;
}

export const isSyncing = (): boolean => running !== null;

async function doSync(onProgress?: (p: SyncProgress) => void): Promise<SyncResult> {
  const client = await getClient();
  if (!client) throw new Error('Облакът не е настроен.');
  const step = (phase: SyncProgress['phase'], label: string, progress: number | null = null) =>
    onProgress?.({ phase, label, progress });

  step('checking', 'Проверка на профила…');
  const { data: auth, error: authErr } = await client.auth.getUser();
  if (authErr) throw new Error(humanError(authErr));
  const userId = auth.user?.id;
  if (!userId) throw new Error('Не си влязъл в профил.');

  const pointer = await readPointer(userId);
  const startedAt = Date.now();
  /**
   * One read of each local store for the whole pull, not one per page.
   * A library with 50 000 annotations would otherwise re-read them for every
   * 500-row page that comes down the wire.
   */
  const localByKind = new Map<SyncKind, Map<string, SyncRow>>();
  /** ids that arrived from the cloud in this run and must not bounce back */
  const justPulled = new Set<string>();
  const localRows = async (kind: SyncKind) => {
    let map = localByKind.get(kind);
    if (!map) {
      map = new Map((await repo.listRecords(kind)).map((r) => [r.id, r]));
      localByKind.set(kind, map);
    }
    return map;
  };

  /* ---------------------------------------------------------------- pull */

  step('pulling', 'Изтегляне на промените…');
  let pulled = 0;
  let cursor = pointer.lastPulledAt;
  const remoteBlobs: BlobMeta[] = [];

  for (;;) {
    const { data, error } = await client
      .from(RECORDS_TABLE)
      .select('kind,id,updated_at,deleted,data')
      .eq('user_id', userId)
      .gt('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(PULL_PAGE);
    if (error) throw new Error(humanError(error));
    const rows = (data ?? []) as {
      kind: string;
      id: string;
      updated_at: number;
      deleted: boolean;
      data: Record<string, unknown> | null;
    }[];
    if (!rows.length) break;

    const byKind = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byKind.get(r.kind);
      if (list) list.push(r);
      else byKind.set(r.kind, [r]);
    }

    for (const [kind, list] of byKind) {
      if (kind === BLOB_KIND) {
        for (const r of list) if (!r.deleted && r.data) remoteBlobs.push(r.data as unknown as BlobMeta);
        continue;
      }
      if (!KINDS.includes(kind as SyncKind)) continue;
      const k = kind as SyncKind;
      const local = await localRows(k);
      const writes: SyncRow[] = [];
      const drops: string[] = [];
      for (const r of list) {
        const mine = local.get(r.id);
        // Same timestamp means the same write coming back to us.
        if (mine && mine.updatedAt >= r.updated_at) continue;
        if (r.deleted) {
          if (mine) drops.push(r.id);
          local.delete(r.id);
        } else if (r.data) {
          const row = { id: r.id, updatedAt: r.updated_at, data: r.data };
          writes.push(row);
          local.set(r.id, row);
          justPulled.add(`${k}:${r.id}`);
        }
      }
      await repo.putRecords(k, writes);
      await repo.dropRecords(k, drops);
      pulled += writes.length + drops.length;
    }

    cursor = rows[rows.length - 1].updated_at;
    step('pulling', `Изтеглени ${pulled} записа…`);
    if (rows.length < PULL_PAGE) break;
  }
  pointer.lastPulledAt = cursor;

  /* -------------------------------------------------------------- delete */

  step('pushing', 'Изпращане на изтритото…');
  const stones = await repo.listTombstones();
  if (stones.length) {
    await pushTombstones(client, userId, stones);
    await repo.clearTombstones(stones.map((t) => t.key));
  }

  /* ---------------------------------------------------------------- push */

  let pushed = 0;
  for (const [i, kind] of KINDS.entries()) {
    step('pushing', 'Изпращане на промените…', (i + 1) / KINDS.length);
    const rows = [...(await localRows(kind)).values()].filter(
      (r) => r.updatedAt > pointer.lastPushedAt && !justPulled.has(`${kind}:${r.id}`),
    );
    if (!rows.length) continue;
    for (let at = 0; at < rows.length; at += PUSH_CHUNK) {
      const chunk = rows.slice(at, at + PUSH_CHUNK).map((r) => ({
        user_id: userId,
        kind,
        id: r.id,
        doc_id: r.docId ?? null,
        updated_at: r.updatedAt,
        deleted: false,
        data: r.data,
      }));
      const { error } = await client.from(RECORDS_TABLE).upsert(chunk, { onConflict: 'user_id,kind,id' });
      if (error) throw new Error(humanError(error));
      pushed += chunk.length;
    }
  }
  pointer.lastPushedAt = startedAt;

  /* --------------------------------------------------------------- blobs */

  step('files', 'Файлове…');
  const { filesUp, filesDown, warning } = await syncBlobs(client, userId, remoteBlobs, step);

  pointer.lastSyncAt = Date.now();
  await writePointer(pointer);
  step('done', 'Готово');
  return { pulled, pushed, filesUp, filesDown, at: pointer.lastSyncAt, warning };
}

/* ------------------------------------------------------------ tombstones */

async function pushTombstones(client: Client, userId: string, stones: Tombstone[]): Promise<void> {
  const rows = stones.map((t) => ({
    user_id: userId,
    kind: t.kind,
    id: t.id,
    doc_id: null,
    updated_at: t.deletedAt,
    deleted: true,
    data: null,
  }));
  for (let at = 0; at < rows.length; at += PUSH_CHUNK) {
    const { error } = await client
      .from(RECORDS_TABLE)
      .upsert(rows.slice(at, at + PUSH_CHUNK), { onConflict: 'user_id,kind,id' });
    if (error) throw new Error(humanError(error));
  }
  // A deleted document takes its annotations, bookmarks, images and file with
  // it — one statement instead of a tombstone per child.
  for (const t of stones.filter((x) => x.cascade)) {
    const { error } = await client
      .from(RECORDS_TABLE)
      .update({ deleted: true, data: null, updated_at: t.deletedAt })
      .eq('user_id', userId)
      .eq('doc_id', t.id);
    if (error) throw new Error(humanError(error));
    await client.storage.from(FILES_BUCKET).remove([`${userId}/file/${t.id}.pdf`]);
  }
}

/* ----------------------------------------------------------------- blobs */

const blobPath = (userId: string, key: string) => {
  const [kind, id] = key.split(':');
  return `${userId}/${kind}/${id}${kind === 'file' ? '.pdf' : ''}`;
};

const missingBucket = (message: string): boolean => /not found|nosuchbucket/i.test(message);

async function syncBlobs(
  client: Client,
  userId: string,
  remote: BlobMeta[],
  step: (phase: SyncProgress['phase'], label: string, progress?: number | null) => void,
): Promise<{ filesUp: number; filesDown: number; warning: string | null }> {
  const uploaded = await repo.uploadedKeys();
  let filesUp = 0;
  let filesDown = 0;

  /* upload what only exists here */
  const documents = await repo.listDocuments();
  const assets = await repo.listAllAssets();
  const todo: { key: string; blob: Blob; meta: BlobMeta }[] = [];

  for (const doc of documents) {
    if (doc.kind === 'board' || doc.deletedAt) continue;
    const key = `file:${doc.id}`;
    if (uploaded.has(key)) continue;
    const bytes = await repo.getFile(doc.id);
    if (!bytes || bytes.byteLength > MAX_BLOB_BYTES) continue;
    todo.push({
      key,
      blob: new Blob([bytes], { type: 'application/pdf' }),
      meta: {
        key,
        path: blobPath(userId, key),
        docId: doc.id,
        size: bytes.byteLength,
        mime: 'application/pdf',
      },
    });
  }
  for (const asset of assets) {
    const key = `asset:${asset.id}`;
    if (uploaded.has(key) || asset.blob.size > MAX_BLOB_BYTES) continue;
    todo.push({
      key,
      blob: asset.blob,
      meta: {
        key,
        path: blobPath(userId, key),
        docId: asset.docId,
        size: asset.blob.size,
        mime: asset.blob.type || 'image/png',
        width: asset.width,
        height: asset.height,
      },
    });
  }

  for (const [i, item] of todo.entries()) {
    step('files', `Качване ${i + 1} от ${todo.length}…`, (i + 1) / todo.length);
    const { error } = await client.storage
      .from(FILES_BUCKET)
      .upload(item.meta.path, item.blob, { upsert: true, contentType: item.meta.mime });
    // A missing bucket must not sink the whole sync: the notes, cards and
    // tasks are the part that matters, and they have already gone through.
    if (error && missingBucket(error.message)) {
      return {
        filesUp,
        filesDown,
        warning: 'Бележките се синхронизираха, но файловете не — липсва хранилището „library“ в Supabase.',
      };
    }
    if (error) throw new Error(humanError(error));
    const { error: metaErr } = await client.from(RECORDS_TABLE).upsert(
      {
        user_id: userId,
        kind: BLOB_KIND,
        id: item.key,
        doc_id: item.meta.docId,
        updated_at: Date.now(),
        deleted: false,
        data: item.meta,
      },
      { onConflict: 'user_id,kind,id' },
    );
    if (metaErr) throw new Error(humanError(metaErr));
    await repo.markUploaded(item.key);
    filesUp++;
  }

  /* pull down the images; PDFs wait until their document is opened */
  const wanted = remote.filter((b) => b.key.startsWith('asset:'));
  for (const [i, meta] of wanted.entries()) {
    const id = meta.key.slice('asset:'.length);
    if (await repo.getAsset(id)) continue;
    step('files', `Изтегляне ${i + 1} от ${wanted.length}…`, (i + 1) / wanted.length);
    const { data, error } = await client.storage.from(FILES_BUCKET).download(meta.path);
    if (error || !data) continue;
    await repo.putAsset({
      id,
      docId: meta.docId,
      blob: data,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    });
    await repo.markUploaded(meta.key);
    filesDown++;
  }

  return { filesUp, filesDown, warning: null };
}

/* ------------------------------------------------------- on-demand files */

/**
 * Fetches a PDF that exists in the account but not yet on this device.
 * Called when a document is opened, which is why a fresh phone is usable the
 * moment the records land instead of after every book has downloaded.
 */
export async function fetchDocumentFile(docId: string): Promise<ArrayBuffer | null> {
  const client = await getClient();
  if (!client) return null;
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  const { data, error } = await client.storage.from(FILES_BUCKET).download(`${userId}/file/${docId}.pdf`);
  if (error || !data) return null;
  const bytes = await data.arrayBuffer();
  await repo.putFile(docId, bytes);
  await repo.markUploaded(`file:${docId}`);
  return bytes;
}

/** Deletes everything this account holds in the cloud. Local data stays. */
export async function wipeCloud(): Promise<void> {
  const client = await getClient();
  if (!client) return;
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;
  const { error } = await client.from(RECORDS_TABLE).delete().eq('user_id', userId);
  if (error) throw new Error(humanError(error));
  for (const folder of ['file', 'asset']) {
    const { data } = await client.storage.from(FILES_BUCKET).list(`${userId}/${folder}`, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${userId}/${folder}/${f.name}`);
    if (paths.length) await client.storage.from(FILES_BUCKET).remove(paths);
  }
  await resetSyncState();
}

/**
 * Removes the account and everything it holds.
 *
 * The files go first, from the browser, because Storage objects are not rows
 * and no cascade reaches them. The user row is deleted by a `security
 * definer` function: deleting a user needs the service key, which has no
 * business being in a page anyone can open, so the privilege is lent to one
 * function that can only ever delete its own caller.
 */
export async function deleteAccount(): Promise<void> {
  const client = await getClient();
  if (!client) throw new Error('Облакът не е настроен.');
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Не си влязъл в профил.');

  for (const folder of ['file', 'asset']) {
    const { data } = await client.storage.from(FILES_BUCKET).list(`${userId}/${folder}`, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${userId}/${folder}/${f.name}`);
    if (paths.length) await client.storage.from(FILES_BUCKET).remove(paths);
  }

  const { error } = await client.rpc('delete_own_account');
  if (error) {
    const missing = /function .*delete_own_account/i.test(error.message) || error.code === 'PGRST202';
    throw new Error(
      missing
        ? 'Липсва функцията delete_own_account. Пусни SQL скрипта отново в Supabase.'
        : humanError(error),
    );
  }
  await client.auth.signOut();
  await resetSyncState();
}

/** What the account currently holds in the cloud, for the settings screen. */
export async function cloudUsage(): Promise<{ records: number; files: number; bytes: number } | null> {
  const client = await getClient();
  if (!client) return null;
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const { count } = await client
    .from(RECORDS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('deleted', false);

  let files = 0;
  let bytes = 0;
  const { data: blobs } = await client
    .from(RECORDS_TABLE)
    .select('data')
    .eq('user_id', userId)
    .eq('kind', 'blobs')
    .eq('deleted', false);
  for (const row of blobs ?? []) {
    const meta = (row as { data: { size?: number } | null }).data;
    if (!meta) continue;
    files++;
    bytes += meta.size ?? 0;
  }
  return { records: count ?? 0, files, bytes };
}

/** How much of the library still has to be uploaded, for the settings screen. */
export async function pendingUploadCount(): Promise<number> {
  const uploaded = await repo.uploadedKeys();
  const docs = (await repo.listDocuments()).filter((d) => d.kind === 'pdf' && !d.deletedAt);
  const assets = await repo.listAllAssets();
  let n = 0;
  for (const d of docs) if (!uploaded.has(`file:${d.id}`)) n++;
  for (const a of assets) if (!uploaded.has(`asset:${a.id}`)) n++;
  return n;
}

export { SYNCED_META_KEYS };
