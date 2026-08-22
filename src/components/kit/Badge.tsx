import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'aurora' | 'ember';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--c-surface-3)', fg: 'var(--c-muted)' },
  brand: { bg: 'var(--c-accent-soft)', fg: 'var(--c-accent)' },
  success: { bg: 'var(--c-success-soft)', fg: 'var(--c-success)' },
  warn: { bg: 'var(--c-warn-soft)', fg: 'var(--c-warn)' },
  danger: { bg: 'var(--c-danger-soft)', fg: 'var(--c-danger)' },
  aurora: { bg: 'color-mix(in srgb, var(--c-aurora) 14%, transparent)', fg: 'var(--c-aurora)' },
  ember: { bg: 'color-mix(in srgb, var(--c-ember) 16%, transparent)', fg: 'var(--c-ember)' },
};

export function Badge({
  children,
  tone = 'neutral',
  icon,
  color,
  className = '',
  solid,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: string;
  /** Overrides the tone with an arbitrary colour — subject tints. */
  color?: string;
  className?: string;
  solid?: boolean;
}) {
  const t = TONES[tone];
  const bg = color ? `color-mix(in srgb, ${color} 14%, transparent)` : t.bg;
  const fg = color ?? t.fg;
  return (
    <span
      className={`chip ${className}`}
      style={solid ? { background: fg, color: '#fff' } : { background: bg, color: fg }}
    >
      {icon && <Icon name={icon} size={11} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

/** A count that sits on a navigation item or a bell. */
export function CountBadge({ count, tone = 'brand' }: { count: number; tone?: BadgeTone }) {
  if (!count) return null;
  const t = TONES[tone];
  return (
    <span
      className="t-num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold"
      style={{ background: tone === 'brand' ? 'var(--c-accent)' : t.fg, color: '#fff' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/* --------------------------------------------------------------- avatar */

export function Avatar({
  emoji,
  name,
  color = 'var(--c-brand)',
  size = 32,
  ring,
  className = '',
}: {
  emoji?: string;
  name?: string;
  color?: string;
  size?: number;
  /** Draws the level ring around the avatar. */
  ring?: number;
  className?: string;
}) {
  const initials = (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const inner = (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: emoji ? size * 0.52 : size * 0.38,
        background: emoji ? `color-mix(in srgb, ${color} 16%, transparent)` : color,
        color: emoji ? undefined : '#fff',
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
      aria-hidden
    >
      {emoji || initials || '·'}
    </span>
  );
  if (ring === undefined) return inner;
  const box = size + 8;
  const r = (box - 3) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: box, height: box }}>
      <svg width={box} height={box} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={2.5} />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke="var(--c-brand)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, Math.max(0, ring))} ${c}`}
          style={{ transition: 'stroke-dasharray 0.6s var(--ease-out)' }}
        />
      </svg>
      {inner}
    </span>
  );
}

/* -------------------------------------------------------------- tooltip */

/**
 * Delayed, portalled tooltip. The old one was a CSS `::after` inside the
 * button, which meant it was clipped by every toolbar it appeared in.
 */
export function Tooltip({
  label,
  children,
  side = 'bottom',
  delay = 350,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    timer.current = setTimeout(() => {
      const a = ref.current?.getBoundingClientRect();
      if (!a) return;
      const offset = 8;
      const p =
        side === 'top'
          ? { top: a.top - offset, left: a.left + a.width / 2 }
          : side === 'left'
            ? { top: a.top + a.height / 2, left: a.left - offset }
            : side === 'right'
              ? { top: a.top + a.height / 2, left: a.right + offset }
              : { top: a.bottom + offset, left: a.left + a.width / 2 };
      setPos(p);
    }, delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setPos(null);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const transform =
    side === 'top'
      ? 'translate(-50%, -100%)'
      : side === 'left'
        ? 'translate(-100%, -50%)'
        : side === 'right'
          ? 'translate(0, -50%)'
          : 'translate(-50%, 0)';

  return (
    <>
      <span
        ref={ref}
        className="inline-flex"
        onPointerEnter={show}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className="animate-in pointer-events-none fixed z-[90] whitespace-nowrap rounded-lg px-2 py-1 text-[11.5px] font-medium shadow-[var(--shadow-float)]"
            style={{
              top: pos.top,
              left: pos.left,
              transform,
              background: 'var(--c-text)',
              color: 'var(--c-bg)',
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
