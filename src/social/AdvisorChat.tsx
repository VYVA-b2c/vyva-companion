import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Info, Loader2, Mic, Send, Square } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { useVyvaVoice, type TranscriptEntry } from "@/hooks/useVyvaVoice";
import type {
  AdvisorMessage,
  AdvisorMessageResponse,
  AdvisorSessionResponse,
  AdvisorSessionSummary,
} from "../../shared/advisors";
import { isAdvisorSlug } from "../../shared/advisors";
import { AdvisorAvatar, AdvisorIcon } from "./AdvisorIcons";
import {
  MOVEMENT_EXERCISE_VISUALS,
  getMovementExerciseCards,
  getMovementExerciseLanguage,
  type MovementExerciseCardId,
} from "./movementExercises";
import {
  getMovementCoachCopy,
  isMovementCoachSlug,
} from "./movementCoachAdvisor";
import SocialStyles from "./SocialStyles";

const MOVEMENT_COACH_FEATURED_EXERCISE_IDS: MovementExerciseCardId[] = [
  "chair-yoga",
  "tai-chi",
  "seated-strength",
  "sit-to-stand",
];

type AdvisorVoiceControls = {
  startVoice: ReturnType<typeof useVyvaVoice>["startVoice"];
  stopVoice: ReturnType<typeof useVyvaVoice>["stopVoice"];
  status: "idle" | "connecting" | "connected";
  isSpeaking: boolean;
  isConnecting: boolean;
  transcript: TranscriptEntry[];
};

function AdvisorBubble({ message }: { message: AdvisorMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`} data-testid={`advisor-message-${message.role}`}>
      <div
        className={`max-w-[82%] rounded-[20px] px-4 py-3 font-body text-[18px] font-semibold leading-[1.42] shadow-[0_8px_18px_rgba(63,45,35,0.045)] ${
          isUser ? "bg-[#F3EEFA] text-[#2A2438]" : "border border-[#E8E2F0] bg-white text-[#2A2438]"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function transcriptMessages(transcript: TranscriptEntry[]): AdvisorMessage[] {
  return transcript.map((entry, index) => ({
    id: `voice-${entry.timestamp}-${index}`,
    role: entry.from === "user" ? "user" : "assistant",
    text: entry.text,
    source: "voice",
    createdAt: new Date(entry.timestamp).toISOString(),
  }));
}

function MovementCoachRoutineShortcuts({
  language,
  onOpenLibrary,
  onOpenRoutine,
}: {
  language: string;
  onOpenLibrary: () => void;
  onOpenRoutine: (exerciseId: string) => void;
}) {
  const movementLanguage = getMovementExerciseLanguage(language);
  const copy = getMovementCoachCopy(language);
  const featuredIds = new Set(MOVEMENT_COACH_FEATURED_EXERCISE_IDS);
  const cards = getMovementExerciseCards(movementLanguage).filter((card) => featuredIds.has(card.id));

  return (
    <section
      className="mt-5 rounded-[24px] border border-[#D7E8DB] bg-[#F8FCF8] p-4 text-left"
      data-testid="movement-coach-routines"
    >
      <h2 className="font-body text-[19px] font-black leading-tight text-vyva-text-1">
        {copy.routineTitle}
      </h2>
      <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
        {copy.routineBody}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {cards.map((card) => {
          const visual = MOVEMENT_EXERCISE_VISUALS[card.id];
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpenRoutine(card.id)}
              className="vyva-tap overflow-hidden rounded-[18px] border bg-white text-left shadow-[0_8px_18px_rgba(63,45,35,0.055)] transition-transform active:scale-[0.985]"
              style={{ borderColor: visual.border }}
              data-testid={`button-movement-coach-routine-${card.id}`}
            >
              <img src={visual.image} alt="" className="h-24 w-full object-cover min-[390px]:h-28" />
              <span className="block px-3 py-2.5">
                <span className="block font-body text-[14px] font-black leading-tight text-vyva-text-1">
                  {card.title}
                </span>
                <span className="sr-only">
                  {card.benefit}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onOpenLibrary}
        className="vyva-tap mt-4 min-h-[48px] w-full rounded-full border border-[#BDEBD8] bg-white px-4 font-body text-[15px] font-black text-[#0A7C4E]"
        data-testid="button-movement-coach-all-routines"
      >
        {copy.allRoutines}
      </button>
    </section>
  );
}

export default function AdvisorChat() {
  const { agentSlug } = useParams<{ agentSlug: string }>();
  const apiSlug = isAdvisorSlug(agentSlug) ? agentSlug : null;
  const isMovementCoach = isMovementCoachSlug(agentSlug);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const voice = useVyvaVoice() as AdvisorVoiceControls;
  const [session, setSession] = useState<AdvisorSessionSummary | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch } = useQuery<AdvisorSessionResponse>({
    queryKey: apiSlug ? [`/api/advisors/${apiSlug}/session?lang=${encodeURIComponent(language)}`] : ["advisor-client-only"],
    enabled: Boolean(apiSlug),
    staleTime: 15 * 1000,
  });

  const advisorData = data;

  useEffect(() => {
    if (!advisorData) return;
    setSession(advisorData.session);
    setMessages(advisorData.messages);
    setIntroDismissed(!advisorData.introRequired || advisorData.messages.length > 0);
  }, [advisorData]);

  const advisor = advisorData?.advisor;
  const advisorDisplayName = advisor ? `${advisor.name} ${advisor.role}` : "";
  const ui = advisorData?.ui;
  const isAdvisorLoading = isLoading;
  const isAdvisorError = isError;
  const liveMessages = useMemo(() => {
    const voiceMessages = voice.status === "idle" ? [] : transcriptMessages(voice.transcript);
    return [...messages, ...voiceMessages];
  }, [messages, voice.status, voice.transcript]);
  const showIntro = Boolean(advisor && advisorData?.introRequired && !introDismissed && messages.length === 0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [liveMessages.length, showIntro]);

  const startVoiceForAdvisor = () => {
    if (!apiSlug || !advisor) return;
    void Promise.resolve(
      voice.startVoice(
        `Ask an Expert with ${advisorDisplayName}. Help the user with ${advisor.role}.`,
        undefined,
        {
          agentSlug: apiSlug,
          autoStartListening: true,
          dynamicVariables: {
            app_entrypoint: "ask_an_expert_chat",
            advisor_slug: apiSlug,
            advisor_name: advisor.name,
            advisor_role: advisor.role,
          },
        },
      ),
    ).catch(() => {});
  };

  const handleStartSession = async () => {
    if (!advisor) return;
    setSendError(null);
    if (!apiSlug) return;
    try {
      const response = await apiFetch(`/api/advisors/${apiSlug}/sessions?lang=${encodeURIComponent(language)}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("start failed");
      const payload = await response.json() as { session: AdvisorSessionSummary };
      setSession(payload.session);
      setIntroDismissed(true);
      startVoiceForAdvisor();
      void refetch();
    } catch {
      setIntroDismissed(false);
      setSendError(ui?.sendError ?? "Could not send. Try again.");
    }
  };

  const handleMicToggle = () => {
    if (voice.status === "connected" || voice.isConnecting) {
      voice.stopVoice();
      return;
    }
    if (showIntro) {
      void handleStartSession();
      return;
    }
    startVoiceForAdvisor();
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setSendError(null);
    setDraft("");

    if (!apiSlug) {
      setIsSending(false);
      return;
    }

    try {
      const response = await apiFetch(`/api/advisors/${apiSlug}/messages?lang=${encodeURIComponent(language)}`, {
        method: "POST",
        body: JSON.stringify({ prompt: text, sessionId: session?.id, source: "text" }),
      });
      if (!response.ok) throw new Error("send failed");
      const payload = await response.json() as AdvisorMessageResponse;
      setSession(payload.session);
      setMessages((current) => [...current, payload.userMessage, payload.assistantMessage]);
      setIntroDismissed(true);
    } catch {
      setDraft(text);
      setSendError(ui?.sendError ?? "Could not send. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (!apiSlug && !isMovementCoach) {
    return (
      <>
        <SocialStyles />
        <main className="vyva-page pb-[120px]">
          <button
            type="button"
            onClick={() => navigate("/social-rooms/experts")}
            className="vyva-tap mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-black text-vyva-text-1 shadow-sm"
          >
            <ArrowLeft size={18} strokeWidth={2.5} aria-hidden="true" />
            Back to Experts
          </button>
          <section className="rounded-[24px] border border-[#E8E2F0] bg-white p-5 font-body text-[18px] font-bold text-vyva-text-2">
            Expert not found.
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <SocialStyles />
      <main className={`vyva-page flex min-h-[calc(100vh-90px)] flex-col ${showIntro ? "pb-8" : "pb-[104px]"}`} data-testid="advisor-chat-screen">
        <header className="sticky top-0 z-10 -mx-4 border-b border-[#E8E2F0] bg-[#FBF7F0]/95 px-4 py-3 backdrop-blur min-[390px]:-mx-[22px] min-[390px]:px-[22px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/social-rooms/experts")}
              className="vyva-tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-vyva-text-1 shadow-sm"
              data-testid="button-advisor-chat-back"
              aria-label="Back to experts"
            >
              <ArrowLeft size={20} strokeWidth={2.6} aria-hidden="true" />
            </button>
            {advisor ? (
              <>
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
                  style={{ background: advisor.chipBg, color: advisor.iconColor }}
                >
                  <AdvisorIcon iconKey={advisor.iconKey} size={23} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-body text-[19px] font-black leading-tight text-vyva-text-1">
                    {advisorDisplayName}
                  </span>
                  <span className="block truncate font-body text-[13px] font-bold text-vyva-text-2">
                    {advisor.shortRole}
                  </span>
                </span>
              </>
            ) : null}
          </div>
        </header>

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-y-auto py-4"
          data-testid="advisor-chat-messages"
        >
          {isAdvisorLoading ? (
            <div className="grid gap-3" aria-busy="true">
              <div className="h-20 w-[74%] rounded-[20px] border border-[#E8E2F0] bg-white" />
              <div className="ml-auto h-16 w-[68%] rounded-[20px] bg-[#F3EEFA]" />
              <div className="h-20 w-[78%] rounded-[20px] border border-[#E8E2F0] bg-white" />
            </div>
          ) : isAdvisorError || !advisor ? (
            <section className="rounded-[24px] border border-[#E8E2F0] bg-white p-5 text-center font-body text-[17px] font-bold text-vyva-text-2">
              {ui?.empty ?? "Your experts are not available right now."}
            </section>
          ) : showIntro ? (
            <section className="mx-auto mt-5 w-full max-w-lg overflow-hidden rounded-[30px] border border-[#E8E2F0] bg-white shadow-[0_16px_38px_rgba(63,45,35,0.08)]" data-testid="advisor-intro">
              <div className="px-5 pb-5 pt-5">
                <div className="flex items-center gap-4">
                  <AdvisorAvatar
                    iconKey={advisor.iconKey}
                    chipBg={advisor.chipBg}
                    iconColor={advisor.iconColor}
                    className="h-[86px] w-[86px] rounded-[30px]"
                    size={42}
                    strokeWidth={2.3}
                  />
                  <div className="min-w-0 pt-1">
                    <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-[#6B21A8]">
                      {advisor.shortRole}
                    </p>
                    <h1 className="mt-1 font-body text-[32px] font-black leading-[0.98] text-vyva-text-1 min-[390px]:text-[36px]">
                      {advisorDisplayName}
                    </h1>
                  </div>
                </div>

                {isMovementCoach ? (
                  <>
                    <button
                      type="button"
                      onClick={handleStartSession}
                      className="vyva-tap mt-5 flex min-h-[62px] w-full items-center justify-center gap-2 rounded-full bg-[#6B21A8] px-6 font-body text-[20px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)]"
                      data-testid="button-advisor-start-talking"
                    >
                      <Mic size={22} strokeWidth={2.5} aria-hidden="true" />
                      {ui?.startTalking ?? "Start talking"}
                    </button>
                    <MovementCoachRoutineShortcuts
                      language={language}
                      onOpenLibrary={() => navigate("/social-rooms/morning-movement")}
                      onOpenRoutine={(exerciseId) => navigate(`/social-rooms/morning-movement/exercises/${exerciseId}`)}
                    />
                  </>
                ) : (
                  <>
                    <div className="mt-5 rounded-[22px] border border-[#E8E2F0] bg-[#FBF7F0] px-4 py-4 text-left">
                      <p className="font-body text-[17px] font-black leading-snug text-vyva-text-1">
                        {advisor.starter}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartSession}
                      className="vyva-tap mt-5 flex min-h-[66px] w-full items-center justify-center gap-2 rounded-full bg-[#6B21A8] px-6 font-body text-[20px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)]"
                      data-testid="button-advisor-start-talking"
                    >
                      <Mic size={22} strokeWidth={2.5} aria-hidden="true" />
                      {ui?.startTalking ?? "Start talking"}
                    </button>
                  </>
                )}
                {sendError ? (
                  <p className="mt-4 rounded-[18px] bg-[#FFF7ED] px-4 py-3 text-left font-body text-[14px] font-bold text-[#B45309]" role="alert">
                    {sendError}
                  </p>
                ) : null}
              </div>
              {advisor.disclaimerText ? (
                <aside
                  role="note"
                  aria-label={ui?.disclaimerLabel ?? "Important note"}
                  className="border-t border-[#E8E2F0] bg-[#FFFCF8] px-5 py-4 font-body text-[14px] font-semibold leading-snug text-vyva-text-2"
                  data-testid="advisor-disclaimer"
                >
                  <span className="flex items-start gap-2">
                    <Info size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#6B21A8]" aria-hidden="true" />
                    <span>{advisor.disclaimerText}</span>
                  </span>
                </aside>
              ) : null}
            </section>
          ) : (
            <div className="grid gap-3">
              {liveMessages.length ? (
                liveMessages.map((message) => <AdvisorBubble key={message.id} message={message} />)
              ) : (
                <AdvisorBubble
                  message={{
                    id: "starter",
                    role: "assistant",
                    text: advisor.starter,
                    source: "text",
                    createdAt: new Date().toISOString(),
                  }}
                />
              )}
            </div>
          )}
        </div>

        {!showIntro && advisor?.disclaimerText ? (
          <aside
            role="note"
            aria-label={ui?.disclaimerLabel ?? "Important note"}
            className="sticky bottom-[96px] -mx-4 border-y border-[#E8E2F0] bg-white px-4 py-3 font-body text-[14px] font-semibold leading-snug text-vyva-text-2 min-[390px]:-mx-[22px] min-[390px]:px-[22px]"
            data-testid="advisor-disclaimer"
          >
            <span className="flex items-start gap-2">
              <Info size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#6B21A8]" aria-hidden="true" />
              <span>{advisor.disclaimerText}</span>
            </span>
          </aside>
        ) : null}

        {!showIntro ? (
          <form
            onSubmit={handleSend}
            className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-5xl border-t border-[#E8E2F0] bg-[#FBF7F0]/96 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur min-[390px]:px-[22px]"
            data-testid="advisor-chat-input"
          >
            {sendError ? (
              <p className="mb-2 font-body text-[13px] font-bold text-[#B45309]" role="alert">
                {sendError}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMicToggle}
                className="vyva-tap flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#6B21A8] text-white shadow-[0_10px_22px_rgba(107,33,168,0.20)] disabled:opacity-60"
                aria-label={voice.status === "connected" ? (ui?.micListening ?? "Listening") : (ui?.micIdle ?? "Talk by voice")}
                data-testid="button-advisor-mic"
                disabled={!advisor || isAdvisorLoading}
              >
                {voice.isConnecting ? (
                  <Loader2 size={25} className="animate-spin" aria-hidden="true" />
                ) : voice.status === "connected" ? (
                  <Square size={22} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Mic size={26} strokeWidth={2.5} aria-hidden="true" />
                )}
              </button>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={ui?.inputPlaceholder ?? "Write a message..."}
                className="min-h-[58px] min-w-0 flex-1 rounded-full border border-[#E8E2F0] bg-white px-5 font-body text-[17px] font-semibold text-vyva-text-1 outline-none placeholder:text-vyva-text-3 focus:border-[#6B21A8] focus:ring-2 focus:ring-[#E9D5FF]"
                data-testid="input-advisor-message"
                disabled={!advisor || isAdvisorLoading}
              />
              <button
                type="submit"
                className="vyva-tap flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-[#E8E2F0] bg-white text-[#6B21A8] shadow-sm disabled:opacity-45"
                aria-label={ui?.send ?? "Send"}
                data-testid="button-advisor-send"
                disabled={!draft.trim() || isSending || !advisor || isAdvisorLoading}
              >
                {isSending ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <Send size={22} strokeWidth={2.5} aria-hidden="true" />}
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </>
  );
}
