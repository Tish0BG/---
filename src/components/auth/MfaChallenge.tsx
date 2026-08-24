import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { submitChallenge, useBackupCode } from '@/services/cloud/mfa';
import { TRUST_DAYS } from '@/services/cloud/session';
import { L, useT } from '@/i18n';
import { AuthLayout, AuthNote, AuthPanel, AuthTitle } from './Shell';
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
  const [trust, setTrust] = useState(false);
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
    // Only a code that was accepted earns the device any trust.
    if (trust) useAuth.getState().trustDevice();
    useAuth.getState().clearMfaPending();
  };

  const ready = backup ? code.replace(/\s|-/g, '').length >= 10 : code.replace(/\s/g, '').length === 6;

  return (
    <AuthLayout>
      <AuthPanel>
        <AuthTitle
          icon={backup ? 'key' : 'shield'}
          title={t(backup ? L('Резервен код', 'Backup code') : L('Още една стъпка', 'One more step'))}
          hint={
            <>
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
              {email && <span className="mt-1 block text-faint">{email}</span>}
            </>
          }
        />

        <form
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
            <div className="mt-3">
              <AuthNote text={error} />
            </div>
          )}

          {/* Offered on the code path only. A backup code takes the second
              factor off altogether, so there is nothing left to remember. */}
          {!backup && (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px]">
              <input
                type="checkbox"
                checked={trust}
                onChange={(e) => setTrust(e.target.checked)}
                className="mt-[3px] h-[15px] w-[15px] shrink-0 cursor-pointer accent-[var(--c-accent)]"
              />
              <span>
                {t(L('Запомни това устройство', 'Remember this device'))}
                <span className="block text-[12px] text-muted">
                  {t(
                    L(
                      `Няма да питам за код на този браузър ${TRUST_DAYS} дни. Паролата остава задължителна.`,
                      `No code will be asked for in this browser for ${TRUST_DAYS} days. The password is still required.`,
                    ),
                  )}
                </span>
              </span>
            </label>
          )}

          <button className="btn btn-primary btn-lg mt-4 w-full" disabled={!ready || busy} type="submit">
            {busy && <Icon name="refresh" size={15} className="animate-spin" />}
            {t(L('Продължи', 'Continue'))}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-[12.5px]">
          <button
            className="link-quiet"
            onClick={() => {
              setBackup(!backup);
              setCode('');
              setError(null);
            }}
          >
            {t(
              backup
                ? L('← Обратно към приложението', '← Back to the app code')
                : L('Нямам телефона си', 'I do not have my phone'),
            )}
          </button>
          <button className="link-quiet" onClick={() => void useAuth.getState().signOut()}>
            {t(L('Излез', 'Sign out'))}
          </button>
        </div>
      </AuthPanel>
    </AuthLayout>
  );
}
