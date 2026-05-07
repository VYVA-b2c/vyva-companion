import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db.js";
import { profiles, billingEvents, stripeWebhooks } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import {
  entitlementForTier,
  findActivePlan,
  findPlanByStripePriceId,
  listPlans,
  normalizeCurrency,
  normalizeSubscriptionTier,
  planPrice,
  planStripePriceId,
} from "../lib/plans.js";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
const router = Router();

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:5000";
}

function subscriptionStatusFromStripe(status: Stripe.Subscription.Status) {
  if (status === "active") return "active";
  if (status === "trialing") return "trial";
  if (status === "past_due") return "past_due";
  return "cancelled";
}

async function planIdFromSubscription(sub: Stripe.Subscription) {
  const metadataPlan = typeof sub.metadata?.plan_id === "string" ? sub.metadata.plan_id : null;
  if (metadataPlan) return normalizeSubscriptionTier(metadataPlan);

  const priceId = sub.items.data[0]?.price?.id;
  const plan = await findPlanByStripePriceId(priceId);
  return plan?.plan_id ?? "premium";
}

router.get("/plans", async (_req, res) => {
  const plans = await listPlans({ publicOnly: true });
  return res.json({ plans });
});

// GET /api/billing/status
// Returns current plan, trial days remaining, and feature list.
router.get("/status", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorised" });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const trialDaysRemaining = profile.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;
  const effectiveTier = normalizeSubscriptionTier(profile.subscription_tier);
  const plans = await listPlans();

  return res.json({
    status: profile.subscription_status,
    tier: effectiveTier,
    stored_tier: profile.subscription_tier,
    trial_days_remaining: trialDaysRemaining,
    trial_ends_at: profile.trial_ends_at,
    has_billing_account: Boolean(profile.stripe_customer_id),
    plan: plans.find((plan) => plan.plan_id === effectiveTier) ?? null,
    entitlements: await entitlementForTier(effectiveTier),
  });
});

// POST /api/billing/create-checkout
// Creates a Stripe Checkout session and returns the URL.
// Frontend redirects to this URL for payment.
router.post("/create-checkout", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorised" });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const planId = typeof req.body?.plan_id === "string" ? req.body.plan_id : "premium";
  const currency = normalizeCurrency(req.body?.currency);
  const plan = await findActivePlan(planId, { publicOnly: true });
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const price = planPrice(plan, currency);
  if (price === 0) {
    const trialEndsAt = plan.trial_days ? new Date(Date.now() + plan.trial_days * 86400000) : null;
    await db.update(profiles).set({
      subscription_status: plan.trial_days ? "trial" : "active",
      subscription_tier: plan.plan_id,
      trial_ends_at: trialEndsAt,
      updated_at: new Date(),
    }).where(eq(profiles.id, userId));
    return res.json({ status: "trial_started", redirect_url: "/settings/subscription?trial=started" });
  }

  const stripePriceId = planStripePriceId(plan, currency);
  if (!stripePriceId) {
    return res.status(400).json({ error: "Stripe price is not configured for this plan yet." });
  }

  // Create or retrieve Stripe customer
  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: profile.email || undefined,
      name: profile.full_name || undefined,
      phone: profile.phone_number || undefined,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    await db.update(profiles).set({
      stripe_customer_id: customerId,
      updated_at: new Date(),
    }).where(eq(profiles.id, userId));
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{
      price: stripePriceId,
      quantity: 1,
    }],
    success_url: `${appUrl()}/?upgraded=true&plan=${encodeURIComponent(plan.plan_id)}`,
    cancel_url: `${appUrl()}/settings/subscription`,
    metadata: { user_id: userId, plan_id: plan.plan_id, currency },
    subscription_data: {
      metadata: { user_id: userId, plan_id: plan.plan_id, currency },
      ...(plan.trial_days ? { trial_period_days: plan.trial_days } : {}),
    },
  });

  return res.json({ url: session.url });
});

// GET /api/billing/portal
// Creates a Stripe Customer Portal session.
// User can manage card, cancel, view invoices.
router.get("/portal", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorised" });

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (!profile?.stripe_customer_id) {
    return res.status(400).json({ error: "No billing account found" });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${appUrl()}/settings/subscription`,
  });

  return res.json({ url: session.url });
});

// POST /api/billing/webhook
// Receives Stripe webhook events. Must be raw body (not JSON parsed).
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return res.status(400).json({ error: "Webhook signature invalid" });
  }

  // Log the webhook (idempotency check)
  const existing = await db.select().from(stripeWebhooks)
    .where(eq(stripeWebhooks.stripe_event_id, event.id));
  if (existing.length > 0) return res.json({ received: true }); // already processed

  await db.insert(stripeWebhooks).values({
    stripe_event_id: event.id,
    event_type: event.type,
    status: "pending",
    payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
  });

  try {
    switch (event.type) {

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const planId = await planIdFromSubscription(sub);
        await db.update(profiles).set({
          stripe_subscription_id: sub.id,
          subscription_status: subscriptionStatusFromStripe(sub.status),
          subscription_tier: planId,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          updated_at: new Date(),
        }).where(eq(profiles.stripe_customer_id, customerId));
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await db.update(profiles).set({
          subscription_status: "cancelled",
          subscription_tier: "free",
          updated_at: new Date(),
        }).where(eq(profiles.stripe_customer_id, sub.customer as string));
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const [profile] = await db.select().from(profiles)
          .where(eq(profiles.stripe_customer_id, customerId));
        if (profile) {
          await db.insert(billingEvents).values({
            user_id: profile.id,
            stripe_event_id: event.id,
            stripe_invoice_id: invoice.id,
            event_type: "payment_succeeded",
            amount_cents: invoice.amount_paid,
            currency: invoice.currency,
            plan_id: profile.subscription_tier,
            status: "succeeded",
            stripe_payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const [profile] = await db.select().from(profiles)
          .where(eq(profiles.stripe_customer_id, customerId));
        if (profile) {
          await db.update(profiles).set({
            subscription_status: "past_due",
            updated_at: new Date(),
          }).where(eq(profiles.id, profile.id));
          await db.insert(billingEvents).values({
            user_id: profile.id,
            stripe_event_id: event.id,
            stripe_invoice_id: invoice.id,
            event_type: "payment_failed",
            amount_cents: invoice.amount_due,
            currency: invoice.currency,
            plan_id: profile.subscription_tier,
            status: "failed",
            failure_reason: "payment_failed",
            stripe_payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
          });
        }
        break;
      }
    }

    await db.update(stripeWebhooks).set({
      status: "processed",
      processed_at: new Date(),
    }).where(eq(stripeWebhooks.stripe_event_id, event.id));

    return res.json({ received: true });

  } catch (err) {
    await db.update(stripeWebhooks).set({
      status: "failed",
      error: String(err),
    }).where(eq(stripeWebhooks.stripe_event_id, event.id));
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
