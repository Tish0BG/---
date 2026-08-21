import { useToasts, type ToastTone } from '@/state/toastStore';
import { Icon } from '../Icon';

const TONE: Record<ToastTone, { icon: string; color: string }> = {
  ok: { icon: 'checkCircle', color: 'var(--c-success)' },
  error: { icon: 'alert', color: 'var(--c-danger)' },
  info: { icon: 'info', color: 'var(--c-accent)' },
};

/**
 * Bottom-centre on a phone, bottom-right on a desktop — never over the tool
 * palette, which is where the thumb lives while writing.
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-0 sm:items-end"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const tone = TONE[t.tone];
        return (
          <div
            key={t.id}
            className="panel animate-rise pointer-events-auto flex w-full max-w-[380px] items-start gap-2.5 p-3"
            style={{ boxShadow: 'var(--shadow-float)' }}
          >
            <Icon name={tone.icon} size={16} className="mt-px shrink-0" style={{ color: tone.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium leading-snug">{t.title}</div>
              {t.detail && <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{t.detail}</div>}
            </div>
            {t.action && (
              <button
                className="btn h-7 shrink-0 px-2 text-[12px]"
                style={{ color: 'var(--c-accent)' }}
                onClick={() => {
                  t.action?.run();
                  useToasts.getState().dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              className="icon-btn h-6 w-6 shrink-0"
              onClick={() => useToasts.getState().dismiss(t.id)}
              aria-label="Затвори"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
