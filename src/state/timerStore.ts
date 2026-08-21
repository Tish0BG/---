import { create } from 'zustand';
import type { FocusSession, TimerMode } from '@/types';
import { repo } from '@/services/storageService';
import { uid } from '@/lib/util';
import { useSettings } from './settingsStore';
import { useViewer } from './viewerStore';
import { usePlanner } from './plannerStore';
import { useLibrary } from './libraryStore';

/** How the widget is showing itself right now. */
export type TimerView = 'hidden' | 'mini' | 'panel' | 'full';
export type TimerTab = 'timer' | 'tasks' | 'stats' | 'settings';

export const MODE_LABEL: Record<TimerMode, string> = {
  work: 'Учене',
  break: 'Почивка',
  long: 'Дълга почивка',
};

const RUNTIME_KEY = 'studypdf.timer.runtime.v1';

/** Local calendar day, the key every statistic is grouped by. */
export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

interface TimerStore {
  mode: TimerMode;
  running: boolean;
  /** seconds remaining */
  left: number;
  /** completed focus sessions since the last long break */
  cycle: number;

  view: TimerView;
  tab: TimerTab;

  sessions: FocusSession[];
  /** planner item the current focus block is credited to */
  /**
   * The tasks this focus block counts towards. Several, because a sitting
   * before a test is rarely one task — and crediting only one of them makes
   * the rest look untouched.
   */
  activeTaskIds: string[];
  loaded: boolean;

  init(): Promise<void>;
  start(): void;
  pause(): void;
  toggleRun(): void;
  reset(): void;
  skip(): void;
  setMode(mode: TimerMode, autoStart?: boolean): void;
  /** re-reads the duration after the settings change */
  syncDuration(): void;

  setView(view: TimerView): void;
  setTab(tab: TimerTab): void;
  toggleWidget(): void;
  toggleFullscreen(): void;

  /** adds or removes one task from the focus */
  toggleTask(id: string): void;
  setActiveTasks(ids: string[]): void;
  clearTasks(): void;
  resetToday(): Promise<void>;
}

let ticker: ReturnType<typeof setInterval> | null = null;
let endAt = 0;
let wakeLock: WakeLockSentinel | null = null;
let audio: AudioContext | null = null;

const duration = (mode: TimerMode): number => useSettings.getState().timer[mode] * 60;

export const useTimer = create<TimerStore>((set, get) => {
  /* ------------------------------------------------------------ engine */

  const stopTicker = () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };

  const saveRuntime = () => {
    const { mode, running, left, cycle, activeTaskIds } = get();
    try {
      localStorage.setItem(
        RUNTIME_KEY,
        JSON.stringify({ mode, running, left, cycle, activeTaskIds, endAt, savedAt: Date.now() }),
      );
    } catch {
      /* not critical */
    }
  };

  const tick = () => {
    const left = Math.max(0, (endAt - Date.now()) / 1000);
    set({ left });
    if (left <= 0) void finish();
  };

  /** Logs the finished focus block and rolls over to the next mode. */
  const finish = async () => {
    const { mode, cycle } = get();
    stopTicker();
    set({ running: false });
    void keepAwake(false);

    const s = useSettings.getState().timer;
    if (s.sound) chime(mode === 'work');

    if (mode === 'work') {
      await logSession(s.work);
      const next = cycle + 1;
      if (next >= s.cycles) {
        set({ cycle: 0 });
        notify('Готово 🎉', `Дълга почивка — ${s.long} мин.`);
        get().setMode('long', true);
      } else {
        set({ cycle: next });
        notify('Сесията приключи', `Почивка — ${s.break} мин.`);
        get().setMode('break', true);
      }
    } else {
      notify('Почивката свърши', `Учене — ${s.work} мин.`);
      get().setMode('work', true);
    }
  };

  /**
   * A focus block always lands in the statistics, tagged with the document
   * that was open and the subject that document belongs to — that is what
   * makes "time per subject" possible without asking the user anything.
   */
  const logSession = async (minutes: number) => {
    const { activeTaskIds } = get();
    const docId = useViewer.getState().docId;
    const doc = useLibrary.getState().documents.find((d) => d.id === docId);
    const tasks = usePlanner.getState().items.filter((i) => activeTaskIds.includes(i.id));

    // One block of time gets one subject. The open document decides it; with
    // no document, the tasks do — but only if they agree, because splitting a
    // single sitting across three subjects would invent numbers.
    const subjectsOfTasks = [...new Set(tasks.map((t) => t.subjectId).filter(Boolean))];
    const subjectId = doc?.subjectId ?? (subjectsOfTasks.length === 1 ? subjectsOfTasks[0]! : null);

    const session: FocusSession = {
      id: uid('fs_'),
      day: dayKey(),
      startedAt: Date.now() - minutes * 60_000,
      minutes,
      docId,
      taskIds: tasks.map((t) => t.id),
      subjectId,
    };
    await repo.putSession(session);
    set((st) => ({ sessions: [...st.sessions, session] }));
    for (const task of tasks) await usePlanner.getState().addPomodoro(task.id);
  };

  return {
    mode: 'work',
    running: false,
    left: useSettings.getState().timer.work * 60,
    cycle: 0,
    view: useSettings.getState().timerVisible ? 'mini' : 'hidden',
    tab: 'timer',
    sessions: [],
    activeTaskIds: [],
    loaded: false,

    async init() {
      const stored = await repo.listSessions();
      // Sessions written before v1.1 (and any restored from an older backup)
      // carry a single task; normalise on read so nothing downstream has to
      // know that two shapes ever existed.
      const sessions = stored.map((s) =>
        s.taskIds ? s : { ...s, taskIds: s.taskId ? [s.taskId] : [] },
      );
      set({ sessions, loaded: true });

      // Resume where the previous visit left off, including time spent away.
      try {
        const raw = localStorage.getItem(RUNTIME_KEY);
        if (!raw) return;
        const r = JSON.parse(raw) as {
          mode: TimerMode;
          running: boolean;
          left: number;
          cycle: number;
          activeTaskIds?: string[];
          /** @deprecated pre-v1.1 runtime state carried exactly one task */
          activeTaskId?: string | null;
          endAt: number;
        };
        set({
          mode: r.mode,
          cycle: r.cycle,
          // a session saved by an older build carried exactly one task
          activeTaskIds: r.activeTaskIds ?? (r.activeTaskId ? [r.activeTaskId] : []),
        });
        if (r.running && r.endAt > Date.now()) {
          endAt = r.endAt;
          set({ left: (r.endAt - Date.now()) / 1000, running: true });
          ticker = setInterval(tick, 250);
          void keepAwake(true);
        } else if (r.running) {
          // It ran out while the tab was closed — count it, then stand by.
          if (r.mode === 'work') await logSession(useSettings.getState().timer.work);
          set({ left: duration(r.mode), running: false });
        } else {
          set({ left: r.left });
        }
      } catch {
        /* corrupt runtime state is not worth crashing over */
      }
    },

    start() {
      if (get().running) return;
      endAt = Date.now() + get().left * 1000;
      set({ running: true });
      stopTicker();
      ticker = setInterval(tick, 250);
      void unlockAudio();
      void keepAwake(true);
      const s = useSettings.getState();
      if (s.timer.notify && 'Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      if (s.timer.fullscreenOnStart) get().setView('full');
      else if (get().view === 'hidden') get().setView('mini');
      saveRuntime();
    },

    pause() {
      if (!get().running) return;
      stopTicker();
      set({ running: false, left: Math.max(0, (endAt - Date.now()) / 1000) });
      void keepAwake(false);
      saveRuntime();
    },

    toggleRun() {
      get().running ? get().pause() : get().start();
    },

    reset() {
      stopTicker();
      set({ running: false, left: duration(get().mode) });
      void keepAwake(false);
      saveRuntime();
    },

    skip() {
      endAt = Date.now();
      void finish();
    },

    setMode(mode, autoStart) {
      stopTicker();
      set({ mode, running: false, left: duration(mode) });
      saveRuntime();
      if (autoStart && useSettings.getState().timer.autoStart) get().start();
    },

    syncDuration() {
      if (get().running) return;
      set({ left: duration(get().mode) });
      saveRuntime();
    },

    setView(view) {
      set({ view });
      useSettings.getState().set('timerVisible', view !== 'hidden');
    },
    setTab(tab) {
      set({ tab });
    },
    toggleWidget() {
      const v = get().view;
      get().setView(v === 'hidden' ? 'panel' : 'hidden');
    },
    toggleFullscreen() {
      const v = get().view;
      get().setView(v === 'full' ? 'mini' : 'full');
    },

    toggleTask(id) {
      const current = get().activeTaskIds;
      set({ activeTaskIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
      saveRuntime();
    },

    setActiveTasks(ids) {
      set({ activeTaskIds: ids });
      saveRuntime();
    },

    clearTasks() {
      set({ activeTaskIds: [] });
      saveRuntime();
    },

    async resetToday() {
      const day = dayKey();
      await repo.deleteSessionsOfDay(day);
      set((s) => ({ sessions: s.sessions.filter((x) => x.day !== day), cycle: 0 }));
    },
  };
});

/* ------------------------------------------------------------- selectors */

export interface DayStats {
  sessions: number;
  minutes: number;
}

export function statsForDay(sessions: FocusSession[], day: string): DayStats {
  let count = 0;
  let minutes = 0;
  for (const s of sessions) {
    if (s.day !== day) continue;
    count++;
    minutes += s.minutes;
  }
  return { sessions: count, minutes };
}

/** Consecutive days ending today that have at least one focus session. */
export function streak(sessions: FocusSession[]): number {
  const days = new Set(sessions.map((s) => s.day));
  let n = 0;
  const cursor = new Date();
  while (days.has(dayKey(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export function lastDays(sessions: FocusSession[], count = 7): { day: string; label: string; minutes: number }[] {
  const names = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const out: { day: string; label: string; minutes: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    out.push({ day: key, label: names[d.getDay()], minutes: statsForDay(sessions, key).minutes });
  }
  return out;
}

/** Minutes per subject over the given days, most studied first. */
export function minutesBySubject(
  sessions: FocusSession[],
  days: number,
): { subjectId: string; minutes: number }[] {
  const from = Date.now() - days * 86_400_000;
  const totals = new Map<string, number>();
  for (const s of sessions) {
    if (!s.subjectId || s.startedAt < from) continue;
    totals.set(s.subjectId, (totals.get(s.subjectId) ?? 0) + s.minutes);
  }
  return [...totals.entries()]
    .map(([subjectId, minutes]) => ({ subjectId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Minutes per document over the given days, most studied first. */
export function minutesByDocument(
  sessions: FocusSession[],
  days: number,
): { docId: string; minutes: number }[] {
  const from = Date.now() - days * 86_400_000;
  const totals = new Map<string, number>();
  for (const s of sessions) {
    if (!s.docId || s.startedAt < from) continue;
    totals.set(s.docId, (totals.get(s.docId) ?? 0) + s.minutes);
  }
  return [...totals.entries()]
    .map(([docId, minutes]) => ({ docId, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/* ---------------------------------------------------------------- effects */

async function keepAwake(on: boolean): Promise<void> {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

async function unlockAudio(): Promise<void> {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') await audio.resume();
  } catch {
    audio = null;
  }
}

/** Three-note arpeggio: rising when a break starts, falling when it ends. */
function chime(up: boolean): void {
  void unlockAudio();
  if (!audio) return;
  const notes = up ? [587.33, 783.99, 1046.5] : [1046.5, 783.99, 587.33];
  notes.forEach((f, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    const t = audio!.currentTime + i * 0.16;
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);
    osc.connect(gain).connect(audio!.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  });
}

function notify(title: string, body: string): void {
  if (!useSettings.getState().timer.notify) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, silent: true });
  } catch {
    /* some browsers require a service worker */
  }
}

/**
 * Keeps the tab title showing the countdown and re-acquires the screen lock
 * after the tab comes back to the foreground.
 */
export function installTimerEffects(): () => void {
  const original = document.title;
  const unsub = useTimer.subscribe((s) => {
    document.title = s.running ? `${formatClock(s.left)} · ${MODE_LABEL[s.mode]}` : original;
  });
  const onVisible = () => {
    if (!document.hidden && useTimer.getState().running) void keepAwake(true);
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (useTimer.getState().running) e.preventDefault();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => {
    unsub();
    document.title = original;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
