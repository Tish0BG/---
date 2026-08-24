import type { Lang } from '@/brand';

/**
 * Every address the public web is allowed to see, in every language it is
 * allowed to see it in.
 *
 * One table, read by four things that must never disagree: the router, the
 * head-tag writer, the language switch, and the build script that emits
 * `sitemap.xml`, `robots.txt` and a pre-rendered shell per route per
 * language. A page that exists in the app but not here gets no metadata and
 * no sitemap entry; a page listed here but not built would 404 on the first
 * crawl. Keeping them in one list is what stops that.
 *
 * `indexable: false` is not a security control. Anything that must not be
 * read by a stranger is behind authentication and row-level security, not
 * behind a line in robots.txt.
 *
 * Imported by a Node script as well as by the app, so it stays free of every
 * runtime import: no store, no `window`, nothing but data and pure functions.
 */

/* ------------------------------------------------------------- languages */

export const LANGS = ['bg', 'en'] as const;

/**
 * The language served from the unprefixed addresses.
 *
 * Bulgarian, because that is who the product is for and what the site has
 * been answering `/` with since it went up — moving it now would change the
 * meaning of the one URL anybody has already linked to. English lives one
 * level down, at `/en`, and each version says so in its own `hreflang`.
 *
 * The consequence worth stating out loud: there is no `/bg/…`. A prefix that
 * repeats the default language is a second address for a page that already
 * has one, which is the duplicate this file exists to prevent. `/bg/faq`
 * permanently redirects to `/faq` instead of answering beside it.
 */
export const DEFAULT_LANG: Lang = 'bg';

/** What Open Graph wants where the rest of the page says `bg` or `en`. */
export const OG_LOCALE: Record<Lang, string> = { bg: 'bg_BG', en: 'en_US' };

export interface RouteCopy {
  bg: string;
  en: string;
}

export type PublicRouteId = 'home' | 'about' | 'faq' | 'contact' | 'privacy' | 'terms' | 'cookies';

export interface PublicRoute {
  id: PublicRouteId;
  /** The language-neutral address. `/en` is prepended for English. */
  path: string;
  /** listed in sitemap.xml and left crawlable */
  indexable: boolean;
  /** sitemap hints; the home page changes most, the legal pages least */
  priority: number;
  changefreq: 'weekly' | 'monthly' | 'yearly';
  title: RouteCopy;
  description: RouteCopy;
  /** shown in the footer and in the breadcrumb trail */
  label: RouteCopy;
  /** the page's own `h1`, for the fallback a crawler reads without scripts */
  heading: RouteCopy;
}

export const PUBLIC_ROUTES: PublicRoute[] = [
  {
    id: 'home',
    path: '/homepage',
    indexable: true,
    priority: 1,
    changefreq: 'weekly',
    label: { bg: 'Начало', en: 'Home' },
    heading: { bg: 'От план към резултат.', en: 'From plan to progress.' },
    title: {
      bg: 'Plauvia — От план към резултат.',
      en: 'Plauvia — From plan to progress.',
    },
    description: {
      bg: 'Планирай, учи, фокусирай се и следи напредъка. Plauvia държи учебниците, дъските, флашкартите и учебното време на едно място — и работи офлайн.',
      en: 'Plan, study, focus and track. Plauvia keeps your textbooks, whiteboards, flashcards and study time in one place — and works offline.',
    },
  },
  {
    id: 'about',
    path: '/about',
    indexable: true,
    priority: 0.6,
    changefreq: 'monthly',
    label: { bg: 'За Plauvia', en: 'About' },
    heading: { bg: 'За Plauvia', en: 'About Plauvia' },
    title: {
      bg: 'За Plauvia — какво е и за кого е',
      en: 'About Plauvia — what it is and who it is for',
    },
    description: {
      bg: 'Plauvia е работно място за учене: учебници, дъски, флашкарти, план и фокус на едно място. Как е направено и защо данните стоят първо на твоето устройство.',
      en: 'Plauvia is a workspace for studying: textbooks, boards, flashcards, a plan and focus in one place. How it is built, and why the data lives on your device first.',
    },
  },
  {
    id: 'faq',
    path: '/faq',
    indexable: true,
    priority: 0.7,
    changefreq: 'monthly',
    label: { bg: 'Въпроси', en: 'FAQ' },
    heading: { bg: 'Въпроси и отговори', en: 'Questions and answers' },
    title: {
      bg: 'Въпроси и отговори — Plauvia',
      en: 'Questions and answers — Plauvia',
    },
    description: {
      bg: 'Работи ли офлайн, къде стоят данните, безплатно ли е, как се сменя парола и как се изтрива профил — отговорите за Plauvia.',
      en: 'Does it work offline, where is the data kept, is it free, how do you reset a password and delete an account — the answers about Plauvia.',
    },
  },
  {
    id: 'contact',
    path: '/contact',
    indexable: true,
    priority: 0.5,
    changefreq: 'yearly',
    label: { bg: 'Контакт', en: 'Contact' },
    heading: { bg: 'Контакт', en: 'Contact' },
    title: {
      bg: 'Контакт — Plauvia',
      en: 'Contact — Plauvia',
    },
    description: {
      bg: 'Как да се свържеш с Plauvia — въпроси за продукта, съобщения за проблеми, искания за данни и въпроси по сигурността.',
      en: 'How to reach Plauvia — product questions, bug reports, data requests and security disclosures.',
    },
  },
  {
    id: 'privacy',
    path: '/privacy',
    indexable: true,
    priority: 0.4,
    changefreq: 'yearly',
    label: { bg: 'Поверителност', en: 'Privacy' },
    heading: { bg: 'Политика за поверителност', en: 'Privacy Policy' },
    title: {
      bg: 'Политика за поверителност — Plauvia',
      en: 'Privacy Policy — Plauvia',
    },
    description: {
      bg: 'Какви данни събира Plauvia, къде се съхраняват, кой има достъп до тях и как да поискаш копие или изтриване.',
      en: 'What data Plauvia collects, where it is stored, who can reach it, and how to ask for a copy or a deletion.',
    },
  },
  {
    id: 'terms',
    path: '/terms',
    indexable: true,
    priority: 0.4,
    changefreq: 'yearly',
    label: { bg: 'Условия', en: 'Terms' },
    heading: { bg: 'Общи условия', en: 'Terms of Service' },
    title: {
      bg: 'Общи условия — Plauvia',
      en: 'Terms of Service — Plauvia',
    },
    description: {
      bg: 'Условията за ползване на Plauvia: какво обещава услугата, какво се очаква от теб и как приключва профил.',
      en: 'The terms for using Plauvia: what the service promises, what is expected of you, and how an account ends.',
    },
  },
  {
    id: 'cookies',
    path: '/cookies',
    indexable: true,
    priority: 0.3,
    changefreq: 'yearly',
    label: { bg: 'Бисквитки', en: 'Cookies' },
    heading: { bg: 'Бисквитки и локално съхранение', en: 'Cookies and local storage' },
    title: {
      bg: 'Бисквитки и локално съхранение — Plauvia',
      en: 'Cookies and local storage — Plauvia',
    },
    description: {
      bg: 'Plauvia не използва рекламни или аналитични бисквитки. Какво все пак се пази в браузъра ти и защо.',
      en: 'Plauvia sets no advertising or analytics cookies. What is nonetheless kept in your browser, and why.',
    },
  },
];

/**
 * Addresses that belong to the app rather than to the web.
 *
 * Real links people paste and bookmark — every screen has one, so a calendar
 * can be sent to somebody the same way a page of the site can — but nothing a
 * search engine should hold on to. A crawler is not signed in, so each of
 * these would serve it the same door; they are `noindex` in the head and
 * disallowed in robots.txt, and none of them is in `sitemap.xml`.
 *
 * They carry no language prefix. The app's language is a preference of the
 * person signed in, not a property of the address, and `/en/app` is therefore
 * not an address at all — it answers 404 like any other invention.
 */
export interface AppPage {
  path: string;
  title: RouteCopy;
  description: RouteCopy;
}

export const APP_PAGES: AppPage[] = [
  {
    path: '/login',
    title: { bg: 'Вход — Plauvia', en: 'Sign in — Plauvia' },
    description: { bg: 'Влез в профила си в Plauvia.', en: 'Sign in to your Plauvia account.' },
  },
  {
    path: '/register',
    title: { bg: 'Регистрация — Plauvia', en: 'Create an account — Plauvia' },
    description: { bg: 'Създай профил в Plauvia.', en: 'Create your Plauvia account.' },
  },
  {
    path: '/dashboard',
    title: { bg: 'Табло — Plauvia', en: 'Dashboard — Plauvia' },
    description: { bg: 'Работното място на Plauvia.', en: 'The Plauvia workspace.' },
  },
];

export const APP_PATHS = APP_PAGES.map((p) => p.path);

/**
 * The app page an address belongs to — every screen answers `/dashboard`,
 * because they are the same shell with the same metadata.
 *
 * Its only job is to keep the tab and the description honest while the app is
 * still starting; once a screen is on the page it names itself.
 */
export const appPageByPath = (path: string): AppPage | undefined => {
  const { path: clean, prefixed } = parsePath(path);
  if (prefixed) return undefined;
  if (APP_PATHS.includes(clean)) return APP_PAGES.find((p) => p.path === clean);
  return isAppPath(clean) ? APP_PAGES.find((p) => p.path === '/dashboard') : undefined;
};

/**
 * One address per screen, and the address is the screen's name.
 *
 * Flat, one word, no `/app/` in front of it: an address is read by a person
 * before it is read by anything else, and `/calendar` says what `/app/calendar`
 * says with a level of filing removed. They share the namespace with the public
 * pages, which is safe for exactly one reason — every name in the product is in
 * this file, so a collision is a merge conflict rather than a bug in
 * production.
 */
export const APP_SCREEN_PATHS = [
  '/tasks',
  '/calendar',
  '/goals',
  '/exams',
  '/library',
  '/cards',
  '/focus',
  '/stats',
  '/achievements',
  '/subjects',
  '/profile',
  '/settings',
] as const;

/**
 * The addresses that carry an id: an open document, one subject's page, one
 * room of the settings. Ids are base-36 and lower-case, which is why
 * `normalisePath` lower-casing the address does no harm here.
 */
const APP_DEEP_PATH = /^\/(document|subjects|settings)\/[a-z0-9_-]+$/;

/* ------------------------------------------------------------ addressing */

/** Trailing slashes are the classic way to end up with two URLs for one page. */
export function normalisePath(path: string): string {
  const clean = path.replace(/\/+$/, '');
  return clean === '' ? '/' : clean.toLowerCase();
}

export interface Address {
  /** the language the address asks for, defaulting to the unprefixed one */
  lang: Lang;
  /** the language-neutral path: `/en/about` and `/about` both give `/about` */
  path: string;
  /** whether the address actually carried a prefix */
  prefixed: boolean;
}

/**
 * Splits an address into "which language" and "which page".
 *
 * Everything downstream — the router, the head, the switch — works in terms
 * of the language-neutral path plus a language, so nothing else in the code
 * has to know how the prefix is spelled or where it sits.
 */
export function parsePath(raw: string): Address {
  const clean = normalisePath(raw);
  const head = clean.split('/')[1] ?? '';
  if ((LANGS as readonly string[]).includes(head)) {
    return { lang: head as Lang, path: normalisePath(clean.slice(head.length + 1) || '/'), prefixed: true };
  }
  return { lang: DEFAULT_LANG, path: clean, prefixed: false };
}

/** Where one page lives in one language. The only place a prefix is written. */
export function localePath(path: string, lang: Lang): string {
  const clean = parsePath(path).path;
  if (lang === DEFAULT_LANG) return clean;
  return clean === '/' ? `/${lang}` : `/${lang}${clean}`;
}

export const routeByPath = (path: string): PublicRoute | undefined => {
  const { path: clean } = parsePath(path);
  return PUBLIC_ROUTES.find((r) => r.path === clean);
};

export const isAppPath = (path: string): boolean => {
  const { path: clean, prefixed } = parsePath(path);
  if (prefixed) return false;
  return (
    APP_PATHS.includes(clean) ||
    (APP_SCREEN_PATHS as readonly string[]).includes(clean) ||
    APP_DEEP_PATH.test(clean)
  );
};

/** True for anything that is neither a public page nor one of the app's own links. */
export const isUnknownPath = (path: string): boolean => !routeByPath(path) && !isAppPath(path);

/**
 * The address this one should have been, or `null` when it already is.
 *
 * Four kinds of thing end up here, and all four are answered with a 301 by
 * the host and straightened out in place by the browser:
 *
 *   · `/` — the front door has a name, `/homepage`, and one address per page
 *     means the root is a doorway to it rather than a second copy of it.
 *   · `/bg/…` — a prefix for the language that already owns the unprefixed
 *     path.
 *   · `/app/…` — the old filing, before every screen got a one-word address.
 *   · `/signup`, `/home`, `/index` — earlier spellings of pages that are
 *     still here.
 *
 * Old links keep working. That is the whole point of writing them down rather
 * than deleting them.
 */
export const HOME = '/homepage';

function legacyTarget(bare: string): string | null {
  if (bare === '/' || bare === '/home' || bare === '/index') return HOME;
  if (bare === '/signup') return '/register';
  if (bare === '/app') return '/dashboard';
  const doc = /^\/app\/d\/([a-z0-9_-]+)$/.exec(bare);
  if (doc) return `/document/${doc[1]}`;
  if (bare.startsWith('/app/')) return bare.slice(4);
  return null;
}

export function redirectFor(path: string): string | null {
  const { lang, path: bare, prefixed } = parsePath(path);
  if (prefixed && lang === DEFAULT_LANG) return legacyTarget(bare) ?? bare;
  const target = legacyTarget(bare);
  if (!target) return null;
  // A language prefix survives the correction: `/en` is the English home page
  // under its old name, not the Bulgarian one.
  return prefixed ? localePath(target, lang) : target;
}

/**
 * The address to start from, with every correction already applied.
 *
 * Used wherever a raw address first enters the app — the router's initial
 * state, the language store, a link somebody wrote by hand — so that no part
 * of the app ever holds an address that is about to change. Without it the
 * first render of `/` is a 404 page, for the one frame before the redirect.
 */
export const entryPath = (raw: string): string => redirectFor(raw) ?? normalisePath(raw);
