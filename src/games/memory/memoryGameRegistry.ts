import { translate } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";
import type {
  CognitiveDomain,
  MemoryGameDefinition,
  MemoryGameLevel,
  MemoryGameType,
  MemoryGameVariant,
  MemoryGameVariantContent,
} from "./types";

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

type StoryTemplate = {
  title: string;
  story: string;
};

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

function localizeMemoryMatchContent(set: MemoryMatchSet, pairCount: number): LocalizedValue<MemoryGameVariantContent> {
  const languages: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];

  return languages.reduce((accumulator, language) => {
    accumulator[language] = {
      title: set.titles[language],
      prompt: set.prompts[language],
      payload: {
        pairItems: set.items.slice(0, pairCount).map((item) => ({
          label: item.labels[language],
          emoji: item.emoji,
        })),
      },
    };

    return accumulator;
  }, {} as LocalizedValue<MemoryGameVariantContent>);
}

function buildMemoryMatchLevels(sets: MemoryMatchSet[]): MemoryGameLevel[] {
  const levelSpecs = [
    { level: 1, pairs: 2 },
    { level: 2, pairs: 3 },
    { level: 3, pairs: 4 },
    { level: 4, pairs: 6 },
    { level: 5, pairs: 8 },
  ] as const;

  return levelSpecs.map((spec) => ({
    level: spec.level,
    variants: sets.map((set, index) =>
      createVariant(
        `memory_match-l${spec.level}-v${index + 1}`,
        spec.level,
        localizeMemoryMatchContent(set, spec.pairs),
      ),
    ),
  }));
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
  const levelSpecs = [
    { level: 1, count: 3, distractionType: null },
    { level: 2, count: 4, distractionType: null },
    { level: 3, count: 5, distractionType: null },
    { level: 4, count: 6, distractionType: "count_backwards" },
    { level: 5, count: 6, distractionType: "choose_blue" },
  ] as const;

  const distractionRotation = ["count_backwards", "choose_blue", "breathe_continue"] as const;
  const languages: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];

  return levelSpecs.map((spec) => ({
    level: spec.level,
    variants: sets.map((set, index) => {
      const content = languages.reduce((accumulator, language) => {
        const distractionType =
          spec.distractionType === null ? null : distractionRotation[index % distractionRotation.length];

        accumulator[language] = {
          title: set.titles[language],
          prompt: set.prompts[language],
          payload: {
            words: set.words.slice(0, spec.count).map((item) => item.labels[language]),
            distractors: set.distractors.slice(0, spec.count + 1).map((item) => item.labels[language]),
            distractionType,
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

  const levelSpecs = [
    { level: 1, count: 3, reverse: false },
    { level: 2, count: 4, reverse: false },
    { level: 3, count: 5, reverse: false },
    { level: 4, count: 6, reverse: false },
    { level: 5, count: 6, reverse: true },
  ] as const;

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
      const pattern = patternMap[spec.level][index % patternMap[spec.level].length];
      const sequence = pattern.slice(0, spec.count).map((tileIndex) => tileSet[tileIndex % tileSet.length].id);
      const languages: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];

      const content = languages.reduce((accumulator, language) => {
        accumulator[language] = {
          title: template.titles[language],
          prompt: promptMap[spec.level][language],
          payload: {
            tiles: tileSet,
            sequence,
            reverse: spec.reverse,
          },
        };
        return accumulator;
      }, {} as LocalizedValue<MemoryGameVariantContent>);

      return createVariant(`sequence_memory-l${spec.level}-v${index + 1}`, spec.level, content);
    }),
  }));
}

function buildNumberLevels(numberTemplates: readonly string[][]): MemoryGameLevel[] {
  return [
    { level: 1, count: 3, reverse: false, prompt: "Recuerda 3 dígitos en orden." },
    { level: 2, count: 4, reverse: false, prompt: "Recuerda 4 dígitos en orden." },
    { level: 3, count: 5, reverse: false, prompt: "Recuerda 5 dígitos en orden." },
    { level: 4, count: 6, reverse: false, prompt: "Recuerda 6 dígitos en orden." },
    { level: 5, count: 5, reverse: true, prompt: "Recuerda los dígitos y repítelos en orden inverso." },
  ].map((spec) => ({
    level: spec.level,
    variants: buildSpanishOnlyVariants(
      "number_memory",
      spec.level,
      numberTemplates.map((set, index) => ({
        title: `Números ${index + 1}`,
        prompt: spec.prompt,
        payload: {
          digits: set[spec.level - 1],
          reverse: spec.reverse,
        },
      })),
    ),
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

function buildAssociationLevels(templates: readonly Array<{ left: string; right: string; extra: string }>): MemoryGameLevel[] {
  return [
    {
      level: 1,
      prompt: "Relaciona objeto y categoría.",
      payload: (template: { left: string; right: string; extra: string }) => ({ left: template.left, right: template.right, icon: template.extra }),
    },
    {
      level: 2,
      prompt: "Relaciona un nombre con su objeto.",
      payload: (template: { left: string; right: string; extra: string }) => ({ name: template.left, object: template.right, icon: template.extra }),
    },
    {
      level: 3,
      prompt: "Relaciona una cara o icono con un nombre.",
      payload: (template: { left: string; right: string; extra: string }) => ({ icon: template.extra, name: template.left }),
    },
    {
      level: 4,
      prompt: "Relaciona una persona con su rutina.",
      payload: (template: { left: string; right: string; extra: string }) => ({ person: template.left, routine: template.right }),
    },
    {
      level: 5,
      prompt: "Memoriza la asociación ahora y recuérdala después.",
      payload: (template: { left: string; right: string; extra: string }) => ({ pair: [template.left, template.right], icon: template.extra }),
    },
  ].map((spec) => ({
    level: spec.level,
    variants: buildSpanishOnlyVariants(
      "association_memory",
      spec.level,
      templates.map((template, index) => ({
        title: `Asociación ${index + 1}`,
        prompt: spec.prompt,
        payload: spec.payload(template),
      })),
    ),
  }));
}

function buildStoryLevels(stories: readonly StoryTemplate[]): MemoryGameLevel[] {
  return [
    { level: 1, prompt: "Lee una historia breve y responde una pregunta.", payload: (story: StoryTemplate) => ({ story: story.story, questions: 1 }) },
    { level: 2, prompt: "Lee una historia breve y responde dos preguntas sencillas.", payload: (story: StoryTemplate) => ({ story: story.story, questions: 2 }) },
    { level: 3, prompt: "Recuerda quién, qué y dónde ocurre la historia.", payload: (story: StoryTemplate) => ({ story: story.story, questions: ["quién", "qué", "dónde"] }) },
    { level: 4, prompt: "Recuerda el orden de los hechos de la historia.", payload: (story: StoryTemplate) => ({ story: story.story, questions: ["secuencia"] }) },
    { level: 5, prompt: "Escucha o lee y recuerda la historia después de una breve espera.", payload: (story: StoryTemplate) => ({ story: story.story, delayed: true }) },
  ].map((spec) => ({
    level: spec.level,
    variants: buildSpanishOnlyVariants(
      "story_recall",
      spec.level,
      stories.map((story, index) => ({
        title: `Historia ${index + 1}`,
        prompt: spec.prompt,
        payload: spec.payload(story),
      })),
    ),
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
      { emoji: "🪑", labels: { es: "mesa", en: "table", fr: "table", de: "Tisch", it: "tavolo", pt: "mesa" } },
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
      { emoji: "🧴", labels: { es: "toalla", en: "towel", fr: "serviette", de: "Handtuch", it: "asciugamano", pt: "toalha" } },
      { emoji: "🪮", labels: { es: "peine", en: "comb", fr: "peigne", de: "Kamm", it: "pettine", pt: "pente" } },
      { emoji: "🪥", labels: { es: "cepillo", en: "brush", fr: "brosse", de: "Bürste", it: "spazzola", pt: "escova" } },
      { emoji: "🧴", labels: { es: "champú", en: "shampoo", fr: "shampooing", de: "Shampoo", it: "shampoo", pt: "champô" } },
      { emoji: "🧴", labels: { es: "crema", en: "cream", fr: "crème", de: "Creme", it: "crema", pt: "creme" } },
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

const numberTemplates = [
  ["318", "4827", "56091", "704126", "381204"],
  ["245", "6718", "53942", "186405", "297531"],
  ["907", "1245", "68319", "452781", "640215"],
  ["156", "9084", "37162", "824903", "915742"],
  ["482", "3159", "74018", "193684", "258470"],
  ["639", "2704", "85213", "470925", "613580"],
  ["571", "8462", "20954", "315870", "462193"],
  ["824", "1937", "68420", "951306", "704281"],
  ["260", "7815", "43092", "286417", "539162"],
  ["714", "5628", "14730", "820564", "381947"],
] as const;

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

const associationTemplates = [
  { left: "manzana", right: "fruta", extra: "🍎" },
  { left: "Carmen", right: "gafas", extra: "👓" },
  { left: "Javier", right: "paraguas", extra: "☂️" },
  { left: "taza", right: "cocina", extra: "☕" },
  { left: "Lola", right: "llaves", extra: "🔑" },
  { left: "vecino", right: "periódico", extra: "📰" },
  { left: "farmacia", right: "medicación", extra: "💊" },
  { left: "Rosa", right: "bufanda", extra: "🧣" },
  { left: "doctor", right: "agenda", extra: "📒" },
  { left: "mercado", right: "tomates", extra: "🍅" },
] as const;

const storyTemplates: StoryTemplate[] = [
  { title: "El paseo de Ana", story: "Ana salió por la mañana con su bolso azul, compró pan en la esquina y después se sentó en un banco del parque." },
  { title: "La llamada de Luis", story: "Luis llamó a su hermana después de comer, apuntó una cita en su agenda y dejó las llaves junto a la radio." },
  { title: "Té con Elena", story: "Elena preparó té de manzanilla, sacó galletas de avena y recibió a su vecino en el salón a las cinco." },
  { title: "Compra en el mercado", story: "Marta fue al mercado, eligió tomates y queso fresco, y regresó a casa antes de que empezara a llover." },
  { title: "La visita al médico", story: "Pedro llevó su tarjeta sanitaria, llegó diez minutos antes a la consulta y después pasó por la farmacia." },
  { title: "Un domingo tranquilo", story: "Sonia regó las plantas del balcón, escuchó música suave y llamó a su nieta al terminar la tarde." },
  { title: "Tarde de lectura", story: "Ramón tomó café, se acomodó en el sofá con una novela corta y encendió la lámpara cuando cayó el sol." },
  { title: "Preparando la cena", story: "Julia cortó verduras, puso arroz a cocer y dejó la mesa lista antes de que llegara su hijo." },
  { title: "Camino a la iglesia", story: "Teresa salió con paraguas, saludó a una vecina y dejó flores blancas junto al altar." },
  { title: "Mañana de recados", story: "Andrés fue al banco, compró sellos en el estanco y volvió a casa para escuchar las noticias del mediodía." },
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
const numberMemoryLevels = buildNumberLevels(numberTemplates);
const routineLevels = buildRoutineLevels(routineTemplates);
const associationLevels = buildAssociationLevels(associationTemplates);
const storyLevels = buildStoryLevels(storyTemplates);
const memoryMatchLevels = buildMemoryMatchLevels(memoryMatchSets);

export const MEMORY_GAME_ORDER: MemoryGameType[] = [
  "memory_match",
  "sequence_memory",
  "word_recall",
  "number_memory",
  "association_memory",
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
  return variant.content[language] ?? variant.content.es;
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
