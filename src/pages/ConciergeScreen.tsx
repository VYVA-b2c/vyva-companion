import { Mic, Car, ShoppingCart, Phone, CalendarDays, MapPin, Pill } from "lucide-react";

const tasks = [
  { icon: Car, label: "Book a taxi", color: "#6B21A8", bg: "#F5F3FF" },
  { icon: ShoppingCart, label: "Order groceries", color: "#0A7C4E", bg: "#ECFDF5" },
  { icon: Phone, label: "Call the pharmacy", color: "#B45309", bg: "#FEF9EE" },
  { icon: CalendarDays, label: "Schedule appointment", color: "#1D4ED8", bg: "#EFF6FF" },
  { icon: MapPin, label: "Find nearby services", color: "#0F766E", bg: "#F0FDFA" },
  { icon: Pill, label: "Reorder prescriptions", color: "#B91C1C", bg: "#FEF2F2" },
];

const ConciergeScreen = () => (
  <div className="px-[22px]">
    {/* Hero */}
    <div className="mt-[14px] rounded-[22px] bg-vyva-warm2 p-[22px] text-center">
      <h1 className="font-display text-[22px] text-vyva-text-1 italic">How can I help?</h1>
      <button className="mt-4 mx-auto w-[72px] h-[72px] rounded-full bg-vyva-purple flex items-center justify-center shadow-lg animate-ripple-out">
        <Mic size={32} className="text-white animate-pulse-dot" />
      </button>
      <p className="mt-3 font-body text-[14px] text-vyva-text-2">Just ask VYVA</p>
    </div>

    {/* Task tiles */}
    <div className="mt-4 grid grid-cols-2 gap-3">
      {tasks.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.label}
            className="flex items-center gap-3 rounded-[16px] border border-vyva-border bg-white p-4 min-h-[60px] text-left"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
          >
            <div
              className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
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
