import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, AlertCircle, Pill, BrainCircuit, HeartPulse, Bell, MessageCircle, Video, Users, Settings, Link as LinkIcon } from "lucide-react";
import { margaret } from "@/data/mockData";

const HomeScreen = () => {
  const navigate = useNavigate();
  const [showSOS, setShowSOS] = useState(false);

  return (
    <div className="px-[22px]">
      {/* VYVA Greeting Hero */}
      <div className="mt-[14px] rounded-[24px] p-[24px_22px] relative overflow-hidden hero-purple">
        {/* Decorative circle via inline style since ::before needs CSS */}
        <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Source row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
              <Mic size={16} className="text-white" />
            </div>
            <div>
              <span className="font-body text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>VYVA is thinking of you</span>
              <span className="font-body text-[11px] ml-2" style={{ color: "rgba(255,255,255,0.5)" }}>2m ago</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-[10px] py-[3px] rounded-full" style={{ background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
            <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
            <span className="text-[11px] font-body" style={{ color: "#34D399" }}>Live</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-display italic font-normal text-[26px] text-white leading-[1.3]">
          Good morning, Margaret!{"\n"}How did you sleep?
        </h1>

        {/* Talk button */}
        <button
          onClick={() => navigate("/chat")}
          className="w-full flex items-center justify-center gap-2 rounded-full py-[13px] px-[20px] mt-4 min-h-[56px]"
          style={{ background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.18)" }}
        >
          <Mic size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
          <span className="font-body text-[16px] font-medium text-white">Talk to VYVA</span>
        </button>
      </div>

      {/* SOS Bar */}
      <div className="mt-[14px] rounded-[18px] px-[18px] py-[16px] flex items-center gap-[16px]" style={{ background: "#FEF2F2", border: "1px solid #FCA5A5" }}>
        <button
          onClick={() => setShowSOS(true)}
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center flex-shrink-0 sos-btn"
          style={{ background: "#B91C1C" }}
        >
          <AlertCircle size={24} className="text-white" />
        </button>
        <div>
          <p className="font-body text-[15px] font-medium" style={{ color: "#B91C1C" }}>Emergency — need help?</p>
          <p className="font-body text-[13px] leading-[1.4]" style={{ color: "#9D174D" }}>Tap to alert Sarah, James and emergency services</p>
        </div>
      </div>

      {/* SOS Confirmation Sheet */}
      {showSOS && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setShowSOS(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[480px] bg-white rounded-t-[20px] p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-vyva-warm2 rounded-full mx-auto mb-4" />
            <h3 className="font-display text-[20px] text-vyva-text-1 mb-2">Are you sure?</h3>
            <p className="font-body text-[14px] text-vyva-text-2 mb-6">This will alert Sarah, James and emergency services.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSOS(false)} className="flex-1 py-3 rounded-full font-body text-[14px] font-medium text-vyva-text-1 bg-vyva-warm min-h-[56px]">Cancel</button>
              <button onClick={() => setShowSOS(false)} className="flex-1 py-3 rounded-full font-body text-[14px] font-medium text-white min-h-[56px]" style={{ background: "#B91C1C" }}>Send Alert</button>
            </div>
          </div>
        </div>
      )}

      {/* 2×2 Action Grid */}
      <div className="mt-[14px] grid grid-cols-2 gap-3">
        {[
          { icon: Pill, iconColor: "#C9890A", iconBg: "#FEF3C7", title: "Medications", sub: "Morning taken · Evening due at 19:00", badge: "2 of 3 taken", badgeBg: "#ECFDF5", badgeColor: "#065F46", path: "/health" },
          { icon: BrainCircuit, iconColor: "#6B21A8", iconBg: "#EDE9FE", title: "Brain Coach", sub: "Memory game ready · 7-day streak", badge: "New today", badgeBg: "#EDE9FE", badgeColor: "#6B21A8", path: "/activities" },
          { icon: HeartPulse, iconColor: "#0A7C4E", iconBg: "#ECFDF5", title: "How I feel", sub: "Tell VYVA how you're feeling", badge: null, badgeBg: "", badgeColor: "", path: "/health" },
          { icon: Bell, iconColor: "#0F766E", iconBg: "#F0FDFA", title: "Help me with...", sub: "Orders, appointments, services", badge: null, badgeBg: "", badgeColor: "", path: "/concierge" },
        ].map((tile) => (
          <button
            key={tile.title}
            onClick={() => navigate(tile.path)}
            className="bg-white rounded-[20px] p-[20px_18px] text-left flex flex-col gap-[10px] border border-vyva-border"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", minHeight: 130 }}
          >
            <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center" style={{ background: tile.iconBg }}>
              <tile.icon size={24} style={{ color: tile.iconColor }} />
            </div>
            <h3 className="font-display text-[19px] font-medium text-vyva-text-1 leading-[1.2]">{tile.title}</h3>
            <p className="font-body text-[13px] text-vyva-text-2 leading-[1.4]" style={{ marginTop: -3 }}>{tile.sub}</p>
            {tile.badge && (
              <span className="font-body text-[12px] font-medium px-[11px] py-[3px] rounded-full self-start" style={{ background: tile.badgeBg, color: tile.badgeColor }}>
                {tile.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mini Action Row */}
      <div className="mt-3 grid grid-cols-4 gap-[10px] mb-[18px]">
        {[
          { icon: MessageCircle, iconBg: "#F5F3FF", iconColor: "#6B21A8", label: "Chat with VYVA", path: "/chat" },
          { icon: Video, iconBg: "#F0FDFA", iconColor: "#0F766E", label: "Call Sarah", path: null },
          { icon: Users, iconBg: "#F0FDFA", iconColor: "#0F766E", label: "Call family", path: null },
          { icon: Settings, iconBg: "#EDE5D8", iconColor: "#7C6F68", label: "Settings", path: "/settings" },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={() => btn.path && navigate(btn.path)}
            className="bg-white rounded-[16px] py-[14px] px-[10px] flex flex-col items-center gap-2 border border-vyva-border"
            style={{ minHeight: 80 }}
          >
            <div className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center" style={{ background: btn.iconBg }}>
              <btn.icon size={18} style={{ color: btn.iconColor }} />
            </div>
            <span className="font-body text-[12px] font-medium text-vyva-text-1 text-center leading-tight">{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomeScreen;
