import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/state/appStore';
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
import { TimerOverlay } from '@/components/timer/TimerOverlay';
import { SnipDialog } from '@/components/board/SnipDialog';
import { NewBoardDialog } from '@/components/board/NewBoardDialog';
import { CardsScreen } from '@/components/cards/CardsScreen';
import { CardEditor, type CardDraft } from '@/components/cards/CardEditor';
import { clearThumbCache } from '@/components/sidebar/Thumbnails';
import { InstrumentLayer } from '@/components/instruments/InstrumentLayer';
import { DOCK_AREA_ID, UtilityDock, UtilityFloatLayer } from '@/components/utilities/UtilityLayer';
import { Icon } from '@/components/Icon';

export default function App() {
  const view = useApp((s) => s.view);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const authOpen = useApp((s) => s.authOpen);
  const authReady = useAuth((s) => s.ready);
  const cloudConfigured = useAuth((s) => s.configured);
  const signedIn = useAuth((s) => !!s.user);
  const skippedAuth = useAuth((s) => s.skipped);
  const syncPhase = useAuth((s) => s.sync.phase);
  const restoring = syncPhase !== 'idle' && syncPhase !== 'done' && syncPhase !== 'error';
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
    </>
  );

  /* --------------------------------------------------------------- views */

  // Waiting for the session check too, otherwise someone who is already
  // signed in sees the front door flash past on every reload.
  if (!libraryLoaded || !workspaceLoaded || !authReady) {
    return (
      <div className="grid h-full place-items-center text-muted">
        <Icon name="refresh" size={22} className="animate-spin" />
      </div>
    );
  }

  /**
   * The front door. A product with accounts opens on "sign in or register" —
   * and then lands you in the product. There is no questionnaire in between:
   * the name comes from the account, everything else has a sane default and
   * lives in settings, where it can be changed at any time instead of once.
   */
  if (cloudConfigured && !signedIn && !skippedAuth) {
    return (
      <AuthScreen
        onClose={() => {
          // Closing after a successful sign-in must not be mistaken for
          // "I don't want an account".
          if (!useAuth.getState().user) useAuth.getState().skip();
        }}
      />
    );
  }

  // Signing in on a new device pulls the library down; showing an empty app
  // for those few seconds would look like the data was lost.
  if (signedIn && restoring && !documentsReady) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-muted">
        <div>
          <Icon name="refresh" size={22} className="mx-auto animate-spin" />
          <p className="mt-3 text-[13px]">Изтегляме библиотеката ти…</p>
        </div>
      </div>
    );
  }

  /* A document takes the whole window: writing needs the space. */
  if (docId) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
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

/** The flashcard screen rendered inline instead of as an overlay. */
function CardsHome() {
  return <CardsScreen open embedded onClose={() => useApp.getState().go('dashboard')} />;
}
