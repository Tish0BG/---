import { useEffect, useRef, useState } from 'react';
import { L, useT } from '@/i18n';

/**
 * ────────────────────────────────────────────────────────── the code boxes ──
 *
 * Six cells, one digit each, for the number that arrives by e-mail.
 *
 * It replaces a single wide text field with letter-spacing pushed to a third
 * of an em, which looked like boxes from across the room and behaved like a
 * text field up close: no sense of how many digits were wanted, no way to fix
 * the third one without retyping the rest, and a caret that landed wherever
 * the tap did.
 *
 * The cells are drawn, but only one real input exists behind them. That is a
 * deliberate departure from the usual six-inputs-and-a-ref-array: a single
 * field is what iOS and Android hand the SMS/e-mail autofill to, what a
 * password manager fills, and what select-all-and-paste works in. Six inputs
 * break all three and buy nothing a caret cannot do.
 */
export function CodeInput({
  value,
  onChange,
  length = 6,
  onComplete,
  autoFocus = true,
  invalid,
  disabled,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  /** how many cells to draw; the field itself accepts up to this many */
  length?: number;
  /** fired once the last cell is filled, so nobody has to reach for a button */
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
  /** shakes and reddens — the code came back wrong */
  invalid?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, '').slice(0, length);

  // Fires on the transition to full, not on every render at full — otherwise
  // a wrong code that is left in the boxes re-submits itself forever.
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (digits.length !== length) {
      fired.current = null;
      return;
    }
    if (fired.current === digits) return;
    fired.current = digits;
    onComplete?.(digits);
  }, [digits, length, onComplete]);

  const cells = Array.from({ length }, (_, i) => i);
  // Where the caret is: the first empty cell, or the last one when it is full.
  const caret = Math.min(digits.length, length - 1);

  return (
    <div
      className={`relative ${invalid ? 'animate-shake' : ''}`}
      onPointerDown={(e) => {
        // The cells are decoration; every tap belongs to the field behind them.
        e.preventDefault();
        ref.current?.focus();
      }}
    >
      <input
        ref={ref}
        value={digits}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        // The browser's own autofill chip wants to know this is a code.
        name="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={label ?? t(L('Код от пощата', 'Code from your inbox'))}
        aria-invalid={invalid || undefined}
        /* Present to the accessibility tree and to autofill, invisible to the
           eye: opacity alone would still show a caret over the cells. */
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        style={{ letterSpacing: '2em' }}
      />

      <div className="pointer-events-none flex justify-center gap-2" aria-hidden>
        {cells.map((i) => {
          const char = digits[i];
          const active = focused && !disabled && i === caret;
          return (
            <span
              key={i}
              className="t-num grid place-items-center rounded-[10px] font-semibold transition-all duration-150"
              style={{
                width: `min(52px, ${100 / length}%)`,
                aspectRatio: '1 / 1.12',
                fontSize: 22,
                background: disabled ? 'var(--c-surface-2)' : 'var(--c-surface)',
                color: invalid ? 'var(--c-danger)' : 'var(--c-text)',
                border: `1px solid ${
                  invalid
                    ? 'var(--c-danger)'
                    : active
                      ? 'var(--c-accent)'
                      : char
                        ? 'var(--c-line-strong)'
                        : 'var(--c-line)'
                }`,
                boxShadow: active ? '0 0 0 3px var(--c-accent-ring)' : undefined,
              }}
            >
              {char ?? (
                // A resting cell is not empty, it is waiting. The dot says how
                // many digits are wanted without pretending to be a value.
                <span
                  className="h-[3px] w-[3px] rounded-full"
                  style={{ background: 'var(--c-line-strong)' }}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "Send another" with the wait attached.
 *
 * A resend button that can be pressed the instant the page loads gets pressed
 * three times by somebody whose e-mail is simply thirty seconds behind, and
 * each press invalidates the code that was already on its way. The countdown
 * is not a punishment; it is the honest answer to "has it arrived yet".
 */
export function ResendButton({
  seconds = 45,
  onResend,
  busy,
  startedAt,
}: {
  seconds?: number;
  onResend: () => void;
  busy?: boolean;
  /** when the last code went out; resets the clock when it changes */
  startedAt: number;
}) {
  const t = useT();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    const tick = () => {
      const gone = Math.floor((Date.now() - startedAt) / 1000);
      setLeft(Math.max(0, seconds - gone));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, seconds]);

  if (left > 0) {
    return (
      <p className="text-center text-[12.5px] text-faint" aria-live="off">
        {t(L(`Нов код след ${left} с.`, `Another code in ${left}s`))}
      </p>
    );
  }

  return (
    <button
      type="button"
      className="link-quiet mx-auto block text-[12.5px]"
      onClick={onResend}
      disabled={busy}
    >
      {t(busy ? L('Изпращане…', 'Sending…') : L('Не дойде? Изпрати нов код', 'Not arrived? Send another code'))}
    </button>
  );
}
