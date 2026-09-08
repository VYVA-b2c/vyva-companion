import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { conversationReadinessHandler, conversationTokenHandler, resolveSocialAgentId } from "./conversationToken";

const ENV_KEYS = [
  "ELEVENLABS_MAIN_VYVA_AGENT_ID",
  "ELEVENLABS_COMPANION_AGENT_ID",
  "ELEVENLABS_AGENT_VYVA",
  "ELEVENLABS_SOCIAL_AGENT_ID",
  "ELEVENLABS_AGENT_ID",
  "VITE_ELEVENLABS_COMPANION_AGENT_ID",
  "VITE_ELEVENLABS_SOCIAL_AGENT_ID",
  "VITE_ELEVENLABS_AGENT_ID",
  "ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID",
  "ELEVENLABS_HEALTH_AGENT_ID",
  "ELEVENLABS_DR_AI_AGENT_ID",
  "ELEVENLABS_MEDITATION_AGENT_ID",
  "ELEVENLABS_BREATHING_MEDITATION_AGENT_ID",
  "ELEVENLABS_BREATHING_AGENT_ID",
  "VYVA_DR_AI_VOICE_MODE",
  "VYVA_DR_AI_VOICE_PILOT_USER_IDS",
  "ELEVENLABS_CONCIERGE_AGENT_ID",
  "ELEVENLABS_ONBOARDING_PROFILE_AGENT_ID",
  "ELEVENLABS_PROFILE_ONBOARDING_AGENT_ID",
  "ELEVENLABS_ONBOARDING_AGENT_ID",
  "VITE_ELEVENLABS_ONBOARDING_PROFILE_AGENT_ID",
  "ELEVENLABS_API_KEY",
  "VITE_ELEVENLABS_API_KEY",
  "ELEVENLABS_CONVAI_API_KEY",
] as const;

const originalEnv = new Map<string, string | undefined>();

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as typeof req & { user: { id: string } }).user = { id: "pilot-user" };
    next();
  });
  app.post("/readiness", conversationReadinessHandler);
  app.post("/token", conversationTokenHandler);
  return app;
}

describe("conversation token agent resolution", () => {
  beforeEach(() => {
    originalEnv.clear();
    ENV_KEYS.forEach((key) => {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    });
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    vi.unstubAllGlobals();
  });

  it("resolves Home main VYVA from the companion agent env var", () => {
    process.env.ELEVENLABS_COMPANION_AGENT_ID = "agent_companion";

    const resolved = resolveSocialAgentId("main-vyva");

    expect(resolved.agentId).toBe("agent_companion");
    expect(resolved.expectedKeys).toContain("ELEVENLABS_COMPANION_AGENT_ID");
  });

  it("prefers the dedicated main VYVA env var when present", () => {
    process.env.ELEVENLABS_MAIN_VYVA_AGENT_ID = "agent_main";
    process.env.ELEVENLABS_COMPANION_AGENT_ID = "agent_companion";

    const resolved = resolveSocialAgentId("main-vyva");

    expect(resolved.agentId).toBe("agent_main");
  });

  it("accepts the documented health agent env alias", () => {
    process.env.ELEVENLABS_HEALTH_AGENT_ID = "agent_health";

    const resolved = resolveSocialAgentId("health");

    expect(resolved.agentId).toBe("agent_health");
    expect(resolved.expectedKeys).toContain("ELEVENLABS_HEALTH_AGENT_ID");
  });

  it("resolves Dr. AI only from its dedicated environment variable", () => {
    process.env.ELEVENLABS_COMPANION_AGENT_ID = "agent_companion";
    expect(resolveSocialAgentId("dr-ai").agentId).toBeUndefined();

    process.env.ELEVENLABS_DR_AI_AGENT_ID = "agent_dr_ai";
    const resolved = resolveSocialAgentId("dr-ai");
    expect(resolved.agentId).toBe("agent_dr_ai");
    expect(resolved.expectedKeys).not.toContain("ELEVENLABS_COMPANION_AGENT_ID");
  });

  it("resolves breathing and meditation only from its dedicated agent secret", () => {
    process.env.ELEVENLABS_COMPANION_AGENT_ID = "agent_companion";
    expect(resolveSocialAgentId("breathing-meditation").agentId).toBeUndefined();

    process.env.ELEVENLABS_MEDITATION_AGENT_ID = "agent_meditation";
    const resolved = resolveSocialAgentId("breathing-meditation");
    expect(resolved.agentId).toBe("agent_meditation");
    expect(resolved.expectedKeys).toContain("ELEVENLABS_MEDITATION_AGENT_ID");
    expect(resolved.expectedKeys).not.toContain("ELEVENLABS_COMPANION_AGENT_ID");
  });

  it("blocks Dr. AI readiness outside the gated pilot", async () => {
    process.env.ELEVENLABS_DR_AI_AGENT_ID = "agent_dr_ai";
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.VYVA_DR_AI_VOICE_MODE = "pilot";
    process.env.VYVA_DR_AI_VOICE_PILOT_USER_IDS = "another-user";

    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "dr-ai" })
      .expect(403);

    expect(res.body).toMatchObject({ code: "DR_AI_VOICE_NOT_ENABLED", mode: "pilot" });
  });

  it("allows an allowlisted Dr. AI pilot user", async () => {
    process.env.ELEVENLABS_DR_AI_AGENT_ID = "agent_dr_ai";
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.VYVA_DR_AI_VOICE_MODE = "pilot";
    process.env.VYVA_DR_AI_VOICE_PILOT_USER_IDS = "pilot-user";

    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "dr-ai" })
      .expect(200);

    expect(res.body).toMatchObject({ ready: true, agent_slug: "dr-ai" });
  });

  it("resolves the dedicated onboarding profile agent slug", () => {
    process.env.ELEVENLABS_ONBOARDING_PROFILE_AGENT_ID = "agent_onboarding_profile";

    const resolved = resolveSocialAgentId("onboarding-profile");

    expect(resolved.agentId).toBe("agent_onboarding_profile");
    expect(resolved.resolvedSlug).toBe("onboarding-profile");
    expect(resolved.expectedKeys).toContain("ELEVENLABS_ONBOARDING_PROFILE_AGENT_ID");
  });

  it("returns a missing agent code when no matching agent is configured", async () => {
    const res = await request(buildApp())
      .post("/token")
      .send({ agent_slug: "concierge" })
      .expect(400);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_AGENT_MISSING",
      agent_slug: "concierge",
    });
  });

  it("checks readiness with the same agent resolution without creating a signed URL", async () => {
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent_concierge";
    process.env.ELEVENLABS_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "concierge" })
      .expect(200);

    expect(res.body).toMatchObject({
      ready: true,
      agent_slug: "concierge",
      source: "slug",
      agent_id_present: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks onboarding profile readiness with the same slug resolver", async () => {
    process.env.ELEVENLABS_ONBOARDING_PROFILE_AGENT_ID = "agent_onboarding_profile";
    process.env.ELEVENLABS_API_KEY = "test-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "onboarding-profile" })
      .expect(200);

    expect(res.body).toMatchObject({
      ready: true,
      agent_slug: "onboarding-profile",
      source: "slug",
      agent_id_present: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a missing agent code from readiness before opening ElevenLabs", async () => {
    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "concierge" })
      .expect(400);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_AGENT_MISSING",
      agent_slug: "concierge",
      agent_id_present: false,
    });
  });

  it("returns a missing API key code from readiness when agent config exists", async () => {
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent_concierge";

    const res = await request(buildApp())
      .post("/readiness")
      .send({ agent_slug: "concierge" })
      .expect(500);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_API_KEY_MISSING",
      error: "Missing ElevenLabs API key",
      agent_slug: "concierge",
      source: "slug",
      agent_id_present: true,
    });
  });

  it("returns a missing API key code when an agent exists without server credentials", async () => {
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent_concierge";

    const res = await request(buildApp())
      .post("/token")
      .send({ agent_slug: "concierge" })
      .expect(500);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_API_KEY_MISSING",
      error: "Missing ElevenLabs API key",
    });
  });

  it("returns a token error code when ElevenLabs omits the signed URL", async () => {
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent_concierge";
    process.env.ELEVENLABS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));

    const res = await request(buildApp())
      .post("/token")
      .send({ agent_slug: "concierge" })
      .expect(502);

    expect(res.body).toMatchObject({
      code: "ELEVENLABS_TOKEN_ERROR",
      error: "ElevenLabs signed URL response was empty",
    });
  });
});
