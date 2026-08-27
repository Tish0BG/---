import { useMemo, useRef, useState } from 'react';
import { usePlanner, startOfDay } from '@/state/plannerStore';
import { dayKey } from '@/lib/util';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes, allTypes, typeOf, typeName } from '@/state/itemTypeStore';
import { useGame } from '@/state/gameStore';
import { notify } from '@/state/toastStore';
import { noteReminderSaved } from '@/services/reminderService';
import { L, useLang, useT, type Msg } from '@/i18n';
import { S } from '@/i18n/strings';
import type { PlannerItem } from '@/types';
import { Icon } from '../Icon';
import { Popover } from '../ui';

/**
 * ───────────────────────────────────────────────────────── writing an entry ──
 *
 * A line to type, and one row of controls under it. Nothing else — no title
 * bar, no bordered fields, no Save button.
 *
 * The first attempt at this kept a dialog header, put every control in an
 * outlined pill, and finished with Cancel and Add. That is three frames around
 * one sentence: the header repeats what the placeholder already says, an
 * outline around a control that is showing its own value is a box drawn around
 * a word, and a Save button is a second way of doing what Enter already does.
 * Each is defensible on its own and together they rebuild the form that was
 * being replaced.
 *
 * So the controls are plain — an icon and, where it earns the space, a word.
 * The three that most people never touch (reminder, priority, type) show only
 * their icon until they have something to say, which is what keeps all six on
 * one line. Grey means "still on its default", ink means "this has been set",
 * and that is the entire visual language of the row.
 */

const DURATIONS = [0, 15, 30, 45, 60, 90, 120];

const PRIORITY: Record<0 | 1 | 2, Msg> = {
  0: L('Нормален', 'Normal'),
  1: L('Важен', 'Important'),
  2: L('Спешен', 'Urgent'),
};

const PRIORITY_TONE: Record<0 | 1 | 2, string> = {
  0: 'var(--c-muted)',
  1: 'var(--c-warn)',
  2: 'var(--c-danger)',
};

/**
 * Reminders, written the way people say them.
 *
 * The old field was a `datetime-local` box: to be nudged half an hour before a
 * lesson you had to work out what half an hour before it actually was, and
 * type that. These are offsets in minutes from when the thing is due, resolved
 * to a real moment only on save — so moving the deadline afterwards moves the
 * reminder with it.
 */
const LEAD_OPTIONS: { minutes: number; label: Msg }[] = [
  { minutes: 0, label: L('В момента на срока', 'When it is due') },
  { minutes: 10, label: L('10 минути преди', '10 minutes before') },
  { minutes: 30, label: L('30 минути преди', '30 minutes before') },
  { minutes: 60, label: L('1 час преди', '1 hour before') },
  { minutes: 180, label: L('3 часа преди', '3 hours before') },
  { minutes: 1440, label: L('1 ден преди', 'A day before') },
  { minutes: 2880, label: L('2 дни преди', 'Two days before') },
  { minutes: 10080, label: L('1 седмица преди', 'A week before') },
];

/** An entry with no hour is treated as due at nine in the morning. */
const DEFAULT_HOUR = 9;

/**
 * The moment a reminder should fire, or null when it cannot be worked out.
 *
 * `null` for "no reminder wanted" and for "wanted, but there is no date to
 * count back from" — a lead time without a deadline is not a time.
 */
export function resolveReminder(
  due: number | null,
  time: string | null,
  lead: number | null,
): number | null {
  if (due === null || lead === null) return null;
  const at = new Date(due);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    at.setHours(h || 0, m || 0, 0, 0);
  } else {
    at.setHours(DEFAULT_HOUR, 0, 0, 0);
  }
  return at.getTime() - lead * 60_000;
}

export function TaskComposer({
  startKind = 'task',
  seed,
  onDone,
}: {
  startKind?: string;
  /**
   * What the thing that opened this already knows.
   *
   * "Add" pressed inside Thursday's column means Thursday, and pressed while
   * the board is filtered to one channel it means that channel. Without it the
   * composer opened on today with no channel and the person had to correct it
   * — which is the whole reason the plan grew a second way to add a task.
   */
  seed?: { due?: number | null; subjectId?: string | null } | null;
  onDone: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const subjects = useWorkspace((s) => s.subjects);
  const custom = useItemTypes((s) => s.custom);
  const types = useMemo(() => allTypes(custom), [custom]);

  const [title, setTitle] = useState('');
  const [itemKind, setItemKind] = useState(startKind);
  const [due, setDue] = useState<number | null>(() =>
    seed && 'due' in seed ? (seed.due ?? null) : startOfDay(new Date()),
  );
  const [time, setTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [subjectId, setSubjectId] = useState<string | null>(seed?.subjectId ?? null);
  const [lead, setLead] = useState<number | null>(null);
  const [priority, setPriority] = useState<0 | 1 | 2>(0);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const type = typeOf(itemKind, custom);
  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  const ready = title.trim().length > 0 && !busy;

  /**
   * `again` keeps the window open with the day and the channel still set.
   *
   * The plan used to have a one-line field in every column that cleared itself
   * and kept the focus, so five tasks took five seconds. Routing creation
   * through this dialog would have cost that, and it is the kind of loss
   * people feel on the second day rather than the first. ⌘↵ is that loop.
   */
  const save = async (again = false) => {
    if (!ready) return;
    setBusy(true);
    const remindAt = resolveReminder(due, time, lead);
    const patch: Partial<PlannerItem> = {
      kind: itemKind,
      title: title.trim(),
      subjectId,
      priority,
      due,
      time: due && time ? time : null,
      duration,
      remindAt,
    };
    await usePlanner.getState().addItem(patch);
    if (remindAt) noteReminderSaved();
    void useGame.getState().refresh();
    notify.ok(t(L(`${typeName(type, 'bg')} е добавен${type.id === 'task' ? 'а' : ''}`, `${typeName(type, 'en')} added`)));
    if (!again) {
      onDone();
      return;
    }
    // Everything the next one probably shares stays; only what was written
    // about this particular thing is cleared.
    setBusy(false);
    setTitle('');
    setLead(null);
    setDuration(0);
    titleRef.current?.focus();
  };

  return (
    <div>
      {/* The only thing the app cannot guess, at the size that says so. */}
      <input
        ref={titleRef}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void save(e.metaKey || e.ctrlKey);
          }
        }}
        placeholder={t(L('Какво трябва да се направи?', 'What needs doing?'))}
        className="w-full border-0 bg-transparent p-0 text-[22px] tracking-[-0.02em] outline-none placeholder:text-faint"
      />

      <div className="mt-5 flex items-center gap-1">
        {/* ------------------------------------------------------- when */}
        <Control icon="calendar" label={dueLabel(due, lang, t)} set={due !== null} width={228}>
          {(close) => (
            <>
              {[
                { label: L('Днес', 'Today'), value: () => startOfDay(new Date()) },
                { label: L('Утре', 'Tomorrow'), value: () => startOfDay(addDays(1)) },
                { label: L('Другата седмица', 'Next week'), value: () => startOfDay(addDays(7)) },
                { label: L('Без срок', 'No date'), value: () => null },
              ].map((option) => (
                <Row
                  key={option.label.en}
                  label={t(option.label)}
                  on={sameDayAs(due, option.value())}
                  onClick={() => {
                    setDue(option.value());
                    close();
                  }}
                />
              ))}
              <Divider />
              <label className="block px-2 pb-2 pt-1">
                <span className="t-label mb-1 block">{t(L('Друга дата', 'Another date'))}</span>
                <input
                  type="date"
                  className="field t-num w-full"
                  value={due ? dayKey(due) : ''}
                  onChange={(e) => setDue(e.target.value ? startOfDay(new Date(e.target.value)) : null)}
                />
              </label>
            </>
          )}
        </Control>

        {/* ------------------------- the hour, and how long it will take */}
        <Control
          icon="clock"
          label={timeLabel(time, duration, t)}
          set={!!time || duration > 0}
          width={210}
          title={t(L('Час и времетраене', 'Time and length'))}
        >
          {(close) => (
            <>
              <label className="block px-2 pb-1.5 pt-1">
                <span className="t-label mb-1 block">{t(L('В колко часа', 'At what time'))}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    className="field t-num w-full"
                    value={time ?? ''}
                    onChange={(e) => setTime(e.target.value || null)}
                  />
                  {time && (
                    <button
                      className="icon-btn h-8 w-8 shrink-0"
                      onClick={() => setTime(null)}
                      aria-label={t(L('Без час', 'No time'))}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
              </label>
              <Divider />
              <p className="t-label px-2 pb-1 pt-0.5">{t(L('Колко ще отнеме', 'How long'))}</p>
              {DURATIONS.map((m) => (
                <Row
                  key={m}
                  label={m === 0 ? t(L('Не знам', 'Not sure')) : t(L(`${m} минути`, `${m} minutes`))}
                  on={m === duration}
                  onClick={() => {
                    setDuration(m);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </Control>

        {/* ---------------------------------------------------- subject */}
        {subjects.length > 0 && (
          <Control
            icon="layers"
            label={subject?.name ?? t(S.subject)}
            set={!!subject}
            tint={subject?.color}
            width={200}
          >
            {(close) => (
              <>
                <Row
                  label={t(S.noSubject)}
                  on={!subjectId}
                  onClick={() => {
                    setSubjectId(null);
                    close();
                  }}
                />
                {subjects.map((x) => (
                  <Row
                    key={x.id}
                    label={x.name}
                    dot={x.color}
                    on={x.id === subjectId}
                    onClick={() => {
                      setSubjectId(x.id);
                      close();
                    }}
                  />
                ))}
              </>
            )}
          </Control>
        )}

        {/* --------------------------------------------------- reminder */}
        {/* Icon alone until it has something to report — see the note at the
            top of the file. Same for the two after it. */}
        <Control
          icon="bell"
          label={lead === null ? '' : t(leadLabel(lead))}
          set={lead !== null}
          width={216}
          disabled={due === null}
          title={t(L('Напомняне', 'Reminder'))}
        >
          {(close) => (
            <>
              <Row
                label={t(L('Без напомняне', 'No reminder'))}
                on={lead === null}
                onClick={() => {
                  setLead(null);
                  close();
                }}
              />
              <Divider />
              {LEAD_OPTIONS.map((option) => (
                <Row
                  key={option.minutes}
                  label={t(option.label)}
                  on={lead === option.minutes}
                  onClick={() => {
                    setLead(option.minutes);
                    close();
                  }}
                />
              ))}
              <p className="px-2 pb-1.5 pt-1 text-[11px] leading-relaxed text-faint">
                {time
                  ? t(L(`Спрямо ${time} на срока.`, `Counted back from ${time} on the day.`))
                  : t(L('Без зададен час се брои от 9:00 сутринта.', 'With no time set, counted from 9:00.'))}
              </p>
            </>
          )}
        </Control>

        {/* --------------------------------------------------- priority */}
        <Control
          icon="flag"
          label={priority === 0 ? '' : t(PRIORITY[priority])}
          set={priority > 0}
          tint={priority > 0 ? PRIORITY_TONE[priority] : undefined}
          width={168}
          title={t(S.priority)}
        >
          {(close) =>
            ([0, 1, 2] as const).map((p) => (
              <Row
                key={p}
                label={t(PRIORITY[p])}
                dot={p === 0 ? undefined : PRIORITY_TONE[p]}
                on={p === priority}
                onClick={() => {
                  setPriority(p);
                  close();
                }}
              />
            ))
          }
        </Control>

        {/* ------------------------------------------------------- type */}
        <Control
          icon={type.icon}
          label={itemKind === 'task' ? '' : typeName(type, lang)}
          set={itemKind !== 'task'}
          tint={type.color ?? undefined}
          width={190}
          title={t(L('Вид', 'Kind'))}
        >
          {(close) =>
            types.map((x) => (
              <Row
                key={x.id}
                icon={x.icon}
                label={typeName(x, lang)}
                dot={x.color ?? undefined}
                on={x.id === itemKind}
                onClick={() => {
                  setItemKind(x.id);
                  close();
                }}
              />
            ))
          }
        </Control>

        {/* Enter is the button. This only says so, and only while there is
            something for it to do. */}
        <span className="ml-auto shrink-0 pl-2 text-[11.5px] text-faint">
          {ready ? t(L('↵ запис · ⌘↵ и още едно', '↵ to add · ⌘↵ to add another')) : ''}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

/**
 * One control: an icon, and a word only when there is one worth showing.
 *
 * No border and no fill. The outline this used to have was drawn around a
 * control whose entire job is to display its own value — a box around a word,
 * repeated six times, which is most of why the row read as a form. What is
 * left is the difference between grey and ink, and that turns out to be
 * enough: grey means untouched, ink means set.
 *
 * `label` may be empty, in which case only the icon shows and `title` names it
 * for the pointer and the accessibility tree. That is how six controls fit on
 * one line without abbreviating any of them.
 */
function Control({
  icon,
  label,
  set,
  tint,
  width,
  disabled,
  title,
  children,
}: {
  icon: string;
  label: string;
  set: boolean;
  tint?: string;
  width: number;
  disabled?: boolean;
  /** used when `label` is empty, so an icon-only control still has a name */
  title?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  /**
   * The spoken name, which is not always the visible one.
   *
   * "Днес" and "Предмет" say what they are. "--:--" does not — it is a shape
   * standing in for an empty time — so a control with a `title` announces that
   * first and its value after it.
   */
  const name = title ? (label ? `${title}: ${label}` : title) : label;
  const body = (
    <>
      <Icon name={icon} size={15} strokeWidth={set ? 2 : 1.7} />
      {label && <span className="truncate">{label}</span>}
    </>
  );

  if (disabled) {
    return (
      <span
        className="flex h-8 cursor-not-allowed items-center gap-1.5 rounded-[8px] px-2 text-[13px] opacity-40"
        style={{ color: 'var(--c-faint)' }}
        title={name}
      >
        {body}
      </span>
    );
  }

  return (
    <Popover
      width={width}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          onClick={toggle}
          aria-expanded={open}
          aria-label={name}
          title={name}
          className="flex h-8 max-w-[150px] cursor-pointer items-center gap-1.5 rounded-[8px] px-2 text-[13px] transition-colors hover:bg-surface-2"
          style={{
            color: set ? (tint ?? 'var(--c-text)') : 'var(--c-faint)',
            background: open ? 'var(--c-surface-2)' : undefined,
          }}
        >
          {body}
        </button>
      )}
    >
      {(close) => <div className="max-h-[320px] overflow-y-auto py-0.5">{children(close)}</div>}
    </Popover>
  );
}

function Row({
  label,
  icon,
  dot,
  on,
  onClick,
}: {
  label: string;
  icon?: string;
  dot?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="menuitemradio"
      aria-checked={on}
      className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[13px] transition-colors hover:bg-surface-3"
      style={{ color: on ? 'var(--c-text)' : 'var(--c-muted)', fontWeight: on ? 500 : 400 }}
    >
      {dot && <span className="badge-dot shrink-0" style={{ background: dot }} />}
      {icon && <Icon name={icon} size={14} className="shrink-0 opacity-80" />}
      <span className="flex-1 truncate">{label}</span>
      {on && <Icon name="check" size={13} className="shrink-0" />}
    </button>
  );
}

const Divider = () => <div className="my-1 h-px" style={{ background: 'var(--c-line)' }} />;

/* ----------------------------------------------------------------- dates */

const addDays = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const sameDayAs = (a: number | null, b: number | null): boolean =>
  a === null || b === null ? a === b : dayKey(a) === dayKey(b);

function dueLabel(due: number | null, lang: 'bg' | 'en', t: (m: Msg) => string): string {
  if (due === null) return t(L('Без срок', 'No date'));
  if (sameDayAs(due, startOfDay(new Date()))) return t(L('Днес', 'Today'));
  if (sameDayAs(due, startOfDay(addDays(1)))) return t(L('Утре', 'Tomorrow'));
  if (sameDayAs(due, startOfDay(addDays(-1)))) return t(L('Вчера', 'Yesterday'));
  return new Date(due).toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * What the clock reads: the hour if there is one, the length if there is not,
 * both when both are set. `--:--` when neither is, which is the reference's
 * own way of showing an empty time.
 */
function timeLabel(time: string | null, duration: number, t: (m: Msg) => string): string {
  const length = duration > 0 ? t(L(`${duration} мин`, `${duration} min`)) : '';
  if (time && length) return `${time} · ${length}`;
  if (time) return time;
  return length || '--:--';
}

function leadLabel(minutes: number): Msg {
  if (minutes === 0) return L('На срока', 'When due');
  if (minutes < 60) return L(`${minutes} мин преди`, `${minutes} min before`);
  if (minutes < 1440) return L(`${minutes / 60} ч преди`, `${minutes / 60} h before`);
  const days = minutes / 1440;
  if (days === 7) return L('седмица преди', 'a week before');
  // Bulgarian counts one thing differently from several, and so does English
  // once the article is involved: "1 дни преди" and "1 days before" are both
  // wrong, and both are what a bare template produces.
  if (days === 1) return L('ден преди', 'a day before');
  return L(`${days} дни преди`, `${days} days before`);
}
