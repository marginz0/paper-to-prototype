const arxiv = process.argv[2];
const apiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

if (!arxiv) {
  console.error("Smoke failed: pass an arXiv ID, for example `npm run smoke:analyze -- 2207.09238`.");
  process.exitCode = 2;
} else if (!apiKeyConfigured) {
  console.error("Smoke skipped: OPENAI_API_KEY is required for a real live analysis.");
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
        const compatibility = payload.result?.analysis?.compatibility ?? "unknown";
        const provenance = payload.result?.provenance ?? "unknown";
        console.log(
          `Smoke succeeded: ${payload.result?.canonicalArxivId ?? arxiv} -> ${compatibility} (${provenance}).`,
        );
      }
    } catch {
      console.error(
        "Smoke failed: the local application could not be reached. Start it first and verify SITE_URL.",
      );
      process.exitCode = 1;
    }
  }
}
