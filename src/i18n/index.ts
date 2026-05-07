import { useCallback, useSyncExternalStore } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import legacyEn from "./locales/en.json";
import legacyEs from "./locales/es.json";
import legacyFr from "./locales/fr.json";
import legacyDe from "./locales/de.json";
import legacyIt from "./locales/it.json";
import legacyPt from "./locales/pt.json";
import legacyCy from "./locales/cy.json";
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from "./languages";
import { detectBrowserLanguage as detectNavigatorLanguage } from "./detectLanguage";
import customEn from "./en";
import customEs from "./es";
import customFr from "./fr";
import customDe from "./de";
import customIt from "./it";
import customPt from "./pt";

type TranslationValue = string | number | boolean | null | undefined | TranslationTree;
type TranslationTree = { [key: string]: TranslationValue };

type DictionaryMap = Record<LanguageCode, TranslationTree>;

export const LANGUAGE_STORAGE_KEY = "vyva_lang";
const LEGACY_LANGUAGE_STORAGE_KEY = "vyva_language";

const overrides: DictionaryMap = {
  es: customEs,
  en: customEn,
  fr: customFr,
  de: customDe,
  it: customIt,
  pt: customPt,
  cy: {},
};

const baseDictionaries: DictionaryMap = {
  es: legacyEs as TranslationTree,
  en: legacyEn as TranslationTree,
  fr: legacyFr as TranslationTree,
  de: legacyDe as TranslationTree,
  it: legacyIt as TranslationTree,
  pt: legacyPt as TranslationTree,
  cy: legacyCy as TranslationTree,
};

function isObject(value: TranslationValue): value is TranslationTree {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base: TranslationTree, extension: TranslationTree): TranslationTree {
  const result: TranslationTree = { ...base };

  for (const key of Object.keys(extension)) {
    const baseValue = result[key];
    const extensionValue = extension[key];

    if (isObject(baseValue) && isObject(extensionValue)) {
      result[key] = deepMerge(baseValue, extensionValue);
    } else {
      result[key] = extensionValue;
    }
  }

  return result;
}

const dictionaries: DictionaryMap = {
  es: deepMerge(baseDictionaries.es, overrides.es),
  en: deepMerge(baseDictionaries.en, overrides.en),
  fr: deepMerge(baseDictionaries.fr, overrides.fr),
  de: deepMerge(baseDictionaries.de, overrides.de),
  it: deepMerge(baseDictionaries.it, overrides.it),
  pt: deepMerge(baseDictionaries.pt, overrides.pt),
  cy: deepMerge(baseDictionaries.cy, overrides.cy),
};

const supportedCodes = LANGUAGES.map((language) => language.code);
const listeners = new Set<() => void>();

function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return Boolean(value) && supportedCodes.includes(value as LanguageCode);
}

function persistLanguage(language: LanguageCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  window.localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
}

function normalizeLanguage(value: string | null | undefined): LanguageCode {
  if (isLanguageCode(value)) return value;
  return DEFAULT_LANGUAGE;
}

function detectBrowserLanguage(): LanguageCode {
  return detectNavigatorLanguage(DEFAULT_LANGUAGE);
}

function readStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isLanguageCode(stored)) {
    return stored;
  }

  const legacyStored = window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
  if (isLanguageCode(legacyStored)) {
    persistLanguage(legacyStored);
    return legacyStored;
  }

  const detectedLanguage = detectBrowserLanguage();
  persistLanguage(detectedLanguage);
  return detectedLanguage;
}

let currentLanguage: LanguageCode = readStoredLanguage();

function getValueFromPath(source: TranslationTree, path: string): TranslationValue {
  return path.split(".").reduce<TranslationValue>((accumulator, segment) => {
    if (!isObject(accumulator)) return undefined;
    return accumulator[segment];
  }, source);
}

function notifyLanguageChange() {
  listeners.forEach((listener) => listener());
}

function applyLanguage(language: LanguageCode, syncLegacy = true) {
  currentLanguage = language;
  persistLanguage(language);

  if (syncLegacy && i18n.isInitialized && i18n.language !== language) {
    void i18n.changeLanguage(language);
  }

  notifyLanguageChange();
  return language;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: Object.fromEntries(
      supportedCodes.map((code) => [code, { translation: dictionaries[code] }]),
    ),
    lng: currentLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  });
}

i18n.off("languageChanged");
i18n.on("languageChanged", (language) => {
  const normalized = normalizeLanguage(language);
  if (normalized !== currentLanguage) {
    applyLanguage(normalized, false);
  }
});

export function getLanguage(): LanguageCode {
  return currentLanguage;
}

export function getTranslator(language: LanguageCode) {
  return (path: string, fallback?: string) => translate(language, path, fallback);
}

export function setLanguage(language: string): LanguageCode {
  return applyLanguage(normalizeLanguage(language));
}

export function translate(language: LanguageCode, path: string, fallback?: string): string {
  const localized = getValueFromPath(dictionaries[language], path);
  if (typeof localized === "string") return localized;

  const spanish = getValueFromPath(dictionaries.es, path);
  if (typeof spanish === "string") return spanish;

  return fallback ?? path;
}

export function t(path: string, fallback?: string): string {
  return translate(currentLanguage, path, fallback);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage() {
  const language = useSyncExternalStore(subscribe, getLanguage, () => DEFAULT_LANGUAGE);
  const translator = useCallback((path: string, fallback?: string) => translate(language, path, fallback), [language]);

  return {
    language,
    setLanguage,
    t: translator,
    languages: LANGUAGES,
  };
}

export default i18n;
