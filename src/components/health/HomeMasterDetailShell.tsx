import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";

type HomeMasterDetailShellProps = {
  title: ReactNode;
  children: ReactNode;
  onBack: () => void;
  backLabel?: string;
  action?: ReactNode;
  testId?: string;
};

export function HomeMasterDetailShell({
  title,
  children,
  onBack,
  backLabel = "Back",
  action,
  testId,
}: HomeMasterDetailShellProps) {
  const { isDark } = useHomeMasterTheme();
  const { size: readableTextSize } = useReadableTextSize();

  return (
    <main
      data-testid={testId}
      data-home-master-theme={isDark ? "dark" : "light"}
      data-vyva-text-size={readableTextSize}
      className={[
        "prototype-shell relative min-h-[calc(100svh-136px)] w-full overflow-x-hidden",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F7F0FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
      ].join(" ")}
    >
      <div className="vyva-home-master-fixed-type mx-auto flex min-h-[calc(100svh-136px)] w-full max-w-[430px] flex-col px-6 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-8 sm:max-w-[680px] sm:px-7 lg:max-w-[900px] [@media(max-height:800px)]:pt-4">
        <div
          className={[
            "sticky top-0 z-40 -mx-3 px-3 backdrop-blur-xl",
            isDark ? "bg-[#1A1122]/95" : "bg-[#F8EEFF]/90",
          ].join(" ")}
        >
          <header className="grid grid-cols-[40px_1fr_40px] items-center gap-3">
            <button
              type="button"
              aria-label={backLabel}
              onClick={onBack}
              className={[
                "vyva-tap grid h-10 !min-h-10 w-10 place-items-center rounded-full transition-colors duration-150",
                isDark
                  ? "bg-white/[0.07] text-[#F7F0FF] ring-1 ring-inset ring-white/[0.18]"
                  : "bg-white text-[#6B5173] ring-1 ring-black/[0.05] shadow-[0_14px_32px_rgba(80,52,109,0.12)]",
              ].join(" ")}
            >
              <VyvaIcon icon={ArrowLeft} size={18} strokeWidth={2.45} tone={isDark ? "inverse" : "brand"} />
            </button>
            <h1
              className={[
                "truncate text-center font-display text-[24px] font-semibold leading-tight tracking-[-0.03em]",
                isDark ? "text-[#FFF8FF]" : "text-[#241C30]",
              ].join(" ")}
            >
              {title}
            </h1>
            <div className="flex justify-end">{action}</div>
          </header>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col sm:mt-7 [@media(max-height:800px)]:mt-3">
          {children}
        </div>
      </div>
    </main>
  );
}
