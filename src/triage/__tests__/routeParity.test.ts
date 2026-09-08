import { describe, expect, it } from "vitest";
import {
  applyTriageSafetyFloor,
  buildFallbackTriageReport,
  nextAdaptiveStage,
  profileRiskFlags,
  type TriageHealthMemory,
  type TriageSummary,
  type TriageWizardAnswer,
  type TriageWizardContext,
} from "../index.js";

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
  "vitalsSnapshot",
  "watchSigns",
].sort();

function wizard(quickAnswers: TriageWizardAnswer[], extra: Partial<TriageWizardContext> = {}): TriageWizardContext {
  return {
    mode: "without_vitals",
    quickAnswers,
    ...extra,
  };
}

function fallback(quickAnswers: TriageWizardAnswer[], extra: Partial<TriageWizardContext> = {}, message = "Symptoms") {
  return buildFallbackTriageReport("en", wizard(quickAnswers, extra), [{ role: "user", content: message }]);
}

function baseSummary(): TriageSummary {
  return {
    chiefComplaint: "Symptoms",
    symptoms: [],
    urgency: "monitor",
    recommendations: [],
    disclaimer: "Information only.",
    triageReasons: [],
    watchSigns: [],
    profileConsiderations: [],
    vitalsNotes: [],
  };
}

const pathCases: Array<{
  name: string;
  message: string;
  quickAnswers: TriageWizardAnswer[];
  expectedContent: string;
  expectedLevel: TriageSummary["nextStepLevel"];
  expectedLabel: string;
  expectedUrgency: TriageSummary["urgency"];
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
  },
  {
    name: "pain/headache",
    message: "Bad headache",
    quickAnswers: [
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
      { id: "no_red_flag", label: "No, none of these", value: "None of these warning signs apply.", kind: "red_flag" },
      { id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "location" },
      { id: "severity_3", label: "3", value: "The symptom feels 3 out of 10.", kind: "severity" },
      { id: "better", label: "Mild, familiar, improving", value: "It is mild, familiar, and improving.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk pain or headache pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
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
  },
];

describe("triage route outcome parity", () => {
  it.each(pathCases)("preserves deterministic fallback shaping for $name", ({
    message,
    quickAnswers,
    expectedContent,
    expectedLevel,
    expectedLabel,
    expectedUrgency,
  }) => {
    const report = fallback(quickAnswers, {}, message);

    expect(Object.keys(report.summary).sort()).toEqual(summaryShapeKeys);
    expect(report.content).toBe(expectedContent);
    expect(report.summary.urgency).toBe(expectedUrgency);
    expect(report.summary.nextStepLevel).toBe(expectedLevel);
    expect(report.summary.nextStepLabel).toBe(expectedLabel);
  });

  it.each([
    [
      "BP crisis with chest context",
      [
        { id: "chest", label: "Chest discomfort", value: "I have chest discomfort.", kind: "symptom" },
        { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
        { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
      { vitals: { systolicBp: 182, diastolicBp: 121 } },
      undefined,
      "emergency",
      "urgent",
    ],
    [
      "BP crisis alone",
      [
        { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
        { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
        { id: "other_not_sure", label: "Other or not sure", value: "It is something else or I am not sure.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
      { vitals: { systolicBp: 185, diastolicBp: 122 } },
      { conditions: "high blood pressure" },
      "doctor_today",
      "urgent",
    ],
    [
      "SpO2 89-92",
      [
        { id: "breathing", label: "Breathing", value: "I have a breathing concern.", kind: "symptom" },
        { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
        { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
      { vitals: { oxygenSaturation: 92 } },
      undefined,
      "doctor_today",
      "urgent",
    ],
    [
      "RR 21-24",
      [
        { id: "fever", label: "Fever", value: "I have a fever.", kind: "symptom" },
        { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
        { id: "one_two_days", label: "1-2 days", value: "It has been 1-2 days.", kind: "duration" },
        { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
      { vitals: { respiratoryRate: 21 } },
      undefined,
      "doctor_today",
      "urgent",
    ],
    [
      "RR 25+",
      [
        { id: "fever", label: "Fever", value: "I have a fever.", kind: "symptom" },
        { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
        { id: "one_two_days", label: "1-2 days", value: "It has been 1-2 days.", kind: "duration" },
        { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
      { vitals: { respiratoryRate: 25 } },
      undefined,
      "emergency",
      "urgent",
    ],
    [
      "DKA/HHS pattern",
      [
        { id: "stomach", label: "Stomach or bowel", value: "I have a stomach or bowel concern.", kind: "symptom" },
        { id: "diabetes_vomiting", label: "Diabetes with vomiting", value: "Diabetes with vomiting.", kind: "red_flag" },
        { id: "strong", label: "Strong", value: "It feels strong.", kind: "severity" },
      ],
      { vitals: { glucoseMgdl: 320 } },
      { conditions: "diabetes" },
      "emergency",
      "urgent",
    ],
    [
      "stroke FAST-style red flag",
      [
        { id: "dizzy", label: "Dizziness", value: "I feel dizzy.", kind: "symptom" },
        { id: "stroke_sign", label: "Face, arm, or speech change", value: "Face, arm, or speech change.", kind: "red_flag" },
      ],
      {},
      { conditions: "prior TIA" },
      "emergency",
      "urgent",
    ],
    [
      "anticoagulant head injury",
      [
        { id: "fall", label: "Fall or injury", value: "I fell or got injured.", kind: "symptom" },
        { id: "head_hit_blood_thinner", label: "Head hit and blood thinner", value: "Head hit and blood thinner.", kind: "red_flag" },
        { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
      {},
      { medications: "apixaban" },
      "doctor_today",
      "urgent",
    ],
    [
      "profile modifier escalation",
      [
        { id: "urinary", label: "Urine problem", value: "I have a urine problem.", kind: "symptom" },
        { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
        { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
        { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      ],
      {},
      { conditions: "diabetes" },
      "doctor_today",
      "urgent",
    ],
  ] satisfies Array<[string, TriageWizardAnswer[], Partial<TriageWizardContext>, TriageHealthMemory | undefined, string, string]>)(
    "preserves route overlay parity for %s",
    (_name, quickAnswers, extra, healthMemory, expectedLevel, expectedUrgency) => {
      const report = buildFallbackTriageReport(
        "en",
        wizard(quickAnswers, extra),
        [{ role: "user", content: "Symptoms" }],
        healthMemory,
      );

      expect(report.summary.nextStepLevel).toBe(expectedLevel);
      expect(report.summary.urgency).toBe(expectedUrgency);
    },
  );

  it("preserves optional scan urgency floor and note metadata", () => {
    const report = fallback([
      { id: "urinary", label: "Urine problem", value: "I have a urine problem.", kind: "symptom" },
      { id: "blood_in_urine", label: "Blood in urine or clots", value: "There is blood or clots in my urine.", kind: "red_flag" },
      { id: "moderate", label: "Moderate", value: "It feels moderate.", kind: "severity" },
      { id: "worse", label: "Worse", value: "It is getting worse.", kind: "trend" },
    ], {
      scanResults: [{
        id: "scan-urine-1",
        type: "urine_photo",
        label: "Urine appearance photo",
        concernLevel: "urgent",
        summary: "The urine appears red.",
        findings: ["Red urine appearance"],
        capturedAt: "2026-05-31T00:00:00.000Z",
      }],
    }, "My urine looks red");

    expect(report.summary.nextStepLevel).toBe("doctor_today");
    expect(report.summary.scanResults).toHaveLength(1);
    expect(report.summary.scanNotes?.join(" ")).toContain("A photo cannot diagnose a urine infection.");
    expect(report.summary.triageReasons?.join(" ")).toContain("optional scan");
  });

  it("preserves profile risk normalization used by route prompts and floors", () => {
    const risks = profileRiskFlags({
      conditions: "diabetes CKD COPD high blood pressure",
      medications: "metformin furosemide apixaban prednisone",
      latestSymptomReport: "recent falls and confusion",
    });

    expect(risks).toMatchObject({
      bloodThinner: true,
      copd: true,
      cognitiveConcern: true,
      diabetes: true,
      diureticMedication: true,
      hypertension: true,
      immunosuppressed: true,
      kidneyDisease: true,
      steroidMedication: true,
    });
  });

  it("uses care, device, and check-in memory in deterministic profile flags", () => {
    const risks = profileRiskFlags({
      careContext: "Lives alone and uses a walker for balance.",
      checkinContext: "Possible missed check-in: daily call was overdue this morning.",
      devices: "Home oxygen concentrator and pulse oximeter.",
      recentSymptomReports: "recorded yesterday: dizziness and trouble walking safely",
    });

    expect(risks.copd).toBe(true);
    expect(risks.fallsFrailty).toBe(true);
  });

  it("requires the complete canonical sequence before deterministic guidance", () => {
    const incompleteFall = wizard([
      { id: "fall", label: "Fall or injury", value: "I fell or got injured.", kind: "symptom" },
      { id: "no_red_flag", label: "No, only a small bruise or soreness", value: "Only a small bruise or soreness.", kind: "red_flag" },
      { id: "mild", label: "Yes, normal movement and mild soreness", value: "I can move normally with mild soreness.", kind: "severity" },
    ]);

    expect(nextAdaptiveStage(incompleteFall)).toBe("duration");

    const answers: TriageWizardAnswer[] = [
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
    ];
    expect(nextAdaptiveStage(wizard(answers))).toBe("location");
    answers.push({ id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "location" });
    expect(nextAdaptiveStage(wizard(answers))).toBe("red_flag");
    answers.push({ id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" });
    expect(nextAdaptiveStage(wizard(answers))).toBe("severity");
    answers.push({ id: "severity_5", label: "5", value: "The symptom feels 5 out of 10.", kind: "severity" });
    expect(nextAdaptiveStage(wizard(answers))).toBe("duration");
    answers.push({ id: "today", label: "Today", value: "It started today.", kind: "duration" });
    expect(nextAdaptiveStage(wizard(answers))).toBe("trend");
    answers.push({ id: "same", label: "About the same", value: "It is about the same.", kind: "trend" });
    expect(nextAdaptiveStage(wizard(answers))).toBe("support");
    answers.push({ id: "confirm_review", label: "Yes, show my guidance", value: "These answers are correct.", kind: "support" });
    expect(nextAdaptiveStage(wizard(answers))).toBe("complete");

    expect(nextAdaptiveStage(wizard([
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
    ], { refineRequested: true, vitals: { painScore: 6 } }))).toBe("complete");

    const refined = applyTriageSafetyFloor(baseSummary(), wizard([
      { id: "fever", label: "Fever", value: "I have a fever.", kind: "symptom" },
      { id: "immuno_fever", label: "Fever with low immunity", value: "I have fever and low immunity or cancer treatment.", kind: "red_flag" },
    ], { refineRequested: true, vitals: { temperatureC: 38.5 } }), "en");

    expect(refined.nextStepLevel).toBe("emergency");
    expect(refined.vitalsNotes).toContain("Temperature was 38.5 C.");
  });

  it("does not let a phone estimate independently change acute triage", () => {
    const answers: TriageWizardAnswer[] = [
      { id: "breathing", label: "Breathing", value: "I have a breathing concern.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ];
    const estimated = fallback(answers, {
      vitals: { oxygenSaturation: 88 },
      vitalsEvidence: { oxygenSaturation: { source: "phone_estimate", affectsTriage: false } },
    });
    const connected = fallback(answers, {
      vitals: { oxygenSaturation: 88 },
      vitalsEvidence: { oxygenSaturation: { source: "connected_device", affectsTriage: true } },
    });

    expect(estimated.summary.nextStepLevel).toBe("monitor");
    expect(connected.summary.nextStepLevel).toBe("emergency");
  });

  it("uses the canonical numeric severity scale in deterministic guidance", () => {
    const result = fallback([
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
      { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" },
      { id: "severity_8", label: "8", value: "The symptom feels 8 out of 10.", kind: "severity" },
      { id: "today", label: "Today", value: "It started today.", kind: "duration" },
      { id: "same", label: "About the same", value: "It is about the same.", kind: "trend" },
      { id: "confirm_review", label: "Confirm", value: "These answers are correct.", kind: "support" },
    ], {}, "Strong headache");

    expect(result.summary.nextStepLevel).toBe("doctor_today");
    expect(result.summary.vitalsNotes).toContain("Symptom severity was 8/10.");
  });

  it("deduplicates semantically repeated report recommendations", () => {
    const refined = applyTriageSafetyFloor({
      ...baseSummary(),
      recommendations: [
        "Contact your doctor or clinic within 24-48 hours if this continues.",
        "Keep track of any changes in your symptoms",
      ],
    }, wizard([
      { id: "other", label: "Something else", value: "Something else.", kind: "symptom" },
      { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", kind: "red_flag" },
      { id: "ongoing_not_improving", label: "Ongoing", value: "It is not improving.", kind: "trend" },
    ]), "en");

    const doctorWindowSteps = refined.recommendations.filter((item) => /doctor|clinic|medical advice/i.test(item) && /24-48/.test(item));

    expect(refined.recommendations).toHaveLength(4);
    expect(doctorWindowSteps).toHaveLength(1);
    expect(refined.recommendations.join(" ")).not.toContain("Contact your doctor or clinic within 24-48 hours if this continues.");
    expect(refined.recommendations.join(" ")).not.toContain("Keep track of any changes in your symptoms");
  });

  it("adds deterministic interpretation, possible situations, reassessment, triggers, and handoff", () => {
    const result = fallback([
      { id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" },
      { id: "walking_only", label: "Mild or only with activity", value: "It only happens with activity.", kind: "red_flag" },
      { id: "severity_4", label: "4", value: "It feels 4 out of 10.", kind: "severity" },
      { id: "few_days", label: "Few days", value: "It has lasted a few days.", kind: "duration" },
      { id: "fever_cough_phlegm", label: "Fever, cough, or more phlegm", value: "It comes with cough.", kind: "trend" },
    ], {}, "Breathing feels harder than usual");

    expect(result.summary.interpretation).toContain("not a diagnosis");
    expect(result.summary.interpretation).not.toContain("Taken together");
    expect(result.summary.possiblePatterns?.map((pattern) => pattern.id)).toContain("airway_infection");
    expect(result.summary.possiblePatterns?.[0].supportingAnswers.length).toBeGreaterThan(0);
    expect(result.summary.uncertainty?.join(" ")).toContain("No current measured vital signs");
    expect(result.summary.reassessmentWindow).toBeTruthy();
    expect(result.summary.changePlanTriggers?.length).toBeGreaterThan(0);
    expect(result.summary.clinicalHandoff?.keyPoints).toContain("Few days");
  });

  it("keeps possible causes secondary to urgent action when an emergency warning sign is present", () => {
    const result = fallback([
      { id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" },
      { id: "cannot_speak_breathing", label: "Gasping or cannot speak", value: "I cannot speak a full sentence.", kind: "red_flag" },
    ], {}, "Severe breathing trouble");

    expect(result.summary.nextStepLevel).toBe("emergency");
    expect(result.summary.possiblePatterns?.length).toBeGreaterThan(0);
    expect(result.summary.interpretation).toContain("warning sign");
    expect(result.summary.interpretation).toContain("must not delay emergency help");
    expect(result.summary.reassessmentWindow).toContain("Seek emergency help now");
  });

  it("replaces model-provided pattern speculation with the protocol catalogue", () => {
    const refined = applyTriageSafetyFloor({
      ...baseSummary(),
      possiblePatterns: [{
        id: "invented_diagnosis",
        label: "Definite diagnosis",
        explanation: "The model says this is certain.",
        supportingAnswers: [],
        clarifyingSigns: [],
      }],
    }, wizard([
      { id: "dizzy", label: "Dizzy", value: "I feel dizzy.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "standing_dizziness", label: "Happens when standing up", value: "It happens when standing.", kind: "trend" },
    ]), "en");

    expect(refined.possiblePatterns?.map((pattern) => pattern.id)).toEqual(["postural", "metabolic_dizzy"]);
    expect(refined.possiblePatterns?.join(" ")).not.toContain("invented_diagnosis");
  });
});
