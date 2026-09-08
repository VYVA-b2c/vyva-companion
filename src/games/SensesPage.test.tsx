import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "@/i18n";
import SensesPage from "./SensesPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

describe("SensesPage", () => {
  beforeEach(() => {
    setLanguage("en");
  });

  it("shows only the Calm & Notice activities", () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/senses"]}>
        <Routes>
          <Route path="/senses" element={<SensesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("senses-flow-shell")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("senses-flow-shell")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.sharpen_senses");
    expect(screen.getByTestId("button-brain-coach-category-voice")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Listen Closely/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Association/i })).not.toBeInTheDocument();
    expect(container.querySelector(".xl\\:grid-cols-4")).not.toBeInTheDocument();
    expect(screen.queryByText("Listen, breathe, notice, and recall sensory details.")).not.toBeInTheDocument();
    expect(screen.queryByText("Use calm breathing to bring a garden to life.")).not.toBeInTheDocument();
  });

  it("opens Scent Memory from the Sharpen Senses hub", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/senses"]}>
        <Routes>
          <Route path="/senses" element={<SensesPage />} />
          <Route path="/brain-coach/activity/scent_memory" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Scent Memory/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/brain-coach/activity/scent_memory");
  });

  it("opens Breath Garden from the Sharpen Senses hub", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/senses"]}>
        <Routes>
          <Route path="/senses" element={<SensesPage />} />
          <Route path="/brain-coach/activity/breath_garden" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Breath Garden/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/brain-coach/activity/breath_garden");
  });
});
