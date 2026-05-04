import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import {
  ChevronLeft,
  Heart,
  Wind,
  Activity,
  Watch,
  Stethoscope,
  Plus,
  ChevronDown,
  ChevronUp,
  Share2,
  Phone,
  ClipboardList,
  Users,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import VoiceHero from "@/components/VoiceHero";
import { useToast } from "@/hooks/use-toast";

const METRIC_META = {
  hr: {
    id: "hr",
    Icon: Heart,
    iconColor: "#BE123C",
    iconBg: "#FFF1F2",
    label: "Frecuencia cardíaca",
    unit: "bpm",
    placeholder: "ej. 72",
    defaultStatus: "Normal",
    statusColor: "#16A34A",
    statusBg: "#F0FDF4",
  },
  rr: {
    id: "rr",
    Icon: Wind,
    iconColor: "#0369A1",
    iconBg: "#EFF6FF",
    label: "Frecuencia respiratoria",
    unit: "rpm",
    placeholder: "ej. 16",
    defaultStatus: "Estable",
    statusColor: "#1D4ED8",
    statusBg: "#EFF6FF",
  },
  bp: {
    id: "bp",
    Icon: Activity,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
    label: "Presión arterial",
    unit: "mmHg",
    placeholder: "ej. 118/76",
    defaultStatus: "Normal",
    statusColor: "#16A34A",
    statusBg: "#F0FDF4",
  },
} as const;

type MetricType = keyof typeof METRIC_META;

const DEVICES = [
  { id: "watch", Icon: Watch, label: "Smartwatch", model: "VYVA Band 2", connected: true },
  { id: "bp-cuff", Icon: Activity, label: "Tensiómetro", model: "OmronConnect", connected: true },
  { id: "stethoscope", Icon: Stethoscope, label: "Estetoscopio digital", model: "Eko DUO", connected: false },
];

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

interface VitalsSummaryEntry {
  latest_value: string | null;
  latest_recorded_at: string | null;
  trend: (string | null)[];
  has_data: boolean;
}

interface VitalsResponse {
  summary: Record<string, VitalsSummaryEntry>;
  compliance_days: boolean[];
}

function parseNumericValue(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.split("/")[0]);
  return isNaN(n) ? null : n;
}

function buildTrend(trend: (string | null)[]): number[] {
  const numeric = trend.map((v) => parseNumericValue(v) ?? 0);
  return numeric;
}

function formatRecordedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 24) {
    return `Hoy, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diffH < 48) return "Ayer";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-[3px] h-[36px] mt-3">
      {values.map((v, i) => {
        const height = Math.round(((v - min) / range) * 28) + 8;
        return (
          <div
            key={i}
            style={{
              height,
              flex: 1,
              borderRadius: 3,
              background: i === values.length - 1 ? "#6B21A8" : "hsl(var(--vyva-warm2))",
              opacity: i === values.length - 1 ? 1 : 0.6,
            }}
          />
        );
      })}
    </div>
  );
}

function MetricCard({
  metricKey,
  summary,
}: {
  metricKey: MetricType;
  summary: VitalsSummaryEntry | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = METRIC_META[metricKey];
  const { Icon, iconColor, iconBg, label, unit, statusColor, statusBg, defaultStatus } = meta;

  const hasData = summary?.has_data === true;
  const displayValue = hasData ? (summary?.latest_value ?? "—") : "—";
  const trend = buildTrend(summary?.trend ?? Array(7).fill(null));
  const hasTrendData = hasData && trend.some((v) => v > 0);

  return (
    <div
      className="bg-white rounded-[18px] p-4 transition-all"
      style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>
          <div>
            <p className="font-body text-[12px] text-vyva-text-2">{label}</p>
            <p className="font-body text-[22px] font-bold text-vyva-text-1 leading-tight">
              {displayValue === "—"
                ? <span className="text-vyva-text-2 font-normal text-[16px]">Sin datos</span>
                : (
                  <>
                    {displayValue}
                    <span className="text-[13px] font-normal ml-1 text-vyva-text-2">{unit}</span>
                  </>
                )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <span
              className="font-body text-[11px] font-semibold px-[10px] py-[3px] rounded-full"
              style={{ color: statusColor, background: statusBg }}
            >
              {defaultStatus}
            </span>
          )}
          {hasTrendData && (
            <button
              onClick={() => setExpanded((v) => !v)}
              data-testid={`button-metric-expand-${metricKey}`}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "hsl(var(--vyva-warm))" }}
              aria-label={expanded ? "Contraer tendencia" : "Ver tendencia"}
            >
              {expanded
                ? <ChevronUp size={16} className="text-vyva-text-2" />
                : <ChevronDown size={16} className="text-vyva-text-2" />}
            </button>
          )}
        </div>
      </div>

      {expanded && hasTrendData && (
        <div className="mt-2 pt-3 border-t border-vyva-warm">
          <p className="font-body text-[11px] text-vyva-text-2 mb-1">Últimos 7 días</p>
          <MiniBarChart values={trend} />
        </div>
      )}
    </div>
  );
}

function EventDot({ level }: { level: string }) {
  const colors: Record<string, string> = {
    amber: "#D97706",
    green: "#16A34A",
    neutral: "#9CA3AF",
  };
  return (
    <div
      className="w-2 h-2 rounded-full mt-[6px] flex-shrink-0"
      style={{ background: colors[level] ?? "#9CA3AF" }}
    />
  );
}

function LogReadingModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [metricType, setMetricType] = useState<MetricType>("hr");
  const [value, setValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/vitals", {
        method: "POST",
        body: JSON.stringify({ metric_type: metricType, value: value.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
      toast({ title: "Lectura guardada", description: "El dato vital ha sido registrado correctamente." });
      onSaved();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar la lectura. Inténtalo de nuevo.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!value.trim()) return;
    mutation.mutate();
  };

  const meta = METRIC_META[metricType];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-t-[24px] bg-white px-5 pt-5 pb-8"
        style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.12)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="font-display italic text-[18px] text-vyva-text-1">Registrar lectura</p>
          <button
            onClick={onClose}
            data-testid="button-close-log-modal"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "hsl(var(--vyva-warm))" }}
          >
            <X size={16} className="text-vyva-text-2" />
          </button>
        </div>

        <p className="font-body text-[12px] text-vyva-text-2 mb-2 font-semibold uppercase tracking-wide">
          Tipo de medición
        </p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {(Object.keys(METRIC_META) as MetricType[]).map((key) => {
            const m = METRIC_META[key];
            const active = metricType === key;
            return (
              <button
                key={key}
                onClick={() => { setMetricType(key); setValue(""); }}
                data-testid={`button-metric-select-${key}`}
                className="flex flex-col items-center gap-1 py-3 rounded-[14px] transition-all"
                style={{
                  background: active ? "#6B21A8" : "hsl(var(--vyva-warm))",
                }}
              >
                <m.Icon size={16} style={{ color: active ? "#fff" : m.iconColor }} />
                <span
                  className="font-body text-[10px] font-semibold text-center leading-tight"
                  style={{ color: active ? "#fff" : "#6B21A8" }}
                >
                  {m.unit}
                </span>
              </button>
            );
          })}
        </div>

        <p className="font-body text-[12px] text-vyva-text-2 mb-2 font-semibold uppercase tracking-wide">
          Valor ({meta.unit})
        </p>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={meta.placeholder}
          data-testid="input-vitals-value"
          className="w-full rounded-[14px] px-4 py-[14px] font-body text-[18px] text-vyva-text-1 font-bold outline-none border-2 border-transparent focus:border-[#6B21A8] mb-5"
          style={{ background: "hsl(var(--vyva-warm))" }}
        />

        <button
          onClick={handleSubmit}
          disabled={!value.trim() || mutation.isPending}
          data-testid="button-save-vital"
          className="w-full flex items-center justify-center gap-2 py-[14px] rounded-[14px] transition-all active:scale-[0.98] min-h-[52px] disabled:opacity-50"
          style={{ background: "#6B21A8" }}
        >
          <span className="font-body text-[14px] font-semibold text-white">
            {mutation.isPending ? "Guardando…" : "Guardar lectura"}
          </span>
        </button>
      </div>
    </div>
  );
}

const SignosScreen = () => {
  const navigate = useNavigate();
  const [showLogModal, setShowLogModal] = useState(false);

  const { data: vitalsData, isLoading } = useQuery<VitalsResponse>({
    queryKey: ["/api/vitals"],
  });

  const complianceDays = vitalsData?.compliance_days ?? Array(7).fill(false) as boolean[];
  const filledDays = complianceDays.filter(Boolean).length;

  const summary = vitalsData?.summary;

  const latestReadingAt = (() => {
    if (!summary) return null;
    const dates = (Object.values(summary) as VitalsSummaryEntry[])
      .map((s) => s.latest_recorded_at)
      .filter(Boolean) as string[];
    if (!dates.length) return null;
    return dates.sort().reverse()[0];
  })();

  const subtitleText = latestReadingAt
    ? `Última lectura: ${formatRecordedAt(latestReadingAt)}`
    : "Última lectura: —";

  return (
    <div className="px-[18px] pb-10">
      <div className="flex items-center gap-2 mt-1 mb-1">
        <button
          onClick={() => navigate("/health")}
          data-testid="button-signos-back"
          className="w-12 h-12 rounded-full flex items-center justify-center transition-colors active:scale-95"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
          aria-label="Volver"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <h2 className="font-display italic text-[22px] text-vyva-text-1">Signos vitales</h2>
      </div>

      <VoiceHero
        headline="Monitorización activa"
        subtitle={subtitleText}
        contextHint="signos vitales monitorización"
        talkLabel="Scan my Vitals"
      >
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/15">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#34D399" }} />
            <span className="font-body text-[12px]" style={{ color: "rgba(255,255,255,0.82)" }}>
              3 dispositivos activos
            </span>
          </div>
          <div className="w-[1px] h-[14px]" style={{ background: "rgba(255,255,255,0.2)" }} />
          <span className="font-body text-[12px]" style={{ color: "rgba(255,255,255,0.82)" }}>
            {filledDays}/7 días
          </span>
        </div>
      </VoiceHero>

      <div
        className="bg-white rounded-[18px] p-4 mb-4 mt-5 flex items-center gap-4"
        style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
        data-testid="card-general-status"
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#F0FDF4" }}
        >
          <CheckCircle2 size={22} style={{ color: "#16A34A" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[13px] text-vyva-text-2">Estado general</p>
          <p className="font-body text-[16px] font-semibold text-vyva-text-1 leading-snug">
            Estable · Sin cambios relevantes
          </p>
        </div>
        <span
          className="font-body text-[11px] font-bold px-[10px] py-[3px] rounded-full flex-shrink-0"
          style={{ color: "#16A34A", background: "#DCFCE7" }}
        >
          Bueno
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="font-body text-[13px] font-semibold text-vyva-text-2 uppercase tracking-wide">
          Métricas clave
        </p>
        <button
          onClick={() => setShowLogModal(true)}
          data-testid="button-log-reading"
          className="flex items-center gap-1.5 px-3 py-[6px] rounded-full transition-all active:scale-95"
          style={{ background: "#6B21A8" }}
        >
          <Plus size={13} className="text-white" />
          <span className="font-body text-[12px] font-semibold text-white">Registrar</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        {isLoading
          ? (["hr", "rr", "bp"] as MetricType[]).map((key) => (
              <div
                key={key}
                className="bg-white rounded-[18px] p-4 h-[72px] animate-pulse"
                style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
              />
            ))
          : (["hr", "rr", "bp"] as MetricType[]).map((key) => (
              <MetricCard key={key} metricKey={key} summary={summary?.[key]} />
            ))}
      </div>

      <p className="font-body text-[13px] font-semibold text-vyva-text-2 uppercase tracking-wide mb-3">
        Dispositivos
      </p>
      <div
        className="bg-white rounded-[18px] overflow-hidden mb-5"
        style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
      >
        {DEVICES.map((d, i) => (
          <div
            key={d.id}
            data-testid={`row-device-${d.id}`}
            className={`flex items-center gap-3 px-4 py-[14px] ${i < DEVICES.length - 1 ? "border-b border-vyva-warm" : ""}`}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--vyva-warm))" }}
            >
              <d.Icon size={16} className="text-vyva-text-2" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[14px] font-semibold text-vyva-text-1">{d.label}</p>
              <p className="font-body text-[12px] text-vyva-text-2">{d.model}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: d.connected ? "#16A34A" : "#D1D5DB" }}
              />
              <span
                className="font-body text-[11px]"
                style={{ color: d.connected ? "#16A34A" : "#9CA3AF" }}
              >
                {d.connected ? "Conectado" : "Desconectado"}
              </span>
            </div>
          </div>
        ))}
        <button
          data-testid="button-add-device"
          className="w-full flex items-center justify-center gap-2 py-3 border-t border-vyva-warm transition-colors active:bg-vyva-warm"
        >
          <Plus size={15} style={{ color: "#6B21A8" }} />
          <span className="font-body text-[14px] font-semibold" style={{ color: "#6B21A8" }}>
            Añadir dispositivo
          </span>
        </button>
      </div>

      <p className="font-body text-[13px] font-semibold text-vyva-text-2 uppercase tracking-wide mb-3">
        Cumplimiento
      </p>
      <div
        className="bg-white rounded-[18px] p-4 mb-5"
        style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
        data-testid="card-compliance"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-body text-[14px] font-semibold text-vyva-text-1">
            {filledDays} de 7 días con lecturas
          </p>
          <span
            className="font-body text-[11px] font-semibold px-[10px] py-[3px] rounded-full"
            style={{ color: "#D97706", background: "#FFF7ED" }}
          >
            {Math.round((filledDays / 7) * 100)}%
          </span>
        </div>
        <div className="flex gap-2">
          {complianceDays.map((done, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-full rounded-[6px]"
                style={{
                  height: 28,
                  background: done ? "#6B21A8" : "hsl(var(--vyva-warm2))",
                  opacity: done ? 1 : 0.45,
                }}
                data-testid={`compliance-day-${i}`}
              />
              <span className="font-body text-[10px] text-vyva-text-2">{DAY_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="font-body text-[13px] font-semibold text-vyva-text-2 uppercase tracking-wide mb-3">
        Acciones
      </p>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            id: "revisar",
            Icon: ClipboardList,
            label: "Revisar síntomas",
            color: "#7C3AED",
            bg: "#F5F3FF",
            action: () => navigate("/health/symptom-check"),
          },
          {
            id: "contactar",
            Icon: Phone,
            label: "Contactar médico",
            color: "#0369A1",
            bg: "#EFF6FF",
            action: () => {},
          },
          {
            id: "compartir",
            Icon: Share2,
            label: "Compartir informe",
            color: "#BE123C",
            bg: "#FFF1F2",
            action: () => {},
          },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={btn.action}
            data-testid={`button-action-${btn.id}`}
            className="flex flex-col items-center justify-center gap-2 rounded-[16px] py-4 px-2 transition-all active:scale-95 min-h-[80px]"
            style={{ background: btn.bg, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <btn.Icon size={20} style={{ color: btn.color }} />
            <span
              className="font-body text-[11px] font-semibold text-center leading-tight"
              style={{ color: btn.color }}
            >
              {btn.label}
            </span>
          </button>
        ))}
      </div>

      <p className="font-body text-[13px] font-semibold text-vyva-text-2 uppercase tracking-wide mb-3">
        Compartir datos
      </p>
      <div
        className="bg-white rounded-[18px] p-4"
        style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
        data-testid="card-sharing"
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#F5F3FF" }}
          >
            <Users size={20} style={{ color: "#6B21A8" }} />
          </div>
          <div className="flex-1">
            <p className="font-body text-[14px] font-semibold text-vyva-text-1">
              Cuidadores y médico
            </p>
            <p className="font-body text-[12px] text-vyva-text-2">
              Comparte tus datos de salud de forma segura
            </p>
          </div>
        </div>
        <div
          className="rounded-[12px] p-3 mb-4 flex items-center gap-2"
          style={{ background: "#FFFBEB", border: "1px dashed #D97706" }}
        >
          <AlertTriangle size={14} style={{ color: "#D97706" }} />
          <p className="font-body text-[12px]" style={{ color: "#92400E" }}>
            Ningún cuidador conectado todavía.
          </p>
        </div>
        <button
          data-testid="button-connect-caregiver"
          className="w-full flex items-center justify-center gap-2 py-[14px] rounded-[14px] transition-all active:scale-[0.98] min-h-[52px]"
          style={{ background: "#6B21A8" }}
        >
          <Plus size={16} className="text-white" />
          <span className="font-body text-[14px] font-semibold text-white">Conectar cuidador</span>
        </button>
      </div>

      {showLogModal && (
        <LogReadingModal
          onClose={() => setShowLogModal(false)}
          onSaved={() => setShowLogModal(false)}
        />
      )}
    </div>
  );
};

export default SignosScreen;
