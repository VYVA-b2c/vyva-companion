import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HeartPulse,
  Search,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import {
  resolveSymptomAssessmentPresentation,
  type SymptomAssessmentStageId,
} from "@/design/screenPresentation";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

export type SymptomAssessmentModality = "voice" | "touch";

export const SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE = {
  describe: "capture.voice_or_text",
  safety_check: "choice.yes_no",
  urgent_escalation: "safety.urgent_escalation",
  symptom_selection: "multi_choice.symptom_picker",
  severity: "scale.severity_0_10",
  onset: "capture.onset_timing",
  related_details: "prompt.clarification",
  review: "confirmation.review",
  checking: "progress.checking",
  safest_next_step: "summary.guidance_next_step",
  save_share_summary: "summary.share_or_save",
} as const satisfies Record<SymptomAssessmentStageId, string>;

type SceneLayout =
  | "capture"
  | "binary"
  | "alert"
  | "choices"
  | "scale"
  | "review"
  | "progress"
  | "guidance"
  | "handoff";

type StagePresentation = {
  eyebrow: string;
  title: string;
  helper: string;
  layout: SceneLayout;
};

const stagePresentation: Record<SymptomAssessmentStageId, StagePresentation> = {
  describe: {
    eyebrow: "Describe how you feel",
    title: "How are you feeling?",
    helper: "Tell VYVA in your own words.",
    layout: "capture",
  },
  safety_check: {
    eyebrow: "Safety check",
    title: "Any urgent warning signs?",
    helper: "For example severe chest pain, fainting, or struggling to breathe.",
    layout: "binary",
  },
  urgent_escalation: {
    eyebrow: "Urgent guidance",
    title: "Get urgent help now",
    helper: "Call emergency services now. Do not wait for an online assessment.",
    layout: "alert",
  },
  symptom_selection: {
    eyebrow: "Symptom details",
    title: "What do you notice?",
    helper: "",
    layout: "choices",
  },
  severity: {
    eyebrow: "Severity",
    title: "How strong is it?",
    helper: "0 is none. 10 is the worst imaginable.",
    layout: "scale",
  },
  onset: {
    eyebrow: "Timing",
    title: "When did it start?",
    helper: "",
    layout: "choices",
  },
  related_details: {
    eyebrow: "Related details",
    title: "One more detail",
    helper: "Choose the pattern that fits best.",
    layout: "capture",
  },
  review: {
    eyebrow: "Review",
    title: "Is this right?",
    helper: "",
    layout: "review",
  },
  checking: {
    eyebrow: "Bringing it together",
    title: "Reviewing your symptoms",
    helper: "",
    layout: "progress",
  },
  safest_next_step: {
    eyebrow: "Guidance",
    title: "Your safest next step",
    helper: "Follow this guidance and watch for any change in how you feel.",
    layout: "guidance",
  },
  save_share_summary: {
    eyebrow: "Summary",
    title: "Your summary",
    helper: "",
    layout: "handoff",
  },
};

type CheckingInsight = {
  title: string;
  Icon: LucideIcon;
  accent: VyvaIconAccent;
};

const CHECKING_INSIGHTS: readonly CheckingInsight[] = [
  {
    title: "Reviewing your symptoms",
    Icon: Stethoscope,
    accent: "scope",
  },
  {
    title: "Reviewing your health profile",
    Icon: HeartPulse,
    accent: "pulse",
  },
  {
    title: "Searching 40M+ peer-reviewed sources",
    Icon: Search,
    accent: "spark",
  },
  {
    title: "Checking safety signals",
    Icon: ShieldCheck,
    accent: "check",
  },
] as const;

const CHECKING_INSIGHT_INTERVAL_MS = 2400;

function SymptomCheckingProgress() {
  const { isDark } = useHomeMasterTheme();
  const { t } = useTranslation();
  const [activeInsight, setActiveInsight] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveInsight((current) => (current + 1) % CHECKING_INSIGHTS.length);
    }, CHECKING_INSIGHT_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  const localizedInsightTitles = [
    t("health.symptomCheck.chat.checkingSymptoms", "Reviewing your symptoms"),
    t("health.symptomCheck.chat.checkingProfile", "Reviewing your health profile"),
    t("health.symptomCheck.chat.checkingSources", "Searching 40M+ peer-reviewed sources"),
    t("health.symptomCheck.chat.checkingSafety", "Checking safety signals"),
  ];
  const activeCopy = CHECKING_INSIGHTS[activeInsight];
  const stepLabel = t("health.symptomCheck.chat.checkingStep", "Step {{current}} of {{total}}", {
    current: activeInsight + 1,
    total: CHECKING_INSIGHTS.length,
  });
  const progress = `${((activeInsight + 1) / CHECKING_INSIGHTS.length) * 100}%`;

  return (
    <div
      className="relative flex min-h-[244px] flex-col items-center justify-center overflow-hidden px-4 text-center"
      data-testid="symptom-scene-progress"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${isDark ? "bg-[#7C3AED]/10" : "bg-[#A855F7]/[0.07]"}`}
      />
      <span className="relative grid h-[68px] w-[68px] place-items-center">
        <span
          aria-hidden="true"
          className={`absolute inset-0 rounded-[23px] border-2 border-transparent border-t-[#8B5CF6] motion-safe:animate-spin ${isDark ? "bg-[#45325E]/30" : "bg-[#F7F1FF]/70"}`}
        />
        <span
          key={activeInsight}
          className={`relative grid h-[58px] w-[58px] place-items-center rounded-[19px] border shadow-[0_10px_24px_rgba(76,29,149,0.12)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 ${isDark ? "border-white/[0.12] bg-[#352842]" : "border-[#E7DCF8] bg-white"}`}
        >
          <VyvaIcon icon={activeCopy.Icon} accent={activeCopy.accent} size={30} strokeWidth={2.25} />
        </span>
      </span>
      <p className={`mt-5 font-body text-[11px] font-black uppercase tracking-[0.12em] ${isDark ? "text-[#C4A7EA]" : "text-[#7024C4]"}`}>
        {stepLabel}
      </p>
      <div className="mt-2 flex h-[84px] w-full items-center justify-center" data-testid="symptom-checking-copy-slot">
        <h2
          key={activeInsight}
          className={`max-w-[300px] font-body text-[25px] font-extrabold leading-[1.12] tracking-[-0.025em] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`}
        >
          {localizedInsightTitles[activeInsight]}
        </h2>
      </div>
      <div
        className={`mt-6 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full ${isDark ? "bg-white/[0.12]" : "bg-[#E8DFED]"}`}
        aria-label={stepLabel}
        aria-valuemax={CHECKING_INSIGHTS.length}
        aria-valuemin={1}
        aria-valuenow={activeInsight + 1}
        data-testid="symptom-checking-progress-track"
        role="progressbar"
      >
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-[linear-gradient(90deg,#7024C4,#9D4FE0)] transition-[width] duration-700 ease-in-out motion-reduce:transition-none"
          style={{ width: progress }}
        />
      </div>
    </div>
  );
}

export type SymptomAssessmentReviewItem = {
  label: string;
  value: string;
};

type SymptomAssessmentPresentationProps = {
  stageId: SymptomAssessmentStageId;
  modality: SymptomAssessmentModality;
  title?: string;
  helper?: string;
  children?: ReactNode;
  reviewItems?: SymptomAssessmentReviewItem[];
  onModalityChange?: (modality: SymptomAssessmentModality) => void;
  showHeader?: boolean;
  showTitle?: boolean;
  fullBleedChildren?: boolean;
  allowProgressChildren?: boolean;
  className?: string;
};

export function SymptomAssessmentPresentation({
  stageId,
  modality,
  title,
  helper,
  children,
  reviewItems = [],
  onModalityChange,
  showHeader = true,
  showTitle = true,
  fullBleedChildren = false,
  allowProgressChildren = false,
  className = "",
}: SymptomAssessmentPresentationProps) {
  const { isDark } = useHomeMasterTheme();
  const { t } = useTranslation();
  const scene = stagePresentation[stageId];
  const presentation = resolveSymptomAssessmentPresentation(stageId);
  const urgent = scene.layout === "alert";
  const loading = scene.layout === "progress";
  const displayTitle = title ?? t(`health.symptomCheck.presentation.${stageId}.title`, scene.title);
  const displayHelper = helper ?? t(`health.symptomCheck.presentation.${stageId}.helper`, scene.helper);
  const presentationId =
    modality === "voice" ? presentation.voiceSceneId : presentation.touchSceneId;
  const showsVoiceOrb =
    modality === "voice" &&
    (scene.layout === "capture" ||
      scene.layout === "choices" ||
      scene.layout === "binary");
  const usesCompactProductionDescribeFrame =
    stageId === "describe" && modality === "touch" && !showHeader;
  const usesCheckingFrame = stageId === "checking";
  const usesResultFrame = stageId === "safest_next_step" || stageId === "save_share_summary";
  const showsSceneIntro = (showTitle && scene.layout !== "progress") || Boolean(displayHelper);
  const responsiveFrameWidth = stageId === "severity"
    ? "max-w-[360px] sm:max-w-[760px]"
    : "max-w-[330px] sm:max-w-[760px]";
  const responsiveFrameInset = showHeader
    ? stageId === "severity"
      ? "w-[calc(100%_-_24px)]"
      : "w-[calc(100%_-_28px)]"
    : "w-full";
  const responsiveFrameHeight = stageId === "checking"
      ? "min-h-[320px] md:min-h-[340px]"
      : "min-h-0";
  const responsiveContentSpacing = usesCompactProductionDescribeFrame
    ? "pb-5 pt-6 sm:pb-6 sm:pt-7"
    : stageId === "checking"
      ? "pb-8 pt-[30px] md:pb-10 md:pt-8"
      : stageId === "severity"
        ? "pb-6 pt-6 sm:pb-8 sm:pt-8 [@media(max-height:800px)]:pb-5 [@media(max-height:800px)]:pt-5"
      : `pb-8 ${showHeader ? "pt-[38px]" : "pt-8"} md:pb-9 md:pt-8 [@media(max-height:800px)]:pb-5 [@media(max-height:800px)]:pt-5`;
  const defaultFrameClass = isDark
    ? "border-white/[0.14] bg-[#2B2035] text-[#FFF8FF] shadow-[0_22px_48px_rgba(0,0,0,0.22)]"
    : usesCompactProductionDescribeFrame
      ? "border-[#E6DCEB] bg-white text-[#241238] shadow-[0_16px_40px_rgba(63,45,75,0.08)]"
      : "border-[#DFD3E7] bg-[#FBF6FF] text-[#241238] shadow-[0_18px_36px_rgba(47,24,64,0.11)]";

  return (
    <section
      aria-busy={loading || undefined}
      className={`symptom-canonical-panel mx-auto ${responsiveFrameHeight} ${responsiveFrameInset} ${responsiveFrameWidth} overflow-hidden border ${usesCheckingFrame ? `rounded-[30px] ${isDark ? "border-white/[0.14] bg-[linear-gradient(155deg,#2B2035_0%,#24182F_100%)] text-[#FFF8FF] shadow-[0_22px_48px_rgba(0,0,0,0.22)]" : "border-[#DFD3E7] bg-[linear-gradient(155deg,#FFFFFF_0%,#FBF7FF_55%,#FFF9F1_100%)] text-[#241238] shadow-[0_18px_38px_rgba(63,45,75,0.10)]"}` : `${stageId === "severity" ? "rounded-[26px] sm:rounded-[30px]" : "rounded-[30px]"} ${defaultFrameClass}`} ${className}`}
      data-testid={`symptom-presentation-${stageId}-${modality}`}
      data-approved-frame={SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE[stageId]}
      data-flow-id="health.symptom_assessment"
      data-presentation-id={presentationId}
      data-presentation-modality={modality}
      data-presentation-state={urgent ? "urgent" : loading ? "loading" : "default"}
      data-theme-surface={usesCheckingFrame ? (isDark ? "canonical-dark" : "canonical-light") : undefined}
      data-registry-scene={presentation.registrySceneId}
      data-shell-contract={presentation.shell.shellId}
      data-header-contract={presentation.shell.headerId}
      data-container-contract={presentation.shell.containerId}
      data-bottom-nav-contract={presentation.shell.bottomNavId}
      data-composer-contract={presentation.shell.composer}
      data-scene-kind={SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE[stageId]}
      data-scene-layout={scene.layout}
    >
      {showHeader ? <div className="flex items-center justify-between px-5 pt-5">
        <span
          aria-label="VYVA"
          className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#7024C4] font-display text-[22px] font-black leading-none text-white"
        >
          Y
        </span>
        <div
          aria-label={`${modality === "voice" ? "Voice" : "Touch"} mode`}
          className="flex gap-[5px] rounded-full border border-[#E6DCEC] bg-white p-1 text-[12px] font-black"
        >
          <button
            type="button"
            aria-pressed={modality === "voice"}
            aria-label="Use Voice mode"
            disabled={!onModalityChange || modality === "voice"}
            onClick={() => onModalityChange?.("voice")}
            className={`grid h-[30px] min-w-[30px] place-items-center rounded-full ${
              modality === "voice"
                ? "bg-[#7024C4] text-white"
                : "text-[#746A72]"
            }`}
          >
            V
          </button>
          <button
            type="button"
            aria-pressed={modality === "touch"}
            aria-label="Use Touch mode"
            disabled={!onModalityChange || modality === "touch"}
            onClick={() => onModalityChange?.("touch")}
            className={`grid h-[30px] min-w-[30px] place-items-center rounded-full ${
              modality === "touch"
                ? "bg-[#7024C4] text-white"
                : "text-[#746A72]"
            }`}
          >
            T
          </button>
        </div>
      </div> : null}

      {fullBleedChildren ? (
        <>
          {showsSceneIntro ? <div className={`px-[22px] text-center ${showHeader ? "pt-[38px]" : usesResultFrame ? "pt-6 md:pt-8" : "pt-[34px]"}`}>
          {showTitle && scene.layout !== "progress" ? (
            <h2 className={`font-body font-extrabold leading-[1.08] tracking-[-0.025em] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"} ${usesResultFrame ? "text-[28px] md:text-[31px]" : "text-[31px]"}`}>
              {displayTitle}
            </h2>
          ) : null}
            {displayHelper ? (
              <p className={`mx-auto mt-3 font-semibold leading-[1.42] ${isDark ? "text-[#D8CDE4]" : "text-[#746A72]"} ${usesResultFrame ? "max-w-[290px] text-[14px] md:text-[15px]" : "max-w-[250px] text-[15px]"}`}>
                {usesResultFrame ? (
                  <>
                    <span className="md:hidden">
                      {stageId === "safest_next_step"
                        ? t("health.symptomCheck.chat.followGuidanceShort", "Follow this guidance.")
                        : displayHelper}
                    </span>
                    <span className="hidden md:inline">{displayHelper}</span>
                  </>
                ) : displayHelper}
              </p>
            ) : null}
          </div> : null}
          {children && (scene.layout !== "progress" || allowProgressChildren) ? (
            <div
              className={`${showsSceneIntro ? (usesResultFrame ? "mt-5 md:mt-7" : "mt-7") : ""} text-left`}
              data-testid={`symptom-scene-controls-${stageId}-${modality}`}
            >
              {children}
            </div>
          ) : null}
        </>
      ) : (
        <div className={`${stageId === "severity" ? "px-[18px] sm:px-[22px]" : "px-[22px]"} text-center ${responsiveContentSpacing}`}>
          {showTitle && scene.layout !== "progress" ? (
            <h2 className={`font-body font-extrabold leading-[1.08] tracking-[-0.025em] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"} ${usesCompactProductionDescribeFrame || stageId === "safety_check" || stageId === "severity" ? "text-[28px] sm:text-[31px]" : "text-[31px]"}`}>
              {displayTitle}
            </h2>
          ) : null}

        {scene.layout === "alert" ? (
          <div
            className="mt-7 rounded-[8px] border border-[#EFAAA7] bg-[#FFF0EF] p-[18px] text-left"
            data-testid="symptom-scene-alert"
          >
            <p className="text-[15px] font-black leading-snug text-[#8C2724]">
              {t("health.symptomCheck.chat.urgentStay", "VYVA will stay with you.")}
            </p>
            <p className="mt-1 text-[14px] font-semibold leading-snug text-[#8C2724]">
              {displayHelper}
            </p>
          </div>
        ) : scene.layout === "progress" ? (
          <SymptomCheckingProgress />
        ) : scene.layout === "guidance" ? (
          <div
            className="mt-7 rounded-[8px] border border-[#9ED9C4] bg-[#E9F8F0] p-5 text-left"
            data-testid="symptom-scene-guidance"
          >
            <p className="text-[15px] font-bold leading-snug text-[#0D694B]">
              {displayHelper}
            </p>
          </div>
        ) : displayHelper ? (
          <p className={`mx-auto mt-3 max-w-[320px] text-[16px] font-semibold leading-[1.42] ${isDark ? "text-[#D8CDE4]" : "text-[#746A72]"}`}>
            {displayHelper}
          </p>
        ) : null}

        {showsVoiceOrb ? (
          <div
            aria-label="Voice capture ready"
            className="mx-auto my-[34px] h-[118px] w-[118px] rounded-full border-[18px] border-[#EEE4FF] bg-[radial-gradient(circle_at_35%_28%,#E9C9FF_0_8%,#A66CE3_40%,#7024C4_100%)] shadow-[0_0_0_1px_#D9C8ED,0_0_0_13px_rgba(112,36,196,0.05)]"
            data-testid="symptom-scene-orb"
          />
        ) : null}

        {scene.layout === "review" && reviewItems.length > 0 ? (
          <dl
            className={`mt-7 divide-y text-left [@media(max-height:800px)]:mt-4 ${isDark ? "divide-white/[0.12]" : "divide-[#E7DDE6]"}`}
            data-testid="symptom-scene-review"
          >
            {reviewItems.map((item) => (
              <div
                className="py-3 [@media(max-height:800px)]:py-2"
                key={`${item.label}-${item.value}`}
              >
                <dt className={`text-[12px] font-black uppercase tracking-[0.08em] ${isDark ? "text-[#C9BDD6]" : "text-[#746A72]"}`}>
                  {item.label}
                </dt>
                <dd className={`mt-1 text-[14px] font-bold ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {children && (scene.layout !== "progress" || allowProgressChildren) ? (
          <div
            className={`${scene.layout === "scale" ? "mt-5 sm:mt-7" : "mt-7 [@media(max-height:800px)]:mt-5"} text-left ${scene.layout === "review" ? "[@media(max-height:800px)]:mt-3" : ""}`}
            data-testid={`symptom-scene-controls-${stageId}-${modality}`}
          >
            {children}
          </div>
        ) : null}
        </div>
      )}
    </section>
  );
}
