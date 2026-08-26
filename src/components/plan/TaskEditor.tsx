import { useEffect, useMemo, useState } from 'react';
import type { PlannerItem, RepeatRule, TaskMethod } from '@/types';
import { useLibrary } from '@/state/libraryStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes, allTypes, typeName } from '@/state/itemTypeStore';
import { usePlanner, startOfDay } from '@/state/plannerStore';
import { useT, useLang, L } from '@/i18n';
import { S, PRIORITY } from '@/i18n/strings';
import { Select } from '../ui';
import { Button, Segmented } from '../kit';
import { METHOD_ICON, METHOD_LABEL } from '../tasks/TaskRow';
import { noteReminderSaved } from '@/services/reminderService';
import { Icon } from '../Icon';
import { isoDay } from '../shell/QuickCreate';

const DURATIONS = [0, 15, 30, 45, 60, 90, 120];

const REPEATS: { id: RepeatRule; label: { bg: string; en: string } }[] = [
  { id: 'none', label: L('Веднъж', 'Once') },
  { id: 'daily', label: L('Всеки ден', 'Every day') },
  { id: 'weekdays', label: L('Делник', 'Weekdays') },
  { id: 'weekly', label: L('Седмично', 'Weekly') },
  { id: 'monthly', label: L('Месечно', 'Monthly') },
  { id: 'yearly', label: L('Годишно', 'Yearly') },
];

/** `Date` → the two strings an `<input type=datetime-local>` wants. */
const localInput = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
      method: draft.method ?? 'check',
      target: draft.target ?? 0,
      repeat: draft.repeat ?? 'none',
      remindAt: draft.remindAt ?? null,
      // A reminder that has been moved has not been delivered yet.
      remindedAt: draft.remindAt === item.remindAt ? (item.remindedAt ?? null) : null,
    });
    if (draft.remindAt && draft.remindAt !== item.remindAt) noteReminderSaved();
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

      {/* ------------------------------------------------------ method */}
      <div>
        <label className="t-label mb-1.5 block">{t(L('Как ще я направиш', 'How you will work it'))}</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['check', 'checklist', 'count', 'timer'] as TaskMethod[]).map((m) => {
            const on = (draft.method ?? 'check') === m;
            return (
              <button
                key={m}
                onClick={() => setDraft({ ...draft, method: m, target: draft.target || (m === 'count' ? 3 : m === 'timer' ? 1 : 0) })}
                className="flex cursor-pointer flex-col items-start gap-1 rounded-[10px] border px-2.5 py-2 text-left transition-colors"
                style={{
                  borderColor: on ? 'var(--c-accent)' : 'var(--c-line)',
                  background: on ? 'var(--c-accent-soft)' : 'var(--c-surface)',
                  color: on ? 'var(--c-accent)' : 'var(--c-muted)',
                }}
              >
                <Icon name={METHOD_ICON[m]} size={15} />
                <span className="text-[12px] font-medium">{t(METHOD_LABEL[m])}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-faint">
          {t(
            L(
              'Не всичко иска таймер: отметка за дребните неща, списък за многостъпковите, брояч за повторенията.',
              'Not everything wants a timer: a tick for small things, a list for multi-step ones, a counter for repetitions.',
            ),
          )}
        </p>
      </div>

      {(draft.method === 'count' || draft.method === 'timer') && (
        <div>
          <label className="t-label mb-1.5 block">
            {draft.method === 'count'
              ? t(L('Колко повторения', 'How many repetitions'))
              : t(L('Колко фокус блока', 'How many focus blocks'))}
          </label>
          <input
            type="number"
            min={1}
            max={99}
            className="field t-num w-[120px]"
            value={draft.target || 1}
            onChange={(e) => setDraft({ ...draft, target: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      )}

      {/* --------------------------------------------------- reminder */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="t-label mb-1.5 block">{t(L('Напомни ми', 'Remind me'))}</label>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              className="field t-num"
              value={typeof draft.remindAt === 'number' ? localInput(draft.remindAt) : ''}
              onChange={(e) =>
                setDraft({ ...draft, remindAt: e.target.value ? new Date(e.target.value).getTime() : null })
              }
            />
            {typeof draft.remindAt === 'number' && (
              <button
                className="icon-btn h-8 w-8 shrink-0"
                aria-label={t(L('Без напомняне', 'No reminder'))}
                onClick={() => setDraft({ ...draft, remindAt: null })}
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-faint">
            {t(
              L(
                'Известието идва на устройството, ако си включил напомнянията в настройките.',
                'The notification arrives on the device, if reminders are switched on in settings.',
              ),
            )}
          </p>
        </div>
        <div>
          <label className="t-label mb-1.5 block">{t(L('Повтаря се', 'Repeats'))}</label>
          <Select
            value={draft.repeat ?? 'none'}
            width={200}
            options={REPEATS.map((r) => ({ value: r.id, label: t(r.label) }))}
            onChange={(v) => setDraft({ ...draft, repeat: v as RepeatRule })}
          />
          <p className="mt-1 text-[11px] text-faint">
            {t(
              L(
                'Отметнеш ли повтарящ се запис, той се връща на следващата си дата.',
                'Tick a repeating entry and it comes back on its next date.',
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
