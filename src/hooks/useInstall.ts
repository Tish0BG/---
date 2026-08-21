import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type OfflineState = 'ready' | 'pending' | 'unsupported' | 'insecure';

export interface InstallStatus {
  /** already running from the home screen / dock */
  installed: boolean;
  /** the browser offered an install prompt we can trigger */
  canInstall: boolean;
  offline: OfflineState;
  install(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

/**
 * Reports whether the app is installable and whether the offline cache is
 * actually in place — the two things that decide if this behaves like an app
 * or like a web page, and both of which depend on how it was published.
 */
export function useInstall(): InstallStatus {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [offline, setOffline] = useState<OfflineState>('pending');

  const installed =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setOffline('unsupported');
      return;
    }
    if (!window.isSecureContext) {
      setOffline('insecure');
      return;
    }
    let alive = true;
    const check = () =>
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        if (alive) setOffline(regs.length ? 'ready' : 'pending');
      });
    check();
    const id = setInterval(check, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return {
    installed,
    canInstall: !!prompt,
    offline,
    async install() {
      if (!prompt) return 'unavailable';
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setPrompt(null);
      return outcome;
    },
  };
}
