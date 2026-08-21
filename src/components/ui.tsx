import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 460,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /**
   * Escape closes, Tab stays inside, and the focus goes back where it came
   * from afterwards. Without the trap, tabbing walks out of the dialog and
   * into the page behind it — which for a screen-reader user means the dialog
   * effectively is not there.
   */
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const focusables = () =>
      [
        ...(panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((el) => el.offsetParent !== null);

    const id = requestAnimationFrame(() => {
      const first = focusables()[0];
      (first ?? panelRef.current)?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey, true);
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgb(8 10 14 / 45%)', backdropFilter: 'blur(2px)' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="panel animate-scale w-full max-h-[85vh] overflow-hidden flex flex-col outline-none"
        style={{ maxWidth: width }}
      >
        <header className="flex items-center justify-between px-4 h-12 border-b border-line shrink-0">
          <h2 id={titleId} className="text-[14px] font-semibold">
            {title}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Затвори">
            <Icon name="x" size={16} />
          </button>
        </header>
        <div className="p-4 overflow-auto scroll-thin text-[13px]">{children}</div>
        {footer && <footer className="flex justify-end gap-2 px-4 py-3 border-t border-line shrink-0">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------- dropdown */

/**
 * Lightweight anchored popover. Positions itself in the viewport with a
 * portal, so it is never clipped by the scroll containers it lives in.
 */
export function Popover({
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  width,
  className = '',
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end' | 'center';
  side?: 'bottom' | 'top';
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const place = () => {
      const a = anchorRef.current!.getBoundingClientRect();
      const p = panelRef.current?.getBoundingClientRect();
      const w = width ?? p?.width ?? 200;
      const h = p?.height ?? 200;
      let left = align === 'end' ? a.right - w : align === 'center' ? a.left + a.width / 2 - w / 2 : a.left;
      // Flip to the other side when the preferred one does not fit, then clamp
      // — without the clamp a menu opened from a header lands off-screen.
      const above = a.top - h - 6;
      const below = a.bottom + 6;
      let top = side === 'top' ? above : below;
      if (top + h > window.innerHeight - 8) top = above;
      if (top < 8) top = below;
      top = Math.min(Math.max(8, top), Math.max(8, window.innerHeight - h - 8));
      left = Math.min(Math.max(8, left), Math.max(8, window.innerWidth - w - 8));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, side, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <>
      {trigger({ open, toggle: () => setOpen((v) => !v), ref: anchorRef })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className={`panel animate-in fixed z-50 p-1.5 ${className}`}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, visibility: pos ? 'visible' : 'hidden' }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  icon,
  label,
  onClick,
  danger,
  shortcut,
  active,
}: {
  icon?: string;
  label: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  shortcut?: string;
  active?: boolean;
}) {
  return (
    <button
      className="flex w-full items-center gap-2.5 rounded-lg px-2 h-8 text-[13px] text-left transition-colors cursor-pointer hover:bg-surface-3"
      style={{ color: danger ? 'var(--c-danger)' : active ? 'var(--c-accent)' : undefined }}
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={15} className="shrink-0 opacity-80" />}
      <span className="flex-1 truncate">{label}</span>
      {shortcut && <span className="text-[11px] text-faint">{shortcut}</span>}
      {active && <Icon name="check" size={14} />}
    </button>
  );
}

export const MenuSep = () => <div className="my-1 h-px bg-line" />;

/* ---------------------------------------------------------------- select */

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  icon?: string;
  color?: string;
}

/**
 * A real dropdown, not a text field with a `datalist` behind it. Browsers
 * render datalists inconsistently and several never show the list at all,
 * which turned "pick the deck" into "retype the deck name".
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = 'Избери…',
  width = 240,
  className = '',
  onCreate,
  createLabel = 'Ново…',
}: {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number;
  className?: string;
  /** shows an inline "add" row at the bottom of the list */
  onCreate?: (name: string) => void;
  createLabel?: string;
}) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <Popover
      width={width}
      align="start"
      className={className}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="field flex items-center gap-2 text-left"
        >
          {current?.color && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: current.color }} />
          )}
          {current?.icon && <Icon name={current.icon} size={14} className="shrink-0 opacity-70" />}
          <span className={`flex-1 truncate ${current ? '' : 'text-faint'}`}>
            {current?.label ?? placeholder}
          </span>
          <Icon name="chevronDown" size={13} className="shrink-0 text-faint" />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-[300px] overflow-y-auto scroll-thin">
          {options.map((o) => (
            <button
              key={o.value}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-3"
              onClick={() => {
                onChange(o.value);
                close();
              }}
            >
              {o.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.color }} />}
              {o.icon && <Icon name={o.icon} size={14} className="shrink-0 opacity-70" />}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.hint && <span className="shrink-0 text-[11px] text-faint">{o.hint}</span>}
              {o.value === value && <Icon name="check" size={14} className="shrink-0 text-accent" />}
            </button>
          ))}

          {onCreate &&
            (adding ? (
              <form
                className="mt-1 flex gap-1 border-t border-line pt-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = draft.trim();
                  if (!name) return;
                  onCreate(name);
                  setDraft('');
                  setAdding(false);
                  close();
                }}
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Име"
                  className="field h-7"
                />
                <button className="btn h-7 shrink-0 px-2" type="submit">
                  <Icon name="check" size={14} />
                </button>
              </form>
            ) : (
              <button
                className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border-t border-line px-2 py-1.5 text-left text-[13px] text-accent transition-colors hover:bg-surface-3"
                onClick={() => setAdding(true)}
              >
                <Icon name="plus" size={14} />
                {createLabel}
              </button>
            ))}
        </div>
      )}
    </Popover>
  );
}

/* ---------------------------------------------------------------- slider */

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  suffix = '',
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.round(value * 10) / 10}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--c-accent)] cursor-pointer"
      />
    </label>
  );
}

/* ----------------------------------------------------------------- toggle */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="mt-0.5 h-[18px] w-[32px] shrink-0 rounded-full transition-colors cursor-pointer"
        style={{ background: checked ? 'var(--c-accent)' : 'var(--c-line-strong)' }}
      >
        <span
          className="block h-[14px] w-[14px] rounded-full bg-white transition-transform"
          style={{ transform: `translateX(${checked ? 16 : 2}px)` }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13px] leading-tight">{label}</span>
        {hint && <span className="block text-[11px] text-muted mt-0.5 leading-snug">{hint}</span>}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------- confirm */

export function useConfirm() {
  const [state, setState] = useState<{ message: string; onYes: () => void; danger?: boolean } | null>(null);
  const confirm = useCallback((message: string, onYes: () => void, danger = true) => {
    setState({ message, onYes, danger });
  }, []);
  const element = (
    <Modal
      open={!!state}
      onClose={() => setState(null)}
      title="Потвърждение"
      width={380}
      footer={
        <>
          <button className="btn" onClick={() => setState(null)}>
            Отказ
          </button>
          <button
            className="btn btn-primary"
            style={state?.danger ? { background: 'var(--c-danger)' } : undefined}
            onClick={() => {
              state?.onYes();
              setState(null);
            }}
          >
            Продължи
          </button>
        </>
      }
    >
      <p className="text-muted leading-relaxed">{state?.message}</p>
    </Modal>
  );
  return { confirm, element };
}

/* -------------------------------------------------------------- tooltip */

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-1
          text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: 'var(--c-text)', color: 'var(--c-surface)' }}
      >
        {label}
      </span>
    </span>
  );
}
