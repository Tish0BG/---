import { useMemo } from 'react';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, dueToday, overdue, upcomingExams, daysUntil } from '@/state/plannerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { useTimer } from '@/state/timerStore';
import { useGameContext } from '@/state/gameStore';
import { currentStreak, levelState, levelTitle, totalXp } from '@/services/gameService';
import { useT, useLang, L, longDate } from '@/i18n';
import { Icon } from '../Icon';
import { Button } from '../kit';

const greeting = (hour: number) =>
  hour < 5
    ? L('Още си буден', 'Still up')
    : hour < 12
      ? L('Добро утро', 'Good morning')
      : hour < 18
        ? L('Добър ден', 'Good afternoon')
        : L('Добър вечер', 'Good evening');

/**
 * The band the app opens with.
 *
 * It answers three questions before anything is clicked: who this is, what is
 * waiting today, and where the effort so far has got to. The gradient is the
 * one place in the interface where the brand is allowed to be loud — and it is
 * behind the greeting, not behind the data.
 */
export function Hero() {
  const t = useT();
  const lang = useLang();
  const profile = useWorkspace((s) => s.profile);
  const items = usePlanner((s) => s.items);
  const cards = useCards((s) => s.cards);
  const ctx = useGameContext();

  const now = new Date();
  const level = useMemo(() => levelState(totalXp(ctx)), [ctx]);
  const streak = useMemo(() => currentStreak(ctx.sessions), [ctx.sessions]);
  const due = useMemo(() => dueCount(cards), [cards]);
  const todayCount = useMemo(() => dueToday(items).length, [items]);
  const lateCount = useMemo(() => overdue(items).length, [items]);
  const nextExam = useMemo(() => upcomingExams(items, 60)[0], [items]);

  const lines: string[] = [];
  if (lateCount) lines.push(t(L(`${lateCount} просрочени`, `${lateCount} overdue`)));
  if (todayCount) lines.push(t(L(`${todayCount} за днес`, `${todayCount} due today`)));
  if (due) lines.push(t(L(`${due} карти за преговор`, `${due} cards to review`)));
  if (nextExam?.due != null) {
    const days = daysUntil(nextExam.due);
    lines.push(
      days <= 0
        ? t(L('изпит днес', 'exam today'))
        : t(L(`изпит след ${days} дни`, `exam in ${days} days`)),
    );
  }

  return (
    <section
      className="animate-rise relative overflow-hidden rounded-[20px] p-5 sm:p-7"
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-line)',
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      {/* the mesh: two soft brand lights, clipped by the card */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full opacity-[0.22] blur-3xl"
        style={{ background: 'var(--grad-accent)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/3 h-64 w-64 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'var(--grad-aurora)' }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="t-h1">
            {t(greeting(now.getHours()))}
            {profile.name ? (
              <>
                ,{' '}
                <span
                  style={{
                    background: 'var(--grad-accent)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {profile.name}
                </span>
              </>
            ) : null}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
                    <span className="first-letter:uppercase">{longDate(now.getTime(), lang)}</span>
            {lines.length > 0 && <span className="mx-1.5 text-faint">·</span>}
            {lines.join(' · ')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            icon="timer"
            onClick={() => {
              useTimer.getState().setView('full');
              useTimer.getState().start();
            }}
          >
            {t(L('Започни фокус', 'Start focus'))}
          </Button>
          <Button
            variant="outline"
            size="lg"
            icon="cards"
            disabled={!due}
            onClick={() => {
              useCards.getState().startReview(null);
              useApp.getState().go('cards');
            }}
          >
            {t(L('Преговор', 'Review'))}
            {due > 0 && <span className="t-num ml-0.5 opacity-70">{due}</span>}
          </Button>
        </div>
      </div>

      {/* --------------------------------------------------------- level */}
      <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-[210px] flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-semibold">
              {t(L('Ниво', 'Level'))} {level.level}
              <span className="ml-1.5 font-normal text-muted">{t(levelTitle(level.level))}</span>
            </span>
            <span className="t-num text-[11.5px] text-muted">
              {level.xp - level.floor} / {level.ceiling - level.floor} XP
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, level.progress * 100)}%`,
                background: 'var(--grad-accent)',
                transition: 'width 0.8s var(--ease-out)',
              }}
            />
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background: streak > 0 ? 'color-mix(in srgb, var(--c-ember) 13%, transparent)' : 'var(--c-surface-2)',
            color: streak > 0 ? 'var(--c-ember)' : 'var(--c-muted)',
          }}
        >
          <Icon name="flame" size={15} fill={streak > 0} />
          <span className="t-num text-[13px] font-semibold">{streak}</span>
          <span className="text-[12px] opacity-80">
            {t(streak === 1 ? L('ден поред', 'day streak') : L('дни поред', 'day streak'))}
          </span>
        </div>
      </div>
    </section>
  );
}
