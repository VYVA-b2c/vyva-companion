import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  badge?: ReactNode;
  trailing?: ReactNode;
  align?: "left" | "center";
  size?: "compact" | "standard" | "large";
  selected?: boolean;
  locked?: boolean;
  surface?: "white" | "warm";
  contentClassName?: string;
};

const sizeClasses: Record<NonNullable<ActionCardProps["size"]>, string> = {
  compact: "min-h-[116px] px-4 py-4",
  standard: "min-h-[160px] px-4 py-4",
  large: "min-h-[188px] px-4 py-5",
};

export function ActionCard({
  title,
  description,
  icon: Icon,
  iconNode,
  iconBg = "#F5F3FF",
  iconColor = "#7C3AED",
  badge,
  trailing,
  align = "left",
  size = "standard",
  selected,
  locked,
  surface = "warm",
  className,
  contentClassName,
  disabled,
  type = "button",
  style,
  ...props
}: ActionCardProps) {
  const iconStyle: CSSProperties = { background: iconBg, color: iconColor };

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "vyva-tap group relative min-w-0 overflow-visible rounded-[28px] border text-left transition-transform active:scale-[0.99]",
        surface === "warm" ? "border-[#EDE2D1] bg-[#FFFCF8]" : "border-vyva-border bg-white",
        selected && "ring-2 ring-vyva-purple/25",
        (locked || disabled) && "opacity-80",
        sizeClasses[size],
        align === "center" && "text-center",
        className,
      )}
      style={{
        boxShadow: "0 14px 30px rgba(60,38,20,0.08)",
        ...style,
      }}
      {...props}
    >
      <div
        className={cn(
          "relative z-10 flex h-full min-w-0 flex-col gap-4",
          align === "center" ? "items-center justify-center" : "justify-between",
          contentClassName,
        )}
      >
        <div className={cn("flex w-full items-start gap-3", align === "center" ? "justify-center" : "justify-between")}>
          {Icon || iconNode ? (
            <div
              className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px]"
              style={iconStyle}
            >
              {iconNode ?? (Icon ? <Icon size={30} strokeWidth={2.5} aria-hidden="true" /> : null)}
            </div>
          ) : null}
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>

        <div className="min-w-0">
          <span className="block font-body text-[21px] font-extrabold leading-tight text-vyva-text-1 [hyphens:none] [overflow-wrap:normal] [word-break:normal]">
            {title}
          </span>
          {description ? (
            <span className="sr-only">
              {description}
            </span>
          ) : null}
        </div>

        {trailing ? <div className={cn("flex w-full", align === "center" ? "justify-center" : "justify-end")}>{trailing}</div> : null}
      </div>
    </button>
  );
}
