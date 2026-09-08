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

export async function signToken(userId: string, expiresIn = "30d"): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
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

const MAGIC_LOGIN_AUDIENCE = "vyva-magic-login";

export async function signMagicLoginToken(userId: string): Promise<string> {
  return new SignJWT({
    sub: userId,
    token_type: "magic_login",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(MAGIC_LOGIN_AUDIENCE)
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

export async function verifyMagicLoginToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      audience: MAGIC_LOGIN_AUDIENCE,
    });
    if (payload.token_type !== "magic_login") return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

const MEDICAL_PROFILE_AUDIENCE = "elevenlabs-medical-profile";
const VOICE_RECOMMENDATION_FEEDBACK_AUDIENCE = "elevenlabs-voice-recommendation-feedback";
const VOICE_TRIAGE_AUDIENCE = "elevenlabs-voice-triage";
const CALLBACK_ONBOARDING_AUDIENCE = "elevenlabs-callback-onboarding";
const MARKETING_META_CONNECT_AUDIENCE = "vyva-marketing-meta-connect";

export async function signMarketingMetaConnectState(userId: string): Promise<string> {
  return new SignJWT({
    sub: userId,
    token_type: "marketing_meta_connect",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(MARKETING_META_CONNECT_AUDIENCE)
    .setExpirationTime("10m")
    .sign(JWT_SECRET);
}

export async function verifyMarketingMetaConnectState(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      audience: MARKETING_META_CONNECT_AUDIENCE,
    });
    if (payload.token_type !== "marketing_meta_connect" || typeof payload.sub !== "string") {
      return null;
    }
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export async function signMedicalProfileToolToken(
  userId: string,
  conversationId: string,
): Promise<string> {
  return new SignJWT({
    sub: userId,
    conversation_id: conversationId,
    token_type: "medical_profile_tool",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(MEDICAL_PROFILE_AUDIENCE)
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

export async function verifyMedicalProfileToolToken(
  token: string,
): Promise<{ userId: string; conversationId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      audience: MEDICAL_PROFILE_AUDIENCE,
    });
    if (
      payload.token_type !== "medical_profile_tool" ||
      typeof payload.sub !== "string" ||
      typeof payload.conversation_id !== "string"
    ) {
      return null;
    }
    return { userId: payload.sub, conversationId: payload.conversation_id };
  } catch {
    return null;
  }
}

export async function signVoiceRecommendationFeedbackToolToken(
  userId: string,
  conversationId: string,
): Promise<string> {
  return new SignJWT({
    sub: userId,
    conversation_id: conversationId,
    token_type: "voice_recommendation_feedback_tool",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(VOICE_RECOMMENDATION_FEEDBACK_AUDIENCE)
    .setExpirationTime("2h")
    .sign(JWT_SECRET);
}

export async function verifyVoiceRecommendationFeedbackToolToken(
  token: string,
): Promise<{ userId: string; conversationId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      audience: VOICE_RECOMMENDATION_FEEDBACK_AUDIENCE,
    });
    if (
      payload.token_type !== "voice_recommendation_feedback_tool" ||
      typeof payload.sub !== "string" ||
      typeof payload.conversation_id !== "string"
    ) {
      return null;
    }
    return { userId: payload.sub, conversationId: payload.conversation_id };
  } catch {
    return null;
  }
}

export async function signVoiceTriageToolToken(
  userId: string,
  conversationId: string,
): Promise<string> {
  return new SignJWT({
    sub: userId,
    conversation_id: conversationId,
    token_type: "voice_triage_tool",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(VOICE_TRIAGE_AUDIENCE)
    .setExpirationTime("2h")
    .sign(JWT_SECRET);
}

export async function verifyVoiceTriageToolToken(
  token: string,
): Promise<{ userId: string; conversationId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      audience: VOICE_TRIAGE_AUDIENCE,
    });
    if (
      payload.token_type !== "voice_triage_tool" ||
      typeof payload.sub !== "string" ||
      typeof payload.conversation_id !== "string"
    ) {
      return null;
    }
    return { userId: payload.sub, conversationId: payload.conversation_id };
  } catch {
    return null;
  }
}

export async function signCallbackOnboardingToolToken(
  intakeId: string,
  expiresIn = "12h",
): Promise<string> {
  return new SignJWT({
    sub: intakeId,
    token_type: "callback_onboarding_tool",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(CALLBACK_ONBOARDING_AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyCallbackOnboardingToolToken(
  token: string,
): Promise<{ intakeId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      audience: CALLBACK_ONBOARDING_AUDIENCE,
    });
    if (
      payload.token_type !== "callback_onboarding_tool" ||
      typeof payload.sub !== "string"
    ) {
      return null;
    }
    return { intakeId: payload.sub };
  } catch {
    return null;
  }
}
