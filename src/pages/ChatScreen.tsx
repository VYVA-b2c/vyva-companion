import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Mic, Clock } from "lucide-react";
import { margaret, vyvaMessages, quickReplies } from "@/data/mockData";
import vyvaLogo from "@/assets/vyva-logo.png";

const ChatScreen = () => {
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);

  return (
    <div className="flex flex-col h-[calc(100vh-152px)]">
      {/* Header */}
      <div className="px-[18px] py-3 flex items-center gap-3 border-b border-vyva-border bg-white">
        <button onClick={() => navigate("/")} className="w-[42px] h-[42px] rounded-full flex items-center justify-center min-w-[42px]" style={{ background: "#F5EFE4", border: "1px solid #EDE5DB" }}>
          <ChevronLeft size={18} className="text-vyva-text-1" />
        </button>
        <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#6B21A8" }}>
          <Mic size={20} className="text-white" />
        </div>
        <div>
          <h2 className="font-display text-[20px] font-medium text-vyva-text-1">VYVA</h2>
          <div className="flex items-center gap-1.5">
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: "#0A7C4E" }} />
            <span className="font-body text-[13px]" style={{ color: "#0A7C4E" }}>Here for you</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-[22px] py-4 space-y-4">
        {/* Proactive note */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-[7px] px-[14px] py-[5px] rounded-full" style={{ background: "#F5F3FF", border: "1px solid #EDE9FE" }}>
            <Clock size={13} style={{ color: "#6B21A8" }} />
            <span className="font-body text-[12px]" style={{ color: "#6B21A8" }}>VYVA started this conversation at 09:30</span>
          </div>
        </div>

        {vyvaMessages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.from === "user" ? "flex-row-reverse" : ""}`}>
            {msg.from === "vyva" ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#6B21A8" }}>
                <Mic size={14} className="text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#F5EFE4", border: "1px solid #EDE5DB" }}>
                <span className="font-body text-[12px] font-medium text-vyva-text-1">{margaret.initials}</span>
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-[14px] ${
                msg.from === "vyva"
                  ? "rounded-[20px_20px_20px_5px]"
                  : "rounded-[20px_20px_5px_20px]"
              }`}
              style={msg.from === "user" ? { background: "#6B21A8" } : { background: "#FFFFFF", border: "1px solid #EDE5DB" }}
            >
              <p className={`font-body text-[16px] leading-[1.6] ${msg.from === "user" ? "text-white" : "text-vyva-text-1"}`}>
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick replies */}
      <div className="px-[20px] py-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {quickReplies.map((r) => (
          <button key={r} className="flex-shrink-0 font-body text-[15px] font-medium rounded-full py-[11px] px-[20px] min-h-[46px] whitespace-nowrap" style={{ color: "#6B21A8", border: "2px solid #6B21A8", background: "transparent" }}>
            {r}
          </button>
        ))}
      </div>

      {/* Voice bar */}
      <div className="px-[22px] py-[14px] bg-white border-t border-vyva-border flex items-center gap-[14px]">
        <button
          onClick={() => setListening(!listening)}
          className={`w-[62px] h-[62px] rounded-full flex items-center justify-center flex-shrink-0 ${listening ? "mic-listening" : "animate-ripple-out"}`}
          style={{ background: "#6B21A8" }}
        >
          <Mic size={24} className={`text-white ${listening ? "animate-pulse-dot" : ""}`} />
        </button>
        <div className="flex-1">
          <p className="font-body text-[16px] font-medium text-vyva-text-1">{listening ? "Listening..." : "Tap to speak"}</p>
          <p className="font-body text-[13px] text-vyva-text-2">Or use the buttons above</p>
        </div>
        <button className="font-body text-[14px] text-vyva-text-2 rounded-[22px] py-[10px] px-[18px]" style={{ background: "#F5EFE4", border: "1px solid #EDE5DB" }}>
          Type
        </button>
      </div>
    </div>
  );
};

export default ChatScreen;
