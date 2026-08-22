import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { submitChallenge, useBackupCode } from '@/services/cloud/mfa';
import { BRAND } from '@/brand';
import { L, useT } from '@/i18n';
import { PlauviaTile, PlauviaWordmark } from '../brand/Logo';
import { Icon } from '../Icon';

/**
 * The gate between a password and the account.
 *
 * A session that has proved a password but not the second factor is not a
 * session, so this stands in front of everything — not as a dialog over a
 * half-visible dashboard, which would suggest the dashboard is already
 * reachable.
 *
 * The way out is as prominent as the way through. Somebody standing here
 * without their phone is not an edge case; it is the reason backup codes
 * exist, and hiding that link behind a support e-mail is how people lose
 * accounts.
 */
export function MfaChallenge() {
  const t = useT();
  const email = useAuth((s) => s.user?.email);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), [backup]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    if (backup) {
      const result = await useBackupCode(code);
      setBusy(false);
      if (result === true) {
        // The factor is gone; the password alone now carries the session.
        useAuth.getState().clearMfaPending();
        return;
      }
      setError(typeof result === 'string' ? result : t(L('Кодът не е разпознат.', 'That code was not recognised.')));
      return;
    }
    const problem = await submitChallenge(code);
    setBusy(false);
    if (problem) {
      setError(problem);
      setCode('');
      return;
    }
    useAuth.getState().clearMfaPending();
  };

  const ready = backup ? code.replace(/\s|-/g, '').length >= 10 : code.replace(/\s/g, '').length === 6;

  return (
    <div className="grid h-full place-items-center overflow-y-auto px-5 py-10" style={{ background: 'var(--c-bg)' }}>
      <div className="w-full max-w-[380px]">
        <span className="flex items-center gap-2.5">
          <PlauviaTile size={34} title={BRAND.name} />
          <PlauviaWordmark size={17} />
        </span>

        <h1
          className="mt-7 font-semibold leading-[1.12]"
          style={{ fontSize: 'var(--text-title)', letterSpacing: 'var(--track-title)' }}
        >
          {t(backup ? L('Резервен код', 'Backup code') : L('Още една стъпка', 'One more step'))}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {backup
            ? t(
                L(
                  'Въведи един от кодовете, които записа при настройката. Всеки работи по веднъж и сваля двуфакторната защита, за да можеш да я настроиш наново.',
                  'Enter one of the codes you saved during setup. Each works once, and it switches the second factor off so you can set it up again.',
                ),
              )
            : t(
                L(
                  'Отвори приложението за кодове и въведи шестте цифри за Plauvia.',
                  'Open your authenticator app and enter the six digits for Plauvia.',
                ),
              )}
        </p>
        {email && <p className="mt-1 text-[12.5px] text-faint">{email}</p>}

        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !busy) void submit();
          }}
        >
          <input
            ref={input}
            className="field field-lg t-num text-center"
            style={{ fontSize: backup ? 17 : 24, letterSpacing: backup ? '0.14em' : '0.34em' }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={backup ? 'text' : 'numeric'}
            autoComplete={backup ? 'off' : 'one-time-code'}
            spellCheck={false}
            maxLength={backup ? 13 : 7}
            placeholder={backup ? 'ABCDE-FGHJK' : '000000'}
            aria-label={t(backup ? L('Резервен код', 'Backup code') : L('Код от приложението', 'Code from the app'))}
          />

          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-snug" style={{ color: 'var(--c-danger)' }}>
              <Icon name="alert" size={13} className="mt-px shrink-0" />
              {error}
            </p>
          )}

          <button className="btn btn-primary btn-lg mt-4 w-full" disabled={!ready || busy} type="submit">
            {busy && <Icon name="refresh" size={15} className="animate-spin" />}
            {t(L('Продължи', 'Continue'))}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-[12.5px]">
          <button
            className="cursor-pointer text-muted underline-offset-2 hover:underline"
            onClick={() => {
              setBackup(!backup);
              setCode('');
              setError(null);
            }}
          >
            {t(backup ? L('← Обратно към приложението', '← Back to the app code') : L('Нямам телефона си', "I do not have my phone"))}
          </button>
          <button
            className="cursor-pointer text-muted underline-offset-2 hover:underline"
            onClick={() => void useAuth.getState().signOut()}
          >
            {t(L('Излез', 'Sign out'))}
          </button>
        </div>
      </div>
    </div>
  );
}
