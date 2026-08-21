import type { GridOverlay, InstrumentId } from '@/types';
import { useInstruments } from '@/state/instrumentStore';
import { Icon } from '../Icon';
import { Popover, Slider, Tip, Toggle } from '../ui';

const TOOLS: { id: InstrumentId; label: string; icon: string; hint: string }[] = [
  { id: 'ruler', label: 'Линийка', icon: 'ruler', hint: 'Права линия по ръба, със сантиметри' },
  { id: 'setsquare', label: 'Триъгълник', icon: 'setsquare', hint: '45·45 или 30·60, три ръба' },
  { id: 'protractor', label: 'Транспортир', icon: 'protractor', hint: 'Мери и нанася ъгли' },
  { id: 'compass', label: 'Пергел', icon: 'compass', hint: 'Дъги и окръжности с точен радиус' },
];

const GRIDS: { id: GridOverlay; label: string; icon: string }[] = [
  { id: 'off', label: 'Без', icon: 'x' },
  { id: 'square', label: 'Квадрати', icon: 'gridSquare' },
  { id: 'dots', label: 'Точки', icon: 'gridDots' },
  { id: 'iso', label: 'Изометрия', icon: 'gridIso' },
  { id: 'polar', label: 'Ъгли', icon: 'gridAngle' },
];

/** Toolbar entry for the drawing instruments and the guide grid. */
export function InstrumentButton() {
  const store = useInstruments();
  const activeCount = TOOLS.filter((t) => store[t.id].on).length + (store.grid !== 'off' ? 1 : 0);

  return (
    <Popover
      width={264}
      align="end"
      side="top"
      trigger={({ toggle, ref, open }) => (
        <Tip label="Геометрични инструменти">
          <button
            ref={ref}
            onClick={toggle}
            className={`icon-btn relative h-9 w-9 ${open || activeCount ? 'btn-ghost-active' : ''}`}
            aria-label="Геометрични инструменти"
          >
            <Icon name="setsquare" size={18} />
            {activeCount > 0 && (
              <span
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--c-accent)' }}
              />
            )}
          </button>
        </Tip>
      )}
    >
      {() => (
        <div className="space-y-2 p-0.5">
          <div>
            <div className="px-1.5 pb-1 label">
              Инструменти
            </div>
            <div className="grid grid-cols-2 gap-1">
              {TOOLS.map((t) => {
                const on = store[t.id].on;
                return (
                  <button
                    key={t.id}
                    onClick={() => store.toggle(t.id)}
                    title={t.hint}
                    className="flex cursor-pointer flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors"
                    style={{
                      background: on ? 'var(--c-accent-soft)' : 'var(--c-surface-2)',
                      color: on ? 'var(--c-accent)' : 'var(--c-text)',
                      outline: on ? '1px solid var(--c-accent)' : '1px solid transparent',
                    }}
                  >
                    <Icon name={t.icon} size={16} />
                    <span className="text-[11.5px] font-medium">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-line pt-1.5">
            <div className="px-1.5 pb-1 label">
              Мрежа върху екрана
            </div>
            <div className="flex gap-1">
              {GRIDS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => store.setGrid(g.id)}
                  title={g.label}
                  className={`grid h-8 flex-1 cursor-pointer place-items-center rounded-lg transition-colors ${
                    store.grid === g.id ? 'btn-ghost-active' : 'text-muted hover:bg-surface-3'
                  }`}
                >
                  <Icon name={g.icon} size={15} />
                </button>
              ))}
            </div>

            {store.grid !== 'off' && (
              <div className="mt-2 space-y-2 px-0.5">
                {store.grid === 'polar' ? (
                  <Slider
                    label="Стъпка"
                    min={5}
                    max={45}
                    step={5}
                    suffix="°"
                    value={store.gridStep}
                    onChange={store.setGridStep}
                  />
                ) : (
                  <Slider
                    label="Гъстота"
                    min={12}
                    max={96}
                    step={2}
                    suffix=" px"
                    value={store.gridSize}
                    onChange={store.setGridSize}
                  />
                )}
                <Toggle
                  checked={store.gridSnap}
                  onChange={store.setGridSnap}
                  label="Мастилото се лепи за мрежата"
                />
              </div>
            )}
          </div>

          {(store.anyOn() || store.grid !== 'off') && (
            <button
              className="btn w-full"
              onClick={() => {
                store.hideAll();
                store.setGrid('off');
              }}
            >
              <Icon name="x" size={14} />
              Махни всичко
            </button>
          )}

          <p className="px-1.5 pb-0.5 text-[10.5px] leading-relaxed text-faint">
            Инструментът стои върху екрана, не върху листа. Пипни го, за да го местиш, дръжката с
            кръгчето го върти.
          </p>
        </div>
      )}
    </Popover>
  );
}
