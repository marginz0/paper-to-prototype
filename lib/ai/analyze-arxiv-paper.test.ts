import type OpenAI from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeArxivInput } from "../arxiv/normalize";

import {
  ANALYSIS_MAX_RETRIES,
  AnalysisServiceError,
  DEFAULT_ANALYSIS_TIMEOUT_MS,
  analyzeArxivPaper,
} from "./analyze-arxiv-paper";
import {
  MethodAnalysisSchema,
  type MethodAnalysis,
} from "./method-analysis";
import { VERIFIED_ATTENTION_ANALYSIS } from "./verified-cache";

const liveArxiv = normalizeArxivInput("2207.09238");

function liveAnalysis(
  changes: Partial<MethodAnalysis> = {},
): MethodAnalysis {
  return {
    ...VERIFIED_ATTENTION_ANALYSIS,
    arxiv_id: liveArxiv.id,
    paper_title: "A deterministic test paper",
    ...changes,
  };
}

function fakeClient(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  return {
    client: { responses: { parse } } as unknown as Pick<OpenAI, "responses">,
    parse,
  };
}

function fakeFailure(error: unknown) {
  const parse = vi.fn().mockRejectedValue(error);
  return {
    client: { responses: { parse } } as unknown as Pick<OpenAI, "responses">,
    parse,
  };
}

function completed(outputParsed: unknown, output: unknown[] = []) {
  return {
    status: "completed",
    output,
    output_parsed: outputParsed,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("verified analysis path", () => {
  it("returns the reviewed Attention analysis without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    await expect(
      analyzeArxivPaper(normalizeArxivInput("1706.03762")),
    ).resolves.toMatchObject({
      provenance: "verified_cache",
      canonicalArxivId: "1706.03762",
      model: null,
      analysis: {
        paper_title: "Attention Is All You Need",
        supported_lab_slug: "attention",
      },
    });
  });
});

describe("live GPT-5.6 analysis", () => {
  it("requires an API key only for non-cached papers", async () => {
    await expect(
      analyzeArxivPaper(liveArxiv, { apiKey: "" }),
    ).rejects.toMatchObject({ code: "MISSING_API_KEY" });
  });

  it("uses the verified Responses API, PDF, schema, retry, and timeout shape", async () => {
    const { client, parse } = fakeClient(completed(liveAnalysis()));

    const result = await analyzeArxivPaper(liveArxiv, {
      apiKey: "test-key",
      client,
    });

    expect(result).toMatchObject({
      provenance: "gpt-5.6",
      canonicalArxivId: liveArxiv.id,
      recordUrl: liveArxiv.recordUrl,
      model: "gpt-5.6",
    });
    expect(parse).toHaveBeenCalledOnce();
    const [body, requestOptions] = parse.mock.calls[0];
    expect(body).toMatchObject({
      model: "gpt-5.6",
      reasoning: { effort: "medium" },
      store: false,
      text: { format: { type: "json_schema", name: "method_analysis" } },
    });
    expect(body.input[1].content[1]).toEqual({
      type: "input_file",
      file_url: liveArxiv.pdfUrl,
    });
    expect(JSON.stringify(body.input)).toContain(liveArxiv.id);
    expect(requestOptions).toMatchObject({
      timeout: DEFAULT_ANALYSIS_TIMEOUT_MS,
      maxRetries: ANALYSIS_MAX_RETRIES,
    });
    expect(requestOptions.signal).toBeInstanceOf(AbortSignal);
    expect(requestOptions.signal.aborted).toBe(false);
  });

  it("enforces one total wall-clock budget across the SDK retry lifecycle", async () => {
    vi.useFakeTimers();
    const timeoutMs = 75;
    const parse = vi.fn(
      (_body: unknown, _requestOptions: { signal: AbortSignal }) => {
        void _body;
        void _requestOptions;
        return new Promise<never>(() => {});
      },
    );
    const client = {
      responses: { parse },
    } as unknown as Pick<OpenAI, "responses">;

    const analysis = analyzeArxivPaper(liveArxiv, {
      apiKey: "test-key",
      client,
      timeoutMs,
    });
    const rejection = expect(analysis).rejects.toMatchObject({
      code: "UPSTREAM_TIMEOUT",
    });

    await vi.advanceTimersByTimeAsync(timeoutMs - 1);
    expect(parse.mock.calls[0]?.[1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;

    expect(parse).toHaveBeenCalledOnce();
    expect(parse.mock.calls[0]?.[1]).toMatchObject({
      timeout: timeoutMs,
      maxRetries: ANALYSIS_MAX_RETRIES,
    });
    expect(parse.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });

  it("never accepts a live-analysis budget above the 90-second production cap", async () => {
    const { client, parse } = fakeClient(completed(liveAnalysis()));

    await analyzeArxivPaper(liveArxiv, {
      apiKey: "test-key",
      client,
      timeoutMs: DEFAULT_ANALYSIS_TIMEOUT_MS * 2,
    });

    expect(parse.mock.calls[0]?.[1].timeout).toBe(DEFAULT_ANALYSIS_TIMEOUT_MS);
  });

  it("preserves a valid unsupported result without forcing a lab mapping", async () => {
    const unsupported = liveAnalysis({
      detected_method_family: "other",
      compatibility: "unsupported",
      supported_lab_slug: null,
      confidence: "medium",
      match_reason:
        "The paper's central method is not faithfully represented by a trusted engine.",
    });
    const { client } = fakeClient(completed(unsupported));

    await expect(
      analyzeArxivPaper(liveArxiv, { apiKey: "test-key", client }),
    ).resolves.toMatchObject({ analysis: unsupported, provenance: "gpt-5.6" });
  });

  it("rejects a model refusal", async () => {
    const { client } = fakeClient(
      completed(null, [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "raw refusal text" }],
        },
      ]),
    );

    await expect(
      analyzeArxivPaper(liveArxiv, { apiKey: "test-key", client }),
    ).rejects.toMatchObject({ code: "MODEL_REFUSAL" });
  });

  it.each([
    ["absent parsed output", null],
    ["malformed parsed output", { paper_title: "partial" }],
    ["wrong paper ID", liveAnalysis({ arxiv_id: "1706.03762" })],
    [
      "inconsistent mapping",
      liveAnalysis({ supported_lab_slug: "kmeans" }),
    ],
  ])("rejects %s", async (_name, parsed) => {
    const { client } = fakeClient(completed(parsed));

    await expect(
      analyzeArxivPaper(liveArxiv, { apiKey: "test-key", client }),
    ).rejects.toMatchObject({ code: "UNUSABLE_MODEL_OUTPUT" });
  });

  it("rejects an incomplete upstream response", async () => {
    const { client } = fakeClient({
      status: "incomplete",
      output: [],
      output_parsed: liveAnalysis(),
    });

    await expect(
      analyzeArxivPaper(liveArxiv, { apiKey: "test-key", client }),
    ).rejects.toMatchObject({ code: "UNUSABLE_MODEL_OUTPUT" });
  });

  it.each([
    [
      "a Zod structured-output rejection",
      () => MethodAnalysisSchema.parse({ paper_title: "partial" }),
    ],
    ["a JSON syntax rejection", () => JSON.parse("{")],
  ])("maps %s to unusable model output", async (_name, createError) => {
    let parseError: unknown;
    try {
      createError();
    } catch (error) {
      parseError = error;
    }
    const { client } = fakeFailure(parseError);

    await expect(
      analyzeArxivPaper(liveArxiv, { apiKey: "test-key", client }),
    ).rejects.toMatchObject({ code: "UNUSABLE_MODEL_OUTPUT" });
  });
});

describe("safe upstream error mapping", () => {
  it.each([
    ["APIConnectionTimeoutError", undefined, "UPSTREAM_TIMEOUT"],
    ["APIUserAbortError", undefined, "UPSTREAM_TIMEOUT"],
    ["AbortError", undefined, "UPSTREAM_TIMEOUT"],
    ["RateLimitError", 429, "UPSTREAM_RATE_LIMIT"],
    ["InternalServerError", 500, "UPSTREAM_FAILURE"],
  ])("maps %s without leaking details", async (name, status, code) => {
    const rawSecret = "sk-test-do-not-leak";
    const rawPrompt = "paper prompt contents must not leak";
    const { client } = fakeFailure({
      name,
      status,
      message: `${rawSecret} ${rawPrompt}`,
      response: { body: "raw upstream response" },
      stack: "private stack trace",
    });

    let thrown: unknown;
    try {
      await analyzeArxivPaper(liveArxiv, { apiKey: rawSecret, client });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AnalysisServiceError);
    expect(thrown).toMatchObject({ code });
    const serialized = JSON.stringify(thrown);
    expect(serialized).not.toContain(rawSecret);
    expect(serialized).not.toContain(rawPrompt);
    expect(serialized).not.toContain("raw upstream response");
    expect(serialized).not.toContain("private stack trace");
  });
});
