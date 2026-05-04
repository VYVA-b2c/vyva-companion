import { BrainCircuit, Headphones, HelpCircle, Layers, Play, Puzzle, Type, Users, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { margaret } from "@/data/mockData";
import { useLanguage } from "@/i18n";
import VoiceHero from "@/components/VoiceHero";

const activityIcons: Record<string, any> = {
  "brain.activities.triviaQuiz": HelpCircle,
  "brain.activities.memoryGame": Layers,
  "brain.activities.scrabble": Type,
  "brain.activities.logicPuzzle": Puzzle,
  "brain.activities.meditation": Headphones,
  "brain.activities.breathing": Wind,
};

const activityStyles: Record<string, { iconBg: string; iconColor: string; cardBg: string }> = {
  "brain.activities.triviaQuiz": { iconBg: "#ECFDF5", iconColor: "#0A7C4E", cardBg: "#F7FFFA" },
  "brain.activities.memoryGame": { iconBg: "#EDE9FE", iconColor: "#6B21A8", cardBg: "#FCF8FF" },
  "brain.activities.scrabble": { iconBg: "#FDF2F8", iconColor: "#B0355A", cardBg: "#FFF8FB" },
  "brain.activities.logicPuzzle": { iconBg: "#FEF3C7", iconColor: "#C9890A", cardBg: "#FFFBEF" },
  "brain.activities.meditation": { iconBg: "#F0FDFA", iconColor: "#0F766E", cardBg: "#F7FFFD" },
  "brain.activities.breathing": { iconBg: "#ECFDF5", iconColor: "#0A7C4E", cardBg: "#F7FFFA" },
};

const activityRoutes: Partial<Record<string, string>> = {
  "brain.activities.memoryGame": "/memory-games",
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
    <div className="px-[22px] pb-5">
      <VoiceHero
        heroSurface="brain"
        sourceText={t("brain.voiceSource")}
        headline={<>{t("brain.headline")}</>}
        subtitle={t("brain.subtitle", { streak: margaret.streak })}
        contextHint="brain training"
      >
        <button className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-white px-[20px] py-[13px] shadow-vyva-card">
          <Play size={16} style={{ color: "#6B21A8" }} />
          <span className="font-body text-[16px] font-medium" style={{ color: "#6B21A8" }}>
            {t("brain.startSession")}
          </span>
        </button>
      </VoiceHero>

      <section className="mt-5 rounded-[24px] border border-[#EFE7DB] bg-[#FFF9F1] p-4 shadow-vyva-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple">{t("brain.streakThisWeek")}</p>
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
                      ? { background: "#6B21A8", color: "#FFFFFF" }
                      : isToday
                        ? { background: "#F5F3FF", color: "#6B21A8", border: "2px solid #6B21A8" }
                        : { background: "#FFFFFF", color: "#B5A89F" }
                  }
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="font-display text-[24px] text-vyva-text-1">{t("activities.chooseActivity")}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {margaret.activities.map((act) => {
            const Icon = activityIcons[act.name] || BrainCircuit;
            const style = activityStyles[act.name] || { iconBg: "#EDE9FE", iconColor: "#6B21A8", cardBg: "#FCF8FF" };

            return (
              <button
                key={act.name}
                type="button"
                onClick={() => handleActivityClick(act.name)}
                data-testid={`activity-card-${act.name.replaceAll(".", "-")}`}
                aria-label={activityLabels[act.name] ?? t("activities.memory")}
                className="rounded-[24px] border p-[16px] text-left shadow-vyva-card transition-transform hover:-translate-y-[1px]"
                style={{
                  minHeight: 148,
                  background: style.cardBg,
                  borderColor: act.done ? "#A7F3D0" : "#EDE2D1",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px]"
                    style={{ background: style.iconBg }}
                  >
                    <Icon size={24} style={{ color: style.iconColor }} />
                  </div>
                  {act.done ? (
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0A7C4E] shadow-sm">
                      {t("activities.doneToday")}
                    </span>
                  ) : null}
                </div>

                <p className="mt-5 text-[18px] font-semibold leading-[1.2] text-vyva-text-1">
                  {activityLabels[act.name] ?? t("activities.memory")}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-vyva-border bg-white p-[16px_18px] shadow-vyva-card">
        <div className="flex items-center gap-4">
          <div
            className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-[16px]"
            style={{ background: "#F5F3FF" }}
          >
            <Users size={22} style={{ color: "#6B21A8" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-vyva-text-1">{t("companions.activityTile")}</p>
            <p className="mt-0.5 text-[13px] text-vyva-text-2">{t("companions.activityTileSubtitle")}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ActivitiesScreen;
