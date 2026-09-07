import { Router } from "express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import cron from "node-cron";
import { pool } from "../db.js";
import { requireActiveProfileId } from "../lib/profileAccess.js";
import { isRelationSchemaUnavailableError } from "../lib/dbCompatibility.js";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HERO_MODEL = process.env.HEALTH_INSIGHTS_HERO_MODEL ?? "claude-sonnet-4-20250514";
const SYNTHESIS_MODEL = process.env.HEALTH_INSIGHTS_SYNTHESIS_MODEL ?? "claude-sonnet-4-20250514";

type ReportType = "weekly" | "monthly";
type DeliveredSurface = "caregiver_dashboard" | "senior_card" | "smart_nudge" | "agewell_plan";
type ActionOutcome = "done" | "hard" | "skip";

type HealthInsightReport = {
  id: string;
  user_id: string;
  report_type: ReportType;
  generated_at: Date;
  period_start: Date;
  period_end: Date;
  severity_tier: number;
  confidence: string | number;
  source_signals: Record<string, unknown>;
  vitals_summary: Record<string, unknown> | null;
  medication_summary: Record<string, unknown> | null;
  cognitive_summary: Record<string, unknown> | null;
  mood_summary: Record<string, unknown> | null;
  symptom_summary: Record<string, unknown> | null;
  concierge_summary: Record<string, unknown> | null;
  correlation_flags: CorrelationFlag[];
  synthesized_recommendation_caregiver: string | null;
  synthesized_recommendation_senior: string | null;
  focus_domain: string | null;
  recommend_clinician: boolean;
  status: string;
};

type ProfileSummary = {
  first_name: string;
  language_preference: string;
  timezone: string;
  full_name?: string | null;
};

type AgeWellAction = {
  id: string;
  category: string;
  label: string;
  description: string;
  destination_type: string;
  destination_path: string | null;
  condition_tags: string[];
  tier_min: number;
};

type DailyContentType = "exercise" | "meal" | "tip" | "article" | "supplement" | "natural_solution";
type DailyContentRow = {
  id: string;
  content_type: DailyContentType;
  title: string;
  description: string;
  detail_text: string | null;
  timing_guidance: string | null;
  source_label: string | null;
  source_url: string | null;
  condition_tags: string[];
  pillar_tag: PreventionPillar | null;
  time_of_day: string | null;
  language: string;
  rotation_weight: number;
  moment?: string | null;
  program_key?: string | null;
  resource_title?: string | null;
  duration_seconds?: number | null;
  evidence_tags?: string[] | null;
  safety_notes?: string | null;
  mobility_fit?: string | null;
  region_fit?: string | null;
  review_status?: string | null;
};

type PreventionRefreshTrigger =
  | "symptom_logged"
  | "vitals_deviation"
  | "adherence_drop"
  | "cognitive_drop"
  | "mood_decline"
  | "user_requested"
  | "scheduled";

type RealtimeSignals = {
  tierRaise: number;
  urgentFlags: string[];
};

type DomainTiers = Record<string, number>;

type CorrelationFlag = {
  rule: string;
  fired: boolean;
  domains: string[];
  severity: number;
};

type SummaryMap = Record<string, unknown> | null;

type SynthesisInput = {
  vitals: SummaryMap;
  meds: SummaryMap;
  cognitive: SummaryMap;
  mood: SummaryMap;
  symptoms: SummaryMap;
  concierge: SummaryMap;
};

type ConditionProfile = {
  weighted_domains: Record<string, number>;
  framing_note: string;
  escalation_sensitivity: number;
};

type PendingOutcome = {
  id: string;
  user_id: string;
  report_id: string | null;
  action_id: string | null;
  tier_at_generation: number;
  delivered_surface: DeliveredSurface;
};

type PreventionPillar = "heart" | "brain" | "strength" | "nourishment" | "calm";
type PreventionPillarStatus = "thriving" | "steady" | "needs_attention" | "priority_focus";
type PreventionPillarScores = Record<PreventionPillar, PreventionPillarStatus>;
type PreventionRecommendation = { action: string; why: string };
type PreventionRecommendations = Record<PreventionPillar, PreventionRecommendation[]>;
type CrossPillarPattern = {
  pattern: string;
  fired: boolean;
  severity: "needs_attention" | "priority_focus";
  pillars_affected: PreventionPillar[];
};

type LongevityPreventionPlan = {
  id: string | null;
  user_id: string;
  generated_at: Date | string | null;
  period_start: Date;
  period_end: Date;
  pillar_heart: PreventionPillarStatus;
  pillar_brain: PreventionPillarStatus;
  pillar_strength: PreventionPillarStatus;
  pillar_nourishment: PreventionPillarStatus;
  pillar_calm: PreventionPillarStatus;
  pillar_heart_signals: SummaryMap;
  pillar_brain_signals: SummaryMap;
  pillar_strength_signals: SummaryMap;
  pillar_nourishment_signals: SummaryMap;
  pillar_calm_signals: SummaryMap;
  cross_pillar_patterns: CrossPillarPattern[];
  recommendations: PreventionRecommendations;
  priority_intervention: string | null;
  priority_why: string | null;
  plan_narrative_senior: string | null;
  plan_narrative_caregiver: string | null;
  plan_abstract_gp: string | null;
  trajectory: "improving" | "stable" | "declining" | "first";
  source_signals: Record<string, boolean>;
  confidence: string | number | null;
  priority_pillar: PreventionPillar | null;
  status: "active" | "superseded" | "archived";
};

type LongevityActionEventType = "shown" | "opened" | "saved" | "done" | "too_hard" | "not_relevant";
type LongevityMoment = "morning" | "midday" | "afternoon" | "evening";
type LongevityMomentStatus = "past" | "now" | "later";
type LongevityProgramStatus = "active" | "paused" | "completed";
type LongevityProgramDayStatus = "scheduled" | "shown" | "completed" | "skipped";
type LongevityVideoCurationStatus = "ready" | "pending" | "fallback" | "failed";
type LongevityVideoTranscriptStatus = "pending" | "available" | "unavailable" | "manual_reviewed";

type LongevityActionEventRow = {
  action_key: string;
  action_title: string;
  event_type: LongevityActionEventType;
  pillar: PreventionPillar | null;
  barrier: string | null;
  moment?: LongevityMoment | null;
  content_id?: string | null;
  resource_id?: string | null;
  source_context: Record<string, unknown> | null;
  created_at: Date | string;
};

type LongevityProgramRow = {
  id: string;
  user_id: string;
  program_key: string;
  title: string;
  status: LongevityProgramStatus;
  focus_pillars: PreventionPillar[];
  start_date: Date | string;
  current_day: number;
  total_days: number;
  language: string;
  cadence: string;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type LongevityProgramDayRow = {
  id: string;
  program_id: string;
  user_id: string;
  day_index: number;
  pillar: PreventionPillar;
  theme: string;
  objective: string;
  action_title: string;
  action_detail: string;
  video_query: string;
  fallback_video_key: string;
  scheduled_date: Date | string;
  status: LongevityProgramDayStatus;
  shown_at: Date | string | null;
  completed_at: Date | string | null;
  skipped_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type LongevityVideoResourceRow = {
  id: string;
  program_day_id: string;
  user_id: string;
  provider: "youtube";
  video_id: string;
  url: string;
  title: string;
  channel: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  language: string;
  summary: string | null;
  selected_reason: string;
  safety_notes: string;
  transcript_status?: LongevityVideoTranscriptStatus | null;
  key_points?: string[] | null;
  senior_takeaway?: string | null;
  pillar?: PreventionPillar | null;
  transcript_summary?: string | null;
  after_watch_action?: string | null;
  good_for?: string[] | null;
  not_for?: string[] | null;
  moment_fit?: LongevityMoment[] | null;
  curation_status: Exclude<LongevityVideoCurationStatus, "pending">;
  curator_agent: string;
  search_query: string;
  fetched_at: Date | string;
  expires_at: Date | string | null;
  created_at: Date | string;
};

type LongevityActiveProgram = {
  id: string;
  programKey: string;
  title: string;
  status: LongevityProgramStatus;
  focusPillars: PreventionPillar[];
  startDate: string;
  currentDay: number;
  totalDays: number;
  language: string;
  cadence: string;
};

type LongevityProgramStep = {
  id: string;
  programId: string;
  dayIndex: number;
  pillar: PreventionPillar;
  theme: string;
  objective: string;
  actionTitle: string;
  actionDetail: string;
  videoQuery: string;
  scheduledDate: string;
  status: LongevityProgramDayStatus;
};

type LongevityVideoResource = {
  id: string;
  provider: "youtube";
  pillar: PreventionPillar | null;
  videoId: string;
  url: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  language: string;
  summary: string | null;
  selectedReason: string;
  safetyNotes: string;
  transcriptStatus: LongevityVideoTranscriptStatus;
  keyPoints: string[];
  seniorTakeaway: string | null;
  transcriptSummary: string | null;
  afterWatchAction: string | null;
  goodFor: string[];
  notFor: string[];
  momentFit: LongevityMoment[];
};

type LongevityProgramLayer = {
  activeProgram: LongevityActiveProgram;
  todayProgramStep: LongevityProgramStep;
  todayVideo: LongevityVideoResource | null;
  videoCurationStatus: LongevityVideoCurationStatus;
};

type LongevityCompanionSignal = {
  id: string;
  label: string;
  detail: string;
  source: "profile" | "medication" | "brain" | "check-in" | "symptom" | "vitals" | "feedback";
  pillar: PreventionPillar | null;
  tone: "steady" | "attention" | "positive";
};

type LongevityBrainChallenge = {
  kind: "memory_prompt" | "word_chain" | "riddle" | "chess_puzzle" | "crossword";
  prompt: string;
  hint: string;
  answer: string | null;
  followUp: string;
};

type LongevityBrainGameOption = LongevityBrainChallenge & {
  id: string;
  label: string;
  title: string;
};

type LongevityCompanionAction = {
  action_key: string;
  content_id?: string | null;
  content_type?: DailyContentType | null;
  timing_guidance?: string | null;
  title: string;
  detail: string;
  pillar: PreventionPillar | null;
  route: string | null;
  resource_label?: string | null;
  resource_url?: string | null;
  resource_title?: string | null;
  duration_seconds?: number | null;
  safety_notes?: string | null;
  prompt: string;
  source: "monthly_plan" | "daily_content" | "feedback_memory" | "fallback" | "program";
  challenge?: LongevityBrainChallenge | null;
  gameOptions?: LongevityBrainGameOption[] | null;
};

type LongevityCareSummary = {
  title: string;
  bullets: string[];
  share_text: string;
};

type LongevityDailyExperienceKind = "video" | "brain_game" | "movement" | "walking_route" | "food" | "calm" | "support";

type LongevityPrimaryExperience = {
  kind: LongevityDailyExperienceKind;
  title: string;
  detail: string;
  pillar: PreventionPillar | null;
  ctaLabel: string;
  action: LongevityCompanionAction;
  video: LongevityVideoResource | null;
};

type LongevityCoveredPillar = {
  pillar: PreventionPillar;
  label: string;
  status: PreventionPillarStatus;
  actionTitle: string;
  reason: string;
  evidence: string;
};

type LongevityWhyThis = {
  summary: string;
  evidence: string[];
};

type LongevityDailySession = {
  moment?: LongevityMoment;
  label?: string;
  sessionFocus: string;
  primaryExperience: LongevityPrimaryExperience;
  companionAction: LongevityCompanionAction;
  optionalChoices: LongevityCompanionAction[];
  coveredPillars: LongevityCoveredPillar[];
  whyThis: LongevityWhyThis;
};

type LongevityMomentSession = LongevityDailySession & {
  moment: LongevityMoment;
  label: string;
  status: LongevityMomentStatus;
  startsAt: string;
};

type LongevityTimelineItem = {
  moment: LongevityMoment;
  label: string;
  status: LongevityMomentStatus;
  startsAt: string;
  title: string;
  reason: string;
  pillar: PreventionPillar | null;
  kind: LongevityDailyExperienceKind;
};

type LongevityCompanionPayload = {
  plan: LongevityPreventionPlan;
  activeProgram: LongevityActiveProgram | null;
  todayProgramStep: LongevityProgramStep | null;
  todayVideo: LongevityVideoResource | null;
  videoCurationStatus: LongevityVideoCurationStatus;
  todayFocus: {
    pillar: PreventionPillar | null;
    label: string;
    headline: string;
    summary: string;
  };
  activeMoment: LongevityMoment;
  todayTimeline: LongevityTimelineItem[];
  currentMomentSession: LongevityMomentSession;
  nextMomentPreview: LongevityTimelineItem | null;
  whyToday: string;
  dailySession: LongevityDailySession;
  primaryAction: LongevityCompanionAction;
  supportAction: LongevityCompanionAction;
  pillarActions: Record<PreventionPillar, LongevityCompanionAction>;
  careSummary: LongevityCareSummary;
  signalsUsed: LongevityCompanionSignal[];
  dailyContent: {
    exercise: DailyContentRow | null;
    meal: DailyContentRow | null;
    tip: DailyContentRow | null;
    supplement: DailyContentRow | null;
    naturalSolution: DailyContentRow | null;
    articles: DailyContentRow[];
    byPillar: Record<PreventionPillar, DailyContentRow[]>;
  };
  feedbackHistory: LongevityActionEventRow[];
};

const PREVENTION_PILLARS: PreventionPillar[] = ["heart", "brain", "strength", "nourishment", "calm"];
const PREVENTION_STATUS_RANK: Record<PreventionPillarStatus, number> = {
  thriving: 0,
  steady: 1,
  needs_attention: 2,
  priority_focus: 3,
};

const LONGEVITY_MOMENT_ORDER: LongevityMoment[] = ["morning", "midday", "afternoon", "evening"];
const LONGEVITY_MOMENT_DEFINITIONS: Record<LongevityMoment, {
  label: string;
  startsAt: string;
  preferredPillars: PreventionPillar[];
  preferredTypes: DailyContentType[];
  focusByPillar: Record<PreventionPillar, string>;
}> = {
  morning: {
    label: "Morning",
    startsAt: "05:00",
    preferredPillars: ["nourishment", "calm", "brain"],
    preferredTypes: ["meal", "tip", "exercise", "natural_solution"],
    focusByPillar: {
      heart: "Start gently, then keep movement possible later.",
      brain: "Begin with one light brain spark.",
      strength: "Make the first move feel steady.",
      nourishment: "Make breakfast do some work.",
      calm: "Start the day with one calmer cue.",
    },
  },
  midday: {
    label: "Midday",
    startsAt: "11:00",
    preferredPillars: ["nourishment", "heart", "strength"],
    preferredTypes: ["meal", "tip", "supplement", "natural_solution"],
    focusByPillar: {
      heart: "Use lunch as a heart-support cue.",
      brain: "Keep the middle of the day clear and simple.",
      strength: "Choose one practical move while energy is available.",
      nourishment: "Make lunch easier to choose.",
      calm: "Keep the day from getting noisy.",
    },
  },
  afternoon: {
    label: "Afternoon",
    startsAt: "14:00",
    preferredPillars: ["heart", "strength", "brain"],
    preferredTypes: ["exercise", "tip", "article", "natural_solution"],
    focusByPillar: {
      heart: "Choose movement that fits the day.",
      brain: "Make the afternoon mentally engaging.",
      strength: "Use one safe, supported movement.",
      nourishment: "Keep energy steady after lunch.",
      calm: "Reset before the evening.",
    },
  },
  evening: {
    label: "Evening",
    startsAt: "18:00",
    preferredPillars: ["calm", "nourishment", "brain"],
    preferredTypes: ["tip", "exercise", "meal", "natural_solution"],
    focusByPillar: {
      heart: "Keep tonight easy on tomorrow.",
      brain: "Close the day with something familiar.",
      strength: "Set up tomorrow's movement to feel easier.",
      nourishment: "Make the evening simple and settled.",
      calm: "Wind down with one clear cue.",
    },
  },
};

const LONGEVITY_PROGRAM_KEY = "starter_video_longevity_v1";
const LONGEVITY_PROGRAM_TOTAL_DAYS = 14;
const LONGEVITY_CURATOR_AGENT = "vyva-longevity-video-curator-v1";

type LongevityProgramDayTemplate = {
  pillar: PreventionPillar;
  theme: string;
  objective: string;
  actionTitle: string;
  actionDetail: string;
  videoQuery: string;
  fallbackVideoKey: string;
};

type LongevityVideoCandidate = {
  pillar?: PreventionPillar | null;
  videoId: string;
  url: string;
  title: string;
  channel: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  language: string;
  summary: string | null;
  selectedReason: string;
  safetyNotes: string;
  transcriptStatus?: LongevityVideoTranscriptStatus;
  keyPoints?: string[];
  seniorTakeaway?: string | null;
  transcriptSummary?: string | null;
  afterWatchAction?: string | null;
  goodFor?: string[];
  notFor?: string[];
  momentFit?: LongevityMoment[];
  searchQuery: string;
  curationStatus: Exclude<LongevityVideoCurationStatus, "pending">;
};

type LongevityVideoInsight = {
  transcriptStatus: LongevityVideoTranscriptStatus;
  keyPoints: string[];
  seniorTakeaway: string;
  transcriptSummary?: string;
  afterWatchAction?: string;
  goodFor?: string[];
  notFor?: string[];
  momentFit?: LongevityMoment[];
};

const STARTER_PROGRAM_TEMPLATES: LongevityProgramDayTemplate[] = [
  {
    pillar: "brain",
    theme: "Memory starter",
    objective: "Use one short visual guide, then keep memory practice familiar.",
    actionTitle: "3-2-1 memory lane",
    actionDetail: "Pick a real place. Name 3 things you see there, 2 sounds, and 1 person connected to it.",
    videoQuery: "short brain health memory support older adults calm video",
    fallbackVideoKey: "brain-mind-diet-mayo",
  },
  {
    pillar: "heart",
    theme: "Gentle movement",
    objective: "Pick one guided VYVA movement so the heart step is clear and doable.",
    actionTitle: "Chair yoga",
    actionDetail: "Start the guided chair yoga exercise and stop after the first round if that is enough.",
    videoQuery: "British Heart Foundation low intensity aerobic 10 minute home workout video",
    fallbackVideoKey: "heart-bhf-low-intensity",
  },
  {
    pillar: "strength",
    theme: "Warm up safely",
    objective: "Start movement with a short guided warm-up that respects mobility.",
    actionTitle: "Follow the warm-up only",
    actionDetail: "Use a stable chair nearby and stop at the first movement that feels like enough.",
    videoQuery: "National Institute on Aging 5 minute warm up older adults video",
    fallbackVideoKey: "strength-nia-warmup",
  },
  {
    pillar: "nourishment",
    theme: "Breakfast anchor",
    objective: "Make one meal easier to choose instead of adding another rule.",
    actionTitle: "Add one familiar protein at breakfast",
    actionDetail: "Choose eggs, yogurt, beans, fish, tofu, or another familiar protein you like.",
    videoQuery: "nutrition tips adults over 60 protein breakfast short video",
    fallbackVideoKey: "nourishment-protein-aging",
  },
  {
    pillar: "calm",
    theme: "Two-minute reset",
    objective: "Use a short breathing visual so calm has a concrete start.",
    actionTitle: "Try the first two minutes, then stop if that is enough",
    actionDetail: "Keep the sound low, sit comfortably, and let the timer be the structure.",
    videoQuery: "5 minute guided breathing meditation calm beginner video",
    fallbackVideoKey: "calm-five-minute-meditation",
  },
  {
    pillar: "brain",
    theme: "Brain and movement",
    objective: "Connect memory support with simple physical activity.",
    actionTitle: "Word chain: garden",
    actionDetail: "Start with garden. Say five connected words without stopping.",
    videoQuery: "brain changing benefits of exercise short video",
    fallbackVideoKey: "brain-exercise-ted",
  },
  {
    pillar: "heart",
    theme: "Busy-day movement",
    objective: "Use a short balance-friendly movement from the VYVA exercise library.",
    actionTitle: "Tai chi",
    actionDetail: "Open the guided tai chi exercise and keep the chair nearby if that helps.",
    videoQuery: "Move Your Way tips for busy days physical activity video",
    fallbackVideoKey: "heart-busy-days-hhs",
  },
  {
    pillar: "strength",
    theme: "Chair mobility",
    objective: "Use a seated visual guide when standing movement is not the right entry point.",
    actionTitle: "Do the seated version only",
    actionDetail: "Follow the chair-based version and skip any movement that does not suit today.",
    videoQuery: "British Heart Foundation chair exercises 10 minute mobility workout video",
    fallbackVideoKey: "strength-bhf-chair",
  },
  {
    pillar: "nourishment",
    theme: "Plate balance",
    objective: "Turn food advice into one visible plate choice.",
    actionTitle: "Choose one plate upgrade today",
    actionDetail: "Add protein, water, or one colourful food to the meal that is easiest to change.",
    videoQuery: "healthy eating older adults simple plate tips video",
    fallbackVideoKey: "nourishment-over-60-tips",
  },
  {
    pillar: "calm",
    theme: "Breathing rhythm",
    objective: "Use a paced breathing visual rather than more written advice.",
    actionTitle: "Follow one short breathing rhythm",
    actionDetail: "Stop early if you feel lightheaded or uncomfortable. One minute still counts.",
    videoQuery: "short box breathing visual guide calm video",
    fallbackVideoKey: "calm-box-breathing",
  },
  {
    pillar: "brain",
    theme: "Food and memory",
    objective: "Use one short guide to connect nourishment with brain support.",
    actionTitle: "Crossword clue: recall",
    actionDetail: "Clue: bringing a memory back to mind. Six letters: R _ C _ L L.",
    videoQuery: "MIND diet brain health short Mayo Clinic video",
    fallbackVideoKey: "brain-mind-diet-mayo",
  },
  {
    pillar: "heart",
    theme: "Indoor option",
    objective: "Keep movement possible even when going outside is not convenient.",
    actionTitle: "Chest opener",
    actionDetail: "Use the guided chest opener to pair posture, breath, and gentle upper-body movement.",
    videoQuery: "British Heart Foundation low intensity aerobic 10 minute home workout video",
    fallbackVideoKey: "heart-bhf-low-intensity",
  },
  {
    pillar: "strength",
    theme: "Ten-minute strength",
    objective: "Use a guided routine with a chair nearby so strength is clear and bounded.",
    actionTitle: "Do the first ten minutes with support nearby",
    actionDetail: "Pause whenever needed. The useful step is starting safely, not finishing perfectly.",
    videoQuery: "National Institute on Aging 10 minute workout older adults strength balance video",
    fallbackVideoKey: "strength-nia-ten",
  },
  {
    pillar: "calm",
    theme: "Stress release",
    objective: "Close the program with a calmer reset that is easy to repeat.",
    actionTitle: "Save the calm video if it helps",
    actionDetail: "If this one fits, save it as a reliable reset for another day.",
    videoQuery: "short guided meditation stress relief calm beginner video",
    fallbackVideoKey: "calm-progressive-relaxation",
  },
];

const FALLBACK_VIDEO_LIBRARY: Record<string, LongevityVideoCandidate> = {
  "brain-mind-diet-mayo": {
    videoId: "hoPg4bkKemQ",
    url: "https://www.youtube.com/watch?v=hoPg4bkKemQ",
    title: "Mayo Clinic Minute: Can the MIND diet improve brain health?",
    channel: "Mayo Clinic",
    durationSeconds: 70,
    thumbnailUrl: "https://i.ytimg.com/vi/hoPg4bkKemQ/hqdefault.jpg",
    language: "en",
    summary: "A short, calm explanation of how food choices can support brain health.",
    selectedReason: "Connects one simple food choice with memory and energy for today.",
    safetyNotes: "Educational only; no diagnosis or treatment claim.",
    searchQuery: "MIND diet brain health short Mayo Clinic video",
    curationStatus: "fallback",
  },
  "heart-mayo-moving": {
    videoId: "sjrEUD9RZqA",
    url: "https://www.youtube.com/watch?v=sjrEUD9RZqA",
    title: "Mayo Clinic Minute: A little moving goes long way for heart health",
    channel: "Mayo Clinic",
    durationSeconds: 60,
    thumbnailUrl: "https://i.ytimg.com/vi/sjrEUD9RZqA/hqdefault.jpg",
    language: "en",
    summary: "A short visual cue that heart-supporting movement can stay small and doable.",
    selectedReason: "Makes heart movement feel doable by keeping the first step small.",
    safetyNotes: "General wellness education only; choose comfortable movement.",
    searchQuery: "Mayo Clinic Minute a little moving goes long way heart health video",
    curationStatus: "fallback",
  },
  "nourishment-healthy-fat-mayo": {
    videoId: "R41BXXGohsU",
    url: "https://www.youtube.com/watch?v=R41BXXGohsU",
    title: "Mayo Clinic Minute: How to choose a healthy fat",
    channel: "Mayo Clinic",
    durationSeconds: 60,
    thumbnailUrl: "https://i.ytimg.com/vi/R41BXXGohsU/hqdefault.jpg",
    language: "en",
    summary: "A quick visual guide for making one meal choice easier.",
    selectedReason: "Turns nourishment into one practical choice at the next meal.",
    safetyNotes: "General nutrition education only; follow personal restrictions and clinician guidance.",
    searchQuery: "Mayo Clinic Minute how to choose a healthy fat video",
    curationStatus: "fallback",
  },
  "calm-daily-calm-present": {
    videoId: "ZToicYcHIOU",
    url: "https://www.youtube.com/watch?v=ZToicYcHIOU",
    title: "Daily Calm | 10 Minute Mindfulness Meditation | Be Present",
    channel: "Calm",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/ZToicYcHIOU/hqdefault.jpg",
    language: "en",
    summary: "A simple guided meditation for a calm reset.",
    selectedReason: "Gives the pause a gentle pace to follow without overthinking it.",
    safetyNotes: "Pause or stop if the exercise feels uncomfortable.",
    searchQuery: "Daily Calm 10 Minute Mindfulness Meditation Be Present video",
    curationStatus: "fallback",
  },
  "brain-mind-diet-mayo-es": {
    videoId: "2XVQctv5WzQ",
    url: "https://www.youtube.com/watch?v=2XVQctv5WzQ",
    title: "El minuto de Mayo Clinic: La alimentación puede mejorar la salud cerebral",
    channel: "Mayo Clinic",
    durationSeconds: 70,
    thumbnailUrl: "https://i.ytimg.com/vi/2XVQctv5WzQ/hqdefault.jpg",
    language: "es",
    summary: "Una explicación breve sobre cómo la alimentación puede apoyar la salud cerebral.",
    selectedReason: "Conecta una comida sencilla con memoria y energía para elegir un cambio hoy.",
    safetyNotes: "Educación general de bienestar; no sustituye orientación clínica.",
    searchQuery: "salud cerebral memoria alimentación adultos mayores video español",
    curationStatus: "fallback",
  },
  "heart-mayo-exercise-es": {
    videoId: "pEki37hCX9s",
    url: "https://www.youtube.com/watch?v=pEki37hCX9s",
    title: "El minuto de Mayo Clinic: ¿Por qué tiene que hacer ese ejercicio que odia?",
    channel: "Mayo Clinic",
    durationSeconds: 70,
    thumbnailUrl: "https://i.ytimg.com/vi/pEki37hCX9s/hqdefault.jpg",
    language: "es",
    summary: "Un recordatorio breve para elegir movimiento de una forma más llevadera.",
    selectedReason: "Ayuda a escoger un movimiento breve y amable para activar el día sin hacerlo pesado.",
    safetyNotes: "Mantén el movimiento cómodo y suave; detente si algo no se siente bien.",
    searchQuery: "ejercicio corazón adultos mayores video español Mayo Clinic",
    curationStatus: "fallback",
  },
  "strength-warmup-senior-es": {
    videoId: "M0Jh5tLQRE0",
    url: "https://www.youtube.com/watch?v=M0Jh5tLQRE0",
    title: "Rutina de Ejercicios de CALENTAMIENTO para Adultos Mayores Activos (10 minutos)",
    channel: "Mariana Quevedo | Fisioterapia Querétaro",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/M0Jh5tLQRE0/hqdefault.jpg",
    language: "es",
    summary: "Una rutina breve de calentamiento para empezar movimiento con más seguridad.",
    selectedReason: "Ayuda a preparar el cuerpo antes de caminar o moverse por casa con más confianza.",
    safetyNotes: "Usa apoyo cercano y haz cada movimiento más pequeño si lo necesitas.",
    searchQuery: "ejercicios adultos mayores 10 minutos seguro español",
    curationStatus: "fallback",
  },
  "nourishment-healthy-eating-es": {
    videoId: "pBVof_fgLV4",
    url: "https://www.youtube.com/watch?v=pBVof_fgLV4",
    title: "Alimentación saludable en las personas mayores",
    channel: "SaludMadrid",
    durationSeconds: null,
    thumbnailUrl: "https://i.ytimg.com/vi/pBVof_fgLV4/hqdefault.jpg",
    language: "es",
    summary: "Un recurso visual en español sobre alimentación saludable en personas mayores.",
    selectedReason: "Da ideas simples para mejorar la próxima comida sin cambiar toda la rutina.",
    safetyNotes: "Educación general; respeta alergias, preferencias y pautas del equipo sanitario.",
    searchQuery: "alimentación saludable adultos mayores español",
    curationStatus: "fallback",
  },
  "calm-meditation-es": {
    videoId: "FReFf1CLf-c",
    url: "https://www.youtube.com/watch?v=FReFf1CLf-c",
    title: "Meditación Guiada de 10 minutos | Calma la mente y consigue paz interior",
    channel: "Anabel Otero",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/FReFf1CLf-c/hqdefault.jpg",
    language: "es",
    summary: "Una meditación guiada corta en español para una pausa tranquila.",
    selectedReason: "Da estructura sonora y visual a una pausa de calma fácil de empezar.",
    safetyNotes: "Pausa o termina si respirar lento o cerrar los ojos no resulta cómodo.",
    searchQuery: "meditación guiada 10 minutos español calma",
    curationStatus: "fallback",
  },
  "brain-food-cognition-fr": {
    videoId: "Uplih5Mx1uw",
    url: "https://www.youtube.com/watch?v=Uplih5Mx1uw",
    title: "Les meilleurs aliments pour préserver son cerveau et ses facultés le plus longtemps possible",
    channel: "Allo Docteurs",
    durationSeconds: null,
    thumbnailUrl: "https://i.ytimg.com/vi/Uplih5Mx1uw/hqdefault.jpg",
    language: "fr",
    summary: "Un guide visuel en français sur les choix alimentaires liés au cerveau.",
    selectedReason: "Relie le repas à la mémoire avec une action simple pour aujourd'hui.",
    safetyNotes: "Information générale de bien-être; respecter les conseils médicaux personnels.",
    searchQuery: "santé du cerveau alimentation personnes âgées français",
    curationStatus: "fallback",
  },
  "heart-gentle-exercise-fr": {
    videoId: "OBn81SkwFtk",
    url: "https://www.youtube.com/watch?v=OBn81SkwFtk",
    title: "10 min d'exercice physique par jour pour les seniors - 1",
    channel: "Senioriales résidences seniors",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/OBn81SkwFtk/hqdefault.jpg",
    language: "fr",
    summary: "Une courte séance en français pour garder le mouvement simple.",
    selectedReason: "Aide à garder un mouvement doux et réaliste dans la journée.",
    safetyNotes: "Choisir une version confortable et garder un appui à proximité.",
    searchQuery: "exercice doux personnes âgées 10 minutes français",
    curationStatus: "fallback",
  },
  "strength-gym-senior-fr": {
    videoId: "XOYqccktGxQ",
    url: "https://www.youtube.com/watch?v=XOYqccktGxQ",
    title: "Gym douce senior : séance complète de 10 minutes",
    channel: "Gym Senior",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/XOYqccktGxQ/hqdefault.jpg",
    language: "fr",
    summary: "Une séance douce en français pour travailler mobilité et stabilité.",
    selectedReason: "Propose quelques mouvements pour démarrer avec plus de stabilité.",
    safetyNotes: "Utiliser un appui stable et réduire l'amplitude si nécessaire.",
    searchQuery: "gym douce senior 10 minutes français",
    curationStatus: "fallback",
  },
  "nourishment-senior-food-fr": {
    videoId: "VWH4M7j0ECk",
    url: "https://www.youtube.com/watch?v=VWH4M7j0ECk",
    title: "Quelle alimentation pour les seniors ? - Sénior, et alors ?",
    channel: "mieux",
    durationSeconds: null,
    thumbnailUrl: "https://i.ytimg.com/vi/VWH4M7j0ECk/hqdefault.jpg",
    language: "fr",
    summary: "Un contenu en français sur les repères alimentaires pour seniors.",
    selectedReason: "Transforme les repères alimentaires en une amélioration simple du prochain repas.",
    safetyNotes: "Information générale; tenir compte des allergies et restrictions personnelles.",
    searchQuery: "alimentation saine personnes âgées français",
    curationStatus: "fallback",
  },
  "calm-meditation-fr": {
    videoId: "T6VJVRmqVJ8",
    url: "https://www.youtube.com/watch?v=T6VJVRmqVJ8",
    title: "10 min de Calme et de Pleine conscience",
    channel: "Cédric Michel",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/T6VJVRmqVJ8/hqdefault.jpg",
    language: "fr",
    summary: "Une méditation guidée en français pour une pause calme.",
    selectedReason: "Donne un rythme guidé pour une pause calme facile à commencer.",
    safetyNotes: "Arrêter si l'exercice n'est pas confortable.",
    searchQuery: "méditation guidée 10 minutes français calme",
    curationStatus: "fallback",
  },
  "heart-move-pledge-hhs": {
    videoId: "uLLo9w4dbPA",
    url: "https://www.youtube.com/watch?v=uLLo9w4dbPA",
    title: "Move Your Way: Make a Pledge",
    channel: "Office of Disease Prevention and Health Promotion",
    durationSeconds: 31,
    thumbnailUrl: "https://i.ytimg.com/vi/uLLo9w4dbPA/hqdefault.jpg",
    language: "en",
    summary: "A short prompt to choose a movement commitment that fits the day.",
    selectedReason: "Turns movement into one small commitment that is easy to start today.",
    safetyNotes: "Keep activity gentle and choose what feels comfortable.",
    searchQuery: "older adults gentle physical activity motivation short HHS video",
    curationStatus: "fallback",
  },
  "strength-nia-warmup": {
    videoId: "q-_BWXpM-Y0",
    url: "https://www.youtube.com/watch?v=q-_BWXpM-Y0",
    title: "5-minute Exercise Warm Up for Older Adults",
    channel: "National Institute on Aging",
    durationSeconds: 300,
    thumbnailUrl: "https://i.ytimg.com/vi/q-_BWXpM-Y0/hqdefault.jpg",
    language: "en",
    summary: "A short warm-up before doing anything more active.",
    selectedReason: "Makes the next movement feel easier by starting with a gentle warm-up.",
    safetyNotes: "Use support nearby and stop if any movement feels wrong today.",
    searchQuery: "National Institute on Aging 5 minute warm up older adults video",
    curationStatus: "fallback",
  },
  "nourishment-protein-aging": {
    videoId: "BzpaQ0F49JE",
    url: "https://www.youtube.com/watch?v=BzpaQ0F49JE",
    title: "Protein, Metabolism & Aging: Nutrition Tips for Longevity",
    channel: "Curated nutrition source",
    durationSeconds: null,
    thumbnailUrl: "https://i.ytimg.com/vi/BzpaQ0F49JE/hqdefault.jpg",
    language: "en",
    summary: "A visual nutrition guide for thinking about protein as part of healthy ageing.",
    selectedReason: "Connects breakfast with energy and strength through one simple food cue.",
    safetyNotes: "General nutrition education; respect allergies, preferences, and clinician guidance.",
    searchQuery: "nutrition tips adults over 60 protein breakfast short video",
    curationStatus: "fallback",
  },
  "calm-five-minute-meditation": {
    videoId: "inpok4MKVLM",
    url: "https://www.youtube.com/watch?v=inpok4MKVLM",
    title: "5-Minute Meditation You Can Do Anywhere",
    channel: "Goodful",
    durationSeconds: 300,
    thumbnailUrl: "https://i.ytimg.com/vi/inpok4MKVLM/hqdefault.jpg",
    language: "en",
    summary: "A short guided meditation that gives the calm step a timer and a voice.",
    selectedReason: "Short, beginner-friendly, and useful when the plan needs to stay light.",
    safetyNotes: "Pause or stop if it feels uncomfortable.",
    searchQuery: "5 minute guided breathing meditation calm beginner video",
    curationStatus: "fallback",
  },
  "brain-exercise-ted": {
    videoId: "BHY0FxzoKZE",
    url: "https://www.youtube.com/watch?v=BHY0FxzoKZE",
    title: "The brain-changing benefits of exercise",
    channel: "TED",
    durationSeconds: 782,
    thumbnailUrl: "https://i.ytimg.com/vi/BHY0FxzoKZE/hqdefault.jpg",
    language: "en",
    summary: "A visual explanation of why movement and brain health belong together.",
    selectedReason: "Shows how light movement can support both energy and brain health.",
    safetyNotes: "Educational only; choose gentle movement that fits your body.",
    searchQuery: "brain changing benefits of exercise short video",
    curationStatus: "fallback",
  },
  "heart-busy-days-hhs": {
    videoId: "61p1OIO20wk",
    url: "https://www.youtube.com/watch?v=61p1OIO20wk",
    title: "Move Your Way: Tips for Busy Days",
    channel: "Office of Disease Prevention and Health Promotion",
    durationSeconds: 119,
    thumbnailUrl: "https://i.ytimg.com/vi/61p1OIO20wk/hqdefault.jpg",
    language: "en",
    summary: "A short prompt for fitting movement into an existing day.",
    selectedReason: "It turns movement into a realistic routine cue, not a big separate task.",
    safetyNotes: "Choose a comfortable version and keep it close to home if needed.",
    searchQuery: "Move Your Way tips for busy days physical activity video",
    curationStatus: "fallback",
  },
  "strength-bhf-chair": {
    videoId: "bAsTJg24gck",
    url: "https://www.youtube.com/watch?v=bAsTJg24gck",
    title: "Chair exercises - 10-minute mobility workout",
    channel: "British Heart Foundation",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/bAsTJg24gck/hqdefault.jpg",
    language: "en",
    summary: "A chair-based routine for days when support and steadiness matter.",
    selectedReason: "Seated, practical, and easier to start than a standing workout.",
    safetyNotes: "Use a stable chair and skip anything uncomfortable.",
    searchQuery: "British Heart Foundation chair exercises 10 minute mobility workout video",
    curationStatus: "fallback",
  },
  "nourishment-over-60-tips": {
    videoId: "6O_jxyC-eu0",
    url: "https://www.youtube.com/watch?v=6O_jxyC-eu0",
    title: "Top Nutrition Tips for Adults Over 60",
    channel: "Curated nutrition source",
    durationSeconds: null,
    thumbnailUrl: "https://i.ytimg.com/vi/6O_jxyC-eu0/hqdefault.jpg",
    language: "en",
    summary: "A simple visual guide for making one meal or hydration choice easier.",
    selectedReason: "Makes the next meal easier to improve with one visible choice.",
    safetyNotes: "General nutrition education; follow personal dietary restrictions.",
    searchQuery: "healthy eating older adults simple plate tips video",
    curationStatus: "fallback",
  },
  "calm-box-breathing": {
    videoId: "FJJazKtH_9I",
    url: "https://www.youtube.com/watch?v=FJJazKtH_9I",
    title: "Box Breathing Technique",
    channel: "Curated calm source",
    durationSeconds: null,
    thumbnailUrl: "https://i.ytimg.com/vi/FJJazKtH_9I/hqdefault.jpg",
    language: "en",
    summary: "A paced visual breathing guide for a short calm reset.",
    selectedReason: "A visual rhythm is easier to follow than written breathing instructions.",
    safetyNotes: "Stop if breath holds feel uncomfortable; normal slow breathing is enough.",
    searchQuery: "short box breathing visual guide calm video",
    curationStatus: "fallback",
  },
  "heart-bhf-low-intensity": {
    videoId: "LyR0l_GEgZI",
    url: "https://www.youtube.com/watch?v=LyR0l_GEgZI",
    title: "Low intensity aerobic exercises - 10 minute home workout",
    channel: "British Heart Foundation",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/LyR0l_GEgZI/hqdefault.jpg",
    language: "en",
    summary: "A low-intensity indoor movement option for today.",
    selectedReason: "Gives an indoor movement option for days when going outside is not the best fit.",
    safetyNotes: "Keep it gentle and stop if you feel unwell.",
    searchQuery: "British Heart Foundation low intensity aerobic 10 minute home workout video",
    curationStatus: "fallback",
  },
  "strength-nia-ten": {
    videoId: "G1lwVhnnkoU",
    url: "https://www.youtube.com/watch?v=G1lwVhnnkoU",
    title: "10-minute Workout for Older Adults",
    channel: "National Institute on Aging",
    durationSeconds: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/G1lwVhnnkoU/hqdefault.jpg",
    language: "en",
    summary: "A bounded strength and movement routine for older adults.",
    selectedReason: "Gives a clear first movement step without needing a full workout.",
    safetyNotes: "Use support nearby and make the movements smaller when needed.",
    searchQuery: "National Institute on Aging 10 minute workout older adults strength balance video",
    curationStatus: "fallback",
  },
  "calm-progressive-relaxation": {
    videoId: "86HUcX8ZtAk",
    url: "https://www.youtube.com/watch?v=86HUcX8ZtAk",
    title: "Progressive Muscle Relaxation Training",
    channel: "Curated calm source",
    durationSeconds: null,
    thumbnailUrl: "https://i.ytimg.com/vi/86HUcX8ZtAk/hqdefault.jpg",
    language: "en",
    summary: "A guided relaxation option for winding down.",
    selectedReason: "Clear structure for a calm step when breathing alone feels too abstract.",
    safetyNotes: "Skip any muscle group that feels uncomfortable.",
    searchQuery: "short guided meditation stress relief calm beginner video",
    curationStatus: "fallback",
  },
};

const FALLBACK_VIDEO_INSIGHTS_BY_ID: Record<string, LongevityVideoInsight> = {
  hoPg4bkKemQ: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Brain-friendly eating works best as a simple pattern, not a perfect rule.",
      "One useful swap today is easier to keep than a full meal overhaul.",
    ],
    seniorTakeaway: "Use the video as a cue to choose one brain-friendly food today, then keep the memory step short.",
  },
  sjrEUD9RZqA: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Small amounts of movement still count when the day feels full.",
      "The first step is choosing a comfortable movement, not chasing intensity.",
    ],
    seniorTakeaway: "Pick one gentle VYVA movement and treat starting as the win.",
  },
  R41BXXGohsU: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Healthy fats are easier to choose when they are tied to a real meal.",
      "The useful habit is one visible plate choice, not another food rule.",
    ],
    seniorTakeaway: "At the next meal, choose one familiar healthier fat or protein option that already fits your routine.",
  },
  ZToicYcHIOU: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A guided rhythm can make a calm pause easier to follow.",
      "A few settled minutes are enough for today's calm step.",
    ],
    seniorTakeaway: "Let the video provide the pace; stop after a few minutes if that is enough.",
  },
  "2XVQctv5WzQ": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "La alimentación puede apoyar la salud cerebral como parte de una rutina diaria.",
      "Un cambio pequeño en una comida es más práctico que intentar cambiar todo.",
    ],
    seniorTakeaway: "Usa el video para elegir hoy un alimento familiar que apoye memoria y energía.",
  },
  pEki37hCX9s: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "El movimiento funciona mejor cuando se adapta a lo que la persona puede hacer hoy.",
      "Empezar con algo cómodo ayuda más que forzar un ejercicio que se odia.",
    ],
    seniorTakeaway: "Escoge una versión suave y breve; la constancia importa más que hacerlo perfecto.",
  },
  M0Jh5tLQRE0: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Un calentamiento prepara el cuerpo antes de moverse más.",
      "Tener una silla o apoyo cerca hace que el paso sea más seguro.",
    ],
    seniorTakeaway: "Haz solo el calentamiento y reduce cualquier movimiento que no se sienta cómodo.",
  },
  pBVof_fgLV4: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "La alimentación saludable en mayores se entiende mejor con ejemplos concretos.",
      "El plato de hoy puede mejorar con una sola decisión visible.",
    ],
    seniorTakeaway: "En la próxima comida, añade agua, proteína o un alimento colorido que ya te guste.",
  },
  "FReFf1CLf-c": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Una guía breve puede ayudar a calmar la mente sin complicar el día.",
      "La pausa debe sentirse cómoda, no exigente.",
    ],
    seniorTakeaway: "Sigue la voz unos minutos y termina antes si cerrar los ojos o respirar lento no encaja hoy.",
  },
  Uplih5Mx1uw: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Les choix alimentaires peuvent soutenir le cerveau dans une routine globale.",
      "Un repère simple au repas est plus utile qu'une liste compliquée.",
    ],
    seniorTakeaway: "Choisir aujourd'hui un aliment familier qui rend le repas un peu plus favorable au cerveau.",
  },
  OBn81SkwFtk: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Dix minutes peuvent suffire pour garder un mouvement doux dans la journée.",
      "Le bon rythme est celui qui reste confortable et régulier.",
    ],
    seniorTakeaway: "Faire la version la plus douce, avec un appui proche si besoin.",
  },
  XOYqccktGxQ: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Une séance courte aide à travailler mobilité et stabilité sans surcharge.",
      "Réduire l'amplitude rend l'exercice plus facile à adapter.",
    ],
    seniorTakeaway: "Commencer par quelques mouvements et garder une chaise stable à proximité.",
  },
  VWH4M7j0ECk: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Les besoins alimentaires changent avec l'âge et gagnent à rester concrets.",
      "Le meilleur pas est une amélioration visible du prochain repas.",
    ],
    seniorTakeaway: "Ajouter au prochain repas une option simple qui respecte les goûts et restrictions personnelles.",
  },
  T6VJVRmqVJ8: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Une courte méditation donne une structure claire au moment calme.",
      "La pause doit rester confortable et facile à arrêter.",
    ],
    seniorTakeaway: "Suivre quelques minutes guidées et arrêter si l'exercice ne convient pas aujourd'hui.",
  },
  uLLo9w4dbPA: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A movement pledge works best when it is small and specific.",
      "Choosing the next step lowers the friction to begin.",
    ],
    seniorTakeaway: "Name one movement you would actually do today, then make it smaller if needed.",
  },
  "q-_BWXpM-Y0": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A short warm-up helps movement start gradually.",
      "Older-adult routines should stay bounded and easy to pause.",
    ],
    seniorTakeaway: "Use the warm-up only, with support nearby, before deciding whether to do more.",
  },
  BzpaQ0F49JE: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Protein can be framed as part of energy and strength support.",
      "Breakfast is a practical anchor because it is already a daily moment.",
    ],
    seniorTakeaway: "Choose one familiar protein at breakfast instead of redesigning the whole diet.",
  },
  inpok4MKVLM: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Five guided minutes can make meditation feel approachable.",
      "A timer and voice remove the need to decide what to do next.",
    ],
    seniorTakeaway: "Try the first few minutes seated comfortably; stopping early is still a useful reset.",
  },
  BHY0FxzoKZE: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Movement and brain health are connected through everyday habits.",
      "The practical takeaway is to pair thinking and moving in a small way.",
    ],
    seniorTakeaway: "After watching, pair one light movement with a tiny memory or word challenge.",
  },
  "61p1OIO20wk": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Busy days need movement that fits into the day already happening.",
      "Short routine cues can be more useful than a separate workout plan.",
    ],
    seniorTakeaway: "Attach one gentle movement to something already on the calendar today.",
  },
  bAsTJg24gck: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Chair-based exercise can keep movement available on lower-energy days.",
      "Seated options still support mobility when standing work is not right.",
    ],
    seniorTakeaway: "Use the seated version and skip any movement that feels uncomfortable.",
  },
  "6O_jxyC-eu0": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Older-adult nutrition is easier to act on when tied to the next meal.",
      "Hydration, protein, and colourful foods are practical levers.",
    ],
    seniorTakeaway: "Pick one plate upgrade for the meal that is easiest to change today.",
  },
  FJJazKtH_9I: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A visual breathing pattern can make a calm reset concrete.",
      "Comfort matters more than holding the breath exactly.",
    ],
    seniorTakeaway: "Follow the visual rhythm gently and switch to normal slow breathing if holds feel wrong.",
  },
  LyR0l_GEgZI: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Low-intensity movement can happen indoors when outdoor walking is not ideal.",
      "A ten-minute limit makes the exercise easier to start and finish.",
    ],
    seniorTakeaway: "Start the low-intensity routine and keep the range small enough to feel steady.",
  },
  G1lwVhnnkoU: {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "A short older-adult workout can combine strength, balance, flexibility, and endurance.",
      "Support nearby makes the routine easier to adapt safely.",
    ],
    seniorTakeaway: "Do the first few movements with a chair nearby; stop when you have done enough for today.",
  },
  "86HUcX8ZtAk": {
    transcriptStatus: "manual_reviewed",
    keyPoints: [
      "Progressive relaxation gives calm a clear sequence to follow.",
      "Skipping uncomfortable areas keeps the practice practical.",
    ],
    seniorTakeaway: "Use the guided sequence only where it feels comfortable and let that be enough.",
  },
};

const DEFAULT_VIDEO_METADATA_BY_PILLAR: Record<PreventionPillar, {
  transcriptSummary: string;
  afterWatchAction: string;
  goodFor: string[];
  notFor: string[];
  momentFit: LongevityMoment[];
}> = {
  heart: {
    transcriptSummary: "A short movement cue can make heart support feel concrete today.",
    afterWatchAction: "Choose the gentlest version and do one comfortable round.",
    goodFor: ["Days when a small movement cue would help you begin."],
    notFor: ["Skip or ask for a gentler option if movement feels unsteady today."],
    momentFit: ["afternoon"],
  },
  brain: {
    transcriptSummary: "A short visual guide can make today's memory focus easier to act on.",
    afterWatchAction: "Try one tiny memory or word step while the idea is fresh.",
    goodFor: ["A short brain-health cue before a light memory activity."],
    notFor: ["Choose a game instead if a video feels passive today."],
    momentFit: ["afternoon"],
  },
  strength: {
    transcriptSummary: "A short guided movement can make steadiness practice easier to start.",
    afterWatchAction: "Do the first movement with a stable support nearby, then stop if that is enough.",
    goodFor: ["A supported movement start on lower-energy days."],
    notFor: ["Avoid movements that feel uncomfortable or hard to control."],
    momentFit: ["afternoon"],
  },
  nourishment: {
    transcriptSummary: "A visual food cue can make the next meal simpler to improve.",
    afterWatchAction: "Pick one familiar food or drink upgrade for the next meal.",
    goodFor: ["Breakfast, lunch, or a simple meal decision."],
    notFor: ["Respect allergies, preferences, and personal food guidance."],
    momentFit: ["morning", "midday"],
  },
  calm: {
    transcriptSummary: "A guided pause can give the calm step a clear beginning and end.",
    afterWatchAction: "Follow the first few minutes, then stop early if that feels right.",
    goodFor: ["A brief reset before rest or after a busy moment."],
    notFor: ["Keep eyes open or stop if the practice feels uncomfortable."],
    momentFit: ["morning", "evening"],
  },
};

const DEFAULT_GENERIC_VIDEO_METADATA = {
  transcriptSummary: "A short visual cue can make one wellness step easier to start today.",
  afterWatchAction: "Choose the smallest useful next step and let that count.",
  goodFor: ["A simple wellness cue when the day needs structure."],
  notFor: ["Ask VYVA for a gentler option if it does not feel right today."],
  momentFit: ["afternoon"] as LongevityMoment[],
};

const PILLAR_VIDEO_RESOURCE_KEYS_BY_LANGUAGE: Record<string, Record<PreventionPillar, string>> = {
  en: {
    heart: "heart-mayo-moving",
    brain: "brain-mind-diet-mayo",
    strength: "strength-nia-ten",
    nourishment: "nourishment-healthy-fat-mayo",
    calm: "calm-daily-calm-present",
  },
  es: {
    heart: "heart-mayo-exercise-es",
    brain: "brain-mind-diet-mayo-es",
    strength: "strength-warmup-senior-es",
    nourishment: "nourishment-healthy-eating-es",
    calm: "calm-meditation-es",
  },
  fr: {
    heart: "heart-gentle-exercise-fr",
    brain: "brain-food-cognition-fr",
    strength: "strength-gym-senior-fr",
    nourishment: "nourishment-senior-food-fr",
    calm: "calm-meditation-fr",
  },
};

function emptyDailyContentBundle(): LongevityCompanionPayload["dailyContent"] {
  return {
    exercise: null,
    meal: null,
    tip: null,
    supplement: null,
    naturalSolution: null,
    articles: [],
    byPillar: Object.fromEntries(PREVENTION_PILLARS.map((pillar) => [pillar, []])) as Record<PreventionPillar, DailyContentRow[]>,
  };
}

const FALLBACK_PROFILE: ProfileSummary = {
  first_name: "there",
  language_preference: "es",
  timezone: "Europe/Madrid",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ZERO = "00000000-0000-0000-0000-000000000000";

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function todayStart(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function tomorrowFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function safeJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function arrayOfText(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function oneLine(value: string | null | undefined, fallback = ""): string {
  return (value ?? fallback).replace(/\s+/g, " ").trim();
}

function truncate(text: string | null | undefined, maxChars: number): string {
  const clean = oneLine(text);
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
}

function riskTierRank(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.min(5, Math.round(value)));
  const text = String(value ?? "").toLowerCase();
  if (["urgent", "critical", "severe", "5"].includes(text)) return 5;
  if (["notify", "high", "4"].includes(text)) return 4;
  if (["watch", "medium", "3"].includes(text)) return 3;
  if (["low", "2"].includes(text)) return 2;
  return 1;
}

function normalizeConditionTag(value: string): string | null {
  const text = value.toLowerCase();
  if (text.includes("diabetes") || text.includes("glucose")) return "diabetes";
  if (text.includes("heart") || text.includes("cardiac") || text.includes("blood pressure") || text.includes("hypertension")) return "heart";
  if (text.includes("fall") || text.includes("mobility") || text.includes("balance")) return "falls";
  if (text.includes("asthma") || text.includes("copd") || text.includes("breath")) return "asthma";
  if (text.includes("anxiety") || text.includes("stress") || text.includes("panic")) return "anxiety";
  if (text.includes("alzheimer") || text.includes("dementia") || text.includes("memory")) return "alzheimers";
  if (text.includes("cancer") || text.includes("oncology") || text.includes("chemo")) return "oncology";
  return null;
}

function categoryMatchesFocus(category: string, focus?: string | null): boolean {
  const normalized = String(focus ?? "").toLowerCase();
  if (!normalized) return false;
  if (normalized.includes(category.toLowerCase())) return true;
  if (normalized.includes("med") && category === "medicine") return true;
  if (normalized.includes("symptom") && category === "follow-up") return true;
  if (normalized.includes("vital") && category === "follow-up") return true;
  if (normalized.includes("heart") && ["eat", "move", "medicine"].includes(category)) return true;
  if (normalized.includes("fall") && ["home", "move"].includes(category)) return true;
  return false;
}

function routeForAction(action: AgeWellAction): string | null {
  if (action.destination_type === "route" || action.destination_type === "game") return action.destination_path;
  if (action.destination_type === "concierge") return action.destination_path ?? "/concierge";
  return action.destination_path;
}

function safeFallbackToday() {
  return {
    tier: 1,
    focus_label: "general",
    hero_copy: "Hola.",
    insight_text: "Aqui tienes tu plan para hoy.",
    actions: [],
    data_completeness: {},
    report_generated_at: null,
  };
}

function nullNudge() {
  return { type: null, color: null, message: null, action_route: null };
}

async function safeQuery<T>(label: string, text: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await pool.query<T>(text, params);
    return result.rows;
  } catch (err) {
    if (isRelationSchemaUnavailableError(err, label)) {
      console.warn(`[health-insights] Optional ${label} data unavailable; continuing without it.`);
      return [];
    }
    throw err;
  }
}

async function optionalQuery<T>(label: string, text: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await safeQuery<T>(label, text, params);
  } catch (err) {
    console.warn(`[health-insights] ${label} query failed; continuing without it.`, err);
    return [];
  }
}

async function resolveProfileId(req: Request, res: Response, requestedUserId?: string): Promise<string | null> {
  const accountUserId = req.user?.id;
  if (!accountUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const activeProfileId = await requireActiveProfileId(accountUserId, res);
  if (!activeProfileId) return null;

  if (requestedUserId && requestedUserId !== accountUserId && requestedUserId !== activeProfileId) {
    res.status(403).json({ error: "Not allowed for this care profile" });
    return null;
  }

  return activeProfileId;
}

function storageUserId(profileId: string, _accountUserId?: string): string {
  return profileId;
}

async function getLatestReport(userId: string, reportType: ReportType): Promise<HealthInsightReport | null> {
  if (!isUuid(userId)) return null;
  const rows = await optionalQuery<HealthInsightReport>("health_insight_reports", `
    select *
    from public.health_insight_reports
    where user_id = $1::uuid
      and report_type = $2
      and status = 'active'
    order by generated_at desc
    limit 1
  `, [userId, reportType]);
  return rows[0] ?? null;
}

async function getUserProfile(userId: string): Promise<ProfileSummary> {
  const rows = await optionalQuery<{
    full_name: string | null;
    preferred_name: string | null;
    language_preference: string | null;
    language: string | null;
    timezone: string | null;
  }>("profiles", `
    select full_name, preferred_name, language_preference, language, timezone
    from public.profiles
    where id = $1
    limit 1
  `, [userId]);

  const profile = rows[0];
  if (!profile) return FALLBACK_PROFILE;
  const firstName = oneLine(profile.preferred_name || profile.full_name)?.split(" ")[0] || "there";
  return {
    first_name: firstName,
    language_preference: profile.language_preference || profile.language || "es",
    timezone: profile.timezone || "Europe/Madrid",
    full_name: profile.full_name,
  };
}

async function getUserConditions(userId: string): Promise<string[]> {
  const conditionRows = isUuid(userId)
    ? await optionalQuery<{ condition: string }>("user_health_conditions", `
        select condition
        from public.user_health_conditions
        where user_id = $1::uuid and is_active = true
        limit 50
      `, [userId])
    : [];

  const profileRows = await optionalQuery<{ data_sharing_consent: unknown }>("profiles", `
    select data_sharing_consent
    from public.profiles
    where id = $1
    limit 1
  `, [userId]);

  const consent = safeJson<Record<string, unknown>>(profileRows[0]?.data_sharing_consent, {});
  const conditions = safeJson<Record<string, unknown>>(consent.conditions, {});
  const profileConditions = arrayOfText(conditions.health_conditions);

  return Array.from(new Set([
    ...conditionRows.map((row) => row.condition),
    ...profileConditions,
  ].filter(Boolean)));
}

function dailyContentTagsFor(conditions: string[], includeAll = true): string[] {
  const tags = new Set<string>();
  if (includeAll) tags.add("all");

  for (const condition of conditions) {
    const normalized = normalizeConditionTag(condition);
    if (!normalized) continue;
    tags.add(normalized);
    if (normalized === "alzheimers") tags.add("brain");
    if (normalized === "falls") tags.add("strength");
    if (normalized === "anxiety") tags.add("calm");
  }

  return Array.from(tags);
}

function todaySeed(timezone?: string | null): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const value = (type: string) => parts.find((part) => part.type === type)?.value;
    const year = value("year");
    const month = value("month");
    const day = value("day");
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall through to UTC when a stored timezone is invalid.
  }
  return new Date().toISOString().slice(0, 10);
}

function localHourForTimezone(timezone?: string | null, now: Date = new Date()): number {
  try {
    const hourPart = new Intl.DateTimeFormat("en", {
      timeZone: timezone || "UTC",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).find((part) => part.type === "hour")?.value;
    const hour = Number(hourPart);
    if (Number.isFinite(hour)) return Math.max(0, Math.min(23, hour));
  } catch {
    // Fall through to the host hour when a stored timezone is invalid.
  }
  return now.getHours();
}

export function longevityMomentForHour(hour: number): LongevityMoment {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 18) return "afternoon";
  return "evening";
}

export function activeLongevityMoment(timezone?: string | null, now: Date = new Date()): LongevityMoment {
  return longevityMomentForHour(localHourForTimezone(timezone, now));
}

function nextLongevityMoment(moment: LongevityMoment): LongevityMoment {
  const index = LONGEVITY_MOMENT_ORDER.indexOf(moment);
  return LONGEVITY_MOMENT_ORDER[(index + 1) % LONGEVITY_MOMENT_ORDER.length] ?? "morning";
}

function momentStatus(moment: LongevityMoment, activeMoment: LongevityMoment): LongevityMomentStatus {
  if (moment === activeMoment) return "now";
  const activeIndex = LONGEVITY_MOMENT_ORDER.indexOf(activeMoment);
  const momentIndex = LONGEVITY_MOMENT_ORDER.indexOf(moment);
  if (activeMoment === "evening") return "past";
  return momentIndex > activeIndex ? "later" : "past";
}

function normalizeLongevityMoment(value: unknown): LongevityMoment | null {
  return LONGEVITY_MOMENT_ORDER.includes(value as LongevityMoment) ? value as LongevityMoment : null;
}

function normalizeLanguage(value: string | null | undefined): string {
  const language = String(value ?? "es").trim().toLowerCase().slice(0, 2);
  return language || "es";
}

function normalizeVideoLanguage(value: string | null | undefined): string {
  const language = normalizeLanguage(value);
  return PILLAR_VIDEO_RESOURCE_KEYS_BY_LANGUAGE[language] ? language : "en";
}

async function getRecentDailyContentIds(userId: string): Promise<string[]> {
  const rows = await optionalQuery<{ content_id: string }>("longevity_daily_content_log", `
    select content_id::text as content_id
    from public.longevity_daily_content_log
    where user_id = $1 and shown_on >= current_date - interval '14 days'
  `, [userId]);
  return rows.map((row) => row.content_id).filter(Boolean);
}

async function pickDailyContentRows(input: {
  type?: DailyContentType;
  types?: DailyContentType[];
  language: string;
  conditionTags: string[];
  recentIds: string[];
  daySeed: string;
  allowAllFallback: boolean;
  limit: number;
  pillarTag?: PreventionPillar | null;
  moment?: LongevityMoment | null;
  excludeRecent?: boolean;
}): Promise<DailyContentRow[]> {
  const tags = input.conditionTags.length > 0 ? input.conditionTags : ["__none__"];
  const types = input.types ?? (input.type ? [input.type] : ["exercise", "meal", "tip", "supplement", "natural_solution"]);
  const recentIds = input.excludeRecent === false ? [] : input.recentIds;
  const rows = await optionalQuery<DailyContentRow>("longevity_daily_content", `
    select id::text, content_type, title, description, detail_text, timing_guidance, source_label, source_url,
           condition_tags, pillar_tag, time_of_day, language, rotation_weight, moment, program_key,
           resource_title, duration_seconds, evidence_tags, safety_notes, mobility_fit, region_fit, review_status
    from public.longevity_daily_content
    where content_type = any($1::text[])
      and language = $2
      and is_active = true
      and coalesce(review_status, 'approved') = 'approved'
      and ($8::text is null or pillar_tag = $8::text)
      and (
        $9::text is null
        or moment is null
        or moment in ('any', $9::text)
        or time_of_day is null
        or time_of_day in ('any', $9::text)
        or ($9::text = 'midday' and moment in ('lunch'))
        or ($9::text = 'midday' and time_of_day in ('lunch'))
        or ($9::text = 'evening' and moment in ('night'))
        or ($9::text = 'evening' and time_of_day in ('night'))
      )
      and (
        condition_tags && $3::text[]
        or ($6::boolean = true and 'all' = any(condition_tags))
      )
      and (coalesce(array_length($4::uuid[], 1), 0) = 0 or id <> all($4::uuid[]))
    order by
      case when $9::text is not null and time_of_day = $9::text then 0 else 1 end,
      case when condition_tags && $3::text[] and not ('all' = any(condition_tags)) then 0 else 1 end,
      (abs(hashtext(id::text || $5::text))::double precision / greatest(rotation_weight, 1)) asc
    limit $7
  `, [types, input.language, tags, recentIds, input.daySeed, input.allowAllFallback, input.limit, input.pillarTag ?? null, input.moment ?? null]);

  if (rows.length > 0 || input.language === "es") return rows;
  return pickDailyContentRows({ ...input, language: "es" });
}

async function pickDailyContentRowsWithRecentFallback(input: Parameters<typeof pickDailyContentRows>[0]): Promise<DailyContentRow[]> {
  const freshRows = await pickDailyContentRows({ ...input, excludeRecent: true });
  if (freshRows.length > 0) return freshRows;
  return pickDailyContentRows({ ...input, excludeRecent: false });
}

function logDailyContentShown(userId: string, rows: DailyContentRow[]): void {
  const shownIds = rows.map((row) => row.id).filter(Boolean);
  if (shownIds.length === 0) return;
  void optionalQuery("longevity_daily_content_log", `
    insert into public.longevity_daily_content_log (user_id, content_id, shown_on)
    select $1, unnest($2::uuid[]), current_date
    on conflict (user_id, content_id, shown_on) do nothing
  `, [userId, shownIds]);
}

async function getDailyContentBundle(userId: string, conditions: string[], profile: ProfileSummary, activeMoment?: LongevityMoment) {
  const [recentIds] = await Promise.all([getRecentDailyContentIds(userId)]);
  const language = normalizeLanguage(profile.language_preference);
  const conditionTags = dailyContentTagsFor(conditions, false);
  const seed = todaySeed(profile.timezone);

  const [exerciseRows, mealRows, tipRows, supplementRows, naturalSolutionRows, articleRows, pillarEntries] = await Promise.all([
    pickDailyContentRowsWithRecentFallback({ type: "exercise", language, conditionTags, recentIds, daySeed: `${userId}:${activeMoment ?? "day"}:exercise:${seed}`, allowAllFallback: true, limit: 1, moment: activeMoment }),
    pickDailyContentRowsWithRecentFallback({ type: "meal", language, conditionTags, recentIds, daySeed: `${userId}:${activeMoment ?? "day"}:meal:${seed}`, allowAllFallback: true, limit: 1, moment: activeMoment }),
    pickDailyContentRowsWithRecentFallback({ type: "tip", language, conditionTags, recentIds, daySeed: `${userId}:${activeMoment ?? "day"}:tip:${seed}`, allowAllFallback: true, limit: 1, moment: activeMoment }),
    pickDailyContentRowsWithRecentFallback({ type: "supplement", language, conditionTags, recentIds, daySeed: `${userId}:${activeMoment ?? "day"}:supplement:${seed}`, allowAllFallback: true, limit: 1, moment: activeMoment }),
    pickDailyContentRowsWithRecentFallback({ type: "natural_solution", language, conditionTags, recentIds, daySeed: `${userId}:${activeMoment ?? "day"}:natural_solution:${seed}`, allowAllFallback: true, limit: 1, moment: activeMoment }),
    conditionTags.length > 0
      ? pickDailyContentRowsWithRecentFallback({ type: "article", language, conditionTags, recentIds, daySeed: `${userId}:${activeMoment ?? "day"}:article:${seed}`, allowAllFallback: false, limit: 2, moment: activeMoment })
      : Promise.resolve([]),
    Promise.all(PREVENTION_PILLARS.map(async (pillar) => [
      pillar,
      await pickDailyContentRowsWithRecentFallback({
        types: ["exercise", "meal", "tip", "supplement", "natural_solution", "article"],
        language,
        conditionTags,
        recentIds,
        daySeed: `${userId}:${pillar}:${seed}`,
        allowAllFallback: true,
        limit: 8,
        pillarTag: pillar,
      }),
    ] as const)),
  ]);

  return {
    exercise: exerciseRows[0] ?? null,
    meal: mealRows[0] ?? null,
    tip: tipRows[0] ?? null,
    supplement: supplementRows[0] ?? null,
    naturalSolution: naturalSolutionRows[0] ?? null,
    articles: articleRows.slice(0, 2),
    byPillar: Object.fromEntries(pillarEntries) as Record<PreventionPillar, DailyContentRow[]>,
  };
}

function uniqueDailyContentRows(rows: DailyContentRow[]): DailyContentRow[] {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function dailyContentRowsForActions(
  dailyContent: LongevityCompanionPayload["dailyContent"],
  actions: LongevityCompanionAction[],
): DailyContentRow[] {
  const selectedIds = new Set(actions.map((action) => action.content_id).filter((id): id is string => Boolean(id)));
  if (selectedIds.size === 0) return [];
  const availableRows = uniqueDailyContentRows([
    dailyContent.exercise,
    dailyContent.meal,
    dailyContent.tip,
    dailyContent.supplement,
    dailyContent.naturalSolution,
    ...dailyContent.articles,
    ...Object.values(dailyContent.byPillar).flat(),
  ].filter((row): row is DailyContentRow => Boolean(row)));
  return availableRows.filter((row) => selectedIds.has(row.id));
}

function worstPreventionPillar(scores: PreventionPillarScores): PreventionPillar | null {
  return [...PREVENTION_PILLARS]
    .sort((a, b) => PREVENTION_STATUS_RANK[scores[b]] - PREVENTION_STATUS_RANK[scores[a]])[0] ?? null;
}

const PREVENTION_REFRESH_TRIGGERS = new Set<PreventionRefreshTrigger>([
  "symptom_logged",
  "vitals_deviation",
  "adherence_drop",
  "cognitive_drop",
  "mood_decline",
  "user_requested",
  "scheduled",
]);

function normalizePreventionRefreshTrigger(value: unknown): PreventionRefreshTrigger {
  return PREVENTION_REFRESH_TRIGGERS.has(value as PreventionRefreshTrigger)
    ? value as PreventionRefreshTrigger
    : "user_requested";
}

async function getConditionProfile(conditions: string[]): Promise<ConditionProfile> {
  const tags = Array.from(new Set(conditions.map(normalizeConditionTag).filter((tag): tag is string => Boolean(tag))));
  const rows = tags.length
    ? await optionalQuery<{
        weighted_domains: Record<string, number>;
        framing_note: string;
        escalation_sensitivity: string | number;
      }>("condition_intelligence_profiles", `
        select weighted_domains, framing_note, escalation_sensitivity
        from public.condition_intelligence_profiles
        where is_active = true and condition_name = any($1::text[])
      `, [tags])
    : [];

  const defaultRows = await optionalQuery<{
    weighted_domains: Record<string, number>;
    framing_note: string;
    escalation_sensitivity: string | number;
  }>("condition_intelligence_profiles", `
    select weighted_domains, framing_note, escalation_sensitivity
    from public.condition_intelligence_profiles
    where condition_name = 'default'
    limit 1
  `);

  const base = defaultRows[0] ?? {
    weighted_domains: { vitals: 1, medication: 1, cognitive: 1, mood: 1, symptom: 1 },
    framing_note: "No specific condition profile. Apply equal domain weighting. Use standard wellness framing.",
    escalation_sensitivity: 1,
  };

  if (rows.length === 0) {
    return {
      weighted_domains: safeJson(base.weighted_domains, {}),
      framing_note: base.framing_note,
      escalation_sensitivity: Number(base.escalation_sensitivity) || 1,
    };
  }

  const merged: Record<string, number> = { ...safeJson(base.weighted_domains, {}) };
  const notes: string[] = [];
  let sensitivity = Number(base.escalation_sensitivity) || 1;
  for (const row of rows) {
    const weights = safeJson<Record<string, number>>(row.weighted_domains, {});
    for (const [domain, weight] of Object.entries(weights)) {
      merged[domain] = Math.max(merged[domain] ?? 1, Number(weight) || 1);
    }
    notes.push(row.framing_note);
    sensitivity = Math.max(sensitivity, Number(row.escalation_sensitivity) || 1);
  }

  return {
    weighted_domains: merged,
    framing_note: notes.join(" "),
    escalation_sensitivity: sensitivity,
  };
}

function computeConfidence(sourceSignals: Record<string, boolean>): number {
  const values = Object.values(sourceSignals);
  if (values.length === 0) return 0.25;
  const filled = values.filter(Boolean).length;
  return Math.max(0.25, Math.min(0.95, Math.round((filled / values.length) * 100) / 100));
}

function computeDomainTiers(data: SynthesisInput): DomainTiers {
  const vitalsTier = data.vitals ? Math.max(1, riskTierRank((data.vitals as Record<string, unknown>).risk_tier)) : 1;
  const medicationAdherence = Number((data.meds as Record<string, unknown> | null)?.adherence_pct ?? 100);
  const missedDoses = Number((data.meds as Record<string, unknown> | null)?.missed_doses ?? 0);
  const medicationTier = missedDoses >= 3 || medicationAdherence < 60 ? 4 : missedDoses >= 1 || medicationAdherence < 80 ? 3 : 1;
  const cognitiveTrend = String((data.cognitive as Record<string, unknown> | null)?.accuracy_trend ?? "stable");
  const cognitiveTier = cognitiveTrend === "declining" ? 3 : Number((data.cognitive as Record<string, unknown> | null)?.sessions_this_week ?? 1) === 0 ? 2 : 1;
  const moodTrend = String((data.mood as Record<string, unknown> | null)?.trend ?? "stable");
  const moodTier = moodTrend === "negative" ? 3 : Number((data.mood as Record<string, unknown> | null)?.poor_sleep_count ?? 0) >= 3 ? 2 : 1;
  const symptomUrgency = String((data.symptoms as Record<string, unknown> | null)?.latest_urgency ?? "").toLowerCase();
  const symptomTier = symptomUrgency.includes("urgent") || symptomUrgency.includes("emergency")
    ? 4
    : Number((data.symptoms as Record<string, unknown> | null)?.episodes_count ?? 0) > 0 ? 3 : 1;
  const conciergeDrop = Number((data.concierge as Record<string, unknown> | null)?.usage_delta ?? 0);
  const conciergeTier = conciergeDrop < -40 ? 3 : 1;

  return {
    vitals: vitalsTier,
    medication: medicationTier,
    cognitive: cognitiveTier,
    mood: moodTier,
    symptom: symptomTier,
    concierge: conciergeTier,
  };
}

function runCorrelationRules(data: SynthesisInput & { domainTiers: DomainTiers; sustained_low?: boolean }): CorrelationFlag[] {
  return [
    {
      rule: "adherence_mood_correlation",
      fired: Number((data.meds as Record<string, unknown> | null)?.adherence_pct ?? 100) < 70
        && (data.mood as Record<string, unknown> | null)?.trend === "negative",
      domains: ["medication", "mood"],
      severity: 3,
    },
    {
      rule: "cognitive_vitals_correlation",
      fired: (data.cognitive as Record<string, unknown> | null)?.accuracy_trend === "declining"
        && riskTierRank((data.vitals as Record<string, unknown> | null)?.risk_tier) >= 3,
      domains: ["cognitive", "vitals"],
      severity: 3,
    },
    {
      rule: "withdrawal_pattern",
      fired: Number((data.concierge as Record<string, unknown> | null)?.usage_delta ?? 0) < -40
        && Number((data.cognitive as Record<string, unknown> | null)?.sessions_this_week ?? 1) === 0
        && Number((data.mood as Record<string, unknown> | null)?.check_ins_logged ?? 3) < 2,
      domains: ["concierge", "cognitive", "mood"],
      severity: 4,
    },
    {
      rule: "symptom_medication_correlation",
      fired: Number((data.symptoms as Record<string, unknown> | null)?.episodes_count ?? 0) > 0
        && Number((data.meds as Record<string, unknown> | null)?.missed_doses ?? 0) >= 2,
      domains: ["symptom", "medication"],
      severity: 3,
    },
    {
      rule: "sustained_low_tier",
      fired: data.sustained_low === true,
      domains: ["all"],
      severity: 3,
    },
  ];
}

function applyConditionWeights(domainTiers: DomainTiers, weights: Record<string, number>): DomainTiers {
  const weighted: DomainTiers = {};
  for (const [domain, tier] of Object.entries(domainTiers)) {
    const aliasWeight = domain === "symptom" ? weights.symptom ?? weights.symptoms : undefined;
    const weight = Number(weights[domain] ?? aliasWeight ?? 1);
    weighted[domain] = Math.max(1, Math.min(5, Math.ceil(tier * weight)));
  }
  return weighted;
}

function getTopDomain(domainTiers: DomainTiers): string {
  return Object.entries(domainTiers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";
}

function scheduledDoseCount(times: unknown): number {
  const list = arrayOfText(times);
  return Math.max(1, list.length);
}

async function getVitalsSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const uuidRows = isUuid(userId)
    ? await optionalQuery<{
        risk_tier: string | null;
        risk_score: number | null;
        safety_status: string | null;
        pattern_labels: string[] | null;
        senior_message: string | null;
        analysed_at: Date | null;
      }>("vyva_pattern_windows", `
        select risk_tier, risk_score, safety_status, pattern_labels, senior_message, analysed_at
        from public.vyva_pattern_windows
        where user_id = $1::uuid and analysed_at >= $2
        order by analysed_at desc
        limit 1
      `, [userId, periodStart])
    : [];

  const signalRows = isUuid(userId)
    ? await optionalQuery<{
        signal_type: string;
        value: string | number;
        unit: string | null;
        recorded_at: Date;
      }>("vyva_signal_readings", `
        select distinct on (signal_type) signal_type, value, unit, recorded_at
        from public.vyva_signal_readings
        where user_id = $1::uuid and recorded_at >= $2
        order by signal_type, recorded_at desc
      `, [userId, periodStart])
    : [];

  const legacyRows = await optionalQuery<{
    bpm: number | null;
    respiratory_rate: number | null;
    metric_type: string | null;
    value: string | null;
    recorded_at: Date;
  }>("vitals_readings", `
    select bpm, respiratory_rate, metric_type, value, recorded_at
    from public.vitals_readings
    where user_id = $1 and recorded_at >= $2
    order by recorded_at desc
    limit 8
  `, [userId, periodStart]);

  if (uuidRows.length === 0 && signalRows.length === 0 && legacyRows.length === 0) return null;
  const latestWindow = uuidRows[0] ?? null;
  return {
    risk_tier: latestWindow?.risk_tier ?? "none",
    risk_score: latestWindow?.risk_score ?? 0,
    safety_status: latestWindow?.safety_status ?? "steady",
    pattern_labels: latestWindow?.pattern_labels ?? [],
    latest_message: latestWindow?.senior_message ?? null,
    latest_signals: signalRows,
    legacy_readings: legacyRows,
  };
}

async function getMedicationSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const meds = await optionalQuery<{ medication_name: string; scheduled_times: string[] | null }>("user_medications", `
    select medication_name, scheduled_times
    from public.user_medications
    where user_id = $1 and active = true
    limit 100
  `, [userId]);

  const adherence = await optionalQuery<{ status: string; created_at: Date }>("medication_adherence", `
    select status, created_at
    from public.medication_adherence
    where user_id = $1 and created_at >= $2
    order by created_at desc
    limit 500
  `, [userId, periodStart]);

  if (meds.length === 0 && adherence.length === 0) return null;
  const scheduledDoses = meds.reduce((total, med) => total + scheduledDoseCount(med.scheduled_times), 0);
  const taken = adherence.filter((row) => row.status === "taken").length;
  const missed = adherence.filter((row) => ["missed", "skipped", "late"].includes(row.status)).length;
  const denominator = taken + missed || scheduledDoses || 1;

  return {
    active_medications: meds.length,
    scheduled_daily_doses: scheduledDoses,
    taken_logs: taken,
    missed_doses: missed,
    adherence_pct: Math.round((taken / denominator) * 100),
  };
}

async function getCognitiveSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const rows = await optionalQuery<{
    sessions_this_week: string | number;
    completed_sessions: string | number;
    avg_accuracy: string | number | null;
    last_played_at: Date | null;
  }>("cognitive_session_index", `
    select
      count(*)::int as sessions_this_week,
      count(*) filter (where completed = true)::int as completed_sessions,
      avg(accuracy_pct) as avg_accuracy,
      max(played_at) as last_played_at
    from public.cognitive_session_index
    where user_id = $1 and played_at >= $2
  `, [userId, periodStart]);

  const summary = rows[0];
  if (!summary || Number(summary.sessions_this_week) === 0) return null;
  const avgAccuracy = Number(summary.avg_accuracy ?? 0);
  return {
    sessions_this_week: Number(summary.sessions_this_week),
    completed_sessions: Number(summary.completed_sessions),
    avg_accuracy: Number.isFinite(avgAccuracy) ? Math.round(avgAccuracy) : null,
    accuracy_trend: avgAccuracy > 0 && avgAccuracy < 55 ? "declining" : "stable",
    last_played_at: summary.last_played_at,
  };
}

async function getMoodSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const rows = await optionalQuery<{
    check_ins_logged: string | number;
    avg_energy: string | number | null;
    poor_sleep_count: string | number;
    latest_mood: string | null;
  }>("checkin_sessions", `
    select
      count(*)::int as check_ins_logged,
      avg(energy_level) as avg_energy,
      count(*) filter (where sleep_quality in ('poor','bad','low'))::int as poor_sleep_count,
      (array_agg(mood order by completed_at desc))[1] as latest_mood
    from public.checkin_sessions
    where user_id = $1 and completed_at >= $2
  `, [userId, periodStart]);

  const trendRows = await optionalQuery<{
    consecutive_low_mood: number;
    consecutive_poor_sleep: number;
    caregiver_flag_active: boolean;
  }>("checkin_trend_state", `
    select consecutive_low_mood, consecutive_poor_sleep, caregiver_flag_active
    from public.checkin_trend_state
    where user_id = $1
    limit 1
  `, [userId]);

  const summary = rows[0];
  const checkIns = Number(summary?.check_ins_logged ?? 0);
  if (checkIns === 0 && trendRows.length === 0) return null;
  const avgEnergy = Number(summary?.avg_energy ?? 0);
  const trendState = trendRows[0];
  const negative = (trendState?.consecutive_low_mood ?? 0) >= 2
    || (trendState?.caregiver_flag_active ?? false)
    || (Number.isFinite(avgEnergy) && avgEnergy > 0 && avgEnergy < 45);

  return {
    check_ins_logged: checkIns,
    avg_energy: Number.isFinite(avgEnergy) ? Math.round(avgEnergy) : null,
    poor_sleep_count: Number(summary?.poor_sleep_count ?? trendState?.consecutive_poor_sleep ?? 0),
    latest_mood: summary?.latest_mood ?? null,
    trend: negative ? "negative" : "stable",
  };
}

async function getSymptomSummary(userId: string, periodStart: Date): Promise<SummaryMap> {
  const rows = await optionalQuery<{
    episodes_count: string | number;
    latest_urgency: string | null;
    latest_chief_complaint: string | null;
    latest_created_at: Date | null;
  }>("triage_reports", `
    select
      count(*)::int as episodes_count,
      (array_agg(urgency order by created_at desc))[1] as latest_urgency,
      (array_agg(chief_complaint order by created_at desc))[1] as latest_chief_complaint,
      max(created_at) as latest_created_at
    from public.triage_reports
    where user_id = $1 and created_at >= $2
  `, [userId, periodStart]);

  const summary = rows[0];
  if (!summary || Number(summary.episodes_count) === 0) return null;
  return {
    episodes_count: Number(summary.episodes_count),
    latest_urgency: summary.latest_urgency,
    latest_chief_complaint: summary.latest_chief_complaint,
    latest_created_at: summary.latest_created_at,
  };
}

async function getConciergeSummary(userId: string, periodStart: Date, windowDays: number): Promise<SummaryMap> {
  const previousStart = new Date(periodStart.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await optionalQuery<{
    current_count: string | number;
    previous_count: string | number;
    latest_use_case: string | null;
  }>("concierge_sessions", `
    select
      count(*) filter (where started_at >= $2)::int as current_count,
      count(*) filter (where started_at >= $3 and started_at < $2)::int as previous_count,
      (array_agg(use_case order by started_at desc))[1] as latest_use_case
    from public.concierge_sessions
    where user_id = $1 and started_at >= $3
  `, [userId, periodStart, previousStart]);

  const summary = rows[0];
  if (!summary) return null;
  const current = Number(summary.current_count ?? 0);
  const previous = Number(summary.previous_count ?? 0);
  if (current === 0 && previous === 0) return null;
  const usageDelta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
  return {
    current_count: current,
    previous_count: previous,
    usage_delta: usageDelta,
    latest_use_case: summary.latest_use_case,
  };
}

async function isSustainedLowTier(userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const rows = await optionalQuery<{ count: string | number }>("health_insight_reports", `
    select count(*)::int
    from public.health_insight_reports
    where user_id = $1::uuid
      and status = 'active'
      and generated_at >= now() - interval '21 days'
      and severity_tier >= 3
  `, [userId]);
  return Number(rows[0]?.count ?? 0) >= 2;
}

async function checkRealTimeSignals(userId: string, since?: Date | string | null): Promise<RealtimeSignals> {
  const from = since ? new Date(since) : todayStart();
  const urgentFlags: string[] = [];
  let tierRaise = 1;

  const missedMed = await checkMissedMedicationToday(userId);
  if (missedMed) {
    urgentFlags.push(missedMed.message);
    tierRaise = Math.max(tierRaise, 3);
  }

  const symptomRows = await optionalQuery<{ chief_complaint: string | null; urgency: string | null }>("triage_reports", `
    select chief_complaint, urgency
    from public.triage_reports
    where user_id = $1 and created_at >= now() - interval '24 hours'
    order by created_at desc
    limit 1
  `, [userId]);
  if (symptomRows[0]) {
    urgentFlags.push(`Recent symptom: ${symptomRows[0].chief_complaint ?? "new report"}`);
    tierRaise = Math.max(tierRaise, symptomRows[0].urgency?.toLowerCase().includes("urgent") ? 4 : 3);
  }

  if (isUuid(userId)) {
    const patternRows = await optionalQuery<{ risk_tier: string; senior_message: string | null }>("vyva_pattern_windows", `
      select risk_tier, senior_message
      from public.vyva_pattern_windows
      where user_id = $1::uuid and analysed_at >= $2
      order by analysed_at desc
      limit 1
    `, [userId, from]);
    if (patternRows[0] && riskTierRank(patternRows[0].risk_tier) >= 3) {
      urgentFlags.push(patternRows[0].senior_message ?? "Vitals pattern needs attention");
      tierRaise = Math.max(tierRaise, riskTierRank(patternRows[0].risk_tier));
    }
  }

  return { tierRaise, urgentFlags: urgentFlags.slice(0, 4) };
}

async function selectActions(userId: string, tier: number, focusDomain: string | null | undefined, conditions: string[]): Promise<AgeWellAction[]> {
  const conditionTags = Array.from(new Set(["all", ...conditions.map(normalizeConditionTag).filter((tag): tag is string => Boolean(tag))]));
  const rows = await optionalQuery<AgeWellAction>("agewell_action_library", `
    select id, category, label, description, destination_type, destination_path,
           condition_tags, tier_min
    from public.agewell_action_library
    where is_active = true
      and language = $1
      and tier_min <= $2
      and (condition_tags && $3::text[] or 'all' = any(condition_tags))
      and (
        last_shown_at is null
        or last_outcome = 'hard'
        or (last_outcome = 'done' and last_shown_at < now() - avoid_after_done * interval '1 day')
        or (last_outcome = 'skip' and last_shown_at < now() - avoid_after_skip * interval '1 day')
      )
    order by
      case when category = $4 then 0 else 1 end,
      tier_min desc,
      coalesce(last_shown_at, '1970-01-01'::timestamptz) asc
    limit 24
  `, ["es", tier, conditionTags, focusDomain ?? ""]);

  if (rows.length === 0) return [];
  const picked: AgeWellAction[] = [];
  const add = (candidate?: AgeWellAction) => {
    if (candidate && !picked.some((action) => action.id === candidate.id)) picked.push(candidate);
  };

  add(rows.find((action) => categoryMatchesFocus(action.category, focusDomain)));
  add(rows.find((action) => action.category === "eat"));
  add(rows.find((action) => ["move", "calm"].includes(action.category)));
  add(rows.find((action) => ["avoid", "medicine", "home", "follow-up", "sleep"].includes(action.category)));

  for (const row of rows) {
    if (picked.length >= 3) break;
    add(row);
  }

  return picked.slice(0, 3).map((action) => ({
    ...action,
    destination_path: routeForAction(action),
  }));
}

async function generateDailyHeroCopy(input: {
  report: HealthInsightReport | null;
  effectiveTier: number;
  urgentFlags: string[];
  userProfile: ProfileSummary;
}): Promise<{ heroCopy: string; insightText: string }> {
  const { report, effectiveTier, urgentFlags, userProfile } = input;
  const tierContext: Record<number, string> = {
    1: "The user is broadly well-managed.",
    2: "There are one or two things worth gentle attention.",
    3: "There is something worth flagging to a doctor soon.",
    4: "There are meaningful signals worth caregiver awareness.",
    5: "There is an urgent signal; tone must still be calm, not alarming.",
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      heroCopy: `Hola, ${userProfile.first_name}.`,
      insightText: report?.synthesized_recommendation_senior
        ? truncate(report.synthesized_recommendation_senior, 90)
        : "Aqui tienes tu plan para hoy.",
    };
  }

  const prompt = `You are VYVA, a warm AI companion for seniors 65+.

Generate exactly two things:
1. HERO: One warm, personal sentence (max 12 words).
2. INSIGHT: One sentence explaining today's health focus (max 20 words).

Rules:
- User's first name: ${userProfile.first_name}
- Severity today: ${tierContext[effectiveTier] ?? tierContext[1]}
- Focus domain: ${report?.focus_domain ?? "general wellbeing"}
- Urgent signals: ${urgentFlags.length > 0 ? urgentFlags.join(", ") : "none"}
- Weekly summary: ${report?.synthesized_recommendation_senior ?? "No recent report; use general wellness framing."}
- Language: ${userProfile.language_preference ?? "es"}
- NEVER use: risk, elevated, abnormal, diagnosis, critical, dangerous
- NEVER suggest medication changes or dosage
- Tone: warm, calm, personal

Respond in this exact format only:
HERO: [sentence]
INSIGHT: [sentence]`;

  try {
    const responsePromise = anthropic.messages.create({
      model: HERO_MODEL,
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });
    const response = await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("hero copy timeout")), 1200)),
    ]);
    const block = response.content[0];
    const text = block?.type === "text" ? block.text : "";
    const heroMatch = text.match(/HERO:\s*(.+)/i);
    const insightMatch = text.match(/INSIGHT:\s*(.+)/i);
    return {
      heroCopy: heroMatch?.[1]?.trim() ?? `Hola, ${userProfile.first_name}.`,
      insightText: insightMatch?.[1]?.trim() ?? "Aqui tienes tu plan para hoy.",
    };
  } catch (err) {
    console.warn("[health-insights] Hero copy fallback used.", err);
    return {
      heroCopy: `Hola, ${userProfile.first_name}.`,
      insightText: "Aqui tienes tu plan para hoy.",
    };
  }
}

async function logDelivery(userId: string, reportId: string | null, actionId: string | null, surface: DeliveredSurface, tier: number): Promise<void> {
  if (!isUuid(userId)) return;
  await optionalQuery("insight_outcomes", `
    insert into public.insight_outcomes
      (user_id, report_id, action_id, tier_at_generation, delivered_surface, delivered_at)
    values ($1::uuid, nullif($2, $5)::uuid, nullif($3, $5)::uuid, $4, $6, now())
  `, [userId, reportId ?? UUID_ZERO, actionId ?? UUID_ZERO, Math.max(1, Math.min(5, tier)), UUID_ZERO, surface]);
}

async function updateFeedback(userId: string, actionId: string, outcome: ActionOutcome, reportId?: string | null): Promise<void> {
  if (!isUuid(userId) || !isUuid(actionId)) return;
  const report = reportId && isUuid(reportId) ? await getReportById(userId, reportId) : null;
  const existing = await optionalQuery<{ id: string }>("insight_outcomes", `
    select id
    from public.insight_outcomes
    where user_id = $1::uuid
      and action_id = $2::uuid
      and delivered_surface = 'agewell_plan'
      and delivered_at >= now() - interval '1 day'
    order by delivered_at desc
    limit 1
  `, [userId, actionId]);

  if (existing[0]) {
    await optionalQuery("insight_outcomes", `
      update public.insight_outcomes
      set acknowledged_at = now(),
          acknowledged_by = 'senior',
          action_taken = $1,
          follow_up_check_at = case when $1 = 'done' then now() + interval '7 days' else follow_up_check_at end
      where id = $2::uuid
    `, [outcome, existing[0].id]);
  } else {
    await optionalQuery("insight_outcomes", `
      insert into public.insight_outcomes
        (user_id, report_id, action_id, tier_at_generation, delivered_surface,
         acknowledged_at, acknowledged_by, action_taken, follow_up_check_at)
      values ($1::uuid, nullif($2, $6)::uuid, $3::uuid, $4, 'agewell_plan',
              now(), 'senior', $5,
              case when $5 = 'done' then now() + interval '7 days' else null end)
    `, [userId, report?.id ?? UUID_ZERO, actionId, report?.severity_tier ?? 1, outcome, UUID_ZERO]);
  }

  await optionalQuery("agewell_action_library", `
    update public.agewell_action_library
    set last_shown_at = now(), last_outcome = $1
    where id = $2::uuid
  `, [outcome, actionId]);
}

async function getReportById(userId: string, reportId: string): Promise<HealthInsightReport | null> {
  if (!isUuid(userId) || !isUuid(reportId)) return null;
  const rows = await optionalQuery<HealthInsightReport>("health_insight_reports", `
    select *
    from public.health_insight_reports
    where user_id = $1::uuid and id = $2::uuid
    limit 1
  `, [userId, reportId]);
  return rows[0] ?? null;
}

async function checkMissedMedicationToday(userId: string): Promise<{ message: string } | null> {
  const meds = await optionalQuery<{ medication_name: string; scheduled_times: string[] | null }>("user_medications", `
    select medication_name, scheduled_times
    from public.user_medications
    where user_id = $1 and active = true
    limit 50
  `, [userId]);
  if (meds.length === 0) return null;

  const takenRows = await optionalQuery<{ count: string | number }>("medication_adherence", `
    select count(*)::int
    from public.medication_adherence
    where user_id = $1 and status = 'taken' and created_at >= $2
  `, [userId, todayStart()]);
  const due = meds.reduce((total, med) => total + scheduledDoseCount(med.scheduled_times), 0);
  const taken = Number(takenRows[0]?.count ?? 0);
  if (due > taken) {
    const remaining = due - taken;
    return { message: remaining === 1 ? "One medicine dose still needs attention." : `${remaining} medicine doses still need attention.` };
  }
  return null;
}

async function wasNudgeShownToday(userId: string, reportId: string): Promise<boolean> {
  if (!isUuid(userId) || !isUuid(reportId)) return false;
  const rows = await optionalQuery<{ count: string | number }>("insight_outcomes", `
    select count(*)::int
    from public.insight_outcomes
    where user_id = $1::uuid
      and report_id = $2::uuid
      and delivered_surface = 'smart_nudge'
      and delivered_at >= $3
  `, [userId, reportId, todayStart()]);
  return Number(rows[0]?.count ?? 0) > 0;
}

async function checkBrainCoachDue(userId: string): Promise<{ message: string } | null> {
  const rows = await optionalQuery<{ recent_sessions: string | number; today_sessions: string | number }>("cognitive_session_index", `
    select
      count(*) filter (where played_at >= now() - interval '14 days')::int as recent_sessions,
      count(*) filter (where played_at >= $2)::int as today_sessions
    from public.cognitive_session_index
    where user_id = $1 and played_at >= now() - interval '14 days'
  `, [userId, todayStart()]);
  const row = rows[0];
  if (row && Number(row.recent_sessions) > 0 && Number(row.today_sessions) === 0) {
    return { message: "A short mind check is ready today." };
  }
  return null;
}

async function checkUpcomingAppointment(userId: string): Promise<{ message: string } | null> {
  const rows = await optionalQuery<{ title: string; scheduled_for: Date }>("scheduled_events", `
    select title, scheduled_for
    from public.scheduled_events
    where user_id = $1
      and status in ('upcoming','scheduled')
      and scheduled_for between now() and now() + interval '48 hours'
    order by scheduled_for asc
    limit 1
  `, [userId]);
  if (!rows[0]) return null;
  return { message: `Upcoming: ${truncate(rows[0].title, 80)}` };
}

async function getUserStreak(userId: string): Promise<{ days: number; message: string } | null> {
  const rows = await optionalQuery<{ streak_days: number }>("checkin_trend_state", `
    select streak_days
    from public.checkin_trend_state
    where user_id = $1
    limit 1
  `, [userId]);
  const days = Number(rows[0]?.streak_days ?? 0);
  return days > 1 ? { days, message: `${days} days of check-ins. Keep the rhythm.` } : null;
}

async function getActiveUserIds(): Promise<string[]> {
  const since = daysAgo(30);
  const sources = await Promise.all([
    optionalQuery<{ user_id: string }>("vyva_signal_readings", "select distinct user_id::text from public.vyva_signal_readings where created_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("medication_adherence", "select distinct user_id from public.medication_adherence where created_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("triage_reports", "select distinct user_id from public.triage_reports where created_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("checkin_sessions", "select distinct user_id from public.checkin_sessions where created_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("cognitive_session_index", "select distinct user_id from public.cognitive_session_index where played_at >= $1 limit 500", [since]),
    optionalQuery<{ user_id: string }>("concierge_sessions", "select distinct user_id from public.concierge_sessions where started_at >= $1 limit 500", [since]),
  ]);
  return Array.from(new Set(sources.flat().map((row) => row.user_id).filter(isUuid)));
}

function asSummary(value: SummaryMap): Record<string, unknown> {
  return value ?? {};
}

function numericValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function conditionIncludes(conditions: string[], name: string): boolean {
  return conditions.some((condition) => normalizeConditionTag(condition) === name || condition.toLowerCase().includes(name));
}

export function scorePillarHeart(input: {
  vitals: SummaryMap;
  meds: SummaryMap;
  conditions: string[];
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.vitals && !input.meds) return "steady";
  const vitals = asSummary(input.vitals);
  const meds = asSummary(input.meds);
  let score = 0;
  if (vitals.hr_trend === "elevated") score += 2;
  if (vitals.hr_trend === "significantly_elevated") score += 3;
  if (vitals.hrv_trend === "declining") score += 2;
  if (vitals.bp_deviation === true) score += 2;
  const adherence = numericValue(meds.cardiac_adherence_pct ?? meds.adherence_pct, 100);
  if (adherence < 70) score += 2;
  if (adherence < 50) score += 1;
  const weighted = score
    * numericValue(input.conditionProfile.weighted_domains.vitals, 1)
    * numericValue(input.conditionProfile.escalation_sensitivity, 1);
  if (weighted >= 6) return "priority_focus";
  if (weighted >= 3) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function scorePillarBrain(input: {
  cognitive: SummaryMap;
  mood: SummaryMap;
  conditions: string[];
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.cognitive && !input.mood) return "steady";
  const cognitive = asSummary(input.cognitive);
  const mood = asSummary(input.mood);
  let score = 0;
  if (cognitive.accuracy_trend === "declining") score += 2;
  if (numericValue(cognitive.tier_delta) < -1) score += 2;
  const sessions = numericValue(cognitive.sessions_this_month ?? cognitive.sessions_this_week);
  if (sessions < 4) score += 1;
  if (sessions === 0) score += 2;
  if (mood.trend === "negative") score += 1;
  if (mood.trend === "significantly_negative") score += 2;
  if (sessions === 0 && numericValue(mood.check_ins_logged) < 4) score += 2;
  const weighted = score
    * numericValue(input.conditionProfile.weighted_domains.cognitive, 1)
    * numericValue(input.conditionProfile.escalation_sensitivity, 1);
  if (weighted >= 6) return "priority_focus";
  if (weighted >= 3) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function scorePillarStrength(input: {
  vitals: SummaryMap;
  conditions: string[];
  symptoms: SummaryMap;
  medicationCount: number;
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.vitals && !input.symptoms && input.conditions.length === 0 && input.medicationCount === 0) return "steady";
  const symptoms = asSummary(input.symptoms);
  let score = conditionIncludes(input.conditions, "falls") ? 2 : 0;
  const symptomText = `${String(symptoms.latest_chief_complaint ?? "")} ${JSON.stringify(symptoms.episodes ?? [])}`.toLowerCase();
  const matches = symptomText.match(/dizz|weak|unstead|fall/g) ?? [];
  if (matches.length > 0) score += 2;
  if (matches.length > 2) score += 1;
  if (input.medicationCount >= 5) score += 1;
  const weighted = score
    * numericValue(input.conditionProfile.weighted_domains.move, 1)
    * numericValue(input.conditionProfile.escalation_sensitivity, 1);
  if (weighted >= 5) return "priority_focus";
  if (weighted >= 2) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function scorePillarNourishment(input: {
  meds: SummaryMap;
  mood: SummaryMap;
  conditions: string[];
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.meds && !input.mood && input.conditions.length === 0) return "steady";
  const meds = asSummary(input.meds);
  const mood = asSummary(input.mood);
  const active = Array.isArray(meds.active) ? meds.active as Array<Record<string, unknown>> : [];
  let score = active.some((med) => String(med.name ?? "").toLowerCase().includes("metformin")) ? 1 : 0;
  if (active.some((med) => String(med.therapeutic_class ?? "").toLowerCase().includes("diuretic"))) score += 1;
  if (mood.trend === "negative" && mood.fatigue_signals === true) score += 1;
  if (conditionIncludes(input.conditions, "oncology")) score += 2;
  const weighted = score
    * numericValue(input.conditionProfile.weighted_domains.eat, 1)
    * numericValue(input.conditionProfile.escalation_sensitivity, 1);
  if (weighted >= 4) return "priority_focus";
  if (weighted >= 2) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function scorePillarCalm(input: {
  mood: SummaryMap;
  vitals: SummaryMap;
  conditions: string[];
  conditionProfile: ConditionProfile;
}): PreventionPillarStatus {
  if (!input.mood && !input.vitals && input.conditions.length === 0) return "steady";
  const mood = asSummary(input.mood);
  const vitals = asSummary(input.vitals);
  let score = 0;
  if (mood.trend === "negative") score += 2;
  if (mood.trend === "significantly_negative") score += 3;
  const checkIns = numericValue(mood.check_ins_logged);
  if (checkIns < 4) score += 1;
  if (checkIns === 0) score += 2;
  if (vitals.hrv_trend === "declining") score += 1;
  const baseSensitivity = numericValue(input.conditionProfile.escalation_sensitivity, 1);
  const sensitivity = conditionIncludes(input.conditions, "anxiety") ? Math.min(baseSensitivity, 0.8) : baseSensitivity;
  const weighted = score * numericValue(input.conditionProfile.weighted_domains.mood, 1) * sensitivity;
  if (weighted >= 5) return "priority_focus";
  if (weighted >= 2) return "needs_attention";
  if (weighted === 0) return "thriving";
  return "steady";
}

export function detectCrossPillarPatterns(input: {
  pillarScores: PreventionPillarScores;
  vitals: SummaryMap;
  meds: SummaryMap;
  cognitive: SummaryMap;
  mood: SummaryMap;
  symptoms: SummaryMap;
}): CrossPillarPattern[] {
  const vitals = asSummary(input.vitals);
  const meds = asSummary(input.meds);
  const cognitive = asSummary(input.cognitive);
  const mood = asSummary(input.mood);
  const sessions = numericValue(cognitive.sessions_this_month ?? cognitive.sessions_this_week);
  const activeCount = numericValue(meds.active_count ?? meds.active_medications);
  const adherence = numericValue(meds.overall_adherence_pct ?? meds.adherence_pct, 100);
  return [
    { pattern: "silent_withdrawal_spiral", fired: sessions === 0 && mood.trend === "negative" && numericValue(mood.check_ins_logged) < 3, severity: "priority_focus", pillars_affected: ["brain", "calm"] },
    { pattern: "sleep_cognitive_loop", fired: numericValue(mood.morning_vs_evening_delta) < -1.5 && cognitive.accuracy_trend === "declining", severity: "needs_attention", pillars_affected: ["brain", "calm"] },
    { pattern: "medication_cascade", fired: activeCount >= 5 && adherence < 70 && mood.trend === "negative", severity: "needs_attention", pillars_affected: ["nourishment", "calm"] },
    { pattern: "cardiovascular_cognitive_convergence", fired: vitals.hr_trend === "elevated" && cognitive.accuracy_trend === "declining", severity: "needs_attention", pillars_affected: ["heart", "brain"] },
    { pattern: "nutritional_decline", fired: mood.fatigue_signals === true && activeCount >= 3 && mood.trend === "negative", severity: "needs_attention", pillars_affected: ["nourishment", "strength"] },
  ];
}

export function resolvePriorityPillar(scores: PreventionPillarScores, conditions: string[]): PreventionPillar | null {
  const candidates = PREVENTION_PILLARS.filter((pillar) => scores[pillar] === "priority_focus");
  if (candidates.length === 0) return null;
  const preferred = conditionIncludes(conditions, "alzheimers") ? "brain"
    : conditionIncludes(conditions, "heart") ? "heart"
      : conditionIncludes(conditions, "falls") ? "strength"
        : null;
  return preferred && candidates.includes(preferred) ? preferred : candidates[0];
}

export function enforceSinglePriority(scores: PreventionPillarScores, priority: PreventionPillar | null): PreventionPillarScores {
  return Object.fromEntries(PREVENTION_PILLARS.map((pillar) => [
    pillar,
    scores[pillar] === "priority_focus" && pillar !== priority ? "needs_attention" : scores[pillar],
  ])) as PreventionPillarScores;
}

function computePreventionTrajectory(scores: PreventionPillarScores, previous: LongevityPreventionPlan | null): LongevityPreventionPlan["trajectory"] {
  if (!previous) return "first";
  const currentTotal = PREVENTION_PILLARS.reduce((total, pillar) => total + PREVENTION_STATUS_RANK[scores[pillar]], 0);
  const previousTotal = PREVENTION_PILLARS.reduce((total, pillar) => total + PREVENTION_STATUS_RANK[previous[`pillar_${pillar}`]], 0);
  if (currentTotal < previousTotal) return "improving";
  if (currentTotal > previousTotal) return "declining";
  return "stable";
}

const PREVENTION_RECOMMENDATIONS: Record<PreventionPillar, Record<PreventionPillarStatus, PreventionRecommendation[]>> = {
  heart: {
    thriving: [{ action: "Tai chi", why: "A guided VYVA movement session keeps the heart step active without making it feel heavy." }, { action: "Chair yoga", why: "Chair-based movement keeps the routine easy to repeat." }],
    steady: [{ action: "Chest opener", why: "A short guided exercise pairs posture, breath, and light movement." }, { action: "Tai chi", why: "Slow balance work keeps movement practical and engaging." }],
    needs_attention: [{ action: "Chair yoga", why: "A seated option is easier to begin on lower-energy days." }, { action: "Ankle mobility", why: "Gentle lower-leg movement is a clear starting point." }],
    priority_focus: [{ action: "Tai chi", why: "A guided movement exercise is the clearest heart step for today." }, { action: "Chair yoga", why: "Chair support keeps the movement step approachable." }],
  },
  brain: {
    thriving: [{ action: "Try a new memory challenge", why: "Variety keeps brain practice engaging." }, { action: "Share one story with someone you enjoy", why: "Connection supports memory and wellbeing." }],
    steady: [{ action: "Play one short puzzle today", why: "A bounded challenge is easier to keep than a vague habit." }, { action: "Aim for the same bedtime each night", why: "Rest supports attention and memory." }],
    needs_attention: [{ action: "Start with a two-minute memory game", why: "A short game can rebuild momentum without feeling heavy." }, { action: "Plan one meaningful conversation", why: "Social connection keeps the mind engaged." }],
    priority_focus: [{ action: "Choose today's Brain Coach challenge", why: "A named challenge gives the brain step a clear start and finish." }, { action: "Set a consistent bedtime starting tonight", why: "Rest is the foundation for this month's brain focus." }],
  },
  strength: {
    thriving: [{ action: "Keep moving every day", why: "Any comfortable movement counts." }, { action: "Include protein at each meal", why: "Daily protein supports muscle." }],
    steady: [{ action: "Try ten minutes of chair exercises daily", why: "Seated strength work supports stability." }, { action: "Clear your walking path tonight", why: "A clear route makes movement easier and safer." }],
    needs_attention: [{ action: "Do chair exercises each morning", why: "A routine is easier to maintain than occasional exercise." }, { action: "Walk through your home and remove obstacles", why: "A clear home supports confident movement." }],
    priority_focus: [{ action: "Begin with ten minutes of seated strength work", why: "Strength is the most useful focus this month." }, { action: "Arrange a home safety check this week", why: "Practical changes can support stability." }],
  },
  nourishment: {
    thriving: [{ action: "Keep adding colour to your plate", why: "Variety supports balanced eating." }, { action: "Keep water within easy reach", why: "Regular hydration supports energy and clarity." }],
    steady: [{ action: "Add a protein food to each meal", why: "Daily protein supports strength and recovery." }, { action: "Set simple water reminders", why: "A prompt makes hydration easier to remember." }],
    needs_attention: [{ action: "Choose protein first at each meal", why: "This is a simple way to support daily nourishment." }, { action: "Ask VYVA for an easy meal idea", why: "A little planning can make meals easier." }],
    priority_focus: [{ action: "Plan protein and water for today", why: "These are the most useful nourishment steps this month." }, { action: "Ask Concierge to help plan this week's food", why: "Practical support can make the plan easier." }],
  },
  calm: {
    thriving: [{ action: "Repeat the wind-down that worked recently", why: "Keeping the same cue protects a routine that already feels manageable." }, { action: "Keep one quiet pause in the day", why: "A familiar pause is easier to keep than a new habit." }],
    steady: [{ action: "Open the Breath Garden for two minutes", why: "A short reset fits days when calm support is useful." }, { action: "Choose tonight's wind-down time", why: "A predictable evening gives the day a softer landing." }],
    needs_attention: [{ action: "Start with one two-minute Breath Garden reset", why: "The step stays small while mood or rest signals need support." }, { action: "Message someone who lifts your spirits", why: "Connection can make a difficult day feel lighter." }],
    priority_focus: [{ action: "Pick one calm reset after breakfast", why: "Anchoring the step to an existing moment makes it easier to repeat." }, { action: "Make one meaningful social contact today", why: "Connection supports emotional wellbeing." }],
  },
};

const PILLAR_LABELS: Record<PreventionPillar, string> = {
  heart: "Heart and circulation",
  brain: "Brain and memory",
  strength: "Strength and stability",
  nourishment: "Nourishment",
  calm: "Calm and recovery",
};

function lowerFirstText(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function sentence(value: string): string {
  const clean = oneLine(value);
  if (!clean) return clean;
  return /[.!?]$/.test(clean) ? clean : clean + ".";
}

function actionKeyFor(pillar: PreventionPillar | null, title: string): string {
  const slug = oneLine(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
  return `${pillar ?? "general"}:${slug || "action"}`;
}

function deterministicScore(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function statusForPillar(plan: LongevityPreventionPlan, pillar: PreventionPillar): PreventionPillarStatus {
  return plan[`pillar_${pillar}`];
}

function priorityPillarForPlan(plan: LongevityPreventionPlan): PreventionPillar | null {
  if (plan.priority_pillar) return plan.priority_pillar;
  return worstPreventionPillar({
    heart: plan.pillar_heart,
    brain: plan.pillar_brain,
    strength: plan.pillar_strength,
    nourishment: plan.pillar_nourishment,
    calm: plan.pillar_calm,
  });
}

function pillarRecommendationOptions(plan: LongevityPreventionPlan, pillar: PreventionPillar): PreventionRecommendation[] {
  const planned = safeJson<PreventionRecommendations>(plan.recommendations, {} as PreventionRecommendations)[pillar] ?? [];
  const fromPriority = plan.priority_pillar === pillar && plan.priority_intervention
    ? [{ action: plan.priority_intervention, why: plan.priority_why ?? planned[0]?.why ?? "This is the current priority step." }]
    : [];
  return [...fromPriority, ...planned];
}

function conditionTagLabel(tag: string): string {
  if (tag === "alzheimers") return "memory";
  if (tag === "falls") return "mobility";
  if (tag === "heart") return "heart";
  if (tag === "diabetes") return "glucose";
  if (tag === "anxiety") return "calm";
  if (tag === "oncology") return "oncology";
  return tag;
}

function signal(
  id: string,
  label: string,
  detail: string,
  source: LongevityCompanionSignal["source"],
  pillar: PreventionPillar | null,
  tone: LongevityCompanionSignal["tone"] = "attention",
): LongevityCompanionSignal {
  return { id, label, detail: sentence(detail), source, pillar, tone };
}

function buildCompanionSignals(input: {
  conditions: string[];
  vitals: SummaryMap;
  meds: SummaryMap;
  cognitive: SummaryMap;
  mood: SummaryMap;
  symptoms: SummaryMap;
  feedbackHistory: LongevityActionEventRow[];
}): LongevityCompanionSignal[] {
  const signals: LongevityCompanionSignal[] = [];
  const conditionTags = Array.from(new Set(input.conditions.map(normalizeConditionTag).filter((tag): tag is string => Boolean(tag))));
  if (conditionTags.length > 0) {
    const labels = conditionTags.slice(0, 3).map(conditionTagLabel).join(", ");
    signals.push(signal("profile-conditions", "Profile context", `Your profile includes ${labels} context`, "profile", null, "steady"));
  }

  const meds = asSummary(input.meds);
  const missedDoses = numericValue(meds.missed_doses);
  const activeMeds = numericValue(meds.active_medications);
  if (missedDoses > 0) {
    signals.push(signal("meds-missed", "Medicine routine", `${missedDoses} missed or late medicine logs appeared in the recent window`, "medication", "heart"));
  } else if (activeMeds > 0) {
    signals.push(signal("meds-active", "Medicine routine", `${activeMeds} active medicines are part of the plan context`, "medication", "heart", "steady"));
  }

  const cognitive = asSummary(input.cognitive);
  const sessions = numericValue(cognitive.sessions_this_week ?? cognitive.sessions_this_month);
  if (input.cognitive && sessions === 0) {
    signals.push(signal("brain-no-sessions", "Brain Coach", "No recent Brain Coach sessions are logged", "brain", "brain"));
  } else if (input.cognitive && sessions > 0) {
    signals.push(signal("brain-sessions", "Brain Coach", `${sessions} recent Brain Coach sessions are logged`, "brain", "brain", "positive"));
  }
  if (cognitive.accuracy_trend === "declining") {
    signals.push(signal("brain-trend", "Brain Coach", "Recent Brain Coach accuracy has been lower", "brain", "brain"));
  }

  const mood = asSummary(input.mood);
  const poorSleep = numericValue(mood.poor_sleep_count);
  const checkIns = numericValue(mood.check_ins_logged);
  if (poorSleep > 0) {
    signals.push(signal("sleep-checkins", "Sleep check-ins", `${poorSleep} poor-sleep check-ins are in the recent window`, "check-in", "calm"));
  }
  if (mood.trend === "negative") {
    signals.push(signal("mood-trend", "Check-ins", "Recent check-ins point to lower energy or mood", "check-in", "calm"));
  } else if (checkIns > 0) {
    signals.push(signal("checkins-present", "Check-ins", `${checkIns} recent check-ins are available`, "check-in", "calm", "steady"));
  }

  const symptoms = asSummary(input.symptoms);
  const complaint = oneLine(String(symptoms.latest_chief_complaint ?? ""));
  if (complaint) {
    signals.push(signal("latest-symptom", "Recent symptom", `Latest symptom report: ${complaint}`, "symptom", "strength"));
  }

  const vitals = asSummary(input.vitals);
  const latestMessage = oneLine(String(vitals.latest_message ?? ""));
  const patterns = arrayOfText(vitals.pattern_labels);
  if (latestMessage) {
    signals.push(signal("vitals-message", "Vitals", latestMessage, "vitals", "heart"));
  } else if (patterns.length > 0) {
    signals.push(signal("vitals-patterns", "Vitals", `Recent readings include ${patterns.slice(0, 2).join(" and ")}`, "vitals", "heart"));
  }

  const recentHard = input.feedbackHistory.find((event) => event.event_type === "too_hard");
  const recentIrrelevant = input.feedbackHistory.find((event) => event.event_type === "not_relevant");
  if (recentHard) {
    signals.push(signal("feedback-hard", "Your feedback", `"${recentHard.action_title}" was marked too hard recently`, "feedback", recentHard.pillar, "steady"));
  } else if (recentIrrelevant) {
    signals.push(signal("feedback-not-relevant", "Your feedback", `"${recentIrrelevant.action_title}" was marked not relevant recently`, "feedback", recentIrrelevant.pillar, "steady"));
  }

  return signals.slice(0, 8);
}

function eventAgeDays(event: LongevityActionEventRow): number {
  const date = new Date(event.created_at);
  if (Number.isNaN(date.getTime())) return 999;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

function suppressedActionKeys(feedbackHistory: LongevityActionEventRow[]): Set<string> {
  const keys = new Set<string>();
  for (const event of feedbackHistory) {
    const age = eventAgeDays(event);
    if (event.event_type === "not_relevant" && age <= 30) keys.add(event.action_key);
    if (event.event_type === "too_hard" && age <= 7) keys.add(event.action_key);
    if (event.event_type === "done" && age <= 1) keys.add(event.action_key);
  }
  return keys;
}

function isoDateOnly(value: Date | string | null | undefined): string {
  if (!value) return todaySeed();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return todaySeed();
  return date.toISOString().slice(0, 10);
}

function addDaysToIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetweenIsoDates(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / (24 * 60 * 60 * 1000)));
}

function programDayIndex(startDate: string, rotationDate: string): number {
  return (daysBetweenIsoDates(startDate, rotationDate) % LONGEVITY_PROGRAM_TOTAL_DAYS) + 1;
}

function orderedStarterProgramTemplates(priorityPillar: PreventionPillar | null): Array<LongevityProgramDayTemplate & { dayIndex: number }> {
  const startIndex = priorityPillar
    ? STARTER_PROGRAM_TEMPLATES.findIndex((template) => template.pillar === priorityPillar)
    : 0;
  const ordered = startIndex > 0
    ? [...STARTER_PROGRAM_TEMPLATES.slice(startIndex), ...STARTER_PROGRAM_TEMPLATES.slice(0, startIndex)]
    : STARTER_PROGRAM_TEMPLATES;
  return ordered.map((template, index) => ({ ...template, dayIndex: index + 1 }));
}

function mapProgramRow(row: LongevityProgramRow): LongevityActiveProgram {
  return {
    id: row.id,
    programKey: row.program_key,
    title: row.title,
    status: row.status,
    focusPillars: row.focus_pillars,
    startDate: isoDateOnly(row.start_date),
    currentDay: Number(row.current_day) || 1,
    totalDays: Number(row.total_days) || LONGEVITY_PROGRAM_TOTAL_DAYS,
    language: row.language,
    cadence: row.cadence,
  };
}

function mapProgramDayRow(row: LongevityProgramDayRow): LongevityProgramStep {
  return {
    id: row.id,
    programId: row.program_id,
    dayIndex: Number(row.day_index) || 1,
    pillar: row.pillar,
    theme: row.theme,
    objective: row.objective,
    actionTitle: row.action_title,
    actionDetail: row.action_detail,
    videoQuery: row.video_query,
    scheduledDate: isoDateOnly(row.scheduled_date),
    status: row.status,
  };
}

function mapVideoRow(row: LongevityVideoResourceRow): LongevityVideoResource {
  const fallback = fallbackVideoInsightFor({
    videoId: row.video_id,
    summary: row.summary,
    selectedReason: row.selected_reason,
    curationStatus: row.curation_status,
    pillar: row.pillar ?? null,
    transcriptSummary: row.transcript_summary ?? null,
    afterWatchAction: row.after_watch_action ?? null,
    goodFor: row.good_for ?? [],
    notFor: row.not_for ?? [],
    momentFit: row.moment_fit ?? [],
  });
  const keyPoints = normalizedVideoKeyPoints(row.key_points);
  const pillar = normalizePreventionPillar(row.pillar) ?? inferFallbackVideoPillar(row.video_id);
  const goodFor = normalizedVideoList(row.good_for);
  const notFor = normalizedVideoList(row.not_for);
  const momentFit = normalizedMomentFit(row.moment_fit);
  return {
    id: row.id,
    provider: row.provider,
    pillar,
    videoId: row.video_id,
    url: row.url,
    title: row.title,
    channel: row.channel,
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    thumbnailUrl: row.thumbnail_url,
    language: row.language,
    summary: row.summary,
    selectedReason: row.selected_reason,
    safetyNotes: row.safety_notes,
    transcriptStatus: normalizeVideoTranscriptStatus(row.transcript_status ?? fallback.transcriptStatus),
    keyPoints: keyPoints.length ? keyPoints : fallback.keyPoints,
    seniorTakeaway: sentence(row.senior_takeaway ?? fallback.seniorTakeaway),
    transcriptSummary: sentence(row.transcript_summary ?? fallback.transcriptSummary ?? row.summary ?? ""),
    afterWatchAction: sentence(row.after_watch_action ?? fallback.afterWatchAction ?? row.senior_takeaway ?? fallback.seniorTakeaway),
    goodFor: goodFor.length ? goodFor : normalizedVideoList(fallback.goodFor),
    notFor: notFor.length ? notFor : normalizedVideoList(fallback.notFor),
    momentFit: momentFit.length ? momentFit : normalizedMomentFit(fallback.momentFit),
  };
}

function fallbackProgramRow(input: {
  userId: string;
  profile: ProfileSummary;
  priorityPillar: PreventionPillar | null;
  startDate: string;
  rotationDate: string;
}): LongevityProgramRow {
  const dayIndex = programDayIndex(input.startDate, input.rotationDate);
  return {
    id: randomUUID(),
    user_id: input.userId,
    program_key: LONGEVITY_PROGRAM_KEY,
    title: "14-day VYVA longevity starter",
    status: "active",
    focus_pillars: orderedStarterProgramTemplates(input.priorityPillar).map((template) => template.pillar),
    start_date: input.startDate,
    current_day: dayIndex,
    total_days: LONGEVITY_PROGRAM_TOTAL_DAYS,
    language: normalizeLanguage(input.profile.language_preference),
    cadence: "daily",
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function fallbackProgramDayRow(input: {
  program: LongevityProgramRow;
  priorityPillar: PreventionPillar | null;
  dayIndex: number;
}): LongevityProgramDayRow {
  const template = orderedStarterProgramTemplates(input.priorityPillar)[input.dayIndex - 1]
    ?? orderedStarterProgramTemplates(input.priorityPillar)[0];
  const startDate = isoDateOnly(input.program.start_date);
  return {
    id: randomUUID(),
    program_id: input.program.id,
    user_id: input.program.user_id,
    day_index: template.dayIndex,
    pillar: template.pillar,
    theme: template.theme,
    objective: template.objective,
    action_title: template.actionTitle,
    action_detail: template.actionDetail,
    video_query: template.videoQuery,
    fallback_video_key: template.fallbackVideoKey,
    scheduled_date: addDaysToIsoDate(startDate, template.dayIndex - 1),
    status: "scheduled",
    shown_at: null,
    completed_at: null,
    skipped_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function exactYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname !== "/watch") return null;
      const id = parsed.searchParams.get("v");
      return id && /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id && /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

function exactYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function isExactYoutubeWatchUrl(url: string | null | undefined): boolean {
  return Boolean(exactYoutubeVideoId(url));
}

function normalizeVideoTranscriptStatus(value: unknown): LongevityVideoTranscriptStatus {
  return value === "available" || value === "unavailable" || value === "manual_reviewed" || value === "pending"
    ? value
    : "pending";
}

function normalizedVideoKeyPoints(value: unknown): string[] {
  return arrayOfText(value)
    .map((item) => sentence(item))
    .filter(Boolean)
    .slice(0, 3);
}

function normalizedVideoList(value: unknown, limit = 3): string[] {
  return arrayOfText(value)
    .map((item) => sentence(item))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizedMomentFit(value: unknown): LongevityMoment[] {
  return Array.isArray(value)
    ? value.filter((item): item is LongevityMoment => LONGEVITY_MOMENT_ORDER.includes(item as LongevityMoment))
    : [];
}

function inferFallbackVideoPillar(videoId: string): PreventionPillar | null {
  const match = Object.entries(FALLBACK_VIDEO_LIBRARY)
    .find(([, candidate]) => candidate.videoId === videoId);
  if (!match) return null;
  return PREVENTION_PILLARS.find((pillar) => match[0].startsWith(`${pillar}-`)) ?? null;
}

function videoMetadataDefaults(pillar: PreventionPillar | null | undefined) {
  return pillar ? DEFAULT_VIDEO_METADATA_BY_PILLAR[pillar] : DEFAULT_GENERIC_VIDEO_METADATA;
}

function fallbackVideoInsightFor(candidate: Pick<LongevityVideoCandidate, "videoId" | "summary" | "selectedReason" | "curationStatus" | "pillar" | "transcriptSummary" | "afterWatchAction" | "goodFor" | "notFor" | "momentFit">): LongevityVideoInsight {
  const pillar = candidate.pillar ?? inferFallbackVideoPillar(candidate.videoId);
  const defaults = videoMetadataDefaults(pillar);
  const reviewed = FALLBACK_VIDEO_INSIGHTS_BY_ID[candidate.videoId];
  if (reviewed) {
    return {
      ...reviewed,
      transcriptSummary: sentence(candidate.transcriptSummary ?? reviewed.transcriptSummary ?? candidate.summary ?? defaults.transcriptSummary),
      afterWatchAction: sentence(candidate.afterWatchAction ?? reviewed.afterWatchAction ?? reviewed.seniorTakeaway ?? defaults.afterWatchAction),
      goodFor: normalizedVideoList(candidate.goodFor).length ? normalizedVideoList(candidate.goodFor) : normalizedVideoList(reviewed.goodFor).length ? normalizedVideoList(reviewed.goodFor) : defaults.goodFor,
      notFor: normalizedVideoList(candidate.notFor).length ? normalizedVideoList(candidate.notFor) : normalizedVideoList(reviewed.notFor).length ? normalizedVideoList(reviewed.notFor) : defaults.notFor,
      momentFit: normalizedMomentFit(candidate.momentFit).length ? normalizedMomentFit(candidate.momentFit) : normalizedMomentFit(reviewed.momentFit).length ? normalizedMomentFit(reviewed.momentFit) : defaults.momentFit,
    };
  }
  const keyPoints = normalizedVideoKeyPoints([
    candidate.summary,
    candidate.selectedReason,
  ]);
  return {
    transcriptStatus: candidate.curationStatus === "fallback" ? "manual_reviewed" : "pending",
    keyPoints: keyPoints.length ? keyPoints : ["Use this as a short visual cue, then keep today's next step small."],
    seniorTakeaway: candidate.summary || candidate.selectedReason || "Use this as a short visual cue, then keep today's next step small.",
    transcriptSummary: sentence(candidate.transcriptSummary ?? candidate.summary ?? defaults.transcriptSummary),
    afterWatchAction: sentence(candidate.afterWatchAction ?? defaults.afterWatchAction),
    goodFor: normalizedVideoList(candidate.goodFor).length ? normalizedVideoList(candidate.goodFor) : defaults.goodFor,
    notFor: normalizedVideoList(candidate.notFor).length ? normalizedVideoList(candidate.notFor) : defaults.notFor,
    momentFit: normalizedMomentFit(candidate.momentFit).length ? normalizedMomentFit(candidate.momentFit) : defaults.momentFit,
  };
}

function videoCandidateWithInsights(candidate: LongevityVideoCandidate): LongevityVideoCandidate {
  const pillar = candidate.pillar ?? inferFallbackVideoPillar(candidate.videoId);
  const fallback = fallbackVideoInsightFor({ ...candidate, pillar });
  const keyPoints = normalizedVideoKeyPoints(candidate.keyPoints);
  const goodFor = normalizedVideoList(candidate.goodFor);
  const notFor = normalizedVideoList(candidate.notFor);
  const momentFit = normalizedMomentFit(candidate.momentFit);
  return {
    ...candidate,
    pillar,
    transcriptStatus: normalizeVideoTranscriptStatus(candidate.transcriptStatus ?? fallback.transcriptStatus),
    keyPoints: keyPoints.length ? keyPoints : fallback.keyPoints,
    seniorTakeaway: sentence(candidate.seniorTakeaway ?? fallback.seniorTakeaway),
    transcriptSummary: sentence(candidate.transcriptSummary ?? fallback.transcriptSummary ?? candidate.summary ?? ""),
    afterWatchAction: sentence(candidate.afterWatchAction ?? fallback.afterWatchAction ?? candidate.seniorTakeaway ?? fallback.seniorTakeaway),
    goodFor: goodFor.length ? goodFor : normalizedVideoList(fallback.goodFor),
    notFor: notFor.length ? notFor : normalizedVideoList(fallback.notFor),
    momentFit: momentFit.length ? momentFit : normalizedMomentFit(fallback.momentFit),
  };
}

function liveVideoInsightForStep(step: LongevityProgramDayRow, summary: string | null): Pick<LongevityVideoCandidate, "transcriptStatus" | "keyPoints" | "seniorTakeaway" | "transcriptSummary" | "afterWatchAction" | "goodFor" | "notFor" | "momentFit"> {
  const defaults = videoMetadataDefaults(step.pillar);
  const keyPoints = normalizedVideoKeyPoints([
    step.objective,
    summary,
    `After watching, try: ${step.action_title}.`,
  ]);
  return {
    transcriptStatus: "pending",
    keyPoints,
    seniorTakeaway: `Use the video as today's ${PILLAR_LABELS[step.pillar]} cue, then try one small companion step.`,
    transcriptSummary: summary || step.objective || defaults.transcriptSummary,
    afterWatchAction: step.action_detail || defaults.afterWatchAction,
    goodFor: defaults.goodFor,
    notFor: defaults.notFor,
    momentFit: defaults.momentFit,
  };
}

function isoDurationToSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total > 0 ? total : null;
}

function unsafeVideoText(value: string): boolean {
  return /\b(miracle|cure|reverse(?:s|d)?|secret|shocking|urgent|warning|detox|supplement|hack|never eat|doctors hate)\b/i.test(value);
}

function videoCandidateIsSafe(candidate: LongevityVideoCandidate): boolean {
  if (!isExactYoutubeWatchUrl(candidate.url)) return false;
  const text = `${candidate.title} ${candidate.summary ?? ""} ${candidate.selectedReason}`;
  if (unsafeVideoText(text)) return false;
  const reviewedLongerException = candidate.videoId === "BHY0FxzoKZE" && candidate.curationStatus === "fallback";
  if (candidate.durationSeconds != null && candidate.durationSeconds > 12 * 60 && !reviewedLongerException) return false;
  return true;
}

function sourceContextVideoId(event: LongevityActionEventRow): string | null {
  const context = safeJson<Record<string, unknown>>(event.source_context, {});
  const videoId = typeof context.videoId === "string" ? context.videoId : null;
  return videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId) ? videoId : null;
}

function suppressedVideoIds(feedbackHistory: LongevityActionEventRow[]): Set<string> {
  const ids = new Set<string>();
  for (const event of feedbackHistory) {
    const videoId = sourceContextVideoId(event);
    if (!videoId) continue;
    const age = eventAgeDays(event);
    if (event.event_type === "not_relevant" && age <= 30) ids.add(videoId);
    if (event.event_type === "too_hard" && age <= 7) ids.add(videoId);
    if (event.event_type === "done" && age <= 1) ids.add(videoId);
  }
  return ids;
}

function reviewedVideoCandidateForPillar(pillar: PreventionPillar | null, language?: string | null): LongevityVideoCandidate | null {
  if (!pillar) return null;
  const normalized = normalizeVideoLanguage(language);
  const key = PILLAR_VIDEO_RESOURCE_KEYS_BY_LANGUAGE[normalized]?.[pillar]
    ?? PILLAR_VIDEO_RESOURCE_KEYS_BY_LANGUAGE.en[pillar];
  const candidate = FALLBACK_VIDEO_LIBRARY[key];
  return candidate && videoCandidateIsSafe(candidate) ? videoCandidateWithInsights(candidate) : null;
}

function localizedFallbackVideoKey(key: string, language?: string | null): string {
  const normalized = normalizeVideoLanguage(language);
  if (normalized === "en") return key;
  const englishPillar = (Object.entries(PILLAR_VIDEO_RESOURCE_KEYS_BY_LANGUAGE.en) as Array<[PreventionPillar, string]>)
    .find(([, videoKey]) => videoKey === key)?.[0] ?? null;
  return reviewedVideoCandidateForPillar(englishPillar, normalized)
    ? PILLAR_VIDEO_RESOURCE_KEYS_BY_LANGUAGE[normalized]?.[englishPillar] ?? key
    : key;
}

function fallbackVideoCandidatesForStep(
  step: LongevityProgramDayRow,
  feedbackHistory: LongevityActionEventRow[],
  rotationDate: string,
  language?: string | null,
): LongevityVideoCandidate[] {
  const suppressed = suppressedVideoIds(feedbackHistory);
  const normalizedLanguage = normalizeVideoLanguage(language);
  const templateCandidate = FALLBACK_VIDEO_LIBRARY[localizedFallbackVideoKey(step.fallback_video_key, normalizedLanguage)]
    ?? FALLBACK_VIDEO_LIBRARY[step.fallback_video_key];
  const candidates = [
    templateCandidate,
    ...Object.values(FALLBACK_VIDEO_LIBRARY).filter((candidate) => candidate.language === normalizedLanguage && candidate.searchQuery === step.video_query),
    ...Object.values(FALLBACK_VIDEO_LIBRARY).filter((candidate) => candidate.language === normalizedLanguage),
  ].filter((candidate): candidate is LongevityVideoCandidate => Boolean(candidate))
    .map(videoCandidateWithInsights);

  const eligible = Array.from(new Map(candidates.map((candidate) => [candidate.videoId, candidate])).values())
    .filter((candidate) => videoCandidateIsSafe(candidate) && !suppressed.has(candidate.videoId))
    .sort((a, b) => deterministicScore(`${step.user_id}:${step.pillar}:${rotationDate}:${a.videoId}`) - deterministicScore(`${step.user_id}:${step.pillar}:${rotationDate}:${b.videoId}`));
  const preferredCandidate = templateCandidate ? videoCandidateWithInsights(templateCandidate) : null;
  const preferred = preferredCandidate && videoCandidateIsSafe(preferredCandidate) && !suppressed.has(preferredCandidate.videoId)
    ? [preferredCandidate]
    : [];
  return [
    ...preferred,
    ...eligible.filter((candidate) => !preferred.some((item) => item.videoId === candidate.videoId)),
  ];
}

async function searchYoutubeCandidates(input: {
  step: LongevityProgramDayRow;
  profile: ProfileSummary;
  feedbackHistory: LongevityActionEventRow[];
}): Promise<LongevityVideoCandidate[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const language = normalizeVideoLanguage(input.profile.language_preference);
  const query = `${input.step.video_query} senior friendly calm`;
  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("safeSearch", "strict");
    searchUrl.searchParams.set("videoEmbeddable", "true");
    searchUrl.searchParams.set("maxResults", "8");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("relevanceLanguage", language);
    searchUrl.searchParams.set("key", key);
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) return [];
    const searchJson = await searchResponse.json() as { items?: Array<{ id?: { videoId?: string } }> };
    const ids = Array.from(new Set((searchJson.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => Boolean(id))));
    if (ids.length === 0) return [];

    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.searchParams.set("part", "snippet,contentDetails");
    detailsUrl.searchParams.set("id", ids.join(","));
    detailsUrl.searchParams.set("key", key);
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) return [];
    const detailsJson = await detailsResponse.json() as {
      items?: Array<{
        id?: string;
        snippet?: {
          title?: string;
          channelTitle?: string;
          description?: string;
          thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
        };
        contentDetails?: { duration?: string };
      }>;
    };
    const suppressed = suppressedVideoIds(input.feedbackHistory);
    return (detailsJson.items ?? []).map((item): LongevityVideoCandidate | null => {
      const videoId = item.id;
      const title = oneLine(item.snippet?.title ?? "");
      if (!videoId || !title || suppressed.has(videoId)) return null;
      const summary = truncate(item.snippet?.description ?? "", 180) || null;
      const durationSeconds = isoDurationToSeconds(item.contentDetails?.duration);
      const insight = liveVideoInsightForStep(input.step, summary);
      return videoCandidateWithInsights({
        pillar: input.step.pillar,
        videoId,
        url: exactYoutubeWatchUrl(videoId),
        title,
        channel: oneLine(item.snippet?.channelTitle ?? "") || null,
        durationSeconds,
        thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        language,
        summary,
        selectedReason: `Gives today's ${PILLAR_LABELS[input.step.pillar]} focus one clear visual cue.`,
        safetyNotes: "Keep it comfortable and choose a smaller version if needed.",
        transcriptStatus: insight.transcriptStatus,
        keyPoints: insight.keyPoints,
        seniorTakeaway: insight.seniorTakeaway,
        transcriptSummary: insight.transcriptSummary,
        afterWatchAction: insight.afterWatchAction,
        goodFor: insight.goodFor,
        notFor: insight.notFor,
        momentFit: insight.momentFit,
        searchQuery: query,
        curationStatus: "ready",
      });
    }).filter((candidate): candidate is LongevityVideoCandidate => Boolean(candidate) && videoCandidateIsSafe(candidate));
  } catch (err) {
    console.warn("[PreventionCompanion] YouTube curation failed; using fallback video.", err);
    return [];
  }
}

async function curateVideoCandidate(input: {
  step: LongevityProgramDayRow;
  profile: ProfileSummary;
  feedbackHistory: LongevityActionEventRow[];
  rotationDate: string;
}): Promise<LongevityVideoCandidate | null> {
  const language = normalizeVideoLanguage(input.profile.language_preference);
  if (language !== "en") {
    return fallbackVideoCandidatesForStep(input.step, input.feedbackHistory, input.rotationDate, language)[0] ?? null;
  }

  const liveCandidates = await searchYoutubeCandidates(input);
  const live = liveCandidates.find((candidate) => normalizeVideoLanguage(candidate.language) === language);
  if (live) return live;
  return fallbackVideoCandidatesForStep(input.step, input.feedbackHistory, input.rotationDate, language)[0] ?? null;
}

async function getOrCreateLongevityProgram(input: {
  userId: string;
  profile: ProfileSummary;
  plan: LongevityPreventionPlan;
  rotationDate: string;
}): Promise<LongevityProgramRow> {
  const priorityPillar = priorityPillarForPlan(input.plan);
  const desiredLanguage = normalizeLanguage(input.profile.language_preference);
  const existing = await optionalQuery<LongevityProgramRow>("longevity_programs", `
    select *
    from public.longevity_programs
    where user_id = $1
      and status = 'active'
      and program_key = $2
    order by created_at desc
    limit 1
  `, [input.userId, LONGEVITY_PROGRAM_KEY]);
  if (existing[0]) {
    if (normalizeLanguage(existing[0].language) !== desiredLanguage) {
      const updated = await optionalQuery<LongevityProgramRow>("longevity_programs", `
        update public.longevity_programs
        set language = $2, updated_at = now()
        where id = $1::uuid
        returning *
      `, [existing[0].id, desiredLanguage]);
      return updated[0] ?? { ...existing[0], language: desiredLanguage, updated_at: new Date().toISOString() };
    }
    return existing[0];
  }

  const startDate = input.rotationDate;
  const inserted = await optionalQuery<LongevityProgramRow>("longevity_programs", `
    insert into public.longevity_programs
      (user_id, program_key, title, status, focus_pillars, start_date, current_day, total_days, language, cadence)
    values ($1, $2, $3, 'active', $4::text[], $5::date, 1, $6, $7, 'daily')
    on conflict do nothing
    returning *
  `, [
    input.userId,
    LONGEVITY_PROGRAM_KEY,
    "14-day VYVA longevity starter",
    orderedStarterProgramTemplates(priorityPillar).map((template) => template.pillar),
    startDate,
    LONGEVITY_PROGRAM_TOTAL_DAYS,
    desiredLanguage,
  ]);
  return inserted[0] ?? fallbackProgramRow({ userId: input.userId, profile: input.profile, priorityPillar, startDate, rotationDate: input.rotationDate });
}

async function ensureLongevityProgramDays(program: LongevityProgramRow, priorityPillar: PreventionPillar | null): Promise<void> {
  const templates = orderedStarterProgramTemplates(priorityPillar);
  const startDate = isoDateOnly(program.start_date);
  await optionalQuery("longevity_program_days", `
    insert into public.longevity_program_days
      (program_id, user_id, day_index, pillar, theme, objective, action_title, action_detail, video_query, fallback_video_key, scheduled_date)
    select $1::uuid, $2, day_index, pillar, theme, objective, action_title, action_detail, video_query, fallback_video_key, scheduled_date::date
    from jsonb_to_recordset($3::jsonb) as x(
      day_index int,
      pillar text,
      theme text,
      objective text,
      action_title text,
      action_detail text,
      video_query text,
      fallback_video_key text,
      scheduled_date text
    )
    on conflict (program_id, day_index) do nothing
  `, [
    program.id,
    program.user_id,
    JSON.stringify(templates.map((template) => ({
      day_index: template.dayIndex,
      pillar: template.pillar,
      theme: template.theme,
      objective: template.objective,
      action_title: template.actionTitle,
      action_detail: template.actionDetail,
      video_query: template.videoQuery,
      fallback_video_key: template.fallbackVideoKey,
      scheduled_date: addDaysToIsoDate(startDate, template.dayIndex - 1),
    }))),
  ]);
}

async function getTodayProgramDay(input: {
  program: LongevityProgramRow;
  plan: LongevityPreventionPlan;
  rotationDate: string;
}): Promise<LongevityProgramDayRow> {
  const priorityPillar = priorityPillarForPlan(input.plan);
  const startDate = isoDateOnly(input.program.start_date);
  const dayIndex = programDayIndex(startDate, input.rotationDate);
  const rows = await optionalQuery<{ updated_day: number }>("longevity_programs", `
    update public.longevity_programs
    set current_day = $2, updated_at = now()
    where id = $1::uuid
    returning $2::int as updated_day
  `, [input.program.id, dayIndex]);
  void rows;

  const dayRows = await optionalQuery<LongevityProgramDayRow>("longevity_program_days", `
    select *
    from public.longevity_program_days
    where program_id = $1::uuid
      and day_index = $2
    limit 1
  `, [input.program.id, dayIndex]);
  return dayRows[0] ?? fallbackProgramDayRow({ program: input.program, priorityPillar, dayIndex });
}

async function getCachedProgramVideo(input: {
  step: LongevityProgramDayRow;
  feedbackHistory: LongevityActionEventRow[];
  language: string | null | undefined;
}): Promise<{ row: LongevityVideoResourceRow; status: LongevityVideoCurationStatus } | null> {
  const suppressed = suppressedVideoIds(input.feedbackHistory);
  const desiredLanguage = normalizeVideoLanguage(input.language);
  const rows = await optionalQuery<LongevityVideoResourceRow>("longevity_video_resources", `
    select *
    from public.longevity_video_resources
    where program_day_id = $1::uuid
      and language = $2
      and (expires_at is null or expires_at > now())
    order by fetched_at desc
    limit 6
  `, [input.step.id, desiredLanguage]);
  const usable = rows.find((row) =>
    isExactYoutubeWatchUrl(row.url)
    && !suppressed.has(row.video_id)
    && normalizeVideoLanguage(row.language) === desiredLanguage
    && videoCandidateIsSafe({
      videoId: row.video_id,
      url: row.url,
      title: row.title,
      channel: row.channel,
      durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
      thumbnailUrl: row.thumbnail_url,
      language: row.language,
      summary: row.summary,
      selectedReason: row.selected_reason,
      safetyNotes: row.safety_notes,
      searchQuery: row.search_query,
      curationStatus: row.curation_status,
    })
  );
  return usable ? { row: usable, status: usable.curation_status } : null;
}

async function getOrCreateProgramVideo(input: {
  step: LongevityProgramDayRow;
  profile: ProfileSummary;
  feedbackHistory: LongevityActionEventRow[];
  rotationDate: string;
}): Promise<{ video: LongevityVideoResource | null; status: LongevityVideoCurationStatus }> {
  const cached = await getCachedProgramVideo({ step: input.step, feedbackHistory: input.feedbackHistory, language: input.profile.language_preference });
  if (cached) return { video: mapVideoRow(cached.row), status: cached.status };

  const candidate = await curateVideoCandidate(input);
  if (!candidate) return { video: null, status: "failed" };
  const candidatePillar = candidate.pillar ?? input.step.pillar;
  const candidateTranscriptSummary = sentence(candidate.transcriptSummary ?? candidate.summary ?? "");
  const candidateAfterWatchAction = sentence(candidate.afterWatchAction ?? candidate.seniorTakeaway ?? input.step.action_detail);
  const candidateGoodFor = normalizedVideoList(candidate.goodFor);
  const candidateNotFor = normalizedVideoList(candidate.notFor);
  const candidateMomentFit = normalizedMomentFit(candidate.momentFit);

  const inserted = await optionalQuery<LongevityVideoResourceRow>("longevity_video_resources", `
    insert into public.longevity_video_resources (
      program_day_id, user_id, provider, video_id, url, title, channel, duration_seconds, thumbnail_url,
      language, summary, selected_reason, safety_notes, transcript_status, key_points, senior_takeaway,
      pillar, transcript_summary, after_watch_action, good_for, not_for, moment_fit,
      curation_status, curator_agent, search_query, expires_at
    ) values (
      $1::uuid, $2, 'youtube', $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14::text[], $15,
      $16, $17, $18, $19::text[], $20::text[], $21::text[],
      $22, $23, $24, now() + interval '30 days'
    )
    on conflict (program_day_id, video_id) do update
      set fetched_at = now(),
          expires_at = now() + interval '30 days',
          selected_reason = excluded.selected_reason,
          safety_notes = excluded.safety_notes,
          transcript_status = excluded.transcript_status,
          key_points = excluded.key_points,
          senior_takeaway = excluded.senior_takeaway,
          pillar = excluded.pillar,
          transcript_summary = excluded.transcript_summary,
          after_watch_action = excluded.after_watch_action,
          good_for = excluded.good_for,
          not_for = excluded.not_for,
          moment_fit = excluded.moment_fit
    returning *
  `, [
    input.step.id,
    input.step.user_id,
    candidate.videoId,
    candidate.url,
    candidate.title,
    candidate.channel,
    candidate.durationSeconds,
    candidate.thumbnailUrl,
    candidate.language,
    candidate.summary,
    candidate.selectedReason,
    candidate.safetyNotes,
    candidate.transcriptStatus ?? "pending",
    normalizedVideoKeyPoints(candidate.keyPoints),
    candidate.seniorTakeaway ?? null,
    candidatePillar,
    candidateTranscriptSummary || null,
    candidateAfterWatchAction || null,
    candidateGoodFor,
    candidateNotFor,
    candidateMomentFit,
    candidate.curationStatus,
    LONGEVITY_CURATOR_AGENT,
    candidate.searchQuery,
  ]);

  const row = inserted[0] ?? {
    id: randomUUID(),
    program_day_id: input.step.id,
    user_id: input.step.user_id,
    provider: "youtube" as const,
    video_id: candidate.videoId,
    url: candidate.url,
    title: candidate.title,
    channel: candidate.channel,
    duration_seconds: candidate.durationSeconds,
    thumbnail_url: candidate.thumbnailUrl,
    language: candidate.language,
    summary: candidate.summary,
    selected_reason: candidate.selectedReason,
    safety_notes: candidate.safetyNotes,
    transcript_status: candidate.transcriptStatus ?? "pending",
    key_points: normalizedVideoKeyPoints(candidate.keyPoints),
    senior_takeaway: candidate.seniorTakeaway ?? null,
    pillar: candidatePillar,
    transcript_summary: candidateTranscriptSummary || null,
    after_watch_action: candidateAfterWatchAction || null,
    good_for: candidateGoodFor,
    not_for: candidateNotFor,
    moment_fit: candidateMomentFit,
    curation_status: candidate.curationStatus,
    curator_agent: LONGEVITY_CURATOR_AGENT,
    search_query: candidate.searchQuery,
    fetched_at: new Date().toISOString(),
    expires_at: null,
    created_at: new Date().toISOString(),
  };
  return { video: mapVideoRow(row), status: candidate.curationStatus };
}

export function buildFallbackLongevityProgramLayer(input: {
  userId: string;
  profile: ProfileSummary;
  plan: LongevityPreventionPlan;
  feedbackHistory: LongevityActionEventRow[];
  rotationDate?: string;
  startDate?: string;
}): LongevityProgramLayer {
  const rotationDate = input.rotationDate ?? todaySeed(input.profile.timezone);
  const priorityPillar = priorityPillarForPlan(input.plan);
  const startDate = input.startDate ?? rotationDate;
  const program = fallbackProgramRow({ userId: input.userId, profile: input.profile, priorityPillar, startDate, rotationDate });
  const stepRow = fallbackProgramDayRow({ program, priorityPillar, dayIndex: programDayIndex(startDate, rotationDate) });
  const video = fallbackVideoCandidatesForStep(stepRow, input.feedbackHistory, rotationDate, input.profile.language_preference)[0] ?? null;
  return {
    activeProgram: mapProgramRow(program),
    todayProgramStep: mapProgramDayRow(stepRow),
    todayVideo: video ? {
      id: randomUUID(),
      provider: "youtube",
      videoId: video.videoId,
      url: video.url,
      title: video.title,
      channel: video.channel,
      durationSeconds: video.durationSeconds,
      thumbnailUrl: video.thumbnailUrl,
      language: video.language,
      summary: video.summary,
      selectedReason: video.selectedReason,
      safetyNotes: video.safetyNotes,
      transcriptStatus: video.transcriptStatus ?? "manual_reviewed",
      keyPoints: normalizedVideoKeyPoints(video.keyPoints),
      seniorTakeaway: video.seniorTakeaway ?? video.summary,
      pillar: video.pillar ?? stepRow.pillar,
      transcriptSummary: video.transcriptSummary ?? video.summary,
      afterWatchAction: video.afterWatchAction ?? video.seniorTakeaway ?? stepRow.action_detail,
      goodFor: normalizedVideoList(video.goodFor),
      notFor: normalizedVideoList(video.notFor),
      momentFit: normalizedMomentFit(video.momentFit),
    } : null,
    videoCurationStatus: video ? video.curationStatus : "failed",
  };
}

async function getLongevityProgramLayer(input: {
  userId: string;
  profile: ProfileSummary;
  plan: LongevityPreventionPlan;
  feedbackHistory: LongevityActionEventRow[];
  rotationDate: string;
}): Promise<LongevityProgramLayer> {
  const priorityPillar = priorityPillarForPlan(input.plan);
  const program = await getOrCreateLongevityProgram(input);
  await ensureLongevityProgramDays(program, priorityPillar);
  const step = await getTodayProgramDay({ program, plan: input.plan, rotationDate: input.rotationDate });
  const videoResult = await getOrCreateProgramVideo({
    step,
    profile: input.profile,
    feedbackHistory: input.feedbackHistory,
    rotationDate: input.rotationDate,
  });
  return {
    activeProgram: mapProgramRow({ ...program, current_day: programDayIndex(isoDateOnly(program.start_date), input.rotationDate) }),
    todayProgramStep: mapProgramDayRow(step),
    todayVideo: videoResult.video,
    videoCurationStatus: videoResult.status,
  };
}

function movementExerciseRouteForTitle(title: string): string | null {
  const text = title.toLowerCase();
  const movementRoutes: Array<[string[], string]> = [
    [["chair yoga"], "/social-rooms/morning-movement/exercises/chair-yoga"],
    [["tai chi", "tai-chi"], "/social-rooms/morning-movement/exercises/tai-chi"],
    [["seated strength", "chair strength", "chair exercises"], "/social-rooms/morning-movement/exercises/seated-strength"],
    [["calm breathing"], "/social-rooms/morning-movement/exercises/calm-breathing"],
    [["sit-to-stand", "sit to stand"], "/social-rooms/morning-movement/exercises/sit-to-stand"],
    [["heel raises"], "/social-rooms/morning-movement/exercises/heel-raises"],
    [["wall push-ups", "wall pushups"], "/social-rooms/morning-movement/exercises/wall-push-ups"],
    [["ankle mobility"], "/social-rooms/morning-movement/exercises/ankle-mobility"],
    [["chest opener"], "/social-rooms/morning-movement/exercises/chest-opener"],
    [["side steps"], "/social-rooms/morning-movement/exercises/side-steps"],
    [["hand breathing"], "/social-rooms/morning-movement/exercises/hand-breathing"],
    [["shoulder release"], "/social-rooms/morning-movement/exercises/shoulder-release"],
  ];
  return movementRoutes.find(([matches]) => matches.some((match) => text.includes(match)))?.[1] ?? null;
}

function routeForCompanionAction(title: string, pillar: PreventionPillar | null): string | null {
  const text = title.toLowerCase();
  const movementRoute = movementExerciseRouteForTitle(title);
  if (movementRoute) return movementRoute;
  if (text.includes("walking path") || text.includes("clear route") || text.includes("remove obstacles")) {
    return "/social-rooms/walking-route?source=longevity&intent=clear-walking-path";
  }
  if (pillar === "brain") {
    if (text.includes("challenge") || text.includes("game") || text.includes("memory")) return "/memory-games";
    return "/mind";
  }
  if (text.includes("brain coach")) return "/mind";
  if (text.includes("breath") || text.includes("breathing") || pillar === "calm") return "/games/breath-garden";
  if (pillar === "heart" && (text.includes("nearby") || text.includes("outing") || text.includes("activity") || text.includes("social"))) {
    return "/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning";
  }
  if (pillar === "heart" && (text.includes("movement") || text.includes("exercise") || text.includes("walk"))) return "/social-rooms/morning-movement/exercises/tai-chi";
  if (text.includes("walk") || text.includes("chair") || text.includes("strength") || pillar === "strength") return "/health/exercises/gentle-walk";
  if (text.includes("medicine") || text.includes("medication")) return "/health/medications";
  if (text.includes("food") || text.includes("protein") || text.includes("water") || pillar === "nourishment") return null;
  if (text.includes("concierge")) return "/concierge";
  return null;
}

type LongevityCompanionResource = {
  resource_label: string;
  resource_url: string;
  resource_title?: string | null;
  duration_seconds?: number | null;
  safety_notes?: string | null;
  language?: string | null;
};

function reviewedVideoResourceForPillar(pillar: PreventionPillar | null, language?: string | null): LongevityCompanionResource | null {
  const candidate = reviewedVideoCandidateForPillar(pillar, language);
  if (!candidate) return null;
  return {
    resource_label: candidate.channel ?? "Curated video",
    resource_url: candidate.url,
    resource_title: candidate.title,
    duration_seconds: candidate.durationSeconds,
    safety_notes: candidate.safetyNotes,
    language: candidate.language,
  };
}

function resourceForCompanionAction(title: string, pillar: PreventionPillar | null, language?: string | null): LongevityCompanionResource | null {
  const text = title.toLowerCase();
  const pillarVideo = reviewedVideoResourceForPillar(pillar, language);
  if (pillarVideo) return pillarVideo;
  if (text.includes("brain coach")) return { resource_label: "Brain Coach", resource_url: "/mind" };
  if (text.includes("breath") || text.includes("breathing")) return { resource_label: "Breath Garden", resource_url: "/games/breath-garden" };
  if (text.includes("path") || text.includes("obstacle") || text.includes("safety")) {
    return { resource_label: "Walking route", resource_url: "/social-rooms/walking-route?source=longevity&intent=clear-walking-path" };
  }
  if ((pillar === "heart" && (text.includes("walk") || text.includes("outing") || text.includes("activity"))) || text.includes("shoes")) {
    return { resource_label: "Nearby walking ideas", resource_url: "/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning" };
  }
  if (text.includes("chair") || text.includes("strength") || text.includes("supported") || text.includes("stand once")) {
    return { resource_label: "VYVA movement", resource_url: routeForCompanionAction(title, pillar) ?? "/health/exercises/gentle-walk" };
  }
  if (pillar === "heart") return { resource_label: "Nearby walking ideas", resource_url: "/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning" };
  if (pillar === "brain") return { resource_label: "Brain Coach", resource_url: "/mind" };
  if (pillar === "calm") return { resource_label: "Breath Garden", resource_url: "/games/breath-garden" };
  return null;
}

function routeForProgramStep(step: LongevityProgramStep): string | null {
  if (step.pillar === "brain") {
    return null;
  }
  return routeForCompanionAction(step.actionTitle, step.pillar);
}

function brainGameOptionsForProgramStep(step: LongevityProgramStep): LongevityBrainGameOption[] {
  if (step.pillar !== "brain") return [];
  return [
    {
      id: "memory_lane",
      label: "Memory",
      title: "3-2-1 memory lane",
      kind: "memory_prompt",
      prompt: "Pick a real place. Name 3 things you see there, 2 sounds, and 1 person connected to it.",
      hint: "Use a place you know well, such as your kitchen, a favorite street, or a holiday spot.",
      answer: null,
      followUp: "This uses personal memory and storytelling, not a score.",
    },
    {
      id: "word_chain",
      label: "Words",
      title: "Word chain",
      kind: "word_chain",
      prompt: "Start with garden. Say five connected words without stopping.",
      hint: "Try: garden, flower, colour, painting, gallery. Your chain can be different.",
      answer: null,
      followUp: "Word chains train flexible thinking without needing a long session.",
    },
    {
      id: "riddle",
      label: "Riddle",
      title: "Quick riddle",
      kind: "riddle",
      prompt: "I hold stories without a shelf and open when someone asks the right question. What am I?",
      hint: "It is something your brain uses every day.",
      answer: "memory",
      followUp: "A tiny riddle gives the day a clear start and finish.",
    },
    {
      id: "chess_scan",
      label: "Chess",
      title: "Chess scan",
      kind: "chess_puzzle",
      prompt: "Before a move, name one piece that is protected and one piece that is open.",
      hint: "A protected piece has another piece that could respond if it is taken.",
      answer: null,
      followUp: "This is a gentle planning puzzle, not a timed match.",
    },
  ];
}

function brainChallengeForProgramStep(step: LongevityProgramStep): LongevityBrainChallenge | null {
  const options = brainGameOptionsForProgramStep(step);
  if (options.length === 0) return null;
  const text = step.actionTitle.toLowerCase();
  const selected = (text.includes("word chain")
    ? options.find((option) => option.id === "word_chain")
    : text.includes("crossword") || text.includes("clue")
      ? options.find((option) => option.id === "riddle")
      : text.includes("chess")
        ? options.find((option) => option.id === "chess_scan")
        : options.find((option) => option.id === "memory_lane")) ?? options[0];
  return {
    kind: selected.kind,
    prompt: selected.prompt,
    hint: selected.hint,
    answer: selected.answer,
    followUp: selected.followUp,
  };
}

function fallbackBrainChallengeForDetail(detail: string): LongevityBrainChallenge {
  return {
    kind: "memory_prompt",
    prompt: detail,
    hint: "Keep it short and use something from your own day.",
    answer: null,
    followUp: "A tiny personal prompt is enough for today.",
  };
}

function fallbackRecommendationForPillar(pillar: PreventionPillar | null): PreventionRecommendation {
  if (pillar === "brain") return { action: "Try a two-minute memory challenge", why: "A short challenge gives memory practice a clear finish." };
  if (pillar === "heart") return { action: "Tai chi", why: "A guided VYVA movement exercise is clearer than another walking reminder." };
  if (pillar === "strength") return { action: "Do one supported chair-strength round", why: "Supported movement keeps the step practical." };
  if (pillar === "nourishment") return { action: "Choose protein with your next meal", why: "Protein with a meal is a clear nourishment step." };
  if (pillar === "calm") return { action: "Open a two-minute breathing reset", why: "Two minutes is enough to start." };
  return { action: "Choose one small wellbeing step", why: "One clear step makes the plan easier to begin." };
}

function bestSignalForPillar(signals: LongevityCompanionSignal[], pillar: PreventionPillar | null): LongevityCompanionSignal | null {
  return signals.find((item) => item.pillar === pillar && item.source !== "feedback")
    ?? signals.find((item) => item.pillar === pillar)
    ?? signals.find((item) => item.source !== "profile")
    ?? signals[0]
    ?? null;
}

function recommendationToAction(
  recommendation: PreventionRecommendation,
  pillar: PreventionPillar | null,
  signals: LongevityCompanionSignal[],
  whyToday: string,
  language?: string | null,
): LongevityCompanionAction {
  const actionSignal = bestSignalForPillar(signals, pillar);
  const detail = recommendation.why || actionSignal?.detail || whyToday;
  const resource = resourceForCompanionAction(recommendation.action, pillar, language);
  return {
    action_key: actionKeyFor(pillar, recommendation.action),
    title: recommendation.action,
    detail: sentence(detail),
    pillar,
    route: routeForCompanionAction(recommendation.action, pillar),
    resource_label: resource?.resource_label ?? null,
    resource_url: resource?.resource_url ?? null,
    resource_title: resource?.resource_title ?? null,
    duration_seconds: resource?.duration_seconds ?? null,
    safety_notes: resource?.safety_notes ?? null,
    prompt: `Help me with today's longevity step: ${recommendation.action}. Context: ${whyToday}`,
    source: "monthly_plan",
  };
}

function dailyContentToAction(content: DailyContentRow, pillar: PreventionPillar | null, whyToday: string, language?: string | null): LongevityCompanionAction {
  const actionPillar = content.pillar_tag ?? pillar;
  const resource = resourceForCompanionAction(content.title, actionPillar, language ?? content.language);
  const internalRoute = content.source_url?.startsWith("/") ? content.source_url : null;
  const contentVideoUrl = isExactYoutubeWatchUrl(content.source_url) ? content.source_url : null;
  return {
    action_key: actionKeyFor(actionPillar, content.title),
    content_id: content.id,
    content_type: content.content_type,
    timing_guidance: content.timing_guidance,
    title: content.title,
    detail: sentence(content.description),
    pillar: actionPillar,
    route: internalRoute ?? routeForCompanionAction(content.title, actionPillar),
    resource_label: resource?.resource_label ?? content.source_label ?? null,
    resource_url: contentVideoUrl ?? resource?.resource_url ?? (content.source_url && !internalRoute ? content.source_url : null),
    resource_title: resource?.resource_title ?? content.resource_title ?? null,
    duration_seconds: resource?.duration_seconds ?? content.duration_seconds ?? null,
    safety_notes: content.safety_notes ?? resource?.safety_notes ?? null,
    prompt: `Help me make this longevity step easy today: ${content.title}. Context: ${whyToday}`,
    source: "daily_content",
  };
}

function programActionKeyForStep(step: LongevityProgramStep): string {
  return `program:${step.programId}:${step.dayIndex}:${actionKeyFor(step.pillar, step.actionTitle)}`;
}

function programStepToAction(
  step: LongevityProgramStep,
  video: LongevityVideoResource | null,
  feedbackHistory: LongevityActionEventRow[],
  whyToday: string,
): LongevityCompanionAction {
  const baseKey = programActionKeyForStep(step);
  const recentHard = feedbackHistory.find((event) =>
    event.event_type === "too_hard"
    && event.action_key === baseKey
    && eventAgeDays(event) <= 7);
  const title = recentHard
    ? `Make today's ${PILLAR_LABELS[step.pillar].toLowerCase()} video easier`
    : step.actionTitle;
  const detail = recentHard
    ? `You marked this step too hard, so watch only the first few minutes or ask VYVA for the smaller version.`
    : step.actionDetail;
  const videoContext = video ? ` Video: ${video.title}.` : "";
  const gameOptions = brainGameOptionsForProgramStep(step);
  const challenge = brainChallengeForProgramStep(step) ?? (step.pillar === "brain" ? fallbackBrainChallengeForDetail(step.actionDetail) : null);
  return {
    action_key: recentHard ? `${baseKey}:easy` : baseKey,
    title,
    detail: sentence(challenge && !recentHard ? challenge.followUp : detail),
    pillar: step.pillar,
    route: routeForProgramStep(step),
    resource_label: video?.channel ?? null,
    resource_url: video?.url ?? null,
    resource_title: video?.title ?? null,
    duration_seconds: video?.durationSeconds ?? null,
    safety_notes: video?.safetyNotes ?? null,
    prompt: `Help me with today's Longevity activity: ${title}. ${challenge ? `Challenge: ${challenge.prompt}.` : ""} ${whyToday}.${videoContext}`,
    source: "program",
    challenge: recentHard ? null : challenge,
    gameOptions: recentHard || gameOptions.length === 0 ? null : gameOptions,
  };
}

function contentRowMatchesMoment(row: DailyContentRow, moment?: LongevityMoment | null): boolean {
  if (!moment) return true;
  const value = oneLine(row.moment ?? row.time_of_day ?? "any").toLowerCase();
  if (!value || value === "any") return true;
  if (value === moment) return true;
  if (moment === "midday" && value === "lunch") return true;
  if (moment === "evening" && value === "night") return true;
  return false;
}

function dailyContentOptionsForPillar(
  dailyContent: LongevityCompanionPayload["dailyContent"],
  pillar: PreventionPillar,
  moment?: LongevityMoment | null,
): DailyContentRow[] {
  const pillarRows = dailyContent.byPillar[pillar] ?? [];
  const rows = (pillarRows.length > 0
    ? pillarRows
    : [dailyContent.tip, dailyContent.exercise, dailyContent.meal, dailyContent.supplement, dailyContent.naturalSolution]
    .filter((item): item is DailyContentRow => Boolean(item) && item.pillar_tag === pillar))
    .filter((row) => contentRowMatchesMoment(row, moment));
  if (pillar === "heart") {
    const exerciseRows = rows.filter((row) => row.content_type === "exercise");
    return exerciseRows.length > 0 ? exerciseRows : rows;
  }
  return rows;
}

function rotatedDailyContentOptions(input: {
  rows: DailyContentRow[];
  userId: string;
  pillar: PreventionPillar;
  rotationDate: string;
}): DailyContentRow[] {
  return [...input.rows].sort((a, b) => {
    const aScore = deterministicScore(`${input.userId}:${input.pillar}:${input.rotationDate}:${a.id}`) / Math.max(1, a.rotation_weight);
    const bScore = deterministicScore(`${input.userId}:${input.pillar}:${input.rotationDate}:${b.id}`) / Math.max(1, b.rotation_weight);
    return aScore - bScore;
  });
}

function smallerActionForPillar(pillar: PreventionPillar, recentHard: LongevityActionEventRow, whyToday: string, language?: string | null): LongevityCompanionAction {
  const titleByPillar: Record<PreventionPillar, string> = {
    heart: "Make the heart step smaller",
    brain: "Make the brain challenge smaller",
    strength: "Make the movement step smaller",
    nourishment: "Make the food step simpler",
    calm: "Make the calm step shorter",
  };
  const detailByPillar: Record<PreventionPillar, string> = {
    heart: `You marked "${recentHard.action_title}" too hard, so try one easier cue today.`,
    brain: `You marked "${recentHard.action_title}" too hard, so start with one tiny memory step only.`,
    strength: `You marked "${recentHard.action_title}" too hard, so do the supported version only.`,
    nourishment: `You marked "${recentHard.action_title}" too hard, so choose the simplest version at your next meal.`,
    calm: `You marked "${recentHard.action_title}" too hard, so start with two quiet minutes only.`,
  };
  const resource = resourceForCompanionAction(titleByPillar[pillar], pillar, language);
  return {
    action_key: actionKeyFor(pillar, titleByPillar[pillar]),
    title: titleByPillar[pillar],
    detail: detailByPillar[pillar],
    pillar,
    route: routeForCompanionAction(titleByPillar[pillar], pillar),
    resource_label: resource?.resource_label ?? null,
    resource_url: resource?.resource_url ?? null,
    resource_title: resource?.resource_title ?? null,
    duration_seconds: resource?.duration_seconds ?? null,
    safety_notes: resource?.safety_notes ?? null,
    prompt: `Make a smaller ${PILLAR_LABELS[pillar]} step for today. Context: ${whyToday}`,
    source: "feedback_memory",
  };
}

function buildPillarAction(input: {
  plan: LongevityPreventionPlan;
  pillar: PreventionPillar;
  signals: LongevityCompanionSignal[];
  dailyContent: LongevityCompanionPayload["dailyContent"];
  feedbackHistory: LongevityActionEventRow[];
  rotationDate: string;
  activeMoment?: LongevityMoment | null;
  language?: string | null;
}): LongevityCompanionAction {
  const suppressed = suppressedActionKeys(input.feedbackHistory);
  const whyForPillar = buildWhyToday(input.pillar, input.signals, input.plan);
  const recentHard = input.feedbackHistory.find((event) =>
    event.event_type === "too_hard"
    && event.pillar === input.pillar
    && eventAgeDays(event) <= 7);
  if (recentHard) return smallerActionForPillar(input.pillar, recentHard, whyForPillar, input.language);

  const contentCandidates = rotatedDailyContentOptions({
    rows: dailyContentOptionsForPillar(input.dailyContent, input.pillar, input.activeMoment),
    userId: input.plan.user_id,
    pillar: input.pillar,
    rotationDate: `${input.rotationDate}:${input.activeMoment ?? "day"}`,
  }).map((content) => dailyContentToAction(content, input.pillar, whyForPillar, input.language));

  const recommendationCandidates = pillarRecommendationOptions(input.plan, input.pillar)
    .map((recommendation) => recommendationToAction(recommendation, input.pillar, input.signals, whyForPillar, input.language));

  const candidates = [...contentCandidates, ...recommendationCandidates];
  return candidates.find((action) => !suppressed.has(action.action_key))
    ?? recommendationToAction(fallbackRecommendationForPillar(input.pillar), input.pillar, input.signals, whyForPillar, input.language);
}

function buildPillarActions(input: {
  plan: LongevityPreventionPlan;
  signals: LongevityCompanionSignal[];
  dailyContent: LongevityCompanionPayload["dailyContent"];
  feedbackHistory: LongevityActionEventRow[];
  rotationDate: string;
  activeMoment?: LongevityMoment | null;
  language?: string | null;
}): Record<PreventionPillar, LongevityCompanionAction> {
  return Object.fromEntries(PREVENTION_PILLARS.map((pillar) => [
    pillar,
    buildPillarAction({ ...input, pillar }),
  ])) as Record<PreventionPillar, LongevityCompanionAction>;
}

function buildWhyToday(pillar: PreventionPillar | null, signals: LongevityCompanionSignal[], plan: LongevityPreventionPlan): string {
  const label = pillar ? PILLAR_LABELS[pillar] : "Longevity";
  const strongest = bestSignalForPillar(signals, pillar);
  if (strongest) {
    return sentence(`${label} comes first today because ${lowerFirstText(strongest.detail)}`);
  }
  if (plan.priority_why) return sentence(plan.priority_why);
  return sentence(`${label} is the current monthly focus, so VYVA is starting with one small action today`);
}

function actionCategory(action: LongevityCompanionAction): string {
  const text = `${action.title} ${action.detail} ${action.route ?? ""}`.toLowerCase();
  if (text.includes("youtube.com/watch") || text.includes("youtu.be/")) return "video";
  if (text.includes("memory-games") || text.includes("riddle") || text.includes("chess") || text.includes("word recall") || text.includes("memory lane") || text.includes("brain coach") || text.includes("memory challenge") || (action.pillar === "brain" && text.includes("memory"))) return "brain_game";
  if (text.includes("morning-movement") || text.includes("tai chi") || text.includes("chair yoga") || text.includes("seated strength") || text.includes("chest opener") || text.includes("ankle mobility") || text.includes("side steps")) return "movement";
  if (text.includes("walking-route") || text.includes("walking path") || text.includes("clear route") || text.includes("remove obstacles")) return "walking_route";
  if (text.includes("protein") || text.includes("meal") || text.includes("food") || text.includes("water") || action.pillar === "nourishment") return "food";
  if (text.includes("breath") || text.includes("calm") || text.includes("wind-down") || action.pillar === "calm") return "calm";
  if (text.includes("medicine") || text.includes("medication")) return "medicine";
  if (text.includes("call someone") || text.includes("social") || text.includes("conversation")) return "connection";
  return action.pillar ?? "general";
}

function meaningfulTokens(value: string): string[] {
  const ignored = new Set(["today", "this", "with", "your", "the", "one", "step", "daily", "short", "small"]);
  return oneLine(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3 && !ignored.has(token));
}

function isNearDuplicateAction(a: LongevityCompanionAction, b: LongevityCompanionAction): boolean {
  if (a.action_key === b.action_key) return true;
  if (oneLine(a.title).toLowerCase() === oneLine(b.title).toLowerCase()) return true;
  const aCategory = actionCategory(a);
  const bCategory = actionCategory(b);
  if (aCategory !== "general" && aCategory === bCategory) return true;
  const aTokens = new Set(meaningfulTokens(a.title));
  const sharedTitleTokens = meaningfulTokens(b.title).filter((token) => aTokens.has(token));
  return sharedTitleTokens.length >= 2;
}

function actionHasEnoughEvidence(input: {
  plan: LongevityPreventionPlan;
  signals: LongevityCompanionSignal[];
  action: LongevityCompanionAction;
  programStep: LongevityProgramStep | null;
}): boolean {
  const { action, plan, programStep, signals } = input;
  if (action.source === "program" || action.source === "feedback_memory") return true;
  if (programStep && action.pillar === programStep.pillar) return true;
  if (!action.pillar) return action.source !== "fallback";
  const status = statusForPillar(plan, action.pillar);
  const hasSignal = signals.some((signalItem) =>
    signalItem.pillar === action.pillar
    || (action.pillar === "strength" && /mobility|fall|stability/i.test(`${signalItem.label} ${signalItem.detail}`)));
  if (actionCategory(action) === "walking_route" && !hasSignal && PREVENTION_STATUS_RANK[status] < PREVENTION_STATUS_RANK.needs_attention) return false;
  return action.source === "daily_content"
    || action.source === "monthly_plan"
    || hasSignal
    || PREVENTION_STATUS_RANK[status] >= PREVENTION_STATUS_RANK.steady;
}

function sessionCandidateScore(input: {
  plan: LongevityPreventionPlan;
  signals: LongevityCompanionSignal[];
  action: LongevityCompanionAction;
  programStep: LongevityProgramStep | null;
  rotationDate: string;
}): number {
  const { action, plan, programStep, signals, rotationDate } = input;
  const sourceScore: Record<LongevityCompanionAction["source"], number> = {
    program: 70,
    feedback_memory: 65,
    daily_content: 45,
    monthly_plan: 35,
    fallback: 10,
  };
  const statusScore = action.pillar ? PREVENTION_STATUS_RANK[statusForPillar(plan, action.pillar)] * 12 : 0;
  const signalScore = action.pillar && signals.some((signalItem) => signalItem.pillar === action.pillar) ? 18 : 0;
  const programScore = programStep && action.pillar === programStep.pillar ? 22 : 0;
  const routeScore = action.route ? 6 : 0;
  const freshness = deterministicScore(`${plan.user_id}:${rotationDate}:${action.action_key}`) % 9;
  const walkingPenalty = actionCategory(action) === "walking_route" && !signals.some((signalItem) => /mobility|fall|stability/i.test(`${signalItem.label} ${signalItem.detail}`)) ? -18 : 0;
  return sourceScore[action.source] + statusScore + signalScore + programScore + routeScore + freshness + walkingPenalty;
}

function experienceKindForAction(action: LongevityCompanionAction, video: LongevityVideoResource | null): LongevityDailyExperienceKind {
  if (video) return "video";
  if (action.challenge || action.gameOptions?.length) return "brain_game";
  const category = actionCategory(action);
  if (category === "brain_game" || category === "movement" || category === "walking_route" || category === "food" || category === "calm") return category;
  return "support";
}

function ctaLabelForExperience(kind: LongevityDailyExperienceKind): string {
  if (kind === "video") return "Watch";
  if (kind === "brain_game") return "Play";
  if (kind === "movement") return "Start exercise";
  if (kind === "walking_route") return "Plan route";
  if (kind === "food") return "Make it easy";
  if (kind === "calm") return "Start reset";
  return "Start";
}

function videoFromCompanionAction(action: LongevityCompanionAction, language?: string | null): LongevityVideoResource | null {
  const videoId = exactYoutubeVideoId(action.resource_url);
  if (!videoId) return null;
  const curated = reviewedVideoCandidateForPillar(action.pillar, language);
  const curatedMatch = curated?.videoId === videoId ? curated : null;
  return {
    id: action.content_id ?? action.action_key,
    provider: "youtube",
    pillar: curatedMatch?.pillar ?? action.pillar ?? null,
    videoId,
    url: exactYoutubeWatchUrl(videoId),
    title: action.resource_title ?? curatedMatch?.title ?? action.title,
    channel: action.resource_label ?? curatedMatch?.channel ?? null,
    durationSeconds: action.duration_seconds ?? curatedMatch?.durationSeconds ?? null,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    language: curatedMatch?.language ?? normalizeVideoLanguage(language),
    summary: (action.detail || curatedMatch?.summary) ?? null,
    selectedReason: curatedMatch?.selectedReason ?? sentence(action.detail),
    safetyNotes: action.safety_notes ?? curatedMatch?.safetyNotes ?? "General wellness support only.",
    transcriptStatus: curatedMatch?.transcriptStatus ?? "pending",
    keyPoints: normalizedVideoKeyPoints(curatedMatch?.keyPoints),
    seniorTakeaway: curatedMatch?.seniorTakeaway ?? action.detail ?? null,
    transcriptSummary: curatedMatch?.transcriptSummary ?? curatedMatch?.summary ?? action.detail ?? null,
    afterWatchAction: curatedMatch?.afterWatchAction ?? curatedMatch?.seniorTakeaway ?? action.detail ?? null,
    goodFor: normalizedVideoList(curatedMatch?.goodFor),
    notFor: normalizedVideoList(curatedMatch?.notFor),
    momentFit: normalizedMomentFit(curatedMatch?.momentFit),
  };
}

function buildPrimaryExperience(action: LongevityCompanionAction, video: LongevityVideoResource | null, language?: string | null): LongevityPrimaryExperience {
  const resolvedVideo = video ?? videoFromCompanionAction(action, language);
  const kind = experienceKindForAction(action, resolvedVideo);
  return {
    kind,
    title: resolvedVideo?.title ?? action.title,
    detail: sentence(resolvedVideo?.seniorTakeaway ?? resolvedVideo?.selectedReason ?? action.detail),
    pillar: action.pillar,
    ctaLabel: ctaLabelForExperience(kind),
    action,
    video: resolvedVideo,
  };
}

function buildSessionFocusSentence(input: {
  profile: ProfileSummary;
  focusPillar: PreventionPillar | null;
  programStep: LongevityProgramStep | null;
  headline: string;
}): string {
  const lead = input.profile.first_name ? `${input.profile.first_name}, ` : "";
  if (!input.programStep) return sentence(input.headline);
  if (input.focusPillar === "brain") return `${lead}keep memory active with one short challenge today.`;
  if (input.focusPillar === "heart") return `${lead}move gently with one VYVA exercise today.`;
  if (input.focusPillar === "strength") return `${lead}make movement feel steadier today.`;
  if (input.focusPillar === "nourishment") return `${lead}make the next meal easier today.`;
  if (input.focusPillar === "calm") return `${lead}start with one calm reset today.`;
  return sentence(input.headline);
}

function buildDailySession(input: {
  profile: ProfileSummary;
  plan: LongevityPreventionPlan;
  signals: LongevityCompanionSignal[];
  programStep: LongevityProgramStep | null;
  todayVideo: LongevityVideoResource | null;
  primaryAction: LongevityCompanionAction;
  supportAction: LongevityCompanionAction;
  pillarActions: Record<PreventionPillar, LongevityCompanionAction>;
  whyToday: string;
  headline: string;
  focusPillar: PreventionPillar | null;
  rotationDate: string;
  language?: string | null;
}): LongevityDailySession {
  const primaryExperience = buildPrimaryExperience(input.primaryAction, input.todayVideo, input.language);
  const allCandidates = Object.values(input.pillarActions)
    .filter((action) => actionHasEnoughEvidence({ plan: input.plan, signals: input.signals, action, programStep: input.programStep }))
    .sort((a, b) =>
      sessionCandidateScore({ plan: input.plan, signals: input.signals, action: b, programStep: input.programStep, rotationDate: input.rotationDate })
      - sessionCandidateScore({ plan: input.plan, signals: input.signals, action: a, programStep: input.programStep, rotationDate: input.rotationDate }));
  const nonDuplicateCandidates = allCandidates.filter((action) => !isNearDuplicateAction(action, input.primaryAction));
  const recommendedCompanion = nonDuplicateCandidates.find((action) => action.action_key === input.supportAction.action_key)
    ?? nonDuplicateCandidates[0]
    ?? input.supportAction
    ?? input.primaryAction;
  const companionAction = primaryExperience.kind === "video"
    ? input.primaryAction
    : recommendedCompanion;
  const optionalChoices: LongevityCompanionAction[] = [];
  for (const action of nonDuplicateCandidates) {
    if (optionalChoices.length >= 2) break;
    if (isNearDuplicateAction(action, companionAction)) continue;
    if (optionalChoices.some((selected) => isNearDuplicateAction(selected, action))) continue;
    optionalChoices.push(action);
  }
  const coveredPillars = PREVENTION_PILLARS.map((pillar) => {
    const action = input.pillarActions[pillar];
    const signalItem = bestSignalForPillar(input.signals, pillar);
    return {
      pillar,
      label: PILLAR_LABELS[pillar],
      status: statusForPillar(input.plan, pillar),
      actionTitle: action.title,
      reason: sentence(action.detail),
      evidence: sentence(signalItem?.detail ?? `${PILLAR_LABELS[pillar]} is tracked in this monthly plan`),
    };
  });
  const evidence = [
    input.programStep ? `Program day ${input.programStep.dayIndex}: ${input.programStep.theme}.` : null,
    primaryExperience.video ? `Curated video: ${primaryExperience.video.title}.` : null,
    input.primaryAction.source === "feedback_memory" || companionAction.source === "feedback_memory" ? "Recent feedback asked VYVA to make this easier." : null,
    ...input.signals.slice(0, 3).map((signalItem) => `${signalItem.label}: ${signalItem.detail}`),
  ].filter((item): item is string => Boolean(item));

  return {
    sessionFocus: buildSessionFocusSentence({
      profile: input.profile,
      focusPillar: input.focusPillar,
      programStep: input.programStep,
      headline: input.headline,
    }),
    primaryExperience,
    companionAction,
    optionalChoices,
    coveredPillars,
    whyThis: {
      summary: input.whyToday,
      evidence: Array.from(new Set(evidence.map(sentence))).slice(0, 5),
    },
  };
}

function buildCareSummary(input: {
  profile: ProfileSummary;
  whyToday: string;
  programStep?: LongevityProgramStep | null;
  todayVideo?: LongevityVideoResource | null;
  primaryAction?: LongevityCompanionAction | null;
  pillarActions: Record<PreventionPillar, LongevityCompanionAction>;
  dailySession?: LongevityDailySession | null;
  signals: LongevityCompanionSignal[];
}): LongevityCareSummary {
  const title = `Longevity summary for ${input.profile.first_name}`;
  const bullets = [
    input.dailySession ? `Today: ${input.dailySession.sessionFocus}` : null,
    input.programStep ? `Program day ${input.programStep.dayIndex}: ${input.programStep.theme}.` : null,
    input.todayVideo ? `Video: ${input.todayVideo.title}${input.todayVideo.channel ? ` (${input.todayVideo.channel})` : ""}.` : null,
    input.dailySession ? `Companion step: ${input.dailySession.companionAction.title}.` : input.primaryAction ? `Companion action: ${input.primaryAction.title}.` : null,
    input.dailySession?.optionalChoices.length ? `Optional choices: ${input.dailySession.optionalChoices.map((action) => action.title).join("; ")}.` : null,
    input.whyToday,
    `Health areas considered: ${PREVENTION_PILLARS.map((pillar) => PILLAR_LABELS[pillar]).join("; ")}.`,
    ...input.signals.slice(0, 3).map((item) => `${item.label}: ${item.detail}`),
  ].filter((item): item is string => Boolean(item)).map(sentence);
  return {
    title,
    bullets,
    share_text: [title, ...bullets.map((item) => "- " + item)].join("\n"),
  };
}

function buildTodayFocusHeadline(profile: ProfileSummary, pillar: PreventionPillar | null, strongestSignal: LongevityCompanionSignal | null): string {
  const lead = profile.first_name ? `${profile.first_name}, ` : "";
  if (pillar === "brain") {
    if (strongestSignal?.id === "brain-no-sessions") return `${lead}try a memory challenge today`;
    if (strongestSignal?.id === "brain-trend") return `${lead}choose a small brain challenge`;
    return `${lead}play one short brain challenge`;
  }
  if (pillar === "heart") {
    if (strongestSignal?.id === "meds-missed") return `${lead}steady the medicine routine today`;
    return `${lead}support circulation with one small step`;
  }
  if (pillar === "strength") {
    if (strongestSignal?.id === "latest-symptom") return `${lead}keep movement practical today`;
    return `${lead}support stability with one small move`;
  }
  if (pillar === "nourishment") return `${lead}make food and water easier today`;
  if (pillar === "calm") {
    if (strongestSignal?.id === "sleep-checkins") return `${lead}make today easier on rest`;
    return `${lead}start with one calmer moment today`;
  }
  return `${lead}start with one useful step today`;
}

const PROGRAM_PILLAR_MOMENT: Record<PreventionPillar, LongevityMoment> = {
  heart: "afternoon",
  brain: "afternoon",
  strength: "afternoon",
  nourishment: "morning",
  calm: "evening",
};

function preferredPillarsForMoment(moment: LongevityMoment, focusPillar: PreventionPillar | null): PreventionPillar[] {
  const preferred = LONGEVITY_MOMENT_DEFINITIONS[moment].preferredPillars;
  return focusPillar && preferred.includes(focusPillar) && PROGRAM_PILLAR_MOMENT[focusPillar] === moment
    ? [focusPillar, ...preferred.filter((pillar) => pillar !== focusPillar)]
    : preferred;
}

function fallbackActionForMoment(moment: LongevityMoment, focusPillar: PreventionPillar | null, whyToday: string, language?: string | null): LongevityCompanionAction {
  const pillar = preferredPillarsForMoment(moment, focusPillar)[0] ?? focusPillar ?? "calm";
  const copy: Record<LongevityMoment, { title: string; detail: string; route: string | null; resourceLabel: string | null; resourceUrl: string | null }> = {
    morning: {
      title: "Choose one steady breakfast anchor",
      detail: "Pick one familiar protein, water, or morning-light cue so the day starts simply.",
      route: null,
      resourceLabel: "Ask VYVA",
      resourceUrl: null,
    },
    midday: {
      title: "Make lunch easier to choose",
      detail: "Choose one simple plate upgrade, then leave the rest of the plan alone.",
      route: null,
      resourceLabel: "Ask VYVA",
      resourceUrl: null,
    },
    afternoon: {
      title: "Start one VYVA movement",
      detail: "Use a short guided movement or route that fits your energy and mobility today.",
      route: "/social-rooms/morning-movement/exercises/tai-chi",
      resourceLabel: "VYVA movement",
      resourceUrl: "/social-rooms/morning-movement/exercises/tai-chi",
    },
    evening: {
      title: "Settle tonight with one cue",
      detail: "Choose a two-minute reset, softer light, or a simple setup for tomorrow.",
      route: "/games/breath-garden",
      resourceLabel: "Breath Garden",
      resourceUrl: "/games/breath-garden",
    },
  };
  const selected = copy[moment];
  const resource = resourceForCompanionAction(selected.title, pillar, language);
  return {
    action_key: actionKeyFor(pillar, `${moment}:${selected.title}`),
    title: selected.title,
    detail: selected.detail,
    pillar,
    route: selected.route,
    resource_label: resource?.resource_label ?? selected.resourceLabel,
    resource_url: resource?.resource_url ?? selected.resourceUrl,
    resource_title: resource?.resource_title ?? null,
    duration_seconds: resource?.duration_seconds ?? null,
    safety_notes: resource?.safety_notes ?? null,
    prompt: `Help me make this ${LONGEVITY_MOMENT_DEFINITIONS[moment].label.toLowerCase()} longevity step practical. Context: ${whyToday}`,
    source: "fallback",
  };
}

function contentTypeScoreForMoment(type: DailyContentType, moment: LongevityMoment): number {
  const index = LONGEVITY_MOMENT_DEFINITIONS[moment].preferredTypes.indexOf(type);
  return index === -1 ? 0 : 18 - index * 3;
}

function momentCandidateScore(input: {
  action: LongevityCompanionAction;
  moment: LongevityMoment;
  plan: LongevityPreventionPlan;
  signals: LongevityCompanionSignal[];
  programStep: LongevityProgramStep | null;
  rotationDate: string;
}): number {
  const preferredPillars = preferredPillarsForMoment(input.moment, input.programStep?.pillar ?? priorityPillarForPlan(input.plan));
  const preferredPillarIndex = input.action.pillar ? preferredPillars.indexOf(input.action.pillar) : -1;
  const preferredPillarScore = preferredPillarIndex === -1 ? 0 : 60 - preferredPillarIndex * 14;
  const contentScore = input.action.content_type ? contentTypeScoreForMoment(input.action.content_type, input.moment) : 0;
  const signalScore = input.action.pillar && input.signals.some((signal) => signal.pillar === input.action.pillar) ? 14 : 0;
  const statusScore = input.action.pillar ? PREVENTION_STATUS_RANK[statusForPillar(input.plan, input.action.pillar)] * 8 : 0;
  const programScore = input.programStep && input.action.pillar === input.programStep.pillar ? 10 : 0;
  const resourceScore = input.action.route || input.action.resource_url ? 6 : 0;
  const freshness = deterministicScore(`${input.plan.user_id}:${input.rotationDate}:${input.moment}:${input.action.action_key}`) % 9;
  return preferredPillarScore + contentScore + signalScore + statusScore + programScore + resourceScore + freshness;
}

function buildMomentPrimaryAction(input: {
  moment: LongevityMoment;
  plan: LongevityPreventionPlan;
  signals: LongevityCompanionSignal[];
  dailyContent: LongevityCompanionPayload["dailyContent"];
  feedbackHistory: LongevityActionEventRow[];
  rotationDate: string;
  programStep: LongevityProgramStep | null;
  programAction: LongevityCompanionAction | null;
  programVideo: LongevityVideoResource | null;
  pillarActions: Record<PreventionPillar, LongevityCompanionAction>;
  whyToday: string;
  language?: string | null;
}): { action: LongevityCompanionAction; video: LongevityVideoResource | null } {
  const programMoment = input.programStep ? PROGRAM_PILLAR_MOMENT[input.programStep.pillar] : null;
  if (input.programAction && input.moment === programMoment) {
    return { action: input.programAction, video: input.programVideo };
  }

  const suppressed = suppressedActionKeys(input.feedbackHistory);
  const preferred = preferredPillarsForMoment(input.moment, input.programStep?.pillar ?? priorityPillarForPlan(input.plan));
  const contentCandidates = preferred.flatMap((pillar) =>
    rotatedDailyContentOptions({
      rows: dailyContentOptionsForPillar(input.dailyContent, pillar, input.moment),
      userId: input.plan.user_id,
      pillar,
      rotationDate: `${input.rotationDate}:${input.moment}`,
    }).map((content) => dailyContentToAction(content, pillar, input.whyToday, input.language)));
  const fallbackCandidates = preferred.map((pillar) => input.pillarActions[pillar]).filter((action): action is LongevityCompanionAction => Boolean(action));
  const feedbackMemoryCandidates = fallbackCandidates.filter((action) => action.source === "feedback_memory");
  const candidatePool = contentCandidates.length > 0
    ? [...feedbackMemoryCandidates, ...contentCandidates]
    : fallbackCandidates;
  const candidates = candidatePool
    .filter((action) => !suppressed.has(action.action_key))
    .filter((action) => actionHasEnoughEvidence({ plan: input.plan, signals: input.signals, action, programStep: input.programStep }))
    .sort((a, b) =>
      momentCandidateScore({ action: b, moment: input.moment, plan: input.plan, signals: input.signals, programStep: input.programStep, rotationDate: input.rotationDate })
      - momentCandidateScore({ action: a, moment: input.moment, plan: input.plan, signals: input.signals, programStep: input.programStep, rotationDate: input.rotationDate }));

  return { action: candidates[0] ?? fallbackActionForMoment(input.moment, input.programStep?.pillar ?? priorityPillarForPlan(input.plan), input.whyToday, input.language), video: null };
}

function buildMomentFocusSentence(input: {
  moment: LongevityMoment;
  profile: ProfileSummary;
  action: LongevityCompanionAction;
  programStep: LongevityProgramStep | null;
}): string {
  const lead = input.profile.first_name ? `${input.profile.first_name}, ` : "";
  const pillar = input.action.pillar ?? input.programStep?.pillar ?? "calm";
  const definition = LONGEVITY_MOMENT_DEFINITIONS[input.moment];
  const focus = definition.focusByPillar[pillar] ?? definition.focusByPillar.calm;
  return sentence(`${lead}${lowerFirstText(focus)}`);
}

function buildMomentSession(input: {
  moment: LongevityMoment;
  activeMoment: LongevityMoment;
  profile: ProfileSummary;
  plan: LongevityPreventionPlan;
  signals: LongevityCompanionSignal[];
  dailyContent: LongevityCompanionPayload["dailyContent"];
  feedbackHistory: LongevityActionEventRow[];
  rotationDate: string;
  programStep: LongevityProgramStep | null;
  programAction: LongevityCompanionAction | null;
  programVideo: LongevityVideoResource | null;
  pillarActions: Record<PreventionPillar, LongevityCompanionAction>;
}): LongevityMomentSession {
  const focusPillar = input.programStep?.pillar ?? priorityPillarForPlan(input.plan);
  const whyToday = buildWhyToday(focusPillar, input.signals, input.plan);
  const { action, video } = buildMomentPrimaryAction({
    moment: input.moment,
    plan: input.plan,
    signals: input.signals,
    dailyContent: input.dailyContent,
    feedbackHistory: input.feedbackHistory,
    rotationDate: input.rotationDate,
    programStep: input.programStep,
    programAction: input.programAction,
    programVideo: input.programVideo,
    pillarActions: input.pillarActions,
    whyToday,
    language: input.profile.language_preference,
  });
  const primaryExperience = buildPrimaryExperience(action, video, input.profile.language_preference);
  const definition = LONGEVITY_MOMENT_DEFINITIONS[input.moment];
  const signalItem = bestSignalForPillar(input.signals, action.pillar);
  const timing = action.timing_guidance ? `Timing: ${action.timing_guidance}.` : `${definition.label} timing fits this step.`;
  const programEvidence = input.programStep && action.source === "program"
    ? `Program day ${input.programStep.dayIndex}: ${input.programStep.theme}.`
    : null;
  const videoEvidence = primaryExperience.video ? `Curated video: ${primaryExperience.video.title}.` : null;
  const summary = signalItem
    ? `${definition.label} fits because ${lowerFirstText(signalItem.detail)}`
    : `${definition.label} is a practical time for ${lowerFirstText(action.title)}.`;
  const coveredPillars = PREVENTION_PILLARS.map((pillar) => {
    const pillarAction = input.pillarActions[pillar];
    const pillarSignal = bestSignalForPillar(input.signals, pillar);
    return {
      pillar,
      label: PILLAR_LABELS[pillar],
      status: statusForPillar(input.plan, pillar),
      actionTitle: pillarAction.title,
      reason: sentence(pillarAction.detail),
      evidence: sentence(pillarSignal?.detail ?? `${PILLAR_LABELS[pillar]} is tracked in this monthly plan`),
    };
  });

  return {
    moment: input.moment,
    label: definition.label,
    status: momentStatus(input.moment, input.activeMoment),
    startsAt: definition.startsAt,
    sessionFocus: buildMomentFocusSentence({
      moment: input.moment,
      profile: input.profile,
      action,
      programStep: input.programStep,
    }),
    primaryExperience,
    companionAction: action,
    optionalChoices: [],
    coveredPillars,
    whyThis: {
      summary: sentence(summary),
      evidence: Array.from(new Set([
        `${definition.label}: ${definition.focusByPillar[action.pillar ?? focusPillar ?? "calm"] ?? "One practical step."}`,
        timing,
        programEvidence,
        videoEvidence,
        signalItem ? `${signalItem.label}: ${signalItem.detail}` : null,
      ].filter((item): item is string => Boolean(item)).map(sentence))).slice(0, 5),
    },
  };
}

function timelineItemForSession(session: LongevityMomentSession): LongevityTimelineItem {
  return {
    moment: session.moment,
    label: session.label,
    status: session.status,
    startsAt: session.startsAt,
    title: session.primaryExperience.title,
    reason: session.primaryExperience.detail,
    pillar: session.primaryExperience.pillar,
    kind: session.primaryExperience.kind,
  };
}

function buildMomentSessions(input: {
  activeMoment: LongevityMoment;
  profile: ProfileSummary;
  plan: LongevityPreventionPlan;
  signals: LongevityCompanionSignal[];
  dailyContent: LongevityCompanionPayload["dailyContent"];
  feedbackHistory: LongevityActionEventRow[];
  rotationDate: string;
  programStep: LongevityProgramStep | null;
  programAction: LongevityCompanionAction | null;
  programVideo: LongevityVideoResource | null;
  pillarActions: Record<PreventionPillar, LongevityCompanionAction>;
}): { sessions: LongevityMomentSession[]; timeline: LongevityTimelineItem[]; current: LongevityMomentSession; next: LongevityTimelineItem | null } {
  const sessions = LONGEVITY_MOMENT_ORDER.map((moment) => buildMomentSession({ ...input, moment }));
  const timeline = sessions.map(timelineItemForSession);
  const current = sessions.find((session) => session.moment === input.activeMoment) ?? sessions[0];
  const nextMoment = nextLongevityMoment(input.activeMoment);
  const next = timeline.find((item) => item.moment === nextMoment && item.status === "later")
    ?? timeline.find((item) => item.status === "later")
    ?? null;
  return { sessions, timeline, current, next };
}

function fallbackPreventionPlan(userId: string): LongevityPreventionPlan {
  return {
    id: null,
    user_id: userId,
    generated_at: null,
    period_start: daysAgo(90),
    period_end: new Date(),
    pillar_heart: "steady",
    pillar_brain: "steady",
    pillar_strength: "steady",
    pillar_nourishment: "steady",
    pillar_calm: "steady",
    pillar_heart_signals: null,
    pillar_brain_signals: null,
    pillar_strength_signals: null,
    pillar_nourishment_signals: null,
    pillar_calm_signals: null,
    cross_pillar_patterns: [],
    recommendations: preventionRecommendations({ heart: "steady", brain: "steady", strength: "steady", nourishment: "steady", calm: "steady" }),
    priority_intervention: null,
    priority_why: null,
    plan_narrative_senior: null,
    plan_narrative_caregiver: null,
    plan_abstract_gp: null,
    trajectory: "first",
    source_signals: {},
    confidence: 0.25,
    priority_pillar: null,
    status: "active",
  };
}

export function composeLongevityCompanionPayload(input: {
  plan: LongevityPreventionPlan;
  profile: ProfileSummary;
  conditions: string[];
  vitals: SummaryMap;
  meds: SummaryMap;
  cognitive: SummaryMap;
  mood: SummaryMap;
  symptoms: SummaryMap;
  dailyContent: LongevityCompanionPayload["dailyContent"];
  feedbackHistory: LongevityActionEventRow[];
  rotationDate?: string;
  activeMoment?: LongevityMoment;
  programLayer?: LongevityProgramLayer | null;
}): LongevityCompanionPayload {
  const priorityPillar = priorityPillarForPlan(input.plan);
  const signals = buildCompanionSignals(input);
  const programStep = input.programLayer?.todayProgramStep ?? null;
  const focusPillar = programStep?.pillar ?? priorityPillar;
  const rotationDate = input.rotationDate ?? todaySeed(input.profile.timezone);
  const activeMoment = input.activeMoment ?? activeLongevityMoment(input.profile.timezone);
  const whyToday = buildWhyToday(focusPillar, signals, input.plan);
  const pillarActions = buildPillarActions({
    plan: input.plan,
    signals,
    dailyContent: input.dailyContent,
    feedbackHistory: input.feedbackHistory,
    rotationDate,
    activeMoment,
    language: input.profile.language_preference,
  });
  const programAction = programStep
    ? programStepToAction(programStep, input.programLayer?.todayVideo ?? null, input.feedbackHistory, whyToday)
    : null;
  const momentSessions = buildMomentSessions({
    activeMoment,
    profile: input.profile,
    plan: input.plan,
    signals,
    dailyContent: input.dailyContent,
    feedbackHistory: input.feedbackHistory,
    rotationDate,
    programStep,
    programAction,
    programVideo: input.programLayer?.todayVideo ?? null,
    pillarActions,
  });
  const dailySession = momentSessions.current;
  const primaryAction = dailySession.primaryExperience.action;
  const currentVideo = dailySession.primaryExperience.video;
  const focusLabel = dailySession.label;

  return {
    plan: input.plan,
    activeProgram: input.programLayer?.activeProgram ?? null,
    todayProgramStep: programStep,
    todayVideo: currentVideo,
    videoCurationStatus: currentVideo ? input.programLayer?.videoCurationStatus ?? "fallback" : "pending",
    todayFocus: {
      pillar: dailySession.primaryExperience.pillar,
      label: focusLabel,
      headline: dailySession.sessionFocus,
      summary: dailySession.primaryExperience.detail,
    },
    activeMoment,
    todayTimeline: momentSessions.timeline,
    currentMomentSession: momentSessions.current,
    nextMomentPreview: momentSessions.next,
    whyToday: dailySession.whyThis.summary,
    dailySession,
    primaryAction,
    supportAction: dailySession.companionAction,
    pillarActions,
    careSummary: buildCareSummary({
      profile: input.profile,
      whyToday: dailySession.whyThis.summary,
      programStep,
      todayVideo: currentVideo,
      primaryAction,
      pillarActions,
      dailySession,
      signals,
    }),
    signalsUsed: signals,
    dailyContent: input.dailyContent,
    feedbackHistory: input.feedbackHistory,
  };
}

async function getRecentPlanActionEvents(userId: string): Promise<LongevityActionEventRow[]> {
  return optionalQuery<LongevityActionEventRow>("longevity_action_events", `
    select action_key, action_title, event_type, pillar, barrier, moment, content_id::text, resource_id::text, source_context, created_at
    from public.longevity_action_events
    where user_id = $1
      and created_at >= now() - interval '30 days'
    order by created_at desc
    limit 40
  `, [userId]);
}

async function getFreshPreventionPlan(userId: string): Promise<LongevityPreventionPlan> {
  const stored = await getLatestPreventionPlan(userId);
  if (stored && stored.generated_at && Date.now() - new Date(stored.generated_at).getTime() < 35 * 24 * 60 * 60 * 1000) {
    return stored;
  }
  return runPreventionPlanSynthesis(userId);
}

function normalizePreventionPillar(value: unknown): PreventionPillar | null {
  return PREVENTION_PILLARS.includes(value as PreventionPillar) ? value as PreventionPillar : null;
}

function normalizeLongevityActionEventType(value: unknown): LongevityActionEventType | null {
  return ["shown", "opened", "saved", "done", "too_hard", "not_relevant"].includes(String(value))
    ? value as LongevityActionEventType
    : null;
}

async function recordLongevityActionEvent(input: {
  userId: string;
  planId: string | null;
  pillar: PreventionPillar | null;
  actionKey: string;
  actionTitle: string;
  eventType: LongevityActionEventType;
  barrier: string | null;
  moment?: LongevityMoment | null;
  contentId?: string | null;
  resourceId?: string | null;
  sourceContext: Record<string, unknown>;
}): Promise<void> {
  await optionalQuery("longevity_action_events", `
    insert into public.longevity_action_events
      (user_id, plan_id, pillar, action_key, action_title, event_type, barrier, moment, content_id, resource_id, source_context)
    values ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::uuid, $10::uuid, $11::jsonb)
  `, [
    input.userId,
    input.planId,
    input.pillar,
    input.actionKey,
    input.actionTitle,
    input.eventType,
    input.barrier,
    input.moment ?? null,
    input.contentId ?? null,
    input.resourceId ?? null,
    JSON.stringify(input.sourceContext),
  ]);
}

function cachedPayloadMatchesLanguage(payload: Partial<LongevityCompanionPayload>, language: string | null | undefined): boolean {
  const desiredLanguage = normalizeVideoLanguage(language);
  const payloadLanguage = typeof payload.todayVideo?.language === "string"
    ? normalizeVideoLanguage(payload.todayVideo.language)
    : typeof payload.activeProgram?.language === "string"
      ? normalizeVideoLanguage(payload.activeProgram.language)
      : desiredLanguage;
  return payloadLanguage === desiredLanguage;
}

function isCachedLongevityCompanionPayload(
  value: unknown,
  activeMoment: LongevityMoment,
  language: string | null | undefined,
): value is LongevityCompanionPayload {
  const payload = safeJson<Partial<LongevityCompanionPayload> | null>(value, null);
  return Boolean(
    payload
    && payload.plan
    && payload.currentMomentSession
    && payload.currentMomentSession.moment === activeMoment
    && payload.activeMoment === activeMoment
    && cachedPayloadMatchesLanguage(payload, language)
    && payload.primaryAction
    && payload.todayFocus,
  );
}

async function getCachedLongevityMomentPayload(input: {
  userId: string;
  rotationDate: string;
  activeMoment: LongevityMoment;
  language: string | null | undefined;
}): Promise<LongevityCompanionPayload | null> {
  const rows = await optionalQuery<{ payload: unknown }>("longevity_moment_sessions", `
    select payload
    from public.longevity_moment_sessions session
    where session.user_id = $1
      and session.local_date = $2::date
      and session.moment = $3
      and coalesce(session.expires_at, now() + interval '1 minute') > now()
      and not exists (
        select 1
        from public.longevity_action_events event
        where event.user_id = session.user_id
          and event.created_at > session.updated_at
          and event.event_type in ('done','too_hard','not_relevant')
      )
    limit 1
  `, [input.userId, input.rotationDate, input.activeMoment]);
  const payload = rows[0]?.payload;
  return isCachedLongevityCompanionPayload(payload, input.activeMoment, input.language)
    ? safeJson<LongevityCompanionPayload>(payload, {} as LongevityCompanionPayload)
    : null;
}

async function cacheLongevityMomentSession(input: {
  userId: string;
  planId: string | null;
  rotationDate: string;
  payload: LongevityCompanionPayload;
}): Promise<void> {
  const session = input.payload.currentMomentSession;
  const action = session.primaryExperience.action;
  const video = session.primaryExperience.video;
  await optionalQuery("longevity_moment_sessions", `
    insert into public.longevity_moment_sessions
      (user_id, plan_id, local_date, moment, program_day_id, primary_action_key, content_id, resource_id, payload, expires_at)
    values ($1, $2::uuid, $3::date, $4, $5::uuid, $6, $7::uuid, $8::uuid, $9::jsonb, now() + interval '36 hours')
    on conflict (user_id, local_date, moment)
    do update set
      plan_id = excluded.plan_id,
      program_day_id = excluded.program_day_id,
      primary_action_key = excluded.primary_action_key,
      content_id = excluded.content_id,
      resource_id = excluded.resource_id,
      payload = excluded.payload,
      updated_at = now(),
      expires_at = excluded.expires_at
  `, [
    input.userId,
    input.planId,
    input.rotationDate,
    session.moment,
    isUuid(input.payload.todayProgramStep?.id) ? input.payload.todayProgramStep?.id : null,
    action.action_key,
    isUuid(action.content_id) ? action.content_id : null,
    isUuid(video?.id) ? video?.id : null,
    JSON.stringify(input.payload),
  ]);
}

async function logLongevityProgramVideoShown(input: {
  userId: string;
  planId: string | null;
  payload: LongevityCompanionPayload;
}): Promise<void> {
  const step = input.payload.todayProgramStep;
  const video = input.payload.todayVideo;
  if (!step || !video) return;

  const actionKey = `video:${video.videoId}:${step.id}`;
  const existing = await optionalQuery<{ id: string }>("longevity_action_events", `
    select id
    from public.longevity_action_events
    where user_id = $1
      and action_key = $2
      and event_type = 'shown'
      and created_at >= current_date
    limit 1
  `, [input.userId, actionKey]);
  if (existing[0]) return;

  await recordLongevityActionEvent({
    userId: input.userId,
    planId: input.planId,
    pillar: step.pillar,
    actionKey,
    actionTitle: video.title,
    eventType: "shown",
    barrier: null,
    moment: input.payload.activeMoment,
    contentId: null,
    resourceId: isUuid(video.id) ? video.id : null,
    sourceContext: {
      moment: input.payload.activeMoment,
      programId: input.payload.activeProgram?.id ?? step.programId,
      programKey: input.payload.activeProgram?.programKey ?? LONGEVITY_PROGRAM_KEY,
      programDayId: step.id,
      programDayIndex: step.dayIndex,
      videoResourceId: video.id,
      videoId: video.videoId,
      videoUrl: video.url,
      videoTitle: video.title,
    },
  });

  await optionalQuery("longevity_program_days", `
    update public.longevity_program_days
    set status = case when status = 'scheduled' then 'shown' else status end,
        shown_at = coalesce(shown_at, now()),
        updated_at = now()
    where id = $1::uuid
  `, [step.id]);
}

async function getLatestPreventionPlan(userId: string): Promise<LongevityPreventionPlan | null> {
  const rows = await optionalQuery<LongevityPreventionPlan>("longevity_prevention_plans", `
    select * from public.longevity_prevention_plans
    where user_id = $1 and status = 'active'
    order by generated_at desc limit 1
  `, [userId]);
  return rows[0] ?? null;
}

function preventionRecommendations(scores: PreventionPillarScores): PreventionRecommendations {
  return Object.fromEntries(PREVENTION_PILLARS.map((pillar) => [pillar, PREVENTION_RECOMMENDATIONS[pillar][scores[pillar]]])) as PreventionRecommendations;
}

async function synthesizePreventionPlan(input: {
  pillarScores: PreventionPillarScores;
  priorityPillar: PreventionPillar | null;
  crossPillarPatterns: CrossPillarPattern[];
  conditionProfile: ConditionProfile;
  profile: ProfileSummary;
}): Promise<{
  recommendations: PreventionRecommendations;
  seniorNarrative: string;
  caregiverNarrative: string;
  gpAbstract: string;
  priorityIntervention: string;
  priorityWhy: string;
}> {
  const recommendations = preventionRecommendations(input.pillarScores);
  const focus = input.priorityPillar ?? [...PREVENTION_PILLARS].sort((a, b) => PREVENTION_STATUS_RANK[input.pillarScores[b]] - PREVENTION_STATUS_RANK[input.pillarScores[a]])[0];
  const first = recommendations[focus][0];
  const fallback = {
    recommendations,
    seniorNarrative: `${input.profile.first_name}, this month we are keeping your plan simple and practical. Your main focus is ${focus}, with small steps you can build into your day. Start with one action and add more only when it feels comfortable.`,
    caregiverNarrative: `Monthly wellness plan generated from available 90-day signals. Primary lifestyle domain: ${focus}.`,
    gpAbstract: `A 90-day general-wellness summary was generated across heart, cognitive, strength, nourishment, and calm domains. The current lifestyle focus is ${focus}.`,
    priorityIntervention: first?.action ?? "Choose one small wellbeing action today",
    priorityWhy: first?.why ?? "One clear step makes the plan easier to begin.",
  };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const fired = input.crossPillarPatterns.filter((pattern) => pattern.fired).map((pattern) => pattern.pattern);
  const system = `You write VYVA monthly longevity wellness plans for adults 65+.
Condition context: ${input.conditionProfile.framing_note}
Never diagnose, predict illness, recommend medication changes, or use these words in senior-facing text: risk, elevated, abnormal, diagnosis, critical, dangerous.
Every recommendation is a lifestyle action. For clinical matters say "worth discussing with your doctor."
Senior text: warm, personal, 3-5 sentences, first name ${input.profile.first_name}, language ${input.profile.language_preference || "es"}.
Caregiver and GP text: factual, in English. The deterministic statuses are fixed and must not be changed.`;
  const prompt = `Pillar statuses: ${JSON.stringify(input.pillarScores)}
Priority pillar: ${focus}
Patterns: ${fired.length ? fired.join(", ") : "none"}
Actions: ${JSON.stringify(recommendations)}
Produce exactly:
SENIOR_NARRATIVE: [text]
PRIORITY_INTERVENTION: [one verb-led sentence]
PRIORITY_WHY: [one sentence]
CAREGIVER_NARRATIVE: [text]
GP_ABSTRACT: [one paragraph]`;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    const text = block?.type === "text" ? block.text : "";
    const read = (label: string, next?: string) => text.match(new RegExp(`${label}:\\s*([\\s\\S]+?)${next ? `(?=${next}:|$)` : "$"}`, "i"))?.[1]?.trim() ?? "";
    return {
      recommendations,
      seniorNarrative: read("SENIOR_NARRATIVE", "PRIORITY_INTERVENTION") || fallback.seniorNarrative,
      priorityIntervention: read("PRIORITY_INTERVENTION", "PRIORITY_WHY") || fallback.priorityIntervention,
      priorityWhy: read("PRIORITY_WHY", "CAREGIVER_NARRATIVE") || fallback.priorityWhy,
      caregiverNarrative: read("CAREGIVER_NARRATIVE", "GP_ABSTRACT") || fallback.caregiverNarrative,
      gpAbstract: read("GP_ABSTRACT") || fallback.gpAbstract,
    };
  } catch (err) {
    console.error("[PreventionPlan] LLM synthesis failed:", err);
    return fallback;
  }
}

export async function runPreventionPlanSynthesis(userId: string): Promise<LongevityPreventionPlan> {
  if (!userId.trim()) throw new Error("A profile ID is required for prevention plan synthesis");
  const periodEnd = new Date();
  const periodStart = daysAgo(90);
  const [vitals, meds, cognitive, mood, symptoms, conditions, profile] = await Promise.all([
    getVitalsSummary(userId, periodStart),
    getMedicationSummary(userId, periodStart),
    getCognitiveSummary(userId, periodStart),
    getMoodSummary(userId, periodStart),
    getSymptomSummary(userId, periodStart),
    getUserConditions(userId),
    getUserProfile(userId),
  ]);
  const conditionProfile = await getConditionProfile(conditions);
  const medicationCount = numericValue(asSummary(meds).active_medications);
  const scores: PreventionPillarScores = {
    heart: scorePillarHeart({ vitals, meds, conditions, conditionProfile }),
    brain: scorePillarBrain({ cognitive, mood, conditions, conditionProfile }),
    strength: scorePillarStrength({ vitals, conditions, symptoms, medicationCount, conditionProfile }),
    nourishment: scorePillarNourishment({ meds, mood, conditions, conditionProfile }),
    calm: scorePillarCalm({ mood, vitals, conditions, conditionProfile }),
  };
  const patterns = detectCrossPillarPatterns({ pillarScores: scores, vitals, meds, cognitive, mood, symptoms });
  const priorityPillar = resolvePriorityPillar(scores, conditions);
  const finalScores = enforceSinglePriority(scores, priorityPillar);
  const synthesis = await synthesizePreventionPlan({ pillarScores: finalScores, priorityPillar, crossPillarPatterns: patterns, conditionProfile, profile });
  const previous = await getLatestPreventionPlan(userId);
  const trajectory = computePreventionTrajectory(finalScores, previous);
  const sourceSignals = { vitals: vitals !== null, medications: meds !== null, cognitive: cognitive !== null, mood: mood !== null, symptoms: symptoms !== null };

  await pool.query("update public.longevity_prevention_plans set status = 'superseded' where user_id = $1 and status = 'active'", [userId]);
  const result = await pool.query<LongevityPreventionPlan>(`
    insert into public.longevity_prevention_plans (
      user_id, period_start, period_end, pillar_heart, pillar_brain, pillar_strength, pillar_nourishment, pillar_calm,
      pillar_heart_signals, pillar_brain_signals, pillar_strength_signals, pillar_nourishment_signals, pillar_calm_signals,
      cross_pillar_patterns, recommendations, priority_intervention, priority_why, priority_pillar,
      plan_narrative_senior, plan_narrative_caregiver, plan_abstract_gp, trajectory, source_signals, confidence, status
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,
      $14::jsonb,$15::jsonb,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24,'active'
    ) returning *
  `, [
    userId, periodStart, periodEnd, finalScores.heart, finalScores.brain, finalScores.strength, finalScores.nourishment, finalScores.calm,
    JSON.stringify(vitals), JSON.stringify(cognitive), JSON.stringify({ vitals, symptoms }), JSON.stringify({ meds, mood }), JSON.stringify({ mood, vitals }),
    JSON.stringify(patterns), JSON.stringify(synthesis.recommendations), synthesis.priorityIntervention, synthesis.priorityWhy, priorityPillar,
    synthesis.seniorNarrative, synthesis.caregiverNarrative, synthesis.gpAbstract, trajectory, JSON.stringify(sourceSignals), computeConfidence(sourceSignals),
  ]);
  return result.rows[0];
}

export async function triggerPreventionPlanRefresh(input: {
  userId: string;
  triggerType?: unknown;
  triggerData?: unknown;
}): Promise<{ ran: boolean; reason?: "debounced" | "missing_user" }> {
  const userId = input.userId.trim();
  if (!userId) return { ran: false, reason: "missing_user" };

  const triggerType = normalizePreventionRefreshTrigger(input.triggerType);
  const recentRun = await optionalQuery<{ id: string }>("longevity_synthesis_events", `
    select id
    from public.longevity_synthesis_events
    where user_id = $1
      and synthesis_ran = true
      and created_at > now() - interval '6 hours'
    limit 1
  `, [userId]);

  const shouldRun = recentRun.length === 0;
  await optionalQuery("longevity_synthesis_events", `
    insert into public.longevity_synthesis_events (user_id, trigger_type, trigger_data, synthesis_ran)
    values ($1, $2, $3::jsonb, $4)
  `, [userId, triggerType, JSON.stringify(input.triggerData ?? {}), shouldRun]);

  if (!shouldRun) return { ran: false, reason: "debounced" };

  void runPreventionPlanSynthesis(userId).catch((err) => {
    console.error(`[PreventionPlan] Event-driven synthesis failed for ${userId}:`, err);
  });

  return { ran: true };
}

async function hasAtLeastThirtyDaysOfData(userId: string): Promise<boolean> {
  const candidates = await Promise.all([
    optionalQuery<{ first_at: Date | null }>("vyva_signal_readings", "select min(recorded_at) as first_at from public.vyva_signal_readings where user_id::text = $1", [userId]),
    optionalQuery<{ first_at: Date | null }>("medication_adherence", "select min(created_at) as first_at from public.medication_adherence where user_id = $1", [userId]),
    optionalQuery<{ first_at: Date | null }>("triage_reports", "select min(created_at) as first_at from public.triage_reports where user_id = $1", [userId]),
    optionalQuery<{ first_at: Date | null }>("checkin_sessions", "select min(completed_at) as first_at from public.checkin_sessions where user_id = $1", [userId]),
    optionalQuery<{ first_at: Date | null }>("cognitive_session_index", "select min(played_at) as first_at from public.cognitive_session_index where user_id = $1", [userId]),
  ]);
  return candidates.some((rows) => rows[0]?.first_at && new Date(rows[0].first_at).getTime() <= daysAgo(30).getTime());
}

async function wasPlanNudgeShownThisMonth(userId: string): Promise<boolean> {
  const rows = await optionalQuery<{ count: string | number }>("insight_outcomes", `
    select count(*)::int from public.insight_outcomes
    where user_id = $1::uuid and delivered_surface = 'smart_nudge' and action_taken = 'other'
      and delivered_at >= date_trunc('month', now())
  `, [userId]);
  return numericValue(rows[0]?.count) > 0;
}

async function markPlanNudgeShown(userId: string): Promise<void> {
  await optionalQuery("insight_outcomes", `
    insert into public.insight_outcomes (user_id, tier_at_generation, delivered_surface, action_taken)
    values ($1::uuid, 1, 'smart_nudge', 'other')
  `, [userId]);
}

async function runLLMSynthesis(input: {
  severity_tier: number;
  focus_domain: string;
  domainSummaries: SynthesisInput;
  correlationFlags: CorrelationFlag[];
  conditionFramingNote: string;
  profile: ProfileSummary;
  reportType: ReportType;
  windowDays: number;
}): Promise<{ caregiverText: string; seniorText: string }> {
  const { severity_tier, focus_domain, domainSummaries, correlationFlags, conditionFramingNote, profile, reportType, windowDays } = input;
  const fallback = {
    seniorText: `Hola, ${profile.first_name}. VYVA has prepared a calm ${focus_domain} focus for this week.`,
    caregiverText: "Deterministic signals are available in the domain summaries.",
  };

  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  const tierLabels: Record<number, string> = {
    1: "broadly well-managed; positive framing, gentle tips only",
    2: "one or two things worth attention; no alarm",
    3: "worth flagging to a doctor; calm, factual, clear action",
    4: "caregiver should be aware; factual, specific, not alarming",
    5: "urgent; calm, clear, immediate action required",
  };
  const firedRules = correlationFlags.filter((flag) => flag.fired).map((flag) => flag.rule);
  const system = `You are VYVA's health analysis engine.
Condition framing: ${conditionFramingNote}
NEVER produce a diagnosis, prognosis, or dosage instruction.
NEVER use: risk, elevated, abnormal, dangerous, critical, disease progression.
Regulatory constraint: general wellness guidance only, not clinical decision support.
The deterministic tier (${severity_tier}) is fixed; reflect it, do not override it.
Senior text: warm, <=3 sentences, no jargon, first name ${profile.first_name}, language ${profile.language_preference ?? "es"}.
Caregiver text: factual, domain-by-domain rationale, always in English.`;
  const user = `Report: ${reportType} (${windowDays}-day window)
Tier: ${severity_tier}; ${tierLabels[severity_tier] ?? tierLabels[1]}
Focus: ${focus_domain}
Domain summaries: ${JSON.stringify(domainSummaries, null, 2)}
Correlation rules fired: ${firedRules.length > 0 ? firedRules.join(", ") : "none"}

Produce exactly:
SENIOR_TEXT: [warm, personal, <=3 sentences, in ${profile.language_preference ?? "es"}]
CAREGIVER_TEXT: [factual rationale citing signals, in English]`;

  try {
    const response = await anthropic.messages.create({
      model: SYNTHESIS_MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = response.content[0];
    const text = block?.type === "text" ? block.text : "";
    const seniorMatch = text.match(/SENIOR_TEXT:\s*([\s\S]+?)(?=CAREGIVER_TEXT:|$)/i);
    const caregiverMatch = text.match(/CAREGIVER_TEXT:\s*([\s\S]+?)$/i);
    return {
      seniorText: seniorMatch?.[1]?.trim() || fallback.seniorText,
      caregiverText: caregiverMatch?.[1]?.trim() || fallback.caregiverText,
    };
  } catch (err) {
    console.error("[health-insights] LLM synthesis failed:", err);
    return fallback;
  }
}

export async function runFullSynthesis(userId: string, reportType: ReportType, windowDays: number): Promise<void> {
  if (!isUuid(userId)) return;
  const periodEnd = new Date();
  const periodStart = daysAgo(windowDays);

  const [vitals, meds, cognitive, mood, symptoms, concierge, conditions, profile, sustainedLow] = await Promise.all([
    getVitalsSummary(userId, periodStart),
    getMedicationSummary(userId, periodStart),
    getCognitiveSummary(userId, periodStart),
    getMoodSummary(userId, periodStart),
    getSymptomSummary(userId, periodStart),
    getConciergeSummary(userId, periodStart, windowDays),
    getUserConditions(userId),
    getUserProfile(userId),
    isSustainedLowTier(userId),
  ]);

  const sourceSignals = {
    vitals: vitals !== null,
    medications: meds !== null,
    cognitive: cognitive !== null,
    mood: mood !== null,
    symptoms: symptoms !== null,
    concierge: concierge !== null,
  };
  const domainSummaries = { vitals, meds, cognitive, mood, symptoms, concierge };
  const domainTiers = computeDomainTiers(domainSummaries);
  const correlationFlags = runCorrelationRules({ ...domainSummaries, domainTiers, sustained_low: sustainedLow });
  const correlationFloorTier = correlationFlags
    .filter((flag) => flag.fired)
    .reduce((max, flag) => Math.max(max, flag.severity ?? 1), 1);
  const conditionProfile = await getConditionProfile(conditions);
  const weightedTiers = applyConditionWeights(domainTiers, conditionProfile.weighted_domains);
  const severityTier = Math.min(5, Math.max(1, correlationFloorTier, ...Object.values(weightedTiers)));
  const focusDomain = getTopDomain(weightedTiers);
  const synthesis = await runLLMSynthesis({
    severity_tier: severityTier,
    focus_domain: focusDomain,
    domainSummaries,
    correlationFlags,
    conditionFramingNote: conditionProfile.framing_note,
    profile,
    reportType,
    windowDays,
  });

  await pool.query(`
    update public.health_insight_reports
    set status = 'superseded'
    where user_id = $1::uuid and report_type = $2 and status = 'active'
  `, [userId, reportType]);

  await pool.query(`
    insert into public.health_insight_reports (
      user_id, report_type, period_start, period_end,
      severity_tier, confidence, source_signals,
      vitals_summary, medication_summary, cognitive_summary,
      mood_summary, symptom_summary, concierge_summary,
      correlation_flags, synthesized_recommendation_caregiver,
      synthesized_recommendation_senior, focus_domain,
      recommend_clinician, status
    ) values (
      $1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18,'active'
    )
  `, [
    userId,
    reportType,
    periodStart,
    periodEnd,
    severityTier,
    computeConfidence(sourceSignals),
    JSON.stringify(sourceSignals),
    JSON.stringify(vitals),
    JSON.stringify(meds),
    JSON.stringify(cognitive),
    JSON.stringify(mood),
    JSON.stringify(symptoms),
    JSON.stringify(concierge),
    JSON.stringify(correlationFlags),
    synthesis.caregiverText,
    synthesis.seniorText,
    focusDomain,
    severityTier >= 3,
  ]);
}

async function getPendingFollowUps(): Promise<PendingOutcome[]> {
  return optionalQuery<PendingOutcome>("insight_outcomes", `
    select id, user_id, report_id, action_id, tier_at_generation, delivered_surface
    from public.insight_outcomes
    where resolved = false
      and follow_up_check_at is not null
      and follow_up_check_at <= now()
    order by follow_up_check_at asc
    limit 500
  `);
}

async function computeMetricDelta(outcome: PendingOutcome): Promise<Record<string, unknown>> {
  const report = outcome.report_id ? await getReportById(outcome.user_id, outcome.report_id) : null;
  const currentVitals = await getVitalsSummary(outcome.user_id, daysAgo(7));
  const currentMeds = await getMedicationSummary(outcome.user_id, daysAgo(7));
  const currentMood = await getMoodSummary(outcome.user_id, daysAgo(7));
  return {
    generated_at: new Date().toISOString(),
    tier_at_generation: outcome.tier_at_generation,
    focus_domain: report?.focus_domain ?? null,
    before: {
      vitals: report?.vitals_summary ?? null,
      medication: report?.medication_summary ?? null,
      mood: report?.mood_summary ?? null,
    },
    after: {
      vitals: currentVitals,
      medication: currentMeds,
      mood: currentMood,
    },
  };
}

async function resolvePendingOutcomes(): Promise<void> {
  const pending = await getPendingFollowUps();
  for (const outcome of pending) {
    try {
      const delta = await computeMetricDelta(outcome);
      await pool.query(`
        update public.insight_outcomes
        set outcome_metric_delta = $1::jsonb, resolved = true
        where id = $2::uuid
      `, [JSON.stringify(delta), outcome.id]);
    } catch (err) {
      console.error(`[health-insights] Outcome follow-up failed for ${outcome.id}:`, err);
    }
  }
}

router.get("/prevention/plan/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);
  try {
    return res.json(await getFreshPreventionPlan(userId));
  } catch (err) {
    console.error("[PreventionPlan] GET error:", err);
    return res.json(fallbackPreventionPlan(userId));
  }
});

router.get("/prevention/companion/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);
  const periodStart = daysAgo(14);

  try {
    const plan = await getFreshPreventionPlan(userId);
    const [profile, conditions, vitals, meds, cognitive, mood, symptoms, feedbackHistory] = await Promise.all([
      getUserProfile(userId),
      getUserConditions(userId),
      getVitalsSummary(userId, periodStart),
      getMedicationSummary(userId, periodStart),
      getCognitiveSummary(userId, periodStart),
      getMoodSummary(userId, periodStart),
      getSymptomSummary(userId, periodStart),
      getRecentPlanActionEvents(userId),
    ]);
    const rotationDate = todaySeed(profile.timezone);
    const activeMoment = activeLongevityMoment(profile.timezone);
    const cachedPayload = await getCachedLongevityMomentPayload({
      userId,
      rotationDate,
      activeMoment,
      language: profile.language_preference,
    });
    if (cachedPayload) return res.json(cachedPayload);

    const dailyContent = await getDailyContentBundle(userId, conditions, profile, activeMoment);
    const programLayer = await getLongevityProgramLayer({
      userId,
      profile,
      plan,
      feedbackHistory,
      rotationDate,
    });
    const payload = composeLongevityCompanionPayload({
      plan,
      profile,
      conditions,
      vitals,
      meds,
      cognitive,
      mood,
      symptoms,
      dailyContent,
      feedbackHistory,
      rotationDate,
      activeMoment,
      programLayer,
    });
    logDailyContentShown(userId, dailyContentRowsForActions(dailyContent, Object.values(payload.pillarActions)));
    void logLongevityProgramVideoShown({ userId, planId: plan.id, payload }).catch((logErr) => {
      console.warn("[PreventionCompanion] Program video shown log failed; continuing.", logErr);
    });
    void cacheLongevityMomentSession({ userId, planId: plan.id, rotationDate, payload }).catch((cacheErr) => {
      console.warn("[PreventionCompanion] Moment session cache failed; continuing.", cacheErr);
    });
    return res.json(payload);
  } catch (err) {
    console.error("[PreventionCompanion] GET error:", err);
    const profile = await getUserProfile(userId).catch(() => FALLBACK_PROFILE);
    const plan = fallbackPreventionPlan(userId);
    return res.json(composeLongevityCompanionPayload({
      plan,
      profile,
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: null,
      mood: null,
      symptoms: null,
      dailyContent: emptyDailyContentBundle(),
      feedbackHistory: [],
      activeMoment: activeLongevityMoment(profile.timezone),
      programLayer: buildFallbackLongevityProgramLayer({
        userId,
        profile,
        plan,
        feedbackHistory: [],
        rotationDate: todaySeed(profile.timezone),
      }),
    }));
  }
});

router.get("/prevention/daily-content/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const [conditions, profile] = await Promise.all([
      getUserConditions(userId),
      getUserProfile(userId),
    ]);
    const dailyContent = await getDailyContentBundle(userId, conditions, profile, activeLongevityMoment(profile.timezone));
    logDailyContentShown(userId, uniqueDailyContentRows([
      dailyContent.exercise,
      dailyContent.meal,
      dailyContent.tip,
      dailyContent.supplement,
      dailyContent.naturalSolution,
      ...dailyContent.articles,
    ].filter((row): row is DailyContentRow => Boolean(row))));
    return res.json(dailyContent);
  } catch (err) {
    console.error("[DailyContent] GET error:", err);
    return res.json(emptyDailyContentBundle());
  }
});

router.post("/prevention/feedback", async (req: Request, res: Response) => {
  const rawUserId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  const profileId = await resolveProfileId(req, res, rawUserId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);
  const eventType = normalizeLongevityActionEventType(req.body?.eventType);
  const actionKey = oneLine(typeof req.body?.actionKey === "string" ? req.body.actionKey : "");
  const actionTitle = oneLine(typeof req.body?.actionTitle === "string" ? req.body.actionTitle : "");
  const barrier = typeof req.body?.barrier === "string" && req.body.barrier.trim() ? truncate(req.body.barrier, 160) : null;
  const sourceContext = typeof req.body?.sourceContext === "object" && req.body.sourceContext !== null
    ? req.body.sourceContext as Record<string, unknown>
    : {};
  const moment = normalizeLongevityMoment(req.body?.moment ?? sourceContext.moment);
  const contentId = isUuid(req.body?.contentId)
    ? String(req.body.contentId)
    : isUuid(sourceContext.contentId)
      ? String(sourceContext.contentId)
      : null;
  const resourceId = isUuid(req.body?.resourceId)
    ? String(req.body.resourceId)
    : isUuid(sourceContext.resourceId)
      ? String(sourceContext.resourceId)
      : isUuid(sourceContext.videoResourceId)
        ? String(sourceContext.videoResourceId)
        : null;

  if (!eventType || !actionKey || !actionTitle) {
    return res.status(400).json({ success: false, error: "Invalid feedback payload" });
  }

  try {
    await recordLongevityActionEvent({
      userId,
      planId: isUuid(req.body?.planId) ? req.body.planId : null,
      pillar: normalizePreventionPillar(req.body?.pillar),
      actionKey: truncate(actionKey, 96),
      actionTitle: truncate(actionTitle, 180),
      eventType,
      barrier,
      moment,
      contentId,
      resourceId,
      sourceContext: {
        ...sourceContext,
        moment,
        contentId,
        resourceId,
      },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[PreventionFeedback] POST error:", err);
    return res.status(500).json({ success: false });
  }
});

router.post("/prevention/daily-content/engage", async (req: Request, res: Response) => {
  const rawUserId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  const profileId = await resolveProfileId(req, res, rawUserId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);
  const contentId = typeof req.body?.contentId === "string" ? req.body.contentId : "";

  if (!isUuid(contentId)) {
    return res.status(400).json({ success: false, error: "Invalid content id" });
  }

  try {
    await optionalQuery("longevity_daily_content_log", `
      insert into public.longevity_daily_content_log (user_id, content_id, shown_on, engaged)
      values ($1, $2::uuid, current_date, true)
      on conflict (user_id, content_id, shown_on)
      do update set engaged = true
    `, [userId, contentId]);
    return res.json({ success: true });
  } catch (err) {
    console.error("[DailyContent] engage error:", err);
    return res.json({ success: false });
  }
});

router.get("/prevention/pillar-status/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const periodStart = daysAgo(14);
    const [vitals, meds, cognitive, mood, symptoms, conditions] = await Promise.all([
      getVitalsSummary(userId, periodStart),
      getMedicationSummary(userId, periodStart),
      getCognitiveSummary(userId, periodStart),
      getMoodSummary(userId, periodStart),
      getSymptomSummary(userId, periodStart),
      getUserConditions(userId),
    ]);
    const conditionProfile = await getConditionProfile(conditions);
    const medicationCount = numericValue(asSummary(meds).active_medications);
    const scores: PreventionPillarScores = {
      heart: scorePillarHeart({ vitals, meds, conditions, conditionProfile }),
      brain: scorePillarBrain({ cognitive, mood, conditions, conditionProfile }),
      strength: scorePillarStrength({ vitals, conditions, symptoms, medicationCount, conditionProfile }),
      nourishment: scorePillarNourishment({ meds, mood, conditions, conditionProfile }),
      calm: scorePillarCalm({ mood, vitals, conditions, conditionProfile }),
    };
    const priorityPillar = resolvePriorityPillar(scores, conditions) ?? worstPreventionPillar(scores);
    const statuses = enforceSinglePriority(scores, priorityPillar);

    return res.json({ statuses, priority_pillar: priorityPillar });
  } catch (err) {
    console.error("[PillarStatus] GET error:", err);
    return res.json({
      statuses: { heart: "steady", brain: "steady", strength: "steady", nourishment: "steady", calm: "steady" },
      priority_pillar: null,
    });
  }
});

router.post("/prevention/refresh", async (req: Request, res: Response) => {
  const rawUserId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  const profileId = await resolveProfileId(req, res, rawUserId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const result = await triggerPreventionPlanRefresh({
      userId,
      triggerType: req.body?.triggerType,
      triggerData: req.body?.triggerData,
    });
    return res.json(result);
  } catch (err) {
    console.error("[PreventionPlan] refresh error:", err);
    return res.status(500).json({ ran: false, error: "Failed to refresh plan" });
  }
});

// Longevity is canonical; /agewell remains a compatibility alias for already
// deployed clients and database delivery records.
router.get(["/longevity/today/:userId", "/agewell/today/:userId"], async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const latestReport = await getLatestReport(userId, "weekly");
    const realTimeSignals = await checkRealTimeSignals(userId, latestReport?.generated_at);
    const effectiveTier = Math.min(5, Math.max(latestReport?.severity_tier ?? 1, realTimeSignals.tierRaise));
    const userConditions = await getUserConditions(userId);
    const [actions, userProfile] = await Promise.all([
      selectActions(userId, effectiveTier, latestReport?.focus_domain, userConditions),
      getUserProfile(userId),
    ]);
    const { heroCopy, insightText } = await generateDailyHeroCopy({
      report: latestReport,
      effectiveTier,
      urgentFlags: realTimeSignals.urgentFlags,
      userProfile,
    });

    if (latestReport?.id) {
      await logDelivery(userId, latestReport.id, null, "agewell_plan", effectiveTier);
    }

    res.json({
      tier: effectiveTier,
      focus_label: latestReport?.focus_domain ?? "general",
      hero_copy: heroCopy,
      insight_text: insightText,
      actions,
      data_completeness: latestReport?.source_signals ?? {},
      report_generated_at: latestReport?.generated_at ?? null,
    });
  } catch (err) {
    console.error("[Longevity] /today error:", err);
    res.json(safeFallbackToday());
  }
});

router.post(["/longevity/feedback", "/agewell/feedback"], async (req: Request, res: Response) => {
  const { userId: rawUserId, actionId, outcome, reportId } = req.body ?? {};
  const profileId = await resolveProfileId(req, res, rawUserId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  if (!["done", "hard", "skip"].includes(outcome) || !isUuid(actionId)) {
    res.status(400).json({ success: false, error: "Invalid feedback payload" });
    return;
  }

  try {
    await updateFeedback(userId, actionId, outcome, reportId);
    res.json({ success: true });
  } catch (err) {
    console.error("[Longevity] /feedback error:", err);
    res.status(500).json({ success: false });
  }
});

router.get("/smart-nudge/current/:userId", async (req: Request, res: Response) => {
  const profileId = await resolveProfileId(req, res, req.params.userId);
  if (!profileId) return;
  const userId = storageUserId(profileId, req.user?.id);

  try {
    const missedMed = await checkMissedMedicationToday(userId);
    if (missedMed) {
      return res.json({
        type: "medication",
        color: "#E74C43",
        message: missedMed.message,
        action_route: "/health/medications",
      });
    }

    const report = await getLatestReport(userId, "weekly");
    if (report && report.status === "active" && !(await wasNudgeShownToday(userId, report.id))) {
      if (report.severity_tier === 5) {
        await logDelivery(userId, report.id, null, "smart_nudge", 5);
        return res.json({
          type: "emergency",
          color: "#E74C43",
          message: truncate(report.synthesized_recommendation_senior, 100),
          action_route: "/health",
        });
      }
      if (report.severity_tier === 4) {
        await logDelivery(userId, report.id, null, "smart_nudge", 4);
        return res.json({
          type: "alert",
          color: "#E74C43",
          message: truncate(report.synthesized_recommendation_senior, 100),
          action_route: "/health",
        });
      }
      if (report.severity_tier === 3) {
        await logDelivery(userId, report.id, null, "smart_nudge", 3);
        return res.json({
          type: "doctor",
          color: "#6B21A8",
          message: truncate(report.synthesized_recommendation_senior, 100),
          action_route: "/health",
        });
      }
    }

    const brainCoachDue = await checkBrainCoachDue(userId);
    if (brainCoachDue) {
      return res.json({
        type: "brain_coach",
        color: "#F59E0B",
        message: brainCoachDue.message,
        action_route: "/mind-memory",
      });
    }

    const appointment = await checkUpcomingAppointment(userId);
    if (appointment) {
      return res.json({
        type: "appointment",
        color: "#6B21A8",
        message: appointment.message,
        action_route: "/concierge",
      });
    }

    const now = new Date();
    if (now.getDay() === 1 && now.getDate() <= 7) {
      const latestPlan = await getLatestPreventionPlan(userId);
      if (latestPlan && !(await wasPlanNudgeShownThisMonth(userId))) {
        const profile = await getUserProfile(userId);
        await markPlanNudgeShown(userId);
        return res.json({
          type: "prevention_plan",
          color: "#6B21A8",
          message: `Tu plan del mes está listo, ${profile.first_name}.`,
          action_route: "/health/prevention-plan",
        });
      }
    }

    if (report && report.severity_tier === 2 && !(await wasNudgeShownToday(userId, report.id))) {
      await logDelivery(userId, report.id, null, "smart_nudge", 2);
      return res.json({
        type: "suggestion",
        color: "#F59E0B",
        message: truncate(report.synthesized_recommendation_senior, 100),
        action_route: "/health",
      });
    }

    const streak = await getUserStreak(userId);
    if (streak && streak.days > 1) {
      return res.json({
        type: "streak",
        color: "#149A63",
        message: streak.message,
        action_route: "/mind-memory",
      });
    }

    res.json(nullNudge());
  } catch (err) {
    console.error("[SmartNudge] error:", err);
    res.json(nullNudge());
  }
});

let jobsRegistered = false;
export function registerHealthInsightsJobs(): void {
  if (jobsRegistered || process.env.NODE_ENV === "test" || process.env.DISABLE_HEALTH_INSIGHTS_CRON === "true") return;
  jobsRegistered = true;
  const timezone = process.env.HEALTH_INSIGHTS_CRON_TIMEZONE ?? "Europe/Madrid";

  cron.schedule("0 3 * * 1", async () => {
    console.log("[InsightsEngine] Weekly synthesis starting...");
    const activeUsers = await getActiveUserIds();
    for (const userId of activeUsers) {
      try {
        await runFullSynthesis(userId, "weekly", 7);
      } catch (err) {
        console.error(`[InsightsEngine] Weekly failed for ${userId}:`, err);
      }
    }
    console.log("[InsightsEngine] Weekly synthesis complete.");
  }, { timezone });

  cron.schedule("0 3 * * 1", async () => {
    const now = new Date();
    if (now.getDate() > 7) {
      console.log("[InsightsEngine] Monthly guard skipped; not first Monday window.");
      return;
    }
    console.log("[InsightsEngine] Monthly deep report starting...");
    const activeUsers = await getActiveUserIds();
    for (const userId of activeUsers) {
      try {
        await runFullSynthesis(userId, "monthly", 30);
      } catch (err) {
        console.error(`[InsightsEngine] Monthly failed for ${userId}:`, err);
      }
      try {
        if (await hasAtLeastThirtyDaysOfData(userId)) {
          await runPreventionPlanSynthesis(userId);
        } else {
          console.log(`[PreventionPlan] Skipped ${userId}; fewer than 30 days of data.`);
        }
      } catch (err) {
        console.error(`[PreventionPlan] Monthly synthesis failed for ${userId}:`, err);
      }
    }
    console.log("[InsightsEngine] Monthly deep report complete.");
  }, { timezone });

  cron.schedule("0 4 * * *", async () => {
    console.log("[InsightsEngine] Outcome follow-up starting...");
    await resolvePendingOutcomes();
    console.log("[InsightsEngine] Outcome follow-up complete.");
  }, { timezone });
}

// TODO: Wire the Longevity UI to /api/longevity/today/:userId.
// TODO: ElevenLabs voice delivery for synthesized senior recommendations.
// TODO: GP-ready PDF export from monthly health_insight_reports.
// TODO: Caregiver dashboard report view from health_insight_reports.
// TODO: Aggregate operator view grouped by report_type, generated_at, and severity_tier.
// TODO: GP-ready PDF export from plan_abstract_gp in the care-team accordion.
// TODO: ElevenLabs voice delivery for the senior narrative and pillar actions.
// TODO: Month-over-month trajectory visualisation after at least two stored plans.
// TODO: Outcome learning from Done and Skip feedback after at least three months.

export default router;
