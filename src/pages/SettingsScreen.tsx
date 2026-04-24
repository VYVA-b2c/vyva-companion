import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { detectBrowserLanguage } from "@/i18n/detectLanguage";
import i18n, { LANGUAGE_STORAGE_KEY } from "@/i18n";

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

const Field = ({ label, required, children }: FieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label className="font-body text-[13px] font-medium text-vyva-text-2 uppercase tracking-wider">
      {label}
      {required && <span className="text-vyva-purple ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputClass =
  "w-full font-body text-[15px] text-vyva-text-1 bg-white border border-vyva-border rounded-[12px] px-3.5 py-2.5 outline-none focus:border-vyva-purple focus:ring-2 focus:ring-[#6B21A8]/10 transition-all shadow-vyva-input placeholder:text-vyva-text-3";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-3 bg-white rounded-[18px] border border-vyva-border overflow-hidden shadow-vyva-card">
    <div className="px-4 py-[11px] bg-vyva-warm border-b border-vyva-border">
      <span className="font-body text-[12px] font-medium text-vyva-text-2 uppercase tracking-wider">{title}</span>
    </div>
    <div className="px-4 py-4 flex flex-col gap-4">{children}</div>
  </div>
);

const ALL_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "cy", label: "Cymraeg" },
];

interface ProfileForm {
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
}

const SettingsScreen = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { fullName, initials } = useProfile();
  const { user } = useAuth();

  const activeLanguage = i18n.language?.slice(0, 2) ?? "en";
  const sortedLanguages = [
    ...ALL_LANGUAGES.filter((l) => l.value === activeLanguage),
    ...ALL_LANGUAGES.filter((l) => l.value !== activeLanguage),
  ];

  const defaultValues: ProfileForm = {
    firstName: "",
    lastName: "",
    email: user?.email ?? "",
    phone: "",
    country: "",
    timezone: "",
    language: detectBrowserLanguage(),
    street: "",
    cityState: "",
    postalCode: "",
    caregiverName: "",
    caregiverContact: "",
  };

  const { data: savedProfile, isLoading } = useQuery<ProfileForm | null>({
    queryKey: ["/api/profile"],
  });

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<ProfileForm>({
    defaultValues,
  });

  useEffect(() => {
    if (savedProfile) {
      reset({
        firstName:        savedProfile.firstName        ?? "",
        lastName:         savedProfile.lastName         ?? "",
        email:            savedProfile.email            ?? user?.email ?? "",
        phone:            savedProfile.phone            ?? "",
        country:          savedProfile.country          ?? "",
        timezone:         savedProfile.timezone         ?? "",
        language:         savedProfile.language         ?? "en",
        street:           savedProfile.street           ?? "",
        cityState:        savedProfile.cityState        ?? "",
        postalCode:       savedProfile.postalCode       ?? "",
        caregiverName:    savedProfile.caregiverName    ?? "",
        caregiverContact: savedProfile.caregiverContact ?? "",
      });
    }
  }, [savedProfile, reset, user?.email]);

  const mutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const res = await apiFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, variables.language);
      i18n.changeLanguage(variables.language);
      if (variables.cityState?.trim()) {
        localStorage.removeItem("vyva_coords_weather_cache");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: t("settings.toastSaved"), description: t("settings.toastSavedDesc") });
    },
    onError: () => {
      toast({ title: t("settings.toastError"), description: t("settings.toastErrorDesc"), variant: "destructive" });
    },
  });

  const onSubmit = (data: ProfileForm) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-[22px] pb-6">
      {/* Profile Header */}
      <div className="mt-[14px] rounded-[22px] bg-vyva-warm2 p-[18px] flex items-center gap-[14px]">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#6B21A8" }}
        >
          <span className="font-body text-[20px] font-medium text-white" data-testid="text-profile-initials">{initials}</span>
        </div>
        <div>
          <h1 className="font-display text-[20px] font-medium text-vyva-text-1" data-testid="text-profile-name">{fullName}</h1>
          <p className="font-body text-[13px] text-vyva-text-2">{t("settings.profileSubtitle")}</p>
        </div>
      </div>

      {/* Personal Information */}
      <Section title={t("settings.personalInfo")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("settings.fields.firstName")} required>
            <input
              data-testid="input-first-name"
              className={inputClass}
              placeholder={t("settings.placeholder.firstName")}
              {...register("firstName")}
            />
          </Field>
          <Field label={t("settings.fields.lastName")} required>
            <input
              data-testid="input-last-name"
              className={inputClass}
              placeholder={t("settings.placeholder.lastName")}
              {...register("lastName")}
            />
          </Field>
        </div>
        <Field label={t("settings.fields.email")} required>
          <input
            data-testid="input-email"
            type="email"
            className={inputClass}
            placeholder={t("settings.placeholder.email")}
            {...register("email")}
          />
        </Field>
        <Field label={t("settings.fields.phone")} required>
          <input
            data-testid="input-phone"
            type="tel"
            className={inputClass}
            placeholder={t("settings.placeholder.phone")}
            {...register("phone")}
          />
        </Field>
      </Section>

      {/* Preferences */}
      <Section title={t("settings.preferences")}>
        <Field label={t("settings.fields.country")}>
          <select
            data-testid="select-country"
            className={inputClass}
            {...register("country")}
          >
            <option value="Spain">Spain</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="Belgium">Belgium</option>
            <option value="Portugal">Portugal</option>
            <option value="Italy">Italy</option>
            <option value="Sweden">Sweden</option>
            <option value="Norway">Norway</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="United States">United States</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label={t("settings.fields.timezone")}>
          <select
            data-testid="select-timezone"
            className={inputClass}
            {...register("timezone")}
          >
            <optgroup label={t("timezoneGroups.europe")}>
              <option value="Europe/London">London (GMT+0)</option>
              <option value="Europe/Lisbon">Lisbon (GMT+0)</option>
              <option value="Europe/Madrid">Madrid (GMT+1)</option>
              <option value="Europe/Paris">Paris (GMT+1)</option>
              <option value="Europe/Berlin">Berlin (GMT+1)</option>
              <option value="Europe/Rome">Rome (GMT+1)</option>
              <option value="Europe/Brussels">Brussels (GMT+1)</option>
              <option value="Europe/Amsterdam">Amsterdam (GMT+1)</option>
              <option value="Europe/Stockholm">Stockholm (GMT+1)</option>
              <option value="Europe/Oslo">Oslo (GMT+1)</option>
              <option value="Europe/Athens">Athens (GMT+2)</option>
              <option value="Europe/Helsinki">Helsinki (GMT+2)</option>
              <option value="Europe/Warsaw">Warsaw (GMT+1)</option>
              <option value="Europe/Bucharest">Bucharest (GMT+2)</option>
              <option value="Europe/Moscow">Moscow (GMT+3)</option>
            </optgroup>
            <optgroup label={t("timezoneGroups.americas")}>
              <option value="America/New_York">New York (GMT-5)</option>
              <option value="America/Chicago">Chicago (GMT-6)</option>
              <option value="America/Denver">Denver (GMT-7)</option>
              <option value="America/Los_Angeles">Los Angeles (GMT-8)</option>
              <option value="America/Anchorage">Anchorage (GMT-9)</option>
              <option value="Pacific/Honolulu">Honolulu (GMT-10)</option>
              <option value="America/Toronto">Toronto (GMT-5)</option>
              <option value="America/Vancouver">Vancouver (GMT-8)</option>
              <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
              <option value="America/Mexico_City">Mexico City (GMT-6)</option>
              <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
            </optgroup>
            <optgroup label={t("timezoneGroups.asiaPacific")}>
              <option value="Asia/Dubai">Dubai (GMT+4)</option>
              <option value="Asia/Kolkata">Mumbai / Delhi (GMT+5:30)</option>
              <option value="Asia/Singapore">Singapore (GMT+8)</option>
              <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
              <option value="Asia/Seoul">Seoul (GMT+9)</option>
              <option value="Asia/Shanghai">Shanghai (GMT+8)</option>
              <option value="Asia/Hong_Kong">Hong Kong (GMT+8)</option>
              <option value="Australia/Sydney">Sydney (GMT+11)</option>
              <option value="Australia/Melbourne">Melbourne (GMT+11)</option>
              <option value="Pacific/Auckland">Auckland (GMT+13)</option>
            </optgroup>
            <optgroup label={t("timezoneGroups.africaMiddleEast")}>
              <option value="Africa/Cairo">Cairo (GMT+2)</option>
              <option value="Africa/Johannesburg">Johannesburg (GMT+2)</option>
              <option value="Africa/Lagos">Lagos (GMT+1)</option>
              <option value="Africa/Nairobi">Nairobi (GMT+3)</option>
            </optgroup>
          </select>
        </Field>
        <Field label={t("settings.fields.language")}>
          <select
            data-testid="select-language"
            className={inputClass}
            {...register("language")}
          >
            {sortedLanguages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Address */}
      <Section title={t("settings.address")}>
        <Field label={t("settings.fields.street")}>
          <input
            data-testid="input-street"
            className={inputClass}
            placeholder={t("settings.placeholder.street")}
            {...register("street")}
          />
        </Field>
        <Field label={t("settings.fields.cityState")}>
          <input
            data-testid="input-city-state"
            className={inputClass}
            placeholder={t("settings.placeholder.cityState")}
            {...register("cityState")}
          />
        </Field>
        <Field label={t("settings.fields.postalCode")}>
          <input
            data-testid="input-postal-code"
            className={inputClass}
            placeholder={t("settings.placeholder.postalCode")}
            {...register("postalCode")}
          />
        </Field>
      </Section>

      {/* Caregiver */}
      <Section title={t("settings.caregiver")}>
        <Field label={t("settings.fields.caregiverName")}>
          <input
            data-testid="input-caregiver-name"
            className={inputClass}
            placeholder={t("settings.placeholder.caregiverName")}
            {...register("caregiverName")}
          />
        </Field>
        <Field label={t("settings.fields.caregiverContact")}>
          <input
            data-testid="input-caregiver-contact"
            type="tel"
            className={inputClass}
            placeholder={t("settings.placeholder.caregiverContact")}
            {...register("caregiverContact")}
          />
        </Field>
      </Section>

      {/* Save Button */}
      <div className="mt-5">
        {mutation.isSuccess && (
          <div
            data-testid="status-saved"
            className="flex items-center gap-2 justify-center mb-3 px-4 py-2.5 rounded-[12px] bg-[#F5F3FF] border border-[#DDD6FE]"
          >
            <CheckCircle2 size={16} className="text-vyva-purple flex-shrink-0" />
            <span className="font-body text-[14px] font-medium text-vyva-purple">{t("settings.saved")}</span>
          </div>
        )}
        <button
          data-testid="button-save-changes"
          type="submit"
          disabled={mutation.isPending || isLoading}
          className="w-full py-3.5 rounded-[14px] font-body text-[16px] font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-60"
          style={{ background: "#6B21A8" }}
        >
          {mutation.isPending ? t("settings.saving") : t("settings.saveChanges")}
        </button>
      </div>
    </form>
  );
};

export default SettingsScreen;
