// src/pages/onboarding/sections/ConditionsSection.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, CheckCircle2, ChevronDown } from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";

const CATEGORIES: { id: string; emoji: string; label: string }[] = [
  { id: "heart",       emoji: "🫀", label: "Heart & circulation" },
  { id: "metabolic",   emoji: "🩸", label: "Metabolic & hormonal" },
  { id: "respiratory", emoji: "🫁", label: "Respiratory" },
  { id: "musculo",     emoji: "🦴", label: "Joints, bones & muscles" },
  { id: "neuro",       emoji: "🧠", label: "Neurological" },
  { id: "mental",      emoji: "💙", label: "Mental health" },
  { id: "cancer",      emoji: "🎗️", label: "Cancer & oncology" },
  { id: "kidney",      emoji: "🫘", label: "Kidney & urinary" },
  { id: "digestive",   emoji: "🫃", label: "Digestive & gut" },
  { id: "sensory",     emoji: "👁️", label: "Sensory & skin" },
  { id: "other",       emoji: "➕", label: "Other" },
];

const CONDITION_GROUPS: { cat: string; items: string[] }[] = [
  { cat: "heart",      items: ["Hypertension","High cholesterol","Heart failure","Atrial fibrillation","Coronary artery disease","Heart attack (history)","Stroke (history)","Pacemaker / ICD","Deep vein thrombosis","Peripheral artery disease","Anaemia"] },
  { cat: "metabolic",  items: ["Diabetes Type 1","Diabetes Type 2","Pre-diabetes","Hypothyroidism","Hyperthyroidism","Osteoporosis","Vitamin D deficiency","Gout","Obesity","Metabolic syndrome"] },
  { cat: "respiratory",items: ["COPD","Asthma","Sleep apnoea","Pulmonary fibrosis","Chronic bronchitis","Emphysema","Pleural effusion"] },
  { cat: "musculo",    items: ["Osteoarthritis","Rheumatoid arthritis","Psoriatic arthritis","Fibromyalgia","Back pain (chronic)","Hip replacement","Knee replacement","Spinal stenosis","Muscle weakness","Lupus"] },
  { cat: "neuro",      items: ["Dementia","Alzheimer's","Parkinson's disease","Epilepsy","Multiple sclerosis","Peripheral neuropathy","Tremors","Migraine (chronic)","Motor neurone disease","Balance disorder"] },
  { cat: "mental",     items: ["Depression","Anxiety","Bipolar disorder","PTSD","OCD","Loneliness / isolation","Grief / bereavement","Sleep disorder / insomnia"] },
  { cat: "cancer",     items: ["Active cancer treatment","Cancer — in remission","Cancer — monitoring","Post-surgical recovery","Lymphoedema"] },
  { cat: "kidney",     items: ["Chronic kidney disease","Kidney stones","Urinary incontinence","Enlarged prostate (BPH)","Recurrent UTIs","Dialysis"] },
  { cat: "digestive",  items: ["IBS","Crohn's disease","Ulcerative colitis","GERD / Acid reflux","Coeliac disease","Diverticular disease","Liver disease","Gallstones","Constipation (chronic)"] },
  { cat: "sensory",    items: ["Vision impairment","Hearing loss","Glaucoma","Cataracts","Macular degeneration","Tinnitus","Eczema / Psoriasis","Diabetic retinopathy"] },
  { cat: "other",      items: ["Falls (recurrent)","Wound / ulcer (ongoing)","Chronic fatigue","Post-COVID / long COVID","Autoimmune condition","Transplant recipient","Blood disorder","Skin condition"] },
];

const ALL_CONDITIONS = CONDITION_GROUPS.flatMap((g) => g.items);

const CONDITION_SYNONYMS: Record<string, string> = {
  "high blood pressure": "Hypertension",
  "blood pressure": "Hypertension",
  "hypertension": "Hypertension",
  "heart attack": "Heart attack (history)",
  "had a heart attack": "Heart attack (history)",
  "diabetes": "Diabetes Type 2",
  "type 1 diabetes": "Diabetes Type 1",
  "type 2 diabetes": "Diabetes Type 2",
  "diabetic": "Diabetes Type 2",
  "cholesterol": "High cholesterol",
  "high cholesterol": "High cholesterol",
  "afib": "Atrial fibrillation",
  "atrial fibrillation": "Atrial fibrillation",
  "stroke": "Stroke (history)",
  "tia": "Stroke (history)",
  "mini stroke": "Stroke (history)",
  "heart failure": "Heart failure",
  "copd": "COPD",
  "emphysema": "Emphysema",
  "asthma": "Asthma",
  "arthritis": "Osteoarthritis",
  "osteoarthritis": "Osteoarthritis",
  "rheumatoid arthritis": "Rheumatoid arthritis",
  "osteoporosis": "Osteoporosis",
  "parkinson": "Parkinson's disease",
  "parkinsons": "Parkinson's disease",
  "alzheimer": "Alzheimer's",
  "alzheimers": "Alzheimer's",
  "dementia": "Dementia",
  "depression": "Depression",
  "anxiety": "Anxiety",
  "ptsd": "PTSD",
  "thyroid": "Hypothyroidism",
  "hypothyroid": "Hypothyroidism",
  "hyperthyroid": "Hyperthyroidism",
  "kidney disease": "Chronic kidney disease",
  "ckd": "Chronic kidney disease",
  "epilepsy": "Epilepsy",
  "ibs": "IBS",
  "irritable bowel": "IBS",
  "crohn": "Crohn's disease",
  "gerd": "GERD / Acid reflux",
  "acid reflux": "GERD / Acid reflux",
  "hearing loss": "Hearing loss",
  "glaucoma": "Glaucoma",
  "cataracts": "Cataracts",
  "macular degeneration": "Macular degeneration",
  "fibromyalgia": "Fibromyalgia",
  "multiple sclerosis": "Multiple sclerosis",
  "long covid": "Post-COVID / long COVID",
  "long-covid": "Post-COVID / long COVID",
};

function matchConditionsFromTranscript(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  const matched = new Set<string>();
  for (const [phrase, canonical] of Object.entries(CONDITION_SYNONYMS)) {
    if (lower.includes(phrase)) {
      const found = ALL_CONDITIONS.find((c) => c.toLowerCase() === canonical.toLowerCase());
      if (found) matched.add(found);
    }
  }
  for (const name of ALL_CONDITIONS) {
    if (matched.has(name)) continue;
    if (lower.includes(name.toLowerCase())) matched.add(name);
  }
  return Array.from(matched);
}

const MOBILITY_OPTIONS = [
  { value: "independent",          label: "🚶 Fully independent",      sub: "No aids needed" },
  { value: "stick_or_frame",       label: "🦯 Uses a stick or frame",   sub: "" },
  { value: "wheelchair_part_time", label: "♿ Wheelchair (part-time)",  sub: "For longer distances" },
  { value: "wheelchair_full_time", label: "♿ Wheelchair (full-time)",  sub: "Primary mode of movement" },
  { value: "housebound",           label: "🏠 Housebound",              sub: "Unable to leave home independently" },
];

const LIVING_OPTIONS = [
  { value: "alone",        label: "👤 Lives alone" },
  { value: "with_partner", label: "👫 With partner" },
  { value: "with_family",  label: "👨‍👩‍👧 With family" },
  { value: "care_home",    label: "🏡 Care home" },
];

type SavedCondition = { name: string; category: string };

export default function ConditionsSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [mobility, setMobility] = useState("");
  const [living, setLiving] = useState("");
  const [saving, setSaving] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [speakItMatches, setSpeakItMatches] = useState<string[]>([]);

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const { autoSaveStatus, savedFading, retryCountdown, retryNow, scheduleAutoSave, cancelAutoSave, setAutoSaveStatus } = useAutoSave(
    async () => {
      const conditions = selected.map((name) => {
        const group = CONDITION_GROUPS.find((g) => g.items.includes(name));
        return { name, category: group?.cat || "other" };
      });
      const res = await apiFetch("/api/onboarding/section/conditions", {
        method: "POST",
        body: JSON.stringify({ conditions, mobility_level: mobility || null, living_situation: living || null, allergies: [] }),
      });
      if (!res.ok) {
        const msg = await friendlyError(new Error(), res);
        throw new Error(msg);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
    },
    2000,
  );

  const { data, isLoading } = useQuery<{
    profile: { conditions?: SavedCondition[]; mobility_level?: string; living_situation?: string } | null;
  }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const p = data?.profile as { conditions?: SavedCondition[]; mobility_level?: string; living_situation?: string } | null;
    if (p) {
      if (p.conditions) setSelected(p.conditions.map((c) => c.name));
      if (p.mobility_level) setMobility(p.mobility_level);
      if (p.living_situation) setLiving(p.living_situation);
    }
  }, [data]);

  const toggleCondition = (name: string) => {
    setSelected((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
    scheduleAutoSave();
  };

  const removeSelected = (name: string) => {
    setSelected((prev) => prev.filter((x) => x !== name));
    scheduleAutoSave();
  };

  const handleMobility = (value: string) => { setMobility(value); scheduleAutoSave(); };
  const handleLiving   = (value: string) => { setLiving(value);   scheduleAutoSave(); };

  const handleSpeakItDone = (transcript: string) => {
    setSpeakItOpen(false);
    if (!transcript) return;
    const matches = matchConditionsFromTranscript(transcript);
    if (matches.length === 0) {
      toast({ title: "No conditions recognised", description: "Try speaking more slowly or select conditions manually below." });
      return;
    }
    setSpeakItMatches(matches);
  };

  const confirmSpeakItMatches = () => {
    const newSelected = Array.from(new Set([...selected, ...speakItMatches]));
    setSelected(newSelected);
    setSpeakItMatches([]);
    scheduleAutoSave();
    toast({ title: `${speakItMatches.length} condition${speakItMatches.length > 1 ? "s" : ""} added` });
  };

  const toggleCat = (catId: string) => {
    setOpenCat((prev) => (prev === catId ? null : catId));
  };

  const isSearching = search.trim().length > 0;

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let navigating = false;
    let res: Response | undefined;
    try {
      const conditions = selected.map((name) => {
        const group = CONDITION_GROUPS.find((g) => g.items.includes(name));
        return { name, category: group?.cat || "other" };
      });
      res = await apiFetch("/api/onboarding/section/conditions", {
        method: "POST",
        body: JSON.stringify({ conditions, mobility_level: mobility || null, living_situation: living || null, allergies: [] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      setAutoSaveStatus("saved");
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate("/onboarding/complete/conditions"), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save health conditions", description: msg, variant: "destructive" });
    } finally {
      if (!navigating) setSaving(false);
    }
  };

  return (
    <PhoneFrame subtitle="❤️ Health conditions" showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-4 px-4 py-4">

        {/* Guidance */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 leading-relaxed">Select everything that applies. Tap again to remove.</p>
          </div>
          <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading} retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-conditions-autosave" />
        </div>

        {/* Speak it banner */}
        <button
          type="button"
          data-testid="button-conditions-speak-it"
          onClick={() => setSpeakItOpen(true)}
          className="flex items-center gap-3 w-full rounded-[14px] px-4 py-3 text-left transition-colors"
          style={{ background: "#F5F3FF", border: "1px solid #EDE9FE" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse-ring"
            style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
          >
            <Mic size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[14px] font-medium" style={{ color: "#6B21A8" }}>Speak it</p>
            <p className="font-body text-[12px]" style={{ color: "#7C3AED" }}>Narrate your health history and VYVA will select for you</p>
          </div>
        </button>

        {/* Speak-it confirmation */}
        {speakItMatches.length > 0 && (
          <div
            className="rounded-[14px] px-4 py-3"
            style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}
            data-testid="panel-conditions-speak-it-confirm"
          >
            <p className="font-body text-[13px] font-semibold text-green-800 mb-2">
              VYVA found {speakItMatches.length} condition{speakItMatches.length > 1 ? "s" : ""}:
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {speakItMatches.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 bg-white text-green-800 text-[11px] px-2.5 py-1 rounded-full border border-green-200 font-medium">
                  <CheckCircle2 size={10} className="text-green-600" />
                  {name}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSpeakItMatches([])} className="flex-1 py-2 rounded-full font-body text-[13px] font-medium text-gray-600 bg-white border border-gray-200 min-h-[40px]" data-testid="button-conditions-speak-it-reject">Dismiss</button>
              <button onClick={confirmSpeakItMatches} className="flex-1 py-2 rounded-full font-body text-[13px] font-medium text-white min-h-[40px]" style={{ background: "#0A7C4E" }} data-testid="button-conditions-speak-it-confirm">Add these</button>
            </div>
          </div>
        )}

        {speakItOpen && (
          <SpeakItOverlay
            title="Tell VYVA your conditions"
            hint='e.g. "I have Type 2 diabetes and high blood pressure"'
            onDone={handleSpeakItDone}
            onCancel={() => setSpeakItOpen(false)}
          />
        )}

        {isLoading ? (
          <div className="flex flex-col gap-3" data-testid="skeleton-conditions-content">
            <Skeleton className="h-9 w-full rounded-lg" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-[14px]" />
            ))}
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                data-testid="input-conditions-search"
                className="w-full pl-9 pr-3 py-2 text-sm border border-purple-200 rounded-lg focus:outline-none focus:border-[#6b21a8]"
                placeholder="Search conditions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Selected chip bar */}
            <div className="bg-purple-50 rounded-lg px-3 py-2 min-h-[36px] flex flex-wrap gap-1.5 items-center">
              {selected.length === 0 ? (
                <span className="text-xs text-purple-400 italic">Nothing selected — tap any condition below</span>
              ) : (
                selected.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 bg-[#6b21a8] text-white text-[10px] px-2 py-0.5 rounded-full">
                    {name}
                    <button onClick={() => removeSelected(name)} className="opacity-70 hover:opacity-100" data-testid={`button-remove-condition-${name.replace(/\s+/g, "-").toLowerCase()}`}>×</button>
                  </span>
                ))
              )}
            </div>

            {/* Accordion */}
            <div className="flex flex-col gap-2">
              {CONDITION_GROUPS.map((group) => {
                const cat = CATEGORIES.find((c) => c.id === group.cat)!;
                const visibleItems = isSearching
                  ? group.items.filter((i) => i.toLowerCase().includes(search.toLowerCase()))
                  : group.items;
                if (isSearching && visibleItems.length === 0) return null;

                const selectedCount = group.items.filter((i) => selected.includes(i)).length;
                const isOpen = isSearching || openCat === group.cat;
                const hasSelections = selectedCount > 0;

                return (
                  <div
                    key={group.cat}
                    className="rounded-[14px] overflow-hidden"
                    style={{
                      border: hasSelections ? "1px solid #A78BFA" : "1px solid #EDE5DB",
                      background: hasSelections ? "#FAF8FF" : "#FFFFFF",
                    }}
                  >
                    {/* Accordion header */}
                    <button
                      type="button"
                      data-testid={`accordion-${group.cat}`}
                      onClick={() => !isSearching && toggleCat(group.cat)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-[20px] leading-none flex-shrink-0">{cat.emoji}</span>
                      <span className="flex-1 font-body text-[14px] font-semibold text-gray-800">{cat.label}</span>
                      {hasSelections && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: "#EDE9FE", color: "#6B21A8" }}
                          data-testid={`badge-count-${group.cat}`}
                        >
                          {selectedCount} selected
                        </span>
                      )}
                      {!isSearching && (
                        <ChevronDown
                          size={16}
                          className="flex-shrink-0 text-gray-400 transition-transform duration-200"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        />
                      )}
                    </button>

                    {/* Accordion body */}
                    <div
                      className="overflow-hidden transition-all duration-300 ease-in-out"
                      style={{ maxHeight: isOpen ? "2000px" : "0px" }}
                    >
                      <div className="grid grid-cols-2 gap-[8px] px-3 pb-3">
                        {visibleItems.map((item) => {
                          const isSelected = selected.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              data-testid={`card-condition-${item.replace(/\s+/g, "-").toLowerCase()}`}
                              onClick={() => toggleCondition(item)}
                              className={cn(
                                "flex items-center gap-[10px] rounded-[12px] px-3 py-[10px] text-left transition-all min-h-[52px]",
                              )}
                              style={
                                isSelected
                                  ? { background: "#EDE9FE", border: "2px solid #A78BFA", boxShadow: "0 2px 8px rgba(107,33,168,0.12)" }
                                  : { background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }
                              }
                            >
                              <span
                                className="font-body text-[12px] font-medium leading-tight flex-1 min-w-0"
                                style={{ color: isSelected ? "#5B12A0" : "#2C2320" }}
                              >
                                {item}
                              </span>
                              {isSelected && (
                                <CheckCircle2 size={14} className="flex-shrink-0" style={{ color: "#6B21A8" }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobility */}
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">Mobility</p>
              <div className="flex flex-col gap-2">
                {MOBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`button-mobility-${opt.value}`}
                    onClick={() => handleMobility(opt.value)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-semibold text-left transition-all",
                      mobility === opt.value ? "border-[#6b21a8] bg-purple-50" : "border-purple-100 bg-white hover:border-purple-200"
                    )}
                  >
                    <span className="flex-1">{opt.label}</span>
                    <span className={cn("w-3.5 h-3.5 rounded-full border-2 flex-shrink-0",
                      mobility === opt.value ? "border-[#6b21a8] bg-[#6b21a8] shadow-[inset_0_0_0_2px_white]" : "border-purple-200"
                    )} />
                  </button>
                ))}
              </div>
            </div>

            {/* Living situation */}
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">Living situation</p>
              <div className="grid grid-cols-2 gap-2">
                {LIVING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`button-living-${opt.value}`}
                    onClick={() => handleLiving(opt.value)}
                    className={cn(
                      "py-3 px-2 rounded-lg border text-xs font-bold text-center transition-all",
                      living === opt.value ? "border-[#6b21a8] bg-purple-50" : "border-purple-100 bg-white hover:border-purple-200"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button data-testid="button-conditions-save" onClick={handleSave} disabled={saving || isLoading} className="w-full h-12 font-bold bg-[#6b21a8] hover:bg-[#5b1a8f]">
            {saving ? "Saving..." : "Save health conditions"}
          </Button>
          <button data-testid="button-conditions-skip" onClick={() => navigate("/onboarding/profile")} className="text-xs text-gray-400 py-2 text-center">
            Skip for now
          </button>
        </div>

      </div>
    </PhoneFrame>
  );
}
