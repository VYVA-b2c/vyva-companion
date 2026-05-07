import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const tiers = {
  1: { cols: 4, rows: 4, steps: 5, memorise: 15, blocked: 0, landmarks: 0 },
  2: { cols: 4, rows: 4, steps: 5, memorise: 12, blocked: 0, landmarks: 2 },
  3: { cols: 5, rows: 5, steps: 6, memorise: 10, blocked: 2, landmarks: 2 },
  4: { cols: 5, rows: 5, steps: 6, memorise: 10, blocked: 3, landmarks: 3 },
  5: { cols: 6, rows: 6, steps: 7, memorise: 8, blocked: 4, landmarks: 3 },
  6: { cols: 6, rows: 6, steps: 7, memorise: 8, blocked: 5, landmarks: 2 },
  7: { cols: 7, rows: 7, steps: 8, memorise: 7, blocked: 6, landmarks: 2 },
  8: { cols: 8, rows: 8, steps: 8, memorise: 6, blocked: 7, landmarks: 2 },
  9: { cols: 8, rows: 8, steps: 8, memorise: 5, blocked: 8, landmarks: 1 },
  10: { cols: 10, rows: 10, steps: 8, memorise: 5, blocked: 10, landmarks: 1 },
};

const languages = ["es", "de", "en"];
const landmarkIcons = ["🏠", "🌳", "⛪", "🏪", "🌺", "🏥", "📮", "⛲"];

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function key(cell) {
  return `${cell.col},${cell.row}`;
}

function adjacent(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
}

function shuffle(items, rng) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function neighbours(cell, config) {
  return [
    { col: cell.col + 1, row: cell.row },
    { col: cell.col - 1, row: cell.row },
    { col: cell.col, row: cell.row + 1 },
    { col: cell.col, row: cell.row - 1 },
  ].filter((item) => item.col >= 0 && item.row >= 0 && item.col < config.cols && item.row < config.rows);
}

function randomWalk(config, rng) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const start = {
      col: Math.floor(rng() * config.cols),
      row: Math.floor(rng() * config.rows),
    };
    const route = [start];
    const visited = new Set([key(start)]);

    while (route.length < config.steps) {
      const current = route[route.length - 1];
      const options = shuffle(neighbours(current, config), rng).filter((cell) => !visited.has(key(cell)));
      if (!options.length) break;
      const next = options[0];
      route.push(next);
      visited.add(key(next));
    }

    if (route.length === config.steps) return route;
  }

  throw new Error("Could not generate a contiguous route");
}

function makeCells(config, excludedKeys, count, rng) {
  const cells = [];
  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      if (!excludedKeys.has(`${col},${row}`)) cells.push({ col, row });
    }
  }
  return shuffle(cells, rng).slice(0, count);
}

function validateMap(entry) {
  const routeKeys = new Set();
  for (let index = 0; index < entry.route.length; index += 1) {
    const cell = entry.route[index];
    if (cell.col < 0 || cell.row < 0 || cell.col >= entry.config.cols || cell.row >= entry.config.rows) {
      throw new Error(`Route cell out of bounds at tier ${entry.tier}`);
    }
    if (routeKeys.has(key(cell))) throw new Error(`Route revisits a cell at tier ${entry.tier}`);
    routeKeys.add(key(cell));
    if (index > 0 && !adjacent(entry.route[index - 1], cell)) throw new Error(`Route has a gap at tier ${entry.tier}`);
  }

  const blockedKeys = new Set(entry.blocked.map(key));
  for (const cell of entry.route) {
    if (blockedKeys.has(key(cell))) throw new Error(`Blocked cell overlaps route at tier ${entry.tier}`);
  }
  for (const landmark of entry.landmarks) {
    if (blockedKeys.has(key(landmark))) throw new Error(`Landmark overlaps blocked cell at tier ${entry.tier}`);
  }
}

function sqlJson(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function deterministicUuid(input) {
  const chars = createHash("sha1").update(input).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const rng = createRng(20260507);
const entries = [];

for (const [tierText, config] of Object.entries(tiers)) {
  const tier = Number(tierText);
  const routeSignatures = new Set();

  while (routeSignatures.size < 20) {
    const route = randomWalk(config, rng);
    const signature = JSON.stringify(route);
    if (routeSignatures.has(signature)) continue;
    routeSignatures.add(signature);

    const routeKeys = new Set(route.map(key));
    const blocked = makeCells(config, routeKeys, config.blocked, rng);
    const blockedKeys = new Set(blocked.map(key));
    const landmarks = makeCells(config, blockedKeys, config.landmarks, rng).map((cell, index) => ({
      ...cell,
      icon: landmarkIcons[(tier + index + routeSignatures.size) % landmarkIcons.length],
    }));

    const baseEntry = { tier, config, route, blocked, landmarks };
    validateMap(baseEntry);

    const routeIndex = routeSignatures.size;

    for (const language of languages) {
      entries.push({
        ...baseEntry,
        id: deterministicUuid(`spatial-navigator:${tier}:${routeIndex}:${language}`),
        language,
      });
    }
  }
}

const values = entries.map((entry) => {
  return `('${entry.id}', ${entry.config.cols}, ${entry.config.rows}, ${sqlJson(entry.route)}, ${entry.config.steps}, ${entry.tier}, ${sqlJson(entry.blocked)}, ${sqlJson(entry.landmarks)}, ${entry.config.memorise}, '${entry.language}')`;
});

const sql = `-- Generated by scripts/generate-spatial-nav-seed.mjs.
-- Spatial Navigator content library: 20 unique maps per tier x 10 tiers x 3 languages = ${entries.length} rows.
-- Routes are contiguous, non-repeating, and never overlap blocked cells.

insert into spatial_nav_maps
  (id, grid_cols, grid_rows, route_nodes, step_count, difficulty_tier,
   blocked_cells, landmark_cells, memorise_seconds, language)
values
${values.join(",\n")}
on conflict (id) do update set
  grid_cols = excluded.grid_cols,
  grid_rows = excluded.grid_rows,
  route_nodes = excluded.route_nodes,
  step_count = excluded.step_count,
  difficulty_tier = excluded.difficulty_tier,
  blocked_cells = excluded.blocked_cells,
  landmark_cells = excluded.landmark_cells,
  memorise_seconds = excluded.memorise_seconds,
  language = excluded.language,
  is_active = true;
`;

const outputPath = resolve("schema/spatial_navigator_seed.sql");
writeFileSync(outputPath, sql, "utf8");

console.log(`Generated ${entries.length} Spatial Navigator maps at ${outputPath}`);
