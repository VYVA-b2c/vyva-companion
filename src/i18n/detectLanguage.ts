export const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "cy"];

export function detectBrowserLanguage(): string {
  const lang = navigator.language.split("-")[0];
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : "en";
}
