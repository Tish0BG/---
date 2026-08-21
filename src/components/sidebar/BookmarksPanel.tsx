import { useMemo } from 'react';
import { useViewer } from '@/state/viewerStore';
import { STATUS_LABEL, REGION_COLORS } from '@/services/renderService';
import { Icon } from '../Icon';
import type { RegionAnnotation } from '@/types';

/** Bookmarks plus every marked problem, as one review list. */
export function BookmarksPanel() {
  const bookmarks = useViewer((s) => s.bookmarks);
  const pages = useViewer((s) => s.pages);
  const goToPage = useViewer((s) => s.goToPage);
  const removeBookmark = useViewer((s) => s.removeBookmark);
  const currentPage = useViewer((s) => s.currentPage);
  const toggleBookmark = useViewer((s) => s.toggleBookmark);

  const regions = useMemo(() => {
    const out: RegionAnnotation[] = [];
    pages.forEach((list) => {
      for (const a of list) if (a.type === 'region') out.push(a);
    });
    return out.sort((a, b) => a.page - b.page || a.y - b.y);
  }, [pages]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { unsolved: 0, solved: 0, incorrect: 0, review: 0 };
    for (const r of regions) c[r.status]++;
    return c;
  }, [regions]);

  return (
    <div className="scroll-thin h-full overflow-y-auto px-3 py-2 text-[12px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Отметки</span>
        <button className="btn h-7 px-2 text-[12px]" onClick={() => void toggleBookmark(currentPage)}>
          <Icon name="bookmark" size={13} />
          {bookmarks.some((b) => b.page === currentPage) ? 'Премахни' : 'Добави'}
        </button>
      </div>

      {bookmarks.length === 0 && <p className="mb-4 text-faint">Няма отметки. Ctrl+D добавя текущата страница.</p>}
      <ul className="mb-4 space-y-0.5">
        {bookmarks.map((b) => (
          <li key={b.id} className="group flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-surface-3">
            <Icon name="bookmark" size={13} fill className="shrink-0 text-warn" />
            <button className="flex-1 cursor-pointer truncate text-left" onClick={() => goToPage(b.page)}>
              {b.label}
            </button>
            <span className="tabular-nums text-faint">{b.page}</span>
            <button
              className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => void removeBookmark(b.id)}
              aria-label="Изтрий отметката"
            >
              <Icon name="x" size={13} />
            </button>
          </li>
        ))}
      </ul>

      <div className="mb-2 flex items-center justify-between">
        <span className="label">Задачи</span>
        <span className="text-[11px] text-faint">{regions.length}</span>
      </div>

      {regions.length === 0 ? (
        <p className="text-faint">
          С инструмента «Маркиране на задача» очертай задача и ѝ дай статус (двоен клик сменя статуса).
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1">
            {Object.entries(counts).map(([k, v]) =>
              v ? (
                <span
                  key={k}
                  className="chip"
                  style={{ background: `${REGION_COLORS[k]}22`, color: REGION_COLORS[k] }}
                >
                  {STATUS_LABEL[k]} {v}
                </span>
              ) : null,
            )}
          </div>
          <ul className="space-y-0.5">
            {regions.map((r) => (
              <li key={r.id}>
                <button
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-3"
                  onClick={() => goToPage(r.page, Math.max(0, r.y - 40) / 800)}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: REGION_COLORS[r.status] }}
                  />
                  <span className="flex-1 truncate">{r.label || STATUS_LABEL[r.status]}</span>
                  <span className="tabular-nums text-faint">{r.page}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
