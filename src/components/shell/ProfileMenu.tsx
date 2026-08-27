import { useMemo } from 'react';
import { useApp } from '@/state/appStore';
import { useAuth } from '@/state/authStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useSettings } from '@/state/settingsStore';
import { useTimer, dayKey, statsForDay, streak } from '@/state/timerStore';
import { MenuItem, MenuSep } from '../ui';
import { useT, L } from '@/i18n';
import { ProfileAvatar } from '../profile/ProfileAvatar';

/**
 * ─────────────────────────────────────────────────── everything about you ──
 *
 * The contents of the account menu, with no trigger of its own.
 *
 * It used to be a `Popover` in the top bar, which meant the menu and the
 * avatar that opened it were the same component. The top bar is gone and the
 * avatar now lives at the foot of the rail, so the two are separated: the rail
 * owns the button, this owns the list. Anything that can put a `Popover` on
 * screen can host it.
 */
export function ProfileMenuBody({ close }: { close: () => void }) {
  const t = useT();
  const profile = useWorkspace((s) => s.profile);
  const sessions = useTimer((s) => s.sessions);
  const theme = useSettings((s) => s.theme);
  const setSetting = useSettings((s) => s.set);
  const user = useAuth((s) => s.user);
  const sync = useAuth((s) => s.sync);
  const syncing = sync.phase !== 'idle' && sync.phase !== 'done' && sync.phase !== 'error';

  const today = useMemo(() => statsForDay(sessions, dayKey()), [sessions]);
  const days = useMemo(() => streak(sessions), [sessions]);

  return (
    <>
      <div className="flex items-center gap-2.5 px-2 py-2">
        <ProfileAvatar size={40} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{profile.name || t(L('Без име', 'Unnamed'))}</div>
          <div className="truncate text-[11px] text-muted">
            {user?.email ??
              ([profile.grade, profile.school].filter(Boolean).join(' · ') ||
                t(L('Настрой профила си', 'Set up your profile')))}
          </div>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-2 gap-1.5 px-2">
        <Stat value={`${today.minutes}`} label={t(L('мин днес', 'min today'))} />
        <Stat value={`${days}`} label={t(L('дни поред', 'day streak'))} />
      </div>

      <MenuSep />
      <MenuItem
        icon="user"
        label={t(L('Моят профил', 'My profile'))}
        onClick={() => {
          useApp.getState().go('profile');
          close();
        }}
      />
      <MenuItem
        icon="trophy"
        label={t(L('Постижения', 'Achievements'))}
        onClick={() => {
          useApp.getState().go('achievements');
          close();
        }}
      />
      <MenuSep />
      <MenuItem
        icon="sliders"
        label={t(L('Настройки', 'Settings'))}
        onClick={() => {
          useApp.getState().setSettings(true);
          close();
        }}
      />
      {user ? (
        <MenuItem
          icon={sync.error ? 'alert' : 'cloud'}
          label={sync.error ? t(L('Проблем със синхронизацията', 'Sync problem')) : t(L('Синхронизация', 'Sync'))}
          shortcut={syncing ? '…' : sync.error ? '!' : '✓'}
          onClick={() => {
            useApp.getState().setSettings(true, 'sync');
            close();
          }}
        />
      ) : (
        <MenuItem
          icon="logIn"
          label={t(L('Влез в профил', 'Sign in'))}
          onClick={() => {
            useApp.getState().setAuth(true, 'signin');
            close();
          }}
        />
      )}
      <MenuItem
        icon={theme === 'dark' ? 'sun' : 'moon'}
        label={theme === 'dark' ? t(L('Светла тема', 'Light theme')) : t(L('Тъмна тема', 'Dark theme'))}
        onClick={() => setSetting('theme', theme === 'dark' ? 'light' : 'dark')}
      />
      <MenuItem
        icon="timer"
        label={t(L('Фокус таймер', 'Focus timer'))}
        shortcut="⌥T"
        onClick={() => {
          useTimer.getState().toggleWidget();
          close();
        }}
      />
      {user && (
        <>
          <MenuSep />
          <MenuItem
            icon="logOut"
            label={t(L('Излез', 'Sign out'))}
            onClick={() => {
              void useAuth.getState().signOut();
              close();
            }}
          />
        </>
      )}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg py-1.5 text-center" style={{ background: 'var(--c-surface-2)' }}>
      <div className="text-[16px] font-medium leading-none tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted">{label}</div>
    </div>
  );
}
