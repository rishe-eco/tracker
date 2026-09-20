/**
 * The expired-session path, end to end through the auth context.
 *
 * The bug: `isAuthenticated` was `!!token`, so an expired JWT kept the app in a
 * signed-in state where every request failed and nothing redirected. root.tsx
 * only sends you to /login when that flag is false, so the flag becoming false
 * is the whole fix — these tests pin the two ways it now does.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "~/components/auth/AuthContext";
import { isTokenExpired, notifySessionExpired, readStoredToken } from "~/api/authSession";

/** A JWT-shaped string whose payload carries `exp`, in seconds. */
function tokenExpiringAt(secondsFromNow: number) {
  const body = btoa(JSON.stringify({ userId: "u1", exp: Math.floor(Date.now() / 1000) + secondsFromNow }));
  return `header.${body}.signature`;
}

function AuthConsumer() {
  const { isAuthenticated, ready } = useAuth();
  return (
    <div>
      <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
      <span data-testid="ready">{String(ready)}</span>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("isTokenExpired", () => {
  it("treats a token past its own exp as expired", () => {
    expect(isTokenExpired(tokenExpiringAt(-60))).toBe(true);
  });

  it("treats a live token as usable", () => {
    expect(isTokenExpired(tokenExpiringAt(3600))).toBe(false);
  });

  it("treats a missing or unparseable token as expired", () => {
    // Not a token this app issued, so there is nothing to be gained by keeping it.
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired("not-a-jwt")).toBe(true);
    expect(isTokenExpired("a.!!!notbase64!!!.c")).toBe(true);
  });

  it("does not invent an expiry for a token that declares none", () => {
    // Absence of an exp claim is not evidence of one; the server stays the
    // authority, and an Unauthorized reply is what settles it.
    const body = btoa(JSON.stringify({ userId: "u1" }));
    expect(isTokenExpired(`header.${body}.sig`)).toBe(false);
  });
});

describe("readStoredToken", () => {
  it("clears an expired token rather than handing it back", () => {
    localStorage.setItem("token", tokenExpiringAt(-60));
    expect(readStoredToken()).toBeNull();
    // Cleared on the way out, so the next boot does not re-read a dead token.
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("returns a live token and leaves it alone", () => {
    const live = tokenExpiringAt(3600);
    localStorage.setItem("token", live);
    expect(readStoredToken()).toBe(live);
    expect(localStorage.getItem("token")).toBe(live);
  });
});

describe("AuthProvider and a dead session", () => {
  it("boots signed out when the stored token has already expired", async () => {
    localStorage.setItem("token", tokenExpiringAt(-60));
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    // The flag root.tsx redirects on. Before the fix this was true, and the
    // person sat on a page where every request failed.
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");
  });

  it("signs out when the server rejects a request, even if the token still looks live", async () => {
    // The case no local check can catch: a rotated secret, a revoked token, or
    // a token naming a user the database no longer has (which is what happens
    // after `prisma migrate dev` resets it). The token's own exp is in the
    // future and tells us nothing.
    localStorage.setItem("token", tokenExpiringAt(3600));
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("isAuthenticated").textContent).toBe("true"));

    act(() => notifySessionExpired());

    await waitFor(() => expect(screen.getByTestId("isAuthenticated").textContent).toBe("false"));
    expect(localStorage.getItem("token")).toBeNull();
  });
});
