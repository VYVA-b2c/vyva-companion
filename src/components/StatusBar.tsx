import { CircleUser } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import vyvaLogo from "@/assets/vyva-logo.png";

const StatusBar = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const now = new Date();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="fixed left-1/2 top-0 z-50 w-full max-w-[520px] -translate-x-1/2 border-b border-vyva-border bg-white/95 px-[22px] py-2.5 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={vyvaLogo} alt="VYVA" className="h-[34px] w-[34px] rounded-full object-cover shadow-md" />
          <div>
            <div className="font-display text-[22px] leading-tight text-vyva-text-1">{time}</div>
            <div className="font-body text-[13px] text-vyva-text-2">{date}</div>
          </div>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="vyva-tap flex items-center gap-2 rounded-full px-3 py-2 hover:bg-vyva-warm"
          data-testid="button-my-profile"
        >
          <CircleUser size={20} className="text-vyva-text-2" />
          <span className="font-body text-[14px] font-semibold text-vyva-text-1">{t("nav.myProfile")}</span>
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
