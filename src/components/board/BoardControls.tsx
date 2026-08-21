import type { PaperTemplate } from '@/types';
import { useViewer } from '@/state/viewerStore';
import { TEMPLATE_LABELS } from '@/services/boardService';
import { Icon } from '../Icon';
import { MenuSep, Popover, Tip } from '../ui';
import { PaperPreview } from './PaperPreview';

const TEMPLATES: PaperTemplate[] = [
  'blank',
  'lined',
  'lined-wide',
  'grid',
  'grid-large',
  'dots',
  'graph',
  'music',
  'cornell',
];

/** Warm paper tints; null is plain white. */
const TINTS: (string | null)[] = [null, '#fdfaf3', '#f6f4ee', '#eef4f2', '#f2f0f8'];

/**
 * Everything that is specific to a whiteboard, folded into one control in the
 * top bar: which paper, what tint, and (for notebooks) the page operations.
 */
export function BoardControls() {
  const meta = useViewer((s) => s.meta);
  const currentPage = useViewer((s) => s.currentPage);
  const pageCount = useViewer((s) => s.pageCount);
  const size = useViewer((s) => s.pageSize(s.currentPage));
  const board = meta?.board;
  if (!board) return null;

  const scroll = board.flow === 'scroll';
  const active = board.pages[currentPage - 1]?.template ?? board.template;
  const store = useViewer.getState;

  return (
    <Popover
      width={286}
      align="end"
      trigger={({ toggle, ref }) => (
        <Tip label="Хартия и страници">
          <button ref={ref} className="btn gap-1.5" onClick={toggle}>
            <Icon name="rows" size={15} />
            <span className="hidden lg:inline text-[12px]">{TEMPLATE_LABELS[active]}</span>
            <Icon name="chevronDown" size={12} />
          </button>
        </Tip>
      )}
    >
      {(close) => (
        <div className="p-1">
          <div className="px-1 pb-1.5 label">Хартия</div>
          <div className="grid grid-cols-5 gap-1.5 px-1">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                title={TEMPLATE_LABELS[t]}
                onClick={() => void store().setBoardTemplate(t)}
                className="cursor-pointer rounded p-0.5 transition-colors"
                style={{ outline: active === t ? '2px solid var(--c-accent)' : '1px solid var(--c-line)' }}
              >
                <PaperPreview template={t} w={size.width} h={size.width * 1.3} width={40} />
              </button>
            ))}
          </div>

          {!scroll && pageCount > 1 && (
            <button
              className="btn mt-2 w-full justify-start text-[12px]"
              onClick={() => void store().setBoardTemplate(active, currentPage)}
            >
              <Icon name="file" size={14} />
              Смени хартията само на страница {currentPage}
            </button>
          )}

          <div className="mt-2 flex items-center gap-2 px-1">
            <span className="text-[11px] text-muted">Цвят</span>
            {TINTS.map((c, i) => (
              <button
                key={i}
                onClick={() => void store().setBoardPaper(c)}
                className="h-5 w-5 cursor-pointer rounded-full transition-transform hover:scale-110"
                style={{
                  background: c ?? '#ffffff',
                  outline:
                    (board.paper ?? null) === c ? '2px solid var(--c-accent)' : '1px solid var(--c-line-strong)',
                  outlineOffset: 1,
                }}
                aria-label={c ?? 'бяло'}
              />
            ))}
          </div>

          <MenuSep />

          {scroll ? (
            <button
              className="btn w-full justify-start"
              onClick={() => {
                void store().extendBoardPage(1);
                close();
              }}
            >
              <Icon name="arrowDown" size={15} />
              Удължи листа
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <button
                className="btn justify-start"
                onClick={() => {
                  void store().addBoardPage(currentPage);
                  close();
                }}
              >
                <Icon name="pageAdd" size={15} />
                Нова
              </button>
              <button
                className="btn justify-start"
                onClick={() => {
                  void store().duplicateBoardPage(currentPage);
                  close();
                }}
              >
                <Icon name="pageCopy" size={15} />
                Дублирай
              </button>
              <button
                className="btn justify-start"
                disabled={currentPage <= 1}
                onClick={() => void store().moveBoardPage(currentPage, -1)}
              >
                <Icon name="arrowUp" size={15} />
                Нагоре
              </button>
              <button
                className="btn justify-start"
                disabled={currentPage >= pageCount}
                onClick={() => void store().moveBoardPage(currentPage, 1)}
              >
                <Icon name="arrowDown" size={15} />
                Надолу
              </button>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
