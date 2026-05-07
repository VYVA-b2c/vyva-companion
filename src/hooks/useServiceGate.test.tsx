import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serviceForPath, useServiceGate, type ReadinessResponse, type ServiceReadiness } from "./useServiceGate";

function ready(): ServiceReadiness {
  return { ready: true, missing: [] };
}

function blocked(section: string, path: string, reason = "Add setup first."): ServiceReadiness {
  return { ready: false, missing: [{ section, path, reason }] };
}

function readiness(overrides: Partial<ReadinessResponse["services"]>): ReadinessResponse {
  return {
    profile: {},
    services: {
      medications: ready(),
      adherenceReport: ready(),
      medicationReminders: ready(),
      medicationInteractions: ready(),
      sos: ready(),
      doctor: ready(),
      localServices: ready(),
      specialistFinder: ready(),
      reports: ready(),
      concierge: ready(),
      symptomCheck: ready(),
      caregiverDashboard: ready(),
      socialRooms: ready(),
      activities: ready(),
      brainTraining: ready(),
      chat: ready(),
      ...overrides,
    },
  };
}

function TestButton({ path }: { path: string }) {
  const { guardPath, readiness } = useServiceGate();
  return (
    <>
      <span data-testid="readiness-loaded">{String(!!readiness)}</span>
      <button onClick={() => guardPath(path)}>Go</button>
    </>
  );
}

function LocationSpy() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderGate(path: string, body: ReadinessResponse) {
  vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const res = await fetch(queryKey[0] as string);
          return res.json();
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/"]}>
        <TestButton path={path} />
        <LocationSpy />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("service readiness gates", () => {
  it("maps medication and doctor paths to service gates", () => {
    expect(serviceForPath("/meds")).toBe("medications");
    expect(serviceForPath("/meds/adherence-report")).toBe("adherenceReport");
    expect(serviceForPath("/health/doctor")).toBe("doctor");
    expect(serviceForPath("/chat")).toBe("chat");
    expect(serviceForPath("/health/symptom-check")).toBe("symptomCheck");
    expect(serviceForPath("/concierge")).toBe("concierge");
    expect(serviceForPath("/caregiver")).toBe("caregiverDashboard");
    expect(serviceForPath("/activities")).toBeNull();
  });

  it("redirects medication navigation to setup when medications are missing", async () => {
    renderGate("/meds", readiness({
      medications: blocked("medications", "/onboarding/profile/medications"),
    }));

    await waitFor(() => expect(screen.getByTestId("readiness-loaded")).toHaveTextContent("true"));
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/onboarding/profile/medications?returnTo=%2Fmeds",
      );
    });
  });

  it("allows ungated paths to continue normally", async () => {
    renderGate("/activities", readiness({}));

    await waitFor(() => expect(screen.getByTestId("readiness-loaded")).toHaveTextContent("true"));
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/activities");
  });

  it("redirects subscription-locked services to the plan screen", async () => {
    renderGate("/concierge", readiness({
      concierge: blocked("subscription", "/settings/subscription", "Your current plan does not include concierge."),
    }));

    await waitFor(() => expect(screen.getByTestId("readiness-loaded")).toHaveTextContent("true"));
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/settings/subscription?returnTo=%2Fconcierge",
      );
    });
  });
});
