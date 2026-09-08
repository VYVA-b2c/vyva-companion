import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware, requireUser } from "../middleware/auth.js";

const dbMock = vi.hoisted(() => ({
  db: {
    select: vi.fn(() => {
      throw new Error("advisor db unavailable");
    }),
    insert: vi.fn(() => {
      throw new Error("advisor db unavailable");
    }),
    update: vi.fn(() => {
      throw new Error("advisor db unavailable");
    }),
  },
}));

vi.mock("../db.js", () => dbMock);

import advisorsRouter from "../routes/advisors.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/advisors", authMiddleware, requireUser, advisorsRouter);
  return app;
}

describe("advisors API", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    dbMock.db.select.mockClear();
    dbMock.db.insert.mockClear();
    dbMock.db.update.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns eight enabled AI experts with localized copy", async () => {
    const res = await request(buildApp())
      .get("/api/advisors?lang=en")
      .set("x-user-id", "advisor-list-user")
      .expect(200);

    expect(res.body.advisors.map((advisor: { slug: string }) => advisor.slug)).toEqual([
      "amara",
      "nora",
      "tomas",
      "elena",
      "sabio",
      "marta",
      "ines",
      "diego",
    ]);
    expect(res.body.advisors[0]).toMatchObject({
      name: "Amara",
      role: "Coach",
      recencyLabel: "Never talked",
    });
    expect(res.body.ui.title).toBe("Choose an expert");
    expect(res.body.advisors[6]).toMatchObject({
      slug: "ines",
      name: "Inés",
      role: "Benefits",
      iconKey: "benefits",
      sortOrder: 55,
    });
  });

  it("starts a first expert session and updates recency state", async () => {
    const userId = "advisor-session-user";

    const started = await request(buildApp())
      .post("/api/advisors/nora/sessions?lang=en")
      .set("x-user-id", userId)
      .send({})
      .expect(201);

    expect(started.body.session).toMatchObject({ status: "active" });
    expect(started.body.advisor.sessionCount).toBe(1);

    const refreshed = await request(buildApp())
      .get("/api/advisors/nora/session?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(refreshed.body.introRequired).toBe(false);
    expect(refreshed.body.session.id).toBe(started.body.session.id);
  });

  it("persists typed messages in user scope and returns a safe fallback answer", async () => {
    const userId = "advisor-message-user";

    const res = await request(buildApp())
      .post("/api/advisors/diego/messages?lang=en")
      .set("x-user-id", userId)
      .send({ prompt: "My phone is stuck", source: "text" })
      .expect(200);

    expect(res.body.userMessage).toMatchObject({
      role: "user",
      text: "My phone is stuck",
    });
    expect(res.body.assistantMessage).toMatchObject({
      role: "assistant",
      source: "fallback",
    });
    expect(res.body.assistantMessage.text).toMatch(/device/i);

    const history = await request(buildApp())
      .get("/api/advisors/diego/session?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(history.body.messages.map((message: { role: string }) => message.role)).toEqual(["user", "assistant"]);
  });

  it("supports Amara movement coaching with safe backend fallback copy", async () => {
    const res = await request(buildApp())
      .post("/api/advisors/amara/messages?lang=en")
      .set("x-user-id", "advisor-amara-user")
      .send({ prompt: "I want something gentle after breakfast", source: "text" })
      .expect(200);

    expect(res.body.advisor).toMatchObject({
      slug: "amara",
      role: "Coach",
    });
    expect(res.body.assistantMessage).toMatchObject({
      role: "assistant",
      source: "fallback",
    });
    expect(res.body.assistantMessage.text).toMatch(/chair yoga|tai chi|sit-to-stand/i);
  });

  it("rejects invalid expert slugs safely", async () => {
    await request(buildApp())
      .get("/api/advisors/not-real/session?lang=en")
      .set("x-user-id", "advisor-invalid-user")
      .expect(404);
  });
});
