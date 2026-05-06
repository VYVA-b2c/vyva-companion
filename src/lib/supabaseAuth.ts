type SupabaseAuthResponse = {
  access_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
  error?: string;
  error_description?: string;
  msg?: string;
};

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

export function hasSupabaseAuthConfig(): boolean {
  return getSupabaseConfig() !== null;
}

async function supabaseAuthFetch(path: string, body: Record<string, unknown>): Promise<SupabaseAuthResponse> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase auth is not configured.");

  const response = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as SupabaseAuthResponse;
  if (!response.ok) {
    throw new Error(data.error_description ?? data.msg ?? data.error ?? "Authentication failed");
  }

  return data;
}

export async function signInWithSupabase(email: string, password: string) {
  const data = await supabaseAuthFetch("/auth/v1/token?grant_type=password", { email, password });
  if (!data.access_token || !data.user?.id) throw new Error("Authentication failed");
  return {
    token: data.access_token,
    userId: data.user.id,
    email: data.user.email ?? email,
  };
}

export async function signUpWithSupabase(email: string, password: string) {
  const data = await supabaseAuthFetch("/auth/v1/signup", { email, password });
  if (!data.access_token || !data.user?.id) {
    throw new Error("Check your inbox to confirm your account, then sign in.");
  }
  return {
    token: data.access_token,
    userId: data.user.id,
    email: data.user.email ?? email,
  };
}

export async function sendSupabasePasswordReset(email: string) {
  await supabaseAuthFetch("/auth/v1/recover", { email });
}
