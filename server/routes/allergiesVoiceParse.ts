import type { Request, Response } from "express";

const ALLERGEN_DICTIONARY: Array<{ canonical: string; variants: string[] }> = [
  { canonical: "Peanuts", variants: ["peanut", "peanuts", "ground nut", "ground nuts", "groundnut", "groundnuts"] },
  { canonical: "Tree nuts", variants: ["tree nut", "tree nuts", "treenut", "treenuts", "almond", "almonds", "walnut", "walnuts", "cashew", "cashews", "pecan", "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia", "brazil nut", "brazil nuts"] },
  { canonical: "Shellfish", variants: ["shellfish", "shrimp", "prawns", "prawn", "crab", "crabs", "lobster", "lobsters", "crayfish", "scallop", "scallops", "clam", "clams", "oyster", "oysters", "mussel", "mussels"] },
  { canonical: "Fish", variants: ["fish", "salmon", "tuna", "cod", "tilapia", "halibut", "sardine", "sardines", "anchovies", "anchovy", "bass", "flounder", "trout"] },
  { canonical: "Milk / Dairy", variants: ["dairy", "milk", "lactose", "cheese", "butter", "dairy cream", "yogurt", "yoghurt", "whey", "casein", "milk allergy", "dairy allergy"] },
  { canonical: "Eggs", variants: ["egg", "eggs", "egg white", "egg yolk", "egg allergy"] },
  { canonical: "Wheat / Gluten", variants: ["wheat", "gluten", "wheat flour", "rye", "barley", "spelt", "semolina", "durum", "gluten intolerance", "wheat allergy", "celiac"] },
  { canonical: "Soy", variants: ["soy", "soya", "soybean", "soybeans", "soya bean", "soya beans", "tofu", "tempeh", "edamame"] },
  { canonical: "Sesame", variants: ["sesame", "sesame seed", "sesame seeds", "tahini", "sesame oil"] },
  { canonical: "Penicillin", variants: ["penicillin", "amoxicillin", "amoxycillin", "ampicillin", "beta-lactam", "beta lactam"] },
  { canonical: "Sulfa drugs", variants: ["sulfa", "sulfamethoxazole", "sulfonamide", "sulphonamide", "bactrim", "septra"] },
  { canonical: "Aspirin / NSAIDs", variants: ["aspirin", "nsaid", "nsaids", "ibuprofen", "naproxen", "advil", "motrin", "aleve", "celecoxib"] },
  { canonical: "Latex", variants: ["latex", "latex allergy", "natural rubber latex", "latex rubber", "rubber gloves"] },
  { canonical: "Bee stings", variants: ["bee", "bees", "bee sting", "bee stings", "wasp", "wasps", "wasp sting", "wasp stings", "hornet", "hornets", "yellow jacket", "yellow jackets", "insect sting", "insect stings"] },
  { canonical: "Dust mites", variants: ["dust mite", "dust mites", "house dust mite", "house dust"] },
  { canonical: "Pollen", variants: ["pollen", "hay fever", "ragweed", "grass pollen", "tree pollen", "weed pollen"] },
  { canonical: "Mold", variants: ["mold", "mould", "mildew", "fungus", "fungi", "spore", "spores"] },
  { canonical: "Cat dander", variants: ["cat", "cats", "cat dander", "cat hair", "cat fur", "feline"] },
  { canonical: "Dog dander", variants: ["dog", "dogs", "dog dander", "dog hair", "dog fur", "canine"] },
  { canonical: "Cockroach", variants: ["cockroach", "cockroaches", "roach", "roaches"] },
  { canonical: "Nickel", variants: ["nickel", "metal allergy", "nickel allergy"] },
  { canonical: "Mustard", variants: ["mustard", "mustard seed", "mustard seeds"] },
  { canonical: "Celery", variants: ["celery", "celeriac"] },
  { canonical: "Lupin", variants: ["lupin", "lupine", "lupin flour"] },
  { canonical: "Molluscs", variants: ["mollusc", "molluscs", "mollusk", "mollusks", "squid", "octopus", "snail", "escargot"] },
  { canonical: "Sulfites", variants: ["sulfite", "sulfites", "sulphite", "sulphites", "sulfur dioxide", "sulphur dioxide", "wine allergy", "sulfite allergy", "sulphite allergy"] },
  { canonical: "Corn", variants: ["corn", "maize", "corn starch", "cornstarch", "high fructose corn syrup"] },
  { canonical: "Garlic", variants: ["garlic"] },
  { canonical: "Onion", variants: ["onion", "onions"] },
  { canonical: "Codeine", variants: ["codeine", "opioid allergy", "morphine", "opioid"] },
  { canonical: "Contrast dye", variants: ["contrast dye", "contrast media", "iodine contrast", "dye allergy", "ct dye"] },
  { canonical: "Iodine", variants: ["iodine", "iodine allergy"] },
  { canonical: "Formaldehyde", variants: ["formaldehyde", "formalin"] },
  { canonical: "Fragrance", variants: ["fragrance", "perfume", "cologne", "scent", "fragrance allergy"] },
  { canonical: "Sunscreen", variants: ["sunscreen", "sunblock", "sun cream"] },
  { canonical: "Insect repellent", variants: ["insect repellent", "deet", "bug spray"] },
];

function parseAllergensFromTranscript(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  const found: string[] = [];

  for (const entry of ALLERGEN_DICTIONARY) {
    for (const variant of entry.variants) {
      const pattern = new RegExp(`\\b${variant.replace(/[-]/g, "[-\\s]?")}\\b`, "i");
      if (pattern.test(lower)) {
        if (!found.includes(entry.canonical)) {
          found.push(entry.canonical);
        }
        break;
      }
    }
  }

  return found;
}

export async function allergiesVoiceParseHandler(req: Request, res: Response) {
  const { transcript } = req.body as { transcript?: string };

  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return res.status(400).json({ error: "transcript is required", allergens: [] });
  }

  try {
    const allergens = parseAllergensFromTranscript(transcript.trim());
    return res.json({ allergens });
  } catch (err) {
    console.error("[allergies-voice-parse] Error:", err);
    return res.json({ allergens: [] });
  }
}
