import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { cloudConfig } from '@/services/cloud/config';
import { formatBytes, formatDate } from '@/lib/util';
import { Modal, Toggle, useConfirm } from '../ui';
import { Icon } from '../Icon';
import { notify } from '@/state/toastStore';
import { AuthScreen } from './AuthScreen';
import { ConnectionCheck } from './ConnectionCheck';

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
  const user = useAuth((s) => s.user);

  if (!open) return null;
  if (!user) return <AuthScreen onClose={onClose} />;

  return (
    <Modal open onClose={onClose} width={520} title="Профил в облака">
      <AccountPanel onClose={onClose} />
    </Modal>
  );
}

/* ------------------------------------------------------------- account */

function AccountPanel({ onClose }: { onClose: () => void }) {
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
            {sync.lastSyncAt ? `Последна синхронизация ${formatDate(sync.lastSyncAt)}` : 'Още не е синхронизирано'}
          </div>
        </div>
        <button className="btn btn-primary" disabled={syncing} onClick={() => void useAuth.getState().syncNow()}>
          <Icon name="refresh" size={14} className={syncing ? 'animate-spin' : ''} />
          Синхронизирай
        </button>
      </div>

      <SyncStatus />

      {usage && (
        <div className="grid grid-cols-3 gap-1.5">
          <Metric value={String(usage.records)} label="записа" />
          <Metric value={String(usage.files)} label="файла" />
          <Metric value={formatBytes(usage.bytes)} label="в облака" />
        </div>
      )}

      <div className="panel p-3">
        <Toggle
          checked={autoSync}
          onChange={(v) => useAuth.getState().setAutoSync(v)}
          label="Автоматична синхронизация"
          hint="На всеки 5 минути и когато затваряш приложението."
        />
        {pending > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
            <Icon name="upload" size={12} />
            {pending} {pending === 1 ? 'файл чака' : 'файла чакат'} да бъдат качени.
          </p>
        )}
      </div>

      <section>
        <h3 className="mb-2 label">Смяна на парола</h3>
        <div className="flex gap-2">
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            type="password"
            placeholder="Нова парола"
            className="field"
            autoComplete="new-password"
          />
          <button
            className="btn btn-outline shrink-0"
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
            Смени
          </button>
        </div>
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
          Излез
        </button>
        <button
          className="btn"
          style={{ color: 'var(--c-warn)' }}
          onClick={() =>
            confirm(
              'Това изтрива всичко от облака, но оставя данните на това устройство. При следваща синхронизация те ще се качат отново. Сигурен ли си?',
              () => void useAuth.getState().wipeRemote(),
            )
          }
        >
          <Icon name="archive" size={14} />
          Изчисти облака
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
          Изтриване на профила
        </summary>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          Профилът, всички качени файлове и всичко в облака изчезват безвъзвратно. Данните на това
          устройство остават — приложението просто продължава без профил. Напиши{' '}
          <b className="text-ink">ИЗТРИЙ</b>, за да потвърдиш.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ИЗТРИЙ"
            className="field"
          />
          <button
            className="btn btn-danger shrink-0"
            disabled={confirmText.trim().toUpperCase() !== 'ИЗТРИЙ' || busy}
            onClick={() => {
              setBusy(true);
              void useAuth
                .getState()
                .removeAccount()
                .then((err) => {
                  setBusy(false);
                  if (err) notify.error('Профилът не беше изтрит', err);
                  else onClose();
                });
            }}
          >
            {busy && <Icon name="refresh" size={14} className="animate-spin" />}
            Изтрий
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
  const sync = useAuth((s) => s.sync);
  if (sync.phase === 'idle') return null;

  if (sync.phase === 'error') {
    return <Banner tone="danger" text={sync.error ?? 'Синхронизацията се провали.'} />;
  }
  if (sync.phase === 'done') {
    return <Banner tone="ok" text={sync.label || 'Всичко е синхронизирано'} />;
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
        смени
      </button>
    </span>
  );
}
