import { useAppAddress } from '@/state/appAddress';
import { ConnectionBar } from '../system/ConnectionBar';
import { useIsPhone } from '../kit';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { CreateButton } from './CreateButton';
import { useCards } from '@/state/cardStore';

/**
 * The frame every screen lives in.
 *
 * There is no top bar. It carried a search box, a create button, a bell and an
 * avatar across the top of every screen — fifty-six pixels of chrome for four
 * controls, three of which are better placed elsewhere and one of which is
 * gone. The account and the inbox are at the foot of the rail, create is a
 * button in the corner, and the screen below now starts at the top of the
 * window with its own heading, which is the only title the page ever needed.
 *
 * Desktop and tablet: rail, content, create button. Phone: no rail at all —
 * the content and a bottom bar under the thumb.
 */
export function AppShell({
  children,
  onNewBoard,
  onUpload,
}: {
  children: React.ReactNode;
  /** the create menu reaches back into App for the two things it cannot make alone */
  onNewBoard?: () => void;
  onUpload?: () => void;
}) {
  const phone = useIsPhone();
  /* A review takes the whole pane and puts four grade buttons along the
     bottom edge; the create button sat on top of the last one. */
  const reviewing = useCards((s) => s.reviewing);

  // While the shell is on screen, the address bar and the tab follow it.
  useAppAddress();

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* The rail handles its own width, including the narrow one a tablet
          gets. A hamburger and a slide-over drawer were two more moving parts
          for a screen that has room for sixty-eight pixels of icons. */}
      {!phone && <Sidebar />}

      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBar />
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: phone ? 66 : 0 }}>
          {children}
        </main>
      </div>

      {!phone && !reviewing && <CreateButton onNewBoard={onNewBoard} onUpload={onUpload} />}
      {phone && <MobileNav onNewBoard={onNewBoard} onUpload={onUpload} />}
    </div>
  );
}
