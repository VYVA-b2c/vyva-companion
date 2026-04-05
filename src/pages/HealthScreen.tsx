import { useState } from "react";
import { Check, Clock, Mic, Link as LinkIcon } from "lucide-react";
import { margaret, symptoms as initialSymptoms } from "@/data/mockData";

const HealthScreen = () => {
  const [symptoms, setSymptoms] = useState(initialSymptoms);
  const takenCount = margaret.medications.filter(m => m.status === "taken").length;

  const toggleSymptom = (i: number) => {
    setSymptoms(s => s.map((sym, idx) => idx === i ? { ...sym, selected: !sym.selected } : sym));
  };

  return (
    <div className="px-[22px]">
      {/* Health Hero */}
      <div className="mt-[14px] rounded-[22px] p-5 relative overflow-hidden" style={{ background: "#0A7C4E" }}>
        <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />
        <p className="font-body text-[11px] font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.65)" }}>Your health today</p>
        <h1 className="font-display text-[22px] font-normal text-white mt-[5px]">All looking good, Margaret</h1>
        <div className="mt-[14px] pt-[14px] flex justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          {[
            { val: `${takenCount}/3`, label: "Meds taken" },
            { val: "Normal", label: "Blood pressure" },
            { val: "Good", label: "Mood" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="font-body text-[17px] font-medium text-white">{s.val}</p>
              <p className="font-body text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Medications */}
      <div className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">Today's medications</span>
          <span className="font-body text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>1 due tonight</span>
        </div>
        {margaret.medications.map((med, i) => (
          <div key={i} className="flex items-center gap-[14px] px-[18px] py-[14px] border-b border-vyva-border last:border-b-0" style={{ minHeight: 64 }}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${med.status === "taken" ? "" : ""}`} style={{ background: med.status === "taken" ? "#ECFDF5" : "#FEF3C7" }}>
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

      {/* Symptom Checker */}
      <div className="mt-[14px] mb-4 bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
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
            <span className="font-body text-[14px] font-medium" style={{ color: "#6B21A8" }}>Tell VYVA how you're feeling in your own words</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthScreen;
