import { translate } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";
import {
  BRAIN_COACH_MAX_LEVEL,
  getBrainCoachLevelBand,
} from "../shared/brainCoachProgression";
import type {
  CognitiveDomain,
  MemoryGameDefinition,
  MemoryGameLevel,
  MemoryGameType,
  MemoryGameVariant,
  MemoryGameVariantContent,
} from "./types";
import { buildConnectionsLevels } from "./connectionsData";
import { buildNumberMemoryLevels } from "./numberMemoryData";

type LocalizedValue<T> = Partial<Record<LanguageCode, T>> & { es: T };

type MemoryMatchItem = {
  emoji: string;
  labels: Record<LanguageCode, string>;
};

type MemoryMatchSet = {
  titles: Record<LanguageCode, string>;
  prompts: Record<LanguageCode, string>;
  items: MemoryMatchItem[];
};

type SequenceTemplate = {
  titles: Record<LanguageCode, string>;
  items: string[];
};

type SequenceTile = {
  id: string;
  emoji: string;
  color: string;
};

type WordRecallItem = {
  labels: Record<LanguageCode, string>;
};

type WordRecallSet = {
  titles: Record<LanguageCode, string>;
  prompts: Record<LanguageCode, string>;
  words: WordRecallItem[];
  distractors: WordRecallItem[];
};

type RoutineTemplate = {
  title: string;
  activities: string[];
};

type GameContentLanguage = LanguageCode;

type StoryChoiceQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
};

type StoryContent = {
  title: string;
  story: string;
  keyFacts: string[];
  choiceQuestions: StoryChoiceQuestion[];
};

type StoryTemplate = Record<GameContentLanguage, StoryContent>;

const GAME_CONTENT_LANGUAGES: GameContentLanguage[] = ["es", "en", "fr", "de", "it", "pt"];
const MEMORY_GAME_LEVELS = Array.from({ length: BRAIN_COACH_MAX_LEVEL }, (_, index) => index + 1);
const MEMORY_MATCH_VARIANTS_PER_THEME = 3;

function createVariant(
  id: string,
  level: number,
  content: LocalizedValue<MemoryGameVariantContent>,
): MemoryGameVariant {
  return { id, level, content };
}

function createDefinition(
  gameType: MemoryGameType,
  titleKey: string,
  descriptionKey: string,
  cognitiveDomain: CognitiveDomain,
  accentColor: string,
  iconBg: string,
  levels: MemoryGameLevel[],
): MemoryGameDefinition {
  return {
    gameType,
    titleKey,
    descriptionKey,
    cognitiveDomain,
    accentColor,
    iconBg,
    levels,
  };
}

function buildSpanishOnlyVariants(
  gameType: MemoryGameType,
  level: number,
  entries: Array<{ title: string; prompt: string; payload: Record<string, unknown> }>,
): MemoryGameVariant[] {
  return entries.map((entry, index) =>
    createVariant(`${gameType}-l${level}-v${index + 1}`, level, {
      es: entry,
    }),
  );
}

function pickMemoryMatchItems(items: MemoryMatchItem[], pairCount: number, offset: number) {
  const safePairCount = Math.min(pairCount, items.length);
  const safeOffset = items.length > 0 ? ((offset % items.length) + items.length) % items.length : 0;

  return Array.from({ length: safePairCount }, (_, index) => items[(safeOffset + index) % items.length]);
}

function getMemoryMatchOffsets(itemCount: number, pairCount: number) {
  if (pairCount >= itemCount) return [0];

  return Array.from(
    { length: MEMORY_MATCH_VARIANTS_PER_THEME },
    (_, index) => Math.floor((index * itemCount) / MEMORY_MATCH_VARIANTS_PER_THEME),
  );
}

function localizeMemoryMatchContent(set: MemoryMatchSet, pairCount: number, level: number, itemOffset: number): LocalizedValue<MemoryGameVariantContent> {
  const languages: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];
  const band = getBrainCoachLevelBand(level);
  const pairItems = pickMemoryMatchItems(set.items, pairCount, itemOffset);

  return languages.reduce((accumulator, language) => {
    accumulator[language] = {
      title: set.titles[language],
      prompt: set.prompts[language],
      payload: {
        pairItems: pairItems.map((item) => ({
          label: item.labels[language],
          emoji: item.emoji,
        })),
        levelBand: band.label,
        previewSeconds: Math.max(0, 6 - Math.floor((level - 1) / 4)),
      },
    };

    return accumulator;
  }, {} as LocalizedValue<MemoryGameVariantContent>);
}

function buildMemoryMatchLevels(sets: MemoryMatchSet[]): MemoryGameLevel[] {
  const pairCounts = [3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8] as const;
  const levelSpecs = MEMORY_GAME_LEVELS.map((level) => ({
    level,
    pairs: pairCounts[level - 1] ?? 8,
  }));

  return levelSpecs.map((spec) => {
    const maxOffsetCount = Math.max(...sets.map((set) => getMemoryMatchOffsets(set.items.length, spec.pairs).length));
    const variants = Array.from({ length: maxOffsetCount }).flatMap((_, offsetIndex) =>
      sets.flatMap((set, setIndex) => {
        const offsets = getMemoryMatchOffsets(set.items.length, spec.pairs);
        const itemOffset = offsets[offsetIndex];
        if (itemOffset === undefined) return [];

        return [
          createVariant(
            `memory_match-l${spec.level}-v${offsetIndex * sets.length + setIndex + 1}`,
            spec.level,
            localizeMemoryMatchContent(set, spec.pairs, spec.level, itemOffset),
          ),
        ];
      }),
    );

    return {
      level: spec.level,
      variants,
    };
  });
}

function buildListLevels(
  gameType: MemoryGameType,
  labels: readonly { level: number; count: number; reverse?: boolean; prompt: string }[],
  templates: readonly string[][],
  titlePrefix: string,
): MemoryGameLevel[] {
  return labels.map((spec) => ({
    level: spec.level,
    variants: buildSpanishOnlyVariants(
      gameType,
      spec.level,
      templates.map((items, index) => ({
        title: `${titlePrefix} ${index + 1}`,
        prompt: spec.prompt,
        payload: {
          items: items.slice(0, spec.count),
          reverse: Boolean(spec.reverse),
        },
      })),
    ),
  }));
}

function buildWordRecallLevels(sets: WordRecallSet[]): MemoryGameLevel[] {
  const distractionRotation = ["count_backwards", "choose_blue", "breathe_continue"] as const;
  const levelSpecs = MEMORY_GAME_LEVELS.map((level) => ({
    level,
    count: Math.min(6, 3 + Math.floor((level - 1) / 4)),
    distractionType: level <= 4 ? null : distractionRotation[(level - 5) % distractionRotation.length],
  }));
  const languages: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];

  return levelSpecs.map((spec) => ({
    level: spec.level,
    variants: sets.map((set, index) => {
      const content = languages.reduce((accumulator, language) => {
        const distractionType = spec.distractionType;

        accumulator[language] = {
          title: set.titles[language],
          prompt: set.prompts[language],
          payload: {
            words: set.words.slice(0, spec.count).map((item) => item.labels[language]),
            distractors: set.distractors.slice(0, spec.count + 1).map((item) => item.labels[language]),
            distractionType,
            levelBand: getBrainCoachLevelBand(spec.level).label,
            recallMode: spec.level >= 15 ? "mastery" : spec.level >= 9 ? "delayed" : "guided",
          },
        };

        return accumulator;
      }, {} as LocalizedValue<MemoryGameVariantContent>);

      return createVariant(`word_recall-l${spec.level}-v${index + 1}`, spec.level, content);
    }),
  }));
}

function buildSequenceLevels(templates: readonly SequenceTemplate[]): MemoryGameLevel[] {
  const sequenceVisualSets: SequenceTile[][] = [
    [
      { id: "leaf", emoji: "🍃", color: "#2F855A" },
      { id: "sun", emoji: "☀️", color: "#D69E2E" },
      { id: "flower", emoji: "🌷", color: "#D53F8C" },
      { id: "drop", emoji: "💧", color: "#3182CE" },
    ],
    [
      { id: "cup", emoji: "☕", color: "#805AD5" },
      { id: "bread", emoji: "🍞", color: "#DD6B20" },
      { id: "spoon", emoji: "🥄", color: "#718096" },
      { id: "apple", emoji: "🍎", color: "#C53030" },
    ],
    [
      { id: "key", emoji: "🔑", color: "#D69E2E" },
      { id: "book", emoji: "📘", color: "#2B6CB0" },
      { id: "glasses", emoji: "👓", color: "#4A5568" },
      { id: "bag", emoji: "👜", color: "#B83280" },
    ],
    [
      { id: "pear", emoji: "🍐", color: "#38A169" },
      { id: "banana", emoji: "🍌", color: "#D69E2E" },
      { id: "grapes", emoji: "🍇", color: "#6B46C1" },
      { id: "melon", emoji: "🍈", color: "#319795" },
    ],
    [
      { id: "bell", emoji: "🔔", color: "#D69E2E" },
      { id: "radio", emoji: "📻", color: "#2C5282" },
      { id: "clock", emoji: "⏰", color: "#C05621" },
      { id: "door", emoji: "🚪", color: "#805AD5" },
    ],
    [
      { id: "tree", emoji: "🌳", color: "#2F855A" },
      { id: "bench", emoji: "🪑", color: "#805AD5" },
      { id: "fountain", emoji: "⛲", color: "#3182CE" },
      { id: "bridge", emoji: "🌉", color: "#D53F8C" },
    ],
    [
      { id: "pharmacy", emoji: "💊", color: "#38A169" },
      { id: "market", emoji: "🛒", color: "#DD6B20" },
      { id: "home", emoji: "🏠", color: "#2B6CB0" },
      { id: "phone", emoji: "📞", color: "#B83280" },
    ],
    [
      { id: "shirt", emoji: "👕", color: "#3182CE" },
      { id: "scarf", emoji: "🧣", color: "#C05621" },
      { id: "cap", emoji: "🧢", color: "#D53F8C" },
      { id: "shoe", emoji: "👟", color: "#2F855A" },
    ],
    [
      { id: "spring", emoji: "🌼", color: "#D53F8C" },
      { id: "summer", emoji: "🌞", color: "#D69E2E" },
      { id: "autumn", emoji: "🍂", color: "#DD6B20" },
      { id: "winter", emoji: "❄️", color: "#3182CE" },
    ],
    [
      { id: "wake", emoji: "⏰", color: "#805AD5" },
      { id: "wash", emoji: "🧼", color: "#2F855A" },
      { id: "dress", emoji: "👚", color: "#D53F8C" },
      { id: "walk", emoji: "🚶", color: "#D69E2E" },
    ],
  ];

  const levelSpecs = MEMORY_GAME_LEVELS.map((level) => ({
    level,
    count: Math.min(8, 3 + Math.floor((level - 1) / 3)),
    reverse: level >= 11 && level % 2 === 0,
  }));

  const buildSequencePattern = (level: number, variantIndex: number, count: number) =>
    Array.from({ length: count }, (_, position) => (
      variantIndex + level + position * (level >= 11 ? 2 : 1) + Math.floor(position / 2)
    ) % 4);

  const patternMap: Record<number, number[][]> = {
    1: [
      [0, 1, 2],
      [1, 2, 3],
      [2, 0, 3],
      [3, 1, 0],
      [0, 2, 1],
      [1, 3, 2],
      [2, 1, 0],
      [3, 0, 1],
      [0, 3, 2],
      [1, 0, 2],
    ],
    2: [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [0, 2, 1, 3],
      [1, 3, 0, 2],
      [2, 0, 3, 1],
      [3, 1, 2, 0],
      [0, 3, 1, 2],
      [1, 0, 2, 3],
      [2, 3, 0, 1],
      [3, 0, 2, 1],
    ],
    3: [
      [0, 1, 2, 3, 1],
      [1, 3, 0, 2, 1],
      [2, 0, 3, 1, 2],
      [3, 1, 2, 0, 3],
      [0, 2, 1, 3, 0],
      [1, 0, 2, 3, 1],
      [2, 3, 1, 0, 2],
      [3, 0, 1, 2, 3],
      [0, 3, 2, 1, 0],
      [1, 2, 0, 3, 1],
    ],
    4: [
      [0, 1, 2, 3, 1, 0],
      [1, 3, 0, 2, 1, 3],
      [2, 0, 3, 1, 2, 0],
      [3, 1, 2, 0, 3, 1],
      [0, 2, 1, 3, 0, 2],
      [1, 0, 2, 3, 1, 0],
      [2, 3, 1, 0, 2, 3],
      [3, 0, 1, 2, 3, 0],
      [0, 3, 2, 1, 0, 3],
      [1, 2, 0, 3, 1, 2],
    ],
    5: [
      [0, 1, 2, 3, 1, 0],
      [1, 3, 0, 2, 1, 3],
      [2, 0, 3, 1, 2, 0],
      [3, 1, 2, 0, 3, 1],
      [0, 2, 1, 3, 0, 2],
      [1, 0, 2, 3, 1, 0],
      [2, 3, 1, 0, 2, 3],
      [3, 0, 1, 2, 3, 0],
      [0, 3, 2, 1, 0, 3],
      [1, 2, 0, 3, 1, 2],
    ],
  };

  const promptMap = {
    1: {
      es: "Observa una secuencia de 3 pasos y repitela con calma.",
      en: "Watch a 3-step sequence and repeat it calmly.",
      fr: "Observe une sequence de 3 etapes et repete-la calmement.",
      de: "Beobachte eine Folge mit 3 Schritten und wiederhole sie ruhig.",
      it: "Osserva una sequenza di 3 passaggi e ripetila con calma.",
      pt: "Observa uma sequencia de 3 passos e repete-a com calma.",
    },
    2: {
      es: "Observa una secuencia de 4 pasos y repitela en el mismo orden.",
      en: "Watch a 4-step sequence and repeat it in the same order.",
      fr: "Observe une sequence de 4 etapes et repete-la dans le meme ordre.",
      de: "Beobachte eine Folge mit 4 Schritten und wiederhole sie in derselben Reihenfolge.",
      it: "Osserva una sequenza di 4 passaggi e ripetila nello stesso ordine.",
      pt: "Observa uma sequencia de 4 passos e repete-a na mesma ordem.",
    },
    3: {
      es: "Observa una secuencia de 5 pasos y repitela sin prisa.",
      en: "Watch a 5-step sequence and repeat it without rushing.",
      fr: "Observe une sequence de 5 etapes et repete-la sans te presser.",
      de: "Beobachte eine Folge mit 5 Schritten und wiederhole sie ohne Eile.",
      it: "Osserva una sequenza di 5 passaggi e ripetila senza fretta.",
      pt: "Observa uma sequencia de 5 passos e repete-a sem pressa.",
    },
    4: {
      es: "Observa una secuencia de 6 pasos y repitela completa.",
      en: "Watch a 6-step sequence and repeat it fully.",
      fr: "Observe une sequence de 6 etapes et repete-la en entier.",
      de: "Beobachte eine Folge mit 6 Schritten und wiederhole sie vollstandig.",
      it: "Osserva una sequenza di 6 passaggi e ripetila completa.",
      pt: "Observa uma sequencia de 6 passos e repete-a por completo.",
    },
    5: {
      es: "Observa la secuencia y repitela en orden inverso.",
      en: "Watch the sequence and repeat it in reverse order.",
      fr: "Observe la sequence et repete-la dans l'ordre inverse.",
      de: "Beobachte die Folge und wiederhole sie in umgekehrter Reihenfolge.",
      it: "Osserva la sequenza e ripetila in ordine inverso.",
      pt: "Observa a sequencia e repete-a em ordem inversa.",
    },
  } as const;

  return levelSpecs.map((spec) => ({
    level: spec.level,
    variants: templates.map((template, index) => {
      const tileSet = sequenceVisualSets[index % sequenceVisualSets.length];
      const pattern = patternMap[spec.level]?.[index % patternMap[spec.level].length]
        ?? buildSequencePattern(spec.level, index, spec.count);
      const sequence = pattern.slice(0, spec.count).map((tileIndex) => tileSet[tileIndex % tileSet.length].id);
      const languages: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];

      const content = languages.reduce((accumulator, language) => {
        const promptLevel = Math.min(spec.level, 5) as keyof typeof promptMap;
        accumulator[language] = {
          title: template.titles[language],
          prompt: promptMap[promptLevel][language],
          payload: {
            tiles: tileSet,
            sequence,
            reverse: spec.reverse,
            levelBand: getBrainCoachLevelBand(spec.level).label,
            tempoMs: Math.max(680, 1180 - spec.level * 20),
          },
        };
        return accumulator;
      }, {} as LocalizedValue<MemoryGameVariantContent>);

      return createVariant(`sequence_memory-l${spec.level}-v${index + 1}`, spec.level, content);
    }),
  }));
}

function buildRoutineLevels(routines: readonly RoutineTemplate[]): MemoryGameLevel[] {
  return [
    {
      level: 1,
      prompt: "Ordena 3 pasos cotidianos.",
      payload: (template: RoutineTemplate) => ({ activities: template.activities.slice(0, 3) }),
    },
    {
      level: 2,
      prompt: "Ordena 4 actividades en el momento correcto.",
      payload: (template: RoutineTemplate) => ({ activities: template.activities.slice(0, 4) }),
    },
    {
      level: 3,
      prompt: "Recuerda una tarea diaria y la hora en que ocurre.",
      payload: (template: RoutineTemplate, index: number) => ({
        activities: template.activities.slice(0, 4),
        timeHint: `${9 + index}:00`,
      }),
    },
    {
      level: 4,
      prompt: "Recuerda una secuencia parecida a una rutina de cuidado o medicación.",
      payload: (template: RoutineTemplate) => ({
        activities: template.activities.slice(0, 5),
        medicationStep: template.activities[2],
      }),
    },
    {
      level: 5,
      prompt: "Recuerda un plan diario con varias tareas mezcladas.",
      payload: (template: RoutineTemplate) => ({
        activities: template.activities,
        title: template.title,
      }),
    },
  ].map((spec) => ({
    level: spec.level,
    variants: buildSpanishOnlyVariants(
      "routine_memory",
      spec.level,
      routines.map((template, index) => ({
        title: `Rutina ${index + 1}`,
        prompt: spec.prompt,
        payload: spec.payload(template, index),
      })),
    ),
  }));
}

function buildStoryLevels(stories: readonly StoryTemplate[]): MemoryGameLevel[] {
  const baseLevelSpecs = [
    {
      level: 1,
      questionCount: 1,
      factCount: 3,
      prompts: {
        es: "Lee o escucha la historia y responde una pregunta.",
        en: "Read or listen to the story and answer one question.",
        fr: "Lisez ou ecoutez l'histoire et repondez a une question.",
        de: "Lesen oder horen Sie die Geschichte und beantworten Sie eine Frage.",
        it: "Leggi o ascolta la storia e rispondi a una domanda.",
        pt: "Leia ou ouca a historia e responda a uma pergunta.",
      },
    },
    {
      level: 2,
      questionCount: 2,
      factCount: 4,
      prompts: {
        es: "Recuerda dos detalles importantes de la historia.",
        en: "Remember two important details from the story.",
        fr: "Souvenez-vous de deux details importants de l'histoire.",
        de: "Merken Sie sich zwei wichtige Details aus der Geschichte.",
        it: "Ricorda due dettagli importanti della storia.",
        pt: "Recorde dois detalhes importantes da historia.",
      },
    },
    {
      level: 3,
      questionCount: 3,
      factCount: 4,
      prompts: {
        es: "Recuerda quien, que y donde ocurre la historia.",
        en: "Remember who, what, and where in the story.",
        fr: "Souvenez-vous de qui, quoi et ou dans l'histoire.",
        de: "Merken Sie sich wer, was und wo in der Geschichte.",
        it: "Ricorda chi, che cosa e dove nella storia.",
        pt: "Recorde quem, o que e onde na historia.",
      },
    },
    {
      level: 4,
      questionCount: 3,
      factCount: 4,
      prompts: {
        es: "Recuerda los detalles y cuenta la historia con tus palabras.",
        en: "Remember the details and tell the story in your own words.",
        fr: "Souvenez-vous des details et racontez l'histoire avec vos mots.",
        de: "Merken Sie sich die Details und erzahlen Sie die Geschichte mit eigenen Worten.",
        it: "Ricorda i dettagli e racconta la storia con parole tue.",
        pt: "Recorde os detalhes e conte a historia pelas suas palavras.",
      },
    },
    {
      level: 5,
      questionCount: 4,
      factCount: 4,
      prompts: {
        es: "Lee o escucha con calma y recuerda la historia completa.",
        en: "Read or listen calmly and remember the whole story.",
        fr: "Lisez ou ecoutez calmement et souvenez-vous de toute l'histoire.",
        de: "Lesen oder horen Sie ruhig zu und merken Sie sich die ganze Geschichte.",
        it: "Leggi o ascolta con calma e ricorda tutta la storia.",
        pt: "Leia ou ouca com calma e recorde a historia completa.",
      },
    },
  ] as const;

  const levelSpecs = MEMORY_GAME_LEVELS.map((level) => {
    const base = baseLevelSpecs[Math.min(baseLevelSpecs.length - 1, Math.floor((level - 1) / 4))];
    return {
      level,
      questionCount: Math.min(4, 1 + Math.floor((level - 1) / 5)),
      factCount: Math.min(4, 3 + Math.floor((level - 1) / 7)),
      prompts: base.prompts,
    };
  });

  return levelSpecs.map((spec) => ({
    level: spec.level,
    variants: stories.map((story, index) => {
      const content = GAME_CONTENT_LANGUAGES.reduce((accumulator, language) => {
        const localizedStory = story[language];
        accumulator[language] = {
          title: localizedStory.title,
          prompt: spec.prompts[language],
          payload: {
            story: localizedStory.story,
            keyFacts: localizedStory.keyFacts.slice(0, spec.factCount),
            choiceQuestions: localizedStory.choiceQuestions.slice(0, spec.questionCount),
            levelBand: getBrainCoachLevelBand(spec.level).label,
            retellMode: spec.level >= 16 ? "full" : spec.level >= 11 ? "guided" : "short",
          },
        };

        return accumulator;
      }, {} as LocalizedValue<MemoryGameVariantContent>);

      return createVariant(`story_recall-l${spec.level}-v${index + 1}`, spec.level, content);
    }),
  }));
}

const memoryMatchSets: MemoryMatchSet[] = [
  {
    titles: { es: "Frutas frescas", en: "Fresh fruit", fr: "Fruits frais", de: "Frisches Obst", it: "Frutta fresca", pt: "Frutas frescas" },
    prompts: {
      es: "Encuentra las parejas de frutas de todos los días.",
      en: "Find the matching pairs of everyday fruit.",
      fr: "Retrouvez les paires de fruits du quotidien.",
      de: "Finde die passenden Paare mit alltäglichem Obst.",
      it: "Trova le coppie della frutta di tutti i giorni.",
      pt: "Encontre os pares de frutas do dia a dia.",
    },
    items: [
      { emoji: "🍎", labels: { es: "manzana", en: "apple", fr: "pomme", de: "Apfel", it: "mela", pt: "maçã" } },
      { emoji: "🍐", labels: { es: "pera", en: "pear", fr: "poire", de: "Birne", it: "pera", pt: "pera" } },
      { emoji: "🍌", labels: { es: "plátano", en: "banana", fr: "banane", de: "Banane", it: "banana", pt: "banana" } },
      { emoji: "🍊", labels: { es: "naranja", en: "orange", fr: "orange", de: "Orange", it: "arancia", pt: "laranja" } },
      { emoji: "🍇", labels: { es: "uva", en: "grapes", fr: "raisin", de: "Trauben", it: "uva", pt: "uva" } },
      { emoji: "🍓", labels: { es: "fresa", en: "strawberry", fr: "fraise", de: "Erdbeere", it: "fragola", pt: "morango" } },
      { emoji: "🥝", labels: { es: "kiwi", en: "kiwi", fr: "kiwi", de: "Kiwi", it: "kiwi", pt: "kiwi" } },
      { emoji: "🍈", labels: { es: "melón", en: "melon", fr: "melon", de: "Melone", it: "melone", pt: "melão" } },
    ],
  },
  {
    titles: { es: "Mesa de cocina", en: "Kitchen table", fr: "Table de cuisine", de: "Küchentisch", it: "Tavola di cucina", pt: "Mesa da cozinha" },
    prompts: {
      es: "Empareja los utensilios que solemos usar al comer.",
      en: "Match the utensils we often use at mealtime.",
      fr: "Associez les ustensiles que nous utilisons souvent à table.",
      de: "Ordne die Küchenutensilien zu, die wir oft beim Essen benutzen.",
      it: "Abbina gli utensili che usiamo spesso a tavola.",
      pt: "Combine os utensílios que usamos com frequência à mesa.",
    },
    items: [
      { emoji: "☕", labels: { es: "taza", en: "cup", fr: "tasse", de: "Tasse", it: "tazza", pt: "chávena" } },
      { emoji: "🍽️", labels: { es: "plato", en: "plate", fr: "assiette", de: "Teller", it: "piatto", pt: "prato" } },
      { emoji: "🥄", labels: { es: "cuchara", en: "spoon", fr: "cuillère", de: "Löffel", it: "cucchiaio", pt: "colher" } },
      { emoji: "🍴", labels: { es: "tenedor", en: "fork", fr: "fourchette", de: "Gabel", it: "forchetta", pt: "garfo" } },
      { emoji: "🫖", labels: { es: "tetera", en: "teapot", fr: "théière", de: "Teekanne", it: "teiera", pt: "bule" } },
      { emoji: "🥛", labels: { es: "vaso", en: "glass", fr: "verre", de: "Glas", it: "bicchiere", pt: "copo" } },
      { emoji: "🧻", labels: { es: "servilleta", en: "napkin", fr: "serviette", de: "Serviette", it: "tovagliolo", pt: "guardanapo" } },
      { emoji: "🏺", labels: { es: "jarra", en: "jug", fr: "carafe", de: "Krug", it: "brocca", pt: "jarra" } },
    ],
  },
  {
    titles: { es: "Animales amigos", en: "Friendly animals", fr: "Animaux familiers", de: "Vertraute Tiere", it: "Animali amici", pt: "Animais amigos" },
    prompts: {
      es: "Busca las parejas de animales fáciles de reconocer.",
      en: "Look for the matching pairs of familiar animals.",
      fr: "Cherchez les paires d'animaux faciles à reconnaître.",
      de: "Suche die passenden Paare bekannter Tiere.",
      it: "Cerca le coppie di animali facili da riconoscere.",
      pt: "Procure os pares de animais fáceis de reconhecer.",
    },
    items: [
      { emoji: "🐱", labels: { es: "gato", en: "cat", fr: "chat", de: "Katze", it: "gatto", pt: "gato" } },
      { emoji: "🐶", labels: { es: "perro", en: "dog", fr: "chien", de: "Hund", it: "cane", pt: "cão" } },
      { emoji: "🐦", labels: { es: "pájaro", en: "bird", fr: "oiseau", de: "Vogel", it: "uccello", pt: "pássaro" } },
      { emoji: "🐰", labels: { es: "conejo", en: "rabbit", fr: "lapin", de: "Kaninchen", it: "coniglio", pt: "coelho" } },
      { emoji: "🐟", labels: { es: "pez", en: "fish", fr: "poisson", de: "Fisch", it: "pesce", pt: "peixe" } },
      { emoji: "🐢", labels: { es: "tortuga", en: "turtle", fr: "tortue", de: "Schildkröte", it: "tartaruga", pt: "tartaruga" } },
      { emoji: "🐴", labels: { es: "caballo", en: "horse", fr: "cheval", de: "Pferd", it: "cavallo", pt: "cavalo" } },
      { emoji: "🐑", labels: { es: "oveja", en: "sheep", fr: "mouton", de: "Schaf", it: "pecora", pt: "ovelha" } },
    ],
  },
  {
    titles: { es: "Objetos de casa", en: "Home objects", fr: "Objets de la maison", de: "Haushaltsgegenstände", it: "Oggetti di casa", pt: "Objetos da casa" },
    prompts: {
      es: "Encuentra las parejas de objetos cotidianos del hogar.",
      en: "Find the matching pairs of everyday home objects.",
      fr: "Retrouvez les paires d'objets du quotidien à la maison.",
      de: "Finde die passenden Paare von Alltagsgegenständen im Haus.",
      it: "Trova le coppie degli oggetti quotidiani di casa.",
      pt: "Encontre os pares de objetos do dia a dia de casa.",
    },
    items: [
      { emoji: "🔑", labels: { es: "llave", en: "key", fr: "clé", de: "Schlüssel", it: "chiave", pt: "chave" } },
      { emoji: "⌚", labels: { es: "reloj", en: "watch", fr: "montre", de: "Uhr", it: "orologio", pt: "relógio" } },
      { emoji: "📚", labels: { es: "libro", en: "book", fr: "livre", de: "Buch", it: "libro", pt: "livro" } },
      { emoji: "👓", labels: { es: "gafas", en: "glasses", fr: "lunettes", de: "Brille", it: "occhiali", pt: "óculos" } },
      { emoji: "👜", labels: { es: "bolso", en: "handbag", fr: "sac", de: "Handtasche", it: "borsa", pt: "bolsa" } },
      { emoji: "☂️", labels: { es: "paraguas", en: "umbrella", fr: "parapluie", de: "Regenschirm", it: "ombrello", pt: "guarda-chuva" } },
      { emoji: "👒", labels: { es: "sombrero", en: "hat", fr: "chapeau", de: "Hut", it: "cappello", pt: "chapéu" } },
      { emoji: "🧣", labels: { es: "bufanda", en: "scarf", fr: "écharpe", de: "Schal", it: "sciarpa", pt: "cachecol" } },
    ],
  },
  {
    titles: { es: "Salón cómodo", en: "Cozy living room", fr: "Salon confortable", de: "Gemütliches Wohnzimmer", it: "Salotto accogliente", pt: "Sala acolhedora" },
    prompts: {
      es: "Empareja muebles y objetos del salón.",
      en: "Match furniture and living room items.",
      fr: "Associez les meubles et objets du salon.",
      de: "Ordne Möbel und Gegenstände aus dem Wohnzimmer zu.",
      it: "Abbina i mobili e gli oggetti del soggiorno.",
      pt: "Combine os móveis e objetos da sala.",
    },
    items: [
      { emoji: "🛋️", labels: { es: "sofá", en: "sofa", fr: "canapé", de: "Sofa", it: "divano", pt: "sofá" } },
      { emoji: "💡", labels: { es: "lámpara", en: "lamp", fr: "lampe", de: "Lampe", it: "lampada", pt: "lâmpada" } },
      { emoji: "🪴", labels: { es: "planta", en: "plant", fr: "plante", de: "Pflanze", it: "pianta", pt: "planta" } },
      { emoji: "🪑", labels: { es: "silla", en: "chair", fr: "chaise", de: "Stuhl", it: "sedia", pt: "cadeira" } },
      { emoji: "🧶", labels: { es: "alfombra", en: "rug", fr: "tapis", de: "Teppich", it: "tappeto", pt: "tapete" } },
      { emoji: "🛏️", labels: { es: "cojín", en: "cushion", fr: "coussin", de: "Kissen", it: "cuscino", pt: "almofada" } },
      { emoji: "🪟", labels: { es: "cortina", en: "curtain", fr: "rideau", de: "Vorhang", it: "tenda", pt: "cortina" } },
      { emoji: "🪞", labels: { es: "espejo", en: "mirror", fr: "miroir", de: "Spiegel", it: "specchio", pt: "espelho" } },
    ],
  },
  {
    titles: { es: "Comida casera", en: "Homemade food", fr: "Repas maison", de: "Hausgemachtes Essen", it: "Cibo di casa", pt: "Comida caseira" },
    prompts: {
      es: "Encuentra las parejas de alimentos sencillos.",
      en: "Find the matching pairs of simple foods.",
      fr: "Retrouvez les paires d'aliments simples.",
      de: "Finde die passenden Paare einfacher Lebensmittel.",
      it: "Trova le coppie di cibi semplici.",
      pt: "Encontre os pares de alimentos simples.",
    },
    items: [
      { emoji: "🍞", labels: { es: "pan", en: "bread", fr: "pain", de: "Brot", it: "pane", pt: "pão" } },
      { emoji: "🧀", labels: { es: "queso", en: "cheese", fr: "fromage", de: "Käse", it: "formaggio", pt: "queijo" } },
      { emoji: "🥚", labels: { es: "huevo", en: "egg", fr: "œuf", de: "Ei", it: "uovo", pt: "ovo" } },
      { emoji: "🥛", labels: { es: "leche", en: "milk", fr: "lait", de: "Milch", it: "latte", pt: "leite" } },
      { emoji: "🍲", labels: { es: "sopa", en: "soup", fr: "soupe", de: "Suppe", it: "zuppa", pt: "sopa" } },
      { emoji: "🍚", labels: { es: "arroz", en: "rice", fr: "riz", de: "Reis", it: "riso", pt: "arroz" } },
      { emoji: "🍅", labels: { es: "tomate", en: "tomato", fr: "tomate", de: "Tomate", it: "pomodoro", pt: "tomate" } },
      { emoji: "🥕", labels: { es: "zanahoria", en: "carrot", fr: "carotte", de: "Karotte", it: "carota", pt: "cenoura" } },
    ],
  },
  {
    titles: { es: "Aseo diario", en: "Daily care", fr: "Toilette quotidienne", de: "Tägliche Pflege", it: "Cura quotidiana", pt: "Cuidados diários" },
    prompts: {
      es: "Busca las parejas de objetos de cuidado personal.",
      en: "Look for the matching pairs of personal care items.",
      fr: "Cherchez les paires d'objets de soin personnel.",
      de: "Suche die passenden Paare von Pflegeartikeln.",
      it: "Cerca le coppie di oggetti per la cura personale.",
      pt: "Procure os pares de objetos de cuidado pessoal.",
    },
    items: [
      { emoji: "🧼", labels: { es: "jabón", en: "soap", fr: "savon", de: "Seife", it: "sapone", pt: "sabão" } },
      { emoji: "🧺", labels: { es: "toalla", en: "towel", fr: "serviette", de: "Handtuch", it: "asciugamano", pt: "toalha" } },
      { emoji: "🪮", labels: { es: "peine", en: "comb", fr: "peigne", de: "Kamm", it: "pettine", pt: "pente" } },
      { emoji: "🪥", labels: { es: "cepillo", en: "brush", fr: "brosse", de: "Bürste", it: "spazzola", pt: "escova" } },
      { emoji: "🧴", labels: { es: "champú", en: "shampoo", fr: "shampooing", de: "Shampoo", it: "shampoo", pt: "champô" } },
      { emoji: "🫙", labels: { es: "crema", en: "cream", fr: "crème", de: "Creme", it: "crema", pt: "creme" } },
      { emoji: "🧻", labels: { es: "pañuelo", en: "tissue", fr: "mouchoir", de: "Taschentuch", it: "fazzoletto", pt: "lenço" } },
      { emoji: "🧽", labels: { es: "esponja", en: "sponge", fr: "éponge", de: "Schwamm", it: "spugna", pt: "esponja" } },
    ],
  },
  {
    titles: { es: "Ropa para salir", en: "Clothes to go out", fr: "Vêtements pour sortir", de: "Kleidung für draußen", it: "Abiti per uscire", pt: "Roupa para sair" },
    prompts: {
      es: "Encuentra las parejas de prendas habituales.",
      en: "Find the matching pairs of common clothes.",
      fr: "Retrouvez les paires de vêtements habituels.",
      de: "Finde die passenden Paare häufiger Kleidungsstücke.",
      it: "Trova le coppie dei capi di abbigliamento comuni.",
      pt: "Encontre os pares de roupas habituais.",
    },
    items: [
      { emoji: "👕", labels: { es: "camisa", en: "shirt", fr: "chemise", de: "Hemd", it: "camicia", pt: "camisa" } },
      { emoji: "🧥", labels: { es: "abrigo", en: "coat", fr: "manteau", de: "Mantel", it: "cappotto", pt: "casaco" } },
      { emoji: "👟", labels: { es: "zapato", en: "shoe", fr: "chaussure", de: "Schuh", it: "scarpa", pt: "sapato" } },
      { emoji: "🧤", labels: { es: "guante", en: "glove", fr: "gant", de: "Handschuh", it: "guanto", pt: "luva" } },
      { emoji: "🧦", labels: { es: "calcetín", en: "sock", fr: "chaussette", de: "Socke", it: "calzino", pt: "meia" } },
      { emoji: "👗", labels: { es: "falda", en: "skirt", fr: "jupe", de: "Rock", it: "gonna", pt: "saia" } },
      { emoji: "🥼", labels: { es: "pijama", en: "pyjamas", fr: "pyjama", de: "Pyjama", it: "pigiama", pt: "pijama" } },
      { emoji: "🧣", labels: { es: "pañuelo", en: "scarf", fr: "foulard", de: "Tuch", it: "foulard", pt: "lenço" } },
    ],
  },
  {
    titles: { es: "Desayuno tranquilo", en: "Calm breakfast", fr: "Petit-déjeuner tranquille", de: "Ruhiges Frühstück", it: "Colazione tranquilla", pt: "Pequeno-almoço tranquilo" },
    prompts: {
      es: "Empareja alimentos y bebidas del desayuno.",
      en: "Match breakfast foods and drinks.",
      fr: "Associez les aliments et boissons du petit-déjeuner.",
      de: "Ordne Frühstücksgetränke und Speisen zu.",
      it: "Abbina cibi e bevande della colazione.",
      pt: "Combine alimentos e bebidas do pequeno-almoço.",
    },
    items: [
      { emoji: "☕", labels: { es: "café", en: "coffee", fr: "café", de: "Kaffee", it: "caffè", pt: "café" } },
      { emoji: "🍵", labels: { es: "té", en: "tea", fr: "thé", de: "Tee", it: "tè", pt: "chá" } },
      { emoji: "🍪", labels: { es: "galleta", en: "biscuit", fr: "biscuit", de: "Keks", it: "biscotto", pt: "bolacha" } },
      { emoji: "🍯", labels: { es: "miel", en: "honey", fr: "miel", de: "Honig", it: "miele", pt: "mel" } },
      { emoji: "🥄", labels: { es: "mermelada", en: "jam", fr: "confiture", de: "Marmelade", it: "marmellata", pt: "compota" } },
      { emoji: "🥣", labels: { es: "yogur", en: "yoghurt", fr: "yaourt", de: "Joghurt", it: "yogurt", pt: "iogurte" } },
      { emoji: "🥣", labels: { es: "cereal", en: "cereal", fr: "céréales", de: "Müsli", it: "cereali", pt: "cereais" } },
      { emoji: "🧈", labels: { es: "mantequilla", en: "butter", fr: "beurre", de: "Butter", it: "burro", pt: "manteiga" } },
    ],
  },
  {
    titles: { es: "Tecnología sencilla", en: "Simple technology", fr: "Technologie simple", de: "Einfache Technik", it: "Tecnologia semplice", pt: "Tecnologia simples" },
    prompts: {
      es: "Busca las parejas de aparatos cotidianos.",
      en: "Look for the matching pairs of everyday devices.",
      fr: "Cherchez les paires d'appareils du quotidien.",
      de: "Suche die passenden Paare alltäglicher Geräte.",
      it: "Cerca le coppie di apparecchi quotidiani.",
      pt: "Procure os pares de aparelhos do dia a dia.",
    },
    items: [
      { emoji: "📻", labels: { es: "radio", en: "radio", fr: "radio", de: "Radio", it: "radio", pt: "rádio" } },
      { emoji: "📞", labels: { es: "teléfono", en: "telephone", fr: "téléphone", de: "Telefon", it: "telefono", pt: "telefone" } },
      { emoji: "📺", labels: { es: "televisión", en: "television", fr: "télévision", de: "Fernseher", it: "televisione", pt: "televisão" } },
      { emoji: "🔦", labels: { es: "linterna", en: "torch", fr: "lampe torche", de: "Taschenlampe", it: "torcia", pt: "lanterna" } },
      { emoji: "🎛️", labels: { es: "mando", en: "remote", fr: "télécommande", de: "Fernbedienung", it: "telecomando", pt: "comando" } },
      { emoji: "🎧", labels: { es: "auriculares", en: "headphones", fr: "écouteurs", de: "Kopfhörer", it: "cuffie", pt: "auscultadores" } },
      { emoji: "🔋", labels: { es: "batería", en: "battery", fr: "batterie", de: "Batterie", it: "batteria", pt: "bateria" } },
      { emoji: "📷", labels: { es: "cámara", en: "camera", fr: "appareil photo", de: "Kamera", it: "fotocamera", pt: "câmara" } },
    ],
  },
];

const sequenceTemplates: SequenceTemplate[] = [
  { titles: { es: "Colores del jardín", en: "Garden colours", fr: "Couleurs du jardin", de: "Farben im Garten", it: "Colori del giardino", pt: "Cores do jardim" }, items: ["verde", "amarillo", "rojo", "azul", "blanco", "morado"] },
  { titles: { es: "Pasos de cocina", en: "Cooking steps", fr: "Étapes de cuisine", de: "Kochschritte", it: "Passi in cucina", pt: "Passos na cozinha" }, items: ["lavar", "cortar", "mezclar", "cocinar", "servir", "probar"] },
  { titles: { es: "Objetos del bolso", en: "Bag essentials", fr: "Objets du sac", de: "Tascheninhalte", it: "Oggetti della borsa", pt: "Objetos da mala" }, items: ["llaves", "gafas", "pañuelo", "monedero", "móvil", "agenda"] },
  { titles: { es: "Frutas del desayuno", en: "Breakfast fruit", fr: "Fruits du matin", de: "Früchte zum Frühstück", it: "Frutta a colazione", pt: "Frutas do pequeno-almoço" }, items: ["pera", "manzana", "plátano", "kiwi", "uva", "melón"] },
  { titles: { es: "Sonidos de casa", en: "Sounds at home", fr: "Sons de la maison", de: "Geräusche zu Hause", it: "Suoni di casa", pt: "Sons de casa" }, items: ["timbre", "radio", "agua", "reloj", "puerta", "tetera"] },
  { titles: { es: "Camino al parque", en: "Way to the park", fr: "Chemin du parc", de: "Weg zum Park", it: "Strada per il parco", pt: "Caminho para o parque" }, items: ["portal", "esquina", "banco", "árbol", "fuente", "puente"] },
  { titles: { es: "Recados del día", en: "Daily errands", fr: "Courses du jour", de: "Erledigungen", it: "Commissioni del giorno", pt: "Recados do dia" }, items: ["farmacia", "panadería", "mercado", "banco", "casa", "llamada"] },
  { titles: { es: "Ropa de paseo", en: "Clothes for a walk", fr: "Vêtements de promenade", de: "Kleidung für den Spaziergang", it: "Vestiti per la passeggiata", pt: "Roupa para passear" }, items: ["camisa", "chaqueta", "bufanda", "guantes", "gorra", "zapatos"] },
  { titles: { es: "Estaciones suaves", en: "Gentle seasons", fr: "Saisons douces", de: "Sanfte Jahreszeiten", it: "Stagioni leggere", pt: "Estações suaves" }, items: ["primavera", "verano", "otoño", "invierno", "sol", "lluvia"] },
  { titles: { es: "Rutina de mañana", en: "Morning routine", fr: "Routine du matin", de: "Morgenroutine", it: "Routine del mattino", pt: "Rotina da manhã" }, items: ["despertar", "asearse", "vestirse", "desayunar", "andar", "leer"] },
];

const wordRecallTemplates = [
  ["pan", "leche", "queso", "sopa", "pera", "miel"],
  ["gato", "parque", "libro", "llave", "silla", "flor"],
  ["radio", "ventana", "mesa", "café", "bolso", "reloj"],
  ["mar", "barco", "arena", "toalla", "sol", "sombrero"],
  ["camisa", "zapato", "abrigo", "calcetín", "guante", "bufanda"],
  ["arroz", "tomate", "cebolla", "aceite", "sal", "ajo"],
  ["médico", "cita", "agenda", "taxi", "farmacia", "receta"],
  ["vecino", "perro", "correo", "puerta", "jardín", "timbre"],
  ["televisión", "mando", "sofá", "lámpara", "cojín", "mantita"],
  ["tren", "billete", "andén", "maleta", "asiento", "mapa"],
] as const;

const wordRecallSets: WordRecallSet[] = [
  {
    titles: { es: "Comida de casa", en: "Food at home", fr: "Repas de la maison", de: "Essen zu Hause", it: "Cibo di casa", pt: "Comida de casa" },
    prompts: {
      es: "Palabras de alimentos cotidianos.",
      en: "Everyday food words.",
      fr: "Des mots sur des aliments du quotidien.",
      de: "Alltagliche Worter aus der Kuche.",
      it: "Parole di cibi quotidiani.",
      pt: "Palavras sobre alimentos do dia a dia.",
    },
    words: [
      { labels: { es: "pan", en: "bread", fr: "pain", de: "Brot", it: "pane", pt: "pao" } },
      { labels: { es: "leche", en: "milk", fr: "lait", de: "Milch", it: "latte", pt: "leite" } },
      { labels: { es: "queso", en: "cheese", fr: "fromage", de: "Kase", it: "formaggio", pt: "queijo" } },
      { labels: { es: "sopa", en: "soup", fr: "soupe", de: "Suppe", it: "zuppa", pt: "sopa" } },
      { labels: { es: "pera", en: "pear", fr: "poire", de: "Birne", it: "pera", pt: "pera" } },
      { labels: { es: "miel", en: "honey", fr: "miel", de: "Honig", it: "miele", pt: "mel" } },
    ],
    distractors: [
      { labels: { es: "mesa", en: "table", fr: "table", de: "Tisch", it: "tavolo", pt: "mesa" } },
      { labels: { es: "abrigo", en: "coat", fr: "manteau", de: "Mantel", it: "cappotto", pt: "casaco" } },
      { labels: { es: "perro", en: "dog", fr: "chien", de: "Hund", it: "cane", pt: "cao" } },
      { labels: { es: "puerta", en: "door", fr: "porte", de: "Tur", it: "porta", pt: "porta" } },
      { labels: { es: "reloj", en: "clock", fr: "horloge", de: "Uhr", it: "orologio", pt: "relogio" } },
      { labels: { es: "parque", en: "park", fr: "parc", de: "Park", it: "parco", pt: "parque" } },
      { labels: { es: "sombrero", en: "hat", fr: "chapeau", de: "Hut", it: "cappello", pt: "chapeu" } },
    ],
  },
  {
    titles: { es: "Objetos de casa", en: "Household objects", fr: "Objets de la maison", de: "Haushaltsgegenstande", it: "Oggetti di casa", pt: "Objetos da casa" },
    prompts: {
      es: "Objetos sencillos que vemos en casa.",
      en: "Simple objects we see at home.",
      fr: "Objets simples que l'on voit a la maison.",
      de: "Einfache Gegenstande aus dem Zuhause.",
      it: "Oggetti semplici che vediamo in casa.",
      pt: "Objetos simples que vemos em casa.",
    },
    words: [
      { labels: { es: "llave", en: "key", fr: "cle", de: "Schlussel", it: "chiave", pt: "chave" } },
      { labels: { es: "mesa", en: "table", fr: "table", de: "Tisch", it: "tavolo", pt: "mesa" } },
      { labels: { es: "silla", en: "chair", fr: "chaise", de: "Stuhl", it: "sedia", pt: "cadeira" } },
      { labels: { es: "lampara", en: "lamp", fr: "lampe", de: "Lampe", it: "lampada", pt: "lampada" } },
      { labels: { es: "ventana", en: "window", fr: "fenetre", de: "Fenster", it: "finestra", pt: "janela" } },
      { labels: { es: "cojin", en: "cushion", fr: "coussin", de: "Kissen", it: "cuscino", pt: "almofada" } },
    ],
    distractors: [
      { labels: { es: "pan", en: "bread", fr: "pain", de: "Brot", it: "pane", pt: "pao" } },
      { labels: { es: "gato", en: "cat", fr: "chat", de: "Katze", it: "gatto", pt: "gato" } },
      { labels: { es: "camisa", en: "shirt", fr: "chemise", de: "Hemd", it: "camicia", pt: "camisa" } },
      { labels: { es: "mercado", en: "market", fr: "marche", de: "Markt", it: "mercato", pt: "mercado" } },
      { labels: { es: "tren", en: "train", fr: "train", de: "Zug", it: "treno", pt: "comboio" } },
      { labels: { es: "jardin", en: "garden", fr: "jardin", de: "Garten", it: "giardino", pt: "jardim" } },
      { labels: { es: "medico", en: "doctor", fr: "medecin", de: "Arzt", it: "medico", pt: "medico" } },
    ],
  },
  {
    titles: { es: "Animales cercanos", en: "Familiar animals", fr: "Animaux familiers", de: "Vertraute Tiere", it: "Animali familiari", pt: "Animais familiares" },
    prompts: {
      es: "Animales faciles de reconocer.",
      en: "Animals that are easy to recognise.",
      fr: "Des animaux faciles a reconnaitre.",
      de: "Tiere, die leicht zu erkennen sind.",
      it: "Animali facili da riconoscere.",
      pt: "Animais faceis de reconhecer.",
    },
    words: [
      { labels: { es: "gato", en: "cat", fr: "chat", de: "Katze", it: "gatto", pt: "gato" } },
      { labels: { es: "perro", en: "dog", fr: "chien", de: "Hund", it: "cane", pt: "cao" } },
      { labels: { es: "pajaro", en: "bird", fr: "oiseau", de: "Vogel", it: "uccello", pt: "passaro" } },
      { labels: { es: "pez", en: "fish", fr: "poisson", de: "Fisch", it: "pesce", pt: "peixe" } },
      { labels: { es: "caballo", en: "horse", fr: "cheval", de: "Pferd", it: "cavallo", pt: "cavalo" } },
      { labels: { es: "conejo", en: "rabbit", fr: "lapin", de: "Kaninchen", it: "coniglio", pt: "coelho" } },
    ],
    distractors: [
      { labels: { es: "taza", en: "cup", fr: "tasse", de: "Tasse", it: "tazza", pt: "chavena" } },
      { labels: { es: "pan", en: "bread", fr: "pain", de: "Brot", it: "pane", pt: "pao" } },
      { labels: { es: "bufanda", en: "scarf", fr: "echarpe", de: "Schal", it: "sciarpa", pt: "cachecol" } },
      { labels: { es: "farmacia", en: "pharmacy", fr: "pharmacie", de: "Apotheke", it: "farmacia", pt: "farmacia" } },
      { labels: { es: "almohada", en: "pillow", fr: "oreiller", de: "Kissen", it: "cuscino", pt: "almofada" } },
      { labels: { es: "autobus", en: "bus", fr: "bus", de: "Bus", it: "autobus", pt: "autocarro" } },
      { labels: { es: "libro", en: "book", fr: "livre", de: "Buch", it: "libro", pt: "livro" } },
    ],
  },
  {
    titles: { es: "Ropa de cada dia", en: "Everyday clothes", fr: "Vetements du quotidien", de: "Alltagskleidung", it: "Vestiti di ogni giorno", pt: "Roupa do dia a dia" },
    prompts: {
      es: "Prendas sencillas del armario.",
      en: "Simple clothes from the wardrobe.",
      fr: "Vetements simples de l'armoire.",
      de: "Einfache Kleidungsstucke aus dem Schrank.",
      it: "Capi semplici dell'armadio.",
      pt: "Pecas simples do guarda-roupa.",
    },
    words: [
      { labels: { es: "camisa", en: "shirt", fr: "chemise", de: "Hemd", it: "camicia", pt: "camisa" } },
      { labels: { es: "zapato", en: "shoe", fr: "chaussure", de: "Schuh", it: "scarpa", pt: "sapato" } },
      { labels: { es: "abrigo", en: "coat", fr: "manteau", de: "Mantel", it: "cappotto", pt: "casaco" } },
      { labels: { es: "calcetin", en: "sock", fr: "chaussette", de: "Socke", it: "calzino", pt: "meia" } },
      { labels: { es: "guante", en: "glove", fr: "gant", de: "Handschuh", it: "guanto", pt: "luva" } },
      { labels: { es: "bufanda", en: "scarf", fr: "echarpe", de: "Schal", it: "sciarpa", pt: "cachecol" } },
    ],
    distractors: [
      { labels: { es: "leche", en: "milk", fr: "lait", de: "Milch", it: "latte", pt: "leite" } },
      { labels: { es: "radio", en: "radio", fr: "radio", de: "Radio", it: "radio", pt: "radio" } },
      { labels: { es: "jardin", en: "garden", fr: "jardin", de: "Garten", it: "giardino", pt: "jardim" } },
      { labels: { es: "ventana", en: "window", fr: "fenetre", de: "Fenster", it: "finestra", pt: "janela" } },
      { labels: { es: "gato", en: "cat", fr: "chat", de: "Katze", it: "gatto", pt: "gato" } },
      { labels: { es: "sombrilla", en: "parasol", fr: "parasol", de: "Sonnenschirm", it: "ombrellone", pt: "guarda-sol" } },
      { labels: { es: "tren", en: "train", fr: "train", de: "Zug", it: "treno", pt: "comboio" } },
    ],
  },
  {
    titles: { es: "Rutina de manana", en: "Morning routine", fr: "Routine du matin", de: "Morgenroutine", it: "Routine del mattino", pt: "Rotina da manha" },
    prompts: {
      es: "Acciones de una rutina tranquila.",
      en: "Actions from a calm routine.",
      fr: "Actions d'une routine tranquille.",
      de: "Handlungen aus einer ruhigen Routine.",
      it: "Azioni di una routine tranquilla.",
      pt: "Acoes de uma rotina tranquila.",
    },
    words: [
      { labels: { es: "despertar", en: "wake up", fr: "se reveiller", de: "aufwachen", it: "svegliarsi", pt: "acordar" } },
      { labels: { es: "lavarse", en: "wash", fr: "se laver", de: "waschen", it: "lavarsi", pt: "lavar-se" } },
      { labels: { es: "vestirse", en: "dress", fr: "s'habiller", de: "anziehen", it: "vestirsi", pt: "vestir-se" } },
      { labels: { es: "desayunar", en: "breakfast", fr: "dejeuner", de: "fruhstucken", it: "fare colazione", pt: "tomar o pequeno-almoco" } },
      { labels: { es: "caminar", en: "walk", fr: "marcher", de: "spazieren", it: "camminare", pt: "caminhar" } },
      { labels: { es: "leer", en: "read", fr: "lire", de: "lesen", it: "leggere", pt: "ler" } },
    ],
    distractors: [
      { labels: { es: "queso", en: "cheese", fr: "fromage", de: "Kase", it: "formaggio", pt: "queijo" } },
      { labels: { es: "perro", en: "dog", fr: "chien", de: "Hund", it: "cane", pt: "cao" } },
      { labels: { es: "llave", en: "key", fr: "cle", de: "Schlussel", it: "chiave", pt: "chave" } },
      { labels: { es: "mercado", en: "market", fr: "marche", de: "Markt", it: "mercato", pt: "mercado" } },
      { labels: { es: "abrigo", en: "coat", fr: "manteau", de: "Mantel", it: "cappotto", pt: "casaco" } },
      { labels: { es: "playa", en: "beach", fr: "plage", de: "Strand", it: "spiaggia", pt: "praia" } },
      { labels: { es: "silla", en: "chair", fr: "chaise", de: "Stuhl", it: "sedia", pt: "cadeira" } },
    ],
  },
  {
    titles: { es: "Lugares del barrio", en: "Places in the neighbourhood", fr: "Lieux du quartier", de: "Orte im Viertel", it: "Luoghi del quartiere", pt: "Locais do bairro" },
    prompts: {
      es: "Lugares habituales de un paseo.",
      en: "Common places on a short outing.",
      fr: "Lieux habituels d'une petite sortie.",
      de: "Bekannte Orte auf einem kurzen Weg.",
      it: "Luoghi comuni di una piccola uscita.",
      pt: "Locais habituais de um pequeno passeio.",
    },
    words: [
      { labels: { es: "parque", en: "park", fr: "parc", de: "Park", it: "parco", pt: "parque" } },
      { labels: { es: "farmacia", en: "pharmacy", fr: "pharmacie", de: "Apotheke", it: "farmacia", pt: "farmacia" } },
      { labels: { es: "mercado", en: "market", fr: "marche", de: "Markt", it: "mercato", pt: "mercado" } },
      { labels: { es: "iglesia", en: "church", fr: "eglise", de: "Kirche", it: "chiesa", pt: "igreja" } },
      { labels: { es: "cafeteria", en: "cafe", fr: "cafe", de: "Cafe", it: "caffe", pt: "cafe" } },
      { labels: { es: "plaza", en: "square", fr: "place", de: "Platz", it: "piazza", pt: "praca" } },
    ],
    distractors: [
      { labels: { es: "pan", en: "bread", fr: "pain", de: "Brot", it: "pane", pt: "pao" } },
      { labels: { es: "gato", en: "cat", fr: "chat", de: "Katze", it: "gatto", pt: "gato" } },
      { labels: { es: "camisa", en: "shirt", fr: "chemise", de: "Hemd", it: "camicia", pt: "camisa" } },
      { labels: { es: "llave", en: "key", fr: "cle", de: "Schlussel", it: "chiave", pt: "chave" } },
      { labels: { es: "mantel", en: "tablecloth", fr: "nappe", de: "Tischdecke", it: "tovaglia", pt: "toalha de mesa" } },
      { labels: { es: "barco", en: "boat", fr: "bateau", de: "Boot", it: "barca", pt: "barco" } },
      { labels: { es: "sombrero", en: "hat", fr: "chapeau", de: "Hut", it: "cappello", pt: "chapeu" } },
    ],
  },
  {
    titles: { es: "Recados y visitas", en: "Errands and visits", fr: "Courses et visites", de: "Besorgungen und Besuche", it: "Commissioni e visite", pt: "Recados e visitas" },
    prompts: {
      es: "Palabras de citas y recados.",
      en: "Words linked to appointments and errands.",
      fr: "Mots lies aux rendez-vous et aux courses.",
      de: "Worter rund um Termine und Besorgungen.",
      it: "Parole legate ad appuntamenti e commissioni.",
      pt: "Palavras ligadas a consultas e recados.",
    },
    words: [
      { labels: { es: "medico", en: "doctor", fr: "medecin", de: "Arzt", it: "medico", pt: "medico" } },
      { labels: { es: "cita", en: "appointment", fr: "rendez-vous", de: "Termin", it: "appuntamento", pt: "consulta" } },
      { labels: { es: "agenda", en: "diary", fr: "agenda", de: "Kalender", it: "agenda", pt: "agenda" } },
      { labels: { es: "taxi", en: "taxi", fr: "taxi", de: "Taxi", it: "taxi", pt: "taxi" } },
      { labels: { es: "receta", en: "prescription", fr: "ordonnance", de: "Rezept", it: "ricetta", pt: "receita" } },
      { labels: { es: "tarjeta", en: "card", fr: "carte", de: "Karte", it: "tessera", pt: "cartao" } },
    ],
    distractors: [
      { labels: { es: "pera", en: "pear", fr: "poire", de: "Birne", it: "pera", pt: "pera" } },
      { labels: { es: "ventana", en: "window", fr: "fenetre", de: "Fenster", it: "finestra", pt: "janela" } },
      { labels: { es: "bufanda", en: "scarf", fr: "echarpe", de: "Schal", it: "sciarpa", pt: "cachecol" } },
      { labels: { es: "perro", en: "dog", fr: "chien", de: "Hund", it: "cane", pt: "cao" } },
      { labels: { es: "playa", en: "beach", fr: "plage", de: "Strand", it: "spiaggia", pt: "praia" } },
      { labels: { es: "radio", en: "radio", fr: "radio", de: "Radio", it: "radio", pt: "radio" } },
      { labels: { es: "jardin", en: "garden", fr: "jardin", de: "Garten", it: "giardino", pt: "jardim" } },
    ],
  },
  {
    titles: { es: "Salon tranquilo", en: "Calm living room", fr: "Salon tranquille", de: "Ruhiges Wohnzimmer", it: "Soggiorno tranquillo", pt: "Sala tranquila" },
    prompts: {
      es: "Objetos de una tarde en casa.",
      en: "Objects from a calm afternoon at home.",
      fr: "Objets d'un apres-midi tranquille a la maison.",
      de: "Gegenstande aus einem ruhigen Nachmittag zu Hause.",
      it: "Oggetti di un pomeriggio tranquillo in casa.",
      pt: "Objetos de uma tarde tranquila em casa.",
    },
    words: [
      { labels: { es: "television", en: "television", fr: "television", de: "Fernseher", it: "televisione", pt: "televisao" } },
      { labels: { es: "mando", en: "remote", fr: "telecommande", de: "Fernbedienung", it: "telecomando", pt: "comando" } },
      { labels: { es: "sofa", en: "sofa", fr: "canape", de: "Sofa", it: "divano", pt: "sofa" } },
      { labels: { es: "lampara", en: "lamp", fr: "lampe", de: "Lampe", it: "lampada", pt: "lampada" } },
      { labels: { es: "cojin", en: "cushion", fr: "coussin", de: "Kissen", it: "cuscino", pt: "almofada" } },
      { labels: { es: "manta", en: "blanket", fr: "couverture", de: "Decke", it: "coperta", pt: "manta" } },
    ],
    distractors: [
      { labels: { es: "mercado", en: "market", fr: "marche", de: "Markt", it: "mercato", pt: "mercado" } },
      { labels: { es: "queso", en: "cheese", fr: "fromage", de: "Kase", it: "formaggio", pt: "queijo" } },
      { labels: { es: "camisa", en: "shirt", fr: "chemise", de: "Hemd", it: "camicia", pt: "camisa" } },
      { labels: { es: "caballo", en: "horse", fr: "cheval", de: "Pferd", it: "cavallo", pt: "cavalo" } },
      { labels: { es: "billete", en: "ticket", fr: "billet", de: "Fahrkarte", it: "biglietto", pt: "bilhete" } },
      { labels: { es: "plaza", en: "square", fr: "place", de: "Platz", it: "piazza", pt: "praca" } },
      { labels: { es: "jabon", en: "soap", fr: "savon", de: "Seife", it: "sapone", pt: "sabao" } },
    ],
  },
  {
    titles: { es: "Viaje sencillo", en: "Simple trip", fr: "Petit voyage", de: "Einfache Reise", it: "Viaggio semplice", pt: "Viagem simples" },
    prompts: {
      es: "Palabras de un trayecto facil.",
      en: "Words from a simple journey.",
      fr: "Mots d'un trajet simple.",
      de: "Worter von einer einfachen Fahrt.",
      it: "Parole di un tragitto semplice.",
      pt: "Palavras de um trajeto simples.",
    },
    words: [
      { labels: { es: "tren", en: "train", fr: "train", de: "Zug", it: "treno", pt: "comboio" } },
      { labels: { es: "billete", en: "ticket", fr: "billet", de: "Fahrkarte", it: "biglietto", pt: "bilhete" } },
      { labels: { es: "anden", en: "platform", fr: "quai", de: "Bahnsteig", it: "binario", pt: "plataforma" } },
      { labels: { es: "maleta", en: "suitcase", fr: "valise", de: "Koffer", it: "valigia", pt: "mala" } },
      { labels: { es: "asiento", en: "seat", fr: "siege", de: "Sitz", it: "posto", pt: "lugar" } },
      { labels: { es: "mapa", en: "map", fr: "carte", de: "Karte", it: "mappa", pt: "mapa" } },
    ],
    distractors: [
      { labels: { es: "leche", en: "milk", fr: "lait", de: "Milch", it: "latte", pt: "leite" } },
      { labels: { es: "cojin", en: "cushion", fr: "coussin", de: "Kissen", it: "cuscino", pt: "almofada" } },
      { labels: { es: "gato", en: "cat", fr: "chat", de: "Katze", it: "gatto", pt: "gato" } },
      { labels: { es: "abrigo", en: "coat", fr: "manteau", de: "Mantel", it: "cappotto", pt: "casaco" } },
      { labels: { es: "farmacia", en: "pharmacy", fr: "pharmacie", de: "Apotheke", it: "farmacia", pt: "farmacia" } },
      { labels: { es: "pan", en: "bread", fr: "pain", de: "Brot", it: "pane", pt: "pao" } },
      { labels: { es: "reloj", en: "clock", fr: "horloge", de: "Uhr", it: "orologio", pt: "relogio" } },
    ],
  },
  {
    titles: { es: "Jardin y terraza", en: "Garden and terrace", fr: "Jardin et terrasse", de: "Garten und Terrasse", it: "Giardino e terrazza", pt: "Jardim e terraco" },
    prompts: {
      es: "Palabras de plantas y aire libre.",
      en: "Words about plants and fresh air.",
      fr: "Mots sur les plantes et l'air libre.",
      de: "Worter rund um Pflanzen und frische Luft.",
      it: "Parole su piante e aria aperta.",
      pt: "Palavras sobre plantas e ar livre.",
    },
    words: [
      { labels: { es: "flor", en: "flower", fr: "fleur", de: "Blume", it: "fiore", pt: "flor" } },
      { labels: { es: "planta", en: "plant", fr: "plante", de: "Pflanze", it: "pianta", pt: "planta" } },
      { labels: { es: "maceta", en: "pot", fr: "pot", de: "Topf", it: "vaso", pt: "vaso" } },
      { labels: { es: "regadera", en: "watering can", fr: "arrosoir", de: "Giesskanne", it: "annaffiatoio", pt: "regador" } },
      { labels: { es: "hoja", en: "leaf", fr: "feuille", de: "Blatt", it: "foglia", pt: "folha" } },
      { labels: { es: "banco", en: "bench", fr: "banc", de: "Bank", it: "panchina", pt: "banco" } },
    ],
    distractors: [
      { labels: { es: "telefono", en: "telephone", fr: "telephone", de: "Telefon", it: "telefono", pt: "telefone" } },
      { labels: { es: "camisa", en: "shirt", fr: "chemise", de: "Hemd", it: "camicia", pt: "camisa" } },
      { labels: { es: "sopa", en: "soup", fr: "soupe", de: "Suppe", it: "zuppa", pt: "sopa" } },
      { labels: { es: "farmacia", en: "pharmacy", fr: "pharmacie", de: "Apotheke", it: "farmacia", pt: "farmacia" } },
      { labels: { es: "tren", en: "train", fr: "train", de: "Zug", it: "treno", pt: "comboio" } },
      { labels: { es: "calcetin", en: "sock", fr: "chaussette", de: "Socke", it: "calzino", pt: "meia" } },
      { labels: { es: "agenda", en: "diary", fr: "agenda", de: "Kalender", it: "agenda", pt: "agenda" } },
    ],
  },
];

const routineTemplates: RoutineTemplate[] = [
  { title: "Mañana tranquila", activities: ["despertarse", "lavarse la cara", "desayunar", "salir a caminar", "leer el periódico"] },
  { title: "Visita al médico", activities: ["desayunar", "tomar medicación", "coger la tarjeta", "ir a la consulta", "volver a casa"] },
  { title: "Tarde de recados", activities: ["hacer lista", "salir al mercado", "comprar pan", "pasar por farmacia", "guardar compras"] },
  { title: "Día de lavandería", activities: ["separar ropa", "poner lavadora", "tender", "doblar", "guardar armario"] },
  { title: "Rutina de noche", activities: ["cenar", "preparar pastillero", "poner alarma", "lavarse dientes", "acostarse"] },
  { title: "Riego de plantas", activities: ["llenar regadera", "regar salón", "regar balcón", "limpiar hojas", "guardar regadera"] },
  { title: "Preparar visita", activities: ["ordenar salón", "poner café", "sacar galletas", "abrir puerta", "charlar"] },
  { title: "Comprar ingredientes", activities: ["revisar nevera", "anotar faltas", "ir a tienda", "pagar", "guardar ticket"] },
  { title: "Paseo con paraguas", activities: ["mirar tiempo", "ponerse abrigo", "coger paraguas", "cerrar puerta", "salir"] },
  { title: "Merienda en casa", activities: ["poner mantel", "servir té", "cortar fruta", "sentarse", "recoger mesa"] },
];

const storyTemplates: StoryTemplate[] = [
  {
    es: {
      title: "El paseo de Ana",
      story: "Ana salio por la manana con su bolso azul, compro pan en la esquina y despues se sento en un banco del parque.",
      keyFacts: [
        "Ana salio por la manana.",
        "Ana llevaba un bolso azul.",
        "Ana compro pan en la esquina.",
        "Ana se sento en un banco del parque.",
      ],
      choiceQuestions: [
        { prompt: "Que compro Ana?", options: ["Pan", "Leche", "Flores"], answerIndex: 0 },
        { prompt: "De que color era el bolso?", options: ["Azul", "Rojo", "Verde"], answerIndex: 0 },
        { prompt: "Donde se sento Ana?", options: ["En un banco del parque", "En una cafeteria", "En el autobus"], answerIndex: 0 },
        { prompt: "Cuando salio Ana?", options: ["Por la manana", "Por la noche", "Al mediodia"], answerIndex: 0 },
      ],
    },
    en: {
      title: "Ana's walk",
      story: "Ana went out in the morning with her blue bag, bought bread on the corner, and then sat on a bench in the park.",
      keyFacts: [
        "Ana went out in the morning.",
        "Ana carried a blue bag.",
        "Ana bought bread on the corner.",
        "Ana sat on a bench in the park.",
      ],
      choiceQuestions: [
        { prompt: "What did Ana buy?", options: ["Bread", "Milk", "Flowers"], answerIndex: 0 },
        { prompt: "What colour was the bag?", options: ["Blue", "Red", "Green"], answerIndex: 0 },
        { prompt: "Where did Ana sit?", options: ["On a park bench", "In a cafe", "On the bus"], answerIndex: 0 },
        { prompt: "When did Ana go out?", options: ["In the morning", "At night", "At midday"], answerIndex: 0 },
      ],
    },
    fr: {
      title: "La promenade d'Ana",
      story: "Ana est sortie le matin avec son sac bleu, a achete du pain au coin de la rue, puis s'est assise sur un banc du parc.",
      keyFacts: [
        "Ana est sortie le matin.",
        "Ana portait un sac bleu.",
        "Ana a achete du pain au coin de la rue.",
        "Ana s'est assise sur un banc du parc.",
      ],
      choiceQuestions: [
        { prompt: "Qu'a achete Ana?", options: ["Du pain", "Du lait", "Des fleurs"], answerIndex: 0 },
        { prompt: "De quelle couleur etait le sac?", options: ["Bleu", "Rouge", "Vert"], answerIndex: 0 },
        { prompt: "Ou Ana s'est-elle assise?", options: ["Sur un banc du parc", "Dans un cafe", "Dans le bus"], answerIndex: 0 },
        { prompt: "Quand Ana est-elle sortie?", options: ["Le matin", "Le soir", "A midi"], answerIndex: 0 },
      ],
    },
    de: {
      title: "Anas Spaziergang",
      story: "Ana ging am Morgen mit ihrer blauen Tasche hinaus, kaufte Brot an der Ecke und setzte sich danach auf eine Bank im Park.",
      keyFacts: [
        "Ana ging am Morgen hinaus.",
        "Ana trug eine blaue Tasche.",
        "Ana kaufte Brot an der Ecke.",
        "Ana setzte sich auf eine Bank im Park.",
      ],
      choiceQuestions: [
        { prompt: "Was kaufte Ana?", options: ["Brot", "Milch", "Blumen"], answerIndex: 0 },
        { prompt: "Welche Farbe hatte die Tasche?", options: ["Blau", "Rot", "Grun"], answerIndex: 0 },
        { prompt: "Wo setzte sich Ana hin?", options: ["Auf eine Bank im Park", "In ein Cafe", "In den Bus"], answerIndex: 0 },
        { prompt: "Wann ging Ana hinaus?", options: ["Am Morgen", "Am Abend", "Mittags"], answerIndex: 0 },
      ],
    },
    it: {
      title: "La passeggiata di Ana",
      story: "Ana e uscita la mattina con la borsa blu, ha comprato il pane all'angolo e poi si e seduta su una panchina del parco.",
      keyFacts: [
        "Ana e uscita la mattina.",
        "Ana aveva una borsa blu.",
        "Ana ha comprato il pane all'angolo.",
        "Ana si e seduta su una panchina del parco.",
      ],
      choiceQuestions: [
        { prompt: "Che cosa ha comprato Ana?", options: ["Pane", "Latte", "Fiori"], answerIndex: 0 },
        { prompt: "Di che colore era la borsa?", options: ["Blu", "Rossa", "Verde"], answerIndex: 0 },
        { prompt: "Dove si e seduta Ana?", options: ["Su una panchina del parco", "In un bar", "Sull'autobus"], answerIndex: 0 },
        { prompt: "Quando e uscita Ana?", options: ["La mattina", "La sera", "A mezzogiorno"], answerIndex: 0 },
      ],
    },
    pt: {
      title: "O passeio da Ana",
      story: "Ana saiu de manha com a sua mala azul, comprou pao na esquina e depois sentou-se num banco do parque.",
      keyFacts: [
        "Ana saiu de manha.",
        "Ana levava uma mala azul.",
        "Ana comprou pao na esquina.",
        "Ana sentou-se num banco do parque.",
      ],
      choiceQuestions: [
        { prompt: "O que comprou Ana?", options: ["Pao", "Leite", "Flores"], answerIndex: 0 },
        { prompt: "De que cor era a mala?", options: ["Azul", "Vermelha", "Verde"], answerIndex: 0 },
        { prompt: "Onde se sentou Ana?", options: ["Num banco do parque", "Num cafe", "No autocarro"], answerIndex: 0 },
        { prompt: "Quando saiu Ana?", options: ["De manha", "A noite", "Ao meio-dia"], answerIndex: 0 },
      ],
    },
  },
  {
    es: {
      title: "La llamada de Luis",
      story: "Luis llamo a su hermana despues de comer, apunto una cita en su agenda y dejo las llaves junto a la radio.",
      keyFacts: [
        "Luis llamo a su hermana despues de comer.",
        "Luis apunto una cita en su agenda.",
        "Luis dejo las llaves junto a la radio.",
        "La llamada fue despues de comer.",
      ],
      choiceQuestions: [
        { prompt: "A quien llamo Luis?", options: ["A su hermana", "A su vecino", "A su medico"], answerIndex: 0 },
        { prompt: "Donde apunto la cita?", options: ["En su agenda", "En una servilleta", "En el calendario de pared"], answerIndex: 0 },
        { prompt: "Donde dejo las llaves?", options: ["Junto a la radio", "En el abrigo", "En la cocina"], answerIndex: 0 },
        { prompt: "Cuando hizo la llamada?", options: ["Despues de comer", "Antes de desayunar", "Al acostarse"], answerIndex: 0 },
      ],
    },
    en: {
      title: "Luis's call",
      story: "Luis called his sister after lunch, wrote an appointment in his diary, and left the keys next to the radio.",
      keyFacts: [
        "Luis called his sister after lunch.",
        "Luis wrote an appointment in his diary.",
        "Luis left the keys next to the radio.",
        "The call happened after lunch.",
      ],
      choiceQuestions: [
        { prompt: "Who did Luis call?", options: ["His sister", "His neighbour", "His doctor"], answerIndex: 0 },
        { prompt: "Where did he write the appointment?", options: ["In his diary", "On a napkin", "On the wall calendar"], answerIndex: 0 },
        { prompt: "Where did he leave the keys?", options: ["Next to the radio", "In his coat", "In the kitchen"], answerIndex: 0 },
        { prompt: "When did he make the call?", options: ["After lunch", "Before breakfast", "At bedtime"], answerIndex: 0 },
      ],
    },
    fr: {
      title: "L'appel de Luis",
      story: "Luis a appele sa soeur apres le repas, a note un rendez-vous dans son agenda et a laisse les cles pres de la radio.",
      keyFacts: [
        "Luis a appele sa soeur apres le repas.",
        "Luis a note un rendez-vous dans son agenda.",
        "Luis a laisse les cles pres de la radio.",
        "L'appel a eu lieu apres le repas.",
      ],
      choiceQuestions: [
        { prompt: "Qui Luis a-t-il appele?", options: ["Sa soeur", "Son voisin", "Son medecin"], answerIndex: 0 },
        { prompt: "Ou a-t-il note le rendez-vous?", options: ["Dans son agenda", "Sur une serviette", "Sur le calendrier mural"], answerIndex: 0 },
        { prompt: "Ou a-t-il laisse les cles?", options: ["Pres de la radio", "Dans son manteau", "Dans la cuisine"], answerIndex: 0 },
        { prompt: "Quand a-t-il appele?", options: ["Apres le repas", "Avant le petit-dejeuner", "Au coucher"], answerIndex: 0 },
      ],
    },
    de: {
      title: "Luis ruft an",
      story: "Luis rief nach dem Essen seine Schwester an, schrieb einen Termin in seinen Kalender und legte die Schlussel neben das Radio.",
      keyFacts: [
        "Luis rief nach dem Essen seine Schwester an.",
        "Luis schrieb einen Termin in seinen Kalender.",
        "Luis legte die Schlussel neben das Radio.",
        "Der Anruf war nach dem Essen.",
      ],
      choiceQuestions: [
        { prompt: "Wen rief Luis an?", options: ["Seine Schwester", "Seinen Nachbarn", "Seinen Arzt"], answerIndex: 0 },
        { prompt: "Wo schrieb er den Termin auf?", options: ["In seinen Kalender", "Auf eine Serviette", "Auf den Wandkalender"], answerIndex: 0 },
        { prompt: "Wo legte er die Schlussel hin?", options: ["Neben das Radio", "In den Mantel", "In die Kuche"], answerIndex: 0 },
        { prompt: "Wann rief er an?", options: ["Nach dem Essen", "Vor dem Fruhstuck", "Vor dem Schlafen"], answerIndex: 0 },
      ],
    },
    it: {
      title: "La telefonata di Luis",
      story: "Luis ha chiamato sua sorella dopo pranzo, ha segnato un appuntamento sull'agenda e ha lasciato le chiavi accanto alla radio.",
      keyFacts: [
        "Luis ha chiamato sua sorella dopo pranzo.",
        "Luis ha segnato un appuntamento sull'agenda.",
        "Luis ha lasciato le chiavi accanto alla radio.",
        "La telefonata e stata dopo pranzo.",
      ],
      choiceQuestions: [
        { prompt: "Chi ha chiamato Luis?", options: ["Sua sorella", "Il vicino", "Il medico"], answerIndex: 0 },
        { prompt: "Dove ha segnato l'appuntamento?", options: ["Sull'agenda", "Su un tovagliolo", "Sul calendario"], answerIndex: 0 },
        { prompt: "Dove ha lasciato le chiavi?", options: ["Accanto alla radio", "Nel cappotto", "In cucina"], answerIndex: 0 },
        { prompt: "Quando ha telefonato?", options: ["Dopo pranzo", "Prima di colazione", "Prima di dormire"], answerIndex: 0 },
      ],
    },
    pt: {
      title: "A chamada do Luis",
      story: "Luis telefonou a irma depois do almoco, apontou uma consulta na agenda e deixou as chaves junto ao radio.",
      keyFacts: [
        "Luis telefonou a irma depois do almoco.",
        "Luis apontou uma consulta na agenda.",
        "Luis deixou as chaves junto ao radio.",
        "A chamada foi depois do almoco.",
      ],
      choiceQuestions: [
        { prompt: "A quem telefonou Luis?", options: ["A irma", "Ao vizinho", "Ao medico"], answerIndex: 0 },
        { prompt: "Onde apontou a consulta?", options: ["Na agenda", "Num guardanapo", "No calendario"], answerIndex: 0 },
        { prompt: "Onde deixou as chaves?", options: ["Junto ao radio", "No casaco", "Na cozinha"], answerIndex: 0 },
        { prompt: "Quando telefonou?", options: ["Depois do almoco", "Antes do pequeno-almoco", "Ao deitar"], answerIndex: 0 },
      ],
    },
  },
  {
    es: {
      title: "Compra en el mercado",
      story: "Marta fue al mercado con una bolsa de tela, eligio tomates y queso fresco, y regreso a casa antes de que empezara a llover.",
      keyFacts: [
        "Marta fue al mercado.",
        "Marta llevaba una bolsa de tela.",
        "Marta eligio tomates y queso fresco.",
        "Marta regreso antes de que empezara a llover.",
      ],
      choiceQuestions: [
        { prompt: "A donde fue Marta?", options: ["Al mercado", "A la farmacia", "Al parque"], answerIndex: 0 },
        { prompt: "Que llevaba Marta?", options: ["Una bolsa de tela", "Un paraguas rojo", "Un libro"], answerIndex: 0 },
        { prompt: "Que compro Marta?", options: ["Tomates y queso fresco", "Pan y leche", "Manzanas y arroz"], answerIndex: 0 },
        { prompt: "Cuando volvio a casa?", options: ["Antes de la lluvia", "De madrugada", "Despues de cenar"], answerIndex: 0 },
      ],
    },
    en: {
      title: "Shopping at the market",
      story: "Marta went to the market with a cloth bag, chose tomatoes and fresh cheese, and returned home before it started to rain.",
      keyFacts: [
        "Marta went to the market.",
        "Marta carried a cloth bag.",
        "Marta chose tomatoes and fresh cheese.",
        "Marta returned before it started to rain.",
      ],
      choiceQuestions: [
        { prompt: "Where did Marta go?", options: ["To the market", "To the pharmacy", "To the park"], answerIndex: 0 },
        { prompt: "What did Marta carry?", options: ["A cloth bag", "A red umbrella", "A book"], answerIndex: 0 },
        { prompt: "What did Marta choose?", options: ["Tomatoes and fresh cheese", "Bread and milk", "Apples and rice"], answerIndex: 0 },
        { prompt: "When did she return home?", options: ["Before the rain", "At dawn", "After dinner"], answerIndex: 0 },
      ],
    },
    fr: {
      title: "Courses au marche",
      story: "Marta est allee au marche avec un sac en tissu, a choisi des tomates et du fromage frais, puis est rentree avant la pluie.",
      keyFacts: [
        "Marta est allee au marche.",
        "Marta portait un sac en tissu.",
        "Marta a choisi des tomates et du fromage frais.",
        "Marta est rentree avant la pluie.",
      ],
      choiceQuestions: [
        { prompt: "Ou Marta est-elle allee?", options: ["Au marche", "A la pharmacie", "Au parc"], answerIndex: 0 },
        { prompt: "Que portait Marta?", options: ["Un sac en tissu", "Un parapluie rouge", "Un livre"], answerIndex: 0 },
        { prompt: "Qu'a choisi Marta?", options: ["Des tomates et du fromage frais", "Du pain et du lait", "Des pommes et du riz"], answerIndex: 0 },
        { prompt: "Quand est-elle rentree?", options: ["Avant la pluie", "A l'aube", "Apres le diner"], answerIndex: 0 },
      ],
    },
    de: {
      title: "Einkauf auf dem Markt",
      story: "Marta ging mit einer Stofftasche zum Markt, suchte Tomaten und Frischkase aus und kam nach Hause, bevor es regnete.",
      keyFacts: [
        "Marta ging zum Markt.",
        "Marta trug eine Stofftasche.",
        "Marta suchte Tomaten und Frischkase aus.",
        "Marta kam zuruck, bevor es regnete.",
      ],
      choiceQuestions: [
        { prompt: "Wohin ging Marta?", options: ["Zum Markt", "Zur Apotheke", "In den Park"], answerIndex: 0 },
        { prompt: "Was trug Marta?", options: ["Eine Stofftasche", "Einen roten Regenschirm", "Ein Buch"], answerIndex: 0 },
        { prompt: "Was suchte Marta aus?", options: ["Tomaten und Frischkase", "Brot und Milch", "Apfel und Reis"], answerIndex: 0 },
        { prompt: "Wann kam sie nach Hause?", options: ["Vor dem Regen", "Bei Tagesanbruch", "Nach dem Abendessen"], answerIndex: 0 },
      ],
    },
    it: {
      title: "Spesa al mercato",
      story: "Marta e andata al mercato con una borsa di stoffa, ha scelto pomodori e formaggio fresco ed e tornata a casa prima della pioggia.",
      keyFacts: [
        "Marta e andata al mercato.",
        "Marta aveva una borsa di stoffa.",
        "Marta ha scelto pomodori e formaggio fresco.",
        "Marta e tornata prima della pioggia.",
      ],
      choiceQuestions: [
        { prompt: "Dove e andata Marta?", options: ["Al mercato", "In farmacia", "Al parco"], answerIndex: 0 },
        { prompt: "Che cosa aveva Marta?", options: ["Una borsa di stoffa", "Un ombrello rosso", "Un libro"], answerIndex: 0 },
        { prompt: "Che cosa ha scelto Marta?", options: ["Pomodori e formaggio fresco", "Pane e latte", "Mele e riso"], answerIndex: 0 },
        { prompt: "Quando e tornata a casa?", options: ["Prima della pioggia", "All'alba", "Dopo cena"], answerIndex: 0 },
      ],
    },
    pt: {
      title: "Compras no mercado",
      story: "Marta foi ao mercado com um saco de pano, escolheu tomates e queijo fresco e voltou para casa antes de comecar a chover.",
      keyFacts: [
        "Marta foi ao mercado.",
        "Marta levava um saco de pano.",
        "Marta escolheu tomates e queijo fresco.",
        "Marta voltou antes de comecar a chover.",
      ],
      choiceQuestions: [
        { prompt: "Onde foi Marta?", options: ["Ao mercado", "A farmacia", "Ao parque"], answerIndex: 0 },
        { prompt: "O que levava Marta?", options: ["Um saco de pano", "Um guarda-chuva vermelho", "Um livro"], answerIndex: 0 },
        { prompt: "O que escolheu Marta?", options: ["Tomates e queijo fresco", "Pao e leite", "Macas e arroz"], answerIndex: 0 },
        { prompt: "Quando voltou para casa?", options: ["Antes da chuva", "De madrugada", "Depois do jantar"], answerIndex: 0 },
      ],
    },
  },
  {
    es: {
      title: "Un domingo tranquilo",
      story: "Sonia rego las plantas del balcon, escucho musica suave y llamo a su nieta al terminar la tarde.",
      keyFacts: [
        "Sonia rego las plantas del balcon.",
        "Sonia escucho musica suave.",
        "Sonia llamo a su nieta.",
        "Sonia llamo al terminar la tarde.",
      ],
      choiceQuestions: [
        { prompt: "Que rego Sonia?", options: ["Las plantas del balcon", "El jardin del vecino", "La cocina"], answerIndex: 0 },
        { prompt: "Que escucho Sonia?", options: ["Musica suave", "Noticias fuertes", "Un partido"], answerIndex: 0 },
        { prompt: "A quien llamo Sonia?", options: ["A su nieta", "A su hermana", "Al medico"], answerIndex: 0 },
        { prompt: "Cuando llamo Sonia?", options: ["Al terminar la tarde", "Por la manana", "Antes de comer"], answerIndex: 0 },
      ],
    },
    en: {
      title: "A quiet Sunday",
      story: "Sonia watered the balcony plants, listened to gentle music, and called her granddaughter at the end of the afternoon.",
      keyFacts: [
        "Sonia watered the balcony plants.",
        "Sonia listened to gentle music.",
        "Sonia called her granddaughter.",
        "Sonia called at the end of the afternoon.",
      ],
      choiceQuestions: [
        { prompt: "What did Sonia water?", options: ["The balcony plants", "The neighbour's garden", "The kitchen"], answerIndex: 0 },
        { prompt: "What did Sonia listen to?", options: ["Gentle music", "Loud news", "A match"], answerIndex: 0 },
        { prompt: "Who did Sonia call?", options: ["Her granddaughter", "Her sister", "The doctor"], answerIndex: 0 },
        { prompt: "When did Sonia call?", options: ["At the end of the afternoon", "In the morning", "Before lunch"], answerIndex: 0 },
      ],
    },
    fr: {
      title: "Un dimanche calme",
      story: "Sonia a arrose les plantes du balcon, a ecoute de la musique douce et a appele sa petite-fille en fin d'apres-midi.",
      keyFacts: [
        "Sonia a arrose les plantes du balcon.",
        "Sonia a ecoute de la musique douce.",
        "Sonia a appele sa petite-fille.",
        "Sonia a appele en fin d'apres-midi.",
      ],
      choiceQuestions: [
        { prompt: "Qu'a arrose Sonia?", options: ["Les plantes du balcon", "Le jardin du voisin", "La cuisine"], answerIndex: 0 },
        { prompt: "Qu'a ecoute Sonia?", options: ["De la musique douce", "Des nouvelles fortes", "Un match"], answerIndex: 0 },
        { prompt: "Qui Sonia a-t-elle appele?", options: ["Sa petite-fille", "Sa soeur", "Le medecin"], answerIndex: 0 },
        { prompt: "Quand Sonia a-t-elle appele?", options: ["En fin d'apres-midi", "Le matin", "Avant le repas"], answerIndex: 0 },
      ],
    },
    de: {
      title: "Ein ruhiger Sonntag",
      story: "Sonia goss die Pflanzen auf dem Balkon, horte leise Musik und rief am Ende des Nachmittags ihre Enkelin an.",
      keyFacts: [
        "Sonia goss die Pflanzen auf dem Balkon.",
        "Sonia horte leise Musik.",
        "Sonia rief ihre Enkelin an.",
        "Sonia rief am Ende des Nachmittags an.",
      ],
      choiceQuestions: [
        { prompt: "Was goss Sonia?", options: ["Die Pflanzen auf dem Balkon", "Den Garten des Nachbarn", "Die Kuche"], answerIndex: 0 },
        { prompt: "Was horte Sonia?", options: ["Leise Musik", "Laute Nachrichten", "Ein Spiel"], answerIndex: 0 },
        { prompt: "Wen rief Sonia an?", options: ["Ihre Enkelin", "Ihre Schwester", "Den Arzt"], answerIndex: 0 },
        { prompt: "Wann rief Sonia an?", options: ["Am Ende des Nachmittags", "Am Morgen", "Vor dem Essen"], answerIndex: 0 },
      ],
    },
    it: {
      title: "Una domenica tranquilla",
      story: "Sonia ha annaffiato le piante del balcone, ha ascoltato musica dolce e ha chiamato la nipote alla fine del pomeriggio.",
      keyFacts: [
        "Sonia ha annaffiato le piante del balcone.",
        "Sonia ha ascoltato musica dolce.",
        "Sonia ha chiamato la nipote.",
        "Sonia ha chiamato alla fine del pomeriggio.",
      ],
      choiceQuestions: [
        { prompt: "Che cosa ha annaffiato Sonia?", options: ["Le piante del balcone", "Il giardino del vicino", "La cucina"], answerIndex: 0 },
        { prompt: "Che cosa ha ascoltato Sonia?", options: ["Musica dolce", "Notizie forti", "Una partita"], answerIndex: 0 },
        { prompt: "Chi ha chiamato Sonia?", options: ["La nipote", "La sorella", "Il medico"], answerIndex: 0 },
        { prompt: "Quando ha chiamato Sonia?", options: ["Alla fine del pomeriggio", "La mattina", "Prima di pranzo"], answerIndex: 0 },
      ],
    },
    pt: {
      title: "Um domingo tranquilo",
      story: "Sonia regou as plantas da varanda, ouviu musica suave e telefonou a neta ao fim da tarde.",
      keyFacts: [
        "Sonia regou as plantas da varanda.",
        "Sonia ouviu musica suave.",
        "Sonia telefonou a neta.",
        "Sonia telefonou ao fim da tarde.",
      ],
      choiceQuestions: [
        { prompt: "O que regou Sonia?", options: ["As plantas da varanda", "O jardim do vizinho", "A cozinha"], answerIndex: 0 },
        { prompt: "O que ouviu Sonia?", options: ["Musica suave", "Noticias altas", "Um jogo"], answerIndex: 0 },
        { prompt: "A quem telefonou Sonia?", options: ["A neta", "A irma", "Ao medico"], answerIndex: 0 },
        { prompt: "Quando telefonou Sonia?", options: ["Ao fim da tarde", "De manha", "Antes do almoco"], answerIndex: 0 },
      ],
    },
  },
];

const sequenceLevels = buildSequenceLevels(sequenceTemplates);

const wordRecallLevels = buildListLevels(
  "word_recall",
  [
    { level: 1, count: 3, prompt: "Memoriza 3 palabras sencillas." },
    { level: 2, count: 4, prompt: "Memoriza 4 palabras sencillas." },
    { level: 3, count: 5, prompt: "Memoriza 5 palabras sencillas." },
    { level: 4, count: 6, prompt: "Memoriza las palabras, realiza una pausa breve y luego recuérdalas." },
    { level: 5, count: 6, prompt: "Memoriza ahora y recuerda las palabras después de unos momentos." },
  ],
  wordRecallTemplates,
  "Palabras",
);

const wordRecallPlayableLevels = buildWordRecallLevels(wordRecallSets);
const numberMemoryLevels = buildNumberMemoryLevels();
const routineLevels = buildRoutineLevels(routineTemplates);
const associationLevels = buildConnectionsLevels();
const storyLevels = buildStoryLevels(storyTemplates);
const memoryMatchLevels = buildMemoryMatchLevels(memoryMatchSets);

export const MEMORY_GAME_ORDER: MemoryGameType[] = [
  "memory_match",
  "association_memory",
  "word_recall",
  "story_recall",
  "number_memory",
];

export const memoryGameRegistry: Record<MemoryGameType, MemoryGameDefinition> = {
  memory_match: createDefinition("memory_match", "memoryGames.memoryMatch.title", "memoryGames.memoryMatch.description", "visual_memory", "#6B21A8", "#F5F3FF", memoryMatchLevels),
  sequence_memory: createDefinition("sequence_memory", "memoryGames.sequenceMemory.title", "memoryGames.sequenceMemory.description", "attention", "#0F766E", "#ECFEFF", sequenceLevels),
  word_recall: createDefinition("word_recall", "memoryGames.wordRecall.title", "memoryGames.wordRecall.description", "episodic_memory", "#B45309", "#FFF7ED", wordRecallPlayableLevels),
  number_memory: createDefinition("number_memory", "memoryGames.numberMemory.title", "memoryGames.numberMemory.description", "working_memory", "#2563EB", "#EFF6FF", numberMemoryLevels),
  routine_memory: createDefinition("routine_memory", "memoryGames.routineMemory.title", "memoryGames.routineMemory.description", "executive_function", "#0A7C4E", "#ECFDF5", routineLevels),
  association_memory: createDefinition("association_memory", "memoryGames.associationMemory.title", "memoryGames.associationMemory.description", "associative_memory", "#BE185D", "#FFF1F2", associationLevels),
  story_recall: createDefinition("story_recall", "memoryGames.storyRecall.title", "memoryGames.storyRecall.description", "language", "#92400E", "#FEF3C7", storyLevels),
};

export function getGameDefinition(gameType: MemoryGameType) {
  return memoryGameRegistry[gameType];
}

export function getGameLevel(gameType: MemoryGameType, level: number) {
  return memoryGameRegistry[gameType].levels.find((entry) => entry.level === level) ?? memoryGameRegistry[gameType].levels[0];
}

export function getVariantContent(variant: MemoryGameVariant, language: LanguageCode) {
  return variant.content[language] ?? variant.content.en ?? variant.content.es;
}

export function getGameTitle(gameType: MemoryGameType, language: LanguageCode) {
  const definition = getGameDefinition(gameType);
  return translate(language, definition.titleKey);
}

export function getGameDescription(gameType: MemoryGameType, language: LanguageCode) {
  const definition = getGameDefinition(gameType);
  return translate(language, definition.descriptionKey);
}

export function getCognitiveDomainLabel(domain: CognitiveDomain, language: LanguageCode) {
  return translate(language, `cognitiveDomains.${domain}`);
}
