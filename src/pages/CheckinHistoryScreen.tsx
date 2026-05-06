import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, HeartPulse, Loader2, Share2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/contexts/ProfileContext";

type CheckinHistoryReport = {
  id: string;
  completed_at: string;
  energy_level: number | null;
  mood: string | null;
  sleep_quality: string | null;
  symptoms: string[];
  social_contact: string | null;
  feeling_label: string | null;
  overall_state: "excellent" | "good" | "moderate" | "tired" | "low" | null;
  vyva_reading: string | null;
  right_now: string[];
  today_actions: string[];
  highlight: string | null;
  flag_caregiver: boolean;
  watch_for: string | null;
  language: string | null;
};

type CheckinHistoryResponse = {
  reports: CheckinHistoryReport[];
};

const stateStyle: Record<string, { bg: string; text: string; label: string }> = {
  excellent: { bg: "#FFFBEB", text: "#92400E", label: "Muy bien" },
  good: { bg: "#ECFDF5", text: "#047857", label: "Estable" },
  moderate: { bg: "#F5F3FF", text: "#6B21A8", label: "Atención suave" },
  tired: { bg: "#EFF6FF", text: "#1D4ED8", label: "Cansancio" },
  low: { bg: "#FEF2F2", text: "#B91C1C", label: "Cuidar de cerca" },
};

function formatDate(value: string, language = "es") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shareText(report: CheckinHistoryReport, name: string) {
  return [
    `Lectura VYVA para ${name}`,
    formatDate(report.completed_at, report.language ?? "es"),
    "",
    report.feeling_label ?? "Check-in de bienestar",
    report.vyva_reading ?? "",
    report.highlight ? `Lo importante: ${report.highlight}` : "",
    report.today_actions?.length ? "\nPara hoy:" : "",
    ...(report.today_actions ?? []).slice(0, 3).map((item) => `- ${item}`),
    report.watch_for ? `\nTen en cuenta: ${report.watch_for}` : "",
  ].filter(Boolean).join("\n");
}

const CheckinHistoryScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { firstName, profile } = useProfile();
  const language = profile?.language ?? "es";
  const name = firstName || "Carlos";
  const { data, isLoading, isError } = useQuery<CheckinHistoryResponse>({
    queryKey: ["/api/checkins/history"],
  });
  const reports = useMemo(() => data?.reports ?? [], [data?.reports]);
  const latest = reports[0];
  const averageEnergy = useMemo(() => {
    const values = reports.map((report) => report.energy_level).filter((value): value is number => typeof value === "number");
    if (!values.length) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }, [reports]);

  const handleShare = async (report: CheckinHistoryReport) => {
    const text = shareText(report, name);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Lectura VYVA", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ description: "Lectura copiada para compartir." });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast({ description: "Lectura copiada para compartir." });
      } catch {
        toast({ description: "No he podido compartir la lectura ahora mismo." });
      }
    }
  };

  return (
    <div className="vyva-page bg-[radial-gradient(circle_at_top_left,#FFF7ED_0%,transparent_34%),linear-gradient(180deg,#FAF7F2_0%,#F6EFE7_100%)]">
      <button
        onClick={() => navigate("/health")}
        className="vyva-tap mb-4 inline-flex min-h-[54px] items-center gap-2 rounded-full bg-white px-5 font-body text-[17px] font-bold text-vyva-text-1 shadow-[0_8px_22px_rgba(63,45,35,0.08)]"
      >
        <ArrowLeft size={20} />
        Atrás
      </button>

      <section className="overflow-hidden rounded-[34px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
        <div className="relative bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFF7ED] p-6">
          <div className="absolute right-[-34px] top-[-40px] h-32 w-32 rounded-full bg-vyva-purple/10" />
          <div className="relative mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[26px] bg-white text-vyva-purple shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
            <HeartPulse size={38} />
          </div>
          <p className="relative mb-2 font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-purple">
            Bienestar
          </p>
          <h1 className="relative font-display text-[38px] leading-tight text-vyva-text-1">
            Historial de bienestar
          </h1>
          <p className="relative mt-3 font-body text-[20px] leading-relaxed text-vyva-text-2">
            Tus lecturas anteriores, tendencias y consejos de VYVA en un solo lugar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <SummaryTile label="Lecturas" value={String(reports.length)} />
          <SummaryTile label="Energía media" value={averageEnergy ? `${averageEnergy}/5` : "—"} />
        </div>
      </section>

      {latest && (
        <section className="mt-5 rounded-[30px] border border-vyva-border bg-white p-5 shadow-[0_10px_28px_rgba(63,45,35,0.08)]">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-vyva-purple-light text-vyva-purple">
              <Sparkles size={23} />
            </span>
            <div>
              <p className="font-body text-[14px] font-bold uppercase tracking-[0.14em] text-vyva-purple">Última lectura</p>
              <p className="font-body text-[15px] text-vyva-text-2">{formatDate(latest.completed_at, language)}</p>
            </div>
          </div>
          <p className="font-body text-[22px] font-bold leading-snug text-vyva-text-1">{latest.feeling_label}</p>
          {latest.highlight && (
            <p className="mt-2 rounded-[20px] bg-vyva-purple-light p-4 font-body text-[18px] font-semibold leading-relaxed text-vyva-text-1">
              {latest.highlight}
            </p>
          )}
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-3 font-display text-[28px] text-vyva-text-1">Lecturas anteriores</h2>
        {isLoading ? (
          <div className="rounded-[28px] bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 animate-spin text-vyva-purple" size={34} />
            <p className="font-body text-[18px] text-vyva-text-2">Cargando historial...</p>
          </div>
        ) : isError ? (
          <EmptyState title="No he podido cargar el historial" text="Inténtalo de nuevo en un momento." />
        ) : reports.length === 0 ? (
          <EmptyState title="Aún no hay lecturas guardadas" text="Cuando completes un check-in, aparecerá aquí." />
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                language={language}
                onShare={() => handleShare(report)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-[#FAF9F6] p-4 text-center">
      <p className="font-body text-[26px] font-bold text-vyva-text-1">{value}</p>
      <p className="mt-1 font-body text-[14px] font-semibold text-vyva-text-2">{label}</p>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[28px] border border-vyva-border bg-white p-6 text-center shadow-sm">
      <p className="font-body text-[20px] font-bold text-vyva-text-1">{title}</p>
      <p className="mt-2 font-body text-[17px] leading-relaxed text-vyva-text-2">{text}</p>
    </div>
  );
}

function ReportCard({
  report,
  language,
  onShare,
}: {
  report: CheckinHistoryReport;
  language: string;
  onShare: () => void;
}) {
  const style = stateStyle[report.overall_state ?? "moderate"] ?? stateStyle.moderate;

  return (
    <article className="rounded-[30px] border border-vyva-border bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.07)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
            <CalendarDays size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[15px] font-semibold leading-snug text-vyva-text-2">
              {formatDate(report.completed_at, language)}
            </p>
            <p className="mt-1 font-body text-[20px] font-bold leading-tight text-vyva-text-1">
              {report.feeling_label ?? "Lectura de bienestar"}
            </p>
          </div>
        </div>
        <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: style.bg, color: style.text }}>
          {style.label}
        </span>
      </div>

      {report.vyva_reading && (
        <p className="font-body text-[17px] leading-relaxed text-vyva-text-2">{report.vyva_reading}</p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric label="Energía" value={report.energy_level ? `${report.energy_level}/5` : "—"} />
        <MiniMetric label="Sueño" value={prettyValue(report.sleep_quality)} />
        <MiniMetric label="Ánimo" value={prettyValue(report.mood)} />
      </div>

      {report.highlight && (
        <div className="mt-4 rounded-[20px] bg-[#F5F3FF] p-4">
          <p className="font-body text-[14px] font-bold uppercase tracking-[0.14em] text-vyva-purple">Lo importante</p>
          <p className="mt-1 font-body text-[17px] font-semibold leading-relaxed text-vyva-text-1">{report.highlight}</p>
        </div>
      )}

      {report.today_actions?.length > 0 && (
        <div className="mt-4 grid gap-2">
          {report.today_actions.slice(0, 2).map((item) => (
            <div key={item} className="flex gap-2 rounded-[18px] bg-[#FAF9F6] p-3">
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple text-white">
                <Check size={15} />
              </span>
              <p className="font-body text-[16px] leading-relaxed text-vyva-text-1">{item}</p>
            </div>
          ))}
        </div>
      )}

      {report.watch_for && (
        <p className="mt-4 rounded-[18px] border border-[#FED7AA] bg-[#FFF7ED] p-3 font-body text-[15px] leading-relaxed text-[#7C2D12]">
          {report.watch_for}
        </p>
      )}

      <button
        onClick={onShare}
        className="vyva-secondary-action mt-4 min-h-[56px] w-full text-[16px]"
      >
        <Share2 size={18} className="mr-2" />
        Compartir esta lectura
      </button>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#FAF9F6] p-3 text-center">
      <p className="font-body text-[16px] font-bold leading-tight text-vyva-text-1">{value}</p>
      <p className="mt-1 font-body text-[12px] font-semibold text-vyva-text-2">{label}</p>
    </div>
  );
}

function prettyValue(value: string | null) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

export default CheckinHistoryScreen;
