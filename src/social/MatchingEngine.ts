import { apiFetch } from "@/lib/queryClient";
import type { SocialLanguage, SocialMatchResponse } from "./types";

export async function findMatch(roomSlug: string, language: SocialLanguage): Promise<SocialMatchResponse> {
  const response = await apiFetch(`/api/social/rooms/${roomSlug}/match`, {
    method: "POST",
    body: JSON.stringify({ lang: language }),
  });

  if (!response.ok) {
    throw new Error("Unable to find a match right now.");
  }

  return response.json();
}

