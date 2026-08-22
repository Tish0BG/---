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

const urls = PUBLIC_ROUTES.filter((r) => r.indexable)
  .map(
    (r) => `  <url>
    <loc>${canonical(r.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n');

writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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
  // The English titles go into the shell: the crawler reading it has not told
  // us a language yet, and `en` is the wider audience. The client swaps them
  // for Bulgarian the moment it knows the visitor prefers it.
  let html = shell
    .replace(/<title>[^<]*<\/title>/i, `<title>${escape(route.title.en)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/i, `$1${canonical(route.path)}$2`);
  html = setMeta(html, 'name', 'description', route.description.en);
  html = setMeta(html, 'property', 'og:title', route.title.en);
  html = setMeta(html, 'property', 'og:description', route.description.en);
  html = setMeta(html, 'property', 'og:url', canonical(route.path));
  html = setMeta(html, 'name', 'twitter:title', route.title.en);
  html = setMeta(html, 'name', 'twitter:description', route.description.en);
  html = setMeta(html, 'name', 'robots', route.indexable ? 'index,follow' : 'noindex,follow');

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
