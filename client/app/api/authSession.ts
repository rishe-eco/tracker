/**
 * Session validity, and the one place the app learns its session has died.
 *
 * The bug this exists to fix: `isAuthenticated` was `!!token` — presence, not
 * validity. An expired JWT stays in localStorage forever, so the app went on
 * believing it was signed in, every request failed with "Unauthorized", and
 * each page rendered its own local error card. Nothing ever concluded that the
 * session was over, so the only way back was to log out by hand.
 *
 * Two halves, because a token dies in two different ways:
 *
 * 1. **It aged out**, and we can see that locally. `isTokenExpired` reads the
 *    JWT's own `exp`, so a stale token is treated as absent at boot instead of
 *    flashing protected UI that is about to fail.
 * 2. **The server rejected it**, which is the only way to learn the rest —
 *    a revoked token, a rotated `JWT_SECRET`, or a token naming a user who no
 *    longer exists (`api/src/graphql/auth.ts` notes that last one happens after
 *    `prisma migrate dev` resets the database). No amount of local inspection
 *    finds these; the server has to say so.
 *
 * The notifier is a module-level subscription rather than a hook so that
 * `useApi` can report an expiry without importing the auth context — `useApi`
 * is called from places that are not inside `AuthProvider` (the login page),
 * and `useAuth` throws outside it.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Subscribe to "the server says this session is over". Returns an unsubscribe.
 * Deliberately not an event the UI can fire for other reasons: an ordinary
 * failed request is not a dead session, and treating it as one would sign
 * people out on a flaky connection.
 */
export function onSessionExpired(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Called by the API layer when a request comes back Unauthorized. */
export function notifySessionExpired(): void {
  for (const fn of [...listeners]) fn();
}

/**
 * Is this JWT past its own `exp`?
 *
 * A token we cannot parse is treated as expired: it is not a token this app
 * issued, so there is nothing to be gained by holding onto it. Tokens without
 * an `exp` claim are treated as live — absence of an expiry is not evidence of
 * one, and the server remains the authority either way.
 */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  const payload = token.split(".")[1];
  if (!payload) return true;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json)?.exp;
    if (typeof exp !== "number") return false;
    // Seconds, per the JWT spec. A small skew allowance keeps a token that is
    // seconds from death from being sent on a request it cannot survive.
    return exp * 1000 <= Date.now() + 5_000;
  } catch {
    return true;
  }
}

/**
 * The stored token, or null if there isn't a usable one — and the expired case
 * clears storage on the way out, so a dead token is not left behind to be
 * re-read on the next boot.
 */
export function readStoredToken(): string | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("token");
  } catch {
    return null; // Private mode, blocked storage — treated as signed out.
  }
  if (!stored) return null;
  if (isTokenExpired(stored)) {
    try {
      localStorage.removeItem("token");
    } catch {
      /* nothing to do — the token is unusable either way. */
    }
    return null;
  }
  return stored;
}
