import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useVyvaVoice, VyvaVoiceProvider } from "./useVyvaVoice";
import {
  VYVA_VOICE_SESSION_STORAGE_KEY,
  VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT,
  VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT,
  acknowledgeDrAiScreenSync,
  type DrAiScreenSyncRequestDetail,
} from "@/lib/voiceSessionBridge";
import {
  VYVA_VOICE_HOME_INTENT_EVENT,
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import {
  clearVoiceCanvasScene,
  emitVoiceCanvasScene,
  type VoiceCanvasSceneEnvelope,
} from "@/lib/voiceCanvasBridge";
import { VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT } from "@/lib/onboardingElevenLabsRuntimeAdapter";

const voiceMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getToken: vi.fn(),
  getAgentAppContextVariables: vi.fn(),
  subscribeAgentAppContext: vi.fn(),
  startSession: vi.fn(),
  recordVoiceTimelineEvent: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getToken: voiceMocks.getToken,
}));

vi.mock("@/lib/agentAppContext", () => ({
  getAgentAppContextVariables: voiceMocks.getAgentAppContextVariables,
  subscribeAgentAppContext: voiceMocks.subscribeAgentAppContext,
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: voiceMocks.apiFetch,
}));

vi.mock("@/lib/voiceTimeline", () => ({
  recordVoiceTimelineEvent: voiceMocks.recordVoiceTimelineEvent,
}));

vi.mock("@elevenlabs/client", () => ({
  Conversation: {
    startSession: voiceMocks.startSession,
  },
}));

type VoiceController = ReturnType<typeof useVyvaVoice>;

type MockConversation = {
  endSession: ReturnType<typeof vi.fn>;
  setMicMuted: ReturnType<typeof vi.fn>;
  sendUserMessage: ReturnType<typeof vi.fn>;
  sendUserActivity: ReturnType<typeof vi.fn>;
  sendContextualUpdate: ReturnType<typeof vi.fn>;
};

type MockStartSessionOptions = {
  clientTools?: Record<string, (parameters: unknown) => Promise<string>>;
  dynamicVariables?: Record<string, string | number | boolean>;
  overrides?: {
    agent?: {
      language?: string;
      firstMessage?: string;
      prompt?: {
        prompt?: string;
      };
    };
  };
  onConversationCreated?: (conversation: MockConversation) => void;
  onConnect?: () => void;
  onMessage?: (payload: unknown) => void;
  onAgentChatResponsePart?: (part: unknown) => void;
  onDebug?: (payload: unknown) => void;
};

const createdConversations: MockConversation[] = [];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createConversation() {
  const conversation = {
    endSession: vi.fn().mockResolvedValue(undefined),
    setMicMuted: vi.fn(),
    sendUserMessage: vi.fn(),
    sendUserActivity: vi.fn(),
    sendContextualUpdate: vi.fn(),
  };
  createdConversations.push(conversation);
  return conversation;
}

function VoiceHarness({ onController }: { onController: (controller: VoiceController) => void }) {
  const controller = useVyvaVoice();

  useEffect(() => {
    onController(controller);
  }, [controller, onController]);

  return (
    <>
      <div data-testid="voice-status">{controller.status}</div>
      <div data-testid="voice-transcript">
        {controller.transcript.map((entry) => `${entry.from}:${entry.text}`).join("|")}
      </div>
      <div data-testid="onboarding-live-diagnostic">
        {controller.onboardingVoiceLiveDiagnostic
          ? [
              controller.onboardingVoiceLiveDiagnostic.phase,
              controller.onboardingVoiceLiveDiagnostic.sectionId,
              controller.onboardingVoiceLiveDiagnostic.connected ? "connected" : "not-connected",
              controller.onboardingVoiceLiveDiagnostic.starterSent ? "starter-sent" : "starter-pending",
              controller.onboardingVoiceLiveDiagnostic.clientToolReceived ? "tool-received" : "tool-pending",
            ].join("|")
          : "none"}
      </div>
    </>
  );
}

function healthCanvasScene(sceneInstanceId: string, revision = 1): VoiceCanvasSceneEnvelope {
  return {
    owner: "health_preventive_check",
    flowReference: "health.preventive_check",
    questionId: "health.preventive_check.energy",
    sceneInstanceId,
    revision,
    viewModel: {
      sceneId: "health.preventive_check.energy",
      kind: "choice",
      title: "How much energy do you have today?",
      choices: [{ id: "3", label: "Normal" }],
    },
  };
}

async function renderStartedVoice() {
  let controller: VoiceController | null = null;

  render(
    <VyvaVoiceProvider>
      <VoiceHarness onController={(nextController) => {
        controller = nextController;
      }} />
    </VyvaVoiceProvider>,
  );

  await waitFor(() => expect(controller).not.toBeNull());

  await act(async () => {
    await controller?.startVoice("app_open", undefined, {
      agentId: "agent_test",
      autoStartListening: true,
      skipMicrophone: true,
    });
  });

  return voiceMocks.startSession.mock.calls.at(-1)?.[0] as MockStartSessionOptions | undefined;
}

function collectVoiceUserMessages() {
  const messages: VoiceUserMessageDetail[] = [];
  const handleMessage = (event: Event) => {
    messages.push((event as CustomEvent<VoiceUserMessageDetail>).detail);
  };
  window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleMessage);
  return {
    messages,
    stop: () => window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleMessage),
  };
}

describe("useVyvaVoice", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    createdConversations.length = 0;
    voiceMocks.apiFetch.mockReset();
    voiceMocks.getToken.mockReset();
    voiceMocks.getAgentAppContextVariables.mockReset();
    voiceMocks.subscribeAgentAppContext.mockReset();
    voiceMocks.startSession.mockReset();
    voiceMocks.recordVoiceTimelineEvent.mockReset();

    voiceMocks.getToken.mockReturnValue(null);
    voiceMocks.getAgentAppContextVariables.mockReturnValue({});
    voiceMocks.subscribeAgentAppContext.mockReturnValue(() => {});
    voiceMocks.apiFetch.mockImplementation(async (url: string) => {
      if (url === "/api/voice-readiness") {
        return jsonResponse({ ready: true, agent_id_present: true });
      }

      if (url === "/api/voice-context") {
        return jsonResponse({ dynamic_variables: {} });
      }

      if (url === "/api/router") {
        return jsonResponse({
          agent_id: "agent_router",
          system_prompt_override: "Use the health voice context without overriding the ElevenLabs prompt.",
          dynamic_variables: { routing_domain: "health" },
          session_data: {
            domain: "health",
            intent_confidence: 0.91,
            session_id: "voice-session-test",
            turn_count: 1,
            last_agent: null,
          },
        });
      }

      if (url === "/api/elevenlabs-conversation-token") {
        return jsonResponse({ signed_url: "wss://example.test/voice-session" });
      }

      throw new Error(`Unexpected voice API request: ${url}`);
    });
    voiceMocks.startSession.mockImplementation(async (options: MockStartSessionOptions) => {
      const conversation = createConversation();
      options.onConversationCreated?.(conversation);
      options.onConnect?.();
      return conversation;
    });
  });

  afterEach(() => {
    cleanup();
    clearVoiceCanvasScene();
    vi.useRealTimers();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("starts a new ElevenLabs session after the user stops the previous one", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    expect(voiceMocks.startSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("voice-status")).toHaveTextContent("connected");

    act(() => {
      controller?.stopVoice();
    });

    expect(createdConversations[0].endSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("voice-status")).toHaveTextContent("idle");

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    expect(voiceMocks.startSession).toHaveBeenCalledTimes(2);
    expect(createdConversations).toHaveLength(2);
  });

  it("captures Health scene provenance on tentative provider user transcript and emits it with the final transcript", async () => {
    const emitted = collectVoiceUserMessages();
    try {
      const sessionOptions = await renderStartedVoice();
      act(() => emitVoiceCanvasScene(healthCanvasScene("health-session-a")));

      act(() => {
        sessionOptions?.onMessage?.({
          type: "tentative_user_transcript",
          tentative_user_transcription_event: {
            user_transcript: "Nor",
            event_id: 101,
          },
        });
        sessionOptions?.onMessage?.({
          type: "user_transcript",
          user_transcription_event: {
            user_transcript: "Normal",
            event_id: 101,
          },
        });
      });

      expect(emitted.messages).toHaveLength(1);
      expect(emitted.messages[0]).toMatchObject({
        text: "Normal",
        voiceUtteranceId: expect.stringContaining(":101"),
        canvasProvenance: {
          owner: "health_preventive_check",
          sceneId: "health.preventive_check.energy",
          questionId: "health.preventive_check.energy",
          sceneInstanceId: "health-session-a",
          revision: 1,
        },
      });
    } finally {
      emitted.stop();
    }
  });

  it("keeps delayed final provider transcripts bound to the original Health scene snapshot", async () => {
    const emitted = collectVoiceUserMessages();
    try {
      const sessionOptions = await renderStartedVoice();
      act(() => emitVoiceCanvasScene(healthCanvasScene("health-session-a", 1)));

      act(() => {
        sessionOptions?.onMessage?.({
          type: "tentative_user_transcript",
          tentative_user_transcription_event: {
            user_transcript: "Nor",
            event_id: 102,
          },
        });
        emitVoiceCanvasScene({
          ...healthCanvasScene("health-session-a", 2),
          questionId: "health.preventive_check.mood",
          viewModel: {
            sceneId: "health.preventive_check.mood",
            kind: "choice",
            title: "How is your mood?",
            choices: [{ id: "well", label: "Quite well" }],
          },
        });
        sessionOptions?.onMessage?.({
          type: "user_transcript",
          user_transcription_event: {
            user_transcript: "Normal",
            event_id: 102,
          },
        });
      });

      expect(emitted.messages).toHaveLength(1);
      expect(emitted.messages[0].canvasProvenance).toMatchObject({
        sceneId: "health.preventive_check.energy",
        questionId: "health.preventive_check.energy",
        sceneInstanceId: "health-session-a",
        revision: 1,
      });
    } finally {
      emitted.stop();
    }
  });

  it("fails closed for final Health transcripts that have no prior provider provenance correlation", async () => {
    const emitted = collectVoiceUserMessages();
    try {
      const sessionOptions = await renderStartedVoice();
      act(() => emitVoiceCanvasScene(healthCanvasScene("health-session-a")));

      act(() => {
        sessionOptions?.onMessage?.({
          type: "user_transcript",
          user_transcription_event: {
            user_transcript: "Normal",
            event_id: 103,
          },
        });
      });

      expect(emitted.messages).toHaveLength(1);
      expect(emitted.messages[0]).toMatchObject({
        text: "Normal",
        voiceUtteranceId: expect.stringContaining(":103"),
      });
      expect(emitted.messages[0].canvasProvenance).toBeUndefined();
    } finally {
      emitted.stop();
    }
  });

  it("does not rebind an utterance across a Health scene remount", async () => {
    const emitted = collectVoiceUserMessages();
    try {
      const sessionOptions = await renderStartedVoice();
      act(() => emitVoiceCanvasScene(healthCanvasScene("health-session-a")));

      act(() => {
        sessionOptions?.onMessage?.({
          type: "tentative_user_transcript",
          tentative_user_transcription_event: {
            user_transcript: "Nor",
            event_id: 104,
          },
        });
        clearVoiceCanvasScene({ owner: "health_preventive_check" });
        emitVoiceCanvasScene(healthCanvasScene("health-session-b"));
        sessionOptions?.onMessage?.({
          type: "user_transcript",
          user_transcription_event: {
            user_transcript: "Normal",
            event_id: 104,
          },
        });
      });

      expect(emitted.messages).toHaveLength(1);
      expect(emitted.messages[0].canvasProvenance).toMatchObject({
        sceneInstanceId: "health-session-a",
      });
    } finally {
      emitted.stop();
    }
  });

  it("reuses stable voice event identity for duplicate final provider callbacks with different callback times", async () => {
    const emitted = collectVoiceUserMessages();
    try {
      const sessionOptions = await renderStartedVoice();
      act(() => emitVoiceCanvasScene(healthCanvasScene("health-session-a")));

      act(() => {
        sessionOptions?.onMessage?.({
          type: "tentative_user_transcript",
          tentative_user_transcription_event: {
            user_transcript: "Nor",
            event_id: 105,
          },
        });
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-07T10:00:00.000Z"));
      act(() => {
        sessionOptions?.onMessage?.({
          type: "user_transcript",
          user_transcription_event: {
            user_transcript: "Normal",
            event_id: 105,
          },
        });
      });
      vi.setSystemTime(new Date("2026-08-07T10:00:05.000Z"));
      act(() => {
        sessionOptions?.onMessage?.({
          type: "user_transcript",
          user_transcription_event: {
            user_transcript: "Normal",
            event_id: 105,
          },
        });
      });

      expect(emitted.messages).toHaveLength(2);
      expect(emitted.messages[0].at).not.toBe(emitted.messages[1].at);
      expect(emitted.messages[0].voiceUtteranceId).toBe(emitted.messages[1].voiceUtteranceId);
      expect(emitted.messages[0].canvasProvenance).toEqual(emitted.messages[1].canvasProvenance);
    } finally {
      emitted.stop();
    }
  });

  it("force-restarts a stale onboarding voice session and sends a fresh starter prompt", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    const onboardingOptions = {
      agentSlug: "onboarding-profile",
      autoStartListening: true,
      skipMicrophone: true,
      dynamicVariables: {
        app_entrypoint: "onboarding-profile",
        conversation_plan_id: "onboarding_profile_collection_v1",
        active_section_id: "health",
        active_section_label: "Health profile",
      },
    } as const;

    await act(async () => {
      await controller?.startVoice("Tell VYVA one or more health conditions.", "Profile prompt", onboardingOptions);
    });

    expect(voiceMocks.startSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("voice-status")).toHaveTextContent("connected");
    expect(createdConversations[0].sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("Start Health profile now."),
    );

    await act(async () => {
      await controller?.startVoice("Tell VYVA one or more health conditions.", "Profile prompt", {
        ...onboardingOptions,
        forceRestart: true,
      });
    });

    expect(createdConversations[0].endSession).toHaveBeenCalledTimes(1);
    expect(voiceMocks.startSession).toHaveBeenCalledTimes(2);
    expect(createdConversations[1].sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("Start Health profile now."),
    );
    expect(screen.getByTestId("onboarding-live-diagnostic")).toHaveTextContent("starter_sent|health|connected|starter-sent");
  });

  it("does not send prompt overrides when router returns voice context", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("health questions", undefined, {
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as { overrides?: unknown } | undefined;
    expect(sessionOptions).toBeDefined();
    expect(sessionOptions).not.toHaveProperty("overrides");

    const tokenCall = voiceMocks.apiFetch.mock.calls.find(([url]) => url === "/api/elevenlabs-conversation-token");
    expect(tokenCall).toBeDefined();
    const tokenBody = JSON.parse(((tokenCall?.[1] as RequestInit | undefined)?.body as string | undefined) ?? "{}");
    expect(tokenBody).not.toHaveProperty("prompt_override");
    expect(createdConversations[0].sendContextualUpdate).toHaveBeenCalledWith(
      "Use the health voice context without overriding the ElevenLabs prompt.",
    );
    expect(createdConversations[0].sendUserMessage).not.toHaveBeenCalled();
    expect(createdConversations[0].sendUserActivity).not.toHaveBeenCalled();
  });

  it("does not send a Dr. AI first-message override that the ElevenLabs agent rejects", async () => {
    let controller: VoiceController | null = null;
    const defaultApiFetch = voiceMocks.apiFetch.getMockImplementation();
    voiceMocks.apiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/voice-context") {
        return jsonResponse({
          dynamic_variables: {
            routing_domain: "health",
            language: "fr",
            dr_ai_first_message: "Bonjour, je suis le Dr AI. Qu'est-ce qui a change aujourd'hui ?",
          },
        });
      }
      if (!defaultApiFetch) throw new Error(`Unexpected voice API request: ${url}`);
      return defaultApiFetch(url, init);
    });

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("health questions", undefined, {
        agentSlug: "health",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    expect(sessionOptions?.overrides?.agent?.language).toBe("fr");
    expect(sessionOptions?.overrides?.agent).not.toHaveProperty("firstMessage");
    expect(sessionOptions?.dynamicVariables).toMatchObject({
      language: "fr",
      dr_ai_first_message: "Bonjour, je suis le Dr AI. Qu'est-ce qui a change aujourd'hui ?",
    });
  });

  it("shares the ElevenLabs conversation id with the symptom check page", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("health questions", undefined, {
        agentSlug: "health",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionId = sessionStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY);
    expect(sessionId).toBeTruthy();
    expect(localStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY)).toBe(sessionId);
  });

  it("blocks the Dr. AI screen-sync tool until the canonical screen acknowledges rendering", async () => {
    const sessionOptions = await renderStartedVoice();
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<DrAiScreenSyncRequestDetail>).detail;
      acknowledgeDrAiScreenSync({ ...detail, rendered: true });
    };
    window.addEventListener(VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT, handleRequest);

    const result = await sessionOptions?.clientTools?.sync_dr_ai_screen?.({ conversation_id: "voice-screen-sync" });

    expect(JSON.parse(result || "{}")).toMatchObject({
      ok: true,
      rendered: true,
      conversation_id: "voice-screen-sync",
    });
    window.removeEventListener(VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT, handleRequest);
  });

  it("opens the inline Dr. AI vitals capture from the agent tool", async () => {
    const sessionOptions = await renderStartedVoice();
    const opened = vi.fn();
    window.addEventListener("vyva:dr-ai-vitals-open", opened);

    const result = await sessionOptions?.clientTools?.open_dr_ai_vitals?.({ conversation_id: "voice-vitals" });

    expect(JSON.parse(result || "{}")).toMatchObject({ ok: true, opened: true, surface: "inline_vitals_capture" });
    expect(opened).toHaveBeenCalledOnce();
    window.removeEventListener("vyva:dr-ai-vitals-open", opened);
  });

  it("syncs tapped symptom-check answers into the active ElevenLabs session", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("health questions", undefined, {
        agentSlug: "health",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionId = sessionStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY);
    expect(sessionId).toBeTruthy();
    createdConversations[0].sendContextualUpdate.mockClear();
    createdConversations[0].sendUserMessage.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT, {
        detail: {
          conversationId: sessionId,
          utterance: "No, I can stand safely.",
          choiceId: "no_red_flags",
          nextQuestion: "How long has this been happening?",
          status: "active",
        },
      }));
    });

    expect(createdConversations[0].sendContextualUpdate).toHaveBeenCalledWith(expect.stringContaining("No, I can stand safely."));
    expect(createdConversations[0].sendContextualUpdate).toHaveBeenCalledWith(expect.stringContaining("How long has this been happening?"));
    expect(createdConversations[0].sendUserMessage).toHaveBeenCalledWith(expect.stringContaining("Ask only the current next question"));
    expect(createdConversations[0].sendUserMessage).toHaveBeenCalledWith(expect.stringContaining("do not submit the selected answer again"));
  });

  it("shares validated onboarding profile structured output with the app as a local event", async () => {
    let controller: VoiceController | null = null;
    const handler = vi.fn();
    window.addEventListener(VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT, handler);

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice(
        "Tell VYVA one or more health conditions.",
        [
          "Return structured local drafts only; never save profile data.",
          "Never ask the user for account ID, profile ID, user ID, app IDs, API keys, credentials, or setup details.",
        ].join(" "),
        {
          agentSlug: "onboarding-profile",
          autoStartListening: true,
          skipMicrophone: true,
          dynamicVariables: {
            app_entrypoint: "onboarding-profile",
            conversation_plan_id: "onboarding_profile_collection_v1",
            active_section_id: "health",
            active_section_label: "Health profile",
          },
        },
      );
    });

    const contextCall = voiceMocks.apiFetch.mock.calls.find(([url]) => url === "/api/voice-context");
    const contextBody = JSON.parse(((contextCall?.[1] as RequestInit | undefined)?.body as string | undefined) ?? "{}");
    expect(contextBody).toMatchObject({
      domain: "onboarding_profile",
      agent_slug: "onboarding-profile",
      app_entrypoint: "onboarding-profile",
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    expect(sessionOptions?.dynamicVariables).toMatchObject({
      app_entrypoint: "onboarding-profile",
      conversation_plan_id: "onboarding_profile_collection_v1",
      active_section_id: "health",
      active_section_label: "Health profile",
    });
    expect(sessionOptions?.overrides?.agent?.firstMessage).toBe(
      "I'm ready for Health profile. Tell me what you'd like me to add.",
    );
    expect(sessionOptions?.overrides?.agent?.prompt?.prompt).toContain(
      "Return structured local drafts only; never save profile data.",
    );
    expect(sessionOptions?.overrides?.agent?.prompt?.prompt).toContain(
      "Never ask the user for account ID",
    );
    expect(createdConversations[0].sendUserMessage).toHaveBeenCalledWith(expect.stringContaining(
      "Start Health profile now.",
    ));
    expect(createdConversations[0].sendUserMessage).toHaveBeenCalledWith(expect.stringContaining(
      "Do not ask for account ID",
    ));
    expect(createdConversations[0].sendUserActivity).toHaveBeenCalledTimes(1);

    act(() => {
      sessionOptions?.onMessage?.({
        role: "user",
        source: "user",
        message: createdConversations[0].sendUserMessage.mock.calls[0]?.[0],
      });
    });

    expect(screen.getByTestId("voice-transcript")).not.toHaveTextContent("Start Health profile now.");
    expect(screen.getByTestId("onboarding-live-diagnostic")).toHaveTextContent(
      "starter_sent|health|connected|starter-sent|tool-pending",
    );

    let result: string | number | void | undefined;
    await act(async () => {
      result = await sessionOptions?.clientTools?.record_onboarding_profile_output?.({
        eventType: "draft",
        sectionId: "health",
        lifecycle: "parsed-draft",
        draft: {
          kind: "health-conditions",
          title: "Review health conditions",
          helper: "Add these only if they look right.",
          rows: [{ id: "diabetes", label: "Condition", value: "Diabetes Type 2" }],
          values: ["Diabetes Type 2"],
        },
        safety: {
          localOnly: true,
          requiresReview: true,
          requiresExplicitSave: true,
          mayTriggerExternalAction: false,
        },
      });
    });

    expect(result).toContain("local review");
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
      type: "draft",
      sectionId: "health",
      draft: {
        values: ["Diabetes Type 2"],
      },
    });
    await waitFor(() => {
      expect(screen.getByTestId("onboarding-live-diagnostic")).toHaveTextContent(
        "tool_received|health|connected|starter-sent|tool-received",
      );
    });

    window.removeEventListener(VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT, handler);
  });

  it("adds final ElevenLabs agent messages to the visible VYVA transcript", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onMessage?.({ role: "agent", source: "ai", message: "Hola Karim" });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Hola Karim");
  });

  it("opens every broad pillar destination when the agent sends a domain-only tool call", async () => {
    let controller: VoiceController | null = null;
    const homeIntentHandler = vi.fn();
    window.addEventListener(VYVA_VOICE_HOME_INTENT_EVENT, homeIntentHandler);

    try {
      render(
        <VyvaVoiceProvider>
          <VoiceHarness onController={(nextController) => {
            controller = nextController;
          }} />
        </VyvaVoiceProvider>,
      );

      await waitFor(() => expect(controller).not.toBeNull());

      await act(async () => {
        await controller?.startVoice("app_open", undefined, {
          agentId: "agent_test",
          autoStartListening: true,
          skipMicrophone: true,
        });
      });

      const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
      const cases = [
        [{ domain: "health" }, "health", "Showing the Health choices."],
        [{ domain: "brain_coach" }, "mind", "Showing the Mind choices."],
        [{ domain: "social" }, "community", "Showing the Community choices."],
        [{ domain: "concierge" }, "concierge", "Showing the Concierge choices."],
      ] as const;

      for (const [parameters, intent, expectedResult] of cases) {
        const result = await sessionOptions?.clientTools?.open_app_action?.(parameters);
        expect(result).toBe(expectedResult);
        expect(homeIntentHandler.mock.calls.at(-1)?.[0].detail).toBe(intent);
      }
      expect(homeIntentHandler).toHaveBeenCalledTimes(cases.length);
    } finally {
      window.removeEventListener(VYVA_VOICE_HOME_INTENT_EVENT, homeIntentHandler);
    }
  });

  it("adds raw ElevenLabs agent response events to the visible VYVA transcript", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onDebug?.({
        type: "agent_response",
        agent_response_event: {
          agent_response: "Soy su asistente personal.",
          event_id: 7,
        },
      });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Soy su asistente personal.");
  });

  it("streams ElevenLabs agent response parts into one visible VYVA transcript", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onAgentChatResponsePart?.({ type: "start", text: "" });
      sessionOptions?.onAgentChatResponsePart?.({ type: "delta", text: "Hola" });
      sessionOptions?.onAgentChatResponsePart?.({ type: "delta", text: " Karim" });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Hola Karim");

    act(() => {
      sessionOptions?.onMessage?.({ role: "agent", source: "ai", message: "Hola Karim" });
    });

    expect(screen.getByTestId("voice-transcript").textContent?.split("vyva:").length).toBe(2);
    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Hola Karim");
  });

  it("streams raw ElevenLabs text response parts into one visible VYVA transcript", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onDebug?.({
        type: "agent_chat_response_part",
        text_response_part: { type: "start", text: "", event_id: 12 },
      });
      sessionOptions?.onDebug?.({
        type: "agent_chat_response_part",
        text_response_part: { type: "delta", text: "Puedo ayudar", event_id: 12 },
      });
      sessionOptions?.onDebug?.({
        type: "agent_chat_response_part",
        text_response_part: { type: "delta", text: " con salud.", event_id: 12 },
      });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Puedo ayudar con salud.");
  });

  it("keeps user messages separate from VYVA transcript events", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onMessage?.({ role: "user", source: "user", message: "I need help" });
      sessionOptions?.onAgentChatResponsePart?.({ type: "delta", text: "I can help with that." });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("user:I need help");
    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:I can help with that.");
  });
});
