import { useEffect } from "react";
import { ArrowLeft, ChevronRight, HeartPulse, Stethoscope, Volume2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useTtsReadout } from "@/hooks/useVyvaVoice";

const voiceLang = (language: string) => {
  if (language.startsWith("en")) return "en-US";
  if (language.startsWith("de")) return "de-DE";
  return "es-ES";
};

const DoctorChoiceScreen = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { speakText, stopTts, isTtsSpeaking } = useTtsReadout();

  const promptText = t(
    "health.doctorChoice.voicePrompt",
    "Puedes elegir hablar con un médico ahora, o hacer primero un triaje breve para orientar mejor la consulta."
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      speakText(promptText, voiceLang(i18n.language));
    }, 450);

    return () => {
      window.clearTimeout(timer);
      stopTts();
    };
  }, [i18n.language, promptText, speakText, stopTts]);

  return (
    <div className="vyva-page pb-[120px]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/health")}
          className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#FFFDF9] px-5 py-3 font-body text-[16px] font-bold text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={20} />
          {t("common.back", "Atrás")}
        </button>

        <button
          type="button"
          onClick={() => isTtsSpeaking ? stopTts() : speakText(promptText, voiceLang(i18n.language))}
          className="vyva-tap inline-flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple shadow-sm"
          aria-label={isTtsSpeaking ? t("common.stop", "Parar") : t("common.listen", "Escuchar")}
        >
          {isTtsSpeaking ? <X size={21} /> : <Volume2 size={22} />}
        </button>
      </div>

      <section className="rounded-[32px] border border-vyva-border bg-[#FFFCF8] p-6 shadow-vyva-card">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[24px] bg-[#F0FDF4]">
            <Stethoscope size={34} className="text-[#0A7C4E]" />
          </div>
          <div className="min-w-0">
            <p className="font-body text-[14px] font-extrabold uppercase tracking-[0.14em] text-vyva-purple">
              {t("health.doctorChoice.kicker", "Ayuda médica")}
            </p>
            <h1 className="mt-1 font-display text-[38px] leading-[1.05] text-vyva-text-1">
              {t("health.doctorChoice.title", "Elige una opción")}
            </h1>
          </div>
        </div>
      </section>

      <div className="mt-5 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate("/health?doctor=1")}
          className="vyva-tap flex min-h-[120px] items-center gap-4 rounded-[28px] border border-[#BBF7D0] bg-[#F0FDF4] p-5 text-left shadow-vyva-card"
        >
          <span className="flex h-[62px] w-[62px] flex-shrink-0 items-center justify-center rounded-[20px] bg-white">
            <Stethoscope size={30} className="text-[#0A7C4E]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[22px] font-extrabold leading-tight text-vyva-text-1">
              {t("health.doctorChoice.directTitle", "Hablar con un médico")}
            </span>
            <span className="mt-2 block font-body text-[17px] leading-snug text-vyva-text-2">
              {t("health.doctorChoice.directSubtitle", "Llamada o videollamada")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-[#0A7C4E]" />
        </button>

        <button
          type="button"
          onClick={() => navigate("/health/symptom-check")}
          className="vyva-tap flex min-h-[120px] items-center gap-4 rounded-[28px] border border-vyva-border bg-[#FFFFFF] p-5 text-left shadow-vyva-card"
        >
          <span className="flex h-[62px] w-[62px] flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF]">
            <HeartPulse size={30} className="text-vyva-purple" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[22px] font-extrabold leading-tight text-vyva-text-1">
              {t("health.doctorChoice.triageTitle", "Hacer triaje primero")}
            </span>
            <span className="mt-2 block font-body text-[17px] leading-snug text-vyva-text-2">
              {t("health.doctorChoice.triageSubtitle", "Preguntas rápidas")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-vyva-purple" />
        </button>
      </div>
    </div>
  );
};

export default DoctorChoiceScreen;
