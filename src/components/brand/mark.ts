/**
 * The Plauvia mark, as pure geometry.
 *
 * A capital P wearing a mortarboard — not a cap parked above a letter, but one
 * silhouette: the board's underside is the letter's shoulder, and the brim
 * overhangs the bowl the way a real one does. Drawn as three subpaths filled
 * with the nonzero rule, so the board and the letter union into a single mass
 * while the counter, wound the other way, punches clean through. A counter
 * faked with a background-coloured disc stops being a hole the moment the mark
 * sits on a photo, a gradient or a dark tile.
 *
 * There is deliberately no tassel. Every version that had one collapsed into a
 * downward arrow at sixteen pixels, which is where a favicon actually lives.
 *
 * Both the React component and `scripts/make-brand-assets.mjs` import this
 * file, so the favicon, the Android tiles, the Apple touch icon and the social
 * preview cannot drift away from what the app renders.
 */

export const MARK_SIZE = 32;
export const MARK_VIEWBOX = `0 0 ${MARK_SIZE} ${MARK_SIZE}`;

export const MARK_PATH = [
  // the board: a flattened rhombus, brim wider than the letter on both sides
  'M2.6 9 16 4.4 29.4 9 16 12.9Z',
  // the letter, tucked under it
  'M8.6 9.2H19.8a7.9 7.9 0 0 1 0 15.8H14v5H8.6Z',
  // the counter, wound the other way so nonzero punches it through
  'M14 14.6v5h5.8a2.5 2.5 0 0 0 0-5Z',
].join('');

/**
 * The brand blue.
 *
 * Deep enough that white sits on it at 6.2:1 — the primary button carries body
 * text, and an accent that only passes as a decoration is an accent that has
 * to be worked around on every screen it appears on.
 */
export const BRAND_BLUE = '#1857d6';
export const BRAND_BLUE_LIFT = '#2a66e2';
export const BRAND_BLUE_DEEP = '#1245b4';
