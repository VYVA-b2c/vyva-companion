import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  User, Phone, Heart, Pill, AlertTriangle, Stethoscope,
  Building2, Users, ShieldAlert, Lock, CreditCard, Star,
  CheckCircle2, UserCheck, Mic, ArrowLeft, Smartphone, Utensils, Brain,
} from "lucide-react";
import { useOnboardingCompanionGuidance } from "@/components/onboarding/useOnboardingCompanionGuidance";
import { SectionCard } from "@/components/onboarding/SectionCard";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { deriveCompletedSections } from "@/lib/profileCompletion";

export const PROFILE_OVERVIEW_SECTIONS = [
  { id: "basics",       icon: User,        iconBg: "#EDE9FE", iconColor: "#6B21A8", titleKey: "profile.overview.sections.basics.title",        titleFallback: "Basic details",        descriptionKey: "profile.overview.sections.basics.description",        descriptionFallback: "Name, contact details, and preferences VYVA should remember.",        benefitKey: "profile.overview.sections.basics.benefit",        benefitFallback: "Personalised help",       path: "/onboarding/profile/basics",       ready: true, countsTowardProfile: true },
  { id: "contact",      icon: Phone,       iconBg: "#F0FDFA", iconColor: "#0F766E", titleKey: "profile.overview.sections.contact.title",       titleFallback: "Home address",         descriptionKey: "profile.overview.sections.contact.description",       descriptionFallback: "Where VYVA should anchor local help and practical support.",        benefitKey: "profile.overview.sections.contact.benefit",       benefitFallback: "Local context",           path: "/onboarding/profile/address",      ready: true, countsTowardProfile: true },
  { id: "health",       icon: Heart,       iconBg: "#FDF2F8", iconColor: "#B0355A", titleKey: "profile.overview.sections.health.title",        titleFallback: "Health profile",       descriptionKey: "profile.overview.sections.health.description",        descriptionFallback: "Known conditions and support context for safer conversations.",      benefitKey: "profile.overview.sections.health.benefit",        benefitFallback: "Safer support",           path: "/onboarding/profile/health",       ready: true, countsTowardProfile: true },
  { id: "medications",  icon: Pill,        iconBg: "#ECFDF5", iconColor: "#0A7C4E", titleKey: "profile.overview.sections.medications.title",   titleFallback: "Medications",          descriptionKey: "profile.overview.sections.medications.description",   descriptionFallback: "Medicines and routines to help VYVA support reminders.",             benefitKey: "profile.overview.sections.medications.benefit",   benefitFallback: "Reminder ready",          path: "/onboarding/profile/medications",  ready: true, countsTowardProfile: true },
  { id: "allergies",    icon: AlertTriangle,iconBg:"#FEF3C7", iconColor: "#C9890A", titleKey: "profile.overview.sections.allergies.title",     titleFallback: "Allergies",            descriptionKey: "profile.overview.sections.allergies.description",     descriptionFallback: "Allergies and sensitivities to keep visible before action.",         benefitKey: "profile.overview.sections.allergies.benefit",     benefitFallback: "Safety check",            path: "/onboarding/profile/allergies",    ready: true, countsTowardProfile: true },
  { id: "gp",           icon: Stethoscope, iconBg: "#EFF6FF", iconColor: "#1D4ED8", titleKey: "profile.overview.sections.gp.title",           titleFallback: "GP details",           descriptionKey: "profile.overview.sections.gp.description",           descriptionFallback: "Your doctor or practice details for health conversations.",          benefitKey: "profile.overview.sections.gp.benefit",           benefitFallback: "Doctor ready",            path: "/onboarding/profile/gp",           ready: true, countsTowardProfile: true },
  { id: "providers",    icon: Building2,   iconBg: "#F5F3FF", iconColor: "#6B21A8", titleKey: "profile.overview.sections.providers.title",     titleFallback: "Providers",            descriptionKey: "profile.overview.sections.providers.description",     descriptionFallback: "Trusted services VYVA can help prepare before you confirm.",         benefitKey: "profile.overview.sections.providers.benefit",     benefitFallback: "Trusted contacts",        path: "/onboarding/profile/providers",    ready: true, countsTowardProfile: true },
  { id: "care-team",    icon: Users,       iconBg: "#F0FDFA", iconColor: "#0F766E", titleKey: "profile.overview.sections.careTeam.title",      titleFallback: "Care team",            descriptionKey: "profile.overview.sections.careTeam.description",      descriptionFallback: "Family, carers, and doctors you may want to keep connected.",        benefitKey: "profile.overview.sections.careTeam.benefit",      benefitFallback: "People support",          path: "/onboarding/profile/care-team",    ready: true, countsTowardProfile: true },
  { id: "devices",      icon: Smartphone,  iconBg: "#E0F2FE", iconColor: "#0369A1", titleKey: "profile.overview.sections.devices.title",       titleFallback: "Devices & sensors",    descriptionKey: "profile.overview.sections.devices.description",       descriptionFallback: "Health devices and sensors VYVA can understand.",                    benefitKey: "profile.overview.sections.devices.benefit",       benefitFallback: "Signals ready",           path: "/onboarding/profile/devices",      ready: true, countsTowardProfile: true },
  { id: "diet",         icon: Utensils,    iconBg: "#F0FDF4", iconColor: "#15803D", titleKey: "profile.overview.sections.diet.title",          titleFallback: "Dietary preferences",  descriptionKey: "profile.overview.sections.diet.description",          descriptionFallback: "Food preferences and notes for calmer daily support.",               benefitKey: "profile.overview.sections.diet.benefit",          benefitFallback: "Meal-aware help",         path: "/onboarding/profile/diet",         ready: true, countsTowardProfile: true },
  { id: "hobbies",      icon: Star,        iconBg: "#FFF7ED", iconColor: "#C2410C", titleKey: "profile.overview.sections.hobbies.title",       titleFallback: "Hobbies",              descriptionKey: "profile.overview.sections.hobbies.description",       descriptionFallback: "Interests VYVA can use for warmer companionship.",                   benefitKey: "profile.overview.sections.hobbies.benefit",       benefitFallback: "Warmer chats",           path: "/onboarding/profile/hobbies",      ready: true, countsTowardProfile: true },
  { id: "cognitive",    icon: Brain,       iconBg: "#F5F3FF", iconColor: "#7C3AED", titleKey: "profile.overview.sections.cognitive.title",     titleFallback: "Cognitive preferences",descriptionKey: "profile.overview.sections.cognitive.description",     descriptionFallback: "Pace, language, and memory-support preferences.",                    benefitKey: "profile.overview.sections.cognitive.benefit",     benefitFallback: "Right pace",             path: "/onboarding/profile/cognitive",    ready: true, countsTowardProfile: true },
  { id: "emergency",    icon: ShieldAlert, iconBg: "#FEF2F2", iconColor: "#B91C1C", titleKey: "profile.overview.sections.emergency.title",     titleFallback: "Emergency contact",    descriptionKey: "profile.overview.sections.emergency.description",     descriptionFallback: "Who VYVA should keep visible for urgent support.",                   benefitKey: "profile.overview.sections.emergency.benefit",     benefitFallback: "Urgent ready",           path: "/onboarding/profile/emergency",    ready: true, countsTowardProfile: true },
  { id: "privacy",      icon: Lock,        iconBg: "#F5F3FF", iconColor: "#6B21A8", titleKey: "profile.overview.sections.privacy.title",       titleFallback: "Privacy",              descriptionKey: "profile.overview.sections.privacy.description",       descriptionFallback: "Review permissions and data controls.",                              benefitKey: "profile.overview.sections.privacy.benefit",       benefitFallback: "Control sharing",        path: "/settings/privacy",                ready: true, countsTowardProfile: false },
  { id: "subscription", icon: CreditCard,  iconBg: "#FEF3C7", iconColor: "#C9890A", titleKey: "profile.overview.sections.subscription.title",  titleFallback: "Subscription",         descriptionKey: "profile.overview.sections.subscription.description",  descriptionFallback: "Manage plan and billing settings.",                                  benefitKey: "profile.overview.sections.subscription.benefit",  benefitFallback: "Account settings",       path: "/settings/subscription",           ready: true, countsTowardProfile: false },
];

interface MilestoneEntry {
  threshold: number;
  labelKey: string;
  teaserKey: string;
}

const MILESTONES: MilestoneEntry[] = [
  { threshold: 0.25, labelKey: "profile.overview.milestone25Label", teaserKey: "profile.overview.milestone25Teaser" },
  { threshold: 0.50, labelKey: "profile.overview.milestone50Label", teaserKey: "profile.overview.milestone50Teaser" },
  { threshold: 0.75, labelKey: "profile.overview.milestone75Label", teaserKey: "profile.overview.milestone75Teaser" },
  { threshold: 1.00, labelKey: "profile.overview.milestone100Label", teaserKey: "profile.overview.milestone100Teaser" },
];

function MilestoneStrip({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  const pct = total > 0 ? done / total : 0;

  const firstLocked = MILESTONES.find((m) => pct < m.threshold);
  const sectionsNeeded = firstLocked
    ? Math.ceil(firstLocked.threshold * total) - done
    : 0;

  return (
    <div
      className="mb-5 overflow-hidden rounded-[26px] border border-[#EFE4D5] bg-white shadow-[0_14px_34px_rgba(53,28,87,0.06)]"
      data-testid="banner-milestones"
    >
      <div className="border-b border-[#F1E7DC] px-5 py-4">
        <p className="font-body text-[15px] font-extrabold text-vyva-text-1">
          {pct >= 1
            ? t("profile.overview.allUnlocked")
            : firstLocked
            ? (sectionsNeeded === 1
                ? t("profile.overview.unlockHintSingle", { label: t(firstLocked.labelKey) })
                : t("profile.overview.unlockHintPlural", { count: sectionsNeeded, label: t(firstLocked.labelKey) }))
            : ""}
        </p>
      </div>
      <ul className="grid gap-0 divide-y divide-vyva-border min-[780px]:grid-cols-4 min-[780px]:divide-x min-[780px]:divide-y-0">
        {MILESTONES.map((m) => {
          const unlocked = pct >= m.threshold;
          return (
            <li
              key={m.labelKey}
              data-testid={`milestone-${m.labelKey}`}
              className="flex min-h-[86px] items-center gap-3 px-5 py-4"
            >
              {unlocked ? (
                <CheckCircle2 size={20} className="flex-shrink-0 text-vyva-green" />
              ) : (
                <Lock size={20} className="flex-shrink-0 text-vyva-warm2" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-body text-[14px] font-black leading-tight ${unlocked ? "text-vyva-text-1" : "text-vyva-text-3"}`}>
                  {t(m.labelKey)}
                </p>
                <p className={`mt-1 font-body text-[12px] leading-snug ${unlocked ? "text-vyva-green" : "text-vyva-text-3"}`}>
                  {unlocked ? t("profile.overview.unlocked") : t(m.teaserKey)}
                </p>
              </div>
              <span
                className={`font-body text-[12px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${
                  unlocked
                    ? "bg-green-50 text-green-700"
                    : "bg-vyva-warm text-vyva-text-3"
                }`}
              >
                {Math.round(m.threshold * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ProfileOverview = ({ preview = false }: { preview?: boolean }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mode, setMode } = useOnboardingCompanionGuidance({ mode: "voice" });

  const { data, isLoading } = useQuery<{
    profile: Record<string, unknown> | null;
    onboardingState: Record<string, unknown> | null;
  }>({
    queryKey: preview ? ["profile-overview-preview"] : ["/api/onboarding/state"],
    enabled: !preview,
    initialData: preview ? { profile: {}, onboardingState: {} } : undefined,
  });

  const completedSections = deriveCompletedSections(
    data?.profile ?? null,
    data?.onboardingState ?? null
  );

  const profileSections = PROFILE_OVERVIEW_SECTIONS.filter((section) => section.countsTowardProfile);
  const done = profileSections.filter((section) => completedSections.has(section.id)).length;
  const total = profileSections.length;
  const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  const proxyName = data?.profile?.proxy_initiator_id as string | null | undefined;
  const elderConfirmed = !!(data?.profile?.elder_confirmed_at);

  return (
    <div className="min-h-screen bg-vyva-cream">
      <div className="mx-auto w-full max-w-[920px] px-5 pb-6 pt-8 sm:px-7">
        {/* Header */}
        <div className="pb-5">
          <div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate("/")} aria-label={t("common.back", "Back")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-vyva-border bg-white text-vyva-purple shadow-sm">
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
              <h1 className="min-w-0 flex-1 text-center font-display text-[24px] font-bold leading-tight text-vyva-text-1">{t("profile.overview.title")}</h1>
              <button type="button" onClick={() => setMode(mode === "voice" ? "tactile" : "voice")}
                aria-label={t("profile.overview.companionMode.voiceLabel", "Voice")}
                title={t("profile.overview.companionMode.voiceLabel", "Voice")}
                aria-pressed={mode === "voice"}
                data-testid="button-profile-voice"
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-vyva-purple shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vyva-purple ${mode === "voice" ? "bg-vyva-purple text-white" : "bg-white text-vyva-purple"}`}>
                <VyvaIcon icon={Mic} size={17} strokeWidth={2.45} tone={mode === "voice" ? "inverse" : "utility"} />
              </button>
            </div>
              <div className="py-6">
                    <p
                      className="text-[14px] font-semibold text-vyva-text-2"
                      data-testid="text-profile-completion-count"
                    >
                      {isLoading ? t("profile.overview.loading") : t("profile.overview.completionCount", { done, total })}
                    </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-vyva-border" role="progressbar" aria-label={t("profile.overview.title")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}>
                  <div
                    data-testid="progress-profile-completion"
                    className="h-full rounded-full bg-vyva-purple transition-all"
                    style={{ width: isLoading ? "0%" : `${completionPercent}%` }}
                  />
                </div>
              </div>
          </div>
        </div>

        {/* Proxy banner */}
        {!isLoading && proxyName && (
          <div
            data-testid="banner-proxy-setup"
            className={`mb-5 rounded-[22px] px-5 py-4 flex items-start gap-3 ${
              elderConfirmed
                ? "bg-green-50 border border-green-200"
                : "bg-amber-50 border border-amber-200"
            }`}
          >
          <div className="mt-0.5 flex-shrink-0">
            {elderConfirmed
              ? <CheckCircle2 size={18} className="text-green-600" />
              : <UserCheck size={18} className="text-amber-600" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[13px] font-semibold text-vyva-text-1">
              {t("profile.overview.setUpBy", { name: proxyName })}
            </p>
            <p className="font-body text-[12px] text-vyva-text-2 mt-0.5">
              {elderConfirmed
                ? t("profile.overview.confirmed")
                : t("profile.overview.awaitingConfirmation")}
            </p>
          </div>
          {!elderConfirmed && (
            <button
              data-testid="button-proxy-confirm-now"
              onClick={() => navigate("/onboarding/elder-confirm")}
              className="font-body text-[12px] font-semibold text-amber-700 underline flex-shrink-0 ml-1"
            >
              {t("profile.overview.confirmNow")}
            </button>
          )}
          </div>
        )}

        {/* Milestone strip */}
        {!isLoading && (
          <MilestoneStrip done={done} total={total} />
        )}

        {/* Section cards */}
        <div
          className="grid gap-4 md:grid-cols-2"
          data-testid="list-profile-sections"
        >
        {PROFILE_OVERVIEW_SECTIONS.map((s) => (
          <SectionCard
            key={s.id}
            icon={s.icon}
            iconBg={s.iconBg}
            iconColor={s.iconColor}
            title={t(s.titleKey, s.titleFallback)}
            description={s.ready ? t(s.descriptionKey, s.descriptionFallback) : `${t(s.descriptionKey, s.descriptionFallback)} - ${t("profile.overview.comingSoon")}`}
            completed={completedSections.has(s.id)}
            locked={!s.ready}
            benefit={t(s.benefitKey, s.benefitFallback)}
            onClick={() => navigate(s.path)}
          />
        ))}
        </div>

        {/* Done button */}
        <div className="py-6 md:mx-auto md:max-w-[420px]">
        <button
          data-testid="button-profile-go-home"
          onClick={() => navigate("/")}
          className="w-full rounded-full py-4 font-body text-[18px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)]"
          style={{ background: "#6B21A8" }}
        >
          {t("profile.overview.goToVyva")}
        </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;
