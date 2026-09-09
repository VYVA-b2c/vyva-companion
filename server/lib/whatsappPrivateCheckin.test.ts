import { describe, expect, it } from "vitest";
import {
  createPrivateCheckinToken,
  decryptPrivateCheckinResponse,
  encryptPrivateCheckinResponse,
  hashPrivateCheckinToken,
  privateCheckinTemplateSid,
  privateCheckinUrl,
  safeSecretMatches,
  validatePrivateCheckinAnswers,
} from "./whatsappPrivateCheckin.js";

describe("WhatsApp private check-in security", () => {
  it("creates opaque tokens and stores only a deterministic hash", () => {
    const token = createPrivateCheckinToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hashPrivateCheckinToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPrivateCheckinToken(token)).not.toContain(token);
  });

  it("compares integration secrets without accepting absent or partial values", () => {
    expect(safeSecretMatches("correct", "correct")).toBe(true);
    expect(safeSecretMatches("correct", "wrong")).toBe(false);
    expect(safeSecretMatches(undefined, "correct")).toBe(false);
  });

  it("maps every platform language to its submitted template", () => {
    expect(privateCheckinTemplateSid("en")).toBe("HX04321e0de59f9be80a1e21e6d8628f3f");
    expect(privateCheckinTemplateSid("es")).toBe("HX5d27e70c62b15eadc84535dce4e7f452");
    expect(privateCheckinTemplateSid("de")).toBe("HX23ba2d57b32105827f6d083c4a95b453");
    expect(privateCheckinTemplateSid("fr")).toBe("HX1cf7c7cb986309fe348bc2755fd724b2");
  });

  it("puts only the opaque ticket in the secure URL", () => {
    const url = new URL(privateCheckinUrl("opaque-ticket"));
    expect(url.protocol).toBe("https:");
    expect(url.searchParams.get("ticket")).toBe("opaque-ticket");
  });

  it("encrypts health answers before database storage", () => {
    const previous = process.env.HEALTH_DATA_ENCRYPTION_KEY;
    process.env.HEALTH_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const source = { answers: { pain: 4, wound: "no" } };
      const encrypted = encryptPrivateCheckinResponse(source);
      expect(JSON.stringify(encrypted)).not.toContain("pain");
      expect(decryptPrivateCheckinResponse(encrypted)).toEqual(source);
    } finally {
      if (previous === undefined) delete process.env.HEALTH_DATA_ENCRYPTION_KEY;
      else process.env.HEALTH_DATA_ENCRYPTION_KEY = previous;
    }
  });
});

describe("validatePrivateCheckinAnswers", () => {
  const questions = [{
    id: "q1",
    type: "single_choice" as const,
    choices: ["yes", "no", "unsure", "skip"],
    required: true,
  }];

  it("accepts only the configured choice", () => {
    expect(validatePrivateCheckinAnswers(questions, { q1: "yes" })).toBe(true);
  });

  it("rejects missing, unknown, and unconfigured answers", () => {
    expect(validatePrivateCheckinAnswers(questions, {})).toBe(false);
    expect(validatePrivateCheckinAnswers(questions, { q1: "maybe" })).toBe(false);
    expect(validatePrivateCheckinAnswers(questions, { q1: "yes", q2: "no" })).toBe(false);
  });
});
