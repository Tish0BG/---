import { useMemo, useState } from 'react';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, startOfDay } from '@/state/plannerStore';
import { useTimer } from '@/state/timerStore';
import { useT, L, useLang, monthTitle, weekdayNames, clockTime, shortDate, formatDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Screen } from '../shell/Screen';
import { Icon } from '../Icon';
import { Button, Card, EmptyState, IconButton, Segmented, Sheet, useIsPhone, useNow } from '../kit';
import { TaskRow } from '../tasks/TaskRow';
import { Timetable } from '../planner/Timetable';
import { eventsForRange, keyOf, monthGrid, weekDays, type CalEvent } from './events';

type View = 'month' | 'week' | 'day' | 'timetable';

const HOUR_FROM = 7;
const HOUR_TO = 22;
const HOUR_PX = 52;

/**
 * The calendar.
 *
 * Three records meet here — the weekly timetable, everything with a deadline,
 * and the focus sessions already logged — because that is how a week is
 * actually read. Deadlines can be dragged onto another day: rescheduling is
 * the single most common thing anyone does in a calendar, and making it a
 * dialog is how planners get abandoned.
 */
export function CalendarScreen() {
  const t = useT();
  const lang = useLang();
  const phone = useIsPhone();
  const now = useNow(60_000);
  const items = usePlanner((s) => s.items);
  const schedule = usePlanner((s) => s.schedule);
  const sessions = useTimer((s) => s.sessions);
  const subjects = useWorkspace((s) => s.subjects);

  const [view, setView] = useState<View>(phone ? 'day' : 'month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const days = useMemo(
    () => (view === 'month' ? monthGrid(anchor) : view === 'week' ? weekDays(anchor) : [anchor]),
    [view, anchor],
  );

  const events = useMemo(
    () => eventsForRange(days, { items, schedule, sessions, subjects }, { includeSessions: view !== 'month' }),
    [days, items, schedule, sessions, subjects, view],
  );

  const step = (dir: number) => {
    const next = new Date(anchor);
    if (view === 'month') next.setMonth(next.getMonth() + dir);
    else if (view === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setDate(next.getDate() + dir);
    setAnchor(next);
  };

  const title =
    view === 'timetable'
      ? t(L('Седмична програма', 'Weekly timetable'))
      : view === 'month'
      ? monthTitle(anchor.getTime(), lang)
      : view === 'week'
        ? `${shortDate(weekDays(anchor)[0].getTime(), lang)} — ${shortDate(weekDays(anchor)[6].getTime(), lang)}`
        : formatDate(anchor.getTime(), lang, { weekday: 'long', day: 'numeric', month: 'long' });

  /** Dropping a task on a day is a reschedule; classes and history are fixed. */
  const dropOn = (day: Date) => {
    if (!dragging) return;
    void usePlanner.getState().updateItem(dragging, { due: startOfDay(day) });
    setDragging(null);
  };

  return (
    <Screen
      width="wide"
      title={<span className="first-letter:uppercase">{title}</span>}
      subtitle={t(L('Програма, срокове и изпити — в един изглед.', 'Timetable, deadlines and exams in one view.'))}
      actions={
        <>
          {view !== 'timetable' && (
            <div className="flex items-center gap-1">
              <IconButton icon="chevronLeft" label={t(L('Назад', 'Previous'))} onClick={() => step(-1)} />
              <Button onClick={() => setAnchor(new Date())}>{t(S.today)}</Button>
              <IconButton icon="chevronRight" label={t(L('Напред', 'Next'))} onClick={() => step(1)} />
            </div>
          )}
          <Segmented
            value={view}
            onChange={setView}
            ariaLabel={t(L('Изглед', 'View'))}
            items={[
              { id: 'month', label: t(S.month) },
              { id: 'week', label: t(S.week) },
              { id: 'day', label: t(S.day) },
              { id: 'timetable', label: t(L('Програма', 'Timetable')) },
            ]}
          />
          <Button variant="primary" icon="plus" onClick={() => useApp.getState().setQuick('task')}>
            {t(S.add)}
          </Button>
        </>
      }
    >
      {view === 'month' && (
        <MonthView
          days={days}
          events={events}
          anchor={anchor}
          now={now}
          onOpenDay={setOpenDay}
          onDragTask={setDragging}
          onDrop={dropOn}
          dragging={dragging}
        />
      )}
      {view === 'week' && <WeekView days={days} events={events} now={now} onOpenDay={setOpenDay} onDrop={dropOn} onDragTask={setDragging} />}
      {view === 'day' && <DayView day={anchor} events={events.get(keyOf(anchor)) ?? []} now={now} />}
      {view === 'timetable' && (
        <div className="space-y-3">
          <p className="text-[12.5px] text-muted">
            {t(
              L(
                'Седмичната програма се повтаря всяка седмица и се показва във всички изгледи на календара.',
                'The weekly timetable repeats every week and shows up in every calendar view.',
              ),
            )}
          </p>
          <Timetable />
        </div>
      )}

      <Sheet
        open={!!openDay}
        onClose={() => setOpenDay(null)}
        title={openDay ? formatDate(openDay.getTime(), lang, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
      >
        {openDay && <DayView day={openDay} events={events.get(keyOf(openDay)) ?? []} now={now} inSheet />}
      </Sheet>
    </Screen>
  );
}

/* ---------------------------------------------------------------- month */

function MonthView({
  days,
  events,
  anchor,
  now,
  onOpenDay,
  onDragTask,
  onDrop,
  dragging,
}: {
  days: Date[];
  events: Map<string, CalEvent[]>;
  anchor: Date;
  now: number;
  onOpenDay: (d: Date) => void;
  onDragTask: (id: string | null) => void;
  onDrop: (d: Date) => void;
  dragging: string | null;
}) {
  const t = useT();
  const lang = useLang();
  const names = weekdayNames(lang);
  const [over, setOver] = useState<string | null>(null);

  return (
    <Card flush>
      <div className="grid grid-cols-7 border-b border-line">
        {names.map((n) => (
          <div key={n} className="t-label px-2 py-2 text-center">
            {n}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = keyOf(day);
          const list = events.get(key) ?? [];
          const other = day.getMonth() !== anchor.getMonth();
          const isToday = keyOf(now) === key;
          const isOver = over === key && dragging;
          return (
            <div
              key={key}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver((k) => (k === key ? null : k))}
              onDrop={() => {
                setOver(null);
                onDrop(day);
              }}
              onClick={() => onOpenDay(day)}
              className="min-h-[104px] cursor-pointer border-b border-r border-line p-1.5 transition-colors last-in-row:border-r-0 hover:bg-surface-2"
              style={{
                background: isOver
                  ? 'var(--c-accent-soft)'
                  : other
                    ? 'color-mix(in srgb, var(--c-surface-2) 60%, transparent)'
                    : undefined,
                opacity: other ? 0.62 : 1,
              }}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span
                  className={`t-num grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] ${
                    isToday ? 'font-semibold text-white' : 'text-muted'
                  }`}
                  style={isToday ? { background: 'var(--c-accent)' } : undefined}
                >
                  {day.getDate()}
                </span>
                {list.length > 3 && <span className="t-num text-[10px] text-faint">+{list.length - 3}</span>}
              </div>

              <div className="space-y-1">
                {list.slice(0, 3).map((event) => (
                  <EventChip key={event.id} event={event} onDragTask={onDragTask} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-4 py-2 text-[11.5px] text-faint">
        {t(L('Влачи задача върху друг ден, за да я пренасрочиш.', 'Drag a task onto another day to reschedule it.'))}
      </p>
    </Card>
  );
}

function EventChip({ event, onDragTask }: { event: CalEvent; onDragTask?: (id: string | null) => void }) {
  const draggable = event.kind === 'task' || event.kind === 'exam';
  return (
    <div
      draggable={draggable}
      onDragStart={() => onDragTask?.(event.refId)}
      onDragEnd={() => onDragTask?.(null)}
      className={`flex items-center gap-1.5 truncate rounded-[6px] px-1.5 py-[3px] text-[11px] ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={{
        background: `color-mix(in srgb, ${event.color} 13%, transparent)`,
        color: event.color,
        textDecoration: event.done ? 'line-through' : undefined,
        opacity: event.done ? 0.6 : 1,
      }}
      title={event.title}
    >
      {event.kind === 'exam' && <Icon name="graduation" size={10} strokeWidth={2.4} />}
      {event.kind === 'class' && <span className="badge-dot" style={{ background: event.color }} />}
      <span className="truncate">{event.title}</span>
    </div>
  );
}

/* ----------------------------------------------------------------- week */

function WeekView({
  days,
  events,
  now,
  onOpenDay,
  onDrop,
  onDragTask,
}: {
  days: Date[];
  events: Map<string, CalEvent[]>;
  now: number;
  onOpenDay: (d: Date) => void;
  onDrop: (d: Date) => void;
  onDragTask: (id: string | null) => void;
}) {
  const lang = useLang();
  const names = weekdayNames(lang);
  const hours = Array.from({ length: HOUR_TO - HOUR_FROM }, (_, i) => HOUR_FROM + i);
  const nowDate = new Date(now);
  const nowOffset = (nowDate.getHours() - HOUR_FROM + nowDate.getMinutes() / 60) * HOUR_PX;

  return (
    <Card flush className="overflow-x-auto">
      <div className="min-w-[760px]">
        {/* all-day row */}
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line">
          <div className="t-label px-2 py-2">{lang === 'bg' ? 'Цял ден' : 'All day'}</div>
          {days.map((day, i) => {
            const list = (events.get(keyOf(day)) ?? []).filter((e) => e.allDay);
            const isToday = keyOf(now) === keyOf(day);
            return (
              <div
                key={i}
                className="min-h-[52px] space-y-1 border-l border-line p-1.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(day)}
                style={isToday ? { background: 'var(--c-accent-soft)' } : undefined}
              >
                <button
                  onClick={() => onOpenDay(day)}
                  className="mb-1 flex w-full cursor-pointer items-baseline gap-1.5 px-0.5 text-left"
                >
                  <span className="t-label">{names[i]}</span>
                  <span className={`t-num text-[13px] ${isToday ? 'font-semibold text-accent' : ''}`}>
                    {day.getDate()}
                  </span>
                </button>
                {list.map((event) => (
                  <EventChip key={event.id} event={event} onDragTask={onDragTask} />
                ))}
              </div>
            );
          })}
        </div>

        {/* hour grid */}
        <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div>
            {hours.map((h) => (
              <div key={h} className="t-num relative text-[10.5px] text-faint" style={{ height: HOUR_PX }}>
                <span className="absolute -top-1.5 right-2">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {days.map((day, i) => {
            const list = (events.get(keyOf(day)) ?? []).filter((e) => !e.allDay);
            const isToday = keyOf(now) === keyOf(day);
            return (
              <div key={i} className="relative border-l border-line">
                {hours.map((h) => (
                  <div key={h} className="border-b border-line" style={{ height: HOUR_PX }} />
                ))}

                {isToday && nowOffset >= 0 && nowOffset <= hours.length * HOUR_PX && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowOffset }}>
                    <div className="h-px w-full" style={{ background: 'var(--c-danger)' }} />
                    <div
                      className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full"
                      style={{ background: 'var(--c-danger)' }}
                    />
                  </div>
                )}

                {list.map((event) => {
                  const start = new Date(event.start);
                  const top = (start.getHours() - HOUR_FROM + start.getMinutes() / 60) * HOUR_PX;
                  const minutes = event.end ? (event.end - event.start) / 60_000 : 45;
                  const height = Math.max(24, (minutes / 60) * HOUR_PX - 3);
                  if (top < -HOUR_PX) return null;
                  return (
                    <div
                      key={event.id}
                      className="absolute inset-x-1 overflow-hidden rounded-[8px] px-1.5 py-1 text-[11px]"
                      style={{
                        top: Math.max(0, top),
                        height,
                        background:
                          event.kind === 'session'
                            ? `color-mix(in srgb, ${event.color} 10%, transparent)`
                            : `color-mix(in srgb, ${event.color} 15%, transparent)`,
                        borderLeft: `2.5px solid ${event.color}`,
                        color: event.color,
                      }}
                    >
                      <div className="truncate font-medium">{event.title}</div>
                      <div className="t-num truncate opacity-75">
                        {clockTime(event.start, lang)}
                        {event.room ? ` · ${event.room}` : ''}
                        {event.minutes ? ` · ${event.minutes}′` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ day */

function DayView({
  events,
  now,
  inSheet,
}: {
  day: Date;
  events: CalEvent[];
  now: number;
  inSheet?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const items = usePlanner((s) => s.items);
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);

  return (
    <div className={inSheet ? '' : 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'}>
      <Card flush title={inSheet ? undefined : t(L('Часът по час', 'Hour by hour'))}>
        {timed.length === 0 ? (
          <EmptyState
            compact
            icon="clock"
            title={t(L('Нищо с час за този ден', 'Nothing scheduled by the hour'))}
            body={t(L('Часовете от седмичната програма и записаните сесии се показват тук.', 'Timetable classes and logged sessions appear here.'))}
          />
        ) : (
          <ul className="space-y-1 p-3">
            {timed.map((event) => {
              const live = event.start <= now && (event.end ?? event.start) > now;
              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3 rounded-[12px] p-2.5"
                  style={{
                    background: live ? 'var(--c-accent-soft)' : 'var(--c-surface-2)',
                    borderLeft: `3px solid ${event.color}`,
                  }}
                >
                  <span className="t-num w-[46px] shrink-0 text-[12px] text-muted">
                    {clockTime(event.start, lang)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{event.title}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                      {event.end ? `${Math.round((event.end - event.start) / 60_000)} ${t(L('мин', 'min'))}` : ''}
                      {event.room ? ` · ${event.room}` : ''}
                      {event.kind === 'session' ? ` · ${t(L('записана сесия', 'logged session'))}` : ''}
                    </span>
                  </span>
                  {live && (
                    <span className="chip shrink-0" style={{ background: 'var(--c-accent)', color: '#fff' }}>
                      {t(L('сега', 'now'))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card flush title={inSheet ? undefined : t(L('Срокове за деня', 'Due this day'))} className={inSheet ? 'mt-3' : ''}>
        {allDay.length === 0 ? (
          <EmptyState compact icon="checkCircle" title={t(L('Няма срокове', 'Nothing due'))} />
        ) : (
          <div className="px-2 py-2">
            {allDay.map((event) => {
              const item = items.find((i) => i.id === event.refId);
              return item ? <TaskRow key={event.id} item={item} dense /> : null;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
