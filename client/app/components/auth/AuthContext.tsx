import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { onSessionExpired, readStoredToken } from "~/api/authSession";

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  ready: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * `isAuthenticated` means the session is *usable*, not that a string is sitting
 * in localStorage.
 *
 * It used to mean the latter (`!!token`), which is why an expired token left
 * the app stuck: root.tsx only redirects to /login when this is false, and it
 * never became false. A token that has aged out is dropped at boot, and a token
 * the server rejects is dropped the moment it says so.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // readStoredToken clears an expired token rather than handing it back, so
    // a dead session does not briefly render protected UI on every reload.
    setToken(readStoredToken());
    setReady(true);
  }, []);

  const login = useCallback((newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
  }, []);

  // The server rejecting a request is the only way to learn about the failures
  // that are invisible locally. Dropping the token flips isAuthenticated, and
  // root.tsx does the redirect — this does not navigate itself, so there is one
  // place that decides where a signed-out person goes.
  useEffect(() => onSessionExpired(logout), [logout]);

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
