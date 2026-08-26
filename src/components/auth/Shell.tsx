import type { ReactNode } from 'react';
import { BRAND } from '@/brand';
import { PlauviaMark, PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { useT, useLang, L } from '@/i18n';

/**
 * ─────────────────────────────────────────────────────── the account rooms ──
 *
 * Four screens stand between a stranger and the app — signing in, the code
 * from the inbox, the second factor, the new password after a reset — and
 * they are one room: a brand panel on the left, the form on the right.
 *
 * The panel is not a sales pitch. Nobody arrives at a password field needing
 * to be convinced, so it says only what a person about to type a password
 * wants to know: whose door this is, and what happens to what they put behind
 * it. On a phone it collapses to a single line of brand above the form, since
 * the second column would be six hundred pixels of decoration between the
 * visitor and the keyboard.
 */

export function AuthLayout({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  const t = useT();
  return (
    <div
      className="auth-shell fixed inset-0 z-[70] grid overflow-y-auto lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]"
    >
      <AuthAside />

      <div className="relative flex min-h-full flex-col">
        {onClose && (
          <button
            className="icon-btn absolute right-4 top-4 z-10"
            onClick={onClose}
            aria-label={t(L('Затвори', 'Close'))}
          >
            <Icon name="x" size={18} />
          </button>
        )}

        <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col justify-center px-5 py-12 sm:px-8">
          {/* The lockup belongs on the form side only where the panel is not
              showing — two marks on one screen is one too many. */}
          <header className="mb-7 flex items-center gap-2.5 lg:hidden">
            <PlauviaTile size={30} />
            <PlauviaWordmark size={17} />
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * The left half: the brand, and the three sentences that are actually
 * relevant to somebody deciding whether to hand over an e-mail address.
 */
function AuthAside() {
  const lang = useLang();

  const points =
    lang === 'bg'
      ? [
          { icon: 'shield', title: 'Данните са първо при теб', body: 'Всичко се пише в устройството ти. Профилът само го пренася до второто.' },
          { icon: 'wifiOff', title: 'Работи и без мрежа', body: 'Приложението се отваря и върши работа офлайн — синхронизацията чака.' },
          { icon: 'eyeOff', title: 'Без реклами и профилиране', body: 'Вътре няма никаква аналитика. Какво пишеш и колко работиш не се мери.' },
        ]
      : [
          { icon: 'shield', title: 'Your data is yours first', body: 'Everything is written to your device. The account only carries it to the second one.' },
          { icon: 'wifiOff', title: 'Works with no network', body: 'The app opens and works offline — syncing waits its turn.' },
          { icon: 'eyeOff', title: 'No ads, no profiling', body: 'There is no analytics inside. What you write and how long you work is measured by nobody.' },
        ];

  return (
    <aside className="brand-panel brand-panel-grid relative hidden flex-col justify-between p-10 lg:flex xl:p-14">
      <div className="flex items-center gap-2.5">
        <PlauviaMark size={26} tone="light" />
        <PlauviaWordmark size={18} />
      </div>

      <div className="max-w-[26rem]">
        <h2 className="t-face text-[clamp(26px,2.6vw,34px)] leading-[1.1] tracking-[-0.032em]">
          {BRAND.tagline[lang]}
        </h2>
        <p className="mt-3.5 text-[14px] leading-relaxed" style={{ opacity: 0.82 }}>
          {BRAND.description[lang]}
        </p>

        <ul className="mt-9 space-y-5">
          {points.map((point) => (
            <li key={point.title} className="flex gap-3.5">
              <span
                className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
                style={{ background: 'rgb(255 255 255 / 14%)' }}
              >
                <Icon name={point.icon} size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">{point.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed" style={{ opacity: 0.76 }}>
                  {point.body}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[12px]" style={{ opacity: 0.66 }}>
        {BRAND.domain}
      </p>
    </aside>
  );
}

/**
 * The panel the forms sit in.
 *
 * On the wide layout it is bare: the column *is* the panel, and a card inside
 * a half-screen of white is a box drawn around nothing. Below `lg`, where the
 * form sits on the page ground on its own, it takes the card back.
 */
export function AuthPanel({ children }: { children: ReactNode }) {
  return (
    <div className="card animate-in card-raised p-6 sm:p-7 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      {children}
    </div>
  );
}

/**
 * ─────────────────────────────────────────────── where you are in signing up ──
 *
 * Four steps that span two components and a session boundary: the account and
 * the code happen before anybody is signed in, the name and the face after.
 * The rail is what makes that one journey rather than two — somebody who has
 * just typed a code and watched the whole screen change needs to be told, in
 * the smallest possible way, that they have not been dropped somewhere else.
 *
 * Numbered rather than labelled. Four words across 420 px either wrap or set
 * at a size nobody reads, and "Step 2 of 4" answers the only question being
 * asked here — how much more of this is there.
 */
export function SignUpProgress({ step }: { step: 0 | 1 | 2 | 3 }) {
  const t = useT();
  const total = 4;
  return (
    <div>
      <div className="flex gap-1.5" role="presentation">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="h-[3px] flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= step ? 'var(--c-accent)' : 'var(--c-line)' }}
          />
        ))}
      </div>
      <p className="mt-2 text-[11.5px] font-medium tracking-[0.02em] text-faint">
        {t(L(`Стъпка ${step + 1} от ${total}`, `Step ${step + 1} of ${total}`))}
      </p>
    </div>
  );
}

export function AuthTitle({ title, hint, icon }: { title: string; hint?: ReactNode; icon?: string }) {
  return (
    <div className="mb-6">
      {icon && (
        <span className="tile mb-4">
          <Icon name={icon} size={19} />
        </span>
      )}
      <h1 className="t-face text-[clamp(22px,2.4vw,27px)] leading-[1.08] tracking-[-0.028em]">{title}</h1>
      {hint && <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{hint}</p>}
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
      role={tone === 'danger' ? 'alert' : 'status'}
      className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-snug"
      style={{
        background: `color-mix(in srgb, ${color} 9%, transparent)`,
        color,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 18%, transparent)`,
      }}
    >
      <Icon name={tone === 'danger' ? 'alert' : 'checkCircle'} size={14} className="mt-px shrink-0" />
      {text}
    </p>
  );
}
