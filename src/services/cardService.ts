import type { Asset, CardGrade, FlashCard, Rect } from '@/types';
import { repo } from './storageService';
import { uid } from '@/lib/util';

/** Card images live outside any document, so cards survive its deletion. */
export const CARD_BUCKET = '__cards__';

const DAY = 86_400_000;
/** A lapsed card comes back inside the same session. */
const RELEARN_MS = 10 * 60_000;

const GRADE_Q: Record<CardGrade, number> = { again: 0, hard: 3, good: 4, easy: 5 };

/**
 * SM-2 scheduling. "Again" resets the card and shortens the ease; the other
 * three multiply the current interval, so a card you keep getting right
 * quickly drifts weeks into the future and stops costing you time.
 */
export function schedule(card: FlashCard, grade: CardGrade, now = Date.now()): FlashCard {
  const q = GRADE_Q[grade];
  const next: FlashCard = { ...card, lastReviewedAt: now, updatedAt: now };

  if (grade === 'again') {
    next.reps = 0;
    next.lapses = card.lapses + 1;
    next.interval = 0;
    next.ease = Math.max(1.3, card.ease - 0.2);
    next.due = now + RELEARN_MS;
    return next;
  }

  next.ease = clampEase(card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (card.reps === 0) next.interval = grade === 'easy' ? 3 : 1;
  else if (card.reps === 1) next.interval = grade === 'easy' ? 8 : 6;
  else {
    const modifier = grade === 'hard' ? 0.7 : grade === 'easy' ? 1.25 : 1;
    next.interval = Math.max(1, Math.round(card.interval * next.ease * modifier));
  }
  next.reps = card.reps + 1;
  next.due = now + next.interval * DAY;
  return next;
}

/** Human preview of where each button would send the card. */
export function previewIntervals(card: FlashCard): Record<CardGrade, string> {
  const now = Date.now();
  const out = {} as Record<CardGrade, string>;
  for (const g of ['again', 'hard', 'good', 'easy'] as CardGrade[]) {
    const next = schedule(card, g, now);
    const days = (next.due - now) / DAY;
    out[g] = days < 1 ? `${Math.max(1, Math.round((next.due - now) / 60_000))} мин` : formatDays(days);
  }
  return out;
}

function formatDays(days: number): string {
  if (days < 30) {
    const n = Math.round(days);
    return `${n} ${n === 1 ? 'ден' : 'дни'}`;
  }
  if (days < 365) return `${Math.round(days / 30)} мес.`;
  return `${(days / 365).toFixed(1)} год.`;
}

const clampEase = (e: number) => Math.min(2.8, Math.max(1.3, e));

export function newCard(patch: Partial<FlashCard> = {}): FlashCard {
  const now = Date.now();
  return {
    id: uid('cd_'),
    kind: 'basic',
    docId: null,
    page: null,
    deck: 'Общи',
    front: '',
    back: '',
    frontAsset: null,
    backAsset: null,
    masks: undefined,
    maskIndex: undefined,
    groupId: null,
    due: now,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    suspended: false,
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

/** Stores a clip so a card can reference it. */
export async function storeCardImage(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const asset: Asset = {
    id: uid('as_'),
    docId: CARD_BUCKET,
    blob,
    width: bitmap.width,
    height: bitmap.height,
  };
  await repo.putAsset(asset);
  bitmap.close?.();
  return asset.id;
}

/**
 * Turns one image plus N masks into N cards: each hides a different region
 * while the rest stay covered, which is how image occlusion actually teaches.
 */
export function occlusionCards(base: Partial<FlashCard>, assetId: string, masks: Rect[]): FlashCard[] {
  const groupId = uid('gr_');
  return masks.map((_, i) =>
    newCard({
      ...base,
      kind: 'occlusion',
      frontAsset: assetId,
      masks,
      maskIndex: i,
      groupId,
    }),
  );
}

export const isDue = (c: FlashCard, now = Date.now()): boolean => !c.suspended && c.due <= now;
