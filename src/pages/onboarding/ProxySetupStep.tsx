// src/pages/onboarding/ProxySetupStep.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/queryClient";

const RELATIONSHIPS = [
  { value: "child",             labelKey: "onboarding.proxySetup.relationships.child" },
  { value: "spouse",            labelKey: "onboarding.proxySetup.relationships.spouse" },
  { value: "sibling",           labelKey: "onboarding.proxySetup.relationships.sibling" },
  { value: "grandchild",        labelKey: "onboarding.proxySetup.relationships.grandchild" },
  { value: "friend",            labelKey: "onboarding.proxySetup.relationships.friend" },
  { value: "professional_carer",labelKey: "onboarding.proxySetup.relationships.professionalCarer" },
  { value: "other",             labelKey: "onboarding.proxySetup.relationships.other" },
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
      navigate("/onboarding/elder-confirm");
    } catch {
      setError(t("onboarding.proxySetup.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-proxy-back"
          onClick={() => navigate("/onboarding/channel")}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <div>
          <p className="font-body text-[12px] text-vyva-text-3 uppercase tracking-wider">{t("onboarding.proxySetup.stepLabel")}</p>
          <h1 className="font-display text-[22px] font-semibold text-vyva-text-1">{t("onboarding.proxySetup.heading")}</h1>
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 mb-6">
        <div className="h-1.5 bg-vyva-warm2 rounded-full overflow-hidden">
          <div className="h-full bg-vyva-purple rounded-full" style={{ width: "40%" }} />
        </div>
      </div>

      <div className="flex-1 px-5 space-y-5">
        <p className="font-body text-[14px] text-vyva-text-2">
          {t("onboarding.proxySetup.description")}
        </p>

        {/* Carer name */}
        <div className="space-y-1.5">
          <Label className="font-body text-[13px] font-medium text-vyva-text-2">
            {t("onboarding.proxySetup.labelName")} <span className="text-vyva-red">*</span>
          </Label>
          <Input
            data-testid="input-proxy-name"
            placeholder={t("onboarding.proxySetup.placeholderName")}
            value={proxyName}
            onChange={(e) => setProxyName(e.target.value)}
            className="bg-white"
          />
        </div>

        {/* Relationship */}
        <div className="space-y-1.5">
          <Label className="font-body text-[13px] font-medium text-vyva-text-2">
            {t("onboarding.proxySetup.labelRelationship")} <span className="text-vyva-red">*</span>
          </Label>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger data-testid="select-proxy-relationship" className="bg-white">
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

        {/* Info box */}
        <div className="bg-purple-50 border border-purple-200 rounded-[14px] px-4 py-3">
          <p className="font-body text-[13px] text-purple-700">
            {t("onboarding.proxySetup.infoBox")}
          </p>
        </div>

        {error && (
          <p data-testid="text-proxy-error" className="font-body text-[13px] text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="px-5 py-6">
        <button
          data-testid="button-proxy-continue"
          onClick={handleContinue}
          disabled={!canContinue || saving}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
          style={{ background: "#6B21A8" }}
        >
          {saving ? t("onboarding.proxySetup.saving") : t("onboarding.proxySetup.continue")}
        </button>
      </div>
    </div>
  );
}
