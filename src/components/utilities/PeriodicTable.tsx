import { useMemo, useState } from 'react';
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  ELEMENTS,
  STATE_LABEL,
  cellPosition,
  stateAt,
  toCelsius,
  type ChemElement,
  type ElementCategory,
} from './periodicData';
import { Icon } from '../Icon';
import { usePanelState } from './panelState';

type ColorBy = 'category' | 'state' | 'electronegativity';

/**
 * The whole table at a glance, sized to whatever space the panel has.
 *
 * The colouring is switchable because the same grid answers three different
 * questions — "which family", "solid or gas", "how greedy for electrons" —
 * and a chemistry problem usually needs one of them, not all three.
 */
export function PeriodicTable({ wid }: { wid: string }) {
  const [selected, setSelected] = useState<ChemElement | null>(null);
  /** a clicked element stays put; hovering only previews */
  const [pinned, setPinned] = useState(false);
  const [colorBy, setColorBy] = usePanelState<ColorBy>(wid, 'colorBy', 'category');
  const [query, setQuery] = usePanelState(wid, 'query', '');

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    return new Set(
      ELEMENTS.filter(
        (e) =>
          e.symbol.toLowerCase().startsWith(q) ||
          e.name.toLowerCase().startsWith(q) ||
          String(e.z) === q,
      ).map((e) => e.z),
    );
  }, [q]);

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--c-surface)' }}>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-2 py-1.5">
        <div className="relative min-w-0 flex-1">
          <Icon name="search" size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Fe, желязо, 26…"
            className="field h-7 pl-7 text-[12px]"
          />
        </div>
        <div className="flex shrink-0 gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--c-surface-2)' }}>
          {(
            [
              ['category', 'Групи', 'layers'],
              ['state', 'Състояние', 'flask'],
              ['electronegativity', 'Електроотр.', 'bolt'],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              title={label}
              onClick={() => setColorBy(id)}
              className={`grid h-6 w-7 cursor-pointer place-items-center rounded-md transition-colors ${
                colorBy === id ? 'bg-surface text-accent shadow-[var(--shadow-panel)]' : 'text-muted'
              }`}
            >
              <Icon name={icon} size={13} />
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto p-2">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: 'repeat(18, minmax(26px, 1fr))',
            gridTemplateRows: 'repeat(7, minmax(26px, auto)) 8px repeat(2, minmax(26px, auto))',
            minWidth: 520,
          }}
        >
          {ELEMENTS.map((el) => {
            const pos = cellPosition(el);
            const dim = matches ? !matches.has(el.z) : false;
            return (
              <button
                key={el.z}
                onClick={() => {
                  const same = pinned && selected?.z === el.z;
                  setSelected(same ? null : el);
                  setPinned(!same);
                }}
                onMouseEnter={() => !pinned && setSelected(el)}
                onMouseLeave={() => !pinned && setSelected(null)}
                className="relative cursor-pointer rounded-[3px] px-0.5 pb-0.5 pt-[3px] text-left transition-transform hover:z-10 hover:scale-[1.12]"
                style={{
                  gridColumn: pos.col,
                  gridRow: pos.row === 9 ? 9 : pos.row === 10 ? 10 : pos.row,
                  background: cellColor(el, colorBy),
                  opacity: dim ? 0.22 : 1,
                  outline: selected?.z === el.z ? '2px solid var(--c-text)' : 'none',
                  outlineOffset: 1,
                  color: '#0b0d12',
                }}
                title={el.name}
              >
                <span className="block text-[7px] leading-none opacity-70">{el.z}</span>
                <span className="block text-[11px] font-semibold leading-tight">{el.symbol}</span>
              </button>
            );
          })}

          {/* the two markers that point at the strips below */}
          <span
            className="grid place-items-center rounded-[3px] text-[8px]"
            style={{ gridColumn: 3, gridRow: 6, background: 'var(--c-surface-3)', color: 'var(--c-muted)' }}
          >
            57–71
          </span>
          <span
            className="grid place-items-center rounded-[3px] text-[8px]"
            style={{ gridColumn: 3, gridRow: 7, background: 'var(--c-surface-3)', color: 'var(--c-muted)' }}
          >
            89–103
          </span>
        </div>

        {colorBy === 'category' && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {(Object.keys(CATEGORY_LABEL) as ElementCategory[]).map((c) => (
              <span key={c} className="flex items-center gap-1 text-[9.5px] text-muted">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: CATEGORY_COLOR[c] }} />
                {CATEGORY_LABEL[c]}
              </span>
            ))}
          </div>
        )}
      </div>

      <ElementCard
        el={selected}
        onClose={() => {
          setSelected(null);
          setPinned(false);
        }}
      />
    </div>
  );
}

function cellColor(el: ChemElement, mode: ColorBy): string {
  if (mode === 'category') return CATEGORY_COLOR[el.category];
  if (mode === 'state') {
    const s = stateAt(el);
    return s === 'gas' ? '#7dd3fc' : s === 'liquid' ? '#5eead4' : s === 'solid' ? '#cbd5e1' : '#475569';
  }
  const en = el.electronegativity;
  if (en === null) return '#475569';
  // 0.7 → 4.0 mapped onto a cool→warm ramp
  const t = Math.min(1, Math.max(0, (en - 0.7) / 3.3));
  const hue = 210 - t * 210;
  return `hsl(${hue} 78% 62%)`;
}

function ElementCard({ el, onClose }: { el: ChemElement | null; onClose: () => void }) {
  if (!el) {
    return (
      <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] text-faint">
        Посочи елемент, за да видиш данните му.
      </div>
    );
  }
  const state = stateAt(el);
  return (
    <div className="shrink-0 border-t border-line px-3 py-2" style={{ background: 'var(--c-surface-2)' }}>
      <div className="flex items-start gap-3">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-[18px] font-semibold"
          style={{ background: CATEGORY_COLOR[el.category], color: '#0b0d12' }}
        >
          {el.symbol}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-medium">{el.name}</span>
            <span className="text-[11px] text-faint">№ {el.z}</span>
          </div>
          <div className="text-[11px] text-muted">
            {CATEGORY_LABEL[el.category]} · {STATE_LABEL[state]} при 20 °C
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-4">
            <Fact label="Маса" value={`${el.mass} u`} />
            <Fact label="Електроотр." value={el.electronegativity?.toFixed(2) ?? '—'} />
            <Fact label="Топене" value={toCelsius(el.melt)} />
            <Fact label="Кипене" value={toCelsius(el.boil)} />
          </div>
          <div className="mt-1 truncate font-mono text-[10.5px] text-faint">{el.config}</div>
        </div>
        <button className="icon-btn h-6 w-6 shrink-0" onClick={onClose} aria-label="Затвори">
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="truncate">
      <span className="text-faint">{label}: </span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
