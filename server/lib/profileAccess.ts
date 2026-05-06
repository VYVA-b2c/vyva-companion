import type { Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { profileMemberships, profiles, users } from "../../shared/schema.js";

export type ActiveProfileContext = {
  accountUserId: string;
  profileId: string | null;
  role: (typeof profileMemberships.$inferSelect)["role"] | null;
};

export async function getActiveProfileContext(accountUserId: string): Promise<ActiveProfileContext> {
  const [account] = await db
    .select({ active_profile_id: users.active_profile_id })
    .from(users)
    .where(eq(users.id, accountUserId))
    .limit(1);

  if (!account) {
    return { accountUserId, profileId: null, role: null };
  }

  if (account.active_profile_id) {
    const [activeMembership] = await db
      .select({ role: profileMemberships.role })
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.user_id, accountUserId),
        eq(profileMemberships.profile_id, account.active_profile_id),
        eq(profileMemberships.status, "active"),
      ))
      .limit(1);

    if (activeMembership) {
      return { accountUserId, profileId: account.active_profile_id, role: activeMembership.role };
    }
  }

  const [membership] = await db
    .select({ profile_id: profileMemberships.profile_id, role: profileMemberships.role })
    .from(profileMemberships)
    .where(and(
      eq(profileMemberships.user_id, accountUserId),
      eq(profileMemberships.status, "active"),
    ))
    .orderBy(desc(profileMemberships.is_primary), desc(profileMemberships.created_at))
    .limit(1);

  if (membership) {
    await db
      .update(users)
      .set({ active_profile_id: membership.profile_id })
      .where(eq(users.id, accountUserId));
    return { accountUserId, profileId: membership.profile_id, role: membership.role };
  }

  const [legacyProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, accountUserId))
    .limit(1);

  if (legacyProfile) {
    await db
      .insert(profileMemberships)
      .values({
        user_id: accountUserId,
        profile_id: legacyProfile.id,
        role: "elder",
        relationship: "self",
        is_primary: true,
        accepted_at: new Date(),
      })
      .onConflictDoNothing();

    await db
      .update(users)
      .set({ active_profile_id: legacyProfile.id })
      .where(eq(users.id, accountUserId));

    return { accountUserId, profileId: legacyProfile.id, role: "elder" };
  }

  return { accountUserId, profileId: null, role: null };
}

export async function requireActiveProfileId(accountUserId: string, res: Response): Promise<string | null> {
  const context = await getActiveProfileContext(accountUserId);
  if (!context.profileId) {
    res.status(409).json({
      error: "No care profile selected",
      nextRoute: "/onboarding/who-for",
    });
    return null;
  }
  return context.profileId;
}
