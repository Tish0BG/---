import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../Icon';
import { ProgressRing } from './Progress';

/* ------------------------------------------------------------------- card */

interface CardProps {
  children: ReactNode;
  /** Title row inside the card; omit for a bare surface. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Small control on the right of the title row — a link, a menu, a filter. */
  action?: ReactNode;
  icon?: string;
  className?: string;
  style?: CSSProperties;
  /** Removes the padding, for cards whose content manages its own. */
  flush?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  as?: 'div' | 'section' | 'article';
}

/**
 * The surface everything sits on. One border radius, one shadow, one title
 * treatment — the reason five screens look like one product.
 */
export function Card({
  children,
  title,
  subtitle,
  action,
  icon,
  className = '',
  style,
  flush,
  interactive,
  onClick,
  as: Tag = 'section',
}: CardProps) {
  return (
    <Tag
      className={`card ${interactive ? 'card-hover cursor-pointer' : ''} overflow-hidden ${className}`}
      style={style}
      onClick={onClick}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.01em]">
              {icon && <Icon name={icon} size={15} className="text-faint" />}
              <span className="truncate">{title}</span>
            </h3>
            {subtitle && <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={flush ? '' : title ? 'px-4 pb-4' : 'p-4'}>{children}</div>
    </Tag>
  );
}

/** The small "see all →" link that sits in a card's title row. */
/**
 * The quiet "see all" beside a section heading.
 *
 * The vertical padding is not decoration: at twelve pixels of text the hit
 * area came to eighteen pixels tall, under the twenty-four a touch target is
 * supposed to clear. The padding buys the height without moving the text.
 */
export function CardLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group -my-1 inline-flex min-h-[24px] cursor-pointer items-center gap-1 rounded-md px-1 py-1 text-[12px] font-medium text-muted transition-colors hover:text-accent"
    >
      {label}
      <Icon
        name="chevronRight"
        size={13}
        className="transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </button>
  );
}

/* -------------------------------------------------------------- stat card */

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Unit or qualifier, set small next to the value. */
  unit?: ReactNode;
  hint?: ReactNode;
  icon?: string;
  /** Accent for the icon chip and any bar; defaults to the brand violet. */
  tone?: string;
  /** 0..1 — draws a hairline meter under the value. */
  progress?: number | null;
  delta?: { value: number; suffix?: string } | null;
  /**
   * A ring in place of the icon square, showing the same 0–1 as `progress`.
   *
   * The dashboard's first tile used to be hand-built so it could carry one:
   * a ring, then the label, then the number — a different anatomy from the
   * three tiles beside it, which read as a row assembled from two different
   * products. A row of tiles has one shape; the ring is a variation inside
   * it, not an exception to it.
   */
  ring?: number | null;
  onClick?: () => void;
  className?: string;
}

/**
 * One number, said once, with just enough around it to be understood: what it
 * measures, how it is going, and whether it is up or down on the last period.
 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = 'var(--c-accent)',
  progress = null,
  delta = null,
  ring = null,
  onClick,
  className = '',
}: StatCardProps) {
  const up = (delta?.value ?? 0) >= 0;
  return (
    <div
      className={`card relative overflow-hidden p-4 ${onClick ? 'card-hover cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="t-label">{label}</span>
        {ring !== null ? (
          <ProgressRing value={ring} size={34} stroke={3.5} color={tone} colorTo="var(--c-brand-lift)">
            <span className="t-num text-[9.5px] font-semibold">{Math.round(ring * 100)}%</span>
          </ProgressRing>
        ) : (
          icon && (
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px]"
              style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
            >
              <Icon name={icon} size={15} strokeWidth={1.9} />
            </span>
          )
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="t-num text-[26px] font-semibold leading-none tracking-[-0.03em]">{value}</span>
        {unit && <span className="text-[12.5px] text-muted">{unit}</span>}
        {delta && (
          <span
            className="chip ml-auto"
            style={{
              background: up ? 'var(--c-success-soft)' : 'var(--c-danger-soft)',
              color: up ? 'var(--c-success)' : 'var(--c-danger)',
            }}
          >
            <Icon name={up ? 'arrowUp' : 'arrowDown'} size={11} strokeWidth={2.4} />
            {Math.abs(delta.value)}
            {delta.suffix ?? '%'}
          </span>
        )}
      </div>

      {progress !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              background: tone,
            }}
          />
        </div>
      )}

      {hint && <p className="mt-2 text-[11.5px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

/* --------------------------------------------------------------- sections */

/** The heading above a group of cards. Not a card title — a screen section. */
export function SectionHeader({
  title,
  hint,
  action,
  className = '',
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="t-h3">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
