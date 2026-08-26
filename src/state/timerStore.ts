import { create } from 'zustand';
import type { FocusSession, TimerMode } from '@/types';
import { repo } from '@/services/storageService';
import { uid } from '@/lib/util';
import { useSettings } from './settingsStore';
import { useViewer } from './viewerStore';
import { useNotes } from './noteStore';
import { useApp } from './appStore';
import { usePlanner } from './plannerStore';
import { useLibrary } from './libraryStore';
import { announceProgress } from '@/services/progressBus';
import { currentLang, L, tr, type Msg } from '@/i18n';
import { currentTabTitle } from '@/seo/head';

/** How the widget is showing itself right now. */
export type TimerView = 'hidden' | 'mini' | 'panel' | 'full';
export type TimerTab = 'timer' | 'tasks' | 'stats' | 'settings';

export const MODE_LABEL: Record<TimerMode, Msg> = {
  work: L('Работа', 'Focus'),
  break: L('Почивка', 'Break'),
  long: L('Дълга почивка', 'Long break'),
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
  /**
   * The planner entries the current block is being spent on.
   *
   * A list rather than one id: an hour of maths is very often three exercises
   * off the same sheet, and being made to pick one of them — or to stop the
   * clock between them — is how the number in the statistics stops matching
   * what actually happened.
   */
  activeTaskIds: string[];
  loaded: boolean;

  init(): Promise<void>;
  start(): void;
  pause(): void;
  toggleRun(): void;
  reset(): void;
  /**
   * Ends the block early and moves on.
   *
   * Only the minutes actually spent are logged. Skipping used to credit the
   * whole block, which meant a person could press it four times and be told
   * they had studied for two hours — a statistic that lies is worse than no
   * statistic, and this one lied in the flattering direction.
   */
  skip(): void;
  setMode(mode: TimerMode, autoStart?: boolean): void;
  /** re-reads the duration after the settings change */
  syncDuration(): void;
  /** changes one of the three lengths from the focus screen itself */
  setDuration(mode: TimerMode, minutes: number): void;

  setView(view: TimerView): void;
  setTab(tab: TimerTab): void;
  toggleWidget(): void;
  toggleFullscreen(): void;

  /** replaces the selection with one entry, or clears it with null */
  setActiveTask(id: string | null): void;
  /** adds or removes one entry from the selection */
  toggleTask(id: string): void;
  clearTasks(): void;
  resetToday(): Promise<void>;
  /**
   * Ends the block early and logs only the minutes actually spent.
   * `skip` rolls straight on to the next mode and credits the whole block,
   * which is right for a break and dishonest for focus.
   */
  stop(): Promise<void>;
  /**
   * The block that just finished, for the completion screen.
   *
   * It carries the entries it was spent on as well as the minutes: the moment
   * a session ends is the moment a person knows whether the thing is actually
   * finished, and asking them to go and find it in another screen is how a
   * task list drifts out of date.
   */
  lastSession: { minutes: number; at: number; taskIds: string[] } | null;
  clearLast(): void;
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

  /** Whole minutes already spent inside the current block. */
  const spentMinutes = (): number => Math.max(0, Math.round((duration(get().mode) - get().left) / 60));

  /**
   * Ends the block and rolls on to the next mode, logging `minutes`.
   *
   * The one place that decides what a block was worth. A block that ran out
   * on its own is worth its whole length; one that was skipped is worth the
   * part that was actually sat through, and a break is worth nothing either
   * way because breaks are not the thing being measured.
   */
  const roll = async (minutes: number, announceIt = true) => {
    const { mode, cycle } = get();
    stopTicker();
    set({ running: false });
    void keepAwake(false);

    const s = useSettings.getState().timer;
    if (s.sound && announceIt) chime(mode === 'work');

    if (mode === 'work') {
      if (minutes >= 1) await logSession(minutes);
      const next = cycle + 1;
      if (next >= s.cycles) {
        set({ cycle: 0 });
        if (announceIt)
          notify(tr(L('Кръгът е завършен', 'Round complete')), tr(L(`Дълга почивка — ${s.long} мин.`, `Long break — ${s.long} min.`)));
        get().setMode('long', true);
      } else {
        set({ cycle: next });
        if (announceIt)
          notify(tr(L('Сесията приключи', 'Session complete')), tr(L(`Почивка — ${s.break} мин.`, `Break — ${s.break} min.`)));
        get().setMode('break', true);
      }
    } else {
      if (announceIt)
        notify(tr(L('Почивката свърши', 'Break over')), tr(L(`Работа — ${s.work} мин.`, `Focus — ${s.work} min.`)));
      get().setMode('work', true);
    }
  };

  /** The clock reached zero: the whole block was sat through. */
  const finish = () => roll(useSettings.getState().timer[get().mode]);

  /**
   * A focus block always lands in the statistics, tagged with the document
   * that was open and the subject that document belongs to — that is what
   * makes "time per subject" possible without asking the user anything.
   */
  const logSession = async (minutes: number) => {
    const { activeTaskIds } = get();
    const docId = useViewer.getState().docId ?? useNotes.getState().docId;
    const doc = useLibrary.getState().documents.find((d) => d.id === docId);
    const items = usePlanner.getState().items;
    const tasks = activeTaskIds
      .map((id) => items.find((i) => i.id === id))
      .filter((x): x is NonNullable<typeof x> => !!x);

    // One session record, tagged with the first entry: the statistics ask
    // "how long on this" and a block counted once per selected task would
    // answer with three times the minutes that were actually spent.
    const session: FocusSession = {
      id: uid('fs_'),
      day: dayKey(),
      startedAt: Date.now() - minutes * 60_000,
      minutes,
      docId,
      taskId: tasks[0]?.id ?? null,
      subjectId: doc?.subjectId ?? tasks[0]?.subjectId ?? null,
    };
    await repo.putSession(session);
    // The summary is only staged when the focus surface is actually on
    // screen. Staging it always would mean a person who finished a block
    // while reading the calendar walks into a stale "session complete" the
    // next time they open the timer.
    const watching = get().view === 'full' || useApp.getState().view === 'focus';
    set((st) => ({
      sessions: [...st.sessions, session],
      lastSession: watching ? { minutes, at: Date.now(), taskIds: tasks.map((x) => x.id) } : null,
    }));
    // The block count on each entry is a different question — "how many
    // sittings did this take" — so every selected one gets its tally.
    for (const task of tasks) await usePlanner.getState().addPomodoro(task.id);
    // Minutes just moved: goals, XP and achievements all want another look.
    announceProgress();
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
    lastSession: null,

    async init() {
      const sessions = await repo.listSessions();
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
          /** the shape written before a block could be spent on several entries */
          activeTaskId?: string | null;
          activeTaskIds?: string[];
          endAt: number;
        };
        set({
          mode: r.mode,
          cycle: r.cycle,
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
      // Full screen only if it was asked for. Pressing play used to take over
      // the whole window, which is a thing a timer should offer rather than
      // do — the focus screen has a button for it.
      if (s.timer.fullscreenOnStart) get().setView('full');
      // The floating pill is for people who are somewhere else in the app. On
      // the focus screen the clock is already the size of the window.
      else if (get().view === 'hidden' && useApp.getState().view !== 'focus') get().setView('mini');
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
      // Only what was sat through. See `roll`.
      void roll(get().mode === 'work' ? spentMinutes() : 0, false);
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

    setDuration(mode, minutes) {
      const bounds: Record<TimerMode, [number, number]> = { work: [5, 180], break: [1, 60], long: [5, 90] };
      const [min, max] = bounds[mode];
      useSettings.getState().setTimer({ [mode]: Math.min(max, Math.max(min, Math.round(minutes))) });
      // A length changed under a running clock is the next block's length, not
      // this one's: rewriting `left` mid-session would erase minutes already
      // sat through, or invent ones that were not.
      if (get().mode === mode) get().syncDuration();
    },

    setView(view) {
      // Leaving the timer altogether drops the summary; shrinking from full
      // screen to the focus screen does not, because it is the same session
      // still being looked at.
      set({ view, lastSession: view === 'hidden' ? null : get().lastSession });
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

    setActiveTask(id) {
      set({ activeTaskIds: id ? [id] : [] });
      saveRuntime();
    },

    toggleTask(id) {
      const list = get().activeTaskIds;
      set({ activeTaskIds: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
      saveRuntime();
    },

    clearTasks() {
      set({ activeTaskIds: [] });
      saveRuntime();
    },

    async stop() {
      const { mode, running } = get();
      const spent = spentMinutes();
      stopTicker();
      set({ running: false, left: duration(mode) });
      void keepAwake(false);
      saveRuntime();
      if (mode === 'work' && spent >= 1) {
        await logSession(spent);
        if (useSettings.getState().timer.sound && running) chime(true);
      }
    },

    clearLast() {
      set({ lastSession: null });
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
  // Recomputed rather than snapshotted: a title captured at start-up is the
  // one the shell happened to ship with. `currentTabTitle` knows both halves
  // of the answer — the screen that is open, or the address if none is.
  const restore = () => currentTabTitle(currentLang());
  const unsub = useTimer.subscribe((s) => {
    document.title = s.running ? `${formatClock(s.left)} · ${tr(MODE_LABEL[s.mode])}` : restore();
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
    document.title = restore();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
