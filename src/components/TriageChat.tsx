import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import i18n from "@/i18n";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  aiSummary?: string;
}

interface TriageResponse {
  role: "assistant";
  content: string;
  done?: boolean;
  summary?: TriageSummary;
}

interface TriageChatProps {
  bpm: number | null;
  onComplete: (summary: TriageSummary) => void;
}

const CHAR_DELAY_MS = 18;

export default function TriageChat({ bpm, onComplete }: TriageChatProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initiated, setInitiated] = useState(false);
  const [animatingIdx, setAnimatingIdx] = useState<number | null>(null);
  const [animatedText, setAnimatedText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 80);
  }, []);

  const animateMessage = useCallback(
    (msgIdx: number, fullText: string, onDone?: () => void) => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      setAnimatingIdx(msgIdx);
      setAnimatedText("");
      let pos = 0;
      animTimerRef.current = setInterval(() => {
        pos++;
        setAnimatedText(fullText.slice(0, pos));
        scrollToBottom();
        if (pos >= fullText.length) {
          clearInterval(animTimerRef.current!);
          animTimerRef.current = null;
          setAnimatingIdx(null);
          onDone?.();
        }
      }, CHAR_DELAY_MS);
    },
    [scrollToBottom]
  );

  const sendToApi = useCallback(
    async (history: ChatMessage[]) => {
      setLoading(true);
      try {
        const response = await apiFetch("/api/triage/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            vitals: { bpm },
            locale: i18n.language ?? "en",
          }),
        });
        if (!response.ok) throw new Error(`${response.status}`);
        const res = await response.json() as TriageResponse;

        const msgIdx = history.length;
        setMessages((prev) => [...prev, { role: "assistant", content: res.content }]);

        const triggerComplete = res.done && res.summary
          ? { ...res.summary, aiSummary: res.content }
          : null;

        animateMessage(msgIdx, res.content, () => {
          if (triggerComplete) {
            setTimeout(() => onComplete(triggerComplete), 800);
          }
        });
      } catch {
        const errMsg: ChatMessage = {
          role: "assistant",
          content: t("health.symptomCheck.chat.errorMsg"),
        };
        const msgIdx = messages.length;
        setMessages((prev) => [...prev, errMsg]);
        animateMessage(msgIdx, errMsg.content);
      } finally {
        setLoading(false);
      }
    },
    [bpm, onComplete, animateMessage, messages.length, t]
  );

  useEffect(() => {
    if (!initiated) {
      setInitiated(true);
      sendToApi([]);
    }
  }, [initiated, sendToApi]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    };
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || animatingIdx !== null) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    scrollToBottom();

    await sendToApi(newHistory);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
        style={{ overscrollBehavior: "contain" }}
      >
        {messages.map((msg, i) => {
          const isAnimating = animatingIdx === i;
          const displayContent = isAnimating ? animatedText : msg.content;

          return (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 mr-2 flex items-center justify-center self-end mb-1"
                  style={{ background: "hsl(var(--vyva-purple))" }}
                >
                  <span className="text-white text-[11px] font-bold">V</span>
                </div>
              )}
              <div
                className="max-w-[78%] rounded-[18px] px-4 py-3 font-body text-[15px] leading-relaxed"
                style={
                  msg.role === "user"
                    ? {
                        background: "hsl(var(--vyva-purple))",
                        color: "white",
                        borderBottomRightRadius: 4,
                      }
                    : {
                        background: "white",
                        color: "hsl(var(--vyva-text-1))",
                        border: "1px solid hsl(var(--vyva-border))",
                        borderBottomLeftRadius: 4,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                      }
                }
              >
                {displayContent}
                {isAnimating && (
                  <span
                    className="inline-block w-[2px] h-[1em] ml-[1px] align-middle animate-pulse"
                    style={{ background: "hsl(var(--vyva-purple))", opacity: 0.7 }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 mr-2 flex items-center justify-center self-end mb-1"
              style={{ background: "hsl(var(--vyva-purple))" }}
            >
              <span className="text-white text-[11px] font-bold">V</span>
            </div>
            <div
              className="rounded-[18px] px-4 py-3 flex items-center gap-2"
              style={{
                background: "white",
                border: "1px solid hsl(var(--vyva-border))",
                borderBottomLeftRadius: 4,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              <Loader2 size={14} className="animate-spin" style={{ color: "hsl(var(--vyva-purple))" }} />
              <span className="font-body text-[14px] text-vyva-text-3">
                {t("health.symptomCheck.chat.thinking")}
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{
          borderTop: "1px solid hsl(var(--vyva-border))",
          background: "white",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || animatingIdx !== null}
          placeholder={t("health.symptomCheck.chat.placeholder")}
          data-testid="input-triage-message"
          className="flex-1 rounded-full px-4 py-[10px] font-body text-[15px] text-vyva-text-1 outline-none"
          style={{
            background: "hsl(var(--vyva-cream))",
            border: "1.5px solid hsl(var(--vyva-border))",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading || animatingIdx !== null}
          data-testid="button-triage-send"
          aria-label={t("health.symptomCheck.chat.send")}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
          style={{ background: "hsl(var(--vyva-purple))" }}
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}
