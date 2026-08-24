import { create } from 'zustand';
import type { LearningProfile, PrivacySettings, Profile, Subject } from '@/types';
import { repo } from '@/services/storageService';
import { uid } from '@/lib/util';
import { currentLang, tr, L, type Lang } from '@/i18n';

const PROFILE_KEY = 'profile';
const LEARNING_KEY = 'learning';
const PRIVACY_KEY = 'privacy';

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

/**
 * The subjects offered during setup, so it is two clicks rather than twenty.
 *
 * In both languages, and in one place. There used to be two lists — this one
 * in Bulgarian, and a second inside the setup screen with English beside it —
 * which meant an English visitor picked "Chemistry" in setup and then got a
 * subject called "Химия" from the button on the subjects screen. A list that
 * exists twice will disagree with itself eventually; this one exists once.
 *
 * Nothing here is created on its own. These are names on buttons: a subject
 * appears when somebody taps one, and never before.
 */
export const SUGGESTED_SUBJECTS: { icon: string; bg: string; en: string }[] = [
  { icon: 'sigma', bg: 'Математика', en: 'Mathematics' },
  { icon: 'book', bg: 'Български език и литература', en: 'Literature' },
  { icon: 'globe', bg: 'Английски език', en: 'English' },
  { icon: 'atom', bg: 'Физика', en: 'Physics' },
  { icon: 'flask', bg: 'Химия', en: 'Chemistry' },
  { icon: 'leaf', bg: 'Биология', en: 'Biology' },
  { icon: 'target', bg: 'История', en: 'History' },
  { icon: 'globe', bg: 'География', en: 'Geography' },
  { icon: 'code', bg: 'Информатика', en: 'Computer science' },
  { icon: 'palette', bg: 'Изкуство', en: 'Art' },
];

/** The same list, resolved to the names a person is actually being shown. */
export const suggestedSubjects = (lang: Lang = currentLang()): { name: string; icon: string }[] =>
  SUGGESTED_SUBJECTS.map((s) => ({ name: s[lang], icon: s.icon }));

export const EMPTY_PROFILE: Profile = {
  name: '',
  lastName: '',
  username: '',
  avatar: '🦉',
  color: SUBJECT_COLORS[0],
  school: '',
  grade: '',
  bio: '',
  createdAt: 0,
  updatedAt: 0,
};

export const EMPTY_LEARNING: LearningProfile = {
  interests: [],
  level: 'unsure',
  goals: [],
  styles: [],
  sessionMinutes: 0,
  updatedAt: 0,
};

/**
 * Everything closed. Nothing in the product publishes a profile today, and a
 * default that assumes otherwise is the kind of thing nobody notices until it
 * has already published something.
 */
export const EMPTY_PRIVACY: PrivacySettings = {
  profile: 'private',
  displayName: 'private',
  interests: 'private',
  achievements: 'private',
  progress: 'private',
  updatedAt: 0,
};

interface WorkspaceStore {
  profile: Profile;
  learning: LearningProfile;
  privacy: PrivacySettings;
  subjects: Subject[];
  loaded: boolean;

  init(): Promise<void>;
  saveProfile(patch: Partial<Profile>): Promise<void>;
  saveLearning(patch: Partial<LearningProfile>): Promise<void>;
  savePrivacy(patch: Partial<PrivacySettings>): Promise<void>;
  /**
   * Fills in whatever the account already knows, so signing in lands straight
   * in the app. A questionnaire between "I just registered" and "I can use
   * the thing" is a setup wizard, not a product.
   */
  adoptAccount(account: {
    email?: string | null;
    /** whatever the provider called them; Google sends the full name */
    name?: string | null;
    /** Google's `given_name`, when the provider bothered to split it */
    firstName?: string | null;
    avatarUrl?: string | null;
  }): Promise<void>;
  /** Adds several subjects at once, for the first-run picker. */
  createSubjects(names: string[]): Promise<void>;

  createSubject(patch: Partial<Subject>): Promise<Subject>;
  updateSubject(id: string, patch: Partial<Subject>): Promise<void>;
  deleteSubject(id: string): Promise<void>;
  reorderSubject(id: string, delta: number): Promise<void>;
  /** never returns undefined for the UI: unknown ids fall back to "no subject" */
  subject(id: string | null | undefined): Subject | null;
}

export const useWorkspace = create<WorkspaceStore>((set, get) => ({
  profile: EMPTY_PROFILE,
  learning: EMPTY_LEARNING,
  privacy: EMPTY_PRIVACY,
  subjects: [],
  loaded: false,

  async init() {
    const [profile, learning, privacy, subjects] = await Promise.all([
      repo.getMeta<Profile>(PROFILE_KEY),
      repo.getMeta<LearningProfile>(LEARNING_KEY),
      repo.getMeta<PrivacySettings>(PRIVACY_KEY),
      repo.listSubjects(),
    ]);
    subjects.sort((a, b) => a.order - b.order);
    set({
      profile: { ...EMPTY_PROFILE, ...(profile ?? {}) },
      learning: { ...EMPTY_LEARNING, ...(learning ?? {}) },
      privacy: { ...EMPTY_PRIVACY, ...(privacy ?? {}) },
      subjects,
      loaded: true,
    });
  },

  async saveProfile(patch) {
    const next = { ...get().profile, ...patch, updatedAt: Date.now() };
    if (!next.createdAt) next.createdAt = Date.now();
    set({ profile: next });
    await repo.setMeta(PROFILE_KEY, next);
  },

  async saveLearning(patch) {
    const next = { ...get().learning, ...patch, updatedAt: Date.now() };
    set({ learning: next });
    await repo.setMeta(LEARNING_KEY, next);
  },

  async savePrivacy(patch) {
    const next = { ...get().privacy, ...patch, updatedAt: Date.now() };
    set({ privacy: next });
    await repo.setMeta(PRIVACY_KEY, next);
  },

  async adoptAccount(account) {
    const profile = get().profile;
    // Google hands over "Tihomir Georgiev"; the dashboard says "Good
    // afternoon, ___". A greeting that uses somebody's full legal name reads
    // like a letter from a bank, so the given name wins where there is one and
    // the first word does the job where there is not.
    const given = (account.firstName ?? '').trim();
    const full = (account.name ?? '').trim();
    const fromAccount = given || full.split(/\s+/)[0] || '';
    const fromEmail = (account.email ?? '').split('@')[0].replace(/[._-]+/g, ' ').trim();
    const name = profile.name.trim() || fromAccount || titleCase(fromEmail);
    // The surname is kept, separately, when the provider gave a full one — it
    // is optional everywhere in the product, so it is stored and never asked.
    const rest = full.split(/\s+/).slice(1).join(' ');
    const lastName = profile.lastName.trim() || (fromAccount === given || full.startsWith(name) ? rest : '');

    if (profile.name.trim() === name && profile.lastName.trim() === lastName && profile.createdAt) return;
    await get().saveProfile({ name, lastName, createdAt: profile.createdAt || Date.now() });
  },

  async createSubjects(names) {
    for (const name of names) {
      if (get().subjects.some((s) => s.name === name)) continue;
      // Matched in either language: the name arrives in whichever one the
      // person was reading, and the icon should follow it either way.
      const suggestion = SUGGESTED_SUBJECTS.find((s) => s.bg === name || s.en === name);
      await get().createSubject({ name, icon: suggestion?.icon ?? 'book' });
    }
  },

  async createSubject(patch) {
    const list = get().subjects;
    const subject: Subject = {
      id: uid('sb_'),
      name: tr(L('Нов предмет', 'New subject')),
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

const titleCase = (s: string): string =>
  s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Colour to paint anything tagged with this subject; grey when untagged. */
export const subjectColor = (subject: Subject | null): string => subject?.color ?? 'var(--c-faint)';
