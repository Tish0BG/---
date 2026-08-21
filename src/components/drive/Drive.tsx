import { useMemo, useRef, useState } from 'react';
import type { DocumentMeta } from '@/types';
import { folderPath, progressOf, useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useSettings } from '@/state/settingsStore';
import { formatBytes, formatDate } from '@/lib/util';
import { notify } from '@/state/toastStore';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover, useConfirm } from '../ui';
import { SubjectDot } from '../subjects/SubjectDot';

type Scope = 'all' | 'pdf' | 'board' | 'starred' | 'trash';

const SCOPES: { id: Scope; label: string; icon: string }[] = [
  { id: 'all', label: 'Всички', icon: 'drive' },
  { id: 'pdf', label: 'Материали', icon: 'file' },
  { id: 'board', label: 'Дъски', icon: 'board' },
  { id: 'starred', label: 'Със звезда', icon: 'star' },
  { id: 'trash', label: 'Кошче', icon: 'trash' },
];

/**
 * The workspace: folders, materials and boards with the affordances people
 * expect from a drive — grid or table, sorting, multi-select with bulk
 * actions, stars and a bin you can get things back out of.
 */
export function Drive({ onNewBoard }: { onNewBoard: () => void }) {
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
  const subjects = useWorkspace((s) => s.subjects);
  const view = useSettings((s) => s.driveView);
  const sort = useSettings((s) => s.driveSort);
  const setSetting = useSettings((s) => s.set);

  const [scope, setScope] = useState<Scope>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, element } = useConfirm();

  const path = folderPath(folders, activeFolderId);
  const childFolders = useMemo(
    () =>
      scope === 'trash' || query
        ? []
        : folders.filter((f) => f.parentId === activeFolderId).sort((a, b) => a.name.localeCompare(b.name, 'bg')),
    [folders, activeFolderId, scope, query],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = documents.filter((d) => (scope === 'trash' ? !!d.deletedAt : !d.deletedAt));
    if (scope === 'pdf') list = list.filter((d) => d.kind === 'pdf');
    if (scope === 'board') list = list.filter((d) => d.kind === 'board');
    if (scope === 'starred') list = list.filter((d) => d.starred);
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q));
    else if (scope === 'all' || scope === 'pdf' || scope === 'board') {
      list = list.filter((d) => d.folderId === activeFolderId);
    }
    const by = {
      recent: (a: DocumentMeta, b: DocumentMeta) => (b.openedAt ?? b.createdAt) - (a.openedAt ?? a.createdAt),
      name: (a: DocumentMeta, b: DocumentMeta) => a.name.localeCompare(b.name, 'bg'),
      progress: (a: DocumentMeta, b: DocumentMeta) => progressOf(b) - progressOf(a),
      size: (a: DocumentMeta, b: DocumentMeta) => b.size - a.size,
    }[sort];
    return [...list].sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || by(a, b));
  }, [documents, activeFolderId, scope, query, sort]);

  const trashCount = documents.filter((d) => d.deletedAt).length;
  const totalBytes = documents.filter((d) => !d.deletedAt).reduce((sum, d) => sum + d.size, 0);
  const selectedDocs = visible.filter((d) => selected.has(d.id));

  const toggleSelect = (id: string, additive: boolean) =>
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set<string>();
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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

      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        {/* ------------------------------------------------------- header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[12px] text-muted">
              <button className="cursor-pointer hover:text-ink" onClick={() => setActiveFolder(null)}>
                Библиотека
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
              {path.at(-1)?.name ?? 'Библиотека'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn h-9" onClick={() => void createFolder('Нова папка', activeFolderId)}>
              <Icon name="folderPlus" size={16} />
              <span className="hidden lg:inline">Папка</span>
            </button>
            <button className="btn h-9" onClick={onNewBoard}>
              <Icon name="board" size={16} />
              <span className="hidden sm:inline">Нова дъска</span>
            </button>
            <button className="btn btn-primary h-9" onClick={() => inputRef.current?.click()}>
              <Icon name="upload" size={16} />
              <span className="hidden sm:inline">Качи PDF</span>
            </button>
          </div>
        </div>

        {/* -------------------------------------------------------- toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--c-surface-3)' }}>
            {SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setScope(s.id);
                  setSelected(new Set());
                }}
                aria-pressed={scope === s.id}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${
                  scope === s.id
                    ? 'bg-surface font-medium shadow-[var(--shadow-sm)]'
                    : 'text-muted hover:text-ink'
                }`}
                style={scope === s.id ? { color: 'var(--c-text)' } : undefined}
              >
                <Icon name={s.icon} size={13} />
                <span className="hidden sm:inline">{s.label}</span>
                {s.id === 'trash' && trashCount > 0 && (
                  <span className="tabular-nums text-faint">{trashCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Icon
              name="search"
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Търси в библиотеката…"
              className="field h-9 pl-8"
            />
          </div>

          <Popover
            width={190}
            align="end"
            trigger={({ toggle, ref }) => (
              <button ref={ref} className="btn h-9" onClick={toggle}>
                <Icon name="filter" size={14} />
                <span className="hidden lg:inline">{SORT_LABELS[sort]}</span>
              </button>
            )}
          >
            {(close) =>
              (Object.keys(SORT_LABELS) as (keyof typeof SORT_LABELS)[]).map((id) => (
                <MenuItem
                  key={id}
                  label={SORT_LABELS[id]}
                  active={sort === id}
                  onClick={() => {
                    setSetting('driveSort', id);
                    close();
                  }}
                />
              ))
            }
          </Popover>

          <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--c-surface-3)' }}>
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSetting('driveView', v)}
                className={`cursor-pointer rounded-md px-2 py-1.5 transition-colors ${
                  view === v ? 'bg-surface shadow-[var(--shadow-panel)]' : 'text-muted'
                }`}
                aria-label={v === 'grid' ? 'Решетка' : 'Списък'}
              >
                <Icon name={v === 'grid' ? 'grid' : 'table'} size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------- selection bar */}
        {selectedDocs.length > 0 && (
          <div className="panel mb-3 flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="text-[12px] text-muted">{selectedDocs.length} избрани</span>
            <div className="mx-1 h-5 w-px bg-line" />
            {scope === 'trash' ? (
              <>
                <button
                  className="btn"
                  onClick={() => {
                    selectedDocs.forEach((d) => void useLibrary.getState().restoreDocument(d.id));
                    setSelected(new Set());
                  }}
                >
                  <Icon name="restore" size={14} />
                  Възстанови
                </button>
                <button
                  className="btn"
                  style={{ color: 'var(--c-danger)' }}
                  onClick={() =>
                    confirm(`Да изтрия ли окончателно ${selectedDocs.length} елемента?`, () => {
                      void useLibrary.getState().purgeDocuments(selectedDocs.map((d) => d.id));
                      setSelected(new Set());
                    })
                  }
                >
                  <Icon name="trash" size={14} />
                  Изтрий завинаги
                </button>
              </>
            ) : (
              <>
                <Popover
                  width={210}
                  trigger={({ toggle, ref }) => (
                    <button ref={ref} className="btn" onClick={toggle}>
                      <Icon name="layers" size={14} />
                      Предмет
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem
                        label="Без предмет"
                        onClick={() => {
                          void useLibrary.getState().setSubject([...selected], null);
                          close();
                        }}
                      />
                      {subjects.map((s) => (
                        <MenuItem
                          key={s.id}
                          label={s.name}
                          icon={s.icon}
                          onClick={() => {
                            void useLibrary.getState().setSubject([...selected], s.id);
                            close();
                          }}
                        />
                      ))}
                    </>
                  )}
                </Popover>
                <Popover
                  width={210}
                  trigger={({ toggle, ref }) => (
                    <button ref={ref} className="btn" onClick={toggle}>
                      <Icon name="folder" size={14} />
                      Премести
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem
                        icon="home"
                        label="Библиотека"
                        onClick={() => {
                          selectedDocs.forEach((d) => void useLibrary.getState().moveDocument(d.id, null));
                          close();
                        }}
                      />
                      {folders.map((f) => (
                        <MenuItem
                          key={f.id}
                          icon="folder"
                          label={f.name}
                          onClick={() => {
                            selectedDocs.forEach((d) => void useLibrary.getState().moveDocument(d.id, f.id));
                            close();
                          }}
                        />
                      ))}
                    </>
                  )}
                </Popover>
                <button
                  className="btn"
                  style={{ color: 'var(--c-danger)' }}
                  onClick={() => {
                    const gone = selectedDocs.map((d) => d.id);
                    gone.forEach((id) => void useLibrary.getState().deleteDocument(id));
                    notify.undo(
                      gone.length === 1 ? 'Преместено в кошчето' : `${gone.length} в кошчето`,
                      'Върни',
                      () => gone.forEach((id) => void useLibrary.getState().restoreDocument(id)),
                    );
                    setSelected(new Set());
                  }}
                >
                  <Icon name="trash" size={14} />
                  В кошчето
                </button>
              </>
            )}
            <button className="btn ml-auto" onClick={() => setSelected(new Set())}>
              Отказ
            </button>
          </div>
        )}

        {importing && (
          <div className="panel mb-4 flex items-center gap-3 px-4 py-3 text-[13px]">
            <Icon name="refresh" size={15} className="animate-spin text-accent" />
            Импортиране на {importing.current} ({importing.done + 1}/{importing.total})
          </div>
        )}

        {scope === 'trash' && trashCount > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-[12px]" style={{ background: 'var(--c-surface-2)' }}>
            <span className="text-muted">Елементите в кошчето не заемат по-малко място, докато не ги изтриеш.</span>
            <button
              className="cursor-pointer font-medium"
              style={{ color: 'var(--c-danger)' }}
              onClick={() => confirm('Да изпразня ли кошчето? Това е необратимо.', () => void useLibrary.getState().emptyTrash())}
            >
              Изпразни
            </button>
          </div>
        )}

        {/* -------------------------------------------------------- folders */}
        {childFolders.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 label">Папки</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {childFolders.map((f) => (
                <FolderCard key={f.id} id={f.id} name={f.name} confirm={confirm} />
              ))}
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------- items */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="label">
              {query ? `Резултати (${visible.length})` : SCOPES.find((s) => s.id === scope)?.label}
            </h2>
            {scope !== 'trash' && (
              <span className="text-[11px] text-faint">{formatBytes(totalBytes)} материали</span>
            )}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              scope={scope}
              searching={!!query.trim()}
              onPick={() => inputRef.current?.click()}
              onBoard={onNewBoard}
            />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((d) => (
                <DocCard
                  key={d.id}
                  doc={d}
                  trashed={scope === 'trash'}
                  selected={selected.has(d.id)}
                  onSelect={(additive) => toggleSelect(d.id, additive)}
                  confirm={confirm}
                />
              ))}
            </div>
          ) : (
            <div className="panel overflow-hidden">
              {visible.map((d, i) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  first={i === 0}
                  trashed={scope === 'trash'}
                  selected={selected.has(d.id)}
                  onSelect={(additive) => toggleSelect(d.id, additive)}
                  confirm={confirm}
                />
              ))}
            </div>
          )}
        </section>
      </div>

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

const SORT_LABELS = {
  recent: 'Последно отваряни',
  name: 'По име',
  progress: 'По прогрес',
  size: 'По размер',
} as const;

/* ------------------------------------------------------------------ pieces */

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
      className={`panel group flex items-center gap-2 p-2.5 transition-colors ${
        over ? 'ring-2 ring-[var(--c-accent)]' : 'hover:bg-surface-2'
      }`}
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
                confirm(`Да изтрия ли «${name}»? Материалите вътре се преместват нагоре.`, () => deleteFolder(id));
              }}
            />
          </>
        )}
      </Popover>
    </div>
  );
}

interface ItemProps {
  doc: DocumentMeta;
  trashed: boolean;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  confirm: (m: string, cb: () => void) => void;
}

function DocCard({ doc, trashed, selected, onSelect, confirm }: ItemProps) {
  const subject = useWorkspace((s) => s.subject(doc.subjectId));
  const pct = Math.round(progressOf(doc) * 100);

  return (
    <div
      draggable={!trashed}
      onDragStart={(e) => e.dataTransfer.setData('text/document', doc.id)}
      className="panel panel-hover group relative overflow-hidden"
      style={selected ? { outline: '2px solid var(--c-accent)', outlineOffset: -1 } : undefined}
    >
      <button
        className="block w-full cursor-pointer text-left"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || selected) return onSelect(e.metaKey || e.ctrlKey || e.shiftKey);
          if (trashed) return;
          void useViewer.getState().openDocument(doc.id);
        }}
      >
        <span className="relative block">
          {doc.cover ? (
            <img
              src={doc.cover}
              alt=""
              className="aspect-[3/4] w-full border-b border-line bg-white object-cover transition-transform duration-300 group-hover:scale-[1.015]"
              draggable={false}
            />
          ) : (
            <span className="grid aspect-[3/4] w-full place-items-center border-b border-line bg-surface-2">
              <Icon name={doc.kind === 'board' ? 'board' : 'file'} size={22} className="text-faint" />
            </span>
          )}
          {subject && (
            <span className="absolute left-0 top-0 h-full w-1" style={{ background: subject.color }} />
          )}
          {doc.starred && !trashed && (
            <span className="absolute right-1.5 top-1.5">
              <Icon name="starFill" size={15} fill className="text-warn" />
            </span>
          )}
        </span>
        <span className="block p-2.5">
          <span className="block truncate text-[13px] font-medium leading-tight">{doc.name}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
            {subject ? (
              <SubjectDot subject={subject} />
            ) : (
              <span>{doc.board?.flow === 'scroll' ? 'свитък' : `${doc.pageCount} стр.`}</span>
            )}
          </span>
          <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-surface-3">
            <span
              className="block h-full rounded-full"
              style={{ width: `${pct}%`, background: subject?.color ?? statusColor(doc) }}
            />
          </span>
          <span className="mt-1 flex justify-between text-[10px] text-faint">
            <span>{pct}%</span>
            <span>{trashed ? formatDate(doc.deletedAt) : formatDate(doc.openedAt)}</span>
          </span>
        </span>
      </button>

      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <DocMenu doc={doc} trashed={trashed} confirm={confirm} onSelect={onSelect} />
      </div>
    </div>
  );
}

function DocRow({ doc, first, trashed, selected, onSelect, confirm }: ItemProps & { first: boolean }) {
  const subject = useWorkspace((s) => s.subject(doc.subjectId));
  const pct = Math.round(progressOf(doc) * 100);

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-2 ${
        first ? '' : 'border-t border-line'
      }`}
      style={selected ? { background: 'var(--c-accent-soft)' } : undefined}
    >
      <button
        onClick={(e) => onSelect(e.metaKey || e.ctrlKey || e.shiftKey)}
        className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded border transition-colors"
        style={{
          borderColor: selected ? 'var(--c-accent)' : 'var(--c-line-strong)',
          background: selected ? 'var(--c-accent)' : 'transparent',
          color: 'var(--c-accent-text)',
        }}
        aria-label="Избери"
      >
        {selected && <Icon name="check" size={11} strokeWidth={3} />}
      </button>

      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
        onClick={() => !trashed && void useViewer.getState().openDocument(doc.id)}
      >
        <Icon
          name={doc.kind === 'board' ? 'board' : 'file'}
          size={16}
          className="shrink-0"
          style={{ color: subject?.color ?? 'var(--c-faint)' }}
        />
        <span className="min-w-0 flex-1 truncate text-[13px]">{doc.name}</span>
        {doc.starred && <Icon name="starFill" size={13} fill className="shrink-0 text-warn" />}
      </button>

      <span className="hidden w-32 shrink-0 truncate text-[11px] text-muted sm:block">
        {subject?.name ?? '—'}
      </span>
      <span className="hidden w-24 shrink-0 items-center gap-1.5 md:flex">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: subject?.color ?? 'var(--c-accent)' }}
          />
        </span>
        <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-faint">{pct}%</span>
      </span>
      <span className="hidden w-20 shrink-0 text-right text-[11px] text-faint lg:block">
        {doc.size ? formatBytes(doc.size) : `${doc.pageCount} стр.`}
      </span>
      <span className="hidden w-28 shrink-0 text-right text-[11px] text-faint xl:block">
        {trashed ? formatDate(doc.deletedAt) : formatDate(doc.openedAt)}
      </span>
      <DocMenu doc={doc} trashed={trashed} confirm={confirm} onSelect={onSelect} />
    </div>
  );
}

function DocMenu({
  doc,
  trashed,
  confirm,
  onSelect,
}: {
  doc: DocumentMeta;
  trashed: boolean;
  confirm: (m: string, cb: () => void) => void;
  onSelect: (additive: boolean) => void;
}) {
  const subjects = useWorkspace((s) => s.subjects);
  const { renameDocument, deleteDocument, restoreDocument, purgeDocuments, toggleStar, setSubject, folders, moveDocument } =
    useLibrary();

  return (
    <Popover
      width={215}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          className="icon-btn h-7 w-7 shrink-0 backdrop-blur"
          style={{ background: 'color-mix(in srgb, var(--c-surface) 80%, transparent)' }}
          onClick={toggle}
          aria-label="Още"
        >
          <Icon name="dots" size={15} />
        </button>
      )}
    >
      {(close) =>
        trashed ? (
          <>
            <MenuItem
              icon="restore"
              label="Възстанови"
              onClick={() => {
                void restoreDocument(doc.id);
                close();
              }}
            />
            <MenuSep />
            <MenuItem
              icon="trash"
              label="Изтрий завинаги"
              danger
              onClick={() => {
                close();
                confirm(`Да изтрия ли «${doc.name}» окончателно?`, () => purgeDocuments([doc.id]));
              }}
            />
          </>
        ) : (
          <>
            <MenuItem
              icon={doc.starred ? 'starFill' : 'star'}
              label={doc.starred ? 'Махни звездата' : 'Добави звезда'}
              onClick={() => {
                void toggleStar(doc.id);
                close();
              }}
            />
            <MenuItem
              icon="check"
              label="Избери"
              onClick={() => {
                onSelect(true);
                close();
              }}
            />
            <MenuItem
              icon="pencil"
              label="Преименувай"
              onClick={() => {
                const n = prompt('Име', doc.name);
                if (n) void renameDocument(doc.id, n);
                close();
              }}
            />
            <MenuSep />
            <div className="px-2 py-1 text-[11px] text-faint">Предмет</div>
            <div className="max-h-32 overflow-auto scroll-thin">
              <MenuItem
                label="Без предмет"
                active={!doc.subjectId}
                onClick={() => {
                  void setSubject([doc.id], null);
                  close();
                }}
              />
              {subjects.map((s) => (
                <MenuItem
                  key={s.id}
                  icon={s.icon}
                  label={s.name}
                  active={doc.subjectId === s.id}
                  onClick={() => {
                    void setSubject([doc.id], s.id);
                    close();
                  }}
                />
              ))}
            </div>
            <MenuSep />
            <div className="px-2 py-1 text-[11px] text-faint">Премести в</div>
            <div className="max-h-32 overflow-auto scroll-thin">
              <MenuItem
                icon="home"
                label="Библиотека"
                active={!doc.folderId}
                onClick={() => {
                  void moveDocument(doc.id, null);
                  close();
                }}
              />
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
              label="В кошчето"
              danger
              onClick={() => {
                void deleteDocument(doc.id);
                notify.undo('Преместено в кошчето', 'Върни', () => void restoreDocument(doc.id));
                close();
              }}
            />
          </>
        )
      }
    </Popover>
  );
}

const statusColor = (d: DocumentMeta) =>
  d.status === 'completed' ? 'var(--c-success)' : d.status === 'review' ? 'var(--c-warn)' : 'var(--c-accent)';

function EmptyState({
  scope,
  searching,
  onPick,
  onBoard,
}: {
  scope: Scope;
  searching: boolean;
  onPick: () => void;
  onBoard: () => void;
}) {
  if (searching) return <p className="py-12 text-center text-[13px] text-faint">Няма намерени материали.</p>;
  if (scope === 'trash')
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <Icon name="trash" size={24} className="text-faint" />
        <p className="text-[13px] text-muted">Кошчето е празно.</p>
      </div>
    );
  if (scope === 'starred')
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <Icon name="star" size={24} className="text-faint" />
        <p className="text-[13px] text-muted">Отбележи със звезда това, което отваряш всеки ден.</p>
      </div>
    );
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong py-14">
      <Icon name="upload" size={26} className="text-faint" />
      <span className="text-[14px] font-medium">Качи PDF учебник или започни на празна дъска</span>
      <span className="max-w-md text-center text-[12px] text-muted">
        Пусни файловете направо тук — или ги избери от бутона горе.
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
