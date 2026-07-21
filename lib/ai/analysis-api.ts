import { ArxivInputError, normalizeArxivInput } from "../arxiv/normalize";

import {
  AnalysisServiceError,
  analyzeArxivPaper,
  type ArxivPaperAnalysisResult,
} from "./analyze-arxiv-paper";
import type { AnalysisRequestPolicy } from "./analysis-request-policy";
import { getVerifiedMethodAnalysis } from "./verified-cache";

export const MAX_ANALYZE_REQUEST_BYTES = 1_024;

export type AnalysisApiErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_ARXIV_INPUT"
  | "ANALYSIS_UNAVAILABLE"
  | "ANALYSIS_UNUSABLE"
  | "RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNAVAILABLE";

export interface AnalysisApiErrorBody {
  readonly ok: false;
  readonly error: {
    readonly code: AnalysisApiErrorCode;
    readonly message: string;
    readonly retryable: boolean;
  };
}

export interface AnalysisApiSuccessBody {
  readonly ok: true;
  readonly result: ArxivPaperAnalysisResult;
}

export type AnalysisApiBody = AnalysisApiSuccessBody | AnalysisApiErrorBody;

export interface AnalysisApiDependencies {
  readonly hashedClientKey: string;
  readonly policy: AnalysisRequestPolicy<ArxivPaperAnalysisResult>;
  readonly analyze?: typeof analyzeArxivPaper;
  readonly liveAnalysisConfigured?: boolean;
}

export async function handleAnalyzeApiRequest(
  request: Request,
  dependencies: AnalysisApiDependencies,
): Promise<Response> {
  const parsedBody = await readAnalyzeBody(request);
  if (!parsedBody.ok) {
    return apiError(
      400,
      "INVALID_REQUEST",
      parsedBody.message,
      false,
    );
  }

  let arxiv;
  try {
    arxiv = normalizeArxivInput(parsedBody.arxiv);
  } catch (error) {
    if (error instanceof ArxivInputError) {
      return apiError(
        400,
        "INVALID_ARXIV_INPUT",
        "Enter a valid arXiv ID or an HTTPS arxiv.org abs/pdf URL.",
        false,
      );
    }
    return apiError(
      400,
      "INVALID_ARXIV_INPUT",
      "The arXiv input could not be validated.",
      false,
    );
  }

  const analyze = dependencies.analyze ?? analyzeArxivPaper;

  // The hand-reviewed judge path is free, deterministic, and never consumes a
  // live-analysis quota slot.
  if (getVerifiedMethodAnalysis(arxiv.id)) {
    try {
      const result = await analyze(arxiv);
      return apiSuccess(result);
    } catch {
      return apiError(
        502,
        "UPSTREAM_UNAVAILABLE",
        "The verified analysis is temporarily unavailable.",
        true,
      );
    }
  }

  const cachedLiveResult = dependencies.policy.getCached(arxiv.id);
  if (cachedLiveResult) {
    return apiSuccess(cachedLiveResult.value);
  }

  const liveAnalysisConfigured =
    dependencies.liveAnalysisConfigured ??
    Boolean(process.env.OPENAI_API_KEY?.trim());
  if (!liveAnalysisConfigured) {
    return apiError(
      503,
      "ANALYSIS_UNAVAILABLE",
      "Live analysis requires OPENAI_API_KEY on this deployment. The verified Attention sample still works without it.",
      false,
    );
  }

  const decision = dependencies.policy.evaluate({
    hashedClientKey: dependencies.hashedClientKey,
    canonicalArxivId: arxiv.id,
  });

  if (decision.kind === "cached") {
    return apiSuccess(decision.value);
  }

  if (decision.kind === "rate-limited") {
    return apiError(
      429,
      "RATE_LIMITED",
      "Too many live analyses were requested. Try again shortly.",
      true,
      { "Retry-After": String(decision.retryAfterSeconds) },
    );
  }

  try {
    const result = await analyze(arxiv);
    if (result.provenance === "gpt-5.6") {
      dependencies.policy.cacheSuccess(arxiv.id, result);
    }
    return apiSuccess(result);
  } catch (error) {
    return mapAnalysisError(error);
  }
}

async function readAnalyzeBody(
  request: Request,
): Promise<
  | { readonly ok: true; readonly arxiv: string }
  | { readonly ok: false; readonly message: string }
> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, message: "Send the request as application/json." };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_ANALYZE_REQUEST_BYTES) {
      return { ok: false, message: "The request body is too large." };
    }
  }

  const boundedBody = await readBoundedRequestText(request);
  if (!boundedBody.ok) {
    return { ok: false, message: boundedBody.message };
  }
  const rawBody = boundedBody.text;

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, message: "Send a small JSON object with an arxiv field." };
  }

  if (!isRecord(body)) {
    return { ok: false, message: "Send a JSON object with an arxiv field." };
  }

  const keys = Object.keys(body);
  if (
    keys.length !== 1 ||
    keys[0] !== "arxiv" ||
    typeof body.arxiv !== "string"
  ) {
    return { ok: false, message: "The request must contain only a string arxiv field." };
  }

  return { ok: true, arxiv: body.arxiv };
}

async function readBoundedRequestText(
  request: Request,
): Promise<
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly message: string }
> {
  if (request.body === null) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_ANALYZE_REQUEST_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The size decision is already final even if cancellation races closure.
        }
        return { ok: false, message: "The request body is too large." };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The stream may already be errored or closed.
    }
    return { ok: false, message: "The request body could not be read." };
  }
}

function mapAnalysisError(error: unknown): Response {
  if (!(error instanceof AnalysisServiceError)) {
    return apiError(
      502,
      "UPSTREAM_UNAVAILABLE",
      "The paper analysis service is temporarily unavailable.",
      true,
    );
  }

  switch (error.code) {
    case "MISSING_API_KEY":
      return apiError(
        503,
        "ANALYSIS_UNAVAILABLE",
        "Live analysis requires OPENAI_API_KEY on this deployment. The verified Attention sample still works without it.",
        false,
      );
    case "MODEL_REFUSAL":
    case "UNUSABLE_MODEL_OUTPUT":
      return apiError(
        422,
        "ANALYSIS_UNUSABLE",
        "The paper did not produce a usable structured method analysis.",
        true,
      );
    case "UPSTREAM_TIMEOUT":
      return apiError(
        504,
        "UPSTREAM_TIMEOUT",
        "The analysis timed out before the paper could be processed.",
        true,
      );
    case "UPSTREAM_RATE_LIMIT":
    case "UPSTREAM_FAILURE":
      return apiError(
        502,
        "UPSTREAM_UNAVAILABLE",
        "The paper analysis provider is temporarily unavailable.",
        true,
      );
  }
}

function apiSuccess(result: ArxivPaperAnalysisResult): Response {
  const body: AnalysisApiSuccessBody = { ok: true, result };
  return Response.json(body, {
    status: 200,
    headers: baseHeaders(),
  });
}

function apiError(
  status: number,
  code: AnalysisApiErrorCode,
  message: string,
  retryable: boolean,
  extraHeaders?: HeadersInit,
): Response {
  const body: AnalysisApiErrorBody = {
    ok: false,
    error: { code, message, retryable },
  };
  return Response.json(body, {
    status,
    headers: { ...baseHeaders(), ...headersToRecord(extraHeaders) },
  });
}

function baseHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(new Headers(headers));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
