import { useEffect, useMemo, useState } from 'react';
import type { CardGrade, FlashCard } from '@/types';
import { DEFAULT_DECK, decks, dueCount, useCards } from '@/state/cardStore';
import { previewIntervals } from '@/services/cardService';
import { useViewer } from '@/state/viewerStore';
import { useLibrary } from '@/state/libraryStore';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Modal, Popover, useConfirm } from '../ui';
import { CardEditor, type CardDraft } from './CardEditor';
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
  const documents = useLibrary((s) => s.documents);
  const [deck, setDeck] = useState<string | null>(null);
  const [newDeck, setNewDeck] = useState(false);
  const { confirm, element } = useConfirm();

  const summaries = useMemo(() => decks(cards, deckNames), [cards, deckNames]);
  const due = dueCount(cards);
  const listed = deck ? cards.filter((c) => c.deck === deck) : cards;

  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto">
      {element}
      <Screen
        width="default"
        title={
          <span className="flex items-center gap-2">
            {!embedded && (
              <IconButton icon="arrowLeft" label={t(S.back)} onClick={onClose} />
            )}
            {t(S.cards)}
          </span>
        }
        subtitle={t(
          L(
            `${cards.length} карти · ${due} за преговор днес`,
            `${cards.length} cards · ${due} due today`,
          ),
        )}
        actions={
          <>
            <Button variant="outline" icon="folderPlus" onClick={() => setNewDeck(true)}>
              <span className="hidden sm:inline">{t(L('Ново тесте', 'New deck'))}</span>
            </Button>
            <Button variant="outline" icon="plus" onClick={() => onEdit({ deck: deck ?? DEFAULT_DECK })}>
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
                  'Отвори учебник, вземи ножичката (C), очертай задача или схема и избери „Направи карта“. Или добави карта на ръка.',
                  'Open a textbook, take the snipping tool (C), frame a problem or a diagram and choose "Make a card". Or add one by hand.',
                ),
              )}
              action={{ label: t(L('Нова карта', 'New card')), icon: 'plus', onClick: () => onEdit({ deck: DEFAULT_DECK }) }}
              secondary={{ label: t(L('Ново тесте', 'New deck')), icon: 'folderPlus', onClick: () => setNewDeck(true) }}
            />
          </Card>
        ) : (
          <>
            <section className="mb-6">
              <h2 className="t-label mb-2">{t(L('Тестета', 'Decks'))}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {summaries.map((s) => (
                  <DeckCard
                    key={s.deck}
                    summary={s}
                    active={deck === s.deck}
                    onPick={() => setDeck(deck === s.deck ? null : s.deck)}
                    onAdd={() => onEdit({ deck: s.deck })}
                    onDelete={(withCards) =>
                      confirm(
                        t(
                          withCards
                            ? L(`Да изтрия ли „${s.deck}“ заедно с ${s.total} карти?`, `Delete "${s.deck}" and its ${s.total} cards?`)
                            : L(`Да махна ли тестето „${s.deck}“? Картите ще отидат в „${DEFAULT_DECK}“.`, `Remove the deck "${s.deck}"? Its cards move to "${DEFAULT_DECK}".`),
                        ),
                        () => void useCards.getState().deleteDeck(s.deck, withCards),
                      )
                    }
                  />
                ))}
              </div>
            </section>

            <section>
              <h2 className="t-label mb-2">
                {deck ? t(L(`Карти в „${deck}“`, `Cards in "${deck}"`)) : t(L('Всички карти', 'All cards'))} (
                {listed.length})
              </h2>
              {listed.length === 0 && (
                <button
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-6 text-[12.5px] text-muted transition-colors hover:bg-surface-2"
                  onClick={() => onEdit({ deck: deck ?? DEFAULT_DECK })}
                >
                  <Icon name="plus" size={15} />
                  {t(L('Добави първата карта', 'Add the first card'))}
                </button>
              )}
              <div className="space-y-1">
                {listed.map((c) => (
                  <CardRow
                    key={c.id}
                    card={c}
                    docName={documents.find((d) => d.id === c.docId)?.name}
                    onEdit={() => onEdit({ card: c })}
                    onDelete={() =>
                      confirm(t(L('Да изтрия ли тази карта?', 'Delete this card?')), () =>
                        void useCards.getState().remove([c.id]),
                      )
                    }
                  />
                ))}
              </div>
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

function DeckCard({
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
  const share = summary.total ? 1 - summary.due / summary.total : 1;

  return (
    <div
      className="card flex items-center gap-3 p-3.5 transition-shadow"
      style={active ? { boxShadow: '0 0 0 2px var(--c-accent)' } : undefined}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{
          background: summary.due ? 'color-mix(in srgb, var(--c-accent) 14%, transparent)' : 'var(--c-surface-3)',
          color: summary.due ? 'var(--c-accent)' : 'var(--c-faint)',
        }}
      >
        <Icon name="cards" size={17} />
      </span>

      {renaming ? (
        <form
          className="flex min-w-0 flex-1 gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void useCards.getState().renameDeck(summary.deck, name);
            setRenaming(false);
          }}
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field h-7" />
          <button className="btn h-7 px-2" type="submit">
            <Icon name="check" size={14} />
          </button>
        </form>
      ) : (
        <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={onPick}>
          <div className="truncate text-[13px] font-medium">{summary.deck}</div>
          <div className="text-[11px] text-muted">
            {summary.total === 0
              ? t(L('празно тесте', 'empty deck'))
              : t(
                  L(
                    `${summary.total} карти${summary.due > 0 ? ` · ${summary.due} за преговор` : ' · всичко е наред'}`,
                    `${summary.total} cards${summary.due > 0 ? ` · ${summary.due} due` : ' · all caught up'}`,
                  ),
                )}
          </div>
          {summary.total > 0 && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: 'var(--c-surface-3)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${share * 100}%`, background: 'var(--c-success)' }}
              />
            </div>
          )}
        </button>
      )}

      <Button
        variant={summary.due ? 'soft' : 'ghost'}
        className="shrink-0"
        disabled={!summary.due}
        onClick={() => useCards.getState().startReview(summary.deck)}
      >
        {t(L('Учи', 'Study'))}
      </Button>
      <Popover
        width={200}
        align="end"
        trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn h-8 w-8 shrink-0" onClick={toggle} aria-label={t(L('Още', 'More'))}>
            <Icon name="dots" size={16} />
          </button>
        )}
      >
        {(close) => (
          <>
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

function CardRow({
  card,
  docName,
  onEdit,
  onDelete,
}: {
  card: FlashCard;
  docName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const overdue = card.due <= Date.now();
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2">
      <Icon
        name={card.kind === 'occlusion' ? 'eyeOff' : 'cards'}
        size={15}
        className="shrink-0"
        style={{ color: overdue ? 'var(--c-accent)' : 'var(--c-faint)' }}
      />
      <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={onEdit}>
        <div className="truncate text-[13px]">
          {card.front ||
            (card.kind === 'occlusion'
              ? t(L(`Закритие ${(card.maskIndex ?? 0) + 1}`, `Hidden region ${(card.maskIndex ?? 0) + 1}`))
              : t(L('Без въпрос', 'No question')))}
        </div>
        <div className="truncate text-[11px] text-muted">
          {docName ? `${docName}${card.page ? `, ${t(L('стр.', 'p.'))} ${card.page}` : ''} · ` : ''}
          {card.reps === 0
            ? t(L('нова', 'new'))
            : overdue
              ? t(L('за преговор', 'due'))
              : t(L(`след ${card.interval} дни`, `in ${card.interval} days`))}
        </div>
      </button>
      <button
        className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100"
        onClick={onDelete}
        aria-label={t(S.delete)}
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
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
        <div className="relative mx-auto overflow-hidden rounded-xl border border-line bg-white">
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
        <img src={url} alt="" className="mx-auto max-h-[38vh] rounded-xl border border-line bg-white object-contain" />
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
