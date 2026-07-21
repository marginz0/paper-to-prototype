"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createInitialKMeansState,
  DEFAULT_KMEANS_SEED,
  MAX_K,
  MIN_K,
  resetKMeans,
  stepKMeans,
  type KMeansState,
} from "@/lib/algorithms/kmeans";

const CLUSTER_COLORS = ["#1b63d9", "#e26335", "#16856c", "#c13c75", "#8c6b18"];
const K_VALUES = Array.from({ length: MAX_K - MIN_K + 1 }, (_, index) => MIN_K + index);
const GRID_TICKS = [0, 25, 50, 75, 100] as const;
const PLOT = { left: 58, right: 742, top: 32, bottom: 468 } as const;

const SPEED_OPTIONS = [
  { id: "slow", label: "Slow", delay: 1_150 },
  { id: "standard", label: "Standard", delay: 700 },
  { id: "quick", label: "Quick", delay: 360 },
] as const;

type SpeedId = (typeof SPEED_OPTIONS)[number]["id"];

const inertiaFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function toPlotX(value: number): number {
  return PLOT.left + (value / 100) * (PLOT.right - PLOT.left);
}

function toPlotY(value: number): number {
  return PLOT.bottom - (value / 100) * (PLOT.bottom - PLOT.top);
}

function getPhaseCopy(state: KMeansState): { label: string; title: string; body: string } {
  if (state.converged) {
    return {
      label: "Converged",
      title: "The centroids have stopped moving.",
      body: `After ${state.iteration} full ${state.iteration === 1 ? "iteration" : "iterations"}, another update produced no change. This is a stable local solution for this starting state.`,
    };
  }

  if (state.phase === "assignment") {
    return {
      label: "Assignment phase",
      title: "Give every point to its nearest centroid.",
      body: state.assignments.every((assignment) => assignment === null)
        ? "The points begin unlabeled. Step once to compare every point with each × centroid and reveal the nearest cluster."
        : "Cluster means have moved. The next step rechecks every point against those new positions, which can change its membership.",
    };
  }

  return {
    label: "Centroid update",
    title: "Move each centroid to its cluster mean.",
    body: "Membership is fixed for this phase. The next step averages the x and y coordinates within each color, then moves its × marker to that mean.",
  };
}

export function KMeansPlayground() {
  const [state, setState] = useState(() =>
    createInitialKMeansState({ k: 3, seed: DEFAULT_KMEANS_SEED }),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedId>("standard");

  const speedDelay = SPEED_OPTIONS.find((option) => option.id === speed)?.delay ?? 700;
  const phaseCopy = useMemo(() => getPhaseCopy(state), [state]);

  const stepOnce = useCallback(() => {
    setState((current) => stepKMeans(current));
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.converged) {
          window.clearInterval(timer);
          return current;
        }
        return stepKMeans(current);
      });
    }, speedDelay);

    return () => window.clearInterval(timer);
  }, [isPlaying, speedDelay]);

  useEffect(() => {
    if (state.converged && isPlaying) {
      setIsPlaying(false);
    }
  }, [isPlaying, state.converged]);

  function handleReset() {
    setIsPlaying(false);
    setState((current) => resetKMeans(current));
  }

  function handleKChange(nextK: number) {
    setIsPlaying(false);
    setState((current) => resetKMeans(current, { k: nextK }));
  }

  const hasAssignments = state.assignments.some((assignment) => assignment !== null);

  return (
    <section className="playground-shell" aria-labelledby="playground-heading">
      <div className="playground-heading-row">
        <div>
          <p className="eyebrow">Interactive workbench</p>
          <h2 id="playground-heading">Lloyd’s algorithm, phase by phase</h2>
        </div>
        <p>
          Points and starting centroids use a fixed seed. Reset always returns to
          this exact experimental state.
        </p>
      </div>

      <div className="playground-workbench">
        <aside className="control-panel" aria-label="k-Means controls">
          <div className="control-group">
            <div className="control-label-row">
              <span id="k-control-label">Number of clusters</span>
              <output aria-live="polite">k = {state.k}</output>
            </div>
            <div className="segmented-control" role="group" aria-labelledby="k-control-label">
              {K_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === state.k ? "is-selected" : undefined}
                  aria-pressed={value === state.k}
                  onClick={() => handleKChange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="control-hint">Changing k creates a deterministic reset.</p>
          </div>

          <div className="control-group">
            <span className="control-label" id="speed-control-label">
              Animation speed
            </span>
            <div
              className="speed-control"
              role="group"
              aria-labelledby="speed-control-label"
            >
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === speed ? "is-selected" : undefined}
                  aria-pressed={option.id === speed}
                  onClick={() => setSpeed(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="transport-controls">
            <button
              type="button"
              className="button button-primary transport-main"
              onClick={() => setIsPlaying((playing) => !playing)}
              disabled={state.converged}
              aria-label={isPlaying ? "Pause k-Means animation" : "Play k-Means animation"}
            >
              <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={stepOnce}
              disabled={state.converged || isPlaying}
              aria-label={`Run one ${state.phase === "assignment" ? "assignment" : "centroid update"} phase`}
            >
              Step <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="reset-button" onClick={handleReset}>
              Reset experiment
            </button>
          </div>

          <div className={`phase-note${state.converged ? " phase-note-complete" : ""}`}>
            <span>{phaseCopy.label}</span>
            <strong>{phaseCopy.title}</strong>
            <p>{phaseCopy.body}</p>
          </div>
        </aside>

        <div className="visualization-panel">
          <div className="metrics-grid" aria-label="Current algorithm state">
            <div>
              <span>Current phase</span>
              <strong>{state.phase === "assignment" ? "Assignment" : "Centroid update"}</strong>
            </div>
            <div>
              <span>Iterations</span>
              <strong>{state.iteration}</strong>
            </div>
            <div>
              <span>Inertia</span>
              <strong>{inertiaFormatter.format(state.inertia)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{state.converged ? "Converged" : isPlaying ? "Running" : "Paused"}</strong>
            </div>
          </div>

          <div className="plot-frame">
            <div className="plot-label-row">
              <span>Deterministic 2D dataset · seed {state.seed}</span>
              <span>{state.points.length} observations</span>
            </div>
            <svg
              className="kmeans-plot"
              viewBox="0 0 800 510"
              role="img"
              aria-labelledby="plot-title plot-description"
            >
              <title id="plot-title">Interactive k-Means clustering scatter plot</title>
              <desc id="plot-description">
                Sixty deterministic points and {state.k} centroids. Point colors show
                cluster assignments, and centroids are marked with crosses.
              </desc>

              <rect
                className="plot-background"
                x={PLOT.left}
                y={PLOT.top}
                width={PLOT.right - PLOT.left}
                height={PLOT.bottom - PLOT.top}
              />

              {GRID_TICKS.map((tick) => {
                const x = toPlotX(tick);
                const y = toPlotY(tick);
                return (
                  <g key={tick} className="plot-grid">
                    <line x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} />
                    <line x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} />
                    <text x={x} y={PLOT.bottom + 23} textAnchor="middle">
                      {tick}
                    </text>
                    <text x={PLOT.left - 15} y={y + 4} textAnchor="end">
                      {tick}
                    </text>
                  </g>
                );
              })}

              {hasAssignments &&
                state.points.map((point, pointIndex) => {
                  const assignment = state.assignments[pointIndex];
                  if (assignment === null) {
                    return null;
                  }
                  const centroid = state.centroids[assignment];
                  return (
                    <line
                      key={`link-${point.id}`}
                      className="assignment-link"
                      x1={toPlotX(point.x)}
                      y1={toPlotY(point.y)}
                      x2={toPlotX(centroid.x)}
                      y2={toPlotY(centroid.y)}
                      stroke={CLUSTER_COLORS[assignment]}
                    />
                  );
                })}

              {state.points.map((point, pointIndex) => {
                const assignment = state.assignments[pointIndex];
                return (
                  <circle
                    key={point.id}
                    className="data-point"
                    cx={toPlotX(point.x)}
                    cy={toPlotY(point.y)}
                    r={5.8}
                    fill={assignment === null ? "#9aa1ad" : CLUSTER_COLORS[assignment]}
                  />
                );
              })}

              {state.centroids.map((centroid) => {
                const x = toPlotX(centroid.x);
                const y = toPlotY(centroid.y);
                const color = CLUSTER_COLORS[centroid.cluster];
                return (
                  <g
                    key={`centroid-${centroid.cluster}`}
                    className="centroid-marker"
                    style={{ transform: `translate(${x}px, ${y}px)` }}
                  >
                    <circle r="13" fill={color} />
                    <circle r="9" fill="#fbf8f1" />
                    <line x1="-5" x2="5" y1="-5" y2="5" stroke={color} />
                    <line x1="-5" x2="5" y1="5" y2="-5" stroke={color} />
                  </g>
                );
              })}

              <text className="plot-axis-title" x={(PLOT.left + PLOT.right) / 2} y="505">
                feature 01
              </text>
              <text
                className="plot-axis-title"
                x="15"
                y={(PLOT.top + PLOT.bottom) / 2}
                transform={`rotate(-90 15 ${(PLOT.top + PLOT.bottom) / 2})`}
              >
                feature 02
              </text>
            </svg>
            <div className="cluster-legend" aria-label="Cluster color legend">
              {state.centroids.map((centroid) => (
                <span key={centroid.cluster}>
                  <i style={{ background: CLUSTER_COLORS[centroid.cluster] }} aria-hidden="true" />
                  Cluster {centroid.cluster + 1}
                </span>
              ))}
              <span className="centroid-legend">
                <i aria-hidden="true">×</i> Centroid
              </span>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {phaseCopy.label}. Iteration {state.iteration}. Inertia {inertiaFormatter.format(state.inertia)}.
          </p>
        </div>
      </div>
    </section>
  );
}

