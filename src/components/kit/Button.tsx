import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '../Icon';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'soft' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: '',
  soft: 'btn-soft',
  danger: 'btn-danger',
};

const SIZE: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon name from the bundled set, drawn before the label. */
  icon?: string;
  /** Icon drawn after the label — chevrons, external links. */
  iconEnd?: string;
  /** Swaps the icon for a spinner and blocks the click. */
  busy?: boolean;
  block?: boolean;
  children?: ReactNode;
}

/**
 * The one button in the product.
 *
 * Every screen used to hand-roll `className="btn btn-primary h-9"`, which is
 * how five slightly different buttons end up on one page. Variants and sizes
 * live here; a screen only says which of them it means.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', icon, iconEnd, busy, block, children, className = '', disabled, ...rest },
  ref,
) {
  const iconSize = size === 'lg' ? 17 : size === 'sm' ? 14 : 15;
  return (
    <button
      ref={ref}
      className={`btn ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {busy ? (
        <Icon name="refresh" size={iconSize} className="animate-spin" />
      ) : (
        icon && <Icon name={icon} size={iconSize} strokeWidth={1.9} />
      )}
      {children}
      {iconEnd && !busy && <Icon name={iconEnd} size={iconSize} strokeWidth={1.9} />}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  /** Required: an icon with no name is invisible to a screen reader. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  tone?: 'default' | 'danger';
  iconSize?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', active, tone = 'default', iconSize, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      className={`icon-btn ${size === 'lg' ? 'icon-btn-lg' : ''} ${size === 'sm' ? 'h-7 w-7' : ''} ${
        active ? 'btn-ghost-active' : ''
      } ${className}`}
      style={tone === 'danger' ? { color: 'var(--c-danger)' } : undefined}
      {...rest}
    >
      <Icon name={icon} size={iconSize ?? (size === 'lg' ? 19 : size === 'sm' ? 15 : 17)} />
    </button>
  );
});
