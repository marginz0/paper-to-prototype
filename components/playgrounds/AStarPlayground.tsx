"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  CANONICAL_ASTAR_GRID,
  DEFAULT_HEURISTIC_WEIGHT,
  MAX_HEURISTIC_WEIGHT,
  MIN_HEURISTIC_WEIGHT,
  createAStarGrid,
  createInitialAStarState,
  positionKey,
  resetAStar,
  stepAStar,
  type AStarState,
  type GridPosition,
} from "@/lib/algorithms/astar";

const SPEED_OPTIONS = [
  { id: "slow", label: "Slow", delay: 900 },
  { id: "standard", label: "Standard", delay: 520 },
  { id: "quick", label: "Quick", delay: 260 },
] as const;

const OPEN_FIELD_GRID = createAStarGrid({
  rows: CANONICAL_ASTAR_GRID.rows,
  columns: CANONICAL_ASTAR_GRID.columns,
  start: CANONICAL_ASTAR_GRID.start,
  goal: CANONICAL_ASTAR_GRID.goal,
});

type SpeedId = (typeof SPEED_OPTIONS)[number]["id"];
type EditMode = "wall" | "start" | "goal";
type PresetId = "canonical" | "open" | "custom";

const TERMINAL_STATUSES = new Set<AStarState["status"]>(["found", "no-path"]);

function positionsEqual(first: GridPosition, second: GridPosition): boolean {
  return first.row === second.row && first.column === second.column;
}

function parsePositionKey(key: string): GridPosition | null {
  const [rowText, columnText, ...rest] = key.split(",");
  const row = Number(rowText);
  const column = Number(columnText);

  if (
    rest.length > 0 ||
    !Number.isInteger(row) ||
    !Number.isInteger(column)
  ) {
    return null;
  }

  return { row, column };
}

function directionGlyph(from: GridPosition, to: GridPosition): string {
  if (to.row < from.row) return "↑";
  if (to.row > from.row) return "↓";
  if (to.column < from.column) return "←";
  if (to.column > from.column) return "→";
  return "•";
}

function predecessorGlyph(
  position: GridPosition,
  cameFrom: AStarState["cameFrom"],
): string | null {
  const predecessorKey = cameFrom[positionKey(position)];
  if (predecessorKey === undefined) {
    return null;
  }

  const predecessor = parsePositionKey(predecessorKey);
  return predecessor === null ? null : directionGlyph(position, predecessor);
}

function getWeightLabel(weight: number): string {
  if (weight === 0) return "Uniform-cost search";
  if (weight === 1) return "Standard A*";
  if (weight < 1) return "Cautious A*";
  return "Weighted A*";
}

function getWeightExplanation(weight: number): string {
  if (weight === 0) {
    return "With w = 0, the heuristic disappears and f(n) = g(n). The search behaves as uniform-cost search.";
  }
  if (weight === 1) {
    return "With w = 1, path cost and Manhattan distance have their standard A* balance. On this four-way grid, the result is optimal.";
  }
  if (weight < 1) {
    return "A smaller heuristic weight is still conservative: it usually expands more nodes while retaining an optimal result here.";
  }
  return "A weight above 1 favors cells that look closer to the goal. It can search faster, but the first path found is no longer guaranteed optimal.";
}

function getStatusCopy(state: AStarState): {
  label: string;
  title: string;
  body: string;
} {
  if (state.status === "found") {
    return {
      label: "Path found",
      title: "Follow the predecessor chain back to start.",
      body: `The goal left the frontier with the lowest priority. Backtracking the arrows reveals a route costing ${state.metrics.pathCost ?? 0}.`,
    };
  }

  if (state.status === "no-path") {
    return {
      label: "No path",
      title: "The frontier is empty.",
      body: "Every reachable cell has been expanded without reaching the goal. Move an endpoint or remove a wall, then restart.",
    };
  }

  if (state.current !== null) {
    const { position, g, h, f } = state.current;
    return {
      label: "Expand one node",
      title: `Current cell: row ${position.row + 1}, column ${position.column + 1}`,
      body: `Its scores are g = ${g}, h = ${h}, and f = ${f.toFixed(2)}. Valid neighbors receive a tentative cost and a predecessor arrow before the frontier is sorted again.`,
    };
  }

  return {
    label: "Ready",
    title: "Start with one cell in the frontier.",
    body: "Step once to choose the lowest-priority frontier cell, mark it current, and inspect its four orthogonal neighbors.",
  };
}

function getCellPrimarySymbol(options: {
  isStart: boolean;
  isGoal: boolean;
  isWall: boolean;
  isPath: boolean;
  isCurrent: boolean;
  isClosed: boolean;
  isOpen: boolean;
  pathDirection: string | null;
}): string {
  if (options.isStart && options.isGoal) return "S/G";
  if (options.isStart) return "S";
  if (options.isGoal) return "G";
  if (options.isWall) return "■";
  if (options.isPath) return options.pathDirection ?? "•";
  if (options.isCurrent) return "◎";
  if (options.isClosed) return "×";
  if (options.isOpen) return "○";
  return "";
}

function getCellLabel(options: {
  position: GridPosition;
  isStart: boolean;
  isGoal: boolean;
  isWall: boolean;
  isPath: boolean;
  isCurrent: boolean;
  isClosed: boolean;
  isOpen: boolean;
  predecessor: string | null;
}): string {
  const labels = [
    `Row ${options.position.row + 1}, column ${options.position.column + 1}`,
  ];

  if (options.isStart) labels.push("start");
  if (options.isGoal) labels.push("goal");
  if (options.isWall) labels.push("wall");
  if (options.isPath) labels.push("final path");
  if (options.isCurrent) labels.push("current node");
  if (options.isClosed) labels.push("expanded");
  if (options.isOpen) labels.push("frontier");
  if (options.predecessor !== null) {
    labels.push(`predecessor points ${options.predecessor}`);
  }
  if (labels.length === 1) labels.push("unvisited");

  return labels.join(", ");
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

export function AStarPlayground() {
  const [state, setState] = useState(() => createInitialAStarState({
    grid: CANONICAL_ASTAR_GRID,
    heuristicWeight: DEFAULT_HEURISTIC_WEIGHT,
  }));
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedId>("standard");
  const [editMode, setEditMode] = useState<EditMode>("wall");
  const [preset, setPreset] = useState<PresetId>("canonical");
  const [editMessage, setEditMessage] = useState(
    "Wall brush selected. Tap a cell to toggle a wall.",
  );
  const [focusedCell, setFocusedCell] = useState(() =>
    positionKey(CANONICAL_ASTAR_GRID.start),
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const selectedSpeed =
    SPEED_OPTIONS.find((option) => option.id === speed) ?? SPEED_OPTIONS[1];
  const speedDelay = prefersReducedMotion
    ? Math.max(selectedSpeed.delay, 900)
    : selectedSpeed.delay;
  const isTerminal = TERMINAL_STATUSES.has(state.status);
  const statusCopy = useMemo(() => getStatusCopy(state), [state]);

  const wallKeys = useMemo(
    () => new Set(state.grid.walls.map((wall) => positionKey(wall))),
    [state.grid.walls],
  );
  const openKeys = useMemo(
    () => new Set(state.open.map((node) => positionKey(node.position))),
    [state.open],
  );
  const closedKeys = useMemo(
    () => new Set(state.closed.map((node) => positionKey(node.position))),
    [state.closed],
  );
  const pathKeys = useMemo(
    () => new Set(state.finalPath.map((position) => positionKey(position))),
    [state.finalPath],
  );
  const pathDirections = useMemo(() => {
    const directions = new Map<string, string>();
    for (let index = 0; index < state.finalPath.length - 1; index += 1) {
      const position = state.finalPath[index];
      const next = state.finalPath[index + 1];
      directions.set(positionKey(position), directionGlyph(position, next));
    }
    return directions;
  }, [state.finalPath]);
  const currentKey =
    state.current === null ? null : positionKey(state.current.position);

  const stepOnce = useCallback(() => {
    setEditMessage("");
    setState((current) => stepAStar(current));
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setState((current) =>
        TERMINAL_STATUSES.has(current.status) ? current : stepAStar(current),
      );
    }, speedDelay);

    return () => window.clearInterval(timer);
  }, [isPlaying, speedDelay]);

  useEffect(() => {
    if (isTerminal && isPlaying) {
      setIsPlaying(false);
    }
  }, [isPlaying, isTerminal]);

  function restartSearch() {
    setIsPlaying(false);
    setEditMessage("Search restarted. Your walls and endpoints are unchanged.");
    setState((current) => resetAStar(current));
  }

  function resetBoard() {
    setIsPlaying(false);
    setPreset("canonical");
    setEditMessage("Canonical board restored.");
    setState((current) =>
      resetAStar(current, { grid: CANONICAL_ASTAR_GRID }),
    );
  }

  function handleWeightChange(weight: number) {
    setIsPlaying(false);
    setEditMessage(`Heuristic weight changed to ${weight}. Search restarted.`);
    setState((current) => resetAStar(current, { heuristicWeight: weight }));
  }

  function handlePresetChange(nextPreset: Exclude<PresetId, "custom">) {
    const grid = nextPreset === "canonical" ? CANONICAL_ASTAR_GRID : OPEN_FIELD_GRID;
    setIsPlaying(false);
    setPreset(nextPreset);
    setEditMessage(
      nextPreset === "canonical"
        ? "Canonical board loaded."
        : "Open field loaded with the canonical endpoints.",
    );
    setState((current) => resetAStar(current, { grid }));
  }

  function selectEditMode(mode: EditMode) {
    setEditMode(mode);
    const messages: Record<EditMode, string> = {
      wall: "Wall brush selected. Tap a cell to toggle a wall.",
      start: "Start mode selected. Tap a cell to move S.",
      goal: "Goal mode selected. Tap a cell to move G.",
    };
    setEditMessage(messages[mode]);
  }

  function editCell(position: GridPosition) {
    setIsPlaying(false);

    const positionId = positionKey(position);
    const startId = positionKey(state.grid.start);
    const goalId = positionKey(state.grid.goal);
    let start = state.grid.start;
    let goal = state.grid.goal;
    let walls = state.grid.walls.filter(
      (wall) => positionKey(wall) !== positionId,
    );

    if (editMode === "wall") {
      if (positionId === startId || positionId === goalId) {
        setEditMessage("Endpoints cannot be walls. Choose Start or Goal mode to move them.");
        return;
      }

      if (!wallKeys.has(positionId)) {
        walls = [...walls, position];
        setEditMessage(
          `Wall added at row ${position.row + 1}, column ${position.column + 1}.`,
        );
      } else {
        setEditMessage(
          `Wall removed at row ${position.row + 1}, column ${position.column + 1}.`,
        );
      }
    } else if (editMode === "start") {
      start = position;
      setEditMessage(
        `Start moved to row ${position.row + 1}, column ${position.column + 1}.`,
      );
    } else {
      goal = position;
      setEditMessage(
        `Goal moved to row ${position.row + 1}, column ${position.column + 1}.`,
      );
    }

    const grid = createAStarGrid({
      rows: state.grid.rows,
      columns: state.grid.columns,
      start,
      goal,
      walls,
    });
    setPreset("custom");
    setState(resetAStar(state, { grid }));
  }

  function handleCellKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    position: GridPosition,
  ) {
    const offsets: Partial<Record<string, GridPosition>> = {
      ArrowUp: { row: -1, column: 0 },
      ArrowDown: { row: 1, column: 0 },
      ArrowLeft: { row: 0, column: -1 },
      ArrowRight: { row: 0, column: 1 },
    };
    const offset = offsets[event.key];
    if (offset === undefined) return;

    const next = {
      row: Math.min(state.grid.rows - 1, Math.max(0, position.row + offset.row)),
      column: Math.min(
        state.grid.columns - 1,
        Math.max(0, position.column + offset.column),
      ),
    };
    const nextKey = positionKey(next);
    event.preventDefault();
    setFocusedCell(nextKey);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-row="${next.row}"][data-column="${next.column}"]`,
      )
      ?.focus();
  }

  const cells = Array.from(
    { length: state.grid.rows * state.grid.columns },
    (_, index) => ({
      row: Math.floor(index / state.grid.columns),
      column: index % state.grid.columns,
    }),
  );

  return (
    <section
      className="playground-shell astar-playground"
      aria-labelledby="astar-playground-heading"
    >
      <div className="playground-heading-row">
        <div>
          <p className="eyebrow">Interactive workbench</p>
          <h2 id="astar-playground-heading">A* search, one expansion at a time</h2>
        </div>
        <p>
          Edit the board, tune the heuristic, and watch frontier priorities turn
          local choices into a complete route.
        </p>
      </div>

      <div className="playground-workbench astar-workbench">
        <aside className="control-panel astar-control-panel" aria-label="A* controls">
          <div className="control-group astar-preset-control">
            <label className="control-label-row" htmlFor="astar-preset">
              <span>Board preset</span>
              <output>{preset === "custom" ? "Custom" : preset === "open" ? "Open" : "Canonical"}</output>
            </label>
            <select
              id="astar-preset"
              className="astar-select"
              value={preset}
              onChange={(event) => {
                if (event.target.value !== "custom") {
                  handlePresetChange(event.target.value as Exclude<PresetId, "custom">);
                }
              }}
            >
              <option value="canonical">Canonical maze</option>
              <option value="open">Open field</option>
              {preset === "custom" && <option value="custom">Custom board</option>}
            </select>
          </div>

          <div className="control-group astar-mode-control">
            <span className="control-label" id="astar-mode-label">
              Tap action
            </span>
            <div className="astar-mode-buttons" role="group" aria-labelledby="astar-mode-label">
              {([
                ["wall", "▦", "Walls"],
                ["start", "S", "Start"],
                ["goal", "G", "Goal"],
              ] as const).map(([mode, symbol, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={editMode === mode ? "is-selected" : undefined}
                  aria-pressed={editMode === mode}
                  onClick={() => selectEditMode(mode)}
                >
                  <span aria-hidden="true">{symbol}</span>
                  {label}
                </button>
              ))}
            </div>
            <p className="control-hint" aria-live="polite">
              {editMessage}
            </p>
          </div>

          <div className="control-group astar-weight-control">
            <label className="control-label-row" htmlFor="astar-weight">
              <span>Heuristic weight</span>
              <output>{state.heuristicWeight.toFixed(2).replace(/\.00$/, "")}</output>
            </label>
            <input
              id="astar-weight"
              className="astar-range"
              type="range"
              min={MIN_HEURISTIC_WEIGHT}
              max={MAX_HEURISTIC_WEIGHT}
              step="0.25"
              value={state.heuristicWeight}
              aria-valuetext={`${state.heuristicWeight}: ${getWeightLabel(state.heuristicWeight)}`}
              onChange={(event) => handleWeightChange(Number(event.target.value))}
            />
            <div className="astar-range-labels" aria-hidden="true">
              <span>0 · UCS</span>
              <span>1 · A*</span>
              <span>2 · Weighted</span>
            </div>
            <div
              className="astar-weight-presets"
              role="group"
              aria-label="Heuristic weight presets"
            >
              {([0, 1, 2] as const).map((weight) => (
                <button
                  key={weight}
                  type="button"
                  className={state.heuristicWeight === weight ? "is-selected" : undefined}
                  aria-pressed={state.heuristicWeight === weight}
                  onClick={() => handleWeightChange(weight)}
                >
                  {weight === 0 ? "Dijkstra · 0" : weight === 1 ? "A* · 1" : "Weighted · 2"}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group">
            <span className="control-label" id="astar-speed-label">
              Animation speed
            </span>
            <div className="speed-control" role="group" aria-labelledby="astar-speed-label">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={speed === option.id ? "is-selected" : undefined}
                  aria-pressed={speed === option.id}
                  onClick={() => setSpeed(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {prefersReducedMotion && (
              <p className="control-hint">Reduced motion is active, so autoplay uses the slow pace.</p>
            )}
          </div>

          <div className="transport-controls astar-transport-controls">
            <button
              type="button"
              className="button button-primary transport-main"
              onClick={() => setIsPlaying((playing) => !playing)}
              disabled={isTerminal}
              aria-label={isPlaying ? "Pause A* search" : "Play A* search"}
            >
              <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={stepOnce}
              disabled={isPlaying || isTerminal}
              aria-label="Expand one A* frontier node"
            >
              Step <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="astar-board-actions">
            <button type="button" className="reset-button" onClick={restartSearch}>
              Restart search
            </button>
            <button type="button" className="reset-button" onClick={resetBoard}>
              Reset board
            </button>
          </div>

          <div className={`phase-note${isTerminal ? " phase-note-complete" : ""}`}>
            <span>{statusCopy.label}</span>
            <strong>{statusCopy.title}</strong>
            <p>{statusCopy.body}</p>
          </div>
        </aside>

        <div className="visualization-panel astar-visualization-panel">
          <div className="metrics-grid astar-metrics-grid" aria-label="Current A* metrics">
            <div>
              <span>Status</span>
              <strong>{state.status === "no-path" ? "No path" : state.status}</strong>
            </div>
            <div>
              <span>Expanded</span>
              <strong>{state.metrics.expandedNodes}</strong>
            </div>
            <div>
              <span>Frontier</span>
              <strong>{state.metrics.frontierSize}</strong>
            </div>
            <div>
              <span>Path cost</span>
              <strong>{state.metrics.pathCost ?? "—"}</strong>
            </div>
          </div>

          <div className="astar-secondary-metrics" aria-label="Additional A* metrics">
            <span>Current g <strong>{state.current?.g ?? "—"}</strong></span>
            <span>Current h <strong>{state.current?.h ?? "—"}</strong></span>
            <span>Current f <strong>{state.current === null ? "—" : state.current.f.toFixed(2)}</strong></span>
            <span>Steps <strong>{state.metrics.steps}</strong></span>
            <span>Discovered <strong>{state.metrics.discoveredNodes}</strong></span>
            <span>Peak frontier <strong>{state.metrics.maxFrontierSize}</strong></span>
            <span>Path length <strong>{state.metrics.pathLength ?? "—"}</strong></span>
          </div>

          <div className="astar-grid-frame">
            <div className="plot-label-row">
              <span>{state.grid.rows} × {state.grid.columns} orthogonal grid</span>
              <span>Tap to edit · arrows point to predecessors</span>
            </div>
            <p id="astar-grid-instructions" className="sr-only">
              Select Walls, Start, or Goal, then activate a grid cell to edit the board.
              Row and column numbers are included in every cell label.
            </p>
            <div
              ref={gridRef}
              className="astar-grid"
              role="grid"
              aria-label="Editable A* search grid"
              aria-describedby="astar-grid-instructions"
              aria-rowcount={state.grid.rows}
              aria-colcount={state.grid.columns}
              aria-busy={isPlaying}
              style={{ gridTemplateColumns: `repeat(${state.grid.columns}, minmax(0, 1fr))` }}
            >
              {cells.map((position) => {
                const key = positionKey(position);
                const isStart = positionsEqual(position, state.grid.start);
                const isGoal = positionsEqual(position, state.grid.goal);
                const isWall = wallKeys.has(key);
                const isOpen = openKeys.has(key);
                const isClosed = closedKeys.has(key);
                const isCurrent = currentKey === key;
                const isPath = pathKeys.has(key);
                const predecessor = predecessorGlyph(position, state.cameFrom);
                const pathDirection = pathDirections.get(key) ?? null;
                const symbol = getCellPrimarySymbol({
                  isStart,
                  isGoal,
                  isWall,
                  isPath,
                  isCurrent,
                  isClosed,
                  isOpen,
                  pathDirection,
                });
                const classes = [
                  "astar-cell",
                  isWall && "astar-cell-wall",
                  isOpen && "astar-cell-open",
                  isClosed && "astar-cell-closed",
                  isCurrent && "astar-cell-current",
                  isPath && "astar-cell-path",
                  isStart && "astar-cell-start",
                  isGoal && "astar-cell-goal",
                ].filter(Boolean).join(" ");

                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    className={classes}
                    aria-rowindex={position.row + 1}
                    aria-colindex={position.column + 1}
                    aria-label={getCellLabel({
                      position,
                      isStart,
                      isGoal,
                      isWall,
                      isPath,
                      isCurrent,
                      isClosed,
                      isOpen,
                      predecessor,
                    })}
                    data-row={position.row}
                    data-column={position.column}
                    tabIndex={focusedCell === key ? 0 : -1}
                    onFocus={() => setFocusedCell(key)}
                    onKeyDown={(event) => handleCellKeyDown(event, position)}
                    onClick={() => editCell(position)}
                  >
                    <span className="astar-cell-symbol" aria-hidden="true">{symbol}</span>
                    {predecessor !== null && !isWall && !isStart && !isGoal && (
                      <span className="astar-predecessor" aria-hidden="true">
                        {predecessor}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="astar-legend" aria-label="Grid state legend">
              <span><i className="astar-legend-start" aria-hidden="true">S</i> Start</span>
              <span><i className="astar-legend-goal" aria-hidden="true">G</i> Goal</span>
              <span><i className="astar-legend-wall" aria-hidden="true">■</i> Wall</span>
              <span><i className="astar-legend-open" aria-hidden="true">○</i> Frontier</span>
              <span><i className="astar-legend-closed" aria-hidden="true">×</i> Expanded</span>
              <span><i className="astar-legend-current" aria-hidden="true">◎</i> Current</span>
              <span><i className="astar-legend-path" aria-hidden="true">→</i> Final path</span>
              <span><i className="astar-legend-predecessor" aria-hidden="true">↖</i> Predecessor</span>
            </div>
          </div>

          <div className="astar-formula-panel">
            <div>
              <span>Priority formula</span>
              <code>
                f(n) = g(n) + {state.heuristicWeight.toFixed(2).replace(/\.00$/, "")} × h(n)
              </code>
            </div>
            <p>
              <strong>{getWeightLabel(state.heuristicWeight)}.</strong>{" "}
              {getWeightExplanation(state.heuristicWeight)}
            </p>
          </div>

          <p
            className="sr-only"
            aria-live={isPlaying ? "off" : "polite"}
          >
            {statusCopy.label}. {state.metrics.expandedNodes} nodes expanded.
            Frontier size {state.metrics.frontierSize}.
          </p>
        </div>
      </div>
    </section>
  );
}
