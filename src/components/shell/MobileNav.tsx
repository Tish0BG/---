import { useState } from 'react';
import { VIEW_TITLES, useApp, type AppView } from '@/state/appStore';
import { usePlanner, dueToday, overdue } from '@/state/plannerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { useTimer } from '@/state/timerStore';
import { useT, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { Sheet } from '../kit';

const MAIN: { id: AppView; icon: string }[] = [
  { id: 'dashboard', icon: 'dashboard' },
  { id: 'tasks', icon: 'listTodo' },
  { id: 'calendar', icon: 'calendar' },
];

const MORE: { id: AppView; icon: string }[] = [
  { id: 'goals', icon: 'target' },
  { id: 'exams', icon: 'graduation' },
  { id: 'drive', icon: 'drive' },
  { id: 'cards', icon: 'cards' },
  { id: 'stats', icon: 'chartLine' },
  { id: 'achievements', icon: 'trophy' },
  { id: 'subjects', icon: 'layers' },
  { id: 'profile', icon: 'user' },
];

/**
 * The phone's navigation.
 *
 * A 248 px sidebar squeezed onto a 390 px screen is a drawer nobody opens, so
 * on a phone the three destinations that carry the day sit under the thumb,
 * the create button is the biggest target on the screen, and everything else
 * lives one sheet away.
 */
export function MobileNav() {
  const t = useT();
  const view = useApp((s) => s.view);
  const items = usePlanner((s) => s.items);
  const cards = useCards((s) => s.cards);
  const [more, setMore] = useState(false);

  const badges: Partial<Record<AppView, number>> = {
    tasks: dueToday(items).length + overdue(items).length,
    cards: dueCount(cards),
  };

  const item = (entry: { id: AppView; icon: string }) => {
    const active = view === entry.id;
    const badge = badges[entry.id];
    return (
      <button
        key={entry.id}
        onClick={() => useApp.getState().go(entry.id)}
        aria-current={active ? 'page' : undefined}
        className="relative flex h-full flex-1 cursor-pointer flex-col items-center justify-center gap-1"
        style={{ color: active ? 'var(--c-accent)' : 'var(--c-muted)' }}
      >
        <span className="relative">
          <Icon name={entry.icon} size={21} strokeWidth={active ? 2.1 : 1.8} />
          {!!badge && (
            <span
              className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full"
              style={{ background: 'var(--c-danger)', border: '1.5px solid var(--c-surface)' }}
            />
          )}
        </span>
        <span className="text-[10px] font-medium">{t(VIEW_TITLES[entry.id])}</span>
      </button>
    );
  };

  return (
    <>
      <nav
        className="safe-b glass fixed inset-x-0 bottom-0 z-40 flex h-[58px] items-stretch border-t border-line md:hidden"
        aria-label={t(L('Основна навигация', 'Main navigation'))}
      >
        {item(MAIN[0])}
        {item(MAIN[1])}

        <div className="relative w-[68px] shrink-0">
          <button
            onClick={() => useApp.getState().setQuick('task')}
            className="absolute left-1/2 top-0 grid h-[52px] w-[52px] -translate-x-1/2 -translate-y-[16px] cursor-pointer place-items-center rounded-full text-white active:scale-95"
            style={{
              background: 'var(--c-accent)',
              boxShadow: '0 0 0 4px var(--c-bg)',
              transition: 'transform 0.14s var(--ease)',
            }}
            aria-label={t(S.create)}
          >
            <Icon name="plus" size={24} strokeWidth={2.2} />
          </button>
        </div>

        {item(MAIN[2])}

        <button
          onClick={() => setMore(true)}
          className="flex h-full flex-1 cursor-pointer flex-col items-center justify-center gap-1"
          style={{ color: MORE.some((m) => m.id === view) ? 'var(--c-accent)' : 'var(--c-muted)' }}
        >
          <Icon name="grid" size={21} strokeWidth={1.8} />
          <span className="text-[10px] font-medium">{t(L('Още', 'More'))}</span>
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title={t(L('Всички секции', 'All sections'))} maxHeight={0.7}>
        <div className="grid grid-cols-2 gap-2 pb-2">
          {MORE.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                useApp.getState().go(entry.id);
                setMore(false);
              }}
              className="card-quiet flex cursor-pointer items-center gap-3 p-3 text-left active:scale-[0.98]"
              style={{ transition: 'transform 0.12s var(--ease)' }}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
              >
                <Icon name={entry.icon} size={17} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                {t(VIEW_TITLES[entry.id])}
              </span>
              {!!badges[entry.id] && (
                <span className="t-num chip" style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
                  {badges[entry.id]}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => {
              useTimer.getState().setView('full');
              useTimer.getState().start();
              setMore(false);
            }}
            className="card-quiet col-span-2 flex cursor-pointer items-center gap-3 p-3 text-left"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
              style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
            >
              <Icon name="timer" size={17} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
              {t(L('Започни фокус сесия', 'Start a focus session'))}
            </span>
            <Icon name="chevronRight" size={16} className="text-faint" />
          </button>
        </div>
      </Sheet>
    </>
  );
}
