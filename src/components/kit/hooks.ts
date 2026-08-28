import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/settingsStore';

/** Reactive media query. One place, so breakpoints cannot drift apart. */
export function useMedia(query: string): boolean {
  const [hit, setHit] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setHit(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return hit;
}

/** Below this the app switches to the phone layout: bottom bar, sheets. */
export const useIsPhone = (): boolean => useMedia('(max-width: 767px)');
/** Tablet and below: the rail collapses, side panels become overlays. */
export const useIsCompact = (): boolean => useMedia('(max-width: 1023px)');

/**
 * A clock that ticks. Countdowns and "in 3 days" labels are wrong the moment
 * the day rolls over, and nothing else would re-render them.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Remembers a value in localStorage — view preferences, collapsed sections. */

/**
 * Whether to draw movement at all.
 *
 * Three states, not two: the app's own preference wins over the system's, and
 * `system` defers to the media query. Anything timed against an animation
 * reads this too — a person who asked for less motion should not also be made
 * to wait out an animation they are not being shown.
 */
export function useStill(): boolean {
  const motion = useSettings((s) => s.motion);
  const systemReduced = useMedia('(prefers-reduced-motion: reduce)');
  if (motion === 'reduced') return true;
  if (motion === 'full') return false;
  return systemReduced;
}

/**
 * One axis of pointer drag, in pixels from where the finger went down.
 *
 * The mask editor and the bottom sheet each grew their own version of this;
 * this is the same shape — listeners on `window`, a `live` ref so the move
 * handler never reads a stale closure — kept to the single axis a card cares
 * about. `moved` survives the release for exactly one tick, which is how the
 * click that follows a throw can tell itself apart from a tap.
 */
export function useDragX(
  onEnd: (dx: number) => void,
  enabled = true,
): {
  dx: number;
  dragging: boolean;
  moved: React.MutableRefObject<number>;
  onPointerDown: (e: React.PointerEvent) => void;
} {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const live = useRef<{ from: number; dx: number } | null>(null);
  const moved = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled || e.button !== 0) return;
    live.current = { from: e.clientX, dx: 0 };
    moved.current = 0;
    setDragging(true);

    const move = (ev: PointerEvent) => {
      if (!live.current) return;
      live.current.dx = ev.clientX - live.current.from;
      setDx(live.current.dx);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const travelled = live.current?.dx ?? 0;
      live.current = null;
      moved.current = Math.abs(travelled);
      setDx(0);
      setDragging(false);
      onEnd(travelled);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return { dx, dragging, moved, onPointerDown };
}
