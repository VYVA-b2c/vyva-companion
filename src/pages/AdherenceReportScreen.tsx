import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart2, Copy, AlertCircle, RefreshCw, ClipboardCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DailyStatus = "taken" | "missed" | "none";

type MedAdherence = {
  name: string;
  dosage: string;
  taken: number;
  scheduled: number;
  streak: number;
  dailyStatus: DailyStatus[];
};

type AdherenceReport = {
  hasLogs: boolean;
  weekPct: number;
  monthPct: number;
  perMedication: MedAdherence[];
  sevenDayDates: string[];
};

function AdherenceDot({ status, title }: { status: DailyStatus; title: string }) {
  if (status === "taken") {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: "#ECFDF5" }}
        title={title}
      >
        <div className="w-3.5 h-3.5 rounded-full" style={{ background: "#0A7C4E" }} />
      </div>
    );
  }
  if (status === "missed") {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: "#FEF2F2" }}
        title={title}
      >
        <div className="w-3.5 h-3.5 rounded-full" style={{ background: "#DC2626" }} />
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{ background: "#F3F4F6" }}
      title={title}
    >
      <div className="w-3.5 h-3.5 rounded-full" style={{ background: "#D1D5DB" }} />
    </div>
  );
}

function PctRing({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 80 ? "#0A7C4E" : pct >= 50 ? "#C9890A" : "#DC2626";
  const bg = pct >= 80 ? "#ECFDF5" : pct >= 50 ? "#FEF3C7" : "#FEF2F2";
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center flex-col"
        style={{ background: bg, border: `3px solid ${color}` }}
        data-testid={`stat-adherence-${label.replace(/\s/g, "-").toLowerCase()}`}
      >
        <span className="font-body text-[22px] font-bold" style={{ color }}>{pct}%</span>
      </div>
      <span className="font-body text-[13px] text-vyva-text-2 text-center">{label}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="px-[18px] py-[16px] border-b border-vyva-border last:border-b-0 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  );
}

const AdherenceReportScreen = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery<AdherenceReport>({
    queryKey: ["/api/meds/adherence-report"],
  });

  const rawDayLabels = t("meds.adherence.dayLabels", { returnObjects: true });
  const dayLabels: string[] = Array.isArray(rawDayLabels)
    ? (rawDayLabels as string[])
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function handleShare() {
    if (!data) return;

    const medsText = data.perMedication
      .map((m) =>
        t("meds.adherence.shareFormatMed", {
          name: m.name,
          dosage: m.dosage || t("meds.adherence.dosageFallback"),
          taken: m.taken,
          scheduled: m.scheduled,
          streak: m.streak,
        })
      )
      .join("\n");

    const text = t("meds.adherence.shareFormat", {
      week: data.weekPct,
      month: data.monthPct,
      meds: medsText,
    });

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({
          title: t("meds.adherence.shareCopied"),
          description: t("meds.adherence.shareCopiedDesc"),
        });
      })
      .catch(() => {
        toast({ title: t("meds.adherence.shareCopied"), description: text });
      });
  }

  const hasData = data && data.hasLogs;

  return (
    <div className="min-h-screen" style={{ background: "#FAF8F5" }}>
      <div className="px-[22px] pt-[20px] pb-8">
        <button
          data-testid="button-back-to-meds"
          onClick={() => navigate("/meds")}
          className="flex items-center gap-2 mb-5 font-body text-[15px] font-medium min-h-[44px] -ml-1 px-1"
          style={{ color: "#6B21A8" }}
        >
          <ArrowLeft size={20} />
          {t("meds.adherence.backToMeds")}
        </button>

        <div className="flex items-center gap-3 mb-[18px]">
          <div
            className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
            style={{ background: "#EDE9FE" }}
          >
            <BarChart2 size={22} style={{ color: "#6B21A8" }} />
          </div>
          <h1 className="font-body text-[22px] font-bold text-vyva-text-1 leading-tight">
            {t("meds.adherence.title")}
          </h1>
        </div>

        {isLoading && (
          <>
            <div className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
              </div>
              <div className="flex justify-around px-[18px] py-[24px]">
                <div className="w-20 h-20 rounded-full bg-gray-100 animate-pulse" />
                <div className="w-20 h-20 rounded-full bg-gray-100 animate-pulse" />
              </div>
            </div>
            <div className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
              </div>
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </>
        )}

        {isError && (
          <div className="bg-white rounded-[20px] border border-vyva-border flex flex-col items-center gap-4 px-[24px] py-[40px] text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <AlertCircle size={40} style={{ color: "#DC2626" }} />
            <p className="font-body text-[17px] font-semibold text-vyva-text-1">{t("meds.adherence.errorTitle")}</p>
            <p className="font-body text-[14px] text-vyva-text-2">{t("meds.adherence.errorSub")}</p>
            <button
              data-testid="button-adherence-retry"
              onClick={() => refetch()}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-body text-[15px] font-medium text-white min-h-[48px]"
              style={{ background: "#6B21A8" }}
            >
              <RefreshCw size={16} />
              {t("meds.adherence.retry")}
            </button>
          </div>
        )}

        {!isLoading && !isError && !hasData && (
          <div className="bg-white rounded-[20px] border border-vyva-border flex flex-col items-center gap-4 px-[24px] py-[48px] text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <ClipboardCheck size={44} style={{ color: "#A78BFA" }} />
            <p className="font-body text-[19px] font-bold text-vyva-text-1">{t("meds.adherence.noDataTitle")}</p>
            <p className="font-body text-[15px] text-vyva-text-2 max-w-[280px]">{t("meds.adherence.noDataSub")}</p>
          </div>
        )}

        {!isLoading && !isError && hasData && data && (
          <>
            <div
              className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
            >
              <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                <span className="font-body text-[14px] font-medium text-vyva-text-1">{t("meds.adherence.overallStats")}</span>
              </div>
              <div className="flex justify-around px-[18px] py-[24px]">
                <PctRing pct={data.weekPct} label={t("meds.adherence.thisWeek")} />
                <PctRing pct={data.monthPct} label={t("meds.adherence.last30Days")} />
              </div>
            </div>

            {data.perMedication.length > 0 && (
              <div
                className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
              >
                <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                  <span className="font-body text-[14px] font-medium text-vyva-text-1">{t("meds.adherence.perMedication")}</span>
                </div>
                {data.perMedication.map((med, i) => {
                  const streakLabel =
                    med.streak === 0
                      ? t("meds.adherence.streakZero")
                      : t("meds.adherence.streak", { days: med.streak });

                  return (
                    <div
                      key={i}
                      className="px-[18px] py-[16px] border-b border-vyva-border last:border-b-0"
                      data-testid={`card-med-adherence-${i}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-[16px] font-semibold text-vyva-text-1 leading-tight">{med.name}</p>
                          {med.dosage && (
                            <p className="font-body text-[13px] text-vyva-text-2 mt-0.5">{med.dosage}</p>
                          )}
                        </div>
                        <span
                          className="font-body text-[12px] font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ background: "#EDE9FE", color: "#6B21A8" }}
                        >
                          {streakLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-body text-[13px] text-vyva-text-2">
                          {med.taken} {t("meds.adherence.taken")} / {med.scheduled} {t("meds.adherence.scheduled")}
                        </span>
                      </div>

                      <div>
                        <p className="font-body text-[12px] text-vyva-text-2 mb-2 font-medium uppercase tracking-wide">
                          {t("meds.adherence.weeklyView")}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          {med.dailyStatus.map((status, di) => {
                            const dotTitle =
                              status === "taken"
                                ? t("meds.adherence.statusTaken")
                                : status === "missed"
                                ? t("meds.adherence.statusMissed")
                                : t("meds.adherence.statusNoSchedule");
                            return (
                              <div key={di} className="flex flex-col items-center gap-1">
                                <AdherenceDot status={status} title={dotTitle} />
                                <span className="font-body text-[10px] text-vyva-text-2">{dayLabels[di] ?? di}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#0A7C4E" }} />
                            <span className="font-body text-[11px] text-vyva-text-2">{t("meds.adherence.statusTaken")}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#DC2626" }} />
                            <span className="font-body text-[11px] text-vyva-text-2">{t("meds.adherence.statusMissed")}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#D1D5DB" }} />
                            <span className="font-body text-[11px] text-vyva-text-2">{t("meds.adherence.statusNoSchedule")}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              data-testid="button-adherence-share"
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 rounded-full py-[16px] px-[20px] font-body text-[16px] font-medium text-white min-h-[56px] mb-8"
              style={{ background: "#6B21A8" }}
            >
              <Copy size={18} />
              {t("meds.adherence.shareButton")}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AdherenceReportScreen;
