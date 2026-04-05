import { useNavigate } from "react-router-dom";
import { Check, Clock, Pill, AlertCircle, Calendar, Link as LinkIcon, Mic } from "lucide-react";
import { margaret } from "@/data/mockData";

const MedsScreen = () => {
  const navigate = useNavigate();
  const takenCount = margaret.medications.filter(m => m.status === "taken").length;

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
            <span className="font-body text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>VYVA manages your meds</span>
          </div>
          <div className="flex items-center gap-1.5 px-[10px] py-[3px] rounded-full" style={{ background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
            <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
            <span className="text-[11px] font-body" style={{ color: "#34D399" }}>Live</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-display italic font-normal text-[26px] text-white leading-[1.3]">
          Need help with{"\n"}medications?
        </h1>
        <p className="font-body text-[14px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
          {takenCount} of {margaret.medications.length} taken today
        </p>

        {/* Progress bar */}
        <div className="w-full h-[6px] rounded-full mt-3" style={{ background: "rgba(255,255,255,0.15)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(takenCount / margaret.medications.length) * 100}%`, background: "#34D399" }} />
        </div>

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

      {/* Today's Medications */}
      <div className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">Today's schedule</span>
          <span className="font-body text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>1 due tonight</span>
        </div>
        {margaret.medications.map((med, i) => (
          <div key={i} className="flex items-center gap-[14px] px-[18px] py-[14px] border-b border-vyva-border last:border-b-0" style={{ minHeight: 64 }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: med.status === "taken" ? "#ECFDF5" : "#FEF3C7" }}>
              {med.status === "taken" ? <Check size={18} style={{ color: "#0A7C4E" }} /> : <Clock size={18} style={{ color: "#C9890A" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-medium text-vyva-text-1">{med.name}</p>
              <p className="font-body text-[13px] text-vyva-text-2">{med.note}</p>
            </div>
            <span className="font-body text-[13px] font-medium px-2.5 py-0.5 rounded-full flex-shrink-0" style={med.status === "taken" ? { background: "#ECFDF5", color: "#065F46" } : { background: "#FEF3C7", color: "#92400E" }}>
              {med.status === "taken" ? "Taken" : "Tonight"}
            </span>
          </div>
        ))}
        <div className="px-[18px] py-[14px]">
          <button className="w-full flex items-center justify-center gap-2 rounded-full py-[15px] px-[20px] font-body text-[16px] font-medium text-white min-h-[56px]" style={{ background: "#6B21A8" }}>
            <LinkIcon size={18} />
            Confirm I've taken Metformin
          </button>
        </div>
      </div>

      {/* Medication Info */}
      <div className="mt-[14px] mb-4 bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">Medication info</span>
        </div>
        {[
          { icon: Calendar, label: "Refill reminder", sub: "Aspirin refill due in 5 days", color: "#C9890A", bg: "#FEF3C7" },
          { icon: AlertCircle, label: "Interactions", sub: "No known interactions detected", color: "#0A7C4E", bg: "#ECFDF5" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-[14px] px-[18px] py-[14px] border-b border-vyva-border last:border-b-0" style={{ minHeight: 64 }}>
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
              <item.icon size={18} style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-medium text-vyva-text-1">{item.label}</p>
              <p className="font-body text-[13px] text-vyva-text-2">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MedsScreen;
