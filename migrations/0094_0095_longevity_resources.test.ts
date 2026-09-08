import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
}

const resourceSql = readMigration("./0094_longevity_daily_content_resources.sql");
const walkingSql = readMigration("./0095_longevity_walking_activity_resources.sql");

describe("longevity resource migrations", () => {
  it("routes walking content to the nearby activities experience", () => {
    expect(resourceSql).toContain("/social-rooms/activities?source=longevity&intent=nearby-walk");
    expect(walkingSql).toContain("Find a nearby walk or activity");
    expect(walkingSql).toContain("interests=walking,nature,community,learning");
  });

  it("updates content without destructive database operations", () => {
    for (const sql of [resourceSql, walkingSql]) {
      expect(sql).not.toMatch(/\bdrop\s+(?:table|column)\b/i);
      expect(sql).not.toMatch(/\btruncate\b/i);
      expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    }
  });
});
