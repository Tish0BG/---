import { useMemo, useRef, useState } from 'react';
import type { PlannerItem } from '@/types';
import { usePlanner, openItems, overdue as overdueOf, startOfDay } from '@/state/plannerStore';
import { usePlanView } from '@/state/planViewStore';
import { useSettings } from '@/state/settingsStore';
import { useApp } from '@/state/appStore';
import { useTimer } from '@/state/timerStore';
import { useT, useLang, L, formatDate } from '@/i18n';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover } from '../ui';
import { notify } from '@/state/toastStore';
import { TaskCard } from './TaskCard';
import { clockMinutes, itemsOfDay, plannedTotal, actualTotal } from './planTime';

/**
 * ────────────────────────────────────────────────────────────── one day ──
 *
 * A column is a day, and a day is a container with a bottom. That is the
 * whole argument of this screen: a to-do list can hold anything because it
 * has no size, and a day cannot, so the column says out loud how much has
 * been promised to it and how much it was ever going to hold. The bar under
 * the date is not decoration — it is the only honest thing on the screen.
 *
 * Everything else follows from that. The estimate lives on the card so the
 * sum can exist. Dragging is the way work moves between days because moving
 * something out of an overfull day is the actual work of planning. And the
 * finished pile folds away, because it has already been paid for.
 */

const CAPACITIES = [60, 120, 180, 240, 300, 360, 480, 600];

/**
 * The two narrowings the whole board obeys: a channel and a type.
 *
 * Both live in `appStore` because the dashboard and the library read the same
 * channel filter, and both are applied here rather than in each column so a
 * day and the backlog can never disagree about what is being shown.
 */
export function scopeItems(
  items: PlannerItem[],
  subjectId: string | null,
  kind: string | null,
): PlannerItem[] {
  let list = items;
  if (subjectId) list = list.filter((i) => i.subjectId === subjectId);
  if (kind) list = list.filter((i) => i.kind === kind);
  return list;
}

export function DayColumn({
  day,
  width = 300,
  grow,
  divider,
}: {
  day: number;
  width?: number | string;
  /** share the free space with the other columns instead of taking a fixed width */
  grow?: boolean;
  /** a hairline on the right, so a row of days reads as a grid rather than a pile */
  divider?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const items = usePlanner((s) => s.items);
  const sessions = useTimer((s) => s.sessions);
  const filterSubject = useApp((s) => s.filterSubjectId);
  const filterKind = useApp((s) => s.planKind);
  const dragging = usePlanView((s) => s.dragging);
  const capacity = useSettings((s) => s.dayCapacity);
  const [over, setOver] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => itemsOfDay(scopeItems(items, filterSubject, filterKind), day), [
    items,
    filterSubject,
    filterKind,
    day,
  ]);

  const open = all.filter((i) => !i.done);
  const done = all.filter((i) => i.done);
  const planned = plannedTotal(open);
  const spent = actualTotal(all, sessions);
  const isToday = startOfDay(new Date(day)) === startOfDay();
  const past = startOfDay(new Date(day)) < startOfDay();

  /**
   * Yesterday's leftovers, at the top of today.
   *
   * They keep their own date — moving them silently would be a lie about when
   * the work was owed — but they cannot be left on a column nobody scrolls
   * back to. Today is the only day anybody is looking at, so today is where
   * the question has to be asked.
   */
  const late = useMemo(
    () => (isToday ? overdueOf(scopeItems(items, filterSubject, filterKind)) : []),
    [items, filterSubject, filterKind, isToday],
  );

  /* ------------------------------------------------------------ dropping */

  /** Where in the column the row in the air would land. */
  const indexAt = (clientY: number): number => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-card]') ?? [])];
    for (let i = 0; i < rows.length; i++) {
      const box = rows[i].getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return i;
    }
    return rows.length;
  };

  const drop = async (index: number) => {
    /* Read from the store, not from the render.
       `dragging` reaches this component as a rendered value, and a drop can
       land in the same tick as the pick-up — a fast flick, or a synthetic
       event — while that value is still the previous `null`. The store is
       written synchronously by the card, so it is always current. */
    const id = usePlanView.getState().dragging;
    usePlanView.getState().setDragging(null);
    setOver(null);
    if (!id) return;
    const planner = usePlanner.getState();
    await planner.moveTo(id, startOfDay(new Date(day)));
    // The neighbour is read *after* the move, because the entry may have just
    // arrived in this column and shifted everything below it by one.
    const column = itemsOfDay(usePlanner.getState().items, day).filter((i) => !i.done && i.id !== id);
    const before = index >= column.length ? null : (column[index]?.id ?? null);
    await planner.reorder(id, before);
  };

  const armed = !!dragging;

  return (
    <section
      className={`flex min-h-0 flex-col ${grow ? '' : 'shrink-0'} ${
        divider ? 'border-r border-line pr-3' : ''
      }`}
      /* Columns share the space when the days fit and scroll when they do not:
         three columns pinned to 306 px leave a stripe of empty desk on a wide
         screen, and a column narrower than about 260 px cannot hold a title. */
      style={grow ? { flex: '1 1 0px', minWidth: 262, maxWidth: 460 } : { width }}
      onDragOver={(e) => {
        if (!usePlanView.getState().dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(indexAt(e.clientY));
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOver(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        void drop(indexAt(e.clientY));
      }}
    >
      {/* ------------------------------------------------------- header */}
      <header className="px-1 pb-2">
        <div className="flex items-baseline gap-2">
          <h2
            className={`truncate text-[15px] font-semibold tracking-[-0.015em] first-letter:uppercase ${
              past ? 'text-muted' : ''
            }`}
          >
            {formatDate(day, lang, { weekday: 'long' })}
          </h2>
          {isToday && (
            <span
              className="rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.05em]"
              style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
            >
              {t(L('днес', 'today'))}
            </span>
          )}
          <span className="ml-auto shrink-0">
            <DayMenu day={day} items={all} />
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-muted">
          {formatDate(day, lang, { day: 'numeric', month: 'long' })}
        </p>

        {/* The day's ceiling, drawn. Over capacity the bar turns and says so
            in the number rather than simply running off the end. */}
        <CapacityBar planned={planned} spent={spent} capacity={capacity} />
      </header>

      {/* --------------------------------------------------- add + total */}
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <AddTask day={startOfDay(new Date(day))} />
        <span
          className="t-num shrink-0 text-[11.5px] font-semibold"
          style={{ color: planned > capacity ? 'var(--c-danger)' : 'var(--c-muted)' }}
        >
          {clockMinutes(planned)}
        </span>
      </div>

      {/* --------------------------------------------------------- cards */}
      <div ref={listRef} className="scroll-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1 pb-6">
        {late.length > 0 && (
          <div className="mb-2 rounded-[10px] border border-dashed p-1.5" style={{ borderColor: 'var(--c-danger)' }}>
            <div className="flex items-center gap-1.5 px-1.5 pb-1.5 pt-0.5">
              <Icon name="alert" size={11} style={{ color: 'var(--c-danger)' }} />
              <span className="t-label" style={{ color: 'var(--c-danger)' }}>
                {t(L('Просрочени', 'Overdue'))}
              </span>
              <span className="t-num ml-auto text-[11px] text-faint">{late.length}</span>
            </div>
            <div className="space-y-1.5">
              {late.map((item) => (
                <TaskCard key={item.id} item={item} showDue compact />
              ))}
            </div>
          </div>
        )}

        {open.map((item, i) => (
          <div key={item.id} data-card>
            {armed && over === i && <DropLine />}
            <TaskCard item={item} />
          </div>
        ))}
        {armed && (over ?? -1) >= open.length && <DropLine />}

        {open.length === 0 && late.length === 0 && !armed && (
          <div className="rounded-[10px] border border-dashed border-line px-3 py-6 text-center">
            <p className="text-[12px] text-faint">
              {isToday
                ? t(L('Днес е празно. Дръпни нещо тук или го напиши.', 'Today is empty. Drag something in, or write it.'))
                : t(L('Нищо за този ден.', 'Nothing on this day.'))}
            </p>
          </div>
        )}

        {armed && open.length === 0 && late.length === 0 && (
          <div
            className="rounded-[10px] border border-dashed px-3 py-6 text-center text-[12px] font-medium"
            style={{ borderColor: 'var(--c-accent)', color: 'var(--c-accent)' }}
          >
            {t(L('Пусни тук', 'Drop here'))}
          </div>
        )}

        {done.length > 0 && (
          <div className="pt-1.5">
            <button
              onClick={() => setShowDone((v) => !v)}
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-[8px] px-1.5 py-1 text-[11.5px] text-muted transition-colors hover:bg-surface-2"
            >
              <Icon name={showDone ? 'chevronDown' : 'chevronRight'} size={12} />
              {t(L(`Готови · ${done.length}`, `Done · ${done.length}`))}
              <span className="t-num ml-auto text-[11px] text-faint">{clockMinutes(plannedTotal(done))}</span>
            </button>
            {showDone && (
              <div className="mt-1.5 space-y-1.5">
                {done.map((item) => (
                  <TaskCard key={item.id} item={item} compact />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- the bar */

/**
 * Planned against capacity, with what has actually been spent drawn inside it.
 *
 * Two quantities in one bar rather than two bars: the question is never "how
 * much have I done" on its own, it is "how much of what I promised have I
 * done, and was the promise ever possible".
 */
function CapacityBar({
  planned,
  spent,
  capacity,
}: {
  planned: number;
  spent: number;
  capacity: number;
}) {
  const t = useT();
  const over = planned > capacity;
  const fill = Math.min(1, capacity ? planned / capacity : 0);
  const doneFill = Math.min(1, capacity ? spent / capacity : 0);

  return (
    <Popover
      width={190}
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          onClick={toggle}
          aria-label={t(L('Капацитет на деня', "The day's capacity"))}
          className="mt-2 block w-full cursor-pointer"
        >
          <span className="relative block h-[5px] w-full overflow-hidden rounded-full bg-surface-3">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
              style={{
                width: `${fill * 100}%`,
                background: over ? 'var(--c-danger)' : 'var(--c-line-strong)',
              }}
            />
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
              style={{ width: `${doneFill * 100}%`, background: 'var(--c-success)' }}
            />
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2 pb-1 pt-1.5">
            <span className="t-label">{t(L('Колко побира денят', 'How much the day holds'))}</span>
            <span className="mt-0.5 block text-[11px] text-faint">
              {t(L('Важи за всеки ден', 'Applies to every day'))}
            </span>
          </div>
          {CAPACITIES.map((m) => (
            <MenuItem
              key={m}
              active={capacity === m}
              label={clockMinutes(m)}
              onClick={() => {
                useSettings.getState().set('dayCapacity', m);
                close();
              }}
            />
          ))}
        </>
      )}
    </Popover>
  );
}

function DropLine() {
  return (
    <div className="my-1 h-[2px] rounded-full" style={{ background: 'var(--c-accent)' }} aria-hidden />
  );
}

/* ---------------------------------------------------------- the add field */

/**
 * The one way to add a record.
 *
 * This used to be a one-line field that saved on Enter — fast, and a second
 * creation path with its own rules: it applied the defaults a kind arrives
 * with and it read the channel filter, while the create button did neither.
 * Two ways to make the same record, disagreeing about what the record is.
 *
 * Now it opens the same window the create button opens, seeded with the day it
 * was pressed in and the channel the board is filtered to. The speed it cost
 * comes back as ⌘↵ inside that window, which saves and stays open.
 */
export function AddTask({ day, placeholder }: { day: number | null; placeholder?: string }) {
  const t = useT();
  const subjectId = useApp((s) => s.filterSubjectId);
  const kind = useApp((s) => s.planKind);

  return (
    <button
      data-plan-add={day === null ? 'backlog' : String(day)}
      onClick={() => useApp.getState().setQuick('item', kind ?? 'task', { due: day, subjectId })}
      className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-[8px] px-1 py-1 text-left text-[12.5px] text-faint transition-colors hover:bg-surface-2 hover:text-muted"
    >
      <Icon name="plus" size={13} strokeWidth={2} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{placeholder ?? t(L('Добави задача', 'Add task'))}</span>
    </button>
  );
}

/* ---------------------------------------------------------- the day menu */

function DayMenu({ day, items }: { day: number; items: PlannerItem[] }) {
  const t = useT();
  const done = items.filter((i) => i.done);
  const open = items.filter((i) => !i.done);

  const pushAll = async (days: number) => {
    const planner = usePlanner.getState();
    const target = new Date(day);
    target.setDate(target.getDate() + days);
    for (const item of open) await planner.moveTo(item.id, startOfDay(target));
  };

  return (
    <Popover
      width={240}
      align="end"
      trigger={({ toggle, ref }) => (
        <button ref={ref} onClick={toggle} className="icon-btn h-6 w-6" aria-label={t(L('Още', 'More'))}>
          <Icon name="dots" size={13} />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            icon="arrowRight"
            label={t(L('Премести всичко за утре', 'Move everything to tomorrow'))}
            onClick={() => {
              void pushAll(1);
              close();
            }}
          />
          <MenuItem
            icon="archive"
            label={t(L('Всичко в бекло̀га', 'Everything to the backlog'))}
            onClick={() => {
              const planner = usePlanner.getState();
              void (async () => {
                for (const item of open) await planner.moveTo(item.id, null);
              })();
              close();
            }}
          />
          {done.length > 0 && (
            <>
              <MenuSep />
              <MenuItem
                icon="trash"
                danger
                label={t(L(`Изчисти ${done.length} завършени`, `Clear ${done.length} completed`))}
                onClick={() => {
                  const snapshot = done;
                  void (async () => {
                    for (const item of snapshot) await usePlanner.getState().removeItem(item.id);
                    notify.undo(
                      t(L(`Изчистени ${snapshot.length}`, `Cleared ${snapshot.length}`)),
                      t(L('Върни', 'Undo')),
                      () => void usePlanner.getState().restoreItems(snapshot),
                    );
                  })();
                  close();
                }}
              />
            </>
          )}
        </>
      )}
    </Popover>
  );
}

/* ----------------------------------------------------------- the backlog */

/**
 * Everything without a day, standing beside the days.
 *
 * Sunsama calls it the backlog and the name is right: it is not a list of
 * things you failed to do, it is the pen you pull from every morning. It sits
 * at the left edge of the board rather than behind a tab, because a holding
 * pen you cannot see while you plan is a holding pen you plan without.
 */
export function BacklogColumn({ width = 280 }: { width?: number | string }) {
  const t = useT();
  const items = usePlanner((s) => s.items);
  const filterSubject = useApp((s) => s.filterSubjectId);
  const [over, setOver] = useState(false);

  const list = useMemo(() => {
    const scoped = filterSubject ? items.filter((i) => i.subjectId === filterSubject) : items;
    return openItems(scoped)
      .filter((i) => i.due === null)
      .sort((a, b) => a.order - b.order);
  }, [items, filterSubject]);

  return (
    <section
      className="flex min-h-0 shrink-0 flex-col border-r border-line pr-3"
      style={{ width }}
      onDragOver={(e) => {
        if (!usePlanView.getState().dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = usePlanView.getState().dragging;
        usePlanView.getState().setDragging(null);
        setOver(false);
        if (id) void usePlanner.getState().moveTo(id, null);
      }}
    >
      <header className="px-1 pb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em]">
            {t(L('Бекло̀г', 'Backlog'))}
          </h2>
          <span className="t-num ml-auto text-[11.5px] text-faint">{list.length}</span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-muted">
          {t(L('без ден — дърпаш оттук', 'no day yet — drag from here'))}
        </p>
        <span className="mt-2 block h-[5px] w-full rounded-full bg-surface-3" aria-hidden />
      </header>

      <div className="mb-1.5 flex items-center px-1">
        <AddTask day={null} placeholder={t(L('Нещо за някой ден', 'Something for someday'))} />
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1 pb-6">
        {over && (
          <div
            className="rounded-[10px] border border-dashed px-3 py-5 text-center text-[12px] font-medium"
            style={{ borderColor: 'var(--c-accent)', color: 'var(--c-accent)' }}
          >
            {t(L('Пусни тук → без ден', 'Drop here → no day'))}
          </div>
        )}
        {list.map((item) => (
          <TaskCard key={item.id} item={item} />
        ))}
        {list.length === 0 && !over && (
          <div className="rounded-[10px] border border-dashed border-line px-3 py-6 text-center">
            <p className="text-[12px] text-faint">
              {t(L('Бекло̀гът е празен.', 'The backlog is empty.'))}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
