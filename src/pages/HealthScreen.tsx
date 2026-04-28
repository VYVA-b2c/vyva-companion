import { useState, useRef, useEffect, CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Stethoscope,
  Camera,
  UserSearch,
  Video,
  Phone,
  ChevronDown,
  ChevronRight,
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
  sourceName: string;
  reviewScore?: number | null;
  reviewCount?: number | null;
  distanceLabel?: string | null;
  availabilityText?: string | null;
  rationale: string;
  score: number;
};

type SpecialistRecommendation = {
  condition: string;
  matchedSpecialties: string[];
  safetyNote: string;
  providers: SpecialistProvider[];
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
const SPECIALIST_EXAMPLES = ["dolor de rodilla", "problemas de memoria", "diabetes", "mancha en la piel"];

const SPECIALTY_LABELS_ES: Record<string, string> = {
  Dermatology: "Dermatologia",
  Neurology: "Neurologia",
  Geriatrics: "Geriatria",
  Neuropsychology: "Neuropsicologia",
  Endocrinology: "Endocrinologia",
  Cardiology: "Cardiologia",
  "Traumatology / Orthopaedics": "Traumatologia / Ortopedia",
  Physiotherapy: "Fisioterapia",
  Rheumatology: "Reumatologia",
  "Internal Medicine": "Medicina interna",
  "General Practice": "Medicina general",
};

function displaySpecialty(provider: SpecialistProvider, language: string): string {
  if (provider.specialtyLabel) return provider.specialtyLabel;
  if (language.split("-")[0].toLowerCase() === "es") {
    return SPECIALTY_LABELS_ES[provider.specialty] ?? provider.specialty;
  }
  return provider.specialty;
}

const DAILY_TIPS = [
  { emoji: "💧", badge: "Hidratación",  tip: "Bebe un vaso de agua ahora mismo. Tu cuerpo lo agradece y tu energía mejora." },
  { emoji: "🚶", badge: "Movimiento",   tip: "10 minutos caminando después de comer regulan el azúcar en sangre y mejoran tu digestión." },
  { emoji: "🫁", badge: "Bienestar",    tip: "5 minutos de respiración profunda activan la relajación y reducen el estrés acumulado." },
  { emoji: "😴", badge: "Descanso",     tip: "Dormir entre 7 y 8 horas refuerza tu sistema inmune y mejora tu estado de ánimo." },
  { emoji: "🥗", badge: "Nutrición",    tip: "Incluye verduras de varios colores en tu próxima comida — cada uno aporta nutrientes distintos." },
  { emoji: "☀️", badge: "Bienestar",    tip: "15 minutos al aire libre mejoran tu vitamina D y elevan tu bienestar emocional." },
  { emoji: "🧠", badge: "Mente activa", tip: "Un juego de memoria o un crucigrama mantiene tu mente activa y alerta." },
];

function getDailyTip() {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return DAILY_TIPS[seed % DAILY_TIPS.length];
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
  const { firstName } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [seeDoctorOpen,    setSeeDoctorOpen]    = useState(false);
  const [specialistOpen,   setSpecialistOpen]   = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [specialistCondition, setSpecialistCondition] = useState("");
  const [specialistLocation, setSpecialistLocation] = useState("Tarifa, Cadiz");
  const [specialistResult, setSpecialistResult] = useState<SpecialistRecommendation | null>(null);
  const [specialistVoiceListening, setSpecialistVoiceListening] = useState(false);
  const [historialOpen,    setHistorialOpen]    = useState(false);
  const [expandedScanId,   setExpandedScanId]   = useState<string | null>(null);
  const [fullScreenScan,   setFullScreenScan]   = useState<WoundScan | null>(null);
  const [woundAnalyzing,   setWoundAnalyzing]   = useState(false);
  const [woundResult,      setWoundResult]      = useState<null | { severity: string; resultTitle: string; advice: string }>(null);
  const [vyvaExpanded,     setVyvaExpanded]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specialistRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const dailyTip = getDailyTip();

  const headlineText = firstName
    ? `Todo en orden hoy, ${firstName}`
    : "Todo en orden hoy";

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
      const location = input?.location ?? specialistLocation;
      const res = await apiFetch("/api/specialists/recommendations", {
        method: "POST",
        body: JSON.stringify({
          condition,
          location,
          language: i18n.language || "es",
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
    specialistMutation.mutate({ condition: trimmedCondition, location: specialistLocation });
  };

  const stopSpecialistVoice = () => {
    specialistRecognitionRef.current?.stop();
    specialistRecognitionRef.current = null;
    setSpecialistVoiceListening(false);
  };

  const startSpecialistVoice = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      toast({ description: "Tu navegador no permite dictado por voz aqui. Puedes escribir la condicion." });
      return;
    }

    const recognition = new Recognition();
    recognition.lang = i18n.language?.startsWith("en") ? "en-US" : i18n.language?.startsWith("de") ? "de-DE" : "es-ES";
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
      const specialty = displaySpecialty(provider, i18n.language || "es");
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
          language: i18n.language || "es",
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
    { id: "sintomas",   Icon: HeartPulse,    iconBg: "#F5F3FF", iconColor: "#7C3AED", label: "Síntomas",    hint: "¿Cómo te encuentras?", action: () => navigate("/health/symptom-check") },
    { id: "medicacion", Icon: Pill,          iconBg: "#FDF4FF", iconColor: "#86198F", label: "Medicación",  hint: "Mis pastillas",         action: () => navigate("/meds") },
    { id: "signos",     Icon: Activity,      iconBg: "#FFF1F2", iconColor: "#BE123C", label: "Estado",      hint: "Seguimiento en tiempo real", action: () => navigate("/health/vitals") },
    { id: "historial",  Icon: ClipboardList, iconBg: "#EFF6FF", iconColor: "#1D4ED8", label: "Mis informes", hint: "Resumen de tu salud", action: () => navigate("/informes") },
  ];

  const VYVA_CAPS = [
    { emoji: "💊", label: "Medicación",        action: () => navigate("/meds") },
    { emoji: "❤️", label: "Signos vitales",     action: () => navigate("/health/vitals") },
    { emoji: "🩺", label: "Síntomas",           action: () => navigate("/health/symptom-check") },
    { emoji: "🩹", label: "Piel y heridas",     action: () => fileInputRef.current?.click() },
    { emoji: "🥗", label: "Nutrición",          action: () => toast({ description: "Nutrición — próximamente" }) },
    { emoji: "📚", label: "Información médica", action: () => navigate("/chat") },
  ];

  return (
    <>
      <div className="px-[22px] pb-8">

        {/* ── 1. Hero ── */}
        <VoiceHero
          sourceText={t("health.voiceSource")}
          headline={<>{headlineText}</>}
          contextHint="health symptoms"
        >
          <div
            className="mt-[14px] pt-[14px] flex justify-between"
            style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}
          >
            {[
              { val: t("health.statNormal"), label: t("health.bloodPressure") },
              { val: t("health.statGood"),   label: t("health.mood") },
              { val: "7h 20m",               label: t("health.sleep") },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-body text-[17px] font-medium text-white">{s.val}</p>
                <p className="font-body text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          <button
            data-testid="button-hero-revisar"
            onClick={() => navigate("/health/symptom-check")}
            className="mt-[14px] w-full py-[11px] rounded-full font-body text-[14px] font-semibold transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.18)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.28)" }}
          >
            Revisar cómo me siento
          </button>
        </VoiceHero>

        {/* ── 2. Acceso rápido (2×2 grid) ── */}
        <div className="mt-[22px]">
          <p className="font-body text-[15px] font-semibold tracking-wider text-vyva-text-2 mb-3">
            Acceso rápido
          </p>
          <div className="grid grid-cols-2 gap-[10px]">
            {QUICK_TILES.map((tile) => (
              <button
                key={tile.id}
                data-testid={`button-health-quick-${tile.id}`}
                onClick={tile.action}
                className="min-w-0 flex flex-col items-center gap-2 bg-white rounded-[22px] px-4 py-3.5 border border-vyva-border transition-all active:scale-[0.975]"
                style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
              >
                <div
                  className="w-[54px] h-[54px] rounded-[16px] flex items-center justify-center flex-shrink-0"
                  style={{ background: tile.iconBg }}
                >
                  <tile.Icon size={26} style={{ color: tile.iconColor }} />
                </div>
                <span className="font-body text-[15px] font-semibold text-vyva-text-1 leading-tight text-center">
                  {tile.label}
                </span>
                <span className="font-body text-[12px] text-vyva-text-2 leading-tight text-center">
                  {tile.hint}
                </span>
              </button>
            ))}
          </div>
        </div>


        {/* ── 3. Acciones rápidas ── */}
        <div className="mt-[24px]">
          <p className="font-body text-[15px] font-semibold tracking-wider text-vyva-text-2 mb-3">
            Acciones rápidas
          </p>

          <div className="flex flex-col gap-[10px]">

            {/* Ver a un médico */}
            <div
              className="rounded-[20px] overflow-hidden"
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
                  className="flex-shrink-0 px-[16px] py-[8px] rounded-full font-body text-[13px] font-semibold transition-all active:scale-95"
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
              className="rounded-[20px] overflow-hidden"
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
                  className="flex-shrink-0 px-[16px] py-[8px] rounded-full font-body text-[13px] font-semibold transition-all active:scale-95"
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
              className="rounded-[20px] overflow-hidden"
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
                  className="flex-shrink-0 px-[16px] py-[8px] rounded-full font-body text-[13px] font-semibold transition-all active:scale-95"
                  style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                >
                  Ver opciones
                </button>
              </div>

              {specialistOpen && (
                <div className="px-[18px] pb-[16px]" style={{ borderTop: "1px solid #F5F3FF" }}>
                  <p className="font-body text-[13px] text-vyva-text-2 leading-snug pt-[14px]">
                    Describe la condicion o preocupacion. VYVA buscara el tipo de especialista adecuado y opciones cercanas.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-[12px] pb-[10px]">
                    {SPECIALIST_EXAMPLES.map((example) => (
                      <button
                        key={example}
                        data-testid={`chip-specialist-example-${example}`}
                        onClick={() => setSpecialistCondition(example)}
                        className="px-[12px] py-[6px] rounded-full font-body text-[13px] font-medium transition-colors"
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
                      className={`w-full flex items-center justify-center gap-2 rounded-[16px] px-[14px] py-[12px] font-body text-[14px] font-semibold transition-all active:scale-95 ${specialistVoiceListening ? "mic-pulse-listening" : ""}`}
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
                      className="w-full rounded-[14px] px-[14px] py-[11px] font-body text-[14px] outline-none"
                      style={{ border: "1px solid #DDD6FE", background: "#FFFFFF", color: "#2F2925" }}
                    />
                    <input
                      data-testid="input-specialist-location"
                      value={specialistLocation}
                      onChange={(e) => setSpecialistLocation(e.target.value)}
                      placeholder="Ciudad o zona"
                      className="w-full rounded-[14px] px-[14px] py-[11px] font-body text-[14px] outline-none"
                      style={{ border: "1px solid #EDE5DB", background: "#FFFFFF", color: "#2F2925" }}
                    />
                    <button
                      data-testid="button-run-specialist-search"
                      onClick={runSpecialistSearch}
                      disabled={specialistMutation.isPending}
                      className="w-full px-[14px] py-[11px] rounded-full font-body text-[14px] font-semibold transition-all active:scale-95 disabled:opacity-60"
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
                          {specialistResult.matchedSpecialties.join(", ")}
                        </p>
                        <p className="font-body text-[11px] text-vyva-text-2 leading-snug mt-[6px]">
                          Esto no es un diagnostico. Si los sintomas son graves o repentinos, llama a emergencias o a tu medico.
                        </p>
                      </div>
                      {specialistResult.providers.map((spec, i) => (
                        <div key={`${spec.name}-${i}`} className="flex items-start gap-3 rounded-[12px] px-[14px] py-[11px]" style={{ background: "#F9F6F2", border: "1px solid #EDE5DB" }}>
                          <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EDE9FE" }}>
                            <UserSearch size={16} style={{ color: "#7C3AED" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-body text-[14px] font-semibold text-vyva-text-1">{spec.name}</p>
                            <p className="font-body text-[12px] font-medium" style={{ color: "#7C3AED" }}>{displaySpecialty(spec, i18n.language || "es")}</p>
                            <p className="font-body text-[12px] text-vyva-text-2 leading-snug">{spec.address ?? spec.clinicName}</p>
                            <div className="flex items-center gap-1 mt-[4px]">
                              <Star size={10} fill="#F59E0B" style={{ color: "#F59E0B" }} />
                              <span className="font-body text-[12px] text-vyva-text-2">
                                {spec.reviewScore ? `${spec.reviewScore} · ` : ""}{spec.availabilityText ?? "Consultar disponibilidad"}
                              </span>
                            </div>
                            <p className="font-body text-[11px] text-vyva-text-2 leading-snug mt-[5px]">{spec.rationale}</p>
                          </div>
                          <button
                            data-testid={`button-book-specialist-${i}`}
                            onClick={() => bookSpecialistMutation.mutate(spec)}
                            disabled={bookSpecialistMutation.isPending}
                            className="px-[12px] py-[6px] rounded-full font-body text-[12px] font-semibold flex-shrink-0 disabled:opacity-60"
                            style={{ background: "#EDE9FE", color: "#7C3AED" }}
                          >
                            Reservar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. Hoy para ti ── */}
        <div className="mt-[24px]">
          <p className="font-body text-[15px] font-semibold tracking-wider text-vyva-text-2 mb-3">
            Hoy para ti
          </p>
          <div
            className="rounded-[22px] px-[20px] py-[20px] flex flex-col gap-3"
            style={{ background: "#F5F3FF", border: "1px solid rgba(124,58,237,0.10)", boxShadow: "0 2px 12px rgba(124,58,237,0.07)" }}
          >
            <div className="flex items-center justify-between">
              <span
                className="font-body text-[12px] font-semibold px-[10px] py-[4px] rounded-full"
                style={{ background: "#EDE9FE", color: "#6D28D9" }}
              >
                {dailyTip.badge}
              </span>
              <span className="text-[28px]" aria-hidden="true">{dailyTip.emoji}</span>
            </div>
            <p className="font-body text-[16px] font-semibold text-vyva-text-1 leading-[1.4]">
              {dailyTip.tip}
            </p>
          </div>
        </div>

        {/* ── 5. VYVA puede ayudarte con ── */}
        <div className="mt-[16px]">
          <button
            data-testid="button-vyva-capabilities"
            onClick={() => setVyvaExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-[20px] py-[16px] rounded-[20px] transition-all active:scale-[0.98]"
            style={{ background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
          >
            <p className="font-body text-[15px] font-semibold text-vyva-text-1">VYVA puede ayudarte con</p>
            <ChevronDown
              size={18}
              className="text-vyva-text-2 transition-transform flex-shrink-0"
              style={{ transform: vyvaExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {vyvaExpanded && (
            <div className="mt-[8px] grid grid-cols-2 gap-[8px]">
              {VYVA_CAPS.map((cap) => (
                <button
                  key={cap.label}
                  data-testid={`button-vyva-cap-${cap.label}`}
                  onClick={cap.action}
                  className="flex items-center gap-[10px] bg-white rounded-[16px] px-[14px] py-[12px] border border-vyva-border transition-all active:scale-[0.975]"
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
                >
                  <span className="text-[20px]" aria-hidden="true">{cap.emoji}</span>
                  <span className="font-body text-[13px] font-medium text-vyva-text-1 text-left leading-tight">{cap.label}</span>
                </button>
              ))}
            </div>
          )}
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
