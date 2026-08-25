export type { DashboardPanel, WidgetSize } from '@/types';
export type { Msg } from '@/i18n';

import type { WidgetSize } from '@/types';

/**
 * How wide each size is, in columns of twelve, at each breakpoint.
 *
 * Kept as data rather than as Tailwind classes: the spans are chosen from a
 * saved preference at runtime, and a class name assembled from a variable is a
 * class name the compiler never sees.
 */
export const SPAN: Record<WidgetSize, { phone: number; tablet: number; desktop: number }> = {
  quarter: { phone: 12, tablet: 6, desktop: 3 },
  third: { phone: 12, tablet: 6, desktop: 4 },
  half: { phone: 12, tablet: 12, desktop: 6 },
  full: { phone: 12, tablet: 12, desktop: 12 },
};

export const SIZE_LABEL: Record<WidgetSize, { bg: string; en: string }> = {
  quarter: { bg: 'Четвърт', en: 'Quarter' },
  third: { bg: 'Трета', en: 'Third' },
  half: { bg: 'Половина', en: 'Half' },
  full: { bg: 'Цяла ширина', en: 'Full width' },
};
