import { useState } from "react";
import { Check, Clock, Mic, Pill } from "lucide-react";
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
        <p className="font-body text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.65)" }}>Your health today</p>
        <h1 className="font-display text-[22px] font-normal text-white mb-2">All looking good, Margaret</h1>
        <div className="border-t pt-[13px] flex justify-between" style={{ borderColor: "rgba(255,255,255,0.2)" }}>
          {[
            { val: `${takenCount}/3`, label: "Meds taken" },
            { val: "Normal", label: "Blood pressure" },
            { val: "Good", label: "Mood" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="font-body text-[17px] font-medium text-white">{s.val}</p>
              <p className="font-body text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Medications */}
      <div className="mt-3 bg-white rounded-[18px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="flex items-center justify-between px-4 py-[13px] bg-vyva-warm border-b border-vyva-border">
          <span className="font-body text-[14px] font-medium text-vyva-text-1">Today's medications</span>
          <span className="font-body text-[12px] font-medium px-2 py-0.5 rounded-full bg-vyva-gold-light text-vyva-gold">1 due tonight</span>
        </div>
        {margaret.medications.map((med, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-[13px] border-b border-vyva-border last:border-b-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${med.status === "taken" ? "bg-vyva-green-light" : "bg-vyva-gold-light"}`}>
              {med.status === "taken" ? <Check size={18} className="text-vyva-green" /> : <Clock size={18} className="text-vyva-gold" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-medium text-vyva-text-1">{med.name}</p>
              <p className="font-body text-[13px] text-vyva-text-2">{med.note}</p>
            </div>
            <span className={`font-body text-[13px] font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${
              med.status === "taken" ? "bg-vyva-green-light text-vyva-green-dark" : "bg-vyva-gold-light text-vyva-gold"
            }`}>
              {med.status === "taken" ? "Taken" : "Tonight"}
            </span>
          </div>
        ))}
        <div className="px-4 py-3">
          <button className="w-full flex items-center justify-center gap-2 rounded-[22px] py-3 font-body text-[14px] font-medium text-white min-h-[52px]" style={{ background: "#6B21A8" }}>
            <Pill size={16} />
            Confirm I've taken Metformin
          </button>
        </div>
      </div>

      {/* Symptom Checker */}
      <div className="mt-3 mb-4 bg-white rounded-[18px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="px-4 py-[13px] bg-vyva-warm border-b border-vyva-border">
          <span className="font-body text-[14px] font-medium text-vyva-text-1">How are you feeling?</span>
        </div>
        <div className="p-4">
          <p className="font-body text-[14px] text-vyva-text-2 mb-3">Tell me if anything is bothering you today</p>
          <div className="flex flex-wrap gap-[7px] mb-3">
            {symptoms.map((sym, i) => (
              <button
                key={sym.label}
                onClick={() => toggleSymptom(i)}
                className={`font-body text-[14px] py-[9px] px-4 rounded-[24px] min-h-[40px] transition-colors ${
                  sym.selected
                    ? "bg-vyva-purple-light text-vyva-purple border border-vyva-purple-light"
                    : sym.urgent
                    ? "bg-vyva-gold-light text-vyva-gold border border-vyva-gold-light"
                    : "bg-vyva-warm text-vyva-text-1 border border-vyva-border"
                }`}
              >
                {sym.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 p-3 rounded-[14px] bg-vyva-purple-pale border border-vyva-purple-light">
            <Mic size={16} className="text-vyva-purple flex-shrink-0" />
            <span className="font-body text-[14px] font-medium text-vyva-purple">Tell VYVA how you're feeling in your own words</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthScreen;
