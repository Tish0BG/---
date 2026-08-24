import { useEffect, useState } from 'react';
import { useAppAddress } from '@/state/appAddress';
import { ConnectionBar } from '../system/ConnectionBar';
import { useIsCompact, useIsPhone } from '../kit';
import { Sidebar, SidebarScrim } from './Sidebar';
import { AppHeader } from './AppHeader';
import { MobileNav } from './MobileNav';

/**
 * The frame every screen lives in.
 *
 * Desktop: sidebar, glass header, content. Phone: no sidebar at all — a
 * compact header, the content, and a bottom bar under the thumb. The drawer in
 * between exists only for tablets, where there is room for a sidebar but not
 * for it to be permanent.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const compact = useIsCompact();
  const phone = useIsPhone();
  const [drawer, setDrawer] = useState(false);

  // While the shell is on screen, the address bar and the tab follow it.
  useAppAddress();

  useEffect(() => {
    if (!compact) setDrawer(false);
  }, [compact]);

  return (
    <div className="relative flex h-full overflow-hidden">
      {!compact && <Sidebar />}

      {compact && drawer && (
        <SidebarScrim onClose={() => setDrawer(false)}>
          <Sidebar expanded onNavigate={() => setDrawer(false)} />
        </SidebarScrim>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBar />
        <AppHeader onMenu={compact ? () => setDrawer(true) : undefined} />
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: phone ? 66 : 0 }}>
          {children}
        </main>
      </div>

      {phone && <MobileNav />}
    </div>
  );
}
