import { Activity, ArrowLeft, Ban, CheckCircle2, ChevronRight, ClipboardList, Dumbbell, Eye, MessageCircle, Mic, Pill, ShieldCheck, ShoppingBasket, Sparkles, Utensils, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useHomeFastHelpOutcome } from "@/hooks/useHomeFastHelpOutcome";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useServiceGate } from "@/hooks/useServiceGate";
import { HomeMasterActionControl, HomeMasterTopbar } from "@/components/HomeMasterTopControls";
import { LongevityStatusCard, type LongevityActionCard, type LongevityScreenState } from "@/components/health/LongevityStatusCard";
import { SmartNudge, type SmartNudgeData } from "@/components/health/SmartNudge";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalProfile } from "@/contexts/ProfileContext";
import { apiFetch } from "@/lib/queryClient";
import {
  appendPreventionLoopHistory as appendLoopHistory,
  dismissPreventionFollowUp,
  learningContextForPreventionRequest as learningContextForRequest,
  PREVENTION_LOOP_LAST_FEEDBACK_KEY as loopLastFeedbackKey,
  PREVENTION_LOOP_LAST_VIEW_KEY as loopLastViewKey,
  preventionBarrierStorageKey,
  preventionDateKey,
  preventionFeedbackStorageKey,
  readStoredJson,
  writeStoredJson,
} from "@/lib/longevityLoop";
import type {
  PreventionLoopBarrier as PreventionBarrier,
  PreventionLoopHistoryEvent as PreventionHistoryEvent,
  PreventionLoopLastFeedback as PreventionLoopLastFeedback,
  PreventionLoopLastView as PreventionLoopLastView,
} from "@/lib/longevityLoop";

type PreventionFocus = "Heart" | "Falls" | "Diabetes" | "Medicine" | "Follow-up" | "Plan";

type LongevityTodayAction = {
  id: string;
  category: string;
  label: string;
  description: string;
  destination_type: string;
  destination_path: string | null;
  condition_tags: string[];
  tier_min: number;
};

type LongevityTodayResponse = {
  tier: number;
  focus_label: string;
  hero_copy: string;
  insight_text: string;
  actions: LongevityTodayAction[];
  data_completeness: Record<string, unknown>;
  report_generated_at: string | null;
};

type PreventionFocusResponse = {
  focus: PreventionFocus;
  headline: string;
  why: string[];
  todayAction: string;
  helpSigns: string[];
  primaryRoute: string;
  secondaryRoute?: string;
  confidence: "strong" | "moderate" | "limited";
  insights?: PreventionInsight[];
  actions?: PreventionAction[];
  guidance?: PreventionGuidanceItem[];
  dailyActions?: PreventionDailyAction[];
  learning?: PreventionLearning;
  weeklySummary?: PreventionWeeklySummary;
  ranking?: PreventionRankingMeta;
  personalizationSummary?: string[];
  profileSignals?: string[];
  doctorNote?: string;
  followUp?: {
    reportId?: string | null;
    reportedAt?: string | null;
    subject: string;
    topic: string;
  };
  generatedAt: string;
};

type PreventionInsight = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "alert" | "caution" | "steady";
  route?: string;
};

type PreventionAction = {
  id: string;
  label: string;
  detail: string;
  route: string;
  priority: "primary" | "secondary";
  mode?: "navigate" | "voice";
};

type PreventionShoppingPrefill = {
  needText: string;
  category: string;
  priorities: string[];
  constraints?: string[];
  packageId?: string;
  sourceRecommendation?: string;
};

type PreventionGuidanceAction = {
  id: string;
  label: string;
  detail: string;
  route: string;
  priority: "primary" | "secondary";
  mode?: "navigate" | "voice";
  shoppingPrefill?: PreventionShoppingPrefill;
};

type PreventionRecipeSuggestion = {
  id: string;
  title: string;
  prepTimeLabel: string;
  whyItFits: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  shoppingPrefill: PreventionShoppingPrefill;
};

type PreventionActionSheet = {
  title: string;
  summary: string;
  primaryAction: PreventionGuidanceAction;
  secondaryActions: PreventionGuidanceAction[];
  recipes?: PreventionRecipeSuggestion[];
  safetyNote?: string;
};

type PreventionGuidanceItem = {
  id: "eat" | "move" | "do" | "avoid";
  label: string;
  headline: string;
  detail: string;
  chips: string[];
  tone: "food" | "movement" | "action" | "avoid";
  actionSheet?: PreventionActionSheet;
};

type PreventionDailyAction = {
  id: string;
  step: "Eat" | "Move" | "Calm" | "Check" | "Protect" | "Home" | "Medicine" | "Review" | "Plan" | "Sleep" | "NEXT STEP" | "WATCH FOR" | "RIGHT NOW" | "IF NEEDED";
  title: string;
  detail: string;
  chips?: string[];
  why: string;
  evidenceLabel: string;
  tone: "food" | "movement" | "check" | "support" | "medicine";
  actionSheet: PreventionActionSheet;
  feedbackOptions: Array<{
    id: "done" | "too_hard" | "remind" | "ask_vyva";
    label: string;
  }>;
};

type PreventionFeedback = PreventionDailyAction["feedbackOptions"][number]["id"];

type StoredPreventionFeedback = Record<string, PreventionFeedback>;

type PreventionLearning = {
  title: string;
  detail: string;
  askPrompt: string;
};

type PreventionWeeklySummary = {
  headline: string;
  detail: string;
  bullets: string[];
  doctorSummary: string;
  caregiverSummary: string;
};

type PreventionRankingMeta = {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  rankingReasons: string[];
};

const fallbackFocus: PreventionFocusResponse = {
  focus: "Plan",
  headline: "Longevity ready.",
  why: ["No strong pattern stands out right now."],
  todayAction: "Do one quick check-in.",
  helpSigns: ["Sudden chest pain", "Trouble breathing", "New confusion"],
  primaryRoute: "/health/check-in",
  secondaryRoute: "/health/doctor",
  confidence: "limited",
  insights: [
    {
      id: "plan-status",
      label: "Today",
      value: "No strong alert",
      detail: "No strong pattern stands out from available data.",
      tone: "steady",
    },
    {
      id: "plan-profile",
      label: "Profile",
      value: "Health profile",
      detail: "Using the profile details available today.",
      tone: "steady",
    },
  ],
  guidance: [
    {
      id: "eat",
      label: "Eat",
      headline: "Choose a steady meal",
      detail: "Veg or fruit, protein, and water. Keep snacks simple.",
      chips: ["Fruit/veg", "Protein", "Water"],
      tone: "food",
    },
    {
      id: "move",
      label: "Move",
      headline: "Ten gentle minutes",
      detail: "Short walk, seated march, or stretch. Keep an easy talk pace.",
      chips: ["10 minutes", "Gentle", "Talk pace"],
      tone: "movement",
    },
    {
      id: "do",
      label: "Do",
      headline: "One prevention check",
      detail: "Meds on schedule. Update symptoms if anything changed.",
      chips: ["Medicines", "Symptoms", "Ask VYVA"],
      tone: "action",
    },
    {
      id: "avoid",
      label: "Avoid",
      headline: "Do not ignore changes",
      detail: "Do not push through chest pain, breathlessness, fainting, or confusion.",
      chips: ["Do not push", "Watch changes", "Get help"],
      tone: "avoid",
    },
  ],
  dailyActions: [
    {
      id: "plan-steady-meal",
      step: "Eat",
      title: "Steady meal",
      detail: "Open simple meal or grocery help.",
      why: "Food, water, and routine are useful even without a strong signal.",
      evidenceLabel: "Daily basics",
      tone: "food",
      actionSheet: {
        title: "Steady meal",
        summary: "Choose a simple meal with fruit or vegetables, protein, and water.",
        primaryAction: {
          id: "show-groceries",
          label: "Show groceries",
          detail: "Open a fitted shopping list",
          route: "/concierge/shopping",
          priority: "primary",
          shoppingPrefill: {
            needText: "Help me choose simple groceries or prepared meals that fit my diet. Do not order without my confirmation.",
            category: "groceries",
            priorities: ["diet", "simplicity", "delivery"],
            constraints: ["check ingredients for allergies", "confirm before ordering"],
            packageId: "easy_meals",
          },
        },
        secondaryActions: [
          {
            id: "ask-food",
            label: "Ask VYVA",
            detail: "Get food ideas for me",
            route: "/health/doctor",
            priority: "secondary",
            mode: "voice",
          },
        ],
        safetyNote: "Check ingredients fit your diet and allergies.",
      },
      feedbackOptions: [
        { id: "done", label: "Done" },
        { id: "too_hard", label: "Too hard" },
        { id: "remind", label: "Remind me" },
        { id: "ask_vyva", label: "Ask VYVA" },
      ],
    },
    {
      id: "plan-gentle-move",
      step: "Move",
      title: "Gentle movement",
      detail: "Try chair yoga or breathing.",
      why: "Small movement keeps prevention active without overdoing it.",
      evidenceLabel: "Gentle activity",
      tone: "movement",
      actionSheet: {
        title: "Gentle movement",
        summary: "Pick a short routine that feels comfortable today.",
        primaryAction: {
          id: "start-breathing",
          label: "Start breathing",
          detail: "Open a calm routine",
          route: "/activities/relax-breathe",
          priority: "primary",
        },
        secondaryActions: [
          {
            id: "chair-yoga",
            label: "Chair yoga",
            detail: "Open gentle movement",
            route: "/social-rooms/morning-movement/exercises/chair-yoga",
            priority: "secondary",
          },
        ],
        safetyNote: "Stop and ask for help if you feel chest pain, faint, or very breathless.",
      },
      feedbackOptions: [
        { id: "done", label: "Done" },
        { id: "too_hard", label: "Too hard" },
        { id: "remind", label: "Remind me" },
        { id: "ask_vyva", label: "Ask VYVA" },
      ],
    },
    {
      id: "plan-check-in",
      step: "Check",
      title: "Quick check-in",
      detail: "Update what changed today.",
      why: "A short check-in gives VYVA better context tomorrow.",
      evidenceLabel: "Daily pattern",
      tone: "check",
      actionSheet: {
        title: "Quick check-in",
        summary: "Update how you feel so VYVA can adjust tomorrow's plan.",
        primaryAction: {
          id: "open-check-in",
          label: "Start check-in",
          detail: "Update what changed",
          route: "/health/check-in",
          priority: "primary",
        },
        secondaryActions: [
          {
            id: "ask-plan",
            label: "Ask VYVA",
            detail: "Build a prevention plan for today",
            route: "/health/doctor",
            priority: "secondary",
            mode: "voice",
          },
        ],
      },
      feedbackOptions: [
        { id: "done", label: "Done" },
        { id: "too_hard", label: "Too hard" },
        { id: "remind", label: "Remind me" },
        { id: "ask_vyva", label: "Ask VYVA" },
      ],
    },
  ],
  learning: {
    title: "New options to ask about",
    detail: "Vaccines, screenings, strength routines, and food changes for you.",
    askPrompt: "Build me a prevention plan for today.",
  },
  personalizationSummary: ["Health profile"],
  actions: [
    {
      id: "plan-day",
      label: "Build my day",
      detail: "Food, movement, and reminders",
      route: "/health/doctor",
      priority: "primary",
      mode: "voice",
    },
    {
      id: "plan-move",
      label: "Movement idea",
      detail: "Gentle routine for today",
      route: "/health/doctor",
      priority: "secondary",
      mode: "voice",
    },
  ],
  profileSignals: ["Plan"],
  weeklySummary: {
    headline: "VYVA is learning your routine.",
    detail: "Mark what works or feels hard so tomorrow can be more personal.",
    bullets: ["Today starts simple"],
    doctorSummary: "No weekly prevention feedback yet.",
    caregiverSummary: "No weekly prevention feedback yet.",
  },
  ranking: {
    timeOfDay: "morning",
    rankingReasons: ["Simple starter plan"],
  },
  doctorNote: "No strong pattern stands out from the available data today.",
  generatedAt: new Date(0).toISOString(),
};

const guidanceIcons: Record<PreventionGuidanceItem["id"], LucideIcon> = {
  eat: Utensils,
  move: Activity,
  do: CheckCircle2,
  avoid: Ban,
};

function guidanceToneStyle(tone: PreventionGuidanceItem["tone"]) {
  if (tone === "food") {
    return {
      border: "#FAD7AA",
      bg: "#FFFCF7",
      iconBg: "#FFF2DC",
      label: "#B45309",
      chipBg: "#FFF7ED",
      chipText: "#9A3412",
    };
  }
  if (tone === "movement") {
    return {
      border: "#BDEAD7",
      bg: "#F8FFFC",
      iconBg: "#E9FBF3",
      label: "#047857",
      chipBg: "#ECFDF5",
      chipText: "#047857",
    };
  }
  if (tone === "avoid") {
    return {
      border: "#FECACA",
      bg: "#FFF7F7",
      iconBg: "#FFF1F2",
      label: "#B91C1C",
      chipBg: "#FFFFFF",
      chipText: "#991B1B",
    };
  }
  return {
    border: "#DDD6FE",
    bg: "#FFFFFF",
    iconBg: "#F5F3FF",
    label: "#6B21A8",
    chipBg: "#F5F3FF",
    chipText: "#6B21A8",
  };
}

const defaultDailyFeedbackOptions: PreventionDailyAction["feedbackOptions"] = [
  { id: "done", label: "Done" },
  { id: "too_hard", label: "Too hard" },
  { id: "remind", label: "Remind me" },
  { id: "ask_vyva", label: "Ask VYVA" },
];

function focusFromEngine(label: string): PreventionFocus {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("heart") || normalized.includes("vital") || normalized.includes("blood pressure")) return "Heart";
  if (normalized.includes("diabet") || normalized.includes("glucose")) return "Diabetes";
  if (normalized.includes("fall") || normalized.includes("mobility") || normalized.includes("balance")) return "Falls";
  if (normalized.includes("med")) return "Medicine";
  if (normalized.includes("symptom") || normalized.includes("follow")) return "Follow-up";
  return "Plan";
}

function actionTone(category: string): PreventionDailyAction["tone"] {
  const normalized = category.toLowerCase();
  if (normalized === "eat") return "food";
  if (normalized === "move" || normalized === "calm") return "movement";
  if (normalized === "medicine") return "medicine";
  if (normalized === "home" || normalized === "protect" || normalized === "follow-up") return "support";
  return "check";
}

function actionStep(category: string): PreventionDailyAction["step"] {
  const normalized = category.toLowerCase();
  if (normalized === "eat") return "Eat";
  if (normalized === "move") return "Move";
  if (normalized === "calm") return "Calm";
  if (normalized === "medicine") return "Medicine";
  if (normalized === "home") return "Home";
  if (normalized === "sleep") return "Sleep";
  if (normalized === "avoid" || normalized === "protect") return "Protect";
  if (normalized === "follow-up") return "Review";
  return "Check";
}

function actionMode(action: LongevityTodayAction): PreventionAction["mode"] {
  return action.destination_type === "voice" ? "voice" : "navigate";
}

function routeForEngineAction(action: LongevityTodayAction): string {
  return action.destination_path?.trim() || "/health/doctor";
}

function dailyActionFromEngine(action: LongevityTodayAction, insightText: string): PreventionDailyAction {
  const route = routeForEngineAction(action);
  const mode = actionMode(action);
  return {
    id: action.id,
    step: actionStep(action.category),
    title: action.label,
    detail: action.description,
    why: insightText,
    evidenceLabel: "VYVA Health Insights",
    tone: actionTone(action.category),
    actionSheet: {
      title: action.label,
      summary: action.description,
      primaryAction: {
        id: `${action.id}-open`,
        label: action.label,
        detail: action.description,
        route,
        priority: "primary",
        mode,
      },
      secondaryActions: [],
    },
    feedbackOptions: defaultDailyFeedbackOptions,
  };
}

function isLongevityTodayResponse(value: unknown): value is LongevityTodayResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LongevityTodayResponse>;
  return typeof candidate.tier === "number"
    && typeof candidate.focus_label === "string"
    && typeof candidate.hero_copy === "string"
    && typeof candidate.insight_text === "string"
    && Array.isArray(candidate.actions)
    && Boolean(candidate.data_completeness && typeof candidate.data_completeness === "object");
}

function mapEngineResponse(data: LongevityTodayResponse): PreventionFocusResponse {
  const mappedFocus = focusFromEngine(data.focus_label);
  const mappedActions: PreventionAction[] = data.actions.map((action, index) => ({
    id: action.id,
    label: action.label,
    detail: action.description,
    route: routeForEngineAction(action),
    priority: index === 0 ? "primary" : "secondary",
    mode: actionMode(action),
  }));
  const mappedDailyActions = data.actions.map((action) => dailyActionFromEngine(action, data.insight_text));
  const completenessEntries = Object.entries(data.data_completeness);
  const availableSignals = completenessEntries.filter(([, available]) => Boolean(available)).map(([signal]) => signal);
  const completenessRatio = completenessEntries.length ? availableSignals.length / completenessEntries.length : 0;

  return {
    ...fallbackFocus,
    focus: mappedFocus,
    headline: data.hero_copy.trim() || fallbackFocus.headline,
    why: data.insight_text.trim() ? [data.insight_text.trim()] : fallbackFocus.why,
    todayAction: mappedActions[0]?.detail || data.insight_text || fallbackFocus.todayAction,
    primaryRoute: mappedActions[0]?.route || fallbackFocus.primaryRoute,
    secondaryRoute: mappedActions[1]?.route || fallbackFocus.secondaryRoute,
    confidence: completenessRatio >= 0.67 ? "strong" : completenessRatio >= 0.34 ? "moderate" : "limited",
    actions: mappedActions.length ? mappedActions : fallbackFocus.actions,
    dailyActions: mappedDailyActions.length ? mappedDailyActions : fallbackFocus.dailyActions,
    personalizationSummary: availableSignals.length ? availableSignals : fallbackFocus.personalizationSummary,
    profileSignals: availableSignals.length ? availableSignals : fallbackFocus.profileSignals,
    doctorNote: data.insight_text || fallbackFocus.doctorNote,
    generatedAt: data.report_generated_at || new Date().toISOString(),
  };
}

function screenStateFor(data: LongevityTodayResponse | undefined, focus: PreventionFocusResponse): LongevityScreenState {
  if (!data) return "insufficient";
  if (!Object.values(data.data_completeness).some(Boolean)) return "insufficient";
  if (focus.focus === "Medicine") return "medication";
  if (focus.focus === "Follow-up") return "follow_up";
  if (focus.focus !== "Plan" || data.tier >= 2) return "condition";
  return data.report_generated_at ? "progress" : "general";
}

const dailyActionIcons: Record<PreventionDailyAction["tone"], LucideIcon> = {
  food: Utensils,
  movement: Dumbbell,
  check: CheckCircle2,
  support: ShieldCheck,
  medicine: Pill,
};

function dailyActionToneStyle(tone: PreventionDailyAction["tone"]) {
  if (tone === "food") {
    return {
      border: "#FAD7AA",
      bg: "#FFFCF7",
      iconBg: "#FFF2DC",
      iconColor: "#B45309",
      chipBg: "#FFF7ED",
      chipText: "#9A3412",
    };
  }
  if (tone === "movement") {
    return {
      border: "#BDEAD7",
      bg: "#F8FFFC",
      iconBg: "#E9FBF3",
      iconColor: "#047857",
      chipBg: "#ECFDF5",
      chipText: "#047857",
    };
  }
  if (tone === "medicine") {
    return {
      border: "#E9D5FF",
      bg: "#FFFBFF",
      iconBg: "#FDF4FF",
      iconColor: "#86198F",
      chipBg: "#F5F3FF",
      chipText: "#6B21A8",
    };
  }
  if (tone === "support") {
    return {
      border: "#FED7AA",
      bg: "#FFFCF7",
      iconBg: "#FFFBEB",
      iconColor: "#B45309",
      chipBg: "#FFF7ED",
      chipText: "#9A3412",
    };
  }
  return {
    border: "#DDD6FE",
    bg: "#FFFFFF",
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    chipBg: "#F5F3FF",
    chipText: "#6B21A8",
  };
}

function followUpTagStyle(step: PreventionDailyAction["step"]) {
  if (step === "WATCH FOR") {
    return {
      background: "#FEF2F2",
      color: "#E74C43",
    };
  }
  if (step === "NEXT STEP" || step === "RIGHT NOW") {
    return {
      background: "#FFFBEB",
      color: "#F59E0B",
    };
  }
  if (step === "IF NEEDED") {
    return {
      background: "#ECFDF5",
      color: "#0F766E",
    };
  }
  return {
    background: "#F5F3FF",
    color: "#6B21A8",
  };
}

function dailyActionIconFor(item: PreventionDailyAction, isFollowUp: boolean): LucideIcon {
  if (isFollowUp) {
    if (item.id === "follow-up-context") return Sparkles;
    if (item.id === "follow-up-watch-signs") return Eye;
    if (item.id === "follow-up-summary") return ClipboardList;
  }
  return dailyActionIcons[item.tone] ?? ShieldCheck;
}

function isReadingChip(chip: string): boolean {
  return /^(BP|Pulse|HR|SpO2|SpO₂|Oxygen|Temp|Glucose|Respiration)\b/i.test(chip);
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function followUpHeadlineFor(focus: PreventionFocusResponse, subject: string): string {
  const topic = focus.followUp?.topic?.trim();
  if (topic) return `${sentenceCase(topic.toLowerCase())} follow-up`;

  const patternChips = focus.dailyActions?.find((item) => item.id === "follow-up-context")?.chips ?? [];
  const cleanChips = patternChips.map((chip) => chip.trim()).filter(Boolean);
  if (cleanChips.length) {
    const trackedSubject = cleanChips[0].toLowerCase();
    return `${sentenceCase(trackedSubject)} follow-up`;
  }

  const shortSubject = subject.trim();
  if (shortSubject && shortSubject !== "your latest symptoms") {
    return `${sentenceCase(shortSubject.toLowerCase())} follow-up`;
  }
  return "Symptom follow-up";
}

function followUpDetailFor(item: PreventionDailyAction): string {
  const chips = item.chips?.map((chip) => chip.trim()).filter(Boolean) ?? [];
  if (item.id === "follow-up-context") {
    const readingChip = chips.find(isReadingChip);
    return readingChip ? `Symptoms + medicine + ${readingChip}` : "Symptoms + medicine";
  }
  if (item.id === "follow-up-watch-signs") {
    return chips.length ? chips.slice(0, 3).join(", ") : item.detail;
  }
  if (item.id === "follow-up-summary") {
    return "Timing + readings + medicine";
  }
  return item.detail;
}

function fallbackShoppingPrefill(item: PreventionGuidanceItem): PreventionShoppingPrefill {
  return {
    needText: `${item.headline}. Help me choose simple groceries or prepared meals that fit my diet. Do not order without my confirmation.`,
    category: "groceries",
    priorities: ["diet", "simplicity", "delivery"],
    constraints: ["check ingredients for allergies", "confirm before ordering"],
    packageId: "easy_meals",
    sourceRecommendation: "VYVA suggested this from today's prevention guidance.",
  };
}

function fallbackActionSheet(item: PreventionGuidanceItem, focus: PreventionFocus): PreventionActionSheet {
  if (item.id === "eat") {
    const prefill = fallbackShoppingPrefill(item);
    return {
      title: item.headline,
      summary: item.detail,
      primaryAction: {
        id: "show-groceries",
        label: "Show groceries",
        detail: "Open a fitted shopping list",
        route: "/concierge/shopping",
        priority: "primary",
        shoppingPrefill: prefill,
      },
      secondaryActions: [
        {
          id: "prepared-meals",
          label: "Prepared meals",
          detail: "Find simple delivery options",
          route: "/concierge/shopping",
          priority: "secondary",
          shoppingPrefill: {
            ...prefill,
            needText: `${item.headline}. Help me find simple prepared meals or delivery options. Do not order without my confirmation.`,
          },
        },
        {
          id: "ask-food",
          label: "Ask VYVA",
          detail: `More ${focus.toLowerCase()} food ideas`,
          route: "/health/doctor",
          priority: "secondary",
          mode: "voice",
        },
      ],
      recipes: [
        {
          id: "simple-soup",
          title: "Simple soup and fruit",
          prepTimeLabel: "10 min",
          whyItFits: "A warm, low-effort meal for a steady day.",
          ingredients: ["lower-salt soup", "soft fruit", "plain yogurt"],
          steps: ["Warm the soup.", "Add fruit or yogurt.", "Keep water nearby."],
          tags: ["Simple", "Low effort", "Check ingredients"],
          shoppingPrefill: prefill,
        },
      ],
      safetyNote: "Check ingredients fit your diet and allergies.",
    };
  }

  if (item.id === "move") {
    return {
      title: item.headline,
      summary: item.detail,
      primaryAction: {
        id: "start-breathing",
        label: "Start breathing",
        detail: "Open a calm routine",
        route: "/activities/relax-breathe",
        priority: "primary",
      },
      secondaryActions: [
        {
          id: "gentle-exercise",
          label: "Gentle exercise",
          detail: "Open chair yoga",
          route: "/social-rooms/morning-movement/exercises/chair-yoga",
          priority: "secondary",
        },
        {
          id: "ask-move",
          label: "Ask VYVA",
          detail: "Adapt movement for me",
          route: "/health/doctor",
          priority: "secondary",
          mode: "voice",
        },
      ],
      safetyNote: "Stop and ask for help if you feel chest pain, faint, or very breathless.",
    };
  }

  if (item.id === "do") {
    return {
      title: item.headline,
      summary: item.detail,
      primaryAction: {
        id: "daily-check",
        label: "Start check-in",
        detail: "Update how you feel",
        route: "/health/check-in",
        priority: "primary",
      },
      secondaryActions: [
        {
          id: "plan-day",
          label: "Plan my day",
          detail: "Ask VYVA for one simple plan",
          route: "/health/doctor",
          priority: "secondary",
          mode: "voice",
        },
      ],
    };
  }

  return {
    title: item.headline,
    summary: item.detail,
    primaryAction: {
      id: "ask-avoid",
      label: "Ask VYVA",
      detail: "What should I avoid today?",
      route: "/health/doctor",
      priority: "primary",
      mode: "voice",
    },
    secondaryActions: [
      {
        id: "breathing-reset",
        label: "Breathing reset",
        detail: "Calm the pace",
        route: "/activities/relax-breathe",
        priority: "secondary",
      },
    ],
    safetyNote: "Call emergency help for severe chest pain, trouble breathing, fainting, or sudden weakness.",
  };
}

function guidanceToDailyAction(item: PreventionGuidanceItem, focus: PreventionFocus): PreventionDailyAction {
  const step: PreventionDailyAction["step"] = item.id === "eat"
    ? "Eat"
    : item.id === "move"
      ? "Move"
      : item.id === "avoid"
        ? "Protect"
        : "Check";
  const tone: PreventionDailyAction["tone"] = item.tone === "food"
    ? "food"
    : item.tone === "movement"
      ? "movement"
      : item.tone === "avoid"
        ? "support"
        : "check";

  return {
    id: `fallback-${item.id}`,
    step,
    title: item.headline,
    detail: item.detail,
    why: item.chips.length ? `${item.chips[0]} is useful for today's ${focus.toLowerCase()} focus.` : `Chosen from today's ${focus.toLowerCase()} focus.`,
    evidenceLabel: item.chips[0] ?? focus,
    tone,
    actionSheet: item.actionSheet ?? fallbackActionSheet(item, focus),
    feedbackOptions: defaultDailyFeedbackOptions,
  };
}

const feedbackDisplay: Record<Exclude<PreventionFeedback, "ask_vyva">, string> = {
  done: "Done",
  too_hard: "Too hard",
  remind: "Reminder",
};

const barrierOptions: Array<{ id: PreventionBarrier; label: string }> = [
  { id: "physical", label: "Body" },
  { id: "cooking", label: "Cooking" },
  { id: "no_ingredients", label: "No food" },
  { id: "confusing", label: "Confusing" },
  { id: "not_interested", label: "Not today" },
  { id: "needs_help", label: "Need help" },
];

function easierPrimaryAction(action: PreventionDailyAction): PreventionGuidanceAction {
  if (action.tone === "food") {
    return {
      id: "easier-food-help",
      label: "Show easy options",
      detail: "Prepared meals or simple groceries",
      route: "/concierge/shopping",
      priority: "primary",
      shoppingPrefill: action.actionSheet.primaryAction.shoppingPrefill ?? {
        needText: `Find the easiest version of this prevention meal: ${action.title}. Keep it simple and do not order without my confirmation.`,
        category: "groceries",
        priorities: ["simplicity", "delivery", "diet"],
        constraints: ["easy preparation", "check ingredients for allergies", "confirm before ordering"],
        packageId: "easy_meals",
      },
    };
  }

  if (action.tone === "movement" || action.tone === "support") {
    return {
      id: "easier-breathing",
      label: "Start easy",
      detail: "Breathing or seated reset",
      route: "/activities/relax-breathe",
      priority: "primary",
    };
  }

  if (action.tone === "medicine") {
    return {
      id: "easier-medicine",
      label: "Ask VYVA",
      detail: "One safe medicine step",
      route: "/health/doctor",
      priority: "primary",
      mode: "voice",
    };
  }

  return {
    id: "easier-check",
    label: "Ask VYVA",
    detail: "Break this into one step",
    route: "/health/doctor",
    priority: "primary",
    mode: "voice",
  };
}

function makeEasierAction(action: PreventionDailyAction, reason: string): PreventionDailyAction {
  const primaryAction = easierPrimaryAction(action);
  return {
    ...action,
    id: action.id,
    title: "Easier version",
    detail: action.tone === "food"
      ? "Use prepared help or one simple swap."
      : action.tone === "movement" || action.tone === "support"
        ? "Start with breathing or seated movement."
        : "Ask VYVA for one small safe step.",
    why: reason,
    evidenceLabel: "Easier",
    actionSheet: {
      title: "Easier version",
      summary: `${reason} Start smaller and keep the original plan available.`,
      primaryAction,
      secondaryActions: [
        {
          id: "original-action",
          label: action.actionSheet.primaryAction.label,
          detail: action.actionSheet.primaryAction.detail,
          route: action.actionSheet.primaryAction.route,
          priority: "secondary",
          mode: action.actionSheet.primaryAction.mode,
          shoppingPrefill: action.actionSheet.primaryAction.shoppingPrefill,
        },
        {
          id: "ask-easier",
          label: "Ask VYVA",
          detail: `Make ${action.title} easier for me`,
          route: "/health/doctor",
          priority: "secondary",
          mode: "voice",
        },
      ],
      recipes: action.tone === "food" ? action.actionSheet.recipes?.slice(0, 1) : undefined,
      safetyNote: action.actionSheet.safetyNote,
    },
  };
}

function actionMatchesLastFeedback(action: PreventionDailyAction, last: PreventionLoopLastFeedback): boolean {
  return action.id === last.actionId || action.step === last.step || action.tone === last.tone;
}

function adaptDailyActionsForLoop(
  actions: PreventionDailyAction[],
  feedback: StoredPreventionFeedback,
  lastFeedback: PreventionLoopLastFeedback | null,
  lastView: PreventionLoopLastView | null,
  currentDate: string,
): PreventionDailyAction[] {
  const adapted = actions.map((action) => {
    if (feedback[action.id] === "too_hard") {
      return makeEasierAction(action, "You said this felt too hard, so VYVA made it smaller.");
    }
    if (lastFeedback?.date !== currentDate && lastFeedback?.feedback === "too_hard" && actionMatchesLastFeedback(action, lastFeedback)) {
      return makeEasierAction(action, "Yesterday felt hard, so VYVA starts easier today.");
    }
    if (!lastFeedback && lastView && lastView.date !== currentDate && action === actions[0]) {
      return makeEasierAction(action, "Yesterday was skipped, so today starts with the smallest step.");
    }
    return action;
  });

  const doneIds = new Set(Object.entries(feedback).filter(([, value]) => value === "done").map(([id]) => id));
  if (!doneIds.size && lastFeedback?.date !== currentDate && lastFeedback?.feedback === "done") {
    const doneIndex = adapted.findIndex((action) => actionMatchesLastFeedback(action, lastFeedback));
    if (doneIndex > -1) {
      const next = [...adapted];
      const [doneAction] = next.splice(doneIndex, 1);
      next.push(doneAction);
      return next;
    }
  }

  return adapted;
}

function loopSummaryFor(
  focus: PreventionFocusResponse,
  feedback: StoredPreventionFeedback,
  lastFeedback: PreventionLoopLastFeedback | null,
  lastView: PreventionLoopLastView | null,
  currentDate: string,
): string {
  const values = Object.values(feedback);
  if (values.includes("too_hard")) return "Made easier now.";
  if (values.includes("remind")) return "Reminder saved.";
  if (values.includes("done")) return "Nice. One move done.";
  if (lastFeedback && lastFeedback.date !== currentDate && lastFeedback.feedback === "too_hard") return "Yesterday felt hard. Starting easier.";
  if (lastFeedback && lastFeedback.date !== currentDate && lastFeedback.feedback === "done") return "Yesterday went well. Next step first.";
  if (!lastFeedback && lastView && lastView.date !== currentDate) return "Missed yesterday. Smallest step first.";
  return `Why today: ${focus.why?.[0] ?? focus.todayAction}`;
}

function followUpSubjectFor(focus: PreventionFocusResponse): string {
  const reportInsight = focus.insights?.find((item) => item.id === "follow-up-report");
  const insightValue = reportInsight?.value?.trim();
  if (insightValue && !/symptom check/i.test(insightValue)) return insightValue;
  const why = focus.why?.find((item) => /latest symptom report:/i.test(item));
  const subject = why?.replace(/latest symptom report:/i, "").replace(/[.。]\s*$/, "").trim();
  return subject || "your latest symptoms";
}

type LongevityScreenProps = {
  backPath?: string;
};

export default function LongevityScreen({ backPath = "/health" }: LongevityScreenProps = {}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const profileFirstName = useOptionalProfile()?.firstName ?? "";
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useHomeMasterTheme();
  const { markCompleted, markDismissed, markAbandoned } = useHomeFastHelpOutcome(location.state);
  const { guardPath } = useServiceGate();
  const [selectedAction, setSelectedAction] = useState<PreventionDailyAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, PreventionFeedback>>({});
  const [actionBarriers, setActionBarriers] = useState<Record<string, PreventionBarrier>>({});
  const [lastLoopFeedback, setLastLoopFeedback] = useState<PreventionLoopLastFeedback | null>(null);
  const [lastLoopView, setLastLoopView] = useState<PreventionLoopLastView | null>(null);
  const [requestLearning, setRequestLearning] = useState(() => learningContextForRequest());
  const userId = user?.id ?? "";
  const todayUrl = userId ? `/api/longevity/today/${encodeURIComponent(userId)}` : "/api/longevity/today";
  const { data: todayResponse, isLoading, isError } = useQuery<LongevityTodayResponse>({
    queryKey: [
      todayUrl,
      requestLearning.clientHour,
      requestLearning.recentFeedback.length,
      requestLearning.dismissedFollowUpIds.join("|"),
    ],
    enabled: Boolean(userId),
    retry: false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await apiFetch(todayUrl);
      if (!res.ok) throw new Error("Could not load longevity focus");
      return res.json();
    },
  });
  const { data: smartNudge } = useQuery<SmartNudgeData>({
    queryKey: [userId ? `/api/smart-nudge/current/${encodeURIComponent(userId)}` : "/api/smart-nudge/current", userId],
    enabled: Boolean(userId),
    retry: false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await apiFetch(`/api/smart-nudge/current/${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error("Could not load smart nudge");
      return res.json();
    },
  });
  const engineData = isLongevityTodayResponse(todayResponse) ? todayResponse : undefined;
  const data = engineData ? mapEngineResponse(engineData) : undefined;
  const focus = data?.focus ? data : fallbackFocus;
  const isFollowUp = focus.focus === "Follow-up";
  const followUpSubject = isFollowUp ? followUpSubjectFor(focus) : "";
  const heroHeadline = isFollowUp ? followUpHeadlineFor(focus, followUpSubject) : focus.headline;
  const primaryRoute = focus.primaryRoute || fallbackFocus.primaryRoute;
  const currentDateKey = preventionDateKey(focus.generatedAt);
  const baseDailyActions = useMemo(() => {
    if (focus.dailyActions?.length) return focus.dailyActions.slice(0, 3);
    const guidanceItems = focus.guidance?.length ? focus.guidance : fallbackFocus.guidance ?? [];
    return guidanceItems.slice(0, 3).map((item) => guidanceToDailyAction(item, focus.focus));
  }, [focus.dailyActions, focus.focus, focus.guidance]);
  const dailyActions = useMemo(() => {
    if (isFollowUp) return baseDailyActions;
    return adaptDailyActionsForLoop(
      baseDailyActions,
      actionFeedback,
      lastLoopFeedback,
      lastLoopView,
      currentDateKey,
    );
  }, [actionFeedback, baseDailyActions, currentDateKey, isFollowUp, lastLoopFeedback, lastLoopView]);
  const learning = focus.learning ?? fallbackFocus.learning;
  const secondaryLabel = (() => {
    if (primaryRoute.startsWith("/informes")) return t("health.prevention.routes.report", "Open report");
    if (primaryRoute === "/health/vitals") return t("health.prevention.routes.vitals", "Check vitals");
    if (primaryRoute === "/meds") return t("health.prevention.routes.medicine", "Review medicine");
    if (primaryRoute === "/safe-home") return t("health.prevention.routes.homeSafety", "Home safety");
    if (primaryRoute === "/health/check-in") return t("health.prevention.routes.checkIn", "Check in");
    return t("health.prevention.secondaryAction", "Open next step");
  })();
  const actions = focus.actions?.length
    ? focus.actions
    : [
      {
        id: "primary",
        label: secondaryLabel,
        detail: focus.todayAction,
        route: primaryRoute,
        priority: "primary" as const,
      },
      {
        id: "talk",
        label: t("health.prevention.talk", "Talk to VYVA"),
        detail: t("health.prevention.askVyvaDetail", "Ask what matters today"),
        route: "/health/doctor",
        priority: "secondary" as const,
        mode: "voice" as const,
      },
    ];
  const weeklySummary = focus.weeklySummary ?? fallbackFocus.weeklySummary;
  const doctorNote = [focus.doctorNote || focus.why.concat(focus.todayAction).join(" "), weeklySummary?.doctorSummary].filter(Boolean).join(" ");
  const talkContext = isFollowUp
    ? `Follow-up: ${followUpSubject}. Help me understand what to ask, what to watch, and what support to arrange. ${doctorNote}`
    : `${focus.focus}: ${learning?.askPrompt ?? focus.headline} ${doctorNote}`;
  const loopSummary = loopSummaryFor(focus, actionFeedback, lastLoopFeedback, lastLoopView, currentDateKey);
  const feedbackStorageKey = preventionFeedbackStorageKey(focus.focus, currentDateKey);
  const barrierStorageKey = preventionBarrierStorageKey(focus.focus, currentDateKey);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(feedbackStorageKey);
      setActionFeedback(stored ? JSON.parse(stored) : {});
    } catch {
      setActionFeedback({});
    }
    try {
      const stored = window.localStorage.getItem(barrierStorageKey);
      setActionBarriers(stored ? JSON.parse(stored) : {});
    } catch {
      setActionBarriers({});
    }

    if (!data?.focus) {
      setLastLoopFeedback(null);
      setLastLoopView(null);
      return;
    }

    const previousFeedback = readStoredJson<PreventionLoopLastFeedback>(loopLastFeedbackKey);
    const previousView = readStoredJson<PreventionLoopLastView>(loopLastViewKey);
    setLastLoopFeedback(previousFeedback?.focus === focus.focus ? previousFeedback : null);
    setLastLoopView(previousView?.focus === focus.focus ? previousView : null);
    writeStoredJson(loopLastViewKey, {
      focus: focus.focus,
      date: currentDateKey,
      viewedAt: new Date().toISOString(),
    } satisfies PreventionLoopLastView);
  }, [barrierStorageKey, currentDateKey, data?.focus, feedbackStorageKey, focus.focus]);

  useEffect(() => {
    if (typeof window === "undefined" || !data?.focus || !dailyActions.length) return;
    const actionIds = dailyActions.map((item) => item.id);
    const viewedKey = `vyva-prevention-loop:viewed:${focus.focus}:${currentDateKey}`;
    const viewedValue = actionIds.join("|");
    if (window.localStorage.getItem(viewedKey) === viewedValue) return;
    appendLoopHistory(dailyActions.map((action) => ({
      actionId: action.id,
      title: action.title,
      step: action.step,
      tone: action.tone,
      focus: focus.focus,
      feedback: "shown",
      date: currentDateKey,
      savedAt: new Date().toISOString(),
    })));
    window.localStorage.setItem(viewedKey, viewedValue);
  }, [currentDateKey, dailyActions, data?.focus, focus.focus]);

  const openTalk = (context = talkContext) => {
    guardPath("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: context,
      },
    });
  };

  const resolveFollowUp = () => {
    const reportId = focus.followUp?.reportId?.trim();
    if (!reportId) return;
    dismissPreventionFollowUp(reportId);
    setRequestLearning(learningContextForRequest());
  };

  const submitFeedback = async (actionId: string, outcome: "done" | "hard" | "skip") => {
    if (!userId) return;
    try {
      const response = await apiFetch("/api/longevity/feedback", {
        method: "POST",
        body: JSON.stringify({ userId, actionId, outcome }),
      });
      if (!response.ok) throw new Error(`Feedback request failed with ${response.status}`);
    } catch (error) {
      console.error("[Longevity] Could not save feedback", error);
    }
  };

  const markAction = (action: PreventionDailyAction, feedback: PreventionFeedback) => {
    if (feedback === "ask_vyva") {
      openTalk(`${focus.focus}: ${action.title}. ${action.why}. ${doctorNote}`);
      return;
    }

    setActionFeedback((current) => {
      const next = { ...current, [action.id]: feedback };
      const loopFeedback = {
        focus: focus.focus,
        date: currentDateKey,
        actionId: action.id,
        step: action.step,
        tone: action.tone,
        feedback,
        barrier: actionBarriers[action.id],
        title: action.title,
        savedAt: new Date().toISOString(),
      } satisfies PreventionLoopLastFeedback;
      setLastLoopFeedback(loopFeedback);
      return next;
    });
    void submitFeedback(action.id, feedback === "done" ? "done" : feedback === "too_hard" ? "hard" : "skip");
    if (feedback === "done") {
      markCompleted({ reason: "prevention_action_done", referenceId: action.id });
    } else if (feedback === "too_hard") {
      markDismissed({ reason: "prevention_action_too_hard", referenceId: action.id });
    } else if (feedback === "remind") {
      markAbandoned({ reason: "prevention_action_deferred", referenceId: action.id });
    }
  };

  const markBarrier = (action: PreventionDailyAction, barrier: PreventionBarrier) => {
    markDismissed({ reason: `prevention_barrier_${barrier}`, referenceId: action.id });
    setActionBarriers((current) => {
      return { ...current, [action.id]: barrier };
    });
    const loopFeedback = {
      focus: focus.focus,
      date: currentDateKey,
      actionId: action.id,
      step: action.step,
      tone: action.tone,
      feedback: "too_hard" as const,
      barrier,
      title: action.title,
      savedAt: new Date().toISOString(),
    } satisfies PreventionLoopLastFeedback;
    setLastLoopFeedback(loopFeedback);
  };

  const openAction = (item: PreventionAction) => {
    if (item.mode === "voice" || item.route === "/health/doctor") {
      openTalk(`${focus.focus}: ${item.detail}. ${doctorNote}`);
      return;
    }
    if (item.route === "/meds") {
      guardPath("/meds");
      return;
    }
    navigate(item.route || "/health");
  };

  const openGuidanceAction = (item: PreventionGuidanceAction, contextTitle?: string) => {
    if (item.shoppingPrefill) {
      navigate("/concierge/shopping", {
        state: {
          shoppingPrefill: item.shoppingPrefill,
        },
      });
      return;
    }
    if (item.mode === "voice" || item.route === "/health/doctor") {
      openTalk(`${focus.focus}: ${contextTitle ?? item.label}. ${item.detail}. ${doctorNote}`);
      return;
    }
    if (item.route === "/meds") {
      guardPath("/meds");
      return;
    }
    navigate(item.route || "/health");
  };

  const selectedSheet = selectedAction?.actionSheet ?? null;

  const openFollowUpDailyAction = (item: PreventionDailyAction) => {
    const primaryAction = item.actionSheet.primaryAction;
    const route = primaryAction.route || "/health";
    const subject = followUpSubject || item.detail;
    const contextText = `${subject}. ${doctorNote}`.trim();

    if (primaryAction.mode === "voice" || route === "/health/doctor") {
      openTalk(`${focus.focus}: ${item.title}. ${primaryAction.detail}. ${contextText}`);
      return;
    }

    if (route === "/concierge") {
      navigate("/concierge", {
        state: {
          conciergePrefill: {
            kind: "appointment",
            source: "symptom_report",
            message: `Please help me arrange the right support for ${subject}.`,
          },
        },
      });
      return;
    }

    if (route === "/health/symptom-check") {
      navigate("/health/symptom-check", {
        state: {
          initialClue: `Follow-up for ${subject}. Signs to watch: ${focus.helpSigns.join(", ")}.`,
        },
      });
      return;
    }

    if (route === "/meds") {
      guardPath("/meds");
      return;
    }

    navigate(route, {
      state: {
        preventionFollowUp: {
          subject,
          title: item.title,
          detail: item.detail,
        },
      },
    });
  };

  const openDailyActionNow = (item: PreventionDailyAction) => {
    if (isFollowUp) {
      openFollowUpDailyAction(item);
      return;
    }
    setSelectedAction(item);
  };

  const statusActions: LongevityActionCard[] = dailyActions.map((item) => ({
    id: item.id,
    title: item.title,
    detail: item.detail,
    tone: item.tone,
    onSelect: () => openDailyActionNow(item),
  }));
  const statusPrimaryAction = statusActions[0] ?? {
    id: "fallback-check-in",
    title: fallbackFocus.todayAction,
    tone: "check" as const,
    onSelect: () => navigate(fallbackFocus.primaryRoute),
  };
  const firstName = profileFirstName || "there";
  const statusState = screenStateFor(engineData, focus);

  const leavePrevention = () => {
    markAbandoned({ reason: "left_prevention" });
    navigate(backPath);
  };

  return (
    <div
      className="mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col px-6 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-8 sm:max-w-[620px] sm:px-7 lg:max-w-[760px]"
      data-testid="prevention-page"
    >
      <HomeMasterTopbar className="mb-5" testId="prevention-topbar">
        <HomeMasterActionControl
          isDark={isDark}
          icon={ArrowLeft}
          onClick={leavePrevention}
          testId="button-prevention-back"
          ariaLabel={t("health.prevention.back", "Back to My Health")}
          variant="quiet"
        />
        <h1 className={["truncate text-center font-display text-[24px] font-semibold leading-tight tracking-[-0.03em]", isDark ? "text-[#FFF8FF]" : "text-[#241C30]"].join(" ")}>
          {t("health.prevention.title", "Longevity")}
        </h1>
        <HomeMasterActionControl
          isDark={isDark}
          icon={Mic}
          onClick={() => openTalk()}
          testId="button-prevention-header-talk"
          ariaLabel={t("health.prevention.talk", "Talk to VYVA")}
        />
      </HomeMasterTopbar>

      {smartNudge ? (
        <SmartNudge
          type={smartNudge.type}
          color={smartNudge.color}
          message={smartNudge.message}
          action_route={smartNudge.action_route}
          onSelect={(route) => navigate(route)}
        />
      ) : null}

      <LongevityStatusCard
        state={statusState}
        firstName={firstName}
        timeOfDay={focus.ranking?.timeOfDay ?? "morning"}
        focusName={focus.focus}
        reason={focus.why[0]}
        why={focus.why}
        generatedHeadline={heroHeadline}
        generatedReason={engineData?.insight_text}
        primaryAction={statusPrimaryAction}
        secondaryActions={statusActions.slice(1, 3)}
        onAskVyva={() => openTalk()}
        isLoading={isLoading}
      />

      {isFollowUp && focus.followUp?.reportId ? (
        <button
          type="button"
          onClick={resolveFollowUp}
          data-testid="button-prevention-resolve-follow-up"
          className="vyva-tap mt-2 inline-flex min-h-[34px] items-center justify-center rounded-full border border-[#FAD7AA] bg-white px-3 font-body text-[12px] font-black text-[#B45309]"
        >
          {t("health.prevention.followUpHandled", "Handled")}
        </button>
      ) : null}

      <section
        className={isFollowUp
          ? "mt-3 rounded-[22px] border bg-white p-3 shadow-[0_12px_28px_rgba(31,41,55,0.05)]"
          : "mt-4 rounded-[24px] border bg-white p-4 shadow-[0_12px_28px_rgba(31,41,55,0.05)]"}
        style={{ borderColor: dailyActionToneStyle(dailyActions[0]?.tone ?? "check").border }}
        data-testid="prevention-guidance-panel"
      >
        <div className="flex items-center gap-3">
          <h2 className={isFollowUp ? "font-body text-[19px] font-black leading-tight text-vyva-text-1" : "font-body text-[22px] font-black leading-tight text-vyva-text-1"}>
            {isFollowUp ? t("health.prevention.followUpTitle", "VYVA can help") : t("health.prevention.guidanceTitle", "Today's 3 moves")}
          </h2>
        </div>

        {!isFollowUp && (Object.keys(actionFeedback).length > 0 || lastLoopFeedback) ? (
          <div
            className="mt-3 rounded-[16px] bg-[#F7F4FC] px-3 py-2 font-body text-[13px] font-bold leading-snug text-vyva-text-2"
            data-testid="prevention-loop-summary"
          >
            {loopSummary}
          </div>
        ) : null}

        <div className={isFollowUp ? "mt-3 grid gap-2" : "mt-4 grid gap-2.5"} data-testid="prevention-daily-actions">
          {dailyActions.map((item) => {
            const style = dailyActionToneStyle(item.tone);
            const Icon = dailyActionIconFor(item, isFollowUp);
            const tagStyle = isFollowUp ? followUpTagStyle(item.step) : { background: style.chipBg, color: style.chipText };
            const feedback = actionFeedback[item.id];
            const selectedBarrier = actionBarriers[item.id];
            const visibleDetail = isFollowUp ? followUpDetailFor(item) : item.detail;
            return (
              <article
                key={item.id}
                data-testid={`prevention-daily-${item.id}`}
                className={isFollowUp ? "rounded-[16px] border bg-white px-2.5 py-2" : "rounded-[20px] border bg-white p-3 shadow-[0_8px_20px_rgba(80,52,109,0.04)]"}
                style={{ borderColor: style.border }}
              >
                <button
                  type="button"
                  onClick={() => openDailyActionNow(item)}
                  data-testid={`button-prevention-daily-${item.id}`}
                  className={isFollowUp ? "vyva-tap flex w-full gap-2.5 text-left" : "vyva-tap flex w-full gap-3 text-left"}
                >
                  <span
                    className={isFollowUp
                      ? "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[12px]"
                      : "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px]"}
                    style={{ background: style.iconBg, color: style.iconColor }}
                  >
                    <Icon size={isFollowUp ? 17 : 19} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isFollowUp ? (
                        <span className="rounded-full px-2 py-0.5 font-body text-[11px] font-black uppercase tracking-[0.06em]" style={tagStyle}>
                          {item.step}
                        </span>
                      ) : null}
                      {feedback && feedback !== "ask_vyva" ? (
                        <span className="rounded-full bg-white px-2 py-0.5 font-body text-[11px] font-black text-vyva-text-2" data-testid={`prevention-feedback-${item.id}`}>
                          {feedbackDisplay[feedback as Exclude<PreventionFeedback, "ask_vyva">]}
                        </span>
                      ) : null}
                    </div>
                    <h3 className={isFollowUp
                      ? "mt-0.5 font-body text-[16px] font-black leading-tight text-vyva-text-1"
                      : "mt-1.5 font-body text-[17px] font-black leading-tight text-vyva-text-1"}
                    >
                      {item.title}
                    </h3>
                    {isFollowUp ? (
                      <p className="sr-only">
                        {visibleDetail}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight size={17} strokeWidth={2.6} className={isFollowUp ? "mt-4 flex-shrink-0 text-vyva-text-3" : "mt-3 flex-shrink-0 text-vyva-text-3"} aria-hidden="true" />
                </button>
                {!isFollowUp ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 pl-[52px]" data-testid={`prevention-feedback-row-${item.id}`}>
                  {item.feedbackOptions.filter((option) => option.id === "done" || option.id === "too_hard").map((option) => {
                    const selected = feedback === option.id;
                    const Icon = option.id === "done"
                      ? CheckCircle2
                      : option.id === "too_hard"
                        ? Ban
                        : option.id === "remind"
                          ? ClipboardList
                          : MessageCircle;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => markAction(item, option.id)}
                        data-testid={`button-prevention-feedback-${item.id}-${option.id}`}
                        className="vyva-tap inline-flex min-h-[36px] min-w-[92px] items-center justify-center gap-1.5 rounded-[12px] border bg-white px-3.5 font-body text-[12px] font-black shadow-[0_2px_6px_rgba(31,41,55,0.04)]"
                        style={{
                          borderColor: selected ? style.iconColor : style.border,
                          background: selected ? style.iconBg : "#FFFFFF",
                          color: selected && option.id === "done" ? "#047857" : selected ? "#6B21A8" : style.iconColor,
                        }}
                      >
                        <Icon size={14} aria-hidden="true" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                  </div>
                ) : null}
                {!isFollowUp && feedback === "too_hard" ? (
                  <div className="mt-2 grid grid-cols-3 gap-1.5 pl-[52px]" data-testid={`prevention-barrier-row-${item.id}`}>
                    {barrierOptions.map((option) => {
                      const selected = selectedBarrier === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => markBarrier(item, option.id)}
                          data-testid={`button-prevention-barrier-${item.id}-${option.id}`}
                          className={selected
                            ? "vyva-tap min-h-[32px] rounded-full bg-[#F5F3FF] px-2 font-body text-[11px] font-black text-vyva-purple"
                            : "vyva-tap min-h-[32px] rounded-full bg-white px-2 font-body text-[11px] font-black text-vyva-text-2"}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {isError ? (
          <p className="mt-3 font-body text-[13px] font-bold text-vyva-text-3" data-testid="prevention-fallback-note">
            {t("health.prevention.fallbackNote", "Using a simple plan until your latest signals load.")}
          </p>
        ) : null}
      </section>

      {!isFollowUp && learning ? (
        <section
          className="mt-4 rounded-[24px] border border-[#DDD6FE] bg-white p-4 shadow-[0_12px_28px_rgba(31,41,55,0.05)]"
          data-testid="prevention-learning"
        >
          <div className="flex gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
              <Sparkles size={21} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-body text-[20px] font-black leading-tight text-vyva-text-1">
                {learning.title}
              </h2>
              <p className="mt-1 line-clamp-2 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                {learning.detail}
              </p>
            </div>
          </div>
          {weeklySummary ? (
            <div className="mt-3 flex items-center gap-2 rounded-[16px] bg-[#FBFAFF] px-3 py-2" data-testid="prevention-weekly-memory">
              <Sparkles size={16} className="flex-shrink-0 text-vyva-purple" aria-hidden="true" />
              <p className="min-w-0 flex-1 truncate font-body text-[13px] font-bold text-vyva-text-2">
                {weeklySummary.detail}
              </p>
              <button
                type="button"
                onClick={() => openTalk(`${focus.focus}: ${weeklySummary.doctorSummary} ${weeklySummary.caregiverSummary}`)}
                data-testid="button-prevention-weekly-summary"
                className="vyva-tap min-h-[34px] flex-shrink-0 rounded-full bg-white px-3 font-body text-[13px] font-black text-vyva-purple"
              >
                Ask
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => openTalk(`${focus.focus}: ${learning.askPrompt}`)}
            className="vyva-tap mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#F5F3FF] px-4 font-body text-[14px] font-black text-vyva-purple"
          >
            <MessageCircle size={17} aria-hidden="true" />
            {t("health.prevention.askAbout", "Ask VYVA")}
          </button>
        </section>
      ) : null}

      {!isFollowUp ? (
        <section
        className="mt-4 rounded-[24px] border border-[#E6E0F4] bg-white p-4 shadow-[0_12px_28px_rgba(31,41,55,0.05)]"
        data-testid="prevention-actions"
        >
        <h2 className="font-body text-[22px] font-black leading-tight text-vyva-text-1">
          {t("health.prevention.nextSteps", "Fast help")}
        </h2>
        <div className="mt-3 grid gap-2">
          {actions.slice(0, 3).map((item, index) => {
            const Icon = item.mode === "voice"
              ? MessageCircle
              : item.route === "/health/vitals"
                ? Activity
                : item.route === "/meds"
                  ? Pill
                  : ClipboardList;
            const primary = item.priority === "primary";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openAction(item)}
                data-testid={index === 0 ? "button-prevention-secondary" : `button-prevention-action-${item.id}`}
                className={primary
                  ? "vyva-tap flex min-h-[58px] items-center gap-3 rounded-[18px] bg-vyva-purple px-3 py-2 text-left text-white shadow-[0_12px_24px_rgba(109,40,217,0.18)]"
                  : "vyva-tap flex min-h-[58px] items-center gap-3 rounded-[18px] border border-[#D9ECE4] bg-white px-3 py-2 text-left"}
              >
                <span className={primary
                  ? "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white/18 text-white"
                  : "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple"}
                >
                  <Icon size={19} strokeWidth={2.45} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={primary
                    ? "block font-body text-[15px] font-black leading-tight text-white"
                    : "block font-body text-[15px] font-black leading-tight text-vyva-text-1"}
                  >
                    {item.label}
                  </span>
                  <span className="sr-only"
                  >
                    {item.detail}
                  </span>
                </span>
                <ChevronRight size={17} strokeWidth={2.6} className={primary ? "text-white/80" : "text-vyva-text-3"} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-[18px] border border-[#FECACA] bg-[#FFF7F7] p-3" data-testid="prevention-help-signs">
          <h3 className="font-body text-[14px] font-black text-[#B91C1C]">
            {t("health.prevention.helpSigns", "Get help if")}
          </h3>
          <div className="mt-1 flex flex-wrap gap-2">
            {(focus.helpSigns?.length ? focus.helpSigns : fallbackFocus.helpSigns).slice(0, 3).map((sign) => (
              <span key={sign} className="rounded-full bg-white px-2.5 py-1 font-body text-[13px] font-black text-[#7F1D1D]">
                {sign}
              </span>
            ))}
          </div>
        </div>

        </section>
      ) : null}

      {selectedAction && selectedSheet ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/28 px-3 pb-3 sm:px-4 sm:pb-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prevention-action-sheet-title"
          data-testid="prevention-action-sheet"
          onClick={() => setSelectedAction(null)}
        >
          <div
            className="max-h-[86vh] w-full max-w-[520px] overflow-y-auto rounded-[28px] border border-[#E6E0F4] bg-white p-4 shadow-[0_24px_70px_rgba(31,41,55,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
                {selectedAction.tone === "food" ? <Utensils size={21} aria-hidden="true" />
                  : selectedAction.tone === "movement" ? <Dumbbell size={21} aria-hidden="true" />
                    : selectedAction.tone === "medicine" ? <Pill size={21} aria-hidden="true" />
                      : selectedAction.tone === "support" ? <ShieldCheck size={21} aria-hidden="true" />
                        : <CheckCircle2 size={21} aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                  {selectedAction.step} / {selectedAction.evidenceLabel}
                </p>
                <h2 id="prevention-action-sheet-title" className="font-body text-[24px] font-black leading-tight text-vyva-text-1">
                  {selectedSheet.title}
                </h2>
                <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                  {selectedSheet.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAction(null)}
                className="vyva-tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F8F4EF] text-vyva-text-2"
                aria-label={t("common.close", "Close")}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              data-testid="button-prevention-sheet-primary"
              onClick={() => openGuidanceAction(selectedSheet.primaryAction, selectedSheet.title)}
              className="vyva-tap mt-4 flex min-h-[58px] w-full items-center gap-3 rounded-[18px] bg-vyva-purple px-4 py-3 text-left text-white shadow-[0_12px_24px_rgba(109,40,217,0.18)]"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white/18 text-white">
                {selectedSheet.primaryAction.shoppingPrefill ? <ShoppingBasket size={19} aria-hidden="true" />
                  : selectedSheet.primaryAction.mode === "voice" ? <MessageCircle size={19} aria-hidden="true" />
                    : selectedSheet.primaryAction.route.includes("exercise") || selectedSheet.primaryAction.route.includes("breathe") ? <Dumbbell size={19} aria-hidden="true" />
                      : <ChevronRight size={19} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-body text-[16px] font-black leading-tight">
                  {selectedSheet.primaryAction.label}
                </span>
                <span className="sr-only">
                  {selectedSheet.primaryAction.detail}
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>

            <div className="mt-3 grid grid-cols-2 gap-2" data-testid="prevention-action-feedback">
              {selectedAction.feedbackOptions.slice(0, 4).map((feedback) => {
                const selected = actionFeedback[selectedAction.id] === feedback.id;
                return (
                  <button
                    key={feedback.id}
                    type="button"
                    data-testid={`button-prevention-sheet-feedback-${feedback.id}`}
                    onClick={() => markAction(selectedAction, feedback.id)}
                    className={selected
                      ? "vyva-tap min-h-[42px] rounded-full bg-[#ECFDF5] px-3 font-body text-[12px] font-black text-[#047857]"
                      : "vyva-tap min-h-[42px] rounded-full border border-[#E6E0F4] bg-white px-3 font-body text-[12px] font-black text-vyva-text-2"}
                  >
                    {feedback.label}
                  </button>
                );
              })}
            </div>

            {selectedSheet.recipes?.length ? (
              <div className="mt-4" data-testid="prevention-action-sheet-recipes">
                <p className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                  {t("health.prevention.recipes", "Recipes")}
                </p>
                <div className="mt-2 grid gap-2.5">
                  {selectedSheet.recipes.slice(0, 3).map((recipeItem) => (
                    <article key={recipeItem.id} className="rounded-[18px] border border-[#FAD7AA] bg-[#FFFCF7] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-body text-[17px] font-black leading-tight text-vyva-text-1">
                            {recipeItem.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 font-body text-[12px] font-bold leading-snug text-vyva-text-2">
                            {recipeItem.whyItFits}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 font-body text-[11px] font-black text-[#B45309]">
                          {recipeItem.prepTimeLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {recipeItem.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-[#FFF7ED] px-2 py-0.5 font-body text-[11px] font-black text-[#9A3412]">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        data-testid={`button-prevention-recipe-shopping-${recipeItem.id}`}
                        onClick={() => openGuidanceAction({
                          id: `recipe-${recipeItem.id}`,
                          label: t("health.prevention.getIngredients", "Get ingredients"),
                          detail: recipeItem.title,
                          route: "/concierge/shopping",
                          priority: "secondary",
                          shoppingPrefill: recipeItem.shoppingPrefill,
                        }, recipeItem.title)}
                        className="vyva-tap mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-[#B45309]"
                      >
                        <ShoppingBasket size={15} aria-hidden="true" />
                        {t("health.prevention.getIngredients", "Get ingredients")}
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              {selectedSheet.secondaryActions.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`button-prevention-sheet-action-${item.id}`}
                  onClick={() => openGuidanceAction(item, selectedSheet.title)}
                  className="vyva-tap flex min-h-[54px] items-center gap-3 rounded-[17px] border border-[#E6E0F4] bg-white px-3 py-2 text-left"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] bg-[#F5F3FF] text-vyva-purple">
                    {item.shoppingPrefill ? <ShoppingBasket size={17} aria-hidden="true" />
                      : item.mode === "voice" ? <MessageCircle size={17} aria-hidden="true" />
                        : item.route.includes("breathe") || item.route.includes("exercise") ? <Dumbbell size={17} aria-hidden="true" />
                          : <ChevronRight size={17} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-[14px] font-black leading-tight text-vyva-text-1">
                      {item.label}
                    </span>
                    <span className="sr-only">
                      {item.detail}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-vyva-text-3" aria-hidden="true" />
                </button>
              ))}
            </div>

            {selectedSheet.safetyNote ? (
              <p className="mt-3 rounded-[16px] bg-[#F8F4EF] px-3 py-2 font-body text-[12px] font-bold leading-snug text-vyva-text-2">
                {selectedSheet.safetyNote}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
