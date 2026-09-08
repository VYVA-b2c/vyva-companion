import {
  ArrowLeft,
  Bell,
  Check,
  Clock,
  Copy,
  HeartHandshake,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Monitor,
  Pause,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  Vote,
  X,
  ZoomIn,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import { APP_WORKFLOW_REFERENCES } from "../../shared/workflowRegistry";
import { buildWorkflowReceiptMoment } from "../../shared/workflowReceiptMoments";
import AgentAvatar from "./AgentAvatar";
import SocialStyles from "./SocialStyles";
import StoryRoomHandoffCard, { StoryRoomReplyLoopCard, type StoryRoomHandoffNote } from "./StoryRoomHandoffCard";
import type {
  SocialLanguage,
  SocialRoomCostRange,
  SocialRoomComfortNeed,
  SocialRoomDecisionGuide,
  SocialRoomExperienceCategory,
  SocialRoomGroupSize,
  SocialRoomPlan,
  SocialRoomPlanHelperAction,
  SocialRoomPlanKind,
  SocialRoomPlanResponseAction,
  SocialRoomPlanResponseValue,
  SocialRoomPreferredTime,
  SocialRoomReply,
  SocialRoomReplyTone,
  SocialRoomPulse,
  SocialRoomResponse,
  SocialRoomSafetyFlag,
} from "./types";

type TogetherRoomScreenProps = {
  roomResponse: SocialRoomResponse;
  language: SocialLanguage;
  visitId?: string | null;
  onBack: () => void;
  onOpenActivities?: () => void;
  onOpenShareStories?: () => void;
  shareStoryHandoff?: StoryRoomHandoffNote | null;
};

type StarterAction = "hello" | "plan" | "ask";
type ProposalLocationLabel = "nearby" | "online";
type PlanCollaborationAction = SocialRoomPlanHelperAction;
type ViewPromptAction = "agree" | "different" | "compare" | "more_info";
type ViewNextReplyCueKind = "opening" | "agreement" | "curious" | "different" | "mixed";
type RoomVoteSignalKind = "opening" | "close" | "clear";
type AskPromptAction = "summary" | "easier" | "vote" | "safe";
type IssuePromptAction = "place" | "time" | "cost" | "safety";
type SafetyHelpChoice = "uncomfortable" | "pressure_contact" | "money_service" | "something_else";
type SafetyHelpPanelAnchor = "intro" | "footer";
type MySafeChoiceId = "plan" | "vote" | "comfort" | "help";
type MySafeChoiceActionId = "comfort" | "vote" | "plan";
type MySafeReviewKind = "shared" | "reply" | "poll" | "room";
type NextGentleStepId = "promise" | "updates" | "comfort" | "vote" | "plan" | "recap" | "hello";
type RoomOutcomeContext = "waiting" | "tie" | "views" | "plan" | "comfort";
type RoomOutcomeStepId = "private" | "shape" | "safety";
type PlanReadinessItemId = "interest" | "helper" | "comfort" | "vyva";
type ComposerPreviewItemId = "shared" | "private" | "next";
type RoomUsefulStepId = "activity" | "vote" | "views";
type ParticipationPathId = "vote" | "view" | "activity";
type RoomNoteId = "known" | "open" | "next";
type RoomNotesNextActionId = "activity" | "vote" | "views" | "starter";
type RoomNoteOpenItemId = "vote" | "comfort" | "views" | "activity";
type RoomTrustItemId = "privacy" | "kindness" | "contact";
type ViewSafetyItemId = "kind" | "private" | "review";
type NextGentleStepCopy = {
  title: string;
  body: string;
  action: string;
};
type SocialRoomPostResponse = {
  ok?: boolean;
  pulse?: SocialRoomPulse;
  quietPausedAt?: string | null;
  proposal?: {
    needsReview?: boolean;
    status?: string;
  };
};
type SocialRoomPulseRefreshResponse = {
  pulse?: SocialRoomPulse;
};

const memberColours = ["#0F766E", "#7C3AED", "#D97706"];
const defaultPlanKind: SocialRoomPlanKind = "plan";
const proposalTitleMaxLength = 96;
const proposalDetailsMaxLength = 320;
const comfortNeedOptions: SocialRoomComfortNeed[] = ["listen_first", "quiet_pace", "easy_access", "seating", "transport_help", "arrival_buddy", "clear_cost"];
const experienceCategoryOptions: SocialRoomExperienceCategory[] = [
  "movie_date",
  "restaurant_date",
  "home_share",
  "service_booking",
  "deal_help",
  "outing",
  "other",
];
const preferredTimeOptions: SocialRoomPreferredTime[] = ["morning", "afternoon", "evening", "flexible"];
const costRangeOptions: SocialRoomCostRange[] = ["free", "low", "shared", "discuss"];
const groupSizeOptions: SocialRoomGroupSize[] = ["one_to_one", "small_group", "open_room"];
const arrivalComfortShortcuts: SocialRoomComfortNeed[] = ["listen_first", "quiet_pace", "arrival_buddy"];
const planComfortCheckNeeds: SocialRoomComfortNeed[] = ["easy_access", "seating", "transport_help", "arrival_buddy", "clear_cost"];
const planCollaborationActions: PlanCollaborationAction[] = ["choose", "pace", "buddy", "notify"];
const viewPromptActions: ViewPromptAction[] = ["agree", "different", "compare", "more_info"];
const askPromptActions: AskPromptAction[] = ["summary", "easier", "vote", "safe"];
const issuePromptActions: IssuePromptAction[] = ["place", "time", "cost", "safety"];
const safetyHelpChoices: SafetyHelpChoice[] = ["uncomfortable", "pressure_contact", "money_service", "something_else"];
const viewBalanceTones: SocialRoomReplyTone[] = ["support", "curious", "different", "help"];
const viewCircleReplyTones: SocialRoomReplyTone[] = ["support", "curious", "different"];
const readingComfortPreferenceKey = "vyva:together-room:reading-comfort:v1";
const privateRoomNoteKey = "vyva:together-room:private-note:v1";
const privateRoomNoteMaxLength = 220;
const planCollaborationTones: Record<PlanCollaborationAction, SocialRoomReplyTone> = {
  choose: "help",
  pace: "curious",
  buddy: "help",
  notify: "support",
};
const nextGentleStepIcons: Record<NextGentleStepId, typeof MessageCircle> = {
  promise: ShieldCheck,
  updates: Bell,
  comfort: HeartHandshake,
  vote: Vote,
  plan: HeartHandshake,
  recap: Sparkles,
  hello: MessageCircle,
};
const roomOutcomeStepIcons: Record<RoomOutcomeStepId, typeof MessageCircle> = {
  private: Vote,
  shape: Sparkles,
  safety: ShieldCheck,
};
const planReadinessIcons: Record<PlanReadinessItemId, typeof MessageCircle> = {
  interest: Users,
  helper: HeartHandshake,
  comfort: ShieldCheck,
  vyva: Sparkles,
};
const composerPreviewIcons: Record<ComposerPreviewItemId, typeof MessageCircle> = {
  shared: MessageCircle,
  private: ShieldCheck,
  next: Sparkles,
};
const roomUsefulStepIcons: Record<RoomUsefulStepId, typeof MessageCircle> = {
  activity: HeartHandshake,
  vote: Vote,
  views: MessageCircle,
};
const participationPathIcons: Record<ParticipationPathId, typeof MessageCircle> = {
  vote: Vote,
  view: MessageCircle,
  activity: HeartHandshake,
};
const roomNoteIcons: Record<RoomNoteId, typeof MessageCircle> = {
  known: Check,
  open: Clock,
  next: Sparkles,
};
const roomTrustIcons: Record<RoomTrustItemId, typeof MessageCircle> = {
  privacy: Vote,
  kindness: HeartHandshake,
  contact: ShieldCheck,
};
const viewSafetyIcons: Record<ViewSafetyItemId, typeof MessageCircle> = {
  kind: HeartHandshake,
  private: ShieldCheck,
  review: LifeBuoy,
};

function TogetherReadableStyles() {
  return (
    <style>{`
      .together-readable .text-\\[12px\\] { font-size: 14px !important; }
      .together-readable .text-\\[13px\\] { font-size: 15px !important; }
      .together-readable .text-\\[14px\\] { font-size: 16px !important; }
      .together-readable .text-\\[15px\\] { font-size: 17px !important; }
      .together-readable .text-\\[16px\\] { font-size: 18px !important; }
      .together-readable .text-\\[17px\\] { font-size: 19px !important; }
      .together-readable .text-\\[18px\\] { font-size: 20px !important; }
      .together-readable .text-\\[19px\\] { font-size: 21px !important; }
      .together-readable .text-\\[20px\\] { font-size: 22px !important; }
      .together-readable .text-\\[21px\\] { font-size: 23px !important; }
      .together-readable .text-\\[26px\\] { font-size: 28px !important; }
      .together-readable .text-\\[28px\\] { font-size: 30px !important; }
      .together-readable .text-\\[31px\\] { font-size: 33px !important; }
      .together-readable .text-\\[34px\\] { font-size: 37px !important; }
      .together-readable .font-body,
      .together-readable .font-display {
        letter-spacing: 0 !important;
      }
      .together-readable p,
      .together-readable span,
      .together-readable button,
      .together-readable textarea,
      .together-readable input {
        line-height: 1.42 !important;
        overflow-wrap: anywhere;
      }
      .together-readable textarea,
      .together-readable input {
        font-size: 18px !important;
      }
    `}</style>
  );
}

function getReadingComfortPreference() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(readingComfortPreferenceKey) === "on";
  } catch {
    return false;
  }
}

function saveReadingComfortPreference(enabled: boolean) {
  if (typeof window === "undefined") return;

  try {
    if (enabled) {
      window.localStorage.setItem(readingComfortPreferenceKey, "on");
      return;
    }
    window.localStorage.removeItem(readingComfortPreferenceKey);
  } catch {
    // Reading comfort is a private convenience; the room still works if storage is unavailable.
  }
}

function limitPrivateRoomNote(value: string) {
  return value.slice(0, privateRoomNoteMaxLength);
}

function getPrivateRoomNote() {
  if (typeof window === "undefined") return "";

  try {
    return limitPrivateRoomNote(window.localStorage.getItem(privateRoomNoteKey) ?? "");
  } catch {
    return "";
  }
}

function savePrivateRoomNote(value: string) {
  if (typeof window === "undefined") return;

  try {
    const next = limitPrivateRoomNote(value.trim());
    if (next) {
      window.localStorage.setItem(privateRoomNoteKey, next);
      return;
    }
    window.localStorage.removeItem(privateRoomNoteKey);
  } catch {
    // This note is private convenience state; the room still works if storage is unavailable.
  }
}

function speechLanguage(language: SocialLanguage) {
  if (language === "de") return "de-DE";
  if (language === "es") return "es-ES";
  return "en-US";
}

function focusTemporaryRoomElement(target: HTMLElement) {
  const hadTabIndex = target.hasAttribute("tabindex");
  if (!hadTabIndex) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
}

const mySafeChoiceIcons: Record<MySafeChoiceId, typeof MessageCircle> = {
  plan: HeartHandshake,
  vote: Vote,
  comfort: ShieldCheck,
  help: LifeBuoy,
};
const mySafeChoiceActionIcons: Record<MySafeChoiceActionId, typeof MessageCircle> = {
  comfort: HeartHandshake,
  vote: Vote,
  plan: Sparkles,
};
const visibilityIcons: Record<string, typeof MessageCircle> = {
  private: ShieldCheck,
  totals: Users,
  shared: MessageCircle,
};

function limitProposalDraft(value: string) {
  return value.slice(0, proposalDetailsMaxLength);
}

function proposalTitleFromDraft(title: string, details: string) {
  const titleSource = title.trim() || details.trim();
  return titleSource.slice(0, proposalTitleMaxLength).trimEnd();
}

function hasProtectedNumberSequence(value: string) {
  const matches = value.match(/(?:\+?\d[\d\s().-]{5,}\d)/g) ?? [];
  return matches.some((match) => {
    const trimmed = match.trim();
    const digits = trimmed.replace(/\D/g, "");
    const looksLikeDate = /^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed);
    return digits.length >= 7 && digits.length <= 19 && !looksLikeDate;
  });
}

function normalizeSafetyText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasProtectedProposalDetails(value: string) {
  const text = normalizeSafetyText(value);
  return (
    /\b(address|adresse|correo|direccion|e-?mail|email|outside the app|phone|private contact|telefono|telefon|text me|whatsapp)\b/.test(text)
    || /https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)
    || /\b(bank|banco|card number|credit card|crypto|deposit|gift card|iban|konto|payment details|tarjeta|transfer|transferencia)\b/.test(text)
    || hasProtectedNumberSequence(value)
  );
}

function hasUnkindProposalTone(value: string) {
  const text = normalizeSafetyText(value);
  return /\b(stupid|idiot|dumb|worthless|shut up|go away|ridiculous|nonsense|liar|estupido|idiota|callate|tonto|basura|dumm|halt die klappe|laecherlich|lacherlich|luegner)\b/.test(text);
}

const copyByLanguage: Record<SocialLanguage, {
  back: string;
  safeStatus: string;
  statusLabel: string;
  refreshRoom: string;
  refreshingRoom: string;
  roomRefreshed: string;
  roomRefreshedWithUpdates: (count: number) => string;
  roomRefreshedWithVotes: (count: number) => string;
  roomRefreshedWithReplies: (count: number) => string;
  roomRefreshedWithPlanInterest: (count: number) => string;
  roomRefreshedWithComfort: (count: number) => string;
  roomRefreshFailed: string;
  readingComfortLabel: string;
  readingComfortOnLabel: string;
  readingComfortNote: string;
  readRoomAloud: string;
  readRoomAloudActive: string;
  readRoomAloudStarted: string;
  readRoomAloudStopped: string;
  readRoomAloudUnavailable: string;
  present: (count: number) => string;
  join: string;
  maybe: string;
  joined: string;
  maybeSaved: string;
  notForMe: string;
  notForMeSaved: string;
  clearPlanChoice: string;
  planChoiceCleared: string;
  planChoiceNoteTitle: string;
  planChoiceNoteBody: string;
  planNextStepTitle: string;
  planNextStepWaiting: string;
  planNextStepReady: string;
  planNextStepJoined: string;
  planNextStepMaybe: string;
  planNextStepNotForMe: string;
  planNextStepChecks: string[];
  planComfortCueTitle: string;
  planComfortCueKnown: (labels: string[]) => string;
  planComfortCueAsk: (labels: string[]) => string;
  planComfortCueReady: string;
  planComfortCueMore: (count: number) => string;
  planComfortCuePrivacy: string;
  planDetailCheckTitle: string;
  planDetailCheckBody: string;
  planDetailCheckItems: string[];
  planDetailCheckAction: string;
  planDetailCheckDraft: (planTitle: string) => string;
  roomChoice: string;
  pollClosed: string;
  youVoted: string;
  pollNudgeNoVotes: string;
  pollNudgeLeading: (label: string) => string;
  pollNudgeTie: (labels: string[]) => string;
  pollNudgeAction: string;
  pollVotes: (count: number) => string;
  pollYourChoice: string;
  clearVoteChoice: string;
  voteChoiceCleared: string;
  pollPassChoice: string;
  pollPassBody: string;
  pollPassSaved: string;
  pollPrivacyTitle: string;
  pollPrivacyBody: string;
  pollImpactTitle: string;
  pollImpactWaiting: string;
  pollImpactLeading: (label: string, needs: string[]) => string;
  pollImpactTie: (labels: string[]) => string;
  pollImpactViews: string;
  pollImpactNoVote: string;
  pollImpactYourVote: (label: string) => string;
  pollImpactSafety: string;
  pollSignalTitle: string;
  pollSignalBodies: Record<RoomVoteSignalKind, string>;
  pollSignalClearBody: (label: string) => string;
  pollSignalPrivacy: string;
  comfortCheckTitle: string;
  comfortCheckBody: string;
  comfortCheckCount: (count: number) => string;
  comfortSaved: string;
  comfortPrivacyTitle: string;
  comfortPrivacyBody: string;
  arrivalComfortTitle: string;
  arrivalComfortBody: string;
  arrivalComfortSaved: (label: string) => string;
  arrivalComfortRemoved: (label: string) => string;
  listenFirstAction: string;
  listenFirstSaved: string;
  listenFirstRemoved: string;
  roomDirectionTitle: string;
  roomDirectionWaiting: string;
  roomDirectionBody: (choice: string | null, needs: string[]) => string;
  roomDirectionTie: (labels: string[], needs: string[]) => string;
  roomDirectionAction: string;
  roomDirectionDraft: (choice: string | null, needs: string[]) => string;
  roomDirectionViewAction: string;
  roomDirectionViewDraft: string;
  roomRecapAction: string;
  roomRecapDraft: (choice: string | null, needs: string[]) => string;
  roomSummaryTitle: string;
  roomSummaryLabels: Record<"vote" | "comfort" | "interest" | "views" | "next", string>;
  roomSummaryVoteWaiting: string;
  roomSummaryVoteTie: (labels: string[]) => string;
  roomSummaryComfortWaiting: string;
  roomSummaryNextWaiting: string;
  roomSummaryNextReady: (choice: string | null, needs: string[]) => string;
  roomSummaryNextView: string;
  roomSummaryNextTie: string;
  roomCommonGroundTitle: string;
  roomCommonGroundBody: string;
  roomCommonGroundVote: string;
  roomCommonGroundComfortReady: (needs: string[]) => string;
  roomCommonGroundComfortWaiting: string;
  roomCommonGroundInterestReady: (count: number) => string;
  roomCommonGroundInterestWaiting: string;
  roomCommonGroundViewsReady: (count: number) => string;
  roomCommonGroundViewsWaiting: string;
  roomOutcomeTitle: string;
  roomOutcomeBody: (choice: string | null, needs: string[], context: RoomOutcomeContext) => string;
  roomOutcomeSteps: Record<RoomOutcomeStepId, string>;
  roomAtGlanceTitle: string;
  roomAtGlanceUpdatesClear: string;
  roomAtGlanceUpdates: (count: number) => string;
  roomAtGlanceVotes: (count: number) => string;
  roomAtGlancePlanInterest: (count: number) => string;
  roomAtGlanceComfort: (count: number) => string;
  mySafeChoicesTitle: string;
  mySafeChoicesBody: string;
  mySafeChoicesPrivate: string;
  privateNoteTitle: string;
  privateNotePlaceholder: string;
  privateNoteSave: string;
  privateNoteClear: string;
  privateNoteSaved: string;
  privateNoteCleared: string;
  privateNotePrivate: string;
  privateNoteLength: (remaining: number) => string;
  mySafeReviewsTitle: string;
  mySafeReviewsBody: string;
  mySafeReviewLabels: Record<MySafeReviewKind, string>;
  mySafeChoiceLabels: Record<MySafeChoiceId, string>;
  mySafeChoicePlanNone: string;
  mySafeChoicePlanJoin: string;
  mySafeChoicePlanMaybe: string;
  mySafeChoicePlanNotForMe: string;
  mySafeChoiceVoteNone: string;
  mySafeChoiceIssueVote: (question: string, choice: string) => string;
  mySafeChoiceComfortNone: string;
  mySafeChoiceHelpNone: string;
  mySafeChoiceHelp: (planTitle: string, helpers: string[]) => string;
  mySafeChoiceActionLabels: Record<MySafeChoiceActionId, string>;
  mySafePauseAction: string;
  mySafePauseActiveAction: string;
  mySafePauseStatus: string;
  mySafePauseFailed: string;
  mySafePauseNote: string;
  mySafePauseClearedForAction: string;
  mySafeLeaveAction: string;
  mySafeLeaveNote: string;
  roomTrustTitle: string;
  roomTrustBody: string;
  roomTrustItems: Record<RoomTrustItemId, string>;
  roomTrustAction: string;
  roomTrustDraft: string;
  roomTrustIntroAction: string;
  roomTrustIntroDraft: string;
  participationPathTitle: string;
  participationPathBody: string;
  participationPathLabels: Record<ParticipationPathId, string>;
  participationPathBodies: Record<ParticipationPathId, string>;
  participationPathActions: Record<ParticipationPathId, string>;
  participationPathPrivacy: string;
  nextGentleStepLabel: string;
  nextGentleSteps: Record<NextGentleStepId, NextGentleStepCopy>;
  nextGentleStepExplainAction: string;
  nextGentleStepExplainDraft: (stepTitle: string) => string;
  roomReadinessTitle: string;
  roomReadinessBody: string;
  roomReadinessLabels: Record<"vote" | "comfort" | "consent", string>;
  roomReadinessVoteReady: string;
  roomReadinessVoteWaiting: string;
  roomReadinessComfortReady: string;
  roomReadinessComfortWaiting: string;
  roomReadinessConsentReady: string;
  roomUsefulTitle: string;
  roomUsefulBody: string;
  roomUsefulLabels: Record<RoomUsefulStepId, string>;
  roomUsefulReady: Record<RoomUsefulStepId, string>;
  roomUsefulWaiting: Record<RoomUsefulStepId, string>;
  roomUsefulActions: Record<RoomUsefulStepId, string>;
  roomUsefulWaitingActions: Record<RoomUsefulStepId, string>;
  roomUsefulPrivacy: string;
  roomNotesTitle: string;
  roomNotesBody: string;
  roomNotesLabels: Record<RoomNoteId, string>;
  roomNotesVoteKnown: (label: string) => string;
  roomNotesVoteTie: (labels: string[]) => string;
  roomNotesVoteWaiting: string;
  roomNotesComfortKnown: (labels: string[]) => string;
  roomNotesComfortWaiting: string;
  roomNotesViewsKnown: (count: number) => string;
  roomNotesViewsWaiting: string;
  roomNotesOpenItems: Record<RoomNoteOpenItemId, string>;
  roomNotesOpenReady: string;
  roomNotesNextActivity: (planTitle: string) => string;
  roomNotesNextVote: (questionTitle: string) => string;
  roomNotesNextViews: (count: number) => string;
  roomNotesNextStarter: string;
  roomNotesNextActions: Record<RoomNotesNextActionId, string>;
  roomNotesCopyAction: string;
  roomNotesCopied: string;
  roomNotesCopyFailed: string;
  roomNotesPrivacy: string;
  responseNone: string;
  responseJoinCount: (count: number) => string;
  responseMaybeCount: (count: number) => string;
  responseNotForMeCount: (count: number) => string;
  morePlans: string;
  roomUpdates: string;
  roomUpdatesShowing: (visible: number, total: number) => string;
  roomUpdatesRecapTitle: string;
  roomUpdatesRecapBody: (count: number) => string;
  roomUpdatesRecapAction: string;
  roomUpdatesRecapDraft: (count: number) => string;
  markUpdateSeen: string;
  markAllUpdatesSeen: string;
  updateSeen: string;
  updateSeenFailed: string;
  allUpdatesSeen: string;
  allUpdatesSeenFailed: string;
  sharedToday: string;
  viewCircleTitle: string;
  viewCircleBody: string;
  viewCircleEmpty: string;
  viewCircleVote: (label: string, count: number) => string;
  viewCircleCount: (count: number) => string;
  viewCircleLatest: string;
  viewCircleAdd: string;
  viewRecapTitle: string;
  viewRecapBody: (count: number) => string;
  viewRecapAction: string;
  viewRecapDraft: (count: number) => string;
  viewVoteBridgeTitle: string;
  viewVoteBridgeBody: (count: number) => string;
  viewVoteBridgeAction: string;
  viewVoteBridgeDraft: (count: number) => string;
  viewBalanceTitle: string;
  viewBalanceBody: string;
  viewBalanceEmpty: string;
  viewBalanceLabels: Record<SocialRoomReplyTone, string>;
  viewCommonGroundTitle: string;
  viewCommonGroundOpening: string;
  viewCommonGroundAgreement: string;
  viewCommonGroundCurious: string;
  viewCommonGroundDifferent: string;
  viewCommonGroundMixed: string;
  viewCommonGroundPrivacy: string;
  viewSafetyTitle: string;
  viewSafetyBody: string;
  viewSafetyItems: Record<ViewSafetyItemId, string>;
  viewSafetyAction: string;
  viewSafetyDraft: string;
  viewNextReplyTitle: string;
  viewNextReplyBodies: Record<ViewNextReplyCueKind, string>;
  viewNextReplyActions: Record<ViewNextReplyCueKind, string>;
  viewNextReplyDrafts: Record<ViewNextReplyCueKind, string>;
  sharedResponseSaved: string;
  reviewItem: string;
  reviewItemSent: string;
  reviewItemStatusOpen: string;
  reviewItemStatusReviewing: string;
  reviewItemStatusResolved: string;
  reviewItemStatusDismissed: string;
  reviewReply: string;
  withdrawItem: string;
  withdrawItemSent: string;
  withdrawItemFailed: string;
  withdrawReply: string;
  withdrawReplySent: string;
  withdrawReplyFailed: string;
  gentleReplies: string;
  replyGuideTitle: string;
  replyGuideBody: string;
  planSupportTitle: string;
  planSupportBody: string;
  planSupportSummaryTitle: string;
  planSupportSummaryBody: string;
  planSupportSummaryEmpty: string;
  planHelperCueTitle: string;
  planHelperCueBody: (actionLabel: string) => string;
  planHelperCueCoveredTitle: string;
  planHelperCueCoveredBody: (labels: string[]) => string;
  planHelperCueAction: (actionLabel: string) => string;
  planHelperCuePrivate: string;
  planSupportRemoveAction: (actionLabel: string) => string;
  planSupportRemovePrivate: string;
  planSupportRemoved: string;
  planReadinessTitle: string;
  planReadinessBody: (readyCount: number, totalCount: number) => string;
  planReadinessInterestReady: (count: number) => string;
  planReadinessInterestWaiting: string;
  planReadinessHelperReady: (count: number) => string;
  planReadinessHelperWaiting: string;
  planReadinessComfortReady: string;
  planReadinessComfortWaiting: string;
  planReadinessVyvaReady: string;
  activityReadyTitle: string;
  activityReadyBody: (planTitle: string) => string;
  activityReadySignalsTitle: string;
  activityReadyPrivate: string;
  activityReadyPrepTitle: string;
  activityReadyPrepItems: string[];
  activityReadyAction: string;
  activityReadyDraft: (planTitle: string, signals: string[]) => string;
  voteReadyTitle: string;
  voteReadyBody: (questionTitle: string) => string;
  voteReadyPrivate: string;
  voteReadyAction: string;
  planSupportActions: Record<PlanCollaborationAction, string>;
  planSupportReplies: Record<PlanCollaborationAction, string>;
  replySent: string;
  replyFailed: string;
  replyActions: Record<SocialRoomReplyTone, string>;
  replyBodies: Record<SocialRoomReplyTone, string>;
  supportIdea: string;
  maybeIdea: string;
  sharedKindLabels: Record<SocialRoomPlanKind, string>;
  sharedViewLabel: string;
  sharedActions: Record<SocialRoomPlanKind, { primary: string; secondary: string }>;
  issueQueueTitle: string;
  issueQueueBody: string;
  issueQueueBadge: string;
  issueQueueAction: string;
  issueQueueDraft: (title: string) => string;
  issueQueueUseAction: string;
  issueQueueUseDraft: (title: string, signal: string | null) => string;
  issueQueuePrivacy: string;
  issueReadinessTitles: Record<"gathering" | "vote" | "summary", string>;
  issueReadinessBodies: Record<"gathering" | "vote", string> & { summary: (signal: string | null) => string };
  issuePollTitle: string;
  issuePollBody: string;
  issuePollClosed: string;
  issuePollPrivacy: string;
  issuePollOutcomeTitle: string;
  issuePollOutcomeBody: (label: string) => string;
  issuePollOutcomeTie: (labels: string[]) => string;
  issuePollOutcomeOtherViews: string;
  issuePollOutcomeOpen: string;
  proposalPlaceholder: string;
  proposalLengthHint: (remaining: number) => string;
  proposalSafetyWarning: string;
  proposalToneWarning: string;
  proposalToneRewrite: string;
  proposalToneRewriteDrafts: Record<SocialRoomPlanKind, string>;
  proposalCategoryPrompt: string;
  proposalPlacePrompt: string;
  proposalTimePrompt: string;
  proposalCostPrompt: string;
  proposalGroupPrompt: string;
  composerPreviewTitle: string;
  composerPreviewBodies: Record<SocialRoomPlanKind, string>;
  composerPreviewItems: Record<SocialRoomPlanKind, Record<ComposerPreviewItemId, string>>;
  safeShareTitle: string;
  safeShareBody: string;
  safeShareReviewLine: string;
  planNearby: string;
  planOnline: string;
  comfortPrompt: string;
  comfortNeedLabels: Record<SocialRoomComfortNeed, string>;
  moreComfortNotes: (count: number) => string;
  categoryLabels: Record<SocialRoomExperienceCategory, string>;
  timeLabels: Record<SocialRoomPreferredTime, string>;
  costLabels: Record<SocialRoomCostRange, string>;
  groupLabels: Record<SocialRoomGroupSize, string>;
  fitLabel: string;
  reviewBadge: string;
  reviewReasons: Record<SocialRoomSafetyFlag, string>;
  postFailed: string;
  send: string;
  cancel: string;
  sending: string;
  sent: string;
  reviewPending: string;
  helpSent: string;
  helpSending: string;
  helpFailed: string;
  safetyHelpTitle: string;
  safetyHelpBody: string;
  safetyHelpUrgentNote: string;
  safetyHelpChoiceLabels: Record<SafetyHelpChoice, string>;
  safetyHelpChoiceBodies: Record<SafetyHelpChoice, string>;
  safetyHelpChoiceReasons: Record<SafetyHelpChoice, string>;
  safetyHelpChoiceDetails: Record<SafetyHelpChoice, string>;
  safetyHelpReceiptTitle: string;
  safetyHelpReceiptBody: (choiceLabel: string) => string;
  safetyHelpReceiptItems: string[];
  viewSharingNote: string;
  viewTonePreviewTitle: string;
  viewTonePreviewReady: string;
  viewTonePreviewNeedsEdit: string;
  viewTonePreviewItems: Record<"kind" | "privacy" | "small", string>;
  viewPromptTitle: string;
  viewPromptBody: string;
  viewPromptLabels: Record<ViewPromptAction, string>;
  viewPromptDrafts: Record<ViewPromptAction, string>;
  askPromptTitle: string;
  askPromptBody: string;
  askPromptLabels: Record<AskPromptAction, string>;
  askPromptDrafts: Record<AskPromptAction, string>;
  issuePromptTitle: string;
  issuePromptBody: string;
  issuePromptLabels: Record<IssuePromptAction, string>;
  issuePromptDrafts: Record<IssuePromptAction, string>;
  sharePlanTitle: string;
  sharePlanBody: string;
  sharePlanAction: string;
  discussionTitle: string;
  discussionBody: string;
  starterLabels: Record<StarterAction, string>;
  agreementTitle: string;
  agreementLines: string[];
  acknowledgementLabel: string;
  acknowledgedLabel: string;
  acknowledgementFailed: string;
  starterDetails: Record<StarterAction, string>;
}> = {
  es: {
    back: "Volver",
    safeStatus: "Sala protegida",
    statusLabel: "Actualizacion de la sala",
    refreshRoom: "Revisar sala",
    refreshingRoom: "Revisando...",
    roomRefreshed: "Sala actualizada",
    roomRefreshedWithUpdates: (count) => `${count} ${count === 1 ? "novedad nueva" : "novedades nuevas"} en la sala`,
    roomRefreshedWithVotes: (count) => `${count} ${count === 1 ? "voto nuevo" : "votos nuevos"} en la sala`,
    roomRefreshedWithReplies: (count) => `${count} ${count === 1 ? "respuesta nueva" : "respuestas nuevas"} en la sala`,
    roomRefreshedWithPlanInterest: (count) => `${count} ${count === 1 ? "respuesta nueva a un plan" : "respuestas nuevas a planes"}`,
    roomRefreshedWithComfort: (count) => `${count} ${count === 1 ? "senal nueva de comodidad" : "senales nuevas de comodidad"}`,
    roomRefreshFailed: "No se pudo actualizar la sala. Intentalo de nuevo.",
    readingComfortLabel: "Texto grande",
    readingComfortOnLabel: "Texto grande activo",
    readingComfortNote: "El texto grande esta activo solo para ti en esta sala.",
    readRoomAloud: "Leer en voz alta",
    readRoomAloudActive: "Parar lectura",
    readRoomAloudStarted: "Leyendo la sala en privado",
    readRoomAloudStopped: "Lectura detenida",
    readRoomAloudUnavailable: "La lectura en voz alta no esta disponible en este navegador.",
    present: (count) => `${count} presentes`,
    join: "Me apunto",
    maybe: "Quizas luego",
    joined: "Te has apuntado",
    maybeSaved: "Guardado para luego",
    notForMe: "No es para mi",
    notForMeSaved: "Guardado en privado: no es para mi",
    clearPlanChoice: "Quitar mi eleccion",
    planChoiceCleared: "Tu eleccion se quito",
    planChoiceNoteTitle: "Sin presion",
    planChoiceNoteBody: "Apuntarte solo muestra interes, no compromiso. Quizas lo guarda. No es para mi queda privado y ayuda a VYVA a evitar presion.",
    planNextStepTitle: "Que pasa despues",
    planNextStepWaiting: "Cuando alguien muestre interes, VYVA ayudara a confirmar los detalles con calma.",
    planNextStepReady: "VYVA puede ayudar a confirmar los detalles antes de que nadie comparta contacto.",
    planNextStepJoined: "Has mostrado interes. VYVA ayudara a confirmar los detalles antes de compartir contacto.",
    planNextStepMaybe: "Guardado para luego. Puedes volver cuando los detalles esten claros.",
    planNextStepNotForMe: "No es para mi quedo privado. Puedes cambiar de idea despues.",
    planNextStepChecks: ["Hora", "Comodidad", "Contacto solo con permiso"],
    planComfortCueTitle: "Comodidad antes de apuntarte",
    planComfortCueKnown: (labels) => labels.length ? `Ya anotado: ${labels.join(", ")}.` : "Aun no hay notas de comodidad.",
    planComfortCueAsk: (labels) => `Pide a VYVA confirmar: ${labels.join(", ")}.`,
    planComfortCueReady: "Este plan ya nombra las comprobaciones principales de comodidad.",
    planComfortCueMore: (count) => `${count} ${count === 1 ? "comprobacion mas" : "comprobaciones mas"}`,
    planComfortCuePrivacy: "Apuntarte o elegir Quizas no comparte contacto privado.",
    planDetailCheckTitle: "Antes de quedar",
    planDetailCheckBody: "VYVA puede revisar los detalles practicos antes de que nadie se comprometa.",
    planDetailCheckItems: ["Lugar y hora claros", "Comodidad y coste", "Contacto solo con permiso"],
    planDetailCheckAction: "Revisar detalles",
    planDetailCheckDraft: (planTitle) => `VYVA, revisa "${planTitle}" antes de que nadie se comprometa. Confirma lugar, hora, comodidad, coste y contacto solo con permiso, sin nombres.`,
    roomChoice: "Eleccion de la sala",
    pollClosed: "La votacion esta cerrada",
    youVoted: "Tu voto esta guardado",
    pollNudgeNoVotes: "Tu voto ayuda a elegir el proximo paso.",
    pollNudgeLeading: (label) => `La sala se inclina por: ${label}.`,
    pollNudgeTie: (labels) => `La sala esta eligiendo entre: ${labels.join(" | ")}.`,
    pollNudgeAction: "Puedes apuntarte arriba o proponer una version mas tranquila.",
    pollVotes: (count) => `${count} ${count === 1 ? "voto" : "votos"}`,
    pollYourChoice: "Tu eleccion",
    clearVoteChoice: "Quitar mi voto",
    voteChoiceCleared: "Tu voto se quito",
    pollPassChoice: "Decidir luego",
    pollPassBody: "No se envia ningun voto. Puedes seguir leyendo.",
    pollPassSaved: "Puedes decidir luego. No se envio ningun voto.",
    pollPrivacyTitle: "Voto privado y flexible",
    pollPrivacyBody: "La sala solo ve los totales, no tu nombre. Puedes cambiar o quitar tu voto mientras este abierto.",
    pollImpactTitle: "Que hace tu voto",
    pollImpactWaiting: "Cada voto privado ayuda a la sala a elegir un siguiente paso tranquilo.",
    pollImpactLeading: (label, needs) => (
      needs.length
        ? `La sala se inclina por ${label}. VYVA lo preparara con ${needs.join(", ")}.`
        : `La sala se inclina por ${label}. VYVA lo convertira en un paso sencillo.`
    ),
    pollImpactTie: (labels) => `La sala esta dividida entre ${labels.join(" | ")}. VYVA puede resumir ambas opciones sin prisa.`,
    pollImpactViews: "La sala elige compartir opiniones. VYVA ayuda a que las respuestas sigan siendo amables.",
    pollImpactNoVote: "Aun no has votado. Puedes mirar primero.",
    pollImpactYourVote: (label) => `Tu voto: ${label}. Puedes cambiarlo o quitarlo mientras siga abierto.`,
    pollImpactSafety: "Solo se muestran totales. Los nombres no aparecen.",
    pollSignalTitle: "Senal de la sala",
    pollSignalBodies: {
      opening: "Aun no hay direccion. Mirar primero tambien esta bien.",
      close: "La votacion sigue cerca. Elige lo que te parezca bien, sin presion.",
      clear: "Ya hay una direccion clara, pero la votacion sigue abierta y privada.",
    },
    pollSignalClearBody: (label) => `${label} va por delante, pero puedes elegir otra cosa con calma.`,
    pollSignalPrivacy: "VYVA usa solo totales, no nombres.",
    comfortCheckTitle: "Que lo haria comodo?",
    comfortCheckBody: "Toca lo que ayuda. La sala puede adaptar los planes.",
    comfortCheckCount: (count) => `${count} ${count === 1 ? "lo eligio" : "lo eligieron"}`,
    comfortSaved: "Comodidad guardada",
    comfortPrivacyTitle: "Comodidad privada",
    comfortPrivacyBody: "La sala ve los totales, no tu nombre. Puedes cambiar lo que ayuda cuando quieras.",
    arrivalComfortTitle: "Empezar con calma",
    arrivalComfortBody: "Elige lo que te ayuda hoy. La sala ve totales, no nombres.",
    arrivalComfortSaved: (label) => `${label} guardado`,
    arrivalComfortRemoved: (label) => `${label} quitado`,
    listenFirstAction: "Escuchar primero",
    listenFirstSaved: "Escucha guardada",
    listenFirstRemoved: "Escucha quitada",
    roomDirectionTitle: "Paso suave de la sala",
    roomDirectionWaiting: "Cuando haya mas votos, VYVA podra sugerir un siguiente paso sencillo.",
    roomDirectionBody: (choice, needs) => {
      const base = choice ? `La sala se inclina por ${choice}.` : "La sala aun esta eligiendo.";
      return needs.length ? `${base} Preparadlo con ${needs.join(", ")}.` : base;
    },
    roomDirectionTie: (labels, needs) => {
      const base = `La sala aun esta eligiendo entre ${labels.join(" | ")}.`;
      return needs.length ? `${base} Preparadlo con ${needs.join(", ")}.` : base;
    },
    roomDirectionAction: "Crear plan tranquilo",
    roomDirectionDraft: (choice, needs) => {
      const base = `Una version tranquila de ${choice ?? "la eleccion de hoy"}`;
      return needs.length ? `${base} con ${needs.join(", ")}.` : `${base}.`;
    },
    roomDirectionViewAction: "Compartir opinion",
    roomDirectionViewDraft: "Me gustaria escuchar opiniones tranquilas sobre lo que importa hoy.",
    roomRecapAction: "Pedir resumen a VYVA",
    roomRecapDraft: (choice, needs) => {
      const base = choice ? `VYVA, resume la eleccion de la sala sobre ${choice}` : "VYVA, resume lo que esta pasando en la sala";
      return needs.length ? `${base} y las necesidades de comodidad: ${needs.join(", ")}.` : `${base}.`;
    },
    roomSummaryTitle: "Resumen de la sala",
    roomSummaryLabels: {
      vote: "Voto",
      comfort: "Comodidad",
      interest: "Interes",
      views: "Opiniones",
      next: "Siguiente",
    },
    roomSummaryVoteWaiting: "Aun abierto",
    roomSummaryVoteTie: (labels) => `Empate: ${labels.join(" | ")}`,
    roomSummaryComfortWaiting: "Esperando respuestas",
    roomSummaryNextWaiting: "Votar o compartir una idea pequena.",
    roomSummaryNextReady: (choice, needs) => {
      const parts = [choice, needs.length ? needs.join(" | ") : ""].filter(Boolean);
      return parts.length ? `Crear un plan tranquilo con ${parts.join(" | ")}.` : "Crear un plan tranquilo.";
    },
    roomSummaryNextView: "Compartir una opinion amable, sin presion.",
    roomSummaryNextTie: "Seguir votando o pedir a VYVA un resumen sencillo.",
    roomCommonGroundTitle: "Punto comun",
    roomCommonGroundBody: "Lo que la sala sabe ahora, sin exponer nombres.",
    roomCommonGroundVote: "Los votos son privados; solo se ven los totales.",
    roomCommonGroundComfortReady: (needs) => `Preparar con ${needs.join(" | ")}.`,
    roomCommonGroundComfortWaiting: "Puedes decir que ayuda antes de apuntarte.",
    roomCommonGroundInterestReady: (count) => `${count} ${count === 1 ? "persona muestra" : "personas muestran"} interes, sin compromiso.`,
    roomCommonGroundInterestWaiting: "El interes puede empezar con Quizas luego.",
    roomCommonGroundViewsReady: (count) => `${count} ${count === 1 ? "opinion compartida" : "opiniones compartidas"} con revision cerca.`,
    roomCommonGroundViewsWaiting: "Las opiniones pueden ser cortas y amables.",
    roomOutcomeTitle: "Lo que hara VYVA despues",
    roomOutcomeBody: (choice, needs, context) => {
      if (context === "tie") return `VYVA mantendra abiertas ${choice ?? "las opciones"} y hara un resumen sencillo antes de que nadie se sienta apurado.`;
      if (context === "views") return "VYVA mantendra las opiniones amables y traera los puntos principales como resumen sencillo.";
      if (context === "plan") {
        const base = `VYVA preparara ${choice ?? "la opcion principal"}`;
        return needs.length ? `${base} con ${needs.join(", ")} antes de que nadie se comprometa.` : `${base} antes de que nadie se comprometa.`;
      }
      if (context === "comfort") return `VYVA usara ${needs.join(", ")} para hacer mas facil el proximo plan.`;
      return "Cuando haya mas elecciones, VYVA las convertira en un siguiente paso tranquilo.";
    },
    roomOutcomeSteps: {
      private: "Usar totales privados, no nombres",
      shape: "Convertir elecciones en un paso claro",
      safety: "Mantener contacto y seguridad dentro de VYVA",
    },
    roomAtGlanceTitle: "Hoy en la sala",
    roomAtGlanceUpdatesClear: "Sin novedades nuevas",
    roomAtGlanceUpdates: (count) => `${count} ${count === 1 ? "novedad" : "novedades"}`,
    roomAtGlanceVotes: (count) => `${count} ${count === 1 ? "voto" : "votos"}`,
    roomAtGlancePlanInterest: (count) => `${count} ${count === 1 ? "persona interesada" : "personas interesadas"}`,
    roomAtGlanceComfort: (count) => `${count} ${count === 1 ? "senal de comodidad" : "senales de comodidad"}`,
    mySafeChoicesTitle: "Mis elecciones seguras",
    mySafeChoicesBody: "Un resumen privado de lo que has elegido hasta ahora.",
    mySafeChoicesPrivate: "La sala ve totales, no tu nombre.",
    privateNoteTitle: "Nota privada",
    privateNotePlaceholder: "Lo que quiero recordar...",
    privateNoteSave: "Guardar nota",
    privateNoteClear: "Borrar",
    privateNoteSaved: "Nota privada guardada",
    privateNoteCleared: "Nota privada borrada",
    privateNotePrivate: "Solo se guarda en este dispositivo.",
    privateNoteLength: (remaining) => `${remaining} caracteres restantes`,
    mySafeReviewsTitle: "Actualizaciones de revision VYVA",
    mySafeReviewsBody: "Solo tu ves estos estados. La sala no ve quien pidio ayuda.",
    mySafeReviewLabels: {
      shared: "Elemento compartido",
      reply: "Respuesta",
      poll: "Voto",
      room: "Sala",
    },
    mySafeChoiceLabels: {
      plan: "Actividad",
      vote: "Voto",
      comfort: "Comodidad",
      help: "Ayuda",
    },
    mySafeChoicePlanNone: "Aun sin elegir actividad",
    mySafeChoicePlanJoin: "Interes, no compromiso",
    mySafeChoicePlanMaybe: "Guardado para luego",
    mySafeChoicePlanNotForMe: "Paso privado",
    mySafeChoiceVoteNone: "Aun sin voto",
    mySafeChoiceIssueVote: (question, choice) => `${question}: ${choice}`,
    mySafeChoiceComfortNone: "Aun sin elegir comodidad",
    mySafeChoiceHelpNone: "Aun sin ofrecer ayuda",
    mySafeChoiceHelp: (planTitle, helpers) => `${planTitle}: ${helpers.join(" | ")}`,
    mySafeChoiceActionLabels: {
      comfort: "Anadir comodidad",
      vote: "Votar en privado",
      plan: "Elegir actividad",
    },
    mySafePauseAction: "Pausar en silencio",
    mySafePauseActiveAction: "Pausa activa",
    mySafePauseStatus: "Pausa tranquila activada. Nada se publica.",
    mySafePauseFailed: "No se pudo actualizar la pausa tranquila. Intentalo de nuevo.",
    mySafePauseNote: "Puedes seguir leyendo sin avisar a la sala.",
    mySafePauseClearedForAction: "La pausa tranquila se desactivo para poder enviar esto.",
    mySafeLeaveAction: "Salir en silencio",
    mySafeLeaveNote: "Nadie recibe aviso.",
    roomTrustTitle: "Seguro para entrar",
    roomTrustBody: "Tres recordatorios antes de participar. Puedes pedir a VYVA que lo revise en palabras sencillas.",
    roomTrustItems: {
      privacy: "Votos, comodidad y Quizas siguen sin nombre.",
      kindness: "Las opiniones deben ser amables; VYVA puede revisar algo incomodo.",
      contact: "El contacto privado queda dentro de VYVA hasta que ambas personas acepten.",
    },
    roomTrustAction: "Pedir revision tranquila",
    roomTrustDraft: "VYVA, puedes revisar si esta sala se siente segura para entrar hoy? Resume privacidad, amabilidad y seguridad de contacto en palabras sencillas, sin nombres.",
    roomTrustIntroAction: "Explicame la sala",
    roomTrustIntroDraft: "VYVA, explicame esta sala en un minuto: como votar, compartir una opinion, elegir una actividad y mantenerme seguro, sin nombres ni presion.",
    participationPathTitle: "Elige como entrar",
    participationPathBody: "Tres caminos sencillos para participar sin tener que leer toda la sala primero.",
    participationPathLabels: {
      vote: "Votar en privado",
      view: "Compartir opinion",
      activity: "Actividades para ti",
    },
    participationPathBodies: {
      vote: "Elige una opcion. La sala solo ve totales.",
      view: "Escribe una frase amable; VYVA revisa cerca.",
      activity: "Abre actividades recomendadas elegidas para tu perfil.",
    },
    participationPathActions: {
      vote: "Ir al voto",
      view: "Escribir opinion",
      activity: "Ver actividades",
    },
    participationPathPrivacy: "Puedes mirar primero. Ningun camino comparte contacto privado.",
    nextGentleStepLabel: "Siguiente toque amable",
    nextGentleSteps: {
      promise: {
        title: "Primero, mantener la sala segura",
        body: "Lee la promesa de sala. Ayuda a que opinar, votar y planear sea amable.",
        action: "Entendido",
      },
      updates: {
        title: "Hay algo nuevo",
        body: "Mira las novedades antes de responder. Asi puedes participar con calma.",
        action: "Ver novedades",
      },
      comfort: {
        title: "Empieza como quieras",
        body: "Puedes escuchar primero. La sala ve solo totales, no tu nombre.",
        action: "Escuchar primero",
      },
      vote: {
        title: "Ayuda a elegir",
        body: "Un voto privado ayuda a decidir el siguiente paso de la sala.",
        action: "Ver opciones",
      },
      plan: {
        title: "Guarda tu interes",
        body: "Puedes apuntarte o decir quizas. No es un compromiso.",
        action: "Ver plan",
      },
      recap: {
        title: "Pide un resumen",
        body: "VYVA puede ordenar votos, comodidad y planes en una nota sencilla.",
        action: "Pedir resumen",
      },
      hello: {
        title: "Empieza pequeno",
        body: "Un saludo amable basta para entrar sin presion.",
        action: "Saludar",
      },
    },
    nextGentleStepExplainAction: "Por que?",
    nextGentleStepExplainDraft: (stepTitle) => (
      `VYVA, no estoy seguro por donde empezar. Puedes explicar por que "${stepTitle}" es el siguiente toque seguro y darme una opcion sencilla, sin nombres ni presion?`
    ),
    roomReadinessTitle: "Antes de avanzar",
    roomReadinessBody: "VYVA mira estas tres cosas para que el siguiente paso sea claro y seguro.",
    roomReadinessLabels: {
      vote: "Voto",
      comfort: "Comodidad",
      consent: "Permiso",
    },
    roomReadinessVoteReady: "La sala tiene una opcion principal.",
    roomReadinessVoteWaiting: "Esperando algunos votos.",
    roomReadinessComfortReady: "Las necesidades de comodidad estan visibles.",
    roomReadinessComfortWaiting: "Esperando que alguien diga que ayuda.",
    roomReadinessConsentReady: "El contacto queda dentro de VYVA hasta que ambas personas acepten.",
    roomUsefulTitle: "Siguientes pasos utiles",
    roomUsefulBody: "VYVA muestra lo que ya puede ayudar a hacer, sin nombres ni presion.",
    roomUsefulLabels: {
      activity: "Actividad",
      vote: "Voto de tema",
      views: "Opiniones",
    },
    roomUsefulReady: {
      activity: "Listo para que VYVA prepare un siguiente paso seguro.",
      vote: "Una pregunta tiene apoyo y puede convertirse en voto privado.",
      views: "Hay opiniones para resumir con calma.",
    },
    roomUsefulWaiting: {
      activity: "Falta interes, comodidad o una pequena ayuda.",
      vote: "Aun espera que una pregunta reciba apoyo.",
      views: "Aun no hay opiniones compartidas para resumir.",
    },
    roomUsefulActions: {
      activity: "Preparar actividad",
      vote: "Hacer voto",
      views: "Resumir opiniones",
    },
    roomUsefulWaitingActions: {
      activity: "Ayudar actividad",
      vote: "Sugerir voto",
      views: "Compartir opinion",
    },
    roomUsefulPrivacy: "VYVA usa senales y totales, no nombres.",
    roomNotesTitle: "Notas de hoy",
    roomNotesBody: "Un resumen sencillo de lo que la sala ya sabe, para que nadie tenga que recordarlo todo.",
    roomNotesLabels: {
      known: "Ya se sabe",
      open: "Aun abierto",
      next: "Siguiente ayuda",
    },
    roomNotesVoteKnown: (label) => `Voto: ${label}.`,
    roomNotesVoteTie: (labels) => `Voto empatado: ${labels.join(" | ")}.`,
    roomNotesVoteWaiting: "Voto: aun abierto.",
    roomNotesComfortKnown: (labels) => `Comodidad: ${labels.join(" | ")}.`,
    roomNotesComfortWaiting: "Comodidad: esperando una senal.",
    roomNotesViewsKnown: (count) => `${count} ${count === 1 ? "opinion compartida" : "opiniones compartidas"}.`,
    roomNotesViewsWaiting: "Opiniones: aun ninguna.",
    roomNotesOpenItems: {
      vote: "Faltan algunas elecciones privadas.",
      comfort: "Falta decir que ayuda a estar comodo.",
      views: "Aun falta una opinion tranquila.",
      activity: "La actividad aun se esta formando.",
    },
    roomNotesOpenReady: "Nada urgente. La sala puede avanzar despacio.",
    roomNotesNextActivity: (title) => `VYVA puede preparar "${title}" como un paso seguro.`,
    roomNotesNextVote: (title) => `VYVA puede convertir "${title}" en un voto privado sencillo.`,
    roomNotesNextViews: (count) => `VYVA puede resumir ${count === 1 ? "esta opinion" : "estas opiniones"} sin nombres.`,
    roomNotesNextStarter: "Empezar con hola, una comodidad o un voto privado.",
    roomNotesNextActions: {
      activity: "Preparar paso",
      vote: "Hacer voto",
      views: "Resumir opiniones",
      starter: "Elegir inicio",
    },
    roomNotesCopyAction: "Copiar notas sin nombres",
    roomNotesCopied: "Notas sin nombres copiadas",
    roomNotesCopyFailed: "No se pudieron copiar las notas",
    roomNotesPrivacy: "Estas notas usan totales y senales, no nombres.",
    responseNone: "Puedes empezar eligiendo una opcion.",
    responseJoinCount: (count) => `${count} ${count === 1 ? "se apunta" : "se apuntan"}`,
    responseMaybeCount: (count) => `${count} quizas`,
    responseNotForMeCount: (count) => `${count} ${count === 1 ? "pasa" : "pasan"}`,
    morePlans: "Tambien podeis hacer",
    roomUpdates: "Novedades de la sala",
    roomUpdatesShowing: (visible, total) => `Mostrando ${visible} de ${total} novedades`,
    roomUpdatesRecapTitle: "Resumen sencillo de novedades",
    roomUpdatesRecapBody: (count) => `VYVA puede resumir ${count === 1 ? "esta novedad" : `estas ${count} novedades`} y decir el proximo paso seguro sin nombres.`,
    roomUpdatesRecapAction: "Pedir resumen",
    roomUpdatesRecapDraft: (count) => (
      count === 1
        ? "VYVA, resume esta novedad de la sala con palabras sencillas y dime el proximo paso seguro, sin nombres."
        : `VYVA, resume estas ${count} novedades de la sala con palabras sencillas y dime el proximo paso seguro, sin nombres.`
    ),
    markUpdateSeen: "Visto",
    markAllUpdatesSeen: "Marcar todo visto",
    updateSeen: "Novedad guardada como vista",
    updateSeenFailed: "No se pudo guardar como visto. Intentalo de nuevo.",
    allUpdatesSeen: "Novedades guardadas como vistas",
    allUpdatesSeenFailed: "No se pudo guardar todo como visto. Intentalo de nuevo.",
    sharedToday: "Compartido hoy",
    viewCircleTitle: "Circulo de opiniones",
    viewCircleBody: "Mira lo que se ha dicho y comparte una frase amable cuando quieras.",
    viewCircleEmpty: "Aun no hay opiniones compartidas. Una frase pequena basta.",
    viewCircleVote: (label, count) => `${label}: ${count} ${count === 1 ? "voto" : "votos"}`,
    viewCircleCount: (count) => `${count} ${count === 1 ? "opinion compartida" : "opiniones compartidas"}`,
    viewCircleLatest: "Ultimo en la sala",
    viewCircleAdd: "Anadir opinion",
    viewRecapTitle: "VYVA puede resumir las opiniones",
    viewRecapBody: (count) => (
      count === 1
        ? "Hay 1 opinion compartida. VYVA puede devolverla con palabras sencillas."
        : `Hay ${count} opiniones compartidas. VYVA puede agrupar los puntos principales sin mostrar nombres.`
    ),
    viewRecapAction: "Resumir opiniones",
    viewRecapDraft: (count) => (
      count === 1
        ? "VYVA, resume esta opinion compartida de forma amable y sencilla, sin mostrar nombres."
        : `VYVA, resume estas ${count} opiniones compartidas de forma amable y sencilla, sin mostrar nombres.`
    ),
    viewVoteBridgeTitle: "Convertir opiniones en voto",
    viewVoteBridgeBody: (count) => (
      count === 1
        ? "Si esta opinion necesita una decision, VYVA puede proponer un voto privado sencillo."
        : `Si estas ${count} opiniones muestran opciones distintas, VYVA puede convertirlas en un voto privado sencillo.`
    ),
    viewVoteBridgeAction: "Preparar voto privado",
    viewVoteBridgeDraft: (count) => (
      count === 1
        ? "VYVA, convierte esta opinion compartida en una votacion privada sencilla, con opciones seguras y sin nombres."
        : `VYVA, convierte estas ${count} opiniones compartidas en una votacion privada sencilla, con opciones seguras y sin nombres.`
    ),
    viewBalanceTitle: "Balance de la conversacion",
    viewBalanceBody: "Muestra como responde la sala para que opinar distinto siga siendo seguro.",
    viewBalanceEmpty: "Aun no hay respuestas.",
    viewBalanceLabels: {
      support: "Coinciden",
      curious: "Piden mas",
      different: "Otra mirada",
      help: "Ayuda ofrecida",
    },
    viewCommonGroundTitle: "Punto en comun",
    viewCommonGroundOpening: "La conversacion esta empezando. Una respuesta amable puede ayudar a encontrar el punto comun.",
    viewCommonGroundAgreement: "Ya aparece una senal compartida. VYVA puede mantenerla sencilla y sin prisa.",
    viewCommonGroundCurious: "La sala pide mas contexto antes de decidir. Eso tambien ayuda a elegir con calma.",
    viewCommonGroundDifferent: "Hay miradas distintas y se mantienen amables. VYVA puede resumirlas sin nombres.",
    viewCommonGroundMixed: "Hay varias senales a la vez. Un resumen de VYVA puede convertirlas en un paso claro.",
    viewCommonGroundPrivacy: "Las respuestas se resumen por tono, no por nombre.",
    viewSafetyTitle: "Desacuerdo seguro",
    viewSafetyBody: "Las opiniones distintas son bienvenidas si son breves, amables y sin datos privados.",
    viewSafetyItems: {
      kind: "Habla de la idea, no de la persona.",
      private: "No incluyas telefono, direccion, dinero ni contacto.",
      review: "Pide a VYVA que revise algo incomodo.",
    },
    viewSafetyAction: "Empezar con calma",
    viewSafetyDraft: "Lo veo de otra manera. Podemos comparar con calma, sin nombres?",
    viewNextReplyTitle: "Siguiente respuesta amable",
    viewNextReplyBodies: {
      opening: "Una pregunta pequena o un acuerdo puede ayudar a que todos se sientan escuchados.",
      agreement: "Anade una razon sencilla a la senal compartida.",
      curious: "Pide un detalle mas antes de que la sala elija.",
      different: "Una pregunta amable mantiene segura otra mirada.",
      mixed: "Cuando hay varias senales, pregunta que importa mas antes de decidir.",
    },
    viewNextReplyActions: {
      opening: "Invitar respuesta",
      agreement: "Anadir razon",
      curious: "Pedir detalle",
      different: "Preguntar con calma",
      mixed: "Preguntar que importa",
    },
    viewNextReplyDrafts: {
      opening: "Me gustaria escuchar que es lo mas importante para otras personas.",
      agreement: "Estoy de acuerdo, y una razon es...",
      curious: "Puedes contar un poco mas sobre lo que mas te importa?",
      different: "Lo veo de otra manera. Podemos comparar con calma lo que mas importa?",
      mixed: "Podemos parar un momento y decir que importa mas a cada persona antes de elegir?",
    },
    sharedResponseSaved: "Tu respuesta esta guardada",
    reviewItem: "Pedir revision a VYVA",
    reviewItemSent: "VYVA revisara esto con cuidado.",
    reviewItemStatusOpen: "Enviado a VYVA",
    reviewItemStatusReviewing: "VYVA lo revisa",
    reviewItemStatusResolved: "VYVA ya lo reviso",
    reviewItemStatusDismissed: "VYVA lo comprobo",
    reviewReply: "Revisar respuesta",
    withdrawItem: "Quitar mi aportacion",
    withdrawItemSent: "Tu aportacion se quito de la sala",
    withdrawItemFailed: "No se pudo quitar. Intentalo de nuevo.",
    withdrawReply: "Quitar mi respuesta",
    withdrawReplySent: "Tu respuesta se quito de la sala",
    withdrawReplyFailed: "No se pudo quitar la respuesta. Intentalo de nuevo.",
    gentleReplies: "Respuestas amables",
    replyGuideTitle: "Respuestas seguras",
    replyGuideBody: "Usa un boton amable. Si una respuesta incomoda, VYVA puede revisarla.",
    planSupportTitle: "Hacerlo facil",
    planSupportBody: "Elige una ayuda pequena para que el plan sea mas comodo para todos.",
    planSupportSummaryTitle: "Ayudas para la actividad",
    planSupportSummaryBody: "Estas son las pequenas formas en que la sala ayuda a que el plan ocurra.",
    planSupportSummaryEmpty: "Aun no hay ayudas. Elige abajo una forma pequena de ayudar.",
    planHelperCueTitle: "Mejor ayuda pequena",
    planHelperCueBody: (actionLabel) => `La ayuda mas util ahora es ${actionLabel}. Da a VYVA una senal practica sin comprometer a nadie.`,
    planHelperCueCoveredTitle: "Ayudas cubiertas",
    planHelperCueCoveredBody: (labels) => `Ya esta cubierto: ${labels.join(", ")}. Otra ayuda es opcional.`,
    planHelperCueAction: (actionLabel) => `Elegir ${actionLabel}`,
    planHelperCuePrivate: "Esto solo publica una senal de ayuda, no contacto privado.",
    planSupportRemoveAction: (actionLabel) => `Quitar ${actionLabel}`,
    planSupportRemovePrivate: "Esto quita solo tu senal de ayuda.",
    planSupportRemoved: "Senal de ayuda quitada",
    planReadinessTitle: "Listo para avanzar",
    planReadinessBody: (ready, total) => `${ready} de ${total} senales estan listas. VYVA espera lo que falte sin presion.`,
    planReadinessInterestReady: (count) => `${count} ${count === 1 ? "persona muestra" : "personas muestran"} interes.`,
    planReadinessInterestWaiting: "Esperando interes: Me apunto o Quizas luego.",
    planReadinessHelperReady: (count) => `${count} ${count === 1 ? "ayuda pequena esta" : "ayudas pequenas estan"} ofrecida${count === 1 ? "" : "s"}.`,
    planReadinessHelperWaiting: "Falta una ayuda pequena para hacerlo mas facil.",
    planReadinessComfortReady: "La comodidad ya esta nombrada.",
    planReadinessComfortWaiting: "Falta decir que haria esto comodo.",
    planReadinessVyvaReady: "VYVA confirma detalles antes de cualquier contacto.",
    activityReadyTitle: "VYVA puede prepararlo",
    activityReadyBody: (planTitle) => `"${planTitle}" ya tiene interes, comodidad y una ayuda pequena. VYVA puede confirmar los detalles antes de que nadie se comprometa.`,
    activityReadySignalsTitle: "Senales sin nombres",
    activityReadyPrivate: "Privado y sin presion",
    activityReadyPrepTitle: "Antes de que VYVA lo prepare",
    activityReadyPrepItems: [
      "Confirmar lugar, hora, coste y acceso.",
      "Mantener el contacto dentro de VYVA hasta que ambas personas acepten.",
      "Volver con un paso sencillo, no un compromiso.",
    ],
    activityReadyAction: "Pedir a VYVA el siguiente paso",
    activityReadyDraft: (planTitle, signals) => (
      signals.length
        ? `VYVA, "${planTitle}" ya parece lista. Senales de la sala: ${signals.join("; ")}. Puedes preparar el siguiente paso sencillo y seguro?`
        : `VYVA, "${planTitle}" ya parece lista. Puedes preparar el siguiente paso sencillo y seguro para la sala?`
    ),
    voteReadyTitle: "Esta pregunta esta lista",
    voteReadyBody: (questionTitle) => `"${questionTitle}" recibe apoyo. VYVA puede convertirla en una votacion privada sencilla, sin nombres.`,
    voteReadyPrivate: "Sin nombres visibles",
    voteReadyAction: "Pedir a VYVA la votacion",
    planSupportActions: {
      choose: "Ayudar a elegir",
      pace: "Ritmo tranquilo",
      buddy: "Quedar juntos",
      notify: "Avisadme",
    },
    planSupportReplies: {
      choose: "Puedo ayudar a elegir una opcion sencilla para el grupo.",
      pace: "Un ritmo tranquilo, con pausas, me ayudaria.",
      buddy: "Me ayudaria quedar con alguien antes de entrar.",
      notify: "Por favor avisadme cuando haya un siguiente paso.",
    },
    replySent: "Respuesta compartida",
    replyFailed: "No se pudo responder. Intentalo de nuevo.",
    replyActions: {
      support: "Yo tambien",
      curious: "Cuantame mas",
      help: "Puedo ayudar",
      different: "Lo veo distinto",
    },
    replyBodies: {
      support: "Yo tambien lo siento asi. Gracias por compartirlo.",
      curious: "Me gustaria saber un poco mas, si te apetece compartirlo.",
      help: "Puedo ayudar con un paso sencillo dentro de la sala.",
      different: "Lo veo un poco distinto, pero agradezco que lo compartas.",
    },
    supportIdea: "Me apunto",
    maybeIdea: "Quizas",
    sharedKindLabels: {
      plan: "Plan",
      message: "Saludo",
      question: "Pregunta",
    },
    sharedViewLabel: "Opinion",
    sharedActions: {
      plan: { primary: "Me apunto", secondary: "Quizas" },
      message: { primary: "Yo tambien", secondary: "Gracias" },
      question: { primary: "Ayudame tambien", secondary: "Seguir" },
    },
    issueQueueTitle: "Preguntas para votar despues",
    issueQueueBody: "Cuando alguien pide aclarar un tema, VYVA lo guarda aqui para que la sala pueda apoyarlo sin presion.",
    issueQueueBadge: "Posible votacion",
    issueQueueAction: "Convertir en voto",
    issueQueueDraft: (title) => `VYVA, convierte "${title}" en una votacion sencilla para la sala, con opciones seguras y sin nombres.`,
    issueQueueUseAction: "Resumir este voto",
    issueQueueUseDraft: (title, signal) => (
      signal
        ? `VYVA, resume el voto privado sobre "${title}". La senal actual es: ${signal}. Ayuda a la sala a elegir un siguiente paso seguro, sin nombres.`
        : `VYVA, resume el voto privado sobre "${title}" y ayuda a la sala a elegir un siguiente paso seguro, sin nombres.`
    ),
    issueQueuePrivacy: "Apoyar una pregunta solo muestra interes. La sala no ve tu nombre.",
    issueReadinessTitles: {
      gathering: "Recogiendo apoyo",
      vote: "Lista para votar",
      summary: "Lista para resumir",
    },
    issueReadinessBodies: {
      gathering: "Toca Ayudame tambien o Seguir si esta pregunta te importa.",
      vote: "Ya hay interes. VYVA puede convertirlo en un voto privado, sin nombres.",
      summary: (signal) => (
        signal
          ? `La senal es: ${signal}. VYVA puede resumirla y proponer un siguiente paso seguro.`
          : "VYVA puede resumir el voto privado y proponer un siguiente paso seguro."
      ),
    },
    issuePollTitle: "Voto sencillo",
    issuePollBody: "Elige una opcion. Puedes cambiarla o quitarla mientras el voto este abierto.",
    issuePollClosed: "VYVA pauso este voto para revisarlo. Los totales siguen visibles, pero no se aceptan votos nuevos.",
    issuePollPrivacy: "Este voto tambien es privado. Solo se muestran totales.",
    issuePollOutcomeTitle: "Senal de la sala",
    issuePollOutcomeBody: (label) => `Por ahora la sala se inclina por: ${label}. VYVA puede usarlo sin mostrar nombres.`,
    issuePollOutcomeTie: (labels) => `La sala esta dividida entre ${labels.join(" | ")}. VYVA puede resumirlo sin prisa.`,
    issuePollOutcomeOtherViews: "Las otras opciones tambien cuentan. VYVA puede incluirlas sin nombres.",
    issuePollOutcomeOpen: "Aun se puede elegir otra opcion mientras el voto este abierto.",
    proposalPlaceholder: "Escribe una idea pequena...",
    proposalLengthHint: (remaining) => `${remaining} caracteres disponibles`,
    proposalSafetyWarning: "Quita telefono, email, direccion o datos de pago antes de enviar.",
    proposalToneWarning: "Usa palabras amables antes de enviar. VYVA puede ayudar a reescribirlo.",
    proposalToneRewrite: "Suavizar palabras",
    proposalToneRewriteDrafts: {
      plan: "Podemos hacerlo tranquilo y facil para todos.",
      message: "Lo veo de otra manera porque...",
      question: "Podemos pensarlo juntos con calma?",
    },
    proposalCategoryPrompt: "Que tipo de experiencia?",
    proposalPlacePrompt: "Donde os iria mejor?",
    proposalTimePrompt: "Cuando va mejor?",
    proposalCostPrompt: "Coste",
    proposalGroupPrompt: "Como participar?",
    composerPreviewTitle: "Antes de enviar",
    composerPreviewBodies: {
      plan: "Esta idea se comparte como plan para que otros puedan apuntarse o decir Quizas.",
      message: "Esta nota se comparte como una opinion corta, con respuestas amables cerca.",
      question: "Esta pregunta se comparte para que VYVA pueda ayudar o convertirla en voto.",
    },
    composerPreviewItems: {
      plan: {
        shared: "La sala ve el plan, no tus elecciones privadas.",
        private: "Votos, comodidad y Quizas siguen sin nombre.",
        next: "VYVA revisa coste, contacto, transporte o servicio antes de avanzar.",
      },
      message: {
        shared: "La sala ve la frase y puede responder con botones amables.",
        private: "No incluyas telefono, email ni direccion.",
        next: "Si algo suena duro, VYVA puede suavizarlo antes.",
      },
      question: {
        shared: "La sala ve la pregunta, no quien necesita ayuda.",
        private: "Tu voto y tus necesidades siguen privados.",
        next: "VYVA puede convertirlo en un voto simple con totales.",
      },
    },
    safeShareTitle: "Compartir con cuidado",
    safeShareBody: "No pongas telefono, email, direccion exacta ni pagos en la nota.",
    safeShareReviewLine: "Si hay coste, transporte, casa o servicio, VYVA lo revisa antes de avanzar.",
    planNearby: "Cerca",
    planOnline: "En linea",
    comfortPrompt: "Que ayuda?",
    comfortNeedLabels: {
      listen_first: "Escuchar primero",
      quiet_pace: "Ritmo tranquilo",
      easy_access: "Acceso facil",
      seating: "Sentarse",
      transport_help: "Ayuda para llegar",
      arrival_buddy: "Quedar juntos",
      clear_cost: "Saber coste antes",
    },
    moreComfortNotes: (count) => `${count} ${count === 1 ? "apoyo mas" : "apoyos mas"}`,
    categoryLabels: {
      movie_date: "Cita de pelicula",
      restaurant_date: "Restaurante",
      home_share: "Casa o alquiler",
      service_booking: "Reservar servicio",
      deal_help: "Negociar trato",
      outing: "Salida",
      other: "Otra idea",
    },
    timeLabels: {
      morning: "Manana",
      afternoon: "Tarde",
      evening: "Noche",
      flexible: "Flexible",
    },
    costLabels: {
      free: "Gratis",
      low: "Bajo",
      shared: "Compartido",
      discuss: "Aclarar antes",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Grupo pequeno",
      open_room: "Sala abierta",
    },
    fitLabel: "Encaja por",
    reviewBadge: "VYVA lo revisa antes de avanzar",
    reviewReasons: {
      money: "dinero",
      housing: "casa",
      service: "servicio",
      private_contact: "contacto",
      transport: "transporte",
      unkind_tone: "tono",
    },
    postFailed: "No se pudo publicar. Intentalo de nuevo.",
    send: "Enviar",
    cancel: "Cancelar",
    sending: "Enviando...",
    sent: "Enviado",
    reviewPending: "VYVA lo revisara antes de que aparezca.",
    helpSent: "VYVA revisara esto con cuidado.",
    helpSending: "Avisando a VYVA...",
    helpFailed: "No se pudo avisar a VYVA. Intentalo de nuevo.",
    safetyHelpTitle: "Que necesita revisar VYVA?",
    safetyHelpBody: "Elige lo mas parecido. La sala no ve esta ayuda.",
    safetyHelpUrgentNote:
      "Si algo urgente ocurre ahora, usa la ayuda local de emergencia. VYVA no sustituye la ayuda inmediata.",
    safetyHelpChoiceLabels: {
      uncomfortable: "Me incomoda",
      pressure_contact: "Presion o contacto",
      money_service: "Dinero o servicio",
      something_else: "Otra cosa",
    },
    safetyHelpChoiceBodies: {
      uncomfortable: "Algo en la sala no se siente bien.",
      pressure_contact: "Alguien pide contacto privado o insiste.",
      money_service: "Hay coste, pago, oferta o servicio que revisar.",
      something_else: "Quiero que VYVA mire la sala.",
    },
    safetyHelpChoiceReasons: {
      uncomfortable: "feels_uncomfortable",
      pressure_contact: "pressure_or_contact",
      money_service: "money_or_service",
      something_else: "other_safety_help",
    },
    safetyHelpChoiceDetails: {
      uncomfortable: "La persona usuaria indica que algo en Together Room le incomoda.",
      pressure_contact: "La persona usuaria quiere que VYVA revise posible presion o contacto privado.",
      money_service: "La persona usuaria quiere que VYVA revise dinero, coste, oferta o servicio.",
      something_else: "La persona usuaria quiere ayuda general de seguridad en Together Room.",
    },
    safetyHelpReceiptTitle: "Ayuda enviada",
    safetyHelpReceiptBody: (choiceLabel) => `VYVA revisara: ${choiceLabel}. La sala no ve esta peticion.`,
    safetyHelpReceiptItems: [
      "VYVA revisa sin mostrar tu nombre.",
      "Puedes pausar la sala y volver despues.",
      "Si algo urgente ocurre ahora, usa la ayuda local de emergencia.",
    ],
    viewSharingNote: "Puedes compartir una opinion breve con palabras amables y sin datos personales.",
    viewTonePreviewTitle: "Vista segura",
    viewTonePreviewReady: "Lista para compartir con calma",
    viewTonePreviewNeedsEdit: "Necesita un pequeno ajuste",
    viewTonePreviewItems: {
      kind: "Palabras amables",
      privacy: "Sin contacto privado",
      small: "Una idea pequena",
    },
    viewPromptTitle: "Ideas para opinar",
    viewPromptBody: "Elige una frase si las palabras no salen facil.",
    viewPromptLabels: {
      agree: "Estoy de acuerdo",
      different: "Otra mirada",
      compare: "Comparar opciones",
      more_info: "Mas informacion",
    },
    viewPromptDrafts: {
      agree: "Estoy de acuerdo porque...",
      different: "Lo veo de otra manera porque...",
      compare: "VYVA, ayudanos a comparar las opciones con calma.",
      more_info: "Necesito un poco mas de informacion antes de elegir.",
    },
    askPromptTitle: "Preguntas faciles para VYVA",
    askPromptBody: "Elige una si no sabes como preguntar.",
    askPromptLabels: {
      summary: "Resumen",
      easier: "Mas facil",
      vote: "Proponer voto",
      safe: "Es seguro?",
    },
    askPromptDrafts: {
      summary: "VYVA, puedes resumir lo que la sala esta eligiendo?",
      easier: "VYVA, ayudame a encontrar la forma mas facil de participar.",
      vote: "VYVA, puedes convertir esta pregunta en un voto sencillo para la sala?",
      safe: "VYVA, puedes revisar si esto parece seguro y sin presion?",
    },
    issuePromptTitle: "Convertir una duda en voto",
    issuePromptBody: "Elige un tema comun si quieres que VYVA proponga una votacion sencilla para la sala.",
    issuePromptLabels: {
      place: "Lugar",
      time: "Hora",
      cost: "Coste",
      safety: "Seguridad",
    },
    issuePromptDrafts: {
      place: "VYVA, puedes proponer un voto sencillo sobre que lugar seria mas comodo para la sala?",
      time: "VYVA, puedes proponer un voto sencillo sobre que hora iria mejor?",
      cost: "VYVA, puedes proponer un voto sencillo para aclarar el coste antes de que nadie se comprometa?",
      safety: "VYVA, puedes proponer un voto sencillo sobre que haria esto mas seguro y sin presion?",
    },
    sharePlanTitle: "Compartir un plan",
    sharePlanBody: "Propón una idea sencilla para que otras personas puedan apuntarse o decir quizá.",
    sharePlanAction: "Compartir un plan",
    discussionTitle: "Que te gustaria decir?",
    discussionBody: "Puedes empezar poco a poco. VYVA ayuda si no sabes como.",
    starterLabels: {
      hello: "Saludar",
      plan: "Sugerir plan",
      ask: "Preguntar a VYVA",
    },
    agreementTitle: "Nuestra promesa de sala",
    agreementLines: [
      "Palabras amables y sin presion.",
      "Compartimos opiniones sin juzgar.",
      "Pide ayuda a VYVA si algo incomoda.",
    ],
    acknowledgementLabel: "Lo entiendo",
    acknowledgedLabel: "Promesa de sala guardada",
    acknowledgementFailed: "No se pudo guardar. Intentalo de nuevo.",
    starterDetails: {
      hello: "Me gustaria saludar y escuchar lo que piensan otras personas.",
      plan: "Me gustaria compartir un plan tranquilo.",
      ask: "VYVA, ayudame a participar de forma sencilla.",
    },
  },
  de: {
    back: "Zurueck",
    safeStatus: "Geschuetzter Raum",
    statusLabel: "Raumhinweis",
    refreshRoom: "Raum pruefen",
    refreshingRoom: "Wird geprueft...",
    roomRefreshed: "Raum aktualisiert",
    roomRefreshedWithUpdates: (count) => `${count} ${count === 1 ? "neues Raum-Update ist" : "neue Raum-Updates sind"} bereit`,
    roomRefreshedWithVotes: (count) => `${count} ${count === 1 ? "neue Stimme ist" : "neue Stimmen sind"} da`,
    roomRefreshedWithReplies: (count) => `${count} ${count === 1 ? "neue Antwort ist" : "neue Antworten sind"} da`,
    roomRefreshedWithPlanInterest: (count) => `${count} ${count === 1 ? "neue Planantwort ist" : "neue Planantworten sind"} da`,
    roomRefreshedWithComfort: (count) => `${count} ${count === 1 ? "neues Komfortsignal ist" : "neue Komfortsignale sind"} da`,
    roomRefreshFailed: "Raum konnte nicht aktualisiert werden. Bitte versuche es erneut.",
    readingComfortLabel: "Grosser Text",
    readingComfortOnLabel: "Grosser Text an",
    readingComfortNote: "Grosser Text ist nur fuer dich in diesem Raum aktiv.",
    readRoomAloud: "Vorlesen",
    readRoomAloudActive: "Vorlesen stoppen",
    readRoomAloudStarted: "Der Raum wird privat vorgelesen",
    readRoomAloudStopped: "Vorlesen gestoppt",
    readRoomAloudUnavailable: "Vorlesen ist in diesem Browser nicht verfuegbar.",
    present: (count) => `${count} anwesend`,
    join: "Mitmachen",
    maybe: "Vielleicht spaeter",
    joined: "Du bist dabei",
    maybeSaved: "Fuer spaeter gemerkt",
    notForMe: "Nicht fuer mich",
    notForMeSaved: "Privat gemerkt: nicht fuer mich",
    clearPlanChoice: "Meine Wahl entfernen",
    planChoiceCleared: "Deine Wahl wurde entfernt",
    planChoiceNoteTitle: "Ohne Druck",
    planChoiceNoteBody: "Mitmachen zeigt Interesse, keine feste Zusage. Vielleicht merkt es. Nicht fuer mich bleibt privat und hilft VYVA, Druck zu vermeiden.",
    planNextStepTitle: "Was danach passiert",
    planNextStepWaiting: "Wenn jemand Interesse zeigt, hilft VYVA, die Details ruhig zu klaeren.",
    planNextStepReady: "VYVA kann helfen, Details zu klaeren, bevor Kontakt geteilt wird.",
    planNextStepJoined: "Du hast Interesse gezeigt. VYVA hilft, Details zu klaeren, bevor Kontakt geteilt wird.",
    planNextStepMaybe: "Fuer spaeter gemerkt. Du kannst zurueckkommen, wenn die Details klar sind.",
    planNextStepNotForMe: "Nicht fuer mich blieb privat. Du kannst spaeter anders waehlen.",
    planNextStepChecks: ["Zeit", "Komfort", "Kontakt nur mit Zustimmung"],
    planComfortCueTitle: "Komfort vor dem Mitmachen",
    planComfortCueKnown: (labels) => labels.length ? `Schon notiert: ${labels.join(", ")}.` : "Noch keine Komfortnotizen.",
    planComfortCueAsk: (labels) => `VYVA kann klaeren: ${labels.join(", ")}.`,
    planComfortCueReady: "Dieser Plan nennt schon die wichtigsten Komfortpunkte.",
    planComfortCueMore: (count) => `${count} ${count === 1 ? "weiterer Punkt" : "weitere Punkte"}`,
    planComfortCuePrivacy: "Mitmachen oder Vielleicht teilt keinen privaten Kontakt.",
    planDetailCheckTitle: "Vor dem Treffen",
    planDetailCheckBody: "VYVA kann praktische Details pruefen, bevor sich jemand festlegt.",
    planDetailCheckItems: ["Klarer Ort und Zeit", "Komfort und Kosten", "Kontakt nur mit Zustimmung"],
    planDetailCheckAction: "Details pruefen",
    planDetailCheckDraft: (planTitle) => `VYVA, pruefe "${planTitle}", bevor sich jemand festlegt. Bitte klaere Ort, Zeit, Komfort, Kosten und Kontakt nur mit Zustimmung, ohne Namen.`,
    roomChoice: "Raumwahl",
    pollClosed: "Die Abstimmung ist geschlossen",
    youVoted: "Deine Stimme ist gespeichert",
    pollNudgeNoVotes: "Deine Stimme hilft, den naechsten Schritt zu waehlen.",
    pollNudgeLeading: (label) => `Der Raum tendiert zu: ${label}.`,
    pollNudgeTie: (labels) => `Der Raum waehlt noch zwischen: ${labels.join(" | ")}.`,
    pollNudgeAction: "Du kannst oben mitmachen oder eine ruhigere Version vorschlagen.",
    pollVotes: (count) => `${count} ${count === 1 ? "Stimme" : "Stimmen"}`,
    pollYourChoice: "Deine Wahl",
    clearVoteChoice: "Meine Stimme entfernen",
    voteChoiceCleared: "Deine Stimme wurde entfernt",
    pollPassChoice: "Spaeter entscheiden",
    pollPassBody: "Es wird keine Stimme gesendet. Du kannst weiter lesen.",
    pollPassSaved: "Du kannst spaeter entscheiden. Es wurde keine Stimme gesendet.",
    pollPrivacyTitle: "Private, flexible Stimme",
    pollPrivacyBody: "Der Raum sieht nur Summen, nicht deinen Namen. Du kannst deine Stimme aendern oder entfernen, solange die Abstimmung offen ist.",
    pollImpactTitle: "Was deine Stimme bewirkt",
    pollImpactWaiting: "Jede private Stimme hilft dem Raum, einen ruhigen naechsten Schritt zu waehlen.",
    pollImpactLeading: (label, needs) => (
      needs.length
        ? `Der Raum tendiert zu ${label}. VYVA bereitet es mit ${needs.join(", ")} vor.`
        : `Der Raum tendiert zu ${label}. VYVA macht daraus einen einfachen Schritt.`
    ),
    pollImpactTie: (labels) => `Der Raum ist zwischen ${labels.join(" | ")} geteilt. VYVA kann beide Optionen ohne Eile zusammenfassen.`,
    pollImpactViews: "Der Raum entscheidet sich fuer Ansichten. VYVA hilft, dass Antworten freundlich bleiben.",
    pollImpactNoVote: "Du hast noch nicht abgestimmt. Du kannst erst schauen.",
    pollImpactYourVote: (label) => `Deine Stimme: ${label}. Du kannst sie aendern oder entfernen, solange offen ist.`,
    pollImpactSafety: "Sichtbar sind nur Summen. Namen erscheinen nicht.",
    pollSignalTitle: "Raumsignal",
    pollSignalBodies: {
      opening: "Noch keine Richtung. Erst schauen ist auch in Ordnung.",
      close: "Die Abstimmung ist noch knapp. Waehle ohne Druck, was fuer dich stimmt.",
      clear: "Eine klare Richtung entsteht, aber die Abstimmung bleibt offen und privat.",
    },
    pollSignalClearBody: (label) => `${label} liegt vorn, aber du kannst ruhig anders waehlen.`,
    pollSignalPrivacy: "VYVA nutzt nur Summen, keine Namen.",
    comfortCheckTitle: "Was macht es angenehm?",
    comfortCheckBody: "Tippe an, was dir hilft. Die Gruppe kann Plaene daran ausrichten.",
    comfortCheckCount: (count) => `${count} ${count === 1 ? "ausgewaehlt" : "ausgewaehlt"}`,
    comfortSaved: "Komfort gespeichert",
    comfortPrivacyTitle: "Private Komfortwahl",
    comfortPrivacyBody: "Der Raum sieht Summen, nicht deinen Namen. Du kannst jederzeit aendern, was hilft.",
    arrivalComfortTitle: "Ruhig starten",
    arrivalComfortBody: "Waehle, was dir heute hilft. Der Raum sieht Summen, nicht Namen.",
    arrivalComfortSaved: (label) => `${label} gespeichert`,
    arrivalComfortRemoved: (label) => `${label} entfernt`,
    listenFirstAction: "Erst zuhoeren",
    listenFirstSaved: "Zuhoeren gespeichert",
    listenFirstRemoved: "Zuhoeren entfernt",
    roomDirectionTitle: "Sanfter naechster Schritt",
    roomDirectionWaiting: "Wenn mehr Stimmen da sind, kann VYVA einen einfachen naechsten Schritt vorschlagen.",
    roomDirectionBody: (choice, needs) => {
      const base = choice ? `Der Raum tendiert zu ${choice}.` : "Der Raum waehlt noch.";
      return needs.length ? `${base} Plant es mit ${needs.join(", ")}.` : base;
    },
    roomDirectionTie: (labels, needs) => {
      const base = `Der Raum waehlt noch zwischen ${labels.join(" | ")}.`;
      return needs.length ? `${base} Plant es mit ${needs.join(", ")}.` : base;
    },
    roomDirectionAction: "Als Plan vorschlagen",
    roomDirectionDraft: (choice, needs) => {
      const base = `Eine ruhige Version von ${choice ?? "der heutigen Raumwahl"}`;
      return needs.length ? `${base} mit ${needs.join(", ")}.` : `${base}.`;
    },
    roomDirectionViewAction: "Ansicht teilen",
    roomDirectionViewDraft: "Ich moechte ruhige Ansichten dazu hoeren, was heute wichtig ist.",
    roomRecapAction: "VYVA um Zusammenfassung bitten",
    roomRecapDraft: (choice, needs) => {
      const base = choice ? `VYVA, fasse die Raumwahl zu ${choice} zusammen` : "VYVA, fasse zusammen, was gerade im Raum passiert";
      return needs.length ? `${base} und die Komfortwuensche: ${needs.join(", ")}.` : `${base}.`;
    },
    roomSummaryTitle: "Zusammenfassung",
    roomSummaryLabels: {
      vote: "Stimme",
      comfort: "Komfort",
      interest: "Interesse",
      views: "Ansichten",
      next: "Naechstes",
    },
    roomSummaryVoteWaiting: "Noch offen",
    roomSummaryVoteTie: (labels) => `Gleichstand: ${labels.join(" | ")}`,
    roomSummaryComfortWaiting: "Wartet auf Antworten",
    roomSummaryNextWaiting: "Abstimmen oder eine kleine Idee teilen.",
    roomSummaryNextReady: (choice, needs) => {
      const parts = [choice, needs.length ? needs.join(" | ") : ""].filter(Boolean);
      return parts.length ? `Einen ruhigen Plan mit ${parts.join(" | ")} machen.` : "Einen ruhigen Plan machen.";
    },
    roomSummaryNextView: "Eine freundliche Ansicht teilen, ohne Druck.",
    roomSummaryNextTie: "Weiter abstimmen oder VYVA um eine einfache Zusammenfassung bitten.",
    roomCommonGroundTitle: "Gemeinsamer Nenner",
    roomCommonGroundBody: "Was der Raum jetzt weiss, ohne Namen zu zeigen.",
    roomCommonGroundVote: "Stimmen bleiben privat; sichtbar sind nur Summen.",
    roomCommonGroundComfortReady: (needs) => `Mit ${needs.join(" | ")} vorbereiten.`,
    roomCommonGroundComfortWaiting: "Du kannst sagen, was hilft, bevor du mitmachst.",
    roomCommonGroundInterestReady: (count) => `${count} ${count === 1 ? "Person zeigt" : "Personen zeigen"} Interesse, ohne Verpflichtung.`,
    roomCommonGroundInterestWaiting: "Interesse kann mit Vielleicht beginnen.",
    roomCommonGroundViewsReady: (count) => `${count} ${count === 1 ? "geteilte Ansicht" : "geteilte Ansichten"} mit Pruefung in der Naehe.`,
    roomCommonGroundViewsWaiting: "Ansichten duerfen kurz und freundlich sein.",
    roomOutcomeTitle: "Was VYVA als Naechstes tut",
    roomOutcomeBody: (choice, needs, context) => {
      if (context === "tie") return `VYVA laesst ${choice ?? "die Optionen"} offen und fasst sie einfach zusammen, bevor sich jemand gedrueckt fuehlt.`;
      if (context === "views") return "VYVA haelt den Meinungskreis freundlich und bringt die wichtigsten Punkte als einfache Zusammenfassung zurueck.";
      if (context === "plan") {
        const base = `VYVA bereitet ${choice ?? "die fuehrende Wahl"} vor`;
        return needs.length ? `${base} mit ${needs.join(", ")}, bevor sich jemand festlegt.` : `${base}, bevor sich jemand festlegt.`;
      }
      if (context === "comfort") return `VYVA nutzt ${needs.join(", ")}, damit der naechste Plan leichter wird.`;
      return "Wenn mehr Wahlen da sind, macht VYVA daraus einen ruhigen naechsten Schritt.";
    },
    roomOutcomeSteps: {
      private: "Private Summen nutzen, keine Namen",
      shape: "Wahlen in einen klaren Schritt verwandeln",
      safety: "Kontakt und Sicherheit in VYVA halten",
    },
    roomAtGlanceTitle: "Heute im Raum",
    roomAtGlanceUpdatesClear: "Keine neuen Updates",
    roomAtGlanceUpdates: (count) => `${count} ${count === 1 ? "Update" : "Updates"}`,
    roomAtGlanceVotes: (count) => `${count} ${count === 1 ? "Stimme" : "Stimmen"}`,
    roomAtGlancePlanInterest: (count) => `${count} ${count === 1 ? "interessierte Person" : "interessierte Personen"}`,
    roomAtGlanceComfort: (count) => `${count} ${count === 1 ? "Komfortsignal" : "Komfortsignale"}`,
    mySafeChoicesTitle: "Meine sicheren Wahlen",
    mySafeChoicesBody: "Ein privater Blick darauf, was du bisher gewaehlt hast.",
    mySafeChoicesPrivate: "Der Raum sieht Summen, nicht deinen Namen.",
    privateNoteTitle: "Private Notiz",
    privateNotePlaceholder: "Was ich mir merken moechte...",
    privateNoteSave: "Notiz speichern",
    privateNoteClear: "Loeschen",
    privateNoteSaved: "Private Notiz gespeichert",
    privateNoteCleared: "Private Notiz geloescht",
    privateNotePrivate: "Nur auf diesem Geraet gespeichert.",
    privateNoteLength: (remaining) => `${remaining} Zeichen uebrig`,
    mySafeReviewsTitle: "VYVA Pruef-Updates",
    mySafeReviewsBody: "Nur du siehst diese Pruefstaende. Der Raum sieht nicht, wer gefragt hat.",
    mySafeReviewLabels: {
      shared: "Geteilter Beitrag",
      reply: "Antwort",
      poll: "Abstimmung",
      room: "Raum",
    },
    mySafeChoiceLabels: {
      plan: "Aktivitaet",
      vote: "Stimme",
      comfort: "Komfort",
      help: "Hilfe",
    },
    mySafeChoicePlanNone: "Noch keine Aktivitaet gewaehlt",
    mySafeChoicePlanJoin: "Interesse, keine Verpflichtung",
    mySafeChoicePlanMaybe: "Fuer spaeter gemerkt",
    mySafeChoicePlanNotForMe: "Privat passen",
    mySafeChoiceVoteNone: "Noch keine Stimme",
    mySafeChoiceIssueVote: (question, choice) => `${question}: ${choice}`,
    mySafeChoiceComfortNone: "Noch kein Komfortwunsch",
    mySafeChoiceHelpNone: "Noch keine Hilfe angeboten",
    mySafeChoiceHelp: (planTitle, helpers) => `${planTitle}: ${helpers.join(" | ")}`,
    mySafeChoiceActionLabels: {
      comfort: "Komfort waehlen",
      vote: "Privat abstimmen",
      plan: "Aktivitaet waehlen",
    },
    mySafePauseAction: "Ruhig pausieren",
    mySafePauseActiveAction: "Pause aktiv",
    mySafePauseStatus: "Ruhige Pause aktiv. Es wird nichts gepostet.",
    mySafePauseFailed: "Die ruhige Pause konnte nicht aktualisiert werden. Bitte versuche es erneut.",
    mySafePauseNote: "Du kannst weiter mitlesen, ohne den Raum zu benachrichtigen.",
    mySafePauseClearedForAction: "Die ruhige Pause wurde ausgeschaltet, damit dies gesendet werden konnte.",
    mySafeLeaveAction: "Ruhig gehen",
    mySafeLeaveNote: "Niemand wird benachrichtigt.",
    roomTrustTitle: "Sicher zum Mitmachen",
    roomTrustBody: "Drei Erinnerungen, bevor du mitmachst. Du kannst VYVA bitten, sie einfach zu pruefen.",
    roomTrustItems: {
      privacy: "Stimmen, Komfort und Vielleicht bleiben ohne Namen.",
      kindness: "Ansichten sollen freundlich bleiben; VYVA kann Unangenehmes pruefen.",
      contact: "Privater Kontakt bleibt in VYVA, bis beide Personen zustimmen.",
    },
    roomTrustAction: "Ruhig pruefen lassen",
    roomTrustDraft: "VYVA, kannst du pruefen, ob dieser Raum heute sicher zum Mitmachen wirkt? Fasse Datenschutz, Freundlichkeit und Kontaktsicherheit einfach zusammen, ohne Namen.",
    roomTrustIntroAction: "Raum erklaeren",
    roomTrustIntroDraft: "VYVA, erklaere mir diesen Raum in einer Minute: wie ich abstimme, eine Ansicht teile, eine Aktivitaet waehle und sicher bleibe, ohne Namen oder Druck.",
    participationPathTitle: "Waehle deinen Einstieg",
    participationPathBody: "Drei einfache Wege, um mitzumachen, ohne erst alles lesen zu muessen.",
    participationPathLabels: {
      vote: "Privat abstimmen",
      view: "Ansicht teilen",
      activity: "Aktivitaeten fuer dich",
    },
    participationPathBodies: {
      vote: "Waehle eine Option. Der Raum sieht nur Summen.",
      view: "Schreibe einen freundlichen Satz; VYVA prueft in der Naehe.",
      activity: "Oeffne empfohlene Aktivitaeten, die zu deinem Profil passen.",
    },
    participationPathActions: {
      vote: "Zur Abstimmung",
      view: "Ansicht schreiben",
      activity: "Aktivitaeten ansehen",
    },
    participationPathPrivacy: "Du kannst erst schauen. Kein Weg teilt privaten Kontakt.",
    nextGentleStepLabel: "Naechster sanfter Tipp",
    nextGentleSteps: {
      promise: {
        title: "Zuerst den Raum sicher halten",
        body: "Lies das Raumversprechen. So bleiben Ansichten, Stimmen und Plaene freundlich.",
        action: "Ich verstehe",
      },
      updates: {
        title: "Es gibt etwas Neues",
        body: "Schau die Updates an, bevor du antwortest. So kannst du ruhig mitmachen.",
        action: "Updates ansehen",
      },
      comfort: {
        title: "Starte so, wie es passt",
        body: "Du kannst erst zuhoeren. Der Raum sieht nur Summen, nicht deinen Namen.",
        action: "Erst zuhoeren",
      },
      vote: {
        title: "Hilf beim Auswaehlen",
        body: "Eine private Stimme hilft dem Raum, den naechsten Schritt zu finden.",
        action: "Optionen ansehen",
      },
      plan: {
        title: "Merk dein Interesse",
        body: "Du kannst mitmachen oder vielleicht sagen. Es ist keine feste Zusage.",
        action: "Plan ansehen",
      },
      recap: {
        title: "Bitte um Zusammenfassung",
        body: "VYVA kann Stimmen, Komfort und Plaene in eine einfache Notiz ordnen.",
        action: "Zusammenfassung",
      },
      hello: {
        title: "Klein anfangen",
        body: "Ein freundlicher Gruss reicht, um ohne Druck anzukommen.",
        action: "Hallo sagen",
      },
    },
    nextGentleStepExplainAction: "Warum?",
    nextGentleStepExplainDraft: (stepTitle) => (
      `VYVA, ich bin nicht sicher, wo ich anfangen soll. Kannst du erklaeren, warum "${stepTitle}" der sichere naechste Tipp ist, und mir eine einfache Option ohne Namen und ohne Druck geben?`
    ),
    roomReadinessTitle: "Bevor es weitergeht",
    roomReadinessBody: "VYVA prueft diese drei Punkte, damit der naechste Schritt klar und sicher bleibt.",
    roomReadinessLabels: {
      vote: "Stimme",
      comfort: "Komfort",
      consent: "Zustimmung",
    },
    roomReadinessVoteReady: "Der Raum hat eine fuehrende Wahl.",
    roomReadinessVoteWaiting: "Wartet auf ein paar Stimmen.",
    roomReadinessComfortReady: "Komfortwuensche sind sichtbar.",
    roomReadinessComfortWaiting: "Wartet darauf, was helfen wuerde.",
    roomReadinessConsentReady: "Kontakt bleibt in VYVA, bis beide Personen zustimmen.",
    roomUsefulTitle: "Nuetzliche naechste Schritte",
    roomUsefulBody: "VYVA zeigt, wobei es jetzt helfen kann, ohne Namen oder Druck.",
    roomUsefulLabels: {
      activity: "Aktivitaet",
      vote: "Themenabstimmung",
      views: "Ansichten",
    },
    roomUsefulReady: {
      activity: "Bereit, damit VYVA einen sicheren naechsten Schritt vorbereitet.",
      vote: "Eine Frage hat Unterstuetzung und kann private Abstimmung werden.",
      views: "Es gibt Ansichten fuer eine ruhige Zusammenfassung.",
    },
    roomUsefulWaiting: {
      activity: "Noch fehlen Interesse, Komfort oder eine kleine Hilfe.",
      vote: "Wartet noch, bis eine Frage Unterstuetzung bekommt.",
      views: "Noch keine geteilten Ansichten zum Zusammenfassen.",
    },
    roomUsefulActions: {
      activity: "Aktivitaet vorbereiten",
      vote: "Abstimmung machen",
      views: "Ansichten zusammenfassen",
    },
    roomUsefulWaitingActions: {
      activity: "Aktivitaet helfen",
      vote: "Abstimmung vorschlagen",
      views: "Ansicht teilen",
    },
    roomUsefulPrivacy: "VYVA nutzt Signale und Summen, keine Namen.",
    roomNotesTitle: "Heutige Raumnotizen",
    roomNotesBody: "Eine einfache Notiz zu dem, was der Raum schon weiss, damit niemand alles behalten muss.",
    roomNotesLabels: {
      known: "Schon bekannt",
      open: "Noch offen",
      next: "Naechste Hilfe",
    },
    roomNotesVoteKnown: (label) => `Abstimmung: ${label}.`,
    roomNotesVoteTie: (labels) => `Abstimmung gleichauf: ${labels.join(" | ")}.`,
    roomNotesVoteWaiting: "Abstimmung: noch offen.",
    roomNotesComfortKnown: (labels) => `Komfort: ${labels.join(" | ")}.`,
    roomNotesComfortWaiting: "Komfort: wartet auf ein Signal.",
    roomNotesViewsKnown: (count) => `${count} ${count === 1 ? "geteilte Ansicht" : "geteilte Ansichten"}.`,
    roomNotesViewsWaiting: "Ansichten: noch keine.",
    roomNotesOpenItems: {
      vote: "Es fehlen noch ein paar private Stimmen.",
      comfort: "Es fehlt noch, was Komfort gibt.",
      views: "Eine ruhige Ansicht fehlt noch.",
      activity: "Die Aktivitaet wird noch geformt.",
    },
    roomNotesOpenReady: "Nichts Dringendes. Der Raum kann langsam weitergehen.",
    roomNotesNextActivity: (title) => `VYVA kann "${title}" als sicheren Schritt vorbereiten.`,
    roomNotesNextVote: (title) => `VYVA kann "${title}" in eine einfache private Abstimmung umwandeln.`,
    roomNotesNextViews: (count) => `VYVA kann ${count === 1 ? "diese Ansicht" : "diese Ansichten"} ohne Namen zusammenfassen.`,
    roomNotesNextStarter: "Mit Hallo, einem Komfortwunsch oder einer privaten Stimme beginnen.",
    roomNotesNextActions: {
      activity: "Schritt vorbereiten",
      vote: "Abstimmung machen",
      views: "Ansichten zusammenfassen",
      starter: "Sanft starten",
    },
    roomNotesCopyAction: "Notizen ohne Namen kopieren",
    roomNotesCopied: "Notizen ohne Namen kopiert",
    roomNotesCopyFailed: "Notizen konnten nicht kopiert werden",
    roomNotesPrivacy: "Diese Notizen nutzen Summen und Signale, keine Namen.",
    responseNone: "Du kannst den Anfang machen.",
    responseJoinCount: (count) => `${count} ${count === 1 ? "macht mit" : "machen mit"}`,
    responseMaybeCount: (count) => `${count} vielleicht`,
    responseNotForMeCount: (count) => `${count} ${count === 1 ? "passt" : "passen"}`,
    morePlans: "Auch moeglich",
    roomUpdates: "Neu im Raum",
    roomUpdatesShowing: (visible, total) => `Zeigt ${visible} von ${total} Updates`,
    roomUpdatesRecapTitle: "Einfaches Update",
    roomUpdatesRecapBody: (count) => `VYVA kann ${count === 1 ? "dieses Update" : `diese ${count} Updates`} zusammenfassen und den sicheren naechsten Schritt ohne Namen nennen.`,
    roomUpdatesRecapAction: "Zusammenfassen",
    roomUpdatesRecapDraft: (count) => (
      count === 1
        ? "VYVA, fasse dieses Raum-Update in einfachen Worten zusammen und nenne mir den sicheren naechsten Schritt, ohne Namen."
        : `VYVA, fasse diese ${count} Raum-Updates in einfachen Worten zusammen und nenne mir den sicheren naechsten Schritt, ohne Namen.`
    ),
    markUpdateSeen: "Gesehen",
    markAllUpdatesSeen: "Alles gesehen",
    updateSeen: "Als gesehen gespeichert",
    updateSeenFailed: "Konnte nicht als gesehen gespeichert werden. Bitte versuche es erneut.",
    allUpdatesSeen: "Alle Updates als gesehen gespeichert",
    allUpdatesSeenFailed: "Konnte nicht alles als gesehen speichern. Bitte versuche es erneut.",
    sharedToday: "Heute geteilt",
    viewCircleTitle: "Meinungskreis",
    viewCircleBody: "Lies, was gesagt wurde, und teile einen freundlichen Satz, wenn du bereit bist.",
    viewCircleEmpty: "Noch keine geteilten Ansichten. Ein kleiner Satz reicht.",
    viewCircleVote: (label, count) => `${label}: ${count} ${count === 1 ? "Stimme" : "Stimmen"}`,
    viewCircleCount: (count) => `${count} ${count === 1 ? "geteilte Ansicht" : "geteilte Ansichten"}`,
    viewCircleLatest: "Neu im Raum",
    viewCircleAdd: "Ansicht teilen",
    viewRecapTitle: "VYVA kann die Ansichten zusammenfassen",
    viewRecapBody: (count) => (
      count === 1
        ? "Es gibt 1 geteilte Ansicht. VYVA kann sie in einfachen Worten zurueckgeben."
        : `Es gibt ${count} geteilte Ansichten. VYVA kann die Hauptpunkte ohne Namen buendeln.`
    ),
    viewRecapAction: "Ansichten zusammenfassen",
    viewRecapDraft: (count) => (
      count === 1
        ? "VYVA, fasse diese geteilte Ansicht freundlich und einfach zusammen, ohne Namen zu zeigen."
        : `VYVA, fasse diese ${count} geteilten Ansichten freundlich und einfach zusammen, ohne Namen zu zeigen.`
    ),
    viewVoteBridgeTitle: "Ansichten zur Abstimmung machen",
    viewVoteBridgeBody: (count) => (
      count === 1
        ? "Wenn diese Ansicht eine Entscheidung braucht, kann VYVA eine einfache private Abstimmung vorschlagen."
        : `Wenn diese ${count} Ansichten verschiedene Optionen zeigen, kann VYVA daraus eine einfache private Abstimmung machen.`
    ),
    viewVoteBridgeAction: "Private Abstimmung vorbereiten",
    viewVoteBridgeDraft: (count) => (
      count === 1
        ? "VYVA, mache aus dieser geteilten Ansicht eine einfache private Abstimmung mit sicheren Optionen und ohne Namen."
        : `VYVA, mache aus diesen ${count} geteilten Ansichten eine einfache private Abstimmung mit sicheren Optionen und ohne Namen.`
    ),
    viewBalanceTitle: "Gespraechsbalance",
    viewBalanceBody: "Zeigt, wie der Raum antwortet, damit eine andere Sicht sicher bleibt.",
    viewBalanceEmpty: "Noch keine Antworten.",
    viewBalanceLabels: {
      support: "Gleiches Gefuehl",
      curious: "Mehr hoeren",
      different: "Andere Sicht",
      help: "Hilfe angeboten",
    },
    viewCommonGroundTitle: "Gemeinsamer Nenner",
    viewCommonGroundOpening: "Das Gespraech beginnt. Eine freundliche Antwort kann helfen, Gemeinsames zu finden.",
    viewCommonGroundAgreement: "Ein gemeinsames Signal ist da. VYVA kann es einfach und ruhig halten.",
    viewCommonGroundCurious: "Der Raum bittet um mehr Kontext, bevor entschieden wird. Das hilft beim ruhigen Waehlen.",
    viewCommonGroundDifferent: "Verschiedene Sichtweisen sind da und bleiben freundlich. VYVA kann sie ohne Namen zusammenfassen.",
    viewCommonGroundMixed: "Mehrere Signale sind gleichzeitig da. Eine VYVA-Zusammenfassung kann daraus einen klaren Schritt machen.",
    viewCommonGroundPrivacy: "Antworten werden nach Ton zusammengefasst, nicht nach Namen.",
    viewSafetyTitle: "Sicher anders sehen",
    viewSafetyBody: "Andere Ansichten sind willkommen, wenn sie kurz, freundlich und ohne private Details bleiben.",
    viewSafetyItems: {
      kind: "Sprich ueber die Idee, nicht ueber die Person.",
      private: "Lass Telefon, Adresse, Geld und Kontakt weg.",
      review: "Bitte VYVA, Unangenehmes zu pruefen.",
    },
    viewSafetyAction: "Sanft beginnen",
    viewSafetyDraft: "Ich sehe es anders. Koennen wir ruhig vergleichen, ohne Namen?",
    viewNextReplyTitle: "Naechste freundliche Antwort",
    viewNextReplyBodies: {
      opening: "Eine kleine Frage oder Zustimmung kann helfen, dass sich alle gehoert fuehlen.",
      agreement: "Baue mit einem einfachen Grund auf das gemeinsame Signal auf.",
      curious: "Bitte um ein Detail mehr, bevor der Raum waehlt.",
      different: "Eine freundliche Frage haelt eine andere Sicht sicher.",
      mixed: "Wenn Signale gemischt sind, frage zuerst, was am wichtigsten ist.",
    },
    viewNextReplyActions: {
      opening: "Antwort einladen",
      agreement: "Grund hinzufuegen",
      curious: "Detail fragen",
      different: "Freundlich fragen",
      mixed: "Was ist wichtig?",
    },
    viewNextReplyDrafts: {
      opening: "Ich wuerde gern hoeren, was anderen am wichtigsten ist.",
      agreement: "Ich stimme zu, und ein Grund ist...",
      curious: "Kannst du etwas mehr sagen, was dir am wichtigsten ist?",
      different: "Ich sehe es anders. Koennen wir ruhig vergleichen, was am wichtigsten ist?",
      mixed: "Koennen wir kurz innehalten und sagen, was jeder Person am wichtigsten ist?",
    },
    sharedResponseSaved: "Deine Antwort ist gespeichert",
    reviewItem: "VYVA pruefen lassen",
    reviewItemSent: "VYVA prueft diesen Beitrag behutsam.",
    reviewItemStatusOpen: "An VYVA gesendet",
    reviewItemStatusReviewing: "VYVA prueft das",
    reviewItemStatusResolved: "VYVA hat es geprueft",
    reviewItemStatusDismissed: "VYVA hat es angesehen",
    reviewReply: "Antwort pruefen",
    withdrawItem: "Meinen Beitrag entfernen",
    withdrawItemSent: "Dein Beitrag wurde aus dem Raum entfernt",
    withdrawItemFailed: "Das Entfernen hat nicht geklappt. Versuch es bitte noch einmal.",
    withdrawReply: "Meine Antwort entfernen",
    withdrawReplySent: "Deine Antwort wurde aus dem Raum entfernt",
    withdrawReplyFailed: "Die Antwort konnte nicht entfernt werden. Versuch es bitte noch einmal.",
    gentleReplies: "Freundliche Antworten",
    replyGuideTitle: "Sicher antworten",
    replyGuideBody: "Nutze eine freundliche Taste. Wenn sich eine Antwort falsch anfuehlt, kann VYVA sie pruefen.",
    planSupportTitle: "Einfach machen",
    planSupportBody: "Waehle eine kleine Hilfe, damit der Plan fuer alle angenehmer wird.",
    planSupportSummaryTitle: "Hilfe fuer die Aktivitaet",
    planSupportSummaryBody: "So hilft der Raum in kleinen Schritten, damit der Plan klappt.",
    planSupportSummaryEmpty: "Noch keine Hilfe. Waehle unten eine kleine Hilfe aus.",
    planHelperCueTitle: "Beste kleine Hilfe",
    planHelperCueBody: (actionLabel) => `Jetzt hilft am meisten: ${actionLabel}. Das gibt VYVA ein praktisches Signal, ohne jemanden festzulegen.`,
    planHelperCueCoveredTitle: "Hilfen abgedeckt",
    planHelperCueCoveredBody: (labels) => `Schon abgedeckt: ${labels.join(", ")}. Eine weitere Hilfe ist freiwillig.`,
    planHelperCueAction: (actionLabel) => `${actionLabel} waehlen`,
    planHelperCuePrivate: "Das postet nur ein Hilfesignal, keinen privaten Kontakt.",
    planSupportRemoveAction: (actionLabel) => `${actionLabel} entfernen`,
    planSupportRemovePrivate: "Das entfernt nur dein Hilfesignal.",
    planSupportRemoved: "Hilfesignal entfernt",
    planReadinessTitle: "Bereit fuer den naechsten Schritt",
    planReadinessBody: (ready, total) => `${ready} von ${total} Signalen sind bereit. VYVA wartet ruhig auf das, was noch fehlt.`,
    planReadinessInterestReady: (count) => `${count} ${count === 1 ? "Person zeigt" : "Personen zeigen"} Interesse.`,
    planReadinessInterestWaiting: "Wartet auf Interesse: Mitmachen oder Vielleicht.",
    planReadinessHelperReady: (count) => `${count} kleine ${count === 1 ? "Hilfe ist" : "Hilfen sind"} angeboten.`,
    planReadinessHelperWaiting: "Eine kleine Hilfe wuerde es leichter machen.",
    planReadinessComfortReady: "Komfort ist schon benannt.",
    planReadinessComfortWaiting: "Es fehlt noch, was angenehm waere.",
    planReadinessVyvaReady: "VYVA bestaetigt Details vor jedem Kontakt.",
    activityReadyTitle: "VYVA kann es vorbereiten",
    activityReadyBody: (planTitle) => `"${planTitle}" hat Interesse, Komfort und eine kleine Hilfe. VYVA kann die Details bestaetigen, bevor sich jemand festlegt.`,
    activityReadySignalsTitle: "Signale ohne Namen",
    activityReadyPrivate: "Privat und ohne Druck",
    activityReadyPrepTitle: "Bevor VYVA vorbereitet",
    activityReadyPrepItems: [
      "Ort, Zeit, Kosten und Zugang bestaetigen.",
      "Kontakt bleibt in VYVA, bis beide zustimmen.",
      "Einen einfachen naechsten Schritt bringen, keine Verpflichtung.",
    ],
    activityReadyAction: "VYVA nach dem naechsten Schritt fragen",
    activityReadyDraft: (planTitle, signals) => (
      signals.length
        ? `VYVA, "${planTitle}" wirkt bereit. Signale im Raum: ${signals.join("; ")}. Kannst du den naechsten einfachen und sicheren Schritt vorbereiten?`
        : `VYVA, "${planTitle}" wirkt bereit. Kannst du den naechsten einfachen und sicheren Schritt fuer den Raum vorbereiten?`
    ),
    voteReadyTitle: "Diese Frage ist bereit",
    voteReadyBody: (questionTitle) => `"${questionTitle}" bekommt Unterstuetzung. VYVA kann daraus eine einfache private Abstimmung ohne Namen machen.`,
    voteReadyPrivate: "Namen bleiben verborgen",
    voteReadyAction: "VYVA um die Abstimmung bitten",
    planSupportActions: {
      choose: "Auswaehlen helfen",
      pace: "Ruhiges Tempo",
      buddy: "Gemeinsam ankommen",
      notify: "Mich informieren",
    },
    planSupportReplies: {
      choose: "Ich kann helfen, eine einfache Option fuer die Gruppe auszuwaehlen.",
      pace: "Ein ruhiges Tempo mit Pausen wuerde mir helfen.",
      buddy: "Es wuerde mir helfen, vorher mit jemandem zusammen anzukommen.",
      notify: "Bitte haltet mich auf dem Laufenden, wenn es einen naechsten Schritt gibt.",
    },
    replySent: "Antwort geteilt",
    replyFailed: "Antwort konnte nicht geteilt werden. Bitte versuche es erneut.",
    replyActions: {
      support: "Geht mir auch so",
      curious: "Erzaehl mehr",
      help: "Ich kann helfen",
      different: "Andere Sicht",
    },
    replyBodies: {
      support: "Mir geht es auch so. Danke, dass du das teilst.",
      curious: "Ich wuerde gern etwas mehr hoeren, wenn du teilen moechtest.",
      help: "Ich kann bei einem kleinen Schritt im Raum helfen.",
      different: "Ich sehe es etwas anders, danke aber fuer das Teilen.",
    },
    supportIdea: "Mitmachen",
    maybeIdea: "Vielleicht",
    sharedKindLabels: {
      plan: "Plan",
      message: "Gruss",
      question: "Frage",
    },
    sharedViewLabel: "Ansicht",
    sharedActions: {
      plan: { primary: "Mitmachen", secondary: "Vielleicht" },
      message: { primary: "Ich auch", secondary: "Danke" },
      question: { primary: "Mir auch helfen", secondary: "Folgen" },
    },
    issueQueueTitle: "Fragen fuer eine spaetere Abstimmung",
    issueQueueBody: "Wenn jemand Klaerung braucht, haelt VYVA es hier fest, damit der Raum es ohne Druck unterstuetzen kann.",
    issueQueueBadge: "Moegliche Abstimmung",
    issueQueueAction: "Zur Abstimmung machen",
    issueQueueDraft: (title) => `VYVA, mache aus "${title}" eine einfache Raumabstimmung mit sicheren Optionen und ohne Namen.`,
    issueQueueUseAction: "Diese Abstimmung zusammenfassen",
    issueQueueUseDraft: (title, signal) => (
      signal
        ? `VYVA, fasse die private Abstimmung zu "${title}" zusammen. Das aktuelle Signal ist: ${signal}. Hilf dem Raum, einen sicheren naechsten Schritt zu waehlen, ohne Namen.`
        : `VYVA, fasse die private Abstimmung zu "${title}" zusammen und hilf dem Raum, einen sicheren naechsten Schritt zu waehlen, ohne Namen.`
    ),
    issueQueuePrivacy: "Eine Frage zu unterstuetzen zeigt nur Interesse. Der Raum sieht deinen Namen nicht.",
    issueReadinessTitles: {
      gathering: "Unterstuetzung sammeln",
      vote: "Bereit zur Abstimmung",
      summary: "Bereit zum Zusammenfassen",
    },
    issueReadinessBodies: {
      gathering: "Tippe Mir auch helfen oder Folgen, wenn diese Frage dir wichtig ist.",
      vote: "Es gibt Interesse. VYVA kann daraus eine private Abstimmung ohne Namen machen.",
      summary: (signal) => (
        signal
          ? `Das Signal ist: ${signal}. VYVA kann es zusammenfassen und einen sicheren naechsten Schritt vorschlagen.`
          : "VYVA kann die private Abstimmung zusammenfassen und einen sicheren naechsten Schritt vorschlagen."
      ),
    },
    issuePollTitle: "Einfache Abstimmung",
    issuePollBody: "Waehle eine Option. Du kannst sie aendern oder entfernen, solange die Abstimmung offen ist.",
    issuePollClosed: "VYVA hat diese Abstimmung zur Pruefung pausiert. Die Summen bleiben sichtbar, aber neue Stimmen sind geschlossen.",
    issuePollPrivacy: "Auch diese Stimme ist privat. Sichtbar sind nur Summen.",
    issuePollOutcomeTitle: "Signal im Raum",
    issuePollOutcomeBody: (label) => `Im Moment tendiert der Raum zu: ${label}. VYVA kann das nutzen, ohne Namen zu zeigen.`,
    issuePollOutcomeTie: (labels) => `Der Raum ist zwischen ${labels.join(" | ")} geteilt. VYVA kann das ohne Eile zusammenfassen.`,
    issuePollOutcomeOtherViews: "Andere Optionen zaehlen auch. VYVA kann sie ohne Namen einbeziehen.",
    issuePollOutcomeOpen: "Solange die Abstimmung offen ist, kann man noch anders waehlen.",
    proposalPlaceholder: "Schreibe eine kleine Idee...",
    proposalLengthHint: (remaining) => `${remaining} Zeichen frei`,
    proposalSafetyWarning: "Bitte Telefon, E-Mail, Adresse oder Zahlungsdaten vor dem Senden entfernen.",
    proposalToneWarning: "Bitte vor dem Senden freundlicher formulieren. VYVA kann beim Umformulieren helfen.",
    proposalToneRewrite: "Freundlicher formulieren",
    proposalToneRewriteDrafts: {
      plan: "Koennen wir es ruhig und einfach fuer alle machen?",
      message: "Ich sehe es etwas anders, weil...",
      question: "Koennen wir gemeinsam ruhig darueber nachdenken?",
    },
    proposalCategoryPrompt: "Welche Erfahrung?",
    proposalPlacePrompt: "Was passt besser?",
    proposalTimePrompt: "Wann passt es?",
    proposalCostPrompt: "Kosten",
    proposalGroupPrompt: "Wie mitmachen?",
    composerPreviewTitle: "Vor dem Senden",
    composerPreviewBodies: {
      plan: "Diese Idee erscheint als Plan, damit andere Mitmachen oder Vielleicht waehlen koennen.",
      message: "Diese Notiz erscheint als kurze Sicht, mit freundlichen Antworten in der Naehe.",
      question: "Diese Frage hilft VYVA, zu klaeren oder daraus eine Abstimmung zu machen.",
    },
    composerPreviewItems: {
      plan: {
        shared: "Der Raum sieht den Plan, nicht deine privaten Entscheidungen.",
        private: "Stimmen, Komfort und Vielleicht bleiben ohne Namen.",
        next: "VYVA prueft Kosten, Kontakt, Transport oder Service vor dem naechsten Schritt.",
      },
      message: {
        shared: "Der Raum sieht den Satz und kann mit freundlichen Knoepfen antworten.",
        private: "Bitte keine Telefonnummer, E-Mail oder genaue Adresse.",
        next: "Wenn Worte scharf wirken, kann VYVA sie zuerst weicher machen.",
      },
      question: {
        shared: "Der Raum sieht die Frage, nicht wer Hilfe braucht.",
        private: "Deine Stimmen und Komfortwuensche bleiben privat.",
        next: "VYVA kann daraus eine einfache Abstimmung mit Summen machen.",
      },
    },
    safeShareTitle: "Behutsam teilen",
    safeShareBody: "Bitte keine Telefonnummer, E-Mail, genaue Adresse oder Zahlung in die Notiz schreiben.",
    safeShareReviewLine: "Bei Kosten, Transport, Wohnen oder Diensten prueft VYVA vor dem naechsten Schritt.",
    planNearby: "In der Naehe",
    planOnline: "Online",
    comfortPrompt: "Was hilft?",
    comfortNeedLabels: {
      listen_first: "Erst zuhoeren",
      quiet_pace: "Ruhiges Tempo",
      easy_access: "Einfacher Zugang",
      seating: "Sitzplatz",
      transport_help: "Hilfe beim Hinkommen",
      arrival_buddy: "Gemeinsam ankommen",
      clear_cost: "Kosten vorher wissen",
    },
    moreComfortNotes: (count) => `${count} ${count === 1 ? "weitere Hilfe" : "weitere Hilfen"}`,
    categoryLabels: {
      movie_date: "Film-Date",
      restaurant_date: "Restaurant",
      home_share: "Haus oder Miete",
      service_booking: "Service buchen",
      deal_help: "Deal verhandeln",
      outing: "Ausflug",
      other: "Andere Idee",
    },
    timeLabels: {
      morning: "Morgen",
      afternoon: "Nachmittag",
      evening: "Abend",
      flexible: "Flexibel",
    },
    costLabels: {
      free: "Kostenfrei",
      low: "Klein",
      shared: "Geteilt",
      discuss: "Vorher klaeren",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Kleine Gruppe",
      open_room: "Offene Runde",
    },
    fitLabel: "Passt wegen",
    reviewBadge: "VYVA prueft vor dem naechsten Schritt",
    reviewReasons: {
      money: "Geld",
      housing: "Wohnen",
      service: "Service",
      private_contact: "Kontakt",
      transport: "Transport",
      unkind_tone: "Ton",
    },
    postFailed: "Konnte nicht gepostet werden. Bitte versuche es erneut.",
    send: "Senden",
    cancel: "Abbrechen",
    sending: "Senden...",
    sent: "Gesendet",
    reviewPending: "VYVA prueft es, bevor es erscheint.",
    helpSent: "VYVA prueft das behutsam.",
    helpSending: "VYVA wird benachrichtigt...",
    helpFailed: "VYVA konnte nicht benachrichtigt werden. Bitte versuche es erneut.",
    safetyHelpTitle: "Was soll VYVA pruefen?",
    safetyHelpBody: "Waehle, was am besten passt. Der Raum sieht diese Hilfe nicht.",
    safetyHelpUrgentNote:
      "Wenn jetzt etwas dringend ist, nutze lokale Notfallhilfe. VYVA ersetzt keine sofortige Hilfe.",
    safetyHelpChoiceLabels: {
      uncomfortable: "Unangenehm",
      pressure_contact: "Druck oder Kontakt",
      money_service: "Geld oder Service",
      something_else: "Etwas anderes",
    },
    safetyHelpChoiceBodies: {
      uncomfortable: "Etwas im Raum fuehlt sich nicht richtig an.",
      pressure_contact: "Jemand fragt nach privatem Kontakt oder draengt.",
      money_service: "Kosten, Zahlung, Angebot oder Service sollen geprueft werden.",
      something_else: "Ich moechte, dass VYVA den Raum anschaut.",
    },
    safetyHelpChoiceReasons: {
      uncomfortable: "feels_uncomfortable",
      pressure_contact: "pressure_or_contact",
      money_service: "money_or_service",
      something_else: "other_safety_help",
    },
    safetyHelpChoiceDetails: {
      uncomfortable: "Die Person meldet, dass sich etwas im Together Room unangenehm anfuehlt.",
      pressure_contact: "Die Person bittet VYVA, moeglichen Druck oder privaten Kontakt zu pruefen.",
      money_service: "Die Person bittet VYVA, Geld, Kosten, Angebot oder Service zu pruefen.",
      something_else: "Die Person bittet um allgemeine Sicherheitshilfe im Together Room.",
    },
    safetyHelpReceiptTitle: "Hilfe gesendet",
    safetyHelpReceiptBody: (choiceLabel) => `VYVA prueft: ${choiceLabel}. Der Raum sieht diese Bitte nicht.`,
    safetyHelpReceiptItems: [
      "VYVA prueft, ohne deinen Namen zu zeigen.",
      "Du kannst den Raum pausieren und spaeter zurueckkommen.",
      "Wenn jetzt etwas dringend ist, nutze lokale Notfallhilfe.",
    ],
    viewSharingNote: "Du kannst eine kurze Ansicht freundlich teilen, ohne persoenliche Kontaktdaten.",
    viewTonePreviewTitle: "Sichere Vorschau",
    viewTonePreviewReady: "Bereit zum ruhigen Teilen",
    viewTonePreviewNeedsEdit: "Braucht eine kleine Anpassung",
    viewTonePreviewItems: {
      kind: "Freundliche Worte",
      privacy: "Kein privater Kontakt",
      small: "Ein kleiner Gedanke",
    },
    viewPromptTitle: "Freundlich anfangen",
    viewPromptBody: "Waehle einen Satz, wenn Worte gerade schwer sind.",
    viewPromptLabels: {
      agree: "Ich stimme zu",
      different: "Andere Sicht",
      compare: "Optionen vergleichen",
      more_info: "Mehr Infos",
    },
    viewPromptDrafts: {
      agree: "Ich stimme zu, weil...",
      different: "Ich sehe es anders, weil...",
      compare: "VYVA, hilf uns, die Optionen ruhig zu vergleichen.",
      more_info: "Ich brauche noch etwas mehr Information, bevor ich waehle.",
    },
    askPromptTitle: "Einfache Fragen an VYVA",
    askPromptBody: "Waehle eine Frage, wenn Worte gerade schwer sind.",
    askPromptLabels: {
      summary: "Zusammenfassen",
      easier: "Einfacher machen",
      vote: "Abstimmung vorschlagen",
      safe: "Sicher?",
    },
    askPromptDrafts: {
      summary: "VYVA, kannst du zusammenfassen, was der Raum gerade waehlt?",
      easier: "VYVA, hilf mir, den einfachsten Weg zum Mitmachen zu finden.",
      vote: "VYVA, kannst du daraus eine einfache Raumabstimmung machen?",
      safe: "VYVA, kannst du pruefen, ob sich das sicher und ohne Druck anfuehlt?",
    },
    issuePromptTitle: "Eine Sorge als Abstimmung",
    issuePromptBody: "Waehle ein haeufiges Thema, wenn VYVA daraus eine einfache Raumabstimmung machen soll.",
    issuePromptLabels: {
      place: "Ort",
      time: "Zeit",
      cost: "Kosten",
      safety: "Sicherheit",
    },
    issuePromptDrafts: {
      place: "VYVA, kannst du eine einfache Abstimmung vorschlagen, welcher Ort fuer den Raum am angenehmsten waere?",
      time: "VYVA, kannst du eine einfache Abstimmung vorschlagen, welche Zeit am besten passt?",
      cost: "VYVA, kannst du eine einfache Abstimmung vorschlagen, damit Kosten vor einer Zusage klar sind?",
      safety: "VYVA, kannst du eine einfache Abstimmung vorschlagen, was dies sicherer und ohne Druck machen wuerde?",
    },
    sharePlanTitle: "Plan teilen",
    sharePlanBody: "Schlage eine einfache Idee vor, damit andere mitmachen oder vielleicht sagen koennen.",
    sharePlanAction: "Plan teilen",
    discussionTitle: "Was moechtest du sagen?",
    discussionBody: "Du kannst klein anfangen. VYVA hilft, wenn du nicht weisst, wie.",
    starterLabels: {
      hello: "Hallo sagen",
      plan: "Plan vorschlagen",
      ask: "VYVA fragen",
    },
    agreementTitle: "Unser Raumversprechen",
    agreementLines: [
      "Freundliche Worte, kein Druck.",
      "Meinungen teilen ohne zu urteilen.",
      "VYVA fragen, wenn etwas unangenehm ist.",
    ],
    acknowledgementLabel: "Ich verstehe",
    acknowledgedLabel: "Raumversprechen gespeichert",
    acknowledgementFailed: "Konnte nicht gespeichert werden. Bitte versuche es erneut.",
    starterDetails: {
      hello: "Ich moechte die Runde gruessen und hoeren, was andere denken.",
      plan: "Ich moechte einen ruhigen Plan teilen.",
      ask: "VYVA, hilf mir, einfach mitzumachen.",
    },
  },
  en: {
    back: "Back",
    safeStatus: "Protected room",
    statusLabel: "Room update",
    refreshRoom: "Check room",
    refreshingRoom: "Checking...",
    roomRefreshed: "Room is up to date",
    roomRefreshedWithUpdates: (count) => `${count} new room ${count === 1 ? "update is" : "updates are"} ready`,
    roomRefreshedWithVotes: (count) => `${count} new ${count === 1 ? "vote is" : "votes are"} in the room`,
    roomRefreshedWithReplies: (count) => `${count} new gentle ${count === 1 ? "reply is" : "replies are"} in the room`,
    roomRefreshedWithPlanInterest: (count) => `${count} new plan ${count === 1 ? "response is" : "responses are"} in the room`,
    roomRefreshedWithComfort: (count) => `${count} new comfort ${count === 1 ? "signal is" : "signals are"} in the room`,
    roomRefreshFailed: "Could not refresh the room. Please try again.",
    readingComfortLabel: "Large text",
    readingComfortOnLabel: "Large text on",
    readingComfortNote: "Large text is on for you in this room only.",
    readRoomAloud: "Read aloud",
    readRoomAloudActive: "Stop reading",
    readRoomAloudStarted: "Reading the room aloud privately",
    readRoomAloudStopped: "Reading stopped",
    readRoomAloudUnavailable: "Read aloud is not available in this browser.",
    present: (count) => `${count} present`,
    join: "Join",
    maybe: "Maybe later",
    joined: "You joined",
    maybeSaved: "Saved for later",
    notForMe: "Not for me",
    notForMeSaved: "Kept private: not for me",
    clearPlanChoice: "Remove my choice",
    planChoiceCleared: "Your choice was removed",
    planChoiceNoteTitle: "No pressure",
    planChoiceNoteBody: "Join only shows interest, not a commitment. Maybe keeps it saved. Not for me is private and helps VYVA avoid pressure.",
    planNextStepTitle: "What happens next",
    planNextStepWaiting: "When someone shows interest, VYVA helps confirm the details calmly.",
    planNextStepReady: "VYVA can help confirm details before anyone shares contact.",
    planNextStepJoined: "You showed interest. VYVA helps confirm details before contact is shared.",
    planNextStepMaybe: "Saved for later. You can come back when the details feel clear.",
    planNextStepNotForMe: "Not for me was kept private. You can change your mind later.",
    planNextStepChecks: ["Time", "Comfort", "Contact only by consent"],
    planComfortCueTitle: "Comfort before joining",
    planComfortCueKnown: (labels) => labels.length ? `Already noted: ${labels.join(", ")}.` : "No comfort notes yet.",
    planComfortCueAsk: (labels) => `Ask VYVA to confirm: ${labels.join(", ")}.`,
    planComfortCueReady: "This plan already names the main comfort checks.",
    planComfortCueMore: (count) => `${count} ${count === 1 ? "more check" : "more checks"}`,
    planComfortCuePrivacy: "Join or Maybe still does not share private contact.",
    planDetailCheckTitle: "Before anyone meets",
    planDetailCheckBody: "VYVA can check the practical details before anyone feels committed.",
    planDetailCheckItems: ["Clear place and time", "Comfort and cost", "Contact only by consent"],
    planDetailCheckAction: "Check details",
    planDetailCheckDraft: (planTitle) => `VYVA, please check "${planTitle}" before anyone commits. Confirm place, time, comfort, cost, and contact only by consent, without names.`,
    roomChoice: "Room choice",
    pollClosed: "Voting is closed",
    youVoted: "Your vote is saved",
    pollNudgeNoVotes: "Your vote helps choose the next step.",
    pollNudgeLeading: (label) => `The room is leaning toward: ${label}.`,
    pollNudgeTie: (labels) => `The room is still choosing between: ${labels.join(" | ")}.`,
    pollNudgeAction: "You can join the plan above or suggest a gentler version.",
    pollVotes: (count) => `${count} ${count === 1 ? "vote" : "votes"}`,
    pollYourChoice: "Your choice",
    clearVoteChoice: "Remove my vote",
    voteChoiceCleared: "Your vote was removed",
    pollPassChoice: "I'll decide later",
    pollPassBody: "No vote is sent. You can keep reading.",
    pollPassSaved: "You can decide later. No vote was sent.",
    pollPrivacyTitle: "Private, changeable vote",
    pollPrivacyBody: "The room only sees totals, not your name. You can change or remove your vote while voting is open.",
    pollImpactTitle: "What your vote does",
    pollImpactWaiting: "Each private vote helps the room choose one calm next step.",
    pollImpactLeading: (label, needs) => (
      needs.length
        ? `The room is leaning toward ${label}. VYVA will shape it around ${needs.join(", ")}.`
        : `The room is leaning toward ${label}. VYVA will turn it into one simple step.`
    ),
    pollImpactTie: (labels) => `The room is split between ${labels.join(" | ")}. VYVA can summarize both without rushing anyone.`,
    pollImpactViews: "The room is choosing to share views. VYVA helps replies stay kind.",
    pollImpactNoVote: "You have not voted yet. You can look first.",
    pollImpactYourVote: (label) => `Your vote: ${label}. You can change or remove it while voting stays open.`,
    pollImpactSafety: "Only totals are shown. Names do not appear.",
    pollSignalTitle: "Room signal",
    pollSignalBodies: {
      opening: "No direction yet. Looking first is welcome too.",
      close: "The vote is still close. Choose what feels right without pressure.",
      clear: "A clear direction is forming, but the vote stays open and private.",
    },
    pollSignalClearBody: (label) => `${label} is ahead, but you can still choose calmly.`,
    pollSignalPrivacy: "VYVA uses totals only, not names.",
    comfortCheckTitle: "What would make this comfortable?",
    comfortCheckBody: "Tap what helps. The room can shape plans around it.",
    comfortCheckCount: (count) => `${count} chose this`,
    comfortSaved: "Comfort choice saved",
    comfortPrivacyTitle: "Private comfort check",
    comfortPrivacyBody: "The room sees totals, not your name. You can change what helps anytime.",
    arrivalComfortTitle: "Start gently",
    arrivalComfortBody: "Choose what helps today. The room sees totals, not names.",
    arrivalComfortSaved: (label) => `${label} saved`,
    arrivalComfortRemoved: (label) => `${label} removed`,
    listenFirstAction: "I'll listen first",
    listenFirstSaved: "Listening first saved",
    listenFirstRemoved: "Listening first removed",
    roomDirectionTitle: "Gentle room direction",
    roomDirectionWaiting: "As more people vote, VYVA can suggest one simple next step.",
    roomDirectionBody: (choice, needs) => {
      const base = choice ? `The room is leaning toward ${choice}.` : "The room is still choosing.";
      return needs.length ? `${base} Shape it around ${needs.join(", ")}.` : base;
    },
    roomDirectionTie: (labels, needs) => {
      const base = `The room is still choosing between ${labels.join(" | ")}.`;
      return needs.length ? `${base} Shape it around ${needs.join(", ")}.` : base;
    },
    roomDirectionAction: "Make this a plan",
    roomDirectionDraft: (choice, needs) => {
      const base = `A gentle version of ${choice ?? "today's room choice"}`;
      return needs.length ? `${base} with ${needs.join(", ")}.` : `${base}.`;
    },
    roomDirectionViewAction: "Share a view",
    roomDirectionViewDraft: "I would like to hear gentle views about what matters to us today.",
    roomRecapAction: "Ask VYVA for a recap",
    roomRecapDraft: (choice, needs) => {
      const base = choice ? `VYVA, please summarize the room choice about ${choice}` : "VYVA, please summarize what is happening in the room";
      return needs.length ? `${base} and the comfort needs: ${needs.join(", ")}.` : `${base}.`;
    },
    roomSummaryTitle: "Room summary",
    roomSummaryLabels: {
      vote: "Vote",
      comfort: "Comfort",
      interest: "Interest",
      views: "Views",
      next: "Next",
    },
    roomSummaryVoteWaiting: "Still open",
    roomSummaryVoteTie: (labels) => `Tied: ${labels.join(" | ")}`,
    roomSummaryComfortWaiting: "Waiting for answers",
    roomSummaryNextWaiting: "Vote or share one small idea.",
    roomSummaryNextReady: (choice, needs) => {
      const parts = [choice, needs.length ? needs.join(" | ") : ""].filter(Boolean);
      return parts.length ? `Make one calm plan around ${parts.join(" | ")}.` : "Make one calm plan.";
    },
    roomSummaryNextView: "Share one kind view, with no pressure.",
    roomSummaryNextTie: "Keep voting or ask VYVA for a simple recap.",
    roomCommonGroundTitle: "Common ground",
    roomCommonGroundBody: "What the room knows now, without exposing names.",
    roomCommonGroundVote: "Votes stay private; only totals are shown.",
    roomCommonGroundComfortReady: (needs) => `Prepare around ${needs.join(" | ")}.`,
    roomCommonGroundComfortWaiting: "You can say what helps before joining.",
    roomCommonGroundInterestReady: (count) => `${count} ${count === 1 ? "person shows" : "people show"} interest, still no commitment.`,
    roomCommonGroundInterestWaiting: "Interest can start with Maybe later.",
    roomCommonGroundViewsReady: (count) => `${count} shared ${count === 1 ? "view" : "views"}, with review nearby.`,
    roomCommonGroundViewsWaiting: "Views can stay short and kind.",
    roomOutcomeTitle: "What VYVA will do next",
    roomOutcomeBody: (choice, needs, context) => {
      if (context === "tie") return `VYVA will keep ${choice ?? "the options"} open and summarize them before anyone feels rushed.`;
      if (context === "views") return "VYVA will keep the view circle kind and bring the main points back as a simple recap.";
      if (context === "plan") {
        const base = `VYVA will shape ${choice ?? "the leading choice"}`;
        return needs.length ? `${base} around ${needs.join(", ")} before anyone commits.` : `${base} before anyone commits.`;
      }
      if (context === "comfort") return `VYVA will use ${needs.join(", ")} to make the next plan easier.`;
      return "When more choices arrive, VYVA will turn them into one calm next step.";
    },
    roomOutcomeSteps: {
      private: "Use private totals, not names",
      shape: "Turn choices into one clear next step",
      safety: "Keep contact and safety inside VYVA",
    },
    roomAtGlanceTitle: "Today in the room",
    roomAtGlanceUpdatesClear: "No new updates",
    roomAtGlanceUpdates: (count) => `${count} ${count === 1 ? "update" : "updates"}`,
    roomAtGlanceVotes: (count) => `${count} ${count === 1 ? "vote" : "votes"}`,
    roomAtGlancePlanInterest: (count) => `${count} ${count === 1 ? "person interested" : "people interested"}`,
    roomAtGlanceComfort: (count) => `${count} comfort ${count === 1 ? "signal" : "signals"}`,
    mySafeChoicesTitle: "My safe choices",
    mySafeChoicesBody: "A private snapshot of what you have chosen so far.",
    mySafeChoicesPrivate: "The room sees totals, not your name.",
    privateNoteTitle: "Private note",
    privateNotePlaceholder: "What I want to remember...",
    privateNoteSave: "Save note",
    privateNoteClear: "Clear",
    privateNoteSaved: "Private note saved",
    privateNoteCleared: "Private note cleared",
    privateNotePrivate: "Saved only on this device.",
    privateNoteLength: (remaining) => `${remaining} characters left`,
    mySafeReviewsTitle: "VYVA review updates",
    mySafeReviewsBody: "Only you see these review states. The room does not see who asked.",
    mySafeReviewLabels: {
      shared: "Shared item",
      reply: "Reply",
      poll: "Vote",
      room: "Room",
    },
    mySafeChoiceLabels: {
      plan: "Activity",
      vote: "Vote",
      comfort: "Comfort",
      help: "Help",
    },
    mySafeChoicePlanNone: "No activity choice yet",
    mySafeChoicePlanJoin: "Interested, not committed",
    mySafeChoicePlanMaybe: "Saved for later",
    mySafeChoicePlanNotForMe: "Private pass",
    mySafeChoiceVoteNone: "No vote yet",
    mySafeChoiceIssueVote: (question, choice) => `${question}: ${choice}`,
    mySafeChoiceComfortNone: "No comfort choice yet",
    mySafeChoiceHelpNone: "No helper choice yet",
    mySafeChoiceHelp: (planTitle, helpers) => `${planTitle}: ${helpers.join(" | ")}`,
    mySafeChoiceActionLabels: {
      comfort: "Add comfort choice",
      vote: "Vote privately",
      plan: "Choose activity",
    },
    mySafePauseAction: "Pause quietly",
    mySafePauseActiveAction: "Quiet pause on",
    mySafePauseStatus: "Quiet pause is on. Nothing is posted.",
    mySafePauseFailed: "Quiet pause could not be updated. Please try again.",
    mySafePauseNote: "You can keep reading without telling the room.",
    mySafePauseClearedForAction: "Quiet pause turned off so this could be sent.",
    mySafeLeaveAction: "Leave quietly",
    mySafeLeaveNote: "No one is notified.",
    roomTrustTitle: "Safe to join",
    roomTrustBody: "Three reminders before you take part. You can ask VYVA to check them in simple words.",
    roomTrustItems: {
      privacy: "Votes, comfort choices and Maybe stay unnamed.",
      kindness: "Views should stay kind; VYVA can review anything uncomfortable.",
      contact: "Private contact stays inside VYVA until both people agree.",
    },
    roomTrustAction: "Ask VYVA to check",
    roomTrustDraft: "VYVA, can you check whether this room feels safe to join today? Please summarize privacy, kindness, and contact safety in simple words, without names.",
    roomTrustIntroAction: "Explain this room",
    roomTrustIntroDraft: "VYVA, please explain this room in one minute: how to vote, share a view, choose an activity, and stay safe, without names or pressure.",
    participationPathTitle: "Choose your way in",
    participationPathBody: "Three simple ways to join without reading the whole room first.",
    participationPathLabels: {
      vote: "Vote privately",
      view: "Share a view",
      activity: "Activities for you",
    },
    participationPathBodies: {
      vote: "Choose one option. The room only sees totals.",
      view: "Write one kind sentence; VYVA review stays nearby.",
      activity: "Open recommended activities chosen for your profile.",
    },
    participationPathActions: {
      vote: "Go to vote",
      view: "Write a view",
      activity: "See activities",
    },
    participationPathPrivacy: "Looking first is welcome. No path shares private contact.",
    nextGentleStepLabel: "Best next tap",
    nextGentleSteps: {
      promise: {
        title: "First, keep the room safe",
        body: "Read the room promise. It helps views, votes, and plans stay kind.",
        action: "I understand",
      },
      updates: {
        title: "Something new is waiting",
        body: "Check the updates before replying, so you can join in calmly.",
        action: "See updates",
      },
      comfort: {
        title: "Start in the way that fits",
        body: "You can listen first. The room sees totals, not your name.",
        action: "Listen first",
      },
      vote: {
        title: "Help the room choose",
        body: "A private vote helps the room decide what to do next.",
        action: "Review choices",
      },
      plan: {
        title: "Save your interest",
        body: "You can join or say maybe. It is not a commitment.",
        action: "See the plan",
      },
      recap: {
        title: "Ask for a simple recap",
        body: "VYVA can turn votes, comfort needs, and plans into one simple note.",
        action: "Ask for recap",
      },
      hello: {
        title: "Start small",
        body: "One kind hello is enough to enter without pressure.",
        action: "Say hello",
      },
    },
    nextGentleStepExplainAction: "Why this tap?",
    nextGentleStepExplainDraft: (stepTitle) => (
      `VYVA, I am not sure where to start. Please explain why "${stepTitle}" is the safest next tap and give me one simple option, without names or pressure.`
    ),
    roomReadinessTitle: "Before we move ahead",
    roomReadinessBody: "VYVA checks these three things so the next step feels clear and safe.",
    roomReadinessLabels: {
      vote: "Vote",
      comfort: "Comfort",
      consent: "Consent",
    },
    roomReadinessVoteReady: "The room has a leading choice.",
    roomReadinessVoteWaiting: "Waiting for a few votes.",
    roomReadinessComfortReady: "Comfort needs are visible.",
    roomReadinessComfortWaiting: "Waiting for what would help.",
    roomReadinessConsentReady: "Contact stays inside VYVA until both people agree.",
    roomUsefulTitle: "Useful next steps",
    roomUsefulBody: "VYVA shows what it can help with now, without names or pressure.",
    roomUsefulLabels: {
      activity: "Activity",
      vote: "Issue vote",
      views: "Views",
    },
    roomUsefulReady: {
      activity: "Ready for VYVA to prepare one safe next step.",
      vote: "A question has support and can become a private vote.",
      views: "There are views to recap gently.",
    },
    roomUsefulWaiting: {
      activity: "Still needs interest, comfort, or one small helper.",
      vote: "Waiting for a question to get support.",
      views: "No shared views to recap yet.",
    },
    roomUsefulActions: {
      activity: "Prepare activity",
      vote: "Make vote",
      views: "Recap views",
    },
    roomUsefulWaitingActions: {
      activity: "Help activity",
      vote: "Suggest vote",
      views: "Share view",
    },
    roomUsefulPrivacy: "VYVA uses signals and totals, not names.",
    roomNotesTitle: "Today's room notes",
    roomNotesBody: "A simple record of what the room knows now, so no one has to keep it all in mind.",
    roomNotesLabels: {
      known: "Known now",
      open: "Still open",
      next: "Next help",
    },
    roomNotesVoteKnown: (label) => `Vote: ${label}.`,
    roomNotesVoteTie: (labels) => `Vote is tied: ${labels.join(" | ")}.`,
    roomNotesVoteWaiting: "Vote: still open.",
    roomNotesComfortKnown: (labels) => `Comfort: ${labels.join(" | ")}.`,
    roomNotesComfortWaiting: "Comfort: waiting for one signal.",
    roomNotesViewsKnown: (count) => `${count} shared ${count === 1 ? "view" : "views"}.`,
    roomNotesViewsWaiting: "Views: none yet.",
    roomNotesOpenItems: {
      vote: "A few private choices are still needed.",
      comfort: "One comfort signal is still needed.",
      views: "One calm view is still welcome.",
      activity: "The activity is still being shaped.",
    },
    roomNotesOpenReady: "Nothing urgent. The room can move gently.",
    roomNotesNextActivity: (title) => `VYVA can prepare "${title}" as one safe step.`,
    roomNotesNextVote: (title) => `VYVA can turn "${title}" into one simple private vote.`,
    roomNotesNextViews: (count) => `VYVA can recap ${count === 1 ? "this view" : "these views"} without names.`,
    roomNotesNextStarter: "Start with hello, a comfort choice, or one private vote.",
    roomNotesNextActions: {
      activity: "Prepare this step",
      vote: "Make this vote",
      views: "Recap views",
      starter: "Choose a gentle start",
    },
    roomNotesCopyAction: "Copy no-name notes",
    roomNotesCopied: "No-name notes copied",
    roomNotesCopyFailed: "Could not copy notes",
    roomNotesPrivacy: "These notes use totals and signals, not names.",
    responseNone: "You can be first to choose.",
    responseJoinCount: (count) => `${count} joining`,
    responseMaybeCount: (count) => `${count} maybe`,
    responseNotForMeCount: (count) => `${count} passing`,
    morePlans: "You could also",
    roomUpdates: "Room updates",
    roomUpdatesShowing: (visible, total) => `Showing latest ${visible} of ${total} updates`,
    roomUpdatesRecapTitle: "Simple update recap",
    roomUpdatesRecapBody: (count) => `VYVA can summarize ${count === 1 ? "this update" : `these ${count} updates`} and name the safest next step without names.`,
    roomUpdatesRecapAction: "Ask for recap",
    roomUpdatesRecapDraft: (count) => (
      count === 1
        ? "VYVA, please summarize this room update in simple words and tell me the safest next step, without names."
        : `VYVA, please summarize these ${count} room updates in simple words and tell me the safest next step, without names.`
    ),
    markUpdateSeen: "Seen",
    markAllUpdatesSeen: "Mark all seen",
    updateSeen: "Update marked as seen",
    updateSeenFailed: "Could not mark it as seen. Please try again.",
    allUpdatesSeen: "All updates marked as seen",
    allUpdatesSeenFailed: "Could not mark all as seen. Please try again.",
    sharedToday: "Shared today",
    viewCircleTitle: "View circle",
    viewCircleBody: "Read what has been shared, then add one kind sentence when you are ready.",
    viewCircleEmpty: "No shared views yet. One small sentence is enough.",
    viewCircleVote: (label, count) => `${label}: ${count} ${count === 1 ? "vote" : "votes"}`,
    viewCircleCount: (count) => `${count} shared ${count === 1 ? "view" : "views"}`,
    viewCircleLatest: "Latest in the room",
    viewCircleAdd: "Add a gentle view",
    viewRecapTitle: "VYVA can recap the views",
    viewRecapBody: (count) => (
      count === 1
        ? "There is 1 shared view. VYVA can bring it back in simple words."
        : `There are ${count} shared views. VYVA can group the main points without showing names.`
    ),
    viewRecapAction: "Recap the views",
    viewRecapDraft: (count) => (
      count === 1
        ? "VYVA, please recap this shared view in simple, kind words without showing names."
        : `VYVA, please recap these ${count} shared views in simple, kind words without showing names.`
    ),
    viewVoteBridgeTitle: "Turn views into a vote",
    viewVoteBridgeBody: (count) => (
      count === 1
        ? "If this view needs a decision, VYVA can suggest one simple private vote."
        : `If these ${count} views show different choices, VYVA can turn them into one simple private vote.`
    ),
    viewVoteBridgeAction: "Prepare private vote",
    viewVoteBridgeDraft: (count) => (
      count === 1
        ? "VYVA, please turn this shared view into one simple private vote with safe choices and no names."
        : `VYVA, please turn these ${count} shared views into one simple private vote with safe choices and no names.`
    ),
    viewBalanceTitle: "Conversation balance",
    viewBalanceBody: "Shows how the room is responding, so a different view can still feel safe.",
    viewBalanceEmpty: "No replies yet.",
    viewBalanceLabels: {
      support: "Same feeling",
      curious: "More context",
      different: "Another view",
      help: "Help offered",
    },
    viewCommonGroundTitle: "Common ground",
    viewCommonGroundOpening: "The conversation is starting. One kind reply can help the room find what is shared.",
    viewCommonGroundAgreement: "A shared signal is forming. VYVA can keep it simple and unrushed.",
    viewCommonGroundCurious: "The room is asking for more context before choosing. That can help everyone decide calmly.",
    viewCommonGroundDifferent: "Different views are present and staying kind. VYVA can recap them without names.",
    viewCommonGroundMixed: "Several signals are present at once. A VYVA recap can turn them into a clear next step.",
    viewCommonGroundPrivacy: "Replies are summarized by tone, not by name.",
    viewSafetyTitle: "Safe disagreement",
    viewSafetyBody: "Different views are welcome when they stay short, kind, and without private details.",
    viewSafetyItems: {
      kind: "Name the idea, not the person.",
      private: "Leave phone, address, money and contact details out.",
      review: "Ask VYVA to review anything that feels uncomfortable.",
    },
    viewSafetyAction: "Start gently",
    viewSafetyDraft: "I see it another way. Can we compare calmly, without names?",
    viewNextReplyTitle: "Next kind reply",
    viewNextReplyBodies: {
      opening: "A small question or agreement can help people feel heard.",
      agreement: "Build on the shared signal with one simple reason.",
      curious: "Ask for one more detail before the room chooses.",
      different: "A gentle question keeps another view safe to share.",
      mixed: "When signals are mixed, ask what matters most before deciding.",
    },
    viewNextReplyActions: {
      opening: "Invite a kind reply",
      agreement: "Add one reason",
      curious: "Ask for detail",
      different: "Ask gently",
      mixed: "Ask what matters most",
    },
    viewNextReplyDrafts: {
      opening: "I would like to hear what feels most important to others.",
      agreement: "I agree, and one reason is...",
      curious: "Could you say a little more about what matters most to you?",
      different: "I see this differently. Could we compare what matters most, calmly?",
      mixed: "Could we pause and say what matters most to each person before choosing?",
    },
    sharedResponseSaved: "Your response is saved",
    reviewItem: "Ask VYVA to review",
    reviewItemSent: "VYVA will review this item gently.",
    reviewItemStatusOpen: "Sent to VYVA",
    reviewItemStatusReviewing: "VYVA is checking this",
    reviewItemStatusResolved: "VYVA checked this",
    reviewItemStatusDismissed: "VYVA looked at this",
    reviewReply: "Review reply",
    withdrawItem: "Hide my share",
    withdrawItemSent: "Your share was removed from the room",
    withdrawItemFailed: "Could not hide it. Please try again.",
    withdrawReply: "Hide my reply",
    withdrawReplySent: "Your reply was removed from the room",
    withdrawReplyFailed: "Could not hide the reply. Please try again.",
    gentleReplies: "Gentle replies",
    replyGuideTitle: "Kind reply space",
    replyGuideBody: "Use one gentle button. If a reply feels wrong, VYVA can review it.",
    planSupportTitle: "Make this easy",
    planSupportBody: "Choose one small kind of help so the plan feels easier for everyone.",
    planSupportSummaryTitle: "Activity helpers",
    planSupportSummaryBody: "These are the small ways people are helping the plan happen.",
    planSupportSummaryEmpty: "No helpers yet. Choose one small way to help below.",
    planHelperCueTitle: "Best small help",
    planHelperCueBody: (actionLabel) => `The most useful help now is ${actionLabel}. It gives VYVA a practical signal without committing anyone.`,
    planHelperCueCoveredTitle: "Helper choices are covered",
    planHelperCueCoveredBody: (labels) => `Already covered: ${labels.join(", ")}. Another helper is optional.`,
    planHelperCueAction: (actionLabel) => `Choose ${actionLabel}`,
    planHelperCuePrivate: "This posts only a helper signal, not private contact.",
    planSupportRemoveAction: (actionLabel) => `Remove ${actionLabel}`,
    planSupportRemovePrivate: "This removes only your helper signal.",
    planSupportRemoved: "Helper choice removed",
    planReadinessTitle: "Ready for the next step",
    planReadinessBody: (ready, total) => `${ready} of ${total} signals are ready. VYVA waits for what is missing without pressure.`,
    planReadinessInterestReady: (count) => `${count} ${count === 1 ? "person shows" : "people show"} interest.`,
    planReadinessInterestWaiting: "Waiting for interest: Join or Maybe later.",
    planReadinessHelperReady: (count) => `${count} small ${count === 1 ? "helper is" : "helpers are"} offered.`,
    planReadinessHelperWaiting: "One small helper would make this easier.",
    planReadinessComfortReady: "Comfort is already named.",
    planReadinessComfortWaiting: "Still needs what would make this comfortable.",
    planReadinessVyvaReady: "VYVA confirms details before any contact.",
    activityReadyTitle: "VYVA can prepare this",
    activityReadyBody: (planTitle) => `"${planTitle}" has interest, comfort notes, and a helper. VYVA can confirm details before anyone commits.`,
    activityReadySignalsTitle: "Signals without names",
    activityReadyPrivate: "Private and no pressure",
    activityReadyPrepTitle: "Before VYVA prepares it",
    activityReadyPrepItems: [
      "Confirm place, time, cost and access.",
      "Keep contact inside VYVA until both people agree.",
      "Bring back one simple next step, not a commitment.",
    ],
    activityReadyAction: "Ask VYVA for the next step",
    activityReadyDraft: (planTitle, signals) => (
      signals.length
        ? `VYVA, "${planTitle}" looks ready. Room signals: ${signals.join("; ")}. Can you prepare the next simple and safe step?`
        : `VYVA, "${planTitle}" looks ready. Can you prepare the next simple and safe step for the room?`
    ),
    voteReadyTitle: "This question is ready",
    voteReadyBody: (questionTitle) => `"${questionTitle}" has support. VYVA can turn it into one simple private room vote with no names.`,
    voteReadyPrivate: "Names stay hidden",
    voteReadyAction: "Ask VYVA to make the vote",
    planSupportActions: {
      choose: "Help choose",
      pace: "Quiet pace",
      buddy: "Meet together",
      notify: "Keep me posted",
    },
    planSupportReplies: {
      choose: "I can help choose one simple option for the group.",
      pace: "A quiet pace with room to pause would help me.",
      buddy: "It would help to meet with someone before joining.",
      notify: "Please keep me posted when there is a next step.",
    },
    replySent: "Reply shared",
    replyFailed: "Could not share the reply. Please try again.",
    replyActions: {
      support: "I feel the same",
      curious: "Tell me more",
      help: "I can help",
      different: "Another view",
    },
    replyBodies: {
      support: "I feel the same. Thank you for sharing it.",
      curious: "I would like to hear a little more, if you want to share it.",
      help: "I can help with one small step inside the room.",
      different: "I see it a little differently, and I appreciate you sharing it.",
    },
    supportIdea: "Join this",
    maybeIdea: "Maybe",
    sharedKindLabels: {
      plan: "Plan",
      message: "Hello",
      question: "Question",
    },
    sharedViewLabel: "View",
    sharedActions: {
      plan: { primary: "Join this", secondary: "Maybe" },
      message: { primary: "Me too", secondary: "Thank you" },
      question: { primary: "Help me too", secondary: "Follow" },
    },
    issueQueueTitle: "Questions for a future vote",
    issueQueueBody: "When someone asks to clarify an issue, VYVA keeps it here so the room can support it without pressure.",
    issueQueueBadge: "Possible vote",
    issueQueueAction: "Make it a vote",
    issueQueueDraft: (title) => `VYVA, please turn "${title}" into one simple room vote with safe choices and no names.`,
    issueQueueUseAction: "Summarize this vote",
    issueQueueUseDraft: (title, signal) => (
      signal
        ? `VYVA, please summarize the private vote about "${title}". The current signal is: ${signal}. Help the room choose a safe next step, without names.`
        : `VYVA, please summarize the private vote about "${title}" and help the room choose a safe next step, without names.`
    ),
    issueQueuePrivacy: "Supporting a question only shows interest. The room does not see your name.",
    issueReadinessTitles: {
      gathering: "Gathering support",
      vote: "Ready for a vote",
      summary: "Ready to summarize",
    },
    issueReadinessBodies: {
      gathering: "Tap Help me too or Follow if this question matters to you.",
      vote: "There is interest now. VYVA can turn this into a private vote with no names.",
      summary: (signal) => (
        signal
          ? `The signal is: ${signal}. VYVA can summarize it and suggest one safe next step.`
          : "VYVA can summarize this private vote and suggest one safe next step."
      ),
    },
    issuePollTitle: "Simple vote",
    issuePollBody: "Choose one option. You can change or remove it while voting is open.",
    issuePollClosed: "VYVA paused this vote for review. Totals stay visible, but no new votes are accepted.",
    issuePollPrivacy: "This vote is private too. Only totals are shown.",
    issuePollOutcomeTitle: "Room signal",
    issuePollOutcomeBody: (label) => `Right now the room is leaning toward: ${label}. VYVA can use this without showing names.`,
    issuePollOutcomeTie: (labels) => `The room is split between ${labels.join(" | ")}. VYVA can summarize this without rushing anyone.`,
    issuePollOutcomeOtherViews: "Other choices still count. VYVA can include them without names.",
    issuePollOutcomeOpen: "People can still choose another option while voting stays open.",
    proposalPlaceholder: "Write one small idea...",
    proposalLengthHint: (remaining) => `${remaining} characters left`,
    proposalSafetyWarning: "Please remove phone, email, address or payment details before sending.",
    proposalToneWarning: "Please use kind words before sending. VYVA can help rewrite it.",
    proposalToneRewrite: "Soften wording",
    proposalToneRewriteDrafts: {
      plan: "Could we make this gentle and easy for everyone?",
      message: "I see it another way because...",
      question: "Could we think this through kindly together?",
    },
    proposalCategoryPrompt: "What kind of experience?",
    proposalPlacePrompt: "What would fit best?",
    proposalTimePrompt: "When works best?",
    proposalCostPrompt: "Cost",
    proposalGroupPrompt: "How to join?",
    composerPreviewTitle: "Before you send",
    composerPreviewBodies: {
      plan: "This idea will be shared as a plan so others can join or choose Maybe.",
      message: "This note will be shared as a short view, with gentle replies nearby.",
      question: "This question will be shared so VYVA can help or turn it into a vote.",
    },
    composerPreviewItems: {
      plan: {
        shared: "The room sees the plan, not your private choices.",
        private: "Votes, comfort choices and Maybe stay unnamed.",
        next: "VYVA reviews cost, contact, transport or service details before moving ahead.",
      },
      message: {
        shared: "The room sees the sentence and can reply with gentle buttons.",
        private: "Keep phone, email and exact address out.",
        next: "If wording feels sharp, VYVA can soften it first.",
      },
      question: {
        shared: "The room sees the question, not who needs help.",
        private: "Your votes and comfort needs stay private.",
        next: "VYVA can turn this into one simple vote with totals.",
      },
    },
    safeShareTitle: "Share safely",
    safeShareBody: "Keep phone, email, exact address and payment details out of this note.",
    safeShareReviewLine: "If cost, transport, housing or service details matter, VYVA reviews before the next step.",
    planNearby: "Nearby",
    planOnline: "Online",
    comfortPrompt: "What would help?",
    comfortNeedLabels: {
      listen_first: "Listen first",
      quiet_pace: "Quiet pace",
      easy_access: "Easy access",
      seating: "Place to sit",
      transport_help: "Transport help",
      arrival_buddy: "Meet together",
      clear_cost: "Know cost first",
    },
    moreComfortNotes: (count) => `${count} more comfort ${count === 1 ? "note" : "notes"}`,
    categoryLabels: {
      movie_date: "Movie date",
      restaurant_date: "Restaurant date",
      home_share: "Home or rental",
      service_booking: "Book a service",
      deal_help: "Negotiate a deal",
      outing: "Outing",
      other: "Other idea",
    },
    timeLabels: {
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      flexible: "Flexible",
    },
    costLabels: {
      free: "Free",
      low: "Low",
      shared: "Shared",
      discuss: "Discuss first",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Small group",
      open_room: "Open room",
    },
    fitLabel: "Good fit",
    reviewBadge: "VYVA reviews before the next step",
    reviewReasons: {
      money: "money",
      housing: "housing",
      service: "service",
      private_contact: "contact",
      transport: "transport",
      unkind_tone: "tone",
    },
    postFailed: "Could not post it. Please try again.",
    send: "Send",
    cancel: "Cancel",
    sending: "Sending...",
    sent: "Sent",
    reviewPending: "VYVA will review this before it appears.",
    helpSent: "VYVA will review this gently.",
    helpSending: "Contacting VYVA...",
    helpFailed: "Could not alert VYVA. Please try again.",
    safetyHelpTitle: "What should VYVA check?",
    safetyHelpBody: "Choose the closest concern. The room will not see this help request.",
    safetyHelpUrgentNote:
      "If something urgent is happening now, use local emergency help. VYVA is not a substitute for immediate help.",
    safetyHelpChoiceLabels: {
      uncomfortable: "I feel uneasy",
      pressure_contact: "Pressure or contact",
      money_service: "Money or service",
      something_else: "Something else",
    },
    safetyHelpChoiceBodies: {
      uncomfortable: "Something in the room does not feel right.",
      pressure_contact: "Someone is asking for private contact or pushing.",
      money_service: "There is a cost, payment, offer or service to review.",
      something_else: "I want VYVA to look at the room.",
    },
    safetyHelpChoiceReasons: {
      uncomfortable: "feels_uncomfortable",
      pressure_contact: "pressure_or_contact",
      money_service: "money_or_service",
      something_else: "other_safety_help",
    },
    safetyHelpChoiceDetails: {
      uncomfortable: "The user says something in the Together Room feels uncomfortable.",
      pressure_contact: "The user wants VYVA to review possible pressure or private contact.",
      money_service: "The user wants VYVA to review money, cost, an offer or a service.",
      something_else: "The user wants general safety help in the Together Room.",
    },
    safetyHelpReceiptTitle: "Help request sent",
    safetyHelpReceiptBody: (choiceLabel) => `VYVA will review: ${choiceLabel}. The room will not see this request.`,
    safetyHelpReceiptItems: [
      "VYVA reviews it without showing your name.",
      "You can pause the room and come back later.",
      "If something urgent is happening now, use local emergency help.",
    ],
    viewSharingNote: "You can share a short view with kind words and no personal contact details.",
    viewTonePreviewTitle: "Safe view preview",
    viewTonePreviewReady: "Ready to share gently",
    viewTonePreviewNeedsEdit: "Needs a small edit",
    viewTonePreviewItems: {
      kind: "Kind words",
      privacy: "No private contact",
      small: "One small view",
    },
    viewPromptTitle: "Kind view starters",
    viewPromptBody: "Choose one phrase if words feel hard today.",
    viewPromptLabels: {
      agree: "I agree",
      different: "Another view",
      compare: "Compare options",
      more_info: "Need more info",
    },
    viewPromptDrafts: {
      agree: "I agree because...",
      different: "I see it another way because...",
      compare: "VYVA, can you help us compare the options calmly?",
      more_info: "I need a little more information before choosing.",
    },
    askPromptTitle: "Easy questions for VYVA",
    askPromptBody: "Choose one if you are not sure how to ask.",
    askPromptLabels: {
      summary: "Summarize",
      easier: "Make it easier",
      vote: "Suggest a vote",
      safe: "Safety check",
    },
    askPromptDrafts: {
      summary: "VYVA, can you summarize what the room is choosing?",
      easier: "VYVA, help me find the easiest way to join in.",
      vote: "VYVA, can you turn this into a simple room vote?",
      safe: "VYVA, can you check if this feels safe and no-pressure?",
    },
    issuePromptTitle: "Turn a concern into a vote",
    issuePromptBody: "Choose a common issue if you want VYVA to suggest a simple room vote.",
    issuePromptLabels: {
      place: "Place",
      time: "Time",
      cost: "Cost",
      safety: "Safety",
    },
    issuePromptDrafts: {
      place: "VYVA, can you suggest a simple vote about which place would feel most comfortable for the room?",
      time: "VYVA, can you suggest a simple vote about which time would work best?",
      cost: "VYVA, can you suggest a simple vote to clarify cost before anyone commits?",
      safety: "VYVA, can you suggest a simple vote about what would make this safer and no-pressure?",
    },
    sharePlanTitle: "Share a plan",
    sharePlanBody: "Suggest one simple idea so others can join or say maybe.",
    sharePlanAction: "Share a plan",
    discussionTitle: "What would you like to say?",
    discussionBody: "You can start small. VYVA can help if you are not sure how.",
    starterLabels: {
      hello: "Say hello",
      plan: "Suggest a plan",
      ask: "Ask VYVA",
    },
    agreementTitle: "Our room promise",
    agreementLines: [
      "Use kind words and no pressure.",
      "Share views without judging.",
      "Ask VYVA if something feels wrong.",
    ],
    acknowledgementLabel: "I understand",
    acknowledgedLabel: "Room promise saved",
    acknowledgementFailed: "Could not save it. Please try again.",
    starterDetails: {
      hello: "I would like to say hello and hear what others think.",
      plan: "I would like to share a gentle plan.",
      ask: "VYVA, help me choose an easy way to join in.",
    },
  },
};

const simpleRoomCopy: Record<SocialLanguage, {
  mainStepLabel: string;
  moreOptions: string;
  hideOptions: string;
  moreOptionsBody: string;
  planFinePrint: string;
}> = {
  es: {
    mainStepLabel: "Paso de hoy",
    moreOptions: "Mas opciones de la sala",
    hideOptions: "Ocultar opciones",
    moreOptionsBody: "Voto, comodidad, mensajes, notas y mas planes.",
    planFinePrint: "Sin compromiso. El contacto privado sigue dentro de VYVA.",
  },
  de: {
    mainStepLabel: "Heutiger Schritt",
    moreOptions: "Mehr Raumoptionen",
    hideOptions: "Optionen ausblenden",
    moreOptionsBody: "Abstimmung, Komfort, Nachrichten, Notizen und weitere Plaene.",
    planFinePrint: "Ohne Verpflichtung. Privater Kontakt bleibt in VYVA.",
  },
  en: {
    mainStepLabel: "Today's step",
    moreOptions: "More room options",
    hideOptions: "Hide options",
    moreOptionsBody: "Vote, comfort, messages, notes and more plans.",
    planFinePrint: "No commitment. Private contact stays inside VYVA.",
  },
};

const compactRoomDetailTargets = new Set([
  "together-room-choice",
  "together-comfort-check",
  "together-support-panels",
  "together-room-updates",
  "together-safety-help",
  "together-participation-path",
]);

function fallbackPulse(language: SocialLanguage): SocialRoomPulse {
  const titles = {
    es: "Te y charla de pelicula",
    de: "Tee und Filmgespraech",
    en: "Tea and film chat",
  };
  const bodies = {
    es: "Elegid una pelicula tranquila y comentadla sin prisa.",
    de: "Waehlt einen ruhigen Film und sprecht ohne Eile darueber.",
    en: "Choose a gentle film and talk about it without rushing.",
  };
  const question = {
    es: "Que os apeteceria compartir hoy?",
    de: "Was wuerde sich heute gut anfuehlen?",
    en: "What would feel good to share today?",
  };
  const options = {
    es: ["Pelicula", "Comida", "Compartir opiniones"],
    de: ["Film", "Essen", "Ansichten teilen"],
    en: ["Film chat", "Quiet lunch", "Share views"],
  };
  const safety = {
    es: {
      title: "Circulo pequeno y seguro",
      body: "VYVA cuida el tono amable y ayuda si algo incomoda.",
      consentLine: "El contacto solo se comparte si ambas personas aceptan.",
      helpLabel: "Ayuda o seguridad",
      agreementTitle: "Nuestra promesa de sala",
      agreementLines: [
        "Palabras amables y sin presion.",
        "Compartimos opiniones sin juzgar.",
        "Pide ayuda a VYVA si algo incomoda.",
      ],
      acknowledgementLabel: "Lo entiendo",
      acknowledgedLabel: "Promesa de sala guardada",
      myAcknowledgedAt: null,
      myQuietPausedAt: null,
    },
    de: {
      title: "Geschuetzter kleiner Kreis",
      body: "VYVA achtet auf einen freundlichen Ton und hilft, wenn etwas unangenehm ist.",
      consentLine: "Kontakt wird nur geteilt, wenn beide Personen zustimmen.",
      helpLabel: "Hilfe oder Sicherheit",
      agreementTitle: "Unser Raumversprechen",
      agreementLines: [
        "Freundliche Worte, kein Druck.",
        "Meinungen teilen ohne zu urteilen.",
        "VYVA fragen, wenn etwas unangenehm ist.",
      ],
      acknowledgementLabel: "Ich verstehe",
      acknowledgedLabel: "Raumversprechen gespeichert",
      myAcknowledgedAt: null,
      myQuietPausedAt: null,
    },
    en: {
      title: "Safe small circle",
      body: "VYVA keeps the tone kind and can help if something feels uncomfortable.",
      consentLine: "Contact is shared only when both people agree.",
      helpLabel: "Help or safety",
      agreementTitle: "Our room promise",
      agreementLines: [
        "Use kind words and no pressure.",
        "Share views without judging.",
        "Ask VYVA if something feels wrong.",
      ],
      acknowledgementLabel: "I understand",
      acknowledgedLabel: "Room promise saved",
      myAcknowledgedAt: null,
      myQuietPausedAt: null,
    },
  };

  const featuredPlan: SocialRoomPlan = {
    id: "tea-film-chat",
    key: "tea-film-chat",
    kind: "plan",
    title: titles[language],
    body: bodies[language],
    locationLabel: "online",
    comfortNeeds: ["quiet_pace"],
    experienceCategory: "movie_date",
    preferredTime: "evening",
    costRange: "free",
    groupSize: "small_group",
    safetyFlags: [],
    needsReview: false,
    fitReasons: [
      copyByLanguage[language].planOnline,
      copyByLanguage[language].timeLabels.evening,
      copyByLanguage[language].costLabels.free,
      copyByLanguage[language].groupLabels.small_group,
    ],
    startsAt: null,
    status: "active",
    responseCounts: { join: 0, maybe: 0, not_for_me: 0 },
    myResponse: null,
  };

  return {
    featuredPlan,
    secondaryPlans: [],
    postedExperiences: [],
    memberPresence: [],
    activePoll: {
      id: "daily-room-choice",
      key: "daily-room-choice",
      question: question[language],
      status: "active",
      options: options[language].map((label, index) => ({ id: ["film", "lunch", "views"][index], label, votes: 0 })),
      totalVotes: 0,
      myVote: null,
    },
    issuePolls: [],
    comfortCheck: {
      title: copyByLanguage[language].comfortCheckTitle,
      body: copyByLanguage[language].comfortCheckBody,
      options: comfortNeedOptions.map((need) => ({
        id: need,
        label: copyByLanguage[language].comfortNeedLabels[need],
        count: 0,
      })),
      myComfortNeeds: [],
      totalResponses: 0,
    },
    discussionPrompt: {
      id: "gentle-start",
      title: copyByLanguage[language].discussionTitle,
      body: copyByLanguage[language].discussionBody,
      starterButtons: [
        copyByLanguage[language].starterLabels.hello,
        copyByLanguage[language].starterLabels.plan,
        copyByLanguage[language].starterLabels.ask,
      ],
      dailyQuestion: fallbackDailyQuestion(language),
    },
    safety: safety[language],
    visibility: fallbackVisibility(language),
    joiningSupportCue: fallbackJoiningSupportCue(language),
    notifications: [],
    unreadNotificationCount: 0,
  };
}

function fallbackDailyQuestion(language: SocialLanguage): NonNullable<SocialRoomPulse["discussionPrompt"]["dailyQuestion"]> {
  if (language === "de") {
    return {
      id: "today-gentle-question",
      title: "Sanfte Frage fuer heute",
      body: "Was wuerde es dir heute leichter machen, dich im Raum zu beteiligen?",
      draft: "Heute wuerde es mir leichter fallen, mitzumachen, wenn...",
      actionLabel: "Sanft antworten",
      privacyLine: "Deine Antwort wird erst geteilt, wenn du sie sendest. VYVA prueft private Details vorher.",
    };
  }

  if (language === "en") {
    return {
      id: "today-gentle-question",
      title: "Today's gentle question",
      body: "What would make it easier for you to join in today?",
      draft: "What would make it easier for me to join today is...",
      actionLabel: "Answer gently",
      privacyLine: "Your answer is shared only when you choose to post it. VYVA checks private details first.",
    };
  }

  return {
    id: "today-gentle-question",
    title: "Pregunta amable de hoy",
    body: "Que haria mas facil participar hoy en la sala?",
    draft: "Lo que me haria mas facil participar hoy es...",
    actionLabel: "Responder con calma",
    privacyLine: "Tu respuesta solo se comparte cuando la envias. VYVA revisa antes los detalles privados.",
  };
}

function fallbackJoiningSupportCue(language: SocialLanguage): NonNullable<SocialRoomPulse["joiningSupportCue"]> {
  if (language === "de") {
    return {
      id: "gentle-joining-support",
      title: "Mitmachen leichter machen",
      body: "Wenn Mitmachen heute schwer wirkt, hilft VYVA mit einem einfachen ersten Schritt.",
      actionLabel: "Hilfe zum Mitmachen fragen",
      draft: "VYVA, bitte hilf mir, heute den leichtesten sicheren Weg in diesen Raum zu finden. Kontakt bleibt privat und du nutzt Summen, keine Namen.",
      privacyLine: "Diese Frage geht an VYVA. Der Raum sieht weiter nur Summen, keine Namen.",
      needIds: [],
    };
  }

  if (language === "en") {
    return {
      id: "gentle-joining-support",
      title: "Make joining easier",
      body: "If joining feels hard today, VYVA can help choose one easy first step.",
      actionLabel: "Ask for joining help",
      draft: "VYVA, please help me find the easiest safe way to join this room today. Keep contact private and use totals, not names.",
      privacyLine: "This asks VYVA only. The room still sees totals, not names.",
      needIds: [],
    };
  }

  return {
    id: "gentle-joining-support",
    title: "Hacer mas facil participar",
    body: "Si participar hoy parece dificil, VYVA puede ayudar con un primer paso facil.",
    actionLabel: "Pedir ayuda para participar",
    draft: "VYVA, ayudame a encontrar la forma mas facil y segura de participar hoy en esta sala. Manten el contacto privado y usa totales, no nombres.",
    privacyLine: "Esto solo pregunta a VYVA. La sala sigue viendo totales, no nombres.",
    needIds: [],
  };
}

function fallbackVisibility(language: SocialLanguage): NonNullable<SocialRoomPulse["visibility"]> {
  if (language === "de") {
    return {
      title: "Wer was sieht",
      body: "Eine ruhige Erinnerung, bevor du tippst.",
      items: [
        {
          id: "private",
          title: "Privat fuer dich",
          body: "Deine Stimme, Komfortwuensche und Vielleicht-Wahl zeigen deinen Namen nicht.",
        },
        {
          id: "totals",
          title: "Der Raum sieht Summen",
          body: "Der Raum sieht Zaehler wie Stimmen, Interesse und Komfortwuensche.",
        },
        {
          id: "shared",
          title: "Im Raum geteilt",
          body: "Plaene, Ansichten und Antworten erscheinen im Raum, mit VYVA-Pruefung in der Naehe.",
        },
      ],
    };
  }

  if (language === "en") {
    return {
      title: "Who sees what",
      body: "A calm reminder before you tap.",
      items: [
        {
          id: "private",
          title: "Private to you",
          body: "Your vote, comfort choices and maybe choice do not show your name.",
        },
        {
          id: "totals",
          title: "Room sees totals",
          body: "The room sees counts like votes, interest and comfort needs.",
        },
        {
          id: "shared",
          title: "Shared with the room",
          body: "Plans, views and replies appear in the room, with VYVA review nearby.",
        },
      ],
    };
  }

  return {
    title: "Quien ve que",
    body: "Un recordatorio tranquilo antes de tocar.",
    items: [
      {
        id: "private",
        title: "Privado para ti",
        body: "Tu voto, tus apoyos de comodidad y 'quiza' no muestran tu nombre.",
      },
      {
        id: "totals",
        title: "La sala ve totales",
        body: "La sala ve conteos como votos, interes y necesidades de comodidad.",
      },
      {
        id: "shared",
        title: "Compartido en la sala",
        body: "Planes, opiniones y respuestas aparecen en la sala, con revision de VYVA cerca.",
      },
    ],
  };
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}

function normalizeSharedLabel(value: string) {
  return value.trim().toLowerCase();
}

function isHelloMessagePlan(plan: SocialRoomPlan, copy: (typeof copyByLanguage)[SocialLanguage]) {
  if ((plan.kind ?? "plan") !== "message") return false;
  const helloLabels = new Set(
    [
      copy.starterLabels.hello,
      copy.nextGentleSteps.hello.action,
      "Say hello",
      "Saludar",
      "Hallo sagen",
    ].map(normalizeSharedLabel),
  );

  return helloLabels.has(normalizeSharedLabel(plan.title));
}

function sharedKindLabelForPlan(plan: SocialRoomPlan, copy: (typeof copyByLanguage)[SocialLanguage]) {
  const kind = plan.kind ?? "plan";
  if (kind !== "message") return copy.sharedKindLabels[kind];

  return isHelloMessagePlan(plan, copy) ? copy.sharedKindLabels.message : copy.sharedViewLabel;
}

function updatePlanResponse(
  pulse: SocialRoomPulse,
  planKey: string,
  response: SocialRoomPlanResponseValue | null,
): SocialRoomPulse {
  const updatePlan = (plan: SocialRoomPlan): SocialRoomPlan => {
    if (plan.key !== planKey) return plan;
    const previous = plan.myResponse;
    const counts = { ...plan.responseCounts };
    if (previous) counts[previous] = Math.max(0, (counts[previous] ?? 0) - 1);
    if (response) counts[response] = (counts[response] ?? 0) + 1;
    return { ...plan, myResponse: response, responseCounts: counts };
  };

  return {
    ...pulse,
    featuredPlan: updatePlan(pulse.featuredPlan),
    secondaryPlans: pulse.secondaryPlans.map(updatePlan),
    postedExperiences: pulse.postedExperiences.map(updatePlan),
  };
}

function updatePlanHelperAction(
  pulse: SocialRoomPulse,
  planKey: string,
  action: PlanCollaborationAction,
  selected = true,
): SocialRoomPulse {
  const updatePlan = (plan: SocialRoomPlan): SocialRoomPlan => {
    if (plan.key !== planKey && plan.id !== planKey) return plan;
    const currentActions = plan.myHelperActions ?? [];
    if (!selected) {
      return {
        ...plan,
        myHelperActions: currentActions.filter((currentAction) => currentAction !== action),
      };
    }
    if (currentActions.includes(action)) return plan;
    return {
      ...plan,
      myHelperActions: [...currentActions, action],
    };
  };

  return {
    ...pulse,
    featuredPlan: updatePlan(pulse.featuredPlan),
    secondaryPlans: pulse.secondaryPlans.map(updatePlan),
    postedExperiences: pulse.postedExperiences.map(updatePlan),
  };
}

function removePostedExperience(pulse: SocialRoomPulse, planKey: string): SocialRoomPulse {
  return {
    ...pulse,
    postedExperiences: pulse.postedExperiences.filter((plan) => plan.key !== planKey && plan.id !== planKey),
  };
}

function removePlanReply(pulse: SocialRoomPulse, planKey: string, replyId: string): SocialRoomPulse {
  const updatePlan = (plan: SocialRoomPlan): SocialRoomPlan => {
    if (plan.key !== planKey && plan.id !== planKey) return plan;
    return {
      ...plan,
      replies: (plan.replies ?? []).filter((reply) => reply.id !== replyId),
    };
  };

  return {
    ...pulse,
    featuredPlan: updatePlan(pulse.featuredPlan),
    secondaryPlans: pulse.secondaryPlans.map(updatePlan),
    postedExperiences: pulse.postedExperiences.map(updatePlan),
  };
}

function updatePollVote(pulse: SocialRoomPulse, optionId: string | null): SocialRoomPulse {
  const previousVote = pulse.activePoll.myVote;
  const options = pulse.activePoll.options.map((option) => {
    let votes = option.votes;
    if (previousVote === option.id) votes = Math.max(0, votes - 1);
    if (optionId && optionId === option.id) votes += 1;
    return { ...option, votes };
  });

  return {
    ...pulse,
    activePoll: {
      ...pulse.activePoll,
      myVote: optionId,
      options,
      totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    },
  };
}

function updateIssuePollVote(pulse: SocialRoomPulse, pollKey: string, optionId: string | null): SocialRoomPulse {
  return {
    ...pulse,
    issuePolls: (pulse.issuePolls ?? []).map((poll) => {
      if (poll.key !== pollKey) return poll;
      const previousVote = poll.myVote;
      const options = poll.options.map((option) => {
        let votes = option.votes;
        if (previousVote === option.id) votes = Math.max(0, votes - 1);
        if (optionId && optionId === option.id) votes += 1;
        return { ...option, votes };
      });

      return {
        ...poll,
        myVote: optionId,
        options,
        totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
      };
    }),
  };
}

function normalizeComfortSelection(needs: SocialRoomComfortNeed[]) {
  return Array.from(new Set(needs.filter((need) => comfortNeedOptions.includes(need)))).slice(0, 7);
}

function updateComfortCheck(pulse: SocialRoomPulse, comfortNeeds: SocialRoomComfortNeed[]): SocialRoomPulse {
  const nextComfortNeeds = normalizeComfortSelection(comfortNeeds);
  const previousComfortNeeds = pulse.comfortCheck.myComfortNeeds ?? [];
  const previousHadResponse = previousComfortNeeds.length > 0;
  const nextHasResponse = nextComfortNeeds.length > 0;
  const countDelta = (need: SocialRoomComfortNeed) => {
    const had = previousComfortNeeds.includes(need);
    const has = nextComfortNeeds.includes(need);
    if (had === has) return 0;
    return has ? 1 : -1;
  };

  return {
    ...pulse,
    comfortCheck: {
      ...pulse.comfortCheck,
      myComfortNeeds: nextComfortNeeds,
      totalResponses: Math.max(
        0,
        pulse.comfortCheck.totalResponses + (previousHadResponse === nextHasResponse ? 0 : nextHasResponse ? 1 : -1),
      ),
      options: pulse.comfortCheck.options.map((option) => ({
        ...option,
        count: Math.max(0, option.count + countDelta(option.id)),
      })),
    },
  };
}

function getPollDirection(pulse: SocialRoomPulse) {
  if (pulse.activePoll.totalVotes <= 0 || pulse.activePoll.options.length === 0) {
    return { leadingOption: null, tiedOptions: [] };
  }

  const topVotes = Math.max(...pulse.activePoll.options.map((option) => option.votes));
  if (topVotes <= 0) return { leadingOption: null, tiedOptions: [] };

  const topOptions = pulse.activePoll.options.filter((option) => option.votes === topVotes);
  return topOptions.length === 1
    ? { leadingOption: topOptions[0], tiedOptions: [] }
    : { leadingOption: null, tiedOptions: topOptions };
}

function getPollLeaders(poll: SocialRoomPulse["activePoll"]) {
  if (poll.totalVotes <= 0 || poll.options.length === 0) return [];
  const topVotes = Math.max(...poll.options.map((option) => option.votes));
  if (topVotes <= 0) return [];
  return poll.options.filter((option) => option.votes === topVotes);
}

function issuePollSignal(poll: SocialRoomPulse["activePoll"] | null | undefined) {
  if (!poll) return null;
  const leaders = getPollLeaders(poll);
  if (!leaders.length) return null;
  const labels = leaders.map((option) => option.label);
  return labels.length === 1 ? labels[0] : labels.join(" | ");
}

function getIssueVoteCount(pulse: SocialRoomPulse) {
  return (pulse.issuePolls ?? []).reduce((sum, poll) => sum + poll.totalVotes, 0);
}

function getRoomVoteCount(pulse: SocialRoomPulse) {
  return pulse.activePoll.totalVotes + getIssueVoteCount(pulse);
}

function getTopComfortLabels(pulse: SocialRoomPulse) {
  return [...pulse.comfortCheck.options]
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((option) => option.label);
}

function getTopComfortNeeds(pulse: SocialRoomPulse) {
  return [...pulse.comfortCheck.options]
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((option) => option.id);
}

function categoryForRoomDirection(optionId?: string | null): SocialRoomExperienceCategory {
  if (optionId === "film") return "movie_date";
  if (optionId === "lunch") return "restaurant_date";
  if (optionId === "views") return "other";
  return "outing";
}

function formatResponseSummary(plan: SocialRoomPlan, copy: (typeof copyByLanguage)[SocialLanguage]) {
  const joinCount = plan.responseCounts.join;
  const maybeCount = plan.responseCounts.maybe;
  const notForMeCount = plan.responseCounts.not_for_me ?? 0;
  const parts = [
    joinCount > 0 ? copy.responseJoinCount(joinCount) : "",
    maybeCount > 0 ? copy.responseMaybeCount(maybeCount) : "",
    notForMeCount > 0 ? copy.responseNotForMeCount(notForMeCount) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : copy.responseNone;
}

function planResponseTotal(plan: SocialRoomPlan) {
  return plan.responseCounts.join + plan.responseCounts.maybe;
}

function issueQuestionTitleFromPoll(pulse: SocialRoomPulse, poll: SocialRoomPulse["activePoll"]) {
  const sourcePlanKey = "sourcePlanKey" in poll ? poll.sourcePlanKey : null;
  const sourceQuestion = sourcePlanKey
    ? pulse.postedExperiences.find((plan) => plan.key === sourcePlanKey)?.title
    : null;
  const fallbackQuestion = poll.question.replace(/^(Vote|Votacion|Abstimmung):\s*/i, "").trim();
  return sourceQuestion?.trim() || fallbackQuestion || poll.question;
}

function mySafeVoteChoice(pulse: SocialRoomPulse, copy: (typeof copyByLanguage)[SocialLanguage]) {
  const choices: string[] = [];
  const myVoteLabel = pulse.activePoll.options.find((option) => option.id === pulse.activePoll.myVote)?.label ?? null;
  if (myVoteLabel) choices.push(myVoteLabel);

  for (const issuePoll of pulse.issuePolls ?? []) {
    const myIssueVoteLabel = issuePoll.options.find((option) => option.id === issuePoll.myVote)?.label ?? null;
    if (!myIssueVoteLabel) continue;
    choices.push(copy.mySafeChoiceIssueVote(issueQuestionTitleFromPoll(pulse, issuePoll), myIssueVoteLabel));
  }

  return choices.length ? choices.join(" | ") : copy.mySafeChoiceVoteNone;
}

function notificationMetadataString(
  notification: SocialRoomPulse["notifications"][number] | null | undefined,
  key: string,
) {
  const value = notification?.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function reportedItemKeysFromPulse(pulse: SocialRoomPulse) {
  return new Set(
    (pulse.safety.reportedItemKeys ?? [])
      .filter((key): key is string => typeof key === "string" && key.length > 0),
  );
}

function reportedItemStatusMapFromPulse(pulse: SocialRoomPulse) {
  const statusMap = new Map<string, string>();
  for (const item of pulse.safety.reportedItemStatuses ?? []) {
    if (typeof item.itemKey === "string" && item.itemKey.length > 0) {
      statusMap.set(item.itemKey, item.status);
    }
  }
  return statusMap;
}

function reviewStatusLabel(
  reportKey: string,
  statusMap: Map<string, string>,
  copy: (typeof copyByLanguage)[SocialLanguage],
) {
  const status = statusMap.get(reportKey);
  if (status === "reviewing") return copy.reviewItemStatusReviewing;
  if (status === "resolved") return copy.reviewItemStatusResolved;
  if (status === "dismissed") return copy.reviewItemStatusDismissed;
  if (status === "open") return copy.reviewItemStatusOpen;
  return copy.reviewItemStatusOpen;
}

function roomPlansForActivity(pulse: SocialRoomPulse) {
  const plans = new Map<string, SocialRoomPlan>();
  [pulse.featuredPlan, ...pulse.secondaryPlans, ...pulse.postedExperiences].forEach((plan) => {
    plans.set(plan.key, plan);
  });
  return Array.from(plans.values());
}

function getPlanInterestCount(pulse: SocialRoomPulse) {
  return roomPlansForActivity(pulse).reduce((total, plan) => (
    total + planResponseTotal(plan)
  ), 0);
}

function mySafeHelperChoice(pulse: SocialRoomPulse, copy: (typeof copyByLanguage)[SocialLanguage]) {
  const choices = roomPlansForActivity(pulse)
    .flatMap((plan) => {
      const helpers = (plan.myHelperActions ?? [])
        .filter((action) => planCollaborationActions.includes(action))
        .map((action) => copy.planSupportActions[action]);
      return helpers.length ? [copy.mySafeChoiceHelp(plan.title, helpers)] : [];
    })
    .slice(0, 2);

  return choices.length ? choices.join(" | ") : copy.mySafeChoiceHelpNone;
}

function chooseNextGentleStep({
  agreementAcknowledged,
  unreadRoomUpdateCount,
  pulse,
  pollClosed,
  hasRoomSignals,
}: {
  agreementAcknowledged: boolean;
  unreadRoomUpdateCount: number;
  pulse: SocialRoomPulse;
  pollClosed: boolean;
  hasRoomSignals: boolean;
}): NextGentleStepId {
  if (!agreementAcknowledged) return "promise";
  if (unreadRoomUpdateCount > 0) return "updates";
  if ((pulse.comfortCheck.myComfortNeeds ?? []).length === 0) return "comfort";
  if (!pollClosed && !pulse.activePoll.myVote) return "vote";
  if (!pulse.featuredPlan.myResponse) return "plan";
  if (hasRoomSignals) return "recap";
  return "hello";
}

function countNewUnreadNotifications(previous: SocialRoomPulse, next: SocialRoomPulse) {
  const previousIds = new Set(previous.notifications.map((notification) => notification.id));
  return next.notifications.filter((notification) => !notification.readAt && !previousIds.has(notification.id)).length;
}

function countUnreadRoomUpdates(pulse: SocialRoomPulse) {
  return pulse.unreadNotificationCount ?? pulse.notifications.filter((notification) => !notification.readAt).length;
}

function countPositivePollChanges(previous: SocialRoomPulse, next: SocialRoomPulse) {
  const previousVotes = new Map(previous.activePoll.options.map((option) => [option.id, option.votes]));
  return next.activePoll.options.reduce((total, option) => (
    total + Math.max(0, option.votes - (previousVotes.get(option.id) ?? 0))
  ), 0);
}

function countPositivePlanResponseChanges(previous: SocialRoomPulse, next: SocialRoomPulse) {
  const previousResponses = new Map(roomPlansForActivity(previous).map((plan) => [
    plan.key,
    plan.responseCounts.join + plan.responseCounts.maybe,
  ]));
  return roomPlansForActivity(next).reduce((total, plan) => (
    total + Math.max(0, plan.responseCounts.join + plan.responseCounts.maybe - (previousResponses.get(plan.key) ?? 0))
  ), 0);
}

function activePlanReplies(plan: SocialRoomPlan) {
  return (plan.replies ?? []).filter((reply) => reply.status === "active");
}

function shortReviewTitle(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 72) return trimmed;
  return `${trimmed.slice(0, 69).trimEnd()}...`;
}

function reviewItemTitle(
  itemKey: string,
  pulse: SocialRoomPulse,
  copy: (typeof copyByLanguage)[SocialLanguage],
) {
  const [kind, id] = itemKey.split(":", 2);
  const plans = roomPlansForActivity(pulse);

  if (kind === "plan") {
    return plans.find((plan) => plan.key === id || plan.id === id)?.title ?? copy.mySafeReviewLabels.shared;
  }

  if (kind === "reply") {
    const reply = plans
      .flatMap((plan) => activePlanReplies(plan))
      .find((item) => item.id === id);
    const body = shortReviewTitle(reply?.body ?? "");
    return body ? `${copy.mySafeReviewLabels.reply}: ${body}` : copy.mySafeReviewLabels.reply;
  }

  if (kind === "poll") {
    const poll = [pulse.activePoll, ...(pulse.issuePolls ?? [])].find((item) => item.key === id || item.id === id);
    const question = shortReviewTitle(poll?.question ?? "");
    return question ? `${copy.mySafeReviewLabels.poll}: ${question}` : copy.mySafeReviewLabels.poll;
  }

  if (kind === "room") return copy.mySafeReviewLabels.room;

  return copy.mySafeReviewLabels.shared;
}

function mySafeReviewItems(pulse: SocialRoomPulse, copy: (typeof copyByLanguage)[SocialLanguage]) {
  const statusMap = reportedItemStatusMapFromPulse(pulse);
  return (pulse.safety.reportedItemStatuses ?? [])
    .filter((item) => typeof item.itemKey === "string" && item.itemKey.length > 0)
    .map((item) => ({
      itemKey: item.itemKey,
      title: reviewItemTitle(item.itemKey, pulse, copy),
      statusLabel: reviewStatusLabel(item.itemKey, statusMap, copy),
    }))
    .slice(0, 3);
}

function countPositiveReplyChanges(previous: SocialRoomPulse, next: SocialRoomPulse) {
  const previousReplies = new Map(roomPlansForActivity(previous).map((plan) => [plan.key, activePlanReplies(plan).length]));
  return roomPlansForActivity(next).reduce((total, plan) => (
    total + Math.max(0, activePlanReplies(plan).length - (previousReplies.get(plan.key) ?? 0))
  ), 0);
}

function describeRoomRefresh(
  previous: SocialRoomPulse,
  next: SocialRoomPulse,
  copy: (typeof copyByLanguage)[SocialLanguage],
) {
  const newUpdates = countNewUnreadNotifications(previous, next);
  if (newUpdates > 0) return copy.roomRefreshedWithUpdates(newUpdates);

  const newReplies = countPositiveReplyChanges(previous, next);
  if (newReplies > 0) return copy.roomRefreshedWithReplies(newReplies);

  const newPlanResponses = countPositivePlanResponseChanges(previous, next);
  if (newPlanResponses > 0) return copy.roomRefreshedWithPlanInterest(newPlanResponses);

  const newVotes = countPositivePollChanges(previous, next);
  if (newVotes > 0) return copy.roomRefreshedWithVotes(newVotes);

  const newComfortSignals = Math.max(0, next.comfortCheck.totalResponses - previous.comfortCheck.totalResponses);
  if (newComfortSignals > 0) return copy.roomRefreshedWithComfort(newComfortSignals);

  return copy.roomRefreshed;
}

function planNextStepBody(plan: SocialRoomPlan, copy: (typeof copyByLanguage)[SocialLanguage]) {
  if (plan.myResponse === "join") return copy.planNextStepJoined;
  if (plan.myResponse === "maybe") return copy.planNextStepMaybe;
  if (plan.myResponse === "not_for_me") return copy.planNextStepNotForMe;
  return plan.responseCounts.join + plan.responseCounts.maybe > 0
    ? copy.planNextStepReady
    : copy.planNextStepWaiting;
}

function PlanLocationPill({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const isNearby = plan.locationLabel === "nearby";
  const Icon = isNearby ? MapPin : Monitor;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-body text-[16px] font-bold ${
        isNearby ? "bg-[#FFF8E8] text-[#6B4F13]" : "bg-[#EFF6FF] text-[#1E3A8A]"
      }`}
      data-testid={`together-plan-location-${plan.key}`}
    >
      <Icon size={17} aria-hidden="true" />
      {isNearby ? copy.planNearby : copy.planOnline}
    </span>
  );
}

function PlanComfortPills({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const comfortNeeds = plan.comfortNeeds ?? [];
  if (comfortNeeds.length === 0) return null;
  const visibleComfortNeeds = comfortNeeds.slice(0, 4);
  const hiddenComfortCount = comfortNeeds.length - visibleComfortNeeds.length;

  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid={`together-plan-comfort-${plan.key}`}>
      {visibleComfortNeeds.map((need) => (
        <span
          key={need}
          className="inline-flex items-center rounded-full bg-[#F7FAF7] px-3 py-1.5 font-body text-[14px] font-bold text-[#315C55]"
        >
          {copy.comfortNeedLabels[need]}
        </span>
      ))}
      {hiddenComfortCount > 0 && (
        <span className="inline-flex items-center rounded-full bg-[#EAF8F4] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]">
          {copy.moreComfortNotes(hiddenComfortCount)}
        </span>
      )}
    </div>
  );
}

function PlanExperiencePills({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const pills = [
    plan.experienceCategory ? copy.categoryLabels[plan.experienceCategory] : "",
    plan.preferredTime ? copy.timeLabels[plan.preferredTime] : "",
    plan.costRange ? copy.costLabels[plan.costRange] : "",
    plan.groupSize ? copy.groupLabels[plan.groupSize] : "",
  ].filter(Boolean);

  const labels = pills.length ? pills : plan.fitReasons ?? [];
  if (labels.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid={`together-plan-fit-${plan.key}`}>
      <span className="inline-flex items-center rounded-full bg-[#F8F5FF] px-3 py-1.5 font-body text-[13px] font-bold text-[#6D4B8F]">
        {copy.fitLabel}
      </span>
      {labels.slice(0, 4).map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full bg-[#FFF8E8] px-3 py-1.5 font-body text-[14px] font-bold text-[#6B4F13]"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function PlanComfortConfidenceCue({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const planNeeds = new Set(plan.comfortNeeds ?? []);
  const knownLabels = (plan.comfortNeeds ?? []).slice(0, 3).map((need) => copy.comfortNeedLabels[need]);
  const missingNeeds = planComfortCheckNeeds.filter((need) => !planNeeds.has(need));
  const visibleMissingLabels = missingNeeds.slice(0, 3).map((need) => copy.comfortNeedLabels[need]);
  const hiddenMissingCount = missingNeeds.length - visibleMissingLabels.length;
  const askLabels = hiddenMissingCount > 0
    ? [...visibleMissingLabels, copy.planComfortCueMore(hiddenMissingCount)]
    : visibleMissingLabels;

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#CFECE3] bg-white px-3 py-3"
      data-testid={`together-plan-comfort-confidence-${plan.key}`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.planComfortCueTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">
            {copy.planComfortCueKnown(knownLabels)}
          </p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">
            {askLabels.length ? copy.planComfortCueAsk(askLabels) : copy.planComfortCueReady}
          </p>
          <p className="mt-2 rounded-[14px] bg-[#F4FBF8] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]">
            {copy.planComfortCuePrivacy}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanDetailCheckCue({
  copy,
  plan,
  onAsk,
  disabled = false,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  plan: SocialRoomPlan;
  onAsk: () => void;
  disabled?: boolean;
}) {
  const itemIcons = [MapPin, Clock, ShieldCheck];

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#DBEAFE] bg-[#FAFCFF] px-3 py-3"
      data-testid={`together-plan-detail-check-${plan.key}`}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-[16px] font-bold text-[#1E3A8A]">{copy.planDetailCheckTitle}</p>
            <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#3E526A]">
              {copy.planDetailCheckBody}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAsk}
          disabled={disabled}
          data-testid={`together-plan-detail-check-${plan.key}-action`}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#1E40AF] px-4 font-body text-[16px] font-bold text-white disabled:cursor-default disabled:opacity-60 sm:w-auto"
        >
          <MessageCircle size={18} aria-hidden="true" />
          {copy.planDetailCheckAction}
        </button>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {copy.planDetailCheckItems.map((item, index) => {
          const Icon = itemIcons[index] ?? ShieldCheck;
          return (
            <li
              key={item}
              className="grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[15px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]"
              data-testid={`together-plan-detail-check-${plan.key}-item-${index + 1}`}
            >
              <Icon size={17} className="shrink-0 text-[#2563EB]" aria-hidden="true" />
              <span className="min-w-0 break-words">{item}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlanReviewNotice({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const flags = plan.safetyFlags ?? [];
  if (!plan.needsReview && flags.length === 0) return null;

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#F3D19A] bg-[#FFF8E8] px-3 py-3"
      data-testid={`together-plan-review-${plan.key}`}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#B45309]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[15px] font-bold leading-[1.3] text-[#6B4F13]">{copy.reviewBadge}</p>
          {flags.length > 0 && (
            <p className="mt-1 font-body text-[13px] font-bold leading-[1.35] text-[#8A6519]">
              {flags.map((flag) => copy.reviewReasons[flag]).join(" | ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SafeShareCue({
  copy,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  return (
    <div className="mb-3 rounded-[18px] border border-[#CFECE3] bg-[#F4FBF8] px-3 py-3" data-testid="together-safe-share-cue">
      <div className="flex items-start gap-2">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.safeShareTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{copy.safeShareBody}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.safeShareReviewLine}</p>
        </div>
      </div>
    </div>
  );
}

function ComposerSafetyPreview({
  copy,
  kind,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  kind: SocialRoomPlanKind;
}) {
  const items: ComposerPreviewItemId[] = ["shared", "private", "next"];

  return (
    <div
      className="mb-3 rounded-[18px] border border-[#D7E8DB] bg-white px-3 py-3"
      data-testid="together-composer-preview"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.composerPreviewTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">
            {copy.composerPreviewBodies[kind]}
          </p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = composerPreviewIcons[item];
          return (
            <li
              key={item}
              className="grid min-h-[54px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[15px] bg-[#F7FAF7] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]"
              data-testid={`together-composer-preview-${kind}-${item}`}
            >
              <Icon size={17} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
              <span className="min-w-0 break-words">{copy.composerPreviewItems[kind][item]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ViewTonePreview({
  copy,
  hasProtectedDetails,
  hasUnkindTone,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  hasProtectedDetails: boolean;
  hasUnkindTone: boolean;
}) {
  const needsEdit = hasProtectedDetails || hasUnkindTone;
  const items = [
    { id: "kind", label: copy.viewTonePreviewItems.kind, ready: !hasUnkindTone },
    { id: "privacy", label: copy.viewTonePreviewItems.privacy, ready: !hasProtectedDetails },
    { id: "small", label: copy.viewTonePreviewItems.small, ready: true },
  ];

  return (
    <div
      className={`mb-3 rounded-[18px] border px-3 py-3 ${
        needsEdit
          ? "border-[#F2D59B] bg-[#FFF9E8]"
          : "border-[#CFECE3] bg-[#F7FCFA]"
      }`}
      data-testid="together-view-tone-preview"
    >
      <div className="flex items-start gap-2">
        <MessageCircle size={19} className={`mt-0.5 shrink-0 ${needsEdit ? "text-[#B45309]" : "text-[#0F766E]"}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className={`font-body text-[16px] font-bold ${needsEdit ? "text-[#6B4F13]" : "text-[#244D47]"}`}>
            {copy.viewTonePreviewTitle}
          </p>
          <p className={`mt-1 font-body text-[15px] font-bold leading-[1.35] ${needsEdit ? "text-[#7C4A03]" : "text-[#41655F]"}`}>
            {needsEdit ? copy.viewTonePreviewNeedsEdit : copy.viewTonePreviewReady}
          </p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.ready ? Check : X;
          return (
            <li
              key={item.id}
              className={`grid min-h-[44px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[14px] px-3 py-2 font-body text-[14px] font-bold leading-[1.25] ${
                item.ready
                  ? "bg-white text-[#315C55]"
                  : "bg-[#FFF3D8] text-[#7C4A03]"
              }`}
              data-testid={`together-view-tone-${item.id}`}
            >
              <Icon size={16} className={item.ready ? "text-[#0F766E]" : "text-[#B45309]"} aria-hidden="true" />
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function viewReplyBalance(sharedViews: SocialRoomPlan[]) {
  const counts = Object.fromEntries(viewBalanceTones.map((tone) => [tone, 0])) as Record<SocialRoomReplyTone, number>;

  sharedViews.forEach((view) => {
    view.replies?.forEach((reply) => {
      if (reply.status !== "active") return;
      counts[reply.tone] += 1;
    });
  });

  return {
    counts,
    total: viewBalanceTones.reduce((sum, tone) => sum + counts[tone], 0),
  };
}

function ViewBalanceSummary({
  copy,
  sharedViews,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  sharedViews: SocialRoomPlan[];
}) {
  const balance = viewReplyBalance(sharedViews);

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#D7E8DB] bg-white px-3 py-3"
      data-testid="together-view-balance"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.viewBalanceTitle}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">
            {balance.total > 0 ? copy.viewBalanceBody : copy.viewBalanceEmpty}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {viewBalanceTones.map((tone) => (
          <div
            key={tone}
            className="rounded-[15px] bg-[#F7FAF7] px-3 py-2 text-center font-body"
            data-testid={`together-view-balance-${tone}`}
            aria-label={`${copy.viewBalanceLabels[tone]}: ${balance.counts[tone]}`}
          >
            <dt className="text-[13px] font-bold leading-[1.2] text-[#55706B]">{copy.viewBalanceLabels[tone]}</dt>
            <dd className="mt-1 text-[20px] font-black leading-none text-[#0F766E]">{balance.counts[tone]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function viewReplyCueKind(balance: ReturnType<typeof viewReplyBalance>): ViewNextReplyCueKind {
  if (balance.total === 0) return "opening";
  const activeToneCount = viewBalanceTones.filter((tone) => balance.counts[tone] > 0).length;

  if (activeToneCount >= 3) return "mixed";
  if (balance.counts.different > 0) return "different";
  if (balance.counts.curious > 0 && balance.counts.support === 0) return "curious";
  return "agreement";
}

function viewCommonGroundBody(
  balance: ReturnType<typeof viewReplyBalance>,
  copy: (typeof copyByLanguage)[SocialLanguage],
) {
  const cueKind = viewReplyCueKind(balance);

  if (cueKind === "opening") return copy.viewCommonGroundOpening;
  if (cueKind === "mixed") return copy.viewCommonGroundMixed;
  if (cueKind === "different") return copy.viewCommonGroundDifferent;
  if (cueKind === "curious") return copy.viewCommonGroundCurious;
  return copy.viewCommonGroundAgreement;
}

function ViewCommonGroundCue({
  copy,
  sharedViews,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  sharedViews: SocialRoomPlan[];
}) {
  const balance = viewReplyBalance(sharedViews);

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#CFECE3] bg-white px-3 py-3"
      data-testid="together-view-common-ground"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <HeartHandshake size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.viewCommonGroundTitle}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#41655F]">
            {viewCommonGroundBody(balance, copy)}
          </p>
          <p className="mt-2 font-body text-[13px] font-bold leading-[1.3] text-[#55706B]">
            {copy.viewCommonGroundPrivacy}
          </p>
        </div>
      </div>
    </div>
  );
}

function ViewSafetyCue({
  copy,
  onStart,
  disabled = false,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  onStart: () => void;
  disabled?: boolean;
}) {
  const items: ViewSafetyItemId[] = ["kind", "private", "review"];

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#CFECE3] bg-[#F4FBF8] px-3 py-3"
      data-testid="together-view-safety"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.viewSafetyTitle}</p>
            <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#41655F]">{copy.viewSafetyBody}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          data-testid="together-view-safety-action"
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[16px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.14)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
        >
          <MessageCircle size={18} aria-hidden="true" />
          {copy.viewSafetyAction}
        </button>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = viewSafetyIcons[item];
          return (
            <li
              key={item}
              className="grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[15px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]"
              data-testid={`together-view-safety-${item}`}
            >
              <Icon size={17} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
              <span className="min-w-0 break-words">{copy.viewSafetyItems[item]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ViewNextReplyCue({
  copy,
  sharedViews,
  onStartViewDraft,
  disabled = false,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  sharedViews: SocialRoomPlan[];
  onStartViewDraft: (draft: string) => void;
  disabled?: boolean;
}) {
  const balance = viewReplyBalance(sharedViews);
  const cueKind = viewReplyCueKind(balance);
  const draft = copy.viewNextReplyDrafts[cueKind];

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#D7E8DB] bg-white px-3 py-3"
      data-testid="together-view-next-reply"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
          <MessageCircle size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.viewNextReplyTitle}</p>
            <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">
              {copy.viewNextReplyBodies[cueKind]}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onStartViewDraft(draft)}
          disabled={disabled}
          data-testid="together-view-next-reply-action"
          aria-label={`${copy.viewNextReplyActions[cueKind]}: ${draft}`}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[16px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.14)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
        >
          <Sparkles size={18} aria-hidden="true" />
          {copy.viewNextReplyActions[cueKind]}
        </button>
      </div>
    </div>
  );
}

function planCollaborationActionForReply(reply: SocialRoomReply) {
  const body = reply.body.trim();

  for (const languageCopy of Object.values(copyByLanguage)) {
    for (const action of planCollaborationActions) {
      if (languageCopy.planSupportReplies[action] === body) {
        return action;
      }
    }
  }

  return null;
}

function planSupportSummary(plan: SocialRoomPlan) {
  const counts = Object.fromEntries(planCollaborationActions.map((action) => [action, 0])) as Record<PlanCollaborationAction, number>;

  activePlanReplies(plan).forEach((reply) => {
    const action = planCollaborationActionForReply(reply);
    if (action) counts[action] += 1;
  });
  (plan.myHelperActions ?? []).forEach((action) => {
    if (planCollaborationActions.includes(action) && counts[action] === 0) {
      counts[action] += 1;
    }
  });

  return {
    counts,
    total: planCollaborationActions.reduce((sum, action) => sum + counts[action], 0),
  };
}

function PlanSupportSummary({
  copy,
  plan,
  testId = "together-plan-helper-summary",
  itemTestIdPrefix = "together-plan-helper",
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  plan: SocialRoomPlan;
  testId?: string;
  itemTestIdPrefix?: string;
}) {
  const summary = planSupportSummary(plan);

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#D7E8DB] bg-white px-3 py-3"
      data-testid={testId}
    >
      <div className="flex items-start gap-2">
        <HeartHandshake size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.planSupportSummaryTitle}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">
            {summary.total > 0 ? copy.planSupportSummaryBody : copy.planSupportSummaryEmpty}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {planCollaborationActions.map((action) => (
          <div
            key={action}
            className="rounded-[15px] bg-[#F7FAF7] px-3 py-2 text-center font-body"
            data-testid={`${itemTestIdPrefix}-${action}`}
            aria-label={`${copy.planSupportActions[action]}: ${summary.counts[action]}`}
          >
            <dt className="text-[13px] font-bold leading-[1.2] text-[#55706B]">{copy.planSupportActions[action]}</dt>
            <dd className="mt-1 text-[20px] font-black leading-none text-[#0F766E]">{summary.counts[action]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function nextPlanHelperAction(plan: SocialRoomPlan) {
  const summary = planSupportSummary(plan);
  return planCollaborationActions.find((action) => summary.counts[action] === 0) ?? null;
}

function PlanHelperCue({
  copy,
  plan,
  onChoose,
  disabled = false,
  testId = "together-plan-helper-cue",
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  plan: SocialRoomPlan;
  onChoose: (action: PlanCollaborationAction) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const summary = planSupportSummary(plan);
  const nextAction = nextPlanHelperAction(plan);
  const coveredLabels = planCollaborationActions
    .filter((action) => summary.counts[action] > 0)
    .map((action) => copy.planSupportActions[action]);
  const nextActionLabel = nextAction ? copy.planSupportActions[nextAction] : null;

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#CFECE3] bg-[#F4FBF8] px-3 py-3"
      data-testid={testId}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-[16px] font-bold leading-[1.25] text-[#244D47]">
              {nextActionLabel ? copy.planHelperCueTitle : copy.planHelperCueCoveredTitle}
            </p>
            <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#41655F]">
              {nextActionLabel
                ? copy.planHelperCueBody(nextActionLabel)
                : copy.planHelperCueCoveredBody(coveredLabels)}
            </p>
            <p
              className="mt-2 rounded-[13px] bg-white px-3 py-2 font-body text-[13px] font-bold leading-[1.3] text-[#315C55]"
              data-testid={`${testId}-privacy`}
            >
              {copy.planHelperCuePrivate}
            </p>
          </div>
        </div>
        {nextAction && nextActionLabel && (
          <button
            type="button"
            onClick={() => onChoose(nextAction)}
            disabled={disabled}
            data-testid={`${testId}-action`}
            aria-label={`${copy.planHelperCueAction(nextActionLabel)}: ${copy.planSupportReplies[nextAction]}`}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[16px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.14)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
          >
            <HeartHandshake size={18} aria-hidden="true" />
            {copy.planHelperCueAction(nextActionLabel)}
          </button>
        )}
      </div>
    </div>
  );
}

function activityReadyDraftSignals(plan: SocialRoomPlan, copy: (typeof copyByLanguage)[SocialLanguage]) {
  const signals: string[] = [];
  const responseSummary = formatResponseSummary(plan, copy);
  if (responseSummary !== copy.responseNone) {
    signals.push(`${copy.roomSummaryLabels.interest}: ${responseSummary}`);
  }

  const comfortLabels = (plan.comfortNeeds ?? [])
    .map((need) => copy.comfortNeedLabels[need])
    .filter(Boolean);
  if (comfortLabels.length) {
    const visibleComfort = comfortLabels.slice(0, 3);
    const hiddenComfortCount = Math.max(0, comfortLabels.length - visibleComfort.length);
    signals.push(`${copy.roomSummaryLabels.comfort}: ${[
      ...visibleComfort,
      hiddenComfortCount > 0 ? copy.moreComfortNotes(hiddenComfortCount) : "",
    ].filter(Boolean).join(", ")}`);
  }

  const helperSummary = planSupportSummary(plan);
  const helperLabels = planCollaborationActions
    .filter((action) => helperSummary.counts[action] > 0)
    .map((action) => copy.planSupportActions[action]);
  if (helperLabels.length) {
    signals.push(`${copy.planSupportSummaryTitle}: ${helperLabels.join(", ")}`);
  }

  return signals;
}

function PlanReadinessBridge({
  copy,
  plan,
  onAsk,
  testId = "together-plan-readiness",
  itemTestIdPrefix = "together-plan-readiness",
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  plan: SocialRoomPlan;
  onAsk?: () => void;
  testId?: string;
  itemTestIdPrefix?: string;
}) {
  const helperSummary = planSupportSummary(plan);
  const interestCount = plan.responseCounts.join + plan.responseCounts.maybe;
  const hasComfort = (plan.comfortNeeds ?? []).length > 0;
  const items: Array<{ id: PlanReadinessItemId; ready: boolean; text: string }> = [
    {
      id: "interest",
      ready: interestCount > 0,
      text: interestCount > 0 ? copy.planReadinessInterestReady(interestCount) : copy.planReadinessInterestWaiting,
    },
    {
      id: "helper",
      ready: helperSummary.total > 0,
      text: helperSummary.total > 0 ? copy.planReadinessHelperReady(helperSummary.total) : copy.planReadinessHelperWaiting,
    },
    {
      id: "comfort",
      ready: hasComfort,
      text: hasComfort ? copy.planReadinessComfortReady : copy.planReadinessComfortWaiting,
    },
    {
      id: "vyva",
      ready: true,
      text: copy.planReadinessVyvaReady,
    },
  ];
  const readyCount = items.filter((item) => item.ready).length;
  const allReady = readyCount === items.length;

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#D7E8DB] bg-[#FFFDF8] px-3 py-3"
      data-testid={testId}
    >
      <div className="flex items-start gap-2">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-[#B45309]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.planReadinessTitle}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">
            {copy.planReadinessBody(readyCount, items.length)}
          </p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.ready ? Check : planReadinessIcons[item.id];
          return (
            <li
              key={item.id}
              className={`grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[15px] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] ${
                item.ready ? "bg-white text-[#315C55]" : "bg-[#FFF8E8] text-[#6B4F13]"
              }`}
              data-testid={`${itemTestIdPrefix}-${item.id}`}
            >
              <Icon
                size={17}
                className={`shrink-0 ${item.ready ? "text-[#0F766E]" : "text-[#B45309]"}`}
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">{item.text}</span>
            </li>
          );
        })}
      </ul>
      {allReady && onAsk && (
        <button
          type="button"
          onClick={onAsk}
          data-testid={`${testId}-action`}
          className="mt-3 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#0F766E] px-4 font-body text-[15px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.12)] sm:w-auto"
        >
          <MessageCircle size={17} aria-hidden="true" />
          {copy.activityReadyAction}
        </button>
      )}
    </div>
  );
}

function isPlanReadyForVyva(plan: SocialRoomPlan) {
  const kind = plan.kind ?? defaultPlanKind;
  const interestCount = plan.responseCounts.join + plan.responseCounts.maybe;
  return (
    kind === "plan"
    && plan.status === "active"
    && interestCount > 0
    && (plan.comfortNeeds ?? []).length > 0
    && planSupportSummary(plan).total > 0
  );
}

function shouldShowSharedPlanReadiness(plan: SocialRoomPlan) {
  const kind = plan.kind ?? defaultPlanKind;
  const interestCount = plan.responseCounts.join + plan.responseCounts.maybe;
  return (
    kind === "plan"
    && (
      interestCount > 0
      || (plan.comfortNeeds ?? []).length > 0
      || planSupportSummary(plan).total > 0
    )
  );
}

function ActivityReadyBridge({
  copy,
  plan,
  notification,
  onAsk,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  plan: SocialRoomPlan;
  notification?: SocialRoomPulse["notifications"][number] | null;
  onAsk: () => void;
}) {
  const signals = activityReadyDraftSignals(plan, copy);

  return (
    <section
      className="mt-3 rounded-[22px] border border-[#BDE2D8] bg-[#F4FBF8] px-4 py-4"
      data-testid="together-activity-ready"
      aria-label={copy.activityReadyTitle}
    >
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-[#0F766E] shadow-[0_8px_16px_rgba(15,118,110,0.08)]">
          <Sparkles size={21} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-body text-[18px] font-bold leading-[1.2] text-[#244D47]">{copy.activityReadyTitle}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-body text-[12px] font-bold text-[#0F766E]">
              <ShieldCheck size={13} aria-hidden="true" />
              {copy.activityReadyPrivate}
            </span>
          </div>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">
            {notification?.body || copy.activityReadyBody(plan.title)}
          </p>
          {signals.length > 0 && (
            <div
              className="mt-3 rounded-[18px] border border-[#CFECE3] bg-white px-3 py-3"
              data-testid="together-activity-ready-signals"
            >
              <p className="font-body text-[14px] font-bold text-[#244D47]">{copy.activityReadySignalsTitle}</p>
              <ul className="mt-2 grid gap-2">
                {signals.map((signal) => (
                  <li
                    key={signal}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[14px] bg-[#F7FAF7] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]"
                  >
                    <Check size={16} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                    <span className="min-w-0 break-words">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div
            className="mt-3 rounded-[18px] border border-[#CFECE3] bg-white px-3 py-3"
            data-testid="together-activity-ready-prep"
          >
            <p className="font-body text-[14px] font-bold text-[#244D47]">{copy.activityReadyPrepTitle}</p>
            <ul className="mt-2 grid gap-2">
              {copy.activityReadyPrepItems.map((item) => (
                <li
                  key={item}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[14px] bg-[#F7FAF7] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]"
                >
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                  <span className="min-w-0 break-words">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={onAsk}
            data-testid="together-activity-ready-action"
            className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[16px] font-bold text-white shadow-[0_12px_22px_rgba(15,118,110,0.14)] sm:w-auto"
          >
            <MessageCircle size={18} aria-hidden="true" />
            {copy.activityReadyAction}
          </button>
        </div>
      </div>
    </section>
  );
}

function VoteReadyBridge({
  copy,
  question,
  notification,
  disabled,
  onAsk,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  question: SocialRoomPlan;
  notification?: SocialRoomPulse["notifications"][number] | null;
  disabled: boolean;
  onAsk: () => void;
}) {
  return (
    <section
      className="mt-4 rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4"
      data-testid="together-vote-ready"
      aria-label={copy.voteReadyTitle}
    >
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-[#2563EB] shadow-[0_8px_16px_rgba(37,99,235,0.08)]">
          <Vote size={21} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-body text-[18px] font-bold leading-[1.2] text-[#1E3A8A]">{copy.voteReadyTitle}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-body text-[12px] font-bold text-[#1E40AF]">
              <ShieldCheck size={13} aria-hidden="true" />
              {copy.voteReadyPrivate}
            </span>
          </div>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#3E526A]">
            {notification?.body || copy.voteReadyBody(question.title)}
          </p>
          <button
            type="button"
            onClick={onAsk}
            disabled={disabled}
            data-testid="together-vote-ready-action"
            className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#1E40AF] px-4 font-body text-[16px] font-bold text-white shadow-[0_12px_22px_rgba(30,64,175,0.14)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
          >
            <MessageCircle size={18} aria-hidden="true" />
            {copy.voteReadyAction}
          </button>
        </div>
      </div>
    </section>
  );
}

function IssuePollOutcomeCue({
  copy,
  poll,
  questionKey,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  poll: SocialRoomPulse["activePoll"];
  questionKey: string;
}) {
  const leaders = getPollLeaders(poll);
  if (!leaders.length) return null;

  const body = leaders.length > 1
    ? copy.issuePollOutcomeTie(leaders.map((option) => option.label))
    : copy.issuePollOutcomeBody(leaders[0].label);
  const leaderIds = new Set(leaders.map((option) => option.id));
  const hasDifferentVotes = leaders.length > 1
    || poll.options.some((option) => option.votes > 0 && !leaderIds.has(option.id));
  const reassurance = hasDifferentVotes
    ? copy.issuePollOutcomeOtherViews
    : poll.status === "active"
    ? copy.issuePollOutcomeOpen
    : null;

  return (
    <div
      className="mt-2 rounded-[15px] bg-white px-3 py-2"
      data-testid={`together-issue-poll-outcome-${questionKey}`}
    >
      <div className="flex items-start gap-2">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[14px] font-bold leading-[1.25] text-[#1E3A8A]">{copy.issuePollOutcomeTitle}</p>
          <p className="mt-0.5 font-body text-[13px] font-bold leading-[1.3] text-[#3E526A]">{body}</p>
          {reassurance && (
            <p
              className="mt-1 rounded-[12px] bg-[#EFF6FF] px-2.5 py-1.5 font-body text-[13px] font-bold leading-[1.3] text-[#1E3A8A]"
              data-testid={`together-issue-poll-outcome-reassurance-${questionKey}`}
            >
              {reassurance}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueReadinessCue({
  copy,
  question,
  issuePoll,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  question: SocialRoomPlan;
  issuePoll?: SocialRoomPulse["activePoll"] | null;
}) {
  const state = issuePoll && issuePoll.totalVotes > 0
    ? "summary"
    : planResponseTotal(question) > 0
    ? "vote"
    : "gathering";
  const body = state === "summary"
    ? copy.issueReadinessBodies.summary(issuePollSignal(issuePoll))
    : copy.issueReadinessBodies[state];

  return (
    <div
      className="mt-3 rounded-[16px] border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-3"
      data-testid={`together-issue-readiness-${question.key}`}
    >
      <div className="flex items-start gap-2">
        <Sparkles size={17} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <div className="min-w-0">
          <p
            className="font-body text-[15px] font-bold leading-[1.25] text-[#1E3A8A]"
            data-testid={`together-issue-readiness-state-${question.key}`}
          >
            {copy.issueReadinessTitles[state]}
          </p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#3E526A]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function VoteImpactPanel({
  copy,
  pulse,
  leadingPollOption,
  tiedPollLabels,
  topComfortLabels,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  pulse: SocialRoomPulse;
  leadingPollOption: SocialRoomPulse["activePoll"]["options"][number] | null;
  tiedPollLabels: string[];
  topComfortLabels: string[];
}) {
  const myVoteLabel = pulse.activePoll.options.find((option) => option.id === pulse.activePoll.myVote)?.label ?? null;
  const body = tiedPollLabels.length > 1
    ? copy.pollImpactTie(tiedPollLabels)
    : leadingPollOption?.id === "views"
    ? copy.pollImpactViews
    : leadingPollOption
    ? copy.pollImpactLeading(leadingPollOption.label, topComfortLabels)
    : copy.pollImpactWaiting;

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#C7DDF8] bg-[#F8FBFF] px-4 py-3"
      data-testid="together-vote-impact"
    >
      <div className="flex items-start gap-2">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#1E3A8A]">{copy.pollImpactTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#3E526A]">{body}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p
              className="grid min-h-[42px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[14px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.25] text-[#1E3A8A]"
              data-testid="together-vote-impact-choice"
            >
              <Vote size={16} className="shrink-0 text-[#2563EB]" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {myVoteLabel ? copy.pollImpactYourVote(myVoteLabel) : copy.pollImpactNoVote}
              </span>
            </p>
            <p
              className="grid min-h-[42px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[14px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.25] text-[#1E3A8A]"
              data-testid="together-vote-impact-safety"
            >
              <ShieldCheck size={16} className="shrink-0 text-[#2563EB]" aria-hidden="true" />
              <span className="min-w-0 break-words">{copy.pollImpactSafety}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function roomVoteSignal(poll: SocialRoomPulse["activePoll"]): {
  kind: RoomVoteSignalKind;
  leader: SocialRoomPulse["activePoll"]["options"][number] | null;
} {
  if (poll.totalVotes <= 0) return { kind: "opening", leader: null };

  const sortedOptions = [...poll.options].sort((first, second) => second.votes - first.votes);
  const leader = sortedOptions[0] ?? null;
  if (!leader || leader.votes <= 0) return { kind: "opening", leader: null };

  const runnerUpVotes = sortedOptions[1]?.votes ?? 0;
  const tiedLeaderCount = sortedOptions.filter((option) => option.votes === leader.votes).length;
  if (tiedLeaderCount > 1 || poll.totalVotes < 3 || leader.votes - runnerUpVotes <= 1) {
    return { kind: "close", leader };
  }

  return { kind: "clear", leader };
}

function RoomVoteSignalCue({
  copy,
  poll,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  poll: SocialRoomPulse["activePoll"];
}) {
  const signal = roomVoteSignal(poll);
  const body = signal.kind === "clear" && signal.leader
    ? `${copy.pollSignalBodies.clear} ${copy.pollSignalClearBody(signal.leader.label)}`
    : copy.pollSignalBodies[signal.kind];

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#DBEAFE] bg-[#FAFCFF] px-4 py-3"
      data-testid="together-vote-signal"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <Vote size={18} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#1E3A8A]">{copy.pollSignalTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#3E526A]">{body}</p>
          <p
            className="mt-2 rounded-[14px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#1E3A8A]"
            data-testid="together-vote-signal-privacy"
          >
            {copy.pollSignalPrivacy}
          </p>
        </div>
      </div>
    </div>
  );
}

function RoomAtGlance({
  copy,
  roomUpdatesCount,
  totalVotes,
  planInterestCount,
  comfortResponses,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  roomUpdatesCount: number;
  totalVotes: number;
  planInterestCount: number;
  comfortResponses: number;
}) {
  const items = [
    {
      id: "updates",
      icon: Bell,
      text: roomUpdatesCount > 0 ? copy.roomAtGlanceUpdates(roomUpdatesCount) : copy.roomAtGlanceUpdatesClear,
    },
    {
      id: "votes",
      icon: Vote,
      text: copy.roomAtGlanceVotes(totalVotes),
    },
    {
      id: "interest",
      icon: Users,
      text: copy.roomAtGlancePlanInterest(planInterestCount),
    },
    {
      id: "comfort",
      icon: HeartHandshake,
      text: copy.roomAtGlanceComfort(comfortResponses),
    },
  ];

  return (
    <section
      className="mt-4 rounded-[22px] border border-[#E2EAD8] bg-[#FFFDF8] px-4 py-3"
      data-testid="together-at-glance"
      aria-label={copy.roomAtGlanceTitle}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="shrink-0 text-[#B45309]" aria-hidden="true" />
        <p className="font-body text-[16px] font-bold text-[#6B4F13]">{copy.roomAtGlanceTitle}</p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className="grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[16px] bg-white/80 px-3 py-2 font-body text-[16px] font-bold leading-[1.25] text-[#315C55]"
              data-testid={`together-at-glance-${item.id}`}
            >
              <Icon size={18} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
              <span className="min-w-0 break-words">{item.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function activityDigestIcon(kind: string) {
  if (kind === "presence") return Users;
  if (kind === "vote") return Vote;
  if (kind === "comfort" || kind === "activity") return HeartHandshake;
  if (kind === "view" || kind === "question") return MessageCircle;
  return ShieldCheck;
}

function RoomActivityDigestPanel({
  digest,
}: {
  digest: NonNullable<SocialRoomPulse["activityDigest"]>;
}) {
  return (
    <section
      className="mt-3 rounded-[22px] border border-[#D7E8DB] bg-[#F4FBF8] px-4 py-3"
      data-testid="together-activity-digest"
      aria-label={digest.title}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{digest.title}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{digest.body}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {digest.items.map((item) => {
          const Icon = activityDigestIcon(item.kind);
          return (
            <div
              key={item.id}
              className="grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[16px] bg-white px-3 py-2"
              data-testid={`together-activity-digest-item-${item.id}`}
            >
              <Icon size={17} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words font-body text-[14px] font-bold leading-[1.2] text-[#41655F]">
                    {item.label}
                  </p>
                  {typeof item.count === "number" && (
                    <span className="rounded-full bg-[#E7F4EE] px-2 py-0.5 font-body text-[13px] font-bold leading-none text-[#0F766E]">
                      {item.count}
                    </span>
                  )}
                </div>
                <p className="mt-1 break-words font-body text-[15px] font-bold leading-[1.3] text-[#244D47]">
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p
        className="mt-3 rounded-[14px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#41655F]"
        data-testid="together-activity-digest-privacy"
      >
        {digest.privacyLine}
      </p>
    </section>
  );
}

function RoomNotesPanel({
  copy,
  leadingPollOption,
  tiedPollLabels,
  topComfortLabels,
  sharedViewCount,
  activityReadyPlan,
  voteReadyQuestion,
  disabled,
  onPrepareActivity,
  onMakeVote,
  onRecapViews,
  onGentleStart,
  onCopyNoNameNotes,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  leadingPollOption: SocialRoomPulse["activePoll"]["options"][number] | null;
  tiedPollLabels: string[];
  topComfortLabels: string[];
  sharedViewCount: number;
  activityReadyPlan: SocialRoomPlan | null;
  voteReadyQuestion: SocialRoomPlan | null;
  disabled: boolean;
  onPrepareActivity: (plan: SocialRoomPlan) => void;
  onMakeVote: (question: SocialRoomPlan) => void;
  onRecapViews: () => void;
  onGentleStart: () => void;
  onCopyNoNameNotes: (notes: string) => void;
}) {
  const voteNote = tiedPollLabels.length > 1
    ? copy.roomNotesVoteTie(tiedPollLabels)
    : leadingPollOption
      ? copy.roomNotesVoteKnown(leadingPollOption.label)
      : copy.roomNotesVoteWaiting;
  const comfortNote = topComfortLabels.length > 0
    ? copy.roomNotesComfortKnown(topComfortLabels)
    : copy.roomNotesComfortWaiting;
  const viewsNote = sharedViewCount > 0
    ? copy.roomNotesViewsKnown(sharedViewCount)
    : copy.roomNotesViewsWaiting;
  const openItems = [
    !leadingPollOption ? copy.roomNotesOpenItems.vote : "",
    topComfortLabels.length === 0 ? copy.roomNotesOpenItems.comfort : "",
    sharedViewCount === 0 ? copy.roomNotesOpenItems.views : "",
    !activityReadyPlan ? copy.roomNotesOpenItems.activity : "",
  ].filter(Boolean);
  const nextText = activityReadyPlan
    ? copy.roomNotesNextActivity(activityReadyPlan.title)
    : voteReadyQuestion
      ? copy.roomNotesNextVote(voteReadyQuestion.title)
      : sharedViewCount > 0
        ? copy.roomNotesNextViews(sharedViewCount)
        : copy.roomNotesNextStarter;
  const sections: Array<{ id: RoomNoteId; details: string[] }> = [
    {
      id: "known",
      details: [voteNote, comfortNote, viewsNote],
    },
    {
      id: "open",
      details: openItems.length ? openItems : [copy.roomNotesOpenReady],
    },
    {
      id: "next",
      details: [nextText],
    },
  ];
  const nextActionId: RoomNotesNextActionId = activityReadyPlan
    ? "activity"
    : voteReadyQuestion
      ? "vote"
      : sharedViewCount > 0
        ? "views"
        : "starter";
  const NextActionIcon = nextActionId === "activity"
    ? Sparkles
    : nextActionId === "vote"
      ? Vote
      : nextActionId === "views"
        ? MessageCircle
        : HeartHandshake;
  const handleNextAction = () => {
    if (activityReadyPlan) {
      onPrepareActivity(activityReadyPlan);
      return;
    }
    if (voteReadyQuestion) {
      onMakeVote(voteReadyQuestion);
      return;
    }
    if (sharedViewCount > 0) {
      onRecapViews();
      return;
    }
    onGentleStart();
  };
  const noNameNotesText = [
    copy.roomNotesTitle,
    `${copy.roomNotesLabels.known}: ${sections[0].details.join(" ")}`,
    `${copy.roomNotesLabels.open}: ${sections[1].details.join(" ")}`,
    `${copy.roomNotesLabels.next}: ${sections[2].details.join(" ")}`,
    copy.roomNotesPrivacy,
  ].join("\n");

  return (
    <section
      className="mt-3 rounded-[22px] border border-[#D7E8DB] bg-white px-4 py-3"
      data-testid="together-room-notes"
      aria-label={copy.roomNotesTitle}
    >
      <div className="flex items-start gap-2">
        <MessageCircle size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.roomNotesTitle}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.roomNotesBody}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {sections.map((section) => {
          const Icon = roomNoteIcons[section.id];
          return (
            <div
              key={section.id}
              className="grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[16px] bg-[#F7FAF7] px-3 py-2"
              data-testid={`together-room-notes-${section.id}`}
            >
              <Icon size={17} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-body text-[13px] font-bold leading-[1.2] text-[#41655F]">{copy.roomNotesLabels[section.id]}</p>
                <p className="mt-1 break-words font-body text-[15px] font-bold leading-[1.3] text-[#244D47]">
                  {section.details.join(" ")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button
          type="button"
          onClick={handleNextAction}
          disabled={disabled}
          data-testid="together-room-notes-next-action"
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#0F766E] px-4 font-body text-[15px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.12)] disabled:cursor-default disabled:opacity-60"
        >
          <NextActionIcon size={17} aria-hidden="true" />
          {copy.roomNotesNextActions[nextActionId]}
        </button>
        <button
          type="button"
          onClick={() => onCopyNoNameNotes(noNameNotesText)}
          data-testid="together-room-notes-copy"
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#CFECE3] bg-white px-4 font-body text-[15px] font-bold text-[#0F766E] sm:w-auto"
        >
          <Copy size={17} aria-hidden="true" />
          {copy.roomNotesCopyAction}
        </button>
      </div>
      <p className="mt-3 rounded-[14px] bg-[#F4FBF8] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#41655F]">
        {copy.roomNotesPrivacy}
      </p>
    </section>
  );
}

function MySafeChoices({
  copy,
  pulse,
  visibility,
  disabled = false,
  isQuietPaused,
  onAddComfort,
  onVote,
  onChooseActivity,
  onQuietPauseToggle,
  onLeaveQuietly,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  pulse: SocialRoomPulse;
  visibility: NonNullable<SocialRoomPulse["visibility"]>;
  disabled?: boolean;
  isQuietPaused: boolean;
  onAddComfort: () => void;
  onVote: () => void;
  onChooseActivity: () => void;
  onQuietPauseToggle: () => void;
  onLeaveQuietly: () => void;
}) {
  const voteChoice = mySafeVoteChoice(pulse, copy);
  const helperChoice = mySafeHelperChoice(pulse, copy);
  const reviewItems = mySafeReviewItems(pulse, copy);
  const comfortLabels = pulse.comfortCheck.myComfortNeeds.map((need) => copy.comfortNeedLabels[need]).filter(Boolean);
  const planChoice = pulse.featuredPlan.myResponse === "join"
    ? copy.mySafeChoicePlanJoin
    : pulse.featuredPlan.myResponse === "maybe"
    ? copy.mySafeChoicePlanMaybe
    : pulse.featuredPlan.myResponse === "not_for_me"
    ? copy.mySafeChoicePlanNotForMe
    : copy.mySafeChoicePlanNone;
  const items: Array<{ id: MySafeChoiceId; value: string }> = [
    {
      id: "plan",
      value: planChoice,
    },
    {
      id: "vote",
      value: voteChoice,
    },
    {
      id: "comfort",
      value: comfortLabels.length ? comfortLabels.join(" | ") : copy.mySafeChoiceComfortNone,
    },
    {
      id: "help",
      value: helperChoice,
    },
  ];
  const nextActionId: MySafeChoiceActionId | null = comfortLabels.length === 0
    ? "comfort"
    : !pulse.activePoll.myVote && pulse.activePoll.status !== "closed"
      ? "vote"
      : !pulse.featuredPlan.myResponse
        ? "plan"
        : null;
  const NextActionIcon = nextActionId ? mySafeChoiceActionIcons[nextActionId] : null;
  const handleNextPrivateAction = () => {
    if (nextActionId === "comfort") {
      onAddComfort();
      return;
    }
    if (nextActionId === "vote") {
      onVote();
      return;
    }
    if (nextActionId === "plan") {
      onChooseActivity();
    }
  };

  return (
    <section
      className="mt-3 rounded-[22px] border border-[#D7E8DB] bg-white px-4 py-3"
      data-testid="together-my-safe-choices"
      aria-label={copy.mySafeChoicesTitle}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
            <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.mySafeChoicesTitle}</p>
          </div>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.mySafeChoicesBody}</p>
        </div>
        <p className="rounded-[14px] bg-[#F4FBF8] px-3 py-2 font-body text-[13px] font-bold leading-[1.25] text-[#0F766E]">
          {copy.mySafeChoicesPrivate}
        </p>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const Icon = mySafeChoiceIcons[item.id];
          return (
            <div
              key={item.id}
              className="grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[16px] bg-[#F7FAF7] px-3 py-2"
              data-testid={`together-my-safe-choice-${item.id}`}
            >
              <Icon size={17} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="font-body text-[13px] font-bold leading-[1.2] text-[#55706B]">{copy.mySafeChoiceLabels[item.id]}</dt>
                <dd className="mt-0.5 break-words font-body text-[15px] font-bold leading-[1.25] text-[#315C55]">{item.value}</dd>
              </div>
            </div>
          );
        })}
      </dl>
      {nextActionId && NextActionIcon && (
        <button
          type="button"
          onClick={handleNextPrivateAction}
          disabled={disabled}
          data-testid="together-my-safe-next-action"
          className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#CFECE3] bg-[#F7FCFA] px-4 font-body text-[15px] font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
        >
          <NextActionIcon size={17} aria-hidden="true" />
          {copy.mySafeChoiceActionLabels[nextActionId]}
        </button>
      )}
      {reviewItems.length > 0 && (
        <div
          className="mt-3 rounded-[18px] border border-[#CFECE3] bg-[#F7FCFA] px-3 py-3"
          data-testid="together-my-review-updates"
        >
          <div className="flex items-start gap-2">
            <LifeBuoy size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-body text-[15px] font-bold leading-[1.25] text-[#244D47]">{copy.mySafeReviewsTitle}</p>
              <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.mySafeReviewsBody}</p>
            </div>
          </div>
          <ul className="mt-3 grid gap-2">
            {reviewItems.map((item) => (
              <li
                key={item.itemKey}
                className="grid min-h-[54px] grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[15px] bg-white px-3 py-2"
                data-testid={`together-my-review-update-${item.itemKey}`}
              >
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="break-words font-body text-[14px] font-bold leading-[1.25] text-[#244D47]">{item.title}</p>
                  <p className="mt-1 font-body text-[13px] font-bold leading-[1.25] text-[#0F766E]">{item.statusLabel}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 border-t border-[#D7E8DB] pt-3" data-testid="together-visibility-promise">
        <div className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-[15px] font-bold leading-[1.25] text-[#244D47]">{visibility.title}</p>
            <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{visibility.body}</p>
          </div>
        </div>
        <ul className="mt-3 grid gap-2">
          {visibility.items.slice(0, 3).map((item) => {
            const Icon = visibilityIcons[item.id] ?? ShieldCheck;
            return (
              <li
                key={item.id}
                className="grid min-h-[54px] grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[15px] bg-[#F7FAF7] px-3 py-2"
                data-testid={`together-visibility-${item.id}`}
              >
                <Icon size={17} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-body text-[14px] font-bold leading-[1.2] text-[#244D47]">{item.title}</p>
                  <p className="mt-1 break-words font-body text-[13px] font-bold leading-[1.3] text-[#55706B]">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        {isQuietPaused ? (
          <p
            className="rounded-[14px] bg-[#F4FBF8] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#41655F]"
            data-testid="together-quiet-pause-note"
          >
            {copy.mySafePauseNote}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={onQuietPauseToggle}
          aria-pressed={isQuietPaused}
          data-testid="together-quiet-pause"
          className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border px-4 font-body text-[15px] font-bold ${
            isQuietPaused
              ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
              : "border-[#D7E8DB] bg-white text-[#315C55]"
          }`}
        >
          <Pause size={17} aria-hidden="true" />
          {isQuietPaused ? copy.mySafePauseActiveAction : copy.mySafePauseAction}
        </button>
        <button
          type="button"
          onClick={onLeaveQuietly}
          data-testid="together-leave-quietly"
          aria-label={`${copy.mySafeLeaveAction}: ${copy.mySafeLeaveNote}`}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#E2D7C4] bg-white px-4 font-body text-[15px] font-bold text-[#6B4F13]"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block leading-tight">{copy.mySafeLeaveAction}</span>
            <span className="mt-0.5 block text-[13px] leading-tight text-[#8A6B2E]">{copy.mySafeLeaveNote}</span>
          </span>
        </button>
      </div>
    </section>
  );
}

function ParticipationPathPanel({
  copy,
  disabled = false,
  onVote,
  onView,
  onActivity,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  disabled?: boolean;
  onVote: () => void;
  onView: () => void;
  onActivity: () => void;
}) {
  const paths: Array<{ id: ParticipationPathId; onAction: () => void }> = [
    { id: "vote", onAction: onVote },
    { id: "view", onAction: onView },
    { id: "activity", onAction: onActivity },
  ];

  return (
    <section
      className="mt-3 rounded-[22px] border border-[#D7E8DB] bg-[#FFFDF8] px-4 py-3"
      data-testid="together-participation-path"
      aria-label={copy.participationPathTitle}
    >
      <div className="flex items-start gap-2">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.participationPathTitle}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.participationPathBody}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {paths.map((path) => {
          const Icon = participationPathIcons[path.id];
          return (
            <button
              key={path.id}
              type="button"
              onClick={path.onAction}
              disabled={disabled}
              data-testid={`together-path-${path.id}`}
              className="grid min-h-[74px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[17px] border border-[#CFECE3] bg-white px-3 py-3 text-left font-body font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[16px] leading-tight text-[#244D47]">{copy.participationPathLabels[path.id]}</span>
                <span className="sr-only">{copy.participationPathBodies[path.id]}</span>
              </span>
              <span className="shrink-0 rounded-[14px] bg-[#F4FBF8] px-3 py-2 text-[13px] leading-tight text-[#0F766E]">
                {copy.participationPathActions[path.id]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 rounded-[14px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#41655F]">
        {copy.participationPathPrivacy}
      </p>
    </section>
  );
}

function PrivateRoomNote({
  copy,
  value,
  onChange,
  onSave,
  onClear,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const charactersLeft = privateRoomNoteMaxLength - value.length;

  return (
    <section
      className="mt-3 rounded-[22px] border border-[#E7DDF4] bg-[#FFFDF8] px-4 py-3"
      data-testid="together-private-note"
      aria-label={copy.privateNoteTitle}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="shrink-0 text-[#6D28D9]" aria-hidden="true" />
            <p className="font-body text-[16px] font-bold text-[#2F2135]">{copy.privateNoteTitle}</p>
          </div>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#6A5B72]">{copy.privateNotePrivate}</p>
        </div>
        <p
          className="rounded-[14px] bg-white px-3 py-2 font-body text-[13px] font-bold leading-[1.25] text-[#6B4F13]"
          data-testid="together-private-note-count"
        >
          {copy.privateNoteLength(charactersLeft)}
        </p>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(limitPrivateRoomNote(event.target.value))}
        maxLength={privateRoomNoteMaxLength}
        rows={3}
        data-testid="together-private-note-input"
        aria-label={copy.privateNoteTitle}
        placeholder={copy.privateNotePlaceholder}
        className="mt-3 w-full resize-none rounded-[18px] border border-[#E2D7C4] bg-white px-4 py-3 font-body text-[18px] font-bold leading-[1.35] text-[#2F2135] outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#EDE9FE]"
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSave}
          data-testid="together-private-note-save"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] bg-[#6D28D9] px-4 font-body text-[16px] font-bold text-white shadow-[0_10px_18px_rgba(109,40,217,0.14)]"
        >
          <Check size={17} aria-hidden="true" />
          {copy.privateNoteSave}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!value.trim()}
          data-testid="together-private-note-clear"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#E2D7C4] bg-white px-4 font-body text-[16px] font-bold text-[#6B4F13] disabled:cursor-default disabled:opacity-55"
        >
          <X size={17} aria-hidden="true" />
          {copy.privateNoteClear}
        </button>
      </div>
    </section>
  );
}

function RoomTrustCue({
  copy,
  disabled = false,
  onAsk,
  onIntro,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  disabled?: boolean;
  onAsk: () => void;
  onIntro: () => void;
}) {
  const items: RoomTrustItemId[] = ["privacy", "kindness", "contact"];

  return (
    <section
      className="mt-3 rounded-[22px] border border-[#CFECE3] bg-[#F7FCFA] px-4 py-3"
      data-testid="together-room-trust"
      aria-label={copy.roomTrustTitle}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.roomTrustTitle}</p>
            <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.roomTrustBody}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:w-[190px]">
          <button
            type="button"
            onClick={onAsk}
            disabled={disabled}
            data-testid="together-room-trust-action"
            className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#0F766E] px-4 font-body text-[15px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.12)] disabled:cursor-default disabled:opacity-60"
          >
            <MessageCircle size={17} aria-hidden="true" />
            {copy.roomTrustAction}
          </button>
          <button
            type="button"
            onClick={onIntro}
            disabled={disabled}
            data-testid="together-room-trust-intro"
            className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#CFECE3] bg-white px-4 font-body text-[15px] font-bold text-[#0F766E] shadow-[0_8px_14px_rgba(15,118,110,0.08)] disabled:cursor-default disabled:opacity-60"
          >
            <Sparkles size={17} aria-hidden="true" />
            {copy.roomTrustIntroAction}
          </button>
        </div>
      </div>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => {
          const Icon = roomTrustIcons[item];
          return (
            <li
              key={item}
              className="grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[15px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]"
              data-testid={`together-room-trust-${item}`}
            >
              <Icon size={17} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
              <span className="min-w-0 break-words">{copy.roomTrustItems[item]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NextGentleStepCue({
  copy,
  stepId,
  onAction,
  onExplain,
  disabled = false,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  stepId: NextGentleStepId;
  onAction: () => void;
  onExplain: () => void;
  disabled?: boolean;
}) {
  const Icon = nextGentleStepIcons[stepId];
  const step = copy.nextGentleSteps[stepId];

  return (
    <section
      className="mt-3 rounded-[22px] border border-[#CFECE3] bg-white px-4 py-3"
      data-testid="together-next-step-cue"
      aria-label={copy.nextGentleStepLabel}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#EAF8F4] text-[#0F766E]">
            <Icon size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-body text-[14px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">{copy.nextGentleStepLabel}</p>
            <h2 className="mt-1 font-body text-[19px] font-bold leading-[1.2] text-[#244D47]">{step.title}</h2>
            <p className="mt-1 font-body text-[16px] font-bold leading-[1.35] text-[#55706B]">{step.body}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[auto_auto]">
          <button
            type="button"
            onClick={onAction}
            disabled={disabled}
            data-testid={`together-next-step-${stepId}`}
            className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[17px] font-bold text-white shadow-[0_12px_22px_rgba(15,118,110,0.14)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
          >
            <Icon size={18} aria-hidden="true" />
            {step.action}
          </button>
          <button
            type="button"
            onClick={onExplain}
            disabled={disabled}
            data-testid="together-next-step-explain"
            className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[17px] border border-[#CFECE3] bg-white px-4 font-body text-[16px] font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60 sm:w-auto"
          >
            <MessageCircle size={18} aria-hidden="true" />
            {copy.nextGentleStepExplainAction}
          </button>
        </div>
      </div>
    </section>
  );
}

function DailyQuestionCard({
  question,
  disabled,
  onAnswer,
}: {
  question: NonNullable<SocialRoomPulse["discussionPrompt"]["dailyQuestion"]>;
  disabled: boolean;
  onAnswer: () => void;
}) {
  return (
    <div
      className="mt-4 rounded-[22px] border border-[#D7E8DB] bg-[#F4FBF8] px-4 py-4"
      data-testid="together-daily-question"
    >
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white text-[#0F766E] shadow-[0_8px_16px_rgba(15,118,110,0.08)]">
          <MessageCircle size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-body text-[17px] font-bold leading-[1.2] text-[#244D47]">{question.title}</p>
          <p className="mt-1 font-body text-[16px] font-bold leading-[1.35] text-[#41655F]">{question.body}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <p
          className="min-w-0 rounded-[16px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#41655F]"
          data-testid="together-daily-question-privacy"
        >
          {question.privacyLine}
        </p>
        <button
          type="button"
          onClick={onAnswer}
          disabled={disabled}
          data-testid="together-daily-question-action"
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[16px] font-bold text-white shadow-[0_12px_22px_rgba(15,118,110,0.14)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
        >
          <MessageCircle size={18} aria-hidden="true" />
          {question.actionLabel}
        </button>
      </div>
    </div>
  );
}

function JoiningSupportCue({
  cue,
  disabled,
  onAsk,
}: {
  cue: NonNullable<SocialRoomPulse["joiningSupportCue"]>;
  disabled: boolean;
  onAsk: () => void;
}) {
  return (
    <div
      className="mt-4 border-t border-[#CFECE3] pt-4"
      data-testid="together-joining-support"
    >
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#EAF8F4] text-[#0F766E]">
          <MapPin size={21} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-body text-[17px] font-bold leading-[1.2] text-[#244D47]">{cue.title}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{cue.body}</p>
          <p
            className="mt-2 font-body text-[14px] font-bold leading-[1.3] text-[#55706B]"
            data-testid="together-joining-support-privacy"
          >
            {cue.privacyLine}
          </p>
        </div>
        <button
          type="button"
          onClick={onAsk}
          disabled={disabled}
          data-testid="together-joining-support-action"
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[16px] font-bold text-white shadow-[0_12px_22px_rgba(15,118,110,0.14)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
        >
          <HeartHandshake size={18} aria-hidden="true" />
          {cue.actionLabel}
        </button>
      </div>
    </div>
  );
}

function ViewCircle({
  copy,
  viewVoteOption,
  sharedViews,
  onAddView,
  onStartViewDraft,
  onAskViewRecap,
  onAskViewVote,
  onReviewView,
  onReplyToView,
  isReviewingView,
  isReviewedView,
  reviewStatusForView,
  isReplyingView,
  disabled = false,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  viewVoteOption: SocialRoomPulse["activePoll"]["options"][number] | null;
  sharedViews: SocialRoomPlan[];
  onAddView: () => void;
  onStartViewDraft: (draft: string) => void;
  onAskViewRecap: () => void;
  onAskViewVote: () => void;
  onReviewView: (view: SocialRoomPlan) => void;
  onReplyToView: (view: SocialRoomPlan, tone: SocialRoomReplyTone) => void;
  isReviewingView: (view: SocialRoomPlan) => boolean;
  isReviewedView: (view: SocialRoomPlan) => boolean;
  reviewStatusForView: (view: SocialRoomPlan) => string;
  isReplyingView: (view: SocialRoomPlan) => boolean;
  disabled?: boolean;
}) {
  const visibleViews = sharedViews.slice(0, 2);

  return (
    <section
      className="mt-4 rounded-[22px] border border-[#CFECE3] bg-[#F7FCFA] px-4 py-4"
      data-testid="together-view-circle"
      aria-label={copy.viewCircleTitle}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={19} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
            <h3 className="font-body text-[19px] font-bold text-[#244D47]">{copy.viewCircleTitle}</h3>
          </div>
          <p className="mt-1 font-body text-[16px] font-bold leading-[1.35] text-[#55706B]">{copy.viewCircleBody}</p>
        </div>
        <button
          type="button"
          onClick={onAddView}
          disabled={disabled}
          data-testid="together-view-circle-add"
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[16px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.14)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
        >
          <Sparkles size={18} aria-hidden="true" />
          {copy.viewCircleAdd}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {viewVoteOption && (
          <p
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 font-body text-[15px] font-bold text-[#1E3A8A]"
            data-testid="together-view-circle-votes"
          >
            <Vote size={16} aria-hidden="true" />
            {copy.viewCircleVote(viewVoteOption.label, viewVoteOption.votes)}
          </p>
        )}
        <p
          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 font-body text-[15px] font-bold text-[#315C55]"
          data-testid="together-view-circle-count"
        >
          <Users size={16} aria-hidden="true" />
          {copy.viewCircleCount(sharedViews.length)}
        </p>
      </div>
      <ViewBalanceSummary copy={copy} sharedViews={sharedViews} />
      <ViewCommonGroundCue copy={copy} sharedViews={sharedViews} />
      <ViewSafetyCue
        copy={copy}
        onStart={() => onStartViewDraft(copy.viewSafetyDraft)}
        disabled={disabled}
      />
      <ViewNextReplyCue
        copy={copy}
        sharedViews={sharedViews}
        onStartViewDraft={onStartViewDraft}
        disabled={disabled}
      />
      {sharedViews.length > 0 && (
        <>
          <div
            className="mt-3 grid gap-3 rounded-[18px] border border-[#D7E8DB] bg-white px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            data-testid="together-view-recap-bridge"
          >
            <div className="min-w-0">
              <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.viewRecapTitle}</p>
              <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">
                {copy.viewRecapBody(sharedViews.length)}
              </p>
            </div>
            <button
              type="button"
              onClick={onAskViewRecap}
              disabled={disabled}
              data-testid="together-view-recap-action"
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#244D47] px-4 font-body text-[16px] font-bold text-white disabled:cursor-default disabled:opacity-60 sm:w-auto"
            >
              <Sparkles size={18} aria-hidden="true" />
              {copy.viewRecapAction}
            </button>
          </div>
          <div
            className="mt-3 grid gap-3 rounded-[18px] border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            data-testid="together-view-vote-bridge"
          >
            <div className="min-w-0">
              <p className="font-body text-[16px] font-bold text-[#1E3A8A]">{copy.viewVoteBridgeTitle}</p>
              <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#3E526A]">
                {copy.viewVoteBridgeBody(sharedViews.length)}
              </p>
            </div>
            <button
              type="button"
              onClick={onAskViewVote}
              disabled={disabled}
              data-testid="together-view-vote-action"
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#1E40AF] px-4 font-body text-[16px] font-bold text-white disabled:cursor-default disabled:opacity-60 sm:w-auto"
            >
              <Vote size={18} aria-hidden="true" />
              {copy.viewVoteBridgeAction}
            </button>
          </div>
        </>
      )}
      <div
        className="mt-3 rounded-[18px] border border-[#D7E8DB] bg-white px-3 py-3"
        data-testid="together-view-circle-starters"
      >
        <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.viewPromptTitle}</p>
        <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.viewPromptBody}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label={copy.viewPromptTitle}>
          {viewPromptActions.map((action) => {
            const draft = copy.viewPromptDrafts[action];
            return (
              <button
                key={action}
                type="button"
                onClick={() => onStartViewDraft(draft)}
                disabled={disabled}
                aria-label={`${copy.viewPromptLabels[action]}: ${draft}`}
                data-testid={`together-view-circle-starter-${action}`}
                className="min-h-[76px] rounded-[16px] border border-[#CFECE3] bg-[#F7FAF7] px-3 py-3 text-left font-body font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
              >
                <span className="block text-[15px] leading-tight">{copy.viewPromptLabels[action]}</span>
                <span className="mt-1 block text-[13px] leading-[1.25] text-[#55706B]">{draft}</span>
              </button>
            );
          })}
        </div>
      </div>
      {visibleViews.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {visibleViews.map((view) => {
            const isReporting = isReviewingView(view);
            const isReported = isReviewedView(view);
            const isReplying = isReplyingView(view);
            return (
              <article
                key={view.key}
                className="rounded-[17px] bg-white px-3 py-3 font-body text-[#41655F]"
                data-testid={`together-view-circle-item-${view.key}`}
              >
                <p className="text-[13px] font-bold uppercase text-[#0F766E]">{copy.viewCircleLatest}</p>
                <p className="mt-1 text-[17px] font-bold leading-[1.25] text-[#244D47]">{view.title}</p>
                {view.body && (
                  <p className="mt-1 text-[15px] font-bold leading-[1.35] text-[#55706B]">{view.body}</p>
                )}
                <div
                  className="mt-3 rounded-[15px] border border-[#D7E8DB] bg-[#F7FAF7] px-3 py-3"
                  data-testid={`together-view-circle-replies-${view.key}`}
                >
                  <p className="font-body text-[14px] font-bold text-[#244D47]">{copy.gentleReplies}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {viewCircleReplyTones.map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => onReplyToView(view, tone)}
                        disabled={disabled || isReplying}
                        data-testid={`together-view-circle-reply-${tone}-${view.key}`}
                        aria-label={`${copy.replyActions[tone]}: ${copy.replyBodies[tone]}`}
                        className="min-h-[64px] rounded-[15px] border border-[#CFECE3] bg-white px-3 py-2 text-left font-body font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
                      >
                        <span className="block text-[14px] leading-tight">{copy.replyActions[tone]}</span>
                        <span className="sr-only">{copy.replyBodies[tone]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onReviewView(view)}
                  disabled={isReporting || isReported}
                  aria-label={`${copy.reviewItem}: ${view.title}`}
                  data-testid={`together-view-circle-review-${view.key}`}
                  className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[15px] border border-[#CFECE3] bg-[#F7FAF7] px-3 font-body text-[15px] font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60 sm:w-auto"
                >
                  <ShieldCheck size={17} aria-hidden="true" />
                  {isReporting ? copy.helpSending : isReported ? reviewStatusForView(view) : copy.reviewItem}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p
          className="mt-3 rounded-[17px] bg-white px-3 py-3 font-body text-[16px] font-bold leading-[1.35] text-[#55706B]"
          data-testid="together-view-circle-empty"
        >
          {copy.viewCircleEmpty}
        </p>
      )}
    </section>
  );
}

function IssueVoteQueue({
  copy,
  questions,
  issuePolls,
  disabled,
  onRespond,
  onIssueVote,
  onIssuePass,
  onShapeVote,
  onReview,
  isQuietPaused,
  isResponding,
  isVotingPoll,
  isReviewingItem,
  isReviewedItem,
  reviewStatusForItem,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  questions: SocialRoomPlan[];
  issuePolls: SocialRoomPulse["issuePolls"];
  disabled: boolean;
  onRespond: (question: SocialRoomPlan, response: SocialRoomPlanResponseValue) => void;
  onIssueVote: (pollKey: string, optionId: string | null) => void;
  onIssuePass: () => void;
  onShapeVote: (question: SocialRoomPlan, issuePoll?: SocialRoomPulse["activePoll"] | null) => void;
  onReview: (question: SocialRoomPlan) => void;
  isQuietPaused: boolean;
  isResponding: (question: SocialRoomPlan) => boolean;
  isVotingPoll: (pollKey: string) => boolean;
  isReviewingItem: (question: SocialRoomPlan) => boolean;
  isReviewedItem: (question: SocialRoomPlan) => boolean;
  reviewStatusForItem: (question: SocialRoomPlan) => string;
}) {
  const visibleQuestions = questions.slice(0, 2);
  if (!visibleQuestions.length) return null;

  return (
    <div
      className="mt-4 rounded-[20px] border border-[#DBEAFE] bg-[#FAFCFF] px-4 py-4"
      data-testid="together-issue-vote-queue"
    >
      <div className="flex items-start gap-2">
        <Vote size={19} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[18px] font-bold text-[#1E3A8A]">{copy.issueQueueTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#3E526A]">{copy.issueQueueBody}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3">
        {visibleQuestions.map((question) => {
          const responding = isResponding(question);
          const reviewing = isReviewingItem(question);
          const reviewed = isReviewedItem(question);
          const issuePoll = (issuePolls ?? []).find((poll) => poll.sourcePlanKey === question.key);
          const votingPoll = issuePoll ? isVotingPoll(issuePoll.key) : false;
          const shapeVoteLabel = issuePoll ? copy.issueQueueUseAction : copy.issueQueueAction;
          return (
            <article
              key={question.key}
              className="rounded-[18px] border border-[#D8E7F6] bg-white px-3 py-3"
              data-testid={`together-issue-vote-${question.key}`}
            >
              <p className="font-body text-[13px] font-bold uppercase text-[#2563EB]">{copy.issueQueueBadge}</p>
              <p className="mt-1 font-body text-[18px] font-bold leading-[1.22] text-[#203A5C]">{question.title}</p>
              {question.body && (
                <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#53677D]">{question.body}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <p
                  className="inline-flex items-center gap-2 rounded-full bg-[#F4FBF8] px-3 py-1.5 font-body text-[14px] font-bold text-[#315C55]"
                  data-testid={`together-issue-response-summary-${question.key}`}
                >
                  <Users size={15} aria-hidden="true" />
                  {formatResponseSummary(question, copy)}
                </p>
                <p className="inline-flex w-full items-start gap-2 rounded-[14px] bg-[#EFF6FF] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#1E3A8A] sm:w-auto sm:items-center sm:rounded-full sm:py-1.5">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 sm:mt-0" aria-hidden="true" />
                  {copy.issueQueuePrivacy}
                </p>
              </div>
              {issuePoll && (
                <div
                  className="mt-3 rounded-[16px] border border-[#BFDBFE] bg-[#F8FBFF] px-3 py-3"
                  data-testid={`together-issue-mini-poll-${question.key}`}
                >
                  <div className="flex items-start gap-2">
                    <Vote size={17} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-body text-[15px] font-bold leading-[1.25] text-[#1E3A8A]">{copy.issuePollTitle}</p>
                      <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#3E526A]">
                        {issuePoll.status === "active" ? copy.issuePollBody : copy.issuePollClosed}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {issuePoll.options.map((option) => {
                      const selected = issuePoll.myVote === option.id;
                      const percent = issuePoll.totalVotes > 0 ? Math.round((option.votes / issuePoll.totalVotes) * 100) : 0;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => onIssueVote(issuePoll.key, option.id)}
                          disabled={disabled || votingPoll || issuePoll.status !== "active"}
                          aria-pressed={selected}
                          data-testid={`together-issue-poll-${question.key}-${option.id}`}
                          className={`grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[15px] border px-3 text-left font-body text-[15px] font-bold disabled:cursor-default disabled:opacity-60 ${
                            selected
                              ? "border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]"
                              : "border-[#D8E7F6] bg-white text-[#203A5C]"
                          }`}
                        >
                          <span className="min-w-0 break-words leading-tight">{option.label}</span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[15px] leading-none">{percent}%</span>
                            <span className="mt-1 block text-[12px] leading-tight opacity-80">
                              {selected ? copy.pollYourChoice : copy.pollVotes(option.votes)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {!issuePoll.myVote && issuePoll.status === "active" && (
                    <button
                      type="button"
                      onClick={onIssuePass}
                      disabled={disabled || votingPoll}
                      aria-pressed={isQuietPaused}
                      data-testid={`together-issue-poll-pass-${question.key}`}
                      className={`mt-2 grid min-h-[50px] w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[15px] border px-3 py-2 text-left font-body font-bold disabled:cursor-default disabled:opacity-60 ${
                        isQuietPaused
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]"
                          : "border-[#D8E7E2] bg-white text-[#315C55]"
                      }`}
                    >
                      <Pause size={16} className="shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-[15px] leading-tight">{copy.pollPassChoice}</span>
                        <span className="sr-only">{copy.pollPassBody}</span>
                      </span>
                    </button>
                  )}
                  {issuePoll.myVote && issuePoll.status === "active" && (
                    <button
                      type="button"
                      onClick={() => onIssueVote(issuePoll.key, null)}
                      disabled={disabled || votingPoll}
                      data-testid={`together-issue-poll-clear-${question.key}`}
                      className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[15px] border border-[#D8E7E2] bg-white px-3 font-body text-[15px] font-bold text-[#315C55] disabled:cursor-default disabled:opacity-60"
                    >
                      <X size={16} aria-hidden="true" />
                      {copy.clearVoteChoice}
                    </button>
                  )}
                  <p className="mt-2 font-body text-[13px] font-bold leading-[1.3] text-[#3E526A]">{copy.issuePollPrivacy}</p>
                  <IssuePollOutcomeCue copy={copy} poll={issuePoll} questionKey={question.key} />
                </div>
              )}
              <IssueReadinessCue copy={copy} question={question} issuePoll={issuePoll} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onRespond(question, "join")}
                  disabled={disabled || responding}
                  aria-pressed={question.myResponse === "join"}
                  data-testid={`together-issue-support-${question.key}`}
                  className={`min-h-[52px] rounded-[16px] px-3 font-body text-[16px] font-bold disabled:cursor-default disabled:opacity-60 ${
                    question.myResponse === "join"
                      ? "bg-[#2563EB] text-white"
                      : "bg-[#EFF6FF] text-[#1E40AF]"
                  }`}
                >
                  {copy.sharedActions.question.primary}
                </button>
                <button
                  type="button"
                  onClick={() => onRespond(question, "maybe")}
                  disabled={disabled || responding}
                  aria-pressed={question.myResponse === "maybe"}
                  data-testid={`together-issue-follow-${question.key}`}
                  className={`min-h-[52px] rounded-[16px] border px-3 font-body text-[16px] font-bold disabled:cursor-default disabled:opacity-60 ${
                    question.myResponse === "maybe"
                      ? "border-[#2563EB] bg-white text-[#1E40AF]"
                      : "border-[#BFDBFE] bg-white text-[#1E40AF]"
                  }`}
                >
                  {copy.sharedActions.question.secondary}
                </button>
                <button
                  type="button"
                  onClick={() => onShapeVote(question, issuePoll)}
                  disabled={disabled}
                  data-testid={`together-issue-shape-vote-${question.key}`}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[#1E40AF] px-3 font-body text-[16px] font-bold text-white disabled:cursor-default disabled:opacity-60"
                >
                  <Vote size={18} aria-hidden="true" />
                  {shapeVoteLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onReview(question)}
                  disabled={disabled || reviewing || reviewed}
                  data-testid={`together-issue-review-${question.key}`}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] border border-[#D8E7E2] bg-[#F7FAF7] px-3 font-body text-[15px] font-bold text-[#315C55] disabled:cursor-default disabled:opacity-60"
                >
                  <ShieldCheck size={17} aria-hidden="true" />
                  {reviewing ? copy.helpSending : reviewed ? reviewStatusForItem(question) : copy.reviewItem}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function IssueVoteShortcutPanel({
  copy,
  disabled,
  onStart,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  disabled: boolean;
  onStart: (action: IssuePromptAction) => void;
}) {
  return (
    <div
      className="mt-4 rounded-[18px] border border-[#DBEAFE] bg-[#FAFCFF] px-4 py-3"
      data-testid="together-issue-shortcuts"
    >
      <div className="flex items-start gap-2">
        <Vote size={18} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#1E3A8A]">{copy.issuePromptTitle}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#3E526A]">{copy.issuePromptBody}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {issuePromptActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onStart(action)}
            disabled={disabled}
            data-testid={`together-issue-shortcut-${action}`}
            aria-label={`${copy.issuePromptLabels[action]}: ${copy.issuePromptDrafts[action]}`}
            className="min-h-[58px] rounded-[15px] border border-[#BFDBFE] bg-white px-3 py-2 text-left font-body font-bold text-[#1E40AF] disabled:cursor-default disabled:opacity-60"
          >
            <span className="block text-[15px] leading-tight">{copy.issuePromptLabels[action]}</span>
            <span className="mt-1 block text-[13px] leading-[1.25] text-[#3E526A]">{copy.issuePromptDrafts[action]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomDecisionSummary({
  copy,
  leadingPollOption,
  tiedPollLabels,
  topComfortLabels,
  planInterestCount,
  sharedViewCount,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  leadingPollOption: SocialRoomPulse["activePoll"]["options"][number] | null;
  tiedPollLabels: string[];
  topComfortLabels: string[];
  planInterestCount: number;
  sharedViewCount: number;
}) {
  const hasTie = tiedPollLabels.length > 1;
  const hasDirection = Boolean(leadingPollOption || hasTie || topComfortLabels.length > 0);
  const isViewDirection = leadingPollOption?.id === "views";
  const rows = [
    {
      id: "vote",
      label: copy.roomSummaryLabels.vote,
      value: leadingPollOption?.label ?? (hasTie ? copy.roomSummaryVoteTie(tiedPollLabels) : copy.roomSummaryVoteWaiting),
    },
    {
      id: "comfort",
      label: copy.roomSummaryLabels.comfort,
      value: topComfortLabels.length ? topComfortLabels.join(" | ") : copy.roomSummaryComfortWaiting,
    },
    {
      id: "interest",
      label: copy.roomSummaryLabels.interest,
      value: copy.roomAtGlancePlanInterest(planInterestCount),
    },
    {
      id: "views",
      label: copy.roomSummaryLabels.views,
      value: copy.viewCircleCount(sharedViewCount),
    },
    {
      id: "next",
      label: copy.roomSummaryLabels.next,
      value: hasDirection
        ? hasTie
          ? copy.roomSummaryNextTie
          : isViewDirection
          ? copy.roomSummaryNextView
          : copy.roomSummaryNextReady(leadingPollOption?.label ?? null, topComfortLabels)
        : copy.roomSummaryNextWaiting,
    },
  ];

  return (
    <div className="mt-3 rounded-[16px] bg-white px-3 py-3" data-testid="together-room-summary">
      <p className="font-body text-[15px] font-bold text-[#0F766E]">{copy.roomSummaryTitle}</p>
      <dl className="mt-2 grid gap-2">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]" data-testid={`together-room-summary-${row.id}`}>
            <dt className="font-body text-[14px] font-bold leading-[1.2] text-[#55706B]">{row.label}</dt>
            <dd className="font-body text-[16px] font-bold leading-[1.3] text-[#315C55]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RoomCommonGroundCue({
  copy,
  topComfortLabels,
  planInterestCount,
  sharedViewCount,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  topComfortLabels: string[];
  planInterestCount: number;
  sharedViewCount: number;
}) {
  const items = [
    {
      id: "vote",
      icon: Vote,
      text: copy.roomCommonGroundVote,
    },
    {
      id: "comfort",
      icon: HeartHandshake,
      text: topComfortLabels.length > 0
        ? copy.roomCommonGroundComfortReady(topComfortLabels)
        : copy.roomCommonGroundComfortWaiting,
    },
    {
      id: "interest",
      icon: Users,
      text: planInterestCount > 0
        ? copy.roomCommonGroundInterestReady(planInterestCount)
        : copy.roomCommonGroundInterestWaiting,
    },
    {
      id: "views",
      icon: MessageCircle,
      text: sharedViewCount > 0
        ? copy.roomCommonGroundViewsReady(sharedViewCount)
        : copy.roomCommonGroundViewsWaiting,
    },
  ];

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#D7E8DB] bg-white px-4 py-3"
      data-testid="together-common-ground"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.roomCommonGroundTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{copy.roomCommonGroundBody}</p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className="grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[15px] bg-[#F4FBF8] px-3 py-2 font-body text-[15px] font-bold leading-[1.3] text-[#315C55]"
              data-testid={`together-common-ground-${item.id}`}
            >
              <Icon size={17} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
              <span className="min-w-0 break-words">{item.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoomOutcomeBridge({
  copy,
  leadingPollOption,
  tiedPollLabels,
  topComfortLabels,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  leadingPollOption: SocialRoomPulse["activePoll"]["options"][number] | null;
  tiedPollLabels: string[];
  topComfortLabels: string[];
}) {
  const hasTie = tiedPollLabels.length > 1;
  const context: RoomOutcomeContext = hasTie
    ? "tie"
    : leadingPollOption?.id === "views"
    ? "views"
    : leadingPollOption
    ? "plan"
    : topComfortLabels.length > 0
    ? "comfort"
    : "waiting";
  const choice = hasTie ? tiedPollLabels.join(" | ") : leadingPollOption?.label ?? null;
  const steps: RoomOutcomeStepId[] = ["private", "shape", "safety"];

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#D7E8DB] bg-[#FFFDF8] px-4 py-3"
      data-testid="together-room-outcome-bridge"
    >
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#EAF8F4] text-[#0F766E]">
          <Sparkles size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.roomOutcomeTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">
            {copy.roomOutcomeBody(choice, topComfortLabels, context)}
          </p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => {
          const Icon = roomOutcomeStepIcons[step];
          return (
            <li
              key={step}
              className="grid min-h-[58px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[15px] bg-white px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]"
              data-testid={`together-room-outcome-${step}`}
            >
              <Icon size={17} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
              <span className="min-w-0 break-words">{copy.roomOutcomeSteps[step]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoomReadinessChecklist({
  copy,
  leadingPollOption,
  topComfortLabels,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  leadingPollOption: SocialRoomPulse["activePoll"]["options"][number] | null;
  topComfortLabels: string[];
}) {
  const items = [
    {
      id: "vote",
      label: copy.roomReadinessLabels.vote,
      ready: Boolean(leadingPollOption),
      text: leadingPollOption ? copy.roomReadinessVoteReady : copy.roomReadinessVoteWaiting,
    },
    {
      id: "comfort",
      label: copy.roomReadinessLabels.comfort,
      ready: topComfortLabels.length > 0,
      text: topComfortLabels.length > 0 ? copy.roomReadinessComfortReady : copy.roomReadinessComfortWaiting,
    },
    {
      id: "consent",
      label: copy.roomReadinessLabels.consent,
      ready: true,
      text: copy.roomReadinessConsentReady,
    },
  ];

  return (
    <div className="mt-3 rounded-[18px] border border-[#CFECE3] bg-white px-4 py-3" data-testid="together-room-readiness">
      <div className="flex items-start gap-2">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.roomReadinessTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{copy.roomReadinessBody}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const Icon = item.ready ? Check : Clock;
          return (
            <div
              key={item.id}
              className={`grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[15px] px-3 py-2 ${
                item.ready ? "bg-[#F4FBF8] text-[#315C55]" : "bg-[#FFF8E8] text-[#6B4F13]"
              }`}
              data-testid={`together-room-readiness-${item.id}`}
            >
              <Icon
                size={17}
                className={`mt-0.5 shrink-0 ${item.ready ? "text-[#0F766E]" : "text-[#B45309]"}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-body text-[14px] font-bold leading-[1.2]">{item.label}</p>
                <p className="mt-0.5 font-body text-[15px] font-bold leading-[1.3]">{item.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoomUsefulNextSteps({
  copy,
  activityReadyPlan,
  voteReadyQuestion,
  sharedViewCount,
  disabled,
  onPrepareActivity,
  onMakeVote,
  onRecapViews,
  onHelpActivity,
  onSuggestVote,
  onShareView,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  activityReadyPlan: SocialRoomPlan | null;
  voteReadyQuestion: SocialRoomPlan | null;
  sharedViewCount: number;
  disabled: boolean;
  onPrepareActivity: (plan: SocialRoomPlan) => void;
  onMakeVote: (question: SocialRoomPlan) => void;
  onRecapViews: () => void;
  onHelpActivity: () => void;
  onSuggestVote: () => void;
  onShareView: () => void;
}) {
  const items: Array<{
    id: RoomUsefulStepId;
    ready: boolean;
    text: string;
    readyAction?: () => void;
    waitingAction: () => void;
  }> = [
    {
      id: "activity",
      ready: Boolean(activityReadyPlan),
      text: activityReadyPlan ? copy.roomUsefulReady.activity : copy.roomUsefulWaiting.activity,
      readyAction: activityReadyPlan ? () => onPrepareActivity(activityReadyPlan) : undefined,
      waitingAction: onHelpActivity,
    },
    {
      id: "vote",
      ready: Boolean(voteReadyQuestion),
      text: voteReadyQuestion ? copy.roomUsefulReady.vote : copy.roomUsefulWaiting.vote,
      readyAction: voteReadyQuestion ? () => onMakeVote(voteReadyQuestion) : undefined,
      waitingAction: onSuggestVote,
    },
    {
      id: "views",
      ready: sharedViewCount > 0,
      text: sharedViewCount > 0 ? copy.roomUsefulReady.views : copy.roomUsefulWaiting.views,
      readyAction: sharedViewCount > 0 ? onRecapViews : undefined,
      waitingAction: onShareView,
    },
  ];

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#D7E8DB] bg-white px-4 py-3"
      data-testid="together-useful-next-steps"
    >
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#F4FBF8] text-[#0F766E]">
          <Sparkles size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.roomUsefulTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{copy.roomUsefulBody}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => {
          const TopicIcon = roomUsefulStepIcons[item.id];
          const action = item.ready ? item.readyAction : item.waitingAction;
          const actionLabel = item.ready ? copy.roomUsefulActions[item.id] : copy.roomUsefulWaitingActions[item.id];
          const ActionIcon = item.ready ? Check : TopicIcon;
          return (
            <div
              key={item.id}
              className={`grid gap-3 rounded-[15px] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                item.ready ? "bg-[#F4FBF8] text-[#315C55]" : "bg-[#FFF8E8] text-[#6B4F13]"
              }`}
              data-testid={`together-useful-next-${item.id}`}
            >
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
                <TopicIcon size={17} className={`mt-0.5 shrink-0 ${item.ready ? "text-[#0F766E]" : "text-[#B45309]"}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-body text-[14px] font-bold leading-[1.2]">{copy.roomUsefulLabels[item.id]}</p>
                  <p className="mt-0.5 font-body text-[15px] font-bold leading-[1.3]">{item.text}</p>
                </div>
              </div>
              {action && (
                <button
                  type="button"
                  onClick={action}
                  disabled={disabled}
                  data-testid={`together-useful-next-${item.id}-action`}
                  className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[15px] px-4 font-body text-[15px] font-bold disabled:cursor-default disabled:opacity-60 sm:w-auto ${
                    item.ready
                      ? "bg-[#0F766E] text-white shadow-[0_10px_18px_rgba(15,118,110,0.12)]"
                      : "border border-[#F5D48A] bg-white text-[#8A4B0F]"
                  }`}
                >
                  <ActionIcon size={17} aria-hidden="true" />
                  {actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 rounded-[14px] bg-[#F7FAF7] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#55706B]">
        {copy.roomUsefulPrivacy}
      </p>
    </div>
  );
}

function buildLocalDecisionGuide(
  copy: (typeof copyByLanguage)[SocialLanguage],
  leadingPollOption: SocialRoomPulse["activePoll"]["options"][number] | null,
  tiedPollLabels: string[],
  topComfortLabels: string[],
): SocialRoomDecisionGuide {
  const hasTie = tiedPollLabels.length > 1;

  if (!leadingPollOption && !hasTie && topComfortLabels.length === 0) {
    return {
      id: "waiting-for-signals",
      title: copy.roomReadinessTitle,
      body: copy.roomDirectionWaiting,
      steps: [
        copy.roomReadinessVoteWaiting,
        copy.roomReadinessComfortWaiting,
        copy.roomReadinessConsentReady,
      ],
      primaryActionLabel: copy.roomDirectionAction,
      actionKind: "vote",
    };
  }

  if (hasTie) {
    return {
      id: "waiting-for-clear-choice",
      title: copy.roomReadinessTitle,
      body: copy.roomDirectionTie(tiedPollLabels, topComfortLabels),
      steps: [
        copy.roomSummaryVoteTie(tiedPollLabels),
        topComfortLabels.length > 0 ? copy.roomReadinessComfortReady : copy.roomReadinessComfortWaiting,
        copy.roomReadinessConsentReady,
      ],
      primaryActionLabel: copy.roomRecapAction,
      actionKind: "vote",
    };
  }

  if (leadingPollOption?.id === "views") {
    return {
      id: "share-views-safely",
      title: copy.roomReadinessTitle,
      body: copy.roomSummaryNextView,
      steps: [
        copy.roomSummaryNextView,
        copy.roomReadinessConsentReady,
        copy.reviewItem,
      ],
      primaryActionLabel: copy.roomDirectionViewAction,
      actionKind: "view",
    };
  }

  return {
    id: "shape-one-plan",
    title: copy.roomReadinessTitle,
    body: copy.roomDirectionBody(leadingPollOption?.label ?? null, topComfortLabels),
    steps: [
      leadingPollOption ? copy.roomReadinessVoteReady : copy.roomReadinessVoteWaiting,
      topComfortLabels.length > 0 ? copy.roomReadinessComfortReady : copy.roomReadinessComfortWaiting,
      copy.roomReadinessConsentReady,
    ],
    primaryActionLabel: copy.roomDirectionAction,
    actionKind: "plan",
  };
}

function DecisionGuide({
  guide,
  onStart,
  recapLabel,
  onRecap,
}: {
  guide: SocialRoomDecisionGuide;
  onStart: () => void;
  recapLabel?: string;
  onRecap?: () => void;
}) {
  const showAction = Boolean(guide.primaryActionLabel && (guide.actionKind === "plan" || guide.actionKind === "view"));

  return (
    <div className="mt-4 border-t border-[#CFECE3] pt-4" data-testid="together-decision-guide">
      <div className="flex items-start gap-2">
        <Sparkles size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-[#244D47]">{guide.title}</p>
          <p className="mt-1 font-body text-[16px] font-bold leading-[1.35] text-[#315C55]">{guide.body}</p>
        </div>
      </div>
      {guide.steps.length > 0 && (
        <ul className="mt-3 grid gap-2" data-testid="together-decision-guide-steps">
          {guide.steps.map((step) => (
            <li key={step} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 font-body text-[15px] font-bold leading-[1.3] text-[#41655F]">
              <Check size={16} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      )}
      {(showAction || recapLabel) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto] sm:justify-start">
          {showAction && (
            <button
              type="button"
              onClick={onStart}
              data-testid="together-use-room-direction"
              className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#0F766E] px-4 font-body text-[17px] font-bold text-white shadow-[0_12px_22px_rgba(15,118,110,0.14)] sm:w-auto"
            >
              <Sparkles size={19} aria-hidden="true" />
              {guide.primaryActionLabel}
            </button>
          )}
          {recapLabel && onRecap && (
            <button
              type="button"
              onClick={onRecap}
              data-testid="together-ask-recap"
              className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[17px] border border-[#CFECE3] bg-white px-4 font-body text-[17px] font-bold text-[#0F766E] sm:w-auto"
            >
              <MessageCircle size={19} aria-hidden="true" />
              {recapLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceButtonGroup<T extends string>({
  label,
  options,
  selectedValue,
  onChange,
  getLabel,
  testIdPrefix,
  compact = false,
}: {
  label: string;
  options: T[];
  selectedValue: T;
  onChange: (value: T) => void;
  getLabel: (value: T) => string;
  testIdPrefix: string;
  compact?: boolean;
}) {
  return (
    <div className="mb-3">
      <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{label}</p>
      <div className={`mt-2 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`} role="group" aria-label={label}>
        {options.map((value) => {
          const selected = selectedValue === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              aria-pressed={selected}
              data-testid={`${testIdPrefix}-${value}`}
              className={`min-h-[48px] rounded-[16px] border px-3 font-body text-[16px] font-bold leading-tight ${
                selected
                  ? "border-[#6D28D9] bg-[#F3ECFF] text-[#4B2E6E]"
                  : "border-[#E7DDF4] bg-white text-[#655172]"
              }`}
            >
              {getLabel(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SafetyHelpPanel({
  copy,
  isSending,
  onSend,
  onCancel,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  isSending: boolean;
  onSend: (choice: SafetyHelpChoice) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="mt-3 rounded-[20px] border border-[#A9DCCE] bg-white px-3 py-3"
      data-testid="together-safety-help-panel"
    >
      <p className="font-body text-[17px] font-bold text-[#244D47]">{copy.safetyHelpTitle}</p>
      <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#55706B]">{copy.safetyHelpBody}</p>
      <p
        className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[15px] border border-[#F1D9A8] bg-[#FFF8E7] px-3 py-2 font-body text-[14px] font-bold leading-[1.35] text-[#6C5530]"
        data-testid="together-safety-urgent-note"
      >
        <LifeBuoy size={16} className="mt-0.5 shrink-0 text-[#B7791F]" aria-hidden="true" />
        <span className="min-w-0 break-words">{copy.safetyHelpUrgentNote}</span>
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {safetyHelpChoices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onSend(choice)}
            disabled={isSending}
            data-testid={`together-safety-choice-${choice}`}
            aria-label={`${copy.safetyHelpChoiceLabels[choice]}: ${copy.safetyHelpChoiceBodies[choice]}`}
            className="min-h-[76px] rounded-[17px] border border-[#CFECE3] bg-[#F7FAF7] px-3 py-3 text-left font-body font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
          >
            <span className="block text-[16px] leading-tight">{copy.safetyHelpChoiceLabels[choice]}</span>
            <span className="mt-1 block text-[14px] leading-[1.3] text-[#55706B]">
              {copy.safetyHelpChoiceBodies[choice]}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={isSending}
        data-testid="together-safety-help-cancel"
        className="mt-2 min-h-[44px] rounded-[15px] border border-[#D8E7E2] bg-white px-4 font-body text-[15px] font-bold text-[#315C55] disabled:cursor-default disabled:opacity-60"
      >
        {copy.cancel}
      </button>
    </div>
  );
}

function SafetyHelpReceipt({
  copy,
  choice,
}: {
  copy: (typeof copyByLanguage)[SocialLanguage];
  choice: SafetyHelpChoice;
}) {
  return (
    <div
      className="mt-3 rounded-[20px] border border-[#A9DCCE] bg-white px-3 py-3"
      data-testid="together-safety-help-receipt"
      role="status"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[17px] font-bold text-[#244D47]">{copy.safetyHelpReceiptTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">
            {copy.safetyHelpReceiptBody(copy.safetyHelpChoiceLabels[choice])}
          </p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2">
        {copy.safetyHelpReceiptItems.map((item) => (
          <li
            key={item}
            className="grid min-h-[42px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[14px] bg-[#F4FBF8] px-3 py-2 font-body text-[14px] font-bold leading-[1.3] text-[#315C55]"
          >
            <Check size={16} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TogetherRoomScreen({
  roomResponse,
  language,
  visitId,
  onBack,
  onOpenActivities,
  onOpenShareStories,
  shareStoryHandoff,
}: TogetherRoomScreenProps) {
  const copy = copyByLanguage[language];
  const simpleCopy = simpleRoomCopy[language];
  const { room } = roomResponse;
  const initialPulse = roomResponse.pulse ?? fallbackPulse(language);
  const [pulse, setPulse] = useState<SocialRoomPulse>(initialPulse);
  const [proposalDraft, setProposalDraft] = useState("");
  const proposalCharactersLeft = proposalDetailsMaxLength - proposalDraft.length;
  const proposalHasProtectedDetails = hasProtectedProposalDetails(proposalDraft);
  const proposalHasUnkindTone = hasUnkindProposalTone(proposalDraft);
  const proposalDescriptionIds = [
    proposalHasProtectedDetails ? "together-proposal-safety-warning" : "",
    proposalHasUnkindTone ? "together-proposal-tone-warning" : "",
    "together-proposal-length",
  ].filter(Boolean).join(" ");
  const [showProposalComposer, setShowProposalComposer] = useState(false);
  const [prefilledShareStoryId, setPrefilledShareStoryId] = useState<string | null>(null);
  const [dismissedShareStoryId, setDismissedShareStoryId] = useState<string | null>(null);
  const [placedShareStoryHandoff, setPlacedShareStoryHandoff] = useState<StoryRoomHandoffNote | null>(null);
  const activeShareStoryHandoff = shareStoryHandoff && dismissedShareStoryId !== shareStoryHandoff.id ? shareStoryHandoff : null;
  const replyLoopShareStoryHandoff = placedShareStoryHandoff && dismissedShareStoryId === placedShareStoryHandoff.id
    ? placedShareStoryHandoff
    : null;
  const [safetyHelpPanelAnchor, setSafetyHelpPanelAnchor] = useState<SafetyHelpPanelAnchor | null>(null);
  const [lastSafetyHelpChoice, setLastSafetyHelpChoice] = useState<SafetyHelpChoice | null>(null);
  const [lastSafetyHelpReceiptAnchor, setLastSafetyHelpReceiptAnchor] = useState<SafetyHelpPanelAnchor | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isQuietPaused, setIsQuietPaused] = useState(Boolean(initialPulse.safety.myQuietPausedAt));
  const [isReadingComfortOn, setIsReadingComfortOn] = useState(getReadingComfortPreference);
  const [isReadingRoomAloud, setIsReadingRoomAloud] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [privateRoomNoteDraft, setPrivateRoomNoteDraft] = useState(getPrivateRoomNote);
  const [isSending, setIsSending] = useState(false);
  const [isSendingSafetyReport, setIsSendingSafetyReport] = useState(false);
  const [isRefreshingPulse, setIsRefreshingPulse] = useState(false);
  const [isAcknowledgingAgreement, setIsAcknowledgingAgreement] = useState(false);
  const [isSavingComfortCheck, setIsSavingComfortCheck] = useState(false);
  const [markingUpdateId, setMarkingUpdateId] = useState<string | null>(null);
  const [isMarkingAllUpdatesSeen, setIsMarkingAllUpdatesSeen] = useState(false);
  const [replyingPlanKey, setReplyingPlanKey] = useState<string | null>(null);
  const [respondingPlanKeys, setRespondingPlanKeys] = useState<Set<string>>(() => new Set());
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [reportingItemIds, setReportingItemIds] = useState<Set<string>>(() => new Set());
  const [reportedItemIds, setReportedItemIds] = useState<Set<string>>(() => reportedItemKeysFromPulse(initialPulse));
  const [withdrawingItemIds, setWithdrawingItemIds] = useState<Set<string>>(() => new Set());
  const [withdrawingReplyIds, setWithdrawingReplyIds] = useState<Set<string>>(() => new Set());
  const reportedItemStatusByKey = useMemo(() => reportedItemStatusMapFromPulse(pulse), [pulse]);
  const planResponseLocks = useRef<Set<string>>(new Set());
  const voteLock = useRef(false);
  const itemReportLocks = useRef<Set<string>>(new Set());
  const itemWithdrawLocks = useRef<Set<string>>(new Set());
  const replyWithdrawLocks = useRef<Set<string>>(new Set());
  const proposalSendLock = useRef(false);
  const replySendLock = useRef(false);
  const pulseRefreshLock = useRef(false);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const proposalDraftRef = useRef<HTMLTextAreaElement | null>(null);
  const [proposalLocationLabel, setProposalLocationLabel] = useState<ProposalLocationLabel>("online");
  const [selectedComfortNeeds, setSelectedComfortNeeds] = useState<SocialRoomComfortNeed[]>([]);
  const [proposalCategory, setProposalCategory] = useState<SocialRoomExperienceCategory>("outing");
  const [proposalPreferredTime, setProposalPreferredTime] = useState<SocialRoomPreferredTime>("flexible");
  const [proposalCostRange, setProposalCostRange] = useState<SocialRoomCostRange>("discuss");
  const [proposalGroupSize, setProposalGroupSize] = useState<SocialRoomGroupSize>("one_to_one");

  useEffect(() => () => {
    if (typeof window === "undefined" || !speechUtteranceRef.current) return;
    window.speechSynthesis?.cancel();
    speechUtteranceRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !safetyHelpPanelAnchor) return;
    const target = document.querySelector('[data-testid="together-safety-help-panel"]');
    if (target instanceof HTMLElement) {
      focusTemporaryRoomElement(target);
    }
  }, [safetyHelpPanelAnchor]);

  useEffect(() => {
    if (
      typeof document === "undefined"
      || safetyHelpPanelAnchor !== null
      || !lastSafetyHelpChoice
      || !lastSafetyHelpReceiptAnchor
    ) {
      return;
    }
    const target = document.querySelector('[data-testid="together-safety-help-receipt"]');
    if (target instanceof HTMLElement) {
      focusTemporaryRoomElement(target);
    }
  }, [lastSafetyHelpChoice, lastSafetyHelpReceiptAnchor, safetyHelpPanelAnchor]);

  const members = useMemo(() => {
    const pulseMembers = pulse.memberPresence?.length ? pulse.memberPresence : roomResponse.members;
    return pulseMembers.slice(0, 3);
  }, [pulse.memberPresence, roomResponse.members]);
  const activePostedExperiences = useMemo(
    () => pulse.postedExperiences.filter((plan) => plan.status === "active"),
    [pulse.postedExperiences],
  );
  const postedExperiences = activePostedExperiences.slice(0, 3);
  const issueQuestionPosts = activePostedExperiences.filter((plan) => (plan.kind ?? "plan") === "question");
  const sharedViewPosts = activePostedExperiences.filter((plan) => (
    (plan.kind ?? "plan") === "message" && !isHelloMessagePlan(plan, copy)
  ));
  const roomUpdates = useMemo(
    () => pulse.notifications.filter((notification) => !notification.readAt).slice(0, 3),
    [pulse.notifications],
  );
  const activityPlanByKey = useMemo(
    () => new Map(roomPlansForActivity(pulse).map((plan) => [plan.key, plan])),
    [pulse],
  );
  const activityReadyNotification = useMemo(
    () => (
      pulse.notifications.find((notification) => notification.type === "activity_ready" && !notification.readAt)
      ?? pulse.notifications.find((notification) => notification.type === "activity_ready")
      ?? null
    ),
    [pulse.notifications],
  );
  const voteReadyNotification = useMemo(
    () => (
      pulse.notifications.find((notification) => notification.type === "vote_ready" && !notification.readAt)
      ?? pulse.notifications.find((notification) => notification.type === "vote_ready")
      ?? null
    ),
    [pulse.notifications],
  );
  const featuredPlan = pulse.featuredPlan;
  const activityReadyPlan = useMemo(() => {
    const plans = roomPlansForActivity(pulse);
    const notificationPlanKey = notificationMetadataString(activityReadyNotification, "planKey");
    if (notificationPlanKey) {
      return plans.find((plan) => plan.key === notificationPlanKey) ?? null;
    }

    const notificationBody = activityReadyNotification?.body ?? "";
    if (notificationBody) {
      return plans.find((plan) => (
        plan.title && notificationBody.includes(`"${plan.title}"`)
      )) ?? null;
    }

    return isPlanReadyForVyva(featuredPlan) ? featuredPlan : null;
  }, [activityReadyNotification, featuredPlan, pulse]);
  const voteReadyQuestion = useMemo(() => {
    const supportedQuestions = issueQuestionPosts.filter((question) => (
      question.status === "active" && planResponseTotal(question) > 0
    ));
    if (!supportedQuestions.length) return null;
    const notificationPlanKey = notificationMetadataString(voteReadyNotification, "planKey");
    if (notificationPlanKey) {
      return supportedQuestions.find((question) => question.key === notificationPlanKey) ?? null;
    }

    const notificationBody = voteReadyNotification?.body ?? "";
    if (!notificationBody) return supportedQuestions[0];
    return supportedQuestions.find((question) => (
      question.title && notificationBody.includes(`"${question.title}"`)
    )) ?? supportedQuestions[0];
  }, [issueQuestionPosts, voteReadyNotification]);
  const unreadRoomUpdateCount = countUnreadRoomUpdates(pulse);
  const roomUpdateRecapCount = Math.max(unreadRoomUpdateCount, roomUpdates.length);
  const planInterestCount = getPlanInterestCount(pulse);
  const roomVoteCount = getRoomVoteCount(pulse);
  const showActivityReadyBridge = Boolean(activityReadyPlan);
  const showVoteReadyBridge = Boolean(voteReadyNotification && voteReadyQuestion);
  const featuredPlanReplies = activePlanReplies(featuredPlan);
  const hasJoined = featuredPlan.myResponse === "join";
  const hasMaybe = featuredPlan.myResponse === "maybe";
  const hasNotForMe = featuredPlan.myResponse === "not_for_me";
  const pollClosed = pulse.activePoll.status !== "active";
  const pollDirection = getPollDirection(pulse);
  const leadingPollOption = pollDirection.leadingOption;
  const tiedPollOptions = pollDirection.tiedOptions;
  const tiedPollLabels = tiedPollOptions.map((option) => option.label);
  const viewVoteOption = pulse.activePoll.options.find((option) => option.id === "views") ?? null;
  const tiedPollIncludesViews = tiedPollOptions.some((option) => option.id === "views");
  const tiedPollChoiceLabel = tiedPollLabels.length > 1 ? tiedPollLabels.join(" | ") : null;
  const roomChoiceLabel = leadingPollOption?.label ?? tiedPollChoiceLabel;
  const showViewCircle = Boolean(
    sharedViewPosts.length > 0
    || pulse.activePoll.myVote === "views"
    || leadingPollOption?.id === "views"
    || tiedPollIncludesViews
  );
  const topComfortLabels = getTopComfortLabels(pulse);
  const hasRoomSignals = Boolean(leadingPollOption || tiedPollOptions.length > 1 || topComfortLabels.length > 0);
  const localDecisionGuide = useMemo(
    () => buildLocalDecisionGuide(copy, leadingPollOption, tiedPollLabels, topComfortLabels),
    [copy, leadingPollOption, tiedPollLabels, topComfortLabels],
  );
  const decisionGuide = useMemo(
    () => ({
      ...localDecisionGuide,
      title: pulse.decisionGuide?.title ?? localDecisionGuide.title,
    }),
    [localDecisionGuide, pulse.decisionGuide?.title],
  );
  const agreementTitle = pulse.safety.agreementTitle ?? copy.agreementTitle;
  const agreementLines = pulse.safety.agreementLines?.length ? pulse.safety.agreementLines : copy.agreementLines;
  const agreementAcknowledged = Boolean(pulse.safety.myAcknowledgedAt);
  const agreementButtonLabel = pulse.safety.acknowledgementLabel ?? copy.acknowledgementLabel;
  const visibilityPromise = pulse.visibility ?? fallbackVisibility(language);

  const postJson = async (url: string, body: Record<string, unknown>) => {
    const response = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify({ lang: language, visitId: visitId ?? undefined, ...body }),
    });
    if (!response.ok) return null;
    return response.json() as Promise<SocialRoomPostResponse>;
  };

  const updateQuietPauseInPulse = (paused: boolean, quietPausedAt: string | null) => {
    setPulse((current) => ({
      ...current,
      safety: {
        ...current.safety,
        myQuietPausedAt: paused ? quietPausedAt : null,
      },
    }));
  };

  const applyServerPulse = (nextPulse: SocialRoomPulse) => {
    setPulse(nextPulse);
    setIsQuietPaused(Boolean(nextPulse.safety.myQuietPausedAt));
    const nextReportedKeys = reportedItemKeysFromPulse(nextPulse);
    if (nextReportedKeys.size > 0) {
      setReportedItemIds((current) => {
        if ([...nextReportedKeys].every((key) => current.has(key))) return current;
        const next = new Set(current);
        nextReportedKeys.forEach((key) => next.add(key));
        return next;
      });
    }
  };

  const toggleQuietPause = async () => {
    const next = !isQuietPaused;
    const previous = isQuietPaused;
    const quietPausedAt = next ? new Date().toISOString() : null;
    setIsQuietPaused(next);
    updateQuietPauseInPulse(next, quietPausedAt);
    setStatusMessage(next ? copy.mySafePauseStatus : "");

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/quiet-pause`, { paused: next });
      if (result?.pulse) {
        applyServerPulse(result.pulse);
      } else if (result?.ok) {
        const savedQuietPausedAt = next && typeof result.quietPausedAt === "string" ? result.quietPausedAt : quietPausedAt;
        updateQuietPauseInPulse(next, savedQuietPausedAt);
      } else {
        setIsQuietPaused(previous);
        updateQuietPauseInPulse(previous, previous ? pulse.safety.myQuietPausedAt ?? new Date().toISOString() : null);
        setStatusMessage(copy.mySafePauseFailed);
      }
    } catch {
      setIsQuietPaused(previous);
      updateQuietPauseInPulse(previous, previous ? pulse.safety.myQuietPausedAt ?? new Date().toISOString() : null);
      setStatusMessage(copy.mySafePauseFailed);
    }
  };

  const pauseForNow = async () => {
    if (isQuietPaused) {
      setStatusMessage(copy.pollPassSaved);
      return;
    }

    const previous = isQuietPaused;
    const quietPausedAt = new Date().toISOString();
    setIsQuietPaused(true);
    updateQuietPauseInPulse(true, quietPausedAt);
    setStatusMessage(copy.pollPassSaved);

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/quiet-pause`, { paused: true });
      if (result?.pulse) {
        applyServerPulse(result.pulse);
      } else if (result?.ok) {
        const savedQuietPausedAt = typeof result.quietPausedAt === "string" ? result.quietPausedAt : quietPausedAt;
        updateQuietPauseInPulse(true, savedQuietPausedAt);
      } else {
        setIsQuietPaused(previous);
        updateQuietPauseInPulse(previous, previous ? pulse.safety.myQuietPausedAt ?? new Date().toISOString() : null);
        setStatusMessage(copy.mySafePauseFailed);
      }
    } catch {
      setIsQuietPaused(previous);
      updateQuietPauseInPulse(previous, previous ? pulse.safety.myQuietPausedAt ?? new Date().toISOString() : null);
      setStatusMessage(copy.mySafePauseFailed);
    }
  };

  const pauseVoteForNow = async () => {
    if (pollClosed) return;
    await pauseForNow();
  };

  const clearQuietPause = () => {
    if (!isQuietPaused) return;

    setIsQuietPaused(false);
    updateQuietPauseInPulse(false, null);
    void postJson(`/api/social/rooms/${room.slug}/quiet-pause`, { paused: false }).then((result) => {
      if (result?.pulse) applyServerPulse(result.pulse);
    }).catch(() => undefined);
  };

  const withQuietPauseClearedNotice = (message: string, wasQuietPaused = isQuietPaused) => {
    if (!wasQuietPaused) return message;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return copy.mySafePauseClearedForAction;

    const separator = /[.!?]$/.test(trimmedMessage) ? " " : ". ";
    return `${trimmedMessage}${separator}${copy.mySafePauseClearedForAction}`;
  };

  const toggleReadingComfort = () => {
    setIsReadingComfortOn((current) => {
      const next = !current;
      saveReadingComfortPreference(next);
      return next;
    });
  };

  const savePrivateNote = () => {
    const next = limitPrivateRoomNote(privateRoomNoteDraft.trim());
    setPrivateRoomNoteDraft(next);
    savePrivateRoomNote(next);
    setStatusMessage(next ? copy.privateNoteSaved : copy.privateNoteCleared);
  };

  const clearPrivateNote = () => {
    setPrivateRoomNoteDraft("");
    savePrivateRoomNote("");
    setStatusMessage(copy.privateNoteCleared);
  };

  const refreshRoomPulse = async () => {
    if (pulseRefreshLock.current) return;

    const previousPulse = pulse;
    pulseRefreshLock.current = true;
    setIsRefreshingPulse(true);
    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/pulse?lang=${encodeURIComponent(language)}`);
      if (!response.ok) {
        setStatusMessage(copy.roomRefreshFailed);
        return;
      }
      const result = await response.json() as SocialRoomPulseRefreshResponse;
      if (result?.pulse) {
        applyServerPulse(result.pulse);
        setStatusMessage(describeRoomRefresh(previousPulse, result.pulse, copy));
      } else {
        setStatusMessage(copy.roomRefreshFailed);
      }
    } catch {
      setStatusMessage(copy.roomRefreshFailed);
    } finally {
      pulseRefreshLock.current = false;
      setIsRefreshingPulse(false);
    }
  };

  const beginPlanResponse = (planKey: string) => {
    if (planResponseLocks.current.has(planKey)) return false;

    planResponseLocks.current.add(planKey);
    setRespondingPlanKeys((current) => new Set(current).add(planKey));
    return true;
  };

  const finishPlanResponse = (planKey: string) => {
    planResponseLocks.current.delete(planKey);
    setRespondingPlanKeys((current) => {
      const next = new Set(current);
      next.delete(planKey);
      return next;
    });
  };

  const beginPollVote = (optionId: string | null) => {
    if (voteLock.current) return false;

    voteLock.current = true;
    setVotingOptionId(optionId ?? "clear");
    return true;
  };

  const finishPollVote = () => {
    voteLock.current = false;
    setVotingOptionId(null);
  };

  const beginReplySend = (planKey: string) => {
    if (replySendLock.current) return false;

    replySendLock.current = true;
    setReplyingPlanKey(planKey);
    return true;
  };

  const finishReplySend = () => {
    replySendLock.current = false;
    setReplyingPlanKey(null);
  };

  const respondToPlan = async (
    response: SocialRoomPlanResponseAction,
    planKey = featuredPlan.key,
    successMessage?: string,
  ) => {
    if (!beginPlanResponse(planKey)) return;

    const previous = pulse;
    const isClearingResponse = response === "clear";
    const isPrivatePass = response === "not_for_me";
    const nextStatusMessage = isClearingResponse
      ? copy.planChoiceCleared
      : isPrivatePass
      ? copy.notForMeSaved
      : withQuietPauseClearedNotice(successMessage ?? (response === "join" ? copy.joined : copy.maybeSaved));
    if (!isClearingResponse && !isPrivatePass) clearQuietPause();
    setPulse((current) => updatePlanResponse(current, planKey, isClearingResponse ? null : response));
    setStatusMessage(nextStatusMessage);

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/plans/${planKey}/respond`, { response });
      if (result?.pulse) {
        applyServerPulse(result.pulse);
      } else if (result?.ok) {
        setStatusMessage(nextStatusMessage);
      } else {
        setPulse(previous);
        setStatusMessage(copy.postFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.postFailed);
    } finally {
      finishPlanResponse(planKey);
    }
  };

  const vote = async (optionId: string | null) => {
    if (pollClosed || !beginPollVote(optionId)) return;

    const previous = pulse;
    const isClearingVote = optionId === null;
    const nextStatusMessage = isClearingVote
      ? copy.voteChoiceCleared
      : withQuietPauseClearedNotice(copy.youVoted);
    if (!isClearingVote) clearQuietPause();
    setPulse((current) => updatePollVote(current, optionId));
    setStatusMessage(nextStatusMessage);

    try {
      const result = await postJson(
        `/api/social/rooms/${room.slug}/polls/${pulse.activePoll.key}/vote`,
        isClearingVote ? { action: "clear" } : { optionId },
      );
      if (result?.pulse) {
        applyServerPulse(result.pulse);
      } else if (result?.ok) {
        setStatusMessage(nextStatusMessage);
      } else {
        setPulse(previous);
        setStatusMessage(copy.postFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.postFailed);
    } finally {
      finishPollVote();
    }
  };

  const voteIssuePoll = async (pollKey: string, optionId: string | null) => {
    const issuePoll = (pulse.issuePolls ?? []).find((poll) => poll.key === pollKey);
    if (!issuePoll || issuePoll.status !== "active" || !beginPollVote(`${pollKey}:${optionId ?? "clear"}`)) return;

    const previous = pulse;
    const isClearingVote = optionId === null;
    const nextStatusMessage = isClearingVote
      ? copy.voteChoiceCleared
      : withQuietPauseClearedNotice(copy.youVoted);
    if (!isClearingVote) clearQuietPause();
    setPulse((current) => updateIssuePollVote(current, pollKey, optionId));
    setStatusMessage(nextStatusMessage);

    try {
      const result = await postJson(
        `/api/social/rooms/${room.slug}/polls/${pollKey}/vote`,
        isClearingVote ? { action: "clear" } : { optionId },
      );
      if (result?.pulse) {
        applyServerPulse(result.pulse);
      } else if (result?.ok) {
        setStatusMessage(nextStatusMessage);
      } else {
        setPulse(previous);
        setStatusMessage(copy.postFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.postFailed);
    } finally {
      finishPollVote();
    }
  };

  const saveComfortCheck = async (
    need: SocialRoomComfortNeed,
    savedMessage = copy.comfortSaved,
    removedMessage = copy.comfortSaved,
  ) => {
    if (isSavingComfortCheck) return;

    const currentNeeds = pulse.comfortCheck.myComfortNeeds ?? [];
    const alreadySelected = currentNeeds.includes(need);
    const nextNeeds = alreadySelected
      ? currentNeeds.filter((item) => item !== need)
      : normalizeComfortSelection([...currentNeeds, need]);
    const previous = pulse;
    const nextStatusMessage = alreadySelected ? removedMessage : savedMessage;

    setIsSavingComfortCheck(true);
    setPulse((current) => updateComfortCheck(current, nextNeeds));
    setStatusMessage(nextStatusMessage);

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/comfort-check`, { comfortNeeds: nextNeeds });
      if (result?.pulse) {
        applyServerPulse(result.pulse);
      } else if (result?.ok) {
        setStatusMessage(nextStatusMessage);
      } else {
        setPulse(previous);
        setStatusMessage(copy.postFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.postFailed);
    } finally {
      setIsSavingComfortCheck(false);
    }
  };

  const acknowledgeAgreement = async () => {
    if (agreementAcknowledged || isAcknowledgingAgreement) return;

    const previous = pulse;
    const acknowledgedAt = new Date().toISOString();
    setIsAcknowledgingAgreement(true);
    setPulse((current) => ({
      ...current,
      safety: {
        ...current.safety,
        myAcknowledgedAt: acknowledgedAt,
      },
    }));

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/safety-acknowledgement`, {});
      if (result?.pulse) {
        applyServerPulse(result.pulse);
        setStatusMessage(result.pulse.safety.acknowledgedLabel ?? copy.acknowledgedLabel);
      } else if (result?.ok) {
        setStatusMessage(copy.acknowledgedLabel);
      } else {
        setPulse(previous);
        setStatusMessage(copy.acknowledgementFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.acknowledgementFailed);
    } finally {
      setIsAcknowledgingAgreement(false);
    }
  };

  const [proposalKind, setProposalKind] = useState<SocialRoomPlanKind>(defaultPlanKind);

  useEffect(() => {
    if (!showProposalComposer || !proposalDraftRef.current) return;

    if (typeof proposalDraftRef.current.scrollIntoView === "function") {
      proposalDraftRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    proposalDraftRef.current.focus({ preventScroll: true });
  }, [proposalKind, showProposalComposer]);

  const resetProposalComposer = () => {
    setProposalDraft("");
    setShowProposalComposer(false);
    setProposalKind(defaultPlanKind);
    setProposalLocationLabel("online");
    setSelectedComfortNeeds([]);
    setProposalCategory("outing");
    setProposalPreferredTime("flexible");
    setProposalCostRange("discuss");
    setProposalGroupSize("one_to_one");
  };

  const cancelProposalComposer = () => {
    resetProposalComposer();
    setStatusMessage("");
  };

  const softenProposalTone = () => {
    setProposalDraft(copy.proposalToneRewriteDrafts[proposalKind]);
    setStatusMessage("");
  };

  const planPostReceiptMessage = (message: string) => {
    const receipt = buildWorkflowReceiptMoment({
      workflowReference: APP_WORKFLOW_REFERENCES.togetherSharePlan,
      status: "saved",
      capturedSummary: message,
      subject: proposalKind === "plan" ? copy.sharePlanTitle : undefined,
      locale: language === "es" ? "es" : "en",
    });
    return `${receipt.title}. ${receipt.message}`;
  };

  const submitProposal = async (
    title: string,
    details: string,
    locationLabel = "online",
    kind: SocialRoomPlanKind = proposalKind,
    comfortNeeds: SocialRoomComfortNeed[] = [],
    experienceCategory: SocialRoomExperienceCategory = proposalCategory,
    preferredTime: SocialRoomPreferredTime = proposalPreferredTime,
    costRange: SocialRoomCostRange = proposalCostRange,
    groupSize: SocialRoomGroupSize = proposalGroupSize,
  ) => {
    const trimmedDetails = limitProposalDraft(details.trim());
    const trimmedTitle = proposalTitleFromDraft(title, trimmedDetails);
    if (!trimmedTitle && !trimmedDetails) return;
    if (hasProtectedProposalDetails(`${trimmedTitle} ${trimmedDetails}`)) {
      setStatusMessage(copy.proposalSafetyWarning);
      return;
    }
    if (hasUnkindProposalTone(`${trimmedTitle} ${trimmedDetails}`)) {
      setStatusMessage(copy.proposalToneWarning);
      return;
    }
    if (proposalSendLock.current) return;

    proposalSendLock.current = true;
    const wasQuietPaused = isQuietPaused;
    const previousQuietPausedAt = pulse.safety.myQuietPausedAt ?? (wasQuietPaused ? new Date().toISOString() : null);
    if (wasQuietPaused) {
      setIsQuietPaused(false);
      updateQuietPauseInPulse(false, null);
    }
    setIsSending(true);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/proposals`, {
        title: trimmedTitle,
        details: trimmedDetails,
        locationLabel,
        comfortNeeds: kind === "plan" ? comfortNeeds : [],
        kind,
        experienceCategory: kind === "plan" ? experienceCategory : "other",
        preferredTime: kind === "plan" ? preferredTime : "flexible",
        costRange: kind === "plan" ? costRange : "discuss",
        groupSize,
      });
      if (!result?.pulse) {
        if (!result?.ok) {
          if (wasQuietPaused) {
            setIsQuietPaused(true);
            updateQuietPauseInPulse(true, previousQuietPausedAt);
          }
          setStatusMessage(copy.postFailed);
          return;
        }
        resetProposalComposer();
        setStatusMessage(withQuietPauseClearedNotice(planPostReceiptMessage(copy.sent), wasQuietPaused));
        return;
      }
      applyServerPulse(result.pulse);
      resetProposalComposer();
      const nextStatusMessage = result.proposal?.needsReview || result.proposal?.status === "pending_review"
        ? copy.reviewPending
        : copy.sent;
      setStatusMessage(withQuietPauseClearedNotice(planPostReceiptMessage(nextStatusMessage), wasQuietPaused));
    } catch {
      if (wasQuietPaused) {
        setIsQuietPaused(true);
        updateQuietPauseInPulse(true, previousQuietPausedAt);
      }
      setStatusMessage(copy.postFailed);
    } finally {
      proposalSendLock.current = false;
      setIsSending(false);
    }
  };

  const openPlanComposer = () => {
    const details = copy.starterDetails.plan;
    setProposalDraft(details);
    setProposalKind("plan");
    setProposalLocationLabel("nearby");
    setSelectedComfortNeeds(["quiet_pace"]);
    setProposalCategory("outing");
    setProposalPreferredTime("flexible");
    setProposalCostRange("discuss");
    setProposalGroupSize("one_to_one");
    setShowProposalComposer(true);
  };

  const openViewComposer = useCallback((draft = copy.roomDirectionViewDraft) => {
    setProposalKind("message");
    setProposalLocationLabel("online");
    setSelectedComfortNeeds([]);
    setProposalCategory("other");
    setProposalPreferredTime("flexible");
    setProposalCostRange("discuss");
    setProposalGroupSize("open_room");
    setProposalDraft(draft);
    setShowProposalComposer(true);
  }, [copy.roomDirectionViewDraft]);

  const openQuestionComposer = (draft = copy.starterDetails.ask) => {
    setProposalKind("question");
    setProposalLocationLabel("online");
    setSelectedComfortNeeds([]);
    setProposalCategory("other");
    setProposalPreferredTime("flexible");
    setProposalCostRange("discuss");
    setProposalGroupSize("open_room");
    setProposalDraft(draft);
    setShowProposalComposer(true);
  };

  useEffect(() => {
    if (!shareStoryHandoff || prefilledShareStoryId === shareStoryHandoff.id) return;

    const text = limitProposalDraft(shareStoryHandoff.text.trim());
    if (!text) return;

    openViewComposer(text);
    setPlacedShareStoryHandoff(null);
    setPrefilledShareStoryId(shareStoryHandoff.id);
  }, [openViewComposer, prefilledShareStoryId, shareStoryHandoff]);

  const editShareStoryHandoff = () => {
    if (!activeShareStoryHandoff) return;
    openViewComposer(limitProposalDraft(proposalDraft.trim() || activeShareStoryHandoff.text));
  };

  const sendShareStoryHandoff = async () => {
    if (!activeShareStoryHandoff || !proposalDraft.trim()) return;

    await submitProposal(
      proposalDraft,
      proposalDraft,
      "online",
      "message",
      [],
      "other",
      "flexible",
      "discuss",
      "open_room",
    );
    setPlacedShareStoryHandoff(activeShareStoryHandoff);
    setDismissedShareStoryId(activeShareStoryHandoff.id);
  };

  const prepareShareStoryReplyDraft = (draft: string) => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    openViewComposer(limitProposalDraft(trimmed));
  };

  const startRoomDirectionPlan = () => {
    if (leadingPollOption?.id === "views") {
      openViewComposer();
      return;
    }

    const comfortNeeds = normalizeComfortSelection(
      pulse.comfortCheck.myComfortNeeds.length ? pulse.comfortCheck.myComfortNeeds : getTopComfortNeeds(pulse),
    );
    setProposalKind("plan");
    setProposalLocationLabel(leadingPollOption?.id === "lunch" ? "nearby" : "online");
    setSelectedComfortNeeds(comfortNeeds);
    setProposalCategory(categoryForRoomDirection(leadingPollOption?.id));
    setProposalPreferredTime("flexible");
    setProposalCostRange("discuss");
    setProposalGroupSize("small_group");
    setProposalDraft(copy.roomDirectionDraft(roomChoiceLabel, topComfortLabels));
    setShowProposalComposer(true);
  };

  const startRoomRecapQuestion = () => {
    openQuestionComposer(copy.roomRecapDraft(roomChoiceLabel, topComfortLabels));
  };

  const startViewRecapQuestion = () => {
    openQuestionComposer(copy.viewRecapDraft(sharedViewPosts.length));
  };

  const startViewVoteQuestion = () => {
    openQuestionComposer(copy.viewVoteBridgeDraft(sharedViewPosts.length));
  };

  const startRoomUpdatesRecapQuestion = () => {
    openQuestionComposer(copy.roomUpdatesRecapDraft(roomUpdateRecapCount));
  };

  const startRoomTrustQuestion = () => {
    openQuestionComposer(copy.roomTrustDraft);
  };

  const startRoomIntroQuestion = () => {
    openQuestionComposer(copy.roomTrustIntroDraft);
  };

  const startIssueVoteQuestion = (question: SocialRoomPlan, issuePoll?: SocialRoomPulse["activePoll"] | null) => {
    const title = (question.title || question.body || copy.issueQueueBadge).trim();
    openQuestionComposer(issuePoll ? copy.issueQueueUseDraft(title, issuePollSignal(issuePoll)) : copy.issueQueueDraft(title));
  };

  const startIssuePromptQuestion = (action: IssuePromptAction) => {
    openQuestionComposer(copy.issuePromptDrafts[action]);
  };

  const startActivityReadyQuestion = (plan: SocialRoomPlan) => {
    openQuestionComposer(copy.activityReadyDraft(
      plan.title,
      activityReadyDraftSignals(plan, copy),
    ));
  };

  const roomUpdateActionFor = (notification: SocialRoomPulse["notifications"][number]) => {
    const planKey = notificationMetadataString(notification, "planKey");
    if (!planKey) return null;

    if (notification.type === "activity_ready") {
      const plan = activityPlanByKey.get(planKey);
      if (!plan) return null;
      return {
        label: copy.activityReadyAction,
        safetyLabel: copy.activityReadyPrivate,
        icon: Sparkles,
        testId: `together-update-action-${notification.id}`,
        onClick: () => startActivityReadyQuestion(plan),
      };
    }

    if (notification.type === "vote_ready") {
      const question = issueQuestionPosts.find((item) => item.key === planKey);
      if (!question) return null;
      const issuePoll = (pulse.issuePolls ?? []).find((item) => item.sourcePlanKey === planKey);
      return {
        label: copy.voteReadyAction,
        safetyLabel: copy.voteReadyPrivate,
        icon: Vote,
        testId: `together-update-action-${notification.id}`,
        onClick: () => startIssueVoteQuestion(question, issuePoll ?? null),
      };
    }

    return null;
  };

  const startPlanDetailCheckQuestion = (plan: SocialRoomPlan) => {
    openQuestionComposer(copy.planDetailCheckDraft(plan.title));
  };

  const starterActions: Array<{ id: StarterAction; label: string; icon: typeof MessageCircle }> = [
    { id: "hello", label: pulse.discussionPrompt.starterButtons[0] ?? copy.starterLabels.hello, icon: MessageCircle },
    { id: "plan", label: pulse.discussionPrompt.starterButtons[1] ?? copy.starterLabels.plan, icon: Sparkles },
    { id: "ask", label: pulse.discussionPrompt.starterButtons[2] ?? copy.starterLabels.ask, icon: HeartHandshake },
  ];
  const dailyQuestion = pulse.discussionPrompt.dailyQuestion;
  const joiningSupportCue = pulse.joiningSupportCue;

  const handleStarter = (action: StarterAction, label: string) => {
    const details = copy.starterDetails[action];
    setProposalDraft(details);
    if (action === "hello") {
      void submitProposal(label, details, "online", "message", [], "other", "flexible", "discuss", "open_room");
      return;
    }
    if (action === "plan") {
      openPlanComposer();
      return;
    }
    openQuestionComposer(details);
  };

  const nextGentleStepId = chooseNextGentleStep({
    agreementAcknowledged,
    unreadRoomUpdateCount,
    pulse,
    pollClosed,
    hasRoomSignals,
  });
  const isNextGentleStepDisabled =
    (nextGentleStepId === "promise" && isAcknowledgingAgreement)
    || (nextGentleStepId === "comfort" && isSavingComfortCheck)
    || (nextGentleStepId === "hello" && isSending);

  const roomReadAloudText = () => {
    const voteNote = tiedPollLabels.length > 1
      ? copy.roomNotesVoteTie(tiedPollLabels)
      : leadingPollOption
        ? copy.roomNotesVoteKnown(leadingPollOption.label)
        : copy.roomNotesVoteWaiting;
    const comfortNote = topComfortLabels.length > 0
      ? copy.roomNotesComfortKnown(topComfortLabels)
      : copy.roomNotesComfortWaiting;
    const viewsNote = sharedViewPosts.length > 0
      ? copy.roomNotesViewsKnown(sharedViewPosts.length)
      : copy.roomNotesViewsWaiting;
    const nextStep = copy.nextGentleSteps[nextGentleStepId];

    return [
      room.name,
      copy.safeStatus,
      pulse.safety.body,
      pulse.safety.consentLine,
      `${featuredPlan.title}. ${featuredPlan.body}`,
      `${copy.planNextStepTitle}. ${planNextStepBody(featuredPlan, copy)}`,
      voteNote,
      comfortNote,
      viewsNote,
      `${copy.nextGentleStepLabel}. ${nextStep.title}. ${nextStep.body}`,
      copy.roomNotesPrivacy,
    ].filter(Boolean).join(" ");
  };

  const copyNoNameRoomNotes = async (notes: string) => {
    if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
      setStatusMessage(copy.roomNotesCopyFailed);
      return;
    }

    try {
      await navigator.clipboard.writeText(notes);
      setStatusMessage(copy.roomNotesCopied);
    } catch {
      setStatusMessage(copy.roomNotesCopyFailed);
    }
  };

  const stopReadingRoomAloud = (message = copy.readRoomAloudStopped) => {
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    speechUtteranceRef.current = null;
    setIsReadingRoomAloud(false);
    setStatusMessage(message);
  };

  const toggleRoomReadAloud = () => {
    if (isReadingRoomAloud) {
      stopReadingRoomAloud();
      return;
    }

    if (
      typeof window === "undefined"
      || !window.speechSynthesis
      || typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setStatusMessage(copy.readRoomAloudUnavailable);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(roomReadAloudText());
    utterance.lang = speechLanguage(language);
    utterance.rate = isReadingComfortOn ? 0.82 : 0.88;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (speechUtteranceRef.current !== utterance) return;
      speechUtteranceRef.current = null;
      setIsReadingRoomAloud(false);
    };
    utterance.onerror = () => {
      if (speechUtteranceRef.current !== utterance) return;
      speechUtteranceRef.current = null;
      setIsReadingRoomAloud(false);
      setStatusMessage(copy.readRoomAloudUnavailable);
    };

    try {
      window.speechSynthesis.cancel();
      speechUtteranceRef.current = utterance;
      setIsReadingRoomAloud(true);
      setStatusMessage(copy.readRoomAloudStarted);
      window.speechSynthesis.speak(utterance);
    } catch {
      speechUtteranceRef.current = null;
      setIsReadingRoomAloud(false);
      setStatusMessage(copy.readRoomAloudUnavailable);
    }
  };

  const scrollToRoomSection = (testId: string) => {
    if (typeof document === "undefined") return;
    if (compactRoomDetailTargets.has(testId)) {
      setShowRoomDetails(true);
    }
    const target = document.querySelector(`[data-testid="${testId}"]`);
    if (!(target instanceof HTMLElement)) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    focusTemporaryRoomElement(target);
  };

  const handleNextGentleStep = () => {
    if (nextGentleStepId === "promise") {
      void acknowledgeAgreement();
      return;
    }
    if (nextGentleStepId === "updates") {
      scrollToRoomSection("together-room-updates");
      return;
    }
    if (nextGentleStepId === "comfort") {
      void saveComfortCheck("listen_first", copy.listenFirstSaved, copy.listenFirstRemoved);
      return;
    }
    if (nextGentleStepId === "vote") {
      scrollToRoomSection("together-room-choice");
      return;
    }
    if (nextGentleStepId === "plan") {
      scrollToRoomSection("together-featured-plan");
      return;
    }
    if (nextGentleStepId === "recap") {
      startRoomRecapQuestion();
      return;
    }
    handleStarter("hello", copy.starterLabels.hello);
  };

  const explainNextGentleStep = () => {
    openQuestionComposer(copy.nextGentleStepExplainDraft(copy.nextGentleSteps[nextGentleStepId].title));
  };

  const toggleComfortNeed = (need: SocialRoomComfortNeed) => {
    setSelectedComfortNeeds((current) => (
      current.includes(need)
        ? current.filter((item) => item !== need)
        : [...current, need]
    ));
  };

  const sendSafetyReport = async (choice: SafetyHelpChoice) => {
    if (isSendingSafetyReport) return;

    setIsSendingSafetyReport(true);
    setStatusMessage(copy.helpSent);
    const receiptAnchor = safetyHelpPanelAnchor ?? "intro";
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/safety-reports`, {
        reason: copy.safetyHelpChoiceReasons[choice],
        details: copy.safetyHelpChoiceDetails[choice],
      });
      if (result?.pulse) {
        applyServerPulse(result.pulse);
        setLastSafetyHelpChoice(choice);
        setLastSafetyHelpReceiptAnchor(receiptAnchor);
        setSafetyHelpPanelAnchor(null);
      } else if (result?.ok) {
        setLastSafetyHelpChoice(choice);
        setLastSafetyHelpReceiptAnchor(receiptAnchor);
        setSafetyHelpPanelAnchor(null);
      } else {
        setStatusMessage(copy.helpFailed);
      }
    } catch {
      setStatusMessage(copy.helpFailed);
    } finally {
      setIsSendingSafetyReport(false);
    }
  };

  const beginItemReport = (reportKey: string) => {
    if (itemReportLocks.current.has(reportKey) || reportedItemIds.has(reportKey)) return false;

    itemReportLocks.current.add(reportKey);
    setReportingItemIds((current) => new Set(current).add(reportKey));
    return true;
  };

  const finishItemReport = (reportKey: string, sent: boolean) => {
    setReportingItemIds((current) => {
      const next = new Set(current);
      next.delete(reportKey);
      return next;
    });
    if (sent) {
      setReportedItemIds((current) => new Set(current).add(reportKey));
    } else {
      itemReportLocks.current.delete(reportKey);
    }
  };

  const sendSharedItemReport = async (plan: SocialRoomPlan) => {
    const reportKey = `plan:${plan.key}`;
    if (!beginItemReport(reportKey)) return;

    const targetType = plan.kind ?? defaultPlanKind;
    const details = `${sharedKindLabelForPlan(plan, copy)}: ${plan.title}${plan.body ? ` - ${plan.body}` : ""}`.slice(0, 460);
    setStatusMessage(copy.reviewItemSent);
    let sent = false;
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/safety-reports`, {
        reason: "shared_item_review",
        targetType,
        targetId: plan.key,
        details,
      });
      if (result?.pulse) {
        applyServerPulse(result.pulse);
        sent = true;
      } else if (result?.ok) {
        sent = true;
      } else {
        setStatusMessage(copy.helpFailed);
      }
    } catch {
      setStatusMessage(copy.helpFailed);
    } finally {
      finishItemReport(reportKey, sent);
    }
  };

  const withdrawSharedItem = async (plan: SocialRoomPlan) => {
    const itemKey = plan.key;
    if (itemWithdrawLocks.current.has(itemKey)) return;

    itemWithdrawLocks.current.add(itemKey);
    setWithdrawingItemIds((current) => new Set(current).add(itemKey));
    const previous = pulse;
    setPulse((current) => removePostedExperience(current, itemKey));
    setStatusMessage(copy.withdrawItemSent);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/plans/${itemKey}/withdraw`, {});
      const didWithdraw = result?.withdrawnItem?.withdrawn !== false;
      if (result?.pulse && didWithdraw) {
        applyServerPulse(removePostedExperience(result.pulse, itemKey));
        setStatusMessage(copy.withdrawItemSent);
      } else if (result?.ok && didWithdraw) {
        setStatusMessage(copy.withdrawItemSent);
      } else {
        setPulse(previous);
        setStatusMessage(copy.withdrawItemFailed);
        itemWithdrawLocks.current.delete(itemKey);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.withdrawItemFailed);
      itemWithdrawLocks.current.delete(itemKey);
    } finally {
      setWithdrawingItemIds((current) => {
        const next = new Set(current);
        next.delete(itemKey);
        return next;
      });
    }
  };

  const withdrawReply = async (plan: SocialRoomPlan, reply: SocialRoomReply) => {
    const replyKey = `${plan.key}:${reply.id}`;
    if (replyWithdrawLocks.current.has(replyKey)) return;

    replyWithdrawLocks.current.add(replyKey);
    setWithdrawingReplyIds((current) => new Set(current).add(reply.id));
    const previous = pulse;
    setPulse((current) => removePlanReply(current, plan.key, reply.id));
    setStatusMessage(copy.withdrawReplySent);

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/plans/${plan.key}/replies/${reply.id}/withdraw`, {});
      const didWithdraw = result?.withdrawnReply?.withdrawn !== false;
      if (result?.pulse && didWithdraw) {
        applyServerPulse(removePlanReply(result.pulse, plan.key, reply.id));
        setStatusMessage(copy.withdrawReplySent);
      } else if (result?.ok && didWithdraw) {
        setStatusMessage(copy.withdrawReplySent);
      } else {
        setPulse(previous);
        setStatusMessage(copy.withdrawReplyFailed);
        replyWithdrawLocks.current.delete(replyKey);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.withdrawReplyFailed);
      replyWithdrawLocks.current.delete(replyKey);
    } finally {
      setWithdrawingReplyIds((current) => {
        const next = new Set(current);
        next.delete(reply.id);
        return next;
      });
    }
  };

  const sendGentleReply = async (plan: SocialRoomPlan, tone: SocialRoomReplyTone) => {
    if (!beginReplySend(plan.key)) return;

    const nextStatusMessage = withQuietPauseClearedNotice(copy.replySent);
    clearQuietPause();
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/plans/${plan.key}/replies`, {
        body: copy.replyBodies[tone],
        tone,
      });
      if (result?.pulse) {
        applyServerPulse(result.pulse);
        setStatusMessage(nextStatusMessage);
      } else if (result?.ok) {
        setStatusMessage(nextStatusMessage);
      } else {
        setStatusMessage(copy.replyFailed);
      }
    } catch {
      setStatusMessage(copy.replyFailed);
    } finally {
      finishReplySend();
    }
  };

  const sendReplyReport = async (plan: SocialRoomPlan, reply: SocialRoomReply) => {
    const reportKey = `reply:${reply.id}`;
    if (!beginItemReport(reportKey)) return;

    const details = `${plan.title}: ${reply.body}`.slice(0, 460);
    setStatusMessage(copy.reviewItemSent);
    let sent = false;
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/safety-reports`, {
        reason: "reply_review",
        targetType: "reply",
        targetId: reply.id,
        details,
      });
      if (result?.pulse) {
        applyServerPulse(result.pulse);
        sent = true;
      } else if (result?.ok) {
        sent = true;
      } else {
        setStatusMessage(copy.helpFailed);
      }
    } catch {
      setStatusMessage(copy.helpFailed);
    } finally {
      finishItemReport(reportKey, sent);
    }
  };

  const sendPlanCollaboration = async (action: PlanCollaborationAction, plan: SocialRoomPlan = featuredPlan) => {
    if ((plan.myHelperActions ?? []).includes(action)) {
      if (!beginReplySend(plan.key)) return;

      const previous = pulse;
      setPulse((current) => updatePlanHelperAction(current, plan.key, action, false));
      setStatusMessage(copy.planSupportRemoved);
      try {
        const result = await postJson(`/api/social/rooms/${room.slug}/plans/${plan.key}/helpers/${action}/clear`, {});
        if (result?.pulse) {
          applyServerPulse(updatePlanHelperAction(result.pulse, plan.key, action, false));
          setStatusMessage(copy.planSupportRemoved);
        } else if (result?.ok) {
          setStatusMessage(copy.planSupportRemoved);
        } else {
          setPulse(previous);
          setStatusMessage(copy.replyFailed);
        }
      } catch {
        setPulse(previous);
        setStatusMessage(copy.replyFailed);
      } finally {
        finishReplySend();
      }
      return;
    }
    if (!beginReplySend(plan.key)) return;

    const previous = pulse;
    const nextStatusMessage = withQuietPauseClearedNotice(copy.replySent);
    clearQuietPause();
    setPulse((current) => updatePlanHelperAction(current, plan.key, action));
    setStatusMessage(nextStatusMessage);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/plans/${plan.key}/replies`, {
        body: copy.planSupportReplies[action],
        tone: planCollaborationTones[action],
      });
      if (result?.pulse) {
        applyServerPulse(updatePlanHelperAction(result.pulse, plan.key, action));
        setStatusMessage(nextStatusMessage);
      } else if (result?.ok) {
        setStatusMessage(nextStatusMessage);
      } else {
        setPulse(previous);
        setStatusMessage(copy.replyFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.replyFailed);
    } finally {
      finishReplySend();
    }
  };

  const markUpdateSeen = async (notificationId: string) => {
    if (markingUpdateId || isMarkingAllUpdatesSeen) return;

    const previous = pulse;
    const seenAt = new Date().toISOString();
    const wasUnread = previous.notifications.some((notification) => (
      notification.id === notificationId && !notification.readAt
    ));
    setMarkingUpdateId(notificationId);
    setPulse((current) => ({
      ...current,
      notifications: current.notifications.map((notification) => (
        notification.id === notificationId ? { ...notification, readAt: seenAt } : notification
      )),
      unreadNotificationCount: wasUnread ? Math.max(0, countUnreadRoomUpdates(current) - 1) : countUnreadRoomUpdates(current),
    }));
    setStatusMessage(copy.updateSeen);

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/notifications/${notificationId}/read`, {});
      if (result?.pulse) {
        applyServerPulse(result.pulse);
      } else if (result?.ok) {
        setStatusMessage(copy.updateSeen);
      } else {
        setPulse(previous);
        setStatusMessage(copy.updateSeenFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.updateSeenFailed);
    } finally {
      setMarkingUpdateId(null);
    }
  };

  const markAllUpdatesSeen = async () => {
    if (markingUpdateId || isMarkingAllUpdatesSeen || roomUpdates.length === 0) return;

    const previous = pulse;
    const seenAt = new Date().toISOString();
    const visibleUpdateIds = new Set(roomUpdates.map((notification) => notification.id));

    setIsMarkingAllUpdatesSeen(true);
    setPulse((current) => ({
      ...current,
      notifications: current.notifications.map((notification) => (
        visibleUpdateIds.has(notification.id) ? { ...notification, readAt: seenAt } : notification
      )),
      unreadNotificationCount: 0,
    }));
    setStatusMessage(copy.allUpdatesSeen);

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/notifications/read-all`, {});
      if (result?.pulse) {
        applyServerPulse(result.pulse);
      } else if (result?.ok) {
        setStatusMessage(copy.allUpdatesSeen);
      } else {
        setPulse(previous);
        setStatusMessage(copy.allUpdatesSeenFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.allUpdatesSeenFailed);
    } finally {
      setIsMarkingAllUpdatesSeen(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#F7FAF7] px-5 pb-10 pt-5 text-[#211729] ${isReadingComfortOn ? "together-readable" : ""}`}
      data-testid="together-room-screen"
    >
      <SocialStyles />
      <TogetherReadableStyles />

      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[52px] items-center gap-3 rounded-full border border-[#D8E7E2] bg-white px-5 font-body text-[19px] font-bold text-[#315C55] shadow-[0_8px_18px_rgba(15,118,110,0.08)]"
      >
        <ArrowLeft size={21} aria-hidden="true" />
        {copy.back}
      </button>

      <main className="mx-auto mt-4 flex w-full max-w-[720px] flex-col gap-4">
        <section className="rounded-[24px] border border-[#D8E7E2] bg-white px-4 py-4 shadow-[0_18px_38px_rgba(33,23,41,0.08)]">
          <div className="flex items-start gap-4">
            <AgentAvatar
              agentSlug={room.agentSlug}
              fullName={room.agentFullName}
              colour={room.agentColour}
              size={52}
              title={room.agentFullName}
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[30px] leading-[1.02] text-[#2F2135]">{room.name}</h1>
              <p className="mt-1 font-body text-[16px] leading-[1.32] text-[#66556E]">{pulse.safety.body}</p>
              {isReadingComfortOn && (
                <p
                  className="mt-3 rounded-[16px] bg-[#F4FBF8] px-3 py-2 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]"
                  data-testid="together-reading-comfort-note"
                >
                  {copy.readingComfortNote}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full bg-[#EAF8F4] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]">
              <ShieldCheck size={16} aria-hidden="true" />
              {copy.safeStatus}
            </div>
            <button
              type="button"
              onClick={() => {
                setSafetyHelpPanelAnchor((current) => current === "intro" ? null : "intro");
                setStatusMessage("");
                setLastSafetyHelpChoice(null);
                setLastSafetyHelpReceiptAnchor(null);
              }}
              disabled={isSendingSafetyReport}
              data-testid="together-safety-quick-help"
              aria-expanded={safetyHelpPanelAnchor === "intro"}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-[#A9DCCE] bg-white px-4 font-body text-[14px] font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
            >
              <LifeBuoy size={15} aria-hidden="true" />
              {isSendingSafetyReport ? copy.helpSending : pulse.safety.helpLabel}
            </button>
            <button
              type="button"
              onClick={() => void refreshRoomPulse()}
              disabled={isRefreshingPulse}
              data-testid="together-refresh-room"
              aria-busy={isRefreshingPulse}
              className={`${showRoomDetails ? "inline-flex" : "hidden"} min-h-[40px] items-center justify-center gap-2 rounded-full border border-[#DBE7F6] bg-[#FAFCFF] px-4 font-body text-[14px] font-bold text-[#2563EB] disabled:cursor-default disabled:opacity-70`}
            >
              <RefreshCw size={15} className={isRefreshingPulse ? "animate-spin" : ""} aria-hidden="true" />
              {isRefreshingPulse ? copy.refreshingRoom : copy.refreshRoom}
            </button>
            <button
              type="button"
              onClick={toggleReadingComfort}
              data-testid="together-reading-comfort"
              aria-pressed={isReadingComfortOn}
              className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border px-4 font-body text-[14px] font-bold disabled:cursor-default disabled:opacity-70 ${
                isReadingComfortOn
                  ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                  : "border-[#D8E7E2] bg-white text-[#315C55]"
              }`}
            >
              <ZoomIn size={15} aria-hidden="true" />
              {isReadingComfortOn ? copy.readingComfortOnLabel : copy.readingComfortLabel}
            </button>
            <button
              type="button"
              onClick={toggleRoomReadAloud}
              data-testid="together-read-aloud"
              aria-pressed={isReadingRoomAloud}
              className={`${showRoomDetails || isReadingRoomAloud ? "inline-flex" : "hidden"} min-h-[40px] items-center justify-center gap-2 rounded-full border px-4 font-body text-[14px] font-bold disabled:cursor-default disabled:opacity-70 ${
                isReadingRoomAloud
                  ? "border-[#6D28D9] bg-[#F8F5FF] text-[#5B21B6]"
                  : "border-[#E7DDF4] bg-white text-[#4B2E6E]"
              }`}
            >
              <Volume2 size={15} aria-hidden="true" />
              {isReadingRoomAloud ? copy.readRoomAloudActive : copy.readRoomAloud}
            </button>
          </div>

          {safetyHelpPanelAnchor === "intro" && (
            <SafetyHelpPanel
              copy={copy}
              isSending={isSendingSafetyReport}
              onSend={(choice) => void sendSafetyReport(choice)}
              onCancel={() => setSafetyHelpPanelAnchor(null)}
            />
          )}
          {safetyHelpPanelAnchor === null && lastSafetyHelpChoice && lastSafetyHelpReceiptAnchor === "intro" && (
            <SafetyHelpReceipt copy={copy} choice={lastSafetyHelpChoice} />
          )}

          <div className="mt-4 rounded-[18px] border border-[#D8E7E2] bg-[#F7FAF7] px-4 py-2.5" data-testid="together-member-strip">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 font-body text-[17px] font-bold text-[#315C55]">
                <Users size={20} aria-hidden="true" />
                {copy.present(Math.max(members.length, 1))}
              </div>
              <p className="min-w-0 flex-1 font-body text-[15px] font-bold leading-[1.25] text-[#55706B]">
                {members.map((member) => member.name).join(", ")}
              </p>
            </div>
            <div className={showRoomDetails ? "mt-3 grid grid-cols-3 gap-2" : "hidden"}>
              {members.map((member, index) => (
                <div
                  key={member.id}
                  className="min-w-0 rounded-[18px] bg-white/80 px-2 py-3 text-center shadow-[0_8px_14px_rgba(33,23,41,0.06)]"
                  title={member.statusLabel ? `${member.name}: ${member.statusLabel}` : member.name}
                >
                  <div
                    className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-white font-body text-[17px] font-bold text-white shadow-[0_8px_14px_rgba(33,23,41,0.12)]"
                    style={{ background: memberColours[index % memberColours.length] }}
                    aria-hidden="true"
                  >
                    {getInitial(member.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="mt-2 break-words font-body text-[15px] font-bold leading-tight text-[#244D47]">
                      {member.name}
                    </p>
                    {member.statusLabel && (
                      <p
                        className="mt-1 min-h-[48px] break-words font-body text-[13px] font-bold leading-[1.18] text-[#5F6D8A] sm:min-h-[42px] sm:text-[14px] sm:leading-[1.24]"
                        data-testid={`together-member-status-${member.id}`}
                      >
                        {member.statusLabel}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

        {activeShareStoryHandoff ? (
          <StoryRoomHandoffCard
            note={activeShareStoryHandoff}
            roomName={room.name}
            language={language}
            isBusy={isSending}
            onPrimary={() => void sendShareStoryHandoff()}
            onEdit={editShareStoryHandoff}
            onShareAnother={() => {
              if (onOpenShareStories) {
                onOpenShareStories();
                return;
              }
              onBack();
            }}
          />
        ) : null}

        {!activeShareStoryHandoff && replyLoopShareStoryHandoff ? (
          <StoryRoomReplyLoopCard
            note={replyLoopShareStoryHandoff}
            roomName={room.name}
            language={language}
            responderName={members[0]?.name}
            responderNames={members.slice(0, 2).map((member) => member.name)}
            onReply={prepareShareStoryReplyDraft}
            onShareAnother={() => {
              if (onOpenShareStories) {
                onOpenShareStories();
                return;
              }
              onBack();
            }}
          />
        ) : null}

        <section className="rounded-[24px] border border-[#E2D7C4] bg-[#FFFDF8] px-4 py-4 shadow-[0_18px_36px_rgba(151,110,37,0.08)]" data-testid="together-featured-plan">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#F6C453] text-[#2F2135]">
              <HeartHandshake size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-body text-[13px] font-bold uppercase text-[#8A4B16]">
                {simpleCopy.mainStepLabel}
              </p>
              <h2 className="font-display text-[29px] leading-[1.04] text-[#2F2135]">{featuredPlan.title}</h2>
              <p className="mt-1 font-body text-[17px] leading-[1.32] text-[#62556B]">{featuredPlan.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <PlanLocationPill plan={featuredPlan} copy={copy} />
                <p
                  className="inline-flex items-center gap-2 rounded-full bg-[#F4FBF8] px-3 py-2 font-body text-[16px] font-bold text-[#315C55]"
                  data-testid="together-featured-response-summary"
                >
                  <Users size={17} aria-hidden="true" />
                  {formatResponseSummary(featuredPlan, copy)}
                </p>
              </div>
              <div className={showRoomDetails ? "" : "hidden"} data-testid="together-featured-plan-details">
                <PlanComfortPills plan={featuredPlan} copy={copy} />
                <PlanExperiencePills plan={featuredPlan} copy={copy} />
                <PlanComfortConfidenceCue plan={featuredPlan} copy={copy} />
                <PlanDetailCheckCue
                  copy={copy}
                  plan={featuredPlan}
                  onAsk={() => startPlanDetailCheckQuestion(featuredPlan)}
                  disabled={isSending}
                />
                <PlanReviewNotice plan={featuredPlan} copy={copy} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void respondToPlan("join")}
              disabled={respondingPlanKeys.has(featuredPlan.key)}
              aria-pressed={hasJoined}
              data-testid="together-join-plan"
              className={`min-h-[60px] rounded-[20px] px-4 font-body text-[20px] font-bold shadow-[0_12px_22px_rgba(109,40,217,0.16)] disabled:cursor-default disabled:opacity-65 ${
                hasJoined ? "bg-[#0F766E] text-white" : "bg-[#6D28D9] text-white"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {hasJoined && <Check size={22} aria-hidden="true" />}
                {hasJoined ? copy.joined : copy.join}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void respondToPlan("maybe")}
              disabled={respondingPlanKeys.has(featuredPlan.key)}
              aria-pressed={hasMaybe}
              data-testid="together-maybe-plan"
              className={`min-h-[60px] rounded-[20px] border px-4 font-body text-[19px] font-bold disabled:cursor-default disabled:opacity-65 ${
                hasMaybe
                  ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                  : "border-[#D8E7E2] bg-white text-[#315C55]"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Clock size={21} aria-hidden="true" />
                {hasMaybe ? copy.maybeSaved : copy.maybe}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void respondToPlan("not_for_me")}
              disabled={respondingPlanKeys.has(featuredPlan.key)}
              aria-pressed={hasNotForMe}
              data-testid="together-not-for-me-plan"
              className={`min-h-[48px] rounded-[17px] border px-4 font-body text-[16px] font-bold disabled:cursor-default disabled:opacity-65 sm:col-span-2 ${
                hasNotForMe
                  ? "border-[#8A4B16] bg-[#FFF9F3] text-[#8A4B16]"
                  : "border-[#E2D7C4] bg-[#FFFDF8] text-[#6B4F13]"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <X size={21} aria-hidden="true" />
                {hasNotForMe ? copy.notForMeSaved : copy.notForMe}
              </span>
            </button>
          </div>
          <p className="mt-2 rounded-[16px] bg-white px-4 py-2.5 font-body text-[15px] font-bold leading-[1.3] text-[#6B4F13]">
            {simpleCopy.planFinePrint}
          </p>
          {(hasJoined || hasMaybe || hasNotForMe) && (
            <button
              type="button"
              onClick={() => void respondToPlan("clear")}
              disabled={respondingPlanKeys.has(featuredPlan.key)}
              data-testid="together-clear-plan-choice"
              className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#D8E7E2] bg-white px-4 font-body text-[17px] font-bold text-[#315C55] disabled:cursor-default disabled:opacity-65"
            >
              <X size={18} aria-hidden="true" />
              {copy.clearPlanChoice}
            </button>
          )}

          <div className={showRoomDetails ? "" : "hidden"} data-testid="together-plan-extra-details">
            <div className="mt-3 rounded-[18px] bg-[#F4FBF8] px-4 py-3" data-testid="together-plan-choice-note">
              <div className="flex items-start gap-2">
                <HeartHandshake size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.planChoiceNoteTitle}</p>
                  <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{copy.planChoiceNoteBody}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-[18px] border border-[#CFECE3] bg-white px-4 py-3" data-testid="together-plan-next-step">
              <div className="flex items-start gap-2">
                <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.planNextStepTitle}</p>
                  <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{planNextStepBody(featuredPlan, copy)}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {copy.planNextStepChecks.map((item) => (
                      <span
                        key={item}
                        className="inline-flex min-h-[38px] items-center gap-2 rounded-[14px] bg-[#F4FBF8] px-3 font-body text-[14px] font-bold text-[#315C55]"
                      >
                        <Check size={16} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 rounded-[18px] bg-[#EAF8F4] px-4 py-3 font-body text-[17px] font-bold leading-[1.3] text-[#315C55]">
              {pulse.safety.consentLine}
            </p>

            <div className="mt-4 rounded-[22px] bg-[#F7FAF7] px-4 py-4" data-testid="together-plan-collaboration">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-[#0F766E]" aria-hidden="true" />
              <h3 className="font-body text-[18px] font-bold text-[#315C55]">{copy.planSupportTitle}</h3>
            </div>
            <p className="mt-1 font-body text-[16px] font-bold leading-[1.35] text-[#55706B]">{copy.planSupportBody}</p>
            <PlanSupportSummary copy={copy} plan={featuredPlan} />
            <PlanHelperCue
              copy={copy}
              plan={featuredPlan}
              onChoose={(action) => void sendPlanCollaboration(action)}
              disabled={replyingPlanKey === featuredPlan.key}
            />
            <PlanReadinessBridge
              copy={copy}
              plan={featuredPlan}
              onAsk={() => startActivityReadyQuestion(featuredPlan)}
            />
            {featuredPlanReplies.length > 0 && (
              <div className="mt-3 grid gap-2" data-testid="together-featured-replies">
                {featuredPlanReplies.map((reply) => {
                  const reportKey = `reply:${reply.id}`;
                  const isReporting = reportingItemIds.has(reportKey);
                  const isReported = reportedItemIds.has(reportKey);
                  return (
                    <article
                      key={reply.id}
                      className="rounded-[15px] bg-white px-3 py-2 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]"
                      data-testid={`together-featured-reply-${reply.id}`}
                    >
                      <p>{reply.body}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void sendReplyReport(featuredPlan, reply)}
                          disabled={isReporting || isReported}
                          data-testid={`together-review-reply-${reply.id}`}
                          className="min-h-[44px] rounded-[15px] border border-[#CFECE3] bg-[#F7FAF7] px-4 font-body text-[14px] font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
                        >
                          {isReporting ? copy.helpSending : isReported ? reviewStatusLabel(reportKey, reportedItemStatusByKey, copy) : copy.reviewReply}
                        </button>
                        {reply.ownedByMe && (
                          <button
                            type="button"
                            onClick={() => void withdrawReply(featuredPlan, reply)}
                            aria-label={`${copy.withdrawReply}: ${reply.body}`}
                            disabled={withdrawingReplyIds.has(reply.id)}
                            data-testid={`together-withdraw-reply-${reply.id}`}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[15px] border border-[#F3D6B8] bg-[#FFF9F3] px-4 font-body text-[14px] font-bold text-[#8A4B16] disabled:cursor-default disabled:opacity-60"
                          >
                            <X size={15} aria-hidden="true" />
                            {withdrawingReplyIds.has(reply.id) ? copy.helpSending : copy.withdrawReply}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {planCollaborationActions.map((action) => {
                const selected = (featuredPlan.myHelperActions ?? []).includes(action);
                const actionLabel = copy.planSupportActions[action];
                const bodyLabel = selected ? copy.planSupportRemovePrivate : copy.planSupportReplies[action];
                const buttonLabel = selected ? copy.planSupportRemoveAction(actionLabel) : actionLabel;
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => void sendPlanCollaboration(action)}
                    disabled={replyingPlanKey === featuredPlan.key}
                    aria-pressed={selected}
                    data-testid={`together-plan-collaboration-${action}`}
                    aria-label={`${buttonLabel}: ${bodyLabel}`}
                    className={`min-h-[82px] rounded-[17px] border px-3 py-3 text-left font-body font-bold disabled:opacity-55 ${
                      selected
                        ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                        : "border-[#CFECE3] bg-white text-[#0F766E]"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[16px] leading-tight">
                      {selected && <Check size={17} aria-hidden="true" />}
                      {buttonLabel}
                    </span>
                    <span className="sr-only">{bodyLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        </section>

        <section
          className="rounded-[22px] border border-[#D8E7E2] bg-white px-4 py-4 shadow-[0_12px_24px_rgba(33,23,41,0.05)]"
          data-testid="together-more-options"
        >
          <button
            type="button"
            onClick={() => setShowRoomDetails((current) => !current)}
            aria-expanded={showRoomDetails}
            data-testid="together-more-options-toggle"
            className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[18px] bg-[#F4FBF8] px-4 text-left font-body text-[18px] font-bold text-[#244D47]"
          >
            <span className="min-w-0">
              <span className="block">{showRoomDetails ? simpleCopy.hideOptions : simpleCopy.moreOptions}</span>
              <span className="sr-only">
                {simpleCopy.moreOptionsBody}
              </span>
            </span>
            <Sparkles size={21} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
          </button>
        </section>

        <div className={showRoomDetails ? "grid gap-4" : "hidden"} data-testid="together-room-detail-sections">
        <section className="rounded-[28px] border border-[#DBE7F6] bg-white px-5 py-5 shadow-[0_16px_32px_rgba(30,64,175,0.06)]" data-testid="together-room-choice">
          <div className="flex items-center gap-2">
            <Vote size={22} className="text-[#2563EB]" aria-hidden="true" />
            <p className="font-body text-[17px] font-bold text-[#2563EB]">{copy.roomChoice}</p>
          </div>
          <h2 className="mt-2 font-display text-[26px] leading-[1.08] text-[#2F2135]">{pulse.activePoll.question}</h2>
          {pollClosed && (
            <p className="mt-2 rounded-[16px] bg-[#F3F7FB] px-4 py-3 font-body text-[16px] font-bold text-[#53677D]">
              {copy.pollClosed}
            </p>
          )}

          <div className="mt-4 grid gap-2">
            {pulse.activePoll.options.map((option) => {
              const selected = pulse.activePoll.myVote === option.id;
              const percent = pulse.activePoll.totalVotes > 0 ? Math.round((option.votes / pulse.activePoll.totalVotes) * 100) : 0;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void vote(option.id)}
                  disabled={pollClosed || votingOptionId !== null}
                  aria-pressed={selected}
                  data-testid={`together-vote-${option.id}`}
                  className={`relative min-h-[58px] overflow-hidden rounded-[18px] border px-4 text-left font-body text-[18px] font-bold disabled:cursor-not-allowed disabled:opacity-70 ${
                    selected ? "border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]" : "border-[#E1E9F5] bg-[#FAFCFF] text-[#3E526A]"
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-[#DBEAFE]"
                    style={{ width: `${percent}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <span className="min-w-0 leading-tight">{option.label}</span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[17px] leading-none">{percent}%</span>
                      <span className="mt-1 block text-[13px] leading-tight text-current opacity-80">
                        {selected ? copy.pollYourChoice : copy.pollVotes(option.votes)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!pulse.activePoll.myVote && !pollClosed && (
            <button
              type="button"
              onClick={() => void pauseVoteForNow()}
              disabled={votingOptionId !== null}
              aria-pressed={isQuietPaused}
              data-testid="together-pass-vote"
              className={`mt-3 grid min-h-[58px] w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[18px] border px-4 py-3 text-left font-body font-bold disabled:cursor-default disabled:opacity-65 ${
                isQuietPaused
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]"
                  : "border-[#DBE7F6] bg-white text-[#1E3A8A]"
              }`}
            >
              <Pause size={18} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[17px] leading-tight">{copy.pollPassChoice}</span>
                <span className="sr-only">{copy.pollPassBody}</span>
              </span>
            </button>
          )}
          {pulse.activePoll.myVote && !pollClosed && (
            <button
              type="button"
              onClick={() => void vote(null)}
              disabled={votingOptionId !== null}
              data-testid="together-clear-vote"
              className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#DBE7F6] bg-white px-4 font-body text-[17px] font-bold text-[#1E3A8A] disabled:cursor-default disabled:opacity-65"
            >
              <X size={18} aria-hidden="true" />
              {copy.clearVoteChoice}
            </button>
          )}

          <VoteImpactPanel
            copy={copy}
            pulse={pulse}
            leadingPollOption={leadingPollOption}
            tiedPollLabels={tiedPollLabels}
            topComfortLabels={topComfortLabels}
          />
          <RoomVoteSignalCue copy={copy} poll={pulse.activePoll} />

          <div className="mt-3 rounded-[18px] border border-[#DBEAFE] bg-[#FAFCFF] px-4 py-3" data-testid="together-vote-privacy-note">
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-body text-[16px] font-bold text-[#1E3A8A]">{copy.pollPrivacyTitle}</p>
                <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#3E526A]">{copy.pollPrivacyBody}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[18px] bg-[#EEF6FF] px-4 py-3" data-testid="together-poll-next-step">
            <p className="font-body text-[17px] font-bold leading-[1.3] text-[#1E3A8A]">
              {tiedPollLabels.length > 1
                ? copy.pollNudgeTie(tiedPollLabels)
                : leadingPollOption
                  ? copy.pollNudgeLeading(leadingPollOption.label)
                  : copy.pollNudgeNoVotes}
            </p>
            <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#3E526A]">
              {copy.pollNudgeAction}
            </p>
            <button
              type="button"
              onClick={() => openQuestionComposer(copy.askPromptDrafts.vote)}
              disabled={isSending}
              data-testid="together-suggest-vote"
              aria-label={`${copy.askPromptLabels.vote}: ${copy.askPromptDrafts.vote}`}
              className="mt-3 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#BFDBFE] bg-white px-4 font-body text-[16px] font-bold text-[#1E40AF] disabled:cursor-default disabled:opacity-60"
            >
              <Vote size={18} aria-hidden="true" />
              {copy.askPromptLabels.vote}
            </button>
          </div>

          {showVoteReadyBridge && voteReadyQuestion && (
            <VoteReadyBridge
              copy={copy}
              question={voteReadyQuestion}
              notification={voteReadyNotification}
              disabled={isSending}
              onAsk={() => startIssueVoteQuestion(voteReadyQuestion)}
            />
          )}

          <IssueVoteShortcutPanel
            copy={copy}
            disabled={isSending}
            onStart={startIssuePromptQuestion}
          />

          <IssueVoteQueue
            copy={copy}
            questions={issueQuestionPosts}
            issuePolls={pulse.issuePolls}
            disabled={isSending}
            onRespond={(question, response) => void respondToPlan(response, question.key, copy.sharedResponseSaved)}
            onIssueVote={(pollKey, optionId) => void voteIssuePoll(pollKey, optionId)}
            onIssuePass={() => void pauseForNow()}
            onShapeVote={startIssueVoteQuestion}
            onReview={(question) => void sendSharedItemReport(question)}
            isQuietPaused={isQuietPaused}
            isResponding={(question) => respondingPlanKeys.has(question.key)}
            isVotingPoll={(pollKey) => votingOptionId?.startsWith(`${pollKey}:`) ?? false}
            isReviewingItem={(question) => reportingItemIds.has(`plan:${question.key}`)}
            isReviewedItem={(question) => reportedItemIds.has(`plan:${question.key}`)}
            reviewStatusForItem={(question) => reviewStatusLabel(`plan:${question.key}`, reportedItemStatusByKey, copy)}
          />
        </section>

        <section className="rounded-[28px] border border-[#CFECE3] bg-white px-5 py-5 shadow-[0_16px_32px_rgba(15,118,110,0.06)]" data-testid="together-comfort-check">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#EAF8F4] text-[#0F766E]">
              <HeartHandshake size={23} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[26px] leading-[1.08] text-[#2F2135]">{pulse.comfortCheck.title}</h2>
              <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#41655F]">{pulse.comfortCheck.body}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {pulse.comfortCheck.options.map((option) => {
              const selected = pulse.comfortCheck.myComfortNeeds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void saveComfortCheck(option.id)}
                  disabled={isSavingComfortCheck}
                  aria-pressed={selected}
                  data-testid={`together-comfort-check-${option.id}`}
                  className={`min-h-[64px] rounded-[18px] border px-3 text-left font-body text-[16px] font-bold ${
                    selected
                      ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                      : "border-[#D8E7E2] bg-[#F9FCFA] text-[#315C55]"
                  } disabled:opacity-60`}
                >
                  <span className="flex items-center gap-2">
                    {selected && <Check size={18} aria-hidden="true" />}
                    <span>{option.label}</span>
                  </span>
                  <span className="mt-1 block text-[13px] text-[#55706B]">{copy.comfortCheckCount(option.count)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-[18px] border border-[#CFECE3] bg-[#F9FCFA] px-4 py-3" data-testid="together-comfort-privacy-note">
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.comfortPrivacyTitle}</p>
                <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{copy.comfortPrivacyBody}</p>
              </div>
            </div>
          </div>

          {joiningSupportCue && (
            <JoiningSupportCue
              cue={joiningSupportCue}
              disabled={isSending}
              onAsk={() => openQuestionComposer(joiningSupportCue.draft)}
            />
          )}

          <div className="mt-4 rounded-[18px] bg-[#F4FBF8] px-4 py-3" data-testid="together-room-direction">
            <p className="font-body text-[16px] font-bold text-[#0F766E]">{copy.roomDirectionTitle}</p>
            <p className="mt-1 font-body text-[17px] font-bold leading-[1.35] text-[#315C55]">
              {tiedPollLabels.length > 1
                ? copy.roomDirectionTie(tiedPollLabels, topComfortLabels)
                : leadingPollOption || topComfortLabels.length
                  ? copy.roomDirectionBody(leadingPollOption?.label ?? null, topComfortLabels)
                : copy.roomDirectionWaiting}
            </p>
            <RoomDecisionSummary
              copy={copy}
              leadingPollOption={leadingPollOption}
              tiedPollLabels={tiedPollLabels}
              topComfortLabels={topComfortLabels}
              planInterestCount={planInterestCount}
              sharedViewCount={sharedViewPosts.length}
            />
            <RoomCommonGroundCue
              copy={copy}
              topComfortLabels={topComfortLabels}
              planInterestCount={planInterestCount}
              sharedViewCount={sharedViewPosts.length}
            />
            <RoomOutcomeBridge
              copy={copy}
              leadingPollOption={leadingPollOption}
              tiedPollLabels={tiedPollLabels}
              topComfortLabels={topComfortLabels}
            />
            <DecisionGuide
              guide={decisionGuide}
              onStart={startRoomDirectionPlan}
              recapLabel={hasRoomSignals ? copy.roomRecapAction : undefined}
              onRecap={hasRoomSignals ? startRoomRecapQuestion : undefined}
            />
            <RoomReadinessChecklist
              copy={copy}
              leadingPollOption={leadingPollOption}
              topComfortLabels={topComfortLabels}
            />
            <RoomUsefulNextSteps
              copy={copy}
              activityReadyPlan={activityReadyPlan}
              voteReadyQuestion={voteReadyQuestion}
              sharedViewCount={sharedViewPosts.length}
              disabled={isSending}
              onPrepareActivity={startActivityReadyQuestion}
              onMakeVote={(question) => startIssueVoteQuestion(question)}
              onRecapViews={startViewRecapQuestion}
              onHelpActivity={() => scrollToRoomSection("together-featured-plan")}
              onSuggestVote={() => openQuestionComposer(copy.askPromptDrafts.vote)}
              onShareView={() => openViewComposer()}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-[#E7DDF4] bg-white px-5 py-5 shadow-[0_16px_32px_rgba(109,40,217,0.06)]">
          <h2 className="font-display text-[28px] leading-[1.08] text-[#2F2135]">{pulse.discussionPrompt.title}</h2>
          {pulse.discussionPrompt.body && (
            <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#62556B]">{pulse.discussionPrompt.body}</p>
          )}

          {dailyQuestion && (
            <DailyQuestionCard
              question={dailyQuestion}
              disabled={isSending}
              onAnswer={() => openViewComposer(dailyQuestion.draft)}
            />
          )}

          <div className="mt-4 grid gap-3">
            {starterActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleStarter(action.id, action.label)}
                  disabled={isSending}
                  data-testid={`together-starter-${action.id}`}
                  className="flex min-h-[62px] items-center gap-3 rounded-[20px] border border-[#E8DEF8] bg-[#FBF8FF] px-4 text-left font-body text-[19px] font-bold text-[#4B2E6E] disabled:cursor-default disabled:opacity-60"
                >
                  <Icon size={22} aria-hidden="true" />
                  {action.label}
                </button>
              );
            })}
          </div>
          <p
            className="mt-3 rounded-[18px] bg-[#F8F5FF] px-4 py-3 font-body text-[16px] font-bold leading-[1.35] text-[#655172]"
            data-testid="together-view-sharing-note"
          >
            {copy.viewSharingNote}
          </p>

          {showViewCircle && (
            <ViewCircle
              copy={copy}
              viewVoteOption={viewVoteOption}
              sharedViews={sharedViewPosts}
              onAddView={() => openViewComposer()}
              onStartViewDraft={(draft) => openViewComposer(draft)}
              onAskViewRecap={startViewRecapQuestion}
              onAskViewVote={startViewVoteQuestion}
              onReviewView={(view) => void sendSharedItemReport(view)}
              onReplyToView={(view, tone) => void sendGentleReply(view, tone)}
              isReviewingView={(view) => reportingItemIds.has(`plan:${view.key}`)}
              isReviewedView={(view) => reportedItemIds.has(`plan:${view.key}`)}
              reviewStatusForView={(view) => reviewStatusLabel(`plan:${view.key}`, reportedItemStatusByKey, copy)}
              isReplyingView={(view) => replyingPlanKey === view.key}
              disabled={isSending}
            />
          )}

          {showProposalComposer && (
            <form
              className="mt-4 rounded-[22px] border border-[#E7DDF4] bg-[#FFFDFC] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitProposal(
                  proposalDraft,
                  proposalDraft,
                  proposalKind === "plan" ? proposalLocationLabel : "online",
                  proposalKind,
                  proposalKind === "plan" ? selectedComfortNeeds : [],
                  proposalKind === "plan" ? proposalCategory : "other",
                  proposalKind === "plan" ? proposalPreferredTime : "flexible",
                  proposalKind === "plan" ? proposalCostRange : "discuss",
                  proposalGroupSize,
                );
              }}
            >
              {proposalKind === "plan" && (
                <ChoiceButtonGroup
                  label={copy.proposalCategoryPrompt}
                  options={experienceCategoryOptions}
                  selectedValue={proposalCategory}
                  onChange={setProposalCategory}
                  getLabel={(value) => copy.categoryLabels[value]}
                  testIdPrefix="together-proposal-category"
                />
              )}
              {proposalKind === "plan" && (
                <div className="mb-3">
                  <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{copy.proposalPlacePrompt}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={copy.proposalPlacePrompt}>
                    {([
                      ["nearby", copy.planNearby],
                      ["online", copy.planOnline],
                    ] as const).map(([value, label]) => {
                      const selected = proposalLocationLabel === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setProposalLocationLabel(value)}
                          aria-pressed={selected}
                          data-testid={`together-proposal-location-${value}`}
                          className={`min-h-[52px] rounded-[16px] border px-3 font-body text-[17px] font-bold ${
                            selected
                              ? "border-[#6D28D9] bg-[#F3ECFF] text-[#4B2E6E]"
                              : "border-[#E7DDF4] bg-white text-[#655172]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {proposalKind === "plan" && (
                <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
                  <ChoiceButtonGroup
                    label={copy.proposalTimePrompt}
                    options={preferredTimeOptions}
                    selectedValue={proposalPreferredTime}
                    onChange={setProposalPreferredTime}
                    getLabel={(value) => copy.timeLabels[value]}
                    testIdPrefix="together-proposal-time"
                    compact
                  />
                  <ChoiceButtonGroup
                    label={copy.proposalCostPrompt}
                    options={costRangeOptions}
                    selectedValue={proposalCostRange}
                    onChange={setProposalCostRange}
                    getLabel={(value) => copy.costLabels[value]}
                    testIdPrefix="together-proposal-cost"
                    compact
                  />
                </div>
              )}
              {proposalKind === "plan" && (
                <ChoiceButtonGroup
                  label={copy.proposalGroupPrompt}
                  options={groupSizeOptions}
                  selectedValue={proposalGroupSize}
                  onChange={setProposalGroupSize}
                  getLabel={(value) => copy.groupLabels[value]}
                  testIdPrefix="together-proposal-group"
                  compact
                />
              )}
              {proposalKind === "plan" && (
                <div className="mb-3">
                  <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{copy.comfortPrompt}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-label={copy.comfortPrompt}>
                    {comfortNeedOptions.map((need) => {
                      const selected = selectedComfortNeeds.includes(need);
                      return (
                        <button
                          key={need}
                          type="button"
                          onClick={() => toggleComfortNeed(need)}
                          aria-pressed={selected}
                          data-testid={`together-comfort-${need}`}
                          className={`min-h-[48px] rounded-[16px] border px-3 font-body text-[16px] font-bold ${
                            selected
                              ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                              : "border-[#E7DDF4] bg-white text-[#655172]"
                          }`}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            {selected && <Check size={17} aria-hidden="true" />}
                            {copy.comfortNeedLabels[need]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {proposalKind === "message" && (
                <div
                  className="mb-3 rounded-[18px] border border-[#D7E8DB] bg-[#F4FBF8] px-3 py-3"
                  data-testid="together-view-starters"
                >
                  <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.viewPromptTitle}</p>
                  <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.viewPromptBody}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label={copy.viewPromptTitle}>
                    {viewPromptActions.map((action) => {
                      const draft = copy.viewPromptDrafts[action];
                      const selected = proposalDraft === draft;
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => setProposalDraft(draft)}
                          aria-pressed={selected}
                          aria-label={`${copy.viewPromptLabels[action]}: ${draft}`}
                          data-testid={`together-view-prompt-${action}`}
                          className={`min-h-[78px] rounded-[16px] border px-3 py-2 text-left font-body ${
                            selected
                              ? "border-[#0F766E] bg-white text-[#244D47]"
                              : "border-[#D7E8DB] bg-[#FBFFFD] text-[#41655F]"
                          }`}
                        >
                          <span className="block text-[15px] font-bold leading-tight">{copy.viewPromptLabels[action]}</span>
                          <span className="mt-1 block text-[13px] font-bold leading-[1.25] text-[#55706B]">{draft}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {proposalKind === "message" && (
                <ViewTonePreview
                  copy={copy}
                  hasProtectedDetails={proposalHasProtectedDetails}
                  hasUnkindTone={proposalHasUnkindTone}
                />
              )}
              {proposalKind === "question" && (
                <div
                  className="mb-3 rounded-[18px] border border-[#D7E8DB] bg-[#F4FBF8] px-3 py-3"
                  data-testid="together-ask-starters"
                >
                  <p className="font-body text-[16px] font-bold text-[#244D47]">{copy.askPromptTitle}</p>
                  <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.askPromptBody}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label={copy.askPromptTitle}>
                    {askPromptActions.map((action) => {
                      const draft = copy.askPromptDrafts[action];
                      const selected = proposalDraft === draft;
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => setProposalDraft(draft)}
                          aria-pressed={selected}
                          aria-label={`${copy.askPromptLabels[action]}: ${draft}`}
                          data-testid={`together-ask-prompt-${action}`}
                          className={`min-h-[78px] rounded-[16px] border px-3 py-2 text-left font-body ${
                            selected
                              ? "border-[#0F766E] bg-white text-[#244D47]"
                              : "border-[#D7E8DB] bg-[#FBFFFD] text-[#41655F]"
                          }`}
                        >
                          <span className="block text-[15px] font-bold leading-tight">{copy.askPromptLabels[action]}</span>
                          <span className="mt-1 block text-[13px] font-bold leading-[1.25] text-[#55706B]">{draft}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 rounded-[16px] border border-[#D7E8DB] bg-white px-3 py-3" data-testid="together-issue-prompts">
                    <p className="font-body text-[15px] font-bold text-[#244D47]">{copy.issuePromptTitle}</p>
                    <p className="mt-1 font-body text-[13px] font-bold leading-[1.3] text-[#55706B]">{copy.issuePromptBody}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label={copy.issuePromptTitle}>
                      {issuePromptActions.map((action) => {
                        const draft = copy.issuePromptDrafts[action];
                        const selected = proposalDraft === draft;
                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => setProposalDraft(draft)}
                            aria-pressed={selected}
                            aria-label={`${copy.issuePromptLabels[action]}: ${draft}`}
                            data-testid={`together-issue-prompt-${action}`}
                            className={`min-h-[64px] rounded-[15px] border px-3 py-2 text-left font-body ${
                              selected
                                ? "border-[#0F766E] bg-[#F4FBF8] text-[#244D47]"
                                : "border-[#D7E8DB] bg-[#FBFFFD] text-[#41655F]"
                            }`}
                          >
                            <span className="block text-[15px] font-bold leading-tight">{copy.issuePromptLabels[action]}</span>
                            <span className="mt-1 block text-[13px] font-bold leading-[1.25] text-[#55706B]">{draft}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <ComposerSafetyPreview copy={copy} kind={proposalKind} />
              <SafeShareCue copy={copy} />
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="min-w-0">
                  <textarea
                    ref={proposalDraftRef}
                    value={proposalDraft}
                    onChange={(event) => setProposalDraft(limitProposalDraft(event.target.value))}
                    placeholder={copy.proposalPlaceholder}
                    rows={proposalKind === "question" ? 6 : proposalKind === "message" ? 3 : 2}
                    maxLength={proposalDetailsMaxLength}
                    aria-describedby={proposalDescriptionIds}
                    data-testid="together-proposal-draft"
                    className={`w-full min-w-0 flex-1 resize-none rounded-[17px] bg-white px-4 py-3 font-body text-[18px] leading-snug text-[#2F2135] outline-none placeholder:text-[#8A7A96] ${
                      proposalKind === "question" ? "min-h-[196px]" : proposalKind === "message" ? "min-h-[112px]" : "min-h-[64px]"
                    }`}
                  />
                  {proposalHasProtectedDetails && (
                    <p
                      id="together-proposal-safety-warning"
                      data-testid="together-proposal-safety-warning"
                      className="mt-2 rounded-[14px] border border-[#F1C7C7] bg-[#FFF6F6] px-3 py-2 font-body text-[15px] font-bold leading-snug text-[#8A2F2F]"
                    >
                      {copy.proposalSafetyWarning}
                    </p>
                  )}
                  {proposalHasUnkindTone && (
                    <div
                      id="together-proposal-tone-warning"
                      data-testid="together-proposal-tone-warning"
                      className="mt-2 rounded-[14px] border border-[#F2D59B] bg-[#FFF9E8] px-3 py-2 font-body text-[15px] font-bold leading-snug text-[#7C4A03]"
                    >
                      <p>{copy.proposalToneWarning}</p>
                      <button
                        type="button"
                        onClick={softenProposalTone}
                        className="mt-2 min-h-[44px] rounded-[14px] bg-[#7C4A03] px-4 py-2 text-[15px] font-bold text-white shadow-[0_8px_18px_rgba(124,74,3,0.18)]"
                        data-testid="together-proposal-soften-tone"
                      >
                        {copy.proposalToneRewrite}
                      </button>
                    </div>
                  )}
                  <p
                    id="together-proposal-length"
                    data-testid="together-proposal-length"
                    className="mt-1 font-body text-[14px] leading-snug text-[#756680]"
                  >
                    {copy.proposalLengthHint(proposalCharactersLeft)}
                  </p>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_64px] gap-2 sm:grid-cols-[112px_64px]">
                  <button
                    type="button"
                    onClick={cancelProposalComposer}
                    data-testid="together-cancel-proposal"
                    className="inline-flex min-h-[64px] items-center justify-center gap-2 rounded-[17px] border border-[#E7DDF4] bg-white px-3 font-body text-[17px] font-bold text-[#655172]"
                  >
                    <X size={20} aria-hidden="true" />
                    {copy.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSending || !proposalDraft.trim() || proposalHasProtectedDetails || proposalHasUnkindTone}
                    className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[17px] bg-[#6D28D9] text-white disabled:opacity-45"
                    aria-label={isSending ? copy.sending : copy.send}
                  >
                    <Send size={23} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </form>
          )}

          {postedExperiences.length > 0 && (
            <div className="mt-5 rounded-[24px] bg-[#F8F5FF] px-4 py-4" data-testid="together-shared-today">
              <h3 className="font-body text-[19px] font-bold text-[#4B2E6E]">{copy.sharedToday}</h3>
              <div className="mt-3 grid gap-3">
                {postedExperiences.map((plan) => {
                  const visibleReplies = activePlanReplies(plan);
                  return (
                  <article key={plan.key} className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_18px_rgba(75,46,110,0.08)]">
                    <p className="font-body text-[14px] font-bold leading-[1.2] text-[#6D4B8F]">
                      {sharedKindLabelForPlan(plan, copy)}
                    </p>
                    <p className="mt-1 font-body text-[19px] font-bold leading-tight text-[#2F2135]">{plan.title}</p>
                    {plan.body && (
                      <p className="mt-1 font-body text-[16px] leading-[1.35] text-[#66556E]">{plan.body}</p>
                    )}
                    <PlanExperiencePills plan={plan} copy={copy} />
                    <PlanReviewNotice plan={plan} copy={copy} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(plan.kind ?? "plan") === "plan" && <PlanLocationPill plan={plan} copy={copy} />}
                      <p
                        className="inline-flex items-center gap-2 rounded-full bg-[#F4FBF8] px-3 py-1.5 font-body text-[14px] font-bold text-[#315C55]"
                        data-testid={`together-shared-response-summary-${plan.key}`}
                      >
                        <Users size={15} aria-hidden="true" />
                        {formatResponseSummary(plan, copy)}
                      </p>
                    </div>
                    {(plan.kind ?? "plan") === "plan" && <PlanComfortPills plan={plan} copy={copy} />}
                    {(plan.kind ?? "plan") === "plan" && (
                      <div
                        className="mt-3 rounded-[18px] border border-[#CFECE3] bg-[#F7FCFA] px-3 py-3"
                        data-testid={`together-shared-plan-collaboration-${plan.key}`}
                      >
                        <div className="flex items-start gap-2">
                          <HeartHandshake size={17} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-body text-[15px] font-bold text-[#315C55]">{copy.planSupportTitle}</p>
                            <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.planSupportBody}</p>
                          </div>
                        </div>
                        <PlanSupportSummary
                          copy={copy}
                          plan={plan}
                          testId={`together-shared-plan-helper-summary-${plan.key}`}
                          itemTestIdPrefix={`together-shared-plan-helper-${plan.key}`}
                        />
                        <PlanHelperCue
                          copy={copy}
                          plan={plan}
                          onChoose={(action) => void sendPlanCollaboration(action, plan)}
                          disabled={replyingPlanKey === plan.key}
                          testId={`together-shared-plan-helper-cue-${plan.key}`}
                        />
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {planCollaborationActions.map((action) => {
                            const selected = (plan.myHelperActions ?? []).includes(action);
                            const actionLabel = copy.planSupportActions[action];
                            const bodyLabel = selected ? copy.planSupportRemovePrivate : copy.planSupportReplies[action];
                            const buttonLabel = selected ? copy.planSupportRemoveAction(actionLabel) : actionLabel;
                            return (
                              <button
                                key={action}
                                type="button"
                                onClick={() => void sendPlanCollaboration(action, plan)}
                                disabled={replyingPlanKey === plan.key}
                                aria-pressed={selected}
                                data-testid={`together-shared-plan-collaboration-${action}-${plan.key}`}
                                aria-label={`${buttonLabel}: ${bodyLabel}`}
                                className={`min-h-[82px] rounded-[16px] border px-3 py-3 text-left font-body font-bold disabled:opacity-55 ${
                                  selected
                                    ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                                    : "border-[#CFECE3] bg-white text-[#0F766E]"
                                }`}
                              >
                                <span className="flex items-center gap-2 text-[15px] leading-tight">
                                  {selected && <Check size={16} aria-hidden="true" />}
                                  {buttonLabel}
                                </span>
                                <span className="sr-only">{bodyLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {shouldShowSharedPlanReadiness(plan) && (
                      <PlanReadinessBridge
                        copy={copy}
                        plan={plan}
                        onAsk={() => startActivityReadyQuestion(plan)}
                        testId={`together-shared-plan-readiness-${plan.key}`}
                        itemTestIdPrefix={`together-shared-plan-readiness-${plan.key}`}
                      />
                    )}
                    <div className="mt-3 rounded-[18px] bg-[#F7FAF7] px-3 py-3" data-testid={`together-gentle-replies-${plan.key}`}>
                      <div className="flex items-center gap-2">
                        <MessageCircle size={17} className="text-[#0F766E]" aria-hidden="true" />
                        <p className="font-body text-[15px] font-bold text-[#315C55]">{copy.gentleReplies}</p>
                      </div>
                      <div className="mt-2 rounded-[15px] bg-white px-3 py-2" data-testid={`together-reply-guide-${plan.key}`}>
                        <p className="font-body text-[14px] font-bold text-[#315C55]">{copy.replyGuideTitle}</p>
                        <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#55706B]">{copy.replyGuideBody}</p>
                      </div>
                      {visibleReplies.length > 0 && (
                        <div className="mt-2 grid gap-2">
                          {visibleReplies.map((reply) => {
                            const reportKey = `reply:${reply.id}`;
                            const isReporting = reportingItemIds.has(reportKey);
                            const isReported = reportedItemIds.has(reportKey);
                            return (
                              <article
                                key={reply.id}
                                className="rounded-[15px] bg-white px-3 py-2 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]"
                                data-testid={`together-reply-${reply.id}`}
                              >
                                <p>{reply.body}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void sendReplyReport(plan, reply)}
                                    disabled={isReporting || isReported}
                                    data-testid={`together-review-reply-${reply.id}`}
                                    className="min-h-[44px] rounded-[15px] border border-[#CFECE3] bg-[#F7FAF7] px-4 font-body text-[14px] font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
                                  >
                                    {isReporting ? copy.helpSending : isReported ? reviewStatusLabel(reportKey, reportedItemStatusByKey, copy) : copy.reviewReply}
                                  </button>
                                  {reply.ownedByMe && (
                                    <button
                                      type="button"
                                      onClick={() => void withdrawReply(plan, reply)}
                                      aria-label={`${copy.withdrawReply}: ${reply.body}`}
                                      disabled={withdrawingReplyIds.has(reply.id)}
                                      data-testid={`together-withdraw-reply-${reply.id}`}
                                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[15px] border border-[#F3D6B8] bg-[#FFF9F3] px-4 font-body text-[14px] font-bold text-[#8A4B16] disabled:cursor-default disabled:opacity-60"
                                    >
                                      <X size={15} aria-hidden="true" />
                                      {withdrawingReplyIds.has(reply.id) ? copy.helpSending : copy.withdrawReply}
                                    </button>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(["support", "curious", "help", "different"] as const).map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => void sendGentleReply(plan, tone)}
                            disabled={replyingPlanKey === plan.key}
                            data-testid={`together-reply-${tone}-${plan.key}`}
                            aria-label={`${copy.replyActions[tone]}: ${copy.replyBodies[tone]}`}
                            className="min-h-[88px] rounded-[16px] border border-[#CFECE3] bg-white px-3 py-3 text-left font-body font-bold text-[#0F766E] disabled:opacity-55"
                          >
                            <span className="block text-[15px] leading-tight">{copy.replyActions[tone]}</span>
                            <span className="sr-only">{copy.replyBodies[tone]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void respondToPlan("join", plan.key, copy.sharedResponseSaved)}
                        disabled={respondingPlanKeys.has(plan.key)}
                        aria-pressed={plan.myResponse === "join"}
                        className={`min-h-[52px] rounded-[17px] px-3 font-body text-[16px] font-bold disabled:cursor-default disabled:opacity-65 ${
                          plan.myResponse === "join"
                            ? "bg-[#0F766E] text-white"
                            : "bg-[#EAF8F4] text-[#0F766E]"
                        }`}
                      >
                        {copy.sharedActions[plan.kind ?? "plan"].primary}
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondToPlan("maybe", plan.key, copy.sharedResponseSaved)}
                        disabled={respondingPlanKeys.has(plan.key)}
                        aria-pressed={plan.myResponse === "maybe"}
                        className={`min-h-[52px] rounded-[17px] border px-3 font-body text-[16px] font-bold disabled:cursor-default disabled:opacity-65 ${
                          plan.myResponse === "maybe"
                            ? "border-[#0F766E] bg-white text-[#0F766E]"
                            : "border-[#E7DDF4] bg-white text-[#4B2E6E]"
                        }`}
                      >
                        {copy.sharedActions[plan.kind ?? "plan"].secondary}
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendSharedItemReport(plan)}
                        aria-label={`${copy.reviewItem}: ${plan.title}`}
                        disabled={reportingItemIds.has(`plan:${plan.key}`) || reportedItemIds.has(`plan:${plan.key}`)}
                        data-testid={`together-review-item-${plan.key}`}
                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[17px] border border-[#D8E7E2] bg-[#F7FAF7] px-3 font-body text-[15px] font-bold text-[#315C55] disabled:cursor-default disabled:opacity-60"
                      >
                        <ShieldCheck size={17} aria-hidden="true" />
                        {reportingItemIds.has(`plan:${plan.key}`)
                          ? copy.helpSending
                          : reportedItemIds.has(`plan:${plan.key}`)
                            ? reviewStatusLabel(`plan:${plan.key}`, reportedItemStatusByKey, copy)
                            : copy.reviewItem}
                      </button>
                      {plan.ownedByMe && (
                        <button
                          type="button"
                          onClick={() => void withdrawSharedItem(plan)}
                          aria-label={`${copy.withdrawItem}: ${plan.title}`}
                          disabled={withdrawingItemIds.has(plan.key)}
                          data-testid={`together-withdraw-item-${plan.key}`}
                          className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[17px] border border-[#F3D6B8] bg-[#FFF9F3] px-3 font-body text-[15px] font-bold text-[#8A4B16] disabled:cursor-default disabled:opacity-60"
                        >
                          <X size={17} aria-hidden="true" />
                          {withdrawingItemIds.has(plan.key) ? copy.helpSending : copy.withdrawItem}
                        </button>
                      )}
                    </div>
                  </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-[#D8E7E2] bg-white px-5 py-5 shadow-[0_14px_28px_rgba(15,118,110,0.05)]" data-testid="together-support-panels">
          <RoomAtGlance
            copy={copy}
            roomUpdatesCount={unreadRoomUpdateCount}
            totalVotes={roomVoteCount}
            planInterestCount={planInterestCount}
            comfortResponses={pulse.comfortCheck.totalResponses}
          />

          {pulse.activityDigest && (
            <RoomActivityDigestPanel digest={pulse.activityDigest} />
          )}

          <RoomNotesPanel
            copy={copy}
            leadingPollOption={leadingPollOption}
            tiedPollLabels={tiedPollLabels}
            topComfortLabels={topComfortLabels}
            sharedViewCount={sharedViewPosts.length}
            activityReadyPlan={activityReadyPlan}
            voteReadyQuestion={voteReadyQuestion}
            disabled={isSending}
            onPrepareActivity={startActivityReadyQuestion}
            onMakeVote={(question) => startIssueVoteQuestion(
              question,
              (pulse.issuePolls ?? []).find((item) => item.sourcePlanKey === question.key) ?? null,
            )}
            onRecapViews={startViewRecapQuestion}
            onGentleStart={() => scrollToRoomSection("together-participation-path")}
            onCopyNoNameNotes={(notes) => void copyNoNameRoomNotes(notes)}
          />

          <MySafeChoices
            copy={copy}
            pulse={pulse}
            visibility={visibilityPromise}
            disabled={isSending || isSavingComfortCheck}
            isQuietPaused={isQuietPaused}
            onAddComfort={() => scrollToRoomSection("together-comfort-check")}
            onVote={() => scrollToRoomSection("together-room-choice")}
            onChooseActivity={() => scrollToRoomSection("together-featured-plan")}
            onQuietPauseToggle={toggleQuietPause}
            onLeaveQuietly={onBack}
          />

          <PrivateRoomNote
            copy={copy}
            value={privateRoomNoteDraft}
            onChange={setPrivateRoomNoteDraft}
            onSave={savePrivateNote}
            onClear={clearPrivateNote}
          />

          <RoomTrustCue
            copy={copy}
            disabled={isSending}
            onAsk={startRoomTrustQuestion}
            onIntro={startRoomIntroQuestion}
          />

          <ParticipationPathPanel
            copy={copy}
            disabled={isSending}
            onVote={() => scrollToRoomSection("together-room-choice")}
            onView={() => openViewComposer()}
            onActivity={() => {
              if (onOpenActivities) {
                onOpenActivities();
                return;
              }
              scrollToRoomSection("together-featured-plan");
            }}
          />

          {showActivityReadyBridge && activityReadyPlan && (
            <ActivityReadyBridge
              copy={copy}
              plan={activityReadyPlan}
              notification={activityReadyNotification}
              onAsk={() => startActivityReadyQuestion(activityReadyPlan)}
            />
          )}

          <NextGentleStepCue
            copy={copy}
            stepId={nextGentleStepId}
            onAction={handleNextGentleStep}
            onExplain={explainNextGentleStep}
            disabled={isNextGentleStepDisabled}
          />

          <div
            className="mt-3 rounded-[20px] border border-[#CFECE3] bg-[#F7FCFA] px-4 py-3"
            data-testid="together-listen-first-cue"
          >
            <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-body text-[16px] font-bold leading-[1.25] text-[#244D47]">{copy.arrivalComfortTitle}</p>
                <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]">{copy.arrivalComfortBody}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {arrivalComfortShortcuts.map((need) => {
                const selected = pulse.comfortCheck.myComfortNeeds.includes(need);
                const label = need === "listen_first" ? copy.listenFirstAction : copy.comfortNeedLabels[need];
                const savedLabel = need === "listen_first" ? copy.listenFirstSaved : copy.arrivalComfortSaved(label);
                const removedLabel = need === "listen_first" ? copy.listenFirstRemoved : copy.arrivalComfortRemoved(label);
                return (
                  <button
                    key={need}
                    type="button"
                    onClick={() => void saveComfortCheck(need, savedLabel, removedLabel)}
                    disabled={isSavingComfortCheck}
                    aria-pressed={selected}
                    data-testid={need === "listen_first" ? "together-listen-first" : `together-arrival-comfort-${need}`}
                    className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] px-4 font-body text-[16px] font-bold ${
                      selected
                        ? "border border-[#0F766E] bg-white text-[#0F766E]"
                        : "bg-[#0F766E] text-white shadow-[0_10px_18px_rgba(15,118,110,0.14)]"
                    } disabled:cursor-default disabled:opacity-90`}
                  >
                    {selected ? <Check size={18} aria-hidden="true" /> : <HeartHandshake size={18} aria-hidden="true" />}
                    {selected ? savedLabel : label}
                  </button>
                );
              })}
            </div>
          </div>

          {!agreementAcknowledged && (
            <div className="mt-5 border-t border-[#D8E7E2] pt-4" data-testid="together-room-promise">
              <div className="flex items-center gap-2">
                <ShieldCheck size={21} className="text-[#0F766E]" aria-hidden="true" />
                <h2 className="font-body text-[20px] font-bold text-[#244D47]">{agreementTitle}</h2>
              </div>
              <ul className="mt-3 grid gap-2">
                {agreementLines.map((line) => (
                  <li key={line} className="flex items-start gap-2 font-body text-[16px] font-bold leading-[1.32] text-[#41655F]">
                    <Check size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void acknowledgeAgreement()}
                disabled={isAcknowledgingAgreement}
                data-testid="together-acknowledge-agreement"
                className="mt-4 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#0F766E] px-4 font-body text-[18px] font-bold text-white shadow-[0_12px_22px_rgba(15,118,110,0.16)] disabled:cursor-default disabled:opacity-70 sm:w-auto"
              >
                {agreementButtonLabel}
              </button>
            </div>
          )}
        </section>

        {roomUpdates.length > 0 && (
          <section className="rounded-[26px] border border-[#D7E8DB] bg-white px-5 py-5 shadow-[0_14px_28px_rgba(15,118,110,0.06)]" data-testid="together-room-updates">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Bell size={21} className="text-[#0F766E]" aria-hidden="true" />
                <h2 className="font-body text-[20px] font-bold text-[#244D47]">{copy.roomUpdates}</h2>
              </div>
              {unreadRoomUpdateCount > 1 && (
                <button
                  type="button"
                  onClick={() => void markAllUpdatesSeen()}
                  disabled={isMarkingAllUpdatesSeen || markingUpdateId !== null}
                  data-testid="together-updates-seen-all"
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#CFECE3] bg-[#F7FAF7] px-4 font-body text-[16px] font-bold text-[#0F766E] disabled:opacity-55 sm:w-auto"
                >
                  <Check size={17} aria-hidden="true" />
                  {copy.markAllUpdatesSeen}
                </button>
              )}
            </div>
            {unreadRoomUpdateCount > roomUpdates.length && (
              <p
                className="mt-2 font-body text-[15px] font-bold leading-[1.35] text-[#55706B]"
                data-testid="together-room-updates-showing"
              >
                {copy.roomUpdatesShowing(roomUpdates.length, unreadRoomUpdateCount)}
              </p>
            )}
            <div
              className="mt-3 rounded-[18px] border border-[#CFECE3] bg-[#F4FBF8] px-4 py-3"
              data-testid="together-room-updates-recap"
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-body text-[16px] font-bold leading-[1.25] text-[#244D47]">{copy.roomUpdatesRecapTitle}</p>
                    <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#41655F]">
                      {copy.roomUpdatesRecapBody(roomUpdateRecapCount)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startRoomUpdatesRecapQuestion}
                  disabled={isSending}
                  data-testid="together-room-updates-recap-action"
                  className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#0F766E] px-4 font-body text-[15px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.12)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
                >
                  <MessageCircle size={17} aria-hidden="true" />
                  {copy.roomUpdatesRecapAction}
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {roomUpdates.map((notification) => {
                const updateAction = roomUpdateActionFor(notification);
                const UpdateActionIcon = updateAction?.icon;
                return (
                  <article key={notification.id} className="rounded-[18px] bg-[#F4FBF8] px-4 py-3">
                    <p className="font-body text-[17px] font-bold leading-[1.25] text-[#244D47]">{notification.title}</p>
                    {notification.body && (
                      <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#55706B]">{notification.body}</p>
                    )}
                    {updateAction?.safetyLabel && (
                      <p
                        className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-body text-[14px] font-bold text-[#315C55]"
                        data-testid={`together-update-action-safety-${notification.id}`}
                      >
                        <ShieldCheck size={15} aria-hidden="true" />
                        {updateAction.safetyLabel}
                      </p>
                    )}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {updateAction && UpdateActionIcon ? (
                        <button
                          type="button"
                          onClick={updateAction.onClick}
                          disabled={isSending}
                          data-testid={updateAction.testId}
                          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#0F766E] px-4 font-body text-[16px] font-bold text-white shadow-[0_10px_18px_rgba(15,118,110,0.12)] disabled:cursor-default disabled:opacity-60 sm:w-auto"
                        >
                          <UpdateActionIcon size={17} aria-hidden="true" />
                          {updateAction.label}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void markUpdateSeen(notification.id)}
                        disabled={markingUpdateId === notification.id || isMarkingAllUpdatesSeen}
                        data-testid={`together-update-seen-${notification.id}`}
                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#CFECE3] bg-white px-4 font-body text-[16px] font-bold text-[#0F766E] disabled:opacity-55 sm:w-auto"
                      >
                        <Check size={17} aria-hidden="true" />
                        {copy.markUpdateSeen}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-[26px] border border-[#CFECE3] bg-[#F4FBF8] px-5 py-5">
          <div className="flex items-start gap-3">
            <LifeBuoy size={24} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-body text-[21px] font-bold text-[#244D47]">{pulse.safety.title}</h2>
              <p className="mt-1 font-body text-[17px] leading-[1.35] text-[#41655F]">{pulse.safety.consentLine}</p>
              <button
                type="button"
                onClick={() => {
                  setSafetyHelpPanelAnchor((current) => current === "footer" ? null : "footer");
                  setStatusMessage("");
                  setLastSafetyHelpChoice(null);
                  setLastSafetyHelpReceiptAnchor(null);
                }}
                disabled={isSendingSafetyReport}
                data-testid="together-safety-help"
                className="mt-3 min-h-[50px] rounded-[18px] border border-[#A9DCCE] bg-white px-4 font-body text-[17px] font-bold text-[#0F766E] disabled:cursor-default disabled:opacity-60"
                aria-expanded={safetyHelpPanelAnchor === "footer"}
              >
                {isSendingSafetyReport ? copy.helpSending : pulse.safety.helpLabel}
              </button>
              {safetyHelpPanelAnchor === "footer" && (
                <SafetyHelpPanel
                  copy={copy}
                  isSending={isSendingSafetyReport}
                  onSend={(choice) => void sendSafetyReport(choice)}
                  onCancel={() => setSafetyHelpPanelAnchor(null)}
                />
              )}
              {safetyHelpPanelAnchor === null && lastSafetyHelpChoice && lastSafetyHelpReceiptAnchor === "footer" && (
                <SafetyHelpReceipt copy={copy} choice={lastSafetyHelpChoice} />
              )}
            </div>
          </div>
        </section>

        {pulse.secondaryPlans.length > 0 && (
          <section className="rounded-[26px] border border-[#ECE3D2] bg-white px-5 py-5">
            <h2 className="font-body text-[19px] font-bold text-[#6B4F13]">{copy.morePlans}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {pulse.secondaryPlans.map((plan) => (
                <div key={plan.key} className="rounded-[20px] bg-[#FFF8E8] px-4 py-3">
                  <p className="font-body text-[18px] font-bold text-[#2F2135]">{plan.title}</p>
                  <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#695D67]">{plan.body}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PlanLocationPill plan={plan} copy={copy} />
                    <p
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-body text-[14px] font-bold text-[#315C55]"
                      data-testid={`together-secondary-response-summary-${plan.key}`}
                    >
                      <Users size={15} aria-hidden="true" />
                      {formatResponseSummary(plan, copy)}
                    </p>
                  </div>
                  <PlanComfortPills plan={plan} copy={copy} />
                  <PlanExperiencePills plan={plan} copy={copy} />
                  <PlanReviewNotice plan={plan} copy={copy} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void respondToPlan("join", plan.key, copy.sharedResponseSaved)}
                      disabled={respondingPlanKeys.has(plan.key)}
                      aria-pressed={plan.myResponse === "join"}
                      data-testid={`together-secondary-join-${plan.key}`}
                      className={`min-h-[52px] rounded-[17px] px-3 font-body text-[16px] font-bold disabled:cursor-default disabled:opacity-65 ${
                        plan.myResponse === "join"
                          ? "bg-[#0F766E] text-white"
                          : "bg-[#EAF8F4] text-[#0F766E]"
                      }`}
                    >
                      {copy.sharedActions[plan.kind ?? "plan"].primary}
                    </button>
                    <button
                      type="button"
                      onClick={() => void respondToPlan("maybe", plan.key, copy.sharedResponseSaved)}
                      disabled={respondingPlanKeys.has(plan.key)}
                      aria-pressed={plan.myResponse === "maybe"}
                      data-testid={`together-secondary-maybe-${plan.key}`}
                      className={`min-h-[52px] rounded-[17px] border px-3 font-body text-[16px] font-bold disabled:cursor-default disabled:opacity-65 ${
                        plan.myResponse === "maybe"
                          ? "border-[#0F766E] bg-white text-[#0F766E]"
                          : "border-[#E7DDF4] bg-white text-[#4B2E6E]"
                      }`}
                    >
                      {copy.sharedActions[plan.kind ?? "plan"].secondary}
                    </button>
                    {plan.myResponse && (
                      <button
                        type="button"
                        onClick={() => void respondToPlan("clear", plan.key, copy.planChoiceCleared)}
                        disabled={respondingPlanKeys.has(plan.key)}
                        data-testid={`together-secondary-clear-${plan.key}`}
                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#D8E7E2] bg-white px-3 font-body text-[15px] font-bold text-[#315C55] disabled:cursor-default disabled:opacity-65"
                      >
                        <X size={16} aria-hidden="true" />
                        {copy.clearPlanChoice}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        </div>

        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="together-status-message"
            className="fixed bottom-[calc(118px+env(safe-area-inset-bottom))] left-5 right-5 z-[90] mx-auto max-w-[520px] rounded-[22px] bg-[#211729] px-5 py-4 text-center font-body text-[18px] font-bold text-white shadow-[0_20px_38px_rgba(33,23,41,0.25)]"
          >
            <span className="block text-[15px] font-bold leading-[1.2] text-[#E7DDF4]">
              {copy.statusLabel}
            </span>
            <span className="mt-1 block leading-[1.25]">{statusMessage}</span>
          </div>
        )}
      </main>
    </div>
  );
}
