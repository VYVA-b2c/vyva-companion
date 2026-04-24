import { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export function PhoneFrame({ children, className = "" }: PhoneFrameProps) {
  return (
    <div
      data-testid="phone-frame"
      className={`relative mx-auto w-full max-w-[360px] rounded-[36px] border-4 border-vyva-warm2 bg-vyva-cream shadow-xl overflow-hidden ${className}`}
      style={{ minHeight: 560 }}
    >
      {/* Notch */}
      <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-vyva-warm2" />
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}
