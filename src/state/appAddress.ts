import { useEffect } from 'react';
import { applyHead } from '@/seo/head';
import { entryPath, normalisePath } from '@/seo/routes';
import { currentLang, tr, L } from '@/i18n';
import { useApp, VIEW_TITLES, resolveView, type AppView } from './appStore';
import { useRoute } from './routeStore';
import { useTimer } from './timerStore';
import { useViewer } from './viewerStore';
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

/** The address of each screen. The slug is the name the app already uses. */
export const VIEW_PATHS: Record<AppView, string> = {
  dashboard: '/dashboard',
  tasks: '/tasks',
  calendar: '/calendar',
  goals: '/goals',
  exams: '/exams',
  drive: '/library',
  cards: '/cards',
  subjects: '/subjects',
  stats: '/stats',
  achievements: '/achievements',
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
  const doc = useViewer.getState().docId;
  if (doc) return `/document/${doc}`;

  const app = useApp.getState();
  // The settings are one window; which room you are standing in is internal,
  // like a scroll position. A room only reaches the address when something
  // asked for it by name — `/app/settings/sync` is a link worth sending, and
  // clicking through the list afterwards is not worth a history entry each.
  if (app.settingsOpen) {
    return app.settingsSection ? `/settings/${app.settingsSection}` : '/settings';
  }
  if (useTimer.getState().view === 'full') return '/focus';
  if (app.subjectId) return `/subjects/${app.subjectId}`;
  return VIEW_PATHS[app.view];
}

/** The same question, answered in words for the browser tab. */
export function appLabel(): string {
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
 * The way back in: a pasted link, a bookmark, or the Back button.
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

  if (head === 'document' && id) {
    void useViewer.getState().openDocument(id);
    return;
  }
  if (head === 'settings') {
    app.setSettings(true, id || undefined);
    return;
  }
  if (head === 'focus') {
    useTimer.getState().setView('full');
    return;
  }
  if (head === 'subjects' && id) {
    app.openSubject(id);
    return;
  }
  if (head === 'dashboard' || head === '') {
    app.go('dashboard');
    return;
  }
  const view = resolveView(head);
  if (view) app.go(view);
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

  if (next !== here) history.pushState(null, '', `${next}${window.location.hash}`);
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
      useWorkspace.subscribe((s, p) => {
        if (s.subjects !== p.subjects) sync();
      }),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);
}
