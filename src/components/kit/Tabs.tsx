import { useRef, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { CountBadge } from './Badge';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: string;
  count?: number;
}

/**
 * Underlined tabs for switching what a screen is showing (Today / Upcoming /
 * Done). Arrow keys move between them, which is what makes them tabs rather
 * than a row of buttons.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className = '',
  size = 'md',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onKey = (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = items.findIndex((t) => t.id === value);
    const next = items[(i + dir + items.length) % items.length];
    onChange(next.id);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[items.indexOf(next)]?.focus();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      onKeyDown={onKey}
      className={`scroll-none flex items-center gap-1 overflow-x-auto border-b border-line ${className}`}
    >
      {items.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`relative flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 font-medium transition-colors ${
              size === 'sm' ? 'h-8 text-[12.5px]' : 'h-10 text-[13.5px]'
            } ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
          >
            {tab.icon && <Icon name={tab.icon} size={14.5} />}
            {tab.label}
            {!!tab.count && (
              <span
                className="t-num rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                style={{
                  background: active ? 'var(--c-accent-soft)' : 'var(--c-surface-3)',
                  color: active ? 'var(--c-accent)' : 'var(--c-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
            {active && (
              <span
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                style={{ background: 'var(--c-accent)' }}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact pill switch — calendar month/week/day, chart ranges. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className = '',
  ariaLabel,
}: {
  items: { id: T; label: ReactNode; icon?: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={`segmented ${className}`} role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === value}
          onClick={() => onChange(item.id)}
          className="flex items-center justify-center gap-1.5"
        >
          {item.icon && <Icon name={item.icon} size={14} />}
          {item.label}
          {item.count !== undefined && item.count > 0 && <CountBadge count={item.count} />}
        </button>
      ))}
    </div>
  );
}
