export type SpecialistUrgency = "routine" | "soon" | "urgent";

export interface SpecialistSearchInput {
  condition: string;
  location?: string;
  language?: string;
  urgency?: SpecialistUrgency;
  insurancePreference?: string;
}

export interface SpecialistSource {
  name: string;
  sourceType: "official_network" | "marketplace" | "review_check" | "curated_fallback";
  trustTier: 1 | 2 | 3;
  url: string;
  notes: string;
}

export interface SpecialistProvider {
  name: string;
  specialty: string;
  specialtyLabel?: string;
  clinicName?: string;
  phone?: string | null;
  address?: string;
  bookingUrl?: string | null;
  sourceName: string;
  sourceUrl?: string;
  reviewScore?: number | null;
  reviewCount?: number | null;
  distanceLabel?: string | null;
  availabilityText?: string | null;
  openingTimes?: string | null;
  rationale: string;
  score: number;
}

export interface SpecialistRecommendationResult {
  condition: string;
  matchedSpecialties: string[];
  safetyNote: string;
  sourcesChecked: SpecialistSource[];
  providers: SpecialistProvider[];
  nextStep: string;
}

const SAFETY_NOTE =
  "VYVA can help find relevant specialists, but this is not a diagnosis or medical advice. If symptoms are severe, sudden, or worrying, contact emergency services or your GP.";

const CONDITION_SPECIALTY_MAP: Array<{
  keywords: string[];
  specialties: string[];
  redFlags?: string[];
}> = [
  {
    keywords: ["knee", "hip", "shoulder", "joint", "arthritis", "mobility", "fall", "rodilla", "cadera", "hombro", "articulacion", "caida"],
    specialties: ["Traumatology / Orthopaedics", "Physiotherapy", "Rheumatology"],
  },
  {
    keywords: ["memory", "confusion", "dementia", "alzheimer", "forget", "memoria", "confusion", "olvidos"],
    specialties: ["Neurology", "Geriatrics", "Neuropsychology"],
  },
  {
    keywords: ["diabetes", "sugar", "glucose", "insulin", "azucar", "glucosa"],
    specialties: ["Endocrinology", "Internal Medicine", "Diabetes Education"],
  },
  {
    keywords: ["skin", "rash", "mole", "wound", "eczema", "piel", "erupcion", "lunar", "herida"],
    specialties: ["Dermatology", "Wound Care Nursing"],
  },
  {
    keywords: ["heart", "chest", "blood pressure", "palpitations", "corazon", "pecho", "tension", "palpitaciones"],
    specialties: ["Cardiology", "Internal Medicine"],
    redFlags: ["chest pain", "dolor en el pecho"],
  },
  {
    keywords: ["breathing", "cough", "asthma", "copd", "respirar", "tos", "asma"],
    specialties: ["Pulmonology", "Internal Medicine"],
  },
  {
    keywords: ["stomach", "digestion", "bowel", "colon", "abdominal", "estomago", "digestion", "intestinal"],
    specialties: ["Gastroenterology", "Internal Medicine"],
  },
  {
    keywords: ["vision", "eye", "cataract", "vista", "ojo", "catarata"],
    specialties: ["Ophthalmology"],
  },
  {
    keywords: ["hearing", "ear", "dizzy", "oido", "audicion", "mareo"],
    specialties: ["ENT / Otolaryngology", "Audiology"],
  },
  {
    keywords: ["sleep", "insomnia", "snoring", "sueno", "insomnio", "ronquido"],
    specialties: ["Sleep Medicine", "Pulmonology", "Neurology"],
  },
  {
    keywords: ["anxiety", "depression", "mood", "ansiedad", "depresion", "animo"],
    specialties: ["Psychology", "Psychiatry", "GP"],
  },
];

const SPECIALTY_LABELS_ES: Record<string, string> = {
  "Traumatology / Orthopaedics": "Traumatologia / Ortopedia",
  Physiotherapy: "Fisioterapia",
  Rheumatology: "Reumatologia",
  Neurology: "Neurologia",
  Geriatrics: "Geriatria",
  Neuropsychology: "Neuropsicologia",
  Endocrinology: "Endocrinologia",
  "Internal Medicine": "Medicina interna",
  "Diabetes Education": "Educacion diabetologica",
  Dermatology: "Dermatologia",
  "Wound Care Nursing": "Enfermeria de heridas",
  Cardiology: "Cardiologia",
  Pulmonology: "Neumologia",
  Gastroenterology: "Digestivo",
  Ophthalmology: "Oftalmologia",
  "ENT / Otolaryngology": "Otorrinolaringologia",
  Audiology: "Audiologia",
  "Sleep Medicine": "Medicina del sueno",
  Psychology: "Psicologia",
  Psychiatry: "Psiquiatria",
  GP: "Medico de cabecera",
  "General Practice": "Medicina general",
};

function specialtyLabel(specialty: string, language: string): string {
  if (language.startsWith("es")) return SPECIALTY_LABELS_ES[specialty] ?? specialty;
  return specialty;
}

export const SPECIALIST_SOURCES: SpecialistSource[] = [
  {
    name: "QuironSalud",
    sourceType: "official_network",
    trustTier: 1,
    url: "https://www.quironsalud.com/en/50-000-professionals-service",
    notes: "Private hospital network with medical directories and online appointment flows.",
  },
  {
    name: "Sanitas",
    sourceType: "official_network",
    trustTier: 1,
    url: "https://www.sanitas.es/",
    notes: "Private insurer and hospital network directory.",
  },
  {
    name: "HM Hospitales",
    sourceType: "official_network",
    trustTier: 1,
    url: "https://www.hmhospitales.com/",
    notes: "Private hospital group with specialty pages and appointment routes.",
  },
  {
    name: "Vithas",
    sourceType: "official_network",
    trustTier: 1,
    url: "https://www.vithas.es/",
    notes: "Private hospital network with local centres and specialists.",
  },
  {
    name: "Doctoralia",
    sourceType: "marketplace",
    trustTier: 2,
    url: "https://www.doctoralia.es/",
    notes: "Marketplace useful for availability and reviews; cross-check with official profiles.",
  },
  {
    name: "Top Doctors",
    sourceType: "marketplace",
    trustTier: 2,
    url: "https://www.topdoctors.es/",
    notes: "Specialist marketplace useful for reputation and booking discovery.",
  },
  {
    name: "Google Places",
    sourceType: "review_check",
    trustTier: 3,
    url: "https://maps.google.com/",
    notes: "Useful for proximity, opening hours, and review signals; not a clinical credential source.",
  },
];

function normalize(input: string): string {
  return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function matchSpecialties(condition: string): string[] {
  const normalized = normalize(condition);
  const matches = CONDITION_SPECIALTY_MAP
    .filter((entry) => entry.keywords.some((keyword) => normalized.includes(normalize(keyword))))
    .flatMap((entry) => entry.specialties);

  const unique = Array.from(new Set(matches));
  return unique.length ? unique : ["General Practice", "Internal Medicine"];
}

function resolveSearchLocation(location?: string): string {
  const trimmed = location?.trim();
  return trimmed || "Marbella, Malaga, Spain";
}

function buildFallbackProviders(specialties: string[], location: string, language: string): SpecialistProvider[] {
  const primary = specialties[0] ?? "General Practice";
  const secondary = specialties[1] ?? "Internal Medicine";
  const fallbackAvailability = language.startsWith("es") ? "Consultar online o por telefono" : "Check online or by phone";
  const regionalDistance = language.startsWith("es") ? "Opcion regional cercana" : "Nearby regional option";
  return [
    {
      name: `${primary} team at QuironSalud Marbella`,
      specialty: primary,
      specialtyLabel: specialtyLabel(primary, language),
      clinicName: "Hospital QuironSalud Marbella",
      address: "Marbella, Malaga",
      bookingUrl: "https://www.quironsalud.com/marbella",
      sourceName: "QuironSalud",
      sourceUrl: "https://www.quironsalud.com/marbella",
      reviewScore: null,
      reviewCount: null,
      distanceLabel: location.includes("Tarifa") ? (language.startsWith("es") ? "Opcion regional cerca de Marbella" : "Regional option near Marbella") : regionalDistance,
      availabilityText: fallbackAvailability,
      openingTimes: fallbackAvailability,
      rationale: `Good first private-network option for ${primary.toLowerCase()} with appointment routes and hospital support.`,
      score: 82,
    },
    {
      name: `${secondary} options on Doctoralia`,
      specialty: secondary,
      specialtyLabel: specialtyLabel(secondary, language),
      clinicName: "Doctoralia verified marketplace results",
      address: location,
      bookingUrl: "https://www.doctoralia.es/",
      sourceName: "Doctoralia",
      sourceUrl: "https://www.doctoralia.es/",
      reviewScore: null,
      reviewCount: null,
      distanceLabel: language.startsWith("es") ? "Buscar por codigo postal o ciudad" : "Search by postcode/city",
      availabilityText: language.startsWith("es") ? "Suele mostrar disponibilidad online" : "Often shows online availability",
      openingTimes: fallbackAvailability,
      rationale: `Useful for comparing availability and patient reviews for ${secondary.toLowerCase()}; VYVA should cross-check clinic details.`,
      score: 74,
    },
  ];
}

type GooglePlaceSearchResult = {
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  place_id?: string;
};

type GooglePlaceDetails = {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
};

function summarizeOpeningHours(details: GooglePlaceDetails | null | undefined, language: string): string | null {
  const hours = details?.opening_hours;
  if (!hours) return null;
  if (hours.open_now === true) return language.startsWith("es") ? "Abierto ahora; revise el horario de hoy antes de ir" : "Open now; check today's hours before going";
  if (hours.open_now === false) return language.startsWith("es") ? "Cerrado ahora; revise el horario de apertura" : "Closed now; check opening hours";
  if (hours.weekday_text?.length) return hours.weekday_text.slice(0, 2).join(" · ");
  return null;
}

async function fetchGooglePlaceDetails(placeId: string, key: string, language: string): Promise<GooglePlaceDetails | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "formatted_phone_number,international_phone_number,website,url,opening_hours");
  url.searchParams.set("language", language || "es");
  url.searchParams.set("key", key);

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json() as {
    status?: string;
    result?: GooglePlaceDetails;
  };

  if (data.status && data.status !== "OK") return null;
  return data.result ?? null;
}

async function fetchGoogleDistanceLabel(origin: string, destination: string, key: string, language: string): Promise<string | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", language || "es");
  url.searchParams.set("key", key);

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json() as {
    status?: string;
    rows?: Array<{
      elements?: Array<{
        status?: string;
        distance?: { text?: string };
        duration?: { text?: string };
      }>;
    }>;
  };

  const element = data.rows?.[0]?.elements?.[0];
  if (data.status !== "OK" || element?.status !== "OK") return null;

  const distance = element.distance?.text;
  const duration = element.duration?.text;
  if (!distance) return null;
  const byCar = language.startsWith("es") ? "en coche" : "by car";
  return duration ? `${distance} · ${duration} ${byCar}` : distance;
}

async function searchGooglePlaces(
  specialties: string[],
  location: string,
  language: string,
): Promise<SpecialistProvider[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return [];

  const query = `${specialties[0]} specialist doctor ${location}`;
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("language", language || "es");
  url.searchParams.set("key", key);

  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as {
    status?: string;
    results?: GooglePlaceSearchResult[];
  };

  if (data.status && !["OK", "ZERO_RESULTS"].includes(data.status)) return [];

  const places = (data.results ?? []).slice(0, 3);
  const details = await Promise.all(
    places.map((place) => place.place_id ? fetchGooglePlaceDetails(place.place_id, key, language).catch(() => null) : null),
  );
  const distances = await Promise.all(
    places.map((place) => place.formatted_address
      ? fetchGoogleDistanceLabel(location, place.formatted_address, key, language).catch(() => null)
      : null),
  );

  return places.map((place, index) => {
    const detail = details[index] ?? null;
    const mapsUrl = place.place_id ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}` : null;
    const openingTimes = summarizeOpeningHours(detail, language);
    const phone = detail?.international_phone_number ?? detail?.formatted_phone_number ?? null;

    return {
      name: place.name ?? "Specialist clinic",
      specialty: specialties[0] ?? "General Practice",
      specialtyLabel: specialtyLabel(specialties[0] ?? "General Practice", language),
      clinicName: place.name ?? undefined,
      phone,
      address: place.formatted_address ?? location,
      bookingUrl: detail?.website ?? detail?.url ?? mapsUrl,
      sourceName: "Google Places",
      sourceUrl: "https://maps.google.com/",
      reviewScore: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
      distanceLabel: distances[index] ?? `Near ${location}`,
      availabilityText: openingTimes ?? (language.startsWith("es") ? "Llamar o consultar la web" : "Call or check website"),
      openingTimes,
      rationale: index === 0
        ? "Strong proximity match from local provider search; reviews should be cross-checked before booking."
        : "Nearby provider match; compare availability and credentials before booking.",
      score: 70 - index * 5 + Math.round((place.rating ?? 0) * 3),
    };
  });
}

export async function recommendSpecialists(input: SpecialistSearchInput): Promise<SpecialistRecommendationResult> {
  const condition = input.condition.trim();
  const specialties = matchSpecialties(condition);
  const location = resolveSearchLocation(input.location);
  const language = input.language?.trim() || "es";

  const liveProviders = await searchGooglePlaces(specialties, location, language).catch(() => []);
  const providers = liveProviders.length ? liveProviders : buildFallbackProviders(specialties, location, language);
  const ranked = providers.sort((a, b) => b.score - a.score).slice(0, 3);

  return {
    condition,
    matchedSpecialties: specialties.map((specialty) => specialtyLabel(specialty, language)),
    safetyNote: SAFETY_NOTE,
    sourcesChecked: SPECIALIST_SOURCES,
    providers: ranked,
    nextStep: "Ask the user which option they prefer, then hand off to Concierge to book the appointment.",
  };
}
