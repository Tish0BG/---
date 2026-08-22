import { useMemo } from 'react';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { progressOf, useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { usePlanner, dueToday, overdue, upcomingExams, daysUntil } from '@/state/plannerStore';
import { useTimer, dayKey, minutesBySubject, statsForDay } from '@/state/timerStore';
import { useSettings } from '@/state/settingsStore';
import { useGoals, activeGoals } from '@/state/goalStore';
import { useGameContext } from '@/state/gameStore';
import { currentStreak, longestStreak } from '@/services/gameService';
import { goalProgress, goalHealth, HEALTH_COLOR } from '@/services/goalService';
import { useT, useLang, L, formatDuration, weekdayNames } from '@/i18n';
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
  SectionHeader,
  StatCard,
  SERIES_COLORS,
  OTHER_COLOR,
} from '../kit';
import { Hero } from './Hero';
import { TodayPlan } from './TodayPlan';

/**
 * The command centre.
 *
 * Reading order is deliberate: who and how you are doing (hero), the four
 * numbers that decide today (stats), what is actually planned (timeline and
 * week), and only then what is coming (exams, goals, subjects). Nothing on
 * this screen is decoration — every card is a live query with an action.
 */
export function Dashboard({ onUpload }: { onNewBoard: () => void; onUpload: () => void }) {
  const t = useT();
  const lang = useLang();
  const items = usePlanner((s) => s.items);
  const sessions = useTimer((s) => s.sessions);
  const cards = useCards((s) => s.cards);
  const documents = useLibrary((s) => s.documents);
  const subjects = useWorkspace((s) => s.subjects);
  const goals = useGoals((s) => s.goals);
  const dailyGoal = useSettings((s) => s.timer.goal);
  const ctx = useGameContext();

  const today = useMemo(() => statsForDay(sessions, dayKey()), [sessions]);
  const streak = useMemo(() => currentStreak(sessions), [sessions]);
  const best = useMemo(() => longestStreak(sessions), [sessions]);
  const due = useMemo(() => dueCount(cards), [cards]);
  const todayItems = useMemo(() => dueToday(items), [items]);
  const lateItems = useMemo(() => overdue(items), [items]);
  const doneToday = useMemo(
    () => items.filter((i) => i.done && i.completedAt && i.completedAt >= new Date().setHours(0, 0, 0, 0)).length,
    [items],
  );

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

  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const prevWeekTotal = useMemo(() => {
    let sum = 0;
    for (let i = 13; i >= 7; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      sum += statsForDay(sessions, dayKey(d)).minutes;
    }
    return sum;
  }, [sessions]);

  const distribution = useMemo(() => {
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

  const exams = useMemo(() => upcomingExams(items, 60).slice(0, 4), [items]);
  const liveGoals = useMemo(() => activeGoals(goals).slice(0, 3), [goals]);

  const recent = useMemo(
    () =>
      documents
        .filter((d) => d.openedAt && !d.deletedAt)
        .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
        .slice(0, 4),
    [documents],
  );

  const goalPct = Math.min(1, today.minutes / Math.max(1, dailyGoal));
  const deltaPct = prevWeekTotal ? Math.round(((weekTotal - prevWeekTotal) / prevWeekTotal) * 100) : null;

  return (
    <div className="mx-auto max-w-[1220px] px-4 py-5 sm:px-7 sm:py-7">
      <Hero />

      {/* ------------------------------------------------------- the four */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex items-center gap-4 p-4" as="div">
          <ProgressRing value={goalPct} size={62} stroke={6} color="var(--c-accent)" colorTo="var(--c-brand-lift)">
            <span className="t-num text-[13px] font-semibold">{Math.round(goalPct * 100)}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="t-label">{t(L('Днес', 'Today'))}</p>
            <p className="t-num mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em]">
              {formatDuration(today.minutes, lang)}
            </p>
            <p className="mt-1.5 text-[11.5px] text-muted">
              {t(L(`от ${dailyGoal} мин цел`, `of a ${dailyGoal} min goal`))}
            </p>
          </div>
        </Card>

        <StatCard
          label={t(S.streak)}
          value={streak}
          unit={t(streak === 1 ? L('ден', 'day') : L('дни', 'days'))}
          icon="flame"
          tone="var(--c-ember)"
          hint={t(L(`Най-дълга серия: ${best} дни`, `Longest run: ${best} days`))}
          onClick={() => useApp.getState().go('stats')}
        />

        <StatCard
          label={t(L('Задачи днес', 'Tasks today'))}
          value={doneToday}
          unit={t(L(`от ${doneToday + todayItems.length}`, `of ${doneToday + todayItems.length}`))}
          icon="listTodo"
          tone={lateItems.length ? 'var(--c-danger)' : 'var(--c-brand)'}
          progress={doneToday + todayItems.length ? doneToday / (doneToday + todayItems.length) : 0}
          hint={
            lateItems.length
              ? t(L(`${lateItems.length} просрочени чакат`, `${lateItems.length} overdue waiting`))
              : t(L('Всичко е в срок.', 'Everything on time.'))
          }
          onClick={() => useApp.getState().go('tasks')}
        />

        <StatCard
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
      </div>

      {/* --------------------------------------------------------- the grid */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <TodayPlan />

          <Card
            title={t(L('Тази седмица', 'This week'))}
            subtitle={t(
              L(
                `${formatDuration(weekTotal, lang)} общо${deltaPct !== null ? ` · ${deltaPct >= 0 ? '+' : ''}${deltaPct}% спрямо миналата` : ''}`,
                `${formatDuration(weekTotal, lang)} total${deltaPct !== null ? ` · ${deltaPct >= 0 ? '+' : ''}${deltaPct}% vs last week` : ''}`,
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

          {recent.length > 0 && (
            <div>
              <SectionHeader
                title={t(L('Продължи оттам', 'Pick up where you left off'))}
                action={<CardLink label={t(S.library)} onClick={() => useApp.getState().go('drive')} />}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {recent.map((doc) => {
                  const subject = subjects.find((s) => s.id === doc.subjectId);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => void useViewer.getState().openDocument(doc.id)}
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
                          <Icon name={doc.kind === 'board' ? 'board' : 'book'} size={19} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{doc.name}</span>
                        <span className="mt-1 block">
                          <ProgressBar
                            value={progressOf(doc)}
                            height={4}
                            color={subject?.color ?? 'var(--c-brand)'}
                          />
                        </span>
                        <span className="t-num mt-1.5 block text-[11px] text-muted">
                          {t(L(`стр. ${doc.lastPage} от ${doc.pageCount}`, `page ${doc.lastPage} of ${doc.pageCount}`))}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ right rail */}
        <div className="space-y-4">
          <Card
            title={t(L('Предстоящи изпити', 'Upcoming exams'))}
            icon="graduation"
            action={<CardLink label={t(S.all)} onClick={() => useApp.getState().go('exams')} />}
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
                  onClick: () => useApp.getState().setQuick('exam'),
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
                        onClick={() => useApp.getState().go('exams', exam.id)}
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

          <Card
            title={t(S.goals)}
            icon="target"
            action={<CardLink label={t(S.all)} onClick={() => useApp.getState().go('goals')} />}
            flush
          >
            {liveGoals.length === 0 ? (
              <EmptyState
                compact
                icon="target"
                title={t(L('Още няма цел', 'No goals yet'))}
                body={t(L('Задай цел и следи как се движи сама с часовете ти.', 'Set a goal and watch it move on its own as you work.'))}
                action={{
                  label: t(L('Създай цел', 'Create goal')),
                  icon: 'plus',
                  onClick: () => useApp.getState().setQuick('goal'),
                }}
              />
            ) : (
              <ul className="space-y-3 px-4 pb-4">
                {liveGoals.map((goal) => {
                  const pct = goalProgress(goal, ctx);
                  const health = goalHealth(goal, ctx);
                  return (
                    <li key={goal.id}>
                      <button
                        onClick={() => useApp.getState().go('goals', goal.id)}
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

          <Card
            title={t(L('По предмети', 'By subject'))}
            subtitle={t(L('последните 7 дни', 'last 7 days'))}
            icon="pie"
          >
            {distribution.length === 0 ? (
              <EmptyState
                compact
                icon="waves"
                title={t(L('Няма данни още', 'Nothing to show yet'))}
                body={t(L('Пусни фокус сесия и разпределението се появява само.', 'Run a focus session and this fills itself in.'))}
              />
            ) : (
              <Donut
                data={distribution}
                centerLabel={t(L('общо', 'total'))}
                centerValue={formatDuration(
                  distribution.reduce((s, d) => s + d.value, 0),
                  lang,
                )}
                format={(v) => formatDuration(v, lang)}
              />
            )}
          </Card>

          <Card title={t(L('Бързи действия', 'Quick actions'))} icon="bolt">
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: 'listTodo', label: t(S.task), run: () => useApp.getState().setQuick('task') },
                { icon: 'target', label: t(S.goal), run: () => useApp.getState().setQuick('goal') },
                { icon: 'graduation', label: t(S.exam), run: () => useApp.getState().setQuick('exam') },
                { icon: 'upload', label: t(L('Материал', 'Material')), run: onUpload },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={action.run}
                  className="flex cursor-pointer flex-col items-start gap-2 rounded-[12px] border border-line p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-sm)]"
                  style={{ background: 'var(--c-surface-2)' }}
                >
                  <Icon name={action.icon} size={17} className="text-accent" />
                  <span className="text-[12.5px] font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
