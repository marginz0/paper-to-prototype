export const LAB_SLUGS = ["kmeans", "astar", "attention"] as const;

export type LabSlug = (typeof LAB_SLUGS)[number];
export type LabStatus = "available";
export type PaperSource = "proceedings" | "journal" | "arxiv";

export interface GoldenPaper {
  readonly slug: LabSlug;
  readonly title: string;
  readonly authors: string;
  readonly year: number;
  readonly source: PaperSource;
  readonly sourceId: string | null;
  readonly sourceUrl: string;
  readonly methodName: string;
  readonly summary: string;
  readonly learningGoal: string;
  readonly status: LabStatus;
}

export const goldenPapers = [
  {
    slug: "kmeans",
    title: "Some Methods for Classification and Analysis of Multivariate Observations",
    authors: "James MacQueen",
    year: 1967,
    source: "proceedings",
    sourceId: null,
    sourceUrl: "https://digicoll.lib.berkeley.edu/record/113015?v=pdf",
    methodName: "k-Means Clustering",
    summary:
      "Assign points to their nearest centroid, then recompute each centroid from its assigned points.",
    learningGoal:
      "Step through assignment and centroid updates while tracking how cluster geometry changes inertia.",
    status: "available",
  },
  {
    slug: "astar",
    title: "A Formal Basis for the Heuristic Determination of Minimum Cost Paths",
    authors: "Peter E. Hart, Nils J. Nilsson, and Bertram Raphael",
    year: 1968,
    source: "journal",
    sourceId: "10.1109/TSSC.1968.300136",
    sourceUrl: "https://doi.org/10.1109/TSSC.1968.300136",
    methodName: "A* Search",
    summary:
      "Rank frontier states by path cost plus a heuristic estimate of the cost remaining.",
    learningGoal:
      "Observe how the heuristic guides frontier expansion toward a minimum-cost path.",
    status: "available",
  },
  {
    slug: "attention",
    title: "Attention Is All You Need",
    authors: "Ashish Vaswani et al.",
    year: 2017,
    source: "arxiv",
    sourceId: "1706.03762",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    methodName: "Scaled Dot-Product Attention",
    summary:
      "Scale query-key similarities, normalize them with softmax, and use the weights to combine values.",
    learningGoal:
      "Connect score scaling and normalization to the attention pattern and resulting value mixture.",
    status: "available",
  },
] as const satisfies readonly GoldenPaper[];

export function isLabSlug(value: string): value is LabSlug {
  return LAB_SLUGS.some((slug) => slug === value);
}

export function getGoldenPaper(slug: string): GoldenPaper | undefined {
  return goldenPapers.find((paper) => paper.slug === slug);
}
