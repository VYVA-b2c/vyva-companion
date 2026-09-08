import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VitalsTracker, { vitalsSafetyActionKindsFor } from "./VitalsTracker";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

function latestResponse(recommendedAction: string, acknowledgedAt?: string) {
  return new Response(JSON.stringify({
    analysis: {
      id: "analysis-1",
      analysed_at: "2026-06-01T10:00:00.000Z",
      recommended_action: recommendedAction,
      risk_score: recommendedAction === "urgent_help" ? 86 : 62,
      senior_message: recommendedAction === "urgent_help"
        ? "Your readings need urgent support."
        : "Please speak with your doctor about this reading.",
      acknowledged_at: acknowledgedAt ?? null,
    },
    recent_readings: [
      {
        signal_type: "resting_hr_bpm",
        value: 112,
        recorded_at: "2026-06-01T10:00:00.000Z",
        source: "manual",
        deviation_pct: 28,
        context_tag: "general",
      },
    ],
    latest_alert: null,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function acknowledgeResponse() {
  return new Response(JSON.stringify({
    id: "analysis-1",
    acknowledged_at: "2026-06-01T10:05:00.000Z",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function setupApi(recommendedAction: string, acknowledgedAt?: string) {
  apiFetchMock.mockImplementation(async (url) => {
    if (String(url).includes("/api/vitals-engine/acknowledge")) return acknowledgeResponse();
    return latestResponse(recommendedAction, acknowledgedAt);
  });
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <pre data-testid="route-state">{JSON.stringify(location.state)}</pre>
    </>
  );
}

function renderTracker(
  recommendedAction: string,
  props: Partial<ComponentProps<typeof VitalsTracker>> = {},
  acknowledgedAt?: string,
) {
  setupApi(recommendedAction, acknowledgedAt);
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/health/vitals"]}>
      <Routes>
        <Route
          path="/health/vitals"
          element={(
            <VitalsTracker
              userId="user-1"
              userConditions={[]}
              language="en"
              {...props}
            />
          )}
        />
        <Route path="/health/doctor" element={<LocationProbe />} />
        <Route path="/onboarding/profile/gp" element={<LocationProbe />} />
        <Route path="/concierge" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Vitals safety service actions", () => {
  afterEach(() => {
    apiFetchMock.mockReset();
  });

  it("maps doctor safety advice to direct GP contact and doctor help", () => {
    expect(vitalsSafetyActionKindsFor("contact_doctor", {
      hasGpPhone: true,
      hasGpEmail: true,
    })).toEqual(["call_gp", "email_gp", "doctor_help", "schedule_appointment", "book_ride"]);
  });

  it("renders call and email actions for doctor safety advice", async () => {
    renderTracker("contact_doctor", {
      gpName: "Dr. Garcia",
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    });

    await screen.findByTestId("daily-safety-check");

    expect(screen.getByTestId("button-safety-call-gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-safety-call-gp")).toHaveTextContent("Call Dr. Garcia");
    expect(screen.getByTestId("button-safety-email-gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-safety-doctor-help")).toBeInTheDocument();
    expect(screen.getByTestId("button-safety-schedule-appointment")).toHaveTextContent("Book appointment");
    expect(screen.getByTestId("button-safety-book-ride")).toHaveTextContent("Find specialised transport");
  });

  it("does not keep an acknowledged safety notice in the main Vitals flow", async () => {
    renderTracker("contact_doctor", {}, "2026-06-01T10:05:00.000Z");

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/vitals-engine/latest"));
    expect(screen.queryByTestId("daily-safety-check")).not.toBeInTheDocument();
  });

  it("offers doctor setup when GP contact is missing", async () => {
    renderTracker("contact_doctor");

    await screen.findByTestId("daily-safety-check");
    fireEvent.click(screen.getByTestId("button-safety-add-doctor"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/onboarding/profile/gp"));
  });

  it("turns urgent vitals advice into an emergency call action", async () => {
    renderTracker("urgent_help", { country: "US" });

    await screen.findByTestId("daily-safety-check");

    expect(screen.getByTestId("button-safety-call-emergency")).toHaveAttribute("href", "tel:911");
    expect(screen.getByTestId("button-safety-call-emergency")).toHaveTextContent("Call 911");
    expect(screen.getByTestId("button-safety-book-ride")).toBeInTheDocument();
  });

  it("uses the doctor voice route with vitals context", async () => {
    renderTracker("contact_doctor");

    await screen.findByTestId("daily-safety-check");
    fireEvent.click(screen.getByTestId("button-safety-doctor-help"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/health/doctor"));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/vitals-engine/acknowledge", expect.objectContaining({
      method: "POST",
    }));
  });

  it("opens appointment booking with vitals context", async () => {
    renderTracker("contact_doctor");

    await screen.findByTestId("daily-safety-check");
    fireEvent.click(screen.getByTestId("button-safety-schedule-appointment"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"vitals_safety\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Please help me schedule a doctor appointment");
    expect(screen.getByTestId("route-state")).toHaveTextContent("VYVA vitals summary");
  });

  it("opens ride booking with urgent vitals context", async () => {
    renderTracker("urgent_help", { country: "US" });

    await screen.findByTestId("daily-safety-check");
    fireEvent.click(screen.getByTestId("button-safety-book-ride"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"ride\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"vitals_safety\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Please help me find safe transport options");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Your readings need urgent support");
  });
});
