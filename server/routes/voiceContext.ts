import type { Request, Response } from "express";
import { buildVoiceContext, type VoiceContextDomain } from "../lib/voiceContext.js";

const KNOWN_DOMAINS = new Set<VoiceContextDomain>([
  "safety",
  "meds",
  "health",
  "concierge",
  "brain_coach",
  "companion",
  "doctor",
  "social",
]);

function normalizeSlug(value?: string) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || "";
}

function resolveDomain(body: Record<string, unknown>): VoiceContextDomain {
  const rawDomain = typeof body.domain === "string" ? normalizeSlug(body.domain) : "";
  if (KNOWN_DOMAINS.has(rawDomain as VoiceContextDomain)) {
    return rawDomain as VoiceContextDomain;
  }

  const agentSlug = typeof body.agent_slug === "string" ? normalizeSlug(body.agent_slug) : "";
  const roomSlug = typeof body.room_slug === "string" ? normalizeSlug(body.room_slug) : "";
  if (agentSlug === "doctor" || agentSlug === "medical-doctor") return "doctor";
  if (roomSlug || agentSlug) return "social";
  return "companion";
}

export async function voiceContextHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const domain = resolveDomain(body);
    const memoryQuery = typeof body.memory_query === "string" ? body.memory_query : "";
    const dynamicVariables = await buildVoiceContext(userId, domain, memoryQuery);
    return res.json({ domain, dynamic_variables: dynamicVariables });
  } catch (err) {
    console.error("[voice-context]", err);
    return res.status(500).json({ error: "Failed to build voice context" });
  }
}
