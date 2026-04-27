export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const REST_BASE = `${SUPABASE_URL}/rest/v1`;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface RestResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function requireConfig(): string | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return "Missing Supabase function configuration.";
  }
  return null;
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function requiredString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

export function optionalBoolean(body: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = body[key];
  return typeof value === "boolean" ? value : fallback;
}

export function optionalObject(body: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = body[key];
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function encodeFilter(value: string) {
  return encodeURIComponent(`eq.${value}`);
}

export function encodeParam(value: string) {
  return encodeURIComponent(value);
}

function restHeaders(acceptObject = false): HeadersInit {
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    Accept: acceptObject ? "application/vnd.pgrst.object+json" : "application/json",
  };
  return headers;
}

export async function restRequest<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    acceptObject?: boolean;
    prefer?: string;
    allowEmpty?: boolean;
  } = {},
): Promise<RestResult<T>> {
  const headers = restHeaders(options.acceptObject);
  if (options.prefer) {
    (headers as Record<string, string>).Prefer = options.prefer;
  }

  const response = await fetch(`${REST_BASE}/${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if ((response.status === 404 || response.status === 406) && options.allowEmpty) {
    return { data: null, error: null, status: response.status };
  }

  if (!response.ok) {
    return { data: null, error: await response.text(), status: response.status };
  }

  const text = await response.text();
  if (!text) return { data: null, error: null, status: response.status };
  return { data: JSON.parse(text) as T, error: null, status: response.status };
}

export async function routeTool(
  req: Request,
  handler: (body: Record<string, unknown>) => Promise<Response>,
): Promise<Response> {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configError = requireConfig();
  if (configError) {
    console.error(configError);
    return jsonResponse({ error: configError }, 500);
  }

  const body = await readJsonBody(req);
  if (!requiredString(body, "user_id")) {
    return jsonResponse({ error: "user_id is required" }, 400);
  }

  try {
    return await handler(body);
  } catch (err) {
    console.error("[concierge tool]", err);
    return jsonResponse({ error: (err as Error).message || "Server error" }, 500);
  }
}
