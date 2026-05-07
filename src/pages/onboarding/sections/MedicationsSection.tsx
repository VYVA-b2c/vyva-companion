// src/pages/onboarding/sections/MedicationsSection.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Loader2, Plus, CheckCircle2, AlertCircle, Mic } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { friendlyError } from "@/lib/apiError";
import VoiceMedsModal, { type MedicationForForm } from "@/components/VoiceMedsModal";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string;
  with_food: string;
  prescribed_by: string;
}

const emptyMed = (id: string): Medication => ({
  id, name: "", dosage: "", frequency: "", times: "", with_food: "", prescribed_by: "",
});

async function saveMedsToServer(meds: Medication[]): Promise<Response> {
  return await apiFetch("/api/onboarding/section/medications", {
    method: "POST",
    body: JSON.stringify({
      medications: meds
        .filter((m) => m.name.trim())
        .map(({ id: _id, ...rest }) => rest),
    }),
  });
}

function medsAreEqual(a: Medication, b: Medication): boolean {
  return (
    a.name === b.name &&
    a.dosage === b.dosage &&
    a.frequency === b.frequency &&
    a.times === b.times &&
    a.with_food === b.with_food &&
    a.prescribed_by === b.prescribed_by
  );
}

export default function MedicationsSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const counterRef = useRef(1);
  const loadedRef = useRef(false);
  const initialMed = emptyMed("med-1");
  const [meds, setMeds] = useState<Medication[]>([initialMed]);
  const [savedMeds, setSavedMeds] = useState<Medication[]>([initialMed]);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  // Refs so auto-save closure always sees the latest values
  const medsRef = useRef(meds);
  const busyRef = useRef(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { medsRef.current = meds; }, [meds]);
  useEffect(() => { busyRef.current = saving || autoSaving || adding || !!removingId; }, [saving, autoSaving, adding, removingId]);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const { data, isLoading } = useQuery<{ profile: { medications?: Omit<Medication, "id">[] } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (loadedRef.current) return;
    const saved = (data?.profile as { medications?: Omit<Medication, "id">[] } | null)?.medications;
    if (saved && saved.length > 0) {
      loadedRef.current = true;
      counterRef.current = saved.length;
      const withIds = saved.map((m, i) => ({ ...m, id: `med-${i + 1}` }));
      setMeds(withIds);
      setSavedMeds(withIds);
    } else if (data && !isLoading) {
      loadedRef.current = true;
    }
  }, [data, isLoading]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave, setAutoSaveStatus } = useAutoSave(
    async () => {
      if (busyRef.current) return;
      setAutoSaving(true);
      try {
        const currentMeds = medsRef.current;
        const res = await saveMedsToServer(currentMeds);
        if (!res.ok) {
          const msg = await friendlyError(new Error(), res);
          throw new Error(msg);
        }
        setSavedMeds([...currentMeds]);
        queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      } finally {
        setAutoSaving(false);
      }
    },
    2000,
  );

  const updateMed = (id: string, field: keyof Omit<Medication, "id">, value: string) => {
    setMeds((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
    scheduleAutoSave();
  };

  const addMed = async () => {
    if (adding || removingId || saving) return;
    setAdding(true);
    const previous = meds;
    counterRef.current += 1;
    const newMed = emptyMed(`med-${counterRef.current}`);
    const updated = [...previous, newMed];
    setMeds(updated);
    let res: Response | undefined;
    try {
      res = await saveMedsToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedMeds(updated);
      setAutoSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
    } catch (err) {
      setMeds(previous);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not add medication row", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeMed = async (id: string) => {
    if (removingId || adding || saving) return;
    setRemovingId(id);
    const previous = meds;
    const filtered = previous.filter((m) => m.id !== id);
    counterRef.current += 1;
    const updated = filtered.length > 0 ? filtered : [emptyMed(`med-${counterRef.current}`)];
    setMeds(updated);
    let res: Response | undefined;
    try {
      res = await saveMedsToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedMeds(updated);
      setAutoSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
    } catch (err) {
      setMeds(previous);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not remove medication", description: msg, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const addMedFromVoice = useCallback(
    async (voiceMed: MedicationForForm) => {
      if (adding || removingId || saving) return;
      setAdding(true);
      const previous = meds;
      counterRef.current += 1;
      const newId = `med-${counterRef.current}`;
      const newMed: Medication = {
        id: newId,
        name: voiceMed.name,
        dosage: voiceMed.dosage,
        frequency: voiceMed.frequency,
        times: voiceMed.times,
        with_food: voiceMed.with_food,
        prescribed_by: voiceMed.prescribed_by,
      };
      const updated = [...previous, newMed];
      setMeds(updated);
      let res: Response | undefined;
      try {
        res = await saveMedsToServer(updated);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSavedMeds(updated);
        setAutoSaveStatus("saved");
        queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      } catch (err) {
        setMeds(previous);
        const msg = await friendlyError(err, res && !res.ok ? res : undefined);
        toast({ title: "Could not add medication", description: msg, variant: "destructive" });
      } finally {
        setAdding(false);
      }
    },
    [adding, removingId, saving, meds, setAutoSaveStatus, toast]
  );

  const hasUnsavedChanges = useCallback((): boolean => {
    const hasUnsavedNewMeds = meds
      .slice(savedMeds.length)
      .some((m) => m.name.trim() !== "");
    if (hasUnsavedNewMeds) return true;
    if (savedMeds.length === 0) return false;
    if (meds.length !== savedMeds.length) return true;
    return meds.some((m, i) => !medsAreEqual(m, savedMeds[i]));
  }, [meds, savedMeds]);

  const confirmNavigation = useCallback((destination: string) => {
    if (hasUnsavedChanges()) {
      const ok = window.confirm(
        "You have unsaved changes to your medications. Leave without saving?"
      );
      if (!ok) return;
    }
    navigate(destination);
  }, [hasUnsavedChanges, navigate]);

  const handleSave = async () => {
    if (saving || autoSaving) return;
    cancelAutoSave();
    setSaving(true);
    let navigating = false;
    let res: Response | undefined;
    try {
      res = await saveMedsToServer(meds);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      setSavedMeds(meds);
      setAutoSaveStatus("saved");
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate("/onboarding/complete/medications"), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save medications", description: msg, variant: "destructive" });
    } finally {
      if (!navigating) setSaving(false);
    }
  };

  const isMedSaved = (idx: number): boolean => {
    if (savedMeds.length === 0) return false;
    if (idx >= savedMeds.length) return false;
    return medsAreEqual(meds[idx], savedMeds[idx]);
  };

  const isMedDirty = (idx: number): boolean => {
    if (savedMeds.length === 0) return false;
    if (idx >= savedMeds.length) return false;
    return !medsAreEqual(meds[idx], savedMeds[idx]);
  };

  const MedSkeleton = () => (
    <div className="border border-purple-100 rounded-xl p-4 bg-white flex flex-col gap-3">
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );

  const busy = saving || autoSaving || adding || !!removingId;

  return (
    <PhoneFrame subtitle="💊 Medications" showBack onBack={() => confirmNavigation("/onboarding/profile")} showAllSections onAllSections={() => confirmNavigation("/onboarding/profile")}>
      <div className="flex flex-col gap-5 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 leading-relaxed">All optional — skip any field you prefer not to fill in.</p>
          </div>
          <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-meds-autosave" />
        </div>

        {/* Add by voice banner */}
        <button
          type="button"
          data-testid="button-meds-voice"
          onClick={() => setVoiceModalOpen(true)}
          className="flex items-center gap-3 w-full rounded-[14px] px-4 py-3 text-left"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#F59E0B" }}
          >
            <Mic size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[14px] font-medium" style={{ color: "#92400E" }}>
              Add by voice
            </p>
            <p className="font-body text-[12px]" style={{ color: "#B45309" }}>
              Speak your medications and VYVA will fill in the details
            </p>
          </div>
        </button>

        {isLoading ? (
          <MedSkeleton />
        ) : (
          <>
            {meds.map((med, idx) => {
              const saved = isMedSaved(idx);
              const dirty = isMedDirty(idx);
              return (
                <div
                  key={med.id}
                  data-testid={`card-med-${med.id}`}
                  className={`border rounded-xl p-4 bg-white flex flex-col gap-3 ${
                    dirty
                      ? "border-amber-300 ring-1 ring-amber-200"
                      : saved
                      ? "border-green-300 ring-1 ring-green-100"
                      : "border-purple-100"
                  }`}
                >
                  <div className="flex items-center justify-between min-h-[20px]">
                    {meds.length > 1 && (
                      <p className="text-[10px] font-bold text-purple-600">Medication {idx + 1}</p>
                    )}
                    {saved && (
                      <span
                        data-testid={`status-med-saved-${idx}`}
                        className="flex items-center gap-1 text-[10px] font-semibold text-green-600 ml-auto"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Saved
                      </span>
                    )}
                    {dirty && (
                      <span
                        data-testid={`status-med-unsaved-${idx}`}
                        className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 ml-auto"
                      >
                        <AlertCircle className="w-3 h-3" />
                        Unsaved changes
                      </span>
                    )}
                    <button
                      type="button"
                      data-testid={`button-meds-remove-${med.id}`}
                      onClick={() => removeMed(med.id)}
                      disabled={busy}
                      className="p-1 rounded-full text-gray-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed ml-2"
                    >
                      {removingId === med.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-600">Medication name</Label>
                    <Input data-testid={`input-med-name-${idx}`} placeholder="e.g. Metformin" value={med.name} onChange={(e) => updateMed(med.id, "name", e.target.value)} className="h-11 border-purple-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-600">Dosage</Label>
                      <Input data-testid={`input-med-dosage-${idx}`} placeholder="e.g. 500mg" value={med.dosage} onChange={(e) => updateMed(med.id, "dosage", e.target.value)} className="h-11 border-purple-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-600">Frequency</Label>
                      <Select value={med.frequency || undefined} onValueChange={(v) => updateMed(med.id, "frequency", v)}>
                        <SelectTrigger data-testid={`select-med-frequency-${idx}`} className="h-11 border-purple-200"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once_daily">Once daily</SelectItem>
                          <SelectItem value="twice_daily">Twice daily</SelectItem>
                          <SelectItem value="three_daily">3x daily</SelectItem>
                          <SelectItem value="as_needed">As needed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-600">Time(s)</Label>
                      <Input data-testid={`input-med-times-${idx}`} placeholder="e.g. 08:00, 20:00" value={med.times} onChange={(e) => updateMed(med.id, "times", e.target.value)} className="h-11 border-purple-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-600">With food?</Label>
                      <Select value={med.with_food || undefined} onValueChange={(v) => updateMed(med.id, "with_food", v)}>
                        <SelectTrigger data-testid={`select-med-food-${idx}`} className="h-11 border-purple-200"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="with_food">With food</SelectItem>
                          <SelectItem value="without_food">Without food</SelectItem>
                          <SelectItem value="doesnt_matter">Doesn't matter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-600">Prescribed by</Label>
                    <Input data-testid={`input-med-prescribed-${idx}`} placeholder="GP or specialist name" value={med.prescribed_by} onChange={(e) => updateMed(med.id, "prescribed_by", e.target.value)} className="h-11 border-purple-200" />
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              data-testid="button-meds-add"
              onClick={addMed}
              disabled={busy || isLoading}
              className="flex items-center gap-1.5 text-sm font-bold text-[#6b21a8] text-left disabled:opacity-40"
            >
              {adding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {adding ? "Adding…" : "Add another medication"}
            </button>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-meds-save" onClick={handleSave} disabled={busy || isLoading} className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save medications"}
          </Button>
          <button data-testid="button-meds-skip" onClick={() => confirmNavigation("/onboarding/profile")} className="text-xs text-gray-400 py-2 text-center">Skip for now</button>
        </div>
      </div>

      <VoiceMedsModal
        open={voiceModalOpen}
        onOpenChange={setVoiceModalOpen}
        onAddMedication={addMedFromVoice}
      />
    </PhoneFrame>
  );
}
