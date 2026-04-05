import React from "react";
import { useNavigate } from "react-router-dom";
import { Mic } from "lucide-react";

interface VoiceHeroProps {
  sourceText: string;
  headline: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}

const VoiceHero: React.FC<VoiceHeroProps> = ({ sourceText, headline, subtitle, children }) => {
  const navigate = useNavigate();

  return (
    <div className="mt-[14px] rounded-[24px] p-[24px_22px] relative overflow-hidden hero-purple">
      <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />

      {/* Source row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
            <Mic size={16} className="text-white" />
          </div>
          <span className="font-body text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{sourceText}</span>
        </div>
        <div className="flex items-center gap-1.5 px-[10px] py-[3px] rounded-full" style={{ background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
          <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
          <span className="text-[11px] font-body" style={{ color: "#34D399" }}>Live</span>
        </div>
      </div>

      {/* Headline */}
      <h1 className="font-display italic font-normal text-[26px] text-white leading-[1.3]">
        {headline}
      </h1>
      {subtitle && (
        <p className="font-body text-[14px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>{subtitle}</p>
      )}

      {/* Screen-specific content */}
      {children}

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
  );
};

export default VoiceHero;
