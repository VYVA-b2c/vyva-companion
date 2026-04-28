import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Battery,
  BedDouble,
  Check,
  Heart,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/contexts/ProfileContext";
import { apiFetch } from "@/lib/queryClient";

type StepId = "welcome" | "energy" | "mood" | "body" | "sleep" | "symptoms" | "social" | "analyzing" | "result";

type Answers = {
  energy_level: number | null;
  mood: string | null;
  body_areas: string[];
  sleep_quality: string | null;
  symptoms: string[];
  social_contact: string | null;
};

type CheckinResult = {
  feeling_label: string;
  overall_state: "excellent" | "good" | "moderate" | "tired" | "low";
  vyva_reading: string;
  right_now: string[];
  today_actions: string[];
  highlight: string;
  flag_caregiver: boolean;
  watch_for: string | null;
};

type SingleOption = {
  id: string;
  label: string;
  helper?: string;
  value?: number;
};

const STEPS: StepId[] = ["welcome", "energy", "mood", "body", "sleep", "symptoms", "social", "analyzing", "result"];
const QUESTION_STEPS: StepId[] = ["energy", "mood", "body", "sleep", "symptoms", "social"];

const initialAnswers: Answers = {
  energy_level: null,
  mood: null,
  body_areas: [],
  sleep_quality: null,
  symptoms: [],
  social_contact: null,
};

const energyOptions: SingleOption[] = [
  { id: "1", value: 1, label: "Sin energía", helper: "Me cuesta empezar el día" },
  { id: "2", value: 2, label: "Algo cansada", helper: "Voy más lenta de lo normal" },
  { id: "3", value: 3, label: "Normal", helper: "Como un día corriente" },
  { id: "4", value: 4, label: "Bastante bien", helper: "Tengo ganas de hacer cosas" },
  { id: "5", value: 5, label: "Con mucha energía", helper: "Me siento activa y despierta" },
];

const moodOptions: SingleOption[] = [
  { id: "alegre", label: "Alegre", helper: "Con buen ánimo" },
  { id: "tranquila", label: "Tranquila", helper: "Serena y estable" },
  { id: "triste", label: "Triste", helper: "Un poco apagada" },
  { id: "ansiosa", label: "Inquieta", helper: "Con preocupación o nervios" },
  { id: "irritable", label: "Irritable", helper: "Con poca paciencia" },
];

const bodyOptions: SingleOption[] = [
  { id: "cabeza", label: "Cabeza" },
  { id: "pecho", label: "Pecho" },
  { id: "estomago", label: "Estómago" },
  { id: "espalda", label: "Espalda" },
  { id: "articulaciones", label: "Articulaciones" },
  { id: "piernas", label: "Piernas" },
  { id: "ninguno", label: "Nada especial" },
];

const sleepOptions: SingleOption[] = [
  { id: "muy_bien", label: "Muy bien", helper: "Dormí seguido y descansé" },
  { id: "bien", label: "Bien", helper: "Dormí lo suficiente" },
  { id: "regular", label: "Regular", helper: "Me desperté varias veces" },
  { id: "mal", label: "Mal", helper: "Dormí poco" },
  { id: "muy_mal", label: "Muy mal", helper: "Casi no descansé" },
];

const symptomOptions: SingleOption[] = [
  { id: "dolor_cabeza", label: "Dolor de cabeza" },
  { id: "mareo", label: "Mareo" },
  { id: "nauseas", label: "Náuseas" },
  { id: "fiebre", label: "Sensación de fiebre" },
  { id: "falta_aire", label: "Me falta el aire" },
  { id: "confusion", label: "Me siento confundida" },
  { id: "ninguno", label: "Ninguno de estos" },
];

const socialOptions: SingleOption[] = [
  { id: "mucho", label: "Sí, bastante", helper: "He hablado o estaré con gente" },
  { id: "algo", label: "Un poco", helper: "Algún mensaje o llamada" },
  { id: "no", label: "No mucho", helper: "Hoy estoy más sola" },
];

function progressFor(step: StepId) {
  const index = QUESTION_STEPS.indexOf(step);
  return index === -1 ? 0 : ((index + 1) / QUESTION_STEPS.length) * 100;
}

function localResult(name: string, answers: Answers): CheckinResult {
  const lowEnergy = (answers.energy_level ?? 3) <= 2;
  const lowMood = answers.mood === "triste" || answers.mood === "ansiosa";
  const poorSleep = answers.sleep_quality === "mal" || answers.sleep_quality === "muy_mal";

  return {
    feeling_label: lowEnergy || poorSleep ? "Un día más suave" : "Un día estable",
    overall_state: lowEnergy || lowMood || poorSleep ? "moderate" : "good",
    vyva_reading: `${name || "Cariño"}, gracias por contármelo. Hoy parece un día para cuidarte sin exigirte demasiado.`,
    right_now: [
      "Bebe un vaso de agua despacio.",
      "Siéntate cómoda y respira con calma durante un minuto.",
      "Elige una tarea pequeña y agradable para empezar.",
    ],
    today_actions: [
      "Haz una pausa tranquila después de comer.",
      "Busca un momento de luz natural o aire fresco.",
      "Habla con alguien cercano si te apetece compañía.",
    ],
    highlight: "Tu cuerpo agradece un ritmo amable hoy.",
    flag_caregiver: lowEnergy && lowMood,
    watch_for: null,
  };
}

const CheckHowIFeelScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { firstName, profile } = useProfile();
  const startedAtRef = useRef(Date.now());
  const [step, setStep] = useState<StepId>("welcome");
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [result, setResult] = useState<CheckinResult | null>(null);

  const name = firstName || "Carlos";
  const stepIndex = STEPS.indexOf(step);
  const canGoBack = stepIndex > 0 && step !== "analyzing" && step !== "result";

  const loadingMessage = useMemo(() => {
    const messages = [
      "Leyendo tus respuestas con calma...",
      "Revisando tu contexto personal...",
      "Preparando ideas útiles para hoy...",
    ];
    return messages[Math.min(Math.floor((Date.now() - startedAtRef.current) / 1800), messages.length - 1)];
  }, [step]);

  const goBack = () => {
    if (canGoBack) {
      setStep(STEPS[stepIndex - 1]);
      return;
    }
    navigate("/health");
  };

  const abandonAndExit = async () => {
    try {
      await apiFetch("/api/checkins/abandon", {
        method: "POST",
        body: JSON.stringify({
          language: profile?.language ?? "es",
          duration_seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
        }),
      });
    } catch {
      // Exiting should stay gentle even if persistence is unavailable.
    }
    navigate("/health");
  };

  const setSingle = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const toggleMulti = (key: "body_areas" | "symptoms", id: string) => {
    setAnswers((current) => {
      const currentValues = current[key];
      if (id === "ninguno") {
        return { ...current, [key]: currentValues.includes("ninguno") ? [] : ["ninguno"] };
      }
      const withoutNone = currentValues.filter((value) => value !== "ninguno");
      return {
        ...current,
        [key]: withoutNone.includes(id)
          ? withoutNone.filter((value) => value !== id)
          : [...withoutNone, id],
      };
    });
  };

  const analyze = async () => {
    if (!answers.energy_level || !answers.mood || !answers.sleep_quality || !answers.social_contact) return;

    setStep("analyzing");
    try {
      const res = await apiFetch("/api/checkins/analyze", {
        method: "POST",
        body: JSON.stringify({
          language: profile?.language ?? "es",
          duration_seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
          answers,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { result: CheckinResult };
      setResult(data.result);
    } catch (err) {
      console.warn("[check-in] falling back locally", err);
      setResult(localResult(name, answers));
      toast({ description: "He preparado una lectura local porque la conexión no respondió a tiempo." });
    } finally {
      setStep("result");
    }
  };

  const reset = () => {
    startedAtRef.current = Date.now();
    setAnswers(initialAnswers);
    setResult(null);
    setStep("welcome");
  };

  return (
    <div className="vyva-page">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={goBack}
          className="vyva-tap flex min-h-[52px] items-center gap-2 rounded-full bg-white px-4 font-body text-[16px] font-semibold text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={19} />
          Atrás
        </button>
        {QUESTION_STEPS.includes(step) && (
          <span className="rounded-full bg-vyva-purple-light px-4 py-2 font-body text-[14px] font-bold text-vyva-purple">
            {QUESTION_STEPS.indexOf(step) + 1} de {QUESTION_STEPS.length}
          </span>
        )}
      </div>

      {QUESTION_STEPS.includes(step) && (
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-gradient-to-r from-vyva-purple to-[#8B5CF6] transition-all duration-300"
            style={{ width: `${progressFor(step)}%` }}
          />
        </div>
      )}

      {step === "welcome" && (
        <section className="rounded-[32px] border border-vyva-border bg-white p-6 shadow-[0_10px_28px_rgba(63,45,35,0.08)]">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-vyva-purple-light">
            <Heart size={34} className="text-vyva-purple" />
          </div>
          <p className="mb-2 font-body text-[18px] font-semibold text-vyva-text-2">Hola, {name}</p>
          <h1 className="mb-4 font-display text-[34px] leading-tight text-vyva-text-1">
            Revisemos cómo te sientes hoy.
          </h1>
          <p className="mb-5 font-body text-[21px] leading-relaxed text-vyva-text-2">
            Son seis preguntas sencillas. Al final te daré una lectura cálida y pasos útiles para hoy.
          </p>
          <div className="mb-6 grid gap-3">
            {[
              { Icon: ShieldCheck, text: "Tus respuestas son privadas." },
              { Icon: Sparkles, text: "La lectura se adapta a tu perfil." },
              { Icon: Sun, text: "No es un diagnóstico, es una guía de bienestar." },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex min-h-[70px] items-center gap-3 rounded-[22px] bg-[#FAF9F6] px-4">
                <Icon size={25} className="text-vyva-purple" />
                <span className="font-body text-[18px] text-vyva-text-1">{text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setStep("energy")}
            className="vyva-primary-action min-h-[74px] w-full text-[21px]"
            data-testid="button-checkin-start"
          >
            Empezar ahora
          </button>
          <button
            onClick={abandonAndExit}
            className="vyva-tap mt-3 min-h-[60px] w-full rounded-full font-body text-[18px] font-semibold text-vyva-text-2"
          >
            Ahora no
          </button>
        </section>
      )}

      {step === "energy" && (
        <QuestionCard icon={<Battery />} title="¿Cuánta energía tienes hoy?" subtitle="Elige la frase que más se parece a tu mañana.">
          <OptionList
            options={energyOptions}
            selected={answers.energy_level?.toString()}
            onSelect={(option) => setSingle("energy_level", option.value ?? 3)}
          />
          <NextButton disabled={!answers.energy_level} onClick={() => setStep("mood")} />
        </QuestionCard>
      )}

      {step === "mood" && (
        <QuestionCard icon={<Heart />} title="¿Cómo está tu ánimo?" subtitle="No hay respuesta buena o mala. Solo queremos escucharte.">
          <OptionList
            options={moodOptions}
            selected={answers.mood ?? undefined}
            onSelect={(option) => setSingle("mood", option.id)}
          />
          <NextButton disabled={!answers.mood} onClick={() => setStep("body")} />
        </QuestionCard>
      )}

      {step === "body" && (
        <QuestionCard icon={<UserRound />} title="¿Notas algo en el cuerpo?" subtitle="Puedes marcar más de una opción.">
          <OptionList
            options={bodyOptions}
            selectedValues={answers.body_areas}
            onSelect={(option) => toggleMulti("body_areas", option.id)}
            multi
          />
          <NextButton disabled={answers.body_areas.length === 0} onClick={() => setStep("sleep")} />
        </QuestionCard>
      )}

      {step === "sleep" && (
        <QuestionCard icon={<BedDouble />} title="¿Cómo dormiste?" subtitle="El descanso cambia mucho cómo se siente el día.">
          <OptionList
            options={sleepOptions}
            selected={answers.sleep_quality ?? undefined}
            onSelect={(option) => setSingle("sleep_quality", option.id)}
          />
          <NextButton disabled={!answers.sleep_quality} onClick={() => setStep("symptoms")} />
        </QuestionCard>
      )}

      {step === "symptoms" && (
        <QuestionCard icon={<Sparkles />} title="¿Hay algo que quieras mencionar?" subtitle="Marca lo que notes hoy, aunque sea suave.">
          <OptionList
            options={symptomOptions}
            selectedValues={answers.symptoms}
            onSelect={(option) => toggleMulti("symptoms", option.id)}
            multi
          />
          <NextButton disabled={answers.symptoms.length === 0} onClick={() => setStep("social")} />
        </QuestionCard>
      )}

      {step === "social" && (
        <QuestionCard icon={<MessageCircle />} title="¿Has tenido contacto con alguien hoy?" subtitle="La compañía también cuenta para el bienestar.">
          <OptionList
            options={socialOptions}
            selected={answers.social_contact ?? undefined}
            onSelect={(option) => setSingle("social_contact", option.id)}
          />
          <button
            onClick={analyze}
            disabled={!answers.social_contact}
            className="vyva-primary-action mt-4 min-h-[74px] w-full text-[21px] disabled:bg-vyva-text-3"
          >
            Ver mi lectura
          </button>
        </QuestionCard>
      )}

      {step === "analyzing" && (
        <section className="flex min-h-[520px] flex-col items-center justify-center rounded-[32px] border border-vyva-border bg-white p-8 text-center">
          <Loader2 size={54} className="mb-5 animate-spin text-vyva-purple" />
          <h1 className="mb-3 font-display text-[32px] text-vyva-text-1">Un momento, {name}</h1>
          <p className="font-body text-[21px] leading-relaxed text-vyva-text-2">{loadingMessage}</p>
        </section>
      )}

      {step === "result" && result && (
        <section className="rounded-[32px] border border-vyva-border bg-white p-6 shadow-[0_10px_28px_rgba(63,45,35,0.08)]">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#FFFBEB]">
            <Sparkles size={34} className="text-[#B45309]" />
          </div>
          <p className="mb-2 font-body text-[16px] font-bold uppercase tracking-[0.16em] text-vyva-purple">
            Tu lectura de hoy
          </p>
          <h1 className="mb-4 font-display text-[34px] leading-tight text-vyva-text-1">{result.feeling_label}</h1>
          <p className="mb-5 font-body text-[21px] leading-relaxed text-vyva-text-2">{result.vyva_reading}</p>
          <div className="mb-5 rounded-[24px] bg-vyva-purple-light p-5">
            <p className="mb-1 font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-purple">Lo importante</p>
            <p className="font-body text-[20px] font-semibold text-vyva-text-1">{result.highlight}</p>
          </div>
          <ResultList title="Ahora mismo" items={result.right_now} />
          <ResultList title="Para hoy" items={result.today_actions} />
          {result.watch_for && (
            <div className="mt-4 rounded-[24px] border border-[#F59E0B]/30 bg-[#FFFBEB] p-5">
              <p className="font-body text-[18px] leading-relaxed text-[#78350F]">{result.watch_for}</p>
            </div>
          )}
          <p className="mt-6 font-body text-[21px] leading-relaxed text-vyva-text-1">
            Gracias por hacerlo. Este pequeño hábito ayuda a VYVA a cuidarte mejor cada día.
          </p>
          <div className="mt-6 grid gap-3">
            <button onClick={() => navigate("/health")} className="vyva-primary-action min-h-[72px] w-full text-[20px]">
              Gracias, VYVA
            </button>
            <button onClick={reset} className="vyva-secondary-action min-h-[68px] w-full text-[19px]">
              Repetir check-in
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

function QuestionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-vyva-border bg-white p-5 shadow-[0_10px_28px_rgba(63,45,35,0.08)]">
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-[22px] bg-vyva-purple-light text-vyva-purple">
        {icon}
      </div>
      <h1 className="mb-2 font-display text-[32px] leading-tight text-vyva-text-1">{title}</h1>
      <p className="mb-5 font-body text-[20px] leading-relaxed text-vyva-text-2">{subtitle}</p>
      {children}
    </section>
  );
}

function OptionList({
  options,
  selected,
  selectedValues,
  onSelect,
  multi = false,
}: {
  options: SingleOption[];
  selected?: string;
  selectedValues?: string[];
  onSelect: (option: SingleOption) => void;
  multi?: boolean;
}) {
  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const isSelected = multi ? selectedValues?.includes(option.id) : selected === option.id;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option)}
            className={`vyva-tap flex min-h-[74px] items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-left transition-all ${
              isSelected ? "border-vyva-purple bg-vyva-purple text-white" : "border-vyva-border bg-[#FAF9F6] text-vyva-text-1"
            }`}
          >
            <span>
              <span className="block font-body text-[21px] font-bold leading-tight">{option.label}</span>
              {option.helper && (
                <span className={`mt-1 block font-body text-[16px] leading-snug ${isSelected ? "text-white/85" : "text-vyva-text-2"}`}>
                  {option.helper}
                </span>
              )}
            </span>
            <span
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                isSelected ? "bg-[#F59E0B]" : "border-2 border-vyva-border bg-white"
              }`}
            >
              {isSelected && <Check size={19} className="text-white" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NextButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="vyva-primary-action mt-4 min-h-[72px] w-full text-[20px] disabled:bg-vyva-text-3"
    >
      Siguiente
    </button>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 rounded-[24px] border border-vyva-border bg-[#FAF9F6] p-5">
      <p className="mb-3 font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-text-2">{title}</p>
      <div className="grid gap-3">
        {items.slice(0, 3).map((item) => (
          <div key={item} className="flex gap-3">
            <span className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple text-[14px] font-bold text-white">
              <Check size={16} />
            </span>
            <p className="font-body text-[19px] leading-relaxed text-vyva-text-1">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CheckHowIFeelScreen;
