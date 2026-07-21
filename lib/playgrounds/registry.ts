import type { LabSlug } from "@/data/golden-papers";

export type TrustedPlaygroundEngine = "kmeans-v1" | "astar-v1" | "attention-v1";

export interface PlaygroundRegistryEntry {
  readonly engine: TrustedPlaygroundEngine;
  readonly status: "verified";
}

/**
 * This static registry is the only bridge between paper metadata and UI engines.
 * Future structured analysis may configure these engines, but never provide code.
 */
export const playgroundRegistry = {
  kmeans: { engine: "kmeans-v1", status: "verified" },
  astar: { engine: "astar-v1", status: "verified" },
  attention: { engine: "attention-v1", status: "verified" },
} as const satisfies Record<LabSlug, PlaygroundRegistryEntry>;

export function getPlaygroundRegistryEntry(slug: LabSlug): PlaygroundRegistryEntry {
  return playgroundRegistry[slug];
}
