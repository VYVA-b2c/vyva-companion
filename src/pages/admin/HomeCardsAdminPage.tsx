import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";

type AdminRequestError = Error & { status?: number };

type HomePlanCardAdmin = {
  id?: string;
  card_id: string;
  is_enabled: boolean;
  emoji: string;
  bg: string;
  badge_bg: string;
  badge_text: string;
  route: string;
  base_priority: number;
  condition_keywords: string[];
  hobby_keywords: string[];
  avoid_condition_keywords: string[];
  admin_notes?: string | null;
  updated_at?: string;
};

type CardQueueFilter = "all" | "live" | "hidden" | "route_gaps" | "targeted" | "exclusions";

const CARD_QUEUE_FILTERS: Array<{ id: CardQueueFilter; label: string; description: string }> = [
  { id: "all", label: "All cards", description: "Every Today card" },
  { id: "live", label: "Live", description: "Enabled cards" },
  { id: "hidden", label: "Hidden", description: "Disabled cards" },
  { id: "route_gaps", label: "Route gaps", description: "Missing or root route" },
  { id: "targeted", label: "Targeted", description: "Profile or hobby rules" },
  { id: "exclusions", label: "Exclusions", description: "Avoid rules set" },
];

const emptyCard: HomePlanCardAdmin = {
  card_id: "",
  is_enabled: true,
  emoji: "*",
  bg: "#ECFDF3",
  badge_bg: "#D1FAE5",
  badge_text: "#047857",
  route: "/",
  base_priority: 50,
  condition_keywords: [],
  hobby_keywords: [],
  avoid_condition_keywords: [],
  admin_notes: "",
};

function keywordsToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function textToKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasRouteGap(card: HomePlanCardAdmin) {
  const route = card.route.trim();
  return route.length === 0 || route === "/";
}

function hasTargeting(card: HomePlanCardAdmin) {
  return card.condition_keywords.length > 0 || card.hobby_keywords.length > 0;
}

function matchesCardQueue(card: HomePlanCardAdmin, filter: CardQueueFilter) {
  if (filter === "all") return true;
  if (filter === "live") return card.is_enabled;
  if (filter === "hidden") return !card.is_enabled;
  if (filter === "route_gaps") return hasRouteGap(card);
  if (filter === "targeted") return hasTargeting(card);
  return card.avoid_condition_keywords.length > 0;
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </label>
  );
}

export default function HomeCardsAdminPage() {
  const [searchParams] = useSearchParams();
  const focusedCardId = searchParams.get("focus");
  const [cards, setCards] = useState<HomePlanCardAdmin[]>([]);
  const [draft, setDraft] = useState<HomePlanCardAdmin>(emptyCard);
  const [cardQueueFilter, setCardQueueFilter] = useState<CardQueueFilter>("all");
  const [message, setMessage] = useState("");
  const [setupMissing, setSetupMissing] = useState(false);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error ?? "Admin request failed") as AdminRequestError;
      error.status = res.status;
      throw error;
    }
    return data;
  }

  async function refresh() {
    setMessage("");
    setSetupMissing(false);
    try {
      const data = await api("/home-plan-cards");
      setCards(data.cards ?? []);
    } catch (err) {
      const error = err as AdminRequestError;
      if (error.status === 503) {
        setCards([]);
        setSetupMissing(true);
        setMessage("");
        return;
      }
      throw err;
    }
  }

  function updateCard(cardId: string, patch: Partial<HomePlanCardAdmin>) {
    setCards((current) => current.map((card) => (card.card_id === cardId ? { ...card, ...patch } : card)));
  }

  async function saveCard(card: HomePlanCardAdmin) {
    await api(`/home-plan-cards/${card.card_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        is_enabled: card.is_enabled,
        emoji: card.emoji,
        bg: card.bg,
        badge_bg: card.badge_bg,
        badge_text: card.badge_text,
        route: card.route,
        base_priority: Number(card.base_priority),
        condition_keywords: card.condition_keywords,
        hobby_keywords: card.hobby_keywords,
        avoid_condition_keywords: card.avoid_condition_keywords,
        admin_notes: card.admin_notes ?? "",
      }),
    });
    setMessage(`${card.card_id} saved.`);
    await refresh();
  }

  async function addCard() {
    if (!draft.card_id.trim()) {
      setMessage("Card ID is required.");
      return;
    }

    const data = await api("/home-plan-cards", {
      method: "POST",
      body: JSON.stringify({ ...draft, card_id: draft.card_id.trim(), base_priority: Number(draft.base_priority) }),
    });
    setMessage(`${data.card.card_id} added.`);
    setDraft(emptyCard);
    await refresh();
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusedCardId || cards.length === 0) return;
    setCardQueueFilter("all");
    window.setTimeout(() => {
      document.getElementById(`home-card-${focusedCardId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }, [cards.length, focusedCardId]);

  const visibleCards = useMemo(
    () => cards.filter((card) => matchesCardQueue(card, cardQueueFilter)),
    [cardQueueFilter, cards],
  );
  const cardQueueCounts = useMemo<Record<CardQueueFilter, number>>(() => ({
    all: cards.length,
    live: cards.filter((card) => matchesCardQueue(card, "live")).length,
    hidden: cards.filter((card) => matchesCardQueue(card, "hidden")).length,
    route_gaps: cards.filter((card) => matchesCardQueue(card, "route_gaps")).length,
    targeted: cards.filter((card) => matchesCardQueue(card, "targeted")).length,
    exclusions: cards.filter((card) => matchesCardQueue(card, "exclusions")).length,
  }), [cards]);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Home card library"
          subtitle="Admins add and tune the pool behind Today for you. VYVA still chooses which cards each user sees based on profile signals."
        >
          <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => refresh().catch((err) => setMessage(err.message))}>Refresh</button>
          {message && <span className="max-w-full break-words rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        {!setupMissing && cards.length > 0 && (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm" data-testid="admin-home-card-queue">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-serif text-3xl">Card health</h2>
                <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                  Showing {visibleCards.length} of {cards.length} cards.
                </p>
              </div>
              {cardQueueFilter !== "all" && (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 px-4 text-sm font-black text-purple-800"
                  onClick={() => setCardQueueFilter("all")}
                  data-testid="admin-home-card-clear-queue"
                >
                  Show all
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              {CARD_QUEUE_FILTERS.map((queue) => {
                const active = cardQueueFilter === queue.id;
                return (
                  <button
                    key={queue.id}
                    type="button"
                    onClick={() => setCardQueueFilter(queue.id)}
                    className={`min-h-[92px] rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                        : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
                    }`}
                    data-testid={`admin-home-card-queue-${queue.id}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black">{queue.label}</span>
                      <span className="text-2xl font-black leading-none">{cardQueueCounts[queue.id]}</span>
                    </span>
                    <span className="sr-only">{queue.description}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {!setupMissing && (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-3xl">Add a card</h2>
                <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
                  Use this for day-to-day card creation. The deployment migration creates the table and seeds starter cards.
                </p>
              </div>
              <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">{cards.length} cards</span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem]">
              <Field label="Card ID"><input className="w-full rounded-2xl border px-4 py-3" value={draft.card_id} onChange={(e) => setDraft((prev) => ({ ...prev, card_id: e.target.value }))} placeholder="music_hour" /></Field>
              <Field label="Route"><input className="w-full rounded-2xl border px-4 py-3" value={draft.route} onChange={(e) => setDraft((prev) => ({ ...prev, route: e.target.value }))} placeholder="/social-rooms/music-salon" /></Field>
              <Field label="Icon"><input className="w-full rounded-2xl border px-4 py-3" value={draft.emoji} onChange={(e) => setDraft((prev) => ({ ...prev, emoji: e.target.value }))} /></Field>
              <Field label="Priority"><input className="w-full rounded-2xl border px-4 py-3" type="number" value={draft.base_priority} onChange={(e) => setDraft((prev) => ({ ...prev, base_priority: Number(e.target.value) }))} /></Field>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <Field label="Condition keywords" optional>
                <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(draft.condition_keywords)} onChange={(e) => setDraft((prev) => ({ ...prev, condition_keywords: textToKeywords(e.target.value) }))} placeholder="lonely, low_mood" />
              </Field>
              <Field label="Hobby keywords" optional>
                <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(draft.hobby_keywords)} onChange={(e) => setDraft((prev) => ({ ...prev, hobby_keywords: textToKeywords(e.target.value) }))} placeholder="music, cooking" />
              </Field>
              <Field label="Avoid if user has" optional>
                <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(draft.avoid_condition_keywords)} onChange={(e) => setDraft((prev) => ({ ...prev, avoid_condition_keywords: textToKeywords(e.target.value) }))} placeholder="mobility_severe" />
              </Field>
            </div>

            <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => addCard().catch((err) => setMessage(err.message))}>
              Add card
            </button>
          </section>
        )}

        {setupMissing ? (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <h2 className="font-serif text-3xl">Setup pending</h2>
            <p className="mt-2 max-w-3xl text-[#7d6b65]">
              Home cards are waiting for the deployment migration. After the latest release runs migrations, refresh this page.
            </p>
            <code className="mt-4 block overflow-auto whitespace-pre-wrap break-words rounded-3xl bg-[#2f2135] p-4 text-xs text-white sm:text-sm">migrations/0032_home_plan_cards.sql</code>
          </section>
        ) : cards.length === 0 ? (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <h2 className="font-serif text-3xl">No cards yet</h2>
            <p className="mt-2 max-w-3xl text-[#7d6b65]">
              The card library is ready. Add a card above to start building the Personalized Today pool.
            </p>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 xl:grid-cols-2" data-testid="admin-home-card-list">
            {visibleCards.length === 0 ? (
              <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-8 text-center text-sm font-bold text-[#7d6b65] xl:col-span-2">
                No cards match this health queue.
              </div>
            ) : visibleCards.map((card) => (
              <article id={`home-card-${card.card_id}`} key={card.card_id} className={`rounded-[2rem] border bg-white p-5 shadow-sm ${focusedCardId === card.card_id ? "border-purple-500 ring-4 ring-purple-100" : "border-[#eadfd5]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-xl font-black">{card.card_id}</p>
                    <p className="text-sm text-[#7d6b65]">{card.route}</p>
                  </div>
                  <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700">
                    <input type="checkbox" checked={card.is_enabled} onChange={(e) => updateCard(card.card_id, { is_enabled: e.target.checked })} />
                    Enabled
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Field label="Icon"><input className="w-full rounded-2xl border px-4 py-3" value={card.emoji} onChange={(e) => updateCard(card.card_id, { emoji: e.target.value })} /></Field>
                  <Field label="Priority"><input className="w-full rounded-2xl border px-4 py-3" type="number" value={card.base_priority} onChange={(e) => updateCard(card.card_id, { base_priority: Number(e.target.value) })} /></Field>
                  <Field label="Route"><input className="w-full rounded-2xl border px-4 py-3" value={card.route} onChange={(e) => updateCard(card.card_id, { route: e.target.value })} /></Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Background"><input className="w-full rounded-2xl border px-4 py-3" value={card.bg} onChange={(e) => updateCard(card.card_id, { bg: e.target.value })} /></Field>
                  <Field label="Badge background"><input className="w-full rounded-2xl border px-4 py-3" value={card.badge_bg} onChange={(e) => updateCard(card.card_id, { badge_bg: e.target.value })} /></Field>
                  <Field label="Badge text"><input className="w-full rounded-2xl border px-4 py-3" value={card.badge_text} onChange={(e) => updateCard(card.card_id, { badge_text: e.target.value })} /></Field>
                </div>

                <div className="mt-3 grid gap-3">
                  <Field label="Condition keywords">
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.condition_keywords)} onChange={(e) => updateCard(card.card_id, { condition_keywords: textToKeywords(e.target.value) })} />
                  </Field>
                  <Field label="Hobby keywords">
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.hobby_keywords)} onChange={(e) => updateCard(card.card_id, { hobby_keywords: textToKeywords(e.target.value) })} />
                  </Field>
                  <Field label="Avoid if user has">
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.avoid_condition_keywords)} onChange={(e) => updateCard(card.card_id, { avoid_condition_keywords: textToKeywords(e.target.value) })} />
                  </Field>
                  <Field label="Admin notes" optional>
                    <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={card.admin_notes ?? ""} onChange={(e) => updateCard(card.card_id, { admin_notes: e.target.value })} />
                  </Field>
                </div>

                <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => saveCard(card).catch((err) => setMessage(err.message))}>
                  Save card
                </button>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
