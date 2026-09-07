import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { openAiCreateMock, openAiToFileMock, openAiTranscriptionCreateMock } = vi.hoisted(() => ({
  openAiCreateMock: vi.fn(),
  openAiToFileMock: vi.fn(),
  openAiTranscriptionCreateMock: vi.fn(),
}));

vi.mock("openai", () => {
  class MockOpenAI {
    static toFile = openAiToFileMock;

    chat = {
      completions: {
        create: openAiCreateMock,
      },
    };
    audio = {
      transcriptions: {
        create: openAiTranscriptionCreateMock,
      },
    };
  }

  return { default: MockOpenAI };
});

import triageRouter from "../routes/triage.js";
import {
  resetTriageTelemetrySink,
  setTriageTelemetrySink,
  type TriageTelemetryEvent,
} from "../../src/triage/index.js";

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/triage", triageRouter);
  return testApp;
}

type QuickAnswer = {
  id: string;
  label: string;
  value: string;
  kind: "symptom" | "location" | "red_flag" | "duration" | "severity" | "trend" | "support";
};

function completedAnswers(answers: QuickAnswer[]): QuickAnswer[] {
  return [
    ...answers,
    ...(answers.some((answer) => answer.kind === "severity")
      ? []
      : [{ id: "severity_3", label: "3", value: "The symptom feels 3 out of 10.", kind: "severity" as const }]),
    ...(answers.some((answer) => answer.kind === "duration")
      ? []
      : [{ id: "today", label: "Started today", value: "It started today.", kind: "duration" as const }]),
    ...(answers.some((answer) => answer.kind === "trend")
      ? []
      : [{ id: "same", label: "About the same", value: "It is about the same.", kind: "trend" as const }]),
    ...(answers.some((answer) => answer.kind === "support")
      ? []
      : [{
          id: "confirm_review",
          label: "Yes, show my guidance",
          value: "These answers are correct. Show my guidance.",
          kind: "support" as const,
        }]),
  ];
}

const summaryShapeKeys = [
  "changePlanTriggers",
  "chiefComplaint",
  "clinicalHandoff",
  "disclaimer",
  "interpretation",
  "nextStepLabel",
  "nextStepLevel",
  "possiblePatterns",
  "profileConsiderations",
  "reassessmentWindow",
  "recommendations",
  "scanNotes",
  "scanResults",
  "symptoms",
  "triageReasons",
  "uncertainty",
  "urgency",
  "vitalsNotes",
  "watchSigns",
].sort();

const routeResponseShapeKeys = [
  "content",
  "done",
  "evidenceSources",
  "guidancePlan",
  "medicalFollowups",
  "profileContextUsed",
  "questionReason",
  "quickReplies",
  "role",
  "summary",
  "vitalsPrompt",
  "wizardStage",
  "wizardStageLabel",
  "wizardSymptomId",
].sort();

const routeParityCases: Array<{
  name: string;
  message: string;
  quickAnswers: QuickAnswer[];
  expectedContent: string;
  expectedLevel: string;
  expectedLabel: string;
  expectedUrgency: string;
  expectedSymptomId: string;
}> = [
  {
    name: "chest discomfort",
    message: "Chest discomfort",
    quickAnswers: [
      { id: "chest", label: "Chest discomfort", value: "I have chest discomfort.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers show chest discomfort should be checked today.",
    expectedLevel: "doctor_today",
    expectedLabel: "Talk to a doctor today",
    expectedUrgency: "urgent",
    expectedSymptomId: "chest",
  },
  {
    name: "pain/headache",
    message: "Bad headache",
    quickAnswers: [
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
      { id: "no_red_flag", label: "No, none of these", value: "None of these warning signs apply.", kind: "red_flag" },
      { id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "location" },
      { id: "better", label: "Mild, familiar, improving", value: "It is mild, familiar, and improving.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk pain or headache pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "pain",
  },
  {
    name: "breathing",
    message: "Breathing feels off",
    quickAnswers: [
      { id: "breathing", label: "Breathing", value: "I have a breathing concern.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk breathing pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "breathing",
  },
  {
    name: "fever",
    message: "Fever",
    quickAnswers: [
      { id: "fever", label: "Fever", value: "I have a fever.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "one_two_days", label: "1-2 days", value: "It has been 1-2 days.", kind: "duration" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk fever pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "fever",
  },
  {
    name: "dizziness/faintness",
    message: "Dizzy",
    quickAnswers: [
      { id: "dizzy", label: "Dizziness", value: "I feel dizzy.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk dizziness pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "dizzy",
  },
  {
    name: "very tired/weak",
    message: "Very tired",
    quickAnswers: [
      { id: "tired", label: "Very tired or weak", value: "I feel very tired or weak.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "one_two_days", label: "1-2 days", value: "It has been 1-2 days.", kind: "duration" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk tiredness or weakness pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "tired",
  },
  {
    name: "stomach/bowel",
    message: "Stomach problem",
    quickAnswers: [
      { id: "stomach", label: "Stomach or bowel", value: "I have a stomach or bowel concern.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      { id: "one_two_days", label: "1-2 days", value: "It has been 1-2 days.", kind: "duration" },
    ],
    expectedContent: "Your answers fit a lower-risk stomach or bowel trouble pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "stomach",
  },
  {
    name: "urine problem",
    message: "Urine problem",
    quickAnswers: [
      { id: "urinary", label: "Urine problem", value: "I have a urine problem.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers show urine problem should be checked within 24-48 hours.",
    expectedLevel: "doctor_24_48",
    expectedLabel: "Talk to a doctor within 24-48 hours",
    expectedUrgency: "routine",
    expectedSymptomId: "urinary",
  },
  {
    name: "fall/injury",
    message: "I fell",
    quickAnswers: [
      { id: "fall", label: "Fall or injury", value: "I fell or got injured.", kind: "symptom" },
      { id: "no_red_flag", label: "No, only a small bruise or soreness", value: "Only a small bruise or soreness.", kind: "red_flag" },
      { id: "mild", label: "Yes, normal movement and mild soreness", value: "I can move normally with mild soreness.", kind: "severity" },
      { id: "better", label: "Improving", value: "It is improving.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk fall or injury pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "fall",
  },
  {
    name: "skin/wound/rash",
    message: "Skin problem",
    quickAnswers: [
      { id: "skin", label: "Skin or wound", value: "I have a skin or wound concern.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk skin or wound problem pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "skin",
  },
  {
    name: "confusion",
    message: "Confusion",
    quickAnswers: [
      { id: "confusion", label: "Confusion", value: "I feel confused.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
    ],
    expectedContent: "Your answers show confusion or memory change should be checked within 24-48 hours.",
    expectedLevel: "doctor_24_48",
    expectedLabel: "Talk to a doctor within 24-48 hours",
    expectedUrgency: "routine",
    expectedSymptomId: "confusion",
  },
  {
    name: "something else",
    message: "Something else",
    quickAnswers: [
      { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "other_not_sure", label: "Other or not sure", value: "It is something else or I am not sure.", kind: "severity" },
      { id: "better", label: "Mild, brief, and improving", value: "It is mild, brief, and improving.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk symptoms pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "other",
  },
];

describe("triage route wizard questions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetTriageTelemetrySink();
    openAiCreateMock.mockReset();
    openAiToFileMock.mockReset();
    openAiTranscriptionCreateMock.mockReset();
  });

  it("walks every canonical non-emergency stage before returning guidance", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const answers: QuickAnswer[] = [
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
    ];
    const submit = () => request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I have a headache" }],
        wizard: { mode: "without_vitals", quickAnswers: answers },
      })
      .expect(200);

    const location = await submit();
    expect(location.body).toMatchObject({ wizardStage: "location", content: "Where is the main pain?" });
    expect(location.body.quickReplies.map((reply: { label: string }) => reply.label)).toEqual([
      "Head or neck", "Back", "Belly or side", "Arm, leg, or joint", "Somewhere else",
    ]);
    answers.push({ id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "location" });
    const safety = await submit();
    expect(safety.body).toMatchObject({ wizardStage: "red_flag", content: "Does the head or neck pain include any warning signs?" });
    answers.push({ id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" });
    const severity = await submit();
    expect(severity.body).toMatchObject({ wizardStage: "severity", content: "How strong is it?" });
    expect(severity.body.quickReplies.map((reply: { label: string }) => reply.label)).toEqual([
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    ]);
    answers.push({ id: "severity_5", label: "5", value: "The symptom feels 5 out of 10.", kind: "severity" });
    expect((await submit()).body.wizardStage).toBe("duration");
    answers.push({ id: "today", label: "Started today", value: "It started today.", kind: "duration" });
    expect((await submit()).body.wizardStage).toBe("trend");
    answers.push({ id: "same", label: "Nothing clearly changed it", value: "Nothing clearly changed it.", kind: "trend" });

    const review = await submit();
    expect(review.body).toMatchObject({
      done: false,
      wizardStage: "support",
      wizardStageLabel: "Review answers",
      content: "Does this look right?",
    });
    expect(review.body.quickReplies).toEqual([
      expect.objectContaining({ id: "edit_answers", kind: "support", label: "Edit" }),
      expect.objectContaining({ id: "confirm_review", kind: "support", label: "Yes, show my guidance" }),
    ]);

    answers.push({
      id: "confirm_review",
      label: "Yes, show my guidance",
      value: "These answers are correct. Show my guidance.",
      kind: "support",
    });
    const complete = await submit();
    expect(complete.body).toMatchObject({ done: true, wizardStage: "complete" });
    expect(complete.body.summary).toBeDefined();
  });

  it("transcribes raw symptom audio into a short clue", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    openAiToFileMock.mockResolvedValue("audio-file");
    openAiTranscriptionCreateMock.mockResolvedValue({ text: "bad headache" });

    const res = await request(app())
      .post("/api/triage/transcribe?language=en")
      .set("Content-Type", "audio/webm")
      .send(Buffer.alloc(64, 1))
      .expect(200);

    expect(res.body).toEqual({ transcript: "bad headache" });
    expect(openAiToFileMock).toHaveBeenCalledWith(expect.any(Buffer), "symptom-voice.webm", { type: "audio/webm" });
    expect(openAiTranscriptionCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      file: "audio-file",
      language: "en",
      model: "gpt-4o-mini-transcribe",
    }));
  });

  it("returns a clear voice setup error when transcription is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/triage/transcribe")
      .set("Content-Type", "audio/webm")
      .send(Buffer.alloc(64, 1))
      .expect(503);

    expect(res.body).toEqual({ error: "Voice transcription is not configured." });
    expect(openAiTranscriptionCreateMock).not.toHaveBeenCalled();
  });

  it("returns anxiety-specific deterministic wording for the anxiety quick clue", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Feeling anxious" }],
        wizard: { mode: "without_vitals", quickAnswers: [] },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.wizardStage).toBe("red_flag");
    expect(res.body.content).toBe("Does the anxiety feeling include any urgent warning signs?");
    expect(res.body.quickReplies.map((reply: { label: string }) => reply.label)).toEqual([
      "Chest pain, hard breathing, or blue/grey/pale skin",
      "Weakness, speech or vision trouble, seizure, or fainted",
      "Very confused, hard to wake, severe pain, bleeding, or allergy swelling",
      "No, anxiety feeling without those warning signs",
    ]);
  });

  it("returns French protocol questions and labels while keeping stable answer values", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "fr",
        messages: [{ role: "user", content: "Je suis essoufflé" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "breathing", label: "Respiration", value: "I feel short of breath.", kind: "symptom" },
          ],
        },
      })
      .expect(200);

    expect(res.body.content).toBe("Comment respirez-vous en ce moment ?");
    expect(res.body.wizardStageLabel).toBe("Vérification de sécurité");
    expect(res.body.quickReplies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "worse_but_speaking",
        label: "Pire que d’habitude, mais je peux parler",
        value: "Breathing is worse than usual, but I can speak.",
      }),
    ]));
  });

  it("keeps generic other trend wording coherent when there is no anxiety context", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Something else" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
            { id: "no_red_flag", label: "No, none of these", value: "None of these apply.", kind: "red_flag" },
            { id: "other_not_sure", label: "Other or not sure", value: "It is something else or I am not sure.", kind: "severity" },
          ],
        },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.wizardStage).toBe("duration");
    expect(res.body.content).toBe("When did this start?");
    expect(res.body.quickReplies.map((reply: { label: string }) => reply.label)).toEqual([
      "Started today",
      "Few days",
      "Longer than a few days",
      "I am not sure",
    ]);
  });

  it("does not repeat the fall safety question after a minor fall answer", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I fell" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "fall", label: "Fall or injury", value: "I fell or got injured.", kind: "symptom" },
            { id: "no_red_flag", label: "No, only a small bruise or soreness", value: "Only a small bruise or soreness.", kind: "red_flag" },
            { id: "mild", label: "Yes, normal movement and mild soreness", value: "I can move normally with mild soreness.", kind: "severity" },
          ],
        },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.wizardStage).toBe("duration");
    expect(res.body.content).toBe("When did the fall or injury happen?");
    expect(res.body.quickReplies.map((reply: { label: string }) => reply.label).join(" ")).not.toContain("Knocked out");
  });

  it("delivers a deterministic report when the final stage cannot use AI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Bad headache" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: completedAnswers([
            { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
            { id: "no_red_flag", label: "No, none of these", value: "None of these warning signs apply.", kind: "red_flag" },
            { id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "location" },
            { id: "better", label: "Mild, familiar, improving", value: "It is mild, familiar, and improving.", kind: "trend" },
          ]),
        },
      })
      .expect(200);

    expect(res.body.done).toBe(true);
    expect(res.body.wizardStage).toBe("complete");
    expect(res.body.content).toBe("Your answers fit a lower-risk pain or headache pattern right now.");
    expect(res.body.quickReplies).toEqual([]);
    expect(Object.keys(res.body).sort()).toEqual(routeResponseShapeKeys);
    expect(Object.keys(res.body.summary).sort()).toEqual(summaryShapeKeys);
    expect(res.body.summary).toMatchObject({
      chiefComplaint: "Bad headache",
      urgency: "monitor",
      nextStepLevel: "monitor",
      nextStepLabel: "Monitor at home, with doctor access ready",
    });
    expect(res.body.summary.interpretation).toContain("not a diagnosis");
    expect(res.body.summary.reassessmentWindow).toContain("24 hours");
    expect(res.body.summary.changePlanTriggers.length).toBeGreaterThan(0);
    expect(res.body.summary.clinicalHandoff.keyPoints).toContain("Head or neck");
  });

  it("emits non-blocking telemetry without changing the route response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const events: TriageTelemetryEvent[] = [];
    setTriageTelemetrySink((event) => {
      events.push(event);
    });

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Breathing feels off" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: completedAnswers([
            { id: "breathing", label: "Breathing", value: "I have a breathing concern.", kind: "symptom" },
            { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
            { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
            { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
          ]),
          vitals: { oxygenSaturation: 92 },
        },
      })
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(routeResponseShapeKeys);
    expect(Object.keys(res.body.summary).sort()).toEqual(summaryShapeKeys);
    expect(res.body.summary).toMatchObject({
      urgency: "urgent",
      nextStepLevel: "doctor_today",
      nextStepLabel: "Talk to a doctor today",
    });
    expect(events.map((event) => event.name)).toEqual([
      "triage_started",
      "triage_completed",
      "triage_escalated",
    ]);
    expect(events[1].payload).toMatchObject({
      symptom_path: "breathing",
      urgency: "urgent",
      triage_completion_status: "completed",
      vitals_overlays_applied: ["spo2_le_92"],
    });
    expect(events[2].payload.escalation_source).toBe("vitals");
  });

  it("continues triage when telemetry emission fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    setTriageTelemetrySink(() => {
      throw new Error("telemetry unavailable");
    });

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Bad headache" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: completedAnswers([
            { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
            { id: "no_red_flag", label: "No, none of these", value: "None of these warning signs apply.", kind: "red_flag" },
            { id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "location" },
            { id: "better", label: "Mild, familiar, improving", value: "It is mild, familiar, and improving.", kind: "trend" },
          ]),
        },
      })
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(routeResponseShapeKeys);
    expect(res.body.summary).toMatchObject({
      urgency: "monitor",
      nextStepLevel: "monitor",
      nextStepLabel: "Monitor at home, with doctor access ready",
    });
  });

  it.each(routeParityCases)("keeps final route parity for $name", async ({
    message,
    quickAnswers,
    expectedContent,
    expectedLevel,
    expectedLabel,
    expectedUrgency,
    expectedSymptomId,
  }) => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: message }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: completedAnswers(quickAnswers),
        },
      })
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(routeResponseShapeKeys);
    expect(Object.keys(res.body.summary).sort()).toEqual(summaryShapeKeys);
    expect(res.body).toMatchObject({
      role: "assistant",
      content: expectedContent,
      done: true,
      quickReplies: [],
      wizardStage: "complete",
      wizardStageLabel: "Summary",
      wizardSymptomId: expectedSymptomId,
      evidenceSources: [],
      medicalFollowups: [],
    });
    expect(res.body.summary).toMatchObject({
      urgency: expectedUrgency,
      nextStepLevel: expectedLevel,
      nextStepLabel: expectedLabel,
    });
  });

  it("includes optional scan notes and can escalate without downgrading red flags", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "My urine looks red" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: completedAnswers([
            { id: "urinary", label: "Urine problem", value: "I have a urine problem.", kind: "symptom" },
            { id: "blood_in_urine", label: "Blood in urine or clots", value: "There is blood or clots in my urine.", kind: "red_flag" },
            { id: "moderate", label: "Moderate", value: "It feels moderate.", kind: "severity" },
            { id: "worse", label: "Worse", value: "It is getting worse.", kind: "trend" },
          ]),
          scanResults: [{
            id: "scan-urine-1",
            type: "urine_photo",
            label: "Urine appearance photo",
            concernLevel: "urgent",
            summary: "The urine appears red.",
            findings: ["Red urine appearance"],
            capturedAt: new Date().toISOString(),
          }],
        },
      })
      .expect(200);

    expect(res.body.done).toBe(true);
    expect(res.body.summary.nextStepLevel).toBe("doctor_today");
    expect(res.body.summary.scanResults).toHaveLength(1);
    expect(res.body.summary.scanNotes.join(" ")).toContain("A photo cannot diagnose a urine infection.");
    expect(res.body.summary.triageReasons.join(" ")).toContain("optional scan");
  });

  it("returns MediSearch follow-up chips with deterministic wizard questions", async () => {
    vi.stubEnv("MEDISEARCH_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response([
      'data: {"event":"followups","data":["Could caffeine make anxiety worse?","When is anxiety urgent?"]}',
      "",
    ].join("\n"))));

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Feeling anxious" }],
        wizard: { mode: "without_vitals", quickAnswers: [] },
        medisearchConversationId: "triage-followups",
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.content).toBe("Does the anxiety feeling include any urgent warning signs?");
    expect(res.body.medisearchConversationId).toBe("triage-followups");
    expect(res.body.medicalFollowups).toEqual([
      "Could caffeine make anxiety worse?",
      "When is anxiety urgent?",
    ]);
  });

  it("does not let MediSearch failures block deterministic wizard questions", async () => {
    vi.stubEnv("MEDISEARCH_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Feeling anxious" }],
        wizard: { mode: "without_vitals", quickAnswers: [] },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.content).toBe("Does the anxiety feeling include any urgent warning signs?");
    expect(res.body.medicalFollowups).toEqual([]);
  });

  it("does not return MediSearch follow-ups during safety alerts", async () => {
    vi.stubEnv("MEDISEARCH_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I have chest pain" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
            { id: "chest_pain", label: "Chest pain", value: "I have chest pain.", kind: "red_flag" },
          ],
        },
      })
      .expect(200);

    expect(res.body.urgent).toBe(true);
    expect(res.body.medicalFollowups).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides follow-up chips once the final summary is ready", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("MEDISEARCH_API_KEY", "test-medisearch-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response([
      'data: {"event":"followups","data":["Should not show?"]}',
      "",
    ].join("\n"))));
    openAiCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              "Here is a clear summary.",
              "TRIAGE_JSON_START",
              JSON.stringify({
                done: true,
                summary: {
                  chiefComplaint: "Mild limb pain",
                  symptoms: ["Pain"],
                  urgency: "monitor",
                  nextStepLabel: "Monitor at home",
                  nextStepLevel: "monitor",
                  triageReasons: ["Pain is improving."],
                  recommendations: ["Rest and monitor."],
                  watchSigns: ["Pain gets worse."],
                  profileConsiderations: [],
                  vitalsNotes: [],
                  disclaimer: "This assessment is for information only and is not medical advice.",
                },
              }),
              "TRIAGE_JSON_END",
            ].join("\n"),
          },
        },
      ],
    });

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [
          { role: "user", content: "I have arm pain" },
          { role: "assistant", content: "Which best describes the pain now?" },
          { role: "user", content: "Pain is easing" },
        ],
        wizard: {
          mode: "without_vitals",
          quickAnswers: completedAnswers([
            { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
            { id: "no_red_flag", label: "No, none of these", value: "None of these apply.", kind: "red_flag" },
            { id: "limb_joint_pain", label: "Arm, leg, or joint", value: "The pain is in an arm, leg, or joint.", kind: "location" },
            { id: "better", label: "Pain is easing", value: "The pain is easing.", kind: "trend" },
          ]),
        },
      })
      .expect(200);

    expect(res.body.done).toBe(true);
    expect(res.body.medicalFollowups).toEqual([]);
    expect(openAiCreateMock).toHaveBeenCalledWith(
      expect.any(Object),
      { timeout: 7_000 },
    );
  });

  it("returns the deterministic safety summary when the AI provider fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("MEDISEARCH_API_KEY", "");
    openAiCreateMock.mockRejectedValueOnce(new Error("provider unavailable"));

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "fr",
        messages: [{ role: "user", content: "Je me sens étourdi" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: completedAnswers([
            { id: "dizzy", label: "Vertiges ou malaise", value: "I feel dizzy or close to fainting.", kind: "symptom" },
            { id: "no_red_flag", label: "Non, aucun signe d’alerte", value: "No warning signs.", kind: "red_flag" },
            { id: "severity_5", label: "5", value: "The symptom feels 5 out of 10.", kind: "severity" },
            { id: "few_days", label: "Quelques jours", value: "It has been going on for a few days.", kind: "duration" },
            { id: "after_medicine_surgery_fall", label: "Après un médicament ou des soins", value: "It started after medicine, surgery, a hospital stay, or a fall.", kind: "trend" },
          ]),
        },
      })
      .expect(200);

    expect(res.body).toMatchObject({ done: true, wizardStage: "complete" });
    expect(res.body.summary).toBeDefined();
    expect(res.body.quickReplies).toEqual([]);
    expect(res.body.content).toMatch(/^Vos réponses/);
    expect(res.body.summary.nextStepLabel).toMatch(/médecin|urgence|Surveillez/);
    expect(res.body.summary.watchSigns).toEqual(expect.arrayContaining([
      expect.stringMatching(/Vous|vertiges|faiblesse/i),
    ]));
    expect(JSON.stringify(res.body.summary)).not.toMatch(/Talk to a doctor|Monitor at home|Dizziness gets worse/);
  });

  it("returns a refined report instead of a safety prompt when a post-report vital is added", async () => {
    const previousApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const res = await request(app())
        .post("/api/triage/message")
        .send({
          locale: "en",
          messages: [
            { role: "user", content: "Fever and chills" },
            {
              role: "user",
              content:
                "New vital added after the first report: Check temperature now: 38.5 C. Refine the triage result with this new reading.",
            },
          ],
          wizard: {
            mode: "without_vitals",
            refineRequested: true,
            vitals: { temperatureC: 38.5 },
            quickAnswers: [
              { id: "fever", label: "Fever", value: "I have a fever.", kind: "symptom" },
              {
                id: "immuno_fever",
                label: "Fever with low immunity",
                value: "I have fever and low immunity or cancer treatment.",
                kind: "red_flag",
              },
            ],
            previousSummary: {
              chiefComplaint: "Fever and chills",
              symptoms: ["Fever"],
              urgency: "routine",
              recommendations: ["Check temperature."],
              disclaimer: "Information only.",
              nextStepLabel: "Talk to a doctor within 24-48 hours",
              nextStepLevel: "doctor_24_48",
            },
          },
        })
        .expect(200);

      expect(res.body.done).toBe(true);
      expect(res.body.wizardStage).toBe("complete");
      expect(res.body.quickReplies).toEqual([]);
      expect(res.body.summary.nextStepLabel).toBe("Call emergency services now");
      expect(res.body.summary.vitalsNotes).toContain("Temperature was 38.5 C.");
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousApiKey;
      }
    }
  });

  it("asks the dizziness safety question first and keeps signal metadata quiet", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I feel dizzy" }],
        wizard: { mode: "without_vitals", quickAnswers: [] },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.wizardStage).toBe("red_flag");
    expect(res.body.content).toBe("Did you faint, nearly faint, or feel unsafe walking?");
    expect(res.body.questionReason).toBe("I am checking urgent warning signs first, before asking about smaller details.");
    expect(res.body.profileContextUsed).toBe(false);
    expect(res.body.vitalsPrompt).toBeNull();
    expect(res.body.guidancePlan).toMatchObject({
      protocolId: "dizziness",
      protocolLabel: "Dizziness and faintness",
      priorityLabel: "Safety first",
      confidence: { score: 2, label: "Early confidence" },
    });
  });

  it("marks profile-aware red-flag questions and adds contextual vitals only after safety", async () => {
    const profileAware = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I feel dizzy" }],
        healthMemory: { conditions: "Hypertension and high blood pressure." },
        wizard: { mode: "without_vitals", quickAnswers: [] },
      })
      .expect(200);

    expect(profileAware.body.wizardStage).toBe("red_flag");
    expect(profileAware.body.profileContextUsed).toBe(true);
    expect(profileAware.body.questionReason).toContain("health profile");
    expect(profileAware.body.quickReplies.map((reply: { label: string }) => reply.label)).toContain("Very high blood pressure");
    expect(profileAware.body.vitalsPrompt).toBeNull();
    expect(profileAware.body.guidancePlan.profileContextUsed).toBe(true);
    expect(profileAware.body.guidancePlan.confidence.label).toBe("Building confidence");

    const afterSafety = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I feel dizzy" }],
        healthMemory: { conditions: "Hypertension and high blood pressure." },
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "dizzy", label: "Dizzy", value: "I feel dizzy.", kind: "symptom" },
            { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" },
          ],
        },
      })
      .expect(200);

    expect(afterSafety.body.wizardStage).toBe("severity");
    expect(afterSafety.body.guidancePlan).toMatchObject({
      protocolId: "dizziness",
      priorityLabel: "Profile-aware",
      confidence: { score: 4, label: "Strong confidence" },
    });
    expect(afterSafety.body.vitalsPrompt).toMatchObject({
      title: "A quick vital-sign check could help",
      actions: [expect.objectContaining({ id: "blood_pressure", label: "Blood pressure" })],
    });

    const afterSkip = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I feel dizzy" }],
        healthMemory: { conditions: "Hypertension and high blood pressure." },
        wizard: {
          mode: "without_vitals",
          declinedScanTypes: ["vitals"],
          quickAnswers: [
            { id: "dizzy", label: "Dizzy", value: "I feel dizzy.", kind: "symptom" },
            { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" },
          ],
        },
      })
      .expect(200);
    expect(afterSkip.body.vitalsPrompt).toBeNull();
  });

  it("ranks optional readings from the symptom, location, answers, and profile", async () => {
    const requestFor = (quickAnswers: Array<{ id: string; label: string; value: string; kind: string }>, healthMemory?: { conditions?: string }) => request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: quickAnswers[0]?.value ?? "I feel unwell." }],
        healthMemory,
        wizard: { mode: "without_vitals", quickAnswers },
      });

    const breathing = await requestFor([
      { id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" },
      { id: "walking_only", label: "Mild", value: "It is mild or only with activity.", kind: "red_flag" },
    ]).expect(200);
    expect(breathing.body.vitalsPrompt.actions.map((action: { id: string }) => action.id)).toEqual(["oxygen"]);

    const cardiacBreathing = await requestFor([
      { id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" },
      { id: "walking_only", label: "Mild", value: "It is mild or only with activity.", kind: "red_flag" },
    ], { conditions: "Atrial fibrillation and heart disease." }).expect(200);
    expect(cardiacBreathing.body.vitalsPrompt.actions.map((action: { id: string }) => action.id)).toEqual(["oxygen", "pulse"]);

    const ordinaryHeadPain = await requestFor([
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
      { id: "head_neck_pain", label: "Head or neck", value: "The pain is in my head.", kind: "location" },
      { id: "no_red_flag", label: "None", value: "No warning signs.", kind: "red_flag" },
    ]).expect(200);
    expect(ordinaryHeadPain.body.vitalsPrompt).toBeNull();

    const hypertensiveHeadPain = await requestFor([
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
      { id: "head_neck_pain", label: "Head or neck", value: "The pain is in my head.", kind: "location" },
      { id: "no_red_flag", label: "None", value: "No warning signs.", kind: "red_flag" },
    ], { conditions: "Hypertension treated with amlodipine." }).expect(200);
    expect(hypertensiveHeadPain.body.vitalsPrompt.actions.map((action: { id: string }) => action.id)).toEqual(["blood_pressure"]);

    const simpleFall = await requestFor([
      { id: "fall", label: "Fall", value: "I had a small fall.", kind: "symptom" },
      { id: "no_red_flag", label: "None", value: "Only a small bruise.", kind: "red_flag" },
    ]).expect(200);
    expect(simpleFall.body.vitalsPrompt).toBeNull();
  });

  it("uses the medication guidance protocol when the first clue points to a medicine change", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I feel strange after a new medication." }],
        wizard: { mode: "without_vitals", quickAnswers: [] },
      })
      .expect(200);

    expect(res.body.wizardStage).toBe("red_flag");
    expect(res.body.content).toBe("Could this medicine change be causing any urgent warning signs?");
    expect(res.body.guidancePlan).toMatchObject({
      protocolId: "medication",
      protocolLabel: "Medication-related change",
      priorityLabel: "Safety first",
    });
    expect(res.body.guidancePlan.nextQuestionFocus).toContain("medicine changes");
  });

  it("refines a report even when the original wizard context has no structured safety answer", async () => {
    const previousApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const res = await request(app())
        .post("/api/triage/message")
        .send({
          locale: "en",
          messages: [
            { role: "user", content: "Headache and pain" },
            {
              role: "user",
              content:
                "New vital added after the first report: Rate pain now: 6/10. Refine the triage result with this new reading.",
            },
          ],
          vitals: { painScore: 6 },
          wizard: {
            mode: "without_vitals",
            refineRequested: true,
            vitals: { painScore: 6 },
            quickAnswers: [
              { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
            ],
            previousSummary: {
              chiefComplaint: "Headache and pain",
              symptoms: ["Headache"],
              urgency: "routine",
              recommendations: ["Rest and monitor symptoms."],
              disclaimer: "Information only.",
              nextStepLabel: "Monitor at home",
              nextStepLevel: "monitor",
            },
          },
        })
        .expect(200);

      expect(res.body.done).toBe(true);
      expect(res.body.wizardStage).toBe("complete");
      expect(res.body.quickReplies).toEqual([]);
      expect(res.body.summary.vitalsNotes).toContain("Pain score was 6/10.");
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousApiKey;
      }
    }
  });
});
