import {
  isAuthenticatedPwaInstallRoute,
  isPublicPwaInstallRoute,
  shouldShowPwaInstallPromptForRoute,
} from "./pwaInstallRoutes";

describe("PWA install prompt route gating", () => {
  it("allows public entry and invite routes before sign-in", () => {
    expect(isPublicPwaInstallRoute("/")).toBe(true);
    expect(isPublicPwaInstallRoute("/invite")).toBe(true);
    expect(isPublicPwaInstallRoute("/login")).toBe(true);
    expect(isPublicPwaInstallRoute("/access/invite-token")).toBe(true);
    expect(isPublicPwaInstallRoute("/care-team/invite/invite-token")).toBe(true);
  });

  it("allows signed-in app areas after onboarding", () => {
    expect(isAuthenticatedPwaInstallRoute("/")).toBe(true);
    expect(isAuthenticatedPwaInstallRoute("/health")).toBe(true);
    expect(isAuthenticatedPwaInstallRoute("/health/symptom-check")).toBe(true);
    expect(isAuthenticatedPwaInstallRoute("/chat")).toBe(true);
    expect(isAuthenticatedPwaInstallRoute("/settings/account")).toBe(true);
    expect(isAuthenticatedPwaInstallRoute("/memory-games/sequence_memory")).toBe(true);
    expect(isAuthenticatedPwaInstallRoute("/brain-coach/remember")).toBe(true);
    expect(isAuthenticatedPwaInstallRoute("/caregiver-dashboard")).toBe(true);
  });

  it("excludes admin, onboarding, profile, reset, shared, and unknown routes", () => {
    expect(shouldShowPwaInstallPromptForRoute("/admin/lifecycle", true)).toBe(false);
    expect(shouldShowPwaInstallPromptForRoute("/onboarding/basics", true)).toBe(false);
    expect(shouldShowPwaInstallPromptForRoute("/profiles/select", true)).toBe(false);
    expect(shouldShowPwaInstallPromptForRoute("/reset-password", false)).toBe(false);
    expect(shouldShowPwaInstallPromptForRoute("/confirm/token", false)).toBe(false);
    expect(shouldShowPwaInstallPromptForRoute("/shared/check-in/token", false)).toBe(false);
    expect(shouldShowPwaInstallPromptForRoute("/not-a-real-page", true)).toBe(false);
  });

  it("keeps public invite routes scoped to unauthenticated placement", () => {
    expect(shouldShowPwaInstallPromptForRoute("/care-team/invite/invite-token", false)).toBe(true);
    expect(shouldShowPwaInstallPromptForRoute("/care-team/invite/invite-token", true)).toBe(false);
  });
});
