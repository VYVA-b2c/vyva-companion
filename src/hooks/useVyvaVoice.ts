import { useState, useCallback, useRef, useEffect } from "react";
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
  skipMicrophone?: boolean;
};

type SendTextOptions = {
  invisibleInTranscript?: boolean;
};

const VYVA_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? "agent_0401knfndsypfmqa31ssw82h364m";

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function float32ToInt16Bytes(f32: Float32Array): Uint8Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return new Uint8Array(i16.buffer);
}

function int16BytesToFloat32(bytes: Uint8Array): Float32Array {
  const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x7fff;
  return f32;
}

function normalizeTranscriptText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function useVyvaVoice() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const systemPromptRef = useRef<string | undefined>(undefined);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const pendingChunksRef = useRef<number>(0);
  const outputSampleRateRef = useRef<number>(16000);
  const isUserStreamingRef = useRef(false);
  const playbackNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const hiddenOutgoingMessagesRef = useRef<string[]>([]);

  const interruptAgentAudio = useCallback(() => {
    playbackNodesRef.current.forEach((node) => {
      try {
        node.onended = null;
        node.stop();
      } catch {}
    });
    playbackNodesRef.current = [];
    pendingChunksRef.current = 0;
    setIsSpeaking(false);
    if (audioCtxRef.current) {
      nextPlayTimeRef.current = audioCtxRef.current.currentTime;
    }
  }, []);

  const teardown = useCallback(() => {
    interruptAgentAudio();
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (wsRef.current.readyState < WebSocket.CLOSING) wsRef.current.close();
      wsRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
      micGainRef.current?.disconnect();
      srcRef.current?.disconnect();
    } catch {}
    processorRef.current = null;
    micGainRef.current = null;
    srcRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
    pendingChunksRef.current = 0;
    isUserStreamingRef.current = false;
    hiddenOutgoingMessagesRef.current = [];
    setIsUserSpeaking(false);
  }, [interruptAgentAudio]);

  useEffect(() => () => { teardown(); }, [teardown]);

  const startVoice = useCallback(
    async (
      contextHint?: string,
      systemPrompt?: string,
      options?: StartVoiceOptions,
    ) => {
      if (status !== "idle") return;
      setIsConnecting(true);
      setStatus("connecting");
      setTranscript([]);
      systemPromptRef.current = systemPrompt;
      const activeAgentId = options?.agentId ?? VYVA_AGENT_ID;
      const skipMicrophone = options?.skipMicrophone ?? false;

      if (!activeAgentId) {
        const greeting = contextHint ?? "Listening...";
        setTranscript([{ from: "vyva", text: greeting, timestamp: Date.now() }]);
        setIsSpeaking(true);
        setStatus("connected");
        setIsConnecting(false);
        return;
      }

      try {
        const stream = skipMicrophone ? null : await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;

        let wsUrl: string;
        try {
          const res = await apiFetch("/api/elevenlabs-conversation-token", {
            method: "POST",
            body: JSON.stringify({
              agent_id: activeAgentId,
              ...(systemPrompt ? { prompt_override: systemPrompt } : {}),
            }),
          });
          if (!res.ok) throw new Error("token fetch failed");
          const data = (await res.json()) as { signed_url?: string; token?: string };
          if (data.signed_url) {
            wsUrl = data.signed_url;
          } else if (data.token) {
            wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${activeAgentId}&token=${data.token}`;
          } else {
            throw new Error("no URL or token");
          }
        } catch (err) {
          console.warn("[VYVA] Token fetch failed, trying public connection:", err);
          wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${activeAgentId}`;
        }

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "conversation_initiation_client_data",
              conversation_config_override: { tts: { encoding: "pcm_16000" } },
            })
          );

          if (stream) {
            const src = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(2048, 1, 1);
            const micGain = audioCtx.createGain();
            micGain.gain.value = 0;

            processor.onaudioprocess = (e) => {
              if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !isUserStreamingRef.current) return;
              const f32 = e.inputBuffer.getChannelData(0);
              const bytes = float32ToInt16Bytes(f32);
              wsRef.current.send(JSON.stringify({ user_audio_chunk: uint8ToBase64(bytes) }));
            };

            src.connect(processor);
            processor.connect(micGain);
            micGain.connect(audioCtx.destination);
            srcRef.current = src;
            processorRef.current = processor;
            micGainRef.current = micGain;
          }
        };

        ws.onmessage = (event) => {
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(event.data as string);
          } catch {
            return;
          }

          switch (msg.type) {
            case "conversation_initiation_metadata": {
              const meta = msg.conversation_initiation_metadata_event as Record<string, unknown> | undefined;
              const fmt = meta?.agent_output_audio_format as string | undefined;
              const match = fmt?.match(/(\d+)$/);
              outputSampleRateRef.current = match ? parseInt(match[1]) : 16000;
              nextPlayTimeRef.current = audioCtxRef.current?.currentTime ?? 0;
              setStatus("connected");
              setIsConnecting(false);
              break;
            }

            case "audio": {
              const ev = msg.audio_event as Record<string, unknown> | undefined;
              const b64 = ev?.audio_base_64 as string | undefined;
              if (!b64 || !audioCtxRef.current) break;

              if (audioCtxRef.current.state === "suspended") {
                void audioCtxRef.current.resume().catch(() => {});
              }

              setIsSpeaking(true);
              pendingChunksRef.current++;

              const pcmBytes = base64ToUint8(b64);
              const f32 = int16BytesToFloat32(pcmBytes);
              const sr = outputSampleRateRef.current;
              const buf = audioCtxRef.current.createBuffer(1, f32.length, sr);
              buf.copyToChannel(f32, 0);

              const node = audioCtxRef.current.createBufferSource();
              node.buffer = buf;
              node.connect(audioCtxRef.current.destination);
              playbackNodesRef.current.push(node);

              const startAt = Math.max(audioCtxRef.current.currentTime, nextPlayTimeRef.current);
              node.start(startAt);
              nextPlayTimeRef.current = startAt + buf.duration;

              node.onended = () => {
                playbackNodesRef.current = playbackNodesRef.current.filter((entry) => entry !== node);
                pendingChunksRef.current = Math.max(0, pendingChunksRef.current - 1);
                if (pendingChunksRef.current === 0) setIsSpeaking(false);
              };
              break;
            }

            case "agent_response": {
              const ev = msg.agent_response_event as Record<string, unknown> | undefined;
              const text = ev?.agent_response as string | undefined;
              if (text) setTranscript((p) => [...p, { from: "vyva", text, timestamp: Date.now() }]);
              break;
            }

            case "user_transcript": {
              const ev = msg.user_transcription_event as Record<string, unknown> | undefined;
              const text = ev?.user_transcript as string | undefined;
              if (text) {
                const normalized = normalizeTranscriptText(text);
                const hiddenIndex = hiddenOutgoingMessagesRef.current.findIndex((entry) => entry === normalized);
                if (hiddenIndex !== -1) {
                  hiddenOutgoingMessagesRef.current.splice(hiddenIndex, 1);
                  break;
                }
                setTranscript((p) => [...p, { from: "user", text, timestamp: Date.now() }]);
              }
              break;
            }

            case "interruption": {
              interruptAgentAudio();
              break;
            }

            case "ping": {
              const ev = msg.ping_event as Record<string, unknown> | undefined;
              wsRef.current?.send(JSON.stringify({ type: "pong", event_id: ev?.event_id }));
              break;
            }

            default:
              break;
          }
        };

        ws.onerror = () => {
          setStatus("idle");
          setIsConnecting(false);
          setIsSpeaking(false);
          teardown();
        };

        ws.onclose = () => {
          setStatus("idle");
          setIsSpeaking(false);
          teardown();
        };
      } catch (err) {
        console.error("[VYVA] Failed to start session:", err);
        setStatus("idle");
        setIsConnecting(false);
        teardown();
      }
    },
    [status, teardown, interruptAgentAudio]
  );

  const beginUserTurn = useCallback(async () => {
    if (status !== "connected" || !audioCtxRef.current) return false;
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    interruptAgentAudio();
    isUserStreamingRef.current = true;
    setIsUserSpeaking(true);
    return true;
  }, [interruptAgentAudio, status]);

  const endUserTurn = useCallback(() => {
    isUserStreamingRef.current = false;
    setIsUserSpeaking(false);
  }, []);

  const stopVoice = useCallback(() => {
    teardown();
    setStatus("idle");
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    systemPromptRef.current = undefined;
  }, [teardown]);

  const sendText = useCallback(
    (text: string, options?: SendTextOptions) => {
      const trimmed = text.trim();
      if (!trimmed || status !== "connected" || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return false;
      }

      if (options?.invisibleInTranscript) {
        hiddenOutgoingMessagesRef.current.push(normalizeTranscriptText(trimmed));
      }

      wsRef.current.send(JSON.stringify({ type: "user_message", text: trimmed }));
      return true;
    },
    [status]
  );

  const sendContextUpdate = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status !== "connected" || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return false;
      }

      wsRef.current.send(JSON.stringify({ type: "contextual_update", text: trimmed }));
      return true;
    },
    [status]
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
    transcript,
    systemPromptRef,
    beginUserTurn,
    endUserTurn,
    interruptAgentAudio,
  };
}
