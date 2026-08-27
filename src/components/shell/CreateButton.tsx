import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/appStore';
import { newNote } from '@/services/newNote';
import { useT, L } from '@/i18n';
import { S } from '@/i18n/strings';
import { Icon } from '../Icon';

/**
 * ──────────────────────────────────────────────────────── the create button ──
 *
 * One round button in the corner of the window, and four things it can make.
 *
 * It used to be a labelled button in the top bar with a drop-down menu, which
 * is a fine control and the wrong one for the most-pressed thing in the app:
 * it sat in a strip that existed mostly to hold it, at the far end of a row
 * shared with a search box and an avatar. Down here it is always in the same
 * place, always the same size, and the page keeps the row it was renting.
 *
 * The options open *upwards*, nearest-first, so the thing you press nine times
 * out of ten — write a task — is the shortest distance from the button.
 */
export function CreateButton({
  onNewBoard,
  onUpload,
}: {
  onNewBoard?: () => void;
  onUpload?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options: { icon: string; label: string; run: () => void }[] = [
    { icon: 'listTodo', label: t(S.task), run: () => useApp.getState().setQuick('item', 'task') },
    { icon: 'notebook', label: t(L('Текстов документ', 'Text document')), run: () => void newNote() },
    { icon: 'board', label: t(L('Дъска', 'Whiteboard')), run: () => onNewBoard?.() },
    { icon: 'upload', label: t(L('Качи файл', 'Upload a file')), run: () => onUpload?.() },
  ];

  return (
    /* Hidden on a phone: the bottom bar already carries a create button in the
       middle of the thumb's reach, and two of them in one corner of a 375 px
       screen is one too many. */
    <div ref={root} className="fixed bottom-5 right-5 z-[68] hidden flex-col items-end gap-2 md:flex">
      {open && (
        <div className="flex flex-col items-end gap-2" role="menu">
          {/* Reversed so the array reads nearest-first while the DOM stacks
              furthest-first — the order in the code is the order of the reach. */}
          {[...options].reverse().map((o, i) => (
            <button
              key={o.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                o.run();
              }}
              className="animate-rise flex h-10 cursor-pointer items-center gap-2.5 rounded-full border border-line pl-3.5 pr-4 text-[13px] font-medium transition-colors hover:bg-surface-2"
              style={{
                background: 'var(--c-surface)',
                boxShadow: 'var(--shadow-float)',
                // Furthest option first in the DOM, so the delays count down
                // towards the button and the row nearest the thumb lands last.
                animationDelay: `${(options.length - 1 - i) * 0.03}s`,
              }}
            >
              <Icon name={o.icon} size={16} className="text-muted" />
              {o.label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t(S.create)}
        className="grid h-[52px] w-[52px] cursor-pointer place-items-center rounded-full active:scale-95"
        style={{
          background: 'var(--c-accent)',
          color: 'var(--c-accent-text)',
          // A shadow rather than a ring: the page behind it can be any colour,
          // and an opaque ring showed as a pale halo on the darker screens.
          boxShadow: '0 6px 18px -5px rgb(0 0 0 / 32%)',
          transition: 'transform var(--dur-fast) var(--ease)',
        }}
      >
        <Icon
          name="plus"
          size={24}
          strokeWidth={2.2}
          style={{
            transform: open ? 'rotate(45deg)' : undefined,
            transition: 'transform var(--dur) var(--ease)',
          }}
        />
      </button>
    </div>
  );
}
