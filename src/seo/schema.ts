import { BRAND } from '../brand.ts';
import type { Lang } from '../brand.ts';
import { LANGS, localePath, type PublicRoute } from './routes.ts';

/**
 * The structured data, built as plain objects and nothing else.
 *
 * Kept apart from the head writer because two different things need the same
 * graph and must not drift: the browser, which rewrites it on every
 * client-side navigation, and the build script, which puts it in the shell so
 * that the very first byte a crawler reads already carries it. A `document`
 * anywhere in this file would rule the second one out — so there is none, and
 * the file imports by relative path rather than through the `@/` alias for
 * the same reason: Node runs it directly.
 *
 * What is described here is only what Plauvia demonstrably is: an
 * organisation, a website, a piece of software, and the page you are on.
 * There is no `aggregateRating` and no `review` block, because there are no
 * ratings and no reviews — inventing them is the one SEO trick that is also a
 * lie.
 */

const ORIGIN = BRAND.url;

/**
 * What the share image shows, in words.
 *
 * Read by a screen reader on a social card and by anyone whose client refuses
 * to load the picture, so it says the same thing the picture does rather than
 * naming the file.
 */
export const shareImageAlt = (lang: Lang): string => `${BRAND.name} — ${BRAND.tagline[lang]}`;

const absolute = (path: string, lang: Lang): string => {
  const target = localePath(path, lang);
  return target === '/' ? `${ORIGIN}/` : `${ORIGIN}${target}`;
};

export function schemaGraph(route: PublicRoute | undefined, lang: Lang): Record<string, unknown> {
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
      inLanguage: [...LANGS],
      publisher: { '@id': `${ORIGIN}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${ORIGIN}/#app`,
      name: BRAND.name,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web browser',
      url: `${ORIGIN}/`,
      inLanguage: [...LANGS],
      description: BRAND.description[lang],
      // Free to use. Stated as a price rather than as a claim about value.
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
  ];

  if (route) {
    graph.push({
      '@type': 'WebPage',
      '@id': `${absolute(route.path, lang)}#page`,
      url: absolute(route.path, lang),
      name: route.title[lang],
      description: route.description[lang],
      inLanguage: lang,
      isPartOf: { '@id': `${ORIGIN}/#website` },
    });

    if (route.id !== 'home') {
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: BRAND.name, item: absolute('/', lang) },
          { '@type': 'ListItem', position: 2, name: route.label[lang], item: absolute(route.path, lang) },
        ],
      });
    }
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
