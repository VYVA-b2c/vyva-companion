import type { LanguageCode } from "@/i18n/languages";

export type GameLanguage = Extract<LanguageCode, "es" | "en" | "fr" | "de" | "it" | "pt">;

export const GAME_LANGUAGES: GameLanguage[] = ["es", "en", "fr", "de", "it", "pt"];

export function normalizeGameLanguage(language: string | null | undefined): GameLanguage {
  return GAME_LANGUAGES.includes(language as GameLanguage) ? (language as GameLanguage) : "es";
}

export function getSpeechLanguage(language: string | null | undefined): string {
  switch (normalizeGameLanguage(language)) {
    case "en":
      return "en-US";
    case "fr":
      return "fr-FR";
    case "de":
      return "de-DE";
    case "it":
      return "it-IT";
    case "pt":
      return "pt-PT";
    case "es":
    default:
      return "es-ES";
  }
}
