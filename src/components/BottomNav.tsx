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
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-vyva-border z-50"
      style={{ height: 72 }}
    >
      <div className="flex items-center justify-around h-full px-1">
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
              className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] relative"
            >
              <div
                className={`flex items-center justify-center w-14 h-8 rounded-full transition-all ${
                  active ? "bg-vyva-purple-light" : ""
                }`}
              >
                <Icon
                  size={22}
                  className={active ? "text-vyva-purple" : "text-vyva-text-3"}
                  strokeWidth={active ? 2.2 : 1.8}
                />
              </div>
              <span
                className={`font-body text-[9px] font-medium transition-colors leading-tight text-center ${
                  active ? "text-vyva-purple" : "text-vyva-text-3"
                }`}
              >
                {label}
              </span>
              {subtitle && (
                <span
                  className={`font-body text-[7px] leading-none text-center -mt-0.5 ${
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
