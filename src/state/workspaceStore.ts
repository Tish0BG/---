import { create } from 'zustand';
import type { Profile, Subject } from '@/types';
import { repo } from '@/services/storageService';
import { uid } from '@/lib/util';

const PROFILE_KEY = 'profile';

/** Ten distinguishable hues that survive both themes. */
export const SUBJECT_COLORS = [
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

export const SUBJECT_ICONS = [
  'sigma',
  'book',
  'globe',
  'flask',
  'atom',
  'leaf',
  'palette',
  'music',
  'code',
  'target',
];

/** Offered on the welcome screen so setup is two clicks, not twenty. */
export const SUGGESTED_SUBJECTS: { name: string; icon: string }[] = [
  { name: 'Математика', icon: 'sigma' },
  { name: 'Български език и литература', icon: 'book' },
  { name: 'Английски език', icon: 'globe' },
  { name: 'История', icon: 'target' },
  { name: 'География', icon: 'globe' },
  { name: 'Биология', icon: 'leaf' },
  { name: 'Химия', icon: 'flask' },
  { name: 'Физика', icon: 'atom' },
  { name: 'Информатика', icon: 'code' },
];

export const EMPTY_PROFILE: Profile = {
  name: '',
  avatar: '🦉',
  color: SUBJECT_COLORS[0],
  school: '',
  grade: '',
  createdAt: 0,
  updatedAt: 0,
  onboarded: false,
};

interface WorkspaceStore {
  profile: Profile;
  subjects: Subject[];
  loaded: boolean;

  init(): Promise<void>;
  saveProfile(patch: Partial<Profile>): Promise<void>;

  createSubject(patch: Partial<Subject>): Promise<Subject>;
  updateSubject(id: string, patch: Partial<Subject>): Promise<void>;
  deleteSubject(id: string): Promise<void>;
  reorderSubject(id: string, delta: number): Promise<void>;
  /** never returns undefined for the UI: unknown ids fall back to "no subject" */
  subject(id: string | null | undefined): Subject | null;
}

export const useWorkspace = create<WorkspaceStore>((set, get) => ({
  profile: EMPTY_PROFILE,
  subjects: [],
  loaded: false,

  async init() {
    const [profile, subjects] = await Promise.all([
      repo.getMeta<Profile>(PROFILE_KEY),
      repo.listSubjects(),
    ]);
    subjects.sort((a, b) => a.order - b.order);
    set({ profile: { ...EMPTY_PROFILE, ...(profile ?? {}) }, subjects, loaded: true });
  },

  async saveProfile(patch) {
    const next = { ...get().profile, ...patch, updatedAt: Date.now() };
    if (!next.createdAt) next.createdAt = Date.now();
    set({ profile: next });
    await repo.setMeta(PROFILE_KEY, next);
  },

  async createSubject(patch) {
    const list = get().subjects;
    const subject: Subject = {
      id: uid('sb_'),
      name: 'Нов предмет',
      color: SUBJECT_COLORS[list.length % SUBJECT_COLORS.length],
      icon: 'book',
      teacher: '',
      archived: false,
      order: list.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...patch,
    };
    await repo.putSubject(subject);
    set({ subjects: [...list, subject] });
    return subject;
  },

  async updateSubject(id, patch) {
    const current = get().subjects.find((s) => s.id === id);
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: Date.now() };
    await repo.putSubject(next);
    set((s) => ({ subjects: s.subjects.map((x) => (x.id === id ? next : x)) }));
  },

  /** Materials and cards keep existing; they simply lose their tag. */
  async deleteSubject(id) {
    await repo.deleteSubject(id);
    set((s) => ({ subjects: s.subjects.filter((x) => x.id !== id) }));
  },

  async reorderSubject(id, delta) {
    const list = [...get().subjects];
    const from = list.findIndex((s) => s.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const renumbered = list.map((s, i) => ({ ...s, order: i, updatedAt: Date.now() }));
    set({ subjects: renumbered });
    for (const s of renumbered) await repo.putSubject(s);
  },

  subject(id) {
    if (!id) return null;
    return get().subjects.find((s) => s.id === id) ?? null;
  },
}));

/** Colour to paint anything tagged with this subject; grey when untagged. */
export const subjectColor = (subject: Subject | null): string => subject?.color ?? 'var(--c-faint)';
