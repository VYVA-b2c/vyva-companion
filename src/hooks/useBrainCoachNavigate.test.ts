import { describe, expect, it } from "vitest";
import { brainCoachNavigationPath } from "./useBrainCoachNavigate";

describe("Brain Power preview navigation", () => {
  it.each(["remember", "focus", "think", "calm"])("opens the real %s catalogue in preview", (module) => {
    expect(brainCoachNavigationPath(`/brain-coach/${module}`, "/dev/home-master/brain")).toBe(`/dev/brain/${module}`);
  });
  it("preserves game level and variant parameters", () => {
    expect(brainCoachNavigationPath("/brain-coach/activity/visual-memory?level=4&variant=2", "/dev/brain/remember"))
      .toBe("/dev/brain/activity/visual-memory?level=4&variant=2");
  });
  it("returns to the preview catalogue and menu", () => {
    expect(brainCoachNavigationPath("/mind-memory", "/dev/brain/remember")).toBe("/dev/home-master/brain");
    expect(brainCoachNavigationPath("/menu", "/dev/home-master/brain")).toBe("/dev/home-master/menu");
  });
  it("keeps authenticated routes and unrelated destinations unchanged", () => {
    expect(brainCoachNavigationPath("/brain-coach/remember", "/mind-memory")).toBe("/brain-coach/remember");
    expect(brainCoachNavigationPath("/settings/account", "/dev/brain/remember")).toBe("/settings/account");
  });
});
