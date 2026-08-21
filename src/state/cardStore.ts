import { create } from 'zustand';
import type { CardGrade, FlashCard } from '@/types';
import { repo } from '@/services/storageService';
import { isDue, schedule } from '@/services/cardService';

/** Decks the student made by hand, including the still-empty ones. */
interface DeckList {
  list: string[];
  updatedAt: number;
}

const DECKS_KEY = 'decks';
export const DEFAULT_DECK = 'Общи';

interface CardStore {
  cards: FlashCard[];
  /**
   * Deck names that exist on their own. A deck used to be nothing but a
   * string repeated on every card, so an empty one vanished the moment it was
   * made — and could not be picked for the next card.
   */
  deckNames: string[];
  loaded: boolean;
  /** null = every deck */
  deck: string | null;
  /** ids queued for the current review session, in order */
  queue: string[];
  reviewing: boolean;
  revealed: boolean;
  /** answered in this session, for the progress readout */
  answered: number;

  init(): Promise<void>;
  save(cards: FlashCard[]): Promise<void>;
  remove(ids: string[]): Promise<void>;

  createDeck(name: string): Promise<string>;
  renameDeck(from: string, to: string): Promise<void>;
  /** `withCards` also throws away everything inside it. */
  deleteDeck(name: string, withCards: boolean): Promise<void>;

  startReview(deck: string | null): void;
  endReview(): void;
  reveal(): void;
  answer(grade: CardGrade): Promise<void>;
  current(): FlashCard | null;
}

export const useCards = create<CardStore>((set, get) => ({
  cards: [],
  deckNames: [],
  loaded: false,
  deck: null,
  queue: [],
  reviewing: false,
  revealed: false,
  answered: 0,

  async init() {
    const [cards, decks] = await Promise.all([repo.listCards(), repo.getMeta<DeckList>(DECKS_KEY)]);
    set({ cards, deckNames: decks?.list ?? [], loaded: true });
  },

  async createDeck(name) {
    const clean = name.trim() || DEFAULT_DECK;
    const list = get().deckNames;
    if (!list.some((d) => d.toLowerCase() === clean.toLowerCase())) {
      const next = [...list, clean];
      set({ deckNames: next });
      await repo.setMeta<DeckList>(DECKS_KEY, { list: next, updatedAt: Date.now() });
    }
    return clean;
  },

  async renameDeck(from, to) {
    const clean = to.trim();
    if (!clean || clean === from) return;
    const next = get().deckNames.map((d) => (d === from ? clean : d));
    if (!next.includes(clean)) next.push(clean);
    set({ deckNames: [...new Set(next)] });
    await repo.setMeta<DeckList>(DECKS_KEY, { list: get().deckNames, updatedAt: Date.now() });
    const moved = get()
      .cards.filter((c) => c.deck === from)
      .map((c) => ({ ...c, deck: clean, updatedAt: Date.now() }));
    if (moved.length) await get().save(moved);
  },

  async deleteDeck(name, withCards) {
    const inside = get().cards.filter((c) => c.deck === name);
    if (withCards) {
      if (inside.length) await get().remove(inside.map((c) => c.id));
    } else if (inside.length) {
      await get().save(inside.map((c) => ({ ...c, deck: DEFAULT_DECK, updatedAt: Date.now() })));
    }
    const next = get().deckNames.filter((d) => d !== name);
    set({ deckNames: next, deck: get().deck === name ? null : get().deck });
    await repo.setMeta<DeckList>(DECKS_KEY, { list: next, updatedAt: Date.now() });
  },

  async save(cards) {
    if (!cards.length) return;
    await repo.putCards(cards);
    set((s) => {
      const byId = new Map(cards.map((c) => [c.id, c]));
      const merged = s.cards.map((c) => byId.get(c.id) ?? c);
      for (const c of cards) if (!s.cards.some((x) => x.id === c.id)) merged.push(c);
      return { cards: merged };
    });
  },

  async remove(ids) {
    await repo.deleteCards(ids);
    const gone = new Set(ids);
    set((s) => ({
      cards: s.cards.filter((c) => !gone.has(c.id)),
      queue: s.queue.filter((id) => !gone.has(id)),
    }));
  },

  startReview(deck) {
    const now = Date.now();
    // Oldest due first; cards from one occlusion image stay together.
    const queue = get()
      .cards.filter((c) => (deck ? c.deck === deck : true) && isDue(c, now))
      .sort((a, b) => a.due - b.due || (a.maskIndex ?? 0) - (b.maskIndex ?? 0))
      .map((c) => c.id);
    set({ deck, queue, reviewing: true, revealed: false, answered: 0 });
  },

  endReview() {
    set({ reviewing: false, queue: [], revealed: false });
  },

  reveal() {
    set({ revealed: true });
  },

  async answer(grade) {
    const card = get().current();
    if (!card) return;
    const next = schedule(card, grade);
    await get().save([next]);
    set((s) => {
      const rest = s.queue.slice(1);
      // "again" puts the card back a few places later in the same session
      if (grade === 'again') rest.splice(Math.min(3, rest.length), 0, card.id);
      return { queue: rest, revealed: false, answered: s.answered + 1 };
    });
  },

  current() {
    const { queue, cards } = get();
    if (!queue.length) return null;
    return cards.find((c) => c.id === queue[0]) ?? null;
  },
}));

/* --------------------------------------------------------------- selectors */

export const dueCount = (cards: FlashCard[], deck: string | null = null): number => {
  const now = Date.now();
  return cards.filter((c) => (deck ? c.deck === deck : true) && isDue(c, now)).length;
};

export interface DeckSummary {
  deck: string;
  total: number;
  due: number;
}

export function decks(cards: FlashCard[], names: string[] = []): DeckSummary[] {
  const now = Date.now();
  const map = new Map<string, DeckSummary>();
  for (const name of names) map.set(name, { deck: name, total: 0, due: 0 });
  for (const c of cards) {
    const row = map.get(c.deck) ?? { deck: c.deck, total: 0, due: 0 };
    row.total++;
    if (isDue(c, now)) row.due++;
    map.set(c.deck, row);
  }
  return [...map.values()].sort((a, b) => b.due - a.due || a.deck.localeCompare(b.deck, 'bg'));
}
