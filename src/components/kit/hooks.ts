import { useEffect, useState } from 'react';

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
export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  };
  return [value, set];
}
