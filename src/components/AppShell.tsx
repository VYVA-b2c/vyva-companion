import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import StatusBar from "./StatusBar";
import BottomNav from "./BottomNav";
const SOS_ROUTES = ["/", "/health", "/meds"];
const FULL_SCREEN_ROUTES = ["/chat"];

const SosFab = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Persistent corner FAB — bottom-left, above BottomNav */}
      <button
        onClick={() => setOpen(true)}
        data-testid="button-sos-fab"
        aria-label="Emergency SOS"
        className="fixed bottom-[98px] left-4 w-12 h-12 rounded-full flex items-center justify-center z-40 sos-btn"
        style={{
          background: "#B91C1C",
          boxShadow: "0 4px 16px rgba(185,28,28,0.45)",
        }}
      >
        <AlertCircle size={20} className="text-white" />
      </button>

      {/* Confirmation sheet */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-[480px] bg-white rounded-t-[24px] p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 -4px 32px rgba(0,0,0,0.18)" }}
          >
            <div className="w-10 h-1 rounded-full bg-vyva-warm2 mx-auto mb-5" />

            {/* Icon */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 sos-btn"
              style={{ background: "#FEE2E2" }}
            >
              <AlertCircle size={28} style={{ color: "#B91C1C" }} />
            </div>

            <h3 className="font-display text-[22px] text-center text-vyva-text-1 mb-1">
              Send emergency alert?
            </h3>
            <p className="font-body text-[14px] text-center text-vyva-text-2 mb-6 px-2">
              This will notify Sarah &amp; James and contact emergency services on your behalf.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-3 rounded-full font-body text-[14px] font-medium text-vyva-text-1 bg-vyva-warm min-h-[56px]"
                data-testid="button-sos-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-3 rounded-full font-body text-[14px] font-medium text-white min-h-[56px]"
                style={{ background: "#B91C1C" }}
                data-testid="button-sos-confirm"
              >
                Send alert now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const showSos = SOS_ROUTES.includes(location.pathname);
  const isFullScreen = FULL_SCREEN_ROUTES.includes(location.pathname);

  return (
    <div className="min-h-screen bg-vyva-cream flex justify-center">
      <div className="w-full max-w-[480px] relative">
        {!isFullScreen && <StatusBar />}
        <main className={`overflow-y-auto min-h-screen ${isFullScreen ? "" : "pt-[68px] pb-[84px]"}`}>
          {children}
        </main>
        {!isFullScreen && <BottomNav />}
        {showSos && <SosFab />}
      </div>
    </div>
  );
};

export default AppShell;
