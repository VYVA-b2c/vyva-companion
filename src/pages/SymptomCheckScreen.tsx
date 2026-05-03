import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Heart, MessageSquare, FileText, Share2, Copy, CheckCircle, AlertTriangle, Eye, Mic } from "lucide-react";
import VitalsScan from "@/components/VitalsScan";
import TriageChat from "@/components/TriageChat";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/queryClient";

type Step = "intro" | "vitals" | "chat" | "report";

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  aiSummary?: string;
}

function StepDots({ current }: { current: Step }) {
  const steps: Step[] = ["vitals", "chat", "report"];
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-2 justify-center">
      {steps.map((s, i) => (
        <div
          key={s}
          className="rounded-full transition-all"
          style={{
            width: i === idx ? 20 : 8,
            height: 8,
            background: i <= idx ? "hsl(var(--vyva-purple))" : "hsl(var(--vyva-warm2))",
          }}
        />
      ))}
    </div>
  );
}

function IntroScreen({
  onStart,
  onStartChat,
  onStartVoice,
}: {
  onStart: () => void;
  onStartChat: () => void;
  onStartVoice: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center flex-1 px-6 py-6 text-center gap-5">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, hsl(var(--vyva-purple)) 0%, #7C3AED 100%)",
          boxShadow: "0 8px 32px rgba(91,18,160,0.30)",
        }}
      >
        <Heart size={34} className="text-white" />
      </div>

      <div>
        <h1 className="font-body text-[24px] font-bold text-vyva-text-1 mb-2 leading-tight">
          {t("health.symptomCheck.intro.title")}
        </h1>
        <p className="font-body text-[15px] text-vyva-text-2 leading-relaxed">
          {t("health.symptomCheck.intro.subtitle")}
        </p>
      </div>

      <div className="w-full grid grid-cols-1 gap-3">
        <button
          onClick={onStart}
          data-testid="button-symptom-check-start"
          className="w-full rounded-full py-[16px] font-body text-[18px] font-bold text-white transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, hsl(var(--vyva-purple)) 0%, #7C3AED 100%)",
            boxShadow: "0 4px 18px rgba(91,18,160,0.35)",
          }}
        >
          {t("health.symptomCheck.intro.startBtn")}
        </button>

        <button
          onClick={onStartVoice}
          data-testid="button-symptom-check-voice-start"
          className="w-full rounded-full py-[14px] flex items-center justify-center gap-2 font-body text-[16px] font-bold transition-all active:scale-95"
          style={{
            background: "white",
            color: "hsl(var(--vyva-purple))",
            border: "1.5px solid hsl(var(--vyva-purple-light))",
          }}
        >
          <Mic size={18} />
          {t("health.symptomCheck.intro.voiceBtn")}
        </button>
      </div>

      <div className="w-full flex flex-col gap-3">
        {(["vitals", "chat", "report"] as const).map((key, i) => {
          const icons = [Heart, MessageSquare, FileText];
          const Icon = icons[i];
          const handleClick = key === "chat" ? onStartChat : onStart;
          return (
            <button
              key={key}
              type="button"
              onClick={handleClick}
              data-testid={`button-symptom-check-${key}`}
              className="w-full flex items-center gap-4 rounded-[16px] p-4 text-left transition-all active:scale-[0.99]"
              style={{
                background: "hsl(var(--vyva-warm))",
                border: "1px solid hsl(var(--vyva-border))",
                boxShadow: "0 2px 8px rgba(24,14,38,0.04)",
              }}
            >
              <div
                className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                style={{ background: "hsl(var(--vyva-purple-light))" }}
              >
                <Icon size={18} style={{ color: "hsl(var(--vyva-purple))" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[15px] font-bold text-vyva-text-1">
                  {t(`health.symptomCheck.intro.step${i + 1}Title`)}
                </p>
                <p className="font-body text-[13px] text-vyva-text-3 leading-snug">
                  {t(`health.symptomCheck.intro.step${i + 1}Desc`)}
                </p>
              </div>
              <ChevronRight size={20} className="flex-shrink-0" style={{ color: "hsl(var(--vyva-purple))" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UrgencyConfig(urgency: TriageSummary["urgency"]) {
  if (urgency === "urgent") {
    return {
      bg: "linear-gradient(135deg, #B91C1C 0%, #EF4444 100%)",
      icon: AlertTriangle,
      label: "health.symptomCheck.report.urgentLabel",
      pillBg: "rgba(255,255,255,0.25)",
    };
  }
  if (urgency === "routine") {
    return {
      bg: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
      icon: Eye,
      label: "health.symptomCheck.report.routineLabel",
      pillBg: "rgba(255,255,255,0.25)",
    };
  }
  return {
    bg: "linear-gradient(135deg, #0A7C4E 0%, #10B981 100%)",
    icon: CheckCircle,
    label: "health.symptomCheck.report.monitorLabel",
    pillBg: "rgba(255,255,255,0.25)",
  };
}

function ReportScreen({
  summary,
  bpm,
  onDone,
}: {
  summary: TriageSummary;
  bpm: number | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const cfg = UrgencyConfig(summary.urgency);
  const UrgencyIcon = cfg.icon;

  const shareText = [
    t("health.symptomCheck.report.shareTitle"),
    "",
    `${t("health.symptomCheck.report.chiefComplaint")}: ${summary.chiefComplaint}`,
    bpm != null ? `${t("health.symptomCheck.scan.heartRate")}: ${bpm} bpm` : "",
    "",
    `${t("health.symptomCheck.report.urgencyLabel")}: ${t(cfg.label)}`,
    "",
    t("health.symptomCheck.report.recommendations") + ":",
    ...summary.recommendations.map((r, i) => `${i + 1}. ${r}`),
    "",
    t("health.symptomCheck.report.disclaimer"),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("health.symptomCheck.report.shareTitle"), text: shareText });
        return;
      } catch {
        /* user cancelled or not supported */
      }
    }
    const copied = await navigator.clipboard.writeText(shareText).then(() => true).catch(() => false);
    if (copied) {
      toast({
        title: t("health.symptomCheck.report.copiedToast"),
        description: t("health.symptomCheck.report.copiedToastDesc"),
      });
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div
        className="mx-4 mt-2 mb-4 rounded-[20px] p-5 flex flex-col gap-3"
        style={{ background: cfg.bg }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.22)" }}
          >
            <UrgencyIcon size={24} className="text-white" />
          </div>
          <div>
            <p className="font-body text-[12px] font-medium text-white/75 uppercase tracking-wider">
              {t("health.symptomCheck.report.urgencyLabel")}
            </p>
            <p className="font-body text-[20px] font-bold text-white leading-tight">
              {t(cfg.label)}
            </p>
          </div>
        </div>

        <p className="font-body text-[15px] text-white/90 leading-relaxed">
          {summary.chiefComplaint}
        </p>

        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 self-start"
          style={{ background: cfg.pillBg }}
        >
          <Heart size={13} className="text-white" />
          <span className="font-body text-[13px] text-white font-semibold">
            {bpm != null ? `${bpm} bpm` : `${t("health.symptomCheck.scan.heartRate")}: —`}
          </span>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4 pb-6">
        {summary.symptoms.length > 0 && (
          <div
            className="rounded-[16px] p-4"
            style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
          >
            <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
              {t("health.symptomCheck.report.symptoms")}
            </p>
            <ul className="flex flex-col gap-2">
              {summary.symptoms.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                    style={{ background: "hsl(var(--vyva-purple))" }}
                  />
                  <span className="font-body text-[15px] text-vyva-text-1">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className="rounded-[16px] p-4"
          style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
        >
          <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
            {t("health.symptomCheck.report.recommendations")}
          </p>
          <ol className="flex flex-col gap-3">
            {summary.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-body text-[12px] font-bold text-white"
                  style={{ background: "hsl(var(--vyva-purple))" }}
                >
                  {i + 1}
                </span>
                <span className="font-body text-[15px] text-vyva-text-1 leading-relaxed pt-0.5">{rec}</span>
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={handleShare}
          data-testid="button-report-share"
          className="w-full rounded-full py-[14px] flex items-center justify-center gap-2 font-body text-[15px] font-semibold transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, hsl(var(--vyva-purple)) 0%, #7C3AED 100%)",
            color: "white",
            boxShadow: "0 4px 18px rgba(91,18,160,0.30)",
          }}
        >
          <Share2 size={18} />
          {t("health.symptomCheck.report.shareBtn")}
        </button>

        <button
          onClick={onDone}
          data-testid="button-report-done"
          className="w-full rounded-full py-[14px] font-body text-[15px] font-semibold transition-all active:scale-95"
          style={{
            background: "hsl(var(--vyva-warm))",
            color: "hsl(var(--vyva-text-1))",
            border: "1.5px solid hsl(var(--vyva-border))",
          }}
        >
          {t("health.symptomCheck.report.doneBtn")}
        </button>

        <p className="font-body text-[11px] text-vyva-text-3 text-center leading-relaxed px-2">
          {t("health.symptomCheck.report.disclaimer")}
        </p>
      </div>
    </div>
  );
}

export default function SymptomCheckScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("intro");
  const [bpm, setBpm] = useState<number | null>(null);
  const [respiratoryRate, setRespiratoryRate] = useState<number | null>(null);
  const [chatStartTime, setChatStartTime] = useState<number | null>(null);
  const [chatEntryMode, setChatEntryMode] = useState<"vitals" | "direct">("vitals");
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [summary, setSummary] = useState<TriageSummary | null>(null);

  const stepTitle: Record<Step, string> = {
    intro: t("health.symptomCheck.title"),
    vitals: t("health.symptomCheck.scan.title"),
    chat: t("health.symptomCheck.chat.title"),
    report: t("health.symptomCheck.report.title"),
  };

  const handleBack = () => {
    if (step === "intro") {
      navigate("/health");
    } else if (step === "vitals") {
      setStep("intro");
    } else if (step === "chat") {
      setStep(chatEntryMode === "direct" ? "intro" : "vitals");
    } else {
      navigate("/health");
    }
  };

  const handleScanComplete = (detectedBpm: number | null, detectedResp: number | null) => {
    setBpm(detectedBpm);
    setRespiratoryRate(detectedResp);
    setChatStartTime(Date.now());
    setChatEntryMode("vitals");
    setAutoStartVoice(false);
    setStep("chat");
  };

  const startChatDirectly = (withVoice = false) => {
    setChatStartTime(Date.now());
    setChatEntryMode("direct");
    setAutoStartVoice(withVoice);
    setStep("chat");
  };

  const handleChatComplete = (triageSummary: TriageSummary) => {
    const durationSeconds = chatStartTime
      ? Math.round((Date.now() - chatStartTime) / 1000)
      : null;
    setSummary(triageSummary);
    setStep("report");
    apiFetch("/api/reports/triage", {
      method: "POST",
      body: JSON.stringify({
        chief_complaint: triageSummary.chiefComplaint,
        symptoms: triageSummary.symptoms,
        urgency: triageSummary.urgency,
        recommendations: triageSummary.recommendations,
        disclaimer: triageSummary.disclaimer,
        ai_summary: triageSummary.aiSummary ?? null,
        bpm: bpm ?? null,
        respiratory_rate: respiratoryRate ?? null,
        duration_seconds: durationSeconds,
      }),
    }).catch((err) => console.error("[reports/triage] save failed:", err));
  };

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "hsl(var(--vyva-cream))" }}
    >
      <div
        className="flex items-center px-4 py-3 flex-shrink-0"
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top))",
          borderBottom: step !== "intro" ? "1px solid hsl(var(--vyva-border))" : "none",
          background: "white",
        }}
      >
        <button
          onClick={handleBack}
          data-testid="button-symptom-check-back"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
          style={{ background: "hsl(var(--vyva-warm))" }}
        >
          <ChevronLeft size={20} style={{ color: "hsl(var(--vyva-text-1))" }} />
        </button>

        <div className="flex-1 text-center">
          <p className="font-body text-[16px] font-semibold text-vyva-text-1">
            {stepTitle[step]}
          </p>
        </div>

        <div className="w-9 h-9 flex-shrink-0" />
      </div>

      {step !== "intro" && (
        <div className="py-3 flex-shrink-0" style={{ background: "white", borderBottom: "1px solid hsl(var(--vyva-border))" }}>
          <StepDots current={step} />
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {step === "intro" && (
          <IntroScreen
            onStart={() => setStep("vitals")}
            onStartChat={() => startChatDirectly(false)}
            onStartVoice={() => startChatDirectly(true)}
          />
        )}

        {step === "vitals" && (
          <VitalsScan onComplete={handleScanComplete} />
        )}

        {step === "chat" && (
          <TriageChat
            bpm={bpm}
            autoStartVoice={autoStartVoice}
            onVoiceAutoStarted={() => setAutoStartVoice(false)}
            onComplete={handleChatComplete}
          />
        )}

        {step === "report" && summary && (
          <ReportScreen
            summary={summary}
            bpm={bpm}
            onDone={() => navigate("/health")}
          />
        )}
      </div>
    </div>
  );
}
