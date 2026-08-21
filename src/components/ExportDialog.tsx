import { useState } from 'react';
import { useViewer } from '@/state/viewerStore';
import { downloadBlob, exportPdf } from '@/services/exportService';
import { repo } from '@/services/storageService';
import { Modal } from './ui';
import { Icon } from './Icon';

type Mode = 'annotated' | 'original';
type Range = 'all' | 'current' | 'custom';

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const meta = useViewer((s) => s.meta);
  const session = useViewer((s) => s.session);
  const pages = useViewer((s) => s.pages);
  const currentPage = useViewer((s) => s.currentPage);
  const pageCount = useViewer((s) => s.pageCount);

  const isBoard = meta?.kind === 'board';
  const [mode, setMode] = useState<Mode>('annotated');
  const [range, setRange] = useState<Range>('all');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected =
    range === 'all' ? null : range === 'current' ? [currentPage] : parseRange(custom, pageCount);

  const run = async () => {
    if (!meta || !session) return;
    setBusy(true);
    setError(null);
    try {
      let bytes: ArrayBuffer | null = null;
      if (!isBoard) {
        bytes = (await repo.getFile(meta.id)) ?? null;
        if (!bytes) throw new Error('Оригиналният файл липсва.');
      }
      await useViewer.getState().flushNow();
      const blob = await exportPdf({
        bytes,
        board: meta.board ?? null,
        session,
        byPage: pages,
        pages: selected,
        includeAnnotations: mode === 'annotated',
        getAsset: async (id) => (await repo.getAsset(id))?.blob,
      });
      const suffix = mode === 'annotated' ? ' (с бележки)' : '';
      downloadBlob(blob, `${meta.name}${suffix}.pdf`);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Експортът се провали.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isBoard ? 'Експорт на дъската' : 'Експорт на PDF'}
      width={430}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Отказ
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void run()}
            disabled={busy || (range === 'custom' && !selected?.length)}
          >
            {busy ? <Icon name="refresh" size={14} className="animate-spin" /> : <Icon name="download" size={14} />}
            {busy ? 'Създаване…' : 'Изтегли'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 label">Съдържание</div>
          <div className="grid grid-cols-2 gap-2">
            <Option
              active={mode === 'annotated'}
              onClick={() => setMode('annotated')}
              icon="pencil"
              title="С бележки"
              hint={isBoard ? 'Хартията + всичко написано' : 'Оригиналът + всичко написано'}
            />
            <Option
              active={mode === 'original'}
              onClick={() => setMode('original')}
              icon="file"
              title={isBoard ? 'Празни листове' : 'Оригинал'}
              hint={isBoard ? 'Само хартията, за принтиране' : 'Чисто копие без бележки'}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 label">Страници</div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', `Всички (${pageCount})`],
                ['current', `Текущата (${currentPage})`],
                ['custom', 'Избрани'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`btn ${range === id ? 'btn-ghost-active' : ''}`}
                onClick={() => setRange(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <input
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="напр. 1-5, 8, 12-14"
              className="field mt-2"
            />
          )}
          {range === 'custom' && (
            <p className="mt-1 text-[11px] text-faint">
              {selected?.length ? `${selected.length} страници` : 'Въведи валиден диапазон'}
            </p>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          Бележките се записват като истинско векторно съдържание в PDF-а, така че остават остри при печат.
          {isBoard
            ? ' Хартията се генерира наново, вместо да се снима — линиите излизат идеални.'
            : ' Оригиналният файл в библиотеката не се променя.'}
        </p>

        {error && (
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--c-danger)' }}>
            <Icon name="alert" size={14} />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Option({
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
        <Icon name={icon} size={14} />
        {title}
      </span>
      <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>
    </button>
  );
}

/** "1-5, 8, 12-14" -> [1,2,3,4,5,8,12,13,14] */
export function parseRange(input: string, max: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(/[,;]/)) {
    const t = part.trim();
    if (!t) continue;
    const m = t.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, parseInt(m[1], 10));
      const b = Math.min(max, parseInt(m[2], 10));
      for (let i = a; i <= b; i++) out.add(i);
    } else if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      if (n >= 1 && n <= max) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}
