import { Router } from "express";
import type { Request, Response } from "express";
import { eq, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { profiles, userMedications } from "../../shared/schema.js";

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";

const router = Router();

/**
 * Returns the authenticated user's ID if a valid JWT was present (set by
 * authMiddleware), or the demo-user fallback in non-production environments.
 * In production, unauthenticated callers receive null (→ 401) to prevent
 * unintended reads/writes on shared demo-profile data.
 */
function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

const profileBodySchema = z.object({
  firstName:       z.string().min(1).max(100),
  lastName:        z.string().max(100).optional().default(""),
  preferredName:   z.string().max(100).optional().default(""),
  dateOfBirth:     z.string().max(50).optional().or(z.literal("")).optional(),
  email:           z.string().email().optional().or(z.literal("")).optional(),
  phone:           z.string().trim().min(1, "Phone is required").max(50),
  country:         z.string().max(100).optional().default(""),
  timezone:        z.string().max(100).optional().default(""),
  language:        z.string().max(50).optional().default("en"),
  street:          z.string().max(200).optional().default(""),
  cityState:       z.string().max(200).optional().default(""),
  postalCode:      z.string().max(30).optional().default(""),
  caregiverName:   z.string().max(150).optional().default(""),
  caregiverContact: z.string().max(50).optional().default(""),
});

router.get("/", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!rows[0]) {
      return res.json(null);
    }

    const p = rows[0];
    const nameParts = (p.full_name ?? "").trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName  = nameParts.slice(1).join(" ");

    return res.json({
      firstName,
      lastName,
      preferredName:    p.preferred_name ?? "",
      dateOfBirth:      p.date_of_birth ?? "",
      email:            p.email ?? "",
      phone:            p.phone_number ?? "",
      country:          p.country_code ?? "",
      timezone:         p.timezone ?? "",
      language:         p.language ?? "en",
      street:           p.address_line_1 ?? "",
      cityState:        p.city ?? "",
      postalCode:       p.postcode ?? "",
      caregiverName:    p.caregiver_name ?? "",
      caregiverContact: p.caregiver_contact ?? "",
      avatarUrl:        p.avatar_url ?? null,
    });
  } catch (err) {
    console.error("[profile GET]", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = profileBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const d = parsed.data;
  const full_name = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();

  try {
    await db
      .insert(profiles)
      .values({
        id:               userId,
        full_name,
        preferred_name:   d.preferredName || null,
        date_of_birth:    d.dateOfBirth || null,
        email:            d.email || null,
        phone_number:     d.phone || null,
        country_code:     d.country || null,
        timezone:         d.timezone || "Europe/Madrid",
        language:         d.language || "en",
        address_line_1:   d.street || null,
        city:             d.cityState || null,
        postcode:         d.postalCode || null,
        caregiver_name:   d.caregiverName || null,
        caregiver_contact: d.caregiverContact || null,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          full_name,
          preferred_name:   d.preferredName || null,
          date_of_birth:    d.dateOfBirth || null,
          email:            d.email || null,
          phone_number:     d.phone || null,
          country_code:     d.country || null,
          timezone:         d.timezone || "Europe/Madrid",
          language:         d.language || "en",
          address_line_1:   d.street || null,
          city:             d.cityState || null,
          postcode:         d.postalCode || null,
          caregiver_name:   d.caregiverName || null,
          caregiver_contact: d.caregiverContact || null,
          updated_at:       new Date(),
        },
      });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[profile POST]", err);
    return res.status(500).json({ error: "Failed to save profile" });
  }
});

// PATCH /avatar — update the current user's profile photo (data URL or null)
const avatarBodySchema = z.object({
  avatarUrl: z.string().max(2_000_000).nullable(),
});

router.patch("/avatar", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = avatarBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await db
      .insert(profiles)
      .values({ id: userId, avatar_url: parsed.data.avatarUrl })
      .onConflictDoUpdate({
        target: profiles.id,
        set: { avatar_url: parsed.data.avatarUrl, updated_at: new Date() },
      });
    return res.json({ ok: true, avatarUrl: parsed.data.avatarUrl });
  } catch (err) {
    console.error("[profile PATCH /avatar]", err);
    return res.status(500).json({ error: "Failed to update avatar" });
  }
});

router.get("/personalisation", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [profileRows, medCountRows] = await Promise.all([
      db.select({ data_sharing_consent: profiles.data_sharing_consent })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1),
      db.select({ count: count() })
        .from(userMedications)
        .where(eq(userMedications.user_id, userId)),
    ]);

    const consent = (profileRows[0]?.data_sharing_consent ?? {}) as Record<string, unknown>;
    const conditionsSection = consent["conditions"] as { health_conditions?: string[] } | undefined;
    const hobbiesSection = consent["hobbies"] as { hobbies?: string[] } | undefined;

    return res.json({
      conditions: conditionsSection?.health_conditions ?? [],
      hobbies: hobbiesSection?.hobbies ?? [],
      hasMedications: (medCountRows[0]?.count ?? 0) > 0,
    });
  } catch (err) {
    console.error("[profile GET /personalisation]", err);
    return res.status(500).json({ error: "Failed to fetch personalisation data" });
  }
});

export default router;
