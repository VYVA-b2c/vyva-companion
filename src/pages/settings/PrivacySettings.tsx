import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Eye, Share2, Heart, Shield, FileText } from "lucide-react";
import { ToggleRow } from "@/components/onboarding/ToggleRow";

const PEOPLE = [
  { id: "sarah", name: "Sarah Collins", role: "profile.roles.daughter" },
  { id: "james", name: "James Collins", role: "profile.roles.son" },
  { id: "linda", name: "Linda Hughes", role: "profile.roles.carer" },
  { id: "dr_patel", name: "Dr. Anita Patel", role: "profile.roles.gp" },
];

interface PersonConsent {
  health: boolean;
  location: boolean;
  conversations: boolean;
}

const DEFAULT_CONSENT: PersonConsent = {
  health: false,
  location: false,
  conversations: false,
};

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [globalToggles, setGlobalToggles] = useState({
    analytics: false,
    dataImprovement: false,
  });
  const [personConsents, setPersonConsents] = useState<Record<string, PersonConsent>>(
    Object.fromEntries(PEOPLE.map((p) => [p.id, { ...DEFAULT_CONSENT, health: p.id !== "dr_patel" }]))
  );
  const [expandedPerson, setExpandedPerson] = useState<string | null>("sarah");

  const toggleGlobal = (key: keyof typeof globalToggles) =>
    setGlobalToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const togglePersonConsent = (personId: string, key: keyof PersonConsent) =>
    setPersonConsents((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], [key]: !prev[personId][key] },
    }));

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-privacy-back"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <h1 className="font-display text-[22px] font-semibold text-vyva-text-1">{t("settings.privacy.title")}</h1>
      </div>

      <div className="flex-1 px-5 space-y-4 pb-8">
        {/* Global toggles */}
        <div
          className="bg-white rounded-[18px] border border-vyva-border overflow-hidden"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
          data-testid="section-privacy-global"
        >
          <div className="px-4 py-[11px] bg-vyva-warm border-b border-vyva-border">
            <span className="font-body text-[12px] font-medium text-vyva-text-2 uppercase tracking-wider">
              {t("settings.privacy.vyvaDataUse")}
            </span>
          </div>
          <ToggleRow
            icon={FileText}
            iconBg="#EDE9FE"
            iconColor="#6B21A8"
            label={t("settings.privacy.analyticsLabel")}
            sub={t("settings.privacy.analyticsSub")}
            value={globalToggles.analytics}
            onToggle={() => toggleGlobal("analytics")}
            testId="toggle-privacy-analytics"
          />
          <ToggleRow
            icon={Eye}
            iconBg="#EDE9FE"
            iconColor="#6B21A8"
            label={t("settings.privacy.aiImprovementLabel")}
            sub={t("settings.privacy.aiImprovementSub")}
            value={globalToggles.dataImprovement}
            onToggle={() => toggleGlobal("dataImprovement")}
            testId="toggle-privacy-ai-improvement"
          />
        </div>

        {/* Per-person consents */}
        <div
          className="bg-white rounded-[18px] border border-vyva-border overflow-hidden"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
          data-testid="section-privacy-per-person"
        >
          <div className="px-4 py-[11px] bg-vyva-warm border-b border-vyva-border">
            <span className="font-body text-[12px] font-medium text-vyva-text-2 uppercase tracking-wider">
              {t("settings.privacy.whatIShare")}
            </span>
          </div>

          {PEOPLE.map((person) => {
            const consents = personConsents[person.id];
            const isOpen = expandedPerson === person.id;
            return (
              <div
                key={person.id}
                className="border-t border-vyva-border first:border-t-0"
                data-testid={`item-privacy-person-${person.id}`}
              >
                <button
                  data-testid={`button-privacy-expand-${person.id}`}
                  onClick={() => setExpandedPerson(isOpen ? null : person.id)}
                  className="w-full flex items-center gap-3 px-4 py-[13px] text-left hover:bg-vyva-warm/40"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-body text-[14px] font-medium text-white"
                    style={{ background: "#6B21A8" }}
                    data-testid={`avatar-privacy-${person.id}`}
                  >
                    {person.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[15px] font-medium text-vyva-text-1">{person.name}</p>
                    <p className="font-body text-[12px] text-vyva-text-2">{t(person.role)}</p>
                  </div>
                  <span className="font-body text-[12px] text-vyva-text-3">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && (
                  <div
                    className="bg-vyva-cream/60 border-t border-vyva-border"
                    data-testid={`section-privacy-detail-${person.id}`}
                  >
                    <ToggleRow
                      icon={Heart}
                      iconBg="#FDF2F8"
                      iconColor="#B0355A"
                      label={t("settings.privacy.healthLabel")}
                      sub={t("settings.privacy.healthSub")}
                      value={consents.health}
                      onToggle={() => togglePersonConsent(person.id, "health")}
                      testId={`toggle-privacy-${person.id}-health`}
                    />
                    <ToggleRow
                      icon={Shield}
                      iconBg="#FEF2F2"
                      iconColor="#B91C1C"
                      label={t("settings.privacy.locationLabel")}
                      sub={t("settings.privacy.locationSub")}
                      value={consents.location}
                      onToggle={() => togglePersonConsent(person.id, "location")}
                      testId={`toggle-privacy-${person.id}-location`}
                    />
                    <ToggleRow
                      icon={Share2}
                      iconBg="#F5F3FF"
                      iconColor="#6B21A8"
                      label={t("settings.privacy.conversationsLabel")}
                      sub={t("settings.privacy.conversationsSub")}
                      value={consents.conversations}
                      onToggle={() => togglePersonConsent(person.id, "conversations")}
                      testId={`toggle-privacy-${person.id}-conversations`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="font-body text-[11px] text-vyva-text-3 text-center">
          {t("settings.privacy.gdprFooter")}
        </p>
      </div>
    </div>
  );
};

export default PrivacySettings;
