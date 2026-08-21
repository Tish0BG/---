import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { InstrumentId, InstrumentState } from '@/types';
import {
  RULER_HEIGHT,
  centreOf,
  setInstrumentArea,
  useInstruments,
} from '@/state/instrumentStore';
import { useViewer } from '@/state/viewerStore';
import { useSettings } from '@/state/settingsStore';
import { clamp, uid } from '@/lib/util';
import { GridOverlayLayer } from './GridOverlay';
import { Icon } from '../Icon';

/**
 * The drawing instruments, laid on the page the way the plastic ones are laid
 * on a sheet of paper: drag them where you need them, turn them to the angle
 * you want, then draw along the edge and the ink follows it exactly.
 *
 * They live in screen space rather than page space on purpose. A ruler is a
 * physical object on top of the work, not part of it — it should not zoom
 * away when the page does, and one ruler serves every page you scroll past.
 */
export function InstrumentLayer() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);
  const ruler = useInstruments((s) => s.ruler);
  const protractor = useInstruments((s) => s.protractor);
  const setsquare = useInstruments((s) => s.setsquare);
  const compass = useInstruments((s) => s.compass);
  const grid = useInstruments((s) => s.grid);

  /* publish the area so the drawing layer can snap against it */
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      setInstrumentArea(el.getBoundingClientRect());
      force((n) => n + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      setInstrumentArea(null);
    };
  }, []);

  const rect = boxRef.current?.getBoundingClientRect() ?? null;

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {grid !== 'off' && <GridOverlayLayer />}
      {rect && ruler.on && <Ruler id="ruler" state={ruler} area={rect} />}
      {rect && setsquare.on && <SetSquare id="setsquare" state={setsquare} area={rect} />}
      {rect && protractor.on && <Protractor id="protractor" state={protractor} area={rect} />}
      {rect && compass.on && <Compass id="compass" state={compass} area={rect} />}
    </div>
  );
}

/**
 * Viewport → layer coordinates.
 *
 * Everything geometric (rotation, snapping, pointer maths) works in viewport
 * space because that is what pointer events speak. The overlay itself is
 * `inset-0` inside the reading area, so anything drawn has to be shifted back
 * by the area's own offset — forgetting this puts every instrument twice as
 * far right as it should be.
 */
const local = (vx: number, vy: number, area: DOMRect) => ({ x: vx - area.left, y: vy - area.top });

/* --------------------------------------------------------------- dragging */

interface DragApi {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

/** Move on drag; the same handler serves all four instruments. */
function useMove(id: InstrumentId, state: InstrumentState, area: DOMRect): DragApi {
  const from = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  return {
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      from.current = { x: e.clientX, y: e.clientY, sx: state.x, sy: state.y };
    },
    onPointerMove: (e) => {
      const f = from.current;
      if (!f) return;
      useInstruments.getState().set(id, {
        x: clamp(f.sx + (e.clientX - f.x) / area.width, -0.1, 1.1),
        y: clamp(f.sy + (e.clientY - f.y) / area.height, -0.1, 1.1),
      });
    },
    onPointerUp: () => {
      from.current = null;
    },
  };
}

/** Rotate around the instrument's own centre, with a soft pull to 15° steps. */
function useRotate(id: InstrumentId, state: InstrumentState, area: DOMRect): DragApi {
  const active = useRef(false);
  return {
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      active.current = true;
    },
    onPointerMove: (e) => {
      if (!active.current) return;
      const { cx, cy } = centreOf(state, area);
      let deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      const nearest = Math.round(deg / 15) * 15;
      if (Math.abs(deg - nearest) < 2.5) deg = nearest;
      useInstruments.getState().set(id, { angle: Math.round(deg * 10) / 10 });
    },
    onPointerUp: () => {
      active.current = false;
    },
  };
}

function useResize(id: InstrumentId, state: InstrumentState, area: DOMRect, min: number, max: number): DragApi {
  const active = useRef(false);
  return {
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      active.current = true;
    },
    onPointerMove: (e) => {
      if (!active.current) return;
      const { cx, cy } = centreOf(state, area);
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      useInstruments.getState().set(id, { size: clamp(Math.round(dist * (id === 'ruler' ? 2 : 1)), min, max) });
    },
    onPointerUp: () => {
      active.current = false;
    },
  };
}

/* ---------------------------------------------------------------- pieces */

/**
 * The instruments always lie on the page, and the page is white in every
 * theme. So they keep their own palette instead of following the app's:
 * smoked plastic with dark engraving, exactly like the ones in a pencil case.
 */
const INK = '#0f172a';
const BODY = 'rgb(203 213 225 / 42%)';
const EDGE = 'rgb(51 65 85 / 55%)';

/** Shared chrome: angle read-out, snap switch and a way to put it away. */
function Controls({
  id,
  state,
  label,
  extra,
}: {
  id: InstrumentId;
  state: InstrumentState;
  label: string;
  extra?: React.ReactNode;
}) {
  return (
    <div
      className="panel pointer-events-auto flex items-center gap-1 rounded-full px-1.5 py-1"
      style={{ boxShadow: 'var(--shadow-float)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="px-1 text-[10.5px] text-muted">{label}</span>
      <input
        type="number"
        value={Math.round(state.angle * 10) / 10}
        onChange={(e) => useInstruments.getState().set(id, { angle: Number(e.target.value) || 0 })}
        onKeyDown={(e) => e.stopPropagation()}
        className="h-6 w-12 rounded bg-transparent px-1 text-right text-[11px] tabular-nums outline-none"
        style={{ border: '1px solid var(--c-line)' }}
        step={0.5}
        aria-label="Ъгъл"
      />
      <span className="text-[10.5px] text-faint">°</span>
      {extra}
      <button
        className={`icon-btn h-6 w-6 ${state.snap ? 'btn-ghost-active' : ''}`}
        title={state.snap ? 'Мастилото следва ръба' : 'Свободно писане'}
        onClick={() => useInstruments.getState().set(id, { snap: !state.snap })}
      >
        <Icon name="magnet" size={13} />
      </button>
      <button
        className="icon-btn h-6 w-6"
        title="Прибери"
        onClick={() => useInstruments.getState().set(id, { on: false })}
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

function Handle({
  cx,
  cy,
  icon,
  api,
  title,
}: {
  cx: number;
  cy: number;
  icon: string;
  api: DragApi;
  title: string;
}) {
  return (
    <div
      className="pointer-events-auto absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full active:cursor-grabbing"
      style={{
        left: cx,
        top: cy,
        background: 'var(--c-surface)',
        border: '1px solid var(--c-line-strong)',
        boxShadow: 'var(--shadow-panel)',
        touchAction: 'none',
        color: 'var(--c-muted)',
      }}
      title={title}
      {...api}
    >
      <Icon name={icon} size={13} />
    </div>
  );
}

/* ---------------------------------------------------------------- ruler */

function Ruler({ id, state, area }: { id: InstrumentId; state: InstrumentState; area: DOMRect }) {
  const move = useMove(id, state, area);
  const rotate = useRotate(id, state, area);
  const resize = useResize(id, state, area, 200, 1400);
  const zoom = useViewer((s) => s.zoom);
  const { cx, cy } = centreOf(state, area);
  const w = state.size;
  const h = RULER_HEIGHT;

  /** One centimetre of the document, in screen pixels. */
  const cmPx = 28.3465 * zoom;
  const ticks = useTicks(w, cmPx);
  const a = (state.angle * Math.PI) / 180;
  const handleAt = (dx: number, dy: number) => ({
    x: cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: cy + dx * Math.sin(a) + dy * Math.cos(a),
  });
  const rot = handleAt(0, -h / 2 - 26);
  const grow = handleAt(w / 2 + 20, 0);
  const rotateHandle = local(rot.x, rot.y, area);
  const resizeHandle = local(grow.x, grow.y, area);
  const c = local(cx, cy, area);

  return (
    <>
      <div
        className="pointer-events-auto absolute cursor-move"
        style={{
          left: c.x - w / 2,
          top: c.y - h / 2,
          width: w,
          height: h,
          transform: `rotate(${state.angle}deg)`,
          transformOrigin: 'center',
          touchAction: 'none',
          backdropFilter: 'blur(0.5px) saturate(0.9)',
        }}
        {...move}
      >
        <svg width={w} height={h} className="block overflow-visible">
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            rx={5}
            fill={BODY}
            stroke={EDGE}
            strokeWidth={1}
          />
          {ticks.map((t) => (
            <g key={t.px}>
              <line
                x1={t.px}
                y1={h}
                x2={t.px}
                y2={h - (t.major ? 13 : t.mid ? 8 : 5)}
                stroke={INK}
                strokeWidth={t.major ? 1.1 : 0.7}
                opacity={t.major ? 0.75 : 0.45}
              />
              <line
                x1={t.px}
                y1={0}
                x2={t.px}
                y2={t.major ? 13 : t.mid ? 8 : 5}
                stroke={INK}
                strokeWidth={t.major ? 1.1 : 0.7}
                opacity={t.major ? 0.75 : 0.45}
              />
              {t.major && t.label !== 0 && (
                <text
                  x={t.px + 2}
                  y={h / 2 + 3.5}
                  fontSize={9}
                  fill={INK}
                  opacity={0.7}
                  style={{ userSelect: 'none' }}
                >
                  {t.label}
                </text>
              )}
            </g>
          ))}
          <text x={6} y={h / 2 + 3.5} fontSize={8.5} fill={INK} opacity={0.45}>
            cm
          </text>
        </svg>
      </div>

      <Handle cx={rotateHandle.x} cy={rotateHandle.y} icon="refresh" api={rotate} title="Завърти" />
      <Handle cx={resizeHandle.x} cy={resizeHandle.y} icon="chevronsRight" api={resize} title="Дължина" />
      <div
        className="pointer-events-none absolute -translate-x-1/2"
        style={{ left: c.x, top: c.y + h / 2 + 34 }}
      >
        <Controls id={id} state={state} label="Линийка" />
      </div>
    </>
  );
}

/** Millimetre ticks, with every centimetre numbered. */
function useTicks(width: number, cmPx: number) {
  return useCallback(() => {
    const out: { px: number; major: boolean; mid: boolean; label: number }[] = [];
    const mm = cmPx / 10;
    if (mm < 1.5) return out;
    const count = Math.floor(width / mm);
    for (let i = 0; i <= count; i++) {
      out.push({ px: i * mm, major: i % 10 === 0, mid: i % 5 === 0, label: i / 10 });
    }
    return out;
  }, [width, cmPx])();
}

/* ----------------------------------------------------------- protractor */

function Protractor({ id, state, area }: { id: InstrumentId; state: InstrumentState; area: DOMRect }) {
  const move = useMove(id, state, area);
  const rotate = useRotate(id, state, area);
  const resize = useResize(id, state, area, 110, 460);
  const { cx, cy } = centreOf(state, area);
  const r = state.size;
  const pad = 16;
  const size = (r + pad) * 2;

  const a = (state.angle * Math.PI) / 180;
  const handleAt = (dx: number, dy: number) => ({
    x: cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: cy + dx * Math.sin(a) + dy * Math.cos(a),
  });
  const rot = handleAt(0, 46);
  const grow = handleAt(r + 18, 0);
  const rotateHandle = local(rot.x, rot.y, area);
  const resizeHandle = local(grow.x, grow.y, area);
  const c = local(cx, cy, area);

  const ticks: React.ReactNode[] = [];
  for (let deg = 0; deg <= 180; deg += 1) {
    const major = deg % 10 === 0;
    const mid = deg % 5 === 0;
    const len = major ? 13 : mid ? 8 : 4.5;
    const t = (Math.PI * (180 - deg)) / 180;
    const x1 = r + pad + r * Math.cos(t);
    const y1 = r + pad - r * Math.sin(t);
    const x2 = r + pad + (r - len) * Math.cos(t);
    const y2 = r + pad - (r - len) * Math.sin(t);
    ticks.push(
      <line
        key={deg}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={INK}
        strokeWidth={major ? 1.1 : 0.6}
        opacity={major ? 0.75 : 0.4}
      />,
    );
    if (major && r > 120) {
      const lx = r + pad + (r - 22) * Math.cos(t);
      const ly = r + pad - (r - 22) * Math.sin(t);
      ticks.push(
        <text
          key={`l${deg}`}
          x={lx}
          y={ly + 3}
          fontSize={r > 200 ? 9 : 7.5}
          textAnchor="middle"
          fill={INK}
          opacity={0.7}
          style={{ userSelect: 'none' }}
        >
          {deg}
        </text>,
      );
    }
  }

  return (
    <>
      <div
        className="pointer-events-auto absolute cursor-move"
        style={{
          left: c.x - size / 2,
          top: c.y - size / 2,
          width: size,
          height: size,
          transform: `rotate(${state.angle}deg)`,
          transformOrigin: 'center',
          touchAction: 'none',
        }}
        {...move}
      >
        <svg width={size} height={size} className="block overflow-visible">
          <path
            d={`M ${pad} ${r + pad} A ${r} ${r} 0 0 1 ${r * 2 + pad} ${r + pad} Z`}
            fill={BODY}
            stroke={EDGE}
            strokeWidth={1}
          />
          {ticks}
          <line
            x1={pad}
            y1={r + pad}
            x2={r * 2 + pad}
            y2={r + pad}
            stroke={INK}
            strokeWidth={1.1}
            opacity={0.7}
          />
          <line x1={r + pad} y1={r + pad - 8} x2={r + pad} y2={r + pad + 8} stroke={INK} opacity={0.7} />
          <circle cx={r + pad} cy={r + pad} r={2.5} fill={INK} opacity={0.7} />
        </svg>
      </div>

      <Handle cx={rotateHandle.x} cy={rotateHandle.y} icon="refresh" api={rotate} title="Завърти" />
      <Handle cx={resizeHandle.x} cy={resizeHandle.y} icon="chevronsRight" api={resize} title="Размер" />
      <div className="pointer-events-none absolute -translate-x-1/2" style={{ left: c.x, top: c.y + 74 }}>
        <Controls id={id} state={state} label="Транспортир" />
      </div>
    </>
  );
}

/* ------------------------------------------------------------ set square */

function SetSquare({ id, state, area }: { id: InstrumentId; state: InstrumentState; area: DOMRect }) {
  const move = useMove(id, state, area);
  const rotate = useRotate(id, state, area);
  const resize = useResize(id, state, area, 140, 620);
  const { cx, cy } = centreOf(state, area);
  const s = state.size;
  const other = state.variant === 30 ? s * Math.tan(Math.PI / 6) : s;
  const w = s;
  const h = other;

  const a = (state.angle * Math.PI) / 180;
  const handleAt = (dx: number, dy: number) => ({
    x: cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: cy + dx * Math.sin(a) + dy * Math.cos(a),
  });
  const rot = handleAt(0, h / 2 + 26);
  const grow = handleAt(w / 2 + 20, h / 2 + 4);
  const rotateHandle = local(rot.x, rot.y, area);
  const resizeHandle = local(grow.x, grow.y, area);
  const c = local(cx, cy, area);

  const angles = state.variant === 30 ? ['90°', '30°', '60°'] : ['90°', '45°', '45°'];

  return (
    <>
      <div
        className="pointer-events-auto absolute cursor-move"
        style={{
          left: c.x - w / 2,
          top: c.y - h / 2,
          width: w,
          height: h,
          transform: `rotate(${state.angle}deg)`,
          transformOrigin: 'center',
          touchAction: 'none',
        }}
        {...move}
      >
        <svg width={w} height={h} className="block overflow-visible">
          <polygon
            points={`0,${h} ${w},${h} 0,0`}
            fill={BODY}
            stroke={EDGE}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* the hollow middle, so the page stays readable underneath */}
          <polygon points={`26,${h - 16} ${w - 34},${h - 16} 26,${32}`} fill="#ffffff" opacity={0.34} />
          <Ticks length={w} along="x" h={h} />
          <Ticks length={h} along="y" h={h} />
          <text x={6} y={h - 6} fontSize={8.5} fill={INK} opacity={0.65}>
            {angles[0]}
          </text>
          <text x={w - 26} y={h - 6} fontSize={8.5} fill={INK} opacity={0.65}>
            {angles[1]}
          </text>
          <text x={5} y={16} fontSize={8.5} fill={INK} opacity={0.65}>
            {angles[2]}
          </text>
        </svg>
      </div>

      <Handle cx={rotateHandle.x} cy={rotateHandle.y} icon="refresh" api={rotate} title="Завърти" />
      <Handle cx={resizeHandle.x} cy={resizeHandle.y} icon="chevronsRight" api={resize} title="Размер" />
      <div
        className="pointer-events-none absolute -translate-x-1/2"
        style={{ left: c.x, top: c.y + h / 2 + 46 }}
      >
        <Controls
          id={id}
          state={state}
          label="Триъгълник"
          extra={
            <button
              className="icon-btn h-6 w-auto px-1.5 text-[10.5px]"
              title="Смени вида"
              onClick={() =>
                useInstruments.getState().set(id, { variant: state.variant === 30 ? 45 : 30 })
              }
            >
              {state.variant === 30 ? '30·60' : '45·45'}
            </button>
          }
        />
      </div>
    </>
  );
}

function Ticks({ length, along, h }: { length: number; along: 'x' | 'y'; h: number }) {
  const step = 10;
  const out: React.ReactNode[] = [];
  for (let d = step; d < length - 4; d += step) {
    const major = Math.round(d / step) % 5 === 0;
    const size = major ? 9 : 5;
    if (along === 'x') out.push(<line key={`x${d}`} x1={d} y1={h} x2={d} y2={h - size} stroke={INK} strokeWidth={major ? 1 : 0.6} opacity={0.5} />);
    else out.push(<line key={`y${d}`} x1={0} y1={h - d} x2={size} y2={h - d} stroke={INK} strokeWidth={major ? 1 : 0.6} opacity={0.5} />);
  }
  return <>{out}</>;
}

/* -------------------------------------------------------------- compass */

function Compass({ id, state, area }: { id: InstrumentId; state: InstrumentState; area: DOMRect }) {
  const move = useMove(id, state, area);
  const { cx, cy } = centreOf(state, area);
  const r = state.size;
  const radiusDrag = useRef(false);

  const zoom = useViewer((s) => s.zoom);
  const cmPx = 28.3465 * zoom;
  const c = local(cx, cy, area);

  return (
    <>
      <div
        className="pointer-events-none absolute"
        style={{ left: c.x - r - 20, top: c.y - r - 20, width: (r + 20) * 2, height: (r + 20) * 2 }}
      >
        <svg width={(r + 20) * 2} height={(r + 20) * 2} className="block overflow-visible">
          <circle
            cx={r + 20}
            cy={r + 20}
            r={r}
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth={1.2}
            strokeDasharray="5 4"
            opacity={0.85}
          />
          <line
            x1={r + 20}
            y1={r + 20}
            x2={r * 2 + 20}
            y2={r + 20}
            stroke="var(--c-accent)"
            strokeWidth={1}
            opacity={0.45}
          />
        </svg>
      </div>

      {/* centre pin */}
      <div
        className="pointer-events-auto absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-move place-items-center rounded-full"
        style={{
          left: c.x,
          top: c.y,
          background: 'var(--c-surface)',
          border: '1px solid var(--c-accent)',
          boxShadow: 'var(--shadow-panel)',
          touchAction: 'none',
          color: 'var(--c-accent)',
        }}
        title="Център"
        {...move}
      >
        <Icon name="target" size={14} />
      </div>

      {/* radius handle */}
      <div
        className="pointer-events-auto absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full active:cursor-grabbing"
        style={{
          left: c.x + r,
          top: c.y,
          background: 'var(--c-surface)',
          border: '1px solid var(--c-line-strong)',
          boxShadow: 'var(--shadow-panel)',
          touchAction: 'none',
          color: 'var(--c-muted)',
        }}
        title="Радиус"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          radiusDrag.current = true;
        }}
        onPointerMove={(e) => {
          if (!radiusDrag.current) return;
          useInstruments
            .getState()
            .set(id, { size: clamp(Math.round(Math.hypot(e.clientX - cx, e.clientY - cy)), 16, 900) });
        }}
        onPointerUp={() => (radiusDrag.current = false)}
      >
        <Icon name="chevronsRight" size={13} />
      </div>

      <div className="pointer-events-none absolute -translate-x-1/2" style={{ left: c.x, top: c.y + r + 30 }}>
        <div
          className="panel pointer-events-auto flex items-center gap-1 rounded-full px-1.5 py-1"
          style={{ boxShadow: 'var(--shadow-float)' }}
        >
          <span className="px-1 text-[10.5px] text-muted">Пергел</span>
          <span className="text-[11px] tabular-nums">{(r / cmPx).toFixed(1)} cm</span>
          <button
            className={`icon-btn h-6 w-6 ${state.snap ? 'btn-ghost-active' : ''}`}
            title={state.snap ? 'Мастилото следва дъгата' : 'Свободно писане'}
            onClick={() => useInstruments.getState().set(id, { snap: !state.snap })}
          >
            <Icon name="magnet" size={13} />
          </button>
          <button className="icon-btn h-6 w-6" title="Начертай окръжност" onClick={() => drawCircle(cx, cy, r)}>
            <Icon name="circle" size={13} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            title="Прибери"
            onClick={() => useInstruments.getState().set(id, { on: false })}
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Commits the compass circle as a real annotation on whichever page its
 * centre sits over — the same conversion the drawing layer does, only started
 * from a button instead of a stylus.
 *
 * The page is found geometrically rather than with `elementFromPoint`: the
 * compass pin sits exactly on that point and would hand back itself.
 */
function drawCircle(cx: number, cy: number, r: number): void {
  const el = [...document.querySelectorAll<HTMLElement>('[data-page]')].find((node) => {
    const b = node.getBoundingClientRect();
    return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
  });
  if (!el) return;
  const page = Number(el.dataset.page);
  const rect = el.getBoundingClientRect();
  const store = useViewer.getState();
  const zoom = store.zoom;
  const docId = store.docId;
  if (!docId || !Number.isFinite(page)) return;
  const preset = useSettings.getState().preset('ellipse');
  const x = (cx - rect.left) / zoom;
  const y = (cy - rect.top) / zoom;
  const rr = r / zoom;
  const now = Date.now();
  store.addAnnotations([
    {
      id: uid('an_'),
      docId,
      page,
      type: 'ellipse',
      color: preset.color,
      opacity: preset.opacity,
      size: preset.size,
      x1: x - rr,
      y1: y - rr,
      x2: x + rr,
      y2: y + rr,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

export { useEffect };
