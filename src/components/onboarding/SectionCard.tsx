import { LucideIcon, CheckCircle2, Circle } from "lucide-react";

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
      className={`w-full flex items-center gap-3 px-4 py-[15px] text-left transition-colors ${
        locked
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-[#FCF8FF] cursor-pointer"
      } border-t border-vyva-border first:border-t-0`}
    >
      <div
        className="w-11 h-11 rounded-[15px] flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}
      >
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-[15px] font-semibold text-vyva-text-1">{title}</p>
        <p className="font-body text-[12px] leading-[1.45] text-vyva-text-2 truncate">{description}</p>
        {benefit && !completed && (
          <span
            data-testid={`benefit-chip-${title.toLowerCase().replace(/\s+/g, "-")}`}
            className="inline-block mt-1 px-2 py-0.5 rounded-full font-body text-[11px] font-medium"
            style={{ background: iconBg, color: iconColor }}
          >
            {benefit}
          </span>
        )}
      </div>
      {completed ? (
        <CheckCircle2
          size={20}
          className="text-vyva-green flex-shrink-0"
          data-testid={`section-complete-${title.toLowerCase().replace(/\s+/g, "-")}`}
        />
      ) : (
        <Circle size={20} className="text-vyva-warm2 flex-shrink-0" />
      )}
    </button>
  );
}
