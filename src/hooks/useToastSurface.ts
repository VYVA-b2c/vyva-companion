import { useEffect, useRef } from "react";

type SurfaceEntry = {
  id: number;
  element: HTMLElement;
  bottomOffset?: number;
};

let nextSurfaceId = 1;
const surfaces = new Map<number, SurfaceEntry>();

function connectedSurfaces() {
  return Array.from(surfaces.values()).filter((entry) => entry.element.isConnected);
}

function updateToastSurfaceVars() {
  const activeSurfaces = connectedSurfaces();
  const surface = activeSurfaces[activeSurfaces.length - 1];
  const bottomSurface = [...activeSurfaces].reverse().find((entry) => typeof entry.bottomOffset === "number");
  const root = document.documentElement;

  if (surface) {
    const rect = surface.element.getBoundingClientRect();
    const width = Math.max(280, Math.min(rect.width - 24, 420));
    root.style.setProperty("--vyva-toast-center-x", `${rect.left + rect.width / 2}px`);
    root.style.setProperty("--vyva-toast-width", `${width}px`);
  } else {
    root.style.removeProperty("--vyva-toast-center-x");
    root.style.removeProperty("--vyva-toast-width");
  }

  if (bottomSurface?.bottomOffset) {
    root.style.setProperty("--vyva-toast-bottom", `${bottomSurface.bottomOffset}px`);
  } else {
    root.style.removeProperty("--vyva-toast-bottom");
  }
}

export function useToastSurface<T extends HTMLElement>(bottomOffset?: number) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const id = nextSurfaceId++;
    surfaces.set(id, { id, element, bottomOffset });
    const resizeObserver = new ResizeObserver(updateToastSurfaceVars);
    resizeObserver.observe(element);

    window.addEventListener("resize", updateToastSurfaceVars);
    window.addEventListener("scroll", updateToastSurfaceVars, true);
    updateToastSurfaceVars();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateToastSurfaceVars);
      window.removeEventListener("scroll", updateToastSurfaceVars, true);
      surfaces.delete(id);
      updateToastSurfaceVars();
    };
  }, [bottomOffset]);

  return ref;
}
