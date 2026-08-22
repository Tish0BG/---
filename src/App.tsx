import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, resolveView } from '@/state/appStore';
import { useLibrary } from '@/state/libraryStore';
import { useViewer, installAutosaveGuards } from '@/state/viewerStore';
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
import { useShortcuts } from '@/hooks/useShortcuts';
import { useLangStore } from '@/i18n';
import { installRouting, isUnknownPath, useRoute } from '@/state/routeStore';
import { isAppPath, routeByPath } from '@/seo/routes';
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
const TasksScreen = lazy(() => import('@/components/tasks/TasksScreen').then((m) => ({ default: m.TasksScreen })));
const CalendarScreen = lazy(() =>
  import('@/components/calendar/CalendarScreen').then((m) => ({ default: m.CalendarScreen })),
);
const GoalsScreen = lazy(() => import('@/components/goals/GoalsScreen').then((m) => ({ default: m.GoalsScreen })));
const ExamsScreen = lazy(() => import('@/components/exams/ExamsScreen').then((m) => ({ default: m.ExamsScreen })));
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
  const authReady = useAuth((s) => s.ready);
  const cloudConfigured = useAuth((s) => s.configured);
  const signedIn = useAuth((s) => !!s.user);
  const skippedAuth = useAuth((s) => s.skipped);
  const recovery = useAuth((s) => s.recovery);
  const mfaPending = useAuth((s) => s.mfaPending);
  const syncPhase = useAuth((s) => s.sync.phase);
  const restoring = syncPhase !== 'idle' && syncPhase !== 'done' && syncPhase !== 'error';
  const everSynced = useAuth((s) => s.sync.lastSyncAt !== null);
  /** anything at all in the library means there is something to show already */
  const documentsReady = useLibrary((s) => s.documents.length > 0);
  const docId = useViewer((s) => s.docId);
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

  const due = useMemo(() => dueCount(cards), [cards]);

  /* ------------------------------------------------------------- startup */

  useEffect(() => {
    const stopTheme = initTheme();
    const stopGuards = installAutosaveGuards();
    const stopTimer = installTimerEffects();
    const stopSync = installSyncEffects();
    const stopProgress = installProgressEffects();
    const stopRouting = installRouting();
    void requestPersistence();
    void useAuth.getState().init();
    void useWorkspace.getState().init();
    void usePlanner.getState().init();
    void useCards.getState().init();
    void useGoals.getState().init();
    void useTimer
      .getState()
      .init()
      .then(() => useGame.getState().init());
    void useLibrary
      .getState()
      .init()
      .then(() => {
        const last = useSettings.getState().lastDocId;
        const exists = useLibrary.getState().documents.some((d) => d.id === last && !d.deletedAt);
        if (last && exists) void useViewer.getState().openDocument(last);
      });
    return () => {
      stopTheme();
      stopGuards();
      stopTimer();
      stopSync();
      stopProgress();
      stopRouting();
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
   * The installed app's long-press shortcuts open `?go=drive` and friends.
   * Honoured once, then wiped from the address bar so a reload does not keep
   * yanking the person back to the same screen.
   */
  useEffect(() => {
    // /login, /signup and /app are real links people paste and bookmark. The
    // address is left alone — rewriting it to "/" mid-flight loses the page
    // someone deliberately shared.
    if (isAppPath(window.location.pathname)) useApp.getState().setAuth(true);
    const go = new URLSearchParams(window.location.search).get('go');
    if (!go) return;
    const target = resolveView(go);
    if (target) useApp.getState().go(target);
    history.replaceState(null, '', window.location.pathname);
  }, []);

  const openSearch = useCallback(() => {
    setSidebarOpen(true);
    setTab('search');
  }, []);

  useShortcuts({ onSearch: openSearch, onExport: () => setExportOpen(true) });

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

  // Waiting for the session check too, otherwise someone who is already
  // signed in sees the front door flash past on every reload.
  if (!libraryLoaded || !workspaceLoaded || !authReady) return <Splash />;

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

  /**
   * The public web, which is not the same thing as "logged out".
   *
   * Someone reading the privacy policy may well be signed in; someone
   * following a link to the FAQ should get the FAQ, not the dashboard. So the
   * public pages are answered by address, before the account gate, and only
   * the home page falls through to the marketing-page-or-app decision below.
   */
  const publicRoute = routeByPath(path);
  const openAuth = () => useApp.getState().setAuth(true);

  if (publicRoute && publicRoute.id !== 'home') {
    return (
      <Suspense fallback={<Splash />}>
        <PublicPageView id={publicRoute.id} onStart={openAuth} onSignIn={openAuth} />
      </Suspense>
    );
  }

  if (isUnknownPath(path)) {
    return (
      <Suspense fallback={<Splash />}>
        <NotFoundPage onStart={openAuth} />
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
  if (cloudConfigured && !signedIn && !skippedAuth) {
    if (!authOpen) {
      return (
        <Suspense fallback={<Splash />}>
          <Landing onStart={openAuth} onSignIn={openAuth} />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<Splash />}>
        <AuthScreen
          onClose={() => {
            // Closing after signing in is not a refusal; it is just the screen
            // getting out of the way.
            if (!useAuth.getState().user) useApp.getState().setAuth(false);
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
      <AppShell>
        <Suspense fallback={<ScreenSkeleton />}>
          {view === 'dashboard' && (
            <Dashboard onNewBoard={() => setNewBoard(true)} onUpload={requestUpload} />
          )}
          {view === 'drive' && <Drive onNewBoard={() => setNewBoard(true)} />}
          {view === 'tasks' && <TasksScreen />}
          {view === 'calendar' && <CalendarScreen />}
          {view === 'goals' && <GoalsScreen />}
          {view === 'exams' && <ExamsScreen />}
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
      <div className="skeleton h-8 w-56 rounded-xl" />
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
