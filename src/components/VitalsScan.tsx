import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Wind, SkipForward } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";

interface VitalsScanProps {
  onComplete: (bpm: number | null, respiratoryRate: number | null) => void;
}

const SCAN_DURATION_MS = 30_000;
const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const DISPLAY_SAMPLES = 150;

function movingAverage(signal: number[], windowSize: number): number[] {
  const half = Math.floor(windowSize / 2);
  return signal.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(signal.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += signal[j];
    return sum / (hi - lo + 1);
  });
}

function bandPass(signal: number[], fps: number): number[] {
  const lpWindow = Math.round(fps / 3.0);
  const hpWindow = Math.round(fps / 0.7);
  const hp = signal.map((v, i) => {
    const baseline = movingAverage(signal, hpWindow)[i];
    return v - baseline;
  });
  return movingAverage(hp, Math.max(1, lpWindow));
}

function computeBpm(signal: number[], fps: number): number | null {
  if (signal.length < fps * 2) return null;

  const filtered = bandPass(signal, fps);

  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const normalised = filtered.map((v) => v - mean);

  const peaks: number[] = [];
  const minPeakDist = Math.floor(fps * 0.35);
  for (let i = minPeakDist; i < normalised.length - minPeakDist; i++) {
    if (normalised[i] <= 0) continue;
    if (normalised[i] <= normalised[i - 1] || normalised[i] <= normalised[i + 1]) continue;
    let localMax = true;
    for (let j = i - minPeakDist; j <= i + minPeakDist; j++) {
      if (j !== i && normalised[j] >= normalised[i]) { localMax = false; break; }
    }
    if (localMax) peaks.push(i);
  }

  if (peaks.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push((peaks[i] - peaks[i - 1]) / fps);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60 / avgInterval);
  return bpm >= 40 && bpm <= 200 ? bpm : null;
}

function computeRespiratoryRate(signal: number[], fps: number): number | null {
  if (signal.length < fps * 8) return null;

  const lpWindow = Math.round(fps * 2);
  const hpWindow = Math.round(fps * 10);
  const lp = movingAverage(signal, lpWindow);
  const hp = lp.map((v, i) => v - movingAverage(lp, hpWindow)[i]);

  const mean = hp.reduce((a, b) => a + b, 0) / hp.length;
  const normalised = hp.map((v) => v - mean);

  const minPeakDist = Math.floor(fps * 2.0);
  const peaks: number[] = [];

  for (let i = minPeakDist; i < normalised.length - minPeakDist; i++) {
    if (normalised[i] <= 0) continue;
    if (normalised[i] <= normalised[i - 1] || normalised[i] <= normalised[i + 1]) continue;
    let localMax = true;
    for (let j = i - minPeakDist; j <= i + minPeakDist; j++) {
      if (j !== i && normalised[j] >= normalised[i]) { localMax = false; break; }
    }
    if (localMax) peaks.push(i);
  }

  if (peaks.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push((peaks[i] - peaks[i - 1]) / fps);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const rpm = Math.round(60 / avgInterval);
  return rpm >= 6 && rpm <= 40 ? rpm : null;
}

export default function VitalsScan({ onComplete }: VitalsScanProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const signalRef = useRef<number[]>([]);
  const displaySignalRef = useRef<number[]>([]);
  const bpmRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const lastBpmUpdateRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const actualFpsRef = useRef<number>(TARGET_FPS);
  const completedRef = useRef(false);

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [countdown, setCountdown] = useState(SCAN_DURATION_MS / 1000);
  const [displayBpm, setDisplayBpm] = useState<number | null>(null);
  const [displayResp, setDisplayResp] = useState<number | null>(null);
  const [svgPath, setSvgPath] = useState("");
  const [pulseScale, setPulseScale] = useState(1);
  const [done, setDone] = useState(false);

  const svgWidth = 280;
  const svgHeight = 60;

  const safeComplete = useCallback((bpm: number | null, respiratoryRate: number | null) => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (bpm != null) {
      apiFetch("/api/reports/vitals", {
        method: "POST",
        body: JSON.stringify({ bpm, respiratory_rate: respiratoryRate }),
      }).catch((err) => console.error("[reports/vitals] save failed:", err));
    }
    onComplete(bpm, respiratoryRate);
  }, [onComplete]);

  const buildSvgPath = useCallback((samples: number[]) => {
    if (samples.length < 2) return "";
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const range = max - min || 1;
    const pts = samples.map((v, i) => {
      const x = (i / (samples.length - 1)) * svgWidth;
      const y = svgHeight - ((v - min) / range) * (svgHeight - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(" L ")}`;
  }, [svgWidth, svgHeight]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startTimeRef.current = performance.now();
      lastFrameTimeRef.current = 0;
      setScanning(true);
    } catch {
      setPermissionDenied(true);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, [startCamera]);

  useEffect(() => {
    if (!scanning) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const processFrame = (timestamp: number) => {
      const elapsed = timestamp - startTimeRef.current;

      if (elapsed >= SCAN_DURATION_MS) {
        const actualFps = actualFpsRef.current;
        const finalBpm = computeBpm(signalRef.current, actualFps) ?? bpmRef.current;
        const finalResp = computeRespiratoryRate(signalRef.current, actualFps);
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        setDone(true);
        setDisplayBpm(finalBpm);
        setDisplayResp(finalResp);
        setTimeout(() => safeComplete(finalBpm, finalResp), 2000);
        return;
      }

      const timeSinceLastFrame = timestamp - lastFrameTimeRef.current;
      if (timeSinceLastFrame < FRAME_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (lastFrameTimeRef.current > 0 && timeSinceLastFrame > 0) {
        const instantFps = 1000 / timeSinceLastFrame;
        actualFpsRef.current = actualFpsRef.current * 0.95 + instantFps * 0.05;
      }
      lastFrameTimeRef.current = timestamp;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const cw = canvas.width;
      const ch = canvas.height;
      const roi = ctx.getImageData(
        Math.floor(cw / 2 - 50), Math.floor(ch / 2 - 50),
        100, 100
      );
      const data = roi.data;
      let green = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) green += data[i + 1];
      const avgGreen = green / pixels;

      signalRef.current.push(avgGreen);
      displaySignalRef.current.push(avgGreen);
      if (displaySignalRef.current.length > DISPLAY_SAMPLES) displaySignalRef.current.shift();

      const remaining = Math.ceil((SCAN_DURATION_MS - elapsed) / 1000);
      setCountdown(Math.max(0, remaining));

      const now = Date.now();
      if (now - lastBpmUpdateRef.current > 2000 && signalRef.current.length >= actualFpsRef.current * 2) {
        const recentSamples = signalRef.current.slice(-Math.round(actualFpsRef.current * 10));
        const bpm = computeBpm(recentSamples, actualFpsRef.current);
        if (bpm != null) {
          bpmRef.current = bpm;
          setDisplayBpm(bpm);
          setPulseScale(1.12);
          setTimeout(() => setPulseScale(1), 200);
          lastBpmUpdateRef.current = now;
        }
      }

      setSvgPath(buildSvgPath([...displaySignalRef.current]));
      rafRef.current = requestAnimationFrame(processFrame);
    };

    rafRef.current = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scanning, buildSvgPath, safeComplete]);

  const handleSkip = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
    safeComplete(null, null);
  };

  const handleContinue = () => {
    safeComplete(displayBpm, displayResp);
  };

  const progressFraction = done
    ? 1
    : Math.min(1, (SCAN_DURATION_MS / 1000 - countdown) / (SCAN_DURATION_MS / 1000));
  const r = 110;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - progressFraction * circ;

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 text-center gap-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "hsl(var(--vyva-warm))" }}
        >
          <Heart size={36} style={{ color: "hsl(var(--vyva-purple))" }} />
        </div>
        <div>
          <p className="font-body text-[17px] font-semibold text-vyva-text-1 mb-2">
            {t("health.symptomCheck.scan.permissionDenied")}
          </p>
          <p className="font-body text-[14px] text-vyva-text-2">
            {t("health.symptomCheck.scan.permissionHint")}
          </p>
        </div>
        <button
          onClick={() => safeComplete(null, null)}
          data-testid="button-scan-skip-permission"
          className="w-full rounded-full py-[14px] font-body text-[15px] font-semibold text-white transition-all active:scale-95"
          style={{ background: "hsl(var(--vyva-purple))" }}
        >
          {t("health.symptomCheck.scan.skipBtn")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center flex-1 px-6 pt-4 pb-6 gap-5">
      <p className="font-body text-[14px] text-vyva-text-2 text-center">
        {done
          ? t("health.symptomCheck.scan.complete")
          : t("health.symptomCheck.scan.instruction")}
      </p>

      <div className="relative flex items-center justify-center">
        <svg width={260} height={260} className="absolute top-0 left-0" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={130} cy={130} r={r} fill="none" stroke="hsl(var(--vyva-warm))" strokeWidth={6} />
          <circle
            cx={130} cy={130} r={r} fill="none"
            stroke="hsl(var(--vyva-purple))"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>

        <div
          className="relative rounded-full overflow-hidden"
          style={{
            width: 220,
            height: 220,
            transform: `scale(${pulseScale})`,
            transition: "transform 0.2s ease",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "2px solid rgba(91,18,160,0.3)",
              background: "radial-gradient(ellipse 60% 80% at 50% 30%, transparent 60%, rgba(91,18,160,0.08) 100%)",
            }}
          />
          {!done && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <span
                className="font-body text-[26px] font-bold"
                style={{ color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
              >
                {countdown}s
              </span>
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} width={320} height={240} className="hidden" />

      <div
        className="w-full rounded-[16px] p-4"
        style={{ background: "hsl(var(--vyva-warm))", border: "1px solid hsl(var(--vyva-border))" }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Heart size={16} style={{ color: "hsl(var(--vyva-purple))" }} />
            <span className="font-body text-[12px] font-semibold text-vyva-text-2 uppercase tracking-wider">
              {t("health.symptomCheck.scan.heartRate")}
            </span>
          </div>
          <span
            className="font-body text-[22px] font-bold"
            style={{ color: "hsl(var(--vyva-purple))" }}
            data-testid="display-scan-bpm"
          >
            {displayBpm != null ? `${displayBpm} bpm` : "—"}
          </span>
        </div>

        <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
          {svgPath ? (
            <path
              d={svgPath}
              fill="none"
              stroke="hsl(var(--vyva-purple))"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          ) : (
            <line
              x1={0} y1={svgHeight / 2}
              x2={svgWidth} y2={svgHeight / 2}
              stroke="hsl(var(--vyva-warm2))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {done && displayResp != null && (
          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid hsl(var(--vyva-border))" }}>
            <Wind size={14} style={{ color: "#0369A1" }} />
            <span className="font-body text-[12px] font-semibold text-vyva-text-2 uppercase tracking-wider">
              {t("health.symptomCheck.scan.respiratoryRate", "Resp. Rate")}
            </span>
            <span
              className="font-body text-[18px] font-bold ml-auto"
              style={{ color: "#0369A1" }}
              data-testid="display-scan-resp"
            >
              {displayResp} rpm
            </span>
          </div>
        )}
      </div>

      {done ? (
        <button
          onClick={handleContinue}
          data-testid="button-scan-continue"
          className="w-full rounded-full py-[14px] font-body text-[16px] font-semibold text-white transition-all active:scale-95"
          style={{ background: "hsl(var(--vyva-purple))" }}
        >
          {t("health.symptomCheck.scan.continueBtn")}
        </button>
      ) : (
        <button
          onClick={handleSkip}
          data-testid="button-scan-skip"
          className="flex items-center gap-2 font-body text-[14px] text-vyva-text-3 active:opacity-70"
        >
          <SkipForward size={14} />
          {t("health.symptomCheck.scan.skipBtn")}
        </button>
      )}
    </div>
  );
}
