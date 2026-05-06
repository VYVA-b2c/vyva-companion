import { useState, useCallback, useRef, useEffect } from "react";
import { Conversation } from "@elevenlabs/client";
import type { Conversation as ElevenConversation, DisconnectionDetails, PartialOptions } from "@elevenlabs/client";
import { getToken } from "@/lib/auth";
import { apiFetch } from "@/lib/queryClient";

type TtsSegment = {
  text: string;
  lang?: string;
  rate?: number;
  delayMs?: number;
};

export function useTtsReadout() {
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const timeoutIdsRef = useRef<number[]>([]);

  const clearPendingTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
  }, []);

  const stopTts = useCallback(() => {
    clearPendingTimeouts();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsTtsSpeaking(false);
  }, [clearPendingTimeouts]);

  const speakSequence = useCallback((segments: TtsSegment[]) => {
    if (!window.speechSynthesis) return;
    stopTts();

    const queue = segments.filter((segment) => segment.text.trim().length > 0);
    if (queue.length === 0) return;

    let index = 0;
    const playNext = () => {
      const segment = queue[index];
      if (!segment) {
        setIsTtsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      if (segment.lang) utterance.lang = segment.lang;
      utterance.rate = segment.rate ?? 0.9;
      utterance.onstart = () => setIsTtsSpeaking(true);
      utterance.onend = () => {
        index += 1;
        const timeoutId = window.setTimeout(playNext, segment.delayMs ?? 400);
        timeoutIdsRef.current.push(timeoutId);
      };
      utterance.onerror = () => {
        index += 1;
        if (index >= queue.length) {
          setIsTtsSpeaking(false);
          return;
        }
        const timeoutId = window.setTimeout(playNext, 250);
        timeoutIdsRef.current.push(timeoutId);
      };
      window.speechSynthesis.speak(utterance);
    };

    playNext();
  }, [stopTts]);

  const speakText = useCallback((text: string, lang?: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    speakSequence([{ text, lang }]);
  }, [speakSequence]);

  return { speakText, speakSequence, stopTts, isTtsSpeaking };
}

export interface TranscriptEntry {
  from: "user" | "vyva";
  text: string;
  timestamp: number;
}

type StartVoiceOptions = {
  agentId?: string;
  agentSlug?: string;
  roomSlug?: string;
  skipMicrophone?: boolean;
  autoStartListening?: boolean;
  dynamicVariables?: Record<string, string | number | boolean>;
};

type SendTextOptions = {
  invisibleInTranscript?: boolean;
};

const VYVA_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? "agent_0401knfndsypfmqa31ssw82h364m";
const FALLBACK_USER_ID = "vyva-local-user";
const VOICE_SESSION_STORAGE_KEY = "vyva.voice.sessionId";
const ALLOW_PUBLIC_AGENT_FALLBACK =
  import.meta.env.DEV && import.meta.env.VITE_ELEVENLABS_ALLOW_PUBLIC_FALLBACK === "true";

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

function normalizeTranscriptText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatDisconnectDetails(details: DisconnectionDetails) {
  if (details.reason === "user") return null;

  const closeCode = "closeCode" in details && details.closeCode ? ` code ${details.closeCode}` : "";
  const closeReason = "closeReason" in details && details.closeReason ? `: ${details.closeReason}` : "";
  const message = details.reason === "error" ? details.message : "Agent ended the session";
  return `Voice session closed (${details.reason}${closeCode})${closeReason}. ${message}`;
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
  try {
    const existing = sessionStorage.getItem(VOICE_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(VOICE_SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function transcriptToHistory(transcript: TranscriptEntry[]): ConversationTurn[] {
  return transcript.slice(-12).map((entry) => ({
    role: entry.from === "user" ? "user" : "assistant",
    content: entry.text,
  }));
}

function inferVoiceContextDomain(options: StartVoiceOptions | undefined) {
  const agentSlug = options?.agentSlug?.trim().toLowerCase();
  if (agentSlug === "doctor" || agentSlug === "medical-doctor") return "doctor";
  if (options?.roomSlug || agentSlug) return "social";
  return undefined;
}

export function useVyvaVoice() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const systemPromptRef = useRef<string | undefined>(undefined);
  const statusRef = useRef<"idle" | "connecting" | "connected">("idle");
  const conversationRef = useRef<ElevenConversation | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const userClosingRef = useRef(false);
  const shouldMuteOnConnectRef = useRef(true);
  const hiddenOutgoingMessagesRef = useRef<string[]>([]);

  const setVoiceStatus = useCallback((nextStatus: "idle" | "connecting" | "connected") => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
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

  const interruptAgentAudio = useCallback(() => {
    setIsSpeaking(false);
  }, []);

  const teardown = useCallback(() => {
    const conversation = conversationRef.current;
    conversationRef.current = null;
    if (conversation) {
      void conversation.endSession().catch(() => {});
    }
    hiddenOutgoingMessagesRef.current = [];
    setHasMicrophone(false);
    setIsSpeaking(false);
    setIsUserSpeaking(false);
  }, []);

  useEffect(() => () => { teardown(); }, [teardown]);

  const fetchSessionOptions = useCallback(
    async (
      activeAgentId: string | undefined,
      shouldResolveAgentOnServer: boolean,
      systemPrompt: string | undefined,
      options: StartVoiceOptions | undefined,
    ): Promise<PartialOptions> => {
      try {
        const res = await apiFetch("/api/elevenlabs-conversation-token", {
          method: "POST",
          body: JSON.stringify({
            ...(activeAgentId ? { agent_id: activeAgentId } : {}),
            ...(options?.agentSlug ? { agent_slug: options.agentSlug } : {}),
            ...(options?.roomSlug ? { room_slug: options.roomSlug } : {}),
            ...(systemPrompt ? { prompt_override: systemPrompt } : {}),
          }),
        });
        if (!res.ok) {
          const errorText = await res.text();
          let message = errorText || "token fetch failed";
          try {
            const parsed = JSON.parse(errorText) as {
              error?: string;
              detail?: string;
              expected_keys?: string[];
            };
            message = parsed.error || parsed.detail || message;
            if (parsed.expected_keys?.[0]) {
              message = `${message} (${parsed.expected_keys[0]})`;
            }
          } catch {
            // Keep the raw response text when the server did not return JSON.
          }
          throw new Error(message);
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

  const resolveRouterSession = useCallback(
    async (
      contextHint: string | undefined,
      currentSystemPrompt: string | undefined,
      options: StartVoiceOptions | undefined,
    ) => {
      if (options?.agentId || options?.agentSlug || options?.roomSlug) {
        let sharedDynamicVariables: Record<string, string | number | boolean> = {};
        try {
          const res = await apiFetch("/api/voice-context", {
            method: "POST",
            body: JSON.stringify({
              domain: inferVoiceContextDomain(options),
              ...(contextHint ? { memory_query: contextHint } : {}),
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
      if (statusRef.current !== "idle") return;
      setIsConnecting(true);
      setVoiceStatus("connecting");
      replaceTranscript([]);
      setLastError(null);
      setHasMicrophone(false);
      const shouldResolveAgentOnServer = Boolean(options?.agentSlug || options?.roomSlug);
      const routedSession = await resolveRouterSession(contextHint, systemPrompt, options);
      const activeAgentId = routedSession.agentId ?? (shouldResolveAgentOnServer ? undefined : VYVA_AGENT_ID);
      const resolvedSystemPrompt = routedSession.systemPrompt;
      const skipMicrophone = options?.skipMicrophone ?? false;
      const autoStartListening = options?.autoStartListening ?? false;
      systemPromptRef.current = resolvedSystemPrompt;
      userClosingRef.current = false;
      shouldMuteOnConnectRef.current = !autoStartListening;

      if (!activeAgentId && !shouldResolveAgentOnServer) {
        const greeting = contextHint ?? "Listening...";
        replaceTranscript([{ from: "vyva", text: greeting, timestamp: Date.now() }]);
        setIsSpeaking(true);
        setVoiceStatus("connected");
        setIsConnecting(false);
        return;
      }

      try {
        const sessionOptions = await fetchSessionOptions(
          activeAgentId,
          shouldResolveAgentOnServer,
          resolvedSystemPrompt,
          options,
        );

        const conversation = await Conversation.startSession({
          ...sessionOptions,
          textOnly: skipMicrophone,
          dynamicVariables: routedSession.dynamicVariables,
          overrides: resolvedSystemPrompt
            ? { agent: { prompt: { prompt: resolvedSystemPrompt } } }
            : undefined,
          onConversationCreated: (createdConversation) => {
            conversationRef.current = createdConversation;
            if (!skipMicrophone && shouldMuteOnConnectRef.current) {
              createdConversation.setMicMuted(true);
            }
          },
          onConnect: () => {
            setVoiceStatus("connected");
            setIsConnecting(false);
            setHasMicrophone(!skipMicrophone);
            if (!skipMicrophone && autoStartListening) {
              setIsUserSpeaking(true);
            }
          },
          onDisconnect: (details) => {
            const message = formatDisconnectDetails(details);
            conversationRef.current = null;
            setVoiceStatus("idle");
            setIsConnecting(false);
            setIsSpeaking(false);
            setIsUserSpeaking(false);
            setHasMicrophone(false);
            if (!userClosingRef.current && message) {
              console.warn("[VYVA] Voice session closed:", details);
              setLastError(message);
            }
            userClosingRef.current = false;
          },
          onError: (message, context) => {
            console.error("[VYVA] Voice session error:", message, context);
            setLastError(message);
          },
          onStatusChange: ({ status }) => {
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
            setIsSpeaking(mode === "speaking");
          },
          onInterruption: () => {
            setIsSpeaking(false);
          },
          onMessage: ({ role, source, message }) => {
            if (!message?.trim()) return;
            if (role === "user" || source === "user") {
              const normalized = normalizeTranscriptText(message);
              const hiddenIndex = hiddenOutgoingMessagesRef.current.findIndex((entry) => entry === normalized);
              if (hiddenIndex !== -1) {
                hiddenOutgoingMessagesRef.current.splice(hiddenIndex, 1);
                return;
              }
              appendTranscript({ from: "user", text: message, timestamp: Date.now() });
              return;
            }
            appendTranscript({ from: "vyva", text: message, timestamp: Date.now() });
          },
        });

        conversationRef.current = conversation;
      } catch (err) {
        console.error("[VYVA] Failed to start session:", err);
        setLastError(err instanceof Error ? err.message : "Unable to start voice session");
        setVoiceStatus("idle");
        setIsConnecting(false);
        teardown();
      }
    },
    [appendTranscript, fetchSessionOptions, replaceTranscript, resolveRouterSession, setVoiceStatus, teardown]
  );

  const beginUserTurn = useCallback(async () => {
    if (statusRef.current !== "connected" || !conversationRef.current) return false;
    conversationRef.current.setMicMuted(false);
    setIsUserSpeaking(true);
    return true;
  }, []);

  const endUserTurn = useCallback(() => {
    conversationRef.current?.setMicMuted(true);
    setIsUserSpeaking(false);
  }, []);

  const stopVoice = useCallback(() => {
    userClosingRef.current = true;
    teardown();
    setVoiceStatus("idle");
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setLastError(null);
    systemPromptRef.current = undefined;
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

  return {
    startVoice,
    stopVoice,
    sendText,
    sendContextUpdate,
    status,
    isSpeaking,
    isUserSpeaking,
    isConnecting,
    hasMicrophone,
    lastError,
    transcript,
    systemPromptRef,
    beginUserTurn,
    endUserTurn,
    interruptAgentAudio,
  };
}
