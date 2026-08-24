import { BRAND, type Lang } from '@/brand';
import {
  PUBLIC_ROUTES,
  isAppPath,
  isUnknownPath,
  normalisePath,
  routeByPath,
  type PublicRoute,
  type RouteCopy,
} from './routes';

/**
 * Everything a page tells a crawler, written from one place.
 *
 * The build emits a pre-rendered shell per public route, so the first byte a
 * crawler reads already carries the right title and description. This module
 * is what keeps them right afterwards — when someone navigates client-side, or
 * switches the interface language, and the head would otherwise still be
 * describing the page they arrived on.
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

function link(rel: string, href: string, hreflang?: string): void {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let tag = document.head.querySelector<HTMLLinkElement>(selector);
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    if (hreflang) tag.hreflang = hreflang;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

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
    bg: 'Тази страница не съществува. Върни се към началото на Plauvia или виж картата на сайта.',
    en: 'This page does not exist. Go back to the Plauvia home page, or see the site map.',
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
let lastLang: Lang = 'bg';

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

/** The title this address should be wearing, whatever else has borrowed the tab. */
export function pageTitle(path: string, lang: Lang): string {
  const route = routeByPath(path);
  if (route) return route.title[lang];
  if (isUnknownPath(path)) return NOT_FOUND.title[lang];
  return `${BRAND.name} — ${BRAND.tagline[lang]}`;
}

export const canonicalFor = (path: string): string => {
  const clean = normalisePath(path);
  return clean === '/' ? `${ORIGIN}/` : `${ORIGIN}${clean}`;
};

/**
 * Points the head at one public route.
 *
 * `indexable: false` gets a real `noindex` rather than a robots.txt line: the
 * app's own screens are reachable by URL and a directive in the page is the
 * only one a crawler is obliged to honour once it has the page.
 */
export function applyHead(path: string, lang: Lang, label?: string | null): void {
  const route = routeByPath(path);
  const missing = isUnknownPath(path);
  const title = pageTitle(path, lang);
  const description = route
    ? route.description[lang]
    : missing
      ? NOT_FOUND.description[lang]
      : BRAND.meta[lang];
  // Anything that is not a public page is its own canonical: the two app
  // addresses because they are real, and a mistyped one because pointing it
  // at the home page is how a 404 becomes a duplicate of the front door.
  const canonical = canonicalFor(route ? route.path : path);

  lastPath = normalisePath(path);
  lastLang = lang;
  if (label !== undefined) windowLabel = label;
  document.title = tabTitle(path, lang);
  document.documentElement.lang = lang;

  meta('meta[name="description"]', 'name', 'description', description);
  meta('meta[name="robots"]', 'name', 'robots', route?.indexable ? 'index,follow' : 'noindex,follow');

  link('canonical', canonical);
  // The same page in both languages lives at the same address — the interface
  // language is a preference, not a separate URL — so the alternates point at
  // this canonical and x-default with it.
  link('alternate', canonical, 'bg');
  link('alternate', canonical, 'en');
  link('alternate', canonical, 'x-default');

  meta('meta[property="og:title"]', 'property', 'og:title', title);
  meta('meta[property="og:description"]', 'property', 'og:description', description);
  meta('meta[property="og:url"]', 'property', 'og:url', canonical);
  meta('meta[property="og:locale"]', 'property', 'og:locale', lang === 'bg' ? 'bg_BG' : 'en_US');
  meta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  meta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

  writeStructuredData(route, lang);
}

/* ---------------------------------------------------------- structured data */

/**
 * JSON-LD for the things Plauvia genuinely is: an organisation, a website with
 * a name, and a piece of software. There is no `aggregateRating` and no
 * `review` block anywhere in here, because there are no ratings and no
 * reviews — inventing them is the one SEO trick that is also a lie.
 */
function writeStructuredData(route: PublicRoute | undefined, lang: Lang): void {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': `${ORIGIN}/#organization`,
      name: BRAND.name,
      url: `${ORIGIN}/`,
      logo: `${ORIGIN}/icons/icon-512.png`,
      description: BRAND.description[lang],
    },
    {
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      name: BRAND.name,
      url: `${ORIGIN}/`,
      inLanguage: ['bg', 'en'],
      publisher: { '@id': `${ORIGIN}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${ORIGIN}/#app`,
      name: BRAND.name,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web browser',
      url: `${ORIGIN}/`,
      description: BRAND.description[lang],
      // Free to use. Stated as a price rather than as a claim about value.
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
  ];

  if (route && route.id !== 'home') {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: BRAND.name, item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: route.label[lang], item: canonicalFor(route.path) },
      ],
    });
  }

  let tag = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]#plauvia-ld');
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = 'plauvia-ld';
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
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
