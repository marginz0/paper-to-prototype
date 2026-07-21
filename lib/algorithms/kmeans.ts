export const MIN_K = 2;
export const MAX_K = 5;
export const DEFAULT_KMEANS_SEED = 2_026_072;
export const DEFAULT_POINT_COUNT = 60;

const CONVERGENCE_EPSILON = 1e-10;
const UINT32_RANGE = 4_294_967_296;

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface KMeansPoint extends Point2D {
  readonly id: string;
}

export interface KMeansCentroid extends Point2D {
  readonly cluster: number;
}

export type KMeansPhase = "assignment" | "centroid-update";
export type KMeansAssignment = number | null;

export interface KMeansState {
  readonly seed: number;
  readonly k: number;
  readonly points: readonly KMeansPoint[];
  readonly centroids: readonly KMeansCentroid[];
  readonly assignments: readonly KMeansAssignment[];
  /** The operation that the next call to stepKMeans will perform. */
  readonly phase: KMeansPhase;
  /** Number of completed centroid-update phases (full k-Means iterations). */
  readonly iteration: number;
  readonly inertia: number;
  readonly converged: boolean;
}

export interface CreateKMeansOptions {
  readonly k: number;
  readonly seed?: number;
  readonly pointCount?: number;
}

export interface ResetKMeansOptions {
  readonly k?: number;
  readonly seed?: number;
  readonly pointCount?: number;
}

export interface AssignmentResult {
  readonly assignments: readonly number[];
  readonly inertia: number;
}

interface DatasetAnchor extends Point2D {
  readonly spreadX: number;
  readonly spreadY: number;
}

const DATASET_ANCHORS: readonly DatasetAnchor[] = [
  { x: 18, y: 25, spreadX: 10, spreadY: 11 },
  { x: 51, y: 18, spreadX: 11, spreadY: 8 },
  { x: 82, y: 31, spreadX: 9, spreadY: 12 },
  { x: 29, y: 76, spreadX: 12, spreadY: 10 },
  { x: 73, y: 74, spreadX: 11, spreadY: 11 },
];

/**
 * Creates a small, fast deterministic PRNG. Every returned value is in [0, 1).
 * This is Mulberry32 and is intended for repeatable teaching data, not security.
 */
export function createSeededRandom(seed: number): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/** Produces the same bounded, presentation-friendly point cloud for a given seed. */
export function generateSeededDataset(
  seed = DEFAULT_KMEANS_SEED,
  pointCount = DEFAULT_POINT_COUNT,
): KMeansPoint[] {
  assertPointCount(pointCount);

  const random = createSeededRandom(seed);
  const points: KMeansPoint[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const anchor = DATASET_ANCHORS[index % DATASET_ANCHORS.length];
    // Adding three uniform samples gives a compact bell-like distribution
    // without platform-dependent random or normal-distribution libraries.
    const offsetX = random() + random() + random() - 1.5;
    const offsetY = random() + random() + random() - 1.5;

    points.push({
      id: `point-${index + 1}`,
      x: roundCoordinate(clamp(anchor.x + offsetX * anchor.spreadX, 4, 96)),
      y: roundCoordinate(clamp(anchor.y + offsetY * anchor.spreadY, 4, 96)),
    });
  }

  // Avoid grouping points by their source anchor while preserving stable IDs.
  for (let index = points.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = points[index];
    points[index] = points[swapIndex];
    points[swapIndex] = current;
  }

  return points;
}

/** Selects reproducible, well-separated starting centroids (seeded farthest-first). */
export function initializeCentroids(
  points: readonly KMeansPoint[],
  k: number,
  seed = DEFAULT_KMEANS_SEED,
): KMeansCentroid[] {
  assertValidK(k);
  assertPoints(points);

  if (points.length < k) {
    throw new RangeError(`Expected at least ${k} points, received ${points.length}.`);
  }

  const random = createSeededRandom(seed);
  const selectedIndexes = [Math.floor(random() * points.length)];

  while (selectedIndexes.length < k) {
    let bestIndex = -1;
    let bestDistance = -1;

    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      if (selectedIndexes.includes(pointIndex)) {
        continue;
      }

      let nearestSelectedDistance = Number.POSITIVE_INFINITY;
      for (const selectedIndex of selectedIndexes) {
        nearestSelectedDistance = Math.min(
          nearestSelectedDistance,
          squaredDistance(points[pointIndex], points[selectedIndex]),
        );
      }

      if (nearestSelectedDistance > bestDistance) {
        bestDistance = nearestSelectedDistance;
        bestIndex = pointIndex;
      }
    }

    if (bestIndex < 0) {
      throw new Error("Unable to choose a distinct initial centroid.");
    }

    selectedIndexes.push(bestIndex);
  }

  return selectedIndexes.map((pointIndex, cluster) => ({
    cluster,
    x: points[pointIndex].x,
    y: points[pointIndex].y,
  }));
}

/** Assigns each point to its nearest centroid. Ties resolve to the lower cluster. */
export function assignPoints(
  points: readonly KMeansPoint[],
  centroids: readonly KMeansCentroid[],
): AssignmentResult {
  assertPoints(points);
  assertCentroids(centroids);

  if (centroids.length === 0) {
    throw new RangeError("At least one centroid is required.");
  }

  let inertia = 0;
  const assignments = points.map((point) => {
    let nearestCluster = 0;
    let nearestDistance = squaredDistance(point, centroids[0]);

    for (let cluster = 1; cluster < centroids.length; cluster += 1) {
      const distance = squaredDistance(point, centroids[cluster]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCluster = cluster;
      }
    }

    inertia += nearestDistance;
    return nearestCluster;
  });

  return { assignments, inertia };
}

/**
 * Moves every centroid to the mean of its assigned points. An empty cluster keeps
 * its previous centroid, which makes the update deterministic and finite.
 */
export function updateCentroids(
  points: readonly KMeansPoint[],
  assignments: readonly number[],
  previousCentroids: readonly KMeansCentroid[],
): KMeansCentroid[] {
  assertPoints(points);
  assertCentroids(previousCentroids);
  assertCompleteAssignments(assignments, points.length, previousCentroids.length);

  const totals = previousCentroids.map(() => ({ x: 0, y: 0, count: 0 }));

  points.forEach((point, pointIndex) => {
    const total = totals[assignments[pointIndex]];
    total.x += point.x;
    total.y += point.y;
    total.count += 1;
  });

  return previousCentroids.map((centroid, cluster) => {
    const total = totals[cluster];
    if (total.count === 0) {
      return { ...centroid };
    }

    return {
      cluster,
      x: total.x / total.count,
      y: total.y / total.count,
    };
  });
}

export function calculateInertia(
  points: readonly KMeansPoint[],
  centroids: readonly KMeansCentroid[],
  assignments: readonly number[],
): number {
  assertPoints(points);
  assertCentroids(centroids);
  assertCompleteAssignments(assignments, points.length, centroids.length);

  return points.reduce(
    (total, point, pointIndex) =>
      total + squaredDistance(point, centroids[assignments[pointIndex]]),
    0,
  );
}

export function createInitialKMeansState({
  k,
  seed = DEFAULT_KMEANS_SEED,
  pointCount = DEFAULT_POINT_COUNT,
}: CreateKMeansOptions): KMeansState {
  assertValidK(k);
  assertPointCount(pointCount);

  if (pointCount < k) {
    throw new RangeError(`pointCount must be at least k (${k}).`);
  }

  const normalizedSeed = normalizeSeed(seed);
  const points = generateSeededDataset(normalizedSeed, pointCount);
  const centroidSeed = (normalizedSeed ^ Math.imul(k, 0x9e3779b1)) >>> 0;
  const centroids = initializeCentroids(points, k, centroidSeed);
  const initialAssignment = assignPoints(points, centroids);

  return {
    seed: normalizedSeed,
    k,
    points,
    centroids,
    assignments: points.map(() => null),
    phase: "assignment",
    iteration: 0,
    // The initial objective is useful to display, even though cluster labels are
    // intentionally withheld until the first visible assignment phase.
    inertia: initialAssignment.inertia,
    converged: false,
  };
}

/** Advances exactly one visible k-Means phase without mutating the input state. */
export function stepKMeans(state: KMeansState): KMeansState {
  if (state.converged) {
    return state;
  }

  if (state.phase === "assignment") {
    const { assignments, inertia } = assignPoints(state.points, state.centroids);

    return {
      ...state,
      assignments,
      inertia,
      phase: "centroid-update",
    };
  }

  const assignments = requireAssignedPoints(state.assignments);
  const centroids = updateCentroids(state.points, assignments, state.centroids);
  const converged = state.centroids.every(
    (centroid, cluster) =>
      squaredDistance(centroid, centroids[cluster]) <= CONVERGENCE_EPSILON,
  );

  return {
    ...state,
    centroids,
    phase: "assignment",
    iteration: state.iteration + 1,
    inertia: calculateInertia(state.points, centroids, assignments),
    converged,
  };
}

/** Recreates the initial state, retaining the current seed, k, and point count by default. */
export function resetKMeans(
  state: KMeansState,
  options: ResetKMeansOptions = {},
): KMeansState {
  return createInitialKMeansState({
    k: options.k ?? state.k,
    seed: options.seed ?? state.seed,
    pointCount: options.pointCount ?? state.points.length,
  });
}

function requireAssignedPoints(
  assignments: readonly KMeansAssignment[],
): number[] {
  return assignments.map((assignment, pointIndex) => {
    if (assignment === null) {
      throw new Error(
        `Point ${pointIndex} has not been assigned. Run the assignment phase first.`,
      );
    }
    return assignment;
  });
}

function assertValidK(k: number): void {
  if (!Number.isInteger(k) || k < MIN_K || k > MAX_K) {
    throw new RangeError(`k must be an integer from ${MIN_K} through ${MAX_K}.`);
  }
}

function assertPointCount(pointCount: number): void {
  if (!Number.isInteger(pointCount) || pointCount < 1) {
    throw new RangeError("pointCount must be a positive integer.");
  }
}

function assertPoints(points: readonly KMeansPoint[]): void {
  points.forEach((point, index) => assertFinitePoint(point, `point ${index}`));
}

function assertCentroids(centroids: readonly KMeansCentroid[]): void {
  centroids.forEach((centroid, index) =>
    assertFinitePoint(centroid, `centroid ${index}`),
  );
}

function assertFinitePoint(point: Point2D, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} must have finite x and y coordinates.`);
  }
}

function assertCompleteAssignments(
  assignments: readonly number[],
  pointCount: number,
  clusterCount: number,
): void {
  if (assignments.length !== pointCount) {
    throw new RangeError(
      `Expected ${pointCount} assignments, received ${assignments.length}.`,
    );
  }

  assignments.forEach((assignment, pointIndex) => {
    if (
      !Number.isInteger(assignment) ||
      assignment < 0 ||
      assignment >= clusterCount
    ) {
      throw new RangeError(
        `Assignment for point ${pointIndex} must reference an existing cluster.`,
      );
    }
  });
}

function squaredDistance(first: Point2D, second: Point2D): number {
  const deltaX = first.x - second.x;
  const deltaY = first.y - second.y;
  return deltaX * deltaX + deltaY * deltaY;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new TypeError("seed must be a finite number.");
  }
  return Math.trunc(seed) >>> 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
