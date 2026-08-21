/**
 * Renders every raster the brand needs from one source of truth: the mark
 * path in `src/components/brand/Logo.tsx`.
 *
 * Icons drift the moment they are drawn twice. Generating them means the
 * favicon, the Android tiles, the Apple touch icon and the social preview can
 * never disagree about what the logo looks like.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Pulled from the component so there is exactly one copy of the geometry. */
const logo = readFileSync(resolve(root, 'src/components/brand/Logo.tsx'), 'utf8');
// The component builds the path from commented fragments; join them the same
// way here so the raster can never drift from what the app renders.
const block = logo.match(/const MARK_PATH = \[([\s\S]*?)\]\.join\(''\);/)?.[1];
if (!block) throw new Error('Не намерих MARK_PATH в Logo.tsx');
const MARK = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]).join('');
if (!MARK) throw new Error('MARK_PATH е празен');

const BRAND = '#6d5ae6';
const LIFT = '#8b7bf0';

/** The mark on its tile, as an SVG string. `pad` leaves room for maskable safe area. */
const tile = (size, { radius = 0.28, pad = 0.2, flat = false } = {}) => {
  const r = Math.round(size * radius);
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round((size - inner) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${LIFT}"/><stop offset="1" stop-color="${BRAND}"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${flat ? 0 : r}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 28})">
    <path d="${MARK}" fill="#fff" fill-rule="evenodd"/>
  </g>
</svg>`;
};

/** Flat mark, no tile — for the SVG favicon, where the browser adds its own chrome. */
const bare = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${LIFT}"/><stop offset="1" stop-color="${BRAND}"/>
  </linearGradient></defs>
  <rect width="28" height="28" rx="8" fill="url(#g)"/>
  <g transform="translate(5.6 5.6) scale(0.6)"><path d="${MARK}" fill="#fff" fill-rule="evenodd"/></g>
</svg>`;

mkdirSync(resolve(root, 'public/icons'), { recursive: true });
writeFileSync(resolve(root, 'public/icon.svg'), bare());

const png = async (svg, out, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(root, out));

await png(tile(512), 'public/icons/icon-192.png', 192);
await png(tile(512), 'public/icons/icon-512.png', 512);
// Maskable icons get cropped to a circle on Android: keep the mark well inside.
await png(tile(512, { radius: 0.5, pad: 0.28 }), 'public/icons/icon-maskable.png', 512);
await png(tile(512, { radius: 0.22 }), 'public/icons/apple-touch-icon.png', 180);
await png(tile(512), 'public/favicon-32.png', 32);

/* ---------------------------------------------------------- social preview */

const OG_W = 1200;
const OG_H = 630;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#12101f"/><stop offset="1" stop-color="#0b0d12"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${LIFT}"/><stop offset="1" stop-color="${BRAND}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.18" cy="0.15" r="0.75">
      <stop offset="0" stop-color="${BRAND}" stop-opacity="0.4"/>
      <stop offset="1" stop-color="${BRAND}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#bg)"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#glow)"/>
  <g transform="translate(96 150)">
    <rect width="104" height="104" rx="29" fill="url(#mark)"/>
    <g transform="translate(20.8 20.8) scale(2.229)"><path d="${MARK}" fill="#fff" fill-rule="evenodd"/></g>
  </g>
  <text x="224" y="222" font-family="Inter, system-ui, sans-serif" font-size="58" font-weight="600"
        letter-spacing="-1.6" fill="#ffffff">Plauvia</text>
  <text x="96" y="360" font-family="Inter, system-ui, sans-serif" font-size="72" font-weight="600"
        letter-spacing="-2.4" fill="#ffffff">From plan to progress.</text>
  <text x="96" y="428" font-family="Inter, system-ui, sans-serif" font-size="30" font-weight="400"
        fill="#9aa1b2">Plan, study, focus and track — in one place.</text>
  <g transform="translate(96 490)">
    ${['Plan', 'Focus', 'Track', 'Improve']
      .map(
        (label, i) => `<g transform="translate(${i * 176} 0)">
      <rect width="152" height="44" rx="22" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.12"/>
      <text x="76" y="29" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="19"
            font-weight="500" fill="#c9cede">${label}</text></g>`,
      )
      .join('')}
  </g>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(resolve(root, 'public/og.png'));

console.log('  Plauvia · иконите и социалната картинка са пресъздадени');
