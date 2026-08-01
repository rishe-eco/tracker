import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "~/components/auth/AuthContext";

// Helper component that exposes auth state via visible elements
function AuthConsumer() {
  const { token, isAuthenticated, ready, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="token">{token ?? "null"}</span>
      <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
      <span data-testid="ready">{String(ready)}</span>
      <button onClick={() => login("new-token")}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("AuthContext initial state", () => {
  it("starts with null token and isAuthenticated=false", async () => {
    renderAuth();
    // After ready (useEffect runs), still no stored token
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("token").textContent).toBe("null");
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");
  });

  it("becomes ready=true after mount effect runs", async () => {
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("ready").textContent).toBe("true")
    );
  });

  it("reads an existing token from localStorage on mount", async () => {
    localStorage.setItem("token", "stored-token");
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("token").textContent).toBe("stored-token")
    );
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
  });
});

describe("login()", () => {
  it("sets the token and marks isAuthenticated=true", async () => {
    renderAuth();
    await waitFor(() => screen.getByTestId("ready").textContent === "true");

    act(() => {
      screen.getByText("login").click();
    });

    expect(screen.getByTestId("token").textContent).toBe("new-token");
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("true");
    expect(localStorage.getItem("token")).toBe("new-token");
  });
});

describe("logout()", () => {
  it("clears token and sets isAuthenticated=false", async () => {
    localStorage.setItem("token", "stored-token");
    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("token").textContent).toBe("stored-token")
    );

    act(() => {
      screen.getByText("logout").click();
    });

    expect(screen.getByTestId("token").textContent).toBe("null");
    expect(screen.getByTestId("isAuthenticated").textContent).toBe("false");
    expect(localStorage.getItem("token")).toBeNull();
  });
});
