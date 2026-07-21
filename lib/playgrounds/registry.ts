import type { LabSlug } from "@/data/golden-papers";

export type TrustedPlaygroundEngine = "kmeans-v1";

export interface PlaygroundRegistryEntry {
  readonly engine: TrustedPlaygroundEngine | null;
  readonly status: "verified" | "planned";
}

/**
 * This static registry is the only bridge between paper metadata and UI engines.
 * Future structured analysis may configure these engines, but never provide code.
 */
export const playgroundRegistry = {
  kmeans: { engine: "kmeans-v1", status: "verified" },
  astar: { engine: null, status: "planned" },
  attention: { engine: null, status: "planned" },
} as const satisfies Record<LabSlug, PlaygroundRegistryEntry>;

export function getPlaygroundRegistryEntry(slug: LabSlug): PlaygroundRegistryEntry {
  return playgroundRegistry[slug];
}

