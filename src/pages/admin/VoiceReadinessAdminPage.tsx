import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Download,
  FileJson,
  GitBranch,
  KeyRound,
  Mic,
  RadioTower,
  Route,
  Save,
  Sparkles,
  TestTube2,
} from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import ElevenLabsConversationReviewPanel from "./ElevenLabsConversationReviewPanel";
import { useVoiceActionContext } from "@/contexts/VoiceActionContext";
import { useVyvaVoice, type VoiceDiagnosticStep } from "@/hooks/useVyvaVoice";
import {
  VOICE_AGENT_CONTRACTS,
  validateVoiceAgentContext,
  voiceAgentContractFor,
  type VoiceAgentContract,
  type VoiceContextValidation,
} from "@/lib/voiceAgentContracts";
import {
  actionForVoiceUtterance,
  emitVoiceAppAction,
  voiceActionRegistryEntries,
  VOICE_SPECIALIST_AGENT_SLUGS,
} from "@/lib/voiceNavigation";
import { voiceSessionPhaseLabel } from "@/lib/voiceSessionState";
import {
  buildVoicePromptDebugContext,
  buildVoiceQaDashboard,
  buildVoiceReplayPack,
  filterVoiceTimelineEvents,
  timelineFilterOptions,
  type VoiceQaSession,
  voiceQaSessionsToCsv,
  type VoiceTimelineFilter,
} from "@/lib/voiceQa";
import {
  fetchVoiceQaSessionReviews,
  saveVoiceQaSessionReview,
  VOICE_QA_REVIEW_STATUSES,
  voiceQaReviewStatusLabel,
  type VoiceQaReviewDraft,
  type VoiceQaReviewStatus,
  type VoiceQaSessionReview,
} from "@/lib/voiceQaReviews";
import {
  clearVoiceTimeline,
  fetchPersistedVoiceTimelineEvents,
  flushVoiceTimelineEvents,
  recordVoiceTimelineEvent,
  useVoiceTimeline,
  type PersistedVoiceTimelineEvent,
  type VoiceTimelineEvent,
} from "@/lib/voiceTimeline";

const QUICK_UTTERANCES = [
  "Do we need to buy Paracetamol?",
  "I forgot my medication",
  "Can we check my blood pressure?",
  "I feel chest pain",
  "Can you book a GP appointment?",
  "Let's play a memory game",
  "Show me social rooms",
];

const DEFAULT_QA_FILTERS: VoiceTimelineFilter = {
  query: "",
  domain: "all",
  kind: "all",
  severity: "all",
};

const REVIEW_STATUS_FILTERS = [
  "all",
  "unresolved",
  ...VOICE_QA_REVIEW_STATUSES,
] as const;

type ReviewStatusFilter = typeof REVIEW_STATUS_FILTERS[number];
type VoiceQaQueueFilter = "all" | "flagged" | "unresolved" | "prompt_fix_needed" | "app_fix_needed" | "elevenlabs_config_needed";

const VOICE_QA_QUEUE_FILTERS: Array<{ id: VoiceQaQueueFilter; label: string; description: string }> = [
  { id: "all", label: "All sessions", description: "Current filter set" },
  { id: "flagged", label: "Flagged", description: "Errors, dismissals, gaps" },
  { id: "unresolved", label: "Unresolved", description: "Still needs review" },
  { id: "prompt_fix_needed", label: "Prompt fix", description: "Prompt tuning needed" },
  { id: "app_fix_needed", label: "App fix", description: "Product issue" },
  { id: "elevenlabs_config_needed", label: "ElevenLabs", description: "Agent config issue" },
];

function statusLabel(validation: VoiceContextValidation) {
  if (validation.status === "ready") return "Ready";
  if (validation.status === "missing_required") return "Missing keys";
  return "No session";
}

function diagnosticStatusLabel(step: VoiceDiagnosticStep) {
  if (step.status === "failed") return "Stopped";
  if (step.status === "passed") return "OK";
  if (step.status === "running") return "Checking";
  if (step.status === "skipped") return "Skipped";
  return "Waiting";
}

function diagnosticPillTone(step: VoiceDiagnosticStep): "neutral" | "good" | "warn" | "dark" {
  if (step.status === "failed") return "warn";
  if (step.status === "passed") return "good";
  if (step.status === "running") return "dark";
  return "neutral";
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "dark" }) {
  const classes = {
    neutral: "border-[#eadfd5] bg-white text-[#5b4a46]",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    dark: "border-[#2f2135] bg-[#2f2135] text-white",
  }[tone];

  return (
    <span className={`inline-flex min-h-[30px] items-center rounded-full border px-3 text-xs font-black ${classes}`}>
      {children}
    </span>
  );
}

function MetricTile({ icon: Icon, label, value, sub }: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">{label}</p>
          <p className="mt-1 truncate text-lg font-black text-[#2f2135]">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[#7d6b65]">{sub}</p>
    </section>
  );
}

function formatTimelineTime(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimelineDate(at: number) {
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number) {
  if (ms < 1000) return "<1s";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function timelineMarkerClass(severity: "info" | "success" | "warning" | "error") {
  if (severity === "success") return "bg-emerald-500";
  if (severity === "warning") return "bg-amber-500";
  if (severity === "error") return "bg-red-500";
  return "bg-purple-500";
}

function isPersistedTimelineEvent(event: VoiceTimelineEvent): event is PersistedVoiceTimelineEvent {
  return "userId" in event;
}

function reviewStatusTone(status: VoiceQaReviewStatus): "neutral" | "good" | "warn" | "dark" {
  if (status === "good" || status === "reviewed") return "good";
  if (status === "unreviewed") return "neutral";
  if (status === "prompt_fix_needed" || status === "app_fix_needed" || status === "elevenlabs_config_needed") return "dark";
  return "warn";
}

function isUnresolvedReviewStatus(status: VoiceQaReviewStatus) {
  return status === "unreviewed" ||
    status === "needs_review" ||
    status === "prompt_fix_needed" ||
    status === "app_fix_needed" ||
    status === "elevenlabs_config_needed";
}

function matchesVoiceQaQueue(session: VoiceQaSession, status: VoiceQaReviewStatus, queue: VoiceQaQueueFilter) {
  if (queue === "all") return true;
  if (queue === "flagged") return session.flags.length > 0 || session.errorCount > 0 || session.dismissedActionCount > 0;
  if (queue === "unresolved") return isUnresolvedReviewStatus(status);
  return status === queue;
}

function exportStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function downloadTextFile(filename: string, body: string, mimeType: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([body], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function AgentCard({ contract, validation, active }: {
  contract: VoiceAgentContract;
  validation: VoiceContextValidation;
  active: boolean;
}) {
  const missingPreview = validation.missingRequiredKeys.slice(0, 5);

  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${active ? "border-purple-300 ring-2 ring-purple-100" : "border-[#eadfd5]"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-[#2f2135]">{contract.name}</h2>
            {active && <Pill tone="dark">Current</Pill>}
            <Pill tone={validation.status === "ready" ? "good" : validation.status === "missing_required" ? "warn" : "neutral"}>
              {statusLabel(validation)} - {validation.coveragePct}%
            </Pill>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#7d6b65]">{contract.notes}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Pill>{contract.domain}</Pill>
          {contract.agentSlug && <Pill>{contract.agentSlug}</Pill>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Entrypoints</p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4352]">{contract.entrypoints.join(", ")}</p>
        </div>
        <div className="rounded-xl bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Plans</p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4352]">{contract.planIds.join(", ")}</p>
        </div>
        <div className="rounded-xl bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Actions</p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-[#4f4352]">{contract.actionTypes.join(", ")}</p>
        </div>
      </div>

      {validation.status === "missing_required" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-sm font-black text-amber-900">
            <AlertTriangle size={16} />
            Missing required context
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingPreview.map((key) => <Pill key={key} tone="warn">{key}</Pill>)}
            {validation.missingRequiredKeys.length > missingPreview.length && (
              <Pill tone="warn">+{validation.missingRequiredKeys.length - missingPreview.length} more</Pill>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function VoiceReadinessAdminPage() {
  const {
    status,
    isMicMuted,
    isTransferring,
    voiceSessionPhase,
    transcript,
    lastResolvedSessionContext,
    voiceDiagnostics,
  } = useVyvaVoice();
  const { activeAction, isActiveActionAccepted } = useVoiceActionContext();
  const timelineEvents = useVoiceTimeline();
  const [persistedTimelineEvents, setPersistedTimelineEvents] = useState<PersistedVoiceTimelineEvent[]>([]);
  const [timelineServerStatus, setTimelineServerStatus] = useState("Local timeline ready");
  const [utterance, setUtterance] = useState(QUICK_UTTERANCES[0]);
  const [simulatorMessage, setSimulatorMessage] = useState("");
  const [qaFilters, setQaFilters] = useState<VoiceTimelineFilter>(DEFAULT_QA_FILTERS);
  const [qaQueueFilter, setQaQueueFilter] = useState<VoiceQaQueueFilter>("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>("all");
  const [qaReviews, setQaReviews] = useState<VoiceQaSessionReview[]>([]);
  const [qaReviewDrafts, setQaReviewDrafts] = useState<Record<string, VoiceQaReviewDraft>>({});
  const [qaExportStatus, setQaExportStatus] = useState("");
  const displayedTimelineEvents: VoiceTimelineEvent[] = useMemo(() => (
    persistedTimelineEvents.length > 0 ? persistedTimelineEvents : [...timelineEvents].reverse()
  ), [persistedTimelineEvents, timelineEvents]);
  const filteredTimelineEvents = useMemo(() => (
    filterVoiceTimelineEvents(displayedTimelineEvents, qaFilters)
  ), [displayedTimelineEvents, qaFilters]);
  const filterOptions = useMemo(() => timelineFilterOptions(displayedTimelineEvents), [displayedTimelineEvents]);
  const qaDashboard = useMemo(() => buildVoiceQaDashboard(filteredTimelineEvents), [filteredTimelineEvents]);
  const qaReviewBySessionId = useMemo(() => new Map(qaReviews.map((review) => [review.sessionId, review])), [qaReviews]);
  const reviewStatusForSession = useCallback(
    (sessionId: string): VoiceQaReviewStatus => qaReviewDrafts[sessionId]?.status ?? qaReviewBySessionId.get(sessionId)?.status ?? "unreviewed",
    [qaReviewBySessionId, qaReviewDrafts],
  );
  const qaQueueCounts = useMemo<Record<VoiceQaQueueFilter, number>>(() => ({
    all: qaDashboard.sessions.length,
    flagged: qaDashboard.sessions.filter((session) => matchesVoiceQaQueue(session, reviewStatusForSession(session.sessionId), "flagged")).length,
    unresolved: qaDashboard.sessions.filter((session) => matchesVoiceQaQueue(session, reviewStatusForSession(session.sessionId), "unresolved")).length,
    prompt_fix_needed: qaDashboard.sessions.filter((session) => matchesVoiceQaQueue(session, reviewStatusForSession(session.sessionId), "prompt_fix_needed")).length,
    app_fix_needed: qaDashboard.sessions.filter((session) => matchesVoiceQaQueue(session, reviewStatusForSession(session.sessionId), "app_fix_needed")).length,
    elevenlabs_config_needed: qaDashboard.sessions.filter((session) => matchesVoiceQaQueue(session, reviewStatusForSession(session.sessionId), "elevenlabs_config_needed")).length,
  }), [qaDashboard.sessions, reviewStatusForSession]);
  const visibleQaSessions = useMemo(() => {
    const sessions = qaDashboard.sessions.filter((session) => {
      const status = reviewStatusForSession(session.sessionId);
      if (reviewStatusFilter === "all") return true;
      if (reviewStatusFilter === "unresolved") return isUnresolvedReviewStatus(status);
      return status === reviewStatusFilter;
    }).filter((session) => matchesVoiceQaQueue(session, reviewStatusForSession(session.sessionId), qaQueueFilter));

    return sessions.sort((a, b) => {
      const aStatus = reviewStatusForSession(a.sessionId);
      const bStatus = reviewStatusForSession(b.sessionId);
      const aPriority = isUnresolvedReviewStatus(aStatus) ? 0 : 1;
      const bPriority = isUnresolvedReviewStatus(bStatus) ? 0 : 1;
      return aPriority - bPriority || b.startedAt - a.startedAt;
    });
  }, [qaDashboard.sessions, qaQueueFilter, reviewStatusFilter, reviewStatusForSession]);

  const currentContract = voiceAgentContractFor({
    domain: lastResolvedSessionContext?.domain,
    agentSlug: lastResolvedSessionContext?.agentSlug,
    conversationPlanId: lastResolvedSessionContext?.conversationPlanId,
  });
  const currentValidation = validateVoiceAgentContext(
    currentContract,
    lastResolvedSessionContext?.dynamicVariables,
  );
  const variableEntries = useMemo(() => (
    Object.entries(lastResolvedSessionContext?.dynamicVariables ?? {})
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim().length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
  ), [lastResolvedSessionContext?.dynamicVariables]);
  const actionEntries = useMemo(() => voiceActionRegistryEntries(), []);
  const agentRows = useMemo(() => (
    VOICE_AGENT_CONTRACTS.map((contract) => ({
      contract,
      validation: validateVoiceAgentContext(
        contract,
        contract.id === currentContract.id ? lastResolvedSessionContext?.dynamicVariables : undefined,
      ),
    }))
  ), [currentContract.id, lastResolvedSessionContext?.dynamicVariables]);
  const failedVoiceDiagnostic = voiceDiagnostics.find((step) => step.status === "failed");
  const activeVoiceDiagnostic = failedVoiceDiagnostic ?? [...voiceDiagnostics].reverse().find((step) => step.status !== "pending");

  async function refreshPersistedTimeline() {
    try {
      setTimelineServerStatus("Syncing latest events...");
      await flushVoiceTimelineEvents();
      const [events, reviews] = await Promise.all([
        fetchPersistedVoiceTimelineEvents(120),
        fetchVoiceQaSessionReviews(),
      ]);
      setPersistedTimelineEvents(events);
      setQaReviews(reviews);
      setTimelineServerStatus(events.length > 0
        ? `${events.length} persisted QA events loaded`
        : "No persisted QA events yet");
    } catch {
      setTimelineServerStatus("Persisted QA timeline unavailable");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setTimelineServerStatus("Loading persisted QA events...");
        await flushVoiceTimelineEvents();
        const [events, reviews] = await Promise.all([
          fetchPersistedVoiceTimelineEvents(120),
          fetchVoiceQaSessionReviews(),
        ]);
        if (cancelled) return;
        setPersistedTimelineEvents(events);
        setQaReviews(reviews);
        setTimelineServerStatus(events.length > 0
          ? `${events.length} persisted QA events loaded`
          : "No persisted QA events yet");
      } catch {
        if (!cancelled) setTimelineServerStatus("Persisted QA timeline unavailable");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function simulateUtterance(value = utterance) {
    const action = actionForVoiceUtterance(value);
    if (!action) {
      setSimulatorMessage("No app action matched that utterance.");
      recordVoiceTimelineEvent({
        kind: "simulator",
        title: "Simulator utterance did not match",
        detail: value,
        severity: "warning",
      });
      return;
    }
    emitVoiceAppAction(action);
    setSimulatorMessage(`Matched ${action.actionType ?? action.id} - ${action.route}`);
    recordVoiceTimelineEvent({
      kind: "simulator",
      title: "Simulator utterance matched",
      detail: value,
      domain: action.domain,
      route: action.route,
      actionId: action.id,
      ...(action.actionType ? { actionType: action.actionType } : {}),
    });
  }

  function draftForSession(sessionId: string): VoiceQaReviewDraft {
    return qaReviewDrafts[sessionId] ?? {
      status: qaReviewBySessionId.get(sessionId)?.status ?? "unreviewed",
      note: qaReviewBySessionId.get(sessionId)?.note ?? "",
    };
  }

  function updateReviewDraft(sessionId: string, draft: Partial<VoiceQaReviewDraft>) {
    setQaReviewDrafts((current) => {
      const persisted = qaReviewBySessionId.get(sessionId);
      const currentDraft = current[sessionId] ?? {
        status: persisted?.status ?? "unreviewed",
        note: persisted?.note ?? "",
      };
      return {
        ...current,
        [sessionId]: {
          ...currentDraft,
          ...draft,
        },
      };
    });
  }

  async function saveSessionReview(sessionId: string) {
    const draft = draftForSession(sessionId);
    try {
      const review = await saveVoiceQaSessionReview({
        sessionId,
        status: draft.status,
        note: draft.note,
      });
      if (review) {
        setQaReviews((current) => [
          review,
          ...current.filter((item) => item.sessionId !== review.sessionId),
        ]);
      }
      setQaReviewDrafts((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      setQaExportStatus(`Review saved for ${sessionId}.`);
    } catch {
      setQaExportStatus(`Could not save review for ${sessionId}.`);
    }
  }

  function exportReplayPack() {
    const pack = buildVoiceReplayPack(visibleQaSessions);
    downloadTextFile(
      `vyva-voice-replay-pack-${exportStamp()}.json`,
      JSON.stringify(pack, null, 2),
      "application/json",
    );
    setQaExportStatus(`Replay pack exported for ${pack.sessionCount} sessions.`);
  }

  function exportSessionCsv() {
    downloadTextFile(
      `vyva-voice-session-summary-${exportStamp()}.csv`,
      voiceQaSessionsToCsv(visibleQaSessions),
      "text/csv",
    );
    setQaExportStatus(`CSV exported for ${visibleQaSessions.length} sessions.`);
  }

  async function copyPromptDebugContext() {
    const session = visibleQaSessions[0];
    if (!session) {
      setQaExportStatus("No filtered session to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(buildVoicePromptDebugContext(session));
      setQaExportStatus(`Prompt debug copied for ${session.sessionId}.`);
    } catch {
      setQaExportStatus("Clipboard is unavailable in this browser session.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Voice readiness"
          subtitle="Inspect agent contracts, selected plans, live voice state, context keys, and simulator shortcuts before configuring ElevenLabs prompts."
        >
          <Pill tone={currentValidation.status === "ready" ? "good" : currentValidation.status === "missing_required" ? "warn" : "neutral"}>
            {currentContract.name}: {statusLabel(currentValidation)}
          </Pill>
        </AdminPageHeader>

        <AdminMenu />

        <ElevenLabsConversationReviewPanel />

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile
            icon={Mic}
            label="Voice state"
            value={voiceSessionPhaseLabel(voiceSessionPhase)}
            sub={`${status}${isMicMuted ? " - mic off" : " - mic on"}${isTransferring ? " - transfer pending" : ""}`}
          />
          <MetricTile
            icon={GitBranch}
            label="Plan"
            value={lastResolvedSessionContext?.conversationPlanId ?? "No session yet"}
            sub={lastResolvedSessionContext?.appEntrypoint ? `Entrypoint: ${lastResolvedSessionContext.appEntrypoint}` : "Start a voice session to resolve a plan."}
          />
          <MetricTile
            icon={KeyRound}
            label="Context keys"
            value={`${currentValidation.presentRequiredKeys.length}/${currentContract.requiredContextKeys.length}`}
            sub={`${variableEntries.length} populated variables available in the last resolved session.`}
          />
          <MetricTile
            icon={Route}
            label="Active action"
            value={activeAction?.title ?? "None"}
            sub={activeAction ? `${activeAction.route} - ${isActiveActionAccepted ? "confirmed" : "not confirmed"}` : "No current app action."}
          />
          <MetricTile
            icon={RadioTower}
            label="Voice health"
            value={activeVoiceDiagnostic ? `${activeVoiceDiagnostic.label}: ${diagnosticStatusLabel(activeVoiceDiagnostic)}` : "No check yet"}
            sub={activeVoiceDiagnostic?.detail ?? "Start voice to run browser, account, agent, key, signed URL, and session checks."}
          />
        </section>

        <section className="mt-5 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm" data-testid="voice-health-diagnostics">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Voice health</p>
              <h2 className="mt-1 text-lg font-black text-[#2f2135]">Connection checklist</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#7d6b65]">
                Shows the most recent voice start path across microphone, access, agent config, server key, signed URL, and browser session.
              </p>
            </div>
            {failedVoiceDiagnostic ? (
              <Pill tone="warn">Stopped at {failedVoiceDiagnostic.label}</Pill>
            ) : (
              <Pill tone={activeVoiceDiagnostic?.status === "passed" ? "good" : "neutral"}>
                {activeVoiceDiagnostic ? diagnosticStatusLabel(activeVoiceDiagnostic) : "Idle"}
              </Pill>
            )}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {voiceDiagnostics.map((step) => (
              <div key={step.id} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid={`voice-health-${step.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-[#2f2135]">{step.label}</p>
                  <Pill tone={diagnosticPillTone(step)}>{diagnosticStatusLabel(step)}</Pill>
                </div>
                <p className="mt-2 min-h-[20px] break-words text-sm leading-relaxed text-[#7d6b65]">
                  {step.detail ?? "Waiting for next voice start."}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Voice QA console</p>
              <h2 className="mt-1 text-xl font-black text-[#2f2135]">Session grouping and filters</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#7d6b65]">
                Review persisted app-side voice behavior by session, agent, event type, severity, and route before adjusting ElevenLabs prompts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone={qaDashboard.totalIssues > 0 ? "warn" : "good"}>{qaDashboard.totalIssues} QA flags</Pill>
              <Pill>{visibleQaSessions.length}/{qaDashboard.sessions.length} sessions</Pill>
              <Pill>{qaDashboard.filteredEventCount} events</Pill>
            </div>
          </div>

          <section className="mt-4 rounded-xl border border-[#eadfd5] bg-[#fbf8f5] p-3" data-testid="voice-qa-work-queue">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-black text-[#2f2135]">QA work queue</h3>
                <p className="mt-1 text-sm font-bold text-[#7d6b65]">
                  Showing {visibleQaSessions.length} of {qaDashboard.sessions.length} sessions.
                </p>
              </div>
              {qaQueueFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setQaQueueFilter("all")}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-800 transition hover:border-purple-300"
                  data-testid="voice-qa-clear-work-queue"
                >
                  Show all
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              {VOICE_QA_QUEUE_FILTERS.map((queue) => {
                const active = qaQueueFilter === queue.id;
                return (
                  <button
                    key={queue.id}
                    type="button"
                    onClick={() => {
                      setQaQueueFilter(queue.id);
                      if (queue.id !== "all") setReviewStatusFilter("all");
                    }}
                    className={`min-h-[84px] rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                        : "border-[#eadfd5] bg-white text-[#2f2135] hover:border-purple-200"
                    }`}
                    data-testid={`voice-qa-queue-${queue.id}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black">{queue.label}</span>
                      <span className="text-xl font-black leading-none">{qaQueueCounts[queue.id]}</span>
                    </span>
                    <span className="sr-only">{queue.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(150px,0.8fr))]">
            <input
              value={qaFilters.query}
              onChange={(event) => setQaFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Search title, route, session, plan..."
              className="min-h-[44px] rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold outline-none focus:border-purple-300"
            />
            <select
              value={qaFilters.domain}
              onChange={(event) => setQaFilters((current) => ({ ...current, domain: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold text-[#4f4352] outline-none focus:border-purple-300"
            >
              <option value="all">All domains</option>
              {filterOptions.domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
            </select>
            <select
              value={qaFilters.kind}
              onChange={(event) => setQaFilters((current) => ({ ...current, kind: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold text-[#4f4352] outline-none focus:border-purple-300"
            >
              <option value="all">All events</option>
              {filterOptions.kinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
            <select
              value={qaFilters.severity}
              onChange={(event) => setQaFilters((current) => ({ ...current, severity: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold text-[#4f4352] outline-none focus:border-purple-300"
            >
              <option value="all">All severities</option>
              {filterOptions.severities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
            </select>
            <select
              value={reviewStatusFilter}
              onChange={(event) => setReviewStatusFilter(event.target.value as ReviewStatusFilter)}
              className="min-h-[44px] rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold text-[#4f4352] outline-none focus:border-purple-300"
            >
              <option value="all">All reviews</option>
              <option value="unresolved">Unresolved</option>
              {VOICE_QA_REVIEW_STATUSES.map((status) => (
                <option key={status} value={status}>{voiceQaReviewStatusLabel(status)}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 rounded-xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-black text-[#2f2135]">Replay export</h3>
                <p className="mt-1 text-sm font-bold text-[#7d6b65]">
                  Filtered sessions are packaged for prompt tuning and ElevenLabs tool testing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportReplayPack}
                  disabled={visibleQaSessions.length === 0}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#2f2135] px-3 text-xs font-black text-white transition hover:bg-[#47324f] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <FileJson size={15} />
                  Replay JSON
                </button>
                <button
                  type="button"
                  onClick={exportSessionCsv}
                  disabled={visibleQaSessions.length === 0}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download size={15} />
                  CSV summary
                </button>
                <button
                  type="button"
                  onClick={() => void copyPromptDebugContext()}
                  disabled={visibleQaSessions.length === 0}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Clipboard size={15} />
                  Copy debug
                </button>
              </div>
            </div>
            {qaExportStatus && (
              <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#5b4a46]">
                {qaExportStatus}
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div className="rounded-xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-[#2f2135]">Agent performance</h3>
                <Pill>{qaDashboard.agentPerformance.length} agents</Pill>
              </div>
              <div className="mt-3 max-h-[340px] space-y-2 overflow-auto pr-1">
                {qaDashboard.agentPerformance.length > 0 ? qaDashboard.agentPerformance.slice(0, 8).map((agent) => (
                  <article key={agent.key} className="rounded-xl border border-[#eadfd5] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-black text-[#2f2135]">{agent.label}</p>
                      <Pill tone={agent.errors > 0 || agent.dismissedActions > 0 ? "warn" : "good"}>
                        {agent.sessions} sessions
                      </Pill>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs font-black text-[#5b4a46]">
                      <span className="rounded-lg bg-[#fbf8f5] px-2 py-2">{agent.transfers} transfers</span>
                      <span className="rounded-lg bg-[#fbf8f5] px-2 py-2">{agent.completedActions} done</span>
                      <span className="rounded-lg bg-[#fbf8f5] px-2 py-2">{agent.dismissedActions} dismissed</span>
                      <span className="rounded-lg bg-[#fbf8f5] px-2 py-2">{agent.errors} errors</span>
                    </div>
                  </article>
                )) : (
                  <p className="rounded-xl bg-white p-3 text-sm font-bold text-[#7d6b65]">No agent activity matches these filters.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-[#2f2135]">Recent sessions</h3>
                <Pill tone={qaDashboard.totalIssues > 0 ? "warn" : "good"}>
                  {visibleQaSessions.filter((session) => session.flags.length > 0).length} flagged
                </Pill>
              </div>
              <div className="mt-3 max-h-[340px] space-y-2 overflow-auto pr-1" data-testid="voice-qa-session-list">
                {visibleQaSessions.length > 0 ? visibleQaSessions.slice(0, 8).map((session) => {
                  const review = draftForSession(session.sessionId);
                  return (
                    <article key={session.id} className="rounded-xl border border-[#eadfd5] bg-white p-3" data-testid={`voice-qa-session-${session.sessionId}`}>
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black text-[#2f2135]">{session.latestTitle}</p>
                          <p className="mt-1 break-words text-xs font-bold text-[#8b7a73]">
                            {session.sessionId} - {formatTimelineDate(session.startedAt)} - {formatDuration(session.durationMs)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 lg:justify-end">
                          <Pill>{session.domain}</Pill>
                          <Pill>{session.eventCount} events</Pill>
                          <Pill tone={reviewStatusTone(review.status)}>{voiceQaReviewStatusLabel(review.status)}</Pill>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {session.flags.length > 0 ? session.flags.map((flag) => (
                          <Pill key={flag} tone="warn">{flag}</Pill>
                        )) : (
                          <Pill tone="good">Clean</Pill>
                        )}
                        {session.transferCount > 0 && <Pill>{session.transferCount} transfers</Pill>}
                        {session.completedActionCount > 0 && <Pill tone="good">{session.completedActionCount} completed</Pill>}
                        {session.conversationPlanId !== "unknown" && <Pill>{session.conversationPlanId}</Pill>}
                      </div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-[180px_1fr_auto]">
                        <select
                          value={review.status}
                          onChange={(event) => updateReviewDraft(session.sessionId, { status: event.target.value as VoiceQaReviewStatus })}
                          className="min-h-[40px] rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-xs font-black text-[#4f4352] outline-none focus:border-purple-300"
                        >
                          {VOICE_QA_REVIEW_STATUSES.map((status) => (
                            <option key={status} value={status}>{voiceQaReviewStatusLabel(status)}</option>
                          ))}
                        </select>
                        <input
                          value={review.note}
                          onChange={(event) => updateReviewDraft(session.sessionId, { note: event.target.value })}
                          placeholder="QA note"
                          className="min-h-[40px] rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-xs font-bold outline-none focus:border-purple-300"
                        />
                        <button
                          type="button"
                          onClick={() => void saveSessionReview(session.sessionId)}
                          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-[#2f2135] px-3 text-xs font-black text-white transition hover:bg-[#47324f]"
                        >
                          <Save size={14} />
                          Save
                        </button>
                      </div>
                    </article>
                  );
                }) : (
                  <p className="rounded-xl bg-white p-3 text-sm font-bold text-[#7d6b65]">No sessions match these filters.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="space-y-4">
            {agentRows.map(({ contract, validation }) => (
              <AgentCard
                key={contract.id}
                contract={contract}
                validation={validation}
                active={contract.id === currentContract.id}
              />
            ))}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
                  <TestTube2 size={19} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Simulator shortcuts</h2>
                  <p className="text-sm text-[#7d6b65]">Test app-side routing without ElevenLabs.</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={utterance}
                  onChange={(event) => setUtterance(event.target.value)}
                  className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold outline-none focus:border-purple-300"
                />
                <button
                  type="button"
                  onClick={() => simulateUtterance()}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-purple-700 px-4 text-sm font-black text-white transition hover:bg-purple-800"
                >
                  Test
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_UTTERANCES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setUtterance(item);
                      simulateUtterance(item);
                    }}
                    className="rounded-full border border-[#eadfd5] bg-[#fbf8f5] px-3 py-2 text-left text-xs font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
                  >
                    {item}
                  </button>
                ))}
              </div>

              {simulatorMessage && (
                <p className="mt-3 rounded-xl bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800">
                  {simulatorMessage}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
                    <Activity size={19} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">Voice timeline</h2>
                    <p className="text-sm text-[#7d6b65]">{timelineServerStatus}</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshPersistedTimeline()}
                    className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
                  >
                    Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearVoiceTimeline();
                      setTimelineServerStatus("Local timeline cleared");
                    }}
                    className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#5b4a46] transition hover:border-red-200 hover:text-red-700"
                  >
                    Clear local
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-[440px] space-y-3 overflow-auto pr-1">
                {filteredTimelineEvents.length > 0 ? filteredTimelineEvents.slice(0, 18).map((event) => (
                  <article key={event.id} className="relative rounded-xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${timelineMarkerClass(event.severity)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 break-words text-sm font-black text-[#2f2135]">{event.title}</p>
                          <span className="text-xs font-bold text-[#8b7a73]">{formatTimelineTime(event.at)}</span>
                        </div>
                        <p className="mt-1 break-words text-xs font-bold text-[#7d6b65]">
                          {event.detail || event.kind}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Pill>{event.kind}</Pill>
                          {event.domain && <Pill>{event.domain}</Pill>}
                          {event.route && <Pill>{event.route}</Pill>}
                          {event.conversationPlanId && <Pill>{event.conversationPlanId}</Pill>}
                          {isPersistedTimelineEvent(event) && event.userId && <Pill>persisted</Pill>}
                        </div>
                      </div>
                    </div>
                  </article>
                )) : (
                  <p className="rounded-xl bg-[#fbf8f5] p-3 text-sm font-bold text-[#7d6b65]">
                    No voice timeline events match the current filters.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
                  <Sparkles size={19} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Current action</h2>
                  <p className="text-sm text-[#7d6b65]">What the app is fulfilling now.</p>
                </div>
              </div>

              {activeAction ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-[#fbf8f5] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Route</p>
                    <p className="mt-1 text-sm font-black text-[#2f2135]">{activeAction.route}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={isActiveActionAccepted ? "good" : activeAction.requiresConfirmation ? "warn" : "neutral"}>
                      {isActiveActionAccepted ? "Confirmed" : activeAction.requiresConfirmation ? "Needs tap" : "No tap required"}
                    </Pill>
                    <Pill>{activeAction.domain}</Pill>
                    {activeAction.actionType && <Pill>{activeAction.actionType}</Pill>}
                  </div>
                  {activeAction.payload && (
                    <div className="rounded-xl bg-[#fbf8f5] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Payload</p>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs font-bold text-[#4f4352]">
                        {JSON.stringify(activeAction.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-[#fbf8f5] p-3 text-sm font-bold text-[#7d6b65]">
                  No active voice action.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f0ff] text-purple-700">
                  <RadioTower size={19} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Agent slugs</h2>
                  <p className="text-sm text-[#7d6b65]">Expected app-to-agent mapping.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {Object.entries(VOICE_SPECIALIST_AGENT_SLUGS).map(([domain, slug]) => (
                  <div key={domain} className="flex items-center justify-between gap-3 rounded-xl bg-[#fbf8f5] px-3 py-2">
                    <span className="text-sm font-black text-[#2f2135]">{domain}</span>
                    <span className="text-sm font-bold text-[#7d6b65]">{slug}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Resolved context variables</h2>
              <Pill tone={currentValidation.status === "ready" ? "good" : currentValidation.status === "missing_required" ? "warn" : "neutral"}>
                {variableEntries.length} populated
              </Pill>
            </div>
            <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-[#eadfd5]">
              {variableEntries.length > 0 ? variableEntries.map(([key, value]) => (
                <div key={key} className="grid gap-2 border-b border-[#eadfd5] p-3 last:border-b-0 md:grid-cols-[220px_1fr]">
                  <span className="break-words text-sm font-black text-[#2f2135]">{key}</span>
                  <span className="break-words text-sm font-bold text-[#7d6b65]">{String(value).slice(0, 320)}</span>
                </div>
              )) : (
                <p className="p-4 text-sm font-bold text-[#7d6b65]">Start a voice session to inspect context variables.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Registry coverage</h2>
              <Pill>{actionEntries.length} actions</Pill>
            </div>
            <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-[#eadfd5]">
              {actionEntries.map((entry) => (
                <div key={entry.actionType} className="grid gap-2 border-b border-[#eadfd5] p-3 last:border-b-0 md:grid-cols-[220px_1fr]">
                  <div>
                    <p className="text-sm font-black text-[#2f2135]">{entry.actionType}</p>
                    <p className="mt-1 text-xs font-bold text-[#8b7a73]">{entry.domain} - {entry.route}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.requiredPayloadKeys.length > 0 ? entry.requiredPayloadKeys.map((key) => <Pill key={key} tone="warn">{key}</Pill>) : <Pill tone="good">No required payload</Pill>}
                    {entry.optionalPayloadKeys.slice(0, 5).map((key) => <Pill key={key}>{key}</Pill>)}
                    {entry.requiresConfirmation && <Pill tone="warn">tap confirm</Pill>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="flex items-center gap-2 text-sm font-black">
            <CheckCircle2 size={17} />
            ElevenLabs prompt prep rule
          </p>
          <p className="mt-2 text-sm font-bold leading-relaxed">
            Do not update a prompt until its contract is ready for a real session, or the missing keys are accepted as intentionally unavailable for that agent.
          </p>
          {transcript.length > 0 && (
            <p className="mt-2 text-sm font-bold leading-relaxed">
              Transcript entries in current session: {transcript.length}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
