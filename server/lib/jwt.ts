import { SignJWT, jwtVerify } from "jose";

const rawSecret = process.env.JWT_SECRET;

if (!rawSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "[auth] JWT_SECRET environment variable is not set. " +
    "Configure it as a secret before deploying to production."
  );
}

if (!rawSecret) {
  console.warn(
    "[auth] WARNING: JWT_SECRET is not set. " +
    "Using a non-persistent dev-only key — all sessions will invalidate on restart. " +
    "Set JWT_SECRET before deploying."
  );
}

const JWT_SECRET = new TextEncoder().encode(
  rawSecret ?? "dev-only-key-do-not-use-in-production"
);

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
