import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimerMode } from '@/types';
import { useSettings } from '@/state/settingsStore';
import { MODE_LABEL, dayKey, formatClock, statsForDay, useTimer, type TimerTab } from '@/state/timerStore';
import { usePlanner } from '@/state/plannerStore';
import { useWorkspace } from '@/state/workspaceStore';
import { currentStreak } from '@/services/gameService';
import { useT, useLang, L, clockTime, formatDuration } from '@/i18n';
import { Button, IconButton, ProgressRing } from '../kit';
import { clamp } from '@/lib/util';
import { Icon } from '../Icon';
import { Ring } from './Ring';
import { MODE_COLOR, StatsTab, TasksTab, TimerSettingsTab, TimerTab as TimerScreen } from './TimerPanel';

const MINI = { w: 132, h: 42 };
const PANEL = { w: 322, h: 470 };

const TABS: { id: TimerTab; icon: string; label: string }[] = [
  { id: 'timer', icon: 'timer', label: 'Таймер' },
  { id: 'tasks', icon: 'listTodo', label: 'Задачи' },
  { id: 'stats', icon: 'barChart', label: 'Статистика' },
  { id: 'settings', icon: 'sliders', label: 'Настройки' },
];

/**
 * The focus timer floats above whatever the student is doing — library or
 * page — and is never allowed to swallow a stylus stroke: the layer itself is
 * pointer-events:none and only the widget's own chrome takes input.
 */
export function TimerOverlay() {
  const view = useTimer((s) => s.view);
  useTimerShortcuts();

  if (view === 'hidden') return null;
  if (view === 'full') return createPortal(<FullScreen />, document.body);

  return createPortal(
    <div className="timer-layer">
      <Floating>{view === 'mini' ? <MiniPill /> : <Panel />}</Floating>
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------- floating */

/** Draggable shell that remembers where the student parked the widget. */
function Floating({ children }: { children: React.ReactNode }) {
  const view = useTimer((s) => s.view);
  const pos = useSettings((s) => s.timerPos);
  const setSetting = useSettings((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ left: number; top: number } | null>(null);
  const size = view === 'mini' ? MINI : PANEL;

  /**
   * On a phone the bottom bar owns the last 58 px and the widget must not sit
   * on top of it — nor on top of the row a thumb is reaching for.
   */
  const phone = window.innerWidth < 768;
  const floor = phone ? 74 : 8;
  const place = (fraction: { x: number; y: number }) => ({
    left: clamp(fraction.x * (window.innerWidth - size.w), 8, Math.max(8, window.innerWidth - size.w - 8)),
    top: clamp(
      fraction.y * (window.innerHeight - size.h),
      8,
      Math.max(8, window.innerHeight - size.h - floor),
    ),
  });

  const at = drag ?? place(pos);

  const onPointerDown = (e: React.PointerEvent) => {
    // Only the marked handles start a drag; buttons keep working normally.
    if (!(e.target as HTMLElement).closest('[data-drag]')) return;
    const start = place(pos);
    const originX = e.clientX;
    const originY = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - originX;
      const dy = ev.clientY - originY;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      setDrag({
        left: clamp(start.left + dx, 8, Math.max(8, window.innerWidth - size.w - 8)),
        top: clamp(start.top + dy, 8, Math.max(8, window.innerHeight - size.h - floor)),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag((current) => {
        if (current) {
          setSetting('timerPos', {
            x: current.left / Math.max(1, window.innerWidth - size.w),
            y: current.top / Math.max(1, window.innerHeight - size.h),
          });
        }
        return null;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className="fixed"
      style={{ left: at.left, top: at.top, width: size.w }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- mini */

function MiniPill() {
  const { mode, running, left } = useTimer();
  const total = useSettings((s) => s.timer[mode]) * 60;
  const store = useTimer.getState;

  return (
    <div
      data-drag
      className="panel animate-scale flex cursor-grab items-center gap-2 rounded-full py-1.5 pl-2 pr-1.5 active:cursor-grabbing"
      style={{ boxShadow: 'var(--shadow-float)', backdropFilter: 'blur(10px)' }}
      onDoubleClick={() => store().setView('panel')}
    >
      <Ring progress={total ? left / total : 0} size={26} stroke={9} color={MODE_COLOR[mode]} />
      <button
        className="flex-1 cursor-pointer text-left text-[14px] font-medium tabular-nums"
        onClick={() => store().setView('panel')}
        title="Отвори"
      >
        {formatClock(left)}
      </button>
      <button
        className="icon-btn h-7 w-7"
        style={{ color: MODE_COLOR[mode] }}
        onClick={() => store().toggleRun()}
        title={running ? 'Пауза' : 'Старт'}
      >
        <Icon name={running ? 'pause' : 'play'} size={15} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ panel */

function Panel() {
  const tab = useTimer((s) => s.tab);
  const mode = useTimer((s) => s.mode);
  const store = useTimer.getState;

  return (
    <div
      className="panel animate-scale flex flex-col overflow-hidden"
      style={{ height: PANEL.h, boxShadow: 'var(--shadow-float)' }}
    >
      <header data-drag className="flex cursor-grab items-center gap-1 border-b border-line px-1.5 py-1.5 active:cursor-grabbing">
        <Icon name="grip" size={15} className="text-faint" />
        <span className="flex-1 text-[13px] font-semibold" style={{ color: MODE_COLOR[mode] }}>
          Фокус
        </span>
        <button className="icon-btn h-7 w-7" onClick={() => store().setView('full')} title="Цял екран (⌥F)">
          <Icon name="expand" size={15} />
        </button>
        <button className="icon-btn h-7 w-7" onClick={() => store().setView('mini')} title="Смали">
          <Icon name="shrink" size={15} />
        </button>
        <button className="icon-btn h-7 w-7" onClick={() => store().setView('hidden')} title="Скрий (⌥T)">
          <Icon name="x" size={15} />
        </button>
      </header>

      <nav className="flex gap-0.5 border-b border-line px-1.5 py-1">
        {/* only the active tab spells itself out — four labels do not fit,
            and an icon row alone is a guessing game */}
        {TABS.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => store().setTab(t.id)}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] transition-all ${
              tab === t.id ? 'btn-ghost-active flex-1' : 'text-muted hover:bg-surface-3'
            }`}
          >
            <Icon name={t.icon} size={14} />
            {tab === t.id && <span className="truncate font-medium">{t.label}</span>}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1">
        {tab === 'timer' && <TimerScreen />}
        {tab === 'tasks' && <TasksTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'settings' && <TimerSettingsTab />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- fullscreen */

const ALL_MODES: TimerMode[] = ['work', 'break', 'long'];

/** The switch at the bottom has room for one word each. */
const SHORT_MODE: Record<TimerMode, { bg: string; en: string }> = {
  work: L('Учене', 'Focus'),
  break: L('Почивка', 'Break'),
  long: L('Дълга', 'Long'),
};

/**
 * Focus mode.
 *
 * The whole screen becomes the session: the task being worked on, the time
 * left, and two buttons. Everything else in the product is gone on purpose —
 * the point of a focus timer is not to be another screen with navigation on
 * it. When the block ends the same surface turns into the summary, so the
 * minutes are visibly banked before anything else is offered.
 */
function FullScreen() {
  const t = useT();
  const lang = useLang();
  const { mode, running, left, cycle } = useTimer();
  const timer = useSettings((s) => s.timer);
  const activeTaskId = useTimer((s) => s.activeTaskId);
  const lastSession = useTimer((s) => s.lastSession);
  const task = usePlanner((s) => s.items.find((x) => x.id === activeTaskId));
  const subject = useWorkspace((s) => s.subjects.find((x) => x.id === task?.subjectId));
  const [now, setNow] = useState(() => new Date());
  const store = useTimer.getState;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    void document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      clearInterval(id);
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const total = timer[mode] * 60;
  const progress = total ? 1 - left / total : 0;
  const accent = MODE_COLOR[mode];
  const ring = Math.min(340, Math.max(210, Math.round(window.innerWidth * 0.26)));

  if (lastSession) return <SessionComplete minutes={lastSession.minutes} accent={MODE_COLOR.work} />;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between overflow-hidden px-6 py-[clamp(18px,4vh,40px)]"
      style={{ background: 'var(--c-bg)' }}
    >
      {/* the room the session happens in: one soft light in the mode's colour */}
      <span
        aria-hidden
        className="animate-breathe pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: ring * 2.6,
          height: ring * 2.6,
          background: `radial-gradient(circle, color-mix(in srgb, ${accent} ${running ? 26 : 14}%, transparent) 0%, transparent 68%)`,
        }}
      />

      <header className="relative flex w-full items-center justify-between">
        <IconButton
          icon="shrink"
          label={t(L('Изход (Esc)', 'Exit (Esc)'))}
          size="lg"
          onClick={() => store().setView('mini')}
        />
        <span className="t-num text-[13px] text-muted">{clockTime(now.getTime(), lang)}</span>
      </header>

      <div className="relative flex flex-col items-center">
        <div className="mb-7 flex min-h-[42px] flex-col items-center text-center">
          {task && (
            <>
              <span className="flex items-center gap-2 text-[12.5px] text-muted">
                {subject && <span className="badge-dot" style={{ background: subject.color }} />}
                {subject?.name ?? t(L('Фокус сесия', 'Focus session'))}
              </span>
              <span className="mt-1 max-w-[36ch] truncate text-[19px] font-semibold tracking-[-0.02em]">
                {task.title}
              </span>
            </>
          )}
        </div>

        <ProgressRing value={progress} size={ring} stroke={5} color={accent} colorTo="var(--c-brand-lift)">
          <div className="text-center">
            <div
              className="t-num font-light leading-none tracking-[-0.04em]"
              style={{ fontSize: Math.round(ring * 0.27) }}
            >
              {formatClock(left)}
            </div>
            <div className="mt-3 text-[12.5px] text-muted">{t(MODE_LABEL[mode])}</div>
          </div>
        </ProgressRing>

        <div className="mt-7 flex gap-2">
          {Array.from({ length: timer.cycles }, (_, i) => (
            <span
              key={i}
              className="h-[7px] rounded-full transition-all duration-300"
              style={{
                width: i === cycle ? 20 : 7,
                background: i < cycle ? accent : i === cycle ? accent : 'var(--c-line-strong)',
                opacity: i <= cycle ? 1 : 0.55,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-5">
        <div className="flex items-center gap-4">
          <IconButton
            icon="refresh"
            label={t(L('Нулирай (R)', 'Reset (R)'))}
            size="lg"
            onClick={() => store().reset()}
          />
          <button
            onClick={() => store().toggleRun()}
            className="grid h-[86px] w-[86px] cursor-pointer place-items-center rounded-full text-white transition-transform active:scale-95"
            style={{ background: accent, boxShadow: `0 12px 40px -12px ${accent}` }}
            aria-label={t(running ? L('Пауза', 'Pause') : L('Старт', 'Start'))}
          >
            <Icon name={running ? 'pause' : 'play'} size={32} fill={!running} />
          </button>
          <IconButton
            icon="skip"
            label={t(L('Следващ (S)', 'Next (S)'))}
            size="lg"
            onClick={() => store().skip()}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            icon="check"
            onClick={() => void store().stop()}
            disabled={mode === 'work' && total - left < 60}
          >
            {t(L('Приключи сесията', 'Finish session'))}
          </Button>
        </div>

        <div className="segmented w-[300px]">
          {ALL_MODES.map((m) => (
            <button key={m} aria-pressed={m === mode} onClick={() => store().setMode(m)}>
              {t(SHORT_MODE[m])}
            </button>
          ))}
        </div>

        <p className="flex items-center gap-3 text-[11px] text-faint">
          <span className="flex items-center gap-1">
            <kbd className="kbd">space</kbd> {t(L('пауза', 'pause'))}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">R</kbd> {t(L('нулирай', 'reset'))}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">esc</kbd> {t(L('изход', 'exit'))}
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * What a finished block looks like. It states the minutes, the XP they are
 * worth and the streak they keep alive — then offers the break, because the
 * break is the part people skip.
 */
function SessionComplete({ minutes, accent }: { minutes: number; accent: string }) {
  const t = useT();
  const lang = useLang();
  const sessions = useTimer((s) => s.sessions);
  const goal = useSettings((s) => s.timer.goal);
  const breakMinutes = useSettings((s) => s.timer.break);
  const store = useTimer.getState;

  const today = statsForDay(sessions, dayKey());
  const streak = currentStreak(sessions);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-hidden px-6"
      style={{ background: 'var(--c-bg)' }}
    >
      <span
        aria-hidden
        className="animate-breathe pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${accent} 24%, transparent) 0%, transparent 66%)`,
        }}
      />

      <div className="animate-rise relative w-full max-w-[420px] text-center">
        <span
          className="animate-pop mx-auto grid h-[88px] w-[88px] place-items-center rounded-full text-white"
          style={{ background: accent, boxShadow: `0 16px 50px -16px ${accent}` }}
        >
          <Icon name="check" size={40} strokeWidth={2.6} />
        </span>

        <h1 className="t-h1 mt-6">{t(L('Сесията приключи', 'Session complete'))}</h1>
        <p className="mt-2 text-[15px] text-muted">
          {t(
            L(
              `${formatDuration(minutes, lang)} фокус. Записано в статистиката.`,
              `${formatDuration(minutes, lang)} of focus, logged.`,
            ),
          )}
        </p>

        <div className="mt-7 grid grid-cols-3 gap-2">
          {[
            { icon: 'bolt', value: `+${minutes}`, label: 'XP', tone: 'var(--c-brand)' },
            {
              icon: 'timer',
              value: formatDuration(today.minutes, lang),
              label: t(L(`от ${goal} мин`, `of ${goal} min`)),
              tone: 'var(--c-aurora)',
            },
            {
              icon: 'flame',
              value: String(streak),
              label: t(streak === 1 ? L('ден поред', 'day streak') : L('дни поред', 'day streak')),
              tone: 'var(--c-ember)',
            },
          ].map((cell) => (
            <div key={cell.label} className="card-quiet p-3">
              <Icon name={cell.icon} size={15} style={{ color: cell.tone }} className="mx-auto" />
              <div className="t-num mt-2 text-[17px] font-semibold leading-none">{cell.value}</div>
              <div className="mt-1.5 text-[11px] text-muted">{cell.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            size="lg"
            icon="coffee"
            onClick={() => {
              store().clearLast();
              store().setMode('break', true);
            }}
          >
            {t(L(`Почивка ${breakMinutes} мин`, `Break ${breakMinutes} min`))}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              store().clearLast();
              store().setView('hidden');
            }}
          >
            {t(L('Готово', 'Done'))}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- shortcuts */

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

/**
 * Alt-based so nothing collides with the single-letter tool keys of the
 * viewer. Inside the full-screen view the page is not visible anyway, so the
 * bare R/S/Esc keys of the original timer keep working there.
 */
function useTimerShortcuts() {
  const handler = useCallback((e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const store = useTimer.getState();

    if (e.altKey && e.code === 'Space') {
      e.preventDefault();
      store.toggleRun();
      return;
    }
    if (e.altKey && (e.key === 'f' || e.key === 'а')) {
      e.preventDefault();
      store.toggleFullscreen();
      return;
    }
    if (store.view !== 'full') return;

    if (e.code === 'Space') {
      e.preventDefault();
      store.toggleRun();
    } else if (/^[rRрР]$/.test(e.key)) {
      store.reset();
    } else if (/^[sSсС]$/.test(e.key)) {
      store.skip();
    } else if (e.key === 'Escape') {
      store.setView('mini');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
