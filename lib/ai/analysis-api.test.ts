import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeArxivInput } from "../arxiv/normalize";

import {
  MAX_ANALYZE_REQUEST_BYTES,
  handleAnalyzeApiRequest,
  type AnalysisApiBody,
} from "./analysis-api";
import { createAnalysisRequestPolicy } from "./analysis-request-policy";
import {
  AnalysisServiceError,
  type ArxivPaperAnalysisResult,
} from "./analyze-arxiv-paper";
import { VERIFIED_ATTENTION_ANALYSIS } from "./verified-cache";

function request(body: unknown, headers?: HeadersInit): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function dependencies(
  analyze: (arxiv: ReturnType<typeof normalizeArxivInput>) => Promise<ArxivPaperAnalysisResult>,
  maxLiveRequests = 5,
) {
  return {
    hashedClientKey: "opaque-hash",
    policy: createAnalysisRequestPolicy<ArxivPaperAnalysisResult>({
      maxLiveRequests,
      now: () => 1_000,
    }),
    analyze,
    liveAnalysisConfigured: true,
  };
}

function liveResult(arxivId = "2207.09238"): ArxivPaperAnalysisResult {
  return {
    analysis: {
      ...VERIFIED_ATTENTION_ANALYSIS,
      arxiv_id: arxivId,
      paper_title: "Live test paper",
    },
    provenance: "gpt-5.6",
    canonicalArxivId: arxivId,
    recordUrl: `https://arxiv.org/abs/${arxivId}`,
    model: "gpt-5.6",
  };
}

async function body(response: Response): Promise<AnalysisApiBody> {
  return (await response.json()) as AnalysisApiBody;
}

describe("analysis API request validation", () => {
  it.each([
    ["malformed JSON", "{"],
    ["non-object", "[]"],
    ["missing field", {}],
    ["wrong type", { arxiv: 170603762 }],
    ["unknown field", { arxiv: "1706.03762", url: "https://evil.test" }],
  ])("returns a stable 400 for %s", async (_name, input) => {
    const response = await handleAnalyzeApiRequest(
      request(input),
      dependencies(vi.fn()),
    );

    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST", retryable: false },
    });
  });

  it("rejects unsafe arXiv input without reflecting it", async () => {
    const unsafe = "https://evil.test/<script>alert(1)</script>";
    const response = await handleAnalyzeApiRequest(
      request({ arxiv: unsafe }),
      dependencies(vi.fn()),
    );
    const responseText = await response.text();

    expect(response.status).toBe(400);
    expect(responseText).toContain("INVALID_ARXIV_INPUT");
    expect(responseText).not.toContain(unsafe);
    expect(responseText).not.toContain("<script>");
  });

  it("enforces the body limit with and without a declared content length", async () => {
    const oversized = "x".repeat(MAX_ANALYZE_REQUEST_BYTES + 1);
    for (const headers of [undefined, { "content-length": String(oversized.length) }]) {
      const response = await handleAnalyzeApiRequest(
        request(oversized, headers),
        dependencies(vi.fn()),
      );
      expect(response.status).toBe(400);
      expect(await body(response)).toMatchObject({
        error: { code: "INVALID_REQUEST" },
      });
    }
  });

  it("rejects non-JSON media types before considering a live analysis", async () => {
    const response = await handleAnalyzeApiRequest(
      request(JSON.stringify({ arxiv: "2207.09238" }), {
        "content-type": "text/plain",
      }),
      dependencies(vi.fn()),
    );

    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({
      error: { code: "INVALID_REQUEST", retryable: false },
    });
  });

  it("cancels an undeclared oversized request stream at the 1 KB boundary", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode("x".repeat(MAX_ANALYZE_REQUEST_BYTES + 1)),
        );
        controller.enqueue(new TextEncoder().encode("unread-tail"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const streamingRequest = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await handleAnalyzeApiRequest(
      streamingRequest,
      dependencies(vi.fn()),
    );

    expect(response.status).toBe(400);
    expect(cancelled).toBe(true);
  });
});

describe("analysis API result and error mapping", () => {
  it("serves the verified Attention result without a live quota or key", async () => {
    const analyze = vi.fn().mockResolvedValue({
      analysis: VERIFIED_ATTENTION_ANALYSIS,
      provenance: "verified_cache",
      canonicalArxivId: "1706.03762",
      recordUrl: "https://arxiv.org/abs/1706.03762",
      model: null,
    } satisfies ArxivPaperAnalysisResult);
    const response = await handleAnalyzeApiRequest(
      request({ arxiv: "1706.03762" }),
      dependencies(analyze, 1),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await body(response)).toMatchObject({
      ok: true,
      result: {
        provenance: "verified_cache",
        analysis: { supported_lab_slug: "attention" },
      },
    });
  });

  it.each([
    ["MISSING_API_KEY", 503, "ANALYSIS_UNAVAILABLE"],
    ["MODEL_REFUSAL", 422, "ANALYSIS_UNUSABLE"],
    ["UNUSABLE_MODEL_OUTPUT", 422, "ANALYSIS_UNUSABLE"],
    ["UPSTREAM_TIMEOUT", 504, "UPSTREAM_TIMEOUT"],
    ["UPSTREAM_RATE_LIMIT", 502, "UPSTREAM_UNAVAILABLE"],
    ["UPSTREAM_FAILURE", 502, "UPSTREAM_UNAVAILABLE"],
  ] as const)("maps %s to a sanitized response", async (serviceCode, status, apiCode) => {
    const secret = "sk-route-secret";
    const rawUpstream = "raw upstream response and prompt";
    const analyze = vi.fn().mockRejectedValue(
      Object.assign(
        new AnalysisServiceError(serviceCode, `${secret} ${rawUpstream}`),
        { stack: "private stack trace", response: rawUpstream },
      ),
    );

    const response = await handleAnalyzeApiRequest(
      request({ arxiv: "2207.09238" }),
      dependencies(analyze),
    );
    const responseText = await response.text();

    expect(response.status).toBe(status);
    expect(responseText).toContain(apiCode);
    expect(responseText).not.toContain(secret);
    expect(responseText).not.toContain(rawUpstream);
    expect(responseText).not.toContain("private stack trace");
  });

  it("returns the missing-key state before consuming live quota", async () => {
    const analyze = vi.fn(async (arxiv: ReturnType<typeof normalizeArxivInput>) =>
      liveResult(arxiv.id),
    );
    const deps = {
      ...dependencies(analyze, 1),
      liveAnalysisConfigured: false,
    };

    const first = await handleAnalyzeApiRequest(
      request({ arxiv: "2207.09238" }),
      deps,
    );
    const second = await handleAnalyzeApiRequest(
      request({ arxiv: "2301.00001" }),
      { ...deps, liveAnalysisConfigured: true },
    );

    expect(first.status).toBe(503);
    expect(await body(first)).toMatchObject({
      error: { code: "ANALYSIS_UNAVAILABLE", retryable: false },
    });
    expect(second.status).toBe(200);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("returns 429 and Retry-After after the live quota is exhausted", async () => {
    const analyze = vi.fn(async (arxiv: ReturnType<typeof normalizeArxivInput>) =>
      liveResult(arxiv.id),
    );
    const deps = dependencies(analyze, 1);

    const first = await handleAnalyzeApiRequest(
      request({ arxiv: "2207.09238" }),
      deps,
    );
    const limited = await handleAnalyzeApiRequest(
      request({ arxiv: "2301.00001" }),
      deps,
    );

    expect(first.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("900");
    expect(await body(limited)).toMatchObject({
      error: { code: "RATE_LIMITED", retryable: true },
    });
  });

  it("briefly reuses a successful live result without a provider call or current key", async () => {
    const analyze = vi.fn(async () => liveResult());
    const deps = dependencies(analyze, 1);

    const first = await handleAnalyzeApiRequest(
      request({ arxiv: "2207.09238" }),
      deps,
    );
    const cached = await handleAnalyzeApiRequest(
      request({ arxiv: "https://arxiv.org/abs/2207.09238" }),
      { ...deps, liveAnalysisConfigured: false },
    );

    expect(first.status).toBe(200);
    expect(cached.status).toBe(200);
    expect(analyze).toHaveBeenCalledOnce();
  });

  it("sanitizes an unexpected thrown object", async () => {
    const response = await handleAnalyzeApiRequest(
      request({ arxiv: "2207.09238" }),
      dependencies(vi.fn().mockRejectedValue({ apiKey: "sk-leak", prompt: "raw" })),
    );
    const responseText = await response.text();

    expect(response.status).toBe(502);
    expect(responseText).not.toContain("sk-leak");
    expect(responseText).not.toContain("prompt");
  });
});
