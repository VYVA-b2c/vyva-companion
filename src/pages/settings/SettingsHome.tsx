import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  HeartPulse,
  Info,
  Lock,
  LogOut,
  MessageCircle,
  Shield,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { useAuth } from "@/contexts/AuthContext";

interface RowProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  sub?: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  "data-testid"?: string;
}

function Row({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  sub,
  value,
  onClick,
  danger,
  "data-testid": testId,
}: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-colors hover:bg-[#FCF8FF]"
    >
      <div
        className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[14px]"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] font-semibold ${danger ? "text-[#B0355A]" : "text-vyva-text-1"}`}>{title}</p>
        {sub ? <p className="mt-0.5 text-[12px] leading-[1.45] text-vyva-text-2">{sub}</p> : null}
      </div>
      {value ? <span className="rounded-full bg-[#F5F0FF] px-2.5 py-1 text-[11px] font-semibold text-vyva-purple">{value}</span> : null}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#C4B5D8]" />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-vyva-border bg-white p-2 shadow-vyva-card">
      <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-vyva-text-2">{title}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export default function SettingsHome() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useTranslation();

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  return (
    <PhoneFrame>
      <div className="flex flex-col gap-4">
        <section className="overflow-hidden rounded-[24px] border border-[#EFE7DB] bg-[#FFF9F1] p-4 shadow-vyva-card">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple shadow-sm">
            <Shield size={14} />
            {t("settings.home.title")}
          </div>
          <h2 className="mt-4 font-display text-[28px] leading-[1.05] text-vyva-text-1">{t("settings.home.title")}</h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-vyva-text-2">{t("settings.home.subtitle")}</p>
        </section>

        <Section title={t("settings.home.sections.account")}>
          <Row
            icon={UserRound}
            iconBg="#F5F0FF"
            iconColor="#6B21A8"
            title={t("settings.home.rows.myAccount")}
            sub={t("settings.home.rows.myAccountSub")}
            onClick={() => navigate("/settings/account")}
          />
          <Row
            icon={Bell}
            iconBg="#EEF4FF"
            iconColor="#2563EB"
            title={t("settings.home.rows.notifications")}
            sub={t("settings.home.rows.notificationsSub")}
            onClick={() => navigate("/settings/notifications")}
          />
          <Row
            icon={HeartPulse}
            iconBg="#FDECEC"
            iconColor="#D14D41"
            title={t("settings.home.rows.healthProfile")}
            sub={t("settings.home.rows.healthProfileSub")}
            onClick={() => navigate("/onboarding/profile")}
            data-testid="button-settings-health-profile"
          />
        </Section>

        <Section title={t("settings.home.sections.privacy")}>
          <Row
            icon={Lock}
            iconBg="#EEF8F2"
            iconColor="#0F766E"
            title={t("settings.home.rows.privacyConsent")}
            sub={t("settings.home.rows.privacyConsentSub")}
            onClick={() => navigate("/settings/privacy")}
          />
          <Row
            icon={Download}
            iconBg="#FFF7E8"
            iconColor="#C9890A"
            title={t("settings.home.rows.downloadData")}
            sub={t("settings.home.rows.downloadDataSub")}
          />
        </Section>

        <Section title={t("settings.home.sections.subscription")}>
          <Row
            icon={CreditCard}
            iconBg="#FFF1EF"
            iconColor="#E05B4B"
            title={t("settings.home.rows.planBilling")}
            sub={t("settings.home.rows.planBillingSub")}
            value={t("settings.home.rows.planBillingValue")}
            onClick={() => navigate("/settings/subscription")}
          />
        </Section>

        <Section title={t("settings.home.sections.about")}>
          <Row icon={FileText} iconBg="#F7F2FF" iconColor="#7C3AED" title={t("settings.home.rows.termsOfService")} />
          <Row icon={Shield} iconBg="#EEF8F2" iconColor="#0F766E" title={t("settings.home.rows.privacyPolicy")} />
          <Row icon={MessageCircle} iconBg="#EEF4FF" iconColor="#2563EB" title={t("settings.home.rows.contactSupport")} />
          <Row icon={Star} iconBg="#FFF7E8" iconColor="#C9890A" title={t("settings.home.rows.sendFeedback")} />
          <Row icon={Info} iconBg="#F5F5F4" iconColor="#57534E" title={t("settings.home.rows.appVersion")} value="1.0.0" />
        </Section>

        <Section title={t("settings.home.sections.dangerZone")}>
          <Row
            icon={LogOut}
            iconBg="#FFF1F2"
            iconColor="#B0355A"
            title={t("settings.home.rows.signOut")}
            danger
            onClick={handleSignOut}
            data-testid="button-settings-sign-out"
          />
          <Row
            icon={Trash2}
            iconBg="#FFF1F2"
            iconColor="#B0355A"
            title={t("settings.home.rows.deleteAccount")}
            sub={t("settings.home.rows.deleteAccountSub")}
            danger
          />
        </Section>
      </div>
    </PhoneFrame>
  );
}
