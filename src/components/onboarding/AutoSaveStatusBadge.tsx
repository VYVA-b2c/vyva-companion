import { Loader2, CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";

interface AutoSaveStatusBadgeProps {
  autoSaveStatus: AutoSaveStatus;
  savedFading: boolean;
  testId: string;
  retryCountdown?: number | null;
  onRetryNow?: () => void;
}

export function AutoSaveStatusBadge({ autoSaveStatus, savedFading, testId, retryCountdown, onRetryNow }: AutoSaveStatusBadgeProps) {
  if (autoSaveStatus === "idle") return null;

  const showCountdown = autoSaveStatus === "error" && retryCountdown != null && retryCountdown > 0;

  return (
    <div
      data-testid={testId}
      className={`flex items-center gap-1 shrink-0 mt-1 transition-opacity duration-500 ${savedFading ? "opacity-0" : "opacity-100"}`}
    >
      {autoSaveStatus === "saving" && (
        <>
          <Loader2 size={12} className="animate-spin text-purple-400" />
          <span className="text-[10px] text-purple-500 font-medium">Saving…</span>
        </>
      )}
      {autoSaveStatus === "saved" && (
        <>
          <CheckCircle2 size={12} className="text-green-500" />
          <span className="text-[10px] text-green-600 font-medium">Saved</span>
        </>
      )}
      {autoSaveStatus === "error" && (
        <>
          {showCountdown ? (
            <RefreshCw size={12} className="text-amber-500" />
          ) : (
            <CloudOff size={12} className="text-amber-500" />
          )}
          <span className="text-[10px] text-amber-600 font-medium">
            {showCountdown ? `Retrying in ${retryCountdown}s…` : "Not saved"}
          </span>
          {onRetryNow && (
            <button
              type="button"
              onClick={onRetryNow}
              data-testid={`${testId}-retry-now`}
              className="text-[10px] text-amber-700 font-semibold underline underline-offset-2 ml-0.5 cursor-pointer"
            >
              Retry now
            </button>
          )}
        </>
      )}
    </div>
  );
}
