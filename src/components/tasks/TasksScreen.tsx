import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlannerItem } from '@/types';
import { useApp } from '@/state/appStore';
import { useLibrary } from '@/state/libraryStore';
import { useWorkspace } from '@/state/workspaceStore';
import {
  usePlanner,
  endOfDay,
  openItems,
  overdue,
  sortByDue,
  startOfDay,
} from '@/state/plannerStore';
import { useT, L, useLang, shortDate, formatDate } from '@/i18n';
import { S, PRIORITY } from '@/i18n/strings';
import { Screen } from '../shell/Screen';
import { Icon } from '../Icon';
import { Modal, Select, useConfirm } from '../ui';
import { Button, Card, EmptyState, Segmented, Tabs, useIsPhone, Sheet } from '../kit';
import { TaskRow } from './TaskRow';
import { isoDay } from '../shell/QuickCreate';

type Tab = 'today' | 'upcoming' | 'overdue' | 'someday' | 'done';

/**
 * Every deadline in one place, seen five ways.
 *
 * The list is the screen: adding is a single field at the top that never
 * leaves, editing happens in place, and each view is a filter over the same
 * records rather than a different kind of list.
 */
export function TasksScreen() {
  const t = useT();
  const lang = useLang();
  const phone = useIsPhone();
  const items = usePlanner((s) => s.items);
  const allSubjects = useWorkspace((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const filterSubject = useApp((s) => s.filterSubjectId);
  const setFilter = useApp((s) => s.setFilter);
  const [tab, setTab] = useState<Tab>('today');
  const [editing, setEditing] = useState<PlannerItem | null>(null);
  const { confirm, element } = useConfirm();

  const scoped = useMemo(
    () => (filterSubject ? items.filter((i) => i.subjectId === filterSubject) : items),
    [items, filterSubject],
  );

  const buckets = useMemo(() => {
    const open = openItems(scoped);
    return {
      overdue: sortByDue(overdue(scoped)),
      today: sortByDue(open.filter((i) => i.due !== null && i.due >= startOfDay() && i.due <= endOfDay())),
      upcoming: sortByDue(open.filter((i) => i.due !== null && i.due > endOfDay())),
      someday: sortByDue(open.filter((i) => i.due === null)),
      done: scoped.filter((i) => i.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    };
  }, [scoped]);

  const visible = buckets[tab];

  /** Upcoming reads better grouped by day than as one long column. */
  const grouped = useMemo(() => {
    if (tab !== 'upcoming') return null;
    const map = new Map<string, PlannerItem[]>();
    for (const item of buckets.upcoming) {
      const key = isoDay(new Date(item.due ?? 0));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [tab, buckets.upcoming]);

  const doneToday = buckets.done.filter(
    (i) => (i.completedAt ?? 0) >= startOfDay(),
  ).length;

  return (
    <Screen
      title={t(S.tasks)}
      subtitle={t(
        L(
          `${buckets.today.length + buckets.overdue.length} за днес · ${doneToday} готови днес`,
          `${buckets.today.length + buckets.overdue.length} for today · ${doneToday} done today`,
        ),
      )}
      actions={
        <>
          {buckets.done.length > 0 && (
            <Button
              icon="trash"
              onClick={() =>
                confirm(
                  t(L('Да изтрия ли всички завършени задачи?', 'Delete every completed task?')),
                  () => void usePlanner.getState().clearCompleted(),
                )
              }
            >
              {t(L('Изчисти завършените', 'Clear completed'))}
            </Button>
          )}
          <Button variant="primary" icon="plus" onClick={() => useApp.getState().setQuick('task')}>
            {t(S.task)}
          </Button>
        </>
      }
      toolbar={
        <div className="space-y-3">
          <QuickAdd subjectId={filterSubject} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { id: 'today', label: t(S.today), icon: 'bolt', count: buckets.today.length },
                { id: 'overdue', label: t(L('Просрочени', 'Overdue')), icon: 'alert', count: buckets.overdue.length },
                { id: 'upcoming', label: t(L('Предстоящи', 'Upcoming')), icon: 'calendar', count: buckets.upcoming.length },
                { id: 'someday', label: t(L('Някой ден', 'Someday')), icon: 'waves', count: buckets.someday.length },
                { id: 'done', label: t(L('Завършени', 'Completed')), icon: 'checkCircle', count: buckets.done.length },
              ]}
              className="flex-1"
            />
          </div>

          {subjects.length > 0 && (
            <div className="scroll-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <FilterChip active={!filterSubject} onClick={() => setFilter(null)} label={t(S.all)} />
              {subjects.map((s) => (
                <FilterChip
                  key={s.id}
                  active={filterSubject === s.id}
                  color={s.color}
                  onClick={() => setFilter(filterSubject === s.id ? null : s.id)}
                  label={s.name}
                  count={openItems(items).filter((i) => i.subjectId === s.id).length}
                />
              ))}
            </div>
          )}
        </div>
      }
    >
      {tab === 'today' && buckets.overdue.length > 0 && (
        <Card
          className="mb-4"
          title={t(L('Просрочени', 'Overdue'))}
          icon="alert"
          subtitle={t(L('Пренасрочи ги или ги отметни — списъкът за днес започва след тях.', 'Reschedule or tick these — today starts after them.'))}
          flush
        >
          <div className="px-2 pb-2">
            {buckets.overdue.map((item) => (
              <TaskRow key={item.id} item={item} onEdit={setEditing} />
            ))}
          </div>
        </Card>
      )}

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={EMPTY[tab].icon}
            title={t(EMPTY[tab].title)}
            body={t(EMPTY[tab].body)}
            action={
              tab === 'done'
                ? undefined
                : {
                    label: t(L('Нова задача', 'New task')),
                    icon: 'plus',
                    onClick: () => useApp.getState().setQuick('task'),
                  }
            }
          />
        </Card>
      ) : grouped ? (
        <div className="space-y-4">
          {grouped.map(([day, list]) => (
            <Card key={day} flush>
              <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
                <span className="text-[12.5px] font-semibold first-letter:uppercase">
                  {formatDate(new Date(day).getTime(), lang, { weekday: 'long' })}
                  <span className="ml-2 font-normal text-muted">{shortDate(new Date(day).getTime(), lang)}</span>
                </span>
                <span className="t-num text-[11.5px] text-faint">{list.length}</span>
              </div>
              <div className="stagger px-2 py-2">
                {list.map((item) => (
                  <TaskRow key={item.id} item={item} onEdit={setEditing} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card flush>
          <div className="stagger px-2 py-2">
            {visible.map((item) => (
              <TaskRow key={item.id} item={item} onEdit={setEditing} />
            ))}
          </div>
        </Card>
      )}

      {editing &&
        (phone ? (
          <Sheet open onClose={() => setEditing(null)} title={t(L('Задача', 'Task'))}>
            <TaskEditor item={editing} onClose={() => setEditing(null)} />
          </Sheet>
        ) : (
          <Modal open onClose={() => setEditing(null)} title={t(L('Задача', 'Task'))} width={520}>
            <TaskEditor item={editing} onClose={() => setEditing(null)} />
          </Modal>
        ))}
      {element}
    </Screen>
  );
}

const EMPTY: Record<Tab, { icon: string; title: { bg: string; en: string }; body: { bg: string; en: string } }> = {
  today: {
    icon: 'coffee',
    title: L('Днес е чисто', 'Today is clear'),
    body: L('Нищо не е за днес. Навакса ли нещо от предстоящите, утре ще е по-леко.', 'Nothing is due today. Pull something forward and tomorrow gets lighter.'),
  },
  overdue: {
    icon: 'checkCircle',
    title: L('Нищо не е просрочено', 'Nothing is overdue'),
    body: L('Всичко е в срока си — рядко и хубаво състояние.', 'Everything is inside its deadline. Rare and good.'),
  },
  upcoming: {
    icon: 'calendar',
    title: L('Няма нищо напред', 'Nothing ahead yet'),
    body: L('Задачите със срок се появяват тук, подредени по ден.', 'Tasks with a deadline show up here, grouped by day.'),
  },
  someday: {
    icon: 'waves',
    title: L('Няма задачи без срок', 'No undated tasks'),
    body: L('Тук стоят нещата, които искаш да направиш, но не днес.', 'This is where things you want to do — but not today — wait.'),
  },
  done: {
    icon: 'trophy',
    title: L('Още нищо завършено', 'Nothing completed yet'),
    body: L('Отметнатите задачи се събират тук.', 'Ticked tasks collect here.'),
  },
};

function FilterChip({
  active,
  label,
  color,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
      style={{
        borderColor: active ? 'transparent' : 'var(--c-line)',
        background: active ? (color ? `color-mix(in srgb, ${color} 16%, transparent)` : 'var(--c-accent-soft)') : 'var(--c-surface)',
        color: active ? (color ?? 'var(--c-accent)') : 'var(--c-muted)',
      }}
    >
      {color && <span className="badge-dot" style={{ background: color }} />}
      {label}
      {count !== undefined && count > 0 && <span className="t-num opacity-60">{count}</span>}
    </button>
  );
}

/**
 * The field that stays. One line, Enter saves, and the subject and date it was
 * filtered to are carried over — the fastest path from thought to record.
 */
function QuickAdd({ subjectId }: { subjectId: string | null }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<'today' | 'tomorrow' | 'none'>('today');
  const ref = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    const due =
      when === 'none'
        ? null
        : startOfDay(new Date(Date.now() + (when === 'tomorrow' ? 86_400_000 : 0)));
    setTitle('');
    await usePlanner.getState().addItem({ title: value, subjectId, due });
    ref.current?.focus();
  };

  return (
    <div className="card flex items-center gap-2 p-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
        <Icon name="plus" size={16} strokeWidth={2.2} />
      </span>
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') setTitle('');
        }}
        placeholder={t(L('Добави задача и натисни ↵', 'Add a task and press ↵'))}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
      />
      <div className="hidden sm:block">
        <Segmented
          value={when}
          onChange={setWhen}
          items={[
            { id: 'today', label: t(S.today) },
            { id: 'tomorrow', label: t(L('Утре', 'Tomorrow')) },
            { id: 'none', label: t(L('Без срок', 'No date')) },
          ]}
        />
      </div>
      <Button variant={title.trim() ? 'primary' : 'ghost'} disabled={!title.trim()} onClick={() => void submit()}>
        {t(S.add)}
      </Button>
    </div>
  );
}

/** Full editor for an existing item — the same fields as quick create. */
export function TaskEditor({ item, onClose }: { item: PlannerItem; onClose: () => void }) {
  const t = useT();
  const allSubjects = useWorkspace((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const documents = useLibrary((s) => s.documents);
  const [draft, setDraft] = useState(item);

  useEffect(() => setDraft(item), [item]);

  const save = async () => {
    await usePlanner.getState().updateItem(item.id, {
      title: draft.title.trim() || item.title,
      notes: draft.notes,
      subjectId: draft.subjectId,
      due: draft.due,
      priority: draft.priority,
      kind: draft.kind,
      docId: draft.docId,
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="t-label mb-1.5 block">{t(L('Заглавие', 'Title'))}</label>
        <input
          autoFocus
          className="field field-lg"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="t-label mb-1.5 block">{t(S.subject)}</label>
          <Select
            value={draft.subjectId ?? ''}
            width={230}
            options={[
              { value: '', label: t(S.noSubject) },
              ...subjects.map((s) => ({ value: s.id, label: s.name, color: s.color })),
            ]}
            onChange={(v) => setDraft({ ...draft, subjectId: v || null })}
          />
        </div>
        <div>
          <label className="t-label mb-1.5 block">{t(L('Срок', 'Due'))}</label>
          <input
            type="date"
            className="field"
            value={draft.due ? isoDay(new Date(draft.due)) : ''}
            onChange={(e) =>
              setDraft({ ...draft, due: e.target.value ? startOfDay(new Date(e.target.value)) : null })
            }
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="t-label mb-1.5 block">{t(L('Вид', 'Kind'))}</label>
          <Segmented
            value={draft.kind}
            onChange={(v) => setDraft({ ...draft, kind: v })}
            items={[
              { id: 'task', label: t(S.task) },
              { id: 'homework', label: t(S.homework) },
              { id: 'exam', label: t(S.exam) },
            ]}
          />
        </div>
        <div>
          <label className="t-label mb-1.5 block">{t(S.priority)}</label>
          <Segmented
            value={String(draft.priority)}
            onChange={(v) => setDraft({ ...draft, priority: Number(v) as 0 | 1 | 2 })}
            items={[
              { id: '0', label: t(PRIORITY[0]) },
              { id: '1', label: t(PRIORITY[1]) },
              { id: '2', label: t(PRIORITY[2]) },
            ]}
          />
        </div>
      </div>

      <div>
        <label className="t-label mb-1.5 block">{t(L('Материал', 'Material'))}</label>
        <Select
          value={draft.docId ?? ''}
          width={280}
          options={[
            { value: '', label: t(L('Няма', 'None')) },
            ...documents
              .filter((d) => !d.deletedAt)
              .slice(0, 40)
              .map((d) => ({ value: d.id, label: d.name, icon: d.kind === 'board' ? 'board' : 'book' })),
          ]}
          onChange={(v) => setDraft({ ...draft, docId: v || null })}
        />
      </div>

      <div>
        <label className="t-label mb-1.5 block">{t(L('Бележки', 'Notes'))}</label>
        <textarea
          className="field h-24 resize-none py-2"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onClose}>{t(S.cancel)}</Button>
        <Button variant="primary" icon="check" onClick={() => void save()}>
          {t(S.save)}
        </Button>
      </div>
    </div>
  );
}
