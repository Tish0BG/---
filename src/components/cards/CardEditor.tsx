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
  const deckNames = useCards((s) => s.deckNames);

  /** Every deck that exists, whether or not it already holds a card. */
  const deckOptions = useMemo<SelectOption[]>(
    () =>
      decks(cards, [...deckNames, DEFAULT_DECK]).map((d) => ({
        value: d.deck,
        label: d.deck,
        hint: d.total ? `${d.total}` : 'празно',
      })),
    [cards, deckNames],
  );

  const subjectOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Без предмет', icon: 'layers' },
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
        editing ? 'Картата е запазена' : kind === 'occlusion' ? `${masks.length} карти са създадени` : 'Картата е създадена',
        `в тестето „${base.deck}“`,
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
      title={editing ? 'Редакция на карта' : 'Нова карта'}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Отказ
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !canSave}>
            <Icon name="cards" size={14} />
            {kind === 'occlusion' && masks.length > 1 ? `Запази ${masks.length} карти` : 'Запази'}
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        {imageUrl && (
          <div className="flex gap-1.5">
            {(
              [
                ['basic', 'Въпрос и отговор'],
                ['occlusion', 'Закрий части'],
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
            {kind === 'occlusion' ? 'Подсказка (по избор)' : 'Лице — въпросът'}
          </span>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={2}
            placeholder={kind === 'occlusion' ? 'напр. Части на клетката' : 'Какво питаш?'}
            className="field h-auto py-1.5 leading-snug"
          />
        </label>

        {kind === 'basic' && (
          <label className="block">
            <span className="mb-1 block label">
              Гръб — отговорът
            </span>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              rows={3}
              placeholder="Отговорът или обяснението"
              className="field h-auto py-1.5 leading-snug"
            />
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block label">Тесте</span>
            <Select
              value={deck}
              options={deckOptions}
              onChange={setDeck}
              width={230}
              createLabel="Ново тесте…"
              onCreate={(name) => {
                void useCards
                  .getState()
                  .createDeck(name)
                  .then(setDeck);
              }}
            />
          </label>

          <label className="block">
            <span className="mb-1 block label">Предмет</span>
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
