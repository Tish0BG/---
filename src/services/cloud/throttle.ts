import { L, tr } from '@/i18n';

/**
 * A brake on the forms that cost something to submit.
 *
 * This is not the security control — that is Supabase's own server-side rate
 * limiting, which a browser cannot be talked out of. What this adds is the
 * part the server cannot do well: telling the person, in their own language
 * and before the request goes out, that they are about to be refused and for
 * how long. It also stops a stuck retry loop from spending someone's e-mail
 * quota in a few seconds.
 *
 * Kept in localStorage so a reload does not hand out a fresh allowance, and
 * keyed per action so a failed sign-in cannot lock out a password reset.
 */

const KEY = 'plauvia.throttle.v1';

export type ThrottledAction = 'signin' | 'signup' | 'reset' | 'resend';

interface Limit {
  /** attempts allowed inside the window before the backoff starts */
  free: number;
  /** rolling window, ms */
  window: number;
  /** delay after the allowance runs out; doubles per further attempt */
  base: number;
  /** never wait longer than this */
  max: number;
}

const LIMITS: Record<ThrottledAction, Limit> = {
  // Sign-in is the one an attacker hammers, so its allowance is the smallest
  // that does not punish someone with a genuinely forgotten password.
  signin: { free: 5, window: 5 * 60_000, base: 15_000, max: 5 * 60_000 },
  signup: { free: 3, window: 10 * 60_000, base: 30_000, max: 10 * 60_000 },
  // Both of these send mail, and mail is the expensive, abusable one.
  reset: { free: 2, window: 10 * 60_000, base: 60_000, max: 15 * 60_000 },
  resend: { free: 2, window: 10 * 60_000, base: 60_000, max: 15 * 60_000 },
};

interface Record_ {
  /** timestamps of recent attempts */
  at: number[];
  /** when the next attempt is allowed */
  until: number;
}

type Store = Partial<Record<ThrottledAction, Record_>>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode — the server-side limit still applies */
  }
}

/** How long the caller must wait, in ms. Zero when the action may proceed. */
export function retryAfter(action: ThrottledAction): number {
  const record = read()[action];
  if (!record) return 0;
  return Math.max(0, record.until - Date.now());
}

/**
 * Call before the request. Returns a sentence to show instead of sending it,
 * or null when the action may go ahead.
 */
export function blockedMessage(action: ThrottledAction): string | null {
  const wait = retryAfter(action);
  if (wait <= 0) return null;
  const seconds = Math.ceil(wait / 1000);
  if (seconds < 90) {
    return tr(
      L(`Твърде много опити. Опитай пак след ${seconds} сек.`, `Too many attempts. Try again in ${seconds}s.`),
    );
  }
  const minutes = Math.ceil(seconds / 60);
  return tr(
    L(`Твърде много опити. Опитай пак след ${minutes} мин.`, `Too many attempts. Try again in ${minutes} min.`),
  );
}

/** Call after an attempt that reached the network, whatever its outcome. */
export function recordAttempt(action: ThrottledAction): void {
  const limit = LIMITS[action];
  const now = Date.now();
  const store = read();
  const at = [...(store[action]?.at ?? []), now].filter((t) => now - t < limit.window);
  const over = Math.max(0, at.length - limit.free);
  const wait = over === 0 ? 0 : Math.min(limit.max, limit.base * 2 ** (over - 1));
  store[action] = { at, until: now + wait };
  write(store);
}

/**
 * Call after the action succeeded. A correct password should not leave someone
 * serving out a penalty earned while they were guessing at it.
 */
export function clearAttempts(action: ThrottledAction): void {
  const store = read();
  delete store[action];
  write(store);
}
