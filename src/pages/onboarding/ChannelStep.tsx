import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, MessageSquare, Globe, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";

const CHANNELS = [
  {
    id: "voice_outbound",
    icon: Phone,
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    label: "Daily phone call",
    sub: "VYVA calls you each morning",
    proxy: false,
  },
  {
    id: "whatsapp_outbound",
    icon: MessageSquare,
    iconBg: "#ECFDF5",
    iconColor: "#0A7C4E",
    label: "WhatsApp",
    sub: "Messages & voice notes on WhatsApp",
    proxy: false,
  },
  {
    id: "voice_app",
    icon: Globe,
    iconBg: "#EDE9FE",
    iconColor: "#6B21A8",
    label: "App only",
    sub: "Use the app whenever you like",
    proxy: false,
  },
  {
    id: "proxy",
    icon: UserRound,
    iconBg: "#FFF7ED",
    iconColor: "#C2410C",
    label: "Setting this up for someone else",
    sub: "A family member or carer is completing this profile",
    proxy: true,
  },
];

const CHANNEL_MAP: Record<string, string> = {
  voice_outbound:     "voice_outbound",
  whatsapp_outbound:  "whatsapp_outbound",
  voice_app:          "voice_app",
};

const ChannelStep = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("voice_app");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProxy = selected === "proxy";
  const needsPhone = !isProxy && (selected === "voice_outbound" || selected === "whatsapp_outbound");
  const canContinue = (!needsPhone || phone.trim().length >= 7) && !saving;

  const handleContinue = async () => {
    if (!canContinue || saving) return;

    if (isProxy) {
      navigate("/onboarding/proxy-setup");
      return;
    }

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
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-channel-back"
          onClick={() => navigate("/onboarding/basics")}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <div>
          <p className="font-body text-[12px] text-vyva-text-3 uppercase tracking-wider">Step 2 of 5</p>
          <h1 className="font-display text-[22px] font-semibold text-vyva-text-1">How VYVA reaches you</h1>
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 mb-6">
        <div className="h-1.5 bg-vyva-warm2 rounded-full overflow-hidden">
          <div className="h-full bg-vyva-purple rounded-full" style={{ width: "40%" }} />
        </div>
      </div>

      <div className="flex-1 px-5 space-y-3">
        <p className="font-body text-[14px] text-vyva-text-2 mb-4">
          Choose how you'd like VYVA to contact you for daily check-ins.
        </p>

        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          const active = selected === ch.id;
          const isProxyOption = ch.proxy;
          return (
            <button
              key={ch.id}
              data-testid={`button-channel-option-${ch.id}`}
              onClick={() => setSelected(ch.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-[18px] border-2 text-left transition-colors ${
                isProxyOption ? "mt-5 border-dashed" : ""
              } ${
                active
                  ? "border-vyva-purple bg-vyva-purple-pale"
                  : "border-vyva-border bg-white"
              }`}
            >
              <div
                className="w-10 h-10 rounded-[13px] flex items-center justify-center flex-shrink-0"
                style={{ background: ch.iconBg }}
              >
                <Icon size={20} style={{ color: ch.iconColor }} />
              </div>
              <div>
                <p className="font-body text-[15px] font-medium text-vyva-text-1">{ch.label}</p>
                <p className="font-body text-[12px] text-vyva-text-2">{ch.sub}</p>
              </div>
              {active && (
                <div className="ml-auto w-5 h-5 rounded-full bg-vyva-purple flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          );
        })}

        {needsPhone && (
          <div className="mt-4">
            <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
              Phone number <span className="text-vyva-red">*</span>
            </label>
            <Input
              data-testid="input-channel-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
              className="bg-white"
            />
          </div>
        )}
      </div>

      {error && (
        <p data-testid="text-channel-error" className="px-5 pb-2 font-body text-[13px] text-red-600">
          {error}
        </p>
      )}

      <div className="px-5 py-6">
        <button
          data-testid="button-channel-continue"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
          style={{ background: "#6B21A8" }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
};

export default ChannelStep;
