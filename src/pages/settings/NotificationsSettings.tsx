// src/pages/settings/NotificationsSettings.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, Bot, UserRound, type LucideIcon } from "lucide-react";
import { ContactChannelPicker } from "@/components/ContactChannelPicker";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import { friendlyError } from "@/lib/apiError";
import { normalizeContactChannel, type ContactChannelId } from "@/lib/contactChannels";
import { disablePreventiveWebPush, enablePreventiveWebPush } from "@/lib/preventiveWebPush";
import { disableMedicationRefillPush, enableMedicationRefillPush } from "@/lib/medicationRefillPush";
import { apiFetch, queryClient } from "@/lib/queryClient";

type SupportMode = "ai_powered" | "human_supported";

type ChannelPreferences = {
  preferred_checkin_channel: ContactChannelId;
  preferred_reminder_channel: ContactChannelId;
  support_mode: SupportMode;
  voice_available_from: string;
  voice_available_until: string;
  whatsapp_available_from: string;
  whatsapp_available_until: string;
  max_outbound_calls_per_day: number | null;
  max_whatsapp_messages_per_day: number | null;
  concierge_task_notifications_enabled: boolean;
  medication_refill_push_enabled: boolean;
  preventive_web_push_enabled: boolean;
};

const DEFAULT_PREFERENCES: ChannelPreferences = {
  preferred_checkin_channel: "voice_outbound",
  preferred_reminder_channel: "whatsapp_outbound",
  support_mode: "ai_powered",
  voice_available_from: "08:00",
  voice_available_until: "21:00",
  whatsapp_available_from: "07:00",
  whatsapp_available_until: "22:00",
  max_outbound_calls_per_day: 1,
  max_whatsapp_messages_per_day: 5,
  concierge_task_notifications_enabled: true,
  medication_refill_push_enabled: false,
  preventive_web_push_enabled: false,
};

const SUPPORT_MODE_OPTIONS: Array<{
  id: SupportMode;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  labelKey: string;
  subKey: string;
}> = [
  {
    id: "ai_powered",
    icon: Bot,
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    labelKey: "settings.notifications.supportModeAi",
    subKey: "settings.notifications.supportModeAiSub",
  },
  {
    id: "human_supported",
    icon: UserRound,
    iconBg: "#FFF2E8",
    iconColor: "#C2410C",
    labelKey: "settings.notifications.supportModeHuman",
    subKey: "settings.notifications.supportModeHumanSub",
  },
];

const settingsPanelClassName =
  "rounded-[28px] border border-[#EFE4D5] bg-white p-5 shadow-[0_14px_34px_rgba(53,28,87,0.06)]";

const settingsKickerClassName =
  "font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-purple/70";

function normalizeSupportMode(value: unknown): SupportMode {
  return value === "human_supported" || value === "ai_powered" ? value : DEFAULT_PREFERENCES.support_mode;
}

function normalizePreferences(data?: Partial<ChannelPreferences> | null): ChannelPreferences {
  return {
    preferred_checkin_channel: normalizeContactChannel(
      data?.preferred_checkin_channel,
      DEFAULT_PREFERENCES.preferred_checkin_channel,
    ),
    preferred_reminder_channel: normalizeContactChannel(
      data?.preferred_reminder_channel,
      DEFAULT_PREFERENCES.preferred_reminder_channel,
    ),
    support_mode: normalizeSupportMode(data?.support_mode),
    voice_available_from: data?.voice_available_from || DEFAULT_PREFERENCES.voice_available_from,
    voice_available_until: data?.voice_available_until || DEFAULT_PREFERENCES.voice_available_until,
    whatsapp_available_from: data?.whatsapp_available_from || DEFAULT_PREFERENCES.whatsapp_available_from,
    whatsapp_available_until: data?.whatsapp_available_until || DEFAULT_PREFERENCES.whatsapp_available_until,
    max_outbound_calls_per_day:
      data && "max_outbound_calls_per_day" in data
        ? data.max_outbound_calls_per_day ?? null
        : DEFAULT_PREFERENCES.max_outbound_calls_per_day,
    max_whatsapp_messages_per_day:
      data && "max_whatsapp_messages_per_day" in data
        ? data.max_whatsapp_messages_per_day ?? null
        : DEFAULT_PREFERENCES.max_whatsapp_messages_per_day,
    concierge_task_notifications_enabled:
      data?.concierge_task_notifications_enabled
      ?? DEFAULT_PREFERENCES.concierge_task_notifications_enabled,
    medication_refill_push_enabled:
      data?.medication_refill_push_enabled
      ?? DEFAULT_PREFERENCES.medication_refill_push_enabled,
    preventive_web_push_enabled:
      data?.preventive_web_push_enabled
      ?? DEFAULT_PREFERENCES.preventive_web_push_enabled,
  };
}

function limitToSelect(value: number | null): string {
  return value === null ? "unlimited" : String(value);
}

function selectToLimit(value: string): number | null {
  return value === "unlimited" ? null : Number(value);
}

function SupportModePicker({
  value,
  onChange,
  t,
}: {
  value: SupportMode;
  onChange: (value: SupportMode) => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label={t("settings.notifications.supportMode")}>
      {SUPPORT_MODE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`button-support-mode-${option.id}`}
            onClick={() => onChange(option.id)}
            className={`flex min-h-[104px] w-full items-center gap-4 rounded-[24px] border-2 p-5 text-left transition-colors ${
              active ? "border-vyva-purple bg-[#F5F3FF]" : "border-[#EFE7DB] bg-white hover:border-[#E1D6C8]"
            }`}
          >
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px]"
              style={{ background: option.iconBg }}
            >
              <Icon size={24} style={{ color: option.iconColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[18px] font-black leading-tight text-vyva-text-1">{t(option.labelKey)}</p>
              <p className="sr-only">{t(option.subKey)}</p>
            </div>
            <div
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                active ? "bg-vyva-purple" : "border-2 border-[#E4D4F4] bg-white"
              }`}
              aria-hidden="true"
            >
              {active && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function NotificationsSettings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [draft, setDraft] = useState<ChannelPreferences>(DEFAULT_PREFERENCES);

  const preferencesQuery = useQuery<Partial<ChannelPreferences> | null>({
    queryKey: ["/api/profile/channel-preferences"],
  });

  useEffect(() => {
    if (preferencesQuery.data) {
      setDraft(normalizePreferences(preferencesQuery.data));
    }
  }, [preferencesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ChannelPreferences) => {
      const response = await apiFetch("/api/profile/channel-preferences", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await friendlyError(null, response));
      }

      return normalizePreferences(await response.json());
    },
    onSuccess: (saved) => {
      setDraft(saved);
      queryClient.setQueryData(["/api/profile/channel-preferences"], saved);
      toast({
        title: t("settings.notifications.saved", "Preferences saved"),
        description: t("settings.notifications.savedDesc", "Your notification preferences were updated."),
      });
    },
    onError: (error) => {
      toast({
        title: t("settings.notifications.saveError", "Could not save preferences"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const preventiveWebPushMutation = useMutation({
    mutationFn: async (enabled: boolean) => enabled ? enablePreventiveWebPush() : disablePreventiveWebPush(),
    onSuccess: (status) => {
      setDraft((current) => ({
        ...current,
        preventive_web_push_enabled: status.consentEnabled && status.subscribed,
      }));
      queryClient.setQueryData<Partial<ChannelPreferences> | null>(
        ["/api/profile/channel-preferences"],
        (current) => ({
          ...normalizePreferences(current),
          preventive_web_push_enabled: status.consentEnabled && status.subscribed,
        }),
      );
      toast({
        title: status.consentEnabled
          ? t("settings.notifications.preventiveWebPushEnabled", "Daily check-in push enabled")
          : t("settings.notifications.preventiveWebPushDisabled", "Daily check-in push disabled"),
      });
    },
    onError: (error) => {
      setDraft((current) => ({ ...current, preventive_web_push_enabled: false }));
      toast({
        title: t("settings.notifications.preventiveWebPushError", "Could not update daily check-in push"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const medicationRefillPushMutation = useMutation({
    mutationFn: async (enabled: boolean) => enabled ? enableMedicationRefillPush() : disableMedicationRefillPush(),
    onSuccess: (status) => {
      const enabled = status.consentEnabled && status.subscribed;
      setDraft((current) => ({ ...current, medication_refill_push_enabled: enabled }));
      queryClient.setQueryData<Partial<ChannelPreferences> | null>(
        ["/api/profile/channel-preferences"],
        (current) => ({ ...normalizePreferences(current), medication_refill_push_enabled: enabled }),
      );
      toast({
        title: enabled
          ? t("settings.notifications.medicationRefillPushEnabled", "Medicine refill push enabled")
          : t("settings.notifications.medicationRefillPushDisabled", "Medicine refill push disabled"),
      });
    },
    onError: (error) => {
      setDraft((current) => ({ ...current, medication_refill_push_enabled: false }));
      toast({
        title: t("settings.notifications.medicationRefillPushError", "Could not update refill push"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const setQuietStart = (value: string) => {
    setDraft((current) => ({
      ...current,
      voice_available_until: value,
      whatsapp_available_until: value,
    }));
  };

  const setQuietEnd = (value: string) => {
    setDraft((current) => ({
      ...current,
      voice_available_from: value,
      whatsapp_available_from: value,
    }));
  };

  const isBusy = preferencesQuery.isLoading || saveMutation.isPending || preventiveWebPushMutation.isPending || medicationRefillPushMutation.isPending;

  return (
    <PhoneFrame subtitle={t("settings.notifications.title")} showBack onBack={() => navigate("/settings")}>
      <div className="flex flex-col gap-6 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={BellRing}
          title={t("settings.notifications.title")}
          kicker="Contact preferences"
          description={t("settings.notifications.subtitle")}
          badges={[
            { label: t("settings.notifications.channelCheckins"), color: "purple" },
            { label: t("settings.notifications.channelReminders"), color: "blue" },
            { label: t("settings.notifications.quietHours"), color: "amber" },
          ]}
        />

        {preferencesQuery.isError && (
          <div className="rounded-[22px] border border-[#F5B7B1] bg-[#FFF2F0] p-4 font-body text-[15px] font-bold text-[#B42318]">
            {t("settings.notifications.loadError", "Could not load preferences")}
          </div>
        )}

        <section className={settingsPanelClassName}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className={settingsKickerClassName}>
                {t("settings.notifications.medicationRefillPush", "Medicine refill push")}
              </p>
              <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">
                {t(
                  "settings.notifications.medicationRefillPushHint",
                  "Get one browser reminder per medicine when the estimated supply enters its refill window.",
                )}
              </p>
            </div>
            <Switch
              checked={draft.medication_refill_push_enabled}
              disabled={medicationRefillPushMutation.isPending}
              onCheckedChange={(medication_refill_push_enabled) =>
                medicationRefillPushMutation.mutate(medication_refill_push_enabled)
              }
              aria-label={t("settings.notifications.medicationRefillPush", "Medicine refill push")}
              data-testid="switch-medication-refill-push"
            />
          </div>
        </section>

        <section className={settingsPanelClassName}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className={settingsKickerClassName}>
                {t("settings.notifications.conciergeUpdates", "Concierge task updates")}
              </p>
              <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">
                {t(
                  "settings.notifications.conciergeUpdatesHint",
                  "Show an alert when a provider replies or needs information.",
                )}
              </p>
            </div>
            <Switch
              checked={draft.concierge_task_notifications_enabled}
              disabled={preferencesQuery.isLoading}
              onCheckedChange={(concierge_task_notifications_enabled) =>
                setDraft((current) => ({ ...current, concierge_task_notifications_enabled }))
              }
              aria-label={t("settings.notifications.conciergeUpdates", "Concierge task updates")}
              data-testid="switch-concierge-task-notifications"
            />
          </div>
        </section>

        <section className={settingsPanelClassName}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className={settingsKickerClassName}>
                {t("settings.notifications.preventiveWebPush", "Daily check-in push")}
              </p>
              <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">
                {t(
                  "settings.notifications.preventiveWebPushHint",
                  "Allow VYVA to send a browser notification that opens your daily wellbeing check-in.",
                )}
              </p>
            </div>
            <Switch
              checked={draft.preventive_web_push_enabled}
              disabled={preventiveWebPushMutation.isPending}
              onCheckedChange={(preventive_web_push_enabled) =>
                preventiveWebPushMutation.mutate(preventive_web_push_enabled)
              }
              aria-label={t("settings.notifications.preventiveWebPush", "Daily check-in push")}
              data-testid="switch-preventive-web-push"
            />
          </div>
        </section>

        <section className={settingsPanelClassName}>
          <p className={settingsKickerClassName}>
            {t("settings.notifications.channelCheckins")}
          </p>
          <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">
            {t("settings.notifications.checkinsHint", "Used for daily check-ins and follow-ups.")}
          </p>
          <div className="mt-4">
            <ContactChannelPicker
              ariaLabel={t("settings.notifications.channelCheckins")}
              value={draft.preferred_checkin_channel}
              onChange={(preferred_checkin_channel) =>
                setDraft((current) => ({ ...current, preferred_checkin_channel }))
              }
              t={t}
              testIdPrefix="button-checkin-channel"
            />
          </div>
        </section>

        <section className={settingsPanelClassName}>
          <p className={settingsKickerClassName}>
            {t("settings.notifications.channelReminders")}
          </p>
          <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">
            {t(
              "settings.notifications.remindersHint",
              "Used for reminders about medication, appointments, and tasks.",
            )}
          </p>
          <div className="mt-4">
            <ContactChannelPicker
              ariaLabel={t("settings.notifications.channelReminders")}
              value={draft.preferred_reminder_channel}
              onChange={(preferred_reminder_channel) =>
                setDraft((current) => ({ ...current, preferred_reminder_channel }))
              }
              t={t}
              testIdPrefix="button-reminder-channel"
            />
          </div>
        </section>

        <section className={settingsPanelClassName}>
          <p className={settingsKickerClassName}>
            {t("settings.notifications.supportMode")}
          </p>
          <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">
            {t(
              "settings.notifications.supportModeHint",
              "Choose whether VYVA handles contact automatically or a person should take over.",
            )}
          </p>
          <div className="mt-4">
            <SupportModePicker
              value={draft.support_mode}
              onChange={(support_mode) => setDraft((current) => ({ ...current, support_mode }))}
              t={t}
            />
          </div>
        </section>

        <section className={settingsPanelClassName}>
          <p className={settingsKickerClassName}>
            {t("settings.notifications.quietHours")}
          </p>
          <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">
            {t("settings.notifications.quietHoursHint", "VYVA will avoid outbound contact during this window.")}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">
                {t("settings.notifications.from")}
              </Label>
              <input
                type="time"
                value={draft.voice_available_until}
                onChange={(event) => setQuietStart(event.target.value)}
                className="h-14 w-full rounded-[18px] border border-[#DDC7FF] bg-white px-4 font-body text-[17px] text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] focus:border-vyva-purple focus:outline-none focus:ring-4 focus:ring-vyva-purple/15"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">
                {t("settings.notifications.until")}
              </Label>
              <input
                type="time"
                value={draft.voice_available_from}
                onChange={(event) => setQuietEnd(event.target.value)}
                className="h-14 w-full rounded-[18px] border border-[#DDC7FF] bg-white px-4 font-body text-[17px] text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] focus:border-vyva-purple focus:outline-none focus:ring-4 focus:ring-vyva-purple/15"
              />
            </div>
          </div>
        </section>

        <section className={settingsPanelClassName}>
          <p className={settingsKickerClassName}>
            {t("settings.notifications.frequencyLimits")}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">
                {t("settings.notifications.maxCalls")}
              </Label>
              <Select
                value={limitToSelect(draft.max_outbound_calls_per_day)}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, max_outbound_calls_per_day: selectToLimit(value) }))
                }
              >
                <SelectTrigger className="h-14 rounded-[18px] border-[#DDC7FF] bg-white px-4 text-[17px] shadow-[0_8px_20px_rgba(53,28,87,0.05)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="unlimited">{t("settings.notifications.noLimit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">
                {t("settings.notifications.maxWhatsapp")}
              </Label>
              <Select
                value={limitToSelect(draft.max_whatsapp_messages_per_day)}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, max_whatsapp_messages_per_day: selectToLimit(value) }))
                }
              >
                <SelectTrigger className="h-14 rounded-[18px] border-[#DDC7FF] bg-white px-4 text-[17px] shadow-[0_8px_20px_rgba(53,28,87,0.05)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="unlimited">{t("settings.notifications.noLimit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <Button
          onClick={() => saveMutation.mutate(draft)}
          disabled={isBusy}
          className="h-14 w-full rounded-full bg-vyva-purple font-body text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5B1A8F]"
        >
          {saveMutation.isPending ? t("settings.notifications.saving") : t("settings.notifications.savePreferences")}
        </Button>
      </div>
    </PhoneFrame>
  );
}
