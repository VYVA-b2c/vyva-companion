import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("./0098_breath_garden_gentler_pacing.sql", import.meta.url)), "utf8").toLowerCase();

describe("0098 Breath Garden gentler pacing migration", () => {
  it("uses the new 5:6 pattern while preserving historical 4:6 sessions", () => {
    expect(sql).toContain("alter column guided_pattern_id set default 'gentle_5_6'");
    expect(sql).toContain("guided_pattern_id in ('gentle_4_6', 'gentle_5_6')");
  });
});
