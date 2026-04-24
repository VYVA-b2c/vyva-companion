import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  Headset,
  Camera,
  Phone,
  X,
  Clock,
  Trash2,
  History,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Mic,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useVyvaVoice, useTtsReadout } from "@/hooks/useVyvaVoice";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";

type ScamCheck = {
  id: string;
  risk_level: string;
  result_title: string;
  explanation: string;
  steps: string[];
  image_data?: string | null;
  checked_at: string;
};

type ScamCheckResult = {
  riskLevel: string;
  resultTitle: string;
  explanation: string;
  steps: string[];
  isFallback?: boolean;
};

const RISK_COLORS: Record<string, { bg: string; text: string; border: string; icon: typeof CheckCircle }> = {
  safe:       { bg: "#DCFCE7", text: "#15803D", border: "#A7F3D0", icon: CheckCircle  },
  suspicious: { bg: "#FEF9C3", text: "#A16207", border: "#FDE68A", icon: AlertTriangle },
  scam:       { bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA", icon: ShieldAlert   },
};

function getRiskColors(level: string) {
  return RISK_COLORS[level.toLowerCase()] ?? RISK_COLORS["safe"];
}

function riskLabelKey(level: string): string {
  const n = level.toLowerCase();
  if (n === "scam") return "scamGuard.riskLabel.scam";
  if (n === "suspicious") return "scamGuard.riskLabel.suspicious";
  return "scamGuard.riskLabel.safe";
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas ctx"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function renderPdfFirstPage(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(viewport.width, 1024);
  canvas.height = Math.round(viewport.height * (canvas.width / viewport.width));
  const scale = canvas.width / viewport.width;
  const scaledViewport = page.getViewport({ scale: 1.5 * scale });
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function processFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return renderPdfFirstPage(file);
  }
  if (file.type.startsWith("image/")) {
    return compressImage(file);
  }
  throw new Error("unsupported file type");
}

const SCAM_CALL_SYSTEM_PROMPT =
  "Hi, I'm VYVA — your scam protection companion. I'm now active and ready to help you handle this suspicious call safely. You can ask me: 'Is this a scam?', 'What should I say?', 'Should I hang up?', or 'What information should I never share?'. I'll guide you step by step. You are safe — just stay calm and ask me anything.";

const FullScreenModal = ({
  check,
  onClose,
  t,
}: {
  check: ScamCheck;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const colors = getRiskColors(check.risk_level);
  const modalDate = new Date(check.checked_at).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      data-testid="modal-scam-check-fullscreen"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.88)" }}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-[18px] py-[14px] flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[8px]">
          <span
            data-testid="text-modal-scam-risk"
            className="font-body text-[12px] font-semibold px-[10px] py-[3px] rounded-full"
            style={{ background: colors.bg, color: colors.text }}
          >
            {t(riskLabelKey(check.risk_level), check.risk_level)}
          </span>
          <p className="font-body text-[14px] font-semibold text-white">
            {check.result_title}
          </p>
        </div>
        <button
          data-testid="button-close-fullscreen-scam"
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className="p-[8px] rounded-full transition-colors hover:bg-white/20 active:scale-95"
        >
          <X size={20} color="#fff" />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-[18px] min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {check.image_data ? (
          <img
            data-testid="img-modal-scam-full"
            src={check.image_data}
            alt={check.result_title}
            className="max-w-full max-h-full rounded-[16px] object-contain"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
          />
        ) : (
          <div
            className="w-[96px] h-[96px] rounded-[24px] flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <FileText size={40} color="rgba(255,255,255,0.6)" />
          </div>
        )}
      </div>

      <div
        data-testid="section-modal-scam-advice"
        className="flex-shrink-0 rounded-t-[24px] px-[20px] pt-[18px] pb-[28px]"
        style={{ background: "#FFFFFF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[6px] mb-[10px]">
          <Clock size={12} style={{ color: "#9CA3AF" }} />
          <p className="font-body text-[12px]" style={{ color: "#9CA3AF" }}>{modalDate}</p>
        </div>
        <p className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]" style={{ color: "#7C3AED" }}>
          {t("scamGuard.explanation", "Assessment")}
        </p>
        <p data-testid="text-modal-scam-explanation" className="font-body text-[14px] text-vyva-text-1 leading-snug mb-[12px]">
          {check.explanation}
        </p>
        {check.steps.length > 0 && (
          <>
            <p className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]" style={{ color: "#7C3AED" }}>
              {t("scamGuard.steps", "What to do")}
            </p>
            <ol className="space-y-[6px]">
              {check.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-[8px]">
                  <span
                    className="font-body text-[11px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-[1px]"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-body text-[13px] text-vyva-text-1">{step}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
};

const ScamGuardScreen = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScamCheckResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullScreenCheck, setFullScreenCheck] = useState<ScamCheck | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startVoice, stopVoice, status, isSpeaking, isConnecting, transcript } = useVyvaVoice();
  const isCallActive = status === "connected";
  const showCallOverlay = isCallActive || isConnecting;

  const { speakText, stopTts, isTtsSpeaking } = useTtsReadout();

  useEffect(() => {
    if (!result) return;
    const riskLabel = t(riskLabelKey(result.riskLevel), result.riskLevel);
    const firstStep = result.steps[0] ?? "";
    const summary = firstStep
      ? `${riskLabel}. ${result.resultTitle}. ${t("scamGuard.ttsStepIntro", "First step")}: ${firstStep}`
      : `${riskLabel}. ${result.resultTitle}.`;
    speakText(summary, i18n.language);
    return () => stopTts();
  }, [result, t, i18n.language, speakText, stopTts]);

  const { data: pastChecks = [], isLoading: historyLoading } = useQuery<ScamCheck[]>({
    queryKey: ["/api/scam-check"],
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/scam-check/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scam-check"] });
      toast({ description: t("scamGuard.deleted", "Check deleted") });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    stopTts();
    setResult(null);
    setAnalyzing(true);

    const errorFallback: ScamCheckResult = {
      riskLevel: "Safe",
      resultTitle: t("scamGuard.errorTitle", "Analysis Unavailable"),
      explanation: t("scamGuard.errorExplanation", "We could not analyse this document. If you are concerned, do not share personal information and call 0808 250 5050 (free UK scam helpline)."),
      steps: [
        t("scamGuard.errorStep1", "Do not share personal or financial information."),
        t("scamGuard.errorStep2", "Ask a trusted person to review it."),
        t("scamGuard.errorStep3", "Call the free scam helpline: 0808 250 5050."),
      ],
    };

    const sourceType = (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))
      ? "pdf"
      : "image";

    processFile(file)
      .then(async (dataUrl) => {
        const res = await apiFetch("/api/scam-check", {
          method: "POST",
          body: JSON.stringify({ image: dataUrl, language: i18n.language, fileType: sourceType }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as ScamCheckResult;
        if (data.isFallback) {
          setResult(errorFallback);
        } else {
          setResult(data);
          queryClient.invalidateQueries({ queryKey: ["/api/scam-check"] });
        }
      })
      .catch(() => setResult(errorFallback))
      .finally(() => setAnalyzing(false));
  };

  const handleCallCompanion = () => {
    if (isCallActive) {
      stopVoice();
    } else {
      startVoice(
        "scam call safety guidance",
        SCAM_CALL_SYSTEM_PROMPT
      );
    }
  };

  const cardStyle = {
    background: "#FFFFFF",
    borderRadius: "20px",
    border: "1px solid #EDE5DB",
    overflow: "hidden",
  } as const;

  return (
    <>
      {showCallOverlay && (
        <VoiceCallOverlay
          isSpeaking={isSpeaking}
          isConnecting={isConnecting}
          transcript={transcript}
          onEnd={stopVoice}
        />
      )}

      {fullScreenCheck && (
        <FullScreenModal
          check={fullScreenCheck}
          onClose={() => setFullScreenCheck(null)}
          t={t}
        />
      )}

      <div className="px-[22px] pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2 mb-[18px]">
          <div
            className="w-[44px] h-[44px] rounded-[16px] flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6B21A8 0%, #9333EA 100%)" }}
          >
            <Headset size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-display italic font-normal text-[22px] text-vyva-text-1 leading-tight">
              {t("scamGuard.headline", "Concierge")}
            </h1>
            <p className="font-body text-[13px] text-vyva-text-2">
              {t("scamGuard.subtitle", "Get real-time help with suspicious calls and documents")}
            </p>
          </div>
        </div>

        {/* Call Companion hero card */}
        <div
          className="mb-[14px] rounded-[20px] p-[20px]"
          style={{
            background: "linear-gradient(135deg, #3B0764 0%, #6B21A8 60%, #9333EA 100%)",
            boxShadow: "0 4px 20px rgba(107,33,168,0.30)",
          }}
        >
          <div className="flex items-center gap-3 mb-[14px]">
            <div
              className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <Phone size={20} className="text-white" />
            </div>
            <div>
              <p className="font-body text-[16px] font-semibold text-white leading-tight">
                {t("scamGuard.callCompanionTitle", "Call Companion")}
              </p>
              <p className="font-body text-[12px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                {t("scamGuard.callCompanionSubtitle", "Get live guidance during a suspicious call")}
              </p>
            </div>
          </div>
          <p className="font-body text-[13px] mb-[14px]" style={{ color: "rgba(255,255,255,0.80)" }}>
            {t("scamGuard.callCompanionDesc", "Start VYVA on your phone while taking a suspicious call. Ask VYVA what to say, what to watch out for, and whether to hang up.")}
          </p>
          <button
            data-testid="button-call-companion"
            onClick={handleCallCompanion}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 rounded-full py-[13px] font-body text-[15px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: isCallActive ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.95)",
              color: isCallActive ? "#34D399" : "#6B21A8",
              border: isCallActive ? "1px solid rgba(52,211,153,0.5)" : "none",
            }}
          >
            {isConnecting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Mic size={18} />
            )}
            {isCallActive
              ? t("scamGuard.callCompanionEnd", "End Call")
              : isConnecting
              ? t("scamGuard.callCompanionConnecting", "Connecting…")
              : t("scamGuard.callCompanionStart", "Start Call Companion")}
          </button>
        </div>

        {/* Scan a Document card */}
        <div style={cardStyle} className="mb-[14px]">
          <div
            className="px-[18px] py-[13px] flex items-center gap-3"
            style={{ background: "#F5EFE4", borderBottom: "1px solid #EDE5DB" }}
          >
            <div
              className="w-[36px] h-[36px] rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#EDE9FE" }}
            >
              <Camera size={18} style={{ color: "#6B21A8" }} />
            </div>
            <div className="flex-1">
              <p className="font-body text-[14px] font-semibold text-vyva-text-1">
                {t("scamGuard.scanTitle", "Check a Document")}
              </p>
              <p className="font-body text-[12px] text-vyva-text-2">
                {t("scamGuard.scanSubtitle", "Photo a letter, email printout, screenshot, or PDF")}
              </p>
            </div>
          </div>

          <div className="p-[18px]">
            {analyzing && (
              <div
                data-testid="section-scam-analyzing"
                className="rounded-[14px] p-[20px] flex flex-col items-center gap-3 mb-[14px]"
                style={{ background: "#F5F3FF" }}
              >
                <div
                  className="w-[48px] h-[48px] rounded-full flex items-center justify-center animate-pulse"
                  style={{ background: "#EDE9FE" }}
                >
                  <ShieldCheck size={22} style={{ color: "#6B21A8" }} />
                </div>
                <p className="font-body text-[14px] font-medium text-center" style={{ color: "#6B21A8" }}>
                  {t("scamGuard.analyzing", "Checking for scam indicators…")}
                </p>
              </div>
            )}

            {result && !analyzing && (() => {
              const rc = getRiskColors(result.riskLevel);
              const RIcon = rc.icon;
              return (
                <div
                  data-testid="section-scam-result"
                  className="rounded-[14px] p-[16px] mb-[14px]"
                  style={{ background: rc.bg, border: `1px solid ${rc.border}` }}
                >
                  <div className="flex items-center justify-between gap-[8px] mb-[8px]">
                    <div className="flex items-center gap-[8px]">
                      <RIcon size={18} style={{ color: rc.text }} />
                      <span
                        data-testid="text-scam-risk"
                        className="font-body text-[13px] font-semibold"
                        style={{ color: rc.text }}
                      >
                        {t(riskLabelKey(result.riskLevel), result.riskLevel)}
                      </span>
                    </div>
                    <button
                      data-testid="button-tts-stop"
                      onClick={isTtsSpeaking ? stopTts : () => {
                        const riskLabel = t(riskLabelKey(result.riskLevel), result.riskLevel);
                        const firstStep = result.steps[0] ?? "";
                        const summary = firstStep
                          ? `${riskLabel}. ${result.resultTitle}. ${t("scamGuard.ttsStepIntro", "First step")}: ${firstStep}`
                          : `${riskLabel}. ${result.resultTitle}.`;
                        speakText(summary, i18n.language);
                      }}
                      aria-label={isTtsSpeaking ? t("scamGuard.ttsStop", "Stop reading") : t("scamGuard.ttsPlay", "Read aloud")}
                      className="flex items-center gap-[5px] px-[10px] py-[5px] rounded-full font-body text-[12px] font-semibold transition-all active:scale-95"
                      style={{
                        background: isTtsSpeaking ? rc.text : rc.bg,
                        color: isTtsSpeaking ? rc.bg : rc.text,
                        border: `1px solid ${rc.border}`,
                      }}
                    >
                      {isTtsSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                      {isTtsSpeaking
                        ? t("scamGuard.ttsStop", "Stop")
                        : t("scamGuard.ttsPlay", "Read aloud")}
                    </button>
                  </div>
                  <p
                    data-testid="text-scam-result-title"
                    className="font-body text-[15px] font-semibold text-vyva-text-1 mb-[8px]"
                  >
                    {result.resultTitle}
                  </p>
                  <p
                    data-testid="text-scam-explanation"
                    className="font-body text-[13px] text-vyva-text-1 leading-snug mb-[12px]"
                  >
                    {result.explanation}
                  </p>
                  {result.steps.length > 0 && (
                    <>
                      <p className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[8px]" style={{ color: "#7C3AED" }}>
                        {t("scamGuard.steps", "What to do")}
                      </p>
                      <ol className="space-y-[6px]">
                        {result.steps.map((step, i) => (
                          <li key={i} data-testid={`text-scam-step-${i}`} className="flex items-start gap-[8px]">
                            <span
                              className="font-body text-[11px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-[1px]"
                              style={{ background: rc.text, color: rc.bg }}
                            >
                              {i + 1}
                            </span>
                            <span className="font-body text-[13px] text-vyva-text-1">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              );
            })()}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-scam-check-file"
            />
            <button
              data-testid="button-scam-check-take-photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 rounded-[14px] py-[14px] font-body text-[15px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #6B21A8 0%, #9333EA 100%)",
                color: "#FFFFFF",
                boxShadow: "0 4px 16px rgba(107,33,168,0.30)",
              }}
            >
              <Camera size={18} />
              {result
                ? t("scamGuard.checkAnother", "Check Another Document")
                : t("scamGuard.takePhoto", "Take, Upload or Select PDF")}
            </button>
          </div>
        </div>

        {/* Past Checks */}
        <div style={cardStyle}>
          <div
            className="px-[18px] py-[13px] flex items-center gap-3"
            style={{ background: "#F5EFE4", borderBottom: "1px solid #EDE5DB" }}
          >
            <div
              className="w-[36px] h-[36px] rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#F5EFE4" }}
            >
              <History size={18} style={{ color: "#6B21A8" }} />
            </div>
            <p className="font-body text-[14px] font-semibold text-vyva-text-1">
              {t("scamGuard.history", "Past Checks")}
            </p>
          </div>

          <div className="p-[14px]">
            {historyLoading ? (
              <div className="flex justify-center py-6">
                <div
                  className="w-[28px] h-[28px] rounded-full border-2 animate-spin"
                  style={{ borderColor: "#6B21A8", borderTopColor: "transparent" }}
                />
              </div>
            ) : pastChecks.length === 0 ? (
              <p
                data-testid="text-scam-no-history"
                className="font-body text-[13px] text-center py-4"
                style={{ color: "#9CA3AF" }}
              >
                {t("scamGuard.noHistory", "No checks yet. Photo a suspicious document to get started.")}
              </p>
            ) : (
              <div className="space-y-[10px]">
                {pastChecks.map((check) => {
                  const colors = getRiskColors(check.risk_level);
                  const CheckIcon = colors.icon;
                  const isExpanded = expandedId === check.id;
                  const checkDate = new Date(check.checked_at).toLocaleDateString(undefined, {
                    day: "numeric", month: "short", year: "numeric",
                  });

                  return (
                    <div
                      key={check.id}
                      data-testid={`card-scam-check-${check.id}`}
                      className="rounded-[14px] border"
                      style={{ borderColor: "#EDE5DB", overflow: "hidden" }}
                    >
                      <button
                        className="w-full flex items-center gap-[12px] p-[12px] text-left transition-colors active:bg-gray-50"
                        onClick={() => setExpandedId(isExpanded ? null : check.id)}
                      >
                        {check.image_data ? (
                          <img
                            src={check.image_data}
                            alt={check.result_title}
                            className="w-[48px] h-[48px] rounded-[10px] object-cover flex-shrink-0 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setFullScreenCheck(check); }}
                          />
                        ) : (
                          <div
                            className="w-[48px] h-[48px] rounded-[10px] flex items-center justify-center flex-shrink-0"
                            style={{ background: "#F5F3FF" }}
                          >
                            <FileText size={22} style={{ color: "#6B21A8" }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[6px] mb-[2px]">
                            <span
                              data-testid={`text-scam-risk-${check.id}`}
                              className="font-body text-[11px] font-semibold px-[8px] py-[2px] rounded-full"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {t(riskLabelKey(check.risk_level), check.risk_level)}
                            </span>
                          </div>
                          <p className="font-body text-[13px] font-semibold text-vyva-text-1 truncate">
                            {check.result_title}
                          </p>
                          <div className="flex items-center gap-[4px] mt-[2px]">
                            <Clock size={10} style={{ color: "#9CA3AF" }} />
                            <p className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>{checkDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-[6px]">
                          <CheckIcon size={16} style={{ color: colors.text, flexShrink: 0 }} />
                          {isExpanded ? <ChevronUp size={14} style={{ color: "#9CA3AF" }} /> : <ChevronDown size={14} style={{ color: "#9CA3AF" }} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-[12px] pb-[12px]" style={{ borderTop: "1px solid #EDE5DB" }}>
                          <p className="font-body text-[11px] font-semibold uppercase tracking-wide mt-[10px] mb-[4px]" style={{ color: "#7C3AED" }}>
                            {t("scamGuard.explanation", "Assessment")}
                          </p>
                          <p className="font-body text-[12px] text-vyva-text-1 leading-snug mb-[10px]">
                            {check.explanation}
                          </p>
                          {check.steps.length > 0 && (
                            <>
                              <p className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]" style={{ color: "#7C3AED" }}>
                                {t("scamGuard.steps", "What to do")}
                              </p>
                              <ol className="space-y-[4px] mb-[10px]">
                                {check.steps.map((step, i) => (
                                  <li key={i} className="flex items-start gap-[8px]">
                                    <span
                                      className="font-body text-[10px] font-bold w-[16px] h-[16px] rounded-full flex items-center justify-center flex-shrink-0 mt-[1px]"
                                      style={{ background: colors.bg, color: colors.text }}
                                    >
                                      {i + 1}
                                    </span>
                                    <span className="font-body text-[12px] text-vyva-text-1">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </>
                          )}
                          <div className="flex gap-[8px] pt-[2px]">
                            {check.image_data && (
                              <button
                                data-testid={`button-view-scam-image-${check.id}`}
                                onClick={() => setFullScreenCheck(check)}
                                className="flex-1 py-[8px] rounded-[10px] font-body text-[12px] font-medium transition-colors active:opacity-80"
                                style={{ background: "#F5F3FF", color: "#6B21A8" }}
                              >
                                {t("scamGuard.viewImage", "View Image")}
                              </button>
                            )}
                            <button
                              data-testid={`button-delete-scam-check-${check.id}`}
                              onClick={() => deleteMutation.mutate(check.id)}
                              disabled={deleteMutation.isPending}
                              className="py-[8px] px-[14px] rounded-[10px] font-body text-[12px] font-medium transition-colors active:opacity-80 disabled:opacity-50"
                              style={{ background: "#FEE2E2", color: "#B91C1C" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ScamGuardScreen;
