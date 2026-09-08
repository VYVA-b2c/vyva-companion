import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADVISOR_SLUGS } from "../shared/advisors";

const migration = readFileSync(new URL("./0101_benefits_navigator.sql", import.meta.url), "utf8");
const advisorMigration = readFileSync(new URL("./0100_advisor_ines.sql", import.meta.url), "utf8");

describe("Benefits Navigator migrations", () => {
  it("registers the Inés advisor slug before sessions can reference it", () => {
    const migrationSlug = advisorMigration.match(/values \('([^']+)'/)?.[1];
    expect(migrationSlug).toBe("ines");
    expect(ADVISOR_SLUGS).toContain(migrationSlug);
  });

  it("creates the screening tables and seeds only inactive programmes", () => {
    const seed = migration.split("insert into benefits_programs")[1] ?? "";
    expect(migration).toContain("create table if not exists benefits_programs");
    expect(migration).toContain("create table if not exists benefits_screening_responses");
    expect(seed).not.toMatch(/\),\s*true\s*(?:\)|,|;)/);
    expect(seed.match(/\sfalse\s*(?:\)|,|;)/g)).toHaveLength(4);
  });
});
