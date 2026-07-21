import {
  parseMethodAnalysis,
  type MethodAnalysis,
} from "./method-analysis";

export interface VerifiedAnalysisProvenance {
  readonly verification: "hand-reviewed";
  readonly sourceUrl: string;
  readonly sourceVersion: string;
  readonly reviewedSections: readonly string[];
  readonly note: string;
}

export interface VerifiedMethodAnalysisRecord {
  readonly analysis: MethodAnalysis;
  readonly provenance: VerifiedAnalysisProvenance;
}

export const VERIFIED_ATTENTION_ANALYSIS = parseMethodAnalysis({
  arxiv_id: "1706.03762",
  paper_title: "Attention Is All You Need",
  authors: [
    "Ashish Vaswani",
    "Noam Shazeer",
    "Niki Parmar",
    "Jakob Uszkoreit",
    "Llion Jones",
    "Aidan N. Gomez",
    "Łukasz Kaiser",
    "Illia Polosukhin",
  ],
  method_name: "Scaled Dot-Product Attention",
  one_liner:
    "Scale query-key dot products, normalize each score row, and use the resulting weights to mix value vectors.",
  learning_goal:
    "Trace how dot products, square-root scaling, and softmax turn query-key compatibility into a weighted value output.",
  steps: [
    "Compute every query-key dot product to form a compatibility score matrix.",
    "Divide each score by the square root of the key dimension.",
    "Apply any required attention mask before normalization.",
    "Apply softmax across each query's scores to obtain attention weights.",
    "Multiply the attention weights by the value matrix to produce the output.",
  ],
  parameters: [
    {
      name: "Key dimension",
      meaning: "The dimensionality d_k shared by query and key vectors.",
      effect:
        "It determines the square-root divisor that controls score magnitude before softmax.",
    },
    {
      name: "Attention mask",
      meaning: "A set of query-key positions that are not allowed to receive attention.",
      effect:
        "Masked logits are excluded before softmax, preventing weight from flowing to those positions.",
    },
  ],
  detected_method_family: "scaled_dot_product_attention",
  compatibility: "supported",
  supported_lab_slug: "attention",
  match_reason:
    "The paper explicitly defines scaled dot-product attention as softmax(QKᵀ / √d_k)V, which is the trusted attention laboratory's method family.",
  confidence: "high",
  evidence: [
    {
      paper_section: "3.2.1 Scaled Dot-Product Attention",
      page_number: 4,
      paraphrased_support:
        "The paper defines the attention output by taking query-key dot products, dividing by the square root of d_k, applying softmax, and multiplying by V.",
    },
    {
      paper_section: "3.2.1 Scaled Dot-Product Attention",
      page_number: 4,
      paraphrased_support:
        "The authors explain that scaling counters large dot-product magnitudes that would otherwise push softmax into regions with very small gradients.",
    },
    {
      paper_section: "3.2.2 Multi-Head Attention",
      page_number: 5,
      paraphrased_support:
        "The paper applies the same attention function to projected query, key, and value representations before concatenating head outputs.",
    },
  ],
  limitations: [
    "This record describes scaled dot-product attention, not the complete Transformer architecture.",
    "The learning laboratory uses fixed toy vectors and does not reproduce trained model parameters.",
    "The laboratory demonstrates one attention calculation rather than full multi-head or autoregressive masking behavior.",
  ],
});

export const VERIFIED_METHOD_ANALYSIS_CACHE: Readonly<
  Record<string, VerifiedMethodAnalysisRecord>
> = {
  "1706.03762": {
    analysis: VERIFIED_ATTENTION_ANALYSIS,
    provenance: {
      verification: "hand-reviewed",
      sourceUrl: "https://arxiv.org/abs/1706.03762",
      sourceVersion: "v7",
      reviewedSections: [
        "3.2 Attention",
        "3.2.1 Scaled Dot-Product Attention",
        "3.2.2 Multi-Head Attention",
      ],
      note: "Curated application data; it was not accepted directly from model output.",
    },
  },
};

export function getVerifiedMethodAnalysis(
  arxivId: string,
): VerifiedMethodAnalysisRecord | undefined {
  return VERIFIED_METHOD_ANALYSIS_CACHE[arxivId];
}
