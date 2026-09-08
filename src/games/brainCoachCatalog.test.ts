import { describe, expect, it } from "vitest";
import {
  BRAIN_COACH_ACTIVITY_CATALOG,
  BRAIN_COACH_MODULES,
  getBrainCoachActivitiesForModule,
  getBrainCoachActivityPath,
} from "./brainCoachCatalog";

describe("brainCoachCatalog", () => {
  it("exposes the four user-facing cognitive modules", () => {
    expect(BRAIN_COACH_MODULES.map(({ id, route, title }) => ({ id, route, title }))).toEqual([
      { id: "memory", route: "/brain-coach/remember", title: "Remember" },
      { id: "reflexes", route: "/brain-coach/focus", title: "Focus & React" },
      { id: "thinking", route: "/brain-coach/think", title: "Think & Plan" },
      { id: "senses", route: "/brain-coach/calm", title: "Calm & Notice" },
    ]);
  });

  it("places every active activity in exactly one module", () => {
    const activeActivities = BRAIN_COACH_ACTIVITY_CATALOG.filter((activity) => activity.status === "active");
    const ids = activeActivities.map((activity) => activity.id);

    expect(activeActivities).toHaveLength(16);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getBrainCoachActivitiesForModule("memory")).toHaveLength(8);
    expect(getBrainCoachActivitiesForModule("reflexes")).toHaveLength(3);
    expect(getBrainCoachActivitiesForModule("thinking")).toHaveLength(3);
    expect(getBrainCoachActivitiesForModule("senses")).toHaveLength(2);
  });

  it("keeps user grouping separate from clinical domain and implementation runner", () => {
    for (const activity of BRAIN_COACH_ACTIVITY_CATALOG.filter(({ status }) => status === "active")) {
      expect(activity.cognitiveDomains.length).toBeGreaterThan(0);
      expect(activity.runner.type === "component" || activity.runner.type === "memory-engine").toBe(true);
      expect(activity.progression).toBeDefined();
    }

    expect(getBrainCoachActivitiesForModule("memory").map(({ id }) => id)).toEqual([
      "remember_later",
      "memory_match",
      "association_memory",
      "word_recall",
      "story_recall",
      "number_memory",
      "spatial_navigator",
      "face_name_match",
    ]);
    expect(getBrainCoachActivitiesForModule("reflexes").map(({ id }) => id)).toEqual([
      "dual_task_walk",
      "rhythm_sequence",
      "listen_closely",
    ]);
    expect(getBrainCoachActivitiesForModule("thinking").map(({ id }) => id)).toEqual([
      "curious_minds",
      "number_trails",
      "category_sort",
    ]);
    expect(getBrainCoachActivitiesForModule("senses").map(({ id }) => id)).toEqual([
      "breath_garden",
      "scent_memory",
    ]);
    expect(BRAIN_COACH_ACTIVITY_CATALOG.find(({ id }) => id === "routine_memory")?.progression).toEqual({
      kind: "levels",
      maxLevel: 5,
    });
    expect(BRAIN_COACH_ACTIVITY_CATALOG.find(({ id }) => id === "routine_memory")?.status).toBe("hidden");
    expect(BRAIN_COACH_ACTIVITY_CATALOG.find(({ id }) => id === "number_memory")?.progression).toEqual({
      kind: "levels",
      maxLevel: 30,
    });
  });

  it("creates one stable public path for every activity", () => {
    expect(getBrainCoachActivityPath("spatial_navigator")).toBe("/brain-coach/activity/spatial_navigator");
  });
});
