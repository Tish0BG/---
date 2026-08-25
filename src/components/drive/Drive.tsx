import { useMemo, useRef, useState } from 'react';
import type { DocumentMeta } from '@/types';
import { folderPath, progressOf, useLibrary } from '@/state/libraryStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useSettings } from '@/state/settingsStore';
import { formatBytes } from '@/lib/util';
import { notify } from '@/state/toastStore';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover, useConfirm } from '../ui';
import { SubjectDot } from '../subjects/SubjectDot';
import { useT, useLang, L, type Msg, shortDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Button, Card, EmptyState as KitEmpty } from '../kit';
import { openDoc } from '@/services/openDoc';
import { newNote } from '../shell/AppHeader';

type Scope = 'all' | 'pdf' | 'board' | 'note' | 'starred' | 'trash';

const SCOPES: { id: Scope; label: Msg; icon: string }[] = [
  { id: 'all', label: L('Всички', 'All'), icon: 'drive' },
  { id: 'pdf', label: L('Материали', 'Materials'), icon: 'file' },
  { id: 'note', label: L('Документи', 'Documents'), icon: 'notebook' },
  { id: 'board', label: L('Дъски', 'Boards'), icon: 'board' },
  { id: 'starred', label: L('Със звезда', 'Starred'), icon: 'star' },
  { id: 'trash', label: L('Кошче', 'Bin'), icon: 'trash' },
];

/** The face each kind of thing in the library wears, everywhere. */
export const KIND_ICON: Record<DocumentMeta['kind'], string> = {
  pdf: 'book',
  board: 'board',
  note: 'notebook',
};

/**
 * The workspace: folders, materials and boards with the affordances people
 * expect from a drive — grid or table, sorting, multi-select with bulk
 * actions, stars and a bin you can get things back out of.
 */
export function Drive({ onNewBoard }: { onNewBoard: () => void }) {
  const t = useT();
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
    if (scope === 'note') list = list.filter((d) => d.kind === 'note');
    if (scope === 'starred') list = list.filter((d) => d.starred);
    // Searching looks through the whole library, and inside written
    // documents as well as at their names — a note you remember a phrase
    // from is a note you should be able to find by that phrase.
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || !!d.note?.text.toLowerCase().includes(q));
    else if (scope === 'all' || scope === 'pdf' || scope === 'board' || scope === 'note') {
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

      <div className="mx-auto max-w-[1220px] px-4 py-5 sm:px-7 sm:py-7">
        {/* ------------------------------------------------------- header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[12px] text-muted">
              <button className="cursor-pointer hover:text-ink" onClick={() => setActiveFolder(null)}>
                {t(S.library)}
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
            <h1 className="t-h1 mt-1">{path.at(-1)?.name ?? t(S.library)}</h1>
            <p className="mt-1.5 text-[13px] text-muted">
              {t(
                L(
                  `${documents.filter((d) => !d.deletedAt).length} материала · ${formatBytes(totalBytes)}`,
                  `${documents.filter((d) => !d.deletedAt).length} items · ${formatBytes(totalBytes)}`,
                ),
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              icon="folderPlus"
              onClick={() => void createFolder(t(L('Нова папка', 'New folder')), activeFolderId)}
            >
              <span className="hidden lg:inline">{t(L('Папка', 'Folder'))}</span>
            </Button>
            <Button variant="outline" icon="board" onClick={onNewBoard}>
              <span className="hidden lg:inline">{t(L('Дъска', 'Board'))}</span>
            </Button>
            <Button
              variant="outline"
              icon="notebook"
              onClick={() => void newNote(activeFolderId)}
            >
              <span className="hidden lg:inline">{t(L('Документ', 'Document'))}</span>
            </Button>
            <Button variant="primary" icon="upload" onClick={() => inputRef.current?.click()}>
              <span className="hidden sm:inline">{t(L('Качи PDF', 'Upload PDF'))}</span>
            </Button>
          </div>
        </div>

        {/* -------------------------------------------------------- toolbar */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="segmented">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setScope(s.id);
                  setSelected(new Set());
                }}
                aria-pressed={scope === s.id}
                className="flex items-center justify-center gap-1.5"
              >
                <Icon name={s.icon} size={13} />
                <span className="hidden sm:inline">{t(s.label)}</span>
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
              placeholder={t(L('Търси в библиотеката…', 'Search the library…'))}
              className="field pl-8"
            />
          </div>

          <Popover
            width={190}
            align="end"
            trigger={({ toggle, ref }) => (
              <button ref={ref} className="btn btn-outline" onClick={toggle}>
                <Icon name="filter" size={14} />
                <span className="hidden lg:inline">{t(SORT_LABELS[sort])}</span>
              </button>
            )}
          >
            {(close) =>
              (Object.keys(SORT_LABELS) as (keyof typeof SORT_LABELS)[]).map((id) => (
                <MenuItem
                  key={id}
                  label={t(SORT_LABELS[id])}
                  active={sort === id}
                  onClick={() => {
                    setSetting('driveSort', id);
                    close();
                  }}
                />
              ))
            }
          </Popover>

          <div className="segmented">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSetting('driveView', v)}
                aria-pressed={view === v}
                className="!flex-none px-2.5"
                aria-label={v === 'grid' ? t(L('Решетка', 'Grid')) : t(L('Списък', 'List'))}
              >
                <Icon name={v === 'grid' ? 'grid' : 'table'} size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------- selection bar */}
        {selectedDocs.length > 0 && (
          <div className="panel mb-3 flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="text-[12.5px] text-muted">
              {t(L(`${selectedDocs.length} избрани`, `${selectedDocs.length} selected`))}
            </span>
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
                  {t(L('Възстанови', 'Restore'))}
                </button>
                <button
                  className="btn"
                  style={{ color: 'var(--c-danger)' }}
                  onClick={() =>
                    confirm(t(L(`Да изтрия ли окончателно ${selectedDocs.length} елемента?`, `Permanently delete ${selectedDocs.length} items?`)), () => {
                      void useLibrary.getState().purgeDocuments(selectedDocs.map((d) => d.id));
                      setSelected(new Set());
                    })
                  }
                >
                  <Icon name="trash" size={14} />
                  {t(L('Изтрий завинаги', 'Delete for good'))}
                </button>
              </>
            ) : (
              <>
                <Popover
                  width={210}
                  trigger={({ toggle, ref }) => (
                    <button ref={ref} className="btn" onClick={toggle}>
                      <Icon name="layers" size={14} />
                      {t(S.subject)}
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem
                        label={t(S.noSubject)}
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
                      {t(L('Премести', 'Move'))}
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem
                        icon="home"
                        label={t(S.library)}
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
                      t(gone.length === 1 ? L('Преместено в кошчето', 'Moved to the bin') : L(`${gone.length} в кошчето`, `${gone.length} moved to the bin`)),
                      t(L('Върни', 'Undo')),
                      () => gone.forEach((id) => void useLibrary.getState().restoreDocument(id)),
                    );
                    setSelected(new Set());
                  }}
                >
                  <Icon name="trash" size={14} />
                  {t(L('В кошчето', 'To the bin'))}
                </button>
              </>
            )}
            <button className="btn ml-auto" onClick={() => setSelected(new Set())}>
              {t(S.cancel)}
            </button>
          </div>
        )}

        {importing && (
          <div className="panel mb-4 flex items-center gap-3 px-4 py-3 text-[13px]">
            <Icon name="refresh" size={15} className="animate-spin text-accent" />
            {t(L('Внасям', 'Importing'))} {importing.current} ({importing.done + 1}/{importing.total})
          </div>
        )}

        {scope === 'trash' && trashCount > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-[12px]" style={{ background: 'var(--c-surface-2)' }}>
            <span className="text-muted">
              {t(L('Елементите в кошчето заемат място, докато не ги изтриеш.', 'Items in the bin still take up space until they are deleted.'))}
            </span>
            <button
              className="cursor-pointer font-medium"
              style={{ color: 'var(--c-danger)' }}
              onClick={() =>
                confirm(
                  t(L('Да изпразня ли кошчето? Това е необратимо.', 'Empty the bin? This cannot be undone.')),
                  () => void useLibrary.getState().emptyTrash(),
                )
              }
            >
              {t(L('Изпразни', 'Empty'))}
            </button>
          </div>
        )}

        {/* -------------------------------------------------------- folders */}
        {childFolders.length > 0 && (
          <section className="mb-6">
            <h2 className="t-label mb-2">{t(L('Папки', 'Folders'))}</h2>
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
            <h2 className="t-label">
              {query
                ? t(L(`Резултати (${visible.length})`, `Results (${visible.length})`))
                : t(SCOPES.find((s) => s.id === scope)!.label)}
            </h2>
            <span className="t-num text-[11px] text-faint">{visible.length}</span>
          </div>

          {visible.length === 0 ? (
            <DriveEmpty
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
            <Card flush>
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
            </Card>
          )}
        </section>
      </div>

      {dragging && (
        <div
          className="pointer-events-none fixed inset-0 z-40 grid place-items-center"
          style={{ background: 'color-mix(in srgb, var(--c-accent) 12%, transparent)' }}
        >
          <div className="card px-6 py-4 text-[14px] font-medium">
            {t(L('Пусни PDF файловете тук', 'Drop your PDFs here'))}
          </div>
        </div>
      )}
    </div>
  );
}

const SORT_LABELS = {
  recent: L('Последно отваряни', 'Recently opened'),
  name: L('По име', 'By name'),
  progress: L('По прогрес', 'By progress'),
  size: L('По размер', 'By size'),
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
  const t = useT();
  const { setActiveFolder, renameFolder, deleteFolder, moveDocument } = useLibrary();
  const [over, setOver] = useState(false);
  return (
    <div
      className={`card group flex items-center gap-2.5 p-3 transition-all duration-150 ${
        over ? 'ring-2 ring-[var(--c-accent)]' : 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]'
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
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]"
          style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
        >
          <Icon name="folder" size={16} />
        </span>
        <span className="truncate text-[13px] font-medium">{name}</span>
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
              label={t(S.edit)}
              onClick={() => {
                const n = prompt(t(L('Име на папката', 'Folder name')), name);
                if (n) void renameFolder(id, n);
                close();
              }}
            />
            <MenuSep />
            <MenuItem
              icon="trash"
              label={t(S.delete)}
              danger
              onClick={() => {
                close();
                confirm(
                  t(L(`Да изтрия ли «${name}»? Материалите вътре се преместват нагоре.`, `Delete "${name}"? Anything inside moves up a level.`)),
                  () => deleteFolder(id),
                );
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
  const t = useT();
  const lang = useLang();
  const subject = useWorkspace((s) => s.subject(doc.subjectId));
  const pct = Math.round(progressOf(doc) * 100);

  return (
    <div
      draggable={!trashed}
      onDragStart={(e) => e.dataTransfer.setData('text/document', doc.id)}
      className="card card-hover group relative overflow-hidden"
      style={selected ? { outline: '2px solid var(--c-accent)', outlineOffset: -1 } : undefined}
    >
      <button
        className="block w-full cursor-pointer text-left"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || selected) return onSelect(e.metaKey || e.ctrlKey || e.shiftKey);
          if (trashed) return;
          void openDoc(doc.id);
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
            <span className="relative grid aspect-[3/4] w-full place-items-center overflow-hidden border-b border-line bg-surface-2">
              {doc.kind === 'note' && doc.note?.text ? (
                /* The first words of a written document are a better cover
                   than an icon of a page: it says which document this is. */
                <span
                  className="absolute inset-0 px-3 py-2.5 text-left text-[9.5px] leading-[1.5] text-muted"
                  style={{
                    WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent)',
                    maskImage: 'linear-gradient(to bottom, #000 55%, transparent)',
                  }}
                >
                  {doc.note.text.slice(0, 220)}
                </span>
              ) : (
                <Icon name={KIND_ICON[doc.kind]} size={22} className="text-faint" />
              )}
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
              <span>
                {doc.kind === 'note'
                  ? t(L(`${doc.note?.words ?? 0} думи`, `${doc.note?.words ?? 0} words`))
                  : doc.board?.flow === 'scroll'
                    ? t(L('свитък', 'scroll'))
                    : t(L(`${doc.pageCount} стр.`, `${doc.pageCount} pages`))}
              </span>
            )}
          </span>
          {doc.kind !== 'note' && (
            <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full"
                style={{ width: `${pct}%`, background: subject?.color ?? statusColor(doc) }}
              />
            </span>
          )}
          <span className="t-num mt-1 flex justify-between text-[10px] text-faint">
            <span>{doc.kind === 'note' ? '' : `${pct}%`}</span>
            <span>
              {trashed
                ? doc.deletedAt
                  ? shortDate(doc.deletedAt, lang)
                  : ''
                : doc.openedAt
                  ? shortDate(doc.openedAt, lang)
                  : ''}
            </span>
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
  const t = useT();
  const lang = useLang();
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
        aria-label={t(L('Избери', 'Select'))}
      >
        {selected && <Icon name="check" size={11} strokeWidth={3} />}
      </button>

      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
        onClick={() => !trashed && void openDoc(doc.id)}
      >
        <Icon
          name={KIND_ICON[doc.kind]}
          size={16}
          className="shrink-0"
          style={{ color: subject?.color ?? 'var(--c-faint)' }}
        />
        <span className="min-w-0 flex-1 truncate text-[13px]">{doc.name}</span>
        {!!doc.links?.length && (
          <span className="t-num hidden shrink-0 items-center gap-1 text-[11px] text-faint sm:flex">
            <Icon name="link" size={11} />
            {doc.links.length}
          </span>
        )}
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
        {doc.size ? formatBytes(doc.size) : t(L(`${doc.pageCount} стр.`, `${doc.pageCount} pages`))}
      </span>
      <span className="t-num hidden w-28 shrink-0 text-right text-[11px] text-faint xl:block">
        {trashed
          ? doc.deletedAt
            ? shortDate(doc.deletedAt, lang)
            : ''
          : doc.openedAt
            ? shortDate(doc.openedAt, lang)
            : ''}
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
  const t = useT();
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
          aria-label={t(L('Още', 'More'))}
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
              label={t(L('Възстанови', 'Restore'))}
              onClick={() => {
                void restoreDocument(doc.id);
                close();
              }}
            />
            <MenuSep />
            <MenuItem
              icon="trash"
              label={t(L('Изтрий завинаги', 'Delete for good'))}
              danger
              onClick={() => {
                close();
                confirm(
                  t(L(`Да изтрия ли «${doc.name}» окончателно?`, `Permanently delete "${doc.name}"?`)),
                  () => purgeDocuments([doc.id]),
                );
              }}
            />
          </>
        ) : (
          <>
            <MenuItem
              icon={doc.starred ? 'starFill' : 'star'}
              label={t(doc.starred ? L('Махни звездата', 'Remove star') : L('Добави звезда', 'Add a star'))}
              onClick={() => {
                void toggleStar(doc.id);
                close();
              }}
            />
            <MenuItem
              icon="check"
              label={t(L('Избери', 'Select'))}
              onClick={() => {
                onSelect(true);
                close();
              }}
            />
            <MenuItem
              icon="pencil"
              label={t(L('Преименувай', 'Rename'))}
              onClick={() => {
                const n = prompt(t(L('Име', 'Name')), doc.name);
                if (n) void renameDocument(doc.id, n);
                close();
              }}
            />
            <MenuSep />
            <div className="px-2 py-1 text-[11px] text-faint">{t(S.subject)}</div>
            <div className="max-h-32 overflow-auto scroll-thin">
              <MenuItem
                label={t(S.noSubject)}
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
            <div className="px-2 py-1 text-[11px] text-faint">{t(L('Премести в', 'Move to'))}</div>
            <div className="max-h-32 overflow-auto scroll-thin">
              <MenuItem
                icon="home"
                label={t(S.library)}
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
              label={t(L('В кошчето', 'To the bin'))}
              danger
              onClick={() => {
                void deleteDocument(doc.id);
                notify.undo(t(L('Преместено в кошчето', 'Moved to the bin')), t(L('Върни', 'Undo')), () =>
                  void restoreDocument(doc.id),
                );
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

function DriveEmpty({
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
  const t = useT();

  if (searching)
    return (
      <KitEmpty
        icon="search"
        title={t(L('Нищо не съвпада', 'Nothing matches'))}
        body={t(L('Опитай с част от името на учебника или дъската.', 'Try part of the name of a book or a board.'))}
      />
    );

  if (scope === 'trash')
    return (
      <KitEmpty
        icon="trash"
        tone="var(--c-faint)"
        title={t(L('Кошчето е празно', 'The bin is empty'))}
        body={t(L('Изтритото стои тук, докато не решиш окончателно.', 'Deleted things wait here until you decide for good.'))}
      />
    );

  if (scope === 'starred')
    return (
      <KitEmpty
        icon="star"
        tone="var(--c-ember)"
        title={t(L('Няма нищо със звезда', 'Nothing starred yet'))}
        body={t(L('Отбележи със звезда това, което отваряш всеки ден — стои най-отгоре.', 'Star what you open every day and it stays at the top.'))}
      />
    );

  return (
    <div
      className="rounded-[12px] border border-dashed"
      style={{ borderColor: 'var(--c-line-strong)' }}
    >
      <KitEmpty
        icon="upload"
        title={t(L('Качи учебник или започни на празна дъска', 'Upload a textbook or start on blank paper'))}
        body={t(L('Пусни PDF файловете направо тук. Всичко се записва на твоето устройство.', 'Drop your PDFs right here. Everything is written to your own device.'))}
        action={{ label: t(L('Качи PDF', 'Upload PDF')), icon: 'upload', onClick: onPick }}
        secondary={{ label: t(L('Нова дъска', 'New board')), icon: 'board', onClick: onBoard }}
      />
    </div>
  );
}
