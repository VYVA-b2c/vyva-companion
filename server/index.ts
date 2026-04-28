import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import { routerHandler } from "./routes/router.js";
import { conversationTokenHandler } from "./routes/conversationToken.js";
import { onboardingRouter } from "./routes/onboarding.js";
import billingRouter from "./routes/billing.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { authMiddleware } from "./middleware/auth.js";
import { medsVoiceParseHandler } from "./routes/medsVoiceParse.js";
import { medsAssistantHandler } from "./routes/medsAssistant.js";
import {
  conciergeHandler,
  conciergeRecommendationPlanHandler,
  conciergeRecommendationFeedbackHandler,
  conciergeRecommendationsHandler,
} from "./routes/concierge.js";
import conciergeActionsRouter from "./routes/conciergeActions.js";
import { woundScanHandler, woundScanHistoryHandler, woundScanDeleteHandler } from "./routes/woundScan.js";
import { homeScanHandler, homeScanHistoryHandler, homeScanDeleteHandler } from "./routes/homeScan.js";
import { scamCheckHandler, scamCheckHistoryHandler, scamCheckDeleteHandler } from "./routes/scamCheck.js";
import { allergiesVoiceParseHandler } from "./routes/allergiesVoiceParse.js";
import { addressVoiceParseHandler } from "./routes/addressVoiceParse.js";
import activityRouter from "./routes/activity.js";
import profileRouter from "./routes/profile.js";
import weatherRouter from "./routes/weather.js";
import triageRouter from "./routes/triage.js";
import companionsRouter from "./routes/companions.js";
import socialRoomsRouter from "./routes/socialRooms.js";
import medsAdherenceRouter from "./routes/medsAdherence.js";
import { scanHistoryHandler } from "./routes/history.js";
import { requireUser } from "./middleware/auth.js";
import reportsRouter from "./routes/reports.js";
import vitalsRouter from "./routes/vitals.js";
import specialistsRouter from "./routes/specialists.js";
import checkinsRouter, { analyzeCheckinHandler, checkinHistoryHandler } from "./routes/checkins.js";

const isProduction = process.env.NODE_ENV === "production";
const app = express();
const PORT = isProduction ? parseInt(process.env.PORT || "5000", 10) : 3001;
const SERVER_BUILD_ID = "checkins-direct-2026-04-28";

app.use(cors());

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

app.use(express.json());

app.post("/api/router", routerHandler);
app.post("/api/elevenlabs-conversation-token", conversationTokenHandler);
app.post("/api/meds-voice-parse", medsVoiceParseHandler);
app.post("/api/meds-assistant", medsAssistantHandler);
app.post("/api/concierge", authMiddleware, conciergeHandler);
app.post("/api/concierge/recommendations", authMiddleware, conciergeRecommendationsHandler);
app.post("/api/concierge/recommendations/plan", authMiddleware, conciergeRecommendationPlanHandler);
app.post("/api/concierge/recommendations/feedback", authMiddleware, conciergeRecommendationFeedbackHandler);
app.use("/api/concierge/actions", conciergeActionsRouter);
app.post("/api/allergies-voice-parse", allergiesVoiceParseHandler);
app.post("/api/address-voice-parse", addressVoiceParseHandler);
app.use("/api/auth", authRouter);
app.use("/api/onboarding", authMiddleware, onboardingRouter);
app.use("/api/billing", authMiddleware, billingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/activity", authMiddleware, activityRouter);
app.use("/api/profile", authMiddleware, profileRouter);
app.use("/api/weather", authMiddleware, weatherRouter);
app.use("/api/triage", authMiddleware, triageRouter);
app.use("/api/companions", authMiddleware, companionsRouter);
app.use("/api/social", authMiddleware, socialRoomsRouter);
app.use("/api/meds/adherence-report", authMiddleware, medsAdherenceRouter);
// Also mount at /api/meds so that PATCH /api/meds/:id and DELETE /api/meds/:id
// work as specified. Requests to /api/meds/adherence-report/... are matched
// by the more-specific mount above, so they never reach this one.
app.use("/api/meds", authMiddleware, medsAdherenceRouter);
app.get("/api/history/scans", authMiddleware, requireUser, scanHistoryHandler);
app.use("/api/reports", authMiddleware, reportsRouter);
app.use("/api/vitals", authMiddleware, vitalsRouter);
app.use("/api/specialists", authMiddleware, specialistsRouter);
app.post("/api/checkins/analyze", authMiddleware, requireUser, analyzeCheckinHandler);
app.get("/api/checkins/history", authMiddleware, requireUser, checkinHistoryHandler);
app.use("/api/checkins", authMiddleware, checkinsRouter);

app.get("/api/debug-runtime", (_req, res) => {
  res.json({
    ok: true,
    build: SERVER_BUILD_ID,
    cwd: process.cwd(),
    node_env: process.env.NODE_ENV ?? null,
    checkins_direct_routes: true,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, build: SERVER_BUILD_ID });
});

app.get("/api/config/places-key", (_req, res) => {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? "";
  if (!key) {
    return res.status(404).json({ error: "Google Places API key is not configured on the server." });
  }
  return res.json({ key });
});

app.post("/api/places/autocomplete", async (req, res) => {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? "";
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
  const key = process.env.GOOGLE_PLACES_API_KEY ?? "";
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

app.get("/api/places/staticmap", async (req, res) => {
  const key = process.env.GOOGLE_PLACES_API_KEY ?? "";
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

if (isProduction) {
  const distPath = path.resolve(process.cwd(), "dist");
  console.log(`[server] serving static files from: ${distPath}`);
  app.use(express.static(distPath));
  app.get(/(.*)/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] listening on port ${PORT} (${isProduction ? "production" : "development"})`);
});

export default app;
