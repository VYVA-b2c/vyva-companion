import { CheckCircle2 } from "lucide-react";
import {
  BRAIN_COACH_COMPLETION_SHELL_CONTRACT,
  getBrainCoachPresentationAttributes,
} from "@/components/brain/brainCoachPresentation";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { cn } from "@/lib/utils";

function metricGridClass(count) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  return "grid-cols-2 sm:grid-cols-4";
}

function actionGridClass(count) {
  if (count <= 1) return "sm:grid-cols-1";
  if (count === 2) return "sm:grid-cols-2";
  return "sm:grid-cols-3";
}

export default function BrainGameCompletionDialog({
  title,
  summary,
  metrics = [],
  details = null,
  continueLabel,
  continueHint,
  nextLevelLabel,
  nextLevelDisplayLabel,
  stayLabel,
  replayLabel,
  anotherLabel,
  assessmentReturnLabel,
  assessmentReturnHint,
  onContinue,
  onNextLevel,
  onStay,
  onReplay,
  onAnother,
  onAssessmentReturn,
  disabled = false,
  className = "",
}) {
  const { isDark } = useHomeMasterTheme();
  const visibleMetrics = metrics.filter(Boolean);
  const hasNextLevel = Boolean(onNextLevel && nextLevelLabel);
  const primaryLabel = hasNextLevel ? nextLevelDisplayLabel ?? nextLevelLabel : continueLabel;
  const primaryAriaLabel = hasNextLevel ? nextLevelLabel : continueLabel;
  const primaryAction = hasNextLevel ? onNextLevel : onContinue;
  const titleId = "brain-game-completion-title";
  const summaryId = "brain-game-completion-summary";
  const actions = [
    primaryAction && primaryLabel
      ? {
          id: "primary",
          label: primaryLabel,
          ariaLabel: primaryAriaLabel,
          hint: continueHint && !hasNextLevel ? continueHint : null,
          onClick: primaryAction,
          className:
            "bg-vyva-purple text-white shadow-vyva-card",
        }
      : null,
    onStay && stayLabel
      ? {
          id: "stay",
          label: stayLabel,
          onClick: onStay,
          className: isDark
            ? "border border-white/[0.16] bg-white/[0.08] text-[#F7F0FF]"
            : "border-2 border-[#D8C7F3] bg-white text-vyva-purple shadow-vyva-card",
        }
      : null,
    onReplay && replayLabel
      ? {
          id: "replay",
          label: replayLabel,
          onClick: onReplay,
          className: isDark
            ? "border border-white/[0.16] bg-white/[0.08] text-[#F7F0FF]"
            : "border-2 border-[#D8C7F3] bg-white text-vyva-purple shadow-vyva-card",
        }
      : null,
    onAnother && anotherLabel
      ? {
          id: "another",
          label: anotherLabel,
          onClick: onAnother,
          className: isDark
            ? "border border-white/[0.16] bg-white/[0.08] text-[#F7F0FF]"
            : "border-2 border-vyva-border bg-white text-vyva-text-1 shadow-vyva-card",
        }
      : null,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-[3px]",
        isDark ? "bg-black/60" : "bg-[rgba(43,34,51,0.42)]",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={summary ? summaryId : undefined}
      {...getBrainCoachPresentationAttributes({
        approvedFrame: "brain_coach.activity_session.completion",
        presentationId: "brain_coach.activity_session.completion.touch",
        sceneId: "brain_coach.activity_session.completion",
        state: "complete",
        sceneKind: "completion_dialog",
        sceneLayout: "modal_actions",
        shellContract: BRAIN_COACH_COMPLETION_SHELL_CONTRACT,
      })}
    >
      <div className={cn(
        "w-full max-w-[680px] rounded-[30px] border px-5 py-6 text-center shadow-[0_28px_80px_rgba(43,34,51,0.28)] sm:px-7 sm:py-7",
        isDark ? "border-white/[0.14] bg-[#21162D] text-[#F7F0FF]" : "border-white/80 bg-white text-[#241C30]",
      )}>
        <div className="mx-auto flex h-[78px] w-[78px] items-center justify-center rounded-[26px] bg-[#ECFDF5] text-[#0A7C4E] shadow-[0_12px_30px_rgba(10,124,78,0.18)]">
          <CheckCircle2 size={38} />
        </div>

        <h2 id={titleId} className="mt-4 font-display text-[34px] leading-tight text-inherit sm:text-[38px]">
          {title}
        </h2>
        {summary && (
          <p id={summaryId} className={cn("mx-auto mt-2 max-w-[42ch] text-[16px] font-medium leading-[1.45] sm:text-[17px]", isDark ? "text-[#D8CDE4]" : "text-vyva-text-2")}>
            {summary}
          </p>
        )}

        {visibleMetrics.length > 0 && (
          <dl className={cn("mt-5 grid overflow-hidden rounded-[22px] border", metricGridClass(visibleMetrics.length), isDark ? "border-white/[0.12] bg-white/[0.10]" : "border-[#EADFF8] bg-[#EADFF8]")}>
            {visibleMetrics.map((item) => (
              <div key={item.label} className={cn("px-3 py-4", isDark ? "bg-white/[0.06]" : "bg-[#FFF9F1]")}>
                <dt className={cn("text-[12px] font-semibold uppercase", isDark ? "text-[#CFC1DB]" : "text-vyva-text-2")}>{item.label}</dt>
                <dd className="mt-1 text-[24px] font-extrabold leading-none text-inherit">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {onAssessmentReturn && assessmentReturnLabel && (
          <div className="mt-5 rounded-[20px] border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-4 text-left text-[#0F766E]">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">Assessment practice</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <p className="text-[17px] font-extrabold leading-snug text-vyva-text-1">
                {assessmentReturnHint || "Good. You practiced the area VYVA noticed."}
              </p>
              <button
                type="button"
                onClick={onAssessmentReturn}
                disabled={disabled}
                className="min-h-[54px] rounded-full bg-[#0F766E] px-5 text-[17px] font-black text-white shadow-vyva-card disabled:opacity-60"
              >
                {assessmentReturnLabel}
              </button>
            </div>
          </div>
        )}

        {actions.length > 0 && (
          <div className={`mt-6 grid gap-3 ${actionGridClass(actions.length)}`}>
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                disabled={disabled}
                aria-label={action.ariaLabel}
                className={`flex min-h-[64px] flex-col items-center justify-center rounded-full px-4 py-3 text-center text-[20px] font-extrabold leading-[1.08] disabled:opacity-60 ${action.hint ? "gap-1" : ""} ${action.className}`}
              >
                <span>{action.label}</span>
                {action.hint && (
                  <span className="text-[14px] font-bold leading-[1.15] text-white/85 sm:text-[15px]">{action.hint}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {details && (
          <div className="mt-5 max-h-[28dvh] overflow-y-auto pr-1 text-left">
            {details}
          </div>
        )}
      </div>
    </div>
  );
}
