import { useState, useEffect, useRef } from "react";
import { Mic, X, Sparkles } from "lucide-react";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

const QUICK_PROMPTS = [
  "What are the latest treatments for my conditions?",
  "Find me a specialist doctor near me",
];

const AskVyvaPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { startVoice, stopVoice, sendText, status, isSpeaking, isConnecting, transcript } = useVyvaVoice();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingPromptRef = useRef<string | null>(null);

  const isActive = status === "connected";

  // Flush queued quick prompt once voice is connected
  useEffect(() => {
    if (isActive && pendingPromptRef.current) {
      sendText(pendingPromptRef.current);
      pendingPromptRef.current = null;
    }
  }, [isActive, sendText]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleOpen = () => setIsOpen(true);

  const handleClose = () => {
    if (isActive || isConnecting) stopVoice();
    pendingPromptRef.current = null;
    setIsOpen(false);
  };

  const handleMicToggle = () => {
    if (isActive) {
      stopVoice();
    } else {
      startVoice("health questions about conditions and medical advice");
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isActive) {
      sendText(prompt);
    } else {
      pendingPromptRef.current = prompt;
      startVoice("companion");
    }
  };

  const statusLabel = isConnecting
    ? "Connecting..."
    : isActive
    ? isSpeaking
      ? "VYVA is speaking…"
      : "Listening — ask anything"
    : "Tap the mic to speak";

  return (
    <>
      {/* Floating mic FAB — only shown when panel is closed */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          data-testid="button-ask-vyva-fab"
          className="fixed bottom-[88px] right-4 w-14 h-14 rounded-full flex items-center justify-center z-40 shadow-lg"
          style={{
            background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)",
            boxShadow: "0 4px 18px rgba(107,33,168,0.40)",
          }}
          aria-label="Ask VYVA"
        >
          <Sparkles size={22} className="text-white" />
        </button>
      )}

      {/* Slide-up panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div
            className="relative w-full max-w-[480px] bg-white rounded-t-[28px] overflow-hidden"
            style={{ boxShadow: "0 -4px 32px rgba(0,0,0,0.18)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-vyva-warm2" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
                >
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="font-display italic text-[20px] text-vyva-text-1">Ask VYVA</span>
              </div>
              <button
                onClick={handleClose}
                data-testid="button-ask-vyva-close"
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "#F5EFE4" }}
              >
                <X size={16} className="text-vyva-text-2" />
              </button>
            </div>

            {/* Mic */}
            <div className="flex flex-col items-center pt-4 pb-5">
              <button
                onClick={handleMicToggle}
                disabled={isConnecting}
                data-testid="button-ask-vyva-mic"
                className={`w-[84px] h-[84px] rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isActive
                    ? isSpeaking
                      ? "mic-listening"
                      : "mic-pulse-listening"
                    : "animate-pulse-ring"
                }`}
                style={{
                  background: isActive
                    ? isSpeaking
                      ? "#0A7C4E"
                      : "#34D399"
                    : "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)",
                }}
              >
                <Mic size={32} className="text-white" />
              </button>
              <p className="mt-3 font-body text-[14px] text-vyva-text-2 text-center px-6">
                {statusLabel}
              </p>
            </div>

            {/* Quick prompts — always visible so user always sees dispatch options */}
            <div className="px-5 mb-4">
              <p className="font-body text-[11px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-2">
                Quick questions
              </p>
              <div className="flex flex-col gap-2">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(prompt)}
                    data-testid={`button-ask-vyva-quick-${i}`}
                    className="w-full text-left rounded-[14px] px-4 py-3 font-body text-[14px] transition-colors active:opacity-80"
                    style={{
                      background: "#F5F3FF",
                      color: "#6B21A8",
                      border: "1px solid #EDE9FE",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Transcript */}
            {transcript.length > 0 && (
              <div
                ref={scrollRef}
                className="mx-5 mb-4 rounded-[16px] p-3 overflow-y-auto"
                style={{
                  maxHeight: 200,
                  background: "#F9F7FF",
                  border: "1px solid #EDE9FE",
                }}
              >
                {transcript.map((entry, i) => (
                  <div
                    key={i}
                    className={`mb-2 last:mb-0 flex ${entry.from === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <span
                      className="inline-block font-body text-[13px] leading-relaxed px-3 py-2 rounded-xl max-w-[85%]"
                      style={
                        entry.from === "user"
                          ? { background: "#6B21A8", color: "#fff" }
                          : {
                              background: "#fff",
                              color: "#2C2320",
                              border: "1px solid #EDE5DB",
                            }
                      }
                    >
                      {entry.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Safe-area spacer */}
            <div className="pb-[max(16px,env(safe-area-inset-bottom))]" />
          </div>
        </div>
      )}
    </>
  );
};

export default AskVyvaPanel;
