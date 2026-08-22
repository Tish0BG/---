import { useEffect, useState } from 'react';
import { useViewer } from '@/state/viewerStore';
import { useTimer } from '@/state/timerStore';
import { useSettings } from '@/state/settingsStore';
import { useLibrary } from '@/state/libraryStore';
import { Icon } from './Icon';
import { MenuItem, MenuSep, Popover, Tip } from './ui';
import { BoardControls } from './board/BoardControls';
import { useT, tr, L } from '@/i18n';
import { S } from '@/i18n/strings';

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export function TopBar({
  onToggleSidebar,
  onExport,
  onSettings,
  onCards,
  dueCount,
}: {
  onToggleSidebar: () => void;
  onExport: () => void;
  onSettings: () => void;
  onCards: () => void;
  dueCount: number;
}) {
  const t = useT();
  const meta = useViewer((s) => s.meta);
  const pageCount = useViewer((s) => s.pageCount);
  const currentPage = useViewer((s) => s.currentPage);
  const zoom = useViewer((s) => s.zoom);
  const fitMode = useViewer((s) => s.fitMode);
  const saveStatus = useViewer((s) => s.saveStatus);
  const bookmarks = useViewer((s) => s.bookmarks);
  const goToPage = useViewer((s) => s.goToPage);
  const setZoom = useViewer((s) => s.setZoom);
  const setFitMode = useViewer((s) => s.setFitMode);
  const toggleBookmark = useViewer((s) => s.toggleBookmark);
  const closeDocument = useViewer((s) => s.closeDocument);
  const renameDocument = useLibrary((s) => s.renameDocument);
  const theme = useSettings((s) => s.theme);
  const setSetting = useSettings((s) => s.set);

  const [pageInput, setPageInput] = useState(String(currentPage));
  useEffect(() => setPageInput(String(currentPage)), [currentPage]);

  const isBookmarked = bookmarks.some((b) => b.page === currentPage);

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-surface px-2">
      <button className="icon-btn" onClick={onToggleSidebar} aria-label={t(L("Панел", "Panel"))}>
        <Icon name="panelLeft" size={17} />
      </button>
      <Tip label={t(L("Към библиотеката", "Back to the library"))}>
        <button className="icon-btn" onClick={() => void closeDocument()} aria-label={t(L("Библиотека", "Library"))}>
          <Icon name="arrowLeft" size={17} />
        </button>
      </Tip>

      <button
        className="ml-1 hidden min-w-0 max-w-[24vw] truncate rounded px-1 text-[13px] font-medium hover:bg-surface-3 cursor-text sm:block"
        title={t(L("Кликни, за да преименуваш", "Click to rename"))}
        onClick={() => {
          if (!meta) return;
          const name = prompt(t(L('Име на документа', 'Document name')), meta.name);
          if (name) void renameDocument(meta.id, name);
        }}
      >
        {meta?.name ?? '—'}
      </button>
      <SaveBadge status={saveStatus} />

      {/* page navigation */}
      <div className="ml-auto flex items-center gap-0.5">
        <button className="icon-btn" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
          <Icon name="chevronLeft" size={17} />
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(pageInput, 10);
            if (!Number.isNaN(n)) goToPage(n);
          }}
        >
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onFocus={(e) => e.target.select()}
            onBlur={() => setPageInput(String(currentPage))}
            onKeyDown={(e) => e.stopPropagation()}
            className="field h-7 w-11 px-1 text-center tabular-nums"
            aria-label={t(L("Номер на страница", "Page number"))}
          />
        </form>
        <span className="px-1 text-[12px] tabular-nums text-muted">/ {pageCount}</span>
        <button className="icon-btn" disabled={currentPage >= pageCount} onClick={() => goToPage(currentPage + 1)}>
          <Icon name="chevronRight" size={17} />
        </button>
      </div>

      {/* zoom */}
      <div className="ml-2 flex items-center gap-0.5">
        <button className="icon-btn hidden sm:inline-flex" onClick={() => setZoom(zoom / 1.2)} aria-label={t(L('Намали', 'Zoom out'))}>
          <Icon name="zoomOut" size={17} />
        </button>
        <Popover
          width={180}
          align="center"
          trigger={({ toggle, ref }) => (
            <button ref={ref} onClick={toggle} className="btn w-14 justify-center tabular-nums text-[12px]">
              {Math.round(zoom * 100)}%
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon="fitWidth"
                label={t(L('По ширина', 'Fit width'))}
                active={fitMode === 'width'}
                onClick={() => {
                  setFitMode('width');
                  close();
                }}
              />
              <MenuItem
                icon="fitPage"
                label={t(L('Цяла страница', 'Whole page'))}
                active={fitMode === 'page'}
                onClick={() => {
                  setFitMode('page');
                  close();
                }}
              />
              <MenuSep />
              {ZOOM_STEPS.map((z) => (
                <MenuItem
                  key={z}
                  label={`${z * 100}%`}
                  active={fitMode === 'none' && Math.abs(zoom - z) < 0.01}
                  onClick={() => {
                    setZoom(z, 'none');
                    close();
                  }}
                />
              ))}
            </>
          )}
        </Popover>
        <button className="icon-btn hidden sm:inline-flex" onClick={() => setZoom(zoom * 1.2)} aria-label={t(L('Увеличи', 'Zoom in'))}>
          <Icon name="zoomIn" size={17} />
        </button>
      </div>

      {meta?.kind === 'board' && (
        <>
          <div className="mx-1.5 hidden h-6 w-px bg-line sm:block" />
          <div className="hidden sm:block">
            <BoardControls />
          </div>
        </>
      )}

      <div className="mx-1.5 hidden h-6 w-px bg-line md:block" />

      <div className="hidden items-center gap-0.5 md:flex">
        <Tip label={t(L('Фокус таймер (⌥T)', 'Focus timer (⌥T)'))}>
          <button className="icon-btn" onClick={() => useTimer.getState().toggleWidget()}>
            <Icon name="timer" size={17} />
          </button>
        </Tip>
        <Tip label={t(dueCount ? L(`${dueCount} карти за преговор`, `${dueCount} cards due`) : S.cards)}>
          <button className="icon-btn relative" onClick={onCards}>
            <Icon name="cards" size={17} />
            {dueCount > 0 && (
              <span
                className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--c-accent)' }}
              />
            )}
          </button>
        </Tip>
        <Tip label={t(isBookmarked ? L('Премахни отметката', 'Remove bookmark') : L('Отметка (⌘D)', 'Bookmark (⌘D)'))}>
          <button className="icon-btn" onClick={() => void toggleBookmark(currentPage)}>
            <Icon name="bookmark" size={17} fill={isBookmarked} className={isBookmarked ? 'text-warn' : ''} />
          </button>
        </Tip>
        <Tip label={t(L("Експорт (⌘E)", "Export (⌘E)"))}>
          <button className="icon-btn" onClick={onExport}>
            <Icon name="download" size={17} />
          </button>
        </Tip>
        <Tip label={t(theme === 'dark' ? L('Светла тема', 'Light theme') : L('Тъмна тема', 'Dark theme'))}>
          <button className="icon-btn" onClick={() => setSetting('theme', theme === 'dark' ? 'light' : 'dark')}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          </button>
        </Tip>
        <Tip label={t(L("Настройки", "Settings"))}>
          <button className="icon-btn" onClick={onSettings}>
            <Icon name="sliders" size={17} />
          </button>
        </Tip>
      </div>

      {/* the same actions folded into one menu when the bar gets tight */}
      <Popover
        width={210}
        align="end"
        trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn md:hidden" onClick={toggle} aria-label={t(L("Още", "More"))}>
            <Icon name="dots" size={17} />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon="bookmark"
              label={t(isBookmarked ? L('Премахни отметката', 'Remove bookmark') : L('Отметка', 'Bookmark'))}
              onClick={() => {
                void toggleBookmark(currentPage);
                close();
              }}
            />
            <MenuItem
              icon="download"
              label={t(L("Експорт", "Export"))}
              onClick={() => {
                onExport();
                close();
              }}
            />
            <MenuItem
              icon="timer"
              label={t(L("Фокус таймер", "Focus timer"))}
              onClick={() => {
                useTimer.getState().toggleWidget();
                close();
              }}
            />
            <MenuItem
              icon="cards"
              label={t(dueCount ? L(`Флашкарти (${dueCount})`, `Flashcards (${dueCount})`) : S.cards)}
              onClick={() => {
                onCards();
                close();
              }}
            />
            <MenuItem
              icon={theme === 'dark' ? 'sun' : 'moon'}
              label={t(theme === 'dark' ? L('Светла тема', 'Light theme') : L('Тъмна тема', 'Dark theme'))}
              onClick={() => {
                setSetting('theme', theme === 'dark' ? 'light' : 'dark');
                close();
              }}
            />
            <MenuSep />
            <MenuItem
              icon="sliders"
              label={t(L("Настройки", "Settings"))}
              onClick={() => {
                onSettings();
                close();
              }}
            />
          </>
        )}
      </Popover>
    </header>
  );
}

function SaveBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; color: string; icon: string }> = {
    saved: { text: tr(L('Записано', 'Saved')), color: 'var(--c-muted)', icon: 'check' },
    saving: { text: tr(L('Записване…', 'Saving…')), color: 'var(--c-accent)', icon: 'refresh' },
    unsaved: { text: tr(L('Незаписано', 'Unsaved')), color: 'var(--c-warn)', icon: 'clock' },
    error: { text: tr(L('Грешка при запис', 'Save failed')), color: 'var(--c-danger)', icon: 'alert' },
  };
  const s = map[status] ?? map.saved;
  return (
    <span className="ml-1.5 hidden items-center gap-1 text-[11px] sm:flex" style={{ color: s.color }} title={s.text}>
      <Icon name={s.icon} size={12} />
      <span className="hidden md:inline">{s.text}</span>
    </span>
  );
}
