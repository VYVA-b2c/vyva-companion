import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, or, ne, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  companionProfiles,
  companionConnections,
  profiles,
} from "../../shared/schema.js";

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";

const router = Router();

/**
 * Returns the authenticated user's ID, or the demo-user fallback in
 * non-production environments. Returns null (→ 401) when unauthenticated
 * in production, preventing unauthenticated writes under a shared identity.
 */
function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

// Interest → category mapping (used for activity key derivation)
const INTEREST_CATEGORY: Record<string, string> = {
  chess:        "games",
  bridge:       "games",
  bingo:        "games",
  cards:        "games",
  dominoes:     "games",
  sudoku:       "games",
  walking:      "outdoors",
  gardening:    "outdoors",
  birdwatching: "outdoors",
  cycling:      "outdoors",
  fishing:      "outdoors",
  painting:     "creative",
  knitting:     "creative",
  music:        "creative",
  crafts:       "creative",
  writing:      "creative",
  reading:      "learning",
  languages:    "learning",
  history:      "learning",
  crosswords:   "learning",
  documentary:  "learning",
};

/** Returns a category key ("games" | "outdoors" | "creative" | "learning") for frontend i18n. */
function deriveSuggestedActivityKey(myInterests: string[], theirInterests: string[]): string {
  const shared = myInterests.filter((i) => theirInterests.includes(i));
  if (shared.length === 0) return "learning";

  const catCounts: Record<string, number> = {};
  for (const interest of shared) {
    const cat = INTEREST_CATEGORY[interest] ?? "learning";
    catCounts[cat] = (catCounts[cat] ?? 0) + 1;
  }
  return Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0];
}

function computeAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  try {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age > 0 ? age : null;
  } catch {
    return null;
  }
}

// GET /social-status — return the caller's social activation flags
router.get("/social-status", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [row] = await db
      .select({
        social_enabled: profiles.social_enabled,
        discoverable:   profiles.discoverable,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    return res.json(row ?? { social_enabled: false, discoverable: false });
  } catch (err) {
    console.error("[companions GET /social-status]", err);
    return res.status(500).json({ error: "Failed to fetch social status" });
  }
});

// GET /profile — fetch current user's companion profile
router.get("/profile", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [profile] = await db
      .select()
      .from(companionProfiles)
      .where(eq(companionProfiles.user_id, userId))
      .limit(1);
    return res.json(profile ?? null);
  } catch (err) {
    console.error("[companions GET /profile]", err);
    return res.status(500).json({ error: "Failed to fetch companion profile" });
  }
});

// POST /profile — upsert interest profile
const profileBodySchema = z.object({
  interests:            z.array(z.string()).min(1).max(25),
  hobbies:              z.array(z.string()).max(25).optional().default([]),
  values:               z.array(z.string()).max(25).optional().default([]),
  preferred_activities: z.array(z.string()).max(25).optional().default([]),
});

router.post("/profile", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = profileBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const [existing] = await db
      .select({ id: companionProfiles.id })
      .from(companionProfiles)
      .where(eq(companionProfiles.user_id, userId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(companionProfiles)
        .set({
          interests:            parsed.data.interests,
          hobbies:              parsed.data.hobbies.length > 0 ? parsed.data.hobbies : parsed.data.interests,
          values:               parsed.data.values,
          preferred_activities: parsed.data.preferred_activities,
          updated_at:           sql`NOW()`,
        })
        .where(eq(companionProfiles.user_id, userId))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db
        .insert(companionProfiles)
        .values({
          user_id:              userId,
          interests:            parsed.data.interests,
          hobbies:              parsed.data.hobbies.length > 0 ? parsed.data.hobbies : parsed.data.interests,
          values:               parsed.data.values,
          preferred_activities: parsed.data.preferred_activities,
        })
        .returning();
      return res.status(201).json(created);
    }
  } catch (err) {
    console.error("[companions POST /profile]", err);
    return res.status(500).json({ error: "Failed to save companion profile" });
  }
});

// GET /suggestions — companion suggestions ranked by shared interests
router.get("/suggestions", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [myProfile] = await db
      .select()
      .from(companionProfiles)
      .where(eq(companionProfiles.user_id, userId))
      .limit(1);

    if (!myProfile || myProfile.interests.length === 0) {
      return res.json([]);
    }

    const myInterests = myProfile.interests;

    const allProfiles = await db
      .select()
      .from(companionProfiles)
      .where(ne(companionProfiles.user_id, userId));

    const existingConnections = await db
      .select()
      .from(companionConnections)
      .where(
        or(
          eq(companionConnections.requester_id, userId),
          eq(companionConnections.recipient_id, userId),
        )
      );

    // Exclude all existing connection pairs — pending, accepted, or declined
    const connectedUserIds = new Set<string>();
    for (const conn of existingConnections) {
      connectedUserIds.add(conn.requester_id === userId ? conn.recipient_id : conn.requester_id);
    }

    const candidateUserIds = allProfiles
      .filter((p) => !connectedUserIds.has(p.user_id))
      .map((p) => p.user_id);

    if (candidateUserIds.length === 0) return res.json([]);

    const profileRows = await db
      .select({
        id:             profiles.id,
        preferred_name: profiles.preferred_name,
        full_name:      profiles.full_name,
        date_of_birth:  profiles.date_of_birth,
        avatar_url:     profiles.avatar_url,
        discoverable:   profiles.discoverable,
      })
      .from(profiles)
      .where(inArray(profiles.id, candidateUserIds));

    // Only surface users who have opted in to be discoverable
    const discoverableIds = new Set(
      profileRows.filter((p) => p.discoverable).map((p) => p.id)
    );

    const userIds = candidateUserIds.filter((id) => discoverableIds.has(id));

    if (userIds.length === 0) return res.json([]);

    const profileMap = new Map(profileRows.map((p) => [p.id, p]));

    const suggestions = allProfiles
      .filter((p) => !connectedUserIds.has(p.user_id) && discoverableIds.has(p.user_id))
      .map((p) => {
        const shared = myInterests.filter((i) => p.interests.includes(i));
        const prof = profileMap.get(p.user_id);
        const displayName = prof?.preferred_name || (prof?.full_name?.split(" ")[0] ?? "Friend");
        return {
          userId:               p.user_id,
          name:                 displayName,
          age:                  computeAge(prof?.date_of_birth),
          sharedInterests:      shared,
          allInterests:         p.interests,
          sharedCount:          shared.length,
          suggestedActivityKey: deriveSuggestedActivityKey(myInterests, p.interests),
          avatarUrl:            prof?.avatar_url ?? null,
        };
      })
      .filter((s) => s.sharedCount > 0)
      .sort((a, b) => b.sharedCount - a.sharedCount)
      .slice(0, 20);

    return res.json(suggestions);
  } catch (err) {
    console.error("[companions GET /suggestions]", err);
    return res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

// Allowed activity category keys (must match INTEREST_CATEGORY values on frontend)
const ALLOWED_ACTIVITY_KEYS = ["games", "outdoors", "creative", "learning"] as const;

// POST /connect — send a connection request
const connectBodySchema = z.object({
  recipientId:          z.string().min(1),
  suggestedActivityKey: z.enum(ALLOWED_ACTIVITY_KEYS),
});

router.post("/connect", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = connectBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { recipientId, suggestedActivityKey } = parsed.data;
  if (recipientId === userId) {
    return res.status(400).json({ error: "Cannot connect with yourself" });
  }

  try {
    // Verify recipient exists in the profiles table (FK target)
    const [recipient] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, recipientId))
      .limit(1);
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found" });
    }

    const [existing] = await db
      .select({ id: companionConnections.id })
      .from(companionConnections)
      .where(
        or(
          and(
            eq(companionConnections.requester_id, userId),
            eq(companionConnections.recipient_id, recipientId),
          ),
          and(
            eq(companionConnections.requester_id, recipientId),
            eq(companionConnections.recipient_id, userId),
          ),
        )
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "Connection already exists" });
    }

    const [conn] = await db
      .insert(companionConnections)
      .values({
        requester_id:      userId,
        recipient_id:      recipientId,
        status:            "pending",
        suggested_activity: suggestedActivityKey,
      })
      .returning();

    return res.status(201).json(conn);
  } catch (err) {
    console.error("[companions POST /connect]", err);
    return res.status(500).json({ error: "Failed to send connection request" });
  }
});

// GET /connections — list all connections for the current user
router.get("/connections", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const connections = await db
      .select()
      .from(companionConnections)
      .where(
        or(
          eq(companionConnections.requester_id, userId),
          eq(companionConnections.recipient_id, userId),
        )
      )
      .orderBy(companionConnections.created_at);

    if (connections.length === 0) return res.json({ accepted: [], pending: [] });

    const otherUserIds = [...new Set(
      connections.map((c) =>
        c.requester_id === userId ? c.recipient_id : c.requester_id
      )
    )];

    const profileRows = await db
      .select({
        id:             profiles.id,
        preferred_name: profiles.preferred_name,
        full_name:      profiles.full_name,
        avatar_url:     profiles.avatar_url,
      })
      .from(profiles)
      .where(
        sql`${profiles.id} = ANY(ARRAY[${sql.join(otherUserIds.map((id) => sql`${id}`), sql`, `)}])`
      );

    const profileMap = new Map(profileRows.map((p) => [p.id, p]));

    const enrich = (c: typeof connections[0]) => {
      const otherId = c.requester_id === userId ? c.recipient_id : c.requester_id;
      const prof = profileMap.get(otherId);
      const name = prof?.preferred_name || (prof?.full_name?.split(" ")[0] ?? "Friend");
      return {
        id:                c.id,
        otherId,
        name,
        status:            c.status,
        suggestedActivity: c.suggested_activity,
        isIncoming:        c.recipient_id === userId && c.status === "pending",
        createdAt:         c.created_at,
        avatarUrl:         prof?.avatar_url ?? null,
      };
    };

    const accepted = connections.filter((c) => c.status === "accepted").map(enrich);
    const pending  = connections.filter((c) => c.status === "pending").map(enrich);

    return res.json({ accepted, pending });
  } catch (err) {
    console.error("[companions GET /connections]", err);
    return res.status(500).json({ error: "Failed to fetch connections" });
  }
});

// POST /activate — enable social features for the current user
router.post("/activate", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [updated] = await db
      .update(profiles)
      .set({ social_enabled: true, discoverable: true })
      .where(eq(profiles.id, userId))
      .returning({
        id:             profiles.id,
        social_enabled: profiles.social_enabled,
        discoverable:   profiles.discoverable,
      });

    if (!updated) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("[companions POST /activate]", err);
    return res.status(500).json({ error: "Failed to activate social features" });
  }
});

// PATCH /connect/:id — accept or decline an incoming request
const patchBodySchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

router.patch("/connect/:id", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const { id } = req.params;
  const parsed = patchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const [conn] = await db
      .select()
      .from(companionConnections)
      .where(eq(companionConnections.id, id))
      .limit(1);

    if (!conn) return res.status(404).json({ error: "Connection not found" });
    if (conn.recipient_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (conn.status !== "pending") {
      return res.status(409).json({ error: "Connection already resolved" });
    }

    const [updated] = await db
      .update(companionConnections)
      .set({ status: parsed.data.status, updated_at: sql`NOW()` })
      .where(eq(companionConnections.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error("[companions PATCH /connect/:id]", err);
    return res.status(500).json({ error: "Failed to update connection" });
  }
});

export default router;
