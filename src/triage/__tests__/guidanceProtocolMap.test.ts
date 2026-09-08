import { describe, expect, it } from "vitest";
import { buildGuidancePlan } from "../index.js";
import type { TriageWizardContext } from "../index.js";

describe("guidance protocol map", () => {
  it("uses profile and useful vitals to raise confidence for dizziness", () => {
    const wizard: TriageWizardContext = {
      quickAnswers: [
        { id: "dizzy", label: "Dizzy", value: "I feel dizzy.", kind: "symptom" },
        { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" },
      ],
      vitals: { systolicBp: 126, diastolicBp: 78 },
    };

    const plan = buildGuidancePlan({
      locale: "en",
      stage: "severity",
      wizard,
      healthMemory: { conditions: "Hypertension and high blood pressure." },
    });

    expect(plan.protocolId).toBe("dizziness");
    expect(plan.profileContextUsed).toBe(true);
    expect(plan.priorityLabel).toBe("Profile-aware");
    expect(plan.confidence.score).toBe(5);
    expect(plan.usefulSignals).toContainEqual(expect.objectContaining({ id: "blood_pressure", status: "available" }));
  });

  it("classifies medicine-related concerns even when the symptom path is general", () => {
    const wizard: TriageWizardContext = {
      quickAnswers: [
        { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
        { id: "medication_context", label: "Medicine change", value: "This may be related to a medicine.", kind: "free_text" },
      ],
    };

    const plan = buildGuidancePlan({
      locale: "en",
      stage: "red_flag",
      wizard,
      messages: [{ role: "user", content: "I feel strange after a new pill." }],
      healthMemory: { medications: "Aspirin, sleeping pill as needed." },
    });

    expect(plan.protocolId).toBe("medication");
    expect(plan.protocolLabel).toBe("Medication-related change");
    expect(plan.nextQuestionFocus).toContain("medicine changes");
    expect(plan.confidence.missing).toContain("safety warning signs");
  });

  it("keeps early confidence honest when useful signals are missing", () => {
    const wizard: TriageWizardContext = {
      quickAnswers: [
        { id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" },
      ],
    };

    const plan = buildGuidancePlan({
      locale: "en",
      stage: "red_flag",
      wizard,
    });

    expect(plan.protocolId).toBe("chest_breathing");
    expect(plan.confidence.score).toBe(2);
    expect(plan.confidence.label).toBe("Early confidence");
    expect(plan.usefulSignals).toContainEqual(expect.objectContaining({ id: "oxygen", status: "missing" }));
  });

  it("counts care coverage and check-in memory as health context", () => {
    const wizard: TriageWizardContext = {
      quickAnswers: [
        { id: "fall", label: "Fall or injury", value: "I fell.", kind: "symptom" },
        { id: "no_red_flag", label: "No major warning signs", value: "No major warning signs.", kind: "red_flag" },
      ],
    };

    const plan = buildGuidancePlan({
      locale: "en",
      stage: "severity",
      wizard,
      healthMemory: {
        careContext: "Lives alone and has caregiver coverage on weekdays.",
        checkinContext: "Latest check-in was yesterday; today's check-in may be overdue.",
      },
    });

    expect(plan.protocolId).toBe("falls");
    expect(plan.confidence.reasons).toContain("health profile considered");
    expect(plan.confidence.score).toBeGreaterThanOrEqual(4);
  });

  it("localizes dynamic guidance and confidence details in French", () => {
    const wizard: TriageWizardContext = {
      quickAnswers: [
        { id: "breathing", label: "Respiration", value: "Ma respiration est différente.", kind: "symptom" },
        { id: "no_red_flag", label: "Aucun signe d’alerte", value: "Aucun signe d’alerte.", kind: "red_flag" },
      ],
    };

    const plan = buildGuidancePlan({
      locale: "fr-FR",
      stage: "complete",
      wizard,
    });

    expect(plan.protocolLabel).toBe("Sécurité respiratoire et thoracique");
    expect(plan.priorityLabel).toBe("Prêt pour la prochaine étape");
    expect(plan.nextQuestionFocus).toContain("signes d’alerte");
    expect(plan.confidence.label).toBe("Confiance solide");
    expect(plan.confidence.reasons).toEqual([
      "symptôme décrit",
      "question de sécurité renseignée",
      "détails du symptôme ajoutés",
    ]);
    expect(plan.usefulSignals).toContainEqual(expect.objectContaining({ label: "Oxygène", status: "missing" }));
  });
});
