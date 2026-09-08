const PUBLIC_PWA_INSTALL_EXACT_PATHS = new Set(["/", "/invite", "/login"]);
const PUBLIC_PWA_INSTALL_PREFIXES = ["/access/", "/care-team/invite/"];

const AUTHENTICATED_PWA_INSTALL_PATHS = [
  "/",
  "/activity",
  "/attention-boosters",
  "/brain-coach",
  "/caregiver",
  "/caregiver-dashboard",
  "/chat",
  "/companions",
  "/concierge",
  "/dual-task-walk",
  "/executive-function",
  "/face-name-match",
  "/health",
  "/history",
  "/informes",
  "/learn",
  "/language",
  "/meds",
  "/mind-memory",
  "/memory-games",
  "/safe-home",
  "/scam-guard",
  "/settings",
  "/social-rooms",
  "/spatial-navigator",
];

function normalizePathname(pathname: string) {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
}

function matchesPathOrChild(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function isPublicPwaInstallRoute(pathname: string) {
  const normalized = normalizePathname(pathname);
  return PUBLIC_PWA_INSTALL_EXACT_PATHS.has(normalized) ||
    PUBLIC_PWA_INSTALL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isAuthenticatedPwaInstallRoute(pathname: string) {
  const normalized = normalizePathname(pathname);
  return AUTHENTICATED_PWA_INSTALL_PATHS.some((basePath) => matchesPathOrChild(normalized, basePath));
}

export function shouldShowPwaInstallPromptForRoute(pathname: string, authenticated: boolean) {
  return authenticated ? isAuthenticatedPwaInstallRoute(pathname) : isPublicPwaInstallRoute(pathname);
}
