import { useCallback, useRef, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import { normalizeGameLanguage } from "./language";

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(async (text: string, language = "es") => {
    if (!text.trim()) return;

    stop();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/api/games/tts", {
        method: "POST",
        body: JSON.stringify({
          text,
          language: normalizeGameLanguage(language),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `TTS request failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audioUrlRef.current = audioUrl;
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioUrlRef.current = null;
      };
      audio.onerror = () => {
        setError("Audio playback error");
        setIsSpeaking(false);
        setIsLoading(false);
      };

      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to play audio");
      setIsSpeaking(false);
      setIsLoading(false);
    }
  }, [stop]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current?.paused) {
      void audioRef.current.play();
      setIsSpeaking(true);
    }
  }, []);

  return { speak, stop, pause, resume, isSpeaking, isLoading, error };
}
