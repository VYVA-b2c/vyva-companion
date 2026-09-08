import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  CalendarCheck2,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Mail,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  UsersRound,
  Video,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";

type SocialStudioChannel = "email" | "whatsapp" | "facebook" | "instagram" | "linkedin" | "tiktok";
type AudienceType = "b2c" | "b2b" | "both";
type Tone = "warm" | "expert" | "direct" | "uplifting";
type ImageStyle = "warm_editorial" | "friendly_product" | "community_moment";

type AudienceOption = {
  id: string;
  name: string;
  memberCount?: number;
};

type StudioMediaAsset = {
  id: string;
  contentAssetId: string | null;
  localUrl: string | null;
  originalUrl: string;
  assetType: string;
  status: string;
  metadata?: Record<string, unknown>;
};

type StudioContent = {
  id: string;
  title: string;
  channel: SocialStudioChannel;
  language: string;
  status: string;
  subject: string | null;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  designJson?: Record<string, unknown>;
  mediaAssets?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

type ReadinessItem = {
  channel: SocialStudioChannel;
  state: "ready" | "needs_action" | "approved";
  issues: string[];
};

type StudioCampaign = {
  id: string;
  name: string;
  status: string;
  scheduleStartsAt: string | null;
  channels: Array<{ id: string; channel: SocialStudioChannel; contentAssetId: string | null; status: string }>;
};

type StudioPackage = {
  source: "openai" | "fallback";
  campaign: StudioCampaign;
  content: StudioContent[];
  mediaAssets: StudioMediaAsset[];
  readiness: ReadinessItem[];
  note?: string | null;
};

type StudioForm = {
  brief: string;
  campaignName: string;
  audienceType: AudienceType;
  targetAudienceId: string;
  language: string;
  tone: Tone;
  channels: SocialStudioChannel[];
  ctaLabel: string;
  ctaUrl: string;
  scheduledAt: string;
  generateImages: boolean;
  imageStyle: ImageStyle;
};

const CHANNELS: Array<{ value: SocialStudioChannel; label: string; detail: string; icon: typeof Mail }> = [
  { value: "email", label: "Email", detail: "Subject and body", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", detail: "Short conversation", icon: MessageCircle },
  { value: "facebook", label: "Facebook", detail: "Community post", icon: UsersRound },
  { value: "instagram", label: "Instagram", detail: "Caption and hashtags", icon: Camera },
  { value: "linkedin", label: "LinkedIn", detail: "Professional post", icon: BriefcaseBusiness },
  { value: "tiktok", label: "TikTok", detail: "Hook and shot list", icon: Video },
];

const CHANNEL_LABELS = Object.fromEntries(CHANNELS.map((item) => [item.value, item.label])) as Record<SocialStudioChannel, string>;
const inputClass = "h-11 w-full rounded-xl border border-[#E5D8CA] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const textareaClass = "min-h-[150px] w-full rounded-xl border border-[#E5D8CA] bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";

function initialForm(): StudioForm {
  return {
    brief: "",
    campaignName: "",
    audienceType: "both",
    targetAudienceId: "",
    language: "en",
    tone: "warm",
    channels: CHANNELS.map((item) => item.value),
    ctaLabel: "Open VYVA",
    ctaUrl: "https://v2.vyva.life",
    scheduledAt: "",
    generateImages: true,
    imageStyle: "warm_editorial",
  };
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(url, options);
  const body = await response.json().catch(() => null) as T & { error?: unknown } | null;
  if (!response.ok) {
    const error = body && typeof body.error === "string" ? body.error : "Request failed.";
    throw new Error(error);
  }
  return body as T;
}

function localDateToIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function studioMediaApproval(asset: StudioMediaAsset | undefined) {
  return metadataRecord(metadataRecord(asset?.metadata).socialStudio).approvalStatus === "approved";
}

function studioMediaAltText(asset: StudioMediaAsset | undefined) {
  const value = metadataRecord(metadataRecord(asset?.metadata).socialStudio).altText;
  return typeof value === "string" ? value : "";
}

function replacePackageMedia(current: StudioPackage, nextAsset: StudioMediaAsset) {
  const withoutContentAsset = current.mediaAssets.filter((asset) => asset.contentAssetId !== nextAsset.contentAssetId);
  return { ...current, mediaAssets: [...withoutContentAsset, nextAsset] };
}

function StatusPill({ state }: { state: ReadinessItem["state"] }) {
  const className = state === "approved" ? "bg-emerald-50 text-emerald-700" : state === "needs_action" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-700";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${className}`}>{state === "needs_action" ? "Needs action" : state}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-[#7d6b65]">{label}</span>
      {children}
    </label>
  );
}

function ChannelCard({
  content,
  readiness,
  mediaAsset,
  busy,
  onApproveCopy,
  onSaveCopy,
  onRegenerateCopy,
  onApproveImage,
  onRegenerateImage,
  onSaveAltText,
  onCopy,
}: {
  content: StudioContent;
  readiness: ReadinessItem;
  mediaAsset?: StudioMediaAsset;
  busy: boolean;
  onApproveCopy: () => void;
  onSaveCopy: (subject: string | null, body: string) => void;
  onRegenerateCopy: () => void;
  onApproveImage: () => void;
  onRegenerateImage: () => void;
  onSaveAltText: (altText: string) => void;
  onCopy: () => void;
}) {
  const channel = CHANNELS.find((item) => item.value === content.channel) ?? CHANNELS[0];
  const Icon = channel.icon;
  const studio = metadataRecord(metadataRecord(content.designJson).socialStudio);
  const hashtags = Array.isArray(studio.hashtags) ? studio.hashtags.map(String).join(" ") : "";
  const hook = typeof studio.hook === "string" ? studio.hook : "";
  const platformNotes = typeof studio.platformNotes === "string" ? studio.platformNotes : "";
  const videoPrompt = typeof studio.videoPrompt === "string" ? studio.videoPrompt : "";
  const imageUrl = mediaAsset?.localUrl || mediaAsset?.originalUrl || (Array.isArray(content.mediaAssets) ? String(metadataRecord(content.mediaAssets[0]).url || "") : "");
  const imageApproved = studioMediaApproval(mediaAsset);
  const isCopyApproved = content.status === "approved";
  const [editingCopy, setEditingCopy] = useState(false);
  const [draftSubject, setDraftSubject] = useState(content.subject ?? "");
  const [draftBody, setDraftBody] = useState(content.body);
  const [altText, setAltText] = useState(studioMediaAltText(mediaAsset));

  useEffect(() => {
    setAltText(studioMediaAltText(mediaAsset));
  }, [mediaAsset]);

  return (
    <article className="overflow-hidden rounded-2xl border border-[#eadfd5] bg-white shadow-sm" data-testid={`social-studio-channel-${content.channel}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0e7df] bg-[#fffaf4] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700"><Icon size={18} aria-hidden="true" /></span>
          <div>
            <h3 className="font-black text-[#241133]">{channel.label}</h3>
            <p className="mt-1 text-xs font-semibold text-[#7d6b65]">{channel.detail}</p>
          </div>
        </div>
        <StatusPill state={readiness.state} />
      </div>

      <div className="grid gap-4 p-4">
        {content.subject ? (
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-purple-800">Subject</p>
            <p className="mt-1 font-black text-[#241133]">{content.subject}</p>
          </div>
        ) : null}
        {hook ? (
          <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-800">Hook</p>
            <p className="mt-1 font-black text-sky-950">{hook}</p>
          </div>
        ) : null}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Preview copy</p>
            <div className="flex flex-wrap gap-2">
              {!editingCopy ? <button type="button" onClick={() => { setDraftSubject(content.subject ?? ""); setDraftBody(content.body); setEditingCopy(true); }} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#eadfd5] bg-white px-2.5 text-xs font-black text-purple-700" disabled={busy} data-testid={`button-social-studio-edit-${content.channel}`}><Pencil size={13} /> Edit</button> : null}
              <button type="button" onClick={onRegenerateCopy} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 text-xs font-black text-purple-800" disabled={busy} data-testid={`button-social-studio-regenerate-${content.channel}`}>
                <RefreshCw size={13} /> Regenerate
              </button>
              <button type="button" onClick={onCopy} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#eadfd5] bg-white px-2.5 text-xs font-black text-purple-700" disabled={busy} data-testid={`button-social-studio-copy-${content.channel}`}>
                <Copy size={13} /> Copy
              </button>
            </div>
          </div>
          {editingCopy ? (
            <div className="mt-2 grid gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
              {content.subject ? <input className={inputClass} value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} aria-label={`${channel.label} subject`} /> : null}
              <textarea className={textareaClass} value={draftBody} onChange={(event) => setDraftBody(event.target.value)} aria-label={`${channel.label} copy`} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { onSaveCopy(content.subject ? draftSubject : null, draftBody); setEditingCopy(false); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-purple-700 px-3 text-xs font-black text-white" disabled={busy} data-testid={`button-social-studio-save-${content.channel}`}><Check size={13} /> Save copy</button>
                <button type="button" onClick={() => setEditingCopy(false)} className="inline-flex min-h-9 items-center rounded-lg border border-[#eadfd5] bg-white px-3 text-xs font-black text-[#5b4a46]" disabled={busy}>Cancel</button>
              </div>
            </div>
          ) : <div className="mt-2 whitespace-pre-wrap rounded-xl border border-[#eadfd5] bg-[#fbf8f5] p-3 text-sm font-semibold leading-relaxed text-[#2f2135]">{content.body}</div>}
          {hashtags ? <p className="mt-2 text-sm font-black text-purple-700">{hashtags}</p> : null}
          {content.ctaLabel ? <p className="mt-2 text-xs font-black text-[#5b4a46]">CTA: {content.ctaLabel}{content.ctaUrl ? ` -> ${content.ctaUrl}` : ""}</p> : null}
          {videoPrompt ? <p className="mt-3 rounded-xl border border-pink-100 bg-pink-50 p-3 text-xs font-semibold leading-relaxed text-pink-950"><span className="font-black">Creator prompt:</span> {videoPrompt}</p> : null}
          {platformNotes ? <p className="mt-3 text-xs font-bold text-[#7d6b65]">{platformNotes}</p> : null}
        </div>

        <div className="rounded-xl border border-[#eadfd5] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Visual</p>
              <p className="mt-1 text-xs font-semibold text-[#7d6b65]">Generated separately and approved independently.</p>
            </div>
            {mediaAsset ? <StatusPill state={imageApproved ? "approved" : "needs_action"} /> : <span className="text-xs font-black text-[#8b7a73]">No image yet</span>}
          </div>
          {imageUrl && !imageUrl.startsWith("generated://") ? <img src={imageUrl} alt={studioMediaAltText(mediaAsset) || `${channel.label} VYVA campaign visual`} className="mt-3 aspect-[4/3] w-full rounded-xl border border-[#f0e7df] object-cover" /> : null}
          {mediaAsset ? (
            <div className="mt-3 grid gap-2">
              <Field label="Alt text">
                <input className={inputClass} value={altText} onChange={(event) => setAltText(event.target.value)} data-testid={`input-social-studio-alt-${content.channel}`} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onSaveAltText(altText)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#eadfd5] bg-white px-3 text-xs font-black text-purple-700" disabled={busy}><Check size={13} /> Save alt text</button>
                {!imageApproved ? <button type="button" onClick={onApproveImage} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-black text-white" disabled={busy} data-testid={`button-social-studio-approve-image-${content.channel}`}><CheckCircle2 size={13} /> Approve image</button> : null}
                <button type="button" onClick={onRegenerateImage} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-black text-purple-800" disabled={busy}><RefreshCw size={13} /> Regenerate image</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0e7df] pt-3">
          <div className="flex flex-wrap gap-1.5">{readiness.issues.map((issue) => <span key={issue} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">{issue}</span>)}</div>
          {!isCopyApproved ? <button type="button" onClick={onApproveCopy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-purple-700 px-3 text-xs font-black text-white" disabled={busy} data-testid={`button-social-studio-approve-copy-${content.channel}`}><CheckCircle2 size={13} /> Approve copy</button> : <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700"><CheckCircle2 size={14} /> Copy approved</span>}
        </div>
      </div>
    </article>
  );
}

export default function SocialStudioPanel({ audiences = [], onCreated }: { audiences?: AudienceOption[]; onCreated?: () => void | Promise<void> }) {
  const [form, setForm] = useState<StudioForm>(() => initialForm());
  const [studioPackage, setStudioPackage] = useState<StudioPackage | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const contentByChannel = useMemo(() => new Map((studioPackage?.content ?? []).map((item) => [item.channel, item])), [studioPackage?.content]);
  const mediaByContentId = useMemo(() => new Map((studioPackage?.mediaAssets ?? []).map((item) => [item.contentAssetId ?? item.id, item])), [studioPackage?.mediaAssets]);
  const readinessByChannel = useMemo(() => new Map((studioPackage?.readiness ?? []).map((item) => [item.channel, item])), [studioPackage?.readiness]);
  const allApproved = Boolean(studioPackage?.readiness.length && studioPackage.readiness.every((item) => item.state === "approved"));

  function updateForm<K extends keyof StudioForm>(key: K, value: StudioForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(channel: SocialStudioChannel) {
    setForm((current) => ({
      ...current,
      channels: current.channels.includes(channel) ? current.channels.filter((item) => item !== channel) : [...current.channels, channel],
    }));
  }

  async function refreshReadiness(campaignId: string) {
    const response = await requestJson<{ readiness: ReadinessItem[] }>(`/api/admin/marketing/social-packages/${campaignId}/readiness`);
    setStudioPackage((current) => current ? { ...current, readiness: response.readiness } : current);
  }

  async function generatePackage(event: FormEvent) {
    event.preventDefault();
    if (!form.brief.trim()) {
      setFeedback("Add a brief so VYVA knows what the campaign should achieve.");
      return;
    }
    if (!form.channels.length) {
      setFeedback("Select at least one network.");
      return;
    }
    setBusyAction("generate");
    setFeedback("Generating the campaign package...");
    try {
      const response = await requestJson<StudioPackage>("/api/admin/marketing/social-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          targetAudienceId: form.targetAudienceId || null,
          scheduledAt: localDateToIso(form.scheduledAt),
        }),
      });
      setStudioPackage(response);
      setFeedback(response.note || `Created ${response.content.length} channel drafts. Review and approve each one below.`);
      await onCreated?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "The social package could not be generated.");
    } finally {
      setBusyAction(null);
    }
  }

  async function approveCopy(content: StudioContent) {
    if (!studioPackage) return;
    setBusyAction(`approve-copy-${content.channel}`);
    try {
      const response = await requestJson<{ content: StudioContent }>(`/api/admin/marketing/social-packages/content/${content.id}/approve`, { method: "POST" });
      setStudioPackage((current) => current ? { ...current, content: current.content.map((item) => item.id === response.content.id ? response.content : item) } : current);
      await refreshReadiness(studioPackage.campaign.id);
      setFeedback(`${CHANNEL_LABELS[content.channel]} copy approved.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Copy could not be approved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveCopy(content: StudioContent, subject: string | null, body: string) {
    if (!studioPackage) return;
    if (!body.trim()) {
      setFeedback("Add copy before saving this channel variant.");
      return;
    }
    setBusyAction(`save-copy-${content.channel}`);
    try {
      const response = await requestJson<{ content: StudioContent }>(`/api/admin/marketing/content/${content.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body: body.trim(), status: "review" }),
      });
      setStudioPackage((current) => current ? { ...current, content: current.content.map((item) => item.id === response.content.id ? response.content : item) } : current);
      await refreshReadiness(studioPackage.campaign.id);
      setFeedback(`${CHANNEL_LABELS[content.channel]} copy saved. Review it again before approval.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Copy could not be saved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function regenerateCopy(content: StudioContent) {
    if (!studioPackage) return;
    setBusyAction(`regenerate-copy-${content.channel}`);
    try {
      const response = await requestJson<{ content: StudioContent; note?: string | null }>(`/api/admin/marketing/social-packages/content/${content.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setStudioPackage((current) => current ? { ...current, content: current.content.map((item) => item.id === response.content.id ? response.content : item) } : current);
      await refreshReadiness(studioPackage.campaign.id);
      setFeedback(response.note || `${CHANNEL_LABELS[content.channel]} copy regenerated. Review it before approval.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Copy could not be regenerated.");
    } finally {
      setBusyAction(null);
    }
  }

  async function approveImage(asset: StudioMediaAsset, channel: SocialStudioChannel) {
    if (!studioPackage) return;
    setBusyAction(`approve-image-${channel}`);
    try {
      const response = await requestJson<{ mediaAsset: StudioMediaAsset }>(`/api/admin/marketing/social-packages/media/${asset.id}/approve`, { method: "POST" });
      setStudioPackage((current) => current ? replacePackageMedia(current, response.mediaAsset) : current);
      await refreshReadiness(studioPackage.campaign.id);
      setFeedback(`${CHANNEL_LABELS[channel]} image approved.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Image could not be approved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function regenerateImage(content: StudioContent) {
    if (!studioPackage) return;
    setBusyAction(`regenerate-${content.channel}`);
    try {
      const response = await requestJson<{ content: StudioContent; mediaAsset: StudioMediaAsset }>(`/api/admin/marketing/content/${content.id}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setStudioPackage((current) => current ? {
        ...replacePackageMedia(current, response.mediaAsset),
        content: current.content.map((item) => item.id === response.content.id ? response.content : item),
      } : current);
      await refreshReadiness(studioPackage.campaign.id);
      setFeedback(`${CHANNEL_LABELS[content.channel]} image regenerated. Approve the new image before scheduling.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Image could not be regenerated.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveAltText(asset: StudioMediaAsset, altText: string, channel: SocialStudioChannel) {
    if (!studioPackage) return;
    setBusyAction(`alt-${channel}`);
    try {
      const metadata = metadataRecord(asset.metadata);
      const response = await requestJson<{ mediaAsset: StudioMediaAsset }>(`/api/admin/marketing/media/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: { ...metadata, socialStudio: { ...metadataRecord(metadata.socialStudio), altText: altText.trim() } } }),
      });
      setStudioPackage((current) => current ? replacePackageMedia(current, response.mediaAsset) : current);
      setFeedback(`${CHANNEL_LABELS[channel]} alt text saved.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Alt text could not be saved.");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyContent(content: StudioContent) {
    const studio = metadataRecord(metadataRecord(content.designJson).socialStudio);
    const hashtags = Array.isArray(studio.hashtags) ? studio.hashtags.join(" ") : "";
    const value = [content.subject, content.body, hashtags, content.ctaLabel && content.ctaUrl ? `${content.ctaLabel}: ${content.ctaUrl}` : content.ctaLabel].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(`${CHANNEL_LABELS[content.channel]} copy copied to clipboard.`);
    } catch {
      setFeedback("Copy is ready, but the browser did not allow clipboard access.");
    }
  }

  function exportRunSheet() {
    if (!studioPackage) return;
    const lines = [
      `# ${studioPackage.campaign.name}`,
      "",
      `Scheduled: ${formatDate(studioPackage.campaign.scheduleStartsAt)}`,
      "Publishing mode: Manual channel publishing (V1)",
      "",
      "VYVA stores the approved package and schedule. Copy the content and upload each channel asset in its native platform. Live publishing is locked until platform accounts and permissions are connected.",
      "",
    ];

    for (const content of studioPackage.content) {
      const studio = metadataRecord(metadataRecord(content.designJson).socialStudio);
      const hashtags = Array.isArray(studio.hashtags) ? studio.hashtags.map(String).join(" ") : "";
      const mediaAsset = mediaByContentId.get(content.id);
      lines.push(`## ${CHANNEL_LABELS[content.channel]}`, "", `Approval: ${content.status === "approved" ? "Approved" : "Needs approval"}`);
      if (content.subject) lines.push(`Subject: ${content.subject}`);
      if (studio.hook) lines.push(`Hook: ${String(studio.hook)}`);
      lines.push("", content.body.trim(), "");
      if (hashtags) lines.push(`Hashtags: ${hashtags}`);
      if (content.ctaLabel) lines.push(`CTA: ${content.ctaLabel}${content.ctaUrl ? ` - ${content.ctaUrl}` : ""}`);
      if (studio.videoPrompt) lines.push(`Creator prompt: ${String(studio.videoPrompt)}`);
      if (studio.platformNotes) lines.push(`Platform notes: ${String(studio.platformNotes)}`);
      if (mediaAsset) {
        lines.push(`Image: ${mediaAsset.localUrl || mediaAsset.originalUrl}`, `Alt text: ${studioMediaAltText(mediaAsset) || "Add descriptive alt text before publishing."}`, `Image approval: ${studioMediaApproval(mediaAsset) ? "Approved" : "Needs approval"}`);
      }
      lines.push("");
    }

    const filename = `${studioPackage.campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vyva-social-campaign"}-run-sheet.md`;
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback("Manual publishing run sheet downloaded.");
  }

  async function schedulePackage() {
    if (!studioPackage) return;
    setBusyAction("schedule");
    try {
      const response = await requestJson<{ campaign: StudioCampaign; readiness: ReadinessItem[] }>(`/api/admin/marketing/social-packages/${studioPackage.campaign.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: localDateToIso(form.scheduledAt) }),
      });
      setStudioPackage((current) => current ? { ...current, campaign: response.campaign, readiness: response.readiness } : current);
      setFeedback("Campaign scheduled and added to the Marketing calendar. Social networks remain manual until publishing integrations are enabled.");
      await onCreated?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Campaign could not be scheduled.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-4" data-testid="marketing-social-studio-tab">
      <section className="overflow-hidden rounded-2xl border border-purple-200 bg-[#2f2135] text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-200">VYVA Social Studio</p>
            <h2 className="mt-2 text-2xl font-black">Brief once. Shape every channel.</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-white/70">Turn one campaign idea into channel-native copy, static visuals, and a review-ready publishing package. Every variant stays editable and human-approved.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black"><Sparkles size={14} /> AI-assisted drafts</span>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <form className="grid content-start gap-4 rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm" onSubmit={generatePackage} data-testid="social-studio-brief-form">
          <div>
            <h3 className="text-xl font-black text-[#241133]">Campaign brief</h3>
            <p className="mt-1 text-sm font-semibold text-[#7d6b65]">Give the system the idea, audience, and desired action.</p>
          </div>
          <Field label="What should this campaign achieve?">
            <textarea className={textareaClass} value={form.brief} onChange={(event) => updateForm("brief", event.target.value)} placeholder="Invite Spanish care teams to a practical VYVA introduction..." required data-testid="textarea-social-studio-brief" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Campaign name"><input className={inputClass} value={form.campaignName} onChange={(event) => updateForm("campaignName", event.target.value)} placeholder="Spring partner outreach" data-testid="input-social-studio-campaign-name" /></Field>
            <Field label="Language"><select className={inputClass} value={form.language} onChange={(event) => updateForm("language", event.target.value)}><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="it">Italian</option><option value="pt">Portuguese</option></select></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Audience"><select className={inputClass} value={form.audienceType} onChange={(event) => updateForm("audienceType", event.target.value as AudienceType)}><option value="b2c">Families and caregivers</option><option value="b2b">Partners and providers</option><option value="both">Both audiences</option></select></Field>
            <Field label="Tone"><select className={inputClass} value={form.tone} onChange={(event) => updateForm("tone", event.target.value as Tone)}><option value="warm">Warm</option><option value="expert">Expert</option><option value="direct">Direct</option><option value="uplifting">Uplifting</option></select></Field>
          </div>
          <Field label="Target list"><select className={inputClass} value={form.targetAudienceId} onChange={(event) => updateForm("targetAudienceId", event.target.value)}><option value="">All eligible contacts</option>{audiences.map((audience) => <option key={audience.id} value={audience.id}>{audience.name}{typeof audience.memberCount === "number" ? ` (${audience.memberCount})` : ""}</option>)}</select></Field>

          <fieldset>
            <legend className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-[#7d6b65]">Networks</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map((channel) => {
                const Icon = channel.icon;
                const selected = form.channels.includes(channel.value);
                return <label key={channel.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 ${selected ? "border-purple-300 bg-purple-50" : "border-[#eadfd5] bg-white"}`}><input type="checkbox" checked={selected} onChange={() => toggleChannel(channel.value)} className="h-4 w-4 accent-purple-700" data-testid={`checkbox-social-studio-${channel.value}`} /><Icon size={15} className={selected ? "text-purple-700" : "text-[#8b7a73]"} aria-hidden="true" /><span><span className="block text-sm font-black text-[#241133]">{channel.label}</span><span className="block text-[11px] font-semibold text-[#7d6b65]">{channel.detail}</span></span></label>;
              })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CTA label"><input className={inputClass} value={form.ctaLabel} onChange={(event) => updateForm("ctaLabel", event.target.value)} /></Field>
            <Field label="CTA URL"><input className={inputClass} value={form.ctaUrl} onChange={(event) => updateForm("ctaUrl", event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Desired publish time"><input type="datetime-local" className={inputClass} value={form.scheduledAt} onChange={(event) => updateForm("scheduledAt", event.target.value)} /></Field>
            <Field label="Image style"><select className={inputClass} value={form.imageStyle} onChange={(event) => updateForm("imageStyle", event.target.value as ImageStyle)}><option value="warm_editorial">Warm editorial</option><option value="friendly_product">Friendly product</option><option value="community_moment">Community moment</option></select></Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-purple-100 bg-purple-50 p-3"><input type="checkbox" checked={form.generateImages} onChange={(event) => updateForm("generateImages", event.target.checked)} className="mt-0.5 h-4 w-4 accent-purple-700" data-testid="checkbox-social-studio-generate-images" /><span><span className="block text-sm font-black text-[#241133]">Generate static visuals</span><span className="mt-1 block text-xs font-semibold leading-relaxed text-[#5b4a46]">Creates a reviewable image for each selected channel. TikTok gets a cover image and creator prompt, not a video.</span></span></label>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={busyAction !== null} data-testid="button-social-studio-generate"><Sparkles size={16} /> {busyAction === "generate" ? "Generating..." : "Generate package"}</button>
          {feedback ? <p className={`rounded-xl px-3 py-2 text-sm font-bold ${/failed|could not|error|not configured|select|add a brief/i.test(feedback) ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`} data-testid="social-studio-feedback">{feedback}</p> : null}
        </form>

        <section className="grid content-start gap-4" data-testid="social-studio-package">
          {!studioPackage ? (
            <div className="rounded-2xl border border-dashed border-[#d9cabb] bg-[#fffaf4] p-8 text-center"><Send size={24} className="mx-auto text-purple-700" /><h3 className="mt-3 text-xl font-black text-[#241133]">Your channel package will appear here</h3><p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-[#7d6b65]">Start with the brief on the left. VYVA will keep the core idea consistent while shaping the message for each selected network.</p></div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">Generated package</p><h3 className="mt-1 text-2xl font-black text-[#241133]">{studioPackage.campaign.name}</h3><p className="mt-1 text-sm font-semibold text-[#7d6b65]">{studioPackage.source === "openai" ? "AI draft" : "Safe fallback draft"} · {formatDate(studioPackage.campaign.scheduleStartsAt)}</p></div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${studioPackage.campaign.status === "scheduled" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}><CalendarCheck2 size={13} /> {studioPackage.campaign.status}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-[#fbf8f5] p-3"><p className="text-xs font-black uppercase tracking-[0.1em] text-[#7d6b65]">Channels</p><p className="mt-1 text-xl font-black text-[#241133]">{studioPackage.content.length}</p></div><div className="rounded-xl bg-[#fbf8f5] p-3"><p className="text-xs font-black uppercase tracking-[0.1em] text-[#7d6b65]">Approved</p><p className="mt-1 text-xl font-black text-[#241133]">{studioPackage.readiness.filter((item) => item.state === "approved").length}/{studioPackage.readiness.length}</p></div><div className="rounded-xl bg-[#fbf8f5] p-3"><p className="text-xs font-black uppercase tracking-[0.1em] text-[#7d6b65]">Publish mode</p><p className="mt-1 text-sm font-black text-[#241133]">Manual social posting</p></div></div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold text-[#7d6b65]">Approve copy and images separately. Scheduling stays locked until every selected channel is approved.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={exportRunSheet} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 text-sm font-black text-purple-800" data-testid="button-social-studio-export"><Download size={15} /> Export run sheet</button><button type="button" onClick={() => void schedulePackage()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]" disabled={!allApproved || busyAction !== null || studioPackage.campaign.status === "scheduled"} data-testid="button-social-studio-schedule"><CalendarCheck2 size={15} /> {busyAction === "schedule" ? "Scheduling..." : studioPackage.campaign.status === "scheduled" ? "Scheduled" : "Schedule campaign"}</button></div></div>
              </div>
              {studioPackage.content.map((content) => {
                const readiness = readinessByChannel.get(content.channel) ?? { channel: content.channel, state: "needs_action" as const, issues: ["Readiness is not available yet."] };
                const mediaAsset = mediaByContentId.get(content.id);
                return <ChannelCard key={content.id} content={content} readiness={readiness} mediaAsset={mediaAsset} busy={busyAction !== null} onApproveCopy={() => void approveCopy(content)} onSaveCopy={(subject, body) => void saveCopy(content, subject, body)} onRegenerateCopy={() => void regenerateCopy(content)} onApproveImage={() => mediaAsset && void approveImage(mediaAsset, content.channel)} onRegenerateImage={() => void regenerateImage(content)} onSaveAltText={(altText) => mediaAsset && void saveAltText(mediaAsset, altText, content.channel)} onCopy={() => void copyContent(content)} />;
              })}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
