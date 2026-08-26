import { useEffect, useMemo, useState } from 'react';
import type { CardGrade, FlashCard } from '@/types';
import { DEFAULT_DECK, decks, dueCount, useCards } from '@/state/cardStore';
import { previewIntervals } from '@/services/cardService';
import { useViewer } from '@/state/viewerStore';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Modal, Popover, useConfirm } from '../ui';
import { CardEditor, type CardDraft } from './CardEditor';
import { CardBox } from './CardBox';
import { useT, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { Button, Card, EmptyState, IconButton } from '../kit';
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
  const deckNames = useCards((s) => s.deckNames);
  const [deck, setDeck] = useState<string | null>(null);
  const [newDeck, setNewDeck] = useState(false);
  const [query, setQuery] = useState('');
  const { confirm, element } = useConfirm();

  const summaries = useMemo(() => decks(cards, deckNames), [cards, deckNames]);
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
        ) : (
          <>
            {/* ------------------------------------------------ the drawers */}
            <section className="mb-5">
              <h2 className="t-label mb-2">{t(L('Тестета', 'Decks'))}</h2>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  className="drawer-front"
                  data-active={deck === null ? 'yes' : 'no'}
                  onClick={() => setDeck(null)}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <Icon name="layers" size={14} className="text-faint" />
                    {t(L('Цялата кутия', 'The whole box'))}
                  </span>
                  <span className="text-[11.5px] text-muted">
                    {t(
                      L(
                        `${cards.length} ${cards.length === 1 ? 'карта' : 'карти'}${due ? ` · ${due} за преговор` : ''}`,
                        `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}${due ? ` · ${due} due` : ''}`,
                      ),
                    )}
                  </span>
                </button>

                {summaries.map((summary) => (
                  <DrawerFront
                    key={summary.deck}
                    summary={summary}
                    active={deck === summary.deck}
                    onPick={() => setDeck(summary.deck)}
                    onAdd={() => onEdit({ deck: summary.deck })}
                    onDelete={(withCards) =>
                      confirm(
                        t(
                          withCards
                            ? L(`Да изтрия ли „${summary.deck}“ заедно с ${summary.total} карти?`, `Delete "${summary.deck}" and its ${summary.total} cards?`)
                            : L(`Да махна ли тестето „${summary.deck}“? Картите ще отидат в „${DEFAULT_DECK}“.`, `Remove the deck "${summary.deck}"? Its cards move to "${DEFAULT_DECK}".`),
                        ),
                        () => void useCards.getState().deleteDeck(summary.deck, withCards),
                      )
                    }
                  />
                ))}
              </div>
            </section>

            {/* ---------------------------------------------------- the box */}
            <section>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="t-label flex-1">
                  {deck ? t(L(`Тесте „${deck}“`, `Deck "${deck}"`)) : t(L('Всички карти', 'All cards'))}
                  <span className="t-num ml-2 font-normal normal-case tracking-normal text-faint">
                    {listed.length}
                  </span>
                </h2>
                <label className="flex h-8 items-center gap-1.5 rounded-[9px] border border-line px-2.5 focus-within:border-line-strong">
                  <Icon name="search" size={13} className="text-faint" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t(L('Търси в кутията', 'Search the box'))}
                    className="w-[150px] bg-transparent text-[12.5px] outline-none placeholder:text-faint"
                  />
                  {query && (
                    <button className="cursor-pointer text-faint" aria-label={t(L('Изчисти', 'Clear'))} onClick={() => setQuery('')}>
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </label>
                <Button
                  variant={scopedDue ? 'soft' : 'ghost'}
                  icon="brain"
                  disabled={!scopedDue}
                  onClick={() => useCards.getState().startReview(deck)}
                >
                  {t(L('Учи оттук', 'Study this'))} {scopedDue > 0 ? `(${scopedDue})` : ''}
                </Button>
              </div>

              <CardBox
                cards={listed}
                deck={deck}
                onEdit={(card) => onEdit({ card })}
                onAdd={() => onEdit({ deck: deck ?? DEFAULT_DECK })}
                onDelete={(card) =>
                  confirm(t(L('Да изтрия ли тази карта?', 'Delete this card?')), () =>
                    void useCards.getState().remove([card.id]),
                  )
                }
              />
            </section>
          </>
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
function DrawerFront({
  summary,
  active,
  onPick,
  onAdd,
  onDelete,
}: {
  summary: { deck: string; total: number; due: number };
  active: boolean;
  onPick: () => void;
  onAdd: () => void;
  onDelete: (withCards: boolean) => void;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(summary.deck);
  const known = summary.total ? 1 - summary.due / summary.total : 1;

  if (renaming) {
    return (
      <form
        className="drawer-front flex-row items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void useCards.getState().renameDeck(summary.deck, name);
          setRenaming(false);
        }}
      >
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field h-7 flex-1" />
        <button className="btn h-7 px-2" type="submit">
          <Icon name="check" size={14} />
        </button>
      </form>
    );
  }

  return (
    <div
      /* A drawer front holds its own menu button, so it cannot be a <button>
         itself — nesting one inside another is invalid and breaks the click
         target. It takes the role and the keys by hand instead, which is what
         a keyboard needs to reach it at all. */
      role="button"
      tabIndex={0}
      aria-pressed={active}
      className="drawer-front"
      data-active={active ? 'yes' : 'no'}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px]"
          style={{
            background: summary.due ? 'color-mix(in srgb, var(--c-accent) 14%, transparent)' : 'var(--c-surface-3)',
            color: summary.due ? 'var(--c-accent)' : 'var(--c-faint)',
          }}
        >
          <Icon name="cards" size={13} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{summary.deck}</span>
        <Popover
          width={210}
          align="end"
          trigger={({ toggle, ref }) => (
            <button
              ref={ref}
              className="icon-btn h-7 w-7 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              aria-label={t(L('Още', 'More'))}
            >
              <Icon name="dots" size={15} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon="brain"
                label={t(L('Учи това тесте', 'Study this deck'))}
                onClick={() => {
                  useCards.getState().startReview(summary.deck);
                  close();
                }}
              />
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
                  setName(summary.deck);
                  setRenaming(true);
                  close();
                }}
              />
              <MenuSep />
              <MenuItem
                icon="archive"
                label={t(L('Махни тестето', 'Remove the deck'))}
                onClick={() => {
                  onDelete(false);
                  close();
                }}
              />
              <MenuItem
                icon="trash"
                label={t(L('Изтрий с картите', 'Delete with its cards'))}
                danger
                onClick={() => {
                  onDelete(true);
                  close();
                }}
              />
            </>
          )}
        </Popover>
      </div>

      <span className="text-[11.5px] text-muted">
        {summary.total === 0
          ? t(L('празно чекмедже', 'empty drawer'))
          : t(
              L(
                `${summary.total} ${summary.total === 1 ? 'карта' : 'карти'}${summary.due > 0 ? ` · ${summary.due} за преговор` : ' · всичко е наред'}`,
                `${summary.total} ${summary.total === 1 ? 'card' : 'cards'}${summary.due > 0 ? ` · ${summary.due} due` : ' · all caught up'}`,
              ),
            )}
      </span>

      {summary.total > 0 && (
        <span className="mt-1 block h-1 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
          <span
            className="block h-full rounded-full"
            style={{ width: `${known * 100}%`, background: 'var(--c-success)' }}
          />
        </span>
      )}
    </div>
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

  const intervals = useMemo(() => (card ? previewIntervals(card) : null), [card]);
  const total = answered + remaining;

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
        else void store.answer('good');
        return;
      }
      const grade = GRADES.find((g) => g.key === e.key);
      if (grade && store.revealed) {
        e.preventDefault();
        void store.answer(grade.id);
      }
      if (e.key === 'Escape') store.endReview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
              ? t(L(`Прегледа ${answered} карти.`, `You reviewed ${answered} cards.`))
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

      <button
        className="scroll-thin flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-5 overflow-y-auto px-5 py-6"
        onClick={() => !revealed && store().reveal()}
      >
        <CardFace card={card} revealed={revealed} />
      </button>

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

/** The card itself. Occlusion cards reveal exactly one hidden region. */
function CardFace({ card, revealed }: { card: FlashCard; revealed: boolean }) {
  const t = useT();
  const url = useAssetUrl(card.frontAsset);

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
