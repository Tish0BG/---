import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemType, PlannerItem } from '@/types';
import { useApp, type PlanTab } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes, allTypes, typeName, typeOf } from '@/state/itemTypeStore';
import { useGoals, activeGoals } from '@/state/goalStore';
import {
  usePlanner,
  endOfDay,
  openItems,
  overdue,
  sortByDue,
  startOfDay,
} from '@/state/plannerStore';
import { useT, L, useLang, shortDate, formatDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Screen } from '../shell/Screen';
import { Icon } from '../Icon';
import { MenuItem, Modal, Popover, Select } from '../ui';
import { Button, Card, EmptyState, Segmented, Sheet, Tabs, useIsPhone } from '../kit';
import { TaskRow } from '../tasks/TaskRow';
import { TaskEditor } from './TaskEditor';
import { PlanBoard, clearDone } from './PlanBoard';
import { GoalsScreen } from '../goals/GoalsScreen';
import { ExamsScreen } from '../exams/ExamsScreen';
import { TypeManager } from './TypeManager';
import { isoDay } from '../shell/QuickCreate';

type Bucket = 'today' | 'upcoming' | 'overdue' | 'someday' | 'done';

/**
 * ─────────────────────────────────────────────────────────── the plan ──
 *
 * Tasks, goals and exams used to be three destinations in the sidebar. Two of
 * them were the same records under a different filter, all three were named
 * after school, and between them they took a quarter of the navigation for
 * one idea: things you owe your future self.
 *
 * They are one screen now, with three faces:
 *
 *   Board — the day and the long view side by side, which is where anybody
 *           who opens the app in the morning wants to land. It is the default.
 *   List  — the same records as one column with every filter available, for
 *           sorting out a backlog rather than working a day.
 *   Goals — the long view in full.
 *
 * What used to be the difference between the old screens is a *type* — and
 * types are something a person can invent, so the list holds a rehearsal, a
 * shift and a dentist's appointment as comfortably as a physics test. Where a
 * type wants a different presentation it gets one: picking "exam" swaps the
 * plain list for the countdown board.
 */
export function PlanScreen() {
  const t = useT();
  const lang = useLang();
  const phone = useIsPhone();
  const tab = useApp((s) => s.planTab);
  const kind = useApp((s) => s.planKind);
  const items = usePlanner((s) => s.items);
  const goals = useGoals((s) => s.goals);
  const custom = useItemTypes((s) => s.custom);
  const allSubjects = useWorkspace((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const filterSubject = useApp((s) => s.filterSubjectId);
  const setFilter = useApp((s) => s.setFilter);
  const [bucket, setBucket] = useState<Bucket>('today');
  const [editing, setEditing] = useState<PlannerItem | null>(null);
  const [types, setTypes] = useState(false);

  const typeList = useMemo(() => allTypes(custom), [custom]);

  const scoped = useMemo(() => {
    let list = items;
    if (filterSubject) list = list.filter((i) => i.subjectId === filterSubject);
    if (kind) list = list.filter((i) => i.kind === kind);
    return list;
  }, [items, filterSubject, kind]);

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

  const visible = buckets[bucket];

  /** Upcoming reads better grouped by day than as one long column. */
  const grouped = useMemo(() => {
    if (bucket !== 'upcoming') return null;
    const map = new Map<string, PlannerItem[]>();
    for (const item of buckets.upcoming) {
      const key = isoDay(new Date(item.due ?? 0));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [bucket, buckets.upcoming]);

  const doneToday = buckets.done.filter((i) => (i.completedAt ?? 0) >= startOfDay()).length;
  const live = activeGoals(goals).length;
  const pressing = buckets.today.length + buckets.overdue.length;
  const open = buckets.today.length + buckets.overdue.length + buckets.upcoming.length + buckets.someday.length;

  /** "Exam" is not a filter over the list — it is a different way of reading it. */
  const asBoard = tab === 'work' && kind === 'exam';

  return (
    <Screen
      width={tab === 'board' ? 'wide' : 'default'}
      title={t(L('План', 'Plan'))}
      subtitle={
        tab === 'goals'
          ? t(L(`${live} активни цели`, `${live} active goals`))
          : t(
              L(
                `${pressing} за днес · ${doneToday} готови · ${live} цели`,
                `${pressing} for today · ${doneToday} done · ${live} goals`,
              ),
            )
      }
      actions={
        /* On a phone the row is the width of the screen: the one button
           anybody came here to press stretches across it and the menu sits at
           the end of the same line. Left to wrap, the three-dot button ended
           up alone on a line above the primary action, which reads as a
           mistake rather than as a layout. */
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* On a phone the secondary actions fold into a menu. Three buttons
              across 375 px wrap onto two rows, and the rarest of them —
              clearing what is already finished — ends up taking a line of its
              own above the one thing anybody came here to press. */}
          {!phone && tab === 'work' && buckets.done.length > 0 && (
            <Button icon="trash" onClick={() => void clearDone(t)}>
              {t(L('Изчисти завършените', 'Clear completed'))}
            </Button>
          )}
          {!phone && (
            <Button icon="layers" onClick={() => setTypes(true)}>
              {t(L('Типове', 'Types'))}
            </Button>
          )}
          {tab === 'goals' ? (
            <Button
              className="flex-1 whitespace-nowrap sm:flex-none"
              variant="primary"
              icon="plus"
              onClick={() => useApp.getState().setQuick('goal')}
            >
              {t(L('Нова цел', 'New goal'))}
            </Button>
          ) : (
            <Button
              className="flex-1 whitespace-nowrap sm:flex-none"
              variant="primary"
              icon="plus"
              onClick={() => useApp.getState().setQuick('item', kind ?? 'task')}
            >
              {t(L('Нов запис', 'New entry'))}
            </Button>
          )}
          {phone && (
            <Popover
              width={230}
              align="end"
              trigger={({ toggle, ref }) => (
                <button ref={ref} onClick={toggle} className="icon-btn" aria-label={t(L('Още', 'More'))}>
                  <Icon name="dots" size={17} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    icon="layers"
                    label={t(L('Типове записи', 'Entry types'))}
                    onClick={() => {
                      setTypes(true);
                      close();
                    }}
                  />
                  {buckets.done.length > 0 && (
                    <MenuItem
                      icon="trash"
                      danger
                      label={t(L('Изчисти завършените', 'Clear completed'))}
                      onClick={() => {
                        close();
                        void clearDone(t);
                      }}
                    />
                  )}
                </>
              )}
            </Popover>
          )}
        </div>
      }
      toolbar={
        <div className="space-y-3">
          <Tabs
            value={tab}
            onChange={(v: PlanTab) => useApp.getState().setPlanTab(v)}
            items={[
              { id: 'board', label: t(L('Табло', 'Board')), icon: 'dashboard', count: pressing },
              { id: 'work', label: t(L('Списък', 'List')), icon: 'listTodo', count: open },
              { id: 'goals', label: t(S.goals), icon: 'target', count: live },
            ]}
          />

          {tab === 'board' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-[12px] text-faint">
                {t(
                  phone
                    ? L(
                        'Всеки запис има меню: „За днес“, „За утре“, напомняне.',
                        'Every entry has a menu: move to today, to tomorrow, remind me.',
                      )
                    : L(
                        'Дърпай записи от „Напред“ в „Днес“ — денят се подрежда с ръка.',
                        'Drag entries from Ahead into Today — the day gets arranged by hand.',
                      ),
                )}
              </span>
              <FilterMenu
                types={typeList}
                kind={kind}
                subjects={subjects}
                subjectId={filterSubject}
                items={items}
                onKind={(id) => useApp.getState().setPlanKind(id)}
                onSubject={setFilter}
                onManage={() => setTypes(true)}
              />
            </div>
          )}

          {tab === 'work' && (
            <>
              <QuickAdd subjectId={filterSubject} kind={kind ?? 'task'} types={typeList} />

              {/* One row of controls, not four.
                  The screen used to stack the tabs, the quick-add, a strip of
                  types, a strip of buckets and a strip of subjects — five
                  parallel filter systems, all shouting at once, pushing the
                  actual work halfway down the window. The buckets are the one
                  thing a person changes constantly, so they stay visible; the
                  other two hide behind a control that says how many are on. */}
              <div className="flex flex-wrap items-center gap-2">
                {!asBoard && (
                  <Tabs
                    value={bucket}
                    onChange={setBucket}
                    className="min-w-0 flex-1"
                    items={[
                      { id: 'today', label: t(S.today), icon: 'bolt', count: buckets.today.length },
                      {
                        id: 'overdue',
                        label: t(L('Просрочени', 'Overdue')),
                        icon: 'alert',
                        count: buckets.overdue.length,
                      },
                      {
                        id: 'upcoming',
                        label: t(L('Предстоящи', 'Upcoming')),
                        icon: 'calendar',
                        count: buckets.upcoming.length,
                      },
                      {
                        id: 'someday',
                        label: t(L('Някой ден', 'Someday')),
                        icon: 'waves',
                        count: buckets.someday.length,
                      },
                      {
                        id: 'done',
                        label: t(L('Завършени', 'Completed')),
                        icon: 'checkCircle',
                        count: buckets.done.length,
                      },
                    ]}
                  />
                )}
                {asBoard && <span className="flex-1" />}

                <FilterMenu
                  types={typeList}
                  kind={kind}
                  subjects={subjects}
                  subjectId={filterSubject}
                  items={items}
                  onKind={(id) => useApp.getState().setPlanKind(id)}
                  onSubject={setFilter}
                  onManage={() => setTypes(true)}
                />
              </div>

            </>
          )}

          {/* Whatever is filtered says so, in words, with a way out. A
              filter you cannot see is a list that is lying to you. */}
          {tab !== 'goals' && (kind || filterSubject) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px] text-faint">{t(L('Показва се:', 'Showing:'))}</span>
              {kind && (
                <ActiveChip
                  label={typeName(typeOf(kind, custom), lang)}
                  icon={typeOf(kind, custom).icon}
                  color={typeOf(kind, custom).color ?? undefined}
                  onClear={() => useApp.getState().setPlanKind(null)}
                />
              )}
              {filterSubject && (
                <ActiveChip
                  label={subjects.find((s) => s.id === filterSubject)?.name ?? ''}
                  color={subjects.find((s) => s.id === filterSubject)?.color}
                  onClear={() => setFilter(null)}
                />
              )}
            </div>
          )}
        </div>
      }
    >
      {tab === 'board' ? (
        <PlanBoard onEdit={setEditing} />
      ) : tab === 'goals' ? (
        <GoalsScreen embedded />
      ) : asBoard ? (
        <ExamsScreen embedded />
      ) : (
        <>
          {bucket === 'today' && buckets.overdue.length > 0 && (
            <Card
              className="mb-4"
              title={t(L('Просрочени', 'Overdue'))}
              icon="alert"
              subtitle={t(
                L(
                  'Пренасрочи ги или ги отметни — денят започва след тях.',
                  'Reschedule or tick these — today starts after them.',
                ),
              )}
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
                icon={EMPTY[bucket].icon}
                title={t(EMPTY[bucket].title)}
                body={t(EMPTY[bucket].body)}
                action={
                  bucket === 'done'
                    ? undefined
                    : {
                        label: t(L('Нов запис', 'New entry')),
                        icon: 'plus',
                        onClick: () => useApp.getState().setQuick('item', kind ?? 'task'),
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
                      <span className="ml-2 font-normal text-muted">
                        {shortDate(new Date(day).getTime(), lang)}
                      </span>
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
        </>
      )}

      {editing &&
        (phone ? (
          <Sheet open onClose={() => setEditing(null)} title={t(L('Запис', 'Entry'))}>
            <TaskEditor item={editing} onClose={() => setEditing(null)} />
          </Sheet>
        ) : (
          <Modal open onClose={() => setEditing(null)} title={t(L('Запис', 'Entry'))} width={560}>
            <TaskEditor item={editing} onClose={() => setEditing(null)} />
          </Modal>
        ))}

      {types &&
        (phone ? (
          <Sheet open onClose={() => setTypes(false)} title={t(L('Типове записи', 'Entry types'))}>
            <TypeManager />
          </Sheet>
        ) : (
          <Modal open onClose={() => setTypes(false)} title={t(L('Типове записи', 'Entry types'))} width={560}>
            <TypeManager />
          </Modal>
        ))}

    </Screen>
  );
}

const EMPTY: Record<Bucket, { icon: string; title: { bg: string; en: string }; body: { bg: string; en: string } }> = {
  today: {
    icon: 'coffee',
    title: L('Днес е чисто', 'Today is clear'),
    body: L(
      'Нищо не е за днес. Издърпаш ли нещо от предстоящите, утре ще е по-леко.',
      'Nothing is due today. Pull something forward and tomorrow gets lighter.',
    ),
  },
  overdue: {
    icon: 'checkCircle',
    title: L('Нищо не е просрочено', 'Nothing is overdue'),
    body: L('Всичко е в срока си — рядко и хубаво състояние.', 'Everything is inside its deadline. Rare and good.'),
  },
  upcoming: {
    icon: 'calendar',
    title: L('Няма нищо напред', 'Nothing ahead yet'),
    body: L('Записите със срок се появяват тук, подредени по ден.', 'Entries with a deadline show up here, grouped by day.'),
  },
  someday: {
    icon: 'waves',
    title: L('Няма записи без срок', 'No undated entries'),
    body: L('Тук стоят нещата, които искаш да направиш, но не днес.', 'This is where things you want to do — but not today — wait.'),
  },
  done: {
    icon: 'trophy',
    title: L('Още нищо завършено', 'Nothing completed yet'),
    body: L('Отметнатите записи се събират тук.', 'Ticked entries collect here.'),
  },
};

/* --------------------------------------------------------------- filters */

/**
 * The two filters that are not the buckets, behind one control.
 *
 * They were two full-width strips of chips. Chips are a fine control for four
 * options and a wall for fourteen — and stacked above each other they made the
 * screen look like a search engine rather than a list of what you owe. Here
 * they are a button that carries the count, opening onto both sets at once.
 */
function FilterMenu({
  types,
  kind,
  subjects,
  subjectId,
  items,
  onKind,
  onSubject,
  onManage,
}: {
  types: ItemType[];
  kind: string | null;
  subjects: { id: string; name: string; color: string }[];
  subjectId: string | null;
  items: PlannerItem[];
  onKind: (id: string | null) => void;
  onSubject: (id: string | null) => void;
  onManage: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const open = useMemo(() => openItems(items), [items]);
  const active = (kind ? 1 : 0) + (subjectId ? 1 : 0);

  return (
    <Popover
      width={300}
      align="end"
      trigger={({ toggle, ref, open: isOpen }) => (
        <button
          ref={ref}
          onClick={toggle}
          className={`btn btn-outline shrink-0 gap-1.5 ${isOpen || active ? 'btn-ghost-active' : ''}`}
        >
          <Icon name="filter" size={14} />
          <span className="hidden sm:inline">{t(L('Филтри', 'Filters'))}</span>
          {active > 0 && (
            <span
              className="t-num grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10.5px] font-semibold"
              style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
            >
              {active}
            </span>
          )}
        </button>
      )}
    >
      {() => (
        <div className="p-2">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="t-label">{t(L('Вид', 'Type'))}</span>
            <button className="cursor-pointer text-[11.5px] text-accent" onClick={onManage}>
              {t(L('Управлявай', 'Manage'))}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!kind} onClick={() => onKind(null)} label={t(L('Всичко', 'Everything'))} />
            {types.map((type) => (
              <Chip
                key={type.id}
                active={kind === type.id}
                color={type.color ?? undefined}
                icon={type.icon}
                onClick={() => onKind(kind === type.id ? null : type.id)}
                label={typeName(type, lang)}
                count={open.filter((i) => i.kind === type.id).length}
              />
            ))}
          </div>

          {subjects.length > 0 && (
            <>
              <div className="mb-1.5 mt-3 px-1">
                <span className="t-label">{t(S.subject)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={!subjectId} onClick={() => onSubject(null)} label={t(S.all)} />
                {subjects.map((s) => (
                  <Chip
                    key={s.id}
                    active={subjectId === s.id}
                    color={s.color}
                    onClick={() => onSubject(subjectId === s.id ? null : s.id)}
                    label={s.name}
                    count={open.filter((i) => i.subjectId === s.id).length}
                  />
                ))}
              </div>
            </>
          )}

          {active > 0 && (
            <button
              className="mt-3 w-full cursor-pointer rounded-lg py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-3"
              onClick={() => {
                onKind(null);
                onSubject(null);
              }}
            >
              {t(L('Изчисти филтрите', 'Clear the filters'))}
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}

/** A filter that is on, said out loud, with the way to switch it off. */
function ActiveChip({
  label,
  icon,
  color,
  onClear,
}: {
  label: string;
  icon?: string;
  color?: string;
  onClear: () => void;
}) {
  const tint = color ?? 'var(--c-accent)';
  return (
    <span
      className="flex h-[24px] items-center gap-1.5 rounded-full pl-2 pr-1 text-[12px] font-medium"
      style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}
    >
      {icon ? <Icon name={icon} size={11} /> : <span className="badge-dot" style={{ background: tint }} />}
      {label}
      <button
        onClick={onClear}
        className="grid h-[17px] w-[17px] cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface-3"
        aria-label="×"
      >
        <Icon name="x" size={11} />
      </button>
    </span>
  );
}

function Chip({
  active,
  label,
  color,
  icon,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  icon?: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[26px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors"
      style={{
        borderColor: active ? 'transparent' : 'var(--c-line)',
        background: active
          ? color
            ? `color-mix(in srgb, ${color} 16%, transparent)`
            : 'var(--c-accent-soft)'
          : 'var(--c-surface)',
        color: active ? (color ?? 'var(--c-accent)') : 'var(--c-muted)',
      }}
    >
      {icon ? (
        <Icon name={icon} size={12} />
      ) : color ? (
        <span className="badge-dot" style={{ background: color }} />
      ) : null}
      {label}
      {count !== undefined && count > 0 && <span className="t-num opacity-60">{count}</span>}
    </button>
  );
}

/* -------------------------------------------------------------- quick add */

/**
 * The field that stays.
 *
 * One line, Enter saves, and it inherits whatever the screen is filtered to —
 * the subject and the type — so the fastest path from thought to record does
 * not pass through a dialog.
 */
function QuickAdd({
  subjectId,
  kind,
  types,
}: {
  subjectId: string | null;
  kind: string;
  types: ItemType[];
}) {
  const t = useT();
  const lang = useLang();
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<'today' | 'tomorrow' | 'none'>('today');
  const [pick, setPick] = useState(kind);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setPick(kind), [kind]);

  const type = typeOf(pick, types.filter((x) => !x.builtin));

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    const due =
      when === 'none' ? null : startOfDay(new Date(Date.now() + (when === 'tomorrow' ? 86_400_000 : 0)));
    setTitle('');
    await usePlanner.getState().addItem({ title: value, subjectId, due, kind: pick });
    ref.current?.focus();
  };

  return (
    <div className="card flex flex-wrap items-center gap-2 p-2">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]"
        style={{
          background: type.color
            ? `color-mix(in srgb, ${type.color} 15%, transparent)`
            : 'var(--c-accent-soft)',
          color: type.color ?? 'var(--c-accent)',
        }}
      >
        <Icon name={type.icon} size={16} strokeWidth={2} />
      </span>
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
          if (e.key === 'Escape') setTitle('');
        }}
        placeholder={t(L('Добави и натисни ↵', 'Add something and press ↵'))}
        className="min-w-[140px] flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
      />

      <div className="hidden sm:block">
        <Select
          value={pick}
          width={168}
          options={types.map((x) => ({
            value: x.id,
            label: typeName(x, lang),
            icon: x.icon,
            color: x.color ?? undefined,
          }))}
          onChange={setPick}
        />
      </div>

      <div className="hidden md:block">
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
