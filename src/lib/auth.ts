const TOKEN_KEY = "vyva_auth_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    console.warn("[auth] Could not persist token to localStorage");
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  // Quick expiry check without full verification (server always verifies)
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.exp === "number" && decoded.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
