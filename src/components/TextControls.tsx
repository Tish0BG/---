import type { FontFamily } from '@/types';

export interface TextStyle {
  fontFamily: FontFamily;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
}

const FONTS: { id: FontFamily; label: string; css: string }[] = [
  { id: 'sans', label: 'Aa', css: 'Helvetica, Arial, sans-serif' },
  { id: 'serif', label: 'Aa', css: 'Georgia, serif' },
  { id: 'mono', label: 'Aa', css: 'ui-monospace, monospace' },
];

const ALIGN: TextStyle['align'][] = ['left', 'center', 'right'];

/** Font family / weight / alignment picker, shared by the tool options and the selection bar. */
export function TextControls({
  value,
  onChange,
  compact = false,
}: {
  value: TextStyle;
  onChange: (patch: Partial<TextStyle>) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'flex items-center gap-1' : 'space-y-2'}>
      <div className="flex gap-1">
        {FONTS.map((f) => (
          <button
            key={f.id}
            onClick={() => onChange({ fontFamily: f.id })}
            className={`btn h-7 flex-1 px-2 ${value.fontFamily === f.id ? 'btn-ghost-active' : ''}`}
            style={{ fontFamily: f.css }}
            title={f.id}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onChange({ bold: !value.bold })}
          className={`btn h-7 w-8 font-bold ${value.bold ? 'btn-ghost-active' : ''}`}
          title="Получер"
        >
          B
        </button>
        <button
          onClick={() => onChange({ italic: !value.italic })}
          className={`btn h-7 w-8 italic ${value.italic ? 'btn-ghost-active' : ''}`}
          title="Курсив"
        >
          I
        </button>
        <div className="mx-0.5 w-px bg-line" />
        {ALIGN.map((a) => (
          <button
            key={a}
            onClick={() => onChange({ align: a })}
            className={`icon-btn h-7 w-8 ${value.align === a ? 'btn-ghost-active' : ''}`}
            title={a === 'left' ? 'Ляво' : a === 'center' ? 'Центрирано' : 'Дясно'}
          >
            <span
              className="flex w-full flex-col gap-[2px] px-1.5"
              style={{ alignItems: a === 'left' ? 'flex-start' : a === 'center' ? 'center' : 'flex-end' }}
            >
              <span className="block h-[1.5px] w-full rounded bg-current" />
              <span className="block h-[1.5px] w-2/3 rounded bg-current" />
              <span className="block h-[1.5px] w-full rounded bg-current" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
