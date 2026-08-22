import { useState } from 'react';
import { useAuth } from '@/state/authStore';
import { Icon } from '../Icon';
import { useT, L } from '@/i18n';

/**
 * Where the "forgot your password" e-mail actually lands.
 *
 * Supabase signs the person in with a recovery session before this screen
 * shows, so the app must ask for the new password here — otherwise the link
 * quietly logs them in with the password they could not remember, and the
 * loop never closes.
 */
export function RecoveryScreen() {
  const t = useT();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = useAuth((s) => s.user?.email);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = repeat.length > 0 && repeat !== password;
  const ready = password.length >= 8 && repeat === password && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const problem = await useAuth.getState().changePassword(password);
    setBusy(false);
    if (problem) return setError(problem);
    useAuth.getState().endRecovery();
  };

  return (
    <div className="grid h-full place-items-center overflow-y-auto px-5 py-10" style={{ background: 'var(--c-bg)' }}>
      <div className="w-full max-w-[380px]">
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl"
          style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
        >
          <Icon name="shield" size={22} />
        </span>

        <h1
          className="mt-4 font-semibold leading-[1.12]"
          style={{ fontSize: 'var(--text-title)', letterSpacing: 'var(--track-title)' }}
        >
          {t(L("Нова парола", "New password"))}
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          {email ? (
            <>
              {t(L(`Задай нова парола за ${email}.`, `Set a new password for ${email}.`))}
            </>
          ) : (
            'Задай нова парола за профила си.'
          )}
        </p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void submit();
          }}
        >
          <label className="block">
            <span className="mb-1 block label">{t(L("Нова парола", "New password"))}</span>
            <span className="relative block">
              <input
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={show ? 'text' : 'password'}
                placeholder={t(L("Поне 8 знака", "At least 8 characters"))}
                autoComplete="new-password"
                className="field h-10 pr-10"
                style={tooShort ? { borderColor: 'var(--c-danger)' } : undefined}
              />
              <button
                type="button"
                className="icon-btn absolute right-1 top-1 h-8 w-8"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? t(L("Скрий паролата", "Hide the password")) : t(L("Покажи паролата", "Show the password"))}
              >
                <Icon name={show ? 'eyeOff' : 'eye'} size={15} />
              </button>
            </span>
            {tooShort && (
              <span className="mt-1 block text-[11.5px]" style={{ color: 'var(--c-danger)' }}>
                {t(L(`Още ${8 - password.length} знака.`, `${8 - password.length} more characters.`))}
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block label">{t(L("Повтори я", "Repeat it"))}</span>
            <input
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              type={show ? 'text' : 'password'}
              placeholder={t(L("Същата парола", "The same password again"))}
              autoComplete="new-password"
              className="field h-10"
              style={mismatch ? { borderColor: 'var(--c-danger)' } : undefined}
            />
            {mismatch && (
              <span className="mt-1 block text-[11.5px]" style={{ color: 'var(--c-danger)' }}>
                {t(L("Двете не съвпадат.", "They do not match."))}
              </span>
            )}
          </label>

          {error && (
            <p
              className="flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px] leading-snug"
              style={{
                background: 'color-mix(in srgb, var(--c-danger) 10%, transparent)',
                color: 'var(--c-danger)',
              }}
            >
              <Icon name="alert" size={13} className="mt-px shrink-0" />
              {error}
            </p>
          )}

          <button className="btn btn-primary h-10 w-full" disabled={!ready} type="submit">
            {busy && <Icon name="refresh" size={15} className="animate-spin" />}
            Запази паролата
          </button>
        </form>

        <button
          className="mt-3 w-full cursor-pointer text-[12px] text-muted underline-offset-2 hover:underline"
          onClick={() => useAuth.getState().endRecovery()}
        >
          {t(L('Ще я сменя по-късно', 'I will change it later'))}
        </button>
      </div>
    </div>
  );
}
