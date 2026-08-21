import { useMemo, useState } from 'react';
import type { TimerMode } from '@/types';
import { useSettings } from '@/state/settingsStore';
import { useLibrary } from '@/state/libraryStore';
import { useViewer } from '@/state/viewerStore';
import { usePlanner, openItems, sortByDue } from '@/state/plannerStore';
import { useWorkspace } from '@/state/workspaceStore';
import { DueChip } from '../planner/DueChip';
import {
  MODE_LABEL,
  dayKey,
  formatClock,
  lastDays,
  minutesByDocument,
  statsForDay,
  streak,
  useTimer,
} from '@/state/timerStore';
import { Icon } from '../Icon';
import { Toggle, useConfirm } from '../ui';
import { Ring } from './Ring';
import { useApp } from '@/state/appStore';

export const MODE_COLOR: Record<TimerMode, string> = {
  work: 'var(--c-focus)',
  break: 'var(--c-rest)',
  long: 'var(--c-deep)',
};

const MODES: TimerMode[] = ['work', 'break', 'long'];
const SHORT_LABEL: Record<TimerMode, string> = { work: 'Учене', break: 'Почивка', long: 'Дълга' };

/* ------------------------------------------------------------------ timer */

export function TimerTab() {
  const { mode, running, left, cycle } = useTimer();
  const total = useSettings((s) => s.timer[mode]) * 60;
  const cycles = useSettings((s) => s.timer.cycles);
  const store = useTimer.getState;

  return (
    <div className="flex flex-col items-center gap-4 px-3 py-3">
      <div className="flex w-full gap-1 rounded-lg p-0.5" style={{ background: 'var(--c-surface-3)' }}>
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => store().setMode(m)}
            className="flex-1 cursor-pointer rounded-md py-1.5 text-[12px] font-medium transition-colors"
            style={
              mode === m
                ? { background: 'var(--c-surface)', color: MODE_COLOR[m], boxShadow: 'var(--shadow-panel)' }
                : { color: 'var(--c-muted)' }
            }
          >
            {SHORT_LABEL[m]}
          </button>
        ))}
      </div>

      <Ring progress={total ? left / total : 0} size={182} stroke={5.5} color={MODE_COLOR[mode]}>
        <span className="text-[12px] text-muted">{MODE_LABEL[mode]}</span>
        <span className="text-[42px] font-extralight leading-none tabular-nums tracking-tight">
          {formatClock(left)}
        </span>
        <CycleDots done={cycle} of={cycles} color={MODE_COLOR[mode]} />
      </Ring>

      <div className="flex items-center gap-4">
        <button className="icon-btn h-10 w-10" onClick={() => store().reset()} title="Нулирай (R)">
          <Icon name="refresh" size={18} />
        </button>
        <button
          onClick={() => store().toggleRun()}
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95"
          style={{
            background: `color-mix(in srgb, ${MODE_COLOR[mode]} 16%, transparent)`,
            color: MODE_COLOR[mode],
          }}
          title={running ? 'Пауза (⌥Space)' : 'Старт (⌥Space)'}
        >
          <Icon name={running ? 'pause' : 'play'} size={22} />
        </button>
        <button className="icon-btn h-10 w-10" onClick={() => store().skip()} title="Следващ (S)">
          <Icon name="skip" size={18} />
        </button>
      </div>

      <FocusLine />
    </div>
  );
}

function CycleDots({ done, of, color }: { done: number; of: number; color: string }) {
  return (
    <span className="mt-1.5 flex gap-1">
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full transition-colors"
          style={{ background: i < done ? color : 'var(--c-line-strong)' }}
        />
      ))}
    </span>
  );
}

function FocusLine() {
  const activeTaskId = useTimer((s) => s.activeTaskId);
  const task = usePlanner((s) => s.items.find((t) => t.id === activeTaskId));
  if (!activeTaskId || !task) {
    return (
      <button
        className="text-[12px] text-faint transition-colors hover:text-muted cursor-pointer"
        onClick={() => useTimer.getState().setTab('tasks')}
      >
        Избери задача, върху която да се фокусираш
      </button>
    );
  }
  return (
    <div className="flex max-w-full items-center gap-1.5 text-[12px] text-muted">
      <Icon name="target" size={13} className="shrink-0" />
      <span className="truncate font-medium text-ink">{task.title}</span>
      <button className="icon-btn h-5 w-5" onClick={() => useTimer.getState().setActiveTask(null)}>
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ tasks */

export function TasksTab() {
  const items = usePlanner((s) => s.items);
  const activeTaskId = useTimer((s) => s.activeTaskId);
  const subjects = useWorkspace((s) => s.subjects);
  const documents = useLibrary((s) => s.documents);
  const [draft, setDraft] = useState('');

  // The panel shows what is actually pressing: open work, soonest first.
  const list = useMemo(() => sortByDue(openItems(items)).slice(0, 40), [items]);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    const docId = useViewer.getState().docId;
    const doc = documents.find((d) => d.id === docId);
    void usePlanner.getState().addItem({ title, docId, subjectId: doc?.subjectId ?? null });
    setDraft('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') add();
          }}
          placeholder="Нова задача"
          className="field"
          maxLength={140}
        />
        <button className="btn btn-primary h-8 w-8 shrink-0 px-0" onClick={add}>
          <Icon name="plus" size={16} />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {list.length === 0 && (
          <p className="px-2 py-8 text-center text-[12px] leading-relaxed text-faint">
            Няма отворени задачи. Каквото добавиш тук, се появява и в Планера.
          </p>
        )}
        {list.map((t) => {
          const subject = subjects.find((s) => s.id === t.subjectId) ?? null;
          const active = activeTaskId === t.id;
          return (
            <div
              key={t.id}
              className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2"
            >
              <button
                onClick={() => void usePlanner.getState().toggleItem(t.id)}
                className="h-[17px] w-[17px] shrink-0 cursor-pointer rounded-full border transition-colors"
                style={{ borderColor: subject?.color ?? 'var(--c-line-strong)' }}
                aria-label="Готово"
              />
              <button
                className="min-w-0 flex-1 cursor-pointer text-left"
                onClick={() => useTimer.getState().setActiveTask(active ? null : t.id)}
              >
                <span
                  className="block truncate text-[13px]"
                  style={active ? { color: 'var(--c-accent)', fontWeight: 500 } : undefined}
                >
                  {t.title}
                </span>
                <span className="flex items-center gap-1.5 truncate text-[10px] text-faint">
                  {subject && <span style={{ color: subject.color }}>{subject.name}</span>}
                  {t.due !== null && <DueChip due={t.due} bare />}
                </span>
              </button>
              {t.pomodoros > 0 && (
                <span className="shrink-0 text-[11px] tabular-nums text-faint">{t.pomodoros} ●</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-muted">
        <span>{list.length ? `${list.length} отворени` : ''}</span>
        <button
          className="cursor-pointer text-accent"
          onClick={() => useApp.getState().go('planner')}
        >
          Отвори Планера
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ statistics */

export function StatsTab() {
  const sessions = useTimer((s) => s.sessions);
  const goal = useSettings((s) => s.timer.goal);
  const setTimer = useSettings((s) => s.setTimer);
  const documents = useLibrary((s) => s.documents);
  const { confirm, element } = useConfirm();

  const today = useMemo(() => statsForDay(sessions, dayKey()), [sessions]);
  const week = useMemo(() => lastDays(sessions), [sessions]);
  const byDoc = useMemo(() => minutesByDocument(sessions, 7).slice(0, 4), [sessions]);
  const max = Math.max(1, ...week.map((d) => d.minutes));
  const weekTotal = week.reduce((sum, d) => sum + d.minutes, 0);
  const pct = Math.min(100, Math.round((today.minutes / Math.max(1, goal)) * 100));

  return (
    <div className="scroll-thin h-full space-y-4 overflow-y-auto px-3 py-3">
      {element}
      <div className="grid grid-cols-3 gap-2">
        <Stat value={today.sessions} label="сесии" />
        <Stat value={today.minutes} label="минути" />
        <Stat value={streak(sessions)} label="дни поред" icon="flame" />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="font-semibold uppercase tracking-wide text-faint">Дневна цел</span>
          <Stepper value={`${goal} мин`} onDown={() => setTimer({ goal: Math.max(15, goal - 15) })} onUp={() => setTimer({ goal: Math.min(720, goal + 15) })} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: 'var(--c-focus)' }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span className="tabular-nums">{today.minutes} мин днес</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      </div>

      <div>
        <div className="mb-1.5 label">Последните 7 дни</div>
        <div className="flex h-[92px] items-end gap-1.5">
          {week.map((d, i) => (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[9px] tabular-nums text-faint">{d.minutes || ''}</span>
              <div
                className="w-full rounded-[3px] transition-[height] duration-500"
                style={{
                  height: `${Math.max(3, (d.minutes / max) * 100)}%`,
                  background: i === week.length - 1 ? 'var(--c-focus)' : 'var(--c-line-strong)',
                }}
              />
              <span className="text-[10px] text-muted">{d.label}</span>
            </div>
          ))}
        </div>
        {weekTotal > 0 && (
          <p className="mt-1.5 text-[11px] text-muted">
            Общо {Math.floor(weekTotal / 60)} ч {weekTotal % 60} мин за седмицата.
          </p>
        )}
      </div>

      {byDoc.length > 0 && (
        <div>
          <div className="mb-1.5 label">
            Време по документи
          </div>
          <div className="space-y-1.5">
            {byDoc.map((row) => {
              const doc = documents.find((d) => d.id === row.docId);
              if (!doc) return null;
              return (
                <button
                  key={row.docId}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
                  onClick={() => void useViewer.getState().openDocument(row.docId)}
                >
                  <Icon name={doc.kind === 'board' ? 'board' : 'file'} size={13} className="shrink-0 text-faint" />
                  <span className="min-w-0 flex-1 truncate text-[12px]">{doc.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">{row.minutes} мин</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="btn w-full"
        style={{ color: 'var(--c-danger)' }}
        onClick={() =>
          confirm('Да изтрия ли днешната статистика? Другите дни остават непокътнати.', () =>
            void useTimer.getState().resetToday(),
          )
        }
      >
        Нулирай днешния ден
      </button>
    </div>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon?: string }) {
  return (
    <div className="rounded-lg py-2.5 text-center" style={{ background: 'var(--c-surface-2)' }}>
      <div className="flex items-center justify-center gap-1 text-[22px] font-light leading-none tabular-nums">
        {icon && value > 0 && <Icon name={icon} size={15} className="text-warn" />}
        {value}
      </div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
    </div>
  );
}

/* -------------------------------------------------------------- settings */

const PRESETS: [number, number, number, number][] = [
  [25, 5, 15, 4],
  [50, 10, 30, 2],
  [90, 20, 30, 2],
  [15, 3, 10, 4],
];

export function TimerSettingsTab() {
  const t = useSettings((s) => s.timer);
  const setTimer = useSettings((s) => s.setTimer);

  const step = (key: 'work' | 'break' | 'long' | 'cycles', by: number, min: number, max: number) => {
    setTimer({ [key]: Math.min(max, Math.max(min, t[key] + by)) });
    useTimer.getState().syncDuration();
  };

  return (
    <div className="scroll-thin h-full space-y-4 overflow-y-auto px-3 py-3">
      <section>
        <h4 className="mb-1.5 label">Продължителност</h4>
        <div className="space-y-1">
          <Row label="Учене">
            <Stepper value={`${t.work} мин`} onDown={() => step('work', -5, 5, 180)} onUp={() => step('work', 5, 5, 180)} />
          </Row>
          <Row label="Почивка">
            <Stepper value={`${t.break} мин`} onDown={() => step('break', -1, 1, 60)} onUp={() => step('break', 1, 1, 60)} />
          </Row>
          <Row label="Дълга почивка">
            <Stepper value={`${t.long} мин`} onDown={() => step('long', -5, 5, 90)} onUp={() => step('long', 5, 5, 90)} />
          </Row>
          <Row label="Дълга след">
            <Stepper value={`${t.cycles} сесии`} onDown={() => step('cycles', -1, 2, 8)} onUp={() => step('cycles', 1, 2, 8)} />
          </Row>
        </div>
      </section>

      <section>
        <h4 className="mb-1.5 label">Готови режими</h4>
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map(([work, brk, long, cycles]) => {
            const on = t.work === work && t.break === brk && t.long === long && t.cycles === cycles;
            return (
              <button
                key={work}
                className={`btn px-1 text-[12px] ${on ? 'btn-ghost-active' : ''}`}
                onClick={() => {
                  setTimer({ work, break: brk, long, cycles });
                  useTimer.getState().syncDuration();
                }}
              >
                {work}/{brk}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="mb-0.5 label">Поведение</h4>
        <Toggle
          checked={t.autoStart}
          onChange={(v) => setTimer({ autoStart: v })}
          label="Автоматичен старт"
          hint="Следващият таймер тръгва сам."
        />
        <Toggle checked={t.sound} onChange={(v) => setTimer({ sound: v })} label="Звук при смяна" />
        <Toggle
          checked={t.notify}
          onChange={(v) => {
            setTimer({ notify: v });
            if (v && 'Notification' in window && Notification.permission === 'default') {
              void Notification.requestPermission();
            }
          }}
          label="Известия"
          hint="Показват се дори когато прозорецът е скрит."
        />
        <Toggle
          checked={t.fullscreenOnStart}
          onChange={(v) => setTimer({ fullscreenOnStart: v })}
          label="Цял екран при старт"
        />
      </section>

      <p className="text-[11px] leading-relaxed text-muted">
        Всяка завършена сесия учене се записва към документа, който е отворен в момента — затова
        статистиката знае по кой учебник колко си работил.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px]">{label}</span>
      {children}
    </div>
  );
}

function Stepper({ value, onDown, onUp }: { value: string; onDown: () => void; onUp: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <span className="min-w-[58px] text-right text-[12px] tabular-nums text-muted">{value}</span>
      <span className="flex overflow-hidden rounded-lg" style={{ background: 'var(--c-surface-3)' }}>
        <button className="h-7 w-8 cursor-pointer text-[15px] transition-colors hover:bg-line" onClick={onDown}>
          −
        </button>
        <span className="w-px" style={{ background: 'var(--c-line)' }} />
        <button className="h-7 w-8 cursor-pointer text-[15px] transition-colors hover:bg-line" onClick={onUp}>
          +
        </button>
      </span>
    </span>
  );
}
