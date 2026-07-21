import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";

import type { NormalizedArxivInput } from "../arxiv/normalize";

import {
  MethodAnalysisSchema,
  assertMethodAnalysisConsistency,
  type MethodAnalysis,
} from "./method-analysis";
import {
  METHOD_ANALYSIS_SYSTEM_PROMPT,
  createMethodAnalysisUserMessage,
} from "./method-analysis-prompt";
import { getVerifiedMethodAnalysis } from "./verified-cache";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6";
export const DEFAULT_ANALYSIS_TIMEOUT_MS = 90_000;
export const ANALYSIS_MAX_RETRIES = 1;

export type AnalysisProvenance = "verified_cache" | "gpt-5.6";

export interface ArxivPaperAnalysisResult {
  readonly analysis: MethodAnalysis;
  readonly provenance: AnalysisProvenance;
  readonly canonicalArxivId: string;
  readonly recordUrl: string;
  readonly model: string | null;
}

export type AnalysisServiceErrorCode =
  | "MISSING_API_KEY"
  | "MODEL_REFUSAL"
  | "UNUSABLE_MODEL_OUTPUT"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_RATE_LIMIT"
  | "UPSTREAM_FAILURE";

export class AnalysisServiceError extends Error {
  readonly code: AnalysisServiceErrorCode;

  constructor(code: AnalysisServiceErrorCode, message: string) {
    super(message);
    this.name = "AnalysisServiceError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface AnalyzeArxivPaperOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly client?: Pick<OpenAI, "responses">;
}

export async function analyzeArxivPaper(
  arxiv: NormalizedArxivInput,
  options: AnalyzeArxivPaperOptions = {},
): Promise<ArxivPaperAnalysisResult> {
  const verified = getVerifiedMethodAnalysis(arxiv.id);
  if (verified) {
    return {
      analysis: verified.analysis,
      provenance: "verified_cache",
      canonicalArxivId: arxiv.id,
      recordUrl: arxiv.recordUrl,
      model: null,
    };
  }

  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new AnalysisServiceError(
      "MISSING_API_KEY",
      "Live arXiv analysis is not configured on this deployment.",
    );
  }

  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const requestedTimeoutMs = options.timeoutMs ?? DEFAULT_ANALYSIS_TIMEOUT_MS;
  const timeoutMs =
    Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
      ? Math.min(requestedTimeoutMs, DEFAULT_ANALYSIS_TIMEOUT_MS)
      : DEFAULT_ANALYSIS_TIMEOUT_MS;
  const client =
    options.client ??
    new OpenAI({
      apiKey,
      logLevel: "off",
    });
  const totalBudgetController = new AbortController();
  let totalBudgetExpired = false;
  let totalBudgetTimer: ReturnType<typeof setTimeout> | undefined;
  const totalBudgetDeadline = new Promise<never>((_resolve, reject) => {
    totalBudgetTimer = setTimeout(() => {
      totalBudgetExpired = true;
      totalBudgetController.abort();
      reject(
        new AnalysisServiceError(
          "UPSTREAM_TIMEOUT",
          "The analysis provider did not respond before the timeout.",
        ),
      );
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      client.responses.parse(
        {
          model,
          input: [
            {
              role: "system",
              content: METHOD_ANALYSIS_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: createMethodAnalysisUserMessage(arxiv.id),
                },
                {
                  type: "input_file",
                  file_url: arxiv.pdfUrl,
                },
              ],
            },
          ],
          text: {
            format: zodTextFormat(MethodAnalysisSchema, "method_analysis"),
          },
          reasoning: {
            effort: "medium",
          },
          store: false,
        },
        {
          timeout: timeoutMs,
          maxRetries: ANALYSIS_MAX_RETRIES,
          signal: totalBudgetController.signal,
        },
      ),
      totalBudgetDeadline,
    ]);

    if (containsRefusal(response.output)) {
      throw new AnalysisServiceError(
        "MODEL_REFUSAL",
        "The paper could not be analyzed for this request.",
      );
    }

    if (response.status !== "completed" || response.output_parsed === null) {
      throw new AnalysisServiceError(
        "UNUSABLE_MODEL_OUTPUT",
        "The analysis did not produce a complete structured result.",
      );
    }

    const parsed = MethodAnalysisSchema.safeParse(response.output_parsed);
    if (!parsed.success) {
      throw new AnalysisServiceError(
        "UNUSABLE_MODEL_OUTPUT",
        "The analysis did not match the required structured contract.",
      );
    }

    try {
      assertMethodAnalysisConsistency(parsed.data);
    } catch {
      throw new AnalysisServiceError(
        "UNUSABLE_MODEL_OUTPUT",
        "The analysis contained an inconsistent laboratory match.",
      );
    }

    if (parsed.data.arxiv_id !== arxiv.id) {
      throw new AnalysisServiceError(
        "UNUSABLE_MODEL_OUTPUT",
        "The analysis did not identify the requested paper consistently.",
      );
    }

    return {
      analysis: parsed.data,
      provenance: "gpt-5.6",
      canonicalArxivId: arxiv.id,
      recordUrl: arxiv.recordUrl,
      model,
    };
  } catch (error) {
    if (totalBudgetExpired) {
      throw new AnalysisServiceError(
        "UPSTREAM_TIMEOUT",
        "The analysis provider did not respond before the timeout.",
      );
    }
    throw classifyAnalysisError(error);
  } finally {
    if (totalBudgetTimer !== undefined) {
      clearTimeout(totalBudgetTimer);
    }
  }
}

function containsRefusal(output: readonly unknown[]): boolean {
  for (const item of output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }
    if (
      item.content.some(
        (content) => isRecord(content) && content.type === "refusal",
      )
    ) {
      return true;
    }
  }
  return false;
}

function classifyAnalysisError(error: unknown): AnalysisServiceError {
  if (error instanceof AnalysisServiceError) {
    return error;
  }

  if (
    error instanceof ZodError ||
    error instanceof SyntaxError ||
    getErrorName(error) === "ZodError" ||
    getErrorName(error) === "SyntaxError"
  ) {
    return new AnalysisServiceError(
      "UNUSABLE_MODEL_OUTPUT",
      "The analysis did not match the required structured contract.",
    );
  }

  if (
    error instanceof OpenAI.APIConnectionTimeoutError ||
    getErrorName(error) === "APIConnectionTimeoutError" ||
    getErrorName(error) === "APIUserAbortError" ||
    getErrorName(error) === "AbortError"
  ) {
    return new AnalysisServiceError(
      "UPSTREAM_TIMEOUT",
      "The analysis provider did not respond before the timeout.",
    );
  }

  const status = getErrorStatus(error);
  if (error instanceof OpenAI.RateLimitError || status === 429) {
    return new AnalysisServiceError(
      "UPSTREAM_RATE_LIMIT",
      "The analysis provider is temporarily rate limited.",
    );
  }

  return new AnalysisServiceError(
    "UPSTREAM_FAILURE",
    "The analysis provider could not complete the request.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorName(error: unknown): string | undefined {
  return isRecord(error) && typeof error.name === "string" ? error.name : undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  return isRecord(error) && typeof error.status === "number"
    ? error.status
    : undefined;
}
