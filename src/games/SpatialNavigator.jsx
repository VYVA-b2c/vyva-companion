import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../i18n";
import { normalizeGameLanguage } from "./shared/language";

const PURPLE = "#6B21A8";
const GOLD = "#F59E0B";
const BACKGROUND = "#FAF9F6";

const CELL_COLORS = {
  empty: "#FAF9F6",
  blocked: "#9CA3AF",
  routeOn: "#EDE9FE",
  drawnOn: "#FEF3C7",
  correct: "#D1FAE5",
  wrong: "#FEE2E2",
};

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function localDayStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultUserState(userId) {
  return {
    user_id: userId,
    current_tier: 1,
    sessions_at_tier: 0,
    consecutive_wins: 0,
    consecutive_losses: 0,
    total_sessions: 0,
    best_score: 0,
    last_played_at: null,
    streak_days: 0,
    last_streak_date: null,
    updated_at: new Date().toISOString(),
  };
}

function practiceMap(language) {
  return {
    id: null,
    grid_cols: 4,
    grid_rows: 4,
    route_nodes: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
    ],
    step_count: 5,
    difficulty_tier: 1,
    blocked_cells: [],
    landmark_cells: [],
    memorise_seconds: 15,
    language,
    is_active: true,
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function cellKey(cell) {
  return `${cell.col},${cell.row}`;
}

function sameCell(a, b) {
  return Boolean(a && b && a.col === b.col && a.row === b.row);
}

function isAdjacent(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
}

function isBlockedCell(map, cell) {
  return asArray(map?.blocked_cells).some((blocked) => sameCell(blocked, cell));
}

function routeFor(map) {
  return asArray(map?.route_nodes);
}

function getCellCenter(cell, cellWidth, cellHeight) {
  return {
    x: cell.col * cellWidth + cellWidth / 2,
    y: cell.row * cellHeight + cellHeight / 2,
  };
}

function drawRouteLine(ctx, route, cellWidth, cellHeight, color, options = {}) {
  if (route.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = options.width ?? 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (options.dashed) ctx.setLineDash([12, 10]);
  ctx.beginPath();
  route.forEach((cell, index) => {
    const center = getCellCenter(cell, cellWidth, cellHeight);
    if (index === 0) ctx.moveTo(center.x, center.y);
    else ctx.lineTo(center.x, center.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawPathDots(ctx, path, cellWidth, cellHeight, color) {
  ctx.save();
  ctx.fillStyle = color;
  path.forEach((cell) => {
    const center = getCellCenter(cell, cellWidth, cellHeight);
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.max(7, Math.min(cellWidth, cellHeight) * 0.13), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function nextCellsBetween(from, to) {
  if (sameCell(from, to)) return [];
  if (isAdjacent(from, to)) return [to];
  if (from.col !== to.col && from.row !== to.row) return null;

  const cells = [];
  if (from.col === to.col) {
    const direction = to.row > from.row ? 1 : -1;
    for (let row = from.row + direction; row !== to.row + direction; row += direction) {
      cells.push({ col: from.col, row });
    }
    return cells;
  }

  const direction = to.col > from.col ? 1 : -1;
  for (let col = from.col + direction; col !== to.col + direction; col += direction) {
    cells.push({ col, row: from.row });
  }
  return cells;
}

export default function SpatialNavigator({ userId, onExit }) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const text = useMemo(() => ({
    loading: t("brainGames.spatialNav.loading"),
    practiceNote: t("brainGames.spatialNav.practiceNote"),
    title: t("brainGames.spatialNav.title"),
    subtitle: t("brainGames.spatialNav.subtitle"),
    level: t("common.level"),
    start: t("brainGames.spatialNav.start"),
    introHint: t("brainGames.spatialNav.introHint"),
    memoriseTitle: t("brainGames.spatialNav.memoriseTitle"),
    drawTitle: t("brainGames.spatialNav.drawTitle"),
    exit: t("brainGames.spatialNav.exit"),
    remember: t("brainGames.spatialNav.remember"),
    seconds: t("brainGames.spatialNav.seconds"),
    drawHint: t("brainGames.spatialNav.drawHint"),
    done: t("brainGames.spatialNav.done"),
    resultGreat: t("brainGames.spatialNav.resultGreat"),
    resultTry: t("brainGames.spatialNav.resultTry"),
    accuracy: t("brainGames.spatialNav.accuracy"),
    streak: t("brainGames.spatialNav.streak"),
    score: t("brainGames.spatialNav.score"),
    replay: t("brainGames.spatialNav.replay"),
    finish: t("brainGames.spatialNav.finish"),
    days: t("brainGames.spatialNav.days"),
    progressNext: t("brainGames.spatialNav.progressNext"),
    readySoon: t("brainGames.spatialNav.readySoon"),
  }), [t]);
  const canvasRef = useRef(null);
  const countdownRef = useRef(null);
  const drawStartedAtRef = useRef(null);
  const isDrawingRef = useRef(false);
  const sessionSavedRef = useRef(false);
  const latestRef = useRef({ screen: "loading", map: null });

  const [screen, setScreen] = useState("loading");
  const [map, setMap] = useState(null);
  const [userState, setUserState] = useState(null);
  const [drawnPath, setDrawnPath] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [sessionResult, setSessionResult] = useState(null);
  const [canvasSize, setCanvasSize] = useState(360);
  const [blockedFlashCell, setBlockedFlashCell] = useState(null);
  const [loadNote, setLoadNote] = useState("");
  const [savingResult, setSavingResult] = useState(false);

  const route = useMemo(() => routeFor(map), [map]);
  const memoriseSeconds = Math.max(1, Number(map?.memorise_seconds ?? 5));
  const countdownRatio = screen === "memorise" ? Math.max(0, Math.min(1, countdown / memoriseSeconds)) : 1;

  useEffect(() => {
    latestRef.current = { screen, map };
  }, [screen, map]);

  const loadUserState = useCallback(async () => {
    if (!userId) return defaultUserState(userId);

    const { data, error } = await supabase
      .from("spatial_nav_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const initial = defaultUserState(userId);
    const { data: created, error: upsertError } = await supabase
      .from("spatial_nav_user_state")
      .upsert(initial, { onConflict: "user_id" })
      .single();

    if (upsertError) throw upsertError;
    return created ?? initial;
  }, [userId]);

  const loadMap = useCallback(async (state) => {
    if (!userId) return practiceMap(gameLanguage);

    const tier = Number(state?.current_tier ?? 1);
    const start = localDayStart();
    const end = addDays(start, 1);

    const { data: todaySessions, error: sessionsError } = await supabase
      .from("spatial_nav_sessions")
      .select("map_id")
      .eq("user_id", userId)
      .gte("played_at", start.toISOString())
      .lt("played_at", end.toISOString());

    if (sessionsError) throw sessionsError;

    const playedToday = (todaySessions ?? [])
      .map((session) => session.map_id)
      .filter(Boolean);

    const languageOrder = [...new Set([gameLanguage, "es", "en", "de"])];

    for (const mapLanguage of languageOrder) {
      let query = supabase
        .from("spatial_nav_maps")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true)
        .eq("language", mapLanguage)
        .limit(80);

      if (playedToday.length) {
        query = query.not("id", "in", `(${playedToday.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data?.length) return data[Math.floor(Math.random() * data.length)];
    }

    for (const mapLanguage of languageOrder) {
      const { data: maps, error: mapsError } = await supabase
        .from("spatial_nav_maps")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true)
        .eq("language", mapLanguage)
        .limit(80);

      if (mapsError) throw mapsError;
      if (!maps?.length) continue;

      const { data: history, error: historyError } = await supabase
        .from("spatial_nav_sessions")
        .select("map_id,played_at")
        .eq("user_id", userId)
        .eq("difficulty_tier", tier)
        .order("played_at", { ascending: false })
        .limit(400);

      if (historyError) throw historyError;

      const lastPlayed = new Map();
      for (const session of history ?? []) {
        if (session.map_id && !lastPlayed.has(session.map_id)) {
          lastPlayed.set(session.map_id, new Date(session.played_at).getTime());
        }
      }

      return [...maps].sort((a, b) => (lastPlayed.get(a.id) ?? 0) - (lastPlayed.get(b.id) ?? 0))[0];
    }

    return practiceMap(gameLanguage);
  }, [gameLanguage, userId]);

  const loadGame = useCallback(async () => {
    setScreen("loading");
    setLoadNote("");
    setDrawnPath([]);
    setSessionResult(null);
    sessionSavedRef.current = false;
    drawStartedAtRef.current = null;

    try {
      const state = await loadUserState();
      const selectedMap = await loadMap(state);
      setUserState(state);
      setMap(selectedMap);
      setScreen("intro");
    } catch {
      const fallbackState = defaultUserState(userId);
      setUserState(fallbackState);
      setMap(practiceMap(gameLanguage));
      setLoadNote(text.practiceNote);
      setScreen("intro");
    }
  }, [gameLanguage, loadMap, loadUserState, text.practiceNote, userId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return undefined;

    const updateSize = () => {
      const width = container.getBoundingClientRect().width || 360;
      setCanvasSize(Math.max(320, Math.min(width, 480)));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [screen]);

  const flashBlockedCell = useCallback((cell) => {
    setBlockedFlashCell(cell);
    window.setTimeout(() => setBlockedFlashCell(null), 260);
  }, []);

  const saveSession = useCallback(async (result, abandoned = false) => {
    if (!map || !userId || sessionSavedRef.current) return;
    sessionSavedRef.current = true;

    const payload = {
      user_id: userId,
      map_id: map.id ?? null,
      difficulty_tier: Number(map.difficulty_tier ?? 1),
      step_count: result?.stepCount ?? routeFor(map).length,
      steps_correct: result?.stepsCorrect ?? 0,
      accuracy_pct: result?.accuracyPct ?? 0,
      draw_time_seconds: result?.drawTimeSeconds ?? null,
      completed: !abandoned,
      abandoned,
      score: result?.score ?? 0,
    };

    await supabase.from("spatial_nav_sessions").insert(payload);
  }, [map, userId]);

  const updateUserState = useCallback(async (result) => {
    const previous = userState ?? defaultUserState(userId);
    const today = todayKey();
    const yesterday = todayKey(addDays(new Date(), -1));

    let streakDays = 1;
    if (previous.last_streak_date === today) streakDays = previous.streak_days || 1;
    else if (previous.last_streak_date === yesterday) streakDays = (previous.streak_days || 0) + 1;

    let currentTier = Number(previous.current_tier ?? 1);
    let sessionsAtTier = Number(previous.sessions_at_tier ?? 0) + 1;
    let consecutiveWins = 0;
    let consecutiveLosses = 0;

    if (result.accuracyPct >= 80) {
      consecutiveWins = Number(previous.consecutive_wins ?? 0) + 1;
      consecutiveLosses = 0;
    } else if (result.accuracyPct < 50) {
      consecutiveWins = 0;
      consecutiveLosses = Number(previous.consecutive_losses ?? 0) + 1;
    }

    if (consecutiveWins >= 3 && currentTier < 10) {
      currentTier += 1;
      sessionsAtTier = 0;
      consecutiveWins = 0;
      consecutiveLosses = 0;
    } else if (consecutiveLosses >= 3 && currentTier > 1) {
      currentTier -= 1;
      sessionsAtTier = 0;
      consecutiveWins = 0;
      consecutiveLosses = 0;
    } else if (result.accuracyPct >= 50 && result.accuracyPct < 80) {
      consecutiveWins = 0;
      consecutiveLosses = 0;
    }

    const next = {
      ...previous,
      user_id: userId,
      current_tier: Math.min(10, Math.max(1, currentTier)),
      sessions_at_tier: sessionsAtTier,
      consecutive_wins: consecutiveWins,
      consecutive_losses: consecutiveLosses,
      total_sessions: Number(previous.total_sessions ?? 0) + 1,
      best_score: Math.max(Number(previous.best_score ?? 0), result.score),
      last_played_at: new Date().toISOString(),
      streak_days: streakDays,
      last_streak_date: today,
      updated_at: new Date().toISOString(),
    };

    setUserState(next);
    if (userId && map?.id) {
      await supabase.from("spatial_nav_user_state").upsert(next, { onConflict: "user_id" });
    }
    return next;
  }, [map?.id, userId, userState]);

  const startCountdown = useCallback((seconds) => {
    window.clearInterval(countdownRef.current);
    const startedAt = Date.now();
    const durationMs = seconds * 1000;
    setCountdown(seconds);

    countdownRef.current = window.setInterval(() => {
      const remaining = Math.max(0, (durationMs - (Date.now() - startedAt)) / 1000);
      setCountdown(remaining);

      if (remaining <= 0) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = null;
        drawStartedAtRef.current = null;
        setDrawnPath([]);
        setScreen("draw");
      }
    }, 200);
  }, []);

  const beginMemorise = useCallback(() => {
    if (!map) return;
    setDrawnPath([]);
    setSessionResult(null);
    sessionSavedRef.current = false;
    setScreen("memorise");
    startCountdown(Number(map.memorise_seconds ?? 5));
  }, [map, startCountdown]);

  function getCellFromTouch(touch, canvasRect, cellSize) {
    if (!map) return null;
    const cols = Number(map.grid_cols);
    const rows = Number(map.grid_rows);
    const col = Math.floor((touch.clientX - canvasRect.left) / cellSize.width);
    const row = Math.floor((touch.clientY - canvasRect.top) / cellSize.height);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row };
  }

  const cellFromEvent = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return null;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] ?? event.changedTouches?.[0] ?? event;
    return getCellFromTouch(point, rect, {
      width: rect.width / Number(map.grid_cols),
      height: rect.height / Number(map.grid_rows),
    });
  }, [map]);

  const appendDrawnCell = useCallback((cell) => {
    if (!map || !cell) return;

    setDrawnPath((previous) => {
      if (!previous.length) {
        if (isBlockedCell(map, cell)) {
          flashBlockedCell(cell);
          isDrawingRef.current = false;
          return previous;
        }
        return [cell];
      }

      const last = previous[previous.length - 1];
      if (sameCell(last, cell)) return previous;

      const bridge = nextCellsBetween(last, cell);
      if (!bridge) return previous;

      const next = [...previous];
      for (const bridgeCell of bridge) {
        if (isBlockedCell(map, bridgeCell)) {
          flashBlockedCell(bridgeCell);
          isDrawingRef.current = false;
          break;
        }
        if (!sameCell(next[next.length - 1], bridgeCell)) next.push(bridgeCell);
      }
      return next;
    });
  }, [flashBlockedCell, map]);

  function handleTouchStart(event) {
    if (screen !== "draw") return;
    event.preventDefault();
    const cell = cellFromEvent(event);
    if (!cell) return;
    if (isBlockedCell(map, cell)) {
      flashBlockedCell(cell);
      return;
    }
    drawStartedAtRef.current = Date.now();
    setDrawnPath([cell]);
    isDrawingRef.current = true;
  }

  function handleTouchMove(event) {
    if (screen !== "draw" || !isDrawingRef.current) return;
    event.preventDefault();
    appendDrawnCell(cellFromEvent(event));
  }

  function handleTouchEnd(event) {
    if (screen !== "draw") return;
    event.preventDefault();
    isDrawingRef.current = false;
  }

  function computeScore(path, currentMap) {
    const correctRoute = routeFor(currentMap);
    const compareLen = Math.min(path.length, correctRoute.length);
    let stepsCorrect = 0;
    for (let index = 0; index < compareLen; index += 1) {
      if (sameCell(path[index], correctRoute[index])) stepsCorrect += 1;
    }

    const stepCount = correctRoute.length || 1;
    const drawTimeSeconds = Math.max(0.01, ((Date.now() - (drawStartedAtRef.current ?? Date.now())) / 1000));
    const accuracyPct = (stepsCorrect / stepCount) * 100;
    const baseScore = (stepsCorrect / stepCount) * 700;
    const speedBonus = Math.max(0, 300 * (1 - drawTimeSeconds / (stepCount * 5)));
    const score = Math.min(1000, Math.round(baseScore + speedBonus));

    return {
      stepsCorrect,
      accuracyPct: Number(accuracyPct.toFixed(2)),
      stepCount,
      drawTimeSeconds: Number(drawTimeSeconds.toFixed(2)),
      score,
    };
  }

  const submitPath = useCallback(async () => {
    if (!map || drawnPath.length < 3 || savingResult) return;
    setSavingResult(true);
    const result = computeScore(drawnPath, map);
    setSessionResult(result);
    await saveSession(result, false);
    await updateUserState(result);
    setScreen("result");
    setSavingResult(false);
  }, [drawnPath, map, saveSession, savingResult, updateUserState]);

  const saveAbandonedIfNeeded = useCallback(async () => {
    if (!map || sessionSavedRef.current) return;
    const shouldSave = latestRef.current.screen === "memorise" || latestRef.current.screen === "draw";
    if (!shouldSave) return;
    await saveSession({
      stepsCorrect: 0,
      accuracyPct: 0,
      stepCount: routeFor(map).length,
      drawTimeSeconds: null,
      score: 0,
    }, true);
  }, [map, saveSession]);

  const handleExit = useCallback(async () => {
    window.clearInterval(countdownRef.current);
    await saveAbandonedIfNeeded();
    onExit?.();
  }, [onExit, saveAbandonedIfNeeded]);

  useEffect(() => {
    return () => {
      window.clearInterval(countdownRef.current);
      void saveAbandonedIfNeeded();
    };
  }, [saveAbandonedIfNeeded]);

  function renderGrid(ctx, currentMap, currentDrawnPath, phase) {
    if (!currentMap) return;

    const cols = Number(currentMap.grid_cols);
    const rows = Number(currentMap.grid_rows);
    const cellWidth = canvasSize / cols;
    const cellHeight = canvasSize / rows;
    const correctRoute = routeFor(currentMap);
    const blocked = new Set(asArray(currentMap.blocked_cells).map(cellKey));
    const landmarks = asArray(currentMap.landmark_cells);
    const routeCells = new Set(correctRoute.map(cellKey));
    const drawnCells = new Set(currentDrawnPath.map(cellKey));
    const correctCells = new Set();
    const softTryCells = new Set();

    if (phase === "result") {
      currentDrawnPath.forEach((cell, index) => {
        if (sameCell(cell, correctRoute[index])) correctCells.add(cellKey(cell));
        else softTryCells.add(cellKey(cell));
      });
    }

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const current = { col, row };
        const key = cellKey(current);
        let fill = CELL_COLORS.empty;

        if (phase === "memorise" && routeCells.has(key)) fill = CELL_COLORS.routeOn;
        if (phase === "draw" && drawnCells.has(key)) fill = CELL_COLORS.drawnOn;
        if (phase === "result" && correctCells.has(key)) fill = CELL_COLORS.correct;
        if (phase === "result" && softTryCells.has(key)) fill = CELL_COLORS.wrong;
        if (blocked.has(key)) fill = CELL_COLORS.blocked;
        if (blockedFlashCell && sameCell(blockedFlashCell, current)) fill = "#FCA5A5";

        ctx.fillStyle = fill;
        ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
        ctx.strokeStyle = "#E5E3DF";
        ctx.lineWidth = 1;
        ctx.strokeRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
      }
    }

    ctx.save();
    ctx.fillStyle = "#374151";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(22, Math.min(cellWidth, cellHeight) * 0.42)}px Arial`;
    for (const blockedCell of asArray(currentMap.blocked_cells)) {
      const center = getCellCenter(blockedCell, cellWidth, cellHeight);
      ctx.fillText("×", center.x, center.y);
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(26, Math.min(cellWidth, cellHeight) * 0.48)}px Arial`;
    for (const landmark of landmarks) {
      if (blocked.has(cellKey(landmark))) continue;
      const center = getCellCenter(landmark, cellWidth, cellHeight);
      ctx.fillText(landmark.icon ?? "•", center.x, center.y);
    }
    ctx.restore();

    if (phase === "memorise") {
      drawRouteLine(ctx, correctRoute, cellWidth, cellHeight, PURPLE, { width: 5 });
      drawPathDots(ctx, correctRoute.slice(1, -1), cellWidth, cellHeight, PURPLE);
    }

    if (phase === "draw") {
      drawRouteLine(ctx, currentDrawnPath, cellWidth, cellHeight, GOLD, { width: 5 });
      drawPathDots(ctx, currentDrawnPath, cellWidth, cellHeight, GOLD);
    }

    if (phase === "result") {
      drawRouteLine(ctx, correctRoute, cellWidth, cellHeight, PURPLE, { width: 5, dashed: true });
      drawRouteLine(ctx, currentDrawnPath, cellWidth, cellHeight, GOLD, { width: 5 });
      drawPathDots(ctx, currentDrawnPath, cellWidth, cellHeight, GOLD);
    }

    const start = phase === "draw" ? currentDrawnPath[0] : correctRoute[0];
    const end = phase === "memorise" || phase === "result" ? correctRoute[correctRoute.length - 1] : null;

    if (start) {
      const center = getCellCenter(start, cellWidth, cellHeight);
      ctx.save();
      ctx.fillStyle = "#10B981";
      ctx.beginPath();
      ctx.arc(center.x, center.y, Math.min(cellWidth, cellHeight) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 ${Math.max(22, Math.min(cellWidth, cellHeight) * 0.28)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S", center.x, center.y + 1);
      ctx.restore();
    }

    if (end) {
      const center = getCellCenter(end, cellWidth, cellHeight);
      ctx.save();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(center.x, center.y, Math.min(cellWidth, cellHeight) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `700 ${Math.max(22, Math.min(cellWidth, cellHeight) * 0.28)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("E", center.x, center.y + 1);
      ctx.restore();
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const currentMap = map;
    if (!canvas || !currentMap) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvasSize * ratio;
    canvas.height = canvasSize * ratio;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const phase = screen === "result" ? "result" : screen === "draw" ? "draw" : "memorise";
    renderGrid(ctx, currentMap, drawnPath, phase);
  }, [blockedFlashCell, canvasSize, drawnPath, map, screen, sessionResult]);

  const resultAccuracy = Math.round(sessionResult?.accuracyPct ?? 0);
  const resultTier = Number(userState?.current_tier ?? map?.difficulty_tier ?? 1);
  const nextTier = Math.min(10, resultTier + 1);
  const winProgress = Math.min(3, Number(userState?.consecutive_wins ?? 0));

  if (screen === "loading") {
    return (
      <div className="spatial-screen spatial-center">
        <style>{spatialStyles}</style>
        <div className="spatial-spinner" />
        <p className="spatial-loading">{text.loading}</p>
      </div>
    );
  }

  return (
    <div className="spatial-screen">
      <style>{spatialStyles}</style>

      {screen === "intro" && (
        <section className="spatial-panel spatial-intro">
          <div className="spatial-logo-row">
            <div className="spatial-logo">V</div>
          </div>

          <div className="spatial-hero-icon" aria-hidden="true">🗺️</div>
          <h1 className="spatial-title">{text.title}</h1>
          <p className="spatial-subtitle">{text.subtitle}</p>
          <div className="spatial-badge">{text.level} {map?.difficulty_tier ?? 1}</div>

          <div className="spatial-canvas-wrap spatial-canvas-intro">
            <canvas ref={canvasRef} className="spatial-canvas" aria-label={text.title} />
          </div>

          {loadNote && <p className="spatial-note">{loadNote}</p>}

          <button className="spatial-primary-button" type="button" onClick={beginMemorise}>
            {text.start}
          </button>
          <p className="spatial-hint">{text.introHint}</p>
        </section>
      )}

      {(screen === "memorise" || screen === "draw") && (
        <section className="spatial-panel spatial-play">
          <header className="spatial-play-header">
            <h1>{screen === "memorise" ? text.memoriseTitle : text.drawTitle}</h1>
            <button type="button" onClick={handleExit} className="spatial-exit-button">⏹ {text.exit}</button>
          </header>

          <div className="spatial-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="spatial-canvas"
              aria-label={screen === "memorise" ? text.memoriseTitle : text.drawTitle}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleTouchStart}
              onMouseMove={handleTouchMove}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            />
          </div>

          {screen === "memorise" && (
            <>
              <div className="spatial-countdown-track">
                <div className="spatial-countdown-fill" style={{ width: `${countdownRatio * 100}%` }} />
              </div>
              <p className="spatial-hint">{text.remember} {Math.ceil(countdown)} {text.seconds}</p>
            </>
          )}

          {screen === "draw" && (
            <>
              <p className="spatial-hint">{text.drawHint}</p>
              {drawnPath.length >= 3 && (
                <button className="spatial-primary-button" type="button" onClick={submitPath} disabled={savingResult}>
                  {text.done}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {screen === "result" && (
        <section className="spatial-panel spatial-result">
          <div className="spatial-result-icon" aria-hidden="true">{resultAccuracy >= 60 ? "🎉" : "😊"}</div>
          <h1 className="spatial-title">{resultAccuracy >= 60 ? text.resultGreat : text.resultTry}</h1>

          <div className="spatial-canvas-wrap spatial-canvas-result">
            <canvas ref={canvasRef} className="spatial-canvas" aria-label={text.readySoon} />
          </div>

          <div className="spatial-stats">
            <div>
              <span>{text.accuracy}</span>
              <strong>{resultAccuracy}%</strong>
            </div>
            <div>
              <span>{text.streak}</span>
              <strong>{userState?.streak_days ?? 1} {text.days}</strong>
            </div>
            <div>
              <span>{text.score}</span>
              <strong>{sessionResult?.score ?? 0}</strong>
            </div>
            <div>
              <span>{text.level}</span>
              <strong>{text.level} {resultTier}</strong>
            </div>
          </div>

          <div className="spatial-progress-track" aria-hidden="true">
            <div className="spatial-progress-fill" style={{ width: `${(winProgress / 3) * 100}%` }} />
          </div>
          <p className="spatial-hint">{text.progressNext} {nextTier}</p>

          <div className="spatial-result-actions">
            <button className="spatial-secondary-button" type="button" onClick={loadGame}>{text.replay}</button>
            <button className="spatial-primary-button" type="button" onClick={handleExit}>{text.finish}</button>
          </div>
        </section>
      )}
    </div>
  );
}

const spatialStyles = `
  .spatial-screen {
    min-height: 100vh;
    width: 100%;
    background: ${BACKGROUND};
    color: #2F2135;
    display: flex;
    justify-content: center;
    align-items: stretch;
    padding: 24px;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .spatial-center {
    align-items: center;
    flex-direction: column;
    gap: 28px;
  }

  .spatial-panel {
    width: min(100%, 720px);
    min-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
  }

  .spatial-intro {
    align-items: center;
    text-align: center;
  }

  .spatial-logo-row {
    width: 100%;
    display: flex;
    justify-content: flex-start;
  }

  .spatial-logo {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: ${PURPLE};
    color: #FFFFFF;
    display: grid;
    place-items: center;
    font-size: 36px;
    font-weight: 900;
    box-shadow: 0 10px 22px rgba(107, 33, 168, 0.24);
  }

  .spatial-hero-icon,
  .spatial-result-icon {
    font-size: 76px;
    line-height: 1;
    margin-top: 10px;
  }

  .spatial-title {
    margin: 18px 0 0;
    font-size: clamp(42px, 7vw, 62px);
    line-height: 1.02;
    color: #2F2135;
    font-weight: 850;
    letter-spacing: 0;
  }

  .spatial-subtitle,
  .spatial-hint,
  .spatial-note,
  .spatial-loading {
    margin: 14px 0 0;
    font-size: 24px;
    line-height: 1.32;
    color: #5B4A61;
    letter-spacing: 0;
  }

  .spatial-loading {
    color: ${PURPLE};
    font-weight: 800;
  }

  .spatial-note {
    color: #7C4A00;
    font-weight: 700;
  }

  .spatial-badge {
    min-height: 64px;
    margin-top: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: ${GOLD};
    color: #FFFFFF;
    padding: 0 28px;
    font-size: 24px;
    font-weight: 850;
    box-shadow: 0 12px 24px rgba(245, 158, 11, 0.22);
  }

  .spatial-canvas-wrap {
    width: 100%;
    max-width: 480px;
    min-width: 320px;
    margin: 26px auto 0;
    display: flex;
    justify-content: center;
  }

  .spatial-canvas-intro {
    max-width: 360px;
  }

  .spatial-canvas-result {
    max-width: 400px;
  }

  .spatial-canvas {
    display: block;
    border-radius: 20px;
    border: 3px solid #E5E3DF;
    background: ${BACKGROUND};
    box-shadow: 0 16px 32px rgba(43, 31, 24, 0.08);
    touch-action: none;
  }

  .spatial-primary-button,
  .spatial-secondary-button,
  .spatial-exit-button {
    min-height: 72px;
    min-width: 64px;
    border: 0;
    border-radius: 999px;
    font-size: 24px;
    line-height: 1.1;
    font-weight: 850;
    cursor: pointer;
    letter-spacing: 0;
  }

  .spatial-primary-button {
    width: 100%;
    margin-top: 26px;
    background: ${PURPLE};
    color: #FFFFFF;
    box-shadow: 0 16px 30px rgba(107, 33, 168, 0.24);
  }

  .spatial-primary-button:disabled {
    opacity: 0.68;
  }

  .spatial-secondary-button {
    width: 100%;
    margin-top: 26px;
    background: #FFFFFF;
    color: ${PURPLE};
    border: 3px solid #E5D4F4;
  }

  .spatial-play-header {
    min-height: 82px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 18px;
    align-items: center;
  }

  .spatial-play-header h1 {
    margin: 0;
    font-size: clamp(30px, 5vw, 44px);
    line-height: 1.05;
    color: #2F2135;
    letter-spacing: 0;
  }

  .spatial-exit-button {
    padding: 0 22px;
    background: #FFFFFF;
    color: #2F2135;
    border: 3px solid #E5E3DF;
  }

  .spatial-countdown-track,
  .spatial-progress-track {
    width: min(100%, 480px);
    height: 14px;
    border-radius: 999px;
    background: #E5E3DF;
    overflow: hidden;
    margin: 24px auto 0;
  }

  .spatial-countdown-fill,
  .spatial-progress-fill {
    height: 100%;
    background: ${PURPLE};
    border-radius: inherit;
    transition: width 180ms linear;
  }

  .spatial-result {
    align-items: center;
    text-align: center;
  }

  .spatial-stats {
    width: 100%;
    margin-top: 24px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    border: 3px solid #EDE2D1;
    background: #FFFFFF;
    border-radius: 26px;
    padding: 18px;
  }

  .spatial-stats div {
    min-height: 96px;
    border-radius: 20px;
    background: #FFF9F1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
  }

  .spatial-stats span {
    font-size: 22px;
    color: #6A5A70;
    font-weight: 750;
  }

  .spatial-stats strong {
    font-size: 34px;
    color: #2F2135;
    font-weight: 900;
  }

  .spatial-result-actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .spatial-spinner {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    border: 8px solid #E9D5FF;
    border-top-color: ${PURPLE};
    animation: spatial-spin 900ms linear infinite;
  }

  @keyframes spatial-spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 520px) {
    .spatial-screen {
      padding: 16px;
    }

    .spatial-panel {
      min-height: calc(100vh - 32px);
    }

    .spatial-play-header {
      grid-template-columns: 1fr;
    }

    .spatial-result-actions,
    .spatial-stats {
      grid-template-columns: 1fr;
    }
  }
`;

// TODO: Named landmark mode (higher tiers): combine spatial and verbal memory with familiar place names.
// TODO: 3D perspective view: add an isometric street view for upper tiers.
// TODO: Caregiver dashboard data: surface seven-day accuracy trends as cognitive signals.
// TODO: VYVA voice integration: read the route aloud after memorisation.
// TODO: Sea Hero Quest leaderboard integration: explore anonymised research contribution options.
