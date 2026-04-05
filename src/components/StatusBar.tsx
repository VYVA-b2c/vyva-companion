import { Battery, Cloud } from "lucide-react";
import vyvaLogo from "@/assets/vyva-logo.png";

const StatusBar = () => {
  const now = new Date();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-b border-vyva-border z-50 px-[22px] py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={vyvaLogo} alt="VYVA" className="h-[28px] w-[28px] rounded-full object-cover shadow-md" />
          <div>
            <div className="font-display text-[22px] leading-tight text-vyva-text-1">{time}</div>
            <div className="font-body text-xs text-vyva-text-2">{date}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-vyva-text-2">
            <Cloud size={14} />
            <span className="font-body text-[13px]">14° Cloudy</span>
          </div>
          <div className="flex items-center gap-1 text-vyva-text-2">
            <Battery size={14} />
            <span className="font-body text-[13px]">82%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
