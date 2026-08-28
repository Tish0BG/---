import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlannerItem, TimerMode } from '@/types';
import { useApp } from '@/state/appStore';
import { useSettings } from '@/state/settingsStore';
import { useWorkspace } from '@/state/workspaceStore';
import { useLibrary } from '@/state/libraryStore';
import { useItemTypes, typeName, typeOf } from '@/state/itemTypeStore';
import { usePlanner, openItems, sortByDue } from '@/state/plannerStore';
import {
  MODE_LABEL,
  dayKey,
  formatClock,
  lastDays,
  statsForDay,
  streak,
  useTimer,
} from '@/state/timerStore';
import { useT, useLang, L, formatDuration } from '@/i18n';
import { S } from '@/i18n/strings';
import { Screen } from '../shell/Screen';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Modal, Popover, Toggle } from '../ui';
import {
  BarChart,
  Button,
  Card,
  EmptyState,
  IconButton,
  ProgressCells,
  ProgressRing,
  Segmented,
  Tooltip,
  useMedia,
  useStill,
} from '../kit';
import { DueChip } from '../planner/DueChip';
import { MODES, MODE_COLOR, MODE_INK } from '../timer/modes';
import { RecapStats, RecapTasks } from '../timer/Recap';

/**
 * ───────────────────────────────────────────────────── the focus screen ──
 *
 * The clock is the screen.
 *
 * It used to be one card in a row of five. The other four — what you are
 * working on, the three lengths, today's chart, four behaviour switches —
 * were all on at once, all the time, so the thing you came here to look at
 * had to share the window with two dozen controls you touch about once a
 * month. And starting a block on a particular entry, from the screen the
 * timer actually lives on, took three clicks and a search box; everywhere
 * else in the app the same thing is one click.
 *
 * So: one stage. The ring, the time, what is next, and — right under it —
 * today's open work as buttons, because "what am I about to do" is the only
 * question worth asking before the clock starts. Lengths sit behind the pair
 * they are currently set to, which is also the fastest way to change them.
 * Everything else is behind one gear.
 */
export function FocusScreen() {
  const t = useT();
  const lang = useLang();
  const mode = useTimer((s) => s.mode);
  const running = useTimer((s) => s.running);
  const left = useTimer((s) => s.left);
  const cycle = useTimer((s) => s.cycle);
  const sessions = useTimer((s) => s.sessions);
  const lastSession = useTimer((s) => s.lastSession);
  const picked = useTimer((s) => s.activeTaskIds);
  const items = usePlanner((s) => s.items);
  const timer = useSettings((s) => s.timer);
  const store = useTimer.getState;
  const still = useStill();
  const tight = useMedia('(max-width: 560px)');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = useMemo(() => statsForDay(sessions, dayKey()), [sessions]);
  const run = useMemo(() => streak(sessions), [sessions]);
  const week = useMemo(() => lastDays(sessions, 7), [sessions]);
  const open = useMemo(() => sortByDue(openItems(items)), [items]);

  const total = timer[mode] * 60;
  const progress = total ? 1 - left / total : 0;
  const accent = MODE_COLOR[mode];
  const ink = MODE_INK[mode];
  const spent = Math.max(0, Math.round((total - left) / 60));
  const goalPct = Math.min(1, today.minutes / Math.max(1, timer.goal));
  const goalLeft = Math.max(0, timer.goal - today.minutes);

  /** What `roll()` will pick when this block runs out — said before it does. */
  const next: TimerMode = mode === 'work' ? (cycle + 1 >= timer.cycles ? 'long' : 'break') : 'work';

  /**
   * The ring draws itself once, at the moment the block starts.
   *
   * One gesture, not a loop: the clock answering the press. Keyed on a
   * counter so pressing start again replays it, and skipped entirely when
   * the person has asked for less movement.
   */
  const [sweep, setSweep] = useState(0);
  const wasRunning = useRef(running);
  useEffect(() => {
    if (running && !wasRunning.current && !still) setSweep((n) => n + 1);
    wasRunning.current = running;
  }, [running, still]);

  const ring = tight ? 236 : 296;
  const stroke = 7;
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <Screen
      title={t(S.focus)}
      subtitle={t(
        L(
          `${formatDuration(today.minutes, lang)} днес · ${today.sessions} сесии · ${run} дни поред`,
          `${formatDuration(today.minutes, lang)} today · ${today.sessions} sessions · ${run} day streak`,
        ),
      )}
      actions={
        <>
          <IconButton
            icon="sliders"
            label={t(L('Настройки на таймера', 'Timer settings'))}
            onClick={() => setSettingsOpen(true)}
          />
          <Button icon="chartLine" onClick={() => useApp.getState().go('stats')}>
            {t(S.stats)}
          </Button>
          <Button icon="expand" onClick={() => store().setView('full')}>
            {t(L('Цял екран', 'Full screen'))}
          </Button>
        </>
      }
    >
      {lastSession && <JustFinished minutes={lastSession.minutes} taskIds={lastSession.taskIds} />}

      {/* ------------------------------------------------------- the stage */}
      <div
        className="relative grid place-items-center overflow-hidden rounded-[18px] border border-line"
        style={{ background: 'var(--c-surface)', minHeight: 'min(74vh, 640px)' }}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
            running && !still ? 'animate-breathe' : ''
          }`}
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${accent} ${running ? 15 : 6}%, transparent) 0%, transparent 68%)`,
            transition: 'background 0.8s var(--ease)',
          }}
        />

        <div className="relative flex w-full max-w-[440px] flex-col items-center px-5 py-8">
          <Segmented
            className="w-full max-w-[330px]"
            ariaLabel={t(S.focus)}
            value={mode}
            onChange={(m) => store().setMode(m)}
            items={MODES.map((m) => ({ id: m, label: t(MODE_LABEL[m]) }))}
          />

          {/* -------------------------------------------------- the clock */}
          <div className="relative mt-8" style={{ width: ring, height: ring }}>
            <ProgressRing
              value={progress}
              size={ring}
              stroke={stroke}
              color={accent}
              colorTo="var(--c-brand-lift)"
            >
              <div className="text-center">
                <div
                  className="t-num font-light leading-none tracking-[-0.045em]"
                  style={{ fontSize: tight ? 52 : 66 }}
                >
                  {formatClock(left)}
                </div>
                <div className="mt-3 text-[12.5px] text-muted">
                  {running
                    ? t(L(`${spent} мин досега`, `${spent} min so far`))
                    : t(L('На пауза', 'Paused'))}
                </div>
              </div>
            </ProgressRing>

            {sweep > 0 && (
              <svg
                key={sweep}
                className="timer-sweep"
                width={ring}
                height={ring}
                style={{ color: accent }}
                aria-hidden
              >
                <circle
                  cx={ring / 2}
                  cy={ring / 2}
                  r={radius}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  style={{ '--sweep-from': `${circumference}px` } as React.CSSProperties}
                />
              </svg>
            )}
          </div>

          {/* Which block of the round this is. */}
          <div className="mt-6 flex w-[168px] flex-col items-center gap-1.5">
            <ProgressCells value={(cycle + (running ? 0.5 : 0)) / timer.cycles} cells={timer.cycles} color={accent} className="w-full" />
            <span className="t-num text-[11px] text-faint">
              {t(L(`блок ${cycle + 1} от ${timer.cycles}`, `block ${cycle + 1} of ${timer.cycles}`))}
            </span>
          </div>

          {/* ----------------------------------------------- start / stop */}
          <div className="mt-7 flex items-center gap-5">
            <IconButton
              icon="refresh"
              size="lg"
              label={t(L('Нулирай', 'Reset'))}
              onClick={() => store().reset()}
            />
            <button
              onClick={() => store().toggleRun()}
              className="grid h-[84px] w-[84px] cursor-pointer place-items-center rounded-full transition-transform active:scale-95"
              style={{ background: accent, color: ink, boxShadow: `0 14px 34px -14px ${accent}` }}
              aria-label={t(running ? S.pause : S.start)}
            >
              <Icon name={running ? 'pause' : 'play'} size={32} fill={!running} />
            </button>
            <Tooltip
              label={t(
                L(
                  'Следващ режим. Прескочените минути не влизат в статистиката.',
                  'Next mode. Skipped minutes are never counted.',
                ),
              )}
            >
              <IconButton icon="skip" size="lg" label={t(S.skip)} onClick={() => store().skip()} />
            </Tooltip>
          </div>

          <p className="mt-4 text-[12px] text-faint">
            {t(
              L(
                `Следва ${MODE_LABEL[next].bg.toLowerCase()} · ${timer[next]} мин`,
                `Next up: ${MODE_LABEL[next].en.toLowerCase()} · ${timer[next]} min`,
              ),
            )}
          </p>

          {mode === 'work' && spent >= 1 && (
            <button
              className="mt-3 cursor-pointer text-[12.5px] font-medium text-accent underline-offset-2 hover:underline"
              onClick={() => void store().stop()}
            >
              {t(L(`Приключи и запиши ${spent} мин`, `Finish and log ${spent} min`))}
            </button>
          )}

          {/* --------------------------------------------- what it is for */}
          <div className="mt-7 w-full border-t border-line pt-5">
            <WorkingOn open={open} picked={picked} onMore={() => setPickerOpen(true)} />
          </div>

          {/* ------------------------------------------------ the day, thin */}
          <div className="mt-6 w-full max-w-[330px]">
            <ProgressCells value={goalPct} cells={12} color="var(--c-accent)" />
            <div className="mt-2 flex items-baseline justify-between text-[11.5px] text-faint">
              <span className="t-num">
                {formatDuration(today.minutes, lang)} / {timer.goal} {t(L('мин', 'min'))}
              </span>
              <span>
                {goalLeft
                  ? t(L(`още ${formatDuration(goalLeft, lang)}`, `${formatDuration(goalLeft, lang)} to go`))
                  : t(L('целта е изпълнена', 'goal met'))}
              </span>
            </div>
          </div>

          <LengthMenu onAll={() => setSettingsOpen(true)} />
        </div>
      </div>

      {/* ------------------------------------------------------- the week */}
      <Card
        className="mt-4"
        title={t(L('Последните 7 дни', 'The last 7 days'))}
        icon="gauge"
        action={
          <span className="t-num text-[12px] text-muted">
            {formatDuration(today.minutes, lang)} / {timer.goal}
          </span>
        }
      >
        <BarChart
          data={week.map((d, i) => ({ label: d.label, value: d.minutes, current: i === week.length - 1 }))}
          goal={timer.goal}
          format={(v) => formatDuration(v, lang)}
          height={72}
        />
      </Card>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={t(L('Настройки на таймера', 'Timer settings'))}
        width={420}
      >
        <Durations />
        <div className="mt-4 border-t border-line pt-3">
          <Behaviour />
        </div>
      </Modal>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t(L('Върху какво работиш', 'What you are working on'))}
        width={440}
      >
        <TaskPicker compact />
      </Modal>
    </Screen>
  );
}

/* ------------------------------------------------------------ working on */

/**
 * Today's open work, as buttons.
 *
 * The old card was a search box over a list of sixty rows with a checkbox on
 * each — a filing cabinet, when the question is only ever "this one". Three
 * entries, in the order the plan already sorts them, and one click starts the
 * block on one of them. The cabinet is still there behind "друго", for the
 * hour that really is three exercises off the same sheet.
 */
function WorkingOn({
  open,
  picked,
  onMore,
}: {
  open: PlannerItem[];
  picked: string[];
  onMore: () => void;
}) {
  const t = useT();
  const custom = useItemTypes((s) => s.custom);
  const chosen = picked.map((id) => open.find((i) => i.id === id)).filter((x) => !!x);
  const suggestions = open.filter((i) => !picked.includes(i.id)).slice(0, chosen.length ? 1 : 3);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <span className="mr-0.5 text-[11.5px] text-faint">
        {chosen.length ? t(L('Работиш по', 'Working on')) : t(L('Върху какво?', 'On what?'))}
      </span>

      {chosen.map((item) => (
        <span
          key={item.id}
          className="flex max-w-[240px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px]"
          style={{
            borderColor: 'color-mix(in srgb, var(--c-accent) 35%, transparent)',
            background: 'var(--c-accent-soft)',
            color: 'var(--c-accent)',
          }}
        >
          <Icon name={typeOf(item.kind, custom).icon} size={12} className="shrink-0" />
          <span className="truncate">{item.title}</span>
          <button
            className="shrink-0 cursor-pointer opacity-60 hover:opacity-100"
            aria-label={t(L('Махни', 'Remove'))}
            onClick={() => useTimer.getState().toggleTask(item.id)}
          >
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}

      {suggestions.map((item) => (
        <button
          key={item.id}
          onClick={() => useTimer.getState().toggleTask(item.id)}
          className="flex max-w-[240px] cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12.5px] text-muted transition-colors hover:border-strong hover:text-base"
        >
          <Icon name={typeOf(item.kind, custom).icon} size={12} className="shrink-0 opacity-70" />
          <span className="truncate">{item.title}</span>
        </button>
      ))}

      <button
        onClick={onMore}
        className="cursor-pointer rounded-full border border-dashed border-line px-2.5 py-1 text-[12.5px] text-faint transition-colors hover:text-base"
      >
        {open.length ? t(L('Друго…', 'Something else…')) : t(L('Добави задача…', 'Add a task…'))}
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- lengths */

/**
 * The pair you are on, which is also the fastest way off it.
 *
 * 25 → 50 used to be five presses of a stepper inside a card that was open
 * all the time. It is a button showing "25/5" and one press of "50/10" now,
 * and the steppers are behind the same door as everything else.
 */
function LengthMenu({ onAll }: { onAll: () => void }) {
  const t = useT();
  const timer = useSettings((s) => s.timer);
  const setTimer = useSettings((s) => s.setTimer);

  return (
    <Popover
      width={214}
      align="center"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          onClick={toggle}
          className="mt-6 flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-3"
        >
          <Icon name="timer" size={13} />
          <span className="t-num">
            {timer.work}/{timer.break}
          </span>
          <Icon name="chevronDown" size={12} className="opacity-60" />
        </button>
      )}
    >
      {(close) => (
        <>
          {PRESETS.map(([work, brk, long, cycles]) => {
            const on = timer.work === work && timer.break === brk;
            return (
              <MenuItem
                key={work}
                icon={on ? 'check' : 'timer'}
                label={t(L(`${work} / ${brk} мин`, `${work} / ${brk} min`))}
                onClick={() => {
                  setTimer({ work, break: brk, long, cycles });
                  useTimer.getState().syncDuration();
                  close();
                }}
              />
            );
          })}
          <MenuSep />
          <MenuItem
            icon="sliders"
            label={t(L('Всички настройки…', 'All settings…'))}
            onClick={() => {
              close();
              onAll();
            }}
          />
        </>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------- durations */

const PRESETS: [number, number, number, number][] = [
  [25, 5, 15, 4],
  [50, 10, 30, 2],
  [90, 20, 30, 2],
  [15, 3, 10, 4],
];

/**
 * The three lengths, where the clock is.
 *
 * They used to live in the settings dialog, which is a strange place for a
 * number you change because today feels like a fifty-minute day.
 */
function Durations() {
  const t = useT();
  const timer = useSettings((s) => s.timer);
  const setTimer = useSettings((s) => s.setTimer);
  const store = useTimer.getState;

  const rows: { mode: TimerMode; step: number }[] = [
    { mode: 'work', step: 5 },
    { mode: 'break', step: 1 },
    { mode: 'long', step: 5 },
  ];

  return (
    <div className="space-y-2.5">
      {rows.map(({ mode, step }) => (
        <div key={mode} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[13px]">
            <span className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[mode] }} />
            {t(MODE_LABEL[mode])}
          </span>
          <Stepper
            value={t(L(`${timer[mode]} мин`, `${timer[mode]} min`))}
            onDown={() => store().setDuration(mode, timer[mode] - step)}
            onUp={() => store().setDuration(mode, timer[mode] + step)}
          />
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px]">{t(L('Дълга почивка след', 'Long break after'))}</span>
        <Stepper
          value={t(L(`${timer.cycles} сесии`, `${timer.cycles} sessions`))}
          onDown={() => setTimer({ cycles: Math.max(2, timer.cycles - 1) })}
          onUp={() => setTimer({ cycles: Math.min(8, timer.cycles + 1) })}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
        <span className="text-[13px]">{t(L('Дневна цел', 'Daily goal'))}</span>
        <Stepper
          value={t(L(`${timer.goal} мин`, `${timer.goal} min`))}
          onDown={() => setTimer({ goal: Math.max(15, timer.goal - 15) })}
          onUp={() => setTimer({ goal: Math.min(720, timer.goal + 15) })}
        />
      </div>

      <div className="grid grid-cols-4 gap-1.5 pt-1">
        {PRESETS.map(([work, brk, long, cycles]) => {
          const on = timer.work === work && timer.break === brk && timer.long === long;
          return (
            <button
              key={work}
              className={`btn px-1 text-[12px] ${on ? 'btn-ghost-active' : ''}`}
              onClick={() => {
                setTimer({ work, break: brk, long, cycles });
                store().syncDuration();
              }}
            >
              {work}/{brk}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({ value, onDown, onUp }: { value: string; onDown: () => void; onUp: () => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="t-num min-w-[64px] text-right text-[12.5px] text-muted">{value}</span>
      <span className="flex overflow-hidden rounded-[8px]" style={{ background: 'var(--c-surface-3)' }}>
        <button
          className="h-7 w-8 cursor-pointer text-[15px] transition-colors hover:bg-line"
          onClick={onDown}
          aria-label="−"
        >
          −
        </button>
        <span className="w-px" style={{ background: 'var(--c-line)' }} />
        <button
          className="h-7 w-8 cursor-pointer text-[15px] transition-colors hover:bg-line"
          onClick={onUp}
          aria-label="+"
        >
          +
        </button>
      </span>
    </span>
  );
}

/* ----------------------------------------------------------- task picker */

/**
 * Which entries the block is being spent on.
 *
 * Multiple selection is the point: an hour is very often three exercises off
 * one sheet, and being made to pick a single one of them meant either
 * stopping the clock between them or logging the hour against whichever
 * happened to be first.
 *
 * What "counts towards each" means, precisely: every selected entry gets a
 * block on its tally, and the minutes are written once, against the first —
 * an hour counted three times would be three times the hour that was sat
 * through. The copy below says so rather than implying otherwise.
 */
export function TaskPicker({ compact }: { compact?: boolean }) {
  const t = useT();
  const items = usePlanner((s) => s.items);
  const selected = useTimer((s) => s.activeTaskIds);
  const subjects = useWorkspace((s) => s.subjects);
  const custom = useItemTypes((s) => s.custom);
  const documents = useLibrary((s) => s.documents);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');

  const open = useMemo(() => sortByDue(openItems(items)), [items]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? open.filter((i) => i.title.toLowerCase().includes(q)) : open;
    // Whatever is already ticked stays visible even when the search would
    // have hidden it — otherwise unticking becomes a hunt.
    const picked = open.filter((i) => selected.includes(i.id) && !matched.includes(i));
    return [...picked, ...matched].slice(0, compact ? 30 : 60);
  }, [open, query, selected, compact]);

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    const item = await usePlanner.getState().addItem({ title });
    useTimer.getState().toggleTask(item.id);
  };

  return (
    <div className="flex min-h-0 flex-col">
      <p className="px-3 pb-2 text-[11.5px] leading-relaxed text-muted">
        {t(
          L(
            'Може да избереш няколко — всяка получава блок в бройката си. Минутите се записват веднъж, на първата.',
            'Pick several — each one gets a block on its tally. The minutes are logged once, against the first.',
          ),
        )}
      </p>

      <div className="flex items-center gap-1.5 border-y border-line px-3 py-2">
        <Icon name="plus" size={15} className="shrink-0 text-faint" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') void add();
          }}
          placeholder={t(L('Добави и започни работа по…', 'Add and start working on…'))}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          maxLength={160}
        />
      </div>

      {open.length > 6 && (
        <div className="flex items-center gap-1.5 border-b border-line px-3 py-1.5">
          <Icon name="search" size={14} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={t(L('Търси в задачите', 'Search your work'))}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
          />
          {query && (
            <button className="icon-btn h-6 w-6" onClick={() => setQuery('')} aria-label={t(S.close)}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      )}

      <div
        className="scroll-thin min-h-0 overflow-y-auto px-1.5 py-1.5"
        style={{ maxHeight: compact ? 260 : 340 }}
      >
        {list.length === 0 ? (
          <EmptyState
            compact
            icon="coffee"
            title={t(L('Няма отворени задачи', 'Nothing open'))}
            body={t(L('Пиши горе, за да добавиш нещо и веднага да го хванеш.', 'Type above to add something and pick it up straight away.'))}
          />
        ) : (
          list.map((item) => (
            <PickRow
              key={item.id}
              item={item}
              on={selected.includes(item.id)}
              subject={subjects.find((s) => s.id === item.subjectId) ?? null}
              type={typeOf(item.kind, custom)}
              docName={documents.find((d) => d.id === item.docId)?.name}
            />
          ))
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
          <span className="text-[11.5px] text-muted">
            {t(
              L(
                `${selected.length} избрани за тази сесия`,
                `${selected.length} selected for this session`,
              ),
            )}
          </span>
          <button
            className="cursor-pointer text-[11.5px] text-accent"
            onClick={() => useTimer.getState().clearTasks()}
          >
            {t(L('Изчисти', 'Clear'))}
          </button>
        </div>
      )}
    </div>
  );
}

function PickRow({
  item,
  on,
  subject,
  type,
  docName,
}: {
  item: PlannerItem;
  on: boolean;
  subject: { name: string; color: string } | null;
  type: { icon: string; color: string | null; name: string; nameEn?: string };
  docName?: string;
}) {
  const lang = useLang();
  const tint = type.color ?? subject?.color ?? 'var(--c-muted)';
  return (
    <button
      onClick={() => useTimer.getState().toggleTask(item.id)}
      aria-pressed={on}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors"
      style={on ? { background: 'var(--c-accent-soft)' } : undefined}
    >
      <span
        className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border transition-all"
        style={{
          borderColor: on ? 'var(--c-accent)' : 'var(--c-line-strong)',
          background: on ? 'var(--c-accent)' : 'transparent',
          color: 'var(--c-accent-text)',
        }}
      >
        {on && <Icon name="check" size={12} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <Icon name={type.icon} size={12} style={{ color: tint }} className="shrink-0" />
          <span className="truncate text-[13px]" style={on ? { fontWeight: 500 } : undefined}>
            {item.title}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-faint">
          {subject && <span style={{ color: subject.color }}>{subject.name}</span>}
          {docName && <span className="truncate">{docName}</span>}
          {item.due !== null && <DueChip due={item.due} bare />}
          {item.pomodoros > 0 && (
            <span className="t-num">
              {item.pomodoros} {lang === 'bg' ? 'блока' : 'blocks'}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------- behaviour */

function Behaviour() {
  const t = useT();
  const timer = useSettings((s) => s.timer);
  const setTimer = useSettings((s) => s.setTimer);

  return (
    <div>
      <Toggle
        checked={timer.autoStart}
        onChange={(v) => setTimer({ autoStart: v })}
        label={t(L('Автоматичен старт', 'Start the next block automatically'))}
        hint={t(L('Следващият режим тръгва сам.', 'The next mode starts on its own.'))}
      />
      <Toggle
        checked={timer.sound}
        onChange={(v) => setTimer({ sound: v })}
        label={t(L('Звук при смяна', 'Sound on change'))}
      />
      <Toggle
        checked={timer.notify}
        onChange={(v) => {
          setTimer({ notify: v });
          if (v && 'Notification' in window && Notification.permission === 'default') {
            void Notification.requestPermission();
          }
        }}
        label={t(L('Известия', 'Notifications'))}
        hint={t(L('Показват се и когато прозорецът е скрит.', 'Shown even when the window is hidden.'))}
      />
      <Toggle
        checked={timer.fullscreenOnStart}
        onChange={(v) => setTimer({ fullscreenOnStart: v })}
        label={t(L('Цял екран при старт', 'Full screen when starting'))}
        hint={t(
          L(
            'Изключено: цял екран става само от бутона.',
            'Off: full screen happens only when you press the button.',
          ),
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------ finished a block */

/**
 * What a finished block leaves behind, on the screen you were sitting on.
 *
 * It used to say less here than in full screen — the minutes and nothing
 * else, while full screen gave XP, the day, the streak and a break waiting
 * to be taken. Same event, so: the same answer. The entries it was spent on
 * come with it, because the end of a block is the one moment a person knows
 * whether the thing is actually done.
 */
function JustFinished({ minutes, taskIds }: { minutes: number; taskIds: string[] }) {
  const t = useT();
  const lang = useLang();
  const items = usePlanner((s) => s.items);
  const breakMinutes = useSettings((s) => s.timer.break);
  const store = useTimer.getState;
  const worked = taskIds.map((id) => items.find((i) => i.id === id)).filter((x) => !!x);

  useEffect(() => {
    // It goes on its own only when there is nothing left to answer. A banner
    // asking a question should not disappear while it is being read.
    if (worked.some((x) => !x.done)) return;
    const id = setTimeout(() => useTimer.getState().clearLast(), 12_000);
    return () => clearTimeout(id);
  }, [minutes, worked]);

  return (
    <div
      className="animate-rise mb-4 rounded-[16px] border px-4 py-4"
      style={{
        borderColor: 'color-mix(in srgb, var(--c-success) 30%, transparent)',
        background: 'color-mix(in srgb, var(--c-success) 7%, transparent)',
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="animate-pop grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
          style={{ background: 'var(--c-success)' }}
        >
          <Icon name="check" size={18} strokeWidth={2.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">
            {t(L(`${formatDuration(minutes, lang)} записани`, `${formatDuration(minutes, lang)} logged`))}
          </span>
          <span className="block text-[12px] text-muted">
            {worked.length
              ? t(L('Готово ли е нещо от тях?', 'Is any of it finished?'))
              : t(L('Влиза в статистиката и в целите ти.', 'It counts towards your statistics and goals.'))}
          </span>
        </span>
        <Button
          icon="coffee"
          onClick={() => {
            store().clearLast();
            store().setMode('break', true);
          }}
        >
          {t(L(`Почивка ${breakMinutes} мин`, `Break ${breakMinutes} min`))}
        </Button>
        <IconButton icon="x" label={t(S.close)} onClick={() => store().clearLast()} />
      </div>

      <div className="mt-3.5">
        <RecapStats minutes={minutes} compact />
      </div>

      {worked.length > 0 && (
        <div className="mt-3">
          <RecapTasks taskIds={taskIds} />
        </div>
      )}
    </div>
  );
}

/** Used by the sidebar and the pickers to name the type of an entry. */
export { typeName };
