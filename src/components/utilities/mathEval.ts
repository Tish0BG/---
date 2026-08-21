/**
 * A small expression evaluator.
 *
 * `eval()` would have been shorter, but it also runs anything else the string
 * happens to contain — and it does not know that `sin` should be in degrees,
 * that `2(3+1)` means multiplication, or that `√` and `π` are ordinary
 * characters on a Bulgarian keyboard. So: tokenise, shunting-yard, evaluate.
 */

export type AngleMode = 'deg' | 'rad';

type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'sep' };

const CONSTANTS: Record<string, number> = {
  π: Math.PI,
  pi: Math.PI,
  e: Math.E,
  τ: Math.PI * 2,
};

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh',
  'ln', 'log', 'log2', 'sqrt', 'cbrt', 'abs', 'exp',
  'round', 'floor', 'ceil', 'sign', 'min', 'max',
]);

/** Right-associative operators bind the other way: 2^3^2 = 2^9. */
const PRECEDENCE: Record<string, { p: number; right?: boolean }> = {
  '+': { p: 1 },
  '-': { p: 1 },
  '*': { p: 2 },
  '/': { p: 2 },
  '%': { p: 2 },
  '^': { p: 4, right: true },
  'u-': { p: 3, right: true },
};

export class MathError extends Error {}

function tokenize(src: string): Token[] {
  const s = src
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.')
    .replace(/√/g, 'sqrt')
    .replace(/\s+/g, '');
  const out: Token[] = [];
  let i = 0;

  const prev = () => out[out.length - 1];
  /** After a value, a name or "(" means an implied multiplication. */
  const afterValue = () => {
    const p = prev();
    return !!p && (p.t === 'num' || p.t === 'rp' || (p.t === 'op' && p.v === '!'));
  };

  while (i < s.length) {
    const c = s[i];

    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9._]/.test(s[j])) j++;
      // 1.5e-3 is one number, not a subtraction
      if (s[j] === 'e' && /[0-9+-]/.test(s[j + 1] ?? '')) {
        j++;
        if (/[+-]/.test(s[j])) j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      const v = Number(s.slice(i, j).replace(/_/g, ''));
      if (Number.isNaN(v)) throw new MathError('Неразбираемо число');
      if (afterValue()) out.push({ t: 'op', v: '*' });
      out.push({ t: 'num', v });
      i = j;
      continue;
    }

    if (/[a-zπτ]/i.test(c)) {
      let j = i;
      while (j < s.length && /[a-z0-9πτ]/i.test(s[j])) j++;
      let name = s.slice(i, j);
      // Longest match wins: "sinh" before "sin", "pi" before "p".
      while (name.length > 1 && !FUNCTIONS.has(name) && !(name in CONSTANTS)) {
        name = name.slice(0, -1);
        j--;
      }
      if (afterValue()) out.push({ t: 'op', v: '*' });
      if (FUNCTIONS.has(name)) out.push({ t: 'fn', v: name });
      else if (name in CONSTANTS) out.push({ t: 'num', v: CONSTANTS[name] });
      else throw new MathError(`Непознато „${name}“`);
      i = j;
      continue;
    }

    if (c === '(') {
      if (afterValue()) out.push({ t: 'op', v: '*' });
      out.push({ t: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ t: 'rp' });
      i++;
      continue;
    }
    if (c === ';') {
      out.push({ t: 'sep' });
      i++;
      continue;
    }
    if (c === '!') {
      out.push({ t: 'op', v: '!' });
      i++;
      continue;
    }
    if ('+-*/^%'.includes(c)) {
      const unary = c === '-' && !afterValue();
      out.push({ t: 'op', v: unary ? 'u-' : c });
      i++;
      continue;
    }
    throw new MathError(`Непознат знак „${c}“`);
  }
  return out;
}

function apply(op: string, stack: number[], angle: AngleMode): void {
  if (op === 'u-') {
    const a = stack.pop();
    if (a === undefined) throw new MathError('Липсва число');
    stack.push(-a);
    return;
  }
  if (op === '!') {
    const a = stack.pop();
    if (a === undefined) throw new MathError('Липсва число');
    if (a < 0 || !Number.isInteger(a) || a > 170) throw new MathError('Факториел само за 0…170');
    let r = 1;
    for (let k = 2; k <= a; k++) r *= k;
    stack.push(r);
    return;
  }
  if (FUNCTIONS.has(op)) {
    const a = stack.pop();
    if (a === undefined) throw new MathError('Липсва число');
    stack.push(callFn(op, a, angle));
    return;
  }
  const b = stack.pop();
  const a = stack.pop();
  if (a === undefined || b === undefined) throw new MathError('Липсва число');
  switch (op) {
    case '+': stack.push(a + b); break;
    case '-': stack.push(a - b); break;
    case '*': stack.push(a * b); break;
    case '/':
      if (b === 0) throw new MathError('Деление на нула');
      stack.push(a / b);
      break;
    case '%': stack.push(a % b); break;
    case '^': stack.push(a ** b); break;
    default: throw new MathError(`Непознат оператор ${op}`);
  }
}

function callFn(name: string, a: number, angle: AngleMode): number {
  const toRad = (x: number) => (angle === 'deg' ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (angle === 'deg' ? (x * 180) / Math.PI : x);
  switch (name) {
    case 'sin': return Math.sin(toRad(a));
    case 'cos': return Math.cos(toRad(a));
    case 'tan': return Math.tan(toRad(a));
    case 'asin': return fromRad(Math.asin(a));
    case 'acos': return fromRad(Math.acos(a));
    case 'atan': return fromRad(Math.atan(a));
    case 'sinh': return Math.sinh(a);
    case 'cosh': return Math.cosh(a);
    case 'tanh': return Math.tanh(a);
    case 'ln': return Math.log(a);
    case 'log': return Math.log10(a);
    case 'log2': return Math.log2(a);
    case 'sqrt':
      if (a < 0) throw new MathError('Корен от отрицателно число');
      return Math.sqrt(a);
    case 'cbrt': return Math.cbrt(a);
    case 'abs': return Math.abs(a);
    case 'exp': return Math.exp(a);
    case 'round': return Math.round(a);
    case 'floor': return Math.floor(a);
    case 'ceil': return Math.ceil(a);
    case 'sign': return Math.sign(a);
    default: throw new MathError(`Непозната функция ${name}`);
  }
}

/** Evaluates one expression. `vars` lets the grapher feed in x. */
export function evaluate(src: string, angle: AngleMode = 'rad', vars: Record<string, number> = {}): number {
  const replaced = Object.keys(vars).length
    ? src.replace(/\b[a-z]\b/gi, (m) => (m in vars ? `(${vars[m]})` : m))
    : src;
  const tokens = tokenize(replaced);
  const values: number[] = [];
  const ops: (string | 'lp')[] = [];

  for (const tok of tokens) {
    if (tok.t === 'num') values.push(tok.v);
    else if (tok.t === 'fn') ops.push(tok.v);
    else if (tok.t === 'lp') ops.push('lp');
    else if (tok.t === 'rp') {
      while (ops.length && ops[ops.length - 1] !== 'lp') apply(ops.pop() as string, values, angle);
      if (!ops.length) throw new MathError('Липсва отваряща скоба');
      ops.pop();
      if (ops.length && FUNCTIONS.has(ops[ops.length - 1] as string)) {
        apply(ops.pop() as string, values, angle);
      }
    } else if (tok.t === 'op') {
      if (tok.v === '!') {
        apply('!', values, angle);
        continue;
      }
      const me = PRECEDENCE[tok.v];
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top === 'lp') break;
        const other = PRECEDENCE[top as string];
        const isFn = FUNCTIONS.has(top as string);
        if (!isFn && (!other || other.p < me.p || (other.p === me.p && me.right))) break;
        apply(ops.pop() as string, values, angle);
      }
      ops.push(tok.v);
    }
  }
  while (ops.length) {
    const op = ops.pop() as string;
    if (op === 'lp') throw new MathError('Липсва затваряща скоба');
    apply(op, values, angle);
  }
  if (values.length !== 1) throw new MathError('Непълен израз');
  const result = values[0];
  if (!Number.isFinite(result)) throw new MathError('Резултатът не е число');
  return result;
}

/** Human-sized formatting: no 0.30000000000000004, no 1e+21 for 12 digits. */
export function formatNumber(n: number, digits = 10): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-9) return n.toExponential(6).replace('e', '×10^');
  const rounded = Number(n.toPrecision(digits));
  return String(rounded);
}
