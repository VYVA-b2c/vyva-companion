import { useState, useCallback, useRef, useEffect } from "react";
import { Conversation } from "@elevenlabs/client";
import type { Conversation as ElevenConversation, DisconnectionDetails, PartialOptions } from "@elevenlabs/client";
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
  const userClosingRef = useRef(false);
  const shouldMuteOnConnectRef = useRef(true);
  const hiddenOutgoingMessagesRef = useRef<string[]>([]);

  const setVoiceStatus = useCallback((nextStatus: "idle" | "connecting" | "connected") => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
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
          } catch {}
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
        console.warn("[VYVA] Token fetch failed, trying public connection:", err);
        return { agentId: activeAgentId, connectionType: "websocket" };
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
      setTranscript([]);
      setLastError(null);
      setHasMicrophone(false);
      systemPromptRef.current = systemPrompt;
      const shouldResolveAgentOnServer = Boolean(options?.agentSlug || options?.roomSlug);
      const activeAgentId = options?.agentId ?? (shouldResolveAgentOnServer ? undefined : VYVA_AGENT_ID);
      const skipMicrophone = options?.skipMicrophone ?? false;
      const autoStartListening = options?.autoStartListening ?? false;
      userClosingRef.current = false;
      shouldMuteOnConnectRef.current = !autoStartListening;

      if (!activeAgentId && !shouldResolveAgentOnServer) {
        const greeting = contextHint ?? "Listening...";
        setTranscript([{ from: "vyva", text: greeting, timestamp: Date.now() }]);
        setIsSpeaking(true);
        setVoiceStatus("connected");
        setIsConnecting(false);
        return;
      }

      try {
        const sessionOptions = await fetchSessionOptions(
          activeAgentId,
          shouldResolveAgentOnServer,
          systemPrompt,
          options,
        );

        const conversation = await Conversation.startSession({
          ...sessionOptions,
          textOnly: skipMicrophone,
          dynamicVariables: options?.dynamicVariables,
          overrides: systemPrompt
            ? { agent: { prompt: { prompt: systemPrompt } } }
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
              setTranscript((p) => [...p, { from: "user", text: message, timestamp: Date.now() }]);
              return;
            }
            setTranscript((p) => [...p, { from: "vyva", text: message, timestamp: Date.now() }]);
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
    [fetchSessionOptions, setVoiceStatus, teardown]
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
