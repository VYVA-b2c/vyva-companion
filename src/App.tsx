import React, { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useBrainCoachNavigate as useNavigate } from "@/hooks/useBrainCoachNavigate";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomeFastHelpSyncBridge from "@/components/HomeFastHelpSyncBridge";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageControllerProvider, LanguageFrameBoundary, setLanguage, useLanguage } from "@/i18n";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { VoiceActionProvider } from "@/contexts/VoiceActionContext";
import { VoiceCanvasProvider } from "@/contexts/VoiceCanvasContext";
import { VyvaVoiceProvider } from "@/hooks/useVyvaVoice";
import { recordAgentButtonClick, recordAgentPageChange } from "@/lib/agentAppContext";
import {
  cognitiveAssessmentPracticeStateFromRoute,
  completeCognitiveAssessmentPractice,
} from "@/lib/cognitiveAssessmentPracticeBridge";
import { CAREGIVER_DASHBOARD_ROUTE, isCaregiverAccessibleAppPath, isCaregiverRoutingUser } from "@/lib/onboardingRoute";
import { shouldShowPwaInstallPromptForRoute } from "@/lib/pwaInstallRoutes";
import { writeHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import type { LongevityMoment, PreventionPlanData } from "./pages/PreventionPlan";
import type { VitalsTrackerPreviewData } from "./components/VitalsTracker";
import AppShell from "./components/AppShell";
import { getBrainCoachActivity } from "./games/brainCoachCatalog";
import ServiceGateRoute from "./components/ServiceGateRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import OnboardingGuard from "./components/OnboardingGuard";
import MenuScreen from "./pages/MenuScreen";
import VyvaDemoEntry, {
  VyvaCaregiverDashboard,
  VyvaCaregiverSeniorDetail,
  VyvaSeniorDailyCheckIn,
  VyvaSeniorHome,
  VyvaSeniorMyWeek,
  VyvaSeniorWeeklyCheckIn,
} from "./pages/VyvaMvpDemo";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const InviteLandingPage = lazy(() => import("@/pages/InviteLandingPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const AccessLinkPage = lazy(() => import("@/pages/AccessLinkPage"));
const CareTeamInvitePage = lazy(() => import("@/pages/CareTeamInvitePage"));
const ProfileSelectPage = lazy(() => import("@/pages/ProfileSelectPage"));
const HomeScreen = lazy(() => import("./pages/HomeScreen"));
const PrototypeHomeScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeHomeScreen })));
const PrototypeMenuScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeMenuScreen })));
const PrototypeCheckInScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeCheckInScreen })));
const PrototypeHealthScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeHealthScreen })));
const PrototypeCommunityScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeCommunityScreen })));
const PrototypeConciergeScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeConciergeScreen })));
const PrototypeReportsScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeReportsScreen })));
const PrototypeProfileScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeProfileScreen })));
const PrototypeHealthActionPreviewScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeHealthActionPreviewScreen })));
const PrototypeProfileActionPreviewScreen = lazy(() => import("./pages/HomeNavPrototypeScreens").then((module) => ({ default: module.PrototypeProfileActionPreviewScreen })));
const PrototypeSymptomReportPreviewScreen = lazy(() => import("./pages/SymptomCheckScreen").then((module) => ({ default: module.SymptomReportPreviewScreen })));
const SymptomWarningSignsPreviewScreen = lazy(() => import("./pages/SymptomCheckScreen").then((module) => ({ default: module.SymptomWarningSignsPreviewScreen })));
const SymptomCheckingPreviewScreen = lazy(() => import("./pages/SymptomCheckScreen").then((module) => ({ default: module.SymptomCheckingPreviewScreen })));
const SymptomSeverityPreviewScreen = lazy(() => import("./pages/SymptomCheckScreen").then((module) => ({ default: module.SymptomSeverityPreviewScreen })));
const ChatScreen = lazy(() => import("./pages/ChatScreen"));
const HealthScreen = lazy(() => import("./pages/HealthScreen"));
const LongevityScreen = lazy(() => import("./pages/LongevityScreen"));
const PreventionPlan = lazy(() => import("./pages/PreventionPlan"));
const MedsScreen = lazy(() => import("./pages/MedsScreen"));
const AdherenceReportScreen = lazy(() => import("./pages/AdherenceReportScreen"));
const MedicationRefillsScreen = lazy(() => import("./pages/MedicationRefillsScreen"));
const MindMemoryScreen = lazy(() => import("./pages/MindMemoryScreen"));
const CognitiveAssessmentHubPage = lazy(() => import("./pages/CognitiveAssessmentHubPage"));
const CognitiveAssessmentReportPage = lazy(() => import("./pages/CognitiveAssessmentReportPage"));
const CognitiveAssessmentRunnerPage = lazy(() => import("./pages/CognitiveAssessmentRunnerPage"));
const ActivityScreen = lazy(() => import("./pages/ActivityScreen"));
const LearnSomethingNewPage = lazy(() => import("./pages/LearnSomethingNewPage"));
const RelaxBreatheScreen = lazy(() => import("./pages/RelaxBreatheScreen"));
const ConciergeScreen = lazy(() => import("./pages/ConciergeScreen"));
const ConciergeTaskInboxPage = lazy(() => import("./pages/ConciergeTaskInboxPage"));
const ConciergeShoppingScreen = lazy(() => import("./pages/ConciergeShoppingScreen"));
const SafeHomeScreen = lazy(() => import("./pages/SafeHomeScreen"));
const ScamGuardScreen = lazy(() => import("./pages/ScamGuardScreen"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SpatialNavigator = lazy(() => import("./games/SpatialNavigator"));
const FaceNameMatch = lazy(() => import("./games/FaceNameMatch"));
const AttentionBoostersPage = lazy(() => import("./games/AttentionBoostersPage"));
const ExecutiveFunctionPage = lazy(() => import("./games/ExecutiveFunctionPage"));
const SensesPage = lazy(() => import("./games/SensesPage"));
const MemoryGamesPage = lazy(() => import("./games/memory/MemoryGamesPage"));
const MemoryGameRunner = lazy(() => import("./games/memory/MemoryGameRunner"));
const DualTaskWalk = lazy(() => import("./games/DualTaskWalk"));
const CategorySort = lazy(() => import("./games/CategorySort"));
const NumberTrails = lazy(() => import("./games/NumberTrails"));
const RememberLater = lazy(() => import("./games/RememberLater"));
const CuriousMinds = lazy(() => import("./games/CuriousMinds"));
const ScentMemory = lazy(() => import("./games/ScentMemory"));
const ListenClosely = lazy(() => import("./games/ListenClosely"));
const BreathGarden = lazy(() => import("./games/BreathGarden"));

const PREVENTION_PLAN_PREVIEW: PreventionPlanData = {
  id: "preview-longevity-plan",
  generated_at: "2026-08-01T09:00:00.000Z",
  pillar_heart: "steady",
  pillar_brain: "priority_focus",
  pillar_strength: "steady",
  pillar_nourishment: "thriving",
  pillar_calm: "needs_attention",
  priority_pillar: "brain",
  priority_intervention: "Try ten minutes of Brain Coach daily",
  priority_why: "A short daily practice supports continuity and makes it easier to build a lasting routine.",
  plan_narrative_senior: "Karim, this month we are keeping your plan simple and practical. One clear focus comes first, while the other pillars stay visible.",
  plan_narrative_caregiver: "Monthly wellness plan generated from Karim's recent VYVA signals, with brain and memory selected as the current priority.",
  recommendations: {
    heart: [{ action: "Keep your daily walk going", why: "Consistency supports your heart and circulation." }],
    brain: [
      { action: "Try ten minutes of Brain Coach daily", why: "A regular short practice is easier to sustain." },
      { action: "Choose one familiar Brain Coach activity", why: "Familiarity lowers the effort needed to begin." },
    ],
    strength: [{ action: "Keep moving every day", why: "Any comfortable movement helps preserve stability." }],
    nourishment: [{ action: "Keep water within easy reach", why: "Hydration supports energy and concentration." }],
    calm: [{ action: "Open the Breath Garden for two minutes", why: "Slow breathing can support recovery." }],
  },
  source_signals: { vitals: true, medications: true, cognitive: true, mood: true, symptoms: false },
  trajectory: "first",
};

const VITALS_PREVIEW_DATA: VitalsTrackerPreviewData = {
  analysis: {
    id: "preview-vitals-analysis",
    analysed_at: "2026-08-28T08:35:00.000Z",
    safety_status: "steady",
    recommended_action: "steady",
    risk_score: 16,
    risk_tier: "low",
    senior_message: "Your latest readings look steady. Keep checking them at your usual time.",
    caregiver_note: "Karim's latest readings are steady, with no new alert.",
    acknowledged_at: null,
  },
  recent_readings: [
    {
      signal_type: "resting_hr_bpm",
      value: 72,
      recorded_at: "2026-08-28T08:30:00.000Z",
      source: "manual_entry",
      capture_method: "manual",
      source_confidence: "high",
      source_display_label: "Manual reading",
      source_context_label: "Morning",
      deviation_pct: 1.4,
      context_tag: "morning",
    },
    {
      signal_type: "oxygen_saturation",
      value: 98,
      recorded_at: "2026-08-28T08:29:00.000Z",
      source: "connected_device",
      capture_method: "web_bluetooth",
      source_ref: { device_name: "Pulse oximeter" },
      source_confidence: "high",
      source_display_label: "Pulse oximeter",
      source_context_label: "Resting",
      deviation_pct: 0,
      context_tag: "resting",
    },
    {
      signal_type: "temperature_c",
      value: 36.7,
      recorded_at: "2026-08-28T08:28:00.000Z",
      source: "connected_device",
      capture_method: "web_bluetooth",
      source_ref: { device_name: "Thermometer" },
      source_confidence: "high",
      source_display_label: "Thermometer",
      source_context_label: "Now",
      deviation_pct: 0,
      context_tag: "general",
    },
    {
      signal_type: "glucose_mgdl",
      value: 104,
      recorded_at: "2026-08-28T07:45:00.000Z",
      source: "manual_entry",
      capture_method: "manual",
      source_confidence: "high",
      source_display_label: "Glucose meter",
      source_context_label: "Fasting",
      deviation_pct: 2.9,
      context_tag: "fasting",
    },
    {
      signal_type: "mood_score",
      value: 8,
      recorded_at: "2026-08-28T08:15:00.000Z",
      source: "manual_entry",
      capture_method: "manual",
      source_confidence: "high",
      source_display_label: "Daily check-in",
      source_context_label: "Today",
      deviation_pct: 0,
      context_tag: "general",
    },
    {
      signal_type: "sleep_quality_score",
      value: 7,
      recorded_at: "2026-08-28T08:10:00.000Z",
      source: "manual_entry",
      capture_method: "manual",
      source_confidence: "high",
      source_display_label: "Daily check-in",
      source_context_label: "Last night",
      deviation_pct: -4.1,
      context_tag: "general",
    },
  ],
  latest_alert: null,
};

const VITALS_CONTACT_DOCTOR_PREVIEW_DATA: VitalsTrackerPreviewData = {
  ...VITALS_PREVIEW_DATA,
  analysis: {
    ...VITALS_PREVIEW_DATA.analysis,
    id: "preview-vitals-contact-doctor-analysis",
    safety_status: "contact_doctor",
    recommended_action: "contact_doctor",
    risk_score: 62,
    risk_tier: "high",
    senior_message: "VYVA noticed a change worth same-day medical advice. Share this summary if you can.",
  },
  latest_alert: {
    id: "preview-vitals-contact-doctor-alert",
    severity: "warning",
    message: "Symptom report: Douleur à la tête ou au cou",
  },
};
const WelcomeScreen = lazy(() => import("./pages/onboarding/WelcomeScreen"));
const WhoForStep = lazy(() => import("./pages/onboarding/WhoForStep"));
const BasicsStep = lazy(() => import("./pages/onboarding/BasicsStep"));
const ChannelStep = lazy(() => import("./pages/onboarding/ChannelStep"));
const DataConsentStep = lazy(() => import("./pages/onboarding/DataConsentStep"));
const ActivationStep = lazy(() => import("./pages/onboarding/ActivationStep"));
const ProfileOverview = lazy(() => import("./pages/onboarding/ProfileOverview"));
const SectionCompleteScreen = lazy(() => import("./pages/onboarding/SectionCompleteScreen"));
const ProxySetupStep = lazy(() => import("./pages/onboarding/ProxySetupStep"));
const ElderConfirmStep = lazy(() => import("./pages/onboarding/ElderConfirmStep"));
const ElderConfirmByToken = lazy(() => import("./pages/onboarding/ElderConfirmByToken"));
const GPSection = lazy(() => import("./pages/onboarding/sections/GPSection"));
const ProvidersSection = lazy(() => import("./pages/onboarding/sections/ProvidersSection"));
const AddressSection = lazy(() => import("./pages/onboarding/sections/AddressSection"));
const AllergiesSection = lazy(() => import("./pages/onboarding/sections/AllergiesSection"));
const BasicsSection = lazy(() => import("./pages/onboarding/sections/BasicsSection"));
const CareTeamFlow = lazy(() => import("./pages/onboarding/sections/CareTeamFlow"));
const CognitiveSection = lazy(() => import("./pages/onboarding/sections/CognitiveSection"));
const ConditionsSection = lazy(() => import("./pages/onboarding/sections/ConditionsSection"));
const DevicesSection = lazy(() => import("./pages/onboarding/sections/DevicesSection"));
const DietSection = lazy(() => import("./pages/onboarding/sections/DietSection"));
const EmergencySection = lazy(() => import("./pages/onboarding/sections/EmergencySection"));
const HobbiesSection = lazy(() => import("./pages/onboarding/sections/HobbiesSection"));
const MedicationsSection = lazy(() => import("./pages/onboarding/sections/MedicationsSection"));
const PrivacySettings = lazy(() => import("./pages/settings/PrivacySettings"));
const DoctorChoiceScreen = lazy(() => import("./pages/DoctorChoiceScreen"));
const SymptomCheckScreen = lazy(() => import("./pages/SymptomCheckScreen"));
const CheckHowIFeelScreen = lazy(() => import("./pages/CheckHowIFeelScreen"));
const CheckinHistoryScreen = lazy(() => import("./pages/CheckinHistoryScreen"));
const SharedCheckinReport = lazy(() => import("./pages/SharedCheckinReport"));
const VitalsScreen = lazy(() => import("./pages/VitalsScreen"));
const InformesScreen = lazy(() => import("./pages/InformesScreen"));
const BrainCoachReportScreen = lazy(() => import("./pages/BrainCoachReportScreen"));
const CompanionsScreen = lazy(() => import("./pages/CompanionsScreen"));
const HistoryScreen = lazy(() => import("./pages/HistoryScreen"));
const SubscriptionSettings = lazy(() => import("./pages/settings/SubscriptionSettings"));
const SettingsHome = lazy(() => import("./pages/settings/SettingsHome"));
const AccountSettings = lazy(() => import("./pages/settings/AccountSettings"));
const HealthDevicesSettings = lazy(() => import("./pages/settings/HealthDevicesSettings"));
const NotificationsSettings = lazy(() => import("./pages/settings/NotificationsSettings"));
const ScheduledSupportSettings = lazy(() => import("./pages/settings/ScheduledSupportSettings"));
const TrustedHelpSettings = lazy(() => import("./pages/settings/TrustedHelpSettings"));
const CaregiverDashboardPage = lazy(() => import("./pages/CaregiverDashboardPage"));
const SocialHub = lazy(() => import("./social/SocialHub"));
const SocialRoomsOnlyScreen = lazy(() => import("./social/SocialRoomsOnlyScreen"));
const CommunityActivitiesScreen = lazy(() => import("./social/CommunityActivitiesScreen"));
const ShareStoriesScreen = lazy(() => import("./social/ShareStoriesScreen"));
const AdvisorHub = lazy(() => import("./social/AdvisorHub"));
const AdvisorChat = lazy(() => import("./social/AdvisorChat"));
const MovementExerciseGuideScreen = lazy(() => import("./social/MovementExerciseGuideScreen"));
const RoomScreen = lazy(() => import("./social/RoomScreen"));
const ScreenContactSheet = lazy(() => import("./pages/dev/ScreenContactSheet"));
const AdminModulesPage = lazy(() => import("./pages/admin/AdminModulesPage"));
const ProxyPendingPage = lazy(() => import("./pages/admin/ProxyPendingPage"));
const LifecycleAdminPage = lazy(() => import("./pages/admin/LifecycleAdminPage"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const PhoneOnboardingPage = lazy(() => import("./pages/admin/PhoneOnboardingPage"));
const HomeCardsAdminPage = lazy(() => import("./pages/admin/HomeCardsAdminPage"));
const HeroMessagesAdminPage = lazy(() => import("./pages/admin/HeroMessagesAdminPage"));
const MarketingAdminPage = lazy(() => import("./pages/admin/MarketingAdminPage"));
const VoiceReadinessAdminPage = lazy(() => import("./pages/admin/VoiceReadinessAdminPage"));
const WorkflowCoverageAdminPage = lazy(() => import("./pages/admin/WorkflowCoverageAdminPage"));
const ConciergeReadinessAdminPage = lazy(() => import("./pages/admin/ConciergeReadinessAdminPage"));
const ConciergeSuppliesAdminPage = lazy(() => import("./pages/admin/ConciergeSuppliesAdminPage"));
const TrustedHelpPartnersAdminPage = lazy(() => import("./pages/admin/TrustedHelpPartnersAdminPage"));
const ConciergeQueueAdminPage = lazy(() => import("./pages/admin/ConciergeQueueAdminPage"));
const ConciergeInboundRepliesAdminPage = lazy(() => import("./pages/admin/ConciergeInboundRepliesAdminPage"));
const ProviderDirectoryAdminPage = lazy(() => import("./pages/admin/ProviderDirectoryAdminPage"));
const CuriousMindsReviewPage = lazy(() => import("./pages/admin/CuriousMindsReviewPage"));
const CognitiveAssessmentAdminPage = lazy(() => import("./pages/admin/CognitiveAssessmentAdminPage"));
const LearningLibraryAdminPage = lazy(() => import("./pages/admin/LearningLibraryAdminPage"));
const CuratedActivitiesAdminPage = lazy(() => import("./pages/admin/CuratedActivitiesAdminPage"));
const AdminContentIndexPage = lazy(() => import("./pages/admin/AdminContentIndexPage"));
const RoomPromptsAdminPage = lazy(() => import("./pages/admin/RoomPromptsAdminPage"));

const routerFutureFlags = {
  v7_relativeSplatPath: true,
  v7_startTransition: true,
} as const;

const SECTION_MAP: Record<string, React.ElementType> = {
  allergies: AllergiesSection,
  basics: BasicsSection,
  gp: GPSection,
  providers: ProvidersSection,
  address: AddressSection,
  "care-team": CareTeamFlow,
  cognitive: CognitiveSection,
  conditions: ConditionsSection,
  health: ConditionsSection,
  devices: DevicesSection,
  diet: DietSection,
  emergency: EmergencySection,
  hobbies: HobbiesSection,
  medications: MedicationsSection,
};

function RouteLoadingScreen() {
  return <div className="min-h-screen bg-[#F8F4EF]" aria-busy="true" />;
}

function SectionRouter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const Section = id ? SECTION_MAP[id] : null;

  if (Section) return <Section />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f3f8] gap-4 px-6 text-center">
      <span className="text-5xl">🚧</span>
      <h2 className="text-xl font-bold text-gray-900">{t("onboarding.sectionFallback.title")}</h2>
      <p className="text-sm text-gray-500">{t("onboarding.sectionFallback.subtitle")}</p>
      <button
        onClick={() => navigate("/onboarding/profile")}
        className="mt-2 px-6 py-3 rounded-full bg-[#6b21a8] text-white text-sm font-semibold"
      >
        {t("onboarding.sectionFallback.back")}
      </button>
    </div>
  );
}

function BrainCoachActivityRoute() {
  const { activityId } = useParams<{ activityId: string }>();
  const activity = activityId ? getBrainCoachActivity(activityId) : undefined;

  if (!activity || activity.status !== "active") {
    return <Navigate to="/mind-memory" replace />;
  }

  if (activity.runner.type === "memory-engine") {
    return (
      <AppShell>
        <MemoryGameRunner forcedGameType={activity.runner.gameType} />
      </AppShell>
    );
  }

  switch (activity.runner.componentId) {
    case "remember-later":
      return <AppShell><RememberLaterRoute /></AppShell>;
    case "spatial-navigator":
      return <AppShell><SpatialNavigatorRoute /></AppShell>;
    case "face-name-match":
      return <AppShell><FaceNameMatchRoute /></AppShell>;
    case "curious-minds":
      return <AppShell><CuriousMindsRoute /></AppShell>;
    case "dual-task-walk":
      return <DualTaskWalkRoute />;
    case "number-trails":
      return <NumberTrailsRoute />;
    case "category-sort":
      return <CategorySortRoute />;
    case "scent-memory":
      return <ScentMemoryRoute />;
    case "listen-closely":
      return <ListenCloselyRoute />;
    case "breath-garden":
      return <BreathGardenRoute />;
    default:
      return <Navigate to="/mind-memory" replace />;
  }
}

function SpatialNavigatorRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <SpatialNavigator
      userId={user?.id ?? ""}
      onExit={() => navigate("/brain-coach/remember")}
    />
  );
}

function FaceNameMatchRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <FaceNameMatch
      userId={user?.id ?? ""}
      onExit={() => navigate("/brain-coach/remember")}
    />
  );
}

function RememberLaterRoute() {
  const { user } = useAuth();
  const handoff = useCognitiveAssessmentPracticeHandoff("/brain-coach/remember");

  return (
    <RememberLater
      userId={user?.id ?? ""}
      onExit={handoff.exit}
      assessmentPractice={handoff.practiceState}
      onAssessmentPracticeComplete={handoff.completePractice}
      onAssessmentPracticeReturn={handoff.returnToAssessment}
    />
  );
}

function RememberLaterPreviewRoute() {
  const navigate = useNavigate();

  return (
    <RememberLater
      userId=""
      onExit={() => navigate("/login")}
    />
  );
}

function CuriousMindsRoute() {
  const { user } = useAuth();
  const handoff = useCognitiveAssessmentPracticeHandoff("/brain-coach/think");

  return (
    <CuriousMinds
      userId={user?.id ?? ""}
      onExit={handoff.exit}
      assessmentPractice={handoff.practiceState}
      onAssessmentPracticeComplete={handoff.completePractice}
      onAssessmentPracticeReturn={handoff.returnToAssessment}
    />
  );
}

function CuriousMindsPreviewRoute() {
  const navigate = useNavigate();

  return (
    <CuriousMinds
      userId="dev-user"
      onExit={() => navigate("/login")}
    />
  );
}

function ScentMemoryRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <ScentMemory
      userId={user?.id ?? ""}
      onExit={() => navigate("/brain-coach/calm")}
    />
  );
}

function ListenCloselyRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <ListenClosely
      userId={user?.id ?? ""}
      onExit={() => navigate("/brain-coach/focus")}
    />
  );
}

function BreathGardenRoute() {
  const { user } = useAuth();
  const handoff = useCognitiveAssessmentPracticeHandoff("/brain-coach/calm");

  return (
    <BreathGarden
      userId={user?.id ?? ""}
      onExit={handoff.exit}
      assessmentPractice={handoff.practiceState}
      onAssessmentPracticeComplete={handoff.completePractice}
      onAssessmentPracticeReturn={handoff.returnToAssessment}
    />
  );
}

function ScentMemoryPreviewRoute() {
  const navigate = useNavigate();

  return (
    <ScentMemory
      userId=""
      onExit={() => navigate("/login")}
    />
  );
}

function ListenCloselyPreviewRoute() {
  const navigate = useNavigate();

  return (
    <ListenClosely
      userId=""
      onExit={() => navigate("/login")}
    />
  );
}

function BreathGardenPreviewRoute() {
  const navigate = useNavigate();

  return (
    <BreathGarden
      userId=""
      onExit={() => navigate("/login")}
    />
  );
}

function AdminLoadingScreen({ message = "Loading admin tools" }: { message?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f2eb] px-6 text-center text-[#2f2135]">
      <section className="w-full max-w-md rounded-3xl border border-[#eadfd5] bg-white p-6 shadow-sm">
        <VyvaWordmark className="mx-auto h-auto w-[132px] sm:w-[158px]" />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
        <h1 className="mt-2 font-serif text-3xl">{message}</h1>
        <p className="mt-2 text-sm text-[#7d6b65]">Preparing the admin workspace.</p>
      </section>
    </main>
  );
}

function AdminErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f2eb] px-6 text-center text-[#2f2135]">
      <section className="w-full max-w-md rounded-3xl border border-[#eadfd5] bg-white p-6 shadow-sm">
        <VyvaWordmark className="mx-auto h-auto w-[132px] sm:w-[158px]" />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
        <h1 className="mt-2 font-serif text-3xl">Admin page could not load</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#7d6b65]">{message}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-800"
          >
            Try again
          </button>
          <a
            href="/admin/lifecycle"
            className="rounded-2xl border border-[#eadfd5] bg-white px-5 py-3 text-sm font-bold text-[#2f2135] transition hover:border-purple-200 hover:text-purple-700"
          >
            Admin menu
          </a>
        </div>
      </section>
    </main>
  );
}

class AdminRouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "The admin page could not load.",
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("[admin-route]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <AdminErrorScreen message={this.state.message} />;
    }

    return this.props.children;
  }
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) return <AdminLoadingScreen message="Checking admin access" />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (user.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f2eb] px-6 text-center text-[#2f2135]">
        <section className="max-w-md rounded-3xl border border-[#eadfd5] bg-white p-6 shadow-sm">
          <VyvaWordmark className="mx-auto h-auto w-[132px] sm:w-[158px]" />
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
          <h1 className="mt-2 font-serif text-3xl">Admin access required</h1>
          <p className="mt-2 text-sm text-[#7d6b65]">Your account is signed in, but it does not have the admin role.</p>
          <button
            type="button"
            onClick={logout}
            className="mt-5 rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-800"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <AdminRouteErrorBoundary>
      <Suspense fallback={<AdminLoadingScreen />}>
        {children}
      </Suspense>
    </AdminRouteErrorBoundary>
  );
}

function DualTaskWalkRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return <DualTaskWalk userId={user?.id ?? ""} onExit={() => navigate("/brain-coach/focus")} />;
}

function useCognitiveAssessmentPracticeHandoff(defaultExitPath: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const practiceState = cognitiveAssessmentPracticeStateFromRoute(location.state);

  const exit = React.useCallback(() => {
    navigate(defaultExitPath);
  }, [defaultExitPath, navigate]);

  const completePractice = React.useCallback(() => {
    if (!practiceState) return null;
    return completeCognitiveAssessmentPractice(practiceState);
  }, [practiceState]);

  const returnToAssessment = React.useCallback(() => {
    if (!practiceState) {
      navigate(defaultExitPath);
      return;
    }

    const completed = completeCognitiveAssessmentPractice(practiceState);
    navigate(completed?.returnTo ?? practiceState.returnTo, {
      state: {
        assessmentPracticeCompleted: true,
        recommendedDomain: completed?.recommendedDomain ?? practiceState.recommendedDomain,
      },
    });
  }, [defaultExitPath, navigate, practiceState]);

  return { practiceState, completePractice, returnToAssessment, exit };
}

function CategorySortRoute() {
  const { user } = useAuth();
  const handoff = useCognitiveAssessmentPracticeHandoff("/brain-coach/think");

  return (
    <CategorySort
      userId={user?.id ?? ""}
      onExit={handoff.exit}
      assessmentPractice={handoff.practiceState}
      onAssessmentPracticeComplete={handoff.completePractice}
      onAssessmentPracticeReturn={handoff.returnToAssessment}
    />
  );
}

function NumberTrailsRoute() {
  const { user } = useAuth();
  const handoff = useCognitiveAssessmentPracticeHandoff("/brain-coach/think");

  return (
    <NumberTrails
      userId={user?.id ?? ""}
      onExit={handoff.exit}
      assessmentPractice={handoff.practiceState}
      onAssessmentPracticeComplete={handoff.completePractice}
      onAssessmentPracticeReturn={handoff.returnToAssessment}
    />
  );
}

function RootRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen bg-[#F8F4EF]" />;
  if (!user) return <LandingPage />;
  if (isCaregiverRoutingUser(user)) {
    return <Navigate to={CAREGIVER_DASHBOARD_ROUTE} replace />;
  }

  return (
    <AppShell>
      <HomeScreen />
    </AppShell>
  );
}

function primeHomeMasterPreviewData() {
  queryClient.setQueryData(["/api/profile"], {
    firstName: "Karim",
    lastName: "",
    email: "",
    phone: "",
    country: "ES",
    timezone: "Europe/Madrid",
    language: "es",
    languagePreference: "es",
    profileId: "home-master-preview",
    street: "",
    cityState: "",
    postalCode: "",
    caregiverName: "",
    caregiverContact: "",
  });
  queryClient.setQueryData(["/api/meds/adherence-report"], {
    todaySummary: {
      scheduled: 1,
      remaining: 1,
    },
    nextDose: {
      name: "Monoprost",
      minutesUntil: 25,
    },
  });
}

function HomeMasterPreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeHomeScreen />
    </AppShell>
  );
}

function HomeMasterMenuPreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeMenuScreen />
    </AppShell>
  );
}

function HomeMasterHealthPreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeHealthScreen
        checkInPath="/dev/home-master/check-in"
        healthPlanPath="/dev/home-master/health-plan"
        askDrAiPath="/dev/home-master/ask-dr-ai?fresh=1"
        vitalsPath="/dev/home-master/vitals"
        medicinesPath="/dev/home-master/medicines"
        voicePath="/dev/home-master"
        profilePath="/dev/home-master/profile"
        contained
      />
    </AppShell>
  );
}

function HealthHubRoute() {
  return (
    <AppShell>
      <PrototypeHealthScreen
        healthPlanPath="/health/prevention-plan"
        askDrAiPath="/health/symptom-check?fresh=1"
        vitalsPath="/health/vitals"
        medicinesPath="/meds/my-medicines"
        voicePath="/"
        profilePath="/settings/account"
        backPath="/menu"
        contained
      />
    </AppShell>
  );
}

function HomeMasterBrainPreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <MindMemoryScreen />
    </AppShell>
  );
}

function HomeMasterCommunityPreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeCommunityScreen voicePath="/dev/home-master" profilePath="/dev/home-master/profile" />
    </AppShell>
  );
}

function HomeMasterConciergePreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeConciergeScreen voicePath="/dev/home-master" profilePath="/dev/home-master/profile" />
    </AppShell>
  );
}

function HomeMasterReportsPreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeReportsScreen voicePath="/dev/home-master" profilePath="/dev/home-master/profile" />
    </AppShell>
  );
}

function HomeMasterProfilePreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeProfileScreen returnPath="/dev/home-master" />
    </AppShell>
  );
}

function HomeMasterCheckInPreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeCheckInScreen
        returnPath="/dev/home-master/health"
      />
    </AppShell>
  );
}

function HomeMasterSymptomReportPreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <PrototypeSymptomReportPreviewScreen />
    </AppShell>
  );
}

function HomeMasterMovementExercisePreviewRoute() {
  primeHomeMasterPreviewData();

  return (
    <AppShell>
      <MovementExerciseGuideScreen />
    </AppShell>
  );
}

const LONGEVITY_PREVIEW_MOMENTS: LongevityMoment[] = ["morning", "midday", "afternoon", "evening"];

function parseLongevityPreviewMoment(value: string | null): LongevityMoment | undefined {
  return LONGEVITY_PREVIEW_MOMENTS.includes(value as LongevityMoment) ? value as LongevityMoment : undefined;
}

function HomeMasterHealthActionPreviewRoute({ kind }: { kind: "plan" | "vitals" | "medicines" }) {
  primeHomeMasterPreviewData();
  const location = useLocation();

  if (kind === "plan") {
    const params = new URLSearchParams(location.search);
    const requestedTheme = params.get("theme");
    const requestedLanguage = params.get("language") ?? params.get("lang");
    const requestedMoment = parseLongevityPreviewMoment(params.get("moment"));
    return (
      <AppShell>
        <PreventionPlan
          previewPlan={PREVENTION_PLAN_PREVIEW}
          firstNameOverride="Karim"
          backPath="/dev/home-master/health"
          themeOverride={requestedTheme === "light" || requestedTheme === "dark" ? requestedTheme : undefined}
          languageOverride={requestedLanguage ?? undefined}
          momentOverride={requestedMoment}
        />
      </AppShell>
    );
  }

  if (kind === "vitals") {
    const scenario = new URLSearchParams(location.search).get("scenario");
    return (
      <AppShell>
        <VitalsScreen
          previewData={scenario === "contact-doctor" ? VITALS_CONTACT_DOCTOR_PREVIEW_DATA : VITALS_PREVIEW_DATA}
          previewConditions={["hypertension"]}
          backPath="/dev/home-master/health"
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PrototypeHealthActionPreviewScreen kind={kind} />
    </AppShell>
  );
}

function HomeMasterProfileActionPreviewRoute({ kind }: { kind: "account" | "health" | "medicines" | "emergency" | "care-team" | "providers" | "accessibility" }) {
  primeHomeMasterPreviewData();

  if (kind === "account") {
    return (
      <AppShell>
        <AccountSettings />
      </AppShell>
    );
  }

  if (kind === "health") return <ConditionsSection />;
  if (kind === "medicines") return <MedicationsSection />;
  if (kind === "emergency") return <EmergencySection />;
  if (kind === "care-team") return <CareTeamFlow />;
  if (kind === "providers") return <ProvidersSection />;

  return (
    <AppShell>
      <PrototypeProfileActionPreviewScreen kind={kind} />
    </AppShell>
  );
}

function CaregiverRouteGuard() {
  const { user } = useAuth();
  const location = useLocation();

  if (
    isCaregiverRoutingUser(user) &&
    !isCaregiverAccessibleAppPath(location.pathname)
  ) {
    return <Navigate to={CAREGIVER_DASHBOARD_ROUTE} replace />;
  }

  return <Outlet />;
}

function getInteractiveLabel(element: Element): string {
  const explicitLabel =
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.getAttribute("data-testid");

  if (explicitLabel) return explicitLabel;

  return (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function AgentAppContextTracker() {
  const location = useLocation();

  React.useEffect(() => {
    recordAgentPageChange(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const interactiveElement = target?.closest("button,a,[role='button']");
      if (!interactiveElement || interactiveElement.hasAttribute("data-agent-context-ignore")) return;

      const label = getInteractiveLabel(interactiveElement);
      if (!label) return;

      recordAgentButtonClick({
        label,
        path: `${window.location.pathname}${window.location.search}`,
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

function PwaInstallPromptGate() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading || !shouldShowPwaInstallPromptForRoute(location.pathname, Boolean(user))) return null;
  return <PwaInstallPrompt />;
}

const showDevelopmentPreviewRoutes = import.meta.env.DEV || import.meta.env.MODE === "development";

function HomeMasterPreviewLanguageSync() {
  const location = useLocation();
  const { language } = useLanguage();

  React.useEffect(() => {
    if (!location.pathname.startsWith("/dev/home-master")) return;

    const searchParams = new URLSearchParams(location.search);
    const requestedLanguage = searchParams.get("language") ?? searchParams.get("lang");
    if (requestedLanguage && requestedLanguage !== language && ["en", "es", "fr", "de", "it", "pt"].includes(requestedLanguage)) {
      setLanguage(requestedLanguage);
    }

    const requestedTheme = searchParams.get("theme");
    if (requestedTheme === "light" || requestedTheme === "dark") {
      writeHomeMasterTheme(requestedTheme);
    }
  }, [language, location.pathname, location.search]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageControllerProvider>
      <AuthProvider>
        <ProfileProvider>
          <HomeFastHelpSyncBridge />
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={routerFutureFlags}>
              <LanguageFrameBoundary>
                {showDevelopmentPreviewRoutes ? <HomeMasterPreviewLanguageSync /> : null}
                <VyvaVoiceProvider>
                  <VoiceActionProvider>
                    <VoiceCanvasProvider>
                      <AgentAppContextTracker />
                      <Suspense fallback={<RouteLoadingScreen />}>
                      <Routes>
                <Route path="/" element={<RootRoute />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/caregiver/login" element={<LoginPage />} />
                <Route path="/caregiver/register" element={<LoginPage />} />
                <Route path="/invite" element={<InviteLandingPage />} />
                <Route path="/admin/login" element={<LoginPage adminOnly />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/access/:token" element={<AccessLinkPage />} />
                <Route path="/care-team/invite/:token" element={<CareTeamInvitePage />} />
                <Route path="/confirm/:token" element={<ElderConfirmByToken />} />
                <Route path="/shared/check-in/:token" element={<SharedCheckinReport />} />
                <Route path="/vyva-demo" element={<VyvaDemoEntry />} />
                <Route path="/vyva-demo/senior/:seniorKey" element={<VyvaSeniorHome />} />
                <Route path="/vyva-demo/senior/:seniorKey/daily" element={<VyvaSeniorDailyCheckIn />} />
                <Route path="/vyva-demo/senior/:seniorKey/weekly" element={<VyvaSeniorWeeklyCheckIn />} />
                <Route path="/vyva-demo/senior/:seniorKey/my-week" element={<VyvaSeniorMyWeek />} />
                <Route path="/vyva-demo/caregiver/:caregiverKey" element={<VyvaCaregiverDashboard />} />
                <Route path="/vyva-demo/caregiver/:caregiverKey/senior/:seniorId" element={<VyvaCaregiverSeniorDetail />} />
                {showDevelopmentPreviewRoutes ? (
                  <>
                    <Route path="/dev/home-master" element={<HomeMasterPreviewRoute />} />
                    <Route path="/dev/home-master/menu" element={<HomeMasterMenuPreviewRoute />} />
                    <Route path="/dev/home-master/health" element={<HomeMasterHealthPreviewRoute />} />
                    <Route path="/dev/home-master/brain" element={<HomeMasterBrainPreviewRoute />} />
                    <Route path="/dev/brain/remember" element={<AppShell><MemoryGamesPage /></AppShell>} />
                    <Route path="/dev/brain/focus" element={<AppShell><AttentionBoostersPage /></AppShell>} />
                    <Route path="/dev/brain/think" element={<AppShell><ExecutiveFunctionPage /></AppShell>} />
                    <Route path="/dev/brain/calm" element={<AppShell><SensesPage /></AppShell>} />
                    <Route path="/dev/brain/activity/:activityId" element={<BrainCoachActivityRoute />} />
                    <Route path="/dev/brain/memory-games/:gameType" element={<AppShell><MemoryGameRunner /></AppShell>} />
                    <Route path="/dev/brain/attention-boosters/rhythm-tap" element={<AppShell><MemoryGameRunner forcedGameType="sequence_memory" returnPath="/brain-coach/focus" /></AppShell>} />
                    <Route path="/dev/home-master/community" element={<HomeMasterCommunityPreviewRoute />} />
                    <Route path="/dev/home-master/concierge" element={<HomeMasterConciergePreviewRoute />} />
                    <Route path="/dev/home-master/reports" element={<HomeMasterReportsPreviewRoute />} />
                    <Route path="/dev/home-master/profile" element={<HomeMasterProfilePreviewRoute />} />
                    <Route path="/dev/home-master/profile/account" element={<HomeMasterProfileActionPreviewRoute kind="account" />} />
                    <Route path="/dev/home-master/profile/health" element={<HomeMasterProfileActionPreviewRoute kind="health" />} />
                    <Route path="/dev/home-master/profile/medicines" element={<HomeMasterProfileActionPreviewRoute kind="medicines" />} />
                    <Route path="/dev/home-master/profile/emergency" element={<HomeMasterProfileActionPreviewRoute kind="emergency" />} />
                    <Route path="/dev/home-master/profile/care-team" element={<HomeMasterProfileActionPreviewRoute kind="care-team" />} />
                    <Route path="/dev/home-master/profile/providers" element={<HomeMasterProfileActionPreviewRoute kind="providers" />} />
                    <Route path="/dev/home-master/profile/preferences" element={<HomeMasterProfileActionPreviewRoute kind="accessibility" />} />
                    <Route path="/dev/home-master/profile/accessibility" element={<HomeMasterProfileActionPreviewRoute kind="accessibility" />} />
                    <Route path="/dev/home-master/check-in" element={<HomeMasterCheckInPreviewRoute />} />
                    <Route path="/dev/home-master/symptom-report" element={<HomeMasterSymptomReportPreviewRoute />} />
                    <Route path="/dev/home-master/symptom-warning" element={<AppShell><SymptomWarningSignsPreviewScreen /></AppShell>} />
                    <Route path="/dev/home-master/ask-dr-ai" element={<AppShell><SymptomCheckScreen /></AppShell>} />
                    <Route path="/dev/home-master/ask-dr-ai-checking" element={<AppShell><SymptomCheckingPreviewScreen /></AppShell>} />
                    <Route path="/dev/home-master/ask-dr-ai-next" element={<AppShell><SymptomSeverityPreviewScreen /></AppShell>} />
                    <Route path="/dev/home-master/health-plan" element={<HomeMasterHealthActionPreviewRoute kind="plan" />} />
                    <Route path="/dev/home-master/vitals" element={<HomeMasterHealthActionPreviewRoute kind="vitals" />} />
                    <Route path="/dev/home-master/medicines" element={<HomeMasterHealthActionPreviewRoute kind="medicines" />} />
                    <Route path="/dev/social-rooms/morning-movement/exercises/:exerciseId" element={<HomeMasterMovementExercisePreviewRoute />} />
                    <Route path="/dev/screen-contact-sheet" element={<ScreenContactSheet />} />
                    <Route path="/dev/profile-conditions" element={<ConditionsSection />} />
                    <Route path="/dev/remember-later" element={<RememberLaterPreviewRoute />} />
                    <Route path="/dev/connections" element={<MemoryGameRunner forcedGameType="association_memory" returnPath="/dev/home-master/brain" />} />
                    <Route path="/dev/curious-minds" element={<CuriousMindsPreviewRoute />} />
                    <Route path="/dev/scent-memory" element={<ScentMemoryPreviewRoute />} />
                    <Route path="/dev/listen-closely" element={<ListenCloselyPreviewRoute />} />
                    <Route path="/dev/breath-garden" element={<BreathGardenPreviewRoute />} />
                    <Route path="/dev/trusted-help" element={<TrustedHelpSettings />} />
                    <Route path="/dev/trusted-help-partners" element={<TrustedHelpPartnersAdminPage />} />
                    <Route path="/dev/admin-modules" element={<AdminModulesPage />} />
                  </>
                ) : null}
                <Route path="/admin" element={<AdminRoute><AdminModulesPage /></AdminRoute>} />
                <Route path="/admin/proxy-pending" element={<AdminRoute><ProxyPendingPage /></AdminRoute>} />
                <Route path="/admin/lifecycle" element={<AdminRoute><LifecycleAdminPage /></AdminRoute>} />
                <Route path="/admin/activity" element={<AdminRoute><AdminActivityPage /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
                <Route path="/admin/phone-onboarding" element={<AdminRoute><PhoneOnboardingPage /></AdminRoute>} />
                <Route path="/admin/home-cards" element={<AdminRoute><HomeCardsAdminPage /></AdminRoute>} />
                <Route path="/admin/hero-messages" element={<AdminRoute><HeroMessagesAdminPage /></AdminRoute>} />
                <Route path="/admin/marketing" element={<AdminRoute><MarketingAdminPage /></AdminRoute>} />
                <Route path="/admin/marketing/:marketingTab" element={<AdminRoute><MarketingAdminPage /></AdminRoute>} />
                <Route path="/admin/workflows" element={<AdminRoute><WorkflowCoverageAdminPage /></AdminRoute>} />
                <Route path="/admin/voice-readiness" element={<AdminRoute><VoiceReadinessAdminPage /></AdminRoute>} />
                <Route path="/admin/concierge-readiness" element={<AdminRoute><ConciergeReadinessAdminPage /></AdminRoute>} />
                <Route path="/admin/concierge-supplies" element={<AdminRoute><ConciergeSuppliesAdminPage /></AdminRoute>} />
                <Route path="/admin/trusted-help-partners" element={<AdminRoute><TrustedHelpPartnersAdminPage /></AdminRoute>} />
                <Route path="/admin/concierge-queue" element={<AdminRoute><ConciergeQueueAdminPage /></AdminRoute>} />
                <Route path="/admin/concierge-email-replies" element={<AdminRoute><ConciergeInboundRepliesAdminPage /></AdminRoute>} />
                <Route path="/admin/providers" element={<AdminRoute><ProviderDirectoryAdminPage /></AdminRoute>} />
                <Route path="/admin/content-review" element={<AdminRoute><CuriousMindsReviewPage /></AdminRoute>} />
                <Route path="/admin/curious-minds" element={<AdminRoute><CuriousMindsReviewPage /></AdminRoute>} />
                <Route path="/admin/cognitive-assessment" element={<AdminRoute><CognitiveAssessmentAdminPage /></AdminRoute>} />
                <Route path="/admin/learning-library" element={<AdminRoute><LearningLibraryAdminPage /></AdminRoute>} />
                <Route path="/admin/curated-activities" element={<AdminRoute><CuratedActivitiesAdminPage /></AdminRoute>} />
                <Route path="/admin/content-index" element={<AdminRoute><AdminContentIndexPage /></AdminRoute>} />
                <Route path="/admin/room-prompts" element={<AdminRoute><RoomPromptsAdminPage /></AdminRoute>} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<CaregiverRouteGuard />}>
                  <Route path="/profiles/select" element={<ProfileSelectPage />} />
                  <Route element={<OnboardingGuard />}>
                    <Route path="/onboarding" element={<WelcomeScreen />} />
                    <Route path="/onboarding/who-for" element={<WhoForStep />} />
                    <Route path="/onboarding/basics" element={<BasicsStep />} />
                    <Route path="/onboarding/channel" element={<ChannelStep />} />
                    <Route path="/onboarding/proxy-setup" element={<ProxySetupStep />} />
                    <Route path="/onboarding/elder-confirm" element={<ElderConfirmStep />} />
                    <Route path="/onboarding/consent" element={<DataConsentStep />} />
                  </Route>
                  <Route path="/onboarding/activation" element={<ActivationStep />} />
                  <Route path="/onboarding/profile" element={<ProfileOverview />} />
                  <Route path="/onboarding/complete/:section" element={<SectionCompleteScreen />} />
                  <Route path="/onboarding/profile/:id" element={<SectionRouter />} />
                  <Route path="/onboarding/careteam" element={<CareTeamFlow />} />
                  <Route path="/settings/privacy" element={<PrivacySettings />} />
                  <Route path="/settings/subscription" element={<AppShell><SubscriptionSettings /></AppShell>} />
                  <Route path="/settings" element={<AppShell><SettingsHome /></AppShell>} />
                  <Route path="/settings/account" element={<AppShell><AccountSettings /></AppShell>} />
                  <Route path="/settings/health-devices" element={<AppShell><HealthDevicesSettings /></AppShell>} />
                  <Route path="/settings/notifications" element={<AppShell><NotificationsSettings /></AppShell>} />
                  <Route path="/settings/scheduled-support" element={<AppShell><ScheduledSupportSettings /></AppShell>} />
                  <Route path="/settings/trusted-help" element={<AppShell><TrustedHelpSettings /></AppShell>} />
                  <Route path="/chat" element={<AppShell><ServiceGateRoute service="chat"><ChatScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/menu" element={<AppShell><MenuScreen /></AppShell>} />
                  <Route path="/health" element={<HealthHubRoute />} />
                  <Route path="/health/dashboard" element={<AppShell><HealthScreen /></AppShell>} />
                  <Route path="/health/prevention" element={<AppShell><LongevityScreen /></AppShell>} />
                  <Route path="/health/prevention-plan" element={<AppShell><PreventionPlan /></AppShell>} />
                  <Route path="/health/exercises/gentle-walk" element={<Navigate to="/activity?focus=gentle-walk" replace />} />
                  <Route path="/mind" element={<Navigate to="/mind-memory" replace />} />
                  <Route path="/games/breath-garden" element={<Navigate to="/senses/breath-garden" replace />} />
                  <Route path="/health/medications" element={<Navigate to="/meds" replace />} />
                  <Route path="/health/doctor" element={<AppShell><ServiceGateRoute service="doctor"><DoctorChoiceScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/health/check-in" element={<AppShell><PrototypeCheckInScreen /></AppShell>} />
                  <Route path="/health/check-ins" element={<AppShell><CheckinHistoryScreen /></AppShell>} />
                  <Route path="/health/symptom-check" element={<AppShell><ServiceGateRoute service="symptomCheck"><SymptomCheckScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/health/vitals" element={<AppShell><VitalsScreen /></AppShell>} />
                  <Route path="/informes" element={<AppShell><InformesScreen /></AppShell>} />
                  <Route path="/informes/brain-coach" element={<AppShell><BrainCoachReportScreen /></AppShell>} />
                  <Route path="/informes/:id" element={<AppShell><InformesScreen /></AppShell>} />
                  <Route path="/companions" element={<AppShell><CompanionsScreen /></AppShell>} />
                  <Route path="/caregiver" element={<ServiceGateRoute service="caregiverDashboard"><CaregiverDashboardPage /></ServiceGateRoute>} />
                  <Route path="/caregiver-dashboard" element={<ServiceGateRoute service="caregiverDashboard"><CaregiverDashboardPage /></ServiceGateRoute>} />
                  <Route path="/social-rooms" element={<AppShell><SocialHub /></AppShell>} />
                  <Route path="/social-rooms/morning-movement/exercises/:exerciseId" element={<AppShell><MovementExerciseGuideScreen /></AppShell>} />
                  <Route path="/social-rooms/join-in" element={<AppShell><SocialRoomsOnlyScreen /></AppShell>} />
                  <Route path="/social-rooms/participate" element={<Navigate to="/social-rooms/experts" replace />} />
                  <Route path="/social-rooms/experts" element={<AppShell><AdvisorHub /></AppShell>} />
                  <Route path="/social-rooms/experts/:agentSlug" element={<AppShell><AdvisorChat /></AppShell>} />
                  <Route path="/social-rooms/activities" element={<AppShell><CommunityActivitiesScreen /></AppShell>} />
                  <Route path="/social-rooms/share" element={<AppShell><ShareStoriesScreen /></AppShell>} />
                  <Route path="/social-rooms/:slug" element={<AppShell><RoomScreen /></AppShell>} />
                  <Route path="/meds" element={<AppShell><ServiceGateRoute service="medications"><MedsScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/meds/my-medicines" element={<AppShell><ServiceGateRoute service="medications"><MedsScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/meds/interactions" element={<AppShell><ServiceGateRoute service="medications"><MedsScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/meds/refills" element={<AppShell><ServiceGateRoute service="medications"><MedicationRefillsScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/meds/adherence-report" element={<AppShell><ServiceGateRoute service="adherenceReport"><AdherenceReportScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/mind-memory" element={<AppShell><MindMemoryScreen /></AppShell>} />
                  <Route path="/brain-coach/remember" element={<AppShell><MemoryGamesPage /></AppShell>} />
                  <Route path="/brain-coach/focus" element={<AppShell><AttentionBoostersPage /></AppShell>} />
                  <Route path="/brain-coach/think" element={<AppShell><ExecutiveFunctionPage /></AppShell>} />
                  <Route path="/brain-coach/calm" element={<AppShell><SensesPage /></AppShell>} />
                  <Route path="/brain-coach/activity/:activityId" element={<BrainCoachActivityRoute />} />
                  <Route path="/mind-memory/cognitive-assessment" element={<AppShell><CognitiveAssessmentHubPage /></AppShell>} />
                  <Route path="/mind-memory/cognitive-assessment/start" element={<AppShell><CognitiveAssessmentRunnerPage /></AppShell>} />
                  <Route path="/mind-memory/cognitive-assessment/report" element={<AppShell><CognitiveAssessmentReportPage /></AppShell>} />
                  <Route path="/mind-memory/cognitive-assessment/report/:sessionId" element={<AppShell><CognitiveAssessmentReportPage /></AppShell>} />
                  <Route path="/mind-memory/cognitive-assessment/history" element={<AppShell><CognitiveAssessmentReportPage /></AppShell>} />
                  <Route path="/activities" element={<Navigate to="/mind-memory" replace />} />
                  <Route path="/activities/relax-breathe" element={<AppShell><RelaxBreatheScreen /></AppShell>} />
                  <Route path="/learn" element={<AppShell><LearnSomethingNewPage /></AppShell>} />
                  <Route path="/activity" element={<AppShell><ActivityScreen /></AppShell>} />
                  <Route path="/attention-boosters" element={<AppShell><AttentionBoostersPage /></AppShell>} />
                  <Route path="/attention-boosters/rhythm-tap" element={<AppShell><MemoryGameRunner forcedGameType="sequence_memory" returnPath="/brain-coach/focus" /></AppShell>} />
                  <Route path="/senses" element={<AppShell><SensesPage /></AppShell>} />
                  <Route path="/senses/association" element={<Navigate to="/memory-games/association_memory" replace />} />
                  <Route path="/senses/scent-memory" element={<ScentMemoryRoute />} />
                  <Route path="/senses/listen-closely" element={<ListenCloselyRoute />} />
                  <Route path="/senses/breath-garden" element={<BreathGardenRoute />} />
                  <Route path="/executive-function" element={<AppShell><ExecutiveFunctionPage /></AppShell>} />
                  <Route path="/executive-function/category-sort" element={<CategorySortRoute />} />
                  <Route path="/executive-function/number-trails" element={<NumberTrailsRoute />} />
                  <Route path="/language" element={<Navigate to="/learn" replace />} />
                  <Route path="/spatial-navigator" element={<AppShell><SpatialNavigatorRoute /></AppShell>} />
                  <Route path="/face-name-match" element={<AppShell><FaceNameMatchRoute /></AppShell>} />
                  <Route path="/memory-games" element={<AppShell><MemoryGamesPage /></AppShell>} />
                  <Route path="/memory-games/remember-later" element={<AppShell><RememberLaterRoute /></AppShell>} />
                  <Route path="/memory-games/curious-minds" element={<AppShell><CuriousMindsRoute /></AppShell>} />
                  <Route path="/memory-games/:gameType" element={<AppShell><MemoryGameRunner /></AppShell>} />
                  <Route path="/dual-task-walk" element={<DualTaskWalkRoute />} />
                  <Route path="/concierge" element={<AppShell><ServiceGateRoute service="concierge"><ConciergeScreen mode="home" /></ServiceGateRoute></AppShell>} />
                  <Route path="/concierge/tasks" element={<AppShell><ServiceGateRoute service="concierge"><ConciergeTaskInboxPage /></ServiceGateRoute></AppShell>} />
                  <Route path="/concierge/tasks/:taskKey" element={<AppShell><ServiceGateRoute service="concierge"><ConciergeTaskInboxPage /></ServiceGateRoute></AppShell>} />
                  <Route path="/concierge/task/:taskId" element={<AppShell><ServiceGateRoute service="concierge"><ConciergeScreen mode="task" /></ServiceGateRoute></AppShell>} />
                  <Route path="/concierge/shopping" element={<AppShell><ServiceGateRoute service="concierge"><ConciergeShoppingScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/safe-home" element={<AppShell><SafeHomeScreen /></AppShell>} />
                  <Route path="/scam-guard" element={<AppShell><ScamGuardScreen /></AppShell>} />
                  <Route path="/history" element={<AppShell><HistoryScreen /></AppShell>} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
                      </Routes>
                      </Suspense>
                      <PwaInstallPromptGate />
                    </VoiceCanvasProvider>
                  </VoiceActionProvider>
                </VyvaVoiceProvider>
              </LanguageFrameBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </ProfileProvider>
      </AuthProvider>
    </LanguageControllerProvider>
  </QueryClientProvider>
);

export default App;
