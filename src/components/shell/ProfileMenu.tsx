import { useMemo } from 'react';
import { useApp } from '@/state/appStore';
import { useAuth } from '@/state/authStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useSettings } from '@/state/settingsStore';
import { useTimer, dayKey, statsForDay, streak } from '@/state/timerStore';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover } from '../ui';

/** Avatar plus the two numbers a student checks most: today and the streak. */
export function ProfileMenu() {
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
    <Popover
      width={240}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          onClick={toggle}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-full pl-1 pr-2.5 transition-colors hover:bg-surface-3"
        >
          <span className="relative shrink-0">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[14px]"
              style={{ background: `color-mix(in srgb, ${profile.color} 20%, transparent)` }}
            >
              {profile.avatar}
            </span>
            {user && (
              <span
                className="absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full"
                style={{ background: 'var(--c-surface)' }}
                title={syncing ? 'Синхронизира се' : sync.error ? 'Проблем със синхронизацията' : 'Синхронизирано'}
              >
                <span
                  className={`h-2 w-2 rounded-full ${syncing ? 'animate-pulse' : ''}`}
                  style={{ background: sync.error ? 'var(--c-danger)' : 'var(--c-success)' }}
                />
              </span>
            )}
          </span>
          <span className="hidden text-[13px] font-medium sm:block">{profile.name || 'Профил'}</span>
          <Icon name="chevronDown" size={13} className="text-faint" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[20px]"
              style={{ background: `color-mix(in srgb, ${profile.color} 20%, transparent)` }}
            >
              {profile.avatar}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{profile.name || 'Без име'}</div>
              <div className="truncate text-[11px] text-muted">
                {user?.email ?? ([profile.grade, profile.school].filter(Boolean).join(' · ') || 'Настрой профила си')}
              </div>
            </div>
          </div>

          <div className="mb-1 grid grid-cols-2 gap-1.5 px-2">
            <Stat value={`${today.minutes}`} label="мин днес" />
            <Stat value={`${days}`} label="дни поред" />
          </div>

          <MenuSep />
          <MenuItem
            icon="cloud"
            label={user ? (sync.error ? 'Проблем със синхронизацията' : 'Синхронизация') : 'Влез в профил'}
            shortcut={user ? (syncing ? '…' : sync.error ? '!' : '✓') : undefined}
            onClick={() => {
              useApp.getState().setAuth(true);
              close();
            }}
          />
          <MenuItem
            icon="user"
            label="Профил и настройки"
            onClick={() => {
              useApp.getState().setSettings(true);
              close();
            }}
          />
          <MenuItem
            icon={theme === 'dark' ? 'sun' : 'moon'}
            label={theme === 'dark' ? 'Светла тема' : 'Тъмна тема'}
            onClick={() => setSetting('theme', theme === 'dark' ? 'light' : 'dark')}
          />
          <MenuItem
            icon="timer"
            label="Фокус таймер"
            shortcut="⌥T"
            onClick={() => {
              useTimer.getState().toggleWidget();
              close();
            }}
          />
        </>
      )}
    </Popover>
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
