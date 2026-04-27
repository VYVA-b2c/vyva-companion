import {
  encodeFilter,
  jsonResponse,
  requiredString,
  restRequest,
  routeTool,
} from "../_shared/concierge-tools.ts";

interface ProfileRow {
  preferred_name: string | null;
  full_name?: string | null;
  address_line_1: string | null;
  address?: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country_code: string | null;
  date_of_birth: string | null;
  language: string | null;
  language_preference?: string | null;
  gp_name: string | null;
  gp_phone: string | null;
  gp_address: string | null;
  gp_place_id: string | null;
  gp_maps_url: string | null;
}

interface ProviderRow {
  id: string | null;
  name: string | null;
  phone: string | null;
  address: string | null;
  place_id: string | null;
  maps_url: string | null;
  notes: string | null;
}

interface MedicationRow {
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
}

function locationType(profile: ProfileRow | null): string {
  if (profile?.postcode) return "postcode";
  if (profile?.city && profile?.region) return "city_region";
  if (profile?.city) return "city_country";
  if (profile?.address) return "address";
  return "none";
}

Deno.serve((req: Request) => routeTool(req, async (body) => {
  const userId = requiredString(body, "user_id")!;
  const useCase = requiredString(body, "use_case");
  const category = requiredString(body, "category");

  if (!useCase || !category) {
    return jsonResponse({ error: "use_case and category are required" }, 400);
  }

  const profileResult = await restRequest<ProfileRow>(
    "GET",
    `profiles?select=*&id=${encodeFilter(userId)}`,
    { acceptObject: true, allowEmpty: true },
  );

  if (profileResult.error && !profileResult.error.includes("\"22P02\"")) {
    return jsonResponse({ error: profileResult.error }, 500);
  }

  const profile = profileResult.error ? null : profileResult.data;

  const providerResult = await restRequest<ProviderRow>(
    "GET",
    `user_providers?select=*&user_id=${encodeFilter(userId)}&category=${encodeFilter(category)}&is_primary=eq.true&is_active=eq.true&limit=1`,
    { acceptObject: true, allowEmpty: true },
  );

  if (providerResult.error) {
    return jsonResponse({ error: providerResult.error }, 500);
  }

  let provider = providerResult.data;
  if (!provider && useCase === "book_appointment" && profile?.gp_name) {
    provider = {
      id: null,
      name: profile.gp_name,
      phone: profile.gp_phone,
      address: profile.gp_address,
      place_id: profile.gp_place_id,
      maps_url: profile.gp_maps_url,
      notes: null,
    };
  }

  let medications: Array<{ name: string; dosage: string | null; frequency: string | null }> = [];
  if (useCase === "order_medicine") {
    const medsResult = await restRequest<MedicationRow[]>(
      "GET",
      `user_medications?select=medication_name,dosage,frequency&user_id=${encodeFilter(userId)}&active=eq.true&order=created_at.asc`,
    );

    if (medsResult.error) {
      return jsonResponse({ error: medsResult.error }, 500);
    }

    medications = (medsResult.data ?? []).map((med) => ({
      name: med.medication_name,
      dosage: med.dosage,
      frequency: med.frequency,
    }));
  }

  return jsonResponse({
    profile: profile
      ? {
          preferred_name: profile.preferred_name,
          full_name: profile.full_name ?? null,
          address_line_1: profile.address_line_1 ?? profile.address ?? null,
          address: profile.address ?? profile.address_line_1 ?? null,
          city: profile.city,
          region: profile.region,
          postcode: profile.postcode,
          country_code: profile.country_code,
          date_of_birth: profile.date_of_birth,
          language: profile.language ?? profile.language_preference ?? "es",
          gp_name: profile.gp_name,
          gp_phone: profile.gp_phone,
          gp_address: profile.gp_address,
        }
      : null,
    provider,
    medications,
    has_provider: Boolean(provider),
    location_type: locationType(profile),
  });
}));
