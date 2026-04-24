import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { PlacesSearch, PlaceResult } from "@/components/onboarding/PlacesSearch";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";

type GpProfile = {
  gp_name?: string;
  gp_phone?: string;
  gp_address?: string;
  gp_maps_url?: string;
  gp_place_id?: string;
};

const GPSection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [initialGp, setInitialGp] = useState<PlaceResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [isChangingGP, setIsChangingGP] = useState(false);

  const gpDataRef = useRef({ manualName, manualAddress, manualPhone, place });
  useEffect(() => {
    gpDataRef.current = { manualName, manualAddress, manualPhone, place };
  }, [manualName, manualAddress, manualPhone, place]);

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const { data, isLoading } = useQuery<{ profile: GpProfile | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (data?.profile?.gp_name) {
      const p = data.profile;
      const saved: PlaceResult = {
        name: p.gp_name!,
        full_address: p.gp_address ?? "",
        phone: p.gp_phone ?? "",
        google_place_id: p.gp_place_id ?? "",
        google_maps_url: p.gp_maps_url ?? "",
      };
      setInitialGp(saved);
      setPlace(saved);
      setManualName(p.gp_name!);
      setManualAddress(p.gp_address ?? "");
      setManualPhone(p.gp_phone ?? "");
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave, setAutoSaveStatus } = useAutoSave(
    async () => {
      const { manualName, manualAddress, manualPhone, place } = gpDataRef.current;
      if (!manualName.trim()) return;
      const res = await apiFetch("/api/onboarding/section/gp", {
        method: "POST",
        body: JSON.stringify({
          gp_name:     manualName,
          gp_phone:    manualPhone,
          gp_address:  manualAddress,
          gp_maps_url: place?.google_maps_url ?? "",
          gp_place_id: place?.google_place_id ?? "",
        }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
    },
    2000,
  );

  const usingSearch = !!place;

  const handleSelect = (p: PlaceResult | null) => {
    if (!p) {
      clearLocalPlace();
      return;
    }
    setPlace(p);
    setManualName(p.name);
    setManualAddress(p.full_address);
    setManualPhone(p.phone);
    scheduleAutoSave();
  };

  const clearLocalPlace = () => {
    cancelAutoSave();
    setPlace(null);
    setManualName("");
    setManualAddress("");
    setManualPhone("");
  };

  const handleChangeGP = () => {
    clearLocalPlace();
    setIsChangingGP(true);
  };

  const handleCancelChange = () => {
    if (initialGp) {
      setPlace(initialGp);
      setManualName(initialGp.name);
      setManualAddress(initialGp.full_address);
      setManualPhone(initialGp.phone);
    }
    setIsChangingGP(false);
  };

  const removeGP = async () => {
    if (removing) return;
    cancelAutoSave();
    setRemoving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/gp", {
        method: "POST",
        body: JSON.stringify({ gp_name: "", gp_phone: "", gp_address: "", gp_maps_url: "", gp_place_id: "" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPlace(null);
      setInitialGp(null);
      setManualName("");
      setManualAddress("");
      setManualPhone("");
      setIsChangingGP(false);
      setAutoSaveStatus("saved");
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not remove GP details", description: msg, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const canSave = usingSearch || manualName.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    cancelAutoSave();
    setSaving(true);
    let navigating = false;
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/gp", {
        method: "POST",
        body: JSON.stringify({
          gp_name:     manualName,
          gp_phone:    manualPhone,
          gp_address:  manualAddress,
          gp_maps_url: place?.google_maps_url ?? "",
          gp_place_id: place?.google_place_id ?? "",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      setAutoSaveStatus("saved");
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate("/onboarding/complete/gp"), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save GP details", description: msg, variant: "destructive" });
    } finally {
      if (!navigating) setSaving(false);
    }
  };

  const showSavedCard = !!initialGp && !isChangingGP;

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button
            data-testid="button-gp-back"
            onClick={() => navigate("/onboarding/profile")}
            className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
          >
            <ChevronLeft size={20} className="text-vyva-text-1" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#EFF6FF" }}
            >
              <Stethoscope size={18} style={{ color: "#1D4ED8" }} />
            </div>
            <h1 className="font-display text-[20px] font-semibold text-vyva-text-1">GP details</h1>
          </div>
        </div>
        <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-gp-autosave" />
      </div>

      <div className="flex-1 px-5 space-y-5">
        <p className="font-body text-[14px] text-vyva-text-2 leading-relaxed">
          Search for your GP surgery or enter the details manually.
        </p>

        {showSavedCard ? (
          /* Saved GP summary card — server is not touched when navigating away */
          <div
            className="bg-white rounded-[18px] border border-vyva-border p-4 space-y-3"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            data-testid="card-gp-saved"
          >
            <div>
              <p className="font-body text-[13px] font-medium text-vyva-text-2">Practice / Surgery name</p>
              <p data-testid="text-gp-name" className="font-body text-[15px] text-vyva-text-1 mt-0.5">{initialGp.name}</p>
            </div>
            {initialGp.full_address && (
              <div>
                <p className="font-body text-[13px] font-medium text-vyva-text-2">Address</p>
                <p data-testid="text-gp-address" className="font-body text-[15px] text-vyva-text-1 mt-0.5">{initialGp.full_address}</p>
              </div>
            )}
            {initialGp.phone && (
              <div>
                <p className="font-body text-[13px] font-medium text-vyva-text-2">Phone number</p>
                <p data-testid="text-gp-phone" className="font-body text-[15px] text-vyva-text-1 mt-0.5">{initialGp.phone}</p>
              </div>
            )}
            {initialGp.google_maps_url && (
              <a
                data-testid="link-gp-maps"
                href={initialGp.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-body text-[13px] text-vyva-purple underline"
              >
                View on Google Maps →
              </a>
            )}
            <div className="flex items-center gap-4 pt-1">
              <button
                data-testid="button-gp-change"
                onClick={handleChangeGP}
                className="font-body text-[13px] font-medium text-vyva-purple underline"
              >
                Change GP
              </button>
              <button
                data-testid="button-gp-remove"
                onClick={removeGP}
                disabled={removing}
                className="font-body text-[13px] text-red-500 underline disabled:opacity-40"
              >
                {removing ? "Removing…" : "Remove GP"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Search — wrapped for testid targeting */}
            <div>
              <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
                Search for your GP
              </label>
              <div data-testid="search-gp-places">
                <PlacesSearch
                  category="doctor"
                  onSelect={handleSelect}
                  placeholder="Search GP surgery or practice…"
                  initialValue={isChangingGP ? null : initialGp}
                />
              </div>
            </div>

            {/* Filled or manual details */}
            <div
              className="bg-white rounded-[18px] border border-vyva-border p-4 space-y-4"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              data-testid="form-gp-details"
            >
              <div>
                <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
                  Practice / Surgery name
                </label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" data-testid="skeleton-gp-name" />
                ) : (
                  <Input
                    data-testid="input-gp-name"
                    value={manualName}
                    onChange={(e) => { setManualName(e.target.value); setPlace(null); scheduleAutoSave(); }}
                    placeholder="e.g. Riverside Medical Centre"
                    className="bg-white"
                  />
                )}
              </div>
              <div>
                <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
                  Address
                </label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" data-testid="skeleton-gp-address" />
                ) : (
                  <Input
                    data-testid="input-gp-address"
                    value={manualAddress}
                    onChange={(e) => { setManualAddress(e.target.value); if (place) setPlace(null); scheduleAutoSave(); }}
                    placeholder="Full address"
                    className="bg-white"
                  />
                )}
              </div>
              <div>
                <label className="font-body text-[13px] font-medium text-vyva-text-2 mb-1.5 block">
                  Phone number
                </label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" data-testid="skeleton-gp-phone" />
                ) : (
                  <Input
                    data-testid="input-gp-phone"
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => { setManualPhone(e.target.value); if (place) setPlace(null); scheduleAutoSave(); }}
                    placeholder="+44 1234 567890"
                    className="bg-white"
                  />
                )}
              </div>

              {usingSearch && place?.google_maps_url && (
                <a
                  data-testid="link-gp-maps"
                  href={place.google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-body text-[13px] text-vyva-purple underline"
                >
                  View on Google Maps →
                </a>
              )}
              {usingSearch && (
                <button
                  data-testid="button-gp-clear-place"
                  onClick={clearLocalPlace}
                  className="font-body text-[12px] text-vyva-text-3 underline"
                >
                  Clear and enter manually
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="px-5 py-6 space-y-3">
        {!showSavedCard && (
          <button
            data-testid="button-gp-save"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white disabled:opacity-40"
            style={{ background: "#6B21A8" }}
          >
            {saving ? "Saving…" : "Save GP details"}
          </button>
        )}
        {isChangingGP && (
          <button
            data-testid="button-gp-cancel-change"
            onClick={handleCancelChange}
            className="w-full py-3 rounded-full font-body text-[15px] font-medium text-vyva-text-2 bg-white border border-vyva-border"
          >
            Cancel
          </button>
        )}
        {showSavedCard && (
          <button
            data-testid="button-gp-back-to-profile"
            onClick={() => navigate("/onboarding/profile")}
            className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white"
            style={{ background: "#6B21A8" }}
          >
            Back to profile
          </button>
        )}
      </div>
    </div>
  );
};

export default GPSection;
