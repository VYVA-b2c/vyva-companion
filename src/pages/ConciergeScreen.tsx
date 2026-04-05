import { useNavigate } from "react-router-dom";
import { Mic, Car, ShoppingCart, Phone, Calendar, MapPin, Pill } from "lucide-react";

const tasks = [
  { icon: Car, label: "Book a taxi", color: "#6B21A8", bg: "#F5F3FF" },
  { icon: ShoppingCart, label: "Order groceries", color: "#0A7C4E", bg: "#ECFDF5" },
  { icon: Phone, label: "Call the pharmacy", color: "#0F766E", bg: "#F0FDFA" },
  { icon: Calendar, label: "Schedule appointment", color: "#6B21A8", bg: "#EDE9FE" },
  { icon: MapPin, label: "Find nearby services", color: "#C9890A", bg: "#FEF3C7" },
  { icon: Pill, label: "Reorder prescriptions", color: "#B0355A", bg: "#FDF2F8" },
];

const ConciergeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="px-[22px]">
      {/* Voice-First Hero */}
      <div className="mt-[14px] rounded-[24px] p-[24px_22px] relative overflow-hidden hero-purple">
        <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Source row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
              <Mic size={16} className="text-white" />
            </div>
            <span className="font-body text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>VYVA handles it for you</span>
          </div>
          <div className="flex items-center gap-1.5 px-[10px] py-[3px] rounded-full" style={{ background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
            <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
            <span className="text-[11px] font-body" style={{ color: "#34D399" }}>Live</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-display italic font-normal text-[26px] text-white leading-[1.3]">
          How can I help?
        </h1>
        <p className="font-body text-[14px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>Taxis, orders, appointments & more</p>

        {/* Talk button */}
        <button
          onClick={() => navigate("/chat")}
          className="w-full flex items-center justify-center gap-2 rounded-full py-[13px] px-[20px] mt-4 min-h-[56px] mic-listening"
          style={{ background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.18)" }}
        >
          <Mic size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
          <span className="font-body text-[16px] font-medium text-white">Talk to VYVA</span>
        </button>
      </div>

      {/* Task tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 mb-4">
        {tasks.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              className="flex items-center gap-[14px] rounded-[18px] border border-vyva-border bg-white p-[18px_16px] text-left"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", minHeight: 72 }}
            >
              <div
                className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center flex-shrink-0"
                style={{ background: t.bg }}
              >
                <Icon size={20} style={{ color: t.color }} />
              </div>
              <span className="font-body text-[14px] font-medium text-vyva-text-1">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConciergeScreen;
