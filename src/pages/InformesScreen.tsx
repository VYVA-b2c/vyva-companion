import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Heart,
  Wind,
  Pill,
  Activity,
  CheckCircle,
  AlertTriangle,
  Eye,
  MessageCircle,
  TrendingUp,
  ClipboardList,
} from "lucide-react";

type TriageReport = {
  id: string;
  chief_complaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  ai_summary: string | null;
  bpm: number | null;
  respiratory_rate: number | null;
  duration_seconds: number | null;
  created_at: string;
};

type VitalsReading = {
  id: string;
  bpm: number;
  respiratory_rate: number | null;
  recorded_at: string;
};

type Summary = {
  latestTriage: TriageReport | null;
  latestVitals: VitalsReading | null;
  todayMeds: { taken: number; total: number; adherencePct: number | null };
};

type VitalsHistory = {
  readings: VitalsReading[];
};

function urgencyConfig(urgency: TriageReport["urgency"]) {
  if (urgency === "urgent") {
    return { icon: AlertTriangle, bg: "#FEE2E2", text: "#B91C1C" };
  }
  if (urgency === "routine") {
    return { icon: Eye, bg: "#FEF3C7", text: "#B45309" };
  }
  return { icon: CheckCircle, bg: "#D1FAE5", text: "#065F46" };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function SummaryPhrase({ summary }: { summary: Summary }) {
  const { t } = useTranslation();
  if (!summary.latestTriage && !summary.latestVitals && summary.todayMeds.total === 0) {
    return (
      <p className="font-body text-[15px] text-white/90">
        {t("informes.summaryEmpty")}
      </p>
    );
  }

  const { latestTriage, latestVitals, todayMeds } = summary;
  let phrase = t("informes.summaryGood");

  if (latestTriage?.urgency === "urgent") {
    phrase = t("informes.summaryUrgent");
  } else if (latestTriage?.urgency === "routine") {
    phrase = t("informes.summaryRoutine");
  } else if (todayMeds.total > 0 && todayMeds.taken < todayMeds.total) {
    phrase = t("informes.summaryMedsPending", { pending: todayMeds.total - todayMeds.taken });
  } else if (latestVitals && latestVitals.bpm > 100) {
    phrase = t("informes.summaryHighHR");
  } else if (latestVitals && latestVitals.bpm < 55) {
    phrase = t("informes.summaryLowHR");
  }

  return (
    <p className="font-body text-[16px] font-medium text-white leading-relaxed">
      {phrase}
    </p>
  );
}

function LineChart({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 10;
  const W = 280;
  const H = 60;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 10) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${pts.join(" L ")}`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

function DetailView({ report, onBack }: { report: TriageReport; onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cfg = urgencyConfig(report.urgency);
  const UrgIcon = cfg.icon;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "hsl(var(--vyva-cream))" }}>
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top))",
          borderBottom: "1px solid hsl(var(--vyva-border))",
          background: "white",
        }}
      >
        <button
          onClick={onBack}
          data-testid="button-report-detail-back"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
          style={{ background: "hsl(var(--vyva-warm))" }}
        >
          <ChevronLeft size={20} style={{ color: "hsl(var(--vyva-text-1))" }} />
        </button>
        <p className="font-body text-[16px] font-semibold text-vyva-text-1 flex-1">
          {t("informes.reportDetail.title")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 flex flex-col gap-4">
        <div
          className="rounded-[20px] p-5 flex flex-col gap-3"
          style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: cfg.bg }}
            >
              <UrgIcon size={22} style={{ color: cfg.text }} />
            </div>
            <div>
              <p className="font-body text-[12px] font-medium uppercase tracking-wider" style={{ color: cfg.text }}>
                {t(`informes.urgency.${report.urgency}`)}
              </p>
              <p className="font-body text-[18px] font-bold text-vyva-text-1 leading-tight">
                {report.chief_complaint}
              </p>
            </div>
          </div>
          <p className="font-body text-[13px] text-vyva-text-3">{formatDate(report.created_at)}</p>

          {report.ai_summary && (
            <p className="font-body text-[15px] text-vyva-text-2 leading-relaxed">
              {report.ai_summary}
            </p>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            {report.bpm != null && (
              <div className="flex items-center gap-1.5">
                <Heart size={14} style={{ color: "hsl(var(--vyva-purple))" }} />
                <span className="font-body text-[14px] text-vyva-text-2">{report.bpm} bpm</span>
              </div>
            )}
            {report.respiratory_rate != null && (
              <div className="flex items-center gap-1.5">
                <Wind size={14} style={{ color: "#0369A1" }} />
                <span className="font-body text-[14px] text-vyva-text-2">{report.respiratory_rate} rpm</span>
              </div>
            )}
            {report.duration_seconds != null && report.duration_seconds > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-body text-[12px] text-vyva-text-3">
                  {t("informes.reportDetail.duration")}: {formatDuration(report.duration_seconds)}
                </span>
              </div>
            )}
          </div>
        </div>

        {report.symptoms.length > 0 && (
          <div
            className="rounded-[20px] p-5"
            style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
          >
            <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
              {t("informes.reportDetail.symptoms")}
            </p>
            <ul className="flex flex-col gap-2">
              {report.symptoms.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                    style={{ background: "hsl(var(--vyva-purple))" }}
                  />
                  <span className="font-body text-[15px] text-vyva-text-1">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.recommendations.length > 0 && (
          <div
            className="rounded-[20px] p-5"
            style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
          >
            <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
              {t("informes.reportDetail.recommendations")}
            </p>
            <ol className="flex flex-col gap-3">
              {report.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-body text-[12px] font-bold text-white"
                    style={{ background: "hsl(var(--vyva-purple))" }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-body text-[15px] text-vyva-text-1 leading-relaxed pt-0.5">{rec}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {report.disclaimer ? (
          <p className="font-body text-[11px] text-vyva-text-3 text-center leading-relaxed px-2">
            {report.disclaimer}
          </p>
        ) : null}

        <button
          data-testid="button-report-detail-chat"
          onClick={() => navigate("/chat")}
          className="w-full rounded-full py-[15px] flex items-center justify-center gap-2 font-body text-[16px] font-semibold text-white transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, hsl(var(--vyva-purple)) 0%, #7C3AED 100%)",
            boxShadow: "0 4px 18px rgba(91,18,160,0.30)",
          }}
        >
          <MessageCircle size={18} />
          {t("informes.reportDetail.chatCta")}
        </button>
      </div>
    </div>
  );
}

function InformesMain() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: urlId } = useParams<{ id?: string }>();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(urlId ?? null);

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ["/api/reports/summary"],
  });

  const { data: vitalsHistory } = useQuery<VitalsHistory>({
    queryKey: ["/api/reports/vitals/history"],
  });

  const { data: directReport, isLoading: directLoading, isError: directError } = useQuery<TriageReport>({
    queryKey: [`/api/reports/triage/${selectedReportId}`],
    enabled: !!selectedReportId,
    retry: 1,
  });

  const handleBack = () => { setSelectedReportId(null); navigate("/informes"); };

  if (selectedReportId) {
    if (directLoading) {
      return (
        <div className="flex flex-col min-h-screen items-center justify-center" style={{ background: "hsl(var(--vyva-cream))" }}>
          <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "hsl(var(--vyva-warm))" }} />
        </div>
      );
    }
    if (directError || (!directLoading && !directReport)) {
      return (
        <div className="flex flex-col min-h-screen px-[22px] pt-6" style={{ background: "hsl(var(--vyva-cream))" }}>
          <button
            data-testid="button-back-from-error"
            onClick={handleBack}
            className="flex items-center gap-1 mb-6 font-body text-[14px] text-vyva-text-3"
          >
            ← {t("informes.back")}
          </button>
          <div
            className="rounded-[20px] flex flex-col items-center gap-4 px-[24px] py-[48px] text-center"
            style={{ background: "white", border: "1px solid hsl(var(--vyva-border))" }}
          >
            <ClipboardList size={44} style={{ color: "#A78BFA" }} />
            <p className="font-body text-[19px] font-bold text-vyva-text-1">{t("informes.errorTitle")}</p>
            <p className="font-body text-[15px] text-vyva-text-2">{t("informes.errorSub")}</p>
          </div>
        </div>
      );
    }
    if (directReport) {
      return <DetailView report={directReport} onBack={handleBack} />;
    }
  }

  const hasData =
    summary && (summary.latestTriage != null || summary.latestVitals != null || summary.todayMeds.total > 0);

  const respReadings = vitalsHistory?.readings.filter(r => r.respiratory_rate != null) ?? [];
  const hasRespHistory = respReadings.length >= 2;
  const hasBpmHistory = (vitalsHistory?.readings?.length ?? 0) >= 2;

  return (
    <div className="px-[22px] pb-8">
      <div className="pt-2 pb-4 flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{ background: "#EFF6FF" }}
        >
          <ClipboardList size={22} style={{ color: "#1D4ED8" }} />
        </div>
        <div>
          <h1 className="font-body text-[22px] font-bold text-vyva-text-1 leading-tight">
            {t("informes.title")}
          </h1>
          <p className="font-body text-[13px] text-vyva-text-3">{t("informes.subtitle")}</p>
        </div>
      </div>

      {summaryLoading && (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="rounded-[20px] h-28 animate-pulse"
              style={{ background: "white", border: "1px solid hsl(var(--vyva-border))" }}
            />
          ))}
        </div>
      )}

      {!summaryLoading && summary && (
        <>
          <div
            className="rounded-[20px] p-5 mb-4"
            style={{
              background: "linear-gradient(135deg, hsl(var(--vyva-purple)) 0%, #7C3AED 100%)",
              boxShadow: "0 4px 18px rgba(91,18,160,0.25)",
            }}
            data-testid="banner-today-summary"
          >
            <p className="font-body text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-1">
              {t("informes.todaySummary")}
            </p>
            {hasData ? (
              <SummaryPhrase summary={summary} />
            ) : (
              <p className="font-body text-[15px] text-white/90">{t("informes.summaryEmpty")}</p>
            )}
          </div>

          <p className="font-body text-[14px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
            {t("informes.latestReports")}
          </p>

          <div className="flex flex-col gap-3 mb-6">
            {summary.latestTriage ? (
              <button
                data-testid="card-symptom-report"
                onClick={() => navigate(`/informes/${summary.latestTriage!.id}`)}
                className="w-full text-left rounded-[20px] p-5 transition-all active:scale-[0.98]"
                style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                      style={{ background: "#F5F3FF" }}
                    >
                      <Activity size={18} style={{ color: "#7C3AED" }} />
                    </div>
                    <div>
                      <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                        {t("informes.cards.symptom.title")}
                      </p>
                      <p className="font-body text-[12px] text-vyva-text-3">
                        {formatDate(summary.latestTriage.created_at)}
                      </p>
                    </div>
                  </div>
                  <span
                    className="font-body text-[12px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: urgencyConfig(summary.latestTriage.urgency).bg,
                      color: urgencyConfig(summary.latestTriage.urgency).text,
                    }}
                    data-testid="badge-symptom-urgency"
                  >
                    {t(`informes.urgency.${summary.latestTriage.urgency}`)}
                  </span>
                </div>
                {summary.latestTriage.ai_summary ? (
                  <p className="font-body text-[14px] text-vyva-text-2 leading-relaxed mb-2 line-clamp-2">
                    {summary.latestTriage.ai_summary}
                  </p>
                ) : (
                  <p className="font-body text-[14px] text-vyva-text-2 leading-relaxed mb-2">
                    {summary.latestTriage.chief_complaint}
                  </p>
                )}
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  {summary.latestTriage.bpm != null && (
                    <div className="flex items-center gap-1">
                      <Heart size={12} style={{ color: "hsl(var(--vyva-purple))" }} />
                      <span className="font-body text-[12px] text-vyva-text-3">{summary.latestTriage.bpm} bpm</span>
                    </div>
                  )}
                  {summary.latestTriage.respiratory_rate != null && (
                    <div className="flex items-center gap-1">
                      <Wind size={12} style={{ color: "#0369A1" }} />
                      <span className="font-body text-[12px] text-vyva-text-3">{summary.latestTriage.respiratory_rate} rpm</span>
                    </div>
                  )}
                </div>
                <p
                  className="font-body text-[13px] font-semibold"
                  style={{ color: "hsl(var(--vyva-purple))" }}
                >
                  {t("informes.cards.symptom.cta")} →
                </p>
              </button>
            ) : (
              <div
                className="rounded-[20px] p-5"
                style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
                data-testid="card-symptom-empty"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                    style={{ background: "#F5F3FF" }}
                  >
                    <Activity size={18} style={{ color: "#7C3AED" }} />
                  </div>
                  <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                    {t("informes.cards.symptom.title")}
                  </p>
                </div>
                <p className="font-body text-[14px] text-vyva-text-3">
                  {t("informes.cards.symptom.empty")}
                </p>
              </div>
            )}

            {summary.latestVitals ? (
              <div
                className="rounded-[20px] p-5"
                style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
                data-testid="card-vitals"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                    style={{ background: "#FFF1F2" }}
                  >
                    <Heart size={18} style={{ color: "#BE123C" }} />
                  </div>
                  <div>
                    <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                      {t("informes.cards.vitals.title")}
                    </p>
                    <p className="font-body text-[12px] text-vyva-text-3">
                      {formatDate(summary.latestVitals.recorded_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <Heart size={14} style={{ color: "#BE123C" }} />
                      <p className="font-body text-[28px] font-bold" style={{ color: "#BE123C" }}>
                        {summary.latestVitals.bpm}
                      </p>
                      <span className="font-body text-[13px] text-vyva-text-3">bpm</span>
                    </div>
                    <span
                      className="font-body text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: summary.latestVitals.bpm < 60 || summary.latestVitals.bpm > 100
                          ? "#FEF3C7"
                          : "#D1FAE5",
                        color: summary.latestVitals.bpm < 60 || summary.latestVitals.bpm > 100
                          ? "#92400E"
                          : "#065F46",
                      }}
                      data-testid="badge-vitals-hr-status"
                    >
                      {summary.latestVitals.bpm < 60 || summary.latestVitals.bpm > 100
                        ? t("informes.cards.vitals.statusReview")
                        : t("informes.cards.vitals.statusNormal")}
                    </span>
                  </div>
                  {summary.latestVitals.respiratory_rate != null && (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <Wind size={14} style={{ color: "#0369A1" }} />
                        <p className="font-body text-[28px] font-bold" style={{ color: "#0369A1" }}>
                          {summary.latestVitals.respiratory_rate}
                        </p>
                        <span className="font-body text-[13px] text-vyva-text-3">rpm</span>
                      </div>
                      <span
                        className="font-body text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: summary.latestVitals.respiratory_rate < 12 || summary.latestVitals.respiratory_rate > 20
                            ? "#FEF3C7"
                            : "#D1FAE5",
                          color: summary.latestVitals.respiratory_rate < 12 || summary.latestVitals.respiratory_rate > 20
                            ? "#92400E"
                            : "#065F46",
                        }}
                        data-testid="badge-vitals-resp-status"
                      >
                        {t("informes.cards.vitals.breathsPerMin")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="rounded-[20px] p-5"
                style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
                data-testid="card-vitals-empty"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                    style={{ background: "#FFF1F2" }}
                  >
                    <Heart size={18} style={{ color: "#BE123C" }} />
                  </div>
                  <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                    {t("informes.cards.vitals.title")}
                  </p>
                </div>
                <p className="font-body text-[14px] text-vyva-text-3">
                  {t("informes.cards.vitals.empty")}
                </p>
              </div>
            )}

            <div
              className="rounded-[20px] p-5"
              style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
              data-testid="card-medication"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                  style={{ background: "#FDF4FF" }}
                >
                  <Pill size={18} style={{ color: "#86198F" }} />
                </div>
                <div>
                  <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                    {t("informes.cards.meds.title")}
                  </p>
                  <p className="font-body text-[12px] text-vyva-text-3">{t("informes.cards.meds.today")}</p>
                </div>
              </div>
              {summary.todayMeds.total > 0 ? (
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-body text-[28px] font-bold" style={{ color: "#86198F" }}>
                      {summary.todayMeds.adherencePct ?? 0}%
                    </p>
                    <p className="font-body text-[12px] text-vyva-text-3">
                      {t("informes.cards.meds.taken", {
                        taken: summary.todayMeds.taken,
                        total: summary.todayMeds.total,
                      })}
                    </p>
                  </div>
                  <button
                    data-testid="button-meds-details"
                    onClick={() => navigate("/meds/adherence-report")}
                    className="ml-auto font-body text-[13px] font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
                    style={{ background: "#FDF4FF", color: "#86198F" }}
                  >
                    {t("informes.cards.meds.cta")}
                  </button>
                </div>
              ) : (
                <p className="font-body text-[14px] text-vyva-text-3">
                  {t("informes.cards.meds.empty")}
                </p>
              )}
            </div>
          </div>

          <p className="font-body text-[14px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
            {t("informes.trends.title")}
          </p>
          {!hasBpmHistory && !hasRespHistory && (
            <div
              className="rounded-[20px] p-5 mb-4 flex flex-col items-center gap-2 text-center"
              style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
              data-testid="trends-empty-state"
            >
              <TrendingUp size={28} style={{ color: "#A78BFA", opacity: 0.5 }} />
              <p className="font-body text-[14px] text-vyva-text-3">{t("informes.trends.empty")}</p>
            </div>
          )}
          {hasBpmHistory && (
            <div
              className="rounded-[20px] p-5 mb-3"
              style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
              data-testid="chart-heart-rate"
            >
              <div className="flex items-center gap-2 mb-3">
                <Heart size={14} style={{ color: "#BE123C" }} />
                <p className="font-body text-[14px] font-semibold text-vyva-text-1">
                  {t("informes.trends.heartRate")}
                </p>
                <span className="font-body text-[12px] text-vyva-text-3 ml-auto">
                  {t("informes.trends.readings", { count: vitalsHistory!.readings.length })}
                </span>
              </div>
              <LineChart
                values={vitalsHistory!.readings.map(r => r.bpm)}
                color="#BE123C"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="font-body text-[12px] text-vyva-text-3">
                  {t("informes.trends.min")}: {Math.min(...vitalsHistory!.readings.map(r => r.bpm))} bpm
                </span>
                <span className="font-body text-[12px] text-vyva-text-3">
                  {t("informes.trends.max")}: {Math.max(...vitalsHistory!.readings.map(r => r.bpm))} bpm
                </span>
              </div>
            </div>
          )}
          {hasRespHistory && (
            <div
              className="rounded-[20px] p-5 mb-4"
              style={{ background: "white", border: "1px solid hsl(var(--vyva-border))", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
              data-testid="chart-respiratory-rate"
            >
              <div className="flex items-center gap-2 mb-3">
                <Wind size={14} style={{ color: "#0369A1" }} />
                <p className="font-body text-[14px] font-semibold text-vyva-text-1">
                  {t("informes.trends.respiratoryRate")}
                </p>
                <span className="font-body text-[12px] text-vyva-text-3 ml-auto">
                  {t("informes.trends.readings", { count: respReadings.length })}
                </span>
              </div>
              <LineChart
                values={respReadings.map(r => r.respiratory_rate!)}
                color="#0369A1"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="font-body text-[12px] text-vyva-text-3">
                  {t("informes.trends.min")}: {Math.min(...respReadings.map(r => r.respiratory_rate!))} rpm
                </span>
                <span className="font-body text-[12px] text-vyva-text-3">
                  {t("informes.trends.max")}: {Math.max(...respReadings.map(r => r.respiratory_rate!))} rpm
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {!summaryLoading && !summary && (
        <div
          className="rounded-[20px] flex flex-col items-center gap-4 px-[24px] py-[48px] text-center"
          style={{ background: "white", border: "1px solid hsl(var(--vyva-border))" }}
        >
          <ClipboardList size={44} style={{ color: "#A78BFA" }} />
          <p className="font-body text-[19px] font-bold text-vyva-text-1">{t("informes.errorTitle")}</p>
          <p className="font-body text-[15px] text-vyva-text-2">{t("informes.errorSub")}</p>
        </div>
      )}
    </div>
  );
}

export default function InformesScreen() {
  return <InformesMain />;
}
