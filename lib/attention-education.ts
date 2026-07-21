import type { AttentionPhase } from "@/lib/algorithms/attention";

export const ATTENTION_STAGE_SUMMARIES: Record<AttentionPhase, string> = {
  0: "Represent each word using numbers.",
  1: "Create three mathematical views of each word.",
  2: "Compare the current word with the others.",
  3: "Control excessively large comparison values.",
  4: "Convert scores into proportions totaling approximately 100%.",
  5: "Combine information using those proportions.",
};

export function formatAttentionPercentage(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`;
}

export function describeSelectedAttention(
  queryToken: string,
  keyToken: string,
  weight: number,
): string {
  return `While processing ‘${queryToken}’, this toy calculation assigns ${formatAttentionPercentage(weight)} of its attention to ‘${keyToken}’.`;
}
