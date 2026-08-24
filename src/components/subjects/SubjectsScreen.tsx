import { useMemo, useState } from 'react';
import type { Subject } from '@/types';
import { useApp } from '@/state/appStore';
import { useWorkspace, suggestedSubjects, SUBJECT_COLORS } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { usePlanner, averageFor, openItems } from '@/state/plannerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { minutesBySubject, useTimer } from '@/state/timerStore';
import { Screen } from '../shell/Screen';
import { Icon } from '../Icon';
import { useConfirm } from '../ui';
import { useT, L, formatDuration } from '@/i18n';
import { S } from '@/i18n/strings';
import { Button, Card, EmptyState } from '../kit';
import { SubjectDialog } from './SubjectDialog';
import { SubjectDetail } from './SubjectDetail';

/** Grid of subjects, each showing how much of it is on your plate right now. */
export function SubjectsScreen() {
  const t = useT();
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
    // Named in the language being read, not in the one the list was typed in.
    for (const [i, s] of suggestedSubjects().entries()) {
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
      <Screen
        title={t(S.subjects)}
        subtitle={t(
          L(
            'Всеки материал, карта, задача и минута учене се води към предмет.',
            'Every material, card, task and minute of study belongs to a subject.',
          ),
        )}
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setEditing(null);
              setDialog(true);
            }}
          >
            {t(L('Нов предмет', 'New subject'))}
          </Button>
        }
      >
        {subjects.length === 0 ? (
          <Card>
            <EmptyState
              icon="layers"
              title={t(L('Още няма предмети', 'No subjects yet'))}
              body={t(
                L(
                  'Добави ги веднъж и цялото приложение се подрежда по тях — библиотеката, картите, задачите и статистиката.',
                  'Add them once and the whole app organises itself around them — the library, the cards, the tasks and the statistics.',
                ),
              )}
              action={{ label: t(L('Добави училищните', 'Add the school ones')), icon: 'sparkles', onClick: () => void addSuggested() }}
              secondary={{
                label: t(L('Свой предмет', 'My own subject')),
                icon: 'plus',
                onClick: () => {
                  setEditing(null);
                  setDialog(true);
                },
              }}
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => {
              const materials = documents.filter((d) => d.subjectId === s.id && !d.deletedAt).length;
              const open = openItems(items).filter((i) => i.subjectId === s.id).length;
              const due = dueCount(cards.filter((c) => c.subjectId === s.id));
              const avg = averageFor(grades, s.id);
              const minutes = weekMinutes.get(s.id) ?? 0;

              return (
                <div key={s.id} className="card card-hover group relative overflow-hidden p-4">
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
                  <button
                    className="w-full cursor-pointer text-left"
                    onClick={() => useApp.getState().openSubject(s.id)}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px]"
                        style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}
                      >
                        <Icon name={s.icon} size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{s.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {s.teacher || t(L(`${materials} материала`, `${materials} materials`))}
                        </span>
                      </span>
                      {avg.count > 0 && (
                        <span
                          className="t-num shrink-0 text-[17px] font-semibold"
                          style={{ color: s.color }}
                        >
                          {avg.average.toFixed(2)}
                        </span>
                      )}
                    </span>

                    <span className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                      <Mini value={materials} label={t(L('материала', 'materials'))} />
                      <Mini value={open} label={t(L('задачи', 'tasks'))} accent={open > 0} />
                      <Mini value={due} label={t(L('карти', 'cards'))} accent={due > 0} />
                    </span>

                    {minutes > 0 && (
                      <span className="mt-2.5 block text-[11.5px] text-muted">
                        {t(
                          L(
                            `${formatDuration(minutes, 'bg')} тази седмица`,
                            `${formatDuration(minutes, 'en')} this week`,
                          ),
                        )}
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
                      aria-label={t(S.edit)}
                    >
                      <Icon name="pencil" size={14} />
                    </button>
                    <button
                      className="icon-btn h-7 w-7"
                      onClick={() =>
                        confirm(
                          t(
                            L(
                              `Да изтрия ли «${s.name}»? Материалите и картите остават, само губят етикета.`,
                              `Delete "${s.name}"? The materials and cards stay — they only lose the tag.`,
                            ),
                          ),
                          () => void useWorkspace.getState().deleteSubject(s.id),
                        )
                      }
                      aria-label={t(S.delete)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Screen>

      <SubjectDialog open={dialog} subject={editing} onClose={() => setDialog(false)} />
    </div>
  );
}

function Mini({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <span className="rounded-lg py-1.5" style={{ background: 'var(--c-surface-2)' }}>
      <span
        className="t-num block text-[16px] font-semibold leading-none"
        style={accent ? { color: 'var(--c-accent)' } : undefined}
      >
        {value}
      </span>
      <span className="mt-0.5 block text-[10px] text-muted">{label}</span>
    </span>
  );
}
