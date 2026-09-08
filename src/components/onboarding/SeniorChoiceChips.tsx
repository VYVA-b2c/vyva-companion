import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SeniorChoiceOption = {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
};

type SeniorChoiceChipsProps = {
  options: SeniorChoiceOption[];
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  testIdPrefix?: string;
};

function optionTestId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function SeniorChoiceChips({
  options,
  value,
  onChange,
  className,
  testIdPrefix = "senior-choice",
}: SeniorChoiceChipsProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 min-[520px]:grid-cols-2", className)}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            data-testid={`${testIdPrefix}-${optionTestId(option.value)}`}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-[58px] items-center gap-3 rounded-[20px] border px-4 py-3 text-left shadow-[0_10px_22px_rgba(53,28,87,0.05)] transition",
              active
                ? "border-vyva-purple bg-vyva-purple text-white shadow-[0_14px_26px_rgba(107,33,168,0.22)]"
                : "border-[#E9DDF8] bg-white text-vyva-text-1 hover:border-vyva-purple hover:text-vyva-purple",
            )}
          >
            {option.icon ? (
              <span
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  active ? "bg-white/18 text-white" : "bg-[#F3E8FF] text-vyva-purple",
                )}
              >
                {option.icon}
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block text-[16px] font-black leading-tight">{option.label}</span>
              {option.description ? (
                <span className="sr-only">
                  {option.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
