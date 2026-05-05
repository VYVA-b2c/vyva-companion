import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart2, Copy, AlertCircle, RefreshCw, ClipboardCheck, Flame, ShieldCheck, TriangleAlert, Sparkles, Clock3, Target } from "lucide-react";
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

function miniStatTone(value: number, positiveWhenHigh = true) {
  if ((positiveWhenHigh && value >= 1) || (!positiveWhenHigh && value === 0)) {
    return { bg: "#ECFDF5", color: "#0A7C4E" };
  }
  if ((positiveWhenHigh && value === 0) || (!positiveWhenHigh && value <= 1)) {
    return { bg: "#FEF3C7", color: "#C9890A" };
  }
  return { bg: "#FEF2F2", color: "#DC2626" };
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

  const medications = data?.perMedication ?? [];
  const medicationsNeedingAttention = medications.filter((med) =>
    med.dailyStatus.includes("missed")
  );
  const todayStillDueMeds = medications.filter(
    (med) => med.dailyStatus[med.dailyStatus.length - 1] === "none"
  );
  const todayCompletedCount = medications.filter(
    (med) => med.dailyStatus[med.dailyStatus.length - 1] === "taken"
  ).length;
  const todayStillDueCount = todayStillDueMeds.length;
  const onTrackCount = medications.length - medicationsNeedingAttention.length;
  const bestStreak = medications.reduce((best, med) => Math.max(best, med.streak), 0);
  const attentionNames = medicationsNeedingAttention.slice(0, 3).map((med) => med.name);
  const medicationInsights = medications.map((med) => {
    const missedCount = med.dailyStatus.filter((status) => status === "missed").length;
    const adherencePct = med.scheduled > 0 ? Math.round((med.taken / med.scheduled) * 100) : 0;
    return { ...med, missedCount, adherencePct };
  });
  const mostMissedMedication = [...medicationInsights].sort((a, b) => {
    if (a.missedCount !== b.missedCount) return b.missedCount - a.missedCount;
    return a.name.localeCompare(b.name);
  })[0];
  const strongestMedication = [...medicationInsights].sort((a, b) => {
    if (a.streak !== b.streak) return b.streak - a.streak;
    if (a.adherencePct !== b.adherencePct) return b.adherencePct - a.adherencePct;
    return a.name.localeCompare(b.name);
  })[0];
  const sortedMedications = [...medications].sort((a, b) => {
    const aMissed = a.dailyStatus.filter((status) => status === "missed").length;
    const bMissed = b.dailyStatus.filter((status) => status === "missed").length;
    if (aMissed !== bMissed) return bMissed - aMissed;
    return a.name.localeCompare(b.name);
  });

  const insights = [
    {
      icon: Clock3,
      iconBg: "#FEF3C7",
      iconColor: "#C9890A",
      title: t("meds.adherence.insightNextStepTitle"),
      body:
        todayStillDueMeds.length === 1
          ? t("meds.adherence.insightNextStepSingle", { name: todayStillDueMeds[0].name })
          : todayStillDueMeds.length > 1
            ? t("meds.adherence.insightNextStepMultiple", { count: todayStillDueMeds.length })
            : medicationsNeedingAttention.length > 0
              ? t("meds.adherence.insightNextStepReview", { name: attentionNames[0] })
              : t("meds.adherence.insightNextStepClear"),
    },
    {
      icon: Sparkles,
      iconBg: "#ECFDF5",
      iconColor: "#0A7C4E",
      title: t("meds.adherence.insightHabitTitle"),
      body:
        strongestMedication?.streak > 0
          ? t("meds.adherence.insightHabitBody", {
              name: strongestMedication.name,
              streak: strongestMedication.streak,
            })
          : strongestMedication
            ? t("meds.adherence.insightHabitBodyNoStreak", { name: strongestMedication.name })
            : t("meds.adherence.insightHabitBodyEmpty"),
    },
    {
      icon: Target,
      iconBg: "#F5F3FF",
      iconColor: "#6B21A8",
      title: t("meds.adherence.insightFocusTitle"),
      body:
        mostMissedMedication && mostMissedMedication.missedCount > 0
          ? t("meds.adherence.insightFocusBody", {
              name: mostMissedMedication.name,
              count: mostMissedMedication.missedCount,
            })
          : t("meds.adherence.insightFocusBodyClear"),
    },
  ];

  const summaryTone =
    medicationsNeedingAttention.length === 0
      ? {
          icon: ShieldCheck,
          iconBg: "#ECFDF5",
          iconColor: "#0A7C4E",
          title: t("meds.adherence.overviewAllTaken"),
          subtitle: t("meds.adherence.overviewAllTakenSub"),
        }
      : medicationsNeedingAttention.length <= 2
        ? {
            icon: TriangleAlert,
            iconBg: "#FEF3C7",
            iconColor: "#C9890A",
            title: t("meds.adherence.overviewSomeMissed"),
            subtitle: t("meds.adherence.overviewSomeMissedSub", {
              count: medicationsNeedingAttention.length,
            }),
          }
        : {
            icon: TriangleAlert,
            iconBg: "#FEF2F2",
            iconColor: "#DC2626",
            title: t("meds.adherence.overviewManyMissed"),
            subtitle: t("meds.adherence.overviewManyMissedSub", {
              count: medicationsNeedingAttention.length,
            }),
          };
  const SummaryIcon = summaryTone.icon;

  async function handleShare() {
    if (!data) return;

    const attentionLine =
      medicationsNeedingAttention.length > 0
        ? t("meds.adherence.shareNeedsAttention", {
            count: medicationsNeedingAttention.length,
            names: attentionNames.join(", "),
          })
        : t("meds.adherence.shareAllOnTrack");

    const medsText = sortedMedications
      .map((m) =>
        `- ${t("meds.adherence.shareFormatMed", {
          name: m.name,
          dosage: m.dosage || t("meds.adherence.dosageFallback"),
          taken: m.taken,
          scheduled: m.scheduled,
          streak: m.streak,
        })}`
      )
      .join("\n");

    const insightLines = insights
      .map((item) => `- ${item.title}: ${item.body}`)
      .join("\n");

    const todayLine =
      todayStillDueCount > 0
        ? t("meds.adherence.todayNeedsAttention", { count: todayStillDueCount })
        : t("meds.adherence.todayAllCovered");

    const text = [
      t("meds.adherence.title"),
      "",
      `${t("meds.adherence.thisWeek")}: ${data.weekPct}%`,
      `${t("meds.adherence.last30Days")}: ${data.monthPct}%`,
      `${t("meds.adherence.todayTitle")}: ${todayLine}`,
      `${t("meds.adherence.attentionTitle")}: ${attentionLine}`,
      "",
      `${t("meds.adherence.insightsTitle")}:`,
      insightLines,
      "",
      `${t("meds.adherence.perMedication")}:`,
      medsText,
      "",
      t("meds.adherence.shareFooter"),
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: t("meds.adherence.shareTitle"),
          text,
        });
        toast({
          title: t("meds.adherence.shareShared"),
          description: t("meds.adherence.shareSharedDesc"),
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      toast({
        title: t("meds.adherence.shareCopied"),
        description: t("meds.adherence.shareCopiedDesc"),
      });
    } catch {
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
              className="bg-white rounded-[24px] border border-vyva-border overflow-hidden mb-[14px]"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
            >
              <div className="px-[18px] py-[16px] bg-[linear-gradient(135deg,#F8F4EC_0%,#FFFFFF_100%)] border-b border-vyva-border">
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
                    style={{ background: summaryTone.iconBg }}
                  >
                    <SummaryIcon size={22} style={{ color: summaryTone.iconColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2 mb-1">
                      {t("meds.adherence.overviewTitle")}
                    </p>
                    <p className="font-body text-[20px] font-bold text-vyva-text-1 leading-tight">
                      {summaryTone.title}
                    </p>
                    <p className="font-body text-[14px] text-vyva-text-2 mt-1">
                      {summaryTone.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 px-[18px] py-[16px]">
                <div className="rounded-[18px] px-3 py-3" style={{ background: miniStatTone(onTrackCount).bg }}>
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: miniStatTone(onTrackCount).color }}>
                    {t("meds.adherence.statOnTrack")}
                  </p>
                  <p className="font-body text-[24px] font-bold mt-1" style={{ color: miniStatTone(onTrackCount).color }}>
                    {onTrackCount}
                  </p>
                </div>
                <div className="rounded-[18px] px-3 py-3" style={{ background: miniStatTone(medicationsNeedingAttention.length, false).bg }}>
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: miniStatTone(medicationsNeedingAttention.length, false).color }}>
                    {t("meds.adherence.statNeedsAttention")}
                  </p>
                  <p className="font-body text-[24px] font-bold mt-1" style={{ color: miniStatTone(medicationsNeedingAttention.length, false).color }}>
                    {medicationsNeedingAttention.length}
                  </p>
                </div>
                <div className="rounded-[18px] px-3 py-3" style={{ background: "#F5F3FF" }}>
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#6B21A8" }}>
                    {t("meds.adherence.statBestStreak")}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Flame size={16} style={{ color: "#6B21A8" }} />
                    <p className="font-body text-[24px] font-bold" style={{ color: "#6B21A8" }}>
                      {bestStreak}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-[18px] pb-[16px]">
                <div className="rounded-[18px] border border-vyva-border bg-[#FCFBF8] px-4 py-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.08em] text-vyva-text-2">
                        {t("meds.adherence.todayTitle")}
                      </p>
                      <p className="font-body text-[15px] text-vyva-text-1 mt-1">
                        {todayStillDueCount > 0
                          ? t("meds.adherence.todayNeedsAttention", { count: todayStillDueCount })
                          : t("meds.adherence.todayAllCovered")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: "#ECFDF5", color: "#0A7C4E" }}>
                        {t("meds.adherence.todayDone", { count: todayCompletedCount })}
                      </span>
                      <span className="rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: todayStillDueCount > 0 ? "#FEF3C7" : "#F3F4F6", color: todayStillDueCount > 0 ? "#C9890A" : "#6B7280" }}>
                        {t("meds.adherence.todayLeft", { count: todayStillDueCount })}
                      </span>
                    </div>
                  </div>

                  {attentionNames.length > 0 && (
                    <div className="mt-3 border-t border-vyva-border pt-3">
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.08em] text-vyva-text-2 mb-1">
                        {t("meds.adherence.attentionTitle")}
                      </p>
                      <p className="font-body text-[14px] text-vyva-text-1">
                        {t("meds.adherence.attentionSubtitle", { names: attentionNames.join(", ") })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

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

            <div
              className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
            >
              <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                <span className="font-body text-[14px] font-medium text-vyva-text-1">
                  {t("meds.adherence.insightsTitle")}
                </span>
              </div>
              <div className="px-[18px] py-[16px] flex flex-col gap-3">
                {insights.map((item, index) => {
                  const InsightIcon = item.icon;
                  return (
                    <div
                      key={index}
                      className="rounded-[18px] border border-vyva-border bg-[#FCFBF8] px-4 py-4 flex items-start gap-3"
                    >
                      <div
                        className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0"
                        style={{ background: item.iconBg }}
                      >
                        <InsightIcon size={18} style={{ color: item.iconColor }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-[13px] font-semibold text-vyva-text-1">
                          {item.title}
                        </p>
                        <p className="font-body text-[14px] text-vyva-text-2 mt-1">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
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
                {sortedMedications.map((med, i) => {
                  const streakLabel =
                    med.streak === 0
                      ? t("meds.adherence.streakZero")
                      : t("meds.adherence.streak", { days: med.streak });
                  const missedCount = med.dailyStatus.filter((status) => status === "missed").length;
                  const adherencePct = med.scheduled > 0 ? Math.round((med.taken / med.scheduled) * 100) : 0;
                  const pctTone =
                    adherencePct >= 80
                      ? { bg: "#ECFDF5", color: "#0A7C4E", bar: "#0A7C4E" }
                      : adherencePct >= 50
                        ? { bg: "#FEF3C7", color: "#C9890A", bar: "#C9890A" }
                        : { bg: "#FEF2F2", color: "#DC2626", bar: "#DC2626" };

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
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span
                            className="font-body text-[12px] font-medium px-2.5 py-1 rounded-full"
                            style={{ background: "#EDE9FE", color: "#6B21A8" }}
                          >
                            {streakLabel}
                          </span>
                          <span
                            className="font-body text-[12px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: pctTone.bg, color: pctTone.color }}
                          >
                            {adherencePct}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-body text-[13px] text-vyva-text-2">
                          {med.taken} {t("meds.adherence.taken")} / {med.scheduled} {t("meds.adherence.scheduled")}
                        </span>
                        {missedCount > 0 && (
                          <span className="font-body text-[12px] font-medium" style={{ color: "#DC2626" }}>
                            {missedCount} {t("meds.adherence.statusMissed").toLowerCase()}
                          </span>
                        )}
                      </div>

                      <div className="w-full h-[8px] rounded-full mb-4" style={{ background: "#F3F4F6" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, adherencePct)}%`,
                            background: pctTone.bar,
                          }}
                        />
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
