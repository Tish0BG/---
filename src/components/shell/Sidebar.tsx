import { useMemo, type ReactNode } from 'react';
import { VIEW_TITLES, useApp, type AppView } from '@/state/appStore';
import { useSettings } from '@/state/settingsStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, dueToday, overdue, upcomingExams } from '@/state/plannerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { useGoals, activeGoals } from '@/state/goalStore';
import { useTimer } from '@/state/timerStore';
import { useGame, useGameContext } from '@/state/gameStore';
import { currentStreak, levelState, levelTitle, totalXp } from '@/services/gameService';
import { useT, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { Tooltip, ProgressRing } from '../kit';

interface NavEntry {
  id: AppView | 'focus';
  icon: string;
  badge?: number;
  /** amber instead of violet — something is late */
  alert?: boolean;
}

/**
 * The spine of the product.
 *
 * Nine destinations is more than a rail of icons can carry, so this is a real
 * sidebar: named sections, live counters on the three that can be behind, the
 * subject list underneath, and the person's own level at the bottom. Collapsed
 * it becomes the icon rail again for people who want the width back.
 */
export function Sidebar({ onNavigate, expanded }: { onNavigate?: () => void; expanded?: boolean }) {
  const t = useT();
  const view = useApp((s) => s.view);
  const activeSubject = useApp((s) => s.subjectId);
  // Inside the drawer the sidebar is always expanded: it was opened on
  // purpose, and a drawer of unlabelled icons helps nobody.
  const collapsed = useSettings((s) => s.railCollapsed) && !expanded;
  const setSetting = useSettings((s) => s.set);
  const subjects = useWorkspace((s) => s.subjects);
  const profile = useWorkspace((s) => s.profile);
  const items = usePlanner((s) => s.items);
  const cards = useCards((s) => s.cards);
  const goals = useGoals((s) => s.goals);
  const timerView = useTimer((s) => s.view);
  const running = useTimer((s) => s.running);
  const ctx = useGameContext();
  const unlocked = useGame((s) => s.unlocked);

  const counts = useMemo(
    () => ({
      tasks: dueToday(items).length + overdue(items).length,
      lateTasks: overdue(items).length > 0,
      exams: upcomingExams(items, 14).length,
      cards: dueCount(cards),
      goals: activeGoals(goals).length,
    }),
    [items, cards, goals],
  );

  const level = useMemo(() => levelState(totalXp(ctx)), [ctx]);
  const streak = useMemo(() => currentStreak(ctx.sessions), [ctx.sessions]);
  const earned = Object.keys(unlocked).length;

  const primary: NavEntry[] = [
    { id: 'dashboard', icon: 'dashboard' },
    { id: 'tasks', icon: 'listTodo', badge: counts.tasks, alert: counts.lateTasks },
    { id: 'calendar', icon: 'calendar' },
    { id: 'goals', icon: 'target', badge: counts.goals },
    { id: 'exams', icon: 'graduation', badge: counts.exams },
    { id: 'drive', icon: 'drive' },
    { id: 'cards', icon: 'cards', badge: counts.cards },
    { id: 'focus', icon: 'timer' },
    { id: 'stats', icon: 'chartLine' },
  ];

  const secondary: NavEntry[] = [
    { id: 'achievements', icon: 'trophy', badge: earned || undefined },
    { id: 'subjects', icon: 'layers' },
  ];

  const go = (entry: NavEntry) => {
    if (entry.id === 'focus') {
      useTimer.getState().setView('full');
      if (!useTimer.getState().running) useTimer.getState().start();
    } else {
      useApp.getState().go(entry.id);
    }
    onNavigate?.();
  };

  const isActive = (entry: NavEntry) =>
    entry.id === 'focus' ? timerView === 'full' : view === entry.id && !activeSubject;

  const renderItem = (entry: NavEntry) => {
    const active = isActive(entry);
    const label = entry.id === 'focus' ? t(S.focus) : t(VIEW_TITLES[entry.id]);
    const node = (
      <button
        key={entry.id}
        onClick={() => go(entry)}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[10px] text-[13.5px] transition-all duration-150 ${
          collapsed ? 'justify-center px-0' : 'px-2.5'
        } ${active ? 'font-semibold' : 'font-medium text-muted hover:bg-surface-2 hover:text-ink'}`}
        style={
          active
            ? { background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }
            : undefined
        }
      >
        {active && (
          <span
            className="absolute -left-2 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
            style={{ background: 'var(--c-accent)' }}
            aria-hidden
          />
        )}
        <span className="relative shrink-0">
          <Icon name={entry.icon} size={17.5} strokeWidth={active ? 2 : 1.75} />
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
            className="t-num shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-semibold"
            style={{
              background: entry.alert
                ? 'color-mix(in srgb, var(--c-danger) 15%, transparent)'
                : active
                  ? 'color-mix(in srgb, var(--c-accent) 18%, transparent)'
                  : 'var(--c-surface-3)',
              color: entry.alert ? 'var(--c-danger)' : active ? 'var(--c-accent)' : 'var(--c-muted)',
            }}
          >
            {entry.badge}
          </span>
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
        width: collapsed ? 68 : 248,
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

        {!collapsed && subjects.filter((s) => !s.archived).length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between px-2.5">
              <span className="t-label">{t(S.subjects)}</span>
              <button
                className="icon-btn h-5 w-5"
                aria-label={t(L('Нов предмет', 'New subject'))}
                onClick={() => {
                  useApp.getState().go('subjects');
                  onNavigate?.();
                }}
              >
                <Icon name="plus" size={12} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {subjects
                .filter((s) => !s.archived)
                .map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => {
                      useApp.getState().openSubject(subject.id);
                      onNavigate?.();
                    }}
                    className={`flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-[12.5px] transition-colors ${
                      activeSubject === subject.id
                        ? 'bg-surface-3 font-medium text-ink'
                        : 'text-muted hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    <span className="badge-dot" style={{ background: subject.color }} />
                    <span className="truncate text-left">{subject.name}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- profile */}
      <div className="shrink-0 border-t border-line p-2">
        {collapsed ? (
          <Tooltip label={`${t(S.level)} ${level.level} · ${streak} 🔥`} side="right" delay={120}>
            <button
              className="mx-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-surface-2"
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
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-surface-2"
          >
            <ProgressRing value={level.progress} size={36} stroke={2.5} color="var(--c-brand)">
              <span className="text-[15px]">{profile.avatar || '🦉'}</span>
            </ProgressRing>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">
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
