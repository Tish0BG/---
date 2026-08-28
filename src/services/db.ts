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
 * v5 added goals; v7 removes them again. Levels, achievements and statistics
 * were always derived from records that already exist, so the goal store was
 * the one thing in the app keeping a number nobody could check against work.
 * v6 fixes a silent sync failure: four kinds of record were written without a
 * `updatedAt`, so the cloud never saw them. See the migration below.
 * v7 drops the goal store and the rows in it.
 * v8 gives every flashcard a deck. Cards restored from an old archive could
 * arrive without one, and a deckless card was a `TypeError` in the deck list.
 */
export const DB_VERSION = 8;

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

        /* ------------------------------------------------------- v4 */
        if (!db.objectStoreNames.contains('tombstones')) {
          db.createObjectStore('tombstones', { keyPath: 'key' }).createIndex('by-deleted', 'deletedAt');
        }
        if (!db.objectStoreNames.contains('uploads')) {
          db.createObjectStore('uploads', { keyPath: 'key' });
        }

        /* ------------------------------------------------------- v6 */

        /**
         * Backfilling the write times the sync engine needs.
         *
         * Focus sessions, grades and timetable slots were written without an
         * `updatedAt`. The sync engine reads that field to decide what is new,
         * treats a missing one as zero, and only pushes rows *newer* than the
         * last push — so those three kinds were never pushed at all. Not once.
         * Every hour of focus a person had logged lived on one device only,
         * and a new phone came up with an empty history and empty statistics.
         *
         * The repository stamps them on write now (see `storageService`), and
         * this walks what is already on disk. The stamp is the moment the
         * record is known to have existed — the session's start, the mark's
         * date — rather than `now`, so that two devices which both migrate do
         * not each claim to hold the newer copy of the same row.
         */
        if (oldVersion > 0 && oldVersion < 6) {
          const backfill = async (
            name: 'sessions' | 'grades' | 'schedule' | 'bookmarks',
            when: (row: Record<string, unknown>) => number,
          ) => {
            if (!db.objectStoreNames.contains(name)) return;
            const store = tx.objectStore(name);
            let cursor = await store.openCursor();
            while (cursor) {
              const row = cursor.value as unknown as Record<string, unknown>;
              if (!row.updatedAt) {
                await cursor.update({ ...row, updatedAt: when(row) } as never);
              }
              cursor = await cursor.continue();
            }
          };
          // All four walks are started in the same tick, on purpose. An
          // upgrade transaction commits itself the moment the microtask queue
          // drains with no request outstanding, so running them one after the
          // other would leave a gap between the first finishing and the second
          // opening its cursor — and the second would find the transaction
          // already closed.
          void Promise.all([
            backfill('sessions', (r) => Number(r.startedAt) || Date.now()),
            backfill('grades', (r) => Number(r.date) || Date.now()),
            // A lesson slot has no date of its own; it has always just been
            // there, so the migration itself is the only honest answer.
            backfill('schedule', () => Date.now()),
            backfill('bookmarks', (r) => Number(r.createdAt) || Date.now()),
          ]);
        }

        /* ------------------------------------------------------- v7 */

        /**
         * Goals are gone, and so is the store they lived in.
         *
         * Leaving it behind would be tidier to write and worse to live with: a
         * store nothing reads is a store that still holds somebody's records,
         * still counts against the origin's quota, and still turns up in an
         * export. Dropping it is the honest version of removing the feature.
         */
        // Cast: `goals` is deliberately absent from `StudyDB` now, and the
        // typed helper only knows the stores that still exist.
        const legacy = db as unknown as IDBDatabase;
        if (legacy.objectStoreNames.contains('goals')) legacy.deleteObjectStore('goals');

        /* ------------------------------------------------------- v8 */

        /**
         * Every card gets a deck, and the deck is one you would have chosen.
         *
         * A card could exist with no deck at all — restored from a v1 archive,
         * or pulled from the cloud before the repository learned to check.
         * Putting all of them in one bucket would be correct and useless, so a
         * card that knows its subject is filed under the subject's name and
         * only the genuinely unattached ones share a drawer.
         *
         * Started in this tick like everything else in this block: the upgrade
         * transaction commits the moment the microtask queue drains with no
         * request outstanding, and each step here is chained off the last one's
         * fulfilment, which keeps it open.
         */
        if (oldVersion > 0 && oldVersion < 8 && db.objectStoreNames.contains('cards')) {
          void (async () => {
            const bg = (() => {
              try {
                return localStorage.getItem('plauvia.lang') !== 'en';
              } catch {
                return true;
              }
            })();
            const loose = bg ? 'Несортирани' : 'Unsorted';

            const subjects = (await tx.objectStore('subjects').getAll()) as { id: string; name: string }[];
            const nameOf = new Map(subjects.map((x) => [x.id, x.name]));

            const store = tx.objectStore('cards');
            let cursor = await store.openCursor();
            while (cursor) {
              const card = cursor.value as unknown as Record<string, unknown>;
              const deck = typeof card.deck === 'string' ? card.deck.trim() : '';
              if (!deck) {
                const subject = nameOf.get(String(card.subjectId ?? ''));
                await cursor.update({ ...card, deck: subject || loose } as never);
              }
              cursor = await cursor.continue();
            }
          })();
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
