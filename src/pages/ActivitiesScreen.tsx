import { BrainCircuit, Play, HelpCircle, Layers, Type, Puzzle, Headphones, Wind } from "lucide-react";
import { margaret } from "@/data/mockData";
import VoiceHero from "@/components/VoiceHero";

const activityIcons: Record<string, any> = {
  "Trivia quiz": HelpCircle,
  "Memory game": Layers,
  "Scrabble": Type,
  "Logic puzzle": Puzzle,
  "Meditation": Headphones,
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
  const todayIndex = new Date().getDay();
  const mappedToday = todayIndex === 0 ? 6 : todayIndex - 1;

  return (
    <div className="px-[22px]">
      <VoiceHero
        sourceText="VYVA is your brain coach"
        headline={<>Ready for brain{"\n"}training?</>}
        subtitle={`${margaret.streak}-day streak — keep it going!`}
        contextHint="brain training"
      >
        {/* Start session button */}
        <button className="w-full flex items-center justify-center gap-2 rounded-full py-[13px] px-[20px] mt-3 min-h-[56px] bg-white">
          <Play size={16} style={{ color: "#6B21A8" }} />
          <span className="font-body text-[16px] font-medium" style={{ color: "#6B21A8" }}>Start a session</span>
        </button>
      </VoiceHero>

      {/* Section header */}
      <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1 mt-[18px] mb-[10px]">Choose an activity</h2>

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
                ...(act.done ? { borderColor: "#A7F3D0", background: "#ECFDF5" } : { boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }),
              }}
            >
              <div className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center" style={{ background: style.iconBg }}>
                <Icon size={20} style={{ color: style.iconColor }} />
              </div>
              <span className="font-body text-[14px] font-medium text-vyva-text-1 text-center leading-tight">{act.name}</span>
              {act.done && (
                <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#ECFDF5", color: "#065F46" }}>
                  Done today
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Streak Tracker */}
      <div className="mt-3 mb-4 bg-white rounded-[16px] border border-vyva-border p-[16px_18px] flex items-center justify-between" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div>
          <p className="font-body text-[14px] font-medium text-vyva-text-1 mb-2">Your streak this week</p>
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
          <p className="font-display text-[34px] font-medium leading-none" style={{ color: "#6B21A8" }}>{margaret.streak}</p>
          <p className="font-body text-[12px] text-vyva-text-2">day streak</p>
        </div>
      </div>
    </div>
  );
};

export default ActivitiesScreen;
