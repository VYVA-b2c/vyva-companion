import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "migrations", "0012_dual_task_walk.sql");

const languages = ["es", "de", "en"];
const symbols = ["★", "●", "▲", "■", "♦"];

const tiers = [
  { tier: 1, min: 50, max: 70, steps: 4, count: 10, matches: [2, 3], symbolCount: 3, duration: 30000 },
  { tier: 2, min: 60, max: 80, steps: 4, count: 12, matches: [3], symbolCount: 3, duration: 30000 },
  { tier: 3, min: 80, max: 100, steps: 5, count: 14, matches: [3, 4], symbolCount: 3, duration: 35000 },
  { tier: 4, min: 100, max: 120, steps: 5, count: 16, matches: [4], symbolCount: 4, duration: 35000 },
  { tier: 5, min: 120, max: 150, steps: 6, count: 18, matches: [4, 5], symbolCount: 4, duration: 40000 },
  { tier: 6, min: 150, max: 180, steps: 6, count: 20, matches: [5], symbolCount: 4, duration: 40000 },
  { tier: 7, min: 180, max: 220, steps: 7, count: 22, matches: [5, 6], symbolCount: 5, duration: 45000 },
  { tier: 8, min: 220, max: 260, steps: 7, count: 25, matches: [6], symbolCount: 5, duration: 45000 },
  { tier: 9, min: 260, max: 290, steps: 8, count: 28, matches: [6, 7], symbolCount: 5, duration: 50000 },
  { tier: 10, min: 280, max: 300, steps: 8, count: 30, matches: [7, 8], symbolCount: 5, duration: 60000 },
];

function mulberry32(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

function shuffle(random, items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function startCandidates(config) {
  const candidates = [];
  for (let start = config.min; start <= config.max; start += 1) {
    if ((start - 2) % 7 === 0) candidates.push(start);
  }
  return candidates;
}

function chooseMatchIndices(random, symbolCount, matchCount) {
  const candidates = [];
  for (let index = 2; index <= symbolCount - 2; index += 1) {
    candidates.push(index);
  }

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const selected = [];
    for (const candidate of shuffle(random, candidates)) {
      if (selected.every((existing) => Math.abs(existing - candidate) >= 2)) {
        selected.push(candidate);
      }
      if (selected.length === matchCount) break;
    }
    if (selected.length === matchCount) return selected.sort((a, b) => a - b);
  }

  throw new Error(`Could not choose ${matchCount} match indices for ${symbolCount} symbols.`);
}

function buildSymbolStream(random, config, matchIndices) {
  const allowed = symbols.slice(0, config.symbolCount);
  const matches = new Set(matchIndices);
  const stream = [pick(random, allowed)];

  for (let index = 1; index < config.count; index += 1) {
    if (matches.has(index)) {
      stream.push(stream[index - 1]);
    } else {
      stream.push(pick(random, allowed.filter((symbol) => symbol !== stream[index - 1])));
    }
  }

  return stream;
}

function expectedAnswers(start, steps) {
  return Array.from({ length: steps }, (_, index) => start - 7 * (index + 1));
}

function actualMatchIndices(stream) {
  const indices = [];
  for (let index = 1; index < stream.length; index += 1) {
    if (stream[index] === stream[index - 1]) indices.push(index);
  }
  return indices;
}

function assertValid(record, config) {
  const answers = expectedAnswers(record.start, config.steps);
  if (JSON.stringify(record.expected) !== JSON.stringify(answers)) {
    throw new Error(`Invalid expected answers for tier ${config.tier}, start ${record.start}.`);
  }

  const matches = actualMatchIndices(record.stream);
  if (JSON.stringify(matches) !== JSON.stringify(record.matchIndices)) {
    throw new Error(`Invalid match indices for tier ${config.tier}, stream ${record.stream.join("")}.`);
  }

  if (record.matchIndices.some((index) => index === 0 || index === record.stream.length - 1)) {
    throw new Error(`Match starts or ends a stream for tier ${config.tier}.`);
  }

  for (let index = 1; index < record.matchIndices.length; index += 1) {
    if (record.matchIndices[index] - record.matchIndices[index - 1] < 2) {
      throw new Error(`Clustered matches for tier ${config.tier}.`);
    }
  }
}

function jsonSql(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

const random = mulberry32(20260507);
const rows = [];

for (const config of tiers) {
  const starts = startCandidates(config);
  const uniqueCombos = new Set();
  const baseRecords = [];

  while (baseRecords.length < 20) {
    const start = starts[baseRecords.length % starts.length];
    const matchCount = config.matches[baseRecords.length % config.matches.length];
    const matchIndices = chooseMatchIndices(random, config.count, matchCount);
    const stream = buildSymbolStream(random, config, matchIndices);
    const comboKey = `${start}|${stream.join("")}`;
    if (uniqueCombos.has(comboKey)) continue;

    const record = {
      start,
      expected: expectedAnswers(start, config.steps),
      stream,
      matchIndices,
      matchCount,
    };
    assertValid(record, config);
    uniqueCombos.add(comboKey);
    baseRecords.push(record);
  }

  for (const language of languages) {
    for (const record of baseRecords) {
      rows.push({
        ...record,
        language,
        symbolCount: config.count,
        duration: config.duration,
        tier: config.tier,
      });
    }
  }
}

const valuesSql = rows
  .map((row) => `  (${[
    row.start,
    jsonSql(row.expected),
    jsonSql(row.stream),
    jsonSql(row.matchIndices),
    row.symbolCount,
    row.matchCount,
    row.duration,
    row.tier,
    `'${row.language}'`,
  ].join(", ")})`)
  .join(",\n");

const sql = `-- Dual Task Walk schema and validated seed library.
-- Generated by scripts/generate-dual-task-walk-seed.mjs.
-- Match indices are zero-based to match the game loop and the sample brief.

CREATE TABLE IF NOT EXISTS public.dual_task_sequences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_number        INTEGER NOT NULL,
  expected_answers    JSONB NOT NULL,
  symbol_stream       JSONB NOT NULL,
  match_indices       JSONB NOT NULL,
  symbol_count        INTEGER NOT NULL,
  match_count         INTEGER NOT NULL,
  round_duration_ms   INTEGER NOT NULL,
  difficulty_tier     INTEGER NOT NULL CHECK (difficulty_tier BETWEEN 1 AND 10),
  language            TEXT NOT NULL DEFAULT 'es',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dual_task_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  played_at               TIMESTAMPTZ DEFAULT NOW(),
  sequence_id             UUID REFERENCES public.dual_task_sequences(id),
  difficulty_tier         INTEGER NOT NULL,
  serial7s_attempts       INTEGER NOT NULL DEFAULT 0,
  serial7s_correct        INTEGER NOT NULL DEFAULT 0,
  serial7s_accuracy_pct   NUMERIC(5,2),
  tap_hits                INTEGER NOT NULL DEFAULT 0,
  tap_misses              INTEGER NOT NULL DEFAULT 0,
  tap_false_positives     INTEGER NOT NULL DEFAULT 0,
  tap_accuracy_pct        NUMERIC(5,2),
  dual_task_score         INTEGER,
  completed               BOOLEAN NOT NULL DEFAULT FALSE,
  abandoned               BOOLEAN NOT NULL DEFAULT FALSE,
  duration_seconds        INTEGER
);

CREATE TABLE IF NOT EXISTS public.dual_task_user_state (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_tier          INTEGER NOT NULL DEFAULT 1 CHECK (current_tier BETWEEN 1 AND 10),
  sessions_at_tier      INTEGER NOT NULL DEFAULT 0,
  consecutive_wins      INTEGER NOT NULL DEFAULT 0,
  consecutive_losses    INTEGER NOT NULL DEFAULT 0,
  total_sessions        INTEGER NOT NULL DEFAULT 0,
  best_score            INTEGER NOT NULL DEFAULT 0,
  last_played_at        TIMESTAMPTZ,
  streak_days           INTEGER NOT NULL DEFAULT 0,
  last_streak_date      DATE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dual_task_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_task_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dual_task_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_dt_sessions" ON public.dual_task_sessions;
CREATE POLICY "user_own_dt_sessions" ON public.dual_task_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_own_dt_state" ON public.dual_task_user_state;
CREATE POLICY "user_own_dt_state" ON public.dual_task_user_state
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dt_sequences_read" ON public.dual_task_sequences;
CREATE POLICY "dt_sequences_read" ON public.dual_task_sequences
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_dts_user_played ON public.dual_task_sessions (user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_dtseq_tier ON public.dual_task_sequences (difficulty_tier, is_active);
CREATE INDEX IF NOT EXISTS idx_dtseq_tier_language ON public.dual_task_sequences (difficulty_tier, language, is_active);

WITH seed (
  start_number,
  expected_answers,
  symbol_stream,
  match_indices,
  symbol_count,
  match_count,
  round_duration_ms,
  difficulty_tier,
  language
) AS (
VALUES
${valuesSql}
)
INSERT INTO public.dual_task_sequences (
  start_number,
  expected_answers,
  symbol_stream,
  match_indices,
  symbol_count,
  match_count,
  round_duration_ms,
  difficulty_tier,
  language
)
SELECT
  seed.start_number,
  seed.expected_answers,
  seed.symbol_stream,
  seed.match_indices,
  seed.symbol_count,
  seed.match_count,
  seed.round_duration_ms,
  seed.difficulty_tier,
  seed.language
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dual_task_sequences existing
  WHERE existing.difficulty_tier = seed.difficulty_tier
    AND existing.language = seed.language
    AND existing.start_number = seed.start_number
    AND existing.symbol_stream = seed.symbol_stream
);
`;

fs.writeFileSync(outputPath, sql);
console.log(`Wrote ${rows.length} validated Dual Task Walk seed rows to ${path.relative(repoRoot, outputPath)}.`);
