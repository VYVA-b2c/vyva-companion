import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";

type PlanEntitlement = {
  voice_assistant?: boolean;
  medication_tracking?: boolean;
  symptom_check?: boolean;
  concierge?: boolean;
  caregiver_dashboard?: boolean;
};

type SubscriptionPlan = {
  plan_id: string;
  name: string;
  description?: string | null;
  price_eur: number;
  price_gbp: number;
  billing_interval?: string | null;
  trial_days?: number | null;
  features?: string[] | null;
  entitlement?: PlanEntitlement | null;
};

type BillingStatus = {
  status: string;
  tier: string;
  trial_days_remaining: number;
  trial_ends_at?: string | null;
  has_billing_account?: boolean;
  plan?: SubscriptionPlan | null;
};

function formatPrice(plan: SubscriptionPlan, currency: "eur" | "gbp") {
  const amount = currency === "gbp" ? plan.price_gbp : plan.price_eur;
  return new Intl.NumberFormat(currency === "gbp" ? "en-GB" : "es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function entitlementLabels(plan: SubscriptionPlan) {
  const ent = plan.entitlement ?? {};
  return [
    ent.voice_assistant ? "Voice assistant" : null,
    ent.medication_tracking ? "Medication tracking" : null,
    ent.symptom_check ? "Symptom checks" : null,
    ent.concierge ? "Concierge" : null,
    ent.caregiver_dashboard ? "Caregiver dashboard" : null,
  ].filter(Boolean) as string[];
}

const SubscriptionSettings = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [currency, setCurrency] = useState<"eur" | "gbp">("eur");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function loadBilling() {
    const [plansRes, statusRes] = await Promise.all([
      apiFetch("/api/billing/plans"),
      apiFetch("/api/billing/status"),
    ]);
    const plansData = await plansRes.json().catch(() => ({}));
    const statusData = await statusRes.json().catch(() => ({}));
    if (!plansRes.ok) throw new Error(plansData.error ?? "Could not load plans");
    if (!statusRes.ok) throw new Error(statusData.error ?? "Could not load billing status");
    setPlans(plansData.plans ?? []);
    setStatus(statusData);
  }

  useEffect(() => {
    loadBilling()
      .catch((err) => setMessage(err instanceof Error ? err.message : "Could not load subscription"))
      .finally(() => setLoading(false));
  }, []);

  const visiblePlans = useMemo(() => plans, [plans]);
  const currentPlanId = status?.tier ?? "";
  const matchedPlanName = status?.plan?.name ?? visiblePlans.find((plan) => plan.plan_id === currentPlanId)?.name;
  const currentPlanName = matchedPlanName || currentPlanId || "No plan";

  async function choosePlan(plan: SubscriptionPlan) {
    setLoadingPlan(plan.plan_id);
    setMessage("");
    try {
      const response = await apiFetch("/api/billing/create-checkout", {
        method: "POST",
        body: JSON.stringify({ plan_id: plan.plan_id, currency }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not start checkout");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      await loadBilling();
      setMessage("Your free trial is active.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not choose this plan");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-subscription-back"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-semibold text-vyva-text-1">Your plan</h1>
          <p className="font-body text-[12px] text-vyva-text-2">Choose the support level that fits your routine.</p>
        </div>
      </div>

      <div className="flex-1 px-5 space-y-4 pb-8">
        <div
          className="rounded-[18px] px-4 py-4 bg-vyva-warm2/50 border border-vyva-border flex items-start gap-3"
          data-testid="banner-subscription-current-plan"
        >
          <CreditCard size={20} className="text-vyva-text-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-body text-[14px] font-medium text-vyva-text-1" data-testid="text-subscription-current-plan">
              Current plan: <span className="capitalize">{currentPlanName}</span>
            </p>
            <p className="font-body text-[12px] text-vyva-text-2">
              {status?.status === "trial" && status.trial_days_remaining > 0
                ? `${status.trial_days_remaining} trial days remaining`
                : status?.status === "active"
                  ? "Your subscription is active"
                  : "You can start with the free trial or choose a paid plan"}
            </p>
          </div>
        </div>

        <div className="flex w-full rounded-full border border-vyva-border bg-white p-1">
          {(["eur", "gbp"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCurrency(value)}
              className={`flex-1 rounded-full px-4 py-2 font-body text-[13px] font-bold ${currency === value ? "bg-vyva-purple text-white" : "text-vyva-text-2"}`}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>

        {message && (
          <p className="rounded-[18px] bg-white border border-vyva-border px-4 py-3 font-body text-[13px] text-vyva-text-1">
            {message}
          </p>
        )}

        <div className="space-y-4">
          {loading && (
            <p className="rounded-[18px] bg-white border border-vyva-border px-4 py-3 font-body text-[13px] text-vyva-text-2">
              Loading plans...
            </p>
          )}
          {!loading && !visiblePlans.length && (
            <p className="rounded-[18px] bg-white border border-vyva-border px-4 py-3 font-body text-[13px] text-vyva-text-2">
              No public subscription plans are configured yet.
            </p>
          )}
          {visiblePlans.map((plan) => {
            const active = currentPlanId === plan.plan_id;
            const price = formatPrice(plan, currency);
            const features = [...(plan.features ?? []), ...entitlementLabels(plan)];
            const isFree = plan.price_eur === 0 && plan.price_gbp === 0;

            return (
              <article
                key={plan.plan_id}
                className={`rounded-[22px] border-2 overflow-hidden bg-white ${active ? "border-vyva-purple" : "border-vyva-border"}`}
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
                data-testid={`card-plan-${plan.plan_id}`}
              >
                <div className="px-5 pt-5 pb-4">
                  {plan.plan_id === "unlimited" && (
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles size={16} className="text-vyva-gold" />
                      <span className="font-body text-[12px] font-medium text-vyva-gold uppercase tracking-wider">
                        Full support
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-[20px] font-semibold text-vyva-text-1">{plan.name}</h2>
                      {plan.description && <p className="mt-1 font-body text-[12px] leading-relaxed text-vyva-text-2">{plan.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-display text-[28px] font-semibold text-vyva-text-1">{price}</span>
                      {!isFree && <span className="font-body text-[13px] text-vyva-text-3"> / {plan.billing_interval ?? "month"}</span>}
                    </div>
                  </div>
                  {active && (
                    <span className="inline-block mt-3 px-2 py-0.5 rounded-full bg-vyva-purple-light text-vyva-purple font-body text-[11px] font-medium">
                      Current plan
                    </span>
                  )}
                </div>
                <div className="px-5 pb-5 space-y-2">
                  {features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check size={14} className="text-vyva-green flex-shrink-0" />
                      <span className="font-body text-[13px] text-vyva-text-2">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 pb-5">
                  {active ? (
                    <div className="w-full py-3 rounded-full font-body text-[15px] font-medium text-center text-vyva-purple bg-vyva-purple-light">
                      Active plan
                    </div>
                  ) : (
                    <button
                      data-testid={`button-subscription-choose-${plan.plan_id}`}
                      className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white flex items-center justify-center gap-2"
                      style={{ background: "#6B21A8" }}
                      disabled={loadingPlan !== null}
                      onClick={() => choosePlan(plan)}
                    >
                      {loadingPlan === plan.plan_id && <Loader2 size={17} className="animate-spin" />}
                      {isFree ? `Start ${plan.trial_days ?? 14}-day trial` : `Choose ${plan.name}`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className="font-body text-[11px] text-vyva-text-3 text-center">
          Cancel anytime - Secure payment by Stripe - Trial available before paid support
        </p>
      </div>
    </div>
  );
};

export default SubscriptionSettings;
