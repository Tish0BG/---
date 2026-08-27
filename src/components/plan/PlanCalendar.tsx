import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlanner, startOfDay } from '@/state/plannerStore';
import { usePlanView } from '@/state/planViewStore';
import { useTimer } from '@/state/timerStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes } from '@/state/itemTypeStore';
import { useApp } from '@/state/appStore';
import { scopeItems } from './DayColumn';
import { useT, useLang, L, formatDate, clockTime } from '@/i18n';
import { useNow } from '../kit';
import { Icon } from '../Icon';
import { eventsForRange, keyOf, type CalEvent } from '../calendar/events';
import { DEFAULT_MINUTES, minutesToTime } from './planTime';

const HOUR_PX = 46;
const SNAP = 15;

/**
 * ────────────────────────────────────────────────── the day, to scale ──
 *
 * The columns say what you have promised. This says whether the promise fits
 * between the meetings — which is a different question, and the one a list on
 * its own can never answer. An afternoon with two lessons in it has four free
 * hours, not eight, and the only way to know that without doing arithmetic is
 * to see the lessons and the work on the same ruler.
 *
 * Dropping a card on the grid is the whole interaction: the task gets an hour
 * and takes up exactly as much room as its estimate claims. If the estimate
 * was a lie, the block overlaps something and says so immediately, which is
 * the cheapest possible moment to find out.
 */
export function PlanCalendar({ width = 300, onClose }: { width?: number; onClose?: () => void }) {
  const t = useT();
  const lang = useLang();
  const now = useNow(30_000);
  const anchor = usePlanView((s) => s.anchor);
  const allItems = usePlanner((s) => s.items);
  const filterSubject = useApp((s) => s.filterSubjectId);
  const filterKind = useApp((s) => s.planKind);
  /* The columns and the calendar are two readings of the same day; a filter
     that narrows one and not the other makes them disagree in front of the
     person. Lessons stay whatever the filter says — an immovable commitment
     does not belong to a channel. */
  const items = useMemo(
    () => scopeItems(allItems, filterSubject, filterKind),
    [allItems, filterSubject, filterKind],
  );
  const schedule = usePlanner((s) => s.schedule);
  const sessions = useTimer((s) => s.sessions);
  const subjects = useWorkspace((s) => s.subjects);
  const custom = useItemTypes((s) => s.custom);
  const scroller = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<number | null>(null);

  const day = startOfDay(new Date(anchor));
  const date = useMemo(() => new Date(day), [day]);

  const events = useMemo(
    () =>
      eventsForRange([date], { items, schedule, sessions, subjects, types: custom }, { includeSessions: true }).get(
        keyOf(date),
      ) ?? [],
    [date, items, schedule, sessions, subjects, custom],
  );

  const timed = events.filter((e) => !e.allDay);
  /**
   * Only what genuinely belongs to a *day* rather than to a list.
   *
   * Every planner entry without an hour is technically an all-day event, and
   * drawing all of them here would repeat the column standing six inches to
   * the left — the same eight titles twice, in a strip tall enough to push the
   * morning off the screen. A deadline is different: it is the one thing with
   * no hour that still has to be visible against the hours.
   */
  const allDay = events.filter((e) => e.allDay && e.kind === 'exam');
  const blocks = useMemo(() => laneOut(timed), [timed]);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const isToday = startOfDay(new Date(now)) === day;
  const nowTop = ((new Date(now).getHours() * 60 + new Date(now).getMinutes()) / 60) * HOUR_PX;

  /* Open on the working day rather than on midnight: eight rows of empty
     night is not what anybody scrolled here to read. */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = isToday ? Math.max(0, nowTop - 120) : 7 * HOUR_PX;
    el.scrollTop = target;
    // Only on a change of day — re-running on every tick would fight the
    // person's own scrolling once a minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  /** The minute of the day the pointer is over, snapped to a quarter hour. */
  const minuteAt = (clientY: number): number => {
    const box = grid.current?.getBoundingClientRect();
    if (!box) return 0;
    const raw = ((clientY - box.top) / HOUR_PX) * 60;
    return Math.max(0, Math.min(1439, Math.round(raw / SNAP) * SNAP));
  };

  const drop = (clientY: number) => {
    const id = usePlanView.getState().dragging;
    usePlanView.getState().setDragging(null);
    setGhost(null);
    if (!id) return;
    const item = usePlanner.getState().items.find((i) => i.id === id);
    if (!item) return;
    const minute = minuteAt(clientY);
    void usePlanner.getState().updateItem(id, {
      due: day,
      time: minutesToTime(minute),
      // A block with no length cannot be drawn, so dropping one on the grid is
      // also the moment it acquires an estimate.
      duration: item.duration && item.duration > 0 ? item.duration : DEFAULT_MINUTES,
    });
  };

  return (
    <aside
      className="flex min-h-0 shrink-0 flex-col border-l border-line"
      style={{ width }}
      aria-label={t(L('Календар', 'Calendar'))}
    >
      <header className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <Icon name="calendar" size={14} className="text-muted" />
        <span className="truncate text-[12.5px] font-semibold first-letter:uppercase">
          {formatDate(day, lang, { weekday: 'long', day: 'numeric', month: 'short' })}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            className="icon-btn h-6 w-6"
            aria-label={t(L('Предишен ден', 'Previous day'))}
            onClick={() => usePlanView.getState().shift(-1)}
          >
            <Icon name="chevronLeft" size={13} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            aria-label={t(L('Следващ ден', 'Next day'))}
            onClick={() => usePlanView.getState().shift(1)}
          >
            <Icon name="chevronRight" size={13} />
          </button>
          {onClose && (
            <button className="icon-btn h-6 w-6" aria-label={t(L('Скрий календара', 'Hide the calendar'))} onClick={onClose}>
              <Icon name="chevronsRight" size={13} />
            </button>
          )}
        </div>
      </header>

      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
          {allDay.map((e) => (
            <button
              key={e.id}
              onClick={() => e.kind !== 'class' && useApp.getState().openItem(e.refId)}
              className="max-w-full cursor-pointer truncate rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-medium"
              style={{
                background: `color-mix(in srgb, ${e.color} 14%, transparent)`,
                color: e.color,
                textDecoration: e.done ? 'line-through' : undefined,
              }}
            >
              {e.title}
            </button>
          ))}
        </div>
      )}

      <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative grid grid-cols-[42px_minmax(0,1fr)]"
          onDragOver={(e) => {
            if (!usePlanView.getState().dragging) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setGhost(minuteAt(e.clientY));
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setGhost(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(e.clientY);
          }}
        >
          <div>
            {hours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_PX }}>
                <span className="t-num absolute right-1.5 -top-[6px] text-[10px] text-faint">
                  {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          <div ref={grid} className="relative border-l border-line">
            {hours.map((h) => (
              <div key={h} className="border-b border-line" style={{ height: HOUR_PX }} />
            ))}

            {isToday && (
              <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                <div className="h-px w-full" style={{ background: 'var(--c-danger)' }} />
                <div
                  className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full"
                  style={{ background: 'var(--c-danger)' }}
                />
              </div>
            )}

            {blocks.map(({ event, lane, lanes }) => (
              <Block key={event.id} event={event} lane={lane} lanes={lanes} now={now} />
            ))}

            {ghost !== null && (
              <div
                className="pointer-events-none absolute inset-x-1 z-30 rounded-[6px] border border-dashed"
                style={{
                  top: (ghost / 60) * HOUR_PX,
                  height: (DEFAULT_MINUTES / 60) * HOUR_PX,
                  borderColor: 'var(--c-accent)',
                  background: 'var(--c-accent-soft)',
                }}
              >
                <span className="t-num px-1.5 text-[10px] font-semibold" style={{ color: 'var(--c-accent)' }}>
                  {minutesToTime(ghost)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-line px-3 py-2">
        <p className="text-[11px] leading-snug text-faint">
          {t(
            L(
              'Дръпни карта върху часа, в който ще я свършиш.',
              'Drag a card onto the hour you will actually do it.',
            ),
          )}
        </p>
      </footer>
    </aside>
  );
}

/* -------------------------------------------------------------- a block */

function Block({
  event,
  lane,
  lanes,
  now,
}: {
  event: CalEvent;
  lane: number;
  lanes: number;
  now: number;
}) {
  const begin = new Date(event.start);
  const top = ((begin.getHours() * 60 + begin.getMinutes()) / 60) * HOUR_PX;
  const minutes = event.end ? (event.end - event.start) / 60_000 : DEFAULT_MINUTES;
  const height = Math.max(20, (minutes / 60) * HOUR_PX - 2);
  const live = event.start <= now && (event.end ?? event.start) > now;
  const width = `calc((100% - 6px) / ${lanes})`;
  const movable = event.kind === 'task' || event.kind === 'exam';
  const lang = useLang();

  return (
    <div
      draggable={movable}
      onDragStart={(e) => {
        if (!movable) return;
        e.dataTransfer.setData('text/plain', event.refId);
        e.dataTransfer.effectAllowed = 'move';
        usePlanView.getState().setDragging(event.refId);
      }}
      onDragEnd={() => usePlanView.getState().setDragging(null)}
      onClick={() => movable && useApp.getState().openItem(event.refId)}
      className={`absolute z-10 overflow-hidden rounded-[6px] px-1.5 py-0.5 ${movable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
        top: Math.max(0, top),
        height,
        left: `calc(3px + ${lane} * ${width})`,
        width,
        background: `color-mix(in srgb, ${event.color} ${event.kind === 'session' ? 10 : 16}%, var(--c-surface))`,
        borderLeft: `2.5px solid ${event.color}`,
        color: event.color,
        boxShadow: live ? `0 0 0 1px ${event.color}` : undefined,
        opacity: event.done ? 0.55 : 1,
      }}
      title={event.title}
    >
      <div
        className="truncate text-[11px] font-medium leading-tight"
        style={{ textDecoration: event.done ? 'line-through' : undefined }}
      >
        {event.title}
      </div>
      {height >= 34 && (
        <div className="t-num truncate text-[10px] leading-tight opacity-75">
          {clockTime(event.start, lang)}
          {event.room ? ` · ${event.room}` : ''}
        </div>
      )}
    </div>
  );
}

/**
 * Side-by-side lanes for blocks that overlap in time.
 *
 * A copy of the calendar screen's own routine deliberately kept small and
 * local: it is eight lines, and importing it would have meant exporting a
 * private helper across a screen boundary for no gain.
 */
function laneOut(list: CalEvent[]): { event: CalEvent; lane: number; lanes: number }[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out: { event: CalEvent; lane: number; lanes: number }[] = [];
  let cluster: CalEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const ends: number[] = [];
    const placed = cluster.map((event) => {
      let lane = ends.findIndex((end) => end <= event.start);
      if (lane === -1) lane = ends.length;
      ends[lane] = event.end ?? event.start + DEFAULT_MINUTES * 60_000;
      return { event, lane };
    });
    for (const p of placed) out.push({ ...p, lanes: ends.length });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of sorted) {
    if (event.start >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.end ?? event.start + DEFAULT_MINUTES * 60_000);
  }
  flush();
  return out;
}
