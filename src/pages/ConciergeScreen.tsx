import { Car, ShoppingCart, Phone, Calendar, MapPin, Pill } from "lucide-react";
import VoiceHero from "@/components/VoiceHero";

const tasks = [
  { icon: Car, label: "Book a taxi", color: "#6B21A8", bg: "#F5F3FF" },
  { icon: ShoppingCart, label: "Order groceries", color: "#0A7C4E", bg: "#ECFDF5" },
  { icon: Phone, label: "Call the pharmacy", color: "#0F766E", bg: "#F0FDFA" },
  { icon: Calendar, label: "Schedule appointment", color: "#6B21A8", bg: "#EDE9FE" },
  { icon: MapPin, label: "Find nearby services", color: "#C9890A", bg: "#FEF3C7" },
  { icon: Pill, label: "Reorder prescriptions", color: "#B0355A", bg: "#FDF2F8" },
];

const ConciergeScreen = () => {
  return (
    <div className="px-[22px]">
      <VoiceHero
        sourceText="VYVA handles it for you"
        headline="How can I help?"
        subtitle="Taxis, orders, appointments & more"
      />

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
