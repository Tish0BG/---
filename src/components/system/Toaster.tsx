import { useToasts, type ToastTone } from '@/state/toastStore';
import { useT, L } from '@/i18n';
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
  const t = useT();
  const toasts = useToasts((s) => s.toasts);
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-0 sm:items-end"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const tone = TONE[toast.tone];
        return (
          <div
            key={toast.id}
            className="animate-rise pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[14px] p-3"
            style={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-line)',
              boxShadow: 'var(--shadow-float)',
            }}
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px]"
              style={{ background: `color-mix(in srgb, ${tone.color} 14%, transparent)`, color: tone.color }}
            >
              <Icon name={tone.icon} size={15} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium leading-snug">{toast.title}</div>
              {toast.detail && (
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{toast.detail}</div>
              )}
            </div>
            {toast.action && (
              <button
                className="btn btn-sm shrink-0"
                style={{ color: 'var(--c-accent)' }}
                onClick={() => {
                  toast.action?.run();
                  useToasts.getState().dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              className="icon-btn h-6 w-6 shrink-0"
              onClick={() => useToasts.getState().dismiss(toast.id)}
              aria-label={t(L('Затвори', 'Close'))}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
