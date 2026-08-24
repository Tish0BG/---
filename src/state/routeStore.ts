import { create } from 'zustand';
import type { Lang } from '@/brand';
import { applyHead } from '@/seo/head';
import { isAppPath, localePath, normalisePath, parsePath, redirectFor, routeByPath } from '@/seo/routes';
import { currentLang, useLangStore } from '@/i18n';

/**
 * The smallest router that does the job.
 *
 * Plauvia's screens are state, not addresses — moving from the dashboard to
 * the calendar should not touch history, because a document may be open and
 * mid-save behind it. What genuinely needs an address is the public web: the
 * marketing page, the legal pages, the two links people paste. So this store
 * owns exactly those, and the app's internal navigation stays where it was.
 *
 * It also owns one thing it did not use to: **which language a public page is
 * in**. `/faq` is Bulgarian and `/en/faq` is English, for everybody, always —
 * so arriving at one of them sets the interface language rather than the
 * other way round. That is the whole difference between two pages a search
 * engine can find and one page that quietly changes underneath a preference
 * it cannot see.
 */

interface Nav {
  replace?: boolean;
  /** Force a language — the switch does; everything else follows the current one. */
  lang?: Lang;
}

interface RouteStore {
  path: string;
  go(path: string, opts?: Nav): void;
}

/**
 * Where a link actually points.
 *
 * Callers name pages in the language-neutral form they are written in — `go('/faq')`,
 * `to="/privacy"` — and this decides which language version that means: the
 * one the address already names, the one the switch asked for, or the one the
 * reader is currently in. Nothing else in the app spells out a prefix.
 */
function resolve(path: string, forced?: Lang): { href: string; lang: Lang | null } {
  const route = routeByPath(path);
  if (!route) return { href: parsePath(path).path, lang: null };
  const addr = parsePath(path);
  const lang = forced ?? (addr.prefixed ? addr.lang : currentLang());
  return { href: localePath(route.path, lang), lang };
}

/** The address a link to this page should carry, for `href` attributes. */
export const hrefFor = (path: string, lang?: Lang): string => resolve(path, lang).href;

export const useRoute = create<RouteStore>((set) => ({
  path: normalisePath(window.location.pathname),

  go(path, opts) {
    const { href: next, lang } = resolve(path, opts?.lang);
    // A public page carries its language in the address, so following one is
    // also how the language gets chosen — and it is remembered, so the app
    // opens in the language the site was being read in.
    if (lang && lang !== currentLang()) useLangStore.getState().setLang(lang);

    if (next === normalisePath(window.location.pathname)) {
      set({ path: next });
      applyHead(next, currentLang());
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
 * Keeps the store, the address bar, the interface language and the head in
 * step. Installed once, from App, alongside the other startup effects.
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

  /**
   * Reads the address and makes everything else agree with it.
   *
   * The order matters: the language first, because the whole page is rendered
   * in it, then the head, which is written in that language.
   */
  const adopt = (raw: string) => {
    // `/bg/faq` is the Bulgarian page under a prefix that Bulgarian does not
    // use. The server answers those with a 301 and a crawler never gets here;
    // a browser can, from a cached shell or a hand-written link, so it is
    // straightened out in place without adding a history entry.
    const fixed = redirectFor(raw);
    const path = fixed ?? normalisePath(raw);
    if (fixed) history.replaceState(null, '', `${fixed}${window.location.search}${window.location.hash}`);

    const route = routeByPath(path);
    if (route) {
      const lang = parsePath(path).lang;
      if (lang !== currentLang()) useLangStore.getState().setLang(lang);
    }
    useRoute.setState({ path });
    applyHead(path, currentLang());
    return path;
  };

  const onPop = () => {
    const path = adopt(window.location.pathname);
    enter(path);
  };
  window.addEventListener('popstate', onPop);

  // The head follows the interface language inside the app, where there is no
  // address to read it from. On a public page the address has already decided,
  // and `applyHead` ignores the preference — switching there navigates.
  const stopLang = useLangStore.subscribe((s) => applyHead(useRoute.getState().path, s.lang));

  // A pasted link or a bookmark: `/app/calendar` should open the calendar,
  // not the screen somebody last had open on this device.
  enter(adopt(window.location.pathname));

  return () => {
    window.removeEventListener('popstate', onPop);
    stopLang();
  };
}
