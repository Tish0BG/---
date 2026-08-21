import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimerMode } from '@/types';
import { useSettings } from '@/state/settingsStore';
import { MODE_LABEL, formatClock, useTimer, type TimerTab } from '@/state/timerStore';
import { usePlanner } from '@/state/plannerStore';
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

  const place = (fraction: { x: number; y: number }) => ({
    left: clamp(fraction.x * (window.innerWidth - size.w), 8, Math.max(8, window.innerWidth - size.w - 8)),
    top: clamp(fraction.y * (window.innerHeight - size.h), 8, Math.max(8, window.innerHeight - size.h - 8)),
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
        top: clamp(start.top + dy, 8, Math.max(8, window.innerHeight - size.h - 8)),
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

/** Distraction-free view: wall clock, the three rings, nothing else. */
function FullScreen() {
  const { mode, running, left, cycle } = useTimer();
  const timer = useSettings((s) => s.timer);
  const activeTaskId = useTimer((s) => s.activeTaskId);
  const task = usePlanner((s) => s.items.find((t) => t.id === activeTaskId));
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
  const date = now.toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between px-6 py-[clamp(20px,4vh,44px)]"
      style={{ background: 'var(--c-bg)' }}
    >
      <button
        className="icon-btn absolute right-5 top-5 h-9 w-9"
        onClick={() => store().setView('mini')}
        title="Изход (Esc)"
      >
        <Icon name="shrink" size={18} />
      </button>

      <div className="text-center">
        <div className="text-[clamp(48px,8vw,92px)] font-extralight leading-none tabular-nums tracking-tighter">
          {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
        </div>
        <div className="mt-2 text-[clamp(13px,1.5vw,17px)] text-muted">
          {date.charAt(0).toUpperCase() + date.slice(1)}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-[clamp(14px,3.6vw,48px)]">
        {ALL_MODES.map((m) => {
          const on = m === mode;
          return (
            <button
              key={m}
              onClick={() => store().setMode(m)}
              className="flex cursor-pointer flex-col items-center gap-3 transition-all duration-500"
              style={{ opacity: on ? 1 : 0.38, transform: on ? 'none' : 'scale(0.88)' }}
            >
              <Ring
                progress={on ? (total ? left / total : 0) : 1}
                size={Math.min(300, Math.max(120, window.innerWidth * 0.24))}
                stroke={4.5}
                color={MODE_COLOR[m]}
              >
                <span className="text-[clamp(26px,4.2vw,50px)] font-extralight tabular-nums tracking-tight">
                  {on ? formatClock(left) : formatClock(timer[m] * 60)}
                </span>
              </Ring>
              <span className={`text-[clamp(12px,1.5vw,17px)] ${on ? 'text-ink' : 'text-muted'}`}>
                {MODE_LABEL[m]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-4">
        {task && (
          <div className="flex items-center gap-1.5 text-[14px] text-muted">
            <Icon name="target" size={14} />
            <span className="font-medium text-ink">{task.title}</span>
          </div>
        )}
        <div className="flex items-center gap-6">
          <button className="icon-btn h-12 w-12" onClick={() => store().reset()} title="Нулирай (R)">
            <Icon name="refresh" size={20} />
          </button>
          <button
            onClick={() => store().toggleRun()}
            className="flex h-[84px] w-[84px] cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95"
            style={{
              background: `color-mix(in srgb, ${MODE_COLOR[mode]} 16%, transparent)`,
              color: MODE_COLOR[mode],
            }}
          >
            <Icon name={running ? 'pause' : 'play'} size={30} />
          </button>
          <button className="icon-btn h-12 w-12" onClick={() => store().skip()} title="Следващ (S)">
            <Icon name="skip" size={20} />
          </button>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: timer.cycles }, (_, i) => (
            <span
              key={i}
              className="h-[7px] w-[7px] rounded-full transition-colors"
              style={{ background: i < cycle ? MODE_COLOR[mode] : 'var(--c-line-strong)' }}
            />
          ))}
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
