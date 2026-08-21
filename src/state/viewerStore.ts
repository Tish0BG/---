import { create } from 'zustand';
import type {
  Annotation,
  BoardConfig,
  Bookmark,
  DocumentMeta,
  FitMode,
  PaperTemplate,
  ProblemStatus,
  SaveStatus,
  ToolId,
} from '@/types';
import { PdfSession, type PageSize } from '@/services/pdfService';
import type { PageSource } from '@/services/pageSource';
import {
  BoardSession,
  SCROLL_GROW_BY,
  SCROLL_GROW_MARGIN,
  makeBoardConfig,
} from '@/services/boardService';
import { repo } from '@/services/storageService';
import { fetchDocumentFile } from '@/services/cloud/syncService';
import { cacheImage, clearImageCache, drawPage } from '@/services/renderService';
import { annotationBounds } from '@/lib/util';
import { useLibrary } from './libraryStore';
import { useSettings } from './settingsStore';
import { clamp, debounce, uid } from '@/lib/util';

/**
 * An undoable change. Every edit is expressed as "these went away, those
 * appeared" — a move or a style change is simply the old objects removed and
 * the new ones added, which keeps undo/redo to a single code path.
 */
export interface AnnotationOp {
  added: Annotation[];
  removed: Annotation[];
  label?: string;
}

const UNDO_LIMIT = 300;

/** Writes queued between autosave flushes. */
const pending = {
  upserts: new Map<string, Annotation>(),
  deletes: new Set<string>(),
};

export interface SearchHit {
  page: number;
  snippet: string;
  rect: { x: number; y: number; w: number; h: number };
}

interface ViewerStore {
  /* document */
  docId: string | null;
  meta: DocumentMeta | null;
  session: PageSource | null;
  loadState: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** what the loading overlay says while a document opens */
  loadLabel: string | null;

  /* view */
  pageCount: number;
  currentPage: number;
  zoom: number;
  fitMode: FitMode;
  /** bumped whenever page sizes are learned, so the layout recalculates */
  sizesVersion: number;
  /** requested scroll target consumed by the viewer component */
  scrollRequest: { page: number; ratio?: number; token: number } | null;

  /* content */
  pages: Map<number, Annotation[]>;
  bookmarks: Bookmark[];
  saveStatus: SaveStatus;

  /* editing */
  tool: ToolId;
  selectedIds: string[];
  editingTextId: string | null;
  undoStack: AnnotationOp[];
  redoStack: AnnotationOp[];

  /* search */
  search: { query: string; hits: SearchHit[]; busy: boolean; activeIndex: number };

  /* actions */
  openDocument(docId: string): Promise<void>;
  closeDocument(): Promise<void>;
  setTool(tool: ToolId): void;
  setSelection(ids: string[]): void;
  setEditingText(id: string | null): void;

  goToPage(page: number, ratio?: number): void;
  setCurrentPage(page: number): void;
  setZoom(zoom: number, fitMode?: FitMode): void;
  setFitMode(mode: FitMode): void;
  ensureSizes(from: number, to: number): Promise<void>;
  pageSize(page: number): PageSize;

  annotationsFor(page: number): Annotation[];
  findAnnotation(id: string): Annotation | undefined;
  commit(op: AnnotationOp): void;
  addAnnotations(anns: Annotation[]): void;
  removeAnnotations(anns: Annotation[]): void;
  replaceAnnotations(before: Annotation[], after: Annotation[]): void;
  undo(): void;
  redo(): void;
  clearPage(page: number): void;

  /* whiteboard page management (no-ops on PDF documents) */
  isBoard(): boolean;
  boardConfig(): BoardConfig | null;
  addBoardPage(after?: number): Promise<void>;
  duplicateBoardPage(page: number): Promise<void>;
  deleteBoardPage(page: number): Promise<void>;
  moveBoardPage(page: number, delta: number): Promise<void>;
  setBoardTemplate(template: PaperTemplate, page?: number): Promise<void>;
  setBoardPaper(color: string | null): Promise<void>;
  extendBoardPage(page: number, by?: number): Promise<void>;

  toggleBookmark(page: number, label?: string): Promise<void>;
  removeBookmark(id: string): Promise<void>;
  setRegionStatus(id: string, status: ProblemStatus): void;

  runSearch(query: string): Promise<void>;
  setActiveHit(index: number): void;
  clearSearch(): void;

  flushNow(): Promise<void>;
}

let scrollToken = 0;

export const useViewer = create<ViewerStore>((set, get) => {
  /* ---------------------------------------------------------- autosave */

  const saveAnnotations = async () => {
    if (!pending.upserts.size && !pending.deletes.size) return;
    const upserts = [...pending.upserts.values()];
    const deletes = [...pending.deletes];
    pending.upserts.clear();
    pending.deletes.clear();
    set({ saveStatus: 'saving' });
    try {
      await repo.saveAnnotations(upserts, deletes);
      const { docId, pages } = get();
      if (docId) {
        let count = 0;
        pages.forEach((list) => (count += list.length));
        const doc = await repo.patchDocument(docId, { annotationCount: count });
        if (doc) {
          useLibrary.getState().syncDocument(doc);
          set({ meta: doc });
        }
      }
      set({ saveStatus: pending.upserts.size || pending.deletes.size ? 'unsaved' : 'saved' });
    } catch (err) {
      console.error('Autosave failed', err);
      // put the batch back so the next flush retries it
      for (const a of upserts) pending.upserts.set(a.id, a);
      for (const id of deletes) pending.deletes.add(id);
      set({ saveStatus: 'error' });
    }
  };
  const flushAnnotations = debounce(saveAnnotations, 600);

  const saveViewState = async () => {
    const { docId, currentPage, zoom, fitMode, meta } = get();
    if (!docId || !meta) return;
    const maxPageVisited = Math.max(meta.maxPageVisited, currentPage);
    const doc = await repo.patchDocument(docId, {
      lastPage: currentPage,
      zoom,
      fitMode,
      maxPageVisited,
      status: meta.status === 'not_started' ? 'in_progress' : meta.status,
    });
    if (doc) {
      set({ meta: doc });
      useLibrary.getState().syncDocument(doc);
    }
  };
  const flushViewState = debounce(saveViewState, 900);

  const markDirty = (op: AnnotationOp) => {
    for (const a of op.removed) {
      pending.upserts.delete(a.id);
      pending.deletes.add(a.id);
    }
    for (const a of op.added) {
      pending.deletes.delete(a.id);
      pending.upserts.set(a.id, a);
    }
    set({ saveStatus: 'unsaved' });
    flushAnnotations();
  };

  /** Applies an op to the in-memory page map with structural sharing. */
  const applyOp = (op: AnnotationOp) => {
    const pages = new Map(get().pages);
    const touched = new Set<number>();
    for (const a of op.removed) touched.add(a.page);
    for (const a of op.added) touched.add(a.page);

    for (const page of touched) {
      const removedIds = new Set(op.removed.filter((a) => a.page === page).map((a) => a.id));
      const additions = op.added.filter((a) => a.page === page);
      const base = pages.get(page) ?? [];
      const next = removedIds.size ? base.filter((a) => !removedIds.has(a.id)) : base.slice();
      next.push(...additions);
      pages.set(page, next);
    }
    set({ pages });
  };

  /* ------------------------------------------------------ board pages */

  /** Writes a changed board layout to disk and refreshes the session. */
  const persistBoard = async (cfg: BoardConfig) => {
    const { docId, session } = get();
    if (!docId || !(session instanceof BoardSession)) return;
    session.config = cfg;
    set({ pageCount: cfg.pages.length, sizesVersion: get().sizesVersion + 1 });
    const doc = await repo.patchDocument(docId, { board: cfg, pageCount: cfg.pages.length });
    if (doc) {
      set({ meta: doc });
      useLibrary.getState().syncDocument(doc);
    }
  };

  /**
   * Re-homes annotations after pages are inserted, removed or reordered.
   * `moveTo` returns the new page number, or null to drop the page's content.
   * Structural page edits are written straight through (not undoable) —
   * an undo entry that referred to a page number that no longer means the
   * same thing would silently corrupt the document.
   */
  const renumberPages = async (moveTo: (page: number) => number | null) => {
    // Land any queued edits first: a pending write still carries the old page
    // number and would resurrect an annotation on the wrong sheet.
    flushAnnotations.cancel();
    await saveAnnotations();
    const now = Date.now();
    const next = new Map<number, Annotation[]>();
    const upserts: Annotation[] = [];
    const deletes: string[] = [];
    for (const [page, list] of get().pages) {
      const target = moveTo(page);
      if (target === null) {
        for (const a of list) deletes.push(a.id);
        continue;
      }
      const moved =
        target === page ? list : list.map((a) => ({ ...a, page: target, updatedAt: now }) as Annotation);
      if (target !== page) upserts.push(...moved);
      const existing = next.get(target);
      next.set(target, existing ? [...existing, ...moved] : moved);
    }
    set({ pages: next, undoStack: [], redoStack: [], selectedIds: [], editingTextId: null });
    for (const id of deletes) pending.upserts.delete(id);
    await repo.saveAnnotations(upserts, deletes);
  };

  return {
    docId: null,
    meta: null,
    session: null,
    loadState: 'idle',
    error: null,
    loadLabel: null,

    pageCount: 0,
    currentPage: 1,
    zoom: 1,
    fitMode: 'width',
    sizesVersion: 0,
    scrollRequest: null,

    pages: new Map(),
    bookmarks: [],
    saveStatus: 'saved',

    tool: useSettings.getState().lastTool,
    selectedIds: [],
    editingTextId: null,
    undoStack: [],
    redoStack: [],

    search: { query: '', hits: [], busy: false, activeIndex: -1 },

    /* ------------------------------------------------------- lifecycle */

    async openDocument(docId) {
      if (get().docId === docId && get().loadState === 'ready') return;
      await get().closeDocument();
      set({ loadState: 'loading', error: null, loadLabel: null, docId });

      try {
        const meta = await repo.getDocument(docId);
        if (!meta) throw new Error('Документът не е намерен в хранилището.');

        let session: PageSource;
        if (meta.kind === 'board') {
          // The board reads its text notes back out of the store, which is what
          // makes hand-typed notes searchable exactly like PDF text.
          const cfg = meta.board ?? makeBoardConfig('paged', 'blank');
          session = new BoardSession(cfg, (page) => get().pages.get(page) ?? []);
        } else {
          let bytes = await repo.getFile(docId);
          if (!bytes) {
            // Signed in on a new device: the record arrived with the sync but
            // the PDF itself is fetched only now, when it is actually needed.
            set({ loadLabel: 'Изтегляне на файла от профила…' });
            bytes = (await fetchDocumentFile(docId)) ?? undefined;
          }
          if (!bytes) throw new Error('Файлът на документа липсва в хранилището.');
          session = await PdfSession.open(bytes);
        }

        const [anns, bookmarks, assets] = await Promise.all([
          repo.listAnnotations(docId),
          repo.listBookmarks(docId),
          repo.listAssets(docId),
        ]);

        const pages = new Map<number, Annotation[]>();
        for (const a of anns) {
          const list = pages.get(a.page);
          if (list) list.push(a);
          else pages.set(a.page, [a]);
        }
        for (const list of pages.values()) list.sort((x, y) => x.createdAt - y.createdAt);

        for (const asset of assets) {
          try {
            cacheImage(asset.id, await createImageBitmap(asset.blob));
          } catch {
            /* unsupported image — it simply will not draw */
          }
        }

        set({
          meta,
          session,
          pageCount: session.pageCount,
          pages,
          bookmarks,
          loadState: 'ready',
          error: null,
          loadLabel: null,
          currentPage: clamp(meta.lastPage || 1, 1, session.pageCount),
          zoom: meta.zoom || 1,
          fitMode: meta.fitMode ?? 'width',
          undoStack: [],
          redoStack: [],
          selectedIds: [],
          saveStatus: 'saved',
          search: { query: '', hits: [], busy: false, activeIndex: -1 },
          scrollRequest: { page: clamp(meta.lastPage || 1, 1, session.pageCount), token: ++scrollToken },
        });

        useSettings.getState().set('lastDocId', docId);
        void get().ensureSizes(1, Math.min(session.pageCount, 60));

        const opened = await repo.patchDocument(docId, {
          openedAt: Date.now(),
          status: meta.status === 'not_started' ? 'in_progress' : meta.status,
        });
        if (opened) {
          set({ meta: opened });
          useLibrary.getState().syncDocument(opened);
        }
        if (!meta.cover) void generateCover(docId, session, get().pages.get(1) ?? []);
      } catch (err) {
        console.error(err);
        set({ loadState: 'error', error: err instanceof Error ? err.message : 'Неуспешно отваряне на PDF.' });
      }
    },

    async closeDocument() {
      flushAnnotations.flush();
      flushViewState.flush();
      await saveAnnotations();
      await saveViewState();
      const s = get();
      if (s.session && s.meta?.kind === 'board' && (s.pages.get(1)?.length ?? 0) > 0) {
        await generateCover(s.meta.id, s.session, s.pages.get(1) ?? []);
      }
      if (s.session) await s.session.destroy();
      clearImageCache();
      set({
        docId: null,
        meta: null,
        session: null,
        loadState: 'idle',
        pages: new Map(),
        bookmarks: [],
        undoStack: [],
        redoStack: [],
        selectedIds: [],
        editingTextId: null,
        pageCount: 0,
        search: { query: '', hits: [], busy: false, activeIndex: -1 },
      });
    },

    /* ------------------------------------------------------------ tools */

    setTool(tool) {
      set({ tool, selectedIds: tool === 'select' ? get().selectedIds : [], editingTextId: null });
      useSettings.getState().set('lastTool', tool);
    },
    setSelection(ids) {
      set({ selectedIds: ids });
    },
    setEditingText(id) {
      set({ editingTextId: id });
    },

    /* ------------------------------------------------------ navigation */

    goToPage(page, ratio) {
      const p = clamp(Math.round(page), 1, get().pageCount || 1);
      set({ currentPage: p, scrollRequest: { page: p, ratio, token: ++scrollToken } });
      flushViewState();
    },
    setCurrentPage(page) {
      if (page === get().currentPage) return;
      set({ currentPage: page });
      flushViewState();
    },
    setZoom(zoom, fitMode = 'none') {
      set({ zoom: clamp(zoom, 0.2, 6), fitMode });
      flushViewState();
    },
    setFitMode(mode) {
      set({ fitMode: mode });
      flushViewState();
    },

    async ensureSizes(from, to) {
      const { session, pageCount } = get();
      if (!session) return;
      let learned = false;
      for (let n = Math.max(1, from); n <= Math.min(to, pageCount); n++) {
        if (!session.knownSize(n)) {
          await session.getSize(n);
          learned = true;
        }
      }
      if (learned) set({ sizesVersion: get().sizesVersion + 1 });
    },
    pageSize(page) {
      const s = get().session;
      return s?.knownSize(page) ?? s?.defaultSize ?? FALLBACK_SIZE;
    },

    /* ----------------------------------------------------- annotations */

    annotationsFor(page) {
      return get().pages.get(page) ?? EMPTY;
    },
    findAnnotation(id) {
      for (const list of get().pages.values()) {
        const hit = list.find((a) => a.id === id);
        if (hit) return hit;
      }
      return undefined;
    },

    commit(op) {
      if (!op.added.length && !op.removed.length) return;
      applyOp(op);
      markDirty(op);
      growScrollBoard(op.added);
      const undoStack = [...get().undoStack];
      const last = undoStack[undoStack.length - 1];
      // Continuous gestures (erasing, dragging) share a label and collapse
      // into a single undo entry.
      if (op.label && last?.label === op.label) {
        undoStack[undoStack.length - 1] = mergeOps(last, op);
      } else {
        undoStack.push(op);
        if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      }
      set({ undoStack, redoStack: [] });
    },
    addAnnotations(anns) {
      get().commit({ added: anns, removed: [] });
    },
    removeAnnotations(anns) {
      get().commit({ added: [], removed: anns });
      const ids = new Set(anns.map((a) => a.id));
      const selectedIds = get().selectedIds.filter((id) => !ids.has(id));
      if (selectedIds.length !== get().selectedIds.length) set({ selectedIds });
    },
    replaceAnnotations(before, after) {
      get().commit({ added: after, removed: before });
    },

    undo() {
      const { undoStack, redoStack } = get();
      const op = undoStack[undoStack.length - 1];
      if (!op) return;
      const inverse: AnnotationOp = { added: op.removed, removed: op.added };
      applyOp(inverse);
      markDirty(inverse);
      set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, op], selectedIds: [] });
    },
    redo() {
      const { undoStack, redoStack } = get();
      const op = redoStack[redoStack.length - 1];
      if (!op) return;
      applyOp(op);
      markDirty(op);
      set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, op], selectedIds: [] });
    },
    clearPage(page) {
      const list = get().pages.get(page);
      if (list?.length) get().removeAnnotations(list);
    },

    /* ------------------------------------------------- whiteboard pages */

    isBoard() {
      return get().meta?.kind === 'board';
    },
    boardConfig() {
      const s = get().session;
      return s instanceof BoardSession ? s.config : null;
    },

    async addBoardPage(after) {
      const cfg = get().boardConfig();
      if (!cfg || cfg.flow === 'scroll') return;
      const at = clamp(after ?? get().currentPage, 1, cfg.pages.length);
      const model = cfg.pages[at - 1];
      const pages = [...cfg.pages];
      pages.splice(at, 0, { w: model.w, h: model.h, template: model.template });
      await renumberPages((p) => (p > at ? p + 1 : p));
      await persistBoard({ ...cfg, pages });
      get().goToPage(at + 1);
    },

    async duplicateBoardPage(page) {
      const cfg = get().boardConfig();
      if (!cfg || cfg.flow === 'scroll') return;
      const at = clamp(page, 1, cfg.pages.length);
      const source = get().pages.get(at) ?? [];
      const pages = [...cfg.pages];
      pages.splice(at, 0, { ...cfg.pages[at - 1] });
      await renumberPages((p) => (p > at ? p + 1 : p));
      await persistBoard({ ...cfg, pages });
      const now = Date.now();
      const copies = source.map((a) => ({ ...a, id: uid('an_'), page: at + 1, createdAt: now, updatedAt: now }));
      if (copies.length) {
        const map = new Map(get().pages);
        map.set(at + 1, copies);
        set({ pages: map, undoStack: [], redoStack: [] });
        await repo.saveAnnotations(copies, []);
      }
      get().goToPage(at + 1);
    },

    async deleteBoardPage(page) {
      const cfg = get().boardConfig();
      if (!cfg || cfg.flow === 'scroll' || cfg.pages.length <= 1) return;
      const at = clamp(page, 1, cfg.pages.length);
      const pages = cfg.pages.filter((_, i) => i !== at - 1);
      await renumberPages((p) => (p === at ? null : p > at ? p - 1 : p));
      await persistBoard({ ...cfg, pages });
      get().goToPage(Math.min(at, pages.length));
    },

    async moveBoardPage(page, delta) {
      const cfg = get().boardConfig();
      if (!cfg || cfg.flow === 'scroll') return;
      const from = clamp(page, 1, cfg.pages.length);
      const to = from + delta;
      if (to < 1 || to > cfg.pages.length) return;
      const pages = [...cfg.pages];
      const [moved] = pages.splice(from - 1, 1);
      pages.splice(to - 1, 0, moved);
      await renumberPages((p) => (p === from ? to : p === to ? from : p));
      await persistBoard({ ...cfg, pages });
      get().goToPage(to);
    },

    /** No page argument = change the paper of the whole board. */
    async setBoardTemplate(template, page) {
      const cfg = get().boardConfig();
      if (!cfg) return;
      if (page === undefined) {
        await persistBoard({ ...cfg, template, pages: cfg.pages.map((p) => ({ ...p, template: undefined })) });
        return;
      }
      const pages = cfg.pages.map((p, i) => (i === page - 1 ? { ...p, template } : p));
      await persistBoard({ ...cfg, pages });
    },

    async setBoardPaper(color) {
      const cfg = get().boardConfig();
      if (cfg) await persistBoard({ ...cfg, paper: color });
    },

    async extendBoardPage(page, by = SCROLL_GROW_BY) {
      const cfg = get().boardConfig();
      if (!cfg) return;
      const idx = clamp(page, 1, cfg.pages.length) - 1;
      const pages = cfg.pages.map((p, i) => (i === idx ? { ...p, h: p.h + by } : p));
      await persistBoard({ ...cfg, pages });
    },

    /* ------------------------------------------------------- bookmarks */

    async toggleBookmark(page, label) {
      const { docId, bookmarks } = get();
      if (!docId) return;
      const existing = bookmarks.find((b) => b.page === page);
      if (existing && label === undefined) {
        await repo.deleteBookmark(existing.id);
        set({ bookmarks: bookmarks.filter((b) => b.id !== existing.id) });
        return;
      }
      const bm: Bookmark = existing
        ? { ...existing, label: label ?? existing.label }
        : { id: uid('bm_'), docId, page, label: label || `Страница ${page}`, createdAt: Date.now() };
      await repo.putBookmark(bm);
      set({
        bookmarks: existing
          ? bookmarks.map((b) => (b.id === bm.id ? bm : b))
          : [...bookmarks, bm].sort((a, b) => a.page - b.page),
      });
    },
    async removeBookmark(id) {
      await repo.deleteBookmark(id);
      set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) });
    },

    setRegionStatus(id, status) {
      const a = get().findAnnotation(id);
      if (!a || a.type !== 'region') return;
      get().replaceAnnotations([a], [{ ...a, status, updatedAt: Date.now() }]);
    },

    /* ---------------------------------------------------------- search */

    async runSearch(query) {
      const { session, pageCount } = get();
      const q = query.trim();
      if (!session || q.length < 2) {
        set({ search: { query, hits: [], busy: false, activeIndex: -1 } });
        return;
      }
      set({ search: { query, hits: [], busy: true, activeIndex: -1 } });
      const hits: SearchHit[] = [];
      for (let n = 1; n <= pageCount; n++) {
        if (get().search.query !== query) return; // superseded
        const text = await session.getText(n);
        if (!text.toLowerCase().includes(q.toLowerCase())) continue;
        const found = await session.findOnPage(n, q);
        for (const f of found) hits.push({ page: n, snippet: f.snippet, rect: f.rect });
        if (hits.length > 300) break;
      }
      if (get().search.query !== query) return;
      set({ search: { query, hits, busy: false, activeIndex: hits.length ? 0 : -1 } });
      if (hits.length) get().goToPage(hits[0].page);
    },
    setActiveHit(index) {
      const { search } = get();
      if (!search.hits.length) return;
      const i = (index + search.hits.length) % search.hits.length;
      set({ search: { ...search, activeIndex: i } });
      get().goToPage(search.hits[i].page);
    },
    clearSearch() {
      set({ search: { query: '', hits: [], busy: false, activeIndex: -1 } });
    },

    async flushNow() {
      flushAnnotations.cancel();
      flushViewState.cancel();
      await saveAnnotations();
      await saveViewState();
    },
  };
});

const EMPTY: Annotation[] = [];
/** Shared so `pageSize` never hands React a new object it must re-render for. */
const FALLBACK_SIZE: PageSize = { width: 612, height: 792 };

/** Folds a follow-up op of the same gesture into the previous one. */
function mergeOps(a: AnnotationOp, b: AnnotationOp): AnnotationOp {
  const added = new Map(a.added.map((x) => [x.id, x]));
  const removed = [...a.removed];
  for (const r of b.removed) {
    if (added.has(r.id)) added.delete(r.id);
    else removed.push(r);
  }
  for (const x of b.added) added.set(x.id, x);
  return { added: [...added.values()], removed, label: b.label };
}

/**
 * Renders a small page-1 preview for the library grid. Boards get their ink
 * painted on top, otherwise every notebook would show the same blank sheet.
 */
async function generateCover(docId: string, session: PageSource, ink: Annotation[]): Promise<void> {
  try {
    const canvas = document.createElement('canvas');
    const size = await session.getSize(1);
    const scale = 220 / size.width;
    await session.render(`cover-${docId}`, 1, canvas, scale);
    if (ink.length) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawPage(ctx, ink, scale, { pressure: true });
      }
    }
    const cover = canvas.toDataURL('image/jpeg', 0.6);
    const doc = await repo.patchDocument(docId, { cover });
    if (doc) {
      useLibrary.getState().syncDocument(doc);
      if (useViewer.getState().docId === docId) useViewer.setState({ meta: doc });
    }
  } catch {
    /* cover is cosmetic */
  }
}

/**
 * A scrolling board is one endless sheet: as soon as ink lands near the
 * bottom the page grows, so there is never a wall to bump into.
 */
function growScrollBoard(added: Annotation[]): void {
  if (!added.length) return;
  const store = useViewer.getState();
  const cfg = store.boardConfig();
  if (!cfg || cfg.flow !== 'scroll') return;
  const page = cfg.pages[0];
  let lowest = 0;
  for (const a of added) {
    const b = annotationBounds(a);
    if (b.y + b.h > lowest) lowest = b.y + b.h;
  }
  if (lowest > page.h - SCROLL_GROW_MARGIN) {
    void store.extendBoardPage(1, Math.max(SCROLL_GROW_BY, lowest + SCROLL_GROW_MARGIN - page.h));
  }
}

/** Persist immediately when the tab is hidden or closed. */
export function installAutosaveGuards(): () => void {
  const onHide = () => {
    if (document.visibilityState === 'hidden') void useViewer.getState().flushNow();
  };
  const onPageHide = () => void useViewer.getState().flushNow();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
  };
}
