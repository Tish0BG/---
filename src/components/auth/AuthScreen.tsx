import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { useApp } from '@/state/appStore';
import { AuthLayout, AuthNote as Banner, AuthPanel as Panel, AuthTitle, AuthTitle as Title } from './Shell';
import { Icon } from '../Icon';
import { SETUP_SQL } from './schema';
import { useT, useLang, L } from '@/i18n';
import { GoogleButton, PasswordField } from './PasswordField';
import { RouteLink } from '../public/PublicChrome';
import { PUBLIC_ROUTES } from '@/seo/routes';

type Tab = 'signin' | 'signup';

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

  return (
    <AuthLayout onClose={onClose}>
      {awaiting ? <ConfirmStep email={awaiting} /> : configured ? <Forms onClose={onClose} /> : <Setup />}
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------ forms */

function Forms({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(() => useApp.getState().authMode);
  // The address says which half of the door is open, so switching halves has
  // to reach it: "create an account" is /register whether it was opened from
  // the button on the site or from the link at the bottom of this form.
  useEffect(() => {
    useApp.getState().setAuthMode(tab);
  }, [tab]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  /** true once a code has been sent and the form is waiting for it back */
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  /** sign in with a one-time code instead of a password */
  const [byCode, setByCode] = useState(false);
  const notice = useAuth((s) => s.notice);
  const user = useAuth((s) => s.user);
  const mfaPending = useAuth((s) => s.mfaPending);
  const emailTaken = useAuth((s) => s.emailTaken);
  const remember = useAuth((s) => s.remember);

  // Signing in is the whole point of this screen; once it happens, leave —
  // unless a second factor is still owed, in which case its own screen takes
  // over and this one must not close over the top of it.
  useEffect(() => {
    if (user && !mfaPending) onClose();
  }, [user, mfaPending, onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const store = useAuth.getState();

    // Second leg of either code journey: the code is in the box.
    if (codeSent) {
      const problem = await store.verifyCode(email, code, forgot ? 'recovery' : 'signin');
      setBusy(false);
      if (problem) {
        setError(problem);
        setCode('');
      }
      return;
    }

    const problem = forgot
      ? await store.resetPassword(email)
      : byCode
        ? await store.sendSignInCode(email)
        : tab === 'signin'
          ? await store.signIn(email, password)
          : await store.signUp(email, password, name);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    // Both the reset and the passwordless door now wait for six digits.
    if (forgot || byCode) setCodeSent(true);
  };

  /** Back to the beginning, whichever branch we wandered down. */
  const restart = () => {
    setCodeSent(false);
    setCode('');
    setError(null);
    useAuth.getState().clearNotice();
  };

  const mismatch = tab === 'signup' && !forgot && !byCode && confirm.length > 0 && confirm !== password;
  const needsPassword = !forgot && !byCode;
  const ready = codeSent
    ? emailCodeLooksComplete(code) && !busy
    : email.includes('@') &&
      (!needsPassword || password.length >= 8) &&
      (tab !== 'signup' || !needsPassword || confirm === password) &&
      !busy;

  const withGoogle = async () => {
    setGoogle(true);
    setError(null);
    const problem = await useAuth.getState().signInWithGoogle();
    // On success the tab is already on its way to Google, so there is nothing
    // to switch back; only a refusal comes back here.
    if (problem) {
      setGoogle(false);
      setError(problem);
    }
  };

  const title = codeSent
    ? L('Провери пощата си', 'Check your inbox')
    : forgot
      ? L('Нова парола', 'New password')
      : byCode
        ? L('Влез с код', 'Sign in with a code')
        : tab === 'signin'
          ? L('Влез в профила си', 'Welcome back')
          : L('Създай профил', 'Create an account');

  const hint = codeSent
    ? L(
        `Изпратихме код на ${email}. Валиден е за около час.`,
        `We sent a code to ${email}. It is good for about an hour.`,
      )
    : forgot
      ? L('Ще ти пратим код, с който да смениш паролата.', 'We will send you a code to set a new password with.')
      : byCode
        ? L('Без парола — код от пощата и си вътре.', 'No password — a code from your inbox and you are in.')
        : tab === 'signin'
          ? L('За да намериш библиотеката си и тук.', 'So your library is here too.')
          : L('Отнема минута и иска само имейл.', 'It takes a minute and asks for nothing but an e-mail.');

  return (
    <>
      <Panel>
        <Title title={t(title)} hint={t(hint)} />

        <form
          className="space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void submit();
          }}
        >
          {codeSent && (
            <>
              <input
                autoFocus
                className="field field-lg t-num text-center"
                // Tracking loosens for short codes and tightens for long ones, so
                // ten digits still fit the box instead of scrolling inside it.
                style={{
                  fontSize: code.replace(/\D/g, '').length > 7 ? 21 : 24,
                  letterSpacing: code.replace(/\D/g, '').length > 7 ? '0.2em' : '0.34em',
                }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                // Six is the common length, but it is a per-project setting and
                // can be anything up to ten. Hard-coding six meant an eight-digit
                // code could be typed and never submitted.
                maxLength={EMAIL_CODE_MAX}
                placeholder="······"
                aria-label={t(L('Код от пощата', 'Code from your inbox'))}
              />
              <button type="button" className="link-quiet text-[12.5px]" onClick={restart}>
                {t(L('← Друг адрес, или нов код', '← A different address, or a new code'))}
              </button>
            </>
          )}

          {!codeSent && tab === 'signup' && needsPassword && (
            <Field label={t(L('Име', 'Name'))}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field field-lg"
                placeholder={t(L('Как да ти казвам', 'What should we call you'))}
                autoComplete="name"
              />
            </Field>
          )}

          {!codeSent && (
            <Field label={t(L('Имейл', 'E-mail'))}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                <label htmlFor="plauvia-password" className="t-label">
                  {t(L('Парола', 'Password'))}
                </label>
                {tab === 'signin' && (
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
                )}
              </div>
              <PasswordField
                id="plauvia-password"
                value={password}
                onChange={setPassword}
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                placeholder={t(L('Поне 8 знака', 'At least 8 characters'))}
                showMeter={tab === 'signup'}
              />
            </div>
          )}

          {!codeSent && tab === 'signup' && needsPassword && (
            <div>
              <PasswordField
                id="plauvia-confirm"
                label={t(L('Повтори паролата', 'Repeat the password'))}
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
              {mismatch && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--c-danger)' }}>
                  <Icon name="alert" size={12} />
                  {t(L('Двете полета не съвпадат.', 'The two do not match.'))}
                </p>
              )}
            </div>
          )}

          {/* Whether the sign-in survives closing the browser.
              On by default, because the great majority are on their own
              device — and off is the answer that matters on the computer in a
              school library, which is why it is a visible choice and not a
              setting three menus deep. */}
          {!codeSent && tab === 'signin' && (
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

          {/* An answer with nothing to do next is only half an answer. */}
          {emailTaken && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setTab('signin');
                  setError(null);
                  setPassword('');
                  setConfirm('');
                }}
              >
                {t(L('Влез с този имейл', 'Sign in with this e-mail'))}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setForgot(true);
                  setError(null);
                }}
              >
                {t(L('Забравена парола', 'Forgotten password'))}
              </button>
            </div>
          )}
          {notice && <Banner tone="ok" text={notice} />}

          <button className="btn btn-primary btn-lg w-full" disabled={!ready} type="submit">
            {busy && <Icon name="refresh" size={15} className="animate-spin" />}
            {t(
              codeSent
                ? L('Потвърди', 'Confirm')
                : forgot || byCode
                  ? L('Изпрати код', 'Send the code')
                  : tab === 'signin'
                    ? L('Влез', 'Sign in')
                    : L('Създай профил', 'Create the account'),
            )}
          </button>
        </form>

        {!forgot && !codeSent && (
          <>
            <Divider label={t(L('или', 'or'))} />
            <GoogleButton
              onClick={() => void withGoogle()}
              busy={google}
              label={t(L('Продължи с Google', 'Continue with Google'))}
            />
            {tab === 'signin' && (
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
            )}
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

        {tab === 'signup' && needsPassword && !codeSent && <TermsNote />}
      </Panel>

      {/* -------------------------------------------------------- switch */}

      {!codeSent && !forgot && (
        <p className="mt-5 text-center text-[13px] text-muted">
          {t(tab === 'signin' ? L('Нямаш профил?', 'No account yet?') : L('Вече имаш профил?', 'Already have one?'))}{' '}
          <button
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--c-accent)' }}
            onClick={() => {
              setTab(tab === 'signin' ? 'signup' : 'signin');
              setByCode(false);
              setError(null);
            }}
          >
            {t(tab === 'signin' ? L('Създай профил', 'Create one') : L('Влез', 'Sign in'))}
          </button>
        </p>
      )}

    </>
  );
}

/* ------------------------------------------------------------ confirm step */

/**
 * The step after signing up, when the project asks for a confirmed address.
 *
 * It used to say "open the link in the e-mail" and offer nothing but a resend
 * button — which was true while the templates sent links. They send a code
 * now, so this is where the code goes in. A screen that describes a letter the
 * person is not holding is worse than no screen at all.
 */
function ConfirmStep({ email }: { email: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const notice = useAuth((s) => s.notice);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const problem = await useAuth.getState().verifyCode(email, code, 'signup');
    setBusy(false);
    if (problem) {
      setMessage(problem);
      setCode('');
    }
  };

  return (
    <Panel>
      <AuthTitle
        icon="send"
        title={t(L('Провери пощата си', 'Check your inbox'))}
        hint={t(
          L(
            `Изпратихме код на ${email}. Въведи го, за да активираш профила си.`,
            `We sent a code to ${email}. Enter it to activate your account.`,
          ),
        )}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (emailCodeLooksComplete(code) && !busy) void submit();
        }}
      >
        <input
          autoFocus
          className="field field-lg t-num text-center"
          style={{
            fontSize: code.replace(/\D/g, '').length > 7 ? 21 : 24,
            letterSpacing: code.replace(/\D/g, '').length > 7 ? '0.2em' : '0.34em',
          }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={EMAIL_CODE_MAX}
          placeholder="······"
          aria-label={t(L('Код от пощата', 'Code from your inbox'))}
        />
        <button
          className="btn btn-primary btn-lg mt-3 w-full"
          type="submit"
          disabled={!emailCodeLooksComplete(code) || busy}
        >
          {busy && <Icon name="refresh" size={15} className="animate-spin" />}
          {t(L('Потвърди профила', 'Confirm the account'))}
        </button>
      </form>

      <div className="mt-2 space-y-2">
        <button
          className="btn btn-lg w-full"
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
          {t(L('Изпрати нов код', 'Send a new code'))}
        </button>
        <button className="link-quiet block w-full text-[12.5px]" onClick={() => useAuth.getState().clearNotice()}>
          {t(L('Назад към входа', 'Back to sign in'))}
        </button>
      </div>

      {(message || notice) && (
        <p className="mt-3 text-[12px]" style={{ color: message ? 'var(--c-danger)' : 'var(--c-success)' }}>
          {message ?? notice}
        </p>
      )}

      <p className="mt-5 text-[12px] leading-relaxed text-faint">
        {t(
          L(
            'Не идва ли? Провери и в спама. Писмото тръгва веднага, но понякога се бави минута-две.',
            'Not arriving? Check your spam folder too. It is sent immediately, but sometimes takes a minute or two.',
          ),
        )}
      </p>
    </Panel>
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
      <span className="t-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1" style={{ background: 'var(--c-line)' }} />
      <span className="text-[12px] text-faint">{label}</span>
      <span className="h-px flex-1" style={{ background: 'var(--c-line)' }} />
    </div>
  );
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

/**
 * The line that has to be on a sign-up form and nowhere else.
 *
 * Not a checkbox: a tick box that everybody ticks without reading is a dark
 * pattern dressed as consent. A sentence with two links, shown at the moment
 * the account is created, is the honest version of the same thing.
 */
function TermsNote() {
  const t = useT();
  const lang = useLang();
  const terms = PUBLIC_ROUTES.find((r) => r.id === 'terms')!;
  const privacy = PUBLIC_ROUTES.find((r) => r.id === 'privacy')!;
  return (
    <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
      {t(L('Като създадеш профил, приемаш', 'By creating an account you accept the'))}{' '}
      <RouteLink to={terms.path} className="underline underline-offset-2 hover:text-muted">
        {terms.label[lang]}
      </RouteLink>{' '}
      {t(L('и', 'and the'))}{' '}
      <RouteLink to={privacy.path} className="underline underline-offset-2 hover:text-muted">
        {privacy.label[lang]}
      </RouteLink>
      .
    </p>
  );
}
