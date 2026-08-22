/**
 * Renders every raster the brand needs from one source of truth:
 * `src/components/brand/mark.ts`, the same module the React logo imports.
 *
 * Icons drift the moment they are drawn twice. Importing the geometry rather
 * than re-typing it means the favicon, the Android tiles, the Apple touch icon
 * and the social preview can never disagree about what the logo looks like.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { BRAND_BLUE, BRAND_BLUE_DEEP, BRAND_BLUE_LIFT, MARK_PATH, MARK_SIZE } from '../src/components/brand/mark.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The tile gradient, matching --grad-brand in the light theme. */
const gradient = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BRAND_BLUE_LIFT}"/>
    <stop offset="0.48" stop-color="${BRAND_BLUE}"/>
    <stop offset="1" stop-color="${BRAND_BLUE_DEEP}"/>
  </linearGradient>`;

/** The mark on its tile, as an SVG string. `pad` leaves room for maskable safe area. */
const tile = (size, { radius = 0.28, pad = 0.18, flat = false } = {}) => {
  const r = Math.round(size * radius);
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round((size - inner) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${gradient('g')}</defs>
  <rect width="${size}" height="${size}" rx="${flat ? 0 : r}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / MARK_SIZE})">
    <path d="${MARK_PATH}" fill="#fff"/>
  </g>
</svg>`;
};

/** The SVG favicon: same tile, drawn small, where the browser adds its own chrome. */
const bare = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>${gradient('g')}</defs>
  <rect width="32" height="32" rx="9" fill="url(#g)"/>
  <g transform="translate(5.1 5.1) scale(0.68)"><path d="${MARK_PATH}" fill="#fff"/></g>
</svg>`;

mkdirSync(resolve(root, 'public/icons'), { recursive: true });
writeFileSync(resolve(root, 'public/icon.svg'), bare());

/** A single-colour mark, for print, e-mail headers and anywhere colour is not available. */
writeFileSync(
  resolve(root, 'public/icons/mark-mono.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}" width="${MARK_SIZE}" height="${MARK_SIZE}">
  <path d="${MARK_PATH}" fill="currentColor"/>
</svg>`,
);

const png = async (svg, out, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(root, out));

await png(tile(512), 'public/icons/icon-192.png', 192);
await png(tile(512), 'public/icons/icon-512.png', 512);
// Maskable icons get cropped to a circle on Android: keep the mark well inside.
await png(tile(512, { radius: 0.5, pad: 0.26 }), 'public/icons/icon-maskable.png', 512);
await png(tile(512, { radius: 0.22 }), 'public/icons/apple-touch-icon.png', 180);
await png(tile(512), 'public/favicon-32.png', 32);

/* ---------------------------------------------------------- social preview */

/**
 * The card someone sees before they see the site. It carries the mark, the
 * name, the promise and the four verbs the product is built around — and not
 * one number about users, awards or partnerships, because there are none.
 */
const OG_W = 1200;
const OG_H = 630;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d1424"/><stop offset="1" stop-color="#080a0f"/>
    </linearGradient>
    ${gradient('mark')}
    <radialGradient id="glow" cx="0.16" cy="0.12" r="0.8">
      <stop offset="0" stop-color="${BRAND_BLUE}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${BRAND_BLUE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#bg)"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#glow)"/>
  <g transform="translate(96 148)">
    <rect width="104" height="104" rx="29" fill="url(#mark)"/>
    <g transform="translate(18.7 18.7) scale(2.083)"><path d="${MARK_PATH}" fill="#fff"/></g>
  </g>
  <text x="228" y="219" font-family="Inter, system-ui, sans-serif" font-size="58" font-weight="600"
        letter-spacing="-1.6" fill="#ffffff">Plauvia</text>
  <text x="96" y="362" font-family="Inter, system-ui, sans-serif" font-size="72" font-weight="600"
        letter-spacing="-2.4" fill="#ffffff">From plan to progress.</text>
  <text x="96" y="430" font-family="Inter, system-ui, sans-serif" font-size="30" font-weight="400"
        fill="#98a2b8">Textbooks, flashcards and focus — in one place, offline.</text>
  <g transform="translate(96 492)">
    ${['Plan', 'Study', 'Focus', 'Track']
      .map(
        (label, i) => `<g transform="translate(${i * 176} 0)">
      <rect width="152" height="44" rx="22" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.13"/>
      <text x="76" y="29" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="19"
            font-weight="500" fill="#c3cbdc">${label}</text></g>`,
      )
      .join('')}
  </g>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(resolve(root, 'public/og.png'));

console.log('  Plauvia · иконите и социалната картинка са пресъздадени');
