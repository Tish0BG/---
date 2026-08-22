import { useMemo, useState, type ReactNode } from 'react';

/**
 * The product's charts, drawn as inline SVG.
 *
 * No charting library: every visualisation here is bars, arcs or a polyline,
 * and 40 KB of dependency to draw eight rectangles is 40 KB the person on a
 * phone waits for. Shared rules, applied in all of them:
 *
 *   · marks are thin — bars cap at 22 px, lines at 2 px — and the leftover
 *     band width stays as air;
 *   · touching marks are separated by a 2 px gap in the surface colour, never
 *     by a stroke;
 *   · text never wears the data colour: values and labels use the ink tokens
 *     and identity comes from a swatch beside them;
 *   · everything has a hover read-out, because a number you cannot recover is
 *     decoration.
 *
 * The categorical order below is validated for colour-vision separation; the
 * seventh series and beyond fold into "Other" rather than inventing hues.
 */
export const SERIES_COLORS = [
  '#6d5ae6',
  '#0e9f6e',
  '#e5484d',
  '#0284c7',
  '#d97706',
  '#8e4ec6',
] as const;

export const OTHER_COLOR = 'var(--c-faint)';

/* ------------------------------------------------------------- tooltip */

function useHover<T>() {
  const [hot, setHot] = useState<{ item: T; x: number; y: number } | null>(null);
  return { hot, setHot };
}

function ChartTip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2 py-1.5 text-[11.5px] leading-tight shadow-[var(--shadow-float)]"
      style={{
        left: x,
        top: y - 8,
        background: 'var(--c-text)',
        color: 'var(--c-bg)',
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------- column bars */

export interface BarDatum {
  label: string;
  value: number;
  /** Marks today / the current period — drawn in the accent, not another hue. */
  current?: boolean;
  tip?: ReactNode;
}

/**
 * Activity over a fixed window: minutes per day, tasks per week.
 * One series, so no legend — the card title says what is plotted.
 */
export function BarChart({
  data,
  height = 132,
  color = 'var(--c-brand)',
  format = (v: number) => String(v),
  goal,
  goalLabel,
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
  /** Draws a hairline target line across the plot (the daily focus goal). */
  goal?: number | null;
  goalLabel?: string;
}) {
  const { hot, setHot } = useHover<BarDatum>();
  const max = Math.max(1, ...data.map((d) => d.value), goal ?? 0);
  const plot = height - 22;

  return (
    <div className="relative w-full" style={{ height }}>
      {goal ? (
        <div
          className="pointer-events-none absolute inset-x-0 flex items-center gap-1.5"
          style={{ bottom: 22 + (goal / max) * plot }}
        >
          <span className="h-px flex-1" style={{ background: 'var(--c-line-strong)' }} />
          {goalLabel && <span className="t-num text-[10px] text-faint">{goalLabel}</span>}
        </div>
      ) : null}

      <div className="flex h-full items-end gap-[2px]">
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * plot);
          const active = hot?.item === d;
          return (
            <div
              key={i}
              className="group relative flex h-full flex-1 cursor-default flex-col justify-end items-center"
              onPointerEnter={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                const host = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
                setHot({ item: d, x: box.left - host.left + box.width / 2, y: host.height - 22 - h });
              }}
              onPointerLeave={() => setHot(null)}
            >
              <span
                className="w-full rounded-t-[4px] transition-[height,background-color] duration-500"
                style={{
                  height: h,
                  maxWidth: 22,
                  background: d.current ? color : `color-mix(in srgb, ${color} 42%, var(--c-surface-3))`,
                  opacity: active ? 1 : 0.96,
                }}
              />
              <span
                className={`mt-1.5 text-[10.5px] ${d.current ? 'font-semibold text-ink' : 'text-faint'}`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      {hot && (
        <ChartTip x={hot.x} y={hot.y}>
          {hot.item.tip ?? (
            <>
              <span className="t-num font-semibold">{format(hot.item.value)}</span>
            </>
          )}
        </ChartTip>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- donut */

/** Shrinks the middle reading until it clears the ring on both sides. */
function centerFontSize(text: string, size: number, thickness: number): number {
  const room = size - thickness * 2 - 10;
  // 0.56em is about the advance width of a tabular digit in Inter.
  return Math.max(12, Math.min(22, Math.floor(room / Math.max(3, text.length * 0.56))));
}

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/**
 * Distribution across subjects. Slices are separated by a gap in the surface
 * colour, and every slice is named in the legend next to its share — the ring
 * shows the shape, the legend carries the identity.
 */
export function Donut({
  data,
  size = 148,
  thickness = 18,
  centerLabel,
  centerValue,
  format = (v: number) => String(v),
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: ReactNode;
  centerValue?: ReactNode;
  format?: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const [hot, setHot] = useState<number | null>(null);

  const arcs = useMemo(() => {
    let acc = 0;
    return data.map((d) => {
      const share = total ? d.value / total : 0;
      // 2px of surface between neighbours, taken out of the arc itself.
      const gap = total && share > 0 ? 2 : 0;
      const len = Math.max(0, c * share - gap);
      const arc = { ...d, share, offset: -acc * c, len };
      acc += share;
      return arc;
    });
  }, [data, total, c]);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={thickness} />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={hot === i ? thickness + 3 : thickness}
              strokeDasharray={`${a.len} ${c - a.len}`}
              strokeDashoffset={a.offset}
              onPointerEnter={() => setHot(i)}
              onPointerLeave={() => setHot(null)}
              style={{ transition: 'stroke-width 0.18s var(--ease)', cursor: 'default' }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-1 text-center">
          <div style={{ maxWidth: size - thickness * 2 - 8 }}>
            {/* the reading has to fit inside the hole, whatever it says */}
            <div
              className="t-num font-semibold leading-none tracking-[-0.02em]"
              style={{ fontSize: centerFontSize(String(hot !== null ? format(data[hot].value) : (centerValue ?? '')), size, thickness) }}
            >
              {hot !== null ? format(data[hot].value) : centerValue}
            </div>
            <div className="mt-1 truncate text-[11px] text-muted">
              {hot !== null ? data[hot].label : centerLabel}
            </div>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li
            key={i}
            className="flex items-center gap-2 text-[12.5px]"
            onPointerEnter={() => setHot(i)}
            onPointerLeave={() => setHot(null)}
          >
            <span className="badge-dot" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-muted">{d.label}</span>
            <span className="t-num shrink-0 font-medium">{format(d.value)}</span>
            <span className="t-num w-9 shrink-0 text-right text-[11.5px] text-faint">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ sparkline */

export function Sparkline({
  values,
  width = 96,
  height = 28,
  color = 'var(--c-brand)',
  className = '',
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <path
        d={`${d} L${width} ${height} L0 ${height} Z`}
        fill={color}
        opacity={0.1}
        style={{ transform: 'translateY(1px)' }}
      />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* the end marker carries a surface ring so it stays legible on the line */}
      <circle cx={last[0]} cy={last[1]} r={4} fill={color} stroke="var(--c-surface)" strokeWidth={2} />
    </svg>
  );
}

/* -------------------------------------------------------- heat calendar */

export interface HeatDay {
  /** YYYY-MM-DD */
  day: string;
  value: number;
  label: string;
}

/**
 * Weeks as columns, days as rows — the shape everyone already knows from a
 * contribution graph. One hue, five steps: magnitude, so no second colour.
 */
export function HeatCalendar({
  days,
  weeks = 20,
  cell = 13,
  color = 'var(--c-brand)',
  weekdayLabels,
}: {
  days: HeatDay[];
  weeks?: number;
  cell?: number;
  color?: string;
  weekdayLabels?: string[];
}) {
  const [hot, setHot] = useState<{ d: HeatDay; x: number; y: number } | null>(null);
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const max = Math.max(1, ...days.map((d) => d.value));

  // Columns run oldest → newest, each starting on a Monday.
  const columns = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const out: Date[][] = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const start = new Date(monday);
      start.setDate(start.getDate() - w * 7);
      out.push(Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    }
    return out;
  }, [weeks]);

  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = Date.now();

  return (
    <div className="relative">
      <div className="flex gap-[3px]">
        {weekdayLabels && (
          <div className="mr-1 flex flex-col gap-[3px] pt-[1px]">
            {weekdayLabels.map((l, i) => (
              <span
                key={i}
                className="text-[9.5px] leading-none text-faint"
                style={{ height: cell, lineHeight: `${cell}px` }}
              >
                {i % 2 ? l : ''}
              </span>
            ))}
          </div>
        )}
        <div className="scroll-none flex min-w-0 flex-1 gap-[3px] overflow-x-auto">
          {columns.map((week, wi) => (
            <div key={wi} className="flex min-w-[9px] flex-1 flex-col gap-[3px]">
              {week.map((date) => {
                const k = key(date);
                const hit = byDay.get(k);
                const future = date.getTime() > now;
                const level = hit && hit.value > 0 ? Math.min(4, Math.ceil((hit.value / max) * 4)) : 0;
                return (
                  <span
                    key={k}
                    onPointerEnter={(e) => {
                      if (!hit || future) return;
                      const b = e.currentTarget.getBoundingClientRect();
                      const host = e.currentTarget.closest('.relative')!.getBoundingClientRect();
                      setHot({ d: hit, x: b.left - host.left + b.width / 2, y: b.top - host.top });
                    }}
                    onPointerLeave={() => setHot(null)}
                    className="w-full rounded-[3px]"
                    style={{
                      height: cell,
                      background: future
                        ? 'transparent'
                        : level === 0
                          ? 'var(--c-surface-3)'
                          : `color-mix(in srgb, ${color} ${level * 22 + 12}%, var(--c-surface-3))`,
                      border: future ? '1px dashed var(--c-line)' : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {hot && (
        <ChartTip x={hot.x} y={hot.y}>
          {hot.d.label}
        </ChartTip>
      )}
    </div>
  );
}
