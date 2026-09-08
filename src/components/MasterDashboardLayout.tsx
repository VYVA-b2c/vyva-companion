import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, Loader2, Mic, type LucideIcon } from "lucide-react";
import { VyvaIcon, type VyvaBrandGlyph, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import VyvaSessionCta from "@/components/VyvaSessionCta";

type MasterTone = {
  iconBg: string;
  iconColor: string;
  border: string;
  surface?: string;
};

type MasterAction = {
  kind?: "button" | "voice";
  label: string;
  onClick?: () => void;
  testId?: string;
  disabled?: boolean;
  isLoading?: boolean;
  activeLabel?: string;
  connectingLabel?: string;
  preparingLabel?: string;
  errorLabel?: string;
  contextHint?: string;
  voiceAgentSlug?: string;
  voiceDynamicVariables?: Record<string, string | number | boolean>;
  autoStartListening?: boolean;
  canStartVoice?: () => boolean;
  hideWhenSessionActive?: boolean;
  supportingLabel?: string;
  onFirstVoiceOrbActivation?: () => void;
};

export type MasterDashboardCard = {
  id: string;
  icon: LucideIcon;
  brandIcon?: VyvaBrandGlyph;
  iconAccent?: VyvaIconAccent;
  title: string;
  detail: string;
  summary?: string;
  tone: MasterTone;
  onClick: () => void;
  testId?: string;
  accent?: string;
  chips?: string[];
  highlighted?: boolean;
  highlightLabel?: string;
};

export type MasterFastHelpAction = {
  id: string;
  icon: LucideIcon;
  brandIcon?: VyvaBrandGlyph;
  iconAccent?: VyvaIconAccent;
  label: string;
  detail: string;
  tone: MasterTone;
  onClick: () => void;
  testId?: string;
  expanded?: boolean;
  controls?: string;
  pinned?: boolean;
  badge?: string;
};

export type MasterDashboardHero = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: string;
  subtitleTone?: "default" | "gold";
  action: MasterAction;
  tone?: MasterTone;
  testId?: string;
  messageActionLabel?: string;
  onMessageAction?: () => void;
  onMessageDismiss?: () => void;
  messageDismissLabel?: string;
};

type MasterDashboardLayoutProps = {
  hero: MasterDashboardHero;
  cards: MasterDashboardCard[];
  fastHelpTitle: string;
  fastHelpActions: MasterFastHelpAction[];
  launcherVariant?: "default" | "homeMaster";
  intentLayer?: boolean;
  cardSectionTitle?: string;
  cardSectionDescription?: string;
  cardSectionMoreLabel?: string;
  cardSectionMoreCompactLabel?: string;
  onCardSectionMore?: () => void;
  cardSectionMoreTestId?: string;
  testId?: string;
  cardGridTestId?: string;
  fastHelpTestId?: string;
  fastHelpVisibleCount?: number;
  fastHelpRotationMs?: number;
  beforeFastHelp?: ReactNode;
  showLauncher?: boolean;
  showHero?: boolean;
  showCards?: boolean;
  heroLayoutVariant?: "dashboard" | "canonicalMenu";
  cardLayoutVariant?: "dashboard" | "canonicalActionGrid";
  fastHelpLayoutVariant?: "dashboard" | "canonicalActionGrid";
  modeSwitcher?: ReactNode;
  isDarkMode?: boolean;
  presentationAttributes?: Record<string, string>;
  presentationClassName?: string;
  children?: ReactNode;
};

const defaultHeroTone: MasterTone = {
  iconBg: "#F5F3FF",
  iconColor: "#6B21A8",
  border: "#D9ECE4",
  surface: "#FFFFFF",
};

const heroBackgroundImage = [
  "linear-gradient(90deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.72) 58%, rgba(255,255,255,0.54) 100%)",
  "linear-gradient(112deg, rgba(255,255,255,0.98) 0%, rgba(255,250,244,0.94) 52%, rgba(248,243,255,0.88) 100%)",
  "url('/assets/vyva/cozy-home-room.png')",
];

const twoLineClampStyle: CSSProperties = {
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
};

export default function MasterDashboardLayout({
  hero,
  cards,
  fastHelpTitle,
  fastHelpActions,
  launcherVariant = "default",
  intentLayer = false,
  cardSectionTitle,
  cardSectionMoreLabel,
  cardSectionMoreCompactLabel,
  onCardSectionMore,
  cardSectionMoreTestId,
  testId,
  cardGridTestId,
  fastHelpTestId,
  fastHelpVisibleCount = 3,
  fastHelpRotationMs = 9000,
  beforeFastHelp,
  showLauncher = true,
  showHero = showLauncher,
  showCards = showLauncher,
  heroLayoutVariant = "dashboard",
  cardLayoutVariant = "dashboard",
  fastHelpLayoutVariant = "dashboard",
  modeSwitcher,
  isDarkMode = false,
  presentationAttributes,
  presentationClassName,
  children,
}: MasterDashboardLayoutProps) {
  const heroTone = hero.tone ?? defaultHeroTone;
  const isVoiceAction = hero.action.kind === "voice";
  const isHomeMaster = launcherVariant === "homeMaster";
  const isHomeMasterDark = isHomeMaster && isDarkMode;
  const isHomeMasterIntentLayer = isHomeMaster && intentLayer;
  const isHomeMasterTopLevelCards = isHomeMaster && !isHomeMasterIntentLayer;
  const isHomeMasterSingleSurface = isHomeMaster && showHero && !showCards;
  const usesCanonicalMenuHero = !isHomeMaster && heroLayoutVariant === "canonicalMenu";
  const usesCanonicalCardGrid = !isHomeMaster && cardLayoutVariant === "canonicalActionGrid";
  const usesCanonicalFastHelp = !isHomeMaster && fastHelpLayoutVariant === "canonicalActionGrid";
  const usesDarkCanonicalHero = isDarkMode && usesCanonicalMenuHero;
  const usesDarkCanonicalCards = isDarkMode && usesCanonicalCardGrid;
  const usesDarkCanonicalFastHelp = isDarkMode && usesCanonicalFastHelp;
  const allowMessageControls = !(isHomeMaster && isVoiceAction);
  const hasMessageAction = allowMessageControls && Boolean(hero.messageActionLabel && hero.onMessageAction);
  const hasMessageDismiss = allowMessageControls && Boolean(hero.onMessageDismiss);
  const isHomeMasterContextMessage = isHomeMaster && Boolean(hasMessageAction || hasMessageDismiss);
  const movesHomeMasterSubtitleBelowOrb = isHomeMaster && isVoiceAction && !isHomeMasterIntentLayer && !isHomeMasterContextMessage;
  const [fastHelpIndex, setFastHelpIndex] = useState(0);
  const [isFastHelpPaused, setFastHelpPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pinnedFastHelpActions = useMemo(
    () => fastHelpActions.filter((action) => action.pinned),
    [fastHelpActions],
  );
  const rotatingFastHelpActions = useMemo(
    () => fastHelpActions.filter((action) => !action.pinned),
    [fastHelpActions],
  );
  const fastHelpSignature = useMemo(
    () => fastHelpActions.map((action) => `${action.id}:${action.pinned ? "pinned" : "rotating"}`).join("|"),
    [fastHelpActions],
  );
  const rotatingSlots = Math.max(0, fastHelpVisibleCount - pinnedFastHelpActions.length);
  const visibleFastHelpActions = useMemo(() => {
    const pinned = pinnedFastHelpActions.slice(0, fastHelpVisibleCount);
    if (pinned.length >= fastHelpVisibleCount) return pinned;
    if (rotatingFastHelpActions.length <= rotatingSlots) {
      return [...pinned, ...rotatingFastHelpActions].slice(0, fastHelpVisibleCount);
    }
    const rotatingWindow = Array.from(
      { length: rotatingSlots },
      (_, index) => rotatingFastHelpActions[(fastHelpIndex + index) % rotatingFastHelpActions.length],
    );
    return [...pinned, ...rotatingWindow];
  }, [fastHelpIndex, fastHelpVisibleCount, pinnedFastHelpActions, rotatingFastHelpActions, rotatingSlots]);
  const fastHelpGridColumnsClassName =
    visibleFastHelpActions.length <= 1
      ? "md:grid-cols-1"
      : visibleFastHelpActions.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-3";

  useEffect(() => {
    setFastHelpIndex(0);
  }, [fastHelpSignature]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isFastHelpPaused || rotatingSlots <= 0 || rotatingFastHelpActions.length <= rotatingSlots) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setFastHelpIndex((current) => (current + rotatingSlots) % rotatingFastHelpActions.length);
    }, fastHelpRotationMs);
    return () => window.clearInterval(timer);
  }, [fastHelpRotationMs, isFastHelpPaused, prefersReducedMotion, rotatingFastHelpActions.length, rotatingSlots]);

  return (
    <div
      className={[
        "vyva-page px-4 pb-4 min-[390px]:px-[22px] sm:pb-8",
        isHomeMaster
          ? "vyva-home-master-fixed-type mx-auto min-h-[calc(100svh-148px)] max-w-[calc(100vw-32px)] !px-0 pb-[148px] min-[390px]:max-w-[366px] sm:max-w-[390px] md:min-h-[calc(100svh-186px)] md:max-w-[640px] md:pb-0 lg:max-w-[720px]"
          : "",
        isHomeMasterSingleSurface ? "md:flex md:flex-col" : "",
        presentationClassName ?? "",
      ].join(" ")}
      {...(presentationAttributes ?? {})}
      data-testid={testId}
      data-home-master-theme={isHomeMasterDark ? "dark" : "light"}
      data-home-master-intent-layer={isHomeMasterIntentLayer ? "true" : "false"}
    >
      {modeSwitcher}

      {showHero ? <section
        aria-label={hero.eyebrow ? `${hero.eyebrow}: ${hero.title}` : hero.title}
        className={[
          isHomeMaster
            ? `relative text-center ${isHomeMasterIntentLayer ? "pt-3 min-[390px]:pt-4 sm:pt-7" : `pt-1 min-[390px]:pt-2 sm:pt-8 ${isHomeMasterSingleSurface ? "md:flex md:flex-1 md:flex-col md:justify-center md:pt-0" : "md:pt-10"}`}`
            : usesCanonicalMenuHero
              ? [
                  "mt-3 overflow-hidden rounded-[26px] border px-4 py-3.5 shadow-[0_14px_30px_rgba(36,28,48,0.07)] min-[390px]:px-5 min-[390px]:py-4 sm:rounded-[28px]",
                  usesDarkCanonicalHero
                    ? "border-white/[0.14] bg-white/[0.08] text-[#F9F4FF] shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
                    : "border-[#EEE8F1] bg-white text-[#241C30]",
                ].join(" ")
              : "mt-4 overflow-hidden rounded-[24px] border bg-white p-4 shadow-[0_14px_32px_rgba(63,45,35,0.07)] min-[390px]:rounded-[28px] min-[390px]:p-5 sm:rounded-[30px] sm:p-6",
        ].join(" ")}
        style={isHomeMaster
          ? undefined
          : usesCanonicalMenuHero
            ? {
                borderColor: usesDarkCanonicalHero ? "rgba(255,255,255,0.14)" : "#EEE8F1",
                background: usesDarkCanonicalHero
                  ? "linear-gradient(145deg, rgba(255,255,255,0.115) 0%, rgba(255,255,255,0.065) 100%)"
                  : "linear-gradient(145deg, #FFFFFF 0%, #FFFFFF 62%, #F8F3FF 100%)",
              }
            : {
                borderColor: heroTone.border,
                backgroundColor: heroTone.surface ?? "#FFFFFF",
                backgroundImage: heroBackgroundImage.join(", "),
                backgroundPosition: "center, center, left bottom",
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover, cover, cover",
              }}
        data-testid={hero.testId}
        data-hero-layout={usesCanonicalMenuHero ? "canonical-menu" : "dashboard"}
      >
        <div className={`flex gap-4 min-[390px]:gap-5 ${isHomeMaster ? "flex-col items-center" : usesCanonicalMenuHero ? "items-center justify-between" : isVoiceAction ? "items-center justify-between" : "items-start"}`}>
          <span className={`min-w-0 flex-1 ${isHomeMaster ? "px-5 text-center min-[390px]:px-7 sm:px-10" : "text-left"}`}>
            <h1
              className={[
                `text-balance leading-[0.98] text-vyva-text-1 ${isHomeMaster ? "vyva-home-master-readable" : ""} ${isHomeMasterContextMessage ? "vyva-home-master-context-title" : ""}`,
                isHomeMaster
                  ? [
                      `mx-auto font-body font-bold tracking-normal ${isHomeMasterContextMessage ? "max-w-[20rem] text-[25px] leading-[1.04] min-[390px]:text-[27px] sm:max-w-[34rem] sm:text-[32px] md:max-w-[40rem] md:text-[35px] lg:max-w-[52rem] lg:text-[42px]" : isHomeMasterIntentLayer ? "max-w-[19rem] text-[26px] min-[390px]:text-[28px] sm:max-w-[30rem] sm:text-[33px] md:text-[36px] lg:max-w-[52rem] lg:text-[42px]" : "max-w-[19rem] text-[24px] min-[390px]:text-[26px] sm:max-w-[28rem] sm:text-[31px] md:max-w-[36rem] md:text-[36px] lg:max-w-[52rem] lg:text-[44px]"}`,
                      isHomeMasterDark ? "!text-[#FFF8FF] drop-shadow-[0_2px_12px_rgba(0,0,0,0.22)]" : "!text-[#24113D]",
                    ].join(" ")
                  : usesCanonicalMenuHero
                    ? [
                        "max-w-none font-display text-[27px] font-semibold min-[390px]:text-[30px] sm:text-[34px]",
                        usesDarkCanonicalHero ? "!text-[#F9F4FF]" : "!text-[#241C30]",
                      ].join(" ")
                    : "max-w-[8.6em] font-body text-[29px] font-black min-[390px]:text-[34px] sm:max-w-[9.4em] sm:text-[40px]",
              ].join(" ")}
            >
              {hero.title}
            </h1>
            {hero.subtitle && !movesHomeMasterSubtitleBelowOrb ? (
              <div
                data-testid="home-master-hero-subtitle"
                className={[
                  `relative mt-2 max-w-[16rem] font-body leading-snug text-vyva-text-2 ${isHomeMaster ? "vyva-home-master-readable" : ""}`,
                  isHomeMaster
                    ? `mx-auto max-w-[21rem] font-bold text-[#6C5369] ${isHomeMasterIntentLayer ? "mt-2 text-[15px] min-[390px]:text-[16px] sm:max-w-[30rem] sm:text-[18px]" : "mt-2 text-[15px] min-[390px]:text-[16px] sm:max-w-[28rem] sm:text-[19px] md:max-w-[34rem] md:text-[20px]"}`
                    : usesCanonicalMenuHero
                      ? "line-clamp-1 text-[13.5px] font-bold min-[390px]:text-[14.5px] sm:max-w-none sm:text-[15px]"
                      : "line-clamp-1 text-[15px] font-bold text-[#0F4C45] min-[390px]:text-[16px] sm:max-w-[18rem]",
                  hero.subtitleTone === "gold"
                    ? isHomeMasterDark || usesDarkCanonicalHero
                      ? "!text-[#F6C75B]"
                      : "!text-[#9A5B00]"
                    : isHomeMasterDark || usesDarkCanonicalHero
                      ? "!text-[#E8DDF3]"
                      : "",
                ].join(" ")}
              >
                {hasMessageAction ? (
                  <button
                    type="button"
                    onClick={hero.onMessageAction}
                    aria-label={hero.messageActionLabel}
                    className="vyva-tap block w-full rounded-md px-1 py-0.5 text-center transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vyva-purple focus-visible:ring-offset-2"
                    data-testid="button-home-context-action"
                  >
                    {hero.subtitle}
                  </button>
                ) : (
                  <span>{hero.subtitle}</span>
                )}
                {hasMessageDismiss ? (
                  <button
                    type="button"
                    onClick={hero.onMessageDismiss}
                    aria-label={hero.messageDismissLabel}
                    className={[
                      "vyva-tap mt-2 inline-flex min-h-8 items-center justify-center px-2 text-[13px] font-semibold underline decoration-1 underline-offset-4 transition-opacity hover:opacity-75 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vyva-purple focus-visible:ring-offset-2 sm:text-[14px]",
                      isHomeMasterDark
                        ? "text-[#D8CBE7]"
                        : "text-[#715C70]",
                    ].join(" ")}
                    data-testid="button-home-context-dismiss"
                  >
                    {hero.messageDismissLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </span>

          {isVoiceAction && !isHomeMaster ? (
            <VyvaSessionCta
              label={hero.action.label}
              activeLabel={hero.action.activeLabel}
              connectingLabel={hero.action.connectingLabel}
              preparingLabel={hero.action.preparingLabel}
              errorLabel={hero.action.errorLabel}
              contextHint={hero.action.contextHint}
              voiceAgentSlug={hero.action.voiceAgentSlug}
              voiceDynamicVariables={hero.action.voiceDynamicVariables}
              autoStartListening={hero.action.autoStartListening}
              canStartVoice={hero.action.canStartVoice}
              hideWhenSessionActive={hero.action.hideWhenSessionActive ?? true}
              disabled={hero.action.disabled}
              testId={hero.action.testId}
              supportingLabel={hero.action.supportingLabel}
              onFirstVoiceOrbActivation={hero.action.onFirstVoiceOrbActivation}
              visual="voiceRail"
              className={[
                "vyva-tap relative flex flex-shrink-0 items-center justify-center rounded-full border transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-75",
                usesCanonicalMenuHero
                  ? "!h-[58px] !min-h-[58px] !w-[58px] min-[390px]:!h-[62px] min-[390px]:!min-h-[62px] min-[390px]:!w-[62px]"
                  : "!h-[64px] !min-h-[64px] !w-[64px] min-[390px]:!h-[68px] min-[390px]:!min-h-[68px] min-[390px]:!w-[68px]",
                usesDarkCanonicalHero
                  ? "border-white/[0.14] bg-[#2A2034] text-[#F9F4FF]"
                  : "border-[#E8DDF3] bg-white text-vyva-purple",
              ].join(" ")}
            />
          ) : null}
        </div>

        {isVoiceAction && isHomeMaster ? (
          <div className={`relative mx-auto flex w-full flex-col items-center ${isHomeMasterIntentLayer ? "mt-1.5" : "mt-5 sm:mt-8"}`}>
            <VyvaSessionCta
              label={hero.action.label}
              activeLabel={hero.action.activeLabel}
              connectingLabel={hero.action.connectingLabel}
              preparingLabel={hero.action.preparingLabel}
              errorLabel={hero.action.errorLabel}
              contextHint={hero.action.contextHint}
              voiceAgentSlug={hero.action.voiceAgentSlug}
              voiceDynamicVariables={hero.action.voiceDynamicVariables}
              autoStartListening={hero.action.autoStartListening}
              canStartVoice={hero.action.canStartVoice}
              hideWhenSessionActive={hero.action.hideWhenSessionActive ?? false}
              disabled={hero.action.disabled}
              testId={hero.action.testId}
              supportingLabel={hero.subtitle ?? hero.action.supportingLabel}
              voiceOrbCaptionTestId={movesHomeMasterSubtitleBelowOrb ? "home-master-hero-subtitle" : undefined}
              onFirstVoiceOrbActivation={hero.action.onFirstVoiceOrbActivation}
              visual="voiceOrb"
              voiceOrbDark={isHomeMasterDark}
              voiceOrbSize={isHomeMasterIntentLayer ? 112 : 204}
              className="vyva-tap mx-auto flex flex-col items-center text-center disabled:cursor-wait disabled:opacity-75"
            />
          </div>
        ) : !isVoiceAction ? (
          <button
            type="button"
            onClick={hero.action.onClick}
            disabled={hero.action.disabled}
            data-testid={hero.action.testId}
            className="vyva-tap mt-6 flex !min-h-[70px] w-full items-center justify-center gap-2.5 rounded-[24px] border border-[#E8DDF3] bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF8F0_48%,#F7F1FF_100%)] px-5 font-body text-[18px] font-black text-vyva-text-1 shadow-[0_14px_30px_rgba(89,53,24,0.10)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-75 min-[390px]:!min-h-[74px] min-[390px]:text-[19px]"
          >
            {hero.action.isLoading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
            {hero.action.label}
          </button>
        ) : null}
      </section> : null}

      {showCards ? <section className={isHomeMaster ? (isHomeMasterIntentLayer ? "mt-2 sm:mt-3 md:mt-4" : "mt-1 min-[390px]:mt-2 sm:mt-4 md:mt-5") : usesCanonicalCardGrid ? "mt-3 min-[390px]:mt-3.5" : "mt-4"} aria-label={cardSectionTitle || "Today tray"} data-testid={cardGridTestId}>
        {cardSectionTitle ? (
          <div>
            {isHomeMasterIntentLayer ? null : (
              <h2 className={isHomeMaster ? "sr-only" : "mb-3 font-body text-[15px] font-black leading-tight text-vyva-text-1"}>
                {cardSectionTitle}
              </h2>
            )}
          </div>
        ) : null}
        <div
          className={
            isHomeMaster
              ? (isHomeMasterIntentLayer ? "grid grid-cols-1 gap-2.5 min-[390px]:gap-3 sm:gap-3.5 md:gap-4" : "grid grid-cols-2 gap-3 min-[390px]:gap-3.5 sm:gap-4 md:gap-4 lg:gap-5")
              : usesCanonicalCardGrid
                ? "grid grid-cols-1 gap-3 min-[390px]:gap-3.5 sm:grid-cols-2 md:gap-4"
                : "grid grid-cols-2 gap-3 min-[390px]:gap-3.5 md:grid-cols-4"
          }
          data-card-layout={usesCanonicalCardGrid ? "canonical-action-grid" : "dashboard-grid"}
        >
          {cards.map((card) => {
            const Icon = card.icon;
            const iconTileId = card.brandIcon ?? card.iconAccent ?? "utility";
            const visibleDetail = card.summary ?? card.detail;
            const iconSize = card.brandIcon
              ? isHomeMasterTopLevelCards
                ? 33
                : isHomeMaster
                  ? 24
                  : 38
              : isHomeMasterTopLevelCards
                ? 22
                : isHomeMaster
                  ? 15
                  : 28;
            const cardAriaLabel = card.detail ? `${card.title}. ${card.detail}` : card.title;
            const cardBorderColor = isHomeMasterDark ? "rgba(255,255,255,0.14)" : card.tone.border;
            const cardLeftBorderColor = isHomeMaster && isHomeMasterIntentLayer ? card.tone.iconColor : cardBorderColor;
            const homeMasterTitleClass = isHomeMasterTopLevelCards
              ? isHomeMasterDark
                ? "block max-w-[7.25rem] font-body text-[17px] font-extrabold leading-[1.05] !text-[#FFF8FF] min-[390px]:text-[18px] sm:max-w-[8.75rem] sm:text-[21px] md:max-w-[10rem] md:text-[22px]"
                : "block max-w-[7.25rem] font-body text-[17px] font-extrabold leading-[1.05] text-vyva-text-1 min-[390px]:text-[18px] sm:max-w-[8.75rem] sm:text-[21px] md:max-w-[10rem] md:text-[22px]"
              : isHomeMasterDark
                ? "block font-body text-[16px] font-extrabold leading-[1.08] !text-[#FFF8FF] min-[390px]:text-[17px] sm:text-[19px] md:text-[21px] lg:text-[22px]"
                : "block font-body text-[16px] font-extrabold leading-[1.08] text-vyva-text-1 min-[390px]:text-[17px] sm:text-[19px] md:text-[21px] lg:text-[22px]";
            return (
              <button
                key={card.id}
                type="button"
                onClick={card.onClick}
                data-testid={card.testId}
                aria-label={cardAriaLabel}
                aria-current={card.highlighted ? "true" : undefined}
                data-highlighted={card.highlighted ? "true" : undefined}
                className={[
                  "vyva-tap group rounded-[22px] border bg-white p-3 text-left shadow-[0_10px_24px_rgba(63,45,35,0.055)] transition-transform hover:-translate-y-0.5 min-[390px]:p-3.5",
                  card.highlighted ? "ring-[3px] ring-offset-2" : "",
                  isHomeMaster
                    ? isHomeMasterIntentLayer
                      ? "relative flex min-h-[64px] flex-row items-center justify-start gap-3 rounded-[17px] p-3 pr-10 shadow-[0_8px_18px_rgba(63,45,35,0.055)] min-[390px]:min-h-[70px] min-[390px]:rounded-[18px] min-[390px]:p-3.5 min-[390px]:pr-11 sm:min-h-[78px] sm:rounded-[20px] sm:p-4 sm:pr-12 md:min-h-[86px] md:p-5 md:pr-14 lg:min-h-[92px] lg:p-5 lg:pr-14"
                      : "relative flex min-h-[128px] flex-col items-start justify-between gap-3 rounded-[22px] p-3.5 pr-8 shadow-[0_14px_28px_rgba(10,7,20,0.14)] min-[390px]:min-h-[136px] min-[390px]:rounded-[24px] min-[390px]:p-4 min-[390px]:pr-9 sm:min-h-[148px] sm:p-5 md:min-h-[156px] lg:min-h-[164px]"
                    : usesCanonicalCardGrid
                      ? "grid min-h-[84px] grid-cols-[56px_minmax(0,1fr)_34px] items-center gap-x-4 rounded-[24px] px-4 py-3 shadow-[0_14px_30px_rgba(36,28,48,0.07)] min-[390px]:min-h-[88px] min-[390px]:rounded-[26px] md:min-h-[124px] md:grid-cols-[64px_minmax(0,1fr)_34px] md:px-5 md:py-4"
                      : "flex min-h-[96px] items-center gap-3 min-[390px]:min-h-[104px] md:min-h-[138px] md:flex-col md:items-start md:justify-between md:rounded-[24px]",
                ].join(" ")}
                data-vyva-card-layout={usesCanonicalCardGrid ? "canonical-action" : "dashboard"}
                style={{
                  borderTopColor: usesDarkCanonicalCards ? "rgba(255,255,255,0.14)" : cardBorderColor,
                  borderRightColor: usesDarkCanonicalCards ? "rgba(255,255,255,0.14)" : cardBorderColor,
                  borderBottomColor: usesDarkCanonicalCards ? "rgba(255,255,255,0.14)" : cardBorderColor,
                  borderLeftColor: usesDarkCanonicalCards ? "rgba(255,255,255,0.14)" : cardLeftBorderColor,
                  borderLeftWidth: isHomeMaster && isHomeMasterIntentLayer ? "5px" : undefined,
                  background: usesDarkCanonicalCards
                    ? "linear-gradient(145deg, rgba(255,255,255,0.105) 0%, rgba(255,255,255,0.06) 100%)"
                    : isHomeMaster
                    ? isHomeMasterDark
                      ? isHomeMasterTopLevelCards
                        ? `linear-gradient(145deg, rgba(255,255,255,0.155) 0%, rgba(255,255,255,0.085) 60%, ${card.tone.iconColor}18 100%)`
                        : "linear-gradient(145deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.075) 100%)"
                      : isHomeMasterTopLevelCards
                        ? `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 58%, ${card.tone.iconBg} 100%)`
                        : "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.88) 100%)"
                    : `linear-gradient(145deg, ${card.tone.surface ?? "#FFFFFF"} 0%, #FFFFFF 52%, ${card.tone.iconBg} 100%)`,
                  ...(card.highlighted
                    ? {
                        borderTopColor: card.tone.iconColor,
                        borderRightColor: card.tone.iconColor,
                        borderBottomColor: card.tone.iconColor,
                        borderLeftColor: card.tone.iconColor,
                        boxShadow: `0 12px 28px ${card.tone.iconColor}22`,
                        outlineColor: card.tone.iconColor,
                        "--tw-ring-color": card.tone.iconColor,
                      } as CSSProperties
                    : {}),
                }}
              >
                <span className={`flex min-w-0 items-center gap-3 ${usesCanonicalCardGrid ? "contents" : isHomeMaster ? "flex-none" : "flex-1 md:w-full md:items-start md:justify-between"}`}>
                  <span
                    className={[
                      "relative flex flex-shrink-0 items-center justify-center rounded-[20px] shadow-[0_10px_20px_rgba(63,45,35,0.06)]",
                      usesCanonicalCardGrid
                        ? "h-14 w-14 overflow-hidden rounded-[20px] md:h-16 md:w-16"
                        : isHomeMaster
                        ? isHomeMasterTopLevelCards
                          ? "h-11 w-11 rounded-[15px] sm:h-12 sm:w-12 md:h-[52px] md:w-[52px] md:rounded-[17px]"
                          : "h-7 w-7 rounded-[9px] min-[390px]:h-8 min-[390px]:w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 lg:h-11 lg:w-11"
                        : "h-14 w-14 min-[390px]:h-[60px] min-[390px]:w-[60px] md:h-[68px] md:w-[68px] md:rounded-[24px]",
                    ].join(" ")}
                    style={{
                      background: usesDarkCanonicalCards
                        ? "rgba(60,41,86,0.92)"
                        : isHomeMaster
                          ? card.tone.iconBg
                          : usesCanonicalCardGrid
                            ? "#F1E8FF"
                            : "#FFFFFF",
                      color: card.tone.iconColor,
                    }}
                    data-vyva-icon-tile={iconTileId}
                  >
                    {!isHomeMaster && !usesCanonicalCardGrid ? <span className="absolute inset-2 rounded-[16px] opacity-80" style={{ background: card.tone.iconBg }} aria-hidden="true" /> : null}
                    <VyvaIcon
                      icon={Icon}
                      glyph={card.brandIcon}
                      accent={card.iconAccent}
                      size={iconSize}
                      strokeWidth={2.55}
                      tone="brand"
                      className="relative"
                    />
                  </span>
                  <span className={`min-w-0 flex-1 ${usesCanonicalCardGrid ? "block" : isHomeMaster ? "hidden" : "md:hidden"}`}>
                    <span
                      className={[
                        "block font-body text-[17px] font-black leading-tight min-[390px]:text-[18px]",
                        usesCanonicalCardGrid ? "font-display text-[20px] font-semibold leading-[1.03] min-[390px]:text-[21px] md:text-[24px]" : "",
                        usesDarkCanonicalCards ? "text-[#F9F4FF]" : "text-vyva-text-1",
                      ].join(" ")}
                      data-testid={card.testId ? `${card.testId}-title` : undefined}
                    >
                      {card.title}
                    </span>
                    {usesCanonicalCardGrid ? (
                      <span
                        className="sr-only"
                        style={twoLineClampStyle}
                        data-testid={card.testId ? `${card.testId}-detail` : undefined}
                      >
                        {visibleDetail}
                      </span>
                    ) : null}
                    {card.accent ? (
                      <span className="mt-1 block truncate font-body text-[12px] font-black leading-tight" style={{ color: card.tone.iconColor }}>
                        {card.accent}
                      </span>
                    ) : null}
                  </span>
                  {card.accent ? (
                    <span
                      className={[
                        "min-w-0 max-w-[92px] truncate rounded-full px-2 py-1.5 text-center font-body text-[10px] font-black leading-none",
                      isHomeMaster ? "hidden" : "hidden md:inline-block",
                      ].join(" ")}
                      style={{ background: card.tone.iconBg, color: card.tone.iconColor }}
                    >
                      {card.accent}
                    </span>
                  ) : null}
                </span>
                {isHomeMaster ? (
                  <ChevronRight
                    size={14}
                    strokeWidth={2.4}
                    className={isHomeMasterDark
                      ? `absolute ${isHomeMasterTopLevelCards ? "right-3.5 top-3.5 translate-y-0" : "right-3 top-1/2 -translate-y-1/2"} text-white/50`
                      : `absolute ${isHomeMasterTopLevelCards ? "right-3.5 top-3.5 translate-y-0" : "right-3 top-1/2 -translate-y-1/2"} text-vyva-text-3`}
                    aria-hidden="true"
                  />
                ) : null}
                {usesCanonicalCardGrid ? (
                  <span className="grid h-[34px] w-[34px] place-items-center rounded-full text-white" style={{ background: card.tone.iconColor }} aria-hidden="true">
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </span>
                ) : null}
                {card.highlighted && card.highlightLabel ? (
                  <span
                    className="absolute right-9 top-2.5 max-w-[42%] truncate rounded-full px-2 py-1 font-body text-[9px] font-black leading-none min-[390px]:right-10 min-[390px]:text-[10px] sm:right-11"
                    style={{ background: card.tone.iconBg, color: card.tone.iconColor }}
                  >
                    {card.highlightLabel}
                  </span>
                ) : null}
                <span className={`min-w-0 pr-1 ${usesCanonicalCardGrid ? "hidden" : isHomeMaster ? isHomeMasterTopLevelCards ? "block w-full" : "block flex-1" : "mt-3 hidden md:block"}`}>
                  <span className={homeMasterTitleClass}>
                    {card.title}
                  </span>
                  {isHomeMaster && card.detail ? (
                    <span
                      className="sr-only"
                    >
                      {card.detail}
                    </span>
                  ) : null}
                  {!isHomeMaster && card.chips?.length ? (
                    <span className="mt-2 flex flex-wrap gap-1">
                      {card.chips.slice(0, 3).map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full px-1.5 py-0.5 font-body text-[9px] font-black leading-none min-[390px]:px-2 min-[390px]:text-[10px]"
                          style={{ background: "#F4EFE7", color: "#7A6A5D" }}
                        >
                          {chip}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        {isHomeMaster && onCardSectionMore ? (
          <button
            type="button"
            onClick={onCardSectionMore}
            data-testid={cardSectionMoreTestId}
            className={isHomeMasterDark
              ? "vyva-tap mt-3 flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[18px] border border-white/[0.14] bg-white/[0.08] px-4 py-3 text-left font-body text-[16px] font-extrabold text-[#FFF8FF] shadow-[0_10px_24px_rgba(0,0,0,0.12)] sm:mx-auto sm:min-h-0 sm:w-auto sm:justify-center sm:rounded-full sm:px-4 sm:py-2.5 sm:text-[13px]"
              : "vyva-tap mt-3 flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[18px] border border-[#E8DDF3] bg-white px-4 py-3 text-left font-body text-[16px] font-extrabold text-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.08)] sm:mx-auto sm:min-h-0 sm:w-auto sm:justify-center sm:rounded-full sm:px-4 sm:py-2.5 sm:text-[13px]"}
          >
            <span>
              <span className="sm:hidden">{cardSectionMoreCompactLabel ?? cardSectionMoreLabel ?? "More"}</span>
              <span className="hidden sm:inline">{cardSectionMoreLabel ?? "More"}</span>
            </span>
            <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
        ) : null}
      </section> : null}

      {beforeFastHelp ? <div className="mt-4">{beforeFastHelp}</div> : null}

      {showLauncher && !isHomeMaster ? <section
        className={[
          usesCanonicalFastHelp
            ? "mt-3 min-[390px]:mt-3.5"
            : "mt-4 rounded-[24px] border p-3 shadow-[0_12px_28px_rgba(63,45,35,0.055)] min-[390px]:rounded-[26px] min-[390px]:p-4",
          usesCanonicalFastHelp
            ? ""
            : usesDarkCanonicalFastHelp
              ? "border-white/[0.14] bg-white/[0.08] text-[#F9F4FF] shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
              : "border-[#E6E0F4] bg-white",
        ].join(" ")}
        data-fast-help-layout={usesCanonicalFastHelp ? "canonical-action-grid" : "dashboard-grid"}
        data-testid={fastHelpTestId}
        onMouseEnter={() => setFastHelpPaused(true)}
        onMouseLeave={() => setFastHelpPaused(false)}
        onFocus={() => setFastHelpPaused(true)}
        onBlur={(event) => {
          const nextFocusedElement = event.relatedTarget instanceof Node ? event.relatedTarget : null;
          if (!nextFocusedElement || !event.currentTarget.contains(nextFocusedElement)) {
            setFastHelpPaused(false);
          }
        }}
      >
        <h2 className={[
          "font-body font-black leading-tight",
          usesCanonicalFastHelp ? "px-0.5 text-[17px] min-[390px]:text-[18px]" : "text-[22px] min-[390px]:text-[24px]",
          usesDarkCanonicalFastHelp ? "text-[#F9F4FF]" : "text-vyva-text-1",
        ].join(" ")}>
          {fastHelpTitle}
        </h2>
        <div className={`${usesCanonicalFastHelp ? "mt-2" : "mt-3"} grid min-w-0 grid-cols-1 gap-2.5 ${fastHelpGridColumnsClassName}`}>
          {visibleFastHelpActions.map((action) => {
            const Icon = action.icon;
            const iconTileId = action.brandIcon ?? action.iconAccent ?? "utility";
            const actionAriaLabel = action.detail ? `${action.label}. ${action.detail}` : action.label;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={action.testId}
                onClick={action.onClick}
                aria-label={actionAriaLabel}
                aria-expanded={action.expanded}
                aria-controls={action.controls}
                className={[
                  "vyva-tap flex w-full min-w-0 items-center gap-3 border px-3 text-left transition-transform hover:-translate-y-0.5",
                  usesCanonicalFastHelp
                    ? "!min-h-[64px] rounded-[22px] py-2 pr-3 min-[390px]:!min-h-[68px] min-[390px]:rounded-[24px]"
                    : "!min-h-[62px] rounded-[18px] py-2 min-[390px]:!min-h-[68px] min-[390px]:rounded-[20px] md:flex-col md:items-start md:justify-between md:p-3",
                  usesDarkCanonicalFastHelp ? "bg-white/[0.07] text-[#F9F4FF]" : "bg-white",
                ].join(" ")}
                style={{
                  borderColor: usesDarkCanonicalFastHelp ? "rgba(255,255,255,0.14)" : action.tone.border,
                  background: usesDarkCanonicalFastHelp
                    ? "linear-gradient(145deg, rgba(255,255,255,0.105) 0%, rgba(255,255,255,0.06) 100%)"
                    : `linear-gradient(145deg, #FFFFFF 0%, #FFFFFF 58%, ${action.tone.iconBg} 100%)`,
                }}
                >
                <span
                  className={[
                    "flex flex-shrink-0 items-center justify-center",
                    usesCanonicalFastHelp
                      ? "h-10 w-10 rounded-[14px] min-[390px]:h-11 min-[390px]:w-11 min-[390px]:rounded-[15px]"
                      : "h-12 w-12 rounded-[17px] min-[390px]:h-[54px] min-[390px]:w-[54px] min-[390px]:rounded-[19px] md:h-12 md:w-12",
                  ].join(" ")}
                  style={{
                    background: usesDarkCanonicalFastHelp ? "rgba(60,41,86,0.92)" : action.tone.iconBg,
                    color: action.tone.iconColor,
                  }}
                  data-vyva-icon-tile={iconTileId}
                >
                  <VyvaIcon
                    icon={Icon}
                    glyph={action.brandIcon}
                    accent={action.iconAccent}
                    size={action.brandIcon ? (usesCanonicalFastHelp ? 28 : 34) : (usesCanonicalFastHelp ? 20 : 24)}
                    strokeWidth={2.45}
                    tone="brand"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={[
                      "block font-body font-black leading-tight",
                      usesCanonicalFastHelp ? "text-[15.5px] min-[390px]:text-[16.5px]" : "text-[17px] min-[390px]:text-[18px]",
                      usesDarkCanonicalFastHelp ? "text-[#F9F4FF]" : "text-vyva-text-1",
                    ].join(" ")}>
                      {action.label}
                    </span>
                    {action.badge ? (
                      <span
                        className="flex-shrink-0 rounded-full px-2 py-0.5 font-body text-[10px] font-black uppercase leading-none"
                        style={{ background: action.tone.iconBg, color: action.tone.iconColor }}
                      >
                        {action.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="sr-only">
                    {action.detail}
                  </span>
                </span>
                <span
                  className={usesCanonicalFastHelp ? "grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-white" : "contents"}
                  style={usesCanonicalFastHelp ? { background: action.tone.iconColor } : undefined}
                  aria-hidden="true"
                >
                  <ChevronRight
                    size={usesCanonicalFastHelp ? 18 : 24}
                    strokeWidth={usesCanonicalFastHelp ? 2.5 : 2.6}
                    className={usesCanonicalFastHelp ? "" : "flex-shrink-0 text-vyva-text-3 md:hidden"}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section> : null}

      {children}
    </div>
  );
}
