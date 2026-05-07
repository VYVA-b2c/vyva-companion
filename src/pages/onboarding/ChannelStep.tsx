import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BellRing, CalendarClock, ChevronLeft, Globe, MessageSquare, Moon, Phone } from "lucide-react";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { Input } from "@/components/ui/input";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";

const CHANNELS = [
  {
    id: "voice_outbound",
    icon: Phone,
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    label: "Phone call",
    sub: "Best for daily check-ins",
  },
  {
    id: "whatsapp_outbound",
    icon: MessageSquare,
    iconBg: "#ECFDF5",
    iconColor: "#0A7C4E",
    label: "WhatsApp",
    sub: "Best for reminders and voice notes",
  },
  {
    id: "voice_app",
    icon: Globe,
    iconBg: "#EDE9FE",
    iconColor: "#6B21A8",
    label: "App only",
    sub: "No calls or messages by default",
  },
];

const PREFERENCE_PREVIEW = [
  {
    icon: CalendarClock,
    title: "Reminder rules later",
    text: "Medication, appointments and check-ins can each use different channels.",
  },
  {
    icon: Moon,
    title: "Quiet hours",
    text: "We can avoid non-urgent contact at night or during rest times.",
  },
  {
    icon: BellRing,
    title: "Fallbacks for safety",
    text: "Urgent alerts can try call first, then WhatsApp, then a caregiver.",
  },
];

const CHANNEL_MAP: Record<string, string> = {
  voice_outbound: "voice_outbound",
  whatsapp_outbound: "whatsapp_outbound",
  voice_app: "voice_app",
};

const ChannelStep = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("voice_app");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboardingQuery = useQuery<{ account?: { role?: string | null } } | null>({
    queryKey: ["/api/onboarding/state"],
  });
  const isCaregiverSetup = onboardingQuery.data?.account?.role === "caregiver";

  const needsPhone = selected === "voice_outbound" || selected === "whatsapp_outbound";
  const canContinue = (!needsPhone || phone.trim().length >= 7) && !saving;

  const handleContinue = async () => {
    if (!canContinue || saving) return;

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        preferred_checkin_channel: CHANNEL_MAP[selected] ?? selected,
      };
      if (needsPhone && phone.trim()) {
        body.contact_phone = phone.trim();
      }
      const res = await apiFetch("/api/onboarding/channel", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await friendlyError(null, res));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/consent");
    } catch (err) {
      setError(await friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingChrome mainClassName="flex min-h-[calc(100vh-92px)] max-w-[560px] flex-col justify-center">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          data-testid="button-channel-back"
          onClick={() => navigate("/onboarding/basics")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EFE7DB] bg-white shadow-[0_12px_30px_rgba(72,44,18,0.08)]"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <span className="rounded-full bg-white/80 px-4 py-2 font-body text-[12px] font-extrabold uppercase tracking-[0.18em] text-vyva-purple/75 shadow-[0_12px_30px_rgba(72,44,18,0.08)]">
          Step 2 of 5
        </span>
      </div>

      <section className="rounded-[34px] border border-[#EFE7DB] bg-white/95 p-5 shadow-[0_24px_70px_rgba(72,44,18,0.12)] backdrop-blur sm:p-7">
        <div className="mb-5">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.24em] text-vyva-purple/70">
            Daily support
          </p>
          <h1 className="mt-2 font-display text-[42px] leading-[0.98] text-[#2E1642]">
            {isCaregiverSetup ? "Choose their default contact" : "Choose your default contact"}
          </h1>
          <p className="mt-3 font-body text-[14px] leading-[1.55] text-vyva-text-2">
            {isCaregiverSetup
              ? "Pick the everyday channel for the person receiving support. Reminders, alerts and quiet hours can be customised later."
              : "Pick the everyday channel for VYVA. Reminders, alerts and quiet hours can be customised later."}
          </p>
        </div>

        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#F1E9DD]">
          <div className="h-full rounded-full bg-vyva-purple" style={{ width: "40%" }} />
        </div>

        <div className="space-y-3">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const active = selected === ch.id;
            return (
              <button
                key={ch.id}
                data-testid={`button-channel-option-${ch.id}`}
                onClick={() => setSelected(ch.id)}
                className={`flex w-full items-center gap-3 rounded-[22px] border-2 p-4 text-left transition-colors ${
                  active
                    ? "border-vyva-purple bg-[#F5F3FF]"
                    : "border-[#EFE7DB] bg-white hover:border-[#E1D6C8]"
                }`}
              >
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px]"
                  style={{ background: ch.iconBg }}
                >
                  <Icon size={20} style={{ color: ch.iconColor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[15px] font-extrabold text-vyva-text-1">{ch.label}</p>
                  <p className="font-body text-[12px] leading-[1.4] text-vyva-text-2">{ch.sub}</p>
                </div>
                {active && (
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-[24px] border border-[#EFE7DB] bg-[#FFFCF7] p-4">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/70">
            Smart defaults
          </p>
          <div className="mt-3 space-y-3">
            {PREFERENCE_PREVIEW.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-vyva-purple shadow-[0_8px_20px_rgba(72,44,18,0.06)]">
                    <Icon size={17} />
                  </span>
                  <span>
                    <span className="block font-body text-[13px] font-extrabold text-vyva-text-1">{item.title}</span>
                    <span className="block font-body text-[12px] leading-[1.45] text-vyva-text-2">{item.text}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {needsPhone && (
          <div className="mt-5">
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              Best contact number <span className="text-vyva-red">*</span>
            </label>
            <Input
              data-testid="input-channel-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
              className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input"
            />
            <p className="mt-2 font-body text-[12px] leading-[1.45] text-vyva-text-2">
              We’ll use this for the default channel now. More detailed notification preferences live in Settings.
            </p>
          </div>
        )}

        {error && (
          <p data-testid="text-channel-error" className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
            {error}
          </p>
        )}

        <button
          data-testid="button-channel-continue"
          onClick={handleContinue}
          disabled={!canContinue}
          className="vyva-primary-action mt-6 w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab disabled:opacity-40"
        >
          {saving ? "Saving..." : "Continue"}
          {!saving && <ArrowRight size={17} />}
        </button>
      </section>
    </OnboardingChrome>
  );
};

export default ChannelStep;
