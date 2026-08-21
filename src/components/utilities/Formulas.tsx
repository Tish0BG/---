import { useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { usePanelState } from './panelState';

interface Formula {
  name: string;
  body: string;
  note?: string;
}

interface Section {
  id: string;
  title: string;
  icon: string;
  items: Formula[];
}

/**
 * The sheet that is usually taped inside the cover of a notebook. Plain text
 * rather than typeset maths: it stays readable at 11 px, it can be copied
 * straight into the calculator panel, and it costs nothing to load.
 */
const SECTIONS: Section[] = [
  {
    id: 'algebra',
    title: 'Алгебра',
    icon: 'sigma',
    items: [
      { name: 'Квадратно уравнение', body: 'x₁,₂ = (−b ± √(b² − 4ac)) / 2a', note: 'D = b² − 4ac' },
      { name: 'Формули на Виет', body: 'x₁ + x₂ = −b/a,  x₁·x₂ = c/a' },
      { name: 'Съкратено умножение', body: '(a ± b)² = a² ± 2ab + b²\na² − b² = (a − b)(a + b)' },
      { name: 'Куб', body: '(a ± b)³ = a³ ± 3a²b + 3ab² ± b³' },
      { name: 'Аритметична прогресия', body: 'aₙ = a₁ + (n−1)d,  Sₙ = n(a₁ + aₙ)/2' },
      { name: 'Геометрична прогресия', body: 'aₙ = a₁·qⁿ⁻¹,  Sₙ = a₁(qⁿ − 1)/(q − 1)' },
      { name: 'Логаритми', body: 'log(ab) = log a + log b\nlog(aⁿ) = n·log a\nlogₐb = ln b / ln a' },
    ],
  },
  {
    id: 'geometry',
    title: 'Геометрия',
    icon: 'triangle',
    items: [
      { name: 'Питагорова теорема', body: 'a² + b² = c²' },
      { name: 'Лице на триъгълник', body: 'S = a·hₐ/2 = ½ab·sin γ\nS = √(p(p−a)(p−b)(p−c)),  p = (a+b+c)/2' },
      { name: 'Косинусова теорема', body: 'c² = a² + b² − 2ab·cos γ' },
      { name: 'Синусова теорема', body: 'a/sin α = b/sin β = c/sin γ = 2R' },
      { name: 'Окръжност', body: 'L = 2πr,  S = πr²' },
      { name: 'Кръгов сектор', body: 'l = πrα/180°,  S = πr²α/360°' },
      { name: 'Цилиндър', body: 'V = πr²h,  S = 2πr(r + h)' },
      { name: 'Конус', body: 'V = πr²h/3,  S = πr(r + l)' },
      { name: 'Сфера', body: 'V = 4πr³/3,  S = 4πr²' },
    ],
  },
  {
    id: 'trig',
    title: 'Тригонометрия',
    icon: 'angle',
    items: [
      { name: 'Основно тъждество', body: 'sin²α + cos²α = 1' },
      { name: 'Сбор на ъгли', body: 'sin(α±β) = sin α·cos β ± cos α·sin β\ncos(α±β) = cos α·cos β ∓ sin α·sin β' },
      { name: 'Двоен ъгъл', body: 'sin 2α = 2 sin α cos α\ncos 2α = cos²α − sin²α' },
      { name: 'Стойности', body: '0° 30° 45° 60° 90°\nsin: 0  ½  √2/2  √3/2  1\ncos: 1  √3/2  √2/2  ½  0' },
    ],
  },
  {
    id: 'calculus',
    title: 'Производни и интеграли',
    icon: 'chartLine',
    items: [
      { name: 'Производни', body: "(xⁿ)' = n·xⁿ⁻¹\n(sin x)' = cos x\n(cos x)' = −sin x\n(eˣ)' = eˣ\n(ln x)' = 1/x" },
      { name: 'Правила', body: "(uv)' = u'v + uv'\n(u/v)' = (u'v − uv')/v²\n(f(g))' = f'(g)·g'" },
      { name: 'Интеграли', body: '∫xⁿdx = xⁿ⁺¹/(n+1) + C\n∫dx/x = ln|x| + C\n∫eˣdx = eˣ + C\n∫sin x dx = −cos x + C' },
    ],
  },
  {
    id: 'mechanics',
    title: 'Механика',
    icon: 'bolt',
    items: [
      { name: 'Равномерно ускорено', body: 'v = v₀ + at\ns = v₀t + at²/2\nv² = v₀² + 2as' },
      { name: 'Нютон', body: 'F = ma,  p = mv,  FΔt = Δp' },
      { name: 'Работа и енергия', body: 'A = F·s·cos α\nEк = mv²/2,  Eп = mgh' },
      { name: 'Гравитация', body: 'F = G·m₁m₂/r²,  G = 6,674×10⁻¹¹ N·m²/kg²' },
      { name: 'Трептения', body: 'T = 2π√(l/g) — махало\nT = 2π√(m/k) — пружина' },
      { name: 'Налягане', body: 'p = F/S,  p = ρgh' },
    ],
  },
  {
    id: 'electricity',
    title: 'Електричество',
    icon: 'flame',
    items: [
      { name: 'Закон на Ом', body: 'I = U/R,  R = ρl/S' },
      { name: 'Свързване', body: 'Последователно: R = R₁ + R₂\nУспоредно: 1/R = 1/R₁ + 1/R₂' },
      { name: 'Мощност', body: 'P = UI = I²R = U²/R,  A = Pt' },
      { name: 'Кулон', body: 'F = k·q₁q₂/r²,  k = 9×10⁹ N·m²/C²' },
      { name: 'Кондензатор', body: 'C = q/U,  W = CU²/2' },
    ],
  },
  {
    id: 'chemistry',
    title: 'Химия',
    icon: 'flask',
    items: [
      { name: 'Количество вещество', body: 'n = m/M = N/Nₐ = V/Vм' },
      { name: 'Константи', body: 'Nₐ = 6,022×10²³ mol⁻¹\nVм = 22,4 l/mol (н.у.)' },
      { name: 'Концентрация', body: 'c = n/V (mol/l)\nw = m(вещество)/m(разтвор) × 100%' },
      { name: 'Идеален газ', body: 'pV = nRT,  R = 8,314 J/(mol·K)' },
      { name: 'pH', body: 'pH = −log[H⁺],  pH + pOH = 14' },
    ],
  },
];

export function Formulas({ wid }: { wid: string }) {
  const [query, setQuery] = usePanelState(wid, 'query', '');
  const [open, setOpen] = usePanelState<string | null>(wid, 'open', 'algebra');
  const [copied, setCopied] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.body.toLowerCase().includes(q),
      ),
    })).filter((s) => s.items.length);
  }, [q]);

  const copy = (f: Formula) => {
    void navigator.clipboard.writeText(f.body).then(() => {
      setCopied(f.name);
      window.setTimeout(() => setCopied(null), 1400);
    });
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--c-surface)' }}>
      <div className="shrink-0 border-b border-line p-2">
        <div className="relative">
          <Icon name="search" size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Търси формула…"
            className="field h-7 pl-7 text-[12px]"
          />
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {shown.map((section) => {
          const expanded = !!q || open === section.id;
          return (
            <section key={section.id} className="mb-1.5">
              <button
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
                onClick={() => setOpen(open === section.id ? null : section.id)}
              >
                <Icon name={section.icon} size={14} className="shrink-0 text-muted" />
                <span className="flex-1 text-[12.5px] font-medium">{section.title}</span>
                <span className="text-[10px] text-faint">{section.items.length}</span>
                <Icon
                  name="chevronDown"
                  size={13}
                  className="shrink-0 text-faint transition-transform"
                  style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
                />
              </button>

              {expanded && (
                <div className="space-y-1 pb-1 pl-1">
                  {section.items.map((f) => (
                    <div
                      key={f.name}
                      className="group rounded-lg px-2 py-1.5"
                      style={{ background: 'var(--c-surface-2)' }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-muted">{f.name}</div>
                          <pre className="mt-0.5 whitespace-pre-wrap font-mono text-[12px] leading-relaxed">
                            {f.body}
                          </pre>
                          {f.note && <div className="mt-0.5 text-[10.5px] text-faint">{f.note}</div>}
                        </div>
                        <button
                          className="icon-btn h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => copy(f)}
                          title="Копирай"
                        >
                          <Icon name={copied === f.name ? 'check' : 'copy'} size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {!shown.length && <p className="py-6 text-center text-[11px] text-faint">Нищо не съвпада.</p>}
      </div>
    </div>
  );
}
