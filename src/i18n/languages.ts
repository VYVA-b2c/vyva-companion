export const LANGUAGES = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
] as const;

export type LanguageCode = "es" | "en" | "fr" | "de" | "it" | "pt";

export const DEFAULT_LANGUAGE: LanguageCode = "es";
