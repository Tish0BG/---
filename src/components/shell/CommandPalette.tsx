import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VIEW_TITLES, useApp, type AppView } from '@/state/appStore';
import { useLibrary } from '@/state/libraryStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, openItems } from '@/state/plannerStore';
import { useViewer } from '@/state/viewerStore';
import { useTimer } from '@/state/timerStore';
import { useCards } from '@/state/cardStore';
import { Icon } from '../Icon';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  color?: string;
  run: () => void;
}

/**
 * One box that reaches everything: materials, subjects, open work and the
 * handful of actions worth a keystroke. It is the fastest path in the app
 * once there is more than a screenful of stuff.
 */
export function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const documents = useLibrary((s) => s.documents);
  const subjects = useWorkspace((s) => s.subjects);
  const items = usePlanner((s) => s.items);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
    // Focus twice: once now for keyboard users, once after paint in case the
    // portal has not been attached yet.
    inputRef.current?.focus();
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const app = useApp.getState();
    const out: Command[] = [];

    for (const doc of documents.filter((d) => !d.deletedAt)) {
      const subject = subjects.find((s) => s.id === doc.subjectId);
      out.push({
        id: `doc-${doc.id}`,
        label: doc.name,
        hint: subject?.name ?? (doc.kind === 'board' ? 'дъска' : 'материал'),
        icon: doc.kind === 'board' ? 'board' : 'file',
        color: subject?.color,
        run: () => void useViewer.getState().openDocument(doc.id),
      });
    }

    for (const s of subjects) {
      out.push({
        id: `sub-${s.id}`,
        label: s.name,
        hint: 'предмет',
        icon: s.icon,
        color: s.color,
        run: () => app.openSubject(s.id),
      });
    }

    for (const t of openItems(items).slice(0, 40)) {
      const subject = subjects.find((s) => s.id === t.subjectId);
      out.push({
        id: `task-${t.id}`,
        label: t.title,
        hint: subject ? `задача · ${subject.name}` : 'задача',
        icon: t.kind === 'exam' ? 'trophy' : 'listTodo',
        color: subject?.color,
        run: () => {
          useTimer.getState().setActiveTask(t.id);
          app.go('planner');
        },
      });
    }

    for (const view of Object.keys(VIEW_TITLES) as AppView[]) {
      out.push({
        id: `go-${view}`,
        label: VIEW_TITLES[view],
        hint: 'екран',
        icon: 'chevronRight',
        run: () => app.go(view),
      });
    }

    out.push(
      {
        id: 'act-timer',
        label: 'Пусни / спри таймера',
        hint: 'действие · ⌥Space',
        icon: 'timer',
        run: () => useTimer.getState().toggleRun(),
      },
      {
        id: 'act-review',
        label: 'Учи флашкарти',
        hint: 'действие',
        icon: 'brain',
        run: () => {
          useCards.getState().startReview(null);
          app.go('cards');
        },
      },
      {
        id: 'act-settings',
        label: 'Настройки',
        hint: 'действие',
        icon: 'sliders',
        run: () => app.setSettings(true),
      },
    );
    return out;
  }, [documents, subjects, items]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 8);
    return commands.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 12);
  }, [commands, query]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const choose = (cmd: Command | undefined) => {
    if (!cmd) return;
    useApp.getState().setPalette(false);
    cmd.run();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]"
      style={{ background: 'rgb(8 10 14 / 45%)', backdropFilter: 'blur(2px)' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) useApp.getState().setPalette(false);
      }}
    >
      <div className="panel animate-in w-full max-w-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-float)' }}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon name="search" size={16} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(results[index]);
              } else if (e.key === 'Escape') {
                useApp.getState().setPalette(false);
              }
            }}
            placeholder="Търси материал, предмет, задача или действие…"
            className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
          <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-faint sm:block">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="scroll-thin max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-2 py-6 text-center text-[13px] text-faint">Нищо не съвпада</p>
          )}
          {results.map((cmd, i) => (
            <button
              key={cmd.id}
              data-active={i === index}
              onPointerEnter={() => setIndex(i)}
              onClick={() => choose(cmd)}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                i === index ? 'bg-surface-3' : ''
              }`}
            >
              <Icon
                name={cmd.icon}
                size={15}
                className="shrink-0"
                style={{ color: cmd.color ?? 'var(--c-faint)' }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px]">{cmd.label}</span>
              {cmd.hint && <span className="shrink-0 text-[11px] text-faint">{cmd.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
