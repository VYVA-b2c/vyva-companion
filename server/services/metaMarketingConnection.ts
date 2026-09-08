import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  marketingSocialConnections,
  type MarketingSocialConnectionRow,
} from "../../shared/schema.js";

const META_PROVIDER = "meta";
const DEFAULT_META_GRAPH_API_VERSION = "v24.0";

type MetaGraphError = {
  error?: { message?: string; type?: string; code?: number };
};

export type MetaConnectionSummary = {
  id: string;
  provider: string;
  accountId: string;
  accountName: string;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
  status: string;
  connectedAt: string;
  updatedAt: string;
};

type MetaPage = {
  id?: unknown;
  name?: unknown;
  access_token?: unknown;
  instagram_business_account?: {
    id?: unknown;
    username?: unknown;
  } | null;
};

type MetaOAuthTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

function metaGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_META_GRAPH_API_VERSION;
}

export function metaAppId() {
  return process.env.META_APP_ID?.trim() || process.env.META_CLIENT_ID?.trim() || "";
}

export function metaAppSecret() {
  return process.env.META_APP_SECRET?.trim() || process.env.META_CLIENT_SECRET?.trim() || "";
}

export function metaOAuthRedirectUri() {
  const configured = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  const origin = process.env.VYVA_PUBLIC_URL?.trim() || process.env.APP_URL?.trim() || "http://localhost:5000";
  return `${origin.replace(/\/$/, "")}/api/admin/marketing/social-publishing/meta/callback`;
}

export function metaOAuthConfigured() {
  return Boolean(metaAppId() && metaAppSecret());
}

function connectionEncryptionKey() {
  const secret = process.env.MARKETING_CONNECTION_ENCRYPTION_KEY?.trim()
    || process.env.JWT_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("MARKETING_CONNECTION_ENCRYPTION_KEY or JWT_SECRET is required to store provider credentials.");
  }
  return crypto.createHash("sha256")
    .update(secret || "development-only-marketing-connection-key")
    .digest();
}

export function encryptMarketingAccessToken(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", connectionEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptMarketingAccessToken(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Stored provider credential has an invalid format.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    connectionEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function metaErrorMessage(payload: MetaGraphError, fallback: string) {
  return stringValue(payload.error?.message) || fallback;
}

async function metaFetch<T>(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${metaGraphApiVersion()}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const payload = await response.json().catch(() => ({})) as T & MetaGraphError;
  if (!response.ok) {
    throw new Error(metaErrorMessage(payload, `Meta request failed with status ${response.status}.`));
  }
  return payload;
}

export function metaOAuthUrl(state: string) {
  if (!metaOAuthConfigured()) throw new Error("Meta OAuth is not configured on the Admin deployment.");
  const url = new URL(`https://www.facebook.com/${metaGraphApiVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("redirect_uri", metaOAuthRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
  ].join(","));
  return url.toString();
}

async function exchangeMetaCode(code: string) {
  const url = new URL(`https://graph.facebook.com/${metaGraphApiVersion()}/oauth/access_token`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("redirect_uri", metaOAuthRedirectUri());
  url.searchParams.set("code", code);
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const payload = await response.json().catch(() => ({})) as MetaOAuthTokenResponse & MetaGraphError;
  if (!response.ok || !stringValue(payload.access_token)) {
    throw new Error(metaErrorMessage(payload, `Meta authorization failed with status ${response.status}.`));
  }
  return {
    accessToken: stringValue(payload.access_token)!,
    expiresAt: typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? new Date(Date.now() + payload.expires_in * 1000)
      : null,
  };
}

export async function connectMetaFromAuthorizationCode(input: { code: string; connectedBy: string }) {
  const exchanged = await exchangeMetaCode(input.code);
  const pagesPayload = await metaFetch<{ data?: MetaPage[] }>("/me/accounts", exchanged.accessToken, {
    fields: "id,name,access_token,instagram_business_account{id,username}",
  });
  const pages = Array.isArray(pagesPayload.data) ? pagesPayload.data : [];
  const saved: MetaConnectionSummary[] = [];

  for (const page of pages) {
    const accountId = stringValue(page.id);
    const pageAccessToken = stringValue(page.access_token);
    if (!accountId || !pageAccessToken) continue;
    const instagram = page.instagram_business_account;
    const instagramBusinessAccountId = stringValue(instagram?.id);
    const instagramUsername = stringValue(instagram?.username);
    const now = new Date();
    const [row] = await db.insert(marketingSocialConnections).values({
      provider: META_PROVIDER,
      external_account_id: accountId,
      external_account_name: stringValue(page.name) || accountId,
      access_token_encrypted: encryptMarketingAccessToken(pageAccessToken),
      token_expires_at: exchanged.expiresAt,
      status: "connected",
      metadata: {
        graphApiVersion: metaGraphApiVersion(),
        instagramBusinessAccountId,
        instagramUsername,
      },
      connected_by: input.connectedBy,
      updated_at: now,
    }).onConflictDoUpdate({
      target: [marketingSocialConnections.provider, marketingSocialConnections.external_account_id],
      set: {
        external_account_name: stringValue(page.name) || accountId,
        access_token_encrypted: encryptMarketingAccessToken(pageAccessToken),
        token_expires_at: exchanged.expiresAt,
        status: "connected",
        metadata: {
          graphApiVersion: metaGraphApiVersion(),
          instagramBusinessAccountId,
          instagramUsername,
        },
        connected_by: input.connectedBy,
        updated_at: now,
      },
    }).returning();
    if (row) saved.push(serializeMetaConnection(row));
  }

  if (!saved.length) {
    throw new Error("Meta authorization succeeded, but no Facebook Page was available. Confirm the selected account manages the VYVA Page.");
  }
  return saved;
}

function metadataFor(row: MarketingSocialConnectionRow) {
  return recordValue(row.metadata);
}

export function serializeMetaConnection(row: MarketingSocialConnectionRow): MetaConnectionSummary {
  const metadata = metadataFor(row);
  return {
    id: row.id,
    provider: row.provider,
    accountId: row.external_account_id,
    accountName: row.external_account_name,
    instagramBusinessAccountId: stringValue(metadata.instagramBusinessAccountId),
    instagramUsername: stringValue(metadata.instagramUsername),
    status: row.status,
    connectedAt: row.connected_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listMetaConnections() {
  try {
    const rows = await db.select()
      .from(marketingSocialConnections)
      .where(and(eq(marketingSocialConnections.provider, META_PROVIDER), eq(marketingSocialConnections.status, "connected")))
      .orderBy(desc(marketingSocialConnections.updated_at))
      .limit(50);
    return rows.map(serializeMetaConnection);
  } catch (error) {
    if (String(error).includes('relation "marketing_social_connections" does not exist')) return [];
    throw error;
  }
}

export async function verifyMetaConnection(connectionId?: string) {
  const rows = await db.select()
    .from(marketingSocialConnections)
    .where(and(
      eq(marketingSocialConnections.provider, META_PROVIDER),
      ...(connectionId ? [eq(marketingSocialConnections.id, connectionId)] : []),
      eq(marketingSocialConnections.status, "connected"),
    ))
    .orderBy(desc(marketingSocialConnections.updated_at))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("No connected Meta Page was found.");
  const accessToken = decryptMarketingAccessToken(row.access_token_encrypted);
  const page = await metaFetch<{ id?: unknown; name?: unknown }>(`/${encodeURIComponent(row.external_account_id)}`, accessToken, {
    fields: "id,name",
  });
  return {
    connection: serializeMetaConnection(row),
    verifiedPageId: stringValue(page.id),
    verifiedPageName: stringValue(page.name),
    checkedAt: new Date().toISOString(),
  };
}
