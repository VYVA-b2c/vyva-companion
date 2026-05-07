import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from "./languages";

export const SUPPORTED_LANGUAGES = LANGUAGES.map((language) => language.code);

export function normalizeLanguageCode(value: string | null | undefined, fallback: LanguageCode = DEFAULT_LANGUAGE): LanguageCode {
  if (!value) return fallback;
  const language = value.split("-")[0].toLowerCase();
  return (SUPPORTED_LANGUAGES.includes(language as LanguageCode) ? language : fallback) as LanguageCode;
}

export function detectBrowserLanguage(fallback: LanguageCode = DEFAULT_LANGUAGE): LanguageCode {
  if (typeof navigator === "undefined") return fallback;

  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const language = normalizeLanguageCode(candidate, fallback);
    if (language !== fallback || candidate?.split("-")[0]?.toLowerCase() === fallback) {
      return language;
    }
  }

  return fallback;
}
