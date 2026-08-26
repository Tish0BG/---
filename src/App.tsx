import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp, resolveView } from '@/state/appStore';
import { useLibrary } from '@/state/libraryStore';
import { useViewer, installAutosaveGuards } from '@/state/viewerStore';
import { useNotes, installNoteGuards } from '@/state/noteStore';
import { useItemTypes } from '@/state/itemTypeStore';
import { useSettings, initTheme } from '@/state/settingsStore';
import { useTimer, installTimerEffects } from '@/state/timerStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useAuth, installSyncEffects } from '@/state/authStore';
import { usePlanner } from '@/state/plannerStore';
import { useGoals } from '@/state/goalStore';
import { useGame } from '@/state/gameStore';
import { dueCount, useCards } from '@/state/cardStore';
import { requestPersistence } from '@/services/db';
import { installProgressEffects } from '@/services/progressBus';
import { installReminders } from '@/services/reminderService';
import { openDoc } from '@/services/openDoc';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useLangStore } from '@/i18n';
import { installRouting, isUnknownPath, useRoute } from '@/state/routeStore';
import { applyAppPath } from '@/state/appAddress';
import { clearPendingSignUp, readPendingSignUp } from '@/state/signupHandoff';
import { HOME, entryPath, isAppPath, routeByPath } from '@/seo/routes';
import type { SidebarTab } from '@/components/sidebar/Sidebar';
import { AppShell } from '@/components/shell/AppShell';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { QuickCreate } from '@/components/shell/QuickCreate';
import { Celebration } from '@/components/shell/Celebration';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Toaster } from '@/components/system/Toaster';
import { TimerOverlay } from '@/components/timer/TimerOverlay';
import type { CardDraft } from '@/components/cards/CardEditor';
import { UtilityFloatLayer } from '@/components/utilities/UtilityLayer';
import { Icon } from '@/components/Icon';
import { SkeletonCard } from '@/components/kit';
import { BRAND } from '@/brand';
import { PlauviaTile } from '@/components/brand/Logo';

/**
 * The screens behind the dashboard are split out of the first chunk.
 *
 * Someone who opens the app to check today's plan should not be waiting for
 * the calendar grid, the statistics and the achievements to arrive first.
 */
const Drive = lazy(() => import('@/components/drive/Drive').then((m) => ({ default: m.Drive })));
const PlanScreen = lazy(() => import('@/components/plan/PlanScreen').then((m) => ({ default: m.PlanScreen })));
const CalendarScreen = lazy(() =>
  import('@/components/calendar/CalendarScreen').then((m) => ({ default: m.CalendarScreen })),
);
const FocusScreen = lazy(() => import('@/components/focus/FocusScreen').then((m) => ({ default: m.FocusScreen })));
const SubjectsScreen = lazy(() =>
  import('@/components/subjects/SubjectsScreen').then((m) => ({ default: m.SubjectsScreen })),
);
const StatsScreen = lazy(() => import('@/components/stats/StatsScreen').then((m) => ({ default: m.StatsScreen })));
const AchievementsScreen = lazy(() =>
  import('@/components/achievements/AchievementsScreen').then((m) => ({ default: m.AchievementsScreen })),
);
const ProfileScreen = lazy(() =>
  import('@/components/profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
);

/**
 * Everything that only exists once something is opened: the viewer stack, the
 * dialogs, the public page. Splitting them keeps the first load to the shell,
 * the dashboard and the data — about a third of what it used to be.
 */
const DocumentWorkspace = lazy(() =>
  import('@/components/viewer/DocumentWorkspace').then((m) => ({ default: m.DocumentWorkspace })),
);
const NoteWorkspace = lazy(() =>
  import('@/components/note/NoteWorkspace').then((m) => ({ default: m.NoteWorkspace })),
);
const Landing = lazy(() => import('@/components/landing/Landing').then((m) => ({ default: m.Landing })));
const PublicPageView = lazy(() =>
  import('@/components/public/PublicPages').then((m) => ({ default: m.PublicPageView })),
);
const NotFoundPage = lazy(() =>
  import('@/components/public/PublicPages').then((m) => ({ default: m.NotFoundPage })),
);
const AuthScreen = lazy(() => import('@/components/auth/AuthScreen').then((m) => ({ default: m.AuthScreen })));
const AuthDialog = lazy(() => import('@/components/auth/AuthDialog').then((m) => ({ default: m.AuthDialog })));
const RecoveryScreen = lazy(() =>
  import('@/components/auth/RecoveryScreen').then((m) => ({ default: m.RecoveryScreen })),
);
const MfaChallenge = lazy(() =>
  import('@/components/auth/MfaChallenge').then((m) => ({ default: m.MfaChallenge })),
);
const Onboarding = lazy(() => import('@/components/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));
const ProfileSetup = lazy(() =>
  import('@/components/auth/ProfileSetup').then((m) => ({ default: m.ProfileSetup })),
);
const SettingsDialog = lazy(() =>
  import('@/components/SettingsDialog').then((m) => ({ default: m.SettingsDialog })),
);
const CardsScreen = lazy(() => import('@/components/cards/CardsScreen').then((m) => ({ default: m.CardsScreen })));
const CardEditor = lazy(() => import('@/components/cards/CardEditor').then((m) => ({ default: m.CardEditor })));
const SnipDialog = lazy(() => import('@/components/board/SnipDialog').then((m) => ({ default: m.SnipDialog })));
const NewBoardDialog = lazy(() =>
  import('@/components/board/NewBoardDialog').then((m) => ({ default: m.NewBoardDialog })),
);

export default function App() {
  const view = useApp((s) => s.view);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const authOpen = useApp((s) => s.authOpen);
  const authMode = useApp((s) => s.authMode);
  const authReady = useAuth((s) => s.ready);
  const cloudConfigured = useAuth((s) => s.configured);
  const signedIn = useAuth((s) => !!s.user);
  const recovery = useAuth((s) => s.recovery);
  const mfaPending = useAuth((s) => s.mfaPending);
  const syncPhase = useAuth((s) => s.sync.phase);
  const restoring = syncPhase !== 'idle' && syncPhase !== 'done' && syncPhase !== 'error';
  const everSynced = useAuth((s) => s.sync.lastSyncAt !== null);
  /** anything at all in the library means there is something to show already */
  const documentsReady = useLibrary((s) => s.documents.length > 0);
  const docId = useViewer((s) => s.docId);
  const noteId = useNotes((s) => s.docId);
  const libraryLoaded = useLibrary((s) => s.loaded);
  const workspaceLoaded = useWorkspace((s) => s.loaded);
  const subjects = useWorkspace((s) => s.subjects);
  const plannerLoaded = usePlanner((s) => s.loaded);
  const cards = useCards((s) => s.cards);
  const activeFolderId = useLibrary((s) => s.activeFolderId);
  const lang = useLangStore((s) => s.lang);
  const path = useRoute((s) => s.path);

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [tab, setTab] = useState<SidebarTab>('library');
  const [exportOpen, setExportOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [newBoard, setNewBoard] = useState(false);
  const [uploadTick, setUploadTick] = useState(0);
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('plauvia.onboarded.v2') === 'yes');
  /**
   * Set the moment the handle and the face have been chosen.
   *
   * The flag itself lives in `sessionStorage` and is read on each render
   * rather than snapshotted at mount, because it is written *during* this
   * session — by a form two screens ago — and a value captured at mount would
   * always be the one from before the person started registering.
   */
  const [profileSetUp, setProfileSetUp] = useState(false);

  const due = useMemo(() => dueCount(cards), [cards]);

  /* ------------------------------------------------------------- startup */

  useEffect(() => {
    const stopTheme = initTheme();
    const stopGuards = installAutosaveGuards();
    const stopNotes = installNoteGuards();
    const stopTimer = installTimerEffects();
    const stopSync = installSyncEffects();
    const stopProgress = installProgressEffects();
    const stopRouting = installRouting();
    const stopReminders = installReminders();
    void requestPersistence();
    void useAuth.getState().init();
    void useWorkspace.getState().init();
    void usePlanner.getState().init();
    void useCards.getState().init();
    void useGoals.getState().init();
    void useItemTypes.getState().init();
    void useTimer
      .getState()
      .init()
      .then(() => useGame.getState().init());
    void useLibrary
      .getState()
      .init()
      .then(() => {
        // "Open what you had open" is for somebody arriving at the front
        // door. An address that names a screen or a document has said where
        // to go, and it outranks what this device happens to remember.
        if (isAppPath(entryPath(window.location.pathname))) return;
        const last = useSettings.getState().lastDocId;
        const exists = useLibrary.getState().documents.some((d) => d.id === last && !d.deletedAt);
        if (last && exists) void openDoc(last);
      });
    return () => {
      stopTheme();
      stopGuards();
      stopNotes();
      stopTimer();
      stopSync();
      stopProgress();
      stopRouting();
      stopReminders();
    };
  }, []);

  /** The document language follows the interface language, for screen readers. */
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (docId) return;
    void import('@/components/sidebar/Thumbnails').then((m) => m.clearThumbCache());
  }, [docId]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /** The library's own file input lives inside Drive; other screens ask for it. */
  const requestUpload = useCallback(() => {
    useApp.getState().go('drive');
    setUploadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!uploadTick) return;
    const id = requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('input[type=file][accept="application/pdf"]')?.click();
    });
    return () => cancelAnimationFrame(id);
  }, [uploadTick]);

  /**
   * `?go=drive` and friends: the shape the installed app's shortcuts used
   * before the screens had addresses of their own. Kept working because it is
   * in manifests already on people's home screens, and in links they sent.
   * Honoured once, then wiped from the address bar so a reload does not keep
   * yanking the person back to the same screen.
   */
  useEffect(() => {
    const go = new URLSearchParams(window.location.search).get('go');
    if (!go) return;
    const target = resolveView(go);
    if (target) useApp.getState().go(target);
    history.replaceState(null, '', window.location.pathname);
  }, []);

  /**
   * The door has an address of its own.
   *
   * Pressing "Sign in" used to leave the address wherever it was, so the form
   * appeared at `/homepage` and could not be linked to, bookmarked, or closed
   * with Back. Now the two halves are `/login` and `/register`, and switching
   * between them replaces rather than pushes — Back should leave the door, not
   * step through both sides of it.
   *
   * `doorFrom` is where the person was standing when it opened. It matters for
   * the case where they were not standing on the site at all: somebody who
   * followed a link to `/calendar` while signed out sees the form at `/login`,
   * and lands on the calendar rather than the dashboard once they are in.
   */
  const doorFrom = useRef<string | null>(null);

  useEffect(() => {
    const route = useRoute.getState();
    // The door is showing either because somebody pressed "Sign in", or
    // because they followed a link to a screen that needs a session. Both are
    // the door, and the door is always at its own address.
    const atDoor = !signedIn && cloudConfigured && (authOpen || isAppPath(route.path));

    if (atDoor) {
      const want = authMode === 'signup' ? '/register' : '/login';
      if (route.path === want) return;
      const swapping = route.path === '/login' || route.path === '/register';
      if (!swapping) doorFrom.current = route.path;
      // Replacing rather than pushing when the address being covered is a
      // screen: that address answers with the door too, so a Back button that
      // returned to it would only arrive here again.
      route.go(want, { replace: swapping || isAppPath(route.path) });
      return;
    }
    // Shut, by the close button or by signing in. Either way the address goes
    // back to whatever it was covering.
    const back = doorFrom.current;
    doorFrom.current = null;
    if (!back || !(route.path === '/login' || route.path === '/register')) return;
    route.go(back);
    // In the same tick, not behind a dynamic import: the shell mounts the
    // moment this render lands and starts writing the address from the app's
    // state, so a screen that arrives a microtask later has already been
    // overwritten by the dashboard.
    if (signedIn && isAppPath(back)) applyAppPath(back);
  }, [authOpen, signedIn, cloudConfigured, authMode, path]);

  const openSearch = useCallback(() => {
    setSidebarOpen(true);
    setTab('search');
  }, []);

  useShortcuts({
    onSearch: openSearch,
    onExport: () => setExportOpen(true),
    onNewBoard: () => setNewBoard(true),
  });

  /** Overlays reachable from every screen, including inside a document. */
  const globals = (
    <>
      <TimerOverlay />
      <CommandPalette />
      <QuickCreate />
      <Celebration />
      <Suspense fallback={null}>
        <SnipDialog onMakeCard={setCardDraft} />
        {cardsOpen && <CardsScreen open onClose={() => setCardsOpen(false)} />}
        {cardDraft && <CardEditor open draft={cardDraft} onClose={() => setCardDraft(null)} />}
        {newBoard && <NewBoardDialog open onClose={() => setNewBoard(false)} folderId={activeFolderId} />}
        {settingsOpen && (
          <SettingsDialog open onClose={() => useApp.getState().setSettings(false)} />
        )}
        {authOpen && <AuthDialog open onClose={() => useApp.getState().setAuth(false)} />}
      </Suspense>
      <UtilityFloatLayer />
      <Toaster />
    </>
  );

  /* --------------------------------------------------------------- views */

  /**
   * The public web, which is not the same thing as "logged out".
   *
   * Someone reading the privacy policy may well be signed in; someone
   * following a link to the FAQ should get the FAQ, not the dashboard. So the
   * public pages are answered by address, before the account gate, and only
   * the home page falls through to the marketing-page-or-app decision below.
   */
  const publicRoute = routeByPath(path);
  const home = publicRoute?.id === 'home';
  const article = (publicRoute && !home) || isUnknownPath(path);

  /**
   * What has to have loaded before anything can be drawn, which is different
   * for each of the three kinds of address.
   *
   * A page of the site is made of nothing but text that is already in the
   * bundle: making somebody who followed a link to the privacy policy watch a
   * splash screen while IndexedDB opens is a wait that buys them nothing.
   *
   * The home page waits for exactly one thing — whether there is a session —
   * because that decides whether its button says "Get started" or "Open
   * Plauvia", and a button that changes under the reader's cursor is worse
   * than a moment of nothing.
   *
   * The app waits for all of it, including the session check, or somebody who
   * is already signed in sees the front door flash past on every reload.
   */
  const waiting = article ? false : home ? !authReady : !libraryLoaded || !workspaceLoaded || !authReady;
  if (waiting) return <Splash />;

  // Arrived from a "reset your password" e-mail: ask for the new one before
  // anything else, or the link just logs them in with the old password.
  if (recovery)
    return (
      <Suspense fallback={<Splash />}>
        <RecoveryScreen />
      </Suspense>
    );

  // A session that has proved a password but not the code from the app is not
  // a session. Nothing behind this is reachable until it clears.
  if (mfaPending)
    return (
      <Suspense fallback={<Splash />}>
        <MfaChallenge />
      </Suspense>
    );

  const openAuth = (mode: 'signin' | 'signup' = 'signin') => useApp.getState().setAuth(true, mode);
  const openSignUp = () => openAuth('signup');
  const openSignIn = () => openAuth('signin');

  if (publicRoute && !home) {
    return (
      <Suspense fallback={<Splash />}>
        <PublicPageView id={publicRoute.id} onStart={openSignUp} onSignIn={openSignIn} />
      </Suspense>
    );
  }

  /**
   * The home page is the home page, signed in or not.
   *
   * It used to be swept past: an account meant `/homepage` answered with the
   * dashboard, so somebody who followed a link to the site — from a friend, or
   * from their own bookmarks — never saw it, and there was nowhere for a
   * button into the app to live. Now it is a page like the others, and the
   * button in its header says "Open Plauvia" instead of "Sign in".
   */
  if (home && !authOpen) {
    return (
      <Suspense fallback={<Splash />}>
        <Landing onStart={openSignUp} onSignIn={openSignIn} />
      </Suspense>
    );
  }

  if (isUnknownPath(path)) {
    return (
      <Suspense fallback={<Splash />}>
        <NotFoundPage onStart={openSignUp} />
      </Suspense>
    );
  }

  /**
   * The public site, then the door, then the product.
   *
   * A stranger lands on the marketing page: a login form as a home page tells
   * them nothing about what they would be logging into. "Get started" opens
   * the door, and everything past it is the app itself.
   */
  // An address under /app is a request for a particular screen. Answering it
  // with the marketing page would lose it; the form is the honest answer, and
  // the address is left alone so it is still there once the door opens.
  if (cloudConfigured && !signedIn) {
    return (
      <Suspense fallback={<Splash />}>
        <AuthScreen
          onClose={() => {
            // Closing after signing in is not a refusal; it is just the screen
            // getting out of the way, and the address effect above puts the
            // person back where they were going.
            if (useAuth.getState().user) return;
            useApp.getState().setAuth(false);
            // Turned away from the door instead. The address has to leave with
            // them: a screen answers with the door too, so staying anywhere
            // under it would only open the form again.
            const back = doorFrom.current;
            doorFrom.current = null;
            useRoute.getState().go(back && !isAppPath(back) ? back : HOME);
          }}
        />
      </Suspense>
    );
  }

  /**
   * The very first sync after signing in on a new device, with nothing local
   * to show yet. Guarded by `lastSyncAt` on purpose: without it every routine
   * sync on an empty library would blank the whole app for a few seconds.
   */
  if (signedIn && restoring && !documentsReady && !everSynced) {
    return <Splash label="…" />;
  }

  /**
   * Registered a minute ago, verified, and signed in — but still nobody in
   * particular. The handle and the face are asked for here, on this side of
   * the session, because the code that created the session is what unmounted
   * the form that would otherwise have asked.
   *
   * Only ever for an account made in this tab, in this session: the note is
   * written by the sign-up form and by nothing else, so signing in on a
   * second device never lands here.
   */
  if (signedIn && !profileSetUp && readPendingSignUp()) {
    return (
      <Suspense fallback={<Splash />}>
        <ProfileSetup
          onDone={() => {
            clearPendingSignUp();
            setProfileSetUp(true);
          }}
        />
        <Toaster />
      </Suspense>
    );
  }

  /**
   * A workspace with no subjects and nothing in it has nothing to show, so it
   * gets the setup instead — three steps that end with a dashboard that is
   * already about something.
   */
  /** Nothing set up and nothing in the library: the workspace is brand new. */
  const emptyWorkspace = subjects.length === 0 && useLibrary.getState().documents.length === 0;
  if (!onboarded && plannerLoaded && emptyWorkspace) {
    return (
      <Suspense fallback={<Splash />}>
        <Onboarding
          onDone={() => {
            localStorage.setItem('plauvia.onboarded.v2', 'yes');
            setOnboarded(true);
          }}
        />
        <Toaster />
      </Suspense>
    );
  }

  /* A written document takes the whole window, like a page does. */
  if (noteId) {
    return (
      <>
        <Suspense fallback={<Splash />}>
          <NoteWorkspace />
        </Suspense>
        {globals}
      </>
    );
  }

  /* A document takes the whole window: writing needs the space. */
  if (docId) {
    return (
      <>
        <Suspense fallback={<Splash />}>
          <DocumentWorkspace
            onCards={() => setCardsOpen(true)}
            dueCount={due}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            tab={tab}
            setTab={setTab}
            exportOpen={exportOpen}
            setExportOpen={setExportOpen}
          />
        </Suspense>
        {globals}
      </>
    );
  }

  return (
    <>
      <AppShell onNewBoard={() => setNewBoard(true)} onUpload={requestUpload}>
        <Suspense fallback={<ScreenSkeleton />}>
          {view === 'dashboard' && (
            <Dashboard onNewBoard={() => setNewBoard(true)} onUpload={requestUpload} />
          )}
          {view === 'drive' && <Drive onNewBoard={() => setNewBoard(true)} />}
          {view === 'plan' && <PlanScreen />}
          {view === 'calendar' && <CalendarScreen />}
          {view === 'focus' && <FocusScreen />}
          {view === 'subjects' && <SubjectsScreen />}
          {view === 'stats' && <StatsScreen />}
          {view === 'achievements' && <AchievementsScreen />}
          {view === 'profile' && <ProfileScreen />}
          {view === 'cards' && <CardsHome />}
        </Suspense>
      </AppShell>
      {globals}
    </>
  );
}

/**
 * The first thing anyone sees. It carries the mark rather than a bare
 * spinner: a blank screen with a turning circle belongs to no product in
 * particular, and this is the moment the brand is establishing that it is one.
 */
function Splash({ label }: { label?: string }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center" style={{ background: 'var(--c-bg)' }}>
      <div className="animate-in">
        <PlauviaTile size={52} className="mx-auto" />
        <p className="mt-4 text-[15px] font-semibold tracking-[-0.02em]">{BRAND.name}</p>
        <p className="mt-1 text-[12.5px] text-muted">{label ?? BRAND.tagline.en}</p>
        <Icon name="refresh" size={15} className="mx-auto mt-4 animate-spin text-faint" />
      </div>
    </div>
  );
}

/** What a screen looks like while its chunk is still arriving. */
function ScreenSkeleton() {
  return (
    <div className="mx-auto max-w-[1220px] px-4 py-5 sm:px-7 sm:py-7">
      <div className="skeleton h-8 w-56 rounded-[10px]" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
}

/** The flashcard screen rendered inline instead of as an overlay. */
function CardsHome() {
  return <CardsScreen open embedded onClose={() => useApp.getState().go('dashboard')} />;
}
