import { create } from 'zustand';
import type { DocumentMeta, NoteDoc, SaveStatus } from '@/types';
import { repo } from '@/services/storageService';
import { useLibrary } from './libraryStore';
import { useSettings } from './settingsStore';
import { linkedDocIds } from '@/components/note/richText';

/**
 * ──────────────────────────────────────────────────── written documents ──
 *
 * A note is the third thing the library can hold, beside an imported PDF and
 * a whiteboard. It has no pages, no ink and no renderer: it is a body of rich
 * text that lives on the document record itself, which is why it syncs,
 * appears in the bin, wears a subject and can be linked to a board without a
 * single new piece of machinery.
 *
 * It is kept out of `viewerStore` on purpose. That store is four hundred
 * lines of page geometry, annotation batching and undo stacks, none of which
 * a paragraph of text has any use for — and a note that had to pretend to be
 * a page would inherit every one of its assumptions.
 */

/** How long the editor may sit unsaved. Long enough not to fight typing. */
const AUTOSAVE_MS = 900;

interface NoteStore {
  docId: string | null;
  meta: DocumentMeta | null;
  /** the editor's body; the source of truth while a note is open */
  html: string;
  saveStatus: SaveStatus;
  loadState: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /**
   * Bumped whenever the body is replaced from outside the editor.
   *
   * The editor is uncontrolled — it has to be, or every keystroke would move
   * the caret — so it cannot notice `html` changing on its own. This is the
   * signal that says "the text under you is not the text you are holding any
   * more", and it is the only thing that makes the editor re-seed.
   */
  revision: number;
  /** the outline panel and the links panel share one drawer */
  panel: 'outline' | 'links' | null;

  open(id: string): Promise<void>;
  close(): Promise<void>;
  /** called on every keystroke; the write itself is debounced */
  setHtml(html: string): void;
  rename(name: string): Promise<void>;
  setPanel(panel: NoteStore['panel']): void;
  flushNow(): Promise<void>;
  /** re-reads the open document after records arrive from the cloud */
  refresh(): Promise<void>;
  /** ties this note to another document, from both sides */
  link(otherId: string): Promise<void>;
  unlink(otherId: string): Promise<void>;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Tags out, entities decoded, whitespace collapsed — for search and counts. */
export function plainText(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export const countWords = (text: string): number => (text ? text.split(/\s+/).length : 0);

export function noteOf(html: string): NoteDoc {
  const text = plainText(html);
  return { html, text, words: countWords(text) };
}

export const useNotes = create<NoteStore>((set, get) => {
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const write = async () => {
    cancel();
    const { docId, html } = get();
    if (!docId) return;
    set({ saveStatus: 'saving' });
    try {
      const note = noteOf(html);
      const doc = await repo.patchDocument(docId, {
        note,
        // The byte count the library shows for a note is the size of what was
        // actually written, so a drive that lists a 400 KB textbook beside a
        // two-line note says so.
        size: new Blob([html]).size,
        updatedAt: Date.now(),
      });
      if (doc) {
        useLibrary.getState().syncDocument(doc);
        set({ meta: doc });
        // A link typed into the body is still a link. Without this the chip
        // in the text would open the other document while the other document
        // knew nothing about this one.
        const declared = doc.links ?? [];
        for (const id of linkedDocIds(html)) {
          if (!declared.includes(id)) {
            const merged = await useLibrary.getState().linkDocuments(docId, id);
            if (merged) set({ meta: merged });
          }
        }
      }
      set({ saveStatus: 'saved' });
    } catch {
      set({ saveStatus: 'error' });
    }
  };

  return {
    docId: null,
    meta: null,
    html: '',
    saveStatus: 'saved',
    loadState: 'idle',
    error: null,
    revision: 0,
    panel: null,

    async open(id) {
      if (get().docId === id) return;
      await get().close();
      set({ docId: id, loadState: 'loading', error: null, panel: null });
      try {
        const meta = await repo.getDocument(id);
        if (!meta) throw new Error('missing');
        set({
          meta,
          html: meta.note?.html ?? '',
          loadState: 'ready',
          saveStatus: 'saved',
          revision: get().revision + 1,
        });
        // "Open what you had open" works for notes too.
        useSettings.getState().set('lastDocId', id);
        const opened = await repo.patchDocument(id, { openedAt: Date.now() });
        if (opened) useLibrary.getState().syncDocument(opened);
      } catch {
        set({ loadState: 'error', error: 'missing' });
      }
    },

    async close() {
      if (!get().docId) return;
      if (get().saveStatus !== 'saved') await write();
      cancel();
      useSettings.getState().set('lastDocId', null);
      set({ docId: null, meta: null, html: '', loadState: 'idle', panel: null, saveStatus: 'saved' });
    },

    setHtml(html) {
      if (html === get().html) return;
      set({ html, saveStatus: 'unsaved' });
      cancel();
      timer = setTimeout(() => void write(), AUTOSAVE_MS);
    },

    async rename(name) {
      const { docId } = get();
      if (!docId) return;
      await useLibrary.getState().renameDocument(docId, name);
      const meta = await repo.getDocument(docId);
      if (meta) set({ meta });
    },

    setPanel(panel) {
      set({ panel });
    },

    flushNow: write,

    /**
     * A newer copy arrived from another device while this one was open.
     *
     * Only taken when there is nothing unsaved here. Somebody mid-sentence is
     * the newer writer by definition, and replacing the paragraph under their
     * cursor with a version from an hour ago is the worst thing a sync can do
     * to a document. Their own save wins the merge a moment later.
     */
    async refresh() {
      const { docId, saveStatus } = get();
      if (!docId || saveStatus !== 'saved') return;
      const meta = await repo.getDocument(docId);
      if (!meta) return;
      const html = meta.note?.html ?? '';
      if (html === get().html) {
        set({ meta });
        return;
      }
      set({ meta, html, revision: get().revision + 1 });
    },

    async link(otherId) {
      const { docId } = get();
      if (!docId || otherId === docId) return;
      const meta = await useLibrary.getState().linkDocuments(docId, otherId);
      if (meta) set({ meta });
    },

    async unlink(otherId) {
      const { docId } = get();
      if (!docId) return;
      const meta = await useLibrary.getState().unlinkDocuments(docId, otherId);
      if (meta) set({ meta });
    },
  };
});

/**
 * The same guards the viewer has: a note being written is worth as much as a
 * page being drawn on, and a closed tab is the commonest way to lose either.
 */
export function installNoteGuards(): () => void {
  const onHide = () => {
    if (document.hidden && useNotes.getState().saveStatus !== 'saved') void useNotes.getState().flushNow();
  };
  const onUnload = (e: BeforeUnloadEvent) => {
    if (useNotes.getState().saveStatus === 'saved') return;
    void useNotes.getState().flushNow();
    e.preventDefault();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('beforeunload', onUnload);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('beforeunload', onUnload);
  };
}
