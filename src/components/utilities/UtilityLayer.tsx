import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DockSide, UtilityWindow } from '@/types';
import { UTILITIES, dockedAt, useUtilities, utilityDef } from '@/state/utilityStore';
import { forgetPanel } from './panelState';
import { clamp } from '@/lib/util';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover, Tip } from '../ui';
import { UtilityBody } from './UtilityBody';

/**
 * Tools that live beside the page.
 *
 * A window is either floating over everything or clipped to one edge of the
 * reading area. Docking is not a cosmetic difference: a docked panel takes
 * real width away from the document, so "solve on the left, calculator on the
 * right" is an actual split screen rather than a box sitting on top of the
 * work.
 *
 * The drop zones appear only while a window is being dragged, which is what
 * makes "pull it to the side and leave it there" discoverable without a
 * single instruction.
 */

/** The element docks measure themselves against. */
export const DOCK_AREA_ID = 'study-dock-area';

const SNAP_PX = 64;
const MIN_SPLIT = 0.16;
const MAX_SPLIT = 0.62;

/** The reading area, or the whole window when no document is open. */
const areaRect = (): DOMRect =>
  document.getElementById(DOCK_AREA_ID)?.getBoundingClientRect() ??
  new DOMRect(0, 0, window.innerWidth, window.innerHeight);

/** Docking needs somewhere to dock to; outside a document there is nowhere. */
const canDock = (): boolean => !!document.getElementById(DOCK_AREA_ID);

/* -------------------------------------------------------------- floating */

export function UtilityFloatLayer() {
  const windows = useUtilities((s) => s.windows);
  const viewport = useViewportSize();
  // A panel docked while a document was open would otherwise disappear on the
  // planner or the dashboard, where no dock exists — so it floats again.
  const homeless = !canDock();
  const floating = windows.filter((w) => w.dock === 'float' || homeless);
  // Stacking order comes from the rank, not from the raw counter: the counter
  // grows without bound and would eventually climb over dialogs and the timer.
  const order = new Map([...floating].sort((a, b) => a.z - b.z).map((w, i) => [w.wid, i]));
  const minimized = windows.filter((w) => w.minimized && w.dock !== 'float' && !homeless);
  const [hint, setHint] = useState<DockSide | null>(null);

  if (!floating.length && !minimized.length) return null;

  return (
    <>
      {hint && hint !== 'float' && <DropHint side={hint} />}
      {floating.map((w) => (
        <FloatingWindow
          key={w.wid}
          win={w}
          rank={order.get(w.wid) ?? 0}
          viewport={viewport}
          onHint={setHint}
        />
      ))}
      {minimized.length > 0 && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-[60] flex -translate-x-1/2 gap-1.5">
          {minimized.map((w) => (
            <button
              key={w.wid}
              className="panel pointer-events-auto flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px]"
              style={{ boxShadow: 'var(--shadow-float)' }}
              onClick={() => useUtilities.getState().update(w.wid, { minimized: false })}
            >
              <Icon name={utilityDef(w.id).icon} size={14} />
              {utilityDef(w.id).name}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function FloatingWindow({
  win,
  rank,
  viewport,
  onHint,
}: {
  win: UtilityWindow;
  rank: number;
  viewport: { w: number; h: number };
  onHint: (s: DockSide | null) => void;
}) {
  const def = utilityDef(win.id);
  // Clamped at render, not only when the window is resized: a panel saved on a
  // laptop must still fit when the same account is opened on a phone.
  const width = Math.min(win.w, viewport.w - 16);
  const height = Math.min(win.h, viewport.h - 72);
  const left = clamp(win.x, 8, Math.max(8, viewport.w - width - 8));
  const top = clamp(win.y, 8, Math.max(8, viewport.h - 44));
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ w: number; h: number; x: number; y: number } | null>(null);

  /** Which edge the pointer is close enough to for a drop. */
  const zoneAt = useCallback((clientX: number, clientY: number): DockSide => {
    if (!canDock()) return 'float';
    const r = areaRect();
    if (clientX - r.left < SNAP_PX) return 'left';
    if (r.right - clientX < SNAP_PX) return 'right';
    if (clientY - r.top < SNAP_PX) return 'top';
    if (r.bottom - clientY < SNAP_PX) return 'bottom';
    return 'float';
  }, []);

  const onHeaderDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
    useUtilities.getState().focus(win.wid);
  };

  const onHeaderMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = clamp(e.clientX - drag.current.dx, -win.w + 80, window.innerWidth - 80);
    const y = clamp(e.clientY - drag.current.dy, 0, window.innerHeight - 44);
    useUtilities.getState().update(win.wid, { x, y });
    onHint(zoneAt(e.clientX, e.clientY));
  };

  const onHeaderUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    onHint(null);
    const side = zoneAt(e.clientX, e.clientY);
    if (side !== 'float') useUtilities.getState().dock(win.wid, side);
  };

  const onResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resize.current = { w: win.w, h: win.h, x: e.clientX, y: e.clientY };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r) return;
    useUtilities.getState().update(win.wid, {
      w: clamp(r.w + (e.clientX - r.x), 240, window.innerWidth - 24),
      h: clamp(r.h + (e.clientY - r.y), 180, window.innerHeight - 24),
    });
  };

  return (
    <section
      className="panel fixed flex flex-col overflow-hidden"
      style={{
        left,
        top,
        width,
        height: win.minimized ? undefined : height,
        // above the toolbar (30), below dialogs (50) and the timer (66)
        zIndex: 32 + Math.min(rank, 15),
        boxShadow: 'var(--shadow-float)',
      }}
      onPointerDown={() => useUtilities.getState().focus(win.wid)}
    >
      <Chrome
        win={win}
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
      />
      {!win.minimized && (
        <>
          <div className="min-h-0 flex-1 overflow-hidden">
            <UtilityBody id={win.id} wid={win.wid} />
          </div>
          <span
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={() => (resize.current = null)}
            style={{
              background:
                'linear-gradient(135deg, transparent 45%, var(--c-line-strong) 45%, var(--c-line-strong) 55%, transparent 55%)',
            }}
            aria-hidden
          />
        </>
      )}
      <span className="sr-only">{def.name}</span>
    </section>
  );
}

/* ------------------------------------------------------------------ dock */

export function UtilityDock({ side }: { side: DockSide }) {
  const windows = useUtilities((s) => s.windows);
  const list = dockedAt(windows, side);
  const drag = useRef<{ start: number; split: number } | null>(null);
  if (!list.length || side === 'float') return null;

  const vertical = side === 'left' || side === 'right';
  const split = Math.max(...list.map((w) => w.split));

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { start: vertical ? e.clientX : e.clientY, split };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = areaRect();
    const total = vertical ? r.width : r.height;
    const delta = (vertical ? e.clientX : e.clientY) - d.start;
    const sign = side === 'left' || side === 'top' ? 1 : -1;
    const next = clamp(d.split + (delta * sign) / Math.max(1, total), MIN_SPLIT, MAX_SPLIT);
    for (const w of list) useUtilities.getState().update(w.wid, { split: next });
  };

  const size = `${Math.round(split * 100)}%`;
  const handleSide =
    side === 'left' ? 'right-0 top-0 h-full w-1.5 cursor-col-resize'
    : side === 'right' ? 'left-0 top-0 h-full w-1.5 cursor-col-resize'
    : side === 'top' ? 'bottom-0 left-0 w-full h-1.5 cursor-row-resize'
    : 'top-0 left-0 w-full h-1.5 cursor-row-resize';

  return (
    <div
      className={`relative flex shrink-0 gap-px ${vertical ? 'flex-col' : 'flex-row'}`}
      style={{
        [vertical ? 'width' : 'height']: size,
        background: 'var(--c-line)',
        borderLeft: side === 'right' ? '1px solid var(--c-line)' : undefined,
        borderRight: side === 'left' ? '1px solid var(--c-line)' : undefined,
        borderTop: side === 'bottom' ? '1px solid var(--c-line)' : undefined,
        borderBottom: side === 'top' ? '1px solid var(--c-line)' : undefined,
      }}
    >
      {list.map((w) => (
        <DockedWindow key={w.wid} win={w} />
      ))}
      <span
        className={`absolute z-10 ${handleSide}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        aria-hidden
      />
    </div>
  );
}

function DockedWindow({ win }: { win: UtilityWindow }) {
  const drag = useRef(false);

  /** Dragging the header out of the dock turns the panel back into a window. */
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const r = areaRect();
    const out =
      e.clientX < r.left + SNAP_PX / 2 ||
      e.clientX > r.right - SNAP_PX / 2 ||
      e.clientY < r.top + SNAP_PX / 2 ||
      e.clientY > r.bottom - SNAP_PX / 2;
    if (out) return;
    const def = utilityDef(win.id);
    drag.current = false;
    useUtilities.getState().update(win.wid, {
      dock: 'float',
      x: clamp(e.clientX - 140, 8, window.innerWidth - 200),
      y: clamp(e.clientY - 16, 8, window.innerHeight - 120),
      w: def.w,
      h: def.h,
    });
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ background: 'var(--c-surface)' }}>
      <Chrome
        win={win}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          drag.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = false)}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <UtilityBody id={win.id} wid={win.wid} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- chrome */

function Chrome({
  win,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  win: UtilityWindow;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const def = utilityDef(win.id);
  const store = useUtilities.getState;

  return (
    <header
      className="flex h-9 shrink-0 cursor-grab items-center gap-1.5 border-b border-line px-2 select-none active:cursor-grabbing"
      style={{ background: 'var(--c-surface-2)', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Icon name={def.icon} size={15} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{def.name}</span>

      <Popover
        width={200}
        align="end"
        trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn h-6 w-6" onClick={toggle} aria-label="Разположение">
            <Icon name={win.dock === 'float' ? 'float' : `dock${cap(win.dock)}`} size={14} />
          </button>
        )}
      >
        {(close) => (
          <>
            {(
              [
                ['float', 'Свободно', 'float'],
                ['left', 'Отляво', 'dockLeft'],
                ['right', 'Отдясно', 'dockRight'],
                ['top', 'Отгоре', 'dockTop'],
                ['bottom', 'Отдолу', 'dockBottom'],
              ] as const
            )
              .filter(([side]) => side === 'float' || canDock())
              .map(([side, label, icon]) => (
              <MenuItem
                key={side}
                icon={icon}
                label={label}
                active={win.dock === side}
                onClick={() => {
                  store().dock(win.wid, side);
                  close();
                }}
              />
            ))}
            <MenuSep />
            <MenuItem
              icon="minimize"
              label="Свий"
              onClick={() => {
                store().update(win.wid, { minimized: true });
                close();
              }}
            />
          </>
        )}
      </Popover>

      {win.dock === 'float' && (
        <button
          className="icon-btn h-6 w-6"
          onClick={() => store().update(win.wid, { minimized: !win.minimized })}
          aria-label={win.minimized ? 'Разгъни' : 'Свий'}
        >
          <Icon name={win.minimized ? 'maximize' : 'minimize'} size={14} />
        </button>
      )}
      <button
        className="icon-btn h-6 w-6"
        onClick={() => {
          forgetPanel(win.wid);
          store().close(win.wid);
        }}
        aria-label="Затвори"
      >
        <Icon name="x" size={14} />
      </button>
    </header>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The translucent target that appears while a window is dragged near an edge. */
function DropHint({ side }: { side: DockSide }) {
  const r = areaRect();
  const thick = side === 'left' || side === 'right' ? r.width * 0.32 : r.height * 0.32;
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 59,
    background: 'color-mix(in srgb, var(--c-accent) 16%, transparent)',
    border: '2px dashed var(--c-accent)',
    borderRadius: 12,
    pointerEvents: 'none',
    left: side === 'right' ? r.right - thick : r.left,
    top: side === 'bottom' ? r.bottom - thick : r.top,
    width: side === 'left' || side === 'right' ? thick : r.width,
    height: side === 'top' || side === 'bottom' ? thick : r.height,
  };
  return <div style={style} className="animate-in" />;
}

/* ---------------------------------------------------------------- picker */

/** The button that opens the tool tray, for the document toolbar. */
export function UtilityButton({ compact = false }: { compact?: boolean }) {
  const windows = useUtilities((s) => s.windows);

  return (
    <Popover
      width={278}
      align="end"
      side="top"
      trigger={({ toggle, ref, open }) => (
        <Tip label="Помощни инструменти">
          <button
            ref={ref}
            onClick={toggle}
            className={`icon-btn relative ${compact ? '' : 'h-9 w-9'} ${
              open || windows.length ? 'btn-ghost-active' : ''
            }`}
            aria-label="Помощни инструменти"
          >
            <Icon name="tools" size={compact ? 17 : 18} />
            {windows.length > 0 && (
              <span
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--c-accent)' }}
              />
            )}
          </button>
        </Tip>
      )}
    >
      {(close) => <UtilityPicker onPicked={close} />}
    </Popover>
  );
}

export function UtilityPicker({ onPicked }: { onPicked?: () => void }) {
  const windows = useUtilities((s) => s.windows);

  return (
    <div>
      <div className="px-2 pb-1.5 pt-1 label">
        Инструменти настрани
      </div>
      {UTILITIES.map((u) => {
        const on = windows.some((w) => w.id === u.id);
        return (
          <button
            key={u.id}
            className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-3"
            onClick={() => {
              useUtilities.getState().toggle(u.id);
              onPicked?.();
            }}
          >
            <span
              className="mt-px grid h-7 w-7 shrink-0 place-items-center rounded-lg"
              style={{
                background: on ? 'var(--c-accent-soft)' : 'var(--c-surface-2)',
                color: on ? 'var(--c-accent)' : 'var(--c-muted)',
              }}
            >
              <Icon name={u.icon} size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                {u.name}
                {u.online && <Icon name="cloud" size={11} className="text-faint" />}
              </span>
              <span className="block truncate text-[11px] text-muted">{u.hint}</span>
            </span>
            {on && <Icon name="check" size={14} className="mt-1.5 shrink-0 text-accent" />}
          </button>
        );
      })}
      {windows.length > 0 && (
        <>
          <MenuSep />
          <MenuItem
            icon="x"
            label="Затвори всички"
            onClick={() => {
              useUtilities.getState().closeAll();
              onPicked?.();
            }}
          />
        </>
      )}
      <p className="px-2 pb-1 pt-1.5 text-[10.5px] leading-relaxed text-faint">
        {canDock()
          ? 'Хвани лентата с името и я издърпай към ръба на екрана, за да залепне отстрани.'
          : 'Прозорците се местят свободно. Вътре в учебник или дъска могат и да залепват отстрани.'}
      </p>
    </div>
  );
}

/** Current viewport, so the panels can be clamped to it while rendering. */
function useViewportSize(): { w: number; h: number } {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export type { ReactNode };
