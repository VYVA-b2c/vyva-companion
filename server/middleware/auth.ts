import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; [key: string]: unknown };
    }
  }
}

/**
 * Authentication middleware.
 *
 * Reads a JWT from `Authorization: Bearer <token>`, verifies it, and sets
 * `req.user.id` from the token's `sub` claim.
 *
 * - Valid token  → sets req.user and calls next()
 * - Invalid token → immediately returns 401 (prevents fallthrough)
 * - No token     → calls next() without setting req.user
 *                  (protected routes use requireUser to enforce auth)
 *
 * Development fallback: when NODE_ENV is not "production", a bare
 * `x-user-id` header is also accepted (for local tooling pre-dating JWT auth).
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"] as string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = await verifyToken(token);
    if (userId) {
      req.user = { id: userId };
      return next();
    }
    // Token present but invalid — reject immediately, don't fall through
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Dev/test fallback — trust x-user-id header only outside production
  if (process.env.NODE_ENV !== "production") {
    const rawId = req.headers["x-user-id"] as string | undefined;
    if (rawId && rawId.trim().length > 0) {
      req.user = { id: rawId.trim() };
      return next();
    }
  }

  next();
}

/**
 * Route-level guard. Call after authMiddleware on any route that requires
 * a logged-in user. Returns 401 if req.user is not set.
 */
export function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}
