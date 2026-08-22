import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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
  StoredFile,
  StudyTask,
  Subject,
  Tombstone,
} from '@/types';

/**
 * Deliberately still `studypdf`, from before the product was named Plauvia.
 * The name is invisible to anyone but the browser, and renaming it would point
 * the app at an empty database — every existing library, orphaned.
 */
export const DB_NAME = 'studypdf';
/**
 * v2 added whiteboards, flashcards, tasks and focus sessions.
 * v3 turns the app into a workspace: subjects, a planner that absorbs the old
 * task list, grades and a timetable.
 * v4 makes the library syncable: deletions leave a tombstone so another
 * device learns about them, and blobs remember whether they are uploaded.
 * v5 adds goals — the only new store the 2.0 screens needed, because levels,
 * achievements and statistics are all derived from records that already exist.
 */
export const DB_VERSION = 5;

export interface StudyDB extends DBSchema {
  folders: { key: string; value: Folder; indexes: { 'by-updated': number } };
  documents: { key: string; value: DocumentMeta; indexes: { 'by-updated': number } };
  /** Original PDF bytes, kept apart so listing documents stays cheap. */
  files: { key: string; value: StoredFile };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-doc': string; 'by-doc-page': [string, number] };
  };
  assets: { key: string; value: Asset; indexes: { 'by-doc': string } };
  bookmarks: { key: string; value: Bookmark; indexes: { 'by-doc': string } };
  cards: {
    key: string;
    value: FlashCard;
    indexes: { 'by-doc': string; 'by-due': number; 'by-deck': string };
  };
  /** @deprecated emptied by the v3 migration, kept so old data can be read */
  tasks: { key: string; value: StudyTask };
  sessions: {
    key: string;
    value: FocusSession;
    indexes: { 'by-day': string; 'by-doc': string };
  };
  subjects: { key: string; value: Subject };
  planner: { key: string; value: PlannerItem; indexes: { 'by-due': number; 'by-subject': string } };
  grades: { key: string; value: Grade; indexes: { 'by-subject': string } };
  schedule: { key: string; value: ClassSlot; indexes: { 'by-day': number } };
  goals: { key: string; value: Goal; indexes: { 'by-subject': string } };
  /** key/value bucket for the profile and app-level state */
  meta: { key: string; value: { key: string; value: unknown } };
  /**
   * What was deleted here and not yet pushed. Without it a device that syncs
   * after a deletion would happily upload its own stale copy back.
   */
  tombstones: { key: string; value: Tombstone; indexes: { 'by-deleted': number } };
  /** which blobs have already reached the cloud: key → uploaded timestamp */
  uploads: { key: string; value: { key: string; at: number } };
}

let dbPromise: Promise<IDBPDatabase<StudyDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<StudyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StudyDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        /* ------------------------------------------------------- v1 */
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'docId' });
        }
        if (!db.objectStoreNames.contains('annotations')) {
          const s = db.createObjectStore('annotations', { keyPath: 'id' });
          s.createIndex('by-doc', 'docId');
          s.createIndex('by-doc-page', ['docId', 'page']);
        }
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' }).createIndex('by-doc', 'docId');
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.createObjectStore('bookmarks', { keyPath: 'id' }).createIndex('by-doc', 'docId');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }

        /* ------------------------------------------------------- v2 */
        if (!db.objectStoreNames.contains('cards')) {
          const s = db.createObjectStore('cards', { keyPath: 'id' });
          s.createIndex('by-doc', 'docId');
          s.createIndex('by-due', 'due');
          s.createIndex('by-deck', 'deck');
        }
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('by-day', 'day');
          s.createIndex('by-doc', 'docId');
        }

        // Documents written before v2 predate whiteboards; they are all PDFs.
        if (oldVersion > 0 && oldVersion < 2) {
          const store = tx.objectStore('documents');
          void store.openCursor().then(async function walk(cursor): Promise<void> {
            if (!cursor) return;
            const doc = cursor.value as DocumentMeta & { kind?: string };
            if (!doc.kind) await cursor.update({ ...doc, kind: 'pdf', board: null });
            return cursor.continue().then(walk);
          });
        }

        /* ------------------------------------------------------- v3 */
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('planner')) {
          const s = db.createObjectStore('planner', { keyPath: 'id' });
          s.createIndex('by-due', 'due');
          s.createIndex('by-subject', 'subjectId');
        }
        if (!db.objectStoreNames.contains('grades')) {
          db.createObjectStore('grades', { keyPath: 'id' }).createIndex('by-subject', 'subjectId');
        }
        if (!db.objectStoreNames.contains('schedule')) {
          db.createObjectStore('schedule', { keyPath: 'id' }).createIndex('by-day', 'day');
        }

        /* ------------------------------------------------------- v5 */
        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id' }).createIndex('by-subject', 'subjectId');
        }

        /* ------------------------------------------------------- v4 */
        if (!db.objectStoreNames.contains('tombstones')) {
          db.createObjectStore('tombstones', { keyPath: 'key' }).createIndex('by-deleted', 'deletedAt');
        }
        if (!db.objectStoreNames.contains('uploads')) {
          db.createObjectStore('uploads', { keyPath: 'key' });
        }

        // The timer's flat task list becomes planner items, so there is only
        // ever one place where "things I have to do" live.
        if (oldVersion > 0 && oldVersion < 3 && db.objectStoreNames.contains('tasks')) {
          const from = tx.objectStore('tasks');
          const into = tx.objectStore('planner');
          void from.getAll().then(async (rows) => {
            for (const [i, t] of (rows as StudyTask[]).entries()) {
              await into.put({
                id: t.id,
                kind: 'task',
                title: t.text,
                notes: '',
                subjectId: null,
                docId: t.docId ?? null,
                due: null,
                done: t.done,
                completedAt: t.done ? t.createdAt : null,
                priority: 0,
                pomodoros: t.pomodoros ?? 0,
                order: t.order ?? i,
                createdAt: t.createdAt,
                updatedAt: t.createdAt,
              });
            }
            await from.clear();
          });
        }
      },
      blocking() {
        // Another tab wants to upgrade — let go of the connection.
        dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

/** Ask the browser to keep our data (prevents eviction under storage pressure). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
  return false;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  try {
    const e = await navigator.storage?.estimate?.();
    return { usage: e?.usage ?? 0, quota: e?.quota ?? 0 };
  } catch {
    return { usage: 0, quota: 0 };
  }
}
