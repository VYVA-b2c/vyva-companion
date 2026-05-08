import { ArrowLeft, Brain, ChevronRight, Footprints, Route } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";

const attentionGames = [
  {
    key: "dualTask",
    route: "/dual-task-walk",
    icon: "dual",
    colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
  },
  {
    key: "rhythmTap",
    route: "/attention-boosters/rhythm-tap",
    icon: "rhythm",
    colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
  },
] as const;

export default function AttentionBoostersPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const title = t("brainGames.attentionBoosters.title");

  return (
    <div className="vyva-page">
      <button
        type="button"
        onClick={() => navigate("/activities")}
        className="mt-2 inline-flex min-h-[64px] items-center gap-3 rounded-full bg-white px-5 text-[22px] font-bold text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={24} />
        {t("common.back")}
      </button>

      <section className="mt-5 rounded-[8px] border border-[#EDE2D1] bg-[#FFF9F1] p-6 shadow-vyva-card">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[22px] font-bold uppercase text-vyva-purple">{title}</p>
            <h1 className="mt-3 font-display text-[42px] font-bold leading-[1.05] text-vyva-text-1">
              {title}
            </h1>
            <p className="mt-4 text-[24px] leading-[1.35] text-vyva-text-2">{t("brainGames.attentionBoosters.subtitle")}</p>
          </div>
          <div className="flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-[8px] bg-white shadow-vyva-card">
            <Brain size={44} className="text-vyva-purple" />
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {attentionGames.map((game) => {
          const Icon = game.icon === "dual" ? Footprints : Route;
          const copyPath = `brainGames.attentionBoosters.${game.key}`;

          return (
            <button
              key={game.route}
              type="button"
              onClick={() => navigate(game.route)}
              className="min-h-[220px] rounded-[8px] border-2 bg-white p-5 text-left shadow-vyva-card transition-transform active:scale-[0.99]"
              style={{ borderColor: game.colors.border }}
            >
              <div className="flex h-full flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[8px]"
                    style={{ background: game.colors.bg, color: game.colors.accent }}
                  >
                    <Icon size={36} />
                  </div>
                  <span
                    className="rounded-full px-4 py-2 text-[18px] font-bold"
                    style={{ background: game.colors.bg, color: game.colors.accent }}
                  >
                    {t(`${copyPath}.badge`)}
                  </span>
                </div>

                <div>
                  <h2 className="text-[30px] font-extrabold leading-[1.1] text-vyva-text-1">{t(`${copyPath}.title`)}</h2>
                  <p className="mt-3 text-[22px] leading-[1.35] text-vyva-text-2">{t(`${copyPath}.description`)}</p>
                </div>

                <div className="flex items-center justify-end">
                  <div
                    className="flex h-[64px] w-[64px] items-center justify-center rounded-full text-white"
                    style={{ background: game.colors.accent }}
                  >
                    <ChevronRight size={34} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}
