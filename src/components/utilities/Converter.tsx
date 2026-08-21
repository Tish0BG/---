import { useMemo } from 'react';
import { formatNumber } from './mathEval';
import { usePanelState } from './panelState';
import { Icon } from '../Icon';
import { Select } from '../ui';

/**
 * Unit conversion as a factor to one base unit per family — the only family
 * that needs real arithmetic is temperature, so it carries its own pair of
 * functions instead of a number.
 */
interface Unit {
  id: string;
  label: string;
  /** value in base units */
  factor?: number;
  toBase?: (v: number) => number;
  fromBase?: (v: number) => number;
}

interface Family {
  id: string;
  label: string;
  icon: string;
  units: Unit[];
}

const FAMILIES: Family[] = [
  {
    id: 'length',
    label: 'Дължина',
    icon: 'ruler',
    units: [
      { id: 'nm', label: 'нанометър (nm)', factor: 1e-9 },
      { id: 'mm', label: 'милиметър (mm)', factor: 1e-3 },
      { id: 'cm', label: 'сантиметър (cm)', factor: 1e-2 },
      { id: 'm', label: 'метър (m)', factor: 1 },
      { id: 'km', label: 'километър (km)', factor: 1000 },
      { id: 'in', label: 'инч (in)', factor: 0.0254 },
      { id: 'ft', label: 'фут (ft)', factor: 0.3048 },
      { id: 'mi', label: 'миля (mi)', factor: 1609.344 },
      { id: 'ly', label: 'светлинна година', factor: 9.4607e15 },
    ],
  },
  {
    id: 'mass',
    label: 'Маса',
    icon: 'scale',
    units: [
      { id: 'mg', label: 'милиграм (mg)', factor: 1e-6 },
      { id: 'g', label: 'грам (g)', factor: 1e-3 },
      { id: 'kg', label: 'килограм (kg)', factor: 1 },
      { id: 't', label: 'тон (t)', factor: 1000 },
      { id: 'u', label: 'атомна единица (u)', factor: 1.66053907e-27 },
      { id: 'lb', label: 'паунд (lb)', factor: 0.45359237 },
    ],
  },
  {
    id: 'area',
    label: 'Площ',
    icon: 'square',
    units: [
      { id: 'cm2', label: 'см²', factor: 1e-4 },
      { id: 'm2', label: 'м²', factor: 1 },
      { id: 'dka', label: 'декар', factor: 1000 },
      { id: 'ha', label: 'хектар', factor: 10000 },
      { id: 'km2', label: 'км²', factor: 1e6 },
    ],
  },
  {
    id: 'volume',
    label: 'Обем',
    icon: 'flask',
    units: [
      { id: 'ml', label: 'милилитър (ml)', factor: 1e-6 },
      { id: 'l', label: 'литър (l)', factor: 1e-3 },
      { id: 'm3', label: 'м³', factor: 1 },
      { id: 'cm3', label: 'см³', factor: 1e-6 },
    ],
  },
  {
    id: 'time',
    label: 'Време',
    icon: 'clock',
    units: [
      { id: 'ms', label: 'милисекунда', factor: 1e-3 },
      { id: 's', label: 'секунда', factor: 1 },
      { id: 'min', label: 'минута', factor: 60 },
      { id: 'h', label: 'час', factor: 3600 },
      { id: 'd', label: 'денонощие', factor: 86400 },
      { id: 'y', label: 'година', factor: 31557600 },
    ],
  },
  {
    id: 'speed',
    label: 'Скорост',
    icon: 'bolt',
    units: [
      { id: 'ms', label: 'м/с', factor: 1 },
      { id: 'kmh', label: 'км/ч', factor: 1 / 3.6 },
      { id: 'mph', label: 'мили/ч', factor: 0.44704 },
      { id: 'kn', label: 'възел', factor: 0.514444 },
      { id: 'c', label: 'скорост на светлината', factor: 299792458 },
    ],
  },
  {
    id: 'temp',
    label: 'Температура',
    icon: 'sun',
    units: [
      { id: 'C', label: 'целзий (°C)', toBase: (v) => v + 273.15, fromBase: (v) => v - 273.15 },
      { id: 'K', label: 'келвин (K)', toBase: (v) => v, fromBase: (v) => v },
      {
        id: 'F',
        label: 'фаренхайт (°F)',
        toBase: (v) => ((v - 32) * 5) / 9 + 273.15,
        fromBase: (v) => ((v - 273.15) * 9) / 5 + 32,
      },
    ],
  },
  {
    id: 'energy',
    label: 'Енергия',
    icon: 'flame',
    units: [
      { id: 'J', label: 'джаул (J)', factor: 1 },
      { id: 'kJ', label: 'килоджаул (kJ)', factor: 1000 },
      { id: 'cal', label: 'калория (cal)', factor: 4.184 },
      { id: 'kcal', label: 'килокалория (kcal)', factor: 4184 },
      { id: 'eV', label: 'електронволт (eV)', factor: 1.602176634e-19 },
      { id: 'kWh', label: 'киловатчас (kWh)', factor: 3.6e6 },
    ],
  },
  {
    id: 'pressure',
    label: 'Налягане',
    icon: 'target',
    units: [
      { id: 'Pa', label: 'паскал (Pa)', factor: 1 },
      { id: 'kPa', label: 'килопаскал (kPa)', factor: 1000 },
      { id: 'bar', label: 'бар', factor: 1e5 },
      { id: 'atm', label: 'атмосфера', factor: 101325 },
      { id: 'mmHg', label: 'mm Hg', factor: 133.322 },
    ],
  },
  {
    id: 'angle',
    label: 'Ъгъл',
    icon: 'angle',
    units: [
      { id: 'deg', label: 'градус (°)', factor: 1 },
      { id: 'rad', label: 'радиан', factor: 180 / Math.PI },
      { id: 'grad', label: 'град (gon)', factor: 0.9 },
      { id: 'turn', label: 'оборот', factor: 360 },
    ],
  },
  {
    id: 'data',
    label: 'Данни',
    icon: 'save',
    units: [
      { id: 'b', label: 'байт', factor: 1 },
      { id: 'kb', label: 'килобайт (KB)', factor: 1024 },
      { id: 'mb', label: 'мегабайт (MB)', factor: 1024 ** 2 },
      { id: 'gb', label: 'гигабайт (GB)', factor: 1024 ** 3 },
      { id: 'tb', label: 'терабайт (TB)', factor: 1024 ** 4 },
    ],
  },
];

const toBase = (u: Unit, v: number) => (u.toBase ? u.toBase(v) : v * (u.factor ?? 1));
const fromBase = (u: Unit, v: number) => (u.fromBase ? u.fromBase(v) : v / (u.factor ?? 1));

export function Converter({ wid }: { wid: string }) {
  const [familyId, setFamilyId] = usePanelState(wid, 'family', 'length');
  const [fromId, setFromId] = usePanelState(wid, 'from', 'cm');
  const [toId, setToId] = usePanelState(wid, 'to', 'm');
  const [value, setValue] = usePanelState(wid, 'value', '1');

  const family = FAMILIES.find((f) => f.id === familyId) ?? FAMILIES[0];
  const from = family.units.find((u) => u.id === fromId) ?? family.units[0];
  const to = family.units.find((u) => u.id === toId) ?? family.units[1] ?? family.units[0];

  const result = useMemo(() => {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n)) return '—';
    return formatNumber(fromBase(to, toBase(from, n)), 12);
  }, [value, from, to]);

  /** The whole family at once, so the answer you did not ask for is there. */
  const all = useMemo(() => {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n)) return [];
    const base = toBase(from, n);
    return family.units.map((u) => ({ unit: u, value: formatNumber(fromBase(u, base), 8) }));
  }, [value, from, family]);

  const pickFamily = (id: string) => {
    const f = FAMILIES.find((x) => x.id === id)!;
    setFamilyId(id);
    setFromId(f.units[0].id);
    setToId((f.units[1] ?? f.units[0]).id);
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--c-surface)' }}>
      <div className="scroll-thin flex shrink-0 gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
        {FAMILIES.map((f) => (
          <button
            key={f.id}
            onClick={() => pickFamily(f.id)}
            className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[11.5px] transition-colors ${
              familyId === f.id ? 'btn-ghost-active' : 'text-muted hover:bg-surface-3'
            }`}
          >
            <Icon name={f.icon} size={13} />
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 p-2.5">
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block label">От</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="field tabular-nums"
              inputMode="decimal"
            />
          </label>
          <div className="min-w-0 flex-1">
            <span className="mb-1 block label">&nbsp;</span>
            <Select
              value={from.id}
              options={family.units.map((u) => ({ value: u.id, label: u.label }))}
              onChange={setFromId}
              width={220}
            />
          </div>
        </div>

        <div className="flex justify-center">
          <button
            className="icon-btn h-7 w-7"
            title="Размени"
            onClick={() => {
              setFromId(to.id);
              setToId(from.id);
              setValue(result === '—' ? value : result);
            }}
          >
            <Icon name="refresh" size={14} />
          </button>
        </div>

        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block label">В</span>
            <output
              className="field flex items-center justify-end tabular-nums"
              style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)', borderColor: 'transparent' }}
            >
              {result}
            </output>
          </label>
          <div className="min-w-0 flex-1">
            <span className="mb-1 block label">&nbsp;</span>
            <Select
              value={to.id}
              options={family.units.map((u) => ({ value: u.id, label: u.label }))}
              onChange={setToId}
              width={220}
            />
          </div>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto border-t border-line px-2.5 py-2">
        <div className="mb-1 label">Всички единици</div>
        {all.map(({ unit, value: v }) => (
          <button
            key={unit.id}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1 text-[12px] transition-colors hover:bg-surface-2"
            onClick={() => setToId(unit.id)}
          >
            <span className="truncate text-muted">{unit.label}</span>
            <span className="shrink-0 tabular-nums">{v}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
