import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite only hands the browser variables prefixed with `VITE_`. Supabase's own
 * "connect" panel gives you `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`, and
 * pasting those into `.env` silently does nothing — the app starts up with no
 * configuration at all and says it is local-only.
 *
 * So both spellings are accepted here and normalised into the two the app
 * reads. The secret key is deliberately NOT among them: this is a browser
 * application, anything it is given is readable by anyone who opens it.
 */
const pkg = createRequire(import.meta.url)('./package.json') as { version: string };

/**
 * Sends production's security headers in development too.
 *
 * A Content-Security-Policy that is only ever exercised on the live site is a
 * policy that gets discovered by users. Reading it back out of `vercel.json`
 * rather than restating it means the two cannot drift, and a violation shows
 * up in the console on the machine where the code was just written.
 */
function securityHeaders(): Plugin {
  const file = resolve(process.cwd(), 'vercel.json');
  const config = JSON.parse(readFileSync(file, 'utf8')) as {
    headers?: { source: string; headers: { key: string; value: string }[] }[];
  };
  const global = config.headers?.find((h) => h.source === '/(.*)')?.headers ?? [];
  // HSTS on http://localhost would pin the dev machine to a protocol the dev
  // server does not speak.
  const sendable = global
    .filter((h) => h.key !== 'Strict-Transport-Security')
    .map((h) =>
      h.key === 'Content-Security-Policy'
        ? {
            ...h,
            // The one relaxation: React Fast Refresh injects its preamble as an
            // inline module script, which production has no equivalent of. Every
            // other directive — connect-src, img-src, worker-src, style-src — is
            // the production one, and those are the ones that actually break an
            // app that renders PDFs and talks to Supabase.
            value: h.value.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
          }
        : h,
    );

  return {
    name: 'plauvia-security-headers',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const { key, value } of sendable) res.setHeader(key, value);
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const key =
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    '';

  // Shipping a build with no backend at all is the classic way to end up with
  // a live site that asks its visitors to connect a database. Say which of the
  // two routes is carrying it, while it can still be fixed.
  if (mode === 'production') {
    let fileUrl = '';
    const file = resolve(process.cwd(), 'public/cloud.json');
    if (existsSync(file)) {
      try {
        fileUrl = (JSON.parse(readFileSync(file, 'utf8')) as { url?: string }).url ?? '';
      } catch {
        fileUrl = '';
      }
    }
    const line =
      url && key
        ? `вграден в кода → ${url}`
        : fileUrl
          ? `от public/cloud.json → ${fileUrl}`
          : 'НЯМА — сайтът ще работи само локално, без вход';
    console.log(`\n  Plauvia · облак: ${line}\n`);
  }

  return {
    plugins: [react(), tailwindcss(), securityHeaders()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(key),
      // Shown in settings, and the first thing worth knowing in a bug report.
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    server: { port: 5180, host: true },
    // pdf.js ships a large worker; keep it out of the main chunk.
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          /**
           * Three heavy dependencies, each fetched only when it is actually
           * needed: the PDF renderer when a document opens, pdf-lib when
           * something is exported, Supabase once an account is configured.
           *
           * Written as a function rather than a map so Rollup's shared CommonJS
           * helpers get a chunk of their own — inside `pdflib` they dragged all
           * 428 KB of it into the first load for the sake of one function.
           */
          manualChunks(id: string) {
            if (id.includes('commonjsHelpers') || id.includes('commonjs-dynamic-modules')) return 'vendor';
            if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs';
            if (id.includes('node_modules/pdf-lib') || id.includes('node_modules/@pdf-lib')) return 'pdflib';
            if (id.includes('node_modules/@supabase')) return 'supabase';
            return undefined;
          },
        },
      },
    },
    optimizeDeps: { include: ['pdfjs-dist'] },
  };
});
