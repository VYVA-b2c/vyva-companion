import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ChipSelector } from "@/components/onboarding/ChipSelector";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import { getToken } from "@/lib/auth";
import { LANGUAGES, type LanguageCode } from "@/i18n/languages";

const ONBOARDING_LANGUAGE_OPTIONS = LANGUAGES.map((entry) => entry.label);

const LANGUAGE_LABEL_BY_CODE: Record<LanguageCode, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
};

const LANGUAGE_CODE_BY_LABEL = Object.fromEntries(
  Object.entries(LANGUAGE_LABEL_BY_CODE).map(([code, label]) => [label, code]),
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
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dob, setDob] = useState("");
  const [languages, setLanguages] = useState<string[]>(["Español"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileQuery = useQuery<ProfileResponse | null>({
    queryKey: ["/api/profile"],
  });

  const selectedLanguageCode = useMemo<LanguageCode>(() => {
    const selected = languages[0];
    return LANGUAGE_CODE_BY_LABEL[selected] ?? "es";
  }, [languages]);

  useEffect(() => {
    if (!profileQuery.data) return;
    const derivedFullName = [profileQuery.data.firstName, profileQuery.data.lastName].filter(Boolean).join(" ").trim();
    if (derivedFullName) setFullName(derivedFullName);
    if (profileQuery.data.preferredName) setPreferredName(profileQuery.data.preferredName);
    if (profileQuery.data.dateOfBirth) setDob(profileQuery.data.dateOfBirth);

    const languageCode = (profileQuery.data.language as LanguageCode | undefined) ?? "es";
    const languageLabel = LANGUAGE_LABEL_BY_CODE[languageCode] ?? "Español";
    setLanguages([languageLabel]);
  }, [profileQuery.data]);

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
        full_name:      fullName.trim(),
        preferred_name: preferredName.trim() || null,
        date_of_birth:  dob || null,
        language:       selectedLanguageCode,
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
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-basics-back"
          onClick={() => navigate("/onboarding")}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <div>
          <p className="font-body text-[12px] text-vyva-text-3 uppercase tracking-wider">Step 1 of 5</p>
          <h1 className="font-display text-[22px] font-semibold text-vyva-text-1">About you</h1>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-6">
        <div className="h-1.5 bg-vyva-warm2 rounded-full overflow-hidden">
          <div className="h-full bg-vyva-purple rounded-full" style={{ width: "20%" }} />
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 space-y-5">
        <div>
          <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
            Full name <span className="text-vyva-red">*</span>
          </label>
          <Input
            data-testid="input-basics-full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Margaret Collins"
            className="bg-white"
          />
        </div>

        <div>
          <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
            What should VYVA call you?
          </label>
          <Input
            data-testid="input-basics-preferred-name"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            placeholder="e.g. Margaret, Maggie…"
            className="bg-white"
          />
          <p className="font-body text-[11px] text-vyva-text-3 mt-1">Optional — defaults to your first name</p>
        </div>

        <div>
          <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
            Date of birth
          </label>
          <Input
            data-testid="input-basics-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="bg-white"
          />
        </div>

        <div>
          <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-2 block">
            Preferred language
          </label>
          <ChipSelector
            options={ONBOARDING_LANGUAGE_OPTIONS}
            selected={languages}
            onChange={setLanguages}
            multi={false}
          />
        </div>
      </div>

      {error && (
        <p data-testid="text-basics-error" className="px-5 pb-2 font-body text-[13px] text-red-600">
          {error}
        </p>
      )}

      {/* Continue */}
      <div className="px-5 py-6">
        <button
          data-testid="button-basics-continue"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
          style={{ background: "#6B21A8" }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
};

export default BasicsStep;
