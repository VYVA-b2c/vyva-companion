import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import SocialStudioPanel from "./SocialStudioPanel";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function content(channel: "email" | "instagram", status = "review") {
  return {
    id: `content-${channel}`,
    title: `VYVA ${channel}`,
    channel,
    language: "en",
    status,
    subject: channel === "email" ? "A practical next step" : null,
    body: "VYVA helps turn everyday conversations into practical support.\n\nOpen VYVA: https://v2.vyva.life",
    ctaLabel: "Open VYVA",
    ctaUrl: "https://v2.vyva.life",
    designJson: { socialStudio: { hook: channel === "instagram" ? "Small steps can make support easier." : null, hashtags: ["#VYVA", "#PracticalSupport"] } },
    mediaAssets: [],
    metadata: { socialStudio: { approvalStatus: status === "approved" ? "approved" : "pending" } },
  };
}

function studioPackage() {
  return {
    ok: true,
    source: "fallback" as const,
    campaign: { id: "campaign-studio", name: "VYVA launch", status: "draft", scheduleStartsAt: null, channels: [] },
    content: [content("email"), content("instagram")],
    mediaAssets: [{ id: "media-instagram", contentAssetId: "content-instagram", localUrl: "https://cdn.example.test/vyva.png", originalUrl: "generated://vyva", assetType: "generated_image", status: "generated", metadata: { socialStudio: { approvalStatus: "pending", altText: "VYVA support visual" } } }],
    readiness: [
      { channel: "email" as const, state: "needs_action" as const, issues: ["Approve the channel copy."] },
      { channel: "instagram" as const, state: "needs_action" as const, issues: ["Approve the channel copy.", "Approve each generated image."] },
    ],
    note: null,
  };
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("SocialStudioPanel", () => {
  it("submits a brief and renders the generated channel package with visual preview", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (url === "/api/admin/marketing/social-packages" && init?.method === "POST") return jsonResponse(studioPackage(), 201);
      return jsonResponse({ error: `Unexpected request: ${url}` }, 500);
    });

    render(<SocialStudioPanel audiences={[{ id: "audience-1", name: "Care teams", memberCount: 12 }]} />);
    fireEvent.change(screen.getByTestId("textarea-social-studio-brief"), { target: { value: "Invite care teams to a practical VYVA introduction." } });
    fireEvent.click(screen.getByTestId("button-social-studio-generate"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/marketing/social-packages", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByTestId("social-studio-channel-email")).toHaveTextContent("A practical next step");
    expect(screen.getByTestId("social-studio-channel-instagram")).toHaveTextContent("#VYVA");
    expect(screen.getByAltText("VYVA support visual")).toHaveAttribute("src", "https://cdn.example.test/vyva.png");
    expect(screen.getByTestId("button-social-studio-schedule")).toBeDisabled();

    const requestBody = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(requestBody).toMatchObject({ brief: "Invite care teams to a practical VYVA introduction.", audienceType: "both", generateImages: true });
    expect(requestBody.channels).toHaveLength(6);
  });

  it("approves copy and schedules a copy-only package after the readiness gate clears", async () => {
    const singleChannelPackage = {
      ...studioPackage(),
      content: [content("email")],
      mediaAssets: [],
      readiness: [{ channel: "email" as const, state: "needs_action" as const, issues: ["Approve the channel copy."] }],
    };
    const approvedContent = content("email", "approved");
    apiFetchMock.mockImplementation(async (url, init) => {
      if (url === "/api/admin/marketing/social-packages") return jsonResponse(singleChannelPackage, 201);
      if (url === "/api/admin/marketing/social-packages/content/content-email/approve") return jsonResponse({ ok: true, content: approvedContent });
      if (url === "/api/admin/marketing/social-packages/campaign-studio/readiness") return jsonResponse({ readiness: [{ channel: "email", state: "approved", issues: [] }] });
      if (url === "/api/admin/marketing/social-packages/campaign-studio/schedule") return jsonResponse({ ok: true, campaign: { ...singleChannelPackage.campaign, status: "scheduled" }, readiness: [{ channel: "email", state: "approved", issues: [] }] });
      return jsonResponse({ error: `Unexpected request: ${url}` }, 500);
    });

    render(<SocialStudioPanel />);
    fireEvent.change(screen.getByTestId("textarea-social-studio-brief"), { target: { value: "Share a practical VYVA update." } });
    fireEvent.click(screen.getByTestId("checkbox-social-studio-whatsapp"));
    fireEvent.click(screen.getByTestId("checkbox-social-studio-facebook"));
    fireEvent.click(screen.getByTestId("checkbox-social-studio-instagram"));
    fireEvent.click(screen.getByTestId("checkbox-social-studio-linkedin"));
    fireEvent.click(screen.getByTestId("checkbox-social-studio-tiktok"));
    fireEvent.click(screen.getByTestId("button-social-studio-generate"));

    const channel = await screen.findByTestId("social-studio-channel-email");
    fireEvent.click(within(channel).getByTestId("button-social-studio-approve-copy-email"));
    await waitFor(() => expect(screen.getByTestId("button-social-studio-schedule")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("button-social-studio-schedule"));

    await waitFor(() => expect(screen.getByTestId("social-studio-feedback")).toHaveTextContent("Campaign scheduled"));
    expect(apiFetchMock.mock.calls.some(([url]) => url === "/api/admin/marketing/social-packages/campaign-studio/schedule")).toBe(true);
  });

  it("supports editing a generated variant and returns it to review", async () => {
    const packageDraft = {
      ...studioPackage(),
      content: [content("email")],
      mediaAssets: [],
      readiness: [{ channel: "email" as const, state: "needs_action" as const, issues: ["Approve the channel copy."] }],
    };
    const editedContent = { ...content("email"), body: "Edited by the marketing team.", status: "review" };
    apiFetchMock.mockImplementation(async (url, init) => {
      if (url === "/api/admin/marketing/social-packages") return jsonResponse(packageDraft, 201);
      if (url === "/api/admin/marketing/content/content-email" && init?.method === "PATCH") return jsonResponse({ ok: true, content: editedContent });
      if (url === "/api/admin/marketing/social-packages/campaign-studio/readiness") return jsonResponse({ readiness: packageDraft.readiness });
      return jsonResponse({ error: `Unexpected request: ${url}` }, 500);
    });

    render(<SocialStudioPanel />);
    fireEvent.change(screen.getByTestId("textarea-social-studio-brief"), { target: { value: "Share a practical VYVA update." } });
    for (const channel of ["whatsapp", "facebook", "instagram", "linkedin", "tiktok"]) fireEvent.click(screen.getByTestId(`checkbox-social-studio-${channel}`));
    fireEvent.click(screen.getByTestId("button-social-studio-generate"));

    const channel = await screen.findByTestId("social-studio-channel-email");
    fireEvent.click(within(channel).getByTestId("button-social-studio-edit-email"));
    fireEvent.change(within(channel).getByLabelText("Email copy"), { target: { value: "Edited by the marketing team." } });
    fireEvent.click(within(channel).getByTestId("button-social-studio-save-email"));

    await waitFor(() => expect(screen.getByTestId("social-studio-channel-email")).toHaveTextContent("Edited by the marketing team."));
    expect(apiFetchMock.mock.calls.some(([url, init]) => url === "/api/admin/marketing/content/content-email" && init?.method === "PATCH")).toBe(true);
  });
});
