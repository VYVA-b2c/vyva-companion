import {
  ALargeSmall,
  ArrowUpRight,
  BellRing,
  Brain,
  ChevronRight,
  Heart,
  Mic,
  Moon,
  Pill,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { HomeMasterActionControl, HomeMasterProfileControl, HomeMasterTopbar } from "@/components/HomeMasterTopControls";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";

type MenuTile = {
  id: "health" | "brain" | "community" | "concierge";
  title: string;
  detail: string;
  path: string;
  icon: LucideIcon;
  iconAccent: VyvaIconAccent;
};

const MENU_TILES: MenuTile[] = [
  {
    id: "health",
    title: "My Health",
    detail: "Check-ins & medicines",
    path: "/health",
    icon: Heart,
    iconAccent: "pulse",
  },
  {
    id: "brain",
    title: "Brain Power",
    detail: "Memory, focus & calm",
    path: "/mind-memory",
    icon: Brain,
    iconAccent: "bridge",
  },
  {
    id: "community",
    title: "Community",
    detail: "Rooms & support",
    path: "/social-rooms",
    icon: Users,
    iconAccent: "link",
  },
  {
    id: "concierge",
    title: "Concierge",
    detail: "Everyday help",
    path: "/concierge",
    icon: BellRing,
    iconAccent: "clapper",
  },
];

export { MENU_TILES };

type MenuScreenProps = {
  backPath?: string;
  profilePath?: string;
  tilePathOverrides?: Partial<Record<MenuTile["id"], string>>;
};

export default function MenuScreen({
  backPath = "/",
  profilePath = "/settings/account",
  tilePathOverrides,
}: MenuScreenProps = {}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isDark, toggleTheme } = useHomeMasterTheme();
  const { isLarge: isReadableTextLarge, toggleSize: toggleReadableTextSize } = useReadableTextSize();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const nextReadableTextSizeLabel = isReadableTextLarge ? "Normal" : "Large";
  const nextThemeLabel = isDark ? "Light" : "Dark";

  const profileLinks: Array<{
    label: string;
    detail: string;
    path: string;
    icon: LucideIcon;
    iconAccent: VyvaIconAccent;
    testId: string;
  }> = [
    {
      label: "Account details",
      detail: "Name, phone, language",
      path: profilePath,
      icon: UserRound,
      iconAccent: "id",
      testId: "button-menu-profile-account",
    },
    {
      label: "Health profile",
      detail: "Conditions and basics",
      path: "/onboarding/profile/health",
      icon: Heart,
      iconAccent: "pulse",
      testId: "button-menu-profile-health",
    },
    {
      label: "My Medication",
      detail: "Current medications",
      path: "/onboarding/profile/medications",
      icon: Pill,
      iconAccent: "divider",
      testId: "button-menu-profile-medications",
    },
    {
      label: "Emergency contact",
      detail: "Who to call if needed",
      path: "/onboarding/profile/emergency",
      icon: ShieldCheck,
      iconAccent: "check",
      testId: "button-menu-profile-emergency",
    },
    {
      label: "Care team",
      detail: "Family and contacts",
      path: "/onboarding/profile/care-team",
      icon: Users,
      iconAccent: "link",
      testId: "button-menu-profile-care-team",
    },
    {
      label: "Doctors & providers",
      detail: "Clinics and trusted help",
      path: "/onboarding/profile/providers",
      icon: Stethoscope,
      iconAccent: "scope",
      testId: "button-menu-profile-providers",
    },
  ];

  const navigateFromProfileMenu = (path: string) => {
    setProfileMenuOpen(false);
    navigate(path);
  };

  return (
    <main
      className={[
        "min-h-[calc(100svh-136px)]",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F7F0FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
      ].join(" ")}
      data-testid="menu-screen"
      data-theme={isDark ? "dark" : "light"}
    >
      <div
        className="mx-auto flex min-h-[calc(100svh-136px)] w-full max-w-[430px] flex-col px-6 pt-8 sm:max-w-[680px] sm:px-7 lg:max-w-[900px] lg:!max-w-[880px]"
        data-testid="menu-shell"
      >
        <HomeMasterTopbar
          className="mb-5 sm:mb-7 md:mb-0"
          testId="menu-topbar"
          compact
        >
          <HomeMasterProfileControl
            isDark={isDark}
            ariaLabel="Open profile and settings"
            testId="button-menu-profile"
            onClick={() => setProfileMenuOpen(true)}
            expanded={profileMenuOpen}
            controls={profileMenuOpen ? "menu-profile-menu" : undefined}
            compact
          />
          <div className="flex h-9 items-center justify-center sm:h-10">
            <h1 className={["sr-only md:not-sr-only md:font-display md:text-[24px] md:font-semibold", isDark ? "md:text-[#FFF8FF]" : "md:text-[var(--vyva-ink)]"].join(" ")}>
              Menu
            </h1>
          </div>
          <HomeMasterActionControl
            isDark={isDark}
            icon={Mic}
            ariaLabel="Return to voice home"
            testId="button-menu-voice-home"
            onClick={() => navigate(backPath)}
            compact
          />
        </HomeMasterTopbar>
        {profileMenuOpen ? (
          <div className="fixed inset-0 z-[80]" data-testid="menu-profile-menu-layer">
            <button
              type="button"
              data-testid="button-menu-profile-menu-backdrop"
              className={[
                "absolute inset-0 cursor-default bg-transparent md:backdrop-blur-[3px]",
                isDark ? "md:bg-black/35" : "md:bg-[#2D1748]/15",
              ].join(" ")}
              aria-label="Close profile menu"
              onClick={() => setProfileMenuOpen(false)}
            />
            <section
              id="menu-profile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Profile & settings"
              data-testid="menu-profile-menu"
              className={[
                "absolute left-1/2 top-[88px] max-h-[calc(100svh-110px)] w-[calc(100vw-44px)] max-w-[348px] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[30px] border p-3 text-left backdrop-blur-2xl sm:top-[92px] sm:max-w-[366px] md:top-1/2 md:max-h-[calc(100svh-96px)] md:max-w-[720px] md:-translate-y-1/2 md:rounded-[32px] md:p-5",
                isDark
                  ? "border-white/[0.12] bg-[#170C2A] text-[#FFF8FF] shadow-[0_28px_80px_rgba(0,0,0,0.28)]"
                  : "border-[#EFE4F6] bg-white/[0.96] text-[var(--vyva-ink)] shadow-[0_24px_70px_rgba(67,36,95,0.16)]",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3 px-2 pb-2 pt-1">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={[
                      "grid h-9 w-9 flex-shrink-0 place-items-center rounded-full shadow-none ring-1",
                      isDark
                        ? "bg-white/[0.08] text-[#DDD5E6] ring-white/[0.10]"
                        : "bg-[#F4F1F5] text-[#746A78] ring-[#E8E1EA]",
                    ].join(" ")}
                  >
                    <span className="font-display text-[19px] font-semibold leading-none" aria-hidden="true">
                      K
                    </span>
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span className={["block font-body text-[17px] font-extrabold leading-tight tracking-[-0.01em]", isDark ? "text-[#E8DFEF]" : "text-[#5F5663]"].join(" ")}>
                      Profile & settings
                    </span>
                    <span className={["mt-0.5 block font-body text-[11px] font-semibold leading-snug", isDark ? "text-[#BEB1CD]" : "text-[#8E8592]"].join(" ")}>
                      Update health, contacts, and display.
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="button-menu-profile-menu-close"
                  aria-label="Close profile menu"
                  onClick={() => setProfileMenuOpen(false)}
                  className={["vyva-tap grid h-10 !min-h-10 w-10 flex-shrink-0 place-items-center rounded-full", isDark ? "bg-white/10 text-[#F6F0FF]" : "bg-[#F8F5FF] text-[#6B5173]"].join(" ")}
                >
                  <X size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2 grid gap-1.5 md:grid-cols-2 md:gap-3" data-testid="menu-profile-menu-links">
                {profileLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      data-testid={item.testId}
                      onClick={() => navigateFromProfileMenu(item.path)}
                      className={[
                        "vyva-tap flex min-h-[60px] w-full items-center gap-2.5 rounded-[21px] border px-3 py-2 text-left transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 md:min-h-[72px] md:px-4",
                        isDark ? "border-white/[0.10] bg-white/[0.06]" : "border-[#F0E8F5] bg-white shadow-[0_8px_22px_rgba(67,36,95,0.05)]",
                      ].join(" ")}
                    >
                      <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${isDark ? "bg-[#3C2956] ring-1 ring-inset ring-white/10" : "bg-[#F1E8FF]"}`}>
                        <VyvaIcon icon={Icon} accent={item.iconAccent} size={21} strokeWidth={2.35} tone="brand" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[19px] font-semibold leading-none">
                          {item.label}
                        </span>
                        <span className="sr-only">
                          {item.detail}
                        </span>
                      </span>
                      <ChevronRight size={20} strokeWidth={2.55} className={isDark ? "text-[#DCCFEF]" : "text-[#B6AAB8]"} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>

              <div className={["my-3 h-px", isDark ? "bg-white/[0.10]" : "bg-[#EFE4F6]"].join(" ")} />
              <p className={["px-2 pb-2 font-body text-[11px] font-black uppercase tracking-[0.16em]", isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"].join(" ")}>
                Display preferences
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="button-menu-profile-text-size"
                  onClick={toggleReadableTextSize}
                  className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
                >
                  <ALargeSmall size={19} strokeWidth={2.35} aria-hidden="true" />
                  <span className="mt-1">Text size</span>
                  <span className={isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
                    {nextReadableTextSizeLabel}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="button-menu-profile-theme"
                  onClick={toggleTheme}
                  className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
                >
                  {isDark ? <Sun size={18} strokeWidth={2.35} aria-hidden="true" /> : <Moon size={18} strokeWidth={2.35} aria-hidden="true" />}
                  <span className="mt-1">Theme</span>
                  <span className={isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
                    {nextThemeLabel}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="button-menu-profile-mode"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    navigate(backPath);
                  }}
                  className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
                >
                  <Mic size={18} strokeWidth={2.35} aria-hidden="true" />
                  <span className="mt-1">Mode</span>
                  <span className={isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
                    Voice
                  </span>
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <div className="mt-7 lg:mt-0 lg:flex lg:flex-1 lg:items-center" data-testid="menu-grid-stage">
          <section className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:[grid-template-columns:repeat(4,minmax(0,1fr))]" aria-label="VYVA main menu" data-testid="menu-tile-grid">
            {MENU_TILES.map((tile) => {
              const Icon = tile.icon;
              const destination = tilePathOverrides?.[tile.id] ?? tile.path;
              return (
                <button
                  key={tile.id}
                  type="button"
                  className={[
                    "vyva-tap group grid min-h-[84px] w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 rounded-[26px] border px-4 text-left transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 md:min-h-[158px] md:grid-cols-[64px_minmax(0,1fr)_auto] md:grid-rows-[auto_1fr] md:items-start md:gap-y-3 md:p-5 lg:flex lg:min-h-[120px] lg:flex-col lg:items-start lg:gap-2 lg:p-4",
                    isDark
                      ? "border-white/[0.14] bg-[#2A2034] text-[#F9F4FF] shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
                      : "border-[#EEE8F1] bg-white text-[#241C30] shadow-[0_14px_30px_rgba(36,28,48,0.07)]",
                  ].join(" ")}
                  data-testid={`menu-tile-${tile.id}`}
                  onClick={() => navigate(destination)}
                >
                  <span
                    className={[
                      "relative grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-[20px] transition-[background-color,transform] duration-200 group-hover:scale-[1.03] group-focus-visible:scale-[1.03] md:row-span-2 md:h-16 md:w-16 md:self-start lg:h-11 lg:w-11 lg:rounded-[16px]",
                      isDark ? "bg-[#3C2956] group-hover:bg-[#443061]" : "bg-[#F1E8FF] group-hover:bg-[#ECE0FF]",
                    ].join(" ")}
                  >
                    <VyvaIcon icon={Icon} accent={tile.iconAccent} size={27} strokeWidth={2.35} tone="brand" />
                  </span>
                  <span className="min-w-0 self-center md:self-start lg:w-full">
                    <span data-testid={`menu-tile-${tile.id}-title`} className="block font-display text-[20px] font-semibold leading-[1.03] tracking-[-0.025em] md:text-[24px] lg:truncate lg:text-[18px]">
                      {tile.id === "brain" ? t("home.master.cards.mindMemoryShortTitle", "Brain Power") : tile.title}
                    </span>
                    <span data-testid={`menu-tile-${tile.id}-detail`} className="sr-only">
                      {tile.detail}
                    </span>
                  </span>
                  <span className="hidden opacity-70 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 md:col-start-3 md:row-start-2 md:block md:self-end md:justify-self-end lg:hidden" aria-hidden="true">
                    <VyvaIcon icon={ArrowUpRight} size={20} strokeWidth={2.35} tone="muted" />
                  </span>
                </button>
              );
            })}
          </section>
        </div>
      </div>
    </main>
  );
}
