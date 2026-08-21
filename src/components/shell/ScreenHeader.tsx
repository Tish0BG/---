import type { ReactNode } from 'react';

/**
 * The title block every screen wears.
 *
 * Before this there were four different treatments of the same thing — 27 px
 * on the dashboard, 22 px on three screens, 15 px on the flashcards, and a
 * fifth in the shell's own bar. Nothing else says "assembled from parts"
 * quite as loudly as a heading that changes size depending on which tab you
 * are looking at.
 */
export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  size = 'page',
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** small line above the title — a breadcrumb, a path, a count */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** `page` for ordinary screens, `hero` for the dashboard's greeting */
  size?: 'page' | 'hero';
  className?: string;
}) {
  return (
    <header className={`mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[12px] text-muted">{eyebrow}</div>}
        <h1
          className="font-semibold leading-[1.12]"
          style={
            size === 'hero'
              ? { fontSize: 'var(--text-title)', letterSpacing: 'var(--track-title)' }
              : { fontSize: 'var(--text-section)', letterSpacing: 'var(--track-section)' }
          }
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[13px] leading-snug text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
