import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface ToggleRowProps {
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  label: string;
  sub?: string;
  value?: boolean;
  onToggle?: () => void;
  rightContent?: ReactNode;
  testId?: string;
}

export function ToggleRow({
  icon: Icon,
  iconBg = "#F5F3FF",
  iconColor = "#6B21A8",
  label,
  sub,
  value,
  onToggle,
  rightContent,
  testId,
}: ToggleRowProps) {
  const slugLabel = label.toLowerCase().replace(/\s+/g, "-");
  const rowTestId = testId ? `${testId}-row` : `row-toggle-${slugLabel}`;
  const btnTestId = testId ?? `toggle-${slugLabel}`;

  return (
    <div
      data-testid={rowTestId}
      className="flex items-center gap-3 px-4 py-[13px] border-t border-vyva-border"
    >
      {Icon && (
        <div
          className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          <Icon size={18} style={{ color: iconColor }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-body text-[15px] font-medium text-vyva-text-1">{label}</p>
        {sub && <p className="font-body text-[12px] text-vyva-text-2">{sub}</p>}
      </div>
      {rightContent ||
        (onToggle ? (
          <button
            data-testid={btnTestId}
            onClick={onToggle}
            aria-pressed={value}
            className={`w-12 h-7 rounded-full relative transition-colors flex-shrink-0 ${
              value ? "bg-vyva-purple" : ""
            }`}
            style={!value ? { background: "#DDD5C8" } : {}}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                value ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        ) : null)}
    </div>
  );
}
