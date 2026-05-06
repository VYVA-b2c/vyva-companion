import { Globe2 } from "lucide-react";
import type { ReactNode } from "react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useLanguage } from "@/i18n";

type OnboardingChromeProps = {
  children: ReactNode;
  mainClassName?: string;
};

export function OnboardingChrome({ children, mainClassName = "" }: OnboardingChromeProps) {
  const { language, setLanguage, languages } = useLanguage();

  return (
    <div className="min-h-screen overflow-hidden bg-[#FFF9F1] text-vyva-text-1">
      <div className="pointer-events-none fixed -left-24 top-10 h-72 w-72 rounded-full bg-[#F7C948]/25 blur-3xl" />
      <div className="pointer-events-none fixed -right-28 top-20 h-[24rem] w-[24rem] rounded-full bg-[#6B21A8]/14 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-12rem] left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-white blur-2xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-[1040px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <VyvaWordmark className="h-auto w-[126px] sm:w-[154px]" />
        <label className="flex items-center gap-2 rounded-full border border-[#E8DDF3] bg-white/86 px-3 py-2 shadow-[0_12px_32px_rgba(77,45,20,0.08)] backdrop-blur">
          <Globe2 size={15} className="text-vyva-purple" />
          <span className="sr-only">Language</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label="Language"
            className="bg-transparent font-body text-[13px] font-extrabold text-vyva-purple outline-none"
            data-testid="select-onboarding-language"
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className={`relative z-10 mx-auto w-full px-5 pb-8 sm:px-8 ${mainClassName}`}>
        {children}
      </main>
    </div>
  );
}
