import { useMemo } from 'react';
import { create } from 'zustand';
import type { GameState } from '@/types';
import { repo } from '@/services/storageService';
import {
  ACHIEVEMENTS,
  EMPTY_CONTEXT,
  levelState,
  totalXp,
  type AchievementDef,
  type GameContext,
} from '@/services/gameService';
import { useTimer } from './timerStore';
import { usePlanner } from './plannerStore';
import { useCards } from './cardStore';
import { useLibrary } from './libraryStore';

const KEY = 'game';

/** Something worth interrupting the screen for, once. */
export type Celebration =
  | { kind: 'achievement'; achievement: AchievementDef }
  | { kind: 'level'; level: number };

interface GameStore extends GameState {
  loaded: boolean;
  /** shown one at a time by the celebration overlay */
  queue: Celebration[];

  init(): Promise<void>;
  /**
   * Recomputes everything from the records and records anything newly earned.
   * Cheap enough to call after any action that could move a counter.
   */
  refresh(): Promise<void>;
  dismiss(): void;
}

export const useGame = create<GameStore>((set, get) => ({
  unlocked: {},
  seenLevel: 1,
  updatedAt: 0,
  loaded: false,
  queue: [],

  async init() {
    const saved = await repo.getMeta<GameState>(KEY);
    set({
      unlocked: saved?.unlocked ?? {},
      seenLevel: saved?.seenLevel ?? 0,
      updatedAt: saved?.updatedAt ?? 0,
      loaded: true,
    });
    await get().refresh();
  },

  async refresh() {
    if (!get().loaded) return;
    const ctx = gameContext();
    const unlocked = { ...get().unlocked };
    const fresh: Celebration[] = [];
    const now = Date.now();
    let changed = false;

    for (const a of ACHIEVEMENTS) {
      if (unlocked[a.id]) continue;
      if (a.value(ctx) >= a.target) {
        unlocked[a.id] = now;
        changed = true;
        // A brand-new account that syncs a full history would otherwise
        // announce fifteen badges at once; only celebrate on a live run.
        if (get().updatedAt) fresh.push({ kind: 'achievement', achievement: a });
      }
    }

    const level = levelState(totalXp(ctx)).level;
    let seenLevel = get().seenLevel;
    if (level > seenLevel) {
      if (seenLevel > 0) fresh.push({ kind: 'level', level });
      seenLevel = level;
      changed = true;
    }

    if (changed) {
      const next: GameState = { unlocked, seenLevel, updatedAt: now };
      set({ ...next });
      await repo.setMeta(KEY, next);
    }
    if (fresh.length) set((s) => ({ queue: [...s.queue, ...fresh] }));
  },

  dismiss() {
    set((s) => ({ queue: s.queue.slice(1) }));
  },
}));

/** Everything the level and the achievements are computed from. */
export function gameContext(): GameContext {
  const timer = useTimer.getState();
  const planner = usePlanner.getState();
  const cards = useCards.getState();
  const library = useLibrary.getState();
  if (!timer.loaded && !planner.loaded) return EMPTY_CONTEXT;
  return {
    sessions: timer.sessions,
    items: planner.items,
    cards: cards.cards,
    documents: library.documents,
  };
}

/**
 * Hook form: re-renders whenever any of the underlying record sets change, so
 * the level ring in the sidebar moves the moment a session is logged.
 */
export function useGameContext(): GameContext {
  const sessions = useTimer((s) => s.sessions);
  const items = usePlanner((s) => s.items);
  const cards = useCards((s) => s.cards);
  const documents = useLibrary((s) => s.documents);
  return useMemo(
    () => ({ sessions, items, cards, documents }),
    [sessions, items, cards, documents],
  );
}
