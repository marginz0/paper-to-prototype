export const MIN_HEURISTIC_WEIGHT = 0;
export const MAX_HEURISTIC_WEIGHT = 2;
export const DEFAULT_HEURISTIC_WEIGHT = 1;

export interface GridPosition {
  readonly row: number;
  readonly column: number;
}

export interface AStarGrid {
  readonly rows: number;
  readonly columns: number;
  readonly start: GridPosition;
  readonly goal: GridPosition;
  readonly walls: readonly GridPosition[];
}

export interface AStarNode {
  readonly position: GridPosition;
  /** Exact path cost from the start to this node. */
  readonly g: number;
  /** Unweighted Manhattan estimate from this node to the goal. */
  readonly h: number;
  /** Priority used by the frontier: g + heuristicWeight * h. */
  readonly f: number;
}

export type AStarStatus = "ready" | "searching" | "found" | "no-path";

export interface AStarMetrics {
  /** Number of calls to stepAStar that expanded a node. */
  readonly steps: number;
  /** Total node expansions, including a node if a better path reopens it. */
  readonly expandedNodes: number;
  /** Number of unique grid positions reached, including the start. */
  readonly discoveredNodes: number;
  readonly frontierSize: number;
  readonly maxFrontierSize: number;
  readonly pathCost: number | null;
  /** Number of grid moves in the final path. */
  readonly pathLength: number | null;
}

export interface AStarState {
  readonly grid: AStarGrid;
  readonly heuristicWeight: number;
  readonly status: AStarStatus;
  /** Frontier nodes in deterministic expansion order. */
  readonly open: readonly AStarNode[];
  /** Expanded nodes in expansion order. */
  readonly closed: readonly AStarNode[];
  /** The node expanded by the most recent step. */
  readonly current: AStarNode | null;
  /** Child-position key to predecessor-position key. */
  readonly cameFrom: Readonly<Record<string, string>>;
  readonly finalPath: readonly GridPosition[];
  readonly metrics: AStarMetrics;
}

export interface CreateAStarGridOptions {
  readonly rows: number;
  readonly columns: number;
  readonly start: GridPosition;
  readonly goal: GridPosition;
  readonly walls?: readonly GridPosition[];
}

export interface CreateAStarOptions {
  readonly grid?: AStarGrid;
  readonly heuristicWeight?: number;
}

export interface ResetAStarOptions {
  readonly grid?: AStarGrid;
  readonly heuristicWeight?: number;
}

/** Stable key used by cameFrom and convenient for SVG cell membership checks. */
export function positionKey({ row, column }: GridPosition): string {
  return `${row},${column}`;
}

export function manhattanDistance(
  first: GridPosition,
  second: GridPosition,
): number {
  return Math.abs(first.row - second.row) + Math.abs(first.column - second.column);
}

/**
 * Validates and normalizes a rectangular board. Walls are copied, de-duplicated,
 * and sorted so equivalent board inputs always produce the same state.
 */
export function createAStarGrid({
  rows,
  columns,
  start,
  goal,
  walls = [],
}: CreateAStarGridOptions): AStarGrid {
  assertDimension(rows, "rows");
  assertDimension(columns, "columns");
  assertPositionInGrid(start, rows, columns, "start");
  assertPositionInGrid(goal, rows, columns, "goal");

  const uniqueWalls = new Map<string, GridPosition>();
  walls.forEach((wall, index) => {
    assertPositionInGrid(wall, rows, columns, `wall ${index}`);

    if (positionsEqual(wall, start) || positionsEqual(wall, goal)) {
      throw new RangeError("Walls cannot overlap the start or goal.");
    }

    uniqueWalls.set(positionKey(wall), copyPosition(wall));
  });

  return {
    rows,
    columns,
    start: copyPosition(start),
    goal: copyPosition(goal),
    walls: [...uniqueWalls.values()].sort(comparePositions),
  };
}

/** A compact preset with multiple barriers and a guaranteed route. */
export const CANONICAL_ASTAR_GRID: AStarGrid = createAStarGrid({
  rows: 9,
  columns: 13,
  start: { row: 7, column: 1 },
  goal: { row: 1, column: 11 },
  walls: [
    { row: 1, column: 4 },
    { row: 1, column: 8 },
    { row: 2, column: 4 },
    { row: 2, column: 6 },
    { row: 2, column: 8 },
    { row: 3, column: 2 },
    { row: 3, column: 3 },
    { row: 3, column: 4 },
    { row: 3, column: 6 },
    { row: 3, column: 8 },
    { row: 3, column: 9 },
    { row: 3, column: 10 },
    { row: 4, column: 6 },
    { row: 5, column: 1 },
    { row: 5, column: 2 },
    { row: 5, column: 3 },
    { row: 5, column: 4 },
    { row: 5, column: 5 },
    { row: 5, column: 6 },
    { row: 5, column: 8 },
    { row: 5, column: 9 },
    { row: 5, column: 10 },
    { row: 5, column: 11 },
    { row: 6, column: 8 },
    { row: 7, column: 8 },
  ],
});

export const DEFAULT_ASTAR_GRID = CANONICAL_ASTAR_GRID;

export function createInitialAStarState({
  grid = CANONICAL_ASTAR_GRID,
  heuristicWeight = DEFAULT_HEURISTIC_WEIGHT,
}: CreateAStarOptions = {}): AStarState {
  assertHeuristicWeight(heuristicWeight);
  const normalizedGrid = createAStarGrid(grid);
  const startNode = createNode(
    normalizedGrid.start,
    0,
    normalizedGrid.goal,
    heuristicWeight,
  );

  return {
    grid: normalizedGrid,
    heuristicWeight,
    status: "ready",
    open: [startNode],
    closed: [],
    current: null,
    cameFrom: {},
    finalPath: [],
    metrics: {
      steps: 0,
      expandedNodes: 0,
      discoveredNodes: 1,
      frontierSize: 1,
      maxFrontierSize: 1,
      pathCost: null,
      pathLength: null,
    },
  };
}

/**
 * Expands exactly one frontier node without mutating the previous state. Nodes
 * tie on f, then h, then row and column, making every replay deterministic.
 */
export function stepAStar(state: AStarState): AStarState {
  if (state.status === "found" || state.status === "no-path") {
    return state;
  }

  if (state.open.length === 0) {
    return {
      ...state,
      status: "no-path",
      current: null,
      metrics: {
        ...state.metrics,
        frontierSize: 0,
      },
    };
  }

  const orderedOpen = [...state.open].sort(compareNodes);
  const current = orderedOpen[0];
  let open = orderedOpen.slice(1);
  let closed = [...state.closed, current];
  const cameFrom: Record<string, string> = { ...state.cameFrom };
  const steps = state.metrics.steps + 1;
  const expandedNodes = state.metrics.expandedNodes + 1;

  if (positionsEqual(current.position, state.grid.goal)) {
    const finalPath = reconstructPath(
      state.grid.start,
      current.position,
      cameFrom,
    );

    return {
      ...state,
      status: "found",
      open,
      closed,
      current,
      cameFrom,
      finalPath,
      metrics: {
        ...state.metrics,
        steps,
        expandedNodes,
        frontierSize: open.length,
        pathCost: current.g,
        pathLength: finalPath.length - 1,
      },
    };
  }

  const wallKeys = new Set(state.grid.walls.map(positionKey));

  for (const neighbor of neighborsOf(current.position, state.grid)) {
    if (wallKeys.has(positionKey(neighbor))) {
      continue;
    }

    const neighborKey = positionKey(neighbor);
    const openIndex = open.findIndex(
      (node) => positionKey(node.position) === neighborKey,
    );
    const closedIndex = closed.findIndex(
      (node) => positionKey(node.position) === neighborKey,
    );
    const existing = openIndex >= 0 ? open[openIndex] : closed[closedIndex];
    const tentativeG = current.g + 1;

    if (existing && tentativeG >= existing.g) {
      continue;
    }

    const nextNode = createNode(
      neighbor,
      tentativeG,
      state.grid.goal,
      state.heuristicWeight,
    );
    cameFrom[neighborKey] = positionKey(current.position);

    if (openIndex >= 0) {
      open = open.map((node, index) => (index === openIndex ? nextNode : node));
    } else {
      open = [...open, nextNode];
    }

    // Weighted heuristics can be inconsistent, so a cheaper route is allowed to
    // reopen an already expanded node rather than silently discarding it.
    if (closedIndex >= 0) {
      closed = closed.filter((_, index) => index !== closedIndex);
    }
  }

  open.sort(compareNodes);
  const status: AStarStatus = open.length === 0 ? "no-path" : "searching";
  const discoveredNodes = Object.keys(cameFrom).length + 1;

  return {
    ...state,
    status,
    open,
    closed,
    current,
    cameFrom,
    finalPath: [],
    metrics: {
      ...state.metrics,
      steps,
      expandedNodes,
      discoveredNodes,
      frontierSize: open.length,
      maxFrontierSize: Math.max(state.metrics.maxFrontierSize, open.length),
      pathCost: null,
      pathLength: null,
    },
  };
}

/** Recreates a ready state, retaining the current board and weight by default. */
export function resetAStar(
  state: AStarState,
  options: ResetAStarOptions = {},
): AStarState {
  return createInitialAStarState({
    grid: options.grid ?? state.grid,
    heuristicWeight: options.heuristicWeight ?? state.heuristicWeight,
  });
}

function createNode(
  position: GridPosition,
  g: number,
  goal: GridPosition,
  heuristicWeight: number,
): AStarNode {
  const h = manhattanDistance(position, goal);
  return {
    position: copyPosition(position),
    g,
    h,
    f: g + heuristicWeight * h,
  };
}

function neighborsOf(
  position: GridPosition,
  grid: AStarGrid,
): GridPosition[] {
  const candidates: GridPosition[] = [
    { row: position.row - 1, column: position.column },
    { row: position.row, column: position.column - 1 },
    { row: position.row, column: position.column + 1 },
    { row: position.row + 1, column: position.column },
  ];

  return candidates.filter(
    ({ row, column }) =>
      row >= 0 && row < grid.rows && column >= 0 && column < grid.columns,
  );
}

function reconstructPath(
  start: GridPosition,
  goal: GridPosition,
  cameFrom: Readonly<Record<string, string>>,
): GridPosition[] {
  const path = [copyPosition(goal)];
  let cursorKey = positionKey(goal);
  const startKey = positionKey(start);

  while (cursorKey !== startKey) {
    const predecessorKey = cameFrom[cursorKey];
    if (predecessorKey === undefined) {
      throw new Error(`Cannot reconstruct a path to ${cursorKey}.`);
    }

    path.push(positionFromKey(predecessorKey));
    cursorKey = predecessorKey;
  }

  return path.reverse();
}

function positionFromKey(key: string): GridPosition {
  const [row, column] = key.split(",").map(Number);
  if (!Number.isInteger(row) || !Number.isInteger(column)) {
    throw new Error(`Invalid position key: ${key}.`);
  }
  return { row, column };
}

function compareNodes(first: AStarNode, second: AStarNode): number {
  return (
    first.f - second.f ||
    first.h - second.h ||
    comparePositions(first.position, second.position)
  );
}

function comparePositions(first: GridPosition, second: GridPosition): number {
  return first.row - second.row || first.column - second.column;
}

function positionsEqual(first: GridPosition, second: GridPosition): boolean {
  return first.row === second.row && first.column === second.column;
}

function copyPosition({ row, column }: GridPosition): GridPosition {
  return { row, column };
}

function assertDimension(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
}

function assertPositionInGrid(
  position: GridPosition,
  rows: number,
  columns: number,
  label: string,
): void {
  if (!Number.isInteger(position.row) || !Number.isInteger(position.column)) {
    throw new TypeError(`${label} must have integer row and column coordinates.`);
  }

  if (
    position.row < 0 ||
    position.row >= rows ||
    position.column < 0 ||
    position.column >= columns
  ) {
    throw new RangeError(`${label} must be inside the grid.`);
  }
}

function assertHeuristicWeight(weight: number): void {
  if (
    !Number.isFinite(weight) ||
    weight < MIN_HEURISTIC_WEIGHT ||
    weight > MAX_HEURISTIC_WEIGHT
  ) {
    throw new RangeError(
      `heuristicWeight must be from ${MIN_HEURISTIC_WEIGHT} through ${MAX_HEURISTIC_WEIGHT}.`,
    );
  }
}
