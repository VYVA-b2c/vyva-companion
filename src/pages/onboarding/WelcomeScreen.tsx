import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { stageToRoute } from "@/lib/onboardingRoute";

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading: stateLoading } = useQuery({
    queryKey: ["/api/onboarding/state"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  useEffect(() => {
    if (authLoading || stateLoading) return;
    if (!user) return;

    const stage =
      (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | undefined)
        ?.onboardingState?.current_stage ??
      (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | undefined)
        ?.profile?.current_stage;

    navigate(stageToRoute(stage), { replace: true });
  }, [user, authLoading, stateLoading, data, navigate]);

  if (authLoading || (user && stateLoading)) {
    return (
      <div className="min-h-screen bg-vyva-cream flex items-center justify-center">
        <div
          data-testid="spinner-welcome-checking"
          className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-[#6B21A8] animate-spin"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-between px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mt-8">
        <div
          className="w-20 h-20 rounded-[24px] flex items-center justify-center shadow-lg"
          style={{ background: "#6B21A8" }}
          data-testid="icon-welcome-logo"
        >
          <Sparkles size={36} className="text-white" />
        </div>
        <h1 className="font-display text-[32px] font-semibold text-vyva-text-1 mt-2">
          VYVA
        </h1>
        <p className="font-body text-[15px] text-vyva-text-2 text-center max-w-[260px] leading-relaxed">
          Your personal AI companion — always here to listen, support, and care.
        </p>
      </div>

      {/* Illustration placeholder */}
      <div
        className="w-full max-w-[320px] rounded-[28px] bg-vyva-warm2/40 flex items-center justify-center"
        style={{ height: 240 }}
        data-testid="img-welcome-illustration"
      >
        <div className="text-center">
          <div className="text-[64px]">👵</div>
          <p className="font-body text-[13px] text-vyva-text-3 mt-2">Your companion awaits</p>
        </div>
      </div>

      {/* CTA */}
      <div className="w-full max-w-[380px] flex flex-col gap-3">
        <p className="font-body text-[12px] text-vyva-text-3 text-center">
          Takes about 5 minutes · Your data is always under your control
        </p>
        <button
          data-testid="button-welcome-get-started"
          onClick={() => navigate("/login")}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white"
          style={{ background: "#6B21A8" }}
        >
          Get started
        </button>
        <button
          data-testid="button-welcome-sign-in"
          onClick={() => navigate("/login")}
          className="w-full py-3 rounded-full font-body text-[15px] font-medium text-vyva-text-2 bg-transparent"
        >
          I already have an account
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
