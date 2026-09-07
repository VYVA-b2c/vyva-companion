import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, PhoneCall, UserRound, X } from "lucide-react";
import StatusBar from "./StatusBar";
import BottomNav from "./BottomNav";
import VoiceCallOverlay from "./VoiceCallOverlay";
import VoiceActionCard from "./VoiceActionCard";
import VoiceActionSimulator from "./VoiceActionSimulator";
import MotivationMilestoneProvider from "./MotivationMilestoneProvider";
import {
  buildVoiceActionRouteState,
  emergencyProfileContactFromState,
  getAppShellLayout,
  isBrainCoachAppRoute,
  usesBrainCoachDocklessRoute,
  type EmergencyProfileContact,
  type OnboardingStateResponse,
} from "./appShellUtils";
import { useProfile } from "@/contexts/ProfileContext";
import { type TranscriptEntry, useVyvaVoice } from "@/hooks/useVyvaVoice";
import {
  actionForSpecialistTransfer,
  actionForVoiceUtterance,
  emitVoiceHomeIntent,
  emitVoiceHomeSubflow,
  emitVoiceAppAction,
  homeIntentForVoiceUtterance,
  homeSubflowForVoiceUtterance,
  isActionableVoiceText,
  VYVA_VOICE_APP_ACTION_EVENT,
  VYVA_VOICE_SPECIALIST_TRANSFER_EVENT,
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceAppAction,
  type VoiceSpecialistTransferRequest,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import { useServiceGate } from "@/hooks/useServiceGate";
import { SECTION_VOICE_AUTO_START_KEY } from "@/hooks/useRouteVoiceAutoStart";
import { useToastSurface } from "@/hooks/useToastSurface";
import { useVoiceActionContext } from "@/contexts/VoiceActionContext";
import { useVoiceCanvasContext } from "@/contexts/VoiceCanvasContext";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";
import { emergencyContactForCountry, sanitizePhoneHref } from "@/lib/emergencyContacts";
import { apiFetch } from "@/lib/queryClient";
import { recordVoiceTimelineEvent } from "@/lib/voiceTimeline";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";
import {
  VYVA_HOME_MODE_CONTROL_ACTION_EVENT,
  publishHomeModeControl,
  type HomeInteractionMode,
  type HomeModeControlActionDetail,
  type HomeModeControlDetail,
} from "@/lib/homeModeControl";
import {
  VYVA_VOICE_OVERLAY_PRESENCE_EVENT,
  type VoiceOverlayPresenceDetail,
} from "@/lib/voiceOverlayFocus";
import { VYVA_OPEN_SOS_EVENT } from "@/lib/sosEvents";
import {
  hidesHomeNavPrototypeDock,
  isHomeNavPrototypeDockRoute,
  isHomeNavPrototypeTopbarRoute,
} from "@/lib/homeNavPrototypeRoutes";
import type { VoiceCanvasViewModel } from "@/components/voice-canvas";
import { acknowledgeCrossPillarHandoff } from "@/lib/crossPillarHandoffExecution";
import CrossPillarHandoffRecovery from "./CrossPillarHandoffRecovery";

const compactModeControlFor = (mode: HomeInteractionMode): HomeModeControlDetail => ({
  label: mode === "voice" ? "Switch to touch" : "Switch to voice",
  mode,
  testId: mode === "voice" ? "button-home-mode-touch" : "button-home-mode-voice",
  visible: true,
});

const HIDDEN_COMPACT_MODE_CONTROL: HomeModeControlDetail = {
  ...compactModeControlFor("touch"),
  visible: false,
};

type VoiceSessionDockProps = {
  isSpeaking: boolean;
  isConnecting: boolean;
  transcript: TranscriptEntry[];
  onEnd: () => void;
  voiceSessionPhase: VoiceSessionPhase;
  onOpen: () => void;
  compact?: boolean;
  compactDark?: boolean;
};

function voiceDockPhaseLabel(phase: VoiceSessionPhase) {
  return phase === "speaking" ? "Speaking" : voiceSessionPhaseLabel(phase);
}

function canvasSelectableLabel(viewModel: VoiceCanvasViewModel | undefined, id: string) {
  const choice = viewModel?.choices?.find((item) => item.id === id);
  if (choice) return choice.label;
  const optionCard = viewModel?.blocks?.find((block) => block.kind === "option-card" && block.id === id);
  return optionCard?.title;
}

const VoiceSessionDock = ({
  isSpeaking,
  isConnecting,
  transcript,
  onEnd,
  voiceSessionPhase,
  onOpen,
  compact = false,
  compactDark = false,
}: VoiceSessionDockProps) => {
  const { t } = useTranslation();
  const latestEntry = transcript[transcript.length - 1];
  const previewText = latestEntry?.text || "Voice is active";
  const label = isConnecting
    ? "Connecting"
    : voiceSessionPhase
      ? voiceDockPhaseLabel(voiceSessionPhase)
      : isSpeaking
        ? "Speaking"
        : "Listening";

  if (compact) {
    const compactLabel = t("home.voiceDock.active", "Voice on");
    const compactStopLabel = t("home.voiceDock.stop", "Stop voice");
    return (
      <div className="pointer-events-none fixed bottom-[104px] right-3 z-[64] flex justify-end sm:inset-x-0 sm:right-auto sm:justify-center sm:px-5">
        <section
          data-testid="voice-session-dock"
          data-variant="home-stop"
          className={[
            "pointer-events-auto inline-flex min-h-[44px] max-w-[calc(100vw-24px)] items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 shadow-[0_12px_28px_rgba(24,18,34,0.18)] backdrop-blur-xl sm:min-h-[48px] sm:gap-2 sm:py-1.5 sm:pl-4 sm:pr-1.5",
            compactDark
              ? "border-white/[0.16] bg-[#100A1F]/85 text-[#F8F4FF]"
              : "border-[#E9D5FF] bg-white/92 text-vyva-text-1",
          ].join(" ")}
          aria-label={compactStopLabel}
        >
          <span
            className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6] shadow-[0_0_0_6px_rgba(139,92,246,0.16)]"
            aria-hidden="true"
          />
          <span
            className={[
              "whitespace-nowrap font-body text-[13px] font-black leading-none",
              compactDark ? "text-[#F8F4FF]" : "text-vyva-purple",
            ].join(" ")}
          >
            {compactLabel}
          </span>
          <button
            type="button"
            onClick={onEnd}
            data-testid="button-dock-end-call"
            className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white shadow-[0_10px_22px_rgba(17,17,17,0.2)] transition active:scale-95 sm:h-10 sm:w-10"
            aria-label={compactStopLabel}
            title={compactStopLabel}
          >
            <X size={18} strokeWidth={2.8} />
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[92px] z-[64] flex justify-center px-3 sm:px-4">
      <section
        data-testid="voice-session-dock"
        className="pointer-events-auto flex w-full max-w-[520px] items-center gap-2 rounded-[24px] border border-[#E9D5FF] bg-white/95 px-3 py-3 shadow-[0_18px_48px_rgba(47,33,53,0.18)] backdrop-blur sm:gap-3"
      >
        <button
          type="button"
          onClick={onOpen}
          data-testid="button-open-voice-overlay"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] text-left transition active:scale-[0.99]"
          aria-label="Open voice screen"
          title="Open voice screen"
        >
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
            style={{
              background: "radial-gradient(circle at 45% 38%, #E9D5FF 0%, #A855F7 42%, #5B12A0 100%)",
              boxShadow: "0 0 0 8px rgba(124,58,237,0.08), 0 8px 22px rgba(91,18,160,0.16)",
            }}
          >
            <span
              className="h-5 w-5 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0.12))",
                opacity: 0.72,
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-2 truncate font-body text-[14px] font-black leading-tight text-vyva-purple">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#8B5CF6] shadow-[0_0_0_5px_rgba(139,92,246,0.12)]" />
              {label}
            </p>
            <p className="mt-0.5 truncate font-body text-[13px] font-semibold leading-tight text-vyva-text-2 sm:text-[14px]">
              {previewText}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={onEnd}
          data-testid="button-dock-end-call"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white shadow-[0_12px_28px_rgba(17,17,17,0.22)] transition active:scale-95"
          aria-label="End voice chat"
          title="End chat"
        >
          <X size={20} strokeWidth={2.8} />
        </button>
      </section>
    </div>
  );
};

export const SosSheet = ({
  open,
  onOpenChange,
  country,
  profileContact,
  contactLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country?: string | null;
  profileContact?: EmergencyProfileContact | null;
  contactLoading?: boolean;
}) => {
  const { t } = useTranslation();
  const localEmergency = emergencyContactForCountry(country);
  const contactPhone = profileContact?.primaryPhone || profileContact?.secondaryPhone || "";
  const contactHref = sanitizePhoneHref(contactPhone);
  const contactName = profileContact?.name || t("sos.emergencyContact", "emergency contact");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-[520px] rounded-t-[28px] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 -4px 32px rgba(0,0,0,0.18)" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-vyva-warm2" />

        <div
          className="sos-btn mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "#FEE2E2" }}
        >
          <AlertCircle size={28} style={{ color: "#B91C1C" }} />
        </div>

        <h3 className="mb-1 text-center font-display text-[22px] text-vyva-text-1">{t("sos.title", "Need urgent help?")}</h3>
        <p className="mb-5 px-2 text-center font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">
          {t("sos.description", "Call emergency services now, or call the emergency contact saved in your profile.")}
        </p>

        <div className="grid gap-3">
          <a
            href={localEmergency.telHref}
            onClick={() => onOpenChange(false)}
            className="vyva-primary-action flex min-h-[58px] items-center justify-center gap-2 rounded-full text-[18px] font-black"
            style={{ background: "#B91C1C" }}
            data-testid="button-sos-confirm"
            aria-label={t("sos.callEmergencyAria", "Call emergency services now")}
          >
            <PhoneCall size={20} />
            <span>
              {localEmergency.telHref
                ? t("sos.callEmergencyNumber", "Call {{number}} now", { number: localEmergency.label })
                : t("sos.callEmergency", "Call emergency now")}
            </span>
          </a>
          {contactHref ? (
            <a
              href={contactHref}
              onClick={() => onOpenChange(false)}
              className="vyva-secondary-action flex min-h-[54px] items-center justify-center gap-2 rounded-full text-[16px] font-black"
              data-testid="button-sos-call-contact"
              aria-label={t("sos.callContactAria", "Call {{name}}", { name: contactName })}
            >
              <UserRound size={19} />
              <span>{t("sos.callContact", "Call {{name}}", { name: contactName })}</span>
            </a>
          ) : contactLoading ? (
            <div className="min-h-[54px] rounded-full border border-vyva-border bg-[#FFFCF8] px-4 py-4 text-center font-body text-[14px] font-bold text-vyva-text-2">
              {t("sos.loadingContact", "Checking emergency contact...")}
            </div>
          ) : null}
          <button
            onClick={() => onOpenChange(false)}
            className="vyva-secondary-action min-h-[50px]"
            data-testid="button-sos-cancel"
          >
            {t("sos.cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { profile } = useProfile();
  const { canUseService, guardPath } = useServiceGate();
  const [sosOpen, setSosOpen] = useState(false);
  const [dockVoiceOverlayOpen, setDockVoiceOverlayOpen] = useState(false);
  const [minimizedCanvasKey, setMinimizedCanvasKey] = useState<string | null>(null);
  const [externalVoiceOverlayPresent, setExternalVoiceOverlayPresent] = useState(false);
  const lastVoiceActionRef = useRef<{ key: string; at: number } | null>(null);
  const lastOpenedVoiceActionRef = useRef<{ key: string; at: number } | null>(null);
  const previousPathRef = useRef(location.pathname);
  const {
    status,
    isConnecting,
    isSpeaking,
    transcript,
    startVoice,
    stopVoice,
    beginVoiceTransfer,
    voiceSessionPhase,
    isMicMuted,
    setMicrophoneMuted,
    lastError,
    lastErrorCode,
    voiceDiagnostics,
    sendContextUpdate,
    recordRecommendationFeedback,
  } = useVyvaVoice();
  const {
    activeAction: activeVoiceAction,
    completeActiveAction,
    dismissActiveAction,
  } = useVoiceActionContext();
  const { activeScene: activeCanvasScene, submitResponse: submitCanvasResponse } = useVoiceCanvasContext();
  const appShellLayout = getAppShellLayout(location.pathname);
  const isFullScreen = appShellLayout === "fullscreen";
  const isVitalsRoute = appShellLayout === "vitals";
  const isWideRoute = appShellLayout === "wide";
  const isHomeRoute = location.pathname === "/" || location.pathname === "/dev/home-master";
  const isHomeMasterMenuRoute = location.pathname === "/menu" || location.pathname === "/dev/home-master/menu";
  const isSymptomCheckRoute = location.pathname.startsWith("/health/symptom");
  const isBrainCoachRoute = isBrainCoachAppRoute(location.pathname);
  const isBrainCoachDocklessRoute = usesBrainCoachDocklessRoute(location.pathname);
  const isDevSymptomAssessmentRoute =
    location.pathname === "/dev/home-master/ask-dr-ai" ||
    location.pathname === "/dev/home-master/ask-dr-ai-checking" ||
    location.pathname === "/dev/home-master/ask-dr-ai-next" ||
    location.pathname === "/dev/home-master/symptom-warning" ||
    location.pathname === "/dev/home-master/symptom-report";
  const usesAlignedHubViewport =
    location.pathname === "/menu" ||
    location.pathname === "/health" ||
    isVitalsRoute ||
    isSymptomCheckRoute ||
    isDevSymptomAssessmentRoute;
  const isConciergeExperienceRoute = location.pathname === "/concierge";
  const usesHomeMasterShell = isHomeRoute || isHomeMasterMenuRoute || location.pathname === "/health";
  const ownsPrototypeTopbar = isHomeNavPrototypeTopbarRoute(location.pathname);
  const ownsBrainCoachTopbar = ownsPrototypeTopbar && isBrainCoachRoute;
  const usesPrototypeDock = isHomeNavPrototypeDockRoute(location.pathname);
  const hidePrototypeDock = hidesHomeNavPrototypeDock(location.pathname);
  const usesDevHomeMasterCompactShell =
    usesHomeMasterShell ||
    location.pathname === "/dev/home-master/profile";
  const usesDevHomeMasterDetailShell =
    location.pathname === "/dev/home-master/health" ||
    location.pathname === "/dev/home-master/brain" ||
    location.pathname === "/dev/home-master/community" ||
    location.pathname === "/dev/home-master/concierge" ||
    location.pathname === "/dev/home-master/reports";
  const usesDevHomeMasterPrototypeSurface = location.pathname.startsWith("/dev/home-master");
  const usesCompactVoiceSurface = usesPrototypeDock || hidePrototypeDock || isConciergeExperienceRoute;
  const { isDark: isHomeMasterDark } = useHomeMasterTheme();
  const { size: readableTextSize } = useReadableTextSize();
  const homeMasterPrototypeSurfaceClass = isHomeMasterDark
    ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)]"
    : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)]";
  const compactOuterSurfaceClass = usesDevHomeMasterPrototypeSurface
    ? homeMasterPrototypeSurfaceClass
    : isHomeMasterDark
      ? "bg-[#080715]"
      : "bg-[linear-gradient(180deg,var(--vyva-sky-a)_0%,var(--vyva-sky-b)_100%)]";
  const compactInnerSurfaceClass = usesDevHomeMasterPrototypeSurface
    ? homeMasterPrototypeSurfaceClass
    : isHomeMasterDark
      ? "bg-[radial-gradient(circle_at_50%_18%,#30206B_0%,#171026_46%,#080715_100%)]"
      : "bg-[linear-gradient(180deg,var(--vyva-sky-a)_0%,var(--vyva-sky-b)_100%)]";
  const isCognitiveAssessmentRoute = location.pathname.startsWith("/mind-memory/cognitive-assessment");
  const routeState = location.state as Record<string, unknown> | null;
  const crossPillarHandoffId = typeof routeState?.crossPillarHandoffId === "string"
    ? routeState.crossPillarHandoffId
    : null;
  const chatModeParam = new URLSearchParams(location.search).get("mode");
  const isChatVoiceMode =
    location.pathname === "/chat" &&
    (chatModeParam === "voice" || routeState?.[SECTION_VOICE_AUTO_START_KEY] === true);
  const isChatTypeMode = location.pathname === "/chat" && !isChatVoiceMode;
  const shellMaxWidthClassName = isFullScreen
    ? "max-w-none"
    : isVitalsRoute || isCognitiveAssessmentRoute
      ? "max-w-[1180px]"
      : usesDevHomeMasterPrototypeSurface
        ? "max-w-none"
      : usesDevHomeMasterDetailShell
        ? "max-w-[520px]"
      : usesDevHomeMasterCompactShell
        ? "max-w-[430px] md:max-w-[720px] lg:max-w-[960px]"
      : isSymptomCheckRoute
        ? "max-w-[430px] md:max-w-[720px] lg:max-w-[960px]"
      : isWideRoute
        ? "max-w-[920px]"
        : "max-w-[520px]";
  const voiceActionRouteMatches = activeVoiceAction
    ? location.pathname === activeVoiceAction.route || location.pathname.startsWith(`${activeVoiceAction.route}/`)
    : false;
  const visibleVoiceAction = activeVoiceAction?.domain === "health" ? null : activeVoiceAction;
  const visibleVoiceActionRouteMatches = visibleVoiceAction
    ? location.pathname === visibleVoiceAction.route || location.pathname.startsWith(`${visibleVoiceAction.route}/`)
    : false;
  const showInlineVoiceAction = Boolean(!isFullScreen && visibleVoiceAction && visibleVoiceActionRouteMatches);
  const voiceSurfacePhaseActive =
    voiceSessionPhase === "connecting" ||
    voiceSessionPhase === "listening" ||
    voiceSessionPhase === "speaking" ||
    voiceSessionPhase === "transferring";
  const hasVoiceSessionSurface =
    !isChatTypeMode && (status === "connected" || isConnecting || voiceSurfacePhaseActive || Boolean(lastError));
  const compactVoiceSessionActive = status === "connected" || isConnecting || voiceSurfacePhaseActive;
  const activeCanvasKey = activeCanvasScene
    ? `${activeCanvasScene.viewModel.sceneId}:${activeCanvasScene.revision}`
    : null;
  const showDockVoiceOverlay = !usesCompactVoiceSurface && !isFullScreen && dockVoiceOverlayOpen && (hasVoiceSessionSurface || Boolean(activeCanvasScene));
  const isVoiceOverlayFocused = externalVoiceOverlayPresent || showDockVoiceOverlay;
  const showVoiceDock =
    !isFullScreen &&
    !isHomeRoute &&
    !isChatTypeMode &&
    compactVoiceSessionActive &&
    !isVoiceOverlayFocused;
  const suppressMilestonePopup = isFullScreen ||
    sosOpen ||
    showVoiceDock ||
    isVoiceOverlayFocused ||
    location.pathname === "/learn" ||
    location.pathname === "/sos" ||
    isSymptomCheckRoute ||
    location.pathname.startsWith("/triage");
  const toastSurfaceRef = useToastSurface<HTMLDivElement>(isFullScreen ? 24 : 128);
  const { data: onboardingState, isLoading: sosContactLoading } = useQuery<OnboardingStateResponse>({
    queryKey: ["/api/onboarding/state"],
    queryFn: async () => {
      const response = await apiFetch("/api/onboarding/state");
      if (!response.ok) throw new Error(`onboarding-state ${response.status}`);
      return response.json();
    },
    enabled: sosOpen,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const sosProfileContact = emergencyProfileContactFromState(onboardingState);

  useEffect(() => {
    if (!crossPillarHandoffId) return;
    acknowledgeCrossPillarHandoff(crossPillarHandoffId);
  }, [crossPillarHandoffId, location.pathname]);

  useEffect(() => {
    const handleVoiceOverlayPresence = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? (event.detail as VoiceOverlayPresenceDetail | undefined)
        : undefined;
      setExternalVoiceOverlayPresent(Boolean(detail?.open));
    };

    window.addEventListener(VYVA_VOICE_OVERLAY_PRESENCE_EVENT, handleVoiceOverlayPresence);
    return () => window.removeEventListener(VYVA_VOICE_OVERLAY_PRESENCE_EVENT, handleVoiceOverlayPresence);
  }, []);

  useEffect(() => {
    const handleOpenSos = () => {
      if (canUseService("sos", "/sos")) setSosOpen(true);
    };

    window.addEventListener(VYVA_OPEN_SOS_EVENT, handleOpenSos);
    return () => window.removeEventListener(VYVA_OPEN_SOS_EVENT, handleOpenSos);
  }, [canUseService]);

  useEffect(() => {
    if (!hasVoiceSessionSurface && !activeCanvasScene) setDockVoiceOverlayOpen(false);
  }, [activeCanvasScene, hasVoiceSessionSurface]);

  useEffect(() => {
    if (!isConciergeExperienceRoute) return;
    publishHomeModeControl(compactModeControlFor(compactVoiceSessionActive ? "voice" : "touch"));
  }, [compactVoiceSessionActive, isConciergeExperienceRoute]);

  useEffect(() => {
    if (!isConciergeExperienceRoute) return undefined;
    return () => publishHomeModeControl(HIDDEN_COMPACT_MODE_CONTROL);
  }, [isConciergeExperienceRoute]);

  useEffect(() => {
    if (!isConciergeExperienceRoute) return undefined;

    const handleHomeModeControlAction = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? (event.detail as HomeModeControlActionDetail | undefined)
        : undefined;

      if (!detail || (detail.mode !== "voice" && detail.mode !== "touch")) return;

      setDockVoiceOverlayOpen(false);

      if (detail.mode === "voice") {
        if (!compactVoiceSessionActive) {
          void Promise.resolve(startVoice()).catch(() => undefined);
        }
        return;
      }

      if (compactVoiceSessionActive) stopVoice();
    };

    window.addEventListener(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, handleHomeModeControlAction);
    return () => window.removeEventListener(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, handleHomeModeControlAction);
  }, [compactVoiceSessionActive, isConciergeExperienceRoute, startVoice, stopVoice]);

  useEffect(() => {
    if (!activeCanvasKey || activeCanvasKey === minimizedCanvasKey) return;
    setDockVoiceOverlayOpen(true);
  }, [activeCanvasKey, minimizedCanvasKey]);

  useEffect(() => {
    if (previousPathRef.current === location.pathname) return;

    previousPathRef.current = location.pathname;
    if (!activeCanvasScene) setDockVoiceOverlayOpen(false);
  }, [activeCanvasScene, location.pathname]);

  const minimizeVoiceCanvas = useCallback(() => {
    if (activeCanvasKey) setMinimizedCanvasKey(activeCanvasKey);
    setDockVoiceOverlayOpen(false);
  }, [activeCanvasKey]);

  const handleCanvasChoice = useCallback((choiceId: string) => {
    const label = canvasSelectableLabel(activeCanvasScene?.viewModel, choiceId);
    if (!label) return;
    submitCanvasResponse({ kind: "choice", choiceId, value: label, utterance: label });
  }, [activeCanvasScene, submitCanvasResponse]);

  const handleCanvasPrimary = useCallback((value?: string) => {
    const viewModel = activeCanvasScene?.viewModel;
    if (!viewModel?.primaryAction) return;
    const trimmedValue = value?.trim();
    submitCanvasResponse(viewModel.textEntry && trimmedValue
      ? { kind: "text", value: trimmedValue, utterance: trimmedValue }
      : { kind: "primary", utterance: viewModel.primaryAction.label });
  }, [activeCanvasScene, submitCanvasResponse]);

  const handleCanvasSecondary = useCallback(() => {
    const label = activeCanvasScene?.viewModel.secondaryAction?.label;
    if (!label) return;
    submitCanvasResponse({ kind: "secondary", utterance: label });
  }, [activeCanvasScene, submitCanvasResponse]);

  const handleCanvasFile = useCallback((file: File | null) => {
    const label = file?.name || "Remove file";
    submitCanvasResponse({ kind: "file", file, value: file?.name, utterance: label });
  }, [submitCanvasResponse]);

  const openVoiceAppAction = useCallback((action: VoiceAppAction) => {
    const actionKey = `${action.id}:${action.route}`;
    const previous = lastOpenedVoiceActionRef.current;
    const now = Date.now();
    if (previous?.key === actionKey && now - previous.at < 1200) return true;

    lastOpenedVoiceActionRef.current = { key: actionKey, at: now };
    sendContextUpdate(
      `App action opened: ${action.title}. Route: ${action.route}. Context: ${action.cue}`,
    );

    const alreadyOnRoute = location.pathname === action.route;
    const navigated = alreadyOnRoute || guardPath(action.route, {
      state: buildVoiceActionRouteState(action),
    });

    if (navigated) {
      setDockVoiceOverlayOpen(false);
      void recordRecommendationFeedback("accepted", {
        source: "app_voice_action",
        voice_action_id: action.id,
        voice_action_domain: action.domain,
        voice_action_route: action.route,
        voice_action_title: action.title,
        voice_action_reason: action.feedbackReason,
        source_text: action.sourceText.slice(0, 180),
        already_on_route: alreadyOnRoute,
      }, {
        id: action.id,
        domain: action.domain,
        title: action.title,
        reason: action.feedbackReason,
      });
    }

    return navigated;
  }, [guardPath, location.pathname, recordRecommendationFeedback, sendContextUpdate]);

  useEffect(() => {
    const handleVoiceUserMessage = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? (event.detail as VoiceUserMessageDetail | undefined)
        : undefined;
      if (!detail?.text) return;
      if (!isActionableVoiceText(detail.text)) return;

      if (location.pathname === "/" || location.pathname === "/dev/home-master") {
        const homeSubflow = homeSubflowForVoiceUtterance(detail.text);
        if (homeSubflow) {
          emitVoiceHomeSubflow(homeSubflow);
          return;
        }
        const homeIntent = homeIntentForVoiceUtterance(detail.text);
        if (homeIntent) {
          emitVoiceHomeIntent(homeIntent);
          return;
        }
      }

      const action = actionForVoiceUtterance(detail.text);
      if (!action) return;

      const actionKey = `${action.id}:${action.route}`;
      const previous = lastVoiceActionRef.current;
      const now = Date.now();
      if (previous?.key === actionKey && now - previous.at < 3500) return;

      lastVoiceActionRef.current = { key: actionKey, at: now };
      emitVoiceAppAction(action);
    };

    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceUserMessage);
    return () => window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceUserMessage);
  }, [location.pathname]);

  useEffect(() => {
    const handleVoiceAppAction = (event: Event) => {
      const action = event instanceof CustomEvent ? (event.detail as VoiceAppAction | undefined) : undefined;
      if (!action?.id || !action.route) return;
      openVoiceAppAction(action);
    };

    window.addEventListener(VYVA_VOICE_APP_ACTION_EVENT, handleVoiceAppAction);
    return () => window.removeEventListener(VYVA_VOICE_APP_ACTION_EVENT, handleVoiceAppAction);
  }, [openVoiceAppAction]);

  useEffect(() => {
    const handleSpecialistTransfer = (event: Event) => {
      const request = event instanceof CustomEvent
        ? (event.detail as VoiceSpecialistTransferRequest | undefined)
        : undefined;
      if (!request?.domain) return;

      const action = actionForSpecialistTransfer(request);
      emitVoiceAppAction(action);

      if (request.autoStart === false || !request.agentSlug) return;

      void (async () => {
        if (request.agentSlug === "dr-ai" || request.agentSlug === "ask-dr-ai") {
          try {
            const response = await apiFetch("/api/config/features/dr-ai-voice");
            const access = response.ok ? await response.json() as { enabled?: boolean } : null;
            if (!access?.enabled) {
              recordVoiceTimelineEvent({
                kind: "transfer_blocked",
                title: "Dr. AI voice transfer unavailable",
                detail: "The canonical touch flow remains available.",
                domain: request.domain,
                ...(request.route ? { route: request.route } : {}),
                agentSlug: request.agentSlug,
              });
              sendContextUpdate("Dr. AI voice is not enabled for this account. The Ask Dr. AI touch screen is open, so invite the user to continue there.");
              return;
            }
          } catch (error) {
            console.warn("[VYVA] Could not verify Dr. AI voice access:", error);
            sendContextUpdate("Dr. AI voice could not be opened. The Ask Dr. AI touch screen is still available.");
            return;
          }
        }

        const transferContext = request.contextHint || request.reason || `Transfer to ${request.domain}`;
        recordVoiceTimelineEvent({
          kind: "transfer_requested",
          title: `Transfer to ${request.domain}`,
          detail: request.reason,
          domain: request.domain,
          ...(request.route ? { route: request.route } : {}),
          ...(request.agentSlug ? { agentSlug: request.agentSlug } : {}),
        });
        beginVoiceTransfer();
        window.setTimeout(() => {
          stopVoice();
          window.setTimeout(() => {
            void startVoice(transferContext, undefined, {
              agentSlug: request.agentSlug,
              autoStartListening: true,
              dynamicVariables: {
                app_entrypoint: request.appEntrypoint || "voice_specialist_transfer",
                transfer_domain: request.domain,
                transfer_reason: request.reason,
              },
            });
          }, 650);
        }, 80);
      })();
    };

    window.addEventListener(VYVA_VOICE_SPECIALIST_TRANSFER_EVENT, handleSpecialistTransfer);
    return () => window.removeEventListener(VYVA_VOICE_SPECIALIST_TRANSFER_EVENT, handleSpecialistTransfer);
  }, [beginVoiceTransfer, sendContextUpdate, startVoice, stopVoice]);

  useEffect(() => {
    if (!activeVoiceAction) return;
    if (!voiceActionRouteMatches) return;
    if (activeVoiceAction.domain === "health") {
      completeActiveAction({
        metadata: {
          source: "app_voice_health_route_landed",
          current_path: location.pathname,
        },
      });
      return;
    }
    if (activeVoiceAction.completion?.mode !== "route_landed") return;

    const timer = window.setTimeout(() => {
      completeActiveAction({
        clear: false,
        metadata: {
          source: "app_voice_action_route_landed",
          current_path: location.pathname,
        },
      });
    }, activeVoiceAction.completion.routeLandedDelayMs ?? 1400);

    return () => window.clearTimeout(timer);
  }, [activeVoiceAction, completeActiveAction, location.pathname, voiceActionRouteMatches]);

  const handleCompleteVoiceAction = useCallback(() => {
    completeActiveAction({
      metadata: {
        source: "voice_action_card_done",
        current_path: location.pathname,
      },
    });
  }, [completeActiveAction, location.pathname]);

  const handleDismissVoiceAction = useCallback(() => {
    dismissActiveAction({
      source: "voice_action_card_hide",
      current_path: location.pathname,
    });
  }, [dismissActiveAction, location.pathname]);

  return (
    <MotivationMilestoneProvider disabled={suppressMilestonePopup}>
      <div className={`flex min-h-screen justify-center ${usesCompactVoiceSurface ? compactOuterSurfaceClass : "bg-[radial-gradient(circle_at_top,#fffaf2_0%,#f7f1e9_42%,#f4efe8_100%)]"}`}>
      <div
        ref={toastSurfaceRef}
        data-testid="app-shell"
        data-layout={appShellLayout}
        data-home-master-theme={usesCompactVoiceSurface && isHomeMasterDark ? "dark" : "light"}
        data-vyva-text-size={readableTextSize}
        className={`relative w-full ${shellMaxWidthClassName} ${usesCompactVoiceSurface ? `min-h-screen ${compactInnerSurfaceClass}` : ""}`}
      >
        {!isFullScreen && !ownsPrototypeTopbar && (
          <StatusBar
            wide={!usesCompactVoiceSurface && (isWideRoute || isVitalsRoute)}
            variant={usesCompactVoiceSurface ? "homeMaster" : "default"}
            autoHideHomeControls={location.pathname === "/dev/home-master" ? false : undefined}
          />
        )}
        <main data-testid="app-shell-scroll" className={`${usesAlignedHubViewport ? "h-[100svh] min-h-0 overflow-y-auto [scrollbar-gutter:stable_both-edges] max-lg:[scrollbar-gutter:auto]" : ownsPrototypeTopbar ? "min-h-screen overflow-visible" : "min-h-screen overflow-y-auto"} ${isFullScreen ? "" : ownsBrainCoachTopbar ? (isBrainCoachDocklessRoute ? "pt-0 pb-0" : "pt-0 pb-[112px]") : ownsPrototypeTopbar ? "pt-6 pb-[112px]" : usesCompactVoiceSurface ? "pt-[74px] pb-[112px]" : isVitalsRoute ? "pt-[64px] pb-[112px] lg:pb-10" : "pt-[64px] pb-[112px]"}`}>
          {showInlineVoiceAction && visibleVoiceAction && (
            <div className="px-[22px] pb-3 pt-2">
              <VoiceActionCard
                action={visibleVoiceAction}
                onComplete={handleCompleteVoiceAction}
                onDismiss={handleDismissVoiceAction}
              />
            </div>
          )}
          {children}
        </main>
        {!isFullScreen && !hidePrototypeDock && !isBrainCoachDocklessRoute && (
          <div className={isVitalsRoute ? "lg:hidden" : ""}>
            <BottomNav wide={!usesCompactVoiceSurface && (isWideRoute || isVitalsRoute)} onSosClick={() => {
              if (canUseService("sos", "/sos")) setSosOpen(true);
            }} />
          </div>
        )}
        {!isFullScreen && (
          <SosSheet
            open={sosOpen}
            onOpenChange={setSosOpen}
            country={profile?.country}
            profileContact={sosProfileContact}
            contactLoading={sosContactLoading}
          />
        )}
        {!isFullScreen && !usesCompactVoiceSurface && !isVitalsRoute && !isSymptomCheckRoute && !isBrainCoachRoute && location.pathname !== "/learn" && <VoiceActionSimulator />}
        {showDockVoiceOverlay && (
          <VoiceCallOverlay
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            transcript={transcript}
            onEnd={() => {
              setDockVoiceOverlayOpen(false);
              stopVoice();
            }}
            onMinimize={minimizeVoiceCanvas}
            activeAction={visibleVoiceAction}
            voiceSessionPhase={voiceSessionPhase}
            isMicMuted={isMicMuted}
            onMicToggle={setMicrophoneMuted}
            connectionError={lastError}
            connectionErrorCode={lastErrorCode}
            voiceDiagnostics={voiceDiagnostics}
            onType={() => setDockVoiceOverlayOpen(false)}
            canvasViewModel={activeCanvasScene?.viewModel}
            onCanvasChoice={handleCanvasChoice}
            onCanvasPrimary={handleCanvasPrimary}
            onCanvasSecondary={handleCanvasSecondary}
            onCanvasFile={handleCanvasFile}
          />
        )}
        {showVoiceDock && (
          <VoiceSessionDock
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            transcript={transcript}
            onEnd={stopVoice}
            voiceSessionPhase={voiceSessionPhase}
            onOpen={() => {
              setMinimizedCanvasKey(null);
              setDockVoiceOverlayOpen(true);
            }}
            compact={usesCompactVoiceSurface}
            compactDark={usesCompactVoiceSurface && isHomeMasterDark}
          />
        )}
        <CrossPillarHandoffRecovery />
      </div>
      </div>
    </MotivationMilestoneProvider>
  );
};

export default AppShell;
