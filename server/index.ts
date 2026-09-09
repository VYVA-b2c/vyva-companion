import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import "dotenv/config";
import { orchestratorRouterHandler } from "./orchestrator/orchestrator.js";
import { liveChatHandler } from "./routes/chat.js";
import { conversationReadinessHandler, conversationTokenHandler } from "./routes/conversationToken.js";
import { voiceContextHandler } from "./routes/voiceContext.js";
import { voiceRecommendationFeedbackHandler } from "./routes/voiceRecommendationFeedback.js";
import {
  listAdminVoiceTimelineEventsHandler,
  listOwnVoiceTimelineEventsHandler,
  recordVoiceTimelineEventsHandler,
} from "./routes/voiceTimeline.js";
import {
  listVoiceQaSessionReviewsHandler,
  saveVoiceQaSessionReviewHandler,
} from "./routes/voiceQaSessionReviews.js";
import {
  elevenLabsPostCallWebhookHandler,
  getElevenLabsConversationAudioHandler,
  getElevenLabsConversationDetailsHandler,
  listElevenLabsConversationsHandler,
  updateElevenLabsConversationReviewHandler,
} from "./routes/elevenLabsConversationReviews.js";
import {
  completeCallbackOnboardingToolHandler,
  completePhoneOnboardingToolHandler,
  failCallbackOnboardingToolHandler,
  recordVoiceRecommendationFeedbackToolHandler,
  retrieveMedicalProfileToolHandler,
  saveCallbackOnboardingSectionToolHandler,
} from "./routes/elevenlabsTools.js";
import {
  elevenLabsTriageStepToolHandler,
  voiceTriageSessionAnswerHandler,
  voiceTriageSessionEndHandler,
  voiceTriageSessionHandler,
} from "./routes/voiceTriage.js";
import { drAiVoiceFeatureHandler } from "./routes/drAiVoiceFeature.js";
import { onboardingRouter } from "./routes/onboarding.js";
import callbackOnboardingRouter from "./routes/callbackOnboarding.js";
import billingRouter from "./routes/billing.js";
import { adminRouter } from "./routes/admin.js";
import adminSocialRoomsRouter from "./routes/adminSocialRooms.js";
import adminConciergeShoppingRouter from "./routes/adminConciergeShopping.js";
import adminTrustedHelpPartnersRouter from "./routes/adminTrustedHelpPartners.js";
import adminConciergeQueueRouter from "./routes/adminConciergeQueue.js";
import adminConciergeChannelReadinessRouter from "./routes/adminConciergeChannelReadiness.js";
import adminCrossPillarToolReadinessRouter from "./routes/adminCrossPillarToolReadiness.js";
import {
  adminCrossPillarExecutionRouter,
  crossPillarExecutionRouter,
} from "./routes/crossPillarExecutionObservability.js";
import adminConciergeInboundRepliesRouter from "./routes/adminConciergeInboundReplies.js";
import adminProviderDirectoryRouter from "./routes/adminProviderDirectory.js";
import adminCuriousMindsRouter from "./routes/adminCuriousMinds.js";
import adminCognitiveAssessmentRouter from "./routes/adminCognitiveAssessment.js";
import adminLearningRouter from "./routes/adminLearning.js";
import adminContentIndexRouter from "./routes/adminContentIndex.js";
import { adminLifecycleRouter } from "./routes/adminLifecycle.js";
import { adminMarketingRouter } from "./routes/adminMarketing.js";
import intakeRouter from "./routes/intake.js";
import twilioWebhooksRouter from "./routes/twilioWebhooks.js";
import {
  careOperationsWhatsappRouter,
  publicWhatsappCheckinRouter,
} from "./routes/whatsappPrivateCheckins.js";
import sendgridWebhooksRouter from "./routes/sendgridWebhooks.js";
import resendWebhooksRouter from "./routes/resendWebhooks.js";
import { authRouter } from "./routes/auth.js";
import { authMiddleware, requireAdminUser, requireUser } from "./middleware/auth.js";
import { requireEntitlement } from "./middleware/entitlements.js";
import { languageMiddleware } from "./middleware/language.js";
import {
  medsVoiceParseHandler,
  medsVoiceTranscribeAudioBody,
  medsVoiceTranscribeHandler,
} from "./routes/medsVoiceParse.js";
import { medsAssistantHandler } from "./routes/medsAssistant.js";
import {
  conciergeHandler,
  conciergeRecommendationPlanHandler,
  conciergeRecommendationFeedbackHandler,
  conciergeRecommendationsHandler,
} from "./routes/concierge.js";
import conciergeActionsRouter from "./routes/conciergeActions.js";
import conciergeTasksRouter from "./routes/conciergeTasks.js";
import conciergeNotificationsRouter from "./routes/conciergeNotifications.js";
import appointmentsRouter from "./routes/appointments.js";
import conciergeShoppingRouter from "./routes/conciergeShopping.js";
import trustedHelpPartnersRouter from "./routes/trustedHelpPartners.js";
import transportRouter from "./routes/transport.js";
import { woundScanHandler, woundScanHistoryHandler, woundScanDeleteHandler } from "./routes/woundScan.js";
import { homeScanHandler, homeScanHistoryHandler, homeScanDeleteHandler } from "./routes/homeScan.js";
import { scamCheckHandler, scamCheckHistoryHandler, scamCheckDeleteHandler } from "./routes/scamCheck.js";
import { showVyvaReviewHandler } from "./routes/showVyvaReview.js";
import { allergiesVoiceParseHandler } from "./routes/allergiesVoiceParse.js";
import { addressVoiceParseHandler } from "./routes/addressVoiceParse.js";
import activityRouter from "./routes/activity.js";
import profileRouter from "./routes/profile.js";
import preventiveWebPushRouter from "./routes/preventiveWebPush.js";
import preventiveOutboundCallRouter from "./routes/preventiveOutboundCall.js";
import healthDevicesSettingsRouter from "./routes/healthDevicesSettings.js";
import homePlanRouter from "./routes/homePlan.js";
import homeFastHelpSyncRouter from "./routes/homeFastHelpSync.js";
import adminHomeFastHelpOutcomesRouter from "./routes/adminHomeFastHelpOutcomes.js";
import heroMessagesRouter from "./routes/heroMessages.js";
import weatherRouter from "./routes/weather.js";
import triageRouter from "./routes/triage.js";
import breathingRouter from "./routes/breathing.js";
import symptomsRouter from "./routes/symptoms.js";
import { triageScanHandler } from "./routes/triageScan.js";
import companionsRouter from "./routes/companions.js";
import socialRoomsRouter from "./routes/socialRooms.js";
import advisorsRouter from "./routes/advisors.js";
import benefitsRouter from "./routes/benefits.js";
import medsAdherenceRouter from "./routes/medsAdherence.js";
import medicationRefillsRouter from "./routes/medicationRefills.js";
import medicationRefillPushRouter from "./routes/medicationRefillPush.js";
import scheduledSupportRouter from "./routes/scheduledSupport.js";
import caregiverDashboardRouter from "./routes/caregiverDashboard.js";
import caregiverBrainCoachRouter from "./routes/caregiverBrainCoach.js";
import { scanHistoryHandler } from "./routes/history.js";
import reportsRouter from "./routes/reports.js";
import healthLongevityRouter from "./routes/healthLongevity.js";
import healthInsightsReportRouter, { registerHealthInsightsJobs } from "./routes/healthInsightsReport.js";
import vitalsRouter from "./routes/vitals.js";
import vitalsEngineRouter from "./routes/vitalsEngine.js";
import specialistsRouter from "./routes/specialists.js";
import offersRouter, { analyzeOfferDocumentHandler } from "./routes/offers.js";
import utilitiesRouter from "./routes/utilities.js";
import checkinsRouter, { analyzeCheckinHandler, checkinHistoryHandler, sharedCheckinReportHandler } from "./routes/checkins.js";
import gamesRouter from "./routes/games.js";
import cognitiveAssessmentRouter from "./routes/cognitiveAssessment.js";
import learningRouter from "./routes/learning.js";
import { learningImageHandler } from "./routes/learningImages.js";
import motivationRouter from "./routes/motivation.js";
import { dbHealthHandler } from "./routes/dbHealth.js";
import vyvaDemoRouter from "./routes/vyvaDemo.js";
import { getGooglePlacesApiKey, getGooglePlacesApiKeySource } from "./lib/googlePlacesKey.js";
import {
  CANVAS_FEATURE_FLAG_ENDPOINTS,
  resolveCanvasFeatureFlag,
  type CanvasFeatureFlagKey,
} from "./lib/canvasFeatureFlags.js";
import { startCommunicationDispatcher } from "./services/communicationDispatcher.js";
import { startDailyCheckinNoResponseMonitor } from "./services/dailyCheckinMonitor.js";
import { startMarketingEmailScheduler } from "./services/marketingEmailScheduler.js";
import { startMedicationRefillMonitor } from "./services/medicationRefillMonitor.js";

const isProduction = process.env.NODE_ENV === "production";
const app = express();
const PORT = parseInt(process.env.PORT || "5000", 10);
const SERVER_BUILD_ID = "hero-messages-admin-2026-05-04";

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

app.use(cors());
app.use(languageMiddleware);

// ElevenLabs signs the exact request bytes, so this must run before the global JSON parser.
app.post(
  "/api/webhooks/elevenlabs/post-call",
  express.raw({ type: "application/json", limit: "5mb" }),
  elevenLabsPostCallWebhookHandler,
);

// Stripe webhook must receive the raw body before JSON parsing
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

// Wound scan and home scan receive large base64 image payloads — register before the global JSON parser
// so the route-specific limit (10mb) takes effect instead of the default ~100kb.
// authMiddleware identifies logged-in users; no requireUser so unauthenticated users can still scan (handler falls back to demo ID).
app.post("/api/wound-scan", express.json({ limit: "10mb" }), authMiddleware, woundScanHandler);
app.get("/api/wound-scan/history", authMiddleware, woundScanHistoryHandler);
app.delete("/api/wound-scan/:id", authMiddleware, woundScanDeleteHandler);

app.post("/api/home-scan", express.json({ limit: "10mb" }), authMiddleware, homeScanHandler);
app.get("/api/home-scan", authMiddleware, homeScanHistoryHandler);
app.get("/api/home-scan/history", authMiddleware, homeScanHistoryHandler);
app.delete("/api/home-scan/:id", authMiddleware, homeScanDeleteHandler);

app.post("/api/scam-check", express.json({ limit: "10mb" }), authMiddleware, scamCheckHandler);
app.get("/api/scam-check", authMiddleware, scamCheckHistoryHandler);
app.get("/api/scam-check/history", authMiddleware, scamCheckHistoryHandler);
app.delete("/api/scam-check/:id", authMiddleware, scamCheckDeleteHandler);

app.post("/api/show-vyva/review", express.json({ limit: "10mb" }), authMiddleware, showVyvaReviewHandler);

app.post("/api/triage/scan", express.json({ limit: "10mb" }), authMiddleware, requireUser, requireEntitlement("symptom_check"), triageScanHandler);

app.post("/api/offers/analyze-document", express.json({ limit: "20mb" }), authMiddleware, analyzeOfferDocumentHandler);
app.post("/api/bill-reader/analyze", express.json({ limit: "20mb" }), authMiddleware, analyzeOfferDocumentHandler);

app.use(
  "/api/webhooks/sendgrid",
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      (req as typeof req & { rawBody?: string }).rawBody = buf.toString("utf-8");
    },
  }),
  sendgridWebhooksRouter,
);

app.use(
  "/api/webhooks/resend",
  express.raw({ type: "application/json", limit: "2mb" }),
  resendWebhooksRouter,
);

app.use(express.json({ limit: "20mb" }));

app.post("/api/router", orchestratorRouterHandler);
app.post("/api/chat", authMiddleware, liveChatHandler);
app.use("/api/public/callback-onboarding", callbackOnboardingRouter);
app.post("/api/voice-context", authMiddleware, requireUser, requireEntitlement("voice_assistant"), voiceContextHandler);
app.post("/api/voice/recommendations/feedback", authMiddleware, requireUser, requireEntitlement("voice_assistant"), voiceRecommendationFeedbackHandler);
app.get("/api/voice/timeline-events", authMiddleware, requireUser, requireEntitlement("voice_assistant"), listOwnVoiceTimelineEventsHandler);
app.post("/api/voice/timeline-events", authMiddleware, requireUser, requireEntitlement("voice_assistant"), recordVoiceTimelineEventsHandler);
app.post("/api/voice-readiness", authMiddleware, requireUser, requireEntitlement("voice_assistant"), conversationReadinessHandler);
app.post("/api/elevenlabs-conversation-token", authMiddleware, requireUser, requireEntitlement("voice_assistant"), conversationTokenHandler);
app.get("/api/config/features/dr-ai-voice", authMiddleware, requireUser, requireEntitlement("voice_assistant"), drAiVoiceFeatureHandler);
app.post("/api/elevenlabs/tools/retrieve-medical-profile", retrieveMedicalProfileToolHandler);
app.post("/api/elevenlabs/tools/record-voice-recommendation-feedback", recordVoiceRecommendationFeedbackToolHandler);
app.post("/api/elevenlabs/tools/triage-step", elevenLabsTriageStepToolHandler);
app.get("/api/voice-triage/session/:conversation_id", authMiddleware, requireUser, requireEntitlement("voice_assistant"), voiceTriageSessionHandler);
app.post("/api/voice-triage/session/:conversation_id/answer", authMiddleware, requireUser, requireEntitlement("voice_assistant"), voiceTriageSessionAnswerHandler);
app.post("/api/voice-triage/session/:conversation_id/end", authMiddleware, requireUser, requireEntitlement("voice_assistant"), voiceTriageSessionEndHandler);
app.post("/api/elevenlabs/tools/phone-onboarding/complete", completePhoneOnboardingToolHandler);
app.post("/api/elevenlabs/tools/callback-onboarding/save-section", saveCallbackOnboardingSectionToolHandler);
app.post("/api/elevenlabs/tools/callback-onboarding/complete", completeCallbackOnboardingToolHandler);
app.post("/api/elevenlabs/tools/callback-onboarding/fail", failCallbackOnboardingToolHandler);
app.post("/api/meds-voice-transcribe", authMiddleware, requireUser, medsVoiceTranscribeAudioBody, medsVoiceTranscribeHandler);
app.post("/api/meds-voice-parse", authMiddleware, requireUser, medsVoiceParseHandler);
app.post("/api/meds-assistant", authMiddleware, requireUser, requireEntitlement("medication_tracking"), medsAssistantHandler);
app.post("/api/concierge", authMiddleware, requireUser, requireEntitlement("concierge"), conciergeHandler);
app.post("/api/concierge/recommendations", authMiddleware, requireUser, requireEntitlement("concierge"), conciergeRecommendationsHandler);
app.post("/api/concierge/recommendations/plan", authMiddleware, requireUser, requireEntitlement("concierge"), conciergeRecommendationPlanHandler);
app.post("/api/concierge/recommendations/feedback", authMiddleware, requireUser, requireEntitlement("concierge"), conciergeRecommendationFeedbackHandler);
app.use("/api/concierge/shopping", authMiddleware, requireUser, requireEntitlement("concierge"), conciergeShoppingRouter);
app.use("/api/concierge/trusted-help", authMiddleware, requireUser, requireEntitlement("concierge"), trustedHelpPartnersRouter);
app.use("/api/concierge/actions", conciergeActionsRouter);
app.use("/api/concierge/tasks", conciergeTasksRouter);
app.use("/api/concierge/notifications", conciergeNotificationsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/transport", transportRouter);
app.post("/api/allergies-voice-parse", allergiesVoiceParseHandler);
app.post("/api/address-voice-parse", addressVoiceParseHandler);
app.use("/api/intake", express.urlencoded({ extended: false }), intakeRouter);
app.use("/api/webhooks/twilio", express.urlencoded({ extended: false }), twilioWebhooksRouter);
app.use("/api/public/whatsapp-private-checkins", publicWhatsappCheckinRouter);
app.use("/api/integrations/care-operations/whatsapp-private-checkins", careOperationsWhatsappRouter);
app.use("/api/auth", authRouter);
app.use("/api/vyva-demo", vyvaDemoRouter);
app.use("/api/onboarding", authMiddleware, onboardingRouter);
app.use("/api/billing", authMiddleware, billingRouter);
app.use("/api/admin/lifecycle", authMiddleware, requireAdminUser, adminLifecycleRouter);
app.use("/api/admin/social", authMiddleware, requireAdminUser, adminSocialRoomsRouter);
app.use("/api/admin/concierge/shopping", authMiddleware, requireAdminUser, adminConciergeShoppingRouter);
app.use("/api/admin/concierge/trusted-help-partners", authMiddleware, requireAdminUser, adminTrustedHelpPartnersRouter);
app.use("/api/admin/concierge/queue", authMiddleware, requireAdminUser, adminConciergeQueueRouter);
app.use("/api/admin/concierge/channel-readiness", authMiddleware, requireAdminUser, adminConciergeChannelReadinessRouter);
app.use("/api/admin/cross-pillar/tool-readiness", authMiddleware, requireAdminUser, adminCrossPillarToolReadinessRouter);
app.use("/api/cross-pillar/tool-readiness", authMiddleware, requireUser, adminCrossPillarToolReadinessRouter);
app.use("/api/admin/cross-pillar/executions", authMiddleware, requireAdminUser, adminCrossPillarExecutionRouter);
app.use("/api/cross-pillar/executions", authMiddleware, requireUser, crossPillarExecutionRouter);
app.use("/api/admin/concierge/inbound-replies", authMiddleware, requireAdminUser, adminConciergeInboundRepliesRouter);
app.use("/api/admin/providers", authMiddleware, requireAdminUser, adminProviderDirectoryRouter);
app.use("/api/admin/curious-minds", authMiddleware, requireAdminUser, adminCuriousMindsRouter);
app.use("/api/admin/cognitive-assessment", authMiddleware, requireAdminUser, adminCognitiveAssessmentRouter);
app.use("/api/admin/learning", authMiddleware, requireAdminUser, adminLearningRouter);
app.use("/api/admin/content-index", authMiddleware, requireAdminUser, adminContentIndexRouter);
app.use("/api/admin/marketing", authMiddleware, requireAdminUser, adminMarketingRouter);
app.use("/api/admin/home/fast-help-outcomes", authMiddleware, requireAdminUser, adminHomeFastHelpOutcomesRouter);
app.get("/api/admin/voice/timeline-events", authMiddleware, requireAdminUser, listAdminVoiceTimelineEventsHandler);
app.get("/api/admin/voice/qa-reviews", authMiddleware, requireAdminUser, listVoiceQaSessionReviewsHandler);
app.post("/api/admin/voice/qa-reviews", authMiddleware, requireAdminUser, saveVoiceQaSessionReviewHandler);
app.get("/api/admin/voice/conversations", authMiddleware, requireAdminUser, listElevenLabsConversationsHandler);
app.get("/api/admin/voice/conversations/:conversationId/details", authMiddleware, requireAdminUser, getElevenLabsConversationDetailsHandler);
app.get("/api/admin/voice/conversations/:conversationId/audio", authMiddleware, requireAdminUser, getElevenLabsConversationAudioHandler);
app.patch("/api/admin/voice/conversations/:conversationId/review", authMiddleware, requireAdminUser, updateElevenLabsConversationReviewHandler);
app.get("/api/health/db", authMiddleware, requireAdminUser, dbHealthHandler);
app.use("/api/admin", authMiddleware, requireAdminUser, adminRouter);
app.use("/api/hero-messages", heroMessagesRouter);
app.use("/api/activity", authMiddleware, activityRouter);
app.use("/api/profile", authMiddleware, profileRouter);
app.use("/api/preventive-web-push", authMiddleware, requireUser, preventiveWebPushRouter);
app.use("/api/preventive-outbound-call", express.urlencoded({ extended: false }), express.json(), preventiveOutboundCallRouter);
app.use("/api/settings/health-devices", authMiddleware, healthDevicesSettingsRouter);
app.use("/api/home/fast-help", authMiddleware, requireUser, homeFastHelpSyncRouter);
app.use("/api/home", authMiddleware, homePlanRouter);
app.use("/api/weather", authMiddleware, weatherRouter);
app.use("/api/breathing", authMiddleware, requireUser, breathingRouter);
app.use("/api/triage", authMiddleware, requireUser, requireEntitlement("symptom_check"), triageRouter);
app.use("/api/symptoms", authMiddleware, requireUser, requireEntitlement("symptom_check"), symptomsRouter);
app.use("/api/companions", authMiddleware, companionsRouter);
app.use("/api/social", authMiddleware, socialRoomsRouter);
app.use("/api/advisors", authMiddleware, requireUser, advisorsRouter);
app.use("/api/benefits", authMiddleware, requireUser, benefitsRouter);
app.use("/api/meds/adherence-report", authMiddleware, requireUser, requireEntitlement("medication_tracking"), medsAdherenceRouter);
app.use("/api/meds/refill-notifications", authMiddleware, requireUser, requireEntitlement("medication_tracking"), medicationRefillPushRouter);
app.use("/api/meds/refills", authMiddleware, requireUser, requireEntitlement("medication_tracking"), medicationRefillsRouter);
app.use("/api", authMiddleware, scheduledSupportRouter);
app.use("/api/caregiver/dashboard", authMiddleware, requireUser, caregiverDashboardRouter);
app.use("/api/caregiver/brain-coach", authMiddleware, caregiverBrainCoachRouter);
// Also mount at /api/meds so that PATCH /api/meds/:id and DELETE /api/meds/:id
// work as specified. Requests to /api/meds/adherence-report/... are matched
// by the more-specific mount above, so they never reach this one.
app.use("/api/meds", authMiddleware, requireUser, requireEntitlement("medication_tracking"), medsAdherenceRouter);
app.get("/api/history/scans", authMiddleware, requireUser, scanHistoryHandler);
app.use("/api/reports", authMiddleware, reportsRouter);
app.use("/api/health", authMiddleware, requireUser, healthLongevityRouter);
app.use("/api", authMiddleware, requireUser, healthInsightsReportRouter);
app.use("/api/vitals", authMiddleware, vitalsRouter);
app.use("/api/vitals-engine", authMiddleware, requireUser, vitalsEngineRouter);
app.use("/api/specialists", authMiddleware, requireUser, requireEntitlement("symptom_check"), specialistsRouter);
app.use("/api/offers", authMiddleware, offersRouter);
app.use("/api/utilities", authMiddleware, utilitiesRouter);
app.use("/api/games", authMiddleware, requireUser, gamesRouter);
app.get("/api/learning/images/:id", authMiddleware, requireUser, learningImageHandler);
app.use("/api/cognitive-assessment", authMiddleware, requireUser, cognitiveAssessmentRouter);
app.use("/api/learning", authMiddleware, requireUser, learningRouter);
app.use("/api/motivation", authMiddleware, requireUser, motivationRouter);
app.get("/api/checkins/shared/:token", sharedCheckinReportHandler);
app.post("/api/checkins/analyze", authMiddleware, requireUser, analyzeCheckinHandler);
app.get("/api/checkins/history", authMiddleware, requireUser, checkinHistoryHandler);
app.use("/api/checkins", authMiddleware, checkinsRouter);

registerHealthInsightsJobs();

app.get("/api/debug-runtime", (_req, res) => {
  res.json({
    ok: true,
    build: SERVER_BUILD_ID,
    cwd: process.cwd(),
    node_env: process.env.NODE_ENV ?? null,
    google_places_configured: Boolean(getGooglePlacesApiKey()),
    google_places_source: getGooglePlacesApiKeySource(),
    checkins_direct_routes: true,
    bill_reader_route: true,
    json_limit: "20mb",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, build: SERVER_BUILD_ID });
});

app.get("/api/config/places-key", (_req, res) => {
  const key = getGooglePlacesApiKey();
  if (!key) {
    return res.status(404).json({ error: "Google Places API key is not configured on the server." });
  }
  return res.json({ configured: true, source: getGooglePlacesApiKeySource() });
});

function sendCanvasFeatureFlag(res: express.Response, feature: CanvasFeatureFlagKey) {
  res.setHeader("cache-control", "no-store");
  return res.json(resolveCanvasFeatureFlag(feature));
}

CANVAS_FEATURE_FLAG_ENDPOINTS.forEach(({ endpoint, feature }) => {
  app.get(endpoint, (_req, res) => sendCanvasFeatureFlag(res, feature));
});

app.post("/api/places/autocomplete", async (req, res) => {
  const key = getGooglePlacesApiKey();
  if (!key) return res.status(503).json({ error: "Places API key not configured" });

  try {
    const { input, includedPrimaryTypes, locationBias } = req.body as {
      input?: string;
      includedPrimaryTypes?: string[];
      locationBias?: unknown;
    };
    const body: Record<string, unknown> = { input };
    if (includedPrimaryTypes?.length) body.includedPrimaryTypes = includedPrimaryTypes;
    if (locationBias) body.locationBias = locationBias;

    const upstream = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify(body),
    });
    const data = await upstream.json() as unknown;
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[places/autocomplete]", err);
    return res.status(502).json({ error: "Upstream request failed" });
  }
});

app.get("/api/places/details/:placeId", async (req, res) => {
  const key = getGooglePlacesApiKey();
  if (!key) return res.status(503).json({ error: "Places API key not configured" });

  try {
    const { placeId } = req.params;
    const full = req.query.full === "1";
    const fields = full
      ? "displayName,formattedAddress,nationalPhoneNumber,id,types,regularOpeningHours,location,websiteUri,internationalPhoneNumber"
      : "displayName,formattedAddress,nationalPhoneNumber,id,types";
    const upstream = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=${fields}`,
      { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields } }
    );
    const data = await upstream.json() as unknown;
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[places/details]", err);
    return res.status(502).json({ error: "Upstream request failed" });
  }
});

app.get("/api/places/reverse-geocode", async (req, res) => {
  const key = getGooglePlacesApiKey();
  if (!key) return res.status(503).json({ error: "Places API key not configured" });

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng required" });
  }

  try {
    const upstream = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`
    );
    const data = await upstream.json() as {
      status?: string;
      error_message?: string;
      results?: Array<{
        formatted_address?: string;
        types?: string[];
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
      }>;
    };

    if (!upstream.ok || data.status === "REQUEST_DENIED") {
      return res.status(upstream.status || 502).json({ error: data.error_message ?? "Reverse geocoding failed" });
    }

    const best =
      data.results?.find((result) => result.types?.includes("street_address")) ??
      data.results?.find((result) => result.types?.includes("premise")) ??
      data.results?.find((result) => result.types?.includes("route")) ??
      data.results?.[0];

    if (!best?.address_components?.length) {
      return res.status(404).json({ error: "No address found" });
    }

    const component = (type: string, useShort = false) => {
      const match = best.address_components?.find((item) => item.types.includes(type));
      return useShort ? match?.short_name ?? "" : match?.long_name ?? "";
    };

    const streetNumber = component("street_number");
    const route = component("route");
    const line2 = component("subpremise") || component("premise") || component("neighborhood") || component("sublocality");
    const city =
      component("locality") ||
      component("postal_town") ||
      component("administrative_area_level_3") ||
      component("administrative_area_level_2");

    return res.json({
      formattedAddress: best.formatted_address ?? "",
      address: {
        address_line_1: [streetNumber, route].filter(Boolean).join(" "),
        address_line_2: line2,
        city,
        region: component("administrative_area_level_1"),
        postcode: component("postal_code"),
        country: component("country"),
        country_code: component("country", true),
      },
    });
  } catch (err) {
    console.error("[places/reverse-geocode]", err);
    return res.status(502).json({ error: "Upstream request failed" });
  }
});

app.get("/api/places/staticmap", async (req, res) => {
  const key = getGooglePlacesApiKey();
  if (!key) return res.status(503).json({ error: "Places API key not configured" });

  const { lat, lng, zoom = "15", size = "400x160" } = req.query as Record<string, string>;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  try {
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=2&markers=color:purple%7C${lat},${lng}&key=${key}`;
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).send("Map unavailable");
    const ct = upstream.headers.get("content-type") ?? "image/png";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("[places/staticmap]", err);
    return res.status(502).send("Map unavailable");
  }
});

async function configureFrontend() {
  const distPath = path.resolve(process.cwd(), "dist");
  const distIndexPath = path.join(distPath, "index.html");
  const shouldServeStatic = isProduction || (process.env.NODE_ENV !== "development" && await fileExists(distIndexPath));

  if (shouldServeStatic) {
    console.log(`[server] serving static files from: ${distPath}`);
    app.use(express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        const fileName = path.basename(filePath).toLowerCase();
        if (["service-worker.js", "manifest.webmanifest", "robots.txt", "sitemap.xml", "offline.html"].includes(fileName)) {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store");
          return;
        }
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }));
    app.get(/(.*)/, (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(distIndexPath);
    });
    return;
  }

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.get(/(.*)/, async (req, res, next) => {
    try {
      const indexPath = path.resolve(process.cwd(), "index.html");
      const template = await fs.readFile(indexPath, "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
}

configureFrontend().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] listening on port ${PORT} (${isProduction ? "production" : "development"})`);
    if (startCommunicationDispatcher()) {
      console.log("[communications] dispatcher enabled");
    }
    if (startDailyCheckinNoResponseMonitor()) {
      console.log("[daily-checkin-monitor] no-response monitor enabled");
    }
    if (startMarketingEmailScheduler()) {
      console.log("[marketing-email-scheduler] scheduled email campaign runner enabled");
    }
    if (startMedicationRefillMonitor()) {
      console.log("[medication-refill-monitor] proactive refill alerts enabled");
    }
  });
}).catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});

export default app;
