import { Hand, Mic2, Sparkles } from "lucide-react";
import { useOptionalVyvaVoice } from "@/hooks/useVyvaVoice";
import {
  type OnboardingCompanionMode,
  type OnboardingCompanionVoiceStatus,
  useOnboardingCompanionGuidance,
} from "./useOnboardingCompanionGuidance";

interface OnboardingCompanionModeChipProps {
  compact?: boolean;
  compactLabel: string;
  voiceLabel: string;
  voiceDescription: string;
  tactileLabel: string;
  tactileDescription: string;
  accessibleLabel: string;
  statusLabels?: Partial<Record<OnboardingCompanionVoiceStatus, string>>;
}

const DEFAULT_STATUS_LABELS: Record<OnboardingCompanionVoiceStatus, string> = {
  idle: "Ready",
  listening: "Listening",
  speaking: "Speaking",
  thinking: "Thinking",
  error: "Needs attention",
};

function isVoiceDebugEnabled() {
  if (typeof window === "undefined") return false;
  return window.location.search.includes("voiceDebug=1") ||
    window.localStorage.getItem("vyva.voiceDebug") === "1";
}

function compactVoiceDiagnosticLabel(
  diagnostic: NonNullable<ReturnType<typeof useOptionalVyvaVoice>>["onboardingVoiceLiveDiagnostic"] | undefined,
  fallbackError?: string | null,
) {
  if (!diagnostic) return fallbackError ? `Voice error: ${fallbackError}` : "Voice debug: no live onboarding diagnostic yet";
  if (diagnostic.phase === "error") {
    return `Voice error: ${diagnostic.lastEvent ?? "failed"}${diagnostic.error ? ` · ${diagnostic.error}` : ""}`;
  }

  const parts = [
    diagnostic.connected ? "connected" : "not connected",
    diagnostic.starterSent ? "starter sent" : "starter pending",
    diagnostic.clientToolReceived ? "tool received" : "tool pending",
  ];
  const section = diagnostic.sectionLabel || diagnostic.sectionId;
  return `Voice debug: ${section ? `${section} · ` : ""}${parts.join(" · ")}`;
}

export function OnboardingCompanionModeChip({
  compact = false,
  compactLabel,
  voiceLabel,
  voiceDescription,
  tactileLabel,
  tactileDescription,
  accessibleLabel,
  statusLabels,
}: OnboardingCompanionModeChipProps) {
  const {
    mode,
    voiceStatus,
    currentSectionLabel,
    currentPrompt,
    lastHeardText,
    error,
    primaryVoiceActionLabel,
    primaryVoiceActionDescription,
    setMode,
    runPrimaryVoiceAction,
  } = useOnboardingCompanionGuidance();
  const vyvaVoice = useOptionalVyvaVoice();

  const options: Array<{
    id: OnboardingCompanionMode;
    label: string;
    description: string;
    Icon: typeof Mic2;
  }> = [
    {
      id: "voice",
      label: voiceLabel,
      description: voiceDescription,
      Icon: Mic2,
    },
    {
      id: "tactile",
      label: tactileLabel,
      description: tactileDescription,
      Icon: Hand,
    },
  ];
  const resolvedStatusLabels = { ...DEFAULT_STATUS_LABELS, ...statusLabels };
  const voiceActive = mode === "voice" && voiceStatus !== "idle";
  const statusLabel = resolvedStatusLabels[voiceStatus];
  const description = voiceActive
    ? error ?? lastHeardText ?? currentPrompt ?? statusLabel
    : mode === "voice"
      ? primaryVoiceActionDescription ?? voiceDescription
      : tactileDescription;
  const hasVoiceAction = Boolean(primaryVoiceActionLabel);
  const canRunVoiceAction = mode === "voice" && hasVoiceAction;
  const showVoiceDebug = mode === "voice" && isVoiceDebugEnabled();
  const liveDiagnosticLabel = compactVoiceDiagnosticLabel(
    vyvaVoice?.onboardingVoiceLiveDiagnostic,
    vyvaVoice?.lastError,
  );

  const selectMode = (nextMode: OnboardingCompanionMode) => {
    setMode(nextMode);
    if (nextMode === "voice" && hasVoiceAction) {
      window.setTimeout(runPrimaryVoiceAction, 0);
    }
  };

  return (
    <div
      data-testid="onboarding-companion-mode-chip"
      data-voice-status={voiceStatus}
      className={`${compact ? "mt-4 flex flex-col items-end gap-2 border-b pb-4" : "mt-4 flex flex-col gap-2 rounded-[22px] border bg-white/82 p-2.5 shadow-[0_12px_26px_rgba(91,33,182,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"} transition-colors motion-reduce:transition-none ${
        voiceActive
          ? "border-vyva-purple/35 ring-2 ring-vyva-purple/10"
          : "border-[#E7DCF8]"
      }`}
    >
      <div className={compact ? (voiceActive ? "flex min-w-0 items-center gap-2.5 px-1" : "sr-only") : "flex min-w-0 items-center gap-2.5 px-1"}>
        <span
          className={`relative inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-vyva-purple text-white shadow-[0_8px_18px_rgba(107,33,168,0.22)] ${
            voiceActive ? "motion-safe:animate-pulse" : ""
          }`}
        >
          <span
            className={`absolute inset-[-4px] rounded-[18px] border ${
              voiceActive ? "border-vyva-purple/45" : "border-vyva-purple/20"
            }`}
          />
          <Sparkles size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-vyva-purple">
            {voiceActive ? statusLabel : compactLabel}
          </p>
          <p
            className="max-w-[360px] truncate text-[12px] font-bold text-vyva-text-2"
            aria-live={voiceActive ? "polite" : undefined}
          >
            {description}
          </p>
        </div>
      </div>

      {showVoiceDebug ? (
        <p
          className="rounded-2xl bg-[#2D174A]/90 px-3 py-2 text-[11px] font-bold leading-snug text-white"
          data-testid="onboarding-voice-live-diagnostic"
          aria-live="polite"
        >
          {liveDiagnosticLabel}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {canRunVoiceAction ? (
          <button
            type="button"
            data-testid="button-section-companion-primary-voice-action"
            onClick={runPrimaryVoiceAction}
            className="inline-flex min-h-[46px] min-w-0 items-center justify-center gap-2 rounded-full bg-vyva-purple px-4 text-[13px] font-black text-white shadow-[0_10px_20px_rgba(107,33,168,0.20)] transition hover:bg-[#5D1AA8] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FACC15] motion-reduce:transition-none"
            aria-label={
              currentSectionLabel
                ? `${primaryVoiceActionLabel}. ${currentSectionLabel}`
                : primaryVoiceActionLabel
            }
          >
            <Mic2 size={15} aria-hidden="true" />
            <span className="min-w-0 truncate">{primaryVoiceActionLabel}</span>
          </button>
        ) : null}

        <div
          role="radiogroup"
          aria-label={accessibleLabel}
          className="inline-flex h-11 items-center gap-1 rounded-full border border-[#E7DDF3] bg-[#FBF8FF]/95 p-0.5 shadow-[0_10px_22px_rgba(18,10,31,0.10)]"
        >
          {options.map(({ id, label, description, Icon }) => {
            const selected = mode === id;
            return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label}. ${description}`}
              data-testid={`button-section-companion-mode-${id}`}
              onClick={() => selectMode(id)}
              className={`inline-flex h-10 !min-h-10 min-w-[72px] items-center justify-center gap-1.5 rounded-full px-3 font-body text-[12px] font-black transition-colors duration-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FACC15] motion-reduce:transition-none min-[390px]:min-w-[80px] ${
                selected
                  ? "bg-vyva-purple text-white shadow-[0_7px_15px_rgba(107,33,168,0.24)]"
                  : "text-[#6E5A76] hover:bg-[#F7F0FF] hover:text-[#24113D]"
              }`}
            >
              <Icon size={16} strokeWidth={2.4} aria-hidden="true" />
              <span>{label}</span>
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
