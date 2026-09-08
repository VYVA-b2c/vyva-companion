import type { HTMLAttributes, ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type HealthWizardShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  contentAttributes?: Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">;
  testId?: string;
};

export function HealthWizardShell({ children, className, contentClassName, contentAttributes, testId }: HealthWizardShellProps) {
  return (
    <div
      className={cn(
        "min-h-full bg-[linear-gradient(180deg,var(--vyva-sky-a)_0%,var(--vyva-sky-b)_100%)]",
        className,
      )}
    >
      <div {...contentAttributes} data-testid={testId} className={cn("mx-auto w-full max-w-[560px] px-[18px] pb-36 pt-1 md:max-w-[1040px] md:px-10", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

type HealthWizardTopBarProps = {
  title: ReactNode;
  kicker?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
};

export function HealthWizardTopBar({
  title,
  kicker,
  onBack,
  backLabel = "Back",
  action,
  className,
  compact = false,
}: HealthWizardTopBarProps) {
  return (
    <div className={cn(compact ? "mb-2 mt-0 flex items-center gap-2" : "mb-4 mt-1 flex items-center gap-3", className)}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className={cn(
            "vyva-tap flex flex-shrink-0 items-center justify-center rounded-full bg-white text-vyva-text-1 shadow-[0_8px_22px_rgba(63,45,35,0.08)]",
            compact ? "h-10 w-10" : "h-12 w-12",
          )}
        >
          <ArrowLeft size={compact ? 18 : 20} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        {kicker ? (
          <p className={cn("font-body font-black uppercase tracking-[0.14em] text-vyva-purple/75", compact ? "text-[10px]" : "text-[12px]")}>
            {kicker}
          </p>
        ) : null}
        <h1 className={cn("font-display leading-tight text-vyva-text-1", compact ? "text-[23px]" : "text-[27px]")}>
          {title}
        </h1>
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  );
}

type HealthWizardHeroProps = {
  icon?: ReactNode;
  kicker?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  tone?: "purple" | "light" | "green" | "amber" | "red";
  className?: string;
};

const heroTone = {
  purple: "border-transparent bg-[linear-gradient(135deg,var(--vyva-hero-a)_0%,var(--vyva-hero-b)_100%)] text-white shadow-[0_18px_42px_rgba(91,18,160,0.24)]",
  light: "border-[#EDE5DB] bg-white text-vyva-text-1 shadow-[0_14px_34px_rgba(63,45,35,0.08)]",
  green: "border-[#BBF7D0] bg-[#ECFDF5] text-[#064E3B] shadow-[0_14px_34px_rgba(4,120,87,0.10)]",
  amber: "border-[#FED7AA] bg-[#FFF7ED] text-[#7C2D12] shadow-[0_14px_34px_rgba(180,83,9,0.10)]",
  red: "border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D] shadow-[0_14px_34px_rgba(185,28,28,0.12)]",
};

export function HealthWizardHero({
  icon,
  kicker,
  title,
  body,
  children,
  tone = "purple",
  className,
}: HealthWizardHeroProps) {
  const isPurple = tone === "purple";

  return (
    <section className={cn("overflow-hidden rounded-[30px] border p-5", heroTone[tone], className)}>
      <div className="flex items-start gap-4">
        {icon ? (
          <span
            className={cn(
              "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] shadow-sm",
              isPurple ? "bg-white/16 text-white" : "bg-vyva-purple-light text-vyva-purple",
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {kicker ? (
            <p
              className={cn(
                "font-body text-[12px] font-black uppercase tracking-[0.14em]",
                isPurple ? "text-[#FFD84D]" : "text-vyva-purple",
              )}
            >
              {kicker}
            </p>
          ) : null}
          <h2 className={cn("mt-1 font-display text-[35px] font-semibold leading-[1.05] md:text-[42px]", isPurple ? "text-white" : "text-vyva-text-1")}>
            {title}
          </h2>
          {body ? (
            <p className={cn("mt-3 font-body text-[19px] font-bold leading-relaxed", isPurple ? "text-white/90" : "text-vyva-text-2")}>
              {body}
            </p>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

type HealthWizardCardProps = {
  children: ReactNode;
  className?: string;
  tone?: "white" | "soft" | "purple" | "green" | "amber" | "red" | "blue";
  testId?: string;
};

const cardTone = {
  white: "border-[#E8DED4] bg-white text-vyva-text-1 shadow-[0_12px_30px_rgba(63,45,35,0.07)]",
  soft: "border-[#E8DED4] bg-[#FFFCF8] text-vyva-text-1 shadow-[0_10px_24px_rgba(63,45,35,0.06)]",
  purple: "border-[#DDD6FE] bg-[#F5F3FF] text-vyva-purple shadow-[0_10px_24px_rgba(107,33,168,0.08)]",
  green: "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857] shadow-[0_10px_24px_rgba(4,120,87,0.08)]",
  amber: "border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412] shadow-[0_10px_24px_rgba(180,83,9,0.08)]",
  red: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] shadow-[0_10px_24px_rgba(185,28,28,0.10)]",
  blue: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8] shadow-[0_10px_24px_rgba(29,78,216,0.08)]",
};

export function HealthWizardCard({ children, className, tone = "white", testId }: HealthWizardCardProps) {
  return (
    <section data-testid={testId} className={cn("rounded-[28px] border p-5", cardTone[tone], className)}>
      {children}
    </section>
  );
}

type HealthWizardChoiceTileProps = {
  children?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  testId?: string;
};

export function HealthWizardChoiceTile({
  children,
  title,
  description,
  icon,
  selected,
  disabled,
  onClick,
  className,
  testId,
}: HealthWizardChoiceTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "vyva-tap flex min-h-[84px] w-full items-center gap-4 rounded-[24px] border px-4 py-3 text-left transition-all",
        selected
          ? "border-vyva-purple bg-vyva-purple text-white shadow-[0_14px_30px_rgba(107,33,168,0.22)]"
          : "border-[#E8DED4] bg-white text-vyva-text-1 shadow-[0_8px_20px_rgba(63,45,35,0.05)]",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[18px]",
            selected ? "bg-white/16 text-white" : "bg-vyva-purple-light text-vyva-purple",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[20px] font-black leading-tight">{title}</span>
        {description ? (
          <span className="sr-only">
            {description}
          </span>
        ) : null}
        {children}
      </span>
      <span
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
          selected ? "bg-[#F59E0B]" : "border-2 border-[#E8DED4] bg-white",
        )}
      >
        {selected ? <Check size={18} className="text-white" /> : null}
      </span>
    </button>
  );
}

type HealthWizardProgressProps = {
  current: number;
  total: number;
  label?: ReactNode;
  className?: string;
};

export function HealthWizardProgress({ current, total, label, className }: HealthWizardProgressProps) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;

  return (
    <div className={cn("rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-[0_10px_28px_rgba(63,45,35,0.06)]", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-purple">
          {label}
        </p>
        <span className="rounded-full bg-vyva-purple-light px-3 py-1 font-body text-[13px] font-black text-vyva-purple">
          {current}/{total}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#EDE4DA]">
        <div className="h-full rounded-full bg-vyva-purple transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function HealthWizardSectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 mt-6 flex items-center justify-between gap-3", className)}>
      <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-text-2">
        {children}
      </p>
      {action}
    </div>
  );
}

export function HealthWizardActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 z-20 -mx-[18px] mt-5 bg-[linear-gradient(180deg,rgba(250,248,245,0)_0%,#FAF8F5_30%)] px-[18px] pb-4 pt-7", className)}>
      <div className="rounded-[28px] border border-[#E8DED4]/80 bg-white/96 p-2 shadow-[0_18px_44px_rgba(63,45,35,0.14)] backdrop-blur">
        {children}
      </div>
    </div>
  );
}
