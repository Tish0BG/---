import { create } from 'zustand';
import type { Rect } from '@/types';
import { captureRegion, type Snip } from '@/services/snipService';

/**
 * Holds the clip between "the student let go of the mouse" and "the student
 * decided what to do with it". Kept out of the viewer store because it is a
 * transient UI concern, not document state.
 */
interface SnipStore {
  pending: (Snip & { url: string }) | null;
  /** the rectangle is remembered so "с бележките" can re-cut the same area */
  source: { page: number; rect: Rect } | null;
  withInk: boolean;
  busy: boolean;

  capture(page: number, rect: Rect): Promise<void>;
  recapture(withInk: boolean): Promise<void>;
  clear(): void;
}

export const useSnip = create<SnipStore>((set, get) => ({
  pending: null,
  source: null,
  withInk: false,
  busy: false,

  async capture(page, rect) {
    set({ busy: true, source: { page, rect } });
    try {
      const snip = await captureRegion(page, rect, get().withInk);
      if (get().pending) URL.revokeObjectURL(get().pending!.url);
      set({ pending: snip ? { ...snip, url: URL.createObjectURL(snip.blob) } : null });
    } finally {
      set({ busy: false });
    }
  },

  async recapture(withInk) {
    const src = get().source;
    set({ withInk });
    if (src) await get().capture(src.page, src.rect);
  },

  clear() {
    const p = get().pending;
    if (p) URL.revokeObjectURL(p.url);
    set({ pending: null, source: null });
  },
}));
