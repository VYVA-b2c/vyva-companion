// src/pages/onboarding/sections/CognitiveSection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";

type CognitiveForm = {
  memory_difficulties: string;
  cognitive_diagnosis: string;
  session_length_mins: number;
  training_time: string;
  pace: string;
  variety: string;
  communication_style: string;
};

export default function CognitiveSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<CognitiveForm>({
    memory_difficulties: "none",
    cognitive_diagnosis: "none",
    session_length_mins: 15,
    training_time: "morning",
    pace: "normal",
    variety: "variety",
    communication_style: "standard",
  });
  const [saving, setSaving] = useState(false);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const { data, isLoading } = useQuery<{ profile: { cognitive?: CognitiveForm } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const saved = (data?.profile as { cognitive?: CognitiveForm } | null)?.cognitive;
    if (saved) {
      setForm((prev) => ({ ...prev, ...saved }));
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/cognitive", {
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

  const set = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    scheduleAutoSave();
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/cognitive", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/complete/cognitive");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save cognitive profile", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const SelectSkeleton = () => <Skeleton className="h-11 w-full rounded-lg" />;

  return (
    <PhoneFrame subtitle="🧠 Cognitive profile" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-5 px-4 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🧠 Cognitive profile</h2>
            <p className="text-xs text-gray-500 mt-1">Helps VYVA adjust how it communicates and personalise brain training sessions.</p>
          </div>
          <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-cognitive-autosave" />
        </div>

        <div className="bg-purple-50 border-l-2 border-[#6b21a8] rounded-lg px-3 py-2 text-xs text-purple-700">
          This information is never shared with anyone unless you explicitly enable it.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Memory difficulties</Label>
            {isLoading ? <SelectSkeleton /> : (
              <Select value={form.memory_difficulties} onValueChange={(v) => set("memory_difficulties", v)}>
                <SelectTrigger data-testid="select-cognitive-memory" className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Diagnosis (if any)</Label>
            {isLoading ? <SelectSkeleton /> : (
              <Select value={form.cognitive_diagnosis} onValueChange={(v) => set("cognitive_diagnosis", v)}>
                <SelectTrigger data-testid="select-cognitive-diagnosis" className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="mci">MCI</SelectItem>
                  <SelectItem value="early_dementia">Early dementia</SelectItem>
                  <SelectItem value="alzheimers">Alzheimer's</SelectItem>
                  <SelectItem value="parkinsons">Parkinson's</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Session length</Label>
            {isLoading ? <SelectSkeleton /> : (
              <Select value={String(form.session_length_mins)} onValueChange={(v) => set("session_length_mins", parseInt(v))}>
                <SelectTrigger data-testid="select-cognitive-session" className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="20">20 min</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Best time of day</Label>
            {isLoading ? <SelectSkeleton /> : (
              <Select value={form.training_time} onValueChange={(v) => set("training_time", v)}>
                <SelectTrigger data-testid="select-cognitive-time" className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="no_preference">No preference</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Pace</Label>
            {isLoading ? <SelectSkeleton /> : (
              <Select value={form.pace} onValueChange={(v) => set("pace", v)}>
                <SelectTrigger data-testid="select-cognitive-pace" className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="slower">Slower</SelectItem>
                  <SelectItem value="very_slow">Very slow</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Exercises</Label>
            {isLoading ? <SelectSkeleton /> : (
              <Select value={form.variety} onValueChange={(v) => set("variety", v)}>
                <SelectTrigger data-testid="select-cognitive-variety" className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="variety">Prefer variety</SelectItem>
                  <SelectItem value="repeating">Enjoy repeating</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">VYVA communication style</Label>
          {isLoading ? <SelectSkeleton /> : (
            <Select value={form.communication_style} onValueChange={(v) => set("communication_style", v)}>
              <SelectTrigger data-testid="select-cognitive-style" className="h-11 border-purple-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="simpler">Simpler language</SelectItem>
                <SelectItem value="very_simple">Very simple + more repetition</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-cognitive-save" onClick={handleSave} disabled={saving || isLoading} className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save cognitive profile"}
          </Button>
          <button data-testid="button-cognitive-skip" onClick={() => navigate("/onboarding/profile")} className="text-xs text-gray-400 py-2 text-center">Skip for now</button>
        </div>
      </div>
    </PhoneFrame>
  );
}
