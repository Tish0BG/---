import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import {
  backupCodesLeft,
  confirmEnrol,
  disableMfa,
  generateBackupCodes,
  listFactors,
  securityLog,
  startEnrol,
  type EnrolStart,
  type SecurityEvent,
} from '@/services/cloud/mfa';
import { downloadBlob } from '@/lib/util';
import { L, useLang, useT, formatDate, type Msg } from '@/i18n';
import { Icon } from '../Icon';
import { Button } from '../kit';

/**
 * Settings → Security.
 *
 * Three things a person should be able to see and change about their own
 * account without writing to anybody: whether a second factor is on, whether
 * there is a way back in if the phone is lost, and what has recently happened
 * to the account.
 *
 * The last one is not decoration. "Signed in from a new device, Tuesday
 * 14:12" is how somebody finds out their password has leaked, and it is
 * written by a database trigger rather than by this app, so a session that has
 * no business being there cannot decline to mention itself.
 */

const EVENT_LABEL: Record<string, Msg> = {
  signin: L('Влизане в профила', 'Signed in'),
  password_changed: L('Сменена парола', 'Password changed'),
  mfa_enabled: L('Включена двуфакторна защита', 'Two-factor turned on'),
  mfa_disabled: L('Изключена двуфакторна защита', 'Two-factor turned off'),
  backup_code_used: L('Използван резервен код', 'Backup code used'),
  backup_codes_generated: L('Издадени нови резервни кодове', 'New backup codes issued'),
  email_changed: L('Сменен имейл', 'E-mail changed'),
  sessions_revoked: L('Излизане от другите устройства', 'Other devices signed out'),
  account_deleted: L('Изтрит профил', 'Account deleted'),
};

const EVENT_ICON: Record<string, string> = {
  signin: 'logIn',
  password_changed: 'lock',
  mfa_enabled: 'shield',
  mfa_disabled: 'alert',
  backup_code_used: 'key',
  backup_codes_generated: 'key',
  sessions_revoked: 'logOut',
};

export function SecuritySection() {
  const t = useT();
  const lang = useLang();
  const user = useAuth((s) => s.user);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [codesLeft, setCodesLeft] = useState(0);
  const [log, setLog] = useState<SecurityEvent[]>([]);
  const [enrol, setEnrol] = useState<EnrolStart | null>(null);
  const [code, setCode] = useState('');
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const factors = await listFactors();
    setEnabled(factors.some((f) => f.status === 'verified'));
    setCodesLeft(await backupCodesLeft());
    setLog(await securityLog(12));
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  if (!user) {
    return (
      <p className="text-[13px] leading-relaxed text-muted">
        {t(
          L(
            'Тези настройки се появяват, щом влезеш в профил. Без профил няма какво да се защитава — данните не напускат устройството ти.',
            'These settings appear once you sign in. Without an account there is nothing to protect — the data never leaves your device.',
          ),
        )}
      </p>
    );
  }

  const begin = async () => {
    setBusy(true);
    setError(null);
    const result = await startEnrol();
    setBusy(false);
    if (typeof result === 'string') return setError(result);
    setEnrol(result);
  };

  const finish = async () => {
    if (!enrol) return;
    setBusy(true);
    setError(null);
    const problem = await confirmEnrol(enrol.factorId, code);
    setBusy(false);
    if (problem) return setError(problem);
    setEnrol(null);
    setCode('');
    // A second factor with no way past it is a lock with the key inside.
    const codes = await generateBackupCodes();
    if (Array.isArray(codes)) setFreshCodes(codes);
    await refresh();
  };

  const turnOff = async () => {
    setBusy(true);
    setError(null);
    const problem = await disableMfa();
    setBusy(false);
    if (problem) return setError(problem);
    await refresh();
  };

  const newCodes = async () => {
    setBusy(true);
    setError(null);
    const codes = await generateBackupCodes();
    setBusy(false);
    if (!Array.isArray(codes)) return setError(codes);
    setFreshCodes(codes);
    await refresh();
  };

  return (
    <div className="space-y-7">
      {error && (
        <p className="flex items-start gap-1.5 text-[12.5px] leading-snug" style={{ color: 'var(--c-danger)' }}>
          <Icon name="alert" size={13} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      {/* ------------------------------------------------ second factor */}
      <section>
        <h3 className="t-label mb-2">{t(L('Двуфакторна защита', 'Two-factor authentication'))}</h3>

        {enrol ? (
          <div className="card p-4">
            <p className="text-[13px] leading-relaxed text-muted">
              {t(
                L(
                  'Сканирай кода с приложение за кодове — Google Authenticator, 1Password, каквото ползваш — и въведи шестте цифри, които показва.',
                  'Scan this with an authenticator app — Google Authenticator, 1Password, whichever you use — and type the six digits it shows.',
                ),
              )}
            </p>
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <img
                src={enrol.qr}
                width={168}
                height={168}
                alt={t(L('QR код за приложението', 'QR code for the authenticator app'))}
                className="shrink-0 rounded-[10px]"
                style={{ background: '#fff', padding: 8 }}
              />
              <div className="min-w-0 flex-1">
                <p className="t-label mb-1.5">{t(L('Или въведи ръчно', 'Or type it in by hand'))}</p>
                <code className="block break-all rounded-[8px] px-2.5 py-2 text-[12px]" style={{ background: 'var(--c-surface-2)' }}>
                  {enrol.secret}
                </code>
                <input
                  className="field field-lg t-num mt-3 text-center"
                  style={{ fontSize: 20, letterSpacing: '0.3em' }}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="000000"
                  aria-label={t(L('Код от приложението', 'Code from the app'))}
                  onKeyDown={(e) => e.key === 'Enter' && code.length >= 6 && void finish()}
                />
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" busy={busy} disabled={code.replace(/\s/g, '').length !== 6} onClick={() => void finish()}>
                    {t(L('Включи', 'Turn it on'))}
                  </Button>
                  <Button onClick={() => { setEnrol(null); setCode(''); setError(null); }}>
                    {t(L('Откажи', 'Cancel'))}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
              style={{
                background: enabled ? 'var(--c-success-soft)' : 'var(--c-surface-3)',
                color: enabled ? 'var(--c-success)' : 'var(--c-faint)',
              }}
            >
              <Icon name={enabled ? 'shield' : 'lock'} size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">
                {enabled === null
                  ? t(L('Проверява се…', 'Checking…'))
                  : enabled
                    ? t(L('Включена', 'On'))
                    : t(L('Изключена', 'Off'))}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                {enabled
                  ? t(L('При влизане се иска код от приложението.', 'Signing in asks for a code from your app.'))
                  : t(
                      L(
                        'Код от приложение на телефона ти, освен паролата. Паролата може да изтече от чужд сайт; кодът — не.',
                        'A code from an app on your phone, on top of the password. A password can leak from someone else’s site; the code cannot.',
                      ),
                    )}
              </p>
            </div>
            {enabled ? (
              <Button busy={busy} onClick={() => void turnOff()}>
                {t(L('Изключи', 'Turn off'))}
              </Button>
            ) : (
              <Button variant="primary" busy={busy} onClick={() => void begin()}>
                {t(L('Включи', 'Turn on'))}
              </Button>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------- backup codes */}
      {(enabled || codesLeft > 0) && (
        <section>
          <h3 className="t-label mb-2">{t(L('Резервни кодове', 'Backup codes'))}</h3>
          {freshCodes ? (
            <div
              className="rounded-[var(--radius-lg)] p-4"
              style={{ background: 'var(--c-warn-soft)', border: '1px solid color-mix(in srgb, var(--c-warn) 34%, transparent)' }}
            >
              <p className="text-[13px] font-medium" style={{ color: 'var(--c-warn)' }}>
                {t(L('Запиши ги сега — показват се само този път.', 'Save these now — this is the only time they are shown.'))}
              </p>
              <ul className="t-num mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px]">
                {freshCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  icon="download"
                  onClick={() =>
                    downloadBlob(
                      new Blob([`Plauvia — ${t(L('резервни кодове', 'backup codes'))}\n\n${freshCodes.join('\n')}\n`], {
                        type: 'text/plain',
                      }),
                      'plauvia-backup-codes.txt',
                    )
                  }
                >
                  {t(L('Свали като файл', 'Download as a file'))}
                </Button>
                <Button icon="copy" onClick={() => void navigator.clipboard.writeText(freshCodes.join('\n'))}>
                  {t(L('Копирай', 'Copy'))}
                </Button>
                <Button variant="primary" onClick={() => setFreshCodes(null)}>
                  {t(L('Записах ги', 'I have saved them'))}
                </Button>
              </div>
            </div>
          ) : (
            <div className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">
                  {t(L(`Остават ${codesLeft} от 10`, `${codesLeft} of 10 left`))}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {t(
                    L(
                      'Всеки работи по веднъж и е пътят обратно, ако телефонът го няма. Издаването на нови обезсилва старите.',
                      'Each works once, and they are the way back if the phone is gone. Issuing new ones voids the old.',
                    ),
                  )}
                </p>
              </div>
              <Button busy={busy} onClick={() => void newCodes()}>
                {t(codesLeft > 0 ? L('Издай нови', 'Issue new ones') : L('Издай кодове', 'Issue codes'))}
              </Button>
            </div>
          )}
        </section>
      )}

      {/* -------------------------------------------------------- the log */}
      <section>
        <h3 className="t-label mb-2">{t(L('Скорошна дейност', 'Recent activity'))}</h3>
        {log.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-muted">
            {t(
              L(
                'Още няма записи. Ако тук е празно и след влизане, скриптът supabase/security.sql не е пуснат.',
                'Nothing recorded yet. If this stays empty after signing in, supabase/security.sql has not been run.',
              ),
            )}
          </p>
        ) : (
          <ul className="card-quiet divide-y" style={{ borderColor: 'var(--c-line)' }}>
            {log.map((event) => (
              <li key={event.id} className="flex items-start gap-3 px-3.5 py-2.5">
                <Icon
                  name={EVENT_ICON[event.kind] ?? 'info'}
                  size={15}
                  className="mt-0.5 shrink-0"
                  style={{ color: event.kind === 'mfa_disabled' ? 'var(--c-warn)' : 'var(--c-faint)' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">
                    {t(EVENT_LABEL[event.kind] ?? L(event.kind, event.kind))}
                  </span>
                  {event.userAgent && (
                    <span className="block truncate text-[11.5px] text-faint">{shortAgent(event.userAgent)}</span>
                  )}
                </span>
                <span className="t-num shrink-0 text-[11.5px] text-faint">
                  {formatDate(Date.parse(event.at), lang, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          {t(
            L(
              'Влизанията се записват от самата база, не от приложението — затова един чужд вход не може да се скрие. Пази се 90 дни.',
              'Sign-ins are recorded by the database itself, not by the app — which is why an intruder’s cannot be hidden. Kept for 90 days.',
            ),
          )}
        </p>
      </section>
    </div>
  );
}

/** "Chrome · macOS" out of the usual wall of tokens. */
function shortAgent(ua: string): string {
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : null;
  const os =
    /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : null;
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 40);
}
