import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  ChevronRight,
  Clock3,
  Grid2x2,
  Hash,
  Layers3,
  Link2,
  NotebookPen,
  Route,
  Sparkles,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { getGameHistory } from "./gameStorage";
import { getCognitiveDomainLabel, getGameTitle, memoryGameRegistry, MEMORY_GAME_ORDER } from "./memoryGameRegistry";
import { getRecommendedLevelForGame, selectGamePlan, selectNextMemoryGame } from "./progressionEngine";
import type { GameResult, MemoryGameType, Recommendation } from "./types";

const FALLBACK_USER_ID = "vyva-local-user";

function formatLastSession(
  result: GameResult | undefined,
  language: ReturnType<typeof useLanguage>["language"],
  t: ReturnType<typeof useLanguage>["t"],
) {
  if (!result) return t("memory.noHistoryYet");

  const date = new Date(result.completedAt).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
  });

  return `${getGameTitle(result.gameType as MemoryGameType, language)} - ${date}`;
}

function getGameIcon(gameType: MemoryGameType) {
  switch (gameType) {
    case "memory_match":
      return Grid2x2;
    case "sequence_memory":
      return Route;
    case "word_recall":
      return NotebookPen;
    case "number_memory":
      return Hash;
    case "routine_memory":
      return Clock3;
    case "association_memory":
      return Link2;
    case "story_recall":
      return BookOpen;
    default:
      return Brain;
  }
}

const MemoryGamesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const userId = user?.id ?? FALLBACK_USER_ID;

  const [history, setHistory] = useState<GameResult[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [manualPlans, setManualPlans] = useState<Record<MemoryGameType, Recommendation>>({} as Record<MemoryGameType, Recommendation>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [historyData, recommended, ...plans] = await Promise.all([
        getGameHistory(userId),
        selectNextMemoryGame(userId, language),
        ...MEMORY_GAME_ORDER.map((gameType) => selectGamePlan(userId, gameType, language)),
      ]);

      if (!active) return;

      setHistory(historyData);
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

  const lastSession = history[0];

  const summary = useMemo(() => {
    if (!recommendation) {
      return {
        lastSessionLabel: formatLastSession(lastSession, language, t),
        levelLabel: `${t("common.level")} 1`,
        areaLabel: t("cognitiveDomains.visual_memory"),
      };
    }

    const definition = memoryGameRegistry[recommendation.gameType];
    const currentLevel = getRecommendedLevelForGame(history, recommendation.gameType);

    return {
      lastSessionLabel: formatLastSession(lastSession, language, t),
      levelLabel: `${t("common.level")} ${currentLevel}`,
      areaLabel: getCognitiveDomainLabel(definition.cognitiveDomain, language),
    };
  }, [history, language, lastSession, recommendation, t]);

  const recommendedDefinition = recommendation ? memoryGameRegistry[recommendation.gameType] : null;
  const RecommendedIcon = recommendation ? getGameIcon(recommendation.gameType) : Sparkles;

  const openPlan = (plan: Recommendation) => {
    navigate(`/memory-games/${plan.gameType}?level=${plan.level}&variant=${plan.variantId}`);
  };

  return (
    <div className="px-[22px] pb-7">
      <button
        onClick={() => navigate("/activities")}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>

      <section className="relative mt-4 overflow-hidden rounded-[30px] border border-[#EFE7DB] bg-[#FFF9F1] px-5 py-5 shadow-vyva-card">
        <div
          className="pointer-events-none absolute right-[-34px] top-[-28px] h-[140px] w-[140px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(107,33,168,0.16) 0%, rgba(107,33,168,0) 72%)" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-[-44px] left-[-18px] h-[118px] w-[118px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,193,94,0.16) 0%, rgba(255,193,94,0) 72%)" }}
          aria-hidden="true"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple shadow-sm">
              <Sparkles size={14} />
              {t("memory.trainingDaily")}
            </div>
            <h1 className="mt-4 max-w-[10ch] font-display text-[31px] leading-[1.04] text-vyva-text-1">
              {t("memory.title")}
            </h1>
            <p className="mt-3 max-w-[24ch] text-[15px] leading-[1.55] text-vyva-text-2">
              {t("memory.subtitle")}
            </p>
          </div>

          <div className="relative flex h-[96px] w-[96px] flex-shrink-0 items-center justify-center rounded-[28px] bg-white shadow-vyva-card">
            <div
              className="absolute inset-[10px] rounded-[22px]"
              style={{ background: "linear-gradient(145deg, #6B21A8 0%, #8B3FC8 100%)" }}
            />
            <RecommendedIcon size={34} className="relative z-[1] text-white" />
            <div className="absolute -left-2 bottom-3 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#F7D35F] text-[#7C4A00] shadow-sm">
              <Brain size={12} />
            </div>
            <div className="absolute -right-1 top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#DDF7E9] text-[#15803D] shadow-sm">
              <Target size={12} />
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2">
          <div className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">
            {summary.levelLabel}
          </div>
          <div className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-1 shadow-sm">
            {summary.areaLabel}
          </div>
          <div className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-vyva-text-2 shadow-sm">
            {summary.lastSessionLabel}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-vyva-border bg-white p-4 shadow-vyva-card">
        <div className="grid grid-cols-[88px_1fr] gap-4">
          <div
            className="flex min-h-[108px] items-center justify-center rounded-[24px] text-white"
            style={{
              background: recommendedDefinition
                ? `linear-gradient(180deg, ${recommendedDefinition.accentColor} 0%, #3D0D82 100%)`
                : "linear-gradient(180deg, #6B21A8 0%, #3D0D82 100%)",
            }}
          >
            <RecommendedIcon size={34} />
          </div>

          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-vyva-purple-light px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple">
              <Sparkles size={14} />
              {t("memory.recommendedToday")}
            </div>
            <h2 className="mt-3 text-[26px] font-semibold leading-[1.08] text-vyva-text-1">
              {recommendation ? getGameTitle(recommendation.gameType, language) : t("common.loading")}
            </h2>
            <p className="mt-2 text-[15px] leading-[1.55] text-vyva-text-2">
              {recommendation?.reasonLabel ?? t("memory.recommendationLoading")}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-vyva-cream px-3 py-2 text-[13px] font-medium text-vyva-text-1">
                {summary.areaLabel}
              </span>
              <span className="rounded-full bg-vyva-cream px-3 py-2 text-[13px] font-medium text-vyva-text-1">
                {summary.levelLabel}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => recommendation && openPlan(recommendation)}
          disabled={!recommendation || loading}
          className="mt-4 flex w-full items-center justify-between rounded-[22px] px-5 py-5 text-left text-white shadow-vyva-card disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #6B21A8 0%, #8B3FC8 100%)" }}
        >
          <div className="min-w-0">
            <p className="text-[20px] font-semibold">{t("memory.startRecommended")}</p>
            <p className="mt-1 text-[14px] leading-[1.45] text-white/84">{t("memory.recommendationHint")}</p>
          </div>
          <div className="ml-4 flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-white/14">
            <ChevronRight size={22} />
          </div>
        </button>
      </section>

      <section className="mt-5">
        <div className="flex items-center gap-2">
          <Layers3 size={18} className="text-vyva-purple" />
          <h2 className="font-display text-[24px] text-vyva-text-1">{t("memory.chooseAnother")}</h2>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MEMORY_GAME_ORDER.map((gameType) => {
            const definition = memoryGameRegistry[gameType];
            const plan = manualPlans[gameType];
            const GameIcon = getGameIcon(gameType);

            return (
              <button
                key={gameType}
                onClick={() => plan && openPlan(plan)}
                className="relative overflow-hidden rounded-[24px] border border-vyva-border bg-white p-4 text-left shadow-vyva-card transition-transform hover:-translate-y-[1px]"
              >
                <div
                  className="absolute inset-x-0 top-0 h-[6px]"
                  style={{ background: `linear-gradient(90deg, ${definition.accentColor} 0%, ${definition.iconBg} 100%)` }}
                  aria-hidden="true"
                />

                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center rounded-[22px]"
                    style={{ background: definition.iconBg, color: definition.accentColor }}
                  >
                    <GameIcon size={30} />
                  </div>

                  <div
                    className="rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={{ background: definition.iconBg, color: definition.accentColor }}
                  >
                    {plan ? `${t("common.level")} ${plan.level}` : `${t("common.level")} 1`}
                  </div>
                </div>

                <h3 className="mt-4 text-[22px] font-semibold leading-[1.15] text-vyva-text-1">
                  {getGameTitle(gameType, language)}
                </h3>

                <p
                  className="mt-2 text-[14px] leading-[1.5] text-vyva-text-2"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {t(definition.descriptionKey)}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span
                    className="rounded-full px-3 py-2 text-[13px] font-medium"
                    style={{ background: definition.iconBg, color: definition.accentColor }}
                  >
                    {getCognitiveDomainLabel(definition.cognitiveDomain, language)}
                  </span>
                  <div
                    className="flex h-[36px] w-[36px] items-center justify-center rounded-full"
                    style={{ background: definition.iconBg, color: definition.accentColor }}
                  >
                    <ChevronRight size={18} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MemoryGamesPage;
