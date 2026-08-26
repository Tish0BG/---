import { useMemo, useRef, useState } from 'react';
import type { PlannerItem } from '@/types';
import { useApp } from '@/state/appStore';
import { useGoals, activeGoals } from '@/state/goalStore';
import { useItemTypes, allTypes, typeName, typeOf, KIND_DEFAULTS } from '@/state/itemTypeStore';
import {
  usePlanner,
  addDays,
  endOfDay,
  openItems,
  overdue as overdueOf,
  sortByDue,
  startOfDay,
} from '@/state/plannerStore';
import { useT, L, useLang, formatDate, shortDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { MenuItem, Popover } from '../ui';
import { EmptyState, ProgressRing, Segmented, useIsPhone, useMedia } from '../kit';
import { TaskRow } from '../tasks/TaskRow';
import { useGameContext } from '@/state/gameStore';
import { useWorkspace } from '@/state/workspaceStore';
import {
  currentValue,
  goalProgress,
  goalHealth,
  daysLeft,
  HEALTH_COLOR,
  METRIC_UNIT,
} from '@/services/goalService';
import { formatDuration } from '@/i18n';
import type { Goal } from '@/types';
import { isoDay } from '../shell/QuickCreate';
import { notify } from '@/state/toastStore';
import { noteReminderSaved } from '@/services/reminderService';

/**
 * ────────────────────────────────────────────────────────── the one screen ──
 *
 * A day and a life are two different horizons, and a planner that shows only
 * one of them is either a to-do list that forgets why you are doing any of it,
 * or a wall of ambitions with nothing to do this afternoon. So the plan is one
 * board with three lanes, side by side, all visible at once:
 *
 *   Today — what you actually owe the next few hours.
 *   Ahead — everything with a longer rope: this week, later, someday.
 *   Goals — the reason the first two exist.
 *
 * The middle lane is a holding pen you *pull from*: drag an entry into Today
 * and it is due today, drag it back and it goes loose again. Dragging is the
 * whole interaction, because deciding what today is made of is a physical
 * sort of thought and a date picker is a bad place to do it.
 *
 * On a phone the three lanes become three tabs — a board with 340 px of width
 * is a board nobody can drag anything on — and the same moves live in each
 * row's own menu.
 */

type Lane = 'today' | 'ahead' | 'goals';
type AheadView = 'week' | 'later' | 'someday';

/** What a lane needs to accept a dropped row. */
interface DropHandlers {
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

/** What a lane hands to each row so it can be picked up. */
interface RowProps {
  draggable: boolean;
  dense: boolean;
  onDragStart: (item: PlannerItem) => void;
  onDragEnd: () => void;
  onEdit: (item: PlannerItem) => void;
}

export function PlanBoard({ onEdit }: { onEdit: (item: PlannerItem) => void }) {
  const t = useT();
  const lang = useLang();
  const phone = useIsPhone();
  // Three lanes need about four hundred pixels each before a title starts
  // truncating into uselessness; under that the board becomes three tabs
  // rather than three cramped columns.
  const wide = useMedia('(min-width: 1280px)');
  const items = usePlanner((s) => s.items);
  const goals = useGoals((s) => s.goals);
  const filterSubject = useApp((s) => s.filterSubjectId);
  const kind = useApp((s) => s.planKind);
  const [lane, setLane] = useState<Lane>('today');
  const [dragging, setDragging] = useState<PlannerItem | null>(null);
  const [over, setOver] = useState<Lane | AheadView | null>(null);

  const scoped = useMemo(() => {
    let list = items;
    if (filterSubject) list = list.filter((i) => i.subjectId === filterSubject);
    if (kind) list = list.filter((i) => i.kind === kind);
    return list;
  }, [items, filterSubject, kind]);

  const lanes = useMemo(() => {
    const open = openItems(scoped);
    const weekEnd = endOfDay(addDays(7));
    return {
      overdue: sortByDue(overdueOf(scoped)),
      today: sortByDue(open.filter((i) => i.due !== null && i.due >= startOfDay() && i.due <= endOfDay())),
      week: sortByDue(open.filter((i) => i.due !== null && i.due > endOfDay() && i.due <= weekEnd)),
      later: sortByDue(open.filter((i) => i.due !== null && i.due > weekEnd)),
      someday: sortByDue(open.filter((i) => i.due === null)),
      doneToday: scoped.filter((i) => i.done && (i.completedAt ?? 0) >= startOfDay()),
    };
  }, [scoped]);

  const live = useMemo(() => activeGoals(goals), [goals]);

  /* ------------------------------------------------------------ dropping */

  const drop = (target: Lane | AheadView) => {
    const item = dragging;
    setDragging(null);
    setOver(null);
    if (!item) return;
    const planner = usePlanner.getState();
    if (target === 'today') void planner.moveTo(item.id, startOfDay());
    else if (target === 'someday') void planner.moveTo(item.id, null);
    else if (target === 'week' || target === 'ahead')
      void planner.moveTo(item.id, startOfDay(addDays(1)));
    else if (target === 'later') void planner.moveTo(item.id, startOfDay(addDays(8)));
  };

  const dropProps = (target: Lane | AheadView): DropHandlers => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setOver(target);
    },
    onDragLeave: () => setOver((v) => (v === target ? null : v)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      drop(target);
    },
  });

  // Lane rows are dense on purpose: a column is 360 px wide, and the type is
  // already said by the icon, so the chip repeating it costs a third of the
  // title. The full row lives on the list tab, where there is room for it.
  const rowProps: RowProps = {
    draggable: true,
    dense: true,
    onDragStart: setDragging,
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
    onEdit,
  };

  /* -------------------------------------------------------------- lanes */

  const todayLane = (
    <LaneShell
      icon="bolt"
      title={t(L('Днес', 'Today'))}
      hint={formatDate(Date.now(), lang, { weekday: 'long', day: 'numeric', month: 'long' })}
      count={lanes.today.length + lanes.overdue.length}
      accent="var(--c-accent)"
      active={over === 'today'}
      armed={!!dragging}
      aside={
        <ProgressRing
          value={
            lanes.today.length + lanes.doneToday.length
              ? lanes.doneToday.length / (lanes.today.length + lanes.doneToday.length)
              : 0
          }
          size={34}
          stroke={3.5}
          color="var(--c-success)"
        >
          <span className="t-num text-[9.5px] font-semibold">{lanes.doneToday.length}</span>
        </ProgressRing>
      }
      {...dropProps('today')}
    >
      <LaneAdd due={startOfDay()} placeholder={t(L('Какво за днес?', 'What is today made of?'))} />

      {dragging && <DropHint label={t(L('Пусни тук → днес', 'Drop here → today'))} on={over === 'today'} />}

      {lanes.overdue.length > 0 && (
        <div className="mt-2 rounded-[12px] border border-dashed p-1.5" style={{ borderColor: 'var(--c-danger)' }}>
          <div className="flex items-center gap-1.5 px-2 pb-1 pt-0.5">
            <Icon name="alert" size={12} style={{ color: 'var(--c-danger)' }} />
            <span className="t-label" style={{ color: 'var(--c-danger)' }}>
              {t(L('Просрочени', 'Overdue'))}
            </span>
            <span className="t-num ml-auto text-[11px] text-faint">{lanes.overdue.length}</span>
          </div>
          {lanes.overdue.map((item) => (
            <TaskRow key={item.id} item={item} {...rowProps} />
          ))}
        </div>
      )}

      <div className="mt-1">
        {lanes.today.length === 0 && lanes.overdue.length === 0 ? (
          <LaneEmpty
            icon="coffee"
            title={t(L('Днес е чисто', 'Today is clear'))}
            body={t(
              L(
                'Издърпай нещо от „Напред“ — денят става твой, вместо да те чака.',
                'Drag something over from Ahead and the day becomes yours instead of waiting for you.',
              ),
            )}
          />
        ) : (
          lanes.today.map((item) => <TaskRow key={item.id} item={item} hideDue {...rowProps} />)
        )}
      </div>

      {lanes.doneToday.length > 0 && <DoneToday items={lanes.doneToday} onEdit={onEdit} />}
    </LaneShell>
  );

  const aheadLane = (
    <AheadLane lanes={lanes} rowProps={rowProps} over={over} armed={!!dragging} dropProps={dropProps} />
  );

  const goalsLane = (
    <LaneShell
      icon="target"
      title={t(S.goals)}
      hint={t(L('дългият план', 'the long view'))}
      count={live.length}
      accent="var(--c-warn)"
      aside={
        <button
          className="icon-btn h-7 w-7"
          aria-label={t(L('Нова цел', 'New goal'))}
          onClick={() => useApp.getState().setQuick('goal')}
        >
          <Icon name="plus" size={15} />
        </button>
      }
    >
      {live.length === 0 ? (
        <LaneEmpty
          icon="target"
          title={t(L('Още няма цел', 'No goals yet'))}
          body={t(
            L(
              'Целта е число и срок: 20 часа за проекта, 12 тренировки, 200 карти. Броенето е наша грижа.',
              'A goal is a number and a date: 20 hours on the project, 12 workouts, 200 cards. The counting is our job.',
            ),
          )}
          action={{
            label: t(L('Създай цел', 'Create a goal')),
            onClick: () => useApp.getState().setQuick('goal'),
          }}
        />
      ) : (
        <div className="stagger space-y-2 px-1 pt-1">
          {live.slice(0, 7).map((goal) => (
            <LaneGoal
              key={goal.id}
              goal={goal}
              onOpen={() => useApp.getState().goPlan('goals', null, goal.id)}
            />
          ))}
          {live.length > 7 && (
            <button
              className="w-full cursor-pointer rounded-[10px] py-2 text-[12px] text-muted transition-colors hover:bg-surface-2"
              onClick={() => useApp.getState().goPlan('goals')}
            >
              {t(L(`Още ${live.length - 7} цели →`, `${live.length - 7} more goals →`))}
            </button>
          )}
        </div>
      )}
    </LaneShell>
  );

  /* ------------------------------------------------------------- render */

  if (!wide || phone) {
    return (
      <div className="space-y-3">
        <Segmented
          value={lane}
          onChange={(v: Lane) => setLane(v)}
          items={[
            {
              id: 'today',
              label: t(L('Днес', 'Today')),
              count: lanes.today.length + lanes.overdue.length,
            },
            {
              id: 'ahead',
              label: t(L('Напред', 'Ahead')),
              count: lanes.week.length + lanes.later.length + lanes.someday.length,
            },
            { id: 'goals', label: t(S.goals), count: live.length },
          ]}
        />
        {lane === 'today' ? todayLane : lane === 'ahead' ? aheadLane : goalsLane}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.92fr)]">
      {todayLane}
      {aheadLane}
      {goalsLane}
    </div>
  );
}

/* ----------------------------------------------------------- ahead lane */

function AheadLane({
  lanes,
  rowProps,
  over,
  armed,
  dropProps,
}: {
  lanes: {
    week: PlannerItem[];
    later: PlannerItem[];
    someday: PlannerItem[];
  };
  rowProps: RowProps;
  over: string | null;
  armed: boolean;
  dropProps: (target: Lane | AheadView) => DropHandlers;
}) {
  const t = useT();
  const lang = useLang();
  const [view, setView] = useState<AheadView>('week');
  const list = view === 'week' ? lanes.week : view === 'later' ? lanes.later : lanes.someday;

  /** Dated work reads better grouped by day than as one long column. */
  const grouped = useMemo(() => {
    if (view === 'someday') return null;
    const map = new Map<string, PlannerItem[]>();
    for (const item of list) {
      const key = isoDay(new Date(item.due ?? 0));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [view, list]);

  return (
    <LaneShell
      icon="waves"
      title={t(L('Напред', 'Ahead'))}
      hint={t(L('дърпаш оттук в „Днес“', 'drag from here into Today'))}
      count={lanes.week.length + lanes.later.length + lanes.someday.length}
      accent="var(--c-muted)"
      active={over === view}
      armed={armed}
      {...dropProps(view)}
    >
      <div className="px-1 pb-2">
        <Segmented
          value={view}
          onChange={(v: AheadView) => setView(v)}
          items={[
            { id: 'week', label: t(L('Седмица', 'Week')) },
            { id: 'later', label: t(L('Нататък', 'Later')) },
            { id: 'someday', label: t(L('Някой ден', 'Someday')) },
          ]}
        />
      </div>

      <LaneAdd
        due={view === 'someday' ? null : startOfDay(addDays(view === 'week' ? 1 : 8))}
        placeholder={
          view === 'someday'
            ? t(L('Нещо за някой ден…', 'Something for someday…'))
            : t(L('Нещо напред…', 'Something ahead…'))
        }
      />

      {armed && (
        <DropHint
          label={
            view === 'someday'
              ? t(L('Пусни тук → без срок', 'Drop here → no date'))
              : view === 'later'
                ? t(L('Пусни тук → след седмица', 'Drop here → next week'))
                : t(L('Пусни тук → утре', 'Drop here → tomorrow'))
          }
          on={over === view}
        />
      )}

      {list.length === 0 ? (
        <LaneEmpty
          icon={view === 'someday' ? 'waves' : 'calendar'}
          title={
            view === 'someday'
              ? t(L('Нищо без срок', 'Nothing undated'))
              : t(L('Нищо напред', 'Nothing ahead'))
          }
          body={
            view === 'someday'
              ? t(
                  L(
                    'Тук стоят нещата, които искаш да направиш, но не си им сложил ден.',
                    'This is where things you want to do — but have not dated — wait.',
                  ),
                )
              : t(
                  L(
                    'Пусни задача тук и тя получава срок напред.',
                    'Drop a task here and it gets a deadline further out.',
                  ),
                )
          }
        />
      ) : grouped ? (
        <div className="space-y-2">
          {grouped.map(([day, group]) => (
            <div key={day}>
              <div className="flex items-baseline justify-between px-3 pb-0.5 pt-1.5">
                <span className="t-label first-letter:uppercase">
                  {formatDate(new Date(day).getTime(), lang, { weekday: 'long' })}
                  <span className="ml-2 font-normal normal-case tracking-normal text-faint">
                    {shortDate(new Date(day).getTime(), lang)}
                  </span>
                </span>
                <span className="t-num text-[11px] text-faint">{group.length}</span>
              </div>
              {group.map((item) => (
                <TaskRow key={item.id} item={item} hideDue {...rowProps} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        list.map((item) => <TaskRow key={item.id} item={item} {...rowProps} />)
      )}
    </LaneShell>
  );
}

/* ----------------------------------------------------------- a lane goal */

/**
 * A goal, at column width.
 *
 * The full card on the goals tab carries pace, health, milestones and a
 * legend. None of that fits in three hundred pixels, and a card that spills
 * its badge off the edge says the layout was not thought about. What survives
 * the cut is the question the lane is for: how far along, and how long left.
 */
function LaneGoal({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const t = useT();
  const lang = useLang();
  const ctx = useGameContext();
  const subjects = useWorkspace((s) => s.subjects);
  const subject = subjects.find((s) => s.id === goal.subjectId) ?? null;

  const value = currentValue(goal, ctx);
  const pct = goalProgress(goal, ctx);
  const left = daysLeft(goal);
  const color = goal.color ?? subject?.color ?? HEALTH_COLOR[goalHealth(goal, ctx)];
  const unit = (n: number) =>
    goal.metric === 'minutes' ? formatDuration(n, lang) : `${Math.round(n)} ${t(METRIC_UNIT[goal.metric])}`;

  return (
    <button
      onClick={onOpen}
      className="card card-hover flex w-full cursor-pointer items-center gap-3 p-3 text-left"
    >
      <ProgressRing value={pct} size={40} stroke={4} color={color} gap={0.08}>
        <span className="t-num text-[10px] font-semibold">{Math.round(pct * 100)}</span>
      </ProgressRing>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{goal.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
          <span className="t-num">
            {unit(value)}
            <span className="text-faint"> / {unit(goal.target)}</span>
          </span>
          {left !== null && (
            <span className="t-num inline-flex items-center gap-1" style={left < 3 ? { color: 'var(--c-warn)' } : undefined}>
              <Icon name="clock" size={10} />
              {left < 0
                ? t(L(`+${-left} дни`, `${-left} d over`))
                : left === 0
                  ? t(L('днес', 'today'))
                  : t(L(`${left} дни`, `${left} d`))}
            </span>
          )}
          {subject && (
            <span className="inline-flex items-center gap-1">
              <span className="badge-dot" style={{ background: subject.color }} />
              <span className="truncate">{subject.name}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/* --------------------------------------------------------------- pieces */

/**
 * One column of the board.
 *
 * Sticky heading, its own scroll on a big screen, and a visible edge when
 * something is being dragged over it — the three things that make a column
 * feel like a place you can put something rather than a list that happens to
 * be next to another list.
 */
function LaneShell({
  icon,
  title,
  hint,
  count,
  accent,
  active,
  armed,
  aside,
  children,
  ...rest
}: {
  icon: string;
  title: string;
  hint?: string;
  count: number;
  accent: string;
  active?: boolean;
  /** something is being dragged somewhere on the board */
  armed?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      {...rest}
      /* A fixed height above `lg`, not a maximum: three columns that each stop
         where their content does are three lists standing next to each other,
         and the board reads as a board only when the lanes share an edge. */
      className="card flex flex-col overflow-hidden transition-shadow lg:h-[calc(100dvh-236px)] lg:min-h-[440px]"
      style={
        active
          ? { boxShadow: `0 0 0 2px ${accent}`, background: `color-mix(in srgb, ${accent} 5%, var(--c-surface))` }
          : armed
            ? // Every lane that could take the row says so the moment one is
              // picked up. Without it, dropping is a guess: the person is
              // holding something and the board looks exactly as it did.
              { boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 45%, transparent)` }
            : undefined
      }
    >
      <header
        className="flex items-center gap-2 border-b border-line px-4 py-2.5"
        style={{ background: `color-mix(in srgb, ${accent} 5%, transparent)` }}
      >
        <Icon name={icon} size={15} style={{ color: accent }} />
        <h2 className="text-[13.5px] font-semibold tracking-[-0.01em]">{title}</h2>
        <span
          className="t-num grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-semibold"
          style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
        >
          {count}
        </span>
        {hint && <span className="ml-1 hidden truncate text-[11.5px] text-faint xl:inline">{hint}</span>}
        <span className="ml-auto shrink-0">{aside}</span>
      </header>
      <div className="scroll-thin min-h-[120px] flex-1 overflow-y-auto p-2">{children}</div>
    </section>
  );
}

/**
 * What dropping here would actually do, said in words while the row is in
 * the air. The lanes mean different dates, and "Ahead" means three different
 * ones depending on which segment is showing — a person holding a task should
 * not have to remember which.
 */
function DropHint({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      className="mb-1.5 rounded-[10px] border border-dashed px-3 py-2 text-center text-[12px] font-medium transition-colors"
      style={{
        borderColor: on ? 'var(--c-accent)' : 'var(--c-line-strong)',
        background: on ? 'var(--c-accent-soft)' : 'transparent',
        color: on ? 'var(--c-accent)' : 'var(--c-faint)',
      }}
    >
      {label}
    </div>
  );
}

function LaneEmpty({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="px-2 py-6">
      <EmptyState icon={icon} title={title} body={body} action={action ? { ...action, icon: 'plus' } : undefined} />
    </div>
  );
}

/**
 * The field that stays.
 *
 * One line per lane, Enter saves, and the lane decides the deadline — which
 * is the fastest path there is from a thought to a record, and the reason the
 * board needs no "new entry" dialog for ordinary work.
 */
function LaneAdd({ due, placeholder }: { due: number | null; placeholder: string }) {
  const t = useT();
  const lang = useLang();
  const custom = useItemTypes((s) => s.custom);
  const types = useMemo(() => allTypes(custom), [custom]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('task');
  const ref = useRef<HTMLInputElement>(null);
  const type = typeOf(kind, custom);
  const subjectId = useApp((s) => s.filterSubjectId);

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    setTitle('');
    const defaults = KIND_DEFAULTS[kind] ?? {};
    // A reminder without a time is a to-do with extra steps; one made from
    // this field gets the next round hour, which is nearly always what the
    // person meant and is one click to change.
    const remindAt = defaults.remind ? nextRoundHour(due) : null;
    await usePlanner.getState().addItem({
      title: value,
      subjectId,
      due,
      kind,
      method: defaults.method ?? 'check',
      repeat: defaults.repeat ?? 'none',
      remindAt,
    });
    if (remindAt) noteReminderSaved();
    ref.current?.focus();
  };

  return (
    <div className="mb-1 flex items-center gap-1.5 rounded-[10px] border border-line px-2 py-1.5 transition-colors focus-within:border-line-strong">
      <Popover
        width={190}
        trigger={({ toggle, ref: r }) => (
          <button
            ref={r}
            onClick={toggle}
            aria-label={t(L('Вид', 'Type'))}
            className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[7px]"
            style={{
              background: type.color
                ? `color-mix(in srgb, ${type.color} 15%, transparent)`
                : 'var(--c-accent-soft)',
              color: type.color ?? 'var(--c-accent)',
            }}
          >
            <Icon name={type.icon} size={13} strokeWidth={2} />
          </button>
        )}
      >
        {(close) => (
          <>
            {types.map((x) => (
              <MenuItem
                key={x.id}
                icon={x.icon}
                active={kind === x.id}
                label={typeName(x, lang)}
                onClick={() => {
                  setKind(x.id);
                  close();
                  ref.current?.focus();
                }}
              />
            ))}
          </>
        )}
      </Popover>

      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') setTitle('');
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
      />

      {title.trim() && (
        <button
          className="icon-btn h-6 w-6 shrink-0"
          aria-label={t(S.add)}
          onClick={() => void submit()}
        >
          <Icon name="check" size={13} />
        </button>
      )}
    </div>
  );
}

/**
 * Throwing away what is finished, with the way back attached.
 *
 * It used to open a confirmation dialog. "Are you sure?" in front of an
 * action that is both common and reversible trains people to click through
 * dialogs without reading them — which is exactly the habit you do not want
 * them to have the day one of them really matters. The entries go, and the
 * toast holds them for nine seconds.
 */
export async function clearDone(t: (m: { bg: string; en: string }) => string): Promise<void> {
  const gone = await usePlanner.getState().clearCompleted();
  if (!gone.length) return;
  notify.undo(
    t(L(`Изчистени ${gone.length} завършени`, `Cleared ${gone.length} completed`)),
    t(L('Върни', 'Undo')),
    () => void usePlanner.getState().restoreItems(gone),
  );
}

/** The next full hour, on the entry's own day where it has one. */
function nextRoundHour(due: number | null): number {
  const base = due === null || due <= startOfDay() ? new Date() : new Date(due);
  if (due !== null && due > startOfDay()) {
    base.setHours(9, 0, 0, 0);
    return base.getTime();
  }
  base.setHours(base.getHours() + 1, 0, 0, 0);
  return base.getTime();
}

/** What is already behind you today, folded away but countable. */
function DoneToday({ items, onEdit }: { items: PlannerItem[]; onEdit: (i: PlannerItem) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 border-t border-line pt-1.5">
      <div className="flex items-center">
        <button
          className="flex flex-1 cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] text-muted transition-colors hover:bg-surface-2"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} />
          {t(L(`Готови днес · ${items.length}`, `Done today · ${items.length}`))}
        </button>
        <button
          className="icon-btn h-6 w-6 shrink-0"
          aria-label={t(L('Изчисти завършените', 'Clear completed'))}
          onClick={() => void clearDone(t)}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
      {open && items.map((item) => <TaskRow key={item.id} item={item} dense onEdit={onEdit} />)}
    </div>
  );
}
