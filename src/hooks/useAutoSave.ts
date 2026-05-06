// src/hooks/useAutoSave.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

const MAX_AUTO_RETRIES = 3;
const RETRY_SECS = 5;

/**
 * Shared debounced auto-save hook.
 *
 * @param saveFn              Async function that persists current data. Always called with
 *                            the latest version via an internal ref so callers can pass an
 *                            inline function that closes over component state.
 * @param delay               Debounce delay in milliseconds (default 2000).
 * @param onRetriesExhausted  Optional callback fired once when all auto-retries are used up.
 *
 * Returns:
 *   autoSaveStatus   – "idle" | "saving" | "saved" | "error"
 *   savedFading      – true for the last 500 ms before the "Saved" badge disappears
 *   retryCountdown   – seconds remaining before next retry (null when no retry is pending)
 *   retryNow         – call to trigger an immediate retry; resets the retry counter so
 *                      the user always gets a fresh 3-attempt budget
 *   scheduleAutoSave – call this whenever data changes to (re-)start the debounce timer
 *   cancelAutoSave   – cancel any pending timer (e.g. before a manual save)
 *   setAutoSaveStatus – override the status directly (e.g. to mark "saved" after a
 *                       manual save so the badge shows)
 *
 * "Connection lost" toast — reset policy for retriesExhaustedFiredRef:
 *   The toast fires at most once per exhaustion event (all MAX_AUTO_RETRIES attempts
 *   have failed for a single save cycle). A ref guards this so rapid retries or
 *   re-renders don't spam the user.
 *
 *   The ref is reset to false in TWO places so the toast can fire again:
 *     1. scheduleAutoSave  – the user made a new edit. This starts a brand-new save
 *        cycle, so the next exhaustion (if any) is a distinct event the user should
 *        hear about.
 *     2. cancelAutoSave    – a manual save is taking over. Same reasoning; if that
 *        manual save's underlying retry cycle later exhausts, it is a new event.
 *
 *   The ref is intentionally NOT reset in retryNow. When the user taps "Retry now"
 *   they already saw the "connection lost" toast from the first exhaustion. If that
 *   fresh 3-attempt budget also exhausts, showing the toast again would be redundant
 *   noise — the error badge already communicates the failure.
 */
export function useAutoSave(
  saveFn: () => Promise<void>,
  delay = 2000,
  onRetriesExhausted?: () => void,
) {
  const { toast } = useToast();
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const [savedFading, setSavedFading] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);

  /**
   * Guards the "connection lost" toast so it fires at most once per exhaustion
   * event. Reset to false by scheduleAutoSave (new edit) and cancelAutoSave
   * (manual save). NOT reset by retryNow — see JSDoc above for rationale.
   */
  const retriesExhaustedFiredRef = useRef(false);

  const saveFnRef = useRef(saveFn);
  useEffect(() => { saveFnRef.current = saveFn; }, [saveFn]);

  const onRetriesExhaustedRef = useRef(onRetriesExhausted);
  useEffect(() => { onRetriesExhaustedRef.current = onRetriesExhausted; }, [onRetriesExhausted]);

  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const clearCountdownInterval = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRetryCountdown(null);
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Fade out and dismiss the "Saved" badge ~3 s after it appears
  useEffect(() => {
    if (autoSaveStatus !== "saved") {
      setSavedFading(false);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      return;
    }
    fadeTimerRef.current = setTimeout(() => setSavedFading(true), 2500);
    dismissTimerRef.current = setTimeout(() => {
      setAutoSaveStatus("idle");
      setSavedFading(false);
    }, 3000);
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [autoSaveStatus]);

  const attemptSave = useCallback(async () => {
    // Clear any in-progress countdown and pending retry timer before starting a new attempt
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRetryCountdown(null);
    setAutoSaveStatus("saving");
    try {
      await saveFnRef.current();
      retryCountRef.current = 0;
      // A successful save also clears the exhausted flag so that if the connection
      // drops again later the toast can fire for that new exhaustion event.
      retriesExhaustedFiredRef.current = false;
      setAutoSaveStatus("saved");
    } catch (err) {
      // Log every auto-save failure for developers
      console.error("[VYVA] Auto-save error:", err);
      setAutoSaveStatus("error");
      if (retryCountRef.current < MAX_AUTO_RETRIES) {
        // Still under the retry cap — schedule the next automatic attempt
        retryCountRef.current += 1;
        setRetryCountdown(RETRY_SECS);
        let remaining = RETRY_SECS;
        countdownIntervalRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining > 0) {
            setRetryCountdown(remaining);
          } else {
            clearInterval(countdownIntervalRef.current!);
            countdownIntervalRef.current = null;
            setRetryCountdown(null);
          }
        }, 1000);
        retryTimerRef.current = setTimeout(() => {
          attemptSave();
        }, RETRY_SECS * 1000);
      } else {
        // All automatic retries exhausted. Show the error toast once per
        // exhaustion event, using the specific message thrown by the save
        // callback (network error vs server error), falling back to generic.
        if (!retriesExhaustedFiredRef.current) {
          retriesExhaustedFiredRef.current = true;
          const description =
            err instanceof TypeError
              ? "Cannot reach the server — please check your internet connection."
              : err instanceof Error && err.message.length > 0
              ? err.message
              : "We couldn't save your changes. Check your connection and tap 'Retry now' when ready.";
          toastRef.current({
            title: "Connection lost",
            description,
            variant: "destructive",
          });
          onRetriesExhaustedRef.current?.();
        }
      }
    }
  }, []);

  /**
   * User-initiated retry: resets the automatic-retry counter so the user always
   * gets a fresh 3-attempt budget.
   *
   * retriesExhaustedFiredRef is intentionally NOT reset here. The user already
   * saw the "connection lost" toast when this exhaustion event occurred. If this
   * new retry budget also exhausts, the error badge communicates the failure
   * without adding toast noise on top.
   */
  const retryNow = useCallback(() => {
    retryCountRef.current = 0;
    attemptSave();
  }, [attemptSave]);

  /**
   * Call whenever the user makes a new edit to (re-)start the debounce timer.
   *
   * Resets retriesExhaustedFiredRef → the user's edit starts a brand-new save
   * cycle; if that cycle exhausts its retries the toast should fire again so
   * the user is informed about this distinct failure event.
   */
  const scheduleAutoSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    clearCountdownInterval();
    retryCountRef.current = 0; // user made new edits — fresh save, fresh retry budget
    retriesExhaustedFiredRef.current = false; // new edit → new exhaustion event
    setAutoSaveStatus("idle");
    timerRef.current = setTimeout(() => {
      attemptSave();
    }, delay);
  }, [delay, attemptSave, clearCountdownInterval]);

  /**
   * Cancel any pending debounce/retry timer (e.g. before a manual save).
   *
   * Resets retriesExhaustedFiredRef → the manual save takes over the cycle; if
   * its underlying retry logic later exhausts the toast should fire for that
   * new event.
   */
  const cancelAutoSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    clearCountdownInterval();
    retryCountRef.current = 0; // manual save taking over — reset budget
    retriesExhaustedFiredRef.current = false; // manual save takes over → reset for new event
  }, [clearCountdownInterval]);

  return { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave, setAutoSaveStatus };
}
