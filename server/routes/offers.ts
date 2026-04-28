import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles, companionProfiles, socialUserInterests } from "../../shared/schema.js";

const router = Router();
const DEMO_USER_ID = "demo-user";

type OfferCategory =
  | "Hogar y servicios"
  | "Alimentacion"
  | "Salud y bienestar"
  | "Transporte y movilidad"
  | "Viajes y ocio"
  | "Vivienda"
  | "Compras generales";

interface OffersRequestBody {
  query?: string;
  category?: OfferCategory;
  locale?: string;
}

interface OfferProfileContext {
  city: string;
  region: string;
  countryCode: string;
  mobilityPreference: "delivery" | "in_person" | "either";
  priceSensitivity: "high" | "medium" | "low";
  interests: string[];
}

interface PlaceCandidate {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  openNow?: boolean;
  source: string;
  sourceType: "verified_local_business" | "public_or_community" | "known_platform";
}

interface RankedOffer {
  label: "Opcion recomendada" | "Alternativa 1" | "Alternativa 2";
  name: string;
  category: OfferCategory;
  what_it_offers: string;
  price_or_advantage: string;
  why_good_option: string;
  distance_or_availability: string;
  contact_method: string;
  phone?: string;
  website?: string;
  maps_url?: string;
  trust_note: string;
  score: number;
  score_breakdown: {
    distance: number;
    price_value: number;
    trust: number;
    simplicity: number;
    preference_match: number;
  };
}

const CATEGORY_ALIASES: Array<{ category: OfferCategory; terms: RegExp }> = [
  { category: "Hogar y servicios", terms: /(hogar|casa|limpieza|fontaner|electric|reparaci|jardin|home|clean|repair|plumb|electric)/i },
  { category: "Alimentacion", terms: /(comida|supermercado|mercado|aliment|compra|food|grocery|market|restaurant|meal)/i },
  { category: "Salud y bienestar", terms: /(salud|farmacia|bienestar|fisio|optica|dentista|pharmacy|health|wellness|physio|dental)/i },
  { category: "Transporte y movilidad", terms: /(taxi|transporte|movilidad|autobus|ride|transport|mobility|bus)/i },
  { category: "Viajes y ocio", terms: /(viaje|ocio|cine|museo|teatro|hotel|actividad|travel|leisure|museum|cinema|event)/i },
  { category: "Vivienda", terms: /(vivienda|alquiler|residencia|inmobiliaria|housing|rent|residence|real estate)/i },
  { category: "Compras generales", terms: /(oferta|descuento|ropa|zapato|tienda|shopping|discount|deal|store|clothes)/i },
];

const CATEGORY_SEARCH_TERMS: Record<OfferCategory, string[]> = {
  "Hogar y servicios": ["servicios hogar verificados", "limpieza domicilio", "reparaciones hogar"],
  Alimentacion: ["supermercado ofertas", "mercado local", "entrega supermercado"],
  "Salud y bienestar": ["farmacia ofertas", "optica promociones", "centro bienestar"],
  "Transporte y movilidad": ["taxi local", "transporte mayores", "alquiler movilidad"],
  "Viajes y ocio": ["actividades mayores descuentos", "cine descuentos mayores", "museo actividades"],
  Vivienda: ["servicios vivienda mayores", "asesoria vivienda", "residencias informacion"],
  "Compras generales": ["ofertas tiendas", "descuentos mayores", "centro comercial ofertas"],
};

function normaliseLocale(locale: unknown): string {
  const value = typeof locale === "string" ? locale.split("-")[0].toLowerCase() : "es";
  return ["es", "en", "de", "fr", "it", "pt"].includes(value) ? value : "es";
}

function classifyCategory(query: string, explicit?: string): OfferCategory {
  if (explicit && CATEGORY_SEARCH_TERMS[explicit as OfferCategory]) return explicit as OfferCategory;
  const match = CATEGORY_ALIASES.find((entry) => entry.terms.test(query));
  return match?.category ?? "Compras generales";
}

function isDeliveryPreferred(text: string): boolean {
  return /(delivery|entrega|domicilio|casa|home|a domicilio|movilidad reducida|reducida|limited mobility)/i.test(text);
}

function isPriceSensitive(text: string): boolean {
  return /(barato|ahorro|econom|descuento|oferta|cheap|save|discount|low cost)/i.test(text);
}

async function getOfferProfileContext(userId: string): Promise<OfferProfileContext> {
  const [profileRows, companionRows, socialRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
    db.select().from(companionProfiles).where(eq(companionProfiles.user_id, userId)).limit(1).catch(() => []),
    db.select().from(socialUserInterests).where(eq(socialUserInterests.user_id, userId)).limit(1).catch(() => []),
  ]);

  const profile = profileRows[0] as any;
  const companion = companionRows[0] as any;
  const social = socialRows[0] as any;
  const consent = (profile?.data_sharing_consent ?? {}) as Record<string, any>;
  const profileText = JSON.stringify({
    consent,
    companion,
    social,
  });

  return {
    city: profile?.city?.trim() || "",
    region: profile?.region?.trim() || "",
    countryCode: profile?.country_code?.trim() || "ES",
    mobilityPreference: isDeliveryPreferred(profileText) ? "delivery" : "either",
    priceSensitivity: isPriceSensitive(profileText) ? "high" : "medium",
    interests: [
      ...(Array.isArray(companion?.interests) ? companion.interests : []),
      ...(Array.isArray(companion?.hobbies) ? companion.hobbies : []),
      ...(Array.isArray(social?.interest_tags) ? social.interest_tags : []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length > 0),
  };
}

function trustedSourceGuidance(category: OfferCategory, countryCode: string): string[] {
  const base = [
    "negocios locales verificados",
    "servicios publicos o municipales",
    "programas comunitarios",
  ];
  if (category === "Salud y bienestar") base.unshift("farmacias y redes sanitarias");
  if (category === "Viajes y ocio") base.unshift("agendas municipales y centros culturales");
  if (category === "Alimentacion") base.unshift("supermercados y mercados locales conocidos");
  if (countryCode.toUpperCase() !== "ES") base.push("directorios locales fiables del pais");
  return base;
}

async function searchGooglePlaces(
  query: string,
  context: OfferProfileContext,
  locale: string,
): Promise<PlaceCandidate[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const place = [context.city, context.region, context.countryCode].filter(Boolean).join(", ");
  if (!key || !place) return [];

  const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  searchUrl.searchParams.set("query", `${query} ${place}`);
  searchUrl.searchParams.set("language", locale);
  searchUrl.searchParams.set("key", key);

  const response = await fetch(searchUrl, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) return [];
  const data = await response.json() as {
    results?: Array<{
      place_id?: string;
      name?: string;
      formatted_address?: string;
      rating?: number;
      user_ratings_total?: number;
      price_level?: number;
      opening_hours?: { open_now?: boolean };
      business_status?: string;
    }>;
  };

  const safeResults = (data.results ?? [])
    .filter((item) => item.name && item.business_status !== "CLOSED_PERMANENTLY")
    .filter((item) => !item.rating || item.rating >= 3.8)
    .slice(0, 8);

  const detailed = await Promise.all(safeResults.map(async (item) => {
    if (!item.place_id) {
      return {
        name: item.name!,
        address: item.formatted_address,
        rating: item.rating,
        reviewCount: item.user_ratings_total,
        priceLevel: item.price_level,
        openNow: item.opening_hours?.open_now,
        source: "Google Places",
        sourceType: "verified_local_business" as const,
      };
    }

    const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detailsUrl.searchParams.set("place_id", item.place_id);
    detailsUrl.searchParams.set("language", locale);
    detailsUrl.searchParams.set("fields", "name,formatted_address,formatted_phone_number,website,url,opening_hours,price_level,rating,user_ratings_total");
    detailsUrl.searchParams.set("key", key);

    const detailsResponse = await fetch(detailsUrl, { signal: AbortSignal.timeout(7000) }).catch(() => null);
    if (!detailsResponse?.ok) {
      return {
        name: item.name!,
        address: item.formatted_address,
        rating: item.rating,
        reviewCount: item.user_ratings_total,
        priceLevel: item.price_level,
        openNow: item.opening_hours?.open_now,
        source: "Google Places",
        sourceType: "verified_local_business" as const,
      };
    }

    const details = await detailsResponse.json() as {
      result?: {
        name?: string;
        formatted_address?: string;
        formatted_phone_number?: string;
        website?: string;
        url?: string;
        opening_hours?: { open_now?: boolean };
        price_level?: number;
        rating?: number;
        user_ratings_total?: number;
      };
    };
    const result = details.result;
    return {
      name: result?.name ?? item.name!,
      address: result?.formatted_address ?? item.formatted_address,
      phone: result?.formatted_phone_number,
      website: result?.website,
      mapsUrl: result?.url,
      rating: result?.rating ?? item.rating,
      reviewCount: result?.user_ratings_total ?? item.user_ratings_total,
      priceLevel: result?.price_level ?? item.price_level,
      openNow: result?.opening_hours?.open_now ?? item.opening_hours?.open_now,
      source: "Google Places",
      sourceType: "verified_local_business" as const,
    };
  }));

  return detailed;
}

function scoreCandidate(candidate: PlaceCandidate, category: OfferCategory, context: OfferProfileContext, query: string) {
  const addressText = candidate.address?.toLowerCase() ?? "";
  const cityMatch = context.city && addressText.includes(context.city.toLowerCase()) ? 1 : 0.65;
  const distance = Math.round(cityMatch * 100);

  const priceBase = typeof candidate.priceLevel === "number"
    ? Math.max(35, 100 - candidate.priceLevel * 18)
    : 68;
  const priceBoost = context.priceSensitivity === "high" ? 8 : 0;
  const price_value = Math.min(100, priceBase + priceBoost);

  const ratingScore = candidate.rating ? Math.min(100, candidate.rating * 18) : 58;
  const reviewScore = candidate.reviewCount ? Math.min(20, Math.log10(candidate.reviewCount + 1) * 8) : 0;
  const trust = Math.round(Math.min(100, ratingScore + reviewScore));

  const simplicity = candidate.phone || candidate.website || candidate.mapsUrl ? 88 : 55;

  const text = `${candidate.name} ${candidate.address ?? ""} ${query}`.toLowerCase();
  const categoryFit = CATEGORY_SEARCH_TERMS[category].some((term) => text.includes(term.split(" ")[0].toLowerCase())) ? 78 : 62;
  const deliveryFit = context.mobilityPreference === "delivery" && /domicilio|delivery|entrega|farmacia|supermercado/i.test(text) ? 18 : 0;
  const preference_match = Math.min(100, categoryFit + deliveryFit);

  const total = Math.round(
    distance * 0.3 +
    price_value * 0.25 +
    trust * 0.25 +
    simplicity * 0.1 +
    preference_match * 0.1,
  );

  return { total, breakdown: { distance, price_value, trust, simplicity, preference_match } };
}

function advantageText(candidate: PlaceCandidate, locale: string): string {
  const es = locale === "es";
  if (typeof candidate.priceLevel === "number") {
    const level = "€".repeat(Math.min(Math.max(candidate.priceLevel, 1), 4));
    return es ? `Nivel de precio aproximado: ${level}. Confirmar la oferta antes de comprar.` : `Approximate price level: ${level}. Confirm the offer before buying.`;
  }
  return es ? "Ventaja pendiente de confirmar; VYVA puede revisar web o llamar." : "Advantage needs confirmation; VYVA can check the website or call.";
}

function contactText(candidate: PlaceCandidate, locale: string): string {
  const es = locale === "es";
  if (candidate.phone) return es ? `Llamar: ${candidate.phone}` : `Call: ${candidate.phone}`;
  if (candidate.website) return es ? "Web disponible" : "Website available";
  if (candidate.mapsUrl) return es ? "Abrir en mapa" : "Open map";
  return es ? "Contacto no publicado; revisar antes." : "No published contact; check first.";
}

function buildRankedOffer(
  candidate: PlaceCandidate,
  category: OfferCategory,
  context: OfferProfileContext,
  query: string,
  locale: string,
  index: number,
): RankedOffer {
  const es = locale === "es";
  const score = scoreCandidate(candidate, category, context, query);
  const rating = candidate.rating
    ? `${candidate.rating}/5${candidate.reviewCount ? ` (${candidate.reviewCount})` : ""}`
    : es ? "valoraciones no suficientes" : "not enough rating data";
  const availability = candidate.openNow === true
    ? es ? "Aparece abierto ahora" : "Appears open now"
    : candidate.openNow === false
      ? es ? "Puede estar cerrado ahora" : "May be closed now"
      : es ? "Disponibilidad por confirmar" : "Availability to confirm";

  return {
    label: index === 0 ? "Opcion recomendada" : index === 1 ? "Alternativa 1" : "Alternativa 2",
    name: candidate.name,
    category,
    what_it_offers: es
      ? `Opcion local relacionada con ${category.toLowerCase()}.`
      : `Local option related to ${category}.`,
    price_or_advantage: advantageText(candidate, locale),
    why_good_option: es
      ? `Buena combinacion de cercania, confianza y facilidad. Fuente: ${candidate.source}.`
      : `Good balance of proximity, trust, and ease. Source: ${candidate.source}.`,
    distance_or_availability: [candidate.address, availability].filter(Boolean).join(" · "),
    contact_method: contactText(candidate, locale),
    phone: candidate.phone,
    website: candidate.website,
    maps_url: candidate.mapsUrl,
    trust_note: es
      ? `Confianza: ${rating}. ${candidate.rating && candidate.rating < 4.2 ? "Es economica o cercana, pero conviene revisar opiniones." : "Datos suficientes para considerarla."}`
      : `Trust: ${rating}. ${candidate.rating && candidate.rating < 4.2 ? "It may be convenient, but reviews should be checked." : "Enough data to consider it."}`,
    score: score.total,
    score_breakdown: score.breakdown,
  };
}

async function buildOffers(query: string, category: OfferCategory, context: OfferProfileContext, locale: string) {
  const searchTerms = [
    query,
    ...CATEGORY_SEARCH_TERMS[category],
    context.mobilityPreference === "delivery" ? "domicilio entrega" : "",
    context.priceSensitivity === "high" ? "descuento ahorro" : "",
  ].filter(Boolean);

  const allResults = (await Promise.all(
    searchTerms.slice(0, 4).map((term) => searchGooglePlaces(term, context, locale).catch(() => [])),
  )).flat();

  const deduped = Array.from(
    new Map(allResults.map((candidate) => [candidate.name.toLowerCase(), candidate])).values(),
  );

  return deduped
    .map((candidate) => buildRankedOffer(candidate, category, context, query, locale, 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((offer, index) => ({
      ...offer,
      label: index === 0 ? "Opcion recomendada" : index === 1 ? "Alternativa 1" : "Alternativa 2",
    }));
}

router.post("/search", async (req: Request, res: Response) => {
  const { query = "", category, locale = "es" } = req.body as OffersRequestBody;
  const cleanedQuery = query.trim();
  if (!cleanedQuery && !category) {
    return res.status(400).json({ error: "query or category is required" });
  }

  const normalizedLocale = normaliseLocale(locale);
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const context = await getOfferProfileContext(userId);
  const classifiedCategory = classifyCategory(cleanedQuery, category);

  try {
    const offers = await buildOffers(cleanedQuery || classifiedCategory, classifiedCategory, context, normalizedLocale);
    const es = normalizedLocale === "es";
    return res.json({
      category: classifiedCategory,
      options: offers,
      decision_explanation: es
        ? "Como he elegido estas opciones: he priorizado cercania, precio o valor, confianza, facilidad de contacto y preferencias del usuario cuando estaban disponibles."
        : "How I chose these options: I prioritised proximity, price or value, trust, ease of contact, and user preferences when available.",
      neutrality_note: es
        ? "VYVA no recibe comisiones ni promociona servicios. Estas opciones se muestran de forma neutral para ayudarle a elegir lo mejor para usted."
        : "VYVA does not receive commissions or promote services. These options are shown neutrally to help you choose what is best for you.",
      source_guidance: trustedSourceGuidance(classifiedCategory, context.countryCode),
      next_step: es
        ? "Puedo ayudarle a llamar, abrir la web, comparar mas opciones o guardar su preferencia para la proxima vez."
        : "I can help call, open the website, compare more options, or save your preference for next time.",
      no_results_message: offers.length === 0
        ? es
          ? "No he encontrado suficientes opciones verificadas ahora mismo. Es mejor no inventar ofertas; pruebe una categoria mas concreta o una zona cercana."
          : "I could not find enough verified options right now. It is better not to invent offers; try a more specific category or nearby area."
        : "",
    });
  } catch (err) {
    console.error("[offers/search]", err);
    return res.status(500).json({ error: "Failed to search offers" });
  }
});

export default router;
