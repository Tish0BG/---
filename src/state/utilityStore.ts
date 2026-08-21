import { create } from 'zustand';
import type { DockSide, UtilityId, UtilityWindow } from '@/types';
import { clamp, uid } from '@/lib/util';

const KEY = 'studypdf.utilities.v1';

export interface UtilityDef {
  id: UtilityId;
  name: string;
  hint: string;
  icon: string;
  /** preferred floating size */
  w: number;
  h: number;
  /** needs the network, so it is marked in the picker */
  online?: boolean;
}

/**
 * The tools a student reaches for while solving: they open next to the page
 * instead of in another tab, because switching windows is what breaks a train
 * of thought.
 */
export const UTILITIES: UtilityDef[] = [
  {
    id: 'calculator',
    name: 'Калкулатор',
    hint: 'Научен, с история и градуси/радиани',
    icon: 'calculator',
    w: 300,
    h: 430,
  },
  {
    id: 'periodic',
    name: 'Периодична таблица',
    hint: '118 елемента, работи и офлайн',
    icon: 'atom',
    w: 760,
    h: 470,
  },
  {
    id: 'ptable',
    name: 'ptable.com',
    hint: 'Пълната интерактивна таблица',
    icon: 'globe',
    w: 820,
    h: 560,
    online: true,
  },
  {
    id: 'converter',
    name: 'Мерни единици',
    hint: 'Дължина, маса, скорост, енергия…',
    icon: 'scale',
    w: 340,
    h: 420,
  },
  { id: 'graph', name: 'Графика на функция', hint: 'y = f(x), няколко наведнъж', icon: 'chartLine', w: 520, h: 440 },
  { id: 'formulas', name: 'Формули', hint: 'Математика, физика, химия', icon: 'sigma', w: 400, h: 500 },
  { id: 'triangle', name: 'Триъгълник', hint: 'Решава по три известни елемента', icon: 'triangle', w: 360, h: 470 },
  { id: 'notes', name: 'Бележник', hint: 'Черновата настрани от страницата', icon: 'listTodo', w: 340, h: 360 },
];

export const utilityDef = (id: UtilityId): UtilityDef =>
  UTILITIES.find((u) => u.id === id) ?? UTILITIES[0];

interface UtilityStore {
  windows: UtilityWindow[];
  /** the picker sheet */
  pickerOpen: boolean;

  open(id: UtilityId, dock?: DockSide): void;
  toggle(id: UtilityId): void;
  close(wid: string): void;
  closeAll(): void;
  focus(wid: string): void;
  update(wid: string, patch: Partial<UtilityWindow>): void;
  dock(wid: string, side: DockSide): void;
  setPicker(open: boolean): void;
  /** fraction of the reading area each edge has taken */
  insets(): { left: number; right: number; top: number; bottom: number };
}

function load(): UtilityWindow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as UtilityWindow[];
    return list.filter((w) => UTILITIES.some((u) => u.id === w.id));
  } catch {
    return [];
  }
}

function persist(windows: UtilityWindow[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(windows));
  } catch {
    /* private mode */
  }
}

let topZ = 10;

export const useUtilities = create<UtilityStore>((set, get) => ({
  windows: load(),
  pickerOpen: false,

  open(id, dock = 'float') {
    const def = utilityDef(id);
    // A tool already on screen is raised rather than duplicated: two
    // calculators are almost never what the click meant.
    const existing = get().windows.find((w) => w.id === id);
    if (existing) {
      get().focus(existing.wid);
      if (existing.minimized) get().update(existing.wid, { minimized: false });
      return;
    }
    const count = get().windows.length;
    const win: UtilityWindow = {
      wid: uid('uw_'),
      id,
      dock,
      x: clamp(120 + count * 28, 8, Math.max(8, window.innerWidth - def.w - 8)),
      y: clamp(90 + count * 24, 8, Math.max(8, window.innerHeight - def.h - 8)),
      w: Math.min(def.w, window.innerWidth - 24),
      h: Math.min(def.h, window.innerHeight - 120),
      split: 0.32,
      minimized: false,
      z: ++topZ,
    };
    const windows = [...get().windows, win];
    set({ windows, pickerOpen: false });
    persist(windows);
  },

  toggle(id) {
    const existing = get().windows.find((w) => w.id === id);
    if (existing) get().close(existing.wid);
    else get().open(id);
  },

  close(wid) {
    const windows = get().windows.filter((w) => w.wid !== wid);
    set({ windows });
    persist(windows);
  },

  closeAll() {
    set({ windows: [] });
    persist([]);
  },

  focus(wid) {
    const windows = get().windows.map((w) => (w.wid === wid ? { ...w, z: ++topZ } : w));
    set({ windows });
  },

  update(wid, patch) {
    const windows = get().windows.map((w) => (w.wid === wid ? { ...w, ...patch } : w));
    set({ windows });
    persist(windows);
  },

  dock(wid, side) {
    const win = get().windows.find((w) => w.wid === wid);
    if (!win) return;
    get().update(wid, { dock: side, z: ++topZ, minimized: false });
  },

  setPicker(open) {
    set({ pickerOpen: open });
  },

  insets() {
    const out = { left: 0, right: 0, top: 0, bottom: 0 };
    for (const w of get().windows) {
      if (w.dock === 'float' || w.minimized) continue;
      out[w.dock] = Math.max(out[w.dock], w.split);
    }
    return out;
  },
}));

/** Windows clipped to one edge, in the order they were docked. */
export const dockedAt = (windows: UtilityWindow[], side: DockSide): UtilityWindow[] =>
  windows.filter((w) => w.dock === side && !w.minimized).sort((a, b) => a.z - b.z);
