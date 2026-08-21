import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, type AppView } from '@/state/appStore';
import { useLibrary } from '@/state/libraryStore';
import { useViewer, installAutosaveGuards } from '@/state/viewerStore';
import { useSettings, initTheme } from '@/state/settingsStore';
import { useTimer, installTimerEffects } from '@/state/timerStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useAuth, installSyncEffects } from '@/state/authStore';
import { usePlanner } from '@/state/plannerStore';
import { dueCount, useCards } from '@/state/cardStore';
import { requestPersistence } from '@/services/db';
import { useShortcuts } from '@/hooks/useShortcuts';
import { Viewer } from '@/components/viewer/Viewer';
import { Toolbar } from '@/components/Toolbar';
import { TopBar } from '@/components/TopBar';
import { SelectionBar } from '@/components/SelectionBar';
import { Sidebar, type SidebarTab } from '@/components/sidebar/Sidebar';
import { AppShell } from '@/components/shell/AppShell';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Drive } from '@/components/drive/Drive';
import { PlannerScreen } from '@/components/planner/PlannerScreen';
import { SubjectsScreen } from '@/components/subjects/SubjectsScreen';
import { StatsScreen } from '@/components/stats/StatsScreen';
import { ExportDialog } from '@/components/ExportDialog';
import { SettingsDialog } from '@/components/SettingsDialog';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { RecoveryScreen } from '@/components/auth/RecoveryScreen';
import { Landing } from '@/components/landing/Landing';
import { ConnectionBar } from '@/components/system/ConnectionBar';
import { Toaster } from '@/components/system/Toaster';
import { TimerOverlay } from '@/components/timer/TimerOverlay';
import { SnipDialog } from '@/components/board/SnipDialog';
import { NewBoardDialog } from '@/components/board/NewBoardDialog';
import { CardsScreen } from '@/components/cards/CardsScreen';
import { CardEditor, type CardDraft } from '@/components/cards/CardEditor';
import { clearThumbCache } from '@/components/sidebar/Thumbnails';
import { InstrumentLayer } from '@/components/instruments/InstrumentLayer';
import { DOCK_AREA_ID, UtilityDock, UtilityFloatLayer } from '@/components/utilities/UtilityLayer';
import { Icon } from '@/components/Icon';
import { BRAND } from '@/brand';
import { PlauviaTile } from '@/components/brand/Logo';

export default function App() {
  const view = useApp((s) => s.view);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const authOpen = useApp((s) => s.authOpen);
  const authReady = useAuth((s) => s.ready);
  const cloudConfigured = useAuth((s) => s.configured);
  const signedIn = useAuth((s) => !!s.user);
  const skippedAuth = useAuth((s) => s.skipped);
  const recovery = useAuth((s) => s.recovery);
  const syncPhase = useAuth((s) => s.sync.phase);
  const restoring = syncPhase !== 'idle' && syncPhase !== 'done' && syncPhase !== 'error';
  const everSynced = useAuth((s) => s.sync.lastSyncAt !== null);
  /** anything at all in the library means there is something to show already */
  const documentsReady = useLibrary((s) => s.documents.length > 0);
  const docId = useViewer((s) => s.docId);
  const loadState = useViewer((s) => s.loadState);
  const loadLabel = useViewer((s) => s.loadLabel);
  const error = useViewer((s) => s.error);
  const libraryLoaded = useLibrary((s) => s.loaded);
  const workspaceLoaded = useWorkspace((s) => s.loaded);
  const cards = useCards((s) => s.cards);
  const activeFolderId = useLibrary((s) => s.activeFolderId);

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1024);
  const [tab, setTab] = useState<SidebarTab>('library');
  const [exportOpen, setExportOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [newBoard, setNewBoard] = useState(false);
  const [uploadTick, setUploadTick] = useState(0);

  const due = useMemo(() => dueCount(cards), [cards]);

  /* ------------------------------------------------------------- startup */

  useEffect(() => {
    const stopTheme = initTheme();
    const stopGuards = installAutosaveGuards();
    const stopTimer = installTimerEffects();
    const stopSync = installSyncEffects();
    void requestPersistence();
    void useAuth.getState().init();
    void useWorkspace.getState().init();
    void usePlanner.getState().init();
    void useCards.getState().init();
    void useTimer.getState().init();
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
    };
  }, []);

  useEffect(() => {
    if (!docId) clearThumbCache();
  }, [docId]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = () => {
      setNarrow(mq.matches);
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /** The library's own file input lives inside Drive; the dashboard asks for it. */
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
    // /login, /signup and /app are real links people paste and bookmark.
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path === '/login' || path === '/signup' || path === '/app') {
      useApp.getState().setAuth(true);
      history.replaceState(null, '', '/');
    }
    const go = new URLSearchParams(window.location.search).get('go');
    if (!go) return;
    if (['dashboard', 'drive', 'planner', 'cards', 'subjects', 'stats'].includes(go)) {
      useApp.getState().go(go as AppView);
    }
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
      <SnipDialog onMakeCard={setCardDraft} />
      <CardsScreen open={cardsOpen} onClose={() => setCardsOpen(false)} />
      <CardEditor open={!!cardDraft} draft={cardDraft} onClose={() => setCardDraft(null)} />
      <NewBoardDialog open={newBoard} onClose={() => setNewBoard(false)} folderId={activeFolderId} />
      <SettingsDialog open={settingsOpen} onClose={() => useApp.getState().setSettings(false)} />
      <AuthDialog open={authOpen} onClose={() => useApp.getState().setAuth(false)} />
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
  if (recovery) return <RecoveryScreen />;

  /**
   * The public site, then the door, then the product.
   *
   * A stranger lands on the marketing page: a login form as a home page tells
   * them nothing about what they would be logging into. "Get started" opens
   * the door, and everything past it is the app itself — with no questionnaire
   * in between, because the name comes from the account and everything else
   * has a sane default that lives in settings.
   */
  if (cloudConfigured && !signedIn && !skippedAuth) {
    if (!authOpen) {
      return (
        <Landing
          onStart={() => useApp.getState().setAuth(true)}
          onSignIn={() => useApp.getState().setAuth(true)}
        />
      );
    }
    return (
      <AuthScreen
        onClose={() => {
          // Closing after signing in is not a refusal; it is just the screen
          // getting out of the way.
          if (!useAuth.getState().user) useApp.getState().setAuth(false);
        }}
      />
    );
  }

  /**
   * The very first sync after signing in on a new device, with nothing local
   * to show yet. Guarded by `lastSyncAt` on purpose: without it every routine
   * sync on an empty library would blank the whole app for a few seconds.
   */
  if (signedIn && restoring && !documentsReady && !everSynced) {
    return <Splash label="Изтегляме библиотеката ти…" />;
  }

  /* A document takes the whole window: writing needs the space. */
  if (docId) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <ConnectionBar />
        <TopBar
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onExport={() => setExportOpen(true)}
          onSettings={() => useApp.getState().setSettings(true)}
          onCards={() => setCardsOpen(true)}
          dueCount={due}
        />

        <div className="relative flex min-h-0 flex-1">
          {narrow ? (
            sidebarOpen && (
              <>
                <div
                  className="absolute inset-0 z-40"
                  style={{ background: 'rgb(8 10 14 / 40%)' }}
                  onPointerDown={() => setSidebarOpen(false)}
                />
                <div className="absolute inset-y-0 left-0 z-40 w-[280px] max-w-[86vw] shadow-[var(--shadow-float)]">
                  <Sidebar tab={tab} setTab={setTab} onClose={() => setSidebarOpen(false)} />
                </div>
              </>
            )
          ) : (
            <div
              className="shrink-0 overflow-hidden transition-[width] duration-150"
              style={{ width: sidebarOpen ? 268 : 0 }}
            >
              <div style={{ width: 268 }} className="h-full">
                <Sidebar tab={tab} setTab={setTab} />
              </div>
            </div>
          )}

          {/* The reading area: docked tools take real width from the page, so
              "solve on the left, calculator on the right" is a true split. */}
          <div id={DOCK_AREA_ID} className="flex min-w-0 flex-1 flex-col">
            <UtilityDock side="top" />
            <div className="flex min-h-0 flex-1">
              <UtilityDock side="left" />
              <main className="relative min-w-0 flex-1">
            {loadState === 'loading' && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-app/70 text-muted backdrop-blur-sm">
                <span className="flex items-center gap-2 text-[13px]">
                  <Icon name="refresh" size={16} className="animate-spin" />
                  {loadLabel ?? 'Зареждане на документа…'}
                </span>
              </div>
            )}
            {loadState === 'error' ? (
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <Icon name="alert" size={26} className="mx-auto mb-2" style={{ color: 'var(--c-danger)' }} />
                  <p className="text-[14px] font-medium">Документът не може да бъде отворен</p>
                  <p className="mt-1 text-[12px] text-muted">{error}</p>
                  <button
                    className="btn btn-primary mt-4"
                    onClick={() => void useViewer.getState().closeDocument()}
                  >
                    Назад
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Viewer />
                <InstrumentLayer />
                <SelectionBar />
                <Toolbar />
              </>
            )}
              </main>
              <UtilityDock side="right" />
            </div>
            <UtilityDock side="bottom" />
          </div>
        </div>

        <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
        {globals}
      </div>
    );
  }

  return (
    <>
      <AppShell>
        {view === 'dashboard' && (
          <Dashboard onNewBoard={() => setNewBoard(true)} onUpload={requestUpload} />
        )}
        {view === 'drive' && <Drive onNewBoard={() => setNewBoard(true)} />}
        {view === 'planner' && <PlannerScreen />}
        {view === 'subjects' && <SubjectsScreen />}
        {view === 'stats' && <StatsScreen />}
        {view === 'cards' && <CardsHome />}
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
        <p className="mt-1 text-[12.5px] text-muted">{label ?? BRAND.tagline.bg}</p>
        <Icon name="refresh" size={15} className="mx-auto mt-4 animate-spin text-faint" />
      </div>
    </div>
  );
}

/** The flashcard screen rendered inline instead of as an overlay. */
function CardsHome() {
  return <CardsScreen open embedded onClose={() => useApp.getState().go('dashboard')} />;
}
