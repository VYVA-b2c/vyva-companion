import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { cn } from "@/lib/utils";
import { BrainCoachFlowShell } from "@/components/brain/BrainCoachFlowShell";
import { CanonicalBrainCoachActivityCard } from "@/components/brain/CanonicalBrainCoachActivityCard";
import { CanonicalVoiceButton } from "@/components/CanonicalDetailFlowShell";
import {
  getBrainCoachActivitiesForModule,
  getBrainCoachActivityByMemoryGame,
  getBrainCoachActivityDisplay,
  getBrainCoachActivityPath,
  getBrainCoachModule,
} from "../brainCoachCatalog";
import { getGameTitle, MEMORY_GAME_ORDER } from "./memoryGameRegistry";
import { selectGamePlan, selectNextMemoryGame } from "./progressionEngine";
import type { MemoryGameType, Recommendation } from "./types";

const FALLBACK_USER_ID = "vyva-local-user";

const MemoryGamesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { isDark } = useHomeMasterTheme();
  const userId = user?.id ?? FALLBACK_USER_ID;
  const module = getBrainCoachModule("memory");

  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [manualPlans, setManualPlans] = useState<Record<MemoryGameType, Recommendation>>({} as Record<MemoryGameType, Recommendation>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [recommended, ...plans] = await Promise.all([
        selectNextMemoryGame(userId, language),
        ...MEMORY_GAME_ORDER.map((gameType) => selectGamePlan(userId, gameType, language)),
      ]);

      if (!active) return;

      setRecommendation(recommended);
      setManualPlans(
        plans.reduce((accumulator, plan) => {
          accumulator[plan.gameType] = plan;
          return accumulator;
        }, {} as Record<MemoryGameType, Recommendation>),
      );
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [language, userId]);

  const recommendedActivity = recommendation ? getBrainCoachActivityByMemoryGame(recommendation.gameType) : undefined;
  const RecommendedIcon = recommendedActivity?.icon ?? Sparkles;
  const availableGameTypes = useMemo(() => {
    if (loading) return [];
    if (!recommendation) return MEMORY_GAME_ORDER;
    return MEMORY_GAME_ORDER.filter((gameType) => gameType !== recommendation.gameType);
  }, [loading, recommendation]);
  const availableMemoryActivities = useMemo(() => {
    if (loading) return [];
    return getBrainCoachActivitiesForModule("memory").filter((activity) => (
      !activity.memoryGameType || availableGameTypes.includes(activity.memoryGameType)
    ));
  }, [availableGameTypes, loading]);
  const showExerciseChoices = !loading && availableMemoryActivities.length > 0;

  const openPlan = (plan: Recommendation) => {
    const activity = getBrainCoachActivityByMemoryGame(plan.gameType);
    const route = activity ? getBrainCoachActivityPath(activity.id) : `/memory-games/${plan.gameType}`;
    navigate(`${route}?level=${plan.level}&variant=${plan.variantId}`);
  };

  const openStandaloneActivity = (activityId: string) => {
    navigate(getBrainCoachActivityPath(activityId));
  };

  return (
    <BrainCoachFlowShell
      testId="memory-games-flow-shell"
      title={t(module.titleKey, module.title)}
      icon={module.icon}
      iconAccent={module.iconAccent}
      iconBg={module.tone.iconBg}
      iconColor={module.tone.iconColor}
      presentationId={module.presentationId}
      sceneId={module.sceneId}
      action={(
        <CanonicalVoiceButton
          contextHint="Brain Coach memory activities"
          agentSlug="brain-coach"
          dynamicVariables={{ app_entrypoint: "brain_coach_memory" }}
          label={t("common.talkToVyva", "Talk to VYVA")}
          testId="button-memory-category-voice"
        />
      )}
    >
      <CanonicalBrainCoachActivityCard
        type="button"
        variant="featured"
        className="w-full"
        onClick={() => recommendation && openPlan(recommendation)}
        disabled={!recommendation || loading}
        title={recommendation ? getGameTitle(recommendation.gameType, language) : t("common.loading")}
        icon={RecommendedIcon}
        iconAccent={recommendedActivity?.iconAccent ?? "spark"}
        iconBg={recommendedActivity?.iconBg}
        iconColor={recommendedActivity?.iconColor}
        borderColor={recommendedActivity?.borderColor}
        aria-label={recommendation ? getGameTitle(recommendation.gameType, language) : t("common.loading")}
        data-testid="memory-recommended-card"
      />

      {showExerciseChoices ? (
        <section className="mt-5" data-scene-layout="activity_grid">
          <h2 className={cn(
            "px-1 font-body text-[16px] font-black leading-tight sm:text-[17px]",
            isDark ? "text-[#D8CDE4]" : "text-[#6B5173]",
          )}>
            {t("memory.chooseAnother")}
          </h2>

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
            {availableMemoryActivities.map((activity) => {
              const plan = activity.memoryGameType ? manualPlans[activity.memoryGameType] : null;
              const copy = getBrainCoachActivityDisplay(activity, t);
              const title = activity.memoryGameType ? getGameTitle(activity.memoryGameType, language) : copy.title;
              return (
                <CanonicalBrainCoachActivityCard
                  key={activity.id}
                  type="button"
                  variant="compact"
                  onClick={() => {
                    if (activity.memoryGameType && plan) {
                      openPlan(plan);
                      return;
                    }
                    if (!activity.memoryGameType) {
                      openStandaloneActivity(activity.id);
                    }
                  }}
                  title={title}
                  icon={activity.icon}
                  iconAccent={activity.iconAccent}
                  iconBg={activity.iconBg}
                  iconColor={activity.iconColor}
                  borderColor={activity.borderColor}
                  aria-label={title}
                  data-testid={activity.testId}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </BrainCoachFlowShell>
  );
};

export default MemoryGamesPage;
