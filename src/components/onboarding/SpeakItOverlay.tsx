import { useState, useEffect, useRef } from "react";
import { Mic, Square, X, CheckCircle2, AlertCircle } from "lucide-react";

interface SpeakItOverlayProps {
  title: string;
  hint: string;
  onDone: (transcript: string) => void;
  onCancel: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const SpeakItOverlay = ({ title, hint, onDone, onCancel }: SpeakItOverlayProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [hasSupport, setHasSupport] = useState(false);
  const [manualText, setManualText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setHasSupport(true);
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-GB";
      rec.onresult = (e) => {
        const text = Array.from(e.results)
          .map((r) => r[0].transcript)
          .join(" ");
        setTranscript(text);
      };
      rec.onend = () => {
        setIsListening(false);
      };
      recRef.current = rec;
    }
    return () => {
      recRef.current?.stop();
    };
  }, []);

  const handleMicToggle = () => {
    if (!recRef.current) return;
    if (isListening) {
      recRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      setMicError(null);
      try {
        recRef.current.start();
        setIsListening(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Microphone unavailable";
        setMicError(msg);
      }
    }
  };

  const handleDone = () => {
    if (recRef.current && isListening) {
      recRef.current.stop();
    }
    const text = hasSupport ? transcript : manualText;
    onDone(text.trim());
  };

  const canSubmit = hasSupport ? transcript.trim().length > 0 : manualText.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-[28px] pb-[max(24px,env(safe-area-inset-bottom))]"
        style={{ boxShadow: "0 -4px 32px rgba(0,0,0,0.18)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-vyva-warm2" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h3 className="font-display italic text-[20px] text-vyva-text-1">{title}</h3>
            <p className="font-body text-[13px] text-vyva-text-3 mt-0.5">{hint}</p>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#F5EFE4" }}
            data-testid="button-speak-it-close"
          >
            <X size={16} className="text-vyva-text-2" />
          </button>
        </div>

        {hasSupport ? (
          <>
            {/* Mic area */}
            <div className="flex flex-col items-center py-6">
              <button
                onClick={handleMicToggle}
                data-testid="button-speak-it-mic"
                className={`w-[80px] h-[80px] rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isListening ? "mic-pulse-listening" : "animate-pulse-ring"
                }`}
                style={{
                  background: isListening
                    ? "#34D399"
                    : "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)",
                }}
              >
                {isListening ? (
                  <Square size={28} className="text-white" fill="white" />
                ) : (
                  <Mic size={28} className="text-white" />
                )}
              </button>
              <p className="mt-3 font-body text-[14px] text-vyva-text-2">
                {isListening ? "Listening — tap to stop" : "Tap the mic and speak"}
              </p>
              {micError && (
                <div className="mt-2 flex items-center gap-2 px-4 py-2 rounded-[10px]" style={{ background: "#FEF2F2", border: "1px solid #FCA5A5" }}>
                  <AlertCircle size={14} style={{ color: "#B91C1C" }} className="flex-shrink-0" />
                  <p className="font-body text-[12px]" style={{ color: "#B91C1C" }}>{micError}</p>
                </div>
              )}
            </div>

            {/* Transcript area */}
            {transcript && (
              <div
                className="mx-5 mb-4 rounded-[16px] px-4 py-3 min-h-[60px]"
                style={{ background: "#F5F3FF", border: "1px solid #EDE9FE" }}
                data-testid="text-speak-it-transcript"
              >
                <p className="font-body text-[15px] leading-relaxed text-vyva-text-1">
                  "{transcript}"
                </p>
              </div>
            )}
          </>
        ) : (
          /* Fallback: textarea */
          <div className="px-5 py-4">
            <p className="font-body text-[13px] text-vyva-text-2 mb-2">
              Voice isn't available on this browser. Type your health history below:
            </p>
            <textarea
              data-testid="input-speak-it-fallback"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder='e.g. "I have Type 2 diabetes and high blood pressure"'
              className="w-full rounded-[14px] border border-vyva-border px-4 py-3 font-body text-[15px] text-vyva-text-1 resize-none focus:outline-none focus:ring-1 focus:ring-vyva-purple"
              rows={4}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="px-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-full font-body text-[14px] font-medium text-vyva-text-2 bg-vyva-warm min-h-[52px]"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            disabled={!canSubmit}
            data-testid="button-speak-it-done"
            className="flex-1 py-3 rounded-full font-body text-[14px] font-medium text-white min-h-[52px] flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
          >
            <CheckCircle2 size={16} />
            Use this
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpeakItOverlay;
