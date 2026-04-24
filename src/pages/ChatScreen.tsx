import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Settings, Square, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

const ChatScreen = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { startVoice, stopVoice, sendText, transcript, status, isConnecting } = useVyvaVoice();
  const [text, setText] = useState("");
  const pendingRef = useRef<string | null>(searchParams.get("q"));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    startVoice("companion");
  }, []);

  useEffect(() => {
    if (status === "connected" && pendingRef.current) {
      sendText(pendingRef.current);
      pendingRef.current = null;
    }
  }, [status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendText(text.trim());
    setText("");
  };

  const connectionLabel = isConnecting
    ? t("chat.connecting")
    : status === "connected"
    ? t("chat.connected")
    : t("chat.tapToConnect");

  return (
    <div
      className="flex flex-col"
      style={{ height: "100vh", background: "#2D0A5E" }}
    >
      {/* Minimal top bar */}
      <div className="flex items-center px-4 pt-[52px] pb-2 flex-shrink-0">
        <button
          onClick={() => { stopVoice(); navigate("/"); }}
          data-testid="button-chat-back"
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="flex-1 text-center">
          <span className="font-body text-[15px] font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>
            VYVA
          </span>
          <div className="font-body text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
            {connectionLabel}
          </div>
        </div>
        <div className="w-9 h-9" />
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-3"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="text-center py-3">
          <span className="font-body text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
            {t("chat.started")}
          </span>
        </div>

        {transcript.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.from === "user" ? "justify-end" : "justify-start"}`}
            data-testid={`bubble-chat-${msg.from}-${i}`}
          >
            {msg.from === "vyva" && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 self-end"
                style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
              >
                <span className="font-display text-[13px] font-bold text-white">V</span>
              </div>
            )}
            <div
              className="max-w-[78%] px-4 py-3"
              style={
                msg.from === "user"
                  ? { background: "#3D1070", borderRadius: "20px 20px 6px 20px" }
                  : { background: "rgba(255,255,255,0.10)", borderRadius: "20px 20px 20px 6px" }
              }
            >
              <p className="font-body text-[16px] leading-[1.6] text-white">{msg.text}</p>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-8 pt-2 flex-shrink-0">
        <div
          className="flex flex-col rounded-[22px] px-4 pt-3 pb-2"
          style={{
            background: "rgba(255,255,255,0.09)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("chat.sendMessage")}
            data-testid="input-chat-type"
            rows={1}
            className="w-full bg-transparent font-body text-[16px] text-white resize-none focus:outline-none leading-[1.5]"
            style={{ minHeight: "28px", maxHeight: "120px", color: "white" }}
          />
          <style>{`
            textarea[data-testid="input-chat-type"]::placeholder { color: rgba(255,255,255,0.38); }
          `}</style>

          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => navigate("/settings")}
              data-testid="button-chat-settings"
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ color: "rgba(255,255,255,0.50)" }}
            >
              <Settings size={18} />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => stopVoice()}
                data-testid="button-chat-stop"
                className="w-9 h-9 flex items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}
              >
                <Square size={14} />
              </button>
              <button
                onClick={handleSend}
                disabled={!text.trim() || status !== "connected"}
                data-testid="button-chat-send"
                className="w-9 h-9 flex items-center justify-center rounded-full disabled:opacity-30 transition-opacity"
                style={{ background: "#7C3AED" }}
              >
                <ArrowUp size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;
