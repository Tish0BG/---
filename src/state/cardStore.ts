import { create } from 'zustand';
import type { CardGrade, Deck, FlashCard } from '@/types';
import { repo } from '@/services/storageService';
import { isDue, schedule } from '@/services/cardService';
import { DEFAULT_DECK } from '@/lib/deck';
import { SUBJECT_COLORS } from '@/state/workspaceStore';
import { collatorOf, currentLang } from '@/i18n';

export { DEFAULT_DECK };

/** What the meta bucket holds today. */
interface StoredDecks {
  decks: Deck[];
  updatedAt: number;
}

/** What it held before decks had a colour: names and nothing else. */
interface LegacyDeckList {
  list: string[];
  updatedAt: number;
}

const DECKS_KEY = 'decks';

/** The next colour a new deck gets, so a fresh box is never all one hue. */
const colourFor = (index: number): string => SUBJECT_COLORS[index % SUBJECT_COLORS.length];

interface CardStore {
  cards: FlashCard[];
  /**
   * Decks that exist on their own. A deck used to be nothing but a string
   * repeated on every card, so an empty one vanished the moment it was made —
   * and could not be picked for the next card.
   */
  deckList: Deck[];
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

  createDeck(name: string, color?: string): Promise<string>;
  /** repaints one divider */
  recolourDeck(name: string, color: string): Promise<void>;
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
  deckList: [],
  loaded: false,
  deck: null,
  queue: [],
  reviewing: false,
  revealed: false,
  answered: 0,

  async init() {
    const [cards, saved] = await Promise.all([
      repo.listCards(),
      repo.getMeta<StoredDecks | LegacyDeckList>(DECKS_KEY),
    ]);

    // Names-only is the older shape; give each one a colour on the way past.
    const stored: Deck[] = Array.isArray((saved as StoredDecks | undefined)?.decks)
      ? (saved as StoredDecks).decks
      : ((saved as LegacyDeckList | undefined)?.list ?? []).map((name, i) => ({
          name,
          color: colourFor(i),
          createdAt: 0,
        }));

    /**
     * Every deck a card claims to be in, made real.
     *
     * A card cut from a PDF was filed under the file's name without anyone
     * registering that deck, so it existed only for as long as a card pointed
     * at it — a divider that vanished when you emptied it. `Общи` had the same
     * problem from the other end: `deleteDeck` sent cards there without ever
     * creating it. Both are ordinary decks from here on.
     */
    const byName = new Map(stored.map((d) => [d.name, d]));
    let added = false;
    for (const card of cards) {
      const name = card.deck?.trim();
      if (!name || byName.has(name)) continue;
      byName.set(name, { name, color: colourFor(byName.size), createdAt: card.createdAt });
      added = true;
    }

    const deckList = [...byName.values()];
    set({ cards, deckList, loaded: true });
    if (added || !Array.isArray((saved as StoredDecks | undefined)?.decks)) {
      await repo.setMeta<StoredDecks>(DECKS_KEY, { decks: deckList, updatedAt: Date.now() });
    }
  },

  async createDeck(name, color) {
    const clean = name.trim() || DEFAULT_DECK;
    const list = get().deckList;
    const already = list.find((d) => d.name.toLowerCase() === clean.toLowerCase());
    if (already) return already.name;
    const next = [...list, { name: clean, color: color ?? colourFor(list.length), createdAt: Date.now() }];
    set({ deckList: next });
    await repo.setMeta<StoredDecks>(DECKS_KEY, { decks: next, updatedAt: Date.now() });
    return clean;
  },

  async recolourDeck(name, color) {
    const next = get().deckList.map((d) => (d.name === name ? { ...d, color } : d));
    set({ deckList: next });
    await repo.setMeta<StoredDecks>(DECKS_KEY, { decks: next, updatedAt: Date.now() });
  },

  async renameDeck(from, to) {
    const clean = to.trim();
    if (!clean || clean === from) return;
    // Renaming onto a name that already exists merges the two — the name is
    // the key, so there is no third possibility. The screen warns first.
    const next = get()
      .deckList.map((d) => (d.name === from ? { ...d, name: clean } : d))
      .filter((d, i, all) => all.findIndex((x) => x.name === d.name) === i);
    set({ deckList: next });
    await repo.setMeta<StoredDecks>(DECKS_KEY, { decks: next, updatedAt: Date.now() });
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
      // The cards need somewhere to be, and it has to be a deck that exists.
      await get().createDeck(DEFAULT_DECK);
      await get().save(inside.map((c) => ({ ...c, deck: DEFAULT_DECK, updatedAt: Date.now() })));
    }
    const next = get().deckList.filter((d) => d.name !== name);
    set({ deckList: next, deck: get().deck === name ? null : get().deck });
    await repo.setMeta<StoredDecks>(DECKS_KEY, { decks: next, updatedAt: Date.now() });
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
  color: string;
  total: number;
  due: number;
}

/**
 * The decks, in the order a box of dividers actually stands: alphabetical.
 *
 * It used to sort by how many cards were waiting, descending — which meant the
 * box rearranged itself every time you answered one. A drawer whose dividers
 * move while you are reading them is not a drawer. What is waiting is a number
 * on the tab now, not the reason the tab is where it is.
 *
 * `c.deck` is read defensively: a card restored from an old archive, or pulled
 * from another device, can arrive without one, and this line used to be the
 * `TypeError` that took the whole screen down.
 */
export function decks(cards: FlashCard[], deckList: Deck[] = []): DeckSummary[] {
  const now = Date.now();
  const map = new Map<string, DeckSummary>();
  for (const d of deckList) map.set(d.name, { deck: d.name, color: d.color, total: 0, due: 0 });
  for (const c of cards) {
    const name = c.deck?.trim() || DEFAULT_DECK;
    const row = map.get(name) ?? { deck: name, color: colourFor(map.size), total: 0, due: 0 };
    row.total++;
    if (isDue(c, now)) row.due++;
    map.set(name, row);
  }
  const collator = collatorOf(currentLang());
  return [...map.values()].sort((a, b) => collator.compare(a.deck, b.deck));
}
