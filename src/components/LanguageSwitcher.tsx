import { LANGUAGES } from "@/i18n/languages";
import { useLanguage } from "@/i18n";

type LanguageSwitcherProps = {
  compact?: boolean;
};

const baseSelectClass =
  "w-full rounded-[16px] border border-vyva-border bg-white px-4 py-3 font-body text-[15px] font-medium text-vyva-text-1 shadow-vyva-card outline-none focus:border-vyva-purple";

const LanguageSwitcher = ({ compact = false }: LanguageSwitcherProps) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={compact ? "w-full" : "w-full rounded-[20px] border border-vyva-border bg-white p-4 shadow-vyva-card"}>
      {!compact && (
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">
          {t("common.language")}
        </p>
      )}
      <select
        aria-label={t("common.language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className={baseSelectClass}
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
