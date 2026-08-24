import { BRAND, type Lang } from '@/brand';
import {
  DEFAULT_LANG,
  LANGS,
  OG_LOCALE,
  PUBLIC_ROUTES,
  appPageByPath,
  isAppPath,
  isUnknownPath,
  localePath,
  normalisePath,
  parsePath,
  routeByPath,
  type PublicRoute,
  type RouteCopy,
} from './routes';
import { schemaGraph, shareImageAlt } from './schema';

/**
 * Everything a page tells a crawler, written from one place.
 *
 * The build emits a pre-rendered shell per public route per language, so the
 * first byte a crawler reads already carries the right title, description,
 * canonical and hreflang set. This module is what keeps them right afterwards
 * — when someone navigates client-side, or crosses from the site into the
 * app, and the head would otherwise still be describing the page they arrived
 * on.
 *
 * The rule the whole file turns on: **the address decides the language of a
 * public page**, not a preference and not the browser. `/faq` is the
 * Bulgarian page and `/en/faq` is the English one, always, for everybody. A
 * stored preference only gets a say where there is no address to ask — inside
 * the app, which no search engine sees.
 */

const ORIGIN = BRAND.url;

/** Replaces a tag's content, creating the tag if the shell did not carry it. */
function meta(selector: string, attr: 'name' | 'property', key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function link(rel: string, href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]:not([hreflang])`);
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

/**
 * The `hreflang` set, rewritten whole on every navigation.
 *
 * Whole, rather than patched, because the alternates are a property of the
 * page and not of the site: carrying `/about`'s set into `/app/calendar`
 * would tell a crawler that a screen behind a login is the English version of
 * the About page. Anything with no translations to declare gets an empty set
 * and the tags disappear.
 */
function setAlternates(entries: [string, string][]): void {
  for (const tag of document.head.querySelectorAll('link[rel="alternate"][hreflang]')) tag.remove();
  for (const [hreflang, href] of entries) {
    const tag = document.createElement('link');
    tag.rel = 'alternate';
    tag.hreflang = hreflang;
    tag.href = href;
    document.head.appendChild(tag);
  }
}

/** The absolute URL of a public page in one language. */
export const canonicalFor = (path: string, lang: Lang = DEFAULT_LANG): string => {
  const target = localePath(path, lang);
  return target === '/' ? `${ORIGIN}/` : `${ORIGIN}${target}`;
};

/** Every language version of one public page, plus the default as x-default. */
export const alternatesFor = (path: string): [string, string][] => [
  ...LANGS.map((l): [string, string] => [l, canonicalFor(path, l)]),
  ['x-default', canonicalFor(path, DEFAULT_LANG)],
];

/**
 * What an address that is not a page should call itself.
 *
 * A mistyped URL used to wear the home page's title and description, and —
 * worse — the home page's canonical link. That is the textbook soft 404: the
 * page says "not found" to a person while telling a crawler "this address is
 * the home page", which invites every junk URL anyone ever links to be folded
 * into the front door. It says what it is now, and points at itself.
 */
const NOT_FOUND: { title: RouteCopy; description: RouteCopy } = {
  title: {
    bg: 'Няма такава страница — Plauvia',
    en: 'Page not found — Plauvia',
  },
  description: {
    bg: 'Тази страница не съществува. Върни се към началото на Plauvia или виж въпросите и отговорите.',
    en: 'This page does not exist. Go back to the Plauvia home page, or see the questions and answers.',
  },
};

/**
 * What is filling the app window right now — a screen, an open document, a
 * focus session — as a name for the browser tab.
 *
 * It is remembered here rather than passed around because three separate
 * things write this tab and they were overwriting each other in whatever
 * order they happened to run: the router on every navigation and language
 * change, the focus timer on every tick, and the app itself when the screen
 * changes. They all ask `tabTitle` now, and it gives the same answer to all
 * three.
 *
 * The label is only used while the address is one of the app's own. That is
 * what makes it self-correcting: walking out to a public page cannot leave a
 * screen's name behind in the tab, because a public address never consults
 * it.
 *
 * Only the tab. The description, the canonical and the Open Graph tags stay
 * bound to the address.
 */
let windowLabel: string | null = null;
let lastPath = normalisePath(window.location.pathname);
let lastLang: Lang = DEFAULT_LANG;

const tabTitle = (path: string, lang: Lang): string =>
  windowLabel && isAppPath(path) ? `${windowLabel} · ${BRAND.name}` : pageTitle(path, lang);

/**
 * What the tab should say when nothing is temporarily borrowing it.
 *
 * The focus timer borrows it — a countdown in the tab is the point of running
 * one — and has to know what to put back afterwards. It used to put back the
 * *address's* title, which meant every tick outside a session quietly undid
 * the name of the screen you were looking at.
 */
export const currentTabTitle = (lang: Lang = lastLang): string => tabTitle(lastPath, lang);

/** The language a given address is written in, ignoring any preference. */
export function langForPath(path: string, fallback: Lang): Lang {
  return routeByPath(path) ? parsePath(path).lang : fallback;
}

/** The title this address should be wearing, whatever else has borrowed the tab. */
export function pageTitle(path: string, prefLang: Lang): string {
  const lang = langForPath(path, prefLang);
  const route = routeByPath(path);
  if (route) return route.title[lang];
  if (isUnknownPath(path)) return NOT_FOUND.title[lang];
  // An app address, before a screen has named itself. Its title is in the
  // table too, so the tab does not change the moment the bundle finishes
  // loading and the client writes over what the shell said.
  return appPageByPath(path)?.title[lang] ?? `${BRAND.name} — ${BRAND.tagline[lang]}`;
}

/**
 * Points the head at one address.
 *
 * `indexable: false` gets a real `noindex` rather than a robots.txt line: the
 * app's own screens are reachable by URL and a directive in the page is the
 * only one a crawler is obliged to honour once it has the page.
 */
export function applyHead(path: string, prefLang: Lang, label?: string | null): void {
  const route = routeByPath(path);
  const missing = isUnknownPath(path);
  const lang = langForPath(path, prefLang);
  const title = pageTitle(path, prefLang);
  const description = route
    ? route.description[lang]
    : missing
      ? NOT_FOUND.description[lang]
      : (appPageByPath(path)?.description[lang] ?? BRAND.meta[lang]);
  // Anything that is not a public page is its own canonical: the app
  // addresses because they are real, and a mistyped one because pointing it
  // at the home page is how a 404 becomes a duplicate of the front door.
  const canonical = route ? canonicalFor(route.path, lang) : canonicalFor(parsePath(path).path, DEFAULT_LANG);

  lastPath = normalisePath(path);
  lastLang = lang;
  if (label !== undefined) windowLabel = label;
  document.title = tabTitle(path, prefLang);
  document.documentElement.lang = lang;

  meta('meta[name="description"]', 'name', 'description', description);
  meta('meta[name="robots"]', 'name', 'robots', route?.indexable ? 'index,follow' : 'noindex,follow');

  link('canonical', canonical);
  // Only a page that genuinely exists in both languages declares alternates.
  // The app's screens have one address and no translation of it, and an
  // address that is not a page has nothing to be an alternate of.
  setAlternates(route ? alternatesFor(route.path) : []);

  meta('meta[property="og:title"]', 'property', 'og:title', title);
  meta('meta[property="og:description"]', 'property', 'og:description', description);
  meta('meta[property="og:url"]', 'property', 'og:url', canonical);
  meta('meta[property="og:locale"]', 'property', 'og:locale', OG_LOCALE[lang]);
  meta(
    'meta[property="og:locale:alternate"]',
    'property',
    'og:locale:alternate',
    OG_LOCALE[lang === 'bg' ? 'en' : 'bg'],
  );
  meta('meta[property="og:image:alt"]', 'property', 'og:image:alt', shareImageAlt(lang));
  meta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  meta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  meta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', shareImageAlt(lang));

  writeStructuredData(route, lang);
}

/* ---------------------------------------------------------- structured data */

/**
 * The graph itself lives in `schema.ts`, which the build script also reads —
 * so what a crawler is handed in the shell and what the browser rewrites on
 * the next navigation are the same object, built by the same code.
 */
function writeStructuredData(route: PublicRoute | undefined, lang: Lang): void {
  let tag = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]#plauvia-ld');
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = 'plauvia-ld';
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(schemaGraph(route, lang));
}

/**
 * FAQ markup, added only on the page that actually shows the questions.
 *
 * Kept separate from the graph above because it has to be removed again when
 * the visitor navigates away: FAQ markup on a page with no visible FAQ is the
 * kind of thing that costs a site its rich results.
 */
export function applyFaqSchema(items: { q: string; a: string }[] | null): void {
  const id = 'plauvia-ld-faq';
  const existing = document.head.querySelector(`#${id}`);
  if (!items) {
    existing?.remove();
    return;
  }
  const tag = existing ?? document.createElement('script');
  if (!existing) {
    (tag as HTMLScriptElement).type = 'application/ld+json';
    tag.id = id;
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
}

export { PUBLIC_ROUTES };
