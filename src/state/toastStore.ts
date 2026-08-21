import { create } from 'zustand';
import { uid } from '@/lib/util';

export type ToastTone = 'ok' | 'error' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
  /** one optional button, e.g. "Върни" after a delete */
  action?: { label: string; run: () => void };
  /** ms; errors stay until dismissed */
  timeout: number;
}

interface ToastStore {
  toasts: Toast[];
  push(t: Omit<Toast, 'id' | 'timeout'> & { timeout?: number }): string;
  dismiss(id: string): void;
  clear(): void;
}

/**
 * Small, transient messages.
 *
 * Before this, half the app reported success by simply not complaining and
 * the other half grew its own little inline banner. Neither tells you that a
 * background sync failed while you were on another screen — which is exactly
 * the kind of thing that has to reach you.
 */
export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],

  push(t) {
    const id = uid('t_');
    const timeout = t.timeout ?? (t.tone === 'error' ? 0 : 4000);
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id, timeout }] }));
    if (timeout > 0) window.setTimeout(() => get().dismiss(id), timeout);
    return id;
  },

  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },

  clear() {
    set({ toasts: [] });
  },
}));

/** Shorthand used everywhere instead of reaching into the store. */
export const notify = {
  ok: (title: string, detail?: string) => useToasts.getState().push({ tone: 'ok', title, detail }),
  info: (title: string, detail?: string) => useToasts.getState().push({ tone: 'info', title, detail }),
  error: (title: string, detail?: string) => useToasts.getState().push({ tone: 'error', title, detail }),
  /** an action that can be taken back, e.g. "moved to the bin · Undo" */
  undo: (title: string, label: string, run: () => void) =>
    // Long enough to notice it, read it and reach it — an undo that expires
    // while the hand is still moving is decoration.
    useToasts.getState().push({ tone: 'info', title, action: { label, run }, timeout: 9000 }),
};
