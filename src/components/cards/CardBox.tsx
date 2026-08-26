import { useMemo, useRef, useState } from 'react';
import type { FlashCard } from '@/types';
import { useCards } from '@/state/cardStore';
import { useT, L, useLang } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { Button } from '../kit';

/**
 * ─────────────────────────────────────────────────────── the card box ──
 *
 * A flashcard app that shows you a list of rows has told you the truth and
 * shown you nothing. Four hundred cards in a list is a database; four hundred
 * cards behind alphabetical dividers is a *collection* — you can see how thick
 * the letter С has got, you can flick to it, you can find one card without
 * searching for it.
 *
 * So the deck screen is a box. Cards stand in it as ruled index cards, sorted
 * by their question, and between them sit stiff dividers whose tabs stagger
 * across the width the way they do in a real one, because a column of tabs all
 * at the same offset is unreadable on a desk and unreadable here. The letter
 * rail down the side is the thumb you run along the top of the cards.
 *
 * None of it is decoration for its own sake: the divider is the scroll anchor,
 * the tab is the jump button, and a card that is due leans out of the box in
 * the accent colour so the work in front of you is visible without opening
 * anything.
 */

const CYRILLIC = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЮЯ'.split('');
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** The divider a card files under. Everything unlettered goes behind `#`. */
export function fileUnder(card: FlashCard): string {
  const raw = (card.front || card.back || '').trim();
  const first = [...raw].find((ch) => ch.trim().length > 0);
  if (!first) return '#';
  const upper = first.toLocaleUpperCase();
  return /\p{L}/u.test(upper) ? upper : '#';
}

export function CardBox({
  cards,
  deck,
  onEdit,
  onDelete,
  onAdd,
}: {
  cards: FlashCard[];
  /** null = every deck; only used for the empty line and the add button */
  deck: string | null;
  onEdit: (card: FlashCard) => void;
  onDelete: (card: FlashCard) => void;
  onAdd: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [active, setActive] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<string, HTMLDivElement>());

  /** Cards behind their dividers, in the order the alphabet puts them. */
  const sections = useMemo(() => {
    const map = new Map<string, FlashCard[]>();
    for (const card of cards) {
      const key = fileUnder(card);
      map.set(key, [...(map.get(key) ?? []), card]);
    }
    const collator = new Intl.Collator(lang === 'en' ? 'en' : 'bg');
    for (const list of map.values()) {
      list.sort((a, b) => collator.compare(a.front || '', b.front || ''));
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return collator.compare(a, b);
    });
  }, [cards, lang]);

  /**
   * The rail carries the whole alphabet of the language being read, plus any
   * letter that actually turned up — a deck of German words in a Bulgarian
   * interface still gets its Ö.
   */
  const rail = useMemo(() => {
    const present = new Set(sections.map(([letter]) => letter));
    const collator = new Intl.Collator(lang === 'en' ? 'en' : 'bg');
    const sorted = [...present].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : collator.compare(a, b)));
    // A thumb index is only a thumb index once there is something to thumb
    // through. Under a dozen cards the full alphabet is thirty greyed-out
    // letters next to four rows — noise pretending to be navigation.
    if (cards.length < 12) return sorted;
    const base = lang === 'en' ? LATIN : CYRILLIC;
    const extra = sorted.filter((x) => x !== '#' && !base.includes(x));
    return [...base, ...extra, ...(present.has('#') ? ['#'] : [])];
  }, [sections, lang, cards.length]);

  const counts = useMemo(
    () => new Map(sections.map(([letter, list]) => [letter, list.length])),
    [sections],
  );

  const jump = (letter: string) => {
    const node = anchors.current.get(letter);
    if (!node) return;
    setActive(letter);
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!cards.length) {
    return (
      <div className="card-box p-8 text-center">
        <span
          className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-[12px]"
          style={{ background: 'var(--c-surface-3)', color: 'var(--c-faint)' }}
        >
          <Icon name="cards" size={20} />
        </span>
        <p className="text-[13.5px] font-medium">
          {deck
            ? t(L(`„${deck}“ е празно`, `"${deck}" is empty`))
            : t(L('Кутията е празна', 'The box is empty'))}
        </p>
        <p className="mx-auto mt-1 max-w-[380px] text-[12px] text-muted">
          {t(
            L(
              'Всяка нова карта застава зад буквата си. Скоро ще има какво да прелистваш.',
              'Every new card files itself behind its letter. Soon there will be something to flick through.',
            ),
          )}
        </p>
        <Button variant="primary" icon="plus" className="mt-4" onClick={onAdd}>
          {t(L('Нова карта', 'New card'))}
        </Button>
        <div className="card-box-lip -mx-8 -mb-8 mt-7" />
      </div>
    );
  }

  const dueHere = (list: FlashCard[]) => list.filter((c) => !c.suspended && c.due <= Date.now()).length;

  return (
    <div className="card-box overflow-hidden">
      {/* The rail is positioned rather than laid out: as a flex child, thirty
          letters set the height of the whole box, so four cards used to sit
          in four hundred pixels of empty air. */}
      <div className="card-box-well relative flex">
        <div
          ref={scroller}
          className="scroll-thin max-h-[min(64vh,640px)] min-h-[120px] flex-1 overflow-y-auto py-1 pl-3 pr-[34px] sm:pl-4"
        >
          {sections.map(([letter, list], index) => (
            <section key={letter}>
              <div
                ref={(node) => {
                  if (node) anchors.current.set(letter, node);
                  else anchors.current.delete(letter);
                }}
                className="card-divider"
                style={{ background: 'var(--c-surface-2)' }}
              >
                {/* The stagger: five tab positions, cycling, so no two
                    neighbouring dividers hide each other's letter. */}
                <span style={{ width: (index % 5) * 48 }} aria-hidden />
                <button
                  className="card-divider-tab cursor-pointer"
                  style={
                    active === letter
                      ? { color: 'var(--c-accent)', borderColor: 'var(--c-accent)' }
                      : undefined
                  }
                  onClick={() => jump(letter)}
                >
                  {letter}
                </button>
                <span className="card-divider-body">
                  {dueHere(list) > 0 && (
                    <span
                      className="t-num rounded-full px-1.5 py-[1px] text-[10px] font-semibold"
                      style={{
                        background: 'color-mix(in srgb, var(--c-accent) 14%, transparent)',
                        color: 'var(--c-accent)',
                      }}
                    >
                      {t(L(`${dueHere(list)} за преговор`, `${dueHere(list)} due`))}
                    </span>
                  )}
                  <span className="t-num">{list.length}</span>
                </span>
              </div>

              <div className="space-y-1.5 pt-2">
                {list.map((card) => (
                  <IndexCard
                    key={card.id}
                    card={card}
                    onEdit={() => onEdit(card)}
                    onDelete={() => onDelete(card)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ------------------------------------------------ the letter rail */}
        <nav
          aria-label={t(L('Азбучен указател', 'Alphabet index'))}
          className="scroll-none absolute inset-y-0 right-0 w-[26px] overflow-y-auto border-l border-line px-1 py-2 text-center"
          style={{ background: 'var(--c-surface-2)' }}
        >
          {rail.map((letter) => {
            const count = counts.get(letter) ?? 0;
            return (
              <button
                key={letter}
                className="alpha-rail-key"
                data-empty={count ? 'no' : 'yes'}
                data-active={active === letter ? 'yes' : 'no'}
                disabled={!count}
                title={count ? `${letter} · ${count}` : letter}
                onClick={() => jump(letter)}
              >
                {letter}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="card-box-lip" />
    </div>
  );
}

/* ---------------------------------------------------------------- a card */

function IndexCard({
  card,
  onEdit,
  onDelete,
}: {
  card: FlashCard;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const due = card.due <= Date.now() && !card.suspended;

  return (
    <div className="index-card group flex items-center gap-3 px-3 py-2" data-due={due ? 'yes' : 'no'}>
      <Icon
        name={card.kind === 'occlusion' ? 'eyeOff' : 'cards'}
        size={14}
        className="shrink-0"
        style={{ color: due ? 'var(--c-accent)' : 'var(--c-faint)' }}
      />
      <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={onEdit}>
        <div className="truncate text-[13px] font-medium">
          {card.front ||
            (card.kind === 'occlusion'
              ? t(L(`Закритие ${(card.maskIndex ?? 0) + 1}`, `Hidden region ${(card.maskIndex ?? 0) + 1}`))
              : t(L('Без въпрос', 'No question')))}
        </div>
        {card.back && <div className="truncate text-[11.5px] text-muted">{card.back}</div>}
      </button>

      <span className="t-num shrink-0 text-[11px] text-faint">
        {card.suspended
          ? t(L('спряна', 'paused'))
          : card.reps === 0
            ? t(L('нова', 'new'))
            : due
              ? t(L('за преговор', 'due'))
              : t(L(`след ${card.interval} дни`, `in ${card.interval} d`))}
      </span>

      <button
        className="icon-btn h-7 w-7 shrink-0 hover-reveal"
        aria-label={t(card.suspended ? L('Върни', 'Resume') : L('Спри', 'Pause'))}
        title={t(card.suspended ? L('Върни в преговора', 'Put back in the rotation') : L('Спри от преговора', 'Take out of the rotation'))}
        onClick={() => void useCards.getState().save([{ ...card, suspended: !card.suspended, updatedAt: Date.now() }])}
      >
        <Icon name={card.suspended ? 'play' : 'pause'} size={13} />
      </button>
      <button
        className="icon-btn h-7 w-7 shrink-0 hover-reveal"
        onClick={onDelete}
        aria-label={t(S.delete)}
      >
        <Icon name="trash" size={13} />
      </button>
    </div>
  );
}
