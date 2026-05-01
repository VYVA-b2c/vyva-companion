import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { z } from "zod";
import { db } from "../db.js";
import { accessLinks, lifecycleEvents, profiles, userIntakes, users } from "../../shared/schema.js";
import { signToken } from "../lib/jwt.js";
import { authMiddleware } from "../middleware/auth.js";
import { sendPasswordResetEmail } from "../lib/email.js";

const scryptAsync = promisify(scrypt);

const isDev = process.env.NODE_ENV !== "production";

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
  email:    z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
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

  const { email, password } = parsed.data;
  const lowerEmail = email.toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, lowerEmail))
    .limit(1);

  if (existing.length > 0) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const password_hash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email: lowerEmail, password_hash })
    .returning();

  await db.insert(profiles).values({ id: user.id }).onConflictDoNothing();

  const token = await signToken(user.id);
  return res.status(201).json({ token, userId: user.id, email: user.email });
});

/**
 * POST /api/auth/login
 * Verifies credentials and returns a signed JWT.
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  const ok = user ? await checkPassword(password, user.password_hash) : false;

  if (!user || !ok) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const prevSeenAt = user.last_seen_at ? user.last_seen_at.toISOString() : null;

  await db
    .update(users)
    .set({ last_seen_at: new Date() })
    .where(eq(users.id, user.id));

  const token = await signToken(user.id);
  return res.json({ token, userId: user.id, email: user.email, prevSeenAt });
});

/**
 * GET /api/auth/me
 * Returns the current user's id and email. Requires a valid JWT.
 */
authRouter.get("/me", authMiddleware, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, last_seen_at: users.last_seen_at })
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1);

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  const prevSeenAt = user.last_seen_at ? user.last_seen_at.toISOString() : null;

  await db
    .update(users)
    .set({ last_seen_at: new Date() })
    .where(eq(users.id, user.id));

  return res.json({ id: user.id, email: user.email, prevSeenAt });
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

  if (!user) {
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
