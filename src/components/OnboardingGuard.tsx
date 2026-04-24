import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";

/**
 * Wraps all /onboarding/* routes.
 *
 * Fetches /api/onboarding/state once via React Query and keeps the result in
 * the shared cache.  Subsequent navigations between onboarding steps reuse the
 * cached value — no additional network requests are made until the cache is
 * explicitly invalidated (e.g. after a successful step submission).
 *
 * Shows a spinner only on the very first visit (cold cache).
 */
export default function OnboardingGuard() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/onboarding/state"],
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vyva-cream">
        <div
          data-testid="spinner-onboarding-guard"
          className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-[#6B21A8] animate-spin"
        />
      </div>
    );
  }

  const record = data as Record<string, unknown> | null | undefined;
  const stage =
    (record?.onboardingState as Record<string, unknown> | null | undefined)
      ?.current_stage ??
    (record?.profile as Record<string, unknown> | null | undefined)
      ?.current_stage;

  if (stage === "complete") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
