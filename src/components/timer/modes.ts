import type { TimerMode } from '@/types';
import { L, type Msg } from '@/i18n';

/**
 * ─────────────────────────────────────────────── what a block looks like ──
 *
 * The three modes, their colours and their names, in one leaf module.
 *
 * They used to live in `TimerPanel` — the floating widget — which meant the
 * focus screen imported its own palette from a dashboard that happens to be
 * on top of it. The dependency ran the wrong way, and the short labels next
 * to them were written in Bulgarian only, in an app that is bilingual.
 */
export const MODES: TimerMode[] = ['work', 'break', 'long'];

export const MODE_COLOR: Record<TimerMode, string> = {
  work: 'var(--c-timer-focus)',
  break: 'var(--c-rest)',
  long: 'var(--c-deep)',
};

/**
 * What to write on top of `MODE_COLOR`, when the mode colour is a solid fill.
 *
 * Always use this instead of white. The focus colour follows the accent, and
 * the accent is ink in light and paper in dark — so a hard-coded white label
 * on the start button is invisible in exactly one of the two themes, which is
 * the sort of thing that ships.
 */
export const MODE_INK: Record<TimerMode, string> = {
  work: 'var(--c-timer-focus-ink)',
  break: 'var(--c-rest-ink)',
  long: 'var(--c-deep-ink)',
};

/** For places too narrow for "Дълга почивка". */
export const MODE_SHORT: Record<TimerMode, Msg> = {
  work: L('Работа', 'Focus'),
  break: L('Почивка', 'Break'),
  long: L('Дълга', 'Long'),
};
