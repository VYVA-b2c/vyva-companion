export type GrammaticalGender = "female" | "male" | "neutral";

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function inferGenderFromName(name: string): GrammaticalGender {
  const first = stripAccents(name).toLowerCase().trim();
  const maleNames = new Set([
    "carlos", "karim", "marco", "jose", "antonio", "manuel", "juan", "miguel",
    "luis", "javier", "david", "daniel", "pedro", "rafael", "francisco", "pablo",
    "sergio", "jorge",
  ]);
  const femaleNames = new Set([
    "carmen", "maria", "ana", "lucia", "isabel", "pilar", "laura", "marta",
    "elena", "sofia", "paula", "teresa", "rosa", "dolores", "julia",
  ]);
  if (maleNames.has(first)) return "male";
  if (femaleNames.has(first)) return "female";
  if (first.endsWith("a") && !["luca", "sasha", "elias"].includes(first)) return "female";
  if (first.endsWith("o") || first.endsWith("os")) return "male";
  return "neutral";
}

export function normalizeGender(rawValue: unknown): GrammaticalGender | null {
  const raw = String(rawValue ?? "").toLowerCase().trim();
  if (["male", "masculino", "hombre", "m"].includes(raw)) return "male";
  if (["female", "femenino", "mujer", "f"].includes(raw)) return "female";
  if (["non_binary", "non-binary", "prefer_not", "prefer-not", "neutral"].includes(raw)) return "neutral";
  return null;
}

export function readProfileGender(consent: unknown): string {
  const identity = asRecord(asRecord(consent).identity);
  return typeof identity.gender === "string" ? identity.gender : "prefer_not";
}

export function inferProfileGender(consent: unknown, fallbackName: string): GrammaticalGender {
  const explicit = normalizeGender(readProfileGender(consent));
  return explicit ?? inferGenderFromName(fallbackName);
}

export function mergeIdentityGender(consent: unknown, gender: string): Record<string, unknown> {
  const root = { ...asRecord(consent) };
  root.identity = {
    ...asRecord(root.identity),
    gender: gender || "prefer_not",
  };
  return root;
}

export function genderInstruction(gender: GrammaticalGender): string {
  return `User grammatical gender: ${gender}. For Spanish user-facing wording, match this gender when using adjectives or participles. If gender is neutral, non-binary, or prefer-not, avoid gendered adjectives and use neutral phrasing.`;
}

export function gendered(gender: GrammaticalGender, female: string, male: string, neutral: string): string {
  if (gender === "female") return female;
  if (gender === "male") return male;
  return neutral;
}
