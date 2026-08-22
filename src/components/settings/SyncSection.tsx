import { useEffect, useState } from 'react';
import { useApp } from '@/state/appStore';
import { useAuth } from '@/state/authStore';
import { ConnectionCheck } from '../auth/ConnectionCheck';
import { formatBytes, formatDate } from '@/lib/util';
import { L, useT } from '@/i18n';
import { Icon } from '../Icon';
import { Button } from '../kit';
import { Toggle, useConfirm } from '../ui';

/**
 * Settings → Sync.
 *
 * This used to be a dialog of its own, opened from the profile menu, called
 * "Cloud account". Nothing else in the product has a screen for its plumbing,
 * and neither should this: syncing is a setting, so it lives among the
 * settings. What a person needs from it is three sentences — is it on, when
 * did it last run, and how do I make it run now.
 *
 * The diagnostics are the interesting part. They are genuinely useful when
 * sync breaks and pure noise the rest of the time, so they appear only when
 * something has actually gone wrong. A permanently visible list of green ticks
 * about database tables is a developer's console left in a student's settings.
 */
export function SyncSection() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const sync = useAuth((s) => s.sync);
  const autoSync = useAuth((s) => s.autoSync);
  const pending = useAuth((s) => s.pendingFiles);
  const [usage, setUsage] = useState<{ records: number; files: number; bytes: number } | null>(null);
  const { confirm, element } = useConfirm();

  useEffect(() => {
    if (!user) return;
    void useAuth.getState().refreshPending();
    void useAuth.getState().usage().then(setUsage);
  }, [user]);

  const busy = ['pulling', 'pushing', 'files', 'checking'].includes(sync.phase);

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-muted">
          {t(
            L(
              'Всичко се пази на това устройство и работи офлайн. Влизането в профил добавя едно нещо: същата библиотека и на телефона ти.',
              'Everything is kept on this device and works offline. Signing in adds one thing: the same library on your phone too.',
            ),
          )}
        </p>
        <Button variant="primary" onClick={() => useApp.getState().setAuth(true)}>
          {t(L('Влез в профил', 'Sign in'))}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {element}

      <section>
        <h3 className="t-label mb-2">{t(L('Състояние', 'Status'))}</h3>
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
            style={{
              background: sync.error ? 'var(--c-danger-soft)' : 'var(--c-success-soft)',
              color: sync.error ? 'var(--c-danger)' : 'var(--c-success)',
            }}
          >
            <Icon name={sync.error ? 'alert' : 'cloud'} size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{user.email}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {busy
                ? sync.label || t(L('Синхронизира се…', 'Syncing…'))
                : sync.error
                  ? sync.error
                  : sync.lastSyncAt
                    ? t(
                        L(
                          `Последно ${formatDate(sync.lastSyncAt)}`,
                          `Last synced ${formatDate(sync.lastSyncAt)}`,
                        ),
                      )
                    : t(L('Още не е синхронизирано', 'Not synced yet'))}
              {pending > 0 && ` · ${t(L(`${pending} файла чакат`, `${pending} files waiting`))}`}
            </p>
          </div>
          <Button icon="refresh" busy={busy} onClick={() => void useAuth.getState().syncNow()}>
            {t(L('Синхронизирай сега', 'Sync now'))}
          </Button>
        </div>

        {usage && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Metric value={String(usage.records)} label={t(L('записа', 'records'))} />
            <Metric value={String(usage.files)} label={t(L('файла', 'files'))} />
            <Metric value={formatBytes(usage.bytes)} label={t(L('в облака', 'in the cloud'))} />
          </div>
        )}
      </section>

      <section>
        <h3 className="t-label mb-2">{t(L('Автоматично', 'Automatic'))}</h3>
        <Toggle
          checked={autoSync}
          onChange={(v) => useAuth.getState().setAutoSync(v)}
          label={t(L('Синхронизирай сам', 'Sync on its own'))}
          hint={t(
            L(
              'На всеки пет минути и когато затвориш приложението.',
              'Every five minutes, and when you close the app.',
            ),
          )}
        />
      </section>

      {/* Only when there is something to diagnose. */}
      {sync.error && (
        <section>
          <h3 className="t-label mb-2">{t(L('Какво не е наред', 'What is wrong'))}</h3>
          <ConnectionCheck />
        </section>
      )}

      <section>
        <h3 className="t-label mb-2">{t(L('Копието в облака', 'The cloud copy'))}</h3>
        <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
          {t(
            L(
              'Изчистването маха всичко от облака, но оставя данните на това устройство — при следващата синхронизация те се качват отново. Полезно е, ако копието там се е объркало.',
              'Clearing removes everything from the cloud but leaves the data on this device — the next sync uploads it again. Useful if the copy up there has got itself confused.',
            ),
          )}
        </p>
        <Button
          icon="archive"
          onClick={() =>
            confirm(
              t(
                L(
                  'Това изтрива всичко от облака, но оставя данните на това устройство. Сигурен ли си?',
                  'This wipes everything from the cloud but leaves the data on this device. Are you sure?',
                ),
              ),
              () => void useAuth.getState().wipeRemote(),
            )
          }
        >
          {t(L('Изчисти облака', 'Clear the cloud'))}
        </Button>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl py-2 text-center" style={{ background: 'var(--c-surface-2)' }}>
      <div className="t-num text-[15px] font-medium leading-none">{value}</div>
      <div className="mt-1 text-[10.5px] text-muted">{label}</div>
    </div>
  );
}
