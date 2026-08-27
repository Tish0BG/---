import { create } from 'zustand';
import { startOfDay } from './plannerStore';

const KEY = 'plauvia.plan.v1';

/**
 * ─────────────────────────────────────────── where the planner is looking ──
 *
 * The plan is a window onto a run of days, and everything about that window —
 * which day it starts on, how many columns fit, whether the calendar is
 * showing beside them — is a *view* preference rather than data. It lives
 * apart from `appStore` for the same reason the viewer's zoom does: nothing
 * about the day being displayed should ever end up in a record that syncs.
 *
 * The three settings that survive a reload are the ones a person chooses once
 * and then relies on: how many days are on screen, the calendar, the backlog.
 * The anchor deliberately does not — opening the app tomorrow on yesterday's
 * Monday is never what anybody meant.
 */

interface Saved {
  days: number;
  calendar: boolean;
  backlog: boolean;
}

function load(): Saved {
  const fallback: Saved = { days: 3, calendar: true, backlog: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      days: Math.min(7, Math.max(1, Number(parsed.days) || fallback.days)),
      calendar: parsed.calendar ?? fallback.calendar,
      backlog: parsed.backlog ?? fallback.backlog,
    };
  } catch {
    return fallback;
  }
}

interface PlanViewStore extends Saved {
  /** midnight of the leftmost column */
  anchor: number;
  /** the entry currently in the air, so every drop target can light up */
  dragging: string | null;

  setAnchor(day: number): void;
  /** moves the window by whole days; the board never lands mid-week by accident */
  shift(days: number): void;
  today(): void;
  setDays(days: number): void;
  toggleCalendar(): void;
  toggleBacklog(): void;
  setDragging(id: string | null): void;
}

export const usePlanView = create<PlanViewStore>((set, get) => {
  const saved = load();

  const persist = () => {
    const { days, calendar, backlog } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ days, calendar, backlog } satisfies Saved));
    } catch {
      /* a preference that cannot be written is not worth an error */
    }
  };

  return {
    ...saved,
    anchor: startOfDay(),
    dragging: null,

    setAnchor(day) {
      set({ anchor: startOfDay(new Date(day)) });
    },
    shift(days) {
      const d = new Date(get().anchor);
      d.setDate(d.getDate() + days);
      set({ anchor: startOfDay(d) });
    },
    today() {
      set({ anchor: startOfDay() });
    },
    setDays(days) {
      set({ days: Math.min(7, Math.max(1, days)) });
      persist();
    },
    toggleCalendar() {
      set((s) => ({ calendar: !s.calendar }));
      persist();
    },
    toggleBacklog() {
      set((s) => ({ backlog: !s.backlog }));
      persist();
    },
    setDragging(id) {
      set({ dragging: id });
    },
  };
});
