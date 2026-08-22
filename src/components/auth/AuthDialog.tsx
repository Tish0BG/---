import { useEffect } from 'react';
import { useApp } from '@/state/appStore';
import { useAuth } from '@/state/authStore';
import { AuthScreen } from './AuthScreen';

/**
 * The door, and only the door.
 *
 * This used to be a dialog called "Cloud account" holding sync controls, a
 * password field, a diagnostics panel and account deletion — a room for the
 * plumbing, which no other part of the product has. All of it has moved into
 * Settings, where the rest of the product keeps its settings: sync into its
 * own section, the password into Security, deletion into Account & data.
 *
 * What is left is the one case that genuinely is not a setting: somebody who
 * is not signed in and wants to be. That is a whole page rather than a modal,
 * because an account is not a detour.
 */
export function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user);

  useEffect(() => {
    // Already signed in and still asking for "the account" — an old link, or
    // the address bar. Send them where it now lives, rather than showing them
    // a door they have already walked through.
    if (open && user) {
      useApp.getState().setAuth(false);
      useApp.getState().setSettings(true, 'account');
    }
  }, [open, user]);

  if (!open || user) return null;
  return <AuthScreen onClose={onClose} />;
}
