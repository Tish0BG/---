import { BRAND } from '@/brand';
import { MARK_PATH, MARK_VIEWBOX } from './mark';

/**
 * Every form the Plauvia logo is allowed to take, in one file.
 *
 * The geometry itself lives in `mark.ts` — shared with the icon generator, so
 * a favicon can never disagree with the sidebar. What is here is the set of
 * lockups: the bare mark, the mark on its tile, the wordmark, and the two
 * together. Anything that needs the logo takes one of these rather than
 * pasting the path again, which is the only way a mark stays one mark.
 */

/**
 * How the logo is coloured. `brand` is the default; `mono` inherits whatever
 * colour it is placed in (print, watermarks, a single-colour e-mail header);
 * `light` is for dark backgrounds and `dark` for light ones.
 */
export type LogoTone = 'brand' | 'mono' | 'light' | 'dark';

const TONE_COLOR: Record<LogoTone, string | undefined> = {
  brand: 'var(--c-brand)',
  mono: undefined, // currentColor
  light: '#ffffff',
  dark: '#0e1116',
};

/**
 * The bare mark, drawn in `currentColor`.
 *
 * `title` is what turns it from decoration into an image: given one it
 * announces itself to a screen reader, without one it is hidden, because a
 * logo next to the word "Plauvia" read out twice is noise.
 */
export function PlauviaMark({
  size = 24,
  className = '',
  title,
  tone = 'mono',
  style,
}: {
  size?: number;
  className?: string;
  title?: string;
  tone?: LogoTone;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      className={className}
      style={{ color: TONE_COLOR[tone], ...style }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * The mark on its tile — app icons, the sidebar, and anywhere the brand has to
 * hold its own against a busy background.
 *
 * The tile takes `--grad-brand` rather than the raw brand colour: that
 * gradient is the one tuned so white sits on it above 4.5:1 in both themes,
 * and the mark on this tile is white.
 */
export function PlauviaTile({
  size = 32,
  className = '',
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'var(--grad-brand)',
        color: '#fff',
        boxShadow: '0 1px 2px rgb(16 24 40 / 18%), inset 0 1px 0 rgb(255 255 255 / 18%)',
      }}
    >
      <PlauviaMark size={Math.round(size * 0.64)} title={title} />
    </span>
  );
}

/**
 * The wordmark. Tight tracking and a slightly heavier weight than body text —
 * the name should read as a name, not as a heading that happens to say it.
 */
export function PlauviaWordmark({
  size = 16,
  className = '',
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`select-none font-semibold ${className}`}
      style={{ fontSize: size, letterSpacing: '-0.022em', lineHeight: 1, ...style }}
    >
      {BRAND.name}
    </span>
  );
}

/**
 * Icon plus name: the primary lockup, used wherever there is room for both.
 *
 * `tile` is the default and the one that belongs on a page; `flat` drops the
 * tile and draws the mark in the tone's colour, which is what a dark hero, a
 * printed page or a one-colour e-mail header needs.
 */
export function PlauviaLogo({
  size = 32,
  className = '',
  showName = true,
  tone = 'brand',
  variant = 'tile',
  title,
}: {
  size?: number;
  className?: string;
  showName?: boolean;
  tone?: LogoTone;
  variant?: 'tile' | 'flat';
  title?: string;
}) {
  const label = title ?? (showName ? undefined : BRAND.name);
  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      style={{ color: variant === 'flat' ? TONE_COLOR[tone] : undefined }}
    >
      {variant === 'tile' ? (
        <PlauviaTile size={size} title={label} />
      ) : (
        <PlauviaMark size={size} tone={tone} title={label} />
      )}
      {showName && <PlauviaWordmark size={Math.round(size * 0.52)} />}
    </span>
  );
}
