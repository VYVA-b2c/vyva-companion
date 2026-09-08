import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import profileRouter from "../routes/profile.js";
import { db } from "../db.js";
import { profileMemberships, profiles, users } from "../../shared/schema.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/profile", authMiddleware, profileRouter);
  return app;
}

function buildAppWithRequestUserEmail(userEmail: string) {
  const app = express();
  app.use(express.json());
  app.use("/api/profile", authMiddleware, (req, _res, next) => {
    if (req.user) req.user = { ...req.user, email: userEmail };
    next();
  }, profileRouter);
  return app;
}

const app = buildApp();
const createdProfileIds = new Set<string>();
const createdAccountIds = new Set<string>();

async function createProfile(values: Partial<typeof profiles.$inferInsert> = {}) {
  const profileId = typeof values.id === "string" ? values.id : randomUUID();
  createdProfileIds.add(profileId);
  await db.insert(profiles).values({
    id: profileId,
    language: "en",
    ...values,
  });
  return profileId;
}

async function createAccount(values: Partial<typeof users.$inferInsert> = {}) {
  const accountId = randomUUID();
  createdAccountIds.add(accountId);
  await db.insert(users).values({
    id: accountId,
    email: `profile-save-${randomUUID()}@example.com`,
    password_hash: "test",
    ...values,
  });
  return accountId;
}

afterEach(async () => {
  for (const accountId of createdAccountIds) {
    await db.delete(profileMemberships).where(eq(profileMemberships.user_id, accountId));
  }
  for (const profileId of createdProfileIds) {
    await db.delete(profileMemberships).where(eq(profileMemberships.profile_id, profileId));
    await db.delete(profiles).where(eq(profiles.id, profileId));
  }
  for (const accountId of createdAccountIds) {
    await db.delete(users).where(eq(users.id, accountId));
  }
  createdProfileIds.clear();
  createdAccountIds.clear();
});

describe("Profile save", () => {
  it("saves profiles whose IDs come from external text auth providers", async () => {
    const profileId = `legacy-profile-${randomUUID()}`;
    await createProfile({
      id: profileId,
      full_name: "Legacy User",
      phone_number: "+34600000101",
    });

    await request(app)
      .post("/api/profile")
      .set("x-user-id", profileId)
      .send({
        firstName: "Legacy",
        lastName: "Person",
        preferredName: "Legacy",
        dateOfBirth: "1940-03-09",
        email: "legacy-profile@example.com",
        phone: "+34 600 000 102",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(200);

    const [profile] = await db
      .select({
        full_name: profiles.full_name,
        email: profiles.email,
        phone_number: profiles.phone_number,
      })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    expect(profile).toMatchObject({
      full_name: "Legacy Person",
      email: "legacy-profile@example.com",
      phone_number: "+34600000102",
    });
  });

  it("does not copy the account email onto a separate active care profile", async () => {
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const seniorProfileId = await createProfile({
      full_name: "Elena Senior",
      phone_number: "+34600000001",
    });
    const accountId = await createAccount({
      email: accountEmail,
      active_profile_id: seniorProfileId,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      email: accountEmail,
      phone_number: "+34600000002",
    });
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: seniorProfileId,
      role: "caregiver",
      relationship: "daughter",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    await request(app)
      .post("/api/profile")
      .set("x-user-id", accountId)
      .send({
        firstName: "Elena",
        lastName: "Senior",
        preferredName: "Elena",
        dateOfBirth: "1942-04-10",
        email: accountEmail,
        phone: "+34600000001",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(200);

    const [profile] = await db
      .select({
        full_name: profiles.full_name,
        email: profiles.email,
        phone_number: profiles.phone_number,
        language_preference: profiles.language_preference,
      })
      .from(profiles)
      .where(eq(profiles.id, seniorProfileId))
      .limit(1);

    expect(profile).toMatchObject({
      full_name: "Elena Senior",
      email: null,
      phone_number: "+34600000001",
      language_preference: "en",
    });
  });

  it("does not prefill a linked care profile with the account email", async () => {
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const seniorProfileId = await createProfile({
      full_name: "Elena Senior",
      phone_number: "+34600000001",
    });
    const accountId = await createAccount({
      email: accountEmail,
      active_profile_id: seniorProfileId,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      email: accountEmail,
      phone_number: "+34600000002",
    });
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: seniorProfileId,
      role: "caregiver",
      relationship: "daughter",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    const response = await request(app)
      .get("/api/profile")
      .set("x-user-id", accountId)
      .expect(200);

    expect(response.body).toMatchObject({
      email: "",
      accountEmail,
      accountUserId: accountId,
      profileId: seniorProfileId,
    });
  });

  it("does not prefill the direct account profile with the account email", async () => {
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const accountId = await createAccount({
      email: accountEmail,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      phone_number: "+34600000002",
    });
    await db.update(users).set({ active_profile_id: accountId }).where(eq(users.id, accountId));
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: accountId,
      role: "elder",
      relationship: "self",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    const response = await request(app)
      .get("/api/profile")
      .set("x-user-id", accountId)
      .expect(200);

    expect(response.body).toMatchObject({
      email: "",
      accountEmail,
      accountUserId: accountId,
      profileId: accountId,
    });
  });

  it("returns the preferred profile name as the UI first name", async () => {
    const accountId = await createAccount();
    await createProfile({
      id: accountId,
      full_name: "New Owner",
      preferred_name: "Karim",
      phone_number: "+34600000042",
    });
    await db.update(users).set({ active_profile_id: accountId }).where(eq(users.id, accountId));
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: accountId,
      role: "elder",
      relationship: "self",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    const response = await request(app)
      .get("/api/profile")
      .set("x-user-id", accountId)
      .expect(200);

    expect(response.body).toMatchObject({
      firstName: "Karim",
      lastName: "Owner",
      preferredName: "Karim",
      profileId: accountId,
    });
  });

  it("does not prefill a legacy profile email that matches the account email", async () => {
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const accountId = await createAccount({
      email: accountEmail,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      email: accountEmail,
      phone_number: "+34600000002",
    });
    await db.update(users).set({ active_profile_id: accountId }).where(eq(users.id, accountId));
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: accountId,
      role: "elder",
      relationship: "self",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    const response = await request(app)
      .get("/api/profile")
      .set("x-user-id", accountId)
      .expect(200);

    expect(response.body).toMatchObject({
      email: "",
      accountEmail,
      accountUserId: accountId,
      profileId: accountId,
    });
  });

  it("does not reject the account email on the direct account profile", async () => {
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const accountId = await createAccount({
      email: accountEmail,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      phone_number: "+34600000002",
    });
    await createProfile({
      full_name: "Existing Owner",
      email: accountEmail,
      phone_number: "+34600000003",
    });
    await db.update(users).set({ active_profile_id: accountId }).where(eq(users.id, accountId));
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: accountId,
      role: "elder",
      relationship: "self",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    await request(app)
      .post("/api/profile")
      .set("x-user-id", accountId)
      .send({
        firstName: "Care",
        lastName: "Giver",
        preferredName: "Care",
        dateOfBirth: "1975-04-10",
        email: accountEmail,
        phone: "+34600000002",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(200);

    const [profile] = await db
      .select({
        email: profiles.email,
        phone_number: profiles.phone_number,
      })
      .from(profiles)
      .where(eq(profiles.id, accountId))
      .limit(1);

    expect(profile).toMatchObject({
      email: null,
      phone_number: "+34600000002",
    });
  });

  it("clears a legacy profile email that matches the account email when saving", async () => {
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const accountId = await createAccount({
      email: accountEmail,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      email: accountEmail,
      phone_number: "+34600000002",
    });
    await db.update(users).set({ active_profile_id: accountId }).where(eq(users.id, accountId));
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: accountId,
      role: "elder",
      relationship: "self",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    await request(app)
      .post("/api/profile")
      .set("x-user-id", accountId)
      .send({
        firstName: "Care",
        lastName: "Giver",
        preferredName: "Care",
        dateOfBirth: "1975-04-10",
        email: accountEmail,
        phone: "+34600000002",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(200);

    const [profile] = await db
      .select({
        email: profiles.email,
        phone_number: profiles.phone_number,
      })
      .from(profiles)
      .where(eq(profiles.id, accountId))
      .limit(1);

    expect(profile).toMatchObject({
      email: null,
      phone_number: "+34600000002",
    });
  });

  it("does not reject the account email when the auth email is stale", async () => {
    const appWithStaleAuthEmail = buildAppWithRequestUserEmail(`stale-${randomUUID()}@example.com`);
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const accountId = await createAccount({
      email: accountEmail,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      phone_number: "+34600000002",
    });
    await createProfile({
      full_name: "Existing Owner",
      email: accountEmail,
      phone_number: "+34600000003",
    });
    await db.update(users).set({ active_profile_id: accountId }).where(eq(users.id, accountId));
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: accountId,
      role: "elder",
      relationship: "self",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    await request(appWithStaleAuthEmail)
      .post("/api/profile")
      .set("x-user-id", accountId)
      .send({
        firstName: "Care",
        lastName: "Giver",
        preferredName: "Care",
        dateOfBirth: "1975-04-10",
        email: accountEmail,
        phone: "+34600000002",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(200);

    const [profile] = await db
      .select({
        email: profiles.email,
        phone_number: profiles.phone_number,
      })
      .from(profiles)
      .where(eq(profiles.id, accountId))
      .limit(1);

    expect(profile).toMatchObject({
      email: null,
      phone_number: "+34600000002",
    });
  });

  it("does not reject the account profile email when the auth email is blank", async () => {
    const appWithBlankAuthEmail = buildAppWithRequestUserEmail("");
    const accountEmail = `profile-account-${randomUUID()}@example.com`;
    const seniorProfileId = await createProfile({
      full_name: "Elena Senior",
      phone_number: "+34600000001",
    });
    const accountId = await createAccount({
      email: null,
      active_profile_id: seniorProfileId,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      email: accountEmail,
      phone_number: "+34600000002",
    });
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: seniorProfileId,
      role: "caregiver",
      relationship: "daughter",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    await request(appWithBlankAuthEmail)
      .post("/api/profile")
      .set("x-user-id", accountId)
      .send({
        firstName: "Elena",
        lastName: "Senior",
        preferredName: "Elena",
        dateOfBirth: "1942-04-10",
        email: accountEmail,
        phone: "+34600000001",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(200);

    const [profile] = await db
      .select({
        email: profiles.email,
        phone_number: profiles.phone_number,
      })
      .from(profiles)
      .where(eq(profiles.id, seniorProfileId))
      .limit(1);

    expect(profile).toMatchObject({
      email: null,
      phone_number: "+34600000001",
    });
  });

  it("does not copy the account profile phone onto a separate active care profile", async () => {
    const seniorProfileId = await createProfile({
      full_name: "Elena Senior",
      phone_number: "+34600000001",
    });
    const accountId = await createAccount({
      active_profile_id: seniorProfileId,
    });
    await createProfile({
      id: accountId,
      full_name: "Care Giver",
      email: `caregiver-${randomUUID()}@example.com`,
      phone_number: "+34664338991",
    });
    await db.insert(profileMemberships).values({
      user_id: accountId,
      profile_id: seniorProfileId,
      role: "caregiver",
      relationship: "daughter",
      status: "active",
      is_primary: true,
      accepted_at: new Date(),
    });

    await request(app)
      .post("/api/profile")
      .set("x-user-id", accountId)
      .send({
        firstName: "Elena",
        lastName: "Senior",
        preferredName: "Elena",
        dateOfBirth: "1942-04-10",
        email: "",
        phone: "+34 664 338 991",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(200);

    const [profile] = await db
      .select({
        phone_number: profiles.phone_number,
      })
      .from(profiles)
      .where(eq(profiles.id, seniorProfileId))
      .limit(1);

    expect(profile?.phone_number).toBe("+34600000001");
  });

  it("rejects duplicate profile phone numbers even when formatted differently", async () => {
    await createProfile({
      full_name: "Existing Owner",
      phone_number: "+34600000999",
    });
    const profileId = await createProfile({
      full_name: "New Owner",
      phone_number: "+34600000123",
    });

    const response = await request(app)
      .post("/api/profile")
      .set("x-user-id", profileId)
      .send({
        firstName: "New",
        lastName: "Owner",
        preferredName: "New",
        dateOfBirth: "1942-04-10",
        email: "",
        phone: "+34 600 000 999",
        whatsapp: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "en",
      })
      .expect(409);

    expect(response.body).toMatchObject({
      error: "That phone number is already used on another profile. Choose a different profile phone number.",
    });
  });
});
