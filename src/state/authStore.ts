import { create } from 'zustand';
import { notify } from './toastStore';
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
import {
  cloudUsage,
  deleteAccount,
  pendingUploadCount,
  resetSyncState,
  runSync,
  syncPointer,
  wipeCloud,
} from '@/services/cloud/syncService';
import { useLibrary } from './libraryStore';
import { useCards } from './cardStore';
import { usePlanner } from './plannerStore';
import { useWorkspace } from './workspaceStore';
import { useTimer } from './timerStore';
import { tr, L } from '@/i18n';

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
   * True while the app was opened from a "reset your password" e-mail.
   * Supabase signs the person in with a short-lived recovery session, which
   * without this would look like an ordinary login — and the new password
   * they came to set would never get asked for.
   */
  recovery: boolean;
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
  /** leaves the recovery screen once the password is changed or abandoned */
  endRecovery(): void;

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
  /** removes the account itself, along with everything it holds */
  removeAccount(): Promise<string | null>;
  usage(): Promise<{ records: number; files: number; bytes: number } | null>;
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
  recovery: false,
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
    authWatcher = client.auth.onAuthStateChange((event, session) => {
      set({
        session,
        user: session?.user ?? null,
        awaitingConfirm: session ? null : get().awaitingConfirm,
        // The link from the "forgot password" mail arrives as a real session.
        // Without catching the event it would silently look like a login.
        recovery: event === 'PASSWORD_RECOVERY' ? true : get().recovery,
      });
      if (event === 'SIGNED_IN' && new URL(window.location.href).hash.includes('type=signup')) {
        notify.ok(tr(L('Имейлът е потвърден', 'E-mail confirmed')), tr(L('Профилът ти вече е активен.', 'Your account is active.')));
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }).data.subscription;

    if (data.session) {
      void get().refreshPending();
      if (get().autoSync) void get().syncNow();
      else {
        void useWorkspace.getState().adoptAccount({
          email: data.session.user.email,
          name: (data.session.user.user_metadata?.name as string | undefined) ?? null,
        });
      }
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

  endRecovery() {
    // The token lives in the fragment; leaving it there would put the app
    // back into recovery on the next reload.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    set({ recovery: false });
  },

  disconnect() {
    void getClient().then((c) => c?.auth.signOut());
    saveCloudConfig(null);
    resetClient();
    set({ configured: false, user: null, session: null, sync: EMPTY_SYNC });
  },

  async signIn(email, password) {
    const client = await getClient();
    if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return humanError(error);
    localStorage.removeItem(SKIP_KEY);
    set({ session: data.session, user: data.user, notice: null, awaitingConfirm: null, skipped: false });
    void get().syncNow();
    return null;
  },

  async signUp(email, password, name) {
    const client = await getClient();
    if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));
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
    if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));
    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return humanError(error);
    set({ notice: tr(L('Писмото е изпратено отново.', 'The e-mail has been sent again.')) });
    return null;
  },

  async resetPassword(email) {
    const client = await getClient();
    if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (error) return humanError(error);
    notify.ok(tr(L('Провери пощата си', 'Check your inbox')), tr(L('Изпратихме ти връзка за нова парола.', 'We sent you a link to set a new password.')));
    set({ notice: tr(L('Изпратихме ти писмо за нова парола.', 'We sent you an e-mail about a new password.')) });
    return null;
  },

  async changePassword(next) {
    const client = await getClient();
    if (!client) return tr(L('Облакът не е настроен.', 'The cloud is not configured.'));
    const { error } = await client.auth.updateUser({ password: next });
    if (error) return humanError(error);
    notify.ok(tr(L('Паролата е сменена', 'Password changed')));
    set({ notice: tr(L('Паролата е сменена.', 'The password has been changed.')) });
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
    if (!navigator.onLine) {
      set({ sync: { ...get().sync, phase: 'idle', label: tr(L('Изчаква връзка', 'Waiting for a connection')), progress: null } });
      return;
    }
    set({ sync: { ...get().sync, phase: 'checking', error: null, label: tr(L('Свързване…', 'Connecting…')), progress: null } });
    try {
      const result = await runSync((p) =>
        set({ sync: { ...get().sync, phase: p.phase, label: p.label, progress: p.progress, error: null } }),
      );
      if (result.pulled > 0) await reloadStores();
      // After the cloud copy has landed, so a name that already exists wins
      // over one derived from the e-mail address.
      const account = get().user;
      if (account) {
        await useWorkspace.getState().adoptAccount({
          email: account.email,
          name: (account.user_metadata?.name as string | undefined) ?? null,
        });
      }
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
      if (result.warning) notify.info(tr(L('Синхронизирано частично', 'Partly synced')), result.warning);
      void get().refreshPending();
    } catch (err) {
      const message = humanError(err);
      // Background syncs fail silently otherwise: the panel reporting it is
      // usually closed, and "my phone never got it" is found out far too late.
      notify.error(tr(L('Синхронизацията не мина', 'The sync did not go through')), message);
      set({
        sync: { ...get().sync, phase: 'error', label: '', progress: null, error: message },
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
      set({ sync: { ...EMPTY_SYNC }, pendingFiles: 0, notice: tr(L('Облакът е изчистен.', 'The cloud has been cleared.')) });
      return null;
    } catch (err) {
      return humanError(err);
    }
  },

  async removeAccount() {
    try {
      await deleteAccount();
      localStorage.removeItem(SKIP_KEY);
      set({ user: null, session: null, sync: EMPTY_SYNC, notice: null, skipped: false });
      notify.ok(tr(L('Профилът е изтрит', 'Account deleted')), tr(L('Данните на това устройство остават непокътнати.', 'The data on this device is untouched.')));
      return null;
    } catch (err) {
      return humanError(err);
    }
  },

  usage() {
    return cloudUsage();
  },

  clearNotice() {
    set({ notice: null, awaitingConfirm: null });
  },
}));

function summarise(pulled: number, pushed: number): string {
  if (!pulled && !pushed) return tr(L('Всичко е синхронизирано', 'Everything is in sync'));
  const parts: string[] = [];
  if (pulled) parts.push(tr(L(`${pulled} изтеглени`, `${pulled} in`)));
  if (pushed) parts.push(tr(L(`${pushed} изпратени`, `${pushed} out`)));
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
