import type { Request, Response } from "express";

const COUNTRIES: Record<string, string> = {
  // Spanish variants
  "spain": "Spain", "españa": "Spain", "espana": "Spain",
  // UK variants
  "united kingdom": "United Kingdom", "uk": "United Kingdom",
  "great britain": "United Kingdom", "britain": "United Kingdom", "england": "United Kingdom",
  "scotland": "United Kingdom", "wales": "United Kingdom", "northern ireland": "United Kingdom",
  // Others
  "france": "France",
  "germany": "Germany", "deutschland": "Germany",
  "italy": "Italy", "italia": "Italy",
  "portugal": "Portugal",
  "netherlands": "Netherlands", "holland": "Netherlands",
  "belgium": "Belgium", "belgique": "Belgium",
  "switzerland": "Switzerland", "schweiz": "Switzerland",
  "austria": "Austria",
  "ireland": "Ireland", "éire": "Ireland", "eire": "Ireland",
  "united states": "United States", "usa": "United States", "us": "United States",
  "america": "United States",
  "canada": "Canada",
  "australia": "Australia",
};

// Canonical country names used by the frontend dropdown
const CANONICAL_COUNTRIES = [
  "Spain", "United Kingdom", "France", "Germany", "Italy",
  "Portugal", "Netherlands", "Belgium", "Switzerland", "Austria",
  "Ireland", "United States", "Canada", "Australia", "Other",
];

const POSTCODE_RE = /^(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|\d{4,5}(?:-\d{4})?|[A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i;

const APARTMENT_KEYWORDS = /\b(flat|floor|apt|apartment|suite|piso|planta|etage|étage|unit|#)\b/i;
const STREET_RE = /^\d+\s+\S/;       // "42 Calle Mayor…"
const HAS_NUMBER_RE = /\d/;          // segment contains any digit (postcode candidate)

function normaliseCountry(raw: string): string {
  const key = raw.toLowerCase().trim().replace(/[^a-záéíóúüñ ]/gi, "");
  if (COUNTRIES[key]) return COUNTRIES[key];
  // Try partial match against canonical names
  for (const canon of CANONICAL_COUNTRIES) {
    if (canon.toLowerCase() === key) return canon;
  }
  return "Other";
}

function parseAddressFromTranscript(transcript: string): Record<string, string> {
  // Normalise: strip leading/trailing whitespace, collapse multiple spaces
  const text = transcript.trim().replace(/\s+/g, " ");

  // Split on commas; also handle spoken " in " and " at " followed by capital letter
  const raw = text.split(/,|(?:\s+(?:in|at)\s+)(?=[A-Z])/i).map((s) => s.trim()).filter(Boolean);

  const result: Record<string, string> = {
    address_line_1: "",
    address_line_2: "",
    city: "",
    postcode: "",
    region: "",
    country: "",
  };

  const used = new Set<number>();

  // ── 1. Country — check last segment first ────────────────────────────────
  for (let i = raw.length - 1; i >= 0; i--) {
    const seg = raw[i];
    const norm = normaliseCountry(seg);
    if (norm !== "Other" || CANONICAL_COUNTRIES.some((c) => c.toLowerCase() === seg.toLowerCase())) {
      result.country = norm;
      used.add(i);
      break;
    }
    // also check if the segment ends with a country name (e.g. "49001 Spain")
    for (const [key, canon] of Object.entries(COUNTRIES)) {
      if (seg.toLowerCase().endsWith(key)) {
        result.country = canon;
        const remainder = seg.slice(0, seg.length - key.length).trim().replace(/,\s*$/, "").trim();
        if (remainder) raw[i] = remainder;
        else used.add(i);
        break;
      }
    }
    if (result.country) break;
  }
  // Default country to "Other" when no match found (aligns with frontend dropdown)
  if (!result.country) result.country = "Other";

  // ── 2. Postcode — any segment matching postcode pattern ──────────────────
  for (let i = 0; i < raw.length; i++) {
    if (used.has(i)) continue;
    const seg = raw[i].trim();
    if (POSTCODE_RE.test(seg)) {
      result.postcode = seg.toUpperCase();
      used.add(i);
      break;
    }
    // postcode embedded at end: "Zamora 49001" or "49001 Zamora"
    const parts = seg.split(/\s+/);
    for (const p of parts) {
      if (POSTCODE_RE.test(p)) {
        result.postcode = p.toUpperCase();
        // strip postcode from segment
        const rest = seg.replace(p, "").trim();
        if (rest) raw[i] = rest;
        else used.add(i);
        break;
      }
    }
    if (result.postcode) break;
  }

  // ── 3. Apartment / floor ─────────────────────────────────────────────────
  for (let i = 0; i < raw.length; i++) {
    if (used.has(i)) continue;
    if (APARTMENT_KEYWORDS.test(raw[i])) {
      result.address_line_2 = raw[i];
      used.add(i);
      break;
    }
  }

  // ── 4. Street address — starts with number or first segment ─────────────
  for (let i = 0; i < raw.length; i++) {
    if (used.has(i)) continue;
    if (STREET_RE.test(raw[i]) || (i === 0 && HAS_NUMBER_RE.test(raw[i]))) {
      result.address_line_1 = raw[i];
      used.add(i);
      break;
    }
  }
  // fallback: first unused segment that isn't a number blob
  if (!result.address_line_1) {
    for (let i = 0; i < raw.length; i++) {
      if (used.has(i)) continue;
      result.address_line_1 = raw[i];
      used.add(i);
      break;
    }
  }

  // ── 5. Remaining segments → city then region ────────────────────────────
  const remaining: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (!used.has(i) && raw[i].trim()) remaining.push(raw[i].trim());
  }
  if (remaining[0]) result.city = remaining[0];
  if (remaining[1]) result.region = remaining[1];

  return result;
}

export async function addressVoiceParseHandler(req: Request, res: Response) {
  const { transcript } = req.body as { transcript?: string };

  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return res.status(400).json({ error: "transcript is required", address: {} });
  }

  try {
    const address = parseAddressFromTranscript(transcript);
    return res.json({ address });
  } catch (err) {
    console.error("[address-voice-parse] Error:", err);
    return res.json({ address: {} });
  }
}
