import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AStarPlayground } from "@/components/playgrounds/AStarPlayground";
import { AttentionPlayground } from "@/components/playgrounds/AttentionPlayground";
import { KMeansPlayground } from "@/components/playgrounds/KMeansPlayground";
import {
  LAB_SLUGS,
  getGoldenPaper,
  type LabSlug,
} from "@/data/golden-papers";
import {
  getPlaygroundRegistryEntry,
  type TrustedPlaygroundEngine,
} from "@/lib/playgrounds/registry";

interface LabPageProps {
  readonly params: Promise<{ slug: string }>;
}

interface ReadingGuide {
  readonly eyebrow: string;
  readonly title: string;
  readonly steps: readonly {
    readonly title: string;
    readonly body: string;
  }[];
  readonly formulaLabel: string;
  readonly formula: string;
  readonly formulaBody: string;
}

const LAB_NUMBERS: Record<LabSlug, string> = {
  kmeans: "01",
  astar: "02",
  attention: "03",
};

const READING_GUIDES: Record<LabSlug, ReadingGuide> = {
  kmeans: {
    eyebrow: "Read the experiment",
    title: "Two alternating operations, one shrinking objective.",
    steps: [
      {
        title: "Assign",
        body: "Each observation joins the cluster with the nearest centroid.",
      },
      {
        title: "Update",
        body: "Each centroid moves to the coordinate-wise mean of its members.",
      },
      {
        title: "Repeat",
        body: "When an update produces no movement, this run has converged.",
      },
    ],
    formulaLabel: "Objective / inertia",
    formula: "Σ ‖xᵢ − μc(i)‖²",
    formulaBody:
      "The sum of squared distances from every point to its assigned centroid. Lower means tighter clusters for the current k.",
  },
  astar: {
    eyebrow: "Read the search",
    title: "Cost so far, a guess ahead, one ordered frontier.",
    steps: [
      {
        title: "Choose",
        body: "Take the frontier node with the lowest f score, using a fixed tie-break order.",
      },
      {
        title: "Expand",
        body: "Close that node and update every reachable four-directional neighbor.",
      },
      {
        title: "Reconstruct",
        body: "When the goal is reached, follow predecessors back to the start.",
      },
    ],
    formulaLabel: "Frontier priority",
    formula: "f(n) = g(n) + w × h(n)",
    formulaBody:
      "g is path cost already paid; Manhattan h estimates the remaining grid distance. The weight controls how strongly the estimate guides search.",
  },
  attention: {
    eyebrow: "Read the calculation",
    title: "Project, compare, normalize, then mix the values.",
    steps: [
      {
        title: "Project",
        body: "Fixed matrices turn each toy token vector into a query, key, and value.",
      },
      {
        title: "Score and scale",
        body: "Query-key dot products are divided by the square root of the key width.",
      },
      {
        title: "Normalize and mix",
        body: "Softmax creates row-wise weights that combine the value vectors.",
      },
    ],
    formulaLabel: "Scaled attention",
    formula: "softmax(QKᵀ / √dₖ) V",
    formulaBody:
      "This small deterministic example exposes the mathematics only. It is not trained and does not claim linguistic understanding.",
  },
};

function getPlayground(engine: TrustedPlaygroundEngine) {
  switch (engine) {
    case "kmeans-v1":
      return <KMeansPlayground />;
    case "astar-v1":
      return <AStarPlayground />;
    case "attention-v1":
      return <AttentionPlayground />;
    default:
      return null;
  }
}

export function generateStaticParams() {
  return LAB_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: LabPageProps): Promise<Metadata> {
  const { slug } = await params;
  const paper = getGoldenPaper(slug);

  if (!paper) {
    return { title: "Laboratory not found" };
  }

  return {
    title: paper.methodName,
    description: paper.learningGoal,
  };
}

export default async function LabPage({ params }: LabPageProps) {
  const { slug } = await params;
  const paper = getGoldenPaper(slug);

  if (!paper) {
    notFound();
  }

  const registryEntry = getPlaygroundRegistryEntry(paper.slug);
  const playground = getPlayground(registryEntry.engine);

  if (!playground || registryEntry.status !== "verified") {
    notFound();
  }

  const guide = READING_GUIDES[paper.slug];

  return (
    <main id="main-content" className="lab-page">
      <header className="site-container lab-intro">
        <Link className="back-link" href="/#laboratories">
          <span aria-hidden="true">←</span> Laboratory collection
        </Link>
        <div className="lab-title-grid">
          <div>
            <p className="eyebrow">
              Laboratory {LAB_NUMBERS[paper.slug]} · Verified
            </p>
            <h1>{paper.methodName}</h1>
            <p className="lab-deck">{paper.learningGoal}</p>
          </div>
          <dl className="paper-metadata">
            <div>
              <dt>Original paper</dt>
              <dd>
                <a
                  className="paper-source-link"
                  href={paper.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${paper.title} (opens in a new tab)`}
                >
                  {paper.title} <span aria-hidden="true">↗</span>
                </a>
              </dd>
            </div>
            <div>
              <dt>Authors</dt>
              <dd>{paper.authors}</dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>{paper.year}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="site-container">{playground}</div>

      <section className="lab-reading-guide">
        <div className="site-container reading-guide-grid">
          <div>
            <p className="eyebrow">{guide.eyebrow}</p>
            <h2>{guide.title}</h2>
          </div>
          <ol>
            {guide.steps.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="inertia-note">
            <span>{guide.formulaLabel}</span>
            <strong>{guide.formula}</strong>
            <p>{guide.formulaBody}</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
