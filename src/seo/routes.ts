/**
 * Every address the public web is allowed to see.
 *
 * One table, read by three things that must never disagree: the router, the
 * head-tag writer, and the build script that emits `sitemap.xml` and a
 * pre-rendered shell per route. A page that exists in the app but not here
 * gets no metadata and no sitemap entry; a page listed here but not built
 * would 404 on the first crawl. Keeping them in one list is what stops that.
 *
 * `indexable: false` is not a security control. Anything that must not be
 * read by a stranger is behind authentication and row-level security, not
 * behind a line in robots.txt.
 */

export interface RouteCopy {
  bg: string;
  en: string;
}

export type PublicRouteId = 'home' | 'about' | 'faq' | 'contact' | 'privacy' | 'terms' | 'cookies';

export interface PublicRoute {
  id: PublicRouteId;
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
}

export const PUBLIC_ROUTES: PublicRoute[] = [
  {
    id: 'home',
    path: '/',
    indexable: true,
    priority: 1,
    changefreq: 'weekly',
    label: { bg: 'Начало', en: 'Home' },
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
 * Real links people paste and bookmark — every screen has one now, so a
 * calendar can be sent to somebody the same way a page of the site can — but
 * nothing a search engine should hold on to. A crawler is not signed in, so
 * each of these would serve it the same door; they are `noindex` in the head
 * and disallowed in robots.txt, and none of them is in `sitemap.xml`.
 *
 * Kept here as plain strings on purpose. This file is read by the build
 * script under Node, so it must not drag a single store in behind it.
 */
export const APP_PATHS = ['/login', '/signup', '/app'] as const;

/** One per screen. The slug after `/app/` is what the app calls the view. */
export const APP_SCREEN_PATHS = [
  '/app/tasks',
  '/app/calendar',
  '/app/goals',
  '/app/exams',
  '/app/library',
  '/app/cards',
  '/app/focus',
  '/app/stats',
  '/app/achievements',
  '/app/subjects',
  '/app/profile',
  '/app/settings',
] as const;

/**
 * The addresses that carry an id: an open document, one subject's page, one
 * room of the settings. Ids are base-36 and lower-case, which is why
 * `normalisePath` lower-casing the address does no harm here.
 */
const APP_DEEP_PATH = /^\/app\/(d|subjects|settings)\/[a-z0-9_-]+$/;

export const routeByPath = (path: string): PublicRoute | undefined =>
  PUBLIC_ROUTES.find((r) => r.path === normalisePath(path));

/** Trailing slashes are the classic way to end up with two URLs for one page. */
export function normalisePath(path: string): string {
  const clean = path.replace(/\/+$/, '');
  return clean === '' ? '/' : clean.toLowerCase();
}

export const isAppPath = (path: string): boolean => {
  const clean = normalisePath(path);
  return (
    (APP_PATHS as readonly string[]).includes(clean) ||
    (APP_SCREEN_PATHS as readonly string[]).includes(clean) ||
    APP_DEEP_PATH.test(clean)
  );
};

/** True for anything that is neither a public page nor one of the app's own links. */
export const isUnknownPath = (path: string): boolean => !routeByPath(path) && !isAppPath(path);
