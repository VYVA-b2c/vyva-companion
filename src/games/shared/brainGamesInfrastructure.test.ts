import { describe, expect, it } from "vitest";
import { translate } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";
import attentionBoostersSource from "../AttentionBoostersPage.tsx?raw";
import breathGardenSource from "../BreathGarden.jsx?raw";
import categorySortSource from "../CategorySort.jsx?raw";
import curiousMindsSource from "../CuriousMinds.jsx?raw";
import dualTaskSource from "../DualTaskWalk.jsx?raw";
import executiveFunctionSource from "../ExecutiveFunctionPage.tsx?raw";
import faceNameSource from "../FaceNameMatch.jsx?raw";
import languageGamesSource from "../LanguageGamesPage.tsx?raw";
import listenCloselySource from "../ListenClosely.jsx?raw";
import numberTrailsSource from "../NumberTrails.jsx?raw";
import rememberLaterSource from "../RememberLater.jsx?raw";
import sensesPageSource from "../SensesPage.tsx?raw";
import scentMemorySource from "../ScentMemory.jsx?raw";
import storyRecallSource from "../memory/StoryRecallGame.tsx?raw";
import memoryGameRunnerSource from "../memory/MemoryGameRunner.tsx?raw";
import memoryGamesPageSource from "../memory/MemoryGamesPage.tsx?raw";
import { getGameLevel, getVariantContent } from "../memory/memoryGameRegistry";
import spatialNavigatorSource from "../SpatialNavigator.jsx?raw";

const languages: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];
const requiredKeys = [
  "brainGames.attentionBoosters.title",
  "brainGames.attentionBoosters.dualTask.title",
  "brainGames.attentionBoosters.rhythmTap.description",
  "brainGames.executiveFunction.title",
  "brainGames.executiveFunction.categorySort.description",
  "brainGames.categorySort.loading",
  "brainGames.categorySort.semantic.man_made",
  "brainGames.executiveFunction.numberTrails.title",
  "games.numberTrails.title",
  "games.numberTrails.nextTarget",
  "games.listenClosely.title",
  "games.listenClosely.cardDescription",
  "games.listenClosely.introShort",
  "games.listenClosely.taskLabel",
  "games.listenClosely.instructionFind",
  "games.listenClosely.instructionCompare",
  "games.listenClosely.tutorialSubtitle",
  "games.listenClosely.tutorialUnderstand",
  "games.listenClosely.sampleSounds",
  "games.listenClosely.resultGood",
  "games.listenClosely.nextRound",
  "games.listenClosely.levelProgressHint",
  "games.listenClosely.levelReady",
  "games.listenClosely.sounds.chime",
  "games.rememberLater.title",
  "games.rememberLater.intentionEvent",
  "games.rememberLater.rules.number_even",
  "games.scentMemory.title",
  "games.scentMemory.tutorialSubtitle",
  "games.scentMemory.tutorialUnderstand",
  "games.scentMemory.placeholder",
  "brainGames.senses.scentMemory.badge",
  "games.breathGarden.title",
  "games.breathGarden.tutorialSubtitle",
  "games.breathGarden.tutorialUnderstand",
  "games.breathGarden.tapPrompt",
  "brainGames.senses.breathGarden.badge",
  "cognitiveDomains.arousal_regulation",
  "brainGames.language.title",
  "brainGames.language.storyRecall.ariaLabel",
  "brainGames.faceName.title",
  "brainGames.faceName.f2n",
  "brainGames.dualTask.loading",
  "brainGames.dualTask.mathAnswer",
  "brainGames.dualTask.instructions",
  "brainGames.dualTask.tutorialUnderstand",
  "brainGames.dualTask.tutorialCount",
  "brainGames.dualTask.tutorialWatch",
  "brainGames.dualTask.tutorialTap",
  "memory.instructions",
  "memory.sequenceTutorialTitle",
  "memory.sequenceTutorialUnderstand",
  "games.curiousMinds.instructions",
  "games.curiousMinds.tutorialTitle",
  "games.curiousMinds.tutorialUnderstand",
  "brainGames.spatialNav.loading",
  "brainGames.spatialNav.readySoon",
  "storyRecall.readLabel",
  "storyRecall.submitRetell",
  "storyRecall.scoringFallback",
  "memory.nextLevel",
];

describe("brain game shared infrastructure", () => {
  it("resolves brain game translations for every app language", () => {
    languages.forEach((language) => {
      requiredKeys.forEach((key) => {
        expect(translate(language, key)).not.toBe(key);
      });
    });
  });

  it("keeps current games off local copy dictionaries", () => {
    [attentionBoostersSource, breathGardenSource, categorySortSource, dualTaskSource, executiveFunctionSource, faceNameSource, languageGamesSource, listenCloselySource, numberTrailsSource, rememberLaterSource, scentMemorySource, spatialNavigatorSource, storyRecallSource].forEach((source) => {
      expect(source).not.toContain("const COPY =");
      expect(source).not.toContain("const TEXT =");
      expect(source).not.toContain("COPY[");
      expect(source).not.toContain("copyFor(");
    });
  });

  it("keeps every active game implementation on the canonical Brain Coach shell", () => {
    [
      breathGardenSource,
      categorySortSource,
      curiousMindsSource,
      dualTaskSource,
      faceNameSource,
      listenCloselySource,
      numberTrailsSource,
      rememberLaterSource,
      scentMemorySource,
      spatialNavigatorSource,
      memoryGameRunnerSource,
    ].forEach((source) => {
      expect(source).toContain("BrainCoachActivityShell");
    });

    [attentionBoostersSource, executiveFunctionSource, memoryGamesPageSource, sensesPageSource].forEach((source) => {
      expect(source).toContain("BrainCoachFlowShell");
    });
  });

  it("keeps setup screens concise and free from duplicate identity decoration", () => {
    expect(spatialNavigatorSource).not.toContain("spatial-hero-icon");
    expect(faceNameSource).not.toContain("icon={Users}");
    expect(memoryGameRunnerSource).not.toContain("hideVisualMemoryInstructionsAfterStart");
  });

  it("does not preselect the first Dual Task subtraction answer", () => {
    expect(dualTaskSource).not.toContain("setPickerValue(clamp(seq.start_number - 7");
    expect(dualTaskSource).toContain("setPickerTouched(false)");
    expect(dualTaskSource).toContain("disabled={!pickerTouched}");
  });

  it("provides localized short story payloads with English fallback", () => {
    const storyLevel = getGameLevel("story_recall", 5);

    languages.forEach((language) => {
      storyLevel.variants.forEach((variant) => {
        const content = getVariantContent(variant, language);
        expect(content.title).toBeTruthy();
        expect(content.prompt).toBeTruthy();
        expect(content.payload.story).toEqual(expect.any(String));
        expect(content.payload.keyFacts).toEqual(expect.arrayContaining([expect.any(String)]));
        expect(content.payload.choiceQuestions).toEqual(expect.arrayContaining([
          expect.objectContaining({
            prompt: expect.any(String),
            options: expect.arrayContaining([expect.any(String)]),
            answerIndex: expect.any(Number),
          }),
        ]));
      });
    });
  });
});
