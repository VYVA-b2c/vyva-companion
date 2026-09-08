import { expect, test, type Page, type Route } from "@playwright/test";

const futureToken = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
  btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 })),
  "signature",
].join(".");

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
];

type ResponsiveSession = {
  signedIn: boolean;
  role: "user" | "admin";
  onboardingStage: string;
};

type ExpectedLayout = "compact" | "wide" | "vitals" | "fullscreen";

type ResponsiveRoute = {
  name: string;
  path: string;
  expectedLayout?: ExpectedLayout;
  requiresInteractive?: boolean;
  minTextLength?: number;
  role?: "user" | "admin";
  onboardingStage?: string;
};

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function readyServices() {
  return {
    medications: { ready: true, missing: [] },
    adherenceReport: { ready: true, missing: [] },
    medicationReminders: { ready: true, missing: [] },
    medicationInteractions: { ready: true, missing: [] },
    sos: { ready: true, missing: [] },
    doctor: { ready: true, missing: [] },
    localServices: { ready: true, missing: [] },
    specialistFinder: { ready: true, missing: [] },
    reports: { ready: true, missing: [] },
    concierge: { ready: true, missing: [] },
    symptomCheck: { ready: true, missing: [] },
    caregiverDashboard: { ready: true, missing: [] },
    socialRooms: { ready: true, missing: [] },
    activities: { ready: true, missing: [] },
    brainTraining: { ready: true, missing: [] },
    chat: { ready: true, missing: [] },
  };
}

function profileFixture() {
  return {
    firstName: "Rosa",
    lastName: "Martinez",
    email: "rosa@example.com",
    phone: "+34 600 100 200",
    country: "ES",
    timezone: "Europe/Madrid",
    language: "en",
    street: "Calle Mayor 1",
    cityState: "Madrid",
    postalCode: "28013",
    caregiverName: "Ana",
    caregiverContact: "+34 600 300 400",
    gpName: "Dr Garcia",
    gpPhone: "+34 600 500 600",
    gpEmail: "gp@example.com",
  };
}

function onboardingState(stage: string) {
  return {
    account: { role: "user" },
    profile: {
      current_stage: stage,
      first_name: "Rosa",
      last_name: "Martinez",
      conditions: [{ name: "Hypertension", category: "heart" }],
      health_conditions: ["Hypertension"],
      medications: [{ medication_name: "Amlodipine", dosage: "5mg", frequency: "daily" }],
      known_allergies: [],
      gp: { name: "Dr Garcia", phone: "+34 600 500 600" },
      emergency_contact: { name: "Ana", primary_phone: "+34 600 300 400" },
      elder_confirmed_at: new Date().toISOString(),
    },
    onboardingState: { current_stage: stage },
  };
}

function triageReport() {
  return {
    id: "triage-smoke",
    chief_complaint: "Mild headache",
    symptoms: ["Headache"],
    urgency: "monitor",
    recommendations: ["Rest, drink water, and monitor changes."],
    disclaimer: "Informational only.",
    ai_summary: "Mild symptoms without red flags in this smoke fixture.",
    next_step_label: "Monitor at home",
    next_step_level: "monitor",
    triage_reasons: ["No severe symptoms reported."],
    watch_signs: ["New weakness", "Chest pain"],
    profile_considerations: ["Hypertension history"],
    vitals_notes: ["Pulse in usual range"],
    bpm: 72,
    respiratory_rate: 16,
    duration_seconds: 180,
    created_at: new Date().toISOString(),
  };
}

function reportsSummary() {
  return {
    latestTriage: triageReport(),
    latestVitals: {
      id: "vitals-1",
      bpm: 72,
      respiratory_rate: 16,
      recorded_at: new Date().toISOString(),
    },
    latestSignals: [
      {
        signal_type: "resting_hr_bpm",
        value: 72,
        recorded_at: new Date().toISOString(),
        source: "manual",
        context_tag: null,
      },
    ],
    todayMeds: { taken: 1, total: 2, adherencePct: 50 },
  };
}

function vitalsResponse() {
  const recordedAt = new Date().toISOString();
  const entry = (value: string) => ({
    latest_value: value,
    latest_recorded_at: recordedAt,
    latest_source: "manual",
    latest_source_confidence: "observed",
    latest_source_confidence_reason: "Smoke fixture",
    latest_source_display_label: "Manual entry",
    latest_source_context_label: null,
    trend: [value, value, value],
    has_data: true,
  });

  return {
    summary: {
      hr: entry("72"),
      rr: entry("16"),
      bp: entry("118/76"),
    },
    compliance_days: [true, true, false, true, false, true, true],
  };
}

function adherenceReport() {
  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });

  return {
    hasLogs: true,
    weekPct: 82,
    monthPct: 78,
    sevenDayDates: dates,
    perMedication: [
      {
        name: "Amlodipine",
        dosage: "5mg",
        taken: 6,
        scheduled: 7,
        streak: 4,
        dailyStatus: dates.map((_, index) => (index === 1 ? "missed" : "taken")),
      },
    ],
  };
}

function todayMeds() {
  return {
    medications: [
      {
        id: "med-1",
        medication_name: "Amlodipine",
        dosage: "5mg",
        frequency: "daily",
        scheduled_times: ["09:00"],
        takenToday: false,
        takenCountToday: 0,
        scheduledCountToday: 1,
      },
    ],
  };
}

function activitySummary() {
  return {
    entries: [],
    total_active_minutes: 25,
    total_calories: 90,
    today_steps: 3200,
  };
}

function dailyPlan() {
  return {
    planId: "plan-smoke",
    status: "active",
    estimatedDurationMinutes: 15,
    recommendedDomains: ["memory", "attention"],
    activities: [
      {
        planItemId: "item-1",
        activityType: "memory",
        title: "Gentle word recall",
        domain: "memory",
        route: "/memory-games",
        estimatedDurationMinutes: 5,
        rationale: "A short memory warm-up.",
        status: "recommended",
        completedToday: false,
      },
    ],
    rationale: ["Keep practice short and varied."],
    completion: { completedCount: 0, totalCount: 1, allComplete: false },
    caregiverNudge: null,
    preferences: { trainingTime: "morning", sessionLengthMins: 15 },
  };
}

function linkedProfiles() {
  return {
    activeProfileId: "profile-rosa",
    needsProfileSetup: false,
    needsProfileSelection: true,
    profiles: [
      {
        profileId: "profile-rosa",
        role: "elder",
        relationship: null,
        displayName: "Rosa Martinez",
        fullName: "Rosa Martinez",
        preferredName: "Rosa",
        avatarUrl: null,
        isPrimary: true,
      },
      {
        profileId: "profile-ana",
        role: "caregiver",
        relationship: "Daughter",
        displayName: "Ana Martinez",
        fullName: "Ana Martinez",
        preferredName: "Ana",
        avatarUrl: null,
        isPrimary: false,
      },
    ],
  };
}

function caregiverAlerts() {
  return {
    alerts: [
      {
        id: "alert-1",
        alert_type: "daily_checkin_no_response",
        severity: "info",
        message: "Rosa missed today's check-in.",
        sent_to: ["Ana"],
        resolved_at: null,
        created_at: new Date().toISOString(),
      },
    ],
    latest_analysis: {
      safety_status: "recheck",
      recommended_action: "recheck",
      senior_message: "Please check in when you can.",
      caregiver_note: "A gentle follow-up is recommended.",
      risk_score: 2,
      risk_tier: "low",
      acknowledged_action: null,
      acknowledged_at: null,
      analysed_at: new Date().toISOString(),
    },
  };
}

function checkinToday() {
  return {
    status: "completed",
    date_key: new Date().toISOString().slice(0, 10),
    timezone: "Europe/Madrid",
    schedule: {
      id: "schedule-1",
      active: true,
      times_of_day: ["10:00"],
      next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      last_completed_at: new Date().toISOString(),
      grace_minutes: 60,
    },
    latest_checkin: {
      id: "checkin-1",
      completed_at: new Date().toISOString(),
      feeling_label: "Steady",
      overall_state: "good",
      highlight: "Had a calm morning.",
    },
    no_response: {
      overdue: false,
      minutes_overdue: null,
      alert_created: false,
      can_alert_caregiver: false,
      reason: null,
    },
    message: "Rosa checked in today.",
    action_label: "View history",
  };
}

function sharedCheckinReport() {
  return {
    report: {
      name: "Rosa",
      language: "en",
      result: {
        feeling_label: "A little tired",
        overall_state: "moderate",
        vyva_reading: "Rosa may benefit from a quiet afternoon and extra fluids.",
        why_today: "Energy is lower than usual.",
        personal_plan: "Rest, hydrate, and check in again later.",
        app_suggestion: "Consider a gentle caregiver call.",
        right_now: ["Drink water", "Sit somewhere comfortable"],
        today_actions: ["Keep plans simple", "Call Ana if symptoms change"],
        highlight: "No urgent issue in this fixture.",
      },
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function roomFixture(slug: string) {
  const names: Record<string, string> = {
    "games-room": "Games table",
    "music-room": "Music memories",
    "reading-room": "Reading room",
    "together-room": "Together room",
  };
  const topics: Record<string, string> = {
    "games-room": "Play a gentle puzzle with others.",
    "music-room": "Share a song that brings back a memory.",
    "reading-room": "Talk about a short story together.",
    "together-room": "Plan a quiet shared moment.",
  };

  return {
    slug,
    name: names[slug] ?? "Social room",
    category: "social",
    agentSlug: "maya",
    agentFullName: "Maya",
    agentColour: "#6D28D9",
    agentCredential: "VYVA host",
    ctaLabel: "Enter room",
    topicTags: ["gentle", "friendly"],
    timeSlots: ["morning", "afternoon"],
    featured: true,
    participantCount: 8,
    sessionDate: new Date().toISOString(),
    topic: topics[slug] ?? "A friendly room for conversation.",
    opener: "Come in for a few calm minutes.",
    quote: "Small moments count.",
    activityType: slug === "games-room" ? "game" : "discussion",
    contentTag: "Live now",
    contentTitle: topics[slug] ?? "A friendly room for conversation.",
    contentBody: "This lightweight fixture gives the room enough content for responsive smoke coverage.",
    options: ["Say hello", "Listen first", "Join later"],
    liveBadge: "Live",
    heroScore: 10,
  };
}

function socialHub() {
  const rooms = ["games-room", "music-room", "reading-room", "together-room"].map(roomFixture);
  return {
    user: { id: "user-responsive", firstName: "Rosa", language: "en" },
    timeSlot: "morning",
    activeCount: rooms.length,
    interestTags: ["music", "reading", "games"],
    lastRooms: ["music-room"],
    heroRooms: rooms,
    alsoForYou: rooms,
    listRooms: rooms,
  };
}

function socialRoom(slug: string) {
  const room = roomFixture(slug);
  return {
    room,
    transcript: [
      { id: "t1", speaker: "agent", text: room.opener, createdAt: new Date().toISOString() },
      { id: "t2", speaker: "user", text: "That sounds nice.", createdAt: new Date().toISOString() },
    ],
    promptChips: ["Say hello", "Listen for now", "Find a match"],
    members: [
      { id: "member-1", name: "Rosa", sharedTopic: "music", statusLabel: "Here now" },
      { id: "member-2", name: "Marta", sharedTopic: "reading", statusLabel: "Open to chat" },
    ],
    memberChat: [
      {
        id: "chat-1",
        authorId: "member-2",
        authorName: "Marta",
        text: "Welcome to the room.",
        createdAt: new Date().toISOString(),
        connectable: true,
      },
    ],
    visitState: { isFirstVisit: false, visitCount: 2, previousVisitCount: 1 },
    conversationContext: {
      generatedAt: new Date().toISOString(),
      lines: ["Responsive smoke fixture"],
      text: "Responsive smoke fixture",
    },
  };
}

function adminLifecycleResponse(pathname: string) {
  if (pathname.endsWith("/schema-health")) {
    return { ok: true, status: "ok", missing: [], error: null };
  }
  if (pathname.endsWith("/summary")) {
    return { activeUsers: 1, pendingIntakes: 0, totalOrganizations: 1 };
  }
  if (pathname.includes("/users")) {
    return { users: [] };
  }
  if (pathname.endsWith("/organizations")) {
    return { organizations: [] };
  }
  if (pathname.endsWith("/consent")) {
    return { attempts: [] };
  }
  if (pathname.endsWith("/communications")) {
    return { communications: [], provider_status: [] };
  }
  if (pathname.endsWith("/plans")) {
    return { plans: [] };
  }
  return {};
}

async function installApi(page: Page, session: ResponsiveSession) {
  await page.route("https://freeipapi.com/api/json/", async (route) => {
    await fulfillJson(route, 200, { countryCode: "ES" });
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path === "/api/auth/me") {
      if (!session.signedIn) {
        await fulfillJson(route, 401, { error: "Not signed in" });
        return;
      }

      await fulfillJson(route, 200, {
        id: "user-responsive",
        email: session.role === "admin" ? "admin@example.com" : "responsive@example.com",
        phone: null,
        language: "en",
        activeProfileId: "profile-rosa",
        role: session.role,
      });
      return;
    }

    if (path === "/api/auth/access-link/consume") {
      await fulfillJson(route, 400, { error: "This access link is only a responsive smoke fixture." });
      return;
    }

    if (/^\/api\/auth\/careteam-invites\/[^/]+$/.test(path)) {
      await fulfillJson(route, 200, {
        invite: {
          status: "pending",
          canAccept: true,
          seniorDisplayName: "Rosa",
          inviteeName: "Ana",
          role: "caregiver",
          relationship: "Daughter",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          acceptedAt: null,
          requestedPermissions: {
            dailyDigest: true,
            safetyAlerts: true,
            healthReports: true,
          },
        },
      });
      return;
    }

    if (/^\/api\/auth\/careteam-invites\/[^/]+\/accept$/.test(path)) {
      await fulfillJson(route, 200, { destination: "/caregiver" });
      return;
    }

    if (/^\/api\/onboarding\/confirm\/[^/]+$/.test(path)) {
      await fulfillJson(route, 200, method === "GET"
        ? { alreadyConfirmed: false, elderName: "Rosa", proxyName: "Ana" }
        : { ok: true });
      return;
    }

    if (/^\/api\/checkins\/shared\/[^/]+$/.test(path)) {
      await fulfillJson(route, 200, sharedCheckinReport());
      return;
    }

    if (path === "/api/profile") {
      await fulfillJson(route, 200, profileFixture());
      return;
    }

    if (path === "/api/profile/readiness") {
      await fulfillJson(route, 200, { profile: {}, services: readyServices() });
      return;
    }

    if (path === "/api/profile/linked-profiles") {
      await fulfillJson(route, 200, linkedProfiles());
      return;
    }

    if (path === "/api/profile/personalisation") {
      await fulfillJson(route, 200, { conditions: ["hypertension"], hobbies: ["music"], hasMedications: true });
      return;
    }

    if (path === "/api/profile/channel-preferences") {
      await fulfillJson(route, 200, { sms: true, whatsapp: true, email: true, push: false });
      return;
    }

    if (path === "/api/billing/status") {
      await fulfillJson(route, 200, {
        status: "active",
        tier: "premium",
        trial_days_remaining: 0,
        plan: { plan_id: "premium", name: "Premium" },
      });
      return;
    }

    if (path === "/api/billing/plans") {
      await fulfillJson(route, 200, { plans: [{ plan_id: "premium", name: "Premium", price_label: "Test plan" }] });
      return;
    }

    if (path === "/api/onboarding/state") {
      await fulfillJson(route, 200, onboardingState(session.onboardingStage));
      return;
    }

    if (path.startsWith("/api/onboarding/section/")) {
      await fulfillJson(route, 200, { profile: onboardingState(session.onboardingStage).profile });
      return;
    }

    if (path === "/api/onboarding/careteam" || path === "/api/onboarding/section/careteam") {
      await fulfillJson(route, 200, { members: [] });
      return;
    }

    if (path === "/api/weather" || path === "/api/weather/by-ip" || path === "/api/weather/by-coords") {
      await fulfillJson(route, 200, { city: "Madrid", temperature: 21, description: "Mild" });
      return;
    }

    if (path === "/api/reports/summary") {
      await fulfillJson(route, 200, reportsSummary());
      return;
    }

    if (path === "/api/reports/vitals/history") {
      await fulfillJson(route, 200, {
        readings: [
          { id: "reading-1", bpm: 72, respiratory_rate: 16, recorded_at: new Date().toISOString() },
        ],
        signalReadings: [],
      });
      return;
    }

    if (/^\/api\/reports\/triage\/[^/]+$/.test(path)) {
      await fulfillJson(route, 200, triageReport());
      return;
    }

    if (path === "/api/meds/adherence-report/today") {
      await fulfillJson(route, 200, todayMeds());
      return;
    }

    if (path === "/api/meds/adherence-report") {
      await fulfillJson(route, 200, adherenceReport());
      return;
    }

    if (path === "/api/vitals") {
      await fulfillJson(route, 200, vitalsResponse());
      return;
    }

    if (path === "/api/checkins/today") {
      await fulfillJson(route, 200, checkinToday());
      return;
    }

    if (path === "/api/wound-scan/history" || path === "/api/home-scan/history" || path === "/api/home-scan") {
      await fulfillJson(route, 200, []);
      return;
    }

    if (path === "/api/scam-check") {
      await fulfillJson(route, 200, []);
      return;
    }

    if (path === "/api/activity") {
      await fulfillJson(route, 200, activitySummary());
      return;
    }

    if (path === "/api/history/scans") {
      await fulfillJson(route, 200, []);
      return;
    }

    if (path === "/api/games/progress") {
      await fulfillJson(route, 200, {
        summary: { streakDays: 3, lastPlayedAt: new Date().toISOString() },
        today: { completedCount: 0, activityTypes: [] },
      });
      return;
    }

    if (path === "/api/games/daily-plan") {
      await fulfillJson(route, 200, dailyPlan());
      return;
    }

    if (path === "/api/concierge/actions/pending") {
      await fulfillJson(route, 200, { actions: [] });
      return;
    }

    if (path === "/api/concierge/notifications") {
      await fulfillJson(route, 200, { items: [], unreadCount: 0 });
      return;
    }

    if (/^\/api\/concierge\/notifications\/[^/]+\/read$/.test(path)) {
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (path === "/api/concierge/shopping/support-packages") {
      await fulfillJson(route, 200, { packages: [] });
      return;
    }

    if (path === "/api/concierge/shopping/recommendations") {
      await fulfillJson(route, 200, {
        querySummary: "Responsive fixture recommendations.",
        recommendations: [],
        comparison: { summary: "No purchase needed in this smoke fixture.", differences: [], bestFor: [] },
        uncertaintyNote: "Fixture only.",
        nextQuestions: [],
      });
      return;
    }

    if (path === "/api/companions/social-status") {
      await fulfillJson(route, 200, { social_enabled: true });
      return;
    }

    if (path === "/api/companions/profile") {
      await fulfillJson(route, 200, {
        id: "companion-profile-1",
        user_id: "user-responsive",
        interests: ["gardening", "music"],
        hobbies: ["reading"],
        values: ["friendship"],
        preferred_activities: ["chat_together"],
      });
      return;
    }

    if (path === "/api/companions/suggestions") {
      await fulfillJson(route, 200, []);
      return;
    }

    if (path === "/api/companions/connections") {
      await fulfillJson(route, 200, { accepted: [], pending: [] });
      return;
    }

    if (path === "/api/vitals-engine/caregiver/latest-alerts") {
      await fulfillJson(route, 200, caregiverAlerts());
      return;
    }

    if (path === "/api/social/hub") {
      await fulfillJson(route, 200, socialHub());
      return;
    }

    if (/^\/api\/social\/rooms\/[^/]+$/.test(path)) {
      const slug = decodeURIComponent(path.split("/").pop() ?? "music-room");
      await fulfillJson(route, 200, socialRoom(slug));
      return;
    }

    if (/^\/api\/social\/rooms\/[^/]+\/pulse$/.test(path)) {
      await fulfillJson(route, 200, { pulse: undefined });
      return;
    }

    if (path.startsWith("/api/social/rooms/")) {
      await fulfillJson(route, 200, {
        ok: true,
        agentMessage: "Responsive smoke fixture completed the social action.",
        noMatch: true,
        sharedTopics: [],
      });
      return;
    }

    if (path.startsWith("/api/admin/lifecycle")) {
      await fulfillJson(route, 200, adminLifecycleResponse(path));
      return;
    }

    if (method === "GET") {
      await fulfillJson(route, 200, {});
      return;
    }

    await fulfillJson(route, 200, { ok: true });
  });
}

function attachConsoleRecorder(page: Page) {
  const messages: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    messages.push(`pageerror: ${error.message}`);
  });

  return {
    clear: () => {
      messages.length = 0;
    },
    relevant: () => messages.filter((message) => !isIgnoredConsoleMessage(message)),
    assertClean: () => {
      const relevant = messages.filter((message) => !isIgnoredConsoleMessage(message));
      expect(relevant).toEqual([]);
    },
  };
}

function isIgnoredConsoleMessage(message: string) {
  return [
    "React Router Future Flag Warning",
    "Download the React DevTools",
    "ResizeObserver loop",
    "Failed to load resource: the server responded with a status of 401",
    "Failed to load resource: the server responded with a status of 400",
    "[VYVA] Token fetch failed",
    "[VYVA] Failed to start session",
    "no URL or token",
    "[VYVA Admin] Could not load lifecycle",
  ].some((ignored) => message.includes(ignored));
}

async function expectResponsiveRoute(
  page: Page,
  route: ResponsiveRoute,
  viewport: { width: number; height: number },
  relevantConsoleMessages: () => string[] = () => [],
) {
  await page.setViewportSize(viewport);
  await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 500 }).catch(() => undefined);
  await page.locator("#vyva-launch").waitFor({ state: "detached", timeout: 15_000 });

  const expectedShell = route.expectedLayout ? page.getByTestId("app-shell") : null;
  if (expectedShell) {
    await expect(expectedShell, `${route.path} should mount the app shell`).toBeVisible({ timeout: 60_000 });
  }

  await page
    .waitForFunction(() => (document.body.textContent ?? "").trim().length > 0, undefined, { timeout: 8000 })
    .catch(() => undefined);

  const audit = await page.evaluate(() => {
    const root = document.documentElement;
    const bodyText = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
    return {
      horizontalOverflow: root.scrollWidth - root.clientWidth,
      overflowingElements: Array.from(document.body.querySelectorAll("*"))
        .filter((element) => element.getBoundingClientRect().right > root.clientWidth + 1)
        .slice(-15)
        .map((element) => `${element.tagName}.${element.className}: ${Math.round(element.getBoundingClientRect().right)}`),
      textLength: bodyText.length,
      hasFrameworkOverlay: Boolean(
        document.querySelector(
          "vite-error-overlay,.vite-error-overlay,#webpack-dev-server-client-overlay,[data-nextjs-dialog-overlay]",
        ),
      ),
    };
  });

  expect(audit.hasFrameworkOverlay, `${route.path} should not show a framework error overlay`).toBe(false);
  expect(audit.horizontalOverflow, `${route.path} should not overflow horizontally at ${viewport.width}px: ${audit.overflowingElements.join("; ")}`).toBeLessThanOrEqual(1);
  expect(
    audit.textLength,
    `${route.path} should render meaningful content. Console: ${relevantConsoleMessages().join(" | ") || "none"}`,
  ).toBeGreaterThanOrEqual(route.minTextLength ?? 80);

  if (route.expectedLayout) {
    const shell = expectedShell ?? page.getByTestId("app-shell");
    await expect(shell).toHaveAttribute("data-layout", route.expectedLayout);
    const shellBox = await shell.boundingBox();
    expect(shellBox, `${route.path} app shell should have a measurable box`).not.toBeNull();

    if (viewport.width >= 1024 && route.expectedLayout === "wide") {
      expect(shellBox!.width).toBeGreaterThan(700);
      expect(shellBox!.width).toBeLessThanOrEqual(922);
    }

    if (viewport.width >= 768 && route.expectedLayout === "compact") {
      expect(shellBox!.width).toBeLessThanOrEqual(522);
    }

    if (viewport.width >= 768 && route.expectedLayout === "fullscreen") {
      expect(shellBox!.width).toBeGreaterThanOrEqual(viewport.width - 2);
      expect(shellBox!.width).toBeLessThanOrEqual(viewport.width);
    }
  }

  if (route.requiresInteractive ?? true) {
    const interactive = page.locator(
      "button:visible,a[href]:visible,input:visible,textarea:visible,select:visible,[role='button']:visible",
    );
    const firstControl = interactive.first();
    await firstControl.waitFor({ state: "visible", timeout: 5000 });
    await firstControl.scrollIntoViewIfNeeded();
    await expect(firstControl).toBeVisible();

    const centerIsReachable = await firstControl.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + Math.min(rect.width / 2, Math.max(1, rect.width - 1));
      const y = rect.top + Math.min(rect.height / 2, Math.max(1, rect.height - 1));
      const topElement = document.elementFromPoint(x, y);
      return topElement === element || Boolean(topElement && element.contains(topElement));
    });
    expect(centerIsReachable, `${route.path} primary control should not be covered`).toBe(true);
  }
}

async function runRoutes(page: Page, routes: ResponsiveRoute[], signedIn: boolean) {
  const session: ResponsiveSession = {
    signedIn,
    role: "user",
    onboardingStage: "complete",
  };

  if (signedIn) {
    await page.addInitScript((token) => {
      localStorage.setItem("vyva_auth_token", token);
    }, futureToken);
  }

  await installApi(page, session);
  const consoleRecorder = attachConsoleRecorder(page);

  for (const route of routes) {
    session.role = route.role ?? "user";
    session.signedIn = signedIn || session.role === "admin";
    session.onboardingStage = route.onboardingStage ?? "complete";

    for (const viewport of viewports) {
      await test.step(`${route.name} at ${viewport.width}x${viewport.height}`, async () => {
        consoleRecorder.clear();
        await expectResponsiveRoute(page, route, viewport, consoleRecorder.relevant);
        consoleRecorder.assertClean();
      });
    }
  }
}

const publicRoutes: ResponsiveRoute[] = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "admin login", path: "/admin/login" },
  { name: "invite", path: "/invite" },
  { name: "reset password", path: "/reset-password" },
  { name: "access link", path: "/access/test-token", requiresInteractive: false, minTextLength: 60 },
  { name: "care team invite", path: "/care-team/invite/test-token" },
  { name: "elder confirm", path: "/confirm/test-token" },
  { name: "shared check-in", path: "/shared/check-in/test-token", requiresInteractive: false },
];

const protectedCoreRoutes: ResponsiveRoute[] = [
  { name: "profile select", path: "/profiles/select" },
];

const protectedHealthRoutes: ResponsiveRoute[] = [
  { name: "vitals", path: "/health/vitals", expectedLayout: "vitals" },
  { name: "meds", path: "/meds", expectedLayout: "wide" },
  { name: "adherence report", path: "/meds/adherence-report", expectedLayout: "wide" },
  { name: "reports", path: "/informes", expectedLayout: "wide" },
  { name: "report detail", path: "/informes/triage-smoke", expectedLayout: "wide" },
];

const protectedUtilityRoutes: ResponsiveRoute[] = [
  { name: "mind memory", path: "/mind-memory", expectedLayout: "wide" },
  { name: "activity", path: "/activity", expectedLayout: "wide" },
  { name: "concierge", path: "/concierge", expectedLayout: "wide" },
  { name: "shopping helper", path: "/concierge/shopping", expectedLayout: "wide" },
  { name: "settings", path: "/settings", expectedLayout: "wide" },
  { name: "account settings", path: "/settings/account", expectedLayout: "wide" },
  { name: "notifications settings", path: "/settings/notifications", expectedLayout: "wide" },
  { name: "history", path: "/history", expectedLayout: "wide" },
  { name: "companions", path: "/companions", expectedLayout: "wide" },
  { name: "caregiver", path: "/caregiver" },
  { name: "safe home", path: "/safe-home", expectedLayout: "wide" },
  { name: "scam guard", path: "/scam-guard", expectedLayout: "wide" },
];

const protectedGameIndexRoutes: ResponsiveRoute[] = [
  { name: "learn something new", path: "/learn", expectedLayout: "wide" },
  { name: "attention boosters", path: "/attention-boosters", expectedLayout: "wide" },
  { name: "executive function", path: "/executive-function", expectedLayout: "wide" },
  { name: "memory games", path: "/memory-games", expectedLayout: "wide" },
];

const protectedRoutes = [
  ...protectedCoreRoutes,
  ...protectedHealthRoutes,
  ...protectedUtilityRoutes,
  ...protectedGameIndexRoutes,
];

const socialAndGameRoutes: ResponsiveRoute[] = [
  { name: "social hub", path: "/social-rooms", expectedLayout: "wide" },
  { name: "games room", path: "/social-rooms/games-room", expectedLayout: "wide", minTextLength: 60 },
  { name: "music room", path: "/social-rooms/music-room", expectedLayout: "wide" },
  { name: "reading room", path: "/social-rooms/reading-room", expectedLayout: "wide" },
  { name: "together room", path: "/social-rooms/together-room", expectedLayout: "wide" },
  { name: "chat", path: "/chat", expectedLayout: "fullscreen", minTextLength: 40 },
  { name: "rhythm tap", path: "/attention-boosters/rhythm-tap", expectedLayout: "fullscreen", minTextLength: 40 },
  {
    name: "memory runner",
    path: "/memory-games/word_recall?level=1&variant=word_recall-l1-v1",
    expectedLayout: "fullscreen",
    minTextLength: 40,
  },
  { name: "spatial navigator", path: "/spatial-navigator", expectedLayout: "fullscreen", minTextLength: 40 },
  { name: "face name match", path: "/face-name-match", expectedLayout: "fullscreen", minTextLength: 40 },
];

const adminRoutes: ResponsiveRoute[] = [
  { name: "admin lifecycle", path: "/admin/lifecycle", role: "admin", requiresInteractive: false, minTextLength: 50 },
  { name: "admin concierge readiness", path: "/admin/concierge-readiness", role: "admin", requiresInteractive: false, minTextLength: 80 },
];

test.describe("responsive route smoke", () => {
  test.describe.configure({ mode: "serial" });

  test("public and auth routes adapt across responsive viewports", async ({ page }) => {
    test.setTimeout(240_000);
    await runRoutes(page, publicRoutes, false);
  });

  test("protected app routes adapt across responsive viewports", async ({ page }) => {
    test.setTimeout(540_000);
    await runRoutes(page, protectedRoutes, true);
  });

  test("social rooms and focused game routes adapt across responsive viewports", async ({ page }) => {
    test.setTimeout(260_000);
    await runRoutes(page, socialAndGameRoutes, true);
  });

  test("admin workspace has basic responsive smoke coverage", async ({ page }) => {
    test.setTimeout(90_000);
    await runRoutes(page, adminRoutes, true);
  });
});
