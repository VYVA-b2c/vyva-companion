import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { ArrowLeft, ChevronRight, Loader2, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { VyvaIcon, type VyvaBrandGlyph, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { CanonicalVoiceButton } from "@/components/CanonicalDetailFlowShell";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";
import { cn } from "@/lib/utils";
import {
  BRAIN_COACH_ACTIVITY_SHELL_CONTRACT,
  BRAIN_COACH_SHELL_CONTRACT,
  getBrainCoachPresentationAttributes,
} from "./brainCoachPresentation";

type BrainCoachFlowShellProps = {
  title: ReactNode;
  headerTitle?: ReactNode;
  subtitle?: ReactNode;
  icon: LucideIcon;
  brandIcon?: VyvaBrandGlyph;
  iconAccent?: VyvaIconAccent;
  iconBg?: string;
  iconColor?: string;
  backLabel?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  action?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
  presentationId: string;
  sceneId: string;
  sceneKind?: string;
  sceneLayout?: string;
};

export function BrainCoachFlowShell({
  title,
  headerTitle,
  subtitle,
  backLabel = "Back",
  backTo = "/mind-memory",
  onBack,
  action,
  badge,
  children,
  testId,
  className,
  presentationId,
  sceneId,
  sceneKind = "module_hub",
  sceneLayout = "activity_grid",
}: BrainCoachFlowShellProps) {
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const { size: readableTextSize } = useReadableTextSize();
  const backAriaLabel = typeof backLabel === "string" ? backLabel : "Back";
  const topbarTitle = headerTitle ?? title;

  return (
    <section
      aria-label={typeof title === "string" ? title : "Brain Coach"}
      className={cn(
        "prototype-shell relative min-h-[calc(100svh-136px)] w-full overflow-x-hidden",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_0%,#2C1E58_0%,#160F24_52%,#080611_100%)] text-[#F7F0FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
        className,
      )}
      data-testid={testId}
      data-home-master-theme={isDark ? "dark" : "light"}
      data-vyva-text-size={readableTextSize}
      {...getBrainCoachPresentationAttributes({
        presentationId,
        sceneId,
        sceneKind,
        sceneLayout,
      })}
    >
      <div className="vyva-home-master-fixed-type mx-auto flex min-h-[calc(100svh-136px)] w-full max-w-[430px] flex-col px-6 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-8 sm:max-w-[680px] sm:px-7 lg:max-w-[900px] [@media(max-height:800px)]:pt-4">
        <div className={cn(
          "sticky top-0 z-40 -mx-3 px-3 backdrop-blur-xl",
          isDark ? "bg-[#1A1122]/95" : "bg-[#F8EEFF]/90",
        )}>
          <header
            className="grid grid-cols-[40px_1fr_40px] items-center gap-3"
            data-header-contract={BRAIN_COACH_SHELL_CONTRACT.headerId}
          >
            <button
              type="button"
              aria-label={backAriaLabel}
              title={backAriaLabel}
              onClick={() => {
                if (onBack) {
                  onBack();
                  return;
                }
                navigate(backTo);
              }}
              className={cn(
                "vyva-tap grid h-10 !min-h-10 w-10 place-items-center rounded-full transition-colors duration-150",
                isDark
                  ? "bg-white/[0.07] text-[#F7F0FF] ring-1 ring-inset ring-white/[0.18]"
                  : "bg-white text-[#6B5173] shadow-[0_14px_32px_rgba(80,52,109,0.12)] ring-1 ring-black/[0.05]",
              )}
            >
              <VyvaIcon icon={ArrowLeft} size={18} strokeWidth={2.45} tone="brand" />
            </button>
            <h1 className="truncate text-center font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] text-inherit">
              {topbarTitle}
            </h1>
            <div className="flex justify-end">
              {action ?? (
                <CanonicalVoiceButton
                  contextHint={typeof title === "string" ? `Brain Coach: ${title}` : "Brain Coach activities"}
                  agentSlug="brain-coach"
                  dynamicVariables={{ app_entrypoint: sceneId }}
                  testId="button-brain-coach-category-voice"
                />
              )}
            </div>
          </header>
        </div>

        <div className="mt-5 sm:mt-6">
          {badge ? <div className="mb-3 flex justify-center">{badge}</div> : null}
          {subtitle ? (
            <p className="mx-auto max-w-[34rem] text-center font-body text-[14px] font-bold leading-snug text-[#8A8095] sm:text-[15px]">
              {subtitle}
            </p>
          ) : null}

          <div className="mt-5 sm:mt-6" data-container-contract={BRAIN_COACH_SHELL_CONTRACT.containerId}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

type BrainCoachActivityShellProps = {
  children: ReactNode;
  title?: ReactNode;
  backLabel?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  action?: ReactNode;
  showHeader?: boolean;
  testId?: string;
  className?: string;
  frameClassName?: string;
  contentClassName?: string;
  presentationId: string;
  sceneId: string;
  sceneKind?: string;
  sceneLayout?: string;
  state?: "default" | "loading" | "complete";
  voiceDynamicVariables?: Record<string, string | number | boolean>;
};

export function BrainCoachActivityShell({
  children,
  title = "Brain Coach",
  backLabel = "Back",
  backTo = "/mind-memory",
  onBack,
  action,
  showHeader = true,
  testId,
  className,
  frameClassName,
  contentClassName,
  presentationId,
  sceneId,
  sceneKind = "activity",
  sceneLayout = "game",
  state = "default",
  voiceDynamicVariables,
}: BrainCoachActivityShellProps) {
  const { isDark } = useHomeMasterTheme();
  const { size: readableTextSize } = useReadableTextSize();
  const backAriaLabel = typeof backLabel === "string" ? backLabel : "Back";

  return (
    <section
      aria-label={typeof title === "string" ? title : "Brain Coach"}
      className={cn(
        "prototype-shell relative min-h-[100dvh] w-full overflow-x-hidden",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_0%,#2C1E58_0%,#160F24_52%,#080611_100%)] text-[#F7F0FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_74%)] text-[#241C30]",
        className,
      )}
      data-testid={testId}
      data-home-master-theme={isDark ? "dark" : "light"}
      data-vyva-text-size={readableTextSize}
      {...getBrainCoachPresentationAttributes({
        presentationId,
        sceneId,
        state,
        sceneKind,
        sceneLayout,
        shellContract: BRAIN_COACH_ACTIVITY_SHELL_CONTRACT,
      })}
    >
      <div className={cn(
        "vyva-home-master-fixed-type mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-6 pb-8 pt-8 sm:max-w-[680px] sm:px-7 lg:max-w-[900px] [@media(max-height:800px)]:pt-4",
        frameClassName,
      )}>
        {showHeader ? (
          <div className={cn(
            "sticky top-0 z-40 -mx-3 px-3 py-1 backdrop-blur-xl",
            isDark ? "bg-[#1A1122]/95" : "bg-[#F8EEFF]/90",
          )}>
            <header className="grid grid-cols-[40px_1fr_40px] items-center gap-3">
              <button
                type="button"
                aria-label={backAriaLabel}
                title={backAriaLabel}
                onClick={() => {
                  if (onBack) {
                    onBack();
                    return;
                  }
                  if (typeof window !== "undefined") {
                    window.location.assign(backTo);
                  }
                }}
                className={cn(
                  "vyva-tap grid h-10 !min-h-10 w-10 place-items-center rounded-full transition-colors duration-150",
                  isDark
                    ? "bg-white/[0.07] text-[#F7F0FF] ring-1 ring-inset ring-white/[0.18]"
                    : "bg-white text-[#6B5173] shadow-[0_14px_32px_rgba(80,52,109,0.12)] ring-1 ring-black/[0.05]",
                )}
              >
                <VyvaIcon icon={ArrowLeft} size={18} strokeWidth={2.45} tone="brand" />
              </button>
              <h1 className="truncate text-center font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] text-inherit">
                {title}
              </h1>
              <div className="flex justify-end">
                {action ?? (
                  <CanonicalVoiceButton
                    contextHint={typeof title === "string" ? `Brain Coach: ${title}` : "Brain Coach activity"}
                    agentSlug="brain-coach"
                    dynamicVariables={{ app_entrypoint: sceneId, ...voiceDynamicVariables }}
                    testId="button-brain-coach-activity-voice"
                  />
                )}
              </div>
            </header>
          </div>
        ) : null}

        <div className={cn("mt-5 flex min-h-0 flex-1 flex-col sm:mt-6", contentClassName)}>
          {children}
        </div>
      </div>
    </section>
  );
}

type BrainCoachLoadingStateProps = {
  label: ReactNode;
  title?: ReactNode;
  backLabel?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  showHeader?: boolean;
  testId?: string;
  presentationId: string;
  sceneId: string;
};

export function BrainCoachLoadingState({
  label,
  title = "Brain Coach",
  backLabel,
  backTo,
  onBack,
  showHeader = true,
  testId,
  presentationId,
  sceneId,
}: BrainCoachLoadingStateProps) {
  const { isDark } = useHomeMasterTheme();
  return (
    <BrainCoachActivityShell
      title={title}
      backLabel={backLabel}
      backTo={backTo}
      onBack={onBack}
      showHeader={showHeader}
      testId={testId}
      presentationId={presentationId}
      sceneId={sceneId}
      state="loading"
      sceneKind="loading"
      sceneLayout="progress"
    >
      <section className={cn(
        "flex min-h-[300px] flex-1 flex-col items-center justify-center rounded-[28px] border px-6 text-center shadow-[0_18px_46px_rgba(54,35,78,0.10)]",
        isDark ? "border-white/[0.14] bg-white/[0.08] text-[#F7F0FF]" : "border-[#EEE8F1] bg-white text-[#241C30]",
      )}>
        <span className={cn("grid h-16 w-16 place-items-center rounded-[20px]", isDark ? "bg-[#493267] text-[#F7F0FF]" : "bg-[#F1E8FF] text-[#6B21A8]")}>
          <Loader2 size={30} strokeWidth={2.45} className="animate-spin" aria-hidden="true" />
        </span>
        <p className="mt-5 max-w-[22rem] font-body text-[20px] font-extrabold leading-tight">
          {label}
        </p>
      </section>
    </BrainCoachActivityShell>
  );
}

type BrainCoachActivityCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  icon: LucideIcon;
  brandIcon?: VyvaBrandGlyph;
  iconAccent?: VyvaIconAccent;
  iconBg?: string;
  iconColor?: string;
  badge?: ReactNode;
  badgeBg?: string;
  badgeColor?: string;
  meta?: ReactNode;
  actionLabel?: ReactNode;
  variant?: "default" | "featured" | "compact";
  borderColor?: string;
};

export function BrainCoachActivityCard({
  title,
  description,
  icon: Icon,
  brandIcon,
  iconAccent,
  iconBg = "#F5EEFF",
  iconColor = "#6B21A8",
  badge,
  badgeBg,
  badgeColor,
  meta,
  actionLabel,
  variant = "default",
  borderColor = "#D8C7F3",
  className,
  disabled,
  type = "button",
  style,
  ...props
}: BrainCoachActivityCardProps) {
  const { isDark } = useHomeMasterTheme();
  const featured = variant === "featured";
  const compact = variant === "compact";
  const iconTileId = brandIcon ?? iconAccent ?? "utility";
  const cardStyle: CSSProperties = featured
    ? {
        background: "linear-gradient(145deg,#5B21B6 0%,#6D28D9 52%,#7C3AED 100%)",
        borderColor: "#7C3AED",
        color: "#FFFFFF",
        ...style,
      }
    : {
        borderColor,
        ...style,
      };

  if (compact) {
    return (
      <button
        type={type}
        disabled={disabled}
        className={cn(
          "vyva-tap group flex min-h-[104px] w-full min-w-0 items-start gap-3 rounded-[22px] border px-3.5 py-3.5 text-left shadow-[0_10px_22px_rgba(60,38,20,0.07)] transition-transform active:scale-[0.99] disabled:opacity-60 sm:min-h-[112px] sm:px-4",
          isDark ? "bg-white/[0.07] text-[#FFF8FF]" : "bg-white text-vyva-text-1",
          className,
        )}
        style={cardStyle}
        data-scene-kind="activity_card"
        data-container-contract={BRAIN_COACH_SHELL_CONTRACT.containerId}
        {...props}
      >
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] sm:h-[52px] sm:w-[52px] sm:rounded-[18px]"
          style={{ background: iconBg, color: iconColor }}
          data-vyva-icon-tile={iconTileId}
          aria-hidden="true"
        >
          <VyvaIcon
            icon={Icon}
            glyph={brandIcon}
            accent={iconAccent}
            size={brandIcon ? 38 : 25}
            strokeWidth={2.45}
            tone="brand"
          />
        </span>
        <span className="min-w-0 flex-1">
          {badge ? (
            <span
              className="mb-1 inline-flex max-w-full rounded-full px-2.5 py-1 text-[11px] font-black leading-none"
              style={{ background: badgeBg ?? iconBg, color: badgeColor ?? iconColor }}
            >
              <span>{badge}</span>
            </span>
          ) : null}
          <span className={cn("block font-body text-[18px] font-extrabold leading-tight sm:text-[19px]", isDark ? "text-[#FFF8FF]" : "text-vyva-text-1")}>
            {title}
          </span>
          {description ? (
            <span className={cn("mt-1 block text-[13px] font-semibold leading-tight sm:text-[14px]", isDark ? "text-[#D8CDE4]" : "text-vyva-text-2")}>
              {description}
            </span>
          ) : null}
          {meta ? (
            <span className={cn("mt-1 block text-[13px] font-black", isDark ? "text-[#D8CDE4]" : "text-vyva-text-2")}>
              {meta}
            </span>
          ) : null}
          {actionLabel ? (
            <span
              className={cn(
                "mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-black leading-tight",
                isDark ? "bg-white/[0.10] text-[#FFF8FF]" : "",
              )}
              style={isDark ? undefined : { background: badgeBg ?? iconBg, color: badgeColor ?? iconColor }}
            >
              <span className="min-w-0 truncate">{actionLabel}</span>
              <ChevronRight size={14} strokeWidth={2.6} aria-hidden="true" />
            </span>
          ) : null}
        </span>
        {!actionLabel ? (
          <span
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
            style={{ background: iconColor }}
            aria-hidden="true"
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </span>
        ) : null}
      </button>
    );
  }

  if (featured) {
    return (
      <button
        type={type}
        disabled={disabled}
        className={cn(
          "vyva-tap group flex min-h-[128px] w-full min-w-0 flex-col gap-4 rounded-[26px] border px-4 py-4 text-left shadow-[0_16px_36px_rgba(47,24,64,0.08)] transition-transform hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-60 sm:grid sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5",
          isDark ? "bg-white/[0.07] text-[#FFF8FF]" : "bg-white text-vyva-text-1",
          className,
        )}
        style={{
          borderColor: isDark ? "rgba(255,255,255,0.14)" : borderColor,
          background: isDark
            ? "linear-gradient(145deg, rgba(255,255,255,0.105) 0%, rgba(255,255,255,0.06) 100%)"
            : `linear-gradient(145deg, #FFFFFF 0%, #FFFFFF 64%, ${iconBg} 100%)`,
          ...style,
        }}
        data-scene-kind="activity_card"
        data-container-contract={BRAIN_COACH_SHELL_CONTRACT.containerId}
        {...props}
      >
        <span
          className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[20px] shadow-[0_10px_22px_rgba(47,24,64,0.08)] sm:h-16 sm:w-16 sm:rounded-[22px]"
          style={{ background: iconBg, color: iconColor }}
          data-vyva-icon-tile={iconTileId}
          aria-hidden="true"
        >
          <VyvaIcon
            icon={Icon}
            glyph={brandIcon}
            accent={iconAccent}
            size={brandIcon ? 44 : 30}
            strokeWidth={2.45}
            tone="brand"
          />
        </span>

        <span className="min-w-0">
          {badge ? (
            <span
              className="mb-2 inline-flex max-w-full items-center rounded-full px-3 py-1 text-[12px] font-black leading-tight"
              style={{ background: badgeBg ?? iconBg, color: badgeColor ?? iconColor }}
            >
              <span className="min-w-0 truncate">{badge}</span>
            </span>
          ) : null}
          <span className={cn("block font-body text-[25px] font-extrabold leading-tight sm:text-[27px]", isDark ? "text-[#FFF8FF]" : "text-vyva-text-1")}>
            {title}
          </span>
          {description ? (
            <span className={cn("mt-1.5 block max-w-[35rem] text-[15px] font-semibold leading-snug sm:text-[16px]", isDark ? "text-[#D8CDE4]" : "text-vyva-text-2")}>
              {description}
            </span>
          ) : null}
          {meta ? (
            <span className={cn("mt-2 block text-[13px] font-black leading-snug sm:text-[14px]", isDark ? "text-[#D8CDE4]" : "text-vyva-text-2")}>
              {meta}
            </span>
          ) : null}
        </span>

        <span
          className={cn(
            "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-[14px] font-black leading-tight sm:w-auto sm:min-w-[10rem]",
            isDark ? "bg-white/[0.10] text-[#FFF8FF]" : "text-white",
          )}
          style={isDark ? undefined : { background: iconColor }}
        >
          <span className="min-w-0">{actionLabel ?? "Start"}</span>
          <ChevronRight size={16} strokeWidth={2.7} aria-hidden="true" />
        </span>
      </button>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "vyva-tap group relative min-w-0 overflow-hidden rounded-[26px] border px-4 py-4 text-left shadow-[0_14px_30px_rgba(60,38,20,0.08)] transition-transform active:scale-[0.99] disabled:opacity-60 sm:px-5 sm:py-5",
        isDark
            ? "min-h-[158px] bg-white/[0.07] text-[#FFF8FF]"
            : "min-h-[158px] bg-white text-vyva-text-1",
        className,
      )}
      style={cardStyle}
      data-scene-kind="activity_card"
      data-container-contract={BRAIN_COACH_SHELL_CONTRACT.containerId}
      {...props}
    >
      <span className="flex h-full min-w-0 flex-col justify-between gap-5">
        <span className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[20px]",
              featured ? "bg-white/16 text-white" : "",
            )}
            style={featured ? undefined : { background: iconBg, color: iconColor }}
            data-vyva-icon-tile={iconTileId}
            aria-hidden="true"
          >
            <VyvaIcon
              icon={Icon}
              glyph={brandIcon}
              accent={iconAccent}
              size={brandIcon ? 44 : 29}
              strokeWidth={2.45}
              tone={featured ? "inverse" : "brand"}
            />
          </span>
          {badge ? (
            <span
              className={cn("shrink-0 rounded-full px-3 py-1 text-[12px] font-black", featured ? "bg-white/16 text-white" : "")}
              style={featured ? undefined : { background: badgeBg ?? iconBg, color: badgeColor ?? iconColor }}
            >
              {badge}
            </span>
          ) : null}
        </span>

        <span className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-3">
          <span className="min-w-0">
            <span className={cn("block font-body text-[22px] font-extrabold leading-tight", featured ? "text-white" : isDark ? "text-[#FFF8FF]" : "text-vyva-text-1")}>
              {title}
            </span>
            {description ? (
              <span className={cn("mt-2 block text-[15px] font-semibold leading-snug", featured ? "text-white/82" : isDark ? "text-[#D8CDE4]" : "text-vyva-text-2")}>
                {description}
              </span>
            ) : null}
            {meta ? (
              <span className={cn("mt-2 block text-[14px] font-black", featured ? "text-white/86" : isDark ? "text-[#D8CDE4]" : "text-vyva-text-2")}>
                {meta}
              </span>
            ) : null}
          </span>
          {actionLabel ? (
            <span
              className={cn(
                "inline-flex max-w-[10rem] items-center justify-center gap-1.5 rounded-full px-3 py-2 text-center text-[13px] font-black leading-tight",
                featured ? "bg-white/16 text-white" : isDark ? "bg-white/[0.10] text-[#FFF8FF]" : "",
              )}
              style={featured || isDark ? undefined : { background: badgeBg ?? iconBg, color: badgeColor ?? iconColor }}
            >
              <span className="min-w-0">{actionLabel}</span>
              <ChevronRight size={15} strokeWidth={2.6} aria-hidden="true" />
            </span>
          ) : (
            <span
              className={cn("grid h-[42px] w-[42px] place-items-center rounded-full", featured ? "bg-white/16 text-white" : "text-white")}
              style={featured ? undefined : { background: iconColor }}
              aria-hidden="true"
            >
              <ChevronRight size={21} strokeWidth={2.5} />
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
