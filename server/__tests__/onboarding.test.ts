import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { authMiddleware } from "../middleware/auth.js";
import { onboardingRouter } from "../routes/onboarding.js";
import { db } from "../db.js";
import { profiles, onboardingState, userChannelPreferences, teamInvitations } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", authMiddleware, onboardingRouter);
  return app;
}

const app = buildApp();

const TEST_USER_ID = randomUUID();

async function cleanupUser(userId: string) {
  try {
    await db.delete(teamInvitations).where(eq(teamInvitations.senior_id, userId));
    await db.delete(userChannelPreferences).where(eq(userChannelPreferences.user_id, userId));
    await db.delete(onboardingState).where(eq(onboardingState.user_id, userId));
    await db.delete(profiles).where(eq(profiles.id, userId));
  } catch (err) {
    console.error(`[test] cleanupUser failed for ${userId}:`, err);
    throw err;
  }
}

describe("Onboarding journey — end-to-end", () => {
  beforeAll(async () => {
    await cleanupUser(TEST_USER_ID);
  });

  afterAll(async () => {
    await cleanupUser(TEST_USER_ID);
  });

  it("returns 401 when x-user-id header is missing", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .expect(401);

    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("GET /state returns null profile before onboarding starts", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body).toHaveProperty("profile");
    expect(res.body).toHaveProperty("onboardingState");
    expect(res.body.profile).toBeNull();
  });

  it("POST /basics creates profile and advances to stage_2_preferences", async () => {
    const res = await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", TEST_USER_ID)
      .send({
        full_name: "Test User",
        preferred_name: "Testy",
        date_of_birth: "1950-01-15",
        language: "en",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
    expect(res.body).toHaveProperty("trial_ends_at");
  });

  it("POST /basics rejects missing full_name with 400", async () => {
    const res = await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", TEST_USER_ID)
      .send({ language: "en" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("GET /state reflects stage_2_preferences after basics", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.profile.current_stage).toBe("stage_2_preferences");
    expect(res.body.profile.full_name).toBe("Test User");
  });

  it("POST /consent is blocked before channel step (stage gate)", async () => {
    const res = await request(app)
      .post("/api/onboarding/consent")
      .set("x-user-id", TEST_USER_ID)
      .send({
        entries: [{ scope: "conversation_summary", action: "granted", channel: "web_form" }],
      })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.required_stage).toBe("stage_3_health");
  });

  it("POST /channel saves preferences and advances to stage_3_health", async () => {
    const res = await request(app)
      .post("/api/onboarding/channel")
      .set("x-user-id", TEST_USER_ID)
      .send({
        preferred_checkin_channel: "voice_outbound",
        preferred_conversation_channel: "voice_app",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  it("GET /state reflects stage_3_health after channel step", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.profile.current_stage).toBe("stage_3_health");
  });

  it("POST /channel is blocked when basics not yet completed (stage gate)", async () => {
    const otherUser = randomUUID();
    const res = await request(app)
      .post("/api/onboarding/channel")
      .set("x-user-id", otherUser)
      .send({ preferred_checkin_channel: "voice_outbound" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /section/conditions saves health conditions", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/conditions")
      .set("x-user-id", TEST_USER_ID)
      .send({ health_conditions: ["Type 2 Diabetes", "Hypertension"] })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "conditions" });
  });

  it("POST /section/medications saves medications and allergies", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/medications")
      .set("x-user-id", TEST_USER_ID)
      .send({
        medications: [
          { medication_name: "Metformin", dosage: "500mg", frequency: "twice daily" },
        ],
        known_allergies: ["Penicillin"],
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "medications" });
  });

  it("POST /section/address saves address details", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/address")
      .set("x-user-id", TEST_USER_ID)
      .send({
        address_line_1: "12 Oak Street",
        city: "London",
        postcode: "SW1A 1AA",
        country_code: "GB",
        timezone: "Europe/London",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "address" });
  });

  it("POST /section/gp saves GP details", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/gp")
      .set("x-user-id", TEST_USER_ID)
      .send({
        gp_name: "Dr. Jane Smith",
        gp_phone: "020 7946 0958",
        gp_address: "1 Health Centre, London",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "gp" });
  });

  it("POST /section/hobbies saves hobbies", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/hobbies")
      .set("x-user-id", TEST_USER_ID)
      .send({ hobbies: ["Reading", "Gardening", "Walking"] })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "hobbies" });
  });

  it("POST /section/emergency saves emergency contact", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/emergency")
      .set("x-user-id", TEST_USER_ID)
      .send({
        emergency_name: "Mary User",
        emergency_phone: "07700900000",
        emergency_role: "Daughter",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "emergency" });
  });

  it("POST /section/careteam saves a care team member", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/careteam")
      .set("x-user-id", TEST_USER_ID)
      .send({
        role: "family",
        person: { name: "Mary User", relationship: "Daughter", phone: "07700900000" },
        consent: { daily_summary: true, emergency_alerts: true },
        invite_channel: "whatsapp",
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, section: "careteam" });
  });

  it("POST /section/:unknown returns 400 for unknown sections", async () => {
    const res = await request(app)
      .post("/api/onboarding/section/nonexistent")
      .set("x-user-id", TEST_USER_ID)
      .send({})
      .expect(400);

    expect(res.body).toMatchObject({ error: "Unknown section: nonexistent" });
  });

  it("POST /field marks individual onboarding fields", async () => {
    const res = await request(app)
      .post("/api/onboarding/field")
      .set("x-user-id", TEST_USER_ID)
      .send({ field: "has_language" })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, field: "has_language" });
  });

  it("POST /field rejects unknown field names with 400", async () => {
    const res = await request(app)
      .post("/api/onboarding/field")
      .set("x-user-id", TEST_USER_ID)
      .send({ field: "has_nuclear_reactor" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /consent completes onboarding and advances to complete", async () => {
    const res = await request(app)
      .post("/api/onboarding/consent")
      .set("x-user-id", TEST_USER_ID)
      .send({
        entries: [
          { scope: "conversation_summary",       action: "granted", channel: "web_form" },
          { scope: "health_conditions",          action: "granted", channel: "web_form" },
          { scope: "caregiver_full_access",      action: "granted", channel: "web_form" },
        ],
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true, inserted: 3 });
  });

  it("GET /state confirms onboarding is complete", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("x-user-id", TEST_USER_ID)
      .expect(200);

    expect(res.body.profile.current_stage).toBe("complete");
    expect(res.body.profile.onboarding_complete).toBe(true);
  });
});

describe("Onboarding journey — proxy flow", () => {
  const PROXY_USER_ID = randomUUID();

  beforeAll(async () => {
    await cleanupUser(PROXY_USER_ID);

    await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", PROXY_USER_ID)
      .send({ full_name: "Elder Person", language: "en" });
  });

  afterAll(async () => {
    await cleanupUser(PROXY_USER_ID);
  });

  it("POST /proxy records proxy setup (requires basics first)", async () => {
    const res = await request(app)
      .post("/api/onboarding/proxy")
      .set("x-user-id", PROXY_USER_ID)
      .send({ proxy_name: "Mary Carer" })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  it("POST /proxy rejects too-short proxy names", async () => {
    const otherUser = randomUUID();
    await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", otherUser)
      .send({ full_name: "Another Elder", language: "en" });

    const res = await request(app)
      .post("/api/onboarding/proxy")
      .set("x-user-id", otherUser)
      .send({ proxy_name: "X" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    await cleanupUser(otherUser);
  });

  it("POST /consent is blocked for unconfirmed proxy accounts", async () => {
    const res = await request(app)
      .post("/api/onboarding/consent")
      .set("x-user-id", PROXY_USER_ID)
      .send({
        entries: [{ scope: "conversation_summary", action: "granted", channel: "web_form" }],
      })
      .expect(403);

    expect(res.body.code).toBe("ELDER_CONFIRMATION_REQUIRED");
  });

  it("POST /elder-confirm allows the elder to confirm their proxy-initiated account", async () => {
    const res = await request(app)
      .post("/api/onboarding/elder-confirm")
      .set("x-user-id", PROXY_USER_ID)
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  it("POST /consent succeeds after elder confirms proxy account", async () => {
    const res = await request(app)
      .post("/api/onboarding/consent")
      .set("x-user-id", PROXY_USER_ID)
      .send({
        entries: [
          { scope: "conversation_summary", action: "granted", channel: "web_form" },
        ],
      })
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  it("POST /elder-confirm returns 400 for non-proxy accounts", async () => {
    const directUser = randomUUID();
    await request(app)
      .post("/api/onboarding/basics")
      .set("x-user-id", directUser)
      .send({ full_name: "Direct User", language: "en" });

    const res = await request(app)
      .post("/api/onboarding/elder-confirm")
      .set("x-user-id", directUser)
      .expect(400);

    expect(res.body).toHaveProperty("error");
    await cleanupUser(directUser);
  });
});
