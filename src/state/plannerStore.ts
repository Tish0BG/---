import { create } from 'zustand';
import type { ClassSlot, Grade, PlannerItem, RepeatRule, TaskMethod, TaskStep } from '@/types';
import { repo } from '@/services/storageService';
import { uid } from '@/lib/util';
import { announceProgress } from '@/services/progressBus';

/** Midnight of the given day, the boundary every "due today" test uses. */
export const startOfDay = (d = new Date()): number => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export const endOfDay = (d = new Date()): number => startOfDay(d) + 86_400_000 - 1;

export const addDays = (days: number, from = new Date()): Date => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
};

interface PlannerStore {
  items: PlannerItem[];
  grades: Grade[];
  schedule: ClassSlot[];
  loaded: boolean;

  init(): Promise<void>;

  addItem(patch: Partial<PlannerItem>): Promise<PlannerItem>;
  updateItem(id: string, patch: Partial<PlannerItem>): Promise<void>;
  toggleItem(id: string): Promise<void>;
  removeItem(id: string): Promise<void>;
  /** puts a deleted entry back exactly as it was, for undo */
  restoreItems(items: PlannerItem[]): Promise<void>;
  /** returns what it threw away, so the toast can offer it back */
  clearCompleted(): Promise<PlannerItem[]>;
  /** credits a finished focus session to an item */
  addPomodoro(id: string): Promise<void>;

  /** moves an entry onto a day, keeping the hour it already had */
  moveTo(id: string, day: number | null): Promise<void>;
  /** how the entry gets finished: tick, list, counter or timer */
  setMethod(id: string, method: TaskMethod): Promise<void>;
  addStep(id: string, title: string): Promise<void>;
  toggleStep(id: string, stepId: string): Promise<void>;
  removeStep(id: string, stepId: string): Promise<void>;
  /** counted entries: +1 / −1 straight on the row */
  bump(id: string, delta: number): Promise<void>;
  /** hand ordering inside a lane, used by drag and drop */
  reorder(id: string, beforeId: string | null): Promise<void>;

  addGrade(patch: Partial<Grade>): Promise<void>;
  updateGrade(id: string, patch: Partial<Grade>): Promise<void>;
  removeGrade(id: string): Promise<void>;

  addSlot(patch: Partial<ClassSlot>): Promise<void>;
  updateSlot(id: string, patch: Partial<ClassSlot>): Promise<void>;
  removeSlot(id: string): Promise<void>;
}

export const usePlanner = create<PlannerStore>((set, get) => ({
  items: [],
  grades: [],
  schedule: [],
  loaded: false,

  async init() {
    const [items, grades, schedule] = await Promise.all([
      repo.listPlanner(),
      repo.listGrades(),
      repo.listSchedule(),
    ]);
    set({ items, grades, schedule, loaded: true });
  },

  async addItem(patch) {
    const now = Date.now();
    const item: PlannerItem = {
      id: uid('pl_'),
      kind: 'task',
      title: '',
      notes: '',
      subjectId: null,
      docId: null,
      due: null,
      done: false,
      completedAt: null,
      priority: 0,
      pomodoros: 0,
      method: 'check',
      steps: [],
      count: 0,
      target: 0,
      remindAt: null,
      remindedAt: null,
      repeat: 'none',
      order: get().items.length,
      createdAt: now,
      updatedAt: now,
      ...patch,
    };
    await repo.putPlanner([item]);
    set((s) => ({ items: [...s.items, item] }));
    return item;
  },

  async updateItem(id, patch) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: Date.now() };
    await repo.putPlanner([next]);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? next : i)) }));
  },

  async toggleItem(id) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    const done = !current.done;

    /* A repeating entry is not finished when it is ticked — it is *done for
       now*. Ticking it rolls it forward to its next occurrence instead of
       burying it in the completed pile, which is the only behaviour that
       makes "take the pills" or "Friday's shop" survive a second week. */
    if (done && current.repeat && current.repeat !== 'none') {
      const next = nextOccurrence(current.due ?? Date.now(), current.repeat);
      await get().updateItem(id, {
        due: next,
        done: false,
        completedAt: null,
        count: 0,
        steps: (current.steps ?? []).map((x) => ({ ...x, done: false })),
        remindAt: current.remindAt === null || current.remindAt === undefined
          ? null
          : shiftClock(current.remindAt, current.due ?? next, next),
        remindedAt: null,
      });
      announceProgress();
      return;
    }

    await get().updateItem(id, { done, completedAt: done ? Date.now() : null });
    announceProgress();
  },

  async removeItem(id) {
    await repo.deletePlanner([id]);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  async restoreItems(items) {
    if (!items.length) return;
    /**
     * Undo has to undo the *deletion*, not merely write the record again.
     *
     * A delete leaves a tombstone so that other devices learn about it. Put
     * the record back without clearing that tombstone and the next sync
     * dutifully carries out the deletion the person just took back — locally
     * present, remotely gone, and gone again on the next pull. The stamp is
     * fresh for the same reason: the restored copy has to outrank whatever
     * the cloud still believes.
     */
    const now = Date.now();
    const restored = items.map((i) => ({ ...i, updatedAt: now }));
    await repo.putPlanner(restored);
    await repo.clearTombstones(restored.map((i) => `planner:${i.id}`));
    set((s) => ({
      items: [...s.items.filter((i) => !restored.some((x) => x.id === i.id)), ...restored],
    }));
  },

  async clearCompleted() {
    const gone = get().items.filter((i) => i.done);
    await repo.deletePlanner(gone.map((i) => i.id));
    set((s) => ({ items: s.items.filter((i) => !i.done) }));
    return gone;
  },

  async addPomodoro(id) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    await get().updateItem(id, { pomodoros: current.pomodoros + 1 });
  },

  async moveTo(id, day) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    await get().updateItem(id, {
      due: day === null ? null : startOfDay(new Date(day)),
      // Pulling something into today should not resurrect a reminder that
      // belonged to the old date; the hour of the day is kept, the day is not.
      remindAt:
        current.remindAt && day !== null
          ? shiftClock(current.remindAt, current.due ?? current.remindAt, startOfDay(new Date(day)))
          : day === null
            ? null
            : current.remindAt ?? null,
      remindedAt: null,
    });
  },

  async setMethod(id, method) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    await get().updateItem(id, {
      method,
      steps: method === 'checklist' ? (current.steps ?? []) : current.steps,
      target:
        method === 'count' && !current.target ? 3 : method === 'timer' && !current.target ? 1 : current.target,
    });
  },

  async addStep(id, title) {
    const current = get().items.find((i) => i.id === id);
    const clean = title.trim();
    if (!current || !clean) return;
    const step: TaskStep = { id: uid('st_'), title: clean, done: false };
    await get().updateItem(id, { steps: [...(current.steps ?? []), step], method: 'checklist' });
  },

  async toggleStep(id, stepId) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    const steps = (current.steps ?? []).map((x) => (x.id === stepId ? { ...x, done: !x.done } : x));
    await get().updateItem(id, { steps });
    // A list whose last box is ticked is a finished entry; saying so twice —
    // once on the step, once on the entry — is a chore nobody should do.
    if (steps.length && steps.every((x) => x.done) && !current.done) await get().toggleItem(id);
    else announceProgress();
  },

  async removeStep(id, stepId) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    await get().updateItem(id, { steps: (current.steps ?? []).filter((x) => x.id !== stepId) });
  },

  async bump(id, delta) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    const target = current.target || 1;
    const count = Math.max(0, Math.min(target, (current.count ?? 0) + delta));
    await get().updateItem(id, { count });
    if (count >= target && !current.done) await get().toggleItem(id);
    else if (count < target && current.done) await get().toggleItem(id);
    else announceProgress();
  },

  async reorder(id, beforeId) {
    const list = [...get().items].sort((a, b) => a.order - b.order);
    const from = list.findIndex((i) => i.id === id);
    if (from < 0) return;
    const [moved] = list.splice(from, 1);
    const at = beforeId === null ? list.length : list.findIndex((i) => i.id === beforeId);
    list.splice(at < 0 ? list.length : at, 0, moved);
    const touched = list
      .map((item, index) => ({ ...item, order: index, updatedAt: Date.now() }))
      .filter((item, index) => get().items.find((i) => i.id === item.id)?.order !== index);
    if (!touched.length) return;
    await repo.putPlanner(touched);
    set((s) => ({
      items: s.items.map((i) => touched.find((x) => x.id === i.id) ?? i),
    }));
  },

  async addGrade(patch) {
    const grade: Grade = {
      id: uid('gr_'),
      subjectId: '',
      label: '',
      value: 6,
      weight: 1,
      date: Date.now(),
      note: '',
      ...patch,
    };
    await repo.putGrade(grade);
    set((s) => ({ grades: [...s.grades, grade] }));
  },

  async updateGrade(id, patch) {
    const current = get().grades.find((g) => g.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    await repo.putGrade(next);
    set((s) => ({ grades: s.grades.map((g) => (g.id === id ? next : g)) }));
  },

  async removeGrade(id) {
    await repo.deleteGrade(id);
    set((s) => ({ grades: s.grades.filter((g) => g.id !== id) }));
  },

  async addSlot(patch) {
    const slot: ClassSlot = {
      id: uid('cl_'),
      subjectId: '',
      day: 1,
      start: '08:00',
      end: '08:45',
      room: '',
      ...patch,
    };
    await repo.putSlot(slot);
    set((s) => ({ schedule: [...s.schedule, slot] }));
  },

  async updateSlot(id, patch) {
    const current = get().schedule.find((x) => x.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    await repo.putSlot(next);
    set((s) => ({ schedule: s.schedule.map((x) => (x.id === id ? next : x)) }));
  },

  async removeSlot(id) {
    await repo.deleteSlot(id);
    set((s) => ({ schedule: s.schedule.filter((x) => x.id !== id) }));
  },
}));

/* ------------------------------------------------------------ recurrence */

/** The day a repeating entry comes back, counted from the one just ticked. */
export function nextOccurrence(from: number, rule: RepeatRule, now = Date.now()): number {
  // Counting from the old due date keeps a weekly entry on its weekday even
  // when it is ticked late; counting from today would let it drift.
  let base = startOfDay(new Date(Math.max(from, 0)));
  const floor = startOfDay(new Date(now));
  let guard = 0;
  do {
    const d = new Date(base);
    if (rule === 'daily') d.setDate(d.getDate() + 1);
    else if (rule === 'weekdays') {
      do d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6);
    } else if (rule === 'weekly') d.setDate(d.getDate() + 7);
    else if (rule === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (rule === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else return base;
    base = startOfDay(d);
  } while (base <= floor && ++guard < 400);
  return base;
}

/** Keeps the hour of `stamp` but moves it from the day of `from` to `to`. */
export function shiftClock(stamp: number, from: number, to: number): number {
  const offset = stamp - startOfDay(new Date(from));
  return startOfDay(new Date(to)) + offset;
}

/* --------------------------------------------------------------- selectors */

export const openItems = (items: PlannerItem[]): PlannerItem[] => items.filter((i) => !i.done);

/** Overdue first, then by due date; undated work sinks to the bottom. */
export function sortByDue(items: PlannerItem[]): PlannerItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due === null && b.due === null) return b.priority - a.priority || a.order - b.order;
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due - b.due;
  });
}

export const dueToday = (items: PlannerItem[]): PlannerItem[] =>
  openItems(items).filter((i) => i.due !== null && i.due >= startOfDay() && i.due <= endOfDay());

export const overdue = (items: PlannerItem[]): PlannerItem[] =>
  openItems(items).filter((i) => i.due !== null && i.due < startOfDay());

/** How much of one entry is behind it, 0..1 — steps ticked, repetitions done. */
export function itemProgress(item: PlannerItem): number {
  if (item.done) return 1;
  if (item.method === 'checklist') {
    const steps = item.steps ?? [];
    return steps.length ? steps.filter((x) => x.done).length / steps.length : 0;
  }
  if (item.method === 'count') return Math.min(1, (item.count ?? 0) / (item.target || 1));
  if (item.method === 'timer' && item.target) return Math.min(1, item.pomodoros / item.target);
  return 0;
}

/** Entries carrying a reminder that has not been delivered yet. */
export const withReminders = (items: PlannerItem[]): PlannerItem[] =>
  openItems(items)
    .filter((i) => typeof i.remindAt === 'number' && i.remindAt !== null)
    .sort((a, b) => (a.remindAt ?? 0) - (b.remindAt ?? 0));

export const upcomingExams = (items: PlannerItem[], withinDays = 30): PlannerItem[] =>
  openItems(items)
    .filter((i) => i.kind === 'exam' && i.due !== null && i.due <= Date.now() + withinDays * 86_400_000)
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0));

/** Whole days from today until the deadline; negative once it has passed. */
export const daysUntil = (due: number): number =>
  Math.round((startOfDay(new Date(due)) - startOfDay()) / 86_400_000);

/* ------------------------------------------------------------------ grades */

export interface SubjectAverage {
  average: number;
  count: number;
}

/** Weighted mean, so a term exam counts for more than a homework mark. */
export function averageFor(grades: Grade[], subjectId: string): SubjectAverage {
  let sum = 0;
  let weight = 0;
  let count = 0;
  for (const g of grades) {
    if (g.subjectId !== subjectId) continue;
    sum += g.value * g.weight;
    weight += g.weight;
    count++;
  }
  return { average: weight ? sum / weight : 0, count };
}

/**
 * What the next mark has to be to reach `target`, given its weight.
 * Returns null when the target is already out of reach or already met.
 */
export function neededForTarget(
  grades: Grade[],
  subjectId: string,
  target: number,
  weight: number,
  max: number,
): number | null {
  const { average, count } = averageFor(grades, subjectId);
  if (!count) return target;
  let totalWeight = 0;
  for (const g of grades) if (g.subjectId === subjectId) totalWeight += g.weight;
  const needed = (target * (totalWeight + weight) - average * totalWeight) / weight;
  if (needed <= 0) return null;
  return Math.min(needed, max + 0.001);
}

/* --------------------------------------------------------------- timetable */

export const DAY_NAMES = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
export const DAY_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** The lesson happening right now, or the next one today. */
export function currentClass(schedule: ClassSlot[], at = new Date()): { slot: ClassSlot; now: boolean } | null {
  const day = at.getDay();
  const minutes = at.getHours() * 60 + at.getMinutes();
  const today = schedule
    .filter((s) => s.day === day)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (const slot of today) {
    if (minutes >= toMinutes(slot.start) && minutes < toMinutes(slot.end)) return { slot, now: true };
  }
  const next = today.find((s) => toMinutes(s.start) > minutes);
  return next ? { slot: next, now: false } : null;
}
