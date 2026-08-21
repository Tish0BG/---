import { useEffect, useRef, useState } from 'react';
import { useViewer } from '@/state/viewerStore';
import { Icon } from '../Icon';

/** Full-text search across the document, when the PDF has a text layer. */
export function SearchPanel({ autoFocus }: { autoFocus?: boolean }) {
  const search = useViewer((s) => s.search);
  const runSearch = useViewer((s) => s.runSearch);
  const setActiveHit = useViewer((s) => s.setActiveHit);
  const clearSearch = useViewer((s) => s.clearSearch);
  const [value, setValue] = useState(search.query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(value);
  };

  return (
    <div className="flex h-full flex-col">
      {/* An explicit button, not only implicit submission: on a tablet
          keyboard "go" is not always offered, and a field with no visible
          action looks like it does nothing. */}
      <form onSubmit={submit} className="flex gap-1.5 px-3 pb-2 pt-2">
        <span className="relative min-w-0 flex-1">
          <Icon
            name="search"
            size={14}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch(value);
              }
              if (e.key === 'Escape') {
                setValue('');
                clearSearch();
              }
            }}
            placeholder="Търси в документа…"
            className="field pl-7"
            enterKeyHint="search"
          />
        </span>
        <button
          type="submit"
          className="btn btn-primary shrink-0 px-2.5"
          disabled={value.trim().length < 2 || search.busy}
          aria-label="Търси"
        >
          {search.busy ? <Icon name="refresh" size={14} className="animate-spin" /> : <Icon name="search" size={14} />}
        </button>
      </form>

      <div className="px-3 pb-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>
          {search.busy
            ? 'Търсене…'
            : search.hits.length
              ? `${search.activeIndex + 1} от ${search.hits.length}`
              : search.query
                ? 'Няма резултати'
                : 'Enter за търсене'}
        </span>
        {search.hits.length > 0 && (
          <span className="flex gap-0.5">
            <button className="icon-btn h-6 w-6" onClick={() => setActiveHit(search.activeIndex - 1)}>
              <Icon name="chevronUp" size={14} />
            </button>
            <button className="icon-btn h-6 w-6" onClick={() => setActiveHit(search.activeIndex + 1)}>
              <Icon name="chevronDown" size={14} />
            </button>
          </span>
        )}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {search.hits.map((h, i) => (
          <button
            key={i}
            onClick={() => setActiveHit(i)}
            className={`block w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-3 ${
              i === search.activeIndex ? 'bg-accent-soft' : ''
            }`}
          >
            <span className="text-faint mr-1.5 tabular-nums">{h.page}</span>
            <Highlighted text={h.snippet} query={search.query} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1 || !query) return <span className="text-muted">{truncate(text)}</span>;
  return (
    <span className="text-muted">
      {truncate(text.slice(Math.max(0, i - 24), i), true)}
      <mark className="rounded-sm bg-transparent font-semibold text-ink">{text.slice(i, i + query.length)}</mark>
      {truncate(text.slice(i + query.length, i + query.length + 40))}
    </span>
  );
}

const truncate = (s: string, fromStart = false) =>
  s.length > 44 ? (fromStart ? `…${s.slice(-44)}` : `${s.slice(0, 44)}…`) : s;
