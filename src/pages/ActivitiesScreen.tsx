import { useCallback, useEffect, useRef } from "react";
import { Bell, BookOpen, BrainCircuit, CheckCircle2, Clock3, Headphones, Puzzle, Route, X, type LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { useRouteVoiceAutoStart } from "@/hooks/useRouteVoiceAutoStart";
import { ActionCard, ResponsiveGrid, SectionTitle } from "@/components/vyva-ui";

type BrainCoachProgress = {
  summary?: {
    streakDays?: number;
    lastPlayedAt?: string | null;
  };
  today?: {
    completedCount?: number;
    activityTypes?: string[];
  };
};

type BrainCoachDailyPlan = {
  planId: string;
  status: "active" | "completed" | "expired";
  estimatedDurationMinutes: number;
  recommendedDomains: string[];
  activities: Array<{
    planItemId: string;
    activityType: string;
    title: string;
    domain: string;
    route: string;
    estimatedDurationMinutes: number;
    rationale: string;
    status: "recommended" | "accepted" | "started" | "completed" | "skipped";
    completedToday: boolean;
  }>;
  rationale: string[];
  completion: {
    completedCount: number;
    totalCount: number;
    allComplete: boolean;
  };
  caregiverNudge?: {
    id: string | null;
    messageType: string;
    title: string;
    body: string;
    sentAt: string | null;
    sentBy: string | null;
    status?: "unread" | "read" | "dismissed";
    isUnread?: boolean;
    readAt?: string | null;
    dismissedAt?: string | null;
  } | null;
  preferences?: {
    trainingTime?: string | null;
    sessionLengthMins?: number | null;
  };
};

const ActivitiesScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const notifiedCaregiverNudgeIdsRef = useRef<Set<string>>(new Set());
  const autoStartVoice = useRouteVoiceAutoStart();
  const { data: brainCoachProgress } = useQuery<BrainCoachProgress>({
    queryKey: ["/api/games/progress"],
    retry: false,
  });
  const { data: dailyPlan } = useQuery<BrainCoachDailyPlan>({
    queryKey: ["/api/games/daily-plan"],
    retry: false,
  });
  const streak = brainCoachProgress?.summary?.streakDays ?? 0;
  const caregiverNudge = dailyPlan?.caregiverNudge ?? null;
  const visibleCaregiverNudge = caregiverNudge?.status === "dismissed" ? null : caregiverNudge;

  const primaryActivityActions: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    sub: string;
    mobileLabel: string;
    mobileSub: string;
    color: string;
    bg: string;
    to: string;
    testId: string;
  }> = [
    {
      id: "memory",
      icon: BrainCircuit,
      label: t("mindMemory.cards.strengthenMemory", "Boost Memory"),
      sub: t("mindMemory.cards.strengthenMemoryDetail", "Recall people, places, words, numbers, and future cues."),
      mobileLabel: t("activities.primary.memoryMobile", "Memory"),
      mobileSub: t("activities.primary.memorySubMobile", "Recall practice"),
      color: "#7C3AED",
      bg: "#F5F3FF",
      to: "/brain-coach/remember",
      testId: "button-activities-primary-memory",
    },
    {
      id: "reflexes",
      icon: Route,
      label: t("mindMemory.cards.trainReflexes", "Sharpen Focus"),
      sub: t("mindMemory.cards.trainReflexesDetail", "Stay attentive, react, and keep pace."),
      mobileLabel: t("activities.primary.reflexesMobile", "Reflexes"),
      mobileSub: t("activities.primary.reflexesSubMobile", "Quick response"),
      color: "#0A7C4E",
      bg: "#ECFDF5",
      to: "/brain-coach/focus",
      testId: "button-activities-primary-reflexes",
    },
    {
      id: "intelligence",
      icon: Puzzle,
      label: t("mindMemory.cards.improveThinking", "Think & Plan"),
      sub: t("mindMemory.cards.improveThinkingDetail", "Plan, sort, switch rules, and solve sequences."),
      mobileLabel: t("activities.primary.intelligenceMobile", "Logic"),
      mobileSub: t("activities.primary.intelligenceSubMobile", "Problem solving"),
      color: "#C9890A",
      bg: "#FEF3C7",
      to: "/brain-coach/think",
      testId: "button-activities-primary-intelligence",
    },
    {
      id: "senses",
      icon: Headphones,
      label: t("mindMemory.cards.sharpenSenses", "Find Calm"),
      sub: t("mindMemory.cards.sharpenSensesDetail", "Slow down, breathe, and reconnect with sensory memory."),
      mobileLabel: t("activities.primary.sensesMobile", "Senses"),
      mobileSub: t("activities.primary.sensesSubMobile", "Sound focus"),
      color: "#0F766E",
      bg: "#CCFBF1",
      to: "/brain-coach/calm",
      testId: "button-activities-primary-senses",
    },
  ];

  const quickActivityActions: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    sub: string;
    mobileLabel: string;
    mobileSub: string;
    to: string;
    iconBg: string;
    iconColor: string;
    border: string;
    shadow: string;
    testId: string;
  }> = [
    {
      id: "relax",
      icon: Headphones,
      label: t("activities.quick.relax", "Relax & Breathe"),
      sub: t("activities.quick.relaxSub", "Take a calm guided pause."),
      mobileLabel: t("activities.quick.relaxMobile", "Relax"),
      mobileSub: t("activities.quick.relaxSubMobile", "Calm pause"),
      to: "/activities/relax-breathe",
      iconBg: "#CCFBF1",
      iconColor: "#0F766E",
      border: "#99F6E4",
      shadow: "rgba(15,118,110,0.08)",
      testId: "button-activities-quick-relax",
    },
    {
      id: "learn",
      icon: BookOpen,
      label: t("activities.quick.learn", "Learn Something New"),
      sub: t("activities.quick.learnSub", "Start a short daily learning program."),
      mobileLabel: t("activities.quick.learnMobile", "Learn"),
      mobileSub: t("activities.quick.learnSubMobile", "Daily lessons"),
      to: "/learn",
      iconBg: "#F5F3FF",
      iconColor: "#7C3AED",
      border: "#D8B4FE",
      shadow: "rgba(124,58,237,0.08)",
      testId: "button-activities-quick-learn",
    },
    {
      id: "play",
      icon: BrainCircuit,
      label: t("activities.quick.play", "Take a cognitive assessment."),
      sub: t("activities.quick.playSub", "Practice memory and focus."),
      mobileLabel: t("activities.quick.playMobile", "Play"),
      mobileSub: t("activities.quick.playSubMobile", "Brain games"),
      to: "/brain-coach/remember",
      iconBg: "#EFF6FF",
      iconColor: "#2563EB",
      border: "#BFDBFE",
      shadow: "rgba(37,99,235,0.08)",
      testId: "button-activities-quick-play",
    },
  ];

  const recordCaregiverNudgeEvent = useCallback(async (
    eventType: "caregiver_nudge_read" | "caregiver_nudge_dismissed",
    options: { invalidate?: boolean } = {},
  ) => {
    if (!dailyPlan?.planId || !caregiverNudge?.id) return false;

    try {
      const response = await apiFetch("/api/games/daily-plan/events", {
        method: "POST",
        body: JSON.stringify({
          planId: dailyPlan.planId,
          nudgeEventId: caregiverNudge.id,
          eventType,
          source: "activities_screen",
        }),
      });
      if (response.ok && options.invalidate) {
        void queryClient.invalidateQueries({ queryKey: ["/api/games/daily-plan"] });
      }
      return response.ok;
    } catch {
      return false;
    }
  }, [caregiverNudge?.id, dailyPlan?.planId, queryClient]);

  useEffect(() => {
    if (!caregiverNudge?.id || (caregiverNudge.status ?? "unread") !== "unread") return;
    if (notifiedCaregiverNudgeIdsRef.current.has(caregiverNudge.id)) return;

    notifiedCaregiverNudgeIdsRef.current.add(caregiverNudge.id);
    toast({
      title: caregiverNudge.title,
      description: caregiverNudge.body,
    });
    void recordCaregiverNudgeEvent("caregiver_nudge_read");
  }, [
    caregiverNudge?.body,
    caregiverNudge?.id,
    caregiverNudge?.status,
    caregiverNudge?.title,
    recordCaregiverNudgeEvent,
    toast,
  ]);

  const handleDismissCaregiverNudge = async () => {
    await recordCaregiverNudgeEvent("caregiver_nudge_dismissed", { invalidate: true });
  };

  const handleDailyPlanActivityClick = async (activity: BrainCoachDailyPlan["activities"][number]) => {
    if (dailyPlan?.planId && activity.planItemId && activity.status !== "completed") {
      await apiFetch("/api/games/daily-plan/events", {
        method: "POST",
        body: JSON.stringify({
          planId: dailyPlan.planId,
          planItemId: activity.planItemId,
          activityType: activity.activityType,
          eventType: "started",
          source: "activities_screen",
        }),
      }).then((response) => {
        if (response.ok) {
          void queryClient.invalidateQueries({ queryKey: ["/api/games/daily-plan"] });
        }
      }).catch(() => undefined);
    }
    navigate(activity.route);
  };

  return (
    <div className="vyva-page">
      <VoiceHero
        heroSurface="brain"
        sourceText={t("brain.voiceSource")}
        headline={<>{t("brain.headline")}</>}
        subtitle={t("brain.subtitle", { streak })}
        contextHint="brain training"
        voiceAgentSlug="brain-coach"
        autoStartVoice={autoStartVoice ? "brain-coach" : false}
        showVoiceOverlay={false}
        activeLabel={t("voiceHero.endCall", "Pause listening")}
      />

      <VoiceActionFulfillmentPanel
        domain="brain_coach"
        actionTypes={["brain.activity"]}
        title="Activity context ready"
        description="VYVA can suggest a light activity and keep encouragement available while the user chooses."
        className="mt-[18px]"
      />

      {visibleCaregiverNudge && (
        <section
          className="mt-[18px] flex items-start gap-3 rounded-[22px] border p-4"
          style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
          data-testid="brain-coach-caregiver-nudge"
        >
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[14px] bg-white text-[#2563EB]">
            <Bell size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[16px] font-extrabold leading-tight text-[#1E3A8A] [overflow-wrap:anywhere]">
              {visibleCaregiverNudge.title}
            </span>
            <span className="mt-1 block font-body text-[13px] font-semibold leading-snug text-[#1E3A8A] [overflow-wrap:anywhere]">
              {visibleCaregiverNudge.body}
            </span>
          </span>
          {visibleCaregiverNudge.id && (
            <button
              type="button"
              aria-label="Dismiss caregiver nudge"
              data-testid="brain-coach-caregiver-nudge-dismiss"
              onClick={() => void handleDismissCaregiverNudge()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2563EB] shadow-sm transition-transform active:scale-[0.98]"
            >
              <X size={17} />
            </button>
          )}
        </section>
      )}

      <section className="mt-[18px]" data-testid="section-activities-primary-actions">
        <SectionTitle
          className="mb-3"
          title={t("activities.primaryTitle", "Choose your focus")}
          titleClassName="font-body text-[22px] font-extrabold not-italic"
        />
        <ResponsiveGrid columns="two" gap="sm">
          {primaryActivityActions.map((action) => (
            <ActionCard
              key={action.id}
              data-testid={action.testId}
              aria-label={action.label}
              icon={action.icon}
              iconBg={action.bg}
              iconColor={action.color}
              title={
                <>
                  <span className="sm:hidden">{action.mobileLabel}</span>
                  <span className="hidden sm:inline">{action.label}</span>
                </>
              }
              description={
                <>
                  <span className="sm:hidden">{action.mobileSub}</span>
                  <span className="hidden sm:inline">{action.sub}</span>
                </>
              }
              size="large"
              surface="white"
              onClick={() => navigate(action.to)}
            />
          ))}
        </ResponsiveGrid>
      </section>

      {dailyPlan && dailyPlan.activities.length > 0 && (
        <section
          className="mt-[18px] rounded-[26px] border bg-[#FFFCF8] p-[16px]"
          style={{
            borderColor: "#EDE2D1",
            boxShadow: "0 2px 10px rgba(43,31,24,0.05)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-body text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple">Today&apos;s Brain Coach Plan</p>
              <h2 className="mt-1 font-display text-[27px] leading-tight text-vyva-text-1">A short plan for today</h2>
              <p className="mt-2 font-body text-[14px] font-medium leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                {dailyPlan.rationale[0]}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#F3E8FF] px-3 py-2 text-[13px] font-extrabold text-vyva-purple">
              <Clock3 size={15} />
              {dailyPlan.estimatedDurationMinutes} min
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {dailyPlan.activities.map((activity) => (
              <button
                key={activity.activityType}
                type="button"
                onClick={() => void handleDailyPlanActivityClick(activity)}
                className="flex min-h-[74px] items-center gap-3 rounded-[20px] border bg-white px-3 py-3 text-left shadow-sm transition-transform active:scale-[0.99]"
                style={{ borderColor: "#EFE4D5" }}
              >
                <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[16px] bg-[#F3E8FF] text-vyva-purple">
                  {activity.completedToday ? <CheckCircle2 size={23} /> : <BrainCircuit size={23} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[17px] font-extrabold leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">{activity.title}</span>
                  <span className="sr-only">{activity.rationale}</span>
                </span>
                <span className="shrink-0 rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[12px] font-extrabold text-[#B45309]">
                  {activity.estimatedDurationMinutes} min
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {dailyPlan.recommendedDomains.map((domain) => (
              <span key={domain} className="rounded-full bg-[#EDE9FE] px-2.5 py-1 text-[12px] font-bold text-[#6D28D9]">
                {domain.replaceAll("_", " ")}
              </span>
            ))}
            <span className="rounded-full bg-[#DDF8EA] px-2.5 py-1 text-[12px] font-bold text-[#0A7C4E]">
              {dailyPlan.completion.completedCount}/{dailyPlan.completion.totalCount} done
            </span>
          </div>
        </section>
      )}

      <section
        className="mt-[18px] rounded-[28px] border border-[#EDE2D1] bg-[#FFFCF8] p-5 shadow-[0_14px_32px_rgba(60,38,20,0.07)]"
        data-testid="activities-quick-actions"
      >
        <div className="mb-4">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
            {t("activities.quick.kicker", "Brain Coach")}
          </p>
          <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
            <span className="sm:hidden">{t("activities.libraryTitleMobile", "Pick one")}</span>
            <span className="hidden sm:inline">{t("activities.libraryTitle", "Choose an activity")}</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {quickActivityActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={action.testId}
                aria-label={action.label}
                onClick={() => navigate(action.to)}
                className="vyva-tap flex min-h-[86px] w-full items-center gap-4 rounded-[22px] border bg-white px-4 py-4 text-left transition-transform hover:-translate-y-0.5"
                style={{
                  borderColor: action.border,
                  boxShadow: `0 10px 24px ${action.shadow}`,
                }}
              >
                <span
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px]"
                  style={{ background: action.iconBg, color: action.iconColor }}
                >
                  <Icon size={24} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[18px] font-black leading-tight text-vyva-text-1">
                    <span className="sm:hidden">{action.mobileLabel}</span>
                    <span className="hidden sm:inline">{action.label}</span>
                  </span>
                  <span className="mt-1 block max-w-[24rem] font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                    <span className="sm:hidden">{action.mobileSub}</span>
                    <span className="hidden sm:inline">{action.sub}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ActivitiesScreen;
