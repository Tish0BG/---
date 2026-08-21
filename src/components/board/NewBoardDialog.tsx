import { useState } from 'react';
import type { BoardFlow, PaperTemplate } from '@/types';
import {
  PAPER_SIZES,
  SCROLL_INITIAL_H,
  TEMPLATE_LABELS,
  makeBoardConfig,
  type PaperSizeId,
} from '@/services/boardService';
import { useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { useSettings } from '@/state/settingsStore';
import { Modal } from '../ui';
import { Icon } from '../Icon';
import { PaperPreview } from './PaperPreview';

const TEMPLATES: PaperTemplate[] = [
  'blank',
  'lined',
  'lined-wide',
  'grid',
  'grid-large',
  'dots',
  'graph',
  'music',
  'cornell',
];

/**
 * Creates a whiteboard. Everything on this screen is a real preview, because
 * paper is the one choice that is annoying to change after you have written
 * half a page on it.
 */
export function NewBoardDialog({
  open,
  onClose,
  folderId,
}: {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
}) {
  const settings = useSettings();
  const createBoard = useLibrary((s) => s.createBoard);
  const openDocument = useViewer((s) => s.openDocument);

  const [name, setName] = useState('');
  const [flow, setFlow] = useState<BoardFlow>(settings.boardFlow);
  const [template, setTemplate] = useState<PaperTemplate>(settings.boardTemplate);
  const [size, setSize] = useState<PaperSizeId>('a4');
  const [landscape, setLandscape] = useState(false);
  const [busy, setBusy] = useState(false);

  const base = PAPER_SIZES[size];
  const w = landscape ? base.h : base.w;
  const h = flow === 'scroll' ? SCROLL_INITIAL_H : landscape ? base.w : base.h;

  const create = async () => {
    setBusy(true);
    try {
      const config = makeBoardConfig(flow, template, size, landscape);
      const title = name.trim() || defaultName(flow, template);
      const id = await createBoard(title, config, folderId);
      settings.set('boardTemplate', template);
      settings.set('boardFlow', flow);
      onClose();
      setName('');
      await openDocument(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Нова дъска"
      width={620}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Отказ
          </button>
          <button className="btn btn-primary" onClick={() => void create()} disabled={busy}>
            <Icon name="board" size={14} />
            Създай и отвори
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="min-w-0 flex-1 space-y-4">
            <label className="block">
              <span className="mb-1 block label">Име</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void create();
                }}
                placeholder={defaultName(flow, template)}
                className="field"
              />
            </label>

            <div>
              <span className="mb-1.5 block label">Вид</span>
              <div className="grid grid-cols-2 gap-2">
                <FlowCard
                  active={flow === 'paged'}
                  onClick={() => setFlow('paged')}
                  icon="board"
                  title="Тетрадка"
                  hint="Отделни листа, добавяш нови"
                />
                <FlowCard
                  active={flow === 'scroll'}
                  onClick={() => setFlow('scroll')}
                  icon="scroll"
                  title="Свитък"
                  hint="Един лист, който расте надолу"
                />
              </div>
            </div>

            {flow === 'paged' && (
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <span className="mb-1.5 block label">
                    Размер
                  </span>
                  <div className="flex gap-1.5">
                    {(Object.keys(PAPER_SIZES) as PaperSizeId[]).map((id) => (
                      <button
                        key={id}
                        className={`btn flex-1 ${size === id ? 'btn-ghost-active' : ''}`}
                        onClick={() => setSize(id)}
                      >
                        {PAPER_SIZES[id].label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className={`btn ${landscape ? 'btn-ghost-active' : ''}`}
                  onClick={() => setLandscape((v) => !v)}
                  title="Хоризонтално"
                >
                  <Icon name={landscape ? 'fitWidth' : 'fitPage'} size={15} />
                  {landscape ? 'Хоризонтално' : 'Вертикално'}
                </button>
              </div>
            )}
          </div>

          <div className="hidden shrink-0 flex-col items-center gap-2 sm:flex">
            <PaperPreview template={template} w={w} h={Math.min(h, w * 1.42)} width={124} />
            <span className="text-[11px] text-muted">{TEMPLATE_LABELS[template]}</span>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block label">Хартия</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => setTemplate(t)}
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors"
                style={{
                  borderColor: template === t ? 'var(--c-accent)' : 'var(--c-line)',
                  background: template === t ? 'var(--c-accent-soft)' : 'transparent',
                }}
              >
                <PaperPreview template={t} w={base.w} h={base.h} width={52} />
                <span className="text-center text-[10px] leading-tight text-muted">{TEMPLATE_LABELS[t]}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          Хартията може да се смени по всяко време — за цялата дъска или само за една страница.
          Всички инструменти за писане, гумата, търсенето и експортът работят точно както при PDF.
        </p>
      </div>
    </Modal>
  );
}

function FlowCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-xl border p-2.5 text-left transition-colors"
      style={{
        borderColor: active ? 'var(--c-accent)' : 'var(--c-line)',
        background: active ? 'var(--c-accent-soft)' : 'transparent',
      }}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        <Icon name={icon} size={15} />
        {title}
      </span>
      <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>
    </button>
  );
}

const defaultName = (flow: BoardFlow, template: PaperTemplate): string =>
  flow === 'scroll' ? 'Свитък' : template === 'cornell' ? 'Записки' : 'Тетрадка';
