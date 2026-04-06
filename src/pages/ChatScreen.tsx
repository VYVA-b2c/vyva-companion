import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Mic, MicOff, Clock } from "lucide-react";
import { margaret, quickReplies } from "@/data/mockData";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

const ChatScreen = () => {
  const navigate = useNavigate();
  const { startVoice, stopVoice, sendText, status, isSpeaking, isConnecting, transcript } = useVyvaVoice();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isActive = status === "connected";

  // Auto-scroll on new transcript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleMicToggle = () => {
    if (isActive) {
      stopVoice();
    } else {
      startVoice("companion");
    }
  };

  const statusLabel = isConnecting
    ? "Connecting..."
    : isActive
    ? isSpeaking
      ? "VYVA is speaking..."
      : "Listening..."
    : "Tap to speak";

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
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: isActive ? "#34D399" : "#0A7C4E" }} />
            <span className="font-body text-[13px]" style={{ color: isActive ? "#34D399" : "#0A7C4E" }}>
              {isActive ? (isSpeaking ? "Speaking" : "Listening") : "Here for you"}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-[22px] py-4 space-y-4">
        {/* Connection prompt when no transcript */}
        {transcript.length === 0 && !isActive && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-[7px] px-[14px] py-[5px] rounded-full" style={{ background: "#F5F3FF", border: "1px solid #EDE9FE" }}>
              <Mic size={13} style={{ color: "#6B21A8" }} />
              <span className="font-body text-[12px]" style={{ color: "#6B21A8" }}>Tap the mic to start talking to VYVA</span>
            </div>
          </div>
        )}

        {isActive && transcript.length === 0 && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-[7px] px-[14px] py-[5px] rounded-full" style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
              <Clock size={13} style={{ color: "#0A7C4E" }} />
              <span className="font-body text-[12px]" style={{ color: "#0A7C4E" }}>Connected — say something!</span>
            </div>
          </div>
        )}

        {transcript.map((msg, i) => (
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
        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies */}
      {isActive && (
        <div className="px-[20px] py-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {quickReplies.map((r) => (
            <button
              key={r}
              onClick={() => sendText(r)}
              className="flex-shrink-0 font-body text-[15px] font-medium rounded-full py-[11px] px-[20px] min-h-[46px] whitespace-nowrap"
              style={{ color: "#6B21A8", border: "2px solid #6B21A8", background: "transparent" }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Voice bar */}
      <div className="px-[22px] py-[14px] bg-white border-t border-vyva-border flex items-center gap-[14px]">
        <button
          onClick={handleMicToggle}
          disabled={isConnecting}
          className={`w-[62px] h-[62px] rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isActive ? (isSpeaking ? "mic-listening" : "mic-pulse-listening") : "animate-ripple-out"}`}
          style={{ background: isActive ? "#0A7C4E" : "#6B21A8" }}
        >
          {isActive ? (
            <MicOff size={24} className="text-white" />
          ) : (
            <Mic size={24} className={`text-white ${isConnecting ? "animate-pulse" : ""}`} />
          )}
        </button>
        <div className="flex-1">
          <p className="font-body text-[16px] font-medium text-vyva-text-1">{statusLabel}</p>
          <p className="font-body text-[13px] text-vyva-text-2">
            {isActive ? "Tap mic to end" : "Or use the buttons above"}
          </p>
        </div>
        {!isActive && (
          <button className="font-body text-[14px] text-vyva-text-2 rounded-[22px] py-[10px] px-[18px]" style={{ background: "#F5EFE4", border: "1px solid #EDE5DB" }}>
            Type
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatScreen;
