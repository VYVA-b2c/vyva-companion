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
    <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-b border-vyva-border z-50 px-[22px] py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={vyvaLogo} alt="VYVA" className="h-[28px] w-[28px] rounded-full object-cover shadow-md" />
          <div>
            <div className="font-display text-[20px] leading-tight text-vyva-text-1">{time}</div>
            <div className="font-body text-[12px] text-vyva-text-2">{date}</div>
          </div>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-vyva-warm"
          data-testid="button-my-profile"
        >
          <CircleUser size={18} className="text-vyva-text-2" />
          <span className="font-body text-[13px] font-medium text-vyva-text-1">{t("nav.myProfile")}</span>
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
