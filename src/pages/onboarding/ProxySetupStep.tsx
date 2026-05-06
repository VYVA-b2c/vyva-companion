// src/pages/onboarding/ProxySetupStep.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/queryClient";

const RELATIONSHIPS = [
  { value: "child", labelKey: "onboarding.proxySetup.relationships.child" },
  { value: "spouse", labelKey: "onboarding.proxySetup.relationships.spouse" },
  { value: "sibling", labelKey: "onboarding.proxySetup.relationships.sibling" },
  { value: "grandchild", labelKey: "onboarding.proxySetup.relationships.grandchild" },
  { value: "friend", labelKey: "onboarding.proxySetup.relationships.friend" },
  { value: "professional_carer", labelKey: "onboarding.proxySetup.relationships.professionalCarer" },
  { value: "other", labelKey: "onboarding.proxySetup.relationships.other" },
];

export default function ProxySetupStep() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [proxyName, setProxyName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = proxyName.trim().length >= 2 && relationship.length > 0;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    setError(null);
    try {
      const relEntry = RELATIONSHIPS.find((r) => r.value === relationship);
      const relLabel = relEntry ? t(relEntry.labelKey) : relationship;
      const displayName = `${proxyName.trim()} (${relLabel})`;
      const res = await apiFetch("/api/onboarding/proxy", {
        method: "POST",
        body: JSON.stringify({ proxy_name: displayName }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      navigate(data.nextRoute ?? "/onboarding/elder-confirm");
    } catch {
      setError(t("onboarding.proxySetup.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingChrome mainClassName="flex min-h-[calc(100vh-92px)] max-w-[560px] flex-col justify-center">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          data-testid="button-proxy-back"
          onClick={() => navigate("/onboarding/channel")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EFE7DB] bg-white shadow-[0_12px_30px_rgba(72,44,18,0.08)]"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <span className="rounded-full bg-white/80 px-4 py-2 font-body text-[12px] font-extrabold uppercase tracking-[0.18em] text-vyva-purple/75 shadow-[0_12px_30px_rgba(72,44,18,0.08)]">
          {t("onboarding.proxySetup.stepLabel")}
        </span>
      </div>

      <section className="rounded-[34px] border border-[#EFE7DB] bg-white/95 p-5 shadow-[0_24px_70px_rgba(72,44,18,0.12)] backdrop-blur sm:p-7">
        <div className="mb-5">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.24em] text-vyva-purple/70">
            Family setup
          </p>
          <h1 className="mt-2 font-display text-[42px] leading-[0.98] text-[#2E1642]">
            {t("onboarding.proxySetup.heading")}
          </h1>
          <p className="mt-3 font-body text-[14px] leading-[1.55] text-vyva-text-2">
            {t("onboarding.proxySetup.description")}
          </p>
        </div>

        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#F1E9DD]">
          <div className="h-full rounded-full bg-vyva-purple" style={{ width: "40%" }} />
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label className="font-body text-[13px] font-bold text-vyva-text-2">
              {t("onboarding.proxySetup.labelName")} <span className="text-vyva-red">*</span>
            </Label>
            <Input
              data-testid="input-proxy-name"
              placeholder={t("onboarding.proxySetup.placeholderName")}
              value={proxyName}
              onChange={(e) => setProxyName(e.target.value)}
              className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-body text-[13px] font-bold text-vyva-text-2">
              {t("onboarding.proxySetup.labelRelationship")} <span className="text-vyva-red">*</span>
            </Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger data-testid="select-proxy-relationship" className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input">
                <SelectValue placeholder={t("onboarding.proxySetup.placeholderRelationship")} />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(r.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-[20px] border border-[#E8DDF3] bg-[#F5F3FF] px-4 py-3">
            <p className="font-body text-[13px] leading-[1.55] text-vyva-purple">
              {t("onboarding.proxySetup.infoBox")}
            </p>
          </div>

          {error && (
            <p data-testid="text-proxy-error" className="rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
              {error}
            </p>
          )}
        </div>

        <button
          data-testid="button-proxy-continue"
          onClick={handleContinue}
          disabled={!canContinue || saving}
          className="vyva-primary-action mt-6 w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab disabled:opacity-40"
        >
          {saving ? t("onboarding.proxySetup.saving") : t("onboarding.proxySetup.continue")}
          {!saving && <ArrowRight size={17} />}
        </button>
      </section>
    </OnboardingChrome>
  );
}
