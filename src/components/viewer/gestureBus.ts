/**
 * Tiny coordination channel between the scroll container (which owns
 * touch pan/pinch) and the per-page drawing handlers. Keeping it outside
 * React state avoids re-renders during a gesture.
 */
export const gestureBus = {
  /** true while the container is handling a multi-touch pan/pinch */
  panning: false,
  /** set by the active drawing gesture so the container can cancel it */
  abortDrawing: null as null | (() => void),
};
