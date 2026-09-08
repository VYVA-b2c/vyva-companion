// src/pages/onboarding/sections/ConditionsSection.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, CheckCircle2, ChevronDown, ChevronRight, HeartPulse, Home, Mic, PersonStanding, Search, X } from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { OnboardingCompanionTarget } from "@/components/onboarding/OnboardingCompanionTarget";
import { ProfileVoiceDraftReview } from "@/components/onboarding/ProfileVoiceDraftReview";
import { useOnboardingAgent } from "@/components/onboarding/useOnboardingAgent";
import { createProfileOnboardingAgentSectionConfig } from "@/components/onboarding/profileOnboardingAgentSections";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { ProfileQuestionLayout } from "@/components/onboarding/ProfileQuestionLayout";
import { ProfileCompletionBar } from "@/components/onboarding/ProfileSectionControls";
import { SeniorChoiceChips, type SeniorChoiceOption } from "@/components/onboarding/SeniorChoiceChips";
import SpeakItOverlay from "@/components/onboarding/SpeakItOverlay";
import { useOptionalVyvaVoice } from "@/hooks/useVyvaVoice";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { useTranslation } from "react-i18next";
import { getLanguageSnapshot } from "@/i18n";
import type { ProfileVoiceDraft } from "@/lib/profileVoiceCompletion";
import {
  onboardingVoiceUiStateContextUpdate,
} from "@/lib/onboardingVoiceUiState";
import {
  createOnboardingElevenLabsRuntimeStartRequest,
  subscribeOnboardingElevenLabsRuntimeEvents,
} from "@/lib/onboardingElevenLabsRuntimeAdapter";
import { buildHealthOnboardingVoiceUiState } from "./conditionsVoiceUiState";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "heart",       label: "Heart & circulation" },
  { id: "metabolic",   label: "Metabolic & hormonal" },
  { id: "respiratory", label: "Respiratory" },
  { id: "musculo",     label: "Joints, bones & muscles" },
  { id: "neuro",       label: "Neurological" },
  { id: "mental",      label: "Mental health" },
  { id: "cancer",      label: "Cancer & oncology" },
  { id: "kidney",      label: "Kidney & urinary" },
  { id: "digestive",   label: "Digestive & gut" },
  { id: "sensory",     label: "Sensory & skin" },
  { id: "other",       label: "Other" },
];

const CONDITION_GROUPS: { cat: string; items: string[] }[] = [
  { cat: "heart",      items: ["Hypertension","High cholesterol","Heart failure","Atrial fibrillation","Coronary artery disease","Heart attack (history)","Stroke (history)","Pacemaker / ICD","Deep vein thrombosis","Peripheral artery disease","Anaemia"] },
  { cat: "metabolic",  items: ["Diabetes Type 1","Diabetes Type 2","Pre-diabetes","Hypothyroidism","Hyperthyroidism","Osteoporosis","Vitamin D deficiency","Gout","Obesity","Metabolic syndrome"] },
  { cat: "respiratory",items: ["COPD","Asthma","Sleep apnoea","Pulmonary fibrosis","Chronic bronchitis","Emphysema","Pleural effusion"] },
  { cat: "musculo",    items: ["Osteoarthritis","Rheumatoid arthritis","Psoriatic arthritis","Fibromyalgia","Back pain (chronic)","Hip replacement","Knee replacement","Spinal stenosis","Muscle weakness","Lupus"] },
  { cat: "neuro",      items: ["Dementia","Alzheimer's","Parkinson's disease","Epilepsy","Multiple sclerosis","Peripheral neuropathy","Tremors","Migraine (chronic)","Motor neurone disease","Balance disorder"] },
  { cat: "mental",     items: ["Depression","Anxiety","Bipolar disorder","PTSD","OCD","Loneliness / isolation","Grief / bereavement","Sleep disorder / insomnia"] },
  { cat: "cancer",     items: ["Active cancer treatment","Cancer - in remission","Cancer - monitoring","Post-surgical recovery","Lymphoedema"] },
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

const MOBILITY_CHOICES: SeniorChoiceOption[] = [
  { value: "independent", label: "Independent", description: "No aids needed", icon: <PersonStanding size={17} /> },
  { value: "stick_or_frame", label: "Stick or frame", icon: <PersonStanding size={17} /> },
  { value: "wheelchair_part_time", label: "Wheelchair sometimes", description: "For longer distances", icon: <BadgeCheck size={17} /> },
  { value: "wheelchair_full_time", label: "Wheelchair daily", description: "Primary way to move", icon: <BadgeCheck size={17} /> },
  { value: "housebound", label: "Mostly at home", description: "Needs help to leave home", icon: <Home size={17} /> },
];

const LIVING_CHOICES: SeniorChoiceOption[] = [
  { value: "alone", label: "Lives alone", icon: <Home size={17} /> },
  { value: "with_partner", label: "With partner", icon: <Home size={17} /> },
  { value: "with_family", label: "With family", icon: <Home size={17} /> },
  { value: "care_home", label: "Care home", icon: <BadgeCheck size={17} /> },
];

type SavedCondition = { name: string; category: string };

export default function ConditionsSection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();
  const vyvaVoice = useOptionalVyvaVoice();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [noKnownConditions, setNoKnownConditions] = useState(false);
  const [mobility, setMobility] = useState("");
  const [living, setLiving] = useState("");
  const [saving, setSaving] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [speakItOpen, setSpeakItOpen] = useState(false);
  const [speakItMatches, setSpeakItMatches] = useState<string[]>([]);
  const [elevenLabsDraft, setElevenLabsDraft] = useState<ProfileVoiceDraft | null>(null);
  const selectedRef = useRef<string[]>([]);
  const elevenLabsDraftIdRef = useRef<string | undefined>(undefined);
  const [showDailyLifeContext, setShowDailyLifeContext] = useState(false);
  const {
    mode: companionMode,
    setMode: setCompanionMode,
    setGuidance,
    clearGuidance,
    registerVoiceAction,
  } = useOnboardingAgent();
  const healthAgentSectionConfig = useMemo(
    () =>
      createProfileOnboardingAgentSectionConfig({
        sectionId: "health",
        sectionLabel: t("onboarding.conditions.title", "Health profile"),
        voicePrompt: t(
          "onboarding.conditions.voiceGuidance.speakPrompt",
          "Tell VYVA one or more health conditions.",
        ),
        expectedFields: ["conditions", "mobility", "living_situation"],
        draftRowLabels: {
          condition: t("onboarding.conditions.voiceDraft.conditionLabel", "Condition"),
        },
        targetIds: {
          addByVoice: "health-add-by-voice",
          draftReview: "health-speak-confirm",
          reviewSave: "health-review-save",
        },
      }),
    [t],
  );

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    elevenLabsDraftIdRef.current = elevenLabsDraft?.id;
  }, [elevenLabsDraft?.id]);

  const setVoiceGuidance = useCallback((
    guidance: Parameters<typeof setGuidance>[0],
  ) => {
    if (companionMode !== "voice") return;
    setGuidance(guidance);
  }, [companionMode, setGuidance]);

  useEffect(
    () =>
      subscribeOnboardingElevenLabsRuntimeEvents(healthAgentSectionConfig.sectionId, (event) => {
        if (event.type === "draft") {
          setSpeakItOpen(false);
          setSpeakItMatches([]);
          setElevenLabsDraft(event.draft);
          vyvaVoice?.sendContextUpdate(onboardingVoiceUiStateContextUpdate({
            ...buildHealthOnboardingVoiceUiState({
              sectionConfig: healthAgentSectionConfig,
              selectedCount: event.draft.values.length || event.draft.rows.length,
              noKnownConditions: false,
              reviewCardVisible: true,
            }),
            selectedCount: event.draft.values.length || event.draft.rows.length,
          }));
          setVoiceGuidance({
            voiceStatus: "thinking",
            draftStatus: "parsed-draft",
            currentSectionId: event.sectionId,
            currentSectionLabel: healthAgentSectionConfig.sectionLabel,
            currentPrompt: healthAgentSectionConfig.voicePrompt,
            activeTargetId: healthAgentSectionConfig.targetIds?.draftReview,
          });
          return;
        }

        if (event.type === "clarification") {
          setVoiceGuidance({
            voiceStatus: "speaking",
            draftStatus: "needs-clarification",
            currentSectionId: event.sectionId,
            currentSectionLabel: healthAgentSectionConfig.sectionLabel,
            currentPrompt: event.question,
            activeTargetId: healthAgentSectionConfig.targetIds?.addByVoice,
          });
          return;
        }

        if (event.type === "status") {
          setVoiceGuidance({
            voiceStatus: event.voiceStatus,
            draftStatus: event.voiceStatus === "error" ? "needs-clarification" : "listening",
            currentSectionId: event.sectionId,
            currentSectionLabel: healthAgentSectionConfig.sectionLabel,
            currentPrompt: event.message ?? healthAgentSectionConfig.voicePrompt,
            activeTargetId: healthAgentSectionConfig.targetIds?.addByVoice,
          });
        }
      }),
    [healthAgentSectionConfig, setVoiceGuidance, vyvaVoice],
  );

  useEffect(() => {
    if (companionMode !== "voice") {
      clearGuidance();
      return;
    }

    setGuidance({
      voiceStatus: "idle",
      draftStatus: "idle",
      currentSectionId: healthAgentSectionConfig.sectionId,
      currentSectionLabel: healthAgentSectionConfig.sectionLabel,
      currentPrompt: t(
        "onboarding.conditions.voiceGuidance.startPrompt",
        "Tell VYVA, search by name, or choose no known conditions.",
      ),
      activeTargetId: healthAgentSectionConfig.targetIds?.addByVoice,
    });

    return () => clearGuidance();
  }, [clearGuidance, companionMode, healthAgentSectionConfig, setGuidance, t]);

  const buildConditionsPayload = () => ({
    health_conditions: selected,
    conditions: selected.map((name) => {
      const group = CONDITION_GROUPS.find((g) => g.items.includes(name));
      return { name, category: group?.cat || "other" };
    }),
    mobility_level: mobility || null,
    living_situation: living || null,
    allergies: [],
    no_known_conditions: noKnownConditions && selected.length === 0,
  });

  const completePath = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo
      ? `/onboarding/complete/conditions?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/complete/conditions";
  };

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const savedFading = false;
  const retryCountdown = null;
  const retryNow = () => undefined;
  const cancelAutoSave = () => undefined;

  const { data, isLoading } = useQuery<{
    profile: { conditions?: SavedCondition[]; mobility_level?: string; living_situation?: string; no_known_conditions?: boolean } | null;
  }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    const p = data?.profile as { conditions?: SavedCondition[]; mobility_level?: string; living_situation?: string } | null;
    if (p) {
      if (p.conditions) setSelected(p.conditions.map((c) => c.name));
      if (p.mobility_level) setMobility(p.mobility_level);
      if (p.living_situation) setLiving(p.living_situation);
      setNoKnownConditions(Boolean(p.no_known_conditions) && (!p.conditions || p.conditions.length === 0));
    }
  }, [data]);

  const toggleCondition = (name: string) => {
    setNoKnownConditions(false);
    setSelected((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
    setVoiceGuidance({
      voiceStatus: "thinking",
      draftStatus: "confirmed-locally",
      currentPrompt: t(
        "onboarding.conditions.voiceGuidance.reviewPrompt",
        "Review your selected conditions, then save when ready.",
      ),
      lastHeardText: t("onboarding.conditions.voiceGuidance.selected", {
        name,
        defaultValue: `Selected ${name}`,
      }),
      activeTargetId: healthAgentSectionConfig.targetIds?.reviewSave,
    });
  };

  const removeSelected = (name: string) => {
    setSelected((prev) => prev.filter((x) => x !== name));
  };

  const toggleNoKnownConditions = () => {
    const next = !noKnownConditions;
    setNoKnownConditions(next);
    if (next) {
      setSelected([]);
      setSearch("");
      setSpeakItMatches([]);
    }
    setVoiceGuidance({
      voiceStatus: "thinking",
      draftStatus: "confirmed-locally",
      currentPrompt: t(
        "onboarding.conditions.voiceGuidance.noKnownPrompt",
        "No known conditions is selected. Save when you are ready.",
      ),
      lastHeardText: next
        ? t(
            "onboarding.conditions.voiceGuidance.noKnownSelected",
            "Selected no known conditions",
          )
        : undefined,
      activeTargetId: healthAgentSectionConfig.targetIds?.reviewSave,
    });
  };

  const handleMobility = (value: string) => { setMobility(value); };
  const handleLiving   = (value: string) => { setLiving(value); };
  const hasHealthSectionContent = selected.length > 0 || Boolean(mobility) || Boolean(living) || noKnownConditions;
  const mobilityLabel = MOBILITY_CHOICES.find((option) => option.value === mobility)?.label;
  const livingLabel = LIVING_CHOICES.find((option) => option.value === living)?.label;
  const dailyLifeSummary = [mobilityLabel, livingLabel].filter(Boolean).join(" / ");

  const handleSpeakItDone = (transcript: string) => {
    setSpeakItOpen(false);
    if (!transcript) return;
    const matches = matchConditionsFromTranscript(transcript);
    if (matches.length === 0) {
      setVoiceGuidance({
        voiceStatus: "error",
        draftStatus: "needs-clarification",
        currentPrompt: t(
          "onboarding.conditions.voiceGuidance.tryAgainPrompt",
          "Try speaking again, search by name, or choose manually.",
        ),
        error: t(
          "onboarding.conditions.voiceGuidance.noMatch",
          "No condition was recognised.",
        ),
        activeTargetId: healthAgentSectionConfig.targetIds?.addByVoice,
      });
      toast({ title: "No conditions recognised", description: "Try speaking more slowly or select conditions manually below." });
      return;
    }
    setSpeakItMatches(matches);
    setVoiceGuidance({
      voiceStatus: "thinking",
      draftStatus: "parsed-draft",
      currentPrompt: t(
        "onboarding.conditions.voiceGuidance.confirmMatchesPrompt",
        "Review what VYVA heard, then add these if correct.",
      ),
      lastHeardText: t("onboarding.conditions.voiceGuidance.heardConditions", {
        conditions: matches.join(", "),
        defaultValue: `Heard: ${matches.join(", ")}`,
      }),
      activeTargetId: healthAgentSectionConfig.targetIds?.draftReview,
    });
  };

  const startVoiceConditionCapture = useCallback(async () => {
    const reviewVisible = Boolean(elevenLabsDraftIdRef.current);
    const selectedCount = selectedRef.current.length;
    const healthUiState = buildHealthOnboardingVoiceUiState({
      sectionConfig: healthAgentSectionConfig,
      selectedCount,
      noKnownConditions,
      reviewCardVisible: reviewVisible,
    });
    const guidance = {
      voiceStatus: "listening",
      draftStatus: "listening",
      currentSectionId: healthAgentSectionConfig.sectionId,
      currentSectionLabel: healthAgentSectionConfig.sectionLabel,
      currentPrompt: healthAgentSectionConfig.voicePrompt,
      activeTargetId: healthAgentSectionConfig.targetIds?.addByVoice,
    } as const;
    if (companionMode === "voice") {
      setGuidance(guidance);
    } else {
      setCompanionMode("voice");
      window.setTimeout(() => setGuidance(guidance), 0);
    }
    setSpeakItMatches([]);
    setSpeakItOpen(true);
    if (vyvaVoice) {
      const startRequest = createOnboardingElevenLabsRuntimeStartRequest({
        sectionConfig: healthAgentSectionConfig,
        language: getLanguageSnapshot().language,
        mode: "voice",
        existingProfileSummary: selectedRef.current.length
          ? `Current health conditions selected in app: ${selectedRef.current.join(", ")}`
          : undefined,
        activeDraftId: elevenLabsDraftIdRef.current,
        uiState: healthUiState,
      });
      void vyvaVoice.startVoice(
        startRequest.contextHint,
        startRequest.systemPrompt,
        { ...startRequest.options, forceRestart: true },
      ).catch(() => {
        setVoiceGuidance({
          voiceStatus: "listening",
          draftStatus: "listening",
          currentPrompt: healthAgentSectionConfig.voicePrompt,
          activeTargetId: healthAgentSectionConfig.targetIds?.addByVoice,
        });
      });
    }
  }, [companionMode, healthAgentSectionConfig, noKnownConditions, setCompanionMode, setGuidance, setVoiceGuidance, vyvaVoice]);

  useEffect(
    () =>
      registerVoiceAction({
        id: "profile-health-voice-capture",
        label: t("onboarding.conditions.tellVyva", "Tell VYVA"),
        description: t(
          "onboarding.conditions.tellVyvaDescription",
          "Say one or more health conditions.",
        ),
        sectionId: "health",
        sectionLabel: healthAgentSectionConfig.sectionLabel,
        targetId: healthAgentSectionConfig.targetIds?.addByVoice,
        sectionConfig: healthAgentSectionConfig,
        onStart: startVoiceConditionCapture,
      }),
    [healthAgentSectionConfig, registerVoiceAction, startVoiceConditionCapture, t],
  );

  const confirmSpeakItMatches = () => {
    const newSelected = Array.from(new Set([...selected, ...speakItMatches]));
    const addedNames = speakItMatches.join(", ");
    setNoKnownConditions(false);
    setSelected(newSelected);
    setSpeakItMatches([]);
    setVoiceGuidance({
      voiceStatus: "speaking",
      draftStatus: "confirmed-locally",
      currentPrompt: t(
        "onboarding.conditions.voiceGuidance.reviewPrompt",
        "Review your selected conditions, then save when ready.",
      ),
      lastHeardText: t("onboarding.conditions.voiceGuidance.addedConditions", {
        conditions: addedNames,
        defaultValue: `Added: ${addedNames}`,
      }),
      activeTargetId: healthAgentSectionConfig.targetIds?.reviewSave,
    });
    toast({
      title: t("onboarding.toast.healthConditionsUpdated.title", "Health conditions updated"),
      description: t("onboarding.toast.healthConditionsUpdated.description", {
        count: speakItMatches.length,
        defaultValue: "{{count}} condition was added to your profile.",
      }),
    });
  };

  const confirmElevenLabsDraft = () => {
    if (!elevenLabsDraft) return;
    const values = elevenLabsDraft.values.length
      ? elevenLabsDraft.values
      : elevenLabsDraft.rows.map((row) => row.value);
    const newSelected = Array.from(new Set([...selected, ...values]));
    setNoKnownConditions(false);
    setSelected(newSelected);
    setElevenLabsDraft(null);
    vyvaVoice?.sendContextUpdate(onboardingVoiceUiStateContextUpdate({
      pagePath: "/onboarding/profile/health",
      sectionId: "health",
      sectionLabel: healthAgentSectionConfig.sectionLabel,
      phase: "confirmed-locally",
      visibleTask: "The draft has been added locally; the user must press Save and continue to persist it.",
      missingFields: [],
      reviewCardVisible: false,
      allowedActions: ["press_save_button", "switch_mode"],
      forbiddenActions: [
        "ask_account_id",
        "ask_profile_id",
        "ask_user_id",
        "navigate_away",
        "save_without_button_press",
        "external_action",
      ],
      suggestedPrompt: "Tell the user the conditions are added locally and they should press Save and continue when ready.",
      activeTargetId: healthAgentSectionConfig.targetIds?.reviewSave,
      selectedCount: newSelected.length,
      visibleDataSummary: `${newSelected.length} health condition${newSelected.length === 1 ? "" : "s"} selected in the app.`,
    }));
    setVoiceGuidance({
      voiceStatus: "speaking",
      draftStatus: "confirmed-locally",
      currentPrompt: t(
        "onboarding.conditions.voiceGuidance.reviewPrompt",
        "Review your selected conditions, then save when ready.",
      ),
      lastHeardText: t("onboarding.conditions.voiceGuidance.addedConditions", {
        conditions: values.join(", "),
        defaultValue: `Added: ${values.join(", ")}`,
      }),
      activeTargetId: healthAgentSectionConfig.targetIds?.reviewSave,
    });
    toast({
      title: t("onboarding.toast.healthConditionsUpdated.title", "Health conditions updated"),
      description: t("onboarding.toast.healthConditionsUpdated.description", {
        count: values.length,
        defaultValue: "{{count}} condition was added to your profile.",
      }),
    });
  };

  const speakItDraft: ProfileVoiceDraft | null = speakItMatches.length > 0
    ? {
        id: `health:${speakItMatches.join("|").toLowerCase()}`,
        section: "health",
        kind: "health-conditions",
        title: t("onboarding.conditions.voiceDraft.title", "Review health conditions"),
        helper: t(
          "onboarding.conditions.voiceDraft.helper",
          "VYVA found these from what you said. Add them only if they look right.",
        ),
        values: speakItMatches,
        rows: speakItMatches.map((name) => ({
          id: name.toLowerCase().replace(/\s+/g, "-"),
          label: t("onboarding.conditions.voiceDraft.rowLabel", "Condition"),
          value: name,
        })),
      }
    : null;

  const toggleCat = (catId: string) => {
    setOpenCat((prev) => (prev === catId ? null : catId));
  };

  const normalizedSearch = search.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;
  const hasSearchMatches = CONDITION_GROUPS.some((group) =>
    group.items.some((item) => item.toLowerCase().includes(normalizedSearch)),
  );

  const handleSave = async () => {
    if (saving) return;
    cancelAutoSave();
    setSaving(true);
    let navigating = false;
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/conditions", {
        method: "POST",
        body: JSON.stringify(buildConditionsPayload()),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/personalisation"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/profile/readiness"] });
        setAutoSaveStatus("saved");
        setVoiceGuidance({ voiceStatus: "idle", draftStatus: "saved" });
        navigating = true;
      navTimerRef.current = setTimeout(() => navigate(completePath()), 300);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save health conditions", description: msg, variant: "destructive" });
    } finally {
      if (!navigating) setSaving(false);
    }
  };

  return (
    <PhoneFrame subtitle="Health conditions" showBack onBack={() => navigate("/onboarding/profile")} homeMasterBackPath="/dev/home-master/profile" showAllSections onAllSections={() => navigate("/onboarding/profile")}>
      <div className="flex flex-col gap-5 px-1 pb-6 pt-4 sm:px-2 md:px-3">
        <ProfileSectionHero
          compact
          icon={HeartPulse}
          title={t("onboarding.conditions.title", "Tell us about your health")}
          kicker="A quick question"
          description={t(
            "onboarding.conditions.description",
            "Pick what fits. You can change it anytime.",
          )}
          iconBgClassName="bg-[#B0355A]"
          className="!rounded-[22px] !p-4 [&_h2]:!text-[30px] sm:!p-5 sm:[&_h2]:!text-[34px] [&_p]:!text-[16px]"
          autoSave={{ autoSaveStatus, savedFading, retryCountdown, onRetryNow: retryNow, testId: "status-conditions-autosave" }}
        />

        {companionMode !== "voice" ? (
          <OnboardingCompanionTarget targetId="health-add-by-voice">
            <button
              type="button"
              data-testid="button-conditions-speak-it"
              onClick={startVoiceConditionCapture}
              className={cn(
                "group flex min-h-[72px] w-full items-center gap-3.5 rounded-[20px] border border-[#DCC8FF] bg-white px-4 py-3 text-left text-vyva-purple shadow-[0_8px_18px_rgba(53,28,87,0.06)] transition hover:bg-[#F8F3FF] focus:outline-none focus:ring-4 focus:ring-vyva-purple/20",
              )}
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F3E8FF]">
                <Mic size={20} className="text-vyva-purple" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[18px] font-black leading-tight text-vyva-purple">
                  {t("onboarding.conditions.tellVyva", "Tell VYVA")}
                </p>
                <p className="sr-only">
                  {t(
                    "onboarding.conditions.tellVyvaDescription",
                    "Say one or more health conditions.",
                  )}
                </p>
              </div>
              <ChevronRight
                size={22}
                className="shrink-0 text-vyva-purple/65 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </OnboardingCompanionTarget>
        ) : null}

        {/* Speak-it confirmation */}
        {speakItDraft && (
          <OnboardingCompanionTarget targetId="health-speak-confirm">
            <ProfileVoiceDraftReview
              draft={speakItDraft}
              confirmLabel={t("onboarding.conditions.voiceDraft.confirm", "Add these")}
              tryAgainLabel={t("onboarding.conditions.voiceDraft.tryAgain", "Try again")}
              dismissLabel={t("onboarding.conditions.voiceDraft.dismiss", "Dismiss")}
              onConfirm={confirmSpeakItMatches}
              onTryAgain={() => {
                setSpeakItMatches([]);
                startVoiceConditionCapture();
              }}
              onDismiss={() => setSpeakItMatches([])}
              onRemoveRow={(value) =>
                setSpeakItMatches((current) => current.filter((name) => name !== value))
              }
              testId="panel-conditions-speak-it-confirm"
            />
          </OnboardingCompanionTarget>
        )}

        {elevenLabsDraft && (
          <OnboardingCompanionTarget targetId="health-speak-confirm">
            <ProfileVoiceDraftReview
              draft={elevenLabsDraft}
              confirmLabel={t("onboarding.conditions.voiceDraft.confirm", "Add these")}
              tryAgainLabel={t("onboarding.conditions.voiceDraft.tryAgain", "Try again")}
              dismissLabel={t("onboarding.conditions.voiceDraft.dismiss", "Dismiss")}
              onConfirm={confirmElevenLabsDraft}
              onTryAgain={() => {
                setElevenLabsDraft(null);
                void startVoiceConditionCapture();
              }}
              onDismiss={() => setElevenLabsDraft(null)}
              onRemoveRow={(value) =>
                setElevenLabsDraft((current) => current
                  ? {
                      ...current,
                      rows: current.rows.filter((row) => row.value !== value),
                      values: current.values.filter((rowValue) => rowValue !== value),
                    }
                  : current)
              }
              testId="panel-conditions-elevenlabs-confirm"
            />
          </OnboardingCompanionTarget>
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
          <ProfileQuestionLayout
            eyebrow="One step at a time"
            title="What applies to you?"
            description="Search or choose a category."
            testId="profile-question-health-conditions"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-[18px] font-black text-vyva-text-1">Choose what fits</p>
              </div>
              {selected.length > 0 ? (
                <span className="shrink-0 rounded-full bg-[#F3E8FF] px-3 py-1.5 text-[13px] font-black text-vyva-purple">
                  {selected.length} selected
                </span>
              ) : null}
            </div>

            <div className="relative">
              <OnboardingCompanionTarget targetId="health-search">
                <div className="relative">
                  <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#766B66]" />
                  <input
                    data-testid="input-conditions-search"
                    aria-label="Search health conditions"
                    className="h-16 w-full rounded-[20px] border border-[#CBB5EC] bg-white pl-12 pr-12 text-[18px] font-semibold text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] placeholder:font-medium placeholder:text-[#766B66] focus:outline-none focus:ring-4 focus:ring-vyva-purple/15"
                    placeholder="Search conditions"
                    value={search}
                    onFocus={() =>
                      setVoiceGuidance({
                        voiceStatus: "listening",
                        currentPrompt: t(
                          "onboarding.conditions.voiceGuidance.searchPrompt",
                          "Search by condition name, or say the condition to VYVA.",
                        ),
                        activeTargetId: "health-search",
                      })
                    }
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setVoiceGuidance({
                        voiceStatus: "thinking",
                        currentPrompt: t(
                          "onboarding.conditions.voiceGuidance.searchPrompt",
                          "Search by condition name, or say the condition to VYVA.",
                        ),
                        activeTargetId: "health-search",
                      });
                    }}
                  />
                  {search ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[#766B66] hover:bg-[#F3E8FF] hover:text-vyva-purple"
                    >
                      <X size={18} />
                    </button>
                  ) : null}
                </div>
              </OnboardingCompanionTarget>
            </div>

            <OnboardingCompanionTarget targetId="health-no-known">
              <button
                type="button"
                aria-pressed={noKnownConditions}
                data-testid="button-conditions-no-known"
                onFocus={() =>
                  setVoiceGuidance({
                    voiceStatus: "listening",
                    currentPrompt: t(
                      "onboarding.conditions.voiceGuidance.noKnownQuestion",
                      "Choose this only if you have no known health conditions.",
                    ),
                    activeTargetId: "health-no-known",
                  })
                }
                onClick={toggleNoKnownConditions}
                className={cn(
                  "flex min-h-[72px] w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-vyva-purple/15",
                  noKnownConditions
                    ? "border-vyva-purple bg-[#F3E8FF] text-vyva-purple"
                    : "border-[#E4D9CF] bg-white text-vyva-text-1 hover:border-[#CBB5EC]",
                )}
              >
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                  noKnownConditions ? "border-vyva-purple bg-vyva-purple text-white" : "border-[#B9ADA5] text-transparent",
                )}>
                  <CheckCircle2 size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-[17px] font-black">None of these</span>
                  <span className="sr-only">I don&apos;t have any known conditions.</span>
                </span>
              </button>
            </OnboardingCompanionTarget>

            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-2 rounded-[18px] bg-[#F7F2FC] px-3 py-3" aria-label="Selected health conditions">
                {selected.map((name) => (
                  <span key={name} className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-vyva-purple px-3 py-1.5 text-[14px] font-black text-white">
                    {name}
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeSelected(name)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 opacity-90 hover:bg-white/25 hover:opacity-100"
                      data-testid={`button-remove-condition-${name.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {/* Accordion */}
            <div className="flex flex-col gap-2">
              {CONDITION_GROUPS.map((group) => {
                const cat = CATEGORIES.find((c) => c.id === group.cat)!;
                const visibleItems = isSearching
                  ? group.items.filter((i) => i.toLowerCase().includes(normalizedSearch))
                  : group.items;
                if (isSearching && visibleItems.length === 0) return null;

                const selectedCount = group.items.filter((i) => selected.includes(i)).length;
                const isOpen = isSearching || openCat === group.cat;
                const hasSelections = selectedCount > 0;

                return (
                  <div
                    key={group.cat}
                    className="overflow-hidden rounded-[22px] shadow-[0_10px_22px_rgba(53,28,87,0.04)]"
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
                      aria-expanded={isOpen}
                      className="grid min-h-[72px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-[#FBF8FF] focus:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/15"
                    >
                      <span className="min-w-0">
                        <span className="block font-body text-[18px] font-black leading-snug text-gray-800">{cat.label}</span>
                        {hasSelections && (
                          <span
                            className="mt-0.5 block text-[12px] font-bold text-vyva-purple"
                            data-testid={`badge-count-${group.cat}`}
                          >
                            {selectedCount} selected
                          </span>
                        )}
                      </span>
                      {!isSearching && (
                        <ChevronDown
                          size={16}
                          className="text-gray-400 transition-transform duration-200"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        />
                      )}
                    </button>

                    {/* Accordion body */}
                    <div
                      className="overflow-hidden transition-all duration-300 ease-in-out"
                      style={{ maxHeight: isOpen ? "2000px" : "0px" }}
                    >
                      <div className="grid grid-cols-1 gap-3 px-3 pb-4 min-[560px]:grid-cols-2">
                        {visibleItems.map((item) => {
                          const isSelected = selected.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              data-testid={`card-condition-${item.replace(/\s+/g, "-").toLowerCase()}`}
                              onClick={() => toggleCondition(item)}
                              className={cn(
                                "flex min-h-[68px] items-center gap-3 rounded-[18px] px-4 py-3 text-left transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/15",
                              )}
                              style={
                                isSelected
                                  ? { background: "#EDE9FE", border: "2px solid #A78BFA", boxShadow: "0 2px 8px rgba(107,33,168,0.12)" }
                                  : { background: "#FFFFFF", border: "1px solid #EDE5DB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }
                              }
                            >
                              <span
                                className="font-body text-[17px] font-bold leading-tight flex-1 min-w-0"
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

            {isSearching && !hasSearchMatches ? (
              <div className="rounded-[18px] border border-dashed border-[#CBB5EC] bg-[#FBF8FF] px-4 py-5 text-center" role="status">
                <p className="font-body text-[16px] font-black text-vyva-text-1">No matching conditions</p>
                <p className="mt-1 font-body text-[14px] font-semibold text-vyva-text-2">Try another word, or tell VYVA instead.</p>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[20px] border border-[#E4D9CF] bg-white">
              <button
                type="button"
                data-testid="button-conditions-daily-life"
                aria-expanded={showDailyLifeContext}
                onClick={() => setShowDailyLifeContext((current) => !current)}
                className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#FBF8F4] focus:outline-none focus:ring-4 focus:ring-inset focus:ring-vyva-purple/15"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-vyva-purple">
                  <PersonStanding size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-body text-[18px] font-black text-vyva-text-1">Anything else to share?</span>
                    <span className="rounded-full bg-[#F5F1EC] px-2 py-0.5 text-[11px] font-black uppercase text-vyva-text-2">
                      Optional
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-body text-[13px] font-semibold text-vyva-text-2">
                    {dailyLifeSummary || "Optional context for your support"}
                  </span>
                </span>
                <ChevronDown
                  size={20}
                  className={cn("shrink-0 text-vyva-text-2 transition-transform", showDailyLifeContext && "rotate-180")}
                  aria-hidden="true"
                />
              </button>

              {showDailyLifeContext ? (
                <div className="border-t border-[#E4D9CF] bg-[#FBF8F4] p-4 sm:p-5">
                  <div>
                    <p className="mb-3 text-[15px] font-extrabold text-gray-700">Mobility</p>
                    <SeniorChoiceChips
                      options={MOBILITY_CHOICES}
                      value={mobility}
                      onChange={handleMobility}
                      testIdPrefix="button-mobility"
                    />
                  </div>

                  <div className="mt-5 border-t border-[#E4D9CF] pt-5">
                    <p className="mb-3 text-[15px] font-extrabold text-gray-700">Living situation</p>
                    <SeniorChoiceChips
                      options={LIVING_CHOICES}
                      value={living}
                      onChange={handleLiving}
                      testIdPrefix="button-living"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </ProfileQuestionLayout>
        )}

        <OnboardingCompanionTarget targetId="health-review-save">
          <ProfileCompletionBar
            saving={saving}
            onSave={handleSave}
            disabled={isLoading || !hasHealthSectionContent}
            saveLabel={t("onboarding.conditions.saveContinue", "Save and continue")}
            savingLabel={t("onboarding.conditions.saving", "Saving...")}
            helper={t("onboarding.profileSetup.changeLater", "You can change this later.")}
            skipLabel={t("onboarding.conditions.skip", "Skip for now")}
            onSkip={() => navigate("/onboarding/profile")}
            testId="button-conditions-save"
          />
        </OnboardingCompanionTarget>

      </div>
    </PhoneFrame>
  );
}
