export const LANGUAGES = [
  { code: "es", label: "Espa\u00f1ol" },
  { code: "en", label: "English" },
  { code: "fr", label: "Fran\u00e7ais" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Portugu\u00eas" },
] as const;

export type LanguageCode = "es" | "en" | "fr" | "de" | "it" | "pt" | "cy";

export const DEFAULT_LANGUAGE: LanguageCode = "es";
