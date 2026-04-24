/**
 * Notification service for VYVA.
 *
 * Persists every notification as a row in caregiver_alerts and attempts
 * outbound delivery via SMS (primary) or email (fallback).
 *
 * Outbound delivery via environment variables:
 *   SMS:   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER  (configured)
 *   Email: SENDGRID_API_KEY, NOTIFY_FROM_EMAIL  (optional fallback)
 *
 * Without credentials the message is logged to console and the DB row is
 * still recorded, so the flow degrades gracefully in development without
 * any external service configured.
 *
 * NOTE: elderEmail is not yet stored in the profiles table — it lives in the
 * auth provider. Wire it in once JWT/session-based auth exposes the email.
 */

import { db } from "../db.js";
import { caregiverAlerts } from "../../shared/schema.js";

export interface ElderProxyNotificationPayload {
  elderId: string;
  elderName: string | null;
  elderPhone: string | null;
  elderEmail: string | null;
  proxyName: string;
  confirmUrl: string;
}

type DeliveryChannel = "sms" | "email" | "none";

type DeliveryResult =
  | { ok: true; channel: "sms" | "email" }
  | { ok: false; channel: "sms" | "email"; statusCode: number; detail: string }
  | { ok: false; channel: "none"; reason: string };

/**
 * Sends a notification to an elder informing them that a carer has set up
 * their VYVA account on their behalf and prompting them to confirm.
 *
 * Delivery priority:
 *   1. SMS   — if elderPhone is present and TWILIO_* env vars are configured
 *   2. Email — if elderEmail is present and SENDGRID_API_KEY is configured
 *   3. DB-only record — if neither is available (logged as warning)
 *
 * Delivery failures are logged with enough detail to diagnose problems
 * (HTTP status code + provider error body). They never block the main
 * response — a caregiver_alerts row is always written.
 */
export async function notifyElderOfProxySetup(
  payload: ElderProxyNotificationPayload,
): Promise<void> {
  const { elderId, elderName, elderPhone, elderEmail, proxyName, confirmUrl } = payload;

  const displayName = elderName ?? "there";
  const subject = "Your VYVA account has been set up";
  const body =
    `Hi ${displayName}, ${proxyName} has set up your VYVA account. ` +
    `Tap the link to review and confirm your profile: ${confirmUrl}`;

  let result: DeliveryResult;

  if (elderPhone) {
    result = await sendSms(elderPhone, body);
    // If SMS failed and an email address is available, fall back to email.
    if (!result.ok && elderEmail) {
      console.warn(
        `[notifications] elder=${elderId} SMS failed — falling back to email`,
      );
      result = await sendEmail(elderEmail, subject, body);
    }
  } else if (elderEmail) {
    result = await sendEmail(elderEmail, subject, body);
  } else {
    result = { ok: false, channel: "none", reason: "no phone or email on profile" };
  }

  // Log outcome with enough context to diagnose problems in production.
  if (!result.ok) {
    if (result.channel === "none") {
      console.warn(
        `[notifications] elder=${elderId} proxy_setup — no outbound delivery: ${result.reason}`,
      );
    } else {
      console.error(
        `[notifications] elder=${elderId} proxy_setup — ${result.channel} delivery failed` +
          ` (status=${result.statusCode}): ${result.detail}`,
      );
    }
  } else {
    console.log(
      `[notifications] elder=${elderId} proxy_setup — ${result.channel} delivered successfully`,
    );
  }

  const sentTo: string[] = [];
  if (result.ok) {
    if (result.channel === "sms" && elderPhone) sentTo.push(elderPhone);
    if (result.channel === "email" && elderEmail) sentTo.push(elderEmail);
  }

  await db.insert(caregiverAlerts).values({
    user_id:    elderId,
    alert_type: "proxy_setup",
    severity:   result.ok ? "info" : "warning",
    message:    body,
    sent_to:    sentTo,
  });
}

// ---------------------------------------------------------------------------
// Transport implementations
// ---------------------------------------------------------------------------

async function sendSms(to: string, body: string): Promise<DeliveryResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn(
      "[notifications] Twilio credentials not configured " +
        "(TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER). " +
        "SMS will not be sent.",
    );
    return { ok: false, channel: "sms", statusCode: 0, detail: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[notifications] Twilio SMS network error: ${detail}`);
    return { ok: false, channel: "sms", statusCode: 0, detail };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable body)");
    return { ok: false, channel: "sms", statusCode: res.status, detail: text };
  }

  return { ok: true, channel: "sms" };
}

async function sendEmail(to: string, subject: string, body: string): Promise<DeliveryResult> {
  const apiKey   = process.env.SENDGRID_API_KEY;
  const fromAddr = process.env.NOTIFY_FROM_EMAIL ?? "noreply@vyva.ai";

  if (!apiKey) {
    console.warn(
      "[notifications] SendGrid API key not configured (SENDGRID_API_KEY). " +
        "Email will not be sent.",
    );
    return { ok: false, channel: "email", statusCode: 0, detail: "SendGrid API key not configured" };
  }

  let res: Response;
  try {
    res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from:             { email: fromAddr },
        content:          [{ type: "text/plain", value: body }],
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[notifications] SendGrid email network error: ${detail}`);
    return { ok: false, channel: "email", statusCode: 0, detail };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable body)");
    return { ok: false, channel: "email", statusCode: res.status, detail: text };
  }

  return { ok: true, channel: "email" };
}
