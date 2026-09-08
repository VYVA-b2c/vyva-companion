import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, HeartPulse, Loader2, RefreshCw, ScanLine, Wind } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { apiFetch } from "@/lib/queryClient";
import { captureVitalLensPayload } from "@/lib/vitalLens";
import type { ProposedVitalsReading, VitalsParsingResult } from "../../shared/vitalsParsing";

export type VitalLensScanStatus = "idle" | "camera" | "scanning" | "reading" | "not_configured" | "failed";

export default function VitalLensFaceScan({
  onReadings,
  onLocalFallback,
  onStatusChange,
}: {
  onReadings: (readings: ProposedVitalsReading[]) => void;
  onLocalFallback: () => void;
  onStatusChange?: (status: VitalLensScanStatus) => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useHomeMasterTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<VitalLensScanStatus>("idle");
  const [message, setMessage] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  const startScan = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("failed");
      setMessage(t("statusVitals.faceScan.unsupported", "Camera access is not available on this browser."));
      return;
    }

    setMessage("");
    try {
      setStatus("camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current || !canvasRef.current) throw new Error("Camera preview is not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus("scanning");
      const payload = await captureVitalLensPayload(videoRef.current, canvasRef.current);
      stopCamera();
      setStatus("reading");

      const response = await apiFetch("/api/vitals-engine/face-scan", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(t("statusVitals.faceScan.failed", "Face scan did not complete."));
      const result = await response.json() as VitalsParsingResult;
      const readings = result.proposed_readings.filter((reading) => (
        reading.signal_type === "resting_hr_bpm" || reading.signal_type === "respiratory_rate"
      ));
      if (readings.length) {
        onReadings(readings);
        return;
      }
      setStatus("not_configured");
      setMessage(result.clarification_prompt || t(
        "statusVitals.faceScan.notConfigured",
        "VitalLens is not configured yet. You can use the local phone estimate instead.",
      ));
    } catch (error) {
      stopCamera();
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : t("statusVitals.faceScan.failed", "Face scan did not complete."));
    }
  }, [onReadings, stopCamera, t]);

  const active = status === "camera" || status === "scanning" || status === "reading";
  const showFallback = status === "not_configured" || status === "failed";
  const statusText = {
    idle: t("statusVitals.faceScan.idle", "Use your front camera for heart rate and breathing estimates."),
    camera: t("statusVitals.faceScan.camera", "Opening camera…"),
    scanning: t("statusVitals.faceScan.scanning", "Hold still while VYVA captures a short face scan."),
    reading: t("statusVitals.faceScan.reading", "Reading estimates securely…"),
    not_configured: message,
    failed: message,
  }[status];

  return (
    <section
      className={`overflow-hidden rounded-[24px] border ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#E0D1EC] bg-white"}`}
      data-testid="vital-lens-face-scan"
    >
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1.1fr] sm:items-center sm:p-5">
        <div>
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] ${isDark ? "bg-[#49355E]" : "bg-[#F3E8FF]"}`}>
              <VyvaIcon icon={Camera} accent="pulse" size={25} />
            </span>
            <div>
              <p className={`font-body text-[11px] font-black uppercase tracking-[0.12em] ${isDark ? "text-[#C4A7FF]" : "text-[#7024C4]"}`}>
                {t("statusVitals.faceScan.kicker", "Camera check")}
              </p>
              <h3 className={`font-display text-[21px] font-bold leading-tight ${isDark ? "text-[#FFF8FF]" : "text-[#27152F]"}`}>
                {t("statusVitals.faceScan.vitalsTitle", "Heart rate & breathing")}
              </h3>
            </div>
          </div>
          <div className={`mt-4 grid grid-cols-2 gap-2 ${isDark ? "text-[#E9D7FF]" : "text-[#5B356F]"}`}>
            <div className={`flex items-center gap-2 rounded-[15px] px-3 py-2 font-body text-[13px] font-bold ${isDark ? "bg-white/[0.06]" : "bg-[#F8F1FC]"}`}>
              <HeartPulse className="h-4 w-4 text-[#E8B84A]" />
              {t("statusVitals.metrics.heartRate", "Heart rate")}
            </div>
            <div className={`flex items-center gap-2 rounded-[15px] px-3 py-2 font-body text-[13px] font-bold ${isDark ? "bg-white/[0.06]" : "bg-[#F8F1FC]"}`}>
              <Wind className="h-4 w-4 text-[#E8B84A]" />
              {t("statusVitals.metrics.respiration", "Breathing")}
            </div>
          </div>
        </div>

        <div className="relative min-h-[180px] overflow-hidden rounded-[20px] bg-[#151026] sm:min-h-[210px]">
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
          <canvas ref={canvasRef} className="hidden" />
          {status === "idle" || status === "not_configured" || status === "failed" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.22),rgba(21,16,38,0.96))]">
              <VyvaIcon icon={ScanLine} accent="signal" size={52} />
            </div>
          ) : null}
          {active ? (
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-2 rounded-full bg-black/55 px-4 py-2 font-body text-[13px] font-black text-white backdrop-blur-sm">
              <Loader2 className="h-4 w-4 animate-spin text-[#E8B84A]" />
              {statusText}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`border-t px-4 py-4 sm:px-5 ${isDark ? "border-white/[0.1]" : "border-[#EEE5F2]"}`}>
        {!active ? (
          <p className={`mb-3 font-body text-[13px] font-bold leading-relaxed ${status === "failed" || status === "not_configured" ? "text-[#D97706]" : isDark ? "text-[#C9BDD6]" : "text-[#6B5B72]"}`} data-testid={`vital-lens-status-${status}`}>
            {statusText}
          </p>
        ) : null}
        <div className={showFallback ? "grid gap-2 sm:grid-cols-2" : "grid"}>
          <button
            type="button"
            onClick={() => void startScan()}
            disabled={active}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] bg-[#7C3AED] px-5 font-body text-[16px] font-black text-white disabled:opacity-60"
            data-testid="button-start-vital-lens-scan"
          >
            {active ? <Loader2 className="h-5 w-5 animate-spin" /> : status === "failed" ? <RefreshCw className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
            {status === "failed" ? t("common.tryAgain", "Try again") : t("statusVitals.faceScan.start", "Start camera check")}
          </button>
          {showFallback ? (
            <button
              type="button"
              onClick={onLocalFallback}
              disabled={active}
              className={`flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] border px-5 font-body text-[15px] font-black disabled:opacity-60 ${isDark ? "border-white/[0.14] bg-white/[0.06] text-[#E9D7FF]" : "border-[#D8CAE4] bg-[#FFFCF8] text-[#6B21A8]"}`}
              data-testid="button-use-local-camera-estimate"
            >
              <ScanLine className="h-5 w-5" />
              {t("statusVitals.faceScan.local", "Use phone estimate")}
            </button>
          ) : null}
        </div>
        <p className={`mt-3 text-center font-body text-[11px] font-semibold ${isDark ? "text-[#AFA1BC]" : "text-[#87778F]"}`}>
          {t("statusVitals.faceScan.reviewNote", "You review both estimates before anything is saved.")}
        </p>
      </div>
    </section>
  );
}
