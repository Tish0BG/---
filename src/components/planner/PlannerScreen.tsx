import { useMemo, useState } from 'react';
import type { PlannerItem, PlannerKind } from '@/types';
import { useWorkspace } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { useTimer } from '@/state/timerStore';
import {
  usePlanner,
  addDays,
  daysUntil,
  endOfDay,
  openItems,
  overdue,
  sortByDue,
  startOfDay,
} from '@/state/plannerStore';
import { Icon } from '../Icon';
import { MenuItem, Popover, useConfirm } from '../ui';
import { DueChip } from './DueChip';
import { Timetable } from './Timetable';

type Tab = 'today' | 'upcoming' | 'all' | 'timetable';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Днес', icon: 'bolt' },
  { id: 'upcoming', label: 'Предстоящи', icon: 'calendar' },
  { id: 'all', label: 'Всичко', icon: 'listTodo' },
  { id: 'timetable', label: 'Разписание', icon: 'table' },
];

export const KIND_LABEL: Record<PlannerKind, string> = {
  task: 'Задача',
  homework: 'Домашно',
  exam: 'Изпит',
};

const KIND_ICON: Record<PlannerKind, string> = {
  task: 'listTodo',
  homework: 'pencil',
  exam: 'trophy',
};

/**
 * Everything with a deadline: homework, revision tasks and exams, plus the
 * weekly timetable. One list, three lenses on it.
 */
export function PlannerScreen() {
  const items = usePlanner((s) => s.items);
  const subjects = useWorkspace((s) => s.subjects);
  const [tab, setTab] = useState<Tab>('today');
  const [filter, setFilter] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const { confirm, element } = useConfirm();

  const scoped = useMemo(
    () => (filter ? items.filter((i) => i.subjectId === filter) : items),
    [items, filter],
  );

  const late = useMemo(() => sortByDue(overdue(scoped)), [scoped]);
  const today = useMemo(
    () =>
      sortByDue(
        openItems(scoped).filter((i) => i.due !== null && i.due >= startOfDay() && i.due <= endOfDay()),
      ),
    [scoped],
  );
  const soon = useMemo(
    () =>
      sortByDue(
        openItems(scoped).filter((i) => i.due !== null && i.due > endOfDay()),
      ),
    [scoped],
  );
  const someday = useMemo(() => sortByDue(openItems(scoped).filter((i) => i.due === null)), [scoped]);
  const done = useMemo(
    () => scoped.filter((i) => i.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [scoped],
  );

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      {element}
      <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Планер</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              {late.length > 0
                ? `${late.length} закъснели · ${today.length} за днес`
                : today.length > 0
                  ? `${today.length} за днес`
                  : 'Чист график'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {subjects.length > 0 && (
              <Popover
                width={210}
                align="end"
                trigger={({ toggle, ref }) => (
                  <button ref={ref} className="btn h-9" onClick={toggle}>
                    <Icon name="filter" size={14} />
                    {filter ? subjects.find((s) => s.id === filter)?.name : 'Всички предмети'}
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <MenuItem
                      label="Всички предмети"
                      active={!filter}
                      onClick={() => {
                        setFilter(null);
                        close();
                      }}
                    />
                    {subjects.map((s) => (
                      <MenuItem
                        key={s.id}
                        icon={s.icon}
                        label={s.name}
                        active={filter === s.id}
                        onClick={() => {
                          setFilter(s.id);
                          close();
                        }}
                      />
                    ))}
                  </>
                )}
              </Popover>
            )}
          </div>
        </div>

        <nav className="mb-4 flex gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--c-surface-3)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-[12.5px] transition-colors ${
                tab === t.id ? 'bg-surface font-medium shadow-[var(--shadow-panel)]' : 'text-muted'
              }`}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'timetable' ? (
          <Timetable />
        ) : (
          <>
            <QuickAdd defaultSubject={filter} />

            {tab === 'today' && (
              <>
                <Group title="Закъснели" items={late} tone="danger" confirm={confirm} />
                <Group title="Днес" items={today} confirm={confirm} />
                {late.length + today.length === 0 && (
                  <Empty text="Нищо за днес. Свободен си — или е време да планираш напред." />
                )}
              </>
            )}

            {tab === 'upcoming' && (
              <>
                <Group title="Следващите дни" items={soon} confirm={confirm} />
                {soon.length === 0 && <Empty text="Няма нищо насрочено напред." />}
              </>
            )}

            {tab === 'all' && (
              <>
                <Group title="Закъснели" items={late} tone="danger" confirm={confirm} />
                <Group title="Днес" items={today} confirm={confirm} />
                <Group title="Предстоящи" items={soon} confirm={confirm} />
                <Group title="Без срок" items={someday} confirm={confirm} />
                {done.length > 0 && (
                  <div className="mt-4">
                    <button
                      className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted hover:text-ink"
                      onClick={() => setShowDone((v) => !v)}
                    >
                      <Icon name={showDone ? 'chevronDown' : 'chevronRight'} size={13} />
                      Завършени ({done.length})
                    </button>
                    {showDone && (
                      <>
                        <div className="mt-1.5">
                          {done.slice(0, 30).map((i) => (
                            <Row key={i.id} item={i} confirm={confirm} />
                          ))}
                        </div>
                        <button
                          className="btn mt-2"
                          onClick={() =>
                            confirm('Да изчистя ли завършените задачи?', () =>
                              void usePlanner.getState().clearCompleted(),
                            )
                          }
                        >
                          Изчисти завършените
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- quick add */

function QuickAdd({ defaultSubject }: { defaultSubject: string | null }) {
  const subjects = useWorkspace((s) => s.subjects);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<PlannerKind>('task');
  const [subjectId, setSubjectId] = useState<string | null>(defaultSubject);
  const [due, setDue] = useState<number | null>(null);

  const subject = subjects.find((s) => s.id === subjectId) ?? null;

  const add = () => {
    if (!title.trim()) return;
    void usePlanner.getState().addItem({
      title: title.trim(),
      kind,
      subjectId: subjectId ?? defaultSubject,
      due,
      docId: useViewer.getState().docId,
    });
    setTitle('');
    setDue(null);
  };

  return (
    <div className="panel mb-4 p-2.5">
      <div className="flex items-center gap-2">
        <Icon name="plus" size={16} className="shrink-0 text-faint" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Какво трябва да свършиш?"
          className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
        />
        <button className="btn btn-primary h-8" onClick={add} disabled={!title.trim()}>
          Добави
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
        <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--c-surface-3)' }}>
          {(['task', 'homework', 'exam'] as PlannerKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`cursor-pointer rounded-md px-2 py-1 text-[11.5px] transition-colors ${
                kind === k ? 'bg-surface font-medium' : 'text-muted'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <Popover
          width={200}
          trigger={({ toggle, ref }) => (
            <button ref={ref} className="btn h-7 text-[11.5px]" onClick={toggle}>
              {subject ? (
                <>
                  <span className="h-2 w-2 rounded-full" style={{ background: subject.color }} />
                  {subject.name}
                </>
              ) : (
                <>
                  <Icon name="layers" size={13} />
                  Предмет
                </>
              )}
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                label="Без предмет"
                onClick={() => {
                  setSubjectId(null);
                  close();
                }}
              />
              {subjects.map((s) => (
                <MenuItem
                  key={s.id}
                  icon={s.icon}
                  label={s.name}
                  onClick={() => {
                    setSubjectId(s.id);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </Popover>

        <Popover
          width={190}
          trigger={({ toggle, ref }) => (
            <button ref={ref} className="btn h-7 text-[11.5px]" onClick={toggle}>
              <Icon name="calendar" size={13} />
              {due === null ? 'Срок' : new Date(due).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })}
            </button>
          )}
        >
          {(close) => (
            <>
              {[
                { label: 'Днес', days: 0 },
                { label: 'Утре', days: 1 },
                { label: 'След 3 дни', days: 3 },
                { label: 'Следващата седмица', days: 7 },
              ].map((o) => (
                <MenuItem
                  key={o.days}
                  label={o.label}
                  onClick={() => {
                    setDue(startOfDay(addDays(o.days)) + 20 * 3600_000);
                    close();
                  }}
                />
              ))}
              <div className="px-1.5 py-1">
                <input
                  type="date"
                  className="field"
                  onChange={(e) => {
                    if (e.target.value) setDue(new Date(`${e.target.value}T20:00`).getTime());
                    close();
                  }}
                />
              </div>
              <MenuItem
                label="Без срок"
                onClick={() => {
                  setDue(null);
                  close();
                }}
              />
            </>
          )}
        </Popover>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- lists */

function Group({
  title,
  items,
  tone,
  confirm,
}: {
  title: string;
  items: PlannerItem[];
  tone?: 'danger';
  confirm: (m: string, cb: () => void) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <h2
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: tone === 'danger' ? 'var(--c-danger)' : 'var(--c-faint)' }}
      >
        {title} ({items.length})
      </h2>
      <div className="panel overflow-hidden">
        {items.map((i, idx) => (
          <Row key={i.id} item={i} first={idx === 0} confirm={confirm} />
        ))}
      </div>
    </section>
  );
}

function Row({
  item,
  first,
  confirm,
}: {
  item: PlannerItem;
  first?: boolean;
  confirm: (m: string, cb: () => void) => void;
}) {
  const subject = useWorkspace((s) => s.subject(item.subjectId));
  const doc = useLibrary((s) => s.documents.find((d) => d.id === item.docId));
  const activeTaskId = useTimer((s) => s.activeTaskId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  return (
    <div
      className={`group flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2 ${
        first ? '' : 'border-t border-line'
      }`}
    >
      <button
        onClick={() => void usePlanner.getState().toggleItem(item.id)}
        className="grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded-full border transition-colors"
        style={{
          borderColor: item.done ? 'var(--c-success)' : (subject?.color ?? 'var(--c-line-strong)'),
          background: item.done ? 'var(--c-success)' : 'transparent',
          color: '#fff',
        }}
        aria-label={item.done ? 'Отмени' : 'Готово'}
      >
        {item.done && <Icon name="check" size={11} strokeWidth={3} />}
      </button>

      <Icon
        name={KIND_ICON[item.kind]}
        size={14}
        className="hidden shrink-0 sm:block"
        style={{ color: subject?.color ?? 'var(--c-faint)' }}
      />

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            void usePlanner.getState().updateItem(item.id, { title: draft.trim() || item.title });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraft(item.title);
              setEditing(false);
            }
          }}
          className="field h-7 flex-1"
        />
      ) : (
        <button
          className="min-w-0 flex-1 cursor-text text-left"
          onClick={() => {
            setDraft(item.title);
            setEditing(true);
          }}
        >
          <span className={`block truncate text-[13px] ${item.done ? 'text-faint line-through' : ''}`}>
            {item.title}
          </span>
          {(subject || doc) && (
            <span className="flex items-center gap-1.5 truncate text-[11px] text-faint">
              {subject && <span style={{ color: subject.color }}>{subject.name}</span>}
              {doc && (
                <span className="truncate">
                  · {doc.name}
                </span>
              )}
            </span>
          )}
        </button>
      )}

      {item.pomodoros > 0 && (
        <span className="hidden shrink-0 text-[11px] tabular-nums text-faint sm:block">
          {item.pomodoros} ●
        </span>
      )}
      {item.due !== null && !item.done && <DueChip due={item.due} />}

      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!item.done && (
          <button
            className="icon-btn h-7 w-7"
            title="Фокусирай таймера върху това"
            onClick={() => useTimer.getState().setActiveTask(activeTaskId === item.id ? null : item.id)}
            style={activeTaskId === item.id ? { color: 'var(--c-accent)' } : undefined}
          >
            <Icon name="target" size={14} />
          </button>
        )}
        {doc && (
          <button
            className="icon-btn h-7 w-7"
            title="Отвори материала"
            onClick={() => void useViewer.getState().openDocument(doc.id)}
          >
            <Icon name="file" size={14} />
          </button>
        )}
        <button
          className="icon-btn h-7 w-7"
          onClick={() =>
            item.done
              ? void usePlanner.getState().removeItem(item.id)
              : confirm(`Да изтрия ли „${item.title}“?`, () => void usePlanner.getState().removeItem(item.id))
          }
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <Icon name="checkCircle" size={26} style={{ color: 'var(--c-success)' }} />
      <p className="max-w-sm text-[13px] text-muted">{text}</p>
    </div>
  );
}

export { daysUntil };
