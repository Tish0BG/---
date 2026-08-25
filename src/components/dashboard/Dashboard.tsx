import { useMemo, useState } from 'react';
import type { DashboardPanel, WidgetSize } from '@/types';
import { useApp } from '@/state/appStore';
import { useSettings } from '@/state/settingsStore';
import { useT, useLang, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover } from '../ui';
import { Button, IconButton, Tooltip, useIsCompact, useIsPhone } from '../kit';
import { Hero } from './Hero';
import { DEFAULT_DASHBOARD, WIDGETS, widgetById } from './widgets';
import { SIZE_LABEL, SPAN } from './widgetTypes';

/**
 * ──────────────────────────────────────────────────────── the dashboard ──
 *
 * One screen, arranged by the person reading it.
 *
 * It used to be a fixed composition — four numbers, a timeline, a chart, a
 * right-hand rail — which is a reasonable guess and still only a guess. The
 * person cramming for finals wants the countdown at the top; the person
 * keeping a reading habit wants the streak and nothing else; somebody using
 * this for work has no use for a grade average at all.
 *
 * So the layout is a list of panels in a preference, and this screen is the
 * grid that draws it plus the mode that rearranges it. The catalogue of what
 * can go on it lives in `widgets.tsx`; nothing here knows what any panel
 * contains, which is what keeps adding one to a single entry in a list.
 */
export function Dashboard({ onNewBoard, onUpload }: { onNewBoard: () => void; onUpload: () => void }) {
  const t = useT();
  const editing = useApp((s) => s.editingDashboard);
  const panels = useSettings((s) => s.dashboard);
  const setSetting = useSettings((s) => s.set);
  const phone = useIsPhone();
  const compact = useIsCompact();

  const band = phone ? 'phone' : compact ? 'tablet' : 'desktop';
  const visible = useMemo(() => panels.filter((p) => !p.hidden && widgetById(p.id)), [panels]);
  const hidden = useMemo(
    () => WIDGETS.filter((w) => !panels.some((p) => p.id === w.id && !p.hidden)),
    [panels],
  );

  const write = (next: DashboardPanel[]) => setSetting('dashboard', next);

  const move = (index: number, delta: number) => {
    const next = [...panels];
    // The visible order is what the person sees, so a move is expressed
    // against that list and then mapped back onto the stored one.
    const from = panels.indexOf(visible[index]);
    const to = panels.indexOf(visible[index + delta]);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    write(next);
  };

  const resize = (id: string, size: WidgetSize) =>
    write(panels.map((p) => (p.id === id ? { ...p, size } : p)));

  const remove = (id: string) => write(panels.map((p) => (p.id === id ? { ...p, hidden: true } : p)));

  const add = (id: string) => {
    const def = widgetById(id);
    if (!def) return;
    const existing = panels.find((p) => p.id === id);
    if (existing) write(panels.map((p) => (p.id === id ? { ...p, hidden: false } : p)));
    else write([...panels, { id, size: def.defaultSize }]);
  };

  return (
    <div className="mx-auto max-w-[1220px] px-4 py-5 sm:px-7 sm:py-7">
      <Hero
        editing={editing}
        onEdit={() => useApp.getState().setEditingDashboard(!editing)}
        onNewBoard={onNewBoard}
        onUpload={onUpload}
      />

      {editing && <EditBanner onReset={() => write(DEFAULT_DASHBOARD)} onDone={() => useApp.getState().setEditingDashboard(false)} />}

      {/* `stagger` while reading, nothing while rearranging: a panel that
          fades in each time it is moved makes the move impossible to follow. */}
      <div
        className={`mt-5 grid gap-4 ${editing ? '' : 'stagger'}`}
        style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
      >
        {visible.map((panel, i) => {
          const def = widgetById(panel.id)!;
          const span = SPAN[panel.size][band];
          return (
            <div key={panel.id} style={{ gridColumn: `span ${span} / span ${span}` }} className="min-w-0">
              {editing ? (
                <EditablePanel
                  panel={panel}
                  def={def}
                  first={i === 0}
                  last={i === visible.length - 1}
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  onResize={(size) => resize(panel.id, size)}
                  onRemove={() => remove(panel.id)}
                />
              ) : (
                def.render()
              )}
            </div>
          );
        })}

        {visible.length === 0 && !editing && (
          <div className="col-span-12">
            <button
              onClick={() => useApp.getState().setEditingDashboard(true)}
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-[16px] border border-dashed px-6 py-14 text-center transition-colors hover:border-line-strong"
              style={{ borderColor: 'var(--c-line)' }}
            >
              <Icon name="dashboard" size={26} className="text-faint" />
              <span className="text-[15px] font-semibold">{t(L('Таблото е празно', 'The dashboard is empty'))}</span>
              <span className="max-w-[42ch] text-[12.5px] text-muted">
                {t(
                  L(
                    'Ти реши какво да стои тук. Натисни, за да избереш панели.',
                    'You decide what lives here. Press to pick some panels.',
                  ),
                )}
              </span>
            </button>
          </div>
        )}
      </div>

      {editing && <Gallery hidden={hidden} onAdd={add} />}
    </div>
  );
}

/* ------------------------------------------------------------ edit mode */

function EditBanner({ onReset, onDone }: { onReset: () => void; onDone: () => void }) {
  const t = useT();
  return (
    <div
      className="animate-rise mt-5 flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3"
      style={{
        borderColor: 'color-mix(in srgb, var(--c-accent) 30%, transparent)',
        background: 'var(--c-accent-soft)',
      }}
    >
      <Icon name="sliders" size={17} className="shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug">
        <span className="font-semibold">{t(L('Подреждаш таблото.', 'You are rearranging the dashboard.'))}</span>{' '}
        <span className="text-muted">
          {t(
            L(
              'Мести панелите със стрелките, сменяй ширината им, махай ги — и добавяй нови отдолу.',
              'Move panels with the arrows, change how wide they are, take them away — and add new ones below.',
            ),
          )}
        </span>
      </p>
      <Button icon="refresh" onClick={onReset}>
        {t(L('Върни по подразбиране', 'Reset to default'))}
      </Button>
      <Button variant="primary" icon="check" onClick={onDone}>
        {t(S.done)}
      </Button>
    </div>
  );
}

/**
 * A panel while the dashboard is being rearranged.
 *
 * The panel itself keeps rendering underneath, dimmed and inert — moving
 * something you cannot see is guesswork, and a placeholder rectangle would
 * make every panel look the same at exactly the moment they need to be
 * telling apart.
 */
function EditablePanel({
  panel,
  def,
  first,
  last,
  onUp,
  onDown,
  onResize,
  onRemove,
}: {
  panel: DashboardPanel;
  def: (typeof WIDGETS)[number];
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const lang = useLang();

  return (
    <div
      className="relative h-full rounded-[16px] p-1.5"
      style={{ outline: '1.5px dashed var(--c-line-strong)', outlineOffset: -2 }}
    >
      <div className="mb-1.5 flex items-center gap-1 px-1">
        <Icon name={def.icon} size={13} className="shrink-0 text-faint" />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-muted">{t(def.title)}</span>

        <IconButton icon="arrowUp" size="sm" label={t(L('Нагоре', 'Move up'))} disabled={first} onClick={onUp} />
        <IconButton
          icon="arrowDown"
          size="sm"
          label={t(L('Надолу', 'Move down'))}
          disabled={last}
          onClick={onDown}
        />

        {def.sizes.length > 1 && (
          <Popover
            width={190}
            align="end"
            trigger={({ toggle, ref }) => (
              <button ref={ref} onClick={toggle} className="icon-btn h-7 w-7" aria-label={t(L('Ширина', 'Width'))}>
                <Icon name="scale" size={14} />
              </button>
            )}
          >
            {(close) => (
              <>
                {def.sizes.map((size) => (
                  <MenuItem
                    key={size}
                    label={t(SIZE_LABEL[size])}
                    active={panel.size === size}
                    onClick={() => {
                      onResize(size);
                      close();
                    }}
                  />
                ))}
                <MenuSep />
                <MenuItem
                  icon="eyeOff"
                  danger
                  label={t(L('Махни панела', 'Remove panel'))}
                  onClick={() => {
                    onRemove();
                    close();
                  }}
                />
              </>
            )}
          </Popover>
        )}

        <Tooltip label={t(L('Махни от таблото', 'Take off the dashboard'))}>
          <IconButton icon="x" size="sm" tone="danger" label={t(L('Махни', 'Remove'))} onClick={onRemove} />
        </Tooltip>
      </div>

      {/* Inert while editing: a chart that reacts to a click meant for the
          layout is a chart that navigates away mid-rearrangement. */}
      <div className="pointer-events-none select-none opacity-70" aria-hidden>
        {def.render()}
      </div>

      <span className="sr-only">{t(SIZE_LABEL[panel.size])}</span>
      <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-faint">
        {lang === 'bg' ? SIZE_LABEL[panel.size].bg : SIZE_LABEL[panel.size].en}
      </span>
    </div>
  );
}

/** The catalogue of panels not currently on the dashboard. */
function Gallery({ hidden, onAdd }: { hidden: typeof WIDGETS; onAdd: (id: string) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const lang = useLang();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hidden;
    return hidden.filter((w) => t(w.title).toLowerCase().includes(q) || t(w.hint).toLowerCase().includes(q));
  }, [hidden, query, t]);

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
            {t(L('Панели, които можеш да добавиш', 'Panels you can add'))}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {hidden.length
              ? t(L(`${hidden.length} налични`, `${hidden.length} available`))
              : t(L('Всичко вече е на таблото.', 'Everything is already on the dashboard.'))}
          </p>
        </div>
        {hidden.length > 4 && (
          <div className="flex h-9 items-center gap-2 rounded-[10px] border border-line px-3" style={{ background: 'var(--c-surface-2)' }}>
            <Icon name="search" size={14} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(L('Търси панел', 'Find a panel'))}
              className="w-[160px] bg-transparent text-[12.5px] outline-none placeholder:text-faint"
            />
          </div>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((w) => (
          <button
            key={w.id}
            onClick={() => onAdd(w.id)}
            className="card card-hover flex cursor-pointer items-start gap-3 p-3.5 text-left"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
              style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}
            >
              <Icon name={w.icon} size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">
                {lang === 'bg' ? w.title.bg : w.title.en}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">
                {lang === 'bg' ? w.hint.bg : w.hint.en}
              </span>
            </span>
            <Icon name="plus" size={16} className="mt-1 shrink-0 text-accent" />
          </button>
        ))}
      </div>
    </section>
  );
}
