import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, X } from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { LANGUAGES, type LanguageCode } from "@/i18n/languages";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ProfileResponse = {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  country?: string;
  language?: string;
  timezone?: string;
  avatarUrl: string | null;
};

type AccountForm = {
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  phoneCountry: string;
  phoneLocal: string;
  whatsapp: string;
  email: string;
  language: LanguageCode;
  timezone: string;
};

const ACCOUNT_LANGUAGE_COPY: Record<LanguageCode, Record<string, string>> = {
  es: {
    required: "Obligatorio",
    optional: "Opcional",
    minimumInfoTitle: "Para empezar, completa los datos obligatorios.",
    minimumInfoHint: "El nombre, los apellidos y el numero de telefono son obligatorios para usar VYVA.",
    firstName: "Nombre",
    lastName: "Apellidos",
    firstNameRequired: "El nombre es obligatorio.",
    lastNameRequired: "Los apellidos son obligatorios.",
    phoneRequired: "El numero de telefono es obligatorio.",
    requiredFieldsMissing: "Completa los campos obligatorios.",
    saved: "Datos de la cuenta guardados",
    saveError: "No se pudieron guardar los datos de la cuenta",
    defaultName: "Maria",
  },
  en: {
    required: "Required",
    optional: "Optional",
    minimumInfoTitle: "To begin, please complete the required details.",
    minimumInfoHint: "First name, last name, and phone number are required to use VYVA.",
    firstName: "First name",
    lastName: "Last name",
    firstNameRequired: "First name is required.",
    lastNameRequired: "Last name is required.",
    phoneRequired: "Phone number is required.",
    requiredFieldsMissing: "Please complete the required fields.",
    saved: "Account details saved",
    saveError: "Could not save account details",
    defaultName: "Maria",
  },
  fr: {
    required: "Obligatoire",
    optional: "Optionnel",
    minimumInfoTitle: "Pour commencer, veuillez remplir les informations obligatoires.",
    minimumInfoHint: "Le prenom, le nom et le numero de telephone sont obligatoires pour utiliser VYVA.",
    firstName: "Prenom",
    lastName: "Nom",
    firstNameRequired: "Le prenom est obligatoire.",
    lastNameRequired: "Le nom est obligatoire.",
    phoneRequired: "Le numero de telephone est obligatoire.",
    requiredFieldsMissing: "Veuillez remplir les champs obligatoires.",
    saved: "Informations du compte enregistrees",
    saveError: "Impossible d'enregistrer les informations du compte",
    defaultName: "Maria",
  },
  de: {
    required: "Pflichtfeld",
    optional: "Optional",
    minimumInfoTitle: "Bitte vervollstandigen Sie zuerst die Pflichtangaben.",
    minimumInfoHint: "Vorname, Nachname und Telefonnummer sind erforderlich, um VYVA zu nutzen.",
    firstName: "Vorname",
    lastName: "Nachname",
    firstNameRequired: "Der Vorname ist erforderlich.",
    lastNameRequired: "Der Nachname ist erforderlich.",
    phoneRequired: "Die Telefonnummer ist erforderlich.",
    requiredFieldsMissing: "Bitte fullen Sie die Pflichtfelder aus.",
    saved: "Kontodaten gespeichert",
    saveError: "Die Kontodaten konnten nicht gespeichert werden",
    defaultName: "Maria",
  },
  it: {
    required: "Obbligatorio",
    optional: "Opzionale",
    minimumInfoTitle: "Per iniziare, completa i dati obbligatori.",
    minimumInfoHint: "Nome, cognome e numero di telefono sono obbligatori per usare VYVA.",
    firstName: "Nome",
    lastName: "Cognome",
    firstNameRequired: "Il nome e obbligatorio.",
    lastNameRequired: "Il cognome e obbligatorio.",
    phoneRequired: "Il numero di telefono e obbligatorio.",
    requiredFieldsMissing: "Completa i campi obbligatori.",
    saved: "Dati dell'account salvati",
    saveError: "Impossibile salvare i dati dell'account",
    defaultName: "Maria",
  },
  pt: {
    required: "Obrigatorio",
    optional: "Opcional",
    minimumInfoTitle: "Para comecar, preencha os dados obrigatorios.",
    minimumInfoHint: "Primeiro nome, apelido e numero de telefone sao obrigatorios para usar a VYVA.",
    firstName: "Primeiro nome",
    lastName: "Apelido",
    firstNameRequired: "O primeiro nome e obrigatorio.",
    lastNameRequired: "O apelido e obrigatorio.",
    phoneRequired: "O numero de telefone e obrigatorio.",
    requiredFieldsMissing: "Preencha os campos obrigatorios.",
    saved: "Dados da conta guardados",
    saveError: "Nao foi possivel guardar os dados da conta",
    defaultName: "Maria",
  },
};

const TIMEZONE_OPTIONS = [
  { value: "us_eastern", label: "US - Eastern (EST/EDT)", zone: "America/New_York" },
  { value: "us_central", label: "US - Central (CST/CDT)", zone: "America/Chicago" },
  { value: "us_mountain", label: "US - Mountain (MST/MDT)", zone: "America/Denver" },
  { value: "us_pacific", label: "US - Pacific (PST/PDT)", zone: "America/Los_Angeles" },
  { value: "canada_atlantic", label: "Canada - Atlantic (AST/ADT)", zone: "America/Halifax" },
  { value: "london", label: "UK - London (GMT/BST)", zone: "Europe/London" },
  { value: "europe_central", label: "Europe - Paris/Berlin/Madrid (CET/CEST)", zone: "Europe/Madrid" },
  { value: "europe_eastern", label: "Europe - Athens/Helsinki (EET/EEST)", zone: "Europe/Athens" },
  { value: "sydney", label: "Australia - Sydney (AEST/AEDT)", zone: "Australia/Sydney" },
  { value: "perth", label: "Australia - Perth (AWST)", zone: "Australia/Perth" },
  { value: "tokyo", label: "Japan - Tokyo (JST)", zone: "Asia/Tokyo" },
  { value: "singapore", label: "Singapore (SGT)", zone: "Asia/Singapore" },
  { value: "mumbai", label: "India - Mumbai (IST)", zone: "Asia/Kolkata" },
  { value: "dubai", label: "UAE - Dubai (GST)", zone: "Asia/Dubai" },
  { value: "sao_paulo", label: "Brazil - São Paulo (BRT)", zone: "America/Sao_Paulo" },
  { value: "mexico_city", label: "Mexico - Mexico City (CST)", zone: "America/Mexico_City" },
];

const PHONE_COUNTRY_OPTIONS = [
  { value: "ES", dialCode: "+34", label: "ES" },
  { value: "UK", dialCode: "+44", label: "UK" },
  { value: "US", dialCode: "+1", label: "US" },
  { value: "DE", dialCode: "+49", label: "DE" },
  { value: "FR", dialCode: "+33", label: "FR" },
  { value: "IT", dialCode: "+39", label: "IT" },
  { value: "PT", dialCode: "+351", label: "PT" },
  { value: "AE", dialCode: "+971", label: "AE" },
];

const COUNTRY_DEFAULTS: Record<string, { timezone: string; language: LanguageCode }> = {
  ES: { timezone: "europe_central", language: "es" },
  UK: { timezone: "london", language: "en" },
  US: { timezone: "us_eastern", language: "en" },
  DE: { timezone: "europe_central", language: "de" },
  FR: { timezone: "europe_central", language: "fr" },
  IT: { timezone: "europe_central", language: "it" },
  PT: { timezone: "europe_central", language: "pt" },
  AE: { timezone: "dubai", language: "en" },
};

function splitPhoneNumber(phone: string | undefined, countryCode: string | undefined) {
  const fallbackCountry = PHONE_COUNTRY_OPTIONS.find((option) => option.value === (countryCode || "ES"))?.value ?? "ES";
  const rawPhone = (phone ?? "").trim();
  if (!rawPhone) {
    return { phoneCountry: fallbackCountry, phoneLocal: "" };
  }

  const matchedOption = PHONE_COUNTRY_OPTIONS.find((option) => rawPhone.startsWith(option.dialCode));
  if (!matchedOption) {
    return { phoneCountry: fallbackCountry, phoneLocal: rawPhone.replace(/[^\d\s-]/g, "").trim() };
  }

  return {
    phoneCountry: matchedOption.value,
    phoneLocal: rawPhone.slice(matchedOption.dialCode.length).trim(),
  };
}

function buildPhoneNumber(phoneCountry: string, phoneLocal: string) {
  const option = PHONE_COUNTRY_OPTIONS.find((entry) => entry.value === phoneCountry) ?? PHONE_COUNTRY_OPTIONS[0];
  const cleanedLocal = phoneLocal.trim();
  if (!cleanedLocal) return "";
  return `${option.dialCode} ${cleanedLocal}`.trim();
}

function formatPhoneLocal(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  const groups = digits.match(/.{1,3}/g);
  return groups ? groups.join(" ") : "";
}

function getTimezoneValue(zone: string | undefined) {
  return TIMEZONE_OPTIONS.find((option) => option.zone === zone)?.value ?? "europe_central";
}

function getTimezoneZone(value: string) {
  return TIMEZONE_OPTIONS.find((option) => option.value === value)?.zone ?? "Europe/Madrid";
}

function getDefaultsForCountry(countryCode: string) {
  return COUNTRY_DEFAULTS[countryCode] ?? COUNTRY_DEFAULTS.ES;
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [timezoneTouched, setTimezoneTouched] = useState(false);
  const [languageTouched, setLanguageTouched] = useState(false);
  const [form, setForm] = useState<AccountForm>({
    firstName: "",
    lastName: "",
    preferredName: "",
    dateOfBirth: "",
    gender: "female",
    phoneCountry: "ES",
    phoneLocal: "",
    whatsapp: "",
    email: "",
    language,
    timezone: "europe_central",
  });
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; phone?: string }>({});

  const profileQuery = useQuery<ProfileResponse | null>({
    queryKey: ["/api/profile"],
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    const phoneParts = splitPhoneNumber(profileQuery.data.phone, profileQuery.data.country as string | undefined);
    const defaultForCountry = getDefaultsForCountry(phoneParts.phoneCountry);
    setForm((current) => ({
      ...current,
      firstName: profileQuery.data.firstName ?? "",
      lastName: profileQuery.data.lastName ?? "",
      preferredName: profileQuery.data.preferredName ?? "",
      dateOfBirth: profileQuery.data.dateOfBirth ?? "",
      phoneCountry: phoneParts.phoneCountry,
      phoneLocal: formatPhoneLocal(phoneParts.phoneLocal),
      email: profileQuery.data.email ?? "",
      language: (profileQuery.data.language as LanguageCode | undefined) ?? defaultForCountry.language,
      timezone: profileQuery.data.timezone ? getTimezoneValue(profileQuery.data.timezone) : defaultForCountry.timezone,
    }));
    setTimezoneTouched(Boolean(profileQuery.data.timezone));
    setLanguageTouched(Boolean(profileQuery.data.language));
  }, [profileQuery.data]);

  useEffect(() => {
    setForm((current) => ({ ...current, language }));
  }, [language]);

  useEffect(() => {
    const defaults = getDefaultsForCountry(form.phoneCountry);
    setForm((current) => ({
      ...current,
      timezone: timezoneTouched ? current.timezone : defaults.timezone,
      language: languageTouched ? current.language : defaults.language,
    }));

    if (!languageTouched && language !== defaults.language) {
      setLanguage(defaults.language);
    }
  }, [form.phoneCountry, languageTouched, timezoneTouched, language, setLanguage]);

  const avatarUrl = profileQuery.data?.avatarUrl ?? null;
  const accountCopy = ACCOUNT_LANGUAGE_COPY[language] ?? ACCOUNT_LANGUAGE_COPY.es;

  const avatarMutation = useMutation({
    mutationFn: async (dataUrl: string | null) => {
      const res = await apiFetch("/api/profile/avatar", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: t("settings.account.photoUpdated", "Photo updated") });
    },
    onError: () => {
      toast({ title: t("settings.account.photoError", "Could not update photo"), variant: "destructive" });
    },
  });

  const displayName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim() || accountCopy.defaultName;
  const initial = displayName.charAt(0).toUpperCase();
  const requiredText = accountCopy.required;
  const optionalText = accountCopy.optional;

  const renderFieldLabel = (label: string, required: boolean) => (
    <span className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <span>{label}</span>
        {required ? <span className="text-sm leading-none" style={{ color: "#B0355A" }}>*</span> : null}
      </span>
      <span className="text-[11px] font-medium" style={{ color: required ? "#B0355A" : "#7A7290" }}>
        {required ? requiredText : optionalText}
      </span>
    </span>
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      avatarMutation.mutate(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    const nextErrors: { firstName?: string; lastName?: string; phone?: string } = {};
    if (!form.firstName.trim()) nextErrors.firstName = accountCopy.firstNameRequired;
    if (!form.lastName.trim()) nextErrors.lastName = accountCopy.lastNameRequired;
    if (!form.phoneLocal.trim()) nextErrors.phone = accountCopy.phoneRequired;
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: accountCopy.requiredFieldsMissing,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          preferredName: form.preferredName.trim(),
          dateOfBirth: form.dateOfBirth,
          phone: buildPhoneNumber(form.phoneCountry, form.phoneLocal),
          email: form.email.trim(),
          language: form.language,
          country: form.phoneCountry,
          timezone: getTimezoneZone(form.timezone),
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: accountCopy.saved });
    } catch {
      toast({
        title: accountCopy.saveError,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PhoneFrame subtitle={t("settings.account.title")} showBack onBack={() => navigate("/settings")}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("settings.account.title")}</h2>
          <p className="mt-1 text-xs text-gray-500">{t("settings.account.subtitle")}</p>
        </div>

        <div
          className="rounded-[14px] border px-4 py-3"
          style={{ background: "#FCF7FF", borderColor: "#E9D5FF" }}
        >
          <p className="text-sm font-semibold" style={{ color: "#5B21B6" }}>
            {accountCopy.minimumInfoTitle}
          </p>
          <p className="mt-1 text-xs" style={{ color: "#7A7290" }}>
            {accountCopy.minimumInfoHint}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            <div
              className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full text-[32px] font-bold text-white"
              style={{ background: "#6B21A8" }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <button
              data-testid="button-avatar-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className="absolute bottom-0 right-0 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white shadow-md transition-transform active:scale-90"
              style={{ background: "#6B21A8" }}
              title={t("settings.account.changePhoto", "Change photo")}
            >
              <Camera size={14} className="text-white" />
            </button>
          </div>

          {avatarUrl ? (
            <button
              data-testid="button-avatar-remove"
              onClick={() => avatarMutation.mutate(null)}
              disabled={avatarMutation.isPending}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{ color: "#B0355A", borderColor: "#B0355A33", background: "#FDF2F8" }}
            >
              <X size={12} />
              {t("settings.account.removePhoto", "Remove photo")}
            </button>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-avatar-file"
          />

          <p className="text-center text-xs" style={{ color: "#7A7290" }}>
            {t("settings.account.photoHint", "This photo will appear on your community profile")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="first_name" className="text-xs font-bold text-gray-600">
              {renderFieldLabel(accountCopy.firstName, true)}
            </Label>
            <Input
              id="first_name"
              value={form.firstName}
              onChange={(e) => {
                setForm((current) => ({ ...current, firstName: e.target.value }));
                if (errors.firstName) setErrors((current) => ({ ...current, firstName: undefined }));
              }}
              className={`h-12 ${errors.firstName ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              style={{
                borderColor: errors.firstName ? "#F87171" : "#C4B5FD",
                background: "#FCF7FF",
              }}
              aria-required="true"
            />
            {errors.firstName ? <p className="text-xs text-red-500">{errors.firstName}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="last_name" className="text-xs font-bold text-gray-600">
              {renderFieldLabel(accountCopy.lastName, true)}
            </Label>
            <Input
              id="last_name"
              value={form.lastName}
              onChange={(e) => {
                setForm((current) => ({ ...current, lastName: e.target.value }));
                if (errors.lastName) setErrors((current) => ({ ...current, lastName: undefined }));
              }}
              className={`h-12 ${errors.lastName ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              style={{
                borderColor: errors.lastName ? "#F87171" : "#C4B5FD",
                background: "#FCF7FF",
              }}
              aria-required="true"
            />
            {errors.lastName ? <p className="text-xs text-red-500">{errors.lastName}</p> : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="preferred_name" className="text-xs font-bold text-gray-600">
            {renderFieldLabel(t("settings.account.preferredName"), false)}
          </Label>
          <Input
            id="preferred_name"
            value={form.preferredName}
            onChange={(e) => setForm((current) => ({ ...current, preferredName: e.target.value }))}
            className="h-11 border-purple-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{renderFieldLabel(t("settings.account.dateOfBirth"), false)}</Label>
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((current) => ({ ...current, dateOfBirth: e.target.value }))}
              className="h-11 border-purple-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{renderFieldLabel(t("settings.account.gender"), false)}</Label>
            <Select value={form.gender} onValueChange={(value) => setForm((current) => ({ ...current, gender: value }))}>
              <SelectTrigger className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">{t("settings.account.genderFemale")}</SelectItem>
                <SelectItem value="male">{t("settings.account.genderMale")}</SelectItem>
                <SelectItem value="non_binary">{t("settings.account.genderNonBinary")}</SelectItem>
                <SelectItem value="prefer_not">{t("settings.account.genderPreferNot")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-bold text-gray-600">
            {renderFieldLabel(t("settings.account.phone"), true)}
          </Label>
          <div className="grid grid-cols-[122px_minmax(0,1fr)] gap-3">
            <Select
              value={form.phoneCountry}
              onValueChange={(value) => setForm((current) => ({ ...current, phoneCountry: value }))}
            >
              <SelectTrigger className="h-12 border-purple-200 bg-[#FCF7FF]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHONE_COUNTRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.dialCode} {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="phone"
              type="tel"
              value={form.phoneLocal}
              onChange={(e) => {
                setForm((current) => ({ ...current, phoneLocal: formatPhoneLocal(e.target.value) }));
                if (errors.phone) setErrors((current) => ({ ...current, phone: undefined }));
              }}
              placeholder={t("settings.account.phonePlaceholder", "000 000 000")}
              className={`h-12 ${errors.phone ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              style={{
                borderColor: errors.phone ? "#F87171" : "#C4B5FD",
                background: "#FCF7FF",
              }}
              aria-required="true"
            />
          </div>
          {errors.phone ? <p className="text-xs text-red-500">{errors.phone}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatsapp" className="text-xs font-bold text-gray-600">
            {renderFieldLabel(t("settings.account.whatsapp"), false)}
          </Label>
          <Input
            id="whatsapp"
            type="tel"
            value={form.whatsapp}
            onChange={(e) => setForm((current) => ({ ...current, whatsapp: e.target.value }))}
            placeholder={t("settings.account.whatsappPlaceholder")}
            className="h-11 border-purple-200"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-bold text-gray-600">
            {renderFieldLabel(t("settings.account.email"), false)}
          </Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
            placeholder={t("settings.account.emailPlaceholder")}
            className="h-11 border-purple-200"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{renderFieldLabel(t("settings.account.language"), false)}</Label>
            <Select
              value={form.language}
              onValueChange={(value) => {
                setLanguageTouched(true);
                setLanguage(value as LanguageCode);
                setForm((current) => ({ ...current, language: value as LanguageCode }));
              }}
            >
              <SelectTrigger className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{renderFieldLabel(t("settings.account.timezone"), false)}</Label>
            <Select
              value={form.timezone}
              onValueChange={(value) => {
                setTimezoneTouched(true);
                setForm((current) => ({ ...current, timezone: value }));
              }}
            >
              <SelectTrigger className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-12 w-full bg-[#6b21a8] font-bold hover:bg-[#5b1a8f]"
            data-testid="button-account-save"
          >
            {saving ? t("settings.account.saving") : t("settings.account.saveChanges")}
          </Button>
          <button className="py-2 text-xs text-red-500">{t("settings.account.changePassword")}</button>
          <button
            data-testid="button-account-sign-out"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="py-2 text-xs font-semibold text-red-500"
          >
            {t("settings.account.signOut")}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}
