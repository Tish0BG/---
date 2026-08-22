import { BRAND, type Lang } from '@/brand';
import { PUBLIC_ROUTES, normalisePath, routeByPath, type PublicRoute } from './routes';

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

/** The title this address should be wearing, whatever else has borrowed the tab. */
export function pageTitle(path: string, lang: Lang): string {
  const route = routeByPath(path);
  return route ? route.title[lang] : `${BRAND.name} — ${BRAND.tagline[lang]}`;
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
export function applyHead(path: string, lang: Lang): void {
  const route = routeByPath(path);
  const title = pageTitle(path, lang);
  const description = route ? route.description[lang] : BRAND.meta[lang];
  const canonical = canonicalFor(route ? route.path : '/');

  document.title = title;
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
