import { useState } from 'react';
import { useAuth } from '@/state/authStore';
import { Icon } from '../Icon';
import { PasswordField } from './PasswordField';
import { AuthLayout, AuthNote, AuthPanel, AuthTitle } from './Shell';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = useAuth((s) => s.user?.email);

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
    <AuthLayout>
      <AuthPanel>
        <AuthTitle
          icon="shield"
          title={t(L('Нова парола', 'New password'))}
          hint={
            email
              ? t(L(`Задай нова парола за ${email}.`, `Set a new password for ${email}.`))
              : t(L('Задай нова парола за профила си.', 'Set a new password for your account.'))
          }
        />

        <form
          className="space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void submit();
          }}
        >
          <PasswordField
            id="plauvia-recovery-password"
            autoFocus
            label={t(L('Нова парола', 'New password'))}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder={t(L('Поне 8 знака', 'At least 8 characters'))}
            showMeter
          />

          <div>
            <PasswordField
              id="plauvia-recovery-repeat"
              label={t(L('Повтори я', 'Repeat it'))}
              value={repeat}
              onChange={setRepeat}
              autoComplete="new-password"
              placeholder={t(L('Същата парола', 'The same password again'))}
            />
            {mismatch && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--c-danger)' }}>
                <Icon name="alert" size={12} />
                {t(L('Двете не съвпадат.', 'They do not match.'))}
              </p>
            )}
          </div>

          {error && <AuthNote text={error} />}

          <button className="btn btn-primary btn-lg w-full" disabled={!ready} type="submit">
            {busy && <Icon name="refresh" size={15} className="animate-spin" />}
            {t(L('Запази паролата', 'Save the password'))}
          </button>
        </form>

        <button
          className="link-quiet mt-4 block w-full text-center text-[12.5px]"
          onClick={() => useAuth.getState().endRecovery()}
        >
          {t(L('Ще я сменя по-късно', 'I will change it later'))}
        </button>
      </AuthPanel>
    </AuthLayout>
  );
}
