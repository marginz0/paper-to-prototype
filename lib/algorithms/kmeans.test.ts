import { describe, expect, it } from "vitest";

import {
  assignPoints,
  calculateInertia,
  createInitialKMeansState,
  createSeededRandom,
  generateSeededDataset,
  resetKMeans,
  stepKMeans,
  updateCentroids,
  type KMeansCentroid,
  type KMeansPoint,
} from "./kmeans";

describe("seeded k-Means data", () => {
  it("replays the same pseudo-random sequence for the same seed", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    const firstSequence = Array.from({ length: 8 }, () => first());
    const secondSequence = Array.from({ length: 8 }, () => second());

    expect(firstSequence).toEqual(secondSequence);
    expect(firstSequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("generates a reproducible, bounded point cloud", () => {
    const first = generateSeededDataset(1234, 25);
    const replay = generateSeededDataset(1234, 25);
    const different = generateSeededDataset(1235, 25);

    expect(first).toEqual(replay);
    expect(first).not.toEqual(different);
    expect(first).toHaveLength(25);
    expect(
      first.every(
        ({ x, y }) => x >= 4 && x <= 96 && y >= 4 && y <= 96,
      ),
    ).toBe(true);
  });
});

describe("k-Means operations", () => {
  const points: KMeansPoint[] = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 2, y: 0 },
    { id: "c", x: 8, y: 10 },
    { id: "d", x: 10, y: 10 },
  ];

  const centroids: KMeansCentroid[] = [
    { cluster: 0, x: 0, y: 0 },
    { cluster: 1, x: 10, y: 10 },
  ];

  it("assigns points to the nearest cluster and calculates inertia", () => {
    const result = assignPoints(points, centroids);

    expect(result.assignments).toEqual([0, 0, 1, 1]);
    expect(result.inertia).toBe(8);
    expect(calculateInertia(points, centroids, result.assignments)).toBe(8);
  });

  it("moves centroids to cluster means and retains an empty centroid", () => {
    const previous: KMeansCentroid[] = [
      ...centroids,
      { cluster: 2, x: 5, y: 5 },
    ];
    const updated = updateCentroids(points, [0, 0, 1, 1], previous);

    expect(updated).toEqual([
      { cluster: 0, x: 1, y: 0 },
      { cluster: 1, x: 9, y: 10 },
      { cluster: 2, x: 5, y: 5 },
    ]);
  });
});

describe("one-phase-at-a-time state machine", () => {
  it("advances assignment and centroid update as separate immutable phases", () => {
    const initial = createInitialKMeansState({ k: 3, seed: 77, pointCount: 30 });
    const assigned = stepKMeans(initial);
    const updated = stepKMeans(assigned);

    expect(initial.phase).toBe("assignment");
    expect(initial.iteration).toBe(0);
    expect(initial.assignments.every((assignment) => assignment === null)).toBe(true);

    expect(assigned).not.toBe(initial);
    expect(assigned.phase).toBe("centroid-update");
    expect(assigned.iteration).toBe(0);
    expect(assigned.assignments.every((assignment) => assignment !== null)).toBe(true);
    expect(initial.assignments.every((assignment) => assignment === null)).toBe(true);

    expect(updated.phase).toBe("assignment");
    expect(updated.iteration).toBe(1);
    expect(updated.inertia).toBeLessThanOrEqual(assigned.inertia);
  });

  it("resets reproducibly and applies a new supported k deterministically", () => {
    let progressed = createInitialKMeansState({ k: 2, seed: 9001 });
    progressed = stepKMeans(stepKMeans(progressed));

    const reset = resetKMeans(progressed);
    const original = createInitialKMeansState({ k: 2, seed: 9001 });
    const changedK = resetKMeans(progressed, { k: 5 });

    expect(reset).toEqual(original);
    expect(changedK).toEqual(createInitialKMeansState({ k: 5, seed: 9001 }));
    expect(changedK.k).toBe(5);
    expect(changedK.phase).toBe("assignment");
    expect(changedK.iteration).toBe(0);
    expect(changedK.converged).toBe(false);
  });

  it("rejects k values outside the supported range", () => {
    expect(() => createInitialKMeansState({ k: 1 })).toThrow(RangeError);
    expect(() => createInitialKMeansState({ k: 6 })).toThrow(RangeError);
    expect(() => createInitialKMeansState({ k: 2.5 })).toThrow(RangeError);
  });

  it("converges deterministically and stops advancing once stable", () => {
    let state = createInitialKMeansState({ k: 4, seed: 314_159 });

    for (let phase = 0; phase < 100 && !state.converged; phase += 1) {
      state = stepKMeans(state);
    }

    expect(state.converged).toBe(true);
    expect(state.iteration).toBeGreaterThan(0);
    expect(stepKMeans(state)).toBe(state);

    const replay = (() => {
      let next = createInitialKMeansState({ k: 4, seed: 314_159 });
      while (!next.converged) {
        next = stepKMeans(next);
      }
      return next;
    })();

    expect(replay).toEqual(state);
  });
});
