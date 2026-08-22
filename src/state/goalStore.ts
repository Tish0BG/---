import { create } from 'zustand';
import type { Goal, Milestone } from '@/types';
import { repo } from '@/services/storageService';
import { uid } from '@/lib/util';
import { currentValue, metricBaseline, type GoalContext } from '@/services/goalService';

interface GoalStore {
  goals: Goal[];
  loaded: boolean;

  init(): Promise<void>;
  add(patch: Partial<Goal>, ctx: GoalContext): Promise<Goal>;
  update(id: string, patch: Partial<Goal>): Promise<void>;
  remove(id: string): Promise<void>;
  /** hand-counted goals: +1 / −1 on the card, no dialog */
  bump(id: string, delta: number): Promise<void>;
  toggleMilestone(goalId: string, milestoneId: string): Promise<void>;
  addMilestone(goalId: string, title: string): Promise<void>;
  removeMilestone(goalId: string, milestoneId: string): Promise<void>;
  /**
   * Stamps `completedAt` on goals whose counter has reached the target.
   * Called after anything that could move a counter — a finished session, a
   * completed task — so "goal reached" is noticed the moment it happens.
   */
  reconcile(ctx: GoalContext): Promise<Goal[]>;
}

export const useGoals = create<GoalStore>((set, get) => ({
  goals: [],
  loaded: false,

  async init() {
    const goals = await repo.listGoals();
    set({ goals, loaded: true });
  },

  async add(patch, ctx) {
    const now = Date.now();
    const metric = patch.metric ?? 'minutes';
    const goal: Goal = {
      id: uid('gl_'),
      title: '',
      subjectId: null,
      metric,
      target: 600,
      manual: 0,
      baseline: metricBaseline(metric, patch.subjectId ?? null, ctx),
      startAt: now,
      deadline: null,
      milestones: [],
      color: null,
      archived: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      ...patch,
    };
    await repo.putGoal(goal);
    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  async update(id, patch) {
    const current = get().goals.find((g) => g.id === id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: Date.now() };
    await repo.putGoal(next);
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? next : g)) }));
  },

  async remove(id) {
    await repo.deleteGoal(id);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },

  async bump(id, delta) {
    const current = get().goals.find((g) => g.id === id);
    if (!current) return;
    await get().update(id, { manual: Math.max(0, current.manual + delta) });
  },

  async addMilestone(goalId, title) {
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    const milestone: Milestone = { id: uid('ms_'), title, done: false, doneAt: null };
    await get().update(goalId, { milestones: [...goal.milestones, milestone] });
  },

  async toggleMilestone(goalId, milestoneId) {
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    const milestones = goal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, done: !m.done, doneAt: m.done ? null : Date.now() } : m,
    );
    await get().update(goalId, { milestones });
  },

  async removeMilestone(goalId, milestoneId) {
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    await get().update(goalId, { milestones: goal.milestones.filter((m) => m.id !== milestoneId) });
  },

  async reconcile(ctx) {
    const finished: Goal[] = [];
    for (const goal of get().goals) {
      if (goal.archived) continue;
      const reached = goal.target > 0 && currentValue(goal, ctx) >= goal.target;
      if (reached && !goal.completedAt) {
        await get().update(goal.id, { completedAt: Date.now() });
        finished.push(goal);
      } else if (!reached && goal.completedAt) {
        // The target was raised, or a task was un-ticked: it is open again.
        await get().update(goal.id, { completedAt: null });
      }
    }
    return finished;
  },
}));

export const activeGoals = (goals: Goal[]): Goal[] =>
  goals.filter((g) => !g.archived && !g.completedAt).sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));

export const completedGoals = (goals: Goal[]): Goal[] =>
  goals.filter((g) => !!g.completedAt).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
