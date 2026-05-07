import { and, eq, or } from "drizzle-orm";
import { db } from "../db.js";
import { subscriptionPlans, tierEntitlements } from "../../shared/schema.js";

export const DEFAULT_PLAN_CATALOG = [
  {
    plan_id: "trial",
    name: "Free trial",
    description: "A time-limited introduction to VYVA with core companion tools.",
    price_eur: 0,
    price_gbp: 0,
    billing_interval: "month",
    trial_days: 14,
    stripe_price_id_eur: null,
    stripe_price_id_gbp: null,
    features: ["Daily companion conversations", "Medication reminders", "Basic wellbeing check-ins"],
    is_active: true,
    is_public: true,
    sort_order: 0,
    entitlement: {
      tier: "trial",
      display_name: "Free trial",
      description: "Core voice, health, and reminder features during the free trial.",
      voice_assistant: true,
      medication_tracking: true,
      symptom_check: true,
      concierge: false,
      caregiver_dashboard: false,
      custom_features: {},
      is_active: true,
    },
  },
  {
    plan_id: "essential",
    name: "Essential",
    description: "Everyday support for health, medication, and daily routines.",
    price_eur: 1900,
    price_gbp: 1600,
    billing_interval: "month",
    trial_days: 0,
    stripe_price_id_eur: null,
    stripe_price_id_gbp: null,
    features: ["Everything in trial", "Ongoing medication tracking", "Symptom checks", "Priority app support"],
    is_active: true,
    is_public: true,
    sort_order: 10,
    entitlement: {
      tier: "essential",
      display_name: "Essential",
      description: "Core paid plan for ongoing daily support.",
      voice_assistant: true,
      medication_tracking: true,
      symptom_check: true,
      concierge: false,
      caregiver_dashboard: false,
      custom_features: {},
      is_active: true,
    },
  },
  {
    plan_id: "unlimited",
    name: "Unlimited",
    description: "Full VYVA access with concierge support and caregiver visibility.",
    price_eur: 2900,
    price_gbp: 2499,
    billing_interval: "month",
    trial_days: 0,
    stripe_price_id_eur: null,
    stripe_price_id_gbp: null,
    features: ["Everything in Essential", "Concierge support", "Caregiver dashboard", "Family access"],
    is_active: true,
    is_public: true,
    sort_order: 20,
    entitlement: {
      tier: "unlimited",
      display_name: "Unlimited",
      description: "Full VYVA support bundle.",
      voice_assistant: true,
      medication_tracking: true,
      symptom_check: true,
      concierge: true,
      caregiver_dashboard: true,
      custom_features: {},
      is_active: true,
    },
  },
  {
    plan_id: "custom",
    name: "Custom",
    description: "Private plan for organizations, pilots, or bespoke care bundles.",
    price_eur: 0,
    price_gbp: 0,
    billing_interval: "month",
    trial_days: 0,
    stripe_price_id_eur: null,
    stripe_price_id_gbp: null,
    features: ["Configured by VYVA operations"],
    is_active: true,
    is_public: false,
    sort_order: 90,
    entitlement: {
      tier: "custom",
      display_name: "Custom",
      description: "Operations-managed bespoke entitlement bundle.",
      voice_assistant: false,
      medication_tracking: false,
      symptom_check: false,
      concierge: false,
      caregiver_dashboard: false,
      custom_features: {},
      is_active: true,
    },
  },
] as const;

export type BillingCurrency = "eur" | "gbp";

export function normalizeCurrency(value: unknown): BillingCurrency {
  return typeof value === "string" && value.toLowerCase() === "gbp" ? "gbp" : "eur";
}

export function planPrice(plan: typeof subscriptionPlans.$inferSelect, currency: BillingCurrency): number {
  return currency === "gbp" ? plan.price_gbp : plan.price_eur;
}

export function planStripePriceId(plan: typeof subscriptionPlans.$inferSelect, currency: BillingCurrency): string | null {
  const configured = currency === "gbp" ? plan.stripe_price_id_gbp : plan.stripe_price_id_eur;
  return configured || process.env.STRIPE_PREMIUM_PRICE_ID || null;
}

export async function ensureDefaultPlans() {
  const existing = await db.select({ plan_id: subscriptionPlans.plan_id }).from(subscriptionPlans).limit(1);
  if (existing.length) return;

  for (const plan of DEFAULT_PLAN_CATALOG) {
    await upsertPlanWithEntitlement(plan);
  }
}

export async function listPlans(options: { publicOnly?: boolean } = {}) {
  await ensureDefaultPlans();

  const rows = await db
    .select({
      plan: subscriptionPlans,
      entitlement: tierEntitlements,
    })
    .from(subscriptionPlans)
    .leftJoin(tierEntitlements, eq(tierEntitlements.tier, subscriptionPlans.plan_id))
    .where(options.publicOnly ? and(eq(subscriptionPlans.is_active, true), eq(subscriptionPlans.is_public, true)) : undefined)
    .orderBy(subscriptionPlans.sort_order, subscriptionPlans.plan_id);

  return rows.map(({ plan, entitlement }) => ({ ...plan, entitlement }));
}

export async function findActivePlan(planId: string, options: { publicOnly?: boolean } = {}) {
  await ensureDefaultPlans();

  const [row] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(
      eq(subscriptionPlans.plan_id, planId),
      eq(subscriptionPlans.is_active, true),
      options.publicOnly ? eq(subscriptionPlans.is_public, true) : undefined,
    ))
    .limit(1);

  return row ?? null;
}

export async function findPlanByStripePriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  await ensureDefaultPlans();

  const [row] = await db
    .select()
    .from(subscriptionPlans)
    .where(or(eq(subscriptionPlans.stripe_price_id_eur, priceId), eq(subscriptionPlans.stripe_price_id_gbp, priceId)))
    .limit(1);

  return row ?? null;
}

export async function upsertPlanWithEntitlement(input: {
  plan_id: string;
  name: string;
  description?: string | null;
  price_eur?: number | null;
  price_gbp?: number | null;
  billing_interval?: string | null;
  trial_days?: number | null;
  stripe_price_id_eur?: string | null;
  stripe_price_id_gbp?: string | null;
  features?: string[] | null;
  is_active?: boolean | null;
  is_public?: boolean | null;
  sort_order?: number | null;
  entitlement?: {
    tier?: string;
    display_name?: string;
    description?: string | null;
    voice_assistant?: boolean;
    medication_tracking?: boolean;
    symptom_check?: boolean;
    concierge?: boolean;
    caregiver_dashboard?: boolean;
    custom_features?: Record<string, unknown>;
    is_active?: boolean;
  } | null;
}) {
  const planValues = {
    plan_id: input.plan_id,
    name: input.name,
    description: input.description ?? null,
    price_eur: input.price_eur ?? 0,
    price_gbp: input.price_gbp ?? 0,
    billing_interval: input.billing_interval ?? "month",
    trial_days: input.trial_days ?? 0,
    stripe_price_id_eur: input.stripe_price_id_eur || null,
    stripe_price_id_gbp: input.stripe_price_id_gbp || null,
    features: input.features ?? [],
    is_active: input.is_active ?? true,
    is_public: input.is_public ?? true,
    sort_order: input.sort_order ?? 0,
  };

  const [plan] = await db
    .insert(subscriptionPlans)
    .values(planValues)
    .onConflictDoUpdate({
      target: subscriptionPlans.plan_id,
      set: {
        ...planValues,
        updated_at: new Date(),
      },
    })
    .returning();

  const ent = input.entitlement ?? {};
  const entitlementValues = {
    tier: input.plan_id,
    display_name: ent.display_name ?? input.name,
    description: ent.description ?? input.description ?? null,
    voice_assistant: ent.voice_assistant ?? false,
    medication_tracking: ent.medication_tracking ?? false,
    symptom_check: ent.symptom_check ?? false,
    concierge: ent.concierge ?? false,
    caregiver_dashboard: ent.caregiver_dashboard ?? false,
    custom_features: ent.custom_features ?? {},
    is_active: ent.is_active ?? input.is_active ?? true,
  };

  const [entitlement] = await db
    .insert(tierEntitlements)
    .values(entitlementValues)
    .onConflictDoUpdate({
      target: tierEntitlements.tier,
      set: {
        ...entitlementValues,
        updated_at: new Date(),
      },
    })
    .returning();

  return { ...plan, entitlement };
}
