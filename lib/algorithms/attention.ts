export type Matrix = readonly (readonly number[])[];
export type AttentionPhase = 0 | 1 | 2 | 3 | 4 | 5;
export type AttentionScalingMode = "scaled" | "unscaled";

export const MIN_ATTENTION_TEMPERATURE = 0.4;
export const MAX_ATTENTION_TEMPERATURE = 2;
export const DEFAULT_ATTENTION_TEMPERATURE = 1;
export const DEFAULT_ATTENTION_SCALING_MODE: AttentionScalingMode = "scaled";
export const DEFAULT_ATTENTION_PHASE: AttentionPhase = 0;
export const DEFAULT_SELECTED_QUERY = 1;
export const DEFAULT_SELECTED_KEY = 3;

export const ATTENTION_TOKENS = [
  "robot",
  "follows",
  "the",
  "map",
  "carefully",
] as const;

/** Fixed toy embeddings. They are illustrative values, not learned representations. */
export const TOKEN_EMBEDDINGS = [
  [0.9, 0.1, 0.2, 0.7],
  [0.2, 0.9, 0.6, 0.1],
  [0.1, 0.2, 0.1, 0.3],
  [0.8, 0.3, 0.9, 0.4],
  [0.3, 0.8, 0.2, 0.9],
] as const satisfies Matrix;

/** Fixed 4 x 3 projection matrices used throughout the teaching pipeline. */
export const W_QUERY = [
  [0.7, -0.2, 0.4],
  [0.1, 0.8, -0.3],
  [0.5, 0.2, 0.6],
  [-0.2, 0.4, 0.7],
] as const satisfies Matrix;

export const W_KEY = [
  [0.6, 0.1, -0.3],
  [-0.4, 0.7, 0.5],
  [0.3, -0.2, 0.8],
  [0.5, 0.6, 0.1],
] as const satisfies Matrix;

export const W_VALUE = [
  [0.8, -0.1, 0.3],
  [0.2, 0.7, -0.4],
  [-0.3, 0.5, 0.9],
  [0.4, 0.2, 0.6],
] as const satisfies Matrix;

export const ATTENTION_PHASES = [
  { id: 0, label: "Token vectors" },
  { id: 1, label: "Project Q, K, V" },
  { id: 2, label: "Dot-product scores" },
  { id: 3, label: "Scale scores" },
  { id: 4, label: "Softmax weights" },
  { id: 5, label: "Weighted output" },
] as const satisfies readonly { readonly id: AttentionPhase; readonly label: string }[];

export interface AttentionComputation {
  readonly scalingMode: AttentionScalingMode;
  readonly temperature: number;
  /** Scores after the optional sqrt(d_k) scaling and temperature division. */
  readonly logits: Matrix;
  readonly weights: Matrix;
  readonly output: Matrix;
}

export interface AttentionComparison {
  readonly scaled: AttentionComputation;
  readonly unscaled: AttentionComputation;
}

export interface AttentionPipeline {
  readonly tokens: typeof ATTENTION_TOKENS;
  readonly embeddings: Matrix;
  readonly queries: Matrix;
  readonly keys: Matrix;
  readonly values: Matrix;
  readonly rawScores: Matrix;
  readonly scaledScores: Matrix;
  readonly keyDimension: number;
  readonly comparison: AttentionComparison;
}

export interface AttentionState {
  readonly phase: AttentionPhase;
  readonly temperature: number;
  readonly scalingMode: AttentionScalingMode;
  readonly selectedQuery: number;
  readonly selectedKey: number;
  readonly pipeline: AttentionPipeline;
}

export interface ComputeAttentionOptions {
  readonly scalingMode?: AttentionScalingMode;
  readonly temperature?: number;
}

export interface CreateAttentionStateOptions extends ComputeAttentionOptions {
  readonly phase?: AttentionPhase;
  readonly selectedQuery?: number;
  readonly selectedKey?: number;
}

/** Multiplies two finite rectangular matrices without mutating either input. */
export function multiplyMatrices(left: Matrix, right: Matrix): number[][] {
  const leftShape = assertRectangularMatrix(left, "left matrix");
  const rightShape = assertRectangularMatrix(right, "right matrix");

  if (leftShape.columns !== rightShape.rows) {
    throw new RangeError(
      `Cannot multiply ${leftShape.rows}x${leftShape.columns} by ${rightShape.rows}x${rightShape.columns}.`,
    );
  }

  return left.map((leftRow) =>
    Array.from({ length: rightShape.columns }, (_, column) =>
      leftRow.reduce(
        (sum, value, index) => sum + value * right[index][column],
        0,
      ),
    ),
  );
}

export function transposeMatrix(matrix: Matrix): number[][] {
  const { rows, columns } = assertRectangularMatrix(matrix, "matrix");
  return Array.from({ length: columns }, (_, column) =>
    Array.from({ length: rows }, (_, row) => matrix[row][column]),
  );
}

/** Applies a numerically stable row-wise softmax after temperature division. */
export function softmaxRows(
  scores: Matrix,
  temperature = DEFAULT_ATTENTION_TEMPERATURE,
): number[][] {
  assertTemperature(temperature);
  assertRectangularMatrix(scores, "score matrix");

  return scores.map((row) => {
    const logits = row.map((value) => value / temperature);
    const maximum = Math.max(...logits);
    const exponentials = logits.map((value) => Math.exp(value - maximum));
    const denominator = exponentials.reduce((sum, value) => sum + value, 0);

    if (!Number.isFinite(denominator) || denominator <= 0) {
      throw new RangeError("Softmax denominator must be positive and finite.");
    }

    return exponentials.map((value) => value / denominator);
  });
}

export function calculateEntropy(probabilities: readonly number[]): number {
  if (probabilities.length === 0) {
    throw new RangeError("Entropy requires at least one probability.");
  }

  return probabilities.reduce((entropy, probability) => {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError("Entropy inputs must be finite probabilities in [0, 1].");
    }
    return probability === 0 ? entropy : entropy - probability * Math.log(probability);
  }, 0);
}

/** Computes one scaled or unscaled dot-product attention result. */
export function computeAttention(
  queries: Matrix,
  keys: Matrix,
  values: Matrix,
  options: ComputeAttentionOptions = {},
): AttentionComputation {
  const scalingMode = options.scalingMode ?? DEFAULT_ATTENTION_SCALING_MODE;
  const temperature = options.temperature ?? DEFAULT_ATTENTION_TEMPERATURE;
  assertScalingMode(scalingMode);
  assertTemperature(temperature);

  const queryShape = assertRectangularMatrix(queries, "query matrix");
  const keyShape = assertRectangularMatrix(keys, "key matrix");
  const valueShape = assertRectangularMatrix(values, "value matrix");

  if (queryShape.columns !== keyShape.columns) {
    throw new RangeError("Queries and keys must have the same feature dimension.");
  }
  if (keyShape.rows !== valueShape.rows) {
    throw new RangeError("Every key must have a corresponding value row.");
  }

  const rawScores = multiplyMatrices(queries, transposeMatrix(keys));
  const divisor = scalingMode === "scaled" ? Math.sqrt(keyShape.columns) : 1;
  const scores = rawScores.map((row) => row.map((value) => value / divisor));
  const logits = scores.map((row) => row.map((value) => value / temperature));
  const weights = softmaxRows(scores, temperature);
  const output = multiplyMatrices(weights, values);

  return { scalingMode, temperature, logits, weights, output };
}

/** Runs the complete fixed-token teaching pipeline at a given temperature. */
export function createAttentionPipeline(
  temperature = DEFAULT_ATTENTION_TEMPERATURE,
): AttentionPipeline {
  assertTemperature(temperature);

  const queries = multiplyMatrices(TOKEN_EMBEDDINGS, W_QUERY);
  const keys = multiplyMatrices(TOKEN_EMBEDDINGS, W_KEY);
  const values = multiplyMatrices(TOKEN_EMBEDDINGS, W_VALUE);
  const rawScores = multiplyMatrices(queries, transposeMatrix(keys));
  const keyDimension = keys[0].length;
  const scaledScores = rawScores.map((row) =>
    row.map((value) => value / Math.sqrt(keyDimension)),
  );

  return {
    tokens: ATTENTION_TOKENS,
    embeddings: TOKEN_EMBEDDINGS,
    queries,
    keys,
    values,
    rawScores,
    scaledScores,
    keyDimension,
    comparison: {
      scaled: computeAttention(queries, keys, values, {
        scalingMode: "scaled",
        temperature,
      }),
      unscaled: computeAttention(queries, keys, values, {
        scalingMode: "unscaled",
        temperature,
      }),
    },
  };
}

export function createInitialAttentionState(
  options: CreateAttentionStateOptions = {},
): AttentionState {
  const phase = options.phase ?? DEFAULT_ATTENTION_PHASE;
  const temperature = options.temperature ?? DEFAULT_ATTENTION_TEMPERATURE;
  const scalingMode = options.scalingMode ?? DEFAULT_ATTENTION_SCALING_MODE;
  const selectedQuery = options.selectedQuery ?? DEFAULT_SELECTED_QUERY;
  const selectedKey = options.selectedKey ?? DEFAULT_SELECTED_KEY;

  assertPhase(phase);
  assertTemperature(temperature);
  assertScalingMode(scalingMode);
  assertSelection(selectedQuery, "query");
  assertSelection(selectedKey, "key");

  return {
    phase,
    temperature,
    scalingMode,
    selectedQuery,
    selectedKey,
    pipeline: createAttentionPipeline(temperature),
  };
}

export function setAttentionPhase(
  state: AttentionState,
  phase: AttentionPhase,
): AttentionState {
  assertPhase(phase);
  return phase === state.phase ? state : { ...state, phase };
}

export function nextAttentionPhase(state: AttentionState): AttentionState {
  const next = Math.min(5, state.phase + 1) as AttentionPhase;
  return setAttentionPhase(state, next);
}

export function previousAttentionPhase(state: AttentionState): AttentionState {
  const previous = Math.max(0, state.phase - 1) as AttentionPhase;
  return setAttentionPhase(state, previous);
}

export function setAttentionTemperature(
  state: AttentionState,
  temperature: number,
): AttentionState {
  assertTemperature(temperature);
  if (temperature === state.temperature) {
    return state;
  }
  return { ...state, temperature, pipeline: createAttentionPipeline(temperature) };
}

export function setAttentionScalingMode(
  state: AttentionState,
  scalingMode: AttentionScalingMode,
): AttentionState {
  assertScalingMode(scalingMode);
  return scalingMode === state.scalingMode ? state : { ...state, scalingMode };
}

export function setAttentionSelection(
  state: AttentionState,
  selectedQuery: number,
  selectedKey: number,
): AttentionState {
  assertSelection(selectedQuery, "query");
  assertSelection(selectedKey, "key");
  if (
    selectedQuery === state.selectedQuery &&
    selectedKey === state.selectedKey
  ) {
    return state;
  }
  return { ...state, selectedQuery, selectedKey };
}

/** Discards all interaction state and reconstructs the canonical initial lab. */
export function resetAttentionState(state?: AttentionState): AttentionState {
  void state;
  return createInitialAttentionState();
}

function assertRectangularMatrix(
  matrix: Matrix,
  label: string,
): { rows: number; columns: number } {
  if (matrix.length === 0 || matrix[0].length === 0) {
    throw new RangeError(`${label} must contain at least one row and column.`);
  }

  const columns = matrix[0].length;
  matrix.forEach((row, rowIndex) => {
    if (row.length !== columns) {
      throw new RangeError(`${label} row ${rowIndex} has an inconsistent width.`);
    }
    row.forEach((value, columnIndex) => {
      if (!Number.isFinite(value)) {
        throw new TypeError(
          `${label} value at row ${rowIndex}, column ${columnIndex} must be finite.`,
        );
      }
    });
  });

  return { rows: matrix.length, columns };
}

function assertTemperature(temperature: number): void {
  if (
    !Number.isFinite(temperature) ||
    temperature < MIN_ATTENTION_TEMPERATURE ||
    temperature > MAX_ATTENTION_TEMPERATURE
  ) {
    throw new RangeError(
      `temperature must be from ${MIN_ATTENTION_TEMPERATURE} through ${MAX_ATTENTION_TEMPERATURE}.`,
    );
  }
}

function assertScalingMode(mode: string): asserts mode is AttentionScalingMode {
  if (mode !== "scaled" && mode !== "unscaled") {
    throw new RangeError('scalingMode must be "scaled" or "unscaled".');
  }
}

function assertPhase(phase: number): asserts phase is AttentionPhase {
  if (!Number.isInteger(phase) || phase < 0 || phase > 5) {
    throw new RangeError("phase must be an integer from 0 through 5.");
  }
}

function assertSelection(index: number, label: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= ATTENTION_TOKENS.length) {
    throw new RangeError(`${label} index must reference a fixed toy token.`);
  }
}
