import { create } from 'zustand';

/** Top-level destinations in the navigation rail. */
export type AppView = 'dashboard' | 'drive' | 'planner' | 'cards' | 'subjects' | 'stats';

export const VIEW_TITLES: Record<AppView, string> = {
  dashboard: 'Табло',
  drive: 'Библиотека',
  planner: 'Планер',
  cards: 'Флашкарти',
  subjects: 'Предмети',
  stats: 'Статистика',
};

interface AppStore {
  view: AppView;
  /** when set, the subjects section shows one subject's page */
  subjectId: string | null;
  paletteOpen: boolean;
  settingsOpen: boolean;
  /** account / cloud-sync dialog */
  authOpen: boolean;
  /** filters the dashboard, drive and planner down to one subject */
  filterSubjectId: string | null;

  go(view: AppView): void;
  openSubject(id: string | null): void;
  setPalette(open: boolean): void;
  setSettings(open: boolean): void;
  setAuth(open: boolean): void;
  setFilter(subjectId: string | null): void;
}

/**
 * Navigation state only. Kept apart from the document stores so moving
 * between screens never touches anything that is being saved.
 */
export const useApp = create<AppStore>((set) => ({
  view: 'dashboard',
  subjectId: null,
  paletteOpen: false,
  settingsOpen: false,
  authOpen: false,
  filterSubjectId: null,

  go(view) {
    set({ view, paletteOpen: false, subjectId: null });
  },
  openSubject(id) {
    set({ view: 'subjects', subjectId: id, paletteOpen: false });
  },
  setPalette(open) {
    set({ paletteOpen: open });
  },
  setSettings(open) {
    set({ settingsOpen: open });
  },
  setAuth(open) {
    set({ authOpen: open });
  },
  setFilter(subjectId) {
    set({ filterSubjectId: subjectId });
  },
}));
