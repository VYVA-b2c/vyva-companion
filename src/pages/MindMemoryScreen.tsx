import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { CanonicalVoiceButton } from "@/components/CanonicalDetailFlowShell";
import { CanonicalBrainCoachActivityCard } from "@/components/brain/CanonicalBrainCoachActivityCard";
import {
  BRAIN_COACH_ACTIVITY_FLOW_ID,
  BRAIN_COACH_MAIN_SCENE_ID,
  BRAIN_COACH_MAIN_SHELL_CONTRACT,
  getBrainCoachPresentationAttributes,
} from "@/components/brain/brainCoachPresentation";
import { useScreenPresentation } from "@/design/screenPresentation";
import { BRAIN_COACH_MODULES, getBrainCoachActivitiesForModule } from "@/games/brainCoachCatalog";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { cn } from "@/lib/utils";

const MODULE_CHIPS = {
  memory: { background: "#F1EAFF", color: "#7C3AED" },
  reflexes: { background: "#EAFBF1", color: "#0F7A50" },
  thinking: { background: "#FFF4CF", color: "#A16207" },
  senses: { background: "#EAF9F7", color: "#0F766E" },
} as const;

export default function MindMemoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const { size: readableTextSize } = useReadableTextSize();
  const mindPresentation = useScreenPresentation({
    screenId: "mind",
    presentationFamilyId: BRAIN_COACH_ACTIVITY_FLOW_ID,
    uiInstruction: "brain-coach.activity-session.menu",
  });

  return (
    <main
      data-testid="mind-memory-master-layout"
      data-home-master-theme={isDark ? "dark" : "light"}
      data-vyva-text-size={readableTextSize}
      {...mindPresentation.dataAttributes}
      {...getBrainCoachPresentationAttributes({
        approvedFrame: "brain_coach.activity_session.main",
        presentationId: "brain_coach.activity_session.main.touch",
        sceneId: BRAIN_COACH_MAIN_SCENE_ID,
        sceneKind: "main_menu",
        sceneLayout: "module_grid",
        shellContract: BRAIN_COACH_MAIN_SHELL_CONTRACT,
      })}
      className={cn(
        "prototype-shell relative min-h-[calc(100svh-136px)] w-full overflow-x-hidden",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_0%,#2C1E58_0%,#160F24_52%,#080611_100%)] text-[#F7F0FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
      )}
    >
      <div className="vyva-home-master-fixed-type mx-auto flex min-h-[calc(100svh-136px)] w-full max-w-[430px] flex-col px-6 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-8 sm:max-w-[680px] sm:px-7 lg:max-w-[900px] [@media(max-height:800px)]:pt-4">
        <header
          className="grid grid-cols-[40px_1fr_40px] items-center gap-3"
          data-testid="mind-memory-canonical-topbar"
        >
          <button
            type="button"
            aria-label={t("common.back", "Back")}
            data-testid="button-mind-memory-back"
            onClick={() => navigate("/menu")}
            className={cn(
              "vyva-tap grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150",
              isDark
                ? "bg-white/[0.07] text-[#F7F0FF] ring-1 ring-inset ring-white/[0.18]"
                : "bg-white text-[#6B5173] ring-1 ring-black/[0.05] shadow-[0_14px_32px_rgba(80,52,109,0.12)]",
            )}
          >
            <VyvaIcon icon={ArrowLeft} size={18} strokeWidth={2.45} tone="brand" />
          </button>

          <h1 className="truncate text-center font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] text-inherit">
            {t("mindMemory.heroTitle", "Brain Coach")}
          </h1>

          <div className="relative flex justify-end">
            <CanonicalVoiceButton
              label={t("mindMemory.heroAction", "Talk to VYVA")}
              contextHint={t(
                "mindMemory.voiceContext",
                "Mind and memory support. Ask about memory, mood, confusion, focus, sleep, and safe next steps.",
              )}
              agentSlug="brain-coach"
              dynamicVariables={{ app_entrypoint: "mind_memory_canonical_topbar" }}
              testId="button-mind-memory-voice"
            />
          </div>
        </header>

        <section
          className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5"
          data-testid="mind-memory-cards"
          data-card-layout="canonical-health-hub-grid"
          aria-label={t("mindMemory.library.chooseSkill", "Choose a skill")}
        >
          {BRAIN_COACH_MODULES.map((module) => {
            const activityCount = getBrainCoachActivitiesForModule(module.id).length;
            const chip = MODULE_CHIPS[module.id];

            return (
              <CanonicalBrainCoachActivityCard
                key={module.id}
                type="button"
                data-testid={module.testId}
                onClick={() => navigate(module.route)}
                title={t(module.titleKey, module.title)}
                icon={module.icon}
                iconAccent={module.iconAccent}
                iconBg={module.tone.iconBg}
                iconColor={module.tone.iconColor}
                borderColor={module.tone.borderColor}
                badge={(
                  <span data-testid={`${module.testId}-status`}>
                    {t("mindMemory.library.activityCount", "{{count}} activities", { count: activityCount }).replace(
                      "{{count}}",
                      String(activityCount),
                    )}
                  </span>
                )}
                badgeBg={chip.background}
                badgeColor={chip.color}
                aria-label={t(module.titleKey, module.title)}
              />
            );
          })}
        </section>
      </div>
    </main>
  );
}
