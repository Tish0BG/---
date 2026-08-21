import { useMemo } from 'react';
import { VIEW_TITLES, useApp, type AppView } from '@/state/appStore';
import { useSettings } from '@/state/settingsStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, dueToday, overdue } from '@/state/plannerStore';
import { useCards, dueCount } from '@/state/cardStore';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { Tip } from '../ui';

const ITEMS: { id: AppView; icon: string }[] = [
  { id: 'dashboard', icon: 'dashboard' },
  { id: 'drive', icon: 'drive' },
  { id: 'planner', icon: 'calendarCheck' },
  { id: 'cards', icon: 'cards' },
  { id: 'subjects', icon: 'layers' },
  { id: 'stats', icon: 'barChart' },
];

/**
 * The spine of the app. Collapsed it is a strip of icons; expanded it also
 * lists the subjects, which is how most navigation actually happens once a
 * term is under way.
 */
export function NavRail() {
  const view = useApp((s) => s.view);
  const activeSubject = useApp((s) => s.subjectId);
  const collapsed = useSettings((s) => s.railCollapsed);
  const setSetting = useSettings((s) => s.set);
  const subjects = useWorkspace((s) => s.subjects);
  const items = usePlanner((s) => s.items);
  const cards = useCards((s) => s.cards);

  const badges = useMemo(
    () => ({
      planner: dueToday(items).length + overdue(items).length,
      cards: dueCount(cards),
    }),
    [items, cards],
  );

  const width = collapsed ? 60 : 216;

  return (
    <nav
      className="flex h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-150"
      style={{ width }}
    >
      <div className={`flex items-center gap-2.5 px-3 py-3.5 ${collapsed ? 'justify-center' : ''}`}>
        <PlauviaTile size={32} />
        {!collapsed && <PlauviaWordmark size={16} className="truncate" />}
      </div>

      <div className="flex flex-col gap-0.5 px-2">
        {ITEMS.map((item) => {
          const active = view === item.id;
          const badge = badges[item.id as 'planner' | 'cards'];
          const button = (
            <button
              key={item.id}
              onClick={() => useApp.getState().go(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] transition-colors ${
                active ? 'btn-ghost-active font-medium' : 'text-muted hover:bg-surface-3 hover:text-ink'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full"
                  style={{ background: 'var(--c-accent)' }}
                  aria-hidden
                />
              )}
              <Icon name={item.icon} size={17} className="shrink-0" strokeWidth={active ? 2 : 1.75} />
              {!collapsed && <span className="flex-1 truncate text-left">{VIEW_TITLES[item.id]}</span>}
              {!!badge && (
                <span
                  className="chip shrink-0 px-1.5 tabular-nums"
                  style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
          return collapsed ? (
            <Tip key={item.id} label={VIEW_TITLES[item.id]}>
              {button}
            </Tip>
          ) : (
            button
          );
        })}
      </div>

      {!collapsed && subjects.length > 0 && (
        <div className="scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <div className="px-2.5 pb-1 label">
            Предмети
          </div>
          {subjects
            .filter((s) => !s.archived)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => useApp.getState().openSubject(s.id)}
                className={`flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] transition-colors ${
                  activeSubject === s.id ? 'bg-surface-3 text-ink' : 'text-muted hover:bg-surface-3'
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="truncate text-left">{s.name}</span>
              </button>
            ))}
        </div>
      )}

      <div className={`mt-auto flex px-2 pb-2 ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          className="icon-btn"
          onClick={() => setSetting('railCollapsed', !collapsed)}
          aria-label={collapsed ? 'Разгъни' : 'Свий'}
        >
          <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} size={16} />
        </button>
      </div>
    </nav>
  );
}
