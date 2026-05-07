import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import profileRouter from "../routes/profile.js";
import { db } from "../db.js";
import { profiles, userMedications } from "../../shared/schema.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/profile", authMiddleware, profileRouter);
  return app;
}

const app = buildApp();
const createdUserIds = new Set<string>();

async function cleanupUser(userId: string) {
  await db.delete(userMedications).where(eq(userMedications.user_id, userId));
  await db.delete(profiles).where(eq(profiles.id, userId));
}

async function createProfile(values: Partial<typeof profiles.$inferInsert> = {}) {
  const userId = randomUUID();
  createdUserIds.add(userId);
  await db.insert(profiles).values({
    id: userId,
    language: "en",
    ...values,
  });
  return userId;
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    await cleanupUser(userId);
  }
  createdUserIds.clear();
});

describe("Profile readiness", () => {
  it("blocks service gates for an empty profile", async () => {
    const userId = await createProfile();

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.hasBasics).toBe(false);
    expect(res.body.services.medications.ready).toBe(false);
    expect(res.body.services.adherenceReport.ready).toBe(false);
    expect(res.body.services.sos.ready).toBe(false);
    expect(res.body.services.doctor.ready).toBe(false);
    expect(res.body.services.chat.ready).toBe(true);
    expect(res.body.services.concierge.ready).toBe(false);
    expect(res.body.services.concierge.missing[0].section).toBe("subscription");
    expect(res.body.services.symptomCheck.ready).toBe(false);
  });

  it("unlocks medication services when a usable medication exists", async () => {
    const userId = await createProfile();
    await db.insert(userMedications).values({
      user_id: userId,
      medication_name: "Metformin",
      dosage: "500mg",
      frequency: null,
      scheduled_times: null,
      added_by: "test",
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.hasMedicationForServices).toBe(true);
    expect(res.body.services.medications.ready).toBe(true);
    expect(res.body.services.adherenceReport.ready).toBe(true);
  });

  it("unlocks premium entitlement-only services for premium profiles", async () => {
    const userId = await createProfile({ subscription_tier: "premium" });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.services.chat.ready).toBe(true);
    expect(res.body.services.symptomCheck.ready).toBe(true);
    expect(res.body.services.concierge.ready).toBe(true);
    expect(res.body.services.caregiverDashboard.ready).toBe(true);
  });

  it("keeps local services blocked when address is too partial", async () => {
    const userId = await createProfile({ city: "Madrid" });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.profile.hasLocalAddress).toBe(false);
    expect(res.body.services.localServices.ready).toBe(false);
  });

  it("unlocks SOS when detailed address and emergency contact exist", async () => {
    const userId = await createProfile({
      full_name: "Test User",
      phone_number: "+34600000000",
      address_line_1: "12 Calle Mayor",
      city: "Madrid",
      postcode: "28001",
      country_code: "ES",
      data_sharing_consent: {
        emergency: {
          emergency_name: "Mary User",
          emergency_phone: "+34611111111",
          emergency_role: "Daughter",
        },
      },
    });

    const res = await request(app)
      .get("/api/profile/readiness")
      .set("x-user-id", userId)
      .expect(200);

    expect(res.body.services.sos.ready).toBe(true);
    expect(res.body.services.doctor.ready).toBe(true);
  });
});
