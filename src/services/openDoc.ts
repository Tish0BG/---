import { useLibrary } from '@/state/libraryStore';
import { useNotes } from '@/state/noteStore';
import { useViewer } from '@/state/viewerStore';
import { repo } from '@/services/storageService';

/**
 * "Open this thing", for every kind of thing the library holds.
 *
 * Three kinds now share one list, and every row, search hit, task and
 * flashcard that points at a document is entitled to say only "open it"
 * rather than to know which of the two workspaces it belongs in. This is that
 * one sentence — the only place in the app that has to care.
 */
export async function openDoc(id: string): Promise<void> {
  const known = useLibrary.getState().documents.find((d) => d.id === id);
  // The list is loaded at start-up, so `known` covers everything except a
  // link followed before the library has finished opening.
  const kind = known?.kind ?? (await repo.getDocument(id))?.kind;

  if (kind === 'note') {
    await useViewer.getState().closeDocument();
    await useNotes.getState().open(id);
    return;
  }
  await useNotes.getState().close();
  await useViewer.getState().openDocument(id);
}
