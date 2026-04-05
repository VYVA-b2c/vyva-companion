import { useState } from "react";
import { Mic, Stethoscope, MapPin } from "lucide-react";
import { symptoms as initialSymptoms } from "@/data/mockData";

const HealthScreen = () => {
  const [symptoms, setSymptoms] = useState(initialSymptoms);

  const toggleSymptom = (i: number) => {
    setSymptoms(s => s.map((sym, idx) => idx === i ? { ...sym, selected: !sym.selected } : sym));
  };

  return (
    <div className="px-[22px]">
      {/* Hero */}
      <div className="mt-[14px] rounded-[22px] p-5 relative overflow-hidden" style={{ background: "#0A7C4E" }}>
        <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />
        <p className="font-body text-[11px] font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.65)" }}>Your health</p>
        <h1 className="font-display text-[22px] font-normal text-white mt-[5px]">All looking good, Margaret</h1>
        <div className="mt-[14px] pt-[14px] flex justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          {[
            { val: "Normal", label: "Blood pressure" },
            { val: "Good", label: "Mood" },
            { val: "7h 20m", label: "Sleep" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="font-body text-[17px] font-medium text-white">{s.val}</p>
              <p className="font-body text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Symptom Checker */}
      <div className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">How are you feeling?</span>
        </div>
        <div className="p-[16px_18px]">
          <p className="font-body text-[14px] text-vyva-text-2 mb-3">Select any symptoms</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {symptoms.map((sym, i) => (
              <button
                key={sym.label}
                onClick={() => toggleSymptom(i)}
                className="font-body text-[14px] py-[9px] px-4 rounded-full min-h-[44px] transition-colors"
                style={
                  sym.selected
                    ? { background: "#EDE9FE", color: "#6B21A8", border: "1px solid #EDE9FE" }
                    : sym.urgent
                    ? { background: "#FEF3C7", color: "#92400E", border: "1px solid #FEF3C7" }
                    : { background: "#F5EFE4", color: "#2C2320", border: "1px solid #EDE5DB" }
                }
              >
                {sym.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-[10px] p-[13px_16px] rounded-[14px]" style={{ background: "#F5F3FF", border: "1px solid #EDE9FE" }}>
            <Mic size={18} style={{ color: "#6B21A8" }} className="flex-shrink-0" />
            <span className="font-body text-[14px] font-medium" style={{ color: "#6B21A8" }}>Tell VYVA how you're feeling</span>
          </div>
        </div>
      </div>

      {/* Doctor referrals */}
      <div className="mt-[14px] mb-4 bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">Doctor & services</span>
        </div>
        {[
          { icon: Stethoscope, label: "Speak to a doctor", sub: "Get a GP referral or advice", color: "#0A7C4E", bg: "#ECFDF5" },
          { icon: MapPin, label: "Nearby clinics", sub: "Find walk-in centres near you", color: "#0F766E", bg: "#F0FDFA" },
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

export default HealthScreen;
