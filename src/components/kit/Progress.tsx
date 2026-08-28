import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/* --------------------------------------------------------------- ring */

interface RingProps {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  /** Second stop; when set the ring is drawn with a gradient. */
  colorTo?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
  /** Leaves the last few degrees open, so the ring reads as a gauge. */
  gap?: number;
}

/**
 * The progress ring used by the focus timer, the level badge and every goal.
 *
 * It animates from where it was to where it is — a ring that snaps to its new
 * value looks like a re-render, one that sweeps looks like progress.
 */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = 'var(--c-accent)',
  colorTo,
  track = 'var(--c-surface-3)',
  children,
  className = '',
  gap = 0,
}: RingProps) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const span = 1 - gap;
  const clamped = Math.min(1, Math.max(0, value));

  // Animate on value change rather than on mount only.
  const [shown, setShown] = useState(clamped);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(raf.current);
  }, [clamped]);

  const dash = circumference * span * shown;
  const rest = circumference - dash;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {colorTo && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={colorTo} />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeDasharray={`${circumference * span} ${circumference}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colorTo ? `url(#${id})` : color}
          strokeWidth={stroke}
          /* A round cap on a zero-length dash draws a dot, so an empty ring
             was wearing a bead at twelve o'clock. Below half a pixel there is
             nothing to cap. */
          strokeLinecap={dash > 0.5 ? 'round' : 'butt'}
          strokeDasharray={`${dash} ${rest}`}
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 grid place-items-center text-center leading-none">{children}</div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- bar */

export function ProgressBar({
  value,
  color = 'var(--c-accent)',
  height = 8,
  className = '',
  label,
  showValue,
}: {
  value: number;
  color?: string;
  height?: number;
  className?: string;
  label?: ReactNode;
  showValue?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && <span className="text-[12px] text-muted">{label}</span>}
          {showValue && <span className="t-num text-[12px] font-medium">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full"
        style={{ height, background: 'var(--c-surface-3)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Segmented progress: ten cells, filled left to right.
 *
 * Used where the count matters as much as the ratio — 18 of 22 chapters reads
 * better as cells than as a smooth bar, because you can see the units.
 */
export function ProgressCells({
  value,
  cells = 10,
  color = 'var(--c-accent)',
  className = '',
}: {
  value: number;
  cells?: number;
  color?: string;
  className?: string;
}) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * cells);
  return (
    <div className={`flex gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{
            background: i < filled ? color : 'var(--c-surface-3)',
            transition: `background-color 0.3s ${i * 0.03}s var(--ease)`,
          }}
        />
      ))}
    </div>
  );
}
