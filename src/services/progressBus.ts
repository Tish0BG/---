import { tr, L } from '@/i18n';

/**
 * "Something that counts just happened."
 *
 * Goals, levels and achievements all read the same records the rest of the app
 * writes, so they only need to be told to look again. A plain DOM event does
 * that without the timer store having to import the game store, which would
 * be a cycle: the game store already reads the timer's sessions.
 */
export const PROGRESS_EVENT = 'plauvia:progress';

export function announceProgress(): void {
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function installProgressEffects(): () => void {
  let running = false;

  const onProgress = async () => {
    if (running) return;
    running = true;
    try {
      const [{ useGoals }, { useGame, gameContext }, { notify }] = await Promise.all([
        import('@/state/goalStore'),
        import('@/state/gameStore'),
        import('@/state/toastStore'),
      ]);
      const ctx = gameContext();
      const finished = await useGoals.getState().reconcile(ctx);
      for (const goal of finished) {
        notify.ok(tr(L(`Цел постигната: ${goal.title}`, `Goal reached: ${goal.title}`)));
      }
      await useGame.getState().refresh();
    } finally {
      running = false;
    }
  };

  window.addEventListener(PROGRESS_EVENT, onProgress);
  return () => window.removeEventListener(PROGRESS_EVENT, onProgress);
}
