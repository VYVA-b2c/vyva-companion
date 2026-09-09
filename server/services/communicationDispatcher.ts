import { and, asc, eq, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db } from "../db.js";
import { communicationsLog } from "../../shared/schema.js";
import { explainEmailProviderError, requireEmailFromAddress } from "../lib/emailSenderConfig.js";
import { buildCareTeamInviteEmail } from "../lib/careTeamInviteEmail.js";
import { buildSignupInviteEmail, signupInviteRecipientNameFromMetadata } from "../lib/signupInviteEmail.js";
import { queueDueCallbackOnboardingCalls } from "./callbackOnboarding.js";
import { queueDueConsentCalls } from "./lifecycle.js";

type Communication = typeof communicationsLog.$inferSelect;
type DispatchStatus = "queued" | "sending" | "sent" | "failed";

type DispatchResult = {
  id: string;
  channel: string;
  recipient: string;
  status: DispatchStatus;
  provider_message_id?: string | null;
  error?: string;
};

type TwilioMessageResponse = {
  sid?: string;
  status?: string;
  error_message?: string;
  message?: string;
};

type SendGridResponse = {
  message?: string;
  errors?: Array<{ message?: string }>;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

type EmailPayload = {
  subject: string;
  text: string;
  html?: string;
  disableTracking?: boolean;
  attachments?: EmailAttachment[];
};

type EmailAttachment = {
  content: string;
  filename: string;
  type: string;
  disposition: "inline" | "attachment";
  content_id: string;
};

function twilioStatusCallbackUrl(path: string) {
  const baseUrl = [
    process.env.TWILIO_WEBHOOK_BASE_URL,
    process.env.WEBHOOK_BASE_URL,
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
  ].map((value) => value?.trim()).find(Boolean);

  if (!baseUrl) return null;

  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.toLowerCase();
    const isLocalhost = hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "::1"
      || hostname.endsWith(".localhost");

    if (url.protocol !== "https:" || isLocalhost) return null;

    url.pathname = `${url.pathname.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function setTwilioStatusCallback(params: URLSearchParams, path: string) {
  const statusCallback = twilioStatusCallbackUrl(path);
  if (statusCallback) {
    params.set("StatusCallback", statusCallback);
  }
}

function twilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return {
    accountSid,
    authHeader: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
  };
}

function firstEnvValue(keys: string[]) {
  return keys.map((key) => process.env[key]?.trim()).find(Boolean) ?? null;
}

function twilioSmsFromNumber() {
  return firstEnvValue([
    "TWILIO_US_SMS_FROM_NUMBER",
    "TWILIO_SMS_US_FROM_NUMBER",
  ]);
}

function twilioSmsMessagingServiceSid() {
  return firstEnvValue([
    "TWILIO_SMS_MESSAGING_SERVICE_SID",
  ]);
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function withWhatsappPrefix(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataEmailAttachments(metadata: Record<string, unknown>): EmailAttachment[] {
  if (!Array.isArray(metadata.attachments)) return [];
  return metadata.attachments.flatMap((value, index) => {
    const item = metadataRecord(value);
    const content = metadataString(item, "content");
    const filename = metadataString(item, "filename");
    const type = metadataString(item, "type");
    if (!content || !filename || !type || !/^image\/(jpeg|png|webp)$/.test(type)) return [];
    if (!/^[A-Za-z0-9+/=]+$/.test(content) || content.length > 2_500_000) return [];
    return [{
      content,
      filename,
      type,
      disposition: "attachment" as const,
      content_id: metadataString(item, "content_id") ?? `attachment-${index + 1}`,
    }];
  });
}

export function buildEmailPayload(item: Communication): EmailPayload {
  const metadata = metadataRecord(item.metadata);
  const subject = metadataString(metadata, "subject") ?? "Join VYVA";

  if (item.purpose === "share_signup_form") {
    return buildSignupInviteEmail(metadata, item.body);
  }

  if (item.purpose === "care_team_invite") {
    return buildCareTeamInviteEmail(metadata, item.body);
  }

  return {
    subject,
    text: item.body ?? "",
    ...(() => {
      const html = metadataString(metadata, "html")
        ?? metadataString(metadata, "htmlBody")
        ?? metadataString(metadata, "html_body");
      return html ? { html } : {};
    })(),
    ...(() => {
      const attachments = metadataEmailAttachments(metadata);
      return attachments.length ? { attachments } : {};
    })(),
  };
}

function resendApiKey() {
  return process.env.RESEND_API_KEY?.trim() ?? "";
}

function resendFromAddress(fallbackFrom: string) {
  return process.env.RESEND_FROM_EMAIL?.trim() || fallbackFrom;
}

function formatResendFrom(from: string) {
  return from.includes("<") ? from : `VYVA <${from}>`;
}

export function buildResendEmailRequest(item: Communication, email: EmailPayload, from: string, replyTo: string | null, recipientName: string | null) {
  return {
    from: formatResendFrom(from),
    to: [recipientName ? `${recipientName} <${item.recipient}>` : item.recipient],
    subject: email.subject,
    text: email.text,
    ...(email.html ? { html: email.html } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(email.attachments?.length ? {
      attachments: email.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        content_type: attachment.type,
        ...(attachment.content_id ? { content_id: attachment.content_id } : {}),
      })),
    } : {}),
  };
}

function twilioRequestUrl(accountSid: string, resource: "Messages" | "Calls") {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${resource}.json`;
}

async function postTwilioForm(resource: "Messages" | "Calls", params: URLSearchParams): Promise<TwilioMessageResponse> {
  const credentials = twilioCredentials();
  if (!credentials) throw new Error("Twilio credentials are not configured");

  const response = await fetch(twilioRequestUrl(credentials.accountSid, resource), {
    method: "POST",
    headers: {
      Authorization: credentials.authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) })) as TwilioMessageResponse;

  if (!response.ok) {
    throw new Error(payload.message ?? payload.error_message ?? `Twilio ${resource} request failed with ${response.status}`);
  }

  return payload;
}

async function sendSms(item: Communication) {
  const from = twilioSmsFromNumber();
  const messagingServiceSid = twilioSmsMessagingServiceSid();
  if (!messagingServiceSid && !from) {
    throw new Error("SMS sender is not configured. Set TWILIO_US_SMS_FROM_NUMBER to the US SMS-capable Twilio number.");
  }

  const params = new URLSearchParams({
    To: item.recipient,
    Body: item.body ?? "",
  });
  setTwilioStatusCallback(params, "/api/webhooks/twilio/message-status");
  if (from) params.set("From", from);
  else if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);

  return postTwilioForm("Messages", params);
}

export function buildWhatsappMessageParams(item: Communication) {
  const metadata = metadataRecord(item.metadata);
  const contentSid = metadataString(metadata, "content_sid");
  const contentVariables = metadata.content_variables;
  const params = new URLSearchParams({
    To: withWhatsappPrefix(item.recipient),
  });

  if (contentSid) {
    params.set("ContentSid", contentSid);
    if (contentVariables && typeof contentVariables === "object" && !Array.isArray(contentVariables)) {
      params.set("ContentVariables", JSON.stringify(contentVariables));
    }
  } else {
    params.set("Body", item.body ?? "");
  }

  return params;
}

async function sendWhatsapp(item: Communication) {
  const from = process.env.TWILIO_WHATSAPP_FROM ?? process.env.TWILIO_WHATSAPP_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID;
  if (!messagingServiceSid && !from) throw new Error("WhatsApp sender is not configured");

  const params = buildWhatsappMessageParams(item);
  setTwilioStatusCallback(params, "/api/webhooks/twilio/message-status");
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else if (from) params.set("From", withWhatsappPrefix(from));

  return postTwilioForm("Messages", params);
}

async function sendResendEmail(item: Communication, email: EmailPayload, apiKey: string, from: string, replyTo: string | null, recipientName: string | null) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildResendEmailRequest(item, email, from, replyTo, recipientName)),
  });

  const payload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) })) as ResendResponse;
  if (!response.ok) {
    const message = payload.message ?? payload.name ?? `Resend request failed with ${response.status}`;
    throw new Error(message);
  }

  return { sid: payload.id ?? null, status: "sent" };
}

async function sendEmail(item: Communication) {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  const email = buildEmailPayload(item);
  const metadata = metadataRecord(item.metadata);
  const recipientName = signupInviteRecipientNameFromMetadata(metadata);
  const baseFrom = requireEmailFromAddress({ allowDevelopmentFallback: true });
  const from = baseFrom;
  const replyTo = process.env.NOTIFY_REPLY_TO_EMAIL?.trim() || from;

  const resendKey = resendApiKey();
  if (resendKey) {
    return sendResendEmail(item, email, resendKey, resendFromAddress(baseFrom), replyTo, recipientName);
  }

  if (!sendGridApiKey) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error("Email sender is not configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS.");
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transport.sendMail({
      from: { name: "VYVA", address: from },
      replyTo,
      to: recipientName ? { name: recipientName, address: item.recipient } : item.recipient,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.attachments?.length ? {
        attachments: email.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, "base64"),
          contentType: attachment.type,
          cid: attachment.content_id,
        })),
      } : {}),
    });
    return { sid: null, status: "sent" };
  }

  const content = [
    { type: "text/plain", value: email.text },
    ...(email.html ? [{ type: "text/html", value: email.html }] : []),
  ];

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendGridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: item.recipient, ...(recipientName ? { name: recipientName } : {}) }],
        subject: email.subject,
      }],
      from: { email: from, name: "VYVA" },
      reply_to: { email: replyTo, name: "VYVA" },
      content,
      ...(email.attachments?.length ? { attachments: email.attachments } : {}),
      ...(email.disableTracking ? {
        tracking_settings: {
          click_tracking: { enable: false, enable_text: false },
          open_tracking: { enable: false },
        },
      } : {}),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(async () => ({ message: await response.text().catch(() => response.statusText) })) as SendGridResponse;
    const message = payload.errors?.[0]?.message ?? payload.message ?? `SendGrid request failed with ${response.status}`;
    throw new Error(explainEmailProviderError(message, from));
  }

  // SendGrid returns the message id in the X-Message-Id header. The Event
  // Webhook later reports `sg_message_id` as `<X-Message-Id>.<suffix>`, so we
  // persist this to match delivery/bounce events back to this row.
  const messageId = response.headers.get("x-message-id");
  return { sid: messageId ?? null, status: "sent" };
}

async function sendVoiceCall(item: Communication) {
  const from = process.env.TWILIO_VOICE_FROM_NUMBER ?? process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error("Voice sender is not configured");

  const metadata = metadataRecord(item.metadata);
  const twiml = typeof metadata.twiml === "string"
    ? metadata.twiml
    : `<Response><Say>${xmlEscape(item.body ?? "Hello from VYVA.")}</Say></Response>`;
  const url = typeof metadata.voice_url === "string" ? metadata.voice_url : process.env.TWILIO_CONSENT_CALL_URL;

  const params = new URLSearchParams({
    To: item.recipient,
    From: from,
  });
  setTwilioStatusCallback(params, "/api/webhooks/twilio/voice-status");
  if (params.has("StatusCallback")) params.set("StatusCallbackMethod", "POST");
  if (url) params.set("Url", url);
  else params.set("Twiml", twiml);

  return postTwilioForm("Calls", params);
}

async function markCommunication(id: string, patch: Partial<typeof communicationsLog.$inferInsert>) {
  const [updated] = await db
    .update(communicationsLog)
    .set(patch)
    .where(eq(communicationsLog.id, id))
    .returning();
  return updated;
}

async function dispatchCommunication(item: Communication): Promise<DispatchResult> {
  try {
    await markCommunication(item.id, {
      status: "sending",
      metadata: {
        ...metadataRecord(item.metadata),
        dispatch_started_at: new Date().toISOString(),
      },
    });

    const channel = item.channel.toLowerCase();
    const response = channel === "whatsapp"
      ? await sendWhatsapp(item)
      : channel === "voice"
        ? await sendVoiceCall(item)
        : channel === "email"
          ? await sendEmail(item)
          : await sendSms(item);

    await markCommunication(item.id, {
      status: "sent",
      provider_message_id: response.sid ?? null,
      sent_at: new Date(),
      metadata: {
        ...metadataRecord(item.metadata),
        provider_status: response.status ?? null,
        dispatch_completed_at: new Date().toISOString(),
      },
    });

    return {
      id: item.id,
      channel: item.channel,
      recipient: item.recipient,
      status: "sent",
      provider_message_id: response.sid ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markCommunication(item.id, {
      status: "failed",
      metadata: {
        ...metadataRecord(item.metadata),
        dispatch_failed_at: new Date().toISOString(),
        dispatch_error: message,
      },
    });

    return {
      id: item.id,
      channel: item.channel,
      recipient: item.recipient,
      status: "failed",
      error: message,
    };
  }
}

export async function dispatchCommunicationsByIds(ids: string[]): Promise<{ processed: number; results: DispatchResult[] }> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return { processed: 0, results: [] };

  const queued = await db
    .select()
    .from(communicationsLog)
    .where(and(
      inArray(communicationsLog.id, uniqueIds),
      eq(communicationsLog.status, "queued"),
      inArray(communicationsLog.channel, ["sms", "whatsapp", "voice", "email"]),
    ));

  const byId = new Map(queued.map((item) => [item.id, item]));
  const results = [];
  for (const id of uniqueIds) {
    const item = byId.get(id);
    if (item) results.push(await dispatchCommunication(item));
  }

  return { processed: results.length, results };
}

export async function dispatchQueuedCommunications(limit = 25): Promise<{ processed: number; results: DispatchResult[] }> {
  await queueDueConsentCalls(limit);
  await queueDueCallbackOnboardingCalls(limit);

  const queued = await db
    .select()
    .from(communicationsLog)
    .where(and(
      eq(communicationsLog.status, "queued"),
      inArray(communicationsLog.channel, ["sms", "whatsapp", "voice", "email"]),
    ))
    .orderBy(asc(communicationsLog.created_at))
    .limit(limit);

  const results = [];
  for (const item of queued) {
    results.push(await dispatchCommunication(item));
  }

  return { processed: results.length, results };
}

export function startCommunicationDispatcher() {
  const intervalMs = Number(process.env.COMMUNICATION_DISPATCH_INTERVAL_MS ?? 0);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;

  const batchSize = Number(process.env.COMMUNICATION_DISPATCH_BATCH_SIZE ?? 25);
  const timer = setInterval(() => {
    dispatchQueuedCommunications(batchSize).catch((error) => {
      console.error("[communications] dispatcher run failed", error);
    });
  }, intervalMs);
  timer.unref?.();
  return timer;
}
