import { BrainCircuit, Headphones, Layers, Map as MapIcon, Puzzle, Route, Type, Users, Wind, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { margaret } from "@/data/mockData";
import { useLanguage } from "@/i18n";
import VoiceHero from "@/components/VoiceHero";

const activityIcons: Record<string, LucideIcon> = {
  "brain.activities.triviaQuiz": Route,
  "brain.activities.memoryGame": Layers,
  "brain.activities.spatialNavigator": MapIcon,
  "brain.activities.scrabble": Type,
  "brain.activities.logicPuzzle": Puzzle,
  "brain.activities.meditation": Headphones,
  "brain.activities.breathing": Wind,
};

const activityStyles: Record<string, { iconBg: string; iconColor: string; glow: string; badgeBg: string; badgeText: string }> = {
  "brain.activities.triviaQuiz": {
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    iconColor: "#149A63",
    glow: "rgba(20,154,99,0.12)",
    badgeBg: "#DDF8EA",
    badgeText: "#0A7C4E",
  },
  "brain.activities.memoryGame": {
    iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
    iconColor: "#7C3AED",
    glow: "rgba(124,58,237,0.13)",
    badgeBg: "#EDE9FE",
    badgeText: "#6D28D9",
  },
  "brain.activities.spatialNavigator": {
    iconBg: "linear-gradient(135deg, #FEF3C7 0%, #FFF7ED 100%)",
    iconColor: "#B45309",
    glow: "rgba(180,83,9,0.12)",
    badgeBg: "#FEF3C7",
    badgeText: "#B45309",
  },
  "brain.activities.scrabble": {
    iconBg: "linear-gradient(135deg, #FFE7E7 0%, #FFF7F2 100%)",
    iconColor: "#E74C43",
    glow: "rgba(231,76,67,0.12)",
    badgeBg: "#FFE7E7",
    badgeText: "#B0355A",
  },
  "brain.activities.logicPuzzle": {
    iconBg: "linear-gradient(135deg, #FEF3C7 0%, #FFF7ED 100%)",
    iconColor: "#C9890A",
    glow: "rgba(201,137,10,0.12)",
    badgeBg: "#FEF3C7",
    badgeText: "#A16207",
  },
  "brain.activities.meditation": {
    iconBg: "linear-gradient(135deg, #CCFBF1 0%, #F0FDFA 100%)",
    iconColor: "#0F766E",
    glow: "rgba(15,118,110,0.12)",
    badgeBg: "#CCFBF1",
    badgeText: "#0F766E",
  },
  "brain.activities.breathing": {
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    iconColor: "#149A63",
    glow: "rgba(20,154,99,0.12)",
    badgeBg: "#DDF8EA",
    badgeText: "#0A7C4E",
  },
};

const activityRoutes: Partial<Record<string, string>> = {
  "brain.activities.triviaQuiz": "/attention-boosters",
  "brain.activities.memoryGame": "/memory-games",
  "brain.activities.spatialNavigator": "/spatial-navigator",
  "brain.activities.scrabble": "/memory-games/story_recall",
  "brain.activities.logicPuzzle": "/memory-games/routine_memory",
};

const ActivitiesScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const todayIndex = new Date().getDay();
  const mappedToday = todayIndex === 0 ? 6 : todayIndex - 1;
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  const activityLabels: Record<string, string> = {
    "brain.activities.triviaQuiz": t("activities.trivia"),
    "brain.activities.memoryGame": t("activities.memory"),
    "brain.activities.spatialNavigator": t("activities.spatialNavigator"),
    "brain.activities.scrabble": t("activities.scrabble"),
    "brain.activities.logicPuzzle": t("activities.logicPuzzle"),
    "brain.activities.meditation": t("activities.meditation"),
    "brain.activities.breathing": t("activities.breathing"),
  };

  const handleActivityClick = (activityName: string) => {
    const targetRoute = activityRoutes[activityName];
    if (targetRoute) navigate(targetRoute);
  };

  return (
    <div className="vyva-page">
      <VoiceHero
        heroSurface="brain"
        sourceText={t("brain.voiceSource")}
        headline={<>{t("brain.headline")}</>}
        subtitle={t("brain.subtitle", { streak: margaret.streak })}
        contextHint="brain training"
      />

      <section
        className="mt-[18px] rounded-[26px] border bg-[#FFF9F1] p-4"
        style={{
          borderColor: "#EDE2D1",
          boxShadow: "0 2px 10px rgba(43,31,24,0.05)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple">{t("brain.streakThisWeek")}</p>
            <p className="mt-1 font-display text-[30px] leading-none text-vyva-text-1">{margaret.streak}</p>
          </div>
          <div className="flex gap-[6px]">
            {days.map((d, i) => {
              const completed = i < mappedToday;
              const isToday = i === mappedToday;
              return (
                <div
                  key={i}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[12px] font-medium"
                  style={
                    completed
                      ? { background: "#6B21A8", color: "#FFFFFF", boxShadow: "0 8px 18px rgba(107,33,168,0.16)" }
                      : isToday
                        ? { background: "#FFFFFF", color: "#6B21A8", border: "2px solid #6B21A8" }
                        : { background: "#FFFFFF", color: "#B5A89F", border: "1px solid #EFE4D5" }
                  }
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-[18px]">
        <h2 className="vyva-section-title">{t("activities.chooseActivity")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {margaret.activities.map((act) => {
            const Icon = activityIcons[act.name] || BrainCircuit;
            const style = activityStyles[act.name] || {
              iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
              iconColor: "#7C3AED",
              glow: "rgba(124,58,237,0.13)",
              badgeBg: "#EDE9FE",
              badgeText: "#6D28D9",
            };

            return (
              <button
                key={act.name}
                type="button"
                onClick={() => handleActivityClick(act.name)}
                data-testid={`activity-card-${act.name.replaceAll(".", "-")}`}
                aria-label={activityLabels[act.name] ?? t("activities.memory")}
                className="group relative min-h-[168px] overflow-visible rounded-[28px] border bg-[#FFFCF8] px-4 py-4 text-left transition-transform active:scale-[0.99]"
                style={{
                  borderColor: "#EDE2D1",
                  boxShadow: `0 16px 34px ${style.glow}, 0 2px 10px rgba(43,31,24,0.05)`,
                }}
              >
                <div className="relative z-10 flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px]"
                      style={{ background: style.iconBg }}
                    >
                      <Icon size={30} strokeWidth={2.5} style={{ color: style.iconColor }} />
                    </div>
                    {act.done ? (
                      <span
                        className="rounded-full px-2.5 py-1 font-body text-[11px] font-bold leading-tight shadow-sm"
                        style={{ background: style.badgeBg, color: style.badgeText }}
                      >
                        {t("activities.doneToday")}
                      </span>
                    ) : null}
                  </div>

                  <p className="min-w-0 font-body text-[21px] font-extrabold leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">
                    {activityLabels[act.name] ?? t("activities.memory")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="mt-[18px] rounded-[26px] border bg-[#FFFCF8] p-[16px_18px]"
        style={{
          borderColor: "#EDE2D1",
          boxShadow: "0 2px 10px rgba(43,31,24,0.05)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[20px]"
            style={{ background: "linear-gradient(135deg, #E6F0FF 0%, #F3F8FF 100%)" }}
          >
            <Users size={28} strokeWidth={2.5} style={{ color: "#2F66D0" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-body text-[17px] font-semibold leading-snug text-vyva-text-1">{t("companions.activityTile")}</p>
            <p className="mt-1 font-body text-[13px] leading-[1.5] text-vyva-text-2">{t("companions.activityTileSubtitle")}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ActivitiesScreen;
