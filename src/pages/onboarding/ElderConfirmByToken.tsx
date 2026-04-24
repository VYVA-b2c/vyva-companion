// src/pages/onboarding/ElderConfirmByToken.tsx
// Tokenized elder confirmation — no login required.
// Reached by tapping the link in the proxy-setup SMS:
//   https://<domain>/confirm/<token>
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { CheckCircle2, UserCheck, AlertTriangle } from "lucide-react";

interface ConfirmInfo {
  alreadyConfirmed: boolean;
  elderName: string | null;
  proxyName: string | null;
}

export default function ElderConfirmByToken() {
  const { token } = useParams<{ token: string }>();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<ConfirmInfo>({
    queryKey: ["/api/onboarding/confirm", token],
    queryFn: async () => {
      const res = await apiFetch(`/api/onboarding/confirm/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "This link is invalid or has already been used.");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const handleConfirm = async () => {
    if (confirming || !token) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/onboarding/confirm/${token}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setConfirmed(true);
    } catch {
      setError("Couldn't connect. Please check your internet and try again.");
    } finally {
      setConfirming(false);
    }
  };

  const isAlreadyConfirmed = confirmed || data?.alreadyConfirmed;

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-purple-200 border-t-[#6B21A8] animate-spin" />
        <p className="font-body text-[15px] text-vyva-text-2">Loading…</p>
      </div>
    );
  }

  /* ── Invalid token ── */
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle size={40} className="text-red-500" />
        </div>
        <div>
          <h1 className="font-display text-[24px] font-semibold text-vyva-text-1 mb-2">
            This link isn't valid
          </h1>
          <p className="font-body text-[15px] text-vyva-text-2 max-w-xs">
            The confirmation link may have already been used or expired.
            If you need a new link, please ask the person who set up your account to send another invitation.
          </p>
        </div>
      </div>
    );
  }

  /* ── Already confirmed ── */
  if (isAlreadyConfirmed) {
    return (
      <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={44} className="text-green-600" />
        </div>
        <div>
          <h1 className="font-display text-[24px] font-semibold text-vyva-text-1 mb-2">
            {confirmed ? "Account confirmed!" : "Already confirmed"}
          </h1>
          <p className="font-body text-[15px] text-vyva-text-2">
            {confirmed
              ? "You're all set. VYVA is ready for you."
              : "Your account has already been confirmed. You're all set."}
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-[14px] px-4 py-3 max-w-xs w-full text-left">
          <p className="font-body text-[13px] text-purple-700">
            You can review and update your profile any time in the VYVA app.
          </p>
        </div>
      </div>
    );
  }

  /* ── Confirm screen ── */
  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 py-12">
        <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
          <UserCheck size={44} className="text-[#6B21A8]" />
        </div>

        <div className="max-w-xs">
          <h1 className="font-display text-[24px] font-semibold text-vyva-text-1 mb-3">
            {data.elderName ? `Hi ${data.elderName}!` : "Someone set up VYVA for you"}
          </h1>
          <p className="font-body text-[15px] text-vyva-text-2">
            {data.proxyName ? (
              <>
                <strong>{data.proxyName}</strong> has filled in your health profile and set up your VYVA account.
              </>
            ) : (
              <>Someone close to you has filled in your health profile and set up your VYVA account.</>
            )}
          </p>
          <p className="font-body text-[14px] text-vyva-text-3 mt-3">
            Please confirm this is your account and you're happy for VYVA to use this information.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-[14px] px-4 py-3 max-w-xs w-full text-left">
          <p className="font-body text-[13px] text-amber-800">
            You can review and edit everything in your profile at any time. Nothing is shared without your consent.
          </p>
        </div>

        {error && (
          <p data-testid="text-token-confirm-error" className="font-body text-[13px] text-red-600 max-w-xs">
            {error}
          </p>
        )}
      </div>

      <div className="px-5 py-6 flex flex-col gap-3">
        <button
          data-testid="button-token-confirm-yes"
          onClick={handleConfirm}
          disabled={confirming}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
          style={{ background: "#6B21A8" }}
        >
          {confirming ? "Confirming…" : "Yes, this is my account"}
        </button>
      </div>
    </div>
  );
}
