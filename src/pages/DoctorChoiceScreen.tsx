import { ArrowLeft, ChevronRight, HeartPulse, Stethoscope } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const DoctorChoiceScreen = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="vyva-page pb-[120px]">
      <button
        type="button"
        onClick={() => navigate("/health")}
        className="vyva-tap mb-5 inline-flex items-center gap-2 rounded-full bg-[#FFFDF9] px-5 py-3 font-body text-[16px] font-bold text-vyva-text-1 shadow-sm"
      >
        <ArrowLeft size={20} />
        {t("common.back", "Atrás")}
      </button>

      <section className="rounded-[32px] border border-vyva-border bg-[#FFFCF8] p-6 shadow-vyva-card">
        <div className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[24px] bg-[#F0FDF4]">
          <Stethoscope size={36} className="text-[#0A7C4E]" />
        </div>

        <p className="mb-2 font-body text-[14px] font-extrabold uppercase tracking-[0.14em] text-vyva-purple">
          {t("health.doctorChoice.kicker", "Ayuda médica")}
        </p>
        <h1 className="font-display text-[42px] leading-[1.04] text-vyva-text-1">
          {t("health.doctorChoice.title", "¿Cómo quieres empezar?")}
        </h1>
        <p className="mt-4 font-body text-[20px] leading-snug text-vyva-text-2">
          {t(
            "health.doctorChoice.subtitle",
            "Puedes contactar directamente o responder unas preguntas primero para orientar mejor la consulta."
          )}
        </p>
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
              {t("health.doctorChoice.directSubtitle", "Ir a las opciones de llamada o videollamada.")}
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
              {t("health.doctorChoice.triageSubtitle", "Responder unas preguntas para saber qué conviene hacer.")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-vyva-purple" />
        </button>
      </div>
    </div>
  );
};

export default DoctorChoiceScreen;
