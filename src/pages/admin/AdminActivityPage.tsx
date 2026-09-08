import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Filter, RefreshCw, Search, XCircle } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";

type ActivityResultStatus = "success" | "warning" | "failed";

type AdminActivityItem = {
  id: string;
  source: string;
  actor: string;
  action: string;
  event_type: string;
  result: string;
  result_status: ActivityResultStatus;
  target_type: string;
  target_name: string;
  target_detail?: string | null;
  channel?: string | null;
  details?: string | null;
  created_at: string;
};

type ActivityResponse = {
  activity: AdminActivityItem[];
  summary: {
    total: number;
    failed: number;
    warning: number;
    latest_at?: string | null;
  };
};

type ActivityQueueFilter = "all" | "attention" | "failed_sends" | "waiting" | "lifecycle_changes";

const RESULT_FILTERS = [
  { value: "all", label: "All results" },
  { value: "success", label: "Completed" },
  { value: "warning", label: "Queued / warning" },
  { value: "failed", label: "Failed" },
] as const;

const ACTIVITY_QUEUE_FILTERS: Array<{ id: ActivityQueueFilter; label: string; description: string }> = [
  { id: "all", label: "All loaded", description: "Full audit trail" },
  { id: "attention", label: "Needs attention", description: "Failed or warning" },
  { id: "failed_sends", label: "Failed sends", description: "Email/SMS/WhatsApp issues" },
  { id: "waiting", label: "Waiting", description: "Queued or pending work" },
  { id: "lifecycle_changes", label: "Lifecycle changes", description: "Successful user/org updates" },
];

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function resultClass(status: ActivityResultStatus) {
  if (status === "failed") return "bg-red-50 text-red-700 border-red-100";
  if (status === "warning") return "bg-amber-50 text-amber-800 border-amber-100";
  return "bg-emerald-50 text-emerald-800 border-emerald-100";
}

function sourceLabel(source: string) {
  if (source === "communication") return "Communication";
  return "Lifecycle";
}

function includesAnyNeedle(value: string | null | undefined, needles: string[]) {
  const haystack = String(value ?? "").toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function matchesActivityQueue(item: AdminActivityItem, queue: ActivityQueueFilter) {
  if (queue === "all") return true;
  if (queue === "attention") return item.result_status === "failed" || item.result_status === "warning";
  if (queue === "failed_sends") {
    return item.result_status === "failed" && (
      item.source === "communication" ||
      includesAnyNeedle(item.channel, ["email", "sms", "whatsapp"]) ||
      includesAnyNeedle(`${item.event_type} ${item.action}`, ["send", "message", "invite"])
    );
  }
  if (queue === "waiting") {
    return item.result_status === "warning" ||
      includesAnyNeedle(`${item.result} ${item.action} ${item.details}`, ["queued", "waiting", "pending"]);
  }
  return item.source === "lifecycle" && item.result_status === "success";
}

export default function AdminActivityPage() {
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [summary, setSummary] = useState<ActivityResponse["summary"]>({ total: 0, failed: 0, warning: 0 });
  const [query, setQuery] = useState("");
  const [activityQueueFilter, setActivityQueueFilter] = useState<ActivityQueueFilter>("all");
  const [resultFilter, setResultFilter] = useState<(typeof RESULT_FILTERS)[number]["value"]>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadActivity() {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/admin/lifecycle/activity?limit=250");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Activity could not be loaded.");
      setItems(data.activity ?? []);
      setSummary(data.summary ?? { total: 0, failed: 0, warning: 0 });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activity could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadActivity().catch(() => undefined);
  }, []);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesActivityQueue(item, activityQueueFilter)) return false;
      const matchesResult = resultFilter === "all" || item.result_status === resultFilter;
      if (!matchesResult) return false;
      const matchesSource = sourceFilter === "all" || item.source === sourceFilter;
      if (!matchesSource) return false;
      if (!needle) return true;
      return [
        item.actor,
        item.action,
        item.target_name,
        item.target_detail,
        item.result,
        item.details,
        item.channel,
        item.event_type,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [activityQueueFilter, items, query, resultFilter, sourceFilter]);

  const sourceOptions = useMemo(() => {
    const sources = Array.from(new Set(items.map((item) => item.source).filter(Boolean))).sort();
    return [
      { value: "all", label: "All sources" },
      ...sources.map((source) => ({ value: source, label: sourceLabel(source) })),
    ];
  }, [items]);

  const activityQueueCounts = useMemo<Record<ActivityQueueFilter, number>>(() => ({
    all: items.length,
    attention: items.filter((item) => matchesActivityQueue(item, "attention")).length,
    failed_sends: items.filter((item) => matchesActivityQueue(item, "failed_sends")).length,
    waiting: items.filter((item) => matchesActivityQueue(item, "waiting")).length,
    lifecycle_changes: items.filter((item) => matchesActivityQueue(item, "lifecycle_changes")).length,
  }), [items]);

  const reviewQueue = useMemo(
    () => items
      .filter((item) => item.result_status === "failed" || item.result_status === "warning")
      .slice(0, 6),
    [items],
  );

  function clearFilters() {
    setQuery("");
    setActivityQueueFilter("all");
    setResultFilter("all");
    setSourceFilter("all");
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#2f2135] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Admin activity"
          subtitle="Who did what, when, to which user or organization, and whether it worked."
        >
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            disabled={isLoading}
            onClick={() => loadActivity().catch(() => undefined)}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {message && <span className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Events loaded" value={summary.total} />
          <SummaryCard label="Failed" value={summary.failed} tone="red" />
          <SummaryCard label="Warnings" value={summary.warning} tone="amber" />
          <SummaryCard label="Latest" value={summary.latest_at ? formatDate(summary.latest_at) : "None"} compact />
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Review queue</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Needs attention</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-[#7d6b65]">
                Fast buckets for failed sends, waiting work, and lifecycle changes before digging through the full log.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={summary.failed === 0}
                onClick={() => {
                  setActivityQueueFilter("failed_sends");
                  setResultFilter("all");
                  setSourceFilter("all");
                  setQuery("");
                }}
              >
                <XCircle size={15} />
                Failed sends
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={summary.warning === 0}
                onClick={() => {
                  setActivityQueueFilter("waiting");
                  setResultFilter("all");
                  setSourceFilter("all");
                  setQuery("");
                }}
              >
                <AlertTriangle size={15} />
                Waiting
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5" data-testid="admin-activity-work-queue">
            {ACTIVITY_QUEUE_FILTERS.map((queue) => {
              const active = activityQueueFilter === queue.id;
              return (
                <button
                  key={queue.id}
                  type="button"
                  onClick={() => setActivityQueueFilter(queue.id)}
                  className={`min-h-[88px] rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                      : "border-[#eadfd5] bg-[#fbf8f5] text-[#2f2135] hover:border-purple-200"
                  }`}
                  data-testid={`admin-activity-queue-${queue.id}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black">{queue.label}</span>
                    <span className="text-2xl font-black leading-none">{activityQueueCounts[queue.id]}</span>
                  </span>
                  <span className="sr-only">{queue.description}</span>
                </button>
              );
            })}
          </div>

          {reviewQueue.length === 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              <CheckCircle2 size={18} />
              No failed or warning events in the loaded audit trail.
            </div>
          ) : (
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {reviewQueue.map((item) => (
                <button
                  key={`queue-${item.id}`}
                  type="button"
                  className="rounded-2xl border border-[#eadfd5] bg-[#fbf8f5] p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                  onClick={() => {
                    setActivityQueueFilter("all");
                    setResultFilter(item.result_status);
                    setSourceFilter(item.source);
                    setQuery(item.target_name || item.actor);
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${resultClass(item.result_status)}`}>{item.result}</span>
                    <span className="text-xs font-bold text-[#8b7a73]">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="mt-2 font-black text-[#2f2135]">{item.action}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#7d6b65]">{item.target_name} - {sourceLabel(item.source)}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Audit trail</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Activity log</h2>
              <p className="mt-1 text-sm text-[#7d6b65]" data-testid="admin-activity-visible-count">{filteredItems.length} visible of {items.length} loaded events.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,360px)_180px_180px_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8b85]" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-xl border border-[#eadfd5] bg-white py-2.5 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                  placeholder="Search actor, target, action"
                />
              </label>
              <select
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value as typeof resultFilter)}
                className="rounded-xl border border-[#eadfd5] bg-white px-3 py-2.5 text-sm font-bold outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
              >
                {RESULT_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="rounded-xl border border-[#eadfd5] bg-white px-3 py-2.5 text-sm font-bold outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                aria-label="Source filter"
              >
                {sourceOptions.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-100 bg-white px-3 py-2.5 text-sm font-black text-purple-700 hover:bg-purple-50"
                onClick={clearFilters}
              >
                <Filter size={15} />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-y-2 text-left">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="rounded-2xl bg-[#fbf8f5] px-4 py-8 text-center font-bold text-[#7d6b65]">
                      No activity matches the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="rounded-l-2xl bg-[#fbf8f5] px-4 py-4 text-sm font-bold text-[#4f4352]">{formatDate(item.created_at)}</td>
                      <td className="bg-[#fbf8f5] px-4 py-4">
                        <p className="break-words font-black">{item.actor}</p>
                        <p className="mt-1 text-xs font-bold text-[#8b7a73]">{sourceLabel(item.source)}</p>
                      </td>
                      <td className="bg-[#fbf8f5] px-4 py-4">
                        <p className="font-black">{item.action}</p>
                        {item.details && <p className="mt-1 max-w-md break-words text-xs font-semibold text-[#7d6b65]">{item.details}</p>}
                      </td>
                      <td className="bg-[#fbf8f5] px-4 py-4">
                        <p className="font-black">{item.target_name}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#8b7a73]">{item.target_type}</p>
                        {item.target_detail && <p className="mt-1 break-words text-xs font-semibold text-[#7d6b65]">{item.target_detail}</p>}
                      </td>
                      <td className="rounded-r-2xl bg-[#fbf8f5] px-4 py-4">
                        <span className={`inline-flex max-w-xs rounded-full border px-3 py-1 text-xs font-black ${resultClass(item.result_status)}`}>
                          {item.result}
                        </span>
                        {item.channel && <p className="mt-2 text-xs font-bold text-[#8b7a73]">{item.channel}</p>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "purple",
  compact = false,
}: {
  label: string;
  value: number | string;
  tone?: "purple" | "red" | "amber";
  compact?: boolean;
}) {
  const toneClass = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-[#2f2135]";
  return (
    <article className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Activity size={16} className={toneClass} />
        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">{label}</p>
      </div>
      <p className={`mt-2 font-black ${toneClass} ${compact ? "text-base" : "text-3xl"}`}>{value}</p>
    </article>
  );
}
