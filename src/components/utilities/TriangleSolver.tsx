import { useMemo } from 'react';
import { formatNumber } from './mathEval';
import { usePanelState } from './panelState';
import { Icon } from '../Icon';

type Key = 'a' | 'b' | 'c' | 'A' | 'B' | 'C';

interface Solved {
  a: number;
  b: number;
  c: number;
  A: number;
  B: number;
  C: number;
  area: number;
  perimeter: number;
  /** circumscribed and inscribed radii */
  R: number;
  r: number;
  kind: string;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Solves a triangle from any three known elements (but not three angles,
 * which fix only the shape). Written out case by case rather than as one
 * clever loop, because the ambiguous SSA case genuinely has two answers and
 * a student should be told so.
 */
function solve(v: Partial<Record<Key, number>>): { result?: Solved; alt?: Solved; error?: string } {
  const sides = (['a', 'b', 'c'] as const).filter((k) => v[k] !== undefined && v[k]! > 0);
  const angles = (['A', 'B', 'C'] as const).filter((k) => v[k] !== undefined && v[k]! > 0);
  if (sides.length + angles.length < 3) return { error: 'Въведи три елемента.' };
  if (sides.length === 0) return { error: 'Само ъгли не стигат — трябва поне една страна.' };
  if (angles.reduce((s, k) => s + v[k]!, 0) >= 180 && angles.length >= 2) {
    return { error: 'Сборът на ъглите трябва да е под 180°.' };
  }

  let a = v.a ?? 0;
  let b = v.b ?? 0;
  let c = v.c ?? 0;
  let A = v.A ?? 0;
  let B = v.B ?? 0;
  let C = v.C ?? 0;
  let alt: Solved | undefined;

  if (sides.length === 3) {
    // SSS
    if (a + b <= c || a + c <= b || b + c <= a) return { error: 'Такъв триъгълник не съществува.' };
    A = deg(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
    B = deg(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
    C = 180 - A - B;
  } else if (sides.length === 2 && angles.length === 1) {
    const known = angles[0];
    const opposite = { A: 'a', B: 'b', C: 'c' }[known] as 'a' | 'b' | 'c';
    if (v[opposite] === undefined) {
      // SAS — the angle sits between the two known sides
      const [s1, s2] = sides;
      const third = (['a', 'b', 'c'] as const).find((k) => k !== s1 && k !== s2)!;
      const val = Math.sqrt(v[s1]! ** 2 + v[s2]! ** 2 - 2 * v[s1]! * v[s2]! * Math.cos(rad(v[known]!)));
      if (third === 'a') a = val;
      else if (third === 'b') b = val;
      else c = val;
      const sides3 = { a, b, c };
      A = deg(Math.acos((sides3.b ** 2 + sides3.c ** 2 - sides3.a ** 2) / (2 * sides3.b * sides3.c)));
      B = deg(Math.acos((sides3.a ** 2 + sides3.c ** 2 - sides3.b ** 2) / (2 * sides3.a * sides3.c)));
      C = 180 - A - B;
    } else {
      // SSA — the ambiguous case
      const other = sides.find((s) => s !== opposite)!;
      const otherAngle = { a: 'A', b: 'B', c: 'C' }[other] as 'A' | 'B' | 'C';
      const ratio = (v[other]! * Math.sin(rad(v[known]!))) / v[opposite]!;
      if (ratio > 1) return { error: 'Няма такъв триъгълник (страната е твърде къса).' };
      const first = deg(Math.asin(ratio));
      const second = 180 - first;
      const build = (angleValue: number): Solved | null => {
        const set: Record<Key, number> = { a, b, c, A, B, C };
        set[otherAngle] = angleValue;
        set[known] = v[known]!;
        const third = (['A', 'B', 'C'] as const).find((k) => k !== known && k !== otherAngle)!;
        set[third] = 180 - set[known] - set[otherAngle];
        if (set[third] <= 0) return null;
        const sideOf = { A: 'a', B: 'b', C: 'c' } as const;
        const k = v[opposite]! / Math.sin(rad(v[known]!));
        for (const ang of ['A', 'B', 'C'] as const) set[sideOf[ang]] = k * Math.sin(rad(set[ang]));
        return finish(set);
      };
      const one = build(first);
      const two = Math.abs(second - first) > 0.01 ? build(second) : null;
      if (!one) return { error: 'Няма такъв триъгълник.' };
      return { result: one, alt: two ?? undefined };
    }
  } else {
    // ASA or AAS: one side plus two angles
    if (angles.length < 2) return { error: 'Трябват още данни.' };
    const [k1, k2] = angles;
    const third = (['A', 'B', 'C'] as const).find((k) => k !== k1 && k !== k2)!;
    const set: Record<Key, number> = { a, b, c, A, B, C };
    set[k1] = v[k1]!;
    set[k2] = v[k2]!;
    set[third] = 180 - set[k1] - set[k2];
    const sideKey = sides[0];
    const angleFor = { a: 'A', b: 'B', c: 'C' }[sideKey] as 'A' | 'B' | 'C';
    const k = v[sideKey]! / Math.sin(rad(set[angleFor]));
    const sideOf = { A: 'a', B: 'b', C: 'c' } as const;
    for (const ang of ['A', 'B', 'C'] as const) set[sideOf[ang]] = k * Math.sin(rad(set[ang]));
    return { result: finish(set) };
  }

  const out = finish({ a, b, c, A, B, C });
  return { result: out, alt };
}

function finish(s: Record<Key, number>): Solved {
  const { a, b, c, A, B, C } = s;
  const perimeter = a + b + c;
  const p = perimeter / 2;
  const area = Math.sqrt(Math.max(0, p * (p - a) * (p - b) * (p - c)));
  const maxAngle = Math.max(A, B, C);
  const kind =
    Math.abs(maxAngle - 90) < 0.05
      ? 'правоъгълен'
      : maxAngle > 90
        ? 'тъпоъгълен'
        : Math.abs(a - b) < 1e-6 && Math.abs(b - c) < 1e-6
          ? 'равностранен'
          : Math.abs(a - b) < 1e-6 || Math.abs(b - c) < 1e-6 || Math.abs(a - c) < 1e-6
            ? 'равнобедрен'
            : 'разностранен';
  return { a, b, c, A, B, C, area, perimeter, R: (a * b * c) / (4 * area), r: area / p, kind };
}

export function TriangleSolver({ wid }: { wid: string }) {
  const [values, setValues] = usePanelState<Record<Key, string>>(wid, 'values', {
    a: '',
    b: '',
    c: '',
    A: '',
    B: '',
    C: '',
  });

  const parsed = useMemo(() => {
    const out: Partial<Record<Key, number>> = {};
    for (const k of Object.keys(values) as Key[]) {
      const n = Number(values[k].replace(',', '.'));
      if (values[k].trim() && Number.isFinite(n)) out[k] = n;
    }
    return out;
  }, [values]);

  const { result, alt, error } = useMemo(() => solve(parsed), [parsed]);
  const filled = Object.keys(parsed).length;

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--c-surface)' }}>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-line p-2.5">
        <Group label="Страни" keys={['a', 'b', 'c']} values={values} setValues={setValues} suffix="" />
        <Group label="Ъгли" keys={['A', 'B', 'C']} values={values} setValues={setValues} suffix="°" />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2.5">
        {filled < 3 ? (
          <p className="pt-6 text-center text-[11.5px] leading-relaxed text-faint">
            Попълни три елемента — например две страни и ъгъла между тях.
            <br />
            Ъгълът <b>A</b> лежи срещу страната <b>a</b>.
          </p>
        ) : error ? (
          <p className="flex items-start gap-1.5 text-[12px]" style={{ color: 'var(--c-danger)' }}>
            <Icon name="alert" size={13} className="mt-px shrink-0" />
            {error}
          </p>
        ) : result ? (
          <>
            <Sketch t={result} />
            <Answer t={result} />
            {alt && (
              <>
                <p className="mb-1 mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--c-warn)' }}>
                  <Icon name="alert" size={12} />
                  Има и второ решение (неопределен случай):
                </p>
                <Answer t={alt} />
              </>
            )}
          </>
        ) : null}
      </div>

      <button
        className="btn m-2 mt-0 shrink-0"
        onClick={() => setValues({ a: '', b: '', c: '', A: '', B: '', C: '' })}
      >
        <Icon name="refresh" size={13} />
        Изчисти
      </button>
    </div>
  );
}

function Group({
  label,
  keys,
  values,
  setValues,
  suffix,
}: {
  label: string;
  keys: Key[];
  values: Record<Key, string>;
  setValues: (fn: (v: Record<Key, string>) => Record<Key, string>) => void;
  suffix: string;
}) {
  return (
    <div>
      <div className="mb-1 label">{label}</div>
      <div className="space-y-1">
        {keys.map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <span className="w-3 shrink-0 text-[12px] font-medium text-muted">{k}</span>
            <input
              value={values[k]}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
              onKeyDown={(e) => e.stopPropagation()}
              inputMode="decimal"
              className="field h-7 text-[12px] tabular-nums"
              placeholder={suffix || '—'}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** A drawing to scale, so a wrong number is visible before it is believed. */
function Sketch({ t }: { t: Solved }) {
  const w = 240;
  const h = 130;
  const pad = 18;
  // A at origin, B along the x axis, C found from angle A
  const ax = 0;
  const ay = 0;
  const bx = t.c;
  const by = 0;
  const cx = t.b * Math.cos(rad(t.A));
  const cy = t.b * Math.sin(rad(t.A));
  const minX = Math.min(ax, bx, cx);
  const maxX = Math.max(ax, bx, cx);
  const maxY = Math.max(ay, by, cy);
  const scale = Math.min((w - pad * 2) / Math.max(1e-6, maxX - minX), (h - pad * 2) / Math.max(1e-6, maxY));
  const P = (x: number, y: number) => `${pad + (x - minX) * scale},${h - pad - y * scale}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mb-2 w-full" style={{ maxHeight: 140 }}>
      <polygon
        points={`${P(ax, ay)} ${P(bx, by)} ${P(cx, cy)}`}
        fill="color-mix(in srgb, var(--c-accent) 12%, transparent)"
        stroke="var(--c-accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {(
        [
          [ax, ay, 'A'],
          [bx, by, 'B'],
          [cx, cy, 'C'],
        ] as const
      ).map(([x, y, label]) => {
        const [px, py] = P(x, y).split(',').map(Number);
        return (
          <text
            key={label}
            x={px + (label === 'B' ? 6 : label === 'A' ? -10 : 0)}
            y={py + (label === 'C' ? -5 : 12)}
            fontSize={10}
            fill="var(--c-muted)"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function Answer({ t }: { t: Solved }) {
  const rows: [string, string][] = [
    ['a', formatNumber(t.a, 6)],
    ['b', formatNumber(t.b, 6)],
    ['c', formatNumber(t.c, 6)],
    ['∠A', `${formatNumber(t.A, 5)}°`],
    ['∠B', `${formatNumber(t.B, 5)}°`],
    ['∠C', `${formatNumber(t.C, 5)}°`],
    ['Лице S', formatNumber(t.area, 6)],
    ['Периметър', formatNumber(t.perimeter, 6)],
    ['Описана R', formatNumber(t.R, 5)],
    ['Вписана r', formatNumber(t.r, 5)],
  ];
  return (
    <div className="rounded-lg p-2" style={{ background: 'var(--c-surface-2)' }}>
      <div className="mb-1 text-[11px] text-muted">Триъгълникът е {t.kind}.</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between text-[12px]">
            <span className="text-faint">{k}</span>
            <span className="tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
