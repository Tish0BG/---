import { useMemo, useState } from 'react';
import type { RailMode } from '@/types';
import { VIEW_TITLES, useApp, type AppView } from '@/state/appStore';
import { useSettings } from '@/state/settingsStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, dueToday, overdue } from '@/state/plannerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { useTimer } from '@/state/timerStore';
import { useAuth } from '@/state/authStore';
import { useGame, useGameContext } from '@/state/gameStore';
import { currentStreak, levelState, levelTitle, totalXp } from '@/services/gameService';
import { useT, L, type Msg } from '@/i18n';
import { S } from '@/i18n/strings';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { Tooltip } from '../kit';
import { MenuItem, Popover } from '../ui';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { ProfileMenuBody } from './ProfileMenu';
import { NoticeInbox } from './NoticePanel';

/**
 * The two widths, and why the narrow one keeps its ground.
 *
 * Animating the rail from narrow to wide *in the document flow* would push the
 * page across every time a pointer drifted near the left edge — and the page
 * here is a responsive grid of cards, a chart and a timeline, so it would
 * re-flow and re-render on the way out as well as on the way in. So in `hover`
 * the narrow rail keeps its 68 px of layout and the open panel floats over the
 * content. Same gesture, same reveal, and nothing behind it moves.
 */
const RAIL_NARROW = 68;
const RAIL_WIDE = 240;

const MODE_LABEL: Record<RailMode, Msg> = {
  expanded: L('Винаги отворена', 'Always open'),
  collapsed: L('Само икони', 'Icons only'),
  hover: L('Отваря се при посочване', 'Opens on hover'),
};

const MODES: RailMode[] = ['expanded', 'hover', 'collapsed'];

interface NavEntry {
  id: AppView;
  icon: string;
  badge?: number;
  /** amber instead of violet — something is late */
  alert?: boolean;
}

/**
 * ──────────────────────────────────────────────────────────────── the spine ──
 *
 * The order is the day, not the changelog: where you are, what you keep, what
 * you owe, when it happens, how you revise, how you concentrate, what it is
 * all filed under, how it is going.
 *
 * Everything the top bar used to hold is at the foot of it now — who you are,
 * what is waiting for you, and how wide this thing should be. A second bar
 * across the top of every screen to carry three controls was a strip of chrome
 * paying rent on the most valuable row of pixels in the window.
 */
export function Sidebar() {
  const t = useT();
  const view = useApp((s) => s.view);
  const activeSubject = useApp((s) => s.subjectId);
  const mode = useSettings((s) => s.railMode);
  const setSetting = useSettings((s) => s.set);
  /**
   * Open because the pointer is on the rail, or because somebody tabbed into
   * it. Keyboard counts: a rail that only opens for a mouse is a rail whose
   * labels a keyboard user never sees.
   */
  const [peeking, setPeeking] = useState(false);
  const open = mode === 'expanded' || (mode === 'hover' && peeking);
  const floating = mode === 'hover' && peeking;
  /** The space the rail takes in the layout, which never changes on hover. */
  const footprint = mode === 'expanded' ? RAIL_WIDE : RAIL_NARROW;

  const profile = useWorkspace((s) => s.profile);
  const items = usePlanner((s) => s.items);
  const cards = useCards((s) => s.cards);
  const running = useTimer((s) => s.running);
  const user = useAuth((s) => s.user);
  const sync = useAuth((s) => s.sync);
  const syncing = sync.phase !== 'idle' && sync.phase !== 'done' && sync.phase !== 'error';
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

  const isActive = (entry: NavEntry) => view === entry.id && !activeSubject;

  const renderItem = (entry: NavEntry) => {
    const active = isActive(entry);
    const label = t(VIEW_TITLES[entry.id]);
    const node = (
      <button
        key={entry.id}
        onClick={() => useApp.getState().go(entry.id)}
        aria-current={active ? 'page' : undefined}
        /* Named even while narrow. The visible label is unmounted then, and
           the tooltip beside it is a floating div that no `aria-describedby`
           points at — so without this a screen reader announced eight
           unlabelled buttons. */
        aria-label={label}
        className={`group relative flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[8px] text-[13.5px] transition-colors duration-150 ${
          open ? 'px-2.5' : 'justify-center px-0'
        } ${active ? 'font-medium' : 'font-normal text-muted hover:bg-surface-2 hover:text-ink'}`}
        /* The marker is an inset shadow rather than a positioned bar: the rail
           scrolls, and a scrolling box clips anything hanging outside it. */
        style={
          active
            ? {
                background: 'var(--c-accent-soft)',
                color: 'var(--c-accent)',
                boxShadow: 'inset 2px 0 0 var(--c-accent)',
              }
            : undefined
        }
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

        {/* Unmounted while narrow, not merely faded.
            An invisible box is still a box: `opacity: 0` hides ink and keeps
            the width, so a label and a count pill went on occupying 30-45 px
            of a 43 px row. The row overflowed, `justify-center` gave up, and
            the icon column zig-zagged left and right depending on whether a
            count happened to be non-zero that morning. The reveal is still a
            fade — it just comes from mounting now. */}
        {open && (
          <span className="animate-in flex-1 truncate text-left">{label}</span>
        )}
        {open && !!entry.badge && (
          <span
            className="animate-in t-num shrink-0 rounded-full px-1.5 py-px text-[11px] font-medium"
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
        {/* The dot replaces the pill rather than joining it. Both used to
            render at once, and the dot landed on top of the invisible pill —
            some 27 px away from the icon it was annotating. */}
        {!open && !!entry.badge && (
          <span
            className="absolute right-2 top-1.5 h-[6px] w-[6px] rounded-full"
            style={{ background: entry.alert ? 'var(--c-danger)' : 'var(--c-accent)' }}
          />
        )}
      </button>
    );
    return open ? (
      node
    ) : (
      <Tooltip key={entry.id} label={label} side="right" delay={120}>
        {node}
      </Tooltip>
    );
  };

  const modeControl = (
    <Popover
      width={224}
      side="top"
      align={open ? 'end' : 'center'}
      trigger={({ toggle, ref, open: isOpen }) => (
        <button
          ref={ref}
          onClick={toggle}
          aria-label={t(L('Странична лента', 'Sidebar'))}
          className={`icon-btn h-8 w-8 shrink-0 ${isOpen ? 'btn-ghost-active' : ''}`}
        >
          <Icon name="sidebar" size={16.5} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2 pb-1 pt-1.5">
            <span className="t-label">{t(L('Странична лента', 'Sidebar'))}</span>
          </div>
          {MODES.map((m) => (
            <MenuItem
              key={m}
              icon={m === 'expanded' ? 'panelLeft' : m === 'collapsed' ? 'chevronsLeft' : 'sidebar'}
              active={mode === m}
              label={t(MODE_LABEL[m])}
              onClick={() => {
                setSetting('railMode', m);
                setPeeking(false);
                close();
              }}
            />
          ))}
        </>
      )}
    </Popover>
  );

  return (
    /* The footprint. Its width follows the chosen mode and nothing else, which
       is what keeps the page still while the panel opens. */
    <div className="relative h-full shrink-0" style={{ width: footprint }}>
      <nav
        aria-label={t(L('Основна навигация', 'Main navigation'))}
        onPointerEnter={(e) => {
          // Touch is not hover: on a touch screen a tap would open the panel
          // and leave it open with no obvious way to shut it.
          if (e.pointerType !== 'touch' && mode === 'hover') setPeeking(true);
        }}
        onPointerLeave={() => setPeeking(false)}
        onFocusCapture={() => mode === 'hover' && setPeeking(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPeeking(false);
        }}
        className="absolute inset-y-0 left-0 flex flex-col border-r border-line"
        style={{
          width: open ? RAIL_WIDE : RAIL_NARROW,
          background: 'var(--c-surface)',
          /* The shadow lands at once — nobody watches a shadow fade in — and
             the width is quick enough to be over before the eye settles. */
          transition: 'width var(--dur) var(--ease-out)',
          boxShadow: floating ? 'var(--shadow-float)' : undefined,
          zIndex: floating ? 50 : undefined,
          overflow: 'hidden',
        }}
      >
        {/* ---------------------------------------------------------- brand */}
        <div className={`flex h-14 shrink-0 items-center ${open ? 'gap-2.5 px-4' : 'justify-center px-0'}`}>
          <button
            onClick={() => useApp.getState().go('dashboard')}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg"
            aria-label="Plauvia"
          >
            <PlauviaTile size={28} />
            {/* The wordmark is text, and text does not shrink. Left in the
                tree it pinned this button at 94 px inside a 67 px rail, and
                unsafe centring sliced half the mark off the left edge. */}
            {open && (
              <span className="animate-in">
                <PlauviaWordmark size={16.5} />
              </span>
            )}
          </button>
        </div>

        {/* ----------------------------------------------------- navigation */}
        {/* `overflow-y: auto` alone computes `overflow-x` to `auto` too, and a
            platform with non-overlay scrollbars then takes another 8-11 px out
            of a 43 px row. Nothing here ever scrolls sideways. */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-2">
          <div className="flex flex-col gap-0.5">{primary.map(renderItem)}</div>
          <div className="my-3 h-px" style={{ background: 'var(--c-line)' }} />
          <div className="flex flex-col gap-0.5">{secondary.map(renderItem)}</div>
        </div>

        {/* -------------------------------------------------------- account */}
        <div className="shrink-0 border-t border-line p-2">
          <div className={`flex items-center ${open ? 'gap-1' : 'flex-col gap-1'}`}>
            <Popover
              width={252}
              side="top"
              align="start"
              trigger={({ toggle, ref }) => {
                const button = (
                  <button
                    ref={ref}
                    onClick={toggle}
                    aria-label={t(S.profile)}
                    className={`flex min-w-0 cursor-pointer items-center gap-2.5 rounded-[10px] text-left transition-colors hover:bg-surface-2 ${
                      open ? 'flex-1 p-1.5' : 'h-11 w-11 justify-center'
                    }`}
                  >
                    <span className="relative shrink-0">
                      <ProfileAvatar size={open ? 30 : 28} ring={level.progress} />
                      {user && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full"
                          style={{ background: 'var(--c-surface)' }}
                          title={
                            syncing
                              ? t(L('Синхронизира се', 'Syncing'))
                              : sync.error
                                ? t(L('Проблем със синхронизацията', 'Sync problem'))
                                : t(L('Синхронизирано', 'Synced'))
                          }
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${syncing ? 'animate-pulse' : ''}`}
                            style={{ background: sync.error ? 'var(--c-danger)' : 'var(--c-success)' }}
                          />
                        </span>
                      )}
                    </span>
                    {open && (
                      <span className="animate-in min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {profile.name || t(L('Твоят профил', 'Your profile'))}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                          {t(S.level)} {level.level} · {t(levelTitle(level.level))}
                        </span>
                      </span>
                    )}
                    {open && streak > 0 && (
                      <span
                        className="animate-in t-num flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: 'color-mix(in srgb, var(--c-ember) 16%, transparent)',
                          color: 'var(--c-ember)',
                        }}
                      >
                        <Icon name="flame" size={11} fill />
                        {streak}
                      </span>
                    )}
                  </button>
                );
                return open ? (
                  button
                ) : (
                  <Tooltip label={`${t(S.level)} ${level.level} · ${streak} 🔥`} side="right" delay={120}>
                    {button}
                  </Tooltip>
                );
              }}
            >
              {(close) => <ProfileMenuBody close={close} />}
            </Popover>

            {/* Stacked while the rail is narrow. Two 32 px buttons and a gap
                need 66 px; the rail's padding box gives them 52, and flex
                answered that by squeezing the gap to nothing and pushing both
                of them through the border on either side. */}
            <div className={`flex shrink-0 items-center gap-0.5 ${open ? '' : 'flex-col'}`}>
              <NoticeInbox align={open ? 'end' : 'center'} side="top" />
              {modeControl}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
