// Copies the runtime assets pdf.js needs (CMaps for CJK/encoded fonts, the
// standard 14 font data, and the wasm image decoders) into /public so they are
// served locally. Keeps the app fully offline — nothing is fetched from a CDN.
import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'node_modules/pdfjs-dist');
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const src = resolve(from, dir);
  if (existsSync(src)) cpSync(src, resolve(root, 'public', dir), { recursive: true });
}
