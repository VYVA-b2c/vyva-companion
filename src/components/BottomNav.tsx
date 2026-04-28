import { House, Activity, Pill, BrainCircuit, FileText, ClipboardList } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const tabs = [
    { path: "/",          labelKey: "nav.home",             icon: House },
    { path: "/settings",  labelKey: "nav.symptoms",          icon: FileText },
    { path: "/health",    labelKey: "nav.vitalSigns",        icon: Activity },
    { path: "/meds",      labelKey: "nav.medications",       icon: Pill },
    { path: "/activities",labelKey: "nav.cognitiveActivity", icon: BrainCircuit },
    { path: "/history",   labelKey: "nav.history",           icon: ClipboardList, subtitleKey: "history.subtitle" },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 border-t border-vyva-border bg-white/95 shadow-[0_-8px_28px_rgba(63,45,35,0.08)] backdrop-blur"
      style={{ height: 88 }}
    >
      <div className="flex h-full items-center justify-around px-1.5">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          const label = t(tab.labelKey);
          const subtitle = "subtitleKey" in tab ? t(tab.subtitleKey) : null;
          return (
            <button
              key={tab.path}
              data-testid={`nav-tab-${tab.labelKey.replace("nav.", "")}`}
              onClick={() => navigate(tab.path)}
              className="relative flex min-h-[70px] flex-1 flex-col items-center justify-center gap-1 rounded-[18px]"
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
                className={`max-w-[62px] text-center font-body text-[10.5px] font-semibold leading-tight transition-colors ${
                  active ? "text-vyva-purple" : "text-vyva-text-3"
                }`}
              >
                {label}
              </span>
              {subtitle && (
                <span
                  className={`hidden font-body text-[7px] leading-none text-center -mt-0.5 ${
                    active ? "text-vyva-purple opacity-80" : "text-vyva-text-3 opacity-60"
                  }`}
                  data-testid={`nav-tab-subtitle-${tab.labelKey.replace("nav.", "")}`}
                >
                  {subtitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
