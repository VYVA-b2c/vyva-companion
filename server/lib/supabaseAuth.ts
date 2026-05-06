type SupabaseUserResponse = {
  id?: unknown;
  email?: unknown;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function verifySupabaseAccessToken(token: string): Promise<{ id: string; email?: string } | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    const user = (await response.json()) as SupabaseUserResponse;
    if (typeof user.id !== "string") return null;

    return {
      id: user.id,
      email: typeof user.email === "string" ? user.email : undefined,
    };
  } catch {
    return null;
  }
}
