import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { KMeansPlayground } from "@/components/playgrounds/KMeansPlayground";
import { LAB_SLUGS, getGoldenPaper } from "@/data/golden-papers";
import { getPlaygroundRegistryEntry } from "@/lib/playgrounds/registry";

interface LabPageProps {
  readonly params: Promise<{ slug: string }>;
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
  const isKMeansReady = registryEntry.engine === "kmeans-v1";

  return (
    <main id="main-content" className="lab-page">
      <header className="site-container lab-intro">
        <Link className="back-link" href="/#laboratories">
          <span aria-hidden="true">←</span> Laboratory collection
        </Link>
        <div className="lab-title-grid">
          <div>
            <p className="eyebrow">
              Laboratory {paper.slug === "kmeans" ? "01" : paper.slug === "astar" ? "02" : "03"}
              {" · "}
              {paper.status === "available" ? "Verified" : "Planned"}
            </p>
            <h1>{paper.methodName}</h1>
            <p className="lab-deck">{paper.learningGoal}</p>
          </div>
          <dl className="paper-metadata">
            <div>
              <dt>Original paper</dt>
              <dd>{paper.title}</dd>
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

      {isKMeansReady ? (
        <>
          <div className="site-container">
            <KMeansPlayground />
          </div>
          <section className="lab-reading-guide">
            <div className="site-container reading-guide-grid">
              <div>
                <p className="eyebrow">Read the experiment</p>
                <h2>Two alternating operations, one shrinking objective.</h2>
              </div>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>Assign</strong>
                    <p>Each observation joins the cluster with the nearest centroid.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Update</strong>
                    <p>Each centroid moves to the coordinate-wise mean of its members.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Repeat</strong>
                    <p>When an update produces no movement, this run has converged.</p>
                  </div>
                </li>
              </ol>
              <aside className="inertia-note">
                <span>Objective / inertia</span>
                <strong>Σ ‖xᵢ − μc(i)‖²</strong>
                <p>
                  The sum of squared distances from every point to its assigned
                  centroid. Lower means tighter clusters for the current k.
                </p>
              </aside>
            </div>
          </section>
        </>
      ) : (
        <section className="site-container planned-lab">
          <p className="eyebrow">Verification in progress</p>
          <h2>This laboratory is in the research queue.</h2>
          <p>
            The paper is part of the locked collection, but its algorithm and
            teaching experience have not been implemented or verified in this milestone.
          </p>
          <Link className="button button-primary" href="/lab/kmeans">
            Run the available k-Means lab <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}
    </main>
  );
}

