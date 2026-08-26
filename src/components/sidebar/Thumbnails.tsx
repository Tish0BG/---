import { useEffect, useRef, useState } from 'react';
import { useViewer } from '@/state/viewerStore';
import type { PageSource } from '@/services/pageSource';
import { drawPage } from '@/services/renderService';
import { Icon } from '../Icon';
import { MenuItem, MenuSep, Popover, useConfirm } from '../ui';
import { useT, L } from '@/i18n';

/** dataURL cache so scrolling the strip does not re-render pages */
const cache = new Map<string, string>();
const CACHE_LIMIT = 400;

/** `version` is the store's sizesVersion: it changes whenever a board page is
 *  added, reordered or re-papered, which is exactly when a thumb goes stale. */
function cacheKey(docId: string, page: number, version: number) {
  return `${docId}:${page}:${version}`;
}

export function clearThumbCache() {
  cache.clear();
}

export function Thumbnails() {
  const t = useT();
  const pageCount = useViewer((s) => s.pageCount);
  const currentPage = useViewer((s) => s.currentPage);
  const goToPage = useViewer((s) => s.goToPage);
  const bookmarks = useViewer((s) => s.bookmarks);
  const kind = useViewer((s) => s.meta?.kind);
  const flow = useViewer((s) => s.meta?.board?.flow);
  const listRef = useRef<HTMLDivElement>(null);
  const bookmarked = new Set(bookmarks.map((b) => b.page));
  const { confirm, element } = useConfirm();
  const paged = kind === 'board' && flow !== 'scroll';

  /* keep the active thumbnail in view */
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-thumb="${currentPage}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [currentPage]);

  return (
    <div ref={listRef} className="scroll-thin h-full overflow-y-auto px-3 py-2">
      {element}
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <div key={n} data-thumb={n} className="group relative">
            <button onClick={() => goToPage(n)} className="block w-full cursor-pointer text-left">
              <Thumb page={n} active={n === currentPage} />
              <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted">
                {bookmarked.has(n) && <Icon name="bookmark" size={10} fill className="text-warn" />}
                <span className={n === currentPage ? 'font-semibold text-ink' : ''}>{n}</span>
              </div>
            </button>
            {paged && <PageMenu page={n} last={pageCount} confirm={confirm} />}
          </div>
        ))}
      </div>

      {paged && (
        <button
          className="btn mt-3 w-full border border-dashed border-line-strong"
          onClick={() => void useViewer.getState().addBoardPage(pageCount)}
        >
          <Icon name="pageAdd" size={15} />
          {t(L('Нова страница', 'New page'))}
        </button>
      )}
    </div>
  );
}

/** Per-sheet actions: only whiteboards can be restructured. */
function PageMenu({
  page,
  last,
  confirm,
}: {
  page: number;
  last: number;
  confirm: (m: string, cb: () => void) => void;
}) {
  const t = useT();
  const store = useViewer.getState;
  return (
    <Popover
      width={190}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          onClick={toggle}
          className="icon-btn hover-reveal absolute right-1 top-1 h-6 w-6 backdrop-blur"
          style={{ background: 'color-mix(in srgb, var(--c-surface) 82%, transparent)' }}
          aria-label={t(L(`Действия за страница ${page}`, `Actions for page ${page}`))}
        >
          <Icon name="dots" size={14} />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            icon="pageAdd"
            label={t(L('Нова страница след тази', 'New page after this'))}
            onClick={() => {
              void store().addBoardPage(page);
              close();
            }}
          />
          <MenuItem
            icon="pageCopy"
            label={t(L('Дублирай', 'Duplicate'))}
            onClick={() => {
              void store().duplicateBoardPage(page);
              close();
            }}
          />
          <MenuSep />
          <MenuItem
            icon="arrowUp"
            label={t(L('Премести нагоре', 'Move up'))}
            onClick={() => {
              if (page > 1) void store().moveBoardPage(page, -1);
              close();
            }}
          />
          <MenuItem
            icon="arrowDown"
            label={t(L('Премести надолу', 'Move down'))}
            onClick={() => {
              if (page < last) void store().moveBoardPage(page, 1);
              close();
            }}
          />
          <MenuSep />
          <MenuItem
            icon="trash"
            label={t(L('Изтрий страницата', 'Delete the page'))}
            danger
            onClick={() => {
              close();
              if (last <= 1) return;
              const hasInk = (store().pages.get(page)?.length ?? 0) > 0;
              if (!hasInk) {
                void store().deleteBoardPage(page);
                return;
              }
              confirm(t(L(`Страница ${page} има бележки. Да я изтрия ли заедно с тях?`, `Page ${page} has notes on it. Delete the page and the notes?`)), () =>
                void store().deleteBoardPage(page),
              );
            }}
          />
        </>
      )}
    </Popover>
  );
}

function Thumb({ page, active }: { page: number; active: boolean }) {
  const t = useT();
  const session = useViewer((s) => s.session);
  const docId = useViewer((s) => s.docId);
  const annotations = useViewer((s) => s.pages.get(page));
  const annotationCount = annotations?.length ?? 0;
  const version = useViewer((s) => s.sizesVersion);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<string | null>(() =>
    docId ? (cache.get(cacheKey(docId, page, version)) ?? null) : null,
  );
  const ref = useRef<HTMLDivElement>(null);
  const ratio = useViewer((s) => {
    const sz = s.pageSize(page);
    return sz.height / sz.width;
  });

  /* a board page can change shape under us — drop the stale bitmap */
  useEffect(() => {
    if (docId) setSrc(cache.get(cacheKey(docId, page, version)) ?? null);
  }, [docId, page, version]);

  useEffect(() => {
    if (!session || !docId || src) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        void renderThumb(session, docId, page, version).then((url) => {
          if (!cancelled && url) setSrc(url);
        });
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [session, docId, page, src, version]);

  /* annotations are drawn live on top, so the strip shows what is solved */
  useEffect(() => {
    const canvas = inkRef.current;
    if (!canvas) return;
    const size = useViewer.getState().pageSize(page);
    const scale = 150 / size.width;
    const w = Math.round(size.width * scale);
    const h = Math.round(size.height * scale);
    if (!annotations?.length) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    drawPage(ctx, annotations, scale, { pressure: false });
  }, [annotations, page, src]);

  return (
    <div
      ref={ref}
      className={`relative w-full overflow-hidden rounded bg-white transition-shadow ${active ? 'thumb-active' : ''}`}
      style={{ aspectRatio: `1 / ${ratio || 1.29}`, boxShadow: '0 1px 4px rgb(0 0 0 / 18%)' }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
      ) : (
        <div className="h-full w-full animate-pulse bg-surface-3" />
      )}
      <canvas ref={inkRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {annotationCount > 0 && (
        <span
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--c-accent)' }}
          title={t(L(`${annotationCount} бележки`, `${annotationCount} notes`))}
        />
      )}
    </div>
  );
}

async function renderThumb(
  session: PageSource,
  docId: string,
  page: number,
  version: number,
): Promise<string | null> {
  const key = cacheKey(docId, page, version);
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const size = await session.getSize(page);
    const canvas = document.createElement('canvas');
    await session.render(`thumb-${page}`, page, canvas, 150 / size.width);
    const url = canvas.toDataURL('image/jpeg', 0.62);
    if (cache.size > CACHE_LIMIT) cache.clear();
    cache.set(key, url);
    canvas.width = 0;
    canvas.height = 0;
    return url;
  } catch {
    return null;
  }
}
