import { useState } from 'react';
import type { PlannerItem, TaskMethod } from '@/types';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, addDays, itemProgress, startOfDay } from '@/state/plannerStore';
import { useTimer } from '@/state/timerStore';
import { useLibrary } from '@/state/libraryStore';
import { useApp } from '@/state/appStore';
import { useItemTypes, typeName, typeOf } from '@/state/itemTypeStore';
import { useT, useLang, shortDate, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover } from '../ui';
import { Tooltip, useIsPhone } from '../kit';
import { DueChip } from '../planner/DueChip';
import { openDoc } from '@/services/openDoc';
import { notify } from '@/state/toastStore';
import { noteReminderSaved } from '@/services/reminderService';

/** Labels for the four ways an entry can be worked. */
export const METHOD_LABEL: Record<TaskMethod, { bg: string; en: string }> = {
  check: L('Отметка', 'Tick'),
  checklist: L('Списък', 'Checklist'),
  count: L('Брояч', 'Counter'),
  timer: L('Таймер', 'Timer'),
};

export const METHOD_ICON: Record<TaskMethod, string> = {
  check: 'checkCircle',
  checklist: 'listTodo',
  count: 'sigma',
  timer: 'timer',
};

/**
 * One entry, everywhere.
 *
 * The row carries everything a decision needs — what it is, when it is due,
 * how far along it is — and every one of them is actionable in place: tick
 * it, tick a step of it, count one more, start a session on it, push it to
 * tomorrow. Opening a detail screen to change a date is how a to-do list
 * stops being used.
 *
 * The four *methods* are the reason this row is not just a checkbox. Not
 * every job is a twenty-five-minute block: watering the plants is a tick,
 * packing is a small list, water is a counter, and revision is the timer the
 * app started life with. The method decides what the row grows underneath
 * itself — nothing, steps, a stepper — and nothing else in the app has to
 * know about it.
 */
export function TaskRow({
  item,
  onEdit,
  dense,
  hideDue,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  item: PlannerItem;
  onEdit?: (item: PlannerItem) => void;
  dense?: boolean;
  /** the lane or the day heading already says when it is due */
  hideDue?: boolean;
  /** the row can be picked up and dropped into another lane */
  draggable?: boolean;
  onDragStart?: (item: PlannerItem) => void;
  onDragEnd?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const phone = useIsPhone();
  const subjects = useWorkspace((s) => s.subjects);
  const documents = useLibrary((s) => s.documents);
  const custom = useItemTypes((s) => s.custom);
  const subject = subjects.find((s) => s.id === item.subjectId) ?? null;
  const doc = documents.find((d) => d.id === item.docId);
  const type = typeOf(item.kind, custom);
  // The tint is the type's own colour where it has one, and the subject's
  // otherwise — a "rehearsal" should look like a rehearsal, but an ordinary
  // task should look like the subject it belongs to.
  const tint = type.color ?? subject?.color ?? null;
  const [justDone, setJustDone] = useState(false);
  const [openSteps, setOpenSteps] = useState(false);
  const [newStep, setNewStep] = useState('');

  const method: TaskMethod = item.method ?? 'check';
  const steps = item.steps ?? [];
  const doneSteps = steps.filter((x) => x.done).length;
  const progress = itemProgress(item);

  const toggle = () => {
    if (!item.done) {
      setJustDone(true);
      setTimeout(() => setJustDone(false), 700);
    }
    void usePlanner.getState().toggleItem(item.id);
  };

  const reschedule = (days: number | null) =>
    void usePlanner.getState().moveTo(item.id, days === null ? null : startOfDay(addDays(days)).valueOf());

  /** Reminders in the units people actually think in. */
  const remind = (offsetMinutes: number | null) => {
    if (offsetMinutes === null) {
      void usePlanner.getState().updateItem(item.id, { remindAt: null, remindedAt: null });
      return;
    }
    void usePlanner
      .getState()
      .updateItem(item.id, { remindAt: Date.now() + offsetMinutes * 60_000, remindedAt: null });
    noteReminderSaved();
  };

  const remindTomorrowMorning = () => {
    const at = new Date(startOfDay(addDays(1)));
    at.setHours(9, 0, 0, 0);
    void usePlanner.getState().updateItem(item.id, { remindAt: at.getTime(), remindedAt: null });
    noteReminderSaved();
  };

  return (
    <div
      draggable={draggable && !phone}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(item);
      }}
      onDragEnd={() => onDragEnd?.()}
      className={`group rounded-[12px] border border-transparent transition-all duration-150 hover:border-line hover:bg-surface-2 ${
        draggable && !phone ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={item.done ? { opacity: 0.6 } : undefined}
    >
      <div className={`flex items-center gap-3 px-3 ${dense ? 'py-2' : 'py-2.5'}`}>
        {draggable && !phone && (
          <Icon
            name="grip"
            size={13}
            className="-ml-1.5 shrink-0 text-faint hover-reveal"
            aria-hidden
          />
        )}

        <button
          onClick={toggle}
          aria-pressed={item.done}
          aria-label={t(item.done ? L('Върни като незавършена', 'Mark as not done') : L('Отметни', 'Mark done'))}
          className="relative grid h-[19px] w-[19px] shrink-0 cursor-pointer place-items-center rounded-[6px] border transition-all duration-150 active:scale-90"
          style={{
            borderColor: item.done ? 'var(--c-success)' : 'var(--c-line-strong)',
            background: item.done ? 'var(--c-success)' : 'transparent',
          }}
        >
          {item.done && <Icon name="check" size={13} className="text-white" strokeWidth={3} />}
          {/* A part-finished entry says so on the box itself, so a collapsed
              checklist is never mistaken for one nobody has touched. */}
          {!item.done && progress > 0 && (
            <span
              className="absolute inset-[3px] rounded-[3px]"
              style={{ background: 'var(--c-success)', opacity: 0.25 + progress * 0.55 }}
              aria-hidden
            />
          )}
          {justDone && (
            <span
              className="animate-pop absolute -inset-2 rounded-full"
              style={{ background: 'color-mix(in srgb, var(--c-success) 22%, transparent)' }}
              aria-hidden
            />
          )}
        </button>

        <button
          className="min-w-0 flex-1 cursor-text text-left"
          onClick={() => onEdit?.(item)}
          onDoubleClick={() => onEdit?.(item)}
        >
          <span className="flex items-center gap-2">
            {item.kind !== 'task' && (
              <Icon
                name={type.icon}
                size={13}
                className="shrink-0"
                style={{ color: tint ?? 'var(--c-muted)' }}
              />
            )}
            <span className={`truncate text-[13.5px] ${item.done ? 'line-through' : 'font-medium'}`}>
              {item.title}
            </span>
            {!dense && item.kind !== 'task' && item.kind !== 'homework' && (
              <span
                className="chip shrink-0"
                style={{
                  background: tint ? `color-mix(in srgb, ${tint} 14%, transparent)` : 'var(--c-surface-3)',
                  color: tint ?? 'var(--c-muted)',
                }}
              >
                {typeName(type, lang)}
              </span>
            )}
          </span>

          {(subject ||
            item.notes ||
            doc ||
            item.time ||
            item.pomodoros > 0 ||
            item.remindAt ||
            (item.repeat && item.repeat !== 'none') ||
            method === 'checklist' ||
            method === 'count') && (
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted">
              {item.time && (
                <span className="t-num inline-flex items-center gap-1">
                  <Icon name="clock" size={11} />
                  {item.time}
                </span>
              )}
              {typeof item.remindAt === 'number' && !item.done && (
                <span
                  className="t-num inline-flex items-center gap-1"
                  style={{ color: 'var(--c-accent)' }}
                >
                  <Icon name="bell" size={11} />
                  {/* An hour alone reads as "today at". A reminder on another
                      day has to say which day, or it lies once a night. */}
                  {startOfDay(new Date(item.remindAt)) !== startOfDay()
                    ? `${shortDate(item.remindAt, lang)} · `
                    : ''}
                  {new Date(item.remindAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'bg-BG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
              {item.repeat && item.repeat !== 'none' && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="refresh" size={11} />
                  {t(REPEAT_SHORT[item.repeat])}
                </span>
              )}
              {method === 'checklist' && steps.length > 0 && (
                <span className="t-num inline-flex items-center gap-1">
                  <Icon name="listTodo" size={11} />
                  {doneSteps}/{steps.length}
                </span>
              )}
              {/* The stepper below already carries the number; repeating it
                  in the meta line only costs the title its width. */}
              {method === 'count' && item.done && (
                <span className="t-num inline-flex items-center gap-1">
                  <Icon name="sigma" size={11} />
                  {item.count ?? 0}/{item.target || 1}
                </span>
              )}
              {subject && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="badge-dot" style={{ background: subject.color }} />
                  {subject.name}
                </span>
              )}
              {doc && (
                <span className="inline-flex max-w-[180px] items-center gap-1">
                  <Icon
                    name={doc.kind === 'board' ? 'board' : doc.kind === 'note' ? 'notebook' : 'book'}
                    size={11}
                  />
                  <span className="truncate">{doc.name}</span>
                </span>
              )}
              {item.pomodoros > 0 && !phone && (
                <span className="t-num inline-flex items-center gap-1">
                  <Icon name="timer" size={11} />
                  {item.pomodoros}
                  {item.target && method === 'timer' ? `/${item.target}` : ''}
                </span>
              )}
              {item.notes && !dense && <span className="truncate opacity-80">{item.notes}</span>}
            </span>
          )}
        </button>

        {/* A counter is worked from the row: two buttons and a number, no
            dialog. It is the whole point of the method. */}
        {method === 'count' && !item.done && (
          <span className="flex shrink-0 items-center gap-1">
            <button
              className="icon-btn h-6 w-6 text-[15px] leading-none"
              aria-label="−"
              onClick={() => void usePlanner.getState().bump(item.id, -1)}
            >
              −
            </button>
            <span className="t-num min-w-[34px] text-center text-[12px] font-semibold">
              {item.count ?? 0}
              <span className="font-normal text-faint">/{item.target || 1}</span>
            </span>
            <button
              className="icon-btn h-6 w-6"
              aria-label="+"
              onClick={() => void usePlanner.getState().bump(item.id, 1)}
            >
              <Icon name="plus" size={12} />
            </button>
          </span>
        )}

        {method === 'checklist' && (
          <button
            className="icon-btn h-7 w-7 shrink-0"
            aria-expanded={openSteps}
            aria-label={t(L('Стъпки', 'Steps'))}
            onClick={() => setOpenSteps((v) => !v)}
          >
            <Icon name={openSteps ? 'chevronUp' : 'chevronDown'} size={14} />
          </button>
        )}

        {item.priority > 0 && (
          <Tooltip label={t(item.priority === 2 ? L('Спешно', 'Urgent') : L('Важно', 'Important'))}>
            <Icon
              name="flag"
              size={14}
              className="shrink-0"
              style={{ color: item.priority === 2 ? 'var(--c-danger)' : 'var(--c-warn)' }}
            />
          </Tooltip>
        )}

        {item.due !== null && !item.done && !hideDue && <DueChip due={item.due} compact={dense || phone} />}

        <div className="flex shrink-0 items-center gap-0.5 hover-reveal">
          {!item.done && method === 'timer' && (
            <Tooltip label={t(L('Фокус върху задачата', 'Focus on this task'))}>
              <button
                className="icon-btn h-7 w-7"
                aria-label={t(L('Започни фокус', 'Start focus'))}
                onClick={() => {
                  // Straight to the focus screen, not into full screen: the
                  // timer offers the room, it does not take it.
                  useTimer.getState().setActiveTask(item.id);
                  useApp.getState().go('focus');
                  useTimer.getState().start();
                }}
              >
                <Icon name="play" size={14} />
              </button>
            </Tooltip>
          )}

          <Popover
            width={228}
            align="end"
            trigger={({ toggle: open, ref }) => (
              <button ref={ref} onClick={open} className="icon-btn h-7 w-7" aria-label={t(L('Още', 'More'))}>
                <Icon name="dots" size={15} />
              </button>
            )}
          >
            {(close) => (
              <>
                {onEdit && (
                  <MenuItem
                    icon="pencil"
                    label={t(S.edit)}
                    onClick={() => {
                      onEdit(item);
                      close();
                    }}
                  />
                )}
                <MenuItem
                  icon="calendar"
                  label={t(L('За днес', 'Move to today'))}
                  onClick={() => {
                    reschedule(0);
                    close();
                  }}
                />
                <MenuItem
                  icon="arrowRight"
                  label={t(L('За утре', 'Move to tomorrow'))}
                  onClick={() => {
                    reschedule(1);
                    close();
                  }}
                />
                <MenuItem
                  icon="history"
                  label={t(L('След седмица', 'Next week'))}
                  onClick={() => {
                    reschedule(7);
                    close();
                  }}
                />
                <MenuItem
                  icon="waves"
                  label={t(L('Някой ден', 'Someday'))}
                  onClick={() => {
                    reschedule(null);
                    close();
                  }}
                />

                <MenuSep />
                <div className="px-2 pb-1 pt-1.5">
                  <span className="t-label">{t(L('Как ще я направиш', 'How you will work it'))}</span>
                </div>
                {(['check', 'checklist', 'count', 'timer'] as TaskMethod[]).map((m) => (
                  <MenuItem
                    key={m}
                    icon={METHOD_ICON[m]}
                    active={method === m}
                    label={t(METHOD_LABEL[m])}
                    onClick={() => {
                      void usePlanner.getState().setMethod(item.id, m);
                      if (m === 'checklist') setOpenSteps(true);
                      close();
                    }}
                  />
                ))}

                {!item.done && method !== 'timer' && (
                  <MenuItem
                    icon="play"
                    label={t(L('Пусни фокус сесия', 'Start a focus session'))}
                    onClick={() => {
                      useTimer.getState().setActiveTask(item.id);
                      useApp.getState().go('focus');
                      useTimer.getState().start();
                      close();
                    }}
                  />
                )}

                <MenuSep />
                <div className="px-2 pb-1 pt-1.5">
                  <span className="t-label">{t(L('Напомни ми', 'Remind me'))}</span>
                </div>
                <MenuItem
                  icon="bell"
                  label={t(L('След час', 'In an hour'))}
                  onClick={() => {
                    remind(60);
                    close();
                  }}
                />
                <MenuItem
                  icon="bell"
                  label={t(L('Довечера в 19:00', 'Tonight at 19:00'))}
                  onClick={() => {
                    const at = new Date();
                    at.setHours(19, 0, 0, 0);
                    void usePlanner
                      .getState()
                      .updateItem(item.id, {
                        remindAt: at.getTime() < Date.now() ? Date.now() + 3_600_000 : at.getTime(),
                        remindedAt: null,
                      });
                    noteReminderSaved();
                    close();
                  }}
                />
                <MenuItem
                  icon="bellRing"
                  label={t(L('Утре в 9:00', 'Tomorrow at 9:00'))}
                  onClick={() => {
                    remindTomorrowMorning();
                    close();
                  }}
                />
                {typeof item.remindAt === 'number' && (
                  <MenuItem
                    icon="x"
                    label={t(L('Махни напомнянето', 'Clear the reminder'))}
                    onClick={() => {
                      remind(null);
                      close();
                    }}
                  />
                )}

                {doc && (
                  <>
                    <MenuSep />
                    <MenuItem
                      icon="book"
                      label={t(L('Отвори материала', 'Open material'))}
                      onClick={() => {
                        void openDoc(doc.id);
                        close();
                      }}
                    />
                  </>
                )}
                <MenuSep />
                <MenuItem
                  icon="trash"
                  danger
                  label={t(S.delete)}
                  onClick={() => {
                    // No confirmation dialog: deleting one row is not a
                    // dangerous act, it is a common one, and a modal in front
                    // of every one of them is a tax on the ninety-nine times
                    // the person meant it. The way back is a button on the
                    // toast, which costs nothing when it is not needed.
                    const snapshot = item;
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
        </div>
      </div>

      {/* --------------------------------------------------------- steps */}
      {method === 'checklist' && openSteps && (
        <div className="pb-2 pl-[42px] pr-3">
          {steps.map((step) => (
            <div key={step.id} className="group/step flex items-center gap-2.5 py-1">
              <button
                onClick={() => void usePlanner.getState().toggleStep(item.id, step.id)}
                aria-pressed={step.done}
                className="grid h-[15px] w-[15px] shrink-0 cursor-pointer place-items-center rounded-[4px] border transition-all active:scale-90"
                style={{
                  borderColor: step.done ? 'var(--c-success)' : 'var(--c-line-strong)',
                  background: step.done ? 'var(--c-success)' : 'transparent',
                }}
              >
                {step.done && <Icon name="check" size={10} className="text-white" strokeWidth={3} />}
              </button>
              <span className={`flex-1 truncate text-[12.5px] ${step.done ? 'text-faint line-through' : ''}`}>
                {step.title}
              </span>
              <button
                className="icon-btn h-6 w-6 shrink-0 hover-reveal"
                aria-label={t(S.delete)}
                onClick={() => void usePlanner.getState().removeStep(item.id, step.id)}
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          ))}
          <form
            className="flex items-center gap-2.5 py-1"
            onSubmit={(e) => {
              e.preventDefault();
              void usePlanner.getState().addStep(item.id, newStep);
              setNewStep('');
            }}
          >
            <Icon name="plus" size={13} className="shrink-0 text-faint" />
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t(L('Добави стъпка', 'Add a step'))}
              className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
            />
          </form>
        </div>
      )}
    </div>
  );
}

const REPEAT_SHORT = {
  none: L('', ''),
  daily: L('всеки ден', 'daily'),
  weekdays: L('делник', 'weekdays'),
  weekly: L('седмично', 'weekly'),
  monthly: L('месечно', 'monthly'),
  yearly: L('годишно', 'yearly'),
};
