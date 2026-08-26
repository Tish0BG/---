import { create } from 'zustand';
import { L, type Msg } from '@/i18n';

/**
 * Top-level destinations, in the order the sidebar draws them.
 *
 * The list used to be nine entries long and arranged by when each feature was
 * built: tasks, calendar, goals, exams, library, cards, focus, statistics.
 * Three of those — tasks, goals, exams — were the same record seen through
 * three filters, and all three were about school, which is a guess about the
 * person holding the app. They are one screen now, `plan`, and the order below
 * follows the day rather than the changelog: where you are, what you keep,
 * what you owe, when it happens, how you revise, how you concentrate.
 */
export type AppView =
  | 'dashboard'
  | 'drive'
  | 'plan'
  | 'calendar'
  | 'cards'
  | 'focus'
  | 'subjects'
  | 'stats'
  | 'achievements'
  | 'profile';

export const VIEW_TITLES: Record<AppView, Msg> = {
  dashboard: L('Табло', 'Dashboard'),
  drive: L('Библиотека', 'Library'),
  plan: L('План', 'Plan'),
  calendar: L('Календар', 'Calendar'),
  cards: L('Флашкарти', 'Flashcards'),
  focus: L('Фокус', 'Focus'),
  subjects: L('Предмети', 'Subjects'),
  stats: L('Статистика', 'Statistics'),
  achievements: L('Постижения', 'Achievements'),
  profile: L('Профил', 'Profile'),
};

/**
 * Old links, shortcuts and `?go=` parameters keep working.
 *
 * `tasks`, `goals` and `exams` were three screens until the plan absorbed
 * them; the addresses people bookmarked still have to land somewhere sensible,
 * and the tab they open on is decided by `PLAN_TAB_FOR` below.
 */
const ALIASES: Record<string, AppView> = {
  planner: 'plan',
  tasks: 'plan',
  goals: 'plan',
  exams: 'plan',
  library: 'drive',
  home: 'dashboard',
  timer: 'focus',
};

export const resolveView = (raw: string): AppView | null => {
  if (raw in VIEW_TITLES) return raw as AppView;
  return ALIASES[raw] ?? null;
};

/**
 * Which face of the plan an address was asking for.
 *
 * `board` is the day-to-day one: three lanes side by side. `work` is the same
 * records as one filtered list, for the days when you want to see everything
 * at once rather than only what is next. `goals` is the long view in full.
 */
export type PlanTab = 'board' | 'work' | 'goals';

export const PLAN_TAB_FOR: Record<string, PlanTab> = {
  tasks: 'board',
  exams: 'work',
  goals: 'goals',
};

/** What the quick-create control is currently making. */
export type QuickKind = 'item' | 'goal' | 'event' | null;

interface AppStore {
  view: AppView;
  /** when set, the subjects section shows one subject's page */
  subjectId: string | null;
  /** deep link into a screen: the row to open once it mounts */
  focusId: string | null;
  /** which half of the plan screen is showing */
  planTab: PlanTab;
  /** the plan screen filtered to one kind of entry; null = every kind */
  planKind: string | null;
  paletteOpen: boolean;
  settingsOpen: boolean;
  /** which room of the settings to open on; null means "wherever it was" */
  settingsSection: string | null;
  /** account / cloud-sync dialog */
  authOpen: boolean;
  /**
   * Which half of the door to open on.
   *
   * "Create an account" and "Sign in" are two different intentions and the
   * screen should already be on the right one — a person who pressed the
   * first and lands on a password field has been told the app was not
   * listening.
   */
  authMode: 'signin' | 'signup';
  /** the create sheet, opened from the top bar, ⌘N or the mobile plus */
  quick: QuickKind;
  /** the kind an entry being created starts on */
  quickKind: string;
  /** filters the dashboard, library and plan down to one subject */
  filterSubjectId: string | null;
  /** the dashboard is being rearranged rather than read */
  editingDashboard: boolean;

  go(view: AppView, focusId?: string): void;
  /** the plan screen, opened on a particular tab and kind */
  goPlan(tab?: PlanTab, kind?: string | null, focusId?: string): void;
  openSubject(id: string | null): void;
  setPalette(open: boolean): void;
  setSettings(open: boolean, section?: string): void;
  setAuth(open: boolean, mode?: 'signin' | 'signup'): void;
  /** which half of the door is showing, without deciding whether it is open */
  setAuthMode(mode: 'signin' | 'signup'): void;
  setQuick(kind: QuickKind, itemKind?: string): void;
  setFilter(subjectId: string | null): void;
  setPlanTab(tab: PlanTab): void;
  setPlanKind(kind: string | null): void;
  setEditingDashboard(on: boolean): void;
  clearFocus(): void;
}

/**
 * Navigation state only. Kept apart from the document stores so moving
 * between screens never touches anything that is being saved.
 */
export const useApp = create<AppStore>((set) => ({
  view: 'dashboard',
  subjectId: null,
  focusId: null,
  planTab: 'board',
  planKind: null,
  paletteOpen: false,
  settingsOpen: false,
  settingsSection: null,
  authOpen: false,
  authMode: 'signin',
  quick: null,
  quickKind: 'task',
  filterSubjectId: null,
  editingDashboard: false,

  go(view, focusId) {
    set({
      view,
      paletteOpen: false,
      subjectId: null,
      focusId: focusId ?? null,
      editingDashboard: false,
    });
  },
  goPlan(tab = 'board', kind = null, focusId) {
    set({
      view: 'plan',
      planTab: tab,
      planKind: kind,
      paletteOpen: false,
      subjectId: null,
      focusId: focusId ?? null,
    });
  },
  openSubject(id) {
    set({ view: 'subjects', subjectId: id, paletteOpen: false });
  },
  setPalette(open) {
    set({ paletteOpen: open });
  },
  setSettings(open, section) {
    set({ settingsOpen: open, settingsSection: open ? (section ?? null) : null });
  },
  setAuthMode(mode) {
    set({ authMode: mode });
  },

  setAuth(open, mode) {
    set({ authOpen: open, ...(mode ? { authMode: mode } : {}) });
  },
  setQuick(kind, itemKind) {
    set({ quick: kind, ...(itemKind ? { quickKind: itemKind } : {}) });
  },
  setFilter(subjectId) {
    set({ filterSubjectId: subjectId });
  },
  setPlanTab(tab) {
    set({ planTab: tab });
  },
  setPlanKind(kind) {
    set({ planKind: kind });
  },
  setEditingDashboard(on) {
    set({ editingDashboard: on });
  },
  clearFocus() {
    set({ focusId: null });
  },
}));

/**
 * "Take me to X", where X may be a name from before the plan absorbed three
 * screens.
 *
 * Notifications written last week, links in the command palette and the
 * "next step" card all still say `tasks`, `exams` or `goals`. They are all
 * the plan; which half and which filter is the only thing that differs, and
 * one function is a better home for that than four call sites guessing.
 */
export function navigateTo(target: string, id?: string): void {
  const view = resolveView(target);
  if (!view) return;
  const app = useApp.getState();
  if (view === 'plan') {
    app.goPlan(PLAN_TAB_FOR[target] ?? 'board', target === 'exams' ? 'exam' : null, id);
    return;
  }
  app.go(view, id);
}
