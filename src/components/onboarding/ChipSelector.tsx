interface ChipSelectorProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multi?: boolean;
  className?: string;
}

export function ChipSelector({
  options,
  selected,
  onChange,
  multi = true,
  className = "",
}: ChipSelectorProps) {
  const toggle = (opt: string) => {
    if (multi) {
      onChange(
        selected.includes(opt)
          ? selected.filter((s) => s !== opt)
          : [...selected, opt]
      );
    } else {
      onChange(selected.includes(opt) ? [] : [opt]);
    }
  };

  return (
    <div
      data-testid="chip-selector"
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            data-testid={`chip-${opt.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => toggle(opt)}
            className={`rounded-full px-4 py-2 font-body text-[14px] font-medium transition-colors border ${
              active
                ? "bg-vyva-purple text-white border-vyva-purple"
                : "bg-white text-vyva-text-1 border-vyva-border hover:border-vyva-purple hover:text-vyva-purple"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
