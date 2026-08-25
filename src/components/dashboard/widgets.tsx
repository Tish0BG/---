import { useMemo, type ReactNode } from 'react';
import type { Msg, WidgetSize } from './widgetTypes';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { progressOf, useLibrary } from '@/state/libraryStore';
import { useCards, dueCount } from '@/state/cardStore';
import { useItemTypes, typeOf } from '@/state/itemTypeStore';
import {
  usePlanner,
  dueToday,
  overdue,
  upcomingExams,
  daysUntil,
  averageFor,
  currentClass,
  toMinutes,
} from '@/state/plannerStore';
import { useTimer, dayKey, minutesBySubject, statsForDay } from '@/state/timerStore';
import { useSettings } from '@/state/settingsStore';
import { useGoals, activeGoals } from '@/state/goalStore';
import { useGame, useGameContext } from '@/state/gameStore';
import {
  ACHIEVEMENTS,
  TIER_COLOR,
  currentStreak,
  levelState,
  levelTitle,
  longestStreak,
  totalXp,
} from '@/services/gameService';
import { goalProgress, goalHealth, HEALTH_COLOR } from '@/services/goalService';
import { openDoc } from '@/services/openDoc';
import { useT, useLang, L, formatDuration, weekdayNames, shortDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import {
  BarChart,
  Card,
  CardLink,
  Donut,
  EmptyState,
  ProgressBar,
  ProgressRing,
  StatCard,
  SERIES_COLORS,
  OTHER_COLOR,
} from '../kit';
import { NextStep } from './NextStep';
import { TodayPlan } from './TodayPlan';

/**
 * ─────────────────────────────────────────────── the dashboard's parts ──
 *
 * The dashboard used to be one fixed composition: four numbers, a timeline, a
 * chart and a right-hand rail, in that order, for everybody. Which is fine
 * until you notice that the person revising for finals and the person keeping
 * a reading habit want to open the app to completely different things.
 *
 * So the screen is a list of panels now, and this is the catalogue they come
 * from. A panel is a title, an icon, a sentence saying what it is for, the
 * widths it is willing to be, and a component. Nothing here knows about the
 * grid, the edit mode or the settings — adding a panel to the product means
 * adding one entry to this list.
 */

export interface WidgetDef {
  id: string;
  title: Msg;
  /** one line in the "add a panel" picker */
  hint: Msg;
  icon: string;
  /** widths this panel reads well at, narrowest first */
  sizes: WidgetSize[];
  defaultSize: WidgetSize;
  render: () => ReactNode;
}

/* --------------------------------------------------------------- panels */

function TodayGoal() {
  const t = useT();
  const lang = useLang();
  const sessions = useTimer((s) => s.sessions);
  const goal = useSettings((s) => s.timer.goal);
  const today = useMemo(() => statsForDay(sessions, dayKey()), [sessions]);
  const pct = Math.min(1, today.minutes / Math.max(1, goal));

  return (
    <StatCard
      className="h-full"
      label={t(L('Днес', 'Today'))}
      value={formatDuration(today.minutes, lang)}
      icon="gauge"
      tone="var(--c-accent)"
      ring={pct}
      progress={pct}
      hint={
        today.minutes >= goal
          ? t(L('Дневната цел е изпълнена.', 'The daily goal is met.'))
          : t(
              L(
                `Още ${goal - today.minutes} мин до целта.`,
                `${goal - today.minutes} min to go.`,
              ),
            )
      }
      onClick={() => useApp.getState().go('focus')}
    />
  );
}

function StreakCard() {
  const t = useT();
  const sessions = useTimer((s) => s.sessions);
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
  const best = useMemo(() => longestStreak(sessions), [sessions]);
  return (
    <StatCard
      className="h-full"
      label={t(S.streak)}
      value={streak}
      unit={t(streak === 1 ? L('ден', 'day') : L('дни', 'days'))}
      icon="flame"
      tone="var(--c-ember)"
      hint={t(L(`Най-дълга серия: ${best} дни`, `Longest run: ${best} days`))}
      onClick={() => useApp.getState().go('stats')}
    />
  );
}

function TasksToday() {
  const t = useT();
  const items = usePlanner((s) => s.items);
  const today = useMemo(() => dueToday(items), [items]);
  const late = useMemo(() => overdue(items), [items]);
  const done = useMemo(
    () => items.filter((i) => i.done && i.completedAt && i.completedAt >= new Date().setHours(0, 0, 0, 0)).length,
    [items],
  );
  return (
    <StatCard
      className="h-full"
      label={t(L('Готови днес', 'Done today'))}
      value={done}
      unit={t(L(`от ${done + today.length}`, `of ${done + today.length}`))}
      icon="listTodo"
      tone={late.length ? 'var(--c-danger)' : 'var(--c-brand)'}
      progress={done + today.length ? done / (done + today.length) : 0}
      hint={
        late.length
          ? t(L(`${late.length} просрочени чакат`, `${late.length} overdue waiting`))
          : t(L('Всичко е в срок.', 'Everything on time.'))
      }
      onClick={() => useApp.getState().goPlan('work')}
    />
  );
}

function CardsDue() {
  const t = useT();
  const cards = useCards((s) => s.cards);
  const due = useMemo(() => dueCount(cards), [cards]);
  return (
    <StatCard
      className="h-full"
      label={t(L('За преговор', 'To review'))}
      value={due}
      unit={t(L('карти', 'cards'))}
      icon="cards"
      tone="var(--c-aurora)"
      hint={
        due
          ? t(L('Няколко минути стигат.', 'A few minutes is enough.'))
          : t(L('Няма нищо за днес.', 'Nothing due today.'))
      }
      onClick={() => useApp.getState().go('cards')}
    />
  );
}

function LevelCard() {
  const t = useT();
  const ctx = useGameContext();
  const level = useMemo(() => levelState(totalXp(ctx)), [ctx]);
  return (
    <Card title={t(S.level)} icon="medal" className="h-full">
      <div className="flex items-center gap-4">
        <ProgressRing value={level.progress} size={58} stroke={5} color="var(--c-brand)">
          <span className="t-num text-[16px] font-semibold">{level.level}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium">{t(levelTitle(level.level))}</p>
          <p className="t-num mt-1 text-[11.5px] text-muted">
            {t(
              L(
                `${level.xp - level.floor} / ${level.ceiling - level.floor} XP до следващото`,
                `${level.xp - level.floor} / ${level.ceiling - level.floor} XP to next`,
              ),
            )}
          </p>
          <div className="mt-2">
            <ProgressBar value={level.progress} height={5} color="var(--c-brand)" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function WeekFocus() {
  const t = useT();
  const lang = useLang();
  const sessions = useTimer((s) => s.sessions);
  const dailyGoal = useSettings((s) => s.timer.goal);

  const week = useMemo(() => {
    const names = weekdayNames(lang);
    const out: { label: string; value: number; current?: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({
        label: names[(d.getDay() + 6) % 7],
        value: statsForDay(sessions, dayKey(d)).minutes,
        current: i === 0,
      });
    }
    return out;
  }, [sessions, lang]);

  const total = week.reduce((s, d) => s + d.value, 0);
  const prev = useMemo(() => {
    let sum = 0;
    for (let i = 13; i >= 7; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      sum += statsForDay(sessions, dayKey(d)).minutes;
    }
    return sum;
  }, [sessions]);
  const delta = prev ? Math.round(((total - prev) / prev) * 100) : null;

  return (
    <Card
      className="h-full"
      title={t(L('Тази седмица', 'This week'))}
      subtitle={t(
        L(
          `${formatDuration(total, lang)} общо${delta !== null ? ` · ${delta >= 0 ? '+' : ''}${delta}% спрямо миналата` : ''}`,
          `${formatDuration(total, lang)} total${delta !== null ? ` · ${delta >= 0 ? '+' : ''}${delta}% vs last week` : ''}`,
        ),
      )}
      icon="chart"
      action={<CardLink label={t(S.stats)} onClick={() => useApp.getState().go('stats')} />}
    >
      <BarChart
        data={week.map((d) => ({
          ...d,
          tip: (
            <>
              <span className="t-num font-semibold">{formatDuration(d.value, lang)}</span>
              <span className="ml-1 opacity-70">{d.label}</span>
            </>
          ),
        }))}
        goal={dailyGoal}
        goalLabel={t(L('цел', 'goal'))}
        format={(v) => formatDuration(v, lang)}
      />
    </Card>
  );
}

function Recent() {
  const t = useT();
  const documents = useLibrary((s) => s.documents);
  const subjects = useWorkspace((s) => s.subjects);
  const recent = useMemo(
    () =>
      documents
        .filter((d) => d.openedAt && !d.deletedAt)
        .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
        .slice(0, 4),
    [documents],
  );

  return (
    <Card
      className="h-full"
      title={t(L('Продължи оттам', 'Pick up where you left off'))}
      icon="history"
      action={<CardLink label={t(S.library)} onClick={() => useApp.getState().go('drive')} />}
    >
      {recent.length === 0 ? (
        <EmptyState
          compact
          icon="drive"
          title={t(L('Още нищо отворено', 'Nothing opened yet'))}
          body={t(L('Каквото отвориш, се появява тук.', 'Whatever you open shows up here.'))}
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {recent.map((doc) => {
            const subject = subjects.find((s) => s.id === doc.subjectId);
            const written = doc.kind === 'note';
            return (
              <button
                key={doc.id}
                onClick={() => void openDoc(doc.id)}
                className="card card-hover flex cursor-pointer items-center gap-3 p-3 text-left"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[10px]"
                  style={{
                    background: subject
                      ? `color-mix(in srgb, ${subject.color} 14%, transparent)`
                      : 'var(--c-surface-3)',
                    color: subject?.color ?? 'var(--c-muted)',
                  }}
                >
                  {doc.cover ? (
                    <img src={doc.cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon name={doc.kind === 'board' ? 'board' : written ? 'notebook' : 'book'} size={19} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{doc.name}</span>
                  {written ? (
                    <span className="t-num mt-1.5 block text-[11px] text-muted">
                      {t(L(`${doc.note?.words ?? 0} думи`, `${doc.note?.words ?? 0} words`))}
                    </span>
                  ) : (
                    <>
                      <span className="mt-1 block">
                        <ProgressBar
                          value={progressOf(doc)}
                          height={4}
                          color={subject?.color ?? 'var(--c-brand)'}
                        />
                      </span>
                      <span className="t-num mt-1.5 block text-[11px] text-muted">
                        {t(
                          L(
                            `стр. ${doc.lastPage} от ${doc.pageCount}`,
                            `page ${doc.lastPage} of ${doc.pageCount}`,
                          ),
                        )}
                      </span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Exams() {
  const t = useT();
  const items = usePlanner((s) => s.items);
  const subjects = useWorkspace((s) => s.subjects);
  const exams = useMemo(() => upcomingExams(items, 60).slice(0, 4), [items]);

  return (
    <Card
      className="h-full"
      title={t(L('Предстоящи изпити', 'Upcoming exams'))}
      icon="graduation"
      action={<CardLink label={t(S.all)} onClick={() => useApp.getState().goPlan('work', 'exam')} />}
      flush
    >
      {exams.length === 0 ? (
        <EmptyState
          compact
          icon="graduation"
          title={t(L('Няма насрочени изпити', 'No exams scheduled'))}
          body={t(L('Добави изпит и ще го следим оттук.', 'Add one and it gets a countdown here.'))}
          action={{
            label: t(L('Добави изпит', 'Add exam')),
            icon: 'plus',
            onClick: () => useApp.getState().setQuick('item', 'exam'),
          }}
        />
      ) : (
        <ul className="stagger px-2 pb-3">
          {exams.map((exam) => {
            const days = exam.due ? daysUntil(exam.due) : 0;
            const subject = subjects.find((s) => s.id === exam.subjectId);
            const urgent = days <= 3;
            return (
              <li key={exam.id}>
                <button
                  onClick={() => useApp.getState().goPlan('work', 'exam', exam.id)}
                  className="row w-full text-left"
                >
                  <span
                    className="t-num grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[15px] font-semibold"
                    style={{
                      background: urgent
                        ? 'color-mix(in srgb, var(--c-danger) 12%, transparent)'
                        : `color-mix(in srgb, ${subject?.color ?? 'var(--c-brand)'} 12%, transparent)`,
                      color: urgent ? 'var(--c-danger)' : (subject?.color ?? 'var(--c-brand)'),
                    }}
                  >
                    {days <= 0 ? '!' : days}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{exam.title}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                      {subject?.name ?? t(S.noSubject)} ·{' '}
                      {days <= 0
                        ? t(L('днес', 'today'))
                        : days === 1
                          ? t(L('утре', 'tomorrow'))
                          : t(L(`след ${days} дни`, `in ${days} days`))}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={15} className="shrink-0 text-faint" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function GoalsPanel() {
  const t = useT();
  const goals = useGoals((s) => s.goals);
  const ctx = useGameContext();
  const live = useMemo(() => activeGoals(goals).slice(0, 4), [goals]);

  return (
    <Card
      className="h-full"
      title={t(S.goals)}
      icon="target"
      action={<CardLink label={t(S.all)} onClick={() => useApp.getState().goPlan('goals')} />}
      flush
    >
      {live.length === 0 ? (
        <EmptyState
          compact
          icon="target"
          title={t(L('Още няма цел', 'No goals yet'))}
          body={t(
            L(
              'Задай цел и следи как се движи сама с часовете ти.',
              'Set a goal and watch it move on its own as you work.',
            ),
          )}
          action={{
            label: t(L('Създай цел', 'Create goal')),
            icon: 'plus',
            onClick: () => useApp.getState().setQuick('goal'),
          }}
        />
      ) : (
        <ul className="space-y-3 px-4 pb-4">
          {live.map((goal) => {
            const pct = goalProgress(goal, ctx);
            const health = goalHealth(goal, ctx);
            return (
              <li key={goal.id}>
                <button
                  onClick={() => useApp.getState().goPlan('goals', null, goal.id)}
                  className="w-full cursor-pointer text-left"
                >
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{goal.title}</span>
                    <span className="t-num shrink-0 text-[12px] text-muted">{Math.round(pct * 100)}%</span>
                  </div>
                  <ProgressBar value={pct} height={6} color={HEALTH_COLOR[health]} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SubjectSplit() {
  const t = useT();
  const lang = useLang();
  const sessions = useTimer((s) => s.sessions);
  const subjects = useWorkspace((s) => s.subjects);

  const data = useMemo(() => {
    const rows = minutesBySubject(sessions, 7);
    const named = rows.map((row, i) => ({
      label: subjects.find((s) => s.id === row.subjectId)?.name ?? t(S.noSubject),
      value: row.minutes,
      color: subjects.find((s) => s.id === row.subjectId)?.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
    }));
    if (named.length <= 6) return named;
    const head = named.slice(0, 5);
    const rest = named.slice(5).reduce((sum, r) => sum + r.value, 0);
    return [...head, { label: t(L('Други', 'Other')), value: rest, color: OTHER_COLOR }];
  }, [sessions, subjects, t]);

  return (
    <Card
      className="h-full"
      title={t(L('По предмети', 'By subject'))}
      subtitle={t(L('последните 7 дни', 'last 7 days'))}
      icon="pie"
    >
      {data.length === 0 ? (
        <EmptyState
          compact
          icon="waves"
          title={t(L('Няма данни още', 'Nothing to show yet'))}
          body={t(
            L(
              'Пусни фокус сесия и разпределението се появява само.',
              'Run a focus session and this fills itself in.',
            ),
          )}
        />
      ) : (
        <Donut
          data={data}
          centerLabel={t(L('общо', 'total'))}
          centerValue={formatDuration(
            data.reduce((s, d) => s + d.value, 0),
            lang,
          )}
          format={(v) => formatDuration(v, lang)}
        />
      )}
    </Card>
  );
}

/** The subject list that used to clutter the navigation rail, as a panel. */
function SubjectsPanel() {
  const t = useT();
  const subjects = useWorkspace((s) => s.subjects);
  const grades = usePlanner((s) => s.grades);
  const items = usePlanner((s) => s.items);
  const live = useMemo(() => subjects.filter((s) => !s.archived).slice(0, 8), [subjects]);

  return (
    <Card
      className="h-full"
      title={t(S.subjects)}
      icon="layers"
      action={<CardLink label={t(S.all)} onClick={() => useApp.getState().go('subjects')} />}
      flush
    >
      {live.length === 0 ? (
        <EmptyState
          compact
          icon="layers"
          title={t(L('Няма предмети', 'No subjects yet'))}
          body={t(L('Предметите оцветяват всичко останало.', 'Subjects colour everything else in.'))}
          action={{
            label: t(L('Добави предмет', 'Add a subject')),
            icon: 'plus',
            onClick: () => useApp.getState().go('subjects'),
          }}
        />
      ) : (
        <div className="grid gap-1 px-2 pb-3 sm:grid-cols-2">
          {live.map((subject) => {
            const avg = averageFor(grades, subject.id);
            const open = items.filter((i) => !i.done && i.subjectId === subject.id).length;
            return (
              <button
                key={subject.id}
                onClick={() => useApp.getState().openSubject(subject.id)}
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
                  style={{
                    background: `color-mix(in srgb, ${subject.color} 15%, transparent)`,
                    color: subject.color,
                  }}
                >
                  <Icon name={subject.icon} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{subject.name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {open ? t(L(`${open} отворени`, `${open} open`)) : t(L('нищо отворено', 'nothing open'))}
                  </span>
                </span>
                {avg.count > 0 && (
                  <span className="t-num shrink-0 text-[12.5px] font-semibold" style={{ color: subject.color }}>
                    {avg.average.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/**
 * Today's lessons, as a list.
 *
 * The full week grid lives on the calendar, where it has the width for seven
 * columns. A dashboard panel three columns wide can carry today — which is
 * the only day this screen is ever asking about.
 */
function TodayClasses() {
  const t = useT();
  const schedule = usePlanner((s) => s.schedule);
  const subjects = useWorkspace((s) => s.subjects);
  const next = useMemo(() => currentClass(schedule), [schedule]);

  const today = useMemo(
    () =>
      schedule
        .filter((s) => s.day === new Date().getDay())
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
    [schedule],
  );

  const passed = (end: string) => {
    const now = new Date();
    return toMinutes(end) < now.getHours() * 60 + now.getMinutes();
  };

  return (
    <Card
      className="h-full"
      title={t(L('Програмата днес', 'Today’s timetable'))}
      icon="calendar"
      subtitle={
        next
          ? next.now
            ? t(L('Час в момента', 'A lesson right now'))
            : t(L('Следващият час', 'Next up'))
          : today.length
            ? t(L('Часовете за днес свършиха', 'Today’s lessons are over'))
            : t(L('Нищо в програмата днес', 'Nothing scheduled today'))
      }
      action={<CardLink label={t(S.calendar)} onClick={() => useApp.getState().go('calendar')} />}
      flush
    >
      {today.length === 0 ? (
        <EmptyState
          compact
          icon="coffee"
          title={t(L('Свободен ден', 'A free day'))}
          body={t(L('Часовете се добавят от календара.', 'Lessons are added from the calendar.'))}
        />
      ) : (
        <ul className="px-2 pb-3">
          {today.map((slot) => {
            const subject = subjects.find((s) => s.id === slot.subjectId);
            const now = next?.now && next.slot.id === slot.id;
            const over = passed(slot.end);
            return (
              <li
                key={slot.id}
                className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors"
                style={{
                  background: now ? 'var(--c-accent-soft)' : undefined,
                  opacity: over && !now ? 0.5 : 1,
                }}
              >
                <span className="t-num w-[46px] shrink-0 text-[12px] text-muted">{slot.start}</span>
                <span
                  className="h-7 w-[3px] shrink-0 rounded-full"
                  style={{ background: subject?.color ?? 'var(--c-line-strong)' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{subject?.name ?? '—'}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {slot.start}–{slot.end}
                    {slot.room ? ` · ${slot.room}` : ''}
                  </span>
                </span>
                {now && (
                  <span className="chip shrink-0" style={{ background: 'var(--c-accent)', color: '#fff' }}>
                    {t(L('сега', 'now'))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function RecentAchievements() {
  const t = useT();
  const lang = useLang();
  const unlocked = useGame((s) => s.unlocked);

  const recent = useMemo(
    () =>
      Object.entries(unlocked)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id, at]) => ({ def: ACHIEVEMENTS.find((a) => a.id === id), at }))
        .filter((x) => x.def),
    [unlocked],
  );

  return (
    <Card
      className="h-full"
      title={t(S.achievements)}
      icon="trophy"
      action={<CardLink label={t(S.all)} onClick={() => useApp.getState().go('achievements')} />}
      flush
    >
      {recent.length === 0 ? (
        <EmptyState
          compact
          icon="trophy"
          title={t(L('Още нищо отключено', 'Nothing unlocked yet'))}
          body={t(L('Първата фокус сесия отключва първото.', 'The first focus session unlocks the first one.'))}
        />
      ) : (
        <ul className="px-2 pb-3">
          {recent.map(({ def, at }) => (
            <li key={def!.id} className="flex items-center gap-3 rounded-[10px] px-2 py-2">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                style={{
                  background: `color-mix(in srgb, ${TIER_COLOR[def!.tier]} 16%, transparent)`,
                  color: TIER_COLOR[def!.tier],
                }}
              >
                <Icon name={def!.icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{t(def!.title)}</span>
                <span className="block truncate text-[11px] text-muted">{shortDate(at, lang)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Written documents, newest first — the library's third kind, up front. */
function NotesPanel() {
  const t = useT();
  const lang = useLang();
  const documents = useLibrary((s) => s.documents);
  const notes = useMemo(
    () =>
      documents
        .filter((d) => d.kind === 'note' && !d.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5),
    [documents],
  );

  return (
    <Card
      className="h-full"
      title={t(L('Записки', 'Written notes'))}
      icon="notebook"
      action={<CardLink label={t(S.library)} onClick={() => useApp.getState().go('drive')} />}
      flush
    >
      {notes.length === 0 ? (
        <EmptyState
          compact
          icon="notebook"
          title={t(L('Още няма документи', 'No documents yet'))}
          body={t(L('Създай текстов документ от бутона „Създай“.', 'Make a text document from the New button.'))}
        />
      ) : (
        <ul className="px-2 pb-3">
          {notes.map((doc) => (
            <li key={doc.id}>
              <button onClick={() => void openDoc(doc.id)} className="row w-full text-left">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                  style={{ background: 'var(--c-surface-3)', color: 'var(--c-muted)' }}
                >
                  <Icon name="notebook" size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{doc.name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {doc.note?.text?.slice(0, 60) || t(L('празен', 'empty'))}
                  </span>
                </span>
                <span className="t-num shrink-0 text-[11px] text-faint">{shortDate(doc.updatedAt, lang)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuickActions() {
  const t = useT();
  const custom = useItemTypes((s) => s.custom);

  // The person's own types are the fastest thing to offer here: if somebody
  // made a "rehearsal" type, "add a rehearsal" is a button they want.
  const mine = custom.slice(0, 2);

  const actions = [
    {
      icon: 'listTodo',
      label: t(S.task),
      run: () => useApp.getState().setQuick('item', 'task'),
    },
    ...mine.map((type) => ({
      icon: type.icon,
      label: type.name,
      run: () => useApp.getState().setQuick('item', type.id),
    })),
    { icon: 'target', label: t(S.goal), run: () => useApp.getState().setQuick('goal') },
    {
      icon: 'timer',
      label: t(S.focus),
      run: () => useApp.getState().go('focus'),
    },
  ].slice(0, 4);

  return (
    <Card className="h-full" title={t(L('Бързи действия', 'Quick actions'))} icon="bolt">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.run}
            className="flex cursor-pointer flex-col items-start gap-2 rounded-[12px] border border-line p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-sm)]"
            style={{ background: 'var(--c-surface-2)' }}
          >
            <Icon name={action.icon} size={17} className="text-accent" />
            <span className="truncate text-[12.5px] font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** Everything open, by type — the quickest read of what the week holds. */
function ByType() {
  const t = useT();
  const lang = useLang();
  const items = usePlanner((s) => s.items);
  const custom = useItemTypes((s) => s.custom);

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) if (!item.done) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    return [...counts.entries()]
      .map(([kind, count]) => ({ type: typeOf(kind, custom), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [items, custom]);

  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card
      className="h-full"
      title={t(L('Отворено по вид', 'Open by type'))}
      icon="layers"
      action={<CardLink label={t(S.all)} onClick={() => useApp.getState().goPlan('work')} />}
    >
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon="checkCircle"
          title={t(L('Нищо отворено', 'Nothing open'))}
          body={t(L('Рядко и хубаво състояние.', 'Rare and good.'))}
        />
      ) : (
        <div className="space-y-2">
          {rows.map(({ type, count }) => {
            const tint = type.color ?? 'var(--c-brand)';
            return (
              <button
                key={type.id}
                onClick={() => useApp.getState().goPlan('work', type.id)}
                className="flex w-full cursor-pointer items-center gap-2.5 text-left"
              >
                <Icon name={type.icon} size={14} style={{ color: tint }} className="shrink-0" />
                <span className="w-[86px] shrink-0 truncate text-[12.5px]">
                  {lang === 'en' && type.nameEn ? type.nameEn : type.name}
                </span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${(count / max) * 100}%`, background: tint }}
                  />
                </span>
                <span className="t-num w-6 shrink-0 text-right text-[12px] text-muted">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- registry */

export const WIDGETS: WidgetDef[] = [
  {
    id: 'next-step',
    title: L('Следващата стъпка', 'The next step'),
    hint: L('Едно предложение какво да направиш сега', 'One suggestion for what to do right now'),
    icon: 'sparkles',
    sizes: ['full'],
    defaultSize: 'full',
    render: () => <NextStep />,
  },
  {
    id: 'today-goal',
    title: L('Днешната цел', 'Today’s goal'),
    hint: L('Колко от дневната цел е изкарана', 'How much of the daily goal is done'),
    icon: 'gauge',
    sizes: ['quarter', 'third', 'half'],
    defaultSize: 'quarter',
    render: () => <TodayGoal />,
  },
  {
    id: 'streak',
    title: L('Серия', 'Streak'),
    hint: L('Дни поред с учене', 'Days in a row with something logged'),
    icon: 'flame',
    sizes: ['quarter', 'third'],
    defaultSize: 'quarter',
    render: () => <StreakCard />,
  },
  {
    id: 'tasks-today',
    title: L('Задачи днес', 'Work today'),
    hint: L('Готови от днешните, плюс просрочените', 'Done out of today’s, plus what is late'),
    icon: 'listTodo',
    sizes: ['quarter', 'third'],
    defaultSize: 'quarter',
    render: () => <TasksToday />,
  },
  {
    id: 'cards-due',
    title: L('Карти за преговор', 'Cards to review'),
    hint: L('Колко флашкарти чакат днес', 'How many flashcards are due'),
    icon: 'cards',
    sizes: ['quarter', 'third'],
    defaultSize: 'quarter',
    render: () => <CardsDue />,
  },
  {
    id: 'level',
    title: L('Ниво', 'Level'),
    hint: L('Опитът ти и колко остава', 'Your XP and how far to the next level'),
    icon: 'medal',
    sizes: ['quarter', 'third', 'half'],
    defaultSize: 'third',
    render: () => <LevelCard />,
  },
  {
    id: 'today-plan',
    title: L('Планът за днес', 'Today’s plan'),
    hint: L('Часове и срокове за деня, подредени', 'Lessons and deadlines for the day, in order'),
    icon: 'calendarCheck',
    sizes: ['half', 'full'],
    defaultSize: 'half',
    render: () => <TodayPlan />,
  },
  {
    id: 'week-focus',
    title: L('Седмицата', 'This week'),
    hint: L('Минути на ден през последните 7 дни', 'Minutes a day over the last seven'),
    icon: 'chart',
    sizes: ['half', 'full'],
    defaultSize: 'half',
    render: () => <WeekFocus />,
  },
  {
    id: 'recent',
    title: L('Продължи оттам', 'Pick up where you left off'),
    hint: L('Последно отваряните материали', 'The materials you opened last'),
    icon: 'history',
    sizes: ['half', 'full'],
    defaultSize: 'half',
    render: () => <Recent />,
  },
  {
    id: 'exams',
    title: L('Предстоящи изпити', 'Upcoming exams'),
    hint: L('Обратно броене до всеки изпит', 'A countdown to each one'),
    icon: 'graduation',
    sizes: ['third', 'half'],
    defaultSize: 'third',
    render: () => <Exams />,
  },
  {
    id: 'goals',
    title: L('Цели', 'Goals'),
    hint: L('Докъде са стигнали активните цели', 'How far the live goals have got'),
    icon: 'target',
    sizes: ['third', 'half'],
    defaultSize: 'third',
    render: () => <GoalsPanel />,
  },
  {
    id: 'subject-split',
    title: L('Време по предмети', 'Time by subject'),
    hint: L('Как се разпределя седмицата', 'How the week is divided up'),
    icon: 'pie',
    sizes: ['third', 'half'],
    defaultSize: 'third',
    render: () => <SubjectSplit />,
  },
  {
    id: 'subjects',
    title: L('Предмети', 'Subjects'),
    hint: L('Предметите с оценките и отворената работа', 'Your subjects, with averages and open work'),
    icon: 'layers',
    sizes: ['third', 'half', 'full'],
    defaultSize: 'half',
    render: () => <SubjectsPanel />,
  },
  {
    id: 'timetable',
    title: L('Програмата днес', 'Today’s timetable'),
    hint: L('Часовете за деня', 'The lessons for the day'),
    icon: 'calendar',
    sizes: ['third', 'half'],
    defaultSize: 'third',
    render: () => <TodayClasses />,
  },
  {
    id: 'by-type',
    title: L('Отворено по вид', 'Open by type'),
    hint: L('Колко отворени има от всеки твой тип', 'How much is open of each of your types'),
    icon: 'layers',
    sizes: ['third', 'half'],
    defaultSize: 'third',
    render: () => <ByType />,
  },
  {
    id: 'notes',
    title: L('Записки', 'Written notes'),
    hint: L('Последно редактираните документи', 'The documents you edited last'),
    icon: 'notebook',
    sizes: ['third', 'half'],
    defaultSize: 'third',
    render: () => <NotesPanel />,
  },
  {
    id: 'achievements',
    title: L('Постижения', 'Achievements'),
    hint: L('Последно отключените', 'The most recently unlocked'),
    icon: 'trophy',
    sizes: ['third', 'half'],
    defaultSize: 'third',
    render: () => <RecentAchievements />,
  },
  {
    id: 'quick-actions',
    title: L('Бързи действия', 'Quick actions'),
    hint: L('Четири бутона за най-честите неща', 'Four buttons for the things you do most'),
    icon: 'bolt',
    sizes: ['quarter', 'third', 'half'],
    defaultSize: 'third',
    render: () => <QuickActions />,
  },
];

export const widgetById = (id: string): WidgetDef | undefined => WIDGETS.find((w) => w.id === id);

export { DEFAULT_DASHBOARD } from './dashboardDefaults';
