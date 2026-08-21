import { useEffect, useMemo, useState } from 'react';
import { VIEW_TITLES, useApp } from '@/state/appStore';
import { useSettings } from '@/state/settingsStore';
import { useLibrary } from '@/state/libraryStore';
import { useCards, dueCount } from '@/state/cardStore';
import { useTimer } from '@/state/timerStore';
import { Icon } from '../Icon';
import { Tip } from '../ui';
import { ConnectionBar } from '../system/ConnectionBar';
import { UtilityButton } from '../utilities/UtilityLayer';
import { NavRail } from './NavRail';
import { ProfileMenu } from './ProfileMenu';

/**
 * The frame every screen lives in: rail on the left, a slim header with the
 * one search box that reaches everything, and the content below.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const view = useApp((s) => s.view);
  const subjectId = useApp((s) => s.subjectId);
  const importing = useLibrary((s) => s.importing);
  const cards = useCards((s) => s.cards);
  const setSetting = useSettings((s) => s.set);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1024);

  const due = useMemo(() => dueCount(cards), [cards]);

  // Below a laptop width the rail is only ever icons; there is not enough
  // room to spend 216px on navigation.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => {
      setNarrow(mq.matches);
      if (mq.matches) setSetting('railCollapsed', true);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setSetting]);

  return (
    <div className="flex h-full overflow-hidden">
      <NavRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBar />
        <header
          className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4"
          style={{ background: 'color-mix(in srgb, var(--c-surface) 92%, transparent)', backdropFilter: 'blur(10px)' }}
        >
          <h1 className="hidden shrink-0 text-[14.5px] font-semibold sm:block">
            {subjectId && view === 'subjects' ? 'Предмет' : VIEW_TITLES[view]}
          </h1>

          <button
            onClick={() => useApp.getState().setPalette(true)}
            className="ml-auto flex h-9 max-w-md flex-1 cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 text-[13px] text-faint transition-colors hover:border-line-strong hover:bg-surface-2 sm:ml-4"
          >
            <Icon name="search" size={15} />
            <span className="flex-1 truncate text-left">Търси навсякъде…</span>
            <kbd
              className="hidden rounded px-1.5 py-0.5 text-[10px] sm:block"
              style={{ background: 'var(--c-surface-3)', color: 'var(--c-muted)' }}
            >
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {importing && (
              <span className="hidden items-center gap-1.5 text-[11px] text-muted md:flex">
                <Icon name="refresh" size={13} className="animate-spin text-accent" />
                {importing.done + 1}/{importing.total}
              </span>
            )}
            <Tip label="Флашкарти">
              <button className="icon-btn relative" onClick={() => useApp.getState().go('cards')}>
                <Icon name="cards" size={17} />
                {due > 0 && (
                  <span
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--c-accent)' }}
                  />
                )}
              </button>
            </Tip>
            <Tip label="Фокус таймер (⌥T)">
              <button className="icon-btn" onClick={() => useTimer.getState().toggleWidget()}>
                <Icon name="timer" size={17} />
              </button>
            </Tip>
            {/* the same tool tray as inside a document — a calculator is just
                as useful while planning as while solving */}
            <UtilityButton compact />
            <div className="mx-1 h-6 w-px bg-line" />
            <ProfileMenu />
          </div>
        </header>

        <main className="min-h-0 flex-1" data-narrow={narrow}>
          {children}
        </main>
      </div>
    </div>
  );
}
