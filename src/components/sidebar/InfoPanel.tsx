import { useMemo } from 'react';
import type { StudyStatus } from '@/types';
import { useViewer } from '@/state/viewerStore';
import { progressOf, useLibrary } from '@/state/libraryStore';
import { formatBytes, formatDate } from '@/lib/util';
import { Icon } from '../Icon';
import { useT, L, type Msg } from '@/i18n';
import { S } from '@/i18n/strings';

const STATUS: { id: StudyStatus; label: Msg; color: string }[] = [
  { id: 'not_started', label: L('Незапочнат', 'Not started'), color: '#94a3b8' },
  { id: 'in_progress', label: L('В процес', 'In progress'), color: '#3b82f6' },
  { id: 'completed', label: L('Завършен', 'Finished'), color: '#10b981' },
  { id: 'review', label: L('За преговор', 'To review'), color: '#f59e0b' },
];

/** Study state for the open document: progress, status, quick stats. */
export function InfoPanel() {
  const t = useT();
  const meta = useViewer((s) => s.meta);
  const pages = useViewer((s) => s.pages);
  const pageCount = useViewer((s) => s.pageCount);
  const setStatus = useLibrary((s) => s.setStatus);
  const setManualProgress = useLibrary((s) => s.setManualProgress);

  const stats = useMemo(() => {
    let annotations = 0;
    let annotatedPages = 0;
    pages.forEach((list) => {
      if (list.length) {
        annotations += list.length;
        annotatedPages++;
      }
    });
    return { annotations, annotatedPages };
  }, [pages]);

  if (!meta) return null;
  const pct = Math.round(progressOf(meta) * 100);

  return (
    <div className="scroll-thin h-full overflow-y-auto px-3 py-3 text-[12px]">
      <h3 className="mb-1 text-[13px] font-semibold leading-snug">{meta.name}</h3>
      <p className="mb-3 text-faint">
        {pageCount} {t(L('стр.', 'pages'))} · {formatBytes(meta.size)}
      </p>

      <div className="mb-1 flex items-center justify-between">
        <span className="t-label">{t(S.progress)}</span>
        <span className="tabular-nums font-medium">{pct}%</span>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: 'var(--c-accent)' }} />
      </div>
      <p className="mb-2 text-faint">
        {t(L(`Достигната страница ${meta.maxPageVisited || 0} от ${pageCount}`, `Reached page ${meta.maxPageVisited || 0} of ${pageCount}`))}
        {meta.manualProgress != null && ` · ${t(L('ръчно зададен', 'set by hand'))}`}
      </p>
      <div className="mb-4 flex gap-1">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => void setManualProgress(meta.id, Number(e.target.value) / 100)}
          className="w-full accent-[var(--c-accent)] cursor-pointer"
        />
        {meta.manualProgress != null && (
          <button
            className="icon-btn h-6 w-6"
            title={t(L('Върни автоматичния прогрес', 'Back to automatic progress'))}
            onClick={() => void setManualProgress(meta.id, null)}
          >
            <Icon name="refresh" size={13} />
          </button>
        )}
      </div>

      <div className="t-label mb-1">{t(L('Статус', 'Status'))}</div>
      <div className="mb-4 grid grid-cols-2 gap-1">
        {STATUS.map((s) => (
          <button
            key={s.id}
            onClick={() => void setStatus(meta.id, s.id)}
            className="btn justify-start text-[12px]"
            style={
              meta.status === s.id
                ? { background: `${s.color}22`, color: s.color }
                : undefined
            }
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {t(s.label)}
          </button>
        ))}
      </div>

      <div className="t-label mb-1">{t(L('Статистика', 'Details'))}</div>
      <dl className="space-y-1 text-muted">
        <Row label={t(L('Бележки', 'Notes'))} value={String(stats.annotations)} />
        <Row label={t(L('Страници с бележки', 'Annotated pages'))} value={String(stats.annotatedPages)} />
        <Row label={t(L('Последно отворен', 'Last opened'))} value={formatDate(meta.openedAt)} />
        <Row label={t(L('Добавен', 'Added'))} value={formatDate(meta.createdAt)} />
      </dl>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2">
    <dt>{label}</dt>
    <dd className="truncate text-ink">{value}</dd>
  </div>
);
