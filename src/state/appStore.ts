import { create } from 'zustand';
import { L, type Msg } from '@/i18n';

/** Top-level destinations in the sidebar. */
export type AppView =
  | 'dashboard'
  | 'tasks'
  | 'calendar'
  | 'goals'
  | 'exams'
  | 'drive'
  | 'cards'
  | 'subjects'
  | 'stats'
  | 'achievements'
  | 'profile';

export const VIEW_TITLES: Record<AppView, Msg> = {
  dashboard: L('Табло', 'Dashboard'),
  tasks: L('Задачи', 'Tasks'),
  calendar: L('Календар', 'Calendar'),
  goals: L('Цели', 'Goals'),
  exams: L('Изпити', 'Exams'),
  drive: L('Библиотека', 'Library'),
  cards: L('Флашкарти', 'Flashcards'),
  subjects: L('Предмети', 'Subjects'),
  stats: L('Статистика', 'Statistics'),
  achievements: L('Постижения', 'Achievements'),
  profile: L('Профил', 'Profile'),
};

/** Old links, shortcuts and `?go=` parameters keep working. */
const ALIASES: Record<string, AppView> = {
  planner: 'tasks',
  library: 'drive',
  home: 'dashboard',
};

export const resolveView = (raw: string): AppView | null => {
  if (raw in VIEW_TITLES) return raw as AppView;
  return ALIASES[raw] ?? null;
};

/** What the quick-create control is currently making. */
export type QuickKind = 'task' | 'exam' | 'goal' | 'event' | null;

interface AppStore {
  view: AppView;
  /** when set, the subjects section shows one subject's page */
  subjectId: string | null;
  /** deep link into a screen: the row to open once it mounts */
  focusId: string | null;
  paletteOpen: boolean;
  settingsOpen: boolean;
  /** which room of the settings to open on; null means "wherever it was" */
  settingsSection: string | null;
  /** account / cloud-sync dialog */
  authOpen: boolean;
  /** the create sheet, opened from the top bar, ⌘N or the mobile plus */
  quick: QuickKind;
  /** filters the dashboard, library and tasks down to one subject */
  filterSubjectId: string | null;

  go(view: AppView, focusId?: string): void;
  openSubject(id: string | null): void;
  setPalette(open: boolean): void;
  setSettings(open: boolean, section?: string): void;
  setAuth(open: boolean): void;
  setQuick(kind: QuickKind): void;
  setFilter(subjectId: string | null): void;
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
  paletteOpen: false,
  settingsOpen: false,
  settingsSection: null,
  authOpen: false,
  quick: null,
  filterSubjectId: null,

  go(view, focusId) {
    set({ view, paletteOpen: false, subjectId: null, focusId: focusId ?? null });
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
  setAuth(open) {
    set({ authOpen: open });
  },
  setQuick(kind) {
    set({ quick: kind });
  },
  setFilter(subjectId) {
    set({ filterSubjectId: subjectId });
  },
  clearFocus() {
    set({ focusId: null });
  },
}));
