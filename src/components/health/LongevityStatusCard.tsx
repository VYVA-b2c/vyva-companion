import {
  Activity,
  ArrowRight,
  HeartPulse,
  MessageCircle,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

export type LongevityScreenState =
  | "general"
  | "condition"
  | "follow_up"
  | "medication"
  | "insufficient"
  | "progress";

export type LongevityActionCard = {
  id: string;
  title: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: "food" | "movement" | "check" | "support" | "medicine";
  onSelect: () => void;
};

type LongevityStatusCardProps = {
  state: LongevityScreenState;
  firstName: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  focusName?: string;
  reason?: string;
  why?: string[];
  generatedHeadline?: string;
  generatedReason?: string;
  primaryAction: LongevityActionCard;
  secondaryActions: LongevityActionCard[];
  onAskVyva: () => void;
  isLoading?: boolean;
};

const stateStyle: Record<LongevityScreenState, { border: string; label: string; icon: LucideIcon; iconBg: string; iconColor: string }> = {
  general: { border: "#D69A20", label: "YOUR PLAN TODAY", icon: ShieldCheck, iconBg: "#FFF8E7", iconColor: "#854F0B" },
  condition: { border: "#E66E66", label: "HEALTH FOCUS", icon: HeartPulse, iconBg: "#FFF0EF", iconColor: "#B42318" },
  follow_up: { border: "#D97706", label: "FOLLOW-UP", icon: Stethoscope, iconBg: "#FFF7E8", iconColor: "#9A5B00" },
  medication: { border: "#7C3AED", label: "MEDICATION TODAY", icon: Pill, iconBg: "#F4EEFF", iconColor: "#6B21A8" },
  insufficient: { border: "#D69A20", label: "YOUR PLAN", icon: Sparkles, iconBg: "#FFF8E7", iconColor: "#854F0B" },
  progress: { border: "#D69A20", label: "YOUR PLAN TODAY", icon: UserRoundCheck, iconBg: "#ECFDF5", iconColor: "#047857" },
};

function conditionLabel(focusName?: string) {
  if (!focusName || focusName === "Plan") return "HEALTH FOCUS";
  return `${focusName.toUpperCase()} FOCUS`;
}

function defaultHeadline(state: LongevityScreenState, firstName: string, timeOfDay: LongevityStatusCardProps["timeOfDay"], focusName?: string) {
  if (state === "condition") {
    if (focusName === "Heart") return `Your heart deserves a little extra attention today, ${firstName}.`;
    if (focusName === "Diabetes") return `A steady day for your blood sugar, ${firstName}.`;
    if (focusName === "Falls") return `Let’s help you feel steady and safe today, ${firstName}.`;
    return `Your health deserves a little extra attention today, ${firstName}.`;
  }
  if (state === "follow_up") return `Worth checking in with your doctor, ${firstName}.`;
  if (state === "medication") return `Let’s make sure your medicines are working for you, ${firstName}.`;
  if (state === "insufficient") return `Welcome, ${firstName}. Let’s get to know you.`;
  if (state === "progress") return `You’re building a healthy rhythm, ${firstName}.`;
  const greeting = timeOfDay === "night" ? "A calm evening" : `A good ${timeOfDay}`;
  return `${greeting} to look after yourself, ${firstName}.`;
}

function defaultReason(state: LongevityScreenState, focusName?: string) {
  if (state === "condition") return focusName === "Heart"
    ? "Your recent heart context shaped today’s gentle plan."
    : "Your recent health context shaped today’s gentle plan.";
  if (state === "follow_up") return "A recent symptom is worth following up without delay.";
  if (state === "medication") return "A small medicine check can make today feel simpler.";
  if (state === "insufficient") return "The more VYVA learns about you, the more personal this gets.";
  if (state === "progress") return "Your recent consistency is helping VYVA make each day more useful.";
  return "Based on your profile and recent activity.";
}

function actionIcon(action: LongevityActionCard) {
  if (action.icon) return action.icon;
  if (action.tone === "medicine") return Pill;
  if (action.tone === "movement") return Activity;
  if (action.tone === "support") return ShieldCheck;
  return ArrowRight;
}

function SecondaryAction({ action }: { action: LongevityActionCard }) {
  const Icon = actionIcon(action);
  return (
    <button
      type="button"
      onClick={action.onSelect}
      className="group flex min-h-[88px] w-full items-center gap-3 rounded-[16px] border border-[#E6DDED] bg-white p-4 text-left transition-colors hover:border-[#C9B6D9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E9D5FF]"
      data-testid={`longevity-secondary-${action.id}`}
    >
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#F4EEFF] text-[#6B21A8]">
        <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block font-body text-[18px] font-semibold leading-[1.25] text-[#241C30]">
          {action.title}
        </span>
        {action.detail ? (
          <span className="sr-only">
            {action.detail}
          </span>
        ) : null}
      </span>
      <ArrowRight size={20} className="flex-none text-[#927DA4] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

export function LongevityStatusCard({
  state,
  firstName,
  timeOfDay,
  focusName,
  reason,
  why = [],
  generatedHeadline,
  generatedReason,
  primaryAction,
  secondaryActions,
  onAskVyva,
  isLoading = false,
}: LongevityStatusCardProps) {
  if (isLoading) {
    return (
      <section className="rounded-[20px] border border-[#E8E0EB] bg-white p-5" aria-label="Loading today’s Longevity plan" data-testid="longevity-status-skeleton">
        <div className="h-4 w-28 animate-pulse rounded-full bg-[#EFE8F4] motion-reduce:animate-none" />
        <div className="mt-5 h-7 w-4/5 animate-pulse rounded-full bg-[#E8E0EB] motion-reduce:animate-none" />
        <div className="mt-3 h-5 w-full animate-pulse rounded-full bg-[#F2EDF4] motion-reduce:animate-none" />
        <div className="mt-6 h-[70px] w-full animate-pulse rounded-[14px] bg-[#EEE5F7] motion-reduce:animate-none" />
      </section>
    );
  }

  const style = stateStyle[state];
  const FocusIcon = style.icon;
  const headline = generatedHeadline?.trim() || defaultHeadline(state, firstName, timeOfDay, focusName);
  const supportingReason = generatedReason?.trim() || reason?.trim() || defaultReason(state, focusName);
  const label = state === "condition" ? conditionLabel(focusName) : style.label;

  return (
    <section data-testid="prevention-hero">
      <article
        className="rounded-[20px] border border-[#E7DFE9] border-l-4 bg-white p-5"
        style={{ borderLeftColor: style.border }}
        data-testid={`longevity-state-${state}`}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ background: style.iconBg, color: style.iconColor }}>
            <FocusIcon size={23} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-body text-[12px] font-bold uppercase tracking-[0.06em] text-[#854F0B]">{label}</p>
            <h2 className="mt-2 line-clamp-2 font-body text-[22px] font-semibold leading-[1.25] text-[#241C30]">{headline}</h2>
            <p className="mt-2 line-clamp-2 font-body text-[16px] leading-[1.55] text-[#6F6375]">{supportingReason}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={primaryAction.onSelect}
          className="mt-5 flex min-h-[70px] w-full items-center gap-3 rounded-[14px] bg-[#6B21A8] px-5 text-left text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D8B4FE]"
          data-testid="button-longevity-primary-action"
        >
          {(() => {
            const Icon = actionIcon(primaryAction);
            return <Icon size={24} strokeWidth={2.2} aria-hidden="true" />;
          })()}
          <span className="min-w-0 flex-1 line-clamp-2 font-body text-[18px] font-semibold leading-[1.25]">{primaryAction.title}</span>
          <ArrowRight size={22} className="flex-none" aria-hidden="true" />
        </button>

        <button type="button" onClick={onAskVyva} className="mt-4 min-h-[44px] font-body text-[16px] font-semibold text-[#6B21A8] underline underline-offset-4">
          Ask VYVA about this
        </button>
      </article>

      <div className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="longevity-status-actions">
        {secondaryActions.slice(0, 2).map((action) => <SecondaryAction key={action.id} action={action} />)}
      </div>

      {state !== "insufficient" && why.length ? (
        <details className="group mt-4 rounded-[16px] border border-[#E7DFE9] bg-white" data-testid="longevity-why">
          <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 font-body text-[16px] font-semibold text-[#6B21A8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#E9D5FF]">
            <MessageCircle size={20} aria-hidden="true" />
            <span className="flex-1">Why VYVA chose this</span>
            <span className="text-[20px] transition-transform group-open:rotate-90" aria-hidden="true">›</span>
          </summary>
          <div className="max-h-[180px] overflow-y-auto border-t border-[#EEE8F0] px-4 py-3">
            {why.slice(0, 3).map((item) => (
              <p key={item} className="font-body text-[16px] leading-[1.6] text-[#5F5366]">{item}</p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
