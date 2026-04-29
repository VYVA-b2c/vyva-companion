import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles, companionProfiles, socialUserInterests } from "../../shared/schema.js";

const router = Router();
const DEMO_USER_ID = "demo-user";

type OfferCategory =
  | "Gastos del hogar"
  | "Vivienda y cuidados"
  | "Seguros y proteccion"
  | "Servicios en casa"
  | "Ayudas y beneficios";

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
  { category: "Gastos del hogar", terms: /(luz|electric|gas|internet|telefono|factura|tarifa|mantenimiento|comunidad|bill|utility|phone|broadband|maintenance)/i },
  { category: "Vivienda y cuidados", terms: /(residencia|centro de dia|cuidad|ayuda a domicilio|dependencia|estancia|care|home help|day centre|residence|nursing)/i },
  { category: "Seguros y proteccion", terms: /(seguro|poliza|cobertura|proteccion|asistencia|vida|hogar|salud|insurance|coverage|protection)/i },
  { category: "Servicios en casa", terms: /(limpieza|reparaci|fontaner|electricista|mantenimiento|cuidado personal|profesional|clean|repair|plumb|home service)/i },
  { category: "Ayudas y beneficios", terms: /(ayuda|beneficio|subvencion|municipal|social|mayores|apoyo|grant|benefit|public support|local support)/i },
];

const CATEGORY_SEARCH_TERMS: Record<OfferCategory, string[]> = {
  "Gastos del hogar": ["comparador electricidad gas oficial", "internet telefono mayores", "asesoria ahorro facturas hogar"],
  "Vivienda y cuidados": ["residencias mayores verificadas", "centros de dia mayores", "ayuda a domicilio mayores"],
  "Seguros y proteccion": ["seguro salud mayores", "seguro hogar comparador", "asistencia dependencia mayores"],
  "Servicios en casa": ["limpieza domicilio verificada", "reparaciones hogar verificadas", "mantenimiento hogar mayores"],
  "Ayudas y beneficios": ["ayudas municipales mayores", "beneficios mayores", "subvenciones dependencia mayores"],
};

function normaliseLocale(locale: unknown): string {
  const value = typeof locale === "string" ? locale.split("-")[0].toLowerCase() : "es";
  return ["es", "en", "de", "fr", "it", "pt"].includes(value) ? value : "es";
}

function classifyCategory(query: string, explicit?: string): OfferCategory {
  if (explicit && CATEGORY_SEARCH_TERMS[explicit as OfferCategory]) return explicit as OfferCategory;
  const match = CATEGORY_ALIASES.find((entry) => entry.terms.test(query));
  return match?.category ?? "Gastos del hogar";
}

function isDeliveryPreferred(text: string): boolean {
  return /(delivery|entrega|domicilio|casa|home|a domicilio|movilidad reducida|reducida|limited mobility)/i.test(text);
}

function isPriceSensitive(text: string): boolean {
  return /(barato|ahorro|econom|descuento|oferta|factura|precio|cheap|save|discount|low cost|bill|price)/i.test(text);
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
  if (category === "Gastos del hogar") base.unshift("comparadores oficiales o regulados");
  if (category === "Vivienda y cuidados") base.unshift("directorios publicos de cuidados y centros acreditados");
  if (category === "Seguros y proteccion") base.unshift("aseguradoras reconocidas y fuentes regulatorias");
  if (category === "Ayudas y beneficios") base.unshift("servicios publicos, ayuntamiento y programas sociales");
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

function buildGuidedCandidates(
  category: OfferCategory,
  context: OfferProfileContext,
  locale: string,
): PlaceCandidate[] {
  const es = locale === "es";
  const cityLabel = [context.city, context.region].filter(Boolean).join(", ");
  const localArea = cityLabel || (es ? "su zona" : "your area");
  const source = es ? "VYVA revision guiada" : "VYVA guided review";

  const templates: Record<OfferCategory, PlaceCandidate[]> = {
    "Gastos del hogar": [
      {
        name: es ? "Revisar factura de luz o gas" : "Review electricity or gas bill",
        address: localArea,
        source,
        sourceType: "public_or_community",
      },
      {
        name: es ? "Comparar internet y telefono" : "Compare internet and phone",
        address: localArea,
        source,
        sourceType: "known_platform",
      },
      {
        name: es ? "Detectar permanencias y cargos ocultos" : "Find commitments and hidden charges",
        address: localArea,
        source,
        sourceType: "known_platform",
      },
    ],
    "Vivienda y cuidados": [
      {
        name: es ? "Comparar ayuda a domicilio" : "Compare home help",
        address: localArea,
        source,
        sourceType: "public_or_community",
      },
      {
        name: es ? "Revisar centros de dia cercanos" : "Review nearby day centres",
        address: localArea,
        source,
        sourceType: "public_or_community",
      },
      {
        name: es ? "Comparar residencias de mayores" : "Compare senior residences",
        address: localArea,
        source,
        sourceType: "public_or_community",
      },
    ],
    "Seguros y proteccion": [
      {
        name: es ? "Revisar cobertura del seguro actual" : "Review current insurance coverage",
        address: localArea,
        source,
        sourceType: "known_platform",
      },
      {
        name: es ? "Buscar cobertura mas adecuada" : "Find more suitable coverage",
        address: localArea,
        source,
        sourceType: "known_platform",
      },
      {
        name: es ? "Comprobar asistencia y dependencia" : "Check assistance and dependency support",
        address: localArea,
        source,
        sourceType: "public_or_community",
      },
    ],
    "Servicios en casa": [
      {
        name: es ? "Buscar profesional verificado en casa" : "Find verified help at home",
        address: localArea,
        source,
        sourceType: "verified_local_business",
      },
      {
        name: es ? "Comparar limpieza o mantenimiento" : "Compare cleaning or maintenance",
        address: localArea,
        source,
        sourceType: "verified_local_business",
      },
      {
        name: es ? "Preparar llamada con requisitos claros" : "Prepare a call with clear requirements",
        address: localArea,
        source,
        sourceType: "known_platform",
      },
    ],
    "Ayudas y beneficios": [
      {
        name: es ? "Comprobar ayudas municipales" : "Check municipal benefits",
        address: localArea,
        source: es ? "Ayuntamiento y servicios sociales" : "Town hall and social services",
        sourceType: "public_or_community",
      },
      {
        name: es ? "Revisar beneficios para mayores" : "Review senior benefits",
        address: localArea,
        source: es ? "Programas publicos y comunitarios" : "Public and community programmes",
        sourceType: "public_or_community",
      },
      {
        name: es ? "Preparar documentos necesarios" : "Prepare required documents",
        address: localArea,
        source,
        sourceType: "public_or_community",
      },
    ],
  };

  return templates[category];
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
  const deliveryFit = context.mobilityPreference === "delivery" && /domicilio|delivery|casa|ayuda a domicilio|home help|at home/i.test(text) ? 18 : 0;
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

function serviceValueText(candidate: PlaceCandidate, locale: string): string {
  const es = locale === "es";
  if (typeof candidate.priceLevel === "number") {
    const level = "EUR ".repeat(Math.min(Math.max(candidate.priceLevel, 1), 4)).trim();
    return es
      ? `Nivel de precio aproximado: ${level}. Conviene confirmar condiciones, permanencia y coste real.`
      : `Approximate price level: ${level}. Confirm terms, commitment, and real cost.`;
  }
  return es
    ? "Coste o ventaja pendiente de confirmar; VYVA puede revisar la web o llamar."
    : "Cost or advantage needs confirmation; VYVA can check the website or call.";
}

function contactText(candidate: PlaceCandidate, locale: string): string {
  const es = locale === "es";
  if (candidate.phone) return es ? `Llamar: ${candidate.phone}` : `Call: ${candidate.phone}`;
  if (candidate.website) return es ? "Web disponible" : "Website available";
  if (candidate.mapsUrl) return es ? "Abrir en mapa" : "Open map";
  if (candidate.sourceType === "public_or_community") return es ? "VYVA puede preparar los pasos" : "VYVA can prepare the steps";
  if (candidate.sourceType === "known_platform") return es ? "VYVA puede ayudar a comparar" : "VYVA can help compare";
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
      ? `Opcion verificable para ${category.toLowerCase()}.`
      : `Verifiable option for ${category}.`,
    price_or_advantage: serviceValueText(candidate, locale),
    why_good_option: es
      ? `Buena combinacion de adecuacion, confianza y facilidad. Fuente: ${candidate.source}.`
      : `Good balance of fit, trust, and ease. Source: ${candidate.source}.`,
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
  const guidedResults = allResults.length === 0
    ? buildGuidedCandidates(category, context, locale)
    : [];

  const deduped = Array.from(
    new Map([...allResults, ...guidedResults].map((candidate) => [candidate.name.toLowerCase(), candidate])).values(),
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
        ? "Como he elegido estas opciones: he priorizado precio o valor, confianza, facilidad, adecuacion a su situacion y cercania cuando era relevante."
        : "How I chose these options: I prioritised price or value, trust, ease, fit for your situation, and proximity when relevant.",
      neutrality_note: es
        ? "VYVA no recibe comisiones ni promociona servicios. Estas opciones se muestran de forma neutral para ayudarle a elegir lo mejor para usted."
        : "VYVA does not receive commissions or promote services. These options are shown neutrally to help you choose what is best for you.",
      source_guidance: trustedSourceGuidance(classifiedCategory, context.countryCode),
      next_step: es
        ? "Puedo ayudarle a revisar ahora, comparar opciones, contactar un proveedor, guardar un recordatorio o enviar un resumen por WhatsApp."
        : "I can help review now, compare options, contact a provider, save a reminder, or send a WhatsApp summary.",
      no_results_message: offers.length === 0
        ? es
          ? "No he encontrado suficientes opciones verificables ahora mismo. Es mejor no inventar; pruebe un servicio mas concreto o una zona cercana."
          : "I could not find enough verifiable options right now. It is better not to invent; try a more specific service or nearby area."
        : "",
    });
  } catch (err) {
    console.error("[offers/search]", err);
    return res.status(500).json({ error: "Failed to search offers" });
  }
});

export default router;
