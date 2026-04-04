import { Brain, Play, Trophy, Type, Puzzle, Flower2, Wind, Check } from "lucide-react";
import { margaret } from "@/data/mockData";

const activityIcons: Record<string, any> = {
  "Trivia quiz": Trophy,
  "Memory game": Brain,
  "Scrabble": Type,
  "Logic puzzle": Puzzle,
  "Meditation": Flower2,
  "Breathing": Wind,
};

const activityStyles: Record<string, { iconBg: string; iconColor: string }> = {
  "Trivia quiz": { iconBg: "#ECFDF5", iconColor: "#0A7C4E" },
  "Memory game": { iconBg: "#EDE9FE", iconColor: "#6B21A8" },
  "Scrabble": { iconBg: "#FDF2F8", iconColor: "#B0355A" },
  "Logic puzzle": { iconBg: "#FEF3C7", iconColor: "#C9890A" },
  "Meditation": { iconBg: "#F0FDFA", iconColor: "#0F766E" },
  "Breathing": { iconBg: "#ECFDF5", iconColor: "#0A7C4E" },
};

const days = ["M", "T", "W", "T", "F", "S", "S"];

const ActivitiesScreen = () => {
  const todayIndex = new Date().getDay(); // 0=Sun
  const mappedToday = todayIndex === 0 ? 6 : todayIndex - 1; // 0=Mon

  return (
    <div className="px-[22px]">
      {/* Hero */}
      <div className="mt-[14px] rounded-[22px] p-5 flex items-center gap-4 relative overflow-hidden" style={{ background: "#6B21A8" }}>
        <div className="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
          <Brain size={32} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-[22px] font-normal text-white">Brain coach</h1>
          <p className="font-body text-[14px] leading-[1.5] mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>
            Keep your mind sharp · VYVA guides everything
          </p>
          <button className="inline-flex items-center gap-[7px] bg-white rounded-[26px] py-[10px] px-[22px] mt-3 min-h-[44px]">
            <Play size={14} style={{ color: "#6B21A8" }} />
            <span className="font-body text-[15px] font-medium" style={{ color: "#6B21A8" }}>Start a session</span>
          </button>
        </div>
      </div>

      {/* Section header */}
      <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1 mt-[18px] mb-[10px]">Choose an activity</h2>

      {/* Activity Grid */}
      <div className="grid grid-cols-3 gap-[10px]">
        {margaret.activities.map((act) => {
          const Icon = activityIcons[act.name] || Brain;
          const style = activityStyles[act.name] || { iconBg: "#EDE9FE", iconColor: "#6B21A8" };
          return (
            <button
              key={act.name}
              className={`rounded-[16px] p-[14px] flex flex-col items-center gap-[7px] min-h-[52px] ${
                act.done ? "bg-vyva-green-light border-2" : "bg-white border"
              }`}
              style={{
                borderColor: act.done ? "#A7F3D0" : undefined,
                boxShadow: act.done ? undefined : "0 2px 12px rgba(0,0,0,0.07)",
              }}
            >
              <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center" style={{ background: style.iconBg }}>
                <Icon size={20} style={{ color: style.iconColor }} />
              </div>
              <span className="font-body text-[14px] font-medium text-vyva-text-1 text-center leading-tight">{act.name}</span>
              {act.done && (
                <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-vyva-green-light text-vyva-green-dark">
                  Done today
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Streak Tracker */}
      <div className="mt-3 mb-4 bg-white rounded-[16px] border border-vyva-border p-4 flex items-center justify-between" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div>
          <p className="font-body text-[14px] font-medium text-vyva-text-1 mb-1.5">Your streak this week</p>
          <div className="flex gap-[5px]">
            {days.map((d, i) => {
              const completed = i < mappedToday;
              const isToday = i === mappedToday;
              return (
                <div
                  key={i}
                  className={`w-[30px] h-[30px] rounded-[9px] flex items-center justify-center font-body text-[12px] font-medium ${
                    completed
                      ? "bg-vyva-purple text-white"
                      : isToday
                      ? "bg-vyva-purple-pale text-vyva-purple"
                      : "bg-vyva-warm text-vyva-text-3"
                  }`}
                  style={isToday ? { border: "2px solid #6B21A8" } : {}}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-[32px] font-semibold text-vyva-purple leading-none">{margaret.streak}</p>
          <p className="font-body text-[12px] text-vyva-text-2">day streak</p>
        </div>
      </div>
    </div>
  );
};

export default ActivitiesScreen;
