import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes } from '@/state/itemTypeStore';
import { usePlanner, startOfDay } from '@/state/plannerStore';
import { useTimer } from '@/state/timerStore';
import { useT, L, useLang, monthTitle, weekdayNames, clockTime, shortDate, formatDate } from '@/i18n';
import { S } from '@/i18n/strings';
import { Screen } from '../shell/Screen';
import { Icon } from '../Icon';
import { Button, Card, EmptyState, IconButton, Segmented, Sheet, useIsPhone, useNow } from '../kit';
import { TaskRow } from '../tasks/TaskRow';
import { eventsForRange, keyOf, monthGrid, weekDays, type CalEvent } from './events';
import { AgendaView } from './AgendaView';

type View = 'month' | 'week' | 'day' | 'agenda';

const HOUR_FROM = 7;
const HOUR_TO = 22;
const HOUR_PX = 52;
/** What the shortest drawable block is worth in minutes, at `HOUR_PX`. */
const MIN_BLOCK_MINUTES = 32;

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
  const types = useItemTypes((s) => s.custom);

  const [view, setView] = useState<View>(phone ? 'agenda' : 'month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const openItemId = useApp((s) => s.openItemId);

  /**
   * On a phone the entry window is a sheet, and so is the day drawer — and a
   * sheet sits above a sheet. Opening a record from inside the drawer would
   * otherwise leave two of them stacked, with the one you asked for behind
   * the one you asked for it from.
   */
  useEffect(() => {
    if (openItemId) setOpenDay(null);
  }, [openItemId]);
  const [dragging, setDragging] = useState<string | null>(null);

  const days = useMemo(
    () =>
      view === 'month' || view === 'agenda'
        ? monthGrid(anchor)
        : view === 'week'
          ? weekDays(anchor)
          : [anchor],
    [view, anchor],
  );

  const events = useMemo(
    () => eventsForRange(days, { items, schedule, sessions, subjects, types }, { includeSessions: view !== 'month' }),
    // `lang` because a lesson with no subject is labelled in words.
    [days, items, schedule, sessions, subjects, types, view, lang],
  );

  const step = (dir: number) => {
    const next = new Date(anchor);
    if (view === 'month' || view === 'agenda') next.setMonth(next.getMonth() + dir);
    else if (view === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setDate(next.getDate() + dir);
    setAnchor(next);
  };

  const title =
    view === 'month' || view === 'agenda'
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
          <div className="flex items-center gap-1">
            <IconButton icon="chevronLeft" label={t(L('Назад', 'Previous'))} onClick={() => step(-1)} />
            <Button onClick={() => setAnchor(new Date())}>{t(S.today)}</Button>
            <IconButton icon="chevronRight" label={t(L('Напред', 'Next'))} onClick={() => step(1)} />
          </div>
          <Segmented
            value={view}
            onChange={setView}
            ariaLabel={t(L('Изглед', 'View'))}
            items={[
              { id: 'month', label: t(S.month) },
              { id: 'week', label: t(S.week) },
              { id: 'day', label: t(S.day) },
              { id: 'agenda', label: t(L('Списък', 'List')) },
            ]}
          />
          <Button variant="primary" icon="plus" onClick={() => useApp.getState().setQuick('item', 'task')}>
            {t(S.add)}
          </Button>
        </>
      }
    >
      {view === 'agenda' && <AgendaView events={events} days={days} now={now} onOpenDay={setOpenDay} />}

      {view === 'month' && (
        <MonthView
          days={days}
          events={events}
          anchor={anchor}
          now={now}
          phone={phone}
          onOpenDay={setOpenDay}
          onDragTask={setDragging}
          onDrop={dropOn}
          dragging={dragging}
        />
      )}
      {view === 'week' && <WeekView days={days} events={events} now={now} onOpenDay={setOpenDay} onDrop={dropOn} onDragTask={setDragging} />}
      {view === 'day' && <DayView day={anchor} events={events.get(keyOf(anchor)) ?? []} now={now} />}

      <Sheet
        open={!!openDay}
        onClose={() => setOpenDay(null)}
        title={openDay ? formatDate(openDay.getTime(), lang, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
      >
        {openDay && (
          <DayView day={openDay} events={events.get(keyOf(openDay)) ?? []} now={now} inSheet />
        )}
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
  phone,
}: {
  days: Date[];
  events: Map<string, CalEvent[]>;
  anchor: Date;
  now: number;
  onOpenDay: (d: Date) => void;
  onDragTask: (id: string | null) => void;
  onDrop: (d: Date) => void;
  dragging: string | null;
  phone: boolean;
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
              className={`min-w-0 cursor-pointer overflow-hidden border-b border-r border-line p-1.5 transition-colors last-in-row:border-r-0 hover:bg-surface-2 ${
                phone ? 'min-h-[58px]' : 'min-h-[104px]'
              }`}
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
                    isToday ? 'font-semibold' : 'text-muted'
                  }`}
                  style={
                    isToday ? { background: 'var(--c-accent)', color: 'var(--c-accent-text)' } : undefined
                  }
                >
                  {day.getDate()}
                </span>
                {list.length > (phone ? 4 : 3) && (
                  <span className="t-num text-[10px] text-faint">+{list.length - (phone ? 4 : 3)}</span>
                )}
              </div>

              {/*
                Seven columns across 375 px leaves about 48 px a cell, and a
                chip that narrow fits one letter and a full stop — "Математика"
                became "М.". A label nobody can read is worse than no label, so
                the phone gets a row of dots: how many things, in which
                subjects, and tap the day to read them.
              */}
              {phone ? (
                <div className="flex flex-wrap gap-1 px-0.5">
                  {list.slice(0, 4).map((event) => (
                    <span
                      key={event.id}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: event.color, opacity: event.done ? 0.4 : 1 }}
                    />
                  ))}
                </div>
              ) : (
                <div className="min-w-0 space-y-1">
                  {list.slice(0, 3).map((event) => (
                    <EventChip key={event.id} event={event} onDragTask={onDragTask} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!phone && (
        <p className="px-4 py-2 text-[11.5px] text-faint">
          {t(L('Влачи задача върху друг ден, за да я пренасрочиш.', 'Drag a task onto another day to reschedule it.'))}
        </p>
      )}
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
      /**
       * `min-w-0` is the whole fix, and it is not optional.
       *
       * A flex item will not shrink below the intrinsic width of its content
       * unless it is told it may. So `truncate` on the label did nothing: the
       * chip grew to fit the longest word and the text ran straight out of the
       * day cell and across the one beside it. `truncate` on this container
       * could not help either — it clips, but the container had already been
       * stretched by the child.
       */
      className={`flex min-w-0 items-center gap-1.5 overflow-hidden rounded-[6px] px-1.5 py-[3px] text-[11px] ${
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
      {event.kind === 'exam' && <Icon name="graduation" size={10} strokeWidth={2.4} className="shrink-0" />}
      {event.kind === 'class' && (
        <span className="badge-dot shrink-0" style={{ background: event.color }} />
      )}
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
    </div>
  );
}

/**
 * Overlapping events, side by side.
 *
 * A single day column is narrow enough that two things at the same hour would
 * otherwise be drawn on top of each other — the second one's title sitting
 * across the first one's, which is exactly the "letters landing in the wrong
 * cell" this is here to stop. Each event takes the leftmost lane whose
 * previous occupant has already finished.
 */
function laneOut(list: CalEvent[]): { event: CalEvent; lane: number; lanes: number }[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const ends: number[] = [];
  const placed = sorted.map((event) => {
    /**
     * The floor matters, and it is the reason a first attempt at this still
     * produced overlaps.
     *
     * A block is never drawn shorter than about 26 px, or its title would not
     * fit — which is roughly half an hour at this scale. So a ten-minute
     * session at 18:00 occupies the screen down to 18:30 even though it ends
     * at 18:10, and the next session at 18:20 does not clash *in time* while
     * clashing very visibly *on screen*. Lanes have to be assigned against
     * what is drawn, not against what is stored.
     */
    const drawnEnd = Math.max(event.end ?? 0, event.start + MIN_BLOCK_MINUTES * 60_000);
    const finish = drawnEnd;
    let lane = ends.findIndex((end) => end <= event.start);
    if (lane === -1) {
      lane = ends.length;
      ends.push(finish);
    } else {
      ends[lane] = finish;
    }
    return { event, lane };
  });
  // Every block in a day shares one lane count, so the columns line up
  // instead of each event choosing its own width.
  const lanes = Math.max(1, ends.length);
  return placed.map((p) => ({ ...p, lanes }));
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
                className="min-h-[52px] min-w-0 space-y-1 overflow-hidden border-l border-line p-1.5"
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
                {/* Down, not up. At `-top-1.5` the 07:00 label hung above the
                    grid and was clipped by the card's own rounded corner. */}
                <span className="absolute right-2 top-1">{String(h).padStart(2, '0')}:00</span>
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

                {/* Same lanes as the day grid. Two focus sessions logged in the
                    same hour used to be drawn at `inset-x-1` on top of each
                    other, so the second one's title sat across the first — one
                    block of overlapping letters, which is precisely the thing
                    that looked broken. */}
                {laneOut(list).map(({ event, lane, lanes }) => {
                  const start = new Date(event.start);
                  const top = (start.getHours() - HOUR_FROM + start.getMinutes() / 60) * HOUR_PX;
                  const minutes = event.end ? (event.end - event.start) / 60_000 : 45;
                  const height = Math.max(24, (minutes / 60) * HOUR_PX - 3);
                  if (top < -HOUR_PX) return null;
                  const width = `calc((100% - 8px) / ${lanes})`;
                  return (
                    <div
                      key={event.id}
                      title={event.title}
                      className="absolute overflow-hidden rounded-[8px] px-1.5 py-1 text-[11px]"
                      style={{
                        top: Math.max(0, top),
                        left: `calc(4px + ${lane} * ${width})`,
                        width,
                        height,
                        background: `color-mix(in srgb, ${event.color} ${
                          event.kind === 'session' ? 10 : 15
                        }%, var(--c-surface))`,
                        borderLeft: `2.5px solid ${event.color}`,
                        color: event.color,
                      }}
                    >
                      <div className="truncate font-medium leading-tight">{event.title}</div>
                      {height >= 40 && (
                        <div className="t-num truncate leading-tight opacity-75">
                          {clockTime(event.start, lang)}
                          {event.room ? ` · ${event.room}` : ''}
                          {event.minutes ? ` · ${event.minutes}′` : ''}
                        </div>
                      )}
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
  day,
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

  const hours = Array.from({ length: HOUR_TO - HOUR_FROM }, (_, i) => HOUR_FROM + i);
  const nowDate = new Date(now);
  const isToday = keyOf(now) === keyOf(day);
  const nowOffset = (nowDate.getHours() - HOUR_FROM + nowDate.getMinutes() / 60) * HOUR_PX;
  const blocks = useMemo(() => laneOut(timed), [timed]);

  return (
    <div className={inSheet ? '' : 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'}>
      <Card flush title={inSheet ? undefined : t(L('Часът по час', 'Hour by hour'))}>
        {/* The same grid the week view draws, one column wide. A day that
            reads as a list and a week that reads as a timetable are two
            different mental models for the same records. */}
        <div className="relative grid grid-cols-[52px_minmax(0,1fr)]">
          <div>
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_PX }}>
                {/* Nudged down rather than up: the first label used to sit
                    above the grid's own top edge and clip against the card. */}
                <span className="t-num absolute right-2 top-1 text-[10.5px] text-faint">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          <div className="relative border-l border-line">
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

            {blocks.map(({ event, lane, lanes }) => {
              const begin = new Date(event.start);
              const top = (begin.getHours() - HOUR_FROM + begin.getMinutes() / 60) * HOUR_PX;
              const minutes = event.end ? (event.end - event.start) / 60_000 : 45;
              const height = Math.max(26, (minutes / 60) * HOUR_PX - 3);
              if (top + height < 0) return null;
              const live = event.start <= now && (event.end ?? event.start) > now;
              const width = `calc((100% - 8px) / ${lanes})`;
              return (
                <div
                  key={event.id}
                  className="absolute overflow-hidden rounded-[8px] px-2 py-1"
                  style={{
                    top: Math.max(0, top),
                    height,
                    left: `calc(4px + ${lane} * ${width})`,
                    width,
                    background: `color-mix(in srgb, ${event.color} ${event.kind === 'session' ? 10 : 15}%, var(--c-surface))`,
                    borderLeft: `2.5px solid ${event.color}`,
                    color: event.color,
                    boxShadow: live ? `0 0 0 1px ${event.color}` : undefined,
                  }}
                  title={event.title}
                >
                  <div className="truncate text-[12px] font-medium leading-tight">{event.title}</div>
                  {/* Only when the block is tall enough to hold a second line;
                      squeezing one into 26 px is how text ends up crossing the
                      border into the hour below. */}
                  {height >= 40 && (
                    <div className="t-num truncate text-[10.5px] leading-tight opacity-75">
                      {clockTime(event.start, lang)}
                      {event.room ? ` · ${event.room}` : ''}
                      {event.minutes ? ` · ${event.minutes}′` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {timed.length === 0 && (
          <p className="border-t border-line px-4 py-3 text-[12px] text-faint">
            {t(
              L(
                'Няма нищо с час за този ден. Часовете от програмата и записаните сесии се показват тук.',
                'Nothing scheduled by the hour. Timetable classes and logged sessions appear here.',
              ),
            )}
          </p>
        )}
      </Card>

      <Card flush title={inSheet ? undefined : t(L('Срокове за деня', 'Due this day'))} className={inSheet ? 'mt-3' : ''}>
        {allDay.length === 0 ? (
          <EmptyState compact icon="checkCircle" title={t(L('Няма срокове', 'Nothing due'))} />
        ) : (
          <div className="px-2 py-2">
            {allDay.map((event) => {
              const item = items.find((i) => i.id === event.refId);
              return item ? (
                <TaskRow key={event.id} item={item} dense />
              ) : null;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
