import { useState, useRef, useEffect, useMemo, CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Stethoscope,
  Camera,
  UserSearch,
  Video,
  Phone,
  MapPin,
  Share2,
  ChevronRight,
  ChevronDown,
  X,
  Clock,
  Pill,
  Activity,
  ClipboardList,
  HeartPulse,
  Trash2,
  Copy,
  History,
  Heart,
  Salad,
  BookOpen,
  Bandage,
  Star,
  Mic,
  Square,
  RefreshCw,
  ChevronUp,
} from "lucide-react";
import VoiceHero from "@/components/VoiceHero";
import { useProfile } from "@/contexts/ProfileContext";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type WoundScan = {
  id: string;
  severity: string;
  result_title: string;
  advice: string;
  image_data?: string | null;
  scanned_at: string;
};

type SpecialistProvider = {
  name: string;
  specialty: string;
  specialtyLabel?: string;
  clinicName?: string;
  phone?: string | null;
  address?: string;
  bookingUrl?: string | null;
  mapsUrl?: string | null;
  sourceName: string;
  reviewScore?: number | null;
  reviewCount?: number | null;
  distanceLabel?: string | null;
  availabilityText?: string | null;
  openingTimes?: string | null;
  rationale: string;
  score: number;
};

type SpecialistRecommendation = {
  condition: string;
  matchedSpecialties: string[];
  safetyNote: string;
  providers: SpecialistProvider[];
  mapsSearchUrl?: string;
  nextStep: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  minor:    { bg: "#DCFCE7", text: "#15803D" },
  moderate: { bg: "#FEF9C3", text: "#A16207" },
  serious:  { bg: "#FEE2E2", text: "#B91C1C" },
};

const SCAN_SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Minor:    { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  Moderate: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  Serious:  { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

const MOCK_SPECIALISTS: Record<string, { name: string; rating: number; waitN: number; waitUnit: "day" | "week" }[]> = {
  cardiología: [
    { name: "Dra. Elena Voss", rating: 4.9, waitN: 3, waitUnit: "day" },
    { name: "Dr. Martín Shore", rating: 4.7, waitN: 1, waitUnit: "week" },
  ],
  neurología: [
    { name: "Dra. Laura Chen", rating: 4.8, waitN: 1, waitUnit: "week" },
    { name: "Dr. Paulo Ferreira", rating: 4.6, waitN: 2, waitUnit: "week" },
  ],
  dermatología: [
    { name: "Dra. Nadia Kowal", rating: 4.7, waitN: 2, waitUnit: "day" },
    { name: "Dr. James O'Brien", rating: 4.5, waitN: 1, waitUnit: "week" },
  ],
  traumatología: [
    { name: "Dr. Carlos Reyes", rating: 4.6, waitN: 1, waitUnit: "week" },
    { name: "Dra. Ingrid Lund", rating: 4.8, waitN: 5, waitUnit: "day" },
  ],
};
const SPECIALTIES = Object.keys(MOCK_SPECIALISTS);
const DEFAULT_SPECIALIST_EXAMPLES_ES = [
  "dolor de rodilla",
  "problemas de memoria",
  "diabetes",
  "mancha en la piel",
  "falta de aire",
  "presión alta",
  "dolor de cadera",
  "herida que no cura",
  "revisar la vista",
  "problemas urinarios",
  "ánimo bajo",
  "tiroides",
];

const DEFAULT_SPECIALIST_EXAMPLES_EN = [
  "knee pain",
  "memory problems",
  "diabetes",
  "skin mark",
  "shortness of breath",
  "high blood pressure",
  "hip pain",
  "wound not healing",
  "eye check",
  "urinary problems",
  "low mood",
  "thyroid",
];

const SPECIALTY_LABELS_ES: Record<string, string> = {
  Dermatology: "Dermatología",
  Dermatologia: "Dermatología",
  Neurology: "Neurología",
  Geriatrics: "Geriatría",
  Neuropsychology: "Neuropsicología",
  Endocrinology: "Endocrinología",
  Cardiology: "Cardiología",
  "Traumatology / Orthopaedics": "Traumatología / Ortopedia",
  Physiotherapy: "Fisioterapia",
  Rheumatology: "Reumatología",
  "Internal Medicine": "Medicina interna",
  "General Practice": "Medicina general",
  "Wound Care Nursing": "Enfermería de heridas",
  Pulmonology: "Neumología",
  Gastroenterology: "Digestivo",
  Urology: "Urología",
  Gynaecology: "Ginecología",
  Gynecology: "Ginecología",
  Ophthalmology: "Oftalmología",
  Podiatry: "Podología",
  Psychology: "Psicología",
  Psychiatry: "Psiquiatría",
};

function activeLanguage(language?: string): string {
  return (language || "es").split("-")[0].toLowerCase();
}

function displaySpecialtyText(specialty: string, language: string): string {
  if (activeLanguage(language) === "es") {
    return SPECIALTY_LABELS_ES[specialty] ?? specialty;
  }
  return specialty;
}

function displaySpecialty(provider: SpecialistProvider, language: string): string {
  return displaySpecialtyText(provider.specialtyLabel ?? provider.specialty, language);
}

function normalizeForMatching(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function localizedSpecialistPrompt(key: string, language: string): string {
  const isSpanish = activeLanguage(language) === "es";
  const prompts: Record<string, { es: string; en: string }> = {
    knee: { es: "dolor de rodilla", en: "knee pain" },
    hip: { es: "dolor de cadera", en: "hip pain" },
    falls: { es: "caídas frecuentes", en: "frequent falls" },
    memory: { es: "problemas de memoria", en: "memory problems" },
    diabetes: { es: "diabetes", en: "diabetes" },
    skin: { es: "mancha en la piel", en: "skin mark" },
    wound: { es: "herida que no cura", en: "wound not healing" },
    breathing: { es: "falta de aire", en: "shortness of breath" },
    heart: { es: "control del corazón", en: "heart check" },
    pressure: { es: "presión alta", en: "high blood pressure" },
    thyroid: { es: "tiroides", en: "thyroid" },
    stomach: { es: "dolor de estómago", en: "stomach pain" },
    urinary: { es: "problemas urinarios", en: "urinary problems" },
    vision: { es: "revisar la vista", en: "eye check" },
    mood: { es: "ánimo bajo", en: "low mood" },
  };

  return prompts[key]?.[isSpanish ? "es" : "en"] ?? key;
}

function deriveSpecialistExamples(conditions: string[] | undefined, language: string): string[] {
  const normalizedConditions = (conditions ?? []).map(normalizeForMatching);
  const matches = (keywords: string[]) =>
    normalizedConditions.some((condition) => keywords.some((keyword) => condition.includes(keyword)));
  const suggestions: string[] = [];

  if (matches(["arthritis", "arthrosis", "osteoarthritis", "rodilla", "knee", "joint"])) suggestions.push(localizedSpecialistPrompt("knee", language));
  if (matches(["hip", "cadera"])) suggestions.push(localizedSpecialistPrompt("hip", language));
  if (matches(["fall", "falls", "caida", "caidas", "mobility", "balance"])) suggestions.push(localizedSpecialistPrompt("falls", language));
  if (matches(["memory", "memoria", "dementia", "alzheimer", "cognitive"])) suggestions.push(localizedSpecialistPrompt("memory", language));
  if (matches(["diabetes", "glucose", "glucosa", "sugar"])) suggestions.push(localizedSpecialistPrompt("diabetes", language));
  if (matches(["skin", "piel", "dermat", "lunar", "eczema", "psoriasis"])) suggestions.push(localizedSpecialistPrompt("skin", language));
  if (matches(["wound", "ulcer", "herida", "ulcera"])) suggestions.push(localizedSpecialistPrompt("wound", language));
  if (matches(["asthma", "asma", "copd", "epoc", "breathing", "respir", "pulmonary", "lung"])) suggestions.push(localizedSpecialistPrompt("breathing", language));
  if (matches(["heart", "cardiac", "corazon", "cardio", "angina", "arrhythmia"])) suggestions.push(localizedSpecialistPrompt("heart", language));
  if (matches(["hypertension", "blood pressure", "presion"])) suggestions.push(localizedSpecialistPrompt("pressure", language));
  if (matches(["thyroid", "tiroides"])) suggestions.push(localizedSpecialistPrompt("thyroid", language));
  if (matches(["digest", "stomach", "colon", "intestin", "estomago"])) suggestions.push(localizedSpecialistPrompt("stomach", language));
  if (matches(["urinary", "urine", "prostate", "urinario", "vejiga", "prostata"])) suggestions.push(localizedSpecialistPrompt("urinary", language));
  if (matches(["vision", "eye", "vista", "ojo", "cataract"])) suggestions.push(localizedSpecialistPrompt("vision", language));
  if (matches(["depression", "anxiety", "mood", "ansiedad", "depresion", "animo"])) suggestions.push(localizedSpecialistPrompt("mood", language));

  const defaults = activeLanguage(language) === "es"
    ? DEFAULT_SPECIALIST_EXAMPLES_ES
    : DEFAULT_SPECIALIST_EXAMPLES_EN;

  return uniqueValues([...suggestions, ...defaults]);
}

type TFunction = (key: string, fallback?: string) => string;

const ScanFullScreenModal = ({
  scan,
  onClose,
  t,
}: {
  scan: WoundScan;
  onClose: () => void;
  t: TFunction;
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const sColors = SEVERITY_COLORS[scan.severity.toLowerCase()] ?? { bg: "#F3F4F6", text: "#374151" };
  const modalDate = new Date(scan.scanned_at).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      data-testid="modal-scan-fullscreen"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-[18px] py-[14px] flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-[8px]">
          <span
            data-testid="text-modal-scan-severity"
            className="font-body text-[12px] font-semibold px-[10px] py-[3px] rounded-full"
            style={{ background: sColors.bg, color: sColors.text }}
          >
            {t(`health.scanWound.severityLabel.${scan.severity.toLowerCase()}`, scan.severity)}
          </span>
          <p data-testid="text-modal-scan-title" className="font-body text-[14px] font-semibold text-white">{scan.result_title}</p>
        </div>
        <button
          data-testid="button-close-fullscreen-scan"
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className="p-[8px] rounded-full transition-colors hover:bg-white/20 active:scale-95"
        >
          <X size={20} color="#fff" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-[18px] min-h-0" onClick={(e) => e.stopPropagation()}>
        {scan.image_data && (
          <img
            data-testid="img-modal-scan-full"
            src={scan.image_data}
            alt={scan.result_title}
            className="max-w-full max-h-full rounded-[16px] object-contain"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
          />
        )}
      </div>

      <div
        data-testid="section-modal-scan-advice"
        className="flex-shrink-0 rounded-t-[24px] px-[20px] pt-[18px] pb-[28px]"
        style={{ background: "#FFFFFF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[6px] mb-[10px]">
          <Clock size={12} style={{ color: "#9CA3AF" }} />
          <p data-testid="text-modal-scan-date" className="font-body text-[12px]" style={{ color: "#9CA3AF" }}>{modalDate}</p>
        </div>
        <p className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]" style={{ color: "#7C3AED" }}>
          {t("health.pastScans.aiAdvice", "AI Advice")}
        </p>
        <p data-testid="text-modal-scan-advice" className="font-body text-[14px] text-vyva-text-1 leading-snug">{scan.advice}</p>
      </div>
    </div>
  );
};

const HealthScreen = () => {
  const { t, i18n } = useTranslation();
  const { firstName, profile } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [seeDoctorOpen,    setSeeDoctorOpen]    = useState(false);
  const [specialistOpen,   setSpecialistOpen]   = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [specialistCondition, setSpecialistCondition] = useState("");
  const [specialistLocation, setSpecialistLocation] = useState("");
  const [specialistLocationEdited, setSpecialistLocationEdited] = useState(false);
  const [specialistExamplePage, setSpecialistExamplePage] = useState(0);
  const [specialistResult, setSpecialistResult] = useState<SpecialistRecommendation | null>(null);
  const [specialistVoiceListening, setSpecialistVoiceListening] = useState(false);
  const [historialOpen,    setHistorialOpen]    = useState(false);
  const [expandedScanId,   setExpandedScanId]   = useState<string | null>(null);
  const [fullScreenScan,   setFullScreenScan]   = useState<WoundScan | null>(null);
  const [woundAnalyzing,   setWoundAnalyzing]   = useState(false);
  const [woundResult,      setWoundResult]      = useState<null | { severity: string; resultTitle: string; advice: string }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specialistRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const headlineText = firstName
    ? `Todo en orden hoy, ${firstName}`
    : "Todo en orden hoy";
  const specialistLanguage = activeLanguage(profile?.language) || "es";

  const profileLocation = useMemo(() => {
    const parts = [
      profile?.postalCode,
      profile?.cityState,
      profile?.country,
    ].map((part) => part?.trim()).filter(Boolean);
    return uniqueValues(parts as string[]).join(", ");
  }, [profile?.postalCode, profile?.cityState, profile?.country]);

  const { data: personalisationData } = useQuery<{
    conditions: string[];
    hobbies: string[];
    hasMedications: boolean;
  }>({
    queryKey: ["/api/profile/personalisation"],
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const specialistExamples = useMemo(() => {
    const allExamples = deriveSpecialistExamples(personalisationData?.conditions, specialistLanguage);
    const pageSize = 4;
    const start = (specialistExamplePage * pageSize) % allExamples.length;
    return [...allExamples.slice(start), ...allExamples.slice(0, start)].slice(0, pageSize);
  }, [personalisationData?.conditions, specialistLanguage, specialistExamplePage]);

  useEffect(() => {
    if (!specialistLocationEdited && profileLocation && !specialistLocation.trim()) {
      setSpecialistLocation(profileLocation);
    }
  }, [profileLocation, specialistLocation, specialistLocationEdited]);

  const { data: pastScans = [], isLoading: pastScansLoading } = useQuery<WoundScan[]>({
    queryKey: ["/api/wound-scan/history"],
    retry: false,
  });

  const deleteScanMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/wound-scan/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wound-scan/history"] });
    },
  });

  const specialistMutation = useMutation({
    mutationFn: async (input?: { condition?: string; location?: string }) => {
      const condition = input?.condition ?? specialistCondition;
      const location = input?.location ?? (specialistLocation.trim() || profileLocation || "Tarifa, Cadiz");
      const res = await apiFetch("/api/specialists/recommendations", {
        method: "POST",
        body: JSON.stringify({
          condition,
          location,
          language: specialistLanguage,
          urgency: "routine",
        }),
      });
      if (!res.ok) throw new Error("Specialist search failed");
      return res.json() as Promise<SpecialistRecommendation>;
    },
    onSuccess: (data) => setSpecialistResult(data),
    onError: () => {
      toast({ description: "No he podido buscar especialistas ahora mismo. Intentalo de nuevo en un momento." });
    },
  });

  const runSpecialistSearch = (condition = specialistCondition) => {
    const trimmedCondition = condition.trim();
    if (!trimmedCondition) {
      toast({ description: "Dime la condicion o necesidad para buscar el especialista adecuado." });
      return;
    }
    setSpecialistCondition(trimmedCondition);
    setSpecialistResult(null);
    specialistMutation.mutate({ condition: trimmedCondition, location: specialistLocation.trim() || profileLocation || "Tarifa, Cadiz" });
  };

  const stopSpecialistVoice = () => {
    specialistRecognitionRef.current?.stop();
    specialistRecognitionRef.current = null;
    setSpecialistVoiceListening(false);
  };

  const resetSpecialistSearch = () => {
    stopSpecialistVoice();
    setSpecialistCondition("");
    setSpecialistResult(null);
    setSpecialistExamplePage(0);
    setSpecialistLocationEdited(false);
    setSpecialistLocation(profileLocation || "");
  };

  const startSpecialistVoice = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      toast({ description: "Tu navegador no permite dictado por voz aqui. Puedes escribir la condicion." });
      return;
    }

    const recognition = new Recognition();
    recognition.lang = specialistLanguage === "en" ? "en-US" : specialistLanguage === "de" ? "de-DE" : "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        setSpecialistCondition(transcript);
        runSpecialistSearch(transcript);
      }
    };
    recognition.onerror = () => {
      toast({ description: "No he podido escuchar bien. Intentalo de nuevo o escribelo." });
      setSpecialistVoiceListening(false);
    };
    recognition.onend = () => {
      setSpecialistVoiceListening(false);
      specialistRecognitionRef.current = null;
    };

    specialistRecognitionRef.current = recognition;
    setSpecialistVoiceListening(true);
    recognition.start();
  };

  useEffect(() => () => {
    specialistRecognitionRef.current?.stop();
  }, []);

  const bookSpecialistMutation = useMutation({
    mutationFn: async (provider: SpecialistProvider) => {
      const specialty = displaySpecialty(provider, specialistLanguage);
      const res = await apiFetch("/api/concierge/actions/trigger", {
        method: "POST",
        body: JSON.stringify({
          use_case: "book_appointment",
          provider_name: provider.clinicName ?? provider.name,
          provider_phone: provider.phone ?? null,
          found_externally: true,
          action_summary: `Pedir una cita de ${specialty} en ${provider.clinicName ?? provider.name}.`,
          action_payload: {
            doctor_name: provider.name,
            practice_name: provider.clinicName ?? provider.name,
            specialty,
            reason: specialistCondition,
            preferred_days: [],
            preferred_time: "",
            urgency: "routine",
            provider_address: provider.address ?? "",
            booking_url: provider.bookingUrl ?? "",
            source_name: provider.sourceName,
          },
          language: specialistLanguage,
          trigger_source: "user_request",
          auto_start: false,
        }),
      });
      if (!res.ok) throw new Error("Could not create appointment request");
      return res.json() as Promise<{ pendingId: string; status: string }>;
    },
    onSuccess: () => {
      toast({ description: "He preparado la solicitud. Te llevo a Concierge para confirmarla." });
      queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
      navigate("/concierge");
    },
    onError: () => {
      toast({ description: "No he podido preparar la cita. Intentalo de nuevo en un momento." });
    },
  });

  const contactSpecialist = (provider: SpecialistProvider) => {
    if (provider.phone) {
      window.location.href = `tel:${provider.phone.replace(/\s+/g, "")}`;
      return;
    }

    if (provider.bookingUrl) {
      window.open(provider.bookingUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (provider.mapsUrl) {
      window.open(provider.mapsUrl, "_blank", "noopener,noreferrer");
      return;
    }

    bookSpecialistMutation.mutate(provider);
  };

  const shareSpecialistProvider = async (provider: SpecialistProvider) => {
    const specialty = displaySpecialty(provider, specialistLanguage);
    const location = provider.address ?? provider.clinicName ?? specialistLocation;
    const lines = [
      provider.name,
      specialty,
      provider.phone ? `Telefono: ${provider.phone}` : null,
      location ? `Ubicacion: ${location}` : null,
      provider.openingTimes ? `Horario: ${provider.openingTimes}` : null,
      provider.distanceLabel ? `Distancia: ${provider.distanceLabel}` : null,
      provider.bookingUrl ? `Mas informacion: ${provider.bookingUrl}` : null,
      provider.mapsUrl ? `Google Maps: ${provider.mapsUrl}` : null,
    ].filter(Boolean).join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: provider.name, text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        toast({ description: "He copiado los datos para compartirlos." });
      }
    } catch {
      toast({ description: "No he podido compartirlo ahora. Intentalo de nuevo." });
    }
  };

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = objectUrl;
    });

  const handleWoundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setWoundResult(null);
    setWoundAnalyzing(true);

    const errorFallback = {
      severity: "Minor",
      resultTitle: t("health.scanWound.errorTitle"),
      advice: t("health.scanWound.errorAdvice"),
    };

    compressImage(file)
      .then(async (dataUrl) => {
        const res = await apiFetch("/api/wound-scan", {
          method: "POST",
          body: JSON.stringify({ image: dataUrl, language: i18n.language }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { severity: string; resultTitle: string; advice: string; isFallback?: boolean };
        if (data.isFallback) {
          setWoundResult(errorFallback);
        } else {
          setWoundResult(data);
          queryClient.invalidateQueries({ queryKey: ["/api/wound-scan/history"] });
        }
      })
      .catch((err) => {
        console.error("[wound-scan] error:", err);
        setWoundResult(errorFallback);
      })
      .finally(() => setWoundAnalyzing(false));
  };

  const QUICK_TILES = [
    { id: "sintomas",   Icon: HeartPulse,    iconBg: "#F5F3FF", iconColor: "#7C3AED", label: "Síntomas",    hint: "Revisar cómo me siento", action: () => navigate("/health/symptom-check") },
    { id: "medicacion", Icon: Pill,          iconBg: "#FDF4FF", iconColor: "#86198F", label: "Medicación",  hint: "Mis pastillas",     action: () => navigate("/meds") },
    { id: "signos",     Icon: Activity,      iconBg: "#FFF1F2", iconColor: "#BE123C", label: "Estado",      hint: "Signos vitales",    action: () => navigate("/health/vitals") },
    { id: "historial",  Icon: ClipboardList, iconBg: "#EFF6FF", iconColor: "#1D4ED8", label: "Informes",    hint: "Ver resumen",      action: () => navigate("/informes") },
  ];

  return (
    <>
      <div className="vyva-page">

        {/* ── 1. Hero ── */}
        <VoiceHero
          headline={<>{headlineText}</>}
          contextHint="health symptoms"
          talkLabel={t("health.talkToDoctor", "Talk to a Doctor")}
        />

        <button
          onClick={() => navigate("/health/check-ins")}
          className="hidden"
          data-testid="button-health-checkin-history"
        >
          <span className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-vyva-purple">
            <History size={28} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[19px] font-bold leading-tight text-vyva-text-1">
              Historial de bienestar
            </span>
            <span className="mt-1 block font-body text-[15px] leading-snug text-vyva-text-2">
              Ver tus lecturas anteriores y patrones recientes.
            </span>
          </span>
          <ChevronRight size={22} className="flex-shrink-0 text-vyva-purple" />
        </button>

        {/* ── 2. Acceso rápido (2×2 grid) ── */}
        <div className="mt-[20px]">
          <p className="vyva-section-title mb-3">
            Acceso rápido
          </p>
          <div className="grid grid-cols-2 gap-4">
            {QUICK_TILES.map((tile) => (
              <button
                key={tile.id}
                data-testid={`button-health-quick-${tile.id}`}
                onClick={tile.action}
                className="vyva-tap flex min-h-[150px] min-w-0 flex-col items-center justify-center gap-3 rounded-[28px] border border-vyva-border bg-[#FFFCF8] px-3 py-5 text-center transition-transform active:scale-[0.99]"
                style={{ boxShadow: "0 14px 30px rgba(60,38,20,0.08)" }}
              >
                <div
                  className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[20px]"
                  style={{ background: tile.iconBg }}
                >
                  <tile.Icon size={27} style={{ color: tile.iconColor }} />
                </div>
                <span className="font-body text-[18px] font-extrabold leading-[1.08] text-vyva-text-1 [overflow-wrap:anywhere]">
                  {tile.label}
                </span>
                <span className="font-body text-[14px] font-medium leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                  {tile.hint}
                </span>
              </button>
            ))}
          </div>
        </div>


        {/* ── 3. Acciones rápidas ── */}
        <div className="mt-[24px]">
          <p className="vyva-section-title mb-3">
            Acciones rápidas
          </p>

          <div className="flex flex-col gap-[10px]">

            {/* Ver a un médico */}
            <div
              className="vyva-card overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center gap-3 px-[18px] py-[16px]">
                <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: "#F0FDF4" }}>
                  <Stethoscope size={24} style={{ color: "#0A7C4E" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-semibold text-vyva-text-1">Ver a un médico</p>
                  <p className="font-body text-[12px] text-vyva-text-2">Videollamada o teléfono</p>
                </div>
                <button
                  data-testid="button-see-doctor"
                  onClick={() => setSeeDoctorOpen((v) => !v)}
                  className="vyva-tap flex-shrink-0 rounded-full px-[16px] py-[8px] font-body text-[14px] font-semibold transition-all"
                  style={{ background: "#F0FDF4", color: "#0A7C4E", border: "1px solid #BBF7D0" }}
                >
                  Reservar
                </button>
              </div>

              {seeDoctorOpen && (
                <div className="px-[18px] pb-[16px] flex flex-col gap-2" style={{ borderTop: "1px solid #F0FDF4" }}>
                  {[
                    { Icon: Video, label: "Videollamada", testId: "button-video-call" },
                    { Icon: Phone, label: "Llamada de voz", testId: "button-phone-call" },
                  ].map(({ Icon, label, testId }) => (
                    <div key={label} className="flex items-center gap-3 rounded-[12px] px-[14px] py-[11px] mt-2" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                      <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: "#F0FDF4" }}>
                        <Icon size={16} style={{ color: "#0A7C4E" }} />
                      </div>
                      <p className="font-body text-[14px] font-medium text-vyva-text-1 flex-1">{label}</p>
                      <button data-testid={testId} className="px-[12px] py-[5px] rounded-full font-body text-[12px] font-semibold" style={{ background: "#E5E7EB", color: "#6B7280" }}>
                        Próximamente
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Escanear herida */}
            <div
              className="vyva-card overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center gap-3 px-[18px] py-[16px]">
                <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: "#FFFBEB" }}>
                  <Camera size={24} style={{ color: "#C9890A" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-semibold text-vyva-text-1">Escanear herida</p>
                  <p className="font-body text-[12px] text-vyva-text-2">Análisis con IA en segundos</p>
                </div>
                <button
                  data-testid="button-scan-wound"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={woundAnalyzing}
                  className="vyva-tap flex-shrink-0 rounded-full px-[16px] py-[8px] font-body text-[14px] font-semibold transition-all"
                  style={{ background: "#FFFBEB", color: "#C9890A", border: "1px solid #FDE68A" }}
                >
                  {woundAnalyzing ? "Analizando…" : "Empezar"}
                </button>
              </div>

              {woundResult && (
                <div
                  className="mx-[18px] mb-[16px] rounded-[14px] p-[14px]"
                  style={{
                    background: woundResult.severity === "Serious" ? "#FEF2F2" : woundResult.severity === "Moderate" ? "#FFFBEB" : "#F0FDFA",
                    border: woundResult.severity === "Serious" ? "1px solid #FECACA" : woundResult.severity === "Moderate" ? "1px solid #FDE68A" : "1px solid #6EE7B7",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      data-testid="text-wound-severity"
                      className="font-body text-[11px] font-semibold px-[8px] py-[2px] rounded-full"
                      style={
                        woundResult.severity === "Serious"
                          ? { background: "#FEE2E2", color: "#991B1B" }
                          : woundResult.severity === "Moderate"
                          ? { background: "#FEF3C7", color: "#92400E" }
                          : { background: "#D1FAE5", color: "#065F46" }
                      }
                    >
                      {t(`health.scanWound.severityLabel.${woundResult.severity.toLowerCase()}`, woundResult.severity)}
                    </span>
                    <p data-testid="text-wound-result-title" className="font-body text-[13px] font-semibold text-vyva-text-1">{woundResult.resultTitle}</p>
                  </div>
                  <p data-testid="text-wound-advice" className="font-body text-[13px] text-vyva-text-1 leading-snug mb-2">{woundResult.advice}</p>
                  <p className="font-body text-[11px] leading-snug" style={{ color: "#6B7280" }}>⚠️ {t("health.scanWound.disclaimer")}</p>
                  <button
                    data-testid="button-close-wound-result"
                    onClick={() => setWoundResult(null)}
                    className="mt-2 flex items-center gap-1 font-body text-[12px]"
                    style={{ color: "#6B7280" }}
                  >
                    <X size={12} /> {t("health.scanWound.close")}
                  </button>
                </div>
              )}

              {/* ── History toggle ── */}
              <button
                data-testid="button-toggle-scan-history"
                onClick={() => setHistorialOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-[18px] py-[12px] transition-colors"
                style={{ borderTop: "1px solid #F5EFE4" }}
              >
                <History size={14} style={{ color: "#C9890A" }} />
                <span className="font-body text-[13px] font-medium flex-1 text-left" style={{ color: "#C9890A" }}>
                  Ver historial
                  {!pastScansLoading && pastScans.length > 0 && (
                    <span
                      className="ml-[6px] px-[7px] py-[1px] rounded-full font-body text-[11px] font-semibold"
                      style={{ background: "#FEF3C7", color: "#92400E" }}
                    >
                      {pastScans.length}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={14}
                  className="flex-shrink-0 transition-transform"
                  style={{ color: "#C9890A", transform: historialOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {/* ── Inline history list ── */}
              {historialOpen && (
                <div className="px-[14px] pb-[14px] flex flex-col gap-[10px]" style={{ borderTop: "1px solid #FEF3C7" }}>
                  <div className="pt-[10px]">
                    {pastScansLoading ? (
                      [1, 2].map((i) => <div key={i} className="h-[54px] rounded-[12px] bg-gray-100 animate-pulse mb-[10px]" />)
                    ) : pastScans.length === 0 ? (
                      <p className="font-body text-[13px] text-vyva-text-2 text-center py-4">Aún no hay escaneos guardados</p>
                    ) : (
                      pastScans.map((scan) => {
                        const colors = SCAN_SEVERITY_COLORS[scan.severity] ?? SCAN_SEVERITY_COLORS["Minor"];
                        const isExpanded = expandedScanId === scan.id;
                        const date = new Date(scan.scanned_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                        const dateTime = new Date(scan.scanned_at).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                        return (
                          <div key={scan.id} data-testid={`card-past-scan-${scan.id}`} className="rounded-[14px] overflow-hidden mb-[10px] last:mb-0" style={{ border: `1px solid ${isExpanded ? "#C4B5FD" : "#E5E7EB"}` }}>
                            <div
                              data-testid={`button-expand-scan-${scan.id}`}
                              role="button" tabIndex={0}
                              onClick={() => setExpandedScanId(isExpanded ? null : scan.id)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedScanId(isExpanded ? null : scan.id); } }}
                              className="w-full p-[12px] flex items-start gap-3 text-left transition-colors cursor-pointer select-none"
                              style={{ background: isExpanded ? "#F5F3FF" : "#F9FAFB" }}
                              aria-expanded={isExpanded}
                            >
                              {scan.image_data && (
                                <button
                                  data-testid={`button-fullscreen-scan-${scan.id}`}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setFullScreenScan(scan); }}
                                  className="flex-shrink-0 rounded-[10px] overflow-hidden focus:outline-none active:scale-95 transition-transform"
                                  style={{ width: 48, height: 48 }}
                                >
                                  <img src={scan.image_data} alt={scan.result_title} className="w-full h-full object-cover" style={{ border: "1px solid #E5E7EB" }} />
                                </button>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-[2px]">
                                  <span className="font-body text-[11px] font-semibold px-[8px] py-[2px] rounded-full flex-shrink-0" style={{ background: colors.bg, color: colors.text }}>
                                    {t(`health.scanWound.severityLabel.${scan.severity.toLowerCase()}`, scan.severity)}
                                  </span>
                                  <p className="font-body text-[13px] font-semibold text-vyva-text-1 truncate">{scan.result_title}</p>
                                </div>
                                <p className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>{date}</p>
                              </div>
                              <ChevronDown size={16} className="flex-shrink-0 mt-[2px] transition-transform" style={{ color: "#9CA3AF", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} />
                            </div>

                            {isExpanded && (
                              <div data-testid={`section-scan-advice-${scan.id}`} style={{ borderTop: "1px solid #EDE9FE", background: "#FAFAFA" }} className="px-[14px] py-[12px]">
                                <div className="flex items-center justify-between mb-[8px]">
                                  <p className="font-body text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#7C3AED" }}>{t("health.pastScans.aiAdvice", "AI Advice")}</p>
                                  <div className="flex items-center gap-[4px]">
                                    <Clock size={11} style={{ color: "#9CA3AF" }} />
                                    <p className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>{dateTime}</p>
                                  </div>
                                </div>
                                <p data-testid={`text-scan-advice-${scan.id}`} className="font-body text-[13px] text-vyva-text-1 leading-snug">{scan.advice}</p>
                                <div className="mt-[10px] flex items-center gap-[8px]">
                                  <button
                                    data-testid={`button-share-scan-${scan.id}`}
                                    onClick={async () => {
                                      const intro = t("health.pastScans.shareIntro", "My AI health scan says...");
                                      const text = `${intro} (${dateTime})\n\n${scan.advice}`;
                                      const confirmCopied = () => toast({ description: t("health.pastScans.copyAdviceDone", "Advice copied") });
                                      if (navigator.share) {
                                        try { await navigator.share({ title: t("health.pastScans.aiAdvice", "AI Advice"), text }); confirmCopied(); }
                                        catch (err: unknown) {
                                          if (err instanceof Error && err.name === "AbortError") return;
                                          try { await navigator.clipboard.writeText(text); confirmCopied(); } catch { }
                                        }
                                      } else {
                                        try { await navigator.clipboard.writeText(text); confirmCopied(); } catch { }
                                      }
                                    }}
                                    className="flex items-center gap-[5px] px-[10px] py-[5px] rounded-full transition-colors hover:bg-purple-50 active:scale-95"
                                    style={{ border: "1px solid #DDD6FE" }}
                                  >
                                    <Copy size={13} style={{ color: "#7C3AED" }} />
                                    <span className="font-body text-[12px]" style={{ color: "#7C3AED" }}>{t("health.pastScans.shareAdvice", "Compartir")}</span>
                                  </button>
                                  <button
                                    data-testid={`button-delete-scan-${scan.id}`}
                                    onClick={() => deleteScanMutation.mutate(scan.id)}
                                    disabled={deleteScanMutation.isPending}
                                    className="flex items-center gap-[5px] px-[10px] py-[5px] rounded-full transition-colors hover:bg-red-50 active:scale-95"
                                    style={{ border: "1px solid #FECACA" }}
                                  >
                                    <Trash2 size={13} style={{ color: "#EF4444" }} />
                                    <span className="font-body text-[12px]" style={{ color: "#EF4444" }}>{t("health.pastScans.delete", "Eliminar")}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Encontrar especialista */}
            <div
              className="vyva-card overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center gap-3 px-[18px] py-[16px]">
                <div className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: "#F5F3FF" }}>
                  <UserSearch size={24} style={{ color: "#7C3AED" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-semibold text-vyva-text-1">Encontrar especialista</p>
                  <p className="font-body text-[12px] text-vyva-text-2">Médicos cerca de ti</p>
                </div>
                <button
                  data-testid="button-find-specialist"
                  onClick={() => { setSpecialistOpen((v) => !v); setSpecialistResult(null); }}
                  className="vyva-tap flex-shrink-0 rounded-full px-[16px] py-[8px] font-body text-[14px] font-semibold transition-all inline-flex items-center gap-2"
                  style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                >
                  {specialistOpen ? (
                    <>
                      Ocultar
                      <ChevronUp size={16} />
                    </>
                  ) : (
                    "Ver opciones"
                  )}
                </button>
              </div>

              {specialistOpen && (
                <div className="px-[18px] pb-[16px]" style={{ borderTop: "1px solid #F5F3FF" }}>
                  <div className="flex items-start justify-between gap-3 pt-[14px]">
                    <p className="font-body text-[15px] leading-relaxed text-vyva-text-2">
                      Describe la condicion o preocupacion. VYVA buscara el tipo de especialista adecuado y opciones cercanas.
                    </p>
                    <button
                      data-testid="button-reset-specialist-search"
                      type="button"
                      onClick={resetSpecialistSearch}
                      className="vyva-tap flex-shrink-0 rounded-full px-[10px] py-[6px] font-body text-[12px] font-semibold"
                      style={{ background: "#FFFFFF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                    >
                      Reiniciar
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-[12px] pb-[8px]">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#7C3AED" }}>
                      Sugerencias para ti
                    </p>
                    <button
                      data-testid="button-refresh-specialist-examples"
                      type="button"
                      onClick={() => setSpecialistExamplePage((page) => page + 1)}
                      className="vyva-tap inline-flex items-center gap-1 rounded-full px-[10px] py-[6px] font-body text-[12px] font-semibold"
                      style={{ background: "#FFFFFF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                    >
                      <RefreshCw size={13} />
                      Más
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pb-[10px]">
                    {specialistExamples.map((example) => (
                      <button
                        key={example}
                        data-testid={`chip-specialist-example-${example}`}
                        onClick={() => setSpecialistCondition(example)}
                        className="vyva-tap rounded-full px-[14px] py-[8px] font-body text-[14px] font-medium transition-colors"
                        style={{ background: "#EDE9FE", color: "#7C3AED" }}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      data-testid="button-specialist-voice-search"
                      onClick={specialistVoiceListening ? stopSpecialistVoice : startSpecialistVoice}
                      disabled={specialistMutation.isPending}
                      className={`vyva-tap flex w-full items-center justify-center gap-2 rounded-[18px] px-[14px] py-[13px] font-body text-[15px] font-semibold transition-all ${specialistVoiceListening ? "mic-pulse-listening" : ""}`}
                      style={{
                        background: specialistVoiceListening ? "#ECFDF5" : "#F5F3FF",
                        color: specialistVoiceListening ? "#0A7C4E" : "#7C3AED",
                        border: specialistVoiceListening ? "1px solid #6EE7B7" : "1px solid #DDD6FE",
                      }}
                    >
                      {specialistVoiceListening ? <Square size={16} /> : <Mic size={16} />}
                      {specialistVoiceListening ? "Escuchando..." : "Buscar por voz"}
                    </button>
                    <input
                      data-testid="input-specialist-condition"
                      value={specialistCondition}
                      onChange={(e) => setSpecialistCondition(e.target.value)}
                      placeholder="Ej. dolor de rodilla, diabetes, memoria..."
                      className="w-full rounded-[16px] px-[16px] py-[13px] font-body text-[16px] outline-none"
                      style={{ border: "1px solid #DDD6FE", background: "#FFFFFF", color: "#2F2925" }}
                    />
                    <input
                      data-testid="input-specialist-location"
                      value={specialistLocation}
                      onChange={(e) => {
                        setSpecialistLocationEdited(true);
                        setSpecialistLocation(e.target.value);
                      }}
                      placeholder={profileLocation || "Ciudad o zona"}
                      className="w-full rounded-[16px] px-[16px] py-[13px] font-body text-[16px] outline-none"
                      style={{ border: "1px solid #EDE5DB", background: "#FFFFFF", color: "#2F2925" }}
                    />
                    <button
                      data-testid="button-run-specialist-search"
                      onClick={() => runSpecialistSearch()}
                      disabled={specialistMutation.isPending}
                      className="vyva-primary-action w-full"
                      style={{ background: "#7C3AED", color: "#FFFFFF" }}
                    >
                      {specialistMutation.isPending ? "Buscando especialistas..." : "Buscar especialistas"}
                    </button>
                  </div>

                  {specialistResult && (
                    <div className="mt-[12px] flex flex-col gap-2">
                      <div className="rounded-[14px] px-[14px] py-[11px]" style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
                        <p className="font-body text-[12px] font-semibold" style={{ color: "#6D28D9" }}>
                          Especialidades recomendadas
                        </p>
                        <p className="font-body text-[14px] font-semibold text-vyva-text-1">
                          {specialistResult.matchedSpecialties.map((specialty) => displaySpecialtyText(specialty, specialistLanguage)).join(", ")}
                        </p>
                        <p className="font-body text-[11px] text-vyva-text-2 leading-snug mt-[6px]">
                          Esto no es un diagnostico. Si los sintomas son graves o repentinos, llama a emergencias o a tu medico.
                        </p>
                      </div>
                      {specialistResult.providers.length === 0 ? (
                        <div className="rounded-[16px] px-[14px] py-[14px]" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                          <p className="font-body text-[16px] font-semibold leading-tight text-vyva-text-1">
                            No he encontrado proveedores verificados con datos suficientes ahora mismo.
                          </p>
                          <p className="mt-2 font-body text-[13px] leading-snug text-vyva-text-2">
                            Puedes probar otra ciudad o abrir Google Maps para buscar opciones cerca.
                          </p>
                          <button
                            data-testid="button-open-specialist-maps-search"
                            onClick={() => {
                              const query = specialistResult.mapsSearchUrl
                                ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${displaySpecialtyText(specialistResult.matchedSpecialties[0] ?? "medico", specialistLanguage)} ${specialistLocation || profileLocation}`)}`;
                              window.open(query, "_blank", "noopener,noreferrer");
                            }}
                            className="mt-[12px] min-h-[44px] rounded-full px-[16px] font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                            style={{ background: "#7C3AED", color: "#FFFFFF" }}
                          >
                            <MapPin size={15} />
                            Abrir Google Maps
                          </button>
                        </div>
                      ) : specialistResult.providers.map((spec, i) => {
                        const location = spec.address ?? spec.clinicName ?? specialistLocation;
                        const actionColumns = spec.mapsUrl ? "grid-cols-3" : "grid-cols-2";

                        return (
                        <div key={`${spec.name}-${i}`} className="rounded-[16px] px-[14px] py-[13px]" style={{ background: "#F9F6F2", border: "1px solid #EDE5DB" }}>
                          <div className="flex items-start gap-3">
                            <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EDE9FE" }}>
                              <UserSearch size={17} style={{ color: "#7C3AED" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-body text-[16px] font-semibold text-vyva-text-1 leading-tight">{spec.name}</p>
                              <p className="font-body text-[13px] font-semibold mt-[2px]" style={{ color: "#7C3AED" }}>{displaySpecialty(spec, specialistLanguage)}</p>
                            </div>
                          </div>

                          <div className="mt-[10px] grid gap-2">
                            {spec.phone && (
                              <div className="flex items-start gap-2 font-body text-[13px] text-vyva-text-2 leading-snug">
                                <Phone size={14} className="mt-[2px] flex-shrink-0" style={{ color: "#7C3AED" }} />
                                <span>{spec.phone}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-2 font-body text-[13px] text-vyva-text-2 leading-snug">
                              <MapPin size={14} className="mt-[2px] flex-shrink-0" style={{ color: "#7C3AED" }} />
                              <span>{location}</span>
                            </div>
                            {spec.openingTimes && (
                              <div className="flex items-start gap-2 font-body text-[13px] text-vyva-text-2 leading-snug">
                                <Clock size={14} className="mt-[2px] flex-shrink-0" style={{ color: "#7C3AED" }} />
                                <span>{spec.openingTimes}</span>
                              </div>
                            )}
                            {spec.distanceLabel && (
                              <div className="flex items-start gap-2 font-body text-[13px] text-vyva-text-2 leading-snug">
                                <MapPin size={14} className="mt-[2px] flex-shrink-0" style={{ color: "#059669" }} />
                                <span>{spec.distanceLabel}</span>
                              </div>
                            )}
                            {spec.reviewScore && (
                              <div className="flex items-center gap-1 font-body text-[12px] text-vyva-text-2">
                                <Star size={12} fill="#F59E0B" style={{ color: "#F59E0B" }} />
                                <span>{spec.reviewScore}{spec.reviewCount ? ` (${spec.reviewCount})` : ""}</span>
                              </div>
                            )}
                          </div>

                          <div className={`mt-[12px] grid ${actionColumns} gap-2`}>
                            <button
                              data-testid={`button-book-specialist-${i}`}
                              onClick={() => contactSpecialist(spec)}
                              disabled={bookSpecialistMutation.isPending}
                              className="min-h-[44px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                              style={{ background: "#7C3AED", color: "#FFFFFF" }}
                            >
                              <Phone size={15} />
                              Contactar
                            </button>
                            {spec.mapsUrl && (
                              <button
                                data-testid={`button-map-specialist-${i}`}
                                onClick={() => window.open(spec.mapsUrl!, "_blank", "noopener,noreferrer")}
                                className="min-h-[44px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                                style={{ background: "#F0FDF4", color: "#047857", border: "1px solid #BBF7D0" }}
                              >
                                <MapPin size={15} />
                                Mapa
                              </button>
                            )}
                            <button
                              data-testid={`button-share-specialist-${i}`}
                              onClick={() => shareSpecialistProvider(spec)}
                              className="min-h-[44px] rounded-full font-body text-[14px] font-semibold flex items-center justify-center gap-2"
                              style={{ background: "#FFFFFF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                            >
                              <Share2 size={15} />
                              Compartir
                            </button>
                          </div>

                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Hidden file input for wound scan */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleWoundSelect}
        data-testid="input-wound-photo"
      />

      {/* Full-screen scan image modal */}
      {fullScreenScan && (
        <ScanFullScreenModal scan={fullScreenScan} onClose={() => setFullScreenScan(null)} t={t} />
      )}
    </>
  );
};

export default HealthScreen;
