import { create } from 'zustand';

const KEY = 'plauvia.notices.read.v1';

/**
 * Which notices have been seen.
 *
 * The feed itself is derived on every render (see `notificationService`), so
 * the only state worth keeping is what has already been read — a set of ids in
 * localStorage, trimmed so it cannot grow without bound.
 */
interface NoticeStore {
  read: Record<string, number>;
  open: boolean;

  setOpen(open: boolean): void;
  markRead(ids: string[]): void;
  markAllRead(ids: string[]): void;
  isRead(id: string): boolean;
}

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const cutoff = Date.now() - 30 * 86_400_000;
    return Object.fromEntries(Object.entries(parsed).filter(([, at]) => at > cutoff));
  } catch {
    return {};
  }
}

function persist(read: Record<string, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(read));
  } catch {
    /* private mode */
  }
}

export const useNotices = create<NoticeStore>((set, get) => ({
  read: load(),
  open: false,

  setOpen(open) {
    set({ open });
  },

  markRead(ids) {
    if (!ids.length) return;
    const read = { ...get().read };
    const now = Date.now();
    for (const id of ids) read[id] = now;
    persist(read);
    set({ read });
  },

  markAllRead(ids) {
    get().markRead(ids);
  },

  isRead(id) {
    return !!get().read[id];
  },
}));
