import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("./0097_breath_garden_guided_exercise.sql", import.meta.url)), "utf8").toLowerCase();

describe("0097 Breath Garden guided exercise migration", () => {
  it("stores guided-session timing and completion metadata", () => {
    expect(sql).toContain("target_duration_seconds integer not null default 120");
    expect(sql).toContain("guided_cycle_count integer not null default 0");
    expect(sql).toContain("guided_pattern_id text not null default 'gentle_4_6'");
    expect(sql).toContain("completion_reason text not null default 'timer_complete'");
  });

  it("persists the duration preference and allows non-assessment sessions to have no score", () => {
    expect(sql).toContain("preferred_duration_seconds integer not null default 120");
    expect(sql).toContain("alter column score drop not null");
    expect(sql).toContain("preferred_duration_seconds in (60, 120, 300)");
  });
});
