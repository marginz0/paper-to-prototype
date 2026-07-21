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
  const isAvailable = paper.status === "available";
  const cardContent = (
    <>
      <div className="card-topline">
        <span>Lab {String(index + 1).padStart(2, "0")}</span>
        <span className={`status-label status-${paper.status}`}>
          <span className="status-dot" aria-hidden="true" />
          {isAvailable ? "Verified & ready" : "Planned"}
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

      <div className="card-action" aria-hidden={!isAvailable}>
        {isAvailable ? (
          <>
            Open laboratory <span aria-hidden="true">→</span>
          </>
        ) : (
          "In the research queue"
        )}
      </div>
    </>
  );

  return isAvailable ? (
    <Link className="gallery-card gallery-card-active" href="/lab/kmeans">
      {cardContent}
    </Link>
  ) : (
    <article className="gallery-card gallery-card-planned">{cardContent}</article>
  );
}

