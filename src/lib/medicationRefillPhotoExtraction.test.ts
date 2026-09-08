import { describe, expect, it } from "vitest";
import { normalizeMedicationInventoryPhoto } from "../../server/medication/refillPhotoExtraction";

describe("medication refill photo extraction", () => {
  it("uses the literal Spanish single-dose container count instead of derived package volume", () => {
    const result = normalizeMedicationInventoryPhoto({
      medicineName: "Monoprost",
      strength: "1 drop",
      packageCount: 1,
      unitsPerPackage: 30,
      inventoryQuantity: 6,
      inventoryUnit: "ml",
      inventoryEvidenceText: "30 envases unidosis",
      contentAmountPerUnit: 0.2,
      contentUnit: "ml",
      contentEvidenceText: "0,2 ml",
      purchasedOn: null,
      warnings: [],
    }, { expectedDoseUnit: "drop", today: "2026-08-31" });

    expect(result.draft).toMatchObject({
      inventoryQuantity: 30,
      totalQuantity: 30,
      inventoryUnit: "single_dose_container",
      inventoryEvidenceText: "30 envases unidosis",
      contentAmountPerUnit: 0.2,
      contentUnit: "ml",
    });
    expect(result.needsReview).toBe(true);
    expect(result.warnings.join(" ")).toContain("conflicting derived value was ignored");
  });

  it("removes a hallucinated quantity that has no supporting label evidence", () => {
    const result = normalizeMedicationInventoryPhoto({
      medicineName: "Monoprost",
      inventoryQuantity: 6,
      inventoryUnit: "ml",
      inventoryEvidenceText: "30 envases unidosis",
      warnings: [],
    }, { expectedDoseUnit: "drop" });

    expect(result.draft.inventoryQuantity).toBe(30);
    expect(result.draft.inventoryUnit).toBe("single_dose_container");
    expect(result.confidence).toBe("medium");
  });

  it("returns no usable quantity when the proposed number has no quoted evidence", () => {
    const result = normalizeMedicationInventoryPhoto({
      medicineName: "Example medicine",
      inventoryQuantity: 6,
      inventoryUnit: "ml",
      inventoryEvidenceText: null,
      warnings: [],
    }, { expectedDoseUnit: "drop" });

    expect(result.draft.inventoryQuantity).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.needsReview).toBe(true);
  });

  it("keeps countable inventory separate from per-unit content", () => {
    const result = normalizeMedicationInventoryPhoto({
      inventoryQuantity: 30,
      inventoryUnit: "single_dose_container",
      inventoryEvidenceText: "30 single-dose containers",
      contentAmountPerUnit: 0.2,
      contentUnit: "ml",
      contentEvidenceText: "0.2 ml per container",
      warnings: [],
    });

    expect(result.draft.inventoryQuantity).toBe(30);
    expect(result.draft.contentAmountPerUnit).toBe(0.2);
    expect(result.confidence).toBe("high");
  });
});
