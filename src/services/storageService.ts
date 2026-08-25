import type { IDBPDatabase } from 'idb';
import { getDB, type StudyDB } from './db';
import type {
  Annotation,
  Asset,
  Bookmark,
  ClassSlot,
  DocumentMeta,
  FlashCard,
  FocusSession,
  Folder,
  Goal,
  Grade,
  PlannerItem,
  Subject,
  SyncKind,
  Tombstone,
} from '@/types';

/** A row on its way to or from the cloud. */
export interface SyncRow {
  id: string;
  updatedAt: number;
  data: Record<string, unknown>;
  /** set for anything that belongs to a document, so deletes can cascade */
  docId?: string | null;
}

/** Meta keys that belong to the account rather than to this browser. */
export const SYNCED_META_KEYS = ['profile', 'learning', 'privacy', 'decks', 'game', 'itemTypes'] as const;

/**
 * Everything the app needs from persistence lives behind this interface.
 * The MVP ships one implementation (IndexedDB, local-only). A cloud backend
 * later only has to satisfy the same contract — no UI or store code changes.
 */
export interface StudyRepository {
  /* folders */
  listFolders(): Promise<Folder[]>;
  putFolder(f: Folder): Promise<void>;
  deleteFolder(id: string): Promise<void>;

  /* documents */
  listDocuments(): Promise<DocumentMeta[]>;
  getDocument(id: string): Promise<DocumentMeta | undefined>;
  putDocument(d: DocumentMeta): Promise<void>;
  patchDocument(id: string, patch: Partial<DocumentMeta>): Promise<DocumentMeta | undefined>;
  deleteDocument(id: string): Promise<void>;

  /* file bytes */
  putFile(docId: string, data: ArrayBuffer, mime?: string): Promise<void>;
  getFile(docId: string): Promise<ArrayBuffer | undefined>;

  /* annotations */
  listAnnotations(docId: string): Promise<Annotation[]>;
  saveAnnotations(upserts: Annotation[], deletes: string[]): Promise<void>;
  countAnnotations(docId: string): Promise<number>;

  /* assets (pasted / inserted images) */
  putAsset(a: Asset): Promise<void>;
  getAsset(id: string): Promise<Asset | undefined>;
  listAssets(docId: string): Promise<Asset[]>;

  /* bookmarks */
  listBookmarks(docId: string): Promise<Bookmark[]>;
  putBookmark(b: Bookmark): Promise<void>;
  deleteBookmark(id: string): Promise<void>;

  /* flashcards */
  listCards(): Promise<FlashCard[]>;
  putCards(cards: FlashCard[]): Promise<void>;
  deleteCards(ids: string[]): Promise<void>;

  /* subjects */
  listSubjects(): Promise<Subject[]>;
  putSubject(s: Subject): Promise<void>;
  deleteSubject(id: string): Promise<void>;

  /* planner: tasks, homework and exams */
  listPlanner(): Promise<PlannerItem[]>;
  putPlanner(items: PlannerItem[]): Promise<void>;
  deletePlanner(ids: string[]): Promise<void>;

  /* goals */
  listGoals(): Promise<Goal[]>;
  putGoal(g: Goal): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  /* grades */
  listGrades(): Promise<Grade[]>;
  putGrade(g: Grade): Promise<void>;
  deleteGrade(id: string): Promise<void>;

  /* weekly timetable */
  listSchedule(): Promise<ClassSlot[]>;
  putSlot(s: ClassSlot): Promise<void>;
  deleteSlot(id: string): Promise<void>;

  /* focus sessions */
  listSessions(): Promise<FocusSession[]>;
  putSession(s: FocusSession): Promise<void>;
  deleteSessionsOfDay(day: string): Promise<void>;

  /* key/value */
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;

  /* ------------------------------------------------------------ cloud */

  /** Every row of one store, normalised for the sync engine. */
  listRecords(kind: SyncKind): Promise<SyncRow[]>;
  /** Writes rows that arrived from the cloud, verbatim. */
  putRecords(kind: SyncKind, rows: SyncRow[]): Promise<void>;
  /** Removes rows the cloud says are gone, without leaving new tombstones. */
  dropRecords(kind: SyncKind, ids: string[]): Promise<void>;

  listTombstones(): Promise<Tombstone[]>;
  clearTombstones(keys: string[]): Promise<void>;

  listAllAssets(): Promise<Asset[]>;
  /** Remembers that a blob already reached the cloud. */
  markUploaded(key: string): Promise<void>;
  uploadedKeys(): Promise<Set<string>>;

  /** Wipes every store. Used by "restore over the existing library". */
  clearAll(): Promise<void>;
}

/**
 * The write time every record needs in order to be syncable.
 *
 * It is applied here, at the door, rather than left to each caller. It *was*
 * left to each caller, and four of them forgot: focus sessions, grades and
 * timetable slots went to disk with no `updatedAt` at all, which the sync
 * engine reads as "written at the epoch" — older than the last push, forever.
 * The result was silent and total: none of those three kinds ever reached the
 * cloud, so a second device showed no study history and no marks, and nothing
 * anywhere reported an error.
 *
 * A rule that has to be remembered in five places is a rule that will be
 * forgotten in the sixth. This is the one place.
 */
const stamp = <T extends object>(row: T): T => ({ ...row, updatedAt: Date.now() });

/** Which IndexedDB store backs each syncable kind. */
const KIND_STORE: Record<Exclude<SyncKind, 'meta'>, keyof StudyDB> = {
  folders: 'folders',
  documents: 'documents',
  annotations: 'annotations',
  bookmarks: 'bookmarks',
  cards: 'cards',
  subjects: 'subjects',
  planner: 'planner',
  goals: 'goals',
  grades: 'grades',
  schedule: 'schedule',
  sessions: 'sessions',
};

class IndexedDBRepository implements StudyRepository {
  private db(): Promise<IDBPDatabase<StudyDB>> {
    return getDB();
  }

  async listFolders() {
    return (await this.db()).getAll('folders');
  }
  async putFolder(f: Folder) {
    await (await this.db()).put('folders', f);
  }
  async deleteFolder(id: string) {
    await (await this.db()).delete('folders', id);
    await this.tomb('folders', [id]);
  }

  async listDocuments() {
    return (await this.db()).getAll('documents');
  }
  async getDocument(id: string) {
    return (await this.db()).get('documents', id);
  }
  async putDocument(d: DocumentMeta) {
    await (await this.db()).put('documents', d);
  }
  async patchDocument(id: string, patch: Partial<DocumentMeta>) {
    const db = await this.db();
    const tx = db.transaction('documents', 'readwrite');
    const cur = await tx.store.get(id);
    if (!cur) {
      await tx.done;
      return undefined;
    }
    const next = { ...cur, ...patch, updatedAt: patch.updatedAt ?? Date.now() };
    await tx.store.put(next);
    await tx.done;
    return next;
  }
  /** Removes the document together with everything that hangs off it. */
  async deleteDocument(id: string) {
    const db = await this.db();
    // Flashcards are deliberately NOT cascaded: they are study material in
    // their own right and outlive the textbook they were cut from.
    const tx = db.transaction(['documents', 'files', 'annotations', 'assets', 'bookmarks'], 'readwrite');
    await tx.objectStore('documents').delete(id);
    await tx.objectStore('files').delete(id);
    for (const store of ['annotations', 'assets', 'bookmarks'] as const) {
      const idx = tx.objectStore(store).index('by-doc');
      let cursor = await idx.openCursor(IDBKeyRange.only(id));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    await tx.done;
    // One cascading tombstone: the server drops the children by their docId,
    // which keeps a 500-page book from writing thousands of delete rows.
    await this.tomb('documents', [id], true);
  }

  async putFile(docId: string, data: ArrayBuffer, mime = 'application/pdf') {
    await (await this.db()).put('files', { docId, data, mime });
  }
  async getFile(docId: string) {
    return (await (await this.db()).get('files', docId))?.data;
  }

  async listAnnotations(docId: string) {
    return (await this.db()).getAllFromIndex('annotations', 'by-doc', IDBKeyRange.only(docId));
  }
  /** One transaction for the whole autosave batch, so a flush is atomic. */
  async saveAnnotations(upserts: Annotation[], deletes: string[]) {
    if (!upserts.length && !deletes.length) return;
    const db = await this.db();
    const tx = db.transaction('annotations', 'readwrite');
    const ops: Promise<unknown>[] = [];
    for (const a of upserts) ops.push(tx.store.put(a));
    for (const id of deletes) ops.push(tx.store.delete(id));
    ops.push(tx.done);
    await Promise.all(ops);
    await this.tomb('annotations', deletes);
  }
  async countAnnotations(docId: string) {
    return (await this.db()).countFromIndex('annotations', 'by-doc', IDBKeyRange.only(docId));
  }

  async putAsset(a: Asset) {
    await (await this.db()).put('assets', a);
  }
  async getAsset(id: string) {
    return (await this.db()).get('assets', id);
  }
  async listAssets(docId: string) {
    return (await this.db()).getAllFromIndex('assets', 'by-doc', IDBKeyRange.only(docId));
  }

  async listCards() {
    return (await this.db()).getAll('cards');
  }
  async putCards(cards: FlashCard[]) {
    if (!cards.length) return;
    const db = await this.db();
    const tx = db.transaction('cards', 'readwrite');
    await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done]);
  }
  async deleteCards(ids: string[]) {
    if (!ids.length) return;
    const db = await this.db();
    const tx = db.transaction('cards', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    await this.tomb('cards', ids);
  }

  async listSubjects() {
    return (await this.db()).getAll('subjects');
  }
  async putSubject(s: Subject) {
    await (await this.db()).put('subjects', s);
  }
  async deleteSubject(id: string) {
    await (await this.db()).delete('subjects', id);
    await this.tomb('subjects', [id]);
  }

  async listPlanner() {
    return (await this.db()).getAll('planner');
  }
  async putPlanner(items: PlannerItem[]) {
    if (!items.length) return;
    const db = await this.db();
    const tx = db.transaction('planner', 'readwrite');
    await Promise.all([...items.map((i) => tx.store.put(i)), tx.done]);
  }
  async deletePlanner(ids: string[]) {
    if (!ids.length) return;
    const db = await this.db();
    const tx = db.transaction('planner', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    await this.tomb('planner', ids);
  }

  async listGoals() {
    return (await this.db()).getAll('goals');
  }
  async putGoal(g: Goal) {
    await (await this.db()).put('goals', g);
  }
  async deleteGoal(id: string) {
    await (await this.db()).delete('goals', id);
    await this.tomb('goals', [id]);
  }

  async listGrades() {
    return (await this.db()).getAll('grades');
  }
  async putGrade(g: Grade) {
    await (await this.db()).put('grades', stamp(g));
  }
  async deleteGrade(id: string) {
    await (await this.db()).delete('grades', id);
    await this.tomb('grades', [id]);
  }

  async listSchedule() {
    return (await this.db()).getAll('schedule');
  }
  async putSlot(s: ClassSlot) {
    await (await this.db()).put('schedule', stamp(s));
  }
  async deleteSlot(id: string) {
    await (await this.db()).delete('schedule', id);
    await this.tomb('schedule', [id]);
  }

  async listSessions() {
    return (await this.db()).getAll('sessions');
  }
  async putSession(s: FocusSession) {
    await (await this.db()).put('sessions', stamp(s));
  }
  async deleteSessionsOfDay(day: string) {
    const db = await this.db();
    const tx = db.transaction('sessions', 'readwrite');
    const idx = tx.store.index('by-day');
    const gone: string[] = [];
    let cursor = await idx.openCursor(IDBKeyRange.only(day));
    while (cursor) {
      gone.push(cursor.value.id);
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
    await this.tomb('sessions', gone);
  }

  async listBookmarks(docId: string) {
    return (await this.db()).getAllFromIndex('bookmarks', 'by-doc', IDBKeyRange.only(docId));
  }
  async putBookmark(b: Bookmark) {
    await (await this.db()).put('bookmarks', stamp(b));
  }
  async deleteBookmark(id: string) {
    await (await this.db()).delete('bookmarks', id);
    await this.tomb('bookmarks', [id]);
  }

  async getMeta<T>(key: string) {
    const row = await (await this.db()).get('meta', key);
    return row?.value as T | undefined;
  }
  async setMeta<T>(key: string, value: T) {
    await (await this.db()).put('meta', { key, value });
  }

  /* ------------------------------------------------------------ cloud */

  /** Marks ids as deleted here, so the next sync deletes them everywhere. */
  private async tomb(kind: SyncKind, ids: string[], cascade = false) {
    if (!ids.length) return;
    const db = await this.db();
    const at = Date.now();
    const tx = db.transaction('tombstones', 'readwrite');
    await Promise.all([
      ...ids.map((id) => tx.store.put({ key: `${kind}:${id}`, kind, id, cascade, deletedAt: at })),
      tx.done,
    ]);
  }

  async listRecords(kind: SyncKind): Promise<SyncRow[]> {
    const db = await this.db();
    if (kind === 'meta') {
      const rows: SyncRow[] = [];
      for (const key of SYNCED_META_KEYS) {
        const row = await db.get('meta', key);
        if (!row) continue;
        const value = row.value as { updatedAt?: number } | null;
        rows.push({ id: key, updatedAt: value?.updatedAt ?? 0, data: { value: row.value } });
      }
      return rows;
    }
    const all = (await db.getAll(KIND_STORE[kind] as 'documents')) as unknown as Record<string, unknown>[];
    return all.map((r) => ({
      id: String(r.id),
      // The fallback chain is defence, not the mechanism: `stamp` above puts a
      // real `updatedAt` on everything written today, and the v6 migration put
      // one on everything written before. This catches a record that reached
      // the store by some route neither of those covers — and reaching for the
      // moment the record describes is better than reaching for zero, which
      // the push filter reads as "already sent".
      updatedAt: Number(r.updatedAt ?? r.startedAt ?? r.date ?? r.createdAt ?? 0),
      docId: (r.docId as string | null) ?? (kind === 'documents' ? String(r.id) : null),
      data: r,
    }));
  }

  async putRecords(kind: SyncKind, rows: SyncRow[]) {
    if (!rows.length) return;
    const db = await this.db();
    if (kind === 'meta') {
      const tx = db.transaction('meta', 'readwrite');
      await Promise.all([
        ...rows.map((r) => tx.store.put({ key: r.id, value: (r.data as { value: unknown }).value })),
        tx.done,
      ]);
      return;
    }
    const store = KIND_STORE[kind] as 'documents';
    const tx = db.transaction(store, 'readwrite');
    await Promise.all([...rows.map((r) => tx.store.put(r.data as never)), tx.done]);
  }

  /** Deletes without leaving a tombstone — the cloud already knows. */
  async dropRecords(kind: SyncKind, ids: string[]) {
    if (!ids.length || kind === 'meta') return;
    const db = await this.db();
    const store = KIND_STORE[kind] as 'documents';
    const tx = db.transaction(store, 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    if (kind === 'documents') {
      // Local children of a document deleted elsewhere have to go too.
      for (const id of ids) {
        const inner = db.transaction(['files', 'annotations', 'assets', 'bookmarks'], 'readwrite');
        await inner.objectStore('files').delete(id);
        for (const child of ['annotations', 'assets', 'bookmarks'] as const) {
          const idx = inner.objectStore(child).index('by-doc');
          let cursor = await idx.openCursor(IDBKeyRange.only(id));
          while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
          }
        }
        await inner.done;
      }
    }
  }

  async listTombstones() {
    return (await this.db()).getAll('tombstones');
  }
  async clearTombstones(keys: string[]) {
    if (!keys.length) return;
    const db = await this.db();
    const tx = db.transaction('tombstones', 'readwrite');
    await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
  }

  async listAllAssets() {
    return (await this.db()).getAll('assets');
  }
  async markUploaded(key: string) {
    await (await this.db()).put('uploads', { key, at: Date.now() });
  }
  async uploadedKeys() {
    return new Set((await (await this.db()).getAllKeys('uploads')) as string[]);
  }

  async clearAll() {
    const db = await this.db();
    const stores = [
      'folders',
      'documents',
      'files',
      'annotations',
      'assets',
      'bookmarks',
      'cards',
      'tasks',
      'sessions',
      'subjects',
      'planner',
      'goals',
      'grades',
      'schedule',
      'meta',
      'tombstones',
      'uploads',
    ] as const;
    const tx = db.transaction(stores, 'readwrite');
    await Promise.all([...stores.map((s) => tx.objectStore(s).clear()), tx.done]);
  }
}

export const repo: StudyRepository = new IndexedDBRepository();
