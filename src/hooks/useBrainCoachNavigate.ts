import { useCallback } from "react";
import { useLocation, useNavigate, type NavigateFunction, type NavigateOptions, type To } from "react-router-dom";

export function brainCoachNavigationPath(destination: string, currentPath: string) {
  if (currentPath !== "/dev/home-master/brain" && !currentPath.startsWith("/dev/brain/")) return destination;
  const suffixIndex = destination.search(/[?#]/);
  const path = suffixIndex < 0 ? destination : destination.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : destination.slice(suffixIndex);
  if (path === "/mind-memory") return `/dev/home-master/brain${suffix}`;
  if (path === "/menu") return `/dev/home-master/menu${suffix}`;
  if (path.startsWith("/brain-coach/")) return `/dev/brain/${path.slice(13)}${suffix}`;
  if (path === "/memory-games") return `/dev/brain/remember${suffix}`;
  if (path.startsWith("/memory-games/") || path === "/attention-boosters/rhythm-tap") return `/dev/brain${destination}`;
  return destination;
}

export function useBrainCoachNavigate(): NavigateFunction {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback((to: To | number, options?: NavigateOptions) => {
    if (typeof to === "number") return navigate(to);
    navigate(typeof to === "string" ? brainCoachNavigationPath(to, pathname) : {
      ...to,
      pathname: brainCoachNavigationPath(to.pathname ?? "", pathname),
    }, options);
  }, [navigate, pathname]) as NavigateFunction;
}
