import { afterEach, describe, expect, it } from "vitest";
import {
  buildFallbackTriageReport,
  buildFallbackTriageReportWithTelemetry,
  evaluateTriage,
  resetTriageTelemetrySink,
  setTriageTelemetrySink,
  trackTriageEvent,
  type TriageTelemetryEvent,
} from "../index.js";

describe("triage telemetry", () => {
  afterEach(() => {
    resetTriageTelemetrySink();
  });

  it("emits telemetry through the configured sink", () => {
    const events: TriageTelemetryEvent[] = [];
    setTriageTelemetrySink((event) => {
      events.push(event);
    });

    trackTriageEvent("triage_started", {
      symptom_path: "breathing",
      triage_completion_status: "started",
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "triage_started",
      payload: {
        symptom_path: "breathing",
        triage_completion_status: "started",
      },
    });
    expect(new Date(events[0].timestamp).toString()).not.toBe("Invalid Date");
  });

  it("does not throw when telemetry storage fails", () => {
    setTriageTelemetrySink(() => {
      throw new Error("offline");
    });

    expect(() => trackTriageEvent("triage_completed", {
      symptom_path: "pain",
      urgency: "monitor",
      triage_completion_status: "completed",
    })).not.toThrow();
  });

  it("captures rule, profile, and vitals metadata without changing urgency", () => {
    const report = buildFallbackTriageReportWithTelemetry("en", {
      mode: "without_vitals",
      quickAnswers: [
        { id: "breathing", label: "Breathing", value: "I have a breathing concern.", kind: "symptom" },
        { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
        { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
      vitals: { oxygenSaturation: 92 },
    }, [{ role: "user", content: "Breathing feels off" }], {
      conditions: "COPD",
    });

    expect(report.summary).toMatchObject({
      urgency: "urgent",
      nextStepLevel: "doctor_today",
      nextStepLabel: "Talk to a doctor today",
    });
    expect(report.telemetry).toMatchObject({
      symptomPath: "breathing",
      urgency: "urgent",
      vitalsOverlaysApplied: ["spo2_le_92"],
      escalationSources: ["vitals"],
      caregiverEscalationTriggered: false,
    });
    expect(report.telemetry.ruleIdsFired).toContain("triage.vitals.spo2.le_92");
  });

  it("captures profile modifiers when profile risk raises the route outcome", () => {
    const report = buildFallbackTriageReportWithTelemetry("en", {
      mode: "without_vitals",
      quickAnswers: [
        { id: "urinary", label: "Urine problem", value: "I have a urine problem.", kind: "symptom" },
        { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
        { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
    }, [{ role: "user", content: "Urine problem" }], {
      conditions: "diabetes",
    });

    expect(report.summary).toMatchObject({
      urgency: "urgent",
      nextStepLevel: "doctor_today",
    });
    expect(report.telemetry.profileModifiersApplied).toContain("urinary_protocol_modifier_1");
    expect(report.telemetry.escalationSources).toContain("profile");
  });

  it("keeps the fallback summary shape explicit", () => {
    const report = buildFallbackTriageReport("en", {
      mode: "without_vitals",
      quickAnswers: [
        { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
        { id: "no_red_flag", label: "No, none of these", value: "None of these warning signs apply.", kind: "red_flag" },
        { id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "location" },
        { id: "severity_3", label: "3", value: "The symptom feels 3 out of 10.", kind: "severity" },
        { id: "better", label: "Mild, familiar, improving", value: "It is mild, familiar, and improving.", kind: "trend" },
      ],
    }, [{ role: "user", content: "Bad headache" }]);

    expect(Object.keys(report.summary).sort()).toEqual([
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
      "vitalsSnapshot",
      "watchSigns",
    ].sort());
    expect(report.summary).toMatchObject({
      urgency: "monitor",
      nextStepLevel: "monitor",
      nextStepLabel: "Monitor at home, with doctor access ready",
    });
  });

  it("exposes rule telemetry on direct engine evaluation without changing the decision", () => {
    const decision = evaluateTriage({
      locale: "en",
      symptomId: "stomach",
      answerIds: new Set(["diabetes_vomiting"]),
      risks: { diabetes: true },
      hasCriticalRedFlag: false,
      glucoseMgdl: 320,
    });

    expect(decision.level).toBe("emergency");
    expect(decision.urgency).toBe("urgent");
    expect(decision.telemetry.ruleIdsFired).toContain("triage.vitals.glucose.dka_hhs_pattern");
    expect(decision.telemetry.vitalsOverlaysApplied).toContain("glucose_dka_hhs_pattern");
  });
});
