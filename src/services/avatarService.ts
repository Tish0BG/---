import { L, tr } from '@/i18n';

/**
 * ────────────────────────────────────────────────────────────── the face ──
 *
 * Turning whatever came off a phone into something a profile record can carry.
 *
 * A photo picked on a modern phone is four thousand pixels wide and several
 * megabytes; the largest place Plauvia ever draws one is 84 px. Storing the
 * original would mean a profile record that cannot sync, so the file is
 * cropped square, scaled to 256 and re-encoded before it is ever kept.
 *
 * It stays a data URL rather than becoming a file in the storage bucket. The
 * profile already travels between devices as one record, and a face carried
 * inside it arrives with the name — the alternative is a second round trip
 * and a signed URL for every avatar on the screen, to save perhaps 20 KB.
 */

/** What the avatar is drawn at, everywhere, times two for retina. */
const SIDE = 256;

/** Above this the file is refused before it is decoded, not after. */
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

export interface AvatarResult {
  /** the square data URL, ready to go straight into the profile */
  dataUrl: string;
  /** roughly what it will cost to store, for the caller that wants to say */
  bytes: number;
}

/**
 * Crops to a centred square, scales to 256 and encodes.
 *
 * WebP first because it is about half the size of JPEG at this quality, with
 * a JPEG fallback for the browsers that will not encode it — `toDataURL`
 * silently hands back a PNG when it does not know the type asked for, and a
 * 256 px PNG photograph is roughly ten times the budget, so the result is
 * checked rather than trusted.
 */
export async function makeAvatar(file: Blob): Promise<AvatarResult> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      tr(L('Снимката е твърде голяма. До 12 MB.', 'That image is too large. Up to 12 MB.')),
    );
  }

  const bitmap = await decode(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = SIDE;
    canvas.height = SIDE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(tr(L('Браузърът не може да обработи снимката.', 'The browser could not process the image.')));

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // The centre of a portrait is the face far more often than any corner is.
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      SIDE,
      SIDE,
    );

    const webp = canvas.toDataURL('image/webp', 0.82);
    const dataUrl = webp.startsWith('data:image/webp')
      ? webp
      : canvas.toDataURL('image/jpeg', 0.85);
    return { dataUrl, bytes: Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75) };
  } finally {
    bitmap.close?.();
  }
}

/**
 * `createImageBitmap` handles every format the browser knows and does the
 * EXIF rotation that an `<img>` would leave to CSS — a portrait taken sideways
 * is otherwise stored sideways forever.
 */
async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(
      tr(L('Това не изглежда като снимка, която можем да отворим.', 'That does not look like an image we can open.')),
    );
  }
}

/**
 * ─────────────────────────────────────────────────────── the letter avatar ──
 *
 * What somebody without a photo gets, and it has to be good enough that not
 * uploading one never looks like the unfinished option.
 *
 * The colour is derived from the handle rather than picked at random, so a
 * person keeps the same one on every device and in every session, and two
 * people in the same class do not both get blue. The palette is the product's
 * own subject colours, so an avatar sits inside the design system instead of
 * next to it.
 */
export const AVATAR_COLORS = [
  '#1857d6',
  '#0a9b8f',
  '#6539d6',
  '#c22a63',
  '#0d6ad1',
  '#04703f',
  '#9a5b00',
  '#00697f',
] as const;

/** A small, stable hash. Same string in, same colour out, on every device. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function avatarColor(seed: string): string {
  const key = seed.trim().toLowerCase();
  if (!key) return AVATAR_COLORS[0];
  return AVATAR_COLORS[hash(key) % AVATAR_COLORS.length];
}

/**
 * The letter itself.
 *
 * The first character of whatever the person is called, upper-cased — which
 * for Bulgarian means a Cyrillic capital, and that is correct: this is their
 * initial, not a transliteration of it. Falls back through handle, name and
 * e-mail so that there is always something, and only ever gives up on an
 * account that has told us nothing at all.
 */
export function avatarInitial(...candidates: (string | null | undefined)[]): string {
  for (const value of candidates) {
    const trimmed = (value ?? '').trim().replace(/^@+/, '');
    // Codepoint-wise, so an initial that happens to be an emoji or a letter
    // outside the basic plane is not sliced in half.
    const first = [...trimmed][0];
    if (first) return first.toLocaleUpperCase();
  }
  return '·';
}
