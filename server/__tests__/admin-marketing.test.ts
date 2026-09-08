import express from "express";
import request from "supertest";
import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  let idCounter = 1;
  const rows = new Map<string, Record<string, unknown>[]>();
  const missingTables = new Set<string>();
  let tableName: ((table: unknown) => string) | null = null;

  function nameFor(table: unknown) {
    if (!tableName) throw new Error("tableName helper not set");
    return tableName(table);
  }

  function rowDefaults(value: Record<string, unknown>) {
    return {
      id: `00000000-0000-4000-8000-${String(idCounter++).padStart(12, "0")}`,
      created_at: new Date("2026-07-05T10:00:00.000Z"),
      updated_at: new Date("2026-07-05T10:00:00.000Z"),
      ...value,
    };
  }

  function chain(data: Record<string, unknown>[]) {
    const api = {
      where: () => api,
      orderBy: () => api,
      limit: async () => data,
      then: (resolve: (value: Record<string, unknown>[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(data).then(resolve, reject),
    };
    return api;
  }

  function tableRows(table: unknown) {
    const name = nameFor(table);
    if (missingTables.has(name)) {
      const error = new Error(`relation "${name}" does not exist`) as Error & { code: string };
      error.code = "42P01";
      throw error;
    }
    const existing = rows.get(name) ?? [];
    rows.set(name, existing);
    return existing;
  }

  return {
    rows,
    setTableName(fn: (table: unknown) => string) {
      tableName = fn;
    },
    reset() {
      idCounter = 1;
      rows.clear();
      missingTables.clear();
    },
    setMissingTable(name: string) {
      missingTables.add(name);
    },
    db: {
      select: vi.fn(() => ({
        from: (table: unknown) => chain(tableRows(table)),
      })),
      insert: vi.fn((table: unknown) => ({
        values: (values: Record<string, unknown> | Record<string, unknown>[]) => {
          const name = nameFor(table);
          const current = rows.get(name) ?? [];
          const valueRows = Array.isArray(values) ? values : [values];
          const inserted = valueRows.map((value) => rowDefaults(value));
          const builder = {
            onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
              const upserted = inserted.map((item) => {
                const externalId = item.lovable_external_id;
                const existing = current.find((row) => externalId && row.lovable_external_id === externalId);
                if (existing) {
                  Object.assign(existing, set);
                  return existing;
                }
                current.push(item);
                return item;
              });
              rows.set(name, current);
              return { returning: async () => upserted };
            },
            returning: async () => {
              current.push(...inserted);
              rows.set(name, current);
              return inserted;
            },
            then: (resolve: (value: Record<string, unknown>[]) => unknown, reject?: (reason: unknown) => unknown) => {
              current.push(...inserted);
              rows.set(name, current);
              return Promise.resolve(inserted).then(resolve, reject);
            },
          };
          return builder;
        },
      })),
      update: vi.fn((table: unknown) => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => {
            const applyPatch = () => {
              const current = tableRows(table);
              const target = current[0] ?? rowDefaults({});
              if (!current.length) current.push(target);
              Object.assign(target, patch);
              return [target];
            };
            return {
              returning: async () => applyPatch(),
              then: (resolve: (value: Record<string, unknown>[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(applyPatch()).then(resolve, reject),
            };
          },
        }),
      })),
      delete: vi.fn((table: unknown) => ({
        where: async () => {
          const name = nameFor(table);
          if (name === "marketing_media_assets") return;
          rows.set(name, []);
        },
      })),
    },
  };
});

vi.mock("../db.js", () => dbMock);

const dispatchMock = vi.hoisted(() => ({
  dispatchCommunicationsByIds: vi.fn(async (ids: string[]) => ({
    processed: ids.length,
    results: ids.map((id) => ({
      id,
      channel: "email",
      recipient: "karim.assad@mokadigital.net",
      status: "sent",
    })),
  })),
}));

vi.mock("../services/communicationDispatcher.js", () => dispatchMock);

const openAiMock = vi.hoisted(() => ({
  imageGenerate: vi.fn(async () => ({ data: [{ b64_json: Buffer.from("fake-vyva-image").toString("base64") }] })),
  chatCreate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    images = { generate: openAiMock.imageGenerate };
    chat = { completions: { create: openAiMock.chatCreate } };
  },
}));

import { adminMarketingRouter } from "../routes/adminMarketing.js";
import { runMarketingEmailSchedulerOnce } from "../services/marketingEmailScheduler.js";

function buildApp(email = "admin@example.com") {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/marketing", (req, _res, next) => {
    if (email) req.user = { id: "admin-test", role: "admin", email };
    next();
  }, adminMarketingRouter);
  return app;
}

function table(name: string) {
  return dbMock.rows.get(name) ?? [];
}

describe("admin marketing router", () => {
  beforeEach(() => {
    dbMock.reset();
    dbMock.setTableName(getTableName);
    dispatchMock.dispatchCommunicationsByIds.mockClear();
    openAiMock.imageGenerate.mockClear();
    openAiMock.chatCreate.mockClear();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPER_ADMIN_EMAIL", "karim.assad@mokadigital.net");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires an admin user for marketing endpoints", async () => {
    await request(buildApp(""))
      .get("/api/admin/marketing/summary")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toBe("Admin access required.");
      });
  });

  it("keeps Source sync super-admin only", async () => {
    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/sync/source/run")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toContain("Only the super admin");
      });
  });

  it("keeps marketing test emails super-admin only", async () => {
    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/campaigns/00000000-0000-4000-8000-000000000001/test-email")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toBe("Only the super admin can send marketing test emails.");
      });
    expect(dispatchMock.dispatchCommunicationsByIds).not.toHaveBeenCalled();
  });

  it("keeps marketing campaign email sends super-admin only", async () => {
    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/campaigns/00000000-0000-4000-8000-000000000001/send-email")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toBe("Only the super admin can send marketing campaign emails.");
      });
    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/campaigns/send-due-email")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toBe("Only the super admin can send due scheduled marketing emails.");
      });
    expect(dispatchMock.dispatchCommunicationsByIds).not.toHaveBeenCalled();
  });

  it("generates marketing campaign copy with a safe fallback when OpenAI is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/ai/campaign-draft")
      .send({
        playLabel: "Partner outreach",
        audienceType: "b2b",
        channel: "linkedin",
        tone: "direct",
        targetAudienceName: "Partners",
        campaignBrief: "Invite Madrid partners to a practical webinar by email and LinkedIn.",
        objective: "Start a partner conversation.",
        subjectSeed: "A practical care-team layer",
        bodySeed: "VYVA helps families and providers coordinate support.",
        ctaLabel: "Book intro",
        ctaUrl: "https://v2.vyva.life",
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          configured: false,
          source: "fallback",
          draft: {
            campaignName: "Partner outreach - Partners",
            subject: "A practical care-team layer",
            ctaLabel: "Book intro",
            ctaUrl: "https://v2.vyva.life",
          },
        });
        expect(response.body.draft.objective).toContain("Campaign brief: Invite Madrid partners");
        expect(response.body.draft.body).toContain("Campaign brief: Invite Madrid partners");
        expect(response.body.draft.designJson.campaignBrief).toBe("Invite Madrid partners to a practical webinar by email and LinkedIn.");
        expect(response.body.draft.body).toContain("non-clinical");
        expect(response.body.note).toContain("OPENAI_API_KEY");
      });
  });

  it("reports whether the current admin can run Source sync", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("VYVA_MARKETING_EXPORT_TOKEN", "secret");
    vi.stubEnv("MARKETING_EMAIL_SCHEDULER_ENABLED", "true");
    vi.stubEnv("MARKETING_EMAIL_SCHEDULER_INTERVAL_MINUTES", "7");
    vi.stubEnv("MARKETING_EMAIL_SCHEDULER_INITIAL_DELAY_SECONDS", "12");

    await request(buildApp("ops@example.com"))
      .get("/api/admin/marketing/sync/source")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          backendBuild: "marketing-sync-status-2026-07-12-no-cache",
          configured: true,
          canRunSync: false,
          realSendingLocked: false,
          requiredRunnerEmail: "karim.assad@mokadigital.net",
          diagnostics: {
            apiUrlSource: "SOURCE_MARKETING_API_URL",
            tokenSource: "VYVA_MARKETING_EXPORT_TOKEN",
            hasDefaultEndpoint: false,
            hasBearerToken: true,
            tokenAliasPresent: {
              SOURCE_MARKETING_API_KEY: false,
              VYVA_MARKETING_EXPORT_TOKEN: true,
            },
          },
        });
        expect(response.body.emailScheduler).toMatchObject({
          enabled: true,
          intervalMinutes: 7,
          initialDelaySeconds: 12,
          actor: "marketing-email-scheduler",
        });
        expect(response.body.lockedSendCapabilities).toContainEqual(expect.objectContaining({
          channel: "email",
          locked: false,
          sendCapability: "enabled",
        }));
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.headers["x-vyva-marketing-sync-build"]).toBe("marketing-sync-status-2026-07-12-no-cache");
      });

    await request(buildApp("karim.assad@mokadigital.net"))
      .get("/api/admin/marketing/sync/source")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          configured: true,
          canRunSync: true,
          requiredRunnerEmail: "karim.assad@mokadigital.net",
        });
      });
  });

  it("counts combined-audience contacts and campaigns in the eligible marketing summary buckets", async () => {
    dbMock.rows.set("marketing_campaigns", [
      { id: "campaign-b2c", name: "B2C", status: "draft", audience_type: "b2c", schedule_starts_at: null, updated_at: new Date("2026-07-05T10:00:00.000Z") },
      { id: "campaign-b2b", name: "B2B", status: "draft", audience_type: "b2b", schedule_starts_at: null, updated_at: new Date("2026-07-05T10:00:00.000Z") },
      { id: "campaign-both", name: "Both", status: "draft", audience_type: "both", schedule_starts_at: null, updated_at: new Date("2026-07-05T10:00:00.000Z") },
    ]);
    dbMock.rows.set("marketing_contacts", [
      { id: "contact-b2c", full_name: "B2C", audience_type: "b2c", updated_at: new Date("2026-07-05T10:00:00.000Z") },
      { id: "contact-b2b", full_name: "B2B", audience_type: "b2b", updated_at: new Date("2026-07-05T10:00:00.000Z") },
      { id: "contact-both-1", full_name: "Both 1", audience_type: "both", updated_at: new Date("2026-07-05T10:00:00.000Z") },
      { id: "contact-both-2", full_name: "Both 2", audience_type: "both", updated_at: new Date("2026-07-05T10:00:00.000Z") },
    ]);

    await request(buildApp())
      .get("/api/admin/marketing/summary")
      .expect(200)
      .expect((response) => {
        expect(response.body.byAudience).toEqual([
          { audienceType: "b2c", campaigns: 2, contacts: 3 },
          { audienceType: "b2b", campaigns: 2, contacts: 3 },
          { audienceType: "both", campaigns: 3, contacts: 4 },
        ]);
      });
  });

  it("previews the Source export without creating sync or marketing rows", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("VYVA_MARKETING_EXPORT_TOKEN", "secret");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        exportedAt: "2026-07-05T12:00:00.000Z",
        dataset: "live",
        saved_email_templates: [{ id: "template-1", template_name: "Welcome", html_content: "<p>Hello</p>", emailTemplate: { previewText: "Nested preview" } }],
        social_posts: [{ id: "post-1", platform: "linkedin", caption: "Partner update", image_url: "https://cdn.example.test/post.png" }],
        contacts: [{ id: "contact-1", profile: { firstName: "Hassan", emailAddress: "hassan@example.com", crmScore: 87 } }],
        campaigns: [{ id: "campaign-1", name: "Launch", channels: [{ channel: "email", template_id: "template-1" }] }],
        journeys: [{ id: "journey-1", name: "Nurture" }],
        journey_step_events: [{ id: "event-1", enrollmentExternalId: "enrollment-1", eventType: "entered", channel: "email" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    await request(buildApp("karim.assad@mokadigital.net"))
      .get("/api/admin/marketing/sync/source/preview")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          dataset: "live",
          exportedAt: "2026-07-05T12:00:00.000Z",
          summary: {
            exported: {
              content: 2,
              mediaAssets: 1,
              contacts: 1,
              campaigns: 1,
              campaignChannels: 1,
              journeys: 1,
              journeyStepEvents: 1,
            },
            contentSourceCounts: {
              saved_email_template: 1,
              social_post: 1,
            },
          },
        });
        expect(response.body.summary.fieldCoverage.content.firstClassFields).toEqual(expect.arrayContaining(["id", "template_name", "html_content", "emailTemplate.previewText"]));
        expect(response.body.summary.fieldCoverage.contacts.firstClassFields).toEqual(expect.arrayContaining(["profile.firstName", "profile.emailAddress", "profile.crmScore"]));
        expect(response.body.summary.fieldCoverage.contacts.metadataOnlyFields).not.toContain("profile.crmScore");
        expect(response.body.summary.fieldCoverage.campaigns.firstClassFields).toEqual(expect.arrayContaining(["channels.channel", "channels.template_id"]));
        expect(response.body.samples.content[0]).toMatchObject({
          id: "template-1",
          template_name: "Welcome",
          html_content: "<p>Hello</p>",
        });
        expect(response.body.samples.media[0]).toMatchObject({
          url: "https://cdn.example.test/post.png",
          sourceField: "image_url",
        });
        expect(response.body.rawArraySamples.social_posts[0]).toMatchObject({
          id: "post-1",
          platform: "linkedin",
          caption: "Partner update",
        });
      });

    expect(fetchMock).toHaveBeenCalledWith("https://source.example.test/marketing-export", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer secret" }),
    }));
    expect(table("marketing_sync_runs")).toHaveLength(0);
    expect(table("marketing_content_assets")).toHaveLength(0);
    fetchMock.mockRestore();
  });

  it("accepts VYVA export URL and token aliases for Source sync", async () => {
    vi.stubEnv("VYVA_MARKETING_EXPORT_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("VYVA_MARKETING_EXPORT_TOKEN", "alias-secret");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        content: [],
        contacts: [],
        campaigns: [],
        journeys: [],
        audiences: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    await request(buildApp("karim.assad@mokadigital.net"))
      .get("/api/admin/marketing/sync/source")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          configured: true,
          canRunSync: true,
          apiUrl: "https://source.example.test",
          diagnostics: {
            apiUrlSource: "VYVA_MARKETING_EXPORT_URL",
            tokenSource: "VYVA_MARKETING_EXPORT_TOKEN",
            hasBearerToken: true,
          },
        });
      });

    await request(buildApp("karim.assad@mokadigital.net"))
      .post("/api/admin/marketing/sync/source/run")
      .expect(200)
      .expect((response) => {
        expect(response.body.ok).toBe(true);
      });

    expect(fetchSpy).toHaveBeenCalledWith("https://source.example.test/marketing-export", {
      headers: {
        Authorization: "Bearer alias-secret",
        Accept: "application/json",
      },
    });
  });

  it("uses the VYVA Source export endpoint by default when only the token is configured", async () => {
    vi.stubEnv("VYVA_MARKETING_EXPORT_TOKEN", "default-url-secret");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        content: [],
        contacts: [],
        campaigns: [],
        journeys: [],
        audiences: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    await request(buildApp("karim.assad@mokadigital.net"))
      .get("/api/admin/marketing/sync/source")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          configured: true,
          canRunSync: true,
          apiUrl: "https://hecijzbvpxeagcapxwwn.supabase.co",
          diagnostics: {
            apiUrlSource: "default",
            tokenSource: "VYVA_MARKETING_EXPORT_TOKEN",
            hasDefaultEndpoint: true,
            hasBearerToken: true,
          },
        });
      });

    await request(buildApp("karim.assad@mokadigital.net"))
      .post("/api/admin/marketing/sync/source/run")
      .expect(200);

    expect(fetchSpy).toHaveBeenCalledWith("https://hecijzbvpxeagcapxwwn.supabase.co/functions/v1/marketing-export", {
      headers: {
        Authorization: "Bearer default-url-secret",
        Accept: "application/json",
      },
    });
  });

  it("surfaces missing marketing migration tables with an actionable message", async () => {
    dbMock.setMissingTable("marketing_media_assets");

    const response = await request(buildApp())
      .get("/api/admin/marketing/media")
      .expect(500);

    expect(response.body.error).toContain('Missing table "marketing_media_assets"');
    expect(response.body.error).toContain("0076_marketing_source_templates_tags.sql");
  });

  it("creates scheduled campaign snapshots without communication dispatch rows", async () => {
    const response = await request(buildApp())
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Caregiver welcome",
        status: "scheduled",
        audienceType: "b2c",
        scheduleStartsAt: "2026-07-06T09:00:00.000Z",
        channels: [{ channel: "email", status: "scheduled", scheduledAt: "2026-07-06T09:00:00.000Z" }],
        recipients: [{ channel: "email", recipient: "caregiver@example.com", snapshot: { name: "Caregiver" } }],
      })
      .expect(201);

    expect(response.body.campaign).toMatchObject({
      name: "Caregiver welcome",
      status: "scheduled",
      recipientCount: 1,
    });
    expect(table("marketing_campaigns")).toHaveLength(1);
    expect(table("marketing_campaign_channels")).toHaveLength(1);
    expect(table("marketing_campaign_channels")[0]).toMatchObject({ send_capability: "enabled" });
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("communications_log")).toHaveLength(0);
  });

  it("stores direct and offline campaign channels as planning records only", async () => {
    const response = await request(buildApp())
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Local outreach handoff",
        status: "scheduled",
        audienceType: "both",
        scheduleStartsAt: "2026-07-08T10:00:00.000Z",
        channels: [
          { channel: "sms", status: "scheduled", scheduledAt: "2026-07-08T09:00:00.000Z" },
          { channel: "phone", status: "scheduled", scheduledAt: "2026-07-08T11:00:00.000Z" },
          { channel: "print", status: "draft" },
          { channel: "event", status: "scheduled", scheduledAt: "2026-07-09T10:00:00.000Z" },
        ],
        recipients: [
          { channel: "sms", recipient: "+34600000001", snapshot: { consentStatus: "opted_in" } },
          { channel: "phone", recipient: "+34600000001", snapshot: { owner: "Partner lead" } },
        ],
      })
      .expect(201);

    expect(response.body.campaign.channels.map((channel: { channel: string }) => channel.channel)).toEqual(["sms", "phone", "print", "event"]);
    expect(table("marketing_campaign_channels").map((row) => row.send_capability)).toEqual(["planning_only", "planning_only", "planning_only", "planning_only"]);
    expect(table("marketing_campaign_recipients").map((row) => row.channel)).toEqual(["sms", "phone"]);
    expect(table("communications_log")).toHaveLength(0);
  });

  it("returns all campaign recipient snapshots beyond the old preview cap", async () => {
    const recipients = Array.from({ length: 105 }, (_, index) => ({
      channel: "email",
      recipient: `caregiver-${index + 1}@example.com`,
      snapshot: { lovableRecipientId: `recipient:${index + 1}` },
    }));

    const response = await request(buildApp())
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Large Source campaign",
        status: "scheduled",
        audienceType: "b2c",
        channels: [{ channel: "email", status: "scheduled" }],
        recipients,
      })
      .expect(201);

    expect(response.body.campaign.recipientCount).toBe(105);
    expect(response.body.campaign.recipients).toHaveLength(105);
    expect(response.body.campaign.recipients[104]).toMatchObject({
      recipient: "caregiver-105@example.com",
      snapshot: { lovableRecipientId: "recipient:105" },
    });

    const listResponse = await request(buildApp())
      .get("/api/admin/marketing/campaigns")
      .expect(200);

    const campaign = listResponse.body.campaigns.find((item: { name: string }) => item.name === "Large Source campaign");
    expect(campaign.recipientCount).toBe(105);
    expect(campaign.recipients).toHaveLength(105);
    expect(campaign.recipients[104]).toMatchObject({ recipient: "caregiver-105@example.com" });
  });

  it("sends only a super-admin test email through the existing dispatcher", async () => {
    const app = buildApp("karim.assad@mokadigital.net");
    const contentResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Welcome email",
        channel: "email",
        subject: "Welcome to VYVA",
        body: "This is the imported email body.",
        htmlBody: "<h1>Welcome to VYVA</h1>",
        ctaLabel: "Start",
        ctaUrl: "https://v2.vyva.life/start",
      })
      .expect(201);

    const campaignResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Welcome campaign",
        status: "scheduled",
        audienceType: "b2c",
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
        }],
      })
      .expect(201);

    await request(app)
      .post(`/api/admin/marketing/campaigns/${campaignResponse.body.campaign.id}/test-email`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          communication: {
            recipient: "karim.assad@mokadigital.net",
            status: "sent",
          },
        });
      });

    expect(table("communications_log")).toHaveLength(1);
    expect(table("communications_log")[0]).toMatchObject({
      channel: "email",
      recipient: "karim.assad@mokadigital.net",
      purpose: "marketing_campaign_test",
      status: "queued",
      body: "This is the imported email body.",
      metadata: expect.objectContaining({
        subject: "[TEST] Welcome to VYVA",
        campaign_id: campaignResponse.body.campaign.id,
        content_asset_id: contentResponse.body.content.id,
        htmlBody: "<h1>Welcome to VYVA</h1>",
        ctaLabel: "Start",
        ctaUrl: "https://v2.vyva.life/start",
        marketing_test_send: true,
      }),
    });
    expect(table("marketing_campaign_recipients")).toHaveLength(0);
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledTimes(1);
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledWith([table("communications_log")[0].id]);
  });

  it("sends saved email campaign recipients through the existing dispatcher", async () => {
    const app = buildApp("karim.assad@mokadigital.net");
    const contentResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Newsletter",
        channel: "email",
        subject: "July update",
        body: "This is the July update.",
        htmlBody: "<p>This is the July update.</p>",
        ctaLabel: "Read update",
        ctaUrl: "https://v2.vyva.life/july",
      })
      .expect(201);

    const campaignResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "July campaign",
        status: "scheduled",
        audienceType: "b2c",
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
        }],
        recipients: [
          { channel: "email", recipient: "caregiver@example.com", status: "planned", snapshot: { fullName: "Caregiver", consentStatus: "opted_in" } },
        ],
      })
      .expect(201);

    await request(app)
      .post(`/api/admin/marketing/campaigns/${campaignResponse.body.campaign.id}/send-email`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          sentCount: 1,
          failedCount: 0,
          skippedCount: 0,
        });
      });

    expect(table("communications_log")).toHaveLength(1);
    expect(table("communications_log")[0]).toMatchObject({
      channel: "email",
      recipient: "caregiver@example.com",
      purpose: "marketing_campaign_email",
      status: "queued",
      body: "This is the July update.",
      metadata: expect.objectContaining({
        subject: "July update",
        campaign_id: campaignResponse.body.campaign.id,
        content_asset_id: contentResponse.body.content.id,
        htmlBody: "<p>This is the July update.</p>",
        ctaLabel: "Read update",
        ctaUrl: "https://v2.vyva.life/july",
        marketing_campaign_send: true,
      }),
    });
    expect(table("marketing_campaign_recipients")[0]).toMatchObject({
      status: "sent",
      communication_log_id: table("communications_log")[0].id,
    });
    expect(table("marketing_campaigns")[0]).toMatchObject({ status: "published" });
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledTimes(1);
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledWith([table("communications_log")[0].id]);
  });

  it("runs due scheduled email campaigns without sending future campaigns", async () => {
    const app = buildApp("karim.assad@mokadigital.net");
    const contentResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Due newsletter",
        channel: "email",
        subject: "Due update",
        body: "This should go now.",
      })
      .expect(201);
    const dueAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const futureAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const dueCampaignResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Due campaign",
        status: "scheduled",
        audienceType: "b2c",
        scheduleStartsAt: dueAt,
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
          scheduledAt: dueAt,
        }],
        recipients: [
          { channel: "email", recipient: "due@example.com", status: "planned", scheduledAt: dueAt, snapshot: { fullName: "Due Contact", consentStatus: "opted_in" } },
        ],
      })
      .expect(201);

    await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Future campaign",
        status: "scheduled",
        audienceType: "b2c",
        scheduleStartsAt: futureAt,
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
          scheduledAt: futureAt,
        }],
        recipients: [
          { channel: "email", recipient: "future@example.com", status: "planned", scheduledAt: futureAt, snapshot: { fullName: "Future Contact", consentStatus: "opted_in" } },
        ],
      })
      .expect(201);

    await request(app)
      .post("/api/admin/marketing/campaigns/send-due-email")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          dueCount: 1,
          sentCount: 1,
          failedCount: 0,
          skippedCount: 0,
          results: [{
            campaignId: dueCampaignResponse.body.campaign.id,
            campaignName: "Due campaign",
            ok: true,
            sentCount: 1,
          }],
        });
      });

    expect(table("communications_log")).toHaveLength(1);
    expect(table("communications_log")[0]).toMatchObject({
      recipient: "due@example.com",
      purpose: "marketing_campaign_email",
    });
    expect(table("marketing_campaign_recipients").find((row) => row.recipient === "due@example.com")).toMatchObject({ status: "sent" });
    expect(table("marketing_campaign_recipients").find((row) => row.recipient === "future@example.com")).toMatchObject({ status: "planned" });
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledTimes(1);
  });

  it("lets the background scheduler send due email campaigns through the same dispatcher path", async () => {
    const app = buildApp("karim.assad@mokadigital.net");
    const contentResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Automated newsletter",
        channel: "email",
        subject: "Automation update",
        body: "This should be sent by the scheduler.",
      })
      .expect(201);
    const dueAt = "2026-07-05T09:00:00.000Z";
    const futureAt = "2026-07-05T12:00:00.000Z";

    await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Scheduler due campaign",
        status: "scheduled",
        audienceType: "b2c",
        scheduleStartsAt: dueAt,
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
          scheduledAt: dueAt,
        }],
        recipients: [
          { channel: "email", recipient: "due-scheduler@example.com", status: "planned", scheduledAt: dueAt, snapshot: { consentStatus: "opted_in" } },
        ],
      })
      .expect(201);

    await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Scheduler future campaign",
        status: "scheduled",
        audienceType: "b2c",
        scheduleStartsAt: futureAt,
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
          scheduledAt: futureAt,
        }],
        recipients: [
          { channel: "email", recipient: "future-scheduler@example.com", status: "planned", scheduledAt: futureAt, snapshot: { consentStatus: "opted_in" } },
        ],
      })
      .expect(201);

    vi.stubEnv("MARKETING_EMAIL_SCHEDULER_ENABLED", "true");
    const result = await runMarketingEmailSchedulerOnce(new Date("2026-07-05T10:00:00.000Z"));

    expect(result).toMatchObject({
      skipped: false,
      result: {
        ok: true,
        dueCount: 1,
        sentCount: 1,
        failedCount: 0,
      },
    });
    expect(table("communications_log")).toHaveLength(1);
    expect(table("communications_log")[0]).toMatchObject({
      recipient: "due-scheduler@example.com",
      purpose: "marketing_campaign_email",
      metadata: expect.objectContaining({ initiated_by: "marketing-email-scheduler" }),
    });
    expect(table("marketing_campaign_recipients").find((row) => row.recipient === "due-scheduler@example.com")).toMatchObject({ status: "sent" });
    expect(table("marketing_campaign_recipients").find((row) => row.recipient === "future-scheduler@example.com")).toMatchObject({ status: "planned" });
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledTimes(1);
  });

  it("updates and deletes marketing content assets", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Draft content",
        channel: "email",
        subject: "Draft",
        body: "Original body",
        mediaAssets: [{ url: "https://cdn.example.test/draft.png", type: "image" }],
      })
      .expect(201);

    const contentId = createResponse.body.content.id;
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/draft.png")).toMatchObject({
      content_asset_id: contentId,
      source: "vyva",
      asset_type: "image",
      status: "referenced",
      metadata: { media: { url: "https://cdn.example.test/draft.png", type: "image" }, source: "content_media_assets" },
    });

    await request(app)
      .patch(`/api/admin/marketing/content/${contentId}`)
      .send({
        title: "Updated content",
        channel: "instagram",
        language: "es",
        status: "approved",
        subject: "Updated subject",
        body: "Updated body",
        htmlBody: "<p>Updated</p>",
        ctaLabel: "Open",
        ctaUrl: "https://v2.vyva.life/open",
        designJson: { blocks: [{ type: "text" }] },
        mediaAssets: [{ url: "https://cdn.example.test/content.png" }],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.content).toMatchObject({
          id: contentId,
          title: "Updated content",
          channel: "instagram",
          language: "es",
          status: "approved",
          subject: "Updated subject",
          htmlBody: "<p>Updated</p>",
          ctaLabel: "Open",
          ctaUrl: "https://v2.vyva.life/open",
          mediaAssetCount: 1,
        });
      });

    expect(table("marketing_content_assets")[0]).toMatchObject({
      title: "Updated content",
      channel: "instagram",
      language: "es",
      status: "approved",
      subject: "Updated subject",
      body: "Updated body",
      html_body: "<p>Updated</p>",
      cta_label: "Open",
      cta_url: "https://v2.vyva.life/open",
      design_json: { blocks: [{ type: "text" }] },
      media_assets: [{ url: "https://cdn.example.test/content.png" }],
    });
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/content.png")).toMatchObject({
      content_asset_id: contentId,
      source: "vyva",
      asset_type: "unknown",
      status: "referenced",
      metadata: { media: { url: "https://cdn.example.test/content.png" }, source: "content_media_assets" },
    });

    dbMock.rows.set("marketing_campaign_channels", [{
      id: "channel-ref",
      campaign_id: "campaign-ref",
      channel: "email",
      content_asset_id: contentId,
      scheduled_at: null,
      status: "draft",
      send_capability: "email_enabled",
      metadata: {},
      created_at: new Date("2026-07-05T10:00:00.000Z"),
      updated_at: new Date("2026-07-05T10:00:00.000Z"),
    }]);
    dbMock.rows.set("marketing_journey_steps", [{
      id: "step-ref",
      journey_id: "journey-ref",
      step_order: 0,
      channel: "email",
      content_asset_id: contentId,
      delay_hours: 0,
      kind: "message",
      day_offset: 0,
      template_kind: null,
      template_ref: null,
      config: {},
      status: "draft",
      metadata: {},
      created_at: new Date("2026-07-05T10:00:00.000Z"),
      updated_at: new Date("2026-07-05T10:00:00.000Z"),
    }]);

    await request(app)
      .delete(`/api/admin/marketing/content/${contentId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedContentId: contentId });
      });

    expect(table("marketing_content_assets")).toHaveLength(0);
    expect(table("marketing_campaign_channels")[0]).toMatchObject({ content_asset_id: null });
    expect(table("marketing_journey_steps")[0]).toMatchObject({ content_asset_id: null });
  });

  it("updates and deletes marketing media references", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Media content",
        channel: "email",
        body: "Body",
      })
      .expect(201);
    const contentId = createResponse.body.content.id;
    const mediaId = "00000000-0000-4000-8000-000000000099";
    dbMock.rows.set("marketing_media_assets", [{
      id: mediaId,
      content_asset_id: contentId,
      source: "lovable",
      asset_type: "image",
      original_url: "https://cdn.example.test/original.png",
      local_url: null,
      status: "referenced",
      lovable_external_id: "media:original",
      metadata: { lovable: { altText: "Original" } },
      created_at: new Date("2026-07-05T10:00:00.000Z"),
      updated_at: new Date("2026-07-05T10:00:00.000Z"),
    }]);

    await request(app)
      .patch(`/api/admin/marketing/media/${mediaId}`)
      .send({
        contentAssetId: contentId,
        assetType: "hero_image",
        originalUrl: "https://cdn.example.test/updated.png",
        localUrl: "/media/updated.png",
        status: "approved",
        lovableExternalId: "media:updated",
        metadata: { altText: "Updated" },
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.mediaAsset).toMatchObject({
          id: mediaId,
          contentAssetId: contentId,
          contentTitle: "Media content",
          assetType: "hero_image",
          originalUrl: "https://cdn.example.test/updated.png",
          localUrl: "/media/updated.png",
          status: "approved",
          lovableExternalId: "media:updated",
          metadata: { altText: "Updated" },
        });
      });

    expect(table("marketing_media_assets")[0]).toMatchObject({
      content_asset_id: contentId,
      asset_type: "hero_image",
      original_url: "https://cdn.example.test/updated.png",
      local_url: "/media/updated.png",
      status: "approved",
      lovable_external_id: "media:updated",
      metadata: { altText: "Updated" },
    });

    await request(app)
      .delete(`/api/admin/marketing/media/${mediaId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedMediaAssetId: mediaId });
      });
  });

  it("updates and deletes marketing contacts", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/contacts")
      .send({
        fullName: "Partner Lead",
        audienceType: "b2b",
        email: "lead@example.com",
        phoneNumber: "+34 600 000 001",
        tags: ["partner"],
      })
      .expect(201);

    const contactId = createResponse.body.contact.id;
    await request(app)
      .patch(`/api/admin/marketing/contacts/${contactId}`)
      .send({
        fullName: "Updated Partner Lead",
        audienceType: "both",
        email: "updated@example.com",
        phoneNumber: "+34 600 000 004",
        whatsappNumber: "+34 600 000 005",
        roleLabel: "Growth lead",
        companyName: "Updated Org",
        language: "es",
        category: "partner",
        vertical: "care",
        market: "Madrid",
        consentStatus: "opted_in",
        tags: ["partner", "priority"],
        channelAvailability: { email: true, phone: true, whatsapp: true },
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.contact).toMatchObject({
          id: contactId,
          fullName: "Updated Partner Lead",
          audienceType: "both",
          email: "updated@example.com",
          phoneNumber: "+34 600 000 004",
          whatsappNumber: "+34 600 000 005",
          roleLabel: "Growth lead",
          companyName: "Updated Org",
          language: "es",
          category: "partner",
          vertical: "care",
          market: "Madrid",
          consentStatus: "opted_in",
          tags: ["partner", "priority"],
        });
      });

    expect(table("marketing_contacts")[0]).toMatchObject({
      full_name: "Updated Partner Lead",
      audience_type: "both",
      email: "updated@example.com",
      phone_number: "+34 600 000 004",
      whatsapp_number: "+34 600 000 005",
      role_label: "Growth lead",
      company_name: "Updated Org",
      language: "es",
      category: "partner",
      vertical: "care",
      market: "Madrid",
      consent_status: "opted_in",
      tags: ["partner", "priority"],
      channel_availability: { email: true, phone: true, whatsapp: true },
    });

    await request(app)
      .delete(`/api/admin/marketing/contacts/${contactId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedContactId: contactId });
      });

    expect(table("marketing_contacts")).toHaveLength(0);
  });

  it("updates and deletes marketing audiences and memberships", async () => {
    const app = buildApp();
    const contactResponse = await request(app)
      .post("/api/admin/marketing/contacts")
      .send({
        fullName: "Partner Lead",
        audienceType: "b2b",
        email: "lead@example.com",
        lovableExternalId: "lovable-contact-1",
      })
      .expect(201);
    const contactId = contactResponse.body.contact.id;
    const additionalContactExternalIds: string[] = [];
    for (let index = 2; index <= 15; index += 1) {
      await request(app)
        .post("/api/admin/marketing/contacts")
        .send({
          fullName: `Partner Lead ${index}`,
          audienceType: "b2b",
          email: `lead-${index}@example.com`,
          lovableExternalId: `lovable-contact-${index}`,
        })
        .expect(201);
      additionalContactExternalIds.push(`lovable-contact-${index}`);
    }
    const fullAudienceContactExternalIds = ["lovable-contact-1", ...additionalContactExternalIds, "missing-contact"];

    const createResponse = await request(app)
      .post("/api/admin/marketing/audiences")
      .send({
        name: "Partners",
        listType: "static",
        description: "Imported partner list",
        rules: { market: "Spain" },
        contactExternalIds: fullAudienceContactExternalIds,
      })
      .expect(201);

    const audienceId = createResponse.body.audience.id;
    expect(createResponse.body.audience).toMatchObject({
      id: audienceId,
      name: "Partners",
      memberCount: 16,
      mappedMemberCount: 15,
      contactExternalIds: fullAudienceContactExternalIds,
      unmappedContactExternalIds: ["missing-contact"],
    });
    expect(createResponse.body.audience.memberPreview).toHaveLength(15);
    expect(createResponse.body.audience.memberPreview).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fullName: "Partner Lead",
        email: "lead@example.com",
        lovableExternalId: "lovable-contact-1",
        contactExternalId: "lovable-contact-1",
      }),
      expect.objectContaining({
        fullName: "Partner Lead 15",
        email: "lead-15@example.com",
        lovableExternalId: "lovable-contact-15",
        contactExternalId: "lovable-contact-15",
      }),
    ]));

    await request(app)
      .patch(`/api/admin/marketing/audiences/${audienceId}`)
      .send({
        name: "Updated partners",
        listType: "dynamic",
        description: "Updated partner list",
        rules: { market: "Madrid", vertical: "care" },
        contactExternalIds: [contactId, "new-unmapped-contact"],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.audience).toMatchObject({
          id: audienceId,
          name: "Updated partners",
          listType: "dynamic",
          description: "Updated partner list",
          rules: { market: "Madrid", vertical: "care" },
          memberCount: 2,
          mappedMemberCount: 1,
          contactExternalIds: [contactId, "new-unmapped-contact"],
          memberPreview: [expect.objectContaining({
            fullName: "Partner Lead",
            email: "lead@example.com",
            lovableExternalId: "lovable-contact-1",
            contactExternalId: contactId,
          })],
          unmappedContactExternalIds: ["new-unmapped-contact"],
        });
      });

    expect(table("marketing_audiences")[0]).toMatchObject({
      name: "Updated partners",
      list_type: "dynamic",
      description: "Updated partner list",
      rules: { market: "Madrid", vertical: "care" },
    });
    expect(table("marketing_audience_members")).toHaveLength(2);

    await request(app)
      .delete(`/api/admin/marketing/audiences/${audienceId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedAudienceId: audienceId });
      });

    expect(table("marketing_audiences")).toHaveLength(0);
    expect(table("marketing_audience_members")).toHaveLength(0);
  });

  it("updates campaign planning rows and deletes campaigns without dispatch", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Partner outreach",
        status: "draft",
        audienceType: "b2b",
        channels: [{ channel: "email", status: "draft" }],
      })
      .expect(201);

    const campaignId = createResponse.body.campaign.id;
    await request(app)
      .patch(`/api/admin/marketing/campaigns/${campaignId}`)
      .send({
        name: "Updated outreach",
        status: "scheduled",
        audienceType: "both",
        objective: "Updated objective",
        scheduleStartsAt: "2026-07-10T09:00:00.000Z",
        channels: [{ channel: "whatsapp", status: "scheduled", scheduledAt: "2026-07-10T09:00:00.000Z" }],
        recipients: [{ channel: "whatsapp", recipient: "+34600000001", scheduledAt: "2026-07-10T09:00:00.000Z", snapshot: { fullName: "Karim" } }],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.campaign).toMatchObject({
          id: campaignId,
          name: "Updated outreach",
          status: "scheduled",
          audienceType: "both",
          recipientCount: 1,
        });
      });

    expect(table("marketing_campaign_channels")).toHaveLength(1);
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("communications_log")).toHaveLength(0);

    await request(app)
      .delete(`/api/admin/marketing/campaigns/${campaignId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedCampaignId: campaignId });
      });

    expect(table("marketing_campaigns")).toHaveLength(0);
    expect(table("marketing_campaign_channels")).toHaveLength(0);
    expect(table("marketing_campaign_recipients")).toHaveLength(0);
  });

  it("updates and deletes journey planning records", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/journeys")
      .send({
        name: "Partner nurture",
        audienceType: "b2b",
        objective: "Warm partner leads",
        steps: [],
      })
      .expect(201);

    const journeyId = createResponse.body.journey.id;
    expect(createResponse.body.journey.steps).toEqual([]);
    expect(table("marketing_journeys")).toHaveLength(1);
    expect(table("marketing_journey_steps")).toHaveLength(0);

    await request(app)
      .patch(`/api/admin/marketing/journeys/${journeyId}`)
      .send({
        name: "Updated nurture",
        status: "paused",
        audienceType: "both",
        objective: "Updated objective",
        triggerType: "list_joined",
        triggerConfig: { list: "partners" },
        goalType: "reply",
        goalConfig: { withinDays: 14 },
        exitOnGoal: false,
        steps: [
          { stepOrder: 0, channel: "email", delayHours: 0, dayOffset: 0, status: "draft", kind: "message", templateKind: "email_template", templateRef: "welcome-template", config: { subject: "Welcome" }, metadata: { notes: "First touch" } },
          { stepOrder: 1, channel: "whatsapp", delayHours: 48, dayOffset: 2, status: "draft", kind: "message", config: { window: "caregiver" }, metadata: { notes: "Second touch" } },
        ],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.journey).toMatchObject({
          id: journeyId,
          name: "Updated nurture",
          status: "paused",
          audienceType: "both",
          objective: "Updated objective",
          triggerType: "list_joined",
          triggerConfig: { list: "partners" },
          goalType: "reply",
          goalConfig: { withinDays: 14 },
          exitOnGoal: false,
          steps: [
            { stepOrder: 0, channel: "email", delayHours: 0, templateKind: "email_template", templateRef: "welcome-template", config: { subject: "Welcome" }, metadata: { notes: "First touch" } },
            { stepOrder: 1, channel: "whatsapp", delayHours: 48, dayOffset: 2, config: { window: "caregiver" }, metadata: { notes: "Second touch" } },
          ],
        });
      });

    expect(table("marketing_journey_steps")).toHaveLength(2);

    await request(app)
      .patch(`/api/admin/marketing/journeys/${journeyId}`)
      .send({
        steps: [
          { stepOrder: 0, channel: "email", delayHours: 24, dayOffset: 1, status: "active", kind: "message" },
        ],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.journey.steps).toHaveLength(1);
        expect(response.body.journey.steps[0]).toMatchObject({ stepOrder: 0, channel: "email", delayHours: 24, status: "active" });
      });

    expect(table("marketing_journey_steps")).toHaveLength(1);

    await request(app)
      .delete(`/api/admin/marketing/journeys/${journeyId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedJourneyId: journeyId });
      });

    expect(table("marketing_journeys")).toHaveLength(0);
    expect(table("marketing_journey_steps")).toHaveLength(0);
  });

  it("imports Source data one-way and upserts by external id", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("SOURCE_MARKETING_API_KEY", "secret");
    const longDesignBlocks = Array.from({ length: 14 }, (_, index) => ({
      type: "section",
      headline: `Long design section ${index + 1}`,
      body: `Imported Source body ${index + 1}`,
    }));
    const manyMediaAssets = Array.from({ length: 13 }, (_, index) => ({
      url: `https://cdn.example.test/gallery-${index + 1}.png`,
      type: "image",
    }));
    const lovablePayload = {
      dataset: "live",
      exportedAt: "2026-07-05T12:00:00.000Z",
      content: [{
        id: "content:content-1",
        title: "Welcome email",
        channel: "email",
        subject: "Welcome",
        body: "Hello",
        htmlBody: "<h1>Hello</h1>",
        blocks: JSON.stringify([{ type: "hero" }]),
        mediaAssets: JSON.stringify([{ url: "https://cdn.example.test/hero.png", type: "image" }]),
        ctaLabel: "Start",
        ctaUrl: "https://v2.vyva.life/start",
        extraSourceOnlyField: "kept in metadata",
      }, {
        id: "content:alias-content",
        template_name: "Alias-heavy email",
        channel: "email",
        subject_line: "Alias subject",
        plain_text_content: "Alias plain copy",
        body_html: "<p>Alias HTML</p>",
        button_label: "Book now",
        button_url: "https://v2.vyva.life/book",
        email_design: JSON.stringify({ sections: [{ kind: "hero" }] }),
        cover_image_url: "https://cdn.example.test/alias-cover.png",
      }, {
        id: "content:long-design",
        title: "Long Source builder page",
        channel: "email",
        email_design: JSON.stringify({ sections: longDesignBlocks }),
        mediaAssets: JSON.stringify(manyMediaAssets),
      }, {
        id: "content:bare-url-image",
        title: "Bare URL image content",
        channel: "instagram",
        body: "Builder exports sometimes put the hero image in a generic url field.",
        url: "https://cdn.example.test/bare-url-hero.webp",
      }],
      saved_email_templates: [{
        id: "template-1",
        template_name: "Template welcome",
        email_subject: "Template subject",
        html_content: "<p>Template body</p>",
        button_text: "Read more",
        link: "https://v2.vyva.life/template",
      }],
      structuredTemplates: [{
        id: "template:structured-1",
        name: "Partner outreach",
        description: "Reusable B2B campaign fields",
        category: "b2b",
        language: "en",
        fields: [{
          name: "headline",
          type: "text",
          required: true,
          placeholder: "A better way to support families",
        }],
        ownerUserId: "lovable-owner-1",
        updatedAt: "2026-07-05T11:00:00.000Z",
      }],
      contactTags: [{
        id: "contact_tag:partner",
        name: "Partner",
        color: "#7c3aed",
        ownerUserId: "lovable-owner-1",
        updatedAt: "2026-07-05T11:30:00.000Z",
      }],
      social_posts: [{
        id: "post-1",
        headline: "Partner post",
        platform: "linkedin",
        caption: JSON.stringify({ blocks: [{ text: "Partner update copy" }] }),
        image_url: "https://cdn.example.test/social.png",
      }],
      media_assets: [{
        id: "media:standalone-1",
        content_external_id: "content-1",
        original_url: "https://cdn.example.test/standalone.png",
        asset_type: "image",
        status: "referenced",
      }],
      content_briefs: [{
        id: "brief-1",
        title: "Brief idea",
        channel: "email",
        sections: JSON.stringify([{ text: "Long-form planning brief" }]),
      }],
      contacts: [{
        id: "contact:contact-1",
        profile: {
          firstName: "Hassan",
          emailAddress: "hassan@example.com",
          phoneNumber: "+34 600 000 001",
          whatsappNumber: "+34 600 000 002",
          crmScore: 91,
        },
        audienceType: "b2b",
        roleLabel: "Partner",
        companyName: "Moka",
        language: "en",
        category: "lead",
        vertical: "healthcare",
        market: "Spain",
        tags: ["partner"],
        lists: ["Shortlist 1 - Home Care"],
      }],
      email_unsubscribes: [{
        id: "unsubscribe-1",
        email: "hassan@example.com",
        reason: "lovable_opt_out",
      }],
      contact_lists: [{
        id: "audience:audience-1",
        name: "Partners",
        description: "Partner mailing list",
        listType: "static",
        rules: JSON.stringify({ market: "Spain" }),
      }],
      contact_list_members: [{
        id: "list-member-1",
        list_id: "audience-1",
        contact_id: "contact-1",
      }, {
        id: "list-member-2",
        list_id: "audience-1",
        contact_id: "missing-contact",
      }],
      campaigns: [{
        id: "campaign:campaign-1",
        name: "Welcome campaign",
        status: "scheduled",
        scheduleStartsAt: "2026-07-08T09:00:00.000Z",
        scheduleEndsAt: "2026-07-08T11:00:00.000Z",
        audienceExternalIds: ["audience-1"],
        channels: [{ channel: "email", contentExternalId: "content-1", scheduledAt: "2026-07-08T09:00:00.000Z" }],
      }, {
        id: "campaign-2",
        name: "Template launch",
        status: "scheduled",
        audienceType: "b2b",
        channel: "email",
        template_id: "template-1",
        scheduled_at: "2026-07-10T12:00:00.000Z",
      }],
      campaignMetrics: [{
        id: "metric-1",
        campaignExternalId: "campaign-1",
        channel: "email",
        metricDate: "2026-07-09T09:00:00.000Z",
        sent: 10,
        delivered: 9,
        opened: 6,
        clicked: 3,
      }],
      journeys: [{
        id: "journey:journey-1",
        name: "Nurture",
        triggerType: "signup",
        triggerConfig: JSON.stringify({ source: "campaign" }),
        goalType: "activation",
        goalConfig: JSON.stringify({ event: "first_login" }),
        exitOnGoal: false,
      }],
      journey_steps: [{
        id: "journey-step-1",
        journey_id: "journey-1",
        channel: "email",
        contentExternalId: "content-1",
        kind: "message",
        dayOffset: 3,
        templateKind: "email_template",
        templateRef: "onboarding_step_1",
        config: JSON.stringify({
          default_language: "en",
          translations: {
            en: {
              subject: "Your VYVA start",
              headline: "Welcome to VYVA",
              body: "Open the app and complete your first check-in.",
              cta: "Open VYVA",
              ctaUrl: "https://v2.vyva.life/app",
            },
            es: {
              subject: "Tu inicio en VYVA",
              headline: "Bienvenido a VYVA",
              body: "Abre la app y completa tu primer registro.",
              cta: "Abrir VYVA",
              ctaUrl: "https://v2.vyva.life/app",
            },
          },
        }),
      }],
      journeyEnrollments: [{
        id: "enrollment-1",
        journeyExternalId: "journey-1",
        contactExternalId: "contact-1",
        status: "active",
        currentStepOrder: 0,
        enteredAt: "2026-07-08T08:00:00.000Z",
        stepEvents: [{
          id: "event-1",
          stepOrder: 0,
          eventType: "entered",
          channel: "email",
          eventAt: "2026-07-08T08:00:00.000Z",
        }],
      }],
      journey_step_events: [{
        id: "event-2",
        enrollmentExternalId: "enrollment-1",
        stepOrder: 0,
        eventType: "sent",
        channel: "email",
        eventAt: "2026-07-08T09:00:00.000Z",
        eventSource: "automation-log",
      }],
      cursor: "cursor-1",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify(lovablePayload), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app).post("/api/admin/marketing/sync/source/run").expect(200);
    await request(app).post("/api/admin/marketing/sync/source/run").expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("https://source.example.test/marketing-export", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer secret",
      }),
    }));
    expect(table("marketing_content_assets")).toHaveLength(8);
    expect(table("marketing_content_assets").find((row) => row.title === "Welcome email")).toMatchObject({
      html_body: "<h1>Hello</h1>",
      design_json: { blocks: [{ type: "hero" }] },
      media_assets: [{ url: "https://cdn.example.test/hero.png", type: "image" }],
      cta_label: "Start",
      cta_url: "https://v2.vyva.life/start",
      metadata: {
        lovable: expect.objectContaining({
          extraSourceOnlyField: "kept in metadata",
        }),
      },
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Alias-heavy email")).toMatchObject({
      subject: "Alias subject",
      body: "Alias plain copy",
      html_body: "<p>Alias HTML</p>",
      design_json: { sections: [{ kind: "hero" }] },
      media_assets: [{ url: "https://cdn.example.test/alias-cover.png", sourceField: "cover_image_url" }],
      cta_label: "Book now",
      cta_url: "https://v2.vyva.life/book",
    });
    const longDesignContent = table("marketing_content_assets").find((row) => row.title === "Long Source builder page");
    expect(longDesignContent).toMatchObject({
      body: expect.stringContaining("Imported Source body 14"),
      media_assets: expect.arrayContaining([
        expect.objectContaining({ url: "https://cdn.example.test/gallery-13.png" }),
      ]),
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Template welcome")).toMatchObject({
      channel: "email",
      subject: "Template subject",
      body: "Template body",
      html_body: "<p>Template body</p>",
      cta_label: "Read more",
      cta_url: "https://v2.vyva.life/template",
      lovable_external_id: "saved_email_template:template-1",
      metadata: { lovable_source_type: "saved_email_template" },
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Partner post")).toMatchObject({
      channel: "linkedin",
      body: "Partner update copy",
      design_json: { blocks: [{ text: "Partner update copy" }] },
      media_assets: [{ url: "https://cdn.example.test/social.png", sourceField: "image_url" }],
      lovable_external_id: "social_post:post-1",
      metadata: { lovable_source_type: "social_post" },
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Brief idea")).toMatchObject({
      body: "Long-form planning brief",
      design_json: { sections: [{ text: "Long-form planning brief" }] },
      lovable_external_id: "content_brief:brief-1",
      metadata: { lovable_source_type: "content_brief" },
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Bare URL image content")).toMatchObject({
      channel: "instagram",
      body: "Builder exports sometimes put the hero image in a generic url field.",
      cta_url: null,
      media_assets: [{ url: "https://cdn.example.test/bare-url-hero.webp", sourceField: "url" }],
      lovable_external_id: "content:bare-url-image",
    });
    expect(table("marketing_campaign_templates")).toHaveLength(1);
    expect(table("marketing_campaign_templates")[0]).toMatchObject({
      name: "Partner outreach",
      description: "Reusable B2B campaign fields",
      category: "b2b",
      language: "en",
      fields: [{
        name: "headline",
        type: "text",
        required: true,
        placeholder: "A better way to support families",
      }],
      source: "lovable",
      lovable_external_id: "template:structured-1",
      owner_external_id: "lovable-owner-1",
    });
    expect(table("marketing_contact_tags")).toHaveLength(1);
    expect(table("marketing_contact_tags")[0]).toMatchObject({
      name: "Partner",
      color: "#7c3aed",
      source: "lovable",
      lovable_external_id: "contact_tag:partner",
      owner_external_id: "lovable-owner-1",
    });
    const journeyPresetContent = table("marketing_content_assets").find((row) => row.lovable_external_id === "journey_step_preset:onboarding_step_1");
    expect(journeyPresetContent).toMatchObject({
      title: "Welcome to VYVA",
      channel: "email",
      language: "en",
      status: "draft",
      subject: "Your VYVA start",
      body: "Open the app and complete your first check-in.",
      cta_label: "Open VYVA",
      cta_url: "https://v2.vyva.life/app",
      design_json: {
        default_language: "en",
        translations: {
          en: expect.objectContaining({ headline: "Welcome to VYVA" }),
          es: expect.objectContaining({ headline: "Bienvenido a VYVA" }),
        },
      },
      metadata: expect.objectContaining({
        lovable_source_type: "journey_step_preset",
        journey_external_id: "journey:journey-1",
        template_ref: "onboarding_step_1",
      }),
    });
    expect(table("marketing_media_assets")).toHaveLength(18);
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/hero.png")).toMatchObject({
      original_url: "https://cdn.example.test/hero.png",
      asset_type: "image",
      status: "referenced",
    });
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/standalone.png")).toMatchObject({
      content_asset_id: table("marketing_content_assets").find((row) => row.title === "Welcome email")?.id,
      asset_type: "image",
      status: "referenced",
      lovable_external_id: "media:standalone-1",
    });
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/social.png")).toMatchObject({
      asset_type: "unknown",
      status: "referenced",
    });
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/alias-cover.png")).toMatchObject({
      asset_type: "unknown",
      status: "referenced",
    });
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/gallery-13.png")).toMatchObject({
      content_asset_id: longDesignContent?.id,
      asset_type: "image",
      status: "referenced",
    });
    expect(table("marketing_contacts")).toHaveLength(1);
    expect(table("marketing_contacts")[0]).toMatchObject({
      full_name: "Hassan",
      email: "hassan@example.com",
      phone_number: "+34 600 000 001",
      whatsapp_number: "+34 600 000 002",
      language: "en",
      category: "lead",
      vertical: "healthcare",
      market: "Spain",
      tags: ["partner", "List: Shortlist 1 - Home Care"],
      consent_status: "opted_out",
      metadata: {
        lovable_email_unsubscribe_rows: [expect.objectContaining({ reason: "lovable_opt_out" })],
      },
    });
    expect(table("marketing_audiences")).toHaveLength(1);
    expect(table("marketing_audiences")[0]).toMatchObject({
      rules: { market: "Spain" },
    });
    expect(table("marketing_audience_members")).toHaveLength(2);
    expect(table("marketing_audience_members").filter((row) => row.contact_id)).toHaveLength(1);
    expect(table("marketing_campaigns")).toHaveLength(2);
    expect(table("marketing_campaigns").find((row) => row.name === "Welcome campaign")).toMatchObject({
      schedule_starts_at: new Date("2026-07-08T09:00:00.000Z"),
      schedule_ends_at: new Date("2026-07-08T11:00:00.000Z"),
    });
    const templateContent = table("marketing_content_assets").find((row) => row.title === "Template welcome");
    const templateCampaign = table("marketing_campaigns").find((row) => row.name === "Template launch");
    expect(table("marketing_campaign_channels").find((row) => row.campaign_id === templateCampaign?.id)).toMatchObject({
      channel: "email",
      content_asset_id: templateContent?.id,
      scheduled_at: expect.any(Date),
      send_capability: "enabled",
      metadata: expect.objectContaining({
        send_locked: false,
        provider: "communicationDispatcher",
      }),
    });
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("marketing_campaign_recipients").find((row) => row.campaign_id === table("marketing_campaigns").find((campaign) => campaign.name === "Welcome campaign")?.id)).toMatchObject({
      recipient: "hassan@example.com",
      status: "planned",
      snapshot: expect.objectContaining({ consentStatus: "opted_out" }),
    });
    expect(table("marketing_journeys")).toHaveLength(1);
    expect(table("marketing_journeys")[0]).toMatchObject({
      trigger_type: "signup",
      trigger_config: { source: "campaign" },
      goal_type: "activation",
      goal_config: { event: "first_login" },
      exit_on_goal: false,
    });
    expect(table("marketing_campaign_metrics")).toHaveLength(1);
    expect(table("marketing_campaign_metrics")[0]).toMatchObject({
      channel: "email",
      sent: 10,
      delivered: 9,
      opened: 6,
      clicked: 3,
    });
    expect(table("marketing_journey_steps")).toHaveLength(1);
    expect(table("marketing_journey_steps")[0]).toMatchObject({
      kind: "message",
      day_offset: 3,
      template_kind: "email_template",
      template_ref: "onboarding_step_1",
      content_asset_id: journeyPresetContent?.id,
      config: expect.objectContaining({
        default_language: "en",
        translations: expect.objectContaining({
          en: expect.objectContaining({ subject: "Your VYVA start" }),
        }),
      }),
    });
    expect(table("marketing_journey_enrollments")).toHaveLength(1);
    expect(table("marketing_journey_enrollments")[0]).toMatchObject({
      contact_external_id: "contact-1",
      status: "active",
      current_step_order: 0,
    });
    expect(table("marketing_journey_step_events")).toHaveLength(2);
    expect(table("marketing_journey_step_events").find((row) => row.event_type === "entered")).toMatchObject({
      event_type: "entered",
      step_order: 0,
      channel: "email",
    });
    expect(table("marketing_journey_step_events").find((row) => row.event_type === "sent")).toMatchObject({
      event_type: "sent",
      step_order: 0,
      channel: "email",
      metadata: expect.objectContaining({
        enrollment_external_id: "enrollment-1",
      }),
    });
    expect(table("marketing_sync_runs")).toHaveLength(2);

    await request(app)
      .get("/api/admin/marketing/contacts")
      .expect(200)
      .expect((response) => {
        expect(response.body.contacts[0]).toMatchObject({
          fullName: "Hassan",
          email: "hassan@example.com",
          phoneNumber: "+34 600 000 001",
          whatsappNumber: "+34 600 000 002",
          roleLabel: "Partner",
          companyName: "Moka",
          language: "en",
          category: "lead",
          vertical: "healthcare",
          market: "Spain",
          consentStatus: "opted_out",
          lists: expect.arrayContaining(["Partners", "Shortlist 1 - Home Care"]),
          tags: ["partner", "List: Shortlist 1 - Home Care"],
        });
      });

    await request(app)
      .get("/api/admin/marketing/campaigns")
      .expect(200)
      .expect((response) => {
        expect(response.body.campaigns.find((row: { name: string }) => row.name === "Welcome campaign")).toMatchObject({
          scheduleStartsAt: "2026-07-08T09:00:00.000Z",
          scheduleEndsAt: "2026-07-08T11:00:00.000Z",
        });
      });

    await request(app)
      .get("/api/admin/marketing/content")
      .expect(200)
      .expect((response) => {
        expect(response.body.content.find((row: { title: string }) => row.title === "Welcome email")).toMatchObject({
          title: "Welcome email",
          htmlBody: "<h1>Hello</h1>",
          hasHtml: true,
          hasDesign: true,
          mediaAssetCount: 1,
          ctaLabel: "Start",
          ctaUrl: "https://v2.vyva.life/start",
        });
      });

    await request(app)
      .get("/api/admin/marketing/media")
      .expect(200)
      .expect((response) => {
        expect(response.body.mediaAssets.find((row: { originalUrl: string }) => row.originalUrl === "https://cdn.example.test/hero.png")).toMatchObject({
          originalUrl: "https://cdn.example.test/hero.png",
          assetType: "image",
          contentTitle: "Welcome email",
        });
        expect(response.body.mediaAssets.find((row: { originalUrl: string }) => row.originalUrl === "https://cdn.example.test/standalone.png")).toMatchObject({
          originalUrl: "https://cdn.example.test/standalone.png",
          assetType: "image",
          contentTitle: "Welcome email",
        });
      });

    await request(app)
      .get("/api/admin/marketing/analytics")
      .expect(200)
      .expect((response) => {
        expect(response.body.totals).toMatchObject({
          sent: 10,
          delivered: 9,
          opened: 6,
          clicked: 3,
        });
        expect(response.body.metrics[0]).toMatchObject({
          campaignName: "Welcome campaign",
          channel: "email",
        });
      });

    await request(app)
      .get("/api/admin/marketing/journey-enrollments")
      .expect(200)
      .expect((response) => {
        expect(response.body.enrollments[0]).toMatchObject({
          journeyName: "Nurture",
          contactExternalId: "contact-1",
          status: "active",
        });
        expect(response.body.enrollments[0].events).toEqual(expect.arrayContaining([
          expect.objectContaining({ eventType: "sent" }),
          expect.objectContaining({ eventType: "entered" }),
        ]));
      });

    await request(app)
      .get("/api/admin/marketing/audiences")
      .expect(200)
      .expect((response) => {
        expect(response.body.audiences[0]).toMatchObject({
          name: "Partners",
          description: "Partner mailing list",
          memberCount: 2,
          mappedMemberCount: 1,
          unmappedContactExternalIds: ["missing-contact"],
        });
      });

    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      exported: { content: 7, journeyStepPresetContent: 1, mediaAssets: 18, contacts: 1, audiences: 1, campaigns: 2, campaignChannels: 2, campaignRecipients: 2, campaignMetrics: 1, journeys: 1, journeyEnrollments: 1, journeyStepEvents: 2 },
      imported: {
        content: 7,
        journeyStepPresetContent: 1,
        mediaAssets: 18,
        contacts: 1,
        audiences: 1,
        audienceMembers: 2,
        mappedAudienceMembers: 1,
        campaignChannels: 2,
        campaignRecipients: 1,
        campaigns: 2,
        campaignMetrics: 1,
        journeys: 1,
        journeyEnrollments: 1,
        journeyStepEvents: 2,
      },
      contentSourceCounts: {
        journey_step_preset: 1,
      },
      exportMetadata: {
        dataset: "live",
        exportedAt: "2026-07-05T12:00:00.000Z",
        cursor: "cursor-1",
        apiUrl: "https://source.example.test",
        topLevelKeys: expect.arrayContaining(["campaigns", "content", "contacts", "cursor", "dataset", "exportedAt"]),
      },
      unmapped: {
        audienceContactExternalIdCount: 1,
        audienceContactExternalIds: ["missing-contact"],
        campaignRecipientExternalIdCount: 1,
        campaignRecipientExternalIds: ["missing-contact"],
      },
      fieldCoverage: {
        content: expect.objectContaining({
          exportedFieldCount: expect.any(Number),
          firstClassFieldCount: expect.any(Number),
          metadataOnlyFields: expect.arrayContaining(["extraSourceOnlyField"]),
        }),
        media: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["url", "type"]),
        }),
        campaignMetrics: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["sent", "opened", "clicked"]),
        }),
        contacts: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["profile.firstName", "profile.emailAddress", "profile.phoneNumber", "profile.whatsappNumber", "profile.crmScore", "language", "category", "vertical", "market", "lists"]),
          metadataOnlyFields: expect.not.arrayContaining(["profile.crmScore"]),
        }),
        campaigns: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["channels.channel", "channels.contentExternalId"]),
        }),
        journeyEnrollments: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["journeyExternalId", "contactExternalId", "status"]),
        }),
        journeyStepEvents: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["enrollmentExternalId", "eventType", "channel"]),
        }),
      },
      });
  });

  it("creates visible content placeholders for Source campaign references that are not exported", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("SOURCE_MARKETING_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        campaigns: [{
          id: "campaign:missing-content",
          name: "Missing brief campaign",
          status: "draft",
          audienceType: "b2c",
          channels: [{ channel: "email", contentExternalId: "content_brief:missing-brief", status: "draft" }],
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app).post("/api/admin/marketing/sync/source/run").expect(200);

    const placeholder = table("marketing_content_assets").find((row) => row.lovable_external_id === "content_brief:missing-brief");
    expect(placeholder).toMatchObject({
      title: "Missing Source content brief: content_brief:missing-brief",
      channel: "email",
      status: "draft",
      body: expect.stringContaining("Source referenced content_brief:missing-brief"),
      design_json: expect.objectContaining({
        missing_lovable_reference: true,
        external_id: "content_brief:missing-brief",
      }),
      metadata: expect.objectContaining({
        lovable_missing_reference: true,
        lovable_source_type: "missing_lovable_reference",
        referenced_source_type: "content_brief",
        campaign_external_id: "campaign:missing-content",
      }),
    });

    const campaign = table("marketing_campaigns").find((row) => row.name === "Missing brief campaign");
    expect(table("marketing_campaign_channels").find((row) => row.campaign_id === campaign?.id)).toMatchObject({
      channel: "email",
      content_asset_id: placeholder?.id,
    });
    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      imported: {
        campaigns: 1,
        campaignChannels: 1,
        missingContentReferences: 1,
      },
      contentSourceCounts: {
        missing_lovable_reference: 1,
      },
    });
  });

  it("creates visible content placeholders for Source journey step references that are not exported", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("SOURCE_MARKETING_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        journeys: [{
          id: "journey:missing-step-content",
          name: "Missing step content journey",
          status: "draft",
          audienceType: "b2c",
          steps: [{
            id: "journey_step:missing-step",
            stepOrder: 0,
            channel: "email",
            templateRef: "saved_email_template:missing-template",
            status: "draft",
          }],
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app).post("/api/admin/marketing/sync/source/run").expect(200);

    const placeholder = table("marketing_content_assets").find((row) => row.lovable_external_id === "saved_email_template:missing-template");
    expect(placeholder).toMatchObject({
      title: "Missing Source email template: saved_email_template:missing-template",
      channel: "email",
      status: "draft",
      body: expect.stringContaining("Source referenced saved_email_template:missing-template"),
      design_json: expect.objectContaining({
        missing_lovable_reference: true,
        external_id: "saved_email_template:missing-template",
      }),
      metadata: expect.objectContaining({
        lovable_missing_reference: true,
        lovable_source_type: "missing_lovable_reference",
        referenced_source_type: "saved_email_template",
        context: "journey_step",
        journey_external_id: "journey:missing-step-content",
      }),
    });

    const journey = table("marketing_journeys").find((row) => row.name === "Missing step content journey");
    expect(table("marketing_journey_steps").find((row) => row.journey_id === journey?.id)).toMatchObject({
      channel: "email",
      template_ref: "saved_email_template:missing-template",
      content_asset_id: placeholder?.id,
    });
    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      imported: {
        journeys: 1,
        missingContentReferences: 1,
      },
      contentSourceCounts: {
        missing_lovable_reference: 1,
      },
    });
  });

  it("uses imported Source HTML-only email templates as readable/sendable content", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("VYVA_MARKETING_EXPORT_TOKEN", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        saved_email_templates: [{
          id: "template-html-only",
          template_name: "HTML only template",
          email_subject: "HTML only subject",
          html_content: "<h1>Hello &amp; welcome</h1><p>Start your VYVA journey.</p>",
        }],
        contacts: [{
          id: "contact-html-only",
          name: "HTML Contact",
          email: "html-contact@example.com",
          consentStatus: "opted_in",
        }],
        campaigns: [{
          id: "campaign-html-only",
          name: "HTML only campaign",
          status: "scheduled",
          channels: [{ channel: "email", template_id: "template-html-only", status: "scheduled" }],
          recipients: [{ id: "recipient-html-only", contact_id: "contact-html-only", channel: "email", recipient: "html-contact@example.com", status: "planned" }],
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app).post("/api/admin/marketing/sync/source/run").expect(200);

    const content = table("marketing_content_assets").find((row) => row.title === "HTML only template");
    expect(content).toMatchObject({
      body: "Hello & welcome\nStart your VYVA journey.",
      html_body: "<h1>Hello &amp; welcome</h1><p>Start your VYVA journey.</p>",
    });

    const campaign = table("marketing_campaigns").find((row) => row.name === "HTML only campaign");
    await request(app)
      .post(`/api/admin/marketing/campaigns/${campaign?.id}/send-email`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, sentCount: 1, failedCount: 0 });
      });

    expect(table("communications_log")[0]).toMatchObject({
      recipient: "html-contact@example.com",
      purpose: "marketing_campaign_email",
      body: "Hello & welcome\nStart your VYVA journey.",
      metadata: expect.objectContaining({
        subject: "HTML only subject",
        htmlBody: "<h1>Hello &amp; welcome</h1><p>Start your VYVA journey.</p>",
      }),
    });
  });

  it("promotes nested Source content fields into usable content assets", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("SOURCE_MARKETING_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        content: [{
          id: "nested-content-1",
          metadata: {
            template: {
              template_name: "Nested welcome template",
              email_subject: "Nested subject",
              html_content: "<p>Nested HTML</p>",
              button_text: "Start nested",
              button_url: "https://v2.vyva.life/nested",
              email_design: { blocks: [{ text: "Nested design copy" }] },
              cover_image_url: "https://cdn.example.test/nested-cover.png",
            },
          },
        }],
        social_posts: [{
          id: "nested-social-1",
          social_post: {
            headline: "Nested LinkedIn post",
            platform: "linkedin",
            caption: { blocks: [{ text: "Nested social copy" }] },
            image_url: "https://cdn.example.test/nested-social.png",
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app).post("/api/admin/marketing/sync/source/run").expect(200);

    expect(table("marketing_content_assets")).toHaveLength(2);
    expect(table("marketing_content_assets").find((row) => row.title === "Nested welcome template")).toMatchObject({
      channel: "email",
      subject: "Nested subject",
      body: "Nested design copy",
      html_body: "<p>Nested HTML</p>",
      cta_label: "Start nested",
      cta_url: "https://v2.vyva.life/nested",
      design_json: { blocks: [{ text: "Nested design copy" }] },
      media_assets: [{ url: "https://cdn.example.test/nested-cover.png", sourceField: "cover_image_url" }],
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Nested LinkedIn post")).toMatchObject({
      channel: "linkedin",
      body: "Nested social copy",
      design_json: { blocks: [{ text: "Nested social copy" }] },
      media_assets: [{ url: "https://cdn.example.test/nested-social.png", sourceField: "image_url" }],
      lovable_external_id: "social_post:nested-social-1",
    });
    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      fieldCoverage: {
        content: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["metadata", "social_post"]),
          metadataOnlyFields: expect.not.arrayContaining(["metadata", "social_post"]),
        }),
      },
    });
  });

  it("maps Source CRM-style contact aliases and unsubscribe aliases into first-class contact fields", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("SOURCE_MARKETING_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        contacts: [{
          id: "contact-1",
          first_name: "Maria",
          last_name: "Garcia",
          email_address: "maria@example.com",
          mobile_number: "+34 600 000 010",
          whats_app_number: "+34 600 000 011",
          job_title: "Partnership lead",
          organization_name: "Madrid Health",
          preferred_language: "es",
          contactCategory: "partner",
          industry: "healthcare",
          country: "Spain",
          subscription_status: "subscribed",
          tags: "warm, madrid; public",
        }],
        email_unsubscribes: [{
          id: "unsubscribe-1",
          email_address: "maria@example.com",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app)
      .post("/api/admin/marketing/sync/source/run")
      .expect(200);

    expect(table("marketing_contacts")).toHaveLength(1);
    expect(table("marketing_contacts")[0]).toMatchObject({
      full_name: "Maria Garcia",
      email: "maria@example.com",
      phone_number: "+34 600 000 010",
      whatsapp_number: "+34 600 000 011",
      role_label: "Partnership lead",
      company_name: "Madrid Health",
      language: "es",
      category: "partner",
      vertical: "healthcare",
      market: "Spain",
      consent_status: "opted_out",
      tags: ["warm", "madrid", "public"],
    });

    await request(app)
      .get("/api/admin/marketing/contacts")
      .expect(200)
      .expect((response) => {
        expect(response.body.contacts[0]).toMatchObject({
          fullName: "Maria Garcia",
          email: "maria@example.com",
          phoneNumber: "+34 600 000 010",
          whatsappNumber: "+34 600 000 011",
          roleLabel: "Partnership lead",
          companyName: "Madrid Health",
          language: "es",
          consentStatus: "opted_out",
          tags: ["warm", "madrid", "public"],
        });
      });

    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      exported: { contacts: 1 },
      imported: { contacts: 1 },
      fieldCoverage: {
        contacts: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["first_name", "last_name", "email_address", "mobile_number", "organization_name", "preferred_language"]),
        }),
      },
    });
  });

  it("imports Source unsubscribe-only emails and blocks campaign sends to them", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("SOURCE_MARKETING_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        email_unsubscribes: [{
          id: "unsubscribe-only-1",
          email: "suppressed@example.com",
          reason: "manual_opt_out",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app)
      .post("/api/admin/marketing/sync/source/run")
      .expect(200);

    expect(table("marketing_contacts")).toHaveLength(1);
    expect(table("marketing_contacts")[0]).toMatchObject({
      full_name: "suppressed@example.com",
      email: "suppressed@example.com",
      audience_type: "both",
      consent_status: "opted_out",
      tags: ["lovable_unsubscribe"],
      metadata: expect.objectContaining({
        lovable_email_unsubscribe_rows: [expect.objectContaining({ reason: "manual_opt_out" })],
      }),
    });

    const contentResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Suppression test",
        channel: "email",
        subject: "Should not send",
        body: "This should be blocked.",
      })
      .expect(201);

    const campaignResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Suppression campaign",
        status: "scheduled",
        channels: [{ channel: "email", contentAssetId: contentResponse.body.content.id, status: "scheduled" }],
        recipients: [{
          channel: "email",
          recipient: "suppressed@example.com",
          status: "planned",
          snapshot: { consentStatus: "opted_in" },
        }],
      })
      .expect(201);

    await request(app)
      .post(`/api/admin/marketing/campaigns/${campaignResponse.body.campaign.id}/send-email`)
      .expect(400)
      .expect((response) => {
        expect(response.body).toMatchObject({
          error: "No eligible unsent email recipients are available for this campaign.",
          skippedCount: 1,
          skipped: [expect.objectContaining({ recipient: "suppressed@example.com", reason: "opted_out" })],
        });
      });

    expect(table("communications_log")).toHaveLength(0);
    expect(dispatchMock.dispatchCommunicationsByIds).not.toHaveBeenCalled();
  });

  it("merges top-level Source campaign channel and recipient rows into campaigns", async () => {
    vi.stubEnv("SOURCE_MARKETING_API_URL", "https://source.example.test/marketing-export");
    vi.stubEnv("SOURCE_MARKETING_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        saved_email_templates: [{
          id: "template-1",
          template_name: "Separate template",
          email_subject: "Separate subject",
          html_content: "<p>Separate body</p>",
        }],
        contacts: [{
          id: "contact-1",
          name: "Separate Contact",
          email: "separate@example.com",
          audienceType: "b2b",
          consentStatus: "opted_in",
        }],
        campaigns: [{
          id: "campaign-1",
          name: "Separate-row campaign",
          status: "scheduled",
          audienceType: "b2b",
        }],
        campaign_channels: [{
          campaign_id: "campaign-1",
          channel: "email",
          template_id: "template-1",
          scheduled_at: "2026-07-12T10:00:00.000Z",
        }, {
          campaign_id: "campaign-1",
          channel: "linkedin",
          template_id: "template-1",
          scheduled_at: "2026-07-12T10:00:00.000Z",
        }],
        campaign_recipients: [{
          id: "campaign-recipient-1",
          campaign_id: "campaign-1",
          contact_id: "contact-1",
          status: "planned",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    await request(buildApp("karim.assad@mokadigital.net"))
      .post("/api/admin/marketing/sync/source/run")
      .expect(200);

    const campaign = table("marketing_campaigns").find((row) => row.name === "Separate-row campaign");
    const content = table("marketing_content_assets").find((row) => row.title === "Separate template");
    expect(table("marketing_campaign_channels")).toHaveLength(2);
    expect(table("marketing_campaign_channels").find((row) => row.channel === "email")).toMatchObject({
      campaign_id: campaign?.id,
      channel: "email",
      content_asset_id: content?.id,
      scheduled_at: expect.any(Date),
      send_capability: "enabled",
    });
    expect(table("marketing_campaign_channels").find((row) => row.channel === "linkedin")).toMatchObject({
      campaign_id: campaign?.id,
      channel: "linkedin",
      content_asset_id: content?.id,
      scheduled_at: expect.any(Date),
      send_capability: "planning_only",
    });
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("marketing_campaign_recipients")[0]).toMatchObject({
      campaign_id: campaign?.id,
      recipient: "separate@example.com",
      status: "planned",
      snapshot: expect.objectContaining({
        contact_external_id: "contact-1",
        campaign_external_id: "campaign-1",
      }),
    });
    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      exported: { campaigns: 1, campaignChannels: 2, campaignRecipients: 1 },
      imported: { campaigns: 1, campaignChannels: 2, campaignRecipients: 1 },
    });
  });

  it("creates a safe Social Studio package with channel-native drafts", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/social-packages")
      .send({
        brief: "Invite care teams to a practical VYVA introduction.",
        campaignName: "Care team introduction",
        audienceType: "both",
        language: "en",
        tone: "warm",
        channels: ["email", "instagram", "tiktok"],
        ctaLabel: "Open VYVA",
        ctaUrl: "https://v2.vyva.life",
        scheduledAt: "2026-08-31T10:00:00.000Z",
        generateImages: false,
      })
      .expect(201);

    expect(response.body).toMatchObject({ ok: true, source: "fallback", createdChannelCount: 3, generatedImageCount: 0 });
    expect(response.body.content).toHaveLength(3);
    expect(response.body.content.find((item: { channel: string }) => item.channel === "instagram")).toMatchObject({
      channel: "instagram",
      status: "review",
      designJson: { socialStudio: { hashtags: ["#VYVA", "#PracticalSupport", "#EverydaySupport"] } },
    });
    expect(table("marketing_campaigns")[0]).toMatchObject({ source: "social_studio", status: "draft" });
    expect(table("marketing_campaign_channels")).toHaveLength(3);
    expect(table("marketing_campaign_channels").every((row) => row.send_capability === "planning_only" || row.send_capability === "enabled")).toBe(true);
    expect(response.body.readiness.every((item: { state: string }) => item.state === "needs_action")).toBe(true);
    expect(response.body.note).toContain("OPENAI_API_KEY");
  });

  it("starts the Meta OAuth flow only when the Admin deployment is configured", async () => {
    await request(buildApp("ops@example.com"))
      .get("/api/admin/marketing/social-publishing/meta/connect")
      .expect(302)
      .expect("Location", "/admin/marketing/settings?meta_connection=missing_config");

    vi.stubEnv("META_APP_ID", "meta-app-id");
    vi.stubEnv("META_APP_SECRET", "meta-app-secret");
    vi.stubEnv("META_OAUTH_REDIRECT_URI", "https://v2.vyva.life/api/admin/marketing/social-publishing/meta/callback");

    const response = await request(buildApp("ops@example.com"))
      .get("/api/admin/marketing/social-publishing/meta/connect")
      .expect(302);
    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://www.facebook.com");
    expect(location.pathname).toBe("/v24.0/dialog/oauth");
    expect(location.searchParams.get("client_id")).toBe("meta-app-id");
    expect(location.searchParams.get("redirect_uri")).toBe("https://v2.vyva.life/api/admin/marketing/social-publishing/meta/callback");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("scope")).toContain("instagram_content_publish");
  });

  it("reports Meta connection configuration without exposing credentials", async () => {
    vi.stubEnv("META_APP_ID", "meta-app-id");
    vi.stubEnv("META_APP_SECRET", "meta-app-secret");

    const response = await request(buildApp("ops@example.com"))
      .get("/api/admin/marketing/social-publishing/meta/status")
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      provider: "meta",
      configured: true,
      directPublishingEnabled: false,
      connections: [],
    });
    expect(JSON.stringify(response.body)).not.toContain("meta-app-secret");
  });

  it("requires approval before a Social Studio campaign can be scheduled", async () => {
    const createResponse = await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/social-packages")
      .send({
        brief: "Share a practical VYVA update.",
        audienceType: "b2c",
        channels: ["email"],
        generateImages: false,
      })
      .expect(201);

    const contentId = createResponse.body.content[0].id;
    const campaignId = createResponse.body.campaign.id;
    await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/social-packages/${campaignId}/schedule`)
      .send({ scheduledAt: "2026-08-31T12:00:00.000Z" })
      .expect(409)
      .expect((response) => {
        expect(response.body.error).toContain("Approve every selected channel");
      });

    await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/social-packages/content/${contentId}/approve`)
      .expect(200);

    await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/social-packages/${campaignId}/schedule`)
      .send({ scheduledAt: "2026-08-31T12:00:00.000Z" })
      .expect(200)
      .expect((response) => {
        expect(response.body.campaign.status).toBe("scheduled");
        expect(response.body.readiness[0].state).toBe("approved");
      });
  });

  it("regenerates one Social Studio variant and returns it to review", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const createResponse = await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/social-packages")
      .send({ brief: "Share a practical VYVA update.", campaignName: "Practical update", audienceType: "b2c", channels: ["email"], generateImages: false })
      .expect(201);

    const contentId = createResponse.body.content[0].id;
    await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/social-packages/content/${contentId}/approve`)
      .expect(200);

    const response = await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/social-packages/content/${contentId}/regenerate`)
      .send({ direction: "Make the opening especially concise." })
      .expect(200);

    expect(response.body).toMatchObject({ ok: true, source: "fallback", content: { status: "review" } });
    expect(response.body.content.designJson.socialStudio.regenerationCount).toBe(1);
    expect(table("marketing_content_assets")[0].status).toBe("review");
  });

  it("stores generated Social Studio images separately and serves them behind admin auth", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const createResponse = await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/social-packages")
      .send({ brief: "Show one practical way VYVA can support a care conversation.", audienceType: "b2c", channels: ["instagram"], generateImages: false })
      .expect(201);

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const contentId = createResponse.body.content[0].id;
    const imageResponse = await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/content/${contentId}/generate-image`)
      .send({})
      .expect(200);

    expect(openAiMock.imageGenerate).toHaveBeenCalledOnce();
    expect(imageResponse.body.mediaAsset).toMatchObject({ assetType: "generated_image", status: "generated" });
    expect(table("marketing_media_files")).toHaveLength(1);
    expect(table("marketing_media_files")[0].image_bytes).toBeInstanceOf(Buffer);

    await request(buildApp("ops@example.com"))
      .get(`/api/admin/marketing/media/${imageResponse.body.mediaAsset.id}/file`)
      .expect(200)
      .expect("Content-Type", /image\/jpeg/);

    await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/social-packages/media/${imageResponse.body.mediaAsset.id}/approve`)
      .expect(200);
    await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/social-packages/content/${contentId}/approve`)
      .expect(200);
    await request(buildApp("ops@example.com"))
      .post(`/api/admin/marketing/social-packages/${createResponse.body.campaign.id}/schedule`)
      .send({ scheduledAt: "2026-08-31T14:00:00.000Z" })
      .expect(200);
  });
});
