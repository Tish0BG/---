import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlanner, openItems, overdue as overdueOf, startOfDay } from '@/state/plannerStore';
import { usePlanView } from '@/state/planViewStore';
import { useSettings } from '@/state/settingsStore';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes, allTypes, typeName, typeOf } from '@/state/itemTypeStore';
import { useT, useLang, L, formatDate, shortDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { MenuItem, Modal, Popover } from '../ui';
import { useIsCompact, useIsPhone } from '../kit';
import { TypeManager } from './TypeManager';
import { BacklogColumn, DayColumn, scopeItems } from './DayColumn';
import { PlanCalendar } from './PlanCalendar';
import { clockMinutes, dayRange, itemsOfDay, plannedTotal } from './planTime';

/**
 * ────────────────────────────────────────────────────────────────── the plan ──
 *
 * One screen, and it is Sunsama's Home and nothing else: the days side by
 * side, the backlog you pull from at the left edge, the calendar on the same
 * ruler at the right.
 *
 * It briefly carried a rail of its own — rituals, an archive, a journal, a
 * second copy of the objectives — because that is what sits beside Home in the
 * app this was modelled on. Two navigation rails on one screen is one rail too
 * many, and a planner that opens onto a menu is a planner that has not
 * answered the only question anybody opened it with: *does today fit*.
 *
 * That question is the whole design. Lanes have no size and days do, so the
 * columns are days, every card carries an estimate, and the bar under each
 * date is the day's ceiling drawn to scale. Dragging is the whole interaction,
 * in every direction — between days, into the backlog, onto an hour of the
 * calendar — because deciding what a day is made of is a physical sort of
 * thought and a date picker is a bad place to do it.
 */
export function PlanScreen() {
  const t = useT();
  const lang = useLang();
  const phone = useIsPhone();
  const compact = useIsCompact();
  const items = usePlanner((s) => s.items);
  const anchor = usePlanView((s) => s.anchor);
  const dayCount = usePlanView((s) => s.days);
  const calendar = usePlanView((s) => s.calendar);
  const backlog = usePlanView((s) => s.backlog);
  const planKind = useApp((s) => s.planKind);
  const planNav = useApp((s) => s.planNav);
  const focusId = useApp((s) => s.focusId);
  const filterSubject = useApp((s) => s.filterSubjectId);
  const capacity = useSettings((s) => s.dayCapacity);
  const [types, setTypes] = useState(false);
  const board = useRef<HTMLDivElement>(null);

  /* A window that has drifted a week back is not where anybody left it; the
     day the app opens on is always today. */
  useEffect(() => {
    if (startOfDay(new Date(usePlanView.getState().anchor)) < startOfDay()) usePlanView.getState().today();
  }, [planNav]);

  /**
   * A link that names one entry opens it, on the day it belongs to.
   *
   * Reminders and the dashboard's "next step" both carry an id, and both used
   * to land on a list with the row somewhere in it. Here the window moves to
   * the entry's own day and the panel opens on it, which is what "take me to
   * this" was always asking for.
   */
  useEffect(() => {
    if (!focusId) return;
    const item = usePlanner.getState().items.find((i) => i.id === focusId);
    useApp.getState().clearFocus();
    if (!item) return;
    if (item.due !== null) usePlanView.getState().setAnchor(item.due);
    useApp.getState().openItem(item.id);
  }, [focusId]);

  /* Back to the left edge whenever the window moves. Seven columns scroll, and
     landing on Wednesday because that is where the board was left is not what
     pressing "Today" — or adding a day — was asking for. */
  useEffect(() => {
    board.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [anchor, dayCount, backlog]);

  useShortcuts();

  const days = useMemo(() => dayRange(anchor, phone ? 1 : dayCount), [anchor, dayCount, phone]);
  const late = useMemo(
    () => overdueOf(scopeItems(items, filterSubject, planKind)).length,
    [items, filterSubject, planKind],
  );
  const todayPlanned = useMemo(
    () => plannedTotal(itemsOfDay(scopeItems(items, filterSubject, planKind), startOfDay()).filter((i) => !i.done)),
    [items, filterSubject, planKind],
  );

  const columnWidth = phone
    ? 'calc(100vw - 40px)'
    : dayCount === 1
      ? 'min(620px, 100%)'
      : compact
        ? 300
        : 306;

  const showCalendar = calendar && !compact;

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ minHeight: phone ? undefined : 520 }}>
      {/* ----------------------------------------------------------- top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <button onClick={() => usePlanView.getState().today()} className="btn btn-outline h-8 gap-1.5 px-2.5">
          <Icon name="calendar" size={14} />
          {t(S.today)}
        </button>

        <div className="flex items-center gap-0.5">
          <button
            className="icon-btn h-8 w-8"
            aria-label={t(L('Назад', 'Back'))}
            onClick={() => usePlanView.getState().shift(-1)}
          >
            <Icon name="chevronLeft" size={15} />
          </button>
          <button
            className="icon-btn h-8 w-8"
            aria-label={t(L('Напред', 'Forward'))}
            onClick={() => usePlanView.getState().shift(1)}
          >
            <Icon name="chevronRight" size={15} />
          </button>
        </div>

        <span className="hidden min-w-0 truncate text-[13px] font-medium first-letter:uppercase sm:inline">
          {days.length === 1
            ? formatDate(days[0], lang, { weekday: 'long', day: 'numeric', month: 'long' })
            : `${shortDate(days[0], lang)} – ${shortDate(days[days.length - 1], lang)}`}
        </span>

        {late > 0 && (
          <span
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold"
            style={{ background: 'color-mix(in srgb, var(--c-danger) 12%, transparent)', color: 'var(--c-danger)' }}
          >
            <Icon name="alert" size={12} />
            <span className="t-num">{late}</span>
            {/* The word costs sixty pixels and the number carries the meaning;
                on a phone the row wraps without this. */}
            <span className="hidden sm:inline">{t(L('просрочени', 'overdue'))}</span>
          </span>
        )}

        <FilterChips subjectId={filterSubject} kind={planKind} />

        <span className="flex-1" />

        {todayPlanned > 0 && (
          <span
            className="t-num hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold md:inline-flex"
            style={{
              background:
                todayPlanned > capacity
                  ? 'color-mix(in srgb, var(--c-danger) 12%, transparent)'
                  : 'var(--c-surface-3)',
              color: todayPlanned > capacity ? 'var(--c-danger)' : 'var(--c-muted)',
            }}
            title={t(L('Планирано за днес', 'Planned for today'))}
          >
            <Icon name="clock" size={12} />
            {clockMinutes(todayPlanned)}
            <span className="opacity-60">/ {clockMinutes(capacity)}</span>
          </span>
        )}

        <FilterMenu subjectId={filterSubject} kind={planKind} onManage={() => setTypes(true)} />

        {!phone && (
          <Popover
            width={190}
            align="end"
            trigger={({ toggle, ref, open }) => (
              <button
                ref={ref}
                onClick={toggle}
                aria-label={t(L('Колко дни', 'How many days'))}
                className={`btn btn-outline h-8 gap-1.5 px-2.5 ${open ? 'btn-ghost-active' : ''}`}
              >
                <Icon name="grid" size={14} />
                <span className="t-num">{dayCount}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2 pb-1 pt-1.5">
                  <span className="t-label">{t(L('Колко дни наведнъж', 'How many days at once'))}</span>
                </div>
                {[1, 2, 3, 4, 5, 7].map((n) => (
                  <MenuItem
                    key={n}
                    active={dayCount === n}
                    label={t(L(`${n} ${n === 1 ? 'ден' : 'дни'}`, `${n} ${n === 1 ? 'day' : 'days'}`))}
                    onClick={() => {
                      usePlanView.getState().setDays(n);
                      close();
                    }}
                  />
                ))}
              </>
            )}
          </Popover>
        )}

        {!compact && (
          <>
            <button
              onClick={() => usePlanView.getState().toggleBacklog()}
              aria-pressed={backlog}
              className={`btn btn-outline h-8 gap-1.5 px-2.5 ${backlog ? 'btn-ghost-active' : ''}`}
            >
              <Icon name="archive" size={14} />
              <span className="hidden lg:inline">{t(L('Бекло̀г', 'Backlog'))}</span>
            </button>
            <button
              onClick={() => usePlanView.getState().toggleCalendar()}
              aria-pressed={calendar}
              className={`btn btn-outline h-8 gap-1.5 px-2.5 ${calendar ? 'btn-ghost-active' : ''}`}
            >
              <Icon name="calendar" size={14} />
              <span className="hidden lg:inline">{t(L('Календар', 'Calendar'))}</span>
            </button>
          </>
        )}

        <Popover
          width={230}
          align="end"
          trigger={({ toggle, ref }) => (
            <button ref={ref} onClick={toggle} className="icon-btn h-8 w-8" aria-label={t(L('Още', 'More'))}>
              <Icon name="dots" size={15} />
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
              <MenuItem
                icon="calendar"
                label={t(L('Пълен календар', 'Full calendar'))}
                onClick={() => {
                  useApp.getState().go('calendar');
                  close();
                }}
              />
              <MenuItem icon="command" label={t(L('Клавиши: ← → C Esc', 'Keys: ← → C Esc'))} />
            </>
          )}
        </Popover>
      </header>

      {/* -------------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">
        <div ref={board} className="scroll-thin flex min-h-0 flex-1 gap-3 overflow-x-auto px-3 py-3">
          {backlog && !phone && <BacklogColumn />}
          {days.map((day, i) => (
            <DayColumn
              key={day}
              day={day}
              width={columnWidth}
              grow={!phone && dayCount > 1}
              divider={!phone && i < days.length - 1}
            />
          ))}
          {!phone && dayCount > 1 && dayCount < 7 && (
            <button
              onClick={() => usePlanView.getState().setDays(dayCount + 1)}
              aria-label={t(L('Още един ден', 'One more day'))}
              className="mt-1 h-9 w-9 shrink-0 cursor-pointer rounded-[8px] border border-dashed border-line text-faint transition-colors hover:border-line-strong hover:text-ink"
            >
              <Icon name="plus" size={15} className="mx-auto" />
            </button>
          )}
        </div>

        {showCalendar && <PlanCalendar onClose={() => usePlanView.getState().toggleCalendar()} />}
      </div>

      {types && (
        <Modal open onClose={() => setTypes(false)} title={t(L('Типове записи', 'Entry types'))} width={560}>
          <TypeManager />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- the filters */

/**
 * The two lenses over the board, behind one control.
 *
 * They were a rail of chips down the left-hand side. A rail is a fine place
 * for navigation and the wrong place for a filter: it made the screen look
 * like it had two menus, and neither of them said what was currently on.
 */
function FilterMenu({
  subjectId,
  kind,
  onManage,
}: {
  subjectId: string | null;
  kind: string | null;
  onManage: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const items = usePlanner((s) => s.items);
  const allSubjects = useWorkspace((s) => s.subjects);
  const custom = useItemTypes((s) => s.custom);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const typeList = useMemo(() => allTypes(custom), [custom]);
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
          className={`btn btn-outline h-8 shrink-0 gap-1.5 px-2.5 ${isOpen || active ? 'btn-ghost-active' : ''}`}
        >
          <Icon name="filter" size={14} />
          <span className="hidden lg:inline">{t(L('Филтри', 'Filters'))}</span>
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
            <Chip
              active={!kind}
              onClick={() => useApp.getState().setPlanKind(null)}
              label={t(L('Всичко', 'Everything'))}
            />
            {typeList.map((type) => (
              <Chip
                key={type.id}
                active={kind === type.id}
                color={type.color ?? undefined}
                icon={type.icon}
                onClick={() => useApp.getState().setPlanKind(kind === type.id ? null : type.id)}
                label={typeName(type, lang)}
                count={open.filter((i) => i.kind === type.id).length}
              />
            ))}
          </div>

          {subjects.length > 0 && (
            <>
              <div className="mb-1.5 mt-3 px-1">
                <span className="t-label">{t(L('Канал', 'Channel'))}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={!subjectId} onClick={() => useApp.getState().setFilter(null)} label={t(S.all)} />
                {subjects.map((s) => (
                  <Chip
                    key={s.id}
                    active={subjectId === s.id}
                    color={s.color}
                    onClick={() => useApp.getState().setFilter(subjectId === s.id ? null : s.id)}
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
                useApp.getState().setPlanKind(null);
                useApp.getState().setFilter(null);
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

/** Whatever is narrowing the board, said out loud and switched off in one click. */
function FilterChips({ subjectId, kind }: { subjectId: string | null; kind: string | null }) {
  const lang = useLang();
  const subjects = useWorkspace((s) => s.subjects);
  const custom = useItemTypes((s) => s.custom);
  if (!subjectId && !kind) return null;

  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  const type = kind ? typeOf(kind, custom) : null;

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {subject && (
        <ActiveChip
          label={`# ${subject.name}`}
          color={subject.color}
          onClear={() => useApp.getState().setFilter(null)}
        />
      )}
      {type && (
        <ActiveChip
          label={typeName(type, lang)}
          color={type.color ?? undefined}
          onClear={() => useApp.getState().setPlanKind(null)}
        />
      )}
    </span>
  );
}

function ActiveChip({ label, color, onClear }: { label: string; color?: string; onClear: () => void }) {
  const tint = color ?? 'var(--c-accent)';
  return (
    <span
      className="flex h-[24px] items-center gap-1 rounded-full pl-2 pr-1 text-[11.5px] font-medium"
      style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}
    >
      <span className="max-w-[120px] truncate">{label}</span>
      <button
        onClick={onClear}
        aria-label="×"
        className="grid h-[16px] w-[16px] cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface-3"
      >
        <Icon name="x" size={10} />
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
      {icon ? <Icon name={icon} size={12} /> : color ? <span className="badge-dot" style={{ background: color }} /> : null}
      {label}
      {count !== undefined && count > 0 && <span className="t-num opacity-60">{count}</span>}
    </button>
  );
}

/* ----------------------------------------------------------------- the keys */

/**
 * The three keys the board is worked with, and no more.
 *
 * It had eight, including `T` for today and `B` for the backlog — both of
 * which the app already spends globally on "new task" and "new whiteboard".
 * Two systems fighting over one keystroke is worse than a shortcut nobody
 * has, so the plan keeps only the keys nothing else wants.
 */
function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      )
        return;
      if (document.querySelector('[role="dialog"]')) return;

      const view = usePlanView.getState();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        return view.shift(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        return view.shift(1);
      }
      if (e.code === 'KeyC') view.toggleCalendar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
