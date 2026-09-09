import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("./0102_whatsapp_private_checkins.sql", import.meta.url), "utf8");

describe("WhatsApp private check-in migration", () => {
  it("is additive and keeps opaque tickets separate from health responses", () => {
    expect(migration).toContain("create table if not exists whatsapp_private_checkins");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("request_key_hash text not null unique");
    expect(migration).toContain("response_payload jsonb");
    expect(migration).toContain("whatsapp_opt_in_confirmed_at timestamptz not null");
    expect(migration).not.toMatch(/drop\s+(table|column)/i);
  });
});
