import "dotenv/config";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import gamesRouter, { buildBrainCoachProgress, calculateBrainCoachStreak, latestCaregiverNudge, pickScentMemoryPrompt } from "../routes/games.js";
import { authMiddleware, requireUser } from "../middleware/auth.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/games", authMiddleware, requireUser, gamesRouter);
  return app;
}

const app = buildApp();
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

describe("brain game API routes", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID;
    delete process.env.ELEVENLABS_MEDITATION_TTS_VOICE_ID;
    delete process.env.ELEVENLABS_BREATH_TTS_VOICE_ID;
    delete process.env.ELEVENLABS_VOICE_ID;
    dbMock.pool.query.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns JSON fallback scoring when OpenAI is not configured", async () => {
    const res = await request(app)
      .post("/api/games/score-retell")
      .set("x-user-id", "test-user")
      .send({
        retellText: "Ana bought bread.",
        keyFacts: ["Ana went out", "Ana bought bread", "Ana sat in the park"],
        language: "en",
      })
      .expect(200);

    expect(res.body).toMatchObject({
      covered: [],
      not_covered: [1, 2, 3],
      covered_count: 0,
      total_count: 3,
    });
    expect(res.body.error).toContain("OpenAI API key");
  });

  it("returns a clear TTS configuration error when ElevenLabs is not configured", async () => {
    const res = await request(app)
      .post("/api/games/tts")
      .set("x-user-id", "test-user")
      .send({ text: "Hello", language: "en" })
      .expect(503);

    expect(res.body.error).toBe("ElevenLabs TTS is not configured.");
  });

  it("returns audio from the TTS route when ElevenLabs responds successfully", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID = "voice-id";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Response);

    const res = await request(app)
      .post("/api/games/tts")
      .set("x-user-id", "test-user")
      .send({ text: "Hello", language: "en" })
      .expect(200);

    expect(res.headers["content-type"]).toContain("audio/mpeg");
    expect(Buffer.from(res.body)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("uses the breathing and meditation voice for guided breathing audio", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID = "brain-voice";
    process.env.ELEVENLABS_MEDITATION_TTS_VOICE_ID = "marco-voice";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
    } as Response);

    await request(app)
      .post("/api/games/tts")
      .set("x-user-id", "test-user")
      .send({ text: "Breathe in, gently.", language: "en", voiceProfile: "meditation" })
      .expect(200);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/text-to-speech/marco-voice"),
      expect.any(Object),
    );
  });

  it("selects an unused Scent Memory prompt today before falling back to least recently used", () => {
    const rows = [
      { id: "bread", category: "food" },
      { id: "cake", category: "food" },
      { id: "garden", category: "nature" },
    ];

    expect(pickScentMemoryPrompt(rows, [{ promptId: "bread" }], [], () => 0)?.id).toBe("garden");

    expect(pickScentMemoryPrompt(
      rows,
      [{ promptId: "bread" }, { promptId: "garden" }],
      [
        { promptId: "bread", playedAt: "2026-06-20T10:00:00.000Z" },
        { promptId: "garden", playedAt: "2026-06-19T10:00:00.000Z" },
      ],
      () => 0,
    )?.id).toBe("garden");

    expect(pickScentMemoryPrompt(rows, [], [], () => 0, "bread", "food")?.id).toBe("garden");
  });

  it("calculates real Brain Coach streaks from completed session dates", () => {
    const now = new Date("2026-05-31T12:00:00.000Z");

    expect(calculateBrainCoachStreak([
      {
        activityType: "memory_match",
        domain: "visual_memory",
        completed: true,
        playedAt: "2026-05-31T09:00:00.000Z",
      },
      {
        activityType: "number_trails",
        domain: "processing_speed",
        completed: true,
        playedAt: "2026-05-30T18:00:00.000Z",
      },
      {
        activityType: "category_sort",
        domain: "executive_function",
        completed: true,
        playedAt: "2026-05-28T18:00:00.000Z",
      },
    ], now)).toBe(2);

    expect(calculateBrainCoachStreak([
      {
        activityType: "memory_match",
        domain: "visual_memory",
        completed: true,
        playedAt: "2026-05-29T09:00:00.000Z",
      },
    ], now)).toBe(0);
  });

  it("builds unified progress and activity history across game families", () => {
    const progress = buildBrainCoachProgress([
      {
        activityType: "memory_match",
        domain: "visual_memory",
        difficulty: 2,
        completed: true,
        score: 840,
        durationSeconds: 92,
        playedAt: "2026-05-31T09:00:00.000Z",
      },
      {
        activityType: "number_trails",
        domain: "processing_speed",
        secondaryDomain: "executive_function",
        difficulty: 3,
        completed: true,
        score: 720,
        durationSeconds: 48,
        playedAt: "2026-05-30T17:00:00.000Z",
      },
      {
        activityType: "category_sort",
        domain: "executive_function",
        difficulty: 3,
        completed: false,
        abandoned: true,
        score: 0,
        durationSeconds: 15,
        playedAt: "2026-05-30T16:00:00.000Z",
      },
    ], new Date("2026-05-31T12:00:00.000Z"));

    expect(progress.summary).toMatchObject({
      totalSessions: 3,
      completedSessions: 2,
      streakDays: 2,
      totalDurationSeconds: 155,
    });
    expect(progress.today.activityTypes).toEqual(["memory_match"]);
    expect(progress.activities.map((activity) => activity.activityType)).toEqual([
      "memory_match",
      "number_trails",
      "category_sort",
    ]);
    expect(progress.history.map((session) => session.activityType)).toEqual([
      "memory_match",
      "number_trails",
      "category_sort",
    ]);
  });

  it("projects the latest caregiver Brain Coach nudge from plan events", () => {
    expect(latestCaregiverNudge([
      {
        id: "event-old",
        planId: "plan-1",
        eventType: "caregiver_nudge",
        metadata: {
          message_type: "gentle_restart",
          title: "Older nudge",
          body: "Older message",
          sent_by: "caregiver-1",
        },
        createdAt: "2026-06-01T08:00:00.000Z",
      },
      {
        id: "event-new",
        planId: "plan-1",
        eventType: "caregiver_nudge",
        metadata: {
          message_type: "today_plan",
          title: "Your Brain Coach plan is ready",
          body: "Your caregiver suggested one short recommended activity.",
          sent_by: "caregiver-1",
        },
        createdAt: "2026-06-01T10:00:00.000Z",
      },
    ], "plan-1")).toMatchObject({
      id: "event-new",
      planId: "plan-1",
      messageType: "today_plan",
      title: "Your Brain Coach plan is ready",
      body: "Your caregiver suggested one short recommended activity.",
      sentAt: "2026-06-01T10:00:00.000Z",
      sentBy: "caregiver-1",
      status: "unread",
      isUnread: true,
      readAt: null,
      dismissedAt: null,
    });
  });

  it("marks caregiver Brain Coach nudges read when a read event references the nudge", () => {
    expect(latestCaregiverNudge([
      {
        id: "event-new",
        planId: "plan-1",
        eventType: "caregiver_nudge",
        metadata: {
          message_type: "today_plan",
          title: "Your Brain Coach plan is ready",
          body: "Your caregiver suggested one short recommended activity.",
          sent_by: "caregiver-1",
        },
        createdAt: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "event-read",
        planId: "plan-1",
        eventType: "caregiver_nudge_read",
        metadata: {
          nudge_event_id: "event-new",
        },
        createdAt: "2026-06-01T10:05:00.000Z",
      },
    ], "plan-1")).toMatchObject({
      id: "event-new",
      status: "read",
      isUnread: false,
      readAt: "2026-06-01T10:05:00.000Z",
      dismissedAt: null,
    });
  });

  it("hides caregiver Brain Coach nudges when a dismiss event references the nudge", () => {
    expect(latestCaregiverNudge([
      {
        id: "event-new",
        planId: "plan-1",
        eventType: "caregiver_nudge",
        metadata: {
          message_type: "today_plan",
          title: "Your Brain Coach plan is ready",
          body: "Your caregiver suggested one short recommended activity.",
        },
        createdAt: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "event-read",
        planId: "plan-1",
        eventType: "caregiver_nudge_read",
        metadata: {
          nudge_event_id: "event-new",
        },
        createdAt: "2026-06-01T10:05:00.000Z",
      },
      {
        id: "event-dismissed",
        planId: "plan-1",
        eventType: "caregiver_nudge_dismissed",
        metadata: {
          nudge_event_id: "event-new",
        },
        createdAt: "2026-06-01T10:06:00.000Z",
      },
    ], "plan-1")).toMatchObject({
      id: "event-new",
      status: "dismissed",
      isUnread: false,
      readAt: "2026-06-01T10:05:00.000Z",
      dismissedAt: "2026-06-01T10:06:00.000Z",
    });
  });

  it("treats a newer caregiver Brain Coach nudge as unread after an older dismissal", () => {
    expect(latestCaregiverNudge([
      {
        id: "event-old",
        planId: "plan-1",
        eventType: "caregiver_nudge",
        metadata: {
          message_type: "gentle_restart",
          title: "Older nudge",
          body: "Older message",
        },
        createdAt: "2026-06-01T08:00:00.000Z",
      },
      {
        id: "event-dismissed",
        planId: "plan-1",
        eventType: "caregiver_nudge_dismissed",
        metadata: {
          nudge_event_id: "event-old",
        },
        createdAt: "2026-06-01T08:05:00.000Z",
      },
      {
        id: "event-new",
        planId: "plan-1",
        eventType: "caregiver_nudge",
        metadata: {
          message_type: "today_plan",
          title: "New nudge",
          body: "New message",
        },
        createdAt: "2026-06-01T10:00:00.000Z",
      },
    ], "plan-1")).toMatchObject({
      id: "event-new",
      title: "New nudge",
      status: "unread",
      isUnread: true,
    });
  });

  it("blocks backend adapter access to non-allowlisted tables", async () => {
    const res = await request(app)
      .post("/api/games/supabase/profiles")
      .set("x-user-id", "test-user")
      .send({ method: "GET", selectColumns: "*" })
      .expect(404);

    expect(res.body.error).toContain("not available");
    expect(dbMock.pool.query).not.toHaveBeenCalled();
  });

  it("blocks game data route access to non-allowlisted tables", async () => {
    const res = await request(app)
      .post("/api/games/data/profiles/query")
      .set("x-user-id", "test-user")
      .send({ selectColumns: "*" })
      .expect(404);

    expect(res.body.error).toContain("not available");
    expect(dbMock.pool.query).not.toHaveBeenCalled();
  });

  it("keeps content tables read-only through the backend adapter", async () => {
    const res = await request(app)
      .post("/api/games/supabase/category_sort_cards")
      .set("x-user-id", "test-user")
      .send({ method: "POST", body: { label: "Unsafe write" } })
      .expect(403);

    expect(res.body.error).toContain("read-only");
    expect(dbMock.pool.query).not.toHaveBeenCalled();
  });

  it("forces backend adapter reads for user-owned tables to the signed-in user", async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes("information_schema.columns")) {
        return {
          rows: ["id", "user_id", "score"].map((column_name) => ({ column_name })),
        };
      }
      return { rows: [{ id: "session-1", user_id: "test-user", score: 88 }] };
    });

    const res = await request(app)
      .post("/api/games/supabase/number_trails_sessions")
      .set("x-user-id", "test-user")
      .send({
        method: "GET",
        selectColumns: "id,user_id,score",
        filters: [{ column: "score", expression: "gte.50" }],
      })
      .expect(200);

    const selectQuery = queries.find((query) => query.sql.startsWith("SELECT"));
    expect(selectQuery?.sql).toContain('"score" >= $1');
    expect(selectQuery?.sql).toContain('"user_id" = $2');
    expect(selectQuery?.params).toEqual(["50", "test-user"]);
    expect(res.body.data).toEqual([{ id: "session-1", user_id: "test-user", score: 88 }]);
  });

  it("forces game data route reads for user-owned tables to the signed-in user", async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes("information_schema.columns")) {
        return {
          rows: ["id", "user_id", "score"].map((column_name) => ({ column_name })),
        };
      }
      return { rows: [{ id: "session-1", user_id: "test-user", score: 90 }] };
    });

    const res = await request(app)
      .post("/api/games/data/number_trails_sessions/query")
      .set("x-user-id", "test-user")
      .send({
        selectColumns: "id,user_id,score",
        filters: [{ column: "score", expression: "gte.50" }],
      })
      .expect(200);

    const selectQuery = queries.find((query) => query.sql.startsWith("SELECT"));
    expect(selectQuery?.sql).toContain('"user_id" = $2');
    expect(selectQuery?.params).toEqual(["50", "test-user"]);
    expect(res.body.data).toEqual([{ id: "session-1", user_id: "test-user", score: 90 }]);
  });

  it("overwrites spoofed user ids on backend adapter writes", async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes("information_schema.columns")) {
        return {
          rows: ["id", "user_id", "score"].map((column_name) => ({ column_name })),
        };
      }
      return { rows: [{ id: "session-1", user_id: "test-user", score: 77 }] };
    });

    await request(app)
      .post("/api/games/supabase/number_trails_sessions")
      .set("x-user-id", "test-user")
      .send({
        method: "POST",
        body: { user_id: "attacker", score: 77 },
      })
      .expect(200);

    const insertQuery = queries.find((query) => query.sql.includes("INSERT INTO"));
    expect(insertQuery?.params).toContain("test-user");
    expect(insertQuery?.params).not.toContain("attacker");
  });

  it("overwrites spoofed user ids on game data route writes", async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes("information_schema.columns")) {
        return {
          rows: ["id", "user_id", "score"].map((column_name) => ({ column_name })),
        };
      }
      return { rows: [{ id: "session-1", user_id: "test-user", score: 77 }] };
    });

    await request(app)
      .post("/api/games/data/number_trails_sessions")
      .set("x-user-id", "test-user")
      .send({
        body: { user_id: "attacker", score: 77 },
      })
      .expect(200);

    const insertQuery = queries.find((query) => query.sql.includes("INSERT INTO"));
    expect(insertQuery?.params).toContain("test-user");
    expect(insertQuery?.params).not.toContain("attacker");
  });

  it("blocks non-admin writes to admin content through the backend adapter", async () => {
    dbMock.pool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("information_schema.columns")) {
        return {
          rows: ["id", "is_active", "reviewed_at"].map((column_name) => ({ column_name })),
        };
      }
      if (sql.includes(" as ok")) return { rows: [{ ok: false }] };
      return { rows: [{ id: "hook-1" }] };
    });

    const res = await request(app)
      .post("/api/games/supabase/curious_minds_hooks")
      .set("x-user-id", "test-user")
      .send({
        method: "PATCH",
        filters: [{ column: "id", expression: "eq.hook-1" }],
        body: { is_active: true, reviewed_at: "2026-06-28T00:00:00.000Z" },
      })
      .expect(403);

    expect(res.body.error).toContain("Admin access required");
    expect(dbMock.pool.query).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE"), expect.anything());
  });
});
