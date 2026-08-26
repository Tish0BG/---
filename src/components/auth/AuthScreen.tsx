import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { useApp } from '@/state/appStore';
import { AuthLayout, AuthNote as Banner, AuthPanel as Panel, AuthTitle as Title } from './Shell';
import { Icon } from '../Icon';
import { SETUP_SQL } from './schema';
import { useT, L, type Msg } from '@/i18n';
import { GoogleButton, PasswordField } from './PasswordField';
import { CodeInput, ResendButton } from './CodeInput';
import { SignUpFlow } from './SignUpFlow';
import { readPendingSignUp } from '@/state/signupHandoff';

/**
 * How long an e-mailed code is.
 *
 * Supabase lets a project choose anywhere from six to ten digits, and the
 * default is not the same across projects. Assuming six is how a perfectly
 * correct eight-digit code ends up sitting in the box with the button greyed
 * out and nothing explaining why.
 */
const EMAIL_CODE_MIN = 6;
const EMAIL_CODE_MAX = 10;

const emailCodeLooksComplete = (raw: string): boolean => {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= EMAIL_CODE_MIN && digits.length <= EMAIL_CODE_MAX;
};

/**
 * ─────────────────────────────────────────────────────────────── the door ──
 *
 * One column, down the middle, on the page's own colour.
 *
 * It used to be a split screen: a tall panel of brand gradient on the left
 * carrying four selling points, and the form squeezed into the right. That
 * layout sells to somebody who has already decided — nobody arrives at a
 * sign-in form needing to be convinced the product is good, they arrive
 * needing to type two things and leave. So the argument is gone and what is
 * left is the form, given the middle of the screen and room to breathe.
 *
 * It is still a whole page rather than a dialog: this is the moment the app
 * stops being "a tab" and becomes "my account". It is also where setup goes
 * wrong, so the database instructions live here rather than buried in
 * settings.
 */
export function AuthScreen({ onClose }: { onClose: () => void }) {
  const configured = useAuth((s) => s.configured);
  const awaiting = useAuth((s) => s.awaitingConfirm);
  const mode = useApp((s) => s.authMode);

  // A sign-up in progress outranks the tab: somebody who has just been sent a
  // code and reloaded the tab is still signing up, whatever `authMode` says.
  const registering = mode === 'signup' || !!awaiting || !!readPendingSignUp();

  return (
    <AuthLayout onClose={onClose}>
      {!configured ? <Setup /> : registering ? <SignUpFlow /> : <SignIn onClose={onClose} />}
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ forms */

/**
 * ────────────────────────────────────────────────────────────── signing in ──
 *
 * Only signing in. Creating an account is four steps and lives in
 * `SignUpFlow`; the two used to share one component with a `tab` and a pile
 * of conditionals, and the result was a form where half the fields were
 * hidden at any moment and nothing on screen was quite the shape of either
 * job.
 *
 * Three doors, though, because signing in genuinely has three: a password, a
 * code instead of a password, and a code that leads to setting a new one.
 */
function SignIn({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** the "set a new password" journey rather than the "let me in" one */
  const [forgot, setForgot] = useState(false);
  /** a one-time code instead of a password */
  const [byCode, setByCode] = useState(false);
  /** true once a code has been sent and the form is waiting for it back */
  const [codeSent, setCodeSent] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const notice = useAuth((s) => s.notice);
  const user = useAuth((s) => s.user);
  const mfaPending = useAuth((s) => s.mfaPending);
  const remember = useAuth((s) => s.remember);

  // Signing in is the whole point of this screen; once it happens, leave —
  // unless a second factor is still owed, in which case its own screen takes
  // over and this one must not close over the top of it.
  useEffect(() => {
    if (user && !mfaPending) onClose();
  }, [user, mfaPending, onClose]);

  const sendCode = async (): Promise<string | null> =>
    forgot
      ? useAuth.getState().resetPassword(email.trim())
      : useAuth.getState().sendSignInCode(email.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);

    // Second leg of either code journey: the code is in the box.
    if (codeSent) {
      const refusal = await useAuth
        .getState()
        .verifyCode(email, code, forgot ? 'recovery' : 'signin');
      setBusy(false);
      if (refusal) {
        setError(refusal);
        setCode('');
      }
      return;
    }

    const refusal = forgot || byCode ? await sendCode() : await useAuth.getState().signIn(email.trim(), password);
    setBusy(false);
    if (refusal) {
      setError(refusal);
      return;
    }
    if (forgot || byCode) {
      setCodeSent(true);
      setSentAt(Date.now());
    }
  };

  /** Back to the beginning, whichever branch we wandered down. */
  const restart = () => {
    setCodeSent(false);
    setCode('');
    setError(null);
    useAuth.getState().clearNotice();
  };

  const needsPassword = !forgot && !byCode;

  const problem = (): Msg | null => {
    if (codeSent) {
      return emailCodeLooksComplete(code) ? null : L('Въведи кода от пощата.', 'Enter the code from your inbox.');
    }
    if (!email.trim()) return L('Трябва имейл адрес.', 'An e-mail address is needed.');
    if (!email.includes('@')) return L('Този имейл не изглежда пълен.', 'That e-mail does not look complete.');
    if (needsPassword && !password) return L('Трябва парола.', 'A password is needed.');
    return null;
  };

  const withGoogle = async () => {
    setGoogle(true);
    setError(null);
    const refusal = await useAuth.getState().signInWithGoogle();
    // On success the tab is already on its way to Google, so there is nothing
    // to switch back; only a refusal comes back here.
    if (refusal) {
      setGoogle(false);
      setError(refusal);
    }
  };

  const title = codeSent
    ? L('Провери пощата си', 'Check your inbox')
    : forgot
      ? L('Нова парола', 'New password')
      : byCode
        ? L('Влез с код', 'Sign in with a code')
        : L('Влез в профила си', 'Welcome back');

  const hint = codeSent
    ? L(`Изпратихме код на ${email}.`, `We sent a code to ${email}.`)
    : forgot
      ? L('Ще ти пратим код, с който да смениш паролата.', 'We will send you a code to set a new password with.')
      : byCode
        ? L('Без парола — код от пощата и си вътре.', 'No password — a code from your inbox and you are in.')
        : L('За да намериш библиотеката си и тук.', 'So your library is here too.');

  return (
    <>
      <Panel>
        <Title title={t(title)} hint={t(hint)} icon={codeSent ? 'mail' : undefined} />

        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const missing = problem();
            if (missing) {
              setError(t(missing));
              return;
            }
            if (!busy) void submit();
          }}
        >
          {codeSent && (
            <CodeInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (error) setError(null);
              }}
              invalid={!!error}
              disabled={busy}
              onComplete={(value) => {
                if (!busy) {
                  setCode(value);
                  void submit();
                }
              }}
            />
          )}

          {!codeSent && (
            <Field label={t(L('Имейл', 'E-mail'))}>
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="field field-lg"
                type="email"
                placeholder="ime@example.com"
                autoComplete="email"
                autoFocus
              />
            </Field>
          )}

          {!codeSent && needsPassword && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <label htmlFor="plauvia-password" className="text-[12.5px] font-medium text-muted">
                  {t(L('Парола', 'Password'))}
                </label>
                <button
                  type="button"
                  className="link-quiet text-[12.5px]"
                  onClick={() => {
                    setForgot(true);
                    setByCode(false);
                    setError(null);
                  }}
                >
                  {t(L('Забравена?', 'Forgotten?'))}
                </button>
              </div>
              <PasswordField
                id="plauvia-password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (error) setError(null);
                }}
                autoComplete="current-password"
              />
            </div>
          )}

          {/* Whether the sign-in survives closing the browser.
              On by default, because the great majority are on their own
              device — and off is the answer that matters on the computer in a
              school library, which is why it is a visible choice and not a
              setting three menus deep. */}
          {!codeSent && needsPassword && (
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => useAuth.getState().setRemember(e.target.checked)}
                className="mt-[3px] h-[15px] w-[15px] shrink-0 cursor-pointer accent-[var(--c-accent)]"
              />
              <span>
                {t(L('Запомни ме на това устройство', 'Remember me on this device'))}
                <span className="block text-[12px] text-muted">
                  {remember
                    ? t(
                        L(
                          'Оставаш в профила си, докато не излезеш сам.',
                          'You stay signed in until you sign out yourself.',
                        ),
                      )
                    : t(
                        L(
                          'Излизаш от профила, щом затвориш браузъра.',
                          'You are signed out as soon as you close the browser.',
                        ),
                      )}
                </span>
              </span>
            </label>
          )}

          {error && <Banner tone="danger" text={error} />}
          {!error && notice && <Banner tone="ok" text={notice} />}

          <button className="btn btn-primary btn-lg w-full" disabled={busy} type="submit">
            {busy && <Icon name="refresh" size={15} className="animate-spin" />}
            {t(
              codeSent
                ? L('Потвърди', 'Confirm')
                : forgot || byCode
                  ? L('Изпрати код', 'Send the code')
                  : L('Влез', 'Sign in'),
            )}
          </button>
        </form>

        {codeSent && (
          <div className="mt-4 space-y-3">
            <ResendButton
              startedAt={sentAt}
              busy={resending}
              onResend={() => {
                setResending(true);
                setError(null);
                void sendCode().then((refusal) => {
                  setResending(false);
                  if (refusal) setError(refusal);
                  else setSentAt(Date.now());
                });
              }}
            />
            <button type="button" className="link-quiet mx-auto block text-[12.5px]" onClick={restart}>
              {t(L('← Друг адрес, или нов код', '← A different address, or a new code'))}
            </button>
          </div>
        )}

        {!forgot && !codeSent && (
          <>
            <Divider label={t(L('или', 'or'))} />
            <GoogleButton
              onClick={() => void withGoogle()}
              busy={google}
              label={t(L('Продължи с Google', 'Continue with Google'))}
            />
            <button
              type="button"
              className="btn btn-lg mt-2 w-full"
              onClick={() => {
                setByCode(!byCode);
                setError(null);
              }}
            >
              <Icon name="mail" size={16} />
              {t(byCode ? L('Влез с парола', 'Use a password instead') : L('Изпрати ми код', 'E-mail me a code'))}
            </button>
          </>
        )}

        {forgot && !codeSent && (
          <button
            className="link-quiet mt-4 block text-[12.5px]"
            onClick={() => {
              setForgot(false);
              setError(null);
            }}
          >
            {t(L('← Назад към входа', '← Back to sign in'))}
          </button>
        )}
      </Panel>

      {/* -------------------------------------------------------- switch */}

      {!codeSent && !forgot && (
        <p className="mt-6 text-center text-[13px] text-muted">
          {t(L('Нямаш профил?', 'No account yet?'))}{' '}
          <button
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--c-accent)' }}
            onClick={() => {
              setByCode(false);
              setError(null);
              useApp.getState().setAuthMode('signup');
            }}
          >
            {t(L('Създай профил', 'Create one'))}
          </button>
        </p>
      )}
    </>
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
      <Panel>
        <p className="text-[13px] text-muted">
          {t(L('Облакът е зададен при публикуването.', 'The cloud was configured at deploy time.'))}
        </p>
      </Panel>
    );

  return (
    <Panel>
      <Title
        title={t(L('Свържи база', 'Connect a database'))}
        hint={t(
          L(
            'За да пренасяш библиотеката между устройства, приложението има нужда от собствена база. Supabase дава безплатен план. Прави се веднъж, за около пет минути.',
            'To carry your library between devices the app needs a database of its own. Supabase has a free plan. It is a one-off, about five minutes.',
          ),
        )}
      />

      <ol className="space-y-2.5 text-[13px]">
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
          <b>Project Settings → API</b> →{' '}
          {t(L('копирай адреса и publishable ключа тук.', 'copy the URL and the publishable key here.'))}
        </Step>
      </ol>

      <div className="mt-5 space-y-3">
        <Field label="Project URL">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="field field-lg font-mono text-[12px]"
            placeholder="https://xxxxxxxx.supabase.co"
            spellCheck={false}
          />
        </Field>
        <Field label="Publishable / anon key">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="field field-lg font-mono text-[12px]"
            placeholder={t(L('sb_publishable_… или eyJhbGciOi…', 'sb_publishable_… or eyJhbGciOi…'))}
            spellCheck={false}
          />
        </Field>
        {error && <Banner tone="danger" text={error} />}
        <button
          className="btn btn-primary btn-lg w-full"
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

      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
        {t(
          L(
            'Адресът и publishable ключът са публични по замисъл — защитата е в правилата на базата.',
            'The URL and the publishable key are public by design — the protection lives in the database rules.',
          ),
        )}
        <b className="text-muted">
          {' '}
          {t(L('Тайният (secret) ключ никога не влиза тук.', 'The secret key never goes in here.'))}
        </b>
      </p>
    </Panel>
  );
}

/* ---------------------------------------------------------------- pieces */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Divider({ label }: { label: string }) {
  return <div className="divider-label my-5">{label}</div>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-medium"
        style={{ background: 'var(--c-surface-3)', color: 'var(--c-muted)' }}
      >
        {n}
      </span>
      <span className="flex-1 leading-relaxed">{children}</span>
    </li>
  );
}
