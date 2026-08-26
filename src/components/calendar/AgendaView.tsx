import { useMemo } from 'react';
import { usePlanner } from '@/state/plannerStore';
import type { PlannerItem } from '@/types';
import { useApp } from '@/state/appStore';
import { L, clockTime, formatDate, useLang, useT } from '@/i18n';
import { Card, EmptyState } from '../kit';
import { Icon } from '../Icon';
import { keyOf, statusOf, type CalEvent } from './events';

/**
 * ─────────────────────────────────────────────────────────────── the agenda ──
 *
 * Everything ahead, in order, grouped by day — the one view the calendar did
 * not have.
 *
 * A month grid answers "what does March look like" and answers "what am I
 * actually doing next" badly: the reader has to scan forty-two boxes and hold
 * the order in their head. A list answers the second question directly, and it
 * is the view that survives a filter — narrowing a month grid to two matching
 * events leaves forty empty boxes, while narrowing a list leaves two rows.
 *
 * It is also the only view where a whole day of nothing is simply absent
 * rather than drawn as an empty cell, which is why it is the one that scrolls
 * comfortably on a phone.
 */
export function AgendaView({
  events,
  days,
  now,
  onOpenDay,
  onEdit,
}: {
  events: Map<string, CalEvent[]>;
  /** the same range the other views are showing, so the two agree */
  days: Date[];
  now: number;
  onOpenDay: (d: Date) => void;
  onEdit?: (item: PlannerItem) => void;
}) {
  const t = useT();
  const lang = useLang();

  const groups = useMemo(() => {
    return days
      .map((day) => ({ day, list: events.get(keyOf(day)) ?? [] }))
      .filter((g) => g.list.length > 0);
  }, [days, events]);

  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="calendar"
          title={t(L('Нищо в този период', 'Nothing in this stretch'))}
          body={t(
            L(
              'Няма часове, срокове или изпити тук. Смени периода отгоре или добави нещо ново.',
              'No lessons, deadlines or exams here. Change the range above, or add something new.',
            ),
          )}
          action={{
            label: t(L('Добави', 'Add')),
            onClick: () => useApp.getState().setQuick('item'),
          }}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ day, list }) => {
        const isToday = keyOf(now) === keyOf(day);
        return (
          <section key={keyOf(day)}>
            {/* The date is a heading, not a row: it never scrolls past
                without the reader noticing which day they have moved into. */}
            <div className="mb-2 flex items-baseline gap-2.5 px-0.5">
              <button
                onClick={() => onOpenDay(day)}
                className="flex cursor-pointer items-baseline gap-2.5 text-left"
              >
                <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] first-letter:uppercase">
                  {formatDate(day.getTime(), lang, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {isToday && (
                  <span
                    className="rounded-full px-1.5 py-px text-[10.5px] font-medium"
                    style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
                  >
                    {t(L('днес', 'today'))}
                  </span>
                )}
              </button>
              <span className="t-num ml-auto text-[11.5px] text-faint">{list.length}</span>
            </div>

            <Card flush>
              {list.map((event, i) => (
                <AgendaRow
                  key={event.id}
                  event={event}
                  now={now}
                  first={i === 0}
                  lang={lang}
                  onEdit={onEdit}
                />
              ))}
            </Card>
          </section>
        );
      })}
    </div>
  );
}

function AgendaRow({
  event,
  now,
  first,
  lang,
  onEdit,
}: {
  event: CalEvent;
  now: number;
  first: boolean;
  lang: 'bg' | 'en';
  onEdit?: (item: PlannerItem) => void;
}) {
  const t = useT();
  const items = usePlanner((s) => s.items);
  const status = statusOf(event, now);
  /** Only the two kinds that are actually owed can be ticked off here. */
  const tickable = event.kind === 'task' || event.kind === 'exam';
  /** A lesson and a logged session have no editable record behind them. */
  const openable = tickable && !!onEdit;

  const when = event.allDay
    ? t(L('Цял ден', 'All day'))
    : event.end
      ? `${clockTime(event.start, lang)} – ${clockTime(event.end, lang)}`
      : clockTime(event.start, lang);

  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-2 ${
        first ? '' : 'border-t border-line'
      }`}
    >
      {tickable ? (
        <button
          onClick={() => void usePlanner.getState().toggleItem(event.refId)}
          aria-pressed={event.done}
          aria-label={t(event.done ? L('Върни като незавършена', 'Mark as not done') : L('Готово', 'Mark done'))}
          className="grid h-[17px] w-[17px] shrink-0 cursor-pointer place-items-center rounded-[5px] border transition-colors"
          style={{
            borderColor: event.done ? 'var(--c-accent)' : 'var(--c-line-strong)',
            background: event.done ? 'var(--c-accent)' : 'transparent',
            color: 'var(--c-accent-text)',
          }}
        >
          {event.done && <Icon name="check" size={11} strokeWidth={3.2} />}
        </button>
      ) : (
        <span className="badge-dot shrink-0" style={{ background: event.color }} />
      )}

      <button
        type="button"
        disabled={!openable}
        onClick={() => {
          const item = items.find((i) => i.id === event.refId);
          if (item) onEdit?.(item);
        }}
        className={`min-w-0 flex-1 text-left ${openable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span
          className="block truncate text-[13.5px]"
          style={{
            textDecoration: event.done ? 'line-through' : undefined,
            color: event.done ? 'var(--c-faint)' : undefined,
          }}
        >
          {event.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted">
          <span className="t-num">{when}</span>
          {event.subjectName && (
            <>
              <span className="text-faint">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="badge-dot" style={{ background: event.color }} />
                {event.subjectName}
              </span>
            </>
          )}
          {event.room && (
            <>
              <span className="text-faint">·</span>
              <span>{event.room}</span>
            </>
          )}
          {event.minutes !== undefined && (
            <>
              <span className="text-faint">·</span>
              <span className="t-num">{t(L(`${event.minutes} мин`, `${event.minutes} min`))}</span>
            </>
          )}
        </span>
      </button>

      {status === 'overdue' && (
        <span
          className="chip shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--c-danger) 12%, transparent)',
            color: 'var(--c-danger)',
          }}
        >
          {t(L('просрочена', 'overdue'))}
        </span>
      )}
      {event.kind === 'exam' && (
        <Icon name="graduation" size={14} className="shrink-0 text-faint" />
      )}
      {event.kind === 'session' && <Icon name="timer" size={14} className="shrink-0 text-faint" />}
    </div>
  );
}
