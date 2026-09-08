import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("./0094_longevity_program_video_curation.sql", import.meta.url)), "utf8").toLowerCase();

describe("0094 longevity program video curation migration", () => {
  it("creates program-led longevity tables", () => {
    expect(sql).toContain("create table if not exists public.longevity_programs");
    expect(sql).toContain("create table if not exists public.longevity_program_days");
    expect(sql).toContain("create table if not exists public.longevity_video_resources");
    expect(sql).toContain("starter_video_longevity_v1");
  });

  it("enforces exact youtube resources and one active program per user", () => {
    expect(sql).toContain("longevity_video_resources_exact_youtube_url");
    expect(sql).toContain("youtube\\.com/watch\\?v=");
    expect(sql).toContain("idx_longevity_programs_user_active_program");
    expect(sql).toContain("where status = 'active'");
  });

  it("keeps the new tables backend-owned under row level security", () => {
    expect(sql).toContain("alter table public.longevity_programs enable row level security");
    expect(sql).toContain("alter table public.longevity_program_days enable row level security");
    expect(sql).toContain("alter table public.longevity_video_resources enable row level security");
    expect(sql).toContain("longevity_video_resources_backend_owned");
  });
});
