import { create } from 'zustand';
import type { GridOverlay, InstrumentId, InstrumentState } from '@/types';

const KEY = 'studypdf.instruments.v1';

/** How close the stylus has to come before the edge takes over, in px. */
export const SNAP_RANGE = 26;

const DEFAULTS: Record<InstrumentId, InstrumentState> = {
  ruler: { x: 0.5, y: 0.55, angle: 0, size: 520, on: false, snap: true },
  protractor: { x: 0.5, y: 0.6, angle: 0, size: 190, on: false, snap: true },
  setsquare: { x: 0.45, y: 0.55, angle: 0, size: 260, on: false, snap: true, variant: 45 },
  compass: { x: 0.5, y: 0.5, angle: 0, size: 140, on: false, snap: true },
};

export interface InstrumentStore {
  ruler: InstrumentState;
  protractor: InstrumentState;
  setsquare: InstrumentState;
  compass: InstrumentState;
  grid: GridOverlay;
  /** grid spacing in px at zoom 1 */
  gridSize: number;
  /** degrees between rays of the polar grid */
  gridStep: number;
  /** ink also snaps to the grid lines, not only to the instruments */
  gridSnap: boolean;

  toggle(id: InstrumentId): void;
  set(id: InstrumentId, patch: Partial<InstrumentState>): void;
  setGrid(grid: GridOverlay): void;
  setGridSize(px: number): void;
  setGridStep(deg: number): void;
  setGridSnap(on: boolean): void;
  hideAll(): void;
  anyOn(): boolean;
}

interface Persisted {
  ruler: InstrumentState;
  protractor: InstrumentState;
  setsquare: InstrumentState;
  compass: InstrumentState;
  grid: GridOverlay;
  gridSize: number;
  gridStep: number;
  gridSnap: boolean;
}

function load(): Persisted {
  const base: Persisted = {
    ...structuredClone(DEFAULTS),
    grid: 'off',
    gridSize: 32,
    gridStep: 15,
    gridSnap: false,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...base,
      ...saved,
      ruler: { ...base.ruler, ...saved.ruler },
      protractor: { ...base.protractor, ...saved.protractor },
      setsquare: { ...base.setsquare, ...saved.setsquare },
      compass: { ...base.compass, ...saved.compass },
    };
  } catch {
    return base;
  }
}

export const useInstruments = create<InstrumentStore>((set, get) => ({
  ...load(),

  toggle(id) {
    set({ [id]: { ...get()[id], on: !get()[id].on } } as Pick<InstrumentStore, InstrumentId>);
    persist(get());
  },
  set(id, patch) {
    set({ [id]: { ...get()[id], ...patch } } as Pick<InstrumentStore, InstrumentId>);
    persist(get());
  },
  setGrid(grid) {
    set({ grid });
    persist(get());
  },
  setGridSize(px) {
    set({ gridSize: px });
    persist(get());
  },
  setGridStep(deg) {
    set({ gridStep: deg });
    persist(get());
  },
  setGridSnap(on) {
    set({ gridSnap: on });
    persist(get());
  },
  hideAll() {
    const s = get();
    set({
      ruler: { ...s.ruler, on: false },
      protractor: { ...s.protractor, on: false },
      setsquare: { ...s.setsquare, on: false },
      compass: { ...s.compass, on: false },
    });
    persist(get());
  },
  anyOn() {
    const s = get();
    return s.ruler.on || s.protractor.on || s.setsquare.on || s.compass.on;
  },
}));

function persist(s: InstrumentStore) {
  try {
    const out: Persisted = {
      ruler: s.ruler,
      protractor: s.protractor,
      setsquare: s.setsquare,
      compass: s.compass,
      grid: s.grid,
      gridSize: s.gridSize,
      gridStep: s.gridStep,
      gridSnap: s.gridSnap,
    };
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* private mode */
  }
}

/* ------------------------------------------------------------------ area */

/**
 * The rectangle the instruments float over, in viewport coordinates.
 *
 * The drawing layer needs it on every stylus sample and the overlay component
 * is the only thing that knows it, so it is published here rather than passed
 * down through half the tree.
 */
let area: DOMRect | null = null;

export const setInstrumentArea = (rect: DOMRect | null): void => {
  area = rect;
};
export const instrumentArea = (): DOMRect | null => area;

/* ------------------------------------------------------------- geometry */

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Instrument position in viewport px, given the area it floats over. */
export function centreOf(state: InstrumentState, area: DOMRect): { cx: number; cy: number } {
  return { cx: area.left + state.x * area.width, cy: area.top + state.y * area.height };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The straight edges ink can run along, in viewport px. */
export function edgesOf(
  id: InstrumentId,
  state: InstrumentState,
  area: DOMRect,
): { segments: Segment[]; circles: { cx: number; cy: number; r: number }[] } {
  const { cx, cy } = centreOf(state, area);
  const a = rad(state.angle);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  /** local (right, down) offsets rotated into viewport space */
  const P = (dx: number, dy: number): [number, number] => [
    cx + dx * cos - dy * sin,
    cy + dx * sin + dy * cos,
  ];

  if (id === 'ruler') {
    const half = state.size / 2;
    const h = RULER_HEIGHT / 2;
    const [ax, ay] = P(-half, h);
    const [bx, by] = P(half, h);
    const [tx, ty] = P(-half, -h);
    const [ux, uy] = P(half, -h);
    // Both long edges rule, exactly like the plastic one.
    return { segments: [{ x1: ax, y1: ay, x2: bx, y2: by }, { x1: tx, y1: ty, x2: ux, y2: uy }], circles: [] };
  }

  if (id === 'protractor') {
    const r = state.size;
    const [ax, ay] = P(-r, 0);
    const [bx, by] = P(r, 0);
    return {
      segments: [{ x1: ax, y1: ay, x2: bx, y2: by }],
      circles: [{ cx, cy, r }],
    };
  }

  if (id === 'setsquare') {
    const s = state.size;
    // right angle at the origin corner; the other leg follows the variant
    const other = state.variant === 30 ? s * Math.tan(rad(30)) : s;
    const [ox, oy] = P(-s / 2, other / 2);
    const [hx, hy] = P(s / 2, other / 2);
    const [vx, vy] = P(-s / 2, -other / 2);
    return {
      segments: [
        { x1: ox, y1: oy, x2: hx, y2: hy },
        { x1: ox, y1: oy, x2: vx, y2: vy },
        { x1: vx, y1: vy, x2: hx, y2: hy },
      ],
      circles: [],
    };
  }

  // compass: only the circle it describes
  return { segments: [], circles: [{ cx, cy, r: state.size }] };
}

export const RULER_HEIGHT = 58;

/** Foot of the perpendicular from p onto the segment, clamped to its ends. */
function projectOnSegment(px: number, py: number, s: Segment) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  if (!len2) return { x: s.x1, y: s.y1, d: Math.hypot(px - s.x1, py - s.y1) };
  let t = ((px - s.x1) * dx + (py - s.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = s.x1 + t * dx;
  const y = s.y1 + t * dy;
  return { x, y, d: Math.hypot(px - x, py - y) };
}

/**
 * What a stroke is currently running along.
 *
 * A real ruler does not let the pen wander off halfway through a line: once
 * the nib is against the edge it stays there until you lift it. So the first
 * point that comes within range locks the whole gesture onto that edge, and
 * everything after it is projected — which is the difference between "a
 * mostly straight line" and a straight line.
 */
export type SnapTarget =
  | { kind: 'segment'; segment: Segment }
  | { kind: 'circle'; circle: { cx: number; cy: number; r: number } }
  | { kind: 'grid' };

/** The instrument edge nearest to a point, if one is close enough. */
export function findSnapTarget(px: number, py: number, area: DOMRect): SnapTarget | null {
  const s = useInstruments.getState();
  let best: { target: SnapTarget; d: number } | null = null;

  for (const id of ['ruler', 'protractor', 'setsquare', 'compass'] as InstrumentId[]) {
    const state = s[id];
    if (!state.on || !state.snap) continue;
    const { segments, circles } = edgesOf(id, state, area);
    for (const segment of segments) {
      const hit = projectOnSegment(px, py, segment);
      if (hit.d <= SNAP_RANGE && (!best || hit.d < best.d)) {
        best = { target: { kind: 'segment', segment }, d: hit.d };
      }
    }
    for (const circle of circles) {
      const dist = Math.hypot(px - circle.cx, py - circle.cy);
      if (dist < 1) continue;
      const d = Math.abs(dist - circle.r);
      if (d <= SNAP_RANGE && (!best || d < best.d)) best = { target: { kind: 'circle', circle }, d };
    }
  }

  if (best) return best.target;
  if (s.gridSnap && s.grid !== 'off' && snapToGrid(px, py, area, s)) return { kind: 'grid' };
  return null;
}

/** Projects a point onto an already-chosen target. */
export function applySnapTarget(
  target: SnapTarget,
  px: number,
  py: number,
  area: DOMRect,
): { x: number; y: number } {
  if (target.kind === 'segment') {
    const hit = projectOnSegment(px, py, target.segment);
    return { x: hit.x, y: hit.y };
  }
  if (target.kind === 'circle') {
    const { cx, cy, r } = target.circle;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < 1) return { x: cx + r, y: cy };
    return { x: cx + ((px - cx) / dist) * r, y: cy + ((py - cy) / dist) * r };
  }
  return snapToGrid(px, py, area, useInstruments.getState()) ?? { x: px, y: py };
}

/** The nearest grid line or dot, when the grid is set to guide the ink. */
function snapToGrid(px: number, py: number, area: DOMRect, s: InstrumentStore): { x: number; y: number } | null {
  const step = s.gridSize;
  const ox = area.left;
  const oy = area.top;

  if (s.grid === 'square' || s.grid === 'dots') {
    const x = ox + Math.round((px - ox) / step) * step;
    const y = oy + Math.round((py - oy) / step) * step;
    return Math.hypot(px - x, py - y) <= SNAP_RANGE ? { x, y } : null;
  }

  if (s.grid === 'iso') {
    // three families of lines at 0°, 60° and 120°
    const best = [0, 60, 120]
      .map((degrees) => {
        const a = rad(degrees);
        const nx = -Math.sin(a);
        const ny = Math.cos(a);
        const dist = (px - ox) * nx + (py - oy) * ny;
        const k = Math.round(dist / step) * step;
        return { x: px - (dist - k) * nx, y: py - (dist - k) * ny, d: Math.abs(dist - k) };
      })
      .sort((p, q) => p.d - q.d)[0];
    return best.d <= SNAP_RANGE ? { x: best.x, y: best.y } : null;
  }

  // polar: hold the pen on the nearest ray out of the centre
  const cx = area.left + area.width / 2;
  const cy = area.top + area.height / 2;
  const dist = Math.hypot(px - cx, py - cy);
  if (dist < 1) return null;
  const angle = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
  const snapped = Math.round(angle / s.gridStep) * s.gridStep;
  const point = { x: cx + dist * Math.cos(rad(snapped)), y: cy + dist * Math.sin(rad(snapped)) };
  return Math.hypot(px - point.x, py - point.y) <= SNAP_RANGE ? point : null;
}

/** True when something is guiding the ink right now. */
export function snappingActive(): boolean {
  const s = useInstruments.getState();
  return (
    (s.ruler.on && s.ruler.snap) ||
    (s.protractor.on && s.protractor.snap) ||
    (s.setsquare.on && s.setsquare.snap) ||
    (s.compass.on && s.compass.snap) ||
    (s.gridSnap && s.grid !== 'off')
  );
}
