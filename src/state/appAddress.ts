import { useEffect } from 'react';
import { applyHead } from '@/seo/head';
import { entryPath, isAppPath, normalisePath } from '@/seo/routes';
import { currentLang, tr, L } from '@/i18n';
import { useApp, VIEW_TITLES, resolveView, type AppView } from './appStore';
import { useAuth } from './authStore';
import { useRoute } from './routeStore';
import { useTimer } from './timerStore';
import { useViewer } from './viewerStore';
import { useNotes } from './noteStore';
import { useWorkspace } from './workspaceStore';

/**
 * ─────────────────────────────────────────────── the app's own addresses ──
 *
 * Every screen has a URL now. `/app/calendar` can be bookmarked, sent to
 * somebody, opened in a second tab and reached with the Back button, and the
 * tab it opens in says which screen it is.
 *
 * This costs nothing offline, which is the thing people expect it to cost.
 * The address changes with `pushState` — no request leaves the browser — and
 * the service worker answers every navigation from the cached shell anyway.
 * A cold start at `/app/calendar` on a plane works exactly as `/` does.
 *
 * The address is a **pure function of the stores**, computed in one place
 * below rather than pushed from thirty call sites. Nothing had to learn to
 * navigate: opening a document, ticking into a focus session and switching a
 * screen all already change state, and the address follows the state. The one
 * direction that needs code is the way back in — `applyAppPath`, for a link
 * somebody pasted or a Back button they pressed.
 */

/**
 * The two addresses the plan absorbed.
 *
 * They still answer — people bookmarked them — but the app straightens them
 * out to `/plan` in place rather than pushing a second history entry.
 * `/goals` is here because the feature was removed, not merged: the nearest
 * live screen is a better answer to an old bookmark than a 404.
 */
const LEGACY_PLAN_PATHS = ['/tasks', '/goals'];

/** The address of each screen. The slug is the name the app already uses. */
export const VIEW_PATHS: Record<AppView, string> = {
  dashboard: '/dashboard',
  drive: '/library',
  plan: '/plan',
  calendar: '/calendar',
  cards: '/cards',
  focus: '/focus',
  subjects: '/subjects',
  stats: '/stats',
  achievements: '/achievements',
  exams: '/exams',
  profile: '/profile',
};

/**
 * Where the app currently is, in one expression.
 *
 * The order is what is actually filling the window, innermost first: a
 * document takes the whole screen, a focus session covers everything, and
 * settings sit over whichever screen you were on.
 */
export function appAddress(): string {
  const note = useNotes.getState().docId;
  if (note) return `/note/${note}`;
  const doc = useViewer.getState().docId;
  if (doc) return `/document/${doc}`;

  const app = useApp.getState();
  /**
   * The settings are one window, and the address says so: `/settings`,
   * whichever room you are standing in.
   *
   * Which room that is stays internal, like a scroll position. It used to
   * reach the address, which meant the thing read `/settings/security` and
   * then `/settings/backup` as somebody clicked down the list — a different
   * address for every glance at the same window.
   *
   * `/settings/sync` still *opens* the sync section when somebody follows a
   * link to it. It just does not stay in the address afterwards.
   */
  if (app.settingsOpen) return '/settings';
  // Full screen is a way of *looking* at the focus screen, not a place of its
  // own — both answer to `/focus`, so leaving full screen does not shove a
  // second entry into the history.
  if (useTimer.getState().view === 'full') return '/focus';
  if (app.subjectId) return `/subjects/${app.subjectId}`;
  return VIEW_PATHS[app.view];
}

/** The same question, answered in words for the browser tab. */
export function appLabel(): string {
  const note = useNotes.getState();
  if (note.docId) return note.meta?.name ?? tr(L('Документ', 'Document'));
  const viewer = useViewer.getState();
  if (viewer.docId) return viewer.meta?.name ?? tr(L('Документ', 'Document'));

  const app = useApp.getState();
  if (app.settingsOpen) return tr(L('Настройки', 'Settings'));
  if (useTimer.getState().view === 'full') return tr(L('Фокус', 'Focus'));
  if (app.subjectId) {
    const subject = useWorkspace.getState().subjects.find((s) => s.id === app.subjectId);
    if (subject) return subject.name;
  }
  return tr(VIEW_TITLES[app.view]);
}

/**
 * The way back in, for any address at all.
 *
 * Called on every arrival — a pasted link, a bookmark, the Back button — and
 * it has to answer the negative case as well as the positive one: walking
 * back out of `/login` to `/homepage` must *shut* the door, or the form stays
 * on the screen over a page whose address says it is not there.
 */
export function applyAddress(path: string): void {
  if (isAppPath(path)) {
    applyAppPath(path);
    return;
  }
  const app = useApp.getState();
  if (app.authOpen && !useAuth.getState().user) app.setAuth(false);
}

/**
 * The way back into the app itself.
 *
 * Deliberately tolerant. An address that names a document which has since
 * been deleted, or a subject that no longer exists, opens the screen it
 * belongs to rather than an error — a stale bookmark is a normal thing to
 * have, not a fault to report.
 */
export function applyAppPath(path: string): void {
  const clean = entryPath(path);
  const [, head = '', id = ''] = clean.split('/');
  const app = useApp.getState();

  // An address says what is open *and* what is not. Pressing Back out of the
  // settings has to shut them, or the dialog stays up over a screen whose
  // address says it should not be there.
  if (head !== 'settings' && app.settingsOpen) app.setSettings(false);
  if (head !== 'focus' && useTimer.getState().view === 'full') useTimer.getState().setView('mini');
  if (head !== 'document' && useViewer.getState().docId) void useViewer.getState().closeDocument();
  if (head !== 'note' && useNotes.getState().docId) void useNotes.getState().close();

  if (head === 'document' && id) {
    void useViewer.getState().openDocument(id);
    return;
  }
  if (head === 'note' && id) {
    void useNotes.getState().open(id);
    return;
  }
  if (head === 'settings') {
    app.setSettings(true, id || undefined);
    return;
  }
  if (head === 'focus') {
    app.go('focus');
    return;
  }
  if (head === 'subjects' && id) {
    app.openSubject(id);
    return;
  }
  // The door. `/login` and `/register` are addresses like any other: pasted,
  // bookmarked, and reached with Back.
  if (head === 'login' || head === 'register') {
    app.setAuth(true, head === 'register' ? 'signup' : 'signin');
    return;
  }
  if (head === 'dashboard' || head === '') {
    app.go('dashboard');
    return;
  }
  const view = resolveView(head);
  // `/tasks` and `/goals` are the plan; everything else is its own screen.
  if (view === 'plan') app.goPlan(null);
  else if (view) app.go(view);
}

/**
 * Writes the address and the tab title while the app is on screen.
 *
 * Mounted from the two components that own the window — the shell and the
 * document workspace — so the public pages keep their own addresses and are
 * never overwritten by an app screen that happens to be remembered in state.
 *
 * `pushState` only when the address really differs: coming back through
 * history the address is already right, and pushing again would bury the
 * entry the person just pressed Back to reach.
 */
function sync(): void {
  const next = appAddress();
  const label = appLabel();
  const here = normalisePath(window.location.pathname);

  if (next !== here) {
    // Collapsing `/settings/sync` to `/settings`, or `/tasks` to `/plan`, is
    // the address correcting itself rather than a move. Pushing would leave a
    // Back button that walks straight back into the same correction — and in
    // the alias case, into an infinite one.
    const correcting =
      (here.startsWith('/settings/') && next === '/settings') ||
      (LEGACY_PLAN_PATHS.includes(here) && next === '/plan');
    const url = `${next}${window.location.hash}`;
    if (correcting) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }
  if (useRoute.getState().path !== next) useRoute.setState({ path: next });

  applyHead(next, currentLang(), label);
}

export function useAppAddress(): void {
  useEffect(() => {
    sync();
    // One subscription per store that can move the window. Each compares the
    // handful of fields that matter, because the timer alone fires once a
    // second and the address does not change with the clock.
    const stops = [
      useApp.subscribe((s, p) => {
        if (
          s.view !== p.view ||
          s.subjectId !== p.subjectId ||
          s.settingsOpen !== p.settingsOpen ||
          s.settingsSection !== p.settingsSection
        ) {
          sync();
        }
      }),
      useTimer.subscribe((s, p) => {
        if (s.view !== p.view) sync();
      }),
      useViewer.subscribe((s, p) => {
        if (s.docId !== p.docId || s.meta?.name !== p.meta?.name) sync();
      }),
      useNotes.subscribe((s, p) => {
        if (s.docId !== p.docId || s.meta?.name !== p.meta?.name) sync();
      }),
      useWorkspace.subscribe((s, p) => {
        if (s.subjects !== p.subjects) sync();
      }),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
}
