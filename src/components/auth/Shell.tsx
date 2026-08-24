import type { ReactNode } from 'react';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { useT, L } from '@/i18n';

/**
 * ─────────────────────────────────────────────────────── the account rooms ──
 *
 * Four screens stand between a stranger and the app — signing in, the code
 * from the inbox, the second factor, the new password after a reset — and
 * before this they were four hand-built layouts: two of them centred, one
 * split down the middle, each with its own idea of how big a heading is.
 *
 * They are one room now. A column down the middle, the mark above it, a card
 * with a hairline. Whatever a person is doing here, it looks like the same
 * place, which is most of what "trustworthy" means on a page that is asking
 * for a password.
 */

export function AuthLayout({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
      {onClose && (
        <button
          className="icon-btn absolute right-4 top-4 z-10"
          onClick={onClose}
          aria-label={t(L('Затвори', 'Close'))}
        >
          <Icon name="x" size={18} />
        </button>
      )}

      <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col justify-center px-5 py-12">
        <header className="mb-7 flex items-center justify-center gap-2.5">
          <PlauviaTile size={30} />
          <PlauviaWordmark size={17} />
        </header>
        {children}
      </div>
    </div>
  );
}

/**
 * The panel the forms sit in: white on the page grey, one hairline, no
 * shadow — the same card the rest of the product is built from, so the door
 * does not look like it was designed by somebody else.
 */
export function AuthPanel({ children }: { children: ReactNode }) {
  return <div className="card animate-in p-6 sm:p-7">{children}</div>;
}

export function AuthTitle({ title, hint, icon }: { title: string; hint?: ReactNode; icon?: string }) {
  return (
    <div className="mb-5">
      {icon && (
        <span
          className="mb-4 grid h-10 w-10 place-items-center rounded-[10px]"
          style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
        >
          <Icon name={icon} size={19} />
        </span>
      )}
      <h1 className="t-h2">{title}</h1>
      {hint && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

/**
 * The one line of feedback every one of these screens needs somewhere: the
 * refusal, or the "we have sent it" that follows a form with no visible
 * result. Same shape either way — only the colour and the icon change.
 */
export function AuthNote({ text, tone = 'danger' }: { text: string; tone?: 'danger' | 'ok' }) {
  const color = tone === 'danger' ? 'var(--c-danger)' : 'var(--c-success)';
  return (
    <p
      className="flex items-start gap-1.5 rounded-[8px] px-2.5 py-2 text-[12.5px] leading-snug"
      style={{ background: `color-mix(in srgb, ${color} 9%, transparent)`, color }}
    >
      <Icon name={tone === 'danger' ? 'alert' : 'checkCircle'} size={13} className="mt-px shrink-0" />
      {text}
    </p>
  );
}
