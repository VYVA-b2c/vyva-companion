import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getToken, setToken, clearToken, isAuthenticated } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { hasSupabaseAuthConfig, signInWithSupabase, signUpWithSupabase } from "@/lib/supabaseAuth";

const ONBOARDING_STATE_KEY = ["/api/onboarding/state"] as const;

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  lastSeenAt: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadCurrentUser(token: string, fallback?: { userId?: string; email?: string }): Promise<AuthUser> {
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not load your account");
  }

  const data = await response.json();
  return {
    id: data.id ?? fallback?.userId ?? "",
    email: data.email ?? fallback?.email ?? "",
    role: data.role ?? "user",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  const applyToken = useCallback((tok: string, u: AuthUser, prevSeenAt: string | null) => {
    setToken(tok);
    setTokenState(tok);
    setUser(u);
    setLastSeenAt(prevSeenAt);
    queryClient.prefetchQuery({ queryKey: ONBOARDING_STATE_KEY });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    setLastSeenAt(null);
    queryClient.removeQueries({ queryKey: ["/api/onboarding/state"] });
    queryClient.removeQueries({ queryKey: ["/api/profile"] });
  }, []);

  // On mount: validate stored token via /api/auth/me
  useEffect(() => {
    const stored = getToken();
    if (!stored || !isAuthenticated()) {
      setIsLoading(false);
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.id && data?.email) {
          setTokenState(stored);
          setUser({ id: data.id, email: data.email, role: data.role ?? "user" });
          setLastSeenAt(data.prevSeenAt ?? null);
          queryClient.prefetchQuery({ queryKey: ONBOARDING_STATE_KEY });
        } else {
          clearToken();
        }
      })
      .catch(() => clearToken())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (hasSupabaseAuthConfig()) {
      const session = await signInWithSupabase(email, password);
      const currentUser = await loadCurrentUser(session.token, { userId: session.userId, email: session.email });
      applyToken(session.token, currentUser, null);
      return;
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed");
    applyToken(data.token, { id: data.userId, email: data.email, role: data.role ?? "user" }, data.prevSeenAt ?? null);
  }, [applyToken]);

  const register = useCallback(async (email: string, password: string) => {
    if (hasSupabaseAuthConfig()) {
      const session = await signUpWithSupabase(email, password);
      const currentUser = await loadCurrentUser(session.token, { userId: session.userId, email: session.email });
      applyToken(session.token, currentUser, null);
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Registration failed");
    applyToken(data.token, { id: data.userId, email: data.email, role: data.role ?? "user" }, null);
  }, [applyToken]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, lastSeenAt, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
