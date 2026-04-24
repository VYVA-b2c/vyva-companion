import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check, Sparkles, CreditCard } from "lucide-react";

const FREE_FEATURES = [
  "Daily companion conversations",
  "Medication reminders",
  "Basic wellbeing check-ins",
  "App access",
];

const PREMIUM_FEATURES = [
  "Everything in Free",
  "Daily phone calls & WhatsApp",
  "Fall detection & safety alerts",
  "Family dashboard access",
  "Brain coach sessions",
  "GP & provider integrations",
  "Priority support",
];

const SubscriptionSettings = () => {
  const navigate = useNavigate();
  const currentPlan = "free";

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-subscription-back"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <h1 className="font-display text-[22px] font-semibold text-vyva-text-1">Your plan</h1>
      </div>

      <div className="flex-1 px-5 space-y-4 pb-8">
        {/* Current plan banner */}
        <div
          className="rounded-[18px] px-4 py-4 bg-vyva-warm2/50 border border-vyva-border flex items-center gap-3"
          data-testid="banner-subscription-current-plan"
        >
          <CreditCard size={20} className="text-vyva-text-2 flex-shrink-0" />
          <div>
            <p
              className="font-body text-[14px] font-medium text-vyva-text-1"
              data-testid="text-subscription-current-plan"
            >
              You're on the <span className="capitalize">{currentPlan}</span> plan
            </p>
            <p className="font-body text-[12px] text-vyva-text-2">
              {currentPlan === "free" ? "Upgrade to unlock all features" : "Thank you for supporting VYVA"}
            </p>
          </div>
        </div>

        {/* Free plan card */}
        <div
          className={`bg-white rounded-[22px] border-2 overflow-hidden ${
            currentPlan === "free" ? "border-vyva-purple" : "border-vyva-border"
          }`}
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
          data-testid="card-plan-free"
        >
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[20px] font-semibold text-vyva-text-1">Free</h2>
              <div className="text-right">
                <span className="font-display text-[28px] font-semibold text-vyva-text-1">€0</span>
                <span className="font-body text-[13px] text-vyva-text-3"> / month</span>
              </div>
            </div>
            {currentPlan === "free" && (
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full bg-vyva-purple-light text-vyva-purple font-body text-[11px] font-medium"
                data-testid="badge-subscription-free-active"
              >
                Current plan
              </span>
            )}
          </div>
          <div className="px-5 pb-5 space-y-2">
            {FREE_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Check size={14} className="text-vyva-green flex-shrink-0" />
                <span className="font-body text-[13px] text-vyva-text-2">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Premium plan card */}
        <div
          className={`rounded-[22px] border-2 overflow-hidden ${
            currentPlan === "premium" ? "border-vyva-purple bg-white" : "border-vyva-gold bg-gradient-to-b from-[#FEF3C7]/60 to-white"
          }`}
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
          data-testid="card-plan-premium"
        >
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-vyva-gold" />
              <span className="font-body text-[12px] font-medium text-vyva-gold uppercase tracking-wider">
                Most popular
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[20px] font-semibold text-vyva-text-1">Premium</h2>
              <div className="text-right">
                <span
                  className="font-display text-[28px] font-semibold text-vyva-text-1"
                  data-testid="text-subscription-premium-price"
                >
                  €29
                </span>
                <span className="font-body text-[13px] text-vyva-text-3"> / month</span>
              </div>
            </div>
            <p className="font-body text-[12px] text-vyva-text-3">or £24.99 / month</p>
          </div>
          <div className="px-5 space-y-2">
            {PREMIUM_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Check size={14} className="text-vyva-green flex-shrink-0" />
                <span className="font-body text-[13px] text-vyva-text-2">{f}</span>
              </div>
            ))}
          </div>
          <div className="px-5 py-5">
            {currentPlan === "premium" ? (
              <div
                data-testid="status-subscription-premium-active"
                className="w-full py-3 rounded-full font-body text-[15px] font-medium text-center text-vyva-purple bg-vyva-purple-light"
              >
                Active plan
              </div>
            ) : (
              <button
                data-testid="button-subscription-upgrade"
                className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white"
                style={{ background: "#6B21A8" }}
                onClick={() => {
                  /* Stripe checkout wiring is a later task */
                  alert("Stripe checkout coming soon!");
                }}
              >
                Upgrade to Premium
              </button>
            )}
          </div>
        </div>

        {/* Legal */}
        <p className="font-body text-[11px] text-vyva-text-3 text-center">
          Cancel anytime · Billed monthly · Secure payment by Stripe
        </p>
      </div>
    </div>
  );
};

export default SubscriptionSettings;
