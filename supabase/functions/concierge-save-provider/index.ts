import {
  encodeFilter,
  jsonResponse,
  optionalString,
  requiredString,
  restRequest,
  routeTool,
} from "../_shared/concierge-tools.ts";

interface ProviderIdRow {
  id: string;
}

Deno.serve((req: Request) => routeTool(req, async (body) => {
  const userId = requiredString(body, "user_id")!;
  const category = requiredString(body, "category");
  const name = requiredString(body, "name");
  const language = requiredString(body, "language");

  if (!category || !name || !language) {
    return jsonResponse({ error: "category, name, and language are required" }, 400);
  }

  const existingResult = await restRequest<ProviderIdRow>(
    "GET",
    `user_providers?select=id&user_id=${encodeFilter(userId)}&category=${encodeFilter(category)}&is_primary=eq.true&is_active=eq.true&limit=1`,
    { acceptObject: true, allowEmpty: true },
  );

  if (existingResult.error) {
    return jsonResponse({ error: existingResult.error }, 500);
  }

  const savedResult = await restRequest<ProviderIdRow[]>(
    "POST",
    "user_providers?select=id",
    {
      prefer: "return=representation",
      body: {
        user_id: userId,
        category,
        name,
        phone: optionalString(body, "phone"),
        address: optionalString(body, "address"),
        place_id: optionalString(body, "place_id"),
        maps_url: optionalString(body, "maps_url"),
        is_primary: !existingResult.data,
        is_active: true,
        use_count: 1,
        last_used_at: new Date().toISOString(),
        language,
      },
    },
  );

  const providerId = savedResult.data?.[0]?.id;
  if (savedResult.error || !providerId) {
    return jsonResponse({ error: savedResult.error ?? "Failed to save provider" }, 500);
  }

  return jsonResponse({
    success: true,
    provider_id: providerId,
    message: `Guardado. ${name} queda guardado para la proxima vez.`,
  });
}));

