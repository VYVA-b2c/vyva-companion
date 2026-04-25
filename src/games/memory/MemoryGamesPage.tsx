import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Brain, ChevronRight, Layers3, Sparkles, Target, Trophy } from "lucide-react";
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

  return `${getGameTitle(result.gameType as MemoryGameType, language)} · ${date}`;
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

  const openPlan = (plan: Recommendation) => {
    navigate(`/memory-games/${plan.gameType}?level=${plan.level}&variant=${plan.variantId}`);
  };

  return (
    <div className="px-[22px] pb-6">
      <button
        onClick={() => navigate("/activities")}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>
      <section
        className="relative mt-4 overflow-hidden rounded-[30px] px-6 py-6 text-white shadow-vyva-hero"
        style={{ background: "linear-gradient(145deg, #3D0D82 0%, #6B21A8 52%, #8B3FC8 100%)" }}
      >
        <div
          className="pointer-events-none absolute right-[-26px] top-[-18px] h-[130px] w-[130px] rounded-full border border-white/12 bg-white/10 blur-[2px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-[-36px] right-[22px] h-[96px] w-[96px] rounded-full border border-white/10 bg-[#F5D7FF]/10"
          aria-hidden="true"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em]">
              <Brain size={14} />
              {t("memory.trainingDaily")}
            </div>
            <h1 className="mt-5 max-w-[11ch] font-display text-[30px] leading-[1.08] sm:text-[34px]">{t("memory.title")}</h1>
            <p className="mt-4 max-w-[28ch] text-[16px] leading-[1.55] text-white/82">{t("memory.subtitle")}</p>
          </div>

          <div className="hidden min-w-[110px] rounded-[24px] border border-white/15 bg-white/10 p-4 text-white/92 sm:block">
            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-[16px] bg-white/14">
              <Sparkles size={20} />
            </div>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/70">
              {t("memory.recommendedToday")}
            </p>
            <p className="mt-1 text-[22px] font-semibold leading-none">
              {recommendation?.level ?? 1}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border border-vyva-border bg-white p-5 shadow-vyva-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-vyva-purple-light px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple">
              <Sparkles size={14} />
              {t("memory.recommendedToday")}
            </div>
            <h2 className="mt-4 font-display text-[28px] leading-[1.05] text-vyva-text-1">
              {recommendation ? getGameTitle(recommendation.gameType, language) : t("common.loading")}
            </h2>
            <p className="mt-3 max-w-[26ch] text-[17px] leading-[1.55] text-vyva-text-2">
              {recommendation?.reasonLabel ?? t("memory.recommendationLoading")}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-vyva-cream px-3 py-2 text-[13px] font-medium text-vyva-text-1">
                <Layers3 size={15} className="text-vyva-purple" />
                {summary.areaLabel}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-vyva-cream px-3 py-2 text-[13px] font-medium text-vyva-text-1">
                <Target size={15} className="text-vyva-purple" />
                {summary.levelLabel}
              </div>
            </div>
          </div>
          <div
            className="flex min-h-[74px] min-w-[74px] flex-col items-center justify-center rounded-[22px] text-white shadow-vyva-card"
            style={{ background: "linear-gradient(180deg, #6B21A8 0%, #7E32BE 100%)" }}
          >
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-white/78">{t("common.level")}</span>
            <span className="mt-1 text-[28px] font-semibold leading-none">{recommendation?.level ?? "…"}</span>
          </div>
        </div>

        <button
          onClick={() => recommendation && openPlan(recommendation)}
          disabled={!recommendation || loading}
          className="mt-5 flex w-full items-center justify-between rounded-[22px] px-5 py-5 text-left text-white shadow-vyva-card disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #6B21A8 0%, #8B3FC8 100%)" }}
        >
          <div className="min-w-0">
            <p className="text-[19px] font-semibold">{t("memory.startRecommended")}</p>
            <p className="mt-1 max-w-[28ch] text-[14px] leading-[1.5] text-white/84">{t("memory.recommendationHint")}</p>
          </div>
          <div className="ml-4 flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-white/14">
            <ChevronRight size={22} />
          </div>
        </button>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: t("memory.lastSession"), value: summary.lastSessionLabel, icon: <Trophy size={16} className="text-vyva-purple" /> },
          { label: t("memory.currentLevel"), value: summary.levelLabel, icon: <Target size={16} className="text-vyva-purple" /> },
          { label: t("memory.trainedArea"), value: summary.areaLabel, icon: <Brain size={16} className="text-vyva-purple" /> },
        ].map((item) => (
          <div key={item.label} className="rounded-[20px] border border-vyva-border bg-white p-4 shadow-vyva-card">
            <div className="flex items-center gap-2">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-vyva-purple-light">
                {item.icon}
              </div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{item.label}</p>
            </div>
            <p className="mt-3 text-[18px] font-medium leading-[1.45] text-vyva-text-1">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-vyva-purple" />
          <h2 className="font-display text-[24px] text-vyva-text-1">{t("memory.chooseAnother")}</h2>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {MEMORY_GAME_ORDER.map((gameType) => {
            const definition = memoryGameRegistry[gameType];
            const plan = manualPlans[gameType];

            return (
              <button
                key={gameType}
                onClick={() => plan && openPlan(plan)}
                className="rounded-[22px] border border-vyva-border bg-white p-5 text-left shadow-vyva-card transition-transform hover:-translate-y-[1px]"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-[56px] w-[56px] flex-shrink-0 items-center justify-center rounded-[18px] text-[24px] font-semibold"
                    style={{ background: definition.iconBg, color: definition.accentColor }}
                  >
                    {getGameTitle(gameType, language).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[22px] font-semibold leading-[1.25] text-vyva-text-1">{getGameTitle(gameType, language)}</h3>
                      <span
                        className="rounded-full px-3 py-1 text-[12px] font-semibold"
                        style={{ background: definition.iconBg, color: definition.accentColor }}
                      >
                        {plan ? `${t("common.level")} ${plan.level}` : `${t("common.level")} 1`}
                      </span>
                    </div>
                    <p className="mt-2 text-[16px] leading-[1.6] text-vyva-text-2">{t(definition.descriptionKey)}</p>
                    <p className="mt-3 text-[14px] font-medium" style={{ color: definition.accentColor }}>
                      {getCognitiveDomainLabel(definition.cognitiveDomain, language)}
                    </p>
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
