import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  Brain,
  CalendarCheck,
  Car,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Footprints,
  Hand,
  Heart,
  HeartPulse,
  Home,
  MessageCircle,
  MessagesSquare,
  Mic,
  Phone,
  Pill,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sun,
  Type,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { VyvaIcon, type VyvaBrandGlyph, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { VyvaMark } from "@/components/VyvaMark";
import { VYVA_OPEN_SOS_EVENT } from "@/lib/sosEvents";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";
import type { SymptomAssessmentShellContract } from "@/design/screenPresentation";
import { useLanguage } from "@/i18n";
import { CanonicalDetailFlowShell } from "@/components/CanonicalDetailFlowShell";

type RowTone = "health" | "brain" | "community" | "concierge" | "reports" | "profile" | "neutral";
type OrbState = "idle" | "listening" | "responding";
type ShellWidth = "phone" | "flow" | "hub";

type RowItem = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  meta?: string;
  tone?: RowTone;
  path?: string;
  onClick?: () => void;
  testId?: string;
  emphasis?: "primary" | "alert" | "standard";
  solidSurface?: boolean;
  compactTitle?: boolean;
  brandIcon?: VyvaBrandGlyph;
  iconAccent?: VyvaIconAccent;
};

type PrototypeSection = {
  eyebrow?: string;
  items: RowItem[];
};

const rowTonePalettes: Record<RowTone, { chip: string; icon: string; border: string; darkChip: string; darkIcon: string }> = {
  health: { chip: "#FCEBEA", icon: "#D9463E", border: "#F3C2BE", darkChip: "rgba(224,91,82,0.18)", darkIcon: "#FF5C52" },
  brain: { chip: "#F1EAFF", icon: "#7C3AED", border: "#D8CBFF", darkChip: "rgba(124,58,237,0.2)", darkIcon: "#8B5CF6" },
  community: { chip: "#EAF3FF", icon: "#2563EB", border: "#BBD7FF", darkChip: "rgba(47,102,208,0.2)", darkIcon: "#38BDF8" },
  concierge: { chip: "#EAFBF1", icon: "#0F7A50", border: "#B7F0CE", darkChip: "rgba(74,222,158,0.16)", darkIcon: "#4ADE9E" },
  reports: { chip: "#F7F8FB", icon: "#64748B", border: "#E2E8F0", darkChip: "rgba(226,232,240,0.12)", darkIcon: "#CBD5E1" },
  profile: { chip: "#FFF4CF", icon: "#A16207", border: "#F6D681", darkChip: "rgba(232,163,61,0.16)", darkIcon: "#F8AE1B" },
  neutral: { chip: "#F7F3FA", icon: "#6B5173", border: "#E9DEF2", darkChip: "rgba(255,255,255,0.09)", darkIcon: "#E8DFF3" },
};

const shellSurface = {
  light: "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
  dark: "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F7F0FF]",
};

const screenCopy = {
  name: "Karim",
  location: "Tarifa, Spain",
};

function useTimeOfDayCopy() {
  const now = new Date();
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greeting = part === "morning" ? "Good morning" : part === "evening" ? "Good evening" : "Good afternoon";
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return { greeting: `${greeting}, ${screenCopy.name}.`, date };
}

function usePrototypeNavigate() {
  const navigate = useNavigate();
  return (path: string) => navigate(path);
}

function openExistingSos(source: string) {
  window.dispatchEvent(new CustomEvent(VYVA_OPEN_SOS_EVENT, { detail: { source } }));
}

function useOrbInteraction(response: string, idleCaption: string) {
  const [state, setState] = useState<OrbState>("idle");
  const [caption, setCaption] = useState(idleCaption);
  const [revealedText, setRevealedText] = useState("");
  const timerRef = useRef<number[]>([]);

  const clearTimer = () => {
    timerRef.current.forEach((timer) => window.clearTimeout(timer));
    timerRef.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timerRef.current.push(timer);
    return timer;
  };

  const reset = () => {
    clearTimer();
    setState("idle");
    setCaption(idleCaption);
    setRevealedText("");
  };

  const start = () => {
    if (state !== "idle") {
      reset();
      return;
    }

    setState("listening");
    setCaption("Listening…");
    setRevealedText("");
    schedule(() => {
      setCaption("One moment…");
      schedule(() => {
        setState("responding");
        setCaption("VYVA");
        const words = response.split(/(\s+)/).filter(Boolean);
        let elapsed = 0;
        words.forEach((word, index) => {
          const visible = words.slice(0, index + 1).join("");
          schedule(() => setRevealedText(visible), elapsed);
          elapsed += /\s+/.test(word) ? 0 : word.match(/[.!?]$/) ? 500 : word.match(/,$/) ? 390 : 230;
        });
        schedule(reset, elapsed + 1700);
      }, 650);
    }, 1800);
  };

  useEffect(() => () => {
    clearTimer();
  }, []);

  return { state, caption, revealedText, start, reset, isActive: state !== "idle" };
}

function PrototypeShell({
  children,
  testId,
  width = "phone",
  dockPadding = true,
  contained = false,
  shellContract,
}: {
  children: ReactNode;
  testId: string;
  width?: ShellWidth;
  dockPadding?: boolean;
  contained?: boolean;
  shellContract?: SymptomAssessmentShellContract;
}) {
  const { isDark } = useHomeMasterTheme();
  const { size: readableTextSize } = useReadableTextSize();
  // Keep the phone-first composition on small screens, but let the same
  // surface breathe on tablets and desktop instead of leaving a narrow
  // mobile column in the middle of a wide viewport.
  const widthClass = width === "flow"
    ? "max-w-[32.5rem] sm:max-w-[680px] lg:max-w-[900px]"
    : width === "hub"
      ? "max-w-[430px] sm:max-w-[680px] lg:max-w-[900px]"
      : "max-w-[430px] sm:max-w-[620px] lg:max-w-[760px]";
  const frameBottomPadding = contained
    ? dockPadding
      ? "pb-[calc(11rem+env(safe-area-inset-bottom))]"
      : "pb-8"
    : dockPadding
    // The dock is fixed over the page. Reserve more than its visual height so
    // the final message card remains readable above it on short viewports.
      ? "pb-[calc(10rem+env(safe-area-inset-bottom))]"
      : "pb-8";
  const viewportMinHeightClass = contained ? "min-h-[calc(100svh-136px)]" : "min-h-[100svh]";

  return (
    <main
      data-testid={testId}
      data-home-master-theme={isDark ? "dark" : "light"}
      data-vyva-text-size={readableTextSize}
      data-shell-contract={shellContract?.shellId}
      data-header-contract={shellContract?.headerId}
      data-container-contract={shellContract?.containerId}
      data-bottom-nav-contract={shellContract?.bottomNavId}
      data-composer-contract={shellContract?.composer}
      className={[
        "prototype-shell relative w-full overflow-x-hidden",
        viewportMinHeightClass,
        contained ? "" : dockPadding ? "pb-32" : "pb-8",
        isDark ? shellSurface.dark : shellSurface.light,
      ].join(" ")}
    >
      <div
        data-testid={width === "flow" ? "checkin-desktop-shell" : `${testId}-frame`}
        className={["vyva-home-master-fixed-type mx-auto flex w-full flex-col px-6 pt-8 sm:px-7 [@media(max-height:800px)]:pt-4", viewportMinHeightClass, frameBottomPadding, widthClass].join(" ")}
      >
        {children}
      </div>
    </main>
  );
}

function RoundControl({
  icon: Icon,
  label,
  onClick,
  testId,
  variant = "quiet",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  testId?: string;
  variant?: "quiet" | "purple" | "danger";
}) {
  const { isDark } = useHomeMasterTheme();
  const classes =
    variant === "purple"
      ? "bg-vyva-purple text-white ring-2 ring-white/80 shadow-[0_14px_30px_rgba(124,58,237,0.22)]"
      : variant === "danger"
        ? "bg-[#E52222] text-white ring-4 ring-red-500/10 shadow-[0_16px_32px_rgba(229,34,34,0.2)]"
        : isDark
          ? "bg-white/[0.07] text-[#F7F0FF] ring-1 ring-inset ring-white/[0.18]"
          : "bg-white text-[#6B5173] ring-1 ring-black/[0.05] shadow-[0_14px_32px_rgba(80,52,109,0.12)]";

  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
      className={[
        "vyva-tap grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150",
        classes,
      ].join(" ")}
    >
      <VyvaIcon
        icon={Icon}
        size={18}
        strokeWidth={2.45}
        tone={variant === "quiet" && !isDark ? "brand" : "inverse"}
      />
    </button>
  );
}

function VyvaProfileControl({
  onClick,
  testId = "button-home-profile",
  label = "Open profile and settings",
}: {
  onClick: () => void;
  testId?: string;
  label?: string;
}) {
  const { isDark } = useHomeMasterTheme();
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
      className={[
        "vyva-tap grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150",
        isDark
          ? "bg-white/[0.07] text-white ring-1 ring-inset ring-white/[0.18]"
          : "bg-white text-vyva-purple ring-1 ring-black/[0.05] shadow-[0_14px_32px_rgba(80,52,109,0.12)]",
      ].join(" ")}
    >
      <VyvaMark className="h-[18px] w-[18px]" variant={isDark ? "white" : "purple"} />
    </button>
  );
}

function CompactVoiceTrigger({
  testId = "button-compact-voice",
  voicePath = "/dev/home-master",
}: {
  testId?: string;
  voicePath?: string;
}) {
  const navigate = usePrototypeNavigate();
  const { isDark } = useHomeMasterTheme();

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        aria-label="Return to VYVA voice mode"
        data-testid={testId}
        onClick={() => navigate(voicePath)}
        className={[
          "vyva-tap relative grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors duration-150",
          "border-white/70 bg-vyva-purple text-white shadow-[0_14px_30px_rgba(124,58,237,0.22)]",
          isDark ? "border-white/20" : "",
        ].join(" ")}
      >
        <VyvaIcon icon={Mic} size={17} strokeWidth={2.45} tone="inverse" />
      </button>
    </div>
  );
}

function PrototypeTopbar({
  kind,
  title,
  backPath,
  onBack,
  actionPath,
  compactVoice = false,
  profilePath = "/dev/home-master/profile",
  voicePath = "/dev/home-master",
  interactionMode = "touch",
  onInteractionModeChange,
  titleTypography = "display",
}: {
  kind: "home" | "hub" | "destination" | "detail" | "profile";
  title?: string;
  backPath?: string;
  onBack?: () => void;
  actionPath?: string;
  compactVoice?: boolean;
  profilePath?: string;
  voicePath?: string;
  interactionMode?: "voice" | "touch";
  onInteractionModeChange?: (mode: "voice" | "touch") => void;
  titleTypography?: "display" | "body";
}) {
  const navigate = usePrototypeNavigate();
  const hasBackAction = kind !== "home" && Boolean(onBack || backPath);
  const left = !hasBackAction && (kind === "home" || kind === "hub") ? (
    <VyvaProfileControl onClick={() => navigate(profilePath)} />
  ) : (
    <RoundControl icon={ArrowLeft} label="Back" testId="button-prototype-back" onClick={onBack ?? (() => navigate(backPath ?? "/dev/home-master"))} />
  );

  return (
    <header className="grid grid-cols-[40px_1fr_40px] items-center gap-3" data-testid="prototype-home-master-topbar">
      <div>{left}</div>
      <div className="min-w-0 text-center">
        {title ? (
          <h1 className={`truncate text-[24px] leading-tight text-inherit ${
            titleTypography === "body"
              ? "font-body font-extrabold tracking-[-0.025em]"
              : "font-display font-semibold tracking-[-0.03em]"
          }`}>{title}</h1>
        ) : null}
      </div>
      {kind === "home" ? (
        <div data-testid="home-topbar-action-pill" className="flex justify-end">
          <RoundControl
            icon={Hand}
            label="Open manual menu"
            testId="button-home-mode-touch"
            variant="purple"
            onClick={() => navigate(actionPath ?? "/dev/home-master/menu")}
          />
        </div>
      ) : compactVoice && onInteractionModeChange ? (
        <div className="flex justify-end">
          <RoundControl
            icon={interactionMode === "voice" ? Hand : Mic}
            label={interactionMode === "voice" ? "Switch to touch mode" : "Switch to voice mode"}
            testId={interactionMode === "voice" ? "button-symptom-mode-touch" : "button-symptom-mode-voice"}
            variant="purple"
            onClick={() => onInteractionModeChange(interactionMode === "voice" ? "touch" : "voice")}
          />
        </div>
      ) : compactVoice ? (
        <CompactVoiceTrigger voicePath={voicePath} />
      ) : (
        <div aria-hidden="true" />
      )}
    </header>
  );
}

export function PrototypeSymptomAssessmentShell({
  children,
  interactionMode,
  onInteractionModeChange,
  onBack,
  shellContract,
  inlineVoiceControl = false,
}: {
  children: ReactNode;
  interactionMode: "voice" | "touch";
  onInteractionModeChange: (mode: "voice" | "touch") => void;
  onBack: () => void;
  shellContract: SymptomAssessmentShellContract;
  inlineVoiceControl?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <CanonicalDetailFlowShell
      shellTestId="prototype-symptom-assessment-screen"
      contentTestId="prototype-symptom-assessment-content"
      shellContract={{ ...shellContract, headerTitle: t("health.symptomCheck.title", shellContract.headerTitle) }}
      interactionMode={interactionMode}
      onInteractionModeChange={onInteractionModeChange}
      inlineVoiceControl={inlineVoiceControl}
      onBack={onBack}
    >
      {children}
    </CanonicalDetailFlowShell>
  );
}

function CompanionOrb({
  compact = false,
  prompt = "Tap to ask VYVA",
  response = "I'm here with you. We can take this one step at a time.",
  testId = "prototype-orb",
  showCaption = true,
  showIdlePrompt = true,
  onActiveChange,
}: {
  compact?: boolean;
  prompt?: string;
  response?: string;
  testId?: string;
  showCaption?: boolean;
  showIdlePrompt?: boolean;
  onActiveChange?: (isActive: boolean) => void;
}) {
  const interaction = useOrbInteraction(response, prompt);
  const size = compact ? "h-28 w-28" : "h-48 w-48";
  const core = compact ? "h-[74px] w-[74px]" : "h-[124px] w-[124px]";

  useEffect(() => {
    onActiveChange?.(interaction.isActive);
  }, [interaction.isActive, onActiveChange]);

  return (
    <button
      type="button"
      data-testid={testId}
      data-orb-state={interaction.state}
      onClick={interaction.start}
      className={["group relative mx-auto grid place-items-center rounded-full", size].join(" ")}
      aria-label={interaction.isActive ? "Cancel VYVA voice" : prompt}
    >
      <span className="vyva-orb-wave vyva-orb-wave-one" aria-hidden="true" />
      <span className="vyva-orb-wave vyva-orb-wave-two" aria-hidden="true" />
      <span className="vyva-orb-wave vyva-orb-wave-three" aria-hidden="true" />
      <span
        className={[
          "relative rounded-full bg-[radial-gradient(circle_at_35%_28%,#E9D6FF_0%,#B77CF4_44%,#7C3AED_100%)]",
          "shadow-[inset_-16px_-18px_34px_rgba(54,23,94,0.28),0_18px_44px_rgba(124,58,237,0.26)]",
          core,
        ].join(" ")}
      />
      {showCaption && (interaction.isActive || showIdlePrompt) ? (
        <span className="absolute -bottom-9 w-[15rem] text-center font-body text-[15px] font-bold tracking-[-0.01em] text-[#D89225]">
          {interaction.caption}
        </span>
      ) : null}
      {interaction.revealedText ? (
        <span className="absolute top-full mt-12 w-[18rem] text-center font-body text-[16px] font-bold leading-snug text-[#7A7083] dark:text-[#DCCFEF]">
          {interaction.revealedText}
        </span>
      ) : null}
    </button>
  );
}

function RowCard({ item }: { item: RowItem }) {
  const navigate = usePrototypeNavigate();
  const { isDark } = useHomeMasterTheme();
  const { isLarge } = useReadableTextSize();
  const Icon = item.icon;
  const palette = rowTonePalettes[item.tone ?? "neutral"];
  const isAlert = item.emphasis === "alert";
  const titleSize = isLarge ? (item.compactTitle ? 20 : 22) : item.compactTitle ? 18 : 20;
  const subtitleSize = isLarge ? 15 : 13.5;
  const metaSize = isLarge ? 12 : 11;

  return (
    <button
      type="button"
      data-testid={item.testId}
      onClick={() => {
        item.onClick?.();
        if (item.path) navigate(item.path);
      }}
      className={[
        "vyva-tap group flex min-h-[84px] w-full items-center gap-4 rounded-[26px] border px-4 text-left transition-colors duration-150",
        isDark
          ? "border-white/[0.12] bg-white/[0.07] text-[#F9F4FF] shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
          : item.solidSurface
            ? "border-[#EEE8F1] bg-white text-[#241C30] shadow-[0_18px_42px_rgba(80,52,109,0.08)]"
            : "border-[#EEE8F1] bg-white/92 text-[#241C30] shadow-[0_18px_42px_rgba(80,52,109,0.08)]",
        isAlert && !isDark ? "border-[#F7C9C5]" : "",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-14 w-14 flex-shrink-0 place-items-center rounded-[20px] transition-colors duration-150",
          isDark ? "bg-[#3C2956] group-hover:bg-[#443061]" : "bg-[#F1E8FF] group-hover:bg-[#ECE0FF]",
        ].join(" ")}
        data-vyva-icon-tile={item.brandIcon ?? item.iconAccent ?? "utility"}
        aria-hidden="true"
      >
        <VyvaIcon icon={Icon} glyph={item.brandIcon} accent={item.iconAccent} size={item.brandIcon ? 43 : 27} strokeWidth={2.45} tone="brand" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-semibold leading-[1.03] tracking-[-0.025em]" style={{ fontSize: titleSize }}>
          {item.title}
        </span>
        <span
          className="sr-only"
          style={{ fontSize: subtitleSize }}
        >
          {item.subtitle}
        </span>
      </span>
      {item.meta ? (
        <span
          className="rounded-full px-3 py-1.5 font-body text-[12px] font-black"
          style={{
            fontSize: metaSize,
            background: isDark ? palette.darkChip : palette.chip,
            color: isDark ? palette.darkIcon : palette.icon,
          }}
        >
          {item.meta}
        </span>
      ) : (
        <VyvaIcon icon={ChevronRight} size={22} strokeWidth={2.5} tone="muted" />
      )}
    </button>
  );
}

function HairlineRows({ items, testId = "prototype-row-list" }: { items: RowItem[]; testId?: string }) {
  return (
    <div className="mt-7 space-y-4" data-testid={testId}>
      {items.map((item) => (
        <RowCard key={item.title} item={item} />
      ))}
    </div>
  );
}

function HealthHubActionCard({ item }: { item: RowItem }) {
  const navigate = usePrototypeNavigate();
  const { isDark } = useHomeMasterTheme();
  const { isLarge } = useReadableTextSize();
  const Icon = item.icon;
  const palette = rowTonePalettes[item.tone ?? "neutral"];
  const titleSize = item.compactTitle
    ? isLarge
      ? "text-[20px] md:text-[22px]"
      : "text-[18px] md:text-[22px]"
    : isLarge
      ? "text-[22px] md:text-[25px]"
      : "text-[20px] md:text-[24px]";
  const subtitleSize = isLarge ? "text-[15px] md:text-[16px]" : "text-[13.5px] md:text-[14px]";
  const metaSize = isLarge ? "text-[12px] md:text-[13px]" : "text-[11px] md:text-[12px]";

  return (
    <button
      type="button"
      data-testid={item.testId}
      onClick={() => {
        item.onClick?.();
        if (item.path) navigate(item.path);
      }}
      className={[
        "vyva-tap group grid min-h-[84px] w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 rounded-[26px] border px-4 text-left transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 md:min-h-[158px] md:grid-cols-[64px_minmax(0,1fr)_auto] md:grid-rows-[auto_1fr] md:items-start md:gap-y-3 md:p-5",
        isDark
          ? "border-white/[0.14] bg-[#2A2034] text-[#F9F4FF] shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
          : item.solidSurface
            ? "border-[#EEE8F1] bg-white text-[#241C30] shadow-[0_14px_30px_rgba(36,28,48,0.07)]"
            : "border-[#EEE8F1] bg-white/92 text-[#241C30] shadow-[0_14px_30px_rgba(36,28,48,0.07)]",
      ].join(" ")}
    >
      <span
        className={[
          "relative grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-[20px] transition-[background-color,transform] duration-200 group-hover:scale-[1.03] group-focus-visible:scale-[1.03] md:row-span-2 md:h-16 md:w-16 md:self-start",
          isDark ? "bg-[#3C2956] group-hover:bg-[#443061]" : "bg-[#F1E8FF] group-hover:bg-[#ECE0FF]",
        ].join(" ")}
        data-testid={item.testId ? `${item.testId}-icon` : undefined}
        data-vyva-icon-tile={item.brandIcon ?? item.iconAccent ?? "utility"}
        aria-hidden="true"
      >
        <VyvaIcon
          icon={Icon}
          glyph={item.brandIcon}
          accent={item.iconAccent}
          size={item.brandIcon ? 44 : 29}
          strokeWidth={2.55}
          tone="brand"
        />
      </span>
      <span className="min-w-0 self-center md:self-start">
        <span className={["block font-display font-semibold leading-[1.03] tracking-[-0.025em]", titleSize].join(" ")}>
          {item.title}
        </span>
        <span
          className="sr-only"
        >
          {item.subtitle}
        </span>
      </span>
      {item.meta ? (
        <span
          className={["self-center whitespace-nowrap rounded-full px-3 py-1.5 font-body font-black md:self-start", metaSize].join(" ")}
          style={{
            background: isDark ? palette.darkChip : palette.chip,
            color: isDark ? palette.darkIcon : palette.icon,
          }}
          data-testid={item.testId ? `${item.testId}-status` : undefined}
        >
          {item.meta}
        </span>
      ) : null}
      <span className="hidden opacity-70 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 md:col-start-3 md:row-start-2 md:block md:self-end md:justify-self-end">
        <VyvaIcon icon={ArrowUpRight} size={20} strokeWidth={2.35} tone="muted" />
      </span>
    </button>
  );
}

function HealthHubActionGrid({
  items,
  testId = "health-action-grid",
}: {
  items: RowItem[];
  testId?: string;
}) {
  return (
    <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5" data-testid={testId}>
      {items.map((item) => (
        <HealthHubActionCard key={item.title} item={item} />
      ))}
    </div>
  );
}

function SectionedRows({ sections }: { sections: PrototypeSection[] }) {
  const { isDark } = useHomeMasterTheme();
  return (
    <div className="mt-7 space-y-7">
      {sections.map((section, index) => (
        <section key={section.eyebrow ?? index}>
          {section.eyebrow ? (
            <p className={["mb-3 px-1 font-body text-[12px] font-black uppercase tracking-[0.16em]", isDark ? "text-[#BDAED4]" : "text-[#9E92AA]"].join(" ")}>
              {section.eyebrow}
            </p>
          ) : null}
          <div className="space-y-4">
            {section.items.map((item) => (
              <RowCard key={item.title} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TrendNote({
  title,
  children,
  tone = "health",
}: {
  title: string;
  children: ReactNode;
  tone?: RowTone;
}) {
  const { isDark } = useHomeMasterTheme();
  const palette = rowTonePalettes[tone];
  return (
    <section
      className={[
        "mt-6 rounded-[26px] border px-5 py-4",
        isDark ? "border-white/[0.12] bg-white/[0.06]" : "border-[#EFE4F6] bg-white/82",
      ].join(" ")}
    >
      <p className={["font-body text-[12px] font-black uppercase tracking-[0.16em]", isDark ? "text-[#BDAED4]" : "text-[#9E92AA]"].join(" ")}>
        {title}
      </p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className={["font-body text-[16px] font-extrabold leading-snug", isDark ? "text-[#F5EEFF]" : "text-[#6C5F78]"].join(" ")}>
          {children}
        </p>
        <div className="flex h-11 items-end gap-1.5 opacity-70" aria-hidden="true">
          {[16, 24, 20, 31, 28, 36, 42].map((height, index) => (
            <span
              key={height + index}
              className="w-2 rounded-full"
              style={{ height, background: palette.icon }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function PrototypeHomeScreen() {
  const navigate = usePrototypeNavigate();
  const { isDark } = useHomeMasterTheme();
  const { greeting } = useTimeOfDayCopy();
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const moments = useMemo(() => [
    {
      tag: "Now",
      text: <>Your blood pressure tablet is due in <b>40 minutes</b>.</>,
      path: "",
      response: "Got it. I'll remind you again in forty minutes.",
    },
    {
      text: <>Your heart has been <b>steady</b> today.</>,
      path: "/dev/home-master/health",
    },
    {
      text: <>You scored <b>84%</b> on Rhythm Tap yesterday.</>,
      path: "/dev/home-master/brain",
    },
    {
      text: <>Elena replied in your <b>Book Club room</b>.</>,
      path: "/dev/home-master/community",
    },
  ], []);
  const [momentIndex, setMomentIndex] = useState(0);
  const [showIdlePrompt, setShowIdlePrompt] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMomentIndex((current) => (current + 1) % moments.length);
    }, 8_500);
    return () => window.clearInterval(timer);
  }, [moments.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIdlePrompt(false), 10_000);
    return () => window.clearTimeout(timer);
  }, []);

  const currentMoment = moments[momentIndex];

  return (
    <PrototypeShell testId="home-master-layout">
      <PrototypeTopbar kind="home" actionPath="/dev/home-master/menu" profilePath="/dev/home-master/profile" />
      <section
        data-testid="home-master-hero"
        className="flex min-h-0 flex-1 flex-col items-center justify-center pb-[calc(9rem+env(safe-area-inset-bottom))] pt-12 text-center md:justify-start md:pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-14"
      >
        <h1
          className={[
            "max-w-[21rem] font-display text-[38px] font-semibold leading-[0.98] tracking-[-0.04em]",
            isDark ? "text-[#FFF8FF]" : "text-[#241C30]",
          ].join(" ")}
        >
          {greeting}
        </h1>
        <div className="mt-9">
          <CompanionOrb
            prompt="Tap the circle to talk"
            response={currentMoment.response ?? "I'm here. Tell me what you'd like to do next."}
            testId="home-dormant-zamora-orb-visual"
            showIdlePrompt={showIdlePrompt}
            onActiveChange={setIsVoiceActive}
          />
        </div>
        {!isVoiceActive ? (
          <button
            type="button"
            data-testid="home-rotating-moment"
            onClick={() => {
              if (currentMoment.path) navigate(currentMoment.path);
            }}
            className={[
              // Keep the board in normal flow, then let desktop flex space
              // place it above the reserved dock area instead of underneath it.
              "relative z-10 mt-10 w-full max-w-[22rem] rounded-[28px] border px-5 py-4 text-left transition-colors duration-150 md:mt-auto md:mb-4",
              isDark ? "border-white/[0.12] bg-white/[0.07]" : "border-[#EFE4F6] bg-white/82 shadow-[0_18px_42px_rgba(80,52,109,0.08)]",
            ].join(" ")}
          >
            {currentMoment.tag ? (
              <span className="mb-1 inline-flex rounded-full bg-[#FBF1E3] px-2 py-1 font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#B8791F]">
                {currentMoment.tag}
              </span>
            ) : null}
            <span
              className={[
                "block max-h-[3.5rem] overflow-hidden font-body text-[17px] font-extrabold leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]",
                isDark ? "text-[#F7F0FF]" : "text-[#6C5F78]",
              ].join(" ")}
            >
              {currentMoment.text}
            </span>
            <span className="mt-3 flex gap-1.5" aria-hidden="true">
              {moments.map((_, index) => (
                <span
                  key={index}
                  className={[
                    "h-1.5 rounded-full transition-all",
                    index === momentIndex ? "w-5 bg-vyva-purple" : isDark ? "w-1.5 bg-white/25" : "w-1.5 bg-[#D9CFE4]",
                  ].join(" ")}
                />
              ))}
            </span>
          </button>
        ) : null}
      </section>
    </PrototypeShell>
  );
}

export function PrototypeMenuScreen({
  backPath = "/dev/home-master",
}: {
  backPath?: string;
} = {}) {
  const { t } = useLanguage();
  const items: RowItem[] = [
    { icon: Heart, iconAccent: "pulse", title: "My Health", subtitle: "Check-ins & medicines", tone: "health", path: "/dev/home-master/health", testId: "card-home-agent-health", solidSurface: true },
    { icon: Brain, iconAccent: "bridge", title: t("home.master.cards.mindMemoryShortTitle", "Brain Power"), subtitle: "Memory, focus & calm", tone: "brain", path: "/dev/home-master/brain", testId: "card-home-agent-brain", solidSurface: true },
    { icon: Users, iconAccent: "link", title: "Community", subtitle: "Rooms & support", tone: "community", path: "/dev/home-master/community", testId: "card-home-agent-community", solidSurface: true },
    { icon: Bell, iconAccent: "clapper", title: "Concierge", subtitle: "Everyday help", tone: "concierge", path: "/dev/home-master/concierge", testId: "card-home-agent-concierge", solidSurface: true },
  ];

  return (
    <PrototypeShell testId="prototype-menu-screen" width="hub" contained>
      <PrototypeTopbar kind="hub" title="Menu" backPath={backPath} profilePath="/dev/home-master/profile" compactVoice />
      <HealthHubActionGrid items={items} testId="menu-tile-grid" />
    </PrototypeShell>
  );
}

export function PrototypeHealthScreen({
  healthPlanPath = "/dev/home-master/health-plan",
  askDrAiPath = "/dev/home-master/ask-dr-ai?fresh=1",
  vitalsPath = "/dev/home-master/vitals",
  medicinesPath = "/dev/home-master/medicines",
  voicePath = "/dev/home-master",
  profilePath = "/dev/home-master/profile",
  backPath = "/dev/home-master/menu",
  contained = false,
}: {
  checkInPath?: string;
  healthPlanPath?: string;
  askDrAiPath?: string;
  vitalsPath?: string;
  medicinesPath?: string;
  voicePath?: string;
  profilePath?: string;
  backPath?: string;
  contained?: boolean;
}) {
  const { t } = useLanguage();
  const healthRows: RowItem[] = [
    { icon: Stethoscope, brandIcon: "doctor", title: t("healthHub.askTitle", "Ask Dr. AI"), subtitle: t("healthHub.askSubtitle", "Aches or changes"), meta: t("healthHub.start", "Start"), tone: "health", path: askDrAiPath, testId: "button-health-symptom-report", emphasis: "alert", solidSurface: true, compactTitle: true },
    { icon: ShieldCheck, brandIcon: "longevity", title: t("healthHub.longevityTitle", "Longevity"), subtitle: t("healthHub.longevitySubtitle", "Prevention is the best cure"), meta: t("healthHub.today", "Today"), tone: "brain", path: healthPlanPath, testId: "button-health-plan", solidSurface: true },
    { icon: HeartPulse, brandIcon: "vitals", title: t("healthHub.vitalsTitle", "My Vitals"), subtitle: t("healthHub.vitalsSubtitle", "Readings and trends"), meta: "72 bpm", tone: "community", path: vitalsPath, testId: "button-health-vitals", solidSurface: true },
    { icon: Pill, brandIcon: "medication", title: t("healthHub.medicationTitle", "Medication"), subtitle: t("healthHub.medicationSubtitle", "Doses and reminders"), meta: "2:00 PM", tone: "profile", path: medicinesPath, testId: "button-health-medicines", solidSurface: true },
  ];

  return (
    <PrototypeShell testId="prototype-health-screen" width="hub" contained={contained}>
      <PrototypeTopbar kind="hub" title={t("healthHub.title", "My Health")} backPath={backPath} profilePath={profilePath} voicePath={voicePath} compactVoice />
      <HealthHubActionGrid items={healthRows} />
    </PrototypeShell>
  );
}

type PrototypeHealthActionPreviewKind = "plan" | "symptom" | "vitals" | "medicines";

const healthActionPreviewContent: Record<PrototypeHealthActionPreviewKind, {
  icon: LucideIcon;
  glyph: VyvaBrandGlyph;
  title: string;
  subtitle: string;
}> = {
  plan: {
    icon: ShieldCheck,
    glyph: "longevity",
    title: "Longevity",
    subtitle: "Prevention is the best cure",
  },
  symptom: {
    icon: Stethoscope,
    glyph: "doctor",
    title: "Ask Dr. AI",
    subtitle: "A focused symptom report starts here.",
  },
  vitals: {
    icon: HeartPulse,
    glyph: "vitals",
    title: "My Vitals",
    subtitle: "Latest readings and new measurements live here.",
  },
  medicines: {
    icon: Pill,
    glyph: "medication",
    title: "Medication",
    subtitle: "Dose times and reminders open here.",
  },
};

export function PrototypeHealthActionPreviewScreen({
  kind = "symptom",
  backPath = "/dev/home-master/health",
}: {
  kind?: PrototypeHealthActionPreviewKind;
  backPath?: string;
} = {}) {
  const navigate = usePrototypeNavigate();
  const content = healthActionPreviewContent[kind];
  const Icon = content.icon;

  return (
    <PrototypeShell testId={`prototype-health-action-preview-${kind}`} width="flow" dockPadding={false}>
      <PrototypeTopbar kind="detail" backPath={backPath} />
      <CheckInCard testId="prototype-health-action-preview-card">
        <span
          className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-[#F1E8FF]"
        >
          <VyvaIcon icon={Icon} glyph={content.glyph} size={46} />
        </span>
        <h2 className="mt-7 font-display text-[34px] font-semibold leading-tight">{content.title}</h2>
        <p className="mx-auto mt-3 max-w-[20rem] font-body text-[17px] font-bold text-[#8A8095] dark:text-[#DCCFEF]">
          {content.subtitle}
        </p>
        <button
          type="button"
          data-testid="button-health-action-preview-back"
          onClick={() => navigate(backPath)}
          className="mt-8 w-full rounded-[22px] bg-vyva-purple px-5 py-4 font-body text-[17px] font-black text-white"
        >
          Back to Health
        </button>
      </CheckInCard>
    </PrototypeShell>
  );
}

function DestinationScreen({
  title,
  rows,
  testId,
  trend,
  profilePath = "/dev/home-master/profile",
}: {
  title: string;
  rows: RowItem[];
  testId: string;
  trend?: ReactNode;
  voicePath?: string;
  profilePath?: string;
}) {
  return (
    <PrototypeShell testId={testId}>
      <PrototypeTopbar kind="destination" title={title} backPath="/dev/home-master/menu" profilePath={profilePath} compactVoice />
      <HairlineRows items={rows} />
      {trend}
    </PrototypeShell>
  );
}

export function PrototypeBrainScreen({
  voicePath,
  profilePath,
}: {
  voicePath?: string;
  profilePath?: string;
} = {}) {
  const { t } = useLanguage();
  return (
    <DestinationScreen
      testId="prototype-brain-screen"
      title={t("home.master.cards.mindMemoryShortTitle", "Brain Power")}
      rows={[
        { icon: Activity, iconAccent: "pulse", title: "Rhythm Tap", subtitle: "A short focus game", meta: "Play", tone: "brain" },
        { icon: UserRound, iconAccent: "id", title: "Face-Name Match", subtitle: "Practice names gently", meta: "Play", tone: "community" },
        { icon: MessageCircle, iconAccent: "smile", title: "Mood check-in", subtitle: "A calm reflection", meta: "Start", tone: "profile" },
      ]}
      trend={<TrendNote title="Rhythm Tap — this week" tone="brain">Your rhythm score has been <span className="text-violet-500">gently climbing.</span></TrendNote>}
      voicePath={voicePath}
      profilePath={profilePath}
    />
  );
}

export function PrototypeCommunityScreen({
  voicePath,
  profilePath,
}: {
  voicePath?: string;
  profilePath?: string;
} = {}) {
  return (
    <DestinationScreen
      testId="prototype-community-screen"
      title="Community"
      rows={[
        { icon: BookOpen, iconAccent: "bookmark", title: "Book Club", subtitle: "Elena: I loved that chapter too", tone: "community" },
        { icon: Users, iconAccent: "path", title: "Morning Walkers", subtitle: "A gentle walk is planned tomorrow", tone: "community" },
        { icon: Sparkles, iconAccent: "spark", title: "Share a story", subtitle: "A simple prompt for today", tone: "profile" },
      ]}
      voicePath={voicePath}
      profilePath={profilePath}
    />
  );
}

export function PrototypeConciergeScreen({
  voicePath,
  profilePath,
}: {
  voicePath?: string;
  profilePath?: string;
} = {}) {
  return (
    <DestinationScreen
      testId="prototype-concierge-screen"
      title="Concierge"
      rows={[
        { icon: Car, iconAccent: "pin", title: "Ride to Dr. Reyes", subtitle: "Confirmed for tomorrow", meta: "Done", tone: "concierge" },
        { icon: Pill, iconAccent: "divider", title: "Pharmacy refill", subtitle: "Waiting for confirmation", meta: "Pending", tone: "profile" },
        { icon: Phone, iconAccent: "signal", title: "Call trusted help", subtitle: "For service questions", tone: "reports" },
      ]}
      voicePath={voicePath}
      profilePath={profilePath}
    />
  );
}

export function PrototypeReportsScreen({
  voicePath,
  profilePath,
}: {
  voicePath?: string;
  profilePath?: string;
} = {}) {
  return (
    <DestinationScreen
      testId="prototype-reports-screen"
      title="My Reports"
      rows={[
        { icon: Footprints, iconAccent: "step", title: "Steps", subtitle: "A little more than last week", meta: "Good", tone: "health" },
        { icon: ChartNoAxesColumnIncreasing, iconAccent: "trend", title: "Rhythm Tap average", subtitle: "Gently improving", meta: "Up", tone: "brain" },
        { icon: MessagesSquare, iconAccent: "dot", title: "Conversations", subtitle: "Three meaningful chats", meta: "3", tone: "community" },
        { icon: CalendarCheck, iconAccent: "calendar", title: "Appointments kept", subtitle: "Both planned visits completed", meta: "2/2", tone: "concierge" },
      ]}
      voicePath={voicePath}
      profilePath={profilePath}
    />
  );
}

export function PrototypeProfileScreen({ returnPath = "/dev/home-master" }: { returnPath?: string } = {}) {
  const { isDark } = useHomeMasterTheme();
  const profileSections: PrototypeSection[] = [
    {
      eyebrow: "Your details",
      items: [
        { icon: UserRound, iconAccent: "id", title: "Account details", subtitle: "Name, phone, language", tone: "brain", path: "/dev/home-master/profile/account", testId: "button-profile-account" },
        { icon: Heart, iconAccent: "pulse", title: "Health profile", subtitle: "Conditions and basics", tone: "health", path: "/dev/home-master/profile/health", testId: "button-profile-health" },
        { icon: Pill, iconAccent: "divider", title: "My Medication", subtitle: "Current medications", tone: "profile", path: "/dev/home-master/profile/medicines", testId: "button-profile-medicines" },
        { icon: ShieldCheck, iconAccent: "check", title: "Emergency contact", subtitle: "Who to call if needed", tone: "health", path: "/dev/home-master/profile/emergency", testId: "button-profile-emergency" },
        { icon: SlidersHorizontal, iconAccent: "knobs", title: "Preferences", subtitle: "Text and theme", tone: "reports", path: "/dev/home-master/profile/preferences", testId: "button-profile-accessibility" },
      ],
    },
    {
      eyebrow: "Who can help",
      items: [
        { icon: Users, iconAccent: "link", title: "Care team", subtitle: "Family and contacts", tone: "community", path: "/dev/home-master/profile/care-team", testId: "button-profile-care-team" },
        { icon: Stethoscope, iconAccent: "scope", title: "Doctors & providers", subtitle: "Clinics and trusted help", tone: "concierge", path: "/dev/home-master/profile/providers", testId: "button-profile-providers" },
      ],
    },
  ];

  return (
    <PrototypeShell testId="prototype-profile-screen" dockPadding={false}>
      <PrototypeTopbar kind="profile" backPath={returnPath} compactVoice />
      <section
        className={[
          "mt-7 rounded-[28px] border px-5 py-5",
          isDark ? "border-white/[0.12]" : "border-[#E9DEF2]",
          isDark ? "bg-white/[0.06]" : "bg-white/86 shadow-[0_18px_42px_rgba(80,52,109,0.08)]",
        ].join(" ")}
      >
        <div className="flex items-center gap-4">
          <span
            className={[
              "grid h-14 w-14 place-items-center rounded-full font-display text-[27px] font-semibold",
              isDark ? "bg-white/[0.08] text-[#F3EEF8]" : "bg-[#F1EEF3] text-[#5F5667]",
            ].join(" ")}
          >
            K
          </span>
          <div className="min-w-0">
            <h1 className={["font-display text-[25px] font-semibold leading-tight tracking-[-0.02em]", isDark ? "text-[#FFF8FF]" : "text-[#342B3F]"].join(" ")}>
              Karim
            </h1>
            <p className={["mt-1 font-body text-[14px] font-bold", isDark ? "text-[#D8CFE6]" : "text-[#8A8095]"].join(" ")}>
              {screenCopy.location}
            </p>
            <p className={["mt-2 font-body text-[13px] font-black uppercase tracking-[0.12em]", isDark ? "text-[#BDAED4]" : "text-[#9E92AA]"].join(" ")}>
              Profile & settings
            </p>
          </div>
        </div>
      </section>
      <SectionedRows sections={profileSections} />
      <button
        type="button"
        data-testid="button-profile-call-support"
        onClick={() => openExistingSos("prototype-profile-support")}
        className={[
          "mt-6 flex w-full items-center justify-center gap-2 rounded-[24px] border px-5 py-4 font-body text-[16px] font-black",
          isDark ? "border-white/[0.12] bg-white/[0.07] text-[#F7F0FF]" : "border-[#E9DEF2] bg-white/86 text-[#342B3F]",
        ].join(" ")}
      >
        <VyvaIcon icon={Phone} size={19} strokeWidth={2.45} tone={isDark ? "inverse" : "brand"} />
        Call support
      </button>
    </PrototypeShell>
  );
}

type PrototypeProfileActionPreviewKind = "accessibility";

const profileActionPreviewContent: Record<PrototypeProfileActionPreviewKind, {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}> = {
  accessibility: {
    icon: SlidersHorizontal,
    title: "Preferences",
    subtitle: "Text size and theme",
  },
};

function getProfileAccessibilityRows({
  isDark,
  isLarge,
  toggleSize,
  toggleTheme,
}: {
  isDark: boolean;
  isLarge: boolean;
  toggleSize: () => void;
  toggleTheme: () => void;
}): RowItem[] {
  return [
    {
      icon: Type,
      title: "Text size",
      subtitle: isLarge ? "Currently Large" : "Currently Normal",
      meta: "Change",
      tone: "reports",
      testId: "profile-accessibility-text-size",
      onClick: toggleSize,
    },
    {
      icon: Sun,
      title: "Theme",
      subtitle: isDark ? "Currently Dark" : "Currently Light",
      meta: "Change",
      tone: "profile",
      testId: "profile-accessibility-theme",
      onClick: toggleTheme,
    },
  ];
}

export function PrototypeProfileActionPreviewScreen({
  kind,
  backPath = "/dev/home-master/profile",
}: {
  kind: PrototypeProfileActionPreviewKind;
  backPath?: string;
}) {
  const navigate = usePrototypeNavigate();
  const { isDark, toggleTheme } = useHomeMasterTheme();
  const { isLarge, toggleSize } = useReadableTextSize();
  const content = profileActionPreviewContent[kind];
  const Icon = content.icon;
  const rows = getProfileAccessibilityRows({ isDark, isLarge, toggleSize, toggleTheme });

  return (
    <PrototypeShell testId={`prototype-profile-action-preview-${kind}`} width="flow" dockPadding={false}>
      <PrototypeTopbar kind="detail" backPath={backPath} />
      <section
        className={[
          "mt-7 rounded-[30px] border px-5 py-5",
          isDark
            ? "border-white/[0.12] bg-white/[0.06] shadow-[0_18px_42px_rgba(0,0,0,0.12)]"
            : "border-[#E9DEF2] bg-white/86 shadow-[0_18px_42px_rgba(80,52,109,0.08)]",
        ].join(" ")}
      >
        <div className="flex items-center gap-4">
          <span
            className={[
              "grid h-14 w-14 shrink-0 place-items-center rounded-[20px]",
              isDark ? "bg-[#35284A]" : "bg-[#F1E8FF]",
            ].join(" ")}
            aria-hidden="true"
          >
            <VyvaIcon icon={Icon} size={27} strokeWidth={2.45} tone={isDark ? "inverse" : "brand"} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[27px] font-semibold leading-tight tracking-[-0.02em]">
              {content.title}
            </h1>
            <p className="mt-1 font-body text-[15px] font-bold text-[#8A8095] dark:text-[#DCCFEF]">
              {content.subtitle}
            </p>
          </div>
        </div>
      </section>
      <HairlineRows items={rows} />
      <button
        type="button"
        data-testid="button-profile-action-preview-back"
        onClick={() => navigate(backPath)}
        className="mt-6 w-full rounded-[22px] bg-vyva-purple px-5 py-4 font-body text-[17px] font-black text-white"
      >
        Back to Profile
      </button>
    </PrototypeShell>
  );
}

type CheckInQuestionId = "feeling" | "detail";
type CheckInFlowStatus = "collecting" | "summary" | "safety";
type CheckInAnswerModality = "touch" | "voice";

type CheckInOptionFixture = {
  id: string;
  label: string;
  next: CheckInQuestionId | "summary";
};

type CheckInQuestionFixture = {
  id: CheckInQuestionId;
  title: string;
  options: CheckInOptionFixture[];
};

export type PrototypeCheckInAnswer = {
  questionId: CheckInQuestionId;
  optionId: string;
  label: string;
  modality: CheckInAnswerModality;
};

export type PrototypeCheckInRejection = {
  reason: "stale_scene" | "unknown_answer" | "inactive_flow";
  activeQuestionId: CheckInQuestionId | null;
  attemptedQuestionId: CheckInQuestionId;
  modality: CheckInAnswerModality;
};

export type PrototypeCheckInFlowState = {
  flowId: "health.preventive_check@1.0.0";
  status: CheckInFlowStatus;
  currentQuestionId: CheckInQuestionId | null;
  resumeQuestionId: CheckInQuestionId | null;
  answers: PrototypeCheckInAnswer[];
  lastRejection: PrototypeCheckInRejection | null;
};

type PrototypeCheckInFlowActions = {
  answer: (questionId: CheckInQuestionId, optionId: string, modality: CheckInAnswerModality) => void;
  safety: () => void;
  resume: () => void;
  complete: () => void;
};

const CHECK_IN_QUESTIONS: Record<CheckInQuestionId, CheckInQuestionFixture> = {
  feeling: {
    id: "feeling",
    title: "How are you feeling today?",
    options: [
      { id: "great", label: "Great", next: "summary" },
      { id: "okay", label: "Okay", next: "summary" },
      { id: "not_my_best", label: "Not my best", next: "detail" },
      { id: "something_bothering_me", label: "Something's bothering me", next: "detail" },
    ],
  },
  detail: {
    id: "detail",
    title: "Want to tell me a bit more?",
    options: [
      { id: "tired", label: "Tired or low energy", next: "summary" },
      { id: "aches_discomfort", label: "Aches or discomfort", next: "summary" },
      { id: "sleep", label: "Trouble sleeping", next: "summary" },
      { id: "off_day", label: "Just an off day", next: "summary" },
      { id: "something_else", label: "Something else", next: "summary" },
    ],
  },
};

const CHECK_IN_ANSWER_LABELS: Record<CheckInQuestionId, string> = {
  feeling: "Feeling today",
  detail: "A little more",
};

export const initialPrototypeCheckInFlowState: PrototypeCheckInFlowState = {
  flowId: "health.preventive_check@1.0.0",
  status: "collecting",
  currentQuestionId: "feeling",
  resumeQuestionId: null,
  answers: [],
  lastRejection: null,
};

export function normalizePrototypeCheckInAnswer(
  questionId: CheckInQuestionId,
  optionId: string,
  modality: CheckInAnswerModality,
): PrototypeCheckInAnswer | null {
  const option = CHECK_IN_QUESTIONS[questionId]?.options.find((candidate) => candidate.id === optionId);
  if (!option) return null;
  return { questionId, optionId: option.id, label: option.label, modality };
}

export function submitPrototypeCheckInAnswer(
  state: PrototypeCheckInFlowState,
  input: {
    questionId: CheckInQuestionId;
    optionId: string;
    modality: CheckInAnswerModality;
  },
): PrototypeCheckInFlowState {
  if (state.status !== "collecting" || !state.currentQuestionId) {
    return {
      ...state,
      lastRejection: {
        reason: "inactive_flow",
        activeQuestionId: state.currentQuestionId,
        attemptedQuestionId: input.questionId,
        modality: input.modality,
      },
    };
  }

  if (input.questionId !== state.currentQuestionId) {
    return {
      ...state,
      lastRejection: {
        reason: "stale_scene",
        activeQuestionId: state.currentQuestionId,
        attemptedQuestionId: input.questionId,
        modality: input.modality,
      },
    };
  }

  const answer = normalizePrototypeCheckInAnswer(input.questionId, input.optionId, input.modality);
  if (!answer) {
    return {
      ...state,
      lastRejection: {
        reason: "unknown_answer",
        activeQuestionId: state.currentQuestionId,
        attemptedQuestionId: input.questionId,
        modality: input.modality,
      },
    };
  }

  const next = CHECK_IN_QUESTIONS[input.questionId].options.find((option) => option.id === input.optionId)?.next ?? "summary";
  const answers = [...state.answers, answer];

  if (next === "summary") {
    return { ...state, status: "summary", currentQuestionId: null, answers, lastRejection: null };
  }

  return { ...state, currentQuestionId: next, answers, lastRejection: null };
}

function usePrototypeCheckInFlow(onComplete: () => void) {
  const [flowState, setFlowState] = useState<PrototypeCheckInFlowState>(initialPrototypeCheckInFlowState);
  const actions: PrototypeCheckInFlowActions = useMemo(() => ({
    answer(questionId, optionId, modality) {
      setFlowState((current) => submitPrototypeCheckInAnswer(current, { questionId, optionId, modality }));
    },
    safety() {
      setFlowState((current) => ({
        ...current,
        status: "safety",
        resumeQuestionId: current.currentQuestionId,
        currentQuestionId: null,
      }));
    },
    resume() {
      setFlowState((current) => ({
        ...current,
        status: "collecting",
        currentQuestionId: current.resumeQuestionId ?? "feeling",
        resumeQuestionId: null,
      }));
    },
    complete() {
      onComplete();
    },
  }), [onComplete]);

  return { flowState, actions, currentQuestion: flowState.currentQuestionId ? CHECK_IN_QUESTIONS[flowState.currentQuestionId] : null };
}

function CheckInAdapterBoundary({
  state,
  currentQuestion,
}: {
  state: PrototypeCheckInFlowState;
  currentQuestion: CheckInQuestionFixture | null;
}) {
  return (
    <output
      data-testid="checkin-flow-adapter-boundary"
      data-flow-id="health.preventive_check"
      data-flow-version="1.0.0"
      data-source="local_fixture_adapter"
      data-status={state.status}
      data-scene-id={currentQuestion ? `health.preventive_check.${currentQuestion.id}` : ""}
      data-question-id={currentQuestion?.id ?? ""}
      data-answer-count={state.answers.length}
      className="sr-only"
    >
      {JSON.stringify({
        flowState: state.flowId,
        status: state.status,
        currentQuestion: currentQuestion?.id ?? null,
        answers: state.answers.map((answer) => answer.optionId),
        callbacks: ["answer", "safety", "resume", "complete"],
      })}
    </output>
  );
}

function CheckInCard({
  children,
  testId,
  questionId,
}: {
  children: ReactNode;
  testId: string;
  questionId?: string;
}) {
  const { isDark } = useHomeMasterTheme();
  return (
    <section
      data-testid={testId}
      data-question-id={questionId}
      className={[
        "mt-7 rounded-[34px] px-6 py-8 text-center",
        isDark
          ? "bg-[#FBF8FD] text-[#241C30] shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
          : "bg-white/92 text-[#241C30] ring-1 ring-[#EFE4F6]",
      ].join(" ")}
    >
      {children}
    </section>
  );
}

export function PrototypeCheckInScreen({ returnPath = "/dev/home-master/health" }: { returnPath?: string } = {}) {
  const navigate = useNavigate();
  const { flowState, actions, currentQuestion } = usePrototypeCheckInFlow(() => navigate(returnPath));

  if (flowState.status === "safety") {
    return (
      <PrototypeShell testId="prototype-checkin-safety" width="flow" dockPadding={false}>
        <CheckInAdapterBoundary state={flowState} currentQuestion={currentQuestion} />
        <PrototypeTopbar kind="detail" backPath={returnPath} title="Safety" />
        <CheckInCard testId="prototype-checkin-safety-card">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-[#FFF4E5]">
            <VyvaIcon icon={AlertTriangle} size={30} strokeWidth={2.5} tone="danger" />
          </span>
          <h1 className="mt-7 font-display text-[32px] font-semibold leading-tight">Let’s get you help right now.</h1>
          <p className="mx-auto mt-3 max-w-[20rem] font-body text-[17px] font-bold text-[#8A8095]">
            I’ve paused the check-in. Tap below and I’ll connect you right away.
          </p>
          <button
            type="button"
            data-testid="button-checkin-safety-sos"
            onClick={() => openExistingSos("prototype-checkin-safety")}
            className="mt-7 w-full rounded-[22px] bg-[#E52222] px-5 py-4 font-body text-[17px] font-black text-white"
          >
            Get help now
          </button>
          <button
            type="button"
            data-testid="button-checkin-safety-resume"
            onClick={actions.resume}
            className="mt-3 w-full rounded-[22px] border border-[#EFE4F6] bg-white/70 px-5 py-4 font-body text-[17px] font-black text-[#7C3AED]"
          >
            I’m okay — go back
          </button>
        </CheckInCard>
      </PrototypeShell>
    );
  }

  if (flowState.status === "summary") {
    return (
      <PrototypeShell testId="prototype-checkin-summary-screen" width="flow" dockPadding={false}>
        <CheckInAdapterBoundary state={flowState} currentQuestion={currentQuestion} />
        <PrototypeTopbar kind="detail" backPath={returnPath} title="Check-in" />
        <CheckInCard testId="prototype-checkin-summary">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-[#EAFBF1]">
            <VyvaIcon icon={CheckCircle2} size={31} strokeWidth={2.5} tone="success" />
          </span>
          <h1 className="mt-7 font-display text-[34px] font-semibold leading-tight">Here’s what you told VYVA.</h1>
          <p className="mt-2 font-body text-[16px] font-bold text-[#8A8095]">Thanks for checking in.</p>
          <div className="mt-7 divide-y divide-[#EFE4F6] rounded-[24px] bg-[#FBF8FD] px-5 text-left">
            {flowState.answers.map((answer) => (
              <div key={`${answer.questionId}-${answer.optionId}`} className="flex items-center gap-3 py-4">
                <VyvaIcon icon={CheckCircle2} size={22} tone="success" />
                <span>
                  <span className="block font-body text-[16px] font-black">{CHECK_IN_ANSWER_LABELS[answer.questionId]}</span>
                  <span className="block font-body text-[15px] font-bold text-[#8A8095]">{answer.label}</span>
                </span>
              </div>
            ))}
          </div>
          <button type="button" onClick={actions.complete} className="mt-7 w-full rounded-[22px] bg-vyva-purple px-5 py-4 font-body text-[17px] font-black text-white">
            Done
          </button>
        </CheckInCard>
      </PrototypeShell>
    );
  }

  const question = currentQuestion ?? CHECK_IN_QUESTIONS.feeling;

  return (
    <PrototypeShell testId="prototype-checkin-screen" width="flow" dockPadding={false}>
      <CheckInAdapterBoundary state={flowState} currentQuestion={question} />
      <PrototypeTopbar kind="detail" backPath={returnPath} title="Check-in" />
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#EEE5F6]">
        <div className="h-full rounded-full bg-vyva-purple" style={{ width: question.id === "feeling" ? "50%" : "100%" }} />
      </div>
      <CheckInCard testId="prototype-checkin-question" questionId={question.id}>
        <span
          data-testid="checkin-question-source-icon"
          data-icon-type="vyva-mark"
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-vyva-purple text-white shadow-[0_16px_34px_rgba(124,58,237,0.24)]"
        >
          <VyvaMark className="h-6 w-6" variant="white" />
        </span>
        <p className="mt-5 font-body text-[12px] font-black uppercase tracking-[0.16em] text-vyva-purple">VYVA is asking</p>
        <h1 className="mx-auto mt-3 max-w-[24rem] font-display text-[32px] font-semibold leading-tight">{question.title}</h1>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`button-checkin-option-${option.id}`}
              onClick={() => actions.answer(question.id, option.id, "touch")}
              className="min-h-[60px] rounded-[22px] border border-[#EFE4F6] bg-white px-4 py-3 font-body text-[16px] font-black text-[#241C30] shadow-[0_10px_28px_rgba(80,52,109,0.05)]"
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="button-checkin-urgent-escape"
          onClick={actions.safety}
          className="mt-6 font-body text-[16px] font-black text-[#E05B52] underline underline-offset-4"
        >
          If this feels urgent, tap here
        </button>
      </CheckInCard>
    </PrototypeShell>
  );
}

export function PrototypeSymptomReportPreviewScreen({
  backPath = "/dev/home-master/health",
}: {
  backPath?: string;
  healthPath?: string;
} = {}) {
  return <PrototypeHealthActionPreviewScreen kind="symptom" backPath={backPath} />;
}
