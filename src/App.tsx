import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ConversationProvider } from "@elevenlabs/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "./components/AppShell";
import HomeScreen from "./pages/HomeScreen";
import ChatScreen from "./pages/ChatScreen";
import HealthScreen from "./pages/HealthScreen";
import MedsScreen from "./pages/MedsScreen";
import ActivitiesScreen from "./pages/ActivitiesScreen";
import ConciergeScreen from "./pages/ConciergeScreen";
import SettingsScreen from "./pages/SettingsScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ConversationProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/chat" element={<ChatScreen />} />
              <Route path="/health" element={<HealthScreen />} />
              <Route path="/meds" element={<MedsScreen />} />
              <Route path="/brain-coach" element={<ActivitiesScreen />} />
              <Route path="/concierge" element={<ConciergeScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </TooltipProvider>
    </ConversationProvider>
  </QueryClientProvider>
);

export default App;
