import { describe, expect, it } from "vitest";
import {
  BREATHING_MEDITATION_ACTIVITY_PLAYBOOKS,
  buildBreathingMeditationAgentContext,
  buildBreathingMeditationOpeningPrompt,
  buildBreathGardenPhasePrompt,
} from "../../shared/breathingMeditationAgent";

describe("breathing and meditation agent activity contracts", () => {
  it("gives every registered activity an explicit versioned playbook", () => {
    expect(Object.keys(BREATHING_MEDITATION_ACTIVITY_PLAYBOOKS)).toEqual(["breath_garden", "relax_breathe"]);
    for (const playbook of Object.values(BREATHING_MEDITATION_ACTIVITY_PLAYBOOKS)) {
      expect(playbook.version).toMatch(/\.v\d+$/);
      expect(playbook.agentRole.length).toBeGreaterThan(40);
    }
  });

  it("identifies Breath Garden and leaves timing authority with the application", () => {
    const context = buildBreathingMeditationAgentContext({
      activityId: "breath_garden",
      language: "en",
      durationSeconds: 120,
      patternId: "gentle_5_6",
      inhaleSeconds: 5,
      exhaleSeconds: 6,
      holdSeconds: 0,
    });

    expect(context).toMatchObject({
      activity_id: "breath_garden",
      activity_playbook_version: "breath_garden.gentle_5_6.v1",
      duration_seconds: 120,
      breathing_pattern_id: "gentle_5_6",
      inhale_seconds: 5,
      exhale_seconds: 6,
      hold_seconds: 0,
      timer_authority: "application",
    });
    expect(buildBreathingMeditationOpeningPrompt(context)).toContain("never invent a new phase");
  });

  it("requests phase cues in the active language without prescribing English speech", () => {
    const prompt = buildBreathGardenPhasePrompt("inhale", "es");

    expect(prompt).toContain("Current phase: inhale.");
    expect(prompt).toContain("Required response language: es.");
    expect(prompt).not.toContain("Breathe in, gently.");
    expect(prompt).not.toContain("Breathe out, slowly.");
  });
});
