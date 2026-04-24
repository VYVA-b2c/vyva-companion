// src/pages/onboarding/ElderConfirmStep.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import { CheckCircle2, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ElderConfirmStep() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    profile: {
      proxy_initiator_id?: string | null;
      elder_confirmed_at?: string | null;
    } | null;
  }>({
    queryKey: ["/api/onboarding/state"],
  });

  const profile = data?.profile;
  const proxyName = profile?.proxy_initiator_id ?? null;
  const alreadyConfirmed = !!profile?.elder_confirmed_at || confirmed;

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await apiFetch("/api/onboarding/elder-confirm", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setError(await friendlyError(null, res));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      setConfirmed(true);
    } catch (err) {
      setError(await friendlyError(err));
    } finally {
      setConfirming(false);
    }
  };

  if (alreadyConfirmed) {
    return (
      <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={44} className="text-green-600" />
        </div>
        <div>
          <h1 className="font-display text-[24px] font-semibold text-vyva-text-1 mb-2">
            Account confirmed!
          </h1>
          <p className="font-body text-[15px] text-vyva-text-2">
            VYVA is now set up and ready for you.
          </p>
        </div>
        <button
          data-testid="button-elder-confirm-go-consent"
          onClick={() => navigate("/onboarding/consent")}
          className="w-full max-w-xs py-4 rounded-full font-body text-[17px] font-semibold text-white"
          style={{ background: "#6B21A8" }}
        >
          Continue to set up
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 py-12">
        <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
          <UserCheck size={44} className="text-[#6B21A8]" />
        </div>

        {isLoading ? (
          <div className="space-y-3 w-full max-w-xs">
            <Skeleton className="h-7 w-full rounded" />
            <Skeleton className="h-14 w-full rounded" />
          </div>
        ) : (
          <div className="max-w-xs">
            <h1 className="font-display text-[24px] font-semibold text-vyva-text-1 mb-3">
              Someone set up VYVA for you
            </h1>
            <p className="font-body text-[15px] text-vyva-text-2">
              {proxyName ? (
                <>
                  <strong>{proxyName}</strong> has filled in your health profile and set up your VYVA account.
                </>
              ) : (
                <>Someone close to you has filled in your health profile and set up your VYVA account.</>
              )}
            </p>
            <p className="font-body text-[14px] text-vyva-text-3 mt-3">
              Please confirm this is your account and you're happy for VYVA to use this information.
            </p>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-[14px] px-4 py-3 max-w-xs w-full text-left">
          <p className="font-body text-[13px] text-amber-800">
            You can review and edit everything in your profile at any time. Nothing is shared without your consent.
          </p>
        </div>

        {error && (
          <p data-testid="text-elder-confirm-error" className="font-body text-[13px] text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="px-5 py-6 flex flex-col gap-3">
        <button
          data-testid="button-elder-confirm-yes"
          onClick={handleConfirm}
          disabled={confirming || isLoading}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
          style={{ background: "#6B21A8" }}
        >
          {confirming ? "Confirming…" : "Yes, this is my account"}
        </button>
        <button
          data-testid="button-elder-confirm-dismiss"
          onClick={() => navigate("/onboarding/profile")}
          className="w-full py-3 font-body text-[15px] text-vyva-text-3 text-center"
        >
          Review my profile first
        </button>
      </div>
    </div>
  );
}
