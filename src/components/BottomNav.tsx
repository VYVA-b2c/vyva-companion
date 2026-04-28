import { AlertCircle, ClipboardList, House } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const BottomNav = ({ onSosClick }: { onSosClick: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const tabs = [
    { path: "/", label: t("nav.home"), icon: House },
    { path: "/informes", label: t("informes.title", "Reports"), icon: ClipboardList },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 border-t border-vyva-border bg-white/95 shadow-[0_-8px_28px_rgba(63,45,35,0.08)] backdrop-blur"
      style={{ height: 88 }}
    >
      <div className="grid h-full grid-cols-3 items-center gap-2 px-4">
        {tabs.slice(0, 1).map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              data-testid="nav-tab-home"
              onClick={() => navigate(tab.path)}
              className="relative flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-[18px]"
            >
              <div
                className={`flex h-9 w-14 items-center justify-center rounded-full transition-all ${
                  active ? "bg-vyva-purple-light shadow-sm" : ""
                }`}
              >
                <Icon
                  size={23}
                  className={active ? "text-vyva-purple" : "text-vyva-text-3"}
                  strokeWidth={active ? 2.2 : 1.8}
                />
              </div>
              <span
                className={`max-w-[72px] text-center font-body text-[12px] font-semibold leading-tight transition-colors ${
                  active ? "text-vyva-purple" : "text-vyva-text-3"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
        <button
          data-testid="nav-tab-sos"
          onClick={onSosClick}
          className="relative -mt-5 flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-[22px]"
          aria-label="SOS"
        >
          <div className="sos-btn flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[#B91C1C] shadow-[0_8px_22px_rgba(185,28,28,0.36)]">
            <AlertCircle size={29} className="text-white" />
          </div>
          <span className="font-body text-[12px] font-bold leading-tight text-[#B91C1C]">SOS</span>
        </button>
        {tabs.slice(1).map((tab) => {
          const active = location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              data-testid="nav-tab-reports"
              onClick={() => navigate(tab.path)}
              className="relative flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-[18px]"
            >
              <div
                className={`flex h-9 w-14 items-center justify-center rounded-full transition-all ${
                  active ? "bg-vyva-purple-light shadow-sm" : ""
                }`}
              >
                <Icon
                  size={23}
                  className={active ? "text-vyva-purple" : "text-vyva-text-3"}
                  strokeWidth={active ? 2.2 : 1.8}
                />
              </div>
              <span
                className={`max-w-[72px] text-center font-body text-[12px] font-semibold leading-tight transition-colors ${
                  active ? "text-vyva-purple" : "text-vyva-text-3"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
