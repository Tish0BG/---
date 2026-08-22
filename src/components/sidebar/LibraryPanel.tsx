import { useMemo, useState } from 'react';
import type { DocumentMeta, Folder } from '@/types';
import { documentsInTree, progressOf, useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover, useConfirm } from '../ui';
import { useT, L } from '@/i18n';

/** Folder + document tree shown in the sidebar while reading. */
export function LibraryPanel() {
  const t = useT();
  const { folders, documents, expanded, toggleExpanded, createFolder } = useLibrary();
  const [query, setQuery] = useState('');
  const { confirm, element } = useConfirm();

  const roots = useMemo(
    () => folders.filter((f) => !f.parentId).sort((a, b) => a.name.localeCompare(b.name, 'bg')),
    [folders],
  );
  const rootDocs = useMemo(
    () => documents.filter((d) => !d.folderId).sort((a, b) => a.name.localeCompare(b.name, 'bg')),
    [documents],
  );

  const matches = query.trim().toLowerCase();
  const filtered = matches
    ? documents.filter((d) => d.name.toLowerCase().includes(matches))
    : null;

  return (
    <div className="flex h-full flex-col">
      {element}
      <div className="px-3 pt-2 pb-2">
        <div className="relative">
          <Icon name="search" size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={t(L("Търси документ…", "Search documents…"))}
            className="field pl-7"
          />
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2 text-[13px]">
        {filtered ? (
          filtered.length ? (
            filtered.map((d) => <DocRow key={d.id} doc={d} depth={0} confirm={confirm} />)
          ) : (
            <p className="px-2 py-3 text-[12px] text-faint">{t(L("Няма съвпадения.", "No matches."))}</p>
          )
        ) : (
          <>
            {roots.map((f) => (
              <FolderNode
                key={f.id}
                folder={f}
                depth={0}
                folders={folders}
                documents={documents}
                expanded={expanded}
                toggle={toggleExpanded}
                confirm={confirm}
              />
            ))}
            {rootDocs.map((d) => (
              <DocRow key={d.id} doc={d} depth={0} confirm={confirm} />
            ))}
          </>
        )}
      </div>

      <div className="border-t border-line p-2">
        <button
          className="btn w-full justify-start"
          onClick={() => void createFolder(t(L('Нова папка', 'New folder')), null)}
        >
          <Icon name="folderPlus" size={15} />
          {t(L("Нова папка", "New folder"))}
        </button>
      </div>
    </div>
  );
}

function FolderNode({
  folder,
  depth,
  folders,
  documents,
  expanded,
  toggle,
  confirm,
}: {
  folder: Folder;
  depth: number;
  folders: Folder[];
  documents: DocumentMeta[];
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
  confirm: (m: string, cb: () => void) => void;
}) {
  const t = useT();
  const { createFolder, renameFolder, deleteFolder, moveDocument } = useLibrary();
  const [dragOver, setDragOver] = useState(false);
  const open = expanded[folder.id];
  const children = folders.filter((f) => f.parentId === folder.id);
  const docs = documents.filter((d) => d.folderId === folder.id);
  const total = documentsInTree(folders, documents, folder.id).length;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${dragOver ? 'bg-accent-soft' : 'hover:bg-surface-3'}`}
        style={{ paddingLeft: depth * 12 }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const id = e.dataTransfer.getData('text/document');
          if (id) void moveDocument(id, folder.id);
        }}
      >
        <button className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-1.5" onClick={() => toggle(folder.id)}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} className="shrink-0 text-faint" />
          <Icon name="folder" size={14} className="shrink-0 text-muted" />
          <span className="truncate">{folder.name}</span>
          <span className="ml-auto shrink-0 pl-1 text-[11px] text-faint">{total || ''}</span>
        </button>
        <Popover
          width={190}
          align="end"
          trigger={({ toggle: t, ref }) => (
            <button ref={ref} className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" onClick={t}>
              <Icon name="dots" size={14} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon="folderPlus"
                label={t(L("Подпапка", "Subfolder"))}
                onClick={() => {
                  void createFolder(t(L('Нова папка', 'New folder')), folder.id);
                  close();
                }}
              />
              <MenuItem
                icon="pencil"
                label={t(L("Преименувай", "Rename"))}
                onClick={() => {
                  const name = prompt(t(L('Име на папката', 'Folder name')), folder.name);
                  if (name) void renameFolder(folder.id, name);
                  close();
                }}
              />
              <MenuSep />
              <MenuItem
                icon="trash"
                label={t(L("Изтрий папката", "Delete the folder"))}
                danger
                onClick={() => {
                  close();
                  confirm(t(L(`Да изтрия ли «${folder.name}»? Документите вътре ще се преместят нагоре.`, `Delete "${folder.name}"? The documents inside move up a level.`)), () =>
                    deleteFolder(folder.id),
                  );
                }}
              />
            </>
          )}
        </Popover>
      </div>

      {open && (
        <div>
          {children.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              depth={depth + 1}
              folders={folders}
              documents={documents}
              expanded={expanded}
              toggle={toggle}
              confirm={confirm}
            />
          ))}
          {docs.map((d) => (
            <DocRow key={d.id} doc={d} depth={depth + 1} confirm={confirm} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow({
  doc,
  depth,
  confirm,
}: {
  doc: DocumentMeta;
  depth: number;
  confirm: (m: string, cb: () => void) => void;
}) {
  const t = useT();
  const openDocument = useViewer((s) => s.openDocument);
  const activeId = useViewer((s) => s.docId);
  const { renameDocument, deleteDocument, folders, moveDocument } = useLibrary();
  const active = activeId === doc.id;
  const pct = Math.round(progressOf(doc) * 100);

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/document', doc.id)}
      className={`group flex items-center gap-1 rounded-lg pr-1 ${active ? 'bg-accent-soft' : 'hover:bg-surface-3'}`}
      style={{ paddingLeft: depth * 12 + 4 }}
    >
      <button
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-1.5"
        onClick={() => void openDocument(doc.id)}
        title={doc.name}
      >
        <Icon name="file" size={14} className={`shrink-0 ${active ? 'text-accent' : 'text-faint'}`} />
        <span className={`truncate ${active ? 'font-medium text-accent' : ''}`}>{doc.name}</span>
        {pct > 0 && <span className="ml-auto shrink-0 pl-1 text-[10px] tabular-nums text-faint">{pct}%</span>}
      </button>
      <Popover
        width={200}
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
              label={t(L("Преименувай", "Rename"))}
              onClick={() => {
                const name = prompt(t(L('Име на документа', 'Document name')), doc.name);
                if (name) void renameDocument(doc.id, name);
                close();
              }}
            />
            <MenuSep />
            <div className="px-2 py-1 text-[11px] text-faint">{t(L("Премести в", "Move to"))}</div>
            <div className="max-h-44 overflow-auto scroll-thin">
              <MenuItem
                icon="home"
                label={t(L("Библиотека (root)", "Library (root)"))}
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
              label={t(L("Изтрий", "Delete"))}
              danger
              onClick={() => {
                close();
                confirm(t(L(`Да изтрия ли «${doc.name}» заедно с всички бележки?`, `Delete "${doc.name}" and all its notes?`)), () => {
                  if (useViewer.getState().docId === doc.id) void useViewer.getState().closeDocument();
                  void deleteDocument(doc.id);
                });
              }}
            />
          </>
        )}
      </Popover>
    </div>
  );
}
