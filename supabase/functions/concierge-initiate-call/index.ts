import {
  encodeFilter,
  jsonResponse,
  optionalBoolean,
  optionalObject,
  optionalString,
  requiredString,
  restRequest,
  routeTool,
} from "../_shared/concierge-tools.ts";

interface PendingInsertRow {
  id: string;
}

type OutboundResponse = {
  success?: boolean;
  message?: string;
  conversation_id?: string | null;
  callSid?: string | null;
};

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asListText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => asText(item)).filter(Boolean).join(", ");
  }
  return asText(value);
}

function readEnv(keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

function buildDynamicVariables(
  pendingId: string,
  userId: string,
  useCase: string,
  language: string,
  actionPayload: Record<string, unknown>,
) {
  return {
    concierge_pending_id: pendingId,
    user_id: userId,
    use_case: useCase,
    language,
    senior_name: asText(actionPayload.senior_name),
    date_of_birth: asText(actionPayload.date_of_birth),
    pickup_address: asText(actionPayload.pickup_address),
    destination_name: asText(actionPayload.destination_name),
    destination_address: asText(actionPayload.destination_address),
    requested_time: asText(actionPayload.requested_time),
    requested_date: asText(actionPayload.requested_date),
    provider_notes: asText(actionPayload.provider_notes),
    medications: asListText(actionPayload.medications),
    delivery_address: asText(actionPayload.delivery_address),
    preferred_delivery: asText(actionPayload.preferred_delivery),
    doctor_name: asText(actionPayload.doctor_name),
    practice_name: asText(actionPayload.practice_name),
    preferred_days: asListText(actionPayload.preferred_days),
    preferred_time: asText(actionPayload.preferred_time),
    urgency: asText(actionPayload.urgency) || "routine",
    reason: asText(actionPayload.reason),
  };
}

Deno.serve((req: Request) => routeTool(req, async (body) => {
  const userId = requiredString(body, "user_id")!;
  const useCase = requiredString(body, "use_case");
  const providerName = requiredString(body, "provider_name");
  const providerPhone = requiredString(body, "provider_phone");
  const actionSummary = requiredString(body, "action_summary");
  const language = requiredString(body, "language");
  const providerId = optionalString(body, "provider_id");
  const foundExternally = optionalBoolean(body, "found_externally", false);
  const actionPayload = optionalObject(body, "action_payload");

  if (!useCase || !providerName || !providerPhone || !actionSummary || !language) {
    return jsonResponse({
      error: "use_case, provider_name, provider_phone, action_summary, and language are required",
    }, 400);
  }

  const pendingResult = await restRequest<PendingInsertRow[]>(
    "POST",
    "concierge_pending?select=id",
    {
      prefer: "return=representation",
      body: {
        user_id: userId,
        use_case: useCase,
        provider_id: providerId,
        provider_name: providerName,
        provider_phone: providerPhone,
        found_externally: foundExternally,
        action_summary: actionSummary,
        action_payload: actionPayload,
        status: "calling",
        language,
      },
    },
  );

  const pendingId = pendingResult.data?.[0]?.id;
  if (pendingResult.error || !pendingId) {
    return jsonResponse({ error: pendingResult.error ?? "Failed to create pending action" }, 500);
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
  const agentId = readEnv(["ELEVENLABS_OUTBOUND_AGENT_ID", "ELEVENLABS_CONCIERGE_CALLER_AGENT_ID", "ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID"]);
  const phoneNumberId = readEnv(["ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID", "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID", "ELEVENLABS_AGENT_PHONE_NUMBER_ID"]);

  if (!apiKey || !agentId || !phoneNumberId) {
    const missingConfig = [
      !apiKey ? "ELEVENLABS_API_KEY" : null,
      !agentId ? "ELEVENLABS_OUTBOUND_AGENT_ID" : null,
      !phoneNumberId ? "ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID" : null,
    ].filter(Boolean);

    await restRequest(
      "PATCH",
      `concierge_pending?id=${encodeFilter(pendingId)}`,
      { body: { status: "failed", updated_at: new Date().toISOString() } },
    );
    return jsonResponse({
      error: "ElevenLabs outbound call configuration is missing",
      missing_config: missingConfig,
    }, 500);
  }

  const elevenLabsRes = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: providerPhone,
      conversation_initiation_client_data: {
        dynamic_variables: buildDynamicVariables(pendingId, userId, useCase, language, actionPayload),
      },
    }),
  });

  if (!elevenLabsRes.ok) {
    const detail = await elevenLabsRes.text();
    await restRequest(
      "PATCH",
      `concierge_pending?id=${encodeFilter(pendingId)}`,
      { body: { status: "failed", updated_at: new Date().toISOString() } },
    );
    return jsonResponse({ error: "Failed to start outbound call", detail }, 500);
  }

  const data = await elevenLabsRes.json() as OutboundResponse;
  return jsonResponse({
    success: true,
    pending_id: pendingId,
    conversation_id: data.conversation_id ?? null,
    call_sid: data.callSid ?? null,
    message: language === "es"
      ? "Llamando ahora. Te digo en un momento que han dicho."
      : "Calling now. I will tell you what they say shortly.",
  });
}));
