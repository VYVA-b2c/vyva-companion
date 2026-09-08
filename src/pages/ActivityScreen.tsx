import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Footprints, Bike, PersonStanding, Dumbbell, Wind, CheckCircle2, Loader2, Pencil, Home, Camera, AlertTriangle, ShieldAlert, ChevronRight, ShoppingBasket, Wrench, Car, Users, Clock3, type LucideIcon } from "lucide-react";
import VoiceHero from "@/components/VoiceHero";
import { BottomSheet, SectionTitle } from "@/components/vyva-ui";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { useLocation, useNavigate } from "react-router-dom";
import type { ActivityLog } from "../../shared/schema";
import { useProfile } from "@/contexts/ProfileContext";
import { useLanguage } from "@/i18n";
import { safeHomeQuoteState, safeHomeShoppingState, type SafeHomeActionScan } from "./SafeHomeScreen";
import chairYogaImage from "@/assets/senior-activities/chair-yoga.jpg";
import taiChiImage from "@/assets/senior-activities/tai-chi.jpg";
import seatedStrengthImage from "@/assets/senior-activities/seated-strength.jpg";
import calmBreathingImage from "@/assets/senior-activities/calm-breathing.jpg";
import sitToStandImage from "@/assets/senior-activities/sit-to-stand.jpg";
import heelRaisesImage from "@/assets/senior-activities/heel-raises.jpg";
import wallPushUpsImage from "@/assets/senior-activities/wall-push-ups.jpg";
import ankleMobilityImage from "@/assets/senior-activities/ankle-mobility.jpg";
import chestOpenerImage from "@/assets/senior-activities/chest-opener.jpg";
import sideStepsImage from "@/assets/senior-activities/side-steps.jpg";
import handBreathingImage from "@/assets/senior-activities/hand-breathing.jpg";
import shoulderReleaseImage from "@/assets/senior-activities/shoulder-release.jpg";

type ActivityTypeMeta = {
  key: string;
  icon: LucideIcon;
  labelKey: string;
  fallbackLabel: string;
  bg: string;
  color: string;
};

type SeniorExercise = {
  id: string;
  logType: string;
  group: "strength" | "balance" | "mobility" | "calm";
  titleKey: string;
  title: string;
  benefitKey: string;
  benefit: string;
  focusKey: string;
  focus: string;
  whyKey: string;
  why: string;
  tipKey: string;
  tip: string;
  image: string;
  duration: number;
  accent: string;
  softBg: string;
  border: string;
  icon: LucideIcon;
  steps: Array<{ key: string; fallback: string }>;
};

type SeniorRoutine = {
  id: string;
  logType: string;
  titleKey: string;
  title: string;
  subtitleKey: string;
  subtitle: string;
  exerciseIds: [string, string, string];
  duration: number;
  accent: string;
  softBg: string;
  border: string;
};

const ACTIVITY_TYPES: ActivityTypeMeta[] = [
  { key: "Walking",    icon: Footprints,     labelKey: "activity.types.walking",    fallbackLabel: "Walking",    bg: "#FEF3C7", color: "#B45309" },
  { key: "Cycling",    icon: Bike,           labelKey: "activity.types.cycling",    fallbackLabel: "Cycling",    bg: "#ECFDF5", color: "#059669" },
  { key: "Stretching", icon: PersonStanding, labelKey: "activity.types.stretching", fallbackLabel: "Stretching", bg: "#F5F3FF", color: "#6B21A8" },
  { key: "Exercise",   icon: Dumbbell,       labelKey: "activity.types.exercise",   fallbackLabel: "Exercise",   bg: "#FFF1F2", color: "#BE185D" },
  { key: "Breathing",  icon: Wind,           labelKey: "activity.types.breathing",  fallbackLabel: "Breathing",  bg: "#F0FDFA", color: "#0F766E" },
];

const SENIOR_EXERCISES: SeniorExercise[] = [
  {
    id: "chair-yoga",
    logType: "ChairYoga",
    group: "mobility",
    titleKey: "activity.gentleExercises.chairYoga.title",
    title: "Chair yoga",
    benefitKey: "activity.gentleExercises.chairYoga.benefit",
    benefit: "Loosen shoulders",
    focusKey: "activity.gentleExercises.chairYoga.focus",
    focus: "Flexibility",
    whyKey: "activity.gentleExercises.chairYoga.why",
    why: "Helps your shoulders, neck, and upper back feel looser before daily tasks.",
    tipKey: "activity.gentleExercises.chairYoga.tip",
    tip: "Keep both feet on the floor and make every reach smaller if needed.",
    image: chairYogaImage,
    duration: 10,
    accent: "#6B21A8",
    softBg: "#F5F3FF",
    border: "#D8B4FE",
    icon: PersonStanding,
    steps: [
      { key: "activity.gentleExercises.chairYoga.steps.1", fallback: "Sit tall with both feet flat." },
      { key: "activity.gentleExercises.chairYoga.steps.2", fallback: "Roll your shoulders back twice." },
      { key: "activity.gentleExercises.chairYoga.steps.3", fallback: "Reach one arm overhead and breathe." },
      { key: "activity.gentleExercises.chairYoga.steps.4", fallback: "Change sides slowly." },
    ],
  },
  {
    id: "tai-chi",
    logType: "TaiChi",
    group: "balance",
    titleKey: "activity.gentleExercises.taiChi.title",
    title: "Tai chi",
    benefitKey: "activity.gentleExercises.taiChi.benefit",
    benefit: "Balance practice",
    focusKey: "activity.gentleExercises.taiChi.focus",
    focus: "Balance",
    whyKey: "activity.gentleExercises.taiChi.why",
    why: "Slow weight shifts can help you practice balance and body awareness.",
    tipKey: "activity.gentleExercises.taiChi.tip",
    tip: "Keep a chair or counter nearby so the movement feels steady.",
    image: taiChiImage,
    duration: 10,
    accent: "#33691E",
    softBg: "#EEF8DF",
    border: "#CFE8B8",
    icon: PersonStanding,
    steps: [
      { key: "activity.gentleExercises.taiChi.steps.1", fallback: "Stand tall with a chair nearby if helpful." },
      { key: "activity.gentleExercises.taiChi.steps.2", fallback: "Soften your knees." },
      { key: "activity.gentleExercises.taiChi.steps.3", fallback: "Shift weight gently from one foot to the other." },
      { key: "activity.gentleExercises.taiChi.steps.4", fallback: "Float your hands forward and back slowly." },
    ],
  },
  {
    id: "seated-strength",
    logType: "SeatedStrength",
    group: "strength",
    titleKey: "activity.gentleExercises.seatedStrength.title",
    title: "Seated strength",
    benefitKey: "activity.gentleExercises.seatedStrength.benefit",
    benefit: "Build leg strength",
    focusKey: "activity.gentleExercises.seatedStrength.focus",
    focus: "Strength",
    whyKey: "activity.gentleExercises.seatedStrength.why",
    why: "Gentle leg work supports everyday standing, walking, and getting up from a chair.",
    tipKey: "activity.gentleExercises.seatedStrength.tip",
    tip: "Move slowly and pause between sides so you stay in control.",
    image: seatedStrengthImage,
    duration: 10,
    accent: "#0F766E",
    softBg: "#F0FDFA",
    border: "#99F6E4",
    icon: Dumbbell,
    steps: [
      { key: "activity.gentleExercises.seatedStrength.steps.1", fallback: "Sit near the front of the chair." },
      { key: "activity.gentleExercises.seatedStrength.steps.2", fallback: "Hold the chair sides lightly." },
      { key: "activity.gentleExercises.seatedStrength.steps.3", fallback: "Lift one knee or straighten one leg." },
      { key: "activity.gentleExercises.seatedStrength.steps.4", fallback: "Lower slowly and change sides." },
    ],
  },
  {
    id: "calm-breathing",
    logType: "CalmBreathing",
    group: "calm",
    titleKey: "activity.gentleExercises.calmBreathing.title",
    title: "Calm breathing",
    benefitKey: "activity.gentleExercises.calmBreathing.benefit",
    benefit: "Settle your breath",
    focusKey: "activity.gentleExercises.calmBreathing.focus",
    focus: "Calm",
    whyKey: "activity.gentleExercises.calmBreathing.why",
    why: "A slow breathing rhythm can help the session feel calmer and more focused.",
    tipKey: "activity.gentleExercises.calmBreathing.tip",
    tip: "If comfortable, let the breath out last a little longer than the breath in.",
    image: calmBreathingImage,
    duration: 10,
    accent: "#2F66D0",
    softBg: "#EFF6FF",
    border: "#BFDBFE",
    icon: Wind,
    steps: [
      { key: "activity.gentleExercises.calmBreathing.steps.1", fallback: "Sit comfortably with shoulders relaxed." },
      { key: "activity.gentleExercises.calmBreathing.steps.2", fallback: "Place one hand on chest and one on belly." },
      { key: "activity.gentleExercises.calmBreathing.steps.3", fallback: "Breathe in slowly through your nose." },
      { key: "activity.gentleExercises.calmBreathing.steps.4", fallback: "Breathe out gently and relax your jaw." },
    ],
  },
  {
    id: "sit-to-stand",
    logType: "SitToStand",
    group: "strength",
    titleKey: "activity.gentleExercises.sitToStand.title",
    title: "Sit-to-stand",
    benefitKey: "activity.gentleExercises.sitToStand.benefit",
    benefit: "Stand with confidence",
    focusKey: "activity.gentleExercises.sitToStand.focus",
    focus: "Leg strength",
    whyKey: "activity.gentleExercises.sitToStand.why",
    why: "Practices the same motion used for getting up from a chair or sofa.",
    tipKey: "activity.gentleExercises.sitToStand.tip",
    tip: "Use a stable chair and press through your feet rather than pulling with your hands.",
    image: sitToStandImage,
    duration: 10,
    accent: "#B45309",
    softBg: "#FFF7ED",
    border: "#FED7AA",
    icon: PersonStanding,
    steps: [
      { key: "activity.gentleExercises.sitToStand.steps.1", fallback: "Sit near the front of a stable chair." },
      { key: "activity.gentleExercises.sitToStand.steps.2", fallback: "Place your feet under your knees." },
      { key: "activity.gentleExercises.sitToStand.steps.3", fallback: "Lean forward and stand slowly." },
      { key: "activity.gentleExercises.sitToStand.steps.4", fallback: "Sit back down with control." },
    ],
  },
  {
    id: "heel-raises",
    logType: "HeelRaises",
    group: "balance",
    titleKey: "activity.gentleExercises.heelRaises.title",
    title: "Heel raises",
    benefitKey: "activity.gentleExercises.heelRaises.benefit",
    benefit: "Steady ankles",
    focusKey: "activity.gentleExercises.heelRaises.focus",
    focus: "Balance",
    whyKey: "activity.gentleExercises.heelRaises.why",
    why: "Helps the ankles and calves practice a small, controlled balance movement.",
    tipKey: "activity.gentleExercises.heelRaises.tip",
    tip: "Hold the chair lightly and keep the rise small until it feels easy.",
    image: heelRaisesImage,
    duration: 10,
    accent: "#047857",
    softBg: "#ECFDF5",
    border: "#A7F3D0",
    icon: Footprints,
    steps: [
      { key: "activity.gentleExercises.heelRaises.steps.1", fallback: "Stand behind a stable chair." },
      { key: "activity.gentleExercises.heelRaises.steps.2", fallback: "Hold the chair lightly." },
      { key: "activity.gentleExercises.heelRaises.steps.3", fallback: "Rise onto your toes slowly." },
      { key: "activity.gentleExercises.heelRaises.steps.4", fallback: "Lower your heels and repeat." },
    ],
  },
  {
    id: "wall-push-ups",
    logType: "WallPushUps",
    group: "strength",
    titleKey: "activity.gentleExercises.wallPushUps.title",
    title: "Wall push-ups",
    benefitKey: "activity.gentleExercises.wallPushUps.benefit",
    benefit: "Upper-body strength",
    focusKey: "activity.gentleExercises.wallPushUps.focus",
    focus: "Strength",
    whyKey: "activity.gentleExercises.wallPushUps.why",
    why: "Builds gentle arm, chest, and shoulder strength without getting down on the floor.",
    tipKey: "activity.gentleExercises.wallPushUps.tip",
    tip: "Step closer to the wall to make it easier, or farther away to make it stronger.",
    image: wallPushUpsImage,
    duration: 10,
    accent: "#BE185D",
    softBg: "#FFF1F2",
    border: "#FECDD3",
    icon: Dumbbell,
    steps: [
      { key: "activity.gentleExercises.wallPushUps.steps.1", fallback: "Stand an arm's length from a wall." },
      { key: "activity.gentleExercises.wallPushUps.steps.2", fallback: "Place your hands at chest height." },
      { key: "activity.gentleExercises.wallPushUps.steps.3", fallback: "Bend your elbows slowly toward the wall." },
      { key: "activity.gentleExercises.wallPushUps.steps.4", fallback: "Press back to tall posture." },
    ],
  },
  {
    id: "ankle-mobility",
    logType: "AnkleMobility",
    group: "mobility",
    titleKey: "activity.gentleExercises.ankleMobility.title",
    title: "Ankle mobility",
    benefitKey: "activity.gentleExercises.ankleMobility.benefit",
    benefit: "Wake up feet",
    focusKey: "activity.gentleExercises.ankleMobility.focus",
    focus: "Mobility",
    whyKey: "activity.gentleExercises.ankleMobility.why",
    why: "Gentle foot and ankle movement can make the start of a walk feel smoother.",
    tipKey: "activity.gentleExercises.ankleMobility.tip",
    tip: "Keep the movement small and change feet before the working foot feels tired.",
    image: ankleMobilityImage,
    duration: 10,
    accent: "#0E7490",
    softBg: "#ECFEFF",
    border: "#A5F3FC",
    icon: Footprints,
    steps: [
      { key: "activity.gentleExercises.ankleMobility.steps.1", fallback: "Sit tall and hold the chair if helpful." },
      { key: "activity.gentleExercises.ankleMobility.steps.2", fallback: "Lift one foot slightly." },
      { key: "activity.gentleExercises.ankleMobility.steps.3", fallback: "Flex your toes up, then point gently." },
      { key: "activity.gentleExercises.ankleMobility.steps.4", fallback: "Change feet when ready." },
    ],
  },
  {
    id: "chest-opener",
    logType: "ChestOpener",
    group: "mobility",
    titleKey: "activity.gentleExercises.chestOpener.title",
    title: "Chest opener",
    benefitKey: "activity.gentleExercises.chestOpener.benefit",
    benefit: "Open posture",
    focusKey: "activity.gentleExercises.chestOpener.focus",
    focus: "Mobility",
    whyKey: "activity.gentleExercises.chestOpener.why",
    why: "A gentle chest opening movement can help the upper body feel less closed in.",
    tipKey: "activity.gentleExercises.chestOpener.tip",
    tip: "Keep your shoulders low and stop the arm opening before it feels tight.",
    image: chestOpenerImage,
    duration: 10,
    accent: "#7C3AED",
    softBg: "#F5F3FF",
    border: "#DDD6FE",
    icon: PersonStanding,
    steps: [
      { key: "activity.gentleExercises.chestOpener.steps.1", fallback: "Sit tall with feet flat." },
      { key: "activity.gentleExercises.chestOpener.steps.2", fallback: "Open both arms gently to the sides." },
      { key: "activity.gentleExercises.chestOpener.steps.3", fallback: "Breathe in and keep shoulders relaxed." },
      { key: "activity.gentleExercises.chestOpener.steps.4", fallback: "Bring your hands back slowly." },
    ],
  },
  {
    id: "side-steps",
    logType: "SideSteps",
    group: "balance",
    titleKey: "activity.gentleExercises.sideSteps.title",
    title: "Side steps",
    benefitKey: "activity.gentleExercises.sideSteps.benefit",
    benefit: "Practice balance",
    focusKey: "activity.gentleExercises.sideSteps.focus",
    focus: "Balance",
    whyKey: "activity.gentleExercises.sideSteps.why",
    why: "Small side steps practice balance in a direction used for moving around the home.",
    tipKey: "activity.gentleExercises.sideSteps.tip",
    tip: "Use a counter or chair for light support and keep each step small.",
    image: sideStepsImage,
    duration: 10,
    accent: "#33691E",
    softBg: "#EEF8DF",
    border: "#CFE8B8",
    icon: Footprints,
    steps: [
      { key: "activity.gentleExercises.sideSteps.steps.1", fallback: "Stand beside a stable counter or chair." },
      { key: "activity.gentleExercises.sideSteps.steps.2", fallback: "Step slowly to one side." },
      { key: "activity.gentleExercises.sideSteps.steps.3", fallback: "Bring the other foot to meet it." },
      { key: "activity.gentleExercises.sideSteps.steps.4", fallback: "Step back the other way when ready." },
    ],
  },
  {
    id: "hand-breathing",
    logType: "HandBreathing",
    group: "calm",
    titleKey: "activity.gentleExercises.handBreathing.title",
    title: "Hand breathing",
    benefitKey: "activity.gentleExercises.handBreathing.benefit",
    benefit: "Slow your pace",
    focusKey: "activity.gentleExercises.handBreathing.focus",
    focus: "Calm",
    whyKey: "activity.gentleExercises.handBreathing.why",
    why: "Tracing your fingers gives the breath an easy rhythm to follow.",
    tipKey: "activity.gentleExercises.handBreathing.tip",
    tip: "Trace slowly and skip any finger or movement that feels awkward.",
    image: handBreathingImage,
    duration: 10,
    accent: "#2F66D0",
    softBg: "#EFF6FF",
    border: "#BFDBFE",
    icon: Wind,
    steps: [
      { key: "activity.gentleExercises.handBreathing.steps.1", fallback: "Open one hand in front of you." },
      { key: "activity.gentleExercises.handBreathing.steps.2", fallback: "Trace up a finger as you breathe in." },
      { key: "activity.gentleExercises.handBreathing.steps.3", fallback: "Trace down as you breathe out." },
      { key: "activity.gentleExercises.handBreathing.steps.4", fallback: "Move to the next finger slowly." },
    ],
  },
  {
    id: "shoulder-release",
    logType: "ShoulderRelease",
    group: "calm",
    titleKey: "activity.gentleExercises.shoulderRelease.title",
    title: "Shoulder release",
    benefitKey: "activity.gentleExercises.shoulderRelease.benefit",
    benefit: "Relax shoulders",
    focusKey: "activity.gentleExercises.shoulderRelease.focus",
    focus: "Calm",
    whyKey: "activity.gentleExercises.shoulderRelease.why",
    why: "A slow shoulder release can help the body settle before or after movement.",
    tipKey: "activity.gentleExercises.shoulderRelease.tip",
    tip: "Keep the movement tiny and let your neck stay soft.",
    image: shoulderReleaseImage,
    duration: 10,
    accent: "#9D174D",
    softBg: "#FDF2F8",
    border: "#FBCFE8",
    icon: Wind,
    steps: [
      { key: "activity.gentleExercises.shoulderRelease.steps.1", fallback: "Sit tall and let your arms rest." },
      { key: "activity.gentleExercises.shoulderRelease.steps.2", fallback: "Lift your shoulders a little." },
      { key: "activity.gentleExercises.shoulderRelease.steps.3", fallback: "Roll them back softly." },
      { key: "activity.gentleExercises.shoulderRelease.steps.4", fallback: "Let them drop and breathe out." },
    ],
  },
];

const SENIOR_EXERCISE_GROUPS: Array<{
  key: SeniorExercise["group"];
  titleKey: string;
  title: string;
  subtitleKey: string;
  subtitle: string;
}> = [
  {
    key: "strength",
    titleKey: "activity.gentleExercises.groups.strength.title",
    title: "Strength",
    subtitleKey: "activity.gentleExercises.groups.strength.subtitle",
    subtitle: "Build confidence for standing, reaching, and daily movement.",
  },
  {
    key: "balance",
    titleKey: "activity.gentleExercises.groups.balance.title",
    title: "Balance",
    subtitleKey: "activity.gentleExercises.groups.balance.subtitle",
    subtitle: "Practice steady, supported movement around the home.",
  },
  {
    key: "mobility",
    titleKey: "activity.gentleExercises.groups.mobility.title",
    title: "Mobility",
    subtitleKey: "activity.gentleExercises.groups.mobility.subtitle",
    subtitle: "Loosen stiff areas with small, comfortable motions.",
  },
  {
    key: "calm",
    titleKey: "activity.gentleExercises.groups.calm.title",
    title: "Calm",
    subtitleKey: "activity.gentleExercises.groups.calm.subtitle",
    subtitle: "Settle the breath and finish gently.",
  },
];

const SENIOR_EXERCISE_BY_ID = new Map(SENIOR_EXERCISES.map((exercise) => [exercise.id, exercise]));

const SENIOR_ROUTINES: SeniorRoutine[] = [
  {
    id: "morning-mobility",
    logType: "GentleRoutine",
    titleKey: "activity.gentleRoutines.morningMobility.title",
    title: "Morning mobility",
    subtitleKey: "activity.gentleRoutines.morningMobility.subtitle",
    subtitle: "Loosen shoulders, chest, and ankles before the day gets going.",
    exerciseIds: ["chair-yoga", "chest-opener", "ankle-mobility"],
    duration: 10,
    accent: "#6B21A8",
    softBg: "#F5F3FF",
    border: "#D8B4FE",
  },
  {
    id: "steady-legs",
    logType: "GentleRoutine",
    titleKey: "activity.gentleRoutines.steadyLegs.title",
    title: "Steady legs",
    subtitleKey: "activity.gentleRoutines.steadyLegs.subtitle",
    subtitle: "Practice supported leg strength and balance in small steps.",
    exerciseIds: ["sit-to-stand", "heel-raises", "side-steps"],
    duration: 10,
    accent: "#33691E",
    softBg: "#EEF8DF",
    border: "#CFE8B8",
  },
  {
    id: "calm-reset",
    logType: "GentleRoutine",
    titleKey: "activity.gentleRoutines.calmReset.title",
    title: "Calm reset",
    subtitleKey: "activity.gentleRoutines.calmReset.subtitle",
    subtitle: "Release the shoulders, slow the breath, and finish softly.",
    exerciseIds: ["shoulder-release", "hand-breathing", "calm-breathing"],
    duration: 10,
    accent: "#2F66D0",
    softBg: "#EFF6FF",
    border: "#BFDBFE",
  },
];

const GENTLE_ROUTINE_ACTIVITY: ActivityTypeMeta = {
  key: "GentleRoutine",
  icon: CheckCircle2,
  labelKey: "activity.types.gentleRoutine",
  fallbackLabel: "Gentle routine",
  bg: "#FFF7ED",
  color: "#B45309",
};

const SENIOR_ACTIVITY_TYPES: ActivityTypeMeta[] = SENIOR_EXERCISES.map((exercise) => ({
  key: exercise.logType,
  icon: exercise.icon,
  labelKey: exercise.titleKey,
  fallbackLabel: exercise.title,
  bg: exercise.softBg,
  color: exercise.accent,
}));

const ACTIVITY_ICON_MAP: Record<string, ActivityTypeMeta> = Object.fromEntries(
  [...ACTIVITY_TYPES, GENTLE_ROUTINE_ACTIVITY, ...SENIOR_ACTIVITY_TYPES].map((a) => [a.key, a]),
);

const DURATIONS = [10, 20, 30, 45, 60];
const TARGET_STEPS = 6_000;
const OUTING_ACTIVITY_TYPES = new Set(["Walking", "Cycling", "Exercise"]);

function getSeniorRoutineExercises(routine: SeniorRoutine): SeniorExercise[] {
  return routine.exerciseIds
    .map((id) => SENIOR_EXERCISE_BY_ID.get(id))
    .filter((exercise): exercise is SeniorExercise => Boolean(exercise));
}

function getDailySeniorRoutine(date = new Date()): SeniorRoutine {
  const localDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayNumber = Math.floor(localDayStart / 86_400_000);
  return SENIOR_ROUTINES[dayNumber % SENIOR_ROUTINES.length];
}

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface ActivitySummary {
  entries: ActivityLog[];
  total_active_minutes: number;
  total_calories: number;
  today_steps: number;
}

type HomeScanResult = { riskLevel: string; resultTitle: string; hazards: string[]; advice: string };
type HomeScanRow = {
  id: string;
  risk_level: string;
  result_title: string;
  hazards?: string[];
  advice?: string;
  scanned_at: string;
  image_data?: string;
};

type ActivityLocationState = {
  preselectActivity?: string;
  duration?: number;
  startGentleRoutine?: boolean;
  startGentleExerciseId?: string;
  highlightGentleRoutine?: boolean;
  scrollToGentleExercises?: boolean;
  routineSource?: string;
} | null;

const HOME_RISK_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  "safe":      { bg: "#DCFCE7", text: "#15803D", icon: CheckCircle2 },
  "low risk":  { bg: "#FEF9C3", text: "#A16207", icon: AlertTriangle },
  "high risk": { bg: "#FEE2E2", text: "#B91C1C", icon: ShieldAlert },
};

function homeRiskColors(level: string) {
  return HOME_RISK_COLORS[level.toLowerCase()] ?? HOME_RISK_COLORS["safe"];
}

function homeRiskLabelKey(level: string): string {
  const n = level.toLowerCase();
  if (n === "high risk") return "safeHome.riskLabel.highRisk";
  if (n === "low risk") return "safeHome.riskLabel.lowRisk";
  return "safeHome.riskLabel.safe";
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const ActivityScreen = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingState = location.state as ActivityLocationState;
  const incomingActivity = typeof incomingState?.preselectActivity === "string" && ACTIVITY_ICON_MAP[incomingState.preselectActivity]
    ? incomingState.preselectActivity
    : null;
  const incomingDuration = typeof incomingState?.duration === "number" && DURATIONS.includes(incomingState.duration)
    ? incomingState.duration
    : 20;
  const incomingStartGentleRoutine = incomingState?.startGentleRoutine === true;
  const incomingGentleExerciseId = typeof incomingState?.startGentleExerciseId === "string" && SENIOR_EXERCISE_BY_ID.has(incomingState.startGentleExerciseId)
    ? incomingState.startGentleExerciseId
    : null;
  const [selected, setSelected] = useState<string | null>(() => incomingActivity);
  const [duration, setDuration] = useState<number>(() => incomingDuration);
  const [guidedExerciseId, setGuidedExerciseId] = useState<string | null>(() => incomingGentleExerciseId);
  const [guidedRoutineId, setGuidedRoutineId] = useState<string | null>(() => incomingStartGentleRoutine ? getDailySeniorRoutine().id : null);
  const [routineStepIndex, setRoutineStepIndex] = useState(0);
  const [recentSeniorLog, setRecentSeniorLog] = useState<SeniorExercise | null>(null);
  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsInput, setStepsInput] = useState("");
  const [homeAnalyzing, setHomeAnalyzing] = useState(false);
  const [homeResult, setHomeResult] = useState<HomeScanResult | null>(null);
  const homeScanRef = useRef<HTMLInputElement>(null);
  const logSectionRef = useRef<HTMLDivElement>(null);
  const gentleExercisesSectionRef = useRef<HTMLElement>(null);
  const { data: homeScanHistory } = useQuery<HomeScanRow[]>({ queryKey: ["/api/home-scan"] });
  const { firstName } = useProfile();

  const { data, isLoading } = useQuery<ActivitySummary>({
    queryKey: ["/api/activity"],
  });

  const logMutation = useMutation({
    mutationFn: async (body: { activity_type: string; duration_minutes: number }) => {
      const res = await apiFetch("/api/activity/log", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to log activity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setSelected(null);
    },
  });

  const stepsMutation = useMutation({
    mutationFn: async (steps: number) => {
      const res = await apiFetch("/api/activity/steps", {
        method: "POST",
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) throw new Error("Failed to save steps");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      setEditingSteps(false);
      setStepsInput("");
    },
  });

  const handleHomePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setHomeResult(null);
    setHomeAnalyzing(true);
    const errorFallback: HomeScanResult = {
      riskLevel: "Safe",
      resultTitle: t("safeHome.errorTitle", "Analysis Unavailable"),
      hazards: [],
      advice: t("safeHome.errorAdvice", "We could not analyse the image. Please try again."),
    };
    compressImageFile(file)
      .then(async (dataUrl) => {
        const res = await apiFetch("/api/home-scan", {
          method: "POST",
          body: JSON.stringify({ image: dataUrl, language }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as HomeScanResult & { isFallback?: boolean };
        setHomeResult(data.isFallback ? errorFallback : data);
        if (!data.isFallback) {
          queryClient.invalidateQueries({ queryKey: ["/api/home-scan"] });
        }
      })
      .catch(() => setHomeResult(errorFallback))
      .finally(() => setHomeAnalyzing(false));
  };

  const handleLog = () => {
    if (!selected || logMutation.isPending) return;
    setRecentSeniorLog(null);
    logMutation.mutate({ activity_type: selected, duration_minutes: duration });
  };

  const handleSaveSteps = () => {
    const val = parseInt(stepsInput, 10);
    if (isNaN(val) || val < 0) return;
    stepsMutation.mutate(val);
  };

  const todaySteps = data?.today_steps ?? 0;
  const stepPct = Math.min(100, Math.round((todaySteps / TARGET_STEPS) * 100));
  const activeMins = data?.total_active_minutes ?? 0;
  const calsEstimate = data?.total_calories ?? 0;
  const entries = data?.entries ?? [];

  const headlineText = firstName
    ? t("activity.headlineWithName", { name: firstName })
    : t("activity.headline");

  const todayRoutine = getDailySeniorRoutine();
  const todayRoutineExercises = getSeniorRoutineExercises(todayRoutine);
  const guidedExercise = SENIOR_EXERCISES.find((exercise) => exercise.id === guidedExerciseId) ?? null;
  const guidedRoutine = SENIOR_ROUTINES.find((routine) => routine.id === guidedRoutineId) ?? null;
  const guidedRoutineExercises = guidedRoutine ? getSeniorRoutineExercises(guidedRoutine) : [];
  const currentRoutineExercise = guidedRoutineExercises[routineStepIndex] ?? guidedRoutineExercises[0] ?? null;
  const CurrentRoutineIcon = currentRoutineExercise?.icon ?? PersonStanding;
  const activityLabel = (meta: ActivityTypeMeta) => t(meta.labelKey, meta.fallbackLabel);
  const selectedType = selected ? ACTIVITY_ICON_MAP[selected] : undefined;
  const selectedIsOuting = Boolean(selected && OUTING_ACTIVITY_TYPES.has(selected));

  useEffect(() => {
    if (incomingState?.scrollToGentleExercises !== true) return;
    window.setTimeout(() => {
      gentleExercisesSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 0);
  }, [incomingState?.scrollToGentleExercises]);

  useEffect(() => {
    if (!incomingGentleExerciseId) return;
    setGuidedExerciseId(incomingGentleExerciseId);
  }, [incomingGentleExerciseId]);

  const closeGuidedRoutine = () => {
    setGuidedRoutineId(null);
    setRoutineStepIndex(0);
  };

  const openGuidedRoutine = (routine: SeniorRoutine) => {
    setGuidedRoutineId(routine.id);
    setRoutineStepIndex(0);
  };

  const handleLogSeniorExercise = (exercise: SeniorExercise) => {
    if (logMutation.isPending) return;
    logMutation.mutate(
      { activity_type: exercise.logType, duration_minutes: exercise.duration },
      {
        onSuccess: () => {
          setRecentSeniorLog(exercise);
          setGuidedExerciseId(null);
        },
      },
    );
  };

  const handleFinishSeniorRoutine = (routine: SeniorRoutine) => {
    if (logMutation.isPending) return;
    setRecentSeniorLog(null);
    logMutation.mutate(
      { activity_type: routine.logType, duration_minutes: routine.duration },
      { onSuccess: closeGuidedRoutine },
    );
  };

  const openActivitySupport = (kind: "ride" | "companion") => {
    if (!selectedType) return;
    const selectedLabel = activityLabel(selectedType);
    const message = kind === "ride"
      ? t(
        "activity.ridePrefill",
        "Please help me find safe transport options for a {{duration}} minute {{activity}} activity. Ask me to confirm before contacting anyone.",
        { duration, activity: selectedLabel },
      )
      : t(
        "activity.companionPrefill",
        "Please help me arrange a trusted companion or support person for a {{duration}} minute {{activity}} activity. Ask me to confirm before contacting or booking anyone.",
        { duration, activity: selectedLabel },
      );
    navigate("/concierge", {
      state: {
        conciergePrefill: {
          kind: kind === "ride" ? "ride" : "task",
          message,
          source: "activity_support",
        },
      },
    });
  };

  const renderHomeScanServiceActions = (scan: SafeHomeActionScan, suffix: string) => (
    <div className="mt-[10px] grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid={`activity-safe-home-actions-${suffix}`}>
      <button
        type="button"
        data-testid={`button-activity-safe-home-order-aids-${suffix}`}
        onClick={() => navigate("/concierge/shopping", {
          state: safeHomeShoppingState(scan, language),
        })}
        className="vyva-tap flex min-h-[50px] items-center gap-2 rounded-[14px] border border-[#D8C5F0] bg-white px-3 py-2 text-left"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#F5F3FF] text-[#6B21A8]">
          <ShoppingBasket size={17} />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[13px] font-bold leading-tight text-vyva-text-1">
            {t("safeHome.actions.orderAids", "Order safety aids")}
          </span>
          <span className="sr-only">
            {t("safeHome.actions.orderAidsSub", "Compare simple items before checkout.")}
          </span>
        </span>
      </button>
      <button
        type="button"
        data-testid={`button-activity-safe-home-request-quote-${suffix}`}
        onClick={() => navigate("/concierge", {
          state: safeHomeQuoteState(scan, language),
        })}
        className="vyva-tap flex min-h-[50px] items-center gap-2 rounded-[14px] border border-[#F4D6A8] bg-white px-3 py-2 text-left"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#FFF7ED] text-[#B45309]">
          <Wrench size={17} />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[13px] font-bold leading-tight text-vyva-text-1">
            {t("safeHome.actions.requestQuote", "Request quote")}
          </span>
          <span className="sr-only">
            {t("safeHome.actions.requestQuoteSub", "Prepare home help for your approval.")}
          </span>
        </span>
      </button>
    </div>
  );

  return (
    <div className="px-[22px]">
      <VoiceHero
        heroSurface="activity"
        sourceText={t("activity.voiceSource")}
        headline={<>{headlineText}</>}
        contextHint="daily movement"
      >
        <div
          className="mt-[14px] pt-[14px] flex justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}
        >
          {[
            { val: todaySteps > 0 ? todaySteps.toLocaleString() : "—", label: t("activity.stepsToday") },
            { val: `${activeMins}${t("activity.minAbbr")}`, label: t("activity.activeTime") },
            { val: `${calsEstimate} ${t("activity.calUnit")}`, label: t("activity.calBurned") },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-body text-[17px] font-medium text-white" data-testid={`text-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {s.val}
              </p>
              <p className="font-body text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </VoiceHero>

      {/* Daily step goal */}
      <div
        className="mt-[14px] overflow-hidden rounded-[24px] border"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", background: "#FFFCF8", borderColor: "#EDE2D1" }}
      >
        <div
          className="px-[18px] py-[13px] border-b border-vyva-border flex items-center justify-between"
          style={{ background: "#FFF9F1" }}
        >
          <span className="font-body text-[14px] font-medium text-vyva-text-1">
            {t("activity.dailyStepGoal")}
          </span>
          <button
            data-testid="button-edit-steps"
            onClick={() => {
              setEditingSteps(true);
              setStepsInput(String(todaySteps));
            }}
            className="flex items-center gap-[4px] font-body text-[12px] text-vyva-text-2"
          >
            <Pencil size={12} />
            {t("activity.updateSteps")}
          </button>
        </div>
        <div className="px-[18px] py-[16px]">
          {editingSteps ? (
            <div className="flex items-center gap-[10px] mb-[12px]">
              <input
                data-testid="input-steps"
                type="number"
                min={0}
                max={100000}
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                placeholder={t("activity.enterSteps")}
                className="flex-1 px-[12px] py-[9px] rounded-[10px] border border-vyva-border font-body text-[14px] text-vyva-text-1 outline-none focus:border-[#B45309]"
              />
              <button
                data-testid="button-save-steps"
                onClick={handleSaveSteps}
                disabled={stepsMutation.isPending}
                className="px-[14px] py-[9px] rounded-[10px] font-body text-[13px] font-semibold flex items-center gap-[6px]"
                style={{ background: "#B45309", color: "#fff" }}
              >
                {stepsMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                {t("activity.save")}
              </button>
              <button
                data-testid="button-cancel-steps"
                onClick={() => setEditingSteps(false)}
                className="px-[14px] py-[9px] rounded-[10px] font-body text-[13px]"
                style={{ background: "#F5EFE4", color: "#92745C" }}
              >
                {t("activity.cancel")}
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between mb-[10px]">
            <span className="font-body text-[15px] font-semibold text-vyva-text-1" data-testid="text-steps-today">
              {todaySteps > 0 ? t("activity.stepsCount", { count: todaySteps.toLocaleString() }) : t("activity.noStepsYet")}
            </span>
            <span className="font-body text-[13px] text-vyva-text-2">
              {t("activity.goal", { steps: TARGET_STEPS.toLocaleString() })}
            </span>
          </div>
          <div
            className="w-full h-[10px] rounded-full overflow-hidden"
            style={{ background: "#F5EFE4" }}
            data-testid="progress-steps"
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${stepPct}%`, background: "#B45309" }}
            />
          </div>
          <p className="font-body text-[12px] text-vyva-text-2 mt-[8px]">
            {todaySteps > 0
              ? t("activity.progressPct", { pct: stepPct })
              : t("activity.tapUpdate")}
          </p>
        </div>
      </div>

      <section className="mt-[12px]" data-testid="section-todays-gentle-routine">
        <div
          className="rounded-[20px] border bg-[#FFFCF8] p-3"
          style={{
            borderColor: todayRoutine.border,
            boxShadow: "0 8px 20px rgba(60,38,20,0.07)",
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: todayRoutine.accent }}>
                  {t("activity.gentleRoutines.todayTitle", "Today's gentle routine")}
              </p>
              <h2 className="mt-1 font-display text-[24px] leading-[1.02] text-vyva-text-1 [overflow-wrap:anywhere]">
                {t(todayRoutine.titleKey, todayRoutine.title)}
              </h2>
              <p className="mt-1 line-clamp-2 font-body text-[12px] font-bold leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                {todayRoutineExercises.map((exercise) => t(exercise.titleKey, exercise.title)).join(" • ")}
              </p>
              <div className="mt-3 flex min-w-0 -space-x-2">
                {todayRoutineExercises.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="h-[42px] w-[42px] overflow-hidden rounded-[13px] border-2 border-[#FFFCF8] bg-[#F5EFE4] shadow-sm min-[520px]:h-[46px] min-[520px]:w-[46px]"
                    data-testid={`senior-routine-preview-${exercise.id}`}
                  >
                    <img src={exercise.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex w-[136px] shrink-0 flex-col items-stretch gap-2 min-[420px]:w-[150px]">
              <span
                className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-full px-3 font-body text-[13px] font-extrabold"
                style={{ background: todayRoutine.softBg, color: todayRoutine.accent }}
              >
                <Clock3 size={15} />
                {todayRoutine.duration} {t("activity.min", "min")}
              </span>
              <button
                type="button"
                data-testid="button-start-senior-routine"
                onClick={() => openGuidedRoutine(todayRoutine)}
                className="vyva-tap flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[16px] px-3 py-3 font-body text-[15px] font-extrabold text-white"
                style={{
                  background: todayRoutine.accent,
                  boxShadow: `0 10px 20px ${todayRoutine.accent}2B`,
                }}
              >
                <span className="whitespace-nowrap">{t("activity.gentleRoutines.start", "Start routine")}</span>
                <ChevronRight size={19} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section ref={gentleExercisesSectionRef} className="mt-[18px]" data-testid="section-gentle-exercises">
        <SectionTitle
          title={t("activity.gentleExercises.title", "Gentle exercises")}
          subtitle={t("activity.gentleExercises.subtitle", "Three simple choices for strength, balance, mobility, and calm.")}
        />
        {recentSeniorLog ? (
          <div
            className="mt-3 flex items-center gap-3 rounded-[18px] border px-3 py-3"
            style={{ background: recentSeniorLog.softBg, borderColor: recentSeniorLog.border }}
            data-testid="status-senior-exercise-logged"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white"
              style={{ color: recentSeniorLog.accent }}
            >
              <CheckCircle2 size={22} strokeWidth={2.5} />
            </span>
            <span className="min-w-0 font-body text-[15px] font-extrabold leading-snug text-vyva-text-1 [overflow-wrap:anywhere]">
              {t("activity.gentleExercises.loggedConfirmation", "{{title}} logged for {{duration}} min.", {
                title: t(recentSeniorLog.titleKey, recentSeniorLog.title),
                duration: recentSeniorLog.duration,
              })}
            </span>
          </div>
        ) : null}
        <div className="mt-3 space-y-5">
          {SENIOR_EXERCISE_GROUPS.map((group) => {
            const exercises = SENIOR_EXERCISES.filter((exercise) => exercise.group === group.key);
            return (
              <div key={group.key} data-testid={`senior-exercise-group-${group.key}`}>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">
                      {t(group.titleKey, group.title)}
                    </h3>
                    <p className="mt-0.5 font-body text-[13px] font-semibold leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                      {t(group.subtitleKey, group.subtitle)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#FFF7ED] px-3 py-1.5 font-body text-[12px] font-extrabold text-[#92400E]">
                    {exercises.length} {t("activity.gentleExercises.cards", "cards")}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
                  {exercises.map((exercise) => {
                    const title = t(exercise.titleKey, exercise.title);
                    const benefit = t(exercise.benefitKey, exercise.benefit);
                    const focus = t(exercise.focusKey, exercise.focus);
                    const selectedExercise = selected === exercise.logType || recentSeniorLog?.id === exercise.id;
                    const exerciseLogged = recentSeniorLog?.id === exercise.id;
                    const Icon = exercise.icon;
                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        data-testid={`senior-exercise-card-${exercise.id}`}
                        aria-label={`${title}. ${benefit}. ${focus}. ${exercise.duration} ${t("activity.min", "min")}`}
                        onClick={() => setGuidedExerciseId(exercise.id)}
                        className="vyva-tap group min-w-0 overflow-hidden rounded-[24px] border bg-[#FFFCF8] p-0 text-left transition-all"
                        style={{
                          borderColor: selectedExercise ? exercise.accent : "#EDE2D1",
                          boxShadow: selectedExercise
                            ? `0 16px 34px ${exercise.accent}26, 0 0 0 2px ${exercise.accent} inset`
                            : "0 12px 26px rgba(60,38,20,0.08)",
                        }}
                      >
                        <div className="aspect-[16/9] w-full overflow-hidden bg-[#F5EFE4]">
                          <img
                            src={exercise.image}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        </div>
                        <div className="px-4 pb-4 pt-3">
                          <div className="flex items-start gap-3">
                            <span
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
                              style={{ background: exercise.softBg, color: exercise.accent }}
                            >
                              <Icon size={23} strokeWidth={2.4} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className="mb-1 inline-flex max-w-full rounded-full px-2.5 py-1 font-body text-[12px] font-extrabold leading-tight"
                                style={{ background: exercise.softBg, color: exercise.accent }}
                              >
                                {focus}
                              </span>
                              <span className="block font-display text-[23px] leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">
                                {title}
                              </span>
                              <span className="mt-1 block font-body text-[15px] font-semibold leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                                {benefit}
                              </span>
                            </span>
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 font-body text-[14px] font-extrabold" style={{ color: exercise.accent }}>
                              <Clock3 size={16} />
                              {exercise.duration} {t("activity.min", "min")}
                            </span>
                            <span
                              className="rounded-full px-4 py-2 font-body text-[14px] font-extrabold leading-tight"
                              style={{
                                background: selectedExercise ? exercise.accent : "#FFFFFF",
                                color: selectedExercise ? "#FFFFFF" : exercise.accent,
                                border: `1px solid ${exercise.border}`,
                              }}
                            >
                              {selectedExercise
                                ? exerciseLogged
                                  ? t("activity.gentleExercises.logged", "Logged")
                                  : t("activity.gentleExercises.ready", "Ready")
                                : t("activity.gentleExercises.choose", "Choose")}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Log movement */}
      <div
        ref={logSectionRef}
        className="mt-[14px] overflow-hidden rounded-[24px] border"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", background: "#FFFCF8", borderColor: "#EDE2D1" }}
      >
        <div
          className="px-[18px] py-[13px] border-b border-vyva-border"
          style={{ background: "#F5EFE4" }}
        >
          <span className="font-body text-[14px] font-medium text-vyva-text-1">
            {t("activity.logMovement")}
          </span>
        </div>
        <div className="px-[18px] pt-[16px] pb-[18px]">
          <div className="grid grid-cols-5 gap-[10px] mb-[16px]">
            {ACTIVITY_TYPES.map(({ key, icon: Icon, labelKey, fallbackLabel, bg, color }) => (
              <button
                key={key}
                data-testid={`button-activity-${key.toLowerCase()}`}
                onClick={() => setSelected(selected === key ? null : key)}
                className="flex flex-col items-center gap-[8px] py-[14px] rounded-[16px] transition-all"
                style={
                  selected === key
                    ? { background: bg, border: "2px solid " + color, boxShadow: `0 2px 8px ${color}30` }
                    : { background: "#FAFAFA", border: "1px solid #EDE5DB" }
                }
              >
                <div
                  className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center"
                  style={{ background: selected === key ? bg : "#F5EFE4" }}
                >
                  <Icon size={18} style={{ color: selected === key ? color : "#92745C" }} />
                </div>
                <span
                  className="font-body text-[10px] font-medium text-center leading-tight"
                  style={{ color: selected === key ? color : "#92745C" }}
                >
                  {t(labelKey, fallbackLabel)}
                </span>
              </button>
            ))}
          </div>

          <p className="font-body text-[13px] font-medium text-vyva-text-1 mb-[8px]">{t("activity.duration")}</p>
          <div className="flex gap-[8px] flex-wrap mb-[16px]">
            {DURATIONS.map((d) => (
              <button
                key={d}
                data-testid={`button-duration-${d}`}
                onClick={() => setDuration(d)}
                className="px-[14px] py-[7px] rounded-full font-body text-[13px] font-medium transition-all"
                style={
                  duration === d
                    ? { background: "#B45309", color: "#fff" }
                    : { background: "#F5EFE4", color: "#92745C" }
                }
              >
                {d}{t("activity.min")}
              </button>
            ))}
          </div>

          <button
            data-testid="button-log-activity"
            disabled={!selected || logMutation.isPending}
            onClick={handleLog}
            className="w-full py-[14px] rounded-[16px] font-body text-[15px] font-semibold transition-all flex items-center justify-center gap-[8px]"
            style={
              selected && !logMutation.isPending
                ? { background: "#B45309", color: "#fff", boxShadow: "0 4px 14px rgba(180,83,9,0.25)" }
                : { background: "#F5EFE4", color: "#BFA08A" }
            }
          >
            {logMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {logMutation.isPending
              ? t("activity.saving")
              : selected && selectedType
              ? t("activity.logActivity", "Log {{duration}}m {{type}}", { duration, type: activityLabel(selectedType) })
              : t("activity.selectActivity")}
          </button>

          {selectedType && selectedIsOuting ? (
            <div
              className="mt-[14px] rounded-[18px] border border-[#D8C7FF] bg-[linear-gradient(135deg,#F8F3FF_0%,#FFFFFF_70%,#FFF7ED_100%)] p-3"
              data-testid="activity-support-actions"
            >
              <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                {t("activity.supportTitle", "Need help going out?")}
              </p>
              <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                {t("activity.supportSubtitle", "VYVA can prepare transport or companion support before you confirm.")}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  data-testid="button-activity-book-ride"
                  onClick={() => openActivitySupport("ride")}
                  className="vyva-tap flex min-h-[58px] items-center gap-3 rounded-[16px] border border-[#D8B4FE] bg-white px-3 py-3 text-left shadow-[0_8px_20px_rgba(107,33,168,0.08)]"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-vyva-purple">
                    <Car size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">
                      {t("activity.bookRide", "Find transport")}
                    </span>
                    <span className="sr-only">
                      {t("activity.bookRideSub", "Compare safe ways to get there.")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="button-activity-arrange-companion"
                  onClick={() => openActivitySupport("companion")}
                  className="vyva-tap flex min-h-[58px] items-center gap-3 rounded-[16px] border border-[#BBF7D0] bg-white px-3 py-3 text-left shadow-[0_8px_20px_rgba(20,154,99,0.08)]"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#ECFDF5] text-[#047857]">
                    <Users size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">
                      {t("activity.arrangeCompanion", "Arrange companion")}
                    </span>
                    <span className="sr-only">
                      {t("activity.arrangeCompanionSub", "Ask for someone to come with you.")}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {logMutation.isSuccess && (
            <div
              className="mt-[12px] flex items-center gap-[8px] px-[14px] py-[10px] rounded-[12px]"
              style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}
              data-testid="status-log-success"
            >
              <CheckCircle2 size={16} style={{ color: "#16A34A" }} />
              <span className="font-body text-[13px] font-medium" style={{ color: "#15803D" }}>
                {t("activity.activityLogged")}
              </span>
            </div>
          )}

          {logMutation.isError && (
            <div
              className="mt-[12px] flex items-center gap-[8px] px-[14px] py-[10px] rounded-[12px]"
              style={{ background: "#FFF1F2", border: "1px solid #FECDD3" }}
              data-testid="status-log-error"
            >
              <span className="font-body text-[13px] font-medium" style={{ color: "#BE185D" }}>
                {t("activity.couldNotSave")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Safe Home Check */}
      <div
        className="mt-[14px] overflow-hidden rounded-[24px] border"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", background: "#FFFCF8", borderColor: "#EDE2D1" }}
      >
        <div
          className="px-[18px] py-[13px] border-b border-vyva-border flex items-center justify-between"
          style={{ background: "#F5EFE4" }}
        >
          <div className="flex items-center gap-[10px]">
            <div
              className="w-[32px] h-[32px] rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#ECFDF5" }}
            >
              <Home size={16} style={{ color: "#0A7C4E" }} />
            </div>
            <span className="font-body text-[14px] font-medium text-vyva-text-1">
              {t("safeHome.scanTitle", "Safe Home Check")}
            </span>
          </div>
          <button
            data-testid="button-view-all-home-scans"
            onClick={() => navigate("/safe-home")}
            className="flex items-center gap-[4px] font-body text-[12px]"
            style={{ color: "#6B21A8" }}
          >
            {t("safeHome.history", "Past Scans")}
            <ChevronRight size={12} />
          </button>
        </div>
        <div className="px-[18px] py-[16px]">
          <p className="font-body text-[13px] text-vyva-text-2 mb-[12px]">
            {t("safeHome.scanSubtitle", "Take or upload a photo of any room to check for hazards")}
          </p>

          {homeAnalyzing && (
            <div
              data-testid="section-home-scan-analyzing-activity"
              className="rounded-[12px] p-[14px] flex items-center gap-[10px] mb-[12px]"
              style={{ background: "#F5F3FF" }}
            >
              <Loader2 size={18} className="animate-spin flex-shrink-0" style={{ color: "#6B21A8" }} />
              <p className="font-body text-[13px] font-medium" style={{ color: "#6B21A8" }}>
                {t("safeHome.analyzing", "Analysing for hazards…")}
              </p>
            </div>
          )}

          {homeResult && !homeAnalyzing && (() => {
            const rc = homeRiskColors(homeResult.riskLevel);
            const RiskIcon = rc.icon;
            return (
              <div
                data-testid="section-home-scan-result-activity"
                className="rounded-[12px] p-[14px] mb-[12px]"
                style={{ background: rc.bg }}
              >
                <div className="flex items-center gap-[6px] mb-[6px]">
                  <RiskIcon size={15} style={{ color: rc.text }} />
                  <span
                    data-testid="text-home-scan-risk-activity"
                    className="font-body text-[12px] font-semibold"
                    style={{ color: rc.text }}
                  >
                    {t(homeRiskLabelKey(homeResult.riskLevel), homeResult.riskLevel)}
                  </span>
                </div>
                <p className="font-body text-[14px] font-semibold text-vyva-text-1 mb-[6px]">
                  {homeResult.resultTitle}
                </p>
                {homeResult.hazards.length > 0 && (
                  <ul className="space-y-[4px] mb-[8px]">
                    {homeResult.hazards.slice(0, 3).map((h, i) => (
                      <li key={i} className="flex items-start gap-[6px]">
                        <AlertTriangle size={11} style={{ color: "#C9890A", marginTop: 2, flexShrink: 0 }} />
                        <span className="font-body text-[12px] text-vyva-text-1">{h}</span>
                      </li>
                    ))}
                    {homeResult.hazards.length > 3 && (
                      <li className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>
                        +{homeResult.hazards.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
                <p className="font-body text-[12px] text-vyva-text-1 leading-snug">{homeResult.advice}</p>
                {renderHomeScanServiceActions(homeResult, "current")}
              </div>
            );
          })()}

          <input
            ref={homeScanRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleHomePhotoSelect}
            data-testid="input-home-scan-file-activity"
          />
          <button
            data-testid="button-home-scan-take-photo-activity"
            onClick={() => homeScanRef.current?.click()}
            disabled={homeAnalyzing}
            className="w-full flex items-center justify-center gap-2 rounded-[14px] py-[13px] font-body text-[14px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #0A7C4E 0%, #10B981 100%)",
              color: "#FFFFFF",
              boxShadow: "0 4px 14px rgba(10,124,78,0.25)",
            }}
          >
            <Camera size={16} />
            {homeResult
              ? t("safeHome.scanAgain", "Scan Another Room")
              : t("safeHome.takePhoto", "Take or Upload a Photo")}
          </button>

          {homeScanHistory && homeScanHistory.length > 0 && (
            <div className="mt-[14px]" data-testid="section-home-scan-history-activity">
              <p className="font-body text-[12px] font-medium text-vyva-text-2 mb-[8px]">
                {t("safeHome.history", "Past Scans")}
              </p>
              <div className="space-y-[6px]">
                {homeScanHistory.slice(0, 3).map((scan) => {
                  const rc = homeRiskColors(scan.risk_level);
                  const RiskIcon = rc.icon;
                  return (
                    <div
                      key={scan.id}
                      data-testid={`row-home-scan-${scan.id}`}
                      className="rounded-[10px] px-[12px] py-[9px]"
                      style={{ background: "#F9F7F4" }}
                    >
                      <div className="flex items-center gap-[10px]">
                        {scan.image_data && (
                          <img
                            src={scan.image_data}
                            alt=""
                            className="w-[36px] h-[36px] rounded-[8px] object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-[13px] font-medium text-vyva-text-1 truncate">
                            {scan.result_title}
                          </p>
                          <p className="font-body text-[11px] text-vyva-text-2">
                            {new Date(scan.scanned_at).toLocaleDateString(language, { day: "numeric", month: "short" })}
                          </p>
                        </div>
                        <div
                          className="flex items-center gap-[4px] rounded-[6px] px-[7px] py-[3px] flex-shrink-0"
                          style={{ background: rc.bg }}
                        >
                          <RiskIcon size={10} style={{ color: rc.text }} />
                          <span className="font-body text-[10px] font-semibold" style={{ color: rc.text }}>
                            {t(homeRiskLabelKey(scan.risk_level), scan.risk_level)}
                          </span>
                        </div>
                      </div>
                      {renderHomeScanServiceActions({
                        resultTitle: scan.result_title,
                        riskLevel: scan.risk_level,
                        hazards: scan.hazards ?? [],
                        advice: scan.advice ?? "",
                      }, scan.id)}
                    </div>
                  );
                })}
                {homeScanHistory.length > 3 && (
                  <button
                    data-testid="button-view-more-home-scans-activity"
                    onClick={() => navigate("/safe-home")}
                    className="w-full text-center font-body text-[12px] py-[6px] rounded-[8px] transition-opacity hover:opacity-70"
                    style={{ color: "#6B21A8" }}
                  >
                    +{homeScanHistory.length - 3} {t("common.more", "more")} — {t("safeHome.viewAll", "View all")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's activity summary */}
      <div
        className="mt-[14px] mb-4 overflow-hidden rounded-[24px] border"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", background: "#FFFCF8", borderColor: "#EDE2D1" }}
      >
        <div
          className="px-[18px] py-[13px] border-b border-vyva-border"
          style={{ background: "#F5EFE4" }}
        >
          <span className="font-body text-[14px] font-medium text-vyva-text-1">
            {t("activity.todaysSummary")}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-[32px]">
            <Loader2 size={20} className="animate-spin" style={{ color: "#B45309" }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="px-[18px] py-[24px] text-center">
            <p className="font-body text-[14px] text-vyva-text-2">{t("activity.noMovement")}</p>
            <p className="font-body text-[12px] text-vyva-text-2 mt-[4px]">{t("activity.logToStart")}</p>
          </div>
        ) : (
          entries.map((entry, i) => {
            const meta = ACTIVITY_ICON_MAP[entry.activity_type] ?? ACTIVITY_TYPES[0];
            const Icon = meta.icon;
            return (
              <div
                key={entry.id}
                className="flex items-center gap-[14px] px-[18px] py-[13px] border-b border-vyva-border last:border-b-0"
                data-testid={`row-activity-${i}`}
              >
                <div
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
                  style={{ background: meta.bg }}
                >
                  <Icon size={18} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[15px] font-medium text-vyva-text-1">{activityLabel(meta)}</p>
                  <p className="font-body text-[13px] text-vyva-text-2">
                    {formatTime(entry.logged_at)} · {entry.duration_minutes} {t("activity.min")}
                  </p>
                </div>
                <span
                  className="font-body text-[12px] font-medium px-[10px] py-[4px] rounded-full flex-shrink-0"
                  style={{ background: "#FEF3C7", color: "#92400E" }}
                >
                  {entry.calories} {t("activity.calUnit")}
                </span>
              </div>
            );
          })
        )}
      </div>

      {guidedRoutine && currentRoutineExercise && (
        <BottomSheet
          open
          onOpenChange={(open) => {
            if (!open) closeGuidedRoutine();
          }}
          title={t(guidedRoutine.titleKey, guidedRoutine.title)}
          description={t("activity.gentleRoutines.sheetDescription", "A 10-minute routine with 3 gentle moves.")}
          closeLabel={t("common.close", "Close")}
          footer={(
            <div className="space-y-3">
              <p
                data-testid="senior-routine-safety"
                className="rounded-[14px] border px-3 py-2 font-body text-[13px] font-semibold leading-snug"
                style={{ background: "#FFF7ED", borderColor: "#FED7AA", color: "#7C2D12" }}
              >
                {t("activity.gentleExercises.safety", "Move gently. Stop if you feel pain, dizzy, or short of breath.")}
              </p>
              <div className="grid grid-cols-[0.82fr_1fr] gap-3">
                <button
                  type="button"
                  data-testid="button-back-senior-routine"
                  onClick={() => setRoutineStepIndex((index) => Math.max(0, index - 1))}
                  disabled={routineStepIndex === 0}
                  className="vyva-tap flex min-h-[56px] items-center justify-center rounded-[18px] border px-4 py-3 font-body text-[16px] font-extrabold"
                  style={
                    routineStepIndex === 0
                      ? { background: "#F5EFE4", borderColor: "#EDE2D1", color: "#BFA08A" }
                      : { background: "#FFFFFF", borderColor: guidedRoutine.border, color: guidedRoutine.accent }
                  }
                >
                  {t("common.back", "Back")}
                </button>
                {routineStepIndex < guidedRoutineExercises.length - 1 ? (
                  <button
                    type="button"
                    data-testid="button-next-senior-routine"
                    onClick={() => setRoutineStepIndex((index) => Math.min(guidedRoutineExercises.length - 1, index + 1))}
                    className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] px-4 py-3 font-body text-[16px] font-extrabold text-white"
                    style={{
                      background: guidedRoutine.accent,
                      boxShadow: `0 12px 24px ${guidedRoutine.accent}30`,
                    }}
                  >
                    {t("common.next", "Next")}
                    <ChevronRight size={19} />
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="button-finish-senior-routine"
                    onClick={() => handleFinishSeniorRoutine(guidedRoutine)}
                    disabled={logMutation.isPending}
                    className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] px-4 py-3 font-body text-[16px] font-extrabold text-white"
                    style={{
                      background: guidedRoutine.accent,
                      boxShadow: `0 12px 24px ${guidedRoutine.accent}30`,
                    }}
                  >
                    {logMutation.isPending ? <Loader2 size={19} className="animate-spin" /> : <CheckCircle2 size={20} />}
                    {logMutation.isPending
                      ? t("activity.saving", "Saving...")
                      : t("activity.gentleRoutines.finish", "Finish routine")}
                  </button>
                )}
              </div>
            </div>
          )}
        >
          <div data-testid="senior-routine-stepper" className="rounded-[20px] border bg-white p-3" style={{ borderColor: guidedRoutine.border }}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-body text-[13px] font-black uppercase text-vyva-text-2">
                {t("activity.gentleRoutines.stepCount", "Step {{current}} of {{total}}", {
                  current: routineStepIndex + 1,
                  total: guidedRoutineExercises.length,
                })}
              </p>
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[13px] font-extrabold"
                style={{ background: guidedRoutine.softBg, color: guidedRoutine.accent }}
              >
                <Clock3 size={14} />
                {guidedRoutine.duration} {t("activity.min", "min")}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {guidedRoutineExercises.map((exercise, index) => (
                <span
                  key={exercise.id}
                  className="h-2 rounded-full"
                  style={{
                    background: index <= routineStepIndex ? guidedRoutine.accent : "#EDE2D1",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[22px] border" style={{ borderColor: currentRoutineExercise.border }}>
            <img
              src={currentRoutineExercise.image}
              alt=""
              className="aspect-[2/1] w-full object-cover min-[520px]:aspect-[16/9]"
            />
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-[20px] border bg-white p-3 min-[520px]:p-4" style={{ borderColor: currentRoutineExercise.border }}>
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
              style={{ background: currentRoutineExercise.softBg, color: currentRoutineExercise.accent }}
            >
              <CurrentRoutineIcon size={23} strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-[26px] leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">
                {t(currentRoutineExercise.titleKey, currentRoutineExercise.title)}
              </h3>
              <p className="mt-1 font-body text-[15px] font-semibold leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                {t(currentRoutineExercise.benefitKey, currentRoutineExercise.benefit)}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-[20px] border bg-white p-3 min-[520px]:p-4" style={{ borderColor: "#EDE2D1" }}>
            <p className="font-body text-[13px] font-black uppercase text-vyva-text-2">
              {t("activity.gentleExercises.simpleSteps", "Simple steps")}
            </p>
            <ol className="mt-3 space-y-2">
              {currentRoutineExercise.steps.map((step, index) => (
                <li key={step.key} className="flex items-start gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-body text-[14px] font-extrabold"
                    style={{ background: currentRoutineExercise.softBg, color: currentRoutineExercise.accent }}
                  >
                    {index + 1}
                  </span>
                  <span className="pt-1 font-body text-[15px] font-semibold leading-snug text-vyva-text-1 [overflow-wrap:anywhere]">
                    {t(step.key, step.fallback)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

        </BottomSheet>
      )}

      {guidedExercise && (
        <BottomSheet
          open
          onOpenChange={(open) => {
            if (!open) setGuidedExerciseId(null);
          }}
          title={t(guidedExercise.titleKey, guidedExercise.title)}
          description={t(guidedExercise.benefitKey, guidedExercise.benefit)}
          closeLabel={t("common.close", "Close")}
          footer={(
            <div className="space-y-3">
              <p
                className="rounded-[14px] border px-3 py-2 font-body text-[13px] font-semibold leading-snug"
                style={{ background: "#FFF7ED", borderColor: "#FED7AA", color: "#7C2D12" }}
              >
                {t("activity.gentleExercises.safety", "Move gently. Stop if you feel pain, dizzy, or short of breath.")}
              </p>
              {logMutation.isError ? (
                <p
                  className="rounded-[14px] border px-3 py-2 font-body text-[13px] font-semibold leading-snug"
                  style={{ background: "#FFF1F2", borderColor: "#FECDD3", color: "#BE185D" }}
                  data-testid="senior-exercise-log-error"
                >
                  {t("activity.couldNotSave", "Could not save. Try again.")}
                </p>
              ) : null}
              <button
                type="button"
                data-testid={`button-use-senior-exercise-${guidedExercise.id}`}
                onClick={() => handleLogSeniorExercise(guidedExercise)}
                disabled={logMutation.isPending}
                className="vyva-tap flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] px-5 py-3 font-body text-[17px] font-extrabold text-white disabled:opacity-70"
                style={{
                  background: guidedExercise.accent,
                  boxShadow: `0 12px 24px ${guidedExercise.accent}30`,
                }}
              >
                {logMutation.isPending ? <Loader2 size={21} className="animate-spin" /> : <CheckCircle2 size={21} />}
                {logMutation.isPending
                  ? t("activity.saving", "Saving...")
                  : t("activity.gentleExercises.logExercise", "Log {{duration}}m {{title}}", {
                    duration: guidedExercise.duration,
                    title: t(guidedExercise.titleKey, guidedExercise.title),
                  })}
              </button>
            </div>
          )}
        >
          <div className="overflow-hidden rounded-[22px] border" style={{ borderColor: guidedExercise.border }}>
            <img
              src={guidedExercise.image}
              alt=""
              className="aspect-[2/1] w-full object-cover min-[520px]:aspect-[16/9]"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
            <div className="rounded-[20px] border bg-white p-3 min-[520px]:p-4" style={{ borderColor: guidedExercise.border }}>
              <p className="font-body text-[13px] font-extrabold leading-tight" style={{ color: guidedExercise.accent }}>
                {t("activity.gentleExercises.whyItHelps", "Why it helps")}
              </p>
              <p className="mt-2 font-body text-[15px] font-semibold leading-snug text-vyva-text-1 [overflow-wrap:anywhere]">
                {t(guidedExercise.whyKey, guidedExercise.why)}
              </p>
            </div>
            <div className="rounded-[20px] border bg-white p-3 min-[520px]:p-4" style={{ borderColor: guidedExercise.border }}>
              <p className="font-body text-[13px] font-extrabold leading-tight" style={{ color: guidedExercise.accent }}>
                {t("activity.gentleExercises.vyvaTip", "Vyva tip")}
              </p>
              <p className="mt-2 font-body text-[15px] font-semibold leading-snug text-vyva-text-1 [overflow-wrap:anywhere]">
                {t(guidedExercise.tipKey, guidedExercise.tip)}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-[20px] border bg-white p-3 min-[520px]:p-4" style={{ borderColor: "#EDE2D1" }}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-body text-[13px] font-black uppercase text-vyva-text-2">
                {t("activity.gentleExercises.simpleSteps", "Simple steps")}
              </p>
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[13px] font-extrabold"
                style={{ background: guidedExercise.softBg, color: guidedExercise.accent }}
              >
                <Clock3 size={14} />
                {guidedExercise.duration} {t("activity.min", "min")}
              </span>
            </div>
            <ol className="mt-3 space-y-2">
              {guidedExercise.steps.map((step, index) => (
                <li key={step.key} className="flex items-start gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-body text-[14px] font-extrabold"
                    style={{ background: guidedExercise.softBg, color: guidedExercise.accent }}
                  >
                    {index + 1}
                  </span>
                  <span className="pt-1 font-body text-[15px] font-semibold leading-snug text-vyva-text-1 [overflow-wrap:anywhere]">
                    {t(step.key, step.fallback)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

        </BottomSheet>
      )}
    </div>
  );
};

export default ActivityScreen;
