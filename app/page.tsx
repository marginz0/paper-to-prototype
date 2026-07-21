import Link from "next/link";

import { GalleryCard } from "@/components/GalleryCard";
import { goldenPapers } from "@/data/golden-papers";

const previewPoints = [
  { left: 16, top: 64, cluster: 0 },
  { left: 23, top: 72, cluster: 0 },
  { left: 29, top: 58, cluster: 0 },
  { left: 44, top: 27, cluster: 1 },
  { left: 51, top: 35, cluster: 1 },
  { left: 58, top: 23, cluster: 1 },
  { left: 72, top: 62, cluster: 2 },
  { left: 79, top: 53, cluster: 2 },
  { left: 84, top: 68, cluster: 2 },
] as const;

export default function HomePage() {
  return (
    <main id="main-content">
      <section className="home-hero site-container">
        <div className="hero-copy">
          <p className="eyebrow">Interactive research methods · Verified collection</p>
          <h1>
            Don’t just read
            <br />
            the method. <em>Run it.</em>
          </h1>
          <p className="hero-intro">
            Paper-to-Prototype turns foundational algorithms into grounded learning
            laboratories—so you can change real parameters and watch each method
            unfold, one decision at a time.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/lab/kmeans">
              Open the k-Means lab <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" href="/#laboratories">
              View the collection <span aria-hidden="true">↓</span>
            </Link>
          </div>
        </div>

        <aside className="hero-specimen" aria-label="k-Means laboratory preview">
          <div className="specimen-header">
            <span>Live specimen / 01</span>
            <span className="specimen-state">
              <i aria-hidden="true" /> Assignment phase
            </span>
          </div>
          <div className="specimen-plot" aria-hidden="true">
            <span className="axis-label axis-y">feature 02</span>
            {previewPoints.map((point, index) => (
              <i
                key={index}
                className={`preview-point preview-cluster-${point.cluster}`}
                style={{ left: `${point.left}%`, top: `${point.top}%` }}
              />
            ))}
            <b className="preview-centroid centroid-preview-0">×</b>
            <b className="preview-centroid centroid-preview-1">×</b>
            <b className="preview-centroid centroid-preview-2">×</b>
            <span className="axis-label axis-x">feature 01</span>
          </div>
          <div className="specimen-footer">
            <span>
              <small>Clusters</small>
              <strong>k = 3</strong>
            </span>
            <span>
              <small>Next operation</small>
              <strong>Find nearest centroid</strong>
            </span>
          </div>
        </aside>
      </section>

      <section className="problem-section">
        <div className="site-container problem-grid">
          <div>
            <p className="eyebrow">01 / The learning gap</p>
            <h2>A summary tells you what. A laboratory shows you why.</h2>
          </div>
          <div className="problem-copy">
            <p>
              Research methods are written to be precise, not necessarily tangible.
              Static explanations flatten an iterative process into another block of
              text. The crucial intuition often lives in the transition between steps.
            </p>
            <p>
              Here, every control maps to actual algorithm logic. Advance a single
              phase, inspect the state, then form your own mental model.
            </p>
          </div>
        </div>
        <div className="site-container learning-loop" aria-label="Paper-to-Prototype learning loop">
          <div>
            <span>01</span>
            <strong>Choose a method</strong>
            <p>Start from a verified foundational paper.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Change a parameter</strong>
            <p>Manipulate a real input to the algorithm.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Observe each phase</strong>
            <p>See state, motion, and objective values evolve.</p>
          </div>
        </div>
      </section>

      <section className="laboratories-section site-container" id="laboratories">
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 / Verified collection</p>
            <h2>Three methods. One careful lab at a time.</h2>
          </div>
          <p>
            Move from geometric clustering to informed search and the mechanics of
            attention. Every laboratory runs verified, repository-owned algorithm code.
          </p>
        </div>
        <div className="gallery-grid">
          {goldenPapers.map((paper, index) => (
            <GalleryCard key={paper.slug} paper={paper} index={index} />
          ))}
        </div>
      </section>

      <section className="trust-section">
        <div className="site-container trust-inner">
          <p className="eyebrow">A deliberate boundary</p>
          <p>
            Each laboratory couples deterministic algorithm code with a trusted,
            purpose-built visualization. Nothing is generated or executed at runtime.
          </p>
        </div>
      </section>
    </main>
  );
}
