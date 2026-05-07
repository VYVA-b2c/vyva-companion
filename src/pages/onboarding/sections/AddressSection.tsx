// src/pages/onboarding/sections/AddressSection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { MapPin, Mic, Loader2, CheckCircle2 } from "lucide-react";

type AddressForm = {
  address_line_1: string;
  address_line_2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
};

const EMPTY_FORM: AddressForm = {
  address_line_1: "", address_line_2: "", city: "",
  region: "", postcode: "", country: "Spain",
};

const COUNTRIES = [
  "Spain", "United Kingdom", "France", "Germany", "Italy",
  "Portugal", "Netherlands", "Belgium", "Switzerland", "Austria",
  "Ireland", "United States", "Canada", "Australia", "Other",
];

// Nominatim country → our list
function normaliseCountry(raw: string): string {
  const map: Record<string, string> = {
    "españa": "Spain", "spain": "Spain",
    "united kingdom": "United Kingdom", "uk": "United Kingdom", "great britain": "United Kingdom",
    "france": "France",
    "germany": "Germany", "deutschland": "Germany",
    "italy": "Italy", "italia": "Italy",
    "portugal": "Portugal",
    "netherlands": "Netherlands", "holland": "Netherlands",
    "belgium": "Belgium", "belgique": "Belgium",
    "switzerland": "Switzerland", "schweiz": "Switzerland",
    "austria": "Austria", "österreich": "Austria",
    "ireland": "Ireland", "éire": "Ireland",
    "united states": "United States", "usa": "United States", "us": "United States",
    "canada": "Canada",
    "australia": "Australia",
  };
  const key = raw.toLowerCase().trim();
  return map[key] ?? (COUNTRIES.includes(raw) ? raw : "Other");
}

export default function AddressSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [parsing, setParsing] = useState(false);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const { data, isLoading } = useQuery<{ profile: AddressForm | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      setForm((prev) => ({
        address_line_1: p.address_line_1 ?? prev.address_line_1,
        address_line_2: p.address_line_2 ?? prev.address_line_2,
        city:           p.city           ?? prev.city,
        region:         p.region         ?? prev.region,
        postcode:       p.postcode       ?? prev.postcode,
        country:        (p as AddressForm & { country?: string }).country ?? prev.country,
      }));
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/address", {
        method: "POST",
        body: JSON.stringify(formRef.current),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
    },
    2000,
  );

  const set = (field: keyof AddressForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    scheduleAutoSave();
  };

  const applyAddress = (patch: Partial<AddressForm>) => {
    setForm((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(patch) as (keyof AddressForm)[]) {
        const v = patch[k];
        if (v && v.trim()) next[k] = v.trim();
      }
      return next;
    });
    scheduleAutoSave();
  };

  // ── Detect my location ──────────────────────────────────────────────────────
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location not supported", description: "Your browser doesn't support location detection.", variant: "destructive" });
      return;
    }
    setDetecting(true);
    setDetected(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
          const res = await fetch(url, { headers: { "User-Agent": "VYVA-App/1.0" } });
          if (!res.ok) throw new Error("Geocoding failed");
          const json = await res.json() as { address: Record<string, string> };
          const a = json.address ?? {};
          const houseNo   = a.house_number ?? "";
          const road      = a.road ?? a.street ?? a.pedestrian ?? "";
          const line1     = houseNo ? `${houseNo} ${road}` : road;
          const line2     = a.suburb ?? a.neighbourhood ?? a.quarter ?? "";
          const city      = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
          const postcode  = a.postcode ?? "";
          const region    = a.state ?? a.county ?? "";
          const country   = normaliseCountry(a.country ?? "");
          applyAddress({ address_line_1: line1, address_line_2: line2, city, postcode, region, country });
          setDetected(true);
          toast({ title: "📍 Location detected!", description: "We've filled in your address — please check and adjust if needed." });
        } catch {
          toast({ title: "Could not get address", description: "Location was found but we couldn't look up the address. Please fill in manually.", variant: "destructive" });
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        const msg = err.code === 1
          ? "Location permission was denied. Please allow location access and try again."
          : "Could not detect your location. Please fill in the address manually.";
        toast({ title: "Location unavailable", description: msg, variant: "destructive" });
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  // ── Speak your address ──────────────────────────────────────────────────────
  const handleSpeakItDone = async (transcript: string) => {
    setSpeakItOpen(false);
    if (!transcript.trim()) return;
    setParsing(true);
    try {
      const res = await apiFetch("/api/address-voice-parse", {
        method: "POST",
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error("parse failed");
      const data = (await res.json()) as { address: Partial<AddressForm> };
      const addr = data.address ?? {};
      const hasAny = Object.values(addr).some((v) => v && v.trim());
      if (!hasAny) {
        toast({ title: "Couldn't read the address", description: 'Try speaking more clearly, e.g. "42 Calle Mayor, Zamora, Spain"' });
        return;
      }
      if (addr.country) addr.country = normaliseCountry(addr.country);
      applyAddress(addr);
      toast({ title: "✅ Address filled in!", description: "Please double-check the fields and adjust if needed." });
    } catch {
      toast({ title: "Couldn't process your address", description: "Please fill in the fields manually.", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/address", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/complete/address");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save home address", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const FieldSkeleton = () => <Skeleton className="h-11 w-full rounded-lg" />;

  return (
    <PhoneFrame subtitle="🏠 Home address" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-4 px-4 py-4">

        {/* Guidance */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 leading-relaxed">
              This helps VYVA with safety features and local services. It's only shared with emergency services if you need urgent help.
            </p>
          </div>
          <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-address-autosave" />
        </div>

        {/* ── Quick-fill row ───────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {/* Detect my location */}
          <button
            type="button"
            data-testid="button-address-detect-location"
            onClick={handleDetectLocation}
            disabled={detecting || isLoading}
            className="flex-1 flex items-center gap-2 rounded-[14px] px-3 py-3 text-left transition-all disabled:opacity-60"
            style={{
              background: detected ? "#ECFDF5" : "#F0FDF4",
              border: detected ? "1px solid #A7F3D0" : "1px solid #BBF7D0",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: detected ? "#10B981" : "#22C55E" }}
            >
              {detecting
                ? <Loader2 size={14} className="text-white animate-spin" />
                : detected
                  ? <CheckCircle2 size={14} className="text-white" />
                  : <MapPin size={14} className="text-white" />
              }
            </div>
            <div className="min-w-0">
              <p className="font-body text-[13px] font-semibold" style={{ color: "#15803D" }}>
                {detecting ? "Detecting…" : detected ? "Location used!" : "Detect my location"}
              </p>
              <p className="font-body text-[11px]" style={{ color: "#16A34A" }}>
                {detecting ? "Getting your address" : "Auto-fill from GPS"}
              </p>
            </div>
          </button>

          {/* Speak it */}
          <button
            type="button"
            data-testid="button-address-speak-it"
            onClick={() => setSpeakItOpen(true)}
            disabled={parsing || isLoading}
            className="flex-1 flex items-center gap-2 rounded-[14px] px-3 py-3 text-left transition-all disabled:opacity-60"
            style={{ background: "#F5F3FF", border: "1px solid #EDE9FE" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse-ring"
              style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
            >
              {parsing
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <Mic size={14} className="text-white" />
              }
            </div>
            <div className="min-w-0">
              <p className="font-body text-[13px] font-semibold" style={{ color: "#6B21A8" }}>
                {parsing ? "Reading…" : "Speak it"}
              </p>
              <p className="font-body text-[11px]" style={{ color: "#7C3AED" }}>
                Say your address
              </p>
            </div>
          </button>
        </div>

        {/* Divider with label */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[11px] text-gray-400 font-medium">or fill in below</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* ── Address fields ───────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">🏡 Street address</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input
              data-testid="input-address-line1"
              placeholder="House number & street name"
              value={form.address_line_1}
              onChange={(e) => set("address_line_1", e.target.value)}
              className="h-11 border-purple-200 text-[15px]"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">Floor / apartment <span className="font-normal text-gray-400">(optional)</span></Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input
              data-testid="input-address-line2"
              placeholder="Floor, flat number, building name"
              value={form.address_line_2}
              onChange={(e) => set("address_line_2", e.target.value)}
              className="h-11 border-purple-200 text-[15px]"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">🏙️ City / Town</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input
                data-testid="input-address-city"
                placeholder="e.g. Zamora"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className="h-11 border-purple-200 text-[15px]"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">📮 Postcode</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input
                data-testid="input-address-postcode"
                placeholder="e.g. 49001"
                value={form.postcode}
                onChange={(e) => set("postcode", e.target.value)}
                className="h-11 border-purple-200 text-[15px]"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Region / Province</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input
                data-testid="input-address-region"
                placeholder="e.g. Castilla y León"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                className="h-11 border-purple-200 text-[15px]"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">🌍 Country</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Select value={form.country} onValueChange={(v) => set("country", v)}>
                <SelectTrigger data-testid="select-address-country" className="h-11 border-purple-200 text-[15px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Save / Skip */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            data-testid="button-address-save"
            onClick={handleSave}
            disabled={saving || isLoading}
            className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]"
          >
            {saving ? "Saving…" : "Save home address"}
          </Button>
          <button
            data-testid="button-address-skip"
            onClick={() => navigate("/onboarding/profile")}
            className="text-xs text-gray-400 py-2 text-center"
          >
            Skip for now
          </button>
        </div>
      </div>

      {/* SpeakIt overlay */}
      {speakItOpen && (
        <SpeakItOverlay
          title="Say your home address"
          hint='e.g. "42 Calle Mayor, Zamora, 49001, Spain"'
          onDone={handleSpeakItDone}
          onCancel={() => setSpeakItOpen(false)}
        />
      )}
    </PhoneFrame>
  );
}
