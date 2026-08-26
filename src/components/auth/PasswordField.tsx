import { useMemo, useState } from 'react';
import { L, useT } from '@/i18n';
import { Icon } from '../Icon';

/**
 * The password box, with an honest strength read-out.
 *
 * The meter measures the two things that actually matter — how long it is and
 * how much variety it has — and says so in words rather than colouring a bar
 * and leaving the person to guess. It never blocks: the only hard rule is the
 * eight-character minimum the server also enforces, so the form cannot tell
 * someone their password is fine and then have the server disagree.
 */

/** The handful that turn up at the top of every breach list. */
const OBVIOUS = new Set([
  'password', 'password1', 'parola', 'parola123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'football', 'baseball',
  'plauvia', 'plauvia123', 'letmein1', 'abc12345', 'sunshine', 'princess', '11111111',
]);

export type Strength = 0 | 1 | 2 | 3;

export function scorePassword(value: string): Strength {
  if (!value) return 0;
  if (OBVIOUS.has(value.toLowerCase())) return 0;
  const classes =
    Number(/[a-z]/.test(value)) +
    Number(/[A-Z]/.test(value)) +
    Number(/[0-9]/.test(value)) +
    Number(/[^A-Za-z0-9]/.test(value));
  // Length does more work than variety, so it is weighted like it.
  if (value.length >= 16 || (value.length >= 12 && classes >= 3)) return 3;
  if (value.length >= 12 || (value.length >= 9 && classes >= 3)) return 2;
  if (value.length >= 8) return 1;
  return 0;
}

const LABELS = [
  L('Твърде проста', 'Too easy to guess'),
  L('Става', 'Workable'),
  L('Добра', 'Good'),
  L('Много добра', 'Strong'),
];

const TONES = ['var(--c-danger)', 'var(--c-warn)', 'var(--c-success)', 'var(--c-success)'];

export function PasswordField({
  value,
  onChange,
  label,
  autoComplete,
  placeholder,
  showMeter = false,
  autoFocus,
  onEnter,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  showMeter?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
  id?: string;
}) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const score = useMemo(() => scorePassword(value), [value]);
  const meterId = id ? `${id}-strength` : undefined;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          className="field field-lg pr-11"
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-describedby={showMeter ? meterId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        />
        <button
          type="button"
          className="icon-btn absolute right-1 top-1/2 -translate-y-1/2"
          aria-pressed={shown}
          aria-label={t(shown ? L('Скрий паролата', 'Hide password') : L('Покажи паролата', 'Show password'))}
          onClick={() => setShown(!shown)}
        >
          <Icon name={shown ? 'eyeOff' : 'eye'} size={16} />
        </button>
      </div>

      {showMeter && (
        <div id={meterId} className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{ background: value && i <= score ? TONES[score] : 'var(--c-line)' }}
              />
            ))}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px]">
            {value.length > 0 && value.length < 8 ? (
              <>
                {/* Never colour alone: the icon says "not yet" without needing red. */}
                <Icon name="alert" size={12} style={{ color: 'var(--c-danger)' }} />
                <span style={{ color: 'var(--c-danger)' }}>
                  {t(L('Поне 8 знака.', 'At least 8 characters.'))}
                </span>
              </>
            ) : value ? (
              <>
                <Icon
                  name={score === 0 ? 'alert' : 'check'}
                  size={12}
                  strokeWidth={2.6}
                  style={{ color: TONES[score] }}
                />
                <span className="whitespace-nowrap" style={{ color: TONES[score] }}>
                  {t(LABELS[score])}
                </span>
                {score < 2 && (
                  <span className="text-faint">
                    {t(L('· по-дългата парола помага повече от знаците', '· length helps more than symbols'))}
                  </span>
                )}
              </>
            ) : (
              <span className="text-faint">{t(L('Поне 8 знака.', 'At least 8 characters.'))}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * "Continue with Google" — the wordmark colours, because a monochrome G on a
 * sign-in button reads as a mistake rather than as a brand.
 */
export function GoogleButton({ onClick, busy, label }: { onClick: () => void; busy?: boolean; label: string }) {
  return (
    <button type="button" className="btn btn-outline btn-lg w-full" onClick={onClick} disabled={busy}>
      {busy ? (
        <Icon name="refresh" size={16} className="animate-spin" />
      ) : (
        <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
      )}
      {label}
    </button>
  );
}
