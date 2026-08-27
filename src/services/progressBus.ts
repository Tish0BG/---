/**
 * "Something that counts just happened."
 *
 * Levels and achievements read the same records the rest of the app writes, so
 * they only need to be told to look again. A plain DOM event does that without
 * the timer store having to import the game store, which would be a cycle: the
 * game store already reads the timer's sessions.
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
      const { useGame } = await import('@/state/gameStore');
      await useGame.getState().refresh();
    } finally {
      running = false;
    }
  };

  window.addEventListener(PROGRESS_EVENT, onProgress);
  return () => window.removeEventListener(PROGRESS_EVENT, onProgress);
}
