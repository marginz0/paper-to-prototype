import { describe, expect, it } from "vitest";

import {
  ATTENTION_STAGE_SUMMARIES,
  describeSelectedAttention,
  formatAttentionPercentage,
} from "./attention-education";

describe("attention educational copy", () => {
  it("keeps a plain-language explanation for every calculation stage", () => {
    expect(Object.values(ATTENTION_STAGE_SUMMARIES)).toEqual([
      "Represent each word using numbers.",
      "Create three mathematical views of each word.",
      "Compare the current word with the others.",
      "Control excessively large comparison values.",
      "Convert scores into proportions totaling approximately 100%.",
      "Combine information using those proportions.",
    ]);
  });

  it("formats a selected attention weight as a learner-readable percentage", () => {
    expect(formatAttentionPercentage(0.204)).toBe("20.4%");
    expect(describeSelectedAttention("follows", "map", 0.204)).toBe(
      "While processing ‘follows’, this toy calculation assigns 20.4% of its attention to ‘map’.",
    );
  });
});
