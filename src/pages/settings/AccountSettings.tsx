// src/pages/settings/AccountSettings.tsx
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, X } from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { LANGUAGES, type LanguageCode } from "@/i18n/languages";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AccountSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery<{ firstName: string; lastName: string; avatarUrl: string | null } | null>({
    queryKey: ["/api/profile"],
  });

  const avatarUrl = profileQuery.data?.avatarUrl ?? null;

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
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
  };

  const displayName = profileQuery.data
    ? `${profileQuery.data.firstName} ${profileQuery.data.lastName}`.trim() || "María"
    : "María";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <PhoneFrame subtitle={t("settings.account.title")} showBack onBack={() => navigate("/settings")}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">👤 {t("settings.account.title")}</h2>
          <p className="text-xs text-gray-500 mt-1">{t("settings.account.subtitle")}</p>
        </div>

        {/* Avatar photo */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            <div
              className="w-[88px] h-[88px] rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-[32px]"
              style={{ background: "#6B21A8" }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <button
              data-testid="button-avatar-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className="absolute bottom-0 right-0 w-[30px] h-[30px] rounded-full flex items-center justify-center border-2 border-white shadow-md transition-transform active:scale-90"
              style={{ background: "#6B21A8" }}
              title={t("settings.account.changePhoto", "Change photo")}
            >
              <Camera size={14} className="text-white" />
            </button>
          </div>

          {avatarUrl && (
            <button
              data-testid="button-avatar-remove"
              onClick={() => avatarMutation.mutate(null)}
              disabled={avatarMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border"
              style={{ color: "#B0355A", borderColor: "#B0355A33", background: "#FDF2F8" }}
            >
              <X size={12} />
              {t("settings.account.removePhoto", "Remove photo")}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-avatar-file"
          />

          <p className="text-xs text-center" style={{ color: "#7A7290" }}>
            {t("settings.account.photoHint", "This photo will appear on your community profile")}
          </p>
        </div>

        {([
          { id: "full_name",      label: t("settings.account.fullName"),      placeholder: "", defaultValue: "María García López" },
          { id: "preferred_name", label: t("settings.account.preferredName"), placeholder: "", defaultValue: "María" },
        ] as { id: string; label: string; placeholder: string; defaultValue: string }[]).map(({ id, label, placeholder, defaultValue }) => (
          <div key={id} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs font-bold text-gray-600">{label}</Label>
            <Input id={id} placeholder={placeholder} defaultValue={defaultValue} className="h-11 border-purple-200" />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{t("settings.account.dateOfBirth")}</Label>
            <Input type="date" defaultValue="1948-03-15" className="h-11 border-purple-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{t("settings.account.gender")}</Label>
            <Select defaultValue="female">
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

        {([
          { id: "phone",    label: t("settings.account.phone"),    type: "tel",   placeholder: t("settings.account.phonePlaceholder") },
          { id: "whatsapp", label: t("settings.account.whatsapp"), type: "tel",   placeholder: t("settings.account.whatsappPlaceholder") },
          { id: "email",    label: t("settings.account.email"),    type: "email", placeholder: t("settings.account.emailPlaceholder") },
        ] as { id: string; label: string; type: string; placeholder: string }[]).map(({ id, label, type, placeholder }) => (
          <div key={id} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs font-bold text-gray-600">{label}</Label>
            <Input id={id} type={type} placeholder={placeholder} className="h-11 border-purple-200" />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">{t("settings.account.language")}</Label>
            <Select
              value={language}
              onValueChange={(value) => setLanguage(value as LanguageCode)}
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
            <Label className="text-xs font-bold text-gray-600">{t("settings.account.timezone")}</Label>
            <Select defaultValue="madrid">
              <SelectTrigger className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="madrid">{t("settings.account.tzMadrid")}</SelectItem>
                <SelectItem value="berlin">{t("settings.account.tzBerlin")}</SelectItem>
                <SelectItem value="london">{t("settings.account.tzLondon")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]"
            data-testid="button-account-save"
          >
            {saving ? t("settings.account.saving") : t("settings.account.saveChanges")}
          </Button>
          <button className="text-xs text-red-500 py-2">{t("settings.account.changePassword")}</button>
          <button
            data-testid="button-account-sign-out"
            onClick={() => { logout(); navigate("/login"); }}
            className="text-xs text-red-500 py-2 font-semibold"
          >
            {t("settings.account.signOut")}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}
