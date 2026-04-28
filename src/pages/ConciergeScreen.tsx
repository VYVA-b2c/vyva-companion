import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Car, Calendar, Search, Tag, Lightbulb, RefreshCw, Plus, Sparkles, Home, ShieldCheck, PhoneCall, CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VoiceHero from "@/components/VoiceHero";
import { apiFetch } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StoredChatHistory {
  savedAt: string;
  messages: ChatMessage[];
}

interface RecommendationCard {
  title: string;
  description: string;
  category: "deal" | "event" | "tip" | "activity";
  emoji: string;
}

interface ConciergePendingItem {
  id: string;
  use_case: string;
  provider_name: string | null;
  provider_phone: string | null;
  action_summary: string;
  action_payload: Record<string, unknown> | null;
  status: "pending" | "calling" | "completed" | "failed" | "cancelled";
  language: string;
  confirmed_at?: string | null;
  expires_at?: string | null;
}

interface ConciergeSessionItem {
  id: string;
  pending_id: string | null;
  use_case: string;
  provider_name: string | null;
  outcome: string;
  outcome_payload: Record<string, unknown> | null;
  outcome_summary: string | null;
  completed_at?: string | null;
}

type ConciergeActionListResponse<T> = { items?: T[] };

const RECS_CACHE_BASE = "vyva_concierge_recs";
const RECS_DATE_BASE = "vyva_concierge_recs_date";
const CHAT_HISTORY_BASE = "vyva_concierge_chat";
const CHAT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function recsCacheKey(locale: string) {
  const lang = locale.split("-")[0].toLowerCase();
  return `${RECS_CACHE_BASE}_${lang}`;
}

function recsDateKey(locale: string) {
  const lang = locale.split("-")[0].toLowerCase();
  return `${RECS_DATE_BASE}_${lang}`;
}

function chatHistoryKey(locale: string) {
  const lang = locale.split("-")[0].toLowerCase();
  return `${CHAT_HISTORY_BASE}_${lang}`;
}

function getCategoryColors(category: RecommendationCard["category"]) {
  const map: Record<RecommendationCard["category"], { bg: string; border: string }> = {
    deal:     { bg: "#FEF3C7", border: "#FCD34D" },
    event:    { bg: "#EDE9FE", border: "#C4B5FD" },
    tip:      { bg: "#ECFDF5", border: "#6EE7B7" },
    activity: { bg: "#F5F3FF", border: "#DDD6FE" },
  };
  return map[category] ?? map.tip;
}

const QUICK_ACTIONS = [
  { key: "bookRide",      Icon: Car,       color: "#6B21A8", bg: "#F5F3FF" },
  { key: "scheduleAppt",  Icon: Calendar,  color: "#0F766E", bg: "#F0FDFA" },
  { key: "researchTopic", Icon: Search,    color: "#0A7C4E", bg: "#ECFDF5" },
  { key: "findDeals",     Icon: Tag,       color: "#C9890A", bg: "#FEF3C7" },
  { key: "getAdvice",     Icon: Lightbulb, color: "#B0355A", bg: "#FDF2F8" },
] as const;

async function callConcierge(
  prompt: string,
  history: ChatMessage[],
  locale: string
): Promise<string> {
  const res = await fetch("/api/concierge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, locale }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return data.response ?? "";
}

/**
 * Fetch localised recommendation cards for the given locale (e.g. "es", "fr").
 * The backend uses this locale to instruct the AI to write card titles and
 * descriptions in the user's chosen language.
 */
async function fetchRecommendations(locale: string): Promise<RecommendationCard[]> {
  const res = await fetch("/api/concierge/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as { recommendations?: RecommendationCard[] };
  return data.recommendations ?? [];
}

async function fetchPendingActions(): Promise<ConciergePendingItem[]> {
  const res = await apiFetch("/api/concierge/actions/pending");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as ConciergeActionListResponse<ConciergePendingItem>;
  return data.items ?? [];
}

async function fetchRecentSessions(): Promise<ConciergeSessionItem[]> {
  const res = await apiFetch("/api/concierge/actions/sessions");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as ConciergeActionListResponse<ConciergeSessionItem>;
  return data.items ?? [];
}

async function confirmPendingAction(id: string) {
  const res = await apiFetch(`/api/concierge/actions/${id}/confirm`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to confirm concierge action");
  }
}

async function cancelPendingAction(id: string) {
  const res = await apiFetch(`/api/concierge/actions/${id}/cancel`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to cancel concierge action");
  }
}

function statusLabel(status: ConciergePendingItem["status"], locale = "es"): string {
  const es = locale.startsWith("es");
  switch (status) {
    case "pending":
      return es ? "Pendiente de confirmar" : "Awaiting confirmation";
    case "calling":
      return es ? "Llamando ahora" : "Calling now";
    case "completed":
      return es ? "Completado" : "Completed";
    case "failed":
      return es ? "Necesita revision" : "Needs attention";
    case "cancelled":
      return es ? "Cancelado" : "Cancelled";
    default:
      return status;
  }
}

function sessionOutcomeLabel(outcome: string, locale = "es"): string {
  const es = locale.startsWith("es");
  switch (outcome) {
    case "confirmed":
      return es ? "Confirmado" : "Confirmed";
    case "no_answer":
      return es ? "Sin respuesta" : "No answer";
    case "cant_fulfil":
      return es ? "No se pudo completar" : "Could not complete";
    case "user_cancelled":
      return es ? "Cancelado" : "Cancelled";
    case "error":
      return es ? "Problema" : "Problem";
    default:
      return outcome;
  }
}

function useCaseLabel(useCase: string, locale = "es"): string {
  const es = locale.startsWith("es");
  switch (useCase) {
    case "book_ride":
      return es ? "Taxi" : "Ride";
    case "order_medicine":
      return es ? "Medicacion" : "Medicine";
    case "book_appointment":
      return es ? "Cita medica" : "Appointment";
    default:
      return useCase.replace(/_/g, " ");
  }
}

const ConciergeScreen = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.split("-")[0].toLowerCase();
  const isSpanish = locale === "es";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasRestoredHistory, setHasRestoredHistory] = useState(false);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const reqIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Always holds the current locale so the save effect reads the right key
  const currentLocaleRef = useRef(i18n.language);
  // Skip the very first save-effect invocation (before restore has run)
  const saveReadyRef = useRef(false);

  const [recs, setRecs] = useState<RecommendationCard[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const { data: pendingActions = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/concierge/actions/pending"],
    queryFn: fetchPendingActions,
    refetchInterval: 8000,
  });

  const { data: recentSessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/concierge/actions/sessions"],
    queryFn: fetchRecentSessions,
    refetchInterval: 8000,
  });

  const confirmMutation = useMutation({
    mutationFn: confirmPendingAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPendingAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
  });

  // Keep currentLocaleRef in sync every render
  useEffect(() => {
    currentLocaleRef.current = i18n.language;
  });

  // Restore chat history whenever the active locale changes (including on mount)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatHistoryKey(i18n.language));
      if (raw) {
        const stored = JSON.parse(raw) as StoredChatHistory;
        const age = Date.now() - new Date(stored.savedAt).getTime();
        if (Array.isArray(stored.messages) && stored.messages.length > 0 && age < CHAT_MAX_AGE_MS) {
          setMessages(stored.messages);
          setHasRestoredHistory(true);
          return;
        }
        // Stale — remove so future visits start clean
        localStorage.removeItem(chatHistoryKey(i18n.language));
      }
    } catch {
      // ignore corrupt cache
    }
    // No valid history for this locale
    setMessages([]);
    setHasRestoredHistory(false);
  }, [i18n.language]);

  // Persist chat history when messages change.
  // Uses currentLocaleRef (not i18n.language) so the correct key is always written —
  // avoids the cross-locale write that would occur if both locale and messages change
  // in the same render cycle.
  useEffect(() => {
    if (!saveReadyRef.current) {
      saveReadyRef.current = true;
      return; // Skip the initial render before restore has completed
    }
    if (messages.length === 0) return;
    try {
      const stored: StoredChatHistory = { savedAt: new Date().toISOString(), messages };
      localStorage.setItem(chatHistoryKey(currentLocaleRef.current), JSON.stringify(stored));
    } catch {
      // ignore storage errors (e.g. private mode quota)
    }
  }, [messages]);

  // Load recommendations from cache or fetch
  useEffect(() => {
    const today = new Date().toDateString();
    const cachedDate = localStorage.getItem(recsDateKey(i18n.language));
    const cachedRecs = localStorage.getItem(recsCacheKey(i18n.language));
    if (cachedDate === today && cachedRecs) {
      try {
        const parsed = JSON.parse(cachedRecs) as RecommendationCard[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecs(parsed);
          return;
        }
      } catch {
        // fall through to fetch
      }
    }
    loadRecommendations();
  }, [i18n.language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  async function loadRecommendations() {
    setRecsLoading(true);
    try {
      const cards = await fetchRecommendations(i18n.language);
      setRecs(cards);
      const today = new Date().toDateString();
      localStorage.setItem(recsDateKey(i18n.language), today);
      localStorage.setItem(recsCacheKey(i18n.language), JSON.stringify(cards));
    } catch {
      // silent — show empty state
    } finally {
      setRecsLoading(false);
    }
  }

  function handleRefreshRecs() {
    localStorage.removeItem(recsDateKey(i18n.language));
    localStorage.removeItem(recsCacheKey(i18n.language));
    loadRecommendations();
  }

  function handleNewConversation() {
    setMessages([]);
    setHasRestoredHistory(false);
    try {
      localStorage.removeItem(chatHistoryKey(i18n.language));
    } catch {
      // ignore
    }
  }

  async function sendMessage(text: string, history: ChatMessage[]) {
    const myReqId = ++reqIdRef.current;
    setChatLoading(true);
    setChatError(null);
    try {
      const response = await callConcierge(text, history, i18n.language);
      if (reqIdRef.current !== myReqId) return;
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      if (reqIdRef.current !== myReqId) return;
      setChatError(t("concierge.errorMsg"));
    } finally {
      if (reqIdRef.current === myReqId) setChatLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    sendMessage(text, nextHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleQuickAction(key: string) {
    const prompt = t(`concierge.prompts.${key}`);
    if (!prompt) return;
    setInput(prompt);
  }

  return (
    <div className="px-[22px]">
      <VoiceHero
        sourceText={t("concierge.voiceSource")}
        headline={t("concierge.headline")}
        subtitle={t("concierge.subtitle")}
        contextHint="concierge"
      />

      {/* Intro banner */}
      <div
        className="flex items-center gap-4 bg-white rounded-[16px] border border-vyva-border p-[16px_18px] mt-4"
        style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
        data-testid="banner-concierge-intro"
      >
        <div
          className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{ background: "#F5F3FF" }}
        >
          <Sparkles size={22} style={{ color: "#6B21A8" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[15px] font-semibold text-vyva-text-1">{t("concierge.activityTile")}</p>
          <p className="font-body text-[13px] text-vyva-text-2 truncate">{t("concierge.activityTileSubtitle")}</p>
        </div>
      </div>

      {/* Safe Home Scanner */}
      <button
        data-testid="button-safe-home-teaser"
        onClick={() => navigate("/activity")}
        className="w-full flex items-center gap-4 bg-white rounded-[16px] border border-vyva-border p-[16px_18px] mt-3 text-left"
        style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
      >
        <div
          className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{ background: "#ECFDF5" }}
        >
          <Home size={22} style={{ color: "#0A7C4E" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[15px] font-semibold text-vyva-text-1">{t("safeHome.activityTile")}</p>
          <p className="font-body text-[13px] text-vyva-text-2 truncate">{t("safeHome.activityTileSubtitle")}</p>
        </div>
        <span className="font-body text-[13px] font-medium" style={{ color: "#6B21A8" }}>→</span>
      </button>

      {/* Scam Guard */}
      <button
        data-testid="button-scam-guard-teaser"
        onClick={() => navigate("/scam-guard")}
        className="w-full flex items-center gap-4 bg-white rounded-[16px] border border-vyva-border p-[16px_18px] mt-3 text-left"
        style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
      >
        <div
          className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{ background: "#EDE9FE" }}
        >
          <ShieldCheck size={22} style={{ color: "#6B21A8" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[15px] font-semibold text-vyva-text-1">{t("scamGuard.activityTile")}</p>
          <p className="font-body text-[13px] text-vyva-text-2 truncate">{t("scamGuard.activityTileSubtitle")}</p>
        </div>
        <span className="font-body text-[13px] font-medium" style={{ color: "#6B21A8" }}>→</span>
      </button>

      {/* For You Today */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
            {t("concierge.forYouToday")}
          </h2>
          <button
            data-testid="button-concierge-refresh-recs"
            onClick={handleRefreshRecs}
            disabled={recsLoading}
            className="flex items-center gap-1 text-[12px] font-medium disabled:opacity-40"
            style={{ color: "#6B21A8" }}
          >
            <RefreshCw size={13} className={recsLoading ? "animate-spin" : ""} />
            {t("concierge.refreshRecs")}
          </button>
        </div>

        {recsLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 size={16} className="animate-spin text-vyva-purple" />
            <span className="font-body text-[13px] text-vyva-text-2">
              {t("concierge.loadingRecs")}
            </span>
          </div>
        ) : recs.length === 0 ? (
          <p className="font-body text-[13px] text-vyva-text-2 py-2">
            {t("concierge.noRecs")}
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-[22px] px-[22px] scrollbar-hide">
            {recs.map((card, i) => {
              const colors = getCategoryColors(card.category);
              return (
                <div
                  key={i}
                  data-testid={`card-concierge-rec-${i}`}
                  className="flex-shrink-0 w-[200px] rounded-[16px] p-[14px] border"
                  style={{ background: colors.bg, borderColor: colors.border }}
                >
                  <div className="text-[26px] mb-[6px]">{card.emoji}</div>
                  <p className="font-body text-[13px] font-semibold text-vyva-text-1 leading-tight mb-[4px]">
                    {card.title}
                  </p>
                  <p className="font-body text-[12px] text-vyva-text-2 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4">
        <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1 mb-[10px]">
          {t("concierge.quickActions")}
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-[22px] px-[22px] scrollbar-hide">
          {QUICK_ACTIONS.map(({ key, Icon, color, bg }) => (
            <button
              key={key}
              data-testid={`button-concierge-action-${key}`}
              onClick={() => handleQuickAction(key)}
              disabled={chatLoading}
              className="flex-shrink-0 flex flex-col items-center gap-[8px] rounded-[16px] border border-vyva-border bg-white p-[14px_12px] text-center disabled:opacity-50"
              style={{ minWidth: 90, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}
            >
              <div
                className="w-[40px] h-[40px] rounded-[12px] flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <span className="font-body text-[11px] font-medium text-vyva-text-1 leading-tight">
                {t(`concierge.actions.${key}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Concierge Actions */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
            {isSpanish ? "Acciones de Concierge" : "Concierge actions"}
          </h2>
        </div>

        {pendingLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={16} className="animate-spin text-vyva-purple" />
            <span className="font-body text-[13px] text-vyva-text-2">{isSpanish ? "Cargando tus acciones..." : "Loading your actions..."}</span>
          </div>
        ) : pendingActions.length === 0 ? (
          <div
            className="rounded-[16px] border border-vyva-border bg-white p-[16px]"
            style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
          >
            <p className="font-body text-[14px] text-vyva-text-1">
              {isSpanish ? "Las solicitudes confirmadas apareceran aqui con el proveedor, lo que VYVA esta haciendo y el resultado." : "Confirmed concierge requests will appear here with the provider, what VYVA is doing, and the result."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingActions.map((item) => {
              const isPending = item.status === "pending";
              const isCalling = item.status === "calling";
              const busy = confirmMutation.isPending || cancelMutation.isPending;

              return (
                <div
                  key={item.id}
                  className="rounded-[16px] border border-vyva-border bg-white p-[16px]"
                  style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-body text-[12px] uppercase tracking-wide text-vyva-text-2">
                        {useCaseLabel(item.use_case, locale)}
                      </p>
                      <p className="font-body text-[16px] font-semibold text-vyva-text-1">
                        {item.provider_name || (isSpanish ? "Proveedor seleccionado" : "Selected provider")}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-[12px] font-medium"
                      style={{
                        background: isCalling ? "#F5F3FF" : "#F3F4F6",
                        color: isCalling ? "#6B21A8" : "#374151",
                      }}
                    >
                      {statusLabel(item.status, locale)}
                    </span>
                  </div>

                  <p className="mt-3 font-body text-[14px] leading-relaxed text-vyva-text-1">
                    {item.action_summary}
                  </p>

                  {item.provider_phone && (
                    <p className="mt-2 font-body text-[13px] text-vyva-text-2">
                      {isSpanish ? "Telefono del proveedor" : "Provider number"}: {item.provider_phone}
                    </p>
                  )}

                  {isPending && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        data-testid={`button-concierge-confirm-${item.id}`}
                        onClick={() => confirmMutation.mutate(item.id)}
                        disabled={busy}
                        className="rounded-full bg-vyva-purple hover:bg-vyva-purple/90"
                      >
                        <PhoneCall size={15} className="mr-2" />
                        {isSpanish ? "Confirmar y llamar" : "Confirm and call"}
                      </Button>
                      <Button
                        data-testid={`button-concierge-cancel-${item.id}`}
                        onClick={() => cancelMutation.mutate(item.id)}
                        disabled={busy}
                        variant="outline"
                        className="rounded-full"
                      >
                        {isSpanish ? "Cancelar" : "Cancel"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Results */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
            {isSpanish ? "Resultados recientes" : "Recent concierge results"}
          </h2>
        </div>

        {sessionsLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={16} className="animate-spin text-vyva-purple" />
            <span className="font-body text-[13px] text-vyva-text-2">{isSpanish ? "Cargando resultados..." : "Loading recent results..."}</span>
          </div>
        ) : recentSessions.length === 0 ? (
          <p className="font-body text-[13px] text-vyva-text-2">
            {isSpanish ? "Las acciones completadas apareceran aqui cuando termine una llamada." : "Completed concierge actions will show up here once a call finishes."}
          </p>
        ) : (
          <div className="space-y-3">
            {recentSessions.slice(0, 5).map((item) => {
              const success = item.outcome === "confirmed";
              return (
                <div
                  key={item.id}
                  className="rounded-[16px] border border-vyva-border bg-white p-[16px]"
                  style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-body text-[12px] uppercase tracking-wide text-vyva-text-2">
                        {useCaseLabel(item.use_case, locale)}
                      </p>
                      <p className="font-body text-[16px] font-semibold text-vyva-text-1">
                        {item.provider_name || (isSpanish ? "Proveedor" : "Provider")}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium"
                      style={{
                        background: success ? "#ECFDF5" : "#FEF2F2",
                        color: success ? "#0A7C4E" : "#B91C1C",
                      }}
                    >
                      {success ? <CircleCheck size={14} /> : <CircleX size={14} />}
                      {sessionOutcomeLabel(item.outcome, locale)}
                    </span>
                  </div>

                  <p className="mt-3 font-body text-[14px] leading-relaxed text-vyva-text-1">
                    {item.outcome_summary || (isSpanish ? "Aun no hay resumen disponible." : "No summary available yet.")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="mt-4 mb-4">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
            {t("concierge.chatTitle")}
          </h2>
          {hasRestoredHistory && messages.length > 0 && (
            <button
              data-testid="button-concierge-new-conversation"
              onClick={handleNewConversation}
              className="flex items-center gap-1 text-[12px] font-medium"
              style={{ color: "#6B21A8" }}
            >
              <Plus size={13} />
              {t("concierge.newConversation")}
            </button>
          )}
        </div>

        {/* Message list */}
        <div
          ref={scrollRef}
          className="rounded-[16px] border border-vyva-border bg-white overflow-y-auto p-3 space-y-3 mb-3"
          style={{ minHeight: 140, maxHeight: 320 }}
        >
          {messages.length === 0 && !chatLoading && (
            <p className="font-body text-[13px] text-vyva-text-2 text-center pt-4">
              {t("concierge.chatEmptyHint")}
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              data-testid={`concierge-message-${msg.role}-${i}`}
              className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-vyva-purple flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">V</span>
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 max-w-[85%] font-body text-[14px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-vyva-purple text-white rounded-tr-sm"
                    : "bg-vyva-bg-soft text-vyva-text-1 rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-vyva-purple flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">V</span>
              </div>
              <div className="bg-vyva-bg-soft rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 size={16} className="animate-spin text-vyva-purple" />
              </div>
            </div>
          )}

          {chatError && (
            <div className="flex justify-center">
              <p className="font-body text-[12px] text-red-500 bg-red-50 rounded-xl px-3 py-2">
                {chatError}
              </p>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2">
          <Input
            data-testid="input-concierge-chat"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("concierge.placeholder")}
            disabled={chatLoading}
            className="flex-1 rounded-full border-vyva-border font-body text-[14px] h-[44px] px-4 focus-visible:ring-1 focus-visible:ring-vyva-purple"
          />
          <Button
            data-testid="button-concierge-send"
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
            size="icon"
            className="rounded-full w-11 h-11 flex-shrink-0 bg-vyva-purple hover:bg-vyva-purple/90 disabled:opacity-40"
          >
            {chatLoading ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              <Send size={16} className="text-white" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConciergeScreen;

