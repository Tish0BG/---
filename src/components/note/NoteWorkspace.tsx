import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentMeta } from '@/types';
import { useApp } from '@/state/appStore';
import { useNotes } from '@/state/noteStore';
import { useLibrary } from '@/state/libraryStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useSettings } from '@/state/settingsStore';
import { useTimer } from '@/state/timerStore';
import { useAppAddress } from '@/state/appAddress';
import { openDoc } from '@/services/openDoc';
import { useT, useLang, L, shortDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover, Select, Tip, useConfirm } from '../ui';
import { EmptyState, IconButton, useIsCompact } from '../kit';
import { ConnectionBar } from '../system/ConnectionBar';
import { DOCK_AREA_ID, UtilityDock } from '../utilities/UtilityLayer';
import { NoteToolbar } from './NoteToolbar';
import {
  PRINT_CSS,
  hydrateImages,
  insertDocLink,
  printNote,
  readOutline,
  serialise,
  type OutlineEntry,
} from './richText';

/**
 * ──────────────────────────────────────────── a written document, open ──
 *
 * The third workspace. A PDF and a whiteboard are surfaces you draw on; this
 * is one you write on, and almost nothing about the viewer's machinery — page
 * geometry, ink batching, zoom — has anything to say about a paragraph.
 *
 * What it does share with them is the shape of the window: a bar that says
 * what is open and whether it is saved, a tool bar that belongs to the work
 * rather than to the app, the side tools docked beside it, and the whole rest
 * of the screen given to the thing itself.
 */
export function NoteWorkspace() {
  const t = useT();
  const compact = useIsCompact();
  useAppAddress();

  const docId = useNotes((s) => s.docId);
  const meta = useNotes((s) => s.meta);
  const html = useNotes((s) => s.html);
  const loadState = useNotes((s) => s.loadState);
  const revision = useNotes((s) => s.revision);
  const panel = useNotes((s) => s.panel);
  const theme = useSettings((s) => s.theme);
  const setSetting = useSettings((s) => s.set);

  const documents = useLibrary((s) => s.documents);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<HTMLElement | null>(null);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const { confirm, element } = useConfirm();

  /* -------------------------------------------------------- the body */

  /**
   * The editor is uncontrolled on purpose.
   *
   * Writing `html` back into a contentEditable on every keystroke destroys the
   * caret, the selection and the browser's own undo stack. The body is
   * therefore seeded once per document and read out afterwards.
   */
  useEffect(() => {
    const node = editorRef.current;
    if (!node || loadState !== 'ready') return;
    node.innerHTML = html || '<p><br></p>';
    setEditor(node);
    setOutline(readOutline(node));
    let dispose: (() => void) | undefined;
    void hydrateImages(node).then((fn) => {
      dispose = fn;
    });
    return () => dispose?.();
    // Seeding is keyed to the document and to `revision` — never to `html`,
    // which changes on every keystroke and would take the caret with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, loadState, revision]);

  const onInput = useCallback(() => {
    const node = editorRef.current;
    if (!node) return;
    useNotes.getState().setHtml(serialise(node));
    setOutline(readOutline(node));
  }, []);

  /**
   * Two things inside the body are interactive rather than editable: the
   * checkboxes of a checklist, and a link to another document.
   */
  const onClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    const link = target.closest<HTMLElement>('.note-doclink');
    if (link?.dataset.doc) {
      e.preventDefault();
      void openDoc(link.dataset.doc);
      return;
    }

    const todo = target.closest<HTMLElement>('.note-todo > li');
    // Only the box toggles; clicking the words has to put the caret there.
    if (todo && e.clientX - todo.getBoundingClientRect().left < 24) {
      e.preventDefault();
      todo.dataset.done = todo.dataset.done === 'true' ? 'false' : 'true';
      onInput();
    }
  }, [onInput]);

  /** Pasting from the web should bring the words, not the source site's CSS. */
  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html');
    if (!html) return;
    e.preventDefault();
    const clean = document.createElement('div');
    clean.innerHTML = html;
    for (const node of Array.from(clean.querySelectorAll<HTMLElement>('*'))) {
      node.removeAttribute('class');
      node.removeAttribute('id');
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'LINK') node.remove();
      // Colour, weight and emphasis survive; backgrounds, widths and fonts
      // from somebody else's stylesheet do not.
      const keep = [node.style.fontWeight && 'font-weight', node.style.fontStyle && 'font-style']
        .filter(Boolean)
        .map((prop) => `${prop}:${node.style.getPropertyValue(prop as string)}`)
        .join(';');
      node.removeAttribute('style');
      if (keep) node.setAttribute('style', keep);
    }
    document.execCommand('insertHTML', false, clean.innerHTML);
  }, []);

  /**
   * Only links that still resolve are counted.
   *
   * A document deleted for good on another device leaves its id behind on
   * this side until the two meet; a badge that counts it promises a file the
   * panel then cannot show.
   */
  const linkCount = useMemo(
    () => (meta?.links ?? []).filter((id) => documents.some((d) => d.id === id && !d.deletedAt)).length,
    [meta?.links, documents],
  );

  /**
   * ⌘P belongs to the document while one is open.
   *
   * The stylesheet hides the body when printing — the app is not a thing that
   * prints — so without this the browser's own shortcut produced a blank
   * page. Here it prints the sheet, through the same frame the toolbar uses.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'p') return;
      const node = editorRef.current;
      if (!node) return;
      e.preventDefault();
      printNote(meta?.name ?? 'Plauvia', node, PRINT_CSS);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [meta?.name]);

  const jump = (id: string) => {
    editorRef.current?.querySelector<HTMLElement>(`[data-outline="${id}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  if (!docId) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ConnectionBar />

      {/* --------------------------------------------------------- header */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-surface px-2">
        <Tip label={t(L('Към библиотеката', 'Back to the library'))}>
          <button
            className="icon-btn"
            onClick={() => void useNotes.getState().close()}
            aria-label={t(S.library)}
          >
            <Icon name="arrowLeft" size={17} />
          </button>
        </Tip>

        <TitleField meta={meta} />
        <SaveBadge />

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <WordCount />

          <Tip label={t(L('Съдържание', 'Outline'))}>
            <button
              className={`icon-btn ${panel === 'outline' ? 'btn-ghost-active' : ''}`}
              onClick={() => useNotes.getState().setPanel(panel === 'outline' ? null : 'outline')}
              aria-label={t(L('Съдържание', 'Outline'))}
            >
              <Icon name="list" size={17} />
            </button>
          </Tip>
          <Tip label={t(L('Свързани файлове', 'Linked files'))}>
            <button
              className={`icon-btn relative ${panel === 'links' ? 'btn-ghost-active' : ''}`}
              onClick={() => useNotes.getState().setPanel(panel === 'links' ? null : 'links')}
              aria-label={t(L('Свързани файлове', 'Linked files'))}
            >
              <Icon name="link" size={17} />
              {linkCount > 0 && (
                <span
                  className="t-num absolute -right-0.5 -top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full px-1 text-[9.5px] font-semibold text-white"
                  style={{ background: 'var(--c-accent)' }}
                >
                  {linkCount}
                </span>
              )}
            </button>
          </Tip>

          <Tip label={t(L('Фокус таймер', 'Focus timer'))}>
            <button className="icon-btn" onClick={() => useTimer.getState().toggleWidget()}>
              <Icon name="timer" size={17} />
            </button>
          </Tip>

          <Popover
            width={220}
            align="end"
            trigger={({ toggle, ref }) => (
              <button ref={ref} onClick={toggle} className="icon-btn" aria-label={t(L('Още', 'More'))}>
                <Icon name="dots" size={17} />
              </button>
            )}
          >
            {(close) => (
              <>
                <SubjectPicker meta={meta} />
                <MenuSep />
                <MenuItem
                  icon={theme === 'dark' ? 'sun' : 'moon'}
                  label={t(theme === 'dark' ? L('Светла тема', 'Light theme') : L('Тъмна тема', 'Dark theme'))}
                  onClick={() => {
                    setSetting('theme', theme === 'dark' ? 'light' : 'dark');
                    close();
                  }}
                />
                <MenuItem
                  icon="sliders"
                  label={t(S.settings)}
                  onClick={() => {
                    useApp.getState().setSettings(true);
                    close();
                  }}
                />
                <MenuSep />
                <MenuItem
                  icon="trash"
                  danger
                  label={t(L('Премести в кошчето', 'Move to the bin'))}
                  onClick={() => {
                    close();
                    confirm(
                      t(L('Документът отива в кошчето. Може да го върнеш оттам.', 'The document goes to the bin. You can bring it back.')),
                      () => {
                        void useLibrary.getState().deleteDocument(docId);
                        void useNotes.getState().close();
                      },
                    );
                  }}
                />
              </>
            )}
          </Popover>
        </div>
      </header>

      <NoteToolbar editor={editor} />

      {/* ----------------------------------------------------- the sheet */}
      <div id={DOCK_AREA_ID} className="flex min-h-0 flex-1 flex-col">
        <UtilityDock side="top" />
        <div className="flex min-h-0 flex-1">
          <UtilityDock side="left" />

          <main className="scroll-thin min-w-0 flex-1 overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
            {loadState === 'error' ? (
              <div className="grid h-full place-items-center px-6">
                <EmptyState
                  icon="alert"
                  tone="var(--c-danger)"
                  title={t(L('Документът не е намерен', 'This document is gone'))}
                  body={t(L('Може да е бил изтрит на друго устройство.', 'It may have been deleted on another device.'))}
                  action={{
                    label: t(S.library),
                    icon: 'arrowLeft',
                    onClick: () => void useNotes.getState().close(),
                  }}
                />
              </div>
            ) : (
              /* The sheet is a sheet.
                 The body used to sit straight on the window's background, and
                 a page of text with nothing under it reads as a text field —
                 something you fill in — rather than as a document you are
                 writing. A surface, a hairline and real margins are the whole
                 difference, and they cost one element. */
              <div className="mx-auto w-full max-w-[880px] px-3 py-5 sm:px-6 sm:py-8">
                <div className="rounded-[16px] border border-line bg-surface px-5 py-8 shadow-[var(--shadow-sm)] sm:px-14 sm:py-14">
                <div
                  ref={editorRef}
                  className="note-sheet"
                  data-placeholder={t(
                    L('Пиши тук. Форматирането е в лентата отгоре.', 'Write here. The formatting is in the bar above.'),
                  )}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck
                  role="textbox"
                  aria-multiline="true"
                  aria-label={meta?.name ?? t(L('Документ', 'Document'))}
                  onInput={onInput}
                  onBlur={onInput}
                  onClick={onClick}
                  onPaste={onPaste}
                  onKeyDown={(e) => e.stopPropagation()}
                />
                </div>
              </div>
            )}
          </main>

          {panel && !compact && (
            <aside className="w-[280px] shrink-0 overflow-hidden border-l border-line bg-surface">
              {panel === 'outline' ? (
                <OutlinePanel entries={outline} onJump={jump} />
              ) : (
                <LinksPanel meta={meta} editor={editor} />
              )}
            </aside>
          )}

          <UtilityDock side="right" />
        </div>
        <UtilityDock side="bottom" />
      </div>

      {/* On a narrow screen the panel is a sheet over the text, not beside it. */}
      {panel && compact && (
        <div className="absolute inset-0 z-40 flex">
          <div
            className="flex-1"
            style={{ background: 'rgb(8 10 14 / 40%)' }}
            onPointerDown={() => useNotes.getState().setPanel(null)}
          />
          <aside className="w-[300px] max-w-[86vw] overflow-hidden border-l border-line bg-surface shadow-[var(--shadow-float)]">
            {panel === 'outline' ? (
              <OutlinePanel entries={outline} onJump={jump} />
            ) : (
              <LinksPanel meta={meta} editor={editor} />
            )}
          </aside>
        </div>
      )}

      {element}
    </div>
  );
}

/* --------------------------------------------------------------- header */

function TitleField({ meta }: { meta: DocumentMeta | null }) {
  const t = useT();
  const [draft, setDraft] = useState(meta?.name ?? '');
  const [editing, setEditing] = useState(false);

  useEffect(() => setDraft(meta?.name ?? ''), [meta?.name]);

  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== meta?.name) void useNotes.getState().rename(name);
    else setDraft(meta?.name ?? '');
  };

  return editing ? (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(meta?.name ?? '');
          setEditing(false);
        }
      }}
      className="field h-8 max-w-[38vw] text-[13px] font-medium"
      aria-label={t(L('Име на документа', 'Document name'))}
    />
  ) : (
    <button
      className="ml-1 min-w-0 max-w-[38vw] cursor-text truncate rounded px-1.5 py-1 text-[13.5px] font-medium transition-colors hover:bg-surface-3"
      title={t(L('Кликни, за да преименуваш', 'Click to rename'))}
      onClick={() => setEditing(true)}
    >
      {meta?.name ?? '—'}
    </button>
  );
}

function SaveBadge() {
  const t = useT();
  const status = useNotes((s) => s.saveStatus);
  const map: Record<string, { text: string; color: string; icon: string }> = {
    saved: { text: t(L('Записано', 'Saved')), color: 'var(--c-muted)', icon: 'check' },
    saving: { text: t(L('Записване…', 'Saving…')), color: 'var(--c-accent)', icon: 'refresh' },
    unsaved: { text: t(L('Незаписано', 'Unsaved')), color: 'var(--c-warn)', icon: 'clock' },
    error: { text: t(L('Грешка при запис', 'Save failed')), color: 'var(--c-danger)', icon: 'alert' },
  };
  const s = map[status] ?? map.saved;
  return (
    <span className="ml-1.5 hidden items-center gap-1 text-[11px] sm:flex" style={{ color: s.color }} title={s.text}>
      <Icon name={s.icon} size={12} className={status === 'saving' ? 'animate-spin' : ''} />
      <span className="hidden md:inline">{s.text}</span>
    </span>
  );
}

function WordCount() {
  const t = useT();
  const html = useNotes((s) => s.html);
  const words = useMemo(() => {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    return text ? text.split(/\s+/).length : 0;
  }, [html]);
  return (
    <span className="t-num mr-1 hidden text-[11.5px] text-muted lg:inline">
      {t(L(`${words} думи`, `${words} words`))}
    </span>
  );
}

function SubjectPicker({ meta }: { meta: DocumentMeta | null }) {
  const t = useT();
  const subjects = useWorkspace((s) => s.subjects.filter((x) => !x.archived));
  if (!meta) return null;
  return (
    <div className="px-2 pb-1.5 pt-1">
      <p className="t-label mb-1.5">{t(S.subject)}</p>
      <Select
        value={meta.subjectId ?? ''}
        width={196}
        options={[
          { value: '', label: t(S.noSubject) },
          ...subjects.map((s) => ({ value: s.id, label: s.name, color: s.color })),
        ]}
        onChange={(v) => void useLibrary.getState().setSubject([meta.id], v || null)}
      />
    </div>
  );
}

/* --------------------------------------------------------------- panels */

function OutlinePanel({ entries, onJump }: { entries: OutlineEntry[]; onJump: (id: string) => void }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={t(L('Съдържание', 'Outline'))} icon="list" />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] leading-relaxed text-faint">
            {t(
              L(
                'Направи някой ред заглавие и той се появява тук.',
                'Turn a line into a heading and it shows up here.',
              ),
            )}
          </p>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onJump(entry.id)}
              className="block w-full cursor-pointer truncate rounded-lg py-1.5 pr-2 text-left text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              style={{ paddingLeft: 8 + (entry.level - 1) * 12, fontWeight: entry.level === 1 ? 600 : 400 }}
            >
              {entry.text}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * What this document is tied to.
 *
 * The point of the whole feature: a set of worked solutions on a board, the
 * textbook they came from, and the notes written against both, reachable from
 * each other rather than found again in a list of forty files. A link made
 * here appears on the other document too.
 */
function LinksPanel({ meta, editor }: { meta: DocumentMeta | null; editor: HTMLElement | null }) {
  const t = useT();
  const lang = useLang();
  const documents = useLibrary((s) => s.documents);
  const [query, setQuery] = useState('');

  const linked = useMemo(
    () =>
      (meta?.links ?? [])
        .map((id) => documents.find((d) => d.id === id && !d.deletedAt))
        .filter(Boolean) as DocumentMeta[],
    [meta?.links, documents],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter((d) => !d.deletedAt && d.id !== meta?.id && !(meta?.links ?? []).includes(d.id))
      .filter((d) => (q ? d.name.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.openedAt ?? b.updatedAt) - (a.openedAt ?? a.updatedAt))
      .slice(0, 12);
  }, [documents, meta?.id, meta?.links, query]);

  const iconOf = (d: DocumentMeta) => (d.kind === 'board' ? 'board' : d.kind === 'note' ? 'notebook' : 'book');

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={t(L('Свързани файлове', 'Linked files'))} icon="link" />

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {linked.length > 0 && (
          <div className="mb-3">
            <p className="t-label mb-1.5 px-1">{t(L('Свързани', 'Linked'))}</p>
            {linked.map((doc) => (
              <div
                key={doc.id}
                className="group flex items-center gap-2 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-surface-2"
              >
                <button
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  onClick={() => void openDoc(doc.id)}
                >
                  <Icon name={iconOf(doc)} size={14} className="shrink-0 text-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{doc.name}</span>
                    <span className="block truncate text-[11px] text-muted">{shortDate(doc.updatedAt, lang)}</span>
                  </span>
                </button>
                <Tip label={t(L('Вмъкни в текста', 'Insert into the text'))}>
                  <button
                    className="icon-btn h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => {
                      editor?.focus();
                      insertDocLink(doc.id, doc.name, iconOf(doc) as 'book' | 'board' | 'notebook');
                      // The body changed under the caret; tell the store.
                      if (editor) useNotes.getState().setHtml(serialise(editor));
                    }}
                    aria-label={t(L('Вмъкни', 'Insert'))}
                  >
                    <Icon name="plus" size={13} />
                  </button>
                </Tip>
                <Tip label={t(L('Премахни връзката', 'Remove the link'))}>
                  <button
                    className="icon-btn h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => void useNotes.getState().unlink(doc.id)}
                    aria-label={t(L('Премахни', 'Remove'))}
                  >
                    <Icon name="x" size={13} />
                  </button>
                </Tip>
              </div>
            ))}
          </div>
        )}

        <p className="t-label mb-1.5 px-1">{t(L('Свържи с…', 'Link to…'))}</p>
        <div className="mb-2 flex h-8 items-center gap-1.5 rounded-[8px] border border-line px-2">
          <Icon name="search" size={13} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={t(L('Търси в библиотеката', 'Search the library'))}
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-faint"
          />
        </div>

        {candidates.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] leading-relaxed text-faint">
            {t(L('Няма какво още да се свърже.', 'Nothing left to link to.'))}
          </p>
        ) : (
          candidates.map((doc) => (
            <button
              key={doc.id}
              onClick={() => void useNotes.getState().link(doc.id)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
            >
              <Icon name={iconOf(doc)} size={14} className="shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{doc.name}</span>
              <Icon name="plus" size={13} className="shrink-0 text-accent" />
            </button>
          ))
        )}
      </div>

      <div className="border-t border-line px-3 py-2">
        <p className="text-[11px] leading-relaxed text-muted">
          {t(
            L(
              'Връзката се вижда и от другия файл. „Вмъкни“ слага и жив линк вътре в текста.',
              'The link shows on the other file too. “Insert” also drops a live link into the text.',
            ),
          )}
        </p>
      </div>
    </div>
  );
}

function PanelHeader({ title, icon }: { title: string; icon: string }) {
  const t = useT();
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
      <Icon name={icon} size={15} className="text-faint" />
      <span className="flex-1 truncate text-[12.5px] font-semibold">{title}</span>
      <IconButton
        icon="x"
        size="sm"
        label={t(S.close)}
        onClick={() => useNotes.getState().setPanel(null)}
      />
    </header>
  );
}
