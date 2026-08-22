import type { DocumentMeta, FlashCard, FocusSession, Goal, GoalMetric, PlannerItem } from '@/types';
import { L, type Msg } from '@/i18n';

/** Everything a goal's progress can be read from. */
export interface GoalContext {
  sessions: FocusSession[];
  items: PlannerItem[];
  cards: FlashCard[];
  documents: DocumentMeta[];
}

export const METRIC_LABEL: Record<GoalMetric, Msg> = {
  minutes: L('Минути учене', 'Minutes studied'),
  tasks: L('Завършени задачи', 'Tasks completed'),
  cards: L('Прегледани карти', 'Cards reviewed'),
  pages: L('Прочетени страници', 'Pages read'),
  custom: L('Собствени единици', 'Custom units'),
};

export const METRIC_UNIT: Record<GoalMetric, Msg> = {
  minutes: L('мин', 'min'),
  tasks: L('задачи', 'tasks'),
  cards: L('карти', 'cards'),
  pages: L('стр.', 'pages'),
  custom: L('бр.', 'units'),
};

export const METRIC_ICON: Record<GoalMetric, string> = {
  minutes: 'timer',
  tasks: 'checkCircle',
  cards: 'cards',
  pages: 'book',
  custom: 'target',
};

/**
 * What the goal's counter reads right now.
 *
 * Nothing here is stored: every number is recomputed from the records the app
 * already keeps, so a goal can never claim progress the focus log or the task
 * list would contradict.
 */
export function currentValue(goal: Goal, ctx: GoalContext): number {
  const inSubject = <T extends { subjectId?: string | null }>(x: T) =>
    !goal.subjectId || x.subjectId === goal.subjectId;

  switch (goal.metric) {
    case 'minutes':
      return ctx.sessions
        .filter((s) => s.startedAt >= goal.startAt && inSubject(s))
        .reduce((sum, s) => sum + s.minutes, 0);

    case 'tasks':
      return ctx.items.filter(
        (i) => i.done && (i.completedAt ?? 0) >= goal.startAt && inSubject(i),
      ).length;

    case 'cards':
      return ctx.cards.filter((c) => (c.lastReviewedAt ?? 0) >= goal.startAt && inSubject(c)).length;

    case 'pages': {
      const read = ctx.documents
        .filter((d) => !d.deletedAt && inSubject(d))
        .reduce((sum, d) => sum + (d.maxPageVisited || 0), 0);
      return Math.max(0, read - goal.baseline);
    }

    case 'custom':
    default:
      return goal.manual;
  }
}

/** The same reading as a fraction, clamped so a card can never overflow. */
export function goalProgress(goal: Goal, ctx: GoalContext): number {
  if (goal.target <= 0) return 0;
  return Math.min(1, currentValue(goal, ctx) / goal.target);
}

/** Baseline for a brand-new goal, so it starts where the person is today. */
export function metricBaseline(metric: GoalMetric, subjectId: string | null, ctx: GoalContext): number {
  if (metric !== 'pages') return 0;
  return ctx.documents
    .filter((d) => !d.deletedAt && (!subjectId || d.subjectId === subjectId))
    .reduce((sum, d) => sum + (d.maxPageVisited || 0), 0);
}

/** Whole days left; negative once the deadline has passed. */
export function daysLeft(goal: Goal, now = Date.now()): number | null {
  if (!goal.deadline) return null;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const due = new Date(goal.deadline);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - midnight.getTime()) / 86_400_000);
}

export type GoalHealth = 'done' | 'ahead' | 'ontrack' | 'behind' | 'late' | 'open';

/**
 * Is this going to happen?
 *
 * Compares the share of the goal that is done with the share of its time that
 * has passed — a goal 30 % finished with 80 % of the term gone is behind, and
 * saying so is the only reason to draw a progress bar at all.
 */
export function goalHealth(goal: Goal, ctx: GoalContext, now = Date.now()): GoalHealth {
  const done = goalProgress(goal, ctx);
  if (done >= 1 || goal.completedAt) return 'done';
  if (!goal.deadline) return 'open';
  if (goal.deadline < now) return 'late';
  const span = goal.deadline - goal.startAt;
  if (span <= 0) return 'ontrack';
  const elapsed = (now - goal.startAt) / span;
  if (done >= elapsed + 0.12) return 'ahead';
  if (done < elapsed - 0.12) return 'behind';
  return 'ontrack';
}

export const HEALTH_LABEL: Record<GoalHealth, Msg> = {
  done: L('Завършена', 'Complete'),
  ahead: L('Пред графика', 'Ahead'),
  ontrack: L('В график', 'On track'),
  behind: L('Изостава', 'Behind'),
  late: L('Просрочена', 'Overdue'),
  open: L('Без срок', 'No deadline'),
};

export const HEALTH_COLOR: Record<GoalHealth, string> = {
  done: 'var(--c-success)',
  ahead: 'var(--c-aurora)',
  ontrack: 'var(--c-brand)',
  behind: 'var(--c-warn)',
  late: 'var(--c-danger)',
  open: 'var(--c-faint)',
};

/**
 * How much of the goal is left per remaining day — the sentence a goal card
 * can actually act on ("about 35 min a day to make it").
 */
export function paceHint(goal: Goal, ctx: GoalContext, now = Date.now()): number | null {
  const left = goal.target - currentValue(goal, ctx);
  const days = daysLeft(goal, now);
  if (left <= 0 || days === null || days < 0) return null;
  return left / Math.max(1, days);
}
