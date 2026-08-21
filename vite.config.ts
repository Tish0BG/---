import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
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
    plugins: [react(), tailwindcss()],
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
          manualChunks: {
            pdfjs: ['pdfjs-dist'],
            pdflib: ['pdf-lib'],
            // Only fetched once an account is configured; a local-only install
            // never downloads it.
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    optimizeDeps: { include: ['pdfjs-dist'] },
  };
});
