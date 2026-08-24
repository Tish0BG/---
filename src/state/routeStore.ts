import { create } from 'zustand';
import { applyHead } from '@/seo/head';
import { isAppPath, normalisePath } from '@/seo/routes';
import { currentLang, useLangStore } from '@/i18n';

/**
 * The smallest router that does the job.
 *
 * Plauvia's screens are state, not addresses — moving from the dashboard to
 * the calendar should not touch history, because a document may be open and
 * mid-save behind it. What genuinely needs an address is the public web: the
 * marketing page, the legal pages, the two links people paste. So this store
 * owns exactly those, and the app's internal navigation stays where it was.
 */

interface RouteStore {
  path: string;
  go(path: string, opts?: { replace?: boolean }): void;
}

export const useRoute = create<RouteStore>((set) => ({
  path: normalisePath(window.location.pathname),

  go(path, opts) {
    const next = normalisePath(path);
    if (next === normalisePath(window.location.pathname)) {
      set({ path: next });
      return;
    }
    // The hash may be carrying a Supabase recovery token; dropping it here
    // would turn a "set a new password" link into a silent login.
    const url = `${next}${window.location.hash}`;
    if (opts?.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    set({ path: next });
    applyHead(next, currentLang());
    window.scrollTo({ top: 0 });
  },
}));

/** Re-exported so the app keeps asking the router, and the router asks the table. */
export { isUnknownPath } from '@/seo/routes';

/**
 * Keeps the store, the address bar and the head in step. Installed once, from
 * App, alongside the other startup effects.
 */
export function installRouting(): () => void {
  /**
   * Back and forward move between the app's screens as well as the site's
   * pages now, so a pop has to put the app where the address says it is —
   * `appAddress` will see the state already matches and push nothing back.
   *
   * Imported lazily: this module is loaded by the head writer and the timer,
   * and the app stores have no business being pulled in behind them.
   */
  const enter = (path: string) => {
    if (!isAppPath(path)) return;
    void import('./appAddress').then((m) => m.applyAppPath(path));
  };

  const onPop = () => {
    const path = normalisePath(window.location.pathname);
    useRoute.setState({ path });
    applyHead(path, currentLang());
    enter(path);
  };
  window.addEventListener('popstate', onPop);

  // The head follows the interface language too: a Bulgarian visitor who
  // switches to English should not leave a Bulgarian title behind in the tab.
  const stopLang = useLangStore.subscribe((s) => applyHead(useRoute.getState().path, s.lang));

  // A pasted link or a bookmark: `/app/calendar` should open the calendar,
  // not the screen somebody last had open on this device.
  enter(useRoute.getState().path);

  applyHead(useRoute.getState().path, currentLang());

  return () => {
    window.removeEventListener('popstate', onPop);
    stopLang();
  };
}
