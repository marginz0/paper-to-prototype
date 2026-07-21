"use client";

import { useMemo, useState, type CSSProperties } from "react";

import {
  ATTENTION_PHASES,
  ATTENTION_TOKENS,
  MAX_ATTENTION_TEMPERATURE,
  MIN_ATTENTION_TEMPERATURE,
  calculateEntropy,
  createInitialAttentionState,
  nextAttentionPhase,
  previousAttentionPhase,
  resetAttentionState,
  setAttentionScalingMode,
  setAttentionSelection,
  setAttentionTemperature,
  type AttentionPhase,
  type AttentionScalingMode,
  type AttentionState,
  type Matrix,
} from "@/lib/algorithms/attention";

const FEATURE_LABELS = ["x₁", "x₂", "x₃", "x₄"] as const;
const PROJECTED_LABELS = ["d₁", "d₂", "d₃"] as const;
const ATTENTION_COLOR_DOMAIN_MAX = 0.5;

const PHASE_COPY: Record<
  AttentionPhase,
  { readonly eyebrow: string; readonly title: string; readonly body: string }
> = {
  0: {
    eyebrow: "Phase 01 · Input vectors",
    title: "Begin with five fixed toy vectors.",
    body: "Each row is a small hand-authored vector for one token. These values make the arithmetic reproducible; they were not learned from language data.",
  },
  1: {
    eyebrow: "Phase 02 · Q, K, and V",
    title: "Project the same input into three roles.",
    body: "Fixed matrices create queries that ask, keys that can match, and values that will later be mixed. The projections are deterministic matrix multiplications.",
  },
  2: {
    eyebrow: "Phase 03 · Dot products",
    title: "Compare every query with every key.",
    body: "A dot product is large when two projected vectors point in compatible directions. It produces one raw compatibility score for every query-key pair.",
  },
  3: {
    eyebrow: "Phase 04 · Scale by √dₖ",
    title: "Keep score magnitude under control.",
    body: "As key width grows, raw dot products can grow too. Dividing by √dₖ keeps softmax from becoming excessively sharp solely because the vectors have more dimensions.",
  },
  4: {
    eyebrow: "Phase 05 · Softmax",
    title: "Turn each score row into a distribution.",
    body: "Softmax makes every row positive and sum to one. Lower temperature concentrates weight on the largest scores; higher temperature spreads weight more evenly.",
  },
  5: {
    eyebrow: "Phase 06 · Weighted output",
    title: "Use the weights to mix value vectors.",
    body: "Each output row is a weighted sum of all value rows. The selected query’s heatmap row supplies exactly the mixing coefficients used in its output.",
  },
};

function formatNumber(value: number, digits = 3): string {
  const rounded = Math.abs(value) < 0.0005 ? 0 : value;
  return rounded.toFixed(digits).replace(/\.?0+$/, "");
}

function temperatureCopy(temperature: number): string {
  if (temperature < 1) {
    return "Lower temperature magnifies score differences, so attention becomes more concentrated.";
  }
  if (temperature > 1) {
    return "Higher temperature softens score differences, so attention is distributed more broadly.";
  }
  return "Temperature 1 leaves the scaled logits at their standard strength.";
}

function phaseFormula(state: AttentionState): string {
  switch (state.phase) {
    case 0:
      return "X ∈ ℝ⁵ˣ⁴";
    case 1:
      return "Q = XWq · K = XWk · V = XWv";
    case 2:
      return "scores = QKᵀ";
    case 3:
      return state.scalingMode === "scaled"
        ? `scores / √${state.pipeline.keyDimension}`
        : "scores ÷ 1 (unscaled comparison)";
    case 4:
      return state.scalingMode === "scaled"
        ? `softmax((scores / √${state.pipeline.keyDimension}) / T)`
        : "softmax(scores / T)";
    case 5:
      return "output = attention weights × V";
  }
}

function maxIndex(values: readonly number[]): number {
  return values.reduce(
    (bestIndex, value, index) =>
      value > values[bestIndex] ? index : bestIndex,
    0,
  );
}

function attentionColorIntensity(weight: number): number {
  const normalized = Math.min(
    1,
    Math.max(0, weight / ATTENTION_COLOR_DOMAIN_MAX),
  );
  return 0.07 + normalized * 0.72;
}

interface MatrixTableProps {
  readonly label: string;
  readonly matrix: Matrix;
  readonly rowLabels: readonly string[];
  readonly columnLabels: readonly string[];
  readonly selectedRow?: number;
  readonly compact?: boolean;
}

function MatrixTable({
  label,
  matrix,
  rowLabels,
  columnLabels,
  selectedRow,
  compact = false,
}: MatrixTableProps) {
  return (
    <div className={`attention-matrix-card${compact ? " attention-matrix-card-compact" : ""}`}>
      <strong>{label}</strong>
      <div className="attention-table-scroll" tabIndex={0} aria-label={`${label} matrix table`}>
        <table className="attention-matrix-table">
          <thead>
            <tr>
              <th scope="col">Token</th>
              {columnLabels.map((column) => (
                <th scope="col" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr
                key={rowLabels[rowIndex]}
                className={selectedRow === rowIndex ? "is-selected-row" : undefined}
              >
                <th scope="row">{rowLabels[rowIndex]}</th>
                {row.map((value, columnIndex) => (
                  <td key={`${rowIndex}-${columnIndex}`}>{formatNumber(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PhaseMatrix({ state }: { readonly state: AttentionState }) {
  const { pipeline } = state;
  const computation = pipeline.comparison[state.scalingMode];

  if (state.phase === 1) {
    return (
      <div className="attention-projection-grid">
        <MatrixTable
          label="Queries · Q"
          matrix={pipeline.queries}
          rowLabels={pipeline.tokens}
          columnLabels={PROJECTED_LABELS}
          selectedRow={state.selectedQuery}
          compact
        />
        <MatrixTable
          label="Keys · K"
          matrix={pipeline.keys}
          rowLabels={pipeline.tokens}
          columnLabels={PROJECTED_LABELS}
          selectedRow={state.selectedKey}
          compact
        />
        <MatrixTable
          label="Values · V"
          matrix={pipeline.values}
          rowLabels={pipeline.tokens}
          columnLabels={PROJECTED_LABELS}
          compact
        />
      </div>
    );
  }

  if (state.phase === 0) {
    return (
      <MatrixTable
        label="Fixed token vectors · X"
        matrix={pipeline.embeddings}
        rowLabels={pipeline.tokens}
        columnLabels={FEATURE_LABELS}
        selectedRow={state.selectedQuery}
      />
    );
  }

  if (state.phase === 2) {
    return (
      <MatrixTable
        label="Raw query-key scores · QKᵀ"
        matrix={pipeline.rawScores}
        rowLabels={pipeline.tokens}
        columnLabels={pipeline.tokens}
        selectedRow={state.selectedQuery}
      />
    );
  }

  if (state.phase === 3) {
    return (
      <MatrixTable
        label={state.scalingMode === "scaled" ? "Scaled scores · QKᵀ / √dₖ" : "Unscaled scores · QKᵀ"}
        matrix={state.scalingMode === "scaled" ? pipeline.scaledScores : pipeline.rawScores}
        rowLabels={pipeline.tokens}
        columnLabels={pipeline.tokens}
        selectedRow={state.selectedQuery}
      />
    );
  }

  if (state.phase === 4) {
    return (
      <MatrixTable
        label={`${state.scalingMode === "scaled" ? "Scaled" : "Unscaled"} softmax weights`}
        matrix={computation.weights}
        rowLabels={pipeline.tokens}
        columnLabels={pipeline.tokens}
        selectedRow={state.selectedQuery}
      />
    );
  }

  return (
    <MatrixTable
      label="Weighted output"
      matrix={computation.output}
      rowLabels={pipeline.tokens}
      columnLabels={PROJECTED_LABELS}
      selectedRow={state.selectedQuery}
    />
  );
}

export function AttentionPlayground() {
  const [state, setState] = useState(() => createInitialAttentionState());
  const computation = state.pipeline.comparison[state.scalingMode];
  const selectedWeights = computation.weights[state.selectedQuery];
  const selectedRawScore = state.pipeline.rawScores[state.selectedQuery][state.selectedKey];
  const selectedScaledScore = state.pipeline.scaledScores[state.selectedQuery][state.selectedKey];
  const selectedWeight = selectedWeights[state.selectedKey];
  const strongestKey = useMemo(() => maxIndex(selectedWeights), [selectedWeights]);
  const rowSum = selectedWeights.reduce((sum, weight) => sum + weight, 0);
  const entropy = calculateEntropy(selectedWeights);
  const phaseCopy = PHASE_COPY[state.phase];

  function selectCell(queryIndex: number, keyIndex: number) {
    setState((current) => setAttentionSelection(current, queryIndex, keyIndex));
  }

  function selectQuery(queryIndex: number) {
    setState((current) =>
      setAttentionSelection(current, queryIndex, current.selectedKey),
    );
  }

  function selectScalingMode(mode: AttentionScalingMode) {
    setState((current) => setAttentionScalingMode(current, mode));
  }

  return (
    <section
      className="playground-shell attention-playground"
      aria-labelledby="attention-playground-heading"
    >
      <div className="playground-heading-row">
        <div>
          <p className="eyebrow">Interactive workbench</p>
          <h2 id="attention-playground-heading">Attention, calculation by calculation</h2>
        </div>
        <p>
          Follow one deterministic toy sequence from vectors to a weighted value
          mixture, then inspect any query-key relationship.
        </p>
      </div>

      <div className="playground-workbench attention-workbench">
        <aside className="control-panel attention-control-panel" aria-label="Attention controls">
          <div className="control-group">
            <span className="control-label">Calculation phase</span>
            <ol className="attention-phase-list" aria-label="Attention calculation phases">
              {ATTENTION_PHASES.map((phase, index) => (
                <li
                  key={phase.id}
                  className={phase.id === state.phase ? "is-current" : phase.id < state.phase ? "is-complete" : undefined}
                  aria-current={phase.id === state.phase ? "step" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {phase.label}
                </li>
              ))}
            </ol>
          </div>

          <div className="control-group">
            <label className="control-label-row" htmlFor="attention-temperature">
              <span>Softmax temperature</span>
              <output>{state.temperature.toFixed(1)}</output>
            </label>
            <input
              id="attention-temperature"
              className="attention-range"
              type="range"
              min={MIN_ATTENTION_TEMPERATURE}
              max={MAX_ATTENTION_TEMPERATURE}
              step="0.1"
              value={state.temperature}
              aria-valuetext={`${state.temperature.toFixed(1)}. ${temperatureCopy(state.temperature)}`}
              onChange={(event) =>
                setState((current) =>
                  setAttentionTemperature(current, Number(event.target.value)),
                )
              }
            />
            <div className="attention-range-labels" aria-hidden="true">
              <span>0.4 · sharper</span>
              <span>2.0 · softer</span>
            </div>
            <div
              className="attention-temperature-presets"
              role="group"
              aria-label="Temperature presets"
            >
              {([
                [0.4, "Low"],
                [1, "Standard"],
                [2, "High"],
              ] as const).map(([temperature, label]) => (
                <button
                  key={temperature}
                  type="button"
                  className={state.temperature === temperature ? "is-selected" : undefined}
                  aria-pressed={state.temperature === temperature}
                  onClick={() =>
                    setState((current) =>
                      setAttentionTemperature(current, temperature),
                    )
                  }
                >
                  {label} · {temperature.toFixed(1)}
                </button>
              ))}
            </div>
            <p className="control-hint">{temperatureCopy(state.temperature)}</p>
          </div>

          <div className="control-group">
            <span className="control-label" id="attention-scaling-label">
              Score comparison
            </span>
            <div className="attention-mode-control" role="group" aria-labelledby="attention-scaling-label">
              {(["scaled", "unscaled"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={state.scalingMode === mode ? "is-selected" : undefined}
                  aria-pressed={state.scalingMode === mode}
                  onClick={() => selectScalingMode(mode)}
                >
                  {mode === "scaled" ? "Scaled · standard" : "Unscaled · compare"}
                </button>
              ))}
            </div>
            <p className="control-hint">
              {state.scalingMode === "scaled"
                ? "Standard mode divides scores by √dₖ before softmax."
                : "Comparison mode skips √dₖ, often making the same row sharper."}
            </p>
          </div>

          <div className="transport-controls attention-transport-controls">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setState((current) => previousAttentionPhase(current))}
              disabled={state.phase === 0}
              aria-label="Show previous attention calculation phase"
            >
              <span aria-hidden="true">←</span> Previous
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setState((current) => nextAttentionPhase(current))}
              disabled={state.phase === 5}
              aria-label="Show next attention calculation phase"
            >
              Next <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="reset-button"
              onClick={() => setState((current) => resetAttentionState(current))}
            >
              Reset calculation
            </button>
          </div>

          <div className="attention-disclaimer">
            <span aria-hidden="true">i</span>
            <p>
              <strong>Toy mathematics, not a trained model.</strong> The vectors and
              projections are fixed teaching values. Their patterns do not represent
              learned linguistic understanding or production-model attention.
            </p>
          </div>
        </aside>

        <div className="visualization-panel attention-visualization-panel">
          <div className="attention-phase-header">
            <div>
              <span>{phaseCopy.eyebrow}</span>
              <strong>{phaseCopy.title}</strong>
              <p>{phaseCopy.body}</p>
            </div>
            <code>{phaseFormula(state)}</code>
          </div>

          <div className="attention-stage-panel">
            <PhaseMatrix state={state} />
          </div>

          <section className="attention-heatmap-panel" aria-labelledby="attention-heatmap-heading">
            <div className="attention-section-heading">
              <div>
                <span>Live result · updates with temperature and scaling</span>
                <h3 id="attention-heatmap-heading">Attention weights</h3>
              </div>
              <label htmlFor="attention-query-focus">
                Focus query
                <select
                  id="attention-query-focus"
                  value={state.selectedQuery}
                  onChange={(event) => selectQuery(Number(event.target.value))}
                >
                  {ATTENTION_TOKENS.map((token, index) => (
                    <option key={token} value={index}>{token}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="attention-heatmap-scroll" tabIndex={0} aria-label="Scrollable attention heatmap">
              <table className="attention-heatmap">
                <caption className="sr-only">
                  {state.scalingMode} attention weights at temperature {state.temperature.toFixed(1)}.
                  Rows are query tokens and columns are key tokens.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Query ↓ / Key →</th>
                    {ATTENTION_TOKENS.map((token, keyIndex) => (
                      <th scope="col" key={token} className={keyIndex === state.selectedKey ? "is-selected-axis" : undefined}>
                        {token}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {computation.weights.map((row, queryIndex) => {
                    const rowMaximum = maxIndex(row);
                    return (
                      <tr key={ATTENTION_TOKENS[queryIndex]} className={queryIndex === state.selectedQuery ? "is-selected-row" : undefined}>
                        <th scope="row">{ATTENTION_TOKENS[queryIndex]}</th>
                        {row.map((weight, keyIndex) => {
                          const isSelected = queryIndex === state.selectedQuery && keyIndex === state.selectedKey;
                          const isMaximum = keyIndex === rowMaximum;
                          const intensity = attentionColorIntensity(weight);
                          return (
                            <td key={`${queryIndex}-${keyIndex}`}>
                              <button
                                type="button"
                                className={`${isSelected ? "is-selected " : ""}${isMaximum ? "is-maximum" : ""}`.trim()}
                                style={{
                                  "--attention-intensity": intensity.toFixed(6),
                                } as CSSProperties}
                                aria-pressed={isSelected}
                                aria-label={`${ATTENTION_TOKENS[queryIndex]} query to ${ATTENTION_TOKENS[keyIndex]} key: weight ${weight.toFixed(4)}${isMaximum ? ", strongest in this row" : ""}`}
                                onClick={() => selectCell(queryIndex, keyIndex)}
                              >
                                {isMaximum && <span aria-hidden="true">★</span>}
                                <b>{weight.toFixed(3)}</b>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="attention-color-key"
              aria-label="Heatmap color scale. Lighter cells are closer to weight zero; darker cells approach weight 0.5 or above."
            >
              <span>0.000</span>
              <i aria-hidden="true" />
              <span>0.500+</span>
              <em>Lighter → darker attention weight · fixed matrix-wide scale</em>
            </div>

            <div className="attention-inspector" aria-live="polite">
              <div className="attention-pair-summary">
                <span>Selected relationship</span>
                <strong>
                  {ATTENTION_TOKENS[state.selectedQuery]}
                  <i aria-hidden="true">→</i>
                  {ATTENTION_TOKENS[state.selectedKey]}
                </strong>
                <p>Query row {state.selectedQuery + 1} · key column {state.selectedKey + 1}</p>
              </div>
              <dl className="attention-score-details">
                <div>
                  <dt>Raw dot product</dt>
                  <dd>{formatNumber(selectedRawScore, 4)}</dd>
                </div>
                <div>
                  <dt>Scaled score</dt>
                  <dd>{formatNumber(selectedScaledScore, 4)}</dd>
                </div>
                <div>
                  <dt>Softmax weight</dt>
                  <dd>{selectedWeight.toFixed(4)}</dd>
                </div>
              </dl>
              <dl className="attention-row-details">
                <div>
                  <dt>Row sum</dt>
                  <dd>{rowSum.toFixed(6)} ≈ 1</dd>
                </div>
                <div>
                  <dt>Entropy</dt>
                  <dd>{entropy.toFixed(3)} nats</dd>
                </div>
                <div>
                  <dt>Most attended key</dt>
                  <dd>★ {ATTENTION_TOKENS[strongestKey]}</dd>
                </div>
              </dl>
            </div>
          </section>

          <p className="sr-only" aria-live="polite">
            {phaseCopy.eyebrow}. Selected {ATTENTION_TOKENS[state.selectedQuery]} query
            and {ATTENTION_TOKENS[state.selectedKey]} key. Weight {selectedWeight.toFixed(4)}.
            The selected row sums to {rowSum.toFixed(6)}.
          </p>
        </div>
      </div>
    </section>
  );
}
