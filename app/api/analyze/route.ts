import { createHmac, randomBytes } from "node:crypto";

import {
  handleAnalyzeApiRequest,
} from "@/lib/ai/analysis-api";
import {
  createAnalysisRequestPolicy,
} from "@/lib/ai/analysis-request-policy";
import type { ArxivPaperAnalysisResult } from "@/lib/ai/analyze-arxiv-paper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const analysisPolicy = createAnalysisRequestPolicy<ArxivPaperAnalysisResult>();
const processLocalClientSalt = randomBytes(32);

export async function POST(request: Request): Promise<Response> {
  return handleAnalyzeApiRequest(request, {
    hashedClientKey: hashClientKey(request),
    policy: analysisPolicy,
  });
}

function hashClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientAddress =
    forwardedFor?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown-client";

  return createHmac("sha256", processLocalClientSalt)
    .update(clientAddress)
    .digest("base64url");
}
