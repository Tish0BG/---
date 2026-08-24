/**
 * Emits the two files a crawler asks for before it asks for anything else,
 * and one pre-rendered shell per public page.
 *
 * Plauvia is a single-page application: without this step every address would
 * serve the same `index.html`, so every page in the index would carry the home
 * page's title and description. Rather than adding a server to fix that, the
 * build writes `dist/<route>/index.html` — the identical bundle, with the head
 * tags for that route already correct. The client re-applies them on
 * navigation; this is only about the very first byte.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_ROUTES } from '../src/seo/routes.ts';
import { BRAND } from '../src/brand.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const ORIGIN = BRAND.url;

const canonical = (path) => (path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`);

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
 * Both languages live at one address.
 *
 * Plauvia is not translated by URL — `/faq` serves Bulgarian or English
 * depending on the reader's choice, and there is no `/en/faq` to point at. So
 * every entry declares the same address under both `hreflang` values plus
 * `x-default`, which is the honest way to say "this page exists in these two
 * languages, here". Inventing per-language URLs that the app does not serve
 * would be worse than saying nothing: every one of them would be a 404 on the
 * first crawl.
 */
const alternates = (path) =>
  ['bg', 'en', 'x-default']
    .map(
      (hreflang) =>
        `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${canonical(path)}" />`,
    )
    .join('\n');

const urls = PUBLIC_ROUTES.filter((r) => r.indexable)
  .map(
    (r) => `  <url>
    <loc>${canonical(r.path)}</loc>
${alternates(r.path)}
    <lastmod>${lastModified(r.id)}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n');

writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`,
);

/* --------------------------------------------------- one shell per route */

const shell = readFileSync(resolve(dist, 'index.html'), 'utf8');

/** Replaces a tag's content in the shell, or appends it if it was not there. */
const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, 'i');
  if (re.test(html)) return html.replace(re, `$1${escape(value)}$2`);
  return html.replace('</head>', `    <meta ${attr}="${key}" content="${escape(value)}" />\n  </head>`);
};

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let written = 0;
for (const route of PUBLIC_ROUTES) {
  /**
   * The shell speaks Bulgarian.
   *
   * It used to carry the English titles on the theory that a crawler has not
   * told us a language yet and English is the wider audience. That was wrong
   * for this product: the page already declares `lang="bg"`, the readers are
   * Bulgarian students, and a Bulgarian search result with an English headline
   * reads as somebody else's site. The client still swaps to English the
   * moment it knows the visitor prefers it.
   */
  const lang = 'bg';
  let html = shell
    .replace(/<title>[^<]*<\/title>/i, `<title>${escape(route.title[lang])}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/i, `$1${canonical(route.path)}$2`);
  html = setMeta(html, 'name', 'description', route.description[lang]);
  html = setMeta(html, 'property', 'og:title', route.title[lang]);
  html = setMeta(html, 'property', 'og:description', route.description[lang]);
  html = setMeta(html, 'property', 'og:url', canonical(route.path));
  html = setMeta(html, 'name', 'twitter:title', route.title[lang]);
  html = setMeta(html, 'name', 'twitter:description', route.description[lang]);
  html = setMeta(html, 'name', 'robots', route.indexable ? 'index,follow' : 'noindex,follow');

  // The head says the same thing the sitemap does: one address, two
  // languages. Written after the canonical link so the two sit together.
  const hreflangs = ['bg', 'en', 'x-default']
    .map((h) => `    <link rel="alternate" hreflang="${h}" href="${canonical(route.path)}" />`)
    .join('\n');
  html = html.replace(/\n\s*<link rel="alternate" hreflang="[^"]*"[^>]*>/g, '');
  html = html.replace(/(<link rel="canonical" href="[^"]*"\s*\/?>)/i, `$1\n${hreflangs}`);

  if (route.path === '/') {
    writeFileSync(resolve(dist, 'index.html'), html);
  } else {
    const dir = resolve(dist, route.path.replace(/^\//, ''));
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), html);
  }
  written += 1;
}

console.log(`  Plauvia · sitemap.xml, robots.txt и ${written} страници с готови мета-етикети`);
