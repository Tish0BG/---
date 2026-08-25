import { useEffect, useMemo, useState } from 'react';
import type { PlannerItem } from '@/types';
import { useLibrary } from '@/state/libraryStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes, allTypes, typeName } from '@/state/itemTypeStore';
import { usePlanner, startOfDay } from '@/state/plannerStore';
import { useT, useLang, L } from '@/i18n';
import { S, PRIORITY } from '@/i18n/strings';
import { Select } from '../ui';
import { Button, Segmented } from '../kit';
import { Icon } from '../Icon';
import { isoDay } from '../shell/QuickCreate';

const DURATIONS = [0, 15, 30, 45, 60, 90, 120];

/**
 * Everything one entry can carry.
 *
 * The type is the first field rather than a footnote, because it is the field
 * that decides how the entry reads everywhere else — which icon it wears in
 * the list, whether it gets a countdown, what colour it is on the calendar.
 */
export function TaskEditor({ item, onClose }: { item: PlannerItem; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const allSubjects = useWorkspace((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const custom = useItemTypes((s) => s.custom);
  const types = useMemo(() => allTypes(custom), [custom]);
  const documents = useLibrary((s) => s.documents);
  const [draft, setDraft] = useState(item);

  useEffect(() => setDraft(item), [item]);

  const save = async () => {
    await usePlanner.getState().updateItem(item.id, {
      title: draft.title.trim() || item.title,
      notes: draft.notes,
      subjectId: draft.subjectId,
      due: draft.due,
      time: draft.time ?? null,
      duration: draft.duration ?? 0,
      priority: draft.priority,
      kind: draft.kind,
      docId: draft.docId,
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="t-label mb-1.5 block">{t(L('Заглавие', 'Title'))}</label>
        <input
          autoFocus
          className="field field-lg"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="t-label mb-1.5 block">{t(L('Вид', 'Type'))}</label>
          <Select
            value={draft.kind}
            width={240}
            options={types.map((x) => ({
              value: x.id,
              label: typeName(x, lang),
              icon: x.icon,
              color: x.color ?? undefined,
            }))}
            onChange={(v) => setDraft({ ...draft, kind: v })}
          />
        </div>
        <div>
          <label className="t-label mb-1.5 block">{t(S.subject)}</label>
          <Select
            value={draft.subjectId ?? ''}
            width={240}
            options={[
              { value: '', label: t(S.noSubject) },
              ...subjects.map((s) => ({ value: s.id, label: s.name, color: s.color })),
            ]}
            onChange={(v) => setDraft({ ...draft, subjectId: v || null })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="t-label mb-1.5 block">{t(L('Срок', 'Due'))}</label>
          <input
            type="date"
            className="field"
            value={draft.due ? isoDay(new Date(draft.due)) : ''}
            onChange={(e) =>
              setDraft({ ...draft, due: e.target.value ? startOfDay(new Date(e.target.value)) : null })
            }
          />
        </div>
        <div>
          <label className="t-label mb-1.5 block">{t(L('Час', 'Time'))}</label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              className="field t-num"
              disabled={draft.due === null}
              value={draft.time ?? ''}
              onChange={(e) => setDraft({ ...draft, time: e.target.value || null })}
            />
            {draft.time && (
              <button
                className="icon-btn h-8 w-8 shrink-0"
                aria-label={t(L('Без час', 'No time'))}
                onClick={() => setDraft({ ...draft, time: null })}
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-faint">
            {t(
              L(
                'С час застава в мрежата на календара; без час — в лентата за деня.',
                'With a time it sits in the calendar grid; without one, in the all-day strip.',
              ),
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="t-label mb-1.5 block">{t(S.priority)}</label>
          <Segmented
            value={String(draft.priority)}
            onChange={(v) => setDraft({ ...draft, priority: Number(v) as 0 | 1 | 2 })}
            items={[
              { id: '0', label: t(PRIORITY[0]) },
              { id: '1', label: t(PRIORITY[1]) },
              { id: '2', label: t(PRIORITY[2]) },
            ]}
          />
        </div>
        <div>
          <label className="t-label mb-1.5 block">{t(L('Колко ще отнеме', 'How long it takes'))}</label>
          <Select
            value={String(draft.duration ?? 0)}
            width={200}
            options={DURATIONS.map((m) => ({
              value: String(m),
              label: m === 0 ? t(L('Не знам', 'Not sure')) : t(L(`${m} мин`, `${m} min`)),
            }))}
            onChange={(v) => setDraft({ ...draft, duration: Number(v) })}
          />
        </div>
      </div>

      <div>
        <label className="t-label mb-1.5 block">{t(L('Материал', 'Material'))}</label>
        <Select
          value={draft.docId ?? ''}
          width={300}
          options={[
            { value: '', label: t(L('Няма', 'None')) },
            ...documents
              .filter((d) => !d.deletedAt)
              .slice(0, 60)
              .map((d) => ({
                value: d.id,
                label: d.name,
                icon: d.kind === 'board' ? 'board' : d.kind === 'note' ? 'notebook' : 'book',
              })),
          ]}
          onChange={(v) => setDraft({ ...draft, docId: v || null })}
        />
      </div>

      <div>
        <label className="t-label mb-1.5 block">{t(L('Бележки', 'Notes'))}</label>
        <textarea
          className="field h-24 resize-none py-2"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onClose}>{t(S.cancel)}</Button>
        <Button variant="primary" icon="check" onClick={() => void save()}>
          {t(S.save)}
        </Button>
      </div>
    </div>
  );
}
