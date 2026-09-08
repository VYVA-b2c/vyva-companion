import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/i18n";
import { saveGameResult } from "./gameStorage";
import StoryRecallGame from "./StoryRecallGame";

const mocks = vi.hoisted(() => ({
  scoreRetell: vi.fn(),
  speak: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}));

vi.mock("@/games/shared/useAIScoring", () => ({
  useAIScoring: () => ({
    scoreRetell: mocks.scoreRetell,
  }),
}));

vi.mock("@/games/shared/useTTS", () => ({
  useTTS: () => ({
    speak: mocks.speak,
    stop: mocks.stop,
    pause: mocks.pause,
    resume: mocks.resume,
    isSpeaking: false,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("./gameStorage", async () => {
  const actual = await vi.importActual<typeof import("./gameStorage")>("./gameStorage");
  return {
    ...actual,
    saveGameResult: vi.fn(() => Promise.resolve()),
  };
});

const t = (path: string, fallback?: string) => translate("en", path, fallback);

function renderStoryRecall() {
  mocks.scoreRetell.mockResolvedValue({
    covered: [1],
    not_covered: [2],
    covered_count: 1,
    total_count: 2,
    error: null,
  });

  return render(
    <StoryRecallGame
      plan={{
        gameType: "story_recall",
        level: 6,
        variantId: "story_recall-l6-v1",
        reasonLabel: "",
      }}
      localizedVariant={{
        title: "Ana's walk",
        prompt: "Read or listen to the story and answer from memory.",
        payload: {
          story: "Ana went out with her blue bag and bought bread at the corner shop.",
          keyFacts: ["Ana carried a blue bag.", "Ana bought bread."],
          choiceQuestions: [
            {
              prompt: "What colour was Ana's bag?",
              options: ["Blue", "Green", "Red"],
              answerIndex: 0,
            },
          ],
        },
      }}
      gameTitle="Short stories"
      gamePrompt="Read or listen to a short story."
      accentColor="#92400E"
      iconBg="#FEF3C7"
      cognitiveDomain="language"
      userId="user-1"
      language="en"
      t={t}
      onBack={vi.fn()}
      onOpenRecommended={vi.fn()}
      onOpenNextLevel={vi.fn()}
      onOpenSameGame={vi.fn()}
      actionLoading={null}
    />,
  );
}

describe("StoryRecallGame", () => {
  it("guides the story round into the shared completion dialog", async () => {
    renderStoryRecall();

    expect(screen.getByText("Level 6 - Build")).toBeInTheDocument();
    expect(screen.getByText("Read, then hide the story.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /listen|pause audio|stop audio/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Answer questions" }));
    expect(await screen.findByText("Answer from memory.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to retell" }));

    fireEvent.change(await screen.findByPlaceholderText("Write the story here..."), {
      target: { value: "Ana had a blue bag and bought bread." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit retell" }));

    expect(await screen.findByRole("dialog", { name: "Well done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More games" })).toBeInTheDocument();
    expect(saveGameResult).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      gameType: "story_recall",
      cognitiveDomain: "language",
      variantId: "story_recall-l6-v1",
      language: "en",
    }));
  });
});
