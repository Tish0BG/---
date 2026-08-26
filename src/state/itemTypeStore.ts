import { create } from 'zustand';
import type { ItemType, PlannerItem } from '@/types';
import { repo } from '@/services/storageService';
import { uid } from '@/lib/util';
import { currentLang, type Lang } from '@/i18n';

const KEY = 'itemTypes';

/**
 * ───────────────────────────────────────────────── what an entry can be ──
 *
 * The planner used to know three nouns — task, homework, exam — and all three
 * were about school. That is a guess about who is holding the app, and it was
 * wrong often enough to be worth undoing: the same list is a rehearsal
 * schedule, a set of shifts, a reading plan, a stack of deadlines at work.
 *
 * So a "kind" is now a small record anybody can make. The ones that ship are
 * still here, because they carry behaviour the rest of the app relies on — an
 * exam gets a countdown, a reminder arrives with a time, a habit comes back
 * tomorrow — and because deleting a built-in would orphan every entry already
 * filed under it. Everything beyond them is a name, an icon and a colour,
 * which is exactly as much as a type should ever be.
 *
 * The order below is the order of an ordinary day rather than of a timetable:
 * the plain task first, then the two that make the planner useful outside
 * school, and the schoolwork after them.
 */
export const BUILTIN_TYPES: ItemType[] = [
  {
    id: 'task',
    name: 'Задача',
    nameEn: 'Task',
    icon: 'listTodo',
    color: null,
    builtin: true,
    order: 0,
    updatedAt: 0,
  },
  {
    id: 'reminder',
    name: 'Напомняне',
    nameEn: 'Reminder',
    icon: 'bell',
    color: '#0ea5e9',
    builtin: true,
    order: 1,
    updatedAt: 0,
  },
  {
    id: 'habit',
    name: 'Навик',
    nameEn: 'Habit',
    icon: 'refresh',
    color: '#0d9488',
    builtin: true,
    order: 2,
    updatedAt: 0,
  },
  {
    id: 'errand',
    name: 'Ангажимент',
    nameEn: 'Errand',
    icon: 'bolt',
    color: '#9333ea',
    builtin: true,
    order: 3,
    updatedAt: 0,
  },
  {
    id: 'homework',
    name: 'Домашно',
    nameEn: 'Homework',
    icon: 'pencil',
    color: null,
    builtin: true,
    order: 4,
    updatedAt: 0,
  },
  {
    id: 'exam',
    name: 'Изпит',
    nameEn: 'Exam',
    icon: 'graduation',
    color: '#d97706',
    builtin: true,
    order: 5,
    updatedAt: 0,
  },
];

/**
 * What a new entry of each built-in kind starts as.
 *
 * A reminder without a time is a to-do with extra steps, and a habit that
 * does not come back is not a habit — so the two types that only make sense
 * with a setting arrive with it already made.
 */
export const KIND_DEFAULTS: Record<string, Partial<Pick<PlannerItem, 'method' | 'repeat'>> & { remind?: boolean }> = {
  reminder: { method: 'check', remind: true },
  habit: { method: 'check', repeat: 'daily' },
  exam: { method: 'timer' },
};

/** Icons offered when inventing a type. Every one of them reads at 14 px. */
export const TYPE_ICONS = [
  'listTodo',
  'bell',
  'refresh',
  'home',
  'coffee',
  'pencil',
  'graduation',
  'book',
  'flag',
  'bolt',
  'target',
  'calendar',
  'clock',
  'flask',
  'code',
  'palette',
  'music',
  'globe',
  'rocket',
  'star',
  'sparkles',
  'brain',
  'medal',
  'send',
  'shield',
  'leaf',
];

/** Ten hues that stay legible on both themes — the subject palette, reused. */
export const TYPE_COLORS = [
  '#4f46e5',
  '#0ea5e9',
  '#0d9488',
  '#16a34a',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#9333ea',
  '#64748b',
];

/**
 * What is written to the meta bucket.
 *
 * An `updatedAt` on the envelope rather than only on each type: the sync
 * engine merges meta keys whole and compares one timestamp per key, so a bare
 * array would always look like it had never changed.
 */
interface StoredTypes {
  types: ItemType[];
  updatedAt: number;
}

interface ItemTypeStore {
  /** the invented ones only; the built-ins are constants */
  custom: ItemType[];
  loaded: boolean;

  init(): Promise<void>;
  create(patch: Partial<ItemType>): Promise<ItemType>;
  update(id: string, patch: Partial<ItemType>): Promise<void>;
  /** entries keep their kind; the type simply stops being offered */
  remove(id: string): Promise<void>;
  reorder(id: string, delta: number): Promise<void>;
}

export const useItemTypes = create<ItemTypeStore>((set, get) => {
  /** One write path, so every change carries a fresh timestamp for the cloud. */
  const persist = async (types: ItemType[]) => {
    set({ custom: types });
    await repo.setMeta<StoredTypes>(KEY, { types, updatedAt: Date.now() });
  };

  return {
  custom: [],
  loaded: false,

  async init() {
    // Older devices wrote a bare array; both shapes have to read.
    const saved = await repo.getMeta<StoredTypes | ItemType[]>(KEY);
    const types = Array.isArray(saved) ? saved : (saved?.types ?? []);
    set({ custom: types, loaded: true });
  },

  async create(patch) {
    const list = get().custom;
    const type: ItemType = {
      id: uid('ty_'),
      name: '',
      icon: 'listTodo',
      color: TYPE_COLORS[(BUILTIN_TYPES.length + list.length) % TYPE_COLORS.length],
      order: BUILTIN_TYPES.length + list.length,
      updatedAt: Date.now(),
      ...patch,
    };
    await persist([...list, type]);
    return type;
  },

  async update(id, patch) {
    await persist(
      get().custom.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)),
    );
  },

  async remove(id) {
    await persist(get().custom.filter((x) => x.id !== id));
  },

  async reorder(id, delta) {
    const list = [...get().custom];
    const from = list.findIndex((x) => x.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    await persist(list.map((x, i) => ({ ...x, order: BUILTIN_TYPES.length + i, updatedAt: Date.now() })));
  },
  };
});

/* --------------------------------------------------------------- helpers */

/** Every type on offer, built-ins first, in the order they are drawn. */
export function allTypes(custom: ItemType[], includeArchived = false): ItemType[] {
  const list = [...BUILTIN_TYPES, ...custom.filter((t) => includeArchived || !t.archived)];
  return list.sort((a, b) => a.order - b.order);
}

/**
 * The type behind a `kind`, never undefined.
 *
 * An entry filed under a type that has since been deleted still has to draw,
 * and drawing it as an ordinary task is a better answer than an empty row.
 */
export function typeOf(kind: string, custom: ItemType[]): ItemType {
  return (
    BUILTIN_TYPES.find((t) => t.id === kind) ??
    custom.find((t) => t.id === kind) ??
    BUILTIN_TYPES[0]
  );
}

/** The label in the language being read. Custom types have one name only. */
export function typeName(type: ItemType, lang: Lang = currentLang()): string {
  if (lang === 'en' && type.nameEn) return type.nameEn;
  return type.name;
}

/** React-friendly: the full list, already merged and sorted. */
export const useAllTypes = (): ItemType[] => allTypes(useItemTypes((s) => s.custom));
