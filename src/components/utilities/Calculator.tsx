import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluate, formatNumber, type AngleMode } from './mathEval';
import { usePanelState } from './panelState';
import { Icon } from '../Icon';

const KEY = 'studypdf.calc.v1';

interface HistoryRow {
  expr: string;
  value: string;
}

const BASIC: (string | { label: string; ins: string; kind?: 'op' | 'eq' | 'fn' })[][] = [
  [
    { label: 'C', ins: 'clear', kind: 'fn' },
    { label: '( )', ins: 'paren', kind: 'fn' },
    { label: '%', ins: '%', kind: 'op' },
    { label: '÷', ins: '÷', kind: 'op' },
  ],
  ['7', '8', '9', { label: '×', ins: '×', kind: 'op' }],
  ['4', '5', '6', { label: '−', ins: '-', kind: 'op' }],
  ['1', '2', '3', { label: '+', ins: '+', kind: 'op' }],
  [
    '0',
    '.',
    { label: '⌫', ins: 'back', kind: 'fn' },
    { label: '=', ins: 'eq', kind: 'eq' },
  ],
];

const SCIENTIFIC: { label: string; ins: string }[] = [
  { label: 'sin', ins: 'sin(' },
  { label: 'cos', ins: 'cos(' },
  { label: 'tan', ins: 'tan(' },
  { label: 'xʸ', ins: '^' },
  { label: 'ln', ins: 'ln(' },
  { label: 'log', ins: 'log(' },
  { label: '√', ins: '√(' },
  { label: 'x²', ins: '^2' },
  { label: 'π', ins: 'π' },
  { label: 'e', ins: 'e' },
  { label: 'n!', ins: '!' },
  { label: '1/x', ins: '^(-1)' },
];

/**
 * The calculator a physics problem actually needs: degrees when the textbook
 * says degrees, a running history you can click back into, and an expression
 * you can see and correct instead of a single running total.
 */
export function Calculator({ wid }: { wid: string }) {
  const [expr, setExpr] = usePanelState(wid, 'expr', '');
  const [angle, setAngle] = usePanelState<AngleMode>(
    wid,
    'angle',
    (localStorage.getItem(`${KEY}.angle`) as AngleMode) === 'rad' ? 'rad' : 'deg',
  );
  const [history, setHistory] = useState<HistoryRow[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]') as HistoryRow[];
    } catch {
      return [];
    }
  });
  const [memory, setMemory] = usePanelState(wid, 'memory', 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(`${KEY}.angle`, angle);
  }, [angle]);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(history.slice(-40)));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [history]);

  /** Live preview: the answer appears as you type, before pressing "=". */
  const preview = useMemo(() => {
    if (!expr.trim()) return null;
    try {
      return formatNumber(evaluate(expr, angle));
    } catch {
      // half-typed expressions are the normal case here, not an error
      return null;
    }
  }, [expr, angle]);

  const insert = (text: string) => {
    const el = inputRef.current;
    if (!el) return setExpr((v) => v + text);
    const start = el.selectionStart ?? expr.length;
    const end = el.selectionEnd ?? expr.length;
    const next = expr.slice(0, start) + text + expr.slice(end);
    setExpr(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const equals = () => {
    if (!expr.trim()) return;
    try {
      const value = formatNumber(evaluate(expr, angle));
      setHistory((h) => [...h.slice(-39), { expr, value }]);
      setExpr(value);
    } catch (err) {
      setHistory((h) => [
        ...h.slice(-39),
        { expr, value: err instanceof Error ? `⚠ ${err.message}` : '⚠ Грешка' },
      ]);
    }
  };

  const press = (ins: string) => {
    if (ins === 'clear') return setExpr('');
    if (ins === 'eq') return equals();
    if (ins === 'paren') {
      const opens = (expr.match(/\(/g) ?? []).length;
      const closes = (expr.match(/\)/g) ?? []).length;
      return insert(opens > closes ? ')' : '(');
    }
    if (ins === 'back') {
      const el = inputRef.current;
      const at = el?.selectionStart ?? expr.length;
      if (at === 0) return;
      setExpr(expr.slice(0, at - 1) + expr.slice(el?.selectionEnd ?? at));
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(at - 1, at - 1);
      });
      return;
    }
    insert(ins);
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--c-surface)' }}>
      <div ref={listRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {history.length === 0 ? (
          <p className="pt-4 text-center text-[11px] leading-relaxed text-faint">
            Пиши израза направо: <code>2(3+4)</code>, <code>sin30</code>, <code>√2</code>, <code>5!</code>
          </p>
        ) : (
          history.map((row, i) => (
            <button
              key={i}
              className="mb-1 block w-full cursor-pointer rounded-lg px-1.5 py-1 text-right transition-colors hover:bg-surface-2"
              onClick={() => setExpr(row.value.startsWith('⚠') ? row.expr : row.value)}
              title="Кликни, за да вземеш резултата"
            >
              <div className="truncate text-[11px] text-faint">{row.expr}</div>
              <div
                className="truncate text-[14px] tabular-nums"
                style={{ color: row.value.startsWith('⚠') ? 'var(--c-danger)' : 'var(--c-text)' }}
              >
                {row.value}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-line px-2.5 pb-1 pt-2">
        <input
          ref={inputRef}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              equals();
            }
          }}
          placeholder="0"
          spellCheck={false}
          inputMode="text"
          className="w-full bg-transparent text-right text-[22px] tabular-nums outline-none"
          style={{ color: 'var(--c-text)' }}
        />
        <div className="flex h-4 items-center justify-between text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <button
              className="cursor-pointer rounded px-1 hover:bg-surface-3"
              onClick={() => setAngle(angle === 'deg' ? 'rad' : 'deg')}
              title="Градуси или радиани"
            >
              {angle === 'deg' ? 'DEG' : 'RAD'}
            </button>
            {memory !== 0 && (
              <button
                className="cursor-pointer rounded px-1 hover:bg-surface-3"
                onClick={() => insert(String(memory))}
                title="Вмъкни от паметта"
              >
                M {formatNumber(memory, 6)}
              </button>
            )}
          </span>
          <span className="tabular-nums">{preview !== null && preview !== expr ? `= ${preview}` : ''}</span>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 px-2 pb-1">
        {SCIENTIFIC.map((b) => (
          <button
            key={b.label}
            onClick={() => press(b.ins)}
            className="h-7 cursor-pointer rounded-md text-[11.5px] transition-colors hover:bg-surface-3"
            style={{ color: 'var(--c-muted)' }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1 p-2 pt-0">
        {BASIC.flat().map((b, i) => {
          const def = typeof b === 'string' ? { label: b, ins: b, kind: undefined } : b;
          const isEq = def.kind === 'eq';
          const isOp = def.kind === 'op';
          return (
            <button
              key={i}
              onClick={() => press(def.ins)}
              className="h-9 cursor-pointer rounded-lg text-[14px] font-medium transition-colors"
              style={{
                background: isEq ? 'var(--c-accent)' : isOp ? 'var(--c-accent-soft)' : 'var(--c-surface-2)',
                color: isEq ? 'var(--c-accent-text)' : isOp ? 'var(--c-accent)' : 'var(--c-text)',
                border: '1px solid var(--c-line)',
              }}
            >
              {def.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 border-t border-line px-2 py-1">
        {(
          [
            ['M+', () => setMemory((m) => m + (Number(preview) || 0))],
            ['M−', () => setMemory((m) => m - (Number(preview) || 0))],
            ['MC', () => setMemory(0)],
          ] as const
        ).map(([label, fn]) => (
          <button
            key={label}
            className="h-6 flex-1 cursor-pointer rounded text-[11px] text-muted transition-colors hover:bg-surface-3"
            onClick={fn}
          >
            {label}
          </button>
        ))}
        <button
          className="icon-btn h-6 w-6"
          onClick={() => setHistory([])}
          title="Изчисти историята"
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
}
