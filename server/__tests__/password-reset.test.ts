import "dotenv/config";
import { randomUUID, randomBytes } from "crypto";
import express from "express";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { authRouter } from "../routes/auth.js";
import { db } from "../db.js";
import { users, profiles } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  return app;
}

const app = buildApp();

const TEST_EMAIL = `test-reset-${randomUUID()}@example.com`;
const TEST_PASSWORD = "original-password-123";
const NEW_PASSWORD = "new-password-456";

async function cleanupEmail(email: string) {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (user) {
      await db.delete(profiles).where(eq(profiles.id, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
  } catch (err) {
    console.error(`[test] cleanupEmail failed for ${email}:`, err);
    throw err;
  }
}

describe("Password reset flow", () => {
  beforeAll(async () => {
    await cleanupEmail(TEST_EMAIL);
    await request(app)
      .post("/api/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(201);
  });

  afterAll(async () => {
    await cleanupEmail(TEST_EMAIL);
  });

  it("POST /reset-request returns 200 for an unknown email without revealing whether it exists", async () => {
    const res = await request(app)
      .post("/api/auth/reset-request")
      .send({ email: `unknown-${randomUUID()}@example.com` })
      .expect(200);

    expect(res.body).toHaveProperty("message");
    // Token must never leak for unknown addresses
    expect(res.body).not.toHaveProperty("resetToken");
    expect(res.body._devToken).toBeUndefined();
  });

  it("POST /reset-request returns 400 for an invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/reset-request")
      .send({ email: "not-an-email" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  let resetToken: string;

  it("POST /reset-request issues a token stored in the DB (retrieved via _devToken in dev mode)", async () => {
    const res = await request(app)
      .post("/api/auth/reset-request")
      .send({ email: TEST_EMAIL })
      .expect(200);

    expect(res.body).toHaveProperty("message");

    // Token must never appear as `resetToken` or `token` in the response body
    expect(res.body).not.toHaveProperty("resetToken");
    expect(res.body).not.toHaveProperty("token");

    // In dev/test mode the token is exposed under _devToken so tests don't need a mail server
    expect(res.body).toHaveProperty("_devToken");
    expect(typeof res.body._devToken).toBe("string");
    expect(res.body._devToken.length).toBeGreaterThan(0);

    resetToken = res.body._devToken;

    // Verify the token was actually persisted in the database
    const [user] = await db
      .select({ reset_token: users.reset_token, reset_token_expires_at: users.reset_token_expires_at })
      .from(users)
      .where(eq(users.email, TEST_EMAIL.toLowerCase()))
      .limit(1);

    expect(user.reset_token).toBe(resetToken);
    expect(user.reset_token_expires_at).not.toBeNull();
    expect(new Date(user.reset_token_expires_at!).getTime()).toBeGreaterThan(Date.now());
  });

  it("POST /reset-password rejects an entirely invalid token with 400", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "this-token-does-not-exist", password: NEW_PASSWORD })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/invalid|expired/i);
  });

  it("POST /reset-password rejects a password that is too short", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: "short" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/8 char/i);
  });

  it("POST /reset-password rejects an expired token", async () => {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL.toLowerCase()))
      .limit(1);

    const expiredDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expiredToken = randomBytes(32).toString("hex");

    await db
      .update(users)
      .set({ reset_token: expiredToken, reset_token_expires_at: expiredDate })
      .where(eq(users.id, user.id));

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: expiredToken, password: "brandnewpassword123" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/expired/i);

    // Restore the valid token for subsequent tests
    await db
      .update(users)
      .set({ reset_token: resetToken, reset_token_expires_at: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(users.id, user.id));
  });

  it("full happy path: valid token → new password works → old password fails", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: NEW_PASSWORD })
      .expect(200);

    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/reset successfully/i);

    // Confirm token is cleared in DB
    const [user] = await db
      .select({ reset_token: users.reset_token, reset_token_expires_at: users.reset_token_expires_at })
      .from(users)
      .where(eq(users.email, TEST_EMAIL.toLowerCase()))
      .limit(1);

    expect(user.reset_token).toBeNull();
    expect(user.reset_token_expires_at).toBeNull();

    // New password works
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: NEW_PASSWORD })
      .expect(200);

    expect(loginRes.body).toHaveProperty("token");
    expect(loginRes.body.email).toBe(TEST_EMAIL.toLowerCase());

    // Old password no longer works
    await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(401);
  });

  it("POST /reset-password rejects reuse of the same token", async () => {
    // Token was already consumed in the happy path above
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: "anotherpassword789" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/invalid|expired/i);
  });
});
