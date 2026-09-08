export type MedicationInventoryUnit =
  | "tablet"
  | "capsule"
  | "single_dose_container"
  | "bottle"
  | "sachet"
  | "patch"
  | "dose"
  | "ml"
  | "other";

export type MedicationInventoryPhotoModel = {
  medicineName?: unknown;
  strength?: unknown;
  packageCount?: unknown;
  unitsPerPackage?: unknown;
  inventoryQuantity?: unknown;
  inventoryUnit?: unknown;
  inventoryEvidenceText?: unknown;
  contentAmountPerUnit?: unknown;
  contentUnit?: unknown;
  contentEvidenceText?: unknown;
  purchasedOn?: unknown;
  warnings?: unknown;
};

export type NormalizedMedicationInventoryPhoto = {
  draft: {
    medicineName: string;
    strength: string;
    packageCount: number | null;
    unitsPerPackage: number | null;
    totalQuantity: number | null;
    inventoryQuantity: number | null;
    inventoryUnit: MedicationInventoryUnit | null;
    doseUnit: MedicationInventoryUnit | "";
    inventoryEvidenceText: string | null;
    contentAmountPerUnit: number | null;
    contentUnit: string | null;
    contentEvidenceText: string | null;
    purchasedOn: string | null;
  };
  confidence: "high" | "medium" | "low";
  fieldConfidence: Record<string, "high" | "medium" | "low">;
  needsReview: boolean;
  warnings: string[];
  imageRetained: false;
};

const INVENTORY_UNITS = new Set<MedicationInventoryUnit>([
  "tablet",
  "capsule",
  "single_dose_container",
  "bottle",
  "sachet",
  "patch",
  "dose",
  "ml",
  "other",
]);

const COUNT_EVIDENCE = [
  { pattern: /(\d+(?:[.,]\d+)?)\s*(?:x\s*)?(?:envases?\s+unidosis|unidosis|envases?)/i, unit: "single_dose_container" as const },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(?:single[ -]?dose\s+containers?|containers?|vials?|ampoules?)/i, unit: "single_dose_container" as const },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(?:tablets?|comprimidos?)/i, unit: "tablet" as const },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(?:capsules?|c[áa]psulas?)/i, unit: "capsule" as const },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(?:sachets?|sobres?)/i, unit: "sachet" as const },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(?:patches?|parches?)/i, unit: "patch" as const },
];

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inventoryUnitValue(value: unknown): MedicationInventoryUnit | null {
  const normalized = textValue(value, 40).toLowerCase().replace(/[ -]+/g, "_") as MedicationInventoryUnit;
  return INVENTORY_UNITS.has(normalized) ? normalized : null;
}

function literalCount(evidence: string) {
  for (const candidate of COUNT_EVIDENCE) {
    const match = evidence.match(candidate.pattern);
    const quantity = positiveNumber(match?.[1]);
    if (quantity !== null) return { quantity, unit: candidate.unit };
  }
  return null;
}

function evidenceContainsNumber(evidence: string, value: number) {
  const escaped = String(value).replace(".", "[.,]");
  return new RegExp(`(^|\\D)${escaped}(?=\\D|$)`).test(evidence);
}

function uniqueWarnings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 8);
}

export function normalizeMedicationInventoryPhoto(
  model: MedicationInventoryPhotoModel,
  options: { expectedDoseUnit?: string | null; today?: string } = {},
): NormalizedMedicationInventoryPhoto {
  const warnings = Array.isArray(model.warnings)
    ? model.warnings.filter((item): item is string => typeof item === "string")
    : [];
  const inventoryEvidenceText = textValue(model.inventoryEvidenceText, 240) || null;
  const contentEvidenceText = textValue(model.contentEvidenceText, 240) || null;
  const evidenceCount = inventoryEvidenceText ? literalCount(inventoryEvidenceText) : null;
  const packageCount = positiveNumber(model.packageCount);
  const unitsPerPackage = positiveNumber(model.unitsPerPackage);
  const modelQuantity = positiveNumber(model.inventoryQuantity);
  const packageQuantity = packageCount !== null && unitsPerPackage !== null ? packageCount * unitsPerPackage : null;
  let inventoryQuantity = evidenceCount?.quantity ?? modelQuantity ?? packageQuantity;
  let inventoryUnit = evidenceCount?.unit ?? inventoryUnitValue(model.inventoryUnit);

  if (modelQuantity !== null && inventoryEvidenceText && !evidenceContainsNumber(inventoryEvidenceText, modelQuantity)) {
    warnings.push("The proposed inventory quantity was not present in the quoted label text, so it was removed.");
    if (!evidenceCount) inventoryQuantity = null;
  }
  if (evidenceCount && modelQuantity !== null && modelQuantity !== evidenceCount.quantity) {
    warnings.push(`The package says ${evidenceCount.quantity} countable units; a conflicting derived value was ignored.`);
    inventoryQuantity = evidenceCount.quantity;
    inventoryUnit = evidenceCount.unit;
  }
  if (packageQuantity !== null && inventoryQuantity !== null && packageQuantity !== inventoryQuantity && !evidenceCount) {
    warnings.push("The package count and total quantity conflict. Confirm the usable unit count manually.");
    inventoryQuantity = null;
  }
  if (inventoryQuantity !== null && !inventoryEvidenceText && packageQuantity === null) {
    warnings.push("The quantity has no visible label evidence. Confirm it manually.");
    inventoryQuantity = null;
  }
  if (inventoryQuantity !== null && !inventoryUnit) {
    warnings.push("The package unit could not be identified. Choose the unit before saving.");
  }

  const expectedDoseUnit = options.expectedDoseUnit?.trim().toLowerCase() || null;
  if (inventoryUnit === "ml" && expectedDoseUnit && expectedDoseUnit !== "ml") {
    warnings.push("Package volume does not match the saved dose unit. Confirm the physical stock unit instead of total volume.");
    inventoryQuantity = null;
  }

  const purchasedOn = typeof model.purchasedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(model.purchasedOn)
    ? model.purchasedOn
    : options.today ?? new Date().toISOString().slice(0, 10);
  const contentAmountPerUnit = positiveNumber(model.contentAmountPerUnit);
  const contentUnit = textValue(model.contentUnit, 24) || null;
  const hasReliableCount = inventoryQuantity !== null && inventoryUnit !== null && Boolean(inventoryEvidenceText);
  const finalWarnings = uniqueWarnings(warnings);
  const confidence: "high" | "medium" | "low" = hasReliableCount && finalWarnings.length === 0
    ? "high"
    : inventoryQuantity !== null && inventoryUnit !== null
      ? "medium"
      : "low";

  return {
    draft: {
      medicineName: textValue(model.medicineName, 160),
      strength: textValue(model.strength, 80),
      packageCount,
      unitsPerPackage,
      totalQuantity: inventoryQuantity,
      inventoryQuantity,
      inventoryUnit,
      doseUnit: inventoryUnit ?? "",
      inventoryEvidenceText,
      contentAmountPerUnit,
      contentUnit,
      contentEvidenceText,
      purchasedOn,
    },
    confidence,
    fieldConfidence: {
      inventoryQuantity: hasReliableCount ? "high" : inventoryQuantity !== null ? "medium" : "low",
      inventoryUnit: inventoryUnit ? (evidenceCount ? "high" : "medium") : "low",
      medicineName: textValue(model.medicineName, 160) ? "medium" : "low",
    },
    needsReview: confidence !== "high" || finalWarnings.length > 0,
    warnings: finalWarnings,
    imageRetained: false,
  };
}

export const medicationInventoryPhotoJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "medicineName",
    "strength",
    "packageCount",
    "unitsPerPackage",
    "inventoryQuantity",
    "inventoryUnit",
    "inventoryEvidenceText",
    "contentAmountPerUnit",
    "contentUnit",
    "contentEvidenceText",
    "purchasedOn",
    "warnings",
  ],
  properties: {
    medicineName: { type: "string" },
    strength: { type: "string" },
    packageCount: { type: ["number", "null"] },
    unitsPerPackage: { type: ["number", "null"] },
    inventoryQuantity: { type: ["number", "null"] },
    inventoryUnit: {
      type: ["string", "null"],
      enum: ["tablet", "capsule", "single_dose_container", "bottle", "sachet", "patch", "dose", "ml", "other", null],
    },
    inventoryEvidenceText: { type: ["string", "null"] },
    contentAmountPerUnit: { type: ["number", "null"] },
    contentUnit: { type: ["string", "null"] },
    contentEvidenceText: { type: ["string", "null"] },
    purchasedOn: { type: ["string", "null"] },
    warnings: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
} as const;
