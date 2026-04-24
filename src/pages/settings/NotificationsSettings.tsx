// src/pages/settings/NotificationsSettings.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Channel = "call" | "whatsapp" | "app";

function ChannelPicker({ label, value, onChange, opts }: {
  label: string;
  value: Channel;
  onChange: (v: Channel) => void;
  opts: { id: Channel; emoji: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-600 mb-2">{label}</p>
      <div className="flex flex-col gap-2">
        {opts.map((opt) => (
          <button key={opt.id} type="button" onClick={() => onChange(opt.id)}
            className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
              value === opt.id ? "border-[#6b21a8] bg-purple-50" : "border-purple-100 bg-white hover:border-purple-200"
            )}>
            <span className="text-base">{opt.emoji}</span>
            <span className="text-sm font-semibold text-gray-900 flex-1">{opt.label}</span>
            <span className={cn("w-3.5 h-3.5 rounded-full border-2 flex-shrink-0",
              value === opt.id ? "border-[#6b21a8] bg-[#6b21a8] shadow-[inset_0_0_0_2px_white]" : "border-purple-200"
            )} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NotificationsSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [checkinChannel, setCheckinChannel] = useState<Channel>("call");
  const [reminderChannel, setReminderChannel] = useState<Channel>("whatsapp");
  const [saving, setSaving] = useState(false);

  const channelOpts: { id: Channel; emoji: string; label: string }[] = [
    { id: "call",     emoji: "📞", label: t("settings.notifications.channelCall") },
    { id: "whatsapp", emoji: "💬", label: t("settings.notifications.channelWhatsapp") },
    { id: "app",      emoji: "💻", label: t("settings.notifications.channelApp") },
  ];

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
  };

  return (
    <PhoneFrame subtitle={t("settings.notifications.title")} showBack onBack={() => navigate("/app/settings")}>
      <div className="flex flex-col gap-5 px-4 py-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">🔔 {t("settings.notifications.title")}</h2>
          <p className="text-xs text-gray-500 mt-1">{t("settings.notifications.subtitle")}</p>
        </div>

        <ChannelPicker
          label={t("settings.notifications.channelCheckins")}
          value={checkinChannel}
          onChange={setCheckinChannel}
          opts={channelOpts}
        />
        <ChannelPicker
          label={t("settings.notifications.channelReminders")}
          value={reminderChannel}
          onChange={setReminderChannel}
          opts={channelOpts}
        />

        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">{t("settings.notifications.quietHours")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600">{t("settings.notifications.from")}</Label>
              <input type="time" defaultValue="22:00" className="w-full h-11 border border-purple-200 rounded-lg px-3 text-sm focus:outline-none focus:border-[#6b21a8]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600">{t("settings.notifications.until")}</Label>
              <input type="time" defaultValue="08:00" className="w-full h-11 border border-purple-200 rounded-lg px-3 text-sm focus:outline-none focus:border-[#6b21a8]" />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">{t("settings.notifications.frequencyLimits")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600">{t("settings.notifications.maxCalls")}</Label>
              <Select defaultValue="1">
                <SelectTrigger className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="unlimited">{t("settings.notifications.noLimit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600">{t("settings.notifications.maxWhatsapp")}</Label>
              <Select defaultValue="5">
                <SelectTrigger className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="unlimited">{t("settings.notifications.noLimit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]">
          {saving ? t("settings.notifications.saving") : t("settings.notifications.savePreferences")}
        </Button>
      </div>
    </PhoneFrame>
  );
}
