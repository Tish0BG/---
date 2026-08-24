/**
 * How long a sign-in lasts on this device, and whether the second factor has
 * to be produced again.
 *
 * Two separate choices, deliberately not one switch:
 *
 *   · **Remember me** decides where the session token is written. In
 *     `localStorage` it survives closing the browser; in `sessionStorage` it
 *     dies with the tab. A student on a school computer wants the second, and
 *     the same student on their own laptop wants the first — this is the only
 *     honest way to offer both.
 *
 *   · **Trusting a device** decides whether the code from the authenticator
 *     app is asked for again after the session itself has expired. It never
 *     shortens the password: a trusted device still needs the password.
 *
 * Both are per-device and both are readable, changeable and deletable from
 * this browser alone. Nothing about either is stored on the server, because
 * neither is a claim about the account — they are claims about a machine.
 */

const REMEMBER_KEY = 'plauvia.session.remember';
const TRUSTED_KEY = 'plauvia.mfa.trusted';

/** How long a remembered device may skip the second factor. */
export const TRUST_DAYS = 30;

/* ------------------------------------------------------- remember me */

/**
 * Remembering is the default.
 *
 * The alternative — signing everybody out when they close the tab — would be
 * a surprise for the great majority, who are on their own device. The choice
 * is offered at sign-in and remembered; not choosing means "yes".
 */
export const isRemembered = (): boolean => {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== 'no';
  } catch {
    return true;
  }
};

export function setRemembered(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? 'yes' : 'no');
  } catch {
    /* private mode */
  }
}

/**
 * The storage the Supabase client writes its session through.
 *
 * A single adapter rather than two clients, because the choice is made *at
 * sign-in* — after the client already exists — and re-creating it mid-session
 * would drop the listener the whole app hangs off.
 *
 * `removeItem` clears both stores on purpose: signing out has to leave nothing
 * behind, and neither does changing your mind about being remembered.
 */
export const sessionStore = {
  getItem(key: string): string | null {
    try {
      return isRemembered() ? localStorage.getItem(key) : sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      if (isRemembered()) {
        sessionStorage.removeItem(key);
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
        sessionStorage.setItem(key, value);
      }
    } catch {
      /* private mode, or a full quota — the session simply will not persist */
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* nothing to do */
    }
  },
};

/**
 * Moves an existing token to the other store.
 *
 * Called the moment the choice changes, so that unticking the box does not
 * leave the token that was already written sitting in `localStorage` until
 * the next refresh happens to rewrite it.
 */
export function applyRemembered(remember: boolean, storageKey: string): void {
  try {
    const from = remember ? sessionStorage : localStorage;
    const to = remember ? localStorage : sessionStorage;
    const token = from.getItem(storageKey) ?? to.getItem(storageKey);
    setRemembered(remember);
    if (token === null) return;
    from.removeItem(storageKey);
    to.setItem(storageKey, token);
  } catch {
    setRemembered(remember);
  }
}

/* ----------------------------------------------------- trusted device */

type Trusted = Record<string, number>;

const read = (): Trusted => {
  try {
    const raw = localStorage.getItem(TRUSTED_KEY);
    return raw ? (JSON.parse(raw) as Trusted) : {};
  } catch {
    return {};
  }
};

const write = (value: Trusted): void => {
  try {
    localStorage.setItem(TRUSTED_KEY, JSON.stringify(value));
  } catch {
    /* private mode */
  }
};

/**
 * Until when this device may skip the code, for one account — `null` if it may
 * not.
 *
 * Keyed by user id, so a second account signing in on the same browser is
 * challenged normally. An expiry in the past is treated as absent and swept
 * away, so the record cannot quietly outlive its own deadline.
 */
export function trustedUntil(userId: string): number | null {
  const all = read();
  const until = all[userId];
  if (!until) return null;
  if (until <= Date.now()) {
    delete all[userId];
    write(all);
    return null;
  }
  return until;
}

export const isTrusted = (userId: string): boolean => trustedUntil(userId) !== null;

export function trustDevice(userId: string, days = TRUST_DAYS): void {
  write({ ...read(), [userId]: Date.now() + days * 24 * 60 * 60 * 1000 });
}

/** Forgets this device — the next sign-in asks for the code again. */
export function forgetDevice(userId: string): void {
  const all = read();
  delete all[userId];
  write(all);
}
