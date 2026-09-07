import { beforeAll, describe, expect, it } from "vitest";

let composeLongevityCompanionPayload: typeof import("../server/routes/healthInsightsReport.js").composeLongevityCompanionPayload;
let buildFallbackLongevityProgramLayer: typeof import("../server/routes/healthInsightsReport.js").buildFallbackLongevityProgramLayer;
let activeLongevityMoment: typeof import("../server/routes/healthInsightsReport.js").activeLongevityMoment;
let longevityMomentForHour: typeof import("../server/routes/healthInsightsReport.js").longevityMomentForHour;

type ComposeInput = Parameters<typeof composeLongevityCompanionPayload>[0];
type Pillar = NonNullable<ComposeInput["plan"]["priority_pillar"]>;
type DailyContent = ComposeInput["dailyContent"];
type DailyContentRow = DailyContent["byPillar"][Pillar][number];
type FeedbackHistory = ComposeInput["feedbackHistory"];

const userId = "11111111-1111-4111-8111-111111111111";

const basePlan: ComposeInput["plan"] = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: userId,
  generated_at: "2026-08-01T09:00:00.000Z",
  period_start: new Date("2026-06-01T00:00:00.000Z"),
  period_end: new Date("2026-08-01T00:00:00.000Z"),
  pillar_heart: "steady",
  pillar_brain: "priority_focus",
  pillar_strength: "steady",
  pillar_nourishment: "thriving",
  pillar_calm: "needs_attention",
  pillar_heart_signals: null,
  pillar_brain_signals: null,
  pillar_strength_signals: null,
  pillar_nourishment_signals: null,
  pillar_calm_signals: null,
  cross_pillar_patterns: [],
  recommendations: {
    heart: [{ action: "Tai chi", why: "A guided VYVA movement exercise is clearer than another walking reminder." }],
    brain: [
      { action: "Try one short memory challenge", why: "A named challenge gives the day a clear finish." },
      { action: "Call someone you enjoy this week", why: "Connection keeps the mind engaged." },
    ],
    strength: [{ action: "Clear one walking path", why: "A clear route makes movement easier." }],
    nourishment: [{ action: "Choose protein with your next meal", why: "Protein with a meal is a clear nourishment step." }],
    calm: [{ action: "Open a two-minute breathing reset", why: "Two minutes is enough to start." }],
  },
  priority_intervention: "Try one short memory challenge",
  priority_why: "Small sessions support continuity.",
  plan_narrative_senior: null,
  plan_narrative_caregiver: null,
  plan_abstract_gp: null,
  trajectory: "first",
  source_signals: { cognitive: true, mood: true },
  confidence: 0.7,
  priority_pillar: "brain",
  status: "active",
};

const emptyDailyContent: DailyContent = {
  exercise: null,
  meal: null,
  tip: null,
  supplement: null,
  naturalSolution: null,
  articles: [],
  byPillar: {
    heart: [],
    brain: [],
    strength: [],
    nourishment: [],
    calm: [],
  },
};

function dailyRow(
  pillar: Pillar,
  title: string,
  description: string,
  id = `${pillar}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  rotationWeight = 3,
  contentType: DailyContentRow["content_type"] = "tip",
  moment = "any",
): DailyContentRow {
  return {
    id,
    content_type: contentType,
    title,
    description,
    detail_text: null,
    timing_guidance: null,
    source_label: null,
    source_url: null,
    condition_tags: [pillar],
    pillar_tag: pillar,
    time_of_day: moment,
    moment,
    language: "en",
    rotation_weight: rotationWeight,
  };
}

const fivePillarDailyContent: DailyContent = {
  ...emptyDailyContent,
  byPillar: {
    heart: [dailyRow("heart", "Tai chi", "A slow balance-friendly VYVA exercise for light movement, posture, and rhythm.")],
    brain: [dailyRow("brain", "Word recall challenge", "Study a few words, hide them, then see what you remember.")],
    strength: [dailyRow("strength", "Clear one walking path", "One clear route at home makes movement easier and steadier.")],
    nourishment: [dailyRow("nourishment", "Protein with the next meal", "Choose one familiar protein food so nourishment does not become complicated.")],
    calm: [dailyRow("calm", "Same bedtime tonight", "A familiar evening time supports tomorrow's energy and attention.")],
  },
};

describe("longevity companion payload", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@127.0.0.1:1/vyva_test";
    ({ composeLongevityCompanionPayload, buildFallbackLongevityProgramLayer, activeLongevityMoment, longevityMomentForHour } = await import("../server/routes/healthInsightsReport.js"));
  }, 90000);

  it("selects the active moment from the user's timezone", () => {
    expect(longevityMomentForHour(5)).toBe("morning");
    expect(longevityMomentForHour(11)).toBe("midday");
    expect(longevityMomentForHour(14)).toBe("afternoon");
    expect(longevityMomentForHour(23)).toBe("evening");
    expect(activeLongevityMoment("Europe/Madrid", new Date("2026-09-04T07:00:00.000Z"))).toBe("morning");
    expect(activeLongevityMoment("Europe/Madrid", new Date("2026-09-04T10:30:00.000Z"))).toBe("midday");
    expect(activeLongevityMoment("America/New_York", new Date("2026-09-04T22:30:00.000Z"))).toBe("evening");
  });

  it("returns a guided daily session while keeping five compatibility pillar actions", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: ["memory support"],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 0, accuracy_trend: "stable" },
      mood: { check_ins_logged: 2, poor_sleep_count: 1, trend: "stable" },
      symptoms: null,
      dailyContent: fivePillarDailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });

    expect(Object.keys(payload.pillarActions).sort()).toEqual(["brain", "calm", "heart", "nourishment", "strength"]);
    for (const action of Object.values(payload.pillarActions)) {
      expect(action.resource_url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+$/);
      expect(action.resource_title).toBeTruthy();
    }
    expect(payload.primaryAction).toEqual(payload.pillarActions.brain);
    expect(payload.primaryAction.title).toBe("Word recall challenge");
    expect(payload.pillarActions.heart.route).toBe("/social-rooms/morning-movement/exercises/tai-chi");
    expect(payload.activeMoment).toBe("afternoon");
    expect(payload.currentMomentSession.moment).toBe("afternoon");
    expect(payload.todayTimeline.map((item) => item.moment)).toEqual(["morning", "midday", "afternoon", "evening"]);
    expect(payload.todayTimeline.find((item) => item.moment === "afternoon")?.status).toBe("now");
    expect(payload.nextMomentPreview?.moment).toBe("evening");
    expect(payload.dailySession.sessionFocus).toBe("Karim, make the afternoon mentally engaging.");
    expect(payload.dailySession.primaryExperience.kind).toBe("video");
    expect(payload.dailySession.primaryExperience.video?.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+$/);
    expect(payload.dailySession.companionAction.title).toBe("Word recall challenge");
    expect(payload.dailySession.optionalChoices).toHaveLength(0);
    expect(payload.dailySession.coveredPillars.map((item) => item.pillar).sort()).toEqual(["brain", "calm", "heart", "nourishment", "strength"]);
    expect(payload.careSummary.bullets).toEqual(expect.arrayContaining([
      "Today: Karim, make the afternoon mentally engaging.",
      "Companion step: Word recall challenge.",
      "Health areas considered: Heart and circulation; Brain and memory; Strength and stability; Nourishment; Calm and recovery.",
    ]));
  });

  it("uses reviewed videos in the user's profile language when available", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "es", timezone: "Europe/Madrid" },
      conditions: ["memory support"],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 0, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent: fivePillarDailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });

    expect(payload.pillarActions.brain.resource_url).toBe("https://www.youtube.com/watch?v=2XVQctv5WzQ");
    expect(payload.pillarActions.heart.resource_url).toBe("https://www.youtube.com/watch?v=pEki37hCX9s");
    expect(payload.pillarActions.strength.resource_url).toBe("https://www.youtube.com/watch?v=M0Jh5tLQRE0");
    expect(payload.todayVideo?.language).toBe("es");
    expect(payload.todayVideo?.url).toBe("https://www.youtube.com/watch?v=2XVQctv5WzQ");
    expect(payload.dailySession.primaryExperience.video?.language).toBe("es");
  });

  it("uses reviewed French videos for a French profile when available", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "fr", timezone: "Europe/Madrid" },
      conditions: ["memory support"],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 0, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent: fivePillarDailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });

    expect(payload.pillarActions.brain.resource_url).toBe("https://www.youtube.com/watch?v=Uplih5Mx1uw");
    expect(payload.pillarActions.heart.resource_url).toBe("https://www.youtube.com/watch?v=OBn81SkwFtk");
    expect(payload.pillarActions.strength.resource_url).toBe("https://www.youtube.com/watch?v=XOYqccktGxQ");
    expect(payload.todayVideo?.language).toBe("fr");
    expect(payload.todayVideo?.url).toBe("https://www.youtube.com/watch?v=Uplih5Mx1uw");
    expect(payload.dailySession.primaryExperience.video?.language).toBe("fr");
  });

  it("falls back to reviewed English videos when the profile language has no approved video set", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "de", timezone: "Europe/Madrid" },
      conditions: ["memory support"],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 0, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent: fivePillarDailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });

    expect(payload.pillarActions.brain.resource_url).toBe("https://www.youtube.com/watch?v=hoPg4bkKemQ");
    expect(payload.todayVideo?.language).toBe("en");
    expect(payload.dailySession.primaryExperience.video?.language).toBe("en");
  });

  it("changes the current session when the local day moves to another moment", () => {
    const momentContent: DailyContent = {
      ...emptyDailyContent,
      byPillar: {
        heart: [dailyRow("heart", "Tai chi balance break", "A VYVA movement session fits the afternoon.", "heart-afternoon", 5, "exercise", "afternoon")],
        brain: [dailyRow("brain", "Chess scan", "A short planning puzzle fits the afternoon.", "brain-afternoon", 4, "tip", "afternoon")],
        strength: [dailyRow("strength", "Sit-to-stand once", "One controlled chair movement fits the afternoon.", "strength-afternoon", 3, "exercise", "afternoon")],
        nourishment: [dailyRow("nourishment", "Breakfast protein anchor", "A familiar protein fits the morning.", "nourishment-morning", 5, "meal", "morning")],
        calm: [dailyRow("calm", "Two-minute breath garden", "A quiet reset fits the evening.", "calm-evening", 5, "tip", "evening")],
      },
    };
    const baseInput = {
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent: momentContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
    };

    const morning = composeLongevityCompanionPayload({ ...baseInput, activeMoment: "morning" });
    const afternoon = composeLongevityCompanionPayload({ ...baseInput, activeMoment: "afternoon" });

    expect(morning.currentMomentSession.moment).toBe("morning");
    expect(afternoon.currentMomentSession.moment).toBe("afternoon");
    expect(morning.primaryAction.title).toBe("Breakfast protein anchor");
    expect(afternoon.primaryAction.title).not.toBe(morning.primaryAction.title);
    expect(afternoon.todayTimeline.find((item) => item.moment === "evening")?.status).toBe("later");
  });

  it("includes the active program, today's step, and an exact curated video URL", () => {
    const programLayer = buildFallbackLongevityProgramLayer({
      userId,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      plan: basePlan,
      feedbackHistory: [],
      startDate: "2026-08-31",
      rotationDate: "2026-08-31",
    });
    const payload = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: ["memory support"],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 0, accuracy_trend: "stable" },
      mood: { check_ins_logged: 2, poor_sleep_count: 1, trend: "stable" },
      symptoms: null,
      dailyContent: fivePillarDailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
      programLayer,
    });

    expect(payload.activeProgram?.programKey).toBe("starter_video_longevity_v1");
    expect(payload.todayProgramStep?.dayIndex).toBe(1);
    expect(payload.todayVideo?.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+$/);
    expect(payload.todayVideo?.url).not.toContain("/results");
    expect(payload.todayVideo?.url).not.toContain("/@");
    expect(payload.videoCurationStatus).toBe("fallback");
    expect(payload.todayVideo?.transcriptStatus).toBe("manual_reviewed");
    expect(payload.todayVideo?.seniorTakeaway).toContain("choose one brain-friendly food");
    expect(payload.todayVideo?.transcriptSummary).toContain("food choices can support brain health");
    expect(payload.todayVideo?.afterWatchAction).toContain("memory");
    expect(payload.todayVideo?.goodFor.length).toBeGreaterThan(0);
    expect(payload.todayVideo?.notFor.length).toBeGreaterThan(0);
    expect(payload.todayVideo?.momentFit).toContain("afternoon");
    expect(payload.todayVideo?.keyPoints).toEqual(expect.arrayContaining([
      "Brain-friendly eating works best as a simple pattern, not a perfect rule.",
    ]));
    expect(payload.primaryAction.source).toBe("program");
    expect(payload.primaryAction.title).toBe(programLayer.todayProgramStep.actionTitle);
    expect(payload.primaryAction.route).toBeNull();
    expect(payload.primaryAction.challenge?.kind).toBe("memory_prompt");
    expect(payload.primaryAction.challenge?.prompt).toContain("Name 3 things");
    expect(payload.primaryAction.gameOptions?.map((option) => option.label)).toEqual(["Memory", "Words", "Riddle", "Chess"]);
    expect(payload.primaryAction.prompt).toContain(payload.todayVideo?.title ?? "");
    expect(payload.activeMoment).toBe("afternoon");
    expect(payload.currentMomentSession.primaryExperience.video?.url).toBe(payload.todayVideo?.url);
    expect(payload.todayTimeline).toHaveLength(4);
    expect(payload.dailySession.sessionFocus).toBe("Karim, make the afternoon mentally engaging.");
    expect(payload.dailySession.primaryExperience.kind).toBe("video");
    expect(payload.dailySession.primaryExperience.video?.url).toBe(payload.todayVideo?.url);
    expect(payload.dailySession.companionAction.title).toBe("3-2-1 memory lane");
    expect(payload.dailySession.optionalChoices).toHaveLength(0);
    expect(payload.careSummary.bullets).toEqual(expect.arrayContaining([
      "Today: Karim, make the afternoon mentally engaging.",
      "Program day 1: Memory starter.",
      "Companion step: 3-2-1 memory lane.",
    ]));
  });

  it("keeps the same user and local date on the same fallback video", () => {
    const input = {
      userId,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      plan: basePlan,
      feedbackHistory: [],
      startDate: "2026-08-31",
      rotationDate: "2026-08-31",
    };

    const first = buildFallbackLongevityProgramLayer(input);
    const second = buildFallbackLongevityProgramLayer(input);

    expect(first.todayProgramStep.dayIndex).toBe(1);
    expect(second.todayProgramStep.dayIndex).toBe(1);
    expect(first.todayVideo?.url).toBe(second.todayVideo?.url);
  });

  it("rotates to the next program step on the next local date", () => {
    const dayOne = buildFallbackLongevityProgramLayer({
      userId,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      plan: basePlan,
      feedbackHistory: [],
      startDate: "2026-08-31",
      rotationDate: "2026-08-31",
    });
    const dayTwo = buildFallbackLongevityProgramLayer({
      userId,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      plan: basePlan,
      feedbackHistory: [],
      startDate: "2026-08-31",
      rotationDate: "2026-09-01",
    });

    expect(dayOne.todayProgramStep.dayIndex).toBe(1);
    expect(dayTwo.todayProgramStep.dayIndex).toBe(2);
    expect(dayTwo.todayVideo?.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
    expect(dayTwo.todayVideo?.url).not.toBe(dayOne.todayVideo?.url);
  });

  it("suppresses a rejected curated video from fallback selection", () => {
    const feedbackHistory: FeedbackHistory = [{
      action_key: "video:hoPg4bkKemQ",
      action_title: "Mayo Clinic Minute: Can the MIND diet improve brain health?",
      event_type: "not_relevant",
      pillar: "brain",
      barrier: null,
      source_context: { videoId: "hoPg4bkKemQ" },
      created_at: new Date().toISOString(),
    }];

    const programLayer = buildFallbackLongevityProgramLayer({
      userId,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      plan: basePlan,
      feedbackHistory,
      startDate: "2026-08-31",
      rotationDate: "2026-08-31",
    });

    expect(programLayer.todayVideo?.videoId).not.toBe("hoPg4bkKemQ");
    expect(programLayer.todayVideo?.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
  });

  it("turns recent user signals into a specific why-today explanation", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: ["memory support"],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 0, accuracy_trend: "stable" },
      mood: { check_ins_logged: 2, poor_sleep_count: 1, trend: "stable" },
      symptoms: null,
      dailyContent: emptyDailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });

    expect(payload.todayFocus.headline).toBe("Karim, make the afternoon mentally engaging.");
    expect(payload.whyToday).toContain("Afternoon fits because no recent Brain Coach sessions are logged");
    expect(payload.signalsUsed.map((signal) => signal.label)).toContain("Brain Coach");
    expect(payload.primaryAction.prompt).toContain("no recent Brain Coach sessions are logged");
  });

  it("rotates each pillar from its own content pool deterministically by date", () => {
    const dailyContent: DailyContent = {
      ...emptyDailyContent,
      byPillar: {
        heart: [
          dailyRow("heart", "Heart option A", "First heart option.", "heart-a"),
          dailyRow("heart", "Heart option B", "Second heart option.", "heart-b"),
        ],
        brain: [
          dailyRow("brain", "Brain option A", "First brain option.", "brain-a"),
          dailyRow("brain", "Brain option B", "Second brain option.", "brain-b"),
        ],
        strength: [dailyRow("strength", "Strength option A", "Strength option.", "strength-a")],
        nourishment: [dailyRow("nourishment", "Nourishment option A", "Nourishment option.", "nourishment-a")],
        calm: [dailyRow("calm", "Calm option A", "Calm option.", "calm-a")],
      },
    };

    const payloadA = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });
    const payloadB = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });

    expect(payloadA.pillarActions.heart.title).toBe(payloadB.pillarActions.heart.title);
    expect(["Heart option A", "Heart option B"]).toContain(payloadA.pillarActions.heart.title);
    expect(["Brain option A", "Brain option B"]).toContain(payloadA.pillarActions.brain.title);
    expect(payloadA.pillarActions.strength.title).toBe("Strength option A");
    expect(payloadA.pillarActions.nourishment.title).toBe("Nourishment option A");
    expect(payloadA.pillarActions.calm.title).toBe("Calm option A");
  });

  it("removes near-duplicate optional choices from the guided session", () => {
    const payload = composeLongevityCompanionPayload({
      plan: {
        ...basePlan,
        pillar_brain: "steady",
        pillar_nourishment: "priority_focus",
        priority_pillar: "nourishment",
        priority_intervention: "Protein with the next meal",
        priority_why: "Protein support is the clearest nourishment step today.",
      },
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent: {
        ...fivePillarDailyContent,
        byPillar: {
          ...fivePillarDailyContent.byPillar,
          nourishment: [
            dailyRow("nourishment", "Protein with the next meal", "Choose one familiar protein food."),
            dailyRow("nourishment", "Protein at breakfast", "A simple protein choice keeps the food step clear."),
          ],
        },
      },
      feedbackHistory: [],
      rotationDate: "2026-08-31",
      activeMoment: "morning",
    });

    expect(payload.dailySession.primaryExperience.kind).toBe("video");
    expect(payload.dailySession.primaryExperience.video?.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+$/);
    expect(payload.dailySession.primaryExperience.action.title).toContain("Protein");
    expect(payload.dailySession.companionAction.title).toBe(payload.dailySession.primaryExperience.action.title);
    expect(payload.dailySession.optionalChoices).toHaveLength(0);
  });

  it("suppresses actions recently marked not relevant", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent: {
        ...emptyDailyContent,
        byPillar: {
          ...emptyDailyContent.byPillar,
          brain: [
            dailyRow("brain", "Word recall challenge", "Study a few words, hide them, then see what you remember."),
            dailyRow("brain", "Call someone you enjoy", "A warm conversation supports memory, mood, and routine."),
          ],
        },
      },
      feedbackHistory: [{
        action_key: "brain:word-recall-challenge",
        action_title: "Word recall challenge",
        event_type: "not_relevant",
        pillar: "brain",
        barrier: null,
        source_context: {},
        created_at: new Date().toISOString(),
      }],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });

    expect(payload.primaryAction.title).toBe("Call someone you enjoy");
    expect(payload.signalsUsed.map((signal) => signal.label)).toContain("Your feedback");
  });

  it("uses an easier per-pillar action after too-hard feedback", () => {
    const payload = composeLongevityCompanionPayload({
      plan: { ...basePlan, priority_pillar: "strength", pillar_brain: "steady", pillar_strength: "priority_focus" },
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: null,
      mood: null,
      symptoms: null,
      dailyContent: fivePillarDailyContent,
      feedbackHistory: [{
        action_key: "strength:clear-one-walking-path",
        action_title: "Clear one walking path",
        event_type: "too_hard",
        pillar: "strength",
        barrier: null,
        source_context: {},
        created_at: new Date().toISOString(),
      }],
      rotationDate: "2026-08-31",
      activeMoment: "afternoon",
    });

    expect(payload.primaryAction.title).toBe("Make the movement step smaller");
    expect(payload.primaryAction.source).toBe("feedback_memory");
  });
});
