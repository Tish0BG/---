import { useEffect, useMemo, useState } from 'react';
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
import { Toggle } from '../ui';
import { BarChart, Button, Card, EmptyState, IconButton, ProgressRing, Tooltip } from '../kit';
import { DueChip } from '../planner/DueChip';
import { MODE_COLOR } from '../timer/TimerPanel';

const MODES: TimerMode[] = ['work', 'break', 'long'];

/**
 * ───────────────────────────────────────────────────── the focus screen ──
 *
 * The timer used to have no screen of its own. Pressing "Focus" in the
 * sidebar started a session *and* threw the app into full screen, which meant
 * the only way to look at the timer was to be locked inside it — so choosing
 * what to work on, or changing how long a block is, had to happen somewhere
 * else entirely, in a settings dialog three clicks away.
 *
 * This is that missing screen. Nothing here starts on its own. The clock is
 * the largest thing on it, the lengths are steppers beside it rather than a
 * preference, the work being done is a list you can tick several rows of, and
 * full screen is a button you press when you want the room.
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
  const timer = useSettings((s) => s.timer);
  const store = useTimer.getState;

  const today = useMemo(() => statsForDay(sessions, dayKey()), [sessions]);
  const run = useMemo(() => streak(sessions), [sessions]);
  const week = useMemo(() => lastDays(sessions, 7), [sessions]);

  const total = timer[mode] * 60;
  const progress = total ? 1 - left / total : 0;
  const accent = MODE_COLOR[mode];
  const goalPct = Math.min(1, today.minutes / Math.max(1, timer.goal));
  const spent = Math.max(0, Math.round((total - left) / 60));

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
          <Button icon="chartLine" onClick={() => useApp.getState().go('stats')}>
            {t(S.stats)}
          </Button>
          <Button variant="primary" icon="expand" onClick={() => store().setView('full')}>
            {t(L('Цял екран', 'Full screen'))}
          </Button>
        </>
      }
    >
      {lastSession && <JustFinished minutes={lastSession.minutes} taskIds={lastSession.taskIds} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* ------------------------------------------------------ the clock */}
        <Card className="relative overflow-hidden" flush>
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/3 rounded-full"
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${accent} ${running ? 13 : 7}%, transparent) 0%, transparent 70%)`,
              transition: 'background 0.6s var(--ease)',
            }}
          />

          <div className="relative flex flex-col items-center px-4 py-6 sm:px-8 sm:py-8">
            <div className="segmented w-full max-w-[330px]">
              {MODES.map((m) => (
                <button key={m} aria-pressed={m === mode} onClick={() => store().setMode(m)}>
                  {t(MODE_LABEL[m])}
                </button>
              ))}
            </div>

            <div className="mt-7">
              <ProgressRing
                value={progress}
                size={248}
                stroke={6}
                color={accent}
                colorTo="var(--c-brand-lift)"
              >
                <div className="text-center">
                  <div className="t-num text-[58px] font-light leading-none tracking-[-0.045em]">
                    {formatClock(left)}
                  </div>
                  <div className="mt-2.5 text-[12.5px] text-muted">
                    {running
                      ? t(L(`${spent} мин досега`, `${spent} min so far`))
                      : t(L('На пауза', 'Paused'))}
                  </div>
                </div>
              </ProgressRing>
            </div>

            <div className="mt-6 flex gap-2">
              {Array.from({ length: timer.cycles }, (_, i) => (
                <span
                  key={i}
                  className="h-[6px] rounded-full transition-all duration-300"
                  style={{
                    width: i === cycle ? 22 : 6,
                    background: i <= cycle ? accent : 'var(--c-line-strong)',
                    opacity: i <= cycle ? 1 : 0.5,
                  }}
                />
              ))}
            </div>

            <div className="mt-7 flex items-center gap-4">
              <IconButton
                icon="refresh"
                size="lg"
                label={t(L('Нулирай', 'Reset'))}
                onClick={() => store().reset()}
              />
              <button
                onClick={() => store().toggleRun()}
                className="grid h-[76px] w-[76px] cursor-pointer place-items-center rounded-full text-white transition-transform active:scale-95"
                style={{ background: accent, boxShadow: `0 10px 28px -12px ${accent}` }}
                aria-label={t(running ? S.pause : S.start)}
              >
                <Icon name={running ? 'pause' : 'play'} size={29} fill={!running} />
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

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button
                icon="check"
                variant="outline"
                disabled={mode !== 'work' || spent < 1}
                onClick={() => void store().stop()}
              >
                {t(L(`Приключи и запиши ${spent} мин`, `Finish and log ${spent} min`))}
              </Button>
            </div>

            <p className="mt-4 max-w-[46ch] text-center text-[11.5px] leading-relaxed text-faint">
              {t(
                L(
                  'В статистиката влиза само времето, което наистина си изкарал. Прескочи ли режим, прескочените минути не се броят.',
                  'Only time you actually sat through is logged. Skip a block and the skipped minutes are not counted.',
                ),
              )}
            </p>
          </div>
        </Card>

        {/* ------------------------------------------------------- the rail */}
        <div className="space-y-4">
          <Card
            title={t(L('Върху какво работиш', 'What you are working on'))}
            icon="target"
            subtitle={t(
              L(
                'Може да избереш няколко — сесията се брои на всяка от тях.',
                'Pick several — the session counts towards each of them.',
              ),
            )}
            flush
          >
            <TaskPicker />
          </Card>

          <Card title={t(L('Дължина на блоковете', 'Block lengths'))} icon="timer">
            <Durations />
          </Card>

          <Card
            title={t(L('Днес', 'Today'))}
            icon="gauge"
            action={
              <span className="t-num text-[12px] text-muted">
                {formatDuration(today.minutes, lang)} / {timer.goal}
              </span>
            }
          >
            <div className="flex items-center gap-4">
              <ProgressRing value={goalPct} size={62} stroke={6} color="var(--c-accent)" colorTo="var(--c-brand-lift)">
                <span className="t-num text-[13px] font-semibold">{Math.round(goalPct * 100)}%</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <BarChart
                  data={week.map((d, i) => ({
                    label: d.label,
                    value: d.minutes,
                    current: i === week.length - 1,
                  }))}
                  goal={timer.goal}
                  format={(v) => formatDuration(v, lang)}
                  height={64}
                />
              </div>
            </div>
          </Card>

          <Card title={t(L('Поведение', 'Behaviour'))} icon="sliders">
            <Behaviour />
          </Card>
        </div>
      </div>
    </Screen>
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
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
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
        }}
      >
        {on && <Icon name="check" size={12} className="text-white" strokeWidth={3} />}
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
 * What a finished block leaves behind.
 *
 * Not just a receipt. The end of a session is the one moment a person knows
 * whether the thing they were working on is actually done, so the entries it
 * was spent on are right here with a box to tick — rather than waiting on
 * another screen for somebody to remember them.
 */
function JustFinished({ minutes, taskIds }: { minutes: number; taskIds: string[] }) {
  const t = useT();
  const lang = useLang();
  const items = usePlanner((s) => s.items);
  const custom = useItemTypes((s) => s.custom);
  const worked = taskIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as typeof items;

  useEffect(() => {
    // It goes on its own only when there is nothing left to answer. A banner
    // asking a question should not disappear while it is being read.
    if (worked.some((x) => !x.done)) return;
    const id = setTimeout(() => useTimer.getState().clearLast(), 10_000);
    return () => clearTimeout(id);
  }, [minutes, worked]);

  return (
    <div
      className="animate-rise mb-4 rounded-[14px] border"
      style={{
        borderColor: 'color-mix(in srgb, var(--c-success) 30%, transparent)',
        background: 'color-mix(in srgb, var(--c-success) 7%, transparent)',
      }}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
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
        <IconButton icon="x" label={t(S.close)} onClick={() => useTimer.getState().clearLast()} />
      </div>

      {worked.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 border-t px-4 py-2.5"
          style={{ borderColor: 'color-mix(in srgb, var(--c-success) 22%, transparent)' }}
        >
          {worked.map((item) => {
            const type = typeOf(item.kind, custom);
            return (
              <button
                key={item.id}
                onClick={() => void usePlanner.getState().toggleItem(item.id)}
                className="flex max-w-full cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors"
                style={{
                  borderColor: item.done ? 'transparent' : 'var(--c-line)',
                  background: item.done ? 'color-mix(in srgb, var(--c-success) 15%, transparent)' : 'var(--c-surface)',
                  color: item.done ? 'var(--c-success)' : 'var(--c-muted)',
                }}
                aria-pressed={item.done}
              >
                <span
                  className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border"
                  style={{
                    borderColor: item.done ? 'var(--c-success)' : 'var(--c-line-strong)',
                    background: item.done ? 'var(--c-success)' : 'transparent',
                  }}
                >
                  {item.done && <Icon name="check" size={10} className="text-white" strokeWidth={3.4} />}
                </span>
                <Icon name={type.icon} size={12} className="shrink-0 opacity-70" />
                <span className={`truncate ${item.done ? 'line-through' : ''}`}>{item.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Used by the sidebar and the pickers to name the type of an entry. */
export { typeName };
