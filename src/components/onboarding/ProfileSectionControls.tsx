import type { FocusEventHandler } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ControlTone = "purple" | "amber" | "green";

const toneClasses: Record<
  ControlTone,
  { action: string; icon: string; selected: string; idle: string }
> = {
  purple: {
    action: "border-[#DCC8FF] bg-[#F8F3FF] text-[#6720BC]",
    icon: "bg-[#7D2BE8] text-white",
    selected: "border-[#7D2BE8] bg-[#F3E8FF] text-[#6720BC]",
    idle: "border-[#E5D6F7] bg-white text-[#4B3B58]",
  },
  amber: {
    action: "border-[#F6D46B] bg-[#FFF9E8] text-[#9A4A08]",
    icon: "bg-[#F59E0B] text-white",
    selected: "border-[#F59E0B] bg-[#FFF7D6] text-[#8A4108]",
    idle: "border-[#F2DC9C] bg-white text-[#4B3B58]",
  },
  green: {
    action: "border-[#A9E4CE] bg-[#F0FDF8] text-[#087A58]",
    icon: "bg-[#0F9F76] text-white",
    selected: "border-[#0F9F76] bg-[#EAFBF5] text-[#087A58]",
    idle: "border-[#BFE9DB] bg-white text-[#4B3B58]",
  },
};

type ProfileVoiceActionProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  testId: string;
  tone?: ControlTone;
  className?: string;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
};

export function ProfileVoiceAction({
  icon: Icon,
  title,
  description,
  onClick,
  testId,
  tone = "purple",
  className,
  disabled = false,
  busy = false,
  busyLabel,
  onFocus,
}: ProfileVoiceActionProps) {
  const colors = toneClasses[tone];

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onFocus={onFocus}
      disabled={disabled || busy}
      className={cn(
        "group flex min-h-[72px] w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left shadow-[0_10px_24px_rgba(53,28,87,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(53,28,87,0.1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/15 disabled:pointer-events-none disabled:opacity-60",
        colors.action,
        className,
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] shadow-sm",
          colors.icon,
        )}
      >
        {busy ? (
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        ) : (
          <Icon size={20} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-[17px] leading-tight">
          {busy && busyLabel ? busyLabel : title}
        </strong>
        <span className="sr-only">
          {description}
        </span>
      </span>
      <ChevronRight
        size={20}
        className="shrink-0 opacity-55 transition group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

type ProfileNoneOptionProps = {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  testId: string;
  tone?: ControlTone;
  className?: string;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
};

export function ProfileNoneOption({
  title,
  description,
  selected,
  onClick,
  testId,
  tone = "purple",
  className,
  onFocus,
}: ProfileNoneOptionProps) {
  const colors = toneClasses[tone];

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      onClick={onClick}
      onFocus={onFocus}
      className={cn(
        "flex min-h-[62px] w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/15",
        selected ? colors.selected : colors.idle,
        className,
      )}
    >
      <CheckCircle2
        size={21}
        className={cn("shrink-0", selected ? "fill-current/10" : "opacity-65")}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <strong className="block text-[16px] leading-tight">{title}</strong>
        {description ? (
          <span className="sr-only">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

type ProfileCompletionBarProps = {
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  savingLabel: string;
  helper: string;
  disabled?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
  testId?: string;
};

export function ProfileCompletionBar({
  saving,
  onSave,
  saveLabel,
  savingLabel,
  helper,
  disabled = false,
  skipLabel,
  onSkip,
  testId = "button-save-profile-section",
}: ProfileCompletionBarProps) {
  return (
    <div className="sticky bottom-3 z-20 mt-5 rounded-[20px] border border-[#E8D9F7] bg-white/95 p-3 shadow-[0_16px_40px_rgba(42,20,66,0.14)] backdrop-blur-md sm:flex sm:items-center sm:gap-4">
      <p className="mb-2 flex-1 text-[13px] font-semibold leading-snug text-vyva-text-2 sm:mb-0 sm:text-[14px]">
        {helper}
      </p>
      <div className="flex items-center gap-2">
        {skipLabel && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="min-h-11 px-3 text-[14px] font-extrabold text-vyva-purple hover:underline disabled:opacity-50"
          >
            {skipLabel}
          </button>
        ) : null}
        <button
          type="button"
          data-testid={testId}
          onClick={onSave}
          disabled={disabled || saving}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[16px] bg-vyva-purple px-5 text-[15px] font-black text-white shadow-[0_10px_24px_rgba(105,31,190,0.2)] transition hover:bg-[#5D1AA8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/20 disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-[190px]"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}
