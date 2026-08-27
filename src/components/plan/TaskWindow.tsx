import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlannerItem, RepeatRule, TaskMethod } from '@/types';
import { usePlanner, addDays, startOfDay } from '@/state/plannerStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { useItemTypes, allTypes, typeName, typeOf } from '@/state/itemTypeStore';
import { useTimer } from '@/state/timerStore';
import { useApp } from '@/state/appStore';
import { useT, useLang, L, formatDate, formatDuration, relativeDays, type Msg } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Modal, Popover } from '../ui';
import { Sheet, useIsPhone } from '../kit';
import { notify } from '@/state/toastStore';
import { noteReminderSaved } from '@/services/reminderService';
import { openDoc } from '@/services/openDoc';
import { AutoTextarea, DURATIONS } from './TaskCard';
import { METHOD_ICON, METHOD_LABEL, defaultTarget } from './method';
import { actualMinutes, clockMinutes, dayKey, fromDayKey } from './planTime';

const REPEATS: { id: RepeatRule; label: Msg }[] = [
  { id: 'none', label: L('Веднъж', 'Once') },
  { id: 'daily', label: L('Всеки ден', 'Every day') },
  { id: 'weekdays', label: L('Делник', 'Weekdays') },
  { id: 'weekly', label: L('Седмично', 'Weekly') },
  { id: 'monthly', label: L('Месечно', 'Monthly') },
  { id: 'yearly', label: L('Годишно', 'Yearly') },
];

const PRIORITIES: { value: 0 | 1 | 2; label: Msg; color?: string }[] = [
  { value: 0, label: L('Никаква', 'None') },
  { value: 1, label: L('Важна', 'Important'), color: 'var(--c-warn)' },
  { value: 2, label: L('Спешна', 'Urgent'), color: 'var(--c-danger)' },
];

const METHODS: TaskMethod[] = ['check', 'checklist', 'count', 'timer'];

/**
 * The two right-hand time columns, so the task row and every subtask line up.
 *
 * `Отчетено` is hidden below `sm`: on a 375 px screen two 64 px columns take a
 * third of the row and the title starts breaking mid-word. The one that goes
 * is the one you cannot change here anyway.
 */
const CELL = 'w-[56px] shrink-0 text-right sm:w-[64px]';
const ACTUAL_CELL = `hidden sm:block ${CELL}`;

/**
 * ──────────────────────────────────────────────────── the entry, in a window ──
 *
 * One window, in the middle of the screen, opened from everywhere.
 *
 * Before this there were two: the plan showed a panel welded to the right edge
 * of the layout, and the calendar opened a different dialog — a form with
 * labelled fields and a Save button, three quarters as wide, with different
 * chrome. Two dialogs for the two halves of one job, and neither of them
 * looked like the window the entry had been created in.
 *
 * The shape is Sunsama's: a strip of metadata across the top, the title at
 * reading size with what it costs beside it, the subtasks lined up under the
 * same two columns, then the notes, then one quiet line of history. Nothing
 * here is a labelled field — every value is the control that changes it.
 *
 * It writes as you type. Title and notes are debounced rather than committed
 * on blur, because the backdrop closes this window on `pointerdown`, which
 * happens before blur — so a blur-committed field would lose its last edit to
 * a click on the dimmed area behind it.
 */
export function TaskWindow() {
  const t = useT();
  const phone = useIsPhone();
  const id = useApp((s) => s.openItemId);
  const item = usePlanner((s) => (id ? (s.items.find((i) => i.id === id) ?? null) : null));
  const close = useCallback(() => useApp.getState().closeItem(), []);

  /* A window pointing at a record that has since been deleted — from the card
     menu, from an undo that expired, from another device. Close rather than
     draw an empty shell. */
  useEffect(() => {
    if (id && !item) close();
  }, [id, item, close]);

  if (!id || !item) return null;

  const body = <WindowBody item={item} onClose={close} />;

  return phone ? (
    <Sheet open onClose={close} title={t(L('Запис', 'Entry'))} maxHeight={0.92}>
      {body}
    </Sheet>
  ) : (
    <Modal open onClose={close} title={item.title || t(L('Запис', 'Entry'))} width={680} bare>
      {body}
    </Modal>
  );
}

/* ------------------------------------------------------------------- body */

function WindowBody({ item, onClose }: { item: PlannerItem; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const phone = useIsPhone();
  const allSubjects = useWorkspace((s) => s.subjects);
  const subjects = useMemo(() => allSubjects.filter((x) => !x.archived), [allSubjects]);
  const custom = useItemTypes((s) => s.custom);
  const types = useMemo(() => allTypes(custom), [custom]);
  const documents = useLibrary((s) => s.documents);
  const sessions = useTimer((s) => s.sessions);

  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes);
  const [addingStep, setAddingStep] = useState(false);
  const [step, setStep] = useState('');

  /* Only when the window swaps to a different record. While one is open the
     local text is the truth — re-syncing on every store write would fight the
     debounce and swallow keystrokes. */
  useEffect(() => {
    setTitle(item.title);
    setNotes(item.notes);
  }, [item.id]);

  useAutosave(item.id, 'title', title.trim() || null);
  useAutosave(item.id, 'notes', notes);

  const patch = (p: Partial<PlannerItem>) => void usePlanner.getState().updateItem(item.id, p);
  const planned = item.duration ?? 0;
  const spent = actualMinutes(item.id, sessions);
  const steps = item.steps ?? [];
  const subject = subjects.find((s) => s.id === item.subjectId) ?? null;
  const type = typeOf(item.kind, custom);
  const method: TaskMethod = item.method ?? 'check';
  const doc = documents.find((d) => d.id === item.docId) ?? null;
  const priority = PRIORITIES.find((p) => p.value === item.priority) ?? PRIORITIES[0];
  const sessionCount = sessions.filter((s) => s.taskId === item.id).length;

  const startFocus = () => {
    useTimer.getState().setActiveTask(item.id);
    useApp.getState().go('focus');
    useTimer.getState().start();
    onClose();
  };

  const dueLabel = (): string => {
    if (item.due === null) return t(L('Бекло̀г', 'Backlog'));
    const day = startOfDay(new Date(item.due));
    if (day === startOfDay()) return t(L('Днес', 'Today'));
    if (day === startOfDay(addDays(1))) return t(L('Утре', 'Tomorrow'));
    if (day === startOfDay(addDays(-1))) return t(L('Вчера', 'Yesterday'));
    return formatDate(item.due, lang, { day: 'numeric', month: 'short' });
  };

  const addStep = () => {
    setAddingStep(true);
    setStep('');
  };

  return (
    <div className={phone ? '-mx-4' : '-m-5'}>
      {/* ------------------------------------------------------- metadata */}
      <header className="flex flex-wrap items-end gap-x-3.5 gap-y-2 border-b border-line px-5 py-3">
        <Field label={t(L('Канал', 'Channel'))}>
          <Pill
            icon="hash"
            set={!!subject}
            value={subject?.name ?? t(L('без канал', 'none'))}
            label={t(L('Канал', 'Channel'))}
            color={subject?.color}
            menu={(close) => (
              <div className="scroll-thin max-h-[280px] overflow-y-auto">
                <MenuItem
                  active={!item.subjectId}
                  label={t(L('Без канал', 'No channel'))}
                  onClick={() => {
                    patch({ subjectId: null });
                    close();
                  }}
                />
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-[13px] transition-colors hover:bg-surface-3"
                    onClick={() => {
                      patch({ subjectId: s.id });
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
          />
        </Field>

        <span className="flex-1" />

        <Pill
          icon="flag"
          set={item.priority > 0}
          value={t(priority.label)}
          label={t(L('Важност', 'Priority'))}
          color={priority.color}
          menu={(close) => (
            <>
              <MenuHead label={t(L('Важност', 'Priority'))} />
              {PRIORITIES.map((p) => (
                <MenuItem
                  key={p.value}
                  icon="flag"
                  active={item.priority === p.value}
                  label={t(p.label)}
                  onClick={() => {
                    patch({ priority: p.value });
                    close();
                  }}
                />
              ))}
            </>
          )}
        />

        <Field label={t(L('Ден', 'Day'))}>
          <Pill
            set={item.due !== null}
            value={dueLabel()}
            label={t(L('Кой ден', 'Which day'))}
            menu={(close) => (
              <>
                <MenuHead label={t(L('Кой ден', 'Which day'))} />
                <MenuItem
                  icon="bolt"
                  label={t(L('Днес', 'Today'))}
                  onClick={() => {
                    void usePlanner.getState().moveTo(item.id, startOfDay());
                    close();
                  }}
                />
                <MenuItem
                  icon="arrowRight"
                  label={t(L('Утре', 'Tomorrow'))}
                  onClick={() => {
                    void usePlanner.getState().moveTo(item.id, startOfDay(addDays(1)));
                    close();
                  }}
                />
                <MenuItem
                  icon="history"
                  label={t(L('След седмица', 'Next week'))}
                  onClick={() => {
                    void usePlanner.getState().moveTo(item.id, startOfDay(addDays(7)));
                    close();
                  }}
                />
                <MenuItem
                  icon="archive"
                  label={t(L('В бекло̀га', 'To the backlog'))}
                  onClick={() => {
                    void usePlanner.getState().moveTo(item.id, null);
                    close();
                  }}
                />
                <MenuSep />
                <div className="px-2 pb-1.5">
                  <input
                    type="date"
                    className="field h-8 w-full text-[12.5px]"
                    value={item.due ? dayKey(item.due) : ''}
                    onChange={(e) =>
                      void usePlanner
                        .getState()
                        .moveTo(item.id, e.target.value ? fromDayKey(e.target.value) : null)
                    }
                  />
                </div>
              </>
            )}
          />
        </Field>

        <Pill
          icon="clock"
          set={!!item.time}
          value={item.time ?? t(L('Час', 'Time'))}
          label={t(L('Час в деня', 'Hour of the day'))}
          menu={() => (
            <>
              <MenuHead label={t(L('Час в деня', 'Hour of the day'))} />
              <div className="flex items-center gap-2 px-2 pb-1.5">
                <input
                  type="time"
                  className="field h-8 flex-1 text-[12.5px]"
                  value={item.time ?? ''}
                  onChange={(e) => patch({ time: e.target.value || null })}
                />
                {item.time && (
                  <button
                    className="icon-btn h-7 w-7"
                    aria-label={t(L('Махни часа', 'Clear the hour'))}
                    onClick={() => patch({ time: null })}
                  >
                    <Icon name="x" size={13} />
                  </button>
                )}
              </div>
              <p className="px-2 pb-1 text-[11px] text-faint">
                {t(L('С час записът застава в календара.', 'With an hour it sits on the calendar.'))}
              </p>
            </>
          )}
        />

        <button
          onClick={addStep}
          className="flex h-[26px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="plus" size={12} />
          <span className="hidden sm:inline">{t(L('Подзадача', 'Subtask'))}</span>
        </button>

        <MoreMenu item={item} doc={doc} onClose={onClose} />

        {/* The sheet draws its own, in its own title bar. */}
        {!phone && (
          <button className="icon-btn h-7 w-7 shrink-0" aria-label={t(S.close)} onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        )}
      </header>

      {/* ---------------------------------------------------------- title */}
      <div className="px-5 pb-1 pt-7">
        {/* The two column names, said once, in sentence case. Small capitals
            were taken out of this product on purpose — on Cyrillic they have
            no ascenders to read by. */}
        <div className="mb-1.5 flex items-end justify-end gap-3">
          <span className={`t-label ${ACTUAL_CELL}`}>{t(L('Отчетено', 'Actual'))}</span>
          <span className={`t-label ${CELL}`}>{t(L('Планирано', 'Planned'))}</span>
        </div>

        <div className="flex items-start gap-3">
          <button
            onClick={() => void usePlanner.getState().toggleItem(item.id)}
            aria-pressed={item.done}
            aria-label={t(item.done ? L('Върни като незавършена', 'Mark as not done') : L('Отметни', 'Mark done'))}
            className="mt-1.5 grid h-[22px] w-[22px] shrink-0 cursor-pointer place-items-center rounded-full border transition-all active:scale-90"
            style={{
              borderColor: item.done ? 'var(--c-success)' : 'var(--c-line-strong)',
              background: item.done ? 'var(--c-success)' : 'transparent',
            }}
          >
            <Icon
              name="check"
              size={13}
              strokeWidth={3}
              style={{ color: item.done ? '#fff' : 'var(--c-line-strong)' }}
            />
          </button>

          <div className="min-w-0 flex-1">
            <AutoTextarea
              value={title}
              onChange={setTitle}
              onCommit={() => {}}
              autoFocus={false}
              className="text-[28px] font-semibold leading-tight tracking-[-0.025em]"
            />
          </div>

          {!item.done && (
            <button
              onClick={startFocus}
              className="icon-btn mt-0.5 h-7 w-7 shrink-0"
              aria-label={t(L('Пусни фокус сесия', 'Start a focus session'))}
              title={t(L('Пусни фокус сесия', 'Start a focus session'))}
            >
              <Icon name="play" size={13} />
            </button>
          )}

          <span className={`t-num mt-2 text-[13px] ${ACTUAL_CELL} ${spent > 0 ? '' : 'text-faint'}`}>
            {spent > 0 ? formatDuration(spent, lang) : '—:—'}
          </span>
          <span className={`mt-1.5 ${CELL}`}>
            <TimePill
              minutes={planned}
              label={t(L('Планирано време', 'Planned time'))}
              onPick={(m) => patch({ duration: m })}
            />
          </span>
        </div>

        {/* ------------------------------------------------------ subtasks */}
        <div className="mt-3 space-y-0.5 pl-[34px]">
          {steps.map((s) => (
            <div key={s.id} className="group/step flex items-center gap-3 rounded-[8px] py-1">
              <button
                onClick={() => void usePlanner.getState().toggleStep(item.id, s.id)}
                aria-pressed={s.done}
                aria-label={s.title}
                className="grid h-[17px] w-[17px] shrink-0 cursor-pointer place-items-center rounded-full border transition-all active:scale-90"
                style={{
                  borderColor: s.done ? 'var(--c-success)' : 'var(--c-line-strong)',
                  background: s.done ? 'var(--c-success)' : 'transparent',
                }}
              >
                {s.done && <Icon name="check" size={11} className="text-white" strokeWidth={3} />}
              </button>

              <StepTitle
                itemId={item.id}
                stepId={s.id}
                value={s.title}
                done={s.done}
              />

              {/* Deliberately blank, not zero. A focus session is tagged with
                  the entry, never with one of its steps, so how long a step
                  really took is not something this app knows. */}
              <span className={`t-num text-[12px] text-faint ${ACTUAL_CELL}`}>—:—</span>
              <span className={CELL}>
                <TimePill
                  small
                  minutes={s.duration ?? 0}
                  label={t(L('Планирано време', 'Planned time'))}
                  onPick={(m) => void usePlanner.getState().updateStep(item.id, s.id, { duration: m })}
                />
              </span>

              {/* Last, so a touch screen — where nothing is ever "hovered" and
                  this is therefore always visible — does not put a delete
                  button between a subtask and its own numbers. */}
              <button
                className="icon-btn -mr-1 h-6 w-6 shrink-0 hover-reveal"
                aria-label={t(S.delete)}
                onClick={() => void usePlanner.getState().removeStep(item.id, s.id)}
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          ))}

          {addingStep ? (
            <form
              className="flex items-center gap-3 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                const value = step.trim();
                if (value) void usePlanner.getState().addStep(item.id, value);
                setStep('');
                if (!value) setAddingStep(false);
              }}
            >
              <Icon name="plus" size={13} className="shrink-0 text-faint" />
              <input
                autoFocus
                value={step}
                onChange={(e) => setStep(e.target.value)}
                onBlur={() => {
                  const value = step.trim();
                  if (value) void usePlanner.getState().addStep(item.id, value);
                  setStep('');
                  setAddingStep(false);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={t(L('Какво още', 'What else'))}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </form>
          ) : (
            <button
              onClick={addStep}
              className="flex cursor-pointer items-center gap-3 py-1 text-[13px] text-faint transition-colors hover:text-muted"
            >
              <Icon name="plus" size={15} />
              {t(L('Добави подзадача', 'Add subtask'))}
            </button>
          )}
        </div>

        {/* --------------------------------------------------- the quiet row */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Pill
            small
            icon={type.icon}
            set={item.kind !== 'task'}
            value={typeName(type, lang)}
            label={t(L('Вид', 'Type'))}
            color={type.color ?? undefined}
            menu={(close) => (
              <>
                <MenuHead label={t(L('Вид', 'Type'))} />
                {types.map((x) => (
                  <MenuItem
                    key={x.id}
                    icon={x.icon}
                    active={item.kind === x.id}
                    label={typeName(x, lang)}
                    onClick={() => {
                      patch({ kind: x.id });
                      close();
                    }}
                  />
                ))}
              </>
            )}
          />

          <Pill
            small
            icon={METHOD_ICON[method]}
            set={method !== 'check'}
            value={t(METHOD_LABEL[method])}
            label={t(L('Как ще я направиш', 'How you will work it'))}
            menu={(close) => (
              <>
                <MenuHead label={t(L('Как ще я направиш', 'How you will work it'))} />
                {METHODS.map((m) => (
                  <MenuItem
                    key={m}
                    icon={METHOD_ICON[m]}
                    active={method === m}
                    label={t(METHOD_LABEL[m])}
                    onClick={() => {
                      patch({ method: m, target: defaultTarget(m, item.target ?? 0) });
                      close();
                    }}
                  />
                ))}
                <MenuSep />
                <p className="px-2 pb-1 text-[11px] leading-snug text-faint">
                  {t(
                    L(
                      'Отметка за дребните неща, списък за многостъпковите, брояч за повторенията.',
                      'A tick for small things, a list for multi-step ones, a counter for repetitions.',
                    ),
                  )}
                </p>
              </>
            )}
          />

          {(method === 'count' || method === 'timer') && (
            <Pill
              small
              icon="sigma"
              set
              value={`${item.target || 1}`}
              label={
                method === 'count'
                  ? t(L('Колко повторения', 'How many repetitions'))
                  : t(L('Колко фокус блока', 'How many focus blocks'))
              }
              menu={() => (
                <>
                  <MenuHead
                    label={
                      method === 'count'
                        ? t(L('Колко повторения', 'How many repetitions'))
                        : t(L('Колко фокус блока', 'How many focus blocks'))
                    }
                  />
                  <div className="px-2 pb-1.5">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      className="field t-num h-8 w-full text-[12.5px]"
                      value={item.target || 1}
                      onChange={(e) => patch({ target: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                </>
              )}
            />
          )}

          <Pill
            small
            icon="refresh"
            set={!!item.repeat && item.repeat !== 'none'}
            value={t(REPEATS.find((r) => r.id === (item.repeat ?? 'none'))!.label)}
            label={t(L('Повторение', 'Repeat'))}
            menu={(close) => (
              <>
                <MenuHead label={t(L('Повторение', 'Repeat'))} />
                {REPEATS.map((r) => (
                  <MenuItem
                    key={r.id}
                    active={(item.repeat ?? 'none') === r.id}
                    label={t(r.label)}
                    onClick={() => {
                      patch({ repeat: r.id });
                      close();
                    }}
                  />
                ))}
              </>
            )}
          />

          <Pill
            small
            icon="bell"
            set={typeof item.remindAt === 'number'}
            value={
              typeof item.remindAt === 'number'
                ? formatDate(item.remindAt, lang, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : t(L('Напомняне', 'Reminder'))
            }
            label={t(L('Напомняне', 'Reminder'))}
            menu={() => (
              <>
                <MenuHead label={t(L('Напомни ми', 'Remind me'))} />
                <div className="flex items-center gap-2 px-2 pb-1.5">
                  <input
                    type="datetime-local"
                    className="field h-8 flex-1 text-[12.5px]"
                    value={item.remindAt ? localInput(item.remindAt) : ''}
                    onChange={(e) => {
                      const at = e.target.value ? new Date(e.target.value).getTime() : null;
                      patch({ remindAt: at, remindedAt: null });
                      if (at) noteReminderSaved();
                    }}
                  />
                  {item.remindAt && (
                    <button
                      className="icon-btn h-7 w-7"
                      aria-label={t(L('Махни напомнянето', 'Clear the reminder'))}
                      onClick={() => patch({ remindAt: null, remindedAt: null })}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
              </>
            )}
          />

          {documents.length > 0 && (
            <Pill
              small
              icon="book"
              set={!!doc}
              value={doc?.name ?? t(L('Материал', 'Material'))}
              label={t(L('Материал', 'Material'))}
              menu={(close) => (
                <div className="scroll-thin max-h-[280px] overflow-y-auto">
                  <MenuItem
                    active={!item.docId}
                    label={t(L('Няма', 'None'))}
                    onClick={() => {
                      patch({ docId: null });
                      close();
                    }}
                  />
                  {documents.slice(0, 60).map((d) => (
                    <MenuItem
                      key={d.id}
                      active={item.docId === d.id}
                      label={d.name}
                      onClick={() => {
                        patch({ docId: d.id });
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            />
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- notes */}
      <div className="mt-6 border-t border-line px-5 py-5">
        <GrowTextarea
          value={notes}
          onChange={setNotes}
          placeholder={t(L('Бележки…', 'Notes…'))}
        />
      </div>

      {/* -------------------------------------------------------- history */}
      <footer className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[11.5px] text-faint">
        <span className="badge-dot" style={{ background: 'var(--c-line-strong)' }} aria-hidden />
        <span className="truncate">
          {t(L('Създадена', 'Created'))} {relativeDays(dayDelta(item.createdAt), lang)}
          {item.completedAt
            ? ` · ${t(L('завършена', 'completed'))} ${relativeDays(dayDelta(item.completedAt), lang)}`
            : ''}
          {sessionCount > 0
            ? ` · ${t(L(`${sessionCount} фокус сесии`, `${sessionCount} focus sessions`))}`
            : ''}
        </span>
      </footer>
    </div>
  );
}

/* ----------------------------------------------------------------- pieces */

/** A tiny name above a control, for the two the screenshot calls out. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="t-label">{label}</span>
      {children}
    </span>
  );
}

/**
 * One piece of metadata, showing its value where it has one and its name where
 * it does not — so an entry with nothing set reads as a row of prompts, and a
 * filled-in one reads as a row of facts.
 */
function Pill({
  icon,
  value,
  label,
  set,
  color,
  small,
  menu,
}: {
  icon?: string;
  value: string;
  label: string;
  set: boolean;
  color?: string;
  small?: boolean;
  menu: (close: () => void) => ReactNode;
}) {
  const tint = color ?? 'var(--c-text)';
  return (
    <Popover
      width={236}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          onClick={toggle}
          aria-label={label}
          title={label}
          className={`flex max-w-[180px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-medium transition-colors hover:bg-surface-2 ${
            small ? 'h-[24px] text-[11.5px]' : 'h-[26px] text-[12px]'
          } ${open ? 'btn-ghost-active' : ''}`}
          style={{
            borderColor: set ? 'transparent' : 'var(--c-line)',
            background: set ? `color-mix(in srgb, ${tint} 10%, transparent)` : 'var(--c-surface)',
            color: set ? tint : 'var(--c-muted)',
          }}
        >
          {/* `hash` is not in the icon set and never was — `Icon` silently
              draws an ⓘ for an unknown name, so the channel gets a real `#`. */}
          {icon === 'hash' ? (
            <span className="opacity-70">#</span>
          ) : icon ? (
            <Icon name={icon} size={small ? 11 : 12} />
          ) : null}
          <span className="truncate">{value}</span>
        </button>
      )}
    >
      {(close) => menu(close)}
    </Popover>
  );
}

/** The planned-time cell: `0:30` when set, an em-dash pair when not. */
function TimePill({
  minutes,
  label,
  onPick,
  small,
}: {
  minutes: number;
  label: string;
  onPick: (m: number) => void;
  small?: boolean;
}) {
  const t = useT();
  return (
    <Popover
      width={168}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          onClick={toggle}
          aria-label={label}
          title={label}
          className={`t-num w-full cursor-pointer rounded-[6px] py-0.5 text-right font-medium transition-colors hover:bg-surface-2 ${
            small ? 'text-[12px]' : 'text-[13px]'
          } ${minutes > 0 ? '' : 'text-faint'}`}
        >
          {minutes > 0 ? clockMinutes(minutes) : '—:—'}
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuHead label={label} />
          {DURATIONS.map((m) => (
            <MenuItem
              key={m}
              active={minutes === m}
              label={clockMinutes(m)}
              onClick={() => {
                onPick(m);
                close();
              }}
            />
          ))}
          {minutes > 0 && (
            <>
              <MenuSep />
              <MenuItem
                icon="x"
                label={t(L('Без оценка', 'No estimate'))}
                onClick={() => {
                  onPick(0);
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

/** A subtask title that takes a cursor where it stands. */
function StepTitle({
  itemId,
  stepId,
  value,
  done,
}: {
  itemId: string;
  stepId: string;
  value: string;
  done: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const clean = draft.trim();
        if (clean && clean !== value) void usePlanner.getState().updateStep(itemId, stepId, { title: clean });
        else if (!clean) setDraft(value);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`min-w-0 flex-1 cursor-text bg-transparent text-[13px] outline-none ${
        done ? 'text-faint line-through' : ''
      }`}
    />
  );
}

function MoreMenu({
  item,
  doc,
  onClose,
}: {
  item: PlannerItem;
  doc: { id: string } | null;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Popover
      width={224}
      align="end"
      trigger={({ toggle, ref }) => (
        <button ref={ref} onClick={toggle} className="icon-btn h-7 w-7 shrink-0" aria-label={t(L('Още', 'More'))}>
          <Icon name="dots" size={14} />
        </button>
      )}
    >
      {(close) => (
        <>
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
          {doc && (
            <MenuItem
              icon="book"
              label={t(L('Отвори материала', 'Open material'))}
              onClick={() => {
                void openDoc(doc.id);
                close();
              }}
            />
          )}
          <MenuSep />
          <MenuItem
            icon="trash"
            danger
            label={t(S.delete)}
            onClick={() => {
              const snapshot = item;
              onClose();
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

function MenuHead({ label }: { label: string }) {
  return (
    <div className="px-2 pb-1 pt-1.5">
      <span className="t-label">{label}</span>
    </div>
  );
}

/** A notes field with no box around it: writing, not a form control. */
function GrowTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.max(132, el.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={4}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      className="w-full resize-none overflow-hidden bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-faint"
    />
  );
}

/* ------------------------------------------------------------------ saving */

/**
 * Write-through with a short delay, and never on blur.
 *
 * The backdrop closes this window on `pointerdown`, which fires *before* the
 * focused field blurs — so a field that committed on blur would lose whatever
 * was typed last to a click on the dimmed area. The comparison is against the
 * store rather than a remembered value, so switching to another entry cannot
 * carry the previous one's text with it, and an unchanged field never writes
 * at all.
 *
 * `null` means "not worth saving" — an emptied title is a slip, not an
 * instruction to blank the card.
 */
function useAutosave(itemId: string, key: 'title' | 'notes', value: string | null) {
  const latest = useRef(value);
  latest.current = value;

  const flush = useCallback(() => {
    const v = latest.current;
    if (v === null) return;
    const stored = usePlanner.getState().items.find((i) => i.id === itemId);
    if (!stored || stored[key] === v) return;
    void usePlanner.getState().updateItem(itemId, { [key]: v });
  }, [itemId, key]);

  useEffect(() => {
    const timer = setTimeout(flush, 400);
    return () => clearTimeout(timer);
  }, [value, flush]);

  // And once more on the way out, for anything the timer had not reached.
  useEffect(() => flush, [flush]);
}

/* ----------------------------------------------------------------- helpers */

/** Whole days between a stamp and today; negative for the past. */
const dayDelta = (ts: number): number =>
  Math.round((startOfDay(new Date(ts)) - startOfDay()) / 86_400_000);

/** `Date` → what `<input type="datetime-local">` wants. */
const localInput = (ts: number): string => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
