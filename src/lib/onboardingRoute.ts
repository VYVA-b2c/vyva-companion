import { getToken } from "@/lib/auth";

/**
 * Maps a backend `current_stage` value to the correct frontend route.
 * Used after login and on the welcome screen to route authenticated users
 * to the right place without showing the marketing welcome screen.
 */
export function stageToRoute(stage: string | null | undefined): string {
  switch (stage) {
    case "complete":            return "/";
    case "stage_1_identity":    return "/onboarding/basics";
    case "stage_2_preferences": return "/onboarding/channel";
    case "stage_3_health":
    case "stage_4_care_team":
    case "stage_5_consent":     return "/onboarding/consent";
    default:                    return "/onboarding/who-for";
  }
}

/**
 * Fetches /api/onboarding/state with the stored JWT and returns the
 * correct destination route for the currently authenticated user.
 * Falls back to /onboarding/basics on any error.
 */
export async function resolveOnboardingRoute(): Promise<string> {
  try {
    const tok = getToken();
    if (!tok) return "/onboarding/who-for";
    const res = await fetch("/api/onboarding/state", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!res.ok) return "/onboarding/who-for";
    const data = await res.json();
    return stageToRoute(
      data?.onboardingState?.current_stage ?? data?.profile?.current_stage,
    );
  } catch {
    return "/onboarding/who-for";
  }
}
