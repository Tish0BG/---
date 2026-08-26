import { useEffect, useMemo, useState } from 'react';
import { useApp, type QuickKind } from '@/state/appStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useItemTypes, allTypes, typeName, typeOf, KIND_DEFAULTS } from '@/state/itemTypeStore';
import { usePlanner, startOfDay, addDays, DAY_NAMES } from '@/state/plannerStore';
import { useGoals } from '@/state/goalStore';
import { useGame, gameContext } from '@/state/gameStore';
import { notify } from '@/state/toastStore';
import { METRIC_ICON, METRIC_LABEL, METRIC_UNIT } from '@/services/goalService';
import type { GoalMetric, PlannerItem, RepeatRule, TaskMethod } from '@/types';
import { useT, L, useLang } from '@/i18n';
import { S, PRIORITY } from '@/i18n/strings';
import { Modal, Select } from '../ui';
import { Button, Segmented, Sheet, useIsPhone } from '../kit';
import { Icon } from '../Icon';
import { METHOD_ICON, METHOD_LABEL } from '../tasks/TaskRow';
import { noteReminderSaved } from '@/services/reminderService';
import { TaskComposer } from './TaskComposer';

const DURATIONS = [0, 15, 30, 45, 60, 90, 120];

/**
 * One create dialog for the whole product.
 *
 * It used to have four modes — task, exam, goal, timetable slot — and three of
 * them were the same record. Now there is one "entry" whose *type* is a row of
 * chips at the top, which is what lets a person file a rehearsal without the
 * app having to ship a rehearsal feature.
 */
export function QuickCreate() {
  const kind = useApp((s) => s.quick);
  const phone = useIsPhone();
  const t = useT();
  const close = () => useApp.getState().setQuick(null);

  if (!kind) return null;
  /**
   * An entry gets the composer; a goal and a timetable slot keep the form.
   *
   * Those two are genuinely made of several answers — a goal is a number, a
   * unit and a deadline, a slot is a day and two times — and none of them has
   * a default worth guessing. An entry had eight fields and seven defaults,
   * which is the case the composer exists for.
   */
  const body =
    kind === 'item' ? (
      <TaskComposer startKind={useApp.getState().quickKind ?? 'task'} onDone={close} />
    ) : (
      <QuickForm kind={kind} onDone={close} />
    );
  const title = t(
    kind === 'goal'
      ? L('Нова цел', 'New goal')
      : kind === 'event'
        ? L('Нов час в програмата', 'New timetable slot')
        : L('Нов запис', 'New entry'),
  );

  /**
   * The entry composer gets a bare panel and more width: one row of controls
   * that wraps onto a second line has stopped being a row. Everything else
   * keeps the titled dialog, because a goal and a timetable slot really are
   * several questions and benefit from being announced as such.
   */
  const isItem = kind === 'item';

  return phone ? (
    <Sheet open onClose={close} title={title}>
      {body}
    </Sheet>
  ) : (
    <Modal open onClose={close} title={title} width={isItem ? 660 : 560} bare={isItem}>
      {body}
    </Modal>
  );
}

function QuickForm({ kind, onDone }: { kind: Exclude<QuickKind, null>; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const allSubjects = useWorkspace((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const custom = useItemTypes((s) => s.custom);
  const types = useMemo(() => allTypes(custom), [custom]);
  const filterSubject = useApp((s) => s.filterSubjectId);
  const startKind = useApp((s) => s.quickKind);

  const [itemKind, setItemKind] = useState(startKind);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(filterSubject);
  const [due, setDue] = useState<string>(startKind === 'exam' ? isoDay(addDays(7)) : '');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(0);
  const [priority, setPriority] = useState<0 | 1 | 2>(startKind === 'exam' ? 1 : 0);
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<TaskMethod>((KIND_DEFAULTS[startKind]?.method ?? 'check') as TaskMethod);
  const [repeat, setRepeat] = useState<RepeatRule>((KIND_DEFAULTS[startKind]?.repeat ?? 'none') as RepeatRule);
  const [remindAt, setRemindAt] = useState<string>('');
  /* goals */
  const [metric, setMetric] = useState<GoalMetric>('minutes');
  const [target, setTarget] = useState(600);
  /* timetable */
  const [day, setDay] = useState(new Date().getDay() || 1);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('08:45');

  const type = typeOf(itemKind, custom);

  const subjectOptions = useMemo(
    () => [
      { value: '', label: t(S.noSubject) },
      ...subjects.map((s) => ({ value: s.id, label: s.name, color: s.color })),
    ],
    [subjects, t],
  );

  const canSave = kind === 'event' ? !!subjectId : title.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    if (kind === 'goal') {
      const goals = useGoals.getState();
      await goals.add(
        {
          title: title.trim(),
          subjectId,
          metric,
          target: Math.max(1, target),
          deadline: due ? startOfDay(new Date(due)) : null,
        },
        gameContext(),
      );
      notify.ok(t(L('Целта е създадена', 'Goal created')));
    } else if (kind === 'event') {
      await usePlanner.getState().addSlot({ subjectId: subjectId ?? '', day, start, end });
      notify.ok(t(L('Часът е добавен в програмата', 'Added to your timetable')));
    } else {
      const patch: Partial<PlannerItem> = {
        kind: itemKind,
        title: title.trim(),
        notes,
        subjectId,
        priority,
        due: due ? startOfDay(new Date(due)) : null,
        time: due && time ? time : null,
        duration,
        method,
        repeat,
        remindAt: remindAt ? new Date(remindAt).getTime() : null,
      };
      await usePlanner.getState().addItem(patch);
      if (patch.remindAt) noteReminderSaved();
      notify.ok(
        t(L(`${typeName(type, 'bg')} е добавен${type.id === 'task' ? 'а' : ''}`, `${typeName(type, 'en')} added`)),
      );
    }
    void useGame.getState().refresh();
    onDone();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void save();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ the type */}
      {kind === 'item' && (
        <div>
          <label className="t-label mb-1.5 block">{t(L('Какво е това?', 'What is it?'))}</label>
          <div className="flex flex-wrap gap-1.5">
            {types.map((x) => {
              const on = x.id === itemKind;
              const tint = x.color ?? 'var(--c-accent)';
              return (
                <button
                  key={x.id}
                  onClick={() => {
                    setItemKind(x.id);
                    // A reminder arrives with a time, a habit with a rhythm:
                    // the two types that only make sense with a setting bring
                    // it with them rather than waiting to be configured.
                    const defaults = KIND_DEFAULTS[x.id];
                    if (defaults?.method) setMethod(defaults.method as TaskMethod);
                    if (defaults?.repeat) setRepeat(defaults.repeat as RepeatRule);
                    if (defaults?.remind && !remindAt) setRemindAt(nextHourInput());
                  }}
                  aria-pressed={on}
                  className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors"
                  style={{
                    borderColor: on ? 'transparent' : 'var(--c-line)',
                    background: on ? `color-mix(in srgb, ${tint} 15%, transparent)` : 'var(--c-surface)',
                    color: on ? tint : 'var(--c-muted)',
                  }}
                >
                  <Icon name={x.icon} size={13} />
                  {typeName(x, lang)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {kind !== 'event' && (
        <div>
          <label className="t-label mb-1.5 block">
            {kind === 'goal'
              ? t(L('Какво искаш да постигнеш?', 'What do you want to reach?'))
              : t(L('Какво трябва да се направи?', 'What needs doing?'))}
          </label>
          <input
            autoFocus
            className="field field-lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              kind === 'goal'
                ? t(L('20 часа за проекта този месец', '20 hours on the project this month'))
                : itemKind === 'exam'
                  ? t(L('Изпит по алгебра', 'Algebra exam'))
                  : itemKind === 'reminder'
                    ? t(L('Вземи лекарството в 20:00', 'Take the tablets at 20:00'))
                    : itemKind === 'habit'
                      ? t(L('30 минути разходка', 'A 30-minute walk'))
                      : t(L('Плати сметките', 'Pay the bills'))
            }
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="t-label mb-1.5 block">{t(S.subject)}</label>
          <Select
            value={subjectId ?? ''}
            options={subjectOptions}
            width={240}
            onChange={(v) => setSubjectId(v || null)}
            placeholder={t(S.noSubject)}
          />
        </div>

        {kind !== 'event' && (
          <div>
            <label className="t-label mb-1.5 block">
              {kind === 'goal' ? t(S.deadline) : t(L('Срок', 'Due'))}
            </label>
            <input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[
                { label: t(S.today), value: isoDay(new Date()) },
                { label: t(L('Утре', 'Tomorrow')), value: isoDay(addDays(1)) },
                { label: t(L('След седмица', 'Next week')), value: isoDay(addDays(7)) },
              ].map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setDue(chip.value)}
                  className={`chip cursor-pointer transition-colors ${
                    due === chip.value ? 'btn-ghost-active' : 'hover:bg-surface-3'
                  }`}
                  style={
                    due === chip.value ? undefined : { background: 'var(--c-surface-2)', color: 'var(--c-muted)' }
                  }
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------ when, and for how long */}
      {kind === 'item' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="t-label mb-1.5 block">{t(L('Час', 'Time'))}</label>
            <input
              type="time"
              className="field t-num"
              disabled={!due}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-faint">
              {t(L('Появява се в календара.', 'It shows up on the calendar.'))}
            </p>
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(L('Колко ще отнеме', 'How long it takes'))}</label>
            <Select
              value={String(duration)}
              width={200}
              options={DURATIONS.map((m) => ({
                value: String(m),
                label: m === 0 ? t(L('Не знам', 'Not sure')) : t(L(`${m} мин`, `${m} min`)),
              }))}
              onChange={(v) => setDuration(Number(v))}
            />
          </div>
        </div>
      )}

      {kind === 'item' && (
        <div>
          <label className="t-label mb-1.5 block">{t(S.priority)}</label>
          <Segmented
            value={String(priority)}
            onChange={(v) => setPriority(Number(v) as 0 | 1 | 2)}
            items={[
              { id: '0', label: t(PRIORITY[0]) },
              { id: '1', label: t(PRIORITY[1]) },
              { id: '2', label: t(PRIORITY[2]) },
            ]}
          />
        </div>
      )}

      {/* --------------------------------- how it gets done, and when */}
      {kind === 'item' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="t-label mb-1.5 block">{t(L('Как ще я направиш', 'How you will work it'))}</label>
            <Segmented
              value={method}
              onChange={(v: TaskMethod) => setMethod(v)}
              items={(['check', 'checklist', 'count', 'timer'] as TaskMethod[]).map((m) => ({
                id: m,
                label: t(METHOD_LABEL[m]),
                icon: METHOD_ICON[m],
              }))}
            />
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(L('Повтаря се', 'Repeats'))}</label>
            <Select
              value={repeat}
              width={200}
              options={[
                { value: 'none', label: t(L('Веднъж', 'Once')) },
                { value: 'daily', label: t(L('Всеки ден', 'Every day')) },
                { value: 'weekdays', label: t(L('Делник', 'Weekdays')) },
                { value: 'weekly', label: t(L('Седмично', 'Weekly')) },
                { value: 'monthly', label: t(L('Месечно', 'Monthly')) },
                { value: 'yearly', label: t(L('Годишно', 'Yearly')) },
              ]}
              onChange={(v) => setRepeat(v as RepeatRule)}
            />
          </div>
        </div>
      )}

      {kind === 'item' && (
        <div>
          <label className="t-label mb-1.5 block">{t(L('Напомни ми', 'Remind me'))}</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              className="field t-num w-auto"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
            />
            {[
              { label: t(L('След час', 'In an hour')), value: () => nextHourInput() },
              { label: t(L('Утре 9:00', 'Tomorrow 9:00')), value: () => morningInput(1) },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => setRemindAt(chip.value())}
                className="chip cursor-pointer transition-colors hover:bg-surface-3"
                style={{ background: 'var(--c-surface-2)', color: 'var(--c-muted)' }}
              >
                {chip.label}
              </button>
            ))}
            {remindAt && (
              <button
                className="icon-btn h-7 w-7"
                aria-label={t(L('Без напомняне', 'No reminder'))}
                onClick={() => setRemindAt('')}
              >
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {kind === 'goal' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="t-label mb-1.5 block">{t(L('Измерва се в', 'Measured in'))}</label>
            <Select
              value={metric}
              width={240}
              options={(['minutes', 'tasks', 'cards', 'pages', 'custom'] as GoalMetric[]).map((m) => ({
                value: m,
                label: t(METRIC_LABEL[m]),
                icon: METRIC_ICON[m],
              }))}
              onChange={(v) => {
                const next = v as GoalMetric;
                setMetric(next);
                setTarget(next === 'minutes' ? 600 : next === 'cards' ? 200 : next === 'pages' ? 150 : 20);
              }}
            />
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(L('Цел', 'Target'))}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="field t-num"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
              <span className="shrink-0 text-[12.5px] text-muted">{t(METRIC_UNIT[metric])}</span>
            </div>
          </div>
        </div>
      )}

      {kind === 'event' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="t-label mb-1.5 block">{t(L('Ден', 'Day'))}</label>
            <Select
              value={String(day)}
              width={200}
              options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({
                value: String(d),
                label:
                  lang === 'bg'
                    ? DAY_NAMES[d]
                    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d],
              }))}
              onChange={(v) => setDay(Number(v))}
            />
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(L('От', 'From'))}</label>
            <input type="time" className="field t-num" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="t-label mb-1.5 block">{t(L('До', 'To'))}</label>
            <input type="time" className="field t-num" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      )}

      {kind === 'item' && (
        <div>
          <label className="t-label mb-1.5 block">{t(L('Бележки', 'Notes'))}</label>
          <textarea
            className="field h-20 resize-none py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t(L('По желание', 'Optional'))}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="hidden items-center gap-1.5 text-[11.5px] text-faint sm:flex">
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">↵</kbd>
          {t(L('за запис', 'to save'))}
        </span>
        <div className="ml-auto flex gap-2">
          <Button onClick={onDone}>{t(S.cancel)}</Button>
          <Button variant="primary" icon="check" disabled={!canSave} onClick={() => void save()}>
            {t(S.create)}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** `YYYY-MM-DD` in local time — `toISOString` would shift the day in +03. */
/** The next full hour, in the shape `<input type="datetime-local">` reads. */
function nextHourInput(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return localInput(d);
}

/** Nine in the morning, `days` from now. */
function morningInput(days: number): string {
  const d = addDays(days);
  d.setHours(9, 0, 0, 0);
  return localInput(d);
}

const localInput = (d: Date): string =>
  `${isoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Small helper shared by the screens: a chip that shows an icon and a count. */
export function QuickHint({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <Icon name={icon} size={13} />
      {children}
    </span>
  );
}
