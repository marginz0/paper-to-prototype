const arxiv = process.argv[2];
const apiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
const expectedModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
const expectedModelIsGpt56 = /^gpt-5\.6(?:$|-)/.test(expectedModel);

if (!arxiv) {
  console.error("Smoke failed: pass an arXiv ID, for example `npm run smoke:analyze -- 1706.03762v7`.");
  process.exitCode = 2;
} else if (!apiKeyConfigured) {
  console.error("Smoke skipped: OPENAI_API_KEY is required for a real live analysis.");
  process.exitCode = 2;
} else if (!expectedModelIsGpt56) {
  console.error("Smoke failed: OPENAI_MODEL must select GPT-5.6 for this integration gate.");
  process.exitCode = 2;
} else {
  const siteUrl = process.env.SITE_URL?.trim() || "http://localhost:3000";
  let endpoint;

  try {
    endpoint = new URL("/api/analyze", siteUrl);
  } catch {
    console.error("Smoke failed: SITE_URL must be a valid absolute origin.");
    process.exitCode = 2;
  }

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arxiv }),
      });
      const payload = await response.json();

      if (!response.ok || payload?.ok !== true) {
        const code = payload?.error?.code ?? "UNKNOWN_ERROR";
        console.error(`Smoke failed: HTTP ${response.status} / ${code}.`);
        process.exitCode = 1;
      } else {
        const result = payload.result;
        const analysis = result?.analysis;
        const isExpectedAttentionResult =
          result?.provenance === "gpt-5.6" &&
          result?.model === expectedModel &&
          result?.canonicalArxivId === arxiv &&
          analysis?.arxiv_id === arxiv &&
          analysis?.detected_method_family === "scaled_dot_product_attention" &&
          analysis?.compatibility === "supported" &&
          analysis?.supported_lab_slug === "attention";

        if (!isExpectedAttentionResult) {
          console.error("Smoke failed: the sanitized structured result did not produce the expected live Attention match.");
          process.exitCode = 1;
        } else {
          console.log(`Smoke succeeded: ${arxiv} -> attention (gpt-5.6, schema and consistency checks passed).`);
        }
      }
    } catch {
      console.error(
        "Smoke failed: the local application could not be reached. Start it first and verify SITE_URL.",
      );
      process.exitCode = 1;
    }
  }
}
