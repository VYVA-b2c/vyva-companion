// src/pages/onboarding/sections/AllergiesSection.tsx
import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import VoiceAllergiesModal from "@/components/VoiceAllergiesModal";
import { Plus, Mic } from "lucide-react";
import { friendlyError } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";

const COMMON_ALLERGENS = [
  "Penicillin", "Aspirin", "Ibuprofen", "Sulfa drugs", "Codeine",
  "Latex", "Peanuts", "Tree nuts", "Shellfish", "Eggs",
  "Milk / Dairy", "Wheat / Gluten", "Soy", "Bee stings",
];

const ALLERGEN_ICON: Record<string, string> = {
  "Penicillin":    "💊",
  "Aspirin":       "💊",
  "Ibuprofen":     "💊",
  "Sulfa drugs":   "💊",
  "Codeine":       "💊",
  "Latex":         "🧤",
  "Peanuts":       "🥜",
  "Tree nuts":     "🌰",
  "Shellfish":     "🦐",
  "Eggs":          "🥚",
  "Milk / Dairy":  "🥛",
  "Wheat / Gluten":"🌾",
  "Soy":           "🫘",
  "Bee stings":    "🐝",
};


export default function AllergiesSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allergies, setAllergies] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const allergiesRef = useRef(allergies);
  useEffect(() => { allergiesRef.current = allergies; }, [allergies]);

  const { data, isLoading } = useQuery<{ profile: { known_allergies?: string[] | null } | null }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (!data) return;
    const saved = data?.profile?.known_allergies;
    setAllergies(Array.isArray(saved) ? saved : []);
  }, [data]);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave } = useAutoSave(
    async () => {
      const res = await apiFetch("/api/onboarding/section/medications", {
        method: "POST",
        body: JSON.stringify({ known_allergies: allergiesRef.current }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
    },
    1500,
  );

  const addAllergy = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (allergies.some((a) => a.toLowerCase() === lower)) {
      setInput("");
      return;
    }
    const updated = [...allergies, value];
    setAllergies(updated);
    setInput("");
    scheduleAutoSave();
  };

  const removeAllergy = (name: string) => {
    setAllergies((prev) => prev.filter((a) => a !== name));
    scheduleAutoSave();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAllergy(input);
    }
  };

  const handleVoiceAddAllergies = (incoming: string[]) => {
    if (incoming.length === 0) return;
    const existing = new Set(allergies.map((a) => a.toLowerCase()));
    const novel = incoming.map((a) => a.trim()).filter((a) => a && !existing.has(a.toLowerCase()));
    if (novel.length === 0) {
      toast({ title: "All allergens are already on your list" });
      return;
    }
    setAllergies((prev) => Array.from(new Set([...prev, ...novel])));
    scheduleAutoSave();
    toast({ title: `${novel.length} allergen${novel.length > 1 ? "s" : ""} added` });
  };

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/medications", {
        method: "POST",
        body: JSON.stringify({ known_allergies: allergies }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      navigate("/onboarding/complete/allergies");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save allergies", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const suggestionsToShow = COMMON_ALLERGENS.filter(
    (a) => !allergies.some((x) => x.toLowerCase() === a.toLowerCase())
  );

  return (
    <PhoneFrame subtitle="⚠️ Allergies" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">⚠️ Allergies</h2>
            <p className="text-xs text-gray-500 mt-1">Drug, food, and environmental allergies. Shared with emergency services only if you need urgent help.</p>
          </div>
          <AutoSaveStatusBadge
            autoSaveStatus={autoSaveStatus}
            savedFading={savedFading}
            retryCountdown={retryCountdown}
            onRetryNow={retryNow}
            testId="status-allergies-autosave"
          />
        </div>

        {/* Add by voice banner */}
        <button
          type="button"
          data-testid="button-allergies-voice"
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
              Speak your allergies or ask VYVA for advice
            </p>
          </div>
        </button>

        {/* Voice allergies modal */}
        <VoiceAllergiesModal
          open={voiceModalOpen}
          onOpenChange={setVoiceModalOpen}
          onAddAllergies={handleVoiceAddAllergies}
        />

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-11 w-full rounded-lg" />
            <div className="flex flex-wrap gap-1.5">
              {[80, 100, 70, 90, 60].map((w, i) => (
                <Skeleton key={i} className="h-7 rounded-full" style={{ width: w }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Added allergies */}
            {allergies.length > 0 && (
              <div
                data-testid="list-allergies-tags"
                className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex flex-wrap gap-1.5 min-h-[44px] items-center"
              >
                {allergies.map((a) => (
                  <span
                    key={a}
                    data-testid={`tag-allergy-${a.replace(/\s+/g, "-").toLowerCase()}`}
                    className="inline-flex items-center gap-1 bg-amber-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  >
                    {a}
                    <button
                      type="button"
                      data-testid={`button-remove-allergy-${a.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => removeAllergy(a)}
                      className="opacity-80 hover:opacity-100 ml-0.5 leading-none"
                      aria-label={`Remove ${a}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {allergies.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 min-h-[44px] flex items-center">
                <span className="text-xs text-amber-400 italic">No allergies added yet</span>
              </div>
            )}

            {/* Text input */}
            <div className="flex gap-2">
              <Input
                data-testid="input-allergies-new"
                placeholder="Type an allergy and press Enter or Add"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-11 border-purple-200 flex-1"
              />
              <button
                type="button"
                data-testid="button-allergies-add"
                onClick={() => addAllergy(input)}
                disabled={!input.trim()}
                className="flex items-center gap-1 px-3 h-11 rounded-lg bg-[#6b21a8] text-white text-xs font-bold disabled:opacity-40 shrink-0"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            {/* Common allergens — icon-card grid */}
            {suggestionsToShow.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Common allergens — tap to add</p>
                <div className="grid grid-cols-2 gap-[8px]">
                  {suggestionsToShow.map((a) => (
                    <button
                      key={a}
                      type="button"
                      data-testid={`card-allergen-${a.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => addAllergy(a)}
                      className="flex items-center gap-[10px] rounded-[14px] px-3 py-[11px] text-left transition-all min-h-[56px]"
                      style={{ background: "#FFFBEB", border: "1px solid #FDE68A", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    >
                      <span className="text-[22px] flex-shrink-0 leading-none">{ALLERGEN_ICON[a] ?? "⚠️"}</span>
                      <span className="font-body text-[13px] font-medium text-vyva-text-1 leading-tight">{a}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button
            data-testid="button-allergies-save"
            onClick={handleSave}
            disabled={saving || isLoading}
            className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]"
          >
            {saving ? "Saving..." : "Save allergies"}
          </Button>
          <button
            data-testid="button-allergies-skip"
            onClick={() => navigate("/onboarding/profile")}
            className="text-xs text-gray-400 py-2 text-center"
          >
            Skip for now
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}
