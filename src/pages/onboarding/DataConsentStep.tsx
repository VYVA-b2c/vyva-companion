import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Shield, Lock, Eye } from "lucide-react";
import { apiFetch, queryClient } from "@/lib/queryClient";

const CONSENTS = [
  {
    id: "conversation_summary",
    icon: Eye,
    iconBg: "#EDE9FE",
    iconColor: "#6B21A8",
    label: "Conversation summaries",
    sub: "VYVA learns from your chats to personalise care",
    required: true,
  },
  {
    id: "health_conditions",
    icon: Shield,
    iconBg: "#ECFDF5",
    iconColor: "#0A7C4E",
    label: "Health information",
    sub: "Conditions, medications, and wellbeing data",
    required: false,
  },
  {
    id: "caregiver_health_alerts",
    icon: Lock,
    iconBg: "#FEF2F2",
    iconColor: "#B91C1C",
    label: "Share alerts with carer",
    sub: "Health or safety alerts sent to your caregiver",
    required: false,
  },
];

const DataConsentStep = () => {
  const navigate = useNavigate();
  const [consents, setConsents] = useState<Record<string, boolean>>({
    conversation_summary: true,
    health_conditions: false,
    caregiver_health_alerts: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string, required: boolean) => {
    if (required) return;
    setConsents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAgree = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const entries = CONSENTS.filter((c) => consents[c.id]).map((c) => ({
      scope:   c.id,
      action:  "granted",
      channel: "web_form",
    }));

    try {
      const res = await apiFetch("/api/onboarding/consent", {
        method: "POST",
        body: JSON.stringify({ entries }),
      });

      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.code === "ELDER_CONFIRMATION_REQUIRED") {
          navigate("/onboarding/elder-confirm");
          return;
        }
        throw new Error("Not authorised");
      }

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/activation");
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-consent-back"
          onClick={() => navigate("/onboarding/channel")}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <div>
          <p className="font-body text-[12px] text-vyva-text-3 uppercase tracking-wider">Step 3 of 5</p>
          <h1 className="font-display text-[22px] font-semibold text-vyva-text-1">Your data, your choice</h1>
        </div>
      </div>

      <div className="px-5 mb-6">
        <div className="h-1.5 bg-vyva-warm2 rounded-full overflow-hidden">
          <div className="h-full bg-vyva-purple rounded-full" style={{ width: "60%" }} />
        </div>
      </div>

      <div className="flex-1 px-5">
        <p className="font-body text-[14px] text-vyva-text-2 mb-5 leading-relaxed">
          VYVA only uses your data to provide care. You can change these choices at any time in Settings.
        </p>

        <div className="bg-white rounded-[18px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          {CONSENTS.map((c) => {
            const Icon = c.icon;
            const on = consents[c.id];
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-[14px] border-b border-vyva-border last:border-b-0"
              >
                <div
                  className="w-10 h-10 rounded-[13px] flex items-center justify-center flex-shrink-0"
                  style={{ background: c.iconBg }}
                >
                  <Icon size={20} style={{ color: c.iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-medium text-vyva-text-1">{c.label}</p>
                  <p className="font-body text-[12px] text-vyva-text-2">{c.sub}</p>
                  {c.required && (
                    <span
                      className="font-body text-[11px] text-vyva-gold"
                      data-testid={`text-consent-required-${c.id}`}
                    >
                      Required for VYVA to work
                    </span>
                  )}
                </div>
                <button
                  data-testid={`toggle-consent-${c.id}`}
                  onClick={() => toggle(c.id, c.required)}
                  disabled={c.required}
                  aria-pressed={on}
                  className={`w-12 h-7 rounded-full relative transition-colors flex-shrink-0 ${on ? "bg-vyva-purple" : ""}`}
                  style={!on ? { background: "#DDD5C8" } : {}}
                >
                  <div
                    className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? "left-[22px]" : "left-0.5"}`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <p className="font-body text-[11px] text-vyva-text-3 mt-4 text-center">
          Protected under GDPR. We never sell your data.
        </p>

        {error && (
          <p data-testid="text-consent-error" className="font-body text-[13px] text-red-600 mt-3 text-center">
            {error}
          </p>
        )}
      </div>

      <div className="px-5 py-6">
        <button
          data-testid="button-consent-agree"
          onClick={handleAgree}
          disabled={submitting}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
          style={{ background: "#6B21A8" }}
        >
          {submitting ? "Saving…" : "Agree & continue"}
        </button>
      </div>
    </div>
  );
};

export default DataConsentStep;
