import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VIEW_TITLES, useApp, type AppView } from '@/state/appStore';
import { useLibrary } from '@/state/libraryStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, openItems, daysUntil } from '@/state/plannerStore';
import { useGoals } from '@/state/goalStore';
import { useViewer } from '@/state/viewerStore';
import { useTimer } from '@/state/timerStore';
import { useCards } from '@/state/cardStore';
import { useSettings } from '@/state/settingsStore';
import { useT, L, type Msg } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';

type Group = 'action' | 'task' | 'exam' | 'goal' | 'material' | 'subject' | 'screen';

interface Command {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  icon: string;
  color?: string;
  shortcut?: string;
  run: () => void;
}

const GROUP_TITLE: Record<Group, Msg> = {
  action: L('Действия', 'Actions'),
  task: L('Задачи', 'Tasks'),
  exam: L('Изпити', 'Exams'),
  goal: L('Цели', 'Goals'),
  material: L('Материали', 'Materials'),
  subject: L('Предмети', 'Subjects'),
  screen: L('Екрани', 'Screens'),
};

const ORDER: Group[] = ['action', 'task', 'exam', 'goal', 'material', 'subject', 'screen'];

/**
 * One box that reaches everything.
 *
 * Search and commands are the same list on purpose: when you press ⌘K you are
 * looking for a thing *or* for something to do, and being asked which of the
 * two before you have typed is the sort of question a product asks when it has
 * not decided what it is.
 */
export function CommandPalette() {
  const t = useT();
  const open = useApp((s) => s.paletteOpen);
  const documents = useLibrary((s) => s.documents);
  const subjects = useWorkspace((s) => s.subjects);
  const items = usePlanner((s) => s.items);
  const goals = useGoals((s) => s.goals);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
    inputRef.current?.focus();
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const app = useApp.getState();
    const out: Command[] = [];

    /* ---------------------------------------------------------- actions */
    out.push(
      {
        id: 'act-task',
        group: 'action',
        label: t(L('Нова задача', 'New task')),
        icon: 'listTodo',
        shortcut: 'T',
        run: () => app.setQuick('task'),
      },
      {
        id: 'act-exam',
        group: 'action',
        label: t(L('Нов изпит', 'New exam')),
        icon: 'graduation',
        shortcut: 'E',
        run: () => app.setQuick('exam'),
      },
      {
        id: 'act-goal',
        group: 'action',
        label: t(L('Нова цел', 'New goal')),
        icon: 'target',
        shortcut: 'G',
        run: () => app.setQuick('goal'),
      },
      {
        id: 'act-focus',
        group: 'action',
        label: t(L('Започни фокус сесия', 'Start a focus session')),
        icon: 'timer',
        run: () => {
          useTimer.getState().setView('full');
          useTimer.getState().start();
        },
      },
      {
        id: 'act-review',
        group: 'action',
        label: t(L('Преговори флашкарти', 'Review flashcards')),
        icon: 'brain',
        run: () => {
          useCards.getState().startReview(null);
          app.go('cards');
        },
      },
      {
        id: 'act-theme',
        group: 'action',
        label: t(L('Смени темата', 'Toggle theme')),
        icon: 'moon',
        run: () => {
          const s = useSettings.getState();
          s.set('theme', s.theme === 'dark' ? 'light' : 'dark');
        },
      },
      {
        id: 'act-settings',
        group: 'action',
        label: t(S.settings),
        icon: 'sliders',
        run: () => app.setSettings(true),
      },
    );

    /* ------------------------------------------------------------ tasks */
    for (const item of openItems(items).slice(0, 60)) {
      const subject = subjects.find((s) => s.id === item.subjectId);
      const days = item.due !== null ? daysUntil(item.due) : null;
      out.push({
        id: `task-${item.id}`,
        group: item.kind === 'exam' ? 'exam' : 'task',
        label: item.title,
        hint: [subject?.name, days === null ? null : days === 0 ? t(S.today) : t(L(`след ${days} дни`, `in ${days} days`))]
          .filter(Boolean)
          .join(' · '),
        icon: item.kind === 'exam' ? 'graduation' : 'listTodo',
        color: subject?.color,
        run: () => app.go(item.kind === 'exam' ? 'exams' : 'tasks', item.id),
      });
    }

    /* ------------------------------------------------------------ goals */
    for (const goal of goals.filter((g) => !g.archived)) {
      out.push({
        id: `goal-${goal.id}`,
        group: 'goal',
        label: goal.title,
        hint: subjects.find((s) => s.id === goal.subjectId)?.name,
        icon: 'target',
        color: goal.color ?? subjects.find((s) => s.id === goal.subjectId)?.color,
        run: () => app.go('goals', goal.id),
      });
    }

    /* -------------------------------------------------------- materials */
    for (const doc of documents.filter((d) => !d.deletedAt)) {
      const subject = subjects.find((s) => s.id === doc.subjectId);
      out.push({
        id: `doc-${doc.id}`,
        group: 'material',
        label: doc.name,
        hint: subject?.name ?? (doc.kind === 'board' ? t(L('дъска', 'board')) : t(L('материал', 'material'))),
        icon: doc.kind === 'board' ? 'board' : 'file',
        color: subject?.color,
        run: () => void useViewer.getState().openDocument(doc.id),
      });
    }

    /* --------------------------------------------------------- subjects */
    for (const s of subjects.filter((x) => !x.archived)) {
      out.push({
        id: `sub-${s.id}`,
        group: 'subject',
        label: s.name,
        hint: s.teacher || undefined,
        icon: s.icon,
        color: s.color,
        run: () => app.openSubject(s.id),
      });
    }

    /* ---------------------------------------------------------- screens */
    for (const view of Object.keys(VIEW_TITLES) as AppView[]) {
      out.push({
        id: `go-${view}`,
        group: 'screen',
        label: t(VIEW_TITLES[view]),
        icon: 'moveRight',
        run: () => app.go(view),
      });
    }

    return out;
  }, [documents, subjects, items, goals, t]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? commands.filter((c) => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q))
      : commands.filter((c) => c.group === 'action' || c.group === 'task').slice(0, 9);
    return matched.slice(0, 40);
  }, [commands, query]);

  const sections = useMemo(() => {
    const map = new Map<Group, Command[]>();
    for (const cmd of results) map.set(cmd.group, [...(map.get(cmd.group) ?? []), cmd]);
    return ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [results]);

  /** Flat order for arrow keys, matching what is on screen. */
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index, flat.length]);

  if (!open) return null;

  const choose = (cmd: Command | undefined) => {
    if (!cmd) return;
    useApp.getState().setPalette(false);
    cmd.run();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[10vh]"
      style={{ background: 'rgb(6 7 10 / 52%)', backdropFilter: 'blur(4px)' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) useApp.getState().setPalette(false);
      }}
    >
      <div
        className="animate-scale w-full max-w-xl overflow-hidden rounded-[14px]"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-line)',
          boxShadow: 'var(--shadow-float)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t(S.search)}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Icon name="search" size={17} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => (i + 1) % Math.max(1, flat.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => (i - 1 + flat.length) % Math.max(1, flat.length));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(flat[index]);
              } else if (e.key === 'Escape') {
                useApp.getState().setPalette(false);
              }
            }}
            placeholder={t(L('Търси задача, изпит, цел, материал — или действие…', 'Search tasks, exams, goals, materials — or run a command…'))}
            className="h-[54px] w-full bg-transparent text-[14.5px] outline-none placeholder:text-faint"
          />
          <kbd className="kbd hidden sm:flex">esc</kbd>
        </div>

        <div ref={listRef} className="scroll-thin max-h-[54vh] overflow-y-auto p-2">
          {flat.length === 0 && (
            <div className="px-2 py-10 text-center">
              <Icon name="search" size={22} className="mx-auto mb-2 text-faint" />
              <p className="text-[13px] text-muted">{t(L('Нищо не съвпада', 'Nothing matches'))}</p>
              <p className="mt-1 text-[12px] text-faint">
                {t(L('Опитай с друга дума или създай нещо ново.', 'Try another word, or create something new.'))}
              </p>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.group} className="mb-1.5">
              <div className="t-label px-2 pb-1 pt-1.5">{t(GROUP_TITLE[section.group])}</div>
              {section.items.map((cmd) => {
                const i = flat.indexOf(cmd);
                const active = i === index;
                return (
                  <button
                    key={cmd.id}
                    data-active={active}
                    onPointerEnter={() => setIndex(i)}
                    onClick={() => choose(cmd)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors"
                    style={active ? { background: 'var(--c-accent-soft)' } : undefined}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px]"
                      style={{
                        background: cmd.color
                          ? `color-mix(in srgb, ${cmd.color} 14%, transparent)`
                          : 'var(--c-surface-3)',
                        color: cmd.color ?? 'var(--c-muted)',
                      }}
                    >
                      <Icon name={cmd.icon} size={14.5} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{cmd.label}</span>
                    {cmd.hint && <span className="shrink-0 truncate text-[11.5px] text-faint">{cmd.hint}</span>}
                    {cmd.shortcut && <kbd className="kbd">{cmd.shortcut}</kbd>}
                    {active && <Icon name="arrowRight" size={14} className="shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-faint">
          <span className="flex items-center gap-1">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            {t(L('навигация', 'navigate'))}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">↵</kbd>
            {t(L('избор', 'select'))}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="kbd">⌘K</kbd>
            {t(L('навсякъде', 'anywhere'))}
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
