// src/pages/onboarding/sections/DietSection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ChipSelector } from "@/components/onboarding/ChipSelector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";

const DIET_OPTIONS = [
  "Vegetarian","Vegan","Halal","Kosher","No pork","No shellfish",
  "Gluten-free","Dairy-free","Diabetic diet","Low salt","Low potassium","No restrictions",
];

export default function DietSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedRef = useRef(selected);
  const notesRef = useRef(notes);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const { data, isLoading } = useQuery<{ profile: { diet?: { preferences?: string[]; notes?: string } } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const saved = (data?.profile as { diet?: { preferences?: string[]; notes?: string } } | null)?.diet;
    if (saved) {
      if (saved.preferences) setSelected(saved.preferences);
      if (saved.notes) setNotes(saved.notes);
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/diet", {
        method: "POST",
        body: JSON.stringify({ preferences: selectedRef.current, notes: notesRef.current }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
    },
    2000,
  );

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/diet", {
        method: "POST",
        body: JSON.stringify({ preferences: selected, notes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/complete/diet");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save dietary preferences", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PhoneFrame subtitle="🥗 Dietary preferences" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-5 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 leading-relaxed">Select everything that applies. Used by VYVA to personalise nutrition coaching.</p>
          </div>
          <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-diet-autosave" />
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3" data-testid="skeleton-diet-content">
            <div className="flex flex-wrap gap-2">
              {[80, 64, 72, 56, 88, 60, 76, 52].map((w, i) => (
                <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
              ))}
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : (
          <>
            <ChipSelector
              options={DIET_OPTIONS}
              selected={selected}
              onChange={(val) => { setSelected(val); scheduleAutoSave(); }}
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-600">Other dietary notes (optional)</Label>
              <textarea
                data-testid="input-diet-notes"
                className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#6b21a8] resize-none"
                rows={3}
                placeholder="e.g. soft foods only, texture modified, low fibre..."
                value={notes}
                onChange={(e) => { setNotes(e.target.value); scheduleAutoSave(); }}
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-diet-save" onClick={handleSave} disabled={saving || isLoading} className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save dietary preferences"}
          </Button>
          <button data-testid="button-diet-skip" onClick={() => navigate("/onboarding/profile")} className="text-xs text-gray-400 py-2 text-center">Skip for now</button>
        </div>
      </div>
    </PhoneFrame>
  );
}
