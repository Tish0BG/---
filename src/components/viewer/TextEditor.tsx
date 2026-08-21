import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TextAnnotation } from '@/types';
import { useViewer } from '@/state/viewerStore';
import { LINE_HEIGHT, FONT_STACKS } from '@/services/renderService';
import { debounce } from '@/lib/util';

/**
 * Inline editor for a text annotation. It is a plain <textarea> laid over the
 * page and styled to match exactly how the canvas renderer will draw it, so
 * what you type is what gets committed.
 */
export function TextEditor({ annotation, zoom }: { annotation: TextAnnotation; zoom: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(annotation.text);
  const [width, setWidth] = useState(annotation.w);
  const id = annotation.id;

  const commit = useCallback(
    (text: string, w: number, h: number) => {
      const store = useViewer.getState();
      const current = store.findAnnotation(id);
      if (!current || current.type !== 'text') return;
      if (current.text === text && current.w === w && Math.abs(current.h - h) < 0.5) return;
      store.commit({
        removed: [current],
        added: [{ ...current, text, w, h, updatedAt: Date.now() }],
        label: `text-${id}`,
      });
    },
    [id],
  );

  const commitDebounced = useRef(debounce(commit, 400)).current;

  // Focus on the next frame: the browser's own mousedown handling would
  // otherwise move focus back to the page right after we take it.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  /* keep the box tall enough for the text */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, width, zoom]);

  const close = useCallback(() => {
    const store = useViewer.getState();
    const el = ref.current;
    const h = el ? el.scrollHeight / zoom : annotation.h;
    if (!value.trim()) {
      const current = store.findAnnotation(id);
      if (current) store.removeAnnotations([current]);
    } else {
      commitDebounced.cancel();
      commit(value, width, h);
    }
    store.setEditingText(null);
  }, [annotation.h, commit, commitDebounced, id, value, width, zoom]);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const move = (ev: PointerEvent) => {
      setWidth(Math.max(40, startW + (ev.clientX - startX) / zoom));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const el = ref.current;
      commit(value, Math.max(40, width), el ? el.scrollHeight / zoom : annotation.h);
      ref.current?.focus();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      className="absolute"
      style={{ left: annotation.x * zoom, top: annotation.y * zoom, width: width * zoom }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        value={value}
        spellCheck={false}
        onChange={(e) => {
          setValue(e.target.value);
          const el = ref.current;
          commitDebounced(e.target.value, width, el ? el.scrollHeight / zoom : annotation.h);
        }}
        onBlur={close}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            ref.current?.blur();
          }
        }}
        className="block w-full resize-none overflow-hidden bg-transparent outline-none"
        style={{
          fontFamily: FONT_STACKS[annotation.fontFamily],
          fontSize: annotation.fontSize * zoom,
          lineHeight: LINE_HEIGHT,
          fontWeight: annotation.bold ? 700 : 400,
          fontStyle: annotation.italic ? 'italic' : 'normal',
          color: annotation.color,
          textAlign: annotation.align,
          padding: 0,
          margin: 0,
          border: 0,
          caretColor: 'var(--c-accent)',
          boxShadow: '0 0 0 1px color-mix(in srgb, var(--c-accent) 60%, transparent)',
          borderRadius: 2,
        }}
      />
      <span
        onPointerDown={startResize}
        title="Промени ширината"
        className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
      />
    </div>
  );
}
