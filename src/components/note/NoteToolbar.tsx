import { useEffect, useState, type ReactNode } from 'react';
import { useNotes } from '@/state/noteStore';
import { useT, L, type Msg } from '@/i18n';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover, Tip } from '../ui';
import { UtilityButton } from '../utilities/UtilityLayer';
import {
  PRINT_CSS,
  blockTag,
  exec,
  insertCallout,
  insertChecklist,
  insertDivider,
  insertImageAsset,
  insertTable,
  isOn,
  printNote,
  setFontFamily,
  setFontSize,
  setLineHeight,
} from './richText';

/**
 * ───────────────────────────────────────────── the document's tool bar ──
 *
 * The one place a written document's controls live.
 *
 * The tools used to sit in the app header, on every screen, whether or not
 * anything was open — which is how a header ends up carrying a calculator
 * button next to the sign-out menu. They belong to the work: they appear when
 * a document, board or file is open, in the bar that belongs to it.
 *
 * A text document earns a fuller bar than a page of ink, because there is
 * genuinely more to say about a paragraph than about a pen stroke. It is
 * arranged in the order somebody reaches for things: undo, structure, weight,
 * colour, alignment, lists, and then the things you insert.
 */

const TEXT_COLORS = ['#111827', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0ea5e9', '#4f46e5', '#9333ea'];
const MARKER_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff'];
const SIZES = [12, 14, 16, 18, 22, 28, 36];
const LEADING: { value: number; label: Msg }[] = [
  { value: 1.3, label: L('Стегнато', 'Tight') },
  { value: 1.55, label: L('Нормално', 'Normal') },
  { value: 1.8, label: L('Широко', 'Relaxed') },
  { value: 2.2, label: L('Двойно', 'Double') },
];
const FONTS: { label: string; css: string }[] = [
  { label: 'Sans', css: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', css: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
];

const BLOCKS: { tag: string; label: Msg; size: number; weight: number }[] = [
  { tag: 'p', label: L('Основен текст', 'Body text'), size: 14, weight: 400 },
  { tag: 'h1', label: L('Заглавие 1', 'Heading 1'), size: 21, weight: 700 },
  { tag: 'h2', label: L('Заглавие 2', 'Heading 2'), size: 18, weight: 650 },
  { tag: 'h3', label: L('Заглавие 3', 'Heading 3'), size: 15.5, weight: 600 },
  { tag: 'blockquote', label: L('Цитат', 'Quote'), size: 14, weight: 400 },
  { tag: 'pre', label: L('Код', 'Code block'), size: 13, weight: 400 },
];

export function NoteToolbar({ editor }: { editor: HTMLElement | null }) {
  const t = useT();
  const docId = useNotes((s) => s.docId);
  const name = useNotes((s) => s.meta?.name);
  // Re-read on every selection change: a toolbar whose bold button does not
  // light up inside bold text is a toolbar you stop trusting.
  const [, bump] = useState(0);

  useEffect(() => {
    const onChange = () => bump((n) => n + 1);
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, []);

  const block = blockTag();
  const run = (fn: () => void) => () => {
    editor?.focus();
    fn();
    bump((n) => n + 1);
  };

  const pickImage = () => {
    if (!docId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      editor?.focus();
      void insertImageAsset(docId, file);
    };
    input.click();
  };

  return (
    <div className="scroll-none flex items-center gap-0.5 overflow-x-auto border-b border-line bg-surface px-2 py-1.5">
      <Tip label={t(L('Отмени (⌘Z)', 'Undo (⌘Z)'))}>
        <button className="icon-btn h-8 w-8 shrink-0" onClick={run(() => exec('undo'))}>
          <Icon name="undo" size={16} />
        </button>
      </Tip>
      <Tip label={t(L('Върни (⌘⇧Z)', 'Redo (⌘⇧Z)'))}>
        <button className="icon-btn h-8 w-8 shrink-0" onClick={run(() => exec('redo'))}>
          <Icon name="redo" size={16} />
        </button>
      </Tip>

      <Divider />

      {/* ------------------------------------------------------ structure */}
      <Popover
        width={210}
        trigger={({ toggle, ref }) => (
          <button ref={ref} onClick={toggle} className="btn h-8 shrink-0 gap-1.5 px-2 text-[12.5px]">
            {t(BLOCKS.find((b) => b.tag === block)?.label ?? BLOCKS[0].label)}
            <Icon name="chevronDown" size={13} />
          </button>
        )}
      >
        {(close) => (
          <>
            {BLOCKS.map((b) => (
              <button
                key={b.tag}
                onClick={() => {
                  run(() => exec('formatBlock', `<${b.tag}>`))();
                  close();
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-3 ${
                  block === b.tag ? 'btn-ghost-active' : ''
                }`}
              >
                <span
                  style={{
                    fontSize: b.size,
                    fontWeight: b.weight,
                    fontFamily: b.tag === 'pre' ? 'ui-monospace, monospace' : undefined,
                    fontStyle: b.tag === 'blockquote' ? 'italic' : undefined,
                  }}
                >
                  {t(b.label)}
                </span>
                {block === b.tag && <Icon name="check" size={14} className="text-accent" />}
              </button>
            ))}
          </>
        )}
      </Popover>

      <Popover
        width={180}
        trigger={({ toggle, ref }) => (
          <button
            ref={ref}
            onClick={toggle}
            className="btn h-8 shrink-0 gap-1.5 px-2 text-[12.5px]"
            aria-label={t(L('Размер на шрифта', 'Font size'))}
          >
            <Icon name="type" size={14} />
            <Icon name="chevronDown" size={13} />
          </button>
        )}
      >
        {(close) => (
          <>
            {SIZES.map((px) => (
              <MenuItem
                key={px}
                label={`${px} px`}
                onClick={() => {
                  if (editor) run(() => setFontSize(editor, px))();
                  close();
                }}
              />
            ))}
            <MenuSep />
            {FONTS.map((f) => (
              <MenuItem
                key={f.label}
                label={f.label}
                onClick={() => {
                  run(() => setFontFamily(f.css))();
                  close();
                }}
              />
            ))}
            <MenuSep />
            <div className="px-2 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">
              {t(L('Междуредие', 'Line spacing'))}
            </div>
            {LEADING.map((row) => (
              <MenuItem
                key={row.value}
                label={t(row.label)}
                onClick={() => {
                  if (editor) run(() => setLineHeight(editor, row.value))();
                  close();
                }}
              />
            ))}
          </>
        )}
      </Popover>

      <Divider />

      {/* --------------------------------------------------------- weight */}
      <Mark cmd="bold" label={t(L('Получер (⌘B)', 'Bold (⌘B)'))} run={run} on={isOn('bold')} bold />
      <Mark cmd="italic" label={t(L('Курсив (⌘I)', 'Italic (⌘I)'))} run={run} on={isOn('italic')} italic />
      <Mark
        cmd="underline"
        label={t(L('Подчертан (⌘U)', 'Underline (⌘U)'))}
        run={run}
        on={isOn('underline')}
        underline
      />
      <Mark
        cmd="strikeThrough"
        label={t(L('Зачертан', 'Strikethrough'))}
        run={run}
        on={isOn('strikeThrough')}
        strike
      />
      {/* x² and H₂O are not decoration in a study app; they are half of what
          gets written down in maths and chemistry. */}
      <Script kind="super" label={t(L('Горен индекс', 'Superscript'))} run={run} on={isOn('superscript')} />
      <Script kind="sub" label={t(L('Долен индекс', 'Subscript'))} run={run} on={isOn('subscript')} />

      <Divider />

      {/* ---------------------------------------------------------- colour */}
      <Swatches
        label={t(L('Цвят на текста', 'Text colour'))}
        icon="palette"
        colors={TEXT_COLORS}
        onPick={(c) => run(() => exec('foreColor', c))()}
        onClear={() => run(() => exec('removeFormat'))()}
        clearLabel={t(L('Изчисти форматирането', 'Clear formatting'))}
      />
      <Swatches
        label={t(L('Маркер', 'Highlight'))}
        icon="highlighter"
        colors={MARKER_COLORS}
        onPick={(c) => run(() => exec('hiliteColor', c))()}
        onClear={() => run(() => exec('hiliteColor', 'transparent'))()}
        clearLabel={t(L('Без маркер', 'No highlight'))}
      />

      <Divider />

      {/* -------------------------------------------------------- alignment */}
      <Mark cmd="justifyLeft" label={t(L('Ляво', 'Align left'))} run={run} on={isOn('justifyLeft')} />
      <Mark cmd="justifyCenter" label={t(L('Центрирано', 'Centre'))} run={run} on={isOn('justifyCenter')} />
      <Mark cmd="justifyRight" label={t(L('Дясно', 'Align right'))} run={run} on={isOn('justifyRight')} />
      <Mark cmd="justifyFull" label={t(L('Двустранно', 'Justify'))} run={run} on={isOn('justifyFull')} />

      <Divider />

      {/* ------------------------------------------------------------ lists */}
      <Tip label={t(L('Точки', 'Bulleted list'))}>
        <button
          className={`icon-btn h-8 w-8 shrink-0 ${isOn('insertUnorderedList') ? 'btn-ghost-active' : ''}`}
          onClick={run(() => exec('insertUnorderedList'))}
        >
          <Icon name="list" size={16} />
        </button>
      </Tip>
      <Tip label={t(L('Номерирано', 'Numbered list'))}>
        <button
          className={`icon-btn h-8 w-8 shrink-0 ${isOn('insertOrderedList') ? 'btn-ghost-active' : ''}`}
          onClick={run(() => exec('insertOrderedList'))}
        >
          <Icon name="sortDesc" size={16} />
        </button>
      </Tip>
      <Tip label={t(L('Списък за отмятане', 'Checklist'))}>
        <button className="icon-btn h-8 w-8 shrink-0" onClick={run(insertChecklist)}>
          <Icon name="checkCircle" size={16} />
        </button>
      </Tip>
      <Tip label={t(L('Намали отстъпа', 'Outdent'))}>
        <button className="icon-btn h-8 w-8 shrink-0" onClick={run(() => exec('outdent'))}>
          <Icon name="chevronLeft" size={16} />
        </button>
      </Tip>
      <Tip label={t(L('Увеличи отстъпа', 'Indent'))}>
        <button className="icon-btn h-8 w-8 shrink-0" onClick={run(() => exec('indent'))}>
          <Icon name="chevronRight" size={16} />
        </button>
      </Tip>

      <Divider />

      {/* --------------------------------------------------------- inserts */}
      <Popover
        width={230}
        trigger={({ toggle, ref }) => (
          <button ref={ref} onClick={toggle} className="btn h-8 shrink-0 gap-1.5 px-2 text-[12.5px]">
            <Icon name="plus" size={14} />
            {t(L('Вмъкни', 'Insert'))}
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon="image"
              label={t(L('Изображение', 'Image'))}
              onClick={() => {
                pickImage();
                close();
              }}
            />
            <MenuItem
              icon="table"
              label={t(L('Таблица 3 × 3', 'Table 3 × 3'))}
              onClick={() => {
                run(() => insertTable(3, 3))();
                close();
              }}
            />
            <MenuItem
              icon="line"
              label={t(L('Разделител', 'Divider'))}
              onClick={() => {
                run(insertDivider)();
                close();
              }}
            />
            <MenuSep />
            <MenuItem
              icon="info"
              label={t(L('Каре — бележка', 'Callout — note'))}
              onClick={() => {
                run(() => insertCallout('info'))();
                close();
              }}
            />
            <MenuItem
              icon="alert"
              label={t(L('Каре — внимание', 'Callout — warning'))}
              onClick={() => {
                run(() => insertCallout('warn'))();
                close();
              }}
            />
            <MenuItem
              icon="checkCircle"
              label={t(L('Каре — важно', 'Callout — key point'))}
              onClick={() => {
                run(() => insertCallout('good'))();
                close();
              }}
            />
            <MenuSep />
            <MenuItem
              icon="link"
              label={t(L('Уеб връзка', 'Web link'))}
              onClick={() => {
                const url = prompt(t(L('Адрес', 'Address')), 'https://');
                if (url) run(() => exec('createLink', url))();
                close();
              }}
            />
          </>
        )}
      </Popover>

      <Tip label={t(L('Свържи с документ или дъска', 'Link to a document or board'))}>
        <button
          className="icon-btn h-8 w-8 shrink-0"
          onClick={() => useNotes.getState().setPanel('links')}
          aria-label={t(L('Свържи', 'Link'))}
        >
          <Icon name="link" size={16} />
        </button>
      </Tip>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-2">
        <Tip label={t(L('Печат или PDF (⌘P)', 'Print or PDF (⌘P)'))}>
          <button
            className="icon-btn h-8 w-8 shrink-0"
            onClick={() => editor && printNote(name ?? 'Plauvia', editor, PRINT_CSS)}
            aria-label={t(L('Печат', 'Print'))}
          >
            <Icon name="download" size={16} />
          </button>
        </Tip>
        <UtilityButton compact />
      </div>
    </div>
  );
}

/**
 * Superscript and subscript.
 *
 * Kept apart from `Mark` because the glyph has to *show* the effect — a raised
 * and a lowered two beside an x — and a button labelled "S" would be a third
 * thing competing with strikethrough for the same letter.
 */
function Script({
  kind,
  label,
  run,
  on,
}: {
  kind: 'super' | 'sub';
  label: string;
  run: (fn: () => void) => () => void;
  on: boolean;
}) {
  return (
    <Tip label={label}>
      <button
        className={`icon-btn h-8 w-8 shrink-0 ${on ? 'btn-ghost-active' : ''}`}
        onClick={run(() => exec(kind === 'super' ? 'superscript' : 'subscript'))}
        aria-pressed={on}
        aria-label={label}
      >
        <span className="text-[13px] leading-none">
          x
          <span
            className="text-[9px] font-semibold"
            style={{ verticalAlign: kind === 'super' ? 'super' : 'sub' }}
          >
            2
          </span>
        </span>
      </button>
    </Tip>
  );
}

const Divider = () => (
  <span className="mx-1 h-5 w-px shrink-0" style={{ background: 'var(--c-line)' }} aria-hidden />
);

function Mark({
  cmd,
  label,
  run,
  on,
  bold,
  italic,
  underline,
  strike,
}: {
  cmd: string;
  label: string;
  run: (fn: () => void) => () => void;
  on: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}) {
  // The weight buttons show the letter they produce rather than an icon of a
  // letter: it is the one case where the control can simply be the thing.
  const letter = bold ? 'B' : italic ? 'I' : underline ? 'U' : strike ? 'S' : null;
  const align =
    cmd === 'justifyCenter'
      ? 'center'
      : cmd === 'justifyRight'
        ? 'right'
        : cmd === 'justifyFull'
          ? 'justify'
          : 'left';

  return (
    <Tip label={label}>
      <button
        className={`icon-btn h-8 w-8 shrink-0 ${on ? 'btn-ghost-active' : ''}`}
        onClick={run(() => exec(cmd))}
        aria-pressed={on}
        aria-label={label}
      >
        {letter ? (
          <span
            className="text-[14px] leading-none"
            style={{
              fontWeight: bold ? 750 : 500,
              fontStyle: italic ? 'italic' : undefined,
              textDecoration: underline ? 'underline' : strike ? 'line-through' : undefined,
            }}
          >
            {letter}
          </span>
        ) : (
          <AlignGlyph align={align} />
        )}
      </button>
    </Tip>
  );
}

/** Four lines whose ragged edge says which alignment this is. */
function AlignGlyph({ align }: { align: 'left' | 'center' | 'right' | 'justify' }) {
  const widths = align === 'justify' ? [100, 100, 100, 100] : [100, 62, 100, 62];
  return (
    <span className="flex w-[15px] flex-col gap-[2.5px]" aria-hidden>
      {widths.map((w, i) => (
        <span
          key={i}
          className="h-[1.6px] rounded-full"
          style={{
            width: `${w}%`,
            background: 'currentColor',
            marginLeft: align === 'right' ? 'auto' : align === 'center' ? `${(100 - w) / 2}%` : 0,
          }}
        />
      ))}
    </span>
  );
}

function Swatches({
  label,
  icon,
  colors,
  onPick,
  onClear,
  clearLabel,
}: {
  label: string;
  icon: string;
  colors: string[];
  onPick: (color: string) => void;
  onClear: () => void;
  clearLabel: string;
}): ReactNode {
  return (
    <Popover
      width={186}
      trigger={({ toggle, ref }) => (
        <Tip label={label}>
          <button ref={ref} onClick={toggle} className="icon-btn h-8 w-8 shrink-0" aria-label={label}>
            <Icon name={icon} size={16} />
          </button>
        </Tip>
      )}
    >
      {(close) => (
        <div className="p-2">
          <div className="grid grid-cols-4 gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onPick(c);
                  close();
                }}
                aria-label={c}
                className="h-8 cursor-pointer rounded-[8px] transition-transform hover:scale-105"
                style={{ background: c, outline: '1px solid var(--c-line)' }}
              />
            ))}
          </div>
          <button
            onClick={() => {
              onClear();
              close();
            }}
            className="mt-2 w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-surface-3"
          >
            {clearLabel}
          </button>
        </div>
      )}
    </Popover>
  );
}
