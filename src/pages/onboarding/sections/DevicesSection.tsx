// src/pages/onboarding/sections/DevicesSection.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { ProfileVoiceAction } from "@/components/onboarding/ProfileSectionControls";
import { ProfileVoiceDraftReview } from "@/components/onboarding/ProfileVoiceDraftReview";
import { OnboardingCompanionTarget } from "@/components/onboarding/OnboardingCompanionTarget";
import { useOnboardingAgent } from "@/components/onboarding/useOnboardingAgent";
import { useOnboardingElevenLabsSectionRuntime } from "@/components/onboarding/useOnboardingElevenLabsSectionRuntime";
import { createProfileOnboardingAgentSectionConfig } from "@/components/onboarding/profileOnboardingAgentSections";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { Activity, Mic } from "lucide-react";
import {
  applyProfileVoiceCorrection,
  createSimpleChoiceVoiceDraft,
  parseProfileVoiceCommand,
  type ProfileVoiceDraft,
} from "@/lib/profileVoiceCompletion";

const PLATFORMS = [
  { id: "phone_camera", emoji: "", name: "Phone camera (VitalLens)", sub: "Built-in  HR  Breathing rate  HRV", connection: "built_in", alwaysActive: true },
  { id: "apple_health", emoji: "", name: "Apple Health",             sub: "HR  SpO2  Steps  Sleep  ECG  Weight", connection: "apple_health" },
  { id: "google_health",emoji: "", name: "Google Health Connect",    sub: "HR  SpO2  Steps  Sleep  Weight", connection: "google_health_connect" },
  { id: "fitbit",       emoji: "", name: "Fitbit / Garmin / Withings", sub: "Connect via your device app account", connection: "fitbit" },
];

const INDIVIDUAL_DEVICES = [
  { type: "smartwatch",    emoji: "", label: "Smartwatch" },
  { type: "bp_monitor",   emoji: "", label: "BP monitor" },
  { type: "glucometer",   emoji: "", label: "Glucometer" },
  { type: "smart_scales", emoji: "", label: "Scales" },
  { type: "thermometer",  emoji: "", label: "Thermometer" },
  { type: "smart_ring",   emoji: "", label: "Smart ring" },
  { type: "peak_flow_meter", emoji: "", label: "Peak flow" },
  { type: "bed_sensor",   emoji: "", label: "Bed sensor*", comingSoon: true },
];

function buildDevicesPayload(platforms: string[], devices: string[]) {
  return [
    ...platforms.map((id) => {
      const p = PLATFORMS.find((pl) => pl.id === id)!;
      return { type: p.id === "phone_camera" ? "phone_camera" : "smartwatch", connection_method: p.connection, status: "connected", data_metrics: [] };
    }),
    ...devices.map((type) => ({
      type, connection_method: "bluetooth_direct", status: "connected", data_metrics: [],
    })),
  ];
}

export default function DevicesSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>(["phone_camera"]);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<ProfileVoiceDraft | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const {
    mode: companionMode,
    setMode: setCompanionMode,
    setGuidance,
    clearGuidance,
    registerVoiceAction,
  } = useOnboardingAgent();
  const devicesAgentSectionConfig = useMemo(
    () =>
      createProfileOnboardingAgentSectionConfig({
        sectionId: "devices",
        sectionLabel: "Devices & sensors",
        voicePrompt: "Tell VYVA which health devices you use.",
        expectedFields: ["platforms", "devices"],
        targetIds: {
          addByVoice: "devices-add-by-voice",
          draftReview: "devices-voice-draft",
          reviewSave: "devices-review-save",
        },
      }),
    [],
  );
  const savedFading = false;
  const retryCountdown = null;
  const retryNow = () => undefined;
  const cancelAutoSave = () => undefined;

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const { data, isLoading } = useQuery<{ profile: { devices?: { type: string }[] } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const saved = (data?.profile as { devices?: { type: string }[] } | null)?.devices;
    if (saved && saved.length > 0) {
      const platformIds = PLATFORMS.map((p) => p.id);
      const deviceTypes = INDIVIDUAL_DEVICES.map((d) => d.type);
      const platforms = saved.filter((d) => platformIds.includes(d.type)).map((d) => d.type);
      const devices = saved.filter((d) => deviceTypes.includes(d.type)).map((d) => d.type);
      if (platforms.length > 0) setConnectedPlatforms(["phone_camera", ...platforms.filter((p) => p !== "phone_camera")]);
      if (devices.length > 0) setConnectedDevices(devices);
    }
  }, [data]);

  const setVoiceGuidance = useCallback(
    (guidance: Parameters<typeof setGuidance>[0]) => {
      if (companionMode !== "voice") return;
      setGuidance(guidance);
    },
    [companionMode, setGuidance],
  );

  const { startRuntimeCapture } = useOnboardingElevenLabsSectionRuntime({
    sectionConfig: devicesAgentSectionConfig,
    companionMode,
    setCompanionMode,
    setGuidance,
    setVoiceDraft,
    existingProfileSummary: () => [...connectedPlatforms, ...connectedDevices].join(", ") || undefined,
    activeDraftId: () => voiceDraft?.id,
  });

  const startVoiceDevicesCapture = useCallback(() => {
    void startRuntimeCapture({ fallback: () => setSpeakItOpen(true) });
  }, [startRuntimeCapture]);

  useEffect(() => {
    const unregister = registerVoiceAction({
      id: "profile-devices-voice-capture",
      label: "Add by voice",
      description: "Say the health devices you use.",
      sectionConfig: devicesAgentSectionConfig,
      targetId: devicesAgentSectionConfig.targetIds?.addByVoice,
      onStart: startVoiceDevicesCapture,
    });
    return unregister;
  }, [devicesAgentSectionConfig, registerVoiceAction, startVoiceDevicesCapture]);

  useEffect(() => {
    if (companionMode !== "voice") {
      clearGuidance();
      return;
    }

    setGuidance({
      voiceStatus: "idle",
      draftStatus: voiceDraft ? "parsed-draft" : "idle",
      currentSectionId: devicesAgentSectionConfig.sectionId,
      currentSectionLabel: devicesAgentSectionConfig.sectionLabel,
      currentPrompt: voiceDraft ? "Review these devices before adding them." : devicesAgentSectionConfig.voicePrompt,
      activeTargetId: voiceDraft
        ? devicesAgentSectionConfig.targetIds?.draftReview
        : devicesAgentSectionConfig.targetIds?.addByVoice,
    });

    return () => clearGuidance();
  }, [clearGuidance, companionMode, devicesAgentSectionConfig, setGuidance, voiceDraft]);

  const togglePlatform = (id: string, alwaysActive?: boolean) => {
    if (alwaysActive) return;
    setConnectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setAutoSaveStatus("idle");
  };

  const toggleDevice = (type: string) => {
    setConnectedDevices((prev) =>
      prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]
    );
    setAutoSaveStatus("idle");
  };

  const createDevicesDraft = (transcript: string) => {
    const lower = transcript.toLowerCase();
    const matches = [
      ...PLATFORMS.filter((platform) =>
        lower.includes(platform.name.toLowerCase().split(" ")[0]) ||
        lower.includes(platform.id.replace(/_/g, " ")),
      ).map((platform) => platform.name),
      ...INDIVIDUAL_DEVICES.filter((device) =>
        !device.comingSoon &&
        (lower.includes(device.label.toLowerCase()) || lower.includes(device.type.replace(/_/g, " "))),
      ).map((device) => device.label),
    ];
    return createSimpleChoiceVoiceDraft({
      section: "devices",
      kind: "devices",
      title: "Review devices",
      helper: "VYVA found these devices. Add them only if they look right.",
      label: "Device",
      values: matches,
    });
  };

  const handleSpeakItDone = (transcript: string) => {
    setSpeakItOpen(false);
    const command = parseProfileVoiceCommand("devices", transcript);
    if (command?.kind === "try-again") {
      startVoiceDevicesCapture();
      return;
    }
    if (command?.kind === "skip") {
      setVoiceDraft(null);
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: "idle", lastHeardText: transcript });
      return;
    }
    if (command?.kind === "remove" && voiceDraft) {
      const corrected = applyProfileVoiceCorrection(voiceDraft, command);
      setVoiceDraft(corrected);
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: corrected ? "corrected-draft" : "needs-clarification" });
      return;
    }
    const draft = createDevicesDraft(transcript);
    if (!draft) {
      setVoiceGuidance({
        voiceStatus: "error",
        draftStatus: "needs-clarification",
        lastHeardText: transcript,
        error: "VYVA could not find devices in that.",
        activeTargetId: devicesAgentSectionConfig.targetIds?.addByVoice,
      });
      return;
    }
    setVoiceDraft(draft);
    setVoiceGuidance({
      voiceStatus: "idle",
      draftStatus: "parsed-draft",
      lastHeardText: transcript,
      activeTargetId: devicesAgentSectionConfig.targetIds?.draftReview,
    });
  };

  const confirmVoiceDraft = () => {
    if (!voiceDraft) return;
    const platformNames = new Map(PLATFORMS.map((platform) => [platform.name, platform.id]));
    const deviceNames = new Map(INDIVIDUAL_DEVICES.map((device) => [device.label, device.type]));
    setConnectedPlatforms((current) =>
      Array.from(new Set([
        ...current,
        ...voiceDraft.values.map((value) => platformNames.get(value)).filter(Boolean) as string[],
      ])),
    );
    setConnectedDevices((current) =>
      Array.from(new Set([
        ...current,
        ...voiceDraft.values.map((value) => deviceNames.get(value)).filter(Boolean) as string[],
      ])),
    );
    setVoiceDraft(null);
    setAutoSaveStatus("idle");
    setVoiceGuidance({
      voiceStatus: "idle",
      draftStatus: "confirmed-locally",
      activeTargetId: devicesAgentSectionConfig.targetIds?.reviewSave,
    });
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let navigating = false;
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/devices", {
        method: "POST",
        body: JSON.stringify({ devices: buildDevicesPayload(connectedPlatforms, connectedDevices) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      setAutoSaveStatus("saved");
      setVoiceGuidance({ voiceStatus: "idle", draftStatus: "saved" });
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate("/onboarding/complete/devices"), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save devices", description: msg, variant: "destructive" });
    } finally { if (!navigating) setSaving(false); }
  };

  return (
    <PhoneFrame subtitle="Devices & sensors" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={Activity}
          title="Devices & sensors"
          kicker="Health signals"
          description="Connect trusted devices so VYVA can understand heart, sleep, steps, and other signals before health guidance."
          badges={[
            { label: "Built-in camera", color: "green" },
            { label: "Wearables", color: "purple" },
            { label: "Private data", color: "blue" },
          ]}
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-devices-autosave" }}
        />

        {companionMode !== "voice" ? (
          <OnboardingCompanionTarget targetId="devices-add-by-voice">
            <ProfileVoiceAction
              icon={Mic}
              title="Add by voice"
              description="Say which devices you use."
              onClick={startVoiceDevicesCapture}
              testId="button-devices-speak-it"
              disabled={isLoading}
            />
          </OnboardingCompanionTarget>
        ) : null}

        {voiceDraft ? (
          <OnboardingCompanionTarget targetId="devices-voice-draft">
            <ProfileVoiceDraftReview
              draft={voiceDraft}
              confirmLabel="Add devices"
              tryAgainLabel="Try again"
              dismissLabel="Dismiss"
              onConfirm={confirmVoiceDraft}
              onTryAgain={startVoiceDevicesCapture}
              onDismiss={() => setVoiceDraft(null)}
              onRemoveRow={(value) => {
                const command = parseProfileVoiceCommand("devices", `remove ${value}`);
                if (!command) return;
                setVoiceDraft((current) => current ? applyProfileVoiceCorrection(current, command) : current);
                setVoiceGuidance({ voiceStatus: "idle", draftStatus: "corrected-draft" });
              }}
              testId="panel-devices-voice-draft"
            />
          </OnboardingCompanionTarget>
        ) : null}

        {isLoading ? (
          <div className="flex flex-col gap-3" data-testid="skeleton-devices-content">
            <Skeleton className="h-4 w-28 rounded mb-1" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
            <Skeleton className="h-4 w-32 rounded mb-1 mt-2" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-3 text-[15px] font-extrabold text-gray-700">Health platforms</p>
              <div className="flex flex-col gap-3">
                {PLATFORMS.map((p) => {
                  const isConnected = connectedPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`button-platform-${p.id}`}
                      onClick={() => togglePlatform(p.id, p.alwaysActive)}
                      className={cn(
                        "flex min-h-[78px] items-center gap-4 rounded-[22px] border p-4 text-left shadow-[0_10px_22px_rgba(53,28,87,0.05)] transition-all",
                        isConnected ? "border-[#6b21a8] bg-purple-50" : "border-[#E9DDF8] bg-white hover:border-purple-200"
                      )}
                    >
                      <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-[24px]", isConnected ? "bg-purple-100" : "bg-gray-100")}>
                        {p.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[17px] font-black leading-tight text-gray-900">{p.name}</p>
                        <p className="sr-only">{p.sub}</p>
                      </div>
                      <span className={cn("flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-black",
                        isConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      )}>
                        {isConnected ? (p.alwaysActive ? "Active" : "Connected") : "Connect"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-[15px] font-extrabold text-gray-700">Individual devices</p>
              <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-4">
                {INDIVIDUAL_DEVICES.map((d) => {
                  const isConnected = connectedDevices.includes(d.type);
                  return (
                    <button
                      key={d.type}
                      type="button"
                      data-testid={`button-device-${d.type}`}
                      disabled={d.comingSoon}
                      onClick={() => !d.comingSoon && toggleDevice(d.type)}
                      className={cn(
                        "flex min-h-[96px] flex-col items-center justify-center rounded-[20px] border px-2 py-3 text-center shadow-[0_10px_22px_rgba(53,28,87,0.05)] transition-all",
                        d.comingSoon ? "opacity-40 cursor-default border-purple-100 bg-white" :
                        isConnected ? "border-[#6b21a8] bg-purple-50" : "border-purple-100 bg-white hover:border-purple-200"
                      )}
                    >
                      <span className="mb-2 text-[26px]">{d.emoji}</span>
                      <span className="text-[14px] font-black leading-tight text-gray-700">{d.label.replace("*", "")}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[13px] font-semibold text-gray-400">* Coming soon</p>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <OnboardingCompanionTarget targetId="devices-review-save">
          <Button data-testid="button-devices-save" onClick={handleSave} disabled={saving || isLoading} className="h-14 w-full rounded-full bg-[#6b21a8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save devices"}
          </Button>
          </OnboardingCompanionTarget>
          <button data-testid="button-devices-skip" onClick={() => navigate("/onboarding/profile")} className="py-2 text-center text-[15px] font-bold text-gray-500">Skip for now</button>
        </div>
      </div>
      {speakItOpen ? (
        <SpeakItOverlay
          title="Tell VYVA your devices"
          hint='e.g. "I use a Fitbit, smartwatch, and blood pressure monitor"'
          onDone={handleSpeakItDone}
          onCancel={() => setSpeakItOpen(false)}
        />
      ) : null}
    </PhoneFrame>
  );
}
