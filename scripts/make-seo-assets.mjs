/**
 * Emits the two files a crawler asks for before it asks for anything else,
 * and one pre-rendered shell per public page per language.
 *
 * Plauvia is a single-page application: without this step every address would
 * serve the same `index.html`, so every page in the index would carry the home
 * page's title, the home page's canonical and the home page's language.
 * Rather than adding a server to fix that, the build writes a real file at
 * every address that is meant to exist — `dist/about/index.html`,
 * `dist/en/about/index.html`, and so on — each the identical bundle with the
 * head tags for that page in that language already correct.
 *
 * Three consequences worth stating, because they are the point:
 *
 *   · Every indexable URL is a file, so Vercel answers it 200 from the
 *     filesystem with no rewrite involved, and anything that is *not* a file
 *     falls through to `404.html` with a real 404 status. A single catch-all
 *     rewrite would have turned every mistyped address into a soft 404.
 *   · The app's own addresses get shells too, carrying `noindex`. They are
 *     real links people paste; they are not pages a search engine should keep.
 *   · Each shell carries a `<noscript>` copy of its heading, its description
 *     and the whole navigation, in both languages. It is what a client with
 *     no JavaScript — and the first pass of a crawler that has not run any
 *     yet — reads instead of an empty `<div id="root">`.
 *
 * The client re-applies the same tags on navigation; this is about the very
 * first byte.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_PAGES,
  DEFAULT_LANG,
  LANGS,
  OG_LOCALE,
  PUBLIC_ROUTES,
  localePath,
} from '../src/seo/routes.ts';
import { schemaGraph, shareImageAlt } from '../src/seo/schema.ts';
import { BRAND } from '../src/brand.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const ORIGIN = BRAND.url;

/** The absolute address of one public page in one language. */
const url = (path, lang) => {
  const target = localePath(path, lang);
  return target === '/' ? `${ORIGIN}/` : `${ORIGIN}${target}`;
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------- sitemap.xml */

const today = new Date().toISOString().slice(0, 10);

/**
 * When each page last actually changed.
 *
 * Every entry used to carry the build date, which meant a deploy that only
 * touched the timer told crawlers all seven pages had been rewritten. A
 * `lastmod` that is always "today" is a `lastmod` that gets ignored, and then
 * a page that genuinely changes is not re-read either. So the date comes from
 * the last commit that touched the files the page is actually made of.
 *
 * Falls back to the build date where there is no git — a tarball, a fresh
 * checkout with no history — which is the old behaviour and no worse than it.
 */
const SOURCES = {
  home: ['src/components/landing'],
  about: ['src/components/public/content.ts'],
  faq: ['src/components/public/content.ts'],
  contact: ['src/components/public/content.ts', 'src/legal.ts'],
  privacy: ['src/components/public/legal.ts', 'src/legal.ts'],
  terms: ['src/components/public/legal.ts', 'src/legal.ts'],
  cookies: ['src/components/public/legal.ts', 'src/legal.ts'],
};

const lastModified = (id) => {
  const paths = SOURCES[id];
  if (!paths) return today;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : today;
  } catch {
    return today;
  }
};

/**
 * Every language version of a page names every other one, itself included,
 * and the default answers for `x-default`.
 *
 * This is the part that has to be symmetrical or Google discards the lot: if
 * `/faq` claims `/en/faq` as its English version, `/en/faq` has to claim
 * `/faq` back. Generating both sides from one list is how that stays true —
 * which is exactly what the old file could not do, because there was only
 * ever one URL and all three annotations pointed at it.
 */
const alternates = (path) =>
  [...LANGS.map((l) => [l, url(path, l)]), ['x-default', url(path, DEFAULT_LANG)]]
    .map(([hreflang, href]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}" />`)
    .join('\n');

const indexable = PUBLIC_ROUTES.filter((r) => r.indexable);

const entries = indexable
  .flatMap((r) => LANGS.map((lang) => ({ route: r, lang })))
  .map(
    ({ route, lang }) => `  <url>
    <loc>${url(route.path, lang)}</loc>
${alternates(route.path)}
    <lastmod>${lastModified(route.id)}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n');

writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`,
);

/* -------------------------------------------------------------- robots.txt */

/**
 * Written by the build rather than kept as a file in `public/`, so that the
 * origin, the sitemap address and the reasoning below cannot drift away from
 * the table the rest of the site is generated from.
 *
 * The substance of it is one decision: crawling is allowed everywhere, and
 * what must not be indexed says so in its own head. See the text itself.
 */
writeFileSync(
  resolve(dist, 'robots.txt'),
  `# ${BRAND.name} — ${ORIGIN}
#
# The app's own addresses — /login, /signup and everything under /app — are
# deliberately NOT disallowed here. They must not be indexed, and the way to
# say that is the noindex directive each of them carries in its own head; a
# crawler has to be allowed to fetch a page in order to read it. Blocking them
# here instead would leave Google with an address it may not open and may not
# rule out, which is how a login form ends up in the index as a bare URL.
#
# robots.txt is not a security control either. Everything private sits behind
# authentication and row-level security.
#
# Nothing needed for rendering is blocked — stylesheets, scripts, fonts and
# images are all open, because a page Google cannot render is a page Google
# cannot judge.

User-agent: *
Allow: /

# The one exception: the legacy "?go=" shortcut, which names a screen inside
# the app. Every value of it answers with the same shell under a different
# address, and there is no end to the values.
Disallow: /*?go=

Sitemap: ${ORIGIN}/sitemap.xml
`,
);

/* ------------------------------------------------------ one shell per page */

const shell = readFileSync(resolve(dist, 'index.html'), 'utf8');

if (!shell.includes('<!--seo-->') || !shell.includes('<!--fallback-->')) {
  console.error('\n  Plauvia · index.html е без маркерите <!--seo--> / <!--fallback-->.\n');
  process.exit(1);
}

/**
 * The head, written whole rather than patched tag by tag.
 *
 * Patching was the old way and it had the failure mode you would expect: a
 * tag the shell happened not to carry was silently appended, a tag it carried
 * twice was half-updated, and nothing ever noticed. One block, replaced
 * between two markers, cannot drift.
 */
function head({ lang, title, description, canonical, hreflang = true, robots, route }) {
  const other = lang === 'bg' ? 'en' : 'bg';
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="robots" content="${robots}" />`,
  ];
  if (canonical) lines.push(`<link rel="canonical" href="${canonical}" />`);
  if (hreflang && route) {
    for (const l of LANGS) lines.push(`<link rel="alternate" hreflang="${l}" href="${url(route.path, l)}" />`);
    lines.push(`<link rel="alternate" hreflang="x-default" href="${url(route.path, DEFAULT_LANG)}" />`);
  }
  lines.push(
    '',
    `<meta property="og:site_name" content="${BRAND.name}" />`,
    `<meta property="og:type" content="website" />`,
    ...(canonical ? [`<meta property="og:url" content="${canonical}" />`] : []),
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${ORIGIN}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(shareImageAlt(lang))}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    `<meta property="og:locale:alternate" content="${OG_LOCALE[other]}" />`,
    '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${ORIGIN}/og.png" />`,
    `<meta name="twitter:image:alt" content="${esc(shareImageAlt(lang))}" />`,
    '',
    `<script type="application/ld+json" id="plauvia-ld">${JSON.stringify(schemaGraph(route, lang))
      .replace(/</g, '\\u003c')}</script>`,
  );
  return lines.map((l) => (l ? `    ${l}` : '')).join('\n');
}

/**
 * What is in the document before a single line of JavaScript runs.
 *
 * Google renders JavaScript, so this is not the difference between indexed
 * and not. It is the difference between a page whose subject and links are
 * legible on the first pass and one that is an empty div until a second pass
 * that may be days later — and it is the whole of the page for anyone
 * browsing without scripts. Every public address in both languages appears in
 * it, so no page depends on a rendered nav to be discovered.
 */
function fallback(route, lang) {
  const links = PUBLIC_ROUTES.flatMap((r) =>
    LANGS.map(
      (l) =>
        `        <li><a href="${localePath(r.path, l)}" hreflang="${l}" lang="${l}">${esc(r.label[l])}${
          l === DEFAULT_LANG ? '' : ' (English)'
        }</a></li>`,
    ),
  ).join('\n');

  return `<noscript>
      <div style="max-width:44rem;margin:0 auto;padding:2rem 1.25rem;font-family:system-ui,sans-serif;line-height:1.6">
        <p><strong>${BRAND.name}</strong> — ${esc(BRAND.tagline[lang])}</p>
        <h1>${esc(route.heading[lang])}</h1>
        <p>${esc(route.description[lang])}</p>
        <p>${esc(
          lang === 'bg'
            ? 'Plauvia работи с включен JavaScript. Страниците по-долу са достъпни и без него като адреси.'
            : 'Plauvia needs JavaScript to run. The pages below are reachable as addresses regardless.',
        )}</p>
        <nav aria-label="${lang === 'bg' ? 'Страници' : 'Pages'}">
          <ul>
${links}
          </ul>
        </nav>
      </div>
    </noscript>`;
}

/** Writes one address: the shell, with this page's head and this page's fallback. */
function emit(file, { lang, seo, body = '' }) {
  let html = shell
    // The note to whoever edits `index.html` is for `index.html`. Shipping it
    // on every page would leave an English page carrying a comment about the
    // Bulgarian one.
    .replace(/\n\s*<!--\s*\n\s+Everything between[\s\S]*?-->/, '')
    .replace(/<html lang="[^"]*"/i, `<html lang="${lang}"`)
    .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, () => `<!--seo-->\n${seo}\n    <!--/seo-->`)
    .replace(/<!--fallback-->[\s\S]*?<!--\/fallback-->/, () => `<!--fallback-->${body}<!--/fallback-->`);

  const target = resolve(dist, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  return file;
}

const written = [];

/* the public web, in every language it exists in */
for (const route of PUBLIC_ROUTES) {
  for (const lang of LANGS) {
    const path = localePath(route.path, lang);
    const file = path === '/' ? 'index.html' : `${path.replace(/^\//, '')}/index.html`;
    written.push(
      emit(file, {
        lang,
        seo: head({
          lang,
          route,
          title: route.title[lang],
          description: route.description[lang],
          canonical: url(route.path, lang),
          robots: route.indexable ? 'index,follow' : 'noindex,follow',
        }),
        body: fallback(route, lang),
      }),
    );
  }
}

/**
 * The app's own addresses.
 *
 * Real files rather than a rewrite, so `/login` answers 200 with a page that
 * says `noindex` in its own head — the only instruction a crawler must obey —
 * instead of either a raw 404 from the host or a copy of the home page's
 * metadata. `/app/*` below them needs one rewrite, because a screen's address
 * can carry an id nobody can enumerate at build time.
 *
 * The titles come from the same table the client reads, so the tab does not
 * change the moment the bundle finishes loading.
 */
for (const page of APP_PAGES) {
  written.push(
    emit(`${page.path.replace(/^\//, '')}/index.html`, {
      lang: DEFAULT_LANG,
      seo: head({
        lang: DEFAULT_LANG,
        route: undefined,
        title: page.title[DEFAULT_LANG],
        description: page.description[DEFAULT_LANG],
        canonical: `${ORIGIN}${page.path}`,
        hreflang: false,
        robots: 'noindex,follow',
      }),
    }),
  );
}

/**
 * The page for an address that is not one.
 *
 * Vercel serves this file, with a real 404 status, for anything that did not
 * match a file above. It carries no canonical on purpose: one address's
 * canonical cannot be right for the thousand different mistyped URLs this
 * same file answers, and pointing them all at the home page is precisely how
 * a 404 becomes a duplicate of the front door. The client writes a
 * self-referencing one once it knows which address it landed on.
 */
written.push(
  emit('404.html', {
    lang: DEFAULT_LANG,
    seo: head({
      lang: DEFAULT_LANG,
      route: undefined,
      title: 'Няма такава страница — Plauvia',
      description: 'Тази страница не съществува. Върни се към началото на Plauvia.',
      canonical: null,
      hreflang: false,
      robots: 'noindex,follow',
    }),
    body: fallback(PUBLIC_ROUTES[0], DEFAULT_LANG),
  }),
);

/* ------------------------------------------------- the consistency check */

/**
 * Every page must name files that are actually in the folder being deployed.
 *
 * This is here because the opposite once shipped: an `index.html` referring to
 * a JavaScript chunk that was not next to it, which is not a broken page but a
 * blank one — the browser fetches the only script the document has, gets a
 * 404, and there is nothing left to draw. No error, no message, nothing for a
 * person to report except "the site is white".
 *
 * A build that would produce that should not finish. Failing here costs a
 * deploy; not failing costs whoever opens the site next.
 */
const missing = [];
for (const file of written) {
  const html = readFileSync(resolve(dist, file), 'utf8');
  for (const ref of new Set(html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) ?? [])) {
    if (!existsSync(resolve(dist, ref.replace(/^\//, '')))) missing.push(`${file} → ${ref}`);
  }
}

/** Every address in the sitemap must be one of the files just written. */
const sitemap = readFileSync(resolve(dist, 'sitemap.xml'), 'utf8');
for (const loc of sitemap.match(/<loc>([^<]+)<\/loc>/g) ?? []) {
  const path = loc.replace(/<\/?loc>/g, '').slice(ORIGIN.length);
  const file = path === '/' ? 'index.html' : `${path.replace(/^\//, '')}/index.html`;
  if (!existsSync(resolve(dist, file))) missing.push(`sitemap.xml → ${path} (няма такъв файл)`);
}

if (missing.length) {
  console.error('\n  Plauvia · сглобяването сочи към файлове, които ги няма:\n');
  for (const line of missing) console.error(`    ${line}`);
  console.error('\n  Това би дало бял екран или 404 на живо. Спирам, вместо да го пусна.\n');
  process.exit(1);
}

/* A folder left over from an earlier build is a page nobody meant to publish. */
const stale = readdirSync(dist, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => `/${e.name}`)
  .filter(
    (p) =>
      !written.some((f) => f.startsWith(`${p.slice(1)}/`)) &&
      !['/assets', '/fonts', '/icons', '/cmaps', '/standard_fonts', '/wasm', '/iccs', '/en'].includes(p),
  );

if (stale.length) console.warn(`  Plauvia · непознати папки в dist: ${stale.join(', ')}`);

console.log(
  `  Plauvia · sitemap.xml (${indexable.length * LANGS.length} адреса), robots.txt и ${written.length} страници с готови мета-етикети`,
);
