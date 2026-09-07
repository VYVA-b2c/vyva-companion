import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNumberMemoryLevels, getNumberMemoryExpectedAnswer, type NumberMemoryPayload } from "./numberMemoryData";
import NumberMemoryGame from "./NumberMemoryGame";
import { saveGameResult } from "./gameStorage";
import { requestNumberMemoryVoiceTool } from "@/lib/numberMemoryVoiceBridge";

vi.mock("./gameStorage", () => ({ saveGameResult: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/hooks/useHomeMasterTheme", () => ({ useHomeMasterTheme: () => ({ isDark: false }) }));

const level = buildNumberMemoryLevels()[0];
const variant = level.variants[0];
const content = variant.content.en!;
const payload = content.payload as unknown as NumberMemoryPayload;

function renderGame(onVoiceContextChange = vi.fn(), voiceConnected = false) {
  return render(
    <NumberMemoryGame
      plan={{ gameType: "number_memory", level: 1, variantId: variant.id, reasonLabel: "" }}
      localizedVariant={content}
      cognitiveDomain="working_memory"
      userId="user-1"
      language="en"
      onBack={vi.fn()}
      onOpenSameGame={vi.fn()}
      actionLoading={null}
      voiceConnected={voiceConnected}
      onVoiceContextChange={onVoiceContextChange}
    />,
  );
}

async function showWholeRound(roundIndex: number) {
  if (roundIndex === 1) expect(screen.getByRole("heading", { name: "You’re underway — keep going" })).toBeInTheDocument();
  if (roundIndex === 2) expect(screen.getByRole("heading", { name: "Final round — you’ve got this" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: roundIndex === 0 ? "Let’s start" : `Start round ${roundIndex + 1}` }));
  act(() => { vi.advanceTimersByTime(700); });
  for (let index = 0; index < payload.rounds[roundIndex].digits.length; index += 1) {
    act(() => { vi.advanceTimersByTime(payload.rounds[roundIndex].presentationMsPerDigit); });
  }
  expect(screen.getByRole("heading", { name: "Enter your answer" })).toBeInTheDocument();
}

describe("NumberMemoryGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(saveGameResult).mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows first-use guidance, then presents one digit at a time", () => {
    renderGame();
    expect(screen.getByRole("heading", { name: "Remember in the same order" })).toBeInTheDocument();
    expect(screen.queryByText(/Example:/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Round 1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Let’s start" }));
    expect(screen.getByText("Ready")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.getByText(payload.rounds[0].digits[0])).toBeInTheDocument();
    expect(screen.queryByText(payload.rounds[0].digits)).not.toBeInTheDocument();
  });

  it("cancels an interrupted presentation without scoring it", () => {
    window.localStorage.setItem("numberMemory:guidance:v2:user-1:forward", "true");
    renderGame();
    fireEvent.click(screen.getByRole("button", { name: "Let’s start" }));
    act(() => { vi.advanceTimersByTime(700); });
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("button", { name: "Let’s start" })).toBeInTheDocument();
    expect(saveGameResult).not.toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("supports three rounds, keyboard recall, deferred review, and safe metadata", async () => {
    window.localStorage.setItem("numberMemory:guidance:v2:user-1:forward", "true");
    const voice = vi.fn();
    renderGame(voice);

    for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
      await showWholeRound(roundIndex);
      const expected = getNumberMemoryExpectedAnswer(payload.rounds[roundIndex]);
      expected.split("").forEach((digit) => fireEvent.keyDown(window, { key: digit }));
      fireEvent.keyDown(window, { key: "Enter" });
      if (roundIndex < 2) expect(screen.getByRole("button", { name: `Start round ${roundIndex + 2}` })).toBeInTheDocument();
    }

    expect(screen.getByText("3/3 exact rounds")).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(saveGameResult).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(saveGameResult).mock.calls[0][0];
    expect(saved).toMatchObject({ score: 100, accuracy: 100, mistakes: 0 });
    expect(saved.metadata).toMatchObject({ roundVersion: "number_memory_v2", roundCount: 3, exactRoundCount: 3, levelPassed: true });
    expect(JSON.stringify(saved.metadata)).not.toContain(payload.rounds[0].digits);
    expect(voice).toHaveBeenCalledWith(expect.objectContaining({ activity: "number_memory", level: 1 }));
  });

  it("explains the 80 percent requirement when the next level remains locked", async () => {
    window.localStorage.setItem("numberMemory:guidance:v2:user-1:forward", "true");
    const onOpenSameGame = vi.fn();
    render(
      <NumberMemoryGame
        plan={{ gameType: "number_memory", level: 1, variantId: variant.id, reasonLabel: "" }}
        localizedVariant={content}
        cognitiveDomain="working_memory"
        userId="user-1"
        language="en"
        onBack={vi.fn()}
        onOpenSameGame={onOpenSameGame}
        actionLoading={null}
      />,
    );

    for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
      await showWholeRound(roundIndex);
      fireEvent.click(screen.getByRole("button", { name: "I’m not sure" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "See results" }));

    expect(screen.getByText("Reach 80% to unlock the next level")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next level 2" })).not.toBeInTheDocument();
    expect(onOpenSameGame).not.toHaveBeenCalled();
  });

  it("lets the agent release one paced digit at a time and submit a spoken answer", async () => {
    window.localStorage.setItem("numberMemory:guidance:v2:user-1:forward", "true");
    renderGame(vi.fn(), true);

    let result;
    await act(async () => { result = await requestNumberMemoryVoiceTool("start_number_memory_round", { round: 1 }); });
    expect(result).toMatchObject({ ok: true, code: "round_started", phase: "presentation" });

    await act(async () => { result = await requestNumberMemoryVoiceTool("get_next_number_memory_digit", { round: 1, expected_index: 0 }); });
    expect(result).toMatchObject({ ok: true, digit: payload.rounds[0].digits[0], digit_index: 0 });
    expect(screen.getByText(payload.rounds[0].digits[0])).toBeInTheDocument();

    await act(async () => { result = await requestNumberMemoryVoiceTool("get_next_number_memory_digit", { round: 1, expected_index: 1 }); });
    expect(result).toMatchObject({ ok: false, code: "digit_not_ready" });

    for (let index = 1; index < payload.rounds[0].digits.length; index += 1) {
      act(() => { vi.advanceTimersByTime(payload.rounds[0].presentationMsPerDigit); });
      await act(async () => { result = await requestNumberMemoryVoiceTool("get_next_number_memory_digit", { round: 1, expected_index: index }); });
      expect(result).toMatchObject({ ok: true, digit: payload.rounds[0].digits[index], digit_index: index });
    }

    await act(async () => { result = await requestNumberMemoryVoiceTool("begin_number_memory_recall", { round: 1 }); });
    expect(result).toMatchObject({ ok: true, phase: "recall" });
    expect(screen.getByRole("heading", { name: "Enter your answer" })).toBeInTheDocument();

    await act(async () => { result = await requestNumberMemoryVoiceTool("submit_number_memory_answer", { round: 1, digits: getNumberMemoryExpectedAnswer(payload.rounds[0]).split("").join(" ") }); });
    expect(result).toMatchObject({ ok: true, code: "answer_submitted", next_round: 2 });
    expect(screen.getByRole("button", { name: "Start round 2" })).toBeInTheDocument();
  });

  it("rejects stale and ambiguous voice calls without changing the round", async () => {
    window.localStorage.setItem("numberMemory:guidance:v2:user-1:forward", "true");
    renderGame(vi.fn(), true);

    let result;
    await act(async () => { result = await requestNumberMemoryVoiceTool("submit_number_memory_answer", { round: 1, digits: "one two three" }); });
    expect(result).toMatchObject({ ok: false, code: "out_of_order" });
    await act(async () => { result = await requestNumberMemoryVoiceTool("start_number_memory_round", { round: 2 }); });
    expect(result).toMatchObject({ ok: false, code: "stale_round" });
    expect(screen.getByRole("button", { name: "Let’s start" })).toBeInTheDocument();
  });
});
