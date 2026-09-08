import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  PlayCircle,
  RotateCw,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/queryClient";
import {
  COGNITIVE_ASSESSMENT_PROGRAM_FREQUENCIES,
  cognitiveAssessmentFrequencyLabel,
  type CognitiveAssessmentProgramFrequency,
  type CognitiveAssessmentProgramJoinResponse,
  type CognitiveAssessmentProgramStatusResponse,
} from "../../shared/cognitiveAssessmentProgram";

const PROGRAM_QUERY_KEY = ["/api/cognitive-assessment/program"] as const;

function todayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
}

const FREQUENCY_DETAILS: Record<CognitiveAssessmentProgramFrequency, string> = {
  weekly: "Close",
  every_2_weeks: "Balanced",
  monthly: "Default",
};

const FREQUENCY_TITLES: Record<CognitiveAssessmentProgramFrequency, string> = {
  weekly: "Weekly",
  every_2_weeks: "2 weeks",
  monthly: "Monthly",
};

const FREQUENCY_TONES: Record<CognitiveAssessmentProgramFrequency, { base: string; selected: string; marker: string }> = {
  weekly: {
    base: "border-[#FED7AA] bg-[#FFF7ED]",
    selected: "border-[#EA580C] bg-[#FFEDD5] shadow-[0_12px_24px_rgba(234,88,12,0.16)]",
    marker: "text-[#C2410C]",
  },
  every_2_weeks: {
    base: "border-[#BAE6FD] bg-[#F0F9FF]",
    selected: "border-[#0284C7] bg-[#E0F2FE] shadow-[0_12px_24px_rgba(2,132,199,0.16)]",
    marker: "text-[#0369A1]",
  },
  monthly: {
    base: "border-[#DDD6FE] bg-[#F5F3FF]",
    selected: "border-[#7C3AED] bg-[#EDE9FE] shadow-[0_12px_24px_rgba(124,58,237,0.18)]",
    marker: "text-[#6B21A8]",
  },
};

const REMINDER_TIME_CHOICES = [
  { label: "Morning", value: "09:00", display: "9:00" },
  { label: "Late morning", value: "10:00", display: "10:00" },
  { label: "Afternoon", value: "14:00", display: "2:00" },
  { label: "Evening", value: "18:00", display: "6:00" },
] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not scheduled yet";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No report yet";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function setupSummary(frequency: CognitiveAssessmentProgramFrequency) {
  if (frequency === "weekly") return "Close tracking";
  if (frequency === "every_2_weeks") return "Balanced rhythm";
  return "Recommended";
}

function activeProgramMessage(program: CognitiveAssessmentProgramStatusResponse) {
  if (program.latestUnfinishedSession) {
    const completed = program.latestUnfinishedSession.tasksCompleted;
    const total = program.latestUnfinishedSession.totalTasks;
    return `You have a check in progress with ${completed}/${total} steps saved.`;
  }
  if (program.latestReport) return "Your last report is ready. Start the next check when you are ready.";
  return "You are joined. Finish one guided check to unlock your first report.";
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/mind-memory")}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#2f2135] shadow-[0_8px_20px_rgba(63,45,35,0.07)]"
    >
      <ArrowLeft size={18} />
      Mind & Memory
    </button>
  );
}

function HubShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F7F2EB] pb-28">
      <header className="mx-auto w-full max-w-[980px] px-5 pt-5 md:px-7">
        <BackButton />
      </header>
      {children}
    </main>
  );
}

function ProgramSetup() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(todayInputValue);
  const [frequency, setFrequency] = useState<CognitiveAssessmentProgramFrequency>("monthly");
  const [reminderTime, setReminderTime] = useState("10:00");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [error, setError] = useState("");
  const joinMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/cognitive-assessment/program/join", {
        method: "POST",
        body: JSON.stringify({ startDate, frequency, reminderTime, timezone }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Cognitive Assessment program could not be joined.");
      }
      return response.json() as Promise<CognitiveAssessmentProgramJoinResponse>;
    },
    onSuccess: (data) => {
      setError("");
      queryClient.setQueryData(PROGRAM_QUERY_KEY, data.program);
      void queryClient.invalidateQueries({ queryKey: PROGRAM_QUERY_KEY });
    },
    onError: (joinError) => {
      setError(joinError instanceof Error ? joinError.message : "Cognitive Assessment program could not be joined.");
    },
  });

  return (
    <HubShell>
      <section className="mx-auto w-full max-w-[980px] px-5 pt-5 md:px-7">
        <div className="rounded-[30px] border border-[#DDD6FE] bg-white p-4 shadow-[0_18px_40px_rgba(63,45,35,0.08)] md:p-5">
          <span className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-[#F5F3FF] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">
            <Brain size={16} />
            Mind & Memory
          </span>
          <h1 className="mt-3 text-[38px] font-black leading-[0.96] text-[#2f2135] md:text-[52px]">
            Check in
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {["10-15 min", "Monthly", "Report"].map((label) => (
              <span key={label} className="rounded-full bg-[#FFFCF8] px-3 py-2 text-[13px] font-black text-[#62564f]">
                {label}
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Clock3, title: "Plan" },
              { icon: FileText, title: "Answer" },
              { icon: BarChart3, title: "Track" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex min-h-[78px] flex-col justify-between rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] p-3 md:min-h-0 md:flex-row md:items-center md:justify-start md:gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#6B21A8] md:h-11 md:w-11">
                    <Icon size={20} />
                  </span>
                  <span className="block text-[15px] font-black leading-tight text-[#2f2135] md:text-[20px]">
                    {item.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 rounded-[28px] border border-[#E8DED4] bg-white p-4 shadow-[0_12px_28px_rgba(63,45,35,0.06)] md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B21A8]">Setup</p>
              <h2 className="mt-1 text-[30px] font-black leading-tight text-[#2f2135]">Set reminder</h2>
              <p className="mt-1 text-[14px] font-black text-[#766b63]">{FREQUENCY_TITLES[frequency]} - {setupSummary(frequency)}</p>
            </div>
            <div className="flex flex-col gap-2 md:min-w-[190px]">
              <button
                type="button"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                className="inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#7C3AED] px-5 text-[20px] font-black text-white shadow-[0_14px_28px_rgba(124,58,237,0.22)] disabled:opacity-60"
              >
                {joinMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                JOIN
              </button>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <span className="inline-flex min-h-[32px] items-center rounded-full bg-[#F5F3FF] px-3 text-xs font-black text-[#6B21A8]">
                  Easy
                </span>
                <span className="inline-flex min-h-[32px] items-center rounded-full bg-[#FFFCF8] px-3 text-xs font-black text-[#766b63]">
                  Change later
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">Rhythm</span>
            <div className="grid gap-3 md:grid-cols-3">
              {COGNITIVE_ASSESSMENT_PROGRAM_FREQUENCIES.map((option) => {
                const selected = frequency === option;
                const tone = FREQUENCY_TONES[option];
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFrequency(option)}
                    className={`min-h-[94px] rounded-[20px] border px-4 py-3 text-left transition ${selected ? tone.selected : tone.base}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[28px] font-black leading-none text-[#2f2135]">{FREQUENCY_TITLES[option]}</span>
                      {selected ? <CheckCircle2 size={19} className="shrink-0 text-[#6B21A8]" /> : option === "monthly" ? (
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#6B21A8]">Best</span>
                      ) : null}
                    </span>
                    <span className="sr-only">{FREQUENCY_DETAILS[option]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.2fr_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="min-h-[54px] w-full rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] px-4 text-[15px] font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              />
            </label>
            <div>
              <label className="block" htmlFor="cognitive-assessment-reminder-time">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">Time</span>
                <input
                  id="cognitive-assessment-reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  className="min-h-[54px] w-full rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] px-4 text-[15px] font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REMINDER_TIME_CHOICES.map((choice) => {
                  const selected = reminderTime === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setReminderTime(choice.value)}
                      className={`min-h-[48px] rounded-[16px] border px-3 text-xs font-black leading-tight transition ${
                        selected
                          ? "border-[#7C3AED] bg-[#7C3AED] text-white shadow-[0_8px_18px_rgba(124,58,237,0.18)]"
                          : "border-[#E8DED4] bg-white text-[#62564f]"
                      }`}
                    >
                      <span className="block text-[15px]">{choice.display}</span>
                      <span className="block text-[10px] uppercase tracking-[0.06em] opacity-70">{choice.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">Zone</span>
              <input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="min-h-[54px] w-full rounded-[18px] border border-[#E8DED4] bg-[#FFFCF8] px-4 text-[15px] font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
          ) : null}

        </div>
      </section>
    </HubShell>
  );
}

function ActiveProgram({ program }: { program: CognitiveAssessmentProgramStatusResponse }) {
  const navigate = useNavigate();
  const enrollment = program.enrollment;
  const latestReport = program.latestReport;
  const unfinished = program.latestUnfinishedSession;
  const primaryLabel = unfinished ? "Continue check" : "Start next check";
  const continuePath = unfinished
    ? `/mind-memory/cognitive-assessment/start?sessionId=${encodeURIComponent(unfinished.sessionId)}`
    : "/mind-memory/cognitive-assessment/start";
  const reportPath = latestReport
    ? `/mind-memory/cognitive-assessment/report/${encodeURIComponent(latestReport.sessionId)}`
    : "/mind-memory/cognitive-assessment/report";

  return (
    <HubShell>
      <section className="mx-auto w-full max-w-[980px] px-5 pt-5 md:px-7">
        <div className="rounded-[30px] border border-[#DDD6FE] bg-white p-5 shadow-[0_18px_40px_rgba(63,45,35,0.08)] md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-[#ECFDF5] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#047857]">
                <CheckCircle2 size={16} />
                Joined
              </span>
              <h1 className="mt-4 text-[34px] font-black leading-[1.02] text-[#2f2135] md:text-[44px]">
                Your Cognitive Assessment
              </h1>
              <p className="mt-3 max-w-[42rem] text-[16px] font-bold leading-relaxed text-[#62564f]">
                {activeProgramMessage(program)}
              </p>
            </div>
            <div className="rounded-[22px] border border-[#D9ECE4] bg-[#ECFDF5] px-4 py-3 text-[#047857] md:min-w-[220px]">
              <p className="text-xs font-black uppercase tracking-[0.1em]">Next check</p>
              <p className="mt-1 text-[20px] font-black leading-tight">{formatDateTime(enrollment?.nextRunAt)}</p>
              <p className="mt-2 text-xs font-bold">{cognitiveAssessmentFrequencyLabel(enrollment?.frequency ?? "monthly")}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-[24px] border border-[#E8DED4] bg-[#FFFCF8] p-3 md:grid-cols-[1fr_1fr]">
            <button
              type="button"
              onClick={() => navigate(continuePath)}
              className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-[20px] bg-[#2f2135] px-5 text-[17px] font-black text-white"
            >
              <PlayCircle size={21} />
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                if (latestReport) navigate(reportPath);
              }}
              disabled={!latestReport}
              className="inline-flex min-h-[62px] items-center justify-center gap-2 rounded-[20px] border border-[#DDD6FE] bg-white px-5 text-[17px] font-black text-[#5B21B6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <BarChart3 size={21} />
              View report
            </button>
            {!latestReport ? (
              <p className="rounded-[18px] bg-white px-4 py-3 text-sm font-bold text-[#766b63] md:col-span-2">
                Finish one check to unlock your first report.
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InfoTile icon={<CalendarDays size={22} />} label="Reminder" value={cognitiveAssessmentFrequencyLabel(enrollment?.frequency ?? "monthly")} detail={`${enrollment?.reminderTime ?? "10:00"} local time`} />
            <InfoTile icon={<FileText size={22} />} label="Latest report" value={formatDate(latestReport?.completedAt)} detail={latestReport ? `${latestReport.tasksCompleted}/${latestReport.totalTasks} steps saved` : "Complete a check first"} />
            <InfoTile icon={<RotateCw size={22} />} label="Past reports" value={`${program.completedReportCount}`} detail={program.completedReportCount === 1 ? "saved report" : "saved reports"} />
          </div>
        </div>
      </section>
    </HubShell>
  );
}

function InfoTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#E8DED4] bg-[#FFFCF8] p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white text-[#6B21A8]">{icon}</span>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.08em] text-[#766b63]">{label}</p>
      <p className="mt-1 text-[19px] font-black leading-tight text-[#2f2135]">{value}</p>
      <p className="mt-1 text-[13px] font-bold text-[#766b63]">{detail}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <HubShell>
      <section className="mx-auto w-full max-w-[980px] px-5 pt-5 md:px-7">
        <div className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-[#E8DED4] bg-white">
          <span className="inline-flex items-center gap-3 text-sm font-black text-[#2f2135]">
            <Loader2 className="animate-spin" size={20} />
            Loading program
          </span>
        </div>
      </section>
    </HubShell>
  );
}

export default function CognitiveAssessmentHubPage() {
  const programQuery = useQuery<CognitiveAssessmentProgramStatusResponse>({
    queryKey: PROGRAM_QUERY_KEY,
    refetchOnMount: "always",
  });
  const program = programQuery.data;

  const content = useMemo(() => {
    if (programQuery.isLoading) return <LoadingState />;
    if (programQuery.isError) return <ProgramSetup />;
    if (program?.joined) return <ActiveProgram program={program} />;
    return <ProgramSetup />;
  }, [program, programQuery.isError, programQuery.isLoading]);

  return content;
}
