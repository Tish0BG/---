import { useMemo, useRef, useState } from 'react';
import type { DocumentMeta } from '@/types';
import { folderPath, progressOf, useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { useSettings } from '@/state/settingsStore';
import { useTimer } from '@/state/timerStore';
import { formatDate } from '@/lib/util';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover, useConfirm } from '../ui';
import { NewBoardDialog } from '../board/NewBoardDialog';

/** Home screen: folders, documents and the import surface. */
export function LibraryHome({
  onSettings,
  onReview,
  dueCount,
}: {
  onSettings: () => void;
  onReview: () => void;
  dueCount: number;
}) {
  const {
    folders,
    documents,
    activeFolderId,
    setActiveFolder,
    createFolder,
    importFiles,
    importing,
    query,
    setQuery,
  } = useLibrary();
  const openDocument = useViewer((s) => s.openDocument);
  const theme = useSettings((s) => s.theme);
  const setSetting = useSettings((s) => s.set);
  const [dragging, setDragging] = useState(false);
  const [newBoard, setNewBoard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, element } = useConfirm();

  const path = folderPath(folders, activeFolderId);
  const childFolders = folders
    .filter((f) => f.parentId === activeFolderId)
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'));

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const list = q
      ? documents.filter((d) => d.name.toLowerCase().includes(q))
      : documents.filter((d) => d.folderId === activeFolderId);
    return list.sort((a, b) => (b.openedAt ?? b.createdAt) - (a.openedAt ?? a.createdAt));
  }, [documents, activeFolderId, q]);

  const recent = useMemo(
    () => documents.filter((d) => d.openedAt).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0)).slice(0, 4),
    [documents],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    if (files.length) void importFiles(files, activeFolderId);
  };

  return (
    <div
      className="scroll-thin relative h-full overflow-y-auto"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {element}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) void importFiles(files, activeFolderId);
          e.target.value = '';
        }}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-7">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-1 text-[12px] text-muted ${path.length ? '' : 'hidden sm:flex'}`}>
              <button className="cursor-pointer hover:text-ink" onClick={() => setActiveFolder(null)}>
                Моята библиотека
              </button>
              {path.map((f) => (
                <span key={f.id} className="flex items-center gap-1">
                  <Icon name="chevronRight" size={12} className="text-faint" />
                  <button className="cursor-pointer hover:text-ink" onClick={() => setActiveFolder(f.id)}>
                    {f.name}
                  </button>
                </span>
              ))}
            </div>
            <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight">
              {path.at(-1)?.name ?? 'Моята библиотека'}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Търси…"
                className="field h-9 w-full pl-8 sm:w-44"
              />
            </div>
            <button
              className="btn h-9 shrink-0"
              title="Нова папка"
              onClick={() => void createFolder('Нова папка', activeFolderId)}
            >
              <Icon name="folderPlus" size={16} />
              <span className="hidden lg:inline">Папка</span>
            </button>
            <button className="btn h-9 shrink-0 relative" onClick={onReview} title="Флашкарти за преговор">
              <Icon name="cards" size={16} />
              <span className="hidden lg:inline">Карти</span>
              {dueCount > 0 && (
                <span
                  className="chip ml-0.5 px-1.5 tabular-nums"
                  style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
                >
                  {dueCount}
                </span>
              )}
            </button>
            <button className="btn h-9 shrink-0" onClick={() => setNewBoard(true)}>
              <Icon name="board" size={16} />
              <span className="hidden sm:inline">Нова дъска</span>
            </button>
            <button className="btn btn-primary h-9 shrink-0" onClick={() => inputRef.current?.click()}>
              <Icon name="upload" size={16} />
              <span className="hidden sm:inline">Качи PDF</span>
            </button>
            <button
              className="icon-btn h-9 w-9 shrink-0"
              title="Фокус таймер (⌥T)"
              onClick={() => useTimer.getState().toggleWidget()}
            >
              <Icon name="timer" size={17} />
            </button>
            <button
              className="icon-btn h-9 w-9 shrink-0"
              onClick={() => setSetting('theme', theme === 'dark' ? 'light' : 'dark')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
            <button className="icon-btn h-9 w-9 shrink-0" onClick={onSettings}>
              <Icon name="sliders" size={17} />
            </button>
          </div>
        </div>

        {importing && (
          <div className="panel mb-5 flex items-center gap-3 px-4 py-3 text-[13px]">
            <Icon name="refresh" size={15} className="animate-spin text-accent" />
            Импортиране на {importing.current} ({importing.done + 1}/{importing.total})
          </div>
        )}

        {!q && recent.length > 0 && !activeFolderId && (
          <section className="mb-7">
            <h2 className="mb-2 label">Продължи</h2>
            <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
              {recent.map((d) => (
                <button
                  key={d.id}
                  onClick={() => void openDocument(d.id)}
                  className="panel flex w-64 shrink-0 cursor-pointer items-center gap-3 p-2.5 text-left transition-colors hover:bg-surface-2"
                >
                  <Cover doc={d} className="h-12 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{d.name}</span>
                    <span className="block text-[11px] text-muted">
                      стр. {d.lastPage} · {Math.round(progressOf(d) * 100)}%
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {childFolders.length > 0 && !q && (
          <section className="mb-7">
            <h2 className="mb-2 label">Папки</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {childFolders.map((f) => (
                <FolderCard key={f.id} id={f.id} name={f.name} confirm={confirm} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 label">
            {q ? `Резултати (${visible.length})` : 'Документи'}
          </h2>
          {visible.length === 0 ? (
            <EmptyState
              onPick={() => inputRef.current?.click()}
              onBoard={() => setNewBoard(true)}
              searching={!!q}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((d) => (
                <DocCard key={d.id} doc={d} confirm={confirm} />
              ))}
            </div>
          )}
        </section>
      </div>

      <NewBoardDialog open={newBoard} onClose={() => setNewBoard(false)} folderId={activeFolderId} />

      {dragging && (
        <div
          className="pointer-events-none fixed inset-0 z-40 grid place-items-center"
          style={{ background: 'color-mix(in srgb, var(--c-accent) 12%, transparent)' }}
        >
          <div className="panel px-6 py-4 text-[14px] font-medium">Пусни PDF файловете тук</div>
        </div>
      )}
    </div>
  );
}

function FolderCard({
  id,
  name,
  confirm,
}: {
  id: string;
  name: string;
  confirm: (m: string, cb: () => void) => void;
}) {
  const { setActiveFolder, renameFolder, deleteFolder, moveDocument } = useLibrary();
  const [over, setOver] = useState(false);
  return (
    <div
      className={`panel group flex items-center gap-2 p-2.5 transition-colors ${over ? 'ring-2 ring-[var(--c-accent)]' : 'hover:bg-surface-2'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const docId = e.dataTransfer.getData('text/document');
        if (docId) void moveDocument(docId, id);
      }}
    >
      <button className="flex min-w-0 flex-1 cursor-pointer items-center gap-2" onClick={() => setActiveFolder(id)}>
        <Icon name="folder" size={17} className="shrink-0 text-accent" />
        <span className="truncate text-[13px]">{name}</span>
      </button>
      <Popover
        width={180}
        align="end"
        trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" onClick={toggle}>
            <Icon name="dots" size={14} />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon="pencil"
              label="Преименувай"
              onClick={() => {
                const n = prompt('Име на папката', name);
                if (n) void renameFolder(id, n);
                close();
              }}
            />
            <MenuSep />
            <MenuItem
              icon="trash"
              label="Изтрий"
              danger
              onClick={() => {
                close();
                confirm(`Да изтрия ли «${name}»?`, () => deleteFolder(id));
              }}
            />
          </>
        )}
      </Popover>
    </div>
  );
}

function DocCard({ doc, confirm }: { doc: DocumentMeta; confirm: (m: string, cb: () => void) => void }) {
  const openDocument = useViewer((s) => s.openDocument);
  const { renameDocument, deleteDocument, folders, moveDocument } = useLibrary();
  const pct = Math.round(progressOf(doc) * 100);

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/document', doc.id)}
      className="panel group relative overflow-hidden transition-shadow hover:shadow-[var(--shadow-float)]"
    >
      <button className="block w-full cursor-pointer text-left" onClick={() => void openDocument(doc.id)}>
        <Cover doc={doc} className="aspect-[3/4] w-full border-b border-line" />
        <div className="p-2.5">
          <div className="truncate text-[13px] font-medium leading-tight">{doc.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
            {doc.kind === 'board' && <Icon name="board" size={11} className="text-accent" />}
            <span>
              {doc.board?.flow === 'scroll' ? 'свитък' : `${doc.pageCount} стр.`}
            </span>
            {doc.annotationCount > 0 && (
              <>
                <span className="text-faint">·</span>
                <span className="flex items-center gap-0.5">
                  <Icon name="pencil" size={10} />
                  {doc.annotationCount}
                </span>
              </>
            )}
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusColor(doc) }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-faint">
            <span>{pct}%</span>
            <span>{formatDate(doc.openedAt)}</span>
          </div>
        </div>
      </button>

      <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Popover
          width={200}
          align="end"
          trigger={({ toggle, ref }) => (
            <button
              ref={ref}
              className="icon-btn h-7 w-7 backdrop-blur"
              style={{ background: 'color-mix(in srgb, var(--c-surface) 80%, transparent)' }}
              onClick={toggle}
            >
              <Icon name="dots" size={15} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon="pencil"
                label="Преименувай"
                onClick={() => {
                  const n = prompt('Име на документа', doc.name);
                  if (n) void renameDocument(doc.id, n);
                  close();
                }}
              />
              <MenuSep />
              <div className="px-2 py-1 text-[11px] text-faint">Премести в</div>
              <div className="max-h-40 overflow-auto scroll-thin">
                <MenuItem icon="home" label="Библиотека" active={!doc.folderId} onClick={() => { void moveDocument(doc.id, null); close(); }} />
                {folders.map((f) => (
                  <MenuItem
                    key={f.id}
                    icon="folder"
                    label={f.name}
                    active={doc.folderId === f.id}
                    onClick={() => {
                      void moveDocument(doc.id, f.id);
                      close();
                    }}
                  />
                ))}
              </div>
              <MenuSep />
              <MenuItem
                icon="trash"
                label="Изтрий"
                danger
                onClick={() => {
                  close();
                  confirm(`Да изтрия ли «${doc.name}» с всички бележки?`, () => deleteDocument(doc.id));
                }}
              />
            </>
          )}
        </Popover>
      </div>
    </div>
  );
}

function Cover({ doc, className = '' }: { doc: DocumentMeta; className?: string }) {
  return doc.cover ? (
    <img src={doc.cover} alt="" className={`bg-white object-cover ${className}`} draggable={false} />
  ) : (
    <div className={`grid place-items-center bg-surface-2 ${className}`}>
      <Icon name={doc.kind === 'board' ? 'board' : 'file'} size={22} className="text-faint" />
    </div>
  );
}

const statusColor = (d: DocumentMeta) =>
  d.status === 'completed' ? 'var(--c-success)' : d.status === 'review' ? 'var(--c-warn)' : 'var(--c-accent)';

function EmptyState({
  onPick,
  onBoard,
  searching,
}: {
  onPick: () => void;
  onBoard: () => void;
  searching: boolean;
}) {
  if (searching) return <p className="py-10 text-center text-[13px] text-faint">Няма намерени документи.</p>;
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong py-14">
      <Icon name="upload" size={26} className="text-faint" />
      <span className="text-[14px] font-medium">Качи PDF учебник или започни на празна дъска</span>
      <span className="text-[12px] text-muted">
        Пусни файловете направо тук. Всичко остава на това устройство.
      </span>
      <div className="mt-1 flex gap-2">
        <button className="btn btn-primary" onClick={onPick}>
          <Icon name="upload" size={15} />
          Качи PDF
        </button>
        <button className="btn" onClick={onBoard}>
          <Icon name="board" size={15} />
          Нова дъска
        </button>
      </div>
    </div>
  );
}
