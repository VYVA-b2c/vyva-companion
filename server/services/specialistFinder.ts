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

function buildFallbackProviders(specialties: string[], location: string): SpecialistProvider[] {
  const primary = specialties[0] ?? "General Practice";
  const secondary = specialties[1] ?? "Internal Medicine";
  return [
    {
      name: `${primary} team at QuironSalud Marbella`,
      specialty: primary,
      clinicName: "Hospital QuironSalud Marbella",
      address: "Marbella, Malaga",
      bookingUrl: "https://www.quironsalud.com/marbella",
      sourceName: "QuironSalud",
      sourceUrl: "https://www.quironsalud.com/marbella",
      reviewScore: null,
      reviewCount: null,
      distanceLabel: location.includes("Tarifa") ? "Regional option near Marbella" : "Nearby regional option",
      availabilityText: "Check online or by phone",
      rationale: `Good first private-network option for ${primary.toLowerCase()} with appointment routes and hospital support.`,
      score: 82,
    },
    {
      name: `${secondary} options on Doctoralia`,
      specialty: secondary,
      clinicName: "Doctoralia verified marketplace results",
      address: location,
      bookingUrl: "https://www.doctoralia.es/",
      sourceName: "Doctoralia",
      sourceUrl: "https://www.doctoralia.es/",
      reviewScore: null,
      reviewCount: null,
      distanceLabel: "Search by postcode/city",
      availabilityText: "Often shows online availability",
      rationale: `Useful for comparing availability and patient reviews for ${secondary.toLowerCase()}; VYVA should cross-check clinic details.`,
      score: 74,
    },
  ];
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
    results?: Array<{
      name?: string;
      formatted_address?: string;
      rating?: number;
      user_ratings_total?: number;
      place_id?: string;
    }>;
  };

  if (data.status && !["OK", "ZERO_RESULTS"].includes(data.status)) return [];

  return (data.results ?? []).slice(0, 3).map((place, index) => ({
    name: place.name ?? "Specialist clinic",
    specialty: specialties[0] ?? "General Practice",
    clinicName: place.name ?? undefined,
    address: place.formatted_address ?? location,
    bookingUrl: place.place_id ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}` : null,
    sourceName: "Google Places",
    sourceUrl: "https://maps.google.com/",
    reviewScore: place.rating ?? null,
    reviewCount: place.user_ratings_total ?? null,
    distanceLabel: "Near the requested area",
    availabilityText: "Call or check website",
    rationale: index === 0
      ? "Strong proximity match from local provider search; reviews should be cross-checked before booking."
      : "Nearby provider match; compare availability and credentials before booking.",
    score: 70 - index * 5 + Math.round((place.rating ?? 0) * 3),
  }));
}

export async function recommendSpecialists(input: SpecialistSearchInput): Promise<SpecialistRecommendationResult> {
  const condition = input.condition.trim();
  const specialties = matchSpecialties(condition);
  const location = resolveSearchLocation(input.location);
  const language = input.language?.trim() || "es";

  const liveProviders = await searchGooglePlaces(specialties, location, language).catch(() => []);
  const providers = liveProviders.length ? liveProviders : buildFallbackProviders(specialties, location);
  const ranked = providers.sort((a, b) => b.score - a.score).slice(0, 3);

  return {
    condition,
    matchedSpecialties: specialties,
    safetyNote: SAFETY_NOTE,
    sourcesChecked: SPECIALIST_SOURCES,
    providers: ranked,
    nextStep: "Ask the user which option they prefer, then hand off to Concierge to book the appointment.",
  };
}
