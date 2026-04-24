import "dotenv/config";
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { authMiddleware } from "../middleware/auth.js";
import { onboardingRouter } from "../routes/onboarding.js";
import billingRouter from "../routes/billing.js";

const MALFORMED_TOKEN = "Bearer this.is.not.a.valid.jwt.token";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", authMiddleware, onboardingRouter);
  app.use("/api/billing", authMiddleware, billingRouter);
  return app;
}

const app = buildApp();

describe("Protected route — no auth header", () => {
  it("GET /api/onboarding/state returns 401 without a token", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/onboarding/basics returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/onboarding/basics")
      .send({ full_name: "Test User", language: "en" })
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/billing/status returns 401 without a token", async () => {
    const res = await request(app)
      .get("/api/billing/status")
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/billing/create-checkout returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/billing/create-checkout")
      .send({})
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/billing/portal returns 401 without a token", async () => {
    const res = await request(app)
      .get("/api/billing/portal")
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });
});

describe("Protected route — malformed Bearer token", () => {
  it("GET /api/onboarding/state returns 401 with a malformed token", async () => {
    const res = await request(app)
      .get("/api/onboarding/state")
      .set("Authorization", MALFORMED_TOKEN)
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/onboarding/basics returns 401 with a malformed token", async () => {
    const res = await request(app)
      .post("/api/onboarding/basics")
      .set("Authorization", MALFORMED_TOKEN)
      .send({ full_name: "Test User", language: "en" })
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/billing/status returns 401 with a malformed token", async () => {
    const res = await request(app)
      .get("/api/billing/status")
      .set("Authorization", MALFORMED_TOKEN)
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/billing/create-checkout returns 401 with a malformed token", async () => {
    const res = await request(app)
      .post("/api/billing/create-checkout")
      .set("Authorization", MALFORMED_TOKEN)
      .send({})
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });

  it("GET /api/billing/portal returns 401 with a malformed token", async () => {
    const res = await request(app)
      .get("/api/billing/portal")
      .set("Authorization", MALFORMED_TOKEN)
      .expect(401);

    expect(res.body).toHaveProperty("error");
  });
});
