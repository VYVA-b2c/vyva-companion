import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { signVoiceTriageToolToken } from "../lib/jwt.js";
import {
  elevenLabsTriageStepToolHandler,
  latestChoices,
  isVitalsSkip,
  parseVoiceVitalsText,
  retainedMessagesForStatus,
  serializeVoiceTriageTurn,
  selectChoiceFromVoice,
  structuredConsultationEvidence,
  terminalVoiceTriageResponse,
  voiceQuestionFor,
  voiceReviewAnswers,
  voiceTriageSessionAnswerHandler,
  voiceTriageSessionEndHandler,
} from "../routes/voiceTriage.js";

function severityReplies() {
  return Array.from({ length: 11 }, (_, score) => ({
    id: `severity_${score}`,
    kind: "severity" as const,
    label: String(score),
    value: `The symptom feels ${score} out of 10.`,
  }));
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/api/elevenlabs/tools/triage-step", elevenLabsTriageStepToolHandler);
  app.post("/api/voice-triage/session/:conversation_id/answer", voiceTriageSessionAnswerHandler);
  app.post("/api/voice-triage/session/:conversation_id/end", voiceTriageSessionEndHandler);
  return app;
}

describe("ElevenLabs voice triage tool", () => {
  it("rejects missing triage tool tokens", async () => {
    const response = await request(buildApp())
      .post("/api/elevenlabs/tools/triage-step")
      .send({
        user_id: "user-1",
        conversation_id: "voice-session-1",
        locale: "en",
        utterance: "I feel dizzy",
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ ok: false, error: "Invalid or expired triage token" });
  });

  it("rejects tokens scoped to a different conversation", async () => {
    const token = await signVoiceTriageToolToken("user-1", "voice-session-1");
    const response = await request(buildApp())
      .post("/api/elevenlabs/tools/triage-step")
      .set("X-VYVA-Voice-Triage-Token", token)
      .send({
        user_id: "user-1",
        conversation_id: "voice-session-2",
        locale: "en",
        utterance: "I feel dizzy",
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ ok: false, error: "Triage token does not match this conversation" });
  });

  it("requires an authenticated user for touch answers", async () => {
    const response = await request(buildApp())
      .post("/api/voice-triage/session/voice-session-1/answer")
      .send({ choice_id: "no_red_flags", utterance: "No" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Not authenticated" });
  });

  it("requires an authenticated user to end a session", async () => {
    const response = await request(buildApp())
      .post("/api/voice-triage/session/voice-session-1/end");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Not authenticated" });
  });

  it("retains only the minimum rolling text while a session is active", () => {
    const messages = [{ role: "user" as const, content: "I feel dizzy" }];
    expect(retainedMessagesForStatus("active", messages)).toEqual(messages);
    expect(retainedMessagesForStatus("complete", messages)).toEqual([]);
    expect(retainedMessagesForStatus("emergency", messages)).toEqual([]);
    expect(retainedMessagesForStatus("failed", messages)).toEqual([]);
    expect(retainedMessagesForStatus("abandoned", messages)).toEqual([]);
  });

  it("parses camera-supported heart and breathing readings from a voice turn", () => {
    expect(parseVoiceVitalsText("My heart rate is 72 and breathing rate is 16")).toMatchObject({
      bpm: 72,
      respiratoryRate: 16,
    });
  });

  it("recognises an explicit or spoken vitals skip without consuming the medical question", () => {
    expect(isVitalsSkip("skip_vitals", "")).toBe(true);
    expect(isVitalsSkip(null, "No thanks, continue without it")).toBe(true);
    expect(isVitalsSkip(null, "My oxygen is 97")).toBe(false);
  });

  it("keeps completed consultation evidence structured but minimizes emergencies", () => {
    const wizard = {
      quickAnswers: [{ id: "severity_5", label: "5", value: "5 out of 10", kind: "severity" }],
      vitals: { bpm: 72 },
    };
    expect(structuredConsultationEvidence("complete", wizard)).toEqual({
      answers: wizard.quickAnswers,
      vitals: wizard.vitals,
    });
    expect(structuredConsultationEvidence("emergency", wizard)).toEqual({
      answers: [],
      vitals: {},
    });
  });

  it("keeps the complete zero-to-ten severity scale in the voice question", () => {
    const question = voiceQuestionFor({
      role: "assistant",
      content: "How strong is it from 0 to 10?",
      done: false,
      quickReplies: severityReplies(),
      wizardStage: "severity",
    });

    expect(question?.choices).toHaveLength(11);
    expect(question?.choices.map((choice) => choice.id)).toEqual([
      "severity_0",
      "severity_1",
      "severity_2",
      "severity_3",
      "severity_4",
      "severity_5",
      "severity_6",
      "severity_7",
      "severity_8",
      "severity_9",
      "severity_10",
    ]);
  });

  it("matches severity answers against the full quick-reply scale", () => {
    const replies = severityReplies();
    const latestResponse = {
      question: { choices: replies.slice(0, 3) },
      quickReplies: replies,
    };

    expect(latestChoices(latestResponse)).toHaveLength(11);
    expect(selectChoiceFromVoice({ utterance: "5", latestResponse })).toMatchObject({
      id: "severity_5",
      kind: "severity",
    });
  });

  it.each([
    ["five", "severity_5"],
    ["cinq", "severity_5"],
    ["je dirais huit sur dix", "severity_8"],
    ["diez", "severity_10"],
  ])("matches the spoken severity answer %s", (utterance, expectedId) => {
    expect(selectChoiceFromVoice({
      utterance,
      latestResponse: { question: { choices: severityReplies() } },
    })).toMatchObject({ id: expectedId, kind: "severity" });
  });

  it("still caps ordinary voice questions at three choices", () => {
    const question = voiceQuestionFor({
      role: "assistant",
      content: "Choose one",
      done: false,
      quickReplies: severityReplies().map((reply, index) => ({
        ...reply,
        id: `option_${index}`,
        kind: "trend" as const,
      })),
      wizardStage: "trend",
    });

    expect(question?.choices).toHaveLength(3);
  });

  it("serializes overlapping turns for the same conversation", async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = serializeVoiceTriageTurn("conversation-overlap", async () => {
      order.push("first-start");
      markFirstStarted();
      await firstCanFinish;
      order.push("first-end");
      return "first";
    });
    const secondTask = vi.fn(async () => {
      order.push("second-start");
      return "second";
    });
    const second = serializeVoiceTriageTurn("conversation-overlap", secondTask);

    await firstStarted;
    expect(order).toEqual(["first-start"]);
    expect(secondTask).not.toHaveBeenCalled();

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it.each(["complete", "emergency"])("replays the saved %s response instead of restarting", (status) => {
    const saved = { ok: true, status, spoken_text: "Saved terminal guidance" };
    expect(terminalVoiceTriageResponse({ status, latest_response_json: saved })).toEqual(saved);
  });

  it("does not treat an active session as terminal", () => {
    expect(terminalVoiceTriageResponse({
      status: "active",
      latest_response_json: { ok: true, status: "active" },
    })).toBeNull();
  });

  it("builds the canonical review summary from the latest answer of each kind", () => {
    expect(voiceReviewAnswers({
      mode: "without_vitals",
      quickAnswers: [
        { id: "breathing", label: "Breathing feels different", value: "Breathing feels different", kind: "symptom" },
        { id: "severity_3", label: "3", value: "3 out of 10", kind: "severity" },
        { id: "severity_5", label: "5", value: "5 out of 10", kind: "severity" },
        { id: "few_days", label: "Few days", value: "It started a few days ago", kind: "duration" },
        { id: "mild_improving", label: "Mild and improving", value: "It is mild and improving", kind: "trend" },
      ],
    })).toEqual([
      { id: "breathing", label: "Breathing feels different", value: "Breathing feels different", kind: "symptom" },
      { id: "severity_5", label: "5", value: "5 out of 10", kind: "severity" },
      { id: "few_days", label: "Few days", value: "It started a few days ago", kind: "duration" },
      { id: "mild_improving", label: "Mild and improving", value: "It is mild and improving", kind: "trend" },
    ]);
  });
});
