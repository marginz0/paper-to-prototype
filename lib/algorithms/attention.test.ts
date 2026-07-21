import { describe, expect, it } from "vitest";

import {
  ATTENTION_TOKENS,
  DEFAULT_ATTENTION_SCALING_MODE,
  MAX_ATTENTION_TEMPERATURE,
  MIN_ATTENTION_TEMPERATURE,
  TOKEN_EMBEDDINGS,
  W_KEY,
  W_QUERY,
  W_VALUE,
  calculateEntropy,
  createAttentionPipeline,
  createInitialAttentionState,
  nextAttentionPhase,
  previousAttentionPhase,
  resetAttentionState,
  setAttentionScalingMode,
  setAttentionSelection,
  setAttentionTemperature,
  softmaxRows,
  type Matrix,
} from "./attention";

function expectDimensions(matrix: Matrix, rows: number, columns: number): void {
  expect(matrix).toHaveLength(rows);
  matrix.forEach((row) => expect(row).toHaveLength(columns));
}

function maximum(row: readonly number[]): number {
  return Math.max(...row);
}

describe("fixed scaled dot-product attention pipeline", () => {
  it("has consistent input, projection, score, and output dimensions", () => {
    const pipeline = createAttentionPipeline();
    const tokenCount = ATTENTION_TOKENS.length;

    expectDimensions(TOKEN_EMBEDDINGS, tokenCount, 4);
    expectDimensions(W_QUERY, 4, 3);
    expectDimensions(W_KEY, 4, 3);
    expectDimensions(W_VALUE, 4, 3);
    expectDimensions(pipeline.queries, tokenCount, 3);
    expectDimensions(pipeline.keys, tokenCount, 3);
    expectDimensions(pipeline.values, tokenCount, 3);
    expectDimensions(pipeline.rawScores, tokenCount, tokenCount);
    expectDimensions(pipeline.scaledScores, tokenCount, tokenCount);
    expectDimensions(pipeline.comparison.scaled.output, tokenCount, 3);
    expectDimensions(pipeline.comparison.unscaled.output, tokenCount, 3);
    expect(pipeline.keyDimension).toBe(3);
  });

  it("is deterministic for the fixed tokens, vectors, and projections", () => {
    const first = createAttentionPipeline(1.3);
    const replay = createAttentionPipeline(1.3);

    expect(replay).toEqual(first);
    expect(replay).not.toBe(first);
    expect(createInitialAttentionState().scalingMode).toBe(
      DEFAULT_ATTENTION_SCALING_MODE,
    );
  });

  it("produces finite probabilities in [0, 1] whose rows sum to one", () => {
    const pipeline = createAttentionPipeline();

    for (const computation of [
      pipeline.comparison.scaled,
      pipeline.comparison.unscaled,
    ]) {
      computation.weights.forEach((row) => {
        expect(row.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
        expect(
          row.every(
            (value) => Number.isFinite(value) && value >= 0 && value <= 1,
          ),
        ).toBe(true);
      });
    }
  });

  it("uses a stable softmax for a wide finite score range", () => {
    const probabilities = softmaxRows([[1_000, 999, -1_000]])[0];

    expect(probabilities.every(Number.isFinite)).toBe(true);
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
    expect(probabilities[0]).toBeGreaterThan(probabilities[1]);
  });

  it("makes a non-uniform attention row more concentrated at lower temperature", () => {
    const cold = createAttentionPipeline(MIN_ATTENTION_TEMPERATURE);
    const warm = createAttentionPipeline(MAX_ATTENTION_TEMPERATURE);
    const queryIndex = 1;
    const coldRow = cold.comparison.scaled.weights[queryIndex];
    const warmRow = warm.comparison.scaled.weights[queryIndex];

    expect(maximum(coldRow)).toBeGreaterThan(maximum(warmRow));
    expect(calculateEntropy(coldRow)).toBeLessThan(calculateEntropy(warmRow));
  });

  it("divides scores by sqrt(d_k) and differs from unscaled attention", () => {
    const pipeline = createAttentionPipeline();
    const queryIndex = 1;
    const keyIndex = 3;
    const divisor = Math.sqrt(pipeline.keyDimension);

    expect(pipeline.scaledScores[queryIndex][keyIndex]).toBeCloseTo(
      pipeline.rawScores[queryIndex][keyIndex] / divisor,
      12,
    );
    expect(pipeline.comparison.scaled.logits[queryIndex][keyIndex]).toBeCloseTo(
      pipeline.scaledScores[queryIndex][keyIndex],
      12,
    );
    expect(pipeline.comparison.unscaled.logits[queryIndex][keyIndex]).toBeCloseTo(
      pipeline.rawScores[queryIndex][keyIndex],
      12,
    );
    expect(pipeline.comparison.scaled.weights[queryIndex]).not.toEqual(
      pipeline.comparison.unscaled.weights[queryIndex],
    );
    expect(maximum(pipeline.comparison.unscaled.weights[queryIndex])).toBeGreaterThan(
      maximum(pipeline.comparison.scaled.weights[queryIndex]),
    );
  });
});

describe("attention laboratory state", () => {
  it("moves within phases 0 through 5 without stepping past either boundary", () => {
    let state = createInitialAttentionState();

    expect(state.phase).toBe(0);
    expect(previousAttentionPhase(state)).toBe(state);

    for (let phase = 1; phase <= 5; phase += 1) {
      state = nextAttentionPhase(state);
      expect(state.phase).toBe(phase);
    }

    expect(nextAttentionPhase(state)).toBe(state);
  });

  it("resets phase, selection, temperature, mode, and derived values exactly", () => {
    let progressed = createInitialAttentionState();
    progressed = nextAttentionPhase(nextAttentionPhase(progressed));
    progressed = setAttentionSelection(progressed, 4, 0);
    progressed = setAttentionTemperature(progressed, 1.8);
    progressed = setAttentionScalingMode(progressed, "unscaled");

    const reset = resetAttentionState(progressed);
    const canonical = createInitialAttentionState();

    expect(reset).toEqual(canonical);
    expect(reset).not.toBe(canonical);
    expect(reset.phase).toBe(0);
    expect(reset.scalingMode).toBe("scaled");
  });

  it("rejects temperatures outside the bounded teaching range", () => {
    const state = createInitialAttentionState();

    expect(() => setAttentionTemperature(state, 0.39)).toThrow(RangeError);
    expect(() => setAttentionTemperature(state, 2.01)).toThrow(RangeError);
    expect(() => setAttentionTemperature(state, Number.NaN)).toThrow(RangeError);
  });
});
