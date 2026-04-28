import { Square, Volume2 } from "lucide-react";
import { useTtsReadout } from "@/hooks/useVyvaVoice";

type ListenButtonProps = {
  text: string;
  language?: string;
  label?: string;
  stopLabel?: string;
  className?: string;
};

function listenLabels(language?: string) {
  const base = (language ?? "es").split("-")[0].toLowerCase();
  if (base === "en") return { listen: "Listen", stop: "Stop" };
  if (base === "de") return { listen: "Anhoren", stop: "Stopp" };
  if (base === "fr") return { listen: "Ecouter", stop: "Stop" };
  if (base === "it") return { listen: "Ascolta", stop: "Stop" };
  if (base === "pt") return { listen: "Ouvir", stop: "Parar" };
  return { listen: "Escuchar", stop: "Parar" };
}

function ttsLanguage(language?: string) {
  const base = (language ?? "es").split("-")[0].toLowerCase();
  if (base === "en") return "en-US";
  if (base === "de") return "de-DE";
  if (base === "fr") return "fr-FR";
  if (base === "it") return "it-IT";
  if (base === "pt") return "pt-PT";
  return "es-ES";
}

export function ListenButton({ text, language, label, stopLabel, className = "" }: ListenButtonProps) {
  const { speakText, stopTts, isTtsSpeaking } = useTtsReadout();
  const labels = listenLabels(language);
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (!cleanText) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (isTtsSpeaking) {
          stopTts();
          return;
        }
        speakText(cleanText, ttsLanguage(language));
      }}
      className={`vyva-tap inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-vyva-border bg-white px-4 font-body text-[15px] font-bold text-vyva-purple shadow-sm ${className}`}
      aria-label={isTtsSpeaking ? stopLabel ?? labels.stop : label ?? labels.listen}
    >
      {isTtsSpeaking ? <Square size={16} /> : <Volume2 size={18} />}
      {isTtsSpeaking ? stopLabel ?? labels.stop : label ?? labels.listen}
    </button>
  );
}

