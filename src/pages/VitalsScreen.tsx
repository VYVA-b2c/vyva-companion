import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import VitalsTracker, { type VitalsTrackerPreviewData } from "@/components/VitalsTracker";
import {
  CanonicalDetailFlowShell,
  CanonicalVoiceButton,
  type CanonicalDetailFlowShellContract,
} from "@/components/CanonicalDetailFlowShell";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useLanguage } from "@/i18n";
import { useOptionalVyvaVoice } from "@/hooks/useVyvaVoice";
import {
  initialVitalsVoiceUiState,
  vitalsVoiceContextHint,
  vitalsVoiceContextUpdate,
  vitalsVoiceDynamicVariables,
  type VitalsVoiceUiState,
} from "@/lib/vitalsVoiceContext";

type PersonalisationProfile = {
  conditions: string[];
};

type VitalsScreenProps = {
  previewData?: VitalsTrackerPreviewData;
  previewConditions?: string[];
  backPath?: string;
};

export default function VitalsScreen({
  previewData,
  previewConditions = [],
  backPath = "/health",
}: VitalsScreenProps = {}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { language } = useLanguage();
  const voice = useOptionalVyvaVoice();
  const headerTitle = t("statusVitals.hub.pageTitle", "Vitals");
  const shellContract: CanonicalDetailFlowShellContract = {
    shellId: "home.production",
    headerId: "detail.voice-touch",
    headerTitle,
    containerId: "flow.rounded-card",
    bottomNavId: "home-sos-reports",
    composer: "hidden",
  };
  const [flowBackAction, setFlowBackAction] = useState<(() => void) | null>(null);
  const [voiceUiState, setVoiceUiState] = useState<VitalsVoiceUiState>(initialVitalsVoiceUiState);
  const handleBackActionChange = useCallback((handler: (() => void) | null) => {
    setFlowBackAction(() => handler);
  }, []);
  const { data: personalisation } = useQuery<PersonalisationProfile>({
    queryKey: ["/api/profile/personalisation"],
    enabled: !previewData,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const baseVoiceContext = t(
    "statusVitals.hub.voiceContext",
    "Vitals support. Help me review recent readings, understand changes from my baseline, or add a new measurement safely.",
  );
  const voiceContext = vitalsVoiceContextHint(baseVoiceContext, voiceUiState);
  const voiceDynamicVariables = vitalsVoiceDynamicVariables(voiceUiState);
  const liveVoiceContext = vitalsVoiceContextUpdate(voiceUiState);
  const voiceStatus = voice?.status;
  const sendVoiceContextUpdate = voice?.sendContextUpdate;

  useEffect(() => {
    if (voiceStatus !== "connected" || !sendVoiceContextUpdate) return;
    sendVoiceContextUpdate(liveVoiceContext);
  }, [liveVoiceContext, sendVoiceContextUpdate, voiceStatus]);

  return (
    <CanonicalDetailFlowShell
      shellContract={shellContract}
      onBack={flowBackAction ?? (() => navigate(backPath))}
      headerAction={(
        <CanonicalVoiceButton
          label={t("statusVitals.hub.voiceLabel", "Talk to VYVA")}
          contextHint={voiceContext}
          agentSlug="health"
          dynamicVariables={voiceDynamicVariables}
          testId="button-vitals-header-voice"
        />
      )}
      shellTestId="vitals-page"
      contentTestId="vitals-page-content"
      backTestId="button-vitals-back"
    >
      <VitalsTracker
        userId={previewData ? "preview-user" : user?.id ?? ""}
        userConditions={previewData ? previewConditions : personalisation?.conditions ?? []}
        previewData={previewData}
        language={language}
        country={profile?.country}
        gpName={profile?.gpName}
        gpPhone={profile?.gpPhone}
        gpEmail={profile?.gpEmail}
        caregiverContact={profile?.caregiverContact}
        onBackActionChange={handleBackActionChange}
        onVoiceStateChange={setVoiceUiState}
      />
    </CanonicalDetailFlowShell>
  );
}
