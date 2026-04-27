import { eq } from "drizzle-orm";
import { db, pool } from "../db.js";
import { profiles } from "../../shared/schema.js";

export const CONCIERGE_USE_CASES = [
  "book_ride",
  "order_medicine",
  "book_appointment",
  "home_service",
  "find_provider",
  "find_offers",
  "paperwork",
  "travel",
  "send_message",
  "order_food",
] as const;

export type ConciergeUseCase = (typeof CONCIERGE_USE_CASES)[number];

type TriggerSource =
  | "user_request"
  | "agent_confirmed"
  | "automation"
  | "no_contact_nudge"
  | "manual";

export interface ConciergeTriggerInput {
  userId: string;
  useCase: ConciergeUseCase;
  providerId?: string | null;
  providerName?: string | null;
  providerPhone?: string | null;
  foundExternally?: boolean;
  actionSummary: string;
  actionPayload: Record<string, unknown>;
  language?: string | null;
  triggerSource?: TriggerSource;
  autoStart?: boolean;
}

interface BasicProfile {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  date_of_birth: string | null;
  language: string;
}

interface PendingRow {
  id: string;
  user_id: string;
  use_case: ConciergeUseCase;
  provider_id: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  found_externally: boolean;
  action_summary: string;
  action_payload: Record<string, unknown> | null;
  language: string;
  status: string;
}

export interface TriggerResult {
  pendingId: string;
  status: string;
  conversationId: string | null;
  callSid: string | null;
  message: string;
}

type OutboundResponse = {
  success?: boolean;
  message?: string;
  conversation_id?: string | null;
  callSid?: string | null;
};

const OUTBOUND_AGENT_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_CALLER_AGENT_ID",
  "ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID",
  "ELEVENLABS_OUTBOUND_AGENT_ID",
];

const OUTBOUND_PHONE_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID",
  "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
];

function readEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function formatList(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const items = value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return items.length > 0 ? items.join(", ") : undefined;
  }
  return asString(value);
}

function normalizeLanguage(language?: string | null, fallback = "es"): string {
  const base = language?.split("-")[0]?.toLowerCase().trim();
  if (!base) return fallback;
  return base;
}

function firstName(profile: BasicProfile): string {
  return (
    profile.preferred_name?.trim() ||
    profile.full_name?.trim().split(/\s+/)[0] ||
    "cliente"
  );
}

function buildDynamicVariables(pending: PendingRow, profile: BasicProfile): Record<string, string> {
  const payload = pending.action_payload ?? {};
  const dynamicVariables: Record<string, string> = {
    concierge_pending_id: pending.id,
    user_id: pending.user_id,
    use_case: pending.use_case,
    language: normalizeLanguage(pending.language, normalizeLanguage(profile.language, "es")),
    senior_name: firstName(profile),
  };

  const dob = asString(profile.date_of_birth);
  if (dob) dynamicVariables.date_of_birth = dob;

  const mappings: Array<[string, unknown, "string" | "list"]> = [
    ["pickup_address", payload.pickup_address, "string"],
    ["destination_name", payload.destination_name, "string"],
    ["destination_address", payload.destination_address, "string"],
    ["requested_time", payload.requested_time, "string"],
    ["requested_date", payload.requested_date, "string"],
    ["provider_notes", payload.provider_notes, "string"],
    ["medications", payload.medications, "list"],
    ["delivery_address", payload.delivery_address, "string"],
    ["preferred_delivery", payload.preferred_delivery, "string"],
    ["doctor_name", payload.doctor_name, "string"],
    ["practice_name", payload.practice_name, "string"],
    ["preferred_days", payload.preferred_days, "list"],
    ["preferred_time", payload.preferred_time, "string"],
    ["urgency", payload.urgency, "string"],
    ["reason", payload.reason, "string"],
  ];

  for (const [key, value, mode] of mappings) {
    const formatted = mode === "list" ? formatList(value) : asString(value);
    if (formatted) dynamicVariables[key] = formatted;
  }

  return dynamicVariables;
}

async function ensureProfile(userId: string, language: string) {
  await db
    .insert(profiles)
    .values({
      id: userId,
      language,
    })
    .onConflictDoNothing();
}

async function loadProfile(userId: string): Promise<BasicProfile> {
  const rows = await db
    .select({
      id: profiles.id,
      full_name: profiles.full_name,
      preferred_name: profiles.preferred_name,
      date_of_birth: profiles.date_of_birth,
      language: profiles.language,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const profile = rows[0];
  if (profile) return profile;

  return {
    id: userId,
    full_name: null,
    preferred_name: null,
    date_of_birth: null,
    language: "es",
  };
}

async function insertPending(input: ConciergeTriggerInput, language: string): Promise<PendingRow> {
  const actionPayload = {
    ...input.actionPayload,
    _meta: {
      ...(typeof input.actionPayload._meta === "object" && input.actionPayload._meta !== null
        ? (input.actionPayload._meta as Record<string, unknown>)
        : {}),
      trigger_source: input.triggerSource ?? "user_request",
      created_via: "concierge_trigger_api",
    },
  };

  const result = await pool.query<PendingRow>(
    `
      insert into concierge_pending (
        user_id,
        use_case,
        provider_id,
        provider_name,
        provider_phone,
        found_externally,
        action_summary,
        action_payload,
        language
      )
      values ($1, $2, $3::uuid, $4, $5, $6, $7, $8::jsonb, $9)
      returning
        id,
        user_id,
        use_case,
        provider_id::text,
        provider_name,
        provider_phone,
        found_externally,
        action_summary,
        action_payload,
        language,
        status
    `,
    [
      input.userId,
      input.useCase,
      input.providerId ?? null,
      input.providerName ?? null,
      input.providerPhone ?? null,
      input.foundExternally ?? false,
      input.actionSummary,
      JSON.stringify(actionPayload),
      language,
    ],
  );

  return result.rows[0]!;
}

async function updatePendingStatus(pendingId: string, status: "calling" | "failed" | "cancelled") {
  await pool.query(
    `
      update concierge_pending
      set status = $2, updated_at = now()
      where id = $1::uuid
    `,
    [pendingId, status],
  );
}

async function loadPendingById(pendingId: string): Promise<PendingRow | null> {
  const result = await pool.query<PendingRow>(
    `
      select
        id,
        user_id,
        use_case,
        provider_id::text,
        provider_name,
        provider_phone,
        found_externally,
        action_summary,
        action_payload,
        language,
        status
      from concierge_pending
      where id = $1::uuid
      limit 1
    `,
    [pendingId],
  );

  return result.rows[0] ?? null;
}

async function startOutboundCall(pending: PendingRow, profile: BasicProfile): Promise<TriggerResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = readEnv(OUTBOUND_AGENT_ENV_KEYS);
  const agentPhoneNumberId = readEnv(OUTBOUND_PHONE_ENV_KEYS);

  if (!apiKey) {
    await updatePendingStatus(pending.id, "failed");
    throw new Error("Missing ElevenLabs API key.");
  }

  if (!agentId) {
    await updatePendingStatus(pending.id, "failed");
    throw new Error("Missing ElevenLabs concierge caller agent ID.");
  }

  if (!agentPhoneNumberId) {
    await updatePendingStatus(pending.id, "failed");
    throw new Error("Missing ElevenLabs concierge phone number ID.");
  }

  if (!pending.provider_phone?.trim()) {
    await updatePendingStatus(pending.id, "failed");
    throw new Error("Missing provider phone number for outbound call.");
  }

  const dynamicVariables = buildDynamicVariables(pending, profile);
  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: agentPhoneNumberId,
      to_number: pending.provider_phone,
      conversation_initiation_client_data: {
        dynamic_variables: dynamicVariables,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    await updatePendingStatus(pending.id, "failed");
    throw new Error(`ElevenLabs outbound call failed: ${detail}`);
  }

  const data = (await response.json()) as OutboundResponse;
  await updatePendingStatus(pending.id, "calling");

  return {
    pendingId: pending.id,
    status: "calling",
    conversationId: data.conversation_id ?? null,
    callSid: data.callSid ?? null,
    message: data.message ?? "Outbound concierge call started.",
  };
}

export async function triggerConciergeAction(input: ConciergeTriggerInput): Promise<TriggerResult> {
  const language = normalizeLanguage(input.language ?? null, "es");
  await ensureProfile(input.userId, language);
  const pending = await insertPending(input, language);

  if (input.autoStart === false) {
    return {
      pendingId: pending.id,
      status: pending.status,
      conversationId: null,
      callSid: null,
      message: "Concierge action saved and waiting to start.",
    };
  }

  const profile = await loadProfile(input.userId);
  return startOutboundCall(pending, profile);
}

export async function startPendingConciergeAction(pendingId: string, userId: string): Promise<TriggerResult> {
  const pending = await loadPendingById(pendingId);
  if (!pending) {
    throw new Error("Concierge action not found.");
  }
  if (pending.user_id !== userId) {
    throw new Error("You do not have access to this concierge action.");
  }
  if (pending.status === "calling") {
    return {
      pendingId: pending.id,
      status: pending.status,
      conversationId: null,
      callSid: null,
      message: "Concierge action is already in progress.",
    };
  }
  if (pending.status === "completed" || pending.status === "failed" || pending.status === "cancelled") {
    throw new Error(`Concierge action cannot be started from status "${pending.status}".`);
  }

  const profile = await loadProfile(userId);
  return startOutboundCall(pending, profile);
}

export async function cancelPendingConciergeAction(pendingId: string, userId: string): Promise<void> {
  const pending = await loadPendingById(pendingId);
  if (!pending) {
    throw new Error("Concierge action not found.");
  }
  if (pending.user_id !== userId) {
    throw new Error("You do not have access to this concierge action.");
  }
  if (pending.status === "completed" || pending.status === "failed" || pending.status === "cancelled") {
    return;
  }

  await updatePendingStatus(pendingId, "cancelled");
}
