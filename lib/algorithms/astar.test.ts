import { describe, expect, it } from "vitest";

import {
  CANONICAL_ASTAR_GRID,
  createAStarGrid,
  createInitialAStarState,
  manhattanDistance,
  positionKey,
  resetAStar,
  stepAStar,
  type AStarState,
  type GridPosition,
} from "./astar";

function finish(initial: AStarState): AStarState {
  let state = initial;

  for (let step = 0; step < 1_000 && state.status !== "found" && state.status !== "no-path"; step += 1) {
    state = stepAStar(state);
  }

  if (state.status === "ready" || state.status === "searching") {
    throw new Error("A* did not terminate within the test guard.");
  }

  return state;
}

function expectValidPath(state: AStarState): void {
  expect(state.status).toBe("found");
  expect(state.finalPath[0]).toEqual(state.grid.start);
  expect(state.finalPath.at(-1)).toEqual(state.grid.goal);

  const wallKeys = new Set(state.grid.walls.map(positionKey));
  state.finalPath.forEach((position, index) => {
    expect(wallKeys.has(positionKey(position))).toBe(false);

    if (index > 0) {
      expect(manhattanDistance(state.finalPath[index - 1], position)).toBe(1);
    }
  });
}

describe("A* grid validation", () => {
  it("normalizes duplicate walls into deterministic row-major order", () => {
    const grid = createAStarGrid({
      rows: 3,
      columns: 5,
      start: { row: 0, column: 0 },
      goal: { row: 2, column: 4 },
      walls: [
        { row: 2, column: 2 },
        { row: 0, column: 3 },
        { row: 2, column: 2 },
      ],
    });

    expect(grid).toEqual({
      rows: 3,
      columns: 5,
      start: { row: 0, column: 0 },
      goal: { row: 2, column: 4 },
      walls: [
        { row: 0, column: 3 },
        { row: 2, column: 2 },
      ],
    });
  });

  it("rejects invalid dimensions, coordinates, wall overlaps, and weights", () => {
    expect(() =>
      createAStarGrid({
        rows: 0,
        columns: 2,
        start: { row: 0, column: 0 },
        goal: { row: 0, column: 1 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      createAStarGrid({
        rows: 2,
        columns: 2,
        start: { row: 0.5, column: 0 },
        goal: { row: 1, column: 1 },
      }),
    ).toThrow(TypeError);
    expect(() =>
      createAStarGrid({
        rows: 2,
        columns: 2,
        start: { row: 0, column: 0 },
        goal: { row: 1, column: 1 },
        walls: [{ row: 1, column: 1 }],
      }),
    ).toThrow(RangeError);
    expect(() => createInitialAStarState({ heuristicWeight: -0.01 })).toThrow(
      RangeError,
    );
    expect(() => createInitialAStarState({ heuristicWeight: 2.01 })).toThrow(
      RangeError,
    );
    expect(() =>
      createInitialAStarState({ heuristicWeight: Number.NaN }),
    ).toThrow(RangeError);

    expect(createInitialAStarState({ heuristicWeight: 0 }).heuristicWeight).toBe(0);
    expect(createInitialAStarState({ heuristicWeight: 2 }).heuristicWeight).toBe(2);
  });
});

describe("one-expansion-at-a-time A* state machine", () => {
  const symmetricDetour = createAStarGrid({
    rows: 3,
    columns: 3,
    start: { row: 2, column: 1 },
    goal: { row: 0, column: 1 },
    walls: [{ row: 1, column: 1 }],
  });

  it("starts ready and advances one node without mutating the input", () => {
    const initial = createInitialAStarState({ grid: symmetricDetour });
    const first = stepAStar(initial);

    expect(initial.status).toBe("ready");
    expect(initial.current).toBeNull();
    expect(initial.open).toHaveLength(1);
    expect(initial.closed).toEqual([]);
    expect(initial.metrics.steps).toBe(0);

    expect(first).not.toBe(initial);
    expect(first.status).toBe("searching");
    expect(first.current?.position).toEqual(symmetricDetour.start);
    expect(first.closed.map((node) => node.position)).toEqual([
      symmetricDetour.start,
    ]);
    expect(first.metrics).toMatchObject({
      steps: 1,
      expandedNodes: 1,
      discoveredNodes: 3,
      frontierSize: 2,
      maxFrontierSize: 2,
    });
    expect(initial.current).toBeNull();
    expect(initial.open).toHaveLength(1);
  });

  it("uses deterministic f, h, row, and column tie-breaking", () => {
    const first = stepAStar(createInitialAStarState({ grid: symmetricDetour }));
    const second = stepAStar(first);
    const completed = finish(second);

    expect(second.current?.position).toEqual({ row: 2, column: 0 });
    expect(completed.finalPath).toEqual([
      { row: 2, column: 1 },
      { row: 2, column: 0 },
      { row: 1, column: 0 },
      { row: 0, column: 0 },
      { row: 0, column: 1 },
    ]);
    expect(completed.cameFrom["0,1"]).toBe("0,0");
    expect(completed.metrics.pathCost).toBe(4);
    expect(completed.metrics.pathLength).toBe(4);
    expectValidPath(completed);
  });

  it("reports no-path after the final reachable node is expanded", () => {
    const grid = createAStarGrid({
      rows: 3,
      columns: 3,
      start: { row: 1, column: 1 },
      goal: { row: 0, column: 0 },
      walls: [
        { row: 0, column: 1 },
        { row: 1, column: 0 },
        { row: 1, column: 2 },
        { row: 2, column: 1 },
      ],
    });
    const initial = createInitialAStarState({ grid });
    const completed = stepAStar(initial);

    expect(completed.status).toBe("no-path");
    expect(completed.current?.position).toEqual(grid.start);
    expect(completed.open).toEqual([]);
    expect(completed.finalPath).toEqual([]);
    expect(completed.metrics).toMatchObject({
      steps: 1,
      expandedNodes: 1,
      discoveredNodes: 1,
      frontierSize: 0,
      pathCost: null,
      pathLength: null,
    });
    expect(stepAStar(completed)).toBe(completed);
  });

  it("handles start equal to goal as a one-node, zero-cost path", () => {
    const shared: GridPosition = { row: 1, column: 2 };
    const grid = createAStarGrid({
      rows: 2,
      columns: 4,
      start: shared,
      goal: shared,
    });
    const initial = createInitialAStarState({ grid });
    const completed = stepAStar(initial);

    expect(initial.status).toBe("ready");
    expect(completed.status).toBe("found");
    expect(completed.finalPath).toEqual([shared]);
    expect(completed.metrics.pathCost).toBe(0);
    expect(completed.metrics.pathLength).toBe(0);
    expect(completed.metrics.expandedNodes).toBe(1);
    expect(stepAStar(completed)).toBe(completed);
  });
});

describe("canonical A* replay and reset", () => {
  it("finds a valid path deterministically at all supported weight extremes", () => {
    const dijkstra = finish(
      createInitialAStarState({
        grid: CANONICAL_ASTAR_GRID,
        heuristicWeight: 0,
      }),
    );
    const standard = finish(createInitialAStarState());
    const weighted = finish(
      createInitialAStarState({
        grid: CANONICAL_ASTAR_GRID,
        heuristicWeight: 2,
      }),
    );
    const replay = finish(createInitialAStarState());

    expectValidPath(dijkstra);
    expectValidPath(standard);
    expectValidPath(weighted);
    expect(replay).toEqual(standard);
    // The start and goal are 16 Manhattan moves apart. A valid 16-step route
    // therefore reaches the geometric lower bound and is provably shortest.
    expect(standard.metrics.pathCost).toBe(16);
    expect(standard.metrics.pathLength).toBe(16);
    expect(dijkstra.metrics.pathCost).toBe(standard.metrics.pathCost);
    expect(dijkstra.metrics.pathLength).toBe(standard.metrics.pathLength);
    expect(weighted.metrics.expandedNodes).toBeLessThan(
      dijkstra.metrics.expandedNodes,
    );
  });

  it("resets reproducibly while allowing an immutable board and weight change", () => {
    const progressed = stepAStar(stepAStar(createInitialAStarState()));
    const replay = resetAStar(progressed);
    const editedGrid = createAStarGrid({
      ...CANONICAL_ASTAR_GRID,
      walls: CANONICAL_ASTAR_GRID.walls.slice(0, -1),
    });
    const changed = resetAStar(progressed, {
      grid: editedGrid,
      heuristicWeight: 1.5,
    });

    expect(replay).toEqual(createInitialAStarState());
    expect(changed).toEqual(
      createInitialAStarState({ grid: editedGrid, heuristicWeight: 1.5 }),
    );
    expect(changed.status).toBe("ready");
    expect(changed.metrics.steps).toBe(0);
    expect(progressed.metrics.steps).toBe(2);
  });
});
