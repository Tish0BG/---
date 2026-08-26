import type { ClassSlot, FocusSession, ItemType, PlannerItem, Subject } from '@/types';
import { toMinutes } from '@/state/plannerStore';
import { typeOf } from '@/state/itemTypeStore';
import { L, tr } from '@/i18n';

export type EventKind = 'class' | 'task' | 'exam' | 'session';

export interface CalEvent {
  id: string;
  kind: EventKind;
  title: string;
  color: string;
  subjectName: string | null;
  start: number;
  /** null for things that only have a day */
  end: number | null;
  allDay: boolean;
  done: boolean;
  /** the record it came from, for opening and for drag-and-drop */
  refId: string;
  priority?: 0 | 1 | 2;
  room?: string;
  minutes?: number;
  /** the planner type this came from, so the chip can wear its icon */
  typeId?: string;
  icon?: string;
}

export const dayStart = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const sameDay = (a: number, b: number): boolean => dayStart(new Date(a)) === dayStart(new Date(b));

export const keyOf = (d: Date | number): string => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** Monday-first grid of six weeks covering the month `anchor` sits in. */
export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Monday-first week containing `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * Everything that happens on a given set of days, from three different
 * records: the weekly timetable (recurring), planner items (a due date) and
 * finished focus sessions (history). They are one thing to the reader, so the
 * calendar makes them one type here rather than in three render paths.
 */
export function eventsForRange(
  days: Date[],
  input: {
    items: PlannerItem[];
    schedule: ClassSlot[];
    sessions: FocusSession[];
    subjects: Subject[];
    /** the invented types; the built-ins are constants */
    types?: ItemType[];
  },
  options: { includeSessions?: boolean } = {},
): Map<string, CalEvent[]> {
  const { items, schedule, sessions, subjects, types = [] } = input;
  const out = new Map<string, CalEvent[]>();
  const subjectOf = (id: string | null | undefined) => subjects.find((s) => s.id === id) ?? null;
  const push = (key: string, event: CalEvent) => out.set(key, [...(out.get(key) ?? []), event]);

  const from = dayStart(days[0]);
  const to = dayStart(days[days.length - 1]) + 86_400_000;

  for (const day of days) {
    const key = keyOf(day);
    const base = dayStart(day);
    for (const slot of schedule.filter((s) => s.day === day.getDay())) {
      const subject = subjectOf(slot.subjectId);
      push(key, {
        id: `cl-${slot.id}-${key}`,
        kind: 'class',
        // A slot whose subject has since been deleted, or that was saved
        // without one. It used to render as an em dash, which is fine as a
        // two-centimetre chip in the month grid and useless as a full row in
        // the agenda — a time, and a line saying nothing at all.
        title: subject?.name ?? tr(L('Час', 'Lesson')),
        color: subject?.color ?? 'var(--c-faint)',
        subjectName: subject?.name ?? null,
        start: base + toMinutes(slot.start) * 60_000,
        end: base + toMinutes(slot.end) * 60_000,
        allDay: false,
        done: false,
        refId: slot.id,
        room: slot.room,
      });
    }
  }

  for (const item of items) {
    if (item.due === null || item.due < from || item.due >= to) continue;
    const subject = subjectOf(item.subjectId);
    const type = typeOf(item.kind, types);
    // An entry with an hour on it belongs in the time grid beside the
    // lessons; one without belongs in the all-day strip above it. That is
    // the whole difference — everything else about the two is identical.
    const minutes = item.time ? toMinutes(item.time) : null;
    const start = minutes === null ? item.due : dayStart(new Date(item.due)) + minutes * 60_000;
    const length = item.duration && item.duration > 0 ? item.duration : 45;
    push(keyOf(item.due), {
      id: `pl-${item.id}`,
      kind: item.kind === 'exam' ? 'exam' : 'task',
      title: item.title,
      color: type.color ?? subject?.color ?? 'var(--c-brand)',
      subjectName: subject?.name ?? null,
      start,
      end: minutes === null ? null : start + length * 60_000,
      allDay: minutes === null,
      done: item.done,
      refId: item.id,
      priority: item.priority,
      typeId: type.id,
      icon: type.icon,
    });
  }

  if (options.includeSessions) {
    for (const session of sessions) {
      if (session.startedAt < from || session.startedAt >= to) continue;
      const subject = subjectOf(session.subjectId);
      push(keyOf(session.startedAt), {
        id: `fs-${session.id}`,
        kind: 'session',
        title: subject?.name ?? 'Focus',
        color: 'var(--c-aurora)',
        subjectName: subject?.name ?? null,
        start: session.startedAt,
        end: session.startedAt + session.minutes * 60_000,
        allDay: false,
        done: true,
        refId: session.id,
        minutes: session.minutes,
      });
    }
  }

  for (const [, list] of out) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
  }
  return out;
}

/* ------------------------------------------------------------- filtering */

/**
 * What can be narrowed down, and it is deliberately not "colour, tag,
 * category".
 *
 * Those three are what a generic calendar offers when it knows nothing about
 * what is in it. This one knows exactly what is in it — lessons, deadlines,
 * exams and logged focus time, each already attached to a subject and a type
 * — so the filters are those real dimensions. A colour filter would be a
 * worse spelling of the subject filter, since the colour *is* the subject.
 */
export interface CalFilters {
  /** matches the title, the subject and the room */
  query: string;
  /** subject ids; empty means every subject */
  subjects: string[];
  kinds: EventKind[];
  status: EventStatus[];
}

export type EventStatus = 'open' | 'done' | 'overdue';

export const EMPTY_FILTERS: CalFilters = { query: '', subjects: [], kinds: [], status: [] };

export const hasFilters = (f: CalFilters): boolean =>
  f.query.trim().length > 0 || f.subjects.length > 0 || f.kinds.length > 0 || f.status.length > 0;

/** How many separate narrowings are active, for the count on the button. */
export const filterCount = (f: CalFilters): number =>
  f.subjects.length + f.kinds.length + f.status.length;

/**
 * Where a single event stands.
 *
 * A lesson and a logged session are never "open" or "overdue" — one repeats
 * every week and the other already happened — so only the two kinds that can
 * actually be owed get a status at all.
 */
export function statusOf(event: CalEvent, now: number): EventStatus | null {
  if (event.kind === 'class' || event.kind === 'session') return null;
  if (event.done) return 'done';
  return event.start < dayStart(new Date(now)) ? 'overdue' : 'open';
}

export function matchesFilters(event: CalEvent, f: CalFilters, now: number, subjects: Subject[]): boolean {
  const query = f.query.trim().toLowerCase();
  if (query) {
    const haystack = [event.title, event.subjectName ?? '', event.room ?? ''].join(' ').toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (f.subjects.length > 0) {
    // The event carries the subject's name rather than its id — three sources
    // feed this list and only one of them has an id to hand — so the chosen
    // ids are resolved to names once, here.
    const names = f.subjects.map((id) => subjects.find((s) => s.id === id)?.name).filter(Boolean);
    if (!event.subjectName || !names.includes(event.subjectName)) return false;
  }

  if (f.kinds.length > 0 && !f.kinds.includes(event.kind)) return false;

  if (f.status.length > 0) {
    const status = statusOf(event, now);
    if (!status || !f.status.includes(status)) return false;
  }

  return true;
}

/** The same map, with everything that does not match removed. */
export function filterEvents(
  events: Map<string, CalEvent[]>,
  f: CalFilters,
  now: number,
  subjects: Subject[],
): Map<string, CalEvent[]> {
  if (!hasFilters(f)) return events;
  const out = new Map<string, CalEvent[]>();
  for (const [key, list] of events) {
    const kept = list.filter((e) => matchesFilters(e, f, now, subjects));
    if (kept.length) out.set(key, kept);
  }
  return out;
}
