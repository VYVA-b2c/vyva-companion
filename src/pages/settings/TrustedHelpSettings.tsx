import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  BellRing,
  Car,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  LockKeyhole,
  PackageCheck,
  Plus,
  Shapes,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
  UserRound,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { Input } from "@/components/ui/input";
import {
  type ProviderCoverage,
  type TrustedHelpPartner,
  useTrustedHelpPartners,
} from "@/data/trustedHelpPartners";
import {
  TRUSTED_HELP_SERVICE_PRESENTATION_MAP,
  type TrustedHelpProviderSource,
  type TrustedHelpServiceId,
} from "@/design/conciergeTrustedHelpPresentationMap";
import {
  getTrustedHelpSetupTabs,
  getTrustedHelpStepDataAttributes,
  getTrustedHelpStepViewModel,
  type TrustedHelpSetupTab,
} from "@/design/trustedHelpFlowPresentation";
import { useLanguage } from "@/i18n";

type ServiceId = TrustedHelpServiceId;
type ProviderSource = TrustedHelpProviderSource;
type SetupTab = TrustedHelpSetupTab;
type HelpMode = "ask-first" | "prepare-only" | "family-approval" | "auto-repeat";
type PaymentMode = "provider-direct" | "saved-card" | "caregiver-approval";
type CaregiverPermission = "prepare" | "approve" | "order-essentials" | "manage-providers" | "payment-limits";
type StepScrollTarget = "subservices" | "provider";

type ServiceConfig = {
  id: ServiceId;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: {
    iconBg: string;
    iconColor: string;
    border: string;
  };
};

type TrustedProvider = {
  id: string;
  name: string;
  service: ServiceId;
  label: string;
  source: ProviderSource;
  method: string;
  payment: string;
  mode: string;
  limit: string;
  coverage?: ProviderCoverage[];
};

type Caregiver = {
  id: string;
  name: string;
  relationship: string;
  permissions: CaregiverPermission[];
  summary: string;
};

type SearchRuleOption = {
  id: string;
  label: string;
  detail: string;
};

type SearchRuleGroup = {
  id: string;
  title: string;
  options: SearchRuleOption[];
};

type SubServiceOption = {
  id: string;
  label: string;
  detail: string;
};

type SearchRuleSelections = Record<ServiceId, Record<string, string>>;
type SubServiceSelections = Record<ServiceId, string>;

const serviceVisuals: Record<ServiceId, Pick<ServiceConfig, "icon" | "tone">> = {
  groceries: {
    icon: ShoppingBasket,
    tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
  },
  "home-care": {
    icon: Wrench,
    tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
  },
  transport: {
    icon: Car,
    tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4" },
  },
  wellness: {
    icon: UserRound,
    tone: { iconBg: "#FDF2F8", iconColor: "#BE185D", border: "#FBCFE8" },
  },
  other: {
    icon: Shapes,
    tone: { iconBg: "#F8FAFC", iconColor: "#475569", border: "#CBD5E1" },
  },
};

const serviceOptions: ServiceConfig[] = TRUSTED_HELP_SERVICE_PRESENTATION_MAP.map((service) => ({
  id: service.serviceId,
  label: service.label,
  description: service.description,
  ...serviceVisuals[service.serviceId],
}));

const subServiceOptionsByService = TRUSTED_HELP_SERVICE_PRESENTATION_MAP.reduce(
  (optionsByService, service) => {
    optionsByService[service.serviceId] = service.subservices.map((subservice) => ({
      id: subservice.id,
      label: subservice.label,
      detail: subservice.userMeaning,
    }));
    return optionsByService;
  },
  {} as Record<ServiceId, SubServiceOption[]>,
);

const servicesWithRequiredType = new Set<ServiceId>(
  TRUSTED_HELP_SERVICE_PRESENTATION_MAP
    .filter((service) => service.requiresSubservice)
    .map((service) => service.serviceId),
);

const setupTabs = getTrustedHelpSetupTabs();

const TEST_RUN_SEEN_KEY = "vyva.trustedHelp.testRunSeen";

function shouldShowInitialTestRunModal() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TEST_RUN_SEEN_KEY) !== "true";
  } catch {
    return true;
  }
}

const sourceOptions: Array<{ id: ProviderSource; icon: LucideIcon; label: string; detail: string }> = [
  { id: "own", icon: Store, label: "My Provider", detail: "Use someone I already trust" },
  { id: "partner", icon: BadgeCheck, label: "VYVA Partner", detail: "Choose a verified partner" },
  { id: "vyva-find", icon: Search, label: "Let VYVA Find", detail: "VYVA searches and asks first" },
];

const modeOptions: Array<{ id: HelpMode; icon: LucideIcon; label: string; detail: string; guard: string }> = [
  {
    id: "ask-first",
    icon: BellRing,
    label: "Ask Me First",
    detail: "Default safety mode",
    guard: "VYVA prepares the next step and waits for the user.",
  },
  {
    id: "prepare-only",
    icon: Sparkles,
    label: "Prepare Only",
    detail: "Options, drafts, no action",
    guard: "No provider is contacted until someone confirms.",
  },
  {
    id: "family-approval",
    icon: UsersRound,
    label: "Family Approval",
    detail: "Caregiver confirms",
    guard: "The assigned caregiver approves bookings or payment.",
  },
  {
    id: "auto-repeat",
    icon: PackageCheck,
    label: "Auto Repeat",
    detail: "Essentials within limits",
    guard: "Only approved repeat essentials run automatically.",
  },
];

const paymentOptions: Array<{ id: PaymentMode; icon: LucideIcon; label: string; detail: string }> = [
  { id: "provider-direct", icon: CircleDollarSign, label: "Pay Provider", detail: "Pay at delivery or invoice" },
  { id: "saved-card", icon: CreditCard, label: "Saved Payment", detail: "Use card with limits" },
  { id: "caregiver-approval", icon: LockKeyhole, label: "Family Approves", detail: "Caregiver confirms payment" },
];

const searchRuleGroupsByService: Record<ServiceId, SearchRuleGroup[]> = {
  groceries: [
    {
      id: "store-range",
      title: "Store range",
      options: [
        { id: "nearby", label: "Nearby", detail: "Around 5 km" },
        { id: "wider", label: "Wider", detail: "Around 15 km" },
        { id: "online", label: "Online", detail: "Delivery apps ok" },
      ],
    },
    {
      id: "quality",
      title: "Quality",
      options: [
        { id: "fresh", label: "Fresh food", detail: "Produce first" },
        { id: "trusted-store", label: "Trusted store", detail: "Known retailer" },
        { id: "easy-returns", label: "Easy returns", detail: "Fix mistakes" },
      ],
    },
    {
      id: "substitutions",
      title: "Substitutions",
      options: [
        { id: "ask-first", label: "Ask first", detail: "No surprise swaps" },
        { id: "close-match", label: "Close match", detail: "Similar item ok" },
        { id: "no-swaps", label: "No swaps", detail: "Only exact items" },
      ],
    },
    {
      id: "fees",
      title: "Fees",
      options: [
        { id: "best-value", label: "Best value", detail: "Total cost" },
        { id: "low-fees", label: "Low fees", detail: "Fee limit first" },
        { id: "fast-delivery", label: "Fast delivery", detail: "Speed first" },
      ],
    },
  ],
  "home-care": [
    {
      id: "credentials",
      title: "Trust",
      options: [
        { id: "licensed", label: "Licensed", detail: "When needed" },
        { id: "insured", label: "Insured", detail: "Covered visit" },
        { id: "reviewed", label: "Reviewed", detail: "Strong reviews" },
      ],
    },
    {
      id: "timing",
      title: "Timing",
      options: [
        { id: "this-week", label: "This week", detail: "Soon enough" },
        { id: "urgent", label: "Urgent", detail: "Fast response" },
        { id: "flexible", label: "Flexible", detail: "Best match" },
      ],
    },
    {
      id: "quote",
      title: "Quote",
      options: [
        { id: "quote-first", label: "Quote first", detail: "Before visit" },
        { id: "fixed-price", label: "Fixed price", detail: "No surprise" },
        { id: "budget-first", label: "Budget first", detail: "Lower cost" },
      ],
    },
  ],
  transport: [
    {
      id: "ride-type",
      title: "Ride type",
      options: [
        { id: "taxi", label: "Taxi", detail: "Standard ride" },
        { id: "accessible", label: "Accessible", detail: "Mobility support" },
        { id: "assisted", label: "Assisted", detail: "Door help" },
      ],
    },
    {
      id: "pickup",
      title: "Pickup",
      options: [
        { id: "soon", label: "Soon", detail: "Fast pickup" },
        { id: "planned", label: "Planned", detail: "Set a time" },
        { id: "flexible", label: "Flexible", detail: "Best fare" },
      ],
    },
    {
      id: "driver",
      title: "Driver",
      options: [
        { id: "high-rated", label: "High rated", detail: "Reliable driver" },
        { id: "known-company", label: "Known fleet", detail: "Trusted company" },
        { id: "door-help", label: "Door help", detail: "Help to door" },
      ],
    },
  ],
  wellness: [
    {
      id: "service-type",
      title: "Service",
      options: subServiceOptionsByService.wellness,
    },
    {
      id: "location",
      title: "Place",
      options: [
        { id: "nearby", label: "Nearby", detail: "Short journey" },
        { id: "home-visit", label: "Home visit", detail: "Comes home" },
        { id: "online", label: "Online", detail: "If suitable" },
      ],
    },
    {
      id: "trust",
      title: "Trust",
      options: [
        { id: "senior-fit", label: "Senior fit", detail: "Older-adult friendly" },
        { id: "reviewed", label: "Reviewed", detail: "Strong reviews" },
        { id: "licensed", label: "Licensed", detail: "If required" },
      ],
    },
    {
      id: "budget",
      title: "Budget",
      options: [
        { id: "best-value", label: "Best value", detail: "Quality + price" },
        { id: "premium-ok", label: "Premium ok", detail: "If worth it" },
        { id: "low-cost", label: "Low cost", detail: "Budget first" },
      ],
    },
  ],
  other: [
    {
      id: "need",
      title: "Need",
      options: [
        { id: "describe", label: "Describe", detail: "Ask VYVA" },
        { id: "errand", label: "Errand", detail: "Practical task" },
        { id: "local-help", label: "Local help", detail: "Nearby support" },
      ],
    },
    {
      id: "source",
      title: "Source",
      options: [
        { id: "usual-first", label: "Usual first", detail: "Known provider" },
        { id: "trusted-search", label: "Trusted search", detail: "Verified options" },
        { id: "family-input", label: "Family input", detail: "Ask family" },
      ],
    },
    {
      id: "control",
      title: "Control",
      options: [
        { id: "ask-first", label: "Ask first", detail: "Confirm next step" },
        { id: "prepare-only", label: "Prepare only", detail: "No contact" },
        { id: "caregiver-ok", label: "Family ok", detail: "Caregiver approves" },
      ],
    },
  ],
};


const initialProviders: TrustedProvider[] = [
  {
    id: "provider-water",
    name: "AquaHome Water",
    service: "groceries",
    label: "Water delivery",
    source: "own",
    method: "WhatsApp",
    payment: "Family approves",
    mode: "Monthly repeat",
    limit: "40 EUR/order",
    coverage: ["Water"],
  },
];

const initialCaregivers: Caregiver[] = [
  {
    id: "rayan",
    name: "Rayan",
    relationship: "Son",
    permissions: ["prepare", "approve", "order-essentials"],
    summary: "Can order water up to the limit.",
  },
  {
    id: "ana",
    name: "Ana",
    relationship: "Caregiver",
    permissions: ["prepare"],
    summary: "Can prepare requests for review.",
  },
];

const permissionOptions: Array<{ id: CaregiverPermission; label: string; detail: string }> = [
  { id: "prepare", label: "Prepare", detail: "Can prepare a request" },
  { id: "approve", label: "Approve", detail: "Can approve booking or payment" },
  { id: "order-essentials", label: "Order Essentials", detail: "Water or groceries within limits" },
  { id: "manage-providers", label: "Manage Providers", detail: "Can add or edit trusted providers" },
  { id: "payment-limits", label: "Payment Limits", detail: "Can manage limits and payment rules" },
];

const providerDetailHintsByService: Record<ServiceId, { title: string; detail: string; items: string[] }> = {
  groceries: {
    title: "Shopping details",
    detail: "Useful for reliable orders.",
    items: ["Coverage", "Usual items", "Delivery window", "Substitutions"],
  },
  "home-care": {
    title: "Job details",
    detail: "Useful before VYVA requests a quote.",
    items: ["What needs fixing", "Urgency", "Access notes", "Quote first"],
  },
  transport: {
    title: "Ride details",
    detail: "Useful before VYVA prepares a ride.",
    items: ["Pickup place", "Time window", "Mobility needs", "Door help"],
  },
  wellness: {
    title: "Wellness details",
    detail: "Useful before VYVA compares wellness providers.",
    items: ["Service type", "Home or nearby", "Mobility needs", "Preferred person"],
  },
  other: {
    title: "Request details",
    detail: "Useful when the service does not fit a standard category.",
    items: ["What is needed", "Where", "Budget", "Who should approve"],
  },
};

function serviceFor(id: ServiceId) {
  return serviceOptions.find((service) => service.id === id) ?? serviceOptions[0];
}

function modeLabel(id: HelpMode) {
  return modeOptions.find((mode) => mode.id === id)?.label ?? "Ask Me First";
}

function paymentLabel(id: PaymentMode) {
  return paymentOptions.find((mode) => mode.id === id)?.label ?? "Pay Provider";
}

function sourceLabel(id: ProviderSource) {
  return sourceOptions.find((source) => source.id === id)?.label ?? "My Provider";
}

function optionLabel(options: Array<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

function subServiceFor(serviceId: ServiceId, subServiceId?: string) {
  const options = subServiceOptionsByService[serviceId];
  return options.find((option) => option.id === subServiceId) ?? options[0];
}

function serviceNeedsType(serviceId: ServiceId) {
  return servicesWithRequiredType.has(serviceId);
}

function defaultSubServiceSelections(): SubServiceSelections {
  return serviceOptions.reduce((selections, service) => {
    selections[service.id] = subServiceOptionsByService[service.id][0]?.id ?? "";
    return selections;
  }, {} as SubServiceSelections);
}

function defaultSearchRuleSelections(): SearchRuleSelections {
  return serviceOptions.reduce((serviceRules, service) => {
    serviceRules[service.id] = searchRuleGroupsByService[service.id].reduce<Record<string, string>>((groupRules, group) => {
      groupRules[group.id] = group.options[0]?.id ?? "";
      return groupRules;
    }, {});
    return serviceRules;
  }, {} as SearchRuleSelections);
}

function Card({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className={`rounded-[28px] border border-[#EFE4D5] bg-white p-4 shadow-[0_14px_34px_rgba(53,28,87,0.06)] sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  kicker,
  title,
  detail,
  showDetail = false,
}: {
  kicker: string;
  title: string;
  detail?: string;
  showDetail?: boolean;
}) {
  return (
    <div className="mb-4">
      <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">{kicker}</p>
      <h2 className="mt-1 font-body text-[24px] font-black leading-tight text-vyva-text-1">{title}</h2>
      {showDetail && detail ? <p className="mt-1 font-body text-[15px] font-semibold leading-snug text-vyva-text-2">{detail}</p> : null}
    </div>
  );
}

function CoverageChips({ coverage, testId }: { coverage?: ProviderCoverage[]; testId?: string }) {
  if (!coverage?.length) return null;

  return (
    <span className="mt-2 flex flex-wrap gap-1.5" data-testid={testId}>
      {coverage.map((item) => (
        <span key={item} className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-body text-[11px] font-black text-[#047857]">
          {item}
        </span>
      ))}
    </span>
  );
}

function SelectButton({
  active,
  children,
  onClick,
  testId,
  ariaLabel,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
      className={`vyva-tap min-h-[72px] rounded-[22px] border p-3 text-left transition ${
        active
          ? "border-vyva-purple bg-[#F6EEFF] shadow-[0_12px_24px_rgba(107,33,168,0.12)]"
          : "border-[#EFE4D5] bg-white hover:border-[#D9C8F2] hover:bg-[#FFFCF8]"
      }`}
    >
      {children}
    </button>
  );
}

function RuleButtonGroup({
  title,
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  title: string;
  options: SearchRuleOption[];
  value: string;
  onChange: (value: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div>
      <p className="mb-2 font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-2">{title}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`vyva-tap min-h-[62px] rounded-[18px] border px-3 py-2 text-left transition ${
                active ? "border-[#7C3AED] bg-[#F6EEFF]" : "border-[#EFE4D5] bg-white"
              }`}
              data-testid={`${testIdPrefix}-${option.id}`}
            >
              <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">{option.label}</span>
              <span className="sr-only">{option.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PartnerLogo({ partner }: { partner: TrustedHelpPartner }) {
  return (
    <span
      className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[18px] border bg-white shadow-sm"
      style={{ borderColor: partner.logo.border, background: partner.logo.bg, color: partner.logo.fg }}
      data-testid={`logo-trusted-help-partner-${partner.id}`}
      aria-hidden="true"
    >
      {partner.logo.imageUrl ? (
        <img src={partner.logo.imageUrl} alt="" className="h-full w-full object-contain p-2" />
      ) : (
        <span className="px-1 text-center font-body text-[14px] font-black leading-none tracking-[-0.01em]">
          {partner.logo.text}
        </span>
      )}
    </span>
  );
}

export default function TrustedHelpSettings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [partnerCatalog] = useTrustedHelpPartners();
  const [selectedService, setSelectedService] = useState<ServiceId>("groceries");
  const [selectedSource, setSelectedSource] = useState<ProviderSource>("own");
  const [activeTab, setActiveTab] = useState<SetupTab>("dashboard");
  const [selectedMode, setSelectedMode] = useState<HelpMode>("ask-first");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("caregiver-approval");
  const [providers, setProviders] = useState<TrustedProvider[]>(initialProviders);
  const [caregivers, setCaregivers] = useState<Caregiver[]>(initialCaregivers);
  const [providerFormOpen, setProviderFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [providerContact, setProviderContact] = useState("");
  const [spendLimit, setSpendLimit] = useState("40");
  const [setupSaved, setSetupSaved] = useState(false);
  const [testRunModalOpen, setTestRunModalOpen] = useState(() => shouldShowInitialTestRunModal());
  const [selectedSubServices, setSelectedSubServices] = useState<SubServiceSelections>(() => defaultSubServiceSelections());
  const [searchRuleSelections, setSearchRuleSelections] = useState<SearchRuleSelections>(() => defaultSearchRuleSelections());
  const [pendingScrollTarget, setPendingScrollTarget] = useState<StepScrollTarget | null>(null);
  const subservicesRef = useRef<HTMLDivElement | null>(null);
  const providerStepRef = useRef<HTMLDivElement | null>(null);
  const activeStepView = useMemo(() => getTrustedHelpStepViewModel(activeTab), [activeTab]);
  const activeStepDataAttributes = useMemo(() => getTrustedHelpStepDataAttributes(activeTab), [activeTab]);

  const service = serviceFor(selectedService);
  const ServiceIcon = service.icon;
  const selectedSubService = subServiceFor(selectedService, selectedSubServices[selectedService]);
  const activeSubServiceOptions = subServiceOptionsByService[selectedService];
  const selectedServiceNeedsType = serviceNeedsType(selectedService);
  const serviceTargetLabel = selectedServiceNeedsType ? selectedSubService.label : service.label;
  const availablePartners = partnerCatalog.filter((partner) => partner.enabled && partner.service === selectedService);
  const hasPartnersForService = availablePartners.length > 0;
  const visibleSourceOptions = sourceOptions.filter((source) => source.id !== "partner" || hasPartnersForService);
  const selectedProviders = providers.filter((provider) => provider.service === selectedService);
  const hasSavedProviderForService = selectedProviders.length > 0;
  const primaryCaregiver = caregivers.find((caregiver) => caregiver.permissions.includes("approve")) ?? caregivers[0];
  const providerDetailHint = providerDetailHintsByService[selectedService];
  const activeSearchRuleGroups = searchRuleGroupsByService[selectedService];
  const selectedSearchRules = searchRuleSelections[selectedService];
  const selectedSearchRuleLabels = activeSearchRuleGroups.map((group) =>
    optionLabel(group.options, selectedSearchRules[group.id] ?? group.options[0]?.id ?? ""),
  );
  const readyServiceCount = serviceOptions.filter((option) => providers.some((provider) => provider.service === option.id)).length;
  const repeatOrderCount = providers.filter((provider) => /repeat|order/i.test(`${provider.mode} ${provider.label}`)).length;
  const approvalProviderCount = providers.filter((provider) => /approve/i.test(provider.payment)).length;
  const dashboardStats = [
    {
      id: "providers",
      label: "Providers",
      value: providers.length,
      detail: "trusted saved",
      icon: Store,
      color: "#6B21A8",
      bg: "#F5F3FF",
    },
    {
      id: "orders",
      label: "Orders",
      value: repeatOrderCount,
      detail: "repeat set up",
      icon: PackageCheck,
      color: "#047857",
      bg: "#ECFDF5",
    },
    {
      id: "ready",
      label: "Ready",
      value: `${readyServiceCount}/${serviceOptions.length}`,
      detail: "services covered",
      icon: ShieldCheck,
      color: "#0F766E",
      bg: "#F0FDFA",
    },
    {
      id: "approvals",
      label: "Approvals",
      value: approvalProviderCount,
      detail: "family guarded",
      icon: UsersRound,
      color: "#B45309",
      bg: "#FFFBEB",
    },
  ];

  useEffect(() => {
    if (selectedSource === "partner" && !hasPartnersForService) {
      setSelectedSource("own");
    }
  }, [hasPartnersForService, selectedSource]);

  useEffect(() => {
    if (!pendingScrollTarget) return;

    const target = pendingScrollTarget === "subservices" ? subservicesRef.current : providerStepRef.current;
    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView?.({ behavior: "smooth", block: "start" });
      target.focus({ preventScroll: true });
      setPendingScrollTarget(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, pendingScrollTarget, selectedService, selectedSubService.id]);

  const firstTimeGuideLines = useMemo(() => {
    const provider = selectedSource === "own"
      ? selectedProviders[0]?.name ?? "the provider you add"
      : selectedSource === "partner"
        ? availablePartners[0]?.name ?? "a VYVA partner"
        : "trusted verified options";

    const providerLine = selectedSource === "vyva-find"
      ? `VYVA can search using your rules: ${selectedSearchRuleLabels.join(", ")}.`
      : `VYVA starts with ${provider} for ${serviceTargetLabel.toLowerCase()}.`;
    const approvalLine = selectedMode === "family-approval" || paymentMode === "caregiver-approval"
      ? `${primaryCaregiver?.name ?? "Family"} approves when money or booking is involved.`
      : selectedMode === "auto-repeat"
        ? `Auto-repeat stays inside your ${spendLimit || "40"} EUR/order limit.`
        : "You approve the next step before VYVA acts.";

    return [
      providerLine,
      "VYVA prepares options first; it does not contact, order, book, or pay yet.",
      approvalLine,
    ];
  }, [availablePartners, paymentMode, primaryCaregiver?.name, selectedMode, selectedProviders, selectedSearchRuleLabels, selectedSource, serviceTargetLabel, spendLimit]);

  const updateSearchRule = (groupId: string, optionId: string) => {
    setSearchRuleSelections((current) => ({
      ...current,
      [selectedService]: {
        ...current[selectedService],
        [groupId]: optionId,
      },
    }));
  };

  const addProvider = () => {
    const cleanName = providerName.trim();
    if (!cleanName) return;
    const entry: TrustedProvider = {
      id: `provider-${Date.now()}`,
      name: cleanName,
      service: selectedService,
      label: serviceTargetLabel,
      source: "own",
      method: providerContact.trim() ? providerContact.trim() : "Ask VYVA to confirm",
      payment: paymentLabel(paymentMode),
      mode: modeLabel(selectedMode),
      limit: `${spendLimit || "40"} EUR/order`,
      coverage: selectedService === "groceries" ? ["Food", "Household"] : undefined,
    };
    setProviders((current) => [entry, ...current]);
    setProviderName("");
    setProviderContact("");
    setProviderFormOpen(false);
    setSelectedSource("own");
  };

  const addPartner = (partner: TrustedHelpPartner) => {
    const entry: TrustedProvider = {
      id: `provider-${partner.id}-${Date.now()}`,
      name: partner.name,
      service: partner.service,
      label: partner.label,
      source: "partner",
      method: partner.method,
      payment: partner.payment,
      mode: modeLabel(selectedMode),
      limit: `${spendLimit || "40"} EUR/order`,
      coverage: partner.coverage,
    };
    setProviders((current) => [entry, ...current.filter((provider) => provider.name !== partner.name)]);
    setSelectedService(partner.service);
    setSelectedSource("partner");
  };

  const toggleCaregiverPermission = (caregiverId: string, permission: CaregiverPermission) => {
    setCaregivers((current) =>
      current.map((caregiver) => {
        if (caregiver.id !== caregiverId) return caregiver;
        const hasPermission = caregiver.permissions.includes(permission);
        return {
          ...caregiver,
          permissions: hasPermission
            ? caregiver.permissions.filter((entry) => entry !== permission)
            : [...caregiver.permissions, permission],
        };
      }),
    );
  };

  const addAnotherService = () => {
    setSetupSaved(false);
    setActiveTab("service");
    window.setTimeout(() => {
      document.querySelector<HTMLElement>("[data-testid='section-trusted-help-guide']")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const closeTestRunModal = () => {
    setTestRunModalOpen(false);
    try {
      window.localStorage.setItem(TEST_RUN_SEEN_KEY, "true");
    } catch {
      // Local storage can be unavailable in private or embedded contexts; closing the modal should still work.
    }
  };

  return (
    <PhoneFrame
      showBack
      onBack={() => navigate("/settings")}
      subtitle={t("settings.trustedHelp.navTitle", "Trusted Help")}
      className="max-w-[980px]"
      showCompanionMode={false}
    >
      <div
        className={`grid gap-5 ${activeStepView.bottomNavClearanceClassName}`}
        data-testid="trusted-help-settings"
        data-step-label={activeStepView.label}
        {...activeStepDataAttributes}
      >
        <ProfileSectionHero
          icon={ShieldCheck}
          kicker={t("settings.trustedHelp.kicker", "Concierge setup")}
          title={t("settings.trustedHelp.title", "My Trusted Help")}
          description={
            activeStepView.showHeadingDetail
              ? t(
                  "settings.trustedHelp.subtitle",
                  "Tell VYVA who to use, how to pay, and who in the family can approve practical help.",
                )
              : undefined
          }
          iconBgClassName="bg-[#0F766E]"
        />

        <div className="rounded-[24px] border border-[#EFE4D5] bg-white p-2 shadow-[0_12px_26px_rgba(53,28,87,0.05)]" data-testid="trusted-help-tabs">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
            {setupTabs.map((tab) => {
              const active = activeTab === tab.stepId;
              return (
                <button
                  key={tab.stepId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTab(tab.stepId)}
                  className={`vyva-tap min-h-[48px] rounded-[18px] px-2 font-body text-[13px] font-black transition sm:text-[15px] ${
                    active ? "bg-[#0F766E] text-white shadow-[0_10px_22px_rgba(15,118,110,0.16)]" : "bg-[#FFFCF8] text-vyva-text-2"
                  }`}
                  {...tab.dataAttributes}
                  data-testid={`button-trusted-help-tab-${tab.stepId}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "dashboard" ? (
          <div className="grid gap-5" data-testid="section-trusted-help-dashboard">
            <section className="rounded-[30px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_16px_34px_rgba(15,118,110,0.08)] sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
                    {t("settings.trustedHelp.dashboard.kicker", "Overview")}
                  </p>
                  <h2 className="mt-1 font-body text-[26px] font-black leading-tight text-vyva-text-1">
                    {t("settings.trustedHelp.dashboard.title", "Your trusted help")}
                  </h2>
                  {activeStepView.showHeadingDetail ? (
                    <p className="mt-1 max-w-[520px] font-body text-[15px] font-bold leading-snug text-vyva-text-2">
                      {t("settings.trustedHelp.dashboard.detail", "Providers, repeat orders, approvals, and limits in one place.")}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("service")}
                  className="vyva-primary-action min-h-[56px] px-5"
                  data-testid="button-trusted-help-dashboard-add-service"
                >
                  <Plus size={18} aria-hidden="true" />
                  {t("settings.trustedHelp.dashboard.addService", "Add service")}
                </button>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {dashboardStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <section
                    key={stat.id}
                    className="min-h-[150px] rounded-[26px] border border-[#EFE4D5] bg-white p-4 shadow-[0_12px_28px_rgba(53,28,87,0.06)]"
                    data-testid={`card-trusted-help-stat-${stat.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px]"
                        style={{ background: stat.bg, color: stat.color }}
                      >
                        <Icon size={23} aria-hidden="true" />
                      </span>
                      <span className="font-body text-[42px] font-black leading-none text-vyva-text-1">{stat.value}</span>
                    </div>
                    <h3 className="mt-4 font-body text-[18px] font-black leading-tight text-vyva-text-1">{stat.label}</h3>
                    <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">{stat.detail}</p>
                  </section>
                );
              })}
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <Card testId="section-trusted-help-dashboard-ready">
                <SectionHeader
                  kicker={t("settings.trustedHelp.dashboard.readyKicker", "Coverage")}
                  title={t("settings.trustedHelp.dashboard.readyTitle", "Ready services")}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {serviceOptions.map((option) => {
                    const readyProvider = providers.find((provider) => provider.service === option.id);
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSelectedService(option.id);
                          setSetupSaved(false);
                          setActiveTab(serviceNeedsType(option.id) ? "service" : "provider");
                        }}
                        className="vyva-tap flex min-h-[82px] items-center gap-3 rounded-[20px] border border-[#EFE4D5] bg-[#FFFCF8] p-3 text-left"
                        data-testid={`button-trusted-help-dashboard-service-${option.id}`}
                      >
                        <span
                          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px]"
                          style={{ background: option.tone.iconBg, color: option.tone.iconColor }}
                        >
                          <Icon size={21} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-body text-[16px] font-black leading-tight text-vyva-text-1">{option.label}</span>
                          <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 font-body text-[11px] font-black ${readyProvider ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FFF7ED] text-[#B45309]"}`}>
                            {readyProvider ? "Ready" : "Needs provider"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card testId="section-trusted-help-dashboard-providers">
                <SectionHeader
                  kicker={t("settings.trustedHelp.dashboard.providersKicker", "Saved")}
                  title={t("settings.trustedHelp.dashboard.providersTitle", "Trusted providers")}
                />
                <div className="grid gap-3">
                  {providers.slice(0, 3).map((provider) => {
                    const providerService = serviceFor(provider.service);
                    const Icon = providerService.icon;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => {
                          setSelectedService(provider.service);
                          setActiveTab("provider");
                        }}
                        className="vyva-tap flex min-h-[82px] items-center gap-3 rounded-[20px] border border-[#EFE4D5] bg-[#FFFCF8] p-3 text-left"
                        data-testid={`button-trusted-help-dashboard-provider-${provider.id}`}
                      >
                        <span
                          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px]"
                          style={{ background: providerService.tone.iconBg, color: providerService.tone.iconColor }}
                        >
                          <Icon size={21} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">{provider.name}</span>
                          <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">{provider.label} - {provider.limit}</span>
                          <CoverageChips coverage={provider.coverage} testId={`coverage-trusted-help-dashboard-provider-${provider.id}`} />
                        </span>
                        <ChevronRight size={18} className="flex-shrink-0 text-[#0F766E]" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        ) : null}

        {activeTab !== "dashboard" ? (
        <div
          className={`grid gap-5 lg:items-start ${
            activeTab === "provider" || activeTab === "controls" ? "lg:grid-cols-[1.12fr_0.88fr]" : ""
          }`}
        >
          <div className={`grid gap-5 ${activeTab === "service" ? "lg:col-span-2" : activeTab === "review" ? "hidden" : ""}`}>
            {activeTab === "service" ? (
            <Card testId="section-trusted-help-guide">
              <SectionHeader
                kicker={t("settings.trustedHelp.guide.kicker", "Guided setup")}
                title={t("settings.trustedHelp.guide.title", "What should VYVA help with?")}
                detail={
                  activeStepView.showHeadingDetail
                    ? t("settings.trustedHelp.guide.detail", "Choose one service. VYVA keeps the safest setup for each one.")
                    : undefined
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {serviceOptions.map((option) => {
                  const Icon = option.icon;
                  const active = selectedService === option.id;
                  return (
                    <SelectButton
                      key={option.id}
                      active={active}
                      onClick={() => {
                        setSelectedService(option.id);
                        setSetupSaved(false);
                        if (serviceNeedsType(option.id)) {
                          setPendingScrollTarget("subservices");
                        } else {
                          setActiveTab("provider");
                          setPendingScrollTarget("provider");
                        }
                      }}
                      testId={`button-trusted-help-service-${option.id}`}
                      ariaLabel={`${option.label}. ${option.description}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px]"
                          style={{ background: option.tone.iconBg, color: option.tone.iconColor }}
                        >
                          <Icon size={23} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-body text-[18px] font-black leading-tight text-vyva-text-1">{option.label}</span>
                          <span className="mt-1 block font-body text-[13px] font-bold leading-snug text-vyva-text-2">{option.description}</span>
                        </span>
                      </div>
                    </SelectButton>
                  );
                })}
              </div>
              {selectedServiceNeedsType ? (
              <div
                ref={subservicesRef}
                tabIndex={-1}
                className="mt-5 scroll-mt-4 rounded-[24px] border border-[#99F6E4] bg-[#F0FDFA] p-4 outline-none"
                data-testid="section-trusted-help-subservices"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]"
                    style={{ background: service.tone.iconBg, color: service.tone.iconColor }}
                  >
                    <ServiceIcon size={21} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                      {t("settings.trustedHelp.subservice.kicker", "Choose type")}
                    </p>
                    <h3 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                      {t("settings.trustedHelp.subservice.title", `${service.label} type`)}
                    </h3>
                    {activeStepView.showHeadingDetail ? (
                      <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                        {t("settings.trustedHelp.subservice.detail", "VYVA will use this to find the right provider.")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {activeSubServiceOptions.map((option) => {
                    const active = selectedSubService.id === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setSelectedSubServices((current) => ({
                            ...current,
                            [selectedService]: option.id,
                          }));
                          setSetupSaved(false);
                          setActiveTab("provider");
                          setPendingScrollTarget("provider");
                        }}
                        className={`vyva-tap min-h-[86px] rounded-[20px] border p-3 text-left transition ${
                          active ? "border-[#0F766E] bg-white shadow-[0_10px_22px_rgba(15,118,110,0.12)]" : "border-[#99F6E4] bg-white/75"
                        }`}
                        data-testid={`button-trusted-help-subservice-${selectedService}-${option.id}`}
                      >
                        <span className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">{option.label}</span>
                        <span className="sr-only">{option.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              ) : null}
            </Card>
            ) : null}

            {activeTab === "provider" ? (
            <div ref={providerStepRef} tabIndex={-1} className="scroll-mt-4 outline-none">
            <Card testId="section-trusted-help-provider-source">
              <SectionHeader
                kicker={t("settings.trustedHelp.source.kicker", "Provider")}
                title={t("settings.trustedHelp.source.title", `Who should VYVA use for ${serviceTargetLabel.toLowerCase()}?`)}
              />
              <div className="grid gap-3 md:grid-cols-3">
                {visibleSourceOptions.map((source) => {
                  const Icon = source.icon;
                  const showEmptyProviderNudge = source.id === "own" && !hasSavedProviderForService;
                  return (
                    <SelectButton
                      key={source.id}
                      active={selectedSource === source.id}
                      onClick={() => setSelectedSource(source.id)}
                      testId={`button-trusted-help-source-${source.id}`}
                    >
                      <Icon size={22} className="mb-3 text-vyva-purple" aria-hidden="true" />
                      <span className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">{source.label}</span>
                      <span className="mt-1 block font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                        {showEmptyProviderNudge
                          ? t("settings.trustedHelp.source.own.empty", "No saved provider yet")
                          : source.detail}
                      </span>
                      {showEmptyProviderNudge ? (
                        <span
                          className="mt-3 inline-flex rounded-full bg-white px-3 py-1 font-body text-[12px] font-black text-vyva-purple"
                          data-testid="label-trusted-help-source-own-empty"
                        >
                          {t("settings.trustedHelp.source.own.addHint", "Add provider")}
                        </span>
                      ) : null}
                    </SelectButton>
                  );
                })}
              </div>

              {selectedSource === "own" && !hasSavedProviderForService ? (
                <div
                  className="mt-4 flex flex-col gap-3 rounded-[18px] border border-[#DDD6FE] bg-[#F6EEFF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="nudge-trusted-help-empty-provider"
                >
                  <div>
                    <p className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                      {t("settings.trustedHelp.own.empty.title", `No ${serviceTargetLabel.toLowerCase()} provider saved yet`)}
                    </p>
                    <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                      {t("settings.trustedHelp.own.empty.detail", "Add someone trusted so VYVA knows who to try first.")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProviderFormOpen(true)}
                    className="vyva-secondary-action min-h-[48px] flex-shrink-0 px-4"
                    data-testid="button-trusted-help-empty-provider-add"
                  >
                    <Plus size={18} aria-hidden="true" />
                    {t("settings.trustedHelp.own.add", "Add provider")}
                  </button>
                </div>
              ) : null}

              <div
                className="mt-4 rounded-[22px] border border-[#EFE4D5] bg-white px-4 py-3"
                data-testid="panel-trusted-help-provider-details"
              >
                <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-2">
                  {t("settings.trustedHelp.details.kicker", "Details VYVA may need")}
                </p>
                <h3 className="mt-1 font-body text-[18px] font-black leading-tight text-vyva-text-1">{providerDetailHint.title}</h3>
                <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">{providerDetailHint.detail}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {providerDetailHint.items.map((item) => (
                    <span key={item} className="rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-black text-vyva-purple">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[24px] border border-[#EFE4D5] bg-[#FFFCF8] p-4">
                {selectedSource === "own" ? (
                  <div data-testid="panel-trusted-help-own-provider">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-body text-[20px] font-black text-vyva-text-1">{t("settings.trustedHelp.own.title", "Add your usual provider")}</h3>
                        <p className="mt-1 font-body text-[14px] font-semibold text-vyva-text-2">{t("settings.trustedHelp.own.detail", "A shop, taxi, cleaner, repair person, or wellness provider.")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProviderFormOpen((open) => !open)}
                        className="vyva-primary-action min-h-[52px] px-5"
                        data-testid="button-trusted-help-add-provider"
                      >
                        <Plus size={18} aria-hidden="true" />
                        {providerFormOpen ? t("common.cancel", "Cancel") : t("settings.trustedHelp.own.add", "Add provider")}
                      </button>
                    </div>
                    {providerFormOpen ? (
                      <div className="mt-4 grid gap-3 rounded-[22px] border border-[#DDD6FE] bg-white p-4" data-testid="form-trusted-help-provider">
                        <label className="grid gap-1">
                          <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-2">{t("settings.trustedHelp.own.name", "Provider name")}</span>
                          <Input value={providerName} onChange={(event) => setProviderName(event.target.value)} placeholder="AquaHome Water" />
                        </label>
                        <label className="grid gap-1">
                          <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-2">{t("settings.trustedHelp.own.contact", "Best contact method")}</span>
                          <Input value={providerContact} onChange={(event) => setProviderContact(event.target.value)} placeholder="Phone, WhatsApp, email, booking link" />
                        </label>
                        <button
                          type="button"
                          onClick={addProvider}
                          disabled={!providerName.trim()}
                          className="vyva-primary-action min-h-[54px] disabled:cursor-not-allowed disabled:opacity-55"
                          data-testid="button-trusted-help-save-provider"
                        >
                          <Check size={18} aria-hidden="true" />
                          {t("settings.trustedHelp.own.save", "Save trusted provider")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : selectedSource === "partner" && hasPartnersForService ? (
                  <div data-testid="panel-trusted-help-partners">
                    <h3 className="font-body text-[20px] font-black text-vyva-text-1">{t("settings.trustedHelp.partners.title", "VYVA partners")}</h3>
                    <div className="mt-3 grid gap-3">
                      {availablePartners.map((partner) => (
                        <button
                          key={partner.id}
                          type="button"
                          onClick={() => addPartner(partner)}
                          className="vyva-tap flex min-h-[86px] items-center gap-3 rounded-[20px] border border-[#D9F99D] bg-white p-3 text-left hover:bg-[#FCFFF4]"
                          data-testid={`button-trusted-help-partner-${partner.id}`}
                        >
                          <PartnerLogo partner={partner} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">{partner.name}</span>
                            <span className="mt-1 block font-body text-[13px] font-bold leading-snug text-vyva-text-2">{partner.label} - {partner.method}</span>
                            <CoverageChips coverage={partner.coverage} testId={`coverage-trusted-help-partner-${partner.id}`} />
                          </span>
                          <ChevronRight size={19} className="text-[#84CC16]" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4" data-testid="panel-trusted-help-vyva-find">
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
                        <Search size={22} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-body text-[20px] font-black text-vyva-text-1">{t("settings.trustedHelp.find.title", "Search rules")}</h3>
                        <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                          {t("settings.trustedHelp.find.detail", "VYVA compares options using these rules, then asks first.")}
                        </p>
                      </div>
                    </div>
                    {activeSearchRuleGroups.map((group) => (
                      <RuleButtonGroup
                        key={group.id}
                        title={group.title}
                        options={group.options}
                        value={selectedSearchRules[group.id] ?? group.options[0]?.id ?? ""}
                        onChange={(value) => updateSearchRule(group.id, value)}
                        testIdPrefix={`button-trusted-help-rule-${group.id}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>
            </div>
            ) : null}

            {activeTab === "controls" ? (
            <Card testId="section-trusted-help-mode">
              <SectionHeader
                kicker={t("settings.trustedHelp.mode.kicker", "Mode")}
                title={t("settings.trustedHelp.mode.title", "How much can VYVA do?")}
                detail={
                  activeStepView.showHeadingDetail
                    ? t("settings.trustedHelp.mode.detail", "The safest mode is always available. Auto-repeat is only for approved essentials.")
                    : undefined
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {modeOptions.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <SelectButton
                      key={mode.id}
                      active={selectedMode === mode.id}
                      onClick={() => setSelectedMode(mode.id)}
                      testId={`button-trusted-help-mode-${mode.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
                          <Icon size={21} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">{mode.label}</span>
                          <span className="mt-1 block font-body text-[13px] font-bold leading-snug text-vyva-text-2">{mode.detail}</span>
                          <span className="mt-2 block font-body text-[12px] font-black leading-snug text-[#0F766E]">{mode.guard}</span>
                        </span>
                      </div>
                    </SelectButton>
                  );
                })}
              </div>
            </Card>
            ) : null}
          </div>

          <div className={`grid gap-5 ${activeTab === "service" || activeTab === "review" ? "hidden" : ""}`}>
            {activeTab === "controls" ? (
            <Card testId="section-trusted-help-payment">
              <SectionHeader
                kicker={t("settings.trustedHelp.payment.kicker", "Payment")}
                title={t("settings.trustedHelp.payment.title", "Payment and limits")}
              />
              <div className="grid gap-3">
                {paymentOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectButton
                      key={option.id}
                      active={paymentMode === option.id}
                      onClick={() => setPaymentMode(option.id)}
                      testId={`button-trusted-help-payment-${option.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={22} className="text-vyva-purple" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block font-body text-[17px] font-black text-vyva-text-1">{option.label}</span>
                          <span className="block font-body text-[13px] font-bold text-vyva-text-2">{option.detail}</span>
                        </span>
                      </div>
                    </SelectButton>
                  );
                })}
              </div>
              <div className="mt-4 rounded-[22px] border border-[#EFE4D5] bg-[#FFFCF8] p-4">
                <button
                  type="button"
                  onClick={() => setPaymentOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  data-testid="button-trusted-help-manage-payment"
                >
                  <span>
                    <span className="block font-body text-[17px] font-black text-vyva-text-1">{t("settings.trustedHelp.payment.manage", "Manage payment method")}</span>
                    <span className="mt-1 block font-body text-[13px] font-bold text-vyva-text-2">{paymentMode === "saved-card" ? "Visa ending 4242" : "No automatic payment enabled"}</span>
                  </span>
                  <ChevronRight size={20} className={`text-vyva-purple transition ${paymentOpen ? "rotate-90" : ""}`} aria-hidden="true" />
                </button>
                {paymentOpen ? (
                  <div className="mt-4 grid gap-3" data-testid="panel-trusted-help-payment">
                    <label className="grid gap-1">
                      <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-2">{t("settings.trustedHelp.payment.limit", "Per order limit")}</span>
                      <Input value={spendLimit} onChange={(event) => setSpendLimit(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" />
                    </label>
                    <p className="rounded-[16px] bg-[#F5F3FF] px-3 py-3 font-body text-[13px] font-black leading-snug text-vyva-purple">
                      {t("settings.trustedHelp.payment.guard", "VYVA stops before checkout unless this service, provider, caregiver, and limit all allow it.")}
                    </p>
                  </div>
                ) : null}
              </div>
            </Card>
            ) : null}

            {activeTab === "provider" ? (
            <Card testId="section-trusted-help-providers">
              <SectionHeader
                kicker={t("settings.trustedHelp.providers.kicker", "Ready now")}
                title={t("settings.trustedHelp.providers.title", "Saved help")}
              />
              <div className="grid gap-3">
                {providers.slice(0, 4).map((provider) => {
                  const providerService = serviceFor(provider.service);
                  const Icon = providerService.icon;
                  return (
                    <article key={provider.id} className="rounded-[22px] border border-[#EFE4D5] bg-[#FFFCF8] p-4" data-testid={`card-trusted-provider-${provider.id}`}>
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px]"
                          style={{ background: providerService.tone.iconBg, color: providerService.tone.iconColor }}
                        >
                          <Icon size={22} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-body text-[18px] font-black leading-tight text-vyva-text-1">{provider.name}</h3>
                          <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">{provider.label} - {sourceLabel(provider.source)}</p>
                          <CoverageChips coverage={provider.coverage} testId={`coverage-trusted-provider-${provider.id}`} />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[provider.method, provider.payment, provider.mode, provider.limit].map((item) => (
                              <span key={item} className="rounded-full bg-white px-3 py-1 font-body text-[12px] font-black text-vyva-text-2">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </Card>
            ) : null}
          </div>
        </div>
        ) : null}

        {activeTab === "controls" ? (
        <Card testId="section-trusted-help-caregivers">
          <SectionHeader
            kicker={t("settings.trustedHelp.caregiver.kicker", "Family access")}
            title={t("settings.trustedHelp.caregiver.title", "Who can help manage this?")}
            detail={
              activeStepView.showHeadingDetail
                ? t("settings.trustedHelp.caregiver.detail", "Give caregivers clear task permissions, not vague admin access.")
                : undefined
            }
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {caregivers.map((caregiver) => (
              <article key={caregiver.id} className="rounded-[24px] border border-[#EFE4D5] bg-[#FFFCF8] p-4" data-testid={`card-trusted-help-caregiver-${caregiver.id}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
                    <UsersRound size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-body text-[19px] font-black leading-tight text-vyva-text-1">{caregiver.name}</h3>
                    <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">{caregiver.relationship} - {caregiver.summary}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {permissionOptions.map((permission) => {
                    const active = caregiver.permissions.includes(permission.id);
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleCaregiverPermission(caregiver.id, permission.id)}
                        className={`flex min-h-[58px] items-center gap-3 rounded-[18px] border px-3 py-2 text-left ${
                          active ? "border-[#99F6E4] bg-[#F0FDFA]" : "border-[#EFE4D5] bg-white"
                        }`}
                        data-testid={`button-caregiver-${caregiver.id}-${permission.id}`}
                      >
                        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${active ? "bg-[#0F766E] text-white" : "bg-[#F5F5F4] text-[#78716C]"}`}>
                          {active ? <Check size={16} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-body text-[15px] font-black text-vyva-text-1">{permission.label}</span>
                          <span className="block font-body text-[12px] font-bold text-vyva-text-2">{permission.detail}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </Card>
        ) : null}

        {activeTab === "review" ? (
        <Card className="border-[#DDD6FE] bg-[#FBF7FF]" testId="section-trusted-help-readiness">
          <SectionHeader
            kicker={t("settings.trustedHelp.readiness.kicker", "Service readiness")}
            title={t("settings.trustedHelp.readiness.title", "What is ready for VYVA?")}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {serviceOptions.map((option) => {
              const readyProvider = providers.find((provider) => provider.service === option.id);
              const Icon = option.icon;
              return (
                <div key={option.id} className="flex min-h-[92px] items-center gap-3 rounded-[20px] border border-white bg-white/85 p-3">
                  <span
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px]"
                    style={{ background: option.tone.iconBg, color: option.tone.iconColor }}
                  >
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-[16px] font-black text-vyva-text-1">{option.label}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 font-body text-[11px] font-black ${readyProvider ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FFF7ED] text-[#B45309]"}`}>
                      {readyProvider ? "Ready" : "Needs provider"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        ) : null}

        {activeTab === "review" ? (
        <section
          className="rounded-[28px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_16px_34px_rgba(15,118,110,0.08)]"
          data-testid="section-trusted-help-save"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
                {setupSaved ? t("settings.trustedHelp.save.savedKicker", "Saved") : t("settings.trustedHelp.save.kicker", "Finish setup")}
              </p>
              <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
                {setupSaved ? t("settings.trustedHelp.save.savedTitle", "Setup saved") : t("settings.trustedHelp.save.title", "Ready to save?")}
              </h2>
              {activeStepView.showHeadingDetail ? (
                <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                  {setupSaved
                    ? t("settings.trustedHelp.save.savedDetail", "You can add another service, or open Concierge.")
                    : t("settings.trustedHelp.save.detail", "VYVA will stay inside these providers, approvals, and limits.")}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:min-w-[220px]">
              <button
                type="button"
                onClick={() => setSetupSaved(true)}
                className="vyva-primary-action min-h-[58px] bg-[#0F766E] hover:bg-[#115E59]"
                data-testid="button-trusted-help-save-setup"
              >
                <Check size={18} aria-hidden="true" />
                {setupSaved ? t("settings.trustedHelp.save.savedButton", "Saved") : t("settings.trustedHelp.save.button", "Save setup")}
              </button>
              {setupSaved ? (
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={addAnotherService}
                    className="vyva-secondary-action min-h-[54px] border-[#99F6E4] bg-white text-[#0F766E]"
                    data-testid="button-trusted-help-add-another"
                  >
                    <Plus size={18} aria-hidden="true" />
                    {t("settings.trustedHelp.actions.addAnother", "Add another service")}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/concierge")}
                    className="vyva-secondary-action min-h-[54px] border-[#99F6E4] bg-white text-[#0F766E]"
                    data-testid="button-trusted-help-open-concierge"
                  >
                    <Sparkles size={18} aria-hidden="true" />
                    {t("settings.trustedHelp.actions.openConcierge", "Open Concierge")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
        ) : null}

        {activeTab === "review" && testRunModalOpen ? (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-[#1C1917]/45 px-4 py-5 sm:items-center"
            role="presentation"
            data-testid="modal-trusted-help-test-run"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="trusted-help-test-run-title"
              className="w-full max-w-[560px] rounded-[30px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_26px_70px_rgba(28,25,23,0.24)] sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[18px] bg-white shadow-sm"
                  style={{ color: service.tone.iconColor }}
                >
                  <ServiceIcon size={25} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#0F766E]">
                    {t("settings.trustedHelp.test.kicker", "New user guide")}
                  </p>
                  <h2 id="trusted-help-test-run-title" className="mt-1 font-body text-[24px] font-black leading-tight text-vyva-text-1">
                    {t("settings.trustedHelp.test.title", "You approve before VYVA acts")}
                  </h2>
                  <p className="mt-2 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                    {t("settings.trustedHelp.test.modalDetail", "This setup tells VYVA who it may use and what limits apply. It appears once for new users.")}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2" data-testid="trusted-help-test-run-copy">
                {firstTimeGuideLines.map((line) => (
                  <div key={line} className="flex gap-3 rounded-[18px] bg-white/85 px-3 py-3">
                    <Check size={18} className="mt-0.5 flex-shrink-0 text-[#047857]" aria-hidden="true" />
                    <p className="font-body text-[15px] font-black leading-snug text-vyva-text-1">{line}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={closeTestRunModal}
                className="vyva-primary-action mt-4 min-h-[56px] w-full bg-[#0F766E] hover:bg-[#115E59]"
                data-testid="button-trusted-help-modal-continue"
              >
                <Check size={18} aria-hidden="true" />
                {t("settings.trustedHelp.test.continue", "Continue to review")}
              </button>
            </section>
          </div>
        ) : null}
      </div>
    </PhoneFrame>
  );
}
