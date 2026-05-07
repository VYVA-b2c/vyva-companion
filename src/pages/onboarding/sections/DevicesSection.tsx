// src/pages/onboarding/sections/DevicesSection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";

const PLATFORMS = [
  { id: "phone_camera", emoji: "📷", name: "Phone camera (VitalLens)", sub: "Built-in · HR · Breathing rate · HRV", connection: "built_in", alwaysActive: true },
  { id: "apple_health", emoji: "🍎", name: "Apple Health",             sub: "HR · SpO2 · Steps · Sleep · ECG · Weight", connection: "apple_health" },
  { id: "google_health",emoji: "🤖", name: "Google Health Connect",    sub: "HR · SpO2 · Steps · Sleep · Weight", connection: "google_health_connect" },
  { id: "fitbit",       emoji: "🟣", name: "Fitbit / Garmin / Withings", sub: "Connect via your device app account", connection: "fitbit" },
];

const INDIVIDUAL_DEVICES = [
  { type: "smartwatch",    emoji: "⌚", label: "Smartwatch" },
  { type: "bp_monitor",   emoji: "🩺", label: "BP monitor" },
  { type: "glucometer",   emoji: "💉", label: "Glucometer" },
  { type: "smart_scales", emoji: "⚖️", label: "Scales" },
  { type: "thermometer",  emoji: "🌡️", label: "Thermometer" },
  { type: "smart_ring",   emoji: "💍", label: "Smart ring" },
  { type: "peak_flow_meter", emoji: "🫁", label: "Peak flow" },
  { type: "bed_sensor",   emoji: "🛏️", label: "Bed sensor*", comingSoon: true },
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

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave, setAutoSaveStatus } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/devices", {
        method: "POST",
        body: JSON.stringify({ devices: buildDevicesPayload(connectedPlatforms, connectedDevices) }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
    },
    2000,
  );

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

  const togglePlatform = (id: string, alwaysActive?: boolean) => {
    if (alwaysActive) return;
    setConnectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    scheduleAutoSave();
  };

  const toggleDevice = (type: string) => {
    setConnectedDevices((prev) =>
      prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]
    );
    scheduleAutoSave();
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
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate("/onboarding/complete/devices"), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save devices", description: msg, variant: "destructive" });
    } finally { if (!navigating) setSaving(false); }
  };

  return (
    <PhoneFrame subtitle="📡 Devices & sensors" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-5 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 leading-relaxed">Connect devices so VYVA reads real health data before triage or symptom reports.</p>
          </div>
          <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-devices-autosave" />
        </div>

        <div className="bg-purple-50 border-l-2 border-[#6b21a8] rounded-lg px-3 py-2 text-xs text-purple-700">
          Data from your devices is used only for VYVA to give you better guidance. It is never sold or shared without your consent.
        </div>

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
              <p className="text-xs font-bold text-gray-600 mb-2">Health platforms</p>
              <div className="flex flex-col gap-2">
                {PLATFORMS.map((p) => {
                  const isConnected = connectedPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`button-platform-${p.id}`}
                      onClick={() => togglePlatform(p.id, p.alwaysActive)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                        isConnected ? "border-[#6b21a8] bg-purple-50" : "border-purple-100 bg-white hover:border-purple-200"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0", isConnected ? "bg-purple-100" : "bg-gray-100")}>
                        {p.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{p.name}</p>
                        <p className="text-[10px] text-gray-500">{p.sub}</p>
                      </div>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0",
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
              <p className="text-xs font-bold text-gray-600 mb-2">Individual devices</p>
              <div className="grid grid-cols-4 gap-2">
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
                        "flex flex-col items-center py-3 px-1 rounded-lg border text-center transition-all",
                        d.comingSoon ? "opacity-40 cursor-default border-purple-100 bg-white" :
                        isConnected ? "border-[#6b21a8] bg-purple-50" : "border-purple-100 bg-white hover:border-purple-200"
                      )}
                    >
                      <span className="text-xl mb-1">{d.emoji}</span>
                      <span className="text-[9px] text-gray-500 leading-tight">{d.label.replace("*", "")}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-1">* Coming soon</p>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-devices-save" onClick={handleSave} disabled={saving || isLoading} className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save devices"}
          </Button>
          <button data-testid="button-devices-skip" onClick={() => navigate("/onboarding/profile")} className="text-xs text-gray-400 py-2 text-center">Skip for now</button>
        </div>
      </div>
    </PhoneFrame>
  );
}
