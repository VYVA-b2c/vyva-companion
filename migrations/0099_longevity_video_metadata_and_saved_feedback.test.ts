import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("./0099_longevity_video_metadata_and_saved_feedback.sql", import.meta.url)), "utf8").toLowerCase();

describe("0099 longevity video metadata and saved feedback migration", () => {
  it("adds public video metadata for the guided companion", () => {
    expect(sql).toContain("alter table if exists public.longevity_video_resources");
    expect(sql).toContain("add column if not exists pillar text");
    expect(sql).toContain("add column if not exists transcript_summary text");
    expect(sql).toContain("add column if not exists after_watch_action text");
    expect(sql).toContain("add column if not exists good_for text[]");
    expect(sql).toContain("add column if not exists not_for text[]");
    expect(sql).toContain("add column if not exists moment_fit text[]");
  });

  it("constrains pillar and moment fit values for reviewed resources", () => {
    expect(sql).toContain("longevity_video_resources_pillar_check");
    expect(sql).toContain("'heart','brain','strength','nourishment','calm'");
    expect(sql).toContain("longevity_video_resources_moment_fit_check");
    expect(sql).toContain("array['morning','midday','afternoon','evening']::text[]");
    expect(sql).toContain("idx_longevity_video_resources_user_pillar");
  });

  it("allows saved as a longevity feedback event", () => {
    expect(sql).toContain("drop constraint if exists lae_event_type_check");
    expect(sql).toContain("event_type in ('shown','opened','saved','done','too_hard','not_relevant')");
  });
});
