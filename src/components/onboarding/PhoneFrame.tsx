import { ArrowLeft, LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showAllSections?: boolean;
  onAllSections?: () => void;
}

export function PhoneFrame({
  children,
  className = "",
  subtitle,
  showBack = false,
  onBack,
  showAllSections = false,
  onAllSections,
}: PhoneFrameProps) {
  const hasTopBar = Boolean(subtitle || showBack || showAllSections);

  return (
    <div
      data-testid="phone-frame"
      className={`relative mx-auto w-full max-w-[380px] overflow-hidden rounded-[38px] border border-[#EDE2D1] bg-[#FFFCF8] shadow-[0_24px_60px_rgba(91,33,182,0.12)] ${className}`}
      style={{ minHeight: 560 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[110px] bg-[linear-gradient(180deg,rgba(107,33,168,0.08)_0%,rgba(107,33,168,0)_100%)]" />
      <div className="relative px-4 pt-3 pb-4">
        <div className="mx-auto h-1.5 w-16 rounded-full bg-[#DACDBD]" />

        {hasTopBar ? (
          <div className="mt-4 flex items-center gap-2">
            {showBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#E7DCF8] bg-white text-vyva-purple shadow-sm"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="h-[38px] w-[38px] flex-shrink-0" aria-hidden="true" />
            )}

            <div className="min-w-0 flex-1 text-center">
              {subtitle ? (
                <p className="truncate font-body text-[15px] font-semibold text-vyva-text-1">{subtitle}</p>
              ) : null}
            </div>

            {showAllSections ? (
              <button
                type="button"
                onClick={onAllSections}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[#E7DCF8] bg-white px-3 text-[12px] font-semibold text-vyva-purple shadow-sm"
              >
                <LayoutGrid size={14} />
                All
              </button>
            ) : (
              <div className="h-[38px] w-[38px] flex-shrink-0" aria-hidden="true" />
            )}
          </div>
        ) : null}

        <div className={hasTopBar ? "mt-4" : "mt-3"}>{children}</div>
      </div>
    </div>
  );
}
