import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';

/**
 * A bottom sheet: the phone's dialog.
 *
 * A desktop modal centred on a 390 px screen leaves the keyboard covering half
 * of it and the close button somewhere near the notch. The sheet rises from
 * the thumb, is dismissed by dragging down, and keeps its actions in reach.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  /** Fraction of the screen height the sheet is allowed to take. */
  maxHeight = 0.9,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxHeight?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    panel.current.style.transform = `translateY(${dy}px)`;
  };
  const onUp = () => {
    if (!drag.current || !panel.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (dy > 110) onClose();
    else {
      panel.current.style.transition = 'transform 0.24s var(--ease-out)';
      panel.current.style.transform = '';
      setTimeout(() => panel.current && (panel.current.style.transition = ''), 260);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div
        className="absolute inset-0 animate-in"
        style={{ background: 'rgb(6 7 10 / 52%)', backdropFilter: 'blur(3px)' }}
        onPointerDown={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="animate-sheet safe-b relative flex w-full flex-col overflow-hidden"
        style={{
          maxHeight: `${maxHeight * 100}dvh`,
          background: 'var(--c-surface)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderTop: '1px solid var(--c-line)',
          boxShadow: 'var(--shadow-float)',
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 pb-1 active:cursor-grabbing"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          <span className="h-1 w-9 rounded-full" style={{ background: 'var(--c-line-strong)' }} />
        </div>

        {title && (
          <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-1">
            <h2 className="t-h3">{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" size={17} />
            </button>
          </header>
        )}

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-line px-4 py-3">{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
