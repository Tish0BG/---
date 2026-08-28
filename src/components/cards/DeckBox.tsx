import { useEffect, useMemo, useRef, useState } from 'react';
import type { DeckSummary } from '@/state/cardStore';
import { useT, useLang, L, collatorOf } from '@/i18n';
import { useStill } from '../kit';

/**
 * ───────────────────────────────────────────────────────── the card box ──
 *
 * Every deck you have, standing on edge like the dividers in a wooden index
 * box, with the letters between the runs.
 *
 * It replaced a grid of tiles sorted by how many cards were waiting — which
 * meant the box rearranged itself every time you answered one, and the deck
 * you were reaching for had moved by the time your hand got there. A box is
 * useful precisely because things stay where you put them, so the order here
 * is alphabetical and nothing but alphabetical. What is waiting is a number on
 * the tab.
 */

/** Which divider a name files under. Digits share one, symbols share another. */
export function shelfOf(name: string): string {
  const ch = name.trim().charAt(0);
  if (!ch) return '#';
  if (/\d/.test(ch)) return '0–9';
  if (/\p{L}/u.test(ch)) return ch.toLocaleUpperCase();
  return '#';
}

/** Numbers first, then the alphabet of whatever language is on, symbols last. */
function shelfOrder(a: string, b: string, collator: Intl.Collator): number {
  const rank = (s: string) => (s === '0–9' ? 0 : s === '#' ? 2 : 1);
  return rank(a) - rank(b) || collator.compare(a, b);
}

export function DeckBox({
  summaries,
  onOpen,
}: {
  summaries: DeckSummary[];
  onOpen: (deck: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const still = useStill();
  const collator = useMemo(() => collatorOf(lang), [lang]);
  const scroller = useRef<HTMLDivElement>(null);
  const [pulling, setPulling] = useState<string | null>(null);

  /** The box, filed. Groups come from the names, not from a fixed alphabet. */
  const shelves = useMemo(() => {
    const map = new Map<string, DeckSummary[]>();
    for (const d of summaries) {
      const key = shelfOf(d.deck);
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return [...map.entries()].sort((a, b) => shelfOrder(a[0], b[0], collator));
  }, [summaries, collator]);

  /* A pull that never lands would leave the box empty-handed. */
  useEffect(() => {
    if (!pulling) return;
    const id = setTimeout(() => {
      onOpen(pulling);
      setPulling(null);
    }, still ? 0 : 300);
    return () => clearTimeout(id);
  }, [pulling, still, onOpen]);

  const pull = (deck: string) => {
    if (pulling) return;
    setPulling(deck);
  };

  /** ↑/↓ walk the tabs; the browser's own Tab order already works. */
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const tabs = [...(scroller.current?.querySelectorAll<HTMLElement>('.deck-tab') ?? [])];
    const at = tabs.indexOf(document.activeElement as HTMLElement);
    const next = tabs[at + (e.key === 'ArrowDown' ? 1 : -1)] ?? tabs[e.key === 'ArrowDown' ? 0 : tabs.length - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const jump = (key: string) => {
    const node = scroller.current?.querySelector(`[data-shelf="${CSS.escape(key)}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="card-box">
      <div className="card-box-well flex">
        <div
          ref={scroller}
          onKeyDown={onKey}
          className="scroll-thin min-h-[220px] flex-1 overflow-y-auto px-4 pb-5 pt-3"
          style={{ maxHeight: 'min(62vh, 560px)' }}
        >
          {shelves.map(([key, decks]) => (
            <div key={key}>
              <div className="deck-letter" data-shelf={key}>
                <span>{key}</span>
              </div>
              {decks.map((d, i) => (
                <button
                  key={d.deck}
                  className="deck-tab"
                  data-pulling={pulling === d.deck ? 'yes' : undefined}
                  /* The crests step across the width so a row of thirty reads
                     as tabs rather than as stripes, and so a name is never
                     hidden behind the tab of the one in front. */
                  style={
                    {
                      '--tab': d.color,
                      '--crest': `${14 + (i % 4) * 54}px`,
                    } as React.CSSProperties
                  }
                  onClick={() => pull(d.deck)}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{d.deck}</span>

                    {d.due > 0 && (
                      <span
                        className="t-num shrink-0 rounded-full px-1.5 py-px text-[11px] font-semibold"
                        style={{
                          background: `color-mix(in srgb, ${d.color} 16%, transparent)`,
                          color: d.color,
                        }}
                        title={t(L('за преговор днес', 'due today'))}
                      >
                        {d.due}
                      </span>
                    )}

                    <span className="t-num shrink-0 text-[11px] text-faint">
                      {d.total || t(L('празно', 'empty'))}
                    </span>

                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* The jump rail, the same one the library uses. Only worth the space
            once there are more decks than fit on a screen. */}
        {shelves.length > 4 && (
          <div className="w-[26px] shrink-0 py-3 pr-1.5">
            {shelves.map(([key]) => (
              <button key={key} className="alpha-rail-key" onClick={() => jump(key)}>
                {key === '0–9' ? '#' : key}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="card-box-lip" />
    </div>
  );
}
