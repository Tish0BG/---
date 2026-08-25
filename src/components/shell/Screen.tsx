import type { ReactNode } from 'react';

interface ScreenProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  width?: 'default' | 'wide' | 'narrow' | 'full';
  className?: string;
}

/**
 * A screen that may find itself inside another one.
 *
 * Goals and exams used to be top-level destinations and are now two views of
 * the plan. Rather than fork each of them into a screen and a panel — two
 * copies of the same list, drifting apart by the second release — they take
 * an `embedded` flag: the frame goes away, the content does not.
 */
export function Section({ embedded, ...props }: ScreenProps & { embedded?: boolean }) {
  if (!embedded) return <Screen {...props} />;
  return (
    <>
      {props.toolbar && <div className="mb-4">{props.toolbar}</div>}
      {props.children}
    </>
  );
}

/**
 * The page frame: one max width, one rhythm, one title treatment.
 *
 * Before this each screen chose its own padding and heading size, which is the
 * quiet way an app stops feeling like one product. Every screen now opens the
 * same way — title, one line of context, its actions on the right — and the
 * content starts at the same place on all of them.
 */
export function Screen({
  title,
  subtitle,
  actions,
  toolbar,
  children,
  width = 'default',
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Filters and tabs; sits under the title, above the content. */
  toolbar?: ReactNode;
  children: ReactNode;
  width?: 'default' | 'wide' | 'narrow' | 'full';
  className?: string;
}) {
  const max =
    width === 'wide' ? 1400 : width === 'narrow' ? 760 : width === 'full' ? undefined : 1220;

  return (
    <div className={`mx-auto w-full px-4 py-5 sm:px-7 sm:py-7 ${className}`} style={{ maxWidth: max }}>
      {(title || actions) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
          <div className="min-w-0">
            {title && <h1 className="t-h1">{title}</h1>}
            {subtitle && <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {toolbar && <div className="mb-4">{toolbar}</div>}
      {children}
    </div>
  );
}
