import { useTranslation } from "react-i18next";
import { BrainCircuit, Play, HelpCircle, Layers, Type, Puzzle, Headphones, Wind, Users } from "lucide-react";
import { margaret } from "@/data/mockData";
import VoiceHero from "@/components/VoiceHero";

const activityIcons: Record<string, any> = {
  "brain.activities.triviaQuiz": HelpCircle,
  "brain.activities.memoryGame": Layers,
  "brain.activities.scrabble": Type,
  "brain.activities.logicPuzzle": Puzzle,
  "brain.activities.meditation": Headphones,
  "brain.activities.breathing": Wind,
};

const activityStyles: Record<string, { iconBg: string; iconColor: string }> = {
  "brain.activities.triviaQuiz": { iconBg: "#ECFDF5", iconColor: "#0A7C4E" },
  "brain.activities.memoryGame": { iconBg: "#EDE9FE", iconColor: "#6B21A8" },
  "brain.activities.scrabble": { iconBg: "#FDF2F8", iconColor: "#B0355A" },
  "brain.activities.logicPuzzle": { iconBg: "#FEF3C7", iconColor: "#C9890A" },
  "brain.activities.meditation": { iconBg: "#F0FDFA", iconColor: "#0F766E" },
  "brain.activities.breathing": { iconBg: "#ECFDF5", iconColor: "#0A7C4E" },
};

const ActivitiesScreen = () => {
  const { t } = useTranslation();
  const todayIndex = new Date().getDay();
  const mappedToday = todayIndex === 0 ? 6 : todayIndex - 1;
  const days: string[] = t("brain.dayAbbreviations", { returnObjects: true }) as string[];

  return (
    <div className="px-[22px]">
      <VoiceHero
        sourceText={t("brain.voiceSource")}
        headline={<>{t("brain.headline")}</>}
        subtitle={t("brain.subtitle", { streak: margaret.streak })}
        contextHint="brain training"
      >
        {/* Start session button */}
        <button className="w-full flex items-center justify-center gap-2 rounded-full py-[13px] px-[20px] mt-3 min-h-[56px] bg-white">
          <Play size={16} style={{ color: "#6B21A8" }} />
          <span className="font-body text-[16px] font-medium" style={{ color: "#6B21A8" }}>
            {t("brain.startSession")}
          </span>
        </button>
      </VoiceHero>

      {/* Section header */}
      <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1 mt-[18px] mb-[10px]">
        {t("brain.chooseActivity")}
      </h2>

      {/* Activity Grid */}
      <div className="grid grid-cols-3 gap-[10px]">
        {margaret.activities.map((act) => {
          const Icon = activityIcons[act.name] || BrainCircuit;
          const style = activityStyles[act.name] || { iconBg: "#EDE9FE", iconColor: "#6B21A8" };

          return (
            <button
              key={act.name}
              className="rounded-[16px] p-[16px_12px] flex flex-col items-center gap-[8px] bg-white border border-vyva-border"
              style={{
                minHeight: 100,
                ...(act.done
                  ? { borderColor: "#A7F3D0", background: "#ECFDF5" }
                  : { boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }),
              }}
            >
              <div
                className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center"
                style={{ background: style.iconBg }}
              >
                <Icon size={20} style={{ color: style.iconColor }} />
              </div>

              <span className="font-body text-[14px] font-medium text-vyva-text-1 text-center leading-tight">
                {t(act.name)}
              </span>

              {act.done && (
                <span
                  className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "#ECFDF5", color: "#065F46" }}
                >
                  {t("brain.doneToday")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Find a Companion tile */}
      <div
        data-testid="button-find-companion"
        className="w-full flex items-center gap-4 bg-white rounded-[16px] border border-vyva-border p-[16px_18px] mt-3 text-left"
        style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
      >
        <div
          className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{ background: "#F5F3FF" }}
        >
          <Users size={22} style={{ color: "#6B21A8" }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-body text-[15px] font-semibold text-vyva-text-1">
            {t("companions.activityTile")}
          </p>
          <p className="font-body text-[13px] text-vyva-text-2 truncate">
            {t("companions.activityTileSubtitle")}
          </p>
        </div>
        <span className="font-body text-[13px] font-medium" style={{ color: "#6B21A8" }}>{"\u2192"}</span>

        <span className="font-body text-[13px] font-medium" style={{ color: "#6B21A8" }}>
          →
        </span>
      </div>

      {/* Streak Tracker */}
      <div
        className="mt-3 mb-4 bg-white rounded-[16px] border border-vyva-border p-[16px_18px] flex items-center justify-between"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
      >
        <div>
          <p className="font-body text-[14px] font-medium text-vyva-text-1 mb-2">
            {t("brain.streakThisWeek")}
          </p>

          <div className="flex gap-[6px]">
            {days.map((d, i) => {
              const completed = i < mappedToday;
              const isToday = i === mappedToday;

              return (
                <div
                  key={i}
                  className="w-[32px] h-[32px] rounded-[9px] flex items-center justify-center font-body text-[12px] font-medium"
                  style={
                    completed
                      ? { background: "#6B21A8", color: "#FFFFFF" }
                      : isToday
                        ? { background: "#F5F3FF", color: "#6B21A8", border: "2px solid #6B21A8" }
                        : { background: "#F5EFE4", color: "#B5A89F" }
                  }
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-right">
          <p className="font-display text-[34px] font-medium leading-none" style={{ color: "#6B21A8" }}>
            {margaret.streak}
          </p>
          <p className="font-body text-[12px] text-vyva-text-2">{t("brain.dayStreak")}</p>
        </div>
      </div>
    </div>
  );
};

export default ActivitiesScreen;

