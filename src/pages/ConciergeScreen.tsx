import { Mic, Car, ShoppingCart, Phone, Calendar, MapPin, Pill } from "lucide-react";

const tasks = [
  { icon: Car, label: "Book a taxi", color: "#6B21A8", bg: "#F5F3FF" },
  { icon: ShoppingCart, label: "Order groceries", color: "#0A7C4E", bg: "#ECFDF5" },
  { icon: Phone, label: "Call the pharmacy", color: "#0F766E", bg: "#F0FDFA" },
  { icon: Calendar, label: "Schedule appointment", color: "#6B21A8", bg: "#EDE9FE" },
  { icon: MapPin, label: "Find nearby services", color: "#C9890A", bg: "#FEF3C7" },
  { icon: Pill, label: "Reorder prescriptions", color: "#B0355A", bg: "#FDF2F8" },
];

const ConciergeScreen = () => (
  <div className="px-[22px]">
    {/* Hero */}
    <div className="mt-[14px] rounded-[22px] p-[24px_20px] text-center" style={{ background: "#EDE5D8" }}>
      <h1 className="font-display text-[26px] text-vyva-text-1 italic font-normal">How can I help?</h1>
      <button className="mt-4 mx-auto w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-lg animate-ripple-out" style={{ background: "#6B21A8" }}>
        <Mic size={28} className="text-white animate-pulse-dot" />
      </button>
      <p className="mt-3 font-body text-[13px] text-vyva-text-2">Just ask VYVA</p>
    </div>

    {/* Task tiles */}
    <div className="mt-4 grid grid-cols-2 gap-3">
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

export default ConciergeScreen;
