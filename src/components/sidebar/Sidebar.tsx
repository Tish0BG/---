import { Icon } from '../Icon';
import { Tip } from '../ui';
import { LibraryPanel } from './LibraryPanel';
import { Thumbnails } from './Thumbnails';
import { BookmarksPanel } from './BookmarksPanel';
import { SearchPanel } from './SearchPanel';
import { InfoPanel } from './InfoPanel';
import { useT, L, type Msg } from '@/i18n';

export type SidebarTab = 'library' | 'pages' | 'bookmarks' | 'search' | 'info';

const TABS: { id: SidebarTab; icon: string; label: Msg }[] = [
  { id: 'library', icon: 'book', label: L('Библиотека', 'Library') },
  { id: 'pages', icon: 'grid', label: L('Страници', 'Pages') },
  { id: 'bookmarks', icon: 'bookmark', label: L('Отметки и задачи', 'Bookmarks & problems') },
  { id: 'search', icon: 'search', label: L('Търсене', 'Search') },
  { id: 'info', icon: 'info', label: L('Информация', 'Details') },
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
  const t = useT();
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-0.5 border-b border-line px-2 py-1.5">
        {TABS.map((item) => (
          <Tip key={item.id} label={t(item.label)}>
            <button
              className={`icon-btn ${tab === item.id ? 'btn-ghost-active' : ''}`}
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
            >
              <Icon name={item.icon} size={16} />
            </button>
          </Tip>
        ))}
        {onClose && (
          <button className="icon-btn ml-auto" onClick={onClose} aria-label={t(L("Скрий панела", "Hide the panel"))}>
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
