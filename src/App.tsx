import React, { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AccessLinkPage from "@/pages/AccessLinkPage";
import AppShell from "./components/AppShell";
import ServiceGateRoute from "./components/ServiceGateRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import OnboardingGuard from "./components/OnboardingGuard";
import HomeScreen from "./pages/HomeScreen";
import ChatScreen from "./pages/ChatScreen";
import HealthScreen from "./pages/HealthScreen";
import MedsScreen from "./pages/MedsScreen";
import AdherenceReportScreen from "./pages/AdherenceReportScreen";
import ActivitiesScreen from "./pages/ActivitiesScreen";
import ActivityScreen from "./pages/ActivityScreen";
import SpatialNavigator from "./games/SpatialNavigator";
import MemoryGamesPage from "./games/memory/MemoryGamesPage";
import MemoryGameRunner from "./games/memory/MemoryGameRunner";
import ConciergeScreen from "./pages/ConciergeScreen";
import SafeHomeScreen from "./pages/SafeHomeScreen";
import ScamGuardScreen from "./pages/ScamGuardScreen";
import SettingsScreen from "./pages/SettingsScreen";
import NotFound from "./pages/NotFound";

import WelcomeScreen from "./pages/onboarding/WelcomeScreen";
import WhoForStep from "./pages/onboarding/WhoForStep";
import BasicsStep from "./pages/onboarding/BasicsStep";
import ChannelStep from "./pages/onboarding/ChannelStep";
import DataConsentStep from "./pages/onboarding/DataConsentStep";
import ActivationStep from "./pages/onboarding/ActivationStep";
import ProfileOverview from "./pages/onboarding/ProfileOverview";
import SectionCompleteScreen from "./pages/onboarding/SectionCompleteScreen";
import ProxySetupStep from "./pages/onboarding/ProxySetupStep";
import ElderConfirmStep from "./pages/onboarding/ElderConfirmStep";
import ElderConfirmByToken from "./pages/onboarding/ElderConfirmByToken";

import GPSection from "./pages/onboarding/sections/GPSection";
import ProvidersSection from "./pages/onboarding/sections/ProvidersSection";
import AddressSection from "./pages/onboarding/sections/AddressSection";
import AllergiesSection from "./pages/onboarding/sections/AllergiesSection";
import BasicsSection from "./pages/onboarding/sections/BasicsSection";
import CareTeamFlow from "./pages/onboarding/sections/CareTeamFlow";
import CognitiveSection from "./pages/onboarding/sections/CognitiveSection";
import ConditionsSection from "./pages/onboarding/sections/ConditionsSection";
import DevicesSection from "./pages/onboarding/sections/DevicesSection";
import DietSection from "./pages/onboarding/sections/DietSection";
import EmergencySection from "./pages/onboarding/sections/EmergencySection";
import HobbiesSection from "./pages/onboarding/sections/HobbiesSection";
import MedicationsSection from "./pages/onboarding/sections/MedicationsSection";

import PrivacySettings from "./pages/settings/PrivacySettings";
import DoctorChoiceScreen from "./pages/DoctorChoiceScreen";
import SymptomCheckScreen from "./pages/SymptomCheckScreen";
import CheckHowIFeelScreen from "./pages/CheckHowIFeelScreen";
import CheckinHistoryScreen from "./pages/CheckinHistoryScreen";
import SharedCheckinReport from "./pages/SharedCheckinReport";
import SignosScreen from "./pages/SignosScreen";
import InformesScreen from "./pages/InformesScreen";
import CompanionsScreen from "./pages/CompanionsScreen";
import HistoryScreen from "./pages/HistoryScreen";
import SubscriptionSettings from "./pages/settings/SubscriptionSettings";
import SettingsHome from "./pages/settings/SettingsHome";
import AccountSettings from "./pages/settings/AccountSettings";
import NotificationsSettings from "./pages/settings/NotificationsSettings";
import CaregiverDashboardPage from "./pages/CaregiverDashboardPage";
import SocialHub from "./social/SocialHub";
import RoomScreen from "./social/RoomScreen";

const ProxyPendingPage = lazy(() => import("./pages/admin/ProxyPendingPage"));
const LifecycleAdminPage = lazy(() => import("./pages/admin/LifecycleAdminPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const HomeCardsAdminPage = lazy(() => import("./pages/admin/HomeCardsAdminPage"));
const HeroMessagesAdminPage = lazy(() => import("./pages/admin/HeroMessagesAdminPage"));

const SECTION_MAP: Record<string, React.ComponentType> = {
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

function SectionRouter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
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

function SpatialNavigatorRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <SpatialNavigator
      userId={user?.id ?? ""}
      onExit={() => navigate("/activities")}
    />
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="min-h-screen bg-[#f7f2eb]" />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (user.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f2eb] px-6 text-center text-[#2f2135]">
        <section className="max-w-md rounded-3xl border border-[#eadfd5] bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
          <h1 className="mt-2 font-serif text-3xl">Admin access required</h1>
          <p className="mt-2 text-sm text-[#7d6b65]">Your account is signed in, but it does not have the admin role.</p>
        </section>
      </main>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f2eb]" />}>
      {children}
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ProfileProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin/login" element={<LoginPage adminOnly />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/access/:token" element={<AccessLinkPage />} />
                <Route path="/confirm/:token" element={<ElderConfirmByToken />} />
                <Route path="/shared/check-in/:token" element={<SharedCheckinReport />} />
                <Route path="/admin/proxy-pending" element={<AdminRoute><ProxyPendingPage /></AdminRoute>} />
                <Route path="/admin/lifecycle" element={<AdminRoute><LifecycleAdminPage /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
                <Route path="/admin/home-cards" element={<AdminRoute><HomeCardsAdminPage /></AdminRoute>} />
                <Route path="/admin/hero-messages" element={<AdminRoute><HeroMessagesAdminPage /></AdminRoute>} />
                <Route element={<ProtectedRoute />}>
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
                  <Route path="/settings/notifications" element={<AppShell><NotificationsSettings /></AppShell>} />
                  <Route path="/" element={<AppShell><HomeScreen /></AppShell>} />
                  <Route path="/chat" element={<AppShell><ServiceGateRoute service="chat"><ChatScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/health" element={<AppShell><HealthScreen /></AppShell>} />
                  <Route path="/health/doctor" element={<AppShell><ServiceGateRoute service="doctor"><DoctorChoiceScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/health/check-in" element={<AppShell><CheckHowIFeelScreen /></AppShell>} />
                  <Route path="/health/check-ins" element={<AppShell><CheckinHistoryScreen /></AppShell>} />
                  <Route path="/health/symptom-check" element={<AppShell><ServiceGateRoute service="symptomCheck"><SymptomCheckScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/health/vitals" element={<AppShell><SignosScreen /></AppShell>} />
                  <Route path="/informes" element={<AppShell><InformesScreen /></AppShell>} />
                  <Route path="/informes/:id" element={<AppShell><InformesScreen /></AppShell>} />
                  <Route path="/companions" element={<AppShell><CompanionsScreen /></AppShell>} />
                  <Route path="/caregiver" element={<ServiceGateRoute service="caregiverDashboard"><CaregiverDashboardPage /></ServiceGateRoute>} />
                  <Route path="/caregiver-dashboard" element={<ServiceGateRoute service="caregiverDashboard"><CaregiverDashboardPage /></ServiceGateRoute>} />
                  <Route path="/social-rooms" element={<AppShell><SocialHub /></AppShell>} />
                  <Route path="/social-rooms/:slug" element={<AppShell><RoomScreen /></AppShell>} />
                  <Route path="/meds" element={<AppShell><ServiceGateRoute service="medications"><MedsScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/meds/adherence-report" element={<AppShell><ServiceGateRoute service="adherenceReport"><AdherenceReportScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/activities" element={<AppShell><ActivitiesScreen /></AppShell>} />
                  <Route path="/activity" element={<AppShell><ActivityScreen /></AppShell>} />
                  <Route path="/spatial-navigator" element={<AppShell><SpatialNavigatorRoute /></AppShell>} />
                  <Route path="/memory-games" element={<AppShell><MemoryGamesPage /></AppShell>} />
                  <Route path="/memory-games/:gameType" element={<AppShell><MemoryGameRunner /></AppShell>} />
                  <Route path="/concierge" element={<AppShell><ServiceGateRoute service="concierge"><ConciergeScreen /></ServiceGateRoute></AppShell>} />
                  <Route path="/safe-home" element={<AppShell><SafeHomeScreen /></AppShell>} />
                  <Route path="/scam-guard" element={<AppShell><ScamGuardScreen /></AppShell>} />
                  <Route path="/history" element={<AppShell><HistoryScreen /></AppShell>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
      </ProfileProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
