import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, MessageCircle, BookOpen, Users, Heart, Clock } from "lucide-react";
import { margaret, vyvaMessages } from "@/data/mockData";
import VoiceHero from "@/components/VoiceHero";
const HomeScreen = () => {
  const navigate = useNavigate();
  const [showSOS, setShowSOS] = useState(false);

  return (
    <div className="px-[22px]">
      <VoiceHero
        sourceText="VYVA is here for you"
        headline={<>Good morning,{"\n"}Margaret!</>}
        subtitle="How are you feeling today?"
      />

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
          <p className="font-body text-[13px] leading-[1.4]" style={{ color: "#9D174D" }}>Tap to alert Sarah & emergency services</p>
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

      {/* Recent conversation preview */}
      <div className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
          <span className="font-body text-[14px] font-medium text-vyva-text-1">Recent chat</span>
          <div className="flex items-center gap-1 text-vyva-text-2">
            <Clock size={12} />
            <span className="font-body text-[12px]">2m ago</span>
          </div>
        </div>
        <div className="px-[18px] py-[14px]">
          <p className="font-body text-[14px] text-vyva-text-2 leading-[1.5] line-clamp-2">
            {vyvaMessages[vyvaMessages.length - 1]?.text}
          </p>
          <button onClick={() => navigate("/chat")} className="mt-3 font-body text-[14px] font-medium" style={{ color: "#6B21A8" }}>
            Continue conversation →
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-3 grid grid-cols-2 gap-3 mb-[18px]">
        {[
          { icon: MessageCircle, iconBg: "#F5F3FF", iconColor: "#6B21A8", label: "Chat", sub: "Talk with VYVA", path: "/chat" },
          { icon: BookOpen, iconBg: "#FEF3C7", iconColor: "#C9890A", label: "Stories", sub: "Listen to a story", path: null },
          { icon: Users, iconBg: "#F0FDFA", iconColor: "#0F766E", label: "Family", sub: "Call Sarah or James", path: null },
          { icon: Heart, iconBg: "#FDF2F8", iconColor: "#B0355A", label: "Check-in", sub: "How are you today?", path: "/health" },
        ].map((tile) => (
          <button
            key={tile.label}
            onClick={() => tile.path && navigate(tile.path)}
            className="bg-white rounded-[18px] p-[18px_16px] text-left flex items-center gap-[14px] border border-vyva-border"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", minHeight: 72 }}
          >
            <div className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center flex-shrink-0" style={{ background: tile.iconBg }}>
              <tile.icon size={20} style={{ color: tile.iconColor }} />
            </div>
            <div>
              <p className="font-body text-[15px] font-medium text-vyva-text-1">{tile.label}</p>
              <p className="font-body text-[12px] text-vyva-text-2">{tile.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomeScreen;
