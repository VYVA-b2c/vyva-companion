import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Footprints, Bike, PersonStanding, Dumbbell, Wind, CheckCircle2, Loader2, Pencil, Home, Camera, AlertTriangle, ShieldAlert, ChevronRight } from "lucide-react";
import VoiceHero from "@/components/VoiceHero";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { useNavigate } from "react-router-dom";
import type { ActivityLog } from "../../shared/schema";
import { useProfile } from "@/contexts/ProfileContext";

const ACTIVITY_TYPES = [
  { key: "Walking",    icon: Footprints,     labelKey: "activity.types.walking",    bg: "#FEF3C7", color: "#B45309" },
  { key: "Cycling",    icon: Bike,           labelKey: "activity.types.cycling",    bg: "#ECFDF5", color: "#059669" },
  { key: "Stretching", icon: PersonStanding, labelKey: "activity.types.stretching", bg: "#F5F3FF", color: "#6B21A8" },
  { key: "Exercise",   icon: Dumbbell,       labelKey: "activity.types.exercise",   bg: "#FFF1F2", color: "#BE185D" },
  { key: "Breathing",  icon: Wind,           labelKey: "activity.types.breathing",  bg: "#F0FDFA", color: "#0F766E" },
];

const ACTIVITY_ICON_MAP: Record<string, (typeof ACTIVITY_TYPES)[number]> = Object.fromEntries(
  ACTIVITY_TYPES.map((a) => [a.key, a]),
);

const DURATIONS = [10, 20, 30, 45, 60];
const TARGET_STEPS = 6_000;

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ActivitySummary {
  entries: ActivityLog[];
  total_active_minutes: number;
  total_calories: number;
  today_steps: number;
}

type HomeScanResult = { riskLevel: string; resultTitle: string; hazards: string[]; advice: string };
type HomeScanRow = { id: string; risk_level: string; result_title: string; scanned_at: string; image_data?: string };

const HOME_RISK_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  "safe":      { bg: "#DCFCE7", text: "#15803D", icon: CheckCircle2 },
  "low risk":  { bg: "#FEF9C3", text: "#A16207", icon: AlertTriangle },
  "high risk": { bg: "#FEE2E2", text: "#B91C1C", icon: ShieldAlert },
};

function homeRiskColors(level: string) {
  return HOME_RISK_COLORS[level.toLowerCase()] ?? HOME_RISK_COLORS["safe"];
}

function homeRiskLabelKey(level: string): string {
  const n = level.toLowerCase();
  if (n === "high risk") return "safeHome.riskLabel.highRisk";
  if (n === "low risk") return "safeHome.riskLabel.lowRisk";
  return "safeHome.riskLabel.safe";
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const ActivityScreen = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(20);
  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsInput, setStepsInput] = useState("");
  const [homeAnalyzing, setHomeAnalyzing] = useState(false);
  const [homeResult, setHomeResult] = useState<HomeScanResult | null>(null);
  const homeScanRef = useRef<HTMLInputElement>(null);
  const { data: homeScanHistory } = useQuery<HomeScanRow[]>({ queryKey: ["/api/home-scan"] });
  const { firstName } = useProfile();

  const { data, isLoading } = useQuery<ActivitySummary>({
    queryKey: ["/api/activity"],
  });

  const logMutation = useMutation({
    mutationFn: async (body: { activity_type: string; duration_minutes: number }) => {
      const res = await apiFetch("/api/activity/log", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to log activity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setSelected(null);
    },
  });

  const stepsMutation = useMutation({
    mutationFn: async (steps: number) => {
      const res = await apiFetch("/api/activity/steps", {
        method: "POST",
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) throw new Error("Failed to save steps");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setEditingSteps(false);
      setStepsInput("");
    },
  });

  const handleHomePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setHomeResult(null);
    setHomeAnalyzing(true);
    const errorFallback: HomeScanResult = {
      riskLevel: "Safe",
      resultTitle: t("safeHome.errorTitle", "Analysis Unavailable"),
      hazards: [],
      advice: t("safeHome.errorAdvice", "We could not analyse the image. Please try again."),
    };
    compressImageFile(file)
      .then(async (dataUrl) => {
        const res = await apiFetch("/api/home-scan", {
          method: "POST",
          body: JSON.stringify({ image: dataUrl, language: i18n.language }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as HomeScanResult & { isFallback?: boolean };
        setHomeResult(data.isFallback ? errorFallback : data);
        if (!data.isFallback) {
          queryClient.invalidateQueries({ queryKey: ["/api/home-scan"] });
        }
      })
      .catch(() => setHomeResult(errorFallback))
      .finally(() => setHomeAnalyzing(false));
  };

  const handleLog = () => {
    if (!selected || logMutation.isPending) return;
    logMutation.mutate({ activity_type: selected, duration_minutes: duration });
  };

  const handleSaveSteps = () => {
    const val = parseInt(stepsInput, 10);
    if (isNaN(val) || val < 0) return;
    stepsMutation.mutate(val);
  };

  const todaySteps = data?.today_steps ?? 0;
  const stepPct = Math.min(100, Math.round((todaySteps / TARGET_STEPS) * 100));
  const activeMins = data?.total_active_minutes ?? 0;
  const calsEstimate = data?.total_calories ?? 0;
  const entries = data?.entries ?? [];

  const headlineText = firstName
    ? t("activity.headlineWithName", { name: firstName })
    : t("activity.headline");

  const selectedType = ACTIVITY_TYPES.find((a) => a.key === selected);

  return (
    <div className="px-[22px]">
      <VoiceHero
        sourceText={t("activity.voiceSource")}
        headline={<>{headlineText}</>}
        contextHint="daily movement"
      >
        <div
          className="mt-[14px] pt-[14px] flex justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}
        >
          {[
            { val: todaySteps > 0 ? todaySteps.toLocaleString() : "—", label: t("activity.stepsToday") },
            { val: `${activeMins}${t("activity.minAbbr")}`, label: t("activity.activeTime") },
            { val: `${calsEstimate} ${t("activity.calUnit")}`, label: t("activity.calBurned") },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-body text-[17px] font-medium text-white" data-testid={`text-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {s.val}
              </p>
              <p className="font-body text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </VoiceHero>

      {/* Daily step goal */}
      <div
        className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
      >
        <div
          className="px-[18px] py-[13px] border-b border-vyva-border flex items-center justify-between"
          style={{ background: "#F5EFE4" }}
        >
          <span className="font-body text-[14px] font-medium text-vyva-text-1">
            {t("activity.dailyStepGoal")}
          </span>
          <button
            data-testid="button-edit-steps"
            onClick={() => {
              setEditingSteps(true);
              setStepsInput(String(todaySteps));
            }}
            className="flex items-center gap-[4px] font-body text-[12px] text-vyva-text-2"
          >
            <Pencil size={12} />
            {t("activity.updateSteps")}
          </button>
        </div>
        <div className="px-[18px] py-[16px]">
          {editingSteps ? (
            <div className="flex items-center gap-[10px] mb-[12px]">
              <input
                data-testid="input-steps"
                type="number"
                min={0}
                max={100000}
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                placeholder={t("activity.enterSteps")}
                className="flex-1 px-[12px] py-[9px] rounded-[10px] border border-vyva-border font-body text-[14px] text-vyva-text-1 outline-none focus:border-[#B45309]"
              />
              <button
                data-testid="button-save-steps"
                onClick={handleSaveSteps}
                disabled={stepsMutation.isPending}
                className="px-[14px] py-[9px] rounded-[10px] font-body text-[13px] font-semibold flex items-center gap-[6px]"
                style={{ background: "#B45309", color: "#fff" }}
              >
                {stepsMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                {t("activity.save")}
              </button>
              <button
                data-testid="button-cancel-steps"
                onClick={() => setEditingSteps(false)}
                className="px-[14px] py-[9px] rounded-[10px] font-body text-[13px]"
                style={{ background: "#F5EFE4", color: "#92745C" }}
              >
                {t("activity.cancel")}
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between mb-[10px]">
            <span className="font-body text-[15px] font-semibold text-vyva-text-1" data-testid="text-steps-today">
              {todaySteps > 0 ? t("activity.stepsCount", { count: todaySteps.toLocaleString() }) : t("activity.noStepsYet")}
            </span>
            <span className="font-body text-[13px] text-vyva-text-2">
              {t("activity.goal", { steps: TARGET_STEPS.toLocaleString() })}
            </span>
          </div>
          <div
            className="w-full h-[10px] rounded-full overflow-hidden"
            style={{ background: "#F5EFE4" }}
            data-testid="progress-steps"
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${stepPct}%`, background: "#B45309" }}
            />
          </div>
          <p className="font-body text-[12px] text-vyva-text-2 mt-[8px]">
            {todaySteps > 0
              ? t("activity.progressPct", { pct: stepPct })
              : t("activity.tapUpdate")}
          </p>
        </div>
      </div>

      {/* Log movement */}
      <div
        className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
      >
        <div
          className="px-[18px] py-[13px] border-b border-vyva-border"
          style={{ background: "#F5EFE4" }}
        >
          <span className="font-body text-[14px] font-medium text-vyva-text-1">
            {t("activity.logMovement")}
          </span>
        </div>
        <div className="px-[18px] pt-[16px] pb-[18px]">
          <div className="grid grid-cols-5 gap-[10px] mb-[16px]">
            {ACTIVITY_TYPES.map(({ key, icon: Icon, labelKey, bg, color }) => (
              <button
                key={key}
                data-testid={`button-activity-${key.toLowerCase()}`}
                onClick={() => setSelected(selected === key ? null : key)}
                className="flex flex-col items-center gap-[8px] py-[14px] rounded-[16px] transition-all"
                style={
                  selected === key
                    ? { background: bg, border: "2px solid " + color, boxShadow: `0 2px 8px ${color}30` }
                    : { background: "#FAFAFA", border: "1px solid #EDE5DB" }
                }
              >
                <div
                  className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center"
                  style={{ background: selected === key ? bg : "#F5EFE4" }}
                >
                  <Icon size={18} style={{ color: selected === key ? color : "#92745C" }} />
                </div>
                <span
                  className="font-body text-[10px] font-medium text-center leading-tight"
                  style={{ color: selected === key ? color : "#92745C" }}
                >
                  {t(labelKey)}
                </span>
              </button>
            ))}
          </div>

          <p className="font-body text-[13px] font-medium text-vyva-text-1 mb-[8px]">{t("activity.duration")}</p>
          <div className="flex gap-[8px] flex-wrap mb-[16px]">
            {DURATIONS.map((d) => (
              <button
                key={d}
                data-testid={`button-duration-${d}`}
                onClick={() => setDuration(d)}
                className="px-[14px] py-[7px] rounded-full font-body text-[13px] font-medium transition-all"
                style={
                  duration === d
                    ? { background: "#B45309", color: "#fff" }
                    : { background: "#F5EFE4", color: "#92745C" }
                }
              >
                {d}{t("activity.min")}
              </button>
            ))}
          </div>

          <button
            data-testid="button-log-activity"
            disabled={!selected || logMutation.isPending}
            onClick={handleLog}
            className="w-full py-[14px] rounded-[16px] font-body text-[15px] font-semibold transition-all flex items-center justify-center gap-[8px]"
            style={
              selected && !logMutation.isPending
                ? { background: "#B45309", color: "#fff", boxShadow: "0 4px 14px rgba(180,83,9,0.25)" }
                : { background: "#F5EFE4", color: "#BFA08A" }
            }
          >
            {logMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {logMutation.isPending
              ? t("activity.saving")
              : selected && selectedType
              ? t("activity.logActivity", { duration, type: t(selectedType.labelKey) })
              : t("activity.selectActivity")}
          </button>

          {logMutation.isSuccess && (
            <div
              className="mt-[12px] flex items-center gap-[8px] px-[14px] py-[10px] rounded-[12px]"
              style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}
              data-testid="status-log-success"
            >
              <CheckCircle2 size={16} style={{ color: "#16A34A" }} />
              <span className="font-body text-[13px] font-medium" style={{ color: "#15803D" }}>
                {t("activity.activityLogged")}
              </span>
            </div>
          )}

          {logMutation.isError && (
            <div
              className="mt-[12px] flex items-center gap-[8px] px-[14px] py-[10px] rounded-[12px]"
              style={{ background: "#FFF1F2", border: "1px solid #FECDD3" }}
              data-testid="status-log-error"
            >
              <span className="font-body text-[13px] font-medium" style={{ color: "#BE185D" }}>
                {t("activity.couldNotSave")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Safe Home Check */}
      <div
        className="mt-[14px] bg-white rounded-[20px] border border-vyva-border overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
      >
        <div
          className="px-[18px] py-[13px] border-b border-vyva-border flex items-center justify-between"
          style={{ background: "#F5EFE4" }}
        >
          <div className="flex items-center gap-[10px]">
            <div
              className="w-[32px] h-[32px] rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#ECFDF5" }}
            >
              <Home size={16} style={{ color: "#0A7C4E" }} />
            </div>
            <span className="font-body text-[14px] font-medium text-vyva-text-1">
              {t("safeHome.scanTitle", "Safe Home Check")}
            </span>
          </div>
          <button
            data-testid="button-view-all-home-scans"
            onClick={() => navigate("/safe-home")}
            className="flex items-center gap-[4px] font-body text-[12px]"
            style={{ color: "#6B21A8" }}
          >
            {t("safeHome.history", "Past Scans")}
            <ChevronRight size={12} />
          </button>
        </div>
        <div className="px-[18px] py-[16px]">
          <p className="font-body text-[13px] text-vyva-text-2 mb-[12px]">
            {t("safeHome.scanSubtitle", "Take or upload a photo of any room to check for hazards")}
          </p>

          {homeAnalyzing && (
            <div
              data-testid="section-home-scan-analyzing-activity"
              className="rounded-[12px] p-[14px] flex items-center gap-[10px] mb-[12px]"
              style={{ background: "#F5F3FF" }}
            >
              <Loader2 size={18} className="animate-spin flex-shrink-0" style={{ color: "#6B21A8" }} />
              <p className="font-body text-[13px] font-medium" style={{ color: "#6B21A8" }}>
                {t("safeHome.analyzing", "Analysing for hazards…")}
              </p>
            </div>
          )}

          {homeResult && !homeAnalyzing && (() => {
            const rc = homeRiskColors(homeResult.riskLevel);
            const RiskIcon = rc.icon;
            return (
              <div
                data-testid="section-home-scan-result-activity"
                className="rounded-[12px] p-[14px] mb-[12px]"
                style={{ background: rc.bg }}
              >
                <div className="flex items-center gap-[6px] mb-[6px]">
                  <RiskIcon size={15} style={{ color: rc.text }} />
                  <span
                    data-testid="text-home-scan-risk-activity"
                    className="font-body text-[12px] font-semibold"
                    style={{ color: rc.text }}
                  >
                    {t(homeRiskLabelKey(homeResult.riskLevel), homeResult.riskLevel)}
                  </span>
                </div>
                <p className="font-body text-[14px] font-semibold text-vyva-text-1 mb-[6px]">
                  {homeResult.resultTitle}
                </p>
                {homeResult.hazards.length > 0 && (
                  <ul className="space-y-[4px] mb-[8px]">
                    {homeResult.hazards.slice(0, 3).map((h, i) => (
                      <li key={i} className="flex items-start gap-[6px]">
                        <AlertTriangle size={11} style={{ color: "#C9890A", marginTop: 2, flexShrink: 0 }} />
                        <span className="font-body text-[12px] text-vyva-text-1">{h}</span>
                      </li>
                    ))}
                    {homeResult.hazards.length > 3 && (
                      <li className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>
                        +{homeResult.hazards.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
                <p className="font-body text-[12px] text-vyva-text-1 leading-snug">{homeResult.advice}</p>
              </div>
            );
          })()}

          <input
            ref={homeScanRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleHomePhotoSelect}
            data-testid="input-home-scan-file-activity"
          />
          <button
            data-testid="button-home-scan-take-photo-activity"
            onClick={() => homeScanRef.current?.click()}
            disabled={homeAnalyzing}
            className="w-full flex items-center justify-center gap-2 rounded-[14px] py-[13px] font-body text-[14px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #0A7C4E 0%, #10B981 100%)",
              color: "#FFFFFF",
              boxShadow: "0 4px 14px rgba(10,124,78,0.25)",
            }}
          >
            <Camera size={16} />
            {homeResult
              ? t("safeHome.scanAgain", "Scan Another Room")
              : t("safeHome.takePhoto", "Take or Upload a Photo")}
          </button>

          {homeScanHistory && homeScanHistory.length > 0 && (
            <div className="mt-[14px]" data-testid="section-home-scan-history-activity">
              <p className="font-body text-[12px] font-medium text-vyva-text-2 mb-[8px]">
                {t("safeHome.history", "Past Scans")}
              </p>
              <div className="space-y-[6px]">
                {homeScanHistory.slice(0, 3).map((scan) => {
                  const rc = homeRiskColors(scan.risk_level);
                  const RiskIcon = rc.icon;
                  return (
                    <div
                      key={scan.id}
                      data-testid={`row-home-scan-${scan.id}`}
                      className="flex items-center gap-[10px] rounded-[10px] px-[12px] py-[9px]"
                      style={{ background: "#F9F7F4" }}
                    >
                      {scan.image_data && (
                        <img
                          src={scan.image_data}
                          alt=""
                          className="w-[36px] h-[36px] rounded-[8px] object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-[13px] font-medium text-vyva-text-1 truncate">
                          {scan.result_title}
                        </p>
                        <p className="font-body text-[11px] text-vyva-text-2">
                          {new Date(scan.scanned_at).toLocaleDateString(i18n.language, { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <div
                        className="flex items-center gap-[4px] rounded-[6px] px-[7px] py-[3px] flex-shrink-0"
                        style={{ background: rc.bg }}
                      >
                        <RiskIcon size={10} style={{ color: rc.text }} />
                        <span className="font-body text-[10px] font-semibold" style={{ color: rc.text }}>
                          {t(homeRiskLabelKey(scan.risk_level), scan.risk_level)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {homeScanHistory.length > 3 && (
                  <button
                    data-testid="button-view-more-home-scans-activity"
                    onClick={() => navigate("/safe-home")}
                    className="w-full text-center font-body text-[12px] py-[6px] rounded-[8px] transition-opacity hover:opacity-70"
                    style={{ color: "#6B21A8" }}
                  >
                    +{homeScanHistory.length - 3} {t("common.more", "more")} — {t("safeHome.viewAll", "View all")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's activity summary */}
      <div
        className="mt-[14px] mb-4 bg-white rounded-[20px] border border-vyva-border overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
      >
        <div
          className="px-[18px] py-[13px] border-b border-vyva-border"
          style={{ background: "#F5EFE4" }}
        >
          <span className="font-body text-[14px] font-medium text-vyva-text-1">
            {t("activity.todaysSummary")}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-[32px]">
            <Loader2 size={20} className="animate-spin" style={{ color: "#B45309" }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="px-[18px] py-[24px] text-center">
            <p className="font-body text-[14px] text-vyva-text-2">{t("activity.noMovement")}</p>
            <p className="font-body text-[12px] text-vyva-text-2 mt-[4px]">{t("activity.logToStart")}</p>
          </div>
        ) : (
          entries.map((entry, i) => {
            const meta = ACTIVITY_ICON_MAP[entry.activity_type] ?? ACTIVITY_TYPES[0];
            const Icon = meta.icon;
            return (
              <div
                key={entry.id}
                className="flex items-center gap-[14px] px-[18px] py-[13px] border-b border-vyva-border last:border-b-0"
                data-testid={`row-activity-${i}`}
              >
                <div
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                  style={{ background: meta.bg }}
                >
                  <Icon size={18} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-medium text-vyva-text-1">{t(meta.labelKey)}</p>
                  <p className="font-body text-[13px] text-vyva-text-2">
                    {formatTime(entry.logged_at)} · {entry.duration_minutes} {t("activity.min")}
                  </p>
                </div>
                <span
                  className="font-body text-[12px] font-medium px-[10px] py-[4px] rounded-full flex-shrink-0"
                  style={{ background: "#FEF3C7", color: "#92400E" }}
                >
                  {entry.calories} {t("activity.calUnit")}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityScreen;
