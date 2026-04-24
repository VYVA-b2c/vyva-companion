import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = password.length >= 8 && password === confirm && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || "Password reset failed — the link may have expired.");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-between px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mt-6">
        <div
          className="w-16 h-16 rounded-[20px] flex items-center justify-center shadow-lg"
          style={{ background: "#6B21A8" }}
        >
          <Sparkles size={28} className="text-white" />
        </div>
        <h1 className="font-display text-[28px] font-semibold text-vyva-text-1">VYVA</h1>
        <p className="font-body text-[14px] text-vyva-text-2 text-center max-w-[260px]">
          {success ? "Password updated" : "Choose a new password"}
        </p>
      </div>

      {/* Form */}
      <div className="w-full max-w-[380px] flex flex-col gap-4">
        {!token ? (
          <div
            data-testid="text-reset-invalid-token"
            className="rounded-2xl bg-white border border-vyva-border px-5 py-6 text-center flex flex-col gap-2"
          >
            <p className="font-body text-[15px] font-semibold text-vyva-text-1">Link is invalid</p>
            <p className="font-body text-[13px] text-vyva-text-2">
              This reset link is missing a token. Please request a new one from the sign-in page.
            </p>
          </div>
        ) : success ? (
          <div
            data-testid="text-reset-success"
            className="rounded-2xl bg-white border border-vyva-border px-5 py-6 text-center flex flex-col gap-2"
          >
            <p className="font-body text-[15px] font-semibold text-vyva-text-1">All done!</p>
            <p className="font-body text-[13px] text-vyva-text-2">
              Your password has been updated. You can now sign in with your new password.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
                New password <span className="text-vyva-text-3 font-normal">(min 8 characters)</span>
              </label>
              <div className="relative">
                <Input
                  data-testid="input-reset-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
                  placeholder="Create a strong password"
                  className="bg-white pr-11"
                  autoComplete="new-password"
                />
                <button
                  data-testid="button-reset-toggle-password"
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vyva-text-3 hover:text-vyva-text-2"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
                Confirm new password
              </label>
              <Input
                data-testid="input-reset-confirm"
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
                placeholder="Repeat your new password"
                className="bg-white"
                autoComplete="new-password"
              />
              {confirm.length > 0 && password !== confirm && (
                <p data-testid="text-reset-mismatch" className="font-body text-[12px] text-red-500 mt-1">
                  Passwords don't match
                </p>
              )}
            </div>

            {error && (
              <p data-testid="text-reset-error" className="font-body text-[13px] text-red-600 text-center">
                {error}
              </p>
            )}

            <button
              data-testid="button-reset-submit"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
              style={{ background: "#6B21A8" }}
            >
              {loading ? "Updating password…" : "Update password"}
            </button>
          </>
        )}

        <button
          data-testid="link-reset-back-to-login"
          onClick={() => navigate("/login")}
          className="font-body text-[13px] text-vyva-purple underline-offset-2 hover:underline text-center"
        >
          Back to sign in
        </button>
      </div>

      <div />
    </div>
  );
}
