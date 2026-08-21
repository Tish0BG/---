import { create } from 'zustand';
import type { BoardConfig, DocumentMeta, Folder, StudyStatus } from '@/types';
import { repo } from '@/services/storageService';
import { probeDocument } from '@/services/pdfService';
import { uid } from '@/lib/util';

/** Shared skeleton so PDFs and boards agree on every study-tracking field. */
function blankDocument(name: string, folderId: string | null, order: number): DocumentMeta {
  const now = Date.now();
  return {
    id: uid('dc_'),
    name,
    kind: 'pdf',
    folderId,
    pageCount: 1,
    size: 0,
    createdAt: now,
    updatedAt: now,
    openedAt: null,
    lastPage: 1,
    zoom: 1,
    fitMode: 'width',
    scrollRatio: 0,
    status: 'not_started',
    maxPageVisited: 0,
    manualProgress: null,
    annotationCount: 0,
    cover: null,
    board: null,
    order,
  };
}

export interface ImportProgress {
  total: number;
  done: number;
  current: string;
}

interface LibraryStore {
  folders: Folder[];
  documents: DocumentMeta[];
  loaded: boolean;
  /** folder currently shown in the library view; null = root */
  activeFolderId: string | null;
  expanded: Record<string, boolean>;
  query: string;
  importing: ImportProgress | null;

  init(): Promise<void>;
  setActiveFolder(id: string | null): void;
  toggleExpanded(id: string): void;
  setQuery(q: string): void;

  createFolder(name: string, parentId: string | null): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  moveFolder(id: string, parentId: string | null): Promise<void>;

  importFiles(files: File[], folderId: string | null): Promise<string[]>;
  createBoard(name: string, config: BoardConfig, folderId: string | null): Promise<string>;
  renameDocument(id: string, name: string): Promise<void>;
  /** moves to the bin; the bytes stay until the bin is emptied */
  deleteDocument(id: string): Promise<void>;
  restoreDocument(id: string): Promise<void>;
  /** irreversible: drops the file, annotations and assets */
  purgeDocuments(ids: string[]): Promise<void>;
  emptyTrash(): Promise<void>;
  moveDocument(id: string, folderId: string | null): Promise<void>;
  setSubject(ids: string[], subjectId: string | null): Promise<void>;
  toggleStar(id: string): Promise<void>;
  setStatus(id: string, status: StudyStatus): Promise<void>;
  setManualProgress(id: string, progress: number | null): Promise<void>;
  /** merges a fresh copy of a document record into the list (after viewer saves) */
  syncDocument(doc: DocumentMeta): void;
}

export const useLibrary = create<LibraryStore>((set, get) => ({
  folders: [],
  documents: [],
  loaded: false,
  activeFolderId: null,
  expanded: {},
  query: '',
  importing: null,

  async init() {
    const [folders, documents] = await Promise.all([repo.listFolders(), repo.listDocuments()]);
    set({ folders, documents, loaded: true });
  },

  setActiveFolder(id) {
    set({ activeFolderId: id });
  },
  toggleExpanded(id) {
    set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } }));
  },
  setQuery(q) {
    set({ query: q });
  },

  async createFolder(name, parentId) {
    const now = Date.now();
    const siblings = get().folders.filter((f) => f.parentId === parentId);
    const folder: Folder = {
      id: uid('fd_'),
      name: name.trim() || 'Нова папка',
      parentId,
      createdAt: now,
      updatedAt: now,
      order: siblings.length,
    };
    await repo.putFolder(folder);
    set((s) => ({
      folders: [...s.folders, folder],
      expanded: parentId ? { ...s.expanded, [parentId]: true } : s.expanded,
    }));
    return folder;
  },

  async renameFolder(id, name) {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) return;
    const next = { ...folder, name: name.trim() || folder.name, updatedAt: Date.now() };
    await repo.putFolder(next);
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? next : f)) }));
  },

  /** Deletes a folder subtree; documents inside move up to the parent. */
  async deleteFolder(id) {
    const { folders, documents } = get();
    const doomed = new Set<string>();
    const collect = (fid: string) => {
      doomed.add(fid);
      folders.filter((f) => f.parentId === fid).forEach((f) => collect(f.id));
    };
    collect(id);
    const parentId = folders.find((f) => f.id === id)?.parentId ?? null;

    const moved: DocumentMeta[] = [];
    for (const d of documents) {
      if (d.folderId && doomed.has(d.folderId)) {
        const next = { ...d, folderId: parentId, updatedAt: Date.now() };
        await repo.putDocument(next);
        moved.push(next);
      }
    }
    for (const fid of doomed) await repo.deleteFolder(fid);

    set((s) => ({
      folders: s.folders.filter((f) => !doomed.has(f.id)),
      documents: s.documents.map((d) => moved.find((m) => m.id === d.id) ?? d),
      activeFolderId: doomed.has(s.activeFolderId ?? '') ? parentId : s.activeFolderId,
    }));
  },

  async moveFolder(id, parentId) {
    // guard against dropping a folder into its own subtree
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === id) return;
      cursor = get().folders.find((f) => f.id === cursor)?.parentId ?? null;
    }
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) return;
    const next = { ...folder, parentId, updatedAt: Date.now() };
    await repo.putFolder(next);
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? next : f)) }));
  },

  async importFiles(files, folderId) {
    const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) return [];
    const ids: string[] = [];
    set({ importing: { total: pdfs.length, done: 0, current: pdfs[0].name } });

    for (const [i, file] of pdfs.entries()) {
      set({ importing: { total: pdfs.length, done: i, current: file.name } });
      try {
        const bytes = await file.arrayBuffer();
        const { pageCount } = await probeDocument(bytes);
        const doc: DocumentMeta = {
          ...blankDocument(file.name.replace(/\.pdf$/i, ''), folderId, get().documents.length + i),
          pageCount,
          size: file.size,
        };
        await repo.putFile(doc.id, bytes);
        await repo.putDocument(doc);
        set((s) => ({ documents: [...s.documents, doc] }));
        ids.push(doc.id);
      } catch (err) {
        console.error('Импортът се провали за', file.name, err);
      }
    }
    set({ importing: null });
    return ids;
  },

  /** A whiteboard is a document with generated paper instead of PDF bytes. */
  async createBoard(name, config, folderId) {
    const doc: DocumentMeta = {
      ...blankDocument(name.trim() || 'Нова дъска', folderId, get().documents.length),
      kind: 'board',
      pageCount: config.pages.length,
      board: config,
    };
    await repo.putDocument(doc);
    set((s) => ({ documents: [...s.documents, doc] }));
    return doc.id;
  },

  async renameDocument(id, name) {
    const doc = await repo.patchDocument(id, { name: name.trim() || 'Без име' });
    if (doc) get().syncDocument(doc);
  },

  /**
   * Deleting is reversible on purpose: a student who loses a term of notes to
   * a misclick has lost something that only exists in this browser.
   */
  async deleteDocument(id) {
    const doc = await repo.patchDocument(id, { deletedAt: Date.now() });
    if (doc) get().syncDocument(doc);
  },

  async restoreDocument(id) {
    const doc = await repo.patchDocument(id, { deletedAt: null });
    if (doc) get().syncDocument(doc);
  },

  async purgeDocuments(ids) {
    for (const id of ids) await repo.deleteDocument(id);
    const gone = new Set(ids);
    set((s) => ({ documents: s.documents.filter((d) => !gone.has(d.id)) }));
  },

  async emptyTrash() {
    await get().purgeDocuments(get().documents.filter((d) => d.deletedAt).map((d) => d.id));
  },

  async setSubject(ids, subjectId) {
    for (const id of ids) {
      const doc = await repo.patchDocument(id, { subjectId });
      if (doc) get().syncDocument(doc);
    }
  },

  async toggleStar(id) {
    const current = get().documents.find((d) => d.id === id);
    const doc = await repo.patchDocument(id, { starred: !current?.starred });
    if (doc) get().syncDocument(doc);
  },

  async moveDocument(id, folderId) {
    const doc = await repo.patchDocument(id, { folderId });
    if (doc) get().syncDocument(doc);
  },

  async setStatus(id, status) {
    const doc = await repo.patchDocument(id, { status });
    if (doc) get().syncDocument(doc);
  },

  async setManualProgress(id, progress) {
    const doc = await repo.patchDocument(id, { manualProgress: progress });
    if (doc) get().syncDocument(doc);
  },

  syncDocument(doc) {
    set((s) => ({ documents: s.documents.map((d) => (d.id === doc.id ? doc : d)) }));
  },
}));

/* --------------------------------------------------------------- selectors */

export const inTrash = (d: DocumentMeta): boolean => !!d.deletedAt;
export const isLive = (d: DocumentMeta): boolean => !d.deletedAt;

export const progressOf = (d: DocumentMeta): number => {
  if (d.manualProgress != null) return d.manualProgress;
  if (!d.pageCount) return 0;
  return Math.min(1, d.maxPageVisited / d.pageCount);
};

export const folderPath = (folders: Folder[], id: string | null): Folder[] => {
  const path: Folder[] = [];
  let cursor = id;
  while (cursor) {
    const f = folders.find((x) => x.id === cursor);
    if (!f) break;
    path.unshift(f);
    cursor = f.parentId;
  }
  return path;
};

/** Recursively collects documents in a folder and its children. */
export const documentsInTree = (
  folders: Folder[],
  documents: DocumentMeta[],
  folderId: string | null,
): DocumentMeta[] => {
  const ids = new Set<string | null>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId !== null && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return documents.filter((d) => ids.has(d.folderId));
};
