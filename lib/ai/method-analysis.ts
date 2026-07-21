import { z } from "zod";

import { CANONICAL_ARXIV_ID_PATTERN } from "../arxiv/normalize";

export const DETECTED_METHOD_FAMILIES = [
  "kmeans_clustering",
  "astar_search",
  "scaled_dot_product_attention",
  "other",
] as const;

export const METHOD_COMPATIBILITIES = ["supported", "unsupported"] as const;
export const SUPPORTED_LAB_SLUGS = ["kmeans", "astar", "attention"] as const;
export const METHOD_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export const METHOD_ANALYSIS_FIELDS = [
  "arxiv_id",
  "paper_title",
  "authors",
  "method_name",
  "one_liner",
  "learning_goal",
  "steps",
  "parameters",
  "detected_method_family",
  "compatibility",
  "supported_lab_slug",
  "match_reason",
  "confidence",
  "evidence",
  "limitations",
] as const;

export const methodParameterSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    meaning: z.string().trim().min(1).max(300),
    effect: z.string().trim().min(1).max(300),
  })
  .strict();

export const methodEvidenceSchema = z
  .object({
    paper_section: z.string().trim().min(1).max(160),
    page_number: z.number().int().positive().nullable(),
    paraphrased_support: z.string().trim().min(1).max(600),
  })
  .strict();

export const MethodAnalysisSchema = z
  .object({
    arxiv_id: z
      .string()
      .trim()
      .regex(CANONICAL_ARXIV_ID_PATTERN),
    paper_title: z.string().trim().min(1).max(300),
    authors: z.array(z.string().trim().min(1).max(160)).min(1).max(30),
    method_name: z.string().trim().min(1).max(160),
    one_liner: z.string().trim().min(1).max(300),
    learning_goal: z.string().trim().min(1).max(400),
    steps: z.array(z.string().trim().min(1).max(240)).min(3).max(7),
    parameters: z.array(methodParameterSchema).max(5),
    detected_method_family: z.enum(DETECTED_METHOD_FAMILIES),
    compatibility: z.enum(METHOD_COMPATIBILITIES),
    supported_lab_slug: z.enum(SUPPORTED_LAB_SLUGS).nullable(),
    match_reason: z.string().trim().min(1).max(500),
    confidence: z.enum(METHOD_CONFIDENCE_LEVELS),
    evidence: z.array(methodEvidenceSchema).min(1).max(3),
    limitations: z.array(z.string().trim().min(1).max(300)).min(1).max(4),
  })
  .strict();

export type MethodAnalysis = z.infer<typeof MethodAnalysisSchema>;
export type DetectedMethodFamily = MethodAnalysis["detected_method_family"];
export type SupportedLabSlug = NonNullable<MethodAnalysis["supported_lab_slug"]>;

export const FAMILY_TO_LAB_SLUG = {
  kmeans_clustering: "kmeans",
  astar_search: "astar",
  scaled_dot_product_attention: "attention",
} as const satisfies Readonly<
  Record<Exclude<DetectedMethodFamily, "other">, SupportedLabSlug>
>;

export type MethodAnalysisConsistencyCode =
  | "supported_requires_lab_slug"
  | "unsupported_requires_null_slug"
  | "method_family_lab_mismatch"
  | "other_family_is_unsupported"
  | "low_confidence_is_non_definitive";

export interface MethodAnalysisConsistencyIssue {
  readonly code: MethodAnalysisConsistencyCode;
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export class MethodAnalysisConsistencyError extends Error {
  readonly issues: readonly MethodAnalysisConsistencyIssue[];

  constructor(issues: readonly MethodAnalysisConsistencyIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "MethodAnalysisConsistencyError";
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Checks relationships that cannot be represented by independent field types.
 * A low-confidence analysis must remain unsupported so it cannot silently select
 * a trusted visualization engine.
 */
export function validateMethodAnalysisConsistency(
  analysis: MethodAnalysis,
): MethodAnalysisConsistencyIssue[] {
  const issues: MethodAnalysisConsistencyIssue[] = [];

  if (analysis.compatibility === "supported") {
    if (analysis.supported_lab_slug === null) {
      issues.push({
        code: "supported_requires_lab_slug",
        path: ["supported_lab_slug"],
        message: "A supported analysis must select a supported lab slug.",
      });
    }

    if (analysis.detected_method_family === "other") {
      issues.push({
        code: "other_family_is_unsupported",
        path: ["compatibility"],
        message: 'The "other" method family must be marked unsupported.',
      });
    } else {
      const expectedSlug = FAMILY_TO_LAB_SLUG[analysis.detected_method_family];
      if (
        analysis.supported_lab_slug !== null &&
        analysis.supported_lab_slug !== expectedSlug
      ) {
        issues.push({
          code: "method_family_lab_mismatch",
          path: ["supported_lab_slug"],
          message: `Method family ${analysis.detected_method_family} can only select the ${expectedSlug} lab.`,
        });
      }
    }
  } else if (analysis.supported_lab_slug !== null) {
    issues.push({
      code: "unsupported_requires_null_slug",
      path: ["supported_lab_slug"],
      message: "An unsupported analysis must not select a lab slug.",
    });
  }

  if (
    analysis.detected_method_family === "other" &&
    (analysis.compatibility !== "unsupported" ||
      analysis.supported_lab_slug !== null)
  ) {
    if (!issues.some((issue) => issue.code === "other_family_is_unsupported")) {
      issues.push({
        code: "other_family_is_unsupported",
        path: ["detected_method_family"],
        message: 'The "other" method family must be unsupported with no lab slug.',
      });
    }
  }

  if (
    analysis.confidence === "low" &&
    (analysis.compatibility !== "unsupported" ||
      analysis.supported_lab_slug !== null)
  ) {
    issues.push({
      code: "low_confidence_is_non_definitive",
      path: ["confidence"],
      message: "A low-confidence analysis must be non-definitive: unsupported with no lab slug.",
    });
  }

  return issues;
}

export function assertMethodAnalysisConsistency(
  analysis: MethodAnalysis,
): asserts analysis is MethodAnalysis {
  const issues = validateMethodAnalysisConsistency(analysis);
  if (issues.length > 0) {
    throw new MethodAnalysisConsistencyError(issues);
  }
}

/**
 * Lowercase alias retained for local callers. Cross-field rules intentionally
 * stay out of this structural schema so it remains compatible with Structured
 * Outputs; trusted application code applies the separate consistency validator.
 */
export const methodAnalysisSchema = MethodAnalysisSchema;

/** Structural failures throw ZodError; cross-field failures use the typed error. */
export function parseMethodAnalysis(input: unknown): MethodAnalysis {
  const analysis = MethodAnalysisSchema.parse(input);
  assertMethodAnalysisConsistency(analysis);
  return analysis;
}
