import { createContext, useContext, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { syncProfileLanguage, useLanguage } from "@/i18n/index";
import { SUPPORTED_LANGUAGES } from "@/i18n/detectLanguage";
import type { LanguageCode } from "@/i18n/languages";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { displayFirstName } from "@/lib/displayIdentity";

interface ProfileData {
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  name?: string | null;
  first_name?: string | null;
  full_name?: string | null;
  preferred_name?: string | null;
  display_name?: string | null;
  email: string;
  phone: string;
  country: string;
  timezone: string;
  language: string;
  languagePreference?: string | null;
  profileId?: string | null;
  street: string;
  cityState: string;
  region?: string | null;
  postalCode: string;
  caregiverName: string;
  caregiverContact: string;
  gpName?: string;
  gpPhone?: string;
  gpEmail?: string;
  gender?: string;
  savedProviders?: Array<{
    name?: string | null;
    role?: string | null;
    category?: string | null;
    phone?: string | null;
    address?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    websiteUrl?: string | null;
    notes?: string | null;
    isTrusted?: boolean;
    isDefault?: boolean;
  }>;
  serviceReadiness?: {
    hasSavedPharmacy?: boolean;
    hasSavedDoctor?: boolean;
    hasSavedTransportProvider?: boolean;
    hasMobilityInfo?: boolean;
    hasCoverageInfo?: boolean;
    hasPreferredContactMethod?: boolean;
  };
}

interface ProfileContextValue {
  profile: ProfileData | null;
  isLoading: boolean;
  fullName: string;
  initials: string;
  firstName: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function normalizeProfileLanguage(language?: string | null): LanguageCode | null {
  if (!language) return null;

  const raw = language.trim().toLowerCase();
  if (SUPPORTED_LANGUAGES.includes(raw as LanguageCode)) return raw as LanguageCode;

  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const languageAliases: Record<string, LanguageCode> = {
    espanol: "es",
    spanish: "es",
    castellano: "es",
    ingles: "en",
    english: "en",
    francais: "fr",
    frances: "fr",
    french: "fr",
    deutsch: "de",
    aleman: "de",
    german: "de",
    italiano: "it",
    italian: "it",
    portugues: "pt",
    portuguese: "pt",
  };

  return languageAliases[normalized] ?? null;
}

function firstNameFromDisplayValue(value: string | null | undefined): string {
  const name = displayFirstName(value);
  return name.split(/\s+/)[0] ?? "";
}

function resolveProfileFirstName(profile: ProfileData | null | undefined): string {
  return (
    firstNameFromDisplayValue(profile?.preferredName) ||
    firstNameFromDisplayValue(profile?.preferred_name) ||
    firstNameFromDisplayValue(profile?.firstName) ||
    firstNameFromDisplayValue(profile?.first_name) ||
    firstNameFromDisplayValue(profile?.fullName) ||
    firstNameFromDisplayValue(profile?.full_name) ||
    firstNameFromDisplayValue(profile?.displayName) ||
    firstNameFromDisplayValue(profile?.display_name) ||
    firstNameFromDisplayValue(profile?.name)
  );
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { language, source, revision } = useLanguage();
  const savedLanguageRevisionRef = useRef<string | null>(null);
  const { data: profile, isLoading } = useQuery<ProfileData | null>({
    queryKey: ["/api/profile"],
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const firstName = resolveProfileFirstName(profile);
  const lastName = profile?.lastName?.trim() || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "";
  const initials =
    [firstName, lastName]
      .filter(Boolean)
      .map((n) => n[0].toUpperCase())
      .join("") || "";

  useEffect(() => {
    if (!token) return;
    const lang = normalizeProfileLanguage(profile?.languagePreference ?? profile?.language);
    if (!lang) return;
    syncProfileLanguage(lang, profile?.profileId ?? null);
  }, [profile?.language, profile?.languagePreference, profile?.profileId, token]);

  useEffect(() => {
    if (!token || source !== "user" || !profile?.profileId) return;
    const normalized = normalizeProfileLanguage(language);
    if (!normalized) return;

    const saveKey = `${profile.profileId}:${normalized}:${revision}`;
    if (savedLanguageRevisionRef.current === saveKey) return;
    savedLanguageRevisionRef.current = saveKey;

    const controller = new AbortController();
    void apiFetch("/api/profile/language", {
      method: "PATCH",
      body: JSON.stringify({ language: normalized }),
      signal: controller.signal,
    }).then((response) => {
      if (!response.ok) return;
      void queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    }).catch(() => {
      savedLanguageRevisionRef.current = null;
    });

    return () => controller.abort();
  }, [language, profile?.profileId, revision, source, token]);

  return (
    <ProfileContext.Provider value={{ profile: profile ?? null, isLoading, fullName, initials, firstName }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}

export function useOptionalProfile(): ProfileContextValue | null {
  return useContext(ProfileContext);
}
