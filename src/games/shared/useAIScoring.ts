import { useCallback } from "react";
import { apiFetch } from "@/lib/queryClient";
import { normalizeGameLanguage } from "./language";

type RetellScore = {
  covered: number[];
  not_covered: number[];
  covered_count: number;
  total_count: number;
  error: string | null;
};

function fallbackRetellScore(keyFacts: string[], error: string): RetellScore {
  const half = Math.floor(keyFacts.length / 2);
  return {
    covered: Array.from({ length: half }, (_, index) => index + 1),
    not_covered: Array.from({ length: keyFacts.length - half }, (_, index) => half + index + 1),
    covered_count: half,
    total_count: keyFacts.length,
    error,
  };
}

export function useAIScoring() {
  const scoreRetell = useCallback(async (
    retellText: string,
    keyFacts: string[],
    language = "es",
  ): Promise<RetellScore> => {
    try {
      const response = await apiFetch("/api/games/score-retell", {
        method: "POST",
        body: JSON.stringify({
          retellText,
          keyFacts,
          language: normalizeGameLanguage(language),
        }),
      });

      if (!response.ok) {
        throw new Error(`Scoring request failed: ${response.status}`);
      }

      return await response.json() as RetellScore;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scoring request failed";
      return fallbackRetellScore(keyFacts, message);
    }
  }, []);

  return { scoreRetell };
}
