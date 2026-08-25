import { useMemo, useState } from 'react';
import type { ItemType } from '@/types';
import {
  BUILTIN_TYPES,
  TYPE_COLORS,
  TYPE_ICONS,
  useItemTypes,
  typeName,
} from '@/state/itemTypeStore';
import { usePlanner } from '@/state/plannerStore';
import { useT, useLang, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { useConfirm } from '../ui';
import { Button, IconButton } from '../kit';

/**
 * Where a person invents a kind of entry.
 *
 * The three built-ins are shown but not editable: the rest of the app has
 * opinions about them — an exam gets a countdown board, homework leans on a
 * subject — and letting "Exam" be renamed to "Groceries" would leave those
 * opinions attached to the wrong thing. Everything below the line is theirs.
 */
export function TypeManager() {
  const t = useT();
  const lang = useLang();
  const custom = useItemTypes((s) => s.custom);
  const items = usePlanner((s) => s.items);
  const { confirm, element } = useConfirm();
  const [draft, setDraft] = useState<ItemType | null>(null);

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.kind, (map.get(item.kind) ?? 0) + 1);
    return map;
  }, [items]);

  const startNew = () =>
    setDraft({
      id: '',
      name: '',
      icon: TYPE_ICONS[0],
      color: TYPE_COLORS[(BUILTIN_TYPES.length + custom.length) % TYPE_COLORS.length],
      order: BUILTIN_TYPES.length + custom.length,
      updatedAt: 0,
    });

  if (draft) return <TypeForm draft={draft} onClose={() => setDraft(null)} />;

  return (
    <div className="space-y-4">
      {element}

      <section>
        <p className="t-label mb-2">{t(L('Вградени', 'Built in'))}</p>
        <div className="space-y-1">
          {BUILTIN_TYPES.map((type) => (
            <Row key={type.id} type={type} count={usage.get(type.id) ?? 0} locked />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="t-label">{t(L('Твои типове', 'Your types'))}</p>
          <Button size="sm" icon="plus" onClick={startNew}>
            {t(L('Нов тип', 'New type'))}
          </Button>
        </div>

        {custom.length === 0 ? (
          <button
            onClick={startNew}
            className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-[12px] border border-dashed p-4 text-left transition-colors hover:border-line-strong"
            style={{ borderColor: 'var(--c-line)' }}
          >
            <span className="flex items-center gap-2 text-[13.5px] font-medium">
              <Icon name="plus" size={15} className="text-accent" />
              {t(L('Направи свой тип', 'Make your own type'))}
            </span>
            <span className="text-[12px] leading-relaxed text-muted">
              {t(
                L(
                  'Репетиция, смяна, тренировка, среща — планът не е само за училище.',
                  'A rehearsal, a shift, a training session, a meeting — the plan is not only for school.',
                ),
              )}
            </span>
          </button>
        ) : (
          <div className="space-y-1">
            {custom.map((type, i) => (
              <Row
                key={type.id}
                type={type}
                count={usage.get(type.id) ?? 0}
                onEdit={() => setDraft(type)}
                onUp={i > 0 ? () => void useItemTypes.getState().reorder(type.id, -1) : undefined}
                onDown={
                  i < custom.length - 1 ? () => void useItemTypes.getState().reorder(type.id, 1) : undefined
                }
                onDelete={() =>
                  confirm(
                    usage.get(type.id)
                      ? t(
                          L(
                            `„${type.name}“ се използва от ${usage.get(type.id)} записа. Те остават, но ще се показват като обикновени задачи. Да продължа ли?`,
                            `“${type.name}” is used by ${usage.get(type.id)} entries. They stay, but will read as ordinary tasks. Continue?`,
                          ),
                        )
                      : t(L(`Да изтрия ли „${type.name}“?`, `Delete “${type.name}”?`)),
                    () => void useItemTypes.getState().remove(type.id),
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <p className="text-[11.5px] leading-relaxed text-muted">
        {t(
          L(
            'Всеки запис — от какъвто и тип да е — има срок, приоритет, предмет и се появява в календара.',
            'Every entry — whatever its type — has a deadline, a priority, a subject, and shows up on the calendar.',
          ),
        )}
      </p>
    </div>
  );

  function Row({
    type,
    count,
    locked,
    onEdit,
    onUp,
    onDown,
    onDelete,
  }: {
    type: ItemType;
    count: number;
    locked?: boolean;
    onEdit?: () => void;
    onUp?: () => void;
    onDown?: () => void;
    onDelete?: () => void;
  }) {
    return (
      <div className="group flex items-center gap-3 rounded-[10px] border border-transparent px-2.5 py-2 transition-colors hover:border-line hover:bg-surface-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
          style={{
            background: type.color
              ? `color-mix(in srgb, ${type.color} 15%, transparent)`
              : 'var(--c-surface-3)',
            color: type.color ?? 'var(--c-muted)',
          }}
        >
          <Icon name={type.icon} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{typeName(type, lang)}</span>
          <span className="block text-[11.5px] text-muted">
            {count
              ? t(L(`${count} записа`, `${count} entries`))
              : locked
                ? t(L('вграден', 'built in'))
                : t(L('още не се използва', 'not used yet'))}
          </span>
        </span>
        {!locked && (
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {onUp && <IconButton icon="chevronUp" size="sm" label={t(L('Нагоре', 'Move up'))} onClick={onUp} />}
            {onDown && (
              <IconButton icon="chevronDown" size="sm" label={t(L('Надолу', 'Move down'))} onClick={onDown} />
            )}
            {onEdit && <IconButton icon="pencil" size="sm" label={t(S.edit)} onClick={onEdit} />}
            {onDelete && (
              <IconButton icon="trash" size="sm" tone="danger" label={t(S.delete)} onClick={onDelete} />
            )}
          </span>
        )}
      </div>
    );
  }
}

/* ------------------------------------------------------------------ form */

function TypeForm({ draft, onClose }: { draft: ItemType; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(draft.name);
  const [icon, setIcon] = useState(draft.icon);
  const [color, setColor] = useState(draft.color ?? TYPE_COLORS[0]);
  const editing = !!draft.id;

  const save = async () => {
    const clean = name.trim();
    if (!clean) return;
    if (editing) await useItemTypes.getState().update(draft.id, { name: clean, icon, color });
    else await useItemTypes.getState().create({ name: clean, icon, color });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px]"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
        >
          <Icon name={icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <label className="t-label mb-1.5 block">{t(L('Име на типа', 'Type name'))}</label>
          <input
            autoFocus
            className="field field-lg"
            value={name}
            maxLength={28}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
            placeholder={t(L('Репетиция, смяна, среща…', 'Rehearsal, shift, meeting…'))}
          />
        </div>
      </div>

      <div>
        <label className="t-label mb-1.5 block">{t(L('Икона', 'Icon'))}</label>
        <div className="grid grid-cols-8 gap-1.5">
          {TYPE_ICONS.map((name) => (
            <button
              key={name}
              onClick={() => setIcon(name)}
              aria-pressed={icon === name}
              className="grid h-9 cursor-pointer place-items-center rounded-[9px] transition-colors"
              style={{
                background: icon === name ? `color-mix(in srgb, ${color} 15%, transparent)` : 'var(--c-surface-2)',
                color: icon === name ? color : 'var(--c-muted)',
                outline: icon === name ? `1.5px solid ${color}` : 'none',
              }}
            >
              <Icon name={name} size={16} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="t-label mb-1.5 block">{t(L('Цвят', 'Colour'))}</label>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={c}
              className="h-8 w-8 cursor-pointer rounded-full transition-transform hover:scale-110"
              style={{
                background: c,
                outline: color === c ? '2px solid var(--c-accent)' : '1px solid var(--c-line)',
                outlineOffset: 2,
              }}
            />
          ))}
          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 text-[11.5px] text-muted">
            {t(L('Друг', 'Custom'))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onClose}>{t(S.cancel)}</Button>
        <Button variant="primary" icon="check" disabled={!name.trim()} onClick={() => void save()}>
          {t(editing ? S.save : S.create)}
        </Button>
      </div>
    </div>
  );
}
