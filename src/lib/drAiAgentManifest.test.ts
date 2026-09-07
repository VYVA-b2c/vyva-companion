import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type DrAiManifest = {
  tools: Array<{ tool_config: { name: string; description: string } }>;
  conversation_config: {
    agent: {
      first_message: string;
      prompt: { prompt: string };
    };
  };
};

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "config/elevenlabs/dr-ai-agent.json"), "utf8"),
) as DrAiManifest;

describe("Dr. AI ElevenLabs manifest", () => {
  it("grounds the live agent in the authenticated medical profile", () => {
    const prompt = manifest.conversation_config.agent.prompt.prompt;

    expect(prompt).toContain("call retrieve_medical_profile exactly once");
    expect(prompt).toContain("Treat a successful profile response as the authoritative VYVA context");
    expect(prompt).toContain("health_conditions, allergies, medications, devices");
    expect(prompt).toContain("latest_vitals_scan, vitals_trend");
    expect(prompt).toContain("Do not say that you cannot access information the profile tool returned");
    expect(prompt).toContain("Current answers and current vitals always take precedence over stored context");
  });

  it("keeps profile retrieval inside the canonical triage and screen-sync sequence", () => {
    const prompt = manifest.conversation_config.agent.prompt.prompt;
    const triageIndex = prompt.indexOf("after the first triage call succeeds");
    const profileIndex = prompt.indexOf("call retrieve_medical_profile exactly once");
    const syncIndex = prompt.indexOf("then call sync_dr_ai_screen", profileIndex);

    expect(triageIndex).toBeGreaterThan(-1);
    expect(profileIndex).toBeGreaterThan(triageIndex);
    expect(syncIndex).toBeGreaterThan(profileIndex);
  });

  it("declares the complete profile, triage, and UI tool set", () => {
    expect(manifest.tools.map((tool) => tool.tool_config.name).sort()).toEqual([
      "open_dr_ai_vitals",
      "retrieve_medical_profile",
      "sync_dr_ai_screen",
      "vyva_triage_step",
    ]);
    expect(manifest.tools.find((tool) => tool.tool_config.name === "retrieve_medical_profile")?.tool_config.description)
      .toContain("health context, recent vitals and reports");
  });

  it("requires the canonical vitals offer and prevents unexplained silence", () => {
    const prompt = manifest.conversation_config.agent.prompt.prompt;
    expect(prompt).toContain("When vitals_prompt is present, it is the canonical question for this turn");
    expect(prompt).toContain("phone camera can estimate heart and breathing rate");
    expect(prompt).toContain("use camera, enter a device reading, or skip");
    expect(prompt).toContain("Never offer vitals during an emergency");
    expect(prompt).toContain("one short neutral holding phrase");
  });
});
