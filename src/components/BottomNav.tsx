import { Home, Mic, HeartPulse, BrainCircuit, ConciergeBell } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/chat", label: "VYVA", icon: Mic },
  { path: "/health", label: "My Health", icon: HeartPulse },
  { path: "/activities", label: "Activities", icon: BrainCircuit },
  { path: "/concierge", label: "Concierge", icon: ConciergeBell },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-vyva-border z-50"
      style={{ height: 72 }}>
      <div className="flex items-center justify-around h-full px-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 min-h-[56px]"
            >
              <div className={`flex items-center justify-center w-7 h-7 rounded-[10px] ${active ? "bg-vyva-purple-light" : ""}`}>
                <Icon size={20} className={active ? "text-vyva-purple" : "text-vyva-text-3"} />
              </div>
              <span className={`font-body text-[11px] font-medium ${active ? "text-vyva-purple" : "text-vyva-text-3"}`}>
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
