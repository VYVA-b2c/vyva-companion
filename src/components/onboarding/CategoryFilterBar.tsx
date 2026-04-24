interface CategoryFilterBarProps {
  categories: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function CategoryFilterBar({
  categories,
  active,
  onChange,
  className = "",
}: CategoryFilterBarProps) {
  return (
    <div
      data-testid="category-filter-bar"
      className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide ${className}`}
    >
      {categories.map((cat) => (
        <button
          key={cat.id}
          data-testid={`filter-${cat.id}`}
          onClick={() => onChange(cat.id)}
          className={`flex-shrink-0 rounded-full px-4 py-1.5 font-body text-[13px] font-medium transition-colors border ${
            active === cat.id
              ? "bg-vyva-purple text-white border-vyva-purple"
              : "bg-white text-vyva-text-2 border-vyva-border"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
