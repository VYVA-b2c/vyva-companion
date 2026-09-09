import { describe, expect, it } from "vitest";
import { buildWhatsappMessageParams } from "./communicationDispatcher.js";

function communication(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    intake_id: null,
    user_id: null,
    channel: "whatsapp",
    recipient: "+34600111222",
    purpose: "private_checkin",
    status: "queued",
    provider_message_id: null,
    body: "Neutral fallback",
    metadata: {},
    sent_at: null,
    created_at: new Date(),
    ...overrides,
  } as never;
}

describe("WhatsApp dispatcher content templates", () => {
  it("uses ContentSid and opaque variables without also sending Body", () => {
    const params = buildWhatsappMessageParams(communication({
      metadata: {
        content_sid: "HX123",
        content_variables: { "1": "opaque-ticket" },
      },
    }));
    expect(params.get("To")).toBe("whatsapp:+34600111222");
    expect(params.get("ContentSid")).toBe("HX123");
    expect(params.get("ContentVariables")).toBe('{"1":"opaque-ticket"}');
    expect(params.has("Body")).toBe(false);
  });

  it("preserves the existing inline-body behavior for all current callers", () => {
    const params = buildWhatsappMessageParams(communication());
    expect(params.get("Body")).toBe("Neutral fallback");
    expect(params.has("ContentSid")).toBe(false);
  });
});
