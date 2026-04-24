import { useState, useRef, useEffect, CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Home,
  Camera,
  ChevronLeft,
  X,
  Clock,
  Trash2,
  History,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type HomeScan = {
  id: string;
  risk_level: string;
  result_title: string;
  hazards: string[];
  advice: string;
  image_data?: string | null;
  scanned_at: string;
};

const RISK_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle; labelKey: string }> = {
  "safe":      { bg: "#DCFCE7", text: "#15803D", icon: CheckCircle,  labelKey: "safeHome.riskLabel.safe" },
  "low risk":  { bg: "#FEF9C3", text: "#A16207", icon: AlertTriangle, labelKey: "safeHome.riskLabel.lowRisk" },
  "high risk": { bg: "#FEE2E2", text: "#B91C1C", icon: ShieldAlert,   labelKey: "safeHome.riskLabel.highRisk" },
};

function getRiskColors(riskLevel: string) {
  return RISK_COLORS[riskLevel.toLowerCase()] ?? RISK_COLORS["safe"];
}

function riskLabelKey(riskLevel: string): string {
  const normalized = riskLevel.toLowerCase();
  if (normalized === "high risk") return "safeHome.riskLabel.highRisk";
  if (normalized === "low risk") return "safeHome.riskLabel.lowRisk";
  return "safeHome.riskLabel.safe";
}

const ScanFullScreenModal = ({
  scan,
  onClose,
  t,
}: {
  scan: HomeScan;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const colors = getRiskColors(scan.risk_level);
  const modalDate = new Date(scan.scanned_at).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      data-testid="modal-home-scan-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label={t("safeHome.viewFullImage", "View full image")}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-[18px] py-[14px] flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[8px]">
          <span
            data-testid="text-modal-home-scan-risk"
            className="font-body text-[12px] font-semibold px-[10px] py-[3px] rounded-full"
            style={{ background: colors.bg, color: colors.text }}
          >
            {t(riskLabelKey(scan.risk_level), scan.risk_level)}
          </span>
          <p
            data-testid="text-modal-home-scan-title"
            className="font-body text-[14px] font-semibold text-white"
          >
            {scan.result_title}
          </p>
        </div>
        <button
          data-testid="button-close-fullscreen-home-scan"
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className="p-[8px] rounded-full transition-colors hover:bg-white/20 active:scale-95"
        >
          <X size={20} color="#fff" />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-[18px] min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {scan.image_data && (
          <img
            data-testid="img-modal-home-scan-full"
            src={scan.image_data}
            alt={scan.result_title}
            className="max-w-full max-h-full rounded-[16px] object-contain"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
          />
        )}
      </div>

      <div
        data-testid="section-modal-home-scan-advice"
        className="flex-shrink-0 rounded-t-[24px] px-[20px] pt-[18px] pb-[28px]"
        style={{ background: "#FFFFFF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[6px] mb-[10px]">
          <Clock size={12} style={{ color: "#9CA3AF" }} />
          <p
            data-testid="text-modal-home-scan-date"
            className="font-body text-[12px]"
            style={{ color: "#9CA3AF" }}
          >
            {modalDate}
          </p>
        </div>
        {scan.hazards.length > 0 && (
          <>
            <p
              className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]"
              style={{ color: "#7C3AED" }}
            >
              {t("safeHome.hazardsFound", "Hazards Spotted")}
            </p>
            <ul className="mb-[10px] space-y-[4px]">
              {scan.hazards.map((h, i) => (
                <li key={i} className="flex items-start gap-[6px]">
                  <AlertTriangle size={12} style={{ color: "#C9890A", marginTop: 2, flexShrink: 0 }} />
                  <span className="font-body text-[13px] text-vyva-text-1">{h}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p
          className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]"
          style={{ color: "#7C3AED" }}
        >
          {t("safeHome.advice", "Safety Advice")}
        </p>
        <p
          data-testid="text-modal-home-scan-advice"
          className="font-body text-[14px] text-vyva-text-1 leading-snug"
        >
          {scan.advice}
        </p>
      </div>
    </div>
  );
};

const SafeHomeScreen = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<null | {
    riskLevel: string;
    resultTitle: string;
    hazards: string[];
    advice: string;
  }>(null);
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);
  const [fullScreenScan, setFullScreenScan] = useState<HomeScan | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cardStyle: CSSProperties = {
    background: "#FFFFFF",
    borderRadius: "20px",
    border: "1px solid #EDE5DB",
    overflow: "hidden",
  };

  const { data: pastScans = [], isLoading: pastScansLoading } = useQuery<HomeScan[]>({
    queryKey: ["/api/home-scan/history"],
    retry: false,
  });

  const deleteScanMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/home-scan/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/home-scan/history"] });
      toast({ description: t("safeHome.deleted", "Scan deleted") });
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
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = objectUrl;
    });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setResult(null);
    setAnalyzing(true);

    const errorFallback = {
      riskLevel: "Low",
      resultTitle: t("safeHome.errorTitle", "Analysis Unavailable"),
      hazards: [] as string[],
      advice: t("safeHome.errorAdvice", "We could not analyse the image. Please try again with a clearer photo."),
    };

    compressImage(file)
      .then(async (dataUrl) => {
        const res = await apiFetch("/api/home-scan", {
          method: "POST",
          body: JSON.stringify({ image: dataUrl, language: i18n.language }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as {
          riskLevel: string;
          resultTitle: string;
          hazards: string[];
          advice: string;
          isFallback?: boolean;
        };
        if (data.isFallback) {
          setResult(errorFallback);
        } else {
          setResult(data);
          queryClient.invalidateQueries({ queryKey: ["/api/home-scan/history"] });
        }
      })
      .catch((err) => {
        console.error("[home-scan] error:", err);
        setResult(errorFallback);
      })
      .finally(() => {
        setAnalyzing(false);
      });
  };

  const resultColors = result ? getRiskColors(result.riskLevel) : null;
  const ResultIcon = resultColors?.icon ?? CheckCircle;

  return (
    <>
      {fullScreenScan && (
        <ScanFullScreenModal
          scan={fullScreenScan}
          onClose={() => setFullScreenScan(null)}
          t={t}
        />
      )}

      <div className="px-[22px] pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2 mb-[18px]">
          <button
            data-testid="button-back-safe-home"
            onClick={() => navigate(-1)}
            className="w-[40px] h-[40px] rounded-full flex items-center justify-center transition-colors active:scale-95"
            style={{ background: "#F5EFE4", border: "1px solid #EDE5DB" }}
          >
            <ChevronLeft size={20} style={{ color: "#6B21A8" }} />
          </button>
          <div>
            <h1 className="font-display italic font-normal text-[22px] text-vyva-text-1 leading-tight">
              {t("safeHome.headline", "Safe Home\nScanner")}
            </h1>
            <p className="font-body text-[13px] text-vyva-text-2">
              {t("safeHome.subtitle", "Spot hazards before they cause harm")}
            </p>
          </div>
        </div>

        {/* Scan a Room card */}
        <div style={cardStyle} className="mb-[14px]">
          <div
            className="px-[18px] py-[13px] flex items-center gap-3"
            style={{ background: "#F5EFE4", borderBottom: "1px solid #EDE5DB" }}
          >
            <div
              className="w-[36px] h-[36px] rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#EDE9FE" }}
            >
              <Home size={18} style={{ color: "#6B21A8" }} />
            </div>
            <div className="flex-1">
              <p className="font-body text-[14px] font-semibold text-vyva-text-1">
                {t("safeHome.scanTitle", "Scan a Room")}
              </p>
              <p className="font-body text-[12px] text-vyva-text-2">
                {t("safeHome.scanSubtitle", "Take or upload a photo of any room to check for hazards")}
              </p>
            </div>
          </div>

          <div className="p-[18px]">
            {/* Analyzing state */}
            {analyzing && (
              <div
                data-testid="section-home-scan-analyzing"
                className="rounded-[14px] p-[20px] flex flex-col items-center gap-3 mb-[14px]"
                style={{ background: "#F5F3FF" }}
              >
                <div
                  className="w-[48px] h-[48px] rounded-full flex items-center justify-center animate-pulse"
                  style={{ background: "#EDE9FE" }}
                >
                  <Home size={22} style={{ color: "#6B21A8" }} />
                </div>
                <p className="font-body text-[14px] font-medium text-center" style={{ color: "#6B21A8" }}>
                  {t("safeHome.analyzing", "Analysing for hazards…")}
                </p>
              </div>
            )}

            {/* Result */}
            {result && !analyzing && (
              <div
                data-testid="section-home-scan-result"
                className="rounded-[14px] p-[16px] mb-[14px]"
                style={{ background: resultColors!.bg }}
              >
                <div className="flex items-center gap-[8px] mb-[8px]">
                  <ResultIcon size={18} style={{ color: resultColors!.text }} />
                  <span
                    data-testid="text-home-scan-risk"
                    className="font-body text-[13px] font-semibold"
                    style={{ color: resultColors!.text }}
                  >
                    {t(riskLabelKey(result.riskLevel), result.riskLevel)}
                  </span>
                </div>
                <p
                  data-testid="text-home-scan-result-title"
                  className="font-body text-[15px] font-semibold text-vyva-text-1 mb-[6px]"
                >
                  {result.resultTitle}
                </p>
                {result.hazards.length > 0 && (
                  <div className="mb-[10px]">
                    <p
                      className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]"
                      style={{ color: "#7C3AED" }}
                    >
                      {t("safeHome.hazardsFound", "Hazards Spotted")}
                    </p>
                    <ul className="space-y-[4px]">
                      {result.hazards.map((h, i) => (
                        <li
                          key={i}
                          data-testid={`text-home-scan-hazard-${i}`}
                          className="flex items-start gap-[6px]"
                        >
                          <AlertTriangle
                            size={12}
                            style={{ color: "#C9890A", marginTop: 2, flexShrink: 0 }}
                          />
                          <span className="font-body text-[13px] text-vyva-text-1">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p
                  className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[4px]"
                  style={{ color: "#7C3AED" }}
                >
                  {t("safeHome.advice", "Safety Advice")}
                </p>
                <p
                  data-testid="text-home-scan-advice"
                  className="font-body text-[13px] text-vyva-text-1 leading-snug"
                >
                  {result.advice}
                </p>
              </div>
            )}

            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
              data-testid="input-home-scan-file"
            />
            <button
              data-testid="button-home-scan-take-photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 rounded-[14px] py-[14px] font-body text-[15px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #6B21A8 0%, #9333EA 100%)",
                color: "#FFFFFF",
                boxShadow: "0 4px 16px rgba(107,33,168,0.30)",
              }}
            >
              <Camera size={18} />
              {result
                ? t("safeHome.scanAgain", "Scan Another Room")
                : t("safeHome.takePhoto", "Take or Upload a Photo")}
            </button>
          </div>
        </div>

        {/* Past Scans */}
        <div style={cardStyle}>
          <div
            className="px-[18px] py-[13px] flex items-center gap-3"
            style={{ background: "#F5EFE4", borderBottom: "1px solid #EDE5DB" }}
          >
            <div
              className="w-[36px] h-[36px] rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#F5EFE4" }}
            >
              <History size={18} style={{ color: "#6B21A8" }} />
            </div>
            <p className="font-body text-[14px] font-semibold text-vyva-text-1">
              {t("safeHome.history", "Past Scans")}
            </p>
          </div>

          <div className="p-[14px]">
            {pastScansLoading ? (
              <div className="flex justify-center py-6">
                <div
                  className="w-[28px] h-[28px] rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#6B21A8", borderTopColor: "transparent" }}
                />
              </div>
            ) : pastScans.length === 0 ? (
              <p
                data-testid="text-home-scan-no-history"
                className="font-body text-[13px] text-center py-4"
                style={{ color: "#9CA3AF" }}
              >
                {t("safeHome.noHistory", "No scans yet. Scan a room to get started.")}
              </p>
            ) : (
              <div className="space-y-[10px]">
                {pastScans.map((scan) => {
                  const colors = getRiskColors(scan.risk_level);
                  const ScanIcon = colors.icon;
                  const isExpanded = expandedScanId === scan.id;
                  const scanDate = new Date(scan.scanned_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <div
                      key={scan.id}
                      data-testid={`card-home-scan-${scan.id}`}
                      className="rounded-[14px] border"
                      style={{ borderColor: "#EDE5DB", overflow: "hidden" }}
                    >
                      <button
                        className="w-full flex items-center gap-[12px] p-[12px] text-left transition-colors active:bg-gray-50"
                        onClick={() =>
                          setExpandedScanId(isExpanded ? null : scan.id)
                        }
                      >
                        {scan.image_data ? (
                          <img
                            src={scan.image_data}
                            alt={scan.result_title}
                            className="w-[48px] h-[48px] rounded-[10px] object-cover flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullScreenScan(scan);
                            }}
                          />
                        ) : (
                          <div
                            className="w-[48px] h-[48px] rounded-[10px] flex items-center justify-center flex-shrink-0"
                            style={{ background: "#F5F3FF" }}
                          >
                            <Home size={22} style={{ color: "#6B21A8" }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[6px] mb-[2px]">
                            <span
                              data-testid={`text-home-scan-risk-${scan.id}`}
                              className="font-body text-[11px] font-semibold px-[8px] py-[2px] rounded-full"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {t(riskLabelKey(scan.risk_level), scan.risk_level)}
                            </span>
                          </div>
                          <p className="font-body text-[13px] font-semibold text-vyva-text-1 truncate">
                            {scan.result_title}
                          </p>
                          <div className="flex items-center gap-[4px] mt-[2px]">
                            <Clock size={10} style={{ color: "#9CA3AF" }} />
                            <p className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>
                              {scanDate}
                            </p>
                          </div>
                        </div>
                        <ScanIcon size={16} style={{ color: colors.text, flexShrink: 0 }} />
                      </button>

                      {isExpanded && (
                        <div
                          className="px-[12px] pb-[12px]"
                          style={{ borderTop: "1px solid #EDE5DB" }}
                        >
                          {scan.hazards.length > 0 && (
                            <div className="pt-[10px] mb-[8px]">
                              <p
                                className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[4px]"
                                style={{ color: "#7C3AED" }}
                              >
                                {t("safeHome.hazardsFound", "Hazards Spotted")}
                              </p>
                              <ul className="space-y-[3px]">
                                {scan.hazards.map((h, i) => (
                                  <li key={i} className="flex items-start gap-[6px]">
                                    <AlertTriangle
                                      size={11}
                                      style={{ color: "#C9890A", marginTop: 2, flexShrink: 0 }}
                                    />
                                    <span className="font-body text-[12px] text-vyva-text-1">{h}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p
                            className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[4px] pt-[8px]"
                            style={{ color: "#7C3AED" }}
                          >
                            {t("safeHome.advice", "Safety Advice")}
                          </p>
                          <p className="font-body text-[12px] text-vyva-text-1 leading-snug mb-[10px]">
                            {scan.advice}
                          </p>
                          <div className="flex gap-[8px]">
                            {scan.image_data && (
                              <button
                                data-testid={`button-view-home-scan-image-${scan.id}`}
                                onClick={() => setFullScreenScan(scan)}
                                className="flex-1 py-[8px] rounded-[10px] font-body text-[12px] font-medium transition-all active:scale-95"
                                style={{ background: "#F5F3FF", color: "#6B21A8" }}
                              >
                                {t("safeHome.viewImage", "View Photo")}
                              </button>
                            )}
                            <button
                              data-testid={`button-delete-home-scan-${scan.id}`}
                              onClick={() => deleteScanMutation.mutate(scan.id)}
                              disabled={deleteScanMutation.isPending}
                              className="flex items-center justify-center gap-1 px-[14px] py-[8px] rounded-[10px] font-body text-[12px] font-medium transition-all active:scale-95 disabled:opacity-50"
                              style={{ background: "#FEE2E2", color: "#B91C1C" }}
                            >
                              <Trash2 size={12} />
                              {t("common.delete", "Delete")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SafeHomeScreen;
