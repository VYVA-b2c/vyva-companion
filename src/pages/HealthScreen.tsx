import { useState } from "react";
import { Mic, Stethoscope, MapPin } from "lucide-react";
import { symptoms as initialSymptoms } from "@/data/mockData";
import VoiceHero from "@/components/VoiceHero";

const HealthScreen = () => {
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState(initialSymptoms);

  const toggleSymptom = (i: number) => {
    setSymptoms(s => s.map((sym, idx) => idx === i ? { ...sym, selected: !sym.selected } : sym));
  };

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
            <span className="font-body text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>VYVA monitors your health</span>
          </div>
          <div className="flex items-center gap-1.5 px-[10px] py-[3px] rounded-full" style={{ background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
            <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
            <span className="text-[11px] font-body" style={{ color: "#34D399" }}>Live</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-display italic font-normal text-[26px] text-white leading-[1.3]">
          How are you feeling,{"\n"}Margaret?
        </h1>
        <p className="font-body text-[14px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>Tell me about your symptoms</p>

        {/* Talk button */}
        <button
          onClick={() => navigate("/chat")}
          className="w-full flex items-center justify-center gap-2 rounded-full py-[13px] px-[20px] mt-4 min-h-[56px] mic-listening"
          style={{ background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.18)" }}
        >
          <Mic size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
          <span className="font-body text-[16px] font-medium text-white">Talk to VYVA</span>
        </button>

        {/* Stats row */}
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
