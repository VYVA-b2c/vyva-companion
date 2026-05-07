import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import StatusBar from "./StatusBar";
import BottomNav from "./BottomNav";
import { useServiceGate } from "@/hooks/useServiceGate";
import { useToastSurface } from "@/hooks/useToastSurface";

const FULL_SCREEN_ROUTES = ["/chat"];
const WIDE_ROUTES = ["/social-rooms"];

const SosSheet = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-[520px] rounded-t-[28px] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 -4px 32px rgba(0,0,0,0.18)" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-vyva-warm2" />

        <div
          className="sos-btn mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "#FEE2E2" }}
        >
          <AlertCircle size={28} style={{ color: "#B91C1C" }} />
        </div>

        <h3 className="mb-1 text-center font-display text-[22px] text-vyva-text-1">{t("sos.title")}</h3>
        <p className="mb-6 px-2 text-center font-body text-[14px] text-vyva-text-2">
          {t("sos.description")}
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="vyva-secondary-action flex-1"
            data-testid="button-sos-cancel"
          >
            {t("sos.cancel")}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="vyva-primary-action flex-1"
            style={{ background: "#B91C1C" }}
            data-testid="button-sos-confirm"
          >
            {t("sos.sendNow")}
          </button>
        </div>
      </div>
    </div>
  );
};

const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { canUseService } = useServiceGate();
  const [sosOpen, setSosOpen] = useState(false);
  const isFullScreen = FULL_SCREEN_ROUTES.includes(location.pathname);
  const isWideRoute = WIDE_ROUTES.some((route) => location.pathname.startsWith(route));
  const toastSurfaceRef = useToastSurface<HTMLDivElement>(isFullScreen ? 24 : 112);

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,#fffaf2_0%,#f7f1e9_42%,#f4efe8_100%)]">
      <div ref={toastSurfaceRef} className={`relative w-full ${isWideRoute ? "max-w-[768px]" : "max-w-[520px]"}`}>
        {!isFullScreen && <StatusBar />}
        <main className={`min-h-screen overflow-y-auto ${isFullScreen ? "" : "pt-[76px] pb-[104px]"}`}>
          {children}
        </main>
        {!isFullScreen && <BottomNav onSosClick={() => {
          if (canUseService("sos", "/sos")) setSosOpen(true);
        }} />}
        {!isFullScreen && <SosSheet open={sosOpen} onOpenChange={setSosOpen} />}
      </div>
    </div>
  );
};

export default AppShell;
