import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthMeResponse, SessionUser } from "@shared/auth-contracts";
import { queryClient } from "@/lib/queryClient";

export const UNAUTHORIZED_EVENT = "yp:unauthorized";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    // Kein JSON-Body, Fallback verwenden.
  }
  return fallback;
}

export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

async function fetchCurrentUser(): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new AuthError(res.status, await readErrorMessage(res, "Die Sitzung konnte nicht geprüft werden."));
  }
  const data = (await res.json()) as AuthMeResponse;
  return data.user ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await fetchCurrentUser());
    } catch {
      // Server nicht erreichbar oder Fehler: Nutzer als abgemeldet behandeln, kein Toast.
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await fetchCurrentUser();
        if (!cancelled) setUser(current);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
    } catch {
      throw new AuthError(0, "Der Server ist nicht erreichbar. Bitte versuche es später erneut.");
    }

    if (res.status === 401) {
      throw new AuthError(401, "Benutzername oder Passwort ist falsch.");
    }
    if (res.status === 429) {
      throw new AuthError(429, "Zu viele Versuche. Bitte warte kurz.");
    }
    if (!res.ok) {
      throw new AuthError(res.status, await readErrorMessage(res, "Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut."));
    }

    const data = (await res.json()) as AuthMeResponse;
    if (!data?.user) {
      throw new AuthError(res.status, "Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.");
    }
    queryClient.clear();
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Auch bei Netzwerkfehler lokal abmelden.
    } finally {
      queryClient.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth muss innerhalb eines AuthProvider verwendet werden.");
  }
  return context;
}
