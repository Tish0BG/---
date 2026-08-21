import { useState } from 'react';
import { cloudConfig } from '@/services/cloud/config';
import { diagnose, worstOf, type CheckResult } from '@/services/cloud/diagnose';
import { Icon } from '../Icon';

/**
 * A step-by-step check of the account connection, for when syncing misbehaves.
 *
 * It lives in settings rather than on the sign-in page: someone typing their
 * password does not need a diagnostics console in front of them, and a
 * troubleshooting tool on the front door makes the front door look broken.
 */
export function ConnectionCheck() {
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
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
    <section>
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

