/**
 * ──────────────────────────────────────────── the seam in the middle of signing up ──
 *
 * Registering runs across a session boundary. The address and the password are
 * given to a stranger; the code that follows creates a session, and everything
 * after it — the handle, the face — is asked of somebody the app now considers
 * signed in. React unmounts the whole door at that moment and mounts the app in
 * its place, so the flow cannot simply hold the next step in component state.
 *
 * This is the note it leaves itself across that gap. `sessionStorage` rather
 * than the auth store because it also has to survive a reload: somebody whose
 * phone rings between the code and the username should come back to the
 * username, not to a half-made account with no name.
 *
 * It lives on its own, away from the flow that writes it, so that `App` can ask
 * "is somebody mid-registration?" without pulling the entire sign-up screen
 * into the first chunk to find out.
 */

const KEY = 'plauvia.signup.pending.v1';

/** The address being registered, or null when nobody is mid-flow. */
export function readPendingSignUp(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    // Private mode with storage denied. Registration still works start to
    // finish in one go; it just will not survive a reload.
    return null;
  }
}

export function markPendingSignUp(email: string): void {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    /* see above */
  }
}

export function clearPendingSignUp(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
