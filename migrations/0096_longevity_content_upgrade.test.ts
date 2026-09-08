import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("./0096_longevity_content_upgrade.sql", import.meta.url)), "utf8");
const lowerSql = sql.toLowerCase();

describe("0096 longevity content upgrade migration", () => {
  it("adds timing guidance and expands daily content types", () => {
    expect(lowerSql).toContain("add column if not exists timing_guidance text");
    expect(lowerSql).toContain("drop constraint if exists longevity_daily_content_content_type_check");
    expect(lowerSql).toContain("'supplement'");
    expect(lowerSql).toContain("'natural_solution'");
  });

  it("replaces the generic seed set with inactive reviewed Spanish rows", () => {
    expect(lowerSql).toContain("update public.longevity_daily_content");
    expect(lowerSql).toContain("set is_active = false");
    expect((lowerSql.match(/'es',/g) ?? []).length).toBeGreaterThanOrEqual(60);
    expect((lowerSql.match(/, false\)/g) ?? []).length).toBeGreaterThanOrEqual(60);
  });

  it("seeds every requested content category with timing guidance", () => {
    for (const type of ["exercise", "meal", "tip", "article", "supplement", "natural_solution"]) {
      expect(lowerSql).toContain(`('${type}',`);
    }
    expect(lowerSql).toContain("timing_guidance = excluded.timing_guidance");
    expect(lowerSql).toContain("on conflict (content_type, title, language) do update");
  });
});
