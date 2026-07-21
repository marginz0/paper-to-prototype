import Link from "next/link";

import type { GoldenPaper } from "@/data/golden-papers";

interface GalleryCardProps {
  readonly paper: GoldenPaper;
  readonly index: number;
}

function MethodGlyph({ slug }: Pick<GoldenPaper, "slug">) {
  if (slug === "kmeans") {
    return (
      <div className="method-glyph glyph-kmeans" aria-hidden="true">
        {["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((point) => (
          <span key={point} />
        ))}
        <i className="glyph-centroid glyph-centroid-one">×</i>
        <i className="glyph-centroid glyph-centroid-two">×</i>
        <i className="glyph-centroid glyph-centroid-three">×</i>
      </div>
    );
  }

  if (slug === "astar") {
    return (
      <div className="method-glyph glyph-astar" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <span key={index} />
        ))}
        <i />
      </div>
    );
  }

  return (
    <div className="method-glyph glyph-attention" aria-hidden="true">
      {Array.from({ length: 20 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

export function GalleryCard({ paper, index }: GalleryCardProps) {
  const labRoutes = {
    kmeans: "/lab/kmeans",
    astar: "/lab/astar",
    attention: "/lab/attention",
  } as const;

  const cardContent = (
    <>
      <div className="card-topline">
        <span>Lab {String(index + 1).padStart(2, "0")}</span>
        <span className={`status-label status-${paper.status}`}>
          <span className="status-dot" aria-hidden="true" />
          Verified &amp; ready
        </span>
      </div>

      <MethodGlyph slug={paper.slug} />

      <div className="card-copy">
        <h3>{paper.methodName}</h3>
        <p className="paper-citation">
          {paper.authors}, {paper.year}
        </p>
        <p className="card-summary">{paper.learningGoal}</p>
      </div>

      <div className="card-action">
        Open laboratory <span aria-hidden="true">→</span>
      </div>
    </>
  );

  return (
    <Link className="gallery-card gallery-card-active" href={labRoutes[paper.slug]}>
      {cardContent}
    </Link>
  );
}
