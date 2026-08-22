import { useMemo, useState } from 'react';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner } from '@/state/plannerStore';
import { useCards } from '@/state/cardStore';
import { useSettings } from '@/state/settingsStore';
import { useTimer, dayKey, statsForDay } from '@/state/timerStore';
import { currentStreak, longestStreak } from '@/services/gameService';
import { useT, L, useLang, formatDuration, weekdayNames, formatDate, shortDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Screen } from '../shell/Screen';
import { Icon } from '../Icon';
import {
  BarChart,
  Card,
  Donut,
  EmptyState,
  HeatCalendar,
  ProgressBar,
  Segmented,
  StatCard,
  SERIES_COLORS,
  OTHER_COLOR,
} from '../kit';

type Range = '7' | '30' | '90';

const DAY = 86_400_000;

/**
 * The record, read back.
 *
 * Everything on this screen comes from sessions, tasks and cards that were
 * actually logged — there is no manual entry anywhere in the product, which is
 * the only reason these numbers are worth looking at. Each block answers one
 * question: how much, when, on what, and is it going up.
 */
export function StatsScreen() {
  const t = useT();
  const lang = useLang();
  const sessions = useTimer((s) => s.sessions);
  const items = usePlanner((s) => s.items);
  const cards = useCards((s) => s.cards);
  const subjects = useWorkspace((s) => s.subjects);
  const dailyGoal = useSettings((s) => s.timer.goal);
  const [range, setRange] = useState<Range>('30');

  const days = Number(range);
  const from = useMemo(() => new Date().setHours(0, 0, 0, 0) - (days - 1) * DAY, [days]);
  const prevFrom = from - days * DAY;

  /* --------------------------------------------------------------- series */

  const series = useMemo(() => {
    const names = weekdayNames(lang);
    const out: { label: string; value: number; current?: boolean; key: string; at: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      out.push({
        key,
        at: d.getTime(),
        label: days <= 14 ? names[(d.getDay() + 6) % 7] : d.getDate() === 1 || i === 0 ? String(d.getDate()) : '',
        value: statsForDay(sessions, key).minutes,
        current: i === 0,
      });
    }
    return out;
  }, [sessions, days, lang]);

  const totals = useMemo(() => {
    const inRange = sessions.filter((s) => s.startedAt >= from);
    const prev = sessions.filter((s) => s.startedAt >= prevFrom && s.startedAt < from);
    const minutes = inRange.reduce((sum, s) => sum + s.minutes, 0);
    const prevMinutes = prev.reduce((sum, s) => sum + s.minutes, 0);
    const activeDays = new Set(inRange.map((s) => s.day)).size;
    const tasksDone = items.filter((i) => i.done && (i.completedAt ?? 0) >= from).length;
    const prevTasks = items.filter(
      (i) => i.done && (i.completedAt ?? 0) >= prevFrom && (i.completedAt ?? 0) < from,
    ).length;
    const reviews = cards.filter((c) => (c.lastReviewedAt ?? 0) >= from).length;
    return {
      minutes,
      prevMinutes,
      sessions: inRange.length,
      activeDays,
      average: activeDays ? Math.round(minutes / activeDays) : 0,
      tasksDone,
      prevTasks,
      reviews,
      delta: prevMinutes ? Math.round(((minutes - prevMinutes) / prevMinutes) * 100) : null,
      taskDelta: prevTasks ? Math.round(((tasksDone - prevTasks) / prevTasks) * 100) : null,
    };
  }, [sessions, items, cards, from, prevFrom]);

  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (s.startedAt < from) continue;
      map.set(s.subjectId ?? '', (map.get(s.subjectId ?? '') ?? 0) + s.minutes);
    }
    const rows = [...map.entries()]
      .map(([id, minutes], i) => ({
        label: subjects.find((s) => s.id === id)?.name ?? t(S.noSubject),
        value: minutes,
        color: subjects.find((s) => s.id === id)?.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
    if (rows.length <= 6) return rows;
    const rest = rows.slice(5).reduce((sum, r) => sum + r.value, 0);
    return [...rows.slice(0, 5), { label: t(L('Други', 'Other')), value: rest, color: OTHER_COLOR }];
  }, [sessions, subjects, from, t]);

  /** When in the day the work actually happens — 24 buckets, real timestamps. */
  const byHour = useMemo(() => {
    const buckets = new Array(24).fill(0) as number[];
    for (const s of sessions) {
      if (s.startedAt < from) continue;
      buckets[new Date(s.startedAt).getHours()] += s.minutes;
    }
    return buckets;
  }, [sessions, from]);

  const bestHour = byHour.indexOf(Math.max(...byHour));

  const heat = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) map.set(s.day, (map.get(s.day) ?? 0) + s.minutes);
    return [...map.entries()].map(([day, value]) => ({
      day,
      value,
      label: `${formatDuration(value, lang)} · ${formatDate(new Date(day).getTime(), lang, { day: 'numeric', month: 'short' })}`,
    }));
  }, [sessions, lang]);

  const cardStates = useMemo(() => {
    const known = cards.filter((c) => c.reps > 0 && c.due > Date.now()).length;
    const learning = cards.filter((c) => c.reps > 0 && c.due <= Date.now()).length;
    const fresh = cards.filter((c) => c.reps === 0).length;
    return { known, learning, fresh, total: cards.length };
  }, [cards]);

  const goalDays = series.filter((d) => d.value >= dailyGoal).length;
  const empty = sessions.length === 0;

  return (
    <Screen
      title={t(S.stats)}
      subtitle={t(L('Само това, което наистина си учил — без ръчно въвеждане.', 'Only what you actually did — nothing here is typed in by hand.'))}
      actions={
        <Segmented
          value={range}
          onChange={setRange}
          ariaLabel={t(L('Период', 'Range'))}
          items={[
            { id: '7', label: t(L('7 дни', '7 days')) },
            { id: '30', label: t(L('30 дни', '30 days')) },
            { id: '90', label: t(L('3 месеца', '3 months')) },
          ]}
        />
      }
    >
      {empty ? (
        <Card>
          <EmptyState
            icon="chartLine"
            title={t(L('Още няма какво да се покаже', 'Nothing to show yet'))}
            body={t(
              L(
                'Пусни една фокус сесия. Оттам нататък този екран се пълни сам — часове, предмети, серии и тенденции.',
                'Run one focus session. From then on this screen fills itself in — hours, subjects, streaks and trends.',
              ),
            )}
            action={{
              label: t(L('Започни фокус', 'Start focus')),
              icon: 'timer',
              onClick: () => {
                useTimer.getState().setView('full');
                useTimer.getState().start();
              },
            }}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t(L('Учене за периода', 'Studied in range'))}
              value={formatDuration(totals.minutes, lang)}
              icon="timer"
              delta={totals.delta === null ? null : { value: totals.delta }}
              hint={t(L(`${totals.sessions} сесии`, `${totals.sessions} sessions`))}
            />
            <StatCard
              label={t(L('Среден активен ден', 'Average active day'))}
              value={formatDuration(totals.average, lang)}
              icon="gauge"
              tone="var(--c-aurora)"
              progress={Math.min(1, totals.average / Math.max(1, dailyGoal))}
              hint={t(L(`Цел: ${dailyGoal} мин`, `Goal: ${dailyGoal} min`))}
            />
            <StatCard
              label={t(L('Активни дни', 'Active days'))}
              value={totals.activeDays}
              unit={t(L(`от ${days}`, `of ${days}`))}
              icon="calendarCheck"
              tone="var(--c-deep)"
              progress={totals.activeDays / days}
              hint={t(L(`${goalDays} дни над целта`, `${goalDays} days over goal`))}
            />
            <StatCard
              label={t(L('Завършени задачи', 'Tasks completed'))}
              value={totals.tasksDone}
              icon="checkCircle"
              tone="var(--c-success)"
              delta={totals.taskDelta === null ? null : { value: totals.taskDelta }}
              onClick={() => useApp.getState().go('tasks')}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card
              title={t(L('Активност по дни', 'Activity by day'))}
              subtitle={t(
                L(
                  `${formatDuration(totals.minutes, lang)} за ${days} дни`,
                  `${formatDuration(totals.minutes, lang)} across ${days} days`,
                ),
              )}
              icon="chart"
            >
              <BarChart
                data={series.map((d) => ({
                  ...d,
                  tip: (
                    <>
                      <span className="t-num font-semibold">{formatDuration(d.value, lang)}</span>
                      <span className="ml-1.5 opacity-70">{shortDate(d.at, lang)}</span>
                    </>
                  ),
                }))}
                height={190}
                goal={dailyGoal}
                goalLabel={t(L('цел', 'goal'))}
                format={(v) => formatDuration(v, lang)}
              />
            </Card>

            <Card
              title={t(L('По предмети', 'By subject'))}
              subtitle={t(L('Къде отиде времето', 'Where the time went'))}
              icon="pie"
            >
              {bySubject.length === 0 ? (
                <EmptyState compact icon="layers" title={t(L('Няма отбелязани предмети', 'No subjects tagged'))} />
              ) : (
                <Donut
                  data={bySubject}
                  centerLabel={t(L('общо', 'total'))}
                  centerValue={formatDuration(totals.minutes, lang)}
                  format={(v) => formatDuration(v, lang)}
                />
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card
              title={t(L('Кога учиш', 'When you study'))}
              subtitle={
                byHour[bestHour] > 0
                  ? t(
                      L(
                        `Най-силният ти час е ${String(bestHour).padStart(2, '0')}:00`,
                        `Your strongest hour is ${String(bestHour).padStart(2, '0')}:00`,
                      ),
                    )
                  : undefined
              }
              icon="clock"
            >
              <div className="flex h-[132px] items-end gap-[2px]">
                {byHour.map((value, hour) => {
                  const max = Math.max(1, ...byHour);
                  return (
                    <div key={hour} className="group relative flex h-full flex-1 flex-col justify-end">
                      <span
                        className="w-full rounded-t-[3px]"
                        style={{
                          height: `${Math.max(value ? 3 : 0, (value / max) * 100)}%`,
                          background:
                            hour === bestHour && value > 0
                              ? 'var(--c-brand)'
                              : 'color-mix(in srgb, var(--c-brand) 38%, var(--c-surface-3))',
                        }}
                        title={`${String(hour).padStart(2, '0')}:00 — ${formatDuration(value, lang)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="t-num mt-1.5 flex justify-between text-[10px] text-faint">
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
                <span>23</span>
              </div>
            </Card>

            <Card
              title={t(L('Постоянство', 'Consistency'))}
              subtitle={t(
                L(
                  `Сега ${currentStreak(sessions)} дни · най-дълга ${longestStreak(sessions)}`,
                  `${currentStreak(sessions)} days now · longest ${longestStreak(sessions)}`,
                ),
              )}
              icon="flame"
            >
              <HeatCalendar days={heat} weeks={days <= 30 ? 12 : 20} weekdayLabels={weekdayNames(lang)} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card title={t(L('Време по предмети', 'Time per subject'))} icon="layers">
              {bySubject.length === 0 ? (
                <p className="text-[12.5px] text-muted">
                  {t(L('Отбележи материалите си с предмет и това ще се напълни само.', 'Tag your materials with a subject and this fills itself in.'))}
                </p>
              ) : (
                <ul className="space-y-3">
                  {bySubject.map((row) => (
                    <li key={row.label}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="badge-dot" style={{ background: row.color }} />
                          <span className="truncate">{row.label}</span>
                        </span>
                        <span className="t-num shrink-0 font-medium">{formatDuration(row.value, lang)}</span>
                      </div>
                      <ProgressBar
                        value={row.value / Math.max(1, bySubject[0].value)}
                        color={row.color}
                        height={6}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={t(S.cards)} icon="cards" subtitle={t(L('Състояние на тестето', 'How the deck stands'))}>
              {cardStates.total === 0 ? (
                <EmptyState
                  compact
                  icon="cards"
                  title={t(L('Още няма карти', 'No cards yet'))}
                  body={t(L('Изрежи задача от страница и тя става карта.', 'Cut a problem out of a page and it becomes a card.'))}
                  action={{ label: t(S.cards), icon: 'arrowRight', onClick: () => useApp.getState().go('cards') }}
                />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: t(L('Научени', 'Known')), value: cardStates.known, color: 'var(--c-success)' },
                      { label: t(L('За преговор', 'Due')), value: cardStates.learning, color: 'var(--c-warn)' },
                      { label: t(L('Нови', 'New')), value: cardStates.fresh, color: 'var(--c-faint)' },
                    ].map((cell) => (
                      <div key={cell.label} className="rounded-[12px] p-3" style={{ background: 'var(--c-surface-2)' }}>
                        <span className="t-num block text-[20px] font-semibold leading-none" style={{ color: cell.color }}>
                          {cell.value}
                        </span>
                        <span className="mt-1.5 block text-[11.5px] text-muted">{cell.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-[2px] overflow-hidden rounded-full">
                    {[
                      { v: cardStates.known, c: 'var(--c-success)' },
                      { v: cardStates.learning, c: 'var(--c-warn)' },
                      { v: cardStates.fresh, c: 'var(--c-surface-3)' },
                    ].map((seg, i) => (
                      <span
                        key={i}
                        style={{
                          width: `${(seg.v / Math.max(1, cardStates.total)) * 100}%`,
                          background: seg.c,
                          height: 8,
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                    <Icon name="brain" size={12} />
                    {t(L(`${totals.reviews} карти прегледани за периода`, `${totals.reviews} cards reviewed in range`))}
                  </p>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </Screen>
  );
}
