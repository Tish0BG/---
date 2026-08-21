import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { SyncState } from '@/types';
import { getClient, humanError, resetClient } from '@/services/cloud/client';
import {
  cloudConfig,
  isCloudConfigured,
  isCloudFixed,
  loadRuntimeConfig,
  saveCloudConfig,
  validateConfig,
} from '@/services/cloud/config';
import { pendingUploadCount, resetSyncState, runSync, syncPointer, wipeCloud } from '@/services/cloud/syncService';
import { useLibrary } from './libraryStore';
import { useCards } from './cardStore';
import { usePlanner } from './plannerStore';
import { useWorkspace } from './workspaceStore';
import { useTimer } from './timerStore';

const AUTO_KEY = 'studypdf.autosync';
/** Remembers "I'll use this without an account", so the door is only held open once. */
const SKIP_KEY = 'studypdf.skipauth';
/** Quiet background sync interval while the app is open. */
const AUTO_EVERY = 5 * 60 * 1000;

const EMPTY_SYNC: SyncState = {
  phase: 'idle',
  label: '',
  progress: null,
  lastSyncAt: null,
  error: null,
  pulled: 0,
  pushed: 0,
};

interface AuthStore {
  /** null until the first session check finishes */
  ready: boolean;
  configured: boolean;
  /** true when the keys come from the build and cannot be edited here */
  fixed: boolean;
  user: User | null;
  session: Session | null;
  sync: SyncState;
  autoSync: boolean;
  pendingFiles: number;
  /**
   * True once the person has said they want to use the app without an
   * account. The sign-in page is the front door of the site, but a door that
   * cannot be walked past is a wall.
   */
  skipped: boolean;
  /** last message from a sign-up / reset flow */
  notice: string | null;
  /**
   * Set after registering when the project asks for e-mail confirmation:
   * Supabase hands back a user but no session, so the app has to say plainly
   * that nothing is signed in yet and why.
   */
  awaitingConfirm: string | null;

  init(): Promise<void>;
  configure(url: string, anonKey: string): Promise<string | null>;
  disconnect(): void;
  /** continue without signing in, and stop asking */
  skip(): void;

  signIn(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string, name: string): Promise<string | null>;
  resendConfirmation(email: string): Promise<string | null>;
  resetPassword(email: string): Promise<string | null>;
  changePassword(next: string): Promise<string | null>;
  signOut(): Promise<void>;

  syncNow(): Promise<void>;
  setAutoSync(on: boolean): void;
  refreshPending(): Promise<void>;
  wipeRemote(): Promise<string | null>;
  clearNotice(): void;
}

/** Re-reads every store from IndexedDB after records arrive from the cloud. */
async function reloadStores(): Promise<void> {
  await Promise.all([
    useLibrary.getState().init(),
    useCards.getState().init(),
    usePlanner.getState().init(),
    useWorkspace.getState().init(),
    useTimer.getState().init(),
  ]);
}

let autoTimer: number | null = null;
let authWatcher: { unsubscribe: () => void } | null = null;

export const useAuth = create<AuthStore>((set, get) => ({
  ready: false,
  configured: isCloudConfigured(),
  fixed: isCloudFixed(),
  user: null,
  session: null,
  sync: EMPTY_SYNC,
  autoSync: localStorage.getItem(AUTO_KEY) !== 'off',
  pendingFiles: 0,
  skipped: localStorage.getItem(SKIP_KEY) === 'yes',
  notice: null,
  awaitingConfirm: null,

  async init() {
    // The site may carry its own cloud.json; it has to be read before we can
    // say whether this install has a backend at all.
    await loadRuntimeConfig();
    const client = await getClient();
    if (!client) {
      set({ ready: true, configured: false });
      return;
    }
    const { data } = await client.auth.getSession();
    const pointer = await syncPointer();
    set({
      ready: true,
      configured: true,
      session: data.session ?? null,
      user: data.session?.user ?? null,
      sync: { ...EMPTY_SYNC, lastSyncAt: pointer?.lastSyncAt || null },
    });

    // init() runs on mount and again after the keys change; without this the
    // app would end up with a listener per call.
    authWatcher?.unsubscribe();
    authWatcher = client.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, awaitingConfirm: session ? null : get().awaitingConfirm });
    }).data.subscription;

    if (data.session) {
      void get().refreshPending();
      if (get().autoSync) void get().syncNow();
    }
    get().setAutoSync(get().autoSync);
  },

  async configure(url, anonKey) {
    const problem = validateConfig(url, anonKey);
    if (problem) return problem;
    saveCloudConfig({ url: url.trim(), anonKey: anonKey.trim() });
    resetClient();
    set({ configured: true, ready: false, user: null, session: null });
    await get().init();
    return null;
  },

  skip() {
    localStorage.setItem(SKIP_KEY, 'yes');
    set({ skipped: true });
  },

  disconnect() {
    void getClient().then((c) => c?.auth.signOut());
    saveCloudConfig(null);
    resetClient();
    set({ configured: false, user: null, session: null, sync: EMPTY_SYNC });
  },

  async signIn(email, password) {
    const client = await getClient();
    if (!client) return 'Облакът не е настроен.';
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return humanError(error);
    localStorage.removeItem(SKIP_KEY);
    set({ session: data.session, user: data.user, notice: null, awaitingConfirm: null, skipped: false });
    void get().syncNow();
    return null;
  },

  async signUp(email, password, name) {
    const client = await getClient();
    if (!client) return 'Облакът не е настроен.';
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) return humanError(error);
    // With "Confirm email" on, Supabase hands back a user but no session — the
    // account exists and yet nothing is signed in. Saying so is the whole
    // difference between "it doesn't work" and "check your inbox".
    if (!data.session) {
      set({ awaitingConfirm: email.trim(), notice: null });
      return null;
    }
    localStorage.removeItem(SKIP_KEY);
    set({ session: data.session, user: data.user, notice: null, awaitingConfirm: null, skipped: false });
    if (name) {
      const profile = useWorkspace.getState().profile;
      if (!profile.name) await useWorkspace.getState().saveProfile({ name });
    }
    void get().syncNow();
    return null;
  },

  async resendConfirmation(email) {
    const client = await getClient();
    if (!client) return 'Облакът не е настроен.';
    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return humanError(error);
    set({ notice: 'Писмото е изпратено отново.' });
    return null;
  },

  async resetPassword(email) {
    const client = await getClient();
    if (!client) return 'Облакът не е настроен.';
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (error) return humanError(error);
    set({ notice: 'Изпратихме ти писмо за нова парола.' });
    return null;
  },

  async changePassword(next) {
    const client = await getClient();
    if (!client) return 'Облакът не е настроен.';
    const { error } = await client.auth.updateUser({ password: next });
    if (error) return humanError(error);
    set({ notice: 'Паролата е сменена.' });
    return null;
  },

  async signOut() {
    await (await getClient())?.auth.signOut();
    // The watermarks belong to the account, not to the browser.
    await resetSyncState();
    localStorage.removeItem(SKIP_KEY);
    set({ user: null, session: null, sync: EMPTY_SYNC, notice: null, awaitingConfirm: null, skipped: false });
  },

  async syncNow() {
    if (!get().user || get().sync.phase === 'pulling' || get().sync.phase === 'pushing') return;
    set({ sync: { ...get().sync, phase: 'checking', error: null, label: 'Свързване…', progress: null } });
    try {
      const result = await runSync((p) =>
        set({ sync: { ...get().sync, phase: p.phase, label: p.label, progress: p.progress, error: null } }),
      );
      if (result.pulled > 0) await reloadStores();
      set({
        sync: {
          phase: 'done',
          label: result.warning ?? summarise(result.pulled, result.pushed),
          progress: null,
          lastSyncAt: result.at,
          error: null,
          warning: result.warning,
          pulled: result.pulled,
          pushed: result.pushed,
        },
      });
      void get().refreshPending();
    } catch (err) {
      set({
        sync: { ...get().sync, phase: 'error', label: '', progress: null, error: humanError(err) },
      });
    }
  },

  setAutoSync(on) {
    localStorage.setItem(AUTO_KEY, on ? 'on' : 'off');
    set({ autoSync: on });
    if (autoTimer) window.clearInterval(autoTimer);
    autoTimer = null;
    if (on) {
      autoTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible' && useAuth.getState().user) void useAuth.getState().syncNow();
      }, AUTO_EVERY);
    }
  },

  async refreshPending() {
    if (!get().user) return set({ pendingFiles: 0 });
    set({ pendingFiles: await pendingUploadCount() });
  },

  async wipeRemote() {
    try {
      await wipeCloud();
      set({ sync: { ...EMPTY_SYNC }, pendingFiles: 0, notice: 'Облакът е изчистен.' });
      return null;
    } catch (err) {
      return humanError(err);
    }
  },

  clearNotice() {
    set({ notice: null, awaitingConfirm: null });
  },
}));

function summarise(pulled: number, pushed: number): string {
  if (!pulled && !pushed) return 'Всичко е синхронизирано';
  const parts: string[] = [];
  if (pulled) parts.push(`${pulled} изтеглени`);
  if (pushed) parts.push(`${pushed} изпратени`);
  return parts.join(' · ');
}

/** Syncs once more when the tab is hidden, so a phone picks the work up. */
export function installSyncEffects(): () => void {
  const onHide = () => {
    if (document.visibilityState === 'hidden' && useAuth.getState().user && useAuth.getState().autoSync) {
      void useAuth.getState().syncNow();
    }
  };
  document.addEventListener('visibilitychange', onHide);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    if (autoTimer) window.clearInterval(autoTimer);
    autoTimer = null;
  };
}

export { cloudConfig };
