import type { DocumentMeta, FlashCard, FocusSession, PlannerItem, AchievementTier } from '@/types';
import { L, type Msg } from '@/i18n';

/**
 * Levels, XP and achievements — all of it derived, none of it stored.
 *
 * Every number below is recomputed from records the app keeps anyway: minutes
 * in the focus log, completed planner items and reviewed cards.
 * A stored running total is a number that eventually disagrees with the thing
 * it counts, and a progress system that lies is worse than none. The only
 * thing written to disk is *when* an achievement was first reached, so it can
 * be announced exactly once.
 */
export interface GameContext {
  sessions: FocusSession[];
  items: PlannerItem[];
  cards: FlashCard[];
  documents: DocumentMeta[];
}

export const EMPTY_CONTEXT: GameContext = {
  sessions: [],
  items: [],
  cards: [],
  documents: [],
};

/* ------------------------------------------------------------------- XP */

export const XP_PER_MINUTE = 1;
/**
 * What a finished entry is worth.
 *
 * The three built-in kinds have their own weights because an exam really is
 * more work than a to-do. Types a person invents are worth a plain task —
 * letting somebody set their own XP would make the level a number they had
 * awarded themselves.
 */
export const XP_TASK: Record<string, number> = { task: 12, homework: 15, exam: 30 };
export const xpForItem = (kind: string): number => XP_TASK[kind] ?? XP_TASK.task;
export const XP_CARD_REVIEW = 1;
export const XP_STREAK_DAY = 10;

export interface XpBreakdown {
  focus: number;
  tasks: number;
  cards: number;
  streak: number;
  total: number;
}

export function xpBreakdown(ctx: GameContext): XpBreakdown {
  const focus = ctx.sessions.reduce((sum, s) => sum + s.minutes, 0) * XP_PER_MINUTE;
  const tasks = ctx.items.filter((i) => i.done).reduce((sum, i) => sum + xpForItem(i.kind), 0);
  const cards = ctx.cards.reduce((sum, c) => sum + c.reps, 0) * XP_CARD_REVIEW;
  // Longest, not current: XP must never go down because a day was missed.
  const streak = longestStreak(ctx.sessions) * XP_STREAK_DAY;
  return {
    focus,
    tasks,
    cards,
    streak,
    total: Math.round(focus + tasks + cards + streak),
  };
}

export const totalXp = (ctx: GameContext): number => xpBreakdown(ctx).total;

/** Cumulative XP needed to reach a level: 175, 400, 675, 1000, 1375, … */
export const xpForLevel = (level: number): number =>
  level <= 1 ? 0 : 150 * (level - 1) + 25 * (level - 1) ** 2;

export interface LevelState {
  level: number;
  xp: number;
  /** XP at the start of the current level */
  floor: number;
  /** XP that reaches the next one */
  ceiling: number;
  /** 0..1 through the current level */
  progress: number;
  toNext: number;
}

export function levelState(xp: number): LevelState {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  return {
    level,
    xp,
    floor,
    ceiling,
    progress: (xp - floor) / Math.max(1, ceiling - floor),
    toNext: Math.max(0, ceiling - xp),
  };
}

/** The name a level carries, so "level 7" also means something. */
export function levelTitle(level: number): Msg {
  if (level >= 20) return L('Магистър', 'Master');
  if (level >= 15) return L('Ментор', 'Mentor');
  if (level >= 11) return L('Ерудит', 'Scholar');
  if (level >= 8) return L('Изследовател', 'Researcher');
  if (level >= 5) return L('Постоянен', 'Consistent');
  if (level >= 3) return L('Ученик', 'Student');
  return L('Начинаещ', 'Beginner');
}

/* -------------------------------------------------------------- streaks */

const dayOf = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Days that carry at least one focus session, newest first. */
export function activeDays(sessions: FocusSession[]): Set<string> {
  return new Set(sessions.map((s) => s.day || dayOf(s.startedAt)));
}

/**
 * Consecutive days ending today — or yesterday, so a streak is not declared
 * broken at one minute past midnight before the day has had a chance.
 */
export function currentStreak(sessions: FocusSession[], now = new Date()): number {
  const days = activeDays(sessions);
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayOf(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dayOf(cursor.getTime()))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function longestStreak(sessions: FocusSession[]): number {
  const days = [...activeDays(sessions)].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const ts = new Date(y, m - 1, d).getTime();
    run = prev !== null && ts - prev === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = ts;
  }
  return best;
}

/** True once today has a session — what the streak card asks. */
export const studiedToday = (sessions: FocusSession[]): boolean =>
  activeDays(sessions).has(dayOf(Date.now()));

/* --------------------------------------------------------- achievements */

export interface AchievementDef {
  id: string;
  title: Msg;
  body: Msg;
  icon: string;
  tier: AchievementTier;
  target: number;
  /** where the person stands, in the same unit as `target` */
  value(ctx: GameContext): number;
  /** how the number is written on the card */
  unit?: Msg;
}

const minutesTotal = (ctx: GameContext) => ctx.sessions.reduce((s, x) => s + x.minutes, 0);
const tasksDone = (ctx: GameContext) => ctx.items.filter((i) => i.done).length;
const reviews = (ctx: GameContext) => ctx.cards.reduce((s, c) => s + c.reps, 0);

const sessionAtHour = (ctx: GameContext, test: (hour: number) => boolean) =>
  ctx.sessions.some((s) => test(new Date(s.startedAt).getHours())) ? 1 : 0;

const bestDayMinutes = (ctx: GameContext) => {
  const byDay = new Map<string, number>();
  for (const s of ctx.sessions) byDay.set(s.day, (byDay.get(s.day) ?? 0) + s.minutes);
  return Math.max(0, ...byDay.values());
};

/**
 * The full list. Deliberately modest: things that happen because the work
 * happened, never a badge for opening the app.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-session',
    title: L('Първи фокус', 'First focus'),
    body: L('Завърши първата си сесия.', 'Finish your first focus session.'),
    icon: 'timer',
    tier: 'bronze',
    target: 1,
    value: (c) => c.sessions.length,
  },
  {
    id: 'hours-10',
    title: L('10 часа', '10 hours'),
    body: L('Събери 10 часа учене.', 'Study for ten hours in total.'),
    icon: 'hourglass',
    tier: 'bronze',
    target: 600,
    value: minutesTotal,
    unit: L('мин', 'min'),
  },
  {
    id: 'hours-50',
    title: L('50 часа', '50 hours'),
    body: L('Събери 50 часа учене.', 'Study for fifty hours in total.'),
    icon: 'hourglass',
    tier: 'silver',
    target: 3000,
    value: minutesTotal,
    unit: L('мин', 'min'),
  },
  {
    id: 'hours-100',
    title: L('100 часа', '100 hours'),
    body: L('Събери 100 часа учене.', 'Study for a hundred hours in total.'),
    icon: 'trophy',
    tier: 'gold',
    target: 6000,
    value: minutesTotal,
    unit: L('мин', 'min'),
  },
  {
    id: 'streak-3',
    title: L('Три поред', 'Three in a row'),
    body: L('Учи три дни без прекъсване.', 'Study three days running.'),
    icon: 'flame',
    tier: 'bronze',
    target: 3,
    value: (c) => longestStreak(c.sessions),
    unit: L('дни', 'days'),
  },
  {
    id: 'streak-7',
    title: L('Седмица без пропуск', 'A full week'),
    body: L('Седем поредни дни с фокус сесия.', 'Seven consecutive days with a focus session.'),
    icon: 'flame',
    tier: 'silver',
    target: 7,
    value: (c) => longestStreak(c.sessions),
    unit: L('дни', 'days'),
  },
  {
    id: 'streak-30',
    title: L('Месец постоянство', 'A month of it'),
    body: L('Тридесет поредни дни.', 'Thirty consecutive days.'),
    icon: 'flame',
    tier: 'gold',
    target: 30,
    value: (c) => longestStreak(c.sessions),
    unit: L('дни', 'days'),
  },
  {
    id: 'tasks-10',
    title: L('Десет отметки', 'Ten ticked'),
    body: L('Завърши 10 задачи.', 'Complete ten tasks.'),
    icon: 'checkCircle',
    tier: 'bronze',
    target: 10,
    value: tasksDone,
  },
  {
    id: 'tasks-50',
    title: L('Петдесет отметки', 'Fifty ticked'),
    body: L('Завърши 50 задачи.', 'Complete fifty tasks.'),
    icon: 'checkCircle',
    tier: 'silver',
    target: 50,
    value: tasksDone,
  },
  {
    id: 'tasks-200',
    title: L('Двеста отметки', 'Two hundred ticked'),
    body: L('Завърши 200 задачи.', 'Complete two hundred tasks.'),
    icon: 'listTodo',
    tier: 'gold',
    target: 200,
    value: tasksDone,
  },
  {
    id: 'cards-100',
    title: L('Сто повторения', 'A hundred reviews'),
    body: L('Прегледай карти 100 пъти.', 'Review flashcards a hundred times.'),
    icon: 'cards',
    tier: 'bronze',
    target: 100,
    value: reviews,
  },
  {
    id: 'cards-1000',
    title: L('Хиляда повторения', 'A thousand reviews'),
    body: L('Прегледай карти 1000 пъти.', 'Review flashcards a thousand times.'),
    icon: 'brain',
    tier: 'gold',
    target: 1000,
    value: reviews,
  },
  {
    id: 'deep-day',
    title: L('Дълъг ден', 'Long day'),
    body: L('Три часа учене в един ден.', 'Three hours of focus in a single day.'),
    icon: 'bolt',
    tier: 'silver',
    target: 180,
    value: bestDayMinutes,
    unit: L('мин', 'min'),
  },
  {
    id: 'early-bird',
    title: L('Ранобудник', 'Early bird'),
    body: L('Сесия, започнала преди 7:00.', 'A session started before 7am.'),
    icon: 'sun',
    tier: 'bronze',
    target: 1,
    value: (c) => sessionAtHour(c, (h) => h < 7),
  },
  {
    id: 'night-owl',
    title: L('Нощна птица', 'Night owl'),
    body: L('Сесия, започнала след 22:00.', 'A session started after 10pm.'),
    icon: 'moon',
    tier: 'bronze',
    target: 1,
    value: (c) => sessionAtHour(c, (h) => h >= 22),
  },
  {
    id: 'library-10',
    title: L('Своя библиотека', 'A library of your own'),
    body: L('Десет материала в библиотеката.', 'Ten materials in your library.'),
    icon: 'drive',
    tier: 'bronze',
    target: 10,
    value: (c) => c.documents.filter((d) => !d.deletedAt).length,
  },
  {
    id: 'exams-3',
    title: L('Три изпита', 'Three exams'),
    body: L('Отметни три изпита като взети.', 'Tick three exams as done.'),
    icon: 'graduation',
    tier: 'silver',
    target: 3,
    value: (c) => c.items.filter((i) => i.kind === 'exam' && i.done).length,
  },
];

/** The three tiers, in the language the screen is being read in. */
export const TIER_LABEL: Record<AchievementTier, Msg> = {
  bronze: L('бронз', 'bronze'),
  silver: L('сребро', 'silver'),
  gold: L('злато', 'gold'),
};

export const TIER_COLOR: Record<AchievementTier, string> = {
  bronze: '#b06c3d',
  silver: '#8b93a7',
  gold: '#e0a325',
};

export interface AchievementState extends AchievementDef {
  value_: number;
  progress: number;
  earned: boolean;
  earnedAt: number | null;
}

export function achievementStates(
  ctx: GameContext,
  unlocked: Record<string, number>,
): AchievementState[] {
  return ACHIEVEMENTS.map((a) => {
    const value_ = a.value(ctx);
    const earned = value_ >= a.target;
    return {
      ...a,
      value_,
      progress: Math.min(1, a.target ? value_ / a.target : 0),
      earned,
      earnedAt: unlocked[a.id] ?? null,
    };
  });
}
