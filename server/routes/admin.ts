import { Router } from "express";
import type { Request, Response } from "express";
import { eq, isNotNull, desc } from "drizzle-orm";
import { db } from "../db.js";
import { profiles, caregiverAlerts } from "../../shared/schema.js";
import { z } from "zod";

export const adminRouter = Router();

// ============================================================
// Admin auth middleware
// Requires x-admin-key header matching ADMIN_API_KEY env var.
// In production, requests are rejected if ADMIN_API_KEY is not set.
// In development only, falls back to "dev-admin-key" for convenience.
// ============================================================

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ADMIN_KEY = process.env.ADMIN_API_KEY;

function requireAdmin(req: Request, res: Response): boolean {
  // In production, refuse all requests when the secret is not configured —
  // this prevents accidentally exposing the dashboard via the dev fallback.
  if (IS_PRODUCTION && !ADMIN_KEY) {
    res.status(503).json({ error: "Admin dashboard is not configured on this server" });
    return false;
  }

  const effectiveKey = ADMIN_KEY ?? "dev-admin-key";
  const provided = req.headers["x-admin-key"] as string | undefined;

  if (!provided || provided !== effectiveKey) {
    res.status(403).json({ error: "Forbidden — invalid or missing admin key" });
    return false;
  }
  return true;
}

// ============================================================
// GET /proxy-pending
// Returns profiles where proxy_initiator_id is set but
// elder_confirmed_at is null, newest first.
// ============================================================

adminRouter.get("/proxy-pending", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await db
      .select({
        id:                 profiles.id,
        full_name:          profiles.full_name,
        preferred_name:     profiles.preferred_name,
        proxy_initiator_id: profiles.proxy_initiator_id,
        proxy_initiated_at: profiles.proxy_initiated_at,
        elder_confirmed_at: profiles.elder_confirmed_at,
        phone_number:       profiles.phone_number,
        created_at:         profiles.created_at,
      })
      .from(profiles)
      .where(isNotNull(profiles.proxy_initiator_id))
      .orderBy(desc(profiles.proxy_initiated_at));

    // proxy_initiator_id stores the carer's display string "Name (Relationship)"
    // set during proxy setup — it is not a foreign key to another profile.
    // We expose it as proxy_name to make the intent explicit for consumers.
    const normalize = (r: typeof rows[number]) => ({
      ...r,
      proxy_name: r.proxy_initiator_id ?? "Unknown",
    });

    const pending   = rows.filter((r) => !r.elder_confirmed_at).map(normalize);
    const confirmed = rows.filter((r) => !!r.elder_confirmed_at).map(normalize);

    return res.json({ pending, confirmed });
  } catch (e) {
    console.error("[admin] GET /proxy-pending error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /proxy-confirm/:userId
// Manually sets elder_confirmed_at for the given profile.
// ============================================================

adminRouter.post("/proxy-confirm/:userId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;

  try {
    const [existing] = await db
      .select({ id: profiles.id, proxy_initiator_id: profiles.proxy_initiator_id })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Profile not found" });
    }
    if (!existing.proxy_initiator_id) {
      return res.status(400).json({ error: "This account was not set up by a proxy" });
    }

    await db
      .update(profiles)
      .set({ elder_confirmed_at: new Date(), updated_at: new Date() })
      .where(eq(profiles.id, userId));

    return res.json({ ok: true, userId, action: "confirmed" });
  } catch (e) {
    console.error("[admin] POST /proxy-confirm error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /proxy-flag/:userId
// Creates a caregiver_alert entry flagging the account for
// manual review (e.g. proxy seems fraudulent or unresponsive).
// ============================================================

const flagSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

adminRouter.post("/proxy-flag/:userId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;
  const parsed = flagSchema.safeParse(req.body);
  const reason = parsed.success ? (parsed.data.reason ?? "Flagged by admin for review") : "Flagged by admin for review";

  try {
    const [existing] = await db
      .select({ id: profiles.id, proxy_initiator_id: profiles.proxy_initiator_id })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Profile not found" });
    }
    if (!existing.proxy_initiator_id) {
      return res.status(400).json({ error: "This account was not set up by a proxy" });
    }

    await db.insert(caregiverAlerts).values({
      user_id:    userId,
      alert_type: "proxy_unconfirmed_flag",
      severity:   "warning",
      message:    reason,
      sent_to:    ["admin"],
    });

    return res.json({ ok: true, userId, action: "flagged", reason });
  } catch (e) {
    console.error("[admin] POST /proxy-flag error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});
