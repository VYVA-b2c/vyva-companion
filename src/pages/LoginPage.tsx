import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { stageToRoute } from "@/lib/onboardingRoute";
import { hasSupabaseAuthConfig, sendSupabasePasswordReset } from "@/lib/supabaseAuth";

type View = "login" | "register" | "forgot";

export default function LoginPage({ adminOnly = false }: { adminOnly?: boolean }) {
  const { login, register, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as { from?: string })?.from;
  const from = rawFrom && rawFrom !== "/onboarding" ? rawFrom : adminOnly ? "/admin/lifecycle" : null;

  const [mode, setMode] = useState<"login" | "register">(adminOnly ? "login" : "register");
  const [view, setView] = useState<View>(adminOnly ? "login" : "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot-password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const switchTab = (tab: "login" | "register") => {
    if (adminOnly && tab === "register") return;
    setMode(tab);
    setView(tab);
    setError(null);
  };

  const showForgot = () => {
    setForgotEmail(email);
    setForgotSent(false);
    setForgotError(null);
    setView("forgot");
  };

  useEffect(() => {
    if (!adminOnly) return;
    setMode("login");
    setView("login");
  }, [adminOnly]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    queryClient
      .fetchQuery({ queryKey: ["/api/onboarding/state"] })
      .then((data: { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } }) => {
        const stage = data?.onboardingState?.current_stage ?? data?.profile?.current_stage;
        navigate(stageToRoute(stage), { replace: true });
      })
      .catch(() => navigate("/onboarding/basics", { replace: true }));
  }, [isLoading, user, navigate]);

  if (isLoading || user) return null;

  const handleSubmit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        if (adminOnly) throw new Error("Admin accounts can only be created by the super admin after sign in.");
        await register(email.trim(), password);
        navigate("/onboarding/basics", { replace: true });
      } else {
        await login(email.trim(), password);
        if (from) {
          navigate(from, { replace: true });
        } else {
          const data = await queryClient
            .fetchQuery({ queryKey: ["/api/onboarding/state"] })
            .catch(() => null);
          const stage =
            (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
              ?.onboardingState?.current_stage ??
            (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
              ?.profile?.current_stage;
          navigate(stageToRoute(stage), { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (forgotLoading) return;
    setForgotError(null);
    setForgotLoading(true);
    try {
      if (hasSupabaseAuthConfig()) {
        await sendSupabasePasswordReset(forgotEmail.trim());
        setForgotSent(true);
        return;
      }

      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Request failed — please try again.");
      }
      setForgotSent(true);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const canSubmit = email.trim().length > 3 && password.length >= (mode === "register" ? 8 : 1) && !loading;
  const canSendReset = forgotEmail.trim().length > 3 && !forgotLoading;

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-between px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4 mt-6">
        <img
          src="/assets/vyva/vyva-logo-english-slogan.png"
          alt="VYVA"
          className="h-auto w-[300px] max-w-[82vw]"
        />
        <p className="font-body text-[14px] text-vyva-text-2 text-center max-w-[260px]">
          {view === "forgot"
            ? "Enter your email to receive a reset link"
            : adminOnly
            ? "Sign in with your admin account"
            : mode === "register"
            ? "Create your account to get started"
            : "Welcome back"}
        </p>
      </div>

      {/* Form */}
      <div className="w-full max-w-[380px] flex flex-col gap-4">
        {view === "forgot" ? (
          /* ── Forgot password view ── */
          <>
            {forgotSent ? (
              <div
                data-testid="text-forgot-success"
                className="rounded-2xl bg-white border border-vyva-border px-5 py-6 text-center flex flex-col gap-2"
              >
                <p className="font-body text-[15px] font-semibold text-vyva-text-1">Check your inbox</p>
                <p className="font-body text-[13px] text-vyva-text-2">
                  If that email address has an account, we've sent a password reset link. It expires in one hour.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
                    Email address
                  </label>
                  <Input
                    data-testid="input-forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canSendReset && handleForgot()}
                    placeholder="you@example.com"
                    className="bg-white"
                    autoComplete="email"
                  />
                </div>

                {forgotError && (
                  <p data-testid="text-forgot-error" className="font-body text-[13px] text-red-600 text-center">
                    {forgotError}
                  </p>
                )}

                <button
                  data-testid="button-forgot-submit"
                  onClick={handleForgot}
                  disabled={!canSendReset}
                  className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
                  style={{ background: "#6B21A8" }}
                >
                  {forgotLoading ? "Sending…" : "Send reset link"}
                </button>
              </>
            )}

            <button
              data-testid="link-forgot-back"
              onClick={() => { setView("login"); setMode("login"); }}
              className="font-body text-[13px] text-vyva-purple underline-offset-2 hover:underline text-center"
            >
              Back to sign in
            </button>
          </>
        ) : (
          /* ── Login / Register view ── */
          <>
            {/* Tab switcher */}
            <div className="flex rounded-full bg-white border border-vyva-border p-1 gap-1">
              {!adminOnly && (
                <button
                  data-testid="button-auth-tab-register"
                  onClick={() => switchTab("register")}
                  className={`flex-1 py-2 rounded-full font-body text-[14px] font-medium transition-colors ${
                    mode === "register" ? "bg-vyva-purple text-white" : "text-vyva-text-2"
                  }`}
                >
                  Create account
                </button>
              )}
              <button
                data-testid="button-auth-tab-login"
                onClick={() => switchTab("login")}
                className={`flex-1 py-2 rounded-full font-body text-[14px] font-medium transition-colors ${
                  mode === "login" ? "bg-vyva-purple text-white" : "text-vyva-text-2"
                }`}
              >
                Sign in
              </button>
            </div>

            <div>
              <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
                Email address
              </label>
              <Input
                data-testid="input-auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
                placeholder="you@example.com"
                className="bg-white"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-body text-[13px] font-medium text-vyva-text-2">
                  Password {mode === "register" && <span className="text-vyva-text-3 font-normal">(min 8 characters)</span>}
                </label>
                {mode === "login" && (
                  <button
                    data-testid="link-forgot-password"
                    type="button"
                    onClick={showForgot}
                    className="font-body text-[12px] text-vyva-purple underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  data-testid="input-auth-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
                  placeholder={mode === "register" ? "Create a strong password" : "Your password"}
                  className="bg-white pr-11"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
                <button
                  data-testid="button-auth-toggle-password"
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vyva-text-3 hover:text-vyva-text-2"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p data-testid="text-auth-error" className="font-body text-[13px] text-red-600 text-center">
                {error}
              </p>
            )}

            <button
              data-testid="button-auth-submit"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
              style={{ background: "#6B21A8" }}
            >
              {loading ? (mode === "register" ? "Creating account…" : "Signing in…")
                       : (mode === "register" ? "Create account" : "Sign in")}
            </button>

            <p className="font-body text-[12px] text-vyva-text-3 text-center">
              Your data is always under your control · Encrypted & secure
            </p>
          </>
        )}
      </div>

      <div />
    </div>
  );
}
