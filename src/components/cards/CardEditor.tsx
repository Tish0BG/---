import { useEffect, useMemo, useState } from 'react';
import type { CardKind, FlashCard, Rect } from '@/types';
import { DEFAULT_DECK, decks, useCards } from '@/state/cardStore';
import { newCard, occlusionCards, storeCardImage } from '@/services/cardService';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { notify } from '@/state/toastStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { Modal, Select, type SelectOption } from '../ui';
import { Icon } from '../Icon';
import { MaskEditor } from './MaskEditor';
import { useT, L } from '@/i18n';

export interface CardDraft {
  /** picture the card is being built from, if any */
  image?: Blob | null;
  /** already-stored asset (when editing) */
  card?: FlashCard | null;
  docId?: string | null;
  page?: number | null;
  deck?: string;
}

/**
 * One dialog for both card shapes: a plain question/answer pair, or an image
 * with hidden regions that expands into one card per region.
 */
export function CardEditor({
  open,
  draft,
  onClose,
}: {
  open: boolean;
  draft: CardDraft | null;
  onClose: () => void;
}) {
  const t = useT();
  const editing = draft?.card ?? null;
  const [kind, setKind] = useState<CardKind>('basic');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [deck, setDeck] = useState(DEFAULT_DECK);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [masks, setMasks] = useState<Rect[]>([]);
  const [busy, setBusy] = useState(false);
  const subjects = useWorkspace((s) => s.subjects);
  const documents = useLibrary((s) => s.documents);
  const cards = useCards((s) => s.cards);
  const deckList = useCards((s) => s.deckList);

  /** Every deck that exists, whether or not it already holds a card. */
  const deckOptions = useMemo<SelectOption[]>(
    () =>
      decks(cards, deckList).map((d) => ({
        value: d.deck,
        label: d.deck,
        color: d.color,
        hint: d.total ? `${d.total}` : t(L("празно", "empty")),
      })),
    [cards, deckList],
  );

  const subjectOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: t(L("Без предмет", "No subject")), icon: 'layers' },
      ...subjects.map((s) => ({ value: s.id, label: s.name, color: s.color, icon: s.icon })),
    ],
    [subjects],
  );

  const blobUrl = useMemo(() => (draft?.image ? URL.createObjectURL(draft.image) : null), [draft?.image]);
  useEffect(() => () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);
  const storedUrl = useAssetUrl(editing?.frontAsset);
  const imageUrl = blobUrl ?? storedUrl;

  useEffect(() => {
    if (!open) return;
    setKind(editing?.kind ?? 'basic');
    setFront(editing?.front ?? '');
    setBack(editing?.back ?? '');
    setDeck(editing?.deck ?? draft?.deck ?? DEFAULT_DECK);
    setMasks(editing?.masks ?? []);
    // A card cut from a material belongs to that material's subject.
    const sourceDoc = documents.find((d) => d.id === (draft?.docId ?? editing?.docId));
    setSubjectId(editing?.subjectId ?? sourceDoc?.subjectId ?? null);
  }, [open, editing, draft?.deck, draft?.docId, documents]);

  const save = async () => {
    setBusy(true);
    try {
      const assetId = draft?.image
        ? await storeCardImage(draft.image)
        : (editing?.frontAsset ?? null);
      const base = {
        docId: draft?.docId ?? editing?.docId ?? null,
        page: draft?.page ?? editing?.page ?? null,
        deck: deck.trim() || DEFAULT_DECK,
        subjectId,
        front,
        back,
      };

      /**
       * The deck exists before the card does.
       *
       * A deck used to be nothing but a string repeated on every card, so one
       * created this way lived only as long as a card pointed at it — empty it
       * and the divider vanished from the box. `createDeck` is a no-op for a
       * name already registered, which is the case every time but the first.
       */
      await useCards.getState().createDeck(base.deck);

      if (kind === 'occlusion' && assetId && masks.length) {
        if (editing?.groupId) {
          // keep scheduling for the masks that survived the edit
          const siblings = useCards
            .getState()
            .cards.filter((c) => c.groupId === editing.groupId)
            .sort((a, b) => (a.maskIndex ?? 0) - (b.maskIndex ?? 0));
          const kept = masks.map((_, i) =>
            siblings[i]
              ? { ...siblings[i], ...base, masks, maskIndex: i, updatedAt: Date.now() }
              : newCard({ ...base, kind: 'occlusion', frontAsset: assetId, masks, maskIndex: i, groupId: editing.groupId }),
          );
          await useCards.getState().save(kept);
          const dropped = siblings.slice(masks.length).map((c) => c.id);
          if (dropped.length) await useCards.getState().remove(dropped);
        } else {
          await useCards.getState().save(occlusionCards(base, assetId, masks));
        }
      } else {
        const card = editing
          ? { ...editing, ...base, kind: 'basic' as const, frontAsset: assetId, updatedAt: Date.now() }
          : newCard({ ...base, kind: 'basic', frontAsset: assetId });
        await useCards.getState().save([card]);
      }
      notify.ok(
        editing
          ? t(L('Картата е запазена', 'Card saved'))
          : kind === 'occlusion'
            ? t(L(`${masks.length} карти са създадени`, `${masks.length} cards created`))
            : t(L('Картата е създадена', 'Card created')),
        t(L(`в тестето „${base.deck}“`, `in the deck "${base.deck}"`)),
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const canSave = kind === 'occlusion' ? masks.length > 0 : !!(front.trim() || imageUrl);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t(L("Редакция на карта", "Edit card")) : t(L("Нова карта", "New card"))}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            {t(L("Отказ", "Cancel"))}
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !canSave}>
            <Icon name="cards" size={14} />
            {kind === 'occlusion' && masks.length > 1
              ? t(L(`Запази ${masks.length} карти`, `Save ${masks.length} cards`))
              : t(L('Запази', 'Save'))}
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        {imageUrl && (
          <div className="flex gap-1.5">
            {(
              [
                ['basic', t(L("Въпрос и отговор", "Question and answer"))],
                ['occlusion', t(L("Закрий части", "Hide regions"))],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`btn flex-1 ${kind === id ? 'btn-ghost-active' : ''}`}
                onClick={() => setKind(id)}
              >
                <Icon name={id === 'basic' ? 'type' : 'eyeOff'} size={14} />
                {label}
              </button>
            ))}
          </div>
        )}

        {imageUrl &&
          (kind === 'occlusion' ? (
            <MaskEditor src={imageUrl} masks={masks} onChange={setMasks} />
          ) : (
            <img
              src={imageUrl}
              alt=""
              className="max-h-52 w-full rounded-lg border border-line bg-white object-contain"
            />
          ))}

        <label className="block">
          <span className="mb-1 block label">
            {kind === 'occlusion' ? t(L("Подсказка (по избор)", "Hint (optional)")) : t(L("Лице — въпросът", "Front — the question"))}
          </span>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={2}
            placeholder={kind === 'occlusion' ? t(L("напр. Части на клетката", "e.g. Parts of a cell")) : t(L("Какво питаш?", "What are you asking?"))}
            className="field h-auto py-1.5 leading-snug"
          />
        </label>

        {kind === 'basic' && (
          <label className="block">
            <span className="mb-1 block label">
              {t(L("Гръб — отговорът", "Back — the answer"))}
            </span>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              rows={3}
              placeholder={t(L("Отговорът или обяснението", "The answer, or the explanation"))}
              className="field h-auto py-1.5 leading-snug"
            />
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block label">{t(L("Тесте", "Deck"))}</span>
            <Select
              value={deck}
              options={deckOptions}
              onChange={setDeck}
              width={230}
              createLabel={t(L("Ново тесте…", "New deck…"))}
              onCreate={(name) => {
                void useCards
                  .getState()
                  .createDeck(name)
                  .then(setDeck);
              }}
            />
          </label>

          <label className="block">
            <span className="mb-1 block label">{t(L("Предмет", "Subject"))}</span>
            <Select
              value={subjectId ?? ''}
              options={subjectOptions}
              onChange={(v) => setSubjectId(v || null)}
              width={230}
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}
