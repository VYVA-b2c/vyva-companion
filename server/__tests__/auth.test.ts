import "dotenv/config";
import { randomUUID } from "crypto";
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

const TEST_EMAIL = `test-auth-${randomUUID()}@example.com`;
const TEST_PASSWORD = "securepassword123";

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

describe("Auth endpoints", () => {
  beforeAll(async () => {
    await cleanupEmail(TEST_EMAIL);
  });

  afterAll(async () => {
    await cleanupEmail(TEST_EMAIL);
  });

  let registeredToken: string;

  it("POST /register creates a user and returns a valid JWT", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(201);

    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("userId");
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);

    registeredToken = res.body.token;
  });

  it("POST /register rejects duplicate emails with 409", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(409);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("POST /register rejects short passwords (< 8 chars) with 400", async () => {
    const uniqueEmail = `test-short-${randomUUID()}@example.com`;
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: uniqueEmail, password: "short" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/8 char/i);
  });

  it("POST /login returns a JWT for correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("userId");
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  it("POST /login returns 401 for wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "wrongpassword" })
      .expect(401);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatch(/incorrect/i);
  });

  it("GET /me returns user identity with a valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registeredToken}`)
      .expect(200);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("email");
    expect(res.body.email).toBe(TEST_EMAIL.toLowerCase());
  });

  it("GET /me returns 401 with an invalid/expired token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer this.is.not.a.valid.token")
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });
});
