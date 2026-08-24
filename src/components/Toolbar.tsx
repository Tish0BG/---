import type { ToolId } from '@/types';
import { useViewer } from '@/state/viewerStore';
import { useSettings } from '@/state/settingsStore';
import { pickImage } from '@/services/imageService';
import { Icon } from './Icon';
import { TextControls } from './TextControls';
import { Popover, Slider, Tip } from './ui';
import { UtilityButton } from './utilities/UtilityLayer';
import { InstrumentButton } from './instruments/InstrumentButton';
import { useT, L, type Msg } from '@/i18n';

interface ToolDef {
  id: ToolId;
  icon: string;
  label: Msg;
  key: string;
}

const GROUPS: ToolDef[][] = [
  [
    { id: 'select', icon: 'cursor', label: L('Избор', 'Select'), key: 'V' },
    { id: 'pan', icon: 'hand', label: L('Местене', 'Pan'), key: 'H' },
  ],
  [
    { id: 'pen', icon: 'pencil', label: L('Писалка', 'Pen'), key: 'P' },
    { id: 'highlighter', icon: 'highlighter', label: L('Маркер', 'Highlighter'), key: 'M' },
    { id: 'eraser', icon: 'eraser', label: L('Гума', 'Eraser'), key: 'E' },
  ],
  [
    { id: 'line', icon: 'line', label: L('Линия', 'Line'), key: 'L' },
    { id: 'rect', icon: 'square', label: L('Правоъгълник', 'Rectangle'), key: 'R' },
    { id: 'ellipse', icon: 'circle', label: L('Кръг', 'Ellipse'), key: 'O' },
    { id: 'arrow', icon: 'arrow', label: L('Стрелка', 'Arrow'), key: 'A' },
  ],
  [
    { id: 'text', icon: 'type', label: L('Текст', 'Text'), key: 'T' },
    { id: 'region', icon: 'region', label: L('Маркиране на задача', 'Mark a problem'), key: 'G' },
    { id: 'snip', icon: 'scissors', label: L('Изрезка към дъска или карта', 'Snip to a board or a card'), key: 'C' },
  ],
];

const PEN_COLORS = ['#111827', '#1d4ed8', '#dc2626', '#059669', '#d97706', '#7c3aed'];
const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#c4b5fd'];

/** Floating tool palette. Sits over the document, thumb-reachable on tablets. */
export function Toolbar() {
  const t = useT();
  const tool = useViewer((s) => s.tool);
  const setTool = useViewer((s) => s.setTool);
  const undo = useViewer((s) => s.undo);
  const redo = useViewer((s) => s.redo);
  const canUndo = useViewer((s) => s.undoStack.length > 0);
  const canRedo = useViewer((s) => s.redoStack.length > 0);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3">
      <div
        className="panel animate-rise pointer-events-auto flex max-w-full items-center gap-0.5 rounded-[12px] px-1.5 py-1.5"
        style={{
          boxShadow: 'var(--shadow-float)',
          background: 'color-mix(in srgb, var(--c-surface) 88%, transparent)',
          backdropFilter: 'blur(14px) saturate(1.4)',
        }}
      >
        {/* The tools scroll on a narrow screen; undo and the colour stay pinned,
            because those are the two things reached for mid-sentence. */}
        <div className="scroll-none flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {GROUPS.map((group, gi) => (
            <div key={gi} className="flex items-center gap-0.5">
              {gi > 0 && <Divider />}
              {group.map((t) => (
                <ToolButton key={t.id} def={t} active={tool === t.id} onClick={() => setTool(t.id)} />
              ))}
            </div>
          ))}
          <Divider />
          <Tip label={t(L("Вмъкни изображение", "Insert an image"))}>
            <button className="icon-btn h-9 w-9" onClick={pickImage}>
              <Icon name="image" size={18} />
            </button>
          </Tip>
          <InstrumentButton />
          <UtilityButton />
        </div>

        <Divider />
        <Tip label={t(L("Отмени (⌘Z)", "Undo (⌘Z)"))}>
          <button className="icon-btn h-9 w-9 shrink-0" disabled={!canUndo} onClick={undo}>
            <Icon name="undo" size={18} />
          </button>
        </Tip>
        <Tip label={t(L("Върни (⌘⇧Z)", "Redo (⌘⇧Z)"))}>
          <button className="icon-btn h-9 w-9 shrink-0" disabled={!canRedo} onClick={redo}>
            <Icon name="redo" size={18} />
          </button>
        </Tip>

        <Divider />
        <ToolOptions />
      </div>
    </div>
  );
}

const Divider = () => <span className="mx-1 h-6 w-px shrink-0" style={{ background: 'var(--c-line)' }} />;

function ToolButton({ def, active, onClick }: { def: ToolDef; active: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <Tip label={`${t(def.label)} (${def.key})`}>
      <button
        className={`icon-btn h-9 w-9 ${active ? 'btn-ghost-active' : ''}`}
        aria-pressed={active}
        onClick={onClick}
      >
        <Icon name={def.icon} size={18} strokeWidth={active ? 2 : 1.75} />
      </button>
    </Tip>
  );
}

/** Colour / size / opacity for the active tool, plus eraser and text options. */
function ToolOptions() {
  const t = useT();
  const tool = useViewer((s) => s.tool);
  const settings = useSettings();
  const preset = settings.toolPresets[tool];

  if (tool === 'eraser') {
    return (
      <Popover
        width={220}
        align="end"
        side="top"
        trigger={({ toggle, ref }) => (
          <button ref={ref} className="btn btn-outline h-9 gap-1.5 px-2" onClick={toggle}>
            <span
              className="rounded-full"
              style={{ width: 16, height: 16, border: '1.5px solid var(--c-line-strong)' }}
            />
            <span className="text-[12px] tabular-nums">{settings.eraserSize}</span>
            <Icon name="chevronUp" size={13} />
          </button>
        )}
      >
        {() => (
          <div className="p-2 space-y-3">
            <div className="segmented">
              {(['partial', 'stroke'] as const).map((m) => (
                <button
                  key={m}
                  aria-pressed={settings.eraserMode === m}
                  onClick={() => settings.set('eraserMode', m)}
                >
                  {t(m === 'partial' ? L('Частична', 'Partial') : L('Цяла черта', 'Whole stroke'))}
                </button>
              ))}
            </div>
            <Slider
              label={t(L("Размер", "Size"))}
              min={6}
              max={64}
              value={settings.eraserSize}
              onChange={(v) => settings.set('eraserSize', v)}
            />
          </div>
        )}
      </Popover>
    );
  }

  if (!preset || tool === 'select' || tool === 'pan' || tool === 'region' || tool === 'snip') return null;

  const palette = tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS;
  const isText = tool === 'text';

  return (
    <Popover
      width={230}
      align="end"
      side="top"
      trigger={({ toggle, ref }) => (
        <button ref={ref} className="btn btn-outline h-9 gap-1.5 px-2" onClick={toggle}>
          <span
            className="h-4.5 w-4.5 rounded-full"
            style={{
              width: 18,
              height: 18,
              background: preset.color,
              opacity: Math.max(preset.opacity, 0.35),
              boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 12%)',
            }}
          />
          <Icon name="chevronUp" size={13} />
        </button>
      )}
    >
      {() => (
        <div className="p-2 space-y-3">
          <div className="grid grid-cols-6 gap-1.5">
            {palette.map((c) => (
              <button
                key={c}
                onClick={() => settings.setPreset(tool, { color: c })}
                className="h-7 w-7 rounded-full transition-transform hover:scale-110 cursor-pointer"
                style={{
                  background: c,
                  outline: preset.color === c ? '2px solid var(--c-accent)' : '1px solid var(--c-line)',
                  outlineOffset: 2,
                }}
                aria-label={c}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted">
            <span>{t(L("Друг цвят", "Custom colour"))}</span>
            <input
              type="color"
              value={preset.color}
              onChange={(e) => settings.setPreset(tool, { color: e.target.value })}
              className="h-6 w-10 cursor-pointer rounded border border-line bg-transparent"
            />
          </label>
          <Slider
            label={t(isText ? L('Размер на шрифта', 'Font size') : L('Дебелина', 'Thickness'))}
            min={isText ? 8 : 0.5}
            max={isText ? 48 : tool === 'highlighter' ? 40 : 12}
            step={isText ? 1 : 0.5}
            value={preset.size}
            onChange={(v) => settings.setPreset(tool, { size: v })}
          />
          <Slider
            label={t(L("Плътност", "Opacity"))}
            min={0.05}
            max={1}
            step={0.05}
            value={preset.opacity}
            onChange={(v) => settings.setPreset(tool, { opacity: v })}
          />
          {isText && (
            <div className="border-t border-line pt-2">
              <TextControls
                value={{
                  fontFamily: settings.textFont,
                  align: settings.textAlign,
                  bold: settings.textBold,
                  italic: settings.textItalic,
                }}
                onChange={(patch) => {
                  if (patch.fontFamily !== undefined) settings.set('textFont', patch.fontFamily);
                  if (patch.align !== undefined) settings.set('textAlign', patch.align);
                  if (patch.bold !== undefined) settings.set('textBold', patch.bold);
                  if (patch.italic !== undefined) settings.set('textItalic', patch.italic);
                }}
              />
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
