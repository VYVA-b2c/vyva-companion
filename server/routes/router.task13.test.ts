import { describe, expect, it } from "vitest";
import {
  resolveRouterHealthMemoryPolicyFlag,
  shouldUseLegacyRouterMem0,
} from "./router.js";
import {
  TASK13_USER_ID,
  task13DisabledEnv,
  task13PilotEnv,
} from "../memory/healthMemoryFixtures.js";

describe("Task 13 router Health memory policy gate", () => {
  it("disables direct legacy Mem0 reads and writes for Health when the pilot flag is active", () => {
    const healthPilot = resolveRouterHealthMemoryPolicyFlag({
      domain: "health",
      userId: TASK13_USER_ID,
      env: task13PilotEnv,
    });
    expect(healthPilot).toMatchObject({
      effectiveMode: "pilot",
      reasonCode: "health_memory_policy_allowed_user",
    });
    expect(shouldUseLegacyRouterMem0("health", healthPilot)).toBe(false);
  });

  it("fails closed for Health when the consent-aware policy is disabled", () => {
    const healthDisabled = resolveRouterHealthMemoryPolicyFlag({
      domain: "health",
      userId: TASK13_USER_ID,
      env: task13DisabledEnv,
    });
    expect(healthDisabled).toMatchObject({
      effectiveMode: "disabled",
      reasonCode: "health_memory_policy_disabled_requested",
    });
    expect(shouldUseLegacyRouterMem0("health", healthDisabled)).toBe(false);
  });

  it("blocks legacy Mem0 for all sensitive medical and emergency routing domains", () => {
    expect(shouldUseLegacyRouterMem0("health", null)).toBe(false);
    expect(shouldUseLegacyRouterMem0("meds", null)).toBe(false);
    expect(shouldUseLegacyRouterMem0("safety", null)).toBe(false);
  });

  it("preserves legacy Mem0 only for non-medical routing domains", () => {
    expect(resolveRouterHealthMemoryPolicyFlag({
      domain: "companion",
      userId: TASK13_USER_ID,
      env: task13PilotEnv,
    })).toBeNull();
    expect(shouldUseLegacyRouterMem0("companion", null)).toBe(true);
    expect(shouldUseLegacyRouterMem0("concierge", null)).toBe(true);
    expect(shouldUseLegacyRouterMem0("brain_coach", null)).toBe(true);
  });
});
