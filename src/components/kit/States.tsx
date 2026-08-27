import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { Button } from './Button';

/* ---------------------------------------------------------- empty state */

/**
 * An empty screen is the first thing a new account sees, so it is treated as
 * a designed screen and not as a missing one: a mark, a sentence that says
 * what this place is for, and the single action that fills it.
 */
export function EmptyState({
  icon = 'sparkles',
  title,
  body,
  action,
  secondary,
  compact,
  tone = 'var(--c-accent)',
}: {
  icon?: string;
  title: ReactNode;
  body?: ReactNode;
  action?: { label: string; onClick: () => void; icon?: string };
  secondary?: { label: string; onClick: () => void; icon?: string };
  compact?: boolean;
  tone?: string;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'}`}>
      <span
        className="relative grid place-items-center rounded-[16px]"
        style={{
          width: compact ? 46 : 60,
          height: compact ? 46 : 60,
          background: `color-mix(in srgb, ${tone} 12%, transparent)`,
          color: tone,
        }}
      >
        <span
          className="animate-breathe absolute inset-0 rounded-[16px]"
          style={{ background: `color-mix(in srgb, ${tone} 10%, transparent)` }}
          aria-hidden
        />
        <Icon name={icon} size={compact ? 21 : 26} strokeWidth={1.6} className="relative" />
      </span>

      <h3 className={`mt-4 font-semibold tracking-[-0.015em] ${compact ? 'text-[14px]' : 'text-[17px]'}`}>
        {title}
      </h3>
      {body && (
        <p className={`mt-1.5 max-w-[38ch] text-muted ${compact ? 'text-[12.5px]' : 'text-[13.5px]'} leading-relaxed`}>
          {body}
        </p>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button variant="primary" size={compact ? 'md' : 'lg'} icon={action.icon} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondary && (
            <Button variant="outline" size={compact ? 'md' : 'lg'} icon={secondary.icon} onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- error state */

/* -------------------------------------------------------------- skeleton */

export function Skeleton({
  w = '100%',
  h = 14,
  r = 8,
  className = '',
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  className?: string;
}) {
  return <span className={`skeleton block ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

/** The shape of a card while its data is still coming from IndexedDB. */
export function SkeletonCard({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`card p-4 ${className}`}>
      <Skeleton w={110} h={11} />
      <Skeleton w="60%" h={24} className="mt-3" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} w={`${90 - i * 12}%`} h={10} />
        ))}
      </div>
    </div>
  );
}
