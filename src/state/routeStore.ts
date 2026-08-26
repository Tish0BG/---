import { create } from 'zustand';
import type { Lang } from '@/brand';
import { applyHead } from '@/seo/head';
import { entryPath, localePath, normalisePath, parsePath, redirectFor, routeByPath } from '@/seo/routes';
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
  // Corrections first, so a link written as `/` or `/app/tasks` anywhere in
  // the product still lands on `/homepage` and `/tasks` — one hop, not two.
  const fixed = entryPath(path);
  const route = routeByPath(fixed);
  if (!route) return { href: parsePath(fixed).path, lang: null };
  const addr = parsePath(fixed);
  const lang = forced ?? (addr.prefixed ? addr.lang : currentLang());
  return { href: localePath(route.path, lang), lang };
}

/**
 * The part of `location.hash` that is not the page's own business.
 *
 * Supabase puts the recovery and confirmation tokens in the fragment, and the
 * app has to still be holding one after an internal navigation for the
 * "choose a new password" screen to appear at all.
 */
const authFragment = (): string =>
  /access_token|refresh_token|type=recovery|error_description/.test(window.location.hash)
    ? window.location.hash
    : '';

/** The address a link to this page should carry, for `href` attributes. */
export const hrefFor = (path: string, lang?: Lang): string => resolve(path, lang).href;

/**
 * The address this tab actually opened on, remembered once.
 *
 * The app corrects the address as it starts — a signed-out visitor at
 * `/register` is moved to the door's canonical address, a screen is moved to
 * `/login` — and in development every effect runs twice. Re-reading
 * `location.pathname` on the second run therefore adopts the *corrected*
 * address as though the person had asked for it, which is how a link to
 * `/register` used to open the sign-in form. Captured at module load, before
 * anything has had the chance to rewrite it.
 */
const ENTRY_PATH = entryPath(window.location.pathname);

export const useRoute = create<RouteStore>((set) => ({
  path: ENTRY_PATH,

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
    // The fragment belongs to the page that put it there. Carrying it across
    // meant walking from `/homepage#inside` to the About page and arriving at
    // `/about#inside` — an address naming a section that is not on it.
    //
    // One fragment does travel: the one a Supabase e-mail link puts there.
    // Dropping that would turn "set a new password" into a silent login.
    const url = `${next}${authFragment()}`;
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
    void import('./appAddress').then((m) => m.applyAddress(path));
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
  enter(adopt(ENTRY_PATH));

  return () => {
    window.removeEventListener('popstate', onPop);
    stopLang();
  };
}
