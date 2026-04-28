import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import i18n, { LANGUAGE_STORAGE_KEY } from "@/i18n/index";
import { SUPPORTED_LANGUAGES } from "@/i18n/detectLanguage";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  timezone: string;
  language: string;
  street: string;
  cityState: string;
  postalCode: string;
  caregiverName: string;
  caregiverContact: string;
  gender?: string;
}

interface ProfileContextValue {
  profile: ProfileData | null;
  isLoading: boolean;
  fullName: string;
  initials: string;
  firstName: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useQuery<ProfileData | null>({
    queryKey: ["/api/profile"],
    staleTime: 5 * 60 * 1000,
  });

  const firstName = profile?.firstName?.trim() || "";
  const lastName = profile?.lastName?.trim() || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "";
  const initials =
    [firstName, lastName]
      .filter(Boolean)
      .map((n) => n[0].toUpperCase())
      .join("") || "";

  useEffect(() => {
    const lang = profile?.language;
    if (!lang || !SUPPORTED_LANGUAGES.includes(lang)) return;
    if (lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
    if (localStorage.getItem(LANGUAGE_STORAGE_KEY) !== lang) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  }, [profile?.language]);

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
