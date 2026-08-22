import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { cloudConfig } from '@/services/cloud/config';
import { formatBytes, formatDate } from '@/lib/util';
import { Modal, Toggle, useConfirm } from '../ui';
import { Icon } from '../Icon';
import { PasswordField } from './PasswordField';
import { notify } from '@/state/toastStore';
import { AuthScreen } from './AuthScreen';
import { ConnectionCheck } from './ConnectionCheck';
import { useT, L } from '@/i18n';
import { S } from '@/i18n/strings';

/**
 * Everything about the account in one place: connect a backend, sign in or
 * register, then watch the library travel between devices.
 *
 * The app works fully without any of it — an account only adds the second
 * device, which is why nothing here is ever forced on the user.
 */
/**
 * Account management for someone who is already signed in.
 *
 * Signing in itself is not a dialog — it is {@link AuthScreen}, a whole page.
 * A modal floating over a half-visible dashboard reads like a detour; an
 * account is not a detour.
 */
export function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const user = useAuth((s) => s.user);

  if (!open) return null;
  if (!user) return <AuthScreen onClose={onClose} />;

  return (
    <Modal open onClose={onClose} width={520} title={t(L('Профил в облака', 'Cloud account'))}>
      <AccountPanel onClose={onClose} />
    </Modal>
  );
}

/* ------------------------------------------------------------- account */

function AccountPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const user = useAuth((s) => s.user);
  const sync = useAuth((s) => s.sync);
  const autoSync = useAuth((s) => s.autoSync);
  const pending = useAuth((s) => s.pendingFiles);
  const notice = useAuth((s) => s.notice);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ records: number; files: number; bytes: number } | null>(null);
  const [danger, setDanger] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const { confirm, element } = useConfirm();

  useEffect(() => {
    void useAuth.getState().refreshPending();
    void useAuth.getState().usage().then(setUsage);
  }, []);

  const syncing =
    sync.phase === 'pulling' || sync.phase === 'pushing' || sync.phase === 'files' || sync.phase === 'checking';

  return (
    <div className="space-y-5">
      {element}

      <div className="flex items-center gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
          style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
        >
          <Icon name="cloud" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{user?.email}</div>
          <div className="text-[11px] text-muted">
            {sync.lastSyncAt
              ? t(L(`Последна синхронизация ${formatDate(sync.lastSyncAt)}`, `Last sync ${formatDate(sync.lastSyncAt)}`))
              : t(L('Още не е синхронизирано', 'Not synced yet'))}
          </div>
        </div>
        <button className="btn btn-primary" disabled={syncing} onClick={() => void useAuth.getState().syncNow()}>
          <Icon name="refresh" size={14} className={syncing ? 'animate-spin' : ''} />
          {t(L('Синхронизирай', 'Sync now'))}
        </button>
      </div>

      <SyncStatus />

      {usage && (
        <div className="grid grid-cols-3 gap-1.5">
          <Metric value={String(usage.records)} label={t(L('записа', 'records'))} />
          <Metric value={String(usage.files)} label={t(L('файла', 'files'))} />
          <Metric value={formatBytes(usage.bytes)} label={t(L('в облака', 'in the cloud'))} />
        </div>
      )}

      <div className="panel p-3">
        <Toggle
          checked={autoSync}
          onChange={(v) => useAuth.getState().setAutoSync(v)}
          label={t(L('Автоматична синхронизация', 'Automatic sync'))}
          hint={t(L('На всеки 5 минути и когато затваряш приложението.', 'Every five minutes, and when you close the app.'))}
        />
        {pending > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
            <Icon name="upload" size={12} />
            {t(L(`${pending} файла чакат да бъдат качени.`, `${pending} files are waiting to upload.`))}
          </p>
        )}
      </div>

      <section>
        <h3 className="t-label mb-2">{t(L('Смяна на парола', 'Change password'))}</h3>
        <PasswordField
          id="plauvia-new-password"
          value={pw}
          onChange={setPw}
          autoComplete="new-password"
          placeholder={t(L('Нова парола', 'New password'))}
          showMeter
        />
        <button
          className="btn btn-outline mt-2.5"
          disabled={pw.length < 8}
          onClick={() =>
            void useAuth
              .getState()
              .changePassword(pw)
              .then((err) => {
                setPwMsg(err);
                if (!err) setPw('');
              })
          }
        >
          {t(L('Смени паролата', 'Change the password'))}
        </button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          {t(
            L(
              'Смяната изважда всички други устройства от профила. Това е и начинът да изгониш някого, който не би трябвало да е вътре.',
              'Changing it signs every other device out. That is also how you remove somebody who should not be in there.',
            ),
          )}
        </p>
        {(pwMsg || notice) && (
          <p className="mt-1.5 text-[11px]" style={{ color: pwMsg ? 'var(--c-danger)' : 'var(--c-muted)' }}>
            {pwMsg ?? notice}
          </p>
        )}
      </section>

      <div className="border-t border-line pt-3">
        <ConnectionCheck />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button
          className="btn btn-outline"
          onClick={() => {
            void useAuth.getState().signOut();
            onClose();
          }}
        >
          <Icon name="logOut" size={14} />
          {t(L('Излез', 'Sign out'))}
        </button>
        <button
          className="btn btn-outline"
          onClick={() =>
            confirm(
              t(
                L(
                  'Всички други устройства ще излязат от профила. Този браузър остава вътре. Сигурен ли си?',
                  'Every other device will be signed out. This browser stays in. Are you sure?',
                ),
              ),
              () => void useAuth.getState().signOutOthers(),
            )
          }
        >
          <Icon name="shield" size={14} />
          {t(L('Излез от другите устройства', 'Sign out other devices'))}
        </button>
        <button
          className="btn"
          style={{ color: 'var(--c-warn)' }}
          onClick={() =>
            confirm(
              t(L('Това изтрива всичко от облака, но оставя данните на това устройство. При следваща синхронизация те ще се качат отново. Сигурен ли си?', 'This wipes everything from the cloud but leaves the data on this device — the next sync uploads it again. Are you sure?')),
              () => void useAuth.getState().wipeRemote(),
            )
          }
        >
          <Icon name="archive" size={14} />
          {t(L('Изчисти облака', 'Clear the cloud'))}
        </button>
        <ConnectionLine className="ml-auto self-center" />
      </div>

      {/* Deleting the account is irreversible and must not sit one stray tap
          away from "sign out" — hence its own drawer and a typed word. */}
      <details
        className="rounded-xl px-3 py-2"
        style={{ background: 'var(--c-danger-soft)' }}
        open={danger}
        onToggle={(e) => setDanger((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-[12px] font-medium" style={{ color: 'var(--c-danger)' }}>
          {t(L('Изтриване на профила', 'Delete the account'))}
        </summary>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          {t(
            L(
              'Профилът, всички качени файлове и всичко в облака изчезват безвъзвратно. Данните на това устройство остават. Напиши ИЗТРИЙ, за да потвърдиш.',
              'The account, every uploaded file and everything in the cloud disappear for good. The data on this device stays. Type DELETE to confirm.',
            ),
          )}
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t(L('ИЗТРИЙ', 'DELETE'))}
            className="field"
          />
          <button
            className="btn btn-danger shrink-0"
            disabled={!['ИЗТРИЙ', 'DELETE'].includes(confirmText.trim().toUpperCase()) || busy}
            onClick={() => {
              setBusy(true);
              void useAuth
                .getState()
                .removeAccount()
                .then((err) => {
                  setBusy(false);
                  if (err) notify.error(t(L('Профилът не беше изтрит', 'The account was not deleted')), err);
                  else onClose();
                });
            }}
          >
            {busy && <Icon name="refresh" size={14} className="animate-spin" />}
            {t(S.delete)}
          </button>
        </div>
      </details>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl py-2 text-center" style={{ background: 'var(--c-surface-2)' }}>
      <div className="text-[15px] font-medium leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[10.5px] text-muted">{label}</div>
    </div>
  );
}

/** Live read-out of the sync engine: what it is doing and how it ended. */
export function SyncStatus() {
  const t = useT();
  const sync = useAuth((s) => s.sync);
  if (sync.phase === 'idle') return null;

  if (sync.phase === 'error') {
    return <Banner tone="danger" text={sync.error ?? t(L('Синхронизацията се провали.', 'The sync failed.'))} />;
  }
  if (sync.phase === 'done') {
    return <Banner tone="ok" text={sync.label || t(L('Всичко е синхронизирано', 'Everything is in sync'))} />;
  }
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 text-[12px]">
        <Icon name="refresh" size={14} className="animate-spin text-accent" />
        <span className="flex-1 truncate">{sync.label}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: sync.progress === null ? '35%' : `${Math.round(sync.progress * 100)}%`,
            background: 'var(--c-accent)',
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- pieces */

function Banner({ tone, text }: { tone: 'danger' | 'ok'; text: string }) {
  const color = tone === 'danger' ? 'var(--c-danger)' : 'var(--c-success)';
  return (
    <p
      className="flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[12px] leading-snug"
      style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
    >
      <Icon name={tone === 'danger' ? 'alert' : 'checkCircle'} size={13} className="mt-px shrink-0" />
      {text}
    </p>
  );
}

/** Which project this browser talks to, and a way out of it. */
function ConnectionLine({ className = '' }: { className?: string }) {
  const t = useT();
  const fixed = useAuth((s) => s.fixed);
  const cfg = cloudConfig();
  if (!cfg || fixed) return null;
  const host = cfg.url.replace(/^https?:\/\//, '').split('.')[0];
  return (
    <span className={`flex items-center gap-1.5 text-[11px] text-faint ${className}`}>
      <Icon name="cloud" size={12} />
      {host}
      <button
        className="cursor-pointer underline underline-offset-2 hover:text-ink"
        onClick={() => useAuth.getState().disconnect()}
      >
        {t(L('смени', 'change'))}
      </button>
    </span>
  );
}
