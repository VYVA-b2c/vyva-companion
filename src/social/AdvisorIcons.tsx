import { Apple, BadgePercent, FileText, PersonStanding, SearchCheck, ShieldCheck, Smartphone, Sprout, type LucideIcon } from "lucide-react";
import type { AdvisorIconKey } from "../../shared/advisors";

const advisorIconMap: Record<AdvisorIconKey, LucideIcon> = {
  nutrition: Apple,
  garden: Sprout,
  deals: BadgePercent,
  research: SearchCheck,
  paperwork: FileText,
  benefits: ShieldCheck,
  tech: Smartphone,
  coach: PersonStanding,
};

type AdvisorIconProps = {
  iconKey: AdvisorIconKey;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function AdvisorIcon({ iconKey, size = 24, strokeWidth = 2.45, className }: AdvisorIconProps) {
  const Icon = advisorIconMap[iconKey] ?? SearchCheck;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

type AdvisorAvatarProps = AdvisorIconProps & {
  chipBg: string;
  iconColor: string;
  className?: string;
  iconClassName?: string;
};

export function AdvisorAvatar({
  iconKey,
  chipBg,
  iconColor,
  className = "",
  iconClassName = "",
  size = 34,
  strokeWidth = 2.45,
}: AdvisorAvatarProps) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-[28px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)] ${className}`}
      style={{
        background: `radial-gradient(circle at 35% 28%, #FFFFFF 0%, ${chipBg} 44%, ${chipBg} 100%)`,
        color: iconColor,
      }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-2 rounded-[22px] opacity-70"
        style={{ border: `1px solid ${iconColor}24` }}
      />
      <AdvisorIcon
        iconKey={iconKey}
        size={size}
        strokeWidth={strokeWidth}
        className={`relative drop-shadow-[0_4px_8px_rgba(63,45,35,0.10)] ${iconClassName}`}
      />
    </span>
  );
}
