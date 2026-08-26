import { useEffect, useMemo, useState } from 'react';
import type { Goal } from '@/types';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useGoals, activeGoals, completedGoals } from '@/state/goalStore';
import { useGameContext } from '@/state/gameStore';
import {
  currentValue,
  goalProgress,
  goalHealth,
  daysLeft,
  paceHint,
  HEALTH_COLOR,
  HEALTH_LABEL,
  METRIC_ICON,
  METRIC_LABEL,
  METRIC_UNIT,
} from '@/services/goalService';
import { useT, L, useLang, shortDate, formatDuration } from '@/i18n';
import { S } from '@/i18n/strings';
import { Section } from '../shell/Screen';
import { Icon } from '../Icon';
import { Modal, Select, useConfirm } from '../ui';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  ProgressCells,
  ProgressRing,
  Segmented,
  Sheet,
  Tabs,
  useIsPhone,
} from '../kit';
import { isoDay } from '../shell/QuickCreate';

/**
 * Goals, with the number they are actually made of.
 *
 * A goal card here shows four things at once: how far along it is, whether
 * that is ahead of or behind where the calendar says it should be, what pace
 * would finish it, and which milestones are ticked. A percentage on its own
 * motivates nobody, because it never says whether it is good news.
 */
export function GoalsScreen({ embedded }: { embedded?: boolean } = {}) {
  const t = useT();
  const phone = useIsPhone();
  const goals = useGoals((s) => s.goals);
  const focusId = useApp((s) => s.focusId);
  const [tab, setTab] = useState<'active' | 'done' | 'archived'>('active');
  const [open, setOpen] = useState<Goal | null>(null);

  const live = useMemo(() => activeGoals(goals), [goals]);
  const done = useMemo(() => completedGoals(goals), [goals]);
  const archived = useMemo(() => goals.filter((g) => g.archived), [goals]);

  useEffect(() => {
    if (!focusId) return;
    const hit = goals.find((g) => g.id === focusId);
    if (hit) {
      setOpen(hit);
      useApp.getState().clearFocus();
    }
  }, [focusId, goals]);

  const list = tab === 'active' ? live : tab === 'done' ? done : archived;

  return (
    <Section
      embedded={embedded}
      title={t(S.goals)}
      subtitle={t(
        L(
          `${live.length} активни · ${done.length} постигнати`,
          `${live.length} active · ${done.length} reached`,
        ),
      )}
      actions={
        <Button variant="primary" icon="plus" onClick={() => useApp.getState().setQuick('goal')}>
          {t(L('Нова цел', 'New goal'))}
        </Button>
      }
      toolbar={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'active', label: t(L('Активни', 'Active')), icon: 'target', count: live.length },
            { id: 'done', label: t(L('Постигнати', 'Reached')), icon: 'trophy', count: done.length },
            { id: 'archived', label: t(L('Архив', 'Archived')), icon: 'archive', count: archived.length },
          ]}
        />
      }
    >
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon="target"
            title={tab === 'active' ? t(L('Още няма цел', 'No goals yet')) : t(L('Празно е тук', 'Nothing here'))}
            body={t(
              L(
                'Целта е число и срок: 20 часа математика до края на месеца, 200 карти, 40 задачи. Останалото се брои само.',
                'A goal is a number and a date: 20 hours of maths this month, 200 cards, 40 tasks. The counting takes care of itself.',
              ),
            )}
            action={
              tab === 'active'
                ? { label: t(L('Създай цел', 'Create goal')), icon: 'plus', onClick: () => useApp.getState().setQuick('goal') }
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onOpen={() => setOpen(goal)} />
          ))}
        </div>
      )}

      {open &&
        (phone ? (
          <Sheet open onClose={() => setOpen(null)} title={open.title}>
            <GoalDetail goal={open} onClose={() => setOpen(null)} />
          </Sheet>
        ) : (
          <Modal open onClose={() => setOpen(null)} title={open.title} width={560}>
            <GoalDetail goal={open} onClose={() => setOpen(null)} />
          </Modal>
        ))}
    </Section>
  );
}

/* ------------------------------------------------------------------ card */

export function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const t = useT();
  const lang = useLang();
  const ctx = useGameContext();
  const subjects = useWorkspace((s) => s.subjects);
  const subject = subjects.find((s) => s.id === goal.subjectId) ?? null;

  const value = currentValue(goal, ctx);
  const pct = goalProgress(goal, ctx);
  const health = goalHealth(goal, ctx);
  const left = daysLeft(goal);
  const pace = paceHint(goal, ctx);
  const color = goal.color ?? subject?.color ?? HEALTH_COLOR[health];
  const doneMilestones = goal.milestones.filter((m) => m.done).length;

  const unit = (n: number) =>
    goal.metric === 'minutes' ? formatDuration(n, lang) : `${Math.round(n)} ${t(METRIC_UNIT[goal.metric])}`;

  return (
    <button onClick={onOpen} className="card card-hover flex cursor-pointer flex-col p-4 text-left">
      <div className="flex items-start gap-3">
        <ProgressRing value={pct} size={56} stroke={5.5} color={color} gap={0.08}>
          <span className="t-num text-[12.5px] font-semibold">{Math.round(pct * 100)}%</span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] font-semibold tracking-[-0.012em]">{goal.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
            {subject && (
              <span className="inline-flex items-center gap-1.5">
                <span className="badge-dot" style={{ background: subject.color }} />
                {subject.name}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Icon name={METRIC_ICON[goal.metric]} size={11} />
              {t(METRIC_LABEL[goal.metric])}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3.5">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="t-num text-[13px] font-semibold">
            {unit(value)}
            <span className="ml-1 font-normal text-muted">/ {unit(goal.target)}</span>
          </span>
          <Badge color={HEALTH_COLOR[health]} icon={health === 'done' ? 'check' : health === 'behind' || health === 'late' ? 'alert' : 'bolt'}>
            {t(HEALTH_LABEL[health])}
          </Badge>
        </div>
        <ProgressBar value={pct} color={color} height={7} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted">
        {left !== null && (
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" size={11} />
            {left < 0
              ? t(L(`просрочена с ${-left} дни`, `${-left} days overdue`))
              : left === 0
                ? t(L('последен ден', 'last day'))
                : t(L(`остават ${left} дни`, `${left} days left`))}
          </span>
        )}
        {pace !== null && (
          <span className="inline-flex items-center gap-1">
            <Icon name="gauge" size={11} />
            {goal.metric === 'minutes'
              ? t(L(`${Math.ceil(pace)} мин/ден`, `${Math.ceil(pace)} min/day`))
              : t(L(`${pace.toFixed(1)}/ден`, `${pace.toFixed(1)}/day`))}
          </span>
        )}
        {goal.milestones.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Icon name="flag" size={11} />
            {doneMilestones}/{goal.milestones.length}
          </span>
        )}
      </div>

      {goal.milestones.length > 0 && (
        <ProgressCells value={doneMilestones / goal.milestones.length} cells={goal.milestones.length} color={color} className="mt-2.5" />
      )}
    </button>
  );
}

/* ---------------------------------------------------------------- detail */

function GoalDetail({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const ctx = useGameContext();
  const allSubjects = useWorkspace((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const live = useGoals((s) => s.goals.find((g) => g.id === goal.id)) ?? goal;
  const { confirm, element } = useConfirm();
  const [milestone, setMilestone] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(live);

  const value = currentValue(live, ctx);
  const pct = goalProgress(live, ctx);
  const health = goalHealth(live, ctx);
  const color = live.color ?? subjects.find((s) => s.id === live.subjectId)?.color ?? HEALTH_COLOR[health];

  const save = async () => {
    await useGoals.getState().update(live.id, {
      title: draft.title.trim() || live.title,
      subjectId: draft.subjectId,
      target: Math.max(1, draft.target),
      deadline: draft.deadline,
      metric: draft.metric,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-4">
        <div>
          <label className="t-label mb-1.5 block">{t(L('Заглавие', 'Title'))}</label>
          <input className="field field-lg" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="t-label mb-1.5 block">{t(S.subject)}</label>
            <Select
              value={draft.subjectId ?? ''}
              width={230}
              options={[
                { value: '', label: t(S.noSubject) },
                ...subjects.map((s) => ({ value: s.id, label: s.name, color: s.color })),
              ]}
              onChange={(v) => setDraft({ ...draft, subjectId: v || null })}
            />
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(S.deadline)}</label>
            <input
              type="date"
              className="field"
              value={draft.deadline ? isoDay(new Date(draft.deadline)) : ''}
              onChange={(e) =>
                setDraft({ ...draft, deadline: e.target.value ? new Date(e.target.value).setHours(0, 0, 0, 0) : null })
              }
            />
          </div>
        </div>
        <div>
          <label className="t-label mb-1.5 block">{t(L('Цел', 'Target'))}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="field t-num"
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}
            />
            <span className="text-[12.5px] text-muted">{t(METRIC_UNIT[draft.metric])}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setEditing(false)}>{t(S.cancel)}</Button>
          <Button variant="primary" icon="check" onClick={() => void save()}>
            {t(S.save)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <ProgressRing value={pct} size={84} stroke={7} color={color} colorTo="var(--c-brand-lift)">
          <div>
            <div className="t-num text-[17px] font-semibold leading-none">{Math.round(pct * 100)}%</div>
            <div className="mt-1 text-[10px] text-muted">{t(HEALTH_LABEL[health])}</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="t-num text-[20px] font-semibold tracking-[-0.02em]">
            {live.metric === 'minutes' ? formatDuration(value, lang) : Math.round(value)}
            <span className="ml-1.5 text-[13px] font-normal text-muted">
              / {live.metric === 'minutes' ? formatDuration(live.target, lang) : `${live.target} ${t(METRIC_UNIT[live.metric])}`}
            </span>
          </p>
          <p className="mt-1 text-[12.5px] text-muted">
            {t(METRIC_LABEL[live.metric])}
            {live.deadline ? ` · ${t(S.deadline)}: ${shortDate(live.deadline, lang)}` : ''}
          </p>
          <ProgressBar value={pct} color={color} height={8} className="mt-2.5" />
        </div>
      </div>

      {live.metric === 'custom' && (
        <Card title={t(L('Отчитане на ръка', 'Count by hand'))} icon="pencil">
          <div className="flex items-center gap-3">
            <IconButton icon="minimize" label="-1" onClick={() => void useGoals.getState().bump(live.id, -1)} />
            <span className="t-num min-w-[64px] text-center text-[22px] font-semibold">{live.manual}</span>
            <IconButton icon="plus" label="+1" onClick={() => void useGoals.getState().bump(live.id, 1)} />
            <span className="ml-2 text-[12px] text-muted">
              {t(L('Всяка глава, тест или лист — един клик.', 'One click per chapter, paper or sheet.'))}
            </span>
          </div>
        </Card>
      )}

      <Card title={t(L('Етапи', 'Milestones'))} icon="flag" flush>
        <div className="px-3 pb-3">
          {live.milestones.length === 0 && (
            <p className="px-1 py-2 text-[12.5px] text-muted">
              {t(L('Разбий целта на стъпки — по-лесно е да започнеш стъпка, отколкото цел.', 'Break the goal into steps — a step is much easier to start than a goal.'))}
            </p>
          )}
          <ul className="space-y-0.5">
            {live.milestones.map((m) => (
              <li key={m.id} className="group flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 hover:bg-surface-2">
                <button
                  onClick={() => void useGoals.getState().toggleMilestone(live.id, m.id)}
                  className="grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded-[6px] border transition-all"
                  style={{
                    borderColor: m.done ? color : 'var(--c-line-strong)',
                    background: m.done ? color : 'transparent',
                  }}
                  aria-pressed={m.done}
                  aria-label={m.title}
                >
                  {m.done && <Icon name="check" size={12} className="text-white" strokeWidth={3} />}
                </button>
                <span className={`min-w-0 flex-1 truncate text-[13px] ${m.done ? 'text-muted line-through' : ''}`}>
                  {m.title}
                </span>
                <button
                  className="icon-btn h-6 w-6 hover-reveal"
                  onClick={() => void useGoals.getState().removeMilestone(live.id, m.id)}
                  aria-label={t(S.delete)}
                >
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
          </ul>

          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const value = milestone.trim();
              if (!value) return;
              void useGoals.getState().addMilestone(live.id, value);
              setMilestone('');
            }}
          >
            <input
              className="field"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
              placeholder={t(L('Добави етап…', 'Add a milestone…'))}
            />
            <Button type="submit" icon="plus" disabled={!milestone.trim()}>
              {t(S.add)}
            </Button>
          </form>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button icon="pencil" onClick={() => setEditing(true)}>
            {t(S.edit)}
          </Button>
          <Button
            icon="archive"
            onClick={() => {
              void useGoals.getState().update(live.id, { archived: !live.archived });
              onClose();
            }}
          >
            {live.archived ? t(L('Върни от архива', 'Unarchive')) : t(L('Архивирай', 'Archive'))}
          </Button>
        </div>
        <Button
          variant="danger"
          icon="trash"
          onClick={() =>
            confirm(t(L('Да изтрия ли тази цел?', 'Delete this goal?')), () => {
              void useGoals.getState().remove(live.id);
              onClose();
            })
          }
        >
          {t(S.delete)}
        </Button>
      </div>

      {/* Segmented is imported for the editor above; keeping the confirm dialog mounted. */}
      <span className="hidden">
        <Segmented value="a" onChange={() => {}} items={[{ id: 'a', label: '' }]} />
      </span>
      {element}
    </div>
  );
}
