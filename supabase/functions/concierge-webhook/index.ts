const WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REST_BASE = `${SUPABASE_URL}/rest/v1`;

type SupportedWebhookType = "post_call_transcription" | "call_initiation_failure";
type ConciergeOutcome = "confirmed" | "no_answer" | "cant_fulfil" | "user_cancelled" | "error";

interface PendingRow {
  id: string;
  user_id: string;
  use_case: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  found_externally: boolean;
  action_summary: string;
  action_payload: Record<string, unknown> | null;
  status: string;
  language: string | null;
}

interface ExistingSessionRow {
  id: string;
}

interface ProviderUseCountRow {
  use_count: number | null;
}

interface DataCollectionField {
  value: string;
}

type DataCollectionResults = Record<string, DataCollectionField | undefined>;

type OutcomePayload = Record<string, unknown> & {
  confirmed_time?: string | null;
  eta_minutes?: number | null;
  fare_estimate?: string | null;
  reference?: string | null;
  delivery_date?: string | null;
  delivery_window?: string | null;
  notes?: string | null;
  reason?: string | null;
  alternative_offered?: boolean;
  alternative_detail?: string | null;
};

interface ElevenLabsPayload {
  type?: string;
  event_timestamp?: number;
  data?: {
    agent_id?: string;
    conversation_id?: string;
    status?: string;
    call_duration_secs?: number;
    analysis?: {
      data_collection_results?: DataCollectionResults;
    };
    failure_reason?: string;
    conversation_initiation_client_data?: {
      dynamic_variables?: Record<string, string>;
    };
  };
}

interface RestResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

function jsonResponse(body: string, status = 200) {
  return new Response(body, { status });
}

function buildRestHeaders(acceptObject = false): HeadersInit {
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  if (acceptObject) {
    headers.Accept = "application/vnd.pgrst.object+json";
  } else {
    headers.Accept = "application/json";
  }

  return headers;
}

async function restRequest<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    acceptObject?: boolean;
    prefer?: string;
    allowEmpty?: boolean;
  } = {},
): Promise<RestResult<T>> {
  const headers = buildRestHeaders(options.acceptObject);
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
    return {
      data: null,
      error: await response.text(),
      status: response.status,
    };
  }

  const text = await response.text();
  if (!text) {
    return { data: null, error: null, status: response.status };
  }

  return {
    data: JSON.parse(text) as T,
    error: null,
    status: response.status,
  };
}

function getDynamicVariables(payload: ElevenLabsPayload): Record<string, string> {
  return payload.data?.conversation_initiation_client_data?.dynamic_variables ?? {};
}

async function verifySignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  if (!secret || !signatureHeader) return false;

  const parts = signatureHeader.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const receivedHash = parts.find((part) => part.startsWith("v0="))?.slice(3);

  if (!timestamp || !receivedHash) return false;

  const parsedTimestamp = Number.parseInt(timestamp, 10);
  if (Number.isNaN(parsedTimestamp)) return false;

  const age = Math.floor(Date.now() / 1000) - parsedTimestamp;
  if (age > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  );

  const computedHash = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  if (computedHash.length !== receivedHash.length) return false;

  let mismatch = 0;
  for (let index = 0; index < computedHash.length; index += 1) {
    mismatch |= computedHash.charCodeAt(index) ^ receivedHash.charCodeAt(index);
  }

  return mismatch === 0;
}

function mapOutcome(
  webhookType: SupportedWebhookType,
  analysisOutcome?: string,
): ConciergeOutcome {
  if (webhookType === "call_initiation_failure") {
    return "no_answer";
  }

  switch (analysisOutcome) {
    case "confirmed":
      return "confirmed";
    case "no_answer":
      return "no_answer";
    case "cant_fulfil":
      return "cant_fulfil";
    default:
      return "error";
  }
}

function buildOutcomePayload(outcome: ConciergeOutcome, results: DataCollectionResults): OutcomePayload {
  if (outcome === "confirmed") {
    return {
      confirmed_time: results.confirmed_time?.value ?? null,
      eta_minutes: results.eta_minutes?.value ? Number.parseInt(results.eta_minutes.value, 10) : null,
      fare_estimate: results.fare_estimate?.value ?? null,
      reference: results.reference?.value ?? null,
      delivery_date: results.delivery_date?.value ?? null,
      delivery_window: results.delivery_window?.value ?? null,
      notes: results.notes?.value ?? null,
    };
  }

  if (outcome === "cant_fulfil") {
    return {
      reason: results.notes?.value ?? null,
      alternative_offered: !!results.alternative_detail?.value,
      alternative_detail: results.alternative_detail?.value ?? null,
    };
  }

  if (outcome === "no_answer") {
    return { retry_suggested: true };
  }

  return {};
}

function buildOutcomeSummary(
  useCase: string,
  outcome: ConciergeOutcome,
  outcomePayload: OutcomePayload,
  providerName: string,
  language: string,
): string {
  const p = outcomePayload;

  const templates = {
    es: {
      book_ride: {
        confirmed: `Tu taxi esta confirmado para las ${p.confirmed_time}. El conductor llegara en unos ${p.eta_minutes} minutos.`,
        no_answer: `${providerName} no contesto. Quieres que lo intente de nuevo en 10 minutos?`,
        cant_fulfil: `${providerName} no tiene disponibilidad a esa hora. ${p.alternative_detail ? `Han ofrecido: ${p.alternative_detail}.` : ""} Que prefieres hacer?`,
      },
      order_medicine: {
        confirmed: `Tu pedido esta confirmado en ${providerName}. Entrega prevista ${p.delivery_date} entre ${p.delivery_window}.`,
        no_answer: `${providerName} no contesto. Quieres que lo intente de nuevo mas tarde?`,
        cant_fulfil: `${providerName} no puede completar el pedido ahora. ${p.alternative_detail ?? ""} Que quieres hacer?`,
      },
      book_appointment: {
        confirmed: `Cita confirmada para el ${p.confirmed_time}. ${p.notes ? p.notes : ""}`.trim(),
        no_answer: "La consulta no contesto. Quieres que lo intente de nuevo?",
        cant_fulfil: `No hay cita disponible en ese horario. ${p.alternative_detail ? `Han ofrecido: ${p.alternative_detail}.` : ""} Te parece bien?`,
      },
      home_service: {
        confirmed: `${providerName} confirmo la visita para el ${p.confirmed_time}.`,
        no_answer: `${providerName} no contesto. Quieres que pruebe con otro?`,
        cant_fulfil: `${providerName} no puede venir ahora. ${p.alternative_detail ?? ""}`.trim(),
      },
      default: {
        confirmed: `Hecho. Todo confirmado con ${providerName}.`,
        no_answer: "No hubo respuesta. Lo intentamos de nuevo?",
        cant_fulfil: "No pudieron ayudarnos esta vez. Que quieres hacer?",
        error: "Hubo un problema al completar la llamada. Quieres que lo intente de nuevo?",
      },
    },
    de: {
      book_ride: {
        confirmed: `Dein Taxi ist fur ${p.confirmed_time} Uhr bestatigt. Der Fahrer kommt in etwa ${p.eta_minutes} Minuten.`,
        no_answer: `${providerName} hat nicht geantwortet. Soll ich es in 10 Minuten nochmal versuchen?`,
        cant_fulfil: `${providerName} hat zu dieser Zeit keine Verfugbarkeit. ${p.alternative_detail ? `Alternativ wurde angeboten: ${p.alternative_detail}.` : ""} Was mochtest du tun?`,
      },
      default: {
        confirmed: `Erledigt. Alles mit ${providerName} bestatigt.`,
        no_answer: "Keine Antwort. Soll ich es nochmal versuchen?",
        cant_fulfil: "Es hat diesmal nicht geklappt. Was mochtest du tun?",
        error: "Beim Anruf ist ein Problem aufgetreten. Soll ich es noch einmal versuchen?",
      },
    },
    en: {
      book_ride: {
        confirmed: `Your taxi is confirmed for ${p.confirmed_time}. The driver will arrive in about ${p.eta_minutes} minutes.`,
        no_answer: `${providerName} didn't answer. Shall I try again in 10 minutes?`,
        cant_fulfil: `${providerName} isn't available at that time. ${p.alternative_detail ? `They offered: ${p.alternative_detail}.` : ""} What would you like to do?`,
      },
      order_medicine: {
        confirmed: `Your order is confirmed at ${providerName}. Expected delivery ${p.delivery_date} between ${p.delivery_window}.`,
        no_answer: `${providerName} didn't answer. Shall I try again later?`,
        cant_fulfil: `${providerName} can't complete the order right now. ${p.alternative_detail ?? ""} What would you like to do?`,
      },
      book_appointment: {
        confirmed: `Appointment confirmed for ${p.confirmed_time}. ${p.notes ?? ""}`.trim(),
        no_answer: "The practice didn't answer. Shall I try again?",
        cant_fulfil: `No appointment available at that time. ${p.alternative_detail ? `They offered: ${p.alternative_detail}.` : ""} Does that work?`,
      },
      default: {
        confirmed: `Done. All confirmed with ${providerName}.`,
        no_answer: "No answer. Shall I try again?",
        cant_fulfil: "They couldn't help this time. What would you like to do?",
        error: "There was a problem completing the call. Would you like me to try again?",
      },
    },
  } as const;

  const lang = templates[language as keyof typeof templates] ?? templates.en;
  const useCaseTemplates = (lang as Record<string, Record<string, string>>)[useCase] ?? lang.default;

  return useCaseTemplates[outcome] ?? lang.default[outcome] ?? lang.default.error;
}

function encodeFilter(value: string) {
  return encodeURIComponent(`eq.${value}`);
}

async function fetchPending(pendingId: string): Promise<RestResult<PendingRow>> {
  return await restRequest<PendingRow>(
    "GET",
    `concierge_pending?select=*&id=${encodeFilter(pendingId)}`,
    { acceptObject: true, allowEmpty: true },
  );
}

async function fetchExistingSession(pendingId: string): Promise<RestResult<ExistingSessionRow>> {
  return await restRequest<ExistingSessionRow>(
    "GET",
    `concierge_sessions?select=id&pending_id=${encodeFilter(pendingId)}`,
    { acceptObject: true, allowEmpty: true },
  );
}

async function insertSession(payload: Record<string, unknown>): Promise<RestResult<ExistingSessionRow[]>> {
  return await restRequest<ExistingSessionRow[]>(
    "POST",
    "concierge_sessions?select=id",
    { body: payload, prefer: "return=representation" },
  );
}

async function updateSession(sessionId: string, payload: Record<string, unknown>): Promise<RestResult<null>> {
  return await restRequest<null>(
    "PATCH",
    `concierge_sessions?id=${encodeFilter(sessionId)}`,
    { body: payload },
  );
}

async function updatePending(pendingId: string, payload: Record<string, unknown>): Promise<RestResult<null>> {
  return await restRequest<null>(
    "PATCH",
    `concierge_pending?id=${encodeFilter(pendingId)}`,
    { body: payload },
  );
}

async function insertReminder(payload: Record<string, unknown>): Promise<RestResult<null>> {
  return await restRequest<null>(
    "POST",
    "concierge_reminders",
    { body: payload },
  );
}

async function fetchProviderUseCount(providerId: string): Promise<RestResult<ProviderUseCountRow>> {
  return await restRequest<ProviderUseCountRow>(
    "GET",
    `user_providers?select=use_count&id=${encodeFilter(providerId)}`,
    { acceptObject: true, allowEmpty: true },
  );
}

async function updateProvider(providerId: string, payload: Record<string, unknown>): Promise<RestResult<null>> {
  return await restRequest<null>(
    "PATCH",
    `user_providers?id=${encodeFilter(providerId)}`,
    { body: payload },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse("Method not allowed", 405);
  }

  if (!WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing required environment variables");
    return jsonResponse("Server misconfigured", 500);
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("ElevenLabs-Signature") ?? "";

  const isValid = await verifySignature(rawBody, signatureHeader, WEBHOOK_SECRET);
  if (!isValid) {
    console.error("Invalid webhook signature");
    return jsonResponse("Unauthorized", 401);
  }

  let payload: ElevenLabsPayload;
  try {
    payload = JSON.parse(rawBody) as ElevenLabsPayload;
  } catch {
    console.error("Invalid JSON payload");
    return jsonResponse("Bad request", 400);
  }

  const webhookType = payload.type;
  if (webhookType !== "post_call_transcription" && webhookType !== "call_initiation_failure") {
    console.log(`Ignoring webhook type: ${webhookType ?? "unknown"}`);
    return jsonResponse("OK", 200);
  }

  const dynamicVars = getDynamicVariables(payload);
  const pendingId = dynamicVars.concierge_pending_id;
  const language = dynamicVars.language ?? "es";

  if (!pendingId) {
    console.warn("No concierge_pending_id in webhook - ignoring");
    return jsonResponse("OK", 200);
  }

  const pendingResult = await fetchPending(pendingId);
  const pendingRow = pendingResult.data;

  if (pendingResult.error || !pendingRow) {
    console.warn(`concierge_pending row not found: ${pendingId}`);
    return jsonResponse("OK", 200);
  }

  if (pendingRow.status === "completed" || pendingRow.status === "failed") {
    console.log(`Pending ${pendingId} already processed - skipping`);
    return jsonResponse("OK", 200);
  }

  let outcome: ConciergeOutcome;
  let outcomePayload: OutcomePayload = {};
  let callDurationSecs: number | null = null;

  if (webhookType === "call_initiation_failure") {
    outcome = "no_answer";
  } else {
    const dataCollection = payload.data?.analysis?.data_collection_results ?? {};
    const rawOutcome = dataCollection.outcome?.value ?? "error";
    outcome = mapOutcome("post_call_transcription", rawOutcome);
    outcomePayload = buildOutcomePayload(outcome, dataCollection);
    callDurationSecs = payload.data?.call_duration_secs ?? null;
  }

  const outcomeSummary = buildOutcomeSummary(
    pendingRow.use_case,
    outcome,
    outcomePayload,
    pendingRow.provider_name ?? "",
    language,
  );

  const locationType = typeof pendingRow.action_payload?.location_type === "string"
    ? pendingRow.action_payload.location_type
    : null;

  const existingSessionResult = await fetchExistingSession(pendingRow.id);
  let sessionId: string;

  if (existingSessionResult.data?.id) {
    sessionId = existingSessionResult.data.id;

    const updateResult = await updateSession(sessionId, {
      outcome,
      outcome_payload: outcomePayload,
      outcome_summary: outcomeSummary,
      call_duration_seconds: callDurationSecs,
      location_type: locationType,
      completed_at: new Date().toISOString(),
    });

    if (updateResult.error) {
      console.error("Failed to update existing concierge_sessions row:", updateResult.error);
      return jsonResponse("Internal error", 500);
    }
  } else {
    const insertResult = await insertSession({
      user_id: pendingRow.user_id,
      pending_id: pendingRow.id,
      use_case: pendingRow.use_case,
      provider_id: pendingRow.provider_id,
      provider_name: pendingRow.provider_name,
      provider_phone: pendingRow.provider_phone,
      found_externally: pendingRow.found_externally,
      action_summary: pendingRow.action_summary,
      action_payload: pendingRow.action_payload,
      outcome,
      outcome_payload: outcomePayload,
      outcome_summary: outcomeSummary,
      family_notified: false,
      call_duration_seconds: callDurationSecs,
      location_type: locationType,
      completed_at: new Date().toISOString(),
    });

    if (insertResult.error || !insertResult.data?.[0]?.id) {
      console.error("Failed to write concierge_sessions:", insertResult.error);
      return jsonResponse("Internal error", 500);
    }

    sessionId = insertResult.data[0].id;
  }

  await updatePending(pendingId, {
    status: outcome === "error" ? "failed" : "completed",
    updated_at: new Date().toISOString(),
  });

  if (
    pendingRow.use_case === "book_appointment" &&
    outcome === "confirmed" &&
    typeof outcomePayload.confirmed_time === "string"
  ) {
    const requestedDate = typeof pendingRow.action_payload?.requested_date === "string"
      ? pendingRow.action_payload.requested_date
      : undefined;

    if (requestedDate) {
      const reminderResult = await insertReminder({
        user_id: pendingRow.user_id,
        reminder_type: "appointment",
        title: `Cita con ${pendingRow.provider_name ?? "el medico"}`,
        description: outcomeSummary,
        reminder_date: requestedDate,
        reminder_time: outcomePayload.confirmed_time,
        advance_notice_days: 1,
        source_session_id: sessionId,
        source_use_case: pendingRow.use_case,
        language: pendingRow.language ?? "es",
      });

      if (reminderResult.error) {
        console.error("Failed to create reminder:", reminderResult.error);
      }
    }
  }

  if (outcome === "confirmed" && pendingRow.provider_id) {
    const providerResult = await fetchProviderUseCount(pendingRow.provider_id);

    if (providerResult.data) {
      await updateProvider(pendingRow.provider_id, {
        use_count: (providerResult.data.use_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  console.log(`Webhook processed: pending=${pendingId} outcome=${outcome} session=${sessionId}`);
  return jsonResponse("OK", 200);
});
