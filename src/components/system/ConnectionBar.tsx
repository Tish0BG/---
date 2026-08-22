import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { Icon } from '../Icon';
import { useT, L } from '@/i18n';

/** True while the browser believes it has a network. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/**
 * A thin strip that only exists while the network is gone.
 *
 * The app itself does not care — everything is written locally first and the
 * pages are cached — but someone who is signed in needs to know that their
 * notes are not reaching the other device yet. Silence would be read as
 * "it synced".
 */
export function ConnectionBar() {
  const t = useT();
  const online = useOnline();
  const signedIn = useAuth((s) => !!s.user);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    if (online) return;
    // Coming back online is worth one line of reassurance, then gone.
    return () => {
      setJustBack(true);
      window.setTimeout(() => setJustBack(false), 2600);
    };
  }, [online]);

  // Re-sync as soon as the network returns, rather than waiting five minutes.
  useEffect(() => {
    if (!online || !signedIn) return;
    const id = window.setTimeout(() => {
      if (useAuth.getState().autoSync) void useAuth.getState().syncNow();
    }, 1200);
    return () => window.clearTimeout(id);
  }, [online, signedIn]);

  if (online && !justBack) return null;

  return (
    <div
      className="animate-in flex h-7 shrink-0 items-center justify-center gap-2 text-[11.5px] font-medium"
      style={{
        background: online ? 'var(--c-success-soft)' : 'var(--c-warn-soft)',
        color: online ? 'var(--c-success)' : 'var(--c-warn)',
      }}
      role="status"
    >
      <Icon name={online ? 'cloud' : 'wifiOff'} size={13} />
      {online
        ? t(L("Връзката се върна — синхронизираме", "Back online — syncing"))
        : signedIn
          ? t(L("Няма връзка. Работиш нормално; синхронизацията ще изчака.", "No connection. Keep working; the sync will wait."))
          : t(L("Няма връзка. Приложението работи офлайн.", "No connection. The app runs offline."))}
    </div>
  );
}
