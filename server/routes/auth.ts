import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { z } from "zod";
import { db } from "../db.js";
import { accessLinks, lifecycleEvents, profiles, userIntakes, users } from "../../shared/schema.js";
import { signMagicLoginToken, signToken, verifyMagicLoginToken } from "../lib/jwt.js";
import { authMiddleware } from "../middleware/auth.js";
import { sendMagicLoginEmail, sendPasswordResetEmail } from "../lib/email.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { getSupabaseConfig } from "../lib/supabaseAuth.js";

const scryptAsync = promisify(scrypt);

const isDev = process.env.NODE_ENV !== "production";
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
const emailSchema = z.string().trim().email();
const SUPPORTED_PROFILE_LANGUAGES = ["es", "en", "fr", "de", "it", "pt", "cy"] as const;
type ProfileLanguage = (typeof SUPPORTED_PROFILE_LANGUAGES)[number];

type ContactIdentifier = {
  email: string | null;
  phone: string | null;
  kind: "email" | "phone";
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = emailSchema.safeParse(trimmed);
  return parsed.success ? parsed.data.toLowerCase() : null;
}

function isSuperAdminEmail(value: unknown): boolean {
  return normalizeEmail(value) === SUPER_ADMIN_EMAIL;
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const startsInternational = trimmed.startsWith("+");
  const compact = trimmed.replace(/[^\d+]/g, "");
  const normalized = compact.startsWith("00")
    ? `+${compact.slice(2).replace(/\D/g, "")}`
    : startsInternational
      ? `+${compact.slice(1).replace(/\D/g, "")}`
      : compact.replace(/\D/g, "");
  const digitCount = normalized.replace(/\D/g, "").length;
  if (digitCount < 7 || digitCount > 15) return null;
  return normalized;
}

function normalizeProfileLanguage(value: unknown): ProfileLanguage {
  if (typeof value !== "string") return "es";
  const raw = value.trim().toLowerCase();
  return SUPPORTED_PROFILE_LANGUAGES.includes(raw as ProfileLanguage)
    ? raw as ProfileLanguage
    : "es";
}

function resolveContactIdentifier(body: {
  email?: unknown;
  phone?: unknown;
  identifier?: unknown;
}): ContactIdentifier | null {
  const email = normalizeEmail(body.email);
  if (email) return { email, phone: null, kind: "email" };

  const phone = normalizePhone(body.phone);
  if (phone) return { email: null, phone, kind: "phone" };

  if (typeof body.identifier === "string") {
    const identifier = body.identifier.trim();
    if (!identifier) return null;
    if (identifier.includes("@")) {
      const identifierEmail = normalizeEmail(identifier);
      return identifierEmail ? { email: identifierEmail, phone: null, kind: "email" } : null;
    }
    const identifierPhone = normalizePhone(identifier);
    return identifierPhone ? { email: null, phone: identifierPhone, kind: "phone" } : null;
  }

  return null;
}

async function findUserByContact(contact: ContactIdentifier) {
  const whereClause = contact.kind === "email" && contact.email
    ? eq(users.email, contact.email)
    : eq(users.phone_number, contact.phone ?? "");

  const [user] = await db
    .select()
    .from(users)
    .where(whereClause)
    .limit(1);

  return user ?? null;
}

async function findUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

async function getOrCreateAuthenticatedUser(userId: string, email?: unknown) {
  const existing = await findUserById(userId);
  if (existing) return existing;

  const normalizedEmail = normalizeEmail(email);
  const [created] = await db
    .insert(users)
    .values({
      id: userId,
      email: normalizedEmail,
      password_hash: "external:supabase",
    })
    .onConflictDoNothing()
    .returning();

  return created ?? await findUserById(userId);
}

async function getProfileRole(userId: string): Promise<string> {
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return profile?.role ?? "user";
}

async function getOrCreateAuthenticatedProfile(userId: string, email?: unknown) {
  const normalizedEmail = normalizeEmail(email);
  const role = isSuperAdminEmail(normalizedEmail) ? "admin" : "user";
  const [created] = await db
    .insert(profiles)
    .values({
      id: userId,
      email: normalizedEmail,
      role,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: normalizedEmail,
        ...(role === "admin" ? { role } : {}),
        updated_at: new Date(),
      },
    })
    .returning({
      id: profiles.id,
      email: profiles.email,
      phone: profiles.phone_number,
      language: profiles.language,
      role: profiles.role,
    });

  if (created) return created;

  const [profile] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      phone: profiles.phone_number,
      language: profiles.language,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return profile ?? null;
}

async function getUserProfileLanguage(userId: string): Promise<ProfileLanguage> {
  const context = await getActiveProfileContext(userId);
  if (!context.profileId) return "es";

  const [profile] = await db
    .select({ language: profiles.language })
    .from(profiles)
    .where(eq(profiles.id, context.profileId))
    .limit(1);

  return normalizeProfileLanguage(profile?.language);
}

function authResponseUser(
  user: typeof users.$inferSelect,
  prevSeenAt: string | null,
  language: ProfileLanguage,
  role = "user",
) {
  return {
    userId: user.id,
    email: user.email,
    phone: user.phone_number,
    language,
    activeProfileId: user.active_profile_id ?? null,
    role,
    prevSeenAt,
  };
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return derived.toString("hex") === hash;
}

const registerSchema = z.object({
  email:      z.string().optional(),
  phone:      z.string().optional(),
  identifier: z.string().optional(),
  language:   z.string().optional(),
  password:   z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email:      z.string().optional(),
  phone:      z.string().optional(),
  identifier: z.string().optional(),
  password:   z.string().min(1),
});

const magicLinkRequestSchema = z.object({
  email:      z.string().optional(),
  phone:      z.string().optional(),
  identifier: z.string().optional(),
});

const magicLoginSchema = z.object({
  token: z.string().min(1, "Magic link token is required"),
});

const resetRequestSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z.object({
  token:    z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const consumeAccessLinkSchema = z.object({
  token: z.string().min(16, "Access token is required"),
});

/** Token lifetime: 1 hour */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const authRouter = Router();

authRouter.get("/supabase-config", (_req: Request, res: Response) => {
  const config = getSupabaseConfig();
  if (!config) return res.status(404).json({ configured: false });
  return res.json({ configured: true, url: config.url, anonKey: config.anonKey });
});

/**
 * POST /api/auth/register
 * Creates a new user account and an empty profile, returns a signed JWT.
 */
authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid request";
    return res.status(400).json({ error: msg });
  }

  const { password } = parsed.data;
  const language = normalizeProfileLanguage(parsed.data.language);
  const contact = resolveContactIdentifier(parsed.data);
  if (!contact) {
    return res.status(400).json({ error: "Please enter a valid email address or mobile number." });
  }

  const existing = await findUserByContact(contact);

  if (existing) {
    return res.status(409).json({
      error: contact.kind === "phone"
        ? "An account with this mobile number already exists."
        : "An account with this email already exists.",
    });
  }

  const password_hash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email: contact.email, phone_number: contact.phone, password_hash })
    .returning();

  const token = await signToken(user.id);
  return res.status(201).json({ token, ...authResponseUser(user, null, language, "user") });
});

/**
 * POST /api/auth/login
 * Verifies credentials and returns a signed JWT.
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid sign-in details" });
  }

  const { password } = parsed.data;
  const contact = resolveContactIdentifier(parsed.data);
  if (!contact) {
    return res.status(400).json({ error: "Please enter a valid email address or mobile number." });
  }

  const user = await findUserByContact(contact);

  const ok = user ? await checkPassword(password, user.password_hash) : false;

  if (!user || !ok) {
    return res.status(401).json({ error: "Incorrect email, mobile number, or password." });
  }

  const prevSeenAt = user.last_seen_at ? user.last_seen_at.toISOString() : null;

  await db
    .update(users)
    .set({ last_seen_at: new Date() })
    .where(eq(users.id, user.id));

  const token = await signToken(user.id);
  return res.json({
    token,
    ...authResponseUser(
      user,
      prevSeenAt,
      await getUserProfileLanguage(user.id),
      await getProfileRole(user.id),
    ),
  });
});

/**
 * GET /api/auth/me
 * Returns the current user's id and email. Requires a valid JWT.
 */
authRouter.get("/me", authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    if (req.user.authProvider === "supabase") {
      const profile = await getOrCreateAuthenticatedProfile(req.user.id, req.user.email);
      if (!profile) {
        return res.status(401).json({ error: "User not found" });
      }

      return res.json({
        id: profile.id,
        email: profile.email ?? (typeof req.user.email === "string" ? req.user.email : null),
        phone: profile.phone ?? null,
        activeProfileId: profile.id,
        language: normalizeProfileLanguage(profile.language),
        role: isSuperAdminEmail(profile.email) || isSuperAdminEmail(req.user.email) ? "admin" : profile.role ?? "user",
        prevSeenAt: null,
      });
    }

    const user = await getOrCreateAuthenticatedUser(req.user.id, req.user.email);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const prevSeenAt = user.last_seen_at ? user.last_seen_at.toISOString() : null;

    await db
      .update(users)
      .set({ last_seen_at: new Date() })
      .where(eq(users.id, user.id));

    return res.json({
      id: user.id,
      email: user.email,
      phone: user.phone_number,
      activeProfileId: user.active_profile_id ?? null,
      language: await getUserProfileLanguage(user.id),
      role: await getProfileRole(user.id),
      prevSeenAt,
    });
  } catch (err) {
    console.error("[auth/me]", err);
    return res.status(500).json({ error: "Could not load your account" });
  }
});

/**
 * POST /api/auth/magic-link-request
 * Sends a short-lived sign-in link. The response stays generic so people
 * cannot probe whether an email or phone number has an account.
 */
authRouter.post("/magic-link-request", async (req: Request, res: Response) => {
  const parsed = magicLinkRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid email address or mobile number." });
  }

  const contact = resolveContactIdentifier(parsed.data);
  if (!contact) {
    return res.status(400).json({ error: "Please enter a valid email address or mobile number." });
  }

  const genericOk: Record<string, unknown> = {
    message: "If an account exists, a secure sign-in link has been sent.",
  };

  const user = await findUserByContact(contact);
  if (!user) {
    return res.json(genericOk);
  }

  const magicToken = await signMagicLoginToken(user.id);
  const fallbackAppUrl = isDev ? `${req.protocol}://${req.get("host")}` : "";
  const appUrl = process.env.APP_URL ?? fallbackAppUrl;
  const magicLink = `${appUrl}/login?magic_token=${encodeURIComponent(magicToken)}`;

  if (user.email) {
    try {
      await sendMagicLoginEmail({ to: user.email, magicLink });
    } catch (err) {
      console.error("[auth] Failed to send magic login email:", err);
      return res.status(500).json({ error: "Failed to send sign-in link. Please try again later." });
    }
  } else if (isDev) {
    console.log("[auth:dev] Magic login link for phone-only account:", magicLink);
  }

  if (isDev) {
    genericOk._devMagicLink = magicLink;
  }

  return res.json(genericOk);
});

/**
 * POST /api/auth/magic-login
 * Exchanges a valid magic link token for the normal app JWT.
 */
authRouter.post("/magic-login", async (req: Request, res: Response) => {
  const parsed = magicLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid magic link" });
  }

  const userId = await verifyMagicLoginToken(parsed.data.token);
  if (!userId) {
    return res.status(401).json({ error: "This sign-in link is invalid or expired." });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return res.status(401).json({ error: "This sign-in link is invalid or expired." });
  }

  const prevSeenAt = user.last_seen_at ? user.last_seen_at.toISOString() : null;
  await db
    .update(users)
    .set({ last_seen_at: new Date() })
    .where(eq(users.id, user.id));

  const token = await signToken(user.id);
  return res.json({
    token,
    ...authResponseUser(
      user,
      prevSeenAt,
      await getUserProfileLanguage(user.id),
      await getProfileRole(user.id),
    ),
  });
});

/**
 * POST /api/auth/access-link/consume
 * Passwordless entry for elder/family invite links. Valid links return the
 * same JWT used by the rest of the app, so onboarding/app routes remain intact.
 */
authRouter.post("/access-link/consume", async (req: Request, res: Response) => {
  const parsed = consumeAccessLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid access link" });
  }

  const [link] = await db
    .select()
    .from(accessLinks)
    .where(eq(accessLinks.token, parsed.data.token))
    .limit(1);

  if (!link || link.revoked_at) {
    return res.status(404).json({ error: "This access link is invalid." });
  }
  if (new Date() > link.expires_at) {
    return res.status(410).json({ error: "This access link has expired." });
  }
  if (link.use_count >= link.max_uses) {
    return res.status(410).json({ error: "This access link has already been used." });
  }

  let userId = link.user_id;
  let intake: typeof userIntakes.$inferSelect | undefined;
  if (link.intake_id) {
    [intake] = await db
      .select()
      .from(userIntakes)
      .where(eq(userIntakes.id, link.intake_id))
      .limit(1);
    userId = userId ?? intake?.user_id ?? intake?.elder_user_id ?? intake?.family_user_id ?? null;
  }

  if (!userId) {
    return res.status(409).json({ error: "This access link is not attached to a user yet." });
  }

  const [profileAccess] = await db
    .select({ account_status: profiles.account_status })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (profileAccess?.account_status === "disabled") {
    return res.status(403).json({ error: "This account is currently disabled." });
  }

  const now = new Date();
  await db
    .update(accessLinks)
    .set({
      clicked_at: link.clicked_at ?? now,
      converted_at: now,
      use_count: link.use_count + 1,
    })
    .where(eq(accessLinks.id, link.id));

  if (intake) {
    await db
      .update(userIntakes)
      .set({
        journey_step: "access_link_clicked",
        last_activity_at: now,
        updated_at: now,
      })
      .where(eq(userIntakes.id, intake.id));

    await db.insert(lifecycleEvents).values({
      intake_id: intake.id,
      user_id: userId,
      event_type: "access_link_clicked",
      from_status: intake.status,
      to_status: intake.status,
      channel: "passwordless_link",
      metadata: { destination: link.destination, link_type: link.link_type },
    });
  }

  await db.update(users).set({ last_seen_at: now }).where(eq(users.id, userId));

  const token = await signToken(userId);
  return res.json({
    token,
    userId,
    destination: link.destination,
    tier: link.tier,
    targetRole: link.target_role,
  });
});

/**
 * POST /api/auth/reset-request
 * Generates a one-time password reset token, stores it in the DB, and emails a
 * reset link to the user. The token is NEVER included in the response in
 * production — in development it is logged to the console and included under
 * `_devToken` so the test suite can retrieve it without an email service.
 * Always returns the same generic 200 regardless of whether the account exists
 * (prevents email enumeration attacks).
 */
authRouter.post("/reset-request", async (req: Request, res: Response) => {
  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid request";
    return res.status(400).json({ error: msg });
  }

  const lowerEmail = parsed.data.email.toLowerCase();

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, lowerEmail))
    .limit(1);

  // Always return the same response regardless of whether the account exists
  // (prevents email enumeration attacks).
  const genericOk = { message: "If an account with that email exists, a reset link has been sent." };

  if (!user || !user.email) {
    return res.json(genericOk);
  }

  const resetToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db
    .update(users)
    .set({ reset_token: resetToken, reset_token_expires_at: expiresAt })
    .where(eq(users.id, user.id));

  const appUrl = process.env.APP_URL ?? (isDev ? `http://localhost:3001` : "");
  const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

  try {
    await sendPasswordResetEmail({ to: user.email, resetLink });
  } catch (err) {
    console.error("[auth] Failed to send password reset email:", err);
    return res.status(500).json({ error: "Failed to send reset email. Please try again later." });
  }

  const response: Record<string, unknown> = { ...genericOk };

  // Expose token only in non-production environments so tests can retrieve it
  // directly from the API without requiring a real mail server.
  if (isDev) {
    response._devToken = resetToken;
  }

  return res.json(response);
});

/**
 * POST /api/auth/reset-password
 * Verifies the one-time token and updates the user's password.
 * Rejects expired or already-consumed tokens.
 */
authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid request";
    return res.status(400).json({ error: msg });
  }

  const { token, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.reset_token, token))
    .limit(1);

  if (!user || !user.reset_token_expires_at) {
    return res.status(400).json({ error: "Invalid or expired reset token." });
  }

  if (new Date() > user.reset_token_expires_at) {
    return res.status(400).json({ error: "This reset link has expired. Please request a new one." });
  }

  const password_hash = await hashPassword(password);

  await db
    .update(users)
    .set({ password_hash, reset_token: null, reset_token_expires_at: null })
    .where(eq(users.id, user.id));

  return res.json({ message: "Password has been reset successfully. You can now log in." });
});
