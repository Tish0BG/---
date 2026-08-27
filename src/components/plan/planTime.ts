import type { FocusSession, PlannerItem } from '@/types';
import { startOfDay } from '@/state/plannerStore';

/**
 * ───────────────────────────────────────────── the arithmetic of a day ──
 *
 * A day planner is mostly one sum done over and over: how many minutes have
 * been promised to this day, and how many are actually left in it. Every
 * column header, every capacity bar and every ritual asks the same question,
 * so it is answered once here rather than four times in four components that
 * will disagree with each other by the third release.
 */

/** The one local-day key in the product; re-exported here for the plan's own use. */
export { dayKey } from '@/lib/util';

/** The midnight a `dayKey` names, back as a timestamp. */
export function fromDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

/** ISO week, `2026-W35`, so a weekly ritual has somewhere to live. */
export function weekKey(d: Date | number = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Thursday of the same week decides the year, which is the whole point of
  // the ISO rule: 1 January can belong to the last week of the year before.
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const first = new Date(x.getFullYear(), 0, 4);
  const week =
    1 + Math.round(((x.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getDay() + 6) % 7)) / 7);
  return `${x.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Monday of the week `d` falls in. */
export function startOfWeek(d: Date | number = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

/**
 * `6:00`, `0:30` — minutes as a clock, the way a planner writes a workload.
 *
 * Deliberately not `formatDuration`. That one writes prose ("2 ч 15 мин"),
 * which is right in a sentence and far too wide for the corner of a column
 * header where this number has to sit beside a weekday.
 */
export function clockMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** 870 → `"14:30"`, wrapped into the day so a drag past midnight cannot break it. */
export function minutesToTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** How long an entry is expected to take. Unset reads as the default block. */
export const DEFAULT_MINUTES = 30;

export const plannedOf = (item: PlannerItem): number =>
  item.duration && item.duration > 0 ? item.duration : 0;

/** The sum of what a list has promised, in minutes. */
export const plannedTotal = (items: PlannerItem[]): number =>
  items.reduce((sum, item) => sum + plannedOf(item), 0);

/**
 * Minutes actually spent on an entry, read off the focus log.
 *
 * The planner's own `pomodoros` counts blocks, not time, and a block is
 * whatever length the settings say this week — so a number derived from it
 * would quietly change meaning when somebody moves the slider. The sessions
 * carry real minutes; those are what "actual" means.
 */
export function actualMinutes(itemId: string, sessions: FocusSession[]): number {
  let total = 0;
  for (const s of sessions) if (s.taskId === itemId) total += s.minutes;
  return total;
}

/** The same sum for a whole day's worth of entries. */
export function actualTotal(items: PlannerItem[], sessions: FocusSession[]): number {
  const ids = new Set(items.map((i) => i.id));
  let total = 0;
  for (const s of sessions) if (s.taskId && ids.has(s.taskId)) total += s.minutes;
  return total;
}

/** Everything filed under one calendar day, open and done alike, in hand order. */
export function itemsOfDay(items: PlannerItem[], day: number): PlannerItem[] {
  const from = startOfDay(new Date(day));
  const to = from + 86_400_000;
  return items
    .filter((i) => i.due !== null && i.due >= from && i.due < to)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);
}

/** A run of consecutive days starting at `anchor`. */
export function dayRange(anchor: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    out.push(startOfDay(d));
  }
  return out;
}
