import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, HeartPulse, Mic, Stethoscope, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useHeroMessage } from "@/hooks/useHeroMessage";
import { useServiceGate } from "@/hooks/useServiceGate";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import { apiFetch } from "@/lib/queryClient";

const DOCTOR_AGENT_SLUG = "doctor";
const FALLBACK_DOCTOR_USER_ID = "vyva-local-user";
type VoiceDynamicVariables = Record<string, string | number | boolean>;

function createDoctorConversationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fetchDoctorContextVariables(conversationId: string): Promise<VoiceDynamicVariables> {
  const params = new URLSearchParams({ conversation_id: conversationId });
  const res = await apiFetch(`/api/profile/doctor-context?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Doctor context failed: ${res.status}`);
  }

  const data = await res.json() as { dynamicVariables?: VoiceDynamicVariables };
  return data.dynamicVariables ?? {};
}

const DoctorChoiceScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { profile, firstName } = useProfile();
  const { readiness } = useServiceGate();
  const {
    startVoice,
    stopVoice,
    beginUserTurn,
    endUserTurn,
    status,
    isSpeaking,
    isUserSpeaking,
    isConnecting,
    hasMicrophone,
    lastError,
  } = useVyvaVoice();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const userStoppedRef = useRef(false);
  const attemptedStartRef = useRef(false);
  const startListeningWhenReadyRef = useRef(false);
  const autoStartRequested = Boolean((location.state as { autoStartVoice?: boolean } | null)?.autoStartVoice);
  const doctorRecommendations = readiness?.services.doctor.recommended ?? [];

  const heroMessage = useHeroMessage("doctor", {
    fallbackHeadline: t("health.doctorChoice.title", "Elige una opcion"),
    fallbackSourceText: t("health.doctorChoice.kicker", "Ayuda medica"),
    fallbackCtaLabel: t("health.doctorChoice.talkNow", "Hablar ahora"),
    fallbackContextHint: "doctor choice",
    safetyLevel: "medical",
  });

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

  const isVoiceLive =
    status === "connecting" ||
    status === "connected" ||
    isConnecting ||
    isSpeaking ||
    isUserSpeaking;

  const startDoctorVoice = useCallback(async () => {
    userStoppedRef.current = false;
    attemptedStartRef.current = true;
    startListeningWhenReadyRef.current = true;
    setVoiceError(null);
    const conversationId = createDoctorConversationId();
    let doctorContext: VoiceDynamicVariables = {};
    try {
      doctorContext = await fetchDoctorContextVariables(conversationId);
    } catch (error) {
      console.warn("[DoctorChoice] Starting doctor voice without profile context:", error);
      doctorContext = {
        health_context: "The user's health profile could not be loaded before this call.",
      };
    }
    await startVoice(undefined, undefined, {
      agentSlug: DOCTOR_AGENT_SLUG,
      dynamicVariables: {
        ...doctorContext,
        first_name: firstName?.trim() || profile?.firstName?.trim() || "there",
        user_id: user?.id ?? FALLBACK_DOCTOR_USER_ID,
        conversation_id: conversationId,
        language: i18n.language?.slice(0, 2) || "en",
      },
    });
  }, [firstName, i18n.language, profile?.firstName, startVoice, user?.id]);

  const stopDoctorVoice = useCallback(() => {
    userStoppedRef.current = true;
    startListeningWhenReadyRef.current = false;
    endUserTurn();
    stopVoice();
    setVoiceError(null);
  }, [endUserTurn, stopVoice]);

  const handleHeroVoiceAction = useCallback(() => {
    if (isVoiceLive) {
      stopDoctorVoice();
      return;
    }
    void startDoctorVoice();
  }, [isVoiceLive, startDoctorVoice, stopDoctorVoice]);

  useEffect(() => {
    if (!lastError) return;
    const normalizedError = lastError.toLowerCase();
    const friendlyMessage = normalizedError.includes("missing elevenlabs api key")
      ? t(
          "health.doctorChoice.voiceSetupError",
          "La voz del medico no esta configurada todavia en este entorno.",
        )
      : normalizedError.includes("no elevenlabs agent configured")
        ? t(
            "health.doctorChoice.voiceAgentMissing",
            "El agente del medico no esta configurado todavia.",
          )
        : normalizedError.includes("voice session closed")
          ? t(
              "health.doctorChoice.voiceClosedDebug",
              "La sesion de voz se cerro: {{reason}}",
              { reason: lastError },
            )
        : t(
            "health.doctorChoice.voiceError",
            "La voz no se ha podido iniciar. Puede tocar una opcion.",
          );
    setVoiceError(
      friendlyMessage,
    );
  }, [lastError, t]);

  useEffect(() => {
    if (!attemptedStartRef.current || userStoppedRef.current || lastError) return;
    if (status === "idle" && !isConnecting && !isSpeaking && !isUserSpeaking) {
      setVoiceError(
        t(
          "health.doctorChoice.voiceDropped",
          "La conversacion se ha cortado. Toca otra vez para seguir.",
        ),
      );
    }
  }, [isConnecting, isSpeaking, isUserSpeaking, lastError, status, t]);

  useEffect(() => {
    if (!autoStartRequested || attemptedStartRef.current || isVoiceLive) return;
    void startDoctorVoice();
  }, [autoStartRequested, isVoiceLive, startDoctorVoice]);

  useEffect(() => {
    if (status !== "connected" || !startListeningWhenReadyRef.current || !hasMicrophone) return;
    startListeningWhenReadyRef.current = false;
    void beginUserTurn();
  }, [beginUserTurn, hasMicrophone, status]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  const handleDirect = () => {
    if (isVoiceLive) return;
    void startDoctorVoice();
  };

  const handleTriage = () => {
    stopDoctorVoice();
    navigate("/health/symptom-check");
  };

  const heroVoiceLabel = isVoiceLive
    ? t("health.doctorChoice.stopCall", stopCallFallback)
    : heroMessage?.ctaLabel ?? t("health.doctorChoice.talkNow", "Hablar ahora");

  return (
    <div className="vyva-page pb-[120px]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            stopDoctorVoice();
            navigate("/health");
          }}
          className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#FFFDF9] px-5 py-3 font-body text-[16px] font-bold text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={20} />
          {t("common.back", "Atras")}
        </button>

        <button
          type="button"
          onClick={() => {
            stopDoctorVoice();
            navigate("/health");
          }}
          className="vyva-tap inline-flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple shadow-sm"
          aria-label={t("common.close", "Cerrar")}
        >
          <X size={21} />
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
            isVoiceLive
              ? "border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412]"
              : "border-vyva-border bg-white text-vyva-purple"
          }`}
        >
          {isVoiceLive ? <X size={24} /> : <Mic size={24} />}
          {heroVoiceLabel}
        </button>
      </section>

      {voiceError ? (
        <div className="mt-4 rounded-[24px] border border-[#FDBA74] bg-[#FFF7ED] px-5 py-4 font-body text-[16px] font-semibold text-[#9A3412]">
          {voiceError}
        </div>
      ) : null}

      {doctorRecommendations.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            const firstRecommendation = doctorRecommendations[0];
            navigate(`${firstRecommendation.path}?returnTo=${encodeURIComponent("/health/doctor")}`);
          }}
          className="mt-4 w-full rounded-[24px] border border-vyva-border bg-white px-5 py-4 text-left shadow-sm"
        >
          <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.12em] text-vyva-purple">
            {t("health.doctorChoice.contextTipTitle", "Optional profile tip")}
          </p>
          <p className="mt-1 font-body text-[15px] font-semibold text-vyva-text-1">
            {doctorRecommendations[0].reason}
          </p>
        </button>
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
