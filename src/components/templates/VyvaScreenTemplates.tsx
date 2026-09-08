import type { ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Hand,
  Home,
  Mic,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type TemplateTheme = "light" | "dark";

export type TemplateTone = {
  iconBg: string;
  iconColor: string;
  border: string;
  surface: string;
};

export type TemplateCardItem = {
  id: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  tone: TemplateTone;
};

export type VoiceTemplateState = "idle" | "listening" | "speaking";

export const VYVA_TEMPLATE_TONES = {
  health: { iconBg: "#FFF1F2", iconColor: "#EF4444", border: "#FDA4AF", surface: "#FFFFFF" },
  mind: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE", surface: "#FFFFFF" },
  community: { iconBg: "#F5F3FF", iconColor: "#7C3AED", border: "#DDD6FE", surface: "#FFFFFF" },
  concierge: { iconBg: "#ECFDF5", iconColor: "#059669", border: "#A7F3D0", surface: "#FFFFFF" },
  medicine: { iconBg: "#F5F3FF", iconColor: "#7C3AED", border: "#DDD6FE", surface: "#FFFFFF" },
  caution: { iconBg: "#FEF3C7", iconColor: "#B45309", border: "#FDE68A", surface: "#FFFFFF" },
} as const satisfies Record<string, TemplateTone>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function templateTheme(theme: TemplateTheme) {
  return {
    page: theme === "dark"
      ? "bg-[#10091D] text-[#FFF8FF]"
      : "bg-[linear-gradient(180deg,#FBF4FF_0%,#FFFDF9_56%,#FBF4FF_100%)] text-[#24113D]",
    muted: theme === "dark" ? "text-[#E7DDF4]" : "text-[#725E70]",
    card: theme === "dark"
      ? "border-white/10 bg-white/[0.08] shadow-[0_18px_38px_rgba(0,0,0,0.24)]"
      : "border-[#E8DDF3] bg-white shadow-[0_16px_34px_rgba(57,35,67,0.10)]",
    nav: theme === "dark"
      ? "border-white/12 bg-[#170E27]/92 text-[#D9CCEA]"
      : "border-[#E8DDF3] bg-white/95 text-[#A79BA8]",
  };
}

function VyvaMark() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-vyva-purple font-body text-[21px] font-black text-white shadow-[0_16px_28px_rgba(107,33,168,0.22)]">
      Y
    </div>
  );
}

function ScreenUtilityDock({ theme, expanded = false }: { theme: TemplateTheme; expanded?: boolean }) {
  return (
    <div className="relative flex items-start justify-end">
      <div
        className={cx(
          "flex min-h-[40px] items-center rounded-full border p-1 shadow-[0_12px_28px_rgba(107,33,168,0.16)]",
          theme === "dark" ? "border-white/10 bg-white/10" : "border-[#E8DDF3] bg-white/88",
        )}
        data-testid="template-utility-dock"
      >
        <button
          type="button"
          aria-label="Open display settings"
          className={cx(
            "flex h-8 w-8 items-center justify-center rounded-full",
            expanded ? "bg-[#F5EFFF] text-vyva-purple" : theme === "dark" ? "text-white" : "text-vyva-purple",
          )}
        >
          <Settings size={15} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Switch input mode"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#128A80] text-white shadow-[0_8px_16px_rgba(18,138,128,0.22)]"
        >
          <Hand size={15} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {expanded ? (
        <div
          className={cx(
            "absolute right-0 top-12 z-10 w-[154px] rounded-[18px] border p-2 text-left shadow-[0_20px_36px_rgba(44,25,66,0.20)]",
            theme === "dark" ? "border-white/10 bg-[#1C1230] text-white" : "border-[#E8DDF3] bg-white text-[#24113D]",
          )}
          data-testid="template-settings-expanded"
        >
          {[
            ["Aa", "Text size"],
            ["n", "Theme"],
            ["m", "Mode"],
          ].map(([icon, label]) => (
            <button key={label} type="button" className="flex min-h-[38px] w-full items-center gap-2 rounded-[12px] px-2 font-body text-[12px] font-extrabold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5EFFF] text-[11px] text-vyva-purple">
                {icon}
              </span>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VoiceOrb({ state }: { state: VoiceTemplateState }) {
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";

  return (
    <button
      type="button"
      aria-label={state === "idle" ? "Start voice" : state === "listening" ? "VYVA is listening" : "VYVA is speaking"}
      className={cx(
        "relative mx-auto mt-8 flex h-[132px] w-[132px] items-center justify-center rounded-full border border-[#E8D5FF] bg-[#F9F1FF] shadow-[0_22px_44px_rgba(126,60,204,0.18)]",
        isListening && "animate-pulse",
      )}
      data-testid={`voice-orb-${state}`}
    >
      <span className="absolute inset-[-18px] rounded-full border border-[#E8D5FF]/70" aria-hidden="true" />
      <span className="absolute inset-[-9px] rounded-full border border-[#E8D5FF]/80" aria-hidden="true" />
      <span
        className={cx(
          "relative flex h-[92px] w-[92px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#F7E7FF_0%,#B585F0_30%,#7B28D4_62%,#5D16AD_100%)] shadow-[inset_0_12px_18px_rgba(255,255,255,0.36),0_14px_32px_rgba(107,33,168,0.28)]",
          isSpeaking && "bg-[radial-gradient(circle_at_68%_32%,#87F5E8_0%,#A98AF5_42%,#8B38D9_100%)]",
        )}
      >
        {isSpeaking ? (
          <span className="flex h-12 items-center gap-1.5" aria-hidden="true">
            {[18, 32, 46, 30, 22].map((height, index) => (
              <span
                key={height}
                className="w-1.5 rounded-full bg-white/82 shadow-[0_0_10px_rgba(255,255,255,0.32)]"
                style={{
                  height,
                  animation: `pulse ${0.9 + index * 0.08}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </span>
        ) : (
          <Mic size={32} strokeWidth={2.4} className="text-white" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}

function TemplateBottomNav({ theme }: { theme: TemplateTheme }) {
  const colors = templateTheme(theme);
  return (
    <nav
      aria-label="Primary"
      className={cx(
        "absolute inset-x-5 bottom-5 grid h-[62px] grid-cols-3 items-center rounded-[22px] border px-2 text-center font-body text-[10px] font-black",
        colors.nav,
      )}
      data-testid="template-bottom-nav"
    >
      <span className="flex flex-col items-center gap-1 text-vyva-purple">
        <Home size={18} strokeWidth={2.4} aria-hidden="true" />
        Home
      </span>
      <span className="relative flex flex-col items-center gap-1 text-[#D71920]">
        <span className="absolute -top-9 flex h-12 w-12 items-center justify-center rounded-full bg-[#E61E24] text-[24px] text-white shadow-[0_10px_22px_rgba(230,30,36,0.24)]">
          !
        </span>
        <span className="mt-5">SOS</span>
      </span>
      <span className="flex flex-col items-center gap-1">
        <ClipboardList size={18} strokeWidth={2.4} aria-hidden="true" />
        Reports
      </span>
    </nav>
  );
}

function PhoneShell({
  children,
  theme = "light",
  testId,
}: {
  children: ReactNode;
  theme?: TemplateTheme;
  testId?: string;
}) {
  const colors = templateTheme(theme);
  return (
    <div
      className={cx(
        "relative min-h-[560px] overflow-hidden rounded-[26px] border p-5 pb-[104px]",
        colors.page,
        theme === "dark" ? "border-white/10" : "border-[#E8DDF3]",
      )}
      data-testid={testId}
    >
      {children}
      <TemplateBottomNav theme={theme} />
    </div>
  );
}

export function VoiceLandingTemplate({
  state = "idle",
  theme = "light",
  title,
  subtitle,
  settingsExpanded = false,
}: {
  state?: VoiceTemplateState;
  theme?: TemplateTheme;
  title: string;
  subtitle: string;
  settingsExpanded?: boolean;
}) {
  const colors = templateTheme(theme);

  return (
    <PhoneShell theme={theme} testId={`voice-template-${state}`}>
      <div className="flex items-start justify-between gap-4">
        <VyvaMark />
        <ScreenUtilityDock theme={theme} expanded={settingsExpanded} />
      </div>
      <section className="pt-20 text-center">
        <h2 className="mx-auto max-w-[15rem] font-body text-[34px] font-black leading-[0.98] tracking-normal">
          {title}
        </h2>
        <p className={cx("mx-auto mt-5 max-w-[18rem] font-body text-[15px] font-black leading-snug", colors.muted)}>
          {subtitle}
        </p>
        <VoiceOrb state={state} />
      </section>
    </PhoneShell>
  );
}

export function CardHubTemplate({
  title,
  subtitle,
  cards,
  theme = "light",
}: {
  title: string;
  subtitle: string;
  cards: readonly TemplateCardItem[];
  theme?: TemplateTheme;
}) {
  const colors = templateTheme(theme);

  return (
    <PhoneShell theme={theme} testId="card-hub-template">
      <div className="flex items-start justify-between gap-4">
        <VyvaMark />
        <ScreenUtilityDock theme={theme} />
      </div>
      <section className="pt-16 text-center">
        <h2 className="font-body text-[31px] font-black leading-[1] tracking-normal">{title}</h2>
        <p className={cx("mx-auto mt-4 max-w-[18rem] font-body text-[15px] font-extrabold leading-snug", colors.muted)}>
          {subtitle}
        </p>
      </section>
      <section className="mt-9 grid gap-3" aria-label={`${title} cards`}>
        {cards.slice(0, 4).map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              className={cx("flex min-h-[74px] items-center gap-3 rounded-[20px] border bg-white px-4 text-left shadow-[0_12px_26px_rgba(57,35,67,0.09)]", theme === "dark" && "bg-white/10")}
              style={{ borderColor: card.tone.border }}
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px]" style={{ background: card.tone.iconBg, color: card.tone.iconColor }}>
                <Icon size={22} strokeWidth={2.45} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body text-[18px] font-black leading-tight">{card.title}</span>
                <span className="sr-only">{card.detail}</span>
              </span>
              <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
            </button>
          );
        })}
      </section>
    </PhoneShell>
  );
}

export function GuidedFlowTemplate({ theme = "light" }: { theme?: TemplateTheme }) {
  const colors = templateTheme(theme);
  return (
    <PhoneShell theme={theme} testId="guided-flow-template">
      <div className="flex items-center justify-between">
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#24113D] shadow-[0_10px_22px_rgba(57,35,67,0.10)]">
          <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <span className={cx("rounded-full px-3 py-2 font-body text-[11px] font-black uppercase tracking-[0.1em]", theme === "dark" ? "bg-white/10 text-white" : "bg-[#F5EFFF] text-vyva-purple")}>
          Step 1
        </span>
      </div>
      <section className="mt-12">
        <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">Guided setup</p>
        <h2 className="mt-2 font-body text-[32px] font-black leading-[1]">Choose a service</h2>
      </section>
      <section className="mt-8 grid gap-3">
        {[
          ["Groceries", "Food, water, household"],
          ["Home Care", "Repairs and cleaning"],
          ["Transport", "Taxi or accessible ride"],
        ].map(([label, detail], index) => (
          <button
            key={label}
            type="button"
            className={cx("flex min-h-[72px] items-center justify-between rounded-[20px] border px-4 text-left", index === 0 ? "border-vyva-purple bg-[#F5EFFF]" : "border-[#E8DDF3] bg-white")}
          >
            <span>
              <span className="block font-body text-[18px] font-black">{label}</span>
              <span className="sr-only">{detail}</span>
            </span>
            <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
        ))}
      </section>
    </PhoneShell>
  );
}

export function OutputReviewTemplate({ theme = "light" }: { theme?: TemplateTheme }) {
  return (
    <PhoneShell theme={theme} testId="output-review-template">
      <div className="flex items-start justify-between">
        <VyvaMark />
        <span className="rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#047857]">
          Ready
        </span>
      </div>
      <section className="mt-16">
        <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#047857]">VYVA found</p>
        <h2 className="mt-2 font-body text-[32px] font-black leading-[1]">Three safe options</h2>
      </section>
      <section className="mt-8 rounded-[22px] border border-[#D1FAE5] bg-white p-4 shadow-[0_12px_26px_rgba(5,150,105,0.10)]">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-[#047857]">
            <Check size={22} strokeWidth={2.6} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-body text-[18px] font-black text-[#24113D]">Best match</span>
            <span className="mt-1 block font-body text-[12px] font-bold text-[#725E70]">Licensed, nearby, accepts family approval.</span>
          </span>
        </div>
      </section>
      <button type="button" className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#128A80] font-body text-[15px] font-black text-white shadow-[0_12px_26px_rgba(18,138,128,0.20)]">
        Ask me first
      </button>
    </PhoneShell>
  );
}

export function SetupDashboardTemplate({ theme = "light" }: { theme?: TemplateTheme }) {
  const colors = templateTheme(theme);
  const stats: Array<{ value: string; label: string; icon: LucideIcon }> = [
    { value: "5", label: "Services", icon: Sparkles },
    { value: "8", label: "Providers", icon: FileText },
    { value: "12", label: "Orders", icon: BarChart3 },
  ];

  return (
    <PhoneShell theme={theme} testId="setup-dashboard-template">
      <div className="flex items-start justify-between">
        <VyvaMark />
        <ScreenUtilityDock theme={theme} />
      </div>
      <section className="mt-12">
        <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">Trusted setup</p>
        <h2 className="mt-2 font-body text-[32px] font-black leading-[1]">Everything ready</h2>
      </section>
      <section className="mt-8 grid grid-cols-3 gap-2.5" aria-label="Setup stats">
        {stats.map(({ value, label, icon: Icon }) => (
          <div key={label} className={cx("rounded-[18px] border p-3 text-center", colors.card)}>
            <Icon size={19} strokeWidth={2.4} className="mx-auto text-vyva-purple" aria-hidden="true" />
            <span className="mt-2 block font-body text-[22px] font-black">{value}</span>
            <span className={cx("block font-body text-[10px] font-black uppercase tracking-[0.08em]", colors.muted)}>{label}</span>
          </div>
        ))}
      </section>
      <section className="mt-6 grid gap-3">
        <button type="button" className="flex min-h-[64px] items-center gap-3 rounded-[20px] border border-[#D1FAE5] bg-white px-4 text-left shadow-[0_12px_26px_rgba(18,138,128,0.10)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-[#047857]">
            <CalendarDays size={21} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="font-body text-[17px] font-black text-[#24113D]">Next order</span>
        </button>
        <button type="button" className="flex min-h-[64px] items-center gap-3 rounded-[20px] border border-[#E8DDF3] bg-white px-4 text-left shadow-[0_12px_26px_rgba(57,35,67,0.08)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#F5EFFF] text-vyva-purple">
            <Settings size={21} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="font-body text-[17px] font-black text-[#24113D]">Manage rules</span>
        </button>
      </section>
    </PhoneShell>
  );
}

export function templateCards(): TemplateCardItem[] {
  return [
    { id: "health", title: "My Health", detail: "Health help", icon: Check, tone: VYVA_TEMPLATE_TONES.health },
    { id: "mind", title: "My Mind", detail: "Memory and focus", icon: Sparkles, tone: VYVA_TEMPLATE_TONES.mind },
    { id: "community", title: "Community", detail: "People and events", icon: Hand, tone: VYVA_TEMPLATE_TONES.community },
    { id: "concierge", title: "Concierge", detail: "Tasks and bookings", icon: CalendarDays, tone: VYVA_TEMPLATE_TONES.concierge },
  ];
}
