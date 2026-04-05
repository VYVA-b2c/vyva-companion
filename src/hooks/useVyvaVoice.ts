import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TranscriptEntry {
  from: "user" | "vyva";
  text: string;
  timestamp: number;
}

export function useVyvaVoice() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const conversation = useConversation({
    onConnect: () => console.log("[VYVA] Connected"),
    onDisconnect: () => console.log("[VYVA] Disconnected"),
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        const text = message.user_transcription_event?.user_transcript;
        if (text) {
          setTranscript((prev) => [...prev, { from: "user", text, timestamp: Date.now() }]);
        }
      } else if (message.type === "agent_response") {
        const text = message.agent_response_event?.agent_response;
        if (text) {
          setTranscript((prev) => [...prev, { from: "vyva", text, timestamp: Date.now() }]);
        }
      } else if (message.type === "agent_response_correction") {
        const corrected = message.agent_response_correction_event?.corrected_agent_response;
        if (corrected) {
          setTranscript((prev) => {
            const updated = [...prev];
            const lastVyva = updated.findLastIndex((e) => e.from === "vyva");
            if (lastVyva >= 0) updated[lastVyva] = { ...updated[lastVyva], text: corrected };
            return updated;
          });
        }
      }
    },
    onError: (error: any) => console.error("[VYVA] Error:", error),
  });

  const startVoice = useCallback(
    async (contextHint?: string) => {
      if (conversation.status === "connected") return;
      setIsConnecting(true);
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // 1. Call router to get agent_id
        const routerResp = await supabase.functions.invoke("router", {
          body: {
            utterance: contextHint || "hello",
            user_id: "demo-user",
            session_id: sessionIdRef.current,
          },
        });

        const agentId = routerResp.data?.agent_id;
        if (!agentId) throw new Error("No agent_id from router");

        // 2. Get conversation token
        const tokenResp = await supabase.functions.invoke("elevenlabs-conversation-token", {
          body: { agent_id: agentId },
        });

        const token = tokenResp.data?.token;
        if (!token) throw new Error("No token received");

        // 3. Start WebRTC session
        await conversation.startSession({
          conversationToken: token,
        });
      } catch (err) {
        console.error("[VYVA] Failed to start:", err);
      } finally {
        setIsConnecting(false);
      }
    },
    [conversation]
  );

  const stopVoice = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const sendText = useCallback(
    (text: string) => {
      if (conversation.status === "connected") {
        conversation.sendUserMessage(text);
        setTranscript((prev) => [...prev, { from: "user", text, timestamp: Date.now() }]);
      }
    },
    [conversation]
  );

  return {
    startVoice,
    stopVoice,
    sendText,
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
    isConnecting,
    transcript,
  };
}
