import { useMemo, type ReactNode } from 'react';
import { VIEW_TITLES, useApp, type AppView } from '@/state/appStore';
import { useSettings } from '@/state/settingsStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, dueToday, overdue } from '@/state/plannerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { useTimer } from '@/state/timerStore';
import { useGame, useGameContext } from '@/state/gameStore';
import { currentStreak, levelState, levelTitle, totalXp } from '@/services/gameService';
import { useT, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { Tooltip, ProgressRing } from '../kit';

interface NavEntry {
  id: AppView;
  icon: string;
  badge?: number;
  /** amber instead of violet — something is late */
  alert?: boolean;
}

/**
 * ──────────────────────────────────────────────────── the spine ──
 *
 * The order is the day, not the changelog.
 *
 * It used to run tasks, calendar, goals, exams, library, cards, focus,
 * statistics — nine entries arranged by the order the features were built,
 * three of which were the same records under different filters, with the
 * subject list stacked underneath so the rail scrolled on a laptop.
 *
 * Now: where you are, what you keep, what you owe, when it happens, how you
 * revise, how you concentrate, what it is all filed under, how it is going.
 * The subjects moved into their own screen, which is where a list of ten
 * things with colours and averages actually belongs — a navigation rail is
 * not a filing cabinet.
 */
export function Sidebar({ onNavigate, expanded }: { onNavigate?: () => void; expanded?: boolean }) {
  const t = useT();
  const view = useApp((s) => s.view);
  const activeSubject = useApp((s) => s.subjectId);
  // Inside the drawer the sidebar is always expanded: it was opened on
  // purpose, and a drawer of unlabelled icons helps nobody.
  const collapsed = useSettings((s) => s.railCollapsed) && !expanded;
  const setSetting = useSettings((s) => s.set);
  const profile = useWorkspace((s) => s.profile);
  const items = usePlanner((s) => s.items);
  const cards = useCards((s) => s.cards);
  const running = useTimer((s) => s.running);
  const ctx = useGameContext();
  const unlocked = useGame((s) => s.unlocked);

  const counts = useMemo(
    () => ({
      plan: dueToday(items).length + overdue(items).length,
      late: overdue(items).length > 0,
      cards: dueCount(cards),
    }),
    [items, cards],
  );

  const level = useMemo(() => levelState(totalXp(ctx)), [ctx]);
  const streak = useMemo(() => currentStreak(ctx.sessions), [ctx.sessions]);
  const earned = Object.keys(unlocked).length;

  const primary: NavEntry[] = [
    { id: 'dashboard', icon: 'dashboard' },
    { id: 'drive', icon: 'drive' },
    { id: 'plan', icon: 'listTodo', badge: counts.plan, alert: counts.late },
    { id: 'calendar', icon: 'calendar' },
    { id: 'cards', icon: 'cards', badge: counts.cards },
    { id: 'focus', icon: 'timer' },
    { id: 'subjects', icon: 'layers' },
    { id: 'stats', icon: 'chartLine' },
  ];

  const secondary: NavEntry[] = [{ id: 'achievements', icon: 'trophy', badge: earned || undefined }];

  const go = (entry: NavEntry) => {
    useApp.getState().go(entry.id);
    onNavigate?.();
  };

  const isActive = (entry: NavEntry) => view === entry.id && !activeSubject;

  const renderItem = (entry: NavEntry) => {
    const active = isActive(entry);
    const label = t(VIEW_TITLES[entry.id]);
    const node = (
      <button
        key={entry.id}
        onClick={() => go(entry)}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[8px] text-[13.5px] transition-colors duration-150 ${
          collapsed ? 'justify-center px-0' : 'px-2.5'
        } ${
          active
            ? 'bg-surface-3 font-medium text-ink'
            : 'font-normal text-muted hover:bg-surface-2 hover:text-ink'
        }`}
        /* The marker is an inset shadow rather than a positioned bar: the rail
           scrolls, and a scrolling box clips anything hanging outside it — an
           earlier version drew the bar three pixels to the left of the row,
           where nobody ever saw it. */
        style={active ? { boxShadow: 'inset 2px 0 0 var(--c-accent)' } : undefined}
      >
        <span className="relative shrink-0" style={active ? { color: 'var(--c-accent)' } : undefined}>
          <Icon name={entry.icon} size={17} strokeWidth={active ? 1.9 : 1.7} />
          {entry.id === 'focus' && running && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: 'var(--c-aurora)' }}
            />
          )}
        </span>
        {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
        {!collapsed && !!entry.badge && (
          <span
            className="t-num shrink-0 rounded-full px-1.5 py-px text-[11px] font-medium"
            style={{
              background: entry.alert
                ? 'color-mix(in srgb, var(--c-danger) 13%, transparent)'
                : 'var(--c-surface-3)',
              color: entry.alert ? 'var(--c-danger)' : 'var(--c-muted)',
            }}
          >
            {entry.badge}
          </span>
        )}
        {collapsed && !!entry.badge && (
          <span
            className="absolute right-2 top-1.5 h-[6px] w-[6px] rounded-full"
            style={{ background: entry.alert ? 'var(--c-danger)' : 'var(--c-accent)' }}
          />
        )}
      </button>
    );
    return collapsed ? (
      <Tooltip key={entry.id} label={label} side="right" delay={120}>
        {node}
      </Tooltip>
    ) : (
      node
    );
  };

  return (
    <nav
      aria-label={t(L('Основна навигация', 'Main navigation'))}
      className="flex h-full shrink-0 flex-col border-r border-line"
      style={{
        width: collapsed ? 68 : 240,
        background: 'var(--c-surface)',
        transition: 'width 0.22s var(--ease)',
      }}
    >
      {/* ------------------------------------------------------------ brand */}
      <div className={`flex h-14 shrink-0 items-center ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-4'}`}>
        <button
          onClick={() => {
            useApp.getState().go('dashboard');
            onNavigate?.();
          }}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg"
          aria-label="Plauvia"
        >
          <PlauviaTile size={28} />
          {!collapsed && <PlauviaWordmark size={16.5} />}
        </button>
        {!collapsed && (
          <button
            className="icon-btn ml-auto h-7 w-7 opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100"
            onClick={() => setSetting('railCollapsed', true)}
            aria-label={t(L('Свий страничната лента', 'Collapse sidebar'))}
          >
            <Icon name="chevronsLeft" size={15} />
          </button>
        )}
      </div>

      {/* -------------------------------------------------------- navigation */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <div className="flex flex-col gap-0.5">{primary.map(renderItem)}</div>

        <div className="my-3 h-px" style={{ background: 'var(--c-line)' }} />

        <div className="flex flex-col gap-0.5">{secondary.map(renderItem)}</div>
      </div>

      {/* ----------------------------------------------------------- profile */}
      <div className="shrink-0 border-t border-line p-2">
        {collapsed ? (
          <Tooltip label={`${t(S.level)} ${level.level} · ${streak} 🔥`} side="right" delay={120}>
            <button
              className="mx-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] transition-colors hover:bg-surface-2"
              onClick={() => {
                useApp.getState().go('profile');
                onNavigate?.();
              }}
              aria-label={t(S.profile)}
            >
              <ProgressRing value={level.progress} size={34} stroke={2.5} color="var(--c-brand)">
                <span className="text-[14px]">{profile.avatar || '🦉'}</span>
              </ProgressRing>
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={() => {
              useApp.getState().go('profile');
              onNavigate?.();
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] p-2 text-left transition-colors hover:bg-surface-2"
          >
            <ProgressRing value={level.progress} size={36} stroke={2.5} color="var(--c-brand)">
              <span className="text-[15px]">{profile.avatar || '🦉'}</span>
            </ProgressRing>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {profile.name || t(L('Твоят профил', 'Your profile'))}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                <span className="truncate">
                  {t(S.level)} {level.level} · {t(levelTitle(level.level))}
                </span>
              </span>
            </span>
            {streak > 0 && (
              <span
                className="t-num flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
                style={{ background: 'color-mix(in srgb, var(--c-ember) 16%, transparent)', color: 'var(--c-ember)' }}
              >
                <Icon name="flame" size={11} fill />
                {streak}
              </span>
            )}
          </button>
        )}

        {collapsed && (
          <button
            className="icon-btn mx-auto mt-1"
            onClick={() => setSetting('railCollapsed', false)}
            aria-label={t(L('Разгъни страничната лента', 'Expand sidebar'))}
          >
            <Icon name="chevronsRight" size={15} />
          </button>
        )}
      </div>
    </nav>
  );
}

/** Small helper used by the mobile drawer wrapper. */
export function SidebarScrim({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div
        className="animate-in absolute inset-0 z-40"
        style={{ background: 'rgb(6 7 10 / 45%)', backdropFilter: 'blur(2px)' }}
        onPointerDown={onClose}
      />
      <div className="absolute inset-y-0 left-0 z-40 shadow-[var(--shadow-float)]">{children}</div>
    </>
  );
}
