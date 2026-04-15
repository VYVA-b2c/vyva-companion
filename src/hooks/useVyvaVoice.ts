import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef } from "react";

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
            let lastVyva = -1;
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].from === "vyva") { lastVyva = i; break; }
            }
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

        const routerResp = await fetch("/api/router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            utterance: contextHint || "hello",
            user_id: "demo-user",
            session_id: sessionIdRef.current,
            conversation_history: [],
          }),
        });

        if (!routerResp.ok) throw new Error("Router request failed");
        const routerData = await routerResp.json();
        const agentId = routerData?.agent_id;
        if (!agentId) throw new Error("No agent_id from router");

        const tokenResp = await fetch("/api/elevenlabs-conversation-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agentId }),
        });

        if (!tokenResp.ok) throw new Error("Token request failed");
        const tokenData = await tokenResp.json();
        const token = tokenData?.token;
        if (!token) throw new Error("No token received");

        await conversation.startSession({ conversationToken: token });
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
