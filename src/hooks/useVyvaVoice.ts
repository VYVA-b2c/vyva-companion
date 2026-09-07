import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Conversation } from "@elevenlabs/client";
import type { Conversation as ElevenConversation, DisconnectionDetails, PartialOptions } from "@elevenlabs/client";
import { getToken } from "@/lib/auth";
import { getAgentAppContextVariables, subscribeAgentAppContext } from "@/lib/agentAppContext";
import { apiFetch } from "@/lib/queryClient";
import {
  actionForVoiceToolCall,
  homeIntentForVoiceToolCall,
  homeSubflowForVoiceToolCall,
  emitVoiceAppAction,
  emitVoiceAppActionResult,
  emitVoiceHomeIntent,
  emitVoiceHomeSubflow,
  emitVoiceSpecialistTransfer,
  emitVoiceUserMessage,
  isVoiceAppActionDomain,
  specialistTransferFromToolCall,
  toolResultForVoiceHomeIntent,
  toolResultForVoiceHomeSubflow,
} from "@/lib/voiceNavigation";
import {
  readActiveVoiceCanvasSceneProvenance,
  type VoiceCanvasSceneProvenance,
} from "@/lib/voiceCanvasBridge";
import {
  ensureVoiceSessionId,
  readVoiceSessionId,
  requestDrAiScreenSync,
  VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT,
  type VoiceTriageTouchAnswerDetail,
} from "@/lib/voiceSessionBridge";
import { deriveVoiceSessionPhase, type VoiceSessionPhase } from "@/lib/voiceSessionState";
import { recordVoiceTimelineEvent } from "@/lib/voiceTimeline";
import { dispatchOnboardingElevenLabsOutput } from "@/lib/onboardingElevenLabsRuntimeAdapter";
import { requestNumberMemoryVoiceTool, type NumberMemoryVoiceToolName } from "@/lib/numberMemoryVoiceBridge";
import {
  selectSpeechVoice,
  supportsSpeechPlayback,
  voicePlaybackLocale,
} from "@/lib/voicePlayback";

export type TtsSegment = {
  text: string;
  lang?: string;
  rate?: number;
  delayMs?: number;
};

export type TtsPlaybackStatus = "idle" | "loading" | "playing" | "paused" | "completed" | "unavailable" | "error";

export type TtsPlaybackOptions = {
  startIndex?: number;
  onProgress?: (segmentIndex: number, segmentCount: number) => void;
  onComplete?: () => void;
  onError?: () => void;
};

export function useTtsReadout() {
  const supported = supportsSpeechPlayback();
  const [playbackStatus, setPlaybackStatusState] = useState<TtsPlaybackStatus>(supported ? "idle" : "unavailable");
  const [currentSegment, setCurrentSegment] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const generationRef = useRef(0);
  const queueRef = useRef<TtsSegment[]>([]);
  const optionsRef = useRef<TtsPlaybackOptions>({});
  const statusRef = useRef<TtsPlaybackStatus>(supported ? "idle" : "unavailable");

  const setPlaybackStatus = useCallback((status: TtsPlaybackStatus) => {
    statusRef.current = status;
    setPlaybackStatusState(status);
  }, []);

  const clearPendingTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
  }, []);

  const stopTts = useCallback(() => {
    generationRef.current += 1;
    clearPendingTimeouts();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setCurrentSegment(0);
    setPlaybackStatus(supportsSpeechPlayback() ? "idle" : "unavailable");
  }, [clearPendingTimeouts, setPlaybackStatus]);

  const startSequence = useCallback((segments: TtsSegment[], playbackOptions: TtsPlaybackOptions = {}) => {
    if (!supportsSpeechPlayback()) {
      setPlaybackStatus("unavailable");
      playbackOptions.onError?.();
      return false;
    }

    const queue = segments.filter((segment) => segment.text.trim().length > 0);
    if (queue.length === 0) {
      setPlaybackStatus("idle");
      return false;
    }

    generationRef.current += 1;
    const generation = generationRef.current;
    clearPendingTimeouts();
    window.speechSynthesis.cancel();
    queueRef.current = queue;
    optionsRef.current = playbackOptions;
    const requestedIndex = Math.floor(playbackOptions.startIndex ?? 0);
    const startIndex = Math.min(queue.length - 1, Math.max(0, requestedIndex));
    setSegmentCount(queue.length);
    setPlaybackStatus("loading");

    const playNext = (index: number) => {
      if (generationRef.current !== generation) return;
      const segment = queue[index];
      if (!segment) {
        setCurrentSegment(queue.length);
        setPlaybackStatus("completed");
        playbackOptions.onComplete?.();
        return;
      }

      let utterance: SpeechSynthesisUtterance;
      try {
        utterance = new SpeechSynthesisUtterance(segment.text);
      } catch {
        setPlaybackStatus("unavailable");
        playbackOptions.onError?.();
        return;
      }

      const locale = voicePlaybackLocale(segment.lang);
      utterance.lang = locale;
      utterance.rate = segment.rate ?? 0.9;
      const voice = selectSpeechVoice(window.speechSynthesis.getVoices?.() ?? [], locale);
      if (voice) utterance.voice = voice;
      setVoiceName(voice?.name ?? null);
      setActiveLanguage(locale);
      setCurrentSegment(index + 1);
      playbackOptions.onProgress?.(index, queue.length);

      utterance.onstart = () => {
        if (generationRef.current !== generation || statusRef.current === "paused") return;
        setPlaybackStatus("playing");
      };
      utterance.onend = () => {
        if (generationRef.current !== generation) return;
        const nextIndex = index + 1;
        if (nextIndex >= queue.length) {
          setCurrentSegment(queue.length);
          setPlaybackStatus("completed");
          playbackOptions.onComplete?.();
          return;
        }
        const timeoutId = window.setTimeout(() => playNext(nextIndex), segment.delayMs ?? 400);
        timeoutIdsRef.current.push(timeoutId);
      };
      utterance.onerror = () => {
        if (generationRef.current !== generation) return;
        setPlaybackStatus("error");
        playbackOptions.onError?.();
      };
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        if (generationRef.current !== generation) return;
        setPlaybackStatus("error");
        playbackOptions.onError?.();
      }
    };

    playNext(startIndex);
    return true;
  }, [clearPendingTimeouts, setPlaybackStatus]);

  const speakSequence = useCallback((segments: TtsSegment[], playbackOptions?: TtsPlaybackOptions) => {
    return startSequence(segments, playbackOptions);
  }, [startSequence]);

  const speakText = useCallback((text: string, lang?: string, playbackOptions?: TtsPlaybackOptions) => {
    return speakSequence([{ text, lang }], playbackOptions);
  }, [speakSequence]);

  const pauseTts = useCallback(() => {
    if (!supportsSpeechPlayback() || (statusRef.current !== "playing" && statusRef.current !== "loading")) return false;
    window.speechSynthesis.pause();
    setPlaybackStatus("paused");
    return true;
  }, [setPlaybackStatus]);

  const resumeTts = useCallback(() => {
    if (!supportsSpeechPlayback() || statusRef.current !== "paused") return false;
    window.speechSynthesis.resume();
    setPlaybackStatus("playing");
    return true;
  }, [setPlaybackStatus]);

  const replayTts = useCallback(() => {
    if (queueRef.current.length === 0) return false;
    return startSequence(queueRef.current, { ...optionsRef.current, startIndex: 0 });
  }, [startSequence]);

  useEffect(() => {
    if (supported && statusRef.current === "unavailable") setPlaybackStatus("idle");
    if (!supported && statusRef.current !== "unavailable") setPlaybackStatus("unavailable");
  }, [setPlaybackStatus, supported]);

  useEffect(() => () => {
    generationRef.current += 1;
    clearPendingTimeouts();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, [clearPendingTimeouts]);

  return {
    speakText,
    speakSequence,
    pauseTts,
    resumeTts,
    replayTts,
    stopTts,
    playbackStatus,
    isTtsSupported: supported,
    isTtsSpeaking: playbackStatus === "loading" || playbackStatus === "playing",
    isTtsPaused: playbackStatus === "paused",
    currentSegment,
    segmentCount,
    activeLanguage,
    voiceName,
  };
}

export interface TranscriptEntry {
  from: "user" | "vyva";
  text: string;
  timestamp: number;
}

export type VoiceDiagnosticStepId =
  | "browser_microphone"
  | "account_access"
  | "agent_config"
  | "server_credentials"
  | "session_token"
  | "elevenlabs_session";

export type VoiceDiagnosticStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export type VoiceDiagnosticStep = {
  id: VoiceDiagnosticStepId;
  label: string;
  status: VoiceDiagnosticStatus;
  detail?: string;
};

export type VoiceConnectionErrorCode =
  | "VOICE_AUTH_REQUIRED"
  | "VOICE_ENTITLEMENT_REQUIRED"
  | "VOICE_ACCOUNT_ACCESS_DISABLED"
  | "VOICE_ACTIVE_PROFILE_MISSING"
  | "VOICE_ACTIVE_PROFILE_NOT_FOUND"
  | "VOICE_ACCESS_UNAVAILABLE"
  | "ELEVENLABS_AGENT_MISSING"
  | "ELEVENLABS_API_KEY_MISSING"
  | "ELEVENLABS_SIGNED_URL_ERROR"
  | "ELEVENLABS_TOKEN_ERROR"
  | "MICROPHONE_UNAVAILABLE"
  | "MICROPHONE_PERMISSION_DENIED"
  | "MICROPHONE_ACCESS_FAILED"
  | "VOICE_SESSION_CLOSED"
  | "VOICE_SESSION_ERROR"
  | "VOICE_SESSION_START_FAILED";

class VoiceConnectionError extends Error {
  code: VoiceConnectionErrorCode;

  constructor(message: string, code: VoiceConnectionErrorCode) {
    super(message);
    this.name = "VoiceConnectionError";
    this.code = code;
  }
}

type StartVoiceOptions = {
  agentId?: string;
  agentSlug?: string;
  roomSlug?: string;
  skipMicrophone?: boolean;
  autoStartListening?: boolean;
  forceRestart?: boolean;
  dynamicVariables?: Record<string, string | number | boolean>;
};

export type VoiceResolvedSessionContext = {
  startedAt: number;
  contextHint?: string;
  agentId?: string;
  agentSlug?: string;
  roomSlug?: string;
  domain?: string;
  appEntrypoint?: string;
  conversationPlanId?: string;
  dynamicVariables: Record<string, string | number | boolean>;
};

export type OnboardingVoiceLiveDiagnostic = {
  phase: "starting" | "connected" | "starter_sent" | "tool_received" | "error";
  sectionId?: string;
  sectionLabel?: string;
  agentSlug?: string;
  connected: boolean;
  starterSent: boolean;
  clientToolReceived: boolean;
  lastEvent?: string;
  error?: string;
  updatedAt: number;
};

type SendTextOptions = {
  invisibleInTranscript?: boolean;
};

type VoiceRecommendationFeedbackAction = "accepted" | "dismissed" | "completed";

type ActiveVoiceRecommendation = {
  id: string;
  domain: string;
  title: string;
  reason: string;
  sessionId: string;
  conversationId: string;
  token: string;
};

const VYVA_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? "agent_0401knfndsypfmqa31ssw82h364m";
const FALLBACK_USER_ID = "vyva-local-user";
const VOICE_FORCE_STOP_EVENT = "vyva:voice-force-stop";
const ALLOW_PUBLIC_AGENT_FALLBACK =
  import.meta.env.DEV && import.meta.env.VITE_ELEVENLABS_ALLOW_PUBLIC_FALLBACK === "true";

let activeVoiceInstanceId: string | null = null;

const VOICE_DIAGNOSTIC_LABELS: Record<VoiceDiagnosticStepId, string> = {
  browser_microphone: "Microphone",
  account_access: "Account access",
  agent_config: "Agent config",
  server_credentials: "Server key",
  session_token: "Signed URL",
  elevenlabs_session: "ElevenLabs session",
};

type ConversationTurn = { role: "user" | "assistant"; content: string };

type RouterResponse = {
  agent_id?: string;
  system_prompt_override?: string;
  dynamic_variables?: Record<string, string | number | boolean>;
  session_data?: {
    domain?: string;
    intent_confidence?: number;
    session_id?: string;
    turn_count?: number;
    last_agent?: string | null;
  };
};

type VoiceContextResponse = {
  domain?: string;
  dynamic_variables?: Record<string, string | number | boolean>;
};

type VoiceReadinessResponse = {
  ready?: boolean;
  agent_slug?: string;
  room_slug?: string;
  source?: string;
  agent_id_present?: boolean;
};

type VoiceServerErrorBody = {
  error?: string;
  code?: string;
  detail?: string;
  expected_keys?: string[];
  account_user_id?: string | null;
  active_profile_id?: string | null;
  profile_id?: string | null;
  account_status?: string | null;
  profile_count?: number;
  needs_profile_setup?: boolean;
  needs_profile_selection?: boolean;
};

function sanitizeVoiceDiagnosticDetail(value?: string | null) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;

  return trimmed
    .replace(/([?&](?:token|api_key|xi-api-key|signed_url)=)[^&\s]+/gi, "$1[hidden]")
    .replace(/\b(?:wss?|https?):\/\/\S+/gi, "[voice session url hidden]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [hidden]")
    .slice(0, 180);
}

function createVoiceDiagnostics(input: {
  skipMicrophone: boolean;
  options?: StartVoiceOptions;
  readinessAgentId?: string;
}): VoiceDiagnosticStep[] {
  const agentDetail = input.options?.agentSlug
    ? `Slug: ${input.options.agentSlug}`
    : input.options?.roomSlug
    ? `Room: ${input.options.roomSlug}`
    : input.readinessAgentId
    ? "Default VYVA agent selected"
    : undefined;

  return [
    {
      id: "browser_microphone",
      label: VOICE_DIAGNOSTIC_LABELS.browser_microphone,
      status: input.skipMicrophone ? "skipped" : "pending",
      ...(input.skipMicrophone ? { detail: "Text-only mode" } : {}),
    },
    { id: "account_access", label: VOICE_DIAGNOSTIC_LABELS.account_access, status: "pending" },
    {
      id: "agent_config",
      label: VOICE_DIAGNOSTIC_LABELS.agent_config,
      status: "pending",
      ...(agentDetail ? { detail: agentDetail } : {}),
    },
    { id: "server_credentials", label: VOICE_DIAGNOSTIC_LABELS.server_credentials, status: "pending" },
    { id: "session_token", label: VOICE_DIAGNOSTIC_LABELS.session_token, status: "pending" },
    { id: "elevenlabs_session", label: VOICE_DIAGNOSTIC_LABELS.elevenlabs_session, status: "pending" },
  ];
}

function failedVoiceDiagnosticStep(code: VoiceConnectionErrorCode): VoiceDiagnosticStepId {
  if (
    code === "MICROPHONE_UNAVAILABLE" ||
    code === "MICROPHONE_PERMISSION_DENIED" ||
    code === "MICROPHONE_ACCESS_FAILED"
  ) {
    return "browser_microphone";
  }

  if (
    code === "VOICE_AUTH_REQUIRED" ||
    code === "VOICE_ENTITLEMENT_REQUIRED" ||
    code === "VOICE_ACCOUNT_ACCESS_DISABLED" ||
    code === "VOICE_ACTIVE_PROFILE_MISSING" ||
    code === "VOICE_ACTIVE_PROFILE_NOT_FOUND" ||
    code === "VOICE_ACCESS_UNAVAILABLE"
  ) {
    return "account_access";
  }

  if (code === "ELEVENLABS_AGENT_MISSING") return "agent_config";
  if (code === "ELEVENLABS_API_KEY_MISSING") return "server_credentials";
  if (code === "ELEVENLABS_SIGNED_URL_ERROR" || code === "ELEVENLABS_TOKEN_ERROR") return "session_token";
  return "elevenlabs_session";
}

function normalizeTranscriptText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatDisconnectDetails(details: DisconnectionDetails) {
  if (details.reason === "user") return null;
  if (details.reason !== "error") return null;

  const closeCode = "closeCode" in details && details.closeCode ? ` code ${details.closeCode}` : "";
  const closeReason = "closeReason" in details && details.closeReason ? `: ${details.closeReason}` : "";
  return `Voice session closed (${details.reason}${closeCode})${closeReason}. ${details.message}`;
}

async function requestVoiceMicrophonePermission() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new VoiceConnectionError("Microphone access is not available in this browser.", "MICROPHONE_UNAVAILABLE");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      throw new VoiceConnectionError("Microphone permission was denied.", "MICROPHONE_PERMISSION_DENIED");
    }
    throw new VoiceConnectionError(
      error instanceof Error ? error.message : "Microphone access failed.",
      "MICROPHONE_ACCESS_FAILED",
    );
  }
}

function isVoiceConnectionError(error: unknown): error is VoiceConnectionError {
  return error instanceof VoiceConnectionError;
}

function voiceConnectionErrorCode(error: unknown, fallback: VoiceConnectionErrorCode): VoiceConnectionErrorCode {
  return isVoiceConnectionError(error) ? error.code : fallback;
}

function shortVoiceDebugId(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > 14 ? `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}` : trimmed;
}

function voiceAccountAccessMessage(parsed: VoiceServerErrorBody, fallback: string) {
  const activeProfileId = shortVoiceDebugId(parsed.profile_id ?? parsed.active_profile_id);
  const accountUserId = shortVoiceDebugId(parsed.account_user_id);

  if (parsed.code === "ACCOUNT_ACCESS_DISABLED") {
    const profileDetail = activeProfileId ? ` Active profile: ${activeProfileId}.` : "";
    const statusDetail = parsed.account_status ? ` Status: ${parsed.account_status}.` : "";
    return `Account access is disabled for the active profile.${profileDetail}${statusDetail}`;
  }

  if (parsed.code === "ACTIVE_PROFILE_REQUIRED") {
    const accountDetail = accountUserId ? ` Account: ${accountUserId}.` : "";
    return `No active care profile is selected for this login.${accountDetail}`;
  }

  if (parsed.code === "ACTIVE_PROFILE_NOT_FOUND") {
    const profileDetail = activeProfileId ? ` Active profile: ${activeProfileId}.` : "";
    const accountDetail = accountUserId ? ` Account: ${accountUserId}.` : "";
    return `The selected care profile could not be found.${profileDetail}${accountDetail}`;
  }

  return fallback;
}

function codeFromTokenError(status: number, parsed: { code?: string; error?: string; detail?: string }): VoiceConnectionErrorCode {
  if (parsed.code === "ACCOUNT_ACCESS_DISABLED") return "VOICE_ACCOUNT_ACCESS_DISABLED";
  if (parsed.code === "ACTIVE_PROFILE_REQUIRED") return "VOICE_ACTIVE_PROFILE_MISSING";
  if (parsed.code === "ACTIVE_PROFILE_NOT_FOUND") return "VOICE_ACTIVE_PROFILE_NOT_FOUND";
  if (parsed.code === "ENTITLEMENT_REQUIRED") return "VOICE_ENTITLEMENT_REQUIRED";
  if (parsed.code === "FEATURE_ACCESS_UNAVAILABLE") return "VOICE_ACCESS_UNAVAILABLE";
  if (parsed.code === "ELEVENLABS_AGENT_MISSING") return "ELEVENLABS_AGENT_MISSING";
  if (parsed.code === "ELEVENLABS_API_KEY_MISSING") return "ELEVENLABS_API_KEY_MISSING";
  if (parsed.code === "ELEVENLABS_SIGNED_URL_ERROR") return "ELEVENLABS_SIGNED_URL_ERROR";
  if (parsed.code === "ELEVENLABS_TOKEN_ERROR") return "ELEVENLABS_TOKEN_ERROR";
  if (status === 401) return "VOICE_AUTH_REQUIRED";
  if (status === 403) return "VOICE_ENTITLEMENT_REQUIRED";

  const text = `${parsed.error ?? ""} ${parsed.detail ?? ""}`.toLowerCase();
  if (text.includes("api key")) return "ELEVENLABS_API_KEY_MISSING";
  if (text.includes("agent configured")) return "ELEVENLABS_AGENT_MISSING";
  if (text.includes("signed url")) return "ELEVENLABS_SIGNED_URL_ERROR";
  return "VOICE_SESSION_START_FAILED";
}

async function voiceConnectionErrorFromResponse(
  response: Response,
  fallbackMessage: string,
) {
  const errorText = await response.text();
  let message = errorText || fallbackMessage;
  let parsedErrorCode: VoiceConnectionErrorCode | null = null;

  try {
    const parsed = JSON.parse(errorText) as VoiceServerErrorBody;
    message = parsed.error || parsed.detail || message;
    message = voiceAccountAccessMessage(parsed, message);
    if (parsed.expected_keys?.[0]) {
      message = `${message} (${parsed.expected_keys[0]})`;
    }
    parsedErrorCode = codeFromTokenError(response.status, parsed);
  } catch {
    // Keep the raw response text when the server did not return JSON.
  }

  return new VoiceConnectionError(
    message,
    parsedErrorCode ?? codeFromTokenError(response.status, { error: message }),
  );
}

async function checkBrowserVoiceReadiness(skipMicrophone: boolean) {
  if (skipMicrophone) return;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new VoiceConnectionError("Microphone access is not available in this browser.", "MICROPHONE_UNAVAILABLE");
  }

  if (!navigator.permissions?.query) return;

  try {
    const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
    if (permission.state === "denied") {
      throw new VoiceConnectionError("Microphone permission was denied.", "MICROPHONE_PERMISSION_DENIED");
    }
  } catch (error) {
    if (isVoiceConnectionError(error)) throw error;
  }
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

function userIdFromToken() {
  const token = getToken();
  if (!token) return FALLBACK_USER_ID;
  try {
    const [, payload] = token.split(".");
    if (!payload) return FALLBACK_USER_ID;
    const decoded = JSON.parse(decodeBase64Url(payload)) as { sub?: unknown };
    return typeof decoded.sub === "string" && decoded.sub.trim()
      ? decoded.sub
      : FALLBACK_USER_ID;
  } catch {
    return FALLBACK_USER_ID;
  }
}

function getVoiceSessionId() {
  return ensureVoiceSessionId();
}

function voiceTriageTouchContext(detail: VoiceTriageTouchAnswerDetail) {
  const answer = detail.utterance.trim() || detail.choiceId?.trim() || "a tapped answer";
  const nextQuestion = detail.nextQuestion?.trim();
  const status = detail.status?.trim();

  if (status === "complete") {
    return `The user tapped this answer in the app: "${answer}". The shared VYVA triage session has completed and saved the result. Do not ask the same question again.`;
  }

  if (status === "emergency") {
    return `The user tapped this answer in the app: "${answer}". The shared VYVA triage session is now in emergency guidance. Speak only the emergency guidance from the triage tool and do not downgrade urgency.`;
  }

  return [
    `The user tapped this answer in the app: "${answer}".`,
    "The shared VYVA triage session has already processed this answer.",
    nextQuestion
      ? `Continue from this current triage question: "${nextQuestion}".`
      : "Continue from the current triage question shown in the app.",
    "Do not call the triage tool again for the tapped answer.",
  ].join(" ");
}

function voiceTriageTouchContinuation(detail: VoiceTriageTouchAnswerDetail) {
  const status = detail.status?.trim();

  if (status === "complete") {
    return "Continue from the VYVA app selection that was already processed. The triage flow is complete, so explain the saved guidance now without restarting the questions or submitting the selected answer again.";
  }

  if (status === "emergency") {
    return "Continue from the VYVA app selection that was already processed. Speak the emergency guidance already supplied in context now, without restarting the questions or submitting the selected answer again.";
  }

  return "Continue from the VYVA app selection that was already processed. Ask only the current next question supplied in context, and do not submit the selected answer again.";
}

function createVoiceInstanceId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `voice-instance-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function claimVoiceInstance(instanceId: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VOICE_FORCE_STOP_EVENT, { detail: { requester: instanceId } }));
  }
  activeVoiceInstanceId = instanceId;
}

function releaseVoiceInstance(instanceId: string) {
  if (activeVoiceInstanceId === instanceId) activeVoiceInstanceId = null;
}

function transcriptToHistory(transcript: TranscriptEntry[]): ConversationTurn[] {
  return transcript.slice(-12).map((entry) => ({
    role: entry.from === "user" ? "user" : "assistant",
    content: entry.text,
  }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textFromUnknown).filter(Boolean).join(" ").trim();

  const record = asRecord(value);
  if (!record) return "";

  const textKeys = [
    "message",
    "text",
    "transcript",
    "content",
    "response",
    "agent_response",
    "agentResponse",
    "corrected_agent_response",
    "original_agent_response",
    "user_transcript",
    "userTranscript",
    "agent_response_event",
    "agent_response_correction_event",
    "user_transcription_event",
    "tentative_user_transcription_event",
    "tentative_agent_response_internal_event",
    "text_response_part",
  ];

  for (const key of textKeys) {
    const text = textFromUnknown(record[key]);
    if (text) return text;
  }

  return "";
}

function textPartFromUnknown(value: unknown): string {
  const record = asRecord(value);
  if (typeof record?.text === "string") return record.text;
  return textFromUnknown(value);
}

function textPartType(value: unknown): string {
  const record = asRecord(value);
  return typeof record?.type === "string" ? record.type.toLowerCase() : "";
}

function isUserVoiceMessage(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return false;

  const role = typeof record.role === "string" ? record.role.toLowerCase() : "";
  const source = typeof record.source === "string" ? record.source.toLowerCase() : "";
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";

  return role === "user" ||
    source === "user" ||
    type.includes("user_transcript") ||
    Boolean(record.user_transcription_event) ||
    Boolean(record.tentative_user_transcription_event);
}

type UserVoiceTranscriptPhase = "tentative" | "final" | "generic";

type UserVoiceUtteranceCorrelation = {
  voiceUtteranceId: string;
  canvasProvenance: VoiceCanvasSceneProvenance | null;
  createdAt: number;
};

const MAX_USER_VOICE_UTTERANCE_CORRELATIONS = 40;

function userVoiceTranscriptPhase(payload: unknown): UserVoiceTranscriptPhase {
  const record = asRecord(payload);
  if (!record) return "generic";
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";

  if (
    type.includes("tentative_user_transcript") ||
    Boolean(record.tentative_user_transcription_event)
  ) {
    return "tentative";
  }
  if (
    type.includes("user_transcript") ||
    Boolean(record.user_transcription_event)
  ) {
    return "final";
  }
  return "generic";
}

function normalizeProviderEventIdentifier(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null;
}

function userVoiceProviderEventId(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;
  const nestedRecords = [
    record,
    asRecord(record.user_transcription_event),
    asRecord(record.tentative_user_transcription_event),
  ].filter(Boolean) as Record<string, unknown>[];
  const keys = [
    "event_id",
    "eventId",
    "message_id",
    "messageId",
    "id",
  ];

  for (const candidateRecord of nestedRecords) {
    for (const key of keys) {
      const eventId = normalizeProviderEventIdentifier(candidateRecord[key]);
      if (eventId) return eventId;
    }
  }
  return null;
}

function safeVoiceUtteranceIdSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 128) || "unknown";
}

function providerVoiceUtteranceId(voiceSessionId: string, providerEventId: string) {
  return [
    "elevenlabs-user",
    safeVoiceUtteranceIdSegment(voiceSessionId),
    safeVoiceUtteranceIdSegment(providerEventId),
  ].join(":");
}

function localVoiceUtteranceId(voiceSessionId: string, sequence: number) {
  return [
    "elevenlabs-user-local",
    safeVoiceUtteranceIdSegment(voiceSessionId),
    String(sequence),
  ].join(":");
}

function rememberUserVoiceUtteranceCorrelation(
  correlations: Map<string, UserVoiceUtteranceCorrelation>,
  providerEventId: string,
  correlation: UserVoiceUtteranceCorrelation,
) {
  if (!correlations.has(providerEventId) && correlations.size >= MAX_USER_VOICE_UTTERANCE_CORRELATIONS) {
    const oldestKey = correlations.keys().next().value;
    if (oldestKey) correlations.delete(oldestKey);
  }
  if (!correlations.has(providerEventId)) correlations.set(providerEventId, correlation);
}

function isAgentVoiceDebugEvent(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return false;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  return type.includes("agent_response") ||
    type.includes("agent_chat_response_part") ||
    Boolean(record.agent_response_event) ||
    Boolean(record.agent_response_correction_event) ||
    Boolean(record.text_response_part);
}

function inferVoiceContextDomain(options: StartVoiceOptions | undefined) {
  const agentSlug = options?.agentSlug?.trim().toLowerCase();
  if (agentSlug === "vyva" || agentSlug === "main-vyva" || agentSlug === "main_vyva") return "companion";
  if (agentSlug === "doctor" || agentSlug === "medical-doctor") return "doctor";
  if (agentSlug === "health" || agentSlug === "health-assistant" || agentSlug === "dr-ai" || agentSlug === "ask-dr-ai") return "health";
  if (agentSlug === "meds" || agentSlug === "medication" || agentSlug === "medications") return "meds";
  if (agentSlug === "safety" || agentSlug === "safe-home" || agentSlug === "sos") return "safety";
  if (agentSlug === "concierge") return "concierge";
  if (agentSlug === "onboarding-profile") return "onboarding_profile";
  if (agentSlug === "brain-coach" || agentSlug === "brain_coach") return "brain_coach";
  if (options?.roomSlug || agentSlug) return "social";
  return undefined;
}

function dynamicString(
  variables: Record<string, string | number | boolean> | undefined,
  key: string,
) {
  const value = variables?.[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function onboardingFirstMessage(dynamicVariables: Record<string, string | number | boolean>) {
  const sectionLabel = dynamicString(dynamicVariables, "active_section_label");
  return sectionLabel
    ? `I'm ready for ${sectionLabel}. Tell me what you'd like me to add.`
    : "I'm ready for this profile section. Tell me what you'd like me to add.";
}

function onboardingStarterUserMessage(dynamicVariables: Record<string, string | number | boolean>) {
  const sectionLabel = dynamicString(dynamicVariables, "active_section_label");
  const sectionText = sectionLabel || "this profile section";
  return [
    `Start ${sectionText} now.`,
    "Speak one short prompt to the user, then listen for their answer.",
    "Use the active app section and client tool to create a local review draft.",
    "Do not ask for account ID, profile ID, user ID, app IDs, API keys, credentials, or setup details.",
  ].join(" ");
}

function isOnboardingVoiceStart(options: StartVoiceOptions | undefined) {
  return inferVoiceContextDomain(options) === "onboarding_profile" ||
    dynamicString(options?.dynamicVariables, "conversation_plan_id") === "onboarding_profile_collection_v1" ||
    dynamicString(options?.dynamicVariables, "app_entrypoint") === "onboarding-profile";
}

function onboardingLiveDiagnosticFromVariables(
  phase: OnboardingVoiceLiveDiagnostic["phase"],
  variables: Record<string, string | number | boolean>,
  patch: Partial<Omit<OnboardingVoiceLiveDiagnostic, "phase" | "updatedAt">> = {},
): OnboardingVoiceLiveDiagnostic {
  return {
    phase,
    sectionId: dynamicString(variables, "active_section_id") || undefined,
    sectionLabel: dynamicString(variables, "active_section_label") || undefined,
    agentSlug: "onboarding-profile",
    connected: false,
    starterSent: false,
    clientToolReceived: false,
    ...patch,
    updatedAt: Date.now(),
  };
}

function sessionOverridesForResolvedContext(
  sessionOptions: PartialOptions,
  resolvedSystemPrompt: string | undefined,
  resolvedDomain: string | undefined,
  resolvedDynamicVariables: Record<string, string | number | boolean>,
): PartialOptions["overrides"] {
  const existing = sessionOptions.overrides;
  const drAiFirstMessage = dynamicString(resolvedDynamicVariables, "dr_ai_first_message");
  if (resolvedDomain === "health" && drAiFirstMessage) {
    const language = dynamicString(resolvedDynamicVariables, "language")
      || dynamicString(resolvedDynamicVariables, "preferred_language")
      || "en";
    return {
      ...existing,
      agent: {
        ...existing?.agent,
        language,
      },
    };
  }
  if (resolvedDomain !== "onboarding_profile") return existing;

  const prompt = resolvedSystemPrompt?.trim();

  return {
    ...existing,
    agent: {
      ...existing?.agent,
      ...(prompt
        ? {
            prompt: {
              ...existing?.agent?.prompt,
              prompt,
            },
          }
        : {}),
      firstMessage: onboardingFirstMessage(resolvedDynamicVariables),
    },
  };
}

function toolParameters(parameters: unknown): Record<string, unknown> {
  return parameters && typeof parameters === "object"
    ? parameters as Record<string, unknown>
    : {};
}

function toolString(parameters: Record<string, unknown>, key: string) {
  const value = parameters[key];
  return typeof value === "string" ? value.trim() : "";
}

function activeRecommendationFromVariables(
  variables: Record<string, string | number | boolean> | undefined,
): ActiveVoiceRecommendation | null {
  const id = dynamicString(variables, "next_best_conversation_id");
  if (!id) return null;
  const sessionId = dynamicString(variables, "session_id") || getVoiceSessionId();
  return {
    id,
    domain: dynamicString(variables, "next_best_conversation_domain"),
    title: dynamicString(variables, "next_best_conversation_title"),
    reason: dynamicString(variables, "next_best_conversation_reason"),
    sessionId,
    conversationId: dynamicString(variables, "conversation_id") || sessionId,
    token: dynamicString(variables, "voice_recommendation_feedback_token"),
  };
}

function inferRecommendationFeedbackAction(text: string): VoiceRecommendationFeedbackAction | null {
  const normalized = normalizeTranscriptText(text);
  if (!normalized) return null;
  if (/^(no|no thanks|not now|later|skip|cancel)\b/.test(normalized) || /\b(not now|leave it|skip it|maybe later)\b/.test(normalized)) {
    return "dismissed";
  }
  if (/\b(done|completed|all set|that helped|thanks that's all|thank you that's all|sorted)\b/.test(normalized)) {
    return "completed";
  }
  if (/^(yes|yeah|yep|sure|ok|okay|please|go ahead|sounds good|let's|lets|do it|start)\b/.test(normalized)) {
    return "accepted";
  }
  return null;
}

function useVyvaVoiceController() {
  const [isPreparing, setIsPreparing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [lastResolvedSessionContext, setLastResolvedSessionContext] = useState<VoiceResolvedSessionContext | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<VoiceConnectionErrorCode | null>(null);
  const [voiceDiagnostics, setVoiceDiagnostics] = useState<VoiceDiagnosticStep[]>(() => createVoiceDiagnostics({ skipMicrophone: false }));
  const [onboardingVoiceLiveDiagnostic, setOnboardingVoiceLiveDiagnostic] =
    useState<OnboardingVoiceLiveDiagnostic | null>(null);
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const systemPromptRef = useRef<string | undefined>(undefined);
  const statusRef = useRef<"idle" | "connecting" | "connected">("idle");
  const isPreparingRef = useRef(false);
  const conversationRef = useRef<ElevenConversation | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const sessionGenerationRef = useRef(0);
  const userClosingRef = useRef(false);
  const shouldMuteOnConnectRef = useRef(true);
  const transferPendingRef = useRef(false);
  const hiddenOutgoingMessagesRef = useRef<string[]>([]);
  const streamingVyvaTranscriptRef = useRef("");
  const streamingVyvaTranscriptShouldAppendRef = useRef(false);
  const voiceInstanceIdRef = useRef(createVoiceInstanceId());
  const activeRecommendationRef = useRef<ActiveVoiceRecommendation | null>(null);
  const recordedRecommendationActionsRef = useRef<Set<string>>(new Set());
  const userVoiceUtteranceSequenceRef = useRef(0);
  const userVoiceUtteranceCorrelationsRef = useRef<Map<string, UserVoiceUtteranceCorrelation>>(new Map());

  const setVoiceStatus = useCallback((nextStatus: "idle" | "connecting" | "connected") => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const setVoicePreparing = useCallback((nextPreparing: boolean) => {
    isPreparingRef.current = nextPreparing;
    setIsPreparing(nextPreparing);
  }, []);

  const updateVoiceDiagnostic = useCallback((
    id: VoiceDiagnosticStepId,
    status: VoiceDiagnosticStatus,
    detail?: string,
  ) => {
    setVoiceDiagnostics((current) => current.map((step) => (
      step.id === id
        ? {
            ...step,
            status,
            ...(detail !== undefined ? { detail: sanitizeVoiceDiagnosticDetail(detail) } : {}),
          }
        : step
    )));
  }, []);

  const markVoiceDiagnosticFailure = useCallback((
    code: VoiceConnectionErrorCode,
    detail?: string,
  ) => {
    const failedStep = failedVoiceDiagnosticStep(code);
    setVoiceDiagnostics((current) => current.map((step) => {
      const passedBeforeFailure =
        (failedStep === "agent_config" && step.id === "account_access") ||
        (failedStep === "server_credentials" && ["account_access", "agent_config"].includes(step.id)) ||
        (failedStep === "session_token" && ["account_access", "agent_config", "server_credentials"].includes(step.id)) ||
        (failedStep === "elevenlabs_session" && ["account_access", "agent_config", "server_credentials", "session_token"].includes(step.id));

      if (step.id === failedStep) {
        return {
          ...step,
          status: "failed",
          detail: sanitizeVoiceDiagnosticDetail(detail) ?? step.detail,
        };
      }

      if (passedBeforeFailure && step.status !== "skipped") {
        return { ...step, status: "passed" };
      }

      if (step.status === "running") {
        return { ...step, status: "pending" };
      }

      return step;
    }));
  }, []);

  const replaceTranscript = useCallback((nextTranscript: TranscriptEntry[]) => {
    transcriptRef.current = nextTranscript;
    setTranscript(nextTranscript);
  }, []);

  const appendTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((previous) => {
      const next = [...previous, entry];
      transcriptRef.current = next;
      return next;
    });
  }, []);

  const upsertLatestVyvaTranscript = useCallback((text: string, options?: { forceAppend?: boolean }) => {
    const normalizedText = text.trim();
    if (!normalizedText) return;

    setTranscript((previous) => {
      const latestEntry = previous[previous.length - 1];
      const next = latestEntry?.from === "vyva" && !options?.forceAppend
        ? [
            ...previous.slice(0, -1),
            { ...latestEntry, text: normalizedText, timestamp: Date.now() },
          ]
        : [
            ...previous,
            { from: "vyva" as const, text: normalizedText, timestamp: Date.now() },
          ];
      transcriptRef.current = next;
      return next;
    });
  }, []);

  const handleVyvaTranscriptPart = useCallback((part: unknown) => {
    const partType = textPartType(part);
    const partText = textPartFromUnknown(part);

    if (partType === "start") {
      streamingVyvaTranscriptRef.current = partText;
      streamingVyvaTranscriptShouldAppendRef.current = true;
    } else if (partType === "delta") {
      streamingVyvaTranscriptRef.current += partText;
    } else if (partType === "stop") {
      if (partText) streamingVyvaTranscriptRef.current += partText;
    } else {
      streamingVyvaTranscriptRef.current = partText || streamingVyvaTranscriptRef.current;
    }

    const shouldAppend = streamingVyvaTranscriptShouldAppendRef.current;
    upsertLatestVyvaTranscript(streamingVyvaTranscriptRef.current, { forceAppend: shouldAppend });
    if (streamingVyvaTranscriptRef.current.trim()) {
      streamingVyvaTranscriptShouldAppendRef.current = false;
    }

    if (partType === "stop") {
      streamingVyvaTranscriptRef.current = "";
      streamingVyvaTranscriptShouldAppendRef.current = false;
    }
  }, [upsertLatestVyvaTranscript]);

  const interruptAgentAudio = useCallback(() => {
    setIsSpeaking(false);
  }, []);

  const teardown = useCallback(() => {
    sessionGenerationRef.current += 1;
    const conversation = conversationRef.current;
    conversationRef.current = null;
    if (conversation) {
      void conversation.endSession().catch(() => {});
    }
    hiddenOutgoingMessagesRef.current = [];
    streamingVyvaTranscriptRef.current = "";
    streamingVyvaTranscriptShouldAppendRef.current = false;
    userVoiceUtteranceCorrelationsRef.current.clear();
    activeRecommendationRef.current = null;
    recordedRecommendationActionsRef.current.clear();
    setIsConnecting(false);
    setVoicePreparing(false);
    setHasMicrophone(false);
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setIsMicMuted(true);
  }, [setVoicePreparing]);

  useEffect(() => () => {
    teardown();
    releaseVoiceInstance(voiceInstanceIdRef.current);
  }, [teardown]);

  useEffect(() => {
    const handleForceStop = (event: Event) => {
      const requester = event instanceof CustomEvent
        ? (event.detail as { requester?: string } | undefined)?.requester
        : undefined;

      if (requester === voiceInstanceIdRef.current) return;

      userClosingRef.current = true;
      teardown();
      userClosingRef.current = false;
      releaseVoiceInstance(voiceInstanceIdRef.current);
      setVoiceStatus("idle");
      setIsConnecting(false);
      setVoicePreparing(false);
      setIsSpeaking(false);
      setIsUserSpeaking(false);
      setIsMicMuted(true);
      setIsTransferring(false);
      transferPendingRef.current = false;
      setLastError(null);
      setLastErrorCode(null);
    };

    window.addEventListener(VOICE_FORCE_STOP_EVENT, handleForceStop);
    return () => window.removeEventListener(VOICE_FORCE_STOP_EVENT, handleForceStop);
  }, [setVoicePreparing, setVoiceStatus, teardown]);

  useEffect(() => {
    return subscribeAgentAppContext((message) => {
      if (statusRef.current !== "connected" || !conversationRef.current) return;
      try {
        conversationRef.current.sendContextualUpdate(message);
      } catch (error) {
        console.warn("[VYVA] Failed to send app context update:", error);
      }
    });
  }, []);

  useEffect(() => {
    const handleTouchAnswer = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as VoiceTriageTouchAnswerDetail | undefined
        : undefined;
      if (!detail?.conversationId) return;
      if (detail.conversationId !== readVoiceSessionId()) return;
      if (statusRef.current !== "connected" || !conversationRef.current) return;

      try {
        conversationRef.current.sendContextualUpdate(voiceTriageTouchContext(detail));
        const continuation = voiceTriageTouchContinuation(detail);
        hiddenOutgoingMessagesRef.current.push(normalizeTranscriptText(continuation));
        conversationRef.current.sendUserMessage(continuation);
      } catch (error) {
        console.warn("[VYVA] Failed to sync touch answer into voice session:", error);
      }
    };

    window.addEventListener(VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT, handleTouchAnswer);
    return () => window.removeEventListener(VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT, handleTouchAnswer);
  }, []);

  const fetchSessionOptions = useCallback(
    async (
      activeAgentId: string | undefined,
      shouldResolveAgentOnServer: boolean,
      options: StartVoiceOptions | undefined,
    ): Promise<PartialOptions> => {
      try {
        const res = await apiFetch("/api/elevenlabs-conversation-token", {
          method: "POST",
          body: JSON.stringify({
            ...(activeAgentId ? { agent_id: activeAgentId } : {}),
            ...(options?.agentSlug ? { agent_slug: options.agentSlug } : {}),
            ...(options?.roomSlug ? { room_slug: options.roomSlug } : {}),
          }),
        });
        if (!res.ok) {
          throw await voiceConnectionErrorFromResponse(res, "token fetch failed");
        }

        const data = (await res.json()) as { signed_url?: string; token?: string };
        if (data.signed_url) return { signedUrl: data.signed_url };
        if (data.token && activeAgentId) {
          return {
            signedUrl: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${activeAgentId}&token=${data.token}`,
          };
        }
        throw new Error("no URL or token");
      } catch (err) {
        if (!activeAgentId || shouldResolveAgentOnServer) {
          console.error("[VYVA] Token fetch failed:", err);
          throw err;
        }
        if (ALLOW_PUBLIC_AGENT_FALLBACK) {
          console.warn("[VYVA] Token fetch failed, trying explicit dev public fallback:", err);
          return { agentId: activeAgentId, connectionType: "websocket" };
        }
        throw err;
      }
    },
    [],
  );

  const checkVoiceReadiness = useCallback(
    async (
      activeAgentId: string | undefined,
      shouldResolveAgentOnServer: boolean,
      options: StartVoiceOptions | undefined,
    ): Promise<VoiceReadinessResponse> => {
      try {
        const res = await apiFetch("/api/voice-readiness", {
          method: "POST",
          body: JSON.stringify({
            ...(activeAgentId ? { agent_id: activeAgentId } : {}),
            ...(options?.agentSlug ? { agent_slug: options.agentSlug } : {}),
            ...(options?.roomSlug ? { room_slug: options.roomSlug } : {}),
          }),
        });

        if (!res.ok) {
          throw await voiceConnectionErrorFromResponse(res, "voice readiness check failed");
        }

        return await res.json() as VoiceReadinessResponse;
      } catch (err) {
        if (ALLOW_PUBLIC_AGENT_FALLBACK && activeAgentId && !shouldResolveAgentOnServer) {
          console.warn("[VYVA] Readiness check failed, allowing explicit dev public fallback:", err);
          return {
            ready: true,
            source: "public-dev-fallback",
            agent_id_present: Boolean(activeAgentId),
          };
        }
        throw err;
      }
    },
    [],
  );

  const recordRecommendationFeedback = useCallback(
    async (
      action: VoiceRecommendationFeedbackAction,
      metadata: Record<string, unknown> = {},
      override?: Partial<ActiveVoiceRecommendation> & { id?: string },
    ) => {
      const current = activeRecommendationRef.current;
      const recommendationId = override?.id ?? current?.id;
      if (!recommendationId) return false;

      const key = `${recommendationId}:${action}`;
      if (recordedRecommendationActionsRef.current.has(key)) return true;
      recordedRecommendationActionsRef.current.add(key);

      try {
        const res = await apiFetch("/api/voice/recommendations/feedback", {
          method: "POST",
          body: JSON.stringify({
            recommendation_id: recommendationId,
            action,
            session_id: override?.sessionId ?? current?.sessionId ?? getVoiceSessionId(),
            domain: override?.domain ?? current?.domain,
            title: override?.title ?? current?.title,
            reason: override?.reason ?? current?.reason,
            source: String(metadata.source ?? "frontend"),
            metadata,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        return true;
      } catch (err) {
        recordedRecommendationActionsRef.current.delete(key);
        console.warn("[VYVA] Failed to record recommendation feedback:", err);
        return false;
      }
    },
    [],
  );

  const resolveRouterSession = useCallback(
    async (
      contextHint: string | undefined,
      currentSystemPrompt: string | undefined,
      options: StartVoiceOptions | undefined,
    ) => {
      const appEntrypoint = typeof options?.dynamicVariables?.app_entrypoint === "string"
        ? options.dynamicVariables.app_entrypoint
        : undefined;

      if (options?.agentId || options?.agentSlug || options?.roomSlug) {
        let sharedDynamicVariables: Record<string, string | number | boolean> = {};
        const voiceSessionId = getVoiceSessionId();
        try {
          const res = await apiFetch("/api/voice-context", {
            method: "POST",
            body: JSON.stringify({
              domain: inferVoiceContextDomain(options),
              session_id: voiceSessionId,
              conversation_id: voiceSessionId,
              ...(contextHint ? { memory_query: contextHint } : {}),
              ...(appEntrypoint ? { app_entrypoint: appEntrypoint } : {}),
              ...(options.agentSlug ? { agent_slug: options.agentSlug } : {}),
              ...(options.roomSlug ? { room_slug: options.roomSlug } : {}),
            }),
          });
          if (res.ok) {
            const context = (await res.json()) as VoiceContextResponse;
            sharedDynamicVariables = context.dynamic_variables ?? {};
          }
        } catch (err) {
          console.warn("[VYVA] Shared voice context unavailable:", err);
        }

        return {
          agentId: options?.agentId,
          systemPrompt: currentSystemPrompt,
          dynamicVariables: {
            ...sharedDynamicVariables,
            ...(options?.dynamicVariables ?? {}),
          },
        };
      }

      const utterance = contextHint?.trim() || "companion";
      try {
        const res = await apiFetch("/api/router", {
          method: "POST",
          body: JSON.stringify({
            user_id: userIdFromToken(),
            session_id: getVoiceSessionId(),
            utterance,
            ...(appEntrypoint ? { app_entrypoint: appEntrypoint } : {}),
            conversation_history: transcriptToHistory(transcriptRef.current),
          }),
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const routed = (await res.json()) as RouterResponse;
        const routedVariables: Record<string, string | number | boolean> = {
          ...(routed.dynamic_variables ?? {}),
        };
        if (routed.session_data?.domain) routedVariables.routing_domain = routed.session_data.domain;
        if (typeof routed.session_data?.intent_confidence === "number") {
          routedVariables.intent_confidence = routed.session_data.intent_confidence;
        }

        return {
          agentId: routed.agent_id?.trim() || undefined,
          systemPrompt: currentSystemPrompt ?? routed.system_prompt_override,
          dynamicVariables: {
            ...routedVariables,
            ...(options?.dynamicVariables ?? {}),
          },
        };
      } catch (err) {
        console.warn("[VYVA] Router resolution failed, using default companion agent:", err);
        return {
          agentId: options?.agentId,
          systemPrompt: currentSystemPrompt,
          dynamicVariables: options?.dynamicVariables,
        };
      }
    },
    [],
  );

  const startVoice = useCallback(
    async (
      contextHint?: string,
      systemPrompt?: string,
      options?: StartVoiceOptions,
    ) => {
      const shouldForceRestart = options?.forceRestart === true && isOnboardingVoiceStart(options);
      if (statusRef.current !== "idle" || isPreparingRef.current) {
        if (!shouldForceRestart) return;
        userClosingRef.current = true;
        teardown();
        userClosingRef.current = false;
        releaseVoiceInstance(voiceInstanceIdRef.current);
        setVoiceStatus("idle");
        setHasEnded(false);
      }
      // Manual teardown invalidates old callbacks before they can clear this flag.
      userClosingRef.current = false;
      const sessionGeneration = sessionGenerationRef.current + 1;
      sessionGenerationRef.current = sessionGeneration;
      const isCurrentSession = () => sessionGenerationRef.current === sessionGeneration && !userClosingRef.current;

      setVoicePreparing(true);
      setHasEnded(false);
      replaceTranscript([]);
      streamingVyvaTranscriptRef.current = "";
      streamingVyvaTranscriptShouldAppendRef.current = false;
      userVoiceUtteranceCorrelationsRef.current.clear();
      setLastError(null);
      setLastErrorCode(null);
      if (isOnboardingVoiceStart(options)) {
        setOnboardingVoiceLiveDiagnostic(onboardingLiveDiagnosticFromVariables(
          "starting",
          options?.dynamicVariables ?? {},
          {
            agentSlug: options?.agentSlug,
            lastEvent: "start requested",
          },
        ));
      } else {
        setOnboardingVoiceLiveDiagnostic(null);
      }
      setHasMicrophone(false);
      setIsMicMuted(true);
      const voiceSessionId = getVoiceSessionId();
      const skipMicrophone = options?.skipMicrophone ?? false;
      const shouldResolveAgentOnServer = Boolean(options?.agentSlug || options?.roomSlug);
      const readinessAgentId = options?.agentId ?? (shouldResolveAgentOnServer ? undefined : VYVA_AGENT_ID);
      setVoiceDiagnostics(createVoiceDiagnostics({ skipMicrophone, options, readinessAgentId }));

      try {
        if (!skipMicrophone) {
          updateVoiceDiagnostic("browser_microphone", "running", "Checking browser microphone permission");
        }
        await checkBrowserVoiceReadiness(skipMicrophone);
        if (!skipMicrophone) {
          updateVoiceDiagnostic("browser_microphone", "passed", "Browser can request microphone access");
        }

        updateVoiceDiagnostic("account_access", "running", "Checking VYVA voice access");
        updateVoiceDiagnostic("agent_config", "running");
        updateVoiceDiagnostic("server_credentials", "running");
        const readiness = await checkVoiceReadiness(readinessAgentId, shouldResolveAgentOnServer, options);
        const readinessAgentDetail = readiness.agent_slug
          ? `Slug: ${readiness.agent_slug}${readiness.source ? ` (${readiness.source})` : ""}`
          : readiness.agent_id_present
          ? "Explicit agent ID selected"
          : options?.agentSlug
          ? `Slug: ${options.agentSlug}`
          : "Agent selected";
        updateVoiceDiagnostic("account_access", "passed", "Voice access verified");
        updateVoiceDiagnostic("agent_config", "passed", readinessAgentDetail);
        updateVoiceDiagnostic("server_credentials", "passed", "Server credentials available");
      } catch (err) {
        if (!isCurrentSession()) return;

        const detail = err instanceof Error ? err.message : "Voice is not ready yet.";
        const errorCode = voiceConnectionErrorCode(err, "VOICE_SESSION_START_FAILED");
        setLastError(detail);
        setLastErrorCode(errorCode);
        if (isOnboardingVoiceStart(options)) {
          setOnboardingVoiceLiveDiagnostic(onboardingLiveDiagnosticFromVariables(
            "error",
            options?.dynamicVariables ?? {},
            {
              agentSlug: options?.agentSlug,
              error: detail,
              lastEvent: "readiness failed",
            },
          ));
        }
        markVoiceDiagnosticFailure(errorCode, detail);
        setVoiceStatus("idle");
        setVoicePreparing(false);
        setIsConnecting(false);
        setIsMicMuted(true);
        setIsTransferring(false);
        transferPendingRef.current = false;
        recordVoiceTimelineEvent({
          kind: "session_error",
          title: "Voice readiness failed",
          detail,
          sessionId: voiceSessionId,
          ...(options?.agentSlug ? { agentSlug: options.agentSlug } : {}),
        });
        return;
      }

      if (!isCurrentSession()) {
        setVoicePreparing(false);
        return;
      }

      setVoicePreparing(false);
      claimVoiceInstance(voiceInstanceIdRef.current);
      setIsConnecting(true);
      setVoiceStatus("connecting");
      if (!skipMicrophone) {
        try {
          updateVoiceDiagnostic("browser_microphone", "running", "Requesting microphone access");
          await requestVoiceMicrophonePermission();
          updateVoiceDiagnostic("browser_microphone", "passed", "Microphone access granted");
        } catch (err) {
          if (!isCurrentSession()) return;

          const detail = err instanceof Error ? err.message : "Microphone access is needed to start voice.";
          const errorCode = voiceConnectionErrorCode(err, "MICROPHONE_ACCESS_FAILED");
          setLastError(detail);
          setLastErrorCode(errorCode);
          if (isOnboardingVoiceStart(options)) {
            setOnboardingVoiceLiveDiagnostic(onboardingLiveDiagnosticFromVariables(
              "error",
              options?.dynamicVariables ?? {},
              {
                agentSlug: options?.agentSlug,
                error: detail,
                lastEvent: "microphone failed",
              },
            ));
          }
          markVoiceDiagnosticFailure(errorCode, detail);
          setVoiceStatus("idle");
          setVoicePreparing(false);
          setIsConnecting(false);
          setIsMicMuted(true);
          setIsTransferring(false);
          transferPendingRef.current = false;
          recordVoiceTimelineEvent({
            kind: "session_error",
            title: "Voice microphone access failed",
            detail,
            sessionId: voiceSessionId,
            ...(options?.agentSlug ? { agentSlug: options.agentSlug } : {}),
          });
          releaseVoiceInstance(voiceInstanceIdRef.current);
          teardown();
          return;
        }
      }
      const routedSession = await resolveRouterSession(contextHint, systemPrompt, options);
      const activeAgentId = routedSession.agentId ?? (shouldResolveAgentOnServer ? undefined : VYVA_AGENT_ID);
      const resolvedSystemPrompt = routedSession.systemPrompt;
      const resolvedDynamicVariables = routedSession.dynamicVariables ?? {};
      const resolvedDomain =
        dynamicString(resolvedDynamicVariables, "routing_domain")
        || dynamicString(resolvedDynamicVariables, "transfer_domain")
        || inferVoiceContextDomain(options);
      if (resolvedDomain === "onboarding_profile") {
        setOnboardingVoiceLiveDiagnostic(onboardingLiveDiagnosticFromVariables(
          "starting",
          resolvedDynamicVariables,
          {
            agentSlug: options?.agentSlug,
            lastEvent: "context resolved",
          },
        ));
      }
      const resolvedAppEntrypoint =
        dynamicString(resolvedDynamicVariables, "app_entrypoint")
        || dynamicString(options?.dynamicVariables, "app_entrypoint")
        || undefined;
      setLastResolvedSessionContext({
        startedAt: Date.now(),
        ...(contextHint ? { contextHint } : {}),
        ...(activeAgentId ? { agentId: activeAgentId } : {}),
        ...(options?.agentSlug ? { agentSlug: options.agentSlug } : {}),
        ...(options?.roomSlug ? { roomSlug: options.roomSlug } : {}),
        ...(resolvedDomain ? { domain: resolvedDomain } : {}),
        ...(resolvedAppEntrypoint ? { appEntrypoint: resolvedAppEntrypoint } : {}),
        ...(dynamicString(resolvedDynamicVariables, "conversation_plan_id")
          ? { conversationPlanId: dynamicString(resolvedDynamicVariables, "conversation_plan_id") }
          : {}),
        dynamicVariables: resolvedDynamicVariables,
      });
      recordVoiceTimelineEvent({
        kind: "session_started",
        title: "Voice session started",
        detail: contextHint || "Voice start requested",
        sessionId: voiceSessionId,
        ...(resolvedDomain ? { domain: resolvedDomain } : {}),
        ...(activeAgentId ? { agentId: activeAgentId } : {}),
        ...(options?.agentSlug ? { agentSlug: options.agentSlug } : {}),
        ...(dynamicString(resolvedDynamicVariables, "conversation_plan_id")
          ? { conversationPlanId: dynamicString(resolvedDynamicVariables, "conversation_plan_id") }
          : {}),
      });
      recordVoiceTimelineEvent({
        kind: "context_resolved",
        title: "Context variables resolved",
        detail: `${Object.keys(resolvedDynamicVariables).length} dynamic variables available`,
        sessionId: voiceSessionId,
        ...(resolvedDomain ? { domain: resolvedDomain } : {}),
        ...(dynamicString(resolvedDynamicVariables, "conversation_plan_id")
          ? { conversationPlanId: dynamicString(resolvedDynamicVariables, "conversation_plan_id") }
          : {}),
      });
      activeRecommendationRef.current = activeRecommendationFromVariables(routedSession.dynamicVariables);
      recordedRecommendationActionsRef.current.clear();
      const autoStartListening = options?.autoStartListening ?? false;
      systemPromptRef.current = resolvedSystemPrompt;
      userClosingRef.current = false;
      shouldMuteOnConnectRef.current = !autoStartListening;

      if (!activeAgentId && !shouldResolveAgentOnServer) {
        const greeting = contextHint ?? "Listening...";
        if (!isCurrentSession()) return;
        updateVoiceDiagnostic("session_token", "skipped", "Using local fallback voice mode");
        updateVoiceDiagnostic("elevenlabs_session", "skipped", "Using local fallback voice mode");
        replaceTranscript([{ from: "vyva", text: greeting, timestamp: Date.now() }]);
        setIsSpeaking(true);
        setVoiceStatus("connected");
        setIsConnecting(false);
        recordVoiceTimelineEvent({
          kind: "session_connected",
          title: "Fallback voice session connected",
          detail: "No private agent id resolved; using local fallback transcript mode.",
          sessionId: voiceSessionId,
          ...(resolvedDomain ? { domain: resolvedDomain } : {}),
        });
        return;
      }

      try {
        updateVoiceDiagnostic("session_token", "running", "Requesting ElevenLabs signed URL");
        const sessionOptions = await fetchSessionOptions(
          activeAgentId,
          shouldResolveAgentOnServer,
          options,
        );
        updateVoiceDiagnostic("session_token", "passed", "Signed URL received");

        if (!isCurrentSession()) return;

        updateVoiceDiagnostic("elevenlabs_session", "running", "Opening browser voice session");
        const initialSessionOverrides = sessionOverridesForResolvedContext(
          sessionOptions,
          resolvedSystemPrompt,
          resolvedDomain,
          resolvedDynamicVariables,
        );
        const conversation = await Conversation.startSession({
          ...sessionOptions,
          textOnly: skipMicrophone,
          ...(initialSessionOverrides ? { overrides: initialSessionOverrides } : {}),
          dynamicVariables: {
            ...getAgentAppContextVariables(),
            ...resolvedDynamicVariables,
          },
          clientTools: {
            ...(sessionOptions.clientTools ?? {}),
            ...Object.fromEntries(([
              "start_number_memory_round",
              "get_next_number_memory_digit",
              "begin_number_memory_recall",
              "submit_number_memory_answer",
              "number_memory_not_sure",
            ] satisfies NumberMemoryVoiceToolName[]).map((name) => [name, async (parameters: unknown) => {
              const result = await requestNumberMemoryVoiceTool(name, toolParameters(parameters));
              return JSON.stringify(result);
            }])),
            sync_dr_ai_screen: async (parameters: unknown) => {
              const params = toolParameters(parameters);
              const conversationId = toolString(params, "conversation_id") || readVoiceSessionId();
              if (!conversationId) {
                return JSON.stringify({ ok: false, rendered: false, reason: "missing_conversation_id" });
              }
              const rendered = await requestDrAiScreenSync(conversationId);
              return JSON.stringify({
                ok: rendered,
                rendered,
                conversation_id: conversationId,
                ...(rendered ? {} : { reason: "screen_sync_timeout" }),
              });
            },
            open_app_action: async (parameters: unknown) => {
              const params = toolParameters(parameters);
              const homeSubflow = homeSubflowForVoiceToolCall(params);
              if (homeSubflow) {
                emitVoiceHomeSubflow(homeSubflow);
                return toolResultForVoiceHomeSubflow(homeSubflow);
              }
              const homeIntent = homeIntentForVoiceToolCall(params);
              if (homeIntent) {
                emitVoiceHomeIntent(homeIntent);
                return toolResultForVoiceHomeIntent(homeIntent);
              }
              const action = actionForVoiceToolCall(params);
              if (!action) {
                return "App action was not opened because the route, domain, or action type was not recognised.";
              }

              emitVoiceAppAction(action);
              return `Opening ${action.title}.`;
            },
            record_action_result: async (parameters: unknown) => {
              const params = toolParameters(parameters);
              const rawAction = toolString(params, "action");
              if (!["accepted", "dismissed", "completed"].includes(rawAction)) {
                return "Action result was not recorded because action must be accepted, dismissed, or completed.";
              }

              const actionId = toolString(params, "action_id") || toolString(params, "recommendation_id");
              const domain = toolString(params, "domain");
              const safeDomain = isVoiceAppActionDomain(domain) ? domain : undefined;
              const title = toolString(params, "title");
              const reason = toolString(params, "reason");
              const evidence = toolString(params, "evidence").slice(0, 500);

              emitVoiceAppActionResult({
                action: rawAction as VoiceRecommendationFeedbackAction,
                ...(actionId ? { actionId } : {}),
                ...(safeDomain ? { domain: safeDomain } : {}),
                ...(title ? { title } : {}),
                ...(reason ? { reason } : {}),
                ...(evidence ? { evidence } : {}),
                source: "elevenlabs_client_tool",
              });

              const current = activeRecommendationRef.current;
              const recommendationId = actionId || current?.id;
              if (!recommendationId) {
                return "Action result was shared with the app, but no recommendation id was available for analytics.";
              }

              const recorded = await recordRecommendationFeedback(
                rawAction as VoiceRecommendationFeedbackAction,
                {
                  source: "elevenlabs_client_tool",
                  evidence,
                  outcome: toolString(params, "outcome").slice(0, 500),
                  voice_action_id: actionId,
                },
                {
                  id: recommendationId,
                  domain: safeDomain || current?.domain,
                  title: title || current?.title,
                  reason: reason || current?.reason,
                  sessionId: current?.sessionId,
                  conversationId: current?.conversationId,
                  token: current?.token,
                },
              );

              return recorded
                ? `Recorded ${rawAction} result for ${recommendationId}.`
                : "Action result was shared with the app, but analytics could not be recorded.";
            },
            request_specialist_transfer: async (parameters: unknown) => {
              const params = toolParameters(parameters);
              const request = specialistTransferFromToolCall(params);
              if (!request) {
                return "Specialist transfer was not requested because the target domain was not recognised.";
              }

              emitVoiceSpecialistTransfer(request);
              return `Transfer requested to ${request.domain}.`;
            },
            record_voice_recommendation_feedback: async (parameters: unknown) => {
              const params = toolParameters(parameters);
              const rawAction = toolString(params, "action");
              if (!["accepted", "dismissed", "completed"].includes(rawAction)) {
                return "Feedback was not recorded because action must be accepted, dismissed, or completed.";
              }
              const current = activeRecommendationRef.current;
              const recommendationId = toolString(params, "recommendation_id")
                ? toolString(params, "recommendation_id")
                : current?.id;
              if (!recommendationId) return "Feedback was not recorded because no active recommendation was available.";

              const recorded = await recordRecommendationFeedback(
                rawAction as VoiceRecommendationFeedbackAction,
                {
                  source: "elevenlabs_client_tool",
                  evidence: toolString(params, "evidence").slice(0, 500),
                  outcome: toolString(params, "outcome").slice(0, 500),
                },
                {
                  id: recommendationId,
                  domain: toolString(params, "domain") || current?.domain,
                  title: toolString(params, "title") || current?.title,
                  reason: toolString(params, "reason") || current?.reason,
                  sessionId: current?.sessionId,
                  conversationId: current?.conversationId,
                  token: current?.token,
                },
              );
              return recorded
                ? `Recorded ${rawAction} feedback for ${recommendationId}.`
                : "Feedback could not be recorded.";
            },
            record_onboarding_profile_output: async (parameters: unknown) => {
              setOnboardingVoiceLiveDiagnostic((current) => current
                ? {
                    ...current,
                    phase: "tool_received",
                    clientToolReceived: true,
                    lastEvent: "client tool received",
                    updatedAt: Date.now(),
                  }
                : onboardingLiveDiagnosticFromVariables("tool_received", resolvedDynamicVariables, {
                    agentSlug: options?.agentSlug,
                    connected: true,
                    starterSent: true,
                    clientToolReceived: true,
                    lastEvent: "client tool received",
                  }));
              const result = dispatchOnboardingElevenLabsOutput(parameters);
              return result.ok
                ? `Onboarding ${result.event.type} was shared with the app for local review.`
                : `Onboarding output was rejected: ${result.reason}`;
            },
          },
          onConversationCreated: (createdConversation) => {
            if (!isCurrentSession()) {
              void createdConversation.endSession().catch(() => {});
              return;
            }

            conversationRef.current = createdConversation;
            if (!skipMicrophone && shouldMuteOnConnectRef.current) {
              createdConversation.setMicMuted(true);
            }
          },
          onConnect: () => {
            if (!isCurrentSession()) return;

            updateVoiceDiagnostic("elevenlabs_session", "passed", "Voice session connected");
            setVoiceStatus("connected");
            setIsConnecting(false);
            setHasMicrophone(!skipMicrophone);
            setIsMicMuted(skipMicrophone ? true : !autoStartListening);
            setIsTransferring(false);
            transferPendingRef.current = false;
            if (resolvedDomain === "onboarding_profile") {
              setOnboardingVoiceLiveDiagnostic((current) => ({
                ...onboardingLiveDiagnosticFromVariables("connected", resolvedDynamicVariables, {
                  agentSlug: options?.agentSlug,
                  connected: true,
                  lastEvent: "ElevenLabs connected",
                }),
                ...current,
                phase: "connected",
                connected: true,
                lastEvent: "ElevenLabs connected",
                updatedAt: Date.now(),
              }));
            }
            if (resolvedSystemPrompt?.trim()) {
              try {
                conversationRef.current?.sendContextualUpdate(resolvedSystemPrompt);
              } catch (error) {
                console.warn("[VYVA] Failed to send initial voice context:", error);
              }
            }
            if (resolvedDomain === "onboarding_profile") {
              const starterMessage = onboardingStarterUserMessage(resolvedDynamicVariables);
              try {
                hiddenOutgoingMessagesRef.current.push(normalizeTranscriptText(starterMessage));
                conversationRef.current?.sendUserMessage(starterMessage);
                conversationRef.current?.sendUserActivity();
                setOnboardingVoiceLiveDiagnostic((current) => ({
                  ...onboardingLiveDiagnosticFromVariables("starter_sent", resolvedDynamicVariables, {
                    agentSlug: options?.agentSlug,
                    connected: true,
                    starterSent: true,
                    lastEvent: "starter sent",
                  }),
                  ...current,
                  phase: "starter_sent",
                  connected: true,
                  starterSent: true,
                  lastEvent: "starter sent",
                  updatedAt: Date.now(),
                }));
              } catch (error) {
                hiddenOutgoingMessagesRef.current = hiddenOutgoingMessagesRef.current.filter(
                  (entry) => entry !== normalizeTranscriptText(starterMessage),
                );
                console.warn("[VYVA] Failed to send onboarding voice starter:", error);
              }
            }
            recordVoiceTimelineEvent({
              kind: "session_connected",
              title: "Voice session connected",
              detail: skipMicrophone ? "Connected in text-only mode" : autoStartListening ? "Microphone opened for listening" : "Connected with microphone muted",
              sessionId: voiceSessionId,
              ...(resolvedDomain ? { domain: resolvedDomain } : {}),
              ...(activeAgentId ? { agentId: activeAgentId } : {}),
              ...(options?.agentSlug ? { agentSlug: options.agentSlug } : {}),
            });
            if (!skipMicrophone && autoStartListening) {
              setIsUserSpeaking(true);
            }
          },
          onDisconnect: (details) => {
            if (!isCurrentSession()) return;

            const message = formatDisconnectDetails(details);
            conversationRef.current = null;
            releaseVoiceInstance(voiceInstanceIdRef.current);
            setVoiceStatus("idle");
            setIsConnecting(false);
            setIsSpeaking(false);
            setIsUserSpeaking(false);
            setIsMicMuted(true);
            setHasMicrophone(false);
            setHasEnded(true);
            setIsTransferring(false);
            transferPendingRef.current = false;
            if (!userClosingRef.current && message) {
              console.warn("[VYVA] Voice session closed:", details);
              setLastError(message);
              setLastErrorCode("VOICE_SESSION_CLOSED");
              if (resolvedDomain === "onboarding_profile") {
                setOnboardingVoiceLiveDiagnostic((current) => ({
                  ...onboardingLiveDiagnosticFromVariables("error", resolvedDynamicVariables, {
                    agentSlug: options?.agentSlug,
                    error: message,
                    lastEvent: "session closed",
                  }),
                  ...current,
                  phase: "error",
                  error: message,
                  lastEvent: "session closed",
                  updatedAt: Date.now(),
                }));
              }
              markVoiceDiagnosticFailure("VOICE_SESSION_CLOSED", message);
              recordVoiceTimelineEvent({
                kind: "session_error",
                title: "Voice session closed unexpectedly",
                detail: message,
                sessionId: voiceSessionId,
                ...(resolvedDomain ? { domain: resolvedDomain } : {}),
              });
            } else {
              recordVoiceTimelineEvent({
                kind: "session_ended",
                title: "Voice session ended",
                detail: "Conversation disconnected",
                sessionId: voiceSessionId,
                ...(resolvedDomain ? { domain: resolvedDomain } : {}),
              });
            }
            userClosingRef.current = false;
          },
          onError: (message, context) => {
            if (!isCurrentSession()) return;

            console.error("[VYVA] Voice session error:", message, context);
            setLastError(message);
            setLastErrorCode("VOICE_SESSION_ERROR");
            if (resolvedDomain === "onboarding_profile") {
              setOnboardingVoiceLiveDiagnostic((current) => ({
                ...onboardingLiveDiagnosticFromVariables("error", resolvedDynamicVariables, {
                  agentSlug: options?.agentSlug,
                  error: message,
                  lastEvent: "session error",
                }),
                ...current,
                phase: "error",
                error: message,
                lastEvent: "session error",
                updatedAt: Date.now(),
              }));
            }
            markVoiceDiagnosticFailure("VOICE_SESSION_ERROR", message);
            setIsTransferring(false);
            transferPendingRef.current = false;
            recordVoiceTimelineEvent({
              kind: "session_error",
              title: "Voice session error",
              detail: message,
              sessionId: voiceSessionId,
              ...(resolvedDomain ? { domain: resolvedDomain } : {}),
            });
          },
          onStatusChange: ({ status }) => {
            if (!isCurrentSession()) return;

            if (status === "connecting") {
              setIsConnecting(true);
              setVoiceStatus("connecting");
            } else if (status === "connected") {
              setIsConnecting(false);
              setVoiceStatus("connected");
            } else if (status === "disconnected") {
              setIsConnecting(false);
              setVoiceStatus("idle");
            }
          },
          onModeChange: ({ mode }) => {
            if (!isCurrentSession()) return;
            setIsSpeaking(mode === "speaking");
          },
          onInterruption: () => {
            if (!isCurrentSession()) return;
            setIsSpeaking(false);
          },
          onMessage: (payload) => {
            if (!isCurrentSession()) return;
            const message = textFromUnknown(payload);
            if (!message?.trim()) return;
            if (isUserVoiceMessage(payload)) {
              const transcriptPhase = userVoiceTranscriptPhase(payload);
              const providerEventId = userVoiceProviderEventId(payload);
              const normalized = normalizeTranscriptText(message);
              const hiddenIndex = hiddenOutgoingMessagesRef.current.findIndex((entry) => entry === normalized);
              if (hiddenIndex !== -1) {
                hiddenOutgoingMessagesRef.current.splice(hiddenIndex, 1);
                return;
              }
              if (transcriptPhase === "tentative") {
                if (providerEventId) {
                  rememberUserVoiceUtteranceCorrelation(
                    userVoiceUtteranceCorrelationsRef.current,
                    providerEventId,
                    {
                      voiceUtteranceId: providerVoiceUtteranceId(voiceSessionId, providerEventId),
                      canvasProvenance: readActiveVoiceCanvasSceneProvenance(),
                      createdAt: Date.now(),
                    },
                  );
                }
                return;
              }
              const correlation = providerEventId
                ? userVoiceUtteranceCorrelationsRef.current.get(providerEventId) ?? null
                : null;
              userVoiceUtteranceSequenceRef.current += 1;
              const voiceUtteranceId = correlation?.voiceUtteranceId
                ?? (providerEventId
                  ? providerVoiceUtteranceId(voiceSessionId, providerEventId)
                  : localVoiceUtteranceId(voiceSessionId, userVoiceUtteranceSequenceRef.current));
              const transcriptEntry = { from: "user" as const, text: message, timestamp: Date.now() };
              appendTranscript(transcriptEntry);
              const inferredAction = inferRecommendationFeedbackAction(message);
              if (inferredAction) {
                void recordRecommendationFeedback(inferredAction, {
                  source: "frontend_transcript",
                  user_message_preview: message.slice(0, 160),
                });
              }
              emitVoiceUserMessage({
                text: message,
                transcriptEntry,
                at: new Date(transcriptEntry.timestamp).toISOString(),
                voiceUtteranceId,
                canvasProvenance: correlation?.canvasProvenance ?? null,
                allowCanvasProvenanceFallback: false,
              });
              return;
            }
            streamingVyvaTranscriptRef.current = "";
            streamingVyvaTranscriptShouldAppendRef.current = false;
            upsertLatestVyvaTranscript(message);
          },
          onAgentChatResponsePart: (part) => {
            if (!isCurrentSession()) return;
            handleVyvaTranscriptPart(part);
          },
          onDebug: (payload) => {
            if (!isCurrentSession() || !isAgentVoiceDebugEvent(payload)) return;
            const record = asRecord(payload);
            if (record?.text_response_part) {
              handleVyvaTranscriptPart(record.text_response_part);
              return;
            }
            const message = textFromUnknown(payload);
            if (!message) return;
            streamingVyvaTranscriptRef.current = "";
            streamingVyvaTranscriptShouldAppendRef.current = false;
            upsertLatestVyvaTranscript(message);
          },
        });

        if (!isCurrentSession()) {
          void conversation.endSession().catch(() => {});
          return;
        }

        conversationRef.current = conversation;
      } catch (err) {
        if (!isCurrentSession()) return;

        console.error("[VYVA] Failed to start session:", err);
        const detail = err instanceof Error ? err.message : "Unable to start voice session";
        const errorCode = voiceConnectionErrorCode(err, "VOICE_SESSION_START_FAILED");
        setLastError(detail);
        setLastErrorCode(errorCode);
        if (resolvedDomain === "onboarding_profile") {
          setOnboardingVoiceLiveDiagnostic((current) => ({
            ...onboardingLiveDiagnosticFromVariables("error", resolvedDynamicVariables, {
              agentSlug: options?.agentSlug,
              error: detail,
              lastEvent: "session start failed",
            }),
            ...current,
            phase: "error",
            error: detail,
            lastEvent: "session start failed",
            updatedAt: Date.now(),
          }));
        }
        markVoiceDiagnosticFailure(errorCode, detail);
        setVoiceStatus("idle");
        setIsConnecting(false);
        setIsMicMuted(true);
        setIsTransferring(false);
        transferPendingRef.current = false;
        recordVoiceTimelineEvent({
          kind: "session_error",
          title: "Voice session failed to start",
          detail,
          sessionId: voiceSessionId,
          ...(resolvedDomain ? { domain: resolvedDomain } : {}),
        });
        releaseVoiceInstance(voiceInstanceIdRef.current);
        teardown();
      }
    },
    [appendTranscript, checkVoiceReadiness, fetchSessionOptions, handleVyvaTranscriptPart, markVoiceDiagnosticFailure, recordRecommendationFeedback, replaceTranscript, resolveRouterSession, setVoicePreparing, setVoiceStatus, teardown, updateVoiceDiagnostic, upsertLatestVyvaTranscript]
  );

  const beginUserTurn = useCallback(async () => {
    if (statusRef.current !== "connected" || !conversationRef.current) return false;
    conversationRef.current.setMicMuted(false);
    setIsMicMuted(false);
    setIsUserSpeaking(true);
    recordVoiceTimelineEvent({
      kind: "mic_unmuted",
      title: "Microphone unmuted",
      detail: "User turn started",
      sessionId: getVoiceSessionId(),
    });
    return true;
  }, []);

  const endUserTurn = useCallback(() => {
    conversationRef.current?.setMicMuted(true);
    setIsMicMuted(true);
    setIsUserSpeaking(false);
    recordVoiceTimelineEvent({
      kind: "mic_muted",
      title: "Microphone muted",
      detail: "User turn ended",
      sessionId: getVoiceSessionId(),
    });
  }, []);

  const setMicrophoneMuted = useCallback((muted: boolean) => {
    if (statusRef.current !== "connected" || !conversationRef.current) return false;
    conversationRef.current.setMicMuted(muted);
    setIsMicMuted(muted);
    setIsUserSpeaking(!muted);
    recordVoiceTimelineEvent({
      kind: muted ? "mic_muted" : "mic_unmuted",
      title: muted ? "Microphone muted" : "Microphone unmuted",
      detail: "Manual voice overlay control",
      sessionId: getVoiceSessionId(),
    });
    return true;
  }, []);

  const beginVoiceTransfer = useCallback(() => {
    transferPendingRef.current = true;
    setIsTransferring(true);
    setHasEnded(false);
    recordVoiceTimelineEvent({
      kind: "transfer_requested",
      title: "Voice transfer started",
      detail: "Current session is stopping before specialist starts.",
      sessionId: getVoiceSessionId(),
    });
  }, []);

  const stopVoice = useCallback(() => {
    userClosingRef.current = true;
    teardown();
    userClosingRef.current = false;
    releaseVoiceInstance(voiceInstanceIdRef.current);
    setVoiceStatus("idle");
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setIsMicMuted(true);
    setHasEnded(true);
    if (!transferPendingRef.current) {
      setIsTransferring(false);
    }
    setLastError(null);
    setLastErrorCode(null);
    systemPromptRef.current = undefined;
    recordVoiceTimelineEvent({
      kind: "session_ended",
      title: "Voice session stopped",
      detail: transferPendingRef.current ? "Stopped for specialist transfer" : "Stopped by user or app",
      sessionId: getVoiceSessionId(),
    });
  }, [setVoiceStatus, teardown]);

  const sendText = useCallback(
    (text: string, options?: SendTextOptions) => {
      const trimmed = text.trim();
      if (!trimmed || statusRef.current !== "connected" || !conversationRef.current) {
        return false;
      }

      if (options?.invisibleInTranscript) {
        hiddenOutgoingMessagesRef.current.push(normalizeTranscriptText(trimmed));
      }

      conversationRef.current.sendUserMessage(trimmed);
      return true;
    },
    []
  );

  const sendContextUpdate = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || statusRef.current !== "connected" || !conversationRef.current) {
        return false;
      }

      conversationRef.current.sendContextualUpdate(trimmed);
      return true;
    },
    []
  );

  const voiceSessionPhase: VoiceSessionPhase = deriveVoiceSessionPhase({
    status,
    isConnecting,
    isSpeaking,
    isMicMuted,
    isTransferring,
    hasEnded,
    hasError: Boolean(lastError),
  });

  return {
    startVoice,
    stopVoice,
    sendText,
    sendUserMessage: sendText,
    sendContextUpdate,
    status,
    isSpeaking,
    isUserSpeaking,
    isMicMuted,
    isTransferring,
    voiceSessionPhase,
    isPreparing,
    isConnecting,
    hasMicrophone,
    lastError,
    lastErrorCode,
    voiceDiagnostics,
    onboardingVoiceLiveDiagnostic,
    transcript,
    lastResolvedSessionContext,
    systemPromptRef,
    beginUserTurn,
    endUserTurn,
    setMicrophoneMuted,
    beginVoiceTransfer,
    interruptAgentAudio,
    recordRecommendationFeedback,
  };
}

type VyvaVoiceController = ReturnType<typeof useVyvaVoiceController>;

const VyvaVoiceContext = createContext<VyvaVoiceController | null>(null);

export function VyvaVoiceProvider({ children }: { children: ReactNode }) {
  const controller = useVyvaVoiceController();
  return createElement(VyvaVoiceContext.Provider, { value: controller }, children);
}

export function useVyvaVoice() {
  const context = useContext(VyvaVoiceContext);
  if (!context) {
    throw new Error("useVyvaVoice must be used inside VyvaVoiceProvider");
  }
  return context;
}

export function useOptionalVyvaVoice() {
  return useContext(VyvaVoiceContext);
}
