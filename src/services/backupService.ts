import type {
  Annotation,
  Bookmark,
  ClassSlot,
  DocumentMeta,
  FlashCard,
  FocusSession,
  Folder,
  Grade,
  PlannerItem,
  Profile,
  Subject,
} from '@/types';
import { repo } from './storageService';
import { tr, L } from '@/i18n';

/**
 * A backup is one self-describing file:
 *
 *   "SPDFBAK1" | uint32 manifest length | manifest JSON | blob bytes …
 *
 * Records live in the JSON; the PDFs and images follow as one contiguous run
 * described by the manifest's `blobs` table. Reading uses File.slice, so a
 * 2 GB library is restored without ever being held in memory at once — and the
 * format needs no zip library, which keeps the app dependency-free and offline.
 */
const MAGIC = 'SPDFBAK1';
const HEADER = MAGIC.length + 4;

interface BlobEntry {
  /** `file:<docId>` for original PDFs, `asset:<assetId>` for images */
  key: string;
  type: string;
  size: number;
  /** assets only */
  docId?: string;
  width?: number;
  height?: number;
}

interface Manifest {
  /** 1 = pre-workspace archives, still restorable */
  version: 1 | 2;
  createdAt: number;
  folders: Folder[];
  documents: DocumentMeta[];
  annotations: Annotation[];
  bookmarks: Bookmark[];
  cards: FlashCard[];
  sessions: FocusSession[];
  subjects: Subject[];
  planner: PlannerItem[];
  grades: Grade[];
  schedule: ClassSlot[];
  profile: Profile | null;
  settings: string | null;
  blobs: BlobEntry[];
  /** v1 field, read on restore for backwards compatibility */
  tasks?: { id: string; text: string; done: boolean; pomodoros: number; docId: string | null; createdAt: number; order: number }[];
}

export interface BackupSummary {
  documents: number;
  boards: number;
  annotations: number;
  cards: number;
  subjects: number;
  planner: number;
  createdAt: number;
  bytes: number;
}

/* ------------------------------------------------------------------ export */

export async function createBackup(onProgress?: (label: string) => void): Promise<Blob> {
  onProgress?.(tr(L('Събиране на записите…', 'Collecting the records…')));
  const [folders, documents, cards, sessions, subjects, planner, grades, schedule, profile] =
    await Promise.all([
      repo.listFolders(),
      repo.listDocuments(),
      repo.listCards(),
      repo.listSessions(),
      repo.listSubjects(),
      repo.listPlanner(),
      repo.listGrades(),
      repo.listSchedule(),
      repo.getMeta<Profile>('profile'),
    ]);

  const annotations: Annotation[] = [];
  const bookmarks: Bookmark[] = [];
  const blobs: BlobEntry[] = [];
  const parts: BlobPart[] = [];

  for (const [i, doc] of documents.entries()) {
    onProgress?.(`${doc.name} (${i + 1}/${documents.length})`);
    annotations.push(...(await repo.listAnnotations(doc.id)));
    bookmarks.push(...(await repo.listBookmarks(doc.id)));

    if (doc.kind !== 'board') {
      const bytes = await repo.getFile(doc.id);
      if (bytes) {
        blobs.push({ key: `file:${doc.id}`, type: 'application/pdf', size: bytes.byteLength });
        parts.push(bytes);
      }
    }
    for (const asset of await repo.listAssets(doc.id)) {
      blobs.push({
        key: `asset:${asset.id}`,
        type: asset.blob.type || 'image/png',
        size: asset.blob.size,
        docId: asset.docId,
        width: asset.width,
        height: asset.height,
      });
      parts.push(asset.blob);
    }
  }

  // Flashcard images live outside any document and would otherwise be missed.
  for (const asset of await repo.listAssets('__cards__')) {
    blobs.push({
      key: `asset:${asset.id}`,
      type: asset.blob.type || 'image/png',
      size: asset.blob.size,
      docId: asset.docId,
      width: asset.width,
      height: asset.height,
    });
    parts.push(asset.blob);
  }

  const manifest: Manifest = {
    version: 2,
    createdAt: Date.now(),
    folders,
    documents,
    annotations,
    bookmarks,
    cards,
    sessions,
    subjects,
    planner,
    grades,
    schedule,
    profile: profile ?? null,
    settings: localStorage.getItem('studypdf.settings.v1'),
    blobs,
  };

  onProgress?.(tr(L('Записване на файла…', 'Writing the file…')));
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const header = new Uint8Array(HEADER);
  header.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(header.buffer).setUint32(MAGIC.length, json.byteLength, true);

  return new Blob([header, json, ...parts], { type: 'application/octet-stream' });
}

/* ------------------------------------------------------------------ import */

async function readManifest(file: File): Promise<{ manifest: Manifest; offset: number }> {
  const head = new Uint8Array(await file.slice(0, HEADER).arrayBuffer());
  if (new TextDecoder().decode(head.slice(0, MAGIC.length)) !== MAGIC) {
    throw new Error(tr(L('Това не е архив на Plauvia.', 'That is not a Plauvia backup.')));
  }
  const length = new DataView(head.buffer).getUint32(MAGIC.length, true);
  const json = await file.slice(HEADER, HEADER + length).text();
  return { manifest: JSON.parse(json) as Manifest, offset: HEADER + length };
}

/** Reads only the header, so the user can see what they are about to restore. */
export async function inspectBackup(file: File): Promise<BackupSummary> {
  const { manifest } = await readManifest(file);
  return {
    documents: manifest.documents.filter((d) => d.kind !== 'board').length,
    boards: manifest.documents.filter((d) => d.kind === 'board').length,
    annotations: manifest.annotations.length,
    cards: manifest.cards.length,
    subjects: (manifest.subjects ?? []).length,
    planner: (manifest.planner ?? []).length,
    createdAt: manifest.createdAt,
    bytes: file.size,
  };
}

export async function restoreBackup(
  file: File,
  mode: 'merge' | 'replace',
  onProgress?: (label: string) => void,
): Promise<void> {
  const { manifest, offset } = await readManifest(file);
  if (manifest.version > 2) throw new Error(tr(L('Архивът е от по-нова версия на приложението.', 'The backup comes from a newer version of the app.')));

  if (mode === 'replace') {
    onProgress?.(tr(L('Изчистване на текущата библиотека…', 'Clearing the current library…')));
    await repo.clearAll();
  }

  onProgress?.(tr(L('Възстановяване на записите…', 'Restoring the records…')));
  for (const f of manifest.folders) await repo.putFolder(f);
  for (const d of manifest.documents) await repo.putDocument({ ...d, kind: d.kind ?? 'pdf' });
  await repo.saveAnnotations(manifest.annotations, []);
  for (const b of manifest.bookmarks) await repo.putBookmark(b);
  await repo.putCards(manifest.cards ?? []);
  for (const s of manifest.subjects ?? []) await repo.putSubject(s);
  await repo.putPlanner(manifest.planner ?? []);
  for (const g of manifest.grades ?? []) await repo.putGrade(g);
  for (const c of manifest.schedule ?? []) await repo.putSlot(c);
  for (const s of manifest.sessions ?? []) await repo.putSession(s);
  if (manifest.profile) await repo.setMeta('profile', manifest.profile);

  // v1 archives kept tasks in their own store; fold them into the planner.
  for (const [i, t] of (manifest.tasks ?? []).entries()) {
    await repo.putPlanner([
      {
        id: t.id,
        kind: 'task',
        title: t.text,
        notes: '',
        subjectId: null,
        docId: t.docId ?? null,
        due: null,
        done: t.done,
        completedAt: null,
        priority: 0,
        pomodoros: t.pomodoros ?? 0,
        order: t.order ?? i,
        createdAt: t.createdAt,
        updatedAt: t.createdAt,
      },
    ]);
  }

  let cursor = offset;
  for (const [i, entry] of manifest.blobs.entries()) {
    const slice = file.slice(cursor, cursor + entry.size, entry.type);
    cursor += entry.size;
    onProgress?.(tr(L(`Файлове ${i + 1}/${manifest.blobs.length}`, `Files ${i + 1}/${manifest.blobs.length}`)));
    if (entry.key.startsWith('file:')) {
      await repo.putFile(entry.key.slice(5), await slice.arrayBuffer(), entry.type);
    } else {
      await repo.putAsset({
        id: entry.key.slice(6),
        docId: entry.docId ?? '',
        blob: slice,
        width: entry.width ?? 0,
        height: entry.height ?? 0,
      });
    }
  }

  if (mode === 'replace' && manifest.settings) {
    try {
      localStorage.setItem('studypdf.settings.v1', manifest.settings);
    } catch {
      /* settings are not worth failing the restore over */
    }
  }
}
