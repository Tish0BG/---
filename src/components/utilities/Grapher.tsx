import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluate, formatNumber } from './mathEval';
import { usePanelState } from './panelState';
import { Icon } from '../Icon';

const COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b'];

interface Curve {
  expr: string;
  on: boolean;
}

/**
 * A function plotter, because "what does this actually look like" is half of
 * understanding a function — and because the answer is one panel away instead
 * of one browser tab away.
 */
export function Grapher({ wid }: { wid: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [curves, setCurves] = usePanelState<Curve[]>(wid, 'curves', [
    { expr: 'x^2', on: true },
    { expr: '', on: true },
  ]);
  const [view, setView] = usePanelState(wid, 'view', { cx: 0, cy: 0, scale: 40 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [errors, setErrors] = useState<(string | null)[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue('--c-line').trim() || '#e5e7eb';
    const strong = css.getPropertyValue('--c-line-strong').trim() || '#cbd5e1';
    const text = css.getPropertyValue('--c-muted').trim() || '#6b7280';

    const toPx = (x: number, y: number) => ({
      px: w / 2 + (x - view.cx) * view.scale,
      py: h / 2 - (y - view.cy) * view.scale,
    });

    /* grid: a "nice" step that stays between 40 and 120 px */
    const raw = 60 / view.scale;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s * view.scale >= 40) ?? mag * 10;

    const left = view.cx - w / 2 / view.scale;
    const right = view.cx + w / 2 / view.scale;
    const bottom = view.cy - h / 2 / view.scale;
    const top = view.cy + h / 2 / view.scale;

    ctx.lineWidth = 1;
    ctx.strokeStyle = line;
    ctx.beginPath();
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      const { px } = toPx(x, 0);
      ctx.moveTo(Math.round(px) + 0.5, 0);
      ctx.lineTo(Math.round(px) + 0.5, h);
    }
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
      const { py } = toPx(0, y);
      ctx.moveTo(0, Math.round(py) + 0.5);
      ctx.lineTo(w, Math.round(py) + 0.5);
    }
    ctx.stroke();

    /* axes */
    const origin = toPx(0, 0);
    ctx.strokeStyle = strong;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(origin.py) + 0.5);
    ctx.lineTo(w, Math.round(origin.py) + 0.5);
    ctx.moveTo(Math.round(origin.px) + 0.5, 0);
    ctx.lineTo(Math.round(origin.px) + 0.5, h);
    ctx.stroke();

    ctx.fillStyle = text;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      if (Math.abs(x) < step / 2) continue;
      const { px } = toPx(x, 0);
      ctx.fillText(trimLabel(x), px, Math.min(h - 3, Math.max(10, origin.py + 11)));
    }
    ctx.textAlign = 'right';
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
      if (Math.abs(y) < step / 2) continue;
      const { py } = toPx(0, y);
      ctx.fillText(trimLabel(y), Math.min(w - 3, Math.max(24, origin.px - 4)), py + 3);
    }

    /* the curves */
    const nextErrors: (string | null)[] = [];
    curves.forEach((curve, i) => {
      if (!curve.expr.trim() || !curve.on) {
        nextErrors[i] = null;
        return;
      }
      ctx.strokeStyle = COLORS[i % COLORS.length];
      ctx.lineWidth = 2;
      ctx.beginPath();
      let broke = false;
      let failure: string | null = null;
      let prevY: number | null = null;
      for (let px = 0; px <= w; px++) {
        const x = view.cx + (px - w / 2) / view.scale;
        let y: number;
        try {
          y = evaluate(curve.expr, 'rad', { x });
        } catch (err) {
          failure = err instanceof Error ? err.message : 'Грешка';
          broke = true;
          break;
        }
        if (!Number.isFinite(y) || Math.abs(y) > 1e7) {
          prevY = null;
          continue;
        }
        const py = h / 2 - (y - view.cy) * view.scale;
        // a vertical asymptote must not be joined by a straight line
        const jump = prevY !== null && Math.abs(py - prevY) > h * 1.5;
        if (prevY === null || jump) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        prevY = py;
      }
      if (!broke) ctx.stroke();
      nextErrors[i] = failure;
    });
    setErrors((prev) => (prev.join('|') === nextErrors.join('|') ? prev : nextErrors));

    /* the value under the pointer */
    if (cursor) {
      const x = view.cx + (cursor.x - w / 2) / view.scale;
      ctx.strokeStyle = strong;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursor.x, 0);
      ctx.lineTo(cursor.x, h);
      ctx.stroke();
      ctx.setLineDash([]);
      curves.forEach((curve, i) => {
        if (!curve.expr.trim() || !curve.on) return;
        try {
          const y = evaluate(curve.expr, 'rad', { x });
          if (!Number.isFinite(y)) return;
          const py = h / 2 - (y - view.cy) * view.scale;
          ctx.fillStyle = COLORS[i % COLORS.length];
          ctx.beginPath();
          ctx.arc(cursor.x, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } catch {
          /* undefined here */
        }
      });
    }
  }, [curves, view, cursor]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(box);
    return () => ro.disconnect();
  }, [draw]);

  /* pan and zoom */
  const pan = useRef<{ x: number; y: number } | null>(null);
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => ({ ...v, scale: Math.min(4000, Math.max(2, v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12))) }));
  };

  const traced = cursor
    ? view.cx + (cursor.x - (boxRef.current?.clientWidth ?? 0) / 2) / view.scale
    : null;

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--c-surface)' }}>
      <div className="shrink-0 space-y-1 border-b border-line p-2">
        {curves.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <button
              className="h-4 w-4 shrink-0 rounded-full transition-transform hover:scale-110"
              style={{ background: c.on ? COLORS[i % COLORS.length] : 'var(--c-line-strong)' }}
              onClick={() => setCurves((cs) => cs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
              title={c.on ? 'Скрий' : 'Покажи'}
            />
            <span className="shrink-0 text-[12px] text-faint">y =</span>
            <input
              value={c.expr}
              onChange={(e) => setCurves((cs) => cs.map((x, j) => (j === i ? { ...x, expr: e.target.value } : x)))}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="напр. sin(x)/x"
              spellCheck={false}
              className="field h-7 font-mono text-[12px]"
              style={errors[i] ? { borderColor: 'var(--c-danger)' } : undefined}
            />
            {curves.length > 1 && (
              <button
                className="icon-btn h-6 w-6 shrink-0"
                onClick={() => setCurves((cs) => cs.filter((_, j) => j !== i))}
                aria-label="Махни"
              >
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        ))}
        {curves.length < 4 && (
          <button
            className="flex cursor-pointer items-center gap-1 text-[11px] text-accent"
            onClick={() => setCurves((cs) => [...cs, { expr: '', on: true }])}
          >
            <Icon name="plus" size={12} />
            Още една функция
          </button>
        )}
      </div>

      <div ref={boxRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          style={{ cursor: pan.current ? 'grabbing' : 'crosshair' }}
          onWheel={onWheel}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            pan.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            const box = boxRef.current;
            if (box) {
              const r = box.getBoundingClientRect();
              setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
            }
            if (!pan.current) return;
            const dx = e.clientX - pan.current.x;
            const dy = e.clientY - pan.current.y;
            pan.current = { x: e.clientX, y: e.clientY };
            setView((v) => ({ ...v, cx: v.cx - dx / v.scale, cy: v.cy + dy / v.scale }));
          }}
          onPointerUp={() => (pan.current = null)}
          onPointerLeave={() => {
            pan.current = null;
            setCursor(null);
          }}
        />
        <div className="pointer-events-none absolute left-1.5 top-1.5 flex flex-col gap-1 text-[10px] text-faint">
          {traced !== null && <span className="tabular-nums">x = {formatNumber(traced, 5)}</span>}
          {curves.map((c, i) =>
            c.on && c.expr.trim() && traced !== null ? (
              <span key={i} className="tabular-nums" style={{ color: COLORS[i % COLORS.length] }}>
                {safeValue(c.expr, traced)}
              </span>
            ) : null,
          )}
        </div>
        <div className="absolute bottom-1.5 right-1.5 flex gap-1">
          <button
            className="icon-btn h-6 w-6"
            onClick={() => setView((v) => ({ ...v, scale: v.scale * 1.3 }))}
            aria-label="Увеличи"
          >
            <Icon name="zoomIn" size={13} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            onClick={() => setView((v) => ({ ...v, scale: v.scale / 1.3 }))}
            aria-label="Намали"
          >
            <Icon name="zoomOut" size={13} />
          </button>
          <button
            className="icon-btn h-6 w-6"
            onClick={() => setView({ cx: 0, cy: 0, scale: 40 })}
            aria-label="Центрирай"
          >
            <Icon name="target" size={13} />
          </button>
        </div>
      </div>

      {errors.some(Boolean) && (
        <div className="shrink-0 border-t border-line px-2 py-1 text-[11px]" style={{ color: 'var(--c-danger)' }}>
          {errors.find(Boolean)}
        </div>
      )}
    </div>
  );
}

function safeValue(expr: string, x: number): string {
  try {
    return `y = ${formatNumber(evaluate(expr, 'rad', { x }), 5)}`;
  } catch {
    return 'y = —';
  }
}

function trimLabel(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}
