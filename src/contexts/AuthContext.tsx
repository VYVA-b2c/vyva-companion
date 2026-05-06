import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getToken, setToken, clearToken, isAuthenticated } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { setLanguage as setAppLanguage } from "@/i18n";
import { signInWithSupabase } from "@/lib/supabaseAuth";

const ONBOARDING_STATE_KEY = ["/api/onboarding/state"] as const;

interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  language: string | null;
  activeProfileId: string | null;
  role: string;
}

interface AuthIdentifier {
  email?: string;
  phone?: string;
  identifier?: string;
  language?: string;
}

interface MagicLinkResponse {
  message: string;
  _devMagicLink?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  lastSeenAt: string | null;
  login: (identifier: string | AuthIdentifier, password: string) => Promise<void>;
  register: (identifier: string | AuthIdentifier, password: string) => Promise<void>;
  requestMagicLink: (identifier: string | AuthIdentifier) => Promise<MagicLinkResponse>;
  loginWithMagicToken: (magicToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function contactPayload(identifier: string | AuthIdentifier): AuthIdentifier {
  if (typeof identifier === "string") return { identifier };
  return identifier;
}

function emailFromIdentifier(identifier: string | AuthIdentifier): string | null {
  const payload = contactPayload(identifier);
  const raw = payload.email ?? (payload.identifier?.includes("@") ? payload.identifier : null);
  return raw?.trim() || null;
}

function responseUser(data: {
  userId?: string;
  id?: string;
  email?: string | null;
  phone?: string | null;
  language?: string | null;
  activeProfileId?: string | null;
  role?: string | null;
}): AuthUser {
  return {
    id: data.userId ?? data.id ?? "",
    email: data.email ?? null,
    phone: data.phone ?? null,
    language: data.language ?? null,
    activeProfileId: data.activeProfileId ?? null,
    role: data.role ?? "user",
  };
}

async function loadCurrentUser(token: string, fallback?: { userId?: string; email?: string | null }): Promise<AuthUser> {
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not load your account");
  }

  const data = await response.json();
  return responseUser({
    ...data,
    id: data.id ?? fallback?.userId,
    email: data.email ?? fallback?.email,
  });
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
    if (u.language) setAppLanguage(u.language);
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
        if (data?.id) {
          const hydratedUser = responseUser(data);
          setTokenState(stored);
          setUser(hydratedUser);
          setLastSeenAt(data.prevSeenAt ?? null);
          if (hydratedUser.language) setAppLanguage(hydratedUser.language);
          queryClient.prefetchQuery({ queryKey: ONBOARDING_STATE_KEY });
        } else {
          clearToken();
        }
      })
      .catch(() => clearToken())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (identifier: string | AuthIdentifier, password: string) => {
    const email = emailFromIdentifier(identifier);
    if (email) {
      try {
        const session = await signInWithSupabase(email, password);
        const currentUser = await loadCurrentUser(session.token, { userId: session.userId, email: session.email });
        applyToken(session.token, currentUser, null);
        return;
      } catch {
        // Fall back to VYVA's backend auth so regular email/password accounts
        // are not blocked by Supabase confirmation or SMTP setup.
      }
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contactPayload(identifier), password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Login failed");
    applyToken(data.token, responseUser(data), data.prevSeenAt ?? null);
  }, [applyToken]);

  const register = useCallback(async (identifier: string | AuthIdentifier, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contactPayload(identifier), password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Registration failed");
    applyToken(data.token, responseUser(data), null);
  }, [applyToken]);

  const requestMagicLink = useCallback(async (identifier: string | AuthIdentifier) => {
    const res = await fetch("/api/auth/magic-link-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contactPayload(identifier)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Could not send sign-in link");
    return data as MagicLinkResponse;
  }, []);

  const loginWithMagicToken = useCallback(async (magicToken: string) => {
    const res = await fetch("/api/auth/magic-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: magicToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "This sign-in link did not work");
    applyToken(data.token, responseUser(data), data.prevSeenAt ?? null);
  }, [applyToken]);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, lastSeenAt, login, register, requestMagicLink, loginWithMagicToken, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
