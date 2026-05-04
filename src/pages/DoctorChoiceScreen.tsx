import { useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowLeft, ChevronRight, HeartPulse, Mic, Stethoscope, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useHeroMessage } from "@/hooks/useHeroMessage";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

const DOCTOR_AGENT_ID = "agent_9201knfm6ep0fpp958kdyt0hev1b";

const DoctorChoiceScreen = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const hasIntroducedRef = useRef(false);
  const {
    startVoice,
    stopVoice,
    sendText,
    status,
    isConnecting,
    isSpeaking,
    hasMicrophone,
    lastError,
  } = useVyvaVoice();
  const heroMessage = useHeroMessage("doctor", {
    fallbackHeadline: t("health.doctorChoice.title", "Elige una opcion"),
    fallbackSourceText: t("health.doctorChoice.kicker", "Ayuda medica"),
    fallbackCtaLabel: t("health.doctorChoice.talkNow", "Hablar ahora"),
    fallbackContextHint: "doctor choice",
    safetyLevel: "medical",
  });

  const promptText = t(
    "health.doctorChoice.voicePrompt",
    "Presenta estas dos opciones de forma breve y amable: hablar con un medico ahora, o hacer primero un triaje rapido. No des consejos medicos. Pide al usuario que toque una opcion en la pantalla."
  );
  const stopCallFallback = useMemo(() => {
    const language = i18n.language?.slice(0, 2);
    switch (language) {
      case "en":
        return "Stop call";
      case "de":
        return "Anruf beenden";
      case "fr":
        return "Terminer l'appel";
      case "it":
        return "Termina chiamata";
      case "pt":
        return "Terminar chamada";
      case "es":
      default:
        return "Terminar llamada";
    }
  }, [i18n.language]);

  const startDoctorAgent = useCallback(
    (withMicrophone = false) => {
      hasIntroducedRef.current = false;
      startVoice("doctor choice", undefined, {
        agentId: DOCTOR_AGENT_ID,
        skipMicrophone: !withMicrophone,
        autoStartListening: withMicrophone,
      }).catch(() => {});
    },
    [startVoice],
  );

  useEffect(() => {
    startDoctorAgent(false);
    return () => stopVoice();
  }, [startDoctorAgent, stopVoice]);

  useEffect(() => {
    if (status !== "connected" || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    window.setTimeout(() => {
      sendText(promptText, { invisibleInTranscript: true });
    }, 250);
  }, [promptText, sendText, status]);

  const handleDirect = () => {
    stopVoice();
    navigate("/health?doctor=1");
  };

  const handleTriage = () => {
    stopVoice();
    navigate("/health/symptom-check");
  };

  const handleVoiceToggle = () => {
    if (status === "idle") {
      startDoctorAgent(false);
    } else {
      stopVoice();
    }
  };

  const handleStartMicrophone = () => {
    stopVoice();
    window.setTimeout(() => {
      startDoctorAgent(true);
    }, 150);
  };

  const isVoiceLive = isConnecting || isSpeaking || status === "connected";
  const shouldStopCallFromHero = isConnecting || isSpeaking || (status === "connected" && hasMicrophone);
  const heroVoiceLabel = shouldStopCallFromHero
    ? t("health.doctorChoice.stopCall", stopCallFallback)
    : heroMessage?.ctaLabel ?? t("health.doctorChoice.talkNow", "Hablar ahora");
  const handleHeroVoiceAction = () => {
    if (shouldStopCallFromHero) {
      stopVoice();
      return;
    }
    handleStartMicrophone();
  };

  return (
    <div className="vyva-page pb-[120px]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            stopVoice();
            navigate("/health");
          }}
          className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#FFFDF9] px-5 py-3 font-body text-[16px] font-bold text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={20} />
          {t("common.back", "Atras")}
        </button>

        <button
          type="button"
          onClick={handleVoiceToggle}
          className="vyva-tap inline-flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple shadow-sm"
          aria-label={status === "idle" ? t("common.start", "Iniciar") : t("common.stop", "Parar")}
        >
          {status === "idle" ? <Mic size={22} /> : <X size={21} />}
        </button>
      </div>

      <section className="rounded-[32px] border border-vyva-border bg-[#FFFCF8] p-6 shadow-vyva-card">
        <div className="flex items-start gap-4">
          <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[24px] bg-[#F0FDF4]">
            <Stethoscope size={34} className="text-[#0A7C4E]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-body text-[14px] font-extrabold uppercase tracking-[0.14em] text-vyva-purple">
                {heroMessage?.sourceText ?? t("health.doctorChoice.kicker", "Ayuda medica")}
              </p>
              {isVoiceLive ? (
                <span className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[13px] font-extrabold text-[#0A7C4E]">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  {t("common.live", "En vivo")}
                </span>
              ) : null}
            </div>
            <h1
              className="mt-1 min-w-0 break-words font-display text-[38px] leading-[1.05] text-vyva-text-1"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {heroMessage?.headline ?? t("health.doctorChoice.title", "Elige una opcion")}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleHeroVoiceAction}
          aria-label={heroVoiceLabel}
          className={`vyva-tap mt-6 inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-full border px-5 font-body text-[20px] font-extrabold shadow-sm transition ${
            shouldStopCallFromHero
              ? "border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412]"
              : "border-vyva-border bg-white text-vyva-purple"
          }`}
        >
          {shouldStopCallFromHero ? <X size={24} /> : <Mic size={24} />}
          {heroVoiceLabel}
        </button>
      </section>

      {lastError ? (
        <div className="mt-4 rounded-[24px] border border-[#FDBA74] bg-[#FFF7ED] px-5 py-4 font-body text-[16px] font-semibold text-[#9A3412]">
          {t("health.doctorChoice.voiceError", "La voz no se ha podido iniciar. Puede tocar una opcion.")}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        <button
          type="button"
          onClick={handleDirect}
          className="vyva-tap flex min-h-[120px] items-center gap-4 rounded-[28px] border border-[#BBF7D0] bg-[#F0FDF4] p-5 text-left shadow-vyva-card"
        >
          <span className="flex h-[62px] w-[62px] flex-shrink-0 items-center justify-center rounded-[20px] bg-white">
            <Stethoscope size={30} className="text-[#0A7C4E]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[22px] font-extrabold leading-tight text-vyva-text-1">
              {t("health.doctorChoice.directTitle", "Hablar con un medico")}
            </span>
            <span className="mt-2 block font-body text-[17px] leading-snug text-vyva-text-2">
              {t("health.doctorChoice.directSubtitle", "Llamada o videollamada")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-[#0A7C4E]" />
        </button>

        <button
          type="button"
          onClick={handleTriage}
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
              {t("health.doctorChoice.triageSubtitle", "Preguntas rapidas")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-vyva-purple" />
        </button>
      </div>
    </div>
  );
};

export default DoctorChoiceScreen;
