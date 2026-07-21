import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CANONICAL_ARXIV_ID_PATTERN } from "../arxiv/normalize";

import {
  DETECTED_METHOD_FAMILIES,
  METHOD_ANALYSIS_FIELDS,
  METHOD_COMPATIBILITIES,
  METHOD_CONFIDENCE_LEVELS,
  MethodAnalysisConsistencyError,
  SUPPORTED_LAB_SLUGS,
  assertMethodAnalysisConsistency,
  methodAnalysisSchema,
  parseMethodAnalysis,
  validateMethodAnalysisConsistency,
  type MethodAnalysis,
} from "./method-analysis";
import {
  VERIFIED_ATTENTION_ANALYSIS,
  VERIFIED_METHOD_ANALYSIS_CACHE,
  getVerifiedMethodAnalysis,
} from "./verified-cache";

function withChanges(
  changes: Partial<MethodAnalysis>,
): MethodAnalysis {
  return { ...VERIFIED_ATTENTION_ANALYSIS, ...changes };
}

describe("canonical method-analysis schema", () => {
  it("accepts the hand-reviewed Attention analysis and rejects unknown fields", () => {
    expect(methodAnalysisSchema.parse(VERIFIED_ATTENTION_ANALYSIS)).toEqual(
      VERIFIED_ATTENTION_ANALYSIS,
    );

    expect(
      methodAnalysisSchema.safeParse({
        ...VERIFIED_ATTENTION_ANALYSIS,
        component_name: "AttentionPlayground",
      }).success,
    ).toBe(false);
  });

  it("enforces collection cardinality and strict nested records", () => {
    expect(
      methodAnalysisSchema.safeParse(
        withChanges({ steps: VERIFIED_ATTENTION_ANALYSIS.steps.slice(0, 2) }),
      ).success,
    ).toBe(false);
    expect(
      methodAnalysisSchema.safeParse(
        withChanges({
          parameters: Array.from(
            { length: 6 },
            (_, index) => ({
              name: `Parameter ${index}`,
              meaning: "A manipulable quantity.",
              effect: "It changes the method's behavior.",
            }),
          ),
        }),
      ).success,
    ).toBe(false);
    expect(
      methodAnalysisSchema.safeParse(
        withChanges({
          evidence: [
            {
              ...VERIFIED_ATTENTION_ANALYSIS.evidence[0],
              verbatim_quote: "Untrusted extra field",
            } as unknown as MethodAnalysis["evidence"][number],
          ],
        }),
      ).success,
    ).toBe(false);
    expect(
      methodAnalysisSchema.safeParse(withChanges({ limitations: [] })).success,
    ).toBe(false);
  });

  it.each([
    "0001.0001",
    "0703.0001",
    "0704.00001",
    "1501.0001",
    "1700.03762",
    "1706.00000",
    "1706.03762v0",
    "1706.03762v01",
  ])("rejects a non-canonical arXiv ID: %s", (arxivId) => {
    expect(
      methodAnalysisSchema.safeParse(withChanges({ arxiv_id: arxivId })).success,
    ).toBe(false);
  });
});

describe("cross-field consistency", () => {
  it.each([
    {
      name: "supported analysis without a slug",
      changes: { supported_lab_slug: null },
      code: "supported_requires_lab_slug",
    },
    {
      name: "unsupported analysis with a slug",
      changes: { compatibility: "unsupported" },
      code: "unsupported_requires_null_slug",
    },
    {
      name: "method family mapped to the wrong trusted lab",
      changes: { supported_lab_slug: "astar" },
      code: "method_family_lab_mismatch",
    },
    {
      name: "other family marked supported",
      changes: { detected_method_family: "other" },
      code: "other_family_is_unsupported",
    },
    {
      name: "low-confidence match treated as definitive",
      changes: { confidence: "low" },
      code: "low_confidence_is_non_definitive",
    },
  ] as const)("rejects $name", ({ changes, code }) => {
    const analysis = withChanges(changes as Partial<MethodAnalysis>);
    const issues = validateMethodAnalysisConsistency(analysis);

    expect(issues.map((issue) => issue.code)).toContain(code);
    // Structural parsing remains deliberately simple for Structured Outputs;
    // application code enforces these relationships in a separate pass.
    expect(methodAnalysisSchema.safeParse(analysis).success).toBe(true);
  });

  it("allows a low-confidence result only when it stays unsupported", () => {
    const cautious = withChanges({
      compatibility: "unsupported",
      supported_lab_slug: null,
      confidence: "low",
      match_reason:
        "The available excerpt is too limited to choose a laboratory safely.",
    });

    expect(validateMethodAnalysisConsistency(cautious)).toEqual([]);
    expect(methodAnalysisSchema.parse(cautious)).toEqual(cautious);
  });

  it("offers a typed consistency error after structural parsing", () => {
    const inconsistent = withChanges({ supported_lab_slug: null });

    expect(() => assertMethodAnalysisConsistency(inconsistent)).toThrow(
      MethodAnalysisConsistencyError,
    );

    try {
      parseMethodAnalysis(inconsistent);
      throw new Error("Expected parseMethodAnalysis to reject inconsistent data.");
    } catch (error) {
      expect(error).toBeInstanceOf(MethodAnalysisConsistencyError);
      expect((error as MethodAnalysisConsistencyError).issues[0]?.code).toBe(
        "supported_requires_lab_slug",
      );
    }
  });
});

describe("verified analysis cache", () => {
  it("contains the exact canonical Attention arXiv ID and hand-reviewed provenance", () => {
    const record = getVerifiedMethodAnalysis("1706.03762");

    expect(Object.keys(VERIFIED_METHOD_ANALYSIS_CACHE)).toEqual(["1706.03762"]);
    expect(record?.analysis.arxiv_id).toBe("1706.03762");
    expect(record?.analysis.detected_method_family).toBe(
      "scaled_dot_product_attention",
    );
    expect(record?.analysis.compatibility).toBe("supported");
    expect(record?.analysis.supported_lab_slug).toBe("attention");
    expect(record?.analysis.confidence).toBe("high");
    expect(record?.provenance.verification).toBe("hand-reviewed");
    expect(getVerifiedMethodAnalysis("1706.03762v7")).toBeUndefined();
  });
});

describe("JSON Schema synchronization", () => {
  it("mirrors the canonical structural fields, enums, and cardinalities", () => {
    const schemaPath = resolve(
      process.cwd(),
      "schema",
      "method-analysis.schema.json",
    );
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<
        string,
        {
          readonly enum?: readonly unknown[];
          readonly minItems?: number;
          readonly maxItems?: number;
          readonly pattern?: string;
        }
      >;
      $defs: Record<string, { readonly additionalProperties: boolean }>;
      allOf?: readonly unknown[];
    };

    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(METHOD_ANALYSIS_FIELDS);
    expect(schema.properties.arxiv_id.pattern).toBe(
      CANONICAL_ARXIV_ID_PATTERN.source,
    );
    expect(schema.properties.detected_method_family.enum).toEqual(
      DETECTED_METHOD_FAMILIES,
    );
    expect(schema.properties.compatibility.enum).toEqual(METHOD_COMPATIBILITIES);
    expect(schema.properties.supported_lab_slug.enum).toEqual([
      ...SUPPORTED_LAB_SLUGS,
      null,
    ]);
    expect(schema.properties.confidence.enum).toEqual(METHOD_CONFIDENCE_LEVELS);
    expect(schema.properties.steps).toMatchObject({ minItems: 3, maxItems: 7 });
    expect(schema.properties.parameters).toMatchObject({
      minItems: 0,
      maxItems: 5,
    });
    expect(schema.properties.evidence).toMatchObject({ minItems: 1, maxItems: 3 });
    expect(schema.properties.limitations).toMatchObject({
      minItems: 1,
      maxItems: 4,
    });
    expect(schema.$defs.parameter.additionalProperties).toBe(false);
    expect(schema.$defs.evidence.additionalProperties).toBe(false);
    expect(schema.allOf).toBeUndefined();
  });
});
