import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Battery,
  BedDouble,
  Check,
  ClipboardList,
  Compass,
  Heart,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Share2,
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

type AppAction = {
  key: "concierge" | "symptom" | "vitals" | "care";
  title: string;
  description: string;
  to: string;
  primary?: boolean;
};

type SingleOption = {
  id: string;
  label: string;
  helper?: string;
  value?: number;
  icon?: string;
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
  { id: "1", value: 1, icon: "🌙", label: "Sin energía", helper: "Me cuesta empezar el día" },
  { id: "2", value: 2, icon: "☁️", label: "Algo cansada", helper: "Voy más lenta de lo normal" },
  { id: "3", value: 3, icon: "🌤️", label: "Normal", helper: "Como un día corriente" },
  { id: "4", value: 4, icon: "☀️", label: "Bastante bien", helper: "Tengo ganas de hacer cosas" },
  { id: "5", value: 5, icon: "✨", label: "Con mucha energía", helper: "Me siento activa y despierta" },
];

const moodOptions: SingleOption[] = [
  { id: "alegre", icon: "😊", label: "Alegre", helper: "Con buen ánimo" },
  { id: "tranquila", icon: "🌿", label: "Tranquila", helper: "Serena y estable" },
  { id: "triste", icon: "💧", label: "Triste", helper: "Un poco apagada" },
  { id: "ansiosa", icon: "🌀", label: "Inquieta", helper: "Con preocupación o nervios" },
  { id: "irritable", icon: "⚡", label: "Irritable", helper: "Con poca paciencia" },
];

const bodyOptions: SingleOption[] = [
  { id: "cabeza", icon: "🧠", label: "Cabeza" },
  { id: "pecho", icon: "💛", label: "Pecho" },
  { id: "estomago", icon: "🍵", label: "Estómago" },
  { id: "espalda", icon: "🪑", label: "Espalda" },
  { id: "articulaciones", icon: "🦴", label: "Articulaciones" },
  { id: "piernas", icon: "🦵", label: "Piernas" },
  { id: "ninguno", icon: "👌", label: "Nada especial" },
];

const sleepOptions: SingleOption[] = [
  { id: "muy_bien", icon: "🌅", label: "Muy bien", helper: "Dormí seguido y descansé" },
  { id: "bien", icon: "🌙", label: "Bien", helper: "Dormí lo suficiente" },
  { id: "regular", icon: "☕", label: "Regular", helper: "Me desperté varias veces" },
  { id: "mal", icon: "🌧️", label: "Mal", helper: "Dormí poco" },
  { id: "muy_mal", icon: "🛌", label: "Muy mal", helper: "Casi no descansé" },
];

const symptomOptions: SingleOption[] = [
  { id: "dolor_cabeza", icon: "🤕", label: "Dolor de cabeza" },
  { id: "mareo", icon: "🌀", label: "Mareo" },
  { id: "nauseas", icon: "🍵", label: "Náuseas" },
  { id: "fiebre", icon: "🌡️", label: "Sensación de fiebre" },
  { id: "falta_aire", icon: "🫁", label: "Me falta el aire" },
  { id: "confusion", icon: "❔", label: "Me siento confundida" },
  { id: "ninguno", icon: "👌", label: "Ninguno de estos" },
];

const socialOptions: SingleOption[] = [
  { id: "mucho", icon: "🤝", label: "Sí, bastante", helper: "He hablado o estaré con gente" },
  { id: "algo", icon: "💬", label: "Un poco", helper: "Algún mensaje o llamada" },
  { id: "no", icon: "🕯️", label: "No mucho", helper: "Hoy estoy más sola" },
];

function progressFor(step: StepId) {
  const index = QUESTION_STEPS.indexOf(step);
  return index === -1 ? 0 : ((index + 1) / QUESTION_STEPS.length) * 100;
}

function localResult(name: string, answers: Answers): CheckinResult {
  const energy = answers.energy_level ?? 3;
  const lowEnergy = energy <= 2;
  const strongEnergy = energy >= 4;
  const lowMood = answers.mood === "triste" || answers.mood === "ansiosa";
  const unsettledMood = answers.mood === "ansiosa" || answers.mood === "irritable";
  const poorSleep = answers.sleep_quality === "mal" || answers.sleep_quality === "muy_mal";
  const lightSleep = answers.sleep_quality === "regular";
  const goodSleep = answers.sleep_quality === "bien" || answers.sleep_quality === "muy_bien";
  const noBodyNotes = answers.body_areas.includes("ninguno") || answers.body_areas.length === 0;
  const noSymptoms = answers.symptoms.includes("ninguno") || answers.symptoms.length === 0;
  const has = (id: string) => answers.symptoms.includes(id) || answers.body_areas.includes(id);
  const safetySignal = has("falta_aire") || has("pecho") || has("confusion");
  const dizzy = has("mareo");
  const feverish = has("fiebre");
  const stomach = has("estomago") || has("nauseas");
  const headache = has("cabeza") || has("dolor_cabeza");
  const joints = has("espalda") || has("articulaciones") || has("piernas");
  const alone = answers.social_contact === "no";

  if (safetySignal) {
    return {
      feeling_label: "Un día para estar acompañada",
      overall_state: "low",
      vyva_reading: `${name || "Cariño"}, gracias por decírmelo. Algunas respuestas merecen atención y hoy no conviene esperar en silencio.`,
      right_now: [
        "Siéntate en una postura cómoda y evita caminar sola ahora.",
        "Avisa a alguien cercano para que esté pendiente de ti.",
        "Si la molestia en el pecho, la confusión o la falta de aire continúa, pide ayuda urgente.",
      ],
      today_actions: [
        "Mantente cerca del teléfono y no hagas esfuerzos.",
        "Anota a qué hora empezó lo que notas.",
        "Si empeora o te asusta, usa el chequeo de síntomas o busca atención médica.",
      ],
      highlight: "Lo importante hoy es seguridad, compañía y observar si mejora pronto.",
      flag_caregiver: true,
      watch_for: "Si notas falta de aire, dolor en el pecho, confusión intensa o empeoramiento rápido, busca ayuda urgente. VYVA también puede abrir el chequeo de síntomas.",
    };
  }

  if (strongEnergy && !lowMood && goodSleep && noBodyNotes && noSymptoms) {
    return {
      feeling_label: "Un día con buen impulso",
      overall_state: "excellent",
      vyva_reading: `${name || "Cariño"}, hoy tus respuestas suenan estables y con buena energía. Es un buen día para hacer algo agradable sin llenarlo demasiado.`,
      right_now: [
        "Elige una actividad sencilla que te apetezca de verdad.",
        "Toma agua antes de salir o empezar.",
        "Reserva un momento tranquilo para después.",
      ],
      today_actions: [
        "Mira Para ti hoy en Concierge para elegir un plan cercano y adaptado.",
        "Pide a VYVA que prepare transporte si decides salir.",
        "Para antes de cansarte, aunque te sientas bien.",
      ],
      highlight: "Tienes margen para disfrutar, manteniendo un ritmo amable.",
      flag_caregiver: false,
      watch_for: null,
    };
  }

  if (poorSleep) {
    return {
      feeling_label: "Un día de recuperar descanso",
      overall_state: lowEnergy ? "tired" : "moderate",
      vyva_reading: `${name || "Cariño"}, dormir poco cambia mucho el cuerpo y el ánimo. Hoy conviene bajar el ritmo y cuidar lo básico.`,
      right_now: [
        "Bebe agua y toma algo ligero si no has desayunado.",
        "Haz una pausa sentada durante unos minutos.",
        "Deja para mas tarde cualquier tarea que no sea urgente.",
      ],
      today_actions: [
        "Busca luz natural suave durante un rato.",
        "Evita una siesta larga; mejor un descanso corto.",
        alone ? "Haz una llamada breve a alguien de confianza." : "Elige una idea tranquila en Para ti hoy si te apetece algo suave.",
      ],
      highlight: "Tu cuerpo está pidiendo recuperar energía, no demostrar fuerza.",
      flag_caregiver: lowEnergy && lowMood,
      watch_for: dizzy ? "Si el mareo se repite, aumenta o viene con debilidad fuerte, avisa a alguien y consulta." : null,
    };
  }

  if (stomach) {
    return {
      feeling_label: "Un día para cuidar el estómago",
      overall_state: "moderate",
      vyva_reading: `${name || "Cariño"}, hoy tu cuerpo parece pedir calma digestiva y un plan sencillo, sin prisas ni comidas pesadas.`,
      right_now: [
        "Toma pequeños sorbos de agua.",
        "Elige comida suave si tienes hambre.",
        "Descansa sentada y evita moverte rápido.",
      ],
      today_actions: [
        "Observa si las náuseas mejoran después de hidratarte.",
        "Evita comidas muy grasas o abundantes hoy.",
        "Si no mejora, usa el chequeo de síntomas para decidir el siguiente paso.",
      ],
      highlight: "Hoy ayuda más la suavidad que intentar seguir como siempre.",
      flag_caregiver: lowEnergy && alone,
      watch_for: feverish ? "Si hay fiebre, vómitos persistentes o dolor fuerte, usa el chequeo de síntomas y considera atención médica." : null,
    };
  }

  if (headache || dizzy) {
    return {
      feeling_label: dizzy ? "Un día para ir con cuidado" : "Un día de bajar estímulos",
      overall_state: "moderate",
      vyva_reading: `${name || "Cariño"}, tus respuestas apuntan a que hoy conviene reducir ruido, pantallas y movimientos bruscos.`,
      right_now: [
        "Bebe agua y sientate un momento.",
        "Evita levantarte deprisa.",
        "Busca un sitio tranquilo con poca luz si puedes.",
      ],
      today_actions: [
        "Haz solo desplazamientos necesarios y evita salir sola si te notas inestable.",
        "Pide ayuda con tareas que requieran esfuerzo.",
        "Si no mejora, revisa tus signos vitales o inicia el chequeo de síntomas.",
      ],
      highlight: "Ir despacio hoy es una decisión inteligente.",
      flag_caregiver: dizzy && lowEnergy,
      watch_for: dizzy ? "Si el mareo continúa, aparece debilidad o te cuesta hablar, busca ayuda enseguida y usa el chequeo de síntomas si puedes hacerlo con calma." : null,
    };
  }

  if (joints) {
    return {
      feeling_label: "Un día de movimiento suave",
      overall_state: lowEnergy ? "tired" : "moderate",
      vyva_reading: `${name || "Cariño"}, hoy parece mejor proteger el cuerpo y elegir movimientos pequeños, seguros y sin prisa.`,
      right_now: [
        "Cambia de postura despacio.",
        "Evita cargar peso o subir muchas escaleras.",
        "Prepara lo que necesites cerca para moverte menos.",
      ],
      today_actions: [
        "Busca en Para ti hoy una actividad sentada o con descansos frecuentes.",
        "Usa calzado cómodo si sales.",
        "Pide a Concierge que organice transporte si el plan merece la pena.",
      ],
      highlight: "Cuidar articulaciones y espalda hoy te ayuda a llegar mejor a la tarde.",
      flag_caregiver: false,
      watch_for: null,
    };
  }

  if (lowMood || unsettledMood || alone) {
    return {
      feeling_label: alone ? "Un día para sentirte acompañada" : "Un día emocionalmente sensible",
      overall_state: lowEnergy ? "low" : "moderate",
      vyva_reading: `${name || "Cariño"}, hoy no todo pasa por el cuerpo. También cuenta cómo está el ánimo, y merece cuidado sencillo.`,
      right_now: [
        "Respira despacio durante un minuto.",
        "Haz una cosa pequeña que te dé sensación de orden.",
        "Si puedes, manda un mensaje corto a alguien de confianza.",
      ],
      today_actions: [
        "Evita quedarte con preocupaciones dando vueltas sola.",
        "Mira Para ti hoy para encontrar algo cercano, tranquilo y acompañado.",
        "Si te apetece, pide a VYVA que te ayude a llamar a alguien.",
      ],
      highlight: "Hoy la compañía y la calma pueden ayudar más que hacer muchas cosas.",
      flag_caregiver: lowEnergy && alone,
      watch_for: answers.mood === "triste" && alone ? "Si esta tristeza se mantiene varios días o se vuelve muy pesada, conviene contárselo a alguien de confianza." : null,
    };
  }

  return {
    feeling_label: lightSleep || lowEnergy ? "Un día estable, con calma" : "Un día estable",
    overall_state: lowEnergy ? "tired" : "good",
    vyva_reading: `${name || "Cariño"}, gracias por contármelo. Tus respuestas no señalan nada fuerte, pero hoy conviene escucharte y mantener un ritmo claro.`,
    right_now: [
      "Bebe un vaso de agua despacio.",
      "Elige una tarea pequeña y fácil para empezar.",
      "Haz una pausa breve antes de pasar a lo siguiente.",
    ],
    today_actions: [
      "Mira Para ti hoy en Concierge para una idea local y adaptada.",
      "Mantén planes sencillos y deja margen para descansar.",
      "Habla con alguien cercano si te apetece compañía.",
    ],
    highlight: lightSleep ? "Dormiste regular, así que te irá mejor un día sin prisas." : "Tu cuerpo agradece un ritmo amable y bien elegido.",
    flag_caregiver: lowEnergy && lowMood,
    watch_for: null,
  };
}

function appActionsFor(answers: Answers, result: CheckinResult): AppAction[] {
  const hasSymptom = (id: string) => answers.symptoms.includes(id) || answers.body_areas.includes(id);
  const safetySignal = hasSymptom("falta_aire") || hasSymptom("pecho") || hasSymptom("confusion");
  const symptomSignal =
    safetySignal ||
    ["mareo", "nauseas", "fiebre", "dolor_cabeza"].some(hasSymptom) ||
    answers.symptoms.some((item) => item !== "ninguno");
  const outingFriendly =
    !safetySignal &&
    (answers.energy_level ?? 3) >= 3 &&
    !["mal", "muy_mal"].includes(answers.sleep_quality ?? "") &&
    !["pecho", "falta_aire", "mareo", "confusion"].some(hasSymptom);

  const actions: AppAction[] = [];

  if (safetySignal) {
    actions.push({
      key: "care",
      title: "Buscar atención médica",
      description: "Si empeora, hay dolor en el pecho, falta de aire o confusión, no esperes.",
      to: "/health",
      primary: true,
    });
  }

  if (symptomSignal || result.watch_for) {
    actions.push({
      key: "symptom",
      title: "Hacer chequeo de síntomas",
      description: "VYVA te guía con preguntas claras y te ayuda a decidir el siguiente paso.",
      to: "/health/symptom-check",
      primary: !safetySignal,
    });
  }

  if (hasSymptom("mareo") || hasSymptom("falta_aire") || hasSymptom("pecho") || (answers.energy_level ?? 3) <= 2) {
    actions.push({
      key: "vitals",
      title: "Tomar signos vitales",
      description: "Haz un escaneo rápido para registrar pulso y respiración antes de decidir.",
      to: "/health/vitals",
    });
  }

  if (outingFriendly || actions.length === 0) {
    actions.push({
      key: "concierge",
      title: "Ver Para ti hoy",
      description: "Encuentra una salida o idea cercana, adaptada a tu energía y movilidad.",
      to: "/concierge",
      primary: actions.length === 0,
    });
  }

  return actions.slice(0, 3);
}

function resultVisualFor(state: CheckinResult["overall_state"]) {
  switch (state) {
    case "excellent":
      return { icon: "✨", labelBg: "#FFFBEB", labelText: "#78350F" };
    case "good":
      return { icon: "🌤️", labelBg: "#ECFDF5", labelText: "#0A7C4E" };
    case "tired":
      return { icon: "🌙", labelBg: "#F5F3FF", labelText: "#6B21A8" };
    case "low":
      return { icon: "💙", labelBg: "#EFF6FF", labelText: "#1D4ED8" };
    default:
      return { icon: "💜", labelBg: "#F5F3FF", labelText: "#6B21A8" };
  }
}

function shareTextFor(name: string, result: CheckinResult) {
  const rightNow = result.right_now.slice(0, 3).map((item) => `- ${item}`).join("\n");
  const today = result.today_actions.slice(0, 3).map((item) => `- ${item}`).join("\n");
  return [
    `Lectura VYVA de hoy para ${name || "mí"}`,
    "",
    result.feeling_label,
    result.vyva_reading,
    "",
    `Lo importante: ${result.highlight}`,
    "",
    "Ahora mismo:",
    rightNow,
    "",
    "Para hoy:",
    today,
    result.watch_for ? `\nTen en cuenta: ${result.watch_for}` : "",
  ].filter(Boolean).join("\n");
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
  const appActions = result ? appActionsFor(answers, result) : [];
  const resultVisual = result ? resultVisualFor(result.overall_state) : null;

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

  const shareResult = async () => {
    if (!result) return;
    const text = shareTextFor(name, result);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mi lectura VYVA de hoy", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ description: "Resultado copiado para compartir." });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast({ description: "Resultado copiado para compartir." });
      } catch {
        toast({ description: "No he podido compartir el resultado ahora mismo." });
      }
    }
  };

  return (
    <div className="vyva-page bg-[radial-gradient(circle_at_top_left,#FFF7ED_0%,transparent_34%),linear-gradient(180deg,#FAF7F2_0%,#F6EFE7_100%)]">
      {QUESTION_STEPS.includes(step) && (
        <div className="mb-4 rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_10px_30px_rgba(63,45,35,0.06)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={goBack}
              className="vyva-tap flex min-h-[50px] items-center gap-2 rounded-full bg-[#F5EFE7] px-4 font-body text-[16px] font-semibold text-vyva-text-1"
            >
              <ArrowLeft size={19} />
              Atrás
            </button>
            <span className="rounded-full bg-vyva-purple-light px-4 py-2 font-body text-[14px] font-bold text-vyva-purple shadow-sm">
              {QUESTION_STEPS.indexOf(step) + 1} de {QUESTION_STEPS.length}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#EDE4DA]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-vyva-purple to-[#8B5CF6] transition-all duration-300"
              style={{ width: `${progressFor(step)}%` }}
            />
          </div>
          <p className="mt-2 text-right font-body text-[13px] font-semibold text-vyva-text-2">
            Vamos paso a paso
          </p>
        </div>
      )}

      {step === "welcome" && (
        <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
          <div className="relative bg-gradient-to-br from-[#FFF7ED] via-[#F5F3FF] to-white p-7 pb-6">
            <div className="absolute right-[-28px] top-[-34px] h-32 w-32 rounded-full bg-vyva-purple/10" />
            <div className="absolute bottom-[-46px] right-10 h-24 w-24 rounded-full bg-[#F59E0B]/12" />
            <div className="relative mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[28px] bg-white text-[36px] shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
              💜
            </div>
            <p className="relative mb-2 font-body text-[18px] font-semibold text-vyva-text-2">Hola, {name}</p>
            <h1 className="relative mb-4 font-display text-[38px] leading-tight text-vyva-text-1">
              Revisemos cómo te sientes hoy.
            </h1>
            <p className="relative font-body text-[21px] leading-relaxed text-vyva-text-2">
              Seis preguntas sencillas. VYVA las convierte en una lectura útil para tu día.
            </p>
          </div>
          <div className="grid gap-3 p-6">
            {[
              { Icon: ShieldCheck, title: "Privado", text: "Tus respuestas se tratan con cuidado." },
              { Icon: Sparkles, title: "Personal", text: "Usa tu perfil para adaptar las ideas." },
              { Icon: Sun, title: "Suave", text: "No es un diagnóstico, es una guía de bienestar." },
            ].map(({ Icon, title, text }) => (
              <div key={text} className="flex min-h-[82px] items-center gap-4 rounded-[24px] bg-[#FAF9F6] px-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-vyva-purple-light">
                  <Icon size={25} className="text-vyva-purple" />
                </span>
                <span>
                  <span className="block font-body text-[18px] font-bold text-vyva-text-1">{title}</span>
                  <span className="block font-body text-[17px] leading-snug text-vyva-text-2">{text}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="px-6 pb-6">
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
          </div>
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
        <section className="flex min-h-[520px] flex-col items-center justify-center overflow-hidden rounded-[36px] border border-white/80 bg-gradient-to-br from-white via-[#F5F3FF] to-[#FFF7ED] p-8 text-center shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[34px] bg-white shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
            <Loader2 size={54} className="animate-spin text-vyva-purple" />
          </div>
          <h1 className="mb-3 font-display text-[32px] text-vyva-text-1">Un momento, {name}</h1>
          <p className="font-body text-[21px] leading-relaxed text-vyva-text-2">{loadingMessage}</p>
        </section>
      )}

      {step === "result" && result && resultVisual && (
        <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
          <div className="relative bg-gradient-to-br from-[#FFF7ED] via-[#F5F3FF] to-white p-7 pb-6">
            <div className="absolute right-[-30px] top-[-42px] h-36 w-36 rounded-full bg-vyva-purple/10" />
            <div className="absolute bottom-[-48px] left-10 h-24 w-24 rounded-full bg-[#F59E0B]/12" />
            <div className="relative mb-5 flex h-[78px] w-[78px] items-center justify-center rounded-[28px] bg-white text-[38px] shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
              {resultVisual.icon}
            </div>
            <p className="relative mb-3 inline-flex rounded-full px-4 py-2 font-body text-[14px] font-bold uppercase tracking-[0.14em]" style={{ background: resultVisual.labelBg, color: resultVisual.labelText }}>
              Tu lectura de hoy
            </p>
            <h1 className="relative mb-4 font-display text-[38px] leading-tight text-vyva-text-1">{result.feeling_label}</h1>
            <p className="relative font-body text-[21px] leading-relaxed text-vyva-text-2">{result.vyva_reading}</p>
          </div>
          <div className="p-6">
          <div className="mb-5 flex gap-4 rounded-[26px] bg-vyva-purple-light p-5">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-white text-[24px]">💡</span>
            <span>
              <span className="mb-1 block font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-purple">Lo importante</span>
              <span className="block font-body text-[20px] font-semibold leading-relaxed text-vyva-text-1">{result.highlight}</span>
            </span>
          </div>
          <ResultList title="Ahora mismo" icon="⚡" items={result.right_now} />
          <ResultList title="Para hoy" icon="☀️" items={result.today_actions} />
          {result.watch_for && (
            <div className="mt-4 flex gap-3 rounded-[24px] border border-[#F59E0B]/30 bg-[#FFFBEB] p-5">
              <span className="text-[24px]">🔎</span>
              <p className="font-body text-[18px] leading-relaxed text-[#78350F]">{result.watch_for}</p>
            </div>
          )}
          {appActions.length > 0 && (
            <div className="mt-5 rounded-[26px] border border-vyva-border bg-white p-5 shadow-[0_8px_24px_rgba(107,33,168,0.08)]">
              <p className="mb-2 font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-purple">
                VYVA puede ayudarte ahora
              </p>
              <p className="mb-4 font-body text-[18px] leading-relaxed text-vyva-text-2">
                Elige el siguiente paso dentro de la app, sin tener que buscarlo tú.
              </p>
              <div className="grid gap-3">
                {appActions.map((action) => (
                  <AppActionButton key={action.key} action={action} onClick={() => navigate(action.to)} />
                ))}
              </div>
            </div>
          )}
          <p className="mt-6 font-body text-[21px] leading-relaxed text-vyva-text-1">
            Gracias por hacerlo. Este pequeño hábito ayuda a VYVA a cuidarte mejor cada día.
          </p>
          <div className="mt-6 grid gap-3">
            <button onClick={shareResult} className="vyva-secondary-action min-h-[68px] w-full text-[19px]">
              <Share2 size={19} className="mr-2" />
              Compartir resultado
            </button>
            <button onClick={() => navigate("/health")} className="vyva-primary-action min-h-[72px] w-full text-[20px]">
              Gracias, VYVA
            </button>
            <button onClick={reset} className="vyva-secondary-action min-h-[68px] w-full text-[19px]">
              Repetir check-in
            </button>
          </div>
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
    <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
      <div className="relative bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFF7ED] p-6 pb-5">
        <div className="absolute right-[-36px] top-[-42px] h-32 w-32 rounded-full bg-vyva-purple/10" />
        <div className="relative mb-4 flex h-[68px] w-[68px] items-center justify-center rounded-[24px] bg-white text-vyva-purple shadow-[0_10px_26px_rgba(107,33,168,0.14)]">
          {icon}
        </div>
        <h1 className="relative mb-2 font-display text-[34px] leading-tight text-vyva-text-1">{title}</h1>
        <p className="relative font-body text-[20px] leading-relaxed text-vyva-text-2">{subtitle}</p>
      </div>
      <div className="p-5 pt-4">{children}</div>
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
            className={`vyva-tap flex min-h-[86px] items-center justify-between gap-4 rounded-[24px] border px-4 py-3 text-left transition-all ${
              isSelected
                ? "border-vyva-purple bg-gradient-to-r from-vyva-purple to-[#8B5CF6] text-white shadow-[0_10px_26px_rgba(107,33,168,0.22)]"
                : "border-vyva-border bg-[#FAF9F6] text-vyva-text-1 shadow-[0_4px_14px_rgba(63,45,35,0.04)]"
            }`}
          >
            <span className="flex min-w-0 flex-1 items-center gap-4">
              <span
                className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[19px] text-[27px] ${
                  isSelected ? "bg-white/18" : "bg-white"
                }`}
              >
                {option.icon ?? "•"}
              </span>
              <span className="min-w-0">
              <span className="block font-body text-[21px] font-bold leading-tight">{option.label}</span>
              {option.helper && (
                <span className={`mt-1 block font-body text-[16px] leading-snug ${isSelected ? "text-white/85" : "text-vyva-text-2"}`}>
                  {option.helper}
                </span>
              )}
              </span>
            </span>
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                isSelected ? "bg-[#F59E0B] shadow-sm" : "border-2 border-vyva-border bg-white"
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

function ResultList({ title, icon, items }: { title: string; icon: string; items: string[] }) {
  return (
    <div className="mt-4 rounded-[26px] border border-vyva-border bg-[#FAF9F6] p-5 shadow-[0_4px_16px_rgba(63,45,35,0.04)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-[22px]">{icon}</span>
        <p className="font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-text-2">{title}</p>
      </div>
      <div className="grid gap-3">
        {items.slice(0, 3).map((item) => (
          <div key={item} className="flex gap-3 rounded-[18px] bg-white p-3">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple text-[14px] font-bold text-white">
              <Check size={16} />
            </span>
            <p className="font-body text-[19px] leading-relaxed text-vyva-text-1">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppActionButton({ action, onClick }: { action: AppAction; onClick: () => void }) {
  const Icon =
    action.key === "concierge" ? Compass :
    action.key === "symptom" ? ClipboardList :
    action.key === "vitals" ? Activity :
    ShieldCheck;
  return (
    <button
      onClick={onClick}
      className={`vyva-tap flex min-h-[86px] items-center gap-4 rounded-[22px] border p-4 text-left ${
        action.primary
          ? "border-vyva-purple bg-vyva-purple text-white"
          : "border-vyva-border bg-[#FAF9F6] text-vyva-text-1"
      }`}
      data-testid={`button-checkin-app-action-${action.key}`}
    >
      <span
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] ${
          action.primary ? "bg-white/18" : "bg-vyva-purple-light"
        }`}
      >
        <Icon size={24} className={action.primary ? "text-white" : "text-vyva-purple"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[18px] font-bold leading-tight">{action.title}</span>
        <span className={`mt-1 block font-body text-[15px] leading-snug ${action.primary ? "text-white/85" : "text-vyva-text-2"}`}>
          {action.description}
        </span>
      </span>
    </button>
  );
}

export default CheckHowIFeelScreen;
