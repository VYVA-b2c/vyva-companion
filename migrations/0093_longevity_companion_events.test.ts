import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("./0093_longevity_companion_events.sql", import.meta.url)), "utf8").toLowerCase();

describe("0093 longevity companion events migration", () => {
  it("creates backend-owned action event memory for longevity feedback", () => {
    expect(sql).toContain("create table if not exists public.longevity_action_events");
    expect(sql).toContain("event_type in ('shown','opened','done','too_hard','not_relevant')");
    expect(sql).toContain("source_context jsonb not null default '{}'::jsonb");
    expect(sql).toContain("idx_longevity_action_events_user_action_created");
  });

  it("activates safe starter content across all five pillars", () => {
    expect(sql).toContain("alter column is_active set default true");
    expect(sql).toContain("walk after lunch");
    expect(sql).toContain("one familiar brain coach round");
    expect(sql).toContain("supported chair strength");
    expect(sql).toContain("protein with the next meal");
    expect(sql).toContain("same bedtime tonight");
    expect(sql).toContain("'heart','");
    expect(sql).toContain("'brain','");
    expect(sql).toContain("'strength','");
    expect(sql).toContain("'nourishment','");
    expect(sql).toContain("'calm','");
    expect(sql).toContain("on conflict (content_type, title, language) do update");
  });
});
