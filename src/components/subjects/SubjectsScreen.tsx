import { useMemo, useState } from 'react';
import type { Subject } from '@/types';
import { useApp } from '@/state/appStore';
import { useWorkspace, SUGGESTED_SUBJECTS, SUBJECT_COLORS } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { usePlanner, averageFor, openItems } from '@/state/plannerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { minutesBySubject, useTimer } from '@/state/timerStore';
import { Icon } from '../Icon';
import { useConfirm } from '../ui';
import { SubjectDialog } from './SubjectDialog';
import { SubjectDetail } from './SubjectDetail';

/** Grid of subjects, each showing how much of it is on your plate right now. */
export function SubjectsScreen() {
  const subjectId = useApp((s) => s.subjectId);
  const subjects = useWorkspace((s) => s.subjects);
  const documents = useLibrary((s) => s.documents);
  const items = usePlanner((s) => s.items);
  const grades = usePlanner((s) => s.grades);
  const cards = useCards((s) => s.cards);
  const sessions = useTimer((s) => s.sessions);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [dialog, setDialog] = useState(false);
  const { confirm, element } = useConfirm();

  const weekMinutes = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of minutesBySubject(sessions, 7)) map.set(row.subjectId, row.minutes);
    return map;
  }, [sessions]);

  if (subjectId) return <SubjectDetail id={subjectId} />;

  const addSuggested = async () => {
    const existing = new Set(subjects.map((s) => s.name));
    for (const [i, s] of SUGGESTED_SUBJECTS.entries()) {
      if (existing.has(s.name)) continue;
      await useWorkspace.getState().createSubject({
        name: s.name,
        icon: s.icon,
        color: SUBJECT_COLORS[(subjects.length + i) % SUBJECT_COLORS.length],
      });
    }
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      {element}
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Предмети</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              Всеки материал, карта, задача и минута учене се води към предмет.
            </p>
          </div>
          <button
            className="btn btn-primary h-9"
            onClick={() => {
              setEditing(null);
              setDialog(true);
            }}
          >
            <Icon name="plus" size={16} />
            Нов предмет
          </button>
        </div>

        {subjects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong py-16 text-center">
            <Icon name="layers" size={28} className="text-faint" />
            <p className="text-[14px] font-medium">Още няма предмети</p>
            <p className="max-w-sm text-[12px] leading-relaxed text-muted">
              Добави ги веднъж и цялото приложение се подрежда по тях — библиотеката, картите,
              планерът и статистиката.
            </p>
            <div className="mt-1 flex gap-2">
              <button className="btn btn-primary" onClick={() => void addSuggested()}>
                <Icon name="sparkles" size={15} />
                Добави училищните
              </button>
              <button
                className="btn"
                onClick={() => {
                  setEditing(null);
                  setDialog(true);
                }}
              >
                <Icon name="plus" size={15} />
                Свой предмет
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => {
              const materials = documents.filter((d) => d.subjectId === s.id && !d.deletedAt).length;
              const open = openItems(items).filter((i) => i.subjectId === s.id).length;
              const due = dueCount(cards.filter((c) => c.subjectId === s.id));
              const avg = averageFor(grades, s.id);
              const minutes = weekMinutes.get(s.id) ?? 0;

              return (
                <div key={s.id} className="panel group relative overflow-hidden p-4">
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
                  <button
                    className="w-full cursor-pointer text-left"
                    onClick={() => useApp.getState().openSubject(s.id)}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                        style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}
                      >
                        <Icon name={s.icon} size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{s.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {s.teacher || `${materials} материала`}
                        </span>
                      </span>
                      {avg.count > 0 && (
                        <span
                          className="shrink-0 text-[17px] font-medium tabular-nums"
                          style={{ color: s.color }}
                        >
                          {avg.average.toFixed(2)}
                        </span>
                      )}
                    </span>

                    <span className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                      <Mini value={materials} label="материала" />
                      <Mini value={open} label="задачи" accent={open > 0} />
                      <Mini value={due} label="карти" accent={due > 0} />
                    </span>

                    {minutes > 0 && (
                      <span className="mt-2.5 block text-[11px] text-muted">
                        {Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} ч ` : ''}
                        {minutes % 60} мин тази седмица
                      </span>
                    )}
                  </button>

                  <div className="absolute right-2 top-2.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      className="icon-btn h-7 w-7"
                      onClick={() => {
                        setEditing(s);
                        setDialog(true);
                      }}
                      aria-label="Редактирай"
                    >
                      <Icon name="pencil" size={14} />
                    </button>
                    <button
                      className="icon-btn h-7 w-7"
                      onClick={() =>
                        confirm(
                          `Да изтрия ли «${s.name}»? Материалите и картите остават, само губят етикета.`,
                          () => void useWorkspace.getState().deleteSubject(s.id),
                        )
                      }
                      aria-label="Изтрий"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SubjectDialog open={dialog} subject={editing} onClose={() => setDialog(false)} />
    </div>
  );
}

function Mini({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <span className="rounded-lg py-1.5" style={{ background: 'var(--c-surface-2)' }}>
      <span
        className="block text-[15px] font-medium leading-none tabular-nums"
        style={accent ? { color: 'var(--c-accent)' } : undefined}
      >
        {value}
      </span>
      <span className="mt-0.5 block text-[10px] text-muted">{label}</span>
    </span>
  );
}
