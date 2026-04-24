// src/pages/onboarding/sections/EmergencySection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";

type EmergencyForm = {
  name: string;
  relationship: string;
  primary_phone: string;
  secondary_phone: string;
  address: string;
};

export default function EmergencySection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<EmergencyForm>({
    name: "", relationship: "",
    primary_phone: "", secondary_phone: "", address: "",
  });
  const [saving, setSaving] = useState(false);

  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const { data, isLoading } = useQuery<{ profile: { emergency_contact?: EmergencyForm } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const ec = (data?.profile as { emergency_contact?: EmergencyForm } | null)?.emergency_contact;
    if (ec) {
      setForm((prev) => ({
        name:            ec.name            ?? prev.name,
        relationship:    ec.relationship    ?? prev.relationship,
        primary_phone:   ec.primary_phone   ?? prev.primary_phone,
        secondary_phone: ec.secondary_phone ?? prev.secondary_phone,
        address:         ec.address         ?? prev.address,
      }));
    }
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/emergency", {
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

  const set = (f: string, v: string) => {
    setForm((p) => ({ ...p, [f]: v }));
    scheduleAutoSave();
  };

  const isValid = form.name.trim() && form.primary_phone.trim();

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/emergency", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/complete/emergency");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save emergency contact", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const FieldSkeleton = () => <Skeleton className="h-11 w-full rounded-lg" />;

  return (
    <PhoneFrame subtitle="🆘 Emergency contact" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🆘 Emergency contact</h2>
            <p className="text-xs text-gray-500 mt-1">Called immediately if VYVA cannot reach you. Must be reachable 24/7.</p>
          </div>
          <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-emergency-autosave" />
        </div>

        <div className="bg-red-50 border-l-2 border-red-400 rounded-lg px-3 py-2 text-xs text-red-700">
          This person can be the same as your caregiver. Their number is shared with emergency services only when needed.
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">Full name</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-name" placeholder="Name of emergency contact" value={form.name} onChange={(e) => set("name", e.target.value)} className="h-11 border-purple-200" />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">Relationship to you</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-relationship" placeholder="e.g. Daughter, Neighbour, Carer" value={form.relationship} onChange={(e) => set("relationship", e.target.value)} className="h-11 border-purple-200" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Primary phone (24/7)</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input data-testid="input-emergency-primary-phone" type="tel" placeholder="Always reachable" value={form.primary_phone} onChange={(e) => set("primary_phone", e.target.value)} className="h-11 border-purple-200" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-600">Secondary phone</Label>
            {isLoading ? <FieldSkeleton /> : (
              <Input data-testid="input-emergency-secondary-phone" type="tel" placeholder="Backup number" value={form.secondary_phone} onChange={(e) => set("secondary_phone", e.target.value)} className="h-11 border-purple-200" />
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-gray-600">Their address (for emergency services)</Label>
          {isLoading ? <FieldSkeleton /> : (
            <Input data-testid="input-emergency-address" placeholder="If different from yours" value={form.address} onChange={(e) => set("address", e.target.value)} className="h-11 border-purple-200" />
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-emergency-save" onClick={handleSave} disabled={!isValid || saving || isLoading} className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f] disabled:opacity-40">
            {saving ? "Saving..." : "Save emergency contact"}
          </Button>
          <button data-testid="button-emergency-skip" onClick={() => navigate("/onboarding/profile")} className="text-xs text-gray-400 py-2 text-center">Skip for now</button>
        </div>
      </div>
    </PhoneFrame>
  );
}
