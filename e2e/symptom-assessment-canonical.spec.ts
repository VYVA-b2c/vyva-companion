import { expect, test, type Page, type Route } from "@playwright/test";
import path from "node:path";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

type SymptomAssessmentApiOptions = {
  onTriageMessage?: (call: number, body: Record<string, unknown>) => unknown | Promise<unknown>;
  onVoiceSession?: () => unknown | Promise<unknown>;
  onVoiceAnswer?: (body: Record<string, unknown>) => unknown | Promise<unknown>;
  reportSaveDelayMs?: number;
};

const quickReply = (id: string, label: string, kind: string, value = label) => ({
  id,
  label,
  value,
  icon: "help",
  tone: "purple",
  kind,
});

function triageStep(
  stage: string,
  content: string,
  replies: ReturnType<typeof quickReply>[],
) {
  return {
    content,
    done: false,
    quickReplies: replies,
    wizardStageLabel: stage,
    guidancePlan: {
      stage,
      priorityLabel: "Safety first",
      protocolLabel: "Symptom assessment",
      nextQuestionFocus: content,
      usefulSignals: [],
      confidence: {
        score: 4,
        label: "Good",
        reasons: ["Your answers"],
        missing: [],
      },
    },
  };
}

async function installSymptomAssessmentApi(
  page: Page,
  options: SymptomAssessmentApiOptions = {},
) {
  let triageMessageCall = 0;
  await page.route("https://freeipapi.com/api/json/", (route) =>
    fulfillJson(route, { countryCode: "ES" }),
  );

  await page.route("**/api/**", async (route) => {
    const requestPath = new URL(route.request().url()).pathname;

    if (requestPath === "/api/auth/me") {
      await fulfillJson(route, {
        id: "symptom-visual-user",
        email: "symptom-visual@example.com",
        language: "en",
        activeProfileId: "profile-rosa",
        role: "user",
      });
      return;
    }

    if (requestPath === "/api/onboarding/state") {
      await fulfillJson(route, {
        account: { role: "user" },
        profile: {
          current_stage: "complete",
          first_name: "Rosa",
          last_name: "Martinez",
          conditions: [],
          health_conditions: [],
          medications: [],
          known_allergies: [],
          elder_confirmed_at: new Date().toISOString(),
        },
        onboardingState: { current_stage: "complete" },
      });
      return;
    }

    if (requestPath === "/api/profile/readiness") {
      await fulfillJson(route, {
        profile: {},
        services: { symptomCheck: { ready: true, missing: [] } },
      });
      return;
    }

    if (requestPath === "/api/profile") {
      await fulfillJson(route, {
        firstName: "Rosa",
        lastName: "Martinez",
        country: "ES",
        language: "en",
      });
      return;
    }

    if (requestPath === "/api/triage/context") {
      await fulfillJson(route, {
        memory: null,
        activeConditions: [],
        usedItems: [],
        personalizedSuggestions: [],
        emergencyContact: { label: "112", telHref: "tel:112" },
      });
      return;
    }

    if (
      requestPath === "/api/triage/message" &&
      route.request().method() === "POST"
    ) {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>;
      if (options.onTriageMessage) {
        const body = await options.onTriageMessage(triageMessageCall++, requestBody);
        await fulfillJson(route, body);
        return;
      }
      await fulfillJson(route, {
        content:
          "Before we continue, are you having severe chest pain, fainting, or struggling to breathe?",
        done: false,
        quickReplies: [
          {
            id: "no-warning-signs",
            label: "No",
            value: "No urgent warning signs",
            icon: "help",
            tone: "green",
            kind: "safety",
          },
          {
            id: "yes-warning-signs",
            label: "Yes",
            value: "Yes, I have an urgent warning sign",
            icon: "alert",
            tone: "red",
            kind: "safety",
          },
        ],
        wizardStageLabel: "Safety check",
        guidancePlan: {
          stage: "red_flag",
          priorityLabel: "Safety first",
          protocolLabel: "Urgent warning sign check",
          nextQuestionFocus: "Check urgent warning signs",
          usefulSignals: [],
          confidence: {
            score: 2,
            label: "Early",
            reasons: [],
            missing: [],
          },
        },
      });
      return;
    }

    if (requestPath === "/api/reports/triage" && route.request().method() === "POST") {
      if (options.reportSaveDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.reportSaveDelayMs));
      }
      await fulfillJson(route, {
        id: "triage-report-complete-flow",
        chief_complaint: "I have a headache",
        symptoms: ["Headache"],
        urgency: "monitor",
        recommendations: ["Rest and drink water", "Seek help if symptoms worsen"],
        disclaimer: "This assessment does not replace medical care.",
        created_at: new Date().toISOString(),
        sent_to: [],
      });
      return;
    }

    if (requestPath.startsWith("/api/reports/triage/") && route.request().method() === "GET") {
      await fulfillJson(route, {
        id: decodeURIComponent(requestPath.split("/").pop() ?? "triage-report-complete-flow"),
        chief_complaint: "I have a headache",
        symptoms: ["Headache"],
        urgency: "monitor",
        recommendations: ["Rest and drink water", "Seek help if symptoms worsen"],
        disclaimer: "This assessment does not replace medical care.",
        ai_summary: "Your symptom check is complete.",
        next_step_label: "Monitor at home",
        next_step_level: "monitor",
        triage_reasons: ["No urgent warning signs were reported."],
        watch_signs: ["Symptoms getting worse"],
        profile_considerations: [],
        vitals_notes: [],
        scan_results: [],
        scan_notes: [],
        bpm: null,
        respiratory_rate: null,
        duration_seconds: 45,
        created_at: new Date().toISOString(),
      });
      return;
    }

    if (requestPath === "/api/reports/summary") {
      await fulfillJson(route, {
        latestTriage: null,
        latestVitals: null,
        latestSignals: [],
        todayMeds: { taken: 0, total: 0, adherencePct: null },
      });
      return;
    }

    if (requestPath === "/api/reports/vitals/history") {
      await fulfillJson(route, { readings: [], signalReadings: [] });
      return;
    }

    if (requestPath === "/api/symptoms/log" && route.request().method() === "POST") {
      await fulfillJson(route, { ok: true });
      return;
    }

    if (requestPath === "/api/onboarding/careteam") {
      await fulfillJson(route, { members: [] });
      return;
    }

    if (requestPath === "/api/vitals-engine/latest") {
      await fulfillJson(route, { recent_readings: [] });
      return;
    }

    if (requestPath.startsWith("/api/voice-triage/session/") && requestPath.endsWith("/answer")) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, options.onVoiceAnswer ? await options.onVoiceAnswer(body) : {});
      return;
    }

    if (requestPath.startsWith("/api/voice-triage/session/")) {
      await fulfillJson(route, options.onVoiceSession ? await options.onVoiceSession() : {}, options.onVoiceSession ? 200 : 404);
      return;
    }

    if (requestPath === "/api/profile/linked-profiles") {
      await fulfillJson(route, { profiles: [] });
      return;
    }

    await fulfillJson(route, {});
  });
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("the real mobile Touch flow uses the canonical describe and safety scenes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installSymptomAssessmentApi(page);

  const browserErrors = collectBrowserErrors(page);

  await page.goto("/health/symptom-check");

  const describeScene = page.getByTestId("symptom-presentation-describe-touch");
  await expect(describeScene).toBeVisible();
  await page.locator("#vyva-launch").waitFor({ state: "hidden", timeout: 20_000 });
  await page.waitForTimeout(1_000);
  const emergencyModal = page.getByTestId("symptom-emergency-modal");
  if (await emergencyModal.isVisible()) {
    await page.getByTestId("button-symptom-emergency-continue").click();
  }
  await expect(describeScene).toHaveAttribute("data-scene-layout", "capture");
  await expect(page.getByTestId("prototype-home-master-topbar")).toBeVisible();
  await expect(page.getByTestId("prototype-symptom-assessment-screen")).toHaveAttribute(
    "data-shell-contract",
    "home.production",
  );
  await expect(page.getByTestId("prototype-symptom-assessment-screen")).toHaveAttribute(
    "data-header-contract",
    "detail.voice-touch",
  );
  await expect(page.getByTestId("prototype-symptom-assessment-screen")).toHaveAttribute(
    "data-container-contract",
    "flow.rounded-card",
  );
  await expect(page.getByTestId("prototype-symptom-assessment-screen")).toHaveAttribute(
    "data-bottom-nav-contract",
    "home-sos-reports",
  );
  await expect(page.getByTestId("prototype-symptom-assessment-screen")).toHaveAttribute(
    "data-composer-contract",
    "hidden",
  );
  await expect(page.getByRole("heading", { name: "Ask Dr. AI" })).toBeVisible();
  await expect(page.getByTestId("button-prototype-back")).toBeVisible();
  await expect(page.getByTestId("nav-tab-home")).toBeVisible();
  await expect(page.getByTestId("nav-tab-sos")).toBeVisible();
  await expect(page.getByTestId("nav-tab-reports")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to voice mode" }),
  ).toBeVisible();
  await expect(describeScene.getByLabel("Touch mode", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("symptom-check-example-chips")).toBeVisible();
  await expect(page.getByTestId("symptom-check-more-ideas")).toBeHidden();

  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-describe-390.png"),
    fullPage: true,
  });

  await page.getByTestId("button-symptom-other").click();
  await page.getByTestId("input-symptom-clue").fill("Pain or headache");
  await expect(page.getByTestId("button-symptom-check-start")).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-selected-390.png"),
    fullPage: true,
  });

  await page.getByTestId("input-symptom-clue").fill("I have a headache");
  await page.getByTestId("button-symptom-check-start").click();

  const safetyScene = page.getByTestId("symptom-presentation-safety_check-touch");
  await expect(safetyScene).toBeVisible();
  await expect(safetyScene).toHaveAttribute("data-scene-layout", "binary");
  await expect(safetyScene).toHaveAttribute("data-shell-contract", "home.production");
  const safetyFrame = await safetyScene.boundingBox();
  expect(safetyFrame?.width).toBe(330);
  expect(safetyFrame?.height).toBeGreaterThanOrEqual(400);
  expect(safetyFrame?.height).toBeLessThanOrEqual(535);
  await expect(
    safetyScene.getByRole("heading", {
      name: "Before we continue, are you having severe chest pain, fainting, or struggling to breathe?",
    }),
  ).toBeVisible();
  await expect(safetyScene.getByTestId("triage-question-progress")).toHaveCount(0);
  await expect(
    safetyScene.getByRole("button", { name: "Play question" }),
  ).toHaveCount(0);
  await expect(safetyScene.getByText("Choose the closest answer")).toHaveCount(0);
  const controls = safetyScene.getByTestId(
    "symptom-scene-controls-safety_check-touch",
  );
  await expect(controls.getByTestId("triage-quick-answers")).toBeVisible();
  await expect(controls.getByRole("button", { name: "No" })).toBeVisible();
  const yesButton = controls.getByRole("button", { name: "Yes" });
  await expect(yesButton).toBeVisible();
  await expect(yesButton).toHaveAttribute("data-safety-tone", "warning");
  await expect(yesButton).toHaveCSS("background-color", "rgb(58, 36, 46)");
  await expect(yesButton).toHaveCSS("color", "rgb(253, 164, 175)");
  await expect(page.getByTestId("input-triage-message")).toHaveCount(0);

  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-safety-390.png"),
    fullPage: true,
  });

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
  expect(browserErrors).toEqual([]);
});

test("the desktop Touch entry keeps the canonical flow centered and readable", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1290, height: 663 });
  await installSymptomAssessmentApi(page);

  const browserErrors = collectBrowserErrors(page);
  await page.goto("/health/symptom-check");

  const describeScene = page.getByTestId("symptom-presentation-describe-touch");
  await expect(describeScene).toBeVisible();
  await page.locator("#vyva-launch").waitFor({ state: "hidden", timeout: 20_000 });
  await page.waitForTimeout(1_000);
  const emergencyModal = page.getByTestId("symptom-emergency-modal");
  if (await emergencyModal.isVisible()) {
    await page.getByTestId("button-symptom-emergency-continue").click();
  }

  await expect(page.getByTestId("prototype-home-master-topbar")).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
  const sceneFrame = await describeScene.boundingBox();
  expect(sceneFrame?.width).toBeGreaterThanOrEqual(330);
  expect(sceneFrame?.width).toBeLessThanOrEqual(760);
  const exampleButtons = page
    .getByTestId("symptom-check-example-chips")
    .locator('[data-testid^="button-symptom-example-"]');
  await expect(exampleButtons).toHaveCount(3);
  await expect(page.getByTestId("button-symptom-more-examples")).toBeVisible();
  await expect(page.getByTestId("button-symptom-other")).toBeVisible();
  for (const button of await exampleButtons.all()) {
    const frame = await button.boundingBox();
    expect(frame?.width).toBeGreaterThanOrEqual(150);
    expect(frame?.height).toBeLessThanOrEqual(120);
  }
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
  expect(browserErrors).toEqual([]);

  await page.evaluate(() => window.scrollTo(0, 0));
});

test("the complete mobile Touch flow reaches a saved and shareable report", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });

  const completeSummary = {
    chiefComplaint: "I have a headache",
    symptoms: ["Headache"],
    urgency: "monitor",
    recommendations: ["Rest and drink water", "Seek help if symptoms worsen"],
    disclaimer: "This assessment does not replace medical care.",
    nextStepLabel: "Monitor at home",
    nextStepLevel: "monitor",
    triageReasons: ["No urgent warning signs were reported."],
    watchSigns: ["A sudden severe headache", "Weakness or trouble speaking"],
    profileConsiderations: [],
    vitalsNotes: [],
  };
  const responses = [
    triageStep("red_flag", "Do you have any urgent warning signs?", [
      quickReply("no-warning", "No", "safety", "No urgent warning signs"),
      quickReply("yes-warning", "Yes", "safety", "Yes, urgent warning signs"),
    ]),
    triageStep("symptom", "Which symptom is closest?", [
      quickReply("headache", "Headache", "symptom"),
      quickReply("dizziness", "Dizziness", "symptom"),
      quickReply("nausea", "Nausea", "symptom"),
    ]),
    triageStep("severity", "How strong is it from 0 to 10?", Array.from({ length: 11 }, (_, value) =>
      quickReply(`severity-${value}`, String(value), "severity"),
    )),
    triageStep("duration", "When did it start?", [
      quickReply("today", "Today", "duration"),
      quickReply("days", "A few days ago", "duration"),
      quickReply("week", "More than a week ago", "duration"),
    ]),
    triageStep("trend", "Has anything made it better or worse?", [
      quickReply("better", "Rest or medicine helped", "trend"),
      quickReply("worse", "Activity, light, or noise made it worse", "trend"),
      quickReply("headache_fever_stiff", "An injury or other symptoms affected it", "trend"),
      quickReply("same", "Nothing clearly changed it", "trend"),
    ]),
    triageStep("support", "Does this look right?", [
      quickReply("confirm", "Yes, show my guidance", "review"),
      quickReply("change", "Edit", "review"),
    ]),
    {
      content: "Your assessment is complete.",
      done: true,
      quickReplies: [],
      summary: completeSummary,
      guidancePlan: {
        stage: "complete",
        priorityLabel: "Next step",
        protocolLabel: "Symptom assessment",
        nextQuestionFocus: "Monitor at home",
        usefulSignals: [],
        confidence: {
          score: 4,
          label: "Good",
          reasons: ["Your answers"],
          missing: [],
        },
      },
    },
  ];

  await installSymptomAssessmentApi(page, {
    onTriageMessage: async (call) => {
      const responseDelayMs = call === responses.length - 1 ? 2_500 : 180;
      await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
      return responses[call];
    },
    reportSaveDelayMs: 2_500,
  });
  const browserErrors = collectBrowserErrors(page);

  await page.goto("/health/symptom-check");
  await page.locator("#vyva-launch").waitFor({ state: "hidden", timeout: 20_000 });
  const emergencyModal = page.getByTestId("symptom-emergency-modal");
  if (await emergencyModal.isVisible()) {
    await page.getByTestId("button-symptom-emergency-continue").click();
  }
  await page.getByTestId("button-symptom-other").click();
  await page.getByTestId("input-symptom-clue").fill("I have a headache");
  await page.getByTestId("button-symptom-check-start").click();

  const stage = (id: string) => page.getByTestId(`symptom-presentation-${id}-touch`);
  await expect(stage("safety_check")).toBeVisible();
  await stage("safety_check").getByRole("button", { name: "No" }).click();
  await expect(stage("symptom_selection")).toBeVisible();
  await expect(stage("symptom_selection").getByRole("button", { name: "Nothing else" })).toBeVisible();
  await expect(stage("symptom_selection").getByRole("button", { name: "Headache" })).toHaveCount(0);
  await page.getByTestId("prototype-home-master-topbar").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-symptom-selection-390.png"),
    fullPage: false,
  });
  await stage("symptom_selection").getByRole("button", { name: "Nothing else" }).click();
  await expect(stage("severity")).toBeVisible();
  await expect(stage("severity").getByRole("slider", { name: "Symptom severity from 0 to 10" })).toHaveValue("5");
  await page.getByTestId("prototype-home-master-topbar").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-severity-390.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  expect((await stage("severity").boundingBox())?.width).toBeGreaterThanOrEqual(500);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-severity-1440.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await stage("severity").getByTestId("symptom-severity-continue").click();
  await expect(stage("onset")).toBeVisible();
  await expect(stage("onset").getByRole("button", { name: "Today" })).toBeVisible();
  await page.getByTestId("prototype-home-master-topbar").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-onset-390.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  expect((await stage("onset").boundingBox())?.width).toBeGreaterThanOrEqual(500);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-onset-1440.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await stage("onset").getByRole("button", { name: "Today" }).click();
  await expect(stage("related_details")).toBeVisible();
  await expect(stage("related_details").getByRole("heading", { name: "One more detail" })).toBeVisible();
  await expect(stage("related_details").getByText("Choose the pattern that fits best.")).toBeVisible();
  await expect(stage("related_details").getByRole("button", { name: "Nothing clearly changed it" })).toBeVisible();
  const mobileRelatedDetailsFrame = await stage("related_details").boundingBox();
  expect(mobileRelatedDetailsFrame?.width).toBeLessThanOrEqual(360);
  await page.getByTestId("prototype-home-master-topbar").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-related-details-390.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const desktopRelatedDetailsFrame = await stage("related_details").boundingBox();
  expect(desktopRelatedDetailsFrame?.width).toBeGreaterThanOrEqual(500);
  expect(desktopRelatedDetailsFrame?.height).toBeLessThanOrEqual(520);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-related-details-1440.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await stage("related_details").getByRole("button", { name: "Nothing clearly changed it" }).click();
  await expect(stage("review")).toBeVisible();
  await expect(stage("review").getByTestId("symptom-scene-review")).toBeVisible();
  await expect(stage("review").getByRole("heading", { name: "Does this look right?" })).toBeVisible();
  await expect(stage("review").getByRole("button", { name: "Yes, show my guidance" })).toBeVisible();
  await expect(stage("review").getByRole("button", { name: "Edit" })).toBeVisible();
  await page.getByTestId("prototype-home-master-topbar").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-review-390.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  expect((await stage("review").boundingBox())?.width).toBeGreaterThanOrEqual(500);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-review-1440.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await stage("review").getByRole("button", { name: "Yes, show my guidance" }).click();
  await expect(stage("checking")).toBeVisible();
  const checkingProgress = stage("checking").getByTestId("symptom-scene-progress");
  await expect(checkingProgress).toBeVisible();
  await expect(checkingProgress.getByRole("heading")).toHaveText(
    /Reviewing your symptoms|Reviewing your health profile|Searching 40M\+ peer-reviewed sources|Checking safety signals/,
  );
  await page.getByTestId("prototype-home-master-topbar").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-checking-390.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const desktopCheckingFrame = await stage("checking").boundingBox();
  expect(desktopCheckingFrame?.width).toBeGreaterThanOrEqual(500);
  expect(desktopCheckingFrame?.height).toBeLessThanOrEqual(450);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-checking-1440.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const report = page.getByTestId("symptom-check-report");
  await expect(report).toBeVisible();
  await expect(report.getByRole("heading", { level: 1, name: "Your summary" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Your summary" })).toHaveCount(1);
  await expect(page.getByTestId("button-symptom-mode-voice")).toBeVisible();
  await expect(page.getByTestId("button-report-voice")).toHaveCount(0);
  await expect(page.getByTestId("symptom-presentation-safest_next_step-touch")).toHaveCount(0);
  await expect(page.getByTestId("card-report-answer")).toContainText("I have a headache");
  await expect(page.getByTestId("card-report-do-now")).toContainText("Monitor at home");
  await page.getByTestId("prototype-home-master-topbar").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-safest-next-step-390.png"),
    fullPage: false,
  });
  await expect(page.getByTestId("button-report-vitals")).toBeVisible();
  const mobilePrimaryAction = await page.getByTestId("button-report-vitals").boundingBox();
  const mobileBottomNav = await page.getByRole("navigation").boundingBox();
  expect((mobilePrimaryAction?.y ?? 0) + (mobilePrimaryAction?.height ?? 0)).toBeLessThanOrEqual(mobileBottomNav?.y ?? 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect((await report.boundingBox())?.width).toBeGreaterThanOrEqual(500);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-safest-next-step-1440.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveURL(/\/informes\/triage-report-complete-flow$/);
  await expect(page.getByTestId("symptom-check-shell")).toHaveAttribute("data-stage-id", "save_share_summary", { timeout: 30_000 });
  await expect(page.getByTestId("card-report-answer")).toContainText("I have a headache");
  await expect(page.getByTestId("card-report-do-now")).toContainText("Monitor at home");
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-complete-390.png"),
    fullPage: true,
  });

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
  expect(browserErrors).toEqual([]);
});

test("the mobile checking loader follows the selected light and dark theme", async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installSymptomAssessmentApi(page);

  const browserErrors = collectBrowserErrors(page);
  for (const theme of ["light", "dark"] as const) {
    await page.goto(`/dev/home-master/ask-dr-ai-checking?theme=${theme}&lang=en`);
    await page.locator("#vyva-launch").waitFor({ state: "hidden", timeout: 20_000 });

    const loader = page.getByTestId("symptom-presentation-checking-touch");
    await expect(loader).toBeVisible();
    await expect(loader).toHaveAttribute("data-theme-surface", `canonical-${theme}`);
    await expect(loader.getByRole("progressbar")).toHaveAttribute("aria-valuenow", /[1-4]/);
    await expect(page.locator(".vite-error-overlay")).toHaveCount(0);

    const loaderBox = await loader.boundingBox();
    const progressBox = await loader.getByRole("progressbar").boundingBox();
    const initialHeading = await loader.getByRole("heading").innerText();
    expect(loaderBox?.width).toBeLessThanOrEqual(360);
    expect(loaderBox?.height).toBeLessThanOrEqual(380);

    await expect.poll(() => loader.getByRole("heading").innerText()).not.toBe(initialHeading);
    const rotatedLoaderBox = await loader.boundingBox();
    const rotatedProgressBox = await loader.getByRole("progressbar").boundingBox();
    expect(rotatedLoaderBox).toEqual(loaderBox);
    expect(rotatedProgressBox).toEqual(progressBox);

    await page.screenshot({
      path: path.resolve(`artifacts/symptom-assessment-checking-${theme}-390.png`),
      fullPage: false,
    });
  }

  expect(browserErrors).toEqual([]);
});

test("an urgent Touch answer renders the emergency escalation scene", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const responses = [
    triageStep("red_flag", "Do you have any urgent warning signs?", [
      quickReply("no-warning", "No", "safety"),
      quickReply("yes-warning", "Yes", "safety", "Yes, urgent warning signs"),
    ]),
    {
      ...triageStep("red_flag", "Call emergency services now.", []),
      safetyAlert: {
        recommendation: "Call emergency services now. Do not wait.",
        emergencyContact: { label: "112", telHref: "tel:112" },
      },
      emergencyContact: { label: "112", telHref: "tel:112" },
    },
  ];
  await installSymptomAssessmentApi(page, {
    onTriageMessage: (call) => responses[call],
  });
  const browserErrors = collectBrowserErrors(page);

  await page.goto("/health/symptom-check");
  await page.locator("#vyva-launch").waitFor({ state: "hidden", timeout: 20_000 });
  const emergencyModal = page.getByTestId("symptom-emergency-modal");
  if (await emergencyModal.isVisible()) {
    await page.getByTestId("button-symptom-emergency-continue").click();
  }
  await page.getByTestId("button-symptom-other").click();
  await page.getByTestId("input-symptom-clue").fill("I have chest pain");
  await page.getByTestId("button-symptom-check-start").click();
  const safety = page.getByTestId("symptom-presentation-safety_check-touch");
  await expect(safety).toBeVisible();
  await safety.getByRole("button", { name: "Yes" }).click();

  const urgent = page.getByTestId("symptom-presentation-urgent_escalation-touch");
  await expect(urgent).toBeVisible();
  await expect(urgent).toHaveAttribute("data-presentation-state", "urgent");
  await expect(urgent.getByRole("button", { name: "Call 112" })).toBeVisible();
  await expect(page.getByTestId("triage-question-progress")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play question" })).toHaveCount(0);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-urgent-390.png"),
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});

test("an active Voice session opens its corresponding report after completion", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  let voiceSession = {
    conversation_id: "voice-complete-flow",
    status: "active",
    latest_response: {
      ok: true,
      status: "active",
      spoken_text: "Do you have any urgent warning signs?",
      question: {
        stage: "red_flag",
        text: "Do you have any urgent warning signs?",
        reason: "Safety comes first.",
        profile_context_used: true,
        choices: [
          { id: "voice-no", spoken_label: "No", value: "No urgent warning signs" },
          { id: "voice-yes", spoken_label: "Yes", value: "Yes, urgent warning signs" },
        ],
      },
    },
  } as Record<string, unknown>;

  await page.addInitScript(() => {
    window.localStorage.setItem("vyva.voice.sessionId", "voice-complete-flow");
    window.sessionStorage.setItem("vyva.voice.sessionId", "voice-complete-flow");
  });
  await installSymptomAssessmentApi(page, {
    onVoiceSession: () => voiceSession,
    onVoiceAnswer: (body) => {
      expect(body).toMatchObject({ choice_id: "voice-no" });
      const latest = {
        ok: true,
        status: "complete",
        spoken_text: "Your symptom check is complete.",
        question: {
          stage: "complete",
          text: "Your symptom check is complete.",
          choices: [],
        },
        report: {
          triage_report_id: "voice-report-1",
          next_step_level: "monitor",
          chief_complaint: "Headache",
          watch_signs: ["Symptoms getting worse"],
        },
        action_options: [
          { id: "view-report", kind: "view_report", label: "View report", route: "/informes" },
        ],
      };
      voiceSession = {
        conversation_id: "voice-complete-flow",
        status: "complete",
        latest_response: latest,
        triage_report_id: "voice-report-1",
      };
      return latest;
    },
  });
  const browserErrors = collectBrowserErrors(page);

  await page.goto("/health/symptom-check");
  const voiceSafety = page.getByTestId("symptom-presentation-safety_check-voice");
  await expect(voiceSafety).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to touch mode" })).toBeVisible();
  await voiceSafety.getByRole("button", { name: "No" }).click();

  await expect(page).toHaveURL(/\/informes\/voice-report-1$/);
  await expect(page.getByTestId("symptom-check-shell")).toHaveAttribute("data-stage-id", "save_share_summary", { timeout: 30_000 });
  await expect(page.getByTestId("card-report-answer")).toContainText("I have a headache");
  await expect(page.getByTestId("card-report-do-now")).toContainText("Monitor at home");
  await expect(page.getByTestId("input-triage-message")).toHaveCount(0);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-voice-complete-390.png"),
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});
