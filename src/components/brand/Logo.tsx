import { BRAND } from '@/brand';

/**
 * The Plauvia mark: a geometric P whose counter is punched clean through, so
 * the shape survives on any background and at any size.
 *
 * It is drawn as one even-odd path rather than a stem plus a circle, because
 * a counter faked with a background-coloured disc stops being a hole the
 * moment the mark sits on a photo, a gradient or a dark tile.
 *
 * The stem drops below the bowl and is cut on a rising diagonal — a quiet
 * upward tick that reads as progress at large sizes and simply as a stem at
 * sixteen pixels, where every other detail would turn to mud.
 */
const MARK_PATH = [
  // outer: stem, bowl, then a descender cut on a rising diagonal
  'M7.4 3.2h8.3a7.3 7.3 0 0 1 0 14.6h-4.4v4.9l-3.9 2.9V3.2Z',
  // counter, punched through by the even-odd rule
  'M11.3 7v7h4.4a3.5 3.5 0 0 0 0-7h-4.4Z',
].join('');

export function PlauviaMark({
  size = 24,
  className = '',
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}

/**
 * The mark on its tile — the form used for app icons, the sidebar and
 * anywhere the brand needs to hold its own against a busy background.
 */
export function PlauviaTile({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(145deg, var(--c-brand-lift), var(--c-brand))',
        color: '#fff',
        boxShadow: '0 1px 2px rgb(16 24 40 / 18%), inset 0 1px 0 rgb(255 255 255 / 18%)',
      }}
    >
      <PlauviaMark size={Math.round(size * 0.6)} />
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
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`select-none font-semibold ${className}`}
      style={{ fontSize: size, letterSpacing: '-0.022em', lineHeight: 1 }}
    >
      {BRAND.name}
    </span>
  );
}

/** Icon plus name: the primary lockup, used wherever there is room for both. */
export function PlauviaLogo({
  size = 32,
  className = '',
  showName = true,
}: {
  size?: number;
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <PlauviaTile size={size} />
      {showName && <PlauviaWordmark size={Math.round(size * 0.5)} />}
    </span>
  );
}
