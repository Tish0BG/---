import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardGrade, FlashCard } from '@/types';
import { DEFAULT_DECK, decks, dueCount, useCards } from '@/state/cardStore';
import { previewIntervals } from '@/services/cardService';
import { useViewer } from '@/state/viewerStore';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Modal, Popover, useConfirm } from '../ui';
import { CardEditor, type CardDraft } from './CardEditor';
import { CardBox } from './CardBox';
import { DeckBox } from './DeckBox';
import { SUBJECT_COLORS } from '@/state/workspaceStore';
import { useT, L, plural } from '@/i18n';
import { S } from '@/i18n/strings';
import { Button, Card, EmptyState, IconButton, useDragX, useStill } from '../kit';
import { Screen } from '../shell/Screen';

/**
 * The flashcard side of the app: pick a deck, then answer cards until the
 * queue is empty. Opened over everything else, because reviewing is its own
 * activity and nothing else should compete for attention.
 */
export function CardsScreen({
  open,
  onClose,
  embedded = false,
}: {
  open: boolean;
  onClose: () => void;
  /** true when it sits inside the app shell instead of over a document */
  embedded?: boolean;
}) {
  const reviewing = useCards((s) => s.reviewing);
  const [draft, setDraft] = useState<CardDraft | null>(null);

  if (!open) return null;

  const body = (
    <>
      {reviewing ? (
        <ReviewSession onEdit={setDraft} />
      ) : (
        <DeckList onClose={onClose} onEdit={setDraft} embedded={embedded} />
      )}
      <CardEditor open={!!draft} draft={draft} onClose={() => setDraft(null)} />
    </>
  );

  if (embedded) return <div className="flex h-full flex-col">{body}</div>;

  // z-45: a screen, so it covers the viewer — but stays under dialogs (z-50)
  // and under the floating timer (z-66), both of which open on top of it.
  return (
    <div className="fixed inset-0 z-[45] flex flex-col" style={{ background: 'var(--c-bg)' }}>
      {body}
    </div>
  );
}

/* ------------------------------------------------------------- deck list */

/**
 * The box, and the drawers it sits in.
 *
 * A deck is a drawer, the cards inside it stand behind alphabetical dividers,
 * and the one button anybody came here to press — study what is due — is the
 * only thing coloured. Everything else is furniture that stays out of the way
 * until it is wanted.
 */
function DeckList({
  onClose,
  onEdit,
  embedded,
}: {
  onClose: () => void;
  onEdit: (d: CardDraft) => void;
  embedded?: boolean;
}) {
  const t = useT();
  const cards = useCards((s) => s.cards);
  const deckList = useCards((s) => s.deckList);
  const [deck, setDeck] = useState<string | null>(null);
  const [newDeck, setNewDeck] = useState(false);
  const [query, setQuery] = useState('');
  const { confirm, element } = useConfirm();

  const summaries = useMemo(() => decks(cards, deckList), [cards, deckList]);
  const due = dueCount(cards);

  const listed = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase();
    return cards.filter((c) => {
      if (deck && c.deck !== deck) return false;
      if (!clean) return true;
      return `${c.front} ${c.back}`.toLocaleLowerCase().includes(clean);
    });
  }, [cards, deck, query]);

  const scopedDue = listed.filter((c) => !c.suspended && c.due <= Date.now()).length;
  const open = deck === null ? null : summaries.find((x) => x.deck === deck) ?? null;

  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto">
      {element}
      <Screen
        width="default"
        title={
          <span className="flex items-center gap-2">
            {!embedded && <IconButton icon="arrowLeft" label={t(S.back)} onClick={onClose} />}
            {t(S.cards)}
          </span>
        }
        subtitle={t(
          L(
            `${cards.length} ${cards.length === 1 ? 'карта' : 'карти'} в ${summaries.length} ${summaries.length === 1 ? 'тесте' : 'тестета'} · ${due} за преговор днес`,
            `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} across ${summaries.length} ${summaries.length === 1 ? 'deck' : 'decks'} · ${due} due today`,
          ),
        )}
        actions={
          <>
            {/* The label is hidden on a phone, so the button needs a name of
                its own — an icon with no accessible name is a button a screen
                reader announces as "button". */}
            <Button
              variant="outline"
              icon="folderPlus"
              aria-label={t(L('Ново тесте', 'New deck'))}
              onClick={() => setNewDeck(true)}
            >
              <span className="hidden sm:inline">{t(L('Ново тесте', 'New deck'))}</span>
            </Button>
            <Button
              variant="outline"
              icon="plus"
              aria-label={t(L('Нова карта', 'New card'))}
              onClick={() => onEdit({ deck: deck ?? DEFAULT_DECK })}
            >
              <span className="hidden sm:inline">{t(L('Нова карта', 'New card'))}</span>
            </Button>
            <Button
              variant="primary"
              icon="brain"
              disabled={!due}
              onClick={() => useCards.getState().startReview(null)}
            >
              {t(L('Учи', 'Study'))} {due > 0 ? `(${due})` : ''}
            </Button>
          </>
        }
      >
        {cards.length === 0 && summaries.length === 0 ? (
          <Card>
            <EmptyState
              icon="cards"
              title={t(L('Още няма карти', 'No cards yet'))}
              body={t(
                L(
                  'Отвори документ, вземи ножичката (C), очертай задача или схема и избери „Направи карта“. Или добави карта на ръка.',
                  'Open a document, take the snipping tool (C), frame a problem or a diagram and choose "Make a card". Or add one by hand.',
                ),
              )}
              action={{ label: t(L('Нова карта', 'New card')), icon: 'plus', onClick: () => onEdit({ deck: DEFAULT_DECK }) }}
              secondary={{ label: t(L('Ново тесте', 'New deck')), icon: 'folderPlus', onClick: () => setNewDeck(true) }}
            />
          </Card>
        ) : deck === null ? (
          /* Closed: you are looking at the tabs, which is what opening a card
             box actually shows you. The cards are behind a divider, and you
             get to them by pulling one out. */
          <DeckBox summaries={summaries} onOpen={setDeck} />
        ) : (
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <IconButton
                icon="arrowLeft"
                label={t(L('Обратно в кутията', 'Back to the box'))}
                onClick={() => setDeck(null)}
              />
              <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.015em]">
                <span
                  className="h-3.5 w-[3px] shrink-0 rounded-full"
                  style={{ background: open?.color ?? 'var(--c-line-strong)' }}
                  aria-hidden
                />
                <span className="truncate">{deck}</span>
                <span className="t-num text-[12px] font-normal text-faint">{listed.length}</span>
              </h2>

              <span className="flex-1" />

              <label className="flex h-8 items-center gap-1.5 rounded-[9px] border border-line px-2.5 focus-within:border-line-strong">
                <Icon name="search" size={13} className="text-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(L('Търси в тестето', 'Search this deck'))}
                  className="w-[130px] bg-transparent text-[12.5px] outline-none placeholder:text-faint"
                />
                {query && (
                  <button className="cursor-pointer text-faint" aria-label={t(L('Изчисти', 'Clear'))} onClick={() => setQuery('')}>
                    <Icon name="x" size={12} />
                  </button>
                )}
              </label>

              <DeckMenu
                deck={deck}
                color={open?.color ?? 'var(--c-line-strong)'}
                total={open?.total ?? 0}
                onAdd={() => onEdit({ deck })}
                onRenamed={(to) => setDeck(to)}
                onDeleted={() => setDeck(null)}
                confirm={confirm}
              />

              <Button
                variant={scopedDue ? 'primary' : 'ghost'}
                icon="brain"
                disabled={!scopedDue}
                onClick={() => useCards.getState().startReview(deck)}
              >
                {t(L('Учи', 'Study'))} {scopedDue > 0 ? `(${scopedDue})` : ''}
              </Button>
            </div>

            <CardBox
              cards={listed}
              deck={deck}
              onEdit={(card) => onEdit({ card })}
              onAdd={() => onEdit({ deck })}
              onDelete={(card) =>
                confirm(t(L('Да изтрия ли тази карта?', 'Delete this card?')), () =>
                  void useCards.getState().remove([card.id]),
                )
              }
            />
          </section>
        )}
      </Screen>

      <NewDeckDialog
        open={newDeck}
        onClose={() => setNewDeck(false)}
        onCreate={(name) => {
          void useCards
            .getState()
            .createDeck(name)
            .then((made) => setDeck(made));
        }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- decks */

/**
 * A deck, drawn as the front of a drawer.
 *
 * The point of the shape is the same as the point of the box: a set of cards
 * you can *see the size of* is a set you keep. The bar underneath is what is
 * already learned rather than what is left, because the encouraging number is
 * the honest one here — cards leave the queue by being known.
 */
/**
 * Everything you can do to one deck, from inside it.
 *
 * These used to live on the tile in the grid, which meant every deck carried a
 * three-dot button and the grid read as a list of controls. A divider in a box
 * is a divider; you act on a deck once you have pulled it out.
 */
function DeckMenu({
  deck,
  color,
  total,
  onAdd,
  onRenamed,
  onDeleted,
  confirm,
}: {
  deck: string;
  color: string;
  total: number;
  onAdd: () => void;
  onRenamed: (to: string) => void;
  onDeleted: () => void;
  confirm: (message: string, run: () => void) => void;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(deck);

  useEffect(() => setDraft(deck), [deck]);

  if (renaming) {
    return (
      <form
        className="flex h-8 items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = draft.trim();
          setRenaming(false);
          if (!clean || clean === deck) return;
          void useCards.getState().renameDeck(deck, clean);
          onRenamed(clean);
        }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setRenaming(false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') setRenaming(false);
          }}
          className="field h-8 w-[170px] text-[12.5px]"
        />
      </form>
    );
  }

  return (
    <Popover
      width={244}
      align="end"
      trigger={({ toggle, ref }) => (
        <button ref={ref} onClick={toggle} className="icon-btn h-8 w-8" aria-label={t(L('Още', 'More'))}>
          <Icon name="dots" size={15} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2 pb-1.5 pt-1">
            <span className="t-label">{t(L('Цвят на тестето', "The deck's colour"))}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  onClick={() => void useCards.getState().recolourDeck(deck, c)}
                  className="h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    boxShadow: c === color ? '0 0 0 2px var(--c-surface), 0 0 0 3.5px var(--c-text)' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
          <MenuSep />
          <MenuItem
            icon="plus"
            label={t(L('Нова карта тук', 'New card here'))}
            onClick={() => {
              onAdd();
              close();
            }}
          />
          <MenuItem
            icon="pencil"
            label={t(L('Преименувай', 'Rename'))}
            onClick={() => {
              setRenaming(true);
              close();
            }}
          />
          <MenuSep />
          <MenuItem
            icon="archive"
            label={t(L('Махни тестето', 'Remove the deck'))}
            onClick={() => {
              close();
              confirm(
                total
                  ? t(
                      L(
                        `Да махна ли „${deck}“? ${total} карти отиват в „${DEFAULT_DECK}“.`,
                        `Remove "${deck}"? Its ${total} cards move to "${DEFAULT_DECK}".`,
                      ),
                    )
                  : t(L(`Да махна ли „${deck}“?`, `Remove "${deck}"?`)),
                () => {
                  void useCards.getState().deleteDeck(deck, false);
                  onDeleted();
                },
              );
            }}
          />
          {total > 0 && (
          <MenuItem
            icon="trash"
            danger
            label={t(L('Изтрий с картите', 'Delete with its cards'))}
            onClick={() => {
              close();
              confirm(
                t(
                  L(
                    `Да изтрия ли „${deck}“ заедно с ${total} карти?`,
                    `Delete "${deck}" and its ${total} cards?`,
                  ),
                ),
                () => {
                  void useCards.getState().deleteDeck(deck, true);
                  onDeleted();
                },
              );
            }}
          />
          )}
        </>
      )}
    </Popover>
  );
}

function NewDeckDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) setName('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(L('Ново тесте', 'New deck'))}
      width={380}
      footer={
        <>
          <Button onClick={onClose}>{t(S.cancel)}</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              onCreate(name);
              onClose();
            }}
          >
            {t(S.create)}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="t-label mb-1 block">{t(L('Име', 'Name'))}</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && name.trim()) {
              onCreate(name);
              onClose();
            }
          }}
          placeholder={t(L('напр. Неправилни глаголи', 'e.g. Irregular verbs'))}
          className="field"
        />
      </label>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        {t(
          L(
            'Тестето остава, дори докато е празно — ще можеш да го избираш при всяка нова карта.',
            'The deck stays even while it is empty — you can pick it for any new card.',
          ),
        )}
      </p>
    </Modal>
  );
}

/* ---------------------------------------------------------------- review */

const GRADES: { id: CardGrade; label: { bg: string; en: string }; color: string; key: string }[] = [
  { id: 'again', label: L('Отново', 'Again'), color: 'var(--c-danger)', key: '1' },
  { id: 'hard', label: L('Трудно', 'Hard'), color: 'var(--c-warn)', key: '2' },
  { id: 'good', label: L('Добре', 'Good'), color: 'var(--c-accent)', key: '3' },
  { id: 'easy', label: L('Лесно', 'Easy'), color: 'var(--c-success)', key: '4' },
];

function ReviewSession({ onEdit }: { onEdit: (d: CardDraft) => void }) {
  const t = useT();
  const card = useCards((s) => (s.queue.length ? (s.cards.find((c) => c.id === s.queue[0]) ?? null) : null));
  const revealed = useCards((s) => s.revealed);
  const answered = useCards((s) => s.answered);
  const remaining = useCards((s) => s.queue.length);
  const store = useCards.getState;
  const still = useStill();

  const intervals = useMemo(() => (card ? previewIntervals(card) : null), [card]);
  const total = answered + remaining;

  /** Which way the answered card left the table, while it is still leaving. */
  const [gone, setGone] = useState<'left' | 'right' | null>(null);
  const busy = useRef(false);
  const stillRef = useRef(still);
  stillRef.current = still;

  /**
   * Answering is one thing, however it was asked for — a key, a button, or a
   * card thrown off the table. The grade is held back for the length of the
   * toss so the card you graded is the card you watch leave; the store only
   * hears about it once it is gone, and the next card deals in behind it.
   */
  const grade = useCallback((id: CardGrade) => {
    if (busy.current) return;
    busy.current = true;
    const commit = () => {
      setGone(null);
      void useCards
        .getState()
        .answer(id)
        .finally(() => {
          busy.current = false;
        });
    };
    if (stillRef.current) return commit();
    setGone(id === 'again' ? 'left' : 'right');
    window.setTimeout(commit, 320);
  }, []);

  /** A throw past the threshold grades; anything shorter springs back. */
  const { dx, dragging, moved, onPointerDown } = useDragX((travelled) => {
    if (!useCards.getState().revealed) return;
    if (travelled <= -110) grade('again');
    else if (travelled >= 110) grade('good');
  }, revealed && !gone);

  /**
   * Space reveals, 1–4 grade. Reviewing is the one place in the product where
   * the same two keystrokes repeat a hundred times, so they are worth having.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const store = useCards.getState();
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (!store.revealed) store.reveal();
        else grade('good');
        return;
      }
      const picked = GRADES.find((g) => g.key === e.key);
      if (picked && store.revealed) {
        e.preventDefault();
        grade(picked.id);
      }
      if (e.key === 'Escape') store.endReview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grade]);

  if (!card) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <span
            className="animate-pop mx-auto grid h-16 w-16 place-items-center rounded-full text-white"
            style={{ background: 'var(--c-success)' }}
          >
            <Icon name="check" size={30} strokeWidth={2.6} />
          </span>
          <p className="t-h2 mt-5">{t(L('Готово за днес', 'Done for today'))}</p>
          <p className="mt-2 text-[13.5px] text-muted">
            {answered > 0
              ? `${answered} ${t(plural(answered, L('карта', 'card'), L('карти', 'cards')))}${t(L(' — прегледани.', ' reviewed.'))}`
              : t(L('Няма карти за преговор.', 'Nothing is due right now.'))}
          </p>
          <Button variant="primary" size="lg" className="mt-5" onClick={() => store().endReview()}>
            {t(L('Към тестетата', 'Back to the decks'))}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <button className="icon-btn" onClick={() => store().endReview()} aria-label={t(L('Изход', 'Exit'))}>
          <Icon name="x" size={17} />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${total ? (answered / total) * 100 : 0}%`, background: 'var(--c-accent)' }}
          />
        </div>
        <span className="t-num text-[12px] text-muted">
          {answered} / {total}
        </span>
        <button className="icon-btn" onClick={() => onEdit({ card })} title={t(S.edit)} aria-label={t(S.edit)}>
          <Icon name="pencil" size={16} />
        </button>
        {card.docId && (
          <button
            className="icon-btn"
            aria-label={t(L('Отвори източника', 'Open the source'))}
            title={t(L('Отвори източника', 'Open the source'))}
            onClick={() => {
              store().endReview();
              void useViewer.getState().openDocument(card.docId!).then(() => {
                if (card.page) useViewer.getState().goToPage(card.page);
              });
            }}
          >
            <Icon name="file" size={16} />
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-5 sm:px-8">
        <div
          className="study-stack w-full max-w-2xl"
          style={{ height: 'min(58vh, 470px)' }}
        >
          {/* The pile you have left, drawn rather than described. */}
          {Array.from({ length: Math.min(3, remaining - 1) }, (_, i) => (
            <span key={i} className="study-ghost" style={{ '--i': i + 1 } as React.CSSProperties} />
          ))}

          <div
            key={card.id}
            role="button"
            tabIndex={0}
            aria-label={revealed ? t(L('Оцени картата', 'Grade the card')) : t(L('Обърни картата', 'Flip the card'))}
            className="study-card absolute inset-0 cursor-pointer touch-pan-y select-none"
            data-flipped={revealed ? 'yes' : undefined}
            data-gone={gone ?? undefined}
            data-dealt={!gone && !still ? 'yes' : undefined}
            style={
              dragging
                ? {
                    // While a finger is on it the card follows the finger, so
                    // the flip has to be carried along by hand — a transform
                    // in the style attribute replaces the one in the sheet.
                    transform: `translateX(${dx}px) rotate(${((revealed ? -dx : dx) / 26).toFixed(2)}deg) rotateY(${revealed ? 180 : 0}deg)`,
                    transition: 'none',
                  }
                : undefined
            }
            onPointerDown={onPointerDown}
            onClick={() => {
              if (moved.current > 6) return; // that was a throw, not a tap
              if (!revealed) store().reveal();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.code !== 'Space') return;
              e.preventDefault();
              if (!revealed) store().reveal();
              else grade('good');
            }}
          >
            <CardPlane><CardFace card={card} side="front" /></CardPlane>
            <CardPlane back><CardFace card={card} side="back" /></CardPlane>

            {/* What the throw is about to do, shown while it is still undone. */}
            {dragging && revealed && Math.abs(dx) > 40 && (
              <span
                className="pointer-events-none absolute top-5 rounded-full border px-3 py-1 text-[12px] font-semibold uppercase tracking-wide"
                style={{
                  [dx < 0 ? 'left' : 'right']: 20,
                  borderColor: dx < 0 ? 'var(--c-danger)' : 'var(--c-accent)',
                  color: dx < 0 ? 'var(--c-danger)' : 'var(--c-accent)',
                  opacity: Math.min(1, (Math.abs(dx) - 40) / 70),
                  transform: `rotate(${dx < 0 ? -10 : 10}deg)`,
                }}
              >
                {dx < 0 ? t(L('Отново', 'Again')) : t(L('Знам я', 'Got it'))}
              </span>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-line px-4 py-3">
        {revealed ? (
          <div className="mx-auto grid max-w-2xl grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <button
                key={g.id}
                onClick={() => void store().answer(g.id)}
                className="cursor-pointer rounded-[12px] border py-2.5 transition-all hover:-translate-y-0.5"
                style={{ borderColor: g.color, color: g.color }}
              >
                <span className="block text-[13.5px] font-medium">{t(g.label)}</span>
                <span className="t-num block text-[10.5px] opacity-70">{intervals?.[g.id]}</span>
                <span className="mt-1 inline-block rounded px-1 text-[9.5px] opacity-60">{g.key}</span>
              </button>
            ))}
          </div>
        ) : (
          <button className="btn btn-primary btn-lg mx-auto block w-full max-w-2xl" onClick={() => store().reveal()}>
            {t(L('Покажи отговора', 'Show the answer'))}
            <span className="ml-2 opacity-70">(space)</span>
          </button>
        )}
      </footer>
    </div>
  );
}

/**
 * One side of the card: a real surface, with the other one behind it.
 *
 * Both faces sit in the same box and only one of them is ever pointing at you,
 * which is what makes the flip a flip instead of a cross-fade.
 */
function CardPlane({ back, children }: { back?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`study-face scroll-thin absolute inset-0 grid place-items-center overflow-y-auto rounded-[14px] border border-line bg-surface px-6 py-7 ${back ? 'study-face-back' : ''}`}
      style={{ boxShadow: 'var(--shadow-raised)' }}
    >
      {children}
    </div>
  );
}

/** What is written on it. Occlusion cards uncover exactly one hidden region. */
function CardFace({ card, side }: { card: FlashCard; side: 'front' | 'back' }) {
  const t = useT();
  const url = useAssetUrl(card.frontAsset);
  const revealed = side === 'back';

  if (card.kind === 'occlusion' && url) {
    return (
      <div className="w-full max-w-3xl space-y-4">
        {card.front && <p className="text-center text-[14px] text-muted">{card.front}</p>}
        <div className="relative mx-auto overflow-hidden rounded-[10px] border border-line bg-white">
          <img src={url} alt="" className="block w-full" draggable={false} />
          {(card.masks ?? []).map((m, i) => {
            const active = i === card.maskIndex;
            if (active && revealed) {
              return (
                <span
                  key={i}
                  className="absolute rounded-[3px]"
                  style={{
                    left: `${m.x * 100}%`,
                    top: `${m.y * 100}%`,
                    width: `${m.w * 100}%`,
                    height: `${m.h * 100}%`,
                    outline: '2px solid var(--c-success)',
                  }}
                />
              );
            }
            return (
              <span
                key={i}
                className="absolute rounded-[3px]"
                style={{
                  left: `${m.x * 100}%`,
                  top: `${m.y * 100}%`,
                  width: `${m.w * 100}%`,
                  height: `${m.h * 100}%`,
                  background: active ? 'var(--c-accent)' : 'var(--c-line-strong)',
                  outline: active ? '2px solid var(--c-accent)' : 'none',
                }}
              />
            );
          })}
        </div>
        {!revealed && (
          <p className="text-center text-[12px] text-faint">
            {t(L('Кликни, за да видиш скритото', 'Click to reveal what is hidden'))}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-5 text-center">
      {url && (
        <img src={url} alt="" className="mx-auto max-h-[38vh] rounded-[10px] border border-line bg-white object-contain" />
      )}
      {card.front && <p className="text-[19px] leading-snug">{card.front}</p>}
      {revealed ? (
        <div className="border-t border-line pt-5">
          <p className="whitespace-pre-wrap text-[17px] leading-relaxed" style={{ color: 'var(--c-accent)' }}>
            {card.back || '—'}
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-faint">{t(L('Кликни, за да видиш отговора', 'Click to see the answer'))}</p>
      )}
    </div>
  );
}
