import { useState } from 'react';
import type { PlannerItem } from '@/types';
import { useWorkspace } from '@/state/workspaceStore';
import { usePlanner, addDays, startOfDay } from '@/state/plannerStore';
import { useTimer } from '@/state/timerStore';
import { useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { useT, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover } from '../ui';
import { Tooltip } from '../kit';
import { DueChip } from '../planner/DueChip';

export const KIND_ICON: Record<PlannerItem['kind'], string> = {
  task: 'listTodo',
  homework: 'pencil',
  exam: 'graduation',
};

/**
 * One task, everywhere.
 *
 * The row carries everything a decision needs — subject, deadline, priority,
 * the focus blocks already spent — and every one of them is actionable in
 * place: tick it, start a session on it, push it to tomorrow, open the
 * material it belongs to. Opening a detail screen to change a date is how a
 * task list stops being used.
 */
export function TaskRow({
  item,
  onEdit,
  dense,
}: {
  item: PlannerItem;
  onEdit?: (item: PlannerItem) => void;
  dense?: boolean;
}) {
  const t = useT();
  const subjects = useWorkspace((s) => s.subjects);
  const documents = useLibrary((s) => s.documents);
  const subject = subjects.find((s) => s.id === item.subjectId) ?? null;
  const doc = documents.find((d) => d.id === item.docId);
  const [justDone, setJustDone] = useState(false);

  const toggle = () => {
    if (!item.done) {
      setJustDone(true);
      setTimeout(() => setJustDone(false), 700);
    }
    void usePlanner.getState().toggleItem(item.id);
  };

  const reschedule = (days: number | null) =>
    void usePlanner.getState().updateItem(item.id, {
      due: days === null ? null : startOfDay(addDays(days)),
    });

  return (
    <div
      className={`group flex items-center gap-3 rounded-[12px] border border-transparent px-3 transition-all duration-150 hover:border-line hover:bg-surface-2 ${
        dense ? 'py-2' : 'py-2.5'
      }`}
      style={item.done ? { opacity: 0.6 } : undefined}
    >
      <button
        onClick={toggle}
        aria-pressed={item.done}
        aria-label={t(item.done ? L('Върни като незавършена', 'Mark as not done') : L('Отметни', 'Mark done'))}
        className="relative grid h-[19px] w-[19px] shrink-0 cursor-pointer place-items-center rounded-[7px] border transition-all duration-150 active:scale-90"
        style={{
          borderColor: item.done ? 'var(--c-success)' : 'var(--c-line-strong)',
          background: item.done ? 'var(--c-success)' : 'transparent',
        }}
      >
        {item.done && <Icon name="check" size={13} className="text-white" strokeWidth={3} />}
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
          <span className={`truncate text-[13.5px] ${item.done ? 'line-through' : 'font-medium'}`}>
            {item.title}
          </span>
          {item.kind === 'exam' && (
            <span className="chip shrink-0" style={{ background: 'var(--c-warn-soft)', color: 'var(--c-warn)' }}>
              {t(S.exam)}
            </span>
          )}
        </span>
        {(subject || item.notes || doc || item.pomodoros > 0) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted">
            {subject && (
              <span className="inline-flex items-center gap-1.5">
                <span className="badge-dot" style={{ background: subject.color }} />
                {subject.name}
              </span>
            )}
            {doc && (
              <span className="inline-flex max-w-[180px] items-center gap-1">
                <Icon name="book" size={11} />
                <span className="truncate">{doc.name}</span>
              </span>
            )}
            {item.pomodoros > 0 && (
              <span className="t-num inline-flex items-center gap-1">
                <Icon name="timer" size={11} />
                {item.pomodoros}
              </span>
            )}
            {item.notes && !dense && <span className="truncate opacity-80">{item.notes}</span>}
          </span>
        )}
      </button>

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

      {item.due !== null && !item.done && <DueChip due={item.due} />}

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!item.done && (
          <Tooltip label={t(L('Фокус върху задачата', 'Focus on this task'))}>
            <button
              className="icon-btn h-7 w-7"
              aria-label={t(L('Започни фокус', 'Start focus'))}
              onClick={() => {
                useTimer.getState().setActiveTask(item.id);
                useTimer.getState().setView('full');
                useTimer.getState().start();
              }}
            >
              <Icon name="play" size={14} />
            </button>
          </Tooltip>
        )}

        <Popover
          width={214}
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
                icon="x"
                label={t(L('Без срок', 'No deadline'))}
                onClick={() => {
                  reschedule(null);
                  close();
                }}
              />
              {doc && (
                <>
                  <MenuSep />
                  <MenuItem
                    icon="book"
                    label={t(L('Отвори материала', 'Open material'))}
                    onClick={() => {
                      void useViewer.getState().openDocument(doc.id);
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
                  void usePlanner.getState().removeItem(item.id);
                  close();
                }}
              />
            </>
          )}
        </Popover>
      </div>
    </div>
  );
}
