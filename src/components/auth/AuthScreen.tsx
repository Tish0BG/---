import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { cloudConfig } from '@/services/cloud/config';
import { diagnose, worstOf, type CheckResult } from '@/services/cloud/diagnose';
import { Icon } from '../Icon';
import { SETUP_SQL } from './schema';

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
  const configured = useAuth((s) => s.configured);
  const awaiting = useAuth((s) => s.awaitingConfirm);

  return (
    <div className="fixed inset-0 z-[70] flex overflow-y-auto" style={{ background: 'var(--c-bg)' }}>
      <Aside />

      <main className="relative flex min-h-full min-w-0 flex-1 items-center justify-center px-5 py-10">
        <button
          className="icon-btn absolute right-4 top-4"
          onClick={onClose}
          aria-label="Затвори"
          title="Продължи без профил"
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
  const points = [
    { icon: 'drive', text: 'Учебниците и дъските ти — и на телефона' },
    { icon: 'pencil', text: 'Бележките се сливат сами, по-новото печели' },
    { icon: 'cards', text: 'Картите и планерът вървят с теб' },
    { icon: 'cloud', text: 'Твоя собствена база — никой друг няма достъп' },
  ];
  return (
    <aside
      className="relative hidden w-[42%] max-w-[520px] shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex"
      style={{
        background: 'linear-gradient(150deg, var(--c-accent), color-mix(in srgb, var(--c-accent) 55%, #0ea5e9))',
        color: '#fff',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'rgb(255 255 255 / 18%)' }}>
          <Icon name="book" size={18} />
        </span>
        <span className="text-[16px] font-semibold tracking-tight">StudyDesk</span>
      </div>

      <div>
        <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">
          Едно място за ученето.
          <br />
          На всяко устройство.
        </h2>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p.text} className="flex items-start gap-2.5 text-[13.5px]" style={{ opacity: 0.92 }}>
              <Icon name={p.icon} size={16} className="mt-px shrink-0" />
              {p.text}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11.5px] leading-relaxed" style={{ opacity: 0.75 }}>
        Профилът е по избор. Без него приложението работи точно толкова добре — данните просто
        остават на това устройство.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ forms */

function Forms({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
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
          <span
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{ background: 'var(--c-accent)', color: '#fff' }}
          >
            <Icon name="book" size={18} />
          </span>
          <span className="text-[16px] font-semibold tracking-tight">StudyDesk</span>
        </span>
      </header>

      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
        {forgot ? 'Нова парола' : tab === 'signin' ? 'Влез в профила си' : 'Създай профил'}
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {forgot
          ? 'Ще ти пратим писмо с връзка за смяна на паролата.'
          : tab === 'signin'
            ? 'За да намериш библиотеката си и тук.'
            : 'Отнема минута и не иска нищо освен имейл.'}
      </p>

      {!forgot && (
        <div className="segmented mt-5">
          {(
            [
              ['signin', 'Вход'],
              ['signup', 'Регистрация'],
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
          <Field label="Име">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field h-10"
              placeholder="Как да ти казвам"
              autoComplete="name"
            />
          </Field>
        )}

        <Field label="Имейл">
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
          <Field label="Парола">
            <span className="relative block">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field h-10 pr-10"
                type={show ? 'text' : 'password'}
                placeholder="Поне 8 знака"
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="icon-btn absolute right-1 top-1 h-8 w-8"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Скрий паролата' : 'Покажи паролата'}
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
          {forgot ? 'Изпрати писмо' : tab === 'signin' ? 'Влез' : 'Създай профил'}
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
          {forgot ? '← Назад към входа' : 'Забравена парола?'}
        </button>
        <button className="cursor-pointer text-muted underline-offset-2 hover:underline" onClick={onClose}>
          Продължи без профил
        </button>
      </div>

      <Diagnostics checks={checks} setChecks={setChecks} />
    </>
  );
}

/* ------------------------------------------------------------ confirm step */

/** Shown when the project requires a confirmation e-mail. */
function ConfirmStep({ email }: { email: string }) {
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
      <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">Провери пощата си</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Профилът за <b className="text-ink">{email}</b> е създаден, но този проект иска потвърждение.
        Докато не отвориш връзката от писмото, влизането няма да мине — затова приложението още
        казва, че не си влязъл.
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
          Изпрати писмото отново
        </button>
        <button className="btn h-10 w-full" onClick={() => useAuth.getState().clearNotice()}>
          Потвърдих — към входа
        </button>
      </div>

      {(message || notice) && (
        <p className="mt-3 text-[12px]" style={{ color: message ? 'var(--c-danger)' : 'var(--c-success)' }}>
          {message ?? notice}
        </p>
      )}

      <p className="mt-5 rounded-xl p-3 text-left text-[11.5px] leading-relaxed text-muted" style={{ background: 'var(--c-surface-2)' }}>
        <b className="text-ink">Съвет за личен профил:</b> изключи изискването и регистрацията ще влиза
        веднага. Supabase → <b>Authentication</b> → <b>Sign In / Providers</b> → <b>Email</b> → изключи
        <b> „Confirm email“</b>. Вградената поща на Supabase праща и по няколко писма на час, така че
        често е и по-надеждно.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ setup */

function Setup() {
  const fixed = useAuth((s) => s.fixed);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);

  if (fixed) return <p className="text-[13px] text-muted">Облакът е зададен при публикуването.</p>;

  return (
    <>
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Свържи база</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        За да пренасяш библиотеката между устройства, приложението има нужда от собствена база.
        Supabase дава безплатен план. Прави се веднъж, за около пет минути.
      </p>

      <ol className="mt-5 space-y-2.5 text-[12.5px]">
        <Step n={1}>
          Създай проект в{' '}
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
          <b>SQL Editor → New query</b>, постави скрипта и натисни <b>Run</b>.
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
            {copied ? 'Копирано' : 'Копирай SQL скрипта'}
          </button>
        </Step>
        <Step n={3}>
          <b>Storage → New bucket</b> → име <code>library</code>, остави го private.
        </Step>
        <Step n={4}>
          <b>Project Settings → API</b> → копирай адреса и <b>publishable</b> ключа тук.
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
            placeholder="sb_publishable_… или eyJhbGciOi…"
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
          Свържи
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Адресът и publishable ключът са публични по замисъл — защитата е в правилата на базата.
        <b className="text-ink"> Тайният (secret) ключ никога не влиза тук.</b>
      </p>

      <Diagnostics checks={checks} setChecks={setChecks} />
    </>
  );
}

/* ------------------------------------------------------------ diagnostics */

function Diagnostics({
  checks,
  setChecks,
}: {
  checks: CheckResult[] | null;
  setChecks: (c: CheckResult[] | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const cfg = cloudConfig();

  const run = () => {
    setBusy(true);
    void diagnose().then((r) => {
      setChecks(r);
      setBusy(false);
    });
  };

  return (
    <section className="mt-6 border-t border-line pt-4">
      <button
        className="flex w-full cursor-pointer items-center gap-2 text-[12px] text-muted transition-colors hover:text-ink"
        onClick={() => (checks ? setChecks(null) : run())}
        disabled={busy}
      >
        <Icon name={busy ? 'refresh' : 'stethoscope'} size={14} className={busy ? 'animate-spin' : ''} />
        <span className="flex-1 text-left">
          {busy ? 'Проверявам…' : checks ? 'Скрий проверката' : 'Нещо не работи? Провери връзката'}
        </span>
        {cfg && <span className="text-[11px] text-faint">{cfg.url.replace(/^https?:\/\//, '').split('.')[0]}</span>}
      </button>

      {checks && (
        <div className="mt-3 space-y-2">
          {checks.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Icon
                name={c.state === 'ok' ? 'checkCircle' : c.state === 'fail' ? 'alert' : 'info'}
                size={14}
                className="mt-px shrink-0"
                style={{
                  color:
                    c.state === 'ok'
                      ? 'var(--c-success)'
                      : c.state === 'fail'
                        ? 'var(--c-danger)'
                        : 'var(--c-warn)',
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium">{c.label}</div>
                <div className="text-[11.5px] leading-relaxed text-muted">{c.detail}</div>
                {c.fix && (
                  <div className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: 'var(--c-accent)' }}>
                    {c.fix}
                  </div>
                )}
              </div>
            </div>
          ))}
          <button className="btn btn-outline mt-1 w-full" onClick={run} disabled={busy}>
            <Icon name="refresh" size={14} className={busy ? 'animate-spin' : ''} />
            Провери отново
          </button>
          <p className="pt-1 text-[11px] text-faint">
            Общо състояние:{' '}
            {worstOf(checks) === 'ok'
              ? 'всичко е наред'
              : worstOf(checks) === 'warn'
                ? 'работи, но има какво да се оправи'
                : 'има нещо счупено'}
          </p>
        </div>
      )}
    </section>
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
