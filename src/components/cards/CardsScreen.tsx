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
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        {!embedded && (
          <button className="icon-btn" onClick={onClose} aria-label="Назад">
            <Icon name="arrowLeft" size={17} />
          </button>
        )}
        <h1
          className="flex-1 font-semibold leading-none"
          style={{ fontSize: 'var(--text-section)', letterSpacing: 'var(--track-section)' }}
        >
          Флашкарти
        </h1>
        <button className="btn" onClick={() => setNewDeck(true)}>
          <Icon name="folderPlus" size={15} />
          <span className="hidden sm:inline">Ново тесте</span>
        </button>
        <button className="btn" onClick={() => onEdit({ deck: deck ?? DEFAULT_DECK })}>
          <Icon name="plus" size={15} />
          <span className="hidden sm:inline">Нова карта</span>
        </button>
        <button
          className="btn btn-primary"
          disabled={!due}
          onClick={() => useCards.getState().startReview(null)}
        >
          <Icon name="brain" size={15} />
          Учи {due > 0 ? `(${due})` : ''}
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        {cards.length === 0 && summaries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong py-16 text-center">
            <Icon name="cards" size={28} className="text-faint" />
            <p className="text-[14px] font-medium">Още няма карти</p>
            <p className="max-w-sm text-[12px] leading-relaxed text-muted">
              Отвори учебник, вземи ножичката (<b>C</b>), очертай задача или схема и избери
              „Направи карта“. Или добави карта на ръка.
            </p>
            <div className="mt-1 flex gap-2">
              <button className="btn" onClick={() => setNewDeck(true)}>
                <Icon name="folderPlus" size={15} />
                Ново тесте
              </button>
              <button className="btn btn-primary" onClick={() => onEdit({ deck: DEFAULT_DECK })}>
                <Icon name="plus" size={15} />
                Нова карта
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="mb-6">
              <h2 className="mb-2 label">Тестета</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {summaries.map((s) => (
                  <DeckCard
                    key={s.deck}
                    summary={s}
                    active={deck === s.deck}
                    onPick={() => setDeck(deck === s.deck ? null : s.deck)}
                    onAdd={() => onEdit({ deck: s.deck })}
                    onDelete={(withCards) =>
                      confirm(
                        withCards
                          ? `Да изтрия ли „${s.deck}“ заедно с ${s.total} карти?`
                          : `Да махна ли тестето „${s.deck}“? Картите ще отидат в „${DEFAULT_DECK}“.`,
                        () => void useCards.getState().deleteDeck(s.deck, withCards),
                      )
                    }
                  />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 label">
                {deck ? `Карти в „${deck}“` : 'Всички карти'} ({listed.length})
              </h2>
              {listed.length === 0 && (
                <button
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-6 text-[12.5px] text-muted transition-colors hover:bg-surface-2"
                  onClick={() => onEdit({ deck: deck ?? DEFAULT_DECK })}
                >
                  <Icon name="plus" size={15} />
                  Добави първата карта{deck ? ` в „${deck}“` : ''}
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
                      confirm('Да изтрия ли тази карта?', () => void useCards.getState().remove([c.id]))
                    }
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

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
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(summary.deck);
  const share = summary.total ? 1 - summary.due / summary.total : 1;

  return (
    <div
      className="panel flex items-center gap-3 p-3 transition-shadow"
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
              ? 'празно тесте'
              : `${summary.total} карти${summary.due > 0 ? ` · ${summary.due} за преговор` : ' · всичко е наред'}`}
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

      <button
        className="btn shrink-0"
        disabled={!summary.due}
        onClick={() => useCards.getState().startReview(summary.deck)}
      >
        Учи
      </button>
      <Popover
        width={200}
        align="end"
        trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn h-8 w-8 shrink-0" onClick={toggle} aria-label="Още">
            <Icon name="dots" size={16} />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon="plus"
              label="Нова карта тук"
              onClick={() => {
                onAdd();
                close();
              }}
            />
            <MenuItem
              icon="pencil"
              label="Преименувай"
              onClick={() => {
                setName(summary.deck);
                setRenaming(true);
                close();
              }}
            />
            <MenuSep />
            <MenuItem
              icon="archive"
              label="Махни тестето"
              onClick={() => {
                onDelete(false);
                close();
              }}
            />
            <MenuItem
              icon="trash"
              label="Изтрий с картите"
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
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) setName('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ново тесте"
      width={380}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Отказ
          </button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() => {
              onCreate(name);
              onClose();
            }}
          >
            Създай
          </button>
        </>
      }
    >
      <label className="block">
        <span className="mb-1 block label">Име</span>
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
          placeholder="напр. Неправилни глаголи"
          className="field"
        />
      </label>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Тестето остава, дори докато е празно — ще можеш да го избираш от падащото меню при всяка
        нова карта.
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
          {card.front || (card.kind === 'occlusion' ? `Закритие ${(card.maskIndex ?? 0) + 1}` : 'Без въпрос')}
        </div>
        <div className="truncate text-[11px] text-muted">
          {docName ? `${docName}${card.page ? `, стр. ${card.page}` : ''} · ` : ''}
          {card.reps === 0
            ? 'нова'
            : overdue
              ? 'за преговор'
              : `след ${card.interval} ${card.interval === 1 ? 'ден' : 'дни'}`}
        </div>
      </button>
      <button className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100" onClick={onDelete}>
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- review */

const GRADES: { id: CardGrade; label: string; color: string }[] = [
  { id: 'again', label: 'Отново', color: 'var(--c-danger)' },
  { id: 'hard', label: 'Трудно', color: 'var(--c-warn)' },
  { id: 'good', label: 'Добре', color: 'var(--c-accent)' },
  { id: 'easy', label: 'Лесно', color: 'var(--c-success)' },
];

function ReviewSession({ onEdit }: { onEdit: (d: CardDraft) => void }) {
  const card = useCards((s) => (s.queue.length ? (s.cards.find((c) => c.id === s.queue[0]) ?? null) : null));
  const revealed = useCards((s) => s.revealed);
  const answered = useCards((s) => s.answered);
  const remaining = useCards((s) => s.queue.length);
  const store = useCards.getState;

  const intervals = useMemo(() => (card ? previewIntervals(card) : null), [card]);
  const total = answered + remaining;

  if (!card) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <Icon name="checkCircle" size={34} className="mx-auto mb-3" style={{ color: 'var(--c-success)' }} />
          <p className="text-[16px] font-medium">Готово за днес</p>
          <p className="mt-1 text-[13px] text-muted">
            {answered > 0 ? `Прегледа ${answered} карти.` : 'Няма карти за преговор.'}
          </p>
          <button className="btn btn-primary mt-4" onClick={() => store().endReview()}>
            Към тестетата
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <button className="icon-btn" onClick={() => store().endReview()} aria-label="Изход">
          <Icon name="x" size={17} />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${total ? (answered / total) * 100 : 0}%`, background: 'var(--c-accent)' }}
          />
        </div>
        <span className="text-[12px] tabular-nums text-muted">
          {answered} / {total}
        </span>
        <button className="icon-btn" onClick={() => onEdit({ card })} title="Редактирай">
          <Icon name="pencil" size={16} />
        </button>
        {card.docId && (
          <button
            className="icon-btn"
            title="Отвори източника"
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
                className="cursor-pointer rounded-xl border py-2 transition-colors"
                style={{ borderColor: g.color, color: g.color }}
              >
                <span className="block text-[13px] font-medium">{g.label}</span>
                <span className="block text-[10px] opacity-70">{intervals?.[g.id]}</span>
              </button>
            ))}
          </div>
        ) : (
          <button className="btn btn-primary mx-auto block w-full max-w-2xl" onClick={() => store().reveal()}>
            Покажи отговора
          </button>
        )}
      </footer>
    </div>
  );
}

/** The card itself. Occlusion cards reveal exactly one hidden region. */
function CardFace({ card, revealed }: { card: FlashCard; revealed: boolean }) {
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
        {!revealed && <p className="text-center text-[12px] text-faint">Кликни, за да видиш скритото</p>}
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
        <p className="text-[12px] text-faint">Кликни, за да видиш отговора</p>
      )}
    </div>
  );
}
