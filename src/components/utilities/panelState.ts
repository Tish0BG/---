import { useState } from 'react';

/**
 * Per-window scratch state that survives re-mounting.
 *
 * Dragging a panel from "floating" to "docked" moves it to a different place
 * in the React tree, so the component unmounts and a fresh one takes over. A
 * half-typed expression disappearing because the panel was moved is not a
 * trade-off worth making, so the state lives in this map instead of in the
 * component.
 */
const memory = new Map<string, unknown>();

export function usePanelState<T>(wid: string, key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const id = `${wid}:${key}`;
  const [value, setValue] = useState<T>(() => (memory.has(id) ? (memory.get(id) as T) : initial));
  const set = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      memory.set(id, resolved);
      return resolved;
    });
  };
  return [value, set];
}

/** Frees a closed window's scratch state. */
export function forgetPanel(wid: string): void {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(`${wid}:`)) memory.delete(key);
  }
}
