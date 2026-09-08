import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  Languages,
  LayoutGrid,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  UsersRound,
  Waypoints,
  X,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Copy,
  MessageSquare,
  Timer,
} from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import SocialStudioPanel from "./SocialStudioPanel";
import { apiFetch } from "@/lib/queryClient";

const CHANNELS = [
  "email",
  "whatsapp",
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
] as const;
const AUDIENCES = ["b2c", "b2b", "both"] as const;
const TABS = ["dashboard", "social-studio", "journeys", "content", "calendar", "contacts", "settings"] as const;
const CAMPAIGN_STATUSES = ["draft", "scheduled", "published", "paused", "archived"] as const;
const JOURNEY_STATUSES = ["draft", "active", "paused", "archived"] as const;
const CONTENT_STATUSES = [
  "draft",
  "review",
  "approved",
  "published",
  "archived",
] as const;
const CONSENT_STATUSES = [
  "unknown",
  "pending",
  "opted_in",
  "opted_out",
] as const;
const CAMPAIGN_PAGE_SIZE = 5;
const CONTENT_PAGE_SIZE = 10;
const MARKETING_FOUNDATION_BANNER_DISMISSED_KEY =
  "vyva.marketing.foundationBanner.dismissed";
const BULK_TRANSLATE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "pt", label: "Portuguese" },
];

type Channel = (typeof CHANNELS)[number];
type Audience = (typeof AUDIENCES)[number];
type Tab = (typeof TABS)[number];
type ContactView = "contacts" | "create" | "lists";
type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
type JourneyStatus = (typeof JOURNEY_STATUSES)[number];
type JourneyBuilderStage = 1 | 2 | 3 | 4 | 5;
type JourneyEntryRule = "manual" | "signup" | "list_joined" | "date";
type JourneyStopRule = "final_step" | "reply" | "click" | "activation";
type JourneyStepKind = "message" | "wait";
type WaitUnit = "hours" | "days" | "weeks";
type ContentStatus = (typeof CONTENT_STATUSES)[number];
type ConsentStatus = (typeof CONSENT_STATUSES)[number];
type CountOption = { value: string; label: string; count: number };

const MARKETING_BASE_PATH = "/admin/marketing";

function isMarketingTab(value: string): value is Tab {
  return TABS.includes(value as Tab);
}

function marketingTabFromPath(pathname: string): Tab {
  const normalized = pathname.replace(/\/+$/, "");
  const lastSegment = normalized.split("/").pop() ?? "";
  if (!lastSegment || lastSegment === "marketing") return "dashboard";
  return isMarketingTab(lastSegment) ? lastSegment : "dashboard";
}

function marketingTabPath(tab: Tab) {
  return tab === "dashboard"
    ? MARKETING_BASE_PATH
    : `${MARKETING_BASE_PATH}/${tab}`;
}

type MarketingSummary = {
  totals: {
    campaigns: number;
    journeys: number;
    content: number;
    mediaAssets?: number;
    contacts: number;
    audiences: number;
    journeyEnrollments?: number;
    thisWeek: number;
    scheduled: number;
    published: number;
  };
  analyticsTotals?: MarketingAnalyticsTotals;
  byChannel: Array<{ channel: Channel; campaigns: number; content: number }>;
  byAudience: Array<{
    audienceType: Audience;
    campaigns: number;
    contacts: number;
  }>;
  socialPublishing?: SocialPublishingStatus;
  lockedSendCapabilities: SendCapability[];
  emailScheduler?: EmailSchedulerStatus;
  latestSyncRun: SyncRun | null;
};

type MarketingAnalyticsTotals = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  replied: number;
  socialEngagement: number;
};

type SendCapability = {
  channel: Channel;
  sendCapability: string;
  locked: boolean;
  note: string;
};

type SocialPublishingProvider = {
  id: string;
  name: string;
  channels: Channel[];
  manualPublishingEnabled: boolean;
  directPublishingEnabled: boolean;
  connectionReady: boolean;
  connectionConfigured?: boolean;
  connections?: SocialPublishingConnection[];
};

type SocialPublishingConnection = {
  id: string;
  provider: string;
  accountId: string;
  accountName: string;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
  status: string;
  connectedAt: string;
  updatedAt: string;
};

type SocialPublishingStatus = {
  manualPublishingEnabled: boolean;
  directPublishingEnabled: boolean;
  providers: SocialPublishingProvider[];
};

type EmailSchedulerStatus = {
  enabled: boolean;
  intervalMinutes: number;
  initialDelaySeconds: number;
  actor: string;
};

type CampaignChannel = {
  id: string;
  channel: Channel;
  contentAssetId: string | null;
  scheduledAt: string | null;
  status: string;
  sendCapability: string;
};

type CampaignRecipient = {
  id: string;
  campaignId: string;
  contactId: string | null;
  profileId: string | null;
  channel: Channel;
  recipient: string;
  status: string;
  scheduledAt: string | null;
  snapshot: unknown;
  communicationLogId: string | null;
};

type ContentUsage = {
  key: string;
  kind: "campaign" | "journey";
  label: string;
  detail: string;
  channel: Channel;
  status: string;
  campaignId?: string;
  journeyId?: string;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  audienceType: Audience;
  objective: string;
  scheduleStartsAt: string | null;
  scheduleEndsAt: string | null;
  timezone: string;
  source: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
  channels: CampaignChannel[];
  recipientCount: number;
  recipients?: CampaignRecipient[];
};

type Journey = {
  id: string;
  name: string;
  status: string;
  audienceType: Audience;
  objective: string;
  triggerType: string | null;
  triggerConfig: Record<string, unknown>;
  goalType: string | null;
  goalConfig: Record<string, unknown>;
  exitOnGoal: boolean;
  source: string;
  lovableExternalId?: string | null;
  metadata?: Record<string, unknown>;
  steps: JourneyStep[];
};

type JourneyStep = {
  id: string;
  stepOrder: number;
  channel: Channel;
  contentAssetId: string | null;
  delayHours: number;
  kind: string;
  dayOffset: number;
  templateKind: string | null;
  templateRef: string | null;
  config?: Record<string, unknown>;
  status: string;
  metadata?: Record<string, unknown>;
};

type ContentAsset = {
  id: string;
  title: string;
  channel: Channel;
  language: string;
  status: string;
  subject: string | null;
  body: string;
  htmlBody?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  designJson?: Record<string, unknown>;
  mediaAssets?: unknown[];
  hasHtml?: boolean;
  hasDesign?: boolean;
  mediaAssetCount?: number;
  source: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const SOCIAL_CHANNELS = ["facebook", "instagram", "linkedin", "tiktok"] as const;

const SOCIAL_PLATFORM_URLS: Partial<Record<Channel, string>> = {
  facebook: "https://www.facebook.com/pages",
  instagram: "https://www.instagram.com/",
  linkedin: "https://www.linkedin.com/feed/",
  tiktok: "https://www.tiktok.com/upload",
};

function isSocialChannel(channel: Channel) {
  return (SOCIAL_CHANNELS as readonly Channel[]).includes(channel);
}

function socialPlainTextFromHtml(value?: string | null) {
  return (value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function socialPostText(asset: ContentAsset | null | undefined) {
  if (!asset) return "";
  const body = socialPlainTextFromHtml(asset.body || asset.htmlBody || "");
  const cta = asset.ctaUrl
    ? `${asset.ctaLabel || "Link"}: ${asset.ctaUrl}`
    : "";
  return [asset.subject || asset.title, body, cta].filter(Boolean).join("\n\n").trim();
}

type BulkTranslatePreviewItem = {
  sourceContentId: string;
  sourceTitle: string;
  targetLanguage: string;
  exists: boolean;
  aiSource?: string;
  note?: string | null;
  draft: {
    title: string;
    channel: Channel;
    language: string;
    status: string;
    subject: string | null;
    body: string;
    htmlBody: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
  };
  savedContent?: ContentAsset | null;
};

type BulkTranslateResponse = {
  ok: boolean;
  mode: "preview" | "save";
  translations: BulkTranslatePreviewItem[];
  savedContent?: ContentAsset[];
};

type MarketingMediaAsset = {
  id: string;
  contentAssetId: string | null;
  contentTitle?: string | null;
  source: string;
  assetType: string;
  originalUrl: string;
  localUrl: string | null;
  status: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
  lastSyncedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type MarketingCampaignMetric = MarketingAnalyticsTotals & {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  channel: string;
  metricDate: string | null;
  source: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
};

type CampaignMetricSummary = MarketingAnalyticsTotals & {
  metricCount: number;
  latestMetricDate: string | null;
  channels: string[];
};

type JourneyEnrollment = {
  id: string;
  journeyId: string;
  journeyName: string | null;
  contactId: string | null;
  contactExternalId: string | null;
  status: string;
  currentStepOrder: number;
  enteredAt: string | null;
  exitedAt: string | null;
  lastActivityAt: string | null;
  source: string;
  lovableExternalId: string | null;
  metadata?: Record<string, unknown>;
  events: Array<{
    id: string;
    eventType: string;
    stepOrder: number;
    eventAt: string | null;
    channel: string | null;
    metadata?: Record<string, unknown>;
  }>;
};

type TestEmailResponse = {
  ok?: boolean;
  communication?: {
    id: string;
    recipient: string;
    status: string;
  };
  delivery?: {
    id: string;
    status: string;
    recipient: string;
    error?: string;
  } | null;
};

type CampaignEmailSendResponse = {
  ok?: boolean;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  campaign?: Campaign;
  delivery?: Array<{
    id: string;
    status: string;
    recipient: string;
    error?: string;
  }>;
};

type DueCampaignEmailSendResponse = {
  ok?: boolean;
  dueCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  results?: Array<{
    campaignId: string;
    campaignName: string;
    ok: boolean;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    error?: string | null;
  }>;
};

type MarketingContact = {
  id: string;
  audienceType: Audience;
  profileId?: string | null;
  organizationId?: string | null;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  roleLabel: string | null;
  companyName: string | null;
  consentStatus: ConsentStatus;
  source: string;
  channelAvailability?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags: string[];
  language: string | null;
  category: string | null;
  vertical: string | null;
  market: string | null;
  lists: string[];
  lovableExternalId: string | null;
  lastSyncedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type MarketingAudience = {
  id: string;
  name: string;
  description: string | null;
  listType: string;
  rules: Record<string, unknown>;
  source: string;
  lovableExternalId: string | null;
  memberCount: number;
  mappedMemberCount: number;
  contactExternalIds: string[];
  memberPreview: Array<{
    id: string;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
    whatsappNumber: string | null;
    companyName: string | null;
    roleLabel: string | null;
    lovableExternalId: string | null;
    contactExternalId: string | null;
  }>;
  unmappedContactExternalIds: string[];
  lastSyncedAt: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type SyncRun = {
  id: string;
  provider: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  summary: Record<string, unknown>;
  error: string | null;
  createdBy: string | null;
  createdAt: string | null;
};

type LovableExportPreview = {
  ok: boolean;
  checkedAt: string;
  apiUrl: string | null;
  dataset: string;
  exportedAt: string | null;
  topLevelKeys: string[];
  summary: Record<string, unknown>;
  samples?: Record<string, unknown[]>;
  rawArraySamples?: Record<string, unknown[]>;
};

type SyncState = {
  provider: string;
  backendBuild?: string;
  configured: boolean;
  canRunSync: boolean;
  requiredRunnerEmail: string | null;
  apiUrl: string | null;
  mode: string;
  realSendingLocked: boolean;
  lockedSendCapabilities: SendCapability[];
  socialPublishing?: SocialPublishingStatus;
  emailScheduler?: EmailSchedulerStatus;
  diagnostics?: {
    apiUrlSource?: string;
    tokenSource?: string | null;
    urlAliasPresent?: Record<string, boolean>;
    tokenAliasPresent?: Record<string, boolean>;
    hasDefaultEndpoint?: boolean;
    hasBearerToken?: boolean;
  };
  runs: SyncRun[];
};

const normalizeSyncState = (
  state: SyncState | null | undefined,
): SyncState => ({
  ...emptySync,
  ...(state ?? {}),
  endpointDiagnostics: {
    ...emptySync.endpointDiagnostics,
    ...(state?.endpointDiagnostics ?? {}),
  },
  lockedSendCapabilities: Array.isArray(state?.lockedSendCapabilities)
    ? state.lockedSendCapabilities
    : emptySync.lockedSendCapabilities,
  socialPublishing: normalizeSocialPublishingStatus(state?.socialPublishing),
  runs: Array.isArray(state?.runs) ? state.runs : [],
});

type CampaignDraft = {
  name: string;
  audienceType: Audience;
  channel: Channel;
  contentAssetId: string;
  status: "draft" | "scheduled";
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  objective: string;
  targetAudienceId: string;
  recipientFilter: string;
  snapshotRecipients: boolean;
};

type CampaignEditDraft = {
  name: string;
  audienceType: Audience;
  channel: Channel;
  contentAssetId: string;
  status: CampaignStatus;
  scheduleStartsAt: string;
  scheduleEndsAt: string;
  timezone: string;
  objective: string;
  targetAudienceId: string;
  source: string;
  lovableExternalId: string;
  metadataText: string;
  recipientFilter: string;
  snapshotRecipients: boolean;
  channels: CampaignChannelDraft[];
};

type CampaignChannelDraft = {
  id: string;
  channel: Channel;
  contentAssetId: string;
  status: CampaignStatus;
  scheduledAt: string;
};

type JourneyEditDraft = {
  name: string;
  audienceType: Audience;
  status: JourneyStatus;
  objective: string;
  targetAudienceId: string;
  source: string;
  lovableExternalId: string;
  metadataText: string;
  triggerType: string;
  triggerConfigText: string;
  goalType: string;
  goalConfigText: string;
  exitOnGoal: boolean;
  steps: JourneyStepDraft[];
};

type JourneyStepDraft = {
  id: string;
  channel: Channel;
  contentAssetId: string;
  delayHours: string;
  kind: string;
  templateKind: string;
  templateRef: string;
  status: JourneyStatus;
  configText: string;
  notes: string;
};

const JOURNEY_BUILDER_STAGES: Array<{
  id: JourneyBuilderStage;
  label: string;
}> = [
  { id: 1, label: "Who enters?" },
  { id: 2, label: "When do they enter?" },
  { id: 3, label: "What happens?" },
  { id: 4, label: "When should it stop?" },
  { id: 5, label: "Review and save" },
];

type ContentDraft = {
  title: string;
  channel: Channel;
  language: string;
  status: ContentStatus;
  subject: string;
  body: string;
  htmlBody: string;
  ctaLabel: string;
  ctaUrl: string;
  designJsonText: string;
  mediaAssetsText: string;
};

type ContentEditDraft = {
  title: string;
  channel: Channel;
  language: string;
  status: ContentStatus;
  subject: string;
  body: string;
  htmlBody: string;
  ctaLabel: string;
  ctaUrl: string;
  source: string;
  lovableExternalId: string;
  designJsonText: string;
  mediaAssetsText: string;
  metadataText: string;
};

type MediaEditDraft = {
  contentAssetId: string;
  assetType: string;
  originalUrl: string;
  localUrl: string;
  status: string;
  source: string;
  lovableExternalId: string;
  metadataText: string;
};

type ContactDraft = {
  fullName: string;
  audienceType: Audience;
  email: string;
  phoneNumber: string;
  whatsappNumber: string;
  roleLabel: string;
  companyName: string;
  language: string;
  category: string;
  vertical: string;
  market: string;
  tags: string;
};

type ContactEditDraft = ContactDraft & {
  consentStatus: ConsentStatus;
  profileId: string;
  organizationId: string;
  source: string;
  lovableExternalId: string;
  channelAvailabilityText: string;
  metadataText: string;
};

type AudienceDraft = {
  name: string;
  listType: string;
  description: string;
  rulesText: string;
  contactExternalIds: string;
};

type AudienceEditDraft = AudienceDraft & {
  source: string;
  lovableExternalId: string;
  metadataText: string;
};

const emptySocialPublishing: SocialPublishingStatus = {
  manualPublishingEnabled: true,
  directPublishingEnabled: false,
  providers: [
    {
      id: "meta",
      name: "Meta",
      channels: ["facebook", "instagram"],
      manualPublishingEnabled: true,
      directPublishingEnabled: false,
      connectionReady: false,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      channels: ["linkedin"],
      manualPublishingEnabled: true,
      directPublishingEnabled: false,
      connectionReady: false,
    },
    {
      id: "tiktok",
      name: "TikTok",
      channels: ["tiktok"],
      manualPublishingEnabled: true,
      directPublishingEnabled: false,
      connectionReady: false,
    },
  ],
};

function normalizeSocialPublishingStatus(
  value?: SocialPublishingStatus | null,
): SocialPublishingStatus {
  const providers =
    Array.isArray(value?.providers) && value.providers.length
      ? value.providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          channels: Array.isArray(provider.channels)
            ? provider.channels.filter((channel): channel is Channel =>
                CHANNELS.includes(channel as Channel),
              )
            : [],
          manualPublishingEnabled: Boolean(provider.manualPublishingEnabled),
          directPublishingEnabled: Boolean(provider.directPublishingEnabled),
          connectionReady: Boolean(provider.connectionReady),
          connectionConfigured: Boolean(provider.connectionConfigured),
          connections: Array.isArray(provider.connections)
            ? provider.connections
            : [],
        }))
      : emptySocialPublishing.providers;

  return {
    manualPublishingEnabled: value?.manualPublishingEnabled ?? true,
    directPublishingEnabled: value?.directPublishingEnabled ?? false,
    providers,
  };
}

const emptySummary: MarketingSummary = {
  totals: {
    campaigns: 0,
    journeys: 0,
    content: 0,
    mediaAssets: 0,
    contacts: 0,
    audiences: 0,
    journeyEnrollments: 0,
    thisWeek: 0,
    scheduled: 0,
    published: 0,
  },
  analyticsTotals: {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    replied: 0,
    socialEngagement: 0,
  },
  byChannel: CHANNELS.map((channel) => ({ channel, campaigns: 0, content: 0 })),
  byAudience: AUDIENCES.map((audienceType) => ({
    audienceType,
    campaigns: 0,
    contacts: 0,
  })),
  socialPublishing: emptySocialPublishing,
  lockedSendCapabilities: CHANNELS.map((channel) => ({
    channel,
    sendCapability:
      channel === "email"
        ? "enabled"
        : channel === "whatsapp"
          ? "future_send_capable"
          : "planning_only",
    locked: channel !== "email",
    note:
      channel === "email"
        ? "Email sends use VYVA communications."
        : "Marketing sends are locked in this foundation.",
  })),
  emailScheduler: {
    enabled: false,
    intervalMinutes: 5,
    initialDelaySeconds: 30,
    actor: "marketing-email-scheduler",
  },
  latestSyncRun: null,
};

const emptySync: SyncState = {
  provider: "lovable",
  configured: false,
  canRunSync: false,
  requiredRunnerEmail: null,
  apiUrl: null,
  mode: "one_way_into_vyva",
  realSendingLocked: false,
  lockedSendCapabilities: emptySummary.lockedSendCapabilities,
  socialPublishing: emptySocialPublishing,
  emailScheduler: emptySummary.emailScheduler,
  runs: [],
};

const MARKETING_SYNC_ENDPOINT = "/api/admin/marketing/sync/source";

const channelLabel: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

const tabLabel: Record<Tab, string> = {
  dashboard: "Dashboard",
  "social-studio": "Social Studio",
  journeys: "Journeys",
  content: "Content",
  calendar: "Calendar",
  contacts: "Contacts",
  settings: "Settings",
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isDateThisWeek(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function formatCalendarDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatCalendarTime(value: string | null) {
  if (!value) return "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function recordTimelineParts(record: {
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSyncedAt?: string | null;
}) {
  const parts: string[] = [];
  if (record.updatedAt) parts.push(`Updated ${formatDate(record.updatedAt)}`);
  if (record.lastSyncedAt)
    parts.push(`Synced ${formatDate(record.lastSyncedAt)}`);
  if (!record.updatedAt && !record.lastSyncedAt && record.createdAt)
    parts.push(`Created ${formatDate(record.createdAt)}`);
  return parts;
}

function calendarDayKey(value: string | null) {
  if (!value) return "unscheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unscheduled";
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).toISOString();
}

function statusClass(status: string) {
  if (["published", "active", "succeeded", "opted_in"].includes(status))
    return "bg-emerald-50 text-emerald-700";
  if (["scheduled", "running", "pending", "review"].includes(status))
    return "bg-sky-50 text-sky-700";
  if (["failed", "opted_out"].includes(status)) return "bg-red-50 text-red-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-800";
}

function channelClass(channel: Channel) {
  if (channel === "whatsapp")
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (channel === "email") return "bg-blue-50 text-blue-700 border-blue-100";
  if (channel === "instagram" || channel === "tiktok")
    return "bg-pink-50 text-pink-700 border-pink-100";
  if (channel === "linkedin" || channel === "facebook")
    return "bg-sky-50 text-sky-700 border-sky-100";
  return "bg-purple-50 text-purple-700 border-purple-100";
}

function lower(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function lookupKeysForExternalId(
  value: string | null | undefined,
  prefixes: string[] = [],
) {
  const normalized = lower(value);
  if (!normalized) return [];
  const keys = new Set([normalized]);
  const [, suffix] = normalized.includes(":")
    ? normalized.split(/:(.+)/)
    : ["", ""];
  if (suffix) keys.add(suffix);
  const base = suffix || normalized;
  for (const prefix of prefixes) {
    keys.add(`${prefix}:${base}`);
  }
  return Array.from(keys);
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function contactAudienceMemberId(contact: MarketingContact) {
  return contact.lovableExternalId || contact.id;
}

function parseAudienceMemberIds(
  draft: Pick<AudienceDraft, "contactExternalIds"> | null | undefined,
) {
  return splitLines(draft?.contactExternalIds ?? "");
}

function updateAudienceDraftMemberIds<T extends AudienceDraft>(
  draft: T,
  ids: string[],
): T {
  return {
    ...draft,
    contactExternalIds: Array.from(
      new Set(ids.map((id) => id.trim()).filter(Boolean)),
    ).join("\n"),
  };
}

function audienceContactLabel(contact: MarketingContact) {
  const name =
    contact.fullName ||
    contact.email ||
    contact.phoneNumber ||
    contact.whatsappNumber ||
    "Unnamed contact";
  const details = [contact.email, contact.companyName, contact.roleLabel]
    .filter(Boolean)
    .join(" - ");
  return details ? `${name} (${details})` : name;
}

function audienceContactExternalId(
  contact: MarketingContact,
  memberIds: string[],
) {
  const candidates = [contact.lovableExternalId, contact.id]
    .map((id) => lower(id))
    .filter(Boolean);
  return (
    memberIds.find((id) => candidates.includes(lower(id))) ??
    contact.lovableExternalId ??
    contact.id
  );
}

function contactMatchesMemberIds(
  contact: MarketingContact,
  memberIds: string[],
) {
  const contactIds = [contact.id, contact.lovableExternalId]
    .map((id) => lower(id))
    .filter(Boolean);
  return memberIds.some((id) => contactIds.includes(lower(id)));
}

function groupCount<T>(
  items: T[],
  keyForItem: (item: T) => string | null | undefined,
) {
  const result = new Map<string, number>();
  for (const item of items) {
    const key = keyForItem(item);
    if (!key) continue;
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function parseRulesText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as Record<string, unknown>;
}

function normalizeCampaignStatus(value: string): CampaignStatus {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus)
    ? (value as CampaignStatus)
    : "draft";
}

function normalizeJourneyStatus(value: string): JourneyStatus {
  return JOURNEY_STATUSES.includes(value as JourneyStatus)
    ? (value as JourneyStatus)
    : "draft";
}

function normalizeContentStatus(value: string): ContentStatus {
  return CONTENT_STATUSES.includes(value as ContentStatus)
    ? (value as ContentStatus)
    : "draft";
}

function jsonText(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length === 0
  )
    return "";
  return JSON.stringify(value, null, 2);
}

function jsonArrayText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "";
  return JSON.stringify(value, null, 2);
}

function designShapeSummary(value: unknown) {
  const record = recordValue(value);
  const topLevelKeys = Object.keys(record);
  const arrayKeys = [
    "blocks",
    "sections",
    "elements",
    "nodes",
    "components",
    "rows",
  ]
    .map((key) => ({
      key,
      count: Array.isArray(record[key]) ? (record[key] as unknown[]).length : 0,
    }))
    .filter((item) => item.count > 0);
  return { topLevelKeys, arrayKeys };
}

function mediaUrlFrom(value: unknown) {
  if (typeof value === "string") return value;
  const record = recordValue(value);
  for (const key of [
    "url",
    "originalUrl",
    "original_url",
    "src",
    "href",
    "assetUrl",
    "asset_url",
    "imageUrl",
    "image_url",
  ]) {
    const url = record[key];
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return "";
}

function contentMediaPreviewUrls(
  content: ContentAsset,
  linkedAssets: MarketingMediaAsset[],
) {
  const embedded = Array.isArray(content.mediaAssets)
    ? content.mediaAssets.map(mediaUrlFrom)
    : [];
  const linked = linkedAssets.flatMap((asset) => [
    asset.originalUrl,
    asset.localUrl ?? "",
  ]);
  return Array.from(
    new Set([...embedded, ...linked].map((url) => url.trim()).filter(Boolean)),
  );
}

function isPreviewableImageUrl(url: string) {
  return (
    /^data:image\//i.test(url) ||
    /\.(png|jpe?g|gif|webp|avif|svg)(?:[?#].*)?$/i.test(url)
  );
}

function isPreviewableVideoUrl(url: string) {
  return (
    /^data:video\//i.test(url) ||
    /\.(mp4|webm|ogg|mov|m4v)(?:[?#].*)?$/i.test(url)
  );
}

function mediaPreviewLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname;
  } catch {
    return url;
  }
}

const designPreviewArrayKeys = [
  "blocks",
  "sections",
  "elements",
  "nodes",
  "components",
  "rows",
  "children",
  "items",
] as const;
const designPreviewObjectKeys = [
  "content",
  "props",
  "settings",
  "data",
  "attributes",
  "style",
  "styles",
] as const;
const designPreviewTitleKeys = [
  "headline",
  "heading",
  "title",
  "subject",
  "name",
  "label",
] as const;
const designPreviewBodyKeys = [
  "body",
  "copy",
  "text",
  "description",
  "caption",
  "message",
  "content",
  "plainText",
  "plain_text",
  "subtitle",
] as const;
const designPreviewCtaLabelKeys = [
  "ctaLabel",
  "cta_label",
  "buttonText",
  "button_text",
  "buttonLabel",
  "button_label",
  "linkText",
  "link_text",
] as const;
const designPreviewCtaUrlKeys = [
  "ctaUrl",
  "cta_url",
  "buttonUrl",
  "button_url",
  "linkUrl",
  "link_url",
  "href",
  "url",
] as const;
const designPreviewMediaKeys = [
  "imageUrl",
  "image_url",
  "src",
  "assetUrl",
  "asset_url",
  "mediaUrl",
  "media_url",
  "videoUrl",
  "video_url",
  "thumbnailUrl",
  "thumbnail_url",
  "coverImageUrl",
  "cover_image_url",
] as const;

type DesignPreviewBlock = {
  key: string;
  type: string;
  title: string;
  body: string;
  mediaUrl: string;
  ctaLabel: string;
  ctaUrl: string;
};

function parsedDesignValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function designRecordText(
  record: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = parsedDesignValue(record[key]);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
  }
  return "";
}

function designRecordMediaUrl(record: Record<string, unknown>) {
  for (const key of designPreviewMediaKeys) {
    const value = parsedDesignValue(record[key]);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = mediaUrlFrom(value);
      if (nested) return nested;
    }
  }
  return "";
}

function collectDesignPreviewBlocks(
  value: unknown,
  path = "design",
  seen = new Set<unknown>(),
): DesignPreviewBlock[] {
  const parsed = parsedDesignValue(value);
  if (!parsed || typeof parsed !== "object") return [];
  if (seen.has(parsed)) return [];
  seen.add(parsed);

  if (Array.isArray(parsed)) {
    return parsed.flatMap((item, index) =>
      collectDesignPreviewBlocks(item, `${path}.${index}`, seen),
    );
  }

  const record = parsed as Record<string, unknown>;
  const title = designRecordText(record, designPreviewTitleKeys);
  const body = designRecordText(record, designPreviewBodyKeys);
  const mediaUrl = designRecordMediaUrl(record);
  const ctaLabel = designRecordText(record, designPreviewCtaLabelKeys);
  const ctaUrl = designRecordText(record, designPreviewCtaUrlKeys);
  const type =
    designRecordText(record, [
      "type",
      "kind",
      "component",
      "blockType",
      "block_type",
    ]) || "Block";
  const current =
    title || body || mediaUrl || ctaLabel || ctaUrl
      ? [{ key: path, type, title, body, mediaUrl, ctaLabel, ctaUrl }]
      : [];
  const children = [
    ...designPreviewArrayKeys.flatMap((key) =>
      collectDesignPreviewBlocks(record[key], `${path}.${key}`, seen),
    ),
    ...designPreviewObjectKeys.flatMap((key) =>
      collectDesignPreviewBlocks(record[key], `${path}.${key}`, seen),
    ),
  ];
  return [...current, ...children];
}

const lovableContentSourceLabels: Record<string, string> = {
  content: "Content",
  content_asset: "Content asset",
  saved_email_template: "Saved email template",
  template: "Template",
  content_brief: "Content brief",
  journey_step_preset: "Journey step preset",
  social_post: "Social post",
  missing_lovable_reference: "Missing Lovable reference",
};

function metadataString(value: unknown, key: string) {
  const item = recordValue(value)[key];
  return typeof item === "string" && item.trim() ? item.trim() : "";
}

function contentOriginKey(item: ContentAsset) {
  const sourceType = metadataString(item.metadata, "lovable_source_type");
  if (sourceType) return sourceType;
  return item.source || "vyva";
}

function isMissingLovableContentAsset(item: ContentAsset) {
  return contentOriginKey(item) === "missing_lovable_reference";
}

function isSelectableCampaignContent(item: ContentAsset) {
  return item.status !== "archived" && !isMissingLovableContentAsset(item);
}

function contentSourceLabel(key: string) {
  if (key === "vyva") return "VYVA";
  if (key === "lovable") return "Lovable content";
  return lovableContentSourceLabels[key] ?? key.replace(/_/g, " ");
}

function contentOriginLabel(item: ContentAsset) {
  const sourceType = contentOriginKey(item);
  if (sourceType) return contentSourceLabel(sourceType);
  if (item.source === "lovable") return "Lovable content";
  return item.source;
}

const lovableContentSourceDetailKeys = [
  "id",
  "title",
  "name",
  "templateName",
  "template_name",
  "subject",
  "subjectLine",
  "subject_line",
  "channel",
  "platform",
  "network",
  "language",
  "locale",
  "status",
  "audienceType",
  "audience_type",
  "campaignId",
  "campaign_id",
  "journeyId",
  "journey_id",
  "templateKind",
  "template_kind",
  "tags",
  "hashtags",
  "category",
  "updatedAt",
  "updated_at",
  "createdAt",
  "created_at",
] as const;

function humanizeMetadataKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (match) => match.toUpperCase());
}

function sourceDetailParsedValue(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function sourceDetailText(value: unknown) {
  const parsed = sourceDetailParsedValue(value);
  if (parsed === null || parsed === undefined) return "";
  if (typeof parsed === "string") return parsed.trim();
  if (typeof parsed === "number" || typeof parsed === "boolean")
    return String(parsed);
  if (Array.isArray(parsed)) {
    const values = parsed.map((item) => sourceDetailText(item)).filter(Boolean);
    return values.length ? values.slice(0, 8).join(", ") : "";
  }
  return "";
}

function sourceDetailDisplayValue(key: string, value: unknown) {
  const text = sourceDetailText(value);
  if (!text) return "";
  if (
    /(^|_|\b)(created|updated|scheduled|published|sent|date|at)(_|$|\b)/i.test(
      key,
    )
  ) {
    const formatted = formatDate(text);
    if (formatted !== "Unknown" && formatted !== "Not scheduled")
      return formatted;
  }
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function lovableContentSourceDetails(content: ContentAsset) {
  const metadata = recordValue(content.metadata);
  const lovable = recordValue(metadata.lovable);
  if (content.source !== "lovable" && Object.keys(lovable).length === 0)
    return [];
  const rows = new Map<string, string>();
  if (content.lovableExternalId)
    rows.set("Lovable ID", content.lovableExternalId);
  rows.set("Source type", contentOriginLabel(content));
  if (content.updatedAt)
    rows.set("VYVA updated", formatDate(content.updatedAt));
  if (content.createdAt)
    rows.set("VYVA created", formatDate(content.createdAt));
  for (const key of lovableContentSourceDetailKeys) {
    const value = sourceDetailDisplayValue(key, lovable[key]);
    if (value) rows.set(humanizeMetadataKey(key), value);
  }
  return Array.from(rows, ([label, value]) => ({ label, value }));
}

function contentAssetByReference(
  content: ContentAsset[],
  reference?: string | null,
) {
  const normalized = lower(reference);
  if (!normalized) return null;
  return (
    content.find((item) =>
      [
        item.id,
        item.lovableExternalId ?? "",
        `content:${item.lovableExternalId ?? ""}`,
        `content_asset:${item.lovableExternalId ?? ""}`,
        `saved_email_template:${item.lovableExternalId ?? ""}`,
        `social_post:${item.lovableExternalId ?? ""}`,
        `template:${item.lovableExternalId ?? ""}`,
        `content_brief:${item.lovableExternalId ?? ""}`,
      ].some((candidate) => lower(candidate) === normalized),
    ) ?? null
  );
}

function contentReferenceKeys(content: ContentAsset) {
  const keys = new Set<string>();
  const prefixes = [
    "content",
    "content_asset",
    "saved_email_template",
    "social_post",
    "template",
    "content_brief",
    "journey_step_preset",
  ];
  for (const value of [content.id, content.lovableExternalId]) {
    for (const key of lookupKeysForExternalId(value, prefixes)) keys.add(key);
  }
  return keys;
}

function contentReferenceMatches(
  content: ContentAsset,
  reference?: string | null,
) {
  const normalized = lower(reference);
  if (!normalized) return false;
  const keys = contentReferenceKeys(content);
  if (keys.has(normalized)) return true;
  const [, suffix] = normalized.includes(":")
    ? normalized.split(/:(.+)/)
    : ["", ""];
  return Boolean(suffix && keys.has(suffix));
}

function contentUsageFor(
  content: ContentAsset,
  campaigns: Campaign[],
  journeys: Journey[],
): ContentUsage[] {
  const usages: ContentUsage[] = [];
  const seen = new Set<string>();
  for (const campaign of campaigns) {
    for (const channel of campaign.channels ?? []) {
      if (!contentReferenceMatches(content, channel.contentAssetId)) continue;
      const key = `campaign:${campaign.id}:${channel.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      usages.push({
        key,
        kind: "campaign",
        campaignId: campaign.id,
        label: campaign.name,
        detail: `${channelLabel[channel.channel]} campaign channel${channel.scheduledAt ? ` / ${formatDate(channel.scheduledAt)}` : ""}`,
        channel: channel.channel,
        status: channel.status || campaign.status,
      });
    }
  }
  for (const journey of journeys) {
    for (const step of journey.steps ?? []) {
      if (
        !contentReferenceMatches(content, step.contentAssetId) &&
        !contentReferenceMatches(content, step.templateRef)
      )
        continue;
      const key = `journey:${journey.id}:${step.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      usages.push({
        key,
        kind: "journey",
        journeyId: journey.id,
        label: journey.name,
        detail: `Step ${step.stepOrder + 1}: ${step.kind || "message"} / ${channelLabel[step.channel]} / day ${step.dayOffset}`,
        channel: step.channel,
        status: step.status || journey.status,
      });
    }
  }
  return usages;
}

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newCampaignChannelDraft(
  channel: Channel = "email",
  status: CampaignStatus = "draft",
  scheduledAt = "",
): CampaignChannelDraft {
  return {
    id: newDraftId(),
    channel,
    contentAssetId: "",
    status,
    scheduledAt,
  };
}

function emptyCampaignDraft(): CampaignDraft {
  return {
    name: "",
    audienceType: "b2c",
    channel: "email",
    contentAssetId: "",
    status: "draft",
    scheduleStartsAt: "",
    scheduleEndsAt: "",
    objective: "",
    targetAudienceId: "",
    recipientFilter: "",
    snapshotRecipients: false,
  };
}

function emptyContentDraft(): ContentDraft {
  return {
    title: "",
    channel: "email",
    language: "en",
    status: "draft",
    subject: "",
    body: "",
    htmlBody: "",
    ctaLabel: "",
    ctaUrl: "",
    designJsonText: "{}",
    mediaAssetsText: "[]",
  };
}

function campaignChannelDraftFromChannel(
  channel: CampaignChannel,
  fallbackStatus: CampaignStatus,
  fallbackSchedule: string,
): CampaignChannelDraft {
  return {
    id: channel.id || newDraftId(),
    channel: channel.channel,
    contentAssetId: channel.contentAssetId ?? "",
    status: normalizeCampaignStatus(channel.status || fallbackStatus),
    scheduledAt: toDateTimeLocal(channel.scheduledAt) || fallbackSchedule,
  };
}

function audienceReferencesFromRecord(value: unknown) {
  const record = recordValue(value);
  const refs: string[] = [];
  for (const key of [
    "targetAudienceId",
    "audienceId",
    "audienceListId",
    "listId",
    "lovableAudienceId",
    "audienceExternalId",
    "audience_external_id",
  ]) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) refs.push(item.trim());
  }
  for (const key of [
    "audienceExternalIds",
    "audience_external_ids",
    "audienceIds",
    "audience_ids",
    "audiences",
    "lists",
    "contactLists",
    "contact_lists",
  ]) {
    const item = record[key];
    if (Array.isArray(item)) {
      refs.push(
        ...item
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter(Boolean),
      );
    }
  }
  for (const key of ["targetAudience", "audienceList", "audience", "list"]) {
    const nested = recordValue(record[key]);
    for (const nestedKey of [
      "id",
      "lovableExternalId",
      "lovable_external_id",
      "externalId",
      "external_id",
      "name",
    ]) {
      const item = nested[nestedKey];
      if (typeof item === "string" && item.trim()) refs.push(item.trim());
    }
  }
  const list = record.list;
  if (typeof list === "string" && list.trim()) refs.push(list.trim());
  return Array.from(new Set(refs));
}

function campaignTargetAudience(
  campaign: Campaign,
  audiences: MarketingAudience[],
) {
  const metadata = recordValue(campaign.metadata);
  const refs = [
    ...audienceReferencesFromRecord(metadata),
    ...audienceReferencesFromRecord(metadata.lovable),
    ...(campaign.recipients ?? []).flatMap((recipient) =>
      audienceReferencesFromRecord(recipient.snapshot),
    ),
  ];
  return (
    audiences.find((audience) =>
      refs.some((reference) => audienceMatchesReference(audience, reference)),
    ) ?? null
  );
}

function campaignMetadataWithTarget(
  existingMetadata: unknown,
  targetAudience: MarketingAudience | null,
) {
  const metadata = { ...recordValue(existingMetadata) };
  for (const key of [
    "targetAudience",
    "targetAudienceId",
    "audienceId",
    "audienceListId",
    "listId",
    "lovableAudienceId",
    "audienceExternalId",
    "audience_external_id",
    "audienceList",
  ]) {
    delete metadata[key];
  }
  const targetAudienceSnapshot = audienceSnapshot(targetAudience);
  return targetAudienceSnapshot
    ? {
        ...metadata,
        targetAudienceId: targetAudience.id,
        audienceExternalId:
          targetAudience.lovableExternalId ?? targetAudience.id,
        targetAudience: targetAudienceSnapshot,
      }
    : metadata;
}

function emptyCampaignEditDraft(): CampaignEditDraft {
  return {
    name: "",
    audienceType: "b2c",
    channel: "email",
    contentAssetId: "",
    status: "draft",
    scheduleStartsAt: "",
    scheduleEndsAt: "",
    timezone: "Europe/Madrid",
    objective: "",
    targetAudienceId: "",
    source: "vyva",
    lovableExternalId: "",
    metadataText: "",
    recipientFilter: "",
    snapshotRecipients: false,
    channels: [newCampaignChannelDraft()],
  };
}

function campaignEditDraftFromCampaign(
  campaign: Campaign,
  audiences: MarketingAudience[] = [],
): CampaignEditDraft {
  const status = normalizeCampaignStatus(campaign.status);
  const scheduleStartsAt = toDateTimeLocal(campaign.scheduleStartsAt);
  const scheduleEndsAt = toDateTimeLocal(campaign.scheduleEndsAt);
  const channels = campaign.channels.length
    ? campaign.channels.map((channel) =>
        campaignChannelDraftFromChannel(channel, status, scheduleStartsAt),
      )
    : [newCampaignChannelDraft("email", status, scheduleStartsAt)];
  const primaryChannel = channels[0];
  const targetAudience = campaignTargetAudience(campaign, audiences);
  return {
    name: campaign.name,
    audienceType: campaign.audienceType,
    channel: primaryChannel.channel,
    contentAssetId: primaryChannel.contentAssetId,
    status,
    scheduleStartsAt,
    scheduleEndsAt,
    timezone: campaign.timezone || "Europe/Madrid",
    objective: campaign.objective,
    targetAudienceId: targetAudience?.id ?? "",
    source: campaign.source ?? "vyva",
    lovableExternalId: campaign.lovableExternalId ?? "",
    metadataText: jsonText(campaign.metadata),
    recipientFilter: "",
    snapshotRecipients: false,
    channels,
  };
}

function campaignChannelsWithPrimary(draft: CampaignEditDraft) {
  const first =
    draft.channels[0] ??
    newCampaignChannelDraft(
      draft.channel,
      draft.status,
      draft.scheduleStartsAt,
    );
  return [
    {
      ...first,
      channel: draft.channel,
      contentAssetId: first.contentAssetId || draft.contentAssetId,
      status: draft.status,
      scheduledAt: draft.scheduleStartsAt,
    },
    ...draft.channels.slice(1),
  ];
}

function campaignChannelsPayload(draft: CampaignEditDraft) {
  return campaignChannelsWithPrimary(draft).map((channel) => ({
    channel: channel.channel,
    contentAssetId:
      channel.channel === "email"
        ? channel.contentAssetId || null
        : channel.contentAssetId || null,
    status: channel.status,
    scheduledAt: fromDateTimeLocal(
      channel.scheduledAt || draft.scheduleStartsAt,
    ),
  }));
}

function campaignChannelsMatch(draft: CampaignEditDraft, campaign: Campaign) {
  const drafted = campaignChannelsPayload(draft);
  if (drafted.length !== campaign.channels.length) return false;
  return drafted.every((channel, index) => {
    const saved = campaign.channels[index];
    if (!saved) return false;
    return (
      channel.channel === saved.channel &&
      (channel.contentAssetId ?? "") === (saved.contentAssetId ?? "") &&
      channel.status === normalizeCampaignStatus(saved.status) &&
      toDateTimeLocal(channel.scheduledAt) ===
        toDateTimeLocal(saved.scheduledAt)
    );
  });
}

function notesFromMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const notes = (value as Record<string, unknown>).notes;
  return typeof notes === "string" ? notes : "";
}

function emptyJourneyEditDraft(): JourneyEditDraft {
  return {
    name: "",
    audienceType: "b2c",
    status: "draft",
    objective: "",
    targetAudienceId: "",
    source: "vyva",
    lovableExternalId: "",
    metadataText: "",
    triggerType: "",
    triggerConfigText: "",
    goalType: "",
    goalConfigText: "",
    exitOnGoal: true,
    steps: [],
  };
}

function journeyStepDraftFromStep(
  step: JourneyStep,
  content: ContentAsset[] = [],
): JourneyStepDraft {
  const referencedContent = contentAssetByReference(
    content,
    step.contentAssetId ?? step.templateRef,
  );
  return {
    id: step.id || newDraftId(),
    channel: step.channel,
    contentAssetId: step.contentAssetId ?? referencedContent?.id ?? "",
    delayHours: String(Math.max(0, step.delayHours ?? 0)),
    kind: step.kind || "message",
    templateKind: step.templateKind ?? "",
    templateRef: step.templateRef ?? "",
    status: normalizeJourneyStatus(step.status),
    configText: jsonText(step.config),
    notes: notesFromMetadata(step.metadata),
  };
}

function journeyAudienceReferenceFromConfig(value: unknown) {
  const config = recordValue(value);
  for (const key of [
    "targetAudienceId",
    "audienceId",
    "audienceListId",
    "listId",
    "lovableAudienceId",
    "audienceExternalId",
    "audience_external_id",
  ]) {
    const item = config[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  const audienceList = recordValue(
    config.audienceList ?? config.audience ?? config.list,
  );
  for (const key of [
    "id",
    "lovableExternalId",
    "lovable_external_id",
    "externalId",
    "external_id",
    "name",
  ]) {
    const item = audienceList[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  const list = config.list;
  return typeof list === "string" && list.trim() ? list.trim() : "";
}

function audienceMatchesReference(
  audience: MarketingAudience,
  reference: string,
) {
  const normalized = lower(reference);
  return (
    Boolean(normalized) &&
    [audience.id, audience.name, audience.lovableExternalId ?? ""].some(
      (item) => lower(item) === normalized,
    )
  );
}

function journeyTargetAudience(
  journey: Pick<Journey, "triggerConfig">,
  audiences: MarketingAudience[],
) {
  const reference = journeyAudienceReferenceFromConfig(journey.triggerConfig);
  if (!reference) return null;
  return (
    audiences.find((audience) =>
      audienceMatchesReference(audience, reference),
    ) ?? null
  );
}

function stripJourneyAudienceSelection(config: Record<string, unknown>) {
  const next = { ...config };
  for (const key of [
    "targetAudienceId",
    "audienceId",
    "audienceListId",
    "listId",
    "lovableAudienceId",
    "audienceExternalId",
    "audience_external_id",
    "audienceList",
  ]) {
    delete next[key];
  }
  return next;
}

function journeyEditDraftFromJourney(
  journey: Journey,
  audiences: MarketingAudience[] = [],
  content: ContentAsset[] = [],
): JourneyEditDraft {
  const targetAudience = journeyTargetAudience(journey, audiences);
  return {
    name: journey.name,
    audienceType: journey.audienceType,
    status: normalizeJourneyStatus(journey.status),
    objective: journey.objective,
    targetAudienceId: targetAudience?.id ?? "",
    source: journey.source ?? "vyva",
    lovableExternalId: journey.lovableExternalId ?? "",
    metadataText: jsonText(journey.metadata),
    triggerType: journey.triggerType ?? "",
    triggerConfigText: jsonText(journey.triggerConfig),
    goalType: journey.goalType ?? "",
    goalConfigText: jsonText(journey.goalConfig),
    exitOnGoal: journey.exitOnGoal,
    steps: journey.steps.map((step) => journeyStepDraftFromStep(step, content)),
  };
}

function newJourneyStepDraft(channel: Channel = "email"): JourneyStepDraft {
  return {
    id: newDraftId(),
    channel,
    contentAssetId: "",
    delayHours: "0",
    kind: "message",
    templateKind: "",
    templateRef: "",
    status: "draft",
    configText: "",
    notes: "",
  };
}

function journeyEntryRule(draft: JourneyEditDraft): JourneyEntryRule {
  if (draft.triggerType === "signup" || draft.triggerType === "account_created")
    return "signup";
  if (draft.triggerType === "list_joined") return "list_joined";
  if (draft.triggerType === "date" || draft.triggerType === "date_reached")
    return "date";
  return "manual";
}

function journeyStopRule(draft: JourneyEditDraft): JourneyStopRule {
  if (draft.goalType === "reply") return "reply";
  if (draft.goalType === "click") return "click";
  if (
    ["activation", "completed", "objective_completed", "conversion"].includes(
      draft.goalType,
    )
  )
    return "activation";
  return "final_step";
}

function journeyConfig(
  draft: JourneyEditDraft,
  key: "triggerConfigText" | "goalConfigText",
) {
  try {
    return parseJsonText(
      draft[key],
      key === "triggerConfigText" ? "Trigger config" : "Goal config",
    );
  } catch {
    return {};
  }
}

function withJourneyEntryRule(
  draft: JourneyEditDraft,
  rule: JourneyEntryRule,
): JourneyEditDraft {
  const config = journeyConfig(draft, "triggerConfigText");
  const next = { ...config };
  delete next.date;
  delete next.dateField;
  delete next.listId;
  delete next.listName;
  return {
    ...draft,
    triggerType: rule === "manual" ? "manual" : rule,
    triggerConfigText: jsonText(next),
    targetAudienceId: rule === "list_joined" ? draft.targetAudienceId : "",
  };
}

function withJourneyStopRule(
  draft: JourneyEditDraft,
  rule: JourneyStopRule,
): JourneyEditDraft {
  const goalType =
    rule === "final_step" ? "" : rule === "activation" ? "activation" : rule;
  return {
    ...draft,
    goalType,
    exitOnGoal: rule !== "final_step",
  };
}

function journeyEntryDate(draft: JourneyEditDraft) {
  const value = journeyConfig(draft, "triggerConfigText").date;
  return typeof value === "string" ? value : "";
}

function withJourneyEntryDate(
  draft: JourneyEditDraft,
  date: string,
): JourneyEditDraft {
  return {
    ...draft,
    triggerConfigText: jsonText({
      ...journeyConfig(draft, "triggerConfigText"),
      date,
    }),
  };
}

function journeyStepKind(step: JourneyStepDraft): JourneyStepKind {
  return step.kind === "wait" ? "wait" : "message";
}

function waitUnitForStep(step: JourneyStepDraft): WaitUnit {
  const config = (() => {
    try {
      return parseJsonText(step.configText, "Step config");
    } catch {
      return {};
    }
  })();
  if (
    config.waitUnit === "weeks" ||
    config.waitUnit === "days" ||
    config.waitUnit === "hours"
  )
    return config.waitUnit;
  const hours = nonNegativeInt(step.delayHours);
  if (hours > 0 && hours % 168 === 0) return "weeks";
  if (hours > 0 && hours % 24 === 0) return "days";
  return "hours";
}

function waitValueForStep(step: JourneyStepDraft) {
  const hours = nonNegativeInt(step.delayHours);
  const unit = waitUnitForStep(step);
  return String(
    unit === "weeks" ? hours / 168 : unit === "days" ? hours / 24 : hours,
  );
}

function withWaitValue(
  step: JourneyStepDraft,
  value: string,
  unit: WaitUnit,
): Partial<JourneyStepDraft> {
  const amount = nonNegativeInt(value);
  const multiplier = unit === "weeks" ? 168 : unit === "days" ? 24 : 1;
  let config: Record<string, unknown> = {};
  try {
    config = parseJsonText(step.configText, "Step config");
  } catch {
    /* preserve via payload validation */
  }
  return {
    delayHours: String(amount * multiplier),
    configText: jsonText({ ...config, waitUnit: unit }),
  };
}

function journeyEntryLabel(
  draft: JourneyEditDraft,
  targetAudience: MarketingAudience | null,
) {
  const rule = journeyEntryRule(draft);
  if (rule === "signup") return "When a contact creates an account";
  if (rule === "list_joined")
    return targetAudience
      ? `When a contact joins ${targetAudience.name}`
      : "When a contact joins a list";
  if (rule === "date")
    return journeyEntryDate(draft)
      ? `On ${journeyEntryDate(draft)}`
      : "When a chosen date is reached";
  return "When an admin adds contacts manually";
}

function journeyStopLabel(draft: JourneyEditDraft) {
  const rule = journeyStopRule(draft);
  if (rule === "reply") return "When the contact replies";
  if (rule === "click") return "When the contact clicks";
  if (rule === "activation") return "When the contact completes the objective";
  return "After the final step";
}

function parseJsonText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function parseJsonArrayText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed as unknown[];
  } catch {
    throw new Error(`${label} must be a valid JSON array.`);
  }
}

function nonNegativeInt(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function contentEditDraftFromContent(content: ContentAsset): ContentEditDraft {
  return {
    title: content.title,
    channel: content.channel,
    language: content.language || "en",
    status: normalizeContentStatus(content.status),
    subject: content.subject ?? "",
    body: content.body,
    htmlBody: content.htmlBody ?? "",
    ctaLabel: content.ctaLabel ?? "",
    ctaUrl: content.ctaUrl ?? "",
    source: content.source ?? "vyva",
    lovableExternalId: content.lovableExternalId ?? "",
    designJsonText: jsonText(content.designJson),
    mediaAssetsText: jsonArrayText(content.mediaAssets),
    metadataText: jsonText(content.metadata),
  };
}

function contentPayloadFromDraft(draft: ContentEditDraft) {
  return {
    title: draft.title.trim(),
    channel: draft.channel,
    language: draft.language.trim() || "en",
    status: draft.status,
    subject: draft.subject.trim() || null,
    body: draft.body,
    htmlBody: draft.htmlBody.trim() || null,
    ctaLabel: draft.ctaLabel.trim() || null,
    ctaUrl: draft.ctaUrl.trim() || null,
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    designJson: parseJsonText(draft.designJsonText, "Design JSON"),
    mediaAssets: parseJsonArrayText(draft.mediaAssetsText, "Media assets"),
    metadata: parseJsonText(draft.metadataText, "Content metadata"),
  };
}

function mediaEditDraftFromAsset(asset: MarketingMediaAsset): MediaEditDraft {
  return {
    contentAssetId: asset.contentAssetId ?? "",
    assetType: asset.assetType,
    originalUrl: asset.originalUrl,
    localUrl: asset.localUrl ?? "",
    status: asset.status,
    source: asset.source,
    lovableExternalId: asset.lovableExternalId ?? "",
    metadataText: jsonText(asset.metadata),
  };
}

function mediaPayloadFromDraft(draft: MediaEditDraft) {
  return {
    contentAssetId: draft.contentAssetId || null,
    assetType: draft.assetType.trim() || "unknown",
    originalUrl: draft.originalUrl.trim(),
    localUrl: draft.localUrl.trim() || null,
    status: draft.status.trim() || "referenced",
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    metadata: parseJsonText(draft.metadataText, "Media metadata"),
  };
}

function contactEditDraftFromContact(
  contact: MarketingContact,
): ContactEditDraft {
  return {
    fullName: contact.fullName,
    audienceType: contact.audienceType,
    profileId: contact.profileId ?? "",
    organizationId: contact.organizationId ?? "",
    email: contact.email ?? "",
    phoneNumber: contact.phoneNumber ?? "",
    whatsappNumber: contact.whatsappNumber ?? "",
    roleLabel: contact.roleLabel ?? "",
    companyName: contact.companyName ?? "",
    language: contact.language ?? "",
    category: contact.category ?? "",
    vertical: contact.vertical ?? "",
    market: contact.market ?? "",
    tags: contact.tags.join(", "),
    consentStatus: CONSENT_STATUSES.includes(contact.consentStatus)
      ? contact.consentStatus
      : "unknown",
    source: contact.source ?? "vyva",
    lovableExternalId: contact.lovableExternalId ?? "",
    channelAvailabilityText: jsonText(contact.channelAvailability),
    metadataText: jsonText(contact.metadata),
  };
}

function contactPayloadFromDraft(draft: ContactEditDraft) {
  const existingMetadata = parseJsonText(
    draft.metadataText,
    "Contact metadata",
  );
  const existingSegmentation = recordValue(existingMetadata.segmentation);
  const channelAvailability = parseJsonText(
    draft.channelAvailabilityText,
    "Channel availability",
  );
  return {
    fullName: draft.fullName,
    audienceType: draft.audienceType,
    profileId: draft.profileId.trim() || null,
    organizationId: draft.organizationId.trim() || null,
    email: draft.email || null,
    phoneNumber: draft.phoneNumber || null,
    whatsappNumber: draft.whatsappNumber || null,
    roleLabel: draft.roleLabel || null,
    companyName: draft.companyName || null,
    language: draft.language || null,
    category: draft.category || null,
    vertical: draft.vertical || null,
    market: draft.market || null,
    consentStatus: draft.consentStatus,
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    tags: splitTags(draft.tags),
    channelAvailability: {
      ...channelAvailability,
      email: Boolean(draft.email),
      phone: Boolean(draft.phoneNumber),
      whatsapp: Boolean(draft.whatsappNumber),
    },
    metadata: {
      ...existingMetadata,
      segmentation: {
        ...existingSegmentation,
        language: draft.language || null,
        category: draft.category || null,
        vertical: draft.vertical || null,
        market: draft.market || null,
      },
    },
  };
}

function audienceEditDraftFromAudience(
  audience: MarketingAudience,
): AudienceEditDraft {
  return {
    name: audience.name,
    listType: audience.listType || "dynamic",
    description: audience.description ?? "",
    rulesText: jsonText(audience.rules ?? {}),
    contactExternalIds: (audience.contactExternalIds ?? []).join("\n"),
    source: audience.source ?? "vyva",
    lovableExternalId: audience.lovableExternalId ?? "",
    metadataText: jsonText(audience.metadata),
  };
}

function audiencePayloadFromDraft(draft: AudienceEditDraft) {
  return {
    name: draft.name,
    listType: draft.listType || "dynamic",
    description: draft.description || null,
    rules: parseRulesText(draft.rulesText),
    contactExternalIds: splitLines(draft.contactExternalIds),
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    metadata: parseJsonText(draft.metadataText, "Audience metadata"),
  };
}

function journeyPayloadFromDraft(
  draft: JourneyEditDraft,
  targetAudience: MarketingAudience | null = null,
) {
  const triggerConfig = stripJourneyAudienceSelection(
    parseJsonText(draft.triggerConfigText, "Trigger config"),
  );
  const targetAudienceSnapshot = audienceSnapshot(targetAudience);
  return {
    name: draft.name.trim(),
    audienceType: draft.audienceType,
    status: draft.status,
    objective: draft.objective,
    source: draft.source.trim() || "vyva",
    lovableExternalId: draft.lovableExternalId.trim() || null,
    metadata: parseJsonText(draft.metadataText, "Journey metadata"),
    triggerType: draft.triggerType.trim() || null,
    triggerConfig: targetAudienceSnapshot
      ? {
          ...triggerConfig,
          targetAudienceId: targetAudience.id,
          audienceExternalId:
            targetAudience.lovableExternalId ?? targetAudience.id,
          audienceList: targetAudienceSnapshot,
        }
      : triggerConfig,
    goalType: draft.goalType.trim() || null,
    goalConfig: parseJsonText(draft.goalConfigText, "Goal config"),
    exitOnGoal: draft.exitOnGoal,
    steps: draft.steps.map((step, index) => {
      const delayHours = nonNegativeInt(step.delayHours);
      return {
        stepOrder: index,
        channel: step.channel,
        contentAssetId: step.contentAssetId || null,
        delayHours,
        dayOffset: Math.floor(delayHours / 24),
        kind: step.kind.trim() || "message",
        templateKind: step.templateKind.trim() || null,
        templateRef: step.templateRef.trim() || null,
        status: step.status,
        config: parseJsonText(step.configText, `Step ${index + 1} config`),
        metadata: step.notes.trim() ? { notes: step.notes.trim() } : {},
      };
    }),
  };
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function campaignAllowsContact(
  campaignAudience: Audience,
  contactAudience: Audience,
) {
  return (
    campaignAudience === "both" ||
    contactAudience === "both" ||
    contactAudience === campaignAudience
  );
}

function recipientForChannel(contact: MarketingContact, channel: Channel) {
  if (channel === "email") return contact.email;
  if (channel === "whatsapp")
    return contact.whatsappNumber || contact.phoneNumber;
  return (
    contact.email || contact.whatsappNumber || contact.phoneNumber || contact.id
  );
}

function recipientSnapshot(contact: MarketingContact) {
  return {
    fullName: contact.fullName,
    email: contact.email,
    phoneNumber: contact.phoneNumber,
    whatsappNumber: contact.whatsappNumber,
    audienceType: contact.audienceType,
    companyName: contact.companyName,
    roleLabel: contact.roleLabel,
    consentStatus: contact.consentStatus,
    tags: contact.tags,
    lists: contact.lists,
  };
}

function contactMatchesAudienceList(
  contact: MarketingContact,
  audience: MarketingAudience | null,
) {
  if (!audience) return true;
  const contactExternalId = lower(contact.lovableExternalId);
  const externalIds = new Set(
    audience.contactExternalIds.map((id) => lower(id)),
  );
  return (
    Boolean(contactExternalId && externalIds.has(contactExternalId)) ||
    contact.lists.some((list) => lower(list) === lower(audience.name))
  );
}

function audienceSnapshot(audience: MarketingAudience | null) {
  if (!audience) return null;
  return {
    id: audience.id,
    name: audience.name,
    listType: audience.listType,
    source: audience.source,
    lovableExternalId: audience.lovableExternalId,
    memberCount: audience.memberCount,
    mappedMemberCount: audience.mappedMemberCount,
  };
}

function objectValue(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
}

function recipientSnapshotLabel(recipient: CampaignRecipient) {
  return (
    objectValue(recipient.snapshot, "fullName") ||
    objectValue(recipient.snapshot, "email") ||
    recipient.recipient
  );
}

function recipientSnapshotText(recipient: CampaignRecipient, keys: string[]) {
  const snapshot = recordValue(recipient.snapshot);
  const lovable = recordValue(snapshot.lovable);
  const nestedContact = recordValue(lovable.contact ?? snapshot.contact);
  for (const source of [snapshot, lovable, nestedContact]) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

function recipientContactLookupKeys(recipient: CampaignRecipient) {
  return [
    recipient.contactId,
    recipientSnapshotText(recipient, [
      "contactExternalId",
      "contact_external_id",
      "contactId",
      "contact_id",
      "externalId",
      "external_id",
      "lovableExternalId",
      "lovable_external_id",
      "id",
    ]),
  ].flatMap((value) => lookupKeysForExternalId(value, ["contact"]));
}

function recipientEmailLookupKey(recipient: CampaignRecipient) {
  return lower(
    recipientSnapshotText(recipient, [
      "email",
      "emailAddress",
      "email_address",
    ]) || recipient.recipient,
  );
}

function sumMarketingMetrics(
  metrics: MarketingCampaignMetric[],
): MarketingAnalyticsTotals {
  return metrics.reduce(
    (totals, metric) => ({
      sent: totals.sent + metric.sent,
      delivered: totals.delivered + metric.delivered,
      opened: totals.opened + metric.opened,
      clicked: totals.clicked + metric.clicked,
      bounced: totals.bounced + metric.bounced,
      unsubscribed: totals.unsubscribed + metric.unsubscribed,
      replied: totals.replied + metric.replied,
      socialEngagement: totals.socialEngagement + metric.socialEngagement,
    }),
    {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      replied: 0,
      socialEngagement: 0,
    },
  );
}

function summarizeCampaignMetrics(
  metrics: MarketingCampaignMetric[],
): CampaignMetricSummary {
  const totals = sumMarketingMetrics(metrics);
  const latestMetricDate =
    metrics
      .map((metric) => metric.metricDate)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  return {
    ...totals,
    metricCount: metrics.length,
    latestMetricDate,
    channels: Array.from(
      new Set(metrics.map((metric) => metric.channel).filter(Boolean)),
    ).sort(),
  };
}

function contactProfileSignals(contact: MarketingContact) {
  const metadata = recordValue(contact.metadata);
  const lovable = recordValue(metadata.lovable);
  const profile = recordValue(lovable.profile ?? metadata.profile);
  const segmentation = recordValue(
    metadata.segmentation ?? lovable.segmentation,
  );
  const sources = [metadata, lovable, profile, segmentation];
  const entries = [
    {
      key: "crmScore",
      label: "CRM",
      value: firstMetadataText(sources, [
        "crmScore",
        "crm_score",
        "leadScore",
        "lead_score",
        "score",
        "profile.crmScore",
        "profile.crm_score",
      ]),
      className: "bg-emerald-50 text-emerald-800",
    },
    {
      key: "lifecycle",
      label: "Lifecycle",
      value: firstMetadataText(sources, [
        "lifecycle",
        "lifeCycle",
        "life_cycle",
        "stage",
        "profile.lifecycle",
        "segmentation.lifecycle",
      ]),
      className: "bg-blue-50 text-blue-800",
    },
    {
      key: "persona",
      label: "Persona",
      value: firstMetadataText(sources, [
        "persona",
        "profile.persona",
        "segment",
        "profile.segment",
      ]),
      className: "bg-purple-50 text-purple-800",
    },
    {
      key: "profileEmail",
      label: "Profile email",
      value: firstMetadataText(sources, [
        "profile.emailAddress",
        "profile.email_address",
        "profile.email",
        "emailAddress",
        "email_address",
      ]),
      className: "bg-[#f5eee8] text-[#5b4a46]",
    },
  ].filter((entry) => entry.value);
  return entries;
}

function contactSearchText(contact: MarketingContact) {
  const profileSignals = contactProfileSignals(contact);
  return [
    contact.id,
    contact.fullName,
    contact.email,
    contact.phoneNumber,
    contact.whatsappNumber,
    contact.consentStatus,
    contact.roleLabel,
    contact.companyName,
    contact.language,
    contact.category,
    contact.vertical,
    contact.market,
    contact.source,
    contact.lovableExternalId,
    contact.profileId,
    contact.organizationId,
    contact.channelAvailability,
    contact.metadata,
    ...profileSignals.flatMap((entry) => [entry.label, entry.value]),
    ...(contact.tags ?? []),
    ...(contact.lists ?? []),
  ]
    .map(searchableValue)
    .join(" ");
}

function countedOptions(
  values: Array<string | null | undefined>,
): CountOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const rawValue of values) {
    const label = String(rawValue ?? "").trim();
    if (!label) continue;
    const value = label.toLowerCase();
    const current = counts.get(value);
    if (current) {
      current.count += 1;
    } else {
      counts.set(value, { label, count: 1 });
    }
  }
  return Array.from(counts.entries())
    .map(([value, item]) => ({ value, label: item.label, count: item.count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function valueMatchesFilter(value: string | null | undefined, filter: string) {
  return (
    filter === "all" ||
    String(value ?? "")
      .trim()
      .toLowerCase() === filter
  );
}

function searchableValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value).toLowerCase();
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return "";
  }
}

function matchesSearch(search: string, values: unknown[]) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return values.map(searchableValue).join(" ").includes(query);
}

function displayText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return "";
}

function nestedValue(source: Record<string, unknown>, path: string) {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current))
      return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function firstMetadataText(
  sources: Record<string, unknown>[],
  paths: string[],
) {
  for (const source of sources) {
    for (const path of paths) {
      const text = displayText(nestedValue(source, path));
      if (text) return text;
    }
  }
  return "";
}

const syncCountLabels = {
  campaigns: "Campaigns",
  contacts: "Contacts",
  content: "Content",
  journeyStepPresetContent: "Journey step preset content",
  missingContentReferences: "Missing content references",
  mediaAssets: "Media assets",
  campaignChannels: "Campaign channels",
  campaignMetrics: "Campaign metrics",
  journeys: "Journeys",
  journeyEnrollments: "Journey enrollments",
  journeyStepEvents: "Journey step events",
  audiences: "Audiences",
  audienceMembers: "Audience members",
  mappedAudienceMembers: "Mapped members",
  campaignRecipients: "Campaign recipients",
} as const;

type SyncCountKey = keyof typeof syncCountLabels;

const lovableDestinationRows: Array<{
  key: string;
  label: string;
  sourceHint: string;
  destination: string;
  detail: string;
  countKeys: SyncCountKey[];
  contentSourceKeys?: string[];
}> = [
  {
    key: "email-templates",
    label: "Saved email templates",
    sourceHint: "saved_email_templates, emailTemplates",
    destination: "Content tab",
    detail:
      "Email subject, HTML, CTA, design data, and media become editable content assets.",
    countKeys: ["content"],
    contentSourceKeys: [
      "saved_email_template",
      "email_template",
      "marketing_email_template",
    ],
  },
  {
    key: "social-posts",
    label: "Social posts",
    sourceHint: "social_posts, posts",
    destination: "Content tab",
    detail:
      "Platform, caption/body, image, and builder metadata become channel-specific content assets.",
    countKeys: ["content"],
    contentSourceKeys: ["social_post", "post", "marketing_social_post"],
  },
  {
    key: "content-briefs",
    label: "Content briefs",
    sourceHint: "content_briefs, briefs",
    destination: "Content tab",
    detail:
      "Planning copy and structured brief sections are preserved as content assets and metadata.",
    countKeys: ["content"],
    contentSourceKeys: ["content_brief", "brief", "marketing_content_brief"],
  },
  {
    key: "journey-step-presets",
    label: "Journey step presets",
    sourceHint: "journey steps with config.translations",
    destination: "Content tab and Journeys tab",
    detail:
      "Translated onboarding step copy hidden inside journey configs becomes editable content and is linked back to the journey step.",
    countKeys: ["journeyStepPresetContent"],
    contentSourceKeys: ["journey_step_preset"],
  },
  {
    key: "media",
    label: "Media assets",
    sourceHint: "media_assets, mediaAssets, images",
    destination: "Content > Media references",
    detail:
      "Standalone and content-linked image/file URLs are listed and can be linked to content.",
    countKeys: ["mediaAssets"],
  },
  {
    key: "contacts",
    label: "Contacts",
    sourceHint: "contacts, email_unsubscribes",
    destination: "Contacts tab",
    detail:
      "Names, email, phone, WhatsApp, company, role, consent, tags, and segmentation fields are searchable.",
    countKeys: ["contacts"],
  },
  {
    key: "lists",
    label: "Lists and audiences",
    sourceHint: "audiences, contact_lists, contact_list_members",
    destination: "Contacts tab > Lists",
    detail:
      "List rules, member IDs, mapped contacts, and unmapped members are shown together.",
    countKeys: ["audiences", "audienceMembers"],
  },
  {
    key: "campaigns",
    label: "Campaigns",
    sourceHint: "campaigns, campaign channels, recipients",
    destination: "Dashboard, Campaigns, Calendar",
    detail:
      "Schedules, channels, linked content, recipient snapshots, and email send controls live in campaign details.",
    countKeys: ["campaigns", "campaignChannels", "campaignRecipients"],
  },
  {
    key: "analytics",
    label: "Campaign metrics",
    sourceHint: "campaignMetrics, analytics, performance",
    destination: "Dashboard analytics",
    detail:
      "Sent, delivered, opened, clicked, bounced, unsubscribed, replied, and social engagement metrics are summarized.",
    countKeys: ["campaignMetrics"],
  },
  {
    key: "journeys",
    label: "Journeys",
    sourceHint: "journeys, journey_steps, enrollments, events",
    destination: "Journeys tab",
    detail:
      "Triggers, goals, steps, enrollment progress, and journey event history are editable or inspectable.",
    countKeys: ["journeys", "journeyEnrollments", "journeyStepEvents"],
  },
];

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function syncCountItems(
  summary: Record<string, unknown>,
  group: "exported" | "imported" | "skipped",
) {
  const source = recordValue(summary[group]);
  return (Object.keys(syncCountLabels) as SyncCountKey[])
    .map((key) => ({
      key,
      label: syncCountLabels[key],
      value: numberValue(source[key]),
    }))
    .filter((item) => item.value > 0);
}

function syncCountValue(
  summary: Record<string, unknown>,
  group: "exported" | "imported" | "skipped",
  key: SyncCountKey,
) {
  return numberValue(recordValue(summary[group])[key]);
}

function syncParityItems(summary: Record<string, unknown>) {
  return (Object.keys(syncCountLabels) as SyncCountKey[])
    .map((key) => {
      const exported = syncCountValue(summary, "exported", key);
      const imported = syncCountValue(summary, "imported", key);
      const skipped = syncCountValue(summary, "skipped", key);
      const missing = Math.max(exported - imported - skipped, 0);
      return {
        key,
        label: syncCountLabels[key],
        exported,
        imported,
        skipped,
        missing,
        status:
          exported === 0 && imported > 0
            ? "derived"
            : exported === 0
              ? "empty"
              : missing > 0
                ? "missing"
                : skipped > 0
                  ? "review"
                  : "complete",
      };
    })
    .filter(
      (item) => item.exported > 0 || item.imported > 0 || item.skipped > 0,
    );
}

function syncUnmappedCount(summary: Record<string, unknown>) {
  return numberValue(
    recordValue(summary.unmapped).audienceContactExternalIdCount,
  );
}

function syncUnmappedCampaignRecipientCount(summary: Record<string, unknown>) {
  return numberValue(
    recordValue(summary.unmapped).campaignRecipientExternalIdCount,
  );
}

function syncUnmappedSample(summary: Record<string, unknown>) {
  const unmapped = recordValue(summary.unmapped);
  const ids = [
    ...(Array.isArray(unmapped.audienceContactExternalIds)
      ? unmapped.audienceContactExternalIds
      : []),
    ...(Array.isArray(unmapped.campaignRecipientExternalIds)
      ? unmapped.campaignRecipientExternalIds
      : []),
  ];
  return ids
    .map((id) => String(id))
    .filter(Boolean)
    .slice(0, 5);
}

function syncExportMetadata(summary: Record<string, unknown>) {
  const metadata = recordValue(summary.exportMetadata);
  const topLevelKeys = Array.isArray(metadata.topLevelKeys)
    ? metadata.topLevelKeys.map((key) => String(key)).filter(Boolean)
    : [];
  return {
    dataset:
      typeof metadata.dataset === "string" && metadata.dataset.trim()
        ? metadata.dataset.trim()
        : "",
    exportedAt:
      typeof metadata.exportedAt === "string" && metadata.exportedAt.trim()
        ? metadata.exportedAt.trim()
        : "",
    cursor:
      typeof metadata.cursor === "string" && metadata.cursor.trim()
        ? metadata.cursor.trim()
        : "",
    apiUrl:
      typeof metadata.apiUrl === "string" && metadata.apiUrl.trim()
        ? metadata.apiUrl.trim()
        : "",
    topLevelKeys,
  };
}

function syncContentSourceItems(summary: Record<string, unknown>) {
  return Object.entries(recordValue(summary.contentSourceCounts))
    .map(([key, value]) => ({
      key,
      label: contentSourceLabel(key),
      value: numberValue(value),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function syncContentSourceCount(
  summary: Record<string, unknown>,
  keys: string[],
) {
  const counts = recordValue(summary.contentSourceCounts);
  return keys.reduce((total, key) => total + numberValue(counts[key]), 0);
}

function syncDestinationCount(
  summary: Record<string, unknown>,
  row: (typeof lovableDestinationRows)[number],
) {
  const sourceCount = row.contentSourceKeys?.length
    ? syncContentSourceCount(summary, row.contentSourceKeys)
    : 0;
  if (sourceCount) return sourceCount;
  const exported = row.countKeys.reduce(
    (total, key) => total + syncCountValue(summary, "exported", key),
    0,
  );
  if (exported) return exported;
  return row.countKeys.reduce(
    (total, key) => total + syncCountValue(summary, "imported", key),
    0,
  );
}

function syncFieldCoverageItems(summary: Record<string, unknown>) {
  const coverage = recordValue(summary.fieldCoverage);
  return Object.entries(coverage)
    .map(([entity, value]) => {
      const item = recordValue(value);
      const exportedFields = Array.isArray(item.exportedFields)
        ? item.exportedFields.map(String).filter(Boolean)
        : [];
      const firstClassFields = Array.isArray(item.firstClassFields)
        ? item.firstClassFields.map(String).filter(Boolean)
        : [];
      const metadataOnlyFields = Array.isArray(item.metadataOnlyFields)
        ? item.metadataOnlyFields.map(String).filter(Boolean)
        : [];
      return {
        entity,
        exported: numberValue(item.exportedFieldCount),
        firstClass: numberValue(item.firstClassFieldCount),
        metadataOnly: numberValue(item.metadataOnlyFieldCount),
        exportedFields,
        firstClassFields,
        metadataOnlyFields,
      };
    })
    .filter((item) => item.exported > 0);
}

function syncCompletionMessage(summary?: Record<string, unknown>) {
  if (!summary) return "Lovable sync completed.";
  const nestedImported = syncCountItems(summary, "imported");
  const flatImported = (Object.keys(syncCountLabels) as SyncCountKey[])
    .map((key) => ({
      key,
      label: syncCountLabels[key],
      value: numberValue(summary[key]),
    }))
    .filter((item) => item.value > 0);
  const imported = nestedImported.length ? nestedImported : flatImported;
  if (!imported.length)
    return "Lovable sync completed. No import counts were reported.";
  const visible = imported
    .slice(0, 6)
    .map((item) => `${item.label}: ${item.value}`)
    .join(", ");
  const hiddenCount = imported.length - 6;
  return `Lovable sync completed. Imported ${visible}${hiddenCount > 0 ? `, +${hiddenCount} more` : ""}.`;
}

function exportPreviewMessage(summary?: Record<string, unknown>) {
  if (!summary) return "Lovable export checked.";
  const exported = syncCountItems(summary, "exported");
  if (!exported.length)
    return "Lovable export checked. No export counts were reported.";
  const visible = exported
    .slice(0, 6)
    .map((item) => `${item.label}: ${item.value}`)
    .join(", ");
  const hiddenCount = exported.length - 6;
  return `Lovable export contains ${visible}${hiddenCount > 0 ? `, +${hiddenCount} more` : ""}.`;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(url, options);
  const body = (await response.json().catch(() => null)) as
    T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(
      (body && typeof body === "object" && "error" in body && body.error) ||
        "Request failed",
    );
  }
  return body as T;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-[#4d4351]">
        {label}
      </span>
      {children}
    </label>
  );
}

function MetadataPanel({
  title,
  value,
  testId,
}: {
  title: string;
  value?: Record<string, unknown> | null;
  testId: string;
}) {
  if (!value || Array.isArray(value) || Object.keys(value).length === 0)
    return null;
  return (
    <details
      className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3"
      data-testid={testId}
    >
      <summary className="cursor-pointer text-sm font-black text-[#241133]">
        {title}
      </summary>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs font-bold leading-relaxed text-[#5b4a46]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function LovableContentSourceDetails({ content }: { content: ContentAsset }) {
  const rows = lovableContentSourceDetails(content);
  if (!rows.length) return null;
  return (
    <div
      className="rounded-xl border border-violet-100 bg-violet-50 p-3"
      data-testid="marketing-content-source-details"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-900">
          Lovable source details
        </p>
        <Pill className="bg-white text-violet-800">
          {contentOriginLabel(content)}
        </Pill>
      </div>
      <dl className="mt-3 grid gap-2 md:grid-cols-2">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="rounded-lg bg-white px-3 py-2"
          >
            <dt className="text-[11px] font-black uppercase tracking-[0.1em] text-[#8b7a73]">
              {row.label}
            </dt>
            <dd className="mt-1 break-words text-xs font-bold text-[#241133]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Pill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}
    >
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
        <Icon size={19} aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-black text-[#241133]">{value}</p>
      <p className="mt-1 text-sm font-bold text-[#7d6b65]">{label}</p>
    </div>
  );
}

function MediaPreviewTile({
  url,
  label,
  testId,
}: {
  url: string;
  label?: string;
  testId?: string;
}) {
  const mediaLabel = label || mediaPreviewLabel(url);
  if (isPreviewableImageUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-xl border border-[#eadfd5] bg-white"
        data-testid={testId}
      >
        <img
          src={url}
          alt={mediaLabel}
          className="h-36 w-full object-cover"
          loading="lazy"
        />
        <span className="block truncate px-3 py-2 text-xs font-bold text-purple-700">
          {mediaLabel}
        </span>
      </a>
    );
  }
  if (isPreviewableVideoUrl(url)) {
    return (
      <div
        className="overflow-hidden rounded-xl border border-[#eadfd5] bg-white"
        data-testid={testId}
      >
        <video
          src={url}
          controls
          preload="metadata"
          className="h-36 w-full bg-black object-cover"
          aria-label={mediaLabel}
        />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block truncate px-3 py-2 text-xs font-bold text-purple-700"
        >
          {mediaLabel}
        </a>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-24 items-center rounded-xl border border-[#eadfd5] bg-white p-3 text-xs font-bold text-purple-700"
      data-testid={testId}
    >
      <span className="break-all">{mediaLabel}</span>
    </a>
  );
}

function LovableDesignPreview({
  contentAsset,
  testId = "marketing-content-design-preview",
  mediaTestIdPrefix = "marketing-content-design-media",
}: {
  contentAsset: ContentAsset;
  testId?: string;
  mediaTestIdPrefix?: string;
}) {
  const blocks = collectDesignPreviewBlocks(contentAsset.designJson);
  if (!blocks.length) return null;

  return (
    <div
      className="rounded-xl border border-purple-100 bg-[#fbf7ff] p-3"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
            Lovable design preview
          </p>
          <p className="mt-1 text-xs font-bold text-[#7d6b65]">
            {blocks.length} visible design block{blocks.length === 1 ? "" : "s"}{" "}
            parsed from imported builder data.
          </p>
        </div>
        <Pill className="bg-purple-50 text-purple-800">Design rendered</Pill>
      </div>
      <div className="mt-3 grid max-h-[560px] gap-3 overflow-y-auto pr-1">
        {blocks.map((block, index) => (
          <article
            key={`${block.key}-${index}`}
            className="overflow-hidden rounded-xl border border-[#eadfd5] bg-white"
          >
            {block.mediaUrl ? (
              <MediaPreviewTile
                url={block.mediaUrl}
                label={block.title || contentAsset.title}
                testId={`${mediaTestIdPrefix}-${index}`}
              />
            ) : null}
            <div className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill className="bg-purple-50 text-purple-800">
                  {humanizeMetadataKey(block.type)}
                </Pill>
                <span className="text-xs font-bold text-[#8b7a73]">
                  {block.key}
                </span>
              </div>
              {block.title ? (
                <h4 className="mt-2 text-base font-black text-[#241133]">
                  {block.title}
                </h4>
              ) : null}
              {block.body && block.body !== block.title ? (
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#5b4a46]">
                  {block.body}
                </p>
              ) : null}
              {block.ctaLabel || block.ctaUrl ? (
                <p className="mt-3 text-xs font-black text-purple-700">
                  CTA:{" "}
                  {[block.ctaLabel, block.ctaUrl].filter(Boolean).join(" -> ")}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ContentTemplatePreview({
  contentAsset,
  linkedMediaAssets = [],
  className = "",
  testId = "marketing-content-template-preview",
}: {
  contentAsset: ContentAsset;
  linkedMediaAssets?: MarketingMediaAsset[];
  className?: string;
  testId?: string;
}) {
  const mediaUrls = contentMediaPreviewUrls(contentAsset, linkedMediaAssets);
  const hasVisualTemplate =
    Boolean(contentAsset.htmlBody?.trim()) ||
    contentAsset.hasDesign ||
    mediaUrls.length > 0;

  return (
    <div className={`grid gap-4 ${className}`} data-testid={testId}>
      <div className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
              Customer preview
            </p>
            <h3 className="mt-1 font-serif text-2xl leading-tight text-[#241133]">
              {contentAsset.subject || contentAsset.title}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill className={channelClass(contentAsset.channel)}>
              {channelLabel[contentAsset.channel]}
            </Pill>
            <Pill className={statusClass(contentAsset.status)}>
              {contentAsset.status}
            </Pill>
            <Pill className="bg-blue-50 text-blue-800">
              {contentAsset.language}
            </Pill>
          </div>
        </div>

        {contentAsset.htmlBody ? (
          <div className="grid gap-3">
            <iframe
              title={`Preview ${contentAsset.title}`}
              sandbox=""
              srcDoc={contentAsset.htmlBody}
              className="h-[640px] w-full rounded-xl border border-[#eadfd5] bg-white"
              data-testid={`${testId}-html-preview`}
            />
            {contentAsset.body ? (
              <details className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-4 py-3">
                <summary className="cursor-pointer text-sm font-black text-[#241133]">
                  Plain text copy
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#2f2135]">
                  {contentAsset.body}
                </p>
              </details>
            ) : null}
          </div>
        ) : contentAsset.body ? (
          <div className="min-h-[260px] whitespace-pre-wrap rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-5 text-base font-semibold leading-relaxed text-[#2f2135]">
            {contentAsset.body}
          </div>
        ) : (
          <div className="min-h-[260px] rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-5 text-sm font-bold text-[#8b7a73]">
            No visible copy imported for this item yet.
          </div>
        )}

        {contentAsset.ctaLabel || contentAsset.ctaUrl ? (
          <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm font-black text-purple-800">
            CTA:{" "}
            {[contentAsset.ctaLabel, contentAsset.ctaUrl]
              .filter(Boolean)
              .join(" -> ")}
          </div>
        ) : null}
      </div>

      {contentAsset.hasDesign ? (
        contentAsset.htmlBody ? (
          <details className="rounded-xl border border-purple-100 bg-[#fbf7ff] p-3">
            <summary className="cursor-pointer text-sm font-black text-[#241133]">
              Imported design fallback
            </summary>
            <div className="mt-3">
              <LovableDesignPreview
                contentAsset={contentAsset}
                testId={`${testId}-design`}
                mediaTestIdPrefix={`${testId}-design-media`}
              />
            </div>
          </details>
        ) : (
          <LovableDesignPreview
            contentAsset={contentAsset}
            testId={`${testId}-design`}
            mediaTestIdPrefix={`${testId}-design-media`}
          />
        )
      ) : null}

      {mediaUrls.length ? (
        <details className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
          <summary className="cursor-pointer text-sm font-black text-[#241133]">
            Media references ({mediaUrls.length})
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mediaUrls.map((url, index) => (
              <MediaPreviewTile
                key={url}
                url={url}
                testId={`${testId}-media-${index}`}
              />
            ))}
          </div>
        </details>
      ) : null}

      {!hasVisualTemplate ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          This item exists in the library, but the import did not include
          HTML/design/media. Edit it here or re-sync after the source exports
          the full template.
        </p>
      ) : null}
    </div>
  );
}

function LinkedContentPreview({
  contentAsset,
  linkedMediaAssets,
  testId,
  onPreview,
  onEdit,
}: {
  contentAsset: ContentAsset | null;
  linkedMediaAssets: MarketingMediaAsset[];
  testId: string;
  onPreview?: (contentAsset: ContentAsset) => void;
  onEdit?: (contentAsset: ContentAsset) => void;
}) {
  if (!contentAsset) {
    return (
      <div
        className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-3 text-sm font-bold text-[#8b7a73]"
        data-testid={testId}
      >
        No content selected for this channel.
      </div>
    );
  }

  const previewUrls = contentMediaPreviewUrls(contentAsset, linkedMediaAssets);
  return (
    <div
      className="rounded-xl border border-purple-100 bg-[#fbf7ff] p-3"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-purple-700">
            Linked content
          </p>
          <h4 className="mt-1 font-black text-[#241133]">
            {contentAsset.title}
          </h4>
          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
            {contentAsset.subject || contentAsset.body || "No copy yet."}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Pill className={channelClass(contentAsset.channel)}>
            {channelLabel[contentAsset.channel]}
          </Pill>
          <Pill className={statusClass(contentAsset.status)}>
            {contentAsset.status}
          </Pill>
          {contentAsset.source === "lovable" ? (
            <Pill className="bg-violet-50 text-violet-700">
              {contentOriginLabel(contentAsset)}
            </Pill>
          ) : null}
          {contentAsset.hasHtml ? (
            <Pill className="bg-blue-50 text-blue-800">HTML</Pill>
          ) : null}
          {contentAsset.hasDesign ? (
            <Pill className="bg-purple-50 text-purple-800">Design data</Pill>
          ) : null}
          {previewUrls.length ? (
            <Pill className="bg-emerald-50 text-emerald-800">
              {previewUrls.length} media
            </Pill>
          ) : null}
          {onPreview ? (
            <button
              type="button"
              onClick={() => onPreview(contentAsset)}
              className="inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-purple-200 bg-white px-2 text-xs font-black text-purple-700"
              data-testid={`${testId}-preview`}
            >
              <Eye size={12} /> Preview
            </button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(contentAsset)}
              className="inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-purple-200 bg-white px-2 text-xs font-black text-purple-700"
              data-testid={`${testId}-edit`}
            >
              <Pencil size={12} /> Edit
            </button>
          ) : null}
        </div>
      </div>
      {contentAsset.ctaLabel || contentAsset.ctaUrl ? (
        <p className="mt-2 text-xs font-bold text-[#7d6b65]">
          CTA:{" "}
          {[contentAsset.ctaLabel, contentAsset.ctaUrl]
            .filter(Boolean)
            .join(" -> ")}
        </p>
      ) : null}
      {contentAsset.body && contentAsset.body !== contentAsset.subject ? (
        <p className="mt-2 rounded-lg bg-white p-3 text-sm font-semibold text-[#5b4a46]">
          {contentAsset.body}
        </p>
      ) : null}
      {previewUrls.length ? (
        <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {previewUrls.map((url) => (
            <MediaPreviewTile key={url} url={url} label={contentAsset.title} />
          ))}
        </div>
      ) : null}
      {contentAsset.lovableExternalId ? (
        <p className="mt-2 break-all text-xs font-bold text-[#8b7a73]">
          Lovable ID: {contentAsset.lovableExternalId}
        </p>
      ) : null}
    </div>
  );
}

function ContentUsageList({
  usages,
  testId,
  onOpenCampaign,
  onOpenJourney,
  compact = false,
}: {
  usages: ContentUsage[];
  testId: string;
  onOpenCampaign?: (campaignId: string) => void;
  onOpenJourney?: (journeyId: string) => void;
  compact?: boolean;
}) {
  if (!usages.length) {
    return (
      <div
        className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-3 text-sm font-bold text-[#8b7a73]"
        data-testid={testId}
      >
        Not linked to a campaign or journey yet.
      </div>
    );
  }
  return (
    <div
      className={
        compact
          ? "grid gap-2"
          : "rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3"
      }
      data-testid={testId}
    >
      {!compact ? (
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
          Used in campaigns and journeys
        </p>
      ) : null}
      <div className={`grid gap-2 ${compact ? "" : "mt-3"}`}>
        {usages.map((usage) => {
          const canOpenCampaign =
            usage.kind === "campaign" &&
            Boolean(usage.campaignId) &&
            Boolean(onOpenCampaign);
          const canOpenJourney =
            usage.kind === "journey" &&
            Boolean(usage.journeyId) &&
            Boolean(onOpenJourney);
          return (
            <article
              key={usage.key}
              className="rounded-lg border border-[#eadfd5] bg-white px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill
                      className={
                        usage.kind === "campaign"
                          ? "bg-blue-50 text-blue-800"
                          : "bg-purple-50 text-purple-800"
                      }
                    >
                      {usage.kind === "campaign" ? "Campaign" : "Journey"}
                    </Pill>
                    <Pill className={channelClass(usage.channel)}>
                      {channelLabel[usage.channel]}
                    </Pill>
                    <Pill className={statusClass(usage.status)}>
                      {usage.status}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm font-black text-[#241133]">
                    {usage.label}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[#7d6b65]">
                    {usage.detail}
                  </p>
                </div>
                {canOpenCampaign ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (usage.campaignId) onOpenCampaign?.(usage.campaignId);
                    }}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-purple-200 bg-white px-2 text-xs font-black text-purple-700"
                    data-testid={`button-marketing-open-content-usage-${usage.key}`}
                  >
                    <ExternalLink size={12} /> Open
                  </button>
                ) : null}
                {canOpenJourney ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (usage.journeyId) onOpenJourney?.(usage.journeyId);
                    }}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-purple-200 bg-white px-2 text-xs font-black text-purple-700"
                    data-testid={`button-marketing-open-content-usage-${usage.key}`}
                  >
                    <ExternalLink size={12} /> Open
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function LockedSendPanel() {
  return (
    <div
      className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
      data-testid="marketing-send-readiness-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700">
            <Send size={18} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black">Email campaign sending is enabled.</h3>
            <p className="mt-1 text-sm font-semibold text-emerald-800">
              Email sends use the existing VYVA communications dispatcher and
              Resend. WhatsApp and social channels remain planning-only for now.
            </p>
          </div>
        </div>
        <Pill className="bg-emerald-100 text-emerald-800">
          <CheckCircle2 size={13} className="mr-1" /> Email enabled
        </Pill>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#241133]">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FloatingPanelPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined" || !document.body) return <>{children}</>;
  return createPortal(children, document.body);
}

function SyncRunDiagnostics({ run }: { run: SyncRun }) {
  const exported = syncCountItems(run.summary, "exported");
  const imported = syncCountItems(run.summary, "imported");
  const skipped = syncCountItems(run.summary, "skipped");
  const parity = syncParityItems(run.summary);
  const unmappedCount = syncUnmappedCount(run.summary);
  const unmappedCampaignRecipientCount = syncUnmappedCampaignRecipientCount(
    run.summary,
  );
  const unmappedSample = syncUnmappedSample(run.summary);
  const fieldCoverage = syncFieldCoverageItems(run.summary);
  const exportMetadata = syncExportMetadata(run.summary);
  const hasExportMetadata = Boolean(
    exportMetadata.dataset ||
    exportMetadata.exportedAt ||
    exportMetadata.cursor ||
    exportMetadata.apiUrl ||
    exportMetadata.topLevelKeys.length,
  );
  if (
    !exported.length &&
    !imported.length &&
    !skipped.length &&
    !parity.length &&
    !unmappedCount &&
    !unmappedCampaignRecipientCount &&
    !fieldCoverage.length &&
    !hasExportMetadata
  )
    return null;
  return (
    <div
      className="mt-3 grid gap-2 rounded-xl bg-white p-3 text-xs font-bold text-[#7d6b65]"
      data-testid={`marketing-sync-diagnostics-${run.id}`}
    >
      {hasExportMetadata ? (
        <div
          className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-950"
          data-testid={`marketing-sync-export-metadata-${run.id}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="uppercase tracking-[0.12em] text-blue-800">
                Lovable export snapshot
              </p>
              <p className="mt-1 font-black">
                Dataset: {exportMetadata.dataset || "unknown"}
              </p>
              {exportMetadata.exportedAt ? (
                <p className="mt-1 font-semibold">
                  Exported at {formatDate(exportMetadata.exportedAt)}
                </p>
              ) : null}
              {exportMetadata.apiUrl ? (
                <p className="mt-1 font-semibold">
                  Endpoint: {exportMetadata.apiUrl}
                </p>
              ) : null}
              {exportMetadata.cursor ? (
                <p className="mt-1 font-semibold">
                  Cursor: {exportMetadata.cursor}
                </p>
              ) : null}
            </div>
            <Pill className="bg-white text-blue-800">imported snapshot</Pill>
          </div>
          {exportMetadata.topLevelKeys.length ? (
            <p className="mt-2 rounded-lg bg-white p-2 font-semibold text-[#5b4a46]">
              Top-level export keys:{" "}
              {exportMetadata.topLevelKeys.slice(0, 18).join(", ")}
              {exportMetadata.topLevelKeys.length > 18
                ? `, +${exportMetadata.topLevelKeys.length - 18} more`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      {parity.length ? (
        <div data-testid={`marketing-sync-parity-${run.id}`}>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">
            Parity checklist
          </p>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            {parity.map((item) => {
              const className =
                item.status === "missing"
                  ? "border-red-100 bg-red-50 text-red-800"
                  : item.status === "review"
                    ? "border-amber-100 bg-amber-50 text-amber-800"
                    : item.status === "derived"
                      ? "border-blue-100 bg-blue-50 text-blue-800"
                      : "border-emerald-100 bg-emerald-50 text-emerald-800";
              const detail =
                item.status === "missing"
                  ? `${item.missing} missing`
                  : item.status === "review"
                    ? `${item.skipped} skipped`
                    : item.status === "derived"
                      ? "derived"
                      : "complete";
              return (
                <div
                  key={item.key}
                  className={`rounded-lg border px-3 py-2 ${className}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black">{item.label}</span>
                    <span>{detail}</span>
                  </div>
                  <p className="mt-1 font-semibold">
                    Lovable {item.exported} / VYVA {item.imported}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {exported.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">
            Exported by Lovable
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {exported.map((item) => (
              <Pill
                key={`exported-${item.key}`}
                className="bg-blue-50 text-blue-800"
              >
                {item.label}: {item.value}
              </Pill>
            ))}
          </div>
        </div>
      ) : null}
      {imported.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">
            Imported into VYVA
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {imported.map((item) => (
              <Pill
                key={`imported-${item.key}`}
                className="bg-emerald-50 text-emerald-800"
              >
                {item.label}: {item.value}
              </Pill>
            ))}
          </div>
        </div>
      ) : null}
      {skipped.length || unmappedCount || unmappedCampaignRecipientCount ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">
            Needs review
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {skipped.map((item) => (
              <Pill
                key={`skipped-${item.key}`}
                className="bg-amber-50 text-amber-800"
              >
                Skipped {item.label}: {item.value}
              </Pill>
            ))}
            {unmappedCount ? (
              <Pill className="bg-amber-50 text-amber-800">
                Unmapped list members: {unmappedCount}
              </Pill>
            ) : null}
            {unmappedCampaignRecipientCount ? (
              <Pill className="bg-amber-50 text-amber-800">
                Unmapped campaign recipients: {unmappedCampaignRecipientCount}
              </Pill>
            ) : null}
          </div>
          {unmappedSample.length ? (
            <p className="mt-2 font-semibold">
              Examples: {unmappedSample.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {fieldCoverage.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-[#8b7a73]">
            Field coverage
          </p>
          <div className="mt-1 grid gap-1.5">
            {fieldCoverage.map((item) => (
              <div
                key={item.entity}
                className="rounded-lg border border-[#f0e7df] bg-[#fffaf4] px-3 py-2"
              >
                <p className="font-black text-[#241133]">
                  {item.entity}: {item.firstClass} of {item.exported} fields
                  mapped first-class
                </p>
                {item.metadataOnly ? (
                  <p className="mt-1 font-semibold">
                    Metadata-only:{" "}
                    {item.metadataOnlyFields.slice(0, 6).join(", ")}
                    {item.metadataOnlyFields.length > 6
                      ? ` +${item.metadataOnlyFields.length - 6}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-1 font-semibold text-emerald-700">
                    No extra metadata-only fields.
                  </p>
                )}
                {item.exportedFields.length ||
                item.firstClassFields.length ||
                item.metadataOnlyFields.length ? (
                  <details
                    className="mt-2 rounded-lg border border-[#eadfd5] bg-white p-2"
                    data-testid={`marketing-sync-field-coverage-${run.id}-${item.entity}`}
                  >
                    <summary className="cursor-pointer font-black text-[#241133]">
                      View field map
                    </summary>
                    <div className="mt-2 grid gap-2">
                      {item.metadataOnlyFields.length ? (
                        <p>
                          <span className="text-amber-800">Metadata-only:</span>{" "}
                          {item.metadataOnlyFields.join(", ")}
                        </p>
                      ) : null}
                      {item.firstClassFields.length ? (
                        <p>
                          <span className="text-emerald-800">
                            Mapped first-class:
                          </span>{" "}
                          {item.firstClassFields.join(", ")}
                        </p>
                      ) : null}
                      {item.exportedFields.length ? (
                        <p>
                          <span className="text-blue-800">All exported:</span>{" "}
                          {item.exportedFields.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <LovableDestinationMap summary={run.summary} />
    </div>
  );
}

function LovableDestinationMap({
  summary,
}: {
  summary: Record<string, unknown>;
}) {
  const rows = lovableDestinationRows.map((row) => ({
    ...row,
    count: syncDestinationCount(summary, row),
  }));
  const hasCounts = rows.some((row) => row.count > 0);
  return (
    <div
      className="mt-3 rounded-lg bg-white p-3"
      data-testid="marketing-lovable-destination-map"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
            Where Lovable data appears
          </p>
          <p className="mt-1 text-xs font-semibold text-[#8b7a73]">
            Use this map to find each imported Lovable source in VYVA after
            preview or sync.
          </p>
        </div>
        <Pill
          className={
            hasCounts
              ? "bg-emerald-50 text-emerald-800"
              : "bg-[#f5eee8] text-[#7d6b65]"
          }
        >
          {hasCounts ? "mapped" : "waiting for sync"}
        </Pill>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="rounded-lg border border-[#f0e7df] bg-[#fffaf4] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-black text-[#241133]">{row.label}</p>
                <p className="mt-1 text-xs font-semibold text-[#8b7a73]">
                  {row.sourceHint}
                </p>
              </div>
              <Pill
                className={
                  row.count > 0
                    ? "bg-blue-50 text-blue-800"
                    : "bg-[#f5eee8] text-[#7d6b65]"
                }
              >
                {row.count}
              </Pill>
            </div>
            <p className="mt-2 text-xs font-black text-purple-800">
              Destination: {row.destination}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#5b4a46]">
              {row.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-[#E5D8CA] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const textareaClass =
  "min-h-[92px] w-full rounded-xl border border-[#E5D8CA] bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const floatingContentPanelClass =
  "fixed bottom-6 left-1/2 top-20 z-[9999] w-[min(980px,calc(100vw-3rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border-2 border-purple-300 bg-white p-4 shadow-[0_24px_80px_rgba(36,17,51,0.35)]";

export default function MarketingAdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    marketingTabFromPath(location.pathname),
  );
  const [contactView, setContactView] = useState<ContactView>("contacts");
  const [contactPage, setContactPage] = useState(1);
  const [summary, setSummary] = useState<MarketingSummary>(emptySummary);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [content, setContent] = useState<ContentAsset[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MarketingMediaAsset[]>([]);
  const [analyticsTotals, setAnalyticsTotals] =
    useState<MarketingAnalyticsTotals>(
      emptySummary.analyticsTotals ?? {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        replied: 0,
        socialEngagement: 0,
      },
    );
  const [campaignMetrics, setCampaignMetrics] = useState<
    MarketingCampaignMetric[]
  >([]);
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [audiences, setAudiences] = useState<MarketingAudience[]>([]);
  const [journeyEnrollments, setJourneyEnrollments] = useState<
    JourneyEnrollment[]
  >([]);
  const [syncState, setSyncState] = useState<SyncState>(emptySync);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState("");
  const [metaConnectionBusy, setMetaConnectionBusy] = useState(false);
  const [exportPreview, setExportPreview] =
    useState<LovableExportPreview | null>(null);
  const [exportPreviewRunning, setExportPreviewRunning] = useState(false);
  const [exportPreviewFeedback, setExportPreviewFeedback] = useState("");
  const [contactFeedback, setContactFeedback] = useState("");
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState("");
  const [campaignEmailSending, setCampaignEmailSending] = useState(false);
  const [campaignEmailFeedback, setCampaignEmailFeedback] = useState("");
  const [socialPublishFeedback, setSocialPublishFeedback] = useState<
    Record<string, string>
  >({});
  const [dueEmailSending, setDueEmailSending] = useState(false);
  const [dueEmailFeedback, setDueEmailFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [audienceFilter, setAudienceFilter] = useState<Audience | "all">("all");
  const [contentSourceFilter, setContentSourceFilter] = useState("all");
  const [contactSourceFilter, setContactSourceFilter] = useState("all");
  const [contactConsentFilter, setContactConsentFilter] = useState("all");
  const [contactLanguageFilter, setContactLanguageFilter] = useState("all");
  const [contactCategoryFilter, setContactCategoryFilter] = useState("all");
  const [contactVerticalFilter, setContactVerticalFilter] = useState("all");
  const [contactMarketFilter, setContactMarketFilter] = useState("all");
  const [contactListFilter, setContactListFilter] = useState("all");
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>(() =>
    emptyCampaignDraft(),
  );
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );
  const [campaignEditDraft, setCampaignEditDraft] = useState<CampaignEditDraft>(
    () => emptyCampaignEditDraft(),
  );
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignPage, setCampaignPage] = useState(1);
  const [contentPage, setContentPage] = useState(1);
  const [showFoundationBanner, setShowFoundationBanner] = useState(() => {
    if (typeof window === "undefined") return true;
    return (
      window.localStorage.getItem(MARKETING_FOUNDATION_BANNER_DISMISSED_KEY) !==
      "true"
    );
  });
  const [confirmingCampaignDeleteId, setConfirmingCampaignDeleteId] = useState<
    string | null
  >(null);
  const [confirmingCampaignSendId, setConfirmingCampaignSendId] = useState<
    string | null
  >(null);
  const [confirmingDueEmailSend, setConfirmingDueEmailSend] = useState(false);
  const [editingJourneyId, setEditingJourneyId] = useState<
    string | "new" | null
  >(null);
  const [journeyEditDraft, setJourneyEditDraft] = useState<JourneyEditDraft>(
    () => emptyJourneyEditDraft(),
  );
  const [journeyBuilderStage, setJourneyBuilderStage] =
    useState<JourneyBuilderStage>(1);
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeyActivating, setJourneyActivating] = useState(false);
  const [journeyFeedback, setJourneyFeedback] = useState("");
  const [confirmingJourneyDeleteId, setConfirmingJourneyDeleteId] = useState<
    string | null
  >(null);
  const [contentDraft, setContentDraft] = useState<ContentDraft>(() =>
    emptyContentDraft(),
  );
  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    null,
  );
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [contentEditDraft, setContentEditDraft] =
    useState<ContentEditDraft | null>(null);
  const [contentDrawerMode, setContentDrawerMode] = useState<
    "preview" | "edit" | null
  >(null);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentFeedback, setContentFeedback] = useState("");
  const [contentActionFeedback, setContentActionFeedback] = useState("");
  const [confirmingContentDeleteId, setConfirmingContentDeleteId] = useState<
    string | null
  >(null);
  const [bulkTranslateOpen, setBulkTranslateOpen] = useState(false);
  const [bulkTranslateSourceIds, setBulkTranslateSourceIds] = useState<
    string[]
  >([]);
  const [bulkTranslateLanguages, setBulkTranslateLanguages] = useState<
    string[]
  >(["es"]);
  const [bulkTranslatePreview, setBulkTranslatePreview] = useState<
    BulkTranslatePreviewItem[]
  >([]);
  const [bulkTranslateRunning, setBulkTranslateRunning] = useState(false);
  const [bulkTranslateFeedback, setBulkTranslateFeedback] = useState("");
  const contentEditorPanelRef = useRef<HTMLDivElement | null>(null);
  const contentPreviewPanelRef = useRef<HTMLDivElement | null>(null);
  const [editingMediaAssetId, setEditingMediaAssetId] = useState<string | null>(
    null,
  );
  const [mediaEditDraft, setMediaEditDraft] = useState<MediaEditDraft | null>(
    null,
  );
  const [mediaSaving, setMediaSaving] = useState(false);
  const [mediaFeedback, setMediaFeedback] = useState("");
  const [confirmingMediaDeleteId, setConfirmingMediaDeleteId] = useState<
    string | null
  >(null);
  const mediaEditorPanelRef = useRef<HTMLDivElement | null>(null);
  const [contactDraft, setContactDraft] = useState<ContactDraft>({
    fullName: "",
    audienceType: "b2b",
    email: "",
    phoneNumber: "",
    whatsappNumber: "",
    roleLabel: "",
    companyName: "",
    language: "",
    category: "",
    vertical: "",
    market: "",
    tags: "",
  });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactEditDraft, setContactEditDraft] =
    useState<ContactEditDraft | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [confirmingContactDeleteId, setConfirmingContactDeleteId] = useState<
    string | null
  >(null);
  const contactEditorPanelRef = useRef<HTMLDivElement | null>(null);
  const [audienceDraft, setAudienceDraft] = useState<AudienceDraft>({
    name: "",
    listType: "dynamic",
    description: "",
    rulesText: '{\n  "market": "Spain"\n}',
    contactExternalIds: "",
  });
  const [editingAudienceId, setEditingAudienceId] = useState<string | null>(
    null,
  );
  const [audienceEditDraft, setAudienceEditDraft] =
    useState<AudienceEditDraft | null>(null);
  const [audienceSaving, setAudienceSaving] = useState(false);
  const [audienceFeedback, setAudienceFeedback] = useState("");
  const [confirmingAudienceDeleteId, setConfirmingAudienceDeleteId] = useState<
    string | null
  >(null);
  const audienceEditorPanelRef = useRef<HTMLDivElement | null>(null);
  const [expandedAudienceMemberIds, setExpandedAudienceMemberIds] = useState<
    Set<string>
  >(() => new Set());

  async function refreshAll() {
    const marketingDataRequest = Promise.all([
      api<MarketingSummary>("/api/admin/marketing/summary"),
      api<{ campaigns: Campaign[] }>("/api/admin/marketing/campaigns"),
      api<{ journeys: Journey[] }>("/api/admin/marketing/journeys"),
      api<{ enrollments: JourneyEnrollment[] }>(
        "/api/admin/marketing/journey-enrollments",
      ),
      api<{ content: ContentAsset[] }>("/api/admin/marketing/content"),
      api<{ mediaAssets: MarketingMediaAsset[] }>("/api/admin/marketing/media"),
      api<{
        totals: MarketingAnalyticsTotals;
        metrics: MarketingCampaignMetric[];
      }>("/api/admin/marketing/analytics"),
      api<{ contacts: MarketingContact[] }>("/api/admin/marketing/contacts"),
      api<{ audiences: MarketingAudience[] }>("/api/admin/marketing/audiences"),
    ]).then(
      ([
        summaryBody,
        campaignBody,
        journeyBody,
        enrollmentBody,
        contentBody,
        mediaBody,
        analyticsBody,
        contactBody,
        audienceBody,
      ]) => {
        setSummary(summaryBody);
        setCampaigns(campaignBody.campaigns);
        setJourneys(journeyBody.journeys);
        setJourneyEnrollments(enrollmentBody.enrollments);
        setContent(contentBody.content);
        setMediaAssets(mediaBody.mediaAssets);
        setAnalyticsTotals(analyticsBody.totals);
        setCampaignMetrics(analyticsBody.metrics);
        setContacts(contactBody.contacts);
        setAudiences(audienceBody.audiences);
      },
    );

    const syncRequest = api<SyncState>(MARKETING_SYNC_ENDPOINT).then(
      (syncBody) => {
        setSyncState(normalizeSyncState(syncBody));
      },
    );

    const [marketingResult, syncResult] = await Promise.allSettled([
      marketingDataRequest,
      syncRequest,
    ]);
    const failed = [marketingResult, syncResult].find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed) {
      throw failed.reason instanceof Error
        ? failed.reason
        : new Error("Marketing admin data could not be refreshed.");
    }
  }

  useEffect(() => {
    refreshAll().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    const nextTab = marketingTabFromPath(location.pathname);
    setActiveTab((current) => (current === nextTab ? current : nextTab));

    const normalizedPath =
      location.pathname.replace(/\/+$/, "") || MARKETING_BASE_PATH;
    const canonicalPath = marketingTabPath(nextTab);
    if (
      normalizedPath.startsWith(`${MARKETING_BASE_PATH}/`) &&
      normalizedPath !== canonicalPath
    ) {
      navigate(canonicalPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const status = new URLSearchParams(location.search).get("meta_connection");
    if (!status) return;
    const feedback = status === "connected"
      ? "Meta connected. The available Facebook Pages and linked Instagram accounts are now visible below."
      : status === "missing_config"
        ? "Add META_APP_ID and META_APP_SECRET to the Admin deployment before connecting Meta."
        : "Meta could not be connected. Check the Meta app permissions and try again.";
    setMessage(feedback);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  function openMarketingTab(tab: Tab) {
    setActiveTab(tab);
    navigate(marketingTabPath(tab));
  }

  const contentById = useMemo(
    () => new Map(content.map((item) => [item.id, item])),
    [content],
  );
  const contentTitleById = useMemo(
    () => new Map(content.map((item) => [item.id, item.title])),
    [content],
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns],
  );
  const journeyById = useMemo(
    () => new Map(journeys.map((journey) => [journey.id, journey])),
    [journeys],
  );
  const contactById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );
  const contentUsageById = useMemo(
    () =>
      new Map(
        content.map((item) => [
          item.id,
          contentUsageFor(item, campaigns, journeys),
        ]),
      ),
    [campaigns, content, journeys],
  );
  const contactByImportId = useMemo(() => {
    const map = new Map<string, MarketingContact>();
    for (const contact of contacts) {
      for (const key of [
        ...lookupKeysForExternalId(contact.id, ["contact"]),
        ...lookupKeysForExternalId(contact.lovableExternalId, ["contact"]),
      ]) {
        map.set(key, contact);
      }
    }
    return map;
  }, [contacts]);
  const contactByEmail = useMemo(() => {
    const map = new Map<string, MarketingContact>();
    for (const contact of contacts) {
      const email = lower(contact.email);
      if (email) map.set(email, contact);
    }
    return map;
  }, [contacts]);
  const contentSourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of content) {
      if (isMissingLovableContentAsset(item)) continue;
      const key = contentOriginKey(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: contentSourceLabel(key), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [content]);

  const visibleCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        const targetAudience = campaignTargetAudience(campaign, audiences);
        const campaignMatchesSearch = matchesSearch(search, [
          campaign.id,
          campaign.name,
          campaign.objective,
          campaign.status,
          campaign.audienceType,
          campaign.scheduleStartsAt,
          campaign.scheduleEndsAt,
          campaign.timezone,
          campaign.source,
          campaign.lovableExternalId,
          campaign.metadata,
          targetAudience?.name,
          targetAudience?.lovableExternalId,
          ...(campaign.channels ?? []).flatMap((item) => [
            item.channel,
            item.status,
            item.sendCapability,
            item.scheduledAt,
            contentTitleById.get(item.contentAssetId ?? ""),
          ]),
          ...(campaign.recipients ?? []).flatMap((recipient) => [
            recipient.recipient,
            recipient.channel,
            recipient.status,
            recipient.snapshot,
          ]),
        ]);
        const matchesAudience =
          audienceFilter === "all" || campaign.audienceType === audienceFilter;
        const matchesChannel =
          channelFilter === "all" ||
          campaign.channels.some((item) => item.channel === channelFilter);
        return campaignMatchesSearch && matchesAudience && matchesChannel;
      }),
    [
      campaigns,
      search,
      audienceFilter,
      channelFilter,
      audiences,
      contentTitleById,
    ],
  );

  const campaignPageCount = Math.max(
    1,
    Math.ceil(visibleCampaigns.length / CAMPAIGN_PAGE_SIZE),
  );
  const campaignPageStart =
    visibleCampaigns.length === 0
      ? 0
      : (campaignPage - 1) * CAMPAIGN_PAGE_SIZE + 1;
  const campaignPageEnd = Math.min(
    visibleCampaigns.length,
    campaignPage * CAMPAIGN_PAGE_SIZE,
  );
  const pagedCampaigns = useMemo(
    () =>
      visibleCampaigns.slice(
        (campaignPage - 1) * CAMPAIGN_PAGE_SIZE,
        campaignPage * CAMPAIGN_PAGE_SIZE,
      ),
    [campaignPage, visibleCampaigns],
  );

  useEffect(() => {
    setCampaignPage(1);
  }, [search, audienceFilter, channelFilter]);

  useEffect(() => {
    if (campaignPage <= campaignPageCount) return;
    setCampaignPage(campaignPageCount);
  }, [campaignPage, campaignPageCount]);

  const visibleCampaignMetrics = useMemo(
    () =>
      campaignMetrics.filter((metric) => {
        const campaign = metric.campaignId
          ? (campaignById.get(metric.campaignId) ?? null)
          : null;
        const metricMatchesSearch = matchesSearch(search, [
          metric.id,
          metric.campaignId,
          metric.campaignName,
          metric.channel,
          metric.metricDate,
          metric.source,
          metric.lovableExternalId,
          metric.metadata,
          campaign?.name,
          campaign?.objective,
          campaign?.source,
          campaign?.lovableExternalId,
        ]);
        const matchesAudience =
          audienceFilter === "all" ||
          !campaign ||
          campaign.audienceType === audienceFilter;
        const matchesChannel =
          channelFilter === "all" ||
          metric.channel === channelFilter ||
          metric.channel === "all";
        return metricMatchesSearch && matchesAudience && matchesChannel;
      }),
    [campaignMetrics, search, audienceFilter, channelFilter, campaignById],
  );

  const campaignMetricSummaryByCampaignId = useMemo(() => {
    const grouped = new Map<string, MarketingCampaignMetric[]>();
    for (const metric of campaignMetrics) {
      if (!metric.campaignId) continue;
      grouped.set(metric.campaignId, [
        ...(grouped.get(metric.campaignId) ?? []),
        metric,
      ]);
    }
    return new Map(
      Array.from(grouped.entries()).map(([campaignId, metrics]) => [
        campaignId,
        summarizeCampaignMetrics(metrics),
      ]),
    );
  }, [campaignMetrics]);

  const visibleContent = useMemo(
    () =>
      content.filter((item) => {
        if (isMissingLovableContentAsset(item)) return false;
        const contentMatchesSearch = matchesSearch(search, [
          item.id,
          item.title,
          item.channel,
          item.language,
          item.status,
          item.subject,
          item.body,
          item.htmlBody,
          item.ctaLabel,
          item.ctaUrl,
          item.source,
          item.lovableExternalId,
          item.designJson,
          item.mediaAssets,
          item.metadata,
        ]);
        const matchesChannel =
          channelFilter === "all" || item.channel === channelFilter;
        const matchesSource =
          contentSourceFilter === "all" ||
          contentOriginKey(item) === contentSourceFilter;
        return contentMatchesSearch && matchesChannel && matchesSource;
      }),
    [content, search, channelFilter, contentSourceFilter],
  );

  const contentPageCount = Math.max(
    1,
    Math.ceil(visibleContent.length / CONTENT_PAGE_SIZE),
  );
  const contentPageStart =
    visibleContent.length === 0 ? 0 : (contentPage - 1) * CONTENT_PAGE_SIZE + 1;
  const contentPageEnd = Math.min(
    visibleContent.length,
    contentPage * CONTENT_PAGE_SIZE,
  );
  const pagedContent = useMemo(
    () =>
      visibleContent.slice(
        (contentPage - 1) * CONTENT_PAGE_SIZE,
        contentPage * CONTENT_PAGE_SIZE,
      ),
    [contentPage, visibleContent],
  );

  useEffect(() => {
    setContentPage(1);
  }, [search, channelFilter, contentSourceFilter]);

  useEffect(() => {
    if (contentPage <= contentPageCount) return;
    setContentPage(contentPageCount);
  }, [contentPage, contentPageCount]);

  const visibleContentIdSet = useMemo(
    () => new Set(visibleContent.map((item) => item.id)),
    [visibleContent],
  );
  const contentIdSet = useMemo(
    () => new Set(content.map((item) => item.id)),
    [content],
  );

  const visibleMediaAssets = useMemo(
    () =>
      mediaAssets.filter((item) => {
        const matchesText = matchesSearch(search, [
          item.id,
          item.contentAssetId,
          item.contentTitle,
          item.originalUrl,
          item.localUrl,
          item.assetType,
          item.status,
          item.source,
          item.lovableExternalId,
          item.metadata,
        ]);
        const matchesSource =
          contentSourceFilter === "all" ||
          (item.contentAssetId
            ? visibleContentIdSet.has(item.contentAssetId)
            : item.source === contentSourceFilter);
        return matchesText && matchesSource;
      }),
    [mediaAssets, search, contentSourceFilter, visibleContentIdSet],
  );

  const contactSourceOptions = useMemo(
    () => countedOptions(contacts.map((contact) => contact.source)),
    [contacts],
  );
  const contactConsentOptions = useMemo(
    () => countedOptions(contacts.map((contact) => contact.consentStatus)),
    [contacts],
  );
  const contactLanguageOptions = useMemo(
    () => countedOptions(contacts.map((contact) => contact.language)),
    [contacts],
  );
  const contactCategoryOptions = useMemo(
    () => countedOptions(contacts.map((contact) => contact.category)),
    [contacts],
  );
  const contactVerticalOptions = useMemo(
    () => countedOptions(contacts.map((contact) => contact.vertical)),
    [contacts],
  );
  const contactMarketOptions = useMemo(
    () => countedOptions(contacts.map((contact) => contact.market)),
    [contacts],
  );
  const contactListOptions = useMemo(
    () => countedOptions(contacts.flatMap((contact) => contact.lists ?? [])),
    [contacts],
  );
  const contactFiltersActive = [
    contactSourceFilter,
    contactConsentFilter,
    contactLanguageFilter,
    contactCategoryFilter,
    contactVerticalFilter,
    contactMarketFilter,
    contactListFilter,
  ].some((value) => value !== "all");

  const visibleContacts = useMemo(
    () =>
      contacts.filter((contact) => {
        const matchesSearch =
          !search || contactSearchText(contact).includes(search.toLowerCase());
        const matchesAudience =
          audienceFilter === "all" || contact.audienceType === audienceFilter;
        const matchesSource = valueMatchesFilter(
          contact.source,
          contactSourceFilter,
        );
        const matchesConsent = valueMatchesFilter(
          contact.consentStatus,
          contactConsentFilter,
        );
        const matchesLanguage = valueMatchesFilter(
          contact.language,
          contactLanguageFilter,
        );
        const matchesCategory = valueMatchesFilter(
          contact.category,
          contactCategoryFilter,
        );
        const matchesVertical = valueMatchesFilter(
          contact.vertical,
          contactVerticalFilter,
        );
        const matchesMarket = valueMatchesFilter(
          contact.market,
          contactMarketFilter,
        );
        const matchesList =
          contactListFilter === "all" ||
          contact.lists.some((list) =>
            valueMatchesFilter(list, contactListFilter),
          );
        return (
          matchesSearch &&
          matchesAudience &&
          matchesSource &&
          matchesConsent &&
          matchesLanguage &&
          matchesCategory &&
          matchesVertical &&
          matchesMarket &&
          matchesList
        );
      }),
    [
      contacts,
      search,
      audienceFilter,
      contactSourceFilter,
      contactConsentFilter,
      contactLanguageFilter,
      contactCategoryFilter,
      contactVerticalFilter,
      contactMarketFilter,
      contactListFilter,
    ],
  );
  const contactsPerPage = 8;
  const contactPageCount = Math.max(
    1,
    Math.ceil(visibleContacts.length / contactsPerPage),
  );
  const safeContactPage = Math.min(contactPage, contactPageCount);
  const paginatedContacts = visibleContacts.slice(
    (safeContactPage - 1) * contactsPerPage,
    safeContactPage * contactsPerPage,
  );

  useEffect(() => {
    setContactPage(1);
  }, [
    search,
    audienceFilter,
    contactConsentFilter,
    contactSourceFilter,
    contactLanguageFilter,
    contactCategoryFilter,
    contactVerticalFilter,
    contactMarketFilter,
    contactListFilter,
  ]);

  const visibleAudiences = useMemo(
    () =>
      audiences.filter((audience) => {
        return matchesSearch(search, [
          audience.id,
          audience.name,
          audience.description,
          audience.listType,
          audience.source,
          audience.lovableExternalId,
          audience.rules,
          audience.metadata,
          ...(audience.contactExternalIds ?? []),
          ...(audience.unmappedContactExternalIds ?? []),
          ...(audience.memberPreview ?? []).flatMap((member) => [
            member.fullName,
            member.email,
            member.phoneNumber,
            member.whatsappNumber,
            member.companyName,
            member.roleLabel,
            member.lovableExternalId,
            member.contactExternalId,
          ]),
        ]);
      }),
    [audiences, search],
  );
  const audienceDraftMemberIds = useMemo(
    () => parseAudienceMemberIds(audienceDraft),
    [audienceDraft],
  );
  const audienceEditMemberIds = useMemo(
    () => parseAudienceMemberIds(audienceEditDraft),
    [audienceEditDraft],
  );
  const audienceDraftMemberContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        contactMatchesMemberIds(contact, audienceDraftMemberIds),
      ),
    [contacts, audienceDraftMemberIds],
  );
  const audienceEditMemberContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        contactMatchesMemberIds(contact, audienceEditMemberIds),
      ),
    [contacts, audienceEditMemberIds],
  );
  const audienceDraftCandidateContacts = useMemo(
    () =>
      contacts.filter(
        (contact) => !contactMatchesMemberIds(contact, audienceDraftMemberIds),
      ),
    [contacts, audienceDraftMemberIds],
  );
  const audienceEditCandidateContacts = useMemo(
    () =>
      contacts.filter(
        (contact) => !contactMatchesMemberIds(contact, audienceEditMemberIds),
      ),
    [contacts, audienceEditMemberIds],
  );

  const visibleJourneys = useMemo(
    () =>
      journeys.filter((journey) => {
        const targetAudience = journeyTargetAudience(journey, audiences);
        const journeyMatchesSearch = matchesSearch(search, [
          journey.id,
          journey.name,
          journey.objective,
          journey.status,
          journey.audienceType,
          journey.triggerType,
          journey.triggerConfig,
          journey.goalType,
          journey.goalConfig,
          journey.source,
          journey.lovableExternalId,
          journey.metadata,
          targetAudience?.name,
          targetAudience?.lovableExternalId,
          ...(journey.steps ?? []).flatMap((step) => [
            step.kind,
            step.channel,
            step.status,
            step.templateKind,
            step.templateRef,
            step.config,
            step.metadata,
            contentTitleById.get(step.contentAssetId ?? ""),
          ]),
        ]);
        const matchesAudience =
          audienceFilter === "all" || journey.audienceType === audienceFilter;
        const matchesChannel =
          channelFilter === "all" ||
          journey.steps.some((step) => step.channel === channelFilter);
        return journeyMatchesSearch && matchesAudience && matchesChannel;
      }),
    [
      journeys,
      search,
      audienceFilter,
      channelFilter,
      audiences,
      contentTitleById,
    ],
  );

  const contactByJourneyEnrollmentId = useMemo(() => {
    const map = new Map<string, MarketingContact>();
    for (const enrollment of journeyEnrollments) {
      const directContact = enrollment.contactId
        ? (contactById.get(enrollment.contactId) ?? null)
        : null;
      const importedContact = enrollment.contactExternalId
        ? (lookupKeysForExternalId(enrollment.contactExternalId, ["contact"])
            .map((key) => contactByImportId.get(key) ?? null)
            .find((contact): contact is MarketingContact => Boolean(contact)) ??
          null)
        : null;
      const contact = directContact ?? importedContact;
      if (contact) map.set(enrollment.id, contact);
    }
    return map;
  }, [journeyEnrollments, contactById, contactByImportId]);

  const contactByCampaignRecipientId = useMemo(() => {
    const map = new Map<string, MarketingContact>();
    for (const campaign of campaigns) {
      for (const recipient of campaign.recipients ?? []) {
        const directContact = recipient.contactId
          ? (contactById.get(recipient.contactId) ?? null)
          : null;
        const importedContact =
          recipientContactLookupKeys(recipient)
            .map((key) => contactByImportId.get(key) ?? null)
            .find((contact): contact is MarketingContact => Boolean(contact)) ??
          null;
        const emailContact =
          contactByEmail.get(recipientEmailLookupKey(recipient)) ?? null;
        const contact = directContact ?? importedContact ?? emailContact;
        if (contact) map.set(recipient.id, contact);
      }
    }
    return map;
  }, [campaigns, contactById, contactByImportId, contactByEmail]);

  const visibleJourneyEnrollments = useMemo(
    () =>
      journeyEnrollments.filter((enrollment) => {
        const journey = journeyById.get(enrollment.journeyId) ?? null;
        const contact = contactByJourneyEnrollmentId.get(enrollment.id) ?? null;
        const enrollmentMatchesSearch = matchesSearch(search, [
          enrollment.id,
          enrollment.journeyId,
          enrollment.journeyName,
          enrollment.contactId,
          enrollment.contactExternalId,
          enrollment.status,
          enrollment.currentStepOrder,
          enrollment.enteredAt,
          enrollment.exitedAt,
          enrollment.lastActivityAt,
          enrollment.source,
          enrollment.lovableExternalId,
          enrollment.metadata,
          journey?.name,
          journey?.objective,
          journey?.source,
          journey?.lovableExternalId,
          contact?.fullName,
          contact?.email,
          contact?.phoneNumber,
          contact?.whatsappNumber,
          contact?.companyName,
          contact?.roleLabel,
          ...(enrollment.events ?? []).flatMap((event) => [
            event.id,
            event.eventType,
            event.stepOrder,
            event.eventAt,
            event.channel,
            event.metadata,
          ]),
        ]);
        const matchesAudience =
          audienceFilter === "all" ||
          !journey ||
          journey.audienceType === audienceFilter;
        const matchesChannel =
          channelFilter === "all" ||
          (journey?.steps ?? []).some(
            (step) => step.channel === channelFilter,
          ) ||
          (enrollment.events ?? []).some(
            (event) => event.channel === channelFilter,
          );
        return enrollmentMatchesSearch && matchesAudience && matchesChannel;
      }),
    [
      journeyEnrollments,
      search,
      audienceFilter,
      channelFilter,
      journeyById,
      contactByJourneyEnrollmentId,
    ],
  );

  const globalFiltersActive =
    Boolean(search.trim()) ||
    channelFilter !== "all" ||
    audienceFilter !== "all";
  const dashboardTotals = useMemo(
    () => ({
      campaigns: visibleCampaigns.length,
      audiences: new Set([
        ...visibleCampaigns.map((campaign) => campaign.audienceType),
        ...visibleContacts.map((contact) => contact.audienceType),
      ]).size,
      thisWeek: visibleCampaigns.filter((campaign) =>
        isDateThisWeek(campaign.scheduleStartsAt),
      ).length,
      scheduled: visibleCampaigns.filter(
        (campaign) => normalizeCampaignStatus(campaign.status) === "scheduled",
      ).length,
      published: visibleCampaigns.filter(
        (campaign) => normalizeCampaignStatus(campaign.status) === "published",
      ).length,
    }),
    [visibleCampaigns, visibleContacts],
  );
  const dashboardByChannel = useMemo(
    () =>
      CHANNELS.map((channel) => ({
        channel,
        campaigns: visibleCampaigns.filter((campaign) =>
          campaign.channels.some((item) => item.channel === channel),
        ).length,
        content: visibleContent.filter((item) => item.channel === channel)
          .length,
      })),
    [visibleCampaigns, visibleContent],
  );
  const dashboardByAudience = useMemo(
    () =>
      AUDIENCES.map((audienceType) => ({
        audienceType,
        campaigns: visibleCampaigns.filter(
          (campaign) => campaign.audienceType === audienceType,
        ).length,
        contacts: visibleContacts.filter((contact) =>
          campaignAllowsContact(audienceType, contact.audienceType),
        ).length,
      })),
    [visibleCampaigns, visibleContacts],
  );
  const dashboardChannelsToShow = useMemo(() => {
    if (channelFilter === "all") {
      const campaignChannels = dashboardByChannel.filter(
        (item) => item.campaigns > 0,
      );
      if (campaignChannels.length) return campaignChannels;
      const usefulChannels = dashboardByChannel.filter((item) => item.content > 0);
      return usefulChannels.length ? usefulChannels : dashboardByChannel;
    }
    const selectedChannel = dashboardByChannel.find(
      (item) => item.channel === channelFilter,
    );
    return selectedChannel ? [selectedChannel] : [];
  }, [channelFilter, dashboardByChannel]);
  const dashboardContentOnlyChannelsToShow = useMemo(() => {
    if (channelFilter !== "all") return [];
    return dashboardByChannel.filter(
      (item) => item.campaigns === 0 && item.content > 0,
    );
  }, [channelFilter, dashboardByChannel]);
  const dashboardAudiencesToShow = useMemo(() => {
    if (audienceFilter !== "all") {
      return dashboardByAudience.filter(
        (item) => item.audienceType === audienceFilter,
      );
    }
    return dashboardByAudience.filter(
      (item) => item.campaigns > 0 || item.contacts > 0,
    );
  }, [audienceFilter, dashboardByAudience]);

  const editingCampaign = useMemo(
    () =>
      campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null,
    [campaigns, editingCampaignId],
  );
  const editingJourney = useMemo(
    () =>
      editingJourneyId && editingJourneyId !== "new"
        ? (journeys.find((journey) => journey.id === editingJourneyId) ?? null)
        : null,
    [journeys, editingJourneyId],
  );
  const editingContent = useMemo(
    () => content.find((item) => item.id === editingContentId) ?? null,
    [content, editingContentId],
  );
  const editingMediaAsset = useMemo(
    () => mediaAssets.find((item) => item.id === editingMediaAssetId) ?? null,
    [mediaAssets, editingMediaAssetId],
  );
  const selectedContent = useMemo(
    () =>
      selectedContentId
        ? (content.find((item) => item.id === selectedContentId) ?? null)
        : null,
    [selectedContentId, content],
  );
  const selectedContentUsage = useMemo(
    () =>
      selectedContent ? (contentUsageById.get(selectedContent.id) ?? []) : [],
    [contentUsageById, selectedContent],
  );
  const selectedContentMediaAssets = useMemo(() => {
    if (!selectedContent) return [];
    return mediaAssets.filter(
      (item) => item.contentAssetId === selectedContent.id,
    );
  }, [mediaAssets, selectedContent]);
  const selectedContentDesignSummary = useMemo(
    () =>
      selectedContent ? designShapeSummary(selectedContent.designJson) : null,
    [selectedContent],
  );
  const selectedContentMediaPreviewUrls = useMemo(
    () =>
      selectedContent
        ? contentMediaPreviewUrls(selectedContent, selectedContentMediaAssets)
        : [],
    [selectedContent, selectedContentMediaAssets],
  );
  const syncRuns = Array.isArray(syncState.runs) ? syncState.runs : [];
  const latestSyncRun = syncRuns[0] ?? null;
  const missingLovableReferenceContent = useMemo(
    () =>
      content.filter(
        (item) => contentOriginKey(item) === "missing_lovable_reference",
      ),
    [content],
  );
  const missingLovableReferenceCount = useMemo(() => {
    if (!latestSyncRun) return missingLovableReferenceContent.length;
    return Math.max(
      missingLovableReferenceContent.length,
      syncCountValue(
        latestSyncRun.summary,
        "imported",
        "missingContentReferences",
      ),
      numberValue(
        recordValue(latestSyncRun.summary.contentSourceCounts)
          .missing_lovable_reference,
      ),
    );
  }, [latestSyncRun, missingLovableReferenceContent.length]);

  useEffect(() => {
    if (!selectedContentId || contentIdSet.has(selectedContentId)) return;
    if (editingContentId === selectedContentId && contentEditDraft) return;
    setSelectedContentId(null);
    setContentDrawerMode(null);
    setContentActionFeedback("");
    if (editingContentId === selectedContentId) {
      setEditingContentId(null);
      setContentEditDraft(null);
      setContentFeedback("");
    }
  }, [selectedContentId, contentIdSet, editingContentId, contentEditDraft]);

  useEffect(() => {
    if (activeTab !== "content") return;
    if (contentDrawerMode === "preview" && selectedContentId) {
      scrollToContentPanel(contentPreviewPanelRef);
    }
    if (contentDrawerMode === "edit" && editingContentId) {
      scrollToContentPanel(contentEditorPanelRef);
    }
  }, [activeTab, contentDrawerMode, selectedContentId, editingContentId]);

  const contentEmptyDiagnostic = useMemo(() => {
    if (content.length > 0 && visibleContent.length === 0) {
      return {
        title: "Content is loaded, but hidden by filters.",
        detail: `${content.length} content asset${content.length === 1 ? "" : "s"} are in VYVA. Clear search, channel, or content type filters to see them.`,
        action: "clear_filters" as const,
      };
    }
    if (content.length > 0) return null;
    if (!latestSyncRun) {
      return {
        title: "No Lovable content has been imported yet.",
        detail:
          "Run the one-way sync in Settings. If Lovable exports content, it will appear here as email templates, social posts, briefs, or assets.",
        action: "open_settings" as const,
      };
    }
    if (latestSyncRun.status === "failed") {
      return {
        title: "Last Lovable sync failed.",
        detail:
          latestSyncRun.error ||
          "Open Settings to review the sync error, fix the export endpoint or token, then run sync again.",
        action: "open_settings" as const,
      };
    }
    const exportedContent = syncCountValue(
      latestSyncRun.summary,
      "exported",
      "content",
    );
    const importedContent =
      syncCountValue(latestSyncRun.summary, "imported", "content") ||
      numberValue(latestSyncRun.summary.content);
    const skippedContent = syncCountValue(
      latestSyncRun.summary,
      "skipped",
      "content",
    );
    if (exportedContent > 0 && importedContent === 0) {
      return {
        title: "Lovable exported content, but VYVA did not import it.",
        detail: `Last sync saw ${exportedContent} content row${exportedContent === 1 ? "" : "s"}${skippedContent ? ` and skipped ${skippedContent}` : ""}. Open Settings to inspect skipped counts and field coverage.`,
        action: "open_settings" as const,
      };
    }
    if (importedContent > 0) {
      return {
        title: "Content was reported as imported, but none is loaded.",
        detail:
          "Refresh the admin page. If this stays empty, check the marketing content API and database rows.",
        action: "open_settings" as const,
      };
    }
    return {
      title: "Last sync did not receive content from Lovable.",
      detail:
        "Ask the Lovable export to include content, saved email templates, content briefs, social posts, templates, or assets, then run sync again.",
      action: "open_settings" as const,
    };
  }, [content.length, latestSyncRun, visibleContent.length]);
  const enrollmentsByJourneyId = useMemo(
    () => groupCount(journeyEnrollments, (item) => item.journeyId),
    [journeyEnrollments],
  );
  const activeEnrollmentsByJourneyId = useMemo(
    () =>
      groupCount(
        journeyEnrollments.filter((item) => item.status === "active"),
        (item) => item.journeyId,
      ),
    [journeyEnrollments],
  );
  const emailContentAssets = useMemo(
    () =>
      content.filter(
        (item) => item.channel === "email" && isSelectableCampaignContent(item),
      ),
    [content],
  );
  const draftEmailChannel =
    campaignChannelsWithPrimary(campaignEditDraft).find(
      (channel) => channel.channel === "email",
    ) ?? null;
  const selectedEmailContent = useMemo(
    () =>
      emailContentAssets.find(
        (item) => item.id === draftEmailChannel?.contentAssetId,
      ) ?? null,
    [draftEmailChannel?.contentAssetId, emailContentAssets],
  );
  const campaignDraftContentOptions = useMemo(
    () =>
      content.filter(
        (item) =>
          item.channel === campaignDraft.channel &&
          isSelectableCampaignContent(item),
      ),
    [campaignDraft.channel, content],
  );
  const campaignEditPrimaryContentOptions = useMemo(() => {
    const options = content.filter(
      (item) =>
        item.channel === campaignEditDraft.channel &&
        isSelectableCampaignContent(item),
    );
    const selected = campaignEditDraft.contentAssetId
      ? (content.find((item) => item.id === campaignEditDraft.contentAssetId) ??
        null)
      : null;
    return selected &&
      isSelectableCampaignContent(selected) &&
      !options.some((item) => item.id === selected.id)
      ? [selected, ...options]
      : options;
  }, [campaignEditDraft.channel, campaignEditDraft.contentAssetId, content]);
  const selectedCampaignDraftTargetAudience = useMemo(
    () =>
      audiences.find(
        (audience) => audience.id === campaignDraft.targetAudienceId,
      ) ?? null,
    [audiences, campaignDraft.targetAudienceId],
  );
  const editingContact = useMemo(
    () => contacts.find((contact) => contact.id === editingContactId) ?? null,
    [contacts, editingContactId],
  );
  const editingAudience = useMemo(
    () =>
      audiences.find((audience) => audience.id === editingAudienceId) ?? null,
    [audiences, editingAudienceId],
  );
  const selectedCampaignTargetAudience = useMemo(
    () =>
      audiences.find(
        (audience) => audience.id === campaignEditDraft.targetAudienceId,
      ) ?? null,
    [audiences, campaignEditDraft.targetAudienceId],
  );
  const selectedJourneyTargetAudience = useMemo(
    () =>
      audiences.find(
        (audience) => audience.id === journeyEditDraft.targetAudienceId,
      ) ?? null,
    [audiences, journeyEditDraft.targetAudienceId],
  );
  const estimatedJourneyContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          campaignAllowsContact(
            journeyEditDraft.audienceType,
            contact.audienceType,
          ) &&
          contactMatchesAudienceList(contact, selectedJourneyTargetAudience),
      ).length,
    [contacts, journeyEditDraft.audienceType, selectedJourneyTargetAudience],
  );

  const campaignDraftRecipientPreview = useMemo(() => {
    if (!campaignDraft.snapshotRecipients) return [];
    const filter = campaignDraft.recipientFilter.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (
        !campaignAllowsContact(campaignDraft.audienceType, contact.audienceType)
      )
        return false;
      if (
        !contactMatchesAudienceList(
          contact,
          selectedCampaignDraftTargetAudience,
        )
      )
        return false;
      if (!recipientForChannel(contact, campaignDraft.channel)) return false;
      return !filter || contactSearchText(contact).includes(filter);
    });
  }, [campaignDraft, contacts, selectedCampaignDraftTargetAudience]);

  const campaignRecipientPreview = useMemo(() => {
    if (!editingCampaignId || !campaignEditDraft.snapshotRecipients) return [];
    const filter = campaignEditDraft.recipientFilter.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (
        !campaignAllowsContact(
          campaignEditDraft.audienceType,
          contact.audienceType,
        )
      )
        return false;
      if (!contactMatchesAudienceList(contact, selectedCampaignTargetAudience))
        return false;
      if (!recipientForChannel(contact, campaignEditDraft.channel))
        return false;
      return !filter || contactSearchText(contact).includes(filter);
    });
  }, [
    campaignEditDraft,
    contacts,
    editingCampaignId,
    selectedCampaignTargetAudience,
  ]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    if (!campaignDraft.name.trim()) {
      setMessage("Campaign name is required before creating a draft.");
      return;
    }
    const scheduledAt = campaignDraft.scheduleStartsAt
      ? new Date(campaignDraft.scheduleStartsAt).toISOString()
      : null;
    const scheduleEndsAt = campaignDraft.scheduleEndsAt
      ? new Date(campaignDraft.scheduleEndsAt).toISOString()
      : null;
    const targetAudienceSnapshot = audienceSnapshot(
      selectedCampaignDraftTargetAudience,
    );
    const recipients = campaignDraft.snapshotRecipients
      ? campaignDraftRecipientPreview.map((contact) => ({
          contactId: contact.id,
          channel: campaignDraft.channel,
          recipient:
            recipientForChannel(contact, campaignDraft.channel) ?? contact.id,
          status: "planned",
          scheduledAt,
          snapshot: {
            ...recipientSnapshot(contact),
            ...(targetAudienceSnapshot
              ? { audienceList: targetAudienceSnapshot }
              : {}),
          },
        }))
      : undefined;
    setCampaignSaving(true);
    setMessage("Creating campaign...");
    try {
      const result = await api<{ campaign: Campaign }>(
        "/api/admin/marketing/campaigns",
        {
          method: "POST",
          body: JSON.stringify({
            name: campaignDraft.name,
            audienceType: campaignDraft.audienceType,
            status: campaignDraft.status,
            objective: campaignDraft.objective,
            scheduleStartsAt: scheduledAt,
            scheduleEndsAt,
            metadata: campaignMetadataWithTarget(
              {},
              selectedCampaignDraftTargetAudience,
            ),
            channels: [
              {
                channel: campaignDraft.channel,
                contentAssetId: campaignDraft.contentAssetId || null,
                status: campaignDraft.status,
                scheduledAt,
              },
            ],
            ...(recipients ? { recipients } : {}),
          }),
        },
      );
      setCampaigns((current) => [
        result.campaign,
        ...current.filter((campaign) => campaign.id !== result.campaign.id),
      ]);
      setEditingCampaignId(result.campaign.id);
      setCampaignEditDraft(
        campaignEditDraftFromCampaign(result.campaign, audiences),
      );
      setCampaignDraft(emptyCampaignDraft());
      const recipientMessage = campaignDraft.snapshotRecipients
        ? ` ${recipients?.length ?? 0} recipients snapshotted.`
        : "";
      setMessage(`Campaign draft created.${recipientMessage}`);
      await refreshAll();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Campaign could not be created.",
      );
    } finally {
      setCampaignSaving(false);
    }
  }

  function startCampaignEdit(campaign: Campaign) {
    setEditingCampaignId(campaign.id);
    setCampaignEditDraft(campaignEditDraftFromCampaign(campaign, audiences));
    setConfirmingCampaignDeleteId(null);
    setConfirmingCampaignSendId(null);
    setMessage("");
    setTestEmailFeedback("");
    setCampaignEmailFeedback("");
  }

  function openCampaignFromCalendar(campaign: Campaign) {
    startCampaignEdit(campaign);
    openMarketingTab("dashboard");
  }

  function cancelCampaignEdit() {
    setEditingCampaignId(null);
    setConfirmingCampaignDeleteId(null);
    setConfirmingCampaignSendId(null);
    setTestEmailFeedback("");
    setCampaignEmailFeedback("");
    setCampaignEditDraft(emptyCampaignEditDraft());
  }

  async function saveCampaignEdit(event: FormEvent, campaignId: string) {
    event.preventDefault();
    if (!campaignEditDraft.name.trim()) {
      setMessage("Campaign name is required before saving.");
      return;
    }
    const scheduledAt = fromDateTimeLocal(campaignEditDraft.scheduleStartsAt);
    const scheduleEndsAt = fromDateTimeLocal(campaignEditDraft.scheduleEndsAt);
    const existingMetadata = parseJsonText(
      campaignEditDraft.metadataText,
      "Campaign metadata",
    );
    const targetAudienceSnapshot = audienceSnapshot(
      selectedCampaignTargetAudience,
    );
    const recipients = campaignEditDraft.snapshotRecipients
      ? campaignRecipientPreview.map((contact) => ({
          contactId: contact.id,
          channel: campaignEditDraft.channel,
          recipient:
            recipientForChannel(contact, campaignEditDraft.channel) ??
            contact.id,
          status: "planned",
          scheduledAt,
          snapshot: {
            ...recipientSnapshot(contact),
            ...(targetAudienceSnapshot
              ? { audienceList: targetAudienceSnapshot }
              : {}),
          },
        }))
      : undefined;
    setCampaignSaving(true);
    setMessage("Saving campaign...");
    try {
      await api(`/api/admin/marketing/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: campaignEditDraft.name,
          audienceType: campaignEditDraft.audienceType,
          status: campaignEditDraft.status,
          objective: campaignEditDraft.objective,
          scheduleStartsAt: scheduledAt,
          scheduleEndsAt,
          timezone: campaignEditDraft.timezone,
          source: campaignEditDraft.source.trim() || "vyva",
          lovableExternalId: campaignEditDraft.lovableExternalId.trim() || null,
          metadata: campaignMetadataWithTarget(
            existingMetadata,
            selectedCampaignTargetAudience,
          ),
          channels: campaignChannelsPayload(campaignEditDraft),
          ...(recipients ? { recipients } : {}),
        }),
      });
      const recipientMessage = campaignEditDraft.snapshotRecipients
        ? ` ${recipients?.length ?? 0} recipients snapshotted.`
        : "";
      setCampaignEditDraft((draft) => ({
        ...draft,
        snapshotRecipients: false,
      }));
      setCampaignEmailFeedback("");
      setTestEmailFeedback("");
      setMessage(`Campaign updated.${recipientMessage}`);
      await refreshAll();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Campaign could not be saved.",
      );
    } finally {
      setCampaignSaving(false);
    }
  }

  function updateCampaignChannel(
    channelId: string,
    patch: Partial<CampaignChannelDraft>,
  ) {
    setCampaignEditDraft((draft) => {
      const channels = campaignChannelsWithPrimary(draft).map((channel) =>
        channel.id === channelId
          ? {
              ...channel,
              ...patch,
              contentAssetId:
                patch.channel && patch.channel !== channel.channel
                  ? ""
                  : (patch.contentAssetId ?? channel.contentAssetId),
            }
          : channel,
      );
      const primary = channels[0] ?? newCampaignChannelDraft();
      return {
        ...draft,
        channels,
        channel: primary.channel,
        contentAssetId: primary.contentAssetId,
        status: primary.status,
        scheduleStartsAt: primary.scheduledAt,
      };
    });
    setCampaignEmailFeedback("");
    setTestEmailFeedback("");
    setSocialPublishFeedback((current) => {
      if (!current[channelId]) return current;
      const next = { ...current };
      delete next[channelId];
      return next;
    });
  }

  function setSocialChannelFeedback(channelId: string, feedback: string) {
    setSocialPublishFeedback((current) => ({
      ...current,
      [channelId]: feedback,
    }));
  }

  async function copySocialPost(
    channelId: string,
    asset: ContentAsset | null | undefined,
  ) {
    const text = socialPostText(asset);
    if (!text) {
      setSocialChannelFeedback(channelId, "Choose content with copy first.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setSocialChannelFeedback(
        channelId,
        "Clipboard is unavailable. Open preview and copy manually.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSocialChannelFeedback(channelId, "Post copied.");
    } catch {
      setSocialChannelFeedback(
        channelId,
        "Copy failed. Open preview and copy manually.",
      );
    }
  }

  function openSocialPlatform(channel: Channel) {
    const url = SOCIAL_PLATFORM_URLS[channel];
    if (url && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function markSocialChannelPublished(channelId: string) {
    updateCampaignChannel(channelId, { status: "published" });
    setSocialChannelFeedback(channelId, "Marked as published. Save campaign to keep it.");
  }

  function addCampaignChannel() {
    setCampaignEditDraft((draft) => ({
      ...draft,
      channels: [
        ...campaignChannelsWithPrimary(draft),
        newCampaignChannelDraft(
          "linkedin",
          draft.status,
          draft.scheduleStartsAt,
        ),
      ],
    }));
    setCampaignEmailFeedback("");
    setTestEmailFeedback("");
  }

  function removeCampaignChannel(channelId: string) {
    setCampaignEditDraft((draft) => {
      const nextChannels = campaignChannelsWithPrimary(draft).filter(
        (channel) => channel.id !== channelId,
      );
      const channels = nextChannels.length
        ? nextChannels
        : [
            newCampaignChannelDraft(
              "email",
              draft.status,
              draft.scheduleStartsAt,
            ),
          ];
      const primary = channels[0];
      return {
        ...draft,
        channels,
        channel: primary.channel,
        contentAssetId: primary.contentAssetId,
        status: primary.status,
        scheduleStartsAt: primary.scheduledAt,
      };
    });
    setCampaignEmailFeedback("");
    setTestEmailFeedback("");
  }

  async function sendTestCampaignEmail(campaignId: string) {
    setTestEmailSending(true);
    setTestEmailFeedback("Sending test email...");
    try {
      const result = await api<TestEmailResponse>(
        `/api/admin/marketing/campaigns/${campaignId}/test-email`,
        { method: "POST" },
      );
      const recipient =
        result.communication?.recipient ||
        result.delivery?.recipient ||
        "your admin email";
      setTestEmailFeedback(`Test email sent to ${recipient}.`);
      setMessage("Marketing test email sent.");
      await refreshAll();
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "Test email could not be sent.";
      setTestEmailFeedback(messageText);
      setMessage(messageText);
    } finally {
      setTestEmailSending(false);
    }
  }

  async function sendCampaignEmails(campaign: Campaign) {
    if (confirmingCampaignSendId !== campaign.id) {
      setConfirmingCampaignSendId(campaign.id);
      setCampaignEmailFeedback(
        `Click Confirm send to email ${campaign.recipientCount} saved recipient${campaign.recipientCount === 1 ? "" : "s"} for "${campaign.name}".`,
      );
      return;
    }
    setCampaignEmailSending(true);
    setCampaignEmailFeedback("Sending campaign emails...");
    try {
      const result = await api<CampaignEmailSendResponse>(
        `/api/admin/marketing/campaigns/${campaign.id}/send-email`,
        { method: "POST" },
      );
      const summaryText =
        `Campaign email sent to ${result.sentCount} recipient${result.sentCount === 1 ? "" : "s"}. ${result.failedCount ? `${result.failedCount} failed. ` : ""}${result.skippedCount ? `${result.skippedCount} skipped.` : ""}`.trim();
      setConfirmingCampaignSendId(null);
      setCampaignEmailFeedback(summaryText);
      setMessage(summaryText);
      await refreshAll();
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "Campaign email could not be sent.";
      setConfirmingCampaignSendId(null);
      setCampaignEmailFeedback(messageText);
      setMessage(messageText);
    } finally {
      setCampaignEmailSending(false);
    }
  }

  async function sendDueCampaignEmails() {
    if (!confirmingDueEmailSend) {
      setConfirmingDueEmailSend(true);
      setDueEmailFeedback(
        "Click Confirm run due emails to send every due scheduled email campaign.",
      );
      return;
    }
    setDueEmailSending(true);
    setDueEmailFeedback("Checking due scheduled email campaigns...");
    try {
      const result = await api<DueCampaignEmailSendResponse>(
        "/api/admin/marketing/campaigns/send-due-email",
        { method: "POST" },
      );
      const summaryText =
        result.dueCount === 0
          ? "No scheduled email campaigns are due."
          : `Due email run checked ${result.dueCount} campaign${result.dueCount === 1 ? "" : "s"}: ${result.sentCount} sent, ${result.failedCount} failed, ${result.skippedCount} skipped.`;
      setConfirmingDueEmailSend(false);
      setDueEmailFeedback(summaryText);
      setMessage(summaryText);
      await refreshAll();
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "Due scheduled emails could not be sent.";
      setConfirmingDueEmailSend(false);
      setDueEmailFeedback(messageText);
      setMessage(messageText);
    } finally {
      setDueEmailSending(false);
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    if (confirmingCampaignDeleteId !== campaign.id) {
      setConfirmingCampaignDeleteId(campaign.id);
      setMessage(`Click Confirm delete to remove campaign "${campaign.name}".`);
      return;
    }
    setCampaignSaving(true);
    setMessage("Deleting campaign...");
    try {
      await api(`/api/admin/marketing/campaigns/${campaign.id}`, {
        method: "DELETE",
      });
      if (editingCampaignId === campaign.id) cancelCampaignEdit();
      setConfirmingCampaignDeleteId(null);
      setMessage("Campaign deleted.");
      await refreshAll();
    } catch (error) {
      setConfirmingCampaignDeleteId(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Campaign could not be deleted.",
      );
    } finally {
      setCampaignSaving(false);
    }
  }

  function startNewJourney() {
    setEditingJourneyId("new");
    setJourneyEditDraft(emptyJourneyEditDraft());
    setConfirmingJourneyDeleteId(null);
    setJourneyFeedback("");
    setJourneyBuilderStage(1);
    setMessage("");
  }

  function startJourneyEdit(journey: Journey) {
    setEditingJourneyId(journey.id);
    setJourneyEditDraft(
      journeyEditDraftFromJourney(journey, audiences, content),
    );
    setConfirmingJourneyDeleteId(null);
    setJourneyFeedback("");
    setJourneyBuilderStage(1);
    setMessage("");
  }

  function cancelJourneyEdit() {
    setEditingJourneyId(null);
    setJourneyEditDraft(emptyJourneyEditDraft());
    setConfirmingJourneyDeleteId(null);
    setJourneyFeedback("");
  }

  function updateJourneyStep(stepId: string, patch: Partial<JourneyStepDraft>) {
    setJourneyEditDraft((draft) => ({
      ...draft,
      steps: draft.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step,
      ),
    }));
  }

  function addJourneyStep(kind: JourneyStepKind = "message") {
    setJourneyEditDraft((draft) => {
      const previousChannel = draft.steps.at(-1)?.channel ?? "email";
      const step = newJourneyStepDraft(previousChannel);
      step.kind = kind;
      if (kind === "wait") step.delayHours = "24";
      return { ...draft, steps: [...draft.steps, step] };
    });
    setJourneyFeedback("");
  }

  function duplicateJourneyStep(stepId: string) {
    setJourneyEditDraft((draft) => {
      const index = draft.steps.findIndex((step) => step.id === stepId);
      if (index < 0) return draft;
      const steps = [...draft.steps];
      steps.splice(index + 1, 0, { ...steps[index], id: newDraftId() });
      return { ...draft, steps };
    });
    setJourneyFeedback("");
  }

  function removeJourneyStep(stepId: string) {
    setJourneyEditDraft((draft) => ({
      ...draft,
      steps: draft.steps.filter((step) => step.id !== stepId),
    }));
    setJourneyFeedback("");
  }

  function moveJourneyStep(stepId: string, direction: -1 | 1) {
    setJourneyEditDraft((draft) => {
      const currentIndex = draft.steps.findIndex((step) => step.id === stepId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= draft.steps.length)
        return draft;
      const steps = [...draft.steps];
      const [step] = steps.splice(currentIndex, 1);
      steps.splice(nextIndex, 0, step);
      return { ...draft, steps };
    });
    setJourneyFeedback("");
  }

  function advanceJourneyStage() {
    if (journeyBuilderStage === 1 && !journeyEditDraft.name.trim()) {
      setJourneyFeedback("Give this journey a name before continuing.");
      return;
    }
    if (
      journeyBuilderStage === 2 &&
      journeyEntryRule(journeyEditDraft) === "list_joined" &&
      !journeyEditDraft.targetAudienceId
    ) {
      setJourneyFeedback("Choose the list that starts this journey.");
      return;
    }
    if (
      journeyBuilderStage === 2 &&
      journeyEntryRule(journeyEditDraft) === "date" &&
      !journeyEntryDate(journeyEditDraft)
    ) {
      setJourneyFeedback("Choose the date that starts this journey.");
      return;
    }
    if (journeyBuilderStage === 3) {
      const incompleteMessage = journeyEditDraft.steps.find(
        (step) => journeyStepKind(step) === "message" && !step.contentAssetId,
      );
      const incompleteWait = journeyEditDraft.steps.find(
        (step) =>
          journeyStepKind(step) === "wait" &&
          nonNegativeInt(step.delayHours) < 1,
      );
      if (incompleteMessage) {
        setJourneyFeedback(
          "Choose content for every message step before continuing.",
        );
        return;
      }
      if (incompleteWait) {
        setJourneyFeedback(
          "Every wait step needs a duration of at least one hour.",
        );
        return;
      }
    }
    setJourneyFeedback("");
    setJourneyBuilderStage(
      (stage) => Math.min(5, stage + 1) as JourneyBuilderStage,
    );
  }

  async function saveJourneyEdit(event: FormEvent) {
    event.preventDefault();
    if (!journeyEditDraft.name.trim()) {
      setJourneyFeedback("Journey name is required before saving.");
      return;
    }
    setJourneySaving(true);
    setJourneyFeedback("Saving journey...");
    try {
      const payload = journeyPayloadFromDraft(
        { ...journeyEditDraft, status: "draft" },
        selectedJourneyTargetAudience,
      );
      const isNewJourney = editingJourneyId === "new";
      const result = await api<{ journey: Journey }>(
        isNewJourney
          ? "/api/admin/marketing/journeys"
          : `/api/admin/marketing/journeys/${editingJourneyId}`,
        {
          method: isNewJourney ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      await refreshAll();
      setJourneys((current) => [
        result.journey,
        ...current.filter((journey) => journey.id !== result.journey.id),
      ]);
      setEditingJourneyId(result.journey.id);
      setJourneyEditDraft(
        journeyEditDraftFromJourney(result.journey, audiences, content),
      );
      setJourneyFeedback(isNewJourney ? "Created." : "Updated.");
      setMessage(isNewJourney ? "Journey created." : "Journey updated.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Journey could not be saved.";
      setJourneyFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setJourneySaving(false);
    }
  }

  async function activateJourney() {
    if (!editingJourneyId || editingJourneyId === "new") {
      setJourneyFeedback("Save the journey as a draft before starting it.");
      return;
    }
    const confirmed = window.confirm(
      "Start this journey for all currently eligible contacts? The first email may send immediately, and follow-up emails will send automatically after each wait.",
    );
    if (!confirmed) return;
    setJourneyActivating(true);
    setJourneyFeedback("Starting journey...");
    try {
      const result = await api<{
        eligibleCount: number;
        enrolledCount: number;
        execution: { sentCount: number; failedCount: number };
      }>(`/api/admin/marketing/journeys/${editingJourneyId}/activate`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      await refreshAll();
      setJourneyFeedback(
        `Journey started for ${result.enrolledCount} new contact${result.enrolledCount === 1 ? "" : "s"}. ${result.execution.sentCount} first email${result.execution.sentCount === 1 ? "" : "s"} sent. Follow-ups will run automatically after waits.`,
      );
      setMessage("Journey started.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Journey could not be started.";
      setJourneyFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setJourneyActivating(false);
    }
  }

  async function deleteJourney(journey: Journey) {
    if (confirmingJourneyDeleteId !== journey.id) {
      setConfirmingJourneyDeleteId(journey.id);
      setJourneyFeedback(
        `Click Confirm delete to remove journey "${journey.name}".`,
      );
      return;
    }
    setJourneySaving(true);
    setJourneyFeedback("Deleting journey...");
    try {
      await api(`/api/admin/marketing/journeys/${journey.id}`, {
        method: "DELETE",
      });
      if (editingJourneyId === journey.id) cancelJourneyEdit();
      setConfirmingJourneyDeleteId(null);
      setJourneyFeedback("Deleted.");
      setMessage("Journey deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Journey could not be deleted.";
      setConfirmingJourneyDeleteId(null);
      setJourneyFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setJourneySaving(false);
    }
  }

  async function createContent(event: FormEvent) {
    event.preventDefault();
    setContentFeedback("");
    if (!contentDraft.title.trim()) {
      setContentFeedback("Content title is required before creating a draft.");
      return;
    }
    setContentSaving(true);
    try {
      const result = await api<{ content: ContentAsset }>(
        "/api/admin/marketing/content",
        {
          method: "POST",
          body: JSON.stringify({
            title: contentDraft.title,
            channel: contentDraft.channel,
            language: contentDraft.language.trim() || "en",
            status: contentDraft.status,
            subject: contentDraft.subject || null,
            body: contentDraft.body,
            htmlBody: contentDraft.htmlBody.trim() || null,
            ctaLabel: contentDraft.ctaLabel.trim() || null,
            ctaUrl: contentDraft.ctaUrl.trim() || null,
            designJson: parseJsonText(
              contentDraft.designJsonText,
              "Design JSON",
            ),
            mediaAssets: parseJsonArrayText(
              contentDraft.mediaAssetsText,
              "Media assets",
            ),
          }),
        },
      );
      setContentDraft(emptyContentDraft());
      setSelectedContentId(result.content.id);
      setEditingContentId(result.content.id);
      setContentEditDraft(contentEditDraftFromContent(result.content));
      setContentFeedback("Content draft created.");
      setContentActionFeedback("Content draft created. Editor opened.");
      setContentDrawerMode("edit");
      setMessage("Content draft created.");
      await refreshAll();
      scrollToContentPanel(contentEditorPanelRef);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Content draft could not be created.";
      setContentFeedback(errorMessage);
      setContentActionFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContentSaving(false);
    }
  }

  function toggleBulkTranslateSource(contentId: string) {
    setBulkTranslateSourceIds((current) =>
      current.includes(contentId)
        ? current.filter((id) => id !== contentId)
        : [...current, contentId].slice(0, 25),
    );
    setBulkTranslateFeedback("");
  }

  function toggleBulkTranslateLanguage(language: string) {
    setBulkTranslateLanguages((current) => {
      if (current.includes(language))
        return current.filter((item) => item !== language);
      return [...current, language];
    });
    setBulkTranslateFeedback("");
  }

  async function runBulkTranslate(mode: "preview" | "save") {
    if (!bulkTranslateSourceIds.length) {
      setBulkTranslateFeedback("Select at least one content item.");
      return;
    }
    if (!bulkTranslateLanguages.length) {
      setBulkTranslateFeedback("Select at least one target language.");
      return;
    }
    setBulkTranslateRunning(true);
    setBulkTranslateFeedback(
      mode === "preview"
        ? "Creating translation preview..."
        : "Saving translated drafts...",
    );
    try {
      const result = await api<BulkTranslateResponse>(
        "/api/admin/marketing/content/bulk-translate",
        {
          method: "POST",
          body: JSON.stringify({
            contentIds: bulkTranslateSourceIds,
            targetLanguages: bulkTranslateLanguages,
            mode,
          }),
        },
      );
      setBulkTranslatePreview(result.translations);
      if (mode === "save") {
        await refreshAll();
        setBulkTranslateFeedback(
          `Saved ${result.savedContent?.length ?? result.translations.length} translated drafts.`,
        );
        setContentActionFeedback("Translated drafts saved.");
      } else {
        setBulkTranslateFeedback(
          `Preview ready: ${result.translations.length} translations.`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Bulk translation failed.";
      setBulkTranslateFeedback(errorMessage);
      setContentActionFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setBulkTranslateRunning(false);
    }
  }

  function scrollToContentPanel(ref: RefObject<HTMLDivElement | null>) {
    window.setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      if (typeof node.scrollIntoView === "function") {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (typeof node.focus === "function") {
        node.focus({ preventScroll: true });
      }
    }, 0);
  }

  function scrollToContentActionRow(contentId: string) {
    window.setTimeout(() => {
      const node = document.getElementById(
        `marketing-content-row-${contentId}`,
      );
      if (!node) return;
      if (typeof node.scrollIntoView === "function") {
        node.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      }
    }, 0);
  }

  function previewContent(contentAsset: ContentAsset) {
    openMarketingTab("content");
    setSelectedContentId(contentAsset.id);
    setEditingContentId(null);
    setContentEditDraft(null);
    setContentDrawerMode("preview");
    setConfirmingContentDeleteId(null);
    setContentActionFeedback(`Previewing "${contentAsset.title}".`);
    scrollToContentActionRow(contentAsset.id);
  }

  function startContentEdit(contentAsset: ContentAsset) {
    openMarketingTab("content");
    setSelectedContentId(contentAsset.id);
    setEditingContentId(contentAsset.id);
    setContentEditDraft(contentEditDraftFromContent(contentAsset));
    setContentDrawerMode("edit");
    setConfirmingContentDeleteId(null);
    setContentFeedback("");
    setContentActionFeedback(`Editing "${contentAsset.title}".`);
    scrollToContentActionRow(contentAsset.id);
  }

  function cancelContentEdit() {
    setEditingContentId(null);
    setContentEditDraft(null);
    setContentDrawerMode(null);
    setContentFeedback("");
    setContentActionFeedback("");
    setConfirmingContentDeleteId(null);
  }

  function closeContentDrawer() {
    if (contentDrawerMode === "edit") {
      cancelContentEdit();
      return;
    }
    setContentDrawerMode(null);
    setContentActionFeedback("");
  }

  function openContentUsageCampaign(campaignId: string) {
    const campaign = campaignById.get(campaignId);
    if (!campaign) {
      setMessage("Campaign reference could not be opened.");
      return;
    }
    closeContentDrawer();
    startCampaignEdit(campaign);
    openMarketingTab("dashboard");
  }

  function openContentUsageJourney(journeyId: string) {
    const journey = journeyById.get(journeyId);
    if (!journey) {
      setMessage("Journey reference could not be opened.");
      return;
    }
    closeContentDrawer();
    startJourneyEdit(journey);
    openMarketingTab("journeys");
  }

  async function saveContentEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingContentId || !contentEditDraft) return;
    if (!contentEditDraft.title.trim()) {
      setContentFeedback("Content title is required before saving.");
      return;
    }
    setContentSaving(true);
    setContentFeedback("Saving content...");
    try {
      const result = await api<{ content: ContentAsset }>(
        `/api/admin/marketing/content/${editingContentId}`,
        {
          method: "PATCH",
          body: JSON.stringify(contentPayloadFromDraft(contentEditDraft)),
        },
      );
      setSelectedContentId(result.content.id);
      setEditingContentId(result.content.id);
      setContentEditDraft(contentEditDraftFromContent(result.content));
      setContentDrawerMode("edit");
      setContentFeedback("Updated.");
      setContentActionFeedback(`Updated "${result.content.title}".`);
      setMessage("Content updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Content could not be saved.";
      setContentFeedback(errorMessage);
      setContentActionFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContentSaving(false);
    }
  }

  async function deleteContent(contentAsset: ContentAsset) {
    if (confirmingContentDeleteId !== contentAsset.id) {
      setConfirmingContentDeleteId(contentAsset.id);
      setContentActionFeedback(
        `Click Confirm delete to remove "${contentAsset.title}". Campaigns and journey steps will keep their records but lose this content link.`,
      );
      scrollToContentActionRow(contentAsset.id);
      return;
    }
    setContentSaving(true);
    setContentFeedback("Deleting content...");
    setContentActionFeedback(`Deleting "${contentAsset.title}"...`);
    try {
      await api(`/api/admin/marketing/content/${contentAsset.id}`, {
        method: "DELETE",
      });
      if (editingContentId === contentAsset.id) cancelContentEdit();
      if (selectedContentId === contentAsset.id) setSelectedContentId(null);
      if (
        editingContentId === contentAsset.id ||
        selectedContentId === contentAsset.id
      )
        setContentDrawerMode(null);
      setConfirmingContentDeleteId(null);
      setContentFeedback("Deleted.");
      setContentActionFeedback(`Deleted "${contentAsset.title}".`);
      setMessage("Content deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Content could not be deleted.";
      setContentFeedback(errorMessage);
      setContentActionFeedback(errorMessage);
      setMessage(errorMessage);
      setConfirmingContentDeleteId(null);
    } finally {
      setContentSaving(false);
    }
  }

  function startMediaEdit(asset: MarketingMediaAsset) {
    openMarketingTab("content");
    setEditingMediaAssetId(asset.id);
    setMediaEditDraft(mediaEditDraftFromAsset(asset));
    setConfirmingMediaDeleteId(null);
    setMediaFeedback(
      `Editing media reference "${mediaPreviewLabel(asset.originalUrl)}".`,
    );
    scrollToContentPanel(mediaEditorPanelRef);
  }

  function cancelMediaEdit() {
    setEditingMediaAssetId(null);
    setMediaEditDraft(null);
    setConfirmingMediaDeleteId(null);
    setMediaFeedback("");
  }

  async function saveMediaEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingMediaAssetId || !mediaEditDraft) return;
    if (!mediaEditDraft.originalUrl.trim()) {
      setMediaFeedback("Original URL is required before saving.");
      return;
    }
    setMediaSaving(true);
    setMediaFeedback("Saving media...");
    try {
      const result = await api<{ mediaAsset: MarketingMediaAsset }>(
        `/api/admin/marketing/media/${editingMediaAssetId}`,
        {
          method: "PATCH",
          body: JSON.stringify(mediaPayloadFromDraft(mediaEditDraft)),
        },
      );
      setMediaAssets((current) =>
        current.map((item) =>
          item.id === result.mediaAsset.id ? result.mediaAsset : item,
        ),
      );
      setEditingMediaAssetId(result.mediaAsset.id);
      setMediaEditDraft(mediaEditDraftFromAsset(result.mediaAsset));
      setMediaFeedback("Media updated.");
      setMessage("Marketing media updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Marketing media could not be updated.";
      setMediaFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setMediaSaving(false);
    }
  }

  async function deleteMediaAsset(asset: MarketingMediaAsset) {
    if (confirmingMediaDeleteId !== asset.id) {
      setConfirmingMediaDeleteId(asset.id);
      setMediaFeedback(
        `Click Confirm delete to remove this VYVA media reference. The original Lovable URL is not changed.`,
      );
      return;
    }
    setMediaSaving(true);
    setMediaFeedback("Deleting media...");
    try {
      await api(`/api/admin/marketing/media/${asset.id}`, { method: "DELETE" });
      if (editingMediaAssetId === asset.id) cancelMediaEdit();
      setMediaAssets((current) =>
        current.filter((item) => item.id !== asset.id),
      );
      setConfirmingMediaDeleteId(null);
      setMediaFeedback("Media deleted.");
      setMessage("Marketing media deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Marketing media could not be deleted.";
      setConfirmingMediaDeleteId(null);
      setMediaFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setMediaSaving(false);
    }
  }

  async function createContact(event: FormEvent) {
    event.preventDefault();
    setContactFeedback("");
    setContactSaving(true);
    if (
      !contactDraft.fullName.trim() &&
      !contactDraft.email.trim() &&
      !contactDraft.phoneNumber.trim() &&
      !contactDraft.whatsappNumber.trim()
    ) {
      setContactFeedback(
        "Add at least a name, email, phone, or WhatsApp before saving.",
      );
      setContactSaving(false);
      return;
    }
    try {
      await api("/api/admin/marketing/contacts", {
        method: "POST",
        body: JSON.stringify({
          fullName: contactDraft.fullName,
          audienceType: contactDraft.audienceType,
          email: contactDraft.email || null,
          phoneNumber: contactDraft.phoneNumber || null,
          whatsappNumber: contactDraft.whatsappNumber || null,
          roleLabel: contactDraft.roleLabel || null,
          companyName: contactDraft.companyName || null,
          language: contactDraft.language || null,
          category: contactDraft.category || null,
          vertical: contactDraft.vertical || null,
          market: contactDraft.market || null,
          tags: splitTags(contactDraft.tags),
          metadata: {
            segmentation: {
              language: contactDraft.language || null,
              category: contactDraft.category || null,
              vertical: contactDraft.vertical || null,
              market: contactDraft.market || null,
            },
          },
          channelAvailability: {
            email: Boolean(contactDraft.email),
            phone: Boolean(contactDraft.phoneNumber),
            whatsapp: Boolean(contactDraft.whatsappNumber),
          },
        }),
      });
      setContactDraft({
        fullName: "",
        audienceType: "b2b",
        email: "",
        phoneNumber: "",
        whatsappNumber: "",
        roleLabel: "",
        companyName: "",
        language: "",
        category: "",
        vertical: "",
        market: "",
        tags: "",
      });
      setContactFeedback("Marketing contact created.");
      setMessage("Marketing contact created.");
      await refreshAll();
      setContactView("contacts");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Marketing contact could not be created.";
      setContactFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContactSaving(false);
    }
  }

  function startContactEdit(contact: MarketingContact) {
    openMarketingTab("contacts");
    setContactView("create");
    setEditingContactId(contact.id);
    setContactEditDraft(contactEditDraftFromContact(contact));
    setConfirmingContactDeleteId(null);
    setContactFeedback(
      `Editing "${contact.fullName || contact.email || contact.phoneNumber || "Unnamed contact"}".`,
    );
    scrollToContentPanel(contactEditorPanelRef);
  }

  function cancelContactEdit() {
    setEditingContactId(null);
    setContactEditDraft(null);
    setConfirmingContactDeleteId(null);
    setContactFeedback("");
    setContactView("contacts");
  }

  async function saveContactEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingContactId || !contactEditDraft) return;
    if (
      !contactEditDraft.fullName.trim() &&
      !contactEditDraft.email.trim() &&
      !contactEditDraft.phoneNumber.trim() &&
      !contactEditDraft.whatsappNumber.trim()
    ) {
      setContactFeedback(
        "Add at least a name, email, phone, or WhatsApp before saving.",
      );
      return;
    }
    setContactSaving(true);
    setContactFeedback("Saving contact...");
    try {
      const result = await api<{ contact: MarketingContact }>(
        `/api/admin/marketing/contacts/${editingContactId}`,
        {
          method: "PATCH",
          body: JSON.stringify(contactPayloadFromDraft(contactEditDraft)),
        },
      );
      setEditingContactId(result.contact.id);
      setContactEditDraft(contactEditDraftFromContact(result.contact));
      setContactFeedback("Contact updated.");
      setMessage("Marketing contact updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Marketing contact could not be updated.";
      setContactFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContactSaving(false);
    }
  }

  async function deleteContact(contact: MarketingContact) {
    if (confirmingContactDeleteId !== contact.id) {
      setConfirmingContactDeleteId(contact.id);
      setContactFeedback(
        `Click Confirm delete to remove "${contact.fullName || contact.email || contact.phoneNumber || "Unnamed contact"}". Audience memberships will be removed.`,
      );
      return;
    }
    setContactSaving(true);
    setContactFeedback("Deleting contact...");
    try {
      await api(`/api/admin/marketing/contacts/${contact.id}`, {
        method: "DELETE",
      });
      if (editingContactId === contact.id) cancelContactEdit();
      setConfirmingContactDeleteId(null);
      setContactFeedback("Contact deleted.");
      setMessage("Marketing contact deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Marketing contact could not be deleted.";
      setConfirmingContactDeleteId(null);
      setContactFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setContactSaving(false);
    }
  }

  async function createAudience(event: FormEvent) {
    event.preventDefault();
    setAudienceFeedback("");
    setAudienceSaving(true);
    if (!audienceDraft.name.trim()) {
      setAudienceFeedback("Audience name is required.");
      setAudienceSaving(false);
      return;
    }
    let rules: Record<string, unknown>;
    try {
      rules = parseRulesText(audienceDraft.rulesText);
    } catch {
      setAudienceFeedback("Rules must be valid JSON.");
      setAudienceSaving(false);
      return;
    }
    try {
      await api("/api/admin/marketing/audiences", {
        method: "POST",
        body: JSON.stringify({
          name: audienceDraft.name,
          listType: audienceDraft.listType || "dynamic",
          description: audienceDraft.description || null,
          rules,
          contactExternalIds: splitLines(audienceDraft.contactExternalIds),
          metadata: { created_from: "admin_rule_builder" },
        }),
      });
      setAudienceDraft({
        name: "",
        listType: "dynamic",
        description: "",
        rulesText: '{\n  "market": "Spain"\n}',
        contactExternalIds: "",
      });
      setAudienceFeedback("Audience created.");
      setMessage("Audience created.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Audience could not be created.";
      setAudienceFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setAudienceSaving(false);
    }
  }

  function startAudienceEdit(audience: MarketingAudience) {
    openMarketingTab("contacts");
    setContactView("lists");
    setEditingAudienceId(audience.id);
    setAudienceEditDraft(audienceEditDraftFromAudience(audience));
    setConfirmingAudienceDeleteId(null);
    setAudienceFeedback(`Editing list "${audience.name}".`);
    scrollToContentPanel(audienceEditorPanelRef);
  }

  function cancelAudienceEdit() {
    setEditingAudienceId(null);
    setAudienceEditDraft(null);
    setConfirmingAudienceDeleteId(null);
    setAudienceFeedback("");
  }

  function addAudienceDraftContact(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;
    setAudienceDraft((draft) =>
      updateAudienceDraftMemberIds(draft, [
        ...parseAudienceMemberIds(draft),
        contactAudienceMemberId(contact),
      ]),
    );
  }

  function removeAudienceDraftContact(contact: MarketingContact) {
    setAudienceDraft((draft) =>
      updateAudienceDraftMemberIds(
        draft,
        parseAudienceMemberIds(draft).filter(
          (id) => !contactMatchesMemberIds(contact, [id]),
        ),
      ),
    );
  }

  function addAudienceEditContact(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;
    setAudienceEditDraft((draft) =>
      draft
        ? updateAudienceDraftMemberIds(draft, [
            ...parseAudienceMemberIds(draft),
            contactAudienceMemberId(contact),
          ])
        : draft,
    );
  }

  function removeAudienceEditContact(contact: MarketingContact) {
    setAudienceEditDraft((draft) =>
      draft
        ? updateAudienceDraftMemberIds(
            draft,
            parseAudienceMemberIds(draft).filter(
              (id) => !contactMatchesMemberIds(contact, [id]),
            ),
          )
        : draft,
    );
  }

  async function saveAudienceEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingAudienceId || !audienceEditDraft) return;
    setAudienceFeedback("");
    if (!audienceEditDraft.name.trim()) {
      setAudienceFeedback("Audience name is required.");
      return;
    }
    let payload: ReturnType<typeof audiencePayloadFromDraft>;
    try {
      payload = audiencePayloadFromDraft(audienceEditDraft);
    } catch {
      setAudienceFeedback("Rules must be valid JSON.");
      return;
    }
    setAudienceSaving(true);
    setAudienceFeedback("Saving audience...");
    try {
      const result = await api<{ audience: MarketingAudience }>(
        `/api/admin/marketing/audiences/${editingAudienceId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      setEditingAudienceId(result.audience.id);
      setAudienceEditDraft(audienceEditDraftFromAudience(result.audience));
      setAudienceFeedback("Audience updated.");
      setMessage("Audience updated.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Audience could not be updated.";
      setAudienceFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setAudienceSaving(false);
    }
  }

  async function deleteAudience(audience: MarketingAudience) {
    if (confirmingAudienceDeleteId !== audience.id) {
      setConfirmingAudienceDeleteId(audience.id);
      setAudienceFeedback(
        `Click Confirm delete to remove list "${audience.name}". Contacts will stay in marketing contacts.`,
      );
      return;
    }
    setAudienceSaving(true);
    setAudienceFeedback("Deleting audience...");
    try {
      await api(`/api/admin/marketing/audiences/${audience.id}`, {
        method: "DELETE",
      });
      if (editingAudienceId === audience.id) cancelAudienceEdit();
      setConfirmingAudienceDeleteId(null);
      setAudienceFeedback("Audience deleted.");
      setMessage("Audience deleted.");
      await refreshAll();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Audience could not be deleted.";
      setConfirmingAudienceDeleteId(null);
      setAudienceFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setAudienceSaving(false);
    }
  }

  async function runLovableSync() {
    setSyncFeedback("");
    setMessage("Running Lovable sync...");
    setSyncRunning(true);
    try {
      const result = await api<{ summary?: Record<string, unknown> }>(
        `${MARKETING_SYNC_ENDPOINT}/run`,
        { method: "POST" },
      );
      const completionMessage = syncCompletionMessage(result.summary);
      await refreshAll();
      setMessage(completionMessage);
      setSyncFeedback(completionMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Lovable sync failed.";
      setMessage(errorMessage);
      setSyncFeedback(errorMessage);
    } finally {
      setSyncRunning(false);
    }
  }

  async function previewLovableExport() {
    setExportPreviewFeedback("");
    setMessage("Checking Lovable export...");
    setExportPreviewRunning(true);
    try {
      const result = await api<LovableExportPreview>(
        `${MARKETING_SYNC_ENDPOINT}/preview`,
      );
      const completionMessage = exportPreviewMessage(result.summary);
      setExportPreview(result);
      setExportPreviewFeedback(completionMessage);
      setMessage(completionMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Lovable export preview failed.";
      setExportPreview(null);
      setExportPreviewFeedback(errorMessage);
      setMessage(errorMessage);
    } finally {
      setExportPreviewRunning(false);
    }
  }

  function connectMeta() {
    window.location.assign("/api/admin/marketing/social-publishing/meta/connect");
  }

  async function verifyMeta() {
    setMetaConnectionBusy(true);
    setMessage("Verifying the Meta connection...");
    try {
      const result = await api<{ verifiedPageName: string | null }>(
        "/api/admin/marketing/social-publishing/meta/verify",
        { method: "POST" },
      );
      setMessage(`Meta connection verified for ${result.verifiedPageName || "the selected Page"}.`);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Meta connection verification failed.");
    } finally {
      setMetaConnectionBusy(false);
    }
  }

  const syncBlockedReason = !syncState.configured
    ? "Set VYVA_MARKETING_EXPORT_TOKEN or LOVABLE_MARKETING_API_KEY before running a sync. The default Lovable export endpoint is already built in, and can be overridden with VYVA_MARKETING_EXPORT_URL."
    : syncState.canRunSync === false
      ? `Only the super admin${syncState.requiredRunnerEmail ? ` (${syncState.requiredRunnerEmail})` : ""} can run Lovable sync.`
      : "";
  const syncButtonDisabled = Boolean(syncBlockedReason) || syncRunning;
  const exportPreviewButtonDisabled =
    Boolean(syncBlockedReason) || exportPreviewRunning || syncRunning;
  const syncFeedbackText = syncFeedback || syncBlockedReason;
  const syncFeedbackIsError =
    Boolean(syncBlockedReason) ||
    /fail|error|unauthorized|forbidden|not configured|only the super admin/i.test(
      syncFeedback,
    );
  const exportPreviewFeedbackIsError =
    /fail|error|unauthorized|forbidden|not configured|only the super admin/i.test(
      exportPreviewFeedback,
    );
  const emailScheduler = syncState.emailScheduler ??
    summary.emailScheduler ??
    emptySummary.emailScheduler ?? {
      enabled: false,
      intervalMinutes: 5,
      initialDelaySeconds: 30,
      actor: "marketing-email-scheduler",
    };
  const syncDiagnostics = syncState.diagnostics;
  const socialPublishing = normalizeSocialPublishingStatus(
    syncState.socialPublishing ?? summary.socialPublishing,
  );
  const metaProvider = socialPublishing.providers.find((provider) => provider.id === "meta");
  const metaConnections = metaProvider?.connections ?? [];
  const tokenAliasPresent = syncDiagnostics?.tokenAliasPresent ?? {};
  const urlAliasPresent = syncDiagnostics?.urlAliasPresent ?? {};
  const yesNo = (value: boolean | undefined) => (value ? "yes" : "no");
  const testEmailDisabled =
    !editingCampaign || testEmailSending || !draftEmailChannel?.contentAssetId;
  const hasUnsavedCampaignSendChanges = Boolean(
    editingCampaign &&
    (campaignEditDraft.name !== editingCampaign.name ||
      campaignEditDraft.audienceType !== editingCampaign.audienceType ||
      campaignEditDraft.status !==
        normalizeCampaignStatus(editingCampaign.status) ||
      campaignEditDraft.scheduleStartsAt !==
        toDateTimeLocal(editingCampaign.scheduleStartsAt) ||
      campaignEditDraft.scheduleEndsAt !==
        toDateTimeLocal(editingCampaign.scheduleEndsAt) ||
      campaignEditDraft.timezone !==
        (editingCampaign.timezone || "Europe/Madrid") ||
      campaignEditDraft.objective !== editingCampaign.objective ||
      campaignEditDraft.targetAudienceId !==
        (campaignTargetAudience(editingCampaign, audiences)?.id ?? "") ||
      campaignEditDraft.source !== (editingCampaign.source || "vyva") ||
      campaignEditDraft.lovableExternalId !==
        (editingCampaign.lovableExternalId ?? "") ||
      campaignEditDraft.metadataText !== jsonText(editingCampaign.metadata) ||
      !campaignChannelsMatch(campaignEditDraft, editingCampaign) ||
      campaignEditDraft.snapshotRecipients),
  );
  const campaignEmailDisabled =
    !editingCampaign ||
    campaignEmailSending ||
    hasUnsavedCampaignSendChanges ||
    !draftEmailChannel?.contentAssetId ||
    editingCampaign.recipientCount <= 0;
  const testEmailBlockedReason = !draftEmailChannel
    ? "Add an Email channel before sending a test."
    : !draftEmailChannel.contentAssetId
      ? "Attach an email content asset before sending a test."
      : "";
  const campaignEmailBlockedReason = !draftEmailChannel
    ? "Add an Email channel before sending this campaign."
    : hasUnsavedCampaignSendChanges
      ? "Save campaign changes before sending."
      : !draftEmailChannel.contentAssetId
        ? "Attach an email content asset before sending."
        : editingCampaign && editingCampaign.recipientCount <= 0
          ? "Save a recipient snapshot before sending."
          : "";
  const testEmailFeedbackIsError = Boolean(
    testEmailFeedback &&
    /fail|error|could not|attach|only/i.test(testEmailFeedback),
  );
  const testEmailPromptIsBlocked = Boolean(
    !testEmailFeedback && testEmailBlockedReason,
  );
  const campaignEmailFeedbackIsError = Boolean(
    campaignEmailFeedback &&
    /fail|error|could not|attach|only|no eligible/i.test(campaignEmailFeedback),
  );
  const campaignEmailPromptIsBlocked = Boolean(
    !campaignEmailFeedback && campaignEmailBlockedReason,
  );
  const journeyFeedbackIsError = Boolean(
    journeyFeedback &&
    /fail|error|could not|required|valid json/i.test(journeyFeedback),
  );
  const savedCampaignRecipients = editingCampaign?.recipients ?? [];
  const selectedCampaignMetrics = editingCampaign
    ? campaignMetrics.filter(
        (metric) => metric.campaignId === editingCampaign.id,
      )
    : [];
  const selectedCampaignMetricTotals = sumMarketingMetrics(
    selectedCampaignMetrics,
  );

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl leading-tight text-[#2f2135]">
            Marketing
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={activeTab === "dashboard" ? "/admin" : "/admin/marketing"}
              className="inline-flex items-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 py-3 font-bold text-[#2f2135] shadow-sm transition hover:border-purple-200 hover:text-purple-700"
            >
              {activeTab === "dashboard" ? (
                <LayoutGrid size={16} />
              ) : (
                <ArrowLeft size={16} />
              )}
              {activeTab === "dashboard" ? "Admin home" : "Back to Marketing"}
            </Link>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-3 font-bold text-white"
              onClick={() =>
                refreshAll().catch((error) => setMessage(error.message))
              }
            >
              <RefreshCw size={16} /> Refresh
            </button>
            {message && (
              <span className="rounded-xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">
                {message}
              </span>
            )}
          </div>
        </header>

        <section className="mt-5 grid gap-4">
          {showFoundationBanner ? (
            <div
              className="overflow-hidden rounded-[18px] border border-purple-200 bg-[#2f2135] text-white shadow-sm"
              data-testid="marketing-foundation-banner"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-200">
                    Marketing engine foundation
                  </p>
                  <h2 className="mt-2 text-3xl font-black">
                    Plan campaigns now. Send email safely.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-semibold text-white/70">
                    This module absorbs Lovable marketing data and sends saved
                    email campaign snapshots through VYVA. WhatsApp and social
                    channels remain planning-only until their provider controls
                    are ready.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill className="bg-white/10 text-white">
                    <CheckCircle2 size={13} className="mr-1" /> Email enabled
                  </Pill>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFoundationBanner(false);
                      window.localStorage.setItem(
                        MARKETING_FOUNDATION_BANNER_DISMISSED_KEY,
                        "true",
                      );
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Hide marketing engine banner"
                    title="Hide banner"
                    data-testid="button-dismiss-marketing-foundation-banner"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-[14px] border border-[#eadfd5] bg-white p-2 shadow-sm">
            <div
              className="flex gap-1 overflow-x-auto"
              role="tablist"
              aria-label="Marketing admin sections"
            >
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => openMarketingTab(tab)}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-black transition ${
                    activeTab === tab
                      ? "bg-purple-700 text-white shadow-sm"
                      : "text-[#5b4a46] hover:bg-[#fbf8f5] hover:text-purple-700"
                  }`}
                  data-testid={`tab-marketing-${tab}`}
                >
                  {tabLabel[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm xl:grid-cols-[1fr_180px_180px]">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b7a73]"
                aria-hidden="true"
              />
              <input
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaigns, journeys, content, contacts, lists, or media"
                data-testid="input-marketing-search"
              />
            </label>
            <select
              className={inputClass}
              value={channelFilter}
              onChange={(event) =>
                setChannelFilter(event.target.value as Channel | "all")
              }
              aria-label="Channel filter"
              data-testid="select-marketing-channel-filter"
            >
              <option value="all">All channels</option>
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channelLabel[channel]}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={audienceFilter}
              onChange={(event) =>
                setAudienceFilter(event.target.value as Audience | "all")
              }
              aria-label="Audience filter"
              data-testid="select-marketing-audience-filter"
            >
              <option value="all">All audiences</option>
              {AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {audience.toUpperCase()}
                </option>
              ))}
            </select>
            <div className="xl:col-span-3">
              {globalFiltersActive ? (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-sm font-bold text-purple-900"
                  data-testid="marketing-active-filters"
                >
                  <span className="text-xs uppercase tracking-[0.12em] text-purple-700">
                    Filters active
                  </span>
                  {search.trim() ? (
                    <Pill className="bg-white text-purple-800">
                      Search: {search.trim()}
                    </Pill>
                  ) : null}
                  {channelFilter !== "all" ? (
                    <Pill className={channelClass(channelFilter)}>
                      {channelLabel[channelFilter]}
                    </Pill>
                  ) : null}
                  {audienceFilter !== "all" ? (
                    <Pill className="bg-white text-purple-800">
                      {audienceFilter.toUpperCase()}
                    </Pill>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setChannelFilter("all");
                      setAudienceFilter("all");
                    }}
                    className="ml-auto inline-flex min-h-8 items-center justify-center rounded-lg border border-purple-200 bg-white px-3 text-xs font-black text-purple-700 hover:bg-purple-100"
                    data-testid="button-marketing-clear-global-filters"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <span data-testid="marketing-active-filters" />
              )}
            </div>
          </div>

          {activeTab === "social-studio" && (
            <SocialStudioPanel
              audiences={audiences.map((audience) => ({ id: audience.id, name: audience.name, memberCount: audience.memberCount }))}
              onCreated={() => refreshAll()}
            />
          )}

          {activeTab === "dashboard" && (
            <div className="grid gap-4" data-testid="marketing-dashboard-tab">
              {globalFiltersActive ? (
                <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">
                  Showing filtered dashboard results: {visibleCampaigns.length}{" "}
                  of {campaigns.length} campaigns, {visibleContent.length} of{" "}
                  {
                    content.filter(
                      (item) => !isMissingLovableContentAsset(item),
                    ).length
                  }{" "}
                  templates, {visibleContacts.length} of {contacts.length}{" "}
                  contacts.
                </p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard
                  label={
                    globalFiltersActive ? "Campaigns shown" : "Total campaigns"
                  }
                  value={dashboardTotals.campaigns}
                  icon={Megaphone}
                />
                <MetricCard
                  label={globalFiltersActive ? "Audiences shown" : "Audiences"}
                  value={dashboardTotals.audiences}
                  icon={UsersRound}
                />
                <MetricCard
                  label="This week"
                  value={dashboardTotals.thisWeek}
                  icon={CalendarDays}
                />
                <MetricCard
                  label="Scheduled"
                  value={dashboardTotals.scheduled}
                  icon={Clock}
                />
                <MetricCard
                  label="Published"
                  value={dashboardTotals.published}
                  icon={CheckCircle2}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
                <SectionCard
                  title="Campaign coverage"
                  subtitle="Click a card to filter the page."
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {dashboardChannelsToShow.map((item) => {
                      const active = channelFilter === item.channel;
                      return (
                        <button
                          key={item.channel}
                          type="button"
                          onClick={() =>
                            setChannelFilter(active ? "all" : item.channel)
                          }
                          className={`min-h-[104px] rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${channelClass(item.channel)} ${active ? "ring-2 ring-purple-400" : ""}`}
                          aria-pressed={active}
                          data-testid={`button-marketing-channel-card-${item.channel}`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-black">
                              {channelLabel[item.channel]}
                            </span>
                            {active ? (
                              <Pill className="bg-white text-purple-800">
                                Selected
                              </Pill>
                            ) : null}
                          </span>
                          <span className="mt-2 block text-2xl font-black">
                            {item.campaigns}
                          </span>
                          <span className="block text-xs font-bold opacity-80">
                            {item.content} template
                            {item.content === 1 ? "" : "s"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {dashboardContentOnlyChannelsToShow.length ? (
                    <details className="mt-4 rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-4 py-3">
                      <summary className="cursor-pointer text-sm font-black text-[#6f23d1]">
                        Content-only channels (
                        {dashboardContentOnlyChannelsToShow.length})
                      </summary>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {dashboardContentOnlyChannelsToShow.map((item) => (
                          <button
                            key={item.channel}
                            type="button"
                            onClick={() => setChannelFilter(item.channel)}
                            className="rounded-full border border-purple-100 bg-white px-3 py-2 text-xs font-black text-purple-700 transition hover:border-purple-300 hover:bg-purple-50"
                            data-testid={`button-marketing-content-only-channel-${item.channel}`}
                          >
                            {channelLabel[item.channel]} · {item.content}{" "}
                            {item.content === 1 ? "asset" : "assets"}
                          </button>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </SectionCard>

                <SectionCard
                  title="Audience coverage"
                  subtitle="Click an audience to filter."
                >
                  <div className="grid gap-3">
                    {dashboardAudiencesToShow.map((item) => {
                      const active = audienceFilter === item.audienceType;
                      return (
                        <button
                          key={item.audienceType}
                          type="button"
                          onClick={() =>
                            setAudienceFilter(
                              active ? "all" : item.audienceType,
                            )
                          }
                          className={`flex min-h-[74px] items-center justify-between gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${active ? "border-purple-300 bg-purple-50 ring-2 ring-purple-300" : "border-[#eadfd5] bg-[#fffaf4]"}`}
                          aria-pressed={active}
                          data-testid={`button-marketing-audience-card-${item.audienceType}`}
                        >
                          <span>
                            <span className="block font-black">
                              {item.audienceType.toUpperCase()}
                            </span>
                            <span className="text-xs font-bold text-[#8b7a73]">
                              {item.campaigns} campaigns / {item.contacts}{" "}
                              contacts
                            </span>
                          </span>
                          {active ? (
                            <Pill className="bg-white text-purple-800">
                              Selected
                            </Pill>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>

              <details
                className="rounded-2xl border border-[#eadfd5] bg-white shadow-sm"
                data-testid="marketing-analytics-panel"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
                  <span>
                    <span className="block font-serif text-xl font-black text-[#241133]">
                      Analytics
                    </span>
                    <span className="text-sm font-bold text-[#7d6b65]">
                      {campaignMetrics.length
                        ? `${visibleCampaignMetrics.length} visible performance rows`
                        : "No imported performance rows yet"}
                    </span>
                  </span>
                  <Pill
                    className={
                      campaignMetrics.length
                        ? "bg-blue-50 text-blue-800"
                        : "bg-[#fffaf4] text-[#8b7a73]"
                    }
                  >
                    {campaignMetrics.length}
                  </Pill>
                </summary>
                <div className="border-t border-[#eadfd5] p-4">
                  {visibleCampaignMetrics.length === 0 ? (
                    <EmptyState
                      text={
                        campaignMetrics.length
                          ? "No imported analytics match the current filters."
                          : "No campaign analytics imported yet."
                      }
                    />
                  ) : (
                    <div
                      className="overflow-x-auto rounded-xl border border-[#eadfd5]"
                      data-testid="marketing-analytics-table"
                    >
                      <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                          <tr>
                            <th className="px-4 py-3">Campaign</th>
                            <th className="px-4 py-3">Channel</th>
                            <th className="px-4 py-3">Sent</th>
                            <th className="px-4 py-3">Delivered</th>
                            <th className="px-4 py-3">Opened</th>
                            <th className="px-4 py-3">Clicked</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCampaignMetrics.map((metric) => {
                            const linkedCampaign = metric.campaignId
                              ? (campaignById.get(metric.campaignId) ?? null)
                              : null;
                            return (
                              <tr
                                key={metric.id}
                                className="border-t border-[#f0e7df]"
                              >
                                <td className="px-4 py-3 font-black">
                                  <p>
                                    {metric.campaignName ||
                                      metric.lovableExternalId ||
                                      "Unlinked campaign"}
                                  </p>
                                  {metric.lovableExternalId ? (
                                    <p className="mt-1 break-all text-xs font-bold text-[#7d6b65]">
                                      Lovable metric ID:{" "}
                                      {metric.lovableExternalId}
                                    </p>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 font-bold">
                                  {metric.channel}
                                </td>
                                <td className="px-4 py-3 font-bold">
                                  {metric.sent}
                                </td>
                                <td className="px-4 py-3 font-bold">
                                  {metric.delivered}
                                </td>
                                <td className="px-4 py-3 font-bold">
                                  {metric.opened}
                                </td>
                                <td className="px-4 py-3 font-bold">
                                  {metric.clicked}
                                </td>
                                <td className="px-4 py-3 font-bold">
                                  {metric.source}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-2">
                                    {linkedCampaign ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          startCampaignEdit(linkedCampaign);
                                          setMessage(
                                            `Opened campaign "${linkedCampaign.name}" from imported analytics.`,
                                          );
                                        }}
                                        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                                        disabled={campaignSaving}
                                        data-testid={`button-marketing-open-metric-campaign-${metric.id}`}
                                      >
                                        <ExternalLink size={13} /> Open campaign
                                      </button>
                                    ) : (
                                      <Pill className="bg-amber-50 text-amber-800">
                                        Unlinked
                                      </Pill>
                                    )}
                                    <MetadataPanel
                                      title="Imported metric metadata"
                                      value={metric.metadata}
                                      testId={`marketing-analytics-metadata-${metric.id}`}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </details>

              <details className="rounded-2xl border border-[#eadfd5] bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
                  <span>
                    <span className="block font-serif text-xl font-black text-[#241133]">
                      New campaign
                    </span>
                    <span className="text-sm font-bold text-[#7d6b65]">
                      Open only when you need to create one.
                    </span>
                  </span>
                  <span className="inline-flex min-h-9 items-center justify-center rounded-xl bg-purple-700 px-4 text-sm font-black text-white">
                    <Plus size={15} className="mr-1.5" /> Create
                  </span>
                </summary>
                <form
                  className="grid gap-3 border-t border-[#eadfd5] p-4"
                  onSubmit={(event) =>
                    createCampaign(event).catch((error) =>
                      setMessage(error.message),
                    )
                  }
                >
                  <div className="grid gap-3 xl:grid-cols-[1fr_130px_140px_1fr_180px_180px_auto]">
                    <Field label="Campaign name">
                      <input
                        className={inputClass}
                        value={campaignDraft.name}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Summer caregiver onboarding"
                        data-testid="input-marketing-campaign-name"
                      />
                    </Field>
                    <Field label="Audience">
                      <select
                        className={inputClass}
                        value={campaignDraft.audienceType}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            audienceType: event.target.value as Audience,
                          }))
                        }
                        data-testid="select-marketing-campaign-audience"
                      >
                        {AUDIENCES.map((audience) => (
                          <option key={audience} value={audience}>
                            {audience.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Channel">
                      <select
                        className={inputClass}
                        value={campaignDraft.channel}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            channel: event.target.value as Channel,
                            contentAssetId: "",
                          }))
                        }
                        data-testid="select-marketing-campaign-channel"
                      >
                        {CHANNELS.map((channel) => (
                          <option key={channel} value={channel}>
                            {channelLabel[channel]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Content asset">
                      <select
                        className={inputClass}
                        value={campaignDraft.contentAssetId}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            contentAssetId: event.target.value,
                          }))
                        }
                        data-testid="select-marketing-campaign-content"
                      >
                        <option value="">No content asset</option>
                        {campaignDraftContentOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Starts">
                      <input
                        className={inputClass}
                        type="datetime-local"
                        value={campaignDraft.scheduleStartsAt}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            scheduleStartsAt: event.target.value,
                            status: event.target.value ? "scheduled" : "draft",
                          }))
                        }
                        data-testid="input-marketing-campaign-schedule"
                      />
                    </Field>
                    <Field label="Ends">
                      <input
                        className={inputClass}
                        type="datetime-local"
                        value={campaignDraft.scheduleEndsAt}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            scheduleEndsAt: event.target.value,
                          }))
                        }
                        data-testid="input-marketing-campaign-schedule-end"
                      />
                    </Field>
                    <button
                      className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                      type="submit"
                      disabled={campaignSaving}
                      data-testid="button-marketing-create-campaign"
                    >
                      <Plus size={16} />{" "}
                      {campaignSaving ? "Creating..." : "Add campaign"}
                    </button>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto_160px]">
                    <Field label="Target list">
                      <select
                        className={inputClass}
                        value={campaignDraft.targetAudienceId}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            targetAudienceId: event.target.value,
                          }))
                        }
                        data-testid="select-marketing-campaign-target-audience"
                      >
                        <option value="">All eligible contacts</option>
                        {audiences.map((audience) => (
                          <option key={audience.id} value={audience.id}>
                            {audience.name} ({audience.mappedMemberCount}/
                            {audience.memberCount} mapped)
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Recipient filter">
                      <input
                        className={inputClass}
                        value={campaignDraft.recipientFilter}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            recipientFilter: event.target.value,
                          }))
                        }
                        placeholder="Optional name, company, tag..."
                        data-testid="input-marketing-campaign-recipient-filter"
                      />
                    </Field>
                    <label className="mt-6 flex min-h-11 items-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 text-sm font-black text-[#241133]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-purple-700"
                        checked={campaignDraft.snapshotRecipients}
                        onChange={(event) =>
                          setCampaignDraft((draft) => ({
                            ...draft,
                            snapshotRecipients: event.target.checked,
                          }))
                        }
                        data-testid="checkbox-marketing-campaign-snapshot"
                      />
                      Snapshot now
                    </label>
                    <div
                      className="rounded-xl border border-purple-100 bg-white p-3"
                      data-testid="marketing-campaign-draft-recipient-preview"
                    >
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                        Recipients
                      </p>
                      <p className="mt-1 text-2xl font-black text-[#241133]">
                        {campaignDraft.snapshotRecipients
                          ? campaignDraftRecipientPreview.length
                          : "-"}
                      </p>
                    </div>
                  </div>
                  {selectedCampaignDraftTargetAudience ? (
                    <p
                      className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-xs font-bold text-[#7d6b65]"
                      data-testid="marketing-campaign-draft-target-audience-summary"
                    >
                      {selectedCampaignDraftTargetAudience.name}:{" "}
                      {selectedCampaignDraftTargetAudience.mappedMemberCount}{" "}
                      mapped /{" "}
                      {
                        selectedCampaignDraftTargetAudience
                          .unmappedContactExternalIds.length
                      }{" "}
                      unmapped contacts.
                    </p>
                  ) : null}
                  <textarea
                    className={textareaClass}
                    value={campaignDraft.objective}
                    onChange={(event) =>
                      setCampaignDraft((draft) => ({
                        ...draft,
                        objective: event.target.value,
                      }))
                    }
                    placeholder="Objective or internal notes"
                  />
                </form>
              </details>

              <div className="grid gap-4">
                <SectionCard
                  title="Campaigns"
                  subtitle={
                    visibleCampaigns.length
                      ? `${campaignPageStart}-${campaignPageEnd} of ${visibleCampaigns.length} shown.`
                      : `0 of ${campaigns.length} shown.`
                  }
                  action={
                    visibleCampaigns.length > CAMPAIGN_PAGE_SIZE ? (
                      <div
                        className="flex items-center gap-2"
                        data-testid="marketing-campaign-pagination"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setCampaignPage((page) => Math.max(1, page - 1))
                          }
                          disabled={campaignPage === 1}
                          className="inline-flex min-h-9 items-center rounded-xl border border-[#eadfd5] bg-white px-3 text-sm font-black text-[#2f2135] disabled:cursor-not-allowed disabled:text-[#b8abb8]"
                          data-testid="button-marketing-campaign-prev-page"
                        >
                          Previous
                        </button>
                        <span
                          className="text-sm font-black text-[#7d6b65]"
                          data-testid="marketing-campaign-page-label"
                        >
                          Page {campaignPage} / {campaignPageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCampaignPage((page) =>
                              Math.min(campaignPageCount, page + 1),
                            )
                          }
                          disabled={campaignPage === campaignPageCount}
                          className="inline-flex min-h-9 items-center rounded-xl border border-[#eadfd5] bg-white px-3 text-sm font-black text-[#2f2135] disabled:cursor-not-allowed disabled:text-[#b8abb8]"
                          data-testid="button-marketing-campaign-next-page"
                        >
                          Next
                        </button>
                      </div>
                    ) : null
                  }
                >
                  <CampaignTable
                    campaigns={pagedCampaigns}
                    contentById={contentById}
                    contentTitleById={contentTitleById}
                    metricsByCampaignId={campaignMetricSummaryByCampaignId}
                    audiences={audiences}
                    activeCampaignId={editingCampaignId}
                    onEdit={startCampaignEdit}
                    onDelete={(campaign) =>
                      deleteCampaign(campaign).catch((error) =>
                        setMessage(error.message),
                      )
                    }
                    onPreviewContent={previewContent}
                    onEditContent={startContentEdit}
                    actionsDisabled={campaignSaving}
                    confirmingDeleteId={confirmingCampaignDeleteId}
                  />
                </SectionCard>

                <SectionCard
                  title={editingCampaign ? "Edit campaign" : "Campaign details"}
                  subtitle={
                    editingCampaign
                      ? "Change the message, audience, schedule, and recipients."
                      : "Select a campaign from the list."
                  }
                >
                  {editingCampaign ? (
                    <form
                      className="grid gap-4"
                      onSubmit={(event) =>
                        saveCampaignEdit(event, editingCampaign.id).catch(
                          (error) => setMessage(error.message),
                        )
                      }
                      data-testid="marketing-campaign-edit-form"
                    >
                      <div
                        className="grid gap-3"
                        data-testid="marketing-campaign-detail-panel"
                      >
                        <Field label="Campaign name">
                          <input
                            className={inputClass}
                            value={campaignEditDraft.name}
                            onChange={(event) =>
                              setCampaignEditDraft((draft) => ({
                                ...draft,
                                name: event.target.value,
                              }))
                            }
                            data-testid="input-marketing-edit-campaign-name"
                          />
                        </Field>
                        <div className="grid gap-3 xl:grid-cols-2">
                          <Field label="Audience">
                            <select
                              className={inputClass}
                              value={campaignEditDraft.audienceType}
                              onChange={(event) =>
                                setCampaignEditDraft((draft) => ({
                                  ...draft,
                                  audienceType: event.target.value as Audience,
                                }))
                              }
                              data-testid="select-marketing-edit-campaign-audience"
                            >
                              {AUDIENCES.map((audience) => (
                                <option key={audience} value={audience}>
                                  {audience.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Status">
                            <select
                              className={inputClass}
                              value={campaignEditDraft.status}
                              onChange={(event) => {
                                const status = event.target
                                  .value as CampaignStatus;
                                setCampaignEditDraft((draft) => {
                                  const channels =
                                    campaignChannelsWithPrimary(draft);
                                  return {
                                    ...draft,
                                    status,
                                    channels: channels.map((channel, index) =>
                                      index === 0
                                        ? { ...channel, status }
                                        : channel,
                                    ),
                                  };
                                });
                              }}
                              data-testid="select-marketing-edit-campaign-status"
                            >
                              {CAMPAIGN_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-2">
                          <Field label="Primary/send channel">
                            <select
                              className={inputClass}
                              value={campaignEditDraft.channel}
                              onChange={(event) => {
                                const channel = event.target.value as Channel;
                                setCampaignEditDraft((draft) => {
                                  const channels =
                                    campaignChannelsWithPrimary(draft);
                                  const selectedContent = draft.contentAssetId
                                    ? (content.find(
                                        (item) =>
                                          item.id === draft.contentAssetId,
                                      ) ?? null)
                                    : null;
                                  const firstContentAssetId =
                                    selectedContent?.channel === channel
                                      ? draft.contentAssetId
                                      : "";
                                  return {
                                    ...draft,
                                    channel,
                                    contentAssetId: firstContentAssetId,
                                    channels: [
                                      {
                                        ...(channels[0] ??
                                          newCampaignChannelDraft()),
                                        channel,
                                        contentAssetId: firstContentAssetId,
                                      },
                                      ...channels.slice(1),
                                    ],
                                  };
                                });
                              }}
                              data-testid="select-marketing-edit-campaign-channel"
                            >
                              {CHANNELS.map((channel) => (
                                <option key={channel} value={channel}>
                                  {channelLabel[channel]}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Primary content asset">
                            <select
                              className={inputClass}
                              value={
                                campaignEditPrimaryContentOptions.some(
                                  (item) =>
                                    item.id ===
                                    campaignEditDraft.contentAssetId,
                                )
                                  ? campaignEditDraft.contentAssetId
                                  : ""
                              }
                              onChange={(event) => {
                                const contentAssetId = event.target.value;
                                setCampaignEditDraft((draft) => {
                                  const channels =
                                    campaignChannelsWithPrimary(draft);
                                  return {
                                    ...draft,
                                    contentAssetId,
                                    channels: channels.map((channel, index) =>
                                      index === 0
                                        ? { ...channel, contentAssetId }
                                        : channel,
                                    ),
                                  };
                                });
                              }}
                              data-testid="select-marketing-edit-campaign-content"
                            >
                              <option value="">
                                Select {channelLabel[campaignEditDraft.channel]}{" "}
                                content
                              </option>
                              {campaignEditPrimaryContentOptions.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title}
                                </option>
                              ))}
                            </select>
                            {campaignEditDraft.contentAssetId &&
                            !campaignEditPrimaryContentOptions.some(
                              (item) =>
                                item.id === campaignEditDraft.contentAssetId,
                            ) ? (
                              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                                This campaign points to missing Lovable content.
                                Choose a real content asset before sending.
                              </p>
                            ) : null}
                          </Field>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-3">
                          <Field label="Starts">
                            <input
                              className={inputClass}
                              type="datetime-local"
                              value={campaignEditDraft.scheduleStartsAt}
                              onChange={(event) => {
                                const scheduleStartsAt = event.target.value;
                                setCampaignEditDraft((draft) => {
                                  const channels =
                                    campaignChannelsWithPrimary(draft);
                                  return {
                                    ...draft,
                                    scheduleStartsAt,
                                    channels: channels.map((channel, index) =>
                                      index === 0
                                        ? {
                                            ...channel,
                                            scheduledAt: scheduleStartsAt,
                                          }
                                        : channel,
                                    ),
                                  };
                                });
                              }}
                              data-testid="input-marketing-edit-campaign-schedule"
                            />
                          </Field>
                          <Field label="Ends">
                            <input
                              className={inputClass}
                              type="datetime-local"
                              value={campaignEditDraft.scheduleEndsAt}
                              onChange={(event) =>
                                setCampaignEditDraft((draft) => ({
                                  ...draft,
                                  scheduleEndsAt: event.target.value,
                                }))
                              }
                              data-testid="input-marketing-edit-campaign-schedule-end"
                            />
                          </Field>
                          <Field label="Timezone">
                            <input
                              className={inputClass}
                              value={campaignEditDraft.timezone}
                              onChange={(event) =>
                                setCampaignEditDraft((draft) => ({
                                  ...draft,
                                  timezone: event.target.value,
                                }))
                              }
                              data-testid="input-marketing-edit-campaign-timezone"
                            />
                          </Field>
                        </div>
                        <Field label="Objective">
                          <textarea
                            className={textareaClass}
                            value={campaignEditDraft.objective}
                            onChange={(event) =>
                              setCampaignEditDraft((draft) => ({
                                ...draft,
                                objective: event.target.value,
                              }))
                            }
                            data-testid="input-marketing-edit-campaign-objective"
                          />
                        </Field>
                        <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
                          <Field label="Target list">
                            <select
                              className={inputClass}
                              value={campaignEditDraft.targetAudienceId}
                              onChange={(event) =>
                                setCampaignEditDraft((draft) => ({
                                  ...draft,
                                  targetAudienceId: event.target.value,
                                }))
                              }
                              data-testid="select-marketing-edit-campaign-target-audience"
                            >
                              <option value="">All eligible contacts</option>
                              {audiences.map((audience) => (
                                <option key={audience.id} value={audience.id}>
                                  {audience.name} ({audience.mappedMemberCount}/
                                  {audience.memberCount} mapped)
                                </option>
                              ))}
                            </select>
                          </Field>
                          {selectedCampaignTargetAudience ? (
                            <div
                              className="rounded-xl border border-purple-100 bg-white p-3 text-xs font-bold text-[#7d6b65]"
                              data-testid="marketing-campaign-target-audience-summary"
                            >
                              <span className="text-[#241133]">
                                {selectedCampaignTargetAudience.name}
                              </span>{" "}
                              is a {selectedCampaignTargetAudience.source}{" "}
                              {selectedCampaignTargetAudience.listType} list
                              with{" "}
                              {selectedCampaignTargetAudience.mappedMemberCount}{" "}
                              mapped and{" "}
                              {
                                selectedCampaignTargetAudience
                                  .unmappedContactExternalIds.length
                              }{" "}
                              unmapped contacts.
                            </div>
                          ) : (
                            <div className="rounded-xl border border-[#eadfd5] bg-white p-3 text-xs font-bold text-[#8b7a73]">
                              No imported list selected. Recipient snapshots
                              will use all eligible contacts.
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3"
                        data-testid="marketing-campaign-channels-editor"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#241133]">
                              Campaign channels
                            </p>
                            <p className="text-xs font-bold text-[#8b7a73]">
                              Email can send through VYVA. Social channels are
                              manual publishing steps for now.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={addCampaignChannel}
                            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-purple-700 px-3 text-xs font-black text-white"
                            data-testid="button-marketing-add-campaign-channel"
                          >
                            <Plus size={14} /> Add channel
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {campaignChannelsWithPrimary(campaignEditDraft).map(
                            (channelDraft, index) => {
                              const channelContentAssets = content.filter(
                                (item) =>
                                  item.channel === channelDraft.channel &&
                                  item.status !== "archived",
                              );
                              const selectedChannelContent =
                                channelDraft.contentAssetId
                                  ? content.find(
                                      (item) =>
                                        item.id === channelDraft.contentAssetId,
                                    )
                                  : null;
                              const selectedChannelMediaAssets =
                                selectedChannelContent
                                  ? mediaAssets.filter(
                                      (item) =>
                                        item.contentAssetId ===
                                        selectedChannelContent.id,
                                    )
                                  : [];
                              const options =
                                selectedChannelContent &&
                                !channelContentAssets.some(
                                  (item) =>
                                    item.id === selectedChannelContent.id,
                                )
                                  ? [
                                      selectedChannelContent,
                                      ...channelContentAssets,
                                    ]
                                  : channelContentAssets;
                              return (
                                <div
                                  key={channelDraft.id}
                                  className="grid gap-3 rounded-xl border border-[#eadfd5] bg-white p-3"
                                  data-testid={`marketing-campaign-channel-row-${index}`}
                                >
                                  <div className="grid gap-3 xl:grid-cols-[150px_1fr_130px_190px_auto]">
                                    <Field
                                      label={
                                        index === 0
                                          ? "Primary channel"
                                          : "Channel"
                                      }
                                    >
                                      <select
                                        className={inputClass}
                                        value={channelDraft.channel}
                                        onChange={(event) =>
                                          updateCampaignChannel(
                                            channelDraft.id,
                                            {
                                              channel: event.target
                                                .value as Channel,
                                            },
                                          )
                                        }
                                        data-testid={`select-marketing-campaign-channel-${index}`}
                                      >
                                        {CHANNELS.map((channel) => (
                                          <option key={channel} value={channel}>
                                            {channelLabel[channel]}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>
                                    <Field label="Content asset">
                                      <select
                                        className={inputClass}
                                        value={channelDraft.contentAssetId}
                                        onChange={(event) =>
                                          updateCampaignChannel(
                                            channelDraft.id,
                                            {
                                              contentAssetId:
                                                event.target.value,
                                            },
                                          )
                                        }
                                        data-testid={`select-marketing-campaign-channel-content-${index}`}
                                      >
                                        <option value="">
                                          No content asset
                                        </option>
                                        {options.map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.title}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>
                                    <Field label="Status">
                                      <select
                                        className={inputClass}
                                        value={channelDraft.status}
                                        onChange={(event) =>
                                          updateCampaignChannel(
                                            channelDraft.id,
                                            {
                                              status: event.target
                                                .value as CampaignStatus,
                                            },
                                          )
                                        }
                                        data-testid={`select-marketing-campaign-channel-status-${index}`}
                                      >
                                        {CAMPAIGN_STATUSES.map((status) => (
                                          <option key={status} value={status}>
                                            {status}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>
                                    <Field label="Scheduled at">
                                      <input
                                        className={inputClass}
                                        type="datetime-local"
                                        value={channelDraft.scheduledAt}
                                        onChange={(event) =>
                                          updateCampaignChannel(
                                            channelDraft.id,
                                            { scheduledAt: event.target.value },
                                          )
                                        }
                                        data-testid={`input-marketing-campaign-channel-schedule-${index}`}
                                      />
                                    </Field>
                                    <div className="flex items-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeCampaignChannel(channelDraft.id)
                                        }
                                        disabled={
                                          campaignChannelsWithPrimary(
                                            campaignEditDraft,
                                          ).length <= 1
                                        }
                                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:bg-[#f5eee8] disabled:text-red-300"
                                        data-testid={`button-marketing-remove-campaign-channel-${index}`}
                                      >
                                        <Trash2 size={13} /> Remove
                                      </button>
                                    </div>
                                  </div>
                                  <LinkedContentPreview
                                    contentAsset={
                                      selectedChannelContent ?? null
                                    }
                                    linkedMediaAssets={
                                      selectedChannelMediaAssets
                                    }
                                    testId={`marketing-campaign-channel-content-preview-${index}`}
                                    onPreview={previewContent}
                                    onEdit={startContentEdit}
                                  />
                                  {isSocialChannel(channelDraft.channel) ? (
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ead9f9] bg-[#fbf7ff] p-3">
                                      <div className="min-w-[240px]">
                                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#7c1fd1]">
                                          Manual publish
                                        </p>
                                        <p className="text-xs font-bold text-[#6f625d]">
                                          Copy the post, publish it in{" "}
                                          {channelLabel[channelDraft.channel]},
                                          then mark it here.
                                        </p>
                                        {socialPublishFeedback[
                                          channelDraft.id
                                        ] ? (
                                          <p className="mt-1 text-xs font-black text-[#0b7a4b]">
                                            {
                                              socialPublishFeedback[
                                                channelDraft.id
                                              ]
                                            }
                                          </p>
                                        ) : null}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          disabled={!selectedChannelContent}
                                          onClick={() =>
                                            void copySocialPost(
                                              channelDraft.id,
                                              selectedChannelContent,
                                            )
                                          }
                                          className="rounded-xl border border-[#e8d7c9] bg-white px-3 py-2 text-xs font-black text-[#241133] shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                                          data-testid={`button-marketing-copy-social-post-${index}`}
                                        >
                                          Copy post
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openSocialPlatform(
                                              channelDraft.channel,
                                            )
                                          }
                                          className="rounded-xl border border-[#e8d7c9] bg-white px-3 py-2 text-xs font-black text-[#241133] shadow-sm"
                                          data-testid={`button-marketing-open-social-platform-${index}`}
                                        >
                                          Open{" "}
                                          {channelLabel[channelDraft.channel]}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            markSocialChannelPublished(
                                              channelDraft.id,
                                            )
                                          }
                                          className="rounded-xl bg-[#8727d8] px-3 py-2 text-xs font-black text-white shadow-sm"
                                          data-testid={`button-marketing-mark-social-published-${index}`}
                                        >
                                          Mark published
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#241133]">
                              Saved recipients
                            </p>
                            <p className="text-xs font-bold text-[#8b7a73]">
                              {editingCampaign.recipientCount} recipients are
                              currently snapshotted for this campaign.
                            </p>
                          </div>
                          <Pill className="bg-purple-50 text-purple-800">
                            {savedCampaignRecipients.length > 0
                              ? `${savedCampaignRecipients.length} shown`
                              : "None saved"}
                          </Pill>
                        </div>
                        {savedCampaignRecipients.length === 0 ? (
                          <p className="mt-3 rounded-lg bg-white p-3 text-sm font-bold text-[#8b7a73]">
                            No recipient snapshot saved yet.
                          </p>
                        ) : (
                          <div className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-1">
                            {savedCampaignRecipients.map((recipient) => {
                              const contact =
                                contactByCampaignRecipientId.get(
                                  recipient.id,
                                ) ?? null;
                              const contactSummary = contact
                                ? [
                                    contact.email,
                                    contact.phoneNumber,
                                    contact.whatsappNumber,
                                    contact.companyName,
                                  ]
                                    .filter(Boolean)
                                    .join(" - ")
                                : "";
                              return (
                                <div
                                  key={recipient.id}
                                  className="grid gap-2 rounded-lg bg-white p-2 text-sm font-bold"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <span className="block truncate text-[#241133]">
                                        {recipientSnapshotLabel(recipient)}
                                      </span>
                                      <span className="block truncate text-xs text-[#8b7a73]">
                                        {recipient.recipient}
                                      </span>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                                      <Pill
                                        className={channelClass(
                                          recipient.channel,
                                        )}
                                      >
                                        {recipient.channel}
                                      </Pill>
                                      <Pill
                                        className={statusClass(
                                          recipient.status,
                                        )}
                                      >
                                        {recipient.status}
                                      </Pill>
                                    </div>
                                  </div>
                                  {contact ? (
                                    <div
                                      className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"
                                      data-testid={`marketing-campaign-recipient-contact-${recipient.id}`}
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-black">
                                            {contact.fullName ||
                                              contact.email ||
                                              contact.phoneNumber ||
                                              "Unnamed contact"}
                                          </p>
                                          {contactSummary ? (
                                            <p className="mt-0.5 text-emerald-800">
                                              {contactSummary}
                                            </p>
                                          ) : null}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            startContactEdit(contact)
                                          }
                                          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2 text-xs font-black text-emerald-800"
                                          data-testid={`button-marketing-open-recipient-contact-${recipient.id}`}
                                        >
                                          <Pencil size={12} /> Open contact
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                  <MetadataPanel
                                    title="Saved recipient snapshot"
                                    value={recordValue(recipient.snapshot)}
                                    testId={`marketing-campaign-recipient-snapshot-${recipient.id}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <label className="flex flex-wrap items-center gap-3 text-sm font-black">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-purple-700"
                            checked={campaignEditDraft.snapshotRecipients}
                            onChange={(event) =>
                              setCampaignEditDraft((draft) => ({
                                ...draft,
                                snapshotRecipients: event.target.checked,
                              }))
                            }
                            data-testid="checkbox-marketing-edit-campaign-snapshot"
                          />
                          Replace saved recipients with a fresh Contacts
                          snapshot
                        </label>
                        <p className="mt-1 text-xs font-bold text-[#8b7a73]">
                          This stores planned recipients only. Sending is a
                          separate explicit action.
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#8b7a73]">
                          Email recipients can be sent after saving this
                          snapshot. WhatsApp and social channels remain locked.
                        </p>
                        {campaignEditDraft.snapshotRecipients ? (
                          <div className="mt-3 grid gap-3">
                            <Field label="Recipient filter">
                              <input
                                className={inputClass}
                                value={campaignEditDraft.recipientFilter}
                                onChange={(event) =>
                                  setCampaignEditDraft((draft) => ({
                                    ...draft,
                                    recipientFilter: event.target.value,
                                  }))
                                }
                                placeholder="Filter by name, company, tag, market, list..."
                                data-testid="input-marketing-edit-campaign-recipient-filter"
                              />
                            </Field>
                            <div
                              className="rounded-xl border border-purple-100 bg-white p-3"
                              data-testid="marketing-campaign-recipient-preview"
                            >
                              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                                Preview
                              </p>
                              <p className="mt-1 text-2xl font-black text-[#241133]">
                                {campaignRecipientPreview.length}
                              </p>
                              <p className="text-xs font-bold text-[#8b7a73]">
                                eligible planned recipients
                              </p>
                            </div>
                            {campaignRecipientPreview.length === 0 ? (
                              <EmptyState text="No eligible contacts match this audience, channel, and filter." />
                            ) : (
                              <div className="flex max-h-[240px] flex-wrap gap-2 overflow-y-auto pr-1">
                                {campaignRecipientPreview.map((contact) => (
                                  <Pill
                                    key={contact.id}
                                    className="bg-purple-50 text-purple-800"
                                  >
                                    {contact.fullName ||
                                      contact.email ||
                                      contact.phoneNumber ||
                                      contact.id}
                                  </Pill>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <details className="rounded-xl border border-[#eadfd5] bg-white p-3">
                        <summary className="cursor-pointer text-sm font-black text-purple-700">
                          Advanced source fields
                        </summary>
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                          <Field label="Source">
                            <input
                              className={inputClass}
                              value={campaignEditDraft.source}
                              onChange={(event) =>
                                setCampaignEditDraft((draft) => ({
                                  ...draft,
                                  source: event.target.value,
                                }))
                              }
                              data-testid="input-marketing-edit-campaign-source"
                            />
                          </Field>
                          <Field label="Lovable ID">
                            <input
                              className={inputClass}
                              value={campaignEditDraft.lovableExternalId}
                              onChange={(event) =>
                                setCampaignEditDraft((draft) => ({
                                  ...draft,
                                  lovableExternalId: event.target.value,
                                }))
                              }
                              data-testid="input-marketing-edit-campaign-lovable-id"
                            />
                          </Field>
                        </div>
                        <Field label="Campaign metadata JSON">
                          <textarea
                            className={`${textareaClass} min-h-[150px] font-mono text-xs`}
                            value={campaignEditDraft.metadataText}
                            onChange={(event) =>
                              setCampaignEditDraft((draft) => ({
                                ...draft,
                                metadataText: event.target.value,
                              }))
                            }
                            data-testid="textarea-marketing-edit-campaign-metadata"
                          />
                        </Field>
                      </details>

                      <details
                        className="rounded-xl border border-[#eadfd5] bg-white p-3"
                        data-testid="marketing-campaign-performance-panel"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
                          <span className="text-sm font-black text-purple-700">
                            Performance
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#8b7a73]">
                              {selectedCampaignMetrics.length} rows
                            </span>
                            <Pill className="bg-blue-50 text-blue-800">
                              {selectedCampaignMetricTotals.sent} sent
                            </Pill>
                          </span>
                        </summary>
                        {selectedCampaignMetrics.length === 0 ? (
                          <p className="mt-3 rounded-lg bg-[#fffaf4] p-3 text-sm font-bold text-[#8b7a73]">
                            No performance metrics imported for this campaign
                            yet.
                          </p>
                        ) : (
                          <div className="mt-3 grid gap-3">
                            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-[#7d6b65] xl:grid-cols-4">
                              <div className="rounded-lg bg-[#fffaf4] p-2">
                                <p className="uppercase tracking-[0.12em]">
                                  Delivered
                                </p>
                                <p className="mt-1 text-lg font-black text-[#241133]">
                                  {selectedCampaignMetricTotals.delivered}
                                </p>
                              </div>
                              <div className="rounded-lg bg-[#fffaf4] p-2">
                                <p className="uppercase tracking-[0.12em]">
                                  Opened
                                </p>
                                <p className="mt-1 text-lg font-black text-[#241133]">
                                  {selectedCampaignMetricTotals.opened}
                                </p>
                              </div>
                              <div className="rounded-lg bg-[#fffaf4] p-2">
                                <p className="uppercase tracking-[0.12em]">
                                  Clicked
                                </p>
                                <p className="mt-1 text-lg font-black text-[#241133]">
                                  {selectedCampaignMetricTotals.clicked}
                                </p>
                              </div>
                              <div className="rounded-lg bg-[#fffaf4] p-2">
                                <p className="uppercase tracking-[0.12em]">
                                  Replies
                                </p>
                                <p className="mt-1 text-lg font-black text-[#241133]">
                                  {selectedCampaignMetricTotals.replied}
                                </p>
                              </div>
                            </div>
                            <div className="grid gap-2">
                              {selectedCampaignMetrics.map((metric) => (
                                <div
                                  key={metric.id}
                                  className="grid gap-2 rounded-lg bg-[#fffaf4] p-2 text-xs font-bold text-[#7d6b65]"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                      {formatDate(metric.metricDate)} /{" "}
                                      {metric.channel} / {metric.source}
                                    </span>
                                    <span>
                                      {metric.delivered} delivered,{" "}
                                      {metric.clicked} clicked
                                    </span>
                                  </div>
                                  <MetadataPanel
                                    title="Imported metric metadata"
                                    value={metric.metadata}
                                    testId={`marketing-campaign-metric-metadata-${metric.id}`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </details>

                      <div className="grid gap-2">
                        <button
                          type="submit"
                          disabled={campaignSaving}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                          data-testid="button-marketing-save-campaign"
                        >
                          <Save size={15} />{" "}
                          {campaignSaving ? "Saving..." : "Save campaign"}
                        </button>
                        <button
                          type="button"
                          disabled={testEmailDisabled}
                          onClick={() =>
                            editingCampaign
                              ? void sendTestCampaignEmail(editingCampaign.id)
                              : undefined
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                          data-testid="button-marketing-send-test-email"
                        >
                          <Send size={15} />{" "}
                          {testEmailSending
                            ? "Sending test..."
                            : "Send test email to me"}
                        </button>
                        <button
                          type="button"
                          disabled={campaignEmailDisabled}
                          onClick={() =>
                            editingCampaign
                              ? void sendCampaignEmails(editingCampaign)
                              : undefined
                          }
                          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8] ${confirmingCampaignSendId === editingCampaign.id ? "bg-red-700" : "bg-purple-700"}`}
                          data-testid="button-marketing-send-campaign-email"
                        >
                          <Send size={15} />{" "}
                          {campaignEmailSending
                            ? "Sending campaign..."
                            : confirmingCampaignSendId === editingCampaign.id
                              ? "Confirm send emails"
                              : "Send campaign emails"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelCampaignEdit}
                          disabled={campaignSaving}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#2f2135] disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                          data-testid="button-marketing-cancel-campaign"
                        >
                          <X size={15} /> Close details
                        </button>
                      </div>
                      {campaignEmailFeedback || campaignEmailBlockedReason ? (
                        <p
                          className={`rounded-xl px-4 py-3 text-sm font-bold ${campaignEmailFeedbackIsError ? "bg-red-50 text-red-800" : campaignEmailPromptIsBlocked ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
                          data-testid="marketing-campaign-email-feedback"
                        >
                          {campaignEmailFeedback || campaignEmailBlockedReason}
                        </p>
                      ) : null}
                      {testEmailFeedback ||
                      testEmailBlockedReason ||
                      selectedEmailContent ? (
                        <p
                          className={`rounded-xl px-4 py-3 text-sm font-bold ${testEmailFeedbackIsError ? "bg-red-50 text-red-800" : testEmailPromptIsBlocked ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
                          data-testid="marketing-test-email-feedback"
                        >
                          {testEmailFeedback ||
                            testEmailBlockedReason ||
                            `Ready to send a test using "${selectedEmailContent?.title}".`}
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <EmptyState text="No campaign selected." />
                  )}
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === "journeys" && (
            <div className="grid gap-4" data-testid="marketing-journeys-tab">
              <SectionCard
                title={editingJourneyId ? "Journey builder" : "Journeys"}
                subtitle={
                  editingJourneyId
                    ? "Build the sequence, then save it as a planning draft."
                    : `${visibleJourneys.length} of ${journeys.length} journeys.`
                }
                action={
                  editingJourneyId ? (
                    <button
                      type="button"
                      onClick={cancelJourneyEdit}
                      disabled={journeySaving}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#241133] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArrowLeft size={15} /> Back to journeys
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startNewJourney}
                      disabled={journeySaving}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                      data-testid="button-marketing-new-journey"
                    >
                      <Plus size={15} /> New journey
                    </button>
                  )
                }
              >
                <div className="grid gap-4">
                  {!editingJourneyId ? (
                    <div className="grid content-start gap-3 lg:grid-cols-2">
                    {visibleJourneys.length === 0 ? (
                      <EmptyState text="No journeys match the filters." />
                    ) : (
                      visibleJourneys.map((journey) => {
                        const isActive = editingJourneyId === journey.id;
                        const journeyAudience = journeyTargetAudience(
                          journey,
                          audiences,
                        );
                        const summaryDraft = journeyEditDraftFromJourney(
                          journey,
                          audiences,
                          content,
                        );
                        return (
                          <article
                            key={journey.id}
                            className={`rounded-xl border p-4 ${isActive ? "border-purple-300 bg-purple-50" : "border-[#eadfd5] bg-white"}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-black">{journey.name}</h3>
                                {journey.objective ? (
                                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#7d6b65]">
                                    {journey.objective}
                                  </p>
                                ) : null}
                                <div
                                  className="mt-3 grid gap-2 text-sm sm:grid-cols-2"
                                  data-testid={`marketing-journey-logic-${journey.id}`}
                                >
                                  <div className="rounded-lg bg-[#faf7f3] px-3 py-2">
                                    <span className="block text-[11px] font-black uppercase text-[#8b7a73]">
                                      Starts
                                    </span>
                                    <span className="font-bold text-[#241133]">
                                      {journeyEntryLabel(
                                        summaryDraft,
                                        journeyAudience,
                                      )}
                                    </span>
                                  </div>
                                  <div className="rounded-lg bg-[#faf7f3] px-3 py-2">
                                    <span className="block text-[11px] font-black uppercase text-[#8b7a73]">
                                      Stops
                                    </span>
                                    <span className="font-bold text-[#241133]">
                                      {journeyStopLabel(summaryDraft)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Pill className="bg-amber-50 text-amber-800">
                                  Planning only
                                </Pill>
                                <Pill className={statusClass(journey.status)}>
                                  {journey.status}
                                </Pill>
                                <Pill className="bg-purple-50 text-purple-700">
                                  {journey.audienceType.toUpperCase()}
                                </Pill>
                                <button
                                  type="button"
                                  onClick={() => startJourneyEdit(journey)}
                                  disabled={journeySaving}
                                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                                  data-testid={`button-marketing-edit-journey-${journey.id}`}
                                >
                                  <Pencil size={14} /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteJourney(journey)}
                                  disabled={journeySaving}
                                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:text-red-300"
                                  data-testid={`button-marketing-delete-journey-${journey.id}`}
                                >
                                  <Trash2 size={14} />{" "}
                                  {confirmingJourneyDeleteId === journey.id
                                    ? "Confirm delete"
                                    : "Delete"}
                                </button>
                                {confirmingJourneyDeleteId === journey.id ? (
                                  <p
                                    className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800"
                                    data-testid={`marketing-journey-delete-confirmation-${journey.id}`}
                                  >
                                    Click Confirm delete to remove this journey
                                    and its steps.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-4 border-t border-[#eee4dc] pt-3">
                              {journey.steps.length === 0 ? (
                                <span className="text-sm font-bold text-[#8b7a73]">
                                  No actions added yet.
                                </span>
                              ) : (
                                <ol className="grid gap-2">
                                  {journey.steps.slice(0, 6).map((step) => {
                                    const stepContent =
                                      contentAssetByReference(
                                        content,
                                        step.contentAssetId,
                                      ) ??
                                      contentAssetByReference(
                                        content,
                                        step.templateRef,
                                      );
                                    return (
                                      <li
                                        key={step.id}
                                        className="flex min-w-0 items-center gap-3 rounded-lg border border-[#eadfd5] bg-[#fffaf4] px-3 py-2"
                                      >
                                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-purple-100 text-xs font-black text-purple-800">
                                          {step.stepOrder + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-black text-[#241133]">
                                            {stepContent?.title ??
                                              (step.kind === "wait"
                                                ? "Wait"
                                                : `${channelLabel[step.channel]} message`)}
                                          </p>
                                          <p className="text-xs font-bold text-[#7d6b65]">
                                            Day{" "}
                                            {step.dayOffset ??
                                              Math.floor(step.delayHours / 24)}
                                            {step.kind !== "wait"
                                              ? ` · ${channelLabel[step.channel]}`
                                              : ""}
                                          </p>
                                        </div>
                                        {stepContent ? (
                                          <div className="flex shrink-0 items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                previewContent(stepContent)
                                              }
                                              className="inline-flex size-8 items-center justify-center rounded-lg border border-purple-200 bg-white text-purple-700"
                                              title="Preview message"
                                              aria-label="Preview message"
                                              data-testid={`button-marketing-preview-journey-step-content-${step.id}`}
                                            >
                                              <Eye size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                startContentEdit(stepContent)
                                              }
                                              className="inline-flex size-8 items-center justify-center rounded-lg border border-purple-200 bg-white text-purple-700"
                                              title="Edit message"
                                              aria-label="Edit message"
                                              data-testid={`button-marketing-edit-journey-step-content-${step.id}`}
                                            >
                                              <Pencil size={14} />
                                            </button>
                                          </div>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                  {journey.steps.length > 6 ? (
                                    <li className="rounded-lg border border-dashed border-[#eadfd5] bg-white px-3 py-2 text-sm font-black text-[#7d6b65]">
                                      +{journey.steps.length - 6} more
                                      follow-ups
                                    </li>
                                  ) : null}
                                </ol>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                    </div>
                  ) : null}

                  {editingJourneyId ? (
                    <form
                      className="grid content-start gap-4 rounded-xl border border-[#eadfd5] bg-white p-4"
                      onSubmit={saveJourneyEdit}
                      data-testid="marketing-journey-editor-form"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-[#241133]">
                            {editingJourneyId === "new"
                              ? "New journey"
                              : journeyEditDraft.name || "Journey"}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                            {journeyEditDraft.status === "active"
                              ? "Follow-up emails run automatically after each wait."
                              : "Build and review the sequence. Saving keeps it as a draft."}
                          </p>
                        </div>
                        <Pill className="bg-amber-50 text-amber-800">
                          {journeyEditDraft.status === "active" ? "Running" : "Draft"}
                        </Pill>
                      </div>

                      <nav
                        className="grid grid-cols-5 overflow-hidden rounded-xl border border-[#eadfd5]"
                        aria-label="Journey builder steps"
                      >
                        {JOURNEY_BUILDER_STAGES.map((stage) => (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => setJourneyBuilderStage(stage.id)}
                            className={`min-h-14 border-r border-[#eadfd5] px-2 text-xs font-black last:border-r-0 ${journeyBuilderStage === stage.id ? "bg-purple-700 text-white" : "bg-[#fffaf4] text-[#6b5b54]"}`}
                            data-testid={`button-marketing-journey-stage-${stage.id}`}
                          >
                            <span className="block text-[10px] opacity-70">
                              {stage.id}
                            </span>
                            {stage.label}
                          </button>
                        ))}
                      </nav>

                      {journeyBuilderStage === 1 ? (
                        <section
                          className="grid gap-4"
                          data-testid="marketing-journey-stage-who"
                        >
                          <div>
                            <h4 className="text-xl font-black text-[#241133]">
                              Who enters?
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                              Name this journey, then choose the people it is
                              intended for.
                            </p>
                          </div>
                          <Field label="Journey name">
                            <input
                              className={inputClass}
                              value={journeyEditDraft.name}
                              onChange={(event) =>
                                setJourneyEditDraft((draft) => ({
                                  ...draft,
                                  name: event.target.value,
                                }))
                              }
                              placeholder="Caregiver welcome journey"
                              disabled={journeySaving}
                              data-testid="input-marketing-edit-journey-name"
                            />
                          </Field>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {AUDIENCES.map((audience) => (
                              <button
                                key={audience}
                                type="button"
                                onClick={() =>
                                  setJourneyEditDraft((draft) => ({
                                    ...draft,
                                    audienceType: audience,
                                  }))
                                }
                                className={`min-h-20 rounded-xl border p-4 text-left ${journeyEditDraft.audienceType === audience ? "border-purple-500 bg-purple-50 text-purple-900" : "border-[#eadfd5] bg-white"}`}
                                data-testid={`button-marketing-journey-audience-${audience}`}
                              >
                                <span className="font-black">
                                  {audience.toUpperCase()}
                                </span>
                                <span className="mt-1 block text-xs font-semibold opacity-70">
                                  {audience === "b2c"
                                    ? "App users and caregivers"
                                    : audience === "b2b"
                                      ? "Business contacts"
                                      : "Both groups"}
                                </span>
                              </button>
                            ))}
                          </div>
                          <Field label="Contacts">
                            <select
                              className={inputClass}
                              value={journeyEditDraft.targetAudienceId}
                              onChange={(event) =>
                                setJourneyEditDraft((draft) => ({
                                  ...draft,
                                  targetAudienceId: event.target.value,
                                }))
                              }
                              disabled={journeySaving}
                              data-testid="select-marketing-edit-journey-target-audience"
                            >
                              <option value="">All eligible contacts</option>
                              {audiences.map((audience) => (
                                <option key={audience.id} value={audience.id}>
                                  {audience.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <div
                            className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
                            data-testid="marketing-journey-target-audience-summary"
                          >
                            {selectedJourneyTargetAudience
                              ? `About ${estimatedJourneyContacts} eligible contacts in ${selectedJourneyTargetAudience.name}.`
                              : `About ${estimatedJourneyContacts} eligible ${journeyEditDraft.audienceType.toUpperCase()} contacts.`}
                          </div>
                          <Field label="Objective (optional)">
                            <textarea
                              className={textareaClass}
                              value={journeyEditDraft.objective}
                              onChange={(event) =>
                                setJourneyEditDraft((draft) => ({
                                  ...draft,
                                  objective: event.target.value,
                                }))
                              }
                              placeholder="What should this journey help the contact achieve?"
                              disabled={journeySaving}
                              data-testid="textarea-marketing-edit-journey-objective"
                            />
                          </Field>
                        </section>
                      ) : null}

                      {journeyBuilderStage === 2 ? (
                        <section
                          className="grid gap-4"
                          data-testid="marketing-journey-stage-entry"
                        >
                          <div>
                            <h4 className="text-xl font-black text-[#241133]">
                              When do they enter?
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                              Choose one clear starting rule.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {(
                              [
                                {
                                  id: "manual",
                                  title: "Added manually",
                                  copy: "An admin chooses the contacts.",
                                },
                                {
                                  id: "signup",
                                  title: "Creates an account",
                                  copy: "Starts after a new account is created.",
                                },
                                {
                                  id: "list_joined",
                                  title: "Joins a list",
                                  copy: "Starts when a contact joins one list.",
                                },
                                {
                                  id: "date",
                                  title: "Reaches a date",
                                  copy: "Starts on a date you choose.",
                                },
                              ] as const
                            ).map((rule) => (
                              <button
                                key={rule.id}
                                type="button"
                                onClick={() =>
                                  setJourneyEditDraft((draft) =>
                                    withJourneyEntryRule(draft, rule.id),
                                  )
                                }
                                className={`min-h-24 rounded-xl border p-4 text-left ${journeyEntryRule(journeyEditDraft) === rule.id ? "border-purple-500 bg-purple-50" : "border-[#eadfd5] bg-white"}`}
                                data-testid={`button-marketing-journey-entry-${rule.id}`}
                              >
                                <span className="font-black text-[#241133]">
                                  {rule.title}
                                </span>
                                <span className="mt-1 block text-xs font-semibold text-[#7d6b65]">
                                  {rule.copy}
                                </span>
                              </button>
                            ))}
                          </div>
                          {journeyEntryRule(journeyEditDraft) ===
                          "list_joined" ? (
                            <Field label="Which list?">
                              <select
                                className={inputClass}
                                value={journeyEditDraft.targetAudienceId}
                                onChange={(event) =>
                                  setJourneyEditDraft((draft) => ({
                                    ...draft,
                                    targetAudienceId: event.target.value,
                                  }))
                                }
                                data-testid="select-marketing-journey-entry-list"
                              >
                                <option value="">Choose a list</option>
                                {audiences.map((audience) => (
                                  <option key={audience.id} value={audience.id}>
                                    {audience.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          ) : null}
                          {journeyEntryRule(journeyEditDraft) === "date" ? (
                            <Field label="Start date">
                              <input
                                type="date"
                                className={inputClass}
                                value={journeyEntryDate(journeyEditDraft)}
                                onChange={(event) =>
                                  setJourneyEditDraft((draft) =>
                                    withJourneyEntryDate(
                                      draft,
                                      event.target.value,
                                    ),
                                  )
                                }
                                data-testid="input-marketing-journey-entry-date"
                              />
                            </Field>
                          ) : null}
                        </section>
                      ) : null}

                      {journeyBuilderStage === 3 ? (
                        <section
                          className="grid gap-4"
                          data-testid="marketing-journey-stage-actions"
                        >
                          <div>
                            <h4 className="text-xl font-black text-[#241133]">
                              What happens?
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                              Build the sequence contacts should follow. This
                              remains a preview plan.
                            </p>
                          </div>
                          <div
                            className="grid gap-3"
                            data-testid="marketing-journey-steps-builder"
                          >
                            {journeyEditDraft.steps.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[#d9c8e8] bg-purple-50 p-6 text-center">
                                <Waypoints
                                  className="mx-auto text-purple-700"
                                  size={26}
                                />
                                <p className="mt-2 font-black">
                                  No actions yet
                                </p>
                                <p className="mt-1 text-xs font-semibold text-[#7d6b65]">
                                  Add a message or a wait to begin.
                                </p>
                              </div>
                            ) : null}
                            {journeyEditDraft.steps.map((step, index) => {
                              const kind = journeyStepKind(step);
                              const contentOptions = content.filter(
                                (item) =>
                                  item.channel === step.channel &&
                                  item.status !== "archived",
                              );
                              const selectedContentOption =
                                contentAssetByReference(
                                  content,
                                  step.contentAssetId,
                                ) ??
                                contentAssetByReference(
                                  content,
                                  step.templateRef,
                                );
                              const unit = waitUnitForStep(step);
                              return (
                                <article
                                  key={step.id}
                                  className="relative ml-5 grid gap-3 rounded-xl border border-[#eadfd5] bg-white p-4 pl-5 before:absolute before:-left-5 before:top-6 before:h-3 before:w-3 before:rounded-full before:bg-purple-600"
                                  data-testid={`marketing-journey-step-${index}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      {kind === "wait" ? (
                                        <Timer
                                          size={17}
                                          className="text-purple-700"
                                        />
                                      ) : (
                                        <MessageSquare
                                          size={17}
                                          className="text-purple-700"
                                        />
                                      )}
                                      <p className="font-black">
                                        {index + 1}.{" "}
                                        {kind === "wait"
                                          ? "Wait"
                                          : "Send a message"}
                                      </p>
                                      {kind === "message" &&
                                      step.channel !== "email" ? (
                                        <Pill className="bg-amber-50 text-amber-800">
                                          Planning only
                                        </Pill>
                                      ) : null}
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        title="Move up"
                                        onClick={() =>
                                          moveJourneyStep(step.id, -1)
                                        }
                                        disabled={index === 0}
                                      >
                                        <ArrowUp size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Move down"
                                        onClick={() =>
                                          moveJourneyStep(step.id, 1)
                                        }
                                        disabled={
                                          index ===
                                          journeyEditDraft.steps.length - 1
                                        }
                                      >
                                        <ArrowDown size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Duplicate"
                                        onClick={() =>
                                          duplicateJourneyStep(step.id)
                                        }
                                      >
                                        <Copy size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Remove"
                                        onClick={() =>
                                          removeJourneyStep(step.id)
                                        }
                                        className="text-red-700"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </div>
                                  {kind === "wait" ? (
                                    <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                                      <Field label="How long?">
                                        <input
                                          type="number"
                                          min="1"
                                          className={inputClass}
                                          value={waitValueForStep(step)}
                                          onChange={(event) =>
                                            updateJourneyStep(
                                              step.id,
                                              withWaitValue(
                                                step,
                                                event.target.value,
                                                unit,
                                              ),
                                            )
                                          }
                                          data-testid={`input-marketing-journey-step-delay-${index}`}
                                        />
                                      </Field>
                                      <Field label="Unit">
                                        <select
                                          className={inputClass}
                                          value={unit}
                                          onChange={(event) =>
                                            updateJourneyStep(
                                              step.id,
                                              withWaitValue(
                                                step,
                                                waitValueForStep(step),
                                                event.target.value as WaitUnit,
                                              ),
                                            )
                                          }
                                          data-testid={`select-marketing-journey-step-wait-unit-${index}`}
                                        >
                                          <option value="hours">Hours</option>
                                          <option value="days">Days</option>
                                          <option value="weeks">Weeks</option>
                                        </select>
                                      </Field>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                                        <Field label="Channel">
                                          <select
                                            className={inputClass}
                                            value={step.channel}
                                            onChange={(event) =>
                                              updateJourneyStep(step.id, {
                                                channel: event.target
                                                  .value as Channel,
                                                contentAssetId: "",
                                              })
                                            }
                                            data-testid={`select-marketing-journey-step-channel-${index}`}
                                          >
                                            {CHANNELS.map((channel) => (
                                              <option
                                                key={channel}
                                                value={channel}
                                              >
                                                {channelLabel[channel]}
                                              </option>
                                            ))}
                                          </select>
                                        </Field>
                                        <Field label="Message">
                                          <select
                                            className={inputClass}
                                            value={step.contentAssetId}
                                            onChange={(event) =>
                                              updateJourneyStep(step.id, {
                                                contentAssetId:
                                                  event.target.value,
                                              })
                                            }
                                            data-testid={`select-marketing-journey-step-content-${index}`}
                                          >
                                            <option value="">
                                              Choose library content
                                            </option>
                                            {contentOptions.map((item) => (
                                              <option
                                                key={item.id}
                                                value={item.id}
                                              >
                                                {item.title}
                                              </option>
                                            ))}
                                          </select>
                                        </Field>
                                      </div>
                                      {selectedContentOption ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            previewContent(
                                              selectedContentOption,
                                            )
                                          }
                                          className="inline-flex w-fit items-center gap-1 text-xs font-black text-purple-700"
                                          data-testid={`button-marketing-preview-journey-step-content-${step.id}`}
                                        >
                                          <Eye size={13} /> Preview message
                                        </button>
                                      ) : null}
                                    </>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => addJourneyStep("message")}
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white"
                              data-testid="button-marketing-add-journey-step"
                            >
                              <MessageSquare size={15} /> Send a message
                            </button>
                            <button
                              type="button"
                              onClick={() => addJourneyStep("wait")}
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 text-sm font-black text-purple-700"
                              data-testid="button-marketing-add-journey-wait"
                            >
                              <Timer size={15} /> Wait
                            </button>
                          </div>
                        </section>
                      ) : null}

                      {journeyBuilderStage === 4 ? (
                        <section
                          className="grid gap-4"
                          data-testid="marketing-journey-stage-stop"
                        >
                          <div>
                            <h4 className="text-xl font-black text-[#241133]">
                              When should it stop?
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                              Choose the first condition that ends the planned
                              journey.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {(
                              [
                                {
                                  id: "final_step",
                                  title: "After the final step",
                                },
                                {
                                  id: "reply",
                                  title: "When the contact replies",
                                },
                                {
                                  id: "click",
                                  title: "When the contact clicks",
                                },
                                {
                                  id: "activation",
                                  title:
                                    "When the contact completes the objective",
                                },
                              ] as const
                            ).map((rule) => (
                              <button
                                key={rule.id}
                                type="button"
                                onClick={() =>
                                  setJourneyEditDraft((draft) =>
                                    withJourneyStopRule(draft, rule.id),
                                  )
                                }
                                className={`min-h-20 rounded-xl border p-4 text-left font-black ${journeyStopRule(journeyEditDraft) === rule.id ? "border-purple-500 bg-purple-50" : "border-[#eadfd5] bg-white"}`}
                                data-testid={`button-marketing-journey-stop-${rule.id}`}
                              >
                                {rule.title}
                              </button>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {journeyBuilderStage === 5 ? (
                        <section
                          className="grid gap-4"
                          data-testid="marketing-journey-stage-review"
                        >
                          <div>
                            <h4 className="text-xl font-black text-[#241133]">
                              Review and save
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                              Check the plan. Saving does not start automation
                              or send messages.
                            </p>
                          </div>
                          <div className="grid gap-3 rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                            <div>
                              <p className="text-xs font-black uppercase text-[#8b7a73]">
                                Journey
                              </p>
                              <p className="font-black">
                                {journeyEditDraft.name || "Unnamed journey"}
                              </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-xs font-black uppercase text-[#8b7a73]">
                                  Who
                                </p>
                                <p className="font-bold">
                                  {selectedJourneyTargetAudience?.name ??
                                    `All eligible ${journeyEditDraft.audienceType.toUpperCase()} contacts`}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-black uppercase text-[#8b7a73]">
                                  Entry
                                </p>
                                <p className="font-bold">
                                  {journeyEntryLabel(
                                    journeyEditDraft,
                                    selectedJourneyTargetAudience,
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-black uppercase text-[#8b7a73]">
                                  Actions
                                </p>
                                <p className="font-bold">
                                  {journeyEditDraft.steps.length} planned step
                                  {journeyEditDraft.steps.length === 1
                                    ? ""
                                    : "s"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-black uppercase text-[#8b7a73]">
                                  Stops
                                </p>
                                <p className="font-bold">
                                  {journeyStopLabel(journeyEditDraft)}
                                </p>
                              </div>
                            </div>
                          </div>
                          {editingJourney?.status === "active" ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
                              Running. Enrolled contacts receive email steps automatically after each wait.
                            </div>
                          ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                              Planning only while this is a draft. Nothing sends until you explicitly start the journey.
                            </div>
                          )}
                          {editingJourney?.lovableExternalId ? (
                            <details className="rounded-xl border border-[#eadfd5] bg-white px-4 py-3 text-sm">
                              <summary className="cursor-pointer font-black text-purple-700">
                                Import details
                              </summary>
                              <p className="mt-3 text-[#6b5b54]">
                                Imported from{" "}
                                {editingJourney.source || "Lovable"}. Its source
                                identifiers and unsupported configuration remain
                                preserved when you save.
                              </p>
                            </details>
                          ) : null}
                        </section>
                      ) : null}

                      {journeyFeedback ? (
                        <p
                          className={`rounded-xl px-4 py-3 text-sm font-bold ${journeyFeedbackIsError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                          data-testid="marketing-journey-feedback"
                          role="status"
                        >
                          {journeyFeedback}
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 border-t border-[#eadfd5] pt-4">
                        <button
                          type="button"
                          onClick={cancelJourneyEdit}
                          disabled={journeySaving || journeyActivating}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black"
                          data-testid="button-marketing-cancel-journey"
                        >
                          <X size={15} /> Close
                        </button>
                        <div className="flex gap-2">
                          {journeyBuilderStage > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setJourneyBuilderStage(
                                  (stage) =>
                                    Math.max(
                                      1,
                                      stage - 1,
                                    ) as JourneyBuilderStage,
                                )
                              }
                              className="min-h-10 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black"
                            >
                              Back
                            </button>
                          ) : null}
                          {journeyBuilderStage < 5 ? (
                            <button
                              type="button"
                              onClick={advanceJourneyStage}
                              className="min-h-10 rounded-xl bg-purple-700 px-4 text-sm font-black text-white"
                            >
                              Continue
                            </button>
                          ) : (
                            <>
                              <button
                                type="submit"
                                disabled={journeySaving || journeyActivating}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 text-sm font-black text-purple-700 disabled:text-[#b8abb8]"
                                data-testid="button-marketing-save-journey"
                              >
                                <Save size={15} />{" "}
                                {journeySaving ? "Saving..." : "Save draft"}
                              </button>
                              {editingJourneyId !== "new" && editingJourney?.status !== "active" ? (
                                <button
                                  type="button"
                                  onClick={activateJourney}
                                  disabled={journeySaving || journeyActivating}
                                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:bg-[#b8abb8]"
                                  data-testid="button-marketing-start-journey"
                                >
                                  <Send size={15} /> {journeyActivating ? "Starting..." : "Start journey"}
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </form>
                  ) : null}
                </div>
              </SectionCard>
              {!editingJourneyId ? (
                <SectionCard
                  title="Journey progress"
                  subtitle={`${visibleJourneyEnrollments.length} visible of ${journeyEnrollments.length} imported enrollment records and event history rows.`}
                >
                {visibleJourneyEnrollments.length === 0 ? (
                  <EmptyState
                    text={
                      journeyEnrollments.length
                        ? "No journey enrollments match the current filters."
                        : "No journey enrollments imported yet."
                    }
                  />
                ) : (
                  <div
                    className="grid gap-3"
                    data-testid="marketing-journey-enrollments"
                  >
                    {visibleJourneyEnrollments.map((enrollment) => {
                      const contact =
                        contactByJourneyEnrollmentId.get(enrollment.id) ?? null;
                      const contactSummary = contact
                        ? [
                            contact.email,
                            contact.phoneNumber,
                            contact.whatsappNumber,
                            contact.companyName,
                          ]
                            .filter(Boolean)
                            .join(" - ")
                        : "";
                      return (
                        <article
                          key={enrollment.id}
                          className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-black">
                                {enrollment.journeyName || enrollment.journeyId}
                              </p>
                              {contact ? (
                                <div
                                  className="mt-1 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"
                                  data-testid={`marketing-journey-enrollment-contact-${enrollment.id}`}
                                >
                                  <p className="text-sm font-black">
                                    {contact.fullName ||
                                      contact.email ||
                                      contact.phoneNumber ||
                                      "Unnamed contact"}
                                  </p>
                                  {contactSummary ? (
                                    <p className="mt-0.5 text-emerald-800">
                                      {contactSummary}
                                    </p>
                                  ) : null}
                                  <p className="mt-0.5 break-all text-emerald-700">
                                    Linked from{" "}
                                    {enrollment.contactExternalId ||
                                      enrollment.contactId}
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-1 text-xs font-bold text-[#7d6b65]">
                                  {enrollment.contactExternalId ||
                                    enrollment.contactId ||
                                    "No contact linked"}
                                </p>
                              )}
                              <p className="mt-1 text-xs font-bold text-[#8b7a73]">
                                Entered {formatDate(enrollment.enteredAt)} ·
                                Last activity{" "}
                                {formatDate(enrollment.lastActivityAt)}
                                {enrollment.exitedAt
                                  ? ` · Exited ${formatDate(enrollment.exitedAt)}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Pill className={statusClass(enrollment.status)}>
                                {enrollment.status}
                              </Pill>
                              <Pill className="bg-blue-50 text-blue-800">
                                Step {enrollment.currentStepOrder}
                              </Pill>
                              <Pill className="bg-violet-50 text-violet-700">
                                {enrollment.source}
                              </Pill>
                            </div>
                          </div>
                          {enrollment.lovableExternalId ? (
                            <p className="mt-2 break-all text-xs font-bold text-[#8b7a73]">
                              Lovable enrollment ID:{" "}
                              {enrollment.lovableExternalId}
                            </p>
                          ) : null}
                          <MetadataPanel
                            title="Imported enrollment metadata"
                            value={enrollment.metadata}
                            testId={`marketing-journey-enrollment-metadata-${enrollment.id}`}
                          />
                          {enrollment.events.length ? (
                            <div className="mt-3 grid gap-2">
                              {enrollment.events.map((event) => (
                                <div
                                  key={event.id}
                                  className="rounded-lg border border-[#eadfd5] bg-white p-2"
                                  data-testid={`marketing-journey-event-${event.id}`}
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Pill className="bg-white text-[#5b4a46]">
                                      {event.eventType}
                                    </Pill>
                                    <Pill className="bg-blue-50 text-blue-800">
                                      Step {event.stepOrder}
                                    </Pill>
                                    {event.channel ? (
                                      <Pill
                                        className={channelClass(
                                          event.channel as Channel,
                                        )}
                                      >
                                        {event.channel}
                                      </Pill>
                                    ) : null}
                                    <span className="text-xs font-bold text-[#8b7a73]">
                                      {formatDate(event.eventAt)}
                                    </span>
                                  </div>
                                  <MetadataPanel
                                    title="Imported event metadata"
                                    value={event.metadata}
                                    testId={`marketing-journey-event-metadata-${event.id}`}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs font-bold text-[#8b7a73]">
                              No event history for this enrollment.
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
                </SectionCard>
              ) : null}
            </div>
          )}

          {activeTab === "content" && (
            <div className="grid gap-4" data-testid="marketing-content-tab">
              <SectionCard
                title="Content draft"
                subtitle="Create reusable campaign copy, templates, social posts, CTAs, HTML, and media references."
                className="order-2"
              >
                <form
                  className="grid gap-3"
                  onSubmit={(event) =>
                    createContent(event).catch((error) =>
                      setMessage(error.message),
                    )
                  }
                  data-testid="marketing-content-draft-form"
                >
                  <div className="grid gap-3 xl:grid-cols-[1fr_170px_140px_120px]">
                    <Field label="Title">
                      <input
                        className={inputClass}
                        value={contentDraft.title}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Caregiver invite follow-up"
                        disabled={contentSaving}
                        data-testid="input-marketing-content-title"
                      />
                    </Field>
                    <Field label="Channel">
                      <select
                        className={inputClass}
                        value={contentDraft.channel}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            channel: event.target.value as Channel,
                          }))
                        }
                        disabled={contentSaving}
                        data-testid="select-marketing-content-channel"
                      >
                        {CHANNELS.map((channel) => (
                          <option key={channel} value={channel}>
                            {channelLabel[channel]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        className={inputClass}
                        value={contentDraft.status}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            status: event.target.value as ContentStatus,
                          }))
                        }
                        disabled={contentSaving}
                        data-testid="select-marketing-content-status"
                      >
                        {CONTENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Language">
                      <input
                        className={inputClass}
                        value={contentDraft.language}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            language: event.target.value,
                          }))
                        }
                        placeholder="en"
                        disabled={contentSaving}
                        data-testid="input-marketing-content-language"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[1fr_220px_1fr]">
                    <Field label="Subject">
                      <input
                        className={inputClass}
                        value={contentDraft.subject}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            subject: event.target.value,
                          }))
                        }
                        placeholder="Optional subject"
                        disabled={contentSaving}
                        data-testid="input-marketing-content-subject"
                      />
                    </Field>
                    <Field label="CTA label">
                      <input
                        className={inputClass}
                        value={contentDraft.ctaLabel}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            ctaLabel: event.target.value,
                          }))
                        }
                        placeholder="Read more"
                        disabled={contentSaving}
                        data-testid="input-marketing-content-cta-label"
                      />
                    </Field>
                    <Field label="CTA URL">
                      <input
                        className={inputClass}
                        value={contentDraft.ctaUrl}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            ctaUrl: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                        disabled={contentSaving}
                        data-testid="input-marketing-content-cta-url"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <Field label="Plain copy">
                      <textarea
                        className={textareaClass}
                        value={contentDraft.body}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            body: event.target.value,
                          }))
                        }
                        placeholder="Campaign copy"
                        disabled={contentSaving}
                        data-testid="textarea-marketing-content-body"
                      />
                    </Field>
                    <Field label="HTML body">
                      <textarea
                        className={`${textareaClass} font-mono text-xs`}
                        value={contentDraft.htmlBody}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            htmlBody: event.target.value,
                          }))
                        }
                        placeholder="<p>Optional HTML</p>"
                        disabled={contentSaving}
                        data-testid="textarea-marketing-content-html"
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <Field label="Design JSON">
                      <textarea
                        className={`${textareaClass} font-mono text-xs`}
                        value={contentDraft.designJsonText}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            designJsonText: event.target.value,
                          }))
                        }
                        placeholder="{ }"
                        disabled={contentSaving}
                        data-testid="textarea-marketing-content-design-json"
                      />
                    </Field>
                    <Field label="Media assets JSON">
                      <textarea
                        className={`${textareaClass} font-mono text-xs`}
                        value={contentDraft.mediaAssetsText}
                        onChange={(event) =>
                          setContentDraft((draft) => ({
                            ...draft,
                            mediaAssetsText: event.target.value,
                          }))
                        }
                        placeholder="[]"
                        disabled={contentSaving}
                        data-testid="textarea-marketing-content-media-assets"
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                      type="submit"
                      disabled={contentSaving}
                      data-testid="button-marketing-add-content"
                    >
                      <FileText size={16} />{" "}
                      {contentSaving ? "Saving..." : "Add content"}
                    </button>
                  </div>
                </form>
                {contentFeedback && !contentEditDraft ? (
                  <p
                    className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${contentFeedback.includes("failed") || contentFeedback.includes("required") || contentFeedback.includes("valid JSON") || contentFeedback.includes("could not") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                    data-testid="marketing-content-feedback"
                  >
                    {contentFeedback}
                  </p>
                ) : null}
              </SectionCard>
              <SectionCard
                title="Content library"
                subtitle={
                  visibleContent.length
                    ? `${contentPageStart}-${contentPageEnd} of ${visibleContent.length} shown.`
                    : `0 of ${content.length} shown.`
                }
                className="order-1"
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-3 text-sm font-black text-purple-700 hover:bg-purple-50"
                      onClick={() => setBulkTranslateOpen((open) => !open)}
                      aria-expanded={bulkTranslateOpen}
                      data-testid="button-marketing-open-bulk-translate"
                    >
                      <Languages size={15} /> Bulk translate
                    </button>
                    <select
                      className={`${inputClass} w-[240px]`}
                      value={contentSourceFilter}
                      onChange={(event) =>
                        setContentSourceFilter(event.target.value)
                      }
                      aria-label="Content type filter"
                      data-testid="select-marketing-content-source-filter"
                    >
                      <option value="all">
                        All content types ({content.length})
                      </option>
                      {contentSourceOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label} ({option.count})
                        </option>
                      ))}
                    </select>
                  </div>
                }
              >
                <div className="grid gap-3">
                  {bulkTranslateOpen ? (
                    <div
                      className="grid gap-4 rounded-xl border border-purple-200 bg-purple-50/60 p-4"
                      data-testid="marketing-bulk-translate-panel"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-black text-[#241133]">
                            Bulk translate
                          </h4>
                          <p className="mt-1 text-sm font-bold text-[#7d6b65]">
                            Pick source content, choose target languages,
                            preview, then save as VYVA drafts.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#2f2135]"
                          onClick={() => setBulkTranslateOpen(false)}
                        >
                          Close
                        </button>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
                        <div className="rounded-xl border border-[#eadfd5] bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                              Source content
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-black text-purple-700"
                                onClick={() => {
                                  setBulkTranslateSourceIds(
                                    visibleContent
                                      .slice(0, 25)
                                      .map((item) => item.id),
                                  );
                                  setBulkTranslateFeedback("");
                                }}
                              >
                                Select visible
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-[#eadfd5] bg-white px-2 py-1 text-xs font-black text-[#5b4a46]"
                                onClick={() => {
                                  setBulkTranslateSourceIds([]);
                                  setBulkTranslatePreview([]);
                                  setBulkTranslateFeedback("");
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 grid max-h-[280px] gap-2 overflow-y-auto pr-1">
                            {visibleContent.slice(0, 50).map((item) => (
                              <label
                                key={item.id}
                                className="flex items-start gap-3 rounded-lg border border-[#f0e7df] bg-[#fffaf4] px-3 py-2 text-sm font-bold"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 accent-purple-700"
                                  checked={bulkTranslateSourceIds.includes(
                                    item.id,
                                  )}
                                  onChange={() =>
                                    toggleBulkTranslateSource(item.id)
                                  }
                                  disabled={bulkTranslateRunning}
                                  data-testid={`checkbox-marketing-bulk-translate-source-${item.id}`}
                                />
                                <span>
                                  <span className="block font-black text-[#241133]">
                                    {item.title}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-[#7d6b65]">
                                    {channelLabel[item.channel]} -{" "}
                                    {item.language} - {item.status}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="grid content-start gap-3 rounded-xl border border-[#eadfd5] bg-white p-3">
                          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                            Target languages
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {BULK_TRANSLATE_LANGUAGES.map((language) => {
                              const selected = bulkTranslateLanguages.includes(
                                language.code,
                              );
                              return (
                                <button
                                  key={language.code}
                                  type="button"
                                  className={`rounded-full border px-3 py-2 text-xs font-black ${selected ? "border-purple-300 bg-purple-700 text-white" : "border-[#eadfd5] bg-white text-[#2f2135]"}`}
                                  onClick={() =>
                                    toggleBulkTranslateLanguage(language.code)
                                  }
                                  disabled={bulkTranslateRunning}
                                  aria-pressed={selected}
                                  data-testid={`button-marketing-bulk-translate-language-${language.code}`}
                                >
                                  {language.label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="grid gap-2 pt-1">
                            <button
                              type="button"
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-4 text-sm font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                              onClick={() => void runBulkTranslate("preview")}
                              disabled={bulkTranslateRunning}
                              data-testid="button-marketing-preview-bulk-translate"
                            >
                              <Eye size={15} />{" "}
                              {bulkTranslateRunning
                                ? "Working..."
                                : "Preview translations"}
                            </button>
                            <button
                              type="button"
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                              onClick={() => void runBulkTranslate("save")}
                              disabled={bulkTranslateRunning}
                              data-testid="button-marketing-save-bulk-translate"
                            >
                              <Save size={15} /> Save as drafts
                            </button>
                          </div>
                        </div>
                      </div>

                      {bulkTranslateFeedback ? (
                        <p
                          className={`rounded-xl px-4 py-3 text-sm font-bold ${/fail|required|select|could not/i.test(bulkTranslateFeedback) ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                          role="status"
                          data-testid="marketing-bulk-translate-feedback"
                        >
                          {bulkTranslateFeedback}
                        </p>
                      ) : null}

                      {bulkTranslatePreview.length ? (
                        <div
                          className="grid gap-2"
                          data-testid="marketing-bulk-translate-preview"
                        >
                          {bulkTranslatePreview.slice(0, 12).map((item) => (
                            <article
                              key={`${item.sourceContentId}-${item.targetLanguage}`}
                              className="rounded-xl border border-[#eadfd5] bg-white p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-black text-[#241133]">
                                    {item.draft.title}
                                  </p>
                                  <p className="mt-1 text-xs font-bold text-[#7d6b65]">
                                    From {item.sourceTitle} to{" "}
                                    {item.targetLanguage.toUpperCase()}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <Pill
                                    className={channelClass(item.draft.channel)}
                                  >
                                    {channelLabel[item.draft.channel]}
                                  </Pill>
                                  <Pill className="bg-purple-50 text-purple-800">
                                    {item.draft.language}
                                  </Pill>
                                  {item.exists ? (
                                    <Pill className="bg-yellow-50 text-yellow-800">
                                      updates existing
                                    </Pill>
                                  ) : (
                                    <Pill className="bg-emerald-50 text-emerald-800">
                                      new draft
                                    </Pill>
                                  )}
                                </div>
                              </div>
                              <p className="mt-2 line-clamp-2 text-sm font-bold text-[#5b4a46]">
                                {item.draft.subject ||
                                  item.draft.body ||
                                  "No copy returned."}
                              </p>
                              {item.note ? (
                                <p className="mt-2 text-xs font-bold text-yellow-800">
                                  {item.note}
                                </p>
                              ) : null}
                            </article>
                          ))}
                          {bulkTranslatePreview.length > 12 ? (
                            <p className="text-xs font-bold text-[#7d6b65]">
                              Showing first 12 of {bulkTranslatePreview.length}{" "}
                              preview translations.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {contentActionFeedback ? (
                    <p
                      className={`rounded-xl px-4 py-3 text-sm font-bold ${contentActionFeedback.includes("failed") || contentActionFeedback.includes("required") || contentActionFeedback.includes("valid JSON") || contentActionFeedback.includes("could not") ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}
                      role="status"
                      aria-live="polite"
                      data-testid="marketing-content-action-feedback"
                    >
                      {contentActionFeedback}
                    </p>
                  ) : null}
                  {visibleContent.length === 0 ? (
                    <div
                      className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-4"
                      data-testid="marketing-content-empty-diagnostic"
                    >
                      <p className="text-center text-sm font-black text-[#241133]">
                        {contentEmptyDiagnostic?.title ??
                          "No content matches the filters."}
                      </p>
                      <p className="mx-auto mt-2 max-w-3xl text-center text-sm font-bold text-[#8b7a73]">
                        {contentEmptyDiagnostic?.detail ??
                          "Clear filters or run Lovable sync from Settings."}
                      </p>
                      {contentEmptyDiagnostic ? (
                        <div className="mt-3 flex justify-center">
                          {contentEmptyDiagnostic.action === "clear_filters" ? (
                            <button
                              type="button"
                              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-700"
                              onClick={() => {
                                setSearch("");
                                setChannelFilter("all");
                                setContentSourceFilter("all");
                              }}
                              data-testid="button-marketing-clear-content-filters"
                            >
                              Clear content filters
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex min-h-9 items-center justify-center rounded-xl bg-purple-700 px-3 text-xs font-black text-white"
                              onClick={() => openMarketingTab("settings")}
                              data-testid="button-marketing-open-sync-settings"
                            >
                              Open sync settings
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className="grid gap-2"
                      data-testid="marketing-content-library-table"
                    >
                      <span className="sr-only">
                        Content Type Channel Language Status Design/media CTA
                        Actions
                      </span>
                      <div className="grid gap-2">
                        {pagedContent.map((item) => {
                          const isPreviewingContent =
                            item.id === selectedContentId &&
                            contentDrawerMode === "preview";
                          const isEditingContent =
                            item.id === editingContentId &&
                            contentDrawerMode === "edit";
                          const isConfirmingDelete =
                            confirmingContentDeleteId === item.id;
                          return (
                            <article
                              id={`marketing-content-row-${item.id}`}
                              key={item.id}
                              className={`rounded-xl border p-3 transition ${item.id === selectedContent?.id ? "border-purple-200 bg-purple-50/70" : "border-[#eadfd5] bg-white hover:border-purple-200"}`}
                              data-testid={`marketing-content-row-${item.id}`}
                            >
                              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                                <div className="min-w-0">
                                  <p className="line-clamp-1 font-black text-[#241133]">
                                    {item.title}
                                  </p>
                                  <p className="mt-1 line-clamp-2 max-w-3xl text-xs font-semibold leading-relaxed text-[#7d6b65]">
                                    {item.subject ||
                                      item.body ||
                                      "No copy yet."}
                                  </p>
                                  {item.ctaLabel || item.ctaUrl ? (
                                    <p className="mt-1 line-clamp-1 text-xs font-bold text-[#5b4a46]">
                                      {[item.ctaLabel, item.ctaUrl]
                                        .filter(Boolean)
                                        .join(" -> ")}
                                    </p>
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <Pill
                                      className={
                                        item.source === "lovable"
                                          ? "bg-violet-50 text-violet-700"
                                          : "bg-[#f5eee8] text-[#5b4a46]"
                                      }
                                    >
                                      {contentOriginLabel(item)}
                                    </Pill>
                                    <Pill
                                      className={channelClass(item.channel)}
                                    >
                                      {channelLabel[item.channel]}
                                    </Pill>
                                    <Pill className="bg-[#f5eee8] text-[#5b4a46]">
                                      {item.language}
                                    </Pill>
                                    <Pill className={statusClass(item.status)}>
                                      {item.status}
                                    </Pill>
                                    {item.hasHtml ? (
                                      <Pill className="bg-blue-50 text-blue-800">
                                        HTML
                                      </Pill>
                                    ) : null}
                                    {item.hasDesign ? (
                                      <Pill className="bg-purple-50 text-purple-800">
                                        Design
                                      </Pill>
                                    ) : null}
                                    {item.mediaAssetCount ? (
                                      <Pill className="bg-emerald-50 text-emerald-800">
                                        {item.mediaAssetCount} media
                                      </Pill>
                                    ) : null}
                                    {!item.hasHtml &&
                                    !item.hasDesign &&
                                    !item.mediaAssetCount ? (
                                      <Pill className="bg-[#f5eee8] text-[#7d6b65]">
                                        Plain copy
                                      </Pill>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 xl:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => previewContent(item)}
                                    aria-expanded={isPreviewingContent}
                                    className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] disabled:text-[#9d8b9d] ${isPreviewingContent ? "border-purple-300 bg-purple-700 text-white" : "border-[#eadfd5] bg-white text-purple-700"}`}
                                    disabled={contentSaving}
                                    data-testid={`button-marketing-preview-content-${item.id}`}
                                  >
                                    <Eye size={13} />{" "}
                                    {isPreviewingContent
                                      ? "Previewing"
                                      : "Preview"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startContentEdit(item)}
                                    aria-expanded={isEditingContent}
                                    className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${isEditingContent ? "border-purple-300 bg-purple-700 text-white" : "border-[#eadfd5] bg-white text-purple-700"}`}
                                    disabled={contentSaving}
                                    data-testid={`button-marketing-edit-content-${item.id}`}
                                  >
                                    <Pencil size={13} />{" "}
                                    {isEditingContent ? "Editing" : "Edit"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deleteContent(item)}
                                    aria-expanded={isConfirmingDelete}
                                    className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${isConfirmingDelete ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                                    disabled={contentSaving}
                                    data-testid={`button-marketing-delete-content-${item.id}`}
                                  >
                                    <Trash2 size={13} />{" "}
                                    {isConfirmingDelete
                                      ? "Confirm delete"
                                      : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      {visibleContent.length > CONTENT_PAGE_SIZE ? (
                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#241133] disabled:cursor-not-allowed disabled:text-[#b8abb8]"
                            onClick={() =>
                              setContentPage((page) => Math.max(1, page - 1))
                            }
                            disabled={contentPage === 1}
                            data-testid="button-marketing-content-page-prev"
                          >
                            Previous
                          </button>
                          <span className="text-xs font-black text-[#5b4a46]">
                            Page {contentPage} / {contentPageCount}
                          </span>
                          <button
                            type="button"
                            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#241133] disabled:cursor-not-allowed disabled:text-[#b8abb8]"
                            onClick={() =>
                              setContentPage((page) =>
                                Math.min(contentPageCount, page + 1),
                              )
                            }
                            disabled={contentPage === contentPageCount}
                            data-testid="button-marketing-content-page-next"
                          >
                            Next
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </SectionCard>
              {contentDrawerMode === "edit" ? (
                <FloatingPanelPortal>
                  <div
                    ref={contentEditorPanelRef}
                    data-testid="marketing-content-editor-panel"
                    role="dialog"
                    aria-modal={true}
                    tabIndex={-1}
                    className={floatingContentPanelClass}
                  >
                    <SectionCard
                      title="Content editor"
                      subtitle={
                        editingContent
                          ? `Editing ${editingContent.title}`
                          : "Select a content asset to edit imported or local copy."
                      }
                      action={
                        contentDrawerMode === "edit" ? (
                          <button
                            type="button"
                            onClick={closeContentDrawer}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#241133]"
                            data-testid="button-marketing-close-content-drawer"
                          >
                            <X size={14} /> Close
                          </button>
                        ) : null
                      }
                    >
                      {contentEditDraft ? (
                        <form
                          className="grid gap-4"
                          onSubmit={(event) => void saveContentEdit(event)}
                          data-testid="marketing-content-editor-form"
                        >
                          <div className="grid gap-3 xl:grid-cols-[1.4fr_160px_160px_120px]">
                            <Field label="Title">
                              <input
                                className={inputClass}
                                value={contentEditDraft.title}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? { ...draft, title: event.target.value }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="input-marketing-edit-content-title"
                              />
                            </Field>
                            <Field label="Channel">
                              <select
                                className={inputClass}
                                value={contentEditDraft.channel}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          channel: event.target
                                            .value as Channel,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="select-marketing-edit-content-channel"
                              >
                                {CHANNELS.map((channel) => (
                                  <option key={channel} value={channel}>
                                    {channelLabel[channel]}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Status">
                              <select
                                className={inputClass}
                                value={contentEditDraft.status}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          status: event.target
                                            .value as ContentStatus,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="select-marketing-edit-content-status"
                              >
                                {CONTENT_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Language">
                              <input
                                className={inputClass}
                                value={contentEditDraft.language}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          language: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="input-marketing-edit-content-language"
                              />
                            </Field>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-[1fr_240px_1fr]">
                            <Field label="Subject">
                              <input
                                className={inputClass}
                                value={contentEditDraft.subject}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          subject: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="input-marketing-edit-content-subject"
                              />
                            </Field>
                            <Field label="CTA label">
                              <input
                                className={inputClass}
                                value={contentEditDraft.ctaLabel}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          ctaLabel: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="input-marketing-edit-content-cta-label"
                              />
                            </Field>
                            <Field label="CTA URL">
                              <input
                                className={inputClass}
                                value={contentEditDraft.ctaUrl}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? { ...draft, ctaUrl: event.target.value }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="input-marketing-edit-content-cta-url"
                              />
                            </Field>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-2">
                            <Field label="Source">
                              <input
                                className={inputClass}
                                value={contentEditDraft.source}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? { ...draft, source: event.target.value }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="input-marketing-edit-content-source"
                              />
                            </Field>
                            <Field label="Lovable ID">
                              <input
                                className={inputClass}
                                value={contentEditDraft.lovableExternalId}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          lovableExternalId: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contentSaving}
                                data-testid="input-marketing-edit-content-lovable-id"
                              />
                            </Field>
                          </div>
                          <Field label="Plain copy">
                            <textarea
                              className={textareaClass}
                              value={contentEditDraft.body}
                              onChange={(event) =>
                                setContentEditDraft((draft) =>
                                  draft
                                    ? { ...draft, body: event.target.value }
                                    : draft,
                                )
                              }
                              disabled={contentSaving}
                              data-testid="textarea-marketing-edit-content-body"
                            />
                          </Field>
                          <Field label="HTML body">
                            <textarea
                              className={`${textareaClass} min-h-[140px] font-mono text-xs`}
                              value={contentEditDraft.htmlBody}
                              onChange={(event) =>
                                setContentEditDraft((draft) =>
                                  draft
                                    ? { ...draft, htmlBody: event.target.value }
                                    : draft,
                                )
                              }
                              disabled={contentSaving}
                              data-testid="textarea-marketing-edit-content-html"
                            />
                          </Field>
                          <div className="grid gap-3 xl:grid-cols-2">
                            <Field label="Design JSON">
                              <textarea
                                className={`${textareaClass} min-h-[160px] font-mono text-xs`}
                                value={contentEditDraft.designJsonText}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          designJsonText: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                placeholder="{ }"
                                disabled={contentSaving}
                                data-testid="textarea-marketing-edit-content-design-json"
                              />
                            </Field>
                            <Field label="Media assets JSON">
                              <textarea
                                className={`${textareaClass} min-h-[160px] font-mono text-xs`}
                                value={contentEditDraft.mediaAssetsText}
                                onChange={(event) =>
                                  setContentEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          mediaAssetsText: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                placeholder="[]"
                                disabled={contentSaving}
                                data-testid="textarea-marketing-edit-content-media-assets"
                              />
                            </Field>
                          </div>
                          <Field label="Content metadata JSON">
                            <textarea
                              className={`${textareaClass} min-h-[150px] font-mono text-xs`}
                              value={contentEditDraft.metadataText}
                              onChange={(event) =>
                                setContentEditDraft((draft) =>
                                  draft
                                    ? {
                                        ...draft,
                                        metadataText: event.target.value,
                                      }
                                    : draft,
                                )
                              }
                              placeholder="{ }"
                              disabled={contentSaving}
                              data-testid="textarea-marketing-edit-content-metadata"
                            />
                          </Field>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="submit"
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                              disabled={contentSaving}
                              data-testid="button-marketing-save-content"
                            >
                              <Save size={16} />{" "}
                              {contentSaving ? "Saving..." : "Save content"}
                            </button>
                            {editingContent ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteContent(editingContent)
                                }
                                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingContentDeleteId === editingContent.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                                disabled={contentSaving}
                                data-testid="button-marketing-delete-editing-content"
                              >
                                <Trash2 size={16} />{" "}
                                {confirmingContentDeleteId === editingContent.id
                                  ? "Confirm delete"
                                  : "Delete"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={cancelContentEdit}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 font-black text-[#241133]"
                              disabled={contentSaving}
                            >
                              <X size={16} /> Close
                            </button>
                          </div>
                          {contentFeedback ? (
                            <p
                              className={`rounded-xl px-4 py-3 text-sm font-bold ${contentFeedback.includes("failed") || contentFeedback.includes("required") || contentFeedback.includes("valid JSON") || contentFeedback.includes("could not") ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                              data-testid="marketing-content-editor-feedback"
                            >
                              {contentFeedback}
                            </p>
                          ) : null}
                        </form>
                      ) : (
                        <EmptyState text="Select a content asset from the library." />
                      )}
                    </SectionCard>
                  </div>
                </FloatingPanelPortal>
              ) : null}
              <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                {contentDrawerMode === "preview" ? (
                  <FloatingPanelPortal>
                    <div
                      ref={contentPreviewPanelRef}
                      data-testid="marketing-content-preview-panel"
                      role="dialog"
                      aria-modal={true}
                      tabIndex={-1}
                      className={floatingContentPanelClass}
                    >
                      <SectionCard
                        title="Content preview"
                        subtitle={
                          selectedContent
                            ? selectedContent.title
                            : "Select a content asset to inspect."
                        }
                        action={
                          contentDrawerMode === "preview" ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedContent ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    startContentEdit(selectedContent)
                                  }
                                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-purple-700 px-3 text-xs font-black text-white"
                                  data-testid="button-marketing-edit-previewed-content"
                                >
                                  <Pencil size={14} /> Edit
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={closeContentDrawer}
                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#241133]"
                                data-testid="button-marketing-close-content-drawer"
                              >
                                <X size={14} /> Close
                              </button>
                            </div>
                          ) : null
                        }
                      >
                        {selectedContent ? (
                          <div
                            className="grid gap-3"
                            data-testid="marketing-content-preview"
                          >
                            <ContentTemplatePreview
                              contentAsset={selectedContent}
                              linkedMediaAssets={selectedContentMediaAssets}
                              testId="marketing-content-customer-preview"
                            />
                            <ContentUsageList
                              usages={selectedContentUsage}
                              testId="marketing-selected-content-usage"
                              onOpenCampaign={openContentUsageCampaign}
                              onOpenJourney={openContentUsageJourney}
                            />
                            <details
                              className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3"
                              data-testid="marketing-content-admin-details"
                            >
                              <summary className="cursor-pointer text-sm font-black text-[#241133]">
                                Admin/source details
                              </summary>
                              <div className="mt-3 grid gap-3">
                                {selectedContent.source === "lovable" ? (
                                  <div
                                    className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm font-bold text-violet-900"
                                    data-testid="marketing-content-origin-summary"
                                  >
                                    Imported from{" "}
                                    {contentOriginLabel(selectedContent)}
                                    {selectedContent.lovableExternalId ? (
                                      <span className="break-all">
                                        {" "}
                                        - Lovable ID:{" "}
                                        {selectedContent.lovableExternalId}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {selectedContentDesignSummary?.arrayKeys
                                  .length ||
                                selectedContentDesignSummary?.topLevelKeys
                                  .length ||
                                selectedContentMediaPreviewUrls.length ? (
                                  <div
                                    className="rounded-xl border border-[#eadfd5] bg-white p-3"
                                    data-testid="marketing-content-design-media-summary"
                                  >
                                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                                      Imported structure
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {selectedContentDesignSummary?.arrayKeys.map(
                                        (item) => (
                                          <Pill
                                            key={item.key}
                                            className="bg-purple-50 text-purple-800"
                                          >
                                            Design {item.key}: {item.count}
                                          </Pill>
                                        ),
                                      )}
                                      {selectedContentDesignSummary
                                        ?.topLevelKeys.length ? (
                                        <Pill className="bg-white text-[#5b4a46]">
                                          Design keys:{" "}
                                          {selectedContentDesignSummary.topLevelKeys.join(
                                            ", ",
                                          )}
                                        </Pill>
                                      ) : null}
                                      <Pill
                                        className={
                                          selectedContentMediaPreviewUrls.length
                                            ? "bg-emerald-50 text-emerald-800"
                                            : "bg-[#f5eee8] text-[#7d6b65]"
                                        }
                                      >
                                        Media refs:{" "}
                                        {selectedContentMediaPreviewUrls.length}
                                      </Pill>
                                    </div>
                                  </div>
                                ) : null}
                                <LovableContentSourceDetails
                                  content={selectedContent}
                                />
                                <MetadataPanel
                                  title="Imported content metadata"
                                  value={selectedContent.metadata}
                                  testId="marketing-content-metadata-panel"
                                />
                              </div>
                            </details>
                          </div>
                        ) : (
                          <EmptyState text="No content available." />
                        )}
                      </SectionCard>
                    </div>
                  </FloatingPanelPortal>
                ) : null}

                <SectionCard
                  title="Media"
                  subtitle={`${visibleMediaAssets.length} asset${visibleMediaAssets.length === 1 ? "" : "s"} available.`}
                >
                  {mediaFeedback && !mediaEditDraft ? (
                    <p
                      className={`mb-3 rounded-xl px-4 py-3 text-sm font-bold ${mediaFeedback.toLowerCase().includes("updated") || mediaFeedback.toLowerCase().includes("deleted") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                      data-testid="marketing-media-feedback"
                    >
                      {mediaFeedback}
                    </p>
                  ) : null}
                  {mediaEditDraft ? (
                    <div ref={mediaEditorPanelRef} tabIndex={-1}>
                      <form
                        className="mb-4 grid gap-3 rounded-xl border border-purple-100 bg-purple-50 p-3"
                        onSubmit={(event) => void saveMediaEdit(event)}
                        data-testid="marketing-media-editor-form"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#241133]">
                              Media editor
                            </p>
                            <p className="text-xs font-bold text-[#7d6b65]">
                              {editingMediaAsset?.originalUrl ??
                                "Editing imported media reference"}
                            </p>
                          </div>
                          {editingMediaAsset ? (
                            <Pill className="bg-white text-purple-800">
                              {editingMediaAsset.source}
                            </Pill>
                          ) : null}
                        </div>
                        <div className="grid gap-3 xl:grid-cols-[1fr_160px_160px]">
                          <Field label="Original URL">
                            <input
                              className={inputClass}
                              value={mediaEditDraft.originalUrl}
                              onChange={(event) =>
                                setMediaEditDraft((draft) =>
                                  draft
                                    ? {
                                        ...draft,
                                        originalUrl: event.target.value,
                                      }
                                    : draft,
                                )
                              }
                              disabled={mediaSaving}
                              data-testid="input-marketing-edit-media-original-url"
                            />
                          </Field>
                          <Field label="Type">
                            <input
                              className={inputClass}
                              value={mediaEditDraft.assetType}
                              onChange={(event) =>
                                setMediaEditDraft((draft) =>
                                  draft
                                    ? {
                                        ...draft,
                                        assetType: event.target.value,
                                      }
                                    : draft,
                                )
                              }
                              disabled={mediaSaving}
                              data-testid="input-marketing-edit-media-type"
                            />
                          </Field>
                          <Field label="Status">
                            <input
                              className={inputClass}
                              value={mediaEditDraft.status}
                              onChange={(event) =>
                                setMediaEditDraft((draft) =>
                                  draft
                                    ? { ...draft, status: event.target.value }
                                    : draft,
                                )
                              }
                              disabled={mediaSaving}
                              data-testid="input-marketing-edit-media-status"
                            />
                          </Field>
                        </div>
                        <div className="grid gap-3 xl:grid-cols-3">
                          <Field label="Linked content">
                            <select
                              className={inputClass}
                              value={mediaEditDraft.contentAssetId}
                              onChange={(event) =>
                                setMediaEditDraft((draft) =>
                                  draft
                                    ? {
                                        ...draft,
                                        contentAssetId: event.target.value,
                                      }
                                    : draft,
                                )
                              }
                              disabled={mediaSaving}
                              data-testid="select-marketing-edit-media-content"
                            >
                              <option value="">No linked content</option>
                              {content.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Local URL">
                            <input
                              className={inputClass}
                              value={mediaEditDraft.localUrl}
                              onChange={(event) =>
                                setMediaEditDraft((draft) =>
                                  draft
                                    ? { ...draft, localUrl: event.target.value }
                                    : draft,
                                )
                              }
                              disabled={mediaSaving}
                              data-testid="input-marketing-edit-media-local-url"
                            />
                          </Field>
                          <Field label="Lovable ID">
                            <input
                              className={inputClass}
                              value={mediaEditDraft.lovableExternalId}
                              onChange={(event) =>
                                setMediaEditDraft((draft) =>
                                  draft
                                    ? {
                                        ...draft,
                                        lovableExternalId: event.target.value,
                                      }
                                    : draft,
                                )
                              }
                              disabled={mediaSaving}
                              data-testid="input-marketing-edit-media-lovable-id"
                            />
                          </Field>
                        </div>
                        <Field label="Metadata JSON">
                          <textarea
                            className={`${textareaClass} min-h-[120px] font-mono text-xs`}
                            value={mediaEditDraft.metadataText}
                            onChange={(event) =>
                              setMediaEditDraft((draft) =>
                                draft
                                  ? {
                                      ...draft,
                                      metadataText: event.target.value,
                                    }
                                  : draft,
                              )
                            }
                            disabled={mediaSaving}
                            data-testid="textarea-marketing-edit-media-metadata"
                          />
                        </Field>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="submit"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                            disabled={mediaSaving}
                            data-testid="button-marketing-save-media"
                          >
                            <Save size={15} />{" "}
                            {mediaSaving ? "Saving..." : "Save media"}
                          </button>
                          {editingMediaAsset ? (
                            <button
                              type="button"
                              onClick={() =>
                                void deleteMediaAsset(editingMediaAsset)
                              }
                              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingMediaDeleteId === editingMediaAsset.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                              disabled={mediaSaving}
                              data-testid="button-marketing-delete-editing-media"
                            >
                              <Trash2 size={15} />{" "}
                              {confirmingMediaDeleteId === editingMediaAsset.id
                                ? "Confirm delete"
                                : "Delete"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={cancelMediaEdit}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#241133] disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                            disabled={mediaSaving}
                            data-testid="button-marketing-cancel-media"
                          >
                            <X size={15} /> Close
                          </button>
                          {mediaFeedback ? (
                            <p
                              className={`rounded-xl px-4 py-3 text-sm font-bold ${mediaFeedback.toLowerCase().includes("updated") || mediaFeedback.toLowerCase().includes("deleted") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                              data-testid="marketing-media-feedback"
                            >
                              {mediaFeedback}
                            </p>
                          ) : null}
                        </div>
                      </form>
                    </div>
                  ) : null}
                  <div
                    className="overflow-hidden rounded-xl border border-[#eadfd5] bg-white"
                    data-testid="marketing-media-assets-list"
                  >
                    {visibleMediaAssets.length === 0 ? (
                      <EmptyState text="No media imported yet." />
                    ) : (
                      visibleMediaAssets.map((asset) => {
                        const linkedContent = asset.contentAssetId
                          ? (content.find(
                              (item) => item.id === asset.contentAssetId,
                            ) ?? null)
                          : null;
                        const mediaUrl = asset.localUrl || asset.originalUrl;
                        const title =
                          asset.contentTitle ||
                          mediaPreviewLabel(asset.originalUrl);
                        return (
                          <article
                            key={asset.id}
                            className={`grid gap-3 border-t border-[#f0e7df] p-3 first:border-t-0 md:grid-cols-[72px_minmax(0,1fr)_auto] md:items-center ${selectedContentMediaAssets.some((item) => item.id === asset.id) ? "bg-purple-50/60" : ""}`}
                          >
                            <div
                              className="h-14 w-[72px] overflow-hidden rounded-xl border border-[#eadfd5] bg-[#fbf8f5]"
                              data-testid={`marketing-media-preview-${asset.id}`}
                            >
                              {asset.assetType === "image" ? (
                                <img
                                  src={mediaUrl}
                                  alt={title}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                                  {asset.assetType}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-black text-[#241133]">
                                  {title}
                                </p>
                                <Pill className="bg-blue-50 text-blue-800">
                                  {asset.assetType}
                                </Pill>
                                {asset.localUrl ? (
                                  <Pill className="bg-emerald-50 text-emerald-800">
                                    local copy
                                  </Pill>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-xs font-bold text-[#7d6b65]">
                                {linkedContent
                                  ? "Linked content"
                                  : "Not linked"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <a
                                href={mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700"
                                data-testid={`link-marketing-open-media-${asset.id}`}
                              >
                                <ExternalLink size={13} /> Open
                              </a>
                              {linkedContent ? (
                                <button
                                  type="button"
                                  onClick={() => previewContent(linkedContent)}
                                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                                  disabled={mediaSaving}
                                  data-testid={`button-marketing-preview-media-content-${asset.id}`}
                                >
                                  <Eye size={13} /> Preview
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => startMediaEdit(asset)}
                                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                                disabled={mediaSaving}
                                data-testid={`button-marketing-edit-media-${asset.id}`}
                              >
                                <Pencil size={13} /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteMediaAsset(asset)}
                                className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingMediaDeleteId === asset.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                                disabled={mediaSaving}
                                data-testid={`button-marketing-delete-media-${asset.id}`}
                              >
                                <Trash2 size={13} />{" "}
                                {confirmingMediaDeleteId === asset.id
                                  ? "Confirm delete"
                                  : "Delete"}
                              </button>
                              {confirmingMediaDeleteId === asset.id ? (
                                <p
                                  className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800"
                                  data-testid={`marketing-media-delete-confirmation-${asset.id}`}
                                >
                                  Click Confirm delete to remove this VYVA media
                                  reference.
                                </p>
                              ) : null}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="grid gap-4" data-testid="marketing-calendar-tab">
              <SectionCard
                title="Calendar"
                subtitle="Review scheduled campaigns and drafts."
                action={
                  <button
                    type="button"
                    onClick={() => void sendDueCampaignEmails()}
                    disabled={dueEmailSending}
                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8] ${confirmingDueEmailSend ? "bg-red-700" : "bg-purple-700"}`}
                    data-testid="button-marketing-run-due-email"
                  >
                    <Send size={15} />{" "}
                    {dueEmailSending
                      ? "Running..."
                      : confirmingDueEmailSend
                        ? "Confirm run due emails"
                        : "Run due emails"}
                  </button>
                }
              >
                {dueEmailFeedback ? (
                  <p
                    className={`mb-3 rounded-xl px-4 py-3 text-sm font-bold ${/failed|could not|error/i.test(dueEmailFeedback) ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                    data-testid="marketing-due-email-feedback"
                  >
                    {dueEmailFeedback}
                  </p>
                ) : null}
                <MarketingCalendarView
                  campaigns={visibleCampaigns}
                  audiences={audiences}
                  onEdit={openCampaignFromCalendar}
                  onDelete={(campaign) => void deleteCampaign(campaign)}
                  confirmingDeleteId={confirmingCampaignDeleteId}
                />
              </SectionCard>
            </div>
          )}

          {activeTab === "contacts" && (
            <div className="grid gap-4" data-testid="marketing-contacts-tab">
              <div
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#eadfd5] bg-white p-2 shadow-sm"
                data-testid="marketing-contacts-view-switcher"
              >
                <button
                  type="button"
                  onClick={cancelContactEdit}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${contactView === "contacts" ? "bg-purple-700 text-white" : "text-[#4b394f] hover:bg-purple-50"}`}
                  data-testid="button-marketing-contacts-view"
                >
                  <UsersRound size={15} /> Contacts ({contacts.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cancelContactEdit();
                    setContactView("create");
                  }}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${contactView === "create" ? "bg-purple-700 text-white" : "text-[#4b394f] hover:bg-purple-50"}`}
                  data-testid="button-marketing-create-contact-view"
                >
                  <Plus size={15} /> Add contact
                </button>
                <button
                  type="button"
                  onClick={() => setContactView("lists")}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${contactView === "lists" ? "bg-purple-700 text-white" : "text-[#4b394f] hover:bg-purple-50"}`}
                  data-testid="button-marketing-lists-view"
                >
                  <UsersRound size={15} /> Lists ({audiences.length})
                </button>
              </div>

              {contactFeedback && !contactEditDraft ? (
                <p
                  className={`rounded-xl px-4 py-3 text-sm font-bold ${/created|updated|deleted/i.test(contactFeedback) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                  data-testid="marketing-contact-feedback"
                >
                  {contactFeedback}
                </p>
              ) : null}

              {contactView !== "lists" ? (
                <>
                  {contactView === "create" && !contactEditDraft ? (
                    <SectionCard
                      title="Add contact"
                      subtitle="Add the details you use to identify and contact this person."
                    >
                      <form
                        className="grid gap-3"
                        onSubmit={(event) =>
                          createContact(event).catch((error) => {
                            setContactFeedback(error.message);
                            setMessage(error.message);
                          })
                        }
                      >
                        <div className="grid gap-3 xl:grid-cols-[1.3fr_160px_1fr_1fr]">
                          <Field label="Name">
                            <input
                              className={inputClass}
                              value={contactDraft.fullName}
                              onChange={(event) =>
                                setContactDraft((draft) => ({
                                  ...draft,
                                  fullName: event.target.value,
                                }))
                              }
                              placeholder="Contact name"
                              disabled={contactSaving}
                              data-testid="input-marketing-contact-name"
                            />
                          </Field>
                          <Field label="Audience">
                            <select
                              className={inputClass}
                              value={contactDraft.audienceType}
                              onChange={(event) =>
                                setContactDraft((draft) => ({
                                  ...draft,
                                  audienceType: event.target.value as Audience,
                                }))
                              }
                              disabled={contactSaving}
                            >
                              {AUDIENCES.map((audience) => (
                                <option key={audience} value={audience}>
                                  {audience.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Email">
                            <input
                              className={inputClass}
                              value={contactDraft.email}
                              onChange={(event) =>
                                setContactDraft((draft) => ({
                                  ...draft,
                                  email: event.target.value,
                                }))
                              }
                              placeholder="name@example.com"
                              disabled={contactSaving}
                              data-testid="input-marketing-contact-email"
                            />
                          </Field>
                          <Field label="Phone">
                            <input
                              className={inputClass}
                              value={contactDraft.phoneNumber}
                              onChange={(event) =>
                                setContactDraft((draft) => ({
                                  ...draft,
                                  phoneNumber: event.target.value,
                                }))
                              }
                              placeholder="+34 ..."
                              disabled={contactSaving}
                              data-testid="input-marketing-contact-phone"
                            />
                          </Field>
                        </div>
                        <details className="rounded-xl border border-[#eadfd5] bg-[#fffdfa] p-3">
                          <summary className="cursor-pointer list-none text-sm font-black text-purple-700">
                            Add optional details
                          </summary>
                          <div className="mt-3 grid gap-3 xl:grid-cols-4">
                            <Field label="WhatsApp">
                              <input
                                className={inputClass}
                                value={contactDraft.whatsappNumber}
                                onChange={(event) =>
                                  setContactDraft((draft) => ({
                                    ...draft,
                                    whatsappNumber: event.target.value,
                                  }))
                                }
                                placeholder="Leave blank if same"
                                disabled={contactSaving}
                                data-testid="input-marketing-contact-whatsapp"
                              />
                            </Field>
                            <Field label="Role">
                              <input
                                className={inputClass}
                                value={contactDraft.roleLabel}
                                onChange={(event) =>
                                  setContactDraft((draft) => ({
                                    ...draft,
                                    roleLabel: event.target.value,
                                  }))
                                }
                                placeholder="Founder, lead, caregiver..."
                                disabled={contactSaving}
                                data-testid="input-marketing-contact-role"
                              />
                            </Field>
                            <Field label="Company">
                              <input
                                className={inputClass}
                                value={contactDraft.companyName}
                                onChange={(event) =>
                                  setContactDraft((draft) => ({
                                    ...draft,
                                    companyName: event.target.value,
                                  }))
                                }
                                placeholder="Organization"
                                disabled={contactSaving}
                                data-testid="input-marketing-contact-company"
                              />
                            </Field>
                            <Field label="Tags">
                              <input
                                className={inputClass}
                                value={contactDraft.tags}
                                onChange={(event) =>
                                  setContactDraft((draft) => ({
                                    ...draft,
                                    tags: event.target.value,
                                  }))
                                }
                                placeholder="lead, partner, madrid"
                                disabled={contactSaving}
                                data-testid="input-marketing-contact-tags"
                              />
                            </Field>
                            <Field label="Language">
                              <input
                                className={inputClass}
                                value={contactDraft.language}
                                onChange={(event) =>
                                  setContactDraft((draft) => ({
                                    ...draft,
                                    language: event.target.value,
                                  }))
                                }
                                placeholder="en, es..."
                                disabled={contactSaving}
                                data-testid="input-marketing-contact-language"
                              />
                            </Field>
                            <Field label="Category">
                              <input
                                className={inputClass}
                                value={contactDraft.category}
                                onChange={(event) =>
                                  setContactDraft((draft) => ({
                                    ...draft,
                                    category: event.target.value,
                                  }))
                                }
                                placeholder="Lead category"
                                disabled={contactSaving}
                                data-testid="input-marketing-contact-category"
                              />
                            </Field>
                            <Field label="Vertical">
                              <input
                                className={inputClass}
                                value={contactDraft.vertical}
                                onChange={(event) =>
                                  setContactDraft((draft) => ({
                                    ...draft,
                                    vertical: event.target.value,
                                  }))
                                }
                                placeholder="Healthcare, public..."
                                disabled={contactSaving}
                                data-testid="input-marketing-contact-vertical"
                              />
                            </Field>
                            <Field label="Market">
                              <input
                                className={inputClass}
                                value={contactDraft.market}
                                onChange={(event) =>
                                  setContactDraft((draft) => ({
                                    ...draft,
                                    market: event.target.value,
                                  }))
                                }
                                placeholder="Spain, UK..."
                                disabled={contactSaving}
                                data-testid="input-marketing-contact-market"
                              />
                            </Field>
                          </div>
                        </details>
                        <div className="flex justify-end">
                          <button
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                            type="submit"
                            disabled={contactSaving}
                            data-testid="button-marketing-add-contact"
                          >
                            <UsersRound size={16} />{" "}
                            {contactSaving ? "Saving..." : "Add contact"}
                          </button>
                        </div>
                      </form>
                    </SectionCard>
                  ) : null}
                  {contactEditDraft ? (
                    <div ref={contactEditorPanelRef} tabIndex={-1}>
                      <SectionCard
                        title="Contact editor"
                        subtitle={
                          editingContact
                            ? `Editing ${editingContact.fullName || editingContact.email || editingContact.phoneNumber || "Unnamed contact"}.`
                            : "Edit imported or manually created marketing contact data."
                        }
                        action={
                          editingContact ? (
                            <Pill
                              className={statusClass(editingContact.source)}
                            >
                              {editingContact.source}
                            </Pill>
                          ) : null
                        }
                      >
                        <form
                          className="grid gap-3"
                          onSubmit={(event) => void saveContactEdit(event)}
                          data-testid="marketing-contact-editor-form"
                        >
                          <div className="grid gap-3 xl:grid-cols-[1.2fr_160px_180px]">
                            <Field label="Name">
                              <input
                                className={inputClass}
                                value={contactEditDraft.fullName}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          fullName: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-name"
                              />
                            </Field>
                            <Field label="Audience">
                              <select
                                className={inputClass}
                                value={contactEditDraft.audienceType}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          audienceType: event.target
                                            .value as Audience,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="select-marketing-edit-contact-audience"
                              >
                                {AUDIENCES.map((audience) => (
                                  <option key={audience} value={audience}>
                                    {audience.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Consent">
                              <select
                                className={inputClass}
                                value={contactEditDraft.consentStatus}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          consentStatus: event.target
                                            .value as ConsentStatus,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="select-marketing-edit-contact-consent"
                              >
                                {CONSENT_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-3">
                            <Field label="Email">
                              <input
                                className={inputClass}
                                value={contactEditDraft.email}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? { ...draft, email: event.target.value }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-email"
                              />
                            </Field>
                            <Field label="Phone">
                              <input
                                className={inputClass}
                                value={contactEditDraft.phoneNumber}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          phoneNumber: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-phone"
                              />
                            </Field>
                            <Field label="WhatsApp">
                              <input
                                className={inputClass}
                                value={contactEditDraft.whatsappNumber}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          whatsappNumber: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-whatsapp"
                              />
                            </Field>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-3">
                            <Field label="Role">
                              <input
                                className={inputClass}
                                value={contactEditDraft.roleLabel}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          roleLabel: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-role"
                              />
                            </Field>
                            <Field label="Company">
                              <input
                                className={inputClass}
                                value={contactEditDraft.companyName}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          companyName: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-company"
                              />
                            </Field>
                            <Field label="Tags">
                              <input
                                className={inputClass}
                                value={contactEditDraft.tags}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? { ...draft, tags: event.target.value }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-tags"
                              />
                            </Field>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-4">
                            <Field label="Language">
                              <input
                                className={inputClass}
                                value={contactEditDraft.language}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          language: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-language"
                              />
                            </Field>
                            <Field label="Category">
                              <input
                                className={inputClass}
                                value={contactEditDraft.category}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          category: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-category"
                              />
                            </Field>
                            <Field label="Vertical">
                              <input
                                className={inputClass}
                                value={contactEditDraft.vertical}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          vertical: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-vertical"
                              />
                            </Field>
                            <Field label="Market">
                              <input
                                className={inputClass}
                                value={contactEditDraft.market}
                                onChange={(event) =>
                                  setContactEditDraft((draft) =>
                                    draft
                                      ? { ...draft, market: event.target.value }
                                      : draft,
                                  )
                                }
                                disabled={contactSaving}
                                data-testid="input-marketing-edit-contact-market"
                              />
                            </Field>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="submit"
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                              disabled={contactSaving}
                              data-testid="button-marketing-save-contact"
                            >
                              <Save size={16} />{" "}
                              {contactSaving ? "Saving..." : "Save contact"}
                            </button>
                            {editingContact ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteContact(editingContact)
                                }
                                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingContactDeleteId === editingContact.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                                disabled={contactSaving}
                                data-testid="button-marketing-delete-editing-contact"
                              >
                                <Trash2 size={16} />{" "}
                                {confirmingContactDeleteId === editingContact.id
                                  ? "Confirm delete"
                                  : "Delete"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={cancelContactEdit}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 font-black text-[#241133] disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                              disabled={contactSaving}
                              data-testid="button-marketing-cancel-contact"
                            >
                              <X size={16} /> Close
                            </button>
                            {contactFeedback ? (
                              <p
                                className={`rounded-xl px-4 py-3 text-sm font-bold ${contactFeedback.toLowerCase().includes("updated") || contactFeedback.toLowerCase().includes("deleted") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                                data-testid="marketing-contact-editor-feedback"
                              >
                                {contactFeedback}
                              </p>
                            ) : null}
                          </div>
                        </form>
                      </SectionCard>
                    </div>
                  ) : null}
                  {contactView === "contacts" ? (
                    <SectionCard
                      title="Contacts"
                      subtitle={`${visibleContacts.length} visible of ${contacts.length} contacts.`}
                    >
                      <details
                        className="group mb-3 rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3"
                        data-testid="marketing-contact-segmentation-filters"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-black text-[#241133]">
                          More filters
                          <span className="text-xs text-purple-700 group-open:hidden">
                            Show
                          </span>
                          <span className="hidden text-xs text-purple-700 group-open:inline">
                            Hide
                          </span>
                        </summary>
                        <div className="mt-3 grid gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-[#241133]">
                                Contact segmentation
                              </p>
                              <p className="text-xs font-bold text-[#7d6b65]">
                                Filter imported Lovable contacts by list,
                                consent, market, language, category, vertical,
                                and source.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSearch("");
                                setAudienceFilter("all");
                                setContactSourceFilter("all");
                                setContactConsentFilter("all");
                                setContactLanguageFilter("all");
                                setContactCategoryFilter("all");
                                setContactVerticalFilter("all");
                                setContactMarketFilter("all");
                                setContactListFilter("all");
                              }}
                              disabled={
                                !search &&
                                audienceFilter === "all" &&
                                !contactFiltersActive
                              }
                              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                              data-testid="button-marketing-clear-contact-filters"
                            >
                              Clear filters
                            </button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <Field label="Source">
                              <select
                                className={inputClass}
                                value={contactSourceFilter}
                                onChange={(event) =>
                                  setContactSourceFilter(event.target.value)
                                }
                                data-testid="select-marketing-contact-source-filter"
                              >
                                <option value="all">
                                  All sources ({contacts.length})
                                </option>
                                {contactSourceOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label} ({option.count})
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Consent">
                              <select
                                className={inputClass}
                                value={contactConsentFilter}
                                onChange={(event) =>
                                  setContactConsentFilter(event.target.value)
                                }
                                data-testid="select-marketing-contact-consent-filter"
                              >
                                <option value="all">
                                  All consent ({contacts.length})
                                </option>
                                {contactConsentOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label} ({option.count})
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Language">
                              <select
                                className={inputClass}
                                value={contactLanguageFilter}
                                onChange={(event) =>
                                  setContactLanguageFilter(event.target.value)
                                }
                                data-testid="select-marketing-contact-language-filter"
                              >
                                <option value="all">
                                  All languages ({contacts.length})
                                </option>
                                {contactLanguageOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label} ({option.count})
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="List">
                              <select
                                className={inputClass}
                                value={contactListFilter}
                                onChange={(event) =>
                                  setContactListFilter(event.target.value)
                                }
                                data-testid="select-marketing-contact-list-filter"
                              >
                                <option value="all">
                                  All lists ({contacts.length})
                                </option>
                                {contactListOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label} ({option.count})
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <Field label="Category">
                              <select
                                className={inputClass}
                                value={contactCategoryFilter}
                                onChange={(event) =>
                                  setContactCategoryFilter(event.target.value)
                                }
                                data-testid="select-marketing-contact-category-filter"
                              >
                                <option value="all">
                                  All categories ({contacts.length})
                                </option>
                                {contactCategoryOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label} ({option.count})
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Vertical">
                              <select
                                className={inputClass}
                                value={contactVerticalFilter}
                                onChange={(event) =>
                                  setContactVerticalFilter(event.target.value)
                                }
                                data-testid="select-marketing-contact-vertical-filter"
                              >
                                <option value="all">
                                  All verticals ({contacts.length})
                                </option>
                                {contactVerticalOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label} ({option.count})
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Market">
                              <select
                                className={inputClass}
                                value={contactMarketFilter}
                                onChange={(event) =>
                                  setContactMarketFilter(event.target.value)
                                }
                                data-testid="select-marketing-contact-market-filter"
                              >
                                <option value="all">
                                  All markets ({contacts.length})
                                </option>
                                {contactMarketOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label} ({option.count})
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                        </div>
                      </details>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#6d5b66]">
                        <span>
                          {visibleContacts.length === 0
                            ? "No contacts"
                            : `${(safeContactPage - 1) * contactsPerPage + 1}-${Math.min(safeContactPage * contactsPerPage, visibleContacts.length)} of ${visibleContacts.length}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setContactPage((page) => Math.max(1, page - 1))
                            }
                            disabled={safeContactPage === 1}
                            className="min-h-9 rounded-xl border border-[#eadfd5] bg-white px-3 font-black disabled:text-[#b8abb8]"
                          >
                            Previous
                          </button>
                          <span>
                            Page {safeContactPage} of {contactPageCount}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setContactPage((page) =>
                                Math.min(contactPageCount, page + 1),
                              )
                            }
                            disabled={safeContactPage === contactPageCount}
                            className="min-h-9 rounded-xl border border-[#eadfd5] bg-white px-3 font-black disabled:text-[#b8abb8]"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                      <div
                        className="overflow-hidden rounded-xl border border-[#eadfd5]"
                        data-testid="marketing-contacts-table"
                      >
                        <table className="w-full table-fixed border-collapse text-left text-sm [&_td:nth-child(4)]:hidden [&_td:nth-child(6)]:hidden [&_td:nth-child(7)]:hidden [&_td:nth-child(8)]:hidden [&_td:nth-child(9)]:hidden [&_td:nth-child(10)]:hidden [&_td:nth-child(11)]:hidden [&_td:nth-child(12)]:hidden [&_td:nth-child(15)]:hidden [&_th:nth-child(4)]:hidden [&_th:nth-child(6)]:hidden [&_th:nth-child(7)]:hidden [&_th:nth-child(8)]:hidden [&_th:nth-child(9)]:hidden [&_th:nth-child(10)]:hidden [&_th:nth-child(11)]:hidden [&_th:nth-child(12)]:hidden [&_th:nth-child(15)]:hidden">
                          <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                            <tr>
                              <th className="w-[20%] px-4 py-3">Contact</th>
                              <th className="w-[22%] px-4 py-3">Email</th>
                              <th className="w-[14%] px-4 py-3">Phone</th>
                              <th className="px-4 py-3">WhatsApp</th>
                              <th className="w-[10%] px-4 py-3">Audience</th>
                              <th className="px-4 py-3">Company</th>
                              <th className="px-4 py-3">Role</th>
                              <th className="px-4 py-3">Lang</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Vertical</th>
                              <th className="px-4 py-3">Market</th>
                              <th className="px-4 py-3">Lovable profile</th>
                              <th className="w-[16%] px-4 py-3">
                                Lists & tags
                              </th>
                              <th className="w-[10%] px-4 py-3">Consent</th>
                              <th className="px-4 py-3">Source</th>
                              <th className="w-[11%] border-l border-[#eadfd5] px-4 py-3">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleContacts.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={16}
                                  className="px-4 py-6 text-center font-bold text-[#8b7a73]"
                                  data-testid="marketing-contact-empty-diagnostic"
                                >
                                  {contacts.length
                                    ? "Contacts are loaded, but hidden by the current search or segmentation filters."
                                    : "No contacts imported yet."}
                                </td>
                              </tr>
                            ) : (
                              paginatedContacts.map((contact) => {
                                const tagsAndLists = [
                                  ...(contact.tags ?? []),
                                  ...(contact.lists ?? []).map(
                                    (list) => `List: ${list}`,
                                  ),
                                ];
                                const profileSignals =
                                  contactProfileSignals(contact);
                                const timelineParts =
                                  recordTimelineParts(contact);
                                return (
                                  <tr
                                    key={contact.id}
                                    className={`border-t border-[#f0e7df] align-top ${editingContactId === contact.id ? "bg-purple-50" : ""}`}
                                  >
                                    <td className="px-4 py-3">
                                      <p className="font-black">
                                        {contact.fullName ||
                                          contact.email ||
                                          contact.phoneNumber ||
                                          "Unnamed contact"}
                                      </p>
                                    </td>
                                    <td className="max-w-[220px] px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.email || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.phoneNumber || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.whatsappNumber || "-"}
                                    </td>
                                    <td className="px-4 py-3 font-black">
                                      {contact.audienceType.toUpperCase()}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.companyName || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.roleLabel || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.language || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.category || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.vertical || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5b4a46]">
                                      {contact.market || "-"}
                                    </td>
                                    <td className="max-w-[260px] px-4 py-3">
                                      {profileSignals.length ? (
                                        <div
                                          className="flex flex-wrap gap-1.5"
                                          data-testid={`marketing-contact-profile-signals-${contact.id}`}
                                        >
                                          {profileSignals.map((entry) => (
                                            <Pill
                                              key={entry.key}
                                              className={entry.className}
                                            >
                                              {entry.label}: {entry.value}
                                            </Pill>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-xs font-bold text-[#8b7a73]">
                                          No profile signals
                                        </span>
                                      )}
                                    </td>
                                    <td className="max-w-[320px] px-4 py-3">
                                      {tagsAndLists.length ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {tagsAndLists
                                            .slice(0, 2)
                                            .map((segment, index) => (
                                              <Pill
                                                key={`${segment}-${index}`}
                                                className="bg-purple-50 text-purple-800"
                                              >
                                                {segment}
                                              </Pill>
                                            ))}
                                          {tagsAndLists.length > 2 ? (
                                            <Pill className="bg-[#f5eee8] text-[#5b4a46]">
                                              +{tagsAndLists.length - 2}
                                            </Pill>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <span className="text-xs font-bold text-[#8b7a73]">
                                          No tags or lists
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Pill
                                        className={statusClass(
                                          contact.consentStatus,
                                        )}
                                      >
                                        {contact.consentStatus}
                                      </Pill>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="grid gap-2">
                                        <p className="font-bold">
                                          {contact.source}
                                        </p>
                                        {contact.lovableExternalId ? (
                                          <p className="break-all text-xs font-semibold text-[#7d6b65]">
                                            Lovable ID:{" "}
                                            {contact.lovableExternalId}
                                          </p>
                                        ) : null}
                                        {contact.profileId ? (
                                          <p className="break-all text-xs font-semibold text-[#7d6b65]">
                                            Profile: {contact.profileId}
                                          </p>
                                        ) : null}
                                        {contact.organizationId ? (
                                          <p className="break-all text-xs font-semibold text-[#7d6b65]">
                                            Org: {contact.organizationId}
                                          </p>
                                        ) : null}
                                        {timelineParts.length ? (
                                          <div
                                            className="grid gap-1"
                                            data-testid={`marketing-contact-timeline-${contact.id}`}
                                          >
                                            {timelineParts.map((part) => (
                                              <p
                                                key={part}
                                                className="text-xs font-semibold text-[#8b7a73]"
                                              >
                                                {part}
                                              </p>
                                            ))}
                                          </div>
                                        ) : null}
                                        <MetadataPanel
                                          title="Imported contact data"
                                          value={contact.metadata}
                                          testId={`marketing-contact-metadata-${contact.id}`}
                                        />
                                      </div>
                                    </td>
                                    <td
                                      className={`w-[120px] border-l border-[#eadfd5] px-3 py-3 ${editingContactId === contact.id || confirmingContactDeleteId === contact.id ? "bg-purple-50" : "bg-white"}`}
                                    >
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            startContactEdit(contact)
                                          }
                                          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                                          disabled={contactSaving}
                                          data-testid={`button-marketing-edit-contact-${contact.id}`}
                                        >
                                          <Pencil size={13} /> Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void deleteContact(contact)
                                          }
                                          className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingContactDeleteId === contact.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                                          disabled={contactSaving}
                                          data-testid={`button-marketing-delete-contact-${contact.id}`}
                                        >
                                          <Trash2 size={13} />{" "}
                                          {confirmingContactDeleteId ===
                                          contact.id
                                            ? "Confirm delete"
                                            : "Delete"}
                                        </button>
                                        {confirmingContactDeleteId ===
                                        contact.id ? (
                                          <p
                                            className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800"
                                            data-testid={`marketing-contact-delete-confirmation-${contact.id}`}
                                          >
                                            Click Confirm delete to remove this
                                            marketing contact.
                                          </p>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </SectionCard>
                  ) : null}
                </>
              ) : (
                <>
                  <SectionCard
                    title="List builder"
                    subtitle="Store reusable Lovable-style lists with optional rules and contact external IDs."
                  >
                    <form
                      className="grid gap-3"
                      onSubmit={(event) =>
                        createAudience(event).catch((error) => {
                          setAudienceFeedback(error.message);
                          setMessage(error.message);
                        })
                      }
                      data-testid="marketing-audience-builder"
                    >
                      <div className="grid gap-3 xl:grid-cols-[1fr_180px_1fr]">
                        <Field label="Audience name">
                          <input
                            className={inputClass}
                            value={audienceDraft.name}
                            onChange={(event) =>
                              setAudienceDraft((draft) => ({
                                ...draft,
                                name: event.target.value,
                              }))
                            }
                            placeholder="Madrid partners"
                            disabled={audienceSaving}
                            data-testid="input-marketing-audience-name"
                          />
                        </Field>
                        <Field label="List type">
                          <select
                            className={inputClass}
                            value={audienceDraft.listType}
                            onChange={(event) =>
                              setAudienceDraft((draft) => ({
                                ...draft,
                                listType: event.target.value,
                              }))
                            }
                            disabled={audienceSaving}
                            data-testid="select-marketing-audience-type"
                          >
                            <option value="dynamic">dynamic</option>
                            <option value="static">static</option>
                            <option value="imported">imported</option>
                          </select>
                        </Field>
                        <Field label="Description">
                          <input
                            className={inputClass}
                            value={audienceDraft.description}
                            onChange={(event) =>
                              setAudienceDraft((draft) => ({
                                ...draft,
                                description: event.target.value,
                              }))
                            }
                            placeholder="Who this list is for"
                            disabled={audienceSaving}
                            data-testid="input-marketing-audience-description"
                          />
                        </Field>
                      </div>
                      <div className="grid gap-3 xl:grid-cols-2">
                        <Field label="Rules JSON">
                          <textarea
                            className={textareaClass}
                            value={audienceDraft.rulesText}
                            onChange={(event) =>
                              setAudienceDraft((draft) => ({
                                ...draft,
                                rulesText: event.target.value,
                              }))
                            }
                            disabled={audienceSaving}
                            data-testid="input-marketing-audience-rules"
                          />
                        </Field>
                        <Field label="Members">
                          <div
                            className="grid gap-2"
                            data-testid="marketing-audience-member-picker"
                          >
                            <select
                              className={inputClass}
                              value=""
                              onChange={(event) =>
                                addAudienceDraftContact(event.target.value)
                              }
                              disabled={
                                audienceSaving ||
                                audienceDraftCandidateContacts.length === 0
                              }
                              data-testid="select-marketing-audience-add-contact"
                            >
                              <option value="">
                                {audienceDraftCandidateContacts.length
                                  ? "Add contact by name or email"
                                  : "All visible contacts are already listed"}
                              </option>
                              {audienceDraftCandidateContacts.map((contact) => (
                                <option key={contact.id} value={contact.id}>
                                  {audienceContactLabel(contact)}
                                </option>
                              ))}
                            </select>
                            {audienceDraftMemberContacts.length ? (
                              <div
                                className="grid gap-2"
                                data-testid="marketing-audience-selected-members"
                              >
                                {audienceDraftMemberContacts.map((contact) => (
                                  <div
                                    key={contact.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-[#eadfd5] bg-white px-3 py-2"
                                  >
                                    <span className="text-xs font-bold text-[#5b4a46]">
                                      {audienceContactLabel(contact)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeAudienceDraftContact(contact)
                                      }
                                      className="text-xs font-black text-red-700"
                                      disabled={audienceSaving}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="rounded-lg bg-[#fffaf4] px-3 py-2 text-xs font-bold text-[#8b7a73]">
                                No mapped contacts selected yet.
                              </p>
                            )}
                            <textarea
                              className={`${textareaClass} min-h-[76px] font-mono text-xs`}
                              value={audienceDraft.contactExternalIds}
                              onChange={(event) =>
                                setAudienceDraft((draft) => ({
                                  ...draft,
                                  contactExternalIds: event.target.value,
                                }))
                              }
                              placeholder="contact:123, contact:456"
                              disabled={audienceSaving}
                              data-testid="input-marketing-audience-contact-ids"
                            />
                          </div>
                        </Field>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                          type="submit"
                          disabled={audienceSaving}
                          data-testid="button-marketing-add-audience"
                        >
                          <UsersRound size={16} />{" "}
                          {audienceSaving ? "Saving..." : "Add audience"}
                        </button>
                        {audienceFeedback && !audienceEditDraft ? (
                          <p
                            className={`rounded-xl px-4 py-3 text-sm font-bold ${audienceFeedback.includes("created") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                            data-testid="marketing-audience-feedback"
                          >
                            {audienceFeedback}
                          </p>
                        ) : null}
                      </div>
                    </form>
                  </SectionCard>
                  {audienceEditDraft ? (
                    <div ref={audienceEditorPanelRef} tabIndex={-1}>
                      <SectionCard
                        title="List editor"
                        subtitle={
                          editingAudience
                            ? `Editing ${editingAudience.name}. Members are stored as Lovable contact external IDs.`
                            : "Edit imported or manually created marketing lists."
                        }
                        action={
                          editingAudience ? (
                            <Pill className="bg-purple-50 text-purple-800">
                              {editingAudience.source}
                            </Pill>
                          ) : null
                        }
                      >
                        <form
                          className="grid gap-3"
                          onSubmit={(event) => void saveAudienceEdit(event)}
                          data-testid="marketing-audience-editor-form"
                        >
                          <div className="grid gap-3 xl:grid-cols-[1fr_180px_1fr]">
                            <Field label="List name">
                              <input
                                className={inputClass}
                                value={audienceEditDraft.name}
                                onChange={(event) =>
                                  setAudienceEditDraft((draft) =>
                                    draft
                                      ? { ...draft, name: event.target.value }
                                      : draft,
                                  )
                                }
                                disabled={audienceSaving}
                                data-testid="input-marketing-edit-audience-name"
                              />
                            </Field>
                            <Field label="List type">
                              <select
                                className={inputClass}
                                value={audienceEditDraft.listType}
                                onChange={(event) =>
                                  setAudienceEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          listType: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={audienceSaving}
                                data-testid="select-marketing-edit-audience-type"
                              >
                                <option value="dynamic">dynamic</option>
                                <option value="static">static</option>
                                <option value="imported">imported</option>
                              </select>
                            </Field>
                            <Field label="Description">
                              <input
                                className={inputClass}
                                value={audienceEditDraft.description}
                                onChange={(event) =>
                                  setAudienceEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          description: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={audienceSaving}
                                data-testid="input-marketing-edit-audience-description"
                              />
                            </Field>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-2">
                            <Field label="Rules JSON">
                              <textarea
                                className={`${textareaClass} font-mono text-xs`}
                                value={audienceEditDraft.rulesText}
                                onChange={(event) =>
                                  setAudienceEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          rulesText: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={audienceSaving}
                                data-testid="textarea-marketing-edit-audience-rules"
                              />
                            </Field>
                            <Field label="Members">
                              <div
                                className="grid gap-2"
                                data-testid="marketing-edit-audience-member-picker"
                              >
                                <select
                                  className={inputClass}
                                  value=""
                                  onChange={(event) =>
                                    addAudienceEditContact(event.target.value)
                                  }
                                  disabled={
                                    audienceSaving ||
                                    audienceEditCandidateContacts.length === 0
                                  }
                                  data-testid="select-marketing-edit-audience-add-contact"
                                >
                                  <option value="">
                                    {audienceEditCandidateContacts.length
                                      ? "Add contact by name or email"
                                      : "All visible contacts are already listed"}
                                  </option>
                                  {audienceEditCandidateContacts.map(
                                    (contact) => (
                                      <option
                                        key={contact.id}
                                        value={contact.id}
                                      >
                                        {audienceContactLabel(contact)}
                                      </option>
                                    ),
                                  )}
                                </select>
                                {audienceEditMemberContacts.length ? (
                                  <div
                                    className="grid gap-2"
                                    data-testid="marketing-edit-audience-selected-members"
                                  >
                                    {audienceEditMemberContacts.map(
                                      (contact) => (
                                        <div
                                          key={contact.id}
                                          className="flex items-center justify-between gap-2 rounded-lg border border-[#eadfd5] bg-white px-3 py-2"
                                        >
                                          <span className="text-xs font-bold text-[#5b4a46]">
                                            {audienceContactLabel(contact)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeAudienceEditContact(contact)
                                            }
                                            className="text-xs font-black text-red-700"
                                            disabled={audienceSaving}
                                            data-testid={`button-marketing-remove-audience-member-${contact.id}`}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  <p className="rounded-lg bg-[#fffaf4] px-3 py-2 text-xs font-bold text-[#8b7a73]">
                                    No mapped contacts selected yet.
                                  </p>
                                )}
                                {audienceEditMemberIds.length >
                                audienceEditMemberContacts.length ? (
                                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                                    {audienceEditMemberIds.length -
                                      audienceEditMemberContacts.length}{" "}
                                    imported member ID
                                    {audienceEditMemberIds.length -
                                      audienceEditMemberContacts.length ===
                                    1
                                      ? ""
                                      : "s"}{" "}
                                    are not mapped to contacts yet and remain in
                                    the raw list below.
                                  </p>
                                ) : null}
                                <textarea
                                  className={`${textareaClass} min-h-[76px] font-mono text-xs`}
                                  value={audienceEditDraft.contactExternalIds}
                                  onChange={(event) =>
                                    setAudienceEditDraft((draft) =>
                                      draft
                                        ? {
                                            ...draft,
                                            contactExternalIds:
                                              event.target.value,
                                          }
                                        : draft,
                                    )
                                  }
                                  placeholder="contact:123&#10;contact:456"
                                  disabled={audienceSaving}
                                  data-testid="textarea-marketing-edit-audience-contact-ids"
                                />
                              </div>
                            </Field>
                          </div>
                          <div className="grid gap-3 xl:grid-cols-2">
                            <Field label="Source">
                              <input
                                className={inputClass}
                                value={audienceEditDraft.source}
                                onChange={(event) =>
                                  setAudienceEditDraft((draft) =>
                                    draft
                                      ? { ...draft, source: event.target.value }
                                      : draft,
                                  )
                                }
                                disabled={audienceSaving}
                                data-testid="input-marketing-edit-audience-source"
                              />
                            </Field>
                            <Field label="Lovable ID">
                              <input
                                className={inputClass}
                                value={audienceEditDraft.lovableExternalId}
                                onChange={(event) =>
                                  setAudienceEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          lovableExternalId: event.target.value,
                                        }
                                      : draft,
                                  )
                                }
                                disabled={audienceSaving}
                                data-testid="input-marketing-edit-audience-lovable-id"
                              />
                            </Field>
                          </div>
                          <Field label="List metadata JSON">
                            <textarea
                              className={`${textareaClass} min-h-[130px] font-mono text-xs`}
                              value={audienceEditDraft.metadataText}
                              onChange={(event) =>
                                setAudienceEditDraft((draft) =>
                                  draft
                                    ? {
                                        ...draft,
                                        metadataText: event.target.value,
                                      }
                                    : draft,
                                )
                              }
                              disabled={audienceSaving}
                              data-testid="textarea-marketing-edit-audience-metadata"
                            />
                          </Field>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="submit"
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                              disabled={audienceSaving}
                              data-testid="button-marketing-save-audience"
                            >
                              <Save size={16} />{" "}
                              {audienceSaving ? "Saving..." : "Save list"}
                            </button>
                            {editingAudience ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteAudience(editingAudience)
                                }
                                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingAudienceDeleteId === editingAudience.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                                disabled={audienceSaving}
                                data-testid="button-marketing-delete-editing-audience"
                              >
                                <Trash2 size={16} />{" "}
                                {confirmingAudienceDeleteId ===
                                editingAudience.id
                                  ? "Confirm delete"
                                  : "Delete"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={cancelAudienceEdit}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-4 font-black text-[#241133] disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                              disabled={audienceSaving}
                              data-testid="button-marketing-cancel-audience"
                            >
                              <X size={16} /> Close
                            </button>
                            {audienceFeedback ? (
                              <p
                                className={`rounded-xl px-4 py-3 text-sm font-bold ${audienceFeedback.toLowerCase().includes("updated") || audienceFeedback.toLowerCase().includes("deleted") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                                data-testid="marketing-audience-editor-feedback"
                              >
                                {audienceFeedback}
                              </p>
                            ) : null}
                          </div>
                        </form>
                      </SectionCard>
                    </div>
                  ) : null}
                  <SectionCard
                    title="Lists"
                    subtitle={`${visibleAudiences.length} visible of ${audiences.length} imported lists.`}
                  >
                    <div
                      className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                      data-testid="marketing-audiences-list"
                    >
                      {visibleAudiences.length === 0 ? (
                        <EmptyState text="No imported lists match the filters." />
                      ) : (
                        visibleAudiences.map((audience) => {
                          const unmappedCount =
                            audience.unmappedContactExternalIds.length;
                          const mappedContacts = contacts
                            .filter((contact) =>
                              contactMatchesMemberIds(
                                contact,
                                audience.contactExternalIds,
                              ),
                            )
                            .map((contact) => ({
                              id: contact.id,
                              fullName: contact.fullName,
                              email: contact.email,
                              phoneNumber: contact.phoneNumber,
                              whatsappNumber: contact.whatsappNumber,
                              companyName: contact.companyName,
                              roleLabel: contact.roleLabel,
                              lovableExternalId: contact.lovableExternalId,
                              contactExternalId: audienceContactExternalId(
                                contact,
                                audience.contactExternalIds,
                              ),
                            }));
                          const mappedMemberById = new Map<
                            string,
                            (typeof mappedContacts)[number]
                          >();
                          for (const member of audience.memberPreview) {
                            mappedMemberById.set(
                              member.contactExternalId ??
                                member.lovableExternalId ??
                                member.id,
                              member,
                            );
                          }
                          for (const member of mappedContacts) {
                            mappedMemberById.set(
                              member.contactExternalId ??
                                member.lovableExternalId ??
                                member.id,
                              member,
                            );
                          }
                          const listMembers = Array.from(
                            mappedMemberById.values(),
                          ).map((member) => ({
                            member,
                            contact:
                              contacts.find((contact) =>
                                contactMatchesMemberIds(
                                  contact,
                                  [
                                    member.contactExternalId,
                                    member.lovableExternalId,
                                    member.id,
                                  ].filter((value): value is string =>
                                    Boolean(value),
                                  ),
                                ),
                              ) ?? null,
                          }));
                          const audienceExpanded =
                            expandedAudienceMemberIds.has(audience.id);
                          const visibleListMembers = audienceExpanded
                            ? listMembers
                            : listMembers.slice(0, 5);
                          const visibleUnmappedIds = audienceExpanded
                            ? audience.unmappedContactExternalIds
                            : audience.unmappedContactExternalIds.slice(0, 3);
                          const hiddenListMemberCount = Math.max(
                            listMembers.length - visibleListMembers.length,
                            0,
                          );
                          const hiddenUnmappedCount = Math.max(
                            unmappedCount - visibleUnmappedIds.length,
                            0,
                          );
                          const canExpandMembers =
                            hiddenListMemberCount > 0 ||
                            hiddenUnmappedCount > 0 ||
                            audienceExpanded;
                          const timelineParts = recordTimelineParts(audience);
                          return (
                            <div
                              key={audience.id}
                              className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-black">{audience.name}</p>
                                  <p className="mt-1 text-xs font-bold text-[#7d6b65]">
                                    {audience.description ||
                                      `${audience.listType} list`}
                                  </p>
                                </div>
                                <Pill className="bg-purple-50 text-purple-800">
                                  {audience.source}
                                </Pill>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <Pill className="bg-blue-50 text-blue-800">
                                  {audience.memberCount} members
                                </Pill>
                                <Pill className="bg-emerald-50 text-emerald-800">
                                  {audience.mappedMemberCount} mapped
                                </Pill>
                                {unmappedCount ? (
                                  <Pill className="bg-amber-50 text-amber-800">
                                    {unmappedCount} unmapped
                                  </Pill>
                                ) : null}
                                {timelineParts.map((part) => (
                                  <Pill
                                    key={part}
                                    className="bg-white text-[#7d6b65]"
                                  >
                                    {part}
                                  </Pill>
                                ))}
                              </div>
                              {unmappedCount ? (
                                <p className="mt-2 break-all text-xs font-semibold text-[#8b5d13]">
                                  Unmapped{" "}
                                  {audienceExpanded ? "IDs" : "examples"}:{" "}
                                  {visibleUnmappedIds.join(", ")}
                                  {hiddenUnmappedCount
                                    ? `, +${hiddenUnmappedCount} more`
                                    : ""}
                                </p>
                              ) : null}
                              {listMembers.length ? (
                                <div
                                  className="mt-3 grid gap-2"
                                  data-testid={`marketing-audience-member-preview-${audience.id}`}
                                >
                                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                                    List member preview
                                  </p>
                                  {visibleListMembers.map(
                                    ({ member, contact }) => {
                                      const contactLine =
                                        member.email ||
                                        member.whatsappNumber ||
                                        member.phoneNumber ||
                                        member.contactExternalId ||
                                        "No channel";
                                      const roleLine = [
                                        member.roleLabel,
                                        member.companyName,
                                      ]
                                        .filter(Boolean)
                                        .join(" at ");
                                      return (
                                        <div
                                          key={`${member.id}-${member.contactExternalId ?? ""}`}
                                          className="rounded-lg border border-[#eadfd5] bg-white px-3 py-2"
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                              <p className="font-black text-[#241133]">
                                                {member.fullName || contactLine}
                                              </p>
                                              {roleLine ? (
                                                <p className="mt-0.5 text-xs font-bold text-[#7d6b65]">
                                                  {roleLine}
                                                </p>
                                              ) : null}
                                              <p className="mt-0.5 break-all text-xs font-semibold text-[#8b7a73]">
                                                {contactLine}
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-1.5">
                                              <Pill
                                                className={
                                                  contact
                                                    ? "bg-emerald-50 text-emerald-800"
                                                    : "bg-amber-50 text-amber-800"
                                                }
                                              >
                                                {contact
                                                  ? "Mapped"
                                                  : "Imported only"}
                                              </Pill>
                                              {contact ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    startContactEdit(contact)
                                                  }
                                                  className="inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-purple-200 bg-white px-2 text-xs font-black text-purple-700"
                                                  data-testid={`button-marketing-open-audience-member-contact-${audience.id}-${contact.id}`}
                                                >
                                                  <ExternalLink size={12} />{" "}
                                                  Open contact
                                                </button>
                                              ) : null}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                  {hiddenListMemberCount ? (
                                    <Pill className="w-fit bg-[#f5eee8] text-[#7d6b65]">
                                      +{hiddenListMemberCount} more list members
                                    </Pill>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="mt-3 rounded-lg bg-[#f5eee8] px-3 py-2 text-xs font-bold text-[#8b7a73]">
                                  No imported list members to preview yet.
                                </p>
                              )}
                              {canExpandMembers ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedAudienceMemberIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(audience.id))
                                        next.delete(audience.id);
                                      else next.add(audience.id);
                                      return next;
                                    })
                                  }
                                  className="mt-3 inline-flex min-h-8 items-center justify-center rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-700"
                                  data-testid={`button-marketing-toggle-audience-members-${audience.id}`}
                                >
                                  {audienceExpanded
                                    ? "Collapse members"
                                    : "Show all members"}
                                </button>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => startAudienceEdit(audience)}
                                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                                  disabled={audienceSaving}
                                  data-testid={`button-marketing-edit-audience-${audience.id}`}
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteAudience(audience)}
                                  className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] ${confirmingAudienceDeleteId === audience.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                                  disabled={audienceSaving}
                                  data-testid={`button-marketing-delete-audience-${audience.id}`}
                                >
                                  <Trash2 size={13} />{" "}
                                  {confirmingAudienceDeleteId === audience.id
                                    ? "Confirm delete"
                                    : "Delete"}
                                </button>
                                {confirmingAudienceDeleteId === audience.id ? (
                                  <p
                                    className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800"
                                    data-testid={`marketing-audience-delete-confirmation-${audience.id}`}
                                  >
                                    Click Confirm delete to remove this list and
                                    membership rows.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </SectionCard>
                </>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div
              className="grid gap-4 xl:grid-cols-[1fr_0.9fr]"
              data-testid="marketing-settings-tab"
            >
              <SectionCard
                title="Lovable sync"
                subtitle="One-way import into VYVA. Nothing is written back to Lovable."
                action={
                  <Pill
                    className={
                      syncState.configured
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    }
                  >
                    {syncState.configured ? "Configured" : "Not configured"}
                  </Pill>
                }
              >
                <div className="grid gap-3">
                  <div className="rounded-xl bg-[#fffaf4] p-4">
                    <p className="text-sm font-bold text-[#7d6b65]">Mode</p>
                    <p className="font-black">{syncState.mode}</p>
                    <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                      Endpoint:{" "}
                      {syncState.apiUrl ?? "Default Lovable export endpoint"}
                    </p>
                    <details
                      className="mt-3 rounded-xl border border-[#eadfd5] bg-white p-3 text-xs font-bold text-[#7d6b65]"
                      data-testid="marketing-sync-env-diagnostics"
                    >
                      <summary className="cursor-pointer text-sm font-black text-[#2f2135]">
                        Server configuration
                      </summary>
                      {syncDiagnostics ? (
                        <div className="mt-2 grid gap-1">
                          <p>
                            Endpoint source:{" "}
                            {syncDiagnostics.apiUrlSource ?? "unknown"}
                            {syncDiagnostics.hasDefaultEndpoint
                              ? " (built-in default)"
                              : ""}
                          </p>
                          <p>
                            Bearer token available:{" "}
                            {yesNo(syncDiagnostics.hasBearerToken)}
                          </p>
                          <p>
                            VYVA_MARKETING_EXPORT_TOKEN:{" "}
                            {yesNo(
                              tokenAliasPresent.VYVA_MARKETING_EXPORT_TOKEN,
                            )}
                          </p>
                          <p>
                            LOVABLE_MARKETING_API_KEY:{" "}
                            {yesNo(tokenAliasPresent.LOVABLE_MARKETING_API_KEY)}
                          </p>
                          <p>
                            VYVA_MARKETING_EXPORT_URL:{" "}
                            {yesNo(urlAliasPresent.VYVA_MARKETING_EXPORT_URL)}
                          </p>
                          <p>
                            LOVABLE_MARKETING_API_URL:{" "}
                            {yesNo(urlAliasPresent.LOVABLE_MARKETING_API_URL)}
                          </p>
                          <p>
                            Token source:{" "}
                            {syncDiagnostics.tokenSource ?? "none"}
                          </p>
                          <p>
                            Sync API build:{" "}
                            {syncState.backendBuild ?? "unavailable"}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-red-700">
                          Sync configuration status is unavailable. A marketing
                          data request may have failed before this status
                          loaded, or the deployment may still be running an
                          older backend bundle.
                        </p>
                      )}
                    </details>
                    <details
                      className="mt-3 rounded-xl border border-[#eadfd5] bg-white p-3"
                      data-testid="marketing-email-scheduler-status"
                    >
                      <summary className="cursor-pointer text-sm font-black text-[#2f2135]">
                        Scheduled email automation
                      </summary>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Pill
                          className={
                            emailScheduler.enabled
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-amber-50 text-amber-800"
                          }
                        >
                          {emailScheduler.enabled ? "Enabled" : "Disabled"}
                        </Pill>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                        {emailScheduler.enabled
                          ? `Runs every ${emailScheduler.intervalMinutes} min after a ${emailScheduler.initialDelaySeconds}s startup delay.`
                          : "Manual Run due emails button only. Set MARKETING_EMAIL_SCHEDULER_ENABLED=true to automate scheduled email campaigns."}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#8b7a73]">
                        Actor: {emailScheduler.actor}
                      </p>
                    </details>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={exportPreviewButtonDisabled}
                      onClick={() => void previewLovableExport()}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-4 font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                      data-testid="button-marketing-preview-export"
                    >
                      <Eye size={16} />{" "}
                      {exportPreviewRunning
                        ? "Checking export..."
                        : "Check Lovable export"}
                    </button>
                    <button
                      type="button"
                      disabled={syncButtonDisabled}
                      onClick={() => void runLovableSync()}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                      data-testid="button-marketing-run-sync"
                    >
                      <RefreshCw
                        size={16}
                        className={syncRunning ? "animate-spin" : ""}
                      />{" "}
                      {syncRunning ? "Running sync..." : "Run one-way sync"}
                    </button>
                  </div>
                  {exportPreviewFeedback ? (
                    <p
                      className={`rounded-xl px-4 py-3 text-sm font-bold ${exportPreviewFeedbackIsError ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}
                      data-testid="marketing-export-preview-feedback"
                    >
                      {exportPreviewFeedback}
                    </p>
                  ) : null}
                  {exportPreview ? (
                    <LovableExportPreviewDiagnostics preview={exportPreview} />
                  ) : null}
                  {syncFeedbackText ? (
                    <p
                      className={`rounded-xl px-4 py-3 text-sm font-bold ${syncFeedbackIsError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                      data-testid="marketing-sync-feedback"
                    >
                      {syncFeedbackText}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    {syncRuns.length === 0 ? (
                      <EmptyState text="No Lovable sync runs yet." />
                    ) : (
                      syncRuns.map((run) => (
                        <details
                          key={run.id}
                          className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3"
                        >
                          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 marker:hidden">
                            <Pill className={statusClass(run.status)}>
                              {run.status}
                            </Pill>
                            <span className="text-xs font-bold text-[#7d6b65]">
                              {formatDate(run.createdAt)}
                            </span>
                          </summary>
                          {run.error ? (
                            <p className="mt-2 text-sm font-bold text-red-700">
                              {run.error}
                            </p>
                          ) : null}
                          <SyncRunDiagnostics run={run} />
                        </details>
                      ))
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Publishing channels"
                subtitle="Email can send now. Social channels are manual planning until provider apps are connected."
              >
                <div className="grid gap-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Pill className={channelClass("email")}>Email</Pill>
                      <Pill className="bg-emerald-100 text-emerald-800">
                        Ready to send
                      </Pill>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-emerald-900">
                      Sends through the existing VYVA communications dispatcher
                      and Resend.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Pill className={channelClass("whatsapp")}>WhatsApp</Pill>
                      <Pill className="bg-amber-50 text-amber-800">
                        Planning only
                      </Pill>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                      Plan WhatsApp routes here. Direct sends still need approved
                      templates and consent controls.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Pill className="bg-sky-50 text-sky-700">Social</Pill>
                      <Pill className="bg-blue-50 text-blue-800">
                        Manual posting
                      </Pill>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                      Plan Facebook, Instagram, LinkedIn, and TikTok here.
                      Direct posting is off until each provider is approved and
                      connected.
                    </p>
                  </div>
                </div>
                <details className="mt-4 rounded-xl border border-[#eadfd5] bg-white p-3">
                  <summary className="cursor-pointer text-sm font-bold text-[#6d28d9]">
                    Future direct posting setup
                  </summary>
                  <div className="mt-3 grid gap-2">
                    {socialPublishing.providers.map((provider) => {
                      const providerChannels = provider.channels
                        .map((channel) => channelLabel[channel])
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <div
                          key={provider.id}
                          className="flex items-center justify-between gap-3 rounded-lg bg-[#fffaf4] px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-bold text-[#24112f]">
                              {provider.name}
                            </p>
                            <p className="text-xs font-semibold text-[#7d6b65]">
                              {providerChannels || "No channels"}
                            </p>
                          </div>
                          <Pill
                            className={
                              provider.connectionReady
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-stone-100 text-stone-700"
                            }
                          >
                            {provider.connectionReady
                              ? "Credential saved"
                              : "Not connected"}
                          </Pill>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </SectionCard>

              <SectionCard
                title="Social publishing"
                subtitle="Plan posts now. Publishing starts only after provider accounts are connected."
              >
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#eadfd5] bg-[#fffaf4] p-4">
                    <div>
                      <h3 className="text-base font-black text-[#2f173d]">
                        Meta Business
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-[#6f5b55]">
                        Facebook Page and Instagram Business publishing.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill className={metaProvider?.connectionReady ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}>
                        {metaProvider?.connectionReady ? "Connected" : "Setup needed"}
                      </Pill>
                      {metaProvider?.connectionReady ? (
                        <button
                          type="button"
                          onClick={verifyMeta}
                          disabled={metaConnectionBusy}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#eadfd5] bg-white px-3 py-2 text-sm font-black text-[#2f173d] hover:border-purple-300 disabled:cursor-wait disabled:opacity-60"
                        >
                          <CheckCircle2 size={15} />
                          {metaConnectionBusy ? "Checking..." : "Verify"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={connectMeta}
                        disabled={!metaProvider?.connectionConfigured}
                        className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-3 py-2 text-sm font-black text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                      >
                        <ExternalLink size={15} />
                        {metaProvider?.connectionReady ? "Reconnect Meta" : "Connect Meta"}
                      </button>
                    </div>
                  </div>

                  {!metaProvider?.connectionConfigured ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                      Meta OAuth is not configured on the Admin deployment yet. Add
                      <span className="mx-1 font-black">META_APP_ID</span> and
                      <span className="mx-1 font-black">META_APP_SECRET</span> to
                      the service serving <span className="font-black">v2.vyva.life</span>,
                      then refresh this page.
                    </div>
                  ) : null}

                  {metaConnections.length ? (
                    <div className="grid gap-2">
                      {metaConnections.map((connection) => (
                        <div
                          key={connection.id}
                          className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-3 text-sm"
                        >
                          <p className="font-black text-emerald-950">{connection.accountName}</p>
                          <p className="mt-1 font-semibold text-emerald-900">
                            Facebook Page connected
                            {connection.instagramUsername
                              ? ` · Instagram @${connection.instagramUsername}`
                              : connection.instagramBusinessAccountId
                                ? " · Instagram Business account linked"
                                : " · No linked Instagram Business account found"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    {(["linkedin", "tiktok"] as const).map((channel) => (
                      <div
                        key={`social-setup-${channel}`}
                        className="rounded-xl border border-[#eadfd5] bg-white p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-black text-[#2f173d]">
                            {channelLabel[channel]}
                          </h3>
                          <Pill className="bg-blue-50 text-blue-800">
                            Planning only
                          </Pill>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[#6f5b55]">
                          Keep posts as planning records until this provider is
                          connected.
                        </p>
                      </div>
                    ))}
                  </div>

                  <details className="rounded-lg border border-[#eadfd5] bg-white px-4 py-3 text-sm font-bold text-[#6f5b55]">
                    <summary className="cursor-pointer text-[#2f173d]">
                      What is needed to enable publishing?
                    </summary>
                    <div className="mt-3 grid gap-2">
                      <p>1. Connect the brand's provider account.</p>
                      <p>2. Choose which pages/profiles VYVA can publish to.</p>
                      <p>3. Add a review step before posts are sent.</p>
                    </div>
                  </details>
                </div>
              </SectionCard>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function LovableExportPreviewDiagnostics({
  preview,
}: {
  preview: LovableExportPreview;
}) {
  const exported = syncCountItems(preview.summary, "exported");
  const contentSourceCounts = Object.entries(
    recordValue(preview.summary.contentSourceCounts),
  )
    .map(([key, value]) => ({ key, value: numberValue(value) }))
    .filter((item) => item.value > 0);
  const fieldCoverage = syncFieldCoverageItems(preview.summary);
  const sampleRows = Object.fromEntries(
    Object.entries(recordValue(preview.samples)).filter(
      ([, value]) => Array.isArray(value) && value.length > 0,
    ),
  );
  const rawArraySamples = Object.fromEntries(
    Object.entries(recordValue(preview.rawArraySamples)).filter(
      ([, value]) => Array.isArray(value) && value.length > 0,
    ),
  );

  return (
    <div
      className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold text-blue-950"
      data-testid="marketing-export-preview"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="uppercase tracking-[0.12em] text-blue-800">
            Lovable export preview
          </p>
          <p className="mt-1 text-sm font-black">
            Dataset: {preview.dataset || "unknown"}
          </p>
          {preview.exportedAt ? (
            <p className="mt-1 text-xs font-semibold">
              Exported at {formatDate(preview.exportedAt)}
            </p>
          ) : null}
        </div>
        <Pill className="bg-white text-blue-800">Preview only</Pill>
      </div>
      {exported.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-blue-800">
            Available to import
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {exported.map((item) => (
              <Pill
                key={`preview-exported-${item.key}`}
                className="bg-white text-blue-800"
              >
                {item.label}: {item.value}
              </Pill>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-white p-3 text-sm font-black text-amber-800">
          Lovable returned no recognized marketing rows.
        </p>
      )}
      {contentSourceCounts.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-blue-800">
            Content source buckets
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {contentSourceCounts.map((item) => (
              <Pill key={item.key} className="bg-white text-purple-800">
                {item.key}: {item.value}
              </Pill>
            ))}
          </div>
        </div>
      ) : null}
      {preview.topLevelKeys.length ? (
        <p className="rounded-lg bg-white p-3 font-semibold text-[#5b4a46]">
          Top-level export keys: {preview.topLevelKeys.slice(0, 18).join(", ")}
          {preview.topLevelKeys.length > 18
            ? `, +${preview.topLevelKeys.length - 18} more`
            : ""}
        </p>
      ) : null}
      {fieldCoverage.length ? (
        <div>
          <p className="uppercase tracking-[0.12em] text-blue-800">
            Field coverage before import
          </p>
          <div className="mt-1 grid gap-1.5">
            {fieldCoverage.map((item) => (
              <div key={item.entity} className="rounded-lg bg-white px-3 py-2">
                <p className="font-black text-[#241133]">
                  {item.entity}: {item.firstClass} of {item.exported} fields
                  mapped first-class
                </p>
                {item.firstClassFields.length ? (
                  <p className="mt-1 font-semibold text-emerald-800">
                    Mapped: {item.firstClassFields.slice(0, 8).join(", ")}
                    {item.firstClassFields.length > 8
                      ? ` +${item.firstClassFields.length - 8}`
                      : ""}
                  </p>
                ) : null}
                {item.metadataOnly ? (
                  <p className="mt-1 font-semibold">
                    Metadata-only:{" "}
                    {item.metadataOnlyFields.slice(0, 6).join(", ")}
                    {item.metadataOnlyFields.length > 6
                      ? ` +${item.metadataOnlyFields.length - 6}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-1 font-semibold text-emerald-800">
                    All exported fields are mapped first-class.
                  </p>
                )}
                {item.exportedFields.length ||
                item.firstClassFields.length ||
                item.metadataOnlyFields.length ? (
                  <details
                    className="mt-2 rounded-lg border border-[#eadfd5] bg-blue-50 p-2"
                    data-testid={`marketing-export-field-coverage-${item.entity}`}
                  >
                    <summary className="cursor-pointer font-black text-[#241133]">
                      View full field map
                    </summary>
                    <div className="mt-2 grid gap-2">
                      {item.metadataOnlyFields.length ? (
                        <p>
                          <span className="text-amber-800">Metadata-only:</span>{" "}
                          {item.metadataOnlyFields.join(", ")}
                        </p>
                      ) : null}
                      {item.firstClassFields.length ? (
                        <p>
                          <span className="text-emerald-800">
                            Mapped first-class:
                          </span>{" "}
                          {item.firstClassFields.join(", ")}
                        </p>
                      ) : null}
                      {item.exportedFields.length ? (
                        <p>
                          <span className="text-blue-800">All exported:</span>{" "}
                          {item.exportedFields.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <LovableDestinationMap summary={preview.summary} />
      <MetadataPanel
        title="Recognized sample rows from Lovable"
        value={sampleRows}
        testId="marketing-export-preview-samples"
      />
      <MetadataPanel
        title="Raw top-level Lovable array samples"
        value={rawArraySamples}
        testId="marketing-export-preview-raw-samples"
      />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-4 text-center text-sm font-bold text-[#8b7a73]">
      {text}
    </p>
  );
}

function CampaignPerformanceSummary({
  summary,
  testId,
}: {
  summary?: CampaignMetricSummary | null;
  testId: string;
}) {
  if (!summary || summary.metricCount === 0) {
    return (
      <div className="grid gap-1" data-testid={testId}>
        <Pill className="w-fit bg-[#f5eee8] text-[#7d6b65]">
          No imported metrics
        </Pill>
      </div>
    );
  }

  return (
    <div className="grid min-w-[170px] gap-1.5" data-testid={testId}>
      <div className="flex flex-wrap gap-1.5">
        <Pill className="bg-blue-50 text-blue-800">{summary.sent} sent</Pill>
        <Pill className="bg-emerald-50 text-emerald-800">
          {summary.delivered} delivered
        </Pill>
        <Pill className="bg-purple-50 text-purple-800">
          {summary.opened} opened
        </Pill>
        <Pill className="bg-amber-50 text-amber-800">
          {summary.clicked} clicked
        </Pill>
      </div>
      <p className="text-xs font-bold text-[#8b7a73]">
        {summary.metricCount} snapshot{summary.metricCount === 1 ? "" : "s"}
        {summary.channels.length ? ` / ${summary.channels.join(", ")}` : ""}
      </p>
      {summary.latestMetricDate ? (
        <p className="text-xs font-bold text-[#8b7a73]">
          Latest {formatDate(summary.latestMetricDate)}
        </p>
      ) : null}
    </div>
  );
}

function CampaignPerformanceInlineSummary({
  summary,
  testId,
}: {
  summary?: CampaignMetricSummary | null;
  testId: string;
}) {
  if (!summary || summary.metricCount === 0) {
    return (
      <span className="block" data-testid={testId}>
        <Pill className="w-fit bg-[#f5eee8] text-[#7d6b65]">
          No imported metrics
        </Pill>
      </span>
    );
  }

  return (
    <span className="block" data-testid={testId}>
      <span className="flex flex-wrap gap-1.5">
        <Pill className="bg-blue-50 text-blue-800">{summary.sent} sent</Pill>
        <Pill className="bg-purple-50 text-purple-800">
          {summary.opened} opened
        </Pill>
        <Pill className="bg-amber-50 text-amber-800">
          {summary.clicked} clicked
        </Pill>
      </span>
      <span className="mt-1 block text-xs font-bold text-[#8b7a73]">
        {summary.metricCount} snapshot{summary.metricCount === 1 ? "" : "s"}
      </span>
    </span>
  );
}

function CampaignTable({
  campaigns,
  contentById = new Map<string, ContentAsset>(),
  contentTitleById = new Map<string, string>(),
  metricsByCampaignId = new Map<string, CampaignMetricSummary>(),
  audiences = [],
  activeCampaignId,
  onEdit,
  onDelete,
  onPreviewContent,
  onEditContent,
  actionsDisabled = false,
  confirmingDeleteId = null,
}: {
  campaigns: Campaign[];
  contentById?: ReadonlyMap<string, ContentAsset>;
  contentTitleById?: ReadonlyMap<string, string>;
  metricsByCampaignId?: ReadonlyMap<string, CampaignMetricSummary>;
  audiences?: MarketingAudience[];
  activeCampaignId?: string | null;
  onEdit?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  onPreviewContent?: (contentAsset: ContentAsset) => void;
  onEditContent?: (contentAsset: ContentAsset) => void;
  actionsDisabled?: boolean;
  confirmingDeleteId?: string | null;
}) {
  const showActions = Boolean(onEdit || onDelete);
  void metricsByCampaignId;
  return (
    <div
      className="overflow-x-auto rounded-xl border border-[#eadfd5]"
      data-testid="marketing-campaign-table"
    >
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
          <tr>
            <th className="w-[30%] px-4 py-3">Campaign</th>
            <th className="w-[16%] px-4 py-3">Target</th>
            <th className="w-[18%] px-4 py-3">Channels</th>
            <th className="w-[14%] px-4 py-3">Schedule</th>
            <th className="w-[12%] px-4 py-3">Status</th>
            <th className="w-[10%] px-4 py-3 text-right">Recipients</th>
            {showActions ? (
              <th className="sticky right-0 z-20 w-[120px] border-l border-[#eadfd5] bg-[#fbf8f5] px-4 py-3 shadow-[-10px_0_18px_rgba(36,17,51,0.06)]">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr>
              <td
                colSpan={showActions ? 7 : 6}
                className="px-4 py-6 text-center font-bold text-[#8b7a73]"
              >
                No campaigns match the filters.
              </td>
            </tr>
          ) : (
            campaigns.map((campaign) => {
              const isActive = activeCampaignId === campaign.id;
              const deleteIsArmed = confirmingDeleteId === campaign.id;
              const targetAudience = campaignTargetAudience(
                campaign,
                audiences,
              );
              return (
                <tr
                  key={campaign.id}
                  className={`border-t border-[#f0e7df] ${onEdit && !actionsDisabled ? "cursor-pointer hover:bg-purple-50" : ""} ${isActive ? "bg-purple-50" : ""}`}
                  onClick={
                    onEdit && !actionsDisabled
                      ? () => onEdit(campaign)
                      : undefined
                  }
                  onKeyDown={
                    onEdit && !actionsDisabled
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onEdit(campaign);
                          }
                        }
                      : undefined
                  }
                  role={onEdit && !actionsDisabled ? "button" : undefined}
                  tabIndex={onEdit && !actionsDisabled ? 0 : undefined}
                  aria-selected={isActive || undefined}
                  data-testid={`row-marketing-campaign-${campaign.id}`}
                >
                  <td className="max-w-[260px] px-4 py-3">
                    <p className="truncate font-black text-[#241133]">
                      {campaign.name}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#8b7a73]">
                      {campaign.source}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-black text-[#241133]">
                      {campaign.audienceType.toUpperCase()}
                    </p>
                    {targetAudience ? (
                      <p
                        className="mt-1 truncate text-xs font-bold text-purple-800"
                        data-testid={`marketing-campaign-target-list-${campaign.id}`}
                      >
                        {targetAudience.name}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-bold text-[#8b7a73]">
                        All eligible contacts
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[260px] flex-wrap gap-1.5">
                      {campaign.channels.length === 0 ? (
                        <span className="text-xs font-bold text-[#8b7a73]">
                          No channels
                        </span>
                      ) : (
                        campaign.channels.map((item) => {
                          const linkedContent = item.contentAssetId
                            ? (contentById.get(item.contentAssetId) ?? null)
                            : null;
                          const contentTitle =
                            linkedContent?.title ||
                            (item.contentAssetId
                              ? contentTitleById.get(item.contentAssetId)
                              : "");
                          return (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center gap-1"
                              data-testid={`marketing-campaign-channel-link-${item.id}`}
                            >
                              <Pill className={channelClass(item.channel)}>
                                {channelLabel[item.channel]}
                              </Pill>
                              {contentTitle ? (
                                <span className="max-w-[190px] truncate text-xs font-black text-[#5b4a46]">
                                  {contentTitle}
                                </span>
                              ) : item.contentAssetId ? (
                                <span className="max-w-[190px] truncate text-xs font-black text-amber-800">
                                  Missing content
                                </span>
                              ) : null}
                              {linkedContent && onPreviewContent ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onPreviewContent(linkedContent);
                                  }}
                                  disabled={actionsDisabled}
                                  className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-purple-200 bg-white px-2 text-[11px] font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                                  data-testid={`button-marketing-preview-campaign-content-${item.id}`}
                                >
                                  <Eye size={11} /> Preview
                                </button>
                              ) : null}
                              {linkedContent && onEditContent ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onEditContent(linkedContent);
                                  }}
                                  disabled={actionsDisabled}
                                  className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-purple-200 bg-white px-2 text-[11px] font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                                  data-testid={`button-marketing-edit-campaign-content-${item.id}`}
                                >
                                  <Pencil size={11} /> Edit
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#7d6b65]">
                    <p>{formatDate(campaign.scheduleStartsAt)}</p>
                    {campaign.scheduleEndsAt ? (
                      <p className="text-xs">
                        Ends {formatDate(campaign.scheduleEndsAt)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Pill className={statusClass(campaign.status)}>
                      {campaign.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-right font-black">
                    {campaign.recipientCount}
                  </td>
                  {showActions ? (
                    <td
                      className={`sticky right-0 z-10 w-[120px] border-l border-[#eadfd5] px-4 py-3 shadow-[-10px_0_18px_rgba(36,17,51,0.05)] ${isActive || deleteIsArmed ? "bg-purple-50" : "bg-white"}`}
                    >
                      <div className="flex w-[88px] flex-col gap-2">
                        {onEdit ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEdit(campaign);
                            }}
                            disabled={actionsDisabled}
                            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
                            title="Edit campaign"
                            data-testid={`button-marketing-edit-campaign-${campaign.id}`}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(campaign);
                            }}
                            disabled={actionsDisabled}
                            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-[#f5eee8] disabled:text-red-300 ${deleteIsArmed ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                            title={
                              deleteIsArmed
                                ? "Confirm delete"
                                : "Delete campaign"
                            }
                            data-testid={`button-marketing-delete-campaign-${campaign.id}`}
                          >
                            <Trash2 size={14} />{" "}
                            {deleteIsArmed ? "Confirm" : "Delete"}
                          </button>
                        ) : null}
                        {deleteIsArmed ? (
                          <p
                            className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800"
                            data-testid={`marketing-campaign-delete-confirmation-${campaign.id}`}
                          >
                            Click Confirm delete to remove this campaign, its
                            channels, and recipient snapshots.
                          </p>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function MarketingCalendarView({
  campaigns,
  audiences = [],
  onEdit,
  onDelete,
  confirmingDeleteId = null,
}: {
  campaigns: Campaign[];
  audiences?: MarketingAudience[];
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  confirmingDeleteId?: string | null;
}) {
  const scheduledCampaigns = [...campaigns]
    .filter((campaign) => campaign.scheduleStartsAt)
    .sort(
      (a, b) =>
        new Date(a.scheduleStartsAt ?? 0).getTime() -
        new Date(b.scheduleStartsAt ?? 0).getTime(),
    );
  const unscheduledCampaigns = campaigns.filter(
    (campaign) => !campaign.scheduleStartsAt,
  );
  const days = scheduledCampaigns.reduce<
    Array<{ key: string; campaigns: Campaign[] }>
  >((result, campaign) => {
    const key = calendarDayKey(campaign.scheduleStartsAt);
    const existing = result.find((item) => item.key === key);
    if (existing) existing.campaigns.push(campaign);
    else result.push({ key, campaigns: [campaign] });
    return result;
  }, []);

  if (!campaigns.length)
    return <EmptyState text="No campaigns match the filters." />;

  return (
    <div
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"
      data-testid="marketing-calendar-scheduler"
    >
      <div
        className="grid content-start gap-4"
        data-testid="marketing-calendar-timeline"
      >
        {days.length === 0 ? (
          <EmptyState text="No scheduled campaigns match the filters." />
        ) : (
          days.map((day) => (
            <section
              key={day.key}
              className="overflow-hidden rounded-xl border border-[#eadfd5] bg-white"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#eadfd5] bg-[#fbf8f5] px-4 py-3">
                <h3 className="font-black text-[#241133]">
                  {formatCalendarDay(day.key)}
                </h3>
                <span className="text-xs font-bold text-[#7d6b65]">
                  {day.campaigns.length} campaign
                  {day.campaigns.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="divide-y divide-[#eadfd5]">
                {day.campaigns.map((campaign) => {
                  const targetAudience = campaignTargetAudience(
                    campaign,
                    audiences,
                  );
                  return (
                    <article
                      key={campaign.id}
                      className="grid gap-3 px-4 py-3 lg:grid-cols-[72px_minmax(0,1fr)_auto] lg:items-center"
                    >
                      <p className="flex items-center gap-2 text-sm font-black text-[#5b4a46]">
                        <Clock size={14} aria-hidden="true" />
                        {formatCalendarTime(campaign.scheduleStartsAt)}
                      </p>
                      <div className="min-w-0">
                        <h4 className="truncate font-black text-[#241133]">
                          {campaign.name}
                        </h4>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Pill className={statusClass(campaign.status)}>
                            {campaign.status}
                          </Pill>
                          <Pill className="bg-purple-50 text-purple-700">
                            {campaign.audienceType.toUpperCase()}
                          </Pill>
                          {targetAudience ? (
                            <Pill className="bg-violet-50 text-violet-800">
                              {targetAudience.name}
                            </Pill>
                          ) : null}
                          {campaign.channels.map((item) => (
                            <span
                              key={item.id}
                              data-testid={`marketing-calendar-channel-link-${item.id}`}
                            >
                              <Pill className={channelClass(item.channel)}>
                                {channelLabel[item.channel]}
                              </Pill>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => onEdit(campaign)}
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700"
                          data-testid={`button-marketing-calendar-edit-${campaign.id}`}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(campaign)}
                          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black ${confirmingDeleteId === campaign.id ? "border-red-300 bg-red-700 text-white" : "border-red-200 bg-red-50 text-red-700"}`}
                          data-testid={`button-marketing-calendar-delete-${campaign.id}`}
                        >
                          <Trash2 size={14} />{" "}
                          {confirmingDeleteId === campaign.id
                            ? "Confirm delete"
                            : "Delete"}
                        </button>
                        {confirmingDeleteId === campaign.id ? (
                          <p
                            className="basis-full rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-800"
                            data-testid={`marketing-calendar-delete-confirmation-${campaign.id}`}
                          >
                            Click Confirm delete to remove this scheduled
                            campaign.
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <aside
        className="grid content-start gap-2 rounded-xl border border-[#eadfd5] bg-white p-3"
        data-testid="marketing-calendar-unscheduled"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-[#241133]">Drafts</h3>
          <span className="text-xs font-bold text-[#7d6b65]">
            {unscheduledCampaigns.length}
          </span>
        </div>
        {unscheduledCampaigns.length === 0 ? (
          <EmptyState text="No unscheduled campaigns." />
        ) : (
          unscheduledCampaigns.map((campaign) => {
            const targetAudience = campaignTargetAudience(campaign, audiences);
            return (
              <button
                key={campaign.id}
                type="button"
                onClick={() => onEdit(campaign)}
                className="rounded-lg border border-transparent bg-[#fbf8f5] p-3 text-left transition hover:border-purple-200 hover:bg-purple-50"
                data-testid={`button-marketing-calendar-unscheduled-${campaign.id}`}
              >
                <span className="block font-black text-[#241133]">
                  {campaign.name}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <Pill className={statusClass(campaign.status)}>
                    {campaign.status}
                  </Pill>
                  <Pill className="bg-purple-50 text-purple-700">
                    {campaign.audienceType.toUpperCase()}
                  </Pill>
                  {targetAudience ? (
                    <Pill className="bg-violet-50 text-violet-800">
                      {targetAudience.name}
                    </Pill>
                  ) : null}
                  {campaign.channels.map((item) => (
                    <span
                      key={item.id}
                      data-testid={`marketing-calendar-unscheduled-channel-link-${item.id}`}
                    >
                      <Pill className={channelClass(item.channel)}>
                        {channelLabel[item.channel]}
                      </Pill>
                    </span>
                  ))}
                </span>
              </button>
            );
          })
        )}
      </aside>
    </div>
  );
}
