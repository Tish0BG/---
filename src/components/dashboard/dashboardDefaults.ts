import type { DashboardPanel } from '@/types';

/**
 * What a dashboard looks like before anyone has touched it.
 *
 * It lives apart from the widget catalogue on purpose: the settings store is
 * read synchronously before the first paint, and pulling it through
 * `widgets.tsx` would drag every panel — charts, the timetable, the goal
 * service — into the bundle that decides the theme.
 *
 * Close to the screen the product shipped with, so nobody signing in after
 * the change finds their dashboard rearranged underneath them.
 */
export const DEFAULT_DASHBOARD: DashboardPanel[] = [
  { id: 'next-step', size: 'full' },
  { id: 'today-goal', size: 'quarter' },
  { id: 'streak', size: 'quarter' },
  { id: 'tasks-today', size: 'quarter' },
  { id: 'cards-due', size: 'quarter' },
  { id: 'today-plan', size: 'half' },
  { id: 'exams', size: 'half' },
  { id: 'week-focus', size: 'half' },
  { id: 'goals', size: 'half' },
  { id: 'recent', size: 'half' },
  { id: 'subject-split', size: 'half' },
];
