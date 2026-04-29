import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
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
  document_context?: BillDocumentAnalysis;
}

type BillDocumentType =
  | "electricity_bill"
  | "gas_bill"
  | "internet_phone_bill"
  | "insurance_policy"
  | "home_service_invoice"
  | "unknown";

type ConfidenceLevel = "high" | "medium" | "low";
type BillFallbackReason = "missing_api_key" | "invalid_model_json" | "openai_error" | "unreadable";

interface BillDocumentAnalysis {
  document_type: BillDocumentType;
  category: OfferCategory;
  provider_name: string | null;
  billing_period: string | null;
  total_amount: number | null;
  currency: string | null;
  usage: {
    kwh: number | null;
    gas_kwh: number | null;
    data_or_phone_plan: string | null;
  };
  tariff_or_plan: string | null;
  unit_prices: {
    electricity_price_per_kwh: number | null;
    gas_price_per_kwh: number | null;
    standing_charge: number | null;
  };
  confidence: ConfidenceLevel;
  missing_fields: string[];
  suggested_query: string;
  user_summary: string;
  isFallback?: boolean;
  fallback_reason?: BillFallbackReason;
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

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  es: "Spanish",
  en: "English",
  de: "German",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
};

function fallbackDocumentAnalysis(locale = "es", reason: BillFallbackReason = "unreadable"): BillDocumentAnalysis {
  const lang = normaliseLocale(locale);
  const copy = {
    es: {
      missing: ["tipo de documento", "compania", "importe", "periodo"],
      query: "revisar una factura de servicios importantes",
      unavailable: "Ahora mismo no puedo leer la factura automaticamente. Puede rellenar los datos a mano o intentarlo de nuevo.",
      parse: "He visto la factura, pero no he podido convertirla en datos fiables. Puede rellenar los datos a mano.",
      summary: "No he podido leer esta factura con suficiente claridad. Prueba con una foto mas nitida y completa.",
    },
    de: {
      missing: ["Dokumenttyp", "Anbieter", "Betrag", "Zeitraum"],
      query: "wichtige Servicerechnung pruefen",
      unavailable: "Ich kann die Rechnung im Moment nicht automatisch lesen. Sie koennen die Daten manuell eingeben oder es erneut versuchen.",
      parse: "Ich habe die Rechnung erkannt, konnte sie aber nicht sicher in Daten umwandeln. Sie koennen die Daten manuell eingeben.",
      summary: "Ich konnte diese Rechnung nicht klar genug lesen. Bitte versuchen Sie es mit einem schaerferen, vollstaendigen Foto.",
    },
    fr: {
      missing: ["type de document", "fournisseur", "montant", "periode"],
      query: "examiner une facture de service importante",
      unavailable: "Je ne peux pas lire automatiquement la facture pour le moment. Vous pouvez saisir les donnees manuellement ou reessayer.",
      parse: "J'ai vu la facture, mais je n'ai pas pu la convertir en donnees fiables. Vous pouvez saisir les donnees manuellement.",
      summary: "Je n'ai pas pu lire cette facture assez clairement. Essayez avec une photo plus nette et complete.",
    },
    it: {
      missing: ["tipo di documento", "fornitore", "importo", "periodo"],
      query: "controllare una bolletta o fattura importante",
      unavailable: "Al momento non posso leggere automaticamente la fattura. Puoi inserire i dati manualmente o riprovare.",
      parse: "Ho visto la fattura, ma non sono riuscita a trasformarla in dati affidabili. Puoi inserire i dati manualmente.",
      summary: "Non sono riuscita a leggere bene questa fattura. Prova con una foto piu nitida e completa.",
    },
    pt: {
      missing: ["tipo de documento", "fornecedor", "valor", "periodo"],
      query: "rever uma fatura de servico importante",
      unavailable: "Neste momento nao consigo ler a fatura automaticamente. Pode preencher os dados manualmente ou tentar novamente.",
      parse: "Vi a fatura, mas nao consegui transforma-la em dados fiaveis. Pode preencher os dados manualmente.",
      summary: "Nao consegui ler esta fatura com clareza suficiente. Tente uma foto mais nitida e completa.",
    },
    en: {
      missing: ["document type", "provider", "amount", "period"],
      query: "review an important service bill",
      unavailable: "I cannot read the bill automatically right now. You can enter the details manually or try again.",
      parse: "I saw the bill, but could not turn it into reliable data. You can enter the details manually.",
      summary: "I could not read this bill clearly enough. Try a sharper, complete photo.",
    },
  } as const;
  const text = copy[lang as keyof typeof copy] ?? copy.en;
  const userSummary = reason === "missing_api_key" || reason === "openai_error"
    ? text.unavailable
    : reason === "invalid_model_json"
      ? text.parse
      : text.summary;
  return {
    document_type: "unknown",
    category: "Gastos del hogar",
    provider_name: null,
    billing_period: null,
    total_amount: null,
    currency: null,
    usage: {
      kwh: null,
      gas_kwh: null,
      data_or_phone_plan: null,
    },
    tariff_or_plan: null,
    unit_prices: {
      electricity_price_per_kwh: null,
      gas_price_per_kwh: null,
      standing_charge: null,
    },
    confidence: "low",
    missing_fields: [...text.missing],
    suggested_query: text.query,
    user_summary: userSummary,
    isFallback: true,
    fallback_reason: reason,
  };
}

function buildDocumentPrompt(locale: string): string {
  const language = LOCALE_TO_LANGUAGE[normaliseLocale(locale)] ?? "Spanish";
  return `You are VYVA's neutral bill-reading assistant for older adults.
Read the uploaded image of a bill, invoice, policy, or receipt. Extract only visible facts. Never invent values.
The image may be a screenshot or cropped view of an online bill. It can still be useful even if the provider name, customer name, or billing period is not visible.

Return ONLY valid JSON with this exact shape:
{
  "document_type": "electricity_bill | gas_bill | internet_phone_bill | insurance_policy | home_service_invoice | unknown",
  "category": "Gastos del hogar | Seguros y proteccion | Servicios en casa",
  "provider_name": "provider/company name or null",
  "billing_period": "billing period or null",
  "total_amount": 0,
  "currency": "EUR or other currency or null",
  "usage": {
    "kwh": 0,
    "gas_kwh": 0,
    "data_or_phone_plan": "plan detail or null"
  },
  "tariff_or_plan": "tariff, contract, or plan name or null",
  "unit_prices": {
    "electricity_price_per_kwh": 0,
    "gas_price_per_kwh": 0,
    "standing_charge": 0
  },
  "confidence": "high | medium | low",
  "missing_fields": ["short missing field names"],
  "suggested_query": "short search/comparison query using visible facts",
  "user_summary": "short friendly summary for the user"
}

Rules:
- total_amount and unit prices must be numbers, not strings. Use null if not visible.
- For electricity bills, prioritise visible consumption in kWh, total amount, energy cost, power/standing charge, taxes, tariff, period, and company.
- If you see Spanish labels such as "Importe a pagar", "Energia consumida", "Potencia contratada", "Tu consumo total realizado", or "kWh", classify it as "electricity_bill".
- Missing provider_name or billing_period must NOT make the document unknown if total amount or kWh are visible.
- If amount and kWh are clearly visible but provider/period are cropped out, use confidence "medium", not "low".
- If the image is not a relevant bill/invoice/policy, set document_type to "unknown" and confidence to "low".
- Do not extract account numbers, bank details, full ID numbers, or private reference numbers.
- Write user_summary and missing_fields in ${language}.
- Keep user_summary under 28 words.`;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 180) : null;
}

function safeConfidence(value: unknown): ConfidenceLevel {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function safeDocumentType(value: unknown): BillDocumentType {
  const valid = new Set<BillDocumentType>([
    "electricity_bill",
    "gas_bill",
    "internet_phone_bill",
    "insurance_policy",
    "home_service_invoice",
    "unknown",
  ]);
  return typeof value === "string" && valid.has(value as BillDocumentType)
    ? value as BillDocumentType
    : "unknown";
}

function categoryFromDocumentType(type: BillDocumentType, rawCategory: unknown): OfferCategory {
  if (typeof rawCategory === "string" && CATEGORY_SEARCH_TERMS[rawCategory as OfferCategory]) {
    return rawCategory as OfferCategory;
  }
  if (type === "insurance_policy") return "Seguros y proteccion";
  if (type === "home_service_invoice") return "Servicios en casa";
  return "Gastos del hogar";
}

function localizedElectricityDetected(locale: string): string {
  switch (normaliseLocale(locale)) {
    case "es":
      return "He detectado una factura de luz para revisar.";
    case "de":
      return "Ich habe eine Stromrechnung zur Pruefung erkannt.";
    case "fr":
      return "J'ai detecte une facture d'electricite a examiner.";
    case "it":
      return "Ho rilevato una bolletta elettrica da controllare.";
    case "pt":
      return "Detetei uma fatura de eletricidade para rever.";
    default:
      return "I detected an electricity bill to review.";
  }
}

function localizedBillDetected(locale: string, providerName: string | null): string {
  if (providerName) {
    switch (normaliseLocale(locale)) {
      case "es":
        return `He detectado una factura de ${providerName}.`;
      case "de":
        return `Ich habe eine Rechnung von ${providerName} erkannt.`;
      case "fr":
        return `J'ai detecte une facture de ${providerName}.`;
      case "it":
        return `Ho rilevato una fattura di ${providerName}.`;
      case "pt":
        return `Detetei uma fatura de ${providerName}.`;
      default:
        return `I detected a bill from ${providerName}.`;
    }
  }
  switch (normaliseLocale(locale)) {
    case "es":
      return "He detectado una factura para revisar.";
    case "de":
      return "Ich habe eine Rechnung zur Pruefung erkannt.";
    case "fr":
      return "J'ai detecte une facture a examiner.";
    case "it":
      return "Ho rilevato una fattura da controllare.";
    case "pt":
      return "Detetei uma fatura para rever.";
    default:
      return "I detected a bill to review.";
  }
}

function normaliseDocumentAnalysis(parsed: Record<string, unknown>, locale: string): BillDocumentAnalysis {
  let documentType = safeDocumentType(parsed.document_type);
  const category = categoryFromDocumentType(documentType, parsed.category);
  const usage = parsed.usage && typeof parsed.usage === "object"
    ? parsed.usage as Record<string, unknown>
    : {};
  const unitPrices = parsed.unit_prices && typeof parsed.unit_prices === "object"
    ? parsed.unit_prices as Record<string, unknown>
    : {};
  const missingFields = Array.isArray(parsed.missing_fields)
    ? parsed.missing_fields.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
    : [];
  const lang = normaliseLocale(locale);
  const es = lang === "es";
  const suggestedQuery = safeString(parsed.suggested_query)
    ?? (es ? "comparar factura de servicios" : "compare service bill");
  const providerName = safeString(parsed.provider_name);
  const visibleKwh = safeNumber(usage.kwh);
  const totalAmount = safeNumber(parsed.total_amount);
  if (documentType === "unknown" && visibleKwh != null) {
    documentType = "electricity_bill";
  }
  const userSummary = safeString(parsed.user_summary)
    ?? (providerName
      ? localizedBillDetected(lang, providerName)
      : documentType === "electricity_bill"
        ? localizedElectricityDetected(lang)
        : localizedBillDetected(lang, null));

  return {
    document_type: documentType,
    category: categoryFromDocumentType(documentType, parsed.category),
    provider_name: providerName,
    billing_period: safeString(parsed.billing_period),
    total_amount: totalAmount,
    currency: safeString(parsed.currency),
    usage: {
      kwh: visibleKwh,
      gas_kwh: safeNumber(usage.gas_kwh),
      data_or_phone_plan: safeString(usage.data_or_phone_plan),
    },
    tariff_or_plan: safeString(parsed.tariff_or_plan),
    unit_prices: {
      electricity_price_per_kwh: safeNumber(unitPrices.electricity_price_per_kwh),
      gas_price_per_kwh: safeNumber(unitPrices.gas_price_per_kwh),
      standing_charge: safeNumber(unitPrices.standing_charge),
    },
    confidence: safeConfidence(parsed.confidence),
    missing_fields: missingFields,
    suggested_query: suggestedQuery,
    user_summary: userSummary,
  };
}

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

function documentContextQuery(documentContext: BillDocumentAnalysis | undefined, locale: string): string {
  if (!documentContext || documentContext.document_type === "unknown") return "";
  const es = locale === "es";
  const parts = [
    documentContext.provider_name,
    documentContext.tariff_or_plan,
    documentContext.total_amount != null
      ? `${documentContext.total_amount} ${documentContext.currency ?? ""}`.trim()
      : "",
    documentContext.usage.kwh != null ? `${documentContext.usage.kwh} kWh` : "",
    documentContext.usage.gas_kwh != null ? `${documentContext.usage.gas_kwh} kWh gas` : "",
    documentContext.billing_period,
  ].filter(Boolean);

  if (documentContext.document_type === "electricity_bill") {
    return es
      ? `comparar tarifa de luz con factura actual ${parts.join(" ")}`
      : `compare electricity tariff with current bill ${parts.join(" ")}`;
  }
  if (documentContext.document_type === "gas_bill") {
    return es
      ? `comparar tarifa de gas con factura actual ${parts.join(" ")}`
      : `compare gas tariff with current bill ${parts.join(" ")}`;
  }
  if (documentContext.document_type === "internet_phone_bill") {
    return es
      ? `comparar internet telefono con plan actual ${parts.join(" ")}`
      : `compare internet phone with current plan ${parts.join(" ")}`;
  }
  if (documentContext.document_type === "insurance_policy") {
    return es
      ? `revisar seguro actual cobertura precio ${parts.join(" ")}`
      : `review current insurance coverage price ${parts.join(" ")}`;
  }
  return es
    ? `comparar factura o servicio actual ${parts.join(" ")}`
    : `compare current bill or service ${parts.join(" ")}`;
}

function documentDecisionContext(documentContext: BillDocumentAnalysis | undefined, locale: string): string {
  if (!documentContext || documentContext.document_type === "unknown") return "";
  const es = locale === "es";
  const facts = [
    documentContext.provider_name ? (es ? `compania: ${documentContext.provider_name}` : `provider: ${documentContext.provider_name}`) : "",
    documentContext.total_amount != null ? (es ? `total: ${documentContext.total_amount} ${documentContext.currency ?? ""}` : `total: ${documentContext.total_amount} ${documentContext.currency ?? ""}`) : "",
    documentContext.usage.kwh != null ? `${documentContext.usage.kwh} kWh` : "",
    documentContext.tariff_or_plan ? (es ? `tarifa: ${documentContext.tariff_or_plan}` : `tariff: ${documentContext.tariff_or_plan}`) : "",
  ].filter(Boolean).join(", ");
  if (!facts) return "";
  return es
    ? ` He tenido en cuenta los datos leidos de la factura (${facts}).`
    : ` I considered the details read from the bill (${facts}).`;
}

async function buildOffers(query: string, category: OfferCategory, context: OfferProfileContext, locale: string, documentContext?: BillDocumentAnalysis) {
  const documentQuery = documentContextQuery(documentContext, locale);
  const searchTerms = [
    documentQuery,
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

export async function analyzeOfferDocumentHandler(req: Request, res: Response) {
  const { image, locale = "es" } = req.body as { image?: string; locale?: string };
  const normalizedLocale = normaliseLocale(locale);

  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image (base64 data URL) is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    console.warn("[offers/analyze-document] OPENAI_API_KEY not set");
    return res.json(fallbackDocumentAnalysis(normalizedLocale, "missing_api_key"));
  }

  const match = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "image must be a base64 data URL" });
  }
  const mimeType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const base64Data = match[2];

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildDocumentPrompt(normalizedLocale) },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Read this bill or invoice and extract neutral comparison facts. Do not store or reveal private account numbers.",
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("[offers/analyze-document] Failed to parse model JSON");
      return res.json(fallbackDocumentAnalysis(normalizedLocale, "invalid_model_json"));
    }

    return res.json(normaliseDocumentAnalysis(parsed, normalizedLocale));
  } catch (err) {
    console.error("[offers/analyze-document] OpenAI error:", err);
    return res.json(fallbackDocumentAnalysis(normalizedLocale, "openai_error"));
  }
}

router.post("/search", async (req: Request, res: Response) => {
  const { query = "", category, locale = "es", document_context } = req.body as OffersRequestBody;
  const cleanedQuery = query.trim();
  if (!cleanedQuery && !category) {
    return res.status(400).json({ error: "query or category is required" });
  }

  const normalizedLocale = normaliseLocale(locale);
  const userId = (req as any).user?.id ?? DEMO_USER_ID;
  const context = await getOfferProfileContext(userId);
  const documentContext = document_context && typeof document_context === "object"
    ? normaliseDocumentAnalysis(document_context as unknown as Record<string, unknown>, normalizedLocale)
    : undefined;
  const classifiedCategory = documentContext?.category ?? classifyCategory(cleanedQuery, category);

  try {
    const offers = await buildOffers(cleanedQuery || classifiedCategory, classifiedCategory, context, normalizedLocale, documentContext);
    const es = normalizedLocale === "es";
    const documentNote = documentDecisionContext(documentContext, normalizedLocale);
    return res.json({
      category: classifiedCategory,
      options: offers,
      decision_explanation: es
        ? `Como he elegido estas opciones: he priorizado precio o valor, confianza, facilidad, adecuacion a su situacion y cercania cuando era relevante.${documentNote}`
        : `How I chose these options: I prioritised price or value, trust, ease, fit for your situation, and proximity when relevant.${documentNote}`,
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
