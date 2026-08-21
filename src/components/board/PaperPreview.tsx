import { useEffect, useRef } from 'react';
import type { PaperTemplate } from '@/types';
import { drawPaper } from '@/services/boardService';

/**
 * Miniature of a sheet of paper, drawn with the very same routine the viewer
 * uses — so what you pick in the dialog is literally what you get.
 */
export function PaperPreview({
  template,
  w,
  h,
  paper = null,
  width = 74,
  className = '',
}: {
  template: PaperTemplate;
  w: number;
  h: number;
  paper?: string | null;
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (width / w) * dpr;
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawPaper(ctx, template, w, h, paper, false);
  }, [template, w, h, paper, width]);

  return (
    <canvas
      ref={ref}
      className={`block rounded-[3px] ${className}`}
      style={{ width, height: (width * h) / w, boxShadow: '0 1px 3px rgb(0 0 0 / 18%)' }}
    />
  );
}
