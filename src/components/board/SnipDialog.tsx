import { useState } from 'react';
import { useSnip } from '@/state/snipStore';
import { useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { appendToBoard, boardFromSnip } from '@/services/snipService';
import { downloadBlob } from '@/lib/util';
import { Modal, Toggle } from '../ui';
import { Icon } from '../Icon';
import type { CardDraft } from '../cards/CardEditor';
import { useT, L } from '@/i18n';

/**
 * What to do with the piece just cut out of a page: park it on a board to
 * solve next to it, turn it into a flashcard, or take it out of the app.
 */
export function SnipDialog({ onMakeCard }: { onMakeCard: (draft: CardDraft) => void }) {
  const t = useT();
  const snip = useSnip((s) => s.pending);
  const withInk = useSnip((s) => s.withInk);
  const busy = useSnip((s) => s.busy);
  const documents = useLibrary((s) => s.documents);
  const [working, setWorking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const boards = documents
    .filter((d) => d.kind === 'board')
    .sort((a, b) => (b.openedAt ?? b.createdAt) - (a.openedAt ?? a.createdAt));

  const close = () => useSnip.getState().clear();

  const send = async (boardId: string) => {
    if (!snip) return;
    setWorking(boardId);
    try {
      await appendToBoard(boardId, snip);
      close();
      if (useViewer.getState().docId !== boardId) await useViewer.getState().openDocument(boardId);
    } finally {
      setWorking(null);
    }
  };

  const createBoard = async () => {
    if (!snip) return;
    setWorking('new');
    try {
      const id = await boardFromSnip(snip);
      close();
      await useViewer.getState().openDocument(id);
    } finally {
      setWorking(null);
    }
  };

  const copy = async () => {
    if (!snip) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': snip.blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      downloadBlob(snip.blob, `${snip.docName} p${snip.page}.png`);
    }
  };

  return (
    <Modal open={!!snip || busy} onClose={close} title={t(L("Изрезка", "Snip"))} width={470}>
      {busy && !snip ? (
        <div className="grid h-32 place-items-center text-muted">
          <Icon name="refresh" size={20} className="animate-spin" />
        </div>
      ) : snip ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-white p-2">
            <img src={snip.url} alt="" className="mx-auto max-h-52 object-contain" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Toggle
              checked={withInk}
              onChange={(v) => void useSnip.getState().recapture(v)}
              label={t(L("Включи моите бележки", "Include my notes"))}
            />
            <div className="flex shrink-0 gap-1.5">
              <button className="btn" onClick={() => void copy()}>
                <Icon name={copied ? 'check' : 'copy'} size={14} />
                {copied ? t(L("Копирано", "Copied")) : t(L("Копирай", "Copy"))}
              </button>
              <button
                className="btn"
                onClick={() => downloadBlob(snip.blob, `${snip.docName} p${snip.page}.png`)}
              >
                <Icon name="download" size={14} />
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 label">{t(L("Изпрати на дъска", "Send to a board"))}</div>
            <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto">
              {boards.map((b) => (
                <button
                  key={b.id}
                  disabled={!!working}
                  onClick={() => void send(b.id)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  <Icon name="board" size={15} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{b.name}</span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {b.board?.flow === 'scroll' ? t(L("свитък", "scroll")) : `${b.pageCount} стр.`}
                  </span>
                  {working === b.id && <Icon name="refresh" size={13} className="animate-spin" />}
                </button>
              ))}
              {boards.length === 0 && (
                <p className="px-2 py-2 text-[12px] text-faint">{t(L("Още нямаш дъски — създай първата.", "No boards yet — make the first one."))}</p>
              )}
            </div>
            <button className="btn mt-1.5 w-full" disabled={!!working} onClick={() => void createBoard()}>
              <Icon name="plus" size={14} />
              {t(L("Нова дъска с тази изрезка", "New board from this snip"))}
            </button>
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={() => {
              onMakeCard({ image: snip.blob, docId: snip.docId, page: snip.page, deck: snip.docName });
              close();
            }}
          >
            <Icon name="cards" size={15} />
            {t(L("Направи флашкарта", "Make a flashcard"))}
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
