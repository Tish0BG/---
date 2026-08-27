import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlannerItem } from '@/types';
import { usePlanner, addDays, startOfDay } from '@/state/plannerStore';
import { usePlanView } from '@/state/planViewStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes, typeOf } from '@/state/itemTypeStore';
import { useTimer } from '@/state/timerStore';
import { useApp } from '@/state/appStore';
import { useT, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover } from '../ui';
import { notify } from '@/state/toastStore';
import { noteReminderSaved } from '@/services/reminderService';
import { clockMinutes, plannedOf } from './planTime';

/**
 * ──────────────────────────────────────────────────────── one card, a task ──
 *
 * The whole planner is this rectangle repeated. It carries five things and
 * refuses to carry a sixth: what the job is, how long you think it will take,
 * when in the day it sits, which part of your life it belongs to, and how far
 * into it you are. Everything else — notes, repeats, reminders, the material
 * it points at — lives in the panel, one click away, because a card that
 * shows everything is a card you cannot scan a column of.
 *
 * Every one of the five is editable from the card itself. The title takes a
 * cursor where it stands, the estimate is a menu on its own chip, the subtask
 * boxes tick in place. Opening a dialog to change a number that is already on
 * screen is the difference between a planner somebody keeps up to date and
 * one that goes stale in a fortnight.
 */

/** The estimates people actually reach for, in minutes. */
export const DURATIONS = [5, 10, 15, 30, 45, 60, 90, 120, 180, 240];

export function TaskCard({
  item,
  /** the column already says which day this is; overdue cards say it themselves */
  showDue,
  compact,
}: {
  item: PlannerItem;
  showDue?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const subjects = useWorkspace((s) => s.subjects);
  const custom = useItemTypes((s) => s.custom);
  const selected = useApp((s) => s.openItemId === item.id);
  const subject = subjects.find((s) => s.id === item.subjectId) ?? null;
  const type = typeOf(item.kind, custom);
  const tint = type.color ?? subject?.color ?? null;
  const steps = item.steps ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState('');
  const overdue = !item.done && item.due !== null && item.due < startOfDay();

  useEffect(() => setDraft(item.title), [item.title]);

  const commit = () => {
    setEditing(false);
    const value = draft.trim();
    if (value && value !== item.title) void usePlanner.getState().updateItem(item.id, { title: value });
    else setDraft(item.title);
  };

  const startFocus = () => {
    useTimer.getState().setActiveTask(item.id);
    useApp.getState().go('focus');
    useTimer.getState().start();
  };

  return (
    <article
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
        usePlanView.getState().setDragging(item.id);
      }}
      onDragEnd={() => usePlanView.getState().setDragging(null)}
      onClick={(e) => {
        // The card opens the panel; the controls inside it do not. Without
        // this, ticking a subtask also opened a drawer over the column the
        // person was reading.
        if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;
        useApp.getState().openItem(item.id);
      }}
      className={`group relative cursor-grab rounded-[10px] border bg-surface transition-all duration-150 active:cursor-grabbing ${
        item.done ? 'opacity-55' : ''
      }`}
      /* Longhand on every edge, deliberately. Setting `borderColor` and then
         `borderLeft` mixes a shorthand with a longhand for the same value, and
         React warns — rightly — that the two disagree the moment one of them
         stops being applied. */
      style={{
        borderColor: selected ? 'var(--c-accent)' : 'var(--c-line)',
        borderLeftColor: overdue ? 'var(--c-danger)' : selected ? 'var(--c-accent)' : 'var(--c-line)',
        borderLeftWidth: overdue ? 2.5 : 1,
        boxShadow: selected ? '0 0 0 1px var(--c-accent)' : 'var(--shadow-xs, 0 1px 2px rgb(0 0 0 / 0.04))',
      }}
    >
      <div className={compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}>
        {/* ------------------------------------------------ time row */}
        <div className="mb-1 flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {item.time && (
              <span
                className="t-num rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold"
                style={{
                  background: `color-mix(in srgb, ${tint ?? 'var(--c-accent)'} 18%, transparent)`,
                  color: tint ?? 'var(--c-accent)',
                }}
              >
                {item.time}
              </span>
            )}
            {showDue && item.due !== null && (
              <span
                className="t-num rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold"
                style={{
                  background: 'color-mix(in srgb, var(--c-danger) 14%, transparent)',
                  color: 'var(--c-danger)',
                }}
              >
                {new Date(item.due).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </span>
            )}
            {item.repeat && item.repeat !== 'none' && (
              <Icon name="refresh" size={11} className="text-faint" aria-hidden />
            )}
            {typeof item.remindAt === 'number' && !item.done && (
              <Icon name="bell" size={11} style={{ color: 'var(--c-accent)' }} aria-hidden />
            )}
          </div>

          <DurationChip item={item} />
        </div>

        {/* ---------------------------------------------------- title */}
        {editing ? (
          <AutoTextarea
            value={draft}
            onChange={setDraft}
            onCommit={commit}
            onCancel={() => {
              setDraft(item.title);
              setEditing(false);
            }}
          />
        ) : (
          <button
            className={`w-full cursor-text text-left text-[13px] leading-snug ${
              item.done ? 'text-muted line-through' : 'font-medium'
            }`}
            onClick={() => setEditing(true)}
          >
            {item.title || <span className="text-faint">{t(L('Без заглавие', 'Untitled'))}</span>}
          </button>
        )}

        {/* ------------------------------------------------- subtasks */}
        {(steps.length > 0 || adding) && (
          <div className="mt-1.5 space-y-0.5">
            {steps.map((s) => (
              <div key={s.id} className="group/step flex items-center gap-1.5">
                <button
                  onClick={() => void usePlanner.getState().toggleStep(item.id, s.id)}
                  aria-pressed={s.done}
                  aria-label={s.title}
                  className="grid h-[14px] w-[14px] shrink-0 cursor-pointer place-items-center rounded-full border transition-all active:scale-90"
                  style={{
                    borderColor: s.done ? 'var(--c-success)' : 'var(--c-line-strong)',
                    background: s.done ? 'var(--c-success)' : 'transparent',
                  }}
                >
                  {s.done && <Icon name="check" size={9} className="text-white" strokeWidth={3} />}
                </button>
                <span
                  className={`min-w-0 flex-1 truncate text-[12px] ${s.done ? 'text-faint line-through' : 'text-muted'}`}
                >
                  {s.title}
                </span>
                <button
                  className="icon-btn h-5 w-5 shrink-0 hover-reveal"
                  aria-label={t(S.delete)}
                  onClick={() => void usePlanner.getState().removeStep(item.id, s.id)}
                >
                  <Icon name="x" size={10} />
                </button>
              </div>
            ))}
            {adding && (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = step.trim();
                  if (value) void usePlanner.getState().addStep(item.id, value);
                  setStep('');
                  if (!value) setAdding(false);
                }}
              >
                <Icon name="plus" size={11} className="shrink-0 text-faint" />
                <input
                  autoFocus
                  value={step}
                  onChange={(e) => setStep(e.target.value)}
                  onBlur={() => {
                    const value = step.trim();
                    if (value) void usePlanner.getState().addStep(item.id, value);
                    setStep('');
                    setAdding(false);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      setStep('');
                      setAdding(false);
                    }
                  }}
                  placeholder={t(L('Подзадача', 'Subtask'))}
                  className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-faint"
                />
              </form>
            )}
          </div>
        )}

        {/* --------------------------------------------------- footer */}
        <div className="mt-2 flex items-center gap-1">
          <button
            onClick={() => void usePlanner.getState().toggleItem(item.id)}
            aria-pressed={item.done}
            aria-label={t(item.done ? L('Върни като незавършена', 'Mark as not done') : L('Отметни', 'Mark done'))}
            className="grid h-[17px] w-[17px] shrink-0 cursor-pointer place-items-center rounded-full border transition-all active:scale-90"
            style={{
              borderColor: item.done ? 'var(--c-success)' : 'var(--c-line-strong)',
              background: item.done ? 'var(--c-success)' : 'transparent',
            }}
          >
            <Icon
              name="check"
              size={11}
              strokeWidth={3}
              style={{ color: item.done ? '#fff' : 'var(--c-line-strong)' }}
            />
          </button>

          <div className="flex items-center gap-0.5 hover-reveal">
            {!item.done && (
              <button className="icon-btn h-6 w-6" aria-label={t(L('Фокус', 'Focus'))} onClick={startFocus}>
                <Icon name="play" size={11} />
              </button>
            )}
            <button
              className="icon-btn h-6 w-6"
              aria-label={t(L('Подзадача', 'Subtask'))}
              onClick={() => setAdding(true)}
            >
              <Icon name="listTodo" size={12} />
            </button>
            <CardMenu item={item} />
          </div>

          <span className="ml-auto flex min-w-0 items-center gap-1.5">
            {steps.length > 0 && (
              <span className="t-num text-[10.5px] text-faint">
                {steps.filter((s) => s.done).length}/{steps.length}
              </span>
            )}
            {item.pomodoros > 0 && (
              <span className="t-num inline-flex items-center gap-0.5 text-[10.5px] text-faint">
                <Icon name="timer" size={10} />
                {item.pomodoros}
              </span>
            )}
            <ChannelChip item={item} subject={subject} />
          </span>
        </div>
      </div>

    </article>
  );
}

/* ------------------------------------------------------------- the chips */

/** The estimate, and the menu that changes it. `0:00` until one is set. */
function DurationChip({ item }: { item: PlannerItem }) {
  const t = useT();
  const planned = plannedOf(item);
  return (
    <Popover
      width={168}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          onClick={toggle}
          aria-label={t(L('Планирано време', 'Planned time'))}
          className={`t-num shrink-0 cursor-pointer rounded-[5px] px-1.5 py-px text-[10.5px] font-semibold transition-colors ${
            planned > 0 ? 'text-muted' : 'text-faint hover-reveal'
          }`}
          style={{ background: planned > 0 ? 'var(--c-surface-3)' : 'transparent' }}
        >
          {clockMinutes(planned)}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2 pb-1 pt-1.5">
            <span className="t-label">{t(L('Колко ще отнеме', 'How long it takes'))}</span>
          </div>
          {DURATIONS.map((m) => (
            <MenuItem
              key={m}
              active={planned === m}
              label={clockMinutes(m)}
              onClick={() => {
                void usePlanner.getState().updateItem(item.id, { duration: m });
                close();
              }}
            />
          ))}
          {planned > 0 && (
            <>
              <MenuSep />
              <MenuItem
                icon="x"
                label={t(L('Без оценка', 'No estimate'))}
                onClick={() => {
                  void usePlanner.getState().updateItem(item.id, { duration: 0 });
                  close();
                }}
              />
            </>
          )}
        </>
      )}
    </Popover>
  );
}

/** `# Работа` — which part of a life this belongs to, and the way to change it. */
function ChannelChip({
  item,
  subject,
}: {
  item: PlannerItem;
  subject: { id: string; name: string; color: string } | null;
}) {
  const t = useT();
  const all = useWorkspace((s) => s.subjects);
  const subjects = all.filter((s) => !s.archived);

  return (
    <Popover
      width={220}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          onClick={toggle}
          aria-label={t(S.subject)}
          className={`flex min-w-0 shrink cursor-pointer items-center gap-0.5 rounded-[5px] px-1 text-[10.5px] font-medium transition-colors ${
            subject ? '' : 'hover-reveal text-faint'
          }`}
          style={subject ? { color: subject.color } : undefined}
        >
          <span className="opacity-70">#</span>
          <span className="truncate">{subject?.name ?? t(L('канал', 'channel'))}</span>
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-[280px] overflow-y-auto scroll-thin">
          <MenuItem
            active={!item.subjectId}
            label={t(L('Без канал', 'No channel'))}
            onClick={() => {
              void usePlanner.getState().updateItem(item.id, { subjectId: null });
              close();
            }}
          />
          {subjects.map((s) => (
            <button
              key={s.id}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 h-8 text-left text-[13px] transition-colors hover:bg-surface-3"
              onClick={() => {
                void usePlanner.getState().updateItem(item.id, { subjectId: s.id });
                close();
              }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 truncate">{s.name}</span>
              {item.subjectId === s.id && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

/* -------------------------------------------------------------- the menu */

function CardMenu({ item }: { item: PlannerItem }) {
  const t = useT();
  const move = (days: number | null) =>
    void usePlanner.getState().moveTo(item.id, days === null ? null : startOfDay(addDays(days)).valueOf());

  return (
    <Popover
      width={232}
      align="start"
      trigger={({ toggle, ref }) => (
        <button ref={ref} onClick={toggle} className="icon-btn h-6 w-6" aria-label={t(L('Още', 'More'))}>
          <Icon name="dots" size={12} />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            icon="expand"
            label={t(L('Отвори', 'Open'))}
            onClick={() => {
              useApp.getState().openItem(item.id);
              close();
            }}
          />
          <MenuSep />
          <div className="px-2 pb-1 pt-1.5">
            <span className="t-label">{t(L('Премести', 'Move'))}</span>
          </div>
          <MenuItem
            icon="calendar"
            label={t(L('За днес', 'Today'))}
            shortcut="T"
            onClick={() => {
              move(0);
              close();
            }}
          />
          <MenuItem
            icon="arrowRight"
            label={t(L('За утре', 'Tomorrow'))}
            onClick={() => {
              move(1);
              close();
            }}
          />
          <MenuItem
            icon="history"
            label={t(L('След седмица', 'Next week'))}
            onClick={() => {
              move(7);
              close();
            }}
          />
          <MenuItem
            icon="archive"
            label={t(L('В бекло̀га', 'To the backlog'))}
            onClick={() => {
              move(null);
              close();
            }}
          />
          <MenuSep />
          <MenuItem
            icon="bell"
            label={t(L('Напомни след час', 'Remind me in an hour'))}
            onClick={() => {
              void usePlanner
                .getState()
                .updateItem(item.id, { remindAt: Date.now() + 3_600_000, remindedAt: null });
              noteReminderSaved();
              close();
            }}
          />
          <MenuItem
            icon="copy"
            label={t(L('Дублирай', 'Duplicate'))}
            onClick={() => {
              const { id, createdAt, updatedAt, completedAt, ...rest } = item;
              void id;
              void createdAt;
              void updatedAt;
              void completedAt;
              void usePlanner.getState().addItem({ ...rest, done: false, pomodoros: 0 });
              close();
            }}
          />
          <MenuSep />
          <MenuItem
            icon="trash"
            danger
            label={t(S.delete)}
            onClick={() => {
              const snapshot = item;
              useApp.getState().closeItem();
              void usePlanner.getState().removeItem(item.id);
              notify.undo(
                t(L(`Изтрито: ${snapshot.title}`, `Deleted: ${snapshot.title}`)),
                t(L('Върни', 'Undo')),
                () => void usePlanner.getState().restoreItems([snapshot]),
              );
              close();
            }}
          />
        </>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------- the field */

/**
 * A title that takes a cursor where it stands.
 *
 * A textarea rather than an input because a task called "Write the second
 * half of the onboarding email" is two lines wide in a column, and an input
 * would scroll it sideways under the caret while somebody is trying to read
 * what they typed.
 */
export function AutoTextarea({
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  autoFocus = true,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      const el = ref.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onCommit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel?.();
        }
      }}
      className={`w-full resize-none overflow-hidden bg-transparent text-[13px] font-medium leading-snug outline-none placeholder:font-normal placeholder:text-faint ${className}`}
    />
  );
}
