import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailView, InformesMain } from "./InformesScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallbackOrValues?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
        const fallback = typeof fallbackOrValues === "string" ? fallbackOrValues : _key;
        const interpolation = typeof fallbackOrValues === "object" ? fallbackOrValues : values;
        return fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(interpolation?.[key] ?? `{{${key}}}`));
      },
    }),
  };
});

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state ?? {})}</span>
    </>
  );
}

const report = {
  id: "report-1",
  chief_complaint: "Chest discomfort",
  symptoms: ["pressure"],
  urgency: "routine" as const,
  recommendations: ["Contact your doctor today"],
  disclaimer: "This is not emergency medical care.",
  ai_summary: null,
  next_step_label: "Talk to a doctor today",
  next_step_level: "doctor_today" as const,
  triage_reasons: ["Chest pressure can need a same-day check."],
  watch_signs: [],
  profile_considerations: [],
  vitals_notes: [],
  scan_notes: [],
  bpm: null,
  respiratory_rate: null,
  duration_seconds: null,
  created_at: "2026-06-01T09:00:00.000Z",
};

function renderDetail(profile: unknown, reportOverride: Partial<typeof report> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async () => profile,
      },
    },
  });
  queryClient.setQueryData(["/api/profile"], profile);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/informes/report-1"]}>
        <LocationProbe />
        <DetailView report={{ ...report, ...reportOverride }} onBack={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderMain(profile: unknown, summaryOverride: Partial<{
  latestTriage: typeof report | null;
  latestVitals: unknown;
  todayMeds: { taken: number; total: number; adherencePct: number | null };
}> = {}, brainCoachProgress: unknown = null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async () => null,
      },
    },
  });
  queryClient.setQueryData(["/api/profile"], profile);
  queryClient.setQueryData(["/api/reports/vitals/history"], { readings: [] });
  queryClient.setQueryData(["/api/reports/summary"], {
    latestTriage: {
      ...report,
      recommendations: [
        "Contact your doctor today",
        "Consider visiting an urgent care center",
      ],
    },
    latestVitals: null,
    todayMeds: { taken: 0, total: 0, adherencePct: null },
    ...summaryOverride,
  });
  queryClient.setQueryData(["/api/games/progress"], brainCoachProgress);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/informes"]}>
        <LocationProbe />
        <InformesMain />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Informes report detail actions", () => {
  it("offers a back button to the health screen", async () => {
    renderMain(null);

    fireEvent.click(await screen.findByRole("button", { name: "informes.back" }));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/health");
  });

  it("surfaces fast service actions on the reports overview latest report", async () => {
    renderMain({
      country: "ES",
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    });

    expect(await screen.findByTestId("latest-report-service-actions")).toHaveTextContent("Fast service access");
    expect(screen.getByTestId("button-latest-report-service-call_gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-latest-report-service-email_gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-latest-report-service-doctor_help")).toBeInTheDocument();
    expect(screen.getByTestId("button-latest-report-service-book_ride")).toBeInTheDocument();
    expect(screen.getByTestId("button-latest-report-service-schedule_appointment")).toBeInTheDocument();
  });

  it("uses a wider responsive layout on the reports overview", async () => {
    renderMain({});

    expect(await screen.findByTestId("reports-overview-shell")).toHaveClass("max-w-[1180px]");
    expect(screen.getByTestId("reports-latest-grid")).toHaveClass("lg:grid-cols-2", "xl:grid-cols-3");
    expect(screen.getByTestId("reports-trends-grid")).toHaveClass("lg:grid-cols-2");
  });

  it("links Brain Coach progress into the reports overview", async () => {
    renderMain({}, {}, {
      summary: {
        totalSessions: 4,
        completedSessions: 3,
        streakDays: 2,
        bestStreakDays: 2,
        lastPlayedAt: "2026-06-02T09:00:00.000Z",
        totalDurationSeconds: 420,
      },
      today: {
        completedCount: 1,
        activityTypes: ["word_recall"],
        domains: ["memory"],
      },
      domains: [
        {
          domain: "memory",
          totalSessions: 3,
          completedSessions: 3,
          bestScore: 800,
          totalDurationSeconds: 420,
          lastPlayedAt: "2026-06-02T09:00:00.000Z",
        },
      ],
      activities: [],
      history: [],
    });

    const card = await screen.findByTestId("card-brain-coach-report");
    expect(card).toHaveTextContent("Brain Coach report");
    expect(card).toHaveTextContent("3");
    expect(card).toHaveTextContent("Memory");

    fireEvent.click(screen.getByTestId("button-open-brain-coach-report"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/informes/brain-coach"));
  });

  it("opens concierge from the reports overview with saved report context", async () => {
    renderMain({
      country: "ES",
      gpPhone: "+34 612 345 678",
    });

    fireEvent.click(await screen.findByTestId("button-latest-report-service-schedule_appointment"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Chest discomfort");
  });

  it("keeps the latest report card open action separate from service buttons", async () => {
    renderMain({
      gpPhone: "+34 612 345 678",
    });

    fireEvent.click(await screen.findByTestId("button-open-latest-symptom-report"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/informes/report-1"));
  });

  it("adds service actions to abnormal vitals on the reports overview", async () => {
    renderMain(
      {
        gpName: "Dr Garcia",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
      {
        latestVitals: {
          id: "vitals-1",
          bpm: 112,
          respiratory_rate: 28,
          recorded_at: "2026-06-01T10:00:00.000Z",
        },
      },
    );

    expect(await screen.findByTestId("reports-vitals-service-actions")).toHaveTextContent("Fast service access");
    expect(screen.getByTestId("button-reports-vitals-review")).toBeInTheDocument();
    expect(screen.getByTestId("button-reports-vitals-call-gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-reports-vitals-call-gp")).toHaveTextContent("Call Dr Garcia");
    expect(screen.getByTestId("button-reports-vitals-email-gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-reports-vitals-email-gp")).toHaveAttribute("href", expect.stringContaining("112%20bpm"));
    expect(screen.getByTestId("button-reports-vitals-doctor")).toBeInTheDocument();
    expect(screen.getByTestId("button-reports-vitals-ride")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-reports-vitals-appointment"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("112 bpm");
    expect(screen.getByTestId("route-state")).toHaveTextContent("28/min");
  });

  it("keeps normal vitals focused on reviewing readings", async () => {
    renderMain(
      {},
      {
        latestVitals: {
          id: "vitals-1",
          bpm: 72,
          respiratory_rate: 16,
          recorded_at: "2026-06-01T10:00:00.000Z",
        },
      },
    );

    fireEvent.click(await screen.findByTestId("button-reports-vitals-review"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/health/vitals"));
    expect(screen.queryByTestId("button-reports-vitals-doctor")).not.toBeInTheDocument();
  });

  it("adds pharmacy and clinician actions when medication is still pending", async () => {
    renderMain(
      {
        gpName: "Dr Garcia",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
      {
        todayMeds: { taken: 1, total: 3, adherencePct: 33 },
      },
    );

    expect(await screen.findByTestId("reports-meds-service-actions")).toHaveTextContent("Fast service access");
    expect(screen.getByTestId("button-reports-meds-review")).toBeInTheDocument();
    expect(screen.getByTestId("button-reports-meds-call-gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-reports-meds-call-gp")).toHaveTextContent("Call Dr Garcia");
    expect(screen.getByTestId("button-reports-meds-email-gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-reports-meds-email-gp")).toHaveAttribute("href", expect.stringContaining("1%20of%203"));
    expect(screen.getByTestId("button-reports-meds-doctor")).toBeInTheDocument();
    expect(screen.getByTestId("button-reports-meds-appointment")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-reports-meds-refill"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/meds/refills"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("{}");
  });

  it("renders direct GP call and email actions for saved recommendations", async () => {
    renderDetail({
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    });

    const call = await screen.findByTestId("button-report-call-gp");
    const email = await screen.findByTestId("button-report-support-email_gp");

    expect(call).toHaveTextContent("Call GP");
    expect(email).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-report-support-doctor_help")).toBeInTheDocument();
    expect(screen.getByTestId("prototype-symptom-assessment-screen")).toHaveAttribute("data-container-contract", "flow.rounded-card");
    expect(screen.getByTestId("symptom-check-shell")).toHaveAttribute("data-stage-id", "save_share_summary");
    expect(screen.getByTestId("card-report-answer")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Your summary" })).toHaveLength(1);
    expect(screen.queryByTestId("symptom-presentation-save_share_summary-touch")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-symptom-mode-voice")).toBeInTheDocument();
  });

  it("keeps the canonical primary GP action when saved recommendations are empty", async () => {
    renderDetail(
      {
        country: "ES",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
      {
        recommendations: [],
        triage_reasons: [],
        next_step_label: "Talk to a doctor today",
      },
    );

    expect(await screen.findByTestId("button-report-call-gp")).toHaveTextContent("Call GP");
    expect(screen.getByTestId("card-report-do-now")).toHaveTextContent("Talk to a doctor today");
    expect(screen.queryByTestId("report-support-actions")).not.toBeInTheDocument();
  });

  it("renders an emergency call action from a saved emergency next step", async () => {
    renderDetail(
      { country: "ES" },
      {
        urgency: "urgent",
        recommendations: [],
        triage_reasons: [],
        next_step_label: "Call emergency services now",
        next_step_level: "emergency",
      },
    );

    const emergencyCall = await screen.findByTestId("button-report-emergency");

    expect(emergencyCall).toHaveTextContent("Call 112");
    expect(screen.getByTestId("card-report-emergency")).toHaveTextContent("Call 112 now");
  });

  it("opens doctor support directly when no GP contact exists", async () => {
    renderDetail({});

    expect(await screen.findByTestId("button-report-doctor")).toHaveTextContent("Talk to doctor");
    fireEvent.click(screen.getByTestId("button-report-doctor"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/health/doctor");
    });
  });
});
