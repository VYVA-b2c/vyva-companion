import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { setLanguage } from "@/i18n";
import AttentionBoostersPage from "./AttentionBoostersPage";

describe("AttentionBoostersPage", () => {
  beforeEach(() => {
    setLanguage("en");
  });

  it("opens Listen Closely from the Focus & React hub", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/attention-boosters"]}>
        <Routes>
          <Route path="/attention-boosters" element={<AttentionBoostersPage />} />
          <Route path="/brain-coach/activity/listen_closely" element={<h1>Listen Closely game</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("attention-boosters-flow-shell")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("attention-boosters-flow-shell")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.train_reflexes");
    expect(screen.getByTestId("button-brain-coach-category-voice")).toBeInTheDocument();
    const listenCloselyButton = screen.getByRole("button", { name: /Listen Closely/i });
    expect(listenCloselyButton.querySelector('[data-vyva-accent="signal"]')).toBeInTheDocument();
    expect(screen.queryByText("Attention, rhythm, and response.")).not.toBeInTheDocument();
    expect(screen.queryByText("Listen for gentle sounds and build calm focus.")).not.toBeInTheDocument();

    fireEvent.click(listenCloselyButton);

    expect(screen.getByRole("heading", { name: "Listen Closely game" })).toBeInTheDocument();
  });
});
