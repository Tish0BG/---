import { Icon } from '../Icon';
import { Tip } from '../ui';
import { LibraryPanel } from './LibraryPanel';
import { Thumbnails } from './Thumbnails';
import { BookmarksPanel } from './BookmarksPanel';
import { SearchPanel } from './SearchPanel';
import { InfoPanel } from './InfoPanel';

export type SidebarTab = 'library' | 'pages' | 'bookmarks' | 'search' | 'info';

const TABS: { id: SidebarTab; icon: string; label: string }[] = [
  { id: 'library', icon: 'book', label: 'Библиотека' },
  { id: 'pages', icon: 'grid', label: 'Страници' },
  { id: 'bookmarks', icon: 'bookmark', label: 'Отметки и задачи' },
  { id: 'search', icon: 'search', label: 'Търсене' },
  { id: 'info', icon: 'info', label: 'Информация' },
];

/**
 * One sidebar, five panels. Folding library, thumbnails, bookmarks, search and
 * document info into tabs keeps a single narrow column of chrome next to the
 * page instead of stacking several panels.
 */
export function Sidebar({
  tab,
  setTab,
  onClose,
}: {
  tab: SidebarTab;
  setTab: (t: SidebarTab) => void;
  onClose?: () => void;
}) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-0.5 border-b border-line px-2 py-1.5">
        {TABS.map((t) => (
          <Tip key={t.id} label={t.label}>
            <button
              className={`icon-btn ${tab === t.id ? 'btn-ghost-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
            >
              <Icon name={t.icon} size={16} />
            </button>
          </Tip>
        ))}
        {onClose && (
          <button className="icon-btn ml-auto" onClick={onClose} aria-label="Скрий панела">
            <Icon name="chevronsLeft" size={16} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'library' && <LibraryPanel />}
        {tab === 'pages' && <Thumbnails />}
        {tab === 'bookmarks' && <BookmarksPanel />}
        {tab === 'search' && <SearchPanel autoFocus />}
        {tab === 'info' && <InfoPanel />}
      </div>
    </aside>
  );
}
