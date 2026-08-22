import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { BRAND } from '@/brand';
import { PlauviaMark, PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';
import { SETUP_SQL } from './schema';
import { useT, useLang, L } from '@/i18n';

type Tab = 'signin' | 'signup';

/**
 * The sign-in page.
 *
 * A full screen rather than a dialog on purpose: this is the moment the app
 * stops being "a tab" and becomes "my account", and a modal floating over a
 * half-visible dashboard does not read that way. It is also the place where
 * setup goes wrong, so the diagnostics live one click away instead of buried
 * in settings.
 */
export function AuthScreen({ onClose }: { onClose: () => void }) {
  const t = useT();
  const configured = useAuth((s) => s.configured);
  const awaiting = useAuth((s) => s.awaitingConfirm);

  return (
    <div className="fixed inset-0 z-[70] flex overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
      <Aside />

      <main className="relative flex min-h-full min-w-0 flex-1 items-center justify-center px-5 py-10">
        <button
          className="icon-btn absolute right-4 top-4"
          onClick={onClose}
          aria-label={t(L('Затвори', 'Close'))}
          title={t(L('Продължи без профил', 'Continue without an account'))}
        >
          <Icon name="x" size={18} />
        </button>

        <div className="w-full max-w-[380px]">
          {awaiting ? <ConfirmStep email={awaiting} /> : configured ? <Forms onClose={onClose} /> : <Setup />}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ aside */

/** The half of the screen that explains why an account is worth having. */
function Aside() {
  const t = useT();
  const lang = useLang();
  const points = [
    { icon: 'drive', text: L('Учебниците и дъските ти — и на телефона', 'Your textbooks and boards, on your phone too') },
    { icon: 'pencil', text: L('Бележките се сливат сами, по-новото печели', 'Notes merge on their own — the newer write wins') },
    { icon: 'cards', text: L('Картите и задачите вървят с теб', 'Cards and tasks travel with you') },
    { icon: 'cloud', text: L('Твоя собствена база — никой друг няма достъп', 'Your own database — nobody else has a key') },
  ];
  return (
    <aside
      className="relative hidden w-[42%] max-w-[520px] shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex"
      style={{
        background: 'linear-gradient(150deg, var(--c-brand-lift), var(--c-brand-deep))',
        color: '#fff',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'rgb(255 255 255 / 18%)' }}>
          <PlauviaMark size={19} />
        </span>
        <PlauviaWordmark size={17} />
      </div>

      <div>
        <h2
          className="font-semibold leading-[1.12]"
          style={{ fontSize: 'var(--text-title)', letterSpacing: 'var(--track-title)' }}
        >
          {BRAND.tagline[lang]}
        </h2>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p.text.en} className="flex items-start gap-2.5 text-[13.5px]" style={{ opacity: 0.92 }}>
              <Icon name={p.icon} size={16} className="mt-px shrink-0" />
              {t(p.text)}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11.5px] leading-relaxed" style={{ opacity: 0.75 }}>
        {t(
          L(
            'Профилът е по избор. Без него приложението работи точно толкова добре — данните просто остават на това устройство.',
            'An account is optional. Without one the app works just as well — the data simply stays on this device.',
          ),
        )}
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ forms */

function Forms({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const notice = useAuth((s) => s.notice);
  const user = useAuth((s) => s.user);

  // Signing in is the whole point of this screen; once it happens, leave.
  useEffect(() => {
    if (user) onClose();
  }, [user, onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const store = useAuth.getState();
    const problem = forgot
      ? await store.resetPassword(email)
      : tab === 'signin'
        ? await store.signIn(email, password)
        : await store.signUp(email, password, name);
    setBusy(false);
    if (problem) setError(problem);
  };

  const ready = email.includes('@') && (forgot || password.length >= 8) && !busy;

  return (
    <>
      <header className="mb-6 lg:hidden">
        <span className="flex items-center gap-2.5">
          <PlauviaTile size={34} />
          <PlauviaWordmark size={17} />
        </span>
      </header>

      <h1
        className="font-semibold leading-[1.12]"
        style={{ fontSize: 'var(--text-title)', letterSpacing: 'var(--track-title)' }}
      >
        {t(forgot ? L('Нова парола', 'New password') : tab === 'signin' ? L('Влез в профила си', 'Sign in') : L('Създай профил', 'Create an account'))}
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {forgot
          ? t(L('Ще ти пратим писмо с връзка за смяна на паролата.', 'We will send you a link to set a new password.'))
          : tab === 'signin'
            ? t(L('За да намериш библиотеката си и тук.', 'So your library is here too.'))
            : t(L('Отнема минута и не иска нищо освен имейл.', 'It takes a minute and asks for nothing but an e-mail.'))}
      </p>

      {!forgot && (
        <div className="segmented mt-5">
          {(
            [
              ['signin', t(L('Вход', 'Sign in'))],
              ['signup', t(L('Регистрация', 'Sign up'))],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => {
                setTab(id);
                setError(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) void submit();
        }}
      >
        {tab === 'signup' && !forgot && (
          <Field label={t(L('Име', 'Name'))}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field h-10"
              placeholder={t(L('Как да ти казвам', 'What should we call you'))}
              autoComplete="name"
            />
          </Field>
        )}

        <Field label={t(L('Имейл', 'E-mail'))}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field h-10"
            type="email"
            placeholder="ime@example.com"
            autoComplete="email"
            autoFocus
          />
        </Field>

        {!forgot && (
          <Field label={t(L('Парола', 'Password'))}>
            <span className="relative block">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field h-10 pr-10"
                type={show ? 'text' : 'password'}
                placeholder={t(L('Поне 8 знака', 'At least 8 characters'))}
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="icon-btn absolute right-1 top-1 h-8 w-8"
                onClick={() => setShow((v) => !v)}
                aria-label={t(show ? L('Скрий паролата', 'Hide the password') : L('Покажи паролата', 'Show the password'))}
              >
                <Icon name={show ? 'eyeOff' : 'eye'} size={15} />
              </button>
            </span>
          </Field>
        )}

        {error && <Banner tone="danger" text={error} />}
        {notice && <Banner tone="ok" text={notice} />}

        <button className="btn btn-primary h-10 w-full" disabled={!ready} type="submit">
          {busy && <Icon name="refresh" size={15} className="animate-spin" />}
          {t(forgot ? L('Изпрати писмо', 'Send the e-mail') : tab === 'signin' ? L('Влез', 'Sign in') : L('Създай профил', 'Create the account'))}
        </button>
      </form>

      <div className="mt-3 flex items-center justify-between text-[12px]">
        <button
          className="cursor-pointer text-muted underline-offset-2 hover:underline"
          onClick={() => {
            setForgot(!forgot);
            setError(null);
          }}
        >
          {t(forgot ? L('← Назад към входа', '← Back to sign in') : L('Забравена парола?', 'Forgotten your password?'))}
        </button>
        <button className="cursor-pointer text-muted underline-offset-2 hover:underline" onClick={onClose}>
          {t(L('Продължи без профил', 'Continue without an account'))}
        </button>
      </div>

    </>
  );
}

/* ------------------------------------------------------------ confirm step */

/** Shown when the project requires a confirmation e-mail. */
function ConfirmStep({ email }: { email: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const notice = useAuth((s) => s.notice);

  return (
    <div className="text-center">
      <span
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
        style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
      >
        <Icon name="send" size={24} />
      </span>
      <h1
        className="mt-4 font-semibold leading-[1.12]"
        style={{ fontSize: 'var(--text-title)', letterSpacing: 'var(--track-title)' }}
      >
        {t(L('Провери пощата си', 'Check your inbox'))}
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        {t(
          L(
            `Профилът за ${email} е създаден, но този проект иска потвърждение. Докато не отвориш връзката от писмото, влизането няма да мине.`,
            `The account for ${email} exists, but this project asks for confirmation. Until you open the link in the e-mail, signing in will not go through.`,
          ),
        )}
      </p>

      <div className="mt-5 space-y-2">
        <button
          className="btn btn-outline h-10 w-full"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void useAuth
              .getState()
              .resendConfirmation(email)
              .then((err) => {
                setMessage(err);
                setBusy(false);
              });
          }}
        >
          {busy && <Icon name="refresh" size={15} className="animate-spin" />}
          {t(L('Изпрати писмото отново', 'Send the e-mail again'))}
        </button>
        <button className="btn h-10 w-full" onClick={() => useAuth.getState().clearNotice()}>
          {t(L('Потвърдих — към входа', 'Confirmed — go to sign in'))}
        </button>
      </div>

      {(message || notice) && (
        <p className="mt-3 text-[12px]" style={{ color: message ? 'var(--c-danger)' : 'var(--c-success)' }}>
          {message ?? notice}
        </p>
      )}

      <p className="mt-5 rounded-xl p-3 text-left text-[11.5px] leading-relaxed text-muted" style={{ background: 'var(--c-surface-2)' }}>
        <b className="text-ink">{t(L('Съвет за личен профил:', 'Tip for a personal project:'))}</b>{' '}
        {t(
          L(
            'изключи изискването и регистрацията влиза веднага. Supabase → Authentication → Sign In / Providers → Email → изключи „Confirm email“.',
            'turn the requirement off and sign-up goes straight through. Supabase → Authentication → Sign In / Providers → Email → switch off "Confirm email".',
          ),
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ setup */

function Setup() {
  const t = useT();
  const fixed = useAuth((s) => s.fixed);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  if (fixed)
    return (
      <p className="text-[13px] text-muted">
        {t(L('Облакът е зададен при публикуването.', 'The cloud was configured at deploy time.'))}
      </p>
    );

  return (
    <>
      <h1
        className="font-semibold leading-[1.12]"
        style={{ fontSize: 'var(--text-title)', letterSpacing: 'var(--track-title)' }}
      >
        {t(L('Свържи база', 'Connect a database'))}
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {t(
          L(
            'За да пренасяш библиотеката между устройства, приложението има нужда от собствена база. Supabase дава безплатен план. Прави се веднъж, за около пет минути.',
            'To carry your library between devices the app needs a database of its own. Supabase has a free plan. It is a one-off, about five minutes.',
          ),
        )}
      </p>

      <ol className="mt-5 space-y-2.5 text-[12.5px]">
        <Step n={1}>
          {t(L('Създай проект в', 'Create a project on'))}{' '}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
            style={{ color: 'var(--c-accent)' }}
          >
            supabase.com
          </a>
          .
        </Step>
        <Step n={2}>
          <b>SQL Editor → New query</b>, {t(L('постави скрипта и натисни', 'paste the script and press'))}{' '}
          <b>Run</b>.
          <button
            className="btn btn-outline mt-1.5 w-full"
            onClick={() =>
              void navigator.clipboard.writeText(SETUP_SQL).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              })
            }
          >
            <Icon name={copied ? 'check' : 'copy'} size={14} />
            {t(copied ? L('Копирано', 'Copied') : L('Копирай SQL скрипта', 'Copy the SQL script'))}
          </button>
        </Step>
        <Step n={3}>
          <b>Storage → New bucket</b> → {t(L('име', 'name'))} <code>library</code>,{' '}
          {t(L('остави го private.', 'leave it private.'))}
        </Step>
        <Step n={4}>
          <b>Project Settings → API</b> → {t(L('копирай адреса и publishable ключа тук.', 'copy the URL and the publishable key here.'))}
        </Step>
      </ol>

      <div className="mt-4 space-y-2.5">
        <Field label="Project URL">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="field h-10 font-mono text-[12px]"
            placeholder="https://xxxxxxxx.supabase.co"
            spellCheck={false}
          />
        </Field>
        <Field label="Publishable / anon key">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="field h-10 font-mono text-[12px]"
            placeholder={t(L('sb_publishable_… или eyJhbGciOi…', 'sb_publishable_… or eyJhbGciOi…'))}
            spellCheck={false}
          />
        </Field>
        {error && <Banner tone="danger" text={error} />}
        <button
          className="btn btn-primary h-10 w-full"
          disabled={!url || !key || busy}
          onClick={() => {
            setBusy(true);
            void useAuth
              .getState()
              .configure(url, key)
              .then((problem) => {
                setError(problem);
                setBusy(false);
              });
          }}
        >
          {busy && <Icon name="refresh" size={15} className="animate-spin" />}
          {t(L('Свържи', 'Connect'))}
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {t(
          L(
            'Адресът и publishable ключът са публични по замисъл — защитата е в правилата на базата.',
            'The URL and the publishable key are public by design — the protection lives in the database rules.',
          ),
        )}
        <b className="text-ink">
          {' '}
          {t(L('Тайният (secret) ключ никога не влиза тук.', 'The secret key never goes in here.'))}
        </b>
      </p>

    </>
  );
}

/* ---------------------------------------------------------------- pieces */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block label">{label}</span>
      {children}
    </label>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
        style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
      >
        {n}
      </span>
      <span className="flex-1 leading-relaxed">{children}</span>
    </li>
  );
}

function Banner({ tone, text }: { tone: 'danger' | 'ok'; text: string }) {
  const color = tone === 'danger' ? 'var(--c-danger)' : 'var(--c-success)';
  return (
    <p
      className="flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px] leading-snug"
      style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
    >
      <Icon name={tone === 'danger' ? 'alert' : 'checkCircle'} size={13} className="mt-px shrink-0" />
      {text}
    </p>
  );
}
