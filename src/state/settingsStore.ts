import { create } from 'zustand';
import type { AppSettings, ToolId, ToolSettings } from '@/types';
import { DEFAULT_DASHBOARD } from '@/components/dashboard/dashboardDefaults';

const KEY = 'studypdf.settings.v1';

export const DEFAULT_PRESETS: Record<string, ToolSettings> = {
  pen: { color: '#1d4ed8', size: 2.2, opacity: 1 },
  highlighter: { color: '#fde047', size: 16, opacity: 0.38 },
  line: { color: '#dc2626', size: 2, opacity: 1 },
  rect: { color: '#dc2626', size: 2, opacity: 1 },
  ellipse: { color: '#dc2626', size: 2, opacity: 1 },
  arrow: { color: '#dc2626', size: 2, opacity: 1 },
  text: { color: '#111827', size: 14, opacity: 1 },
  region: { color: '#94a3b8', size: 1.5, opacity: 1 },
};

const DEFAULTS: AppSettings = {
  theme: 'system',
  accent: 'brand',
  typeScale: 1,
  motion: 'system',
  highContrast: false,
  pdfDarkMode: 'off',
  stylusOnly: false,
  shapeRecognition: false,
  eraserMode: 'partial',
  eraserSize: 14,
  showThumbnails: true,
  pressureSensitivity: true,
  toolPresets: DEFAULT_PRESETS,
  textFont: 'sans',
  textAlign: 'left',
  textBold: false,
  textItalic: false,
  lastTool: 'pen',
  /** the document open right now, so a reload lands back on it — cleared on close */
  lastDocId: null,
  boardTemplate: 'lined',
  boardFlow: 'paged',
  timer: {
    work: 25,
    break: 5,
    long: 15,
    cycles: 4,
    goal: 120,
    autoStart: true,
    sound: true,
    notify: false,
    fullscreenOnStart: false,
  },
  timerVisible: false,
  // Right-hand side but well clear of the bottom corner, which now belongs
  // to the create button. A widget that opens on top of the most-pressed
  // control in the app is a widget people close before they ever use it.
  timerPos: { x: 0.97, y: 0.58 },
  driveView: 'grid',
  driveSort: 'recent',
  gradeScale: { min: 2, max: 6, pass: 3 },
  railMode: 'expanded',
  dayCapacity: 240,
  dashboard: DEFAULT_DASHBOARD,
  reminders: {
    enabled: false,
    lead: 0,
    digest: true,
    digestAt: '18:00',
    dueTimes: true,
  },
};

/** Everything in AppSettings is persisted; listing the keys keeps the
 *  serialised blob stable even if the store grows derived helpers. */
const PERSISTED_KEYS = Object.keys(DEFAULTS) as (keyof AppSettings)[];

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings> & { railCollapsed?: boolean };
    return {
      ...DEFAULTS,
      ...parsed,
      // `railCollapsed: true` meant "narrow, and open it when I point at it",
      // which is exactly what `hover` means now.
      railMode: parsed.railMode ?? (parsed.railCollapsed ? 'hover' : 'expanded'),
      toolPresets: { ...DEFAULT_PRESETS, ...(parsed.toolPresets ?? {}) },
      timer: { ...DEFAULTS.timer, ...(parsed.timer ?? {}) },
      timerPos: { ...DEFAULTS.timerPos, ...(parsed.timerPos ?? {}) },
      gradeScale: { ...DEFAULTS.gradeScale, ...(parsed.gradeScale ?? {}) },
      reminders: { ...DEFAULTS.reminders, ...(parsed.reminders ?? {}) },
      // A layout saved before a panel existed, or after one was retired, is
      // still a valid layout — unknown ids are simply dropped at render.
      dashboard: Array.isArray(parsed.dashboard) && parsed.dashboard.length
        ? parsed.dashboard
        : DEFAULTS.dashboard,
    };
  } catch {
    return DEFAULTS;
  }
}

interface SettingsStore extends AppSettings {
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
  setPreset(tool: ToolId, patch: Partial<ToolSettings>): void;
  setTimer(patch: Partial<AppSettings['timer']>): void;
  setReminders(patch: Partial<AppSettings['reminders']>): void;
  preset(tool: ToolId): ToolSettings;
  reset(): void;
}

/**
 * Small, synchronous preferences store. Kept in localStorage (not IndexedDB)
 * so the theme is known before the first paint — no flash of the wrong theme.
 */
export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  set(key, value) {
    set({ [key]: value } as Pick<AppSettings, typeof key>);
    persist(get());
  },
  setPreset(tool, patch) {
    const presets = { ...get().toolPresets };
    presets[tool] = { ...(presets[tool] ?? DEFAULT_PRESETS.pen), ...patch };
    set({ toolPresets: presets });
    persist(get());
  },
  setTimer(patch) {
    set({ timer: { ...get().timer, ...patch } });
    persist(get());
  },
  setReminders(patch) {
    set({ reminders: { ...get().reminders, ...patch } });
    persist(get());
  },
  preset(tool) {
    return get().toolPresets[tool] ?? DEFAULT_PRESETS.pen;
  },
  reset() {
    set({ ...DEFAULTS });
    persist(get());
  },
}));

function persist(s: AppSettings) {
  const out: Record<string, unknown> = {};
  for (const k of PERSISTED_KEYS) out[k] = s[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* private mode / quota — settings are not critical */
  }
}

/**
 * Puts every appearance preference onto <html> and keeps them in step with the
 * operating system.
 *
 * All of them are attributes rather than classes because the stylesheet reads
 * them as selectors — `[data-theme]`, `[data-accent]`, `[data-motion]`,
 * `[data-contrast]` — which means a preference changes the tokens and nothing
 * has to re-render to notice.
 */
export function initTheme(): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const { theme, accent, motion, highContrast, typeScale } = useSettings.getState();
    const root = document.documentElement;
    const dark = theme === 'dark' || (theme === 'system' && mq.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';

    // The default accent is the brand, and the brand is what the bare tokens
    // already say — so it gets no attribute at all rather than an override
    // that restates them.
    if (accent === 'brand') delete root.dataset.accent;
    else root.dataset.accent = accent;

    if (motion === 'system') delete root.dataset.motion;
    else root.dataset.motion = motion;

    if (highContrast) root.dataset.contrast = 'high';
    else delete root.dataset.contrast;

    root.style.setProperty('--type-scale', String(typeScale));
  };
  apply();
  mq.addEventListener('change', apply);
  const unsub = useSettings.subscribe(apply);
  return () => {
    mq.removeEventListener('change', apply);
    unsub();
  };
}
