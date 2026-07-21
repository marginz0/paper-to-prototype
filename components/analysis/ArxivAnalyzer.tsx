"use client";

import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type {
  AnalysisApiErrorBody,
  AnalysisApiSuccessBody,
} from "@/lib/ai/analysis-api";
import type { ArxivPaperAnalysisResult } from "@/lib/ai/analyze-arxiv-paper";
import { ArxivInputError, normalizeArxivInput } from "@/lib/arxiv/normalize";

const SAMPLE_ARXIV_ID = "1706.03762";
const VERIFIED_LABS = [
  { slug: "kmeans", label: "k-Means clustering" },
  { slug: "astar", label: "A* Search" },
  { slug: "attention", label: "Scaled Dot-Product Attention" },
] as const;
const VERIFIED_LAB_ROUTES = {
  kmeans: "/lab/kmeans",
  astar: "/lab/astar",
  attention: "/lab/attention",
} as const;

type AnalyzerState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "success"; readonly result: ArxivPaperAnalysisResult }
  | {
      readonly kind: "error";
      readonly error: AnalysisApiErrorBody["error"];
    };

export function ArxivAnalyzer() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<AnalyzerState>({ kind: "idle" });
  const resultRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.kind === "success") {
      resultRef.current?.focus();
    } else if (state.kind === "error") {
      errorRef.current?.focus();
    }
  }, [state]);

  async function submitValue(value: string) {
    if (state.kind === "loading") return;

    try {
      normalizeArxivInput(value);
    } catch (error) {
      const message =
        error instanceof ArxivInputError
          ? "Enter an arXiv ID such as 1706.03762, or an HTTPS arxiv.org abs/pdf URL."
          : "The arXiv input could not be validated.";
      setState({
        kind: "error",
        error: {
          code: "INVALID_ARXIV_INPUT",
          message,
          retryable: false,
        },
      });
      return;
    }

    setState({ kind: "loading" });

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arxiv: value }),
      });
      const payload: unknown = await response.json();

      if (!response.ok || !isSuccessPayload(payload)) {
        const error = isErrorPayload(payload)
          ? payload.error
          : {
              code: "UPSTREAM_UNAVAILABLE" as const,
              message: "The analysis service returned an unexpected response.",
              retryable: true,
            };
        setState({ kind: "error", error });
        return;
      }

      setState({ kind: "success", result: payload.result });
    } catch {
      setState({
        kind: "error",
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "The analysis request could not reach the server. Please try again.",
          retryable: true,
        },
      });
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitValue(input);
  }

  function useSample() {
    setInput(SAMPLE_ARXIV_ID);
    void submitValue(SAMPLE_ARXIV_ID);
  }

  const isLoading = state.kind === "loading";
  const hasInputError =
    state.kind === "error" &&
    (state.error.code === "INVALID_REQUEST" ||
      state.error.code === "INVALID_ARXIV_INPUT");
  const describedBy = state.kind === "error" ? "arxiv-help analyzer-error" : "arxiv-help";

  return (
    <section className="site-container analyzer-section" aria-labelledby="analyzer-heading">
      <div className="analyzer-shell">
        <div className="analyzer-form-panel">
          <div className="analyzer-panel-index" aria-hidden="true">
            01 / paper input
          </div>
          <div className="analyzer-form-copy">
            <p className="eyebrow">One paper / one structured request</p>
            <h2 id="analyzer-heading">Analyze a central method</h2>
            <p>
              Paste a modern arXiv ID or an arxiv.org record link. The server constructs
              the PDF address after validation; arbitrary URLs are never fetched.
            </p>
          </div>

          <form className="analyzer-form" onSubmit={submit} noValidate>
            <label htmlFor="arxiv-input">arXiv ID or URL</label>
            <div className="analyzer-input-row">
              <input
                id="arxiv-input"
                name="arxiv"
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                aria-describedby={describedBy}
                aria-invalid={hasInputError || undefined}
                placeholder="1706.03762 or https://arxiv.org/abs/…"
                disabled={isLoading}
              />
              <button className="button button-primary" type="submit" disabled={isLoading}>
                {isLoading ? "Analyzing…" : "Analyze paper"}
              </button>
            </div>
            <div className="analyzer-form-meta">
              <p id="arxiv-help">
                Accepted example: <code>1706.03762v7</code>. Queries, fragments, other
                domains, and user-supplied fetch targets are rejected.
              </p>
              <button
                className="sample-paper-action"
                type="button"
                onClick={useSample}
                disabled={isLoading}
              >
                Try verified sample / 1706.03762 <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>

          <div className="analyzer-boundary-note">
            <span aria-hidden="true">i</span>
            <p>
              <strong>Experimental matcher, trusted laboratories.</strong>
              Analysis may be imperfect. A match only opens repository-owned,
              deterministic visualization code.
            </p>
          </div>
        </div>

        <aside className="analyzer-process-panel" aria-label="Analysis process">
          <p className="eyebrow">What the server does</p>
          <ol>
            <li>
              <span>01</span>
              <div><strong>Normalize</strong><p>Accept only a canonical arXiv identifier.</p></div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Resolve</strong>
                <p>Use a reviewed record when available; otherwise analyze the internally constructed PDF URL with GPT-5.6.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div><strong>Validate</strong><p>Parse one strict schema and enforce match consistency.</p></div>
            </li>
            <li>
              <span>04</span>
              <div><strong>Route honestly</strong><p>Open an exact trusted match—or explain why none fits.</p></div>
            </li>
          </ol>
        </aside>
      </div>

      <div className="analyzer-status" aria-live="polite" aria-atomic="true">
        {isLoading && (
          <div className="analysis-progress" role="status">
            <span className="analysis-progress-mark" aria-hidden="true" />
            <div>
              <strong>Resolving the method as structured data…</strong>
              <p>
                One server request checks for a reviewed record and, when needed,
                analyzes the external PDF before testing for an exact trusted match.
              </p>
            </div>
          </div>
        )}
      </div>

      {state.kind === "error" && (
        <div
          id="analyzer-error"
          ref={errorRef}
          className="analysis-error-panel"
          role="alert"
          tabIndex={-1}
        >
          <div>
            <p className="eyebrow">Analysis stopped / {state.error.code}</p>
            <h2>{errorTitle(state.error.code)}</h2>
            <p>{state.error.message}</p>
          </div>
          <div className="analysis-error-actions">
            {state.error.retryable && (
              <button
                className="button button-primary"
                type="button"
                onClick={() => void submitValue(input)}
              >
                Retry analysis
              </button>
            )}
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setState({ kind: "idle" })}
            >
              Check another paper
            </button>
          </div>
        </div>
      )}

      {state.kind === "success" && (
        <AnalysisResultView
          ref={resultRef}
          result={state.result}
          onAnalyzeAnother={() => setState({ kind: "idle" })}
        />
      )}
    </section>
  );
}

const AnalysisResultView = forwardRef<
  HTMLDivElement,
  {
    readonly result: ArxivPaperAnalysisResult;
    readonly onAnalyzeAnother: () => void;
  }
>(function AnalysisResultView({ result, onAnalyzeAnother }, ref) {
  const { analysis } = result;
  const supportedSlug =
    analysis.compatibility === "supported" ? analysis.supported_lab_slug : null;
  const isSupported = supportedSlug !== null;
  const labHref = supportedSlug
    ? {
        pathname: VERIFIED_LAB_ROUTES[supportedSlug],
        query: { arxiv: result.canonicalArxivId, origin: "analysis" },
      }
    : null;
  const supportedLabLabel = supportedSlug ? labLabel(supportedSlug) : null;

  return (
    <div ref={ref} className="analysis-result" tabIndex={-1} aria-labelledby="analysis-result-title">
      <header className="analysis-result-header">
        <div className="analysis-result-badges">
          <span className={`provenance-badge provenance-${result.provenance}`}>
            {result.provenance === "verified_cache"
              ? "Verified analysis"
              : "GPT-5.6 analysis"}
          </span>
          <span className={`confidence-badge confidence-${analysis.confidence}`}>
            {analysis.confidence} confidence
          </span>
          <span className={`compatibility-badge compatibility-${analysis.compatibility}`}>
            {analysis.compatibility === "supported"
              ? "Trusted lab match"
              : "No faithful lab match"}
          </span>
        </div>
        <p className="eyebrow">Structured method record / {analysis.arxiv_id}</p>
        <h2 id="analysis-result-title">{analysis.paper_title}</h2>
        <p className="analysis-authors">{analysis.authors.join(" · ")}</p>
        <a className="text-link" href={result.recordUrl} target="_blank" rel="noreferrer">
          View original arXiv record <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="analysis-method-summary">
        <div>
          <p className="eyebrow">Central method</p>
          <h3>{analysis.method_name}</h3>
          <p>{analysis.one_liner}</p>
        </div>
        <div className="analysis-learning-goal">
          <span>Learning goal</span>
          <p>{analysis.learning_goal}</p>
        </div>
      </div>

      <div className="analysis-result-grid">
        <section className="analysis-steps" aria-labelledby="analysis-steps-heading">
          <p className="eyebrow">Procedure</p>
          <h3 id="analysis-steps-heading">How the method moves</h3>
          <ol>
            {analysis.steps.map((step, index) => (
              <li key={`${index}-${step}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="analysis-parameters" aria-labelledby="analysis-parameters-heading">
          <p className="eyebrow">Learner controls</p>
          <h3 id="analysis-parameters-heading">Parameters to notice</h3>
          {analysis.parameters.length > 0 ? (
            <dl>
              {analysis.parameters.map((parameter) => (
                <div key={parameter.name}>
                  <dt>{parameter.name}</dt>
                  <dd>{parameter.meaning}</dd>
                  <dd className="parameter-effect">Effect / {parameter.effect}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="analysis-empty-note">
              No bounded learner-facing parameter was identified with confidence.
            </p>
          )}
        </section>
      </div>

      <section className="analysis-evidence" aria-labelledby="analysis-evidence-heading">
        <div className="analysis-section-heading">
          <div>
            <p className="eyebrow">Paper-grounded evidence</p>
            <h3 id="analysis-evidence-heading">Why this analysis says so</h3>
          </div>
          <p>Support is paraphrased; the product does not reproduce paper passages.</p>
        </div>
        <div className="evidence-list">
          {analysis.evidence.map((item, index) => (
            <details key={`${item.paper_section}-${index}`} open={index === 0}>
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.paper_section}</strong>
                <em>{item.page_number === null ? "Page not identified" : `Page ${item.page_number}`}</em>
              </summary>
              <p>{item.paraphrased_support}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={`analysis-match-panel ${isSupported ? "is-supported" : "is-unsupported"}`}>
        <div>
          <p className="eyebrow">Compatibility decision</p>
          <h3>
            {isSupported
              ? "A trusted laboratory faithfully represents this method."
              : "No existing laboratory faithfully represents this method."}
          </h3>
          <p>{analysis.match_reason}</p>
        </div>
        {labHref ? (
          <Link className="button button-primary" href={labHref}>
            Open the {supportedLabLabel} lab
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <div className="unsupported-lab-links" aria-label="Explore verified laboratories">
            {VERIFIED_LABS.map((lab) => (
              <Link key={lab.slug} href={`/lab/${lab.slug}`}>
                {lab.label} <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="analysis-result-footer">
        <div>
          <p className="eyebrow">Limitations</p>
          <ul>
            {analysis.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
        <button className="button button-secondary" type="button" onClick={onAnalyzeAnother}>
          Analyze another paper
        </button>
      </div>
    </div>
  );
});

function isSuccessPayload(payload: unknown): payload is AnalysisApiSuccessBody {
  return (
    isRecord(payload) &&
    payload.ok === true &&
    isRecord(payload.result) &&
    isRecord(payload.result.analysis)
  );
}

function isErrorPayload(payload: unknown): payload is AnalysisApiErrorBody {
  return (
    isRecord(payload) &&
    payload.ok === false &&
    isRecord(payload.error) &&
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string" &&
    typeof payload.error.retryable === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorTitle(code: AnalysisApiErrorBody["error"]["code"]): string {
  switch (code) {
    case "INVALID_REQUEST":
    case "INVALID_ARXIV_INPUT":
      return "That input is not a safe arXiv reference.";
    case "ANALYSIS_UNAVAILABLE":
      return "Live analysis is not configured here.";
    case "ANALYSIS_UNUSABLE":
      return "No reliable structured analysis was produced.";
    case "RATE_LIMITED":
      return "The live-analysis desk needs a short pause.";
    case "UPSTREAM_TIMEOUT":
      return "The paper took too long to analyze.";
    case "UPSTREAM_UNAVAILABLE":
      return "The analysis provider is temporarily unavailable.";
  }
}

function labLabel(slug: "kmeans" | "astar" | "attention"): string {
  return VERIFIED_LABS.find((lab) => lab.slug === slug)?.label ?? slug;
}
