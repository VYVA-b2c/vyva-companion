// src/pages/settings/SettingsHome.tsx
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface RowProps {
  icon: string;
  title: string;
  sub?: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  "data-testid"?: string;
}

function Row({ icon, title, sub, value, onClick, danger, "data-testid": testId }: RowProps) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className="w-full flex items-center gap-3 px-4 py-3 border-t border-purple-50 first:border-t-0 hover:bg-purple-50/50 transition-colors text-left">
      <span className="text-lg w-6 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${danger ? "text-red-600" : "text-gray-900"}`}>{title}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {value && <span className="text-xs font-semibold text-[#6b21a8] flex-shrink-0">{value}</span>}
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-purple-100 rounded-xl overflow-hidden">
      <div className="bg-purple-50 px-4 py-2 text-[10px] font-bold text-purple-700 uppercase tracking-wider">{title}</div>
      {children}
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
      <div className="flex flex-col gap-4 px-4 py-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">⚙️ {t("settings.home.title")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("settings.home.subtitle")}</p>
        </div>

        <Section title={t("settings.home.sections.account")}>
          <Row icon="👤" title={t("settings.home.rows.myAccount")}      sub={t("settings.home.rows.myAccountSub")}           onClick={() => navigate("/settings/account")} />
          <Row icon="🔔" title={t("settings.home.rows.notifications")}  sub={t("settings.home.rows.notificationsSub")}        onClick={() => navigate("/settings/notifications")} />
          <Row icon="🪪" title={t("settings.home.rows.healthProfile")}  sub={t("settings.home.rows.healthProfileSub")}        onClick={() => navigate("/onboarding/profile")} data-testid="button-settings-health-profile" />
        </Section>

        <Section title={t("settings.home.sections.privacy")}>
          <Row icon="🔒" title={t("settings.home.rows.privacyConsent")} sub={t("settings.home.rows.privacyConsentSub")}       onClick={() => navigate("/settings/privacy")} />
          <Row icon="📥" title={t("settings.home.rows.downloadData")}   sub={t("settings.home.rows.downloadDataSub")} />
        </Section>

        <Section title={t("settings.home.sections.subscription")}>
          <Row icon="💳" title={t("settings.home.rows.planBilling")}    sub={t("settings.home.rows.planBillingSub")}  value={t("settings.home.rows.planBillingValue")} onClick={() => navigate("/settings/subscription")} />
        </Section>

        <Section title={t("settings.home.sections.about")}>
          <Row icon="📄" title={t("settings.home.rows.termsOfService")} />
          <Row icon="🔐" title={t("settings.home.rows.privacyPolicy")} />
          <Row icon="💬" title={t("settings.home.rows.contactSupport")} />
          <Row icon="⭐" title={t("settings.home.rows.sendFeedback")} />
          <Row icon="ℹ️" title={t("settings.home.rows.appVersion")} value="1.0.0" />
        </Section>

        <Section title={t("settings.home.sections.dangerZone")}>
          <Row icon="🚪" title={t("settings.home.rows.signOut")} danger onClick={handleSignOut} data-testid="button-settings-sign-out" />
          <Row icon="🗑️" title={t("settings.home.rows.deleteAccount")} sub={t("settings.home.rows.deleteAccountSub")} danger />
        </Section>
      </div>
    </PhoneFrame>
  );
}
