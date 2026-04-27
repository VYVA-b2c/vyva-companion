import {
  encodeFilter,
  encodeParam,
  jsonResponse,
  requiredString,
  restRequest,
  routeTool,
} from "../_shared/concierge-tools.ts";

interface ProfileLocationRow {
  postcode: string | null;
  city: string | null;
  region: string | null;
  country_code: string | null;
  address?: string | null;
  address_line_1?: string | null;
}

interface PlacesTextResult {
  name?: string;
  place_id?: string;
  formatted_address?: string;
  rating?: number;
}

interface PlacesTextResponse {
  results?: PlacesTextResult[];
}

interface PlaceDetailsResponse {
  result?: {
    name?: string;
    formatted_phone_number?: string;
    formatted_address?: string;
    url?: string;
    rating?: number;
  };
}

const CATEGORY_KEYWORDS: Record<string, string> = {
  taxi: "taxi company servicio taxi",
  pharmacy: "farmacia pharmacy",
  gp: "medico de cabecera centro de salud",
  clinic: "clinica medica",
  hospital: "hospital",
  dentist: "dentista",
  physio: "fisioterapeuta",
  plumber: "fontanero",
  electrician: "electricista",
  cleaner: "servicio limpieza hogar",
  restaurant: "restaurante",
  takeaway: "comida a domicilio",
  supermarket: "supermercado",
  hair_care: "peluqueria",
  gym: "gimnasio",
  other: "servicio local",
};

function resolveLocation(profile: ProfileLocationRow | null) {
  if (profile?.postcode) {
    return {
      suffix: `near ${profile.postcode} ${profile.country_code ?? "ES"}`,
      location_type: "postcode",
      location_label: profile.city ?? profile.postcode,
    };
  }

  if (profile?.city && profile?.region) {
    return {
      suffix: `in ${profile.city}, ${profile.region}`,
      location_type: "city_region",
      location_label: profile.city,
    };
  }

  if (profile?.city) {
    return {
      suffix: `in ${profile.city}, ${profile.country_code ?? "ES"}`,
      location_type: "city_country",
      location_label: profile.city,
    };
  }

  const address = profile?.address ?? profile?.address_line_1;
  if (address) {
    return {
      suffix: `near ${address}`,
      location_type: "address",
      location_label: address,
    };
  }

  return { suffix: "", location_type: "none", location_label: "" };
}

Deno.serve((req: Request) => routeTool(req, async (body) => {
  const userId = requiredString(body, "user_id")!;
  const category = requiredString(body, "category");
  const language = requiredString(body, "language");

  if (!category || !language) {
    return jsonResponse({ error: "category and language are required" }, 400);
  }

  const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? "";
  if (!googleKey) {
    return jsonResponse({ error: "GOOGLE_PLACES_API_KEY is not configured" }, 500);
  }

  const profileResult = await restRequest<ProfileLocationRow>(
    "GET",
    `profiles?select=*&id=${encodeFilter(userId)}`,
    { acceptObject: true, allowEmpty: true },
  );

  if (profileResult.error && !profileResult.error.includes("\"22P02\"")) {
    return jsonResponse({ error: profileResult.error }, 500);
  }

  const location = resolveLocation(profileResult.error ? null : profileResult.data);
  if (location.location_type === "none") {
    return jsonResponse({
      results: [],
      location_type: "none",
      location_label: "",
      count: 0,
    });
  }

  const keyword = CATEGORY_KEYWORDS[category] ?? CATEGORY_KEYWORDS.other;
  const query = `${keyword} ${location.suffix}`;
  const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeParam(query)}&language=${encodeParam(language)}&key=${encodeParam(googleKey)}`;
  const placesRes = await fetch(placesUrl);
  const placesData = await placesRes.json() as PlacesTextResponse;
  const top3 = (placesData.results ?? []).filter((place) => place.place_id).slice(0, 3);

  const results = await Promise.all(top3.map(async (place) => {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeParam(place.place_id!)}&fields=name,formatted_phone_number,formatted_address,url,rating&key=${encodeParam(googleKey)}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json() as PlaceDetailsResponse;
    const d = detailsData.result ?? {};

    return {
      name: d.name ?? place.name ?? "",
      phone: d.formatted_phone_number ?? null,
      address: d.formatted_address ?? place.formatted_address ?? "",
      place_id: place.place_id,
      maps_url: d.url ?? null,
      rating: d.rating ?? place.rating ?? null,
    };
  }));

  return jsonResponse({
    results,
    location_type: location.location_type,
    location_label: location.location_label,
    count: results.length,
  });
}));
