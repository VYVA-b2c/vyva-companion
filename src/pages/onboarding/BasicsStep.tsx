import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Input } from "@/components/ui/input";
import { ChipSelector } from "@/components/onboarding/ChipSelector";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import { getToken } from "@/lib/auth";
import { useLanguage } from "@/i18n";
import { LANGUAGES, type LanguageCode } from "@/i18n/languages";

const ONBOARDING_LANGUAGE_OPTIONS = LANGUAGES.map((entry) => entry.label);

const LANGUAGE_LABEL_BY_CODE: Record<LanguageCode, string> = {
  es: "Espa\u00f1ol",
  en: "English",
  fr: "Fran\u00e7ais",
  de: "Deutsch",
  it: "Italiano",
  pt: "Portugu\u00eas",
  cy: "English",
};

const LANGUAGE_CODE_BY_LABEL = Object.fromEntries(
  LANGUAGES.map((entry) => [entry.label, entry.code]),
) as Record<string, LanguageCode>;

type ProfileResponse = {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  language?: string;
};

const BasicsStep = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dob, setDob] = useState("");
  const [languages, setLanguages] = useState<string[]>([LANGUAGE_LABEL_BY_CODE[language] ?? LANGUAGE_LABEL_BY_CODE.es]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileQuery = useQuery<ProfileResponse | null>({
    queryKey: ["/api/profile"],
  });
  const onboardingQuery = useQuery<{ account?: { role?: string | null } } | null>({
    queryKey: ["/api/onboarding/state"],
  });
  const isCaregiverSetup = onboardingQuery.data?.account?.role === "caregiver";

  const selectedLanguageCode = useMemo<LanguageCode>(() => {
    const selected = languages[0];
    return LANGUAGE_CODE_BY_LABEL[selected] ?? "es";
  }, [languages]);

  useEffect(() => {
    if (profileQuery.data) return;
    setLanguages([LANGUAGE_LABEL_BY_CODE[language] ?? LANGUAGE_LABEL_BY_CODE.es]);
  }, [language, profileQuery.data]);

  useEffect(() => {
    if (!profileQuery.data) return;
    const derivedFullName = [profileQuery.data.firstName, profileQuery.data.lastName].filter(Boolean).join(" ").trim();
    if (derivedFullName) setFullName(derivedFullName);
    if (profileQuery.data.preferredName) setPreferredName(profileQuery.data.preferredName);
    if (profileQuery.data.dateOfBirth) setDob(profileQuery.data.dateOfBirth);

    const languageCode = (profileQuery.data.language as LanguageCode | undefined) ?? language;
    const languageLabel = LANGUAGE_LABEL_BY_CODE[languageCode] ?? LANGUAGE_LABEL_BY_CODE.es;
    setLanguages([languageLabel]);
  }, [language, profileQuery.data]);

  const handleLanguageChange = (nextLanguages: string[]) => {
    setLanguages(nextLanguages);
    const nextCode = LANGUAGE_CODE_BY_LABEL[nextLanguages[0]];
    if (nextCode) setLanguage(nextCode);
  };

  const canContinue = fullName.trim().length > 0 && !saving;

  const handleContinue = async () => {
    if (!canContinue) return;

    const token = getToken();
    if (!token) {
      navigate("/login", { state: { from: "/onboarding/basics" } });
      return;
    }

    setSaving(true);
    setError(null);
    let res: Response | undefined;
    try {
      const body: Record<string, string | null> = {
        full_name: fullName.trim(),
        preferred_name: preferredName.trim() || null,
        date_of_birth: dob || null,
        language: selectedLanguageCode,
      };
      res = await apiFetch("/api/onboarding/basics", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await friendlyError(null, res));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/channel");
    } catch (err) {
      setError(await friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingChrome mainClassName="flex min-h-[calc(100vh-92px)] max-w-[560px] flex-col justify-center">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          data-testid="button-basics-back"
          onClick={() => navigate("/onboarding/who-for")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EFE7DB] bg-white shadow-[0_12px_30px_rgba(72,44,18,0.08)]"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <span className="rounded-full bg-white/80 px-4 py-2 font-body text-[12px] font-extrabold uppercase tracking-[0.18em] text-vyva-purple/75 shadow-[0_12px_30px_rgba(72,44,18,0.08)]">
          Step 1 of 5
        </span>
      </div>

      <section className="rounded-[34px] border border-[#EFE7DB] bg-white/95 p-5 shadow-[0_24px_70px_rgba(72,44,18,0.12)] backdrop-blur sm:p-7">
        <div className="mb-5">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.24em] text-vyva-purple/70">
            Profile basics
          </p>
          <h1 className="mt-2 font-display text-[42px] leading-[0.98] text-[#2E1642]">
            {isCaregiverSetup ? "About them" : "About you"}
          </h1>
          <p className="mt-3 font-body text-[14px] leading-[1.55] text-vyva-text-2">
            {isCaregiverSetup
              ? "Tell VYVA who will receive support. You can add more health and care details after this."
              : "Start with the essentials. You can update your profile any time."}
          </p>
        </div>

        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#F1E9DD]">
          <div className="h-full rounded-full bg-vyva-purple" style={{ width: "20%" }} />
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              {isCaregiverSetup ? "Their full name" : "Full name"} <span className="text-vyva-red">*</span>
            </label>
            <Input
              data-testid="input-basics-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Margaret Collins"
              className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              {isCaregiverSetup ? "What should VYVA call them?" : "What should VYVA call you?"}
            </label>
            <Input
              data-testid="input-basics-preferred-name"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="e.g. Margaret, Maggie..."
              className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input"
            />
            <p className="mt-1 font-body text-[11px] text-vyva-text-3">Optional - defaults to the first name</p>
          </div>

          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              Date of birth
            </label>
            <Input
              data-testid="input-basics-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input"
            />
          </div>

          <div>
            <label className="mb-2 block font-body text-[13px] font-bold text-vyva-text-2">
              Preferred language
            </label>
            <ChipSelector
              options={ONBOARDING_LANGUAGE_OPTIONS}
              selected={languages}
              onChange={handleLanguageChange}
              multi={false}
            />
          </div>
        </div>

        {error && (
          <p data-testid="text-basics-error" className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
            {error}
          </p>
        )}

        <button
          data-testid="button-basics-continue"
          onClick={handleContinue}
          disabled={!canContinue}
          className="vyva-primary-action mt-6 w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab disabled:opacity-40"
        >
          {saving ? "Saving..." : "Continue"}
          {!saving && <ArrowRight size={17} />}
        </button>
      </section>
    </OnboardingChrome>
  );
};

export default BasicsStep;
