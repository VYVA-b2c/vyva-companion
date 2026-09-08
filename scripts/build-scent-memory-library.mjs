#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const library = {
  food: [
    "fresh bread", "morning coffee", "cinnamon rolls", "tomato sauce simmering", "lemon peel",
    "orange zest", "vanilla cake", "apple pie", "buttered toast", "mint tea",
    "roasted potatoes", "melting chocolate", "ripe strawberries", "fresh peaches", "herbs in soup",
    "grilled corn", "warm honey", "toasted almonds", "weekend pancakes", "berry jam",
    "warm milk with nutmeg", "fresh basil", "baked apples", "hot cocoa", "rice pudding",
  ],
  nature: [
    "earth after rain", "newly cut grass", "pine needles", "wildflowers", "sea air",
    "a rose garden", "jasmine", "a lavender field", "forest moss", "eucalyptus leaves",
    "crushed mint", "a rosemary bush", "damp autumn leaves", "citrus blossom", "lilac",
    "honeysuckle", "cedar wood", "mountain air", "riverbank reeds", "sun-warmed herbs",
    "garden soil", "chamomile", "magnolia", "fresh hay", "rain on warm stone",
  ],
  home: [
    "clean linen", "a lavender drawer sachet", "polished wood", "beeswax", "gentle hand soap",
    "laundry drying outdoors", "a cedar cupboard", "a wool blanket", "fresh lemon in the kitchen", "ironing steam",
    "old books", "cotton sheets", "curtains in fresh air", "a sewing basket", "wooden drawers",
    "bath soap", "furniture wax", "dried flower potpourri", "a freshly swept room", "warm towels",
    "a closet sachet", "a leather armchair", "paper and pencils", "a clean tea towel", "a sun-warmed room",
  ],
  season: [
    "spring blossoms", "a gentle summer rain", "autumn apples", "winter oranges", "the first grass of spring",
    "warm pine needles in summer", "fallen autumn leaves", "crisp winter air", "sun-warmed tomatoes", "early spring soil",
    "flowering acacia", "ripe summer figs", "blackberry brambles", "cool morning dew", "an apple orchard",
    "fresh melon", "grape harvest", "the air before summer rain", "spring hyacinths", "late-summer herbs",
    "autumn pears", "winter cinnamon", "summer peaches", "a spring rose", "cool evening air in autumn",
  ],
  place: [
    "a bakery doorway", "a seaside promenade", "a quiet library", "a flower market", "a citrus grove",
    "a vegetable garden", "a small café", "a wood workshop", "a classroom pencil box", "an orchard path",
    "flowers in a village square", "a warm greenhouse", "a picnic meadow", "a kitchen garden", "an old bookshop",
    "a fabric shop", "a spice market", "a tea room", "a farm stand", "a pine trail",
    "lakeside air", "a cobbled street after rain", "a summer porch", "a pottery studio", "a coastal garden",
  ],
  occasion: [
    "birthday cake", "a Sunday lunch", "a picnic basket", "afternoon tea", "a leisurely breakfast",
    "a garden gathering", "a day spent baking", "holiday cookies", "fruit preserving day", "freshly arranged flowers",
    "a summer picnic", "a harvest table", "a welcome-home meal", "a brunch table", "coffee shared with visitors",
    "celebration flowers", "tea with guests", "a seaside lunch", "a market morning", "a familiar family recipe",
    "winter baking", "a springtime gathering", "a Sunday roast", "festive oranges", "an anniversary bouquet",
  ],
};

const descriptions = {
  food: [
    (name) => `Imagine the comforting aroma of ${name}, warm and familiar in the air.`,
    (name) => `Pause and picture ${name}. Let the scent arrive slowly, without trying to force a memory.`,
    (name) => `Think of the gentle kitchen scent of ${name}, as if it were nearby now.`,
    (name) => `Imagine ${name} filling a room with a soft, familiar aroma.`,
    (name) => `Take a moment with the imagined scent of ${name}, noticing whatever comes to mind.`,
  ],
  nature: [
    (name) => `Imagine the natural scent of ${name}, carried softly on the air.`,
    (name) => `Picture yourself near ${name} and notice the fresh scent around you.`,
    (name) => `Take a slow breath and imagine ${name}, clear and gentle.`,
    (name) => `Let the scent of ${name} come to mind, with no need to remember anything particular.`,
    (name) => `Imagine being outdoors with ${name} nearby and the air feeling fresh.`,
  ],
  home: [
    (name) => `Imagine the quiet, familiar scent of ${name} somewhere at home.`,
    (name) => `Picture ${name} and let its soft household scent come to mind.`,
    (name) => `Take a moment to imagine ${name}, simple and familiar.`,
    (name) => `Let the scent of ${name} fill an ordinary room in your imagination.`,
    (name) => `Think gently of ${name} and notice what the familiar aroma brings forward.`,
  ],
  season: [
    (name) => `Imagine ${name} and the particular feeling it gives the air.`,
    (name) => `Picture the season through the scent of ${name}, arriving softly.`,
    (name) => `Take a moment with ${name}, noticing the time of year it suggests to you.`,
    (name) => `Imagine the air carrying ${name}, gentle and familiar.`,
    (name) => `Let ${name} bring a season to mind in your own way.`,
  ],
  place: [
    (name) => `Imagine standing near ${name} and noticing the scents in the air.`,
    (name) => `Picture ${name} as clearly as you like, beginning with its familiar aroma.`,
    (name) => `Let the scent of ${name} suggest a place, without needing to name it exactly.`,
    (name) => `Take a quiet moment to imagine ${name} and the atmosphere around it.`,
    (name) => `Imagine arriving at ${name} and noticing what you smell first.`,
  ],
  occasion: [
    (name) => `Imagine the familiar scent of ${name} and the atmosphere around it.`,
    (name) => `Picture ${name}, letting its scents and small details return gently.`,
    (name) => `Take a moment with the aroma of ${name}, without searching for a right memory.`,
    (name) => `Imagine ${name} beginning, with familiar scents gathering in the room.`,
    (name) => `Let the scent of ${name} bring back any detail that feels comfortable.`,
  ],
};

const questions = {
  food: ["What moment comes back with this smell?", "Does this bring a kitchen or table to mind?", "Who or what do you associate with this aroma?", "Was this scent part of a familiar routine?", "What small detail returns first?"],
  nature: ["Where does this scent take you?", "Does a walk, garden, or view come to mind?", "What time of day does this scent suggest?", "Who or what might have been nearby?", "What small outdoor detail returns first?"],
  home: ["Who or what does this remind you of?", "Does a room or routine come to mind?", "Where might you have noticed this scent?", "What small household moment returns?", "How did this familiar place feel?"],
  season: ["What time of year comes to mind?", "Where would you notice this seasonal scent?", "What small tradition or routine returns?", "Who or what might have been nearby?", "What detail of the season do you remember first?"],
  place: ["Where does this scent take you?", "What would you see around you there?", "Who or what might be nearby?", "What small detail makes the place feel familiar?", "When might you have visited a place like this?"],
  occasion: ["What was happening around you?", "Who or what do you associate with this occasion?", "What small detail comes back first?", "Where might a moment like this have happened?", "What familiar routine was part of it?"],
};

const prompts = Object.entries(library).flatMap(([category, names]) =>
  names.map((scentName, index) => ({
    scent_name: scentName,
    scent_description: descriptions[category][index % descriptions[category].length](scentName),
    guiding_question: questions[category][index % questions[category].length],
    category,
    language: "en",
    source: "human_written",
  })),
);

const duplicates = prompts.filter((prompt, index) =>
  prompts.findIndex((candidate) => candidate.scent_name === prompt.scent_name) !== index,
);
if (prompts.length !== 150) throw new Error(`Expected 150 prompts, received ${prompts.length}.`);
if (duplicates.length) throw new Error(`Duplicate scent names: ${duplicates.map((item) => item.scent_name).join(", ")}`);
for (const [category, names] of Object.entries(library)) {
  if (names.length !== 25) throw new Error(`${category} must contain 25 prompts; received ${names.length}.`);
}

const outputPath = resolve(process.cwd(), "public/content/scent-memory.en.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ scent_memories: prompts }, null, 2)}\n`, "utf8");
console.log(`Created ${outputPath} with ${prompts.length} Scent Memory prompts.`);
