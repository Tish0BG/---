/**
 * What a deck is called when nothing better is known, and how to make sure a
 * card has one.
 *
 * A leaf module on purpose. `DEFAULT_DECK` is needed by the card service, the
 * card store, the repository and the backup reader — and the first two of
 * those already import each other, so anywhere else would have been a cycle.
 */

/**
 * The fallback deck.
 *
 * It is a *key*, not a label: renaming this constant would orphan every card
 * already filed under it, which is why it stays Bulgarian even in English.
 */
export const DEFAULT_DECK = 'Общи';

/**
 * A card from outside — a restored archive, a row pulled from the cloud.
 *
 * Both of those paths write straight into the store, and a card that arrives
 * without a deck used to reach the line that sorts decks by name and take the
 * whole screen down with a `TypeError`. Cheaper to make it impossible than to
 * defend every reader.
 */
export function normaliseCard<T extends { deck?: string }>(card: T): T {
  return card.deck?.trim() ? card : { ...card, deck: DEFAULT_DECK };
}
