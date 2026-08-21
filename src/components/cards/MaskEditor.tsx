import { useRef, useState } from 'react';
import type { Rect } from '@/types';
import { Icon } from '../Icon';

/**
 * Draw rectangles over a picture to hide parts of it. Coordinates are stored
 * as fractions of the image, so a mask keeps its place at any display size.
 */
export function MaskEditor({
  src,
  masks,
  onChange,
}: {
  src: string;
  masks: Rect[];
  onChange: (masks: Rect[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  /** the in-flight rectangle, read on pointerup without going through state */
  const live = useRef<Rect | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    const ox = (e.clientX - box.left) / box.width;
    const oy = (e.clientY - box.top) / box.height;
    const move = (ev: PointerEvent) => {
      const x = (ev.clientX - box.left) / box.width;
      const y = (ev.clientY - box.top) / box.height;
      live.current = {
        x: Math.max(0, Math.min(ox, x)),
        y: Math.max(0, Math.min(oy, y)),
        w: Math.min(1, Math.abs(x - ox)),
        h: Math.min(1, Math.abs(y - oy)),
      };
      setDraft(live.current);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const rect = live.current;
      live.current = null;
      setDraft(null);
      if (rect && rect.w > 0.015 && rect.h > 0.01) onChange([...masks, rect]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="space-y-1.5">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        className="relative select-none overflow-hidden rounded-lg border border-line bg-white"
        style={{ cursor: 'crosshair', touchAction: 'none' }}
      >
        <img src={src} alt="" className="block w-full" draggable={false} />
        {masks.map((m, i) => (
          <button
            key={i}
            onPointerDown={(e) => {
              e.stopPropagation();
              onChange(masks.filter((_, j) => j !== i));
            }}
            className="absolute grid cursor-pointer place-items-center rounded-[3px] text-[10px] font-semibold"
            style={{
              left: `${m.x * 100}%`,
              top: `${m.y * 100}%`,
              width: `${m.w * 100}%`,
              height: `${m.h * 100}%`,
              background: 'color-mix(in srgb, var(--c-accent) 78%, transparent)',
              color: 'var(--c-accent-text)',
            }}
            title="Махни закритието"
          >
            {i + 1}
          </button>
        ))}
        {draft && (
          <div
            className="pointer-events-none absolute rounded-[3px]"
            style={{
              left: `${draft.x * 100}%`,
              top: `${draft.y * 100}%`,
              width: `${draft.w * 100}%`,
              height: `${draft.h * 100}%`,
              background: 'color-mix(in srgb, var(--c-accent) 45%, transparent)',
              outline: '1.5px solid var(--c-accent)',
            }}
          />
        )}
      </div>
      <div className="flex items-start gap-2 text-[11px] leading-snug text-muted">
        <Icon name="info" size={12} className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          Влачи върху картинката, за да закриеш част. Клик върху закритие го маха.
        </span>
        {masks.length > 0 && (
          <span className="chip shrink-0" style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
            {masks.length} {masks.length === 1 ? 'карта' : 'карти'}
          </span>
        )}
      </div>
    </div>
  );
}
