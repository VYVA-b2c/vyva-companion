import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  Car,
  Calendar,
  Search,
  Tag,
  RefreshCw,
  Plus,
  Sparkles,
  Home,
  ShieldCheck,
  PhoneCall,
  CircleCheck,
  CircleX,
} from "lucide-react";
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
  id?: string;
  title: string;
  description: string;
  category: "deal" | "event" | "tip" | "activity";
  emoji: string;
  why?: string;
  details?: string;
  steps?: string[];
  action_label?: string;
  action_prompt?: string;
  safety_note?: string;
  best_time?: string;
  effort?: "none" | "low" | "medium";
  freshness?: string;
  personal_signals?: string[];
  action_kind?: "chat" | "call" | "booking" | "check" | "plan";
  location_hint?: string;
  score?: number;
  reason_codes?: string[];
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

const RECS_CACHE_BASE = "vyva_concierge_recs_v4";
const RECS_DATE_BASE = "vyva_concierge_recs_date_v4";
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
    deal: { bg: "#FEF3C7", border: "#FCD34D" },
    event: { bg: "#EDE9FE", border: "#C4B5FD" },
    tip: { bg: "#ECFDF5", border: "#6EE7B7" },
    activity: { bg: "#F5F3FF", border: "#DDD6FE" },
  };
  return map[category] ?? map.tip;
}

function effortLabel(effort: RecommendationCard["effort"], isSpanish: boolean) {
  if (effort === "none") return isSpanish ? "Sin esfuerzo" : "No effort";
  if (effort === "low") return isSpanish ? "Suave" : "Gentle";
  if (effort === "medium") return isSpanish ? "Moderado" : "Moderate";
  return "";
}

const QUICK_ACTIONS = [
  { key: "bookRide", Icon: Car, color: "#6B21A8", bg: "#F5F3FF" },
  { key: "scheduleAppt", Icon: Calendar, color: "#0F766E", bg: "#F0FDFA" },
  { key: "researchTopic", Icon: Search, color: "#0A7C4E", bg: "#ECFDF5" },
  { key: "findDeals", Icon: Tag, color: "#C9890A", bg: "#FEF3C7" },
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

async function fetchRecommendations(locale: string, refresh = false): Promise<RecommendationCard[]> {
  const res = await apiFetch("/api/concierge/recommendations", {
    method: "POST",
    body: JSON.stringify({ locale, refresh }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as { recommendations?: RecommendationCard[] };
  return data.recommendations ?? [];
}

async function sendRecommendationFeedback(
  card: RecommendationCard,
  action: "shown" | "opened" | "liked" | "dismissed" | "completed"
) {
  if (!card.id) return;
  await apiFetch("/api/concierge/recommendations/feedback", {
    method: "POST",
    body: JSON.stringify({
      recommendation_id: card.id,
      action,
      category: card.category,
      title: card.title,
      reasons: card.reason_codes ?? [],
    }),
  });
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

async function confirmPendingAction(item: ConciergePendingItem) {
  const bookingUrl = getBookingUrl(item);

  if (!item.provider_phone && bookingUrl) {
    window.open(bookingUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const res = await apiFetch(`/api/concierge/actions/${item.id}/confirm`, { method: "POST" });
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

function getBookingUrl(item: ConciergePendingItem): string {
  return typeof item.action_payload?.booking_url === "string"
    ? item.action_payload.booking_url.trim()
    : "";
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
  const currentLocaleRef = useRef(i18n.language);
  const saveReadyRef = useRef(false);
  const shownRecIdsRef = useRef<Set<string>>(new Set());

  const [recs, setRecs] = useState<RecommendationCard[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [selectedRec, setSelectedRec] = useState<RecommendationCard | null>(null);

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

  useEffect(() => {
    currentLocaleRef.current = i18n.language;
  });

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
        localStorage.removeItem(chatHistoryKey(i18n.language));
      }
    } catch {
      // Ignore corrupt cache.
    }
    setMessages([]);
    setHasRestoredHistory(false);
  }, [i18n.language]);

  useEffect(() => {
    if (!saveReadyRef.current) {
      saveReadyRef.current = true;
      return;
    }
    if (messages.length === 0) return;
    try {
      const stored: StoredChatHistory = { savedAt: new Date().toISOString(), messages };
      localStorage.setItem(chatHistoryKey(currentLocaleRef.current), JSON.stringify(stored));
    } catch {
      // Ignore storage errors.
    }
  }, [messages]);

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
        // Fall through to fetch.
      }
    }
    loadRecommendations();
  }, [i18n.language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  useEffect(() => {
    recs.forEach((card) => {
      if (!card.id || shownRecIdsRef.current.has(card.id)) return;
      shownRecIdsRef.current.add(card.id);
      sendRecommendationFeedback(card, "shown").catch(() => undefined);
    });
  }, [recs]);

  async function loadRecommendations(refresh = false) {
    setRecsLoading(true);
    try {
      const cards = await fetchRecommendations(i18n.language, refresh);
      setRecs(cards);
      const today = new Date().toDateString();
      localStorage.setItem(recsDateKey(i18n.language), today);
      localStorage.setItem(recsCacheKey(i18n.language), JSON.stringify(cards));
    } catch {
      // Keep the page calm; recommendations are optional.
    } finally {
      setRecsLoading(false);
    }
  }

  function handleRefreshRecs() {
    localStorage.removeItem(recsDateKey(i18n.language));
    localStorage.removeItem(recsCacheKey(i18n.language));
    shownRecIdsRef.current.clear();
    loadRecommendations(true);
  }

  function handleNewConversation() {
    setMessages([]);
    setHasRestoredHistory(false);
    try {
      localStorage.removeItem(chatHistoryKey(i18n.language));
    } catch {
      // Ignore.
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

  function handleRecommendationAction(card: RecommendationCard) {
    const prompt = card.action_prompt || card.description;
    sendRecommendationFeedback(card, "liked").catch(() => undefined);
    setInput(prompt);
    setSelectedRec(null);
  }

  function handleOpenRecommendation(card: RecommendationCard) {
    setSelectedRec(card);
    sendRecommendationFeedback(card, "opened").catch(() => undefined);
  }

  function handleRecommendationFeedback(
    card: RecommendationCard,
    action: "liked" | "dismissed" | "completed"
  ) {
    sendRecommendationFeedback(card, action).catch(() => undefined);
    if (action === "dismissed") {
      setRecs((prev) => prev.filter((item) => item !== card));
      setSelectedRec(null);
    }
    if (action === "completed") {
      setSelectedRec(null);
    }
  }

  const activeAction = pendingActions[0];
  const queuedActionCount = Math.max(0, pendingActions.length - 1);

  return (
    <div className="px-[22px] pb-6">
      <VoiceHero
        sourceText={t("concierge.voiceSource")}
        headline={t("concierge.headline")}
        subtitle={t("concierge.subtitle")}
        contextHint="concierge"
      />

      <section className="mt-5" data-testid="section-concierge-active-task">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
            {isSpanish ? "Ahora mismo" : "Right now"}
          </h2>
          {queuedActionCount > 0 && (
            <span className="font-body text-[12px] font-medium text-vyva-text-2">
              +{queuedActionCount} {isSpanish ? "en cola" : "queued"}
            </span>
          )}
        </div>

        {pendingLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 size={16} className="animate-spin text-vyva-purple" />
            <span className="font-body text-[13px] text-vyva-text-2">
              {isSpanish ? "Buscando acciones activas..." : "Looking for active actions..."}
            </span>
          </div>
        ) : !activeAction ? (
          <div
            className="rounded-[24px] border border-vyva-border bg-white p-[18px]"
            style={{ boxShadow: "0 10px 30px rgba(107,33,168,0.08)" }}
          >
            <div className="flex items-start gap-4">
              <div className="w-[48px] h-[48px] rounded-[16px] flex items-center justify-center bg-[#F5F3FF]">
                <Sparkles size={22} style={{ color: "#6B21A8" }} />
              </div>
              <div className="flex-1">
                <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                  {isSpanish ? "Sin tareas pendientes" : "No pending tasks"}
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "Cuando VYVA prepare una llamada, reserva o gestion, aparecera aqui para que la confirmes."
                    : "When VYVA prepares a call, booking, or task, it will appear here for your confirmation."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-[26px] border border-vyva-border bg-white p-[18px]"
            style={{ boxShadow: "0 14px 38px rgba(107,33,168,0.12)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[12px] uppercase tracking-[0.12em] text-vyva-text-2">
                  {useCaseLabel(activeAction.use_case, locale)}
                </p>
                <p className="mt-1 font-body text-[20px] font-semibold leading-tight text-vyva-text-1">
                  {activeAction.provider_name || (isSpanish ? "Proveedor seleccionado" : "Selected provider")}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-[12px] font-medium"
                style={{
                  background: activeAction.status === "calling" ? "#F5F3FF" : "#F3F4F6",
                  color: activeAction.status === "calling" ? "#6B21A8" : "#374151",
                }}
              >
                {statusLabel(activeAction.status, locale)}
              </span>
            </div>

            <p className="mt-4 font-body text-[15px] leading-relaxed text-vyva-text-1">
              {activeAction.action_summary}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeAction.provider_phone && (
                <span className="inline-flex items-center gap-2 rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[12px] text-vyva-text-1">
                  <PhoneCall size={13} style={{ color: "#6B21A8" }} />
                  {activeAction.provider_phone}
                </span>
              )}
              {!activeAction.provider_phone && getBookingUrl(activeAction) && (
                <span className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] text-vyva-text-1">
                  <Calendar size={13} style={{ color: "#0A7C4E" }} />
                  {isSpanish ? "Reserva online disponible" : "Online booking available"}
                </span>
              )}
            </div>

            {activeAction.status === "pending" && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  data-testid={`button-concierge-confirm-${activeAction.id}`}
                  onClick={() => confirmMutation.mutate(activeAction)}
                  disabled={confirmMutation.isPending || cancelMutation.isPending}
                  className="h-[48px] rounded-full bg-vyva-purple px-5 font-body text-[15px] hover:bg-vyva-purple/90"
                >
                  <PhoneCall size={16} className="mr-2" />
                  {!activeAction.provider_phone && getBookingUrl(activeAction)
                    ? (isSpanish ? "Abrir reserva" : "Open booking")
                    : (isSpanish ? "Confirmar y llamar" : "Confirm and call")}
                </Button>
                <Button
                  data-testid={`button-concierge-cancel-${activeAction.id}`}
                  onClick={() => cancelMutation.mutate(activeAction.id)}
                  disabled={confirmMutation.isPending || cancelMutation.isPending}
                  variant="outline"
                  className="h-[48px] rounded-full px-5 font-body text-[15px]"
                >
                  {isSpanish ? "Cancelar" : "Cancel"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1 mb-[10px]">
          {t("concierge.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map(({ key, Icon, color, bg }) => (
            <button
              key={key}
              data-testid={`button-concierge-action-${key}`}
              onClick={() => handleQuickAction(key)}
              disabled={chatLoading}
              className="flex min-h-[108px] flex-col items-start justify-between rounded-[22px] border border-vyva-border bg-white p-[15px] text-left disabled:opacity-50"
              style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
            >
              <div
                className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon size={19} style={{ color }} />
              </div>
              <span className="font-body text-[14px] font-semibold leading-tight text-vyva-text-1">
                {t(`concierge.actions.${key}`)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1 mb-[10px]">
          {isSpanish ? "Herramientas de ayuda" : "Help tools"}
        </h2>
        <div className="space-y-3">
          <div
            className="flex items-center gap-4 rounded-[20px] border border-vyva-border bg-white p-[16px_18px]"
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

          <button
            data-testid="button-safe-home-teaser"
            onClick={() => navigate("/activity")}
            className="w-full flex items-center gap-4 rounded-[20px] border border-vyva-border bg-white p-[16px_18px] text-left"
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
            <span className="font-body text-[18px] font-medium" style={{ color: "#6B21A8" }}>›</span>
          </button>

          <button
            data-testid="button-scam-guard-teaser"
            onClick={() => navigate("/scam-guard")}
            className="w-full flex items-center gap-4 rounded-[20px] border border-vyva-border bg-white p-[16px_18px] text-left"
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
            <span className="font-body text-[18px] font-medium" style={{ color: "#6B21A8" }}>›</span>
          </button>
        </div>
      </section>

      <section className="mt-6">
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
          <div className="rounded-[20px] border border-vyva-border bg-white p-[16px]">
            <p className="font-body text-[13px] text-vyva-text-2">
              {t("concierge.noRecs")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recs.slice(0, 3).map((card, i) => {
              const colors = getCategoryColors(card.category);
              return (
                <button
                  key={i}
                  data-testid={`card-concierge-rec-${i}`}
                  onClick={() => handleOpenRecommendation(card)}
                  className="w-full rounded-[20px] border bg-white p-[16px] text-left transition-transform active:scale-[0.99]"
                  style={{
                    borderColor: colors.border,
                    boxShadow: "0 2px 12px rgba(107,33,168,0.07)",
                  }}
                >
                  <div className="flex gap-4">
                    <div
                      className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[16px] text-[24px]"
                      style={{ background: colors.bg }}
                    >
                      {card.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-[15px] font-semibold text-vyva-text-1 leading-tight">
                        {card.title}
                      </p>
                      <p className="mt-1 font-body text-[13px] text-vyva-text-2 leading-relaxed">
                        {card.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {card.best_time && (
                          <span className="rounded-full bg-[#F5F1EC] px-2 py-1 font-body text-[11px] font-semibold text-vyva-text-2">
                            {card.best_time}
                          </span>
                        )}
                        {card.effort && (
                          <span className="rounded-full bg-[#F5F3FF] px-2 py-1 font-body text-[11px] font-semibold text-[#6B21A8]">
                            {effortLabel(card.effort, isSpanish)}
                          </span>
                        )}
                        {card.freshness && (
                          <span className="rounded-full bg-[#ECFDF5] px-2 py-1 font-body text-[11px] font-semibold text-[#0A7C4E]">
                            {card.freshness}
                          </span>
                        )}
                      </div>
                      {card.personal_signals && card.personal_signals.length > 0 && (
                        <p className="mt-2 font-body text-[12px] text-vyva-text-2 leading-relaxed">
                          {isSpanish ? "Basado en " : "Based on "}
                          {card.personal_signals.slice(0, 2).join(" + ")}
                        </p>
                      )}
                      <p className="mt-2 font-body text-[12px] font-semibold" style={{ color: "#6B21A8" }}>
                        {isSpanish ? "Ver guia" : "View guide"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedRec && (
          <div
            className="fixed inset-0 z-[1000] flex items-end bg-black/35 px-[10px] sm:items-center sm:justify-center sm:px-4"
            style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))", paddingTop: 16 }}
            role="dialog"
            aria-modal="true"
            data-testid="dialog-concierge-rec-detail"
            onClick={() => setSelectedRec(null)}
          >
            <div
              className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-vyva-border bg-white"
              style={{
                boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
                maxHeight: "calc(100dvh - 128px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-[inherit] overflow-y-auto p-[18px] pb-0">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E7DDD4]" />

                <div className="flex items-start gap-3">
                  <div
                    className="flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-[17px] text-[24px]"
                    style={{ background: getCategoryColors(selectedRec.category).bg }}
                  >
                    {selectedRec.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[18px] font-semibold leading-tight text-vyva-text-1">
                      {selectedRec.title}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {selectedRec.why || selectedRec.description}
                    </p>
                  </div>
                  <button
                    data-testid="button-close-rec-detail"
                    onClick={() => setSelectedRec(null)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F5F1EC] font-body text-[16px] text-vyva-text-2"
                    aria-label={isSpanish ? "Cerrar" : "Close"}
                  >
                    x
                  </button>
                </div>

                {(selectedRec.best_time || selectedRec.effort || selectedRec.freshness) && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {selectedRec.best_time && (
                      <div className="rounded-[16px] bg-[#FBF8F4] p-3">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-vyva-text-2">
                          {isSpanish ? "Momento" : "Timing"}
                        </p>
                        <p className="mt-1 font-body text-[13px] font-semibold text-vyva-text-1">
                          {selectedRec.best_time}
                        </p>
                      </div>
                    )}
                    {selectedRec.effort && (
                      <div className="rounded-[16px] bg-[#F5F3FF] p-3">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B21A8]">
                          {isSpanish ? "Esfuerzo" : "Effort"}
                        </p>
                        <p className="mt-1 font-body text-[13px] font-semibold text-vyva-text-1">
                          {effortLabel(selectedRec.effort, isSpanish)}
                        </p>
                      </div>
                    )}
                    {selectedRec.freshness && (
                      <div className="rounded-[16px] bg-[#ECFDF5] p-3">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0A7C4E]">
                          {isSpanish ? "Hoy" : "Today"}
                        </p>
                        <p className="mt-1 font-body text-[13px] font-semibold text-vyva-text-1">
                          {selectedRec.freshness}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedRec.personal_signals && selectedRec.personal_signals.length > 0 && (
                  <div className="mt-4 rounded-[18px] border border-vyva-border bg-white p-3">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Por que aparece" : "Why this appears"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedRec.personal_signals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full bg-[#F5F1EC] px-3 py-1.5 font-body text-[12px] font-semibold text-vyva-text-2"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                    {selectedRec.location_hint && (
                      <p className="mt-3 font-body text-[13px] leading-relaxed text-vyva-text-2">
                        {selectedRec.location_hint}
                      </p>
                    )}
                  </div>
                )}

                {selectedRec.details && (
                  <p className="mt-5 font-body text-[14px] leading-relaxed text-vyva-text-1">
                    {selectedRec.details}
                  </p>
                )}

                {selectedRec.steps && selectedRec.steps.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Como disfrutarlo" : "How to enjoy it"}
                    </p>
                    {selectedRec.steps.map((step, index) => (
                      <div key={`${step}-${index}`} className="flex gap-3 rounded-[16px] bg-[#FBF8F4] p-3">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple font-body text-[12px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <p className="font-body text-[13px] leading-relaxed text-vyva-text-1">{step}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedRec.safety_note && (
                  <div className="mt-4 rounded-[16px] border border-[#FCD34D] bg-[#FFFBEB] p-3">
                    <p className="font-body text-[12px] font-semibold text-[#92400E]">
                      {isSpanish ? "Nota de cuidado" : "Care note"}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-[#78350F]">
                      {selectedRec.safety_note}
                    </p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    data-testid="button-rec-like"
                    onClick={() => handleRecommendationFeedback(selectedRec, "liked")}
                    className="rounded-full bg-[#F5F3FF] px-2 py-2 font-body text-[12px] font-semibold"
                    style={{ color: "#6B21A8" }}
                  >
                    {isSpanish ? "Me interesa" : "Interested"}
                  </button>
                  <button
                    data-testid="button-rec-done"
                    onClick={() => handleRecommendationFeedback(selectedRec, "completed")}
                    className="rounded-full bg-[#ECFDF5] px-2 py-2 font-body text-[12px] font-semibold"
                    style={{ color: "#0A7C4E" }}
                  >
                    {isSpanish ? "Hecho" : "Done"}
                  </button>
                  <button
                    data-testid="button-rec-not-for-me"
                    onClick={() => handleRecommendationFeedback(selectedRec, "dismissed")}
                    className="rounded-full bg-[#F5F1EC] px-2 py-2 font-body text-[12px] font-semibold text-vyva-text-2"
                  >
                    {isSpanish ? "No es para mi" : "Not for me"}
                  </button>
                </div>

                <div className="sticky bottom-0 -mx-[18px] mt-5 flex gap-2 border-t border-vyva-border bg-white p-[14px_18px]">
                  <Button
                    data-testid="button-rec-action"
                    onClick={() => handleRecommendationAction(selectedRec)}
                    className="h-[46px] flex-1 rounded-full bg-vyva-purple font-body text-[14px] hover:bg-vyva-purple/90"
                  >
                    {selectedRec.action_label || (isSpanish ? "Ayudame" : "Help me")}
                  </Button>
                  <Button
                    data-testid="button-rec-dismiss"
                    onClick={() => setSelectedRec(null)}
                    variant="outline"
                    className="h-[46px] rounded-full px-5 font-body text-[14px]"
                  >
                    {isSpanish ? "Cerrar" : "Close"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
            {isSpanish ? "Resultados recientes" : "Recent concierge results"}
          </h2>
        </div>

        {sessionsLoading ? (
          <div className="rounded-[20px] border border-vyva-border bg-white p-[16px]">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-vyva-purple" />
              <span className="font-body text-[13px] text-vyva-text-2">
                {isSpanish ? "Cargando resultados..." : "Loading recent results..."}
              </span>
            </div>
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="rounded-[20px] border border-vyva-border bg-white p-[16px]">
            <p className="font-body text-[13px] leading-relaxed text-vyva-text-2">
              {isSpanish
                ? "Cuando una llamada o reserva termine, el resultado aparecera aqui en una tarjeta simple."
                : "When a call or booking finishes, the result will appear here in a simple card."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.slice(0, 4).map((item) => {
              const success = item.outcome === "confirmed";
              return (
                <div
                  key={item.id}
                  className="rounded-[18px] border border-vyva-border bg-white p-[16px]"
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
      </section>

      <section className="mt-6 mb-4">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
            {isSpanish ? "Tambien puedes escribir" : "You can also type"}
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

        <div
          ref={scrollRef}
          className="rounded-[22px] border border-vyva-border bg-white overflow-y-auto p-3 space-y-3 mb-3"
          style={{ minHeight: messages.length === 0 ? 96 : 140, maxHeight: 320 }}
        >
          {messages.length === 0 && !chatLoading && (
            <div className="flex h-full min-h-[70px] items-center justify-center rounded-[18px] bg-[#FBF8F4] px-4 text-center">
              <p className="font-body text-[13px] leading-relaxed text-vyva-text-2">
                {isSpanish
                  ? "Si prefieres no hablar, escribe aqui y VYVA te ayuda igual."
                  : "If you prefer not to speak, type here and VYVA will help the same way."}
              </p>
            </div>
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
      </section>
    </div>
  );
};

export default ConciergeScreen;
