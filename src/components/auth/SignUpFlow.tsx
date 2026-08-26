import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { useApp } from '@/state/appStore';
import { L, useLang, useT } from '@/i18n';
import { AuthNote, AuthPanel as Panel, SignUpProgress } from './Shell';
import { CodeInput, ResendButton } from './CodeInput';
import { GoogleButton, PasswordField } from './PasswordField';
import { Icon } from '../Icon';
import { RouteLink } from '../public/PublicChrome';
import { PUBLIC_ROUTES } from '@/seo/routes';
import { clearPendingSignUp, markPendingSignUp, readPendingSignUp } from '@/state/signupHandoff';

/**
 * ───────────────────────────────────────────────────────── creating an account ──
 *
 * Two screens before the session exists, two after it: an address and a
 * password, the code that proves the address, then a name and a face.
 *
 * It used to be one form asking for a name, an address, a password and the
 * password again, followed by a code box. Putting the name on that form was
 * the mistake worth naming: it is the one field on it that cannot fail, that
 * nothing depends on, and that the app can perfectly well infer from the
 * address — so it was four fields of friction where three would do, standing
 * between somebody and the only thing they came here to do.
 *
 * The two halves live in different components because the session lands
 * between them and the app re-renders around it. `ProfileSetup` picks the
 * journey back up on the other side; the progress rail is shared so that the
 * seam does not show.
 */

export function SignUpFlow() {
  const awaiting = useAuth((s) => s.awaitingConfirm);
  const [email, setEmail] = useState(() => readPendingSignUp() ?? '');
  const [sentAt, setSentAt] = useState(() => Date.now());

  // The store is the authority while the tab lives; the stored address is only
  // there to answer for it after a reload.
  const address = awaiting ?? (readPendingSignUp() || '');
  const verifying = !!address;

  return verifying ? (
    <VerifyStep
      email={address}
      sentAt={sentAt}
      onResent={() => setSentAt(Date.now())}
      onBack={() => {
        clearPendingSignUp();
        useAuth.getState().clearNotice();
      }}
    />
  ) : (
    <AccountStep
      email={email}
      setEmail={setEmail}
      onSent={() => {
        markPendingSignUp(email.trim());
        setSentAt(Date.now());
      }}
    />
  );
}

/* ------------------------------------------------------------------ step 1 */

function AccountStep({
  email,
  setEmail,
  onSent,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSent: () => void;
}) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailTaken = useAuth((s) => s.emailTaken);

  const mismatch = confirm.length > 0 && confirm !== password;

  /**
   * What is missing, in one sentence, or null when nothing is.
   *
   * The button stays pressable throughout and answers when it is pressed. A
   * greyed-out button is the worst error message there is: it says no and
   * refuses to say why, and here the why is always one of three small things.
   */
  const problem = (): string | null => {
    if (!email.trim()) return t(L('Трябва имейл адрес.', 'An e-mail address is needed.'));
    if (!/.+@.+\..+/.test(email.trim()))
      return t(L('Този имейл не изглежда пълен.', 'That e-mail does not look complete.'));
    if (password.length < 8)
      return t(L('Паролата трябва да е поне 8 знака.', 'The password has to be at least 8 characters.'));
    if (confirm !== password)
      return t(L('Двете полета за парола не съвпадат.', 'The two password fields do not match.'));
    return null;
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    // The name is no longer asked for here; `adoptAccount` derives a greeting
    // from the address, and the workspace setup asks properly later.
    const refusal = await useAuth.getState().signUp(email.trim(), password, '');
    setBusy(false);
    if (refusal) {
      setError(refusal);
      return;
    }
    onSent();
  };

  const withGoogle = async () => {
    setGoogle(true);
    setError(null);
    const refusal = await useAuth.getState().signInWithGoogle();
    if (refusal) {
      setGoogle(false);
      setError(refusal);
    }
  };

  return (
    <>
      <Panel>
        <SignUpProgress step={0} />

        <h1 className="t-face mt-5 text-[clamp(22px,2.4vw,27px)] leading-[1.08] tracking-[-0.028em]">
          {t(L('Създай профил', 'Create your account'))}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {t(L('Имейл и парола. Нищо повече засега.', 'An e-mail and a password. Nothing more for now.'))}
        </p>

        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const missing = problem();
            if (missing) {
              setError(missing);
              return;
            }
            if (!busy) void submit();
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-muted">
              {t(L('Имейл', 'E-mail'))}
            </span>
            <input
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              className="field field-lg"
              type="email"
              placeholder="ime@example.com"
              autoComplete="email"
            />
          </label>

          <PasswordField
            id="plauvia-new-password"
            label={t(L('Парола', 'Password'))}
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (error) setError(null);
            }}
            autoComplete="new-password"
            placeholder={t(L('Поне 8 знака', 'At least 8 characters'))}
            showMeter
          />

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

          {error && <AuthNote tone="danger" text={error} />}

          {/* An answer with nothing to do next is only half an answer. */}
          {emailTaken && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => useApp.getState().setAuthMode('signin')}
              >
                {t(L('Влез с този имейл', 'Sign in with this e-mail'))}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void useAuth.getState().resetPassword(email.trim())}
              >
                {t(L('Забравена парола', 'Forgotten password'))}
              </button>
            </div>
          )}

          <button className="btn btn-primary btn-lg w-full" disabled={busy} type="submit">
            {busy && <Icon name="refresh" size={15} className="animate-spin" />}
            {t(L('Продължи', 'Continue'))}
          </button>
        </form>

        <div className="divider-label my-5">{t(L('или', 'or'))}</div>
        <GoogleButton
          onClick={() => void withGoogle()}
          busy={google}
          label={t(L('Продължи с Google', 'Continue with Google'))}
        />

        <TermsNote />
      </Panel>

      <p className="mt-6 text-center text-[13px] text-muted">
        {t(L('Вече имаш профил?', 'Already have one?'))}{' '}
        <button
          className="font-medium underline-offset-2 hover:underline"
          style={{ color: 'var(--c-accent)' }}
          onClick={() => useApp.getState().setAuthMode('signin')}
        >
          {t(L('Влез', 'Sign in'))}
        </button>
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ step 2 */

function VerifyStep({
  email,
  sentAt,
  onResent,
  onBack,
}: {
  email: string;
  sentAt: number;
  onResent: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notice = useAuth((s) => s.notice);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    const refusal = await useAuth.getState().verifyCode(email, value, 'signup');
    setBusy(false);
    if (refusal) {
      setError(refusal);
      setCode('');
      return;
    }
    // On success the session lands and the app re-renders around this screen;
    // `ProfileSetup` takes the journey from here. Nothing to do but stop.
  };

  // Six digits in the boxes and nothing else to decide: submitting is what the
  // person came here to do, and making them find a button afterwards is a step
  // that exists only because the form was built that way.
  useEffect(() => {
    if (code.length === 6 && !busy && !error) void submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <Panel>
      <SignUpProgress step={1} />

      <span className="tile mb-4 mt-5">
        <Icon name="mail" size={19} />
      </span>
      <h1 className="t-face text-[clamp(22px,2.4vw,27px)] leading-[1.08] tracking-[-0.028em]">
        {t(L('Провери пощата си', 'Check your inbox'))}
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        {t(L('Изпратихме код на', 'We sent a code to'))}{' '}
        <b className="font-medium text-ink">{email}</b>
        {t(L('. Валиден е около час.', '. It is good for about an hour.'))}
      </p>

      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && code.length >= 6) void submit(code);
        }}
      >
        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (error) setError(null);
          }}
          invalid={!!error}
          disabled={busy}
          label={t(L('Код от пощата', 'Code from your inbox'))}
        />

        {error && (
          <div className="mt-4">
            <AuthNote tone="danger" text={error} />
          </div>
        )}
        {!error && notice && (
          <div className="mt-4">
            <AuthNote tone="ok" text={notice} />
          </div>
        )}

        <button
          className="btn btn-primary btn-lg mt-4 w-full"
          type="submit"
          disabled={busy || code.length < 6}
        >
          {busy && <Icon name="refresh" size={15} className="animate-spin" />}
          {t(busy ? L('Проверяваме…', 'Checking…') : L('Потвърди', 'Confirm'))}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        <ResendButton
          startedAt={sentAt}
          busy={resending}
          onResend={() => {
            setResending(true);
            setError(null);
            void useAuth
              .getState()
              .resendConfirmation(email)
              .then((refusal) => {
                setResending(false);
                if (refusal) setError(refusal);
                else onResent();
              });
          }}
        />
        <button type="button" className="link-quiet mx-auto block text-[12.5px]" onClick={onBack}>
          {t(L('← Друг имейл адрес', '← Use a different address'))}
        </button>
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed text-faint">
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

/* ---------------------------------------------------------------- pieces */

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
