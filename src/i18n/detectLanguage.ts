import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from "./languages";

export const SUPPORTED_LANGUAGES = LANGUAGES.map((language) => language.code);

export function detectBrowserLanguage(): LanguageCode {
  const language = typeof navigator === "undefined" ? DEFAULT_LANGUAGE : navigator.language.split("-")[0];
  return (SUPPORTED_LANGUAGES.includes(language as LanguageCode) ? language : DEFAULT_LANGUAGE) as LanguageCode;
}
