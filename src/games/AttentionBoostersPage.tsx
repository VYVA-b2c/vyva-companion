import { ArrowLeft, Brain, ChevronRight, Footprints, Route } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";

type AttentionCopy = {
  title: string;
  subtitle: string;
  back: string;
  games: Array<{
    title: string;
    description: string;
    badge: string;
    route: string;
    icon: "dual" | "rhythm";
    colors: {
      accent: string;
      bg: string;
      border: string;
    };
  }>;
};

const copy: Record<string, AttentionCopy> = {
  es: {
    title: "Atencion",
    subtitle: "Elige un ejercicio para concentrarte, reaccionar y mantener el ritmo.",
    back: "Volver",
    games: [
      {
        title: "Doble Tarea",
        description: "Cuenta hacia atras mientras reaccionas a los simbolos.",
        badge: "Nuevo",
        route: "/dual-task-walk",
        icon: "dual",
        colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
      },
      {
        title: "Ritmo y Toque",
        description: "Mira la secuencia y toca las fichas en el mismo orden.",
        badge: "Atencion",
        route: "/attention-boosters/rhythm-tap",
        icon: "rhythm",
        colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
      },
    ],
  },
  de: {
    title: "Aufmerksamkeit",
    subtitle: "Wahle eine Ubung fur Fokus, Reaktion und Rhythmus.",
    back: "Zuruck",
    games: [
      {
        title: "Doppelaufgabe",
        description: "Zahlen Sie ruckwarts und reagieren Sie gleichzeitig auf Symbole.",
        badge: "Neu",
        route: "/dual-task-walk",
        icon: "dual",
        colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
      },
      {
        title: "Rhythmus & Tippen",
        description: "Merken Sie sich die Folge und tippen Sie sie ruhig nach.",
        badge: "Fokus",
        route: "/attention-boosters/rhythm-tap",
        icon: "rhythm",
        colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
      },
    ],
  },
  en: {
    title: "Attention Boosters",
    subtitle: "Choose an exercise for focus, reaction, and rhythm.",
    back: "Back",
    games: [
      {
        title: "Dual Task Walk",
        description: "Count backwards while reacting to matching symbols.",
        badge: "New",
        route: "/dual-task-walk",
        icon: "dual",
        colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
      },
      {
        title: "Rhythm & Tap",
        description: "Watch the pattern and tap the tiles in the same order.",
        badge: "Focus",
        route: "/attention-boosters/rhythm-tap",
        icon: "rhythm",
        colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
      },
    ],
  },
  fr: {
    title: "Attention",
    subtitle: "Choisissez un exercice pour travailler concentration, reaction et rythme.",
    back: "Retour",
    games: [
      {
        title: "Double Tache",
        description: "Comptez a rebours tout en reagissant aux symboles.",
        badge: "Nouveau",
        route: "/dual-task-walk",
        icon: "dual",
        colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
      },
      {
        title: "Rythme et Toucher",
        description: "Regardez la sequence puis touchez les cases dans le meme ordre.",
        badge: "Focus",
        route: "/attention-boosters/rhythm-tap",
        icon: "rhythm",
        colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
      },
    ],
  },
  it: {
    title: "Attenzione",
    subtitle: "Scegli un esercizio per concentrazione, reazione e ritmo.",
    back: "Indietro",
    games: [
      {
        title: "Doppio Compito",
        description: "Conta all'indietro mentre reagisci ai simboli uguali.",
        badge: "Nuovo",
        route: "/dual-task-walk",
        icon: "dual",
        colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
      },
      {
        title: "Ritmo e Tocco",
        description: "Guarda la sequenza e tocca le tessere nello stesso ordine.",
        badge: "Focus",
        route: "/attention-boosters/rhythm-tap",
        icon: "rhythm",
        colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
      },
    ],
  },
  pt: {
    title: "Atencao",
    subtitle: "Escolha um exercicio para foco, reacao e ritmo.",
    back: "Voltar",
    games: [
      {
        title: "Dupla Tarefa",
        description: "Conte para tras enquanto reage aos simbolos iguais.",
        badge: "Novo",
        route: "/dual-task-walk",
        icon: "dual",
        colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
      },
      {
        title: "Ritmo e Toque",
        description: "Observe a sequencia e toque nos blocos pela mesma ordem.",
        badge: "Foco",
        route: "/attention-boosters/rhythm-tap",
        icon: "rhythm",
        colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
      },
    ],
  },
};

export default function AttentionBoostersPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const pageCopy = copy[language] ?? copy.en;

  return (
    <div className="vyva-page">
      <button
        type="button"
        onClick={() => navigate("/activities")}
        className="mt-2 inline-flex min-h-[64px] items-center gap-3 rounded-full bg-white px-5 text-[22px] font-bold text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={24} />
        {pageCopy.back}
      </button>

      <section className="mt-5 rounded-[8px] border border-[#EDE2D1] bg-[#FFF9F1] p-6 shadow-vyva-card">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[22px] font-bold uppercase text-vyva-purple">{pageCopy.title}</p>
            <h1 className="mt-3 font-display text-[42px] font-bold leading-[1.05] text-vyva-text-1">
              {pageCopy.title}
            </h1>
            <p className="mt-4 text-[24px] leading-[1.35] text-vyva-text-2">{pageCopy.subtitle}</p>
          </div>
          <div className="flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-[8px] bg-white shadow-vyva-card">
            <Brain size={44} className="text-vyva-purple" />
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pageCopy.games.map((game) => {
          const Icon = game.icon === "dual" ? Footprints : Route;

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
                    {game.badge}
                  </span>
                </div>

                <div>
                  <h2 className="text-[30px] font-extrabold leading-[1.1] text-vyva-text-1">{game.title}</h2>
                  <p className="mt-3 text-[22px] leading-[1.35] text-vyva-text-2">{game.description}</p>
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
