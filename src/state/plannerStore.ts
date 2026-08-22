import { create } from 'zustand';
import type { ClassSlot, Grade, PlannerItem } from '@/types';
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
  clearCompleted(): Promise<void>;
  /** credits a finished focus session to an item */
  addPomodoro(id: string): Promise<void>;

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
    await get().updateItem(id, { done, completedAt: done ? Date.now() : null });
    announceProgress();
  },

  async removeItem(id) {
    await repo.deletePlanner([id]);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  async clearCompleted() {
    const gone = get().items.filter((i) => i.done).map((i) => i.id);
    await repo.deletePlanner(gone);
    set((s) => ({ items: s.items.filter((i) => !i.done) }));
  },

  async addPomodoro(id) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    await get().updateItem(id, { pomodoros: current.pomodoros + 1 });
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
