import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import ScentMemory, { getDefaultScentMemoryUserState } from "./ScentMemory";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/games/memory/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isSupported: false,
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

function contentResponse() {
  return new Response(JSON.stringify({
    state: getDefaultScentMemoryUserState("user-1"),
    prompt: {
      id: "11111111-1111-4111-8111-111111111111",
      scent_name: "fresh bread",
      scent_description: "Imagine the warm smell from an oven just opened.",
      guiding_question: "Does it bring back a place or moment?",
      category: "food",
      language: "en",
      is_active: true,
    },
  }), { status: 200 });
}

function alternateContentResponse() {
  return new Response(JSON.stringify({
    state: getDefaultScentMemoryUserState("user-1"),
    prompt: {
      id: "22222222-2222-4222-8222-222222222222",
      scent_name: "earth after rain",
      scent_description: "Imagine the fresh scent of the ground after rain.",
      guiding_question: "Does it bring back a garden or a walk?",
      category: "nature",
      language: "en",
      is_active: true,
    },
  }), { status: 200 });
}

function saveResponse() {
  return new Response(JSON.stringify({
    session: { id: "session-1" },
    state: {
      ...getDefaultScentMemoryUserState("user-1"),
      total_sessions: 1,
      streak_days: 1,
    },
  }), { status: 201 });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ScentMemory component", () => {
  beforeEach(() => {
    setLanguage("en");
    vi.useFakeTimers();
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValueOnce(contentResponse());
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("shows the tutorial once and reopens it from Guidance", async () => {
    render(<ScentMemory userId="user-1" onExit={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("Look. Remember. Share if you want.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(window.localStorage.getItem("scentMemory:tutorialSeen:v1:user-1")).toBe("true");
    expect(screen.getByText("fresh bread")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guidance" }));

    expect(screen.getByText("Look. Remember. Share if you want.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("fresh bread")).toBeInTheDocument();
  });

  it("loads a reviewed scent prompt and reveals the question after a short pause", async () => {
    window.localStorage.setItem("scentMemory:tutorialSeen:v1:user-1", "true");
    render(<ScentMemory userId="user-1" onExit={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("fresh bread")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "fresh bread visual cue" })).toBeInTheDocument();
    expect(screen.getByText("Warm from the oven.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tell me what you remember...")).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByPlaceholderText("Tell me what you remember...")).not.toBeDisabled();
  });

  it("saves a completed response and shows a warm close state", async () => {
    window.localStorage.setItem("scentMemory:tutorialSeen:v1:user-1", "true");
    apiFetchMock.mockResolvedValueOnce(saveResponse());

    render(<ScentMemory userId="user-1" onExit={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("fresh bread")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    fireEvent.change(screen.getByPlaceholderText("Tell me what you remember..."), {
      target: { value: "It reminds me of Saturday mornings." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save memory" }));
    await flushPromises();

    expect(screen.getByRole("heading", { name: "Thanks for sharing that." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do another" })).toBeInTheDocument();
    expect(screen.queryByText("Milestone")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play again" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await flushPromises();
    expect(apiFetchMock).toHaveBeenLastCalledWith("/api/games/scent-memory/sessions", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("It reminds me of Saturday mornings."),
    }));
  });

  it("allows skip without blocking completion", async () => {
    window.localStorage.setItem("scentMemory:tutorialSeen:v1:user-1", "true");
    apiFetchMock.mockResolvedValueOnce(saveResponse());

    render(<ScentMemory userId="user-1" onExit={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("fresh bread")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await flushPromises();

    expect(screen.getByRole("heading", { name: "Thanks for sharing that." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await flushPromises();
    const sessionCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/games/scent-memory/sessions");
    expect(JSON.parse(String(sessionCall?.[1]?.body))).toMatchObject({
      responseText: null,
      completed: true,
      abandoned: false,
    });
  });

  it("saves another memory inside the current session before loading a new prompt", async () => {
    window.localStorage.setItem("scentMemory:tutorialSeen:v1:user-1", "true");
    apiFetchMock
      .mockResolvedValueOnce(saveResponse())
      .mockResolvedValueOnce(alternateContentResponse());

    render(<ScentMemory userId="user-1" onExit={vi.fn()} />);
    await flushPromises();
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    fireEvent.change(screen.getByPlaceholderText("Tell me what you remember..."), {
      target: { value: "It reminds me of home." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save memory" }));
    fireEvent.click(screen.getByRole("button", { name: "Do another" }));
    await flushPromises();

    const sessionCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/games/scent-memory/sessions");
    expect(JSON.parse(String(sessionCall?.[1]?.body))).toMatchObject({
      responseText: "It reminds me of home.",
      completed: false,
      abandoned: false,
    });
    expect(screen.getByText("earth after rain")).toBeInTheDocument();
    expect(screen.getByText("Place memory")).toBeInTheDocument();
    expect(screen.getByText("Does it bring back a garden or a walk?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tell me what you remember...")).toHaveValue("");
    expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("excludePromptId=11111111-1111-4111-8111-111111111111"));
    expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("excludeCategory=food"));
  });

  it("rotates to a different fallback memory in the local preview", async () => {
    window.localStorage.setItem("scentMemory:tutorialSeen:v1", "true");
    render(<ScentMemory userId="" onExit={vi.fn()} />);
    await flushPromises();

    expect(screen.getByText("fresh bread")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    fireEvent.click(screen.getByRole("button", { name: "Do another" }));
    await flushPromises();

    expect(screen.getByText("earth after rain")).toBeInTheDocument();
    expect(screen.queryByText("fresh bread")).not.toBeInTheDocument();
  });
});
