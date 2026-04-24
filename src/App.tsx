import type React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Route, Routes, useParams, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import OnboardingGuard from "./components/OnboardingGuard";
import HomeScreen from "./pages/HomeScreen";
import ChatScreen from "./pages/ChatScreen";
import HealthScreen from "./pages/HealthScreen";
import MedsScreen from "./pages/MedsScreen";
import AdherenceReportScreen from "./pages/AdherenceReportScreen";
import ActivitiesScreen from "./pages/ActivitiesScreen";
import ActivityScreen from "./pages/ActivityScreen";
import ConciergeScreen from "./pages/ConciergeScreen";
import SafeHomeScreen from "./pages/SafeHomeScreen";
import ScamGuardScreen from "./pages/ScamGuardScreen";
import SettingsScreen from "./pages/SettingsScreen";
import NotFound from "./pages/NotFound";

import WelcomeScreen from "./pages/onboarding/WelcomeScreen";
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
import SymptomCheckScreen from "./pages/SymptomCheckScreen";
import SignosScreen from "./pages/SignosScreen";
import InformesScreen from "./pages/InformesScreen";
import CompanionsScreen from "./pages/CompanionsScreen";
import HistoryScreen from "./pages/HistoryScreen";
import SubscriptionSettings from "./pages/settings/SubscriptionSettings";
import SettingsHome from "./pages/settings/SettingsHome";
import AccountSettings from "./pages/settings/AccountSettings";
import NotificationsSettings from "./pages/settings/NotificationsSettings";
import ProxyPendingPage from "./pages/admin/ProxyPendingPage";

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
  const Section = id ? SECTION_MAP[id] : null;

  if (Section) return <Section />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f3f8] gap-4 px-6 text-center">
      <span className="text-5xl">🚧</span>
      <h2 className="text-xl font-bold text-gray-900">Coming soon</h2>
      <p className="text-sm text-gray-500">This section is on its way!</p>
      <button
        onClick={() => navigate("/onboarding/profile")}
        className="mt-2 px-6 py-3 rounded-full bg-[#6b21a8] text-white text-sm font-semibold"
      >
        Back to profile
      </button>
    </div>
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
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/confirm/:token" element={<ElderConfirmByToken />} />
                <Route path="/admin/proxy-pending" element={<ProxyPendingPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<OnboardingGuard />}>
                    <Route path="/onboarding" element={<WelcomeScreen />} />
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
                  <Route path="/settings/subscription" element={<SubscriptionSettings />} />
                  <Route path="/settings" element={<AppShell><SettingsHome /></AppShell>} />
                  <Route path="/settings/account" element={<AppShell><AccountSettings /></AppShell>} />
                  <Route path="/settings/notifications" element={<AppShell><NotificationsSettings /></AppShell>} />
                  <Route path="/" element={<AppShell><HomeScreen /></AppShell>} />
                  <Route path="/chat" element={<AppShell><ChatScreen /></AppShell>} />
                  <Route path="/health" element={<AppShell><HealthScreen /></AppShell>} />
                  <Route path="/health/symptom-check" element={<AppShell><SymptomCheckScreen /></AppShell>} />
                  <Route path="/health/vitals" element={<AppShell><SignosScreen /></AppShell>} />
                  <Route path="/informes" element={<AppShell><InformesScreen /></AppShell>} />
                  <Route path="/informes/:id" element={<AppShell><InformesScreen /></AppShell>} />
                  <Route path="/companions" element={<AppShell><CompanionsScreen /></AppShell>} />
                  <Route path="/meds" element={<AppShell><MedsScreen /></AppShell>} />
                  <Route path="/meds/adherence-report" element={<AppShell><AdherenceReportScreen /></AppShell>} />
                  <Route path="/activities" element={<AppShell><ActivitiesScreen /></AppShell>} />
                  <Route path="/activity" element={<AppShell><ActivityScreen /></AppShell>} />
                  <Route path="/concierge" element={<AppShell><ConciergeScreen /></AppShell>} />
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
