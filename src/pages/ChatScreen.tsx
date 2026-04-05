import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Mic, Clock } from "lucide-react";
import { margaret, vyvaMessages, quickReplies } from "@/data/mockData";
import vyvaLogo from "@/assets/vyva-logo.png";

const ChatScreen = () => {
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);

  return (
    <div className="flex flex-col h-[calc(100vh-148px)]">
      {/* Header */}
      <div className="px-[22px] py-3 flex items-center gap-3 border-b border-vyva-border bg-white">
        <button onClick={() => navigate("/")} className="w-10 h-10 rounded-full bg-vyva-warm border border-vyva-border flex items-center justify-center min-w-[40px]">
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <img src={vyvaLogo} alt="VYVA" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
        <div>
          <h2 className="font-display text-[20px] font-medium text-vyva-text-1">VYVA</h2>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-vyva-green" />
            <span className="font-body text-[13px] text-vyva-green">Here for you</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-[22px] py-4 space-y-4">
        {/* Proactive note */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-vyva-purple-pale border border-vyva-purple-light">
            <Clock size={13} className="text-vyva-purple" />
            <span className="font-body text-[12px] text-vyva-purple">VYVA started this conversation at 09:30</span>
          </div>
        </div>

        {vyvaMessages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.from === "user" ? "flex-row-reverse" : ""}`}>
            {msg.from === "vyva" ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#6B21A8" }}>
                <Mic size={14} className="text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-vyva-warm border border-vyva-border">
                <span className="font-body text-[12px] font-medium text-vyva-text-1">{margaret.initials}</span>
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-[14px] ${
                msg.from === "vyva"
                  ? "bg-white border border-vyva-border rounded-[20px] rounded-bl-[5px]"
                  : "rounded-[20px] rounded-br-[5px]"
              }`}
              style={msg.from === "user" ? { background: "#6B21A8" } : {}}
            >
              <p className={`font-body text-[16px] leading-[1.55] ${msg.from === "user" ? "text-white" : "text-vyva-text-1"}`}>
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick replies */}
      <div className="px-[22px] py-2 flex gap-2 overflow-x-auto">
        {quickReplies.map((r) => (
          <button key={r} className="flex-shrink-0 font-body text-[16px] font-medium text-vyva-purple rounded-[28px] py-[11px] px-[18px] min-h-[52px]" style={{ border: "2px solid #6B21A8", background: "transparent" }}>
            {r}
          </button>
        ))}
      </div>

      {/* Voice bar */}
      <div className="px-[22px] py-[14px] bg-white border-t border-vyva-border flex items-center gap-[14px]">
        <button
          onClick={() => setListening(!listening)}
          className={`w-[58px] h-[58px] rounded-full flex items-center justify-center flex-shrink-0 ${listening ? "animate-pulse-ring" : ""}`}
          style={{ background: "#6B21A8" }}
        >
          <Mic size={22} className="text-white" />
        </button>
        <div className="flex-1">
          <p className="font-body text-[16px] font-medium text-vyva-text-1">{listening ? "Listening..." : "Tap to speak"}</p>
          <p className="font-body text-[13px] text-vyva-text-2">Or use the buttons above</p>
        </div>
        <button className="font-body text-[14px] text-vyva-text-2 bg-vyva-warm border border-vyva-border rounded-[22px] py-[9px] px-4 min-h-[40px]">
          Type
        </button>
      </div>
    </div>
  );
};

export default ChatScreen;
