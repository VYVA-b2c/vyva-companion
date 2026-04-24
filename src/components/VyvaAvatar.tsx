type VyvaAvatarSize = "hero" | "card" | "badge";

interface VyvaAvatarProps {
  size?: VyvaAvatarSize;
  animated?: boolean;
  timeOfDay?: "morning" | "afternoon" | "evening";
  className?: string;
}

const AVATAR_SRC = "/assets/vyva/avatar-calm.png";

const sizeMap: Record<VyvaAvatarSize, string> = {
  hero: "w-full h-auto",
  card: "w-[80px] h-[80px]",
  badge: "w-[40px] h-[40px] rounded-full",
};

const timeOfDayFilter: Record<string, string> = {
  morning: "brightness(1.06) saturate(1.08)",
  afternoon: "brightness(1.0) saturate(1.0)",
  evening: "brightness(0.92) saturate(0.9) sepia(0.08)",
};

const VyvaAvatar: React.FC<VyvaAvatarProps> = ({
  size = "hero",
  animated = true,
  timeOfDay,
  className = "",
}) => {
  const filter = timeOfDay ? timeOfDayFilter[timeOfDay] : undefined;

  return (
    <img
      src={AVATAR_SRC}
      alt="VYVA"
      className={`${sizeMap[size]} object-contain object-bottom pointer-events-none select-none ${animated ? "vyva-avatar" : ""} ${className}`}
      style={filter ? { filter } : undefined}
      draggable={false}
    />
  );
};

export default VyvaAvatar;
