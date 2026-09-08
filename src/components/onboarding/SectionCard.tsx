import { LucideIcon, CheckCircle2, Circle, ArrowRight } from "lucide-react";

interface SectionCardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  completed: boolean;
  locked?: boolean;
  benefit?: string;
  onClick?: () => void;
}

export function SectionCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  completed,
  locked = false,
  benefit,
  onClick,
}: SectionCardProps) {
  return (
    <button
      data-testid={`section-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={!locked ? onClick : undefined}
      disabled={locked}
      className={`group relative flex min-h-[126px] w-full items-start gap-4 px-5 py-5 text-left transition-all md:rounded-[24px] md:border md:border-[#EFE4D5] md:bg-white md:shadow-[0_14px_34px_rgba(53,28,87,0.06)] ${
        locked
          ? "opacity-40 cursor-not-allowed"
          : "hover:-translate-y-0.5 hover:border-vyva-purple/25 hover:bg-[#FCF8FF] cursor-pointer"
      } border-t border-vyva-border first:border-t-0 md:first:border-t`}
    >
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] shadow-[0_10px_24px_rgba(53,28,87,0.08)]"
        style={{ background: iconBg }}
      >
        <Icon size={24} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1 pr-8">
        <p className="font-body text-[18px] font-black leading-tight text-vyva-text-1">{title}</p>
        <p className="sr-only">{description}</p>
        {benefit && (
          <span
            data-testid={`benefit-chip-${title.toLowerCase().replace(/\s+/g, "-")}`}
            className="mt-3 inline-flex rounded-full px-3 py-1 font-body text-[12px] font-black"
            style={{ background: iconBg, color: iconColor }}
          >
            {benefit}
          </span>
        )}
      </div>
      <div className="absolute right-5 top-5">
        {completed ? (
          <CheckCircle2
            size={22}
            className="text-vyva-green"
            data-testid={`section-complete-${title.toLowerCase().replace(/\s+/g, "-")}`}
          />
        ) : (
          <Circle size={22} className="text-vyva-warm2" />
        )}
      </div>
      {!completed && !locked ? (
        <ArrowRight size={18} className="absolute bottom-5 right-5 text-vyva-purple opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </button>
  );
}
