#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false";

const VALID_HOOK_CATEGORIES = new Set([
  "nature",
  "animals",
  "body",
  "weather",
  "food",
  "history",
  "everyday_objects",
  "science",
]);

const VALID_PROMPT_TYPES = new Set(["alternate_uses", "what_if", "connections"]);
const VALID_SCENT_CATEGORIES = new Set(["food", "nature", "home", "season", "place", "occasion"]);
const VALID_SOURCES = new Set(["ai_generated", "human_written"]);

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

function cleanText(value) {
  return String(value || "").trim();
}

function assertValidLanguage(language) {
  const value = cleanText(language);
  if (!["es", "de", "en"].includes(value)) {
    throw new Error(`Unsupported language "${language}". Expected es, de, or en.`);
  }
  return value;
}

function normalizeHook(item, index) {
  const category = cleanText(item.category);
  if (!VALID_HOOK_CATEGORIES.has(category)) {
    throw new Error(`hooks[${index}] has invalid category "${item.category}".`);
  }

  const row = {
    fact_prompt: cleanText(item.fact_prompt),
    fact_answer: cleanText(item.fact_answer),
    category,
    language: assertValidLanguage(item.language),
    source: VALID_SOURCES.has(item.source) ? item.source : "ai_generated",
    is_active: false,
  };

  if (!row.fact_prompt || !row.fact_answer) {
    throw new Error(`hooks[${index}] needs fact_prompt and fact_answer.`);
  }

  return row;
}

function normalizePrompt(item, index) {
  const promptType = cleanText(item.prompt_type);
  if (!VALID_PROMPT_TYPES.has(promptType)) {
    throw new Error(`prompts[${index}] has invalid prompt_type "${item.prompt_type}".`);
  }

  const row = {
    prompt_type: promptType,
    prompt_text: cleanText(item.prompt_text),
    topic: cleanText(item.topic),
    language: assertValidLanguage(item.language),
    source: VALID_SOURCES.has(item.source) ? item.source : "ai_generated",
    is_active: false,
  };

  if (!row.prompt_text || !row.topic) {
    throw new Error(`prompts[${index}] needs prompt_text and topic.`);
  }

  return row;
}

function normalizeScentMemory(item, index) {
  const category = cleanText(item.category);
  if (!VALID_SCENT_CATEGORIES.has(category)) {
    throw new Error(`scent_memories[${index}] has invalid category "${item.category}".`);
  }
  const row = {
    scent_name: cleanText(item.scent_name),
    scent_description: cleanText(item.scent_description),
    guiding_question: cleanText(item.guiding_question),
    category,
    language: assertValidLanguage(item.language),
    source: VALID_SOURCES.has(item.source) ? item.source : "human_written",
    rejected: false,
    is_active: false,
  };
  if (!row.scent_name || !row.scent_description || !row.guiding_question) {
    throw new Error(`scent_memories[${index}] needs scent_name, scent_description, and guiding_question.`);
  }
  return row;
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  if (DRY_RUN) {
    console.log(`[dry-run] ${table}: ${rows.length} rows`);
    console.log(JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase insert failed for ${table}: ${response.status} ${text}`);
  }
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: node scripts/import-curious-minds-content.js <content-json-file>");
  }

  if (!DRY_RUN) {
    requireEnv("SUPABASE_URL or VITE_SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
  }

  const filePath = resolve(process.cwd(), inputPath);
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.map(normalizeHook) : [];
  const prompts = Array.isArray(parsed.prompts) ? parsed.prompts.map(normalizePrompt) : [];
  const scentMemories = Array.isArray(parsed.scent_memories) ? parsed.scent_memories.map(normalizeScentMemory) : [];

  await insertRows("curious_minds_hooks", hooks);
  await insertRows("curious_minds_prompts", prompts);
  await insertRows("scent_memory_prompts", scentMemories);

  console.log(`Content draft import complete. Hooks: ${hooks.length}. Prompts: ${prompts.length}. Scent memories: ${scentMemories.length}.`);
  console.log("Rows remain inactive until approved in /admin/curious-minds.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
