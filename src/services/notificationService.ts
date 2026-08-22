import type { FlashCard, Goal, PlannerItem, Subject } from '@/types';
import { L, type Msg } from '@/i18n';
import { goalProgress, daysLeft, type GoalContext } from './goalService';
import { currentStreak, studiedToday, type GameContext, ACHIEVEMENTS } from './gameService';

export type NoticeKind = 'exam' | 'deadline' | 'overdue' | 'streak' | 'goal' | 'achievement' | 'review';

export interface Notice {
  /** Stable across rebuilds, so "read" survives a reload. */
  id: string;
  kind: NoticeKind;
  title: Msg;
  body: Msg;
  icon: string;
  tone: 'brand' | 'warn' | 'danger' | 'success' | 'ember';
  /** sorts the feed; higher first */
  weight: number;
  at: number;
  /** where clicking it goes */
  target?: { view: 'tasks' | 'exams' | 'goals' | 'cards' | 'stats' | 'achievements'; id?: string };
}

const DAY = 86_400_000;
const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/**
 * The notification feed is *derived*, like everything else in the product: it
 * is a query over tasks, exams, goals and the focus log, run whenever the
 * panel opens. Nothing is queued, nothing is scheduled, so nothing can arrive
 * about a task that was deleted five minutes ago.
 */
export function buildNotices(input: {
  items: PlannerItem[];
  goals: Goal[];
  cards: FlashCard[];
  subjects: Subject[];
  ctx: GameContext & GoalContext;
  unlocked: Record<string, number>;
  now?: number;
}): Notice[] {
  const { items, goals, cards, subjects, ctx, unlocked } = input;
  const now = input.now ?? Date.now();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  const out: Notice[] = [];
  const nameOf = (id: string | null) => subjects.find((s) => s.id === id)?.name ?? '';

  /* ------------------------------------------------------------- exams */
  for (const exam of items) {
    if (exam.kind !== 'exam' || exam.done || exam.due === null) continue;
    const days = Math.round((new Date(exam.due).setHours(0, 0, 0, 0) - today) / DAY);
    if (days < 0 || days > 7) continue;
    out.push({
      id: `exam-${exam.id}-${days}`,
      kind: 'exam',
      title:
        days === 0
          ? L('Изпит днес', 'Exam today')
          : days === 1
            ? L('Изпит утре', 'Exam tomorrow')
            : L(`Изпит след ${days} дни`, `Exam in ${days} days`),
      body: L(
        `${exam.title}${nameOf(exam.subjectId) ? ` · ${nameOf(exam.subjectId)}` : ''}`,
        `${exam.title}${nameOf(exam.subjectId) ? ` · ${nameOf(exam.subjectId)}` : ''}`,
      ),
      icon: 'graduation',
      tone: days <= 2 ? 'danger' : 'warn',
      weight: 100 - days,
      at: exam.due,
      target: { view: 'exams', id: exam.id },
    });
  }

  /* --------------------------------------------------------- deadlines */
  const overdue = items.filter((i) => !i.done && i.kind !== 'exam' && i.due !== null && i.due < today);
  if (overdue.length) {
    out.push({
      id: `overdue-${dayKey(now)}-${overdue.length}`,
      kind: 'overdue',
      title:
        overdue.length === 1
          ? L('Просрочена задача', 'An overdue task')
          : L(`${overdue.length} просрочени задачи`, `${overdue.length} overdue tasks`),
      body: L(
        overdue.length === 1 ? overdue[0].title : 'Пренасрочи ги или ги отметни.',
        overdue.length === 1 ? overdue[0].title : 'Reschedule them or tick them off.',
      ),
      icon: 'alert',
      tone: 'danger',
      weight: 90,
      at: overdue[0].due ?? now,
      target: { view: 'tasks' },
    });
  }

  const dueToday = items.filter(
    (i) => !i.done && i.kind !== 'exam' && i.due !== null && i.due >= today && i.due < today + DAY,
  );
  if (dueToday.length) {
    out.push({
      id: `today-${dayKey(now)}-${dueToday.length}`,
      kind: 'deadline',
      title: L(`${dueToday.length} за днес`, `${dueToday.length} due today`),
      body: L(dueToday.map((i) => i.title).join(', '), dueToday.map((i) => i.title).join(', ')),
      icon: 'listTodo',
      tone: 'brand',
      weight: 70,
      at: today,
      target: { view: 'tasks' },
    });
  }

  /* ------------------------------------------------------------ goals */
  for (const goal of goals) {
    if (goal.archived || goal.completedAt) continue;
    const left = daysLeft(goal, now);
    if (left === null || left > 3 || left < 0) continue;
    const done = goalProgress(goal, ctx);
    if (done >= 1) continue;
    out.push({
      id: `goal-${goal.id}-${left}`,
      kind: 'goal',
      title:
        left === 0
          ? L('Цел с краен срок днес', 'A goal ends today')
          : L(`Цел до ${left} дни`, `A goal ends in ${left} days`),
      body: L(
        `${goal.title} · ${Math.round(done * 100)}% завършена`,
        `${goal.title} · ${Math.round(done * 100)}% complete`,
      ),
      icon: 'target',
      tone: 'warn',
      weight: 80 - left,
      at: goal.deadline ?? now,
      target: { view: 'goals', id: goal.id },
    });
  }

  /* ----------------------------------------------------------- streak */
  const streak = currentStreak(ctx.sessions, new Date(now));
  const hour = new Date(now).getHours();
  if (streak > 0 && !studiedToday(ctx.sessions) && hour >= 17) {
    out.push({
      id: `streak-${dayKey(now)}`,
      kind: 'streak',
      title: L(`Серията ти от ${streak} дни е на косъм`, `Your ${streak}-day streak is at risk`),
      body: L('Една сесия днес я запазва.', 'One session today keeps it alive.'),
      icon: 'flame',
      tone: 'ember',
      weight: 85,
      at: now,
      target: { view: 'stats' },
    });
  }

  /* ------------------------------------------------------------ cards */
  const due = cards.filter((c) => !c.suspended && c.due <= now).length;
  if (due > 0) {
    out.push({
      id: `review-${dayKey(now)}-${due}`,
      kind: 'review',
      title: L(`${due} карти за преговор`, `${due} cards to review`),
      body: L('Няколко минути стигат.', 'A few minutes is enough.'),
      icon: 'cards',
      tone: 'brand',
      weight: 50,
      at: now,
      target: { view: 'cards' },
    });
  }

  /* ----------------------------------------------------- achievements */
  for (const [id, at] of Object.entries(unlocked)) {
    if (now - at > 3 * DAY) continue;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) continue;
    out.push({
      id: `ach-${id}`,
      kind: 'achievement',
      title: L('Ново постижение', 'Achievement unlocked'),
      body: def.title,
      icon: def.icon,
      tone: 'success',
      weight: 60,
      at,
      target: { view: 'achievements' },
    });
  }

  return out.sort((a, b) => b.weight - a.weight || b.at - a.at);
}
