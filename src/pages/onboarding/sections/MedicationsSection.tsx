// src/pages/onboarding/sections/MedicationsSection.tsx
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { OnboardingCompanionTarget } from "@/components/onboarding/OnboardingCompanionTarget";
import {
  companionGuidanceForMode,
  ONBOARDING_COMPANION_TARGETS,
  type OnboardingCompanionGuidancePatch,
} from "@/components/onboarding/onboardingCompanionGuidanceTemplate";
import { useOnboardingAgent } from "@/components/onboarding/useOnboardingAgent";
import { useOnboardingElevenLabsSectionRuntime } from "@/components/onboarding/useOnboardingElevenLabsSectionRuntime";
import { createProfileOnboardingAgentSectionConfig } from "@/components/onboarding/profileOnboardingAgentSections";
import { AutoSaveStatusBadge } from "@/components/onboarding/AutoSaveStatusBadge";
import { ProfileCompletionBar, ProfileNoneOption } from "@/components/onboarding/ProfileSectionControls";
import { ProfileVoiceDraftReview } from "@/components/onboarding/ProfileVoiceDraftReview";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField, ResponsiveGrid } from "@/components/vyva-ui";
import { SeniorChoiceChips, type SeniorChoiceOption } from "@/components/onboarding/SeniorChoiceChips";
import { Trash2, Loader2, Plus, CheckCircle2, AlertCircle, Mic, Pill, Clock3, Utensils, Stethoscope, Sparkles, ChevronDown, ChevronUp, Pencil, Sun, Moon, Coffee, CalendarClock, BadgeCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiFetch } from "@/lib/queryClient";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";
import { friendlyError } from "@/lib/apiError";
import VoiceMedsModal, { type MedicationForForm } from "@/components/VoiceMedsModal";
import type { ProfileVoiceDraft } from "@/lib/profileVoiceCompletion";

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

const STANDARD_FREQUENCIES = ["once_daily", "twice_daily", "three_daily", "as_needed"];
const FREQUENCY_LABELS: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_daily: "3x daily",
  as_needed: "As needed",
};
const FOOD_LABELS: Record<string, string> = {
  with_food: "With food",
  without_food: "Without food",
  doesnt_matter: "Doesn't matter",
};
const TIME_PRESETS: SeniorChoiceOption[] = [
  { label: "Morning", value: "Morning", icon: <Sun size={17} /> },
  { label: "Evening", value: "Evening", icon: <Moon size={17} /> },
  { label: "Bedtime", value: "Bedtime", icon: <Moon size={17} /> },
  { label: "Morning and evening", value: "Morning and evening", icon: <CalendarClock size={17} /> },
];
const FREQUENCY_OPTIONS: SeniorChoiceOption[] = [
  { label: "Once daily", value: "once_daily", icon: <BadgeCheck size={17} /> },
  { label: "Twice daily", value: "twice_daily", icon: <BadgeCheck size={17} /> },
  { label: "3x daily", value: "three_daily", icon: <BadgeCheck size={17} /> },
  { label: "As needed", value: "as_needed", icon: <CalendarClock size={17} /> },
  { label: "Other", value: "other", description: "Type it in your own words", icon: <Pencil size={17} /> },
];
const FOOD_OPTIONS: SeniorChoiceOption[] = [
  { label: "With food", value: "with_food", icon: <Utensils size={17} /> },
  { label: "Without food", value: "without_food", icon: <Coffee size={17} /> },
  { label: "Doesn't matter", value: "doesnt_matter", icon: <BadgeCheck size={17} /> },
];
const MEDICATION_COMPANION_TARGETS = ONBOARDING_COMPANION_TARGETS.medications;

function isCustomFrequency(value: string): boolean {
  return Boolean(value && !STANDARD_FREQUENCIES.includes(value));
}

function customFrequencyDisplayValue(value: string): string {
  return value === "as_needed" ? "As needed" : value;
}

function parseMedicationTimes(raw: string): string[] | undefined {
  const times = raw
    .split(/[,\n;]+/)
    .map((time) => time.trim())
    .filter(Boolean);

  return times.length > 0 ? times : undefined;
}

function FieldLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-vyva-purple">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function medicationSummary(med: Medication) {
  const details = [
    med.dosage.trim(),
    med.times.trim(),
    FREQUENCY_LABELS[med.frequency] ?? med.frequency.trim(),
    FOOD_LABELS[med.with_food] ?? "",
  ].filter(Boolean);

  return details.length ? details.join(" • ") : "Ready for simple reminders";
}

function hasAdvancedMedicationDetails(med: Medication) {
  return Boolean(med.frequency || med.with_food || med.prescribed_by.trim());
}

function cloneSetWith(value: Set<string>, id: string) {
  const next = new Set(value);
  next.add(id);
  return next;
}

function cloneSetWithout(value: Set<string>, id: string) {
  const next = new Set(value);
  next.delete(id);
  return next;
}

function hasNamedMedication(meds: Medication[]) {
  return meds.some((med) => med.name.trim().length > 0);
}

async function saveMedsToServer(meds: Medication[], noKnownMedications = false): Promise<Response> {
  const hasMedication = hasNamedMedication(meds);
  return await apiFetch("/api/onboarding/section/medications", {
    method: "POST",
    body: JSON.stringify({
      medications: meds
        .filter((m) => m.name.trim())
        .map((m) => ({
          medication_name: m.name.trim(),
          dosage: m.dosage.trim() || undefined,
          frequency: m.frequency || undefined,
          scheduled_times: parseMedicationTimes(m.times),
        })),
      no_known_medications: noKnownMedications && !hasMedication,
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
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();
  const counterRef = useRef(1);
  const loadedRef = useRef(false);
  const initialMed = emptyMed("med-1");
  const [meds, setMeds] = useState<Medication[]>([initialMed]);
  const [savedMeds, setSavedMeds] = useState<Medication[]>([initialMed]);
  const [noKnownMedications, setNoKnownMedications] = useState(false);
  const [saving, setSaving] = useState(false);
  const autoSaving = false;
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<ProfileVoiceDraft | null>(null);
  const [customFrequencyMedIds, setCustomFrequencyMedIds] = useState<Set<string>>(() => new Set());
  const [expandedMedIds, setExpandedMedIds] = useState<Set<string>>(() => new Set([initialMed.id]));
  const [detailsOpenMedIds, setDetailsOpenMedIds] = useState<Set<string>>(() => new Set());
  const {
    mode: companionMode,
    setMode: setCompanionMode,
    setGuidance,
    clearGuidance,
    registerVoiceAction,
  } = useOnboardingAgent();
  const medicationAgentSectionConfig = useMemo(
    () =>
      createProfileOnboardingAgentSectionConfig({
        sectionId: "medications",
        sectionLabel: t("onboarding.medications.title", "Medications"),
        voicePrompt: t(
          "onboarding.medications.voiceGuidance.speakPrompt",
          "Tell VYVA the medication name, strength, and routine if you know them.",
        ),
        expectedFields: ["medication_name", "dosage", "frequency", "scheduled_times"],
        draftRowLabels: {
          medication: t("onboarding.medications.voiceDraft.medicationLabel", "Medication"),
          strength: t("onboarding.medications.voiceDraft.strengthLabel", "Strength"),
          routine: t("onboarding.medications.voiceDraft.routineLabel", "Routine"),
        },
        targetIds: {
          addByVoice: MEDICATION_COMPANION_TARGETS.addByVoice,
          draftReview: MEDICATION_COMPANION_TARGETS.firstMedication,
          reviewSave: MEDICATION_COMPANION_TARGETS.reviewSave,
        },
      }),
    [t],
  );

  const medsRef = useRef(meds);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { medsRef.current = meds; }, [meds]);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  const setMedicationVoiceGuidance = useCallback(
    (guidance: OnboardingCompanionGuidancePatch) => {
      const voiceGuidance = companionGuidanceForMode(companionMode, guidance);
      if (voiceGuidance) setGuidance(voiceGuidance);
    },
    [companionMode, setGuidance],
  );

  useEffect(() => {
    if (companionMode !== "voice") {
      clearGuidance();
      return;
    }

    setGuidance({
      voiceStatus: "idle",
      draftStatus: "idle",
      currentSectionId: medicationAgentSectionConfig.sectionId,
      currentSectionLabel: medicationAgentSectionConfig.sectionLabel,
      currentPrompt: t(
        "onboarding.medications.voiceGuidance.startPrompt",
        "Tell VYVA your medicines, enter the medication name, or choose no current medications.",
      ),
      activeTargetId: medicationAgentSectionConfig.targetIds?.addByVoice,
    });

    return () => clearGuidance();
  }, [clearGuidance, companionMode, medicationAgentSectionConfig, setGuidance, t]);
  const completePath = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo
      ? `/onboarding/complete/medications?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/complete/medications";
  };

  const { data, isLoading } = useQuery<{ profile: { medications?: Omit<Medication, "id">[]; no_known_medications?: boolean } | null }>({
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
      setNoKnownMedications(false);
      setExpandedMedIds(new Set());
      setDetailsOpenMedIds(new Set());
    } else if (data && !isLoading) {
      loadedRef.current = true;
      setNoKnownMedications(Boolean(data.profile?.no_known_medications));
    }
  }, [data, isLoading]);

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const savedFading = false;
  const retryCountdown = null;
  const retryNow = () => undefined;
  const cancelAutoSave = () => undefined;

  const updateMed = (id: string, field: keyof Omit<Medication, "id">, value: string) => {
    if (value.trim()) setNoKnownMedications(false);
    setMeds((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
    setMedicationVoiceGuidance({
      voiceStatus: "thinking",
      draftStatus: "confirmed-locally",
      currentPrompt: t(
        "onboarding.medications.voiceGuidance.reviewPrompt",
        "Review the medication details, then save when ready.",
      ),
      activeTargetId: MEDICATION_COMPANION_TARGETS.reviewSave,
    });
  };

  const toggleNoKnownMedications = () => {
    const next = !noKnownMedications;
    setNoKnownMedications(next);
    if (next) {
      const reset = emptyMed("med-1");
      counterRef.current = 1;
      setMeds([reset]);
      setExpandedMedIds(new Set([reset.id]));
      setDetailsOpenMedIds(new Set());
      setCustomFrequencyMedIds(new Set());
    }
    setMedicationVoiceGuidance({
      voiceStatus: "thinking",
      draftStatus: "confirmed-locally",
      currentPrompt: t(
        "onboarding.medications.voiceGuidance.noCurrentPrompt",
        "No current medications is selected. Save when you are ready.",
      ),
      lastHeardText: next
        ? t(
            "onboarding.medications.voiceGuidance.noCurrentSelected",
            "Selected no current medications",
          )
        : undefined,
      activeTargetId: MEDICATION_COMPANION_TARGETS.reviewSave,
    });
  };

  const { startRuntimeCapture } = useOnboardingElevenLabsSectionRuntime({
    sectionConfig: medicationAgentSectionConfig,
    companionMode,
    setCompanionMode,
    setGuidance,
    setVoiceDraft,
    existingProfileSummary: () => medsRef.current.filter((med) => med.name.trim()).map(medicationSummary).join("; ") || undefined,
    activeDraftId: () => voiceDraft?.id,
  });

  const startVoiceMedicationCapture = useCallback(() => {
    void startRuntimeCapture({ fallback: () => setVoiceModalOpen(true) });
  }, [startRuntimeCapture]);

  useEffect(
    () =>
      registerVoiceAction({
        id: "profile-medications-voice-capture",
        label: t("onboarding.medications.tellVyva", "Tell VYVA"),
        description: t(
          "onboarding.medications.tellVyvaDescription",
          "Say the name, strength, or routine.",
        ),
        sectionId: "medications",
        sectionLabel: medicationAgentSectionConfig.sectionLabel,
        targetId: medicationAgentSectionConfig.targetIds?.addByVoice,
        sectionConfig: medicationAgentSectionConfig,
        onStart: startVoiceMedicationCapture,
      }),
    [medicationAgentSectionConfig, registerVoiceAction, startVoiceMedicationCapture, t],
  );

  const updateFrequency = (id: string, value: string) => {
    if (value === "other") {
      setCustomFrequencyMedIds((prev) => new Set(prev).add(id));
      const currentFrequency = medsRef.current.find((med) => med.id === id)?.frequency ?? "";
      if (!isCustomFrequency(currentFrequency)) {
        updateMed(id, "frequency", "");
      }
      return;
    }

    setCustomFrequencyMedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    updateMed(id, "frequency", value);
  };

  const updateTimePreset = (id: string, value: string) => {
    updateMed(id, "times", value);
  };

  const toggleDetails = (id: string) => {
    setDetailsOpenMedIds((prev) => (
      prev.has(id) ? cloneSetWithout(prev, id) : cloneSetWith(prev, id)
    ));
  };

  const editMed = (med: Medication) => {
    setExpandedMedIds((prev) => cloneSetWith(prev, med.id));
    if (hasAdvancedMedicationDetails(med)) {
      setDetailsOpenMedIds((prev) => cloneSetWith(prev, med.id));
    }
  };

  const collapseMed = (id: string) => {
    setExpandedMedIds((prev) => cloneSetWithout(prev, id));
  };

  const addMed = () => {
    if (adding || removingId || saving) return;
    setAdding(true);
    setNoKnownMedications(false);
    counterRef.current += 1;
    const newMed = emptyMed(`med-${counterRef.current}`);
    const updated = [...meds, newMed];
    setMeds(updated);
    setExpandedMedIds((prev) => cloneSetWith(prev, newMed.id));
    setDetailsOpenMedIds((prev) => cloneSetWithout(prev, newMed.id));
    setMedicationVoiceGuidance({
      voiceStatus: "thinking",
      draftStatus: "confirmed-locally",
      currentPrompt: t(
        "onboarding.medications.voiceGuidance.reviewPrompt",
        "Review the medication details, then save when ready.",
      ),
      activeTargetId: MEDICATION_COMPANION_TARGETS.firstMedication,
    });
    setAdding(false);
  };

  const removeMed = (id: string) => {
    if (removingId || adding || saving) return;
    setRemovingId(id);
    const filtered = meds.filter((m) => m.id !== id);
    counterRef.current += 1;
    const updated = filtered.length > 0 ? filtered : [emptyMed(`med-${counterRef.current}`)];
    setMeds(updated);
    setExpandedMedIds((prev) => {
      const next = cloneSetWithout(prev, id);
      if (updated.length === 1 && !updated[0].name.trim()) next.add(updated[0].id);
      return next;
    });
    setDetailsOpenMedIds((prev) => cloneSetWithout(prev, id));
    setMedicationVoiceGuidance({
      voiceStatus: "thinking",
      draftStatus: "confirmed-locally",
      currentPrompt: t(
        "onboarding.medications.voiceGuidance.reviewPrompt",
        "Review the medication details, then save when ready.",
      ),
      activeTargetId: MEDICATION_COMPANION_TARGETS.reviewSave,
    });
    setRemovingId(null);
  };

  const addMedFromVoice = useCallback(
    async (voiceMed: MedicationForForm) => {
      if (adding || removingId || saving) return;
      setAdding(true);
      setNoKnownMedications(false);
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
      setExpandedMedIds((prev) => cloneSetWith(prev, newId));
      if (hasAdvancedMedicationDetails(newMed)) {
        setDetailsOpenMedIds((prev) => cloneSetWith(prev, newId));
      }
      setMedicationVoiceGuidance({
        voiceStatus: "speaking",
        draftStatus: "confirmed-locally",
        currentPrompt: t(
          "onboarding.medications.voiceGuidance.voiceAddedPrompt",
          "I added the medication details. Review them before saving.",
        ),
        lastHeardText: t("onboarding.medications.voiceGuidance.voiceAdded", {
          name: voiceMed.name,
          defaultValue: `Added ${voiceMed.name}`,
        }),
        activeTargetId: MEDICATION_COMPANION_TARGETS.reviewSave,
      });
      setAdding(false);
    },
    [adding, removingId, saving, meds, setMedicationVoiceGuidance, t]
  );

  const medicationDraftRow = (draft: ProfileVoiceDraft, ids: string[]) => {
    const normalizedIds = new Set(ids.map((id) => id.toLowerCase()));
    return draft.rows.find((row) => normalizedIds.has(row.id.toLowerCase()))?.value ?? "";
  };

  const medicationFromVoiceDraft = (draft: ProfileVoiceDraft): MedicationForForm => {
    const metadata = draft.metadata ?? {};
    const name =
      metadata.name ||
      metadata.medication_name ||
      metadata.medication ||
      medicationDraftRow(draft, ["name", "medication_name", "medication"]) ||
      draft.values[0] ||
      "";
    const dosage =
      metadata.dosage ||
      metadata.strength ||
      medicationDraftRow(draft, ["dosage", "strength"]);
    const routine =
      metadata.routine ||
      metadata.frequency ||
      metadata.scheduled_times ||
      medicationDraftRow(draft, ["routine", "frequency", "scheduled_times", "times"]);

    return {
      name,
      dosage,
      frequency: metadata.frequency ?? "",
      times: metadata.times ?? routine,
      with_food: metadata.with_food ?? "",
      prescribed_by: metadata.prescribed_by ?? "",
    };
  };

  const confirmVoiceDraft = () => {
    if (!voiceDraft) return;
    const medication = medicationFromVoiceDraft(voiceDraft);
    if (!medication.name.trim()) {
      setMedicationVoiceGuidance({
        voiceStatus: "error",
        draftStatus: "needs-clarification",
        currentPrompt: t(
          "onboarding.medications.voiceGuidance.nameNeededPrompt",
          "Please tell VYVA the medication name before adding it.",
        ),
        activeTargetId: MEDICATION_COMPANION_TARGETS.addByVoice,
      });
      return;
    }
    void addMedFromVoice(medication);
    setVoiceDraft(null);
  };

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
      res = await saveMedsToServer(meds, noKnownMedications);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
      setSavedMeds(meds);
      setAutoSaveStatus("saved");
      setMedicationVoiceGuidance({ voiceStatus: "idle", draftStatus: "saved" });
      navigating = true;
      navTimerRef.current = setTimeout(() => navigate(completePath()), 300);
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
    if (!meds[idx]?.name.trim()) return false;
    return medsAreEqual(meds[idx], savedMeds[idx]);
  };

  const isMedDirty = (idx: number): boolean => {
    if (savedMeds.length === 0) return false;
    if (idx >= savedMeds.length) return false;
    return !medsAreEqual(meds[idx], savedMeds[idx]);
  };

  const MedSkeleton = () => (
    <div className="flex flex-col gap-5 rounded-[30px] border border-purple-100 bg-white p-6 shadow-[0_18px_40px_rgba(53,28,87,0.08)]">
      <Skeleton className="h-14 w-full rounded-[18px]" />
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
        <Skeleton className="h-14 w-full rounded-[18px]" />
        <Skeleton className="h-14 w-full rounded-[18px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
        <Skeleton className="h-14 w-full rounded-[18px]" />
        <Skeleton className="h-14 w-full rounded-[18px]" />
      </div>
      <Skeleton className="h-14 w-full rounded-[18px]" />
    </div>
  );

  const busy = saving || autoSaving || adding || !!removingId;
  const hasMedicationSectionContent = hasNamedMedication(meds) || noKnownMedications;
  const inputClassName = "h-14 rounded-[18px] border-[#DDC7FF] bg-white px-4 text-[17px] text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] placeholder:text-[#8D7D73] focus-visible:ring-4 focus-visible:ring-vyva-purple/15";

  return (
    <PhoneFrame
      layout="page"
      className="!rounded-none"
      subtitle={t("onboarding.medications.title", "Medications")}
      showBack
      onBack={() => confirmNavigation("/onboarding/profile")}
      homeMasterBackPath="/dev/home-master/profile"
      showCompanionMode={false}
      rightAction={(
        <OnboardingCompanionTarget targetId={MEDICATION_COMPANION_TARGETS.addByVoice}>
        <button type="button" onClick={startVoiceMedicationCapture}
          aria-label={t("onboarding.medications.tellVyva", "Tell VYVA your medicines")}
          title={t("onboarding.medications.tellVyva", "Tell VYVA your medicines")}
          data-testid="button-meds-voice"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-vyva-purple text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vyva-purple">
          <Mic size={20} aria-hidden="true" />
        </button>
        </OnboardingCompanionTarget>
      )}
    >
      <div className="flex flex-col gap-5 pb-28 pt-5 sm:pb-5">
        <AutoSaveStatusBadge autoSaveStatus={autoSaveStatus} savedFading={savedFading}
          retryCountdown={retryCountdown} onRetryNow={retryNow} testId="status-meds-autosave" />

        {voiceDraft ? (
          <OnboardingCompanionTarget targetId={MEDICATION_COMPANION_TARGETS.firstMedication}>
            <ProfileVoiceDraftReview
              draft={voiceDraft}
              confirmLabel={t("onboarding.medications.voiceDraft.confirm", "Add this medication")}
              tryAgainLabel={t("onboarding.medications.voiceDraft.tryAgain", "Try again")}
              dismissLabel={t("onboarding.medications.voiceDraft.dismiss", "Dismiss")}
              onConfirm={confirmVoiceDraft}
              onTryAgain={() => {
                setVoiceDraft(null);
                startVoiceMedicationCapture();
              }}
              onDismiss={() => setVoiceDraft(null)}
              onRemoveRow={(value) =>
                setVoiceDraft((current) => current
                  ? {
                      ...current,
                      rows: current.rows.filter((row) => row.value !== value),
                      values: current.values.filter((rowValue) => rowValue !== value),
                    }
                  : current)
              }
              testId="panel-meds-elevenlabs-confirm"
            />
          </OnboardingCompanionTarget>
        ) : null}

        <OnboardingCompanionTarget targetId={MEDICATION_COMPANION_TARGETS.noCurrent}>
          <ProfileNoneOption
            title={t("onboarding.medications.noneKnown", "No current medications")}
            description={t(
              "onboarding.medications.noneKnownDescription",
              "Choose this if there are no current medicines to add.",
            )}
            selected={noKnownMedications}
            onClick={toggleNoKnownMedications}
            onFocus={() =>
              setMedicationVoiceGuidance({
                voiceStatus: "listening",
                currentPrompt: t(
                  "onboarding.medications.voiceGuidance.noCurrentQuestion",
                  "Choose this only if there are no current medications.",
                ),
                activeTargetId: MEDICATION_COMPANION_TARGETS.noCurrent,
              })
            }
            testId="button-meds-no-current"
            tone="green"
          />
        </OnboardingCompanionTarget>

        {isLoading ? (
          <MedSkeleton />
        ) : (
          <>
            {meds.map((med, idx) => {
              const saved = isMedSaved(idx);
              const dirty = isMedDirty(idx);
              const hasName = Boolean(med.name.trim());
              const expanded = expandedMedIds.has(med.id) || !hasName || dirty;
              const summaryOnly = hasName && saved && !dirty && !expanded;
              const detailsOpen = detailsOpenMedIds.has(med.id);
              const showCustomFrequency =
                customFrequencyMedIds.has(med.id) || isCustomFrequency(med.frequency);

              return (
                <OnboardingCompanionTarget
                  targetId={idx === 0 ? MEDICATION_COMPANION_TARGETS.firstMedication : `medications-medication-${idx + 1}`}
                  key={med.id}
                  data-testid={`card-med-${med.id}`}
                  className={`relative flex flex-col gap-5 overflow-hidden rounded-lg border bg-white p-4 shadow-sm sm:p-5 ${
                    dirty
                      ? "border-amber-300 ring-1 ring-amber-200"
                      : saved
                      ? "border-green-300 ring-1 ring-green-100"
                      : "border-purple-100"
                  }`}
                >
                  {summaryOnly ? (
                    <div className="flex flex-col gap-4 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#0A7C4E]">
                          <Pill size={24} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-body text-[22px] font-black leading-tight text-vyva-text-1">
                            {med.name.trim()}
                          </p>
                          <p className="mt-1 font-body text-[16px] leading-snug text-vyva-text-2">
                            {medicationSummary(med)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          data-testid={`status-med-saved-${idx}`}
                          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-extrabold text-green-600"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Saved
                        </span>
                        <button
                          type="button"
                          data-testid={`button-meds-edit-${med.id}`}
                          onClick={() => editMed(med)}
                          className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E7DCF8] bg-white px-4 text-[14px] font-black text-vyva-purple shadow-sm"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                        <button
                          type="button"
                          data-testid={`button-meds-remove-${med.id}`}
                          onClick={() => removeMed(med.id)}
                          disabled={busy}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {removingId === med.id ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="flex min-h-[48px] flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between min-[520px]:gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3E8FF] text-[18px] font-black text-vyva-purple">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-[19px] font-black leading-tight text-vyva-text-1">
                          Medication {idx + 1}
                        </p>
                        <p className="mt-1 font-body text-[15px] leading-snug text-vyva-text-3">
                          The name is enough to save. Details make reminders smarter.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-2 min-[520px]:justify-start">
                      {saved && (
                        <span
                          data-testid={`status-med-saved-${idx}`}
                          className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-extrabold text-green-600"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Saved
                        </span>
                      )}
                      {dirty && (
                        <span
                          data-testid={`status-med-unsaved-${idx}`}
                          className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-extrabold text-amber-600"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Unsaved
                        </span>
                      )}
                      <button
                        type="button"
                        data-testid={`button-meds-remove-${med.id}`}
                        onClick={() => removeMed(med.id)}
                        disabled={busy}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {removingId === med.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                  <FormField label={<FieldLabel icon={<Pill size={16} />}>Medication name</FieldLabel>} required optionalLabel="Optional" requiredLabel="Needed">
                    <Input
                      data-testid={`input-med-name-${idx}`}
                      placeholder="e.g. Metformin"
                      value={med.name}
                      onFocus={() =>
                        setMedicationVoiceGuidance({
                          voiceStatus: "listening",
                          currentPrompt: t(
                            "onboarding.medications.voiceGuidance.namePrompt",
                            "Type or say the medication name. The name is enough to save.",
                          ),
                          activeTargetId: idx === 0 ? MEDICATION_COMPANION_TARGETS.firstMedication : `medications-medication-${idx + 1}`,
                        })
                      }
                      onChange={(e) => updateMed(med.id, "name", e.target.value)}
                      className={inputClassName}
                    />
                  </FormField>
                  <ResponsiveGrid columns="two" gap="lg">
                    <FormField label={<FieldLabel icon={<Sparkles size={16} />}>Dosage</FieldLabel>} hint="Strength or amount, if you know it.">
                      <Input
                        data-testid={`input-med-dosage-${idx}`}
                        placeholder="e.g. 500mg"
                        value={med.dosage}
                        onFocus={() =>
                          setMedicationVoiceGuidance({
                            voiceStatus: "listening",
                            currentPrompt: t(
                              "onboarding.medications.voiceGuidance.dosagePrompt",
                              "Add the strength only if you know it.",
                            ),
                            activeTargetId: idx === 0 ? MEDICATION_COMPANION_TARGETS.firstMedication : `medications-medication-${idx + 1}`,
                          })
                        }
                        onChange={(e) => updateMed(med.id, "dosage", e.target.value)}
                        className={inputClassName}
                      />
                    </FormField>
                    <FormField label={<FieldLabel icon={<Clock3 size={16} />}>Time or routine</FieldLabel>} hint="Examples: morning and evening, bedtime, or 08:00, 20:00.">
                      <OnboardingCompanionTarget targetId={MEDICATION_COMPANION_TARGETS.routine}>
                        <SeniorChoiceChips
                          options={TIME_PRESETS}
                          value={med.times}
                          onChange={(value) => updateTimePreset(med.id, value)}
                          testIdPrefix={`chip-med-time-${idx}`}
                        />
                        <Input
                          data-testid={`input-med-times-${idx}`}
                          placeholder="Morning and evening"
                          value={med.times}
                          onFocus={() =>
                            setMedicationVoiceGuidance({
                              voiceStatus: "listening",
                              currentPrompt: t(
                                "onboarding.medications.voiceGuidance.routinePrompt",
                                "Choose a routine, or type the usual time.",
                              ),
                              activeTargetId: MEDICATION_COMPANION_TARGETS.routine,
                            })
                          }
                          onChange={(e) => updateMed(med.id, "times", e.target.value)}
                          className={inputClassName}
                        />
                      </OnboardingCompanionTarget>
                    </FormField>
                  </ResponsiveGrid>
                  <div className="rounded-[24px] border border-[#EDE2F8] bg-[#FBF8FF] p-4">
                    <button
                      type="button"
                      data-testid={`button-meds-details-${med.id}`}
                      onClick={() => toggleDetails(med.id)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <span>
                        <span className="block text-[17px] font-black text-vyva-text-1">More details</span>
                        <span className="sr-only">
                          Add frequency, food notes, or prescriber only if useful.
                        </span>
                      </span>
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-vyva-purple shadow-sm">
                        {detailsOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                      </span>
                    </button>
                    {detailsOpen ? (
                      <div className="mt-5 flex flex-col gap-5">
                        <FormField label={<FieldLabel icon={<Clock3 size={16} />}>Frequency</FieldLabel>} hint={showCustomFrequency ? "Type it in your own words." : "Choose the closest option."}>
                          <SeniorChoiceChips
                            options={FREQUENCY_OPTIONS}
                            value={showCustomFrequency ? "other" : med.frequency}
                            onChange={(value) => updateFrequency(med.id, value)}
                            testIdPrefix={`chip-med-frequency-${idx}`}
                          />
                          {showCustomFrequency && (
                            <Input
                              data-testid={`input-med-frequency-other-${idx}`}
                              placeholder="Type frequency"
                              value={customFrequencyDisplayValue(med.frequency)}
                              onChange={(e) => updateMed(med.id, "frequency", e.target.value)}
                              className={inputClassName}
                            />
                          )}
                        </FormField>
                        <FormField label={<FieldLabel icon={<Utensils size={16} />}>With food?</FieldLabel>}>
                          <SeniorChoiceChips
                            options={FOOD_OPTIONS}
                            value={med.with_food}
                            onChange={(value) => updateMed(med.id, "with_food", value)}
                            testIdPrefix={`chip-med-food-${idx}`}
                          />
                        </FormField>
                        <FormField label={<FieldLabel icon={<Stethoscope size={16} />}>Prescribed by</FieldLabel>} hint="Optional, but helpful for future reports.">
                          <Input data-testid={`input-med-prescribed-${idx}`} placeholder="GP, specialist, or clinic name" value={med.prescribed_by} onChange={(e) => updateMed(med.id, "prescribed_by", e.target.value)} className={inputClassName} />
                        </FormField>
                      </div>
                    ) : null}
                  </div>
                  {saved && !dirty && hasName ? (
                    <button
                      type="button"
                      data-testid={`button-meds-collapse-${med.id}`}
                      onClick={() => collapseMed(med.id)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#E7DCF8] bg-white px-5 text-[15px] font-black text-vyva-purple shadow-sm"
                    >
                      <CheckCircle2 size={17} />
                      Show as summary
                    </button>
                  ) : null}
                    </>
                  )}
                </OnboardingCompanionTarget>
              );
            })}

            <OnboardingCompanionTarget targetId={MEDICATION_COMPANION_TARGETS.addAnother}>
              <button
                type="button"
                data-testid="button-meds-add"
                onFocus={() =>
                  setMedicationVoiceGuidance({
                    voiceStatus: "listening",
                    currentPrompt: t(
                      "onboarding.medications.voiceGuidance.addAnotherPrompt",
                      "Add another medication only if there is another current medicine.",
                    ),
                    activeTargetId: MEDICATION_COMPANION_TARGETS.addAnother,
                  })
                }
                onClick={addMed}
                disabled={busy || isLoading}
                className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-vyva-purple/40 bg-white text-[17px] font-black text-[#6b21a8] shadow-[0_12px_26px_rgba(53,28,87,0.06)] disabled:opacity-40"
              >
                {adding ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {adding ? "Adding..." : "Add another medication"}
              </button>
            </OnboardingCompanionTarget>
          </>
        )}

        <OnboardingCompanionTarget targetId={MEDICATION_COMPANION_TARGETS.reviewSave}>
          <ProfileCompletionBar
            saving={saving || autoSaving}
            onSave={handleSave}
            disabled={adding || !!removingId || isLoading || !hasMedicationSectionContent}
            saveLabel={t("onboarding.medications.saveContinue", "Save and continue")}
            savingLabel={t("onboarding.medications.saving", "Saving...")}
            helper={t("onboarding.profileSetup.changeLater", "You can change this later.")}
            skipLabel={t("onboarding.medications.skip", "Skip for now")}
            onSkip={() => confirmNavigation("/onboarding/profile")}
            testId="button-meds-save"
          />
        </OnboardingCompanionTarget>
      </div>

      <VoiceMedsModal
        open={voiceModalOpen}
        onOpenChange={setVoiceModalOpen}
        onAddMedication={addMedFromVoice}
      />
    </PhoneFrame>
  );
}
