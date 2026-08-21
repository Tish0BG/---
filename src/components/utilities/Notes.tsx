import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';

const KEY = 'studypdf.scratch.v1';

/**
 * A scratch pad that survives reloads. Deliberately not part of the document:
 * it is where the intermediate result goes while the page keeps the clean
 * solution.
 */
export function Notes() {
  const [text, setText] = useState(() => localStorage.getItem(KEY) ?? '');
  const [saved, setSaved] = useState(true);
  const timer = useRef(0);

  useEffect(() => {
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, text);
        setSaved(true);
      } catch {
        /* quota */
      }
    }, 400);
    return () => window.clearTimeout(timer.current);
  }, [text]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--c-surface)' }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Черновата, междинните сметки, каквото трябва да е под ръка…"
        spellCheck={false}
        className="scroll-thin min-h-0 flex-1 resize-none bg-transparent p-3 text-[13px] leading-relaxed outline-none"
        style={{ color: 'var(--c-text)' }}
      />
      <div className="flex shrink-0 items-center gap-2 border-t border-line px-2 py-1 text-[10.5px] text-faint">
        <span>{words} думи</span>
        <span className="flex-1" />
        <span>{saved ? 'записано' : 'записване…'}</span>
        <button
          className="icon-btn h-6 w-6"
          onClick={() => void navigator.clipboard.writeText(text)}
          title="Копирай всичко"
        >
          <Icon name="copy" size={12} />
        </button>
        <button className="icon-btn h-6 w-6" onClick={() => setText('')} title="Изчисти">
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
  );
}
