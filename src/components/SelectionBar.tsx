import { useMemo } from 'react';
import type { Annotation, ProblemStatus } from '@/types';
import { useViewer } from '@/state/viewerStore';
import { useSnip } from '@/state/snipStore';
import { REGION_COLORS, STATUS_LABEL } from '@/services/renderService';
import { annotationBounds } from '@/lib/util';
import { Icon } from './Icon';
import { TextControls } from './TextControls';

const STATUSES: ProblemStatus[] = ['unsolved', 'solved', 'incorrect', 'review'];
const COLORS = ['#111827', '#1d4ed8', '#dc2626', '#059669', '#d97706', '#7c3aed'];

/** Contextual actions for the current selection. */
export function SelectionBar() {
  const selectedIds = useViewer((s) => s.selectedIds);
  const pages = useViewer((s) => s.pages);

  const items = useMemo(() => {
    const found: Annotation[] = [];
    const wanted = new Set(selectedIds);
    pages.forEach((list) => {
      for (const a of list) if (wanted.has(a.id)) found.push(a);
    });
    return found;
  }, [selectedIds, pages]);

  if (!items.length) return null;

  const regions = items.filter((a) => a.type === 'region');
  const texts = items.filter((a) => a.type === 'text');
  const recolorable = items.filter((a) => a.type !== 'region' && a.type !== 'image');

  const recolor = (color: string) => {
    useViewer
      .getState()
      .replaceAnnotations(recolorable, recolorable.map((a) => ({ ...a, color, updatedAt: Date.now() })));
  };
  const setRegionStatus = useViewer.getState().setRegionStatus;
  const removeAnnotations = useViewer.getState().removeAnnotations;

  return (
    <div
      className="panel pointer-events-auto absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl px-1.5 py-1.5"
      style={{ boxShadow: 'var(--shadow-float)' }}
    >
      <span className="px-1.5 text-[12px] text-muted">{items.length} избрани</span>
      <div className="mx-0.5 h-6 w-px bg-line" />

      {recolorable.length > 0 &&
        COLORS.map((c) => (
          <button
            key={c}
            onClick={() => recolor(c)}
            className="h-5 w-5 rounded-full border border-line-strong transition-transform hover:scale-110 cursor-pointer"
            style={{ background: c }}
            aria-label={`Цвят ${c}`}
          />
        ))}

      {texts.length > 0 && (
        <>
          <div className="mx-0.5 h-6 w-px bg-line" />
          <TextControls
            compact
            value={{
              fontFamily: texts[0].fontFamily,
              align: texts[0].align,
              bold: texts[0].bold,
              italic: texts[0].italic,
            }}
            onChange={(patch) =>
              useViewer
                .getState()
                .replaceAnnotations(texts, texts.map((t) => ({ ...t, ...patch, updatedAt: Date.now() })))
            }
          />
        </>
      )}

      {regions.length > 0 && (
        <>
          {recolorable.length > 0 && <div className="mx-0.5 h-6 w-px bg-line" />}
          {STATUSES.map((s) => (
            <button
              key={s}
              className="chip cursor-pointer"
              style={{ background: `${REGION_COLORS[s]}22`, color: REGION_COLORS[s] }}
              onClick={() => regions.forEach((r) => setRegionStatus(r.id, s))}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </>
      )}

      <div className="mx-0.5 h-6 w-px bg-line" />
      <button
        className="icon-btn"
        title="Изрежи избраното към дъска или карта"
        onClick={() => {
          let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
          for (const a of items) {
            const b = annotationBounds(a);
            x1 = Math.min(x1, b.x);
            y1 = Math.min(y1, b.y);
            x2 = Math.max(x2, b.x + b.w);
            y2 = Math.max(y2, b.y + b.h);
          }
          const pad = 6;
          useViewer.getState().setSelection([]);
          void useSnip.getState().capture(items[0].page, {
            x: Math.max(0, x1 - pad),
            y: Math.max(0, y1 - pad),
            w: x2 - x1 + pad * 2,
            h: y2 - y1 + pad * 2,
          });
        }}
        aria-label="Изрезка"
      >
        <Icon name="scissors" size={16} />
      </button>
      <button
        className="icon-btn"
        style={{ color: 'var(--c-danger)' }}
        onClick={() => removeAnnotations(items)}
        aria-label="Изтрий"
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}
