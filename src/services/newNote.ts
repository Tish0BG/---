import { useLibrary } from '@/state/libraryStore';
import { openDoc } from './openDoc';
import { tr, L } from '@/i18n';

/**
 * A new written document, made and opened in one gesture.
 *
 * Named after the day rather than left as "Untitled": a library of six
 * documents all called the same thing is a library you stop opening.
 *
 * It lived on the top bar until the top bar was removed. Five unrelated
 * screens imported it from there, which is how a component file quietly
 * becomes a utility module — so it is a service now, where it always
 * belonged.
 */
export async function newNote(folderId: string | null = null): Promise<void> {
  const name = tr(L('Нов документ', 'New document'));
  const id = await useLibrary.getState().createNote(name, folderId);
  await openDoc(id);
}
