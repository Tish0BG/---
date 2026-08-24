import { useApp } from '@/state/appStore';
import { useViewer } from '@/state/viewerStore';
import { useT, L } from '@/i18n';
import { Viewer } from './Viewer';
import { Toolbar } from '../Toolbar';
import { TopBar } from '../TopBar';
import { SelectionBar } from '../SelectionBar';
import { Sidebar, type SidebarTab } from '../sidebar/Sidebar';
import { InstrumentLayer } from '../instruments/InstrumentLayer';
import { DOCK_AREA_ID, UtilityDock } from '../utilities/UtilityLayer';
import { ExportDialog } from '../ExportDialog';
import { ConnectionBar } from '../system/ConnectionBar';
import { Icon } from '../Icon';
import { Button, useIsCompact } from '../kit';
import { useAppAddress } from '@/state/appAddress';

/**
 * The reading and writing surface, with everything that only exists while a
 * document is open.
 *
 * Split out of `App` so the whole viewer stack — pdf.js, the ink engine, the
 * instruments and the docked tools — is a separate chunk. Someone who opens
 * Plauvia to check today's plan should not wait for a PDF renderer first.
 */
export function DocumentWorkspace({
  onCards,
  dueCount,
  sidebarOpen,
  setSidebarOpen,
  tab,
  setTab,
  exportOpen,
  setExportOpen,
}: {
  onCards: () => void;
  dueCount: number;
  sidebarOpen: boolean;
  setSidebarOpen: (fn: (v: boolean) => boolean) => void;
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
}) {
  const t = useT();
  const compact = useIsCompact();
  useAppAddress();
  const loadState = useViewer((s) => s.loadState);
  const loadLabel = useViewer((s) => s.loadLabel);
  const error = useViewer((s) => s.error);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ConnectionBar />
      <TopBar
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onExport={() => setExportOpen(true)}
        onSettings={() => useApp.getState().setSettings(true)}
        onCards={onCards}
        dueCount={dueCount}
      />

      <div className="relative flex min-h-0 flex-1">
        {compact ? (
          sidebarOpen && (
            <>
              <div
                className="absolute inset-0 z-40"
                style={{ background: 'rgb(8 10 14 / 40%)' }}
                onPointerDown={() => setSidebarOpen(() => false)}
              />
              <div className="absolute inset-y-0 left-0 z-40 w-[280px] max-w-[86vw] shadow-[var(--shadow-float)]">
                <Sidebar tab={tab} setTab={setTab} onClose={() => setSidebarOpen(() => false)} />
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
                    {loadLabel ?? t(L('Зареждане на документа…', 'Opening the document…'))}
                  </span>
                </div>
              )}
              {loadState === 'error' ? (
                <div className="grid h-full place-items-center px-6 text-center">
                  <div>
                    <Icon name="alert" size={26} className="mx-auto mb-2" style={{ color: 'var(--c-danger)' }} />
                    <p className="text-[14px] font-medium">
                      {t(L('Документът не може да бъде отворен', 'This document could not be opened'))}
                    </p>
                    <p className="mt-1 text-[12px] text-muted">{error}</p>
                    <Button
                      variant="primary"
                      className="mt-4"
                      onClick={() => void useViewer.getState().closeDocument()}
                    >
                      {t(L('Назад', 'Back'))}
                    </Button>
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
    </div>
  );
}
