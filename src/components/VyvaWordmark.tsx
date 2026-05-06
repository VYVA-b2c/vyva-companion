import { useLanguage } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";
import logoDe from "@/assets/logos/vyva-logo-de.png";
import logoEn from "@/assets/logos/vyva-logo-en.png";
import logoEs from "@/assets/logos/vyva-logo-es.png";
import logoFr from "@/assets/logos/vyva-logo-fr.png";
import logoIt from "@/assets/logos/vyva-logo-it.png";
import logoPt from "@/assets/logos/vyva-logo-pt.png";

const LOGO_BY_LANGUAGE: Partial<Record<LanguageCode, string>> = {
  de: logoDe,
  en: logoEn,
  es: logoEs,
  fr: logoFr,
  it: logoIt,
  pt: logoPt,
  cy: logoEn,
};

type VyvaWordmarkProps = {
  className?: string;
};

export function VyvaWordmark({ className = "h-auto w-[132px] sm:w-[158px]" }: VyvaWordmarkProps) {
  const { language } = useLanguage();
  const logoSrc = LOGO_BY_LANGUAGE[language] ?? logoEn;

  return (
    <img
      src={logoSrc}
      alt="VYVA"
      className={className}
    />
  );
}
