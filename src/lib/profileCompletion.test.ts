import { describe, it, expect } from "vitest";
import { deriveCompletedSections, isProfileComplete } from "./profileCompletion";

const EMPTY_PROFILE = null;
const EMPTY_STATE = null;

describe("deriveCompletedSections", () => {
  it("returns an empty set when both profile and state are null", () => {
    const result = deriveCompletedSections(EMPTY_PROFILE, EMPTY_STATE);
    expect(result.size).toBe(0);
  });

  it("marks basics complete when full_name is present", () => {
    const result = deriveCompletedSections({ full_name: "Margaret" }, null);
    expect(result.has("basics")).toBe(true);
  });

  it("does not mark basics complete when full_name is absent", () => {
    const result = deriveCompletedSections({ preferred_name: "Maggie" }, null);
    expect(result.has("basics")).toBe(false);
  });

  it("marks contact complete when address_line_1 is present", () => {
    const result = deriveCompletedSections({ address_line_1: "12 Oak Lane" }, null);
    expect(result.has("contact")).toBe(true);
  });

  it("marks contact complete when city is present (without address_line_1)", () => {
    const result = deriveCompletedSections({ city: "London" }, null);
    expect(result.has("contact")).toBe(true);
  });

  it("does not mark contact complete when neither field is present", () => {
    const result = deriveCompletedSections({ full_name: "Margaret" }, null);
    expect(result.has("contact")).toBe(false);
  });

  it("marks health complete when has_health_conditions is true", () => {
    const result = deriveCompletedSections(null, { has_health_conditions: true });
    expect(result.has("health")).toBe(true);
  });

  it("does not mark health complete when has_health_conditions is false", () => {
    const result = deriveCompletedSections(null, { has_health_conditions: false });
    expect(result.has("health")).toBe(false);
  });

  it("marks medications complete when has_medications is true", () => {
    const result = deriveCompletedSections(null, { has_medications: true });
    expect(result.has("medications")).toBe(true);
  });

  it("marks allergies complete when known_allergies has at least one entry", () => {
    const result = deriveCompletedSections({ known_allergies: ["Penicillin"] }, null);
    expect(result.has("allergies")).toBe(true);
  });

  it("does not mark allergies complete when known_allergies is empty", () => {
    const result = deriveCompletedSections({ known_allergies: [] }, null);
    expect(result.has("allergies")).toBe(false);
  });

  it("does not mark allergies complete when known_allergies is not an array", () => {
    const result = deriveCompletedSections({ known_allergies: "Penicillin" }, null);
    expect(result.has("allergies")).toBe(false);
  });

  it("marks gp complete when has_gp_details is true", () => {
    const result = deriveCompletedSections(null, { has_gp_details: true });
    expect(result.has("gp")).toBe(true);
  });

  it("marks providers complete when data_sharing_consent.providers has at least one entry", () => {
    const profile = { data_sharing_consent: { providers: ["NHS"] } };
    const result = deriveCompletedSections(profile, null);
    expect(result.has("providers")).toBe(true);
  });

  it("does not mark providers complete when providers list is empty", () => {
    const profile = { data_sharing_consent: { providers: [] } };
    const result = deriveCompletedSections(profile, null);
    expect(result.has("providers")).toBe(false);
  });

  it("does not mark providers complete when data_sharing_consent is absent", () => {
    const result = deriveCompletedSections({ full_name: "Margaret" }, null);
    expect(result.has("providers")).toBe(false);
  });

  it("marks care-team complete when has_caregiver is true", () => {
    const result = deriveCompletedSections(null, { has_caregiver: true });
    expect(result.has("care-team")).toBe(true);
  });

  it("marks care-team complete when has_family_member is true", () => {
    const result = deriveCompletedSections(null, { has_family_member: true });
    expect(result.has("care-team")).toBe(true);
  });

  it("marks care-team complete when has_doctor is true", () => {
    const result = deriveCompletedSections(null, { has_doctor: true });
    expect(result.has("care-team")).toBe(true);
  });

  it("does not mark care-team complete when all care-team flags are false", () => {
    const result = deriveCompletedSections(null, {
      has_caregiver: false,
      has_family_member: false,
      has_doctor: false,
    });
    expect(result.has("care-team")).toBe(false);
  });

  it("marks hobbies complete when hobbies has at least one entry", () => {
    const result = deriveCompletedSections({ hobbies: ["Gardening"] }, null);
    expect(result.has("hobbies")).toBe(true);
  });

  it("does not mark hobbies complete when hobbies is empty", () => {
    const result = deriveCompletedSections({ hobbies: [] }, null);
    expect(result.has("hobbies")).toBe(false);
  });

  it("marks emergency complete when has_emergency_address is true", () => {
    const result = deriveCompletedSections(null, { has_emergency_address: true });
    expect(result.has("emergency")).toBe(true);
  });

  it("handles multiple sections completed in one call", () => {
    const profile = { full_name: "Margaret", city: "London" };
    const state = { has_medications: true, has_gp_details: true };
    const result = deriveCompletedSections(profile, state);
    expect(result.has("basics")).toBe(true);
    expect(result.has("contact")).toBe(true);
    expect(result.has("medications")).toBe(true);
    expect(result.has("gp")).toBe(true);
    expect(result.has("health")).toBe(false);
  });
});

describe("isProfileComplete", () => {
  const FULL_PROFILE = {
    full_name: "Margaret Collins",
    city: "London",
    known_allergies: ["Penicillin"],
    data_sharing_consent: { providers: ["NHS"] },
    hobbies: ["Gardening"],
  };

  const FULL_STATE = {
    has_health_conditions: true,
    has_medications: true,
    has_gp_details: true,
    has_caregiver: true,
    has_emergency_address: true,
  };

  it("returns true when all 9 core sections are complete", () => {
    expect(isProfileComplete(FULL_PROFILE, FULL_STATE)).toBe(true);
  });

  it("returns false when basics section is missing", () => {
    const profile = { ...FULL_PROFILE, full_name: undefined };
    expect(isProfileComplete(profile, FULL_STATE)).toBe(false);
  });

  it("returns false when contact section is missing", () => {
    const profile = { ...FULL_PROFILE, city: undefined };
    expect(isProfileComplete(profile, FULL_STATE)).toBe(false);
  });

  it("returns false when health section is missing", () => {
    const state = { ...FULL_STATE, has_health_conditions: false };
    expect(isProfileComplete(FULL_PROFILE, state)).toBe(false);
  });

  it("returns false when medications section is missing", () => {
    const state = { ...FULL_STATE, has_medications: false };
    expect(isProfileComplete(FULL_PROFILE, state)).toBe(false);
  });

  it("returns false when allergies section is missing", () => {
    const profile = { ...FULL_PROFILE, known_allergies: [] };
    expect(isProfileComplete(profile, FULL_STATE)).toBe(false);
  });

  it("returns false when gp section is missing", () => {
    const state = { ...FULL_STATE, has_gp_details: false };
    expect(isProfileComplete(FULL_PROFILE, state)).toBe(false);
  });

  it("returns false when providers section is missing", () => {
    const profile = { ...FULL_PROFILE, data_sharing_consent: { providers: [] } };
    expect(isProfileComplete(profile, FULL_STATE)).toBe(false);
  });

  it("returns false when care-team section is missing", () => {
    const state = { ...FULL_STATE, has_caregiver: false };
    expect(isProfileComplete(FULL_PROFILE, state)).toBe(false);
  });

  it("returns false when emergency section is missing", () => {
    const state = { ...FULL_STATE, has_emergency_address: false };
    expect(isProfileComplete(FULL_PROFILE, state)).toBe(false);
  });

  it("returns false when both profile and state are null", () => {
    expect(isProfileComplete(null, null)).toBe(false);
  });
});
