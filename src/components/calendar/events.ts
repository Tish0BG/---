import type { ClassSlot, FocusSession, ItemType, PlannerItem, Subject } from '@/types';
import { toMinutes } from '@/state/plannerStore';
import { typeOf } from '@/state/itemTypeStore';

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
        title: subject?.name ?? '—',
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
