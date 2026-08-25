import { useEffect } from 'react';
import type { ToolId } from '@/types';
import { useViewer } from '@/state/viewerStore';
import { useApp } from '@/state/appStore';
import { insertImage } from '@/services/imageService';
import { newNote } from '@/components/shell/AppHeader';

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  h: 'pan',
  p: 'pen',
  m: 'highlighter',
  e: 'eraser',
  l: 'line',
  r: 'rect',
  o: 'ellipse',
  a: 'arrow',
  t: 'text',
  g: 'region',
  c: 'snip',
};

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

/** Global keyboard map. Skipped whenever the focus is in a text field. */
export function useShortcuts({
  onSearch,
  onExport,
  onNewBoard,
}: {
  onSearch: () => void;
  onExport: () => void;
  onNewBoard?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const store = useViewer.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useApp.getState().setPalette(!useApp.getState().paletteOpen);
        return;
      }

      if (mod && e.key.toLowerCase() === 'z') {
        if (isTyping(e.target)) return;
        e.preventDefault();
        e.shiftKey ? store.redo() : store.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void store.flushNow();
        return;
      }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onSearch();
        return;
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        onExport();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        void store.toggleBookmark(store.currentPage);
        return;
      }
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        store.setZoom(store.zoom * 1.2, 'none');
        return;
      }
      if (mod && e.key === '-') {
        e.preventDefault();
        store.setZoom(store.zoom / 1.2, 'none');
        return;
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        store.setFitMode('width');
        return;
      }
      if (mod) return;
      if (isTyping(e.target)) return;

      /**
       * Outside a document the single letters mean something else: there are
       * no tools to switch to, and creating a task is what the keyboard is
       * for on those screens.
       */
      if (!store.docId) {
        const app = useApp.getState();
        if (app.quick || app.paletteOpen) return;
        const key = e.key.toLowerCase();
        if (key === 't') {
          e.preventDefault();
          app.setQuick('item', 'task');
        } else if (key === 'e') {
          e.preventDefault();
          app.setQuick('item', 'exam');
        } else if (key === 'g') {
          e.preventDefault();
          app.setQuick('goal');
        } else if (key === 'd') {
          // A written document is made and opened in one keystroke: it is the
          // thing this app is for, and it should be the cheapest to reach.
          e.preventDefault();
          void newNote();
        } else if (key === 'b') {
          e.preventDefault();
          onNewBoard?.();
        } else if (key === '/') {
          e.preventDefault();
          app.setPalette(true);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = store.selectedIds
          .map((id) => store.findAnnotation(id))
          .filter((a) => !!a);
        if (selected.length) {
          e.preventDefault();
          store.removeAnnotations(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        store.setSelection([]);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        store.goToPage(store.currentPage + 1);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        store.goToPage(store.currentPage - 1);
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        store.goToPage(1);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        store.goToPage(store.pageCount);
        return;
      }

      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        store.setTool(tool);
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !useViewer.getState().docId) return;
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void insertImage(file);
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [onSearch, onExport, onNewBoard]);
}
