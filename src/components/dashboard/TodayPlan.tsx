import { useMemo, useState } from 'react';
import { useApp } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import {
  usePlanner,
  dueToday,
  overdue,
  sortByDue,
  toMinutes,
  startOfDay,
  endOfDay,
} from '@/state/plannerStore';
import { useTimer, dayKey } from '@/state/timerStore';
import { useT, L, useLang, clockTime } from '@/i18n';
import { S } from '@/i18n/strings';
import type { ClassSlot, PlannerItem } from '@/types';
import { Icon } from '../Icon';
import { Card, CardLink, EmptyState, Tooltip, useNow } from '../kit';

type Entry =
  | { type: 'class'; at: number; end: number; slot: ClassSlot }
  | { type: 'task'; at: number | null; item: PlannerItem }
  | { type: 'done'; at: number; minutes: number; label: string };

/**
 * The day, in order.
 *
 * Timetable, deadlines and finished focus blocks are three different records
 * in three different stores, but they are one thing to the person reading:
 * what is happening today. The row that is happening right now is marked, and
 * every row can be started or ticked without leaving the screen.
 */
export function TodayPlan() {
  const t = useT();
  const lang = useLang();
  const now = useNow(60_000);
  const items = usePlanner((s) => s.items);
  const schedule = usePlanner((s) => s.schedule);
  const sessions = useTimer((s) => s.sessions);
  const subjects = useWorkspace((s) => s.subjects);
  const subjectOf = (id: string | null | undefined) => subjects.find((s) => s.id === id) ?? null;

  const entries = useMemo<Entry[]>(() => {
    const today = new Date(now);
    const midnight = startOfDay(today);
    const out: Entry[] = [];

    for (const slot of schedule.filter((s) => s.day === today.getDay())) {
      out.push({
        type: 'class',
        at: midnight + toMinutes(slot.start) * 60_000,
        end: midnight + toMinutes(slot.end) * 60_000,
        slot,
      });
    }

    for (const item of sortByDue([...overdue(items), ...dueToday(items)])) {
      out.push({ type: 'task', at: null, item });
    }

    const key = dayKey(today);
    for (const s of sessions.filter((x) => x.day === key)) {
      out.push({
        type: 'done',
        at: s.startedAt,
        minutes: s.minutes,
        label: subjectOf(s.subjectId)?.name ?? t(L('Фокус сесия', 'Focus session')),
      });
    }

    return out.sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, schedule, sessions, subjects, now, lang]);

  const activeIndex = entries.findIndex((e) => e.type === 'class' && e.at <= now && e.end > now);

  /** A long day of pomodoros should not push the actual work off the card. */
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 8;
  const shown = expanded ? entries : entries.slice(0, LIMIT);
  const hidden = entries.length - shown.length;

  return (
    <Card
      title={t(L('Днешният план', "Today's plan"))}
      subtitle={
        entries.length
          ? t(L(`${entries.length} записа · ${countOpen(items)} отворени задачи`, `${entries.length} entries · ${countOpen(items)} open tasks`))
          : undefined
      }
      icon="calendarCheck"
      action={<CardLink label={t(S.calendar)} onClick={() => useApp.getState().go('calendar')} />}
      flush
    >
      {entries.length === 0 ? (
        <EmptyState
          compact
          icon="coffee"
          title={t(L('Чист график', 'A clear day'))}
          body={t(L('Нищо не гори за днес. Добър момент да навакса нещо или просто да починеш.', 'Nothing is due today. A good moment to get ahead — or to rest.'))}
          action={{
            label: t(L('Добави задача', 'Add a task')),
            icon: 'plus',
            onClick: () => useApp.getState().setQuick('task'),
          }}
        />
      ) : (
        <ul className="stagger px-2 pb-3">
          {shown.map((entry, i) => (
            <li key={i} className="relative flex gap-3 px-2">
              {/* time gutter + rail */}
              <div className="relative flex w-[52px] shrink-0 justify-end pt-3">
                <span
                  className={`t-num text-[11.5px] ${i === activeIndex ? 'font-semibold text-ink' : 'text-faint'}`}
                >
                  {entry.at !== null ? clockTime(entry.at, lang) : ''}
                </span>
              </div>

              <div className="relative flex w-4 shrink-0 justify-center">
                {i < shown.length - 1 && (
                  <span className="absolute inset-y-0 top-5 w-px" style={{ background: 'var(--c-line)' }} />
                )}
                <span
                  className="relative mt-4 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background: dotColor(entry, subjectOf),
                    boxShadow: i === activeIndex ? '0 0 0 4px color-mix(in srgb, var(--c-accent) 22%, transparent)' : undefined,
                  }}
                />
              </div>

              <div className="min-w-0 flex-1 py-1.5">
                <Row entry={entry} live={i === activeIndex} />
              </div>
            </li>
          ))}
          {hidden > 0 && (
            <li className="px-2 pt-1">
              <button
                onClick={() => setExpanded(true)}
                className="w-full cursor-pointer rounded-[10px] py-2 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {t(L(`Още ${hidden} записа`, `${hidden} more entries`))}
              </button>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

const countOpen = (items: PlannerItem[]) =>
  items.filter((i) => !i.done && i.due !== null && i.due <= endOfDay()).length;

function dotColor(entry: Entry, subjectOf: (id: string | null | undefined) => { color: string } | null): string {
  if (entry.type === 'class') return subjectOf(entry.slot.subjectId)?.color ?? 'var(--c-brand)';
  if (entry.type === 'done') return 'var(--c-success)';
  return entry.item.done ? 'var(--c-success)' : subjectOf(entry.item.subjectId)?.color ?? 'var(--c-faint)';
}

function Row({ entry, live }: { entry: Entry; live: boolean }) {
  const t = useT();
  const subjects = useWorkspace((s) => s.subjects);
  const subject = (id: string | null | undefined) => subjects.find((s) => s.id === id) ?? null;

  if (entry.type === 'class') {
    const s = subject(entry.slot.subjectId);
    const minutes = Math.round((entry.end - entry.at) / 60_000);
    return (
      <div
        className="group flex items-center gap-2 rounded-[10px] px-2.5 py-2 transition-colors"
        style={live ? { background: 'var(--c-accent-soft)' } : undefined}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium">{s?.name ?? t(S.noSubject)}</span>
            {live && (
              <span className="chip" style={{ background: 'var(--c-accent)', color: '#fff' }}>
                {t(L('сега', 'now'))}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {minutes} {t(L('мин', 'min'))}
            {entry.slot.room ? ` · ${entry.slot.room}` : ''}
          </p>
        </div>
        <Tooltip label={t(L('Фокус върху този час', 'Focus on this class'))}>
          <button
            className="icon-btn opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => {
              useTimer.getState().setView('full');
              useTimer.getState().start();
            }}
            aria-label={t(L('Започни фокус', 'Start focus'))}
          >
            <Icon name="play" size={15} />
          </button>
        </Tooltip>
      </div>
    );
  }

  if (entry.type === 'done') {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 opacity-75">
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted line-through decoration-[var(--c-line-strong)]">
          {entry.label}
        </span>
        <span className="t-num chip" style={{ background: 'var(--c-success-soft)', color: 'var(--c-success)' }}>
          +{entry.minutes} {t(L('мин', 'min'))}
        </span>
      </div>
    );
  }

  const item = entry.item;
  const s = subject(item.subjectId);
  const late = !item.done && item.due !== null && item.due < startOfDay();

  return (
    <div className="group flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 transition-colors hover:bg-surface-2">
      <button
        onClick={() => void usePlanner.getState().toggleItem(item.id)}
        className="grid h-[18px] w-[18px] shrink-0 cursor-pointer place-items-center rounded-[6px] border transition-all"
        style={{
          borderColor: item.done ? 'var(--c-success)' : 'var(--c-line-strong)',
          background: item.done ? 'var(--c-success)' : 'transparent',
        }}
        aria-label={t(item.done ? L('Отметни като незавършена', 'Mark as not done') : L('Готово', 'Mark done'))}
        aria-pressed={item.done}
      >
        {item.done && <Icon name="check" size={12} className="text-white" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <span className={`block truncate text-[13.5px] ${item.done ? 'text-muted line-through' : ''}`}>
          {item.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
          {s && (
            <>
              <span className="badge-dot" style={{ background: s.color }} />
              <span className="truncate">{s.name}</span>
            </>
          )}
          {item.kind === 'exam' && (
            <span className="chip" style={{ background: 'var(--c-warn-soft)', color: 'var(--c-warn)' }}>
              {t(S.exam)}
            </span>
          )}
          {late && (
            <span className="chip" style={{ background: 'var(--c-danger-soft)', color: 'var(--c-danger)' }}>
              {t(L('просрочена', 'overdue'))}
            </span>
          )}
        </span>
      </div>

      {item.priority > 0 && (
        <Icon
          name="flag"
          size={13}
          className="shrink-0"
          style={{ color: item.priority === 2 ? 'var(--c-danger)' : 'var(--c-warn)' }}
        />
      )}

      <Tooltip label={t(L('Фокус върху задачата', 'Focus on this task'))}>
        <button
          className="icon-btn opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => {
            useTimer.getState().setActiveTask(item.id);
            useTimer.getState().setView('full');
            useTimer.getState().start();
          }}
          aria-label={t(L('Започни фокус', 'Start focus'))}
        >
          <Icon name="play" size={15} />
        </button>
      </Tooltip>
    </div>
  );
}
