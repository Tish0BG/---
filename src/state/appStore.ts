import { create } from 'zustand';
import { L, type Msg } from '@/i18n';

/**
 * Top-level destinations, in the order the sidebar draws them.
 *
 * The order follows the day rather than the changelog: where you are, what you
 * keep, what you owe, when it happens, how you revise, how you concentrate,
 * what it is all filed under, how it is going.
 *
 * `exams` is not in that list. It is a real screen with a real address, but it
 * is reached from the dashboard rather than from the rail — a countdown is
 * something you look at in a particular week, not a place you live.
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
  | 'exams'
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
  exams: L('Изпити', 'Exams'),
  profile: L('Профил', 'Profile'),
};

/**
 * Old links, shortcuts and `?go=` parameters keep working.
 *
 * `tasks` and `goals` were screens once. Tasks became the plan; goals were
 * removed outright, and the address still resolves rather than 404s, because
 * a dead bookmark is a worse answer than the nearest live screen.
 */
const ALIASES: Record<string, AppView> = {
  planner: 'plan',
  tasks: 'plan',
  goals: 'plan',
  library: 'drive',
  home: 'dashboard',
  timer: 'focus',
};

export const resolveView = (raw: string): AppView | null => {
  if (raw in VIEW_TITLES) return raw as AppView;
  return ALIASES[raw] ?? null;
};

/** What the quick-create control is currently making. */
export type QuickKind = 'item' | null;

/**
 * What a new entry should start out as, when the thing that opened the dialog
 * already knows.
 *
 * Pressing "add" inside Thursday's column means Thursday, and pressing it while
 * the board is filtered to one channel means that channel. Without this the
 * composer guesses today and no channel, and the person has to correct it —
 * which is the whole reason the plan grew a second, inline way to add a task
 * in the first place.
 */
export interface QuickSeed {
  due?: number | null;
  subjectId?: string | null;
}

interface AppStore {
  view: AppView;
  /** when set, the subjects section shows one subject's page */
  subjectId: string | null;
  /** deep link into a screen: the row to open once it mounts */
  focusId: string | null;
  /** the plan filtered to one kind of entry; null = every kind */
  planKind: string | null;
  /**
   * Bumped by every `goPlan`, and by nothing else.
   *
   * "Open the plan" has to work even when the plan is already open — a card on
   * the dashboard that lands you nowhere because the state it wanted was
   * already set is a dead link. The screen watches this number rather than
   * trying to spot a change in values that did not change.
   */
  planNav: number;
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
  /** the create sheet, opened from the plus button or ⌘N */
  quick: QuickKind;
  /** the kind an entry being created starts on */
  quickKind: string;
  /** what the caller already knows about the entry being created */
  quickSeed: QuickSeed | null;
  /**
   * The entry whose window is open, anywhere in the app.
   *
   * One id, one window, mounted once beside the create dialog. It used to be
   * two things — a `selected` in the plan's view store and an `editing` in the
   * calendar's local state — which is how one job ended up with two different
   * dialogs.
   */
  openItemId: string | null;
  /** filters the dashboard, library and plan down to one subject */
  filterSubjectId: string | null;
  /** the dashboard is being rearranged rather than read */
  editingDashboard: boolean;

  go(view: AppView, focusId?: string): void;
  /** the plan screen, opened on a particular kind */
  goPlan(kind?: string | null, focusId?: string): void;
  openSubject(id: string | null): void;
  setSettings(open: boolean, section?: string): void;
  setAuth(open: boolean, mode?: 'signin' | 'signup'): void;
  /** which half of the door is showing, without deciding whether it is open */
  setAuthMode(mode: 'signin' | 'signup'): void;
  setQuick(kind: QuickKind, itemKind?: string, seed?: QuickSeed | null): void;
  /** opens the entry window on one record */
  openItem(id: string): void;
  closeItem(): void;
  setFilter(subjectId: string | null): void;
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
  planKind: null,
  planNav: 0,
  settingsOpen: false,
  settingsSection: null,
  authOpen: false,
  authMode: 'signin',
  quick: null,
  quickKind: 'task',
  quickSeed: null,
  openItemId: null,
  filterSubjectId: null,
  editingDashboard: false,

  go(view, focusId) {
    set({
      view,
      subjectId: null,
      focusId: focusId ?? null,
      editingDashboard: false,
    });
  },
  goPlan(kind = null, focusId) {
    set((s) => ({
      view: 'plan',
      planKind: kind,
      planNav: s.planNav + 1,
      subjectId: null,
      focusId: focusId ?? null,
    }));
  },
  openSubject(id) {
    set({ view: 'subjects', subjectId: id });
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
  setQuick(kind, itemKind, seed) {
    set({
      quick: kind,
      ...(itemKind ? { quickKind: itemKind } : {}),
      // Cleared on close as well as on open: a seed left behind would put the
      // next entry on whichever day the last one was added from.
      quickSeed: kind === null ? null : (seed ?? null),
    });
  },
  openItem(id) {
    set({ openItemId: id });
  },
  closeItem() {
    set({ openItemId: null });
  },
  setFilter(subjectId) {
    set({ filterSubjectId: subjectId });
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
 * "Take me to X", where X may be a name from before the plan absorbed the old
 * task screen.
 *
 * Notifications written last week and the "next step" card still say `tasks`
 * or `exams`. One function is a better home for that translation than four
 * call sites guessing.
 */
export function navigateTo(target: string, id?: string): void {
  const view = resolveView(target);
  if (!view) return;
  const app = useApp.getState();
  if (view === 'plan') {
    app.goPlan(null, id);
    return;
  }
  app.go(view, id);
}
